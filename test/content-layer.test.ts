import { describe, expect, test } from 'bun:test'

import {
  adaptBlogEntry,
  adaptSayingEntry,
  adaptTraceEntry
} from '../src/lib/content-layer/adapters'
import { toContentCardViewData, toTextCardViewData } from '../src/lib/content-layer/card-data'
import {
  buildCollectionPageData,
  buildDetailPageData,
  createPageItem,
  getPageItems,
  toMediaCardData,
  toStandardCardData
} from '../src/lib/content-layer/page-data'
import {
  contentPolicyConfig,
  resolveContentPolicy,
  validateContentPolicy,
  type ContentPolicyConfig
} from '../src/lib/content-layer/policy'
import { queryContent, sortContentRecords } from '../src/lib/content-layer/queries'
import {
  toReadingArticleBottomData,
  toReadingBackgroundData,
  toReadingCommentPolicy,
  toReadingCopyrightData,
  toReadingFrameData,
  toReadingHeaderData,
  toReadingNavigation,
  toReadingStatsData
} from '../src/lib/content-layer/reading-data'
import {
  isReadingFeatureVisible,
  resolveReadingPageConfig,
  type ReadingPageConfigOverride,
  type ReadingPageConfigRegistry
} from '../src/lib/content-layer/reading-policy'
import { contentTagPath, contentTypeRegistry } from '../src/lib/content-layer/registry'
import {
  getContentTagCounts,
  getContentTagIndexEntries,
  getTagRecords
} from '../src/lib/content-layer/tags'
import {
  buildCollectionStaticPaths,
  resolveContentPageSize,
  toPaginatorProps
} from '../src/lib/content-layer/pagination'
import type {
  BlogEntry,
  ContentCatalog,
  RenderablePageItem,
  SayingEntry,
  TraceEntry
} from '../src/lib/content-layer/types'

const blogDate = new Date('2026-08-20T00:00:00.000Z')
const blogUpdatedDate = new Date('2026-08-25T00:00:00.000Z')
const traceDate = new Date('2026-08-18T00:00:00.000Z')

function makeBlogEntry(id = 'canonical-blog'): BlogEntry {
  return {
    collection: 'blog',
    id,
    data: {
      comment: true,
      description: 'A normalized Blog description.',
      draft: false,
      heroImage: {
        alt: 'A meaningful cover',
        color: '#659EB9',
        src: '/images/blog-cover.webp'
      },
      language: 'zh-CN',
      publishDate: blogDate,
      tags: ['architecture', 'content'],
      title: 'Canonical Blog',
      updatedDate: blogUpdatedDate
    }
  } as unknown as BlogEntry
}

function makeTraceEntry(id = 'canonical-trace'): TraceEntry {
  return {
    collection: 'trace',
    id,
    data: {
      cover: { src: '/images/trace-cover.webp' },
      coverAlt: 'A Trace cover',
      description: 'A normalized Trace description.',
      draft: false,
      publishDate: traceDate,
      tags: ['content'],
      title: 'Canonical Trace'
    }
  } as unknown as TraceEntry
}

function makeSayingEntry(id = 'canonical-saying'): SayingEntry {
  return {
    collection: 'saying',
    id,
    data: {
      author: 'An Author',
      draft: false,
      originalText: 'Original wording',
      source: 'A Book',
      tags: ['content', 'voice'],
      text: 'A normalized Saying.'
    }
  } as unknown as SayingEntry
}

function makeCatalog(): ContentCatalog {
  const blog = adaptBlogEntry(makeBlogEntry())
  const trace = adaptTraceEntry(makeTraceEntry())
  const saying = adaptSayingEntry(makeSayingEntry())
  return {
    all: [blog, trace, saying],
    byKind: {
      blog: [blog],
      saying: [saying],
      trace: [trace]
    },
    mode: 'published'
  }
}

/** Reattach the domain fields the render boundary normally supplies. */
function resolvedItem(
  record:
    | ReturnType<typeof adaptBlogEntry>
    | ReturnType<typeof adaptTraceEntry>
    | ReturnType<typeof adaptSayingEntry>,
  options = {}
) {
  const item = createPageItem(record, options)
  return { ...item, card: toStandardCardData(record), record }
}

function renderableItem(entry: BlogEntry | TraceEntry | SayingEntry): RenderablePageItem {
  const record =
    entry.collection === 'blog'
      ? adaptBlogEntry(entry)
      : entry.collection === 'trace'
        ? adaptTraceEntry(entry)
        : adaptSayingEntry(entry)
  return { ...resolvedItem(record), source: entry } as RenderablePageItem
}

describe('canonical content adapters', () => {
  test('preserves source meaning while assigning stable keys and routes', () => {
    const blog = adaptBlogEntry(makeBlogEntry())
    const trace = adaptTraceEntry(makeTraceEntry())
    const saying = adaptSayingEntry(makeSayingEntry())

    expect(blog).toMatchObject({
      cardTitle: 'Canonical Blog',
      href: '/blog/canonical-blog',
      key: 'blog:canonical-blog',
      kind: 'blog',
      title: 'Canonical Blog'
    })
    expect(blog.image).toEqual({
      alt: 'A meaningful cover',
      key: 'content-canonical-blog',
      src: '/images/blog-cover.webp'
    })

    expect(trace).toMatchObject({
      href: '/traces/canonical-trace',
      key: 'trace:canonical-trace',
      kind: 'trace',
      title: 'Canonical Trace'
    })
    expect(trace.image).toEqual({
      alt: 'A Trace cover',
      key: 'content-canonical-trace',
      src: '/images/trace-cover.webp'
    })

    expect(saying).toMatchObject({
      author: 'An Author',
      cardTitle: '“A normalized Saying.”',
      href: '/sayings/canonical-saying',
      key: 'saying:canonical-saying',
      kind: 'saying',
      originalText: 'Original wording',
      source: 'A Book',
      title: 'A normalized Saying.'
    })
    expect(saying.tags).toEqual(['content', 'voice'])
  })

  test('projects all content kinds into one standard card shape', () => {
    const records = [
      adaptBlogEntry(makeBlogEntry()),
      adaptTraceEntry(makeTraceEntry()),
      adaptSayingEntry(makeSayingEntry())
    ]
    const expectedKeys = [
      'contentId',
      'contentType',
      'date',
      'description',
      'footerText',
      'href',
      'image',
      'title'
    ]

    for (const record of records) {
      expect(Object.keys(toStandardCardData(record)).sort()).toEqual(expectedKeys)
    }

    expect(toStandardCardData(records[0]!)).toMatchObject({
      contentId: 'canonical-blog',
      contentType: 'blog',
      date: blogUpdatedDate,
      href: '/blog/canonical-blog',
      title: 'Canonical Blog'
    })
    expect(toStandardCardData(records[2]!)).toMatchObject({
      contentId: 'canonical-saying',
      contentType: 'saying',
      description: 'Original wording · — An Author',
      footerText: 'A Book',
      image: undefined,
      title: '“A normalized Saying.”'
    })
  })
})

describe('presentation projections', () => {
  test('dispatches by visual family while keeping content kinds interchangeable', () => {
    const blog = adaptBlogEntry(makeBlogEntry())
    const trace = adaptTraceEntry(makeTraceEntry())
    const saying = adaptSayingEntry(makeSayingEntry())

    expect(toContentCardViewData(resolvedItem(blog)).family).toBe('text')
    expect(toContentCardViewData(resolvedItem(trace)).family).toBe('media')
    expect(toContentCardViewData(resolvedItem(saying)).family).toBe('media')
    expect(
      toContentCardViewData(resolvedItem(trace, { presentation: 'text' })).family
    ).toBe('text')
  })

  test('keeps Blog-only metadata in the text view model instead of the renderer', () => {
    const blog = adaptBlogEntry(makeBlogEntry())
    const view = toTextCardViewData(resolvedItem(blog), { readingMinutes: '8 min read' })

    expect(view).toMatchObject({
      draft: false,
      family: 'text',
      skin: 'blog'
    })
    expect(view.metadata).toEqual([
      { icon: 'time', value: '8 min read' },
      { icon: 'earth', value: 'zh-CN' }
    ])
    expect(view.tags).toEqual([
      { href: '/blog/tags/architecture', label: 'architecture' },
      { href: '/blog/tags/content', label: 'content' }
    ])
  })
})

describe('page data hierarchy', () => {
  test('uses the same page → section → group → item tree for collections', () => {
    const record = adaptTraceEntry(makeTraceEntry())
    const page = buildCollectionPageData('trace-archive', '/traces', [record])
    const item = getPageItems(page, 'content', 'items')[0]

    expect(page.page).toEqual({ kind: 'trace-archive', route: '/traces' })
    expect(page.sections.map((section) => section.key)).toEqual(['content'])
    expect(page.sections[0]?.groups.map((group) => group.key)).toEqual(['items'])
    expect(item?.contentKey).toBe('trace:canonical-trace')
    expect(item?.placement.presentation).toBe('media-content')
    expect(Object.keys(item ?? {}).sort()).toEqual(['contentKey', 'key', 'placement'])
    expect(item && 'source' in item).toBe(false)
    expect(item && 'record' in item).toBe(false)
    expect(item && 'card' in item).toBe(false)
  })

  test('uses one detail hierarchy while keeping primary and related meanings', () => {
    const record = adaptBlogEntry(makeBlogEntry())
    const page = buildDetailPageData('blog-detail', '/blog/canonical-blog', record, [record], {
      primaryMeaning: '当前 Blog 文章',
      relatedGroupKey: 'posts',
      relatedMeaning: '相关推荐',
      relatedSectionMeaning: '详情页推荐'
    })

    expect(page.sections.map((section) => section.key)).toEqual(['article', 'related'])
    expect(getPageItems(page, 'article', 'primary')[0]?.contentKey).toBe('blog:canonical-blog')
    expect(getPageItems(page, 'related', 'posts')).toHaveLength(1)
    expect(page.sections[1]?.meaning).toBe('详情页推荐')
  })

  test('can carry the canonical archive image placement into a detail primary item', () => {
    const first = adaptSayingEntry(makeSayingEntry('first'))
    const second = adaptSayingEntry(makeSayingEntry('second'))
    const archive = buildCollectionPageData('saying-archive', '/sayings', [first, second])
    const archiveItem = getPageItems(archive, 'content', 'items')[1]
    const detail = buildDetailPageData(
      'saying-detail',
      '/sayings/second',
      second,
      [first, second],
      {
        primaryMeaning: '当前 Saying 文章',
        relatedGroupKey: 'sayings',
        relatedMeaning: '相关推荐',
        relatedSectionMeaning: '详情页推荐',
        primaryCardPlacement: archiveItem?.placement
      }
    )

    expect(getPageItems(detail, 'article', 'primary')[0]?.placement).toMatchObject({
      imageAssignment: archiveItem?.placement.imageAssignment,
      index: archiveItem?.placement.index
    })
  })

  test('centralizes presentation defaults and page-level overrides', () => {
    const trace = adaptTraceEntry(makeTraceEntry())
    const defaultItem = createPageItem(trace)
    const overriddenItem = createPageItem(trace, { presentation: 'text' })
    const legacyItem = createPageItem(trace, { presentation: 'large-skull-content' })

    expect(defaultItem.placement.presentation).toBe('media-content')
    expect(overriddenItem.placement.presentation).toBe('text')
    expect(legacyItem.placement.presentation).toBe('media-content')
    expect(toMediaCardData(resolvedItem(trace)).image.source).toBe('content')
  })
})

describe('archive pagination', () => {
  test('resolves enabled and disabled page sizes independently', () => {
    expect(resolveContentPageSize({ enabled: true, pageSize: 8 })).toBe(8)
    expect(resolveContentPageSize({ enabled: false, pageSize: 8 })).toBe(Number.POSITIVE_INFINITY)
    expect(resolveContentPageSize(3)).toBe(3)
    expect(() => resolveContentPageSize({ enabled: true, pageSize: 0 })).toThrow(
      'positive integer'
    )
  })

  test('builds the complete collection PageData before handing items to Astro pagination', () => {
    const first = adaptTraceEntry(makeTraceEntry('first'))
    const second = adaptTraceEntry(makeTraceEntry('second'))
    const baseCatalog = makeCatalog()
    const catalog: ContentCatalog = {
      ...baseCatalog,
      all: [...baseCatalog.all.filter((record) => record.kind !== 'trace'), first, second],
      byKind: { ...baseCatalog.byKind, trace: [first, second] }
    }
    const calls: Array<{ items: unknown[]; options: Record<string, unknown> }> = []
    const paginate = ((items: unknown[], options: Record<string, unknown>) => {
      calls.push({ items, options })
      return [{ params: { page: undefined }, props: options.props, data: items.slice(0, 1) }]
    }) as never

    const paths = buildCollectionStaticPaths(catalog, 'trace', paginate, {
      itemOptions: { headingLevel: 2 },
      pagination: { enabled: true, pageSize: 1 },
      props: { collectionsCount: 2 }
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.options.pageSize).toBe(1)
    expect(calls[0]?.options.props).toEqual({ collectionsCount: 2 })
    expect(calls[0]?.items).toHaveLength(2)
    expect(calls[0]?.items[0]).toMatchObject({
      contentKey: 'trace:first',
      placement: { headingLevel: 2, presentation: 'media-content' }
    })
    expect(paths).toHaveLength(1)
  })

  test('maps Astro prev/next URLs into type-specific paginator copy', () => {
    const page = {
      url: { prev: '/traces', next: '/traces/3' }
    } as never

    expect(
      toPaginatorProps(page, {
        nextSrLabel: 'Next traces page',
        previousSrLabel: 'Previous traces page'
      })
    ).toEqual({
      nextUrl: {
        srLabel: 'Next traces page',
        text: 'Next →',
        url: '/traces/3'
      },
      prevUrl: {
        srLabel: 'Previous traces page',
        text: '← Previous',
        url: '/traces'
      }
    })
  })

  test('rejects numeric content IDs when finite pagination would collide with a detail route', () => {
    const baseCatalog = makeCatalog()
    const numericTrace = adaptTraceEntry(makeTraceEntry('2'))
    const catalog: ContentCatalog = {
      ...baseCatalog,
      all: [...baseCatalog.all.filter((record) => record.kind !== 'trace'), numericTrace],
      byKind: { ...baseCatalog.byKind, trace: [numericTrace] }
    }
    const paginate = (() => []) as never

    expect(() =>
      buildCollectionStaticPaths(catalog, 'trace', paginate, {
        pagination: { enabled: true, pageSize: 8 }
      })
    ).toThrow('numeric archive pagination route')
  })
})

describe('registry and build-time policy', () => {
  test('keeps every taxonomy route scoped to its own content type', () => {
    expect(contentTagPath('blog')).toBe('/blog/tags')
    expect(contentTagPath('trace')).toBe('/traces/tags')
    expect(contentTagPath('saying')).toBe('/sayings/tags')
    expect(contentTagPath('blog', 'architecture')).toBe('/blog/tags/architecture')
    expect(contentTypeRegistry.blog.tagPath).not.toBe('/tags')
  })

  test('can switch all three types to one presentation profile without changing PageData', () => {
    const uniform: ContentPolicyConfig = {
      ...contentPolicyConfig,
      preset: 'uniform',
      uniform: {
        cardPresentation: 'text',
        readingHeader: 'article',
        related: 'adjacent'
      },
      overrides: {}
    }

    expect(resolveContentPolicy('blog', uniform)).toMatchObject({
      cardPresentation: 'text',
      readingHeader: 'article',
      related: 'adjacent'
    })
    expect(resolveContentPolicy('trace', uniform)).toMatchObject({
      cardPresentation: 'text',
      readingHeader: 'article',
      related: 'adjacent'
    })
    expect(resolveContentPolicy('saying', uniform)).toMatchObject({
      cardPresentation: 'text',
      readingHeader: 'article',
      related: 'adjacent'
    })
    expect(validateContentPolicy(uniform)).toEqual([])
  })

  test('allows one type to diverge through a small override', () => {
    const custom: ContentPolicyConfig = {
      ...contentPolicyConfig,
      preset: 'custom',
      overrides: {
        trace: { cardPresentation: 'text', readingHeader: 'article', related: 'none' }
      }
    }

    expect(resolveContentPolicy('blog', custom).cardPresentation).toBe('text')
    expect(resolveContentPolicy('trace', custom)).toMatchObject({
      cardPresentation: 'text',
      related: 'none'
    })
    expect(resolveContentPolicy('saying', custom).cardPresentation).toBe('media-decorative')
  })

  test('normalizes historical presentation values in persisted policy-shaped data', () => {
    const legacy = {
      ...contentPolicyConfig,
      uniform: {
        ...contentPolicyConfig.uniform,
        cardPresentation: 'large-skull-content'
      }
    } as unknown as ContentPolicyConfig

    expect(resolveContentPolicy('trace', legacy).cardPresentation).toBe('media-content')
    expect(validateContentPolicy(legacy)).toEqual([])
  })

  test('controls the reading copyright surface per content type', () => {
    expect(resolveContentPolicy('blog').surfaces.copyright).toBe(true)
    expect(resolveContentPolicy('trace').surfaces.copyright).toBe(false)
    expect(resolveContentPolicy('saying').surfaces.copyright).toBe(false)

    const reenabled: ContentPolicyConfig = {
      ...contentPolicyConfig,
      overrides: {
        trace: { surfaces: { copyright: true } }
      }
    }

    expect(resolveContentPolicy('trace', reenabled).surfaces.copyright).toBe(true)
    expect(resolveContentPolicy('saying', reenabled).surfaces.copyright).toBe(false)
    expect(validateContentPolicy(reenabled)).toEqual([])
  })
})

describe('reading projections', () => {
  test('projects one normalized header model for every content kind', () => {
    const blog = toReadingHeaderData(renderableItem(makeBlogEntry()), {
      commentInfo: true,
      readingTime: '8 min read'
    })
    const traceItem = renderableItem(makeTraceEntry())
    const sayingItem = renderableItem(makeSayingEntry())
    const trace = toReadingHeaderData(traceItem)
    const saying = toReadingHeaderData(sayingItem)

    expect(blog).toMatchObject({
      commentInfo: true,
      eyebrow: 'Blog',
      meta: { language: 'zh-CN', readingTime: '8 min read' },
      openingMedia: { alt: 'A meaningful cover', src: '/images/blog-cover.webp' },
      tags: [
        { href: '/blog/tags/architecture', label: 'architecture' },
        { href: '/blog/tags/content', label: 'content' }
      ]
    })
    expect(trace.openingMedia).toMatchObject({
      alt: 'A Trace cover',
      key: 'content-canonical-trace',
      src: toMediaCardData(traceItem).image.src
    })
    expect(saying).toMatchObject({
      accessibleTitle: 'Saying: A normalized Saying.',
      eyebrow: 'Saying',
      openingMedia: {
        alt: '',
        key: toMediaCardData(sayingItem).image.key,
        src: toMediaCardData(sayingItem).image.src
      },
      quote: {
        author: 'An Author',
        originalText: 'Original wording',
        source: 'A Book',
        text: 'A normalized Saying.'
      }
    })
    expect(saying.tags[0]).toEqual({ href: '/sayings/tags/content', label: 'content' })
  })

  test('keeps Blog opening media optional when heroImage is absent', () => {
    const entry = makeBlogEntry('text-only-blog')
    const textOnlyEntry = {
      ...entry,
      data: { ...entry.data, heroImage: undefined }
    } as BlogEntry
    const item = renderableItem(textOnlyEntry)

    expect(adaptBlogEntry(textOnlyEntry).image).toBeUndefined()
    expect(toReadingHeaderData(item).openingMedia).toBeUndefined()
  })

  test('resolves page capability defaults and targeted overrides independently', () => {
    const blog = resolveReadingPageConfig('blog-detail', 'blog')
    const trace = resolveReadingPageConfig('trace-detail', 'trace')
    const saying = resolveReadingPageConfig('saying-detail', 'saying')

    expect(blog).toMatchObject({
      body: { imageZoom: 'on', signature: 'off' },
      footer: {
        copyright: 'auto',
        related: 'recommendations',
        relatedVariant: 'article-bottom'
      },
      header: {
        layout: 'media-first-article',
        metadataVariant: 'blog',
        openingMedia: {
          backdrop: { mode: 'on', variant: 'blur' },
          mode: 'auto',
          variant: 'layered-blur'
        },
        readingTime: 'on'
      },
      background: { mode: 'on', variant: 'gradient' }
    })
    expect(trace).toMatchObject({
      body: { signature: 'off' },
      footer: { copyright: 'off', related: 'adjacent', relatedVariant: 'cards' },
      header: {
        commentInfo: 'auto',
        layout: 'article',
        openingMedia: {
          backdrop: { mode: 'on', variant: 'blur' },
          mode: 'auto',
          variant: 'layered-blur'
        }
      },
      background: { mode: 'on', variant: 'gradient' }
    })
    expect(trace.header.openingMedia).toEqual(blog.header.openingMedia)
    expect(saying.header.commentInfo).toBe('auto')
    expect(saying.body.signature).toBe('off')
    expect(saying.header.layout).toBe('quote')
    expect(saying.footer.relatedVariant).toBe('cards')
    expect(saying.header.openingMedia).toEqual({
      backdrop: { mode: 'off', variant: 'blur' },
      mode: 'auto',
      variant: 'standard'
    })
    expect(saying.background).toEqual({ mode: 'on', variant: 'gradient' })

    const override: ReadingPageConfigOverride = {
      background: { mode: 'off' },
      body: { signature: 'on' },
      header: {
        openingMedia: {
          backdrop: { mode: 'on' },
          mode: 'on',
          variant: 'standard'
        },
        publishedDate: 'off',
        tags: 'plain'
      },
      footer: { copyright: 'on', related: 'none' }
    }
    const customized = resolveReadingPageConfig('trace-detail', 'trace', { override })
    expect(customized).toMatchObject({
      background: { mode: 'off', variant: 'gradient' },
      body: { signature: 'on' },
      footer: { copyright: 'on', related: 'none' },
      header: {
        openingMedia: {
          backdrop: { mode: 'on', variant: 'blur' },
          mode: 'on',
          variant: 'standard'
        },
        publishedDate: 'off',
        tags: 'plain'
      }
    })

    const registry: ReadingPageConfigRegistry = {
      overrides: {
        'trace-detail': { header: { language: 'on' }, footer: { copyright: 'on' } }
      }
    }
    const fromRegistry = resolveReadingPageConfig('trace-detail', 'trace', {
      pageConfig: registry
    })
    expect(fromRegistry).toMatchObject({
      footer: { copyright: 'on' },
      header: { language: 'on' }
    })

    expect(isReadingFeatureVisible('auto', true)).toBe(true)
    expect(isReadingFeatureVisible('on', false)).toBe(false)
    expect(isReadingFeatureVisible('off', true)).toBe(false)
  })

  test('projects static stats and background input without inventing values', () => {
    const blog = renderableItem(makeBlogEntry())
    const saying = renderableItem(makeSayingEntry())
    const blogHeader = toReadingHeaderData(blog, { readingTime: '8 min read' })
    const sayingHeader = toReadingHeaderData(saying)

    expect(toReadingStatsData(blog, '8 min read')).toEqual({
      language: 'zh-CN',
      publishedAt: blogDate,
      readingTime: '8 min read',
      updatedAt: blogUpdatedDate
    })
    expect(toReadingStatsData(saying)).toEqual({
      language: undefined,
      publishedAt: undefined,
      readingTime: undefined,
      updatedAt: undefined
    })

    expect(toReadingBackgroundData(blogHeader, '#fallback')).toEqual({ color: '#659EB9' })
    expect(toReadingBackgroundData(blogHeader, '#fallback', '#explicit')).toEqual({
      color: '#explicit'
    })
    expect(toReadingBackgroundData(sayingHeader, '#fallback')).toEqual({ color: '#fallback' })
  })

  test('derives adjacent navigation from canonical page item keys', () => {
    const first = adaptTraceEntry(makeTraceEntry('first'))
    const current = adaptTraceEntry(makeTraceEntry('current'))
    const last = adaptTraceEntry(makeTraceEntry('last'))
    const items = [first, current, last].map((record, index) => resolvedItem(record, { index }))

    expect(toReadingNavigation(items[1]!, items)).toEqual({
      next: {
        contentType: 'trace',
        href: '/traces/last',
        key: 'trace:last',
        title: 'Canonical Trace'
      },
      previous: {
        contentType: 'trace',
        href: '/traces/first',
        key: 'trace:first',
        title: 'Canonical Trace'
      }
    })
  })

  test('keeps the legacy Blog bottom renderer behind an explicit adapter', () => {
    const blog = renderableItem(makeBlogEntry())
    const trace = renderableItem(makeTraceEntry())

    expect(toReadingArticleBottomData(blog, [blog])).toMatchObject({
      collections: [blog.source],
      id: 'canonical-blog'
    })
    expect(toReadingArticleBottomData(trace, [trace])).toBeUndefined()
  })

  test('normalizes frame, copyright and comment policies without inventing Saying dates', () => {
    const blog = adaptBlogEntry(makeBlogEntry())
    const trace = adaptTraceEntry(makeTraceEntry())
    const saying = adaptSayingEntry(makeSayingEntry())

    expect(toReadingFrameData(blog)).toMatchObject({
      backHref: '/blog',
      contentTypeLabel: 'Blog',
      meta: {
        articleDate: blogDate.toISOString(),
        articleModifiedDate: blogUpdatedDate.toISOString(),
        ogImage: '/images/blog-cover.webp',
        title: 'Canonical Blog'
      }
    })
    expect(toReadingFrameData(saying)).toMatchObject({
      backHref: '/sayings',
      contentTypeLabel: 'Saying',
      meta: { title: 'A normalized Saying.' }
    })
    expect(toReadingFrameData(saying).meta.articleDate).toBeUndefined()
    expect(toReadingCopyrightData(saying)).toMatchObject({ title: 'A normalized Saying.' })
    expect(toReadingCommentPolicy(blog, true)).toEqual({ enabled: true, showPageInfo: true })
    expect(toReadingCommentPolicy(trace, true)).toEqual({ enabled: true, showPageInfo: true })
    expect(toReadingCommentPolicy(saying, true)).toEqual({ enabled: true, showPageInfo: true })
    expect(toReadingCommentPolicy(blog, true, 'off')).toEqual({
      enabled: false,
      showPageInfo: false
    })
    expect(toReadingCommentPolicy(blog, true, 'on')).toEqual({
      enabled: true,
      showPageInfo: true
    })
  })
})

describe('catalog query policies', () => {
  test('filters by kind/tag and applies pagination after shared ordering', () => {
    const catalog = makeCatalog()
    const result = queryContent(catalog, {
      kinds: ['blog', 'trace'],
      limit: 1,
      offset: 0,
      tag: 'CONTENT',
      sort: 'publish-date-desc'
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.kind).toBe('blog')
  })

  test('never mixes equal tag names across content-type taxonomies', () => {
    const catalog = makeCatalog()

    expect(getTagRecords(catalog, 'blog', 'content').map((record) => record.kind)).toEqual(['blog'])
    expect(getTagRecords(catalog, 'trace', 'content').map((record) => record.kind)).toEqual([
      'trace'
    ])
    expect(getTagRecords(catalog, 'saying', 'content').map((record) => record.kind)).toEqual([
      'saying'
    ])
    expect(getContentTagCounts(catalog, 'blog')).toEqual([
      { count: 1, href: '/blog/tags/architecture', tag: 'architecture' },
      { count: 1, href: '/blog/tags/content', tag: 'content' }
    ])
  })

  test('builds registry-ordered type-level tag index entries', () => {
    expect(getContentTagIndexEntries(makeCatalog())).toEqual([
      { href: '/blog/tags', kind: 'blog', label: 'Blog Tags', tagCount: 2 },
      { href: '/traces/tags', kind: 'trace', label: 'Trace Tags', tagCount: 1 },
      { href: '/sayings/tags', kind: 'saying', label: 'Saying Tags', tagCount: 2 }
    ])
  })

  test('makes date and id tie behavior explicit', () => {
    const first = adaptTraceEntry(makeTraceEntry('zeta'))
    const second = adaptTraceEntry(makeTraceEntry('alpha'))
    const input = [first, second]

    expect(sortContentRecords(input, 'publish-date-desc').map((record) => record.id)).toEqual([
      'alpha',
      'zeta'
    ])
    expect(sortContentRecords(input, 'editorial-date-desc').map((record) => record.id)).toEqual([
      'zeta',
      'alpha'
    ])
    expect(sortContentRecords(input, 'id-asc').map((record) => record.id)).toEqual([
      'alpha',
      'zeta'
    ])
  })
})
