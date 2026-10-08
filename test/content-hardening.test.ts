import { describe, expect, test } from 'bun:test'

import { formatContentDate } from '../src/lib/content'
import { adaptBlogEntry } from '../src/lib/content-layer/adapters'
import {
  adjacentContentRecords,
  buildCollectionPageData,
  buildHomePageData,
  createResolvedPageItem,
  getPageItems,
  resolveMediaImage,
  toStandardCardData
} from '../src/lib/content-layer/page-data'
import { buildCollectionStaticPaths } from '../src/lib/content-layer/pagination'
import { contentPolicyConfig, resolveContentPolicy } from '../src/lib/content-layer/policy'
import { getContentYear } from '../src/lib/content-layer/queries'
import { toReadingFrameData } from '../src/lib/content-layer/reading-data'
import {
  contentPath,
  contentTagLabel,
  contentTagPath,
  contentTagSlug
} from '../src/lib/content-layer/registry'
import { buildTagStaticPaths, getTagRecords } from '../src/lib/content-layer/tags'
import type {
  ContentCatalog,
  ContentRecord,
  PageItem,
  TraceRecord
} from '../src/lib/content-layer/types'
import {
  contentTagsSchema,
  contentText,
  hasValidEditorialDates,
  sourceUrlSchema
} from '../src/lib/content-validation'
import { prepareFeedContent, resolveFeedReference } from '../src/lib/rss-content'
import { theme } from '../src/site.config'

function trace(id: string, day: number, cover = false): TraceRecord {
  return {
    kind: 'trace',
    key: `trace:${id}`,
    id,
    href: contentPath('trace', id),
    title: id,
    cardTitle: id,
    tags: ['Shared'],
    draft: false,
    publishedAt: new Date(`2026-01-${String(day).padStart(2, '0')}T00:00:00Z`),
    ...(cover ? { image: { src: '/_astro/editor-cover.webp', alt: 'Author cover' } } : {})
  }
}
function catalog(traces: TraceRecord[]): ContentCatalog {
  return { mode: 'published', all: traces, byKind: { blog: [], trace: traces, saying: [] } }
}
function imageFor(item: PageItem, record: ContentRecord) {
  return resolveMediaImage({ ...item, record, card: toStandardCardData(record) })
}

describe('content publishing regressions', () => {
  test('preserves local image metadata through adapters and social metadata', () => {
    const entry = {
      collection: 'blog',
      id: 'local-cover',
      data: {
        title: 'Local cover',
        description: 'Local image metadata',
        comment: true,
        draft: false,
        publishDate: new Date('2026-01-01'),
        tags: [],
        heroImage: {
          alt: 'Meaningful alt',
          src: { src: '/_astro/cover.webp', width: 100, height: 80, format: 'webp' }
        }
      }
    } as Parameters<typeof adaptBlogEntry>[0]
    const record = adaptBlogEntry(entry)
    expect(record.image?.src).toBe('/_astro/cover.webp')
    expect(toReadingFrameData(record).meta.ogImage).toBe('/_astro/cover.webp')
    expect(toReadingFrameData(record).meta.ogImageWidth).toBe(100)
    expect(toReadingFrameData(record).meta.ogImageHeight).toBe(80)
  })

  test('shares fallback and real Trace covers across home, archive, tags and detail placements', () => {
    const records = [trace('older', 1), trace('with-cover', 3, true), trace('newer', 2)]
    const data = catalog(records)
    const home = getPageItems(buildHomePageData(data), 'recent-writing', 'trace')
    const archive = getPageItems(
      buildCollectionPageData('trace-archive', '/traces', records),
      'content',
      'items'
    )
    let tagged: PageItem[] = []
    buildTagStaticPaths(
      data,
      'trace',
      ((items: PageItem[]) => {
        tagged = items
        return []
      }) as never,
      10
    )
    for (const record of records) {
      const archiveItem = archive.find((item) => item.contentKey === record.key)!
      const images = [home, archive, tagged].map((items) =>
        imageFor(
          items.find((item) => item.contentKey === record.key)!,
          record
        )
      )
      expect(new Set(images.map((image) => image.src)).size).toBe(1)
      expect(resolveMediaImage(createResolvedPageItem(record, archiveItem.placement)).src).toBe(
        images[0]?.src
      )
      if (record.image)
        expect(images[0]).toMatchObject({
          src: record.image.src,
          decorative: false,
          source: 'content'
        })
    }
  })

  test('sorts tag results before pagination and encodes tags as one route segment', () => {
    const data = catalog([trace('old', 1), trace('new', 3), trace('middle', 2)])
    expect(getTagRecords(data, 'trace', 'shared').map((record) => record.id)).toEqual([
      'new',
      'middle',
      'old'
    ])
    const specialTagData = catalog([{ ...trace('tagged', 1), tags: ['CI/CD #开发'] }])
    const calls: Array<{ params: { tag: string } }> = []
    buildTagStaticPaths(
      specialTagData,
      'trace',
      ((_items: PageItem[], options: { params: { tag: string } }) => {
        calls.push(options)
        return []
      }) as never,
      2
    )
    expect(
      calls.some(
        ({ params }) => `/traces/tags/${params.tag}` === contentTagPath('trace', 'CI/CD #开发')
      )
    ).toBe(true)
    expect(contentTagSlug('工程实践')).toBe('工程实践')
    for (const tag of ['CI/CD #开发', 'a_/b', '~tag', '100%', 'c++']) {
      expect(contentTagLabel(contentTagSlug(tag))).toBe(tag)
    }
  })

  test('encodes nested IDs by segment and rejects routes that collide with taxonomy', () => {
    expect(contentPath('blog', 'folder/中文 name')).toBe('/blog/folder/%E4%B8%AD%E6%96%87%20name')
    expect(() => contentPath('blog', 'tags/anything')).toThrow('reserved tags')
    expect(() => contentPath('trace', '../escape')).toThrow('nonempty path segments')
  })

  test('turning off reading disables public discovery and archive generation', () => {
    const policy = resolveContentPolicy('trace', {
      ...contentPolicyConfig,
      overrides: { trace: { surfaces: { reading: false } } }
    })
    for (const surface of ['archive', 'home', 'main-nav', 'rss', 'search', 'tags'] as const)
      expect(policy.surfaces[surface]).toBe(false)
    const original = contentPolicyConfig.overrides.trace
    try {
      contentPolicyConfig.overrides.trace = { surfaces: { reading: false } }
      const data = catalog([trace('entry', 1)])
      expect(getPageItems(buildHomePageData(data), 'recent-writing', 'trace')).toEqual([])
      const forbiddenPaginate = () => {
        throw new Error('Disabled routes must not paginate')
      }
      expect(
        buildCollectionStaticPaths(data, 'trace', forbiddenPaginate, { pagination: 10 })
      ).toEqual([])
      expect(buildTagStaticPaths(data, 'trace', forbiddenPaginate, 10)).toEqual([])
    } finally {
      if (original) contentPolicyConfig.overrides.trace = original
      else delete contentPolicyConfig.overrides.trace
    }
  })

  test('keeps detail path data bounded while retaining the correct neighbors', () => {
    const records = Array.from({ length: 1000 }, (_, index) => trace(`entry-${index}`, 1))
    const related = records.map((_, index) => adjacentContentRecords(records, index))
    expect(related.reduce((count, items) => count + items.length, 0)).toBe(2998)
    expect(related[500]!.map((record) => record.id)).toEqual([
      'entry-499',
      'entry-500',
      'entry-501'
    ])
  })

  test('normalizes whitespace and checks editorial dates and source protocols', () => {
    expect(contentTagsSchema.parse([' Astro ', 'astro', '中文'])).toEqual(['astro', '中文'])
    expect(() => contentTagsSchema.parse([' '])).toThrow()
    expect(() => contentText(60).parse(' ')).toThrow()
    expect(
      hasValidEditorialDates({
        publishDate: new Date('2026-02-01'),
        updatedDate: new Date('2026-01-01')
      })
    ).toBe(false)
    expect(sourceUrlSchema.safeParse('javascript:alert(1)').success).toBe(false)
    expect(sourceUrlSchema.safeParse('https://example.com/source').success).toBe(true)
    const newYear = new Date('2026-12-31T17:00:00Z')
    expect(getContentYear(newYear)).toBe(2027)
    expect(formatContentDate(newYear)).toBe('2027年1月1日')
    expect(theme.locale.dateOptions.timeZone).toBe('Asia/Shanghai')
    expect(
      new Intl.DateTimeFormat(theme.locale.dateLocale, theme.locale.dateOptions).format(newYear)
    ).toBe('2027年1月1日')
  })
})

describe('RSS rendered content', () => {
  const options = {
    permalink: new URL('https://example.com/blog/custom-slug'),
    filePath: 'src/content/blog/folder/post.mdx',
    contentLinks: new Map([['/src/content/blog/other.md', '/blog/a-different-slug']]),
    resolveAsset: async (path: string) =>
      path === '/src/content/blog/shared/cover.png' ? '/_astro/cover.webp' : undefined
  }
  test('resolves flat or nested source files independently from their public slug', async () => {
    expect(await resolveFeedReference('../shared/cover.png', options, true)).toBe(
      'https://example.com/_astro/cover.webp'
    )
    expect(await resolveFeedReference('../other.md#part', options)).toBe(
      'https://example.com/blog/a-different-slug#part'
    )
    expect(await resolveFeedReference('#part', options)).toBe(
      'https://example.com/blog/custom-slug#part'
    )
    expect(await resolveFeedReference('/images/public.webp', options, true)).toBe(
      'https://example.com/images/public.webp'
    )
  })
  test('preserves tables, alerts and MathML while removing scripts and duplicate interactive markup', async () => {
    const html = await prepareFeedContent(
      '<table><tr><td>GFM cell</td></tr></table><blockquote><p>Note: alert body</p></blockquote><span class="katex"><span class="katex-mathml"><math><mi>x</mi></math></span><span class="katex-html">duplicate formula</span></span><button>Copy</button><script>bad()</script><img src="../shared/cover.png"><a href="javascript:bad()">Unsafe</a>',
      options
    )
    expect(html).toContain('<table>')
    expect(html).toContain('alert body')
    expect(html).toContain('<math><mi>x</mi></math>')
    expect(html).toContain('https://example.com/_astro/cover.webp')
    expect(html).not.toContain('duplicate formula')
    expect(html).not.toContain('bad()')
    expect(html).not.toContain('Copy')
  })
})
