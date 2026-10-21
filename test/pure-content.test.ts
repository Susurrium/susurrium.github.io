import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import rss from '@astrojs/rss'
import { describe, expect, test } from 'bun:test'
import { parse } from 'node-html-parser'
import { codeToHtml } from 'shiki'

import { generatePaginateFunction } from '../node_modules/astro/dist/core/render/paginate.js'
import { toTextCardViewData } from '../src/lib/content-layer/card-data'
import {
  buildHomePageData,
  createResolvedPageItem,
  getPageItems
} from '../src/lib/content-layer/page-data'
import { buildCollectionStaticPaths } from '../src/lib/content-layer/pagination'
import { sortContentRecords } from '../src/lib/content-layer/queries'
import { getTagRecords } from '../src/lib/content-layer/tags'
import type { BlogRecord, ContentCatalog } from '../src/lib/content-layer/types'
import { rssItemDates } from '../src/lib/rss-dates'
import {
  addCollapse,
  addCopyButton,
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerRemoveNotationEscape,
  updateStyle
} from '../src/plugins/shiki-transformers'

function blog(id: string, date: string, pinned = false): BlogRecord {
  return {
    kind: 'blog',
    key: `blog:${id}`,
    id,
    href: `/blog/${id}`,
    title: id,
    cardTitle: id,
    comment: true,
    draft: false,
    tags: ['test'],
    publishedAt: new Date(date),
    pinned
  }
}
const records = [
  blog('new', '2026-10-20'),
  blog('pin-b', '2026-09-01', true),
  blog('pin-a', '2026-09-01', true)
]
const catalog: ContentCatalog = {
  mode: 'published',
  all: records,
  byKind: { blog: records, trace: [], saying: [] }
}

describe('Blog pin placement and RSS dates', () => {
  test('pins before slicing, keeps stable ties, and leaves the input order intact', () => {
    const items = sortContentRecords(Object.freeze([...records]), 'pinned-editorial-date-desc')
    expect(items.map(({ id }) => id)).toEqual(['pin-a', 'pin-b', 'new'])
    expect(records.map(({ id }) => id)).toEqual(['new', 'pin-b', 'pin-a'])
    expect(getTagRecords(catalog, 'blog', 'test').map(({ id }) => id)).toEqual([
      'pin-a',
      'pin-b',
      'new'
    ])
    const paginate = generatePaginateFunction(
      {
        params: ['...page'],
        segments: [
          [{ content: 'blog', dynamic: false, spread: false }],
          [{ content: '...page', dynamic: true, spread: true }]
        ]
      } as Parameters<typeof generatePaginateFunction>[0],
      '/',
      'never'
    )
    const pages = buildCollectionStaticPaths(
      catalog,
      'blog',
      paginate as Parameters<typeof buildCollectionStaticPaths>[2],
      { pagination: 1 }
    )
    const pageItems = pages.flatMap(({ props }) => props.page.data)
    expect(pages.map(({ props }) => props.page.currentPage)).toEqual([1, 2, 3])
    expect(pages[1].props.page.url.current).toBe('/blog/2')
    expect(pageItems.map(({ contentKey }) => contentKey)).toEqual([
      'blog:pin-a',
      'blog:pin-b',
      'blog:new'
    ])
    expect(pageItems.every(({ placement }) => placement.showPinned)).toBe(true)
  })

  test('Home and ordinary date ordering retain their existing chronology', () => {
    expect(getPageItems(buildHomePageData(catalog), 'recent-writing', 'blog')[0].contentKey).toBe(
      'blog:new'
    )
    expect(sortContentRecords(records, 'publish-date-desc')[0].id).toBe('new')
    expect(sortContentRecords(records, 'editorial-date-desc')[0].id).toBe('new')
    const pinned = records[1]
    expect(toTextCardViewData(createResolvedPageItem(pinned)).pinned).toBeUndefined()
    expect(toTextCardViewData(createResolvedPageItem(pinned, { showPinned: true })).pinned).toBe(
      true
    )
  })

  test('uses unchanged publication and identity while exposing an edit independently', async () => {
    const edited = { ...records[0], updatedAt: new Date('2026-10-21T00:00:00Z') }
    const render = async (record: BlogRecord) =>
      (
        await rss({
          title: 'Test',
          description: 'Test',
          site: 'https://example.com',
          xmlns: { atom: 'http://www.w3.org/2005/Atom' },
          items: [{ title: record.title, link: record.href, ...rssItemDates(record) }]
        })
      ).text()
    const before = await render(records[0])
    const after = await render(edited)
    const publication = `<pubDate>${records[0].publishedAt!.toUTCString()}</pubDate>`
    expect(before).toContain(publication)
    expect(after).toContain(publication)
    expect(after).toContain('<atom:updated>2026-10-21T00:00:00.000Z</atom:updated>')
    expect(before).not.toContain('<atom:updated>')
    expect(after).toContain('<link>https://example.com/blog/new/</link>')
    expect(
      rssItemDates({ ...edited, publishedAt: undefined, updatedAt: undefined }).pubDate
    ).toBeUndefined()
  })
})

test('font migration preserves the four authorized WOFF2 assets byte for byte', () => {
  const hashes = {
    'AbrilFatface-Regular.woff2':
      '2907f516786826bce91c5466c6a4ed8c10025a294bd62142c5734c217d67da17',
    'Paralines-Regular.woff2': '62cbd4c487a9696b45598278ff97f961d8ca872aa970aa960fc280541285e7b1',
    'Satoshi-Variable.woff2': 'c33586e0a52fcd0adac1c750687d21460a7bdd3d81faef0da435ecb57947a71b',
    'Satoshi-VariableItalic.woff2':
      'cbe9aa15d3e1aa73689d1ba376015bbE3e05e3b2b8f8ba6e8274da02730876ce'.toLowerCase()
  }
  for (const [filename, hash] of Object.entries(hashes)) {
    const bytes = readFileSync(new URL(`../src/assets/fonts/${filename}`, import.meta.url))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash)
  }
})

async function highlight(source: string, lang = 'ts') {
  return codeToHtml(source, {
    lang,
    theme: 'github-light',
    transformers: [
      transformerNotationDiff(),
      transformerNotationHighlight(),
      transformerRemoveNotationEscape(),
      updateStyle(),
      addCopyButton(2000),
      addCollapse(15)
    ]
  })
}

describe('Shiki annotations and long code', () => {
  for (const fixture of [
    { lang: 'ts', source: '// [!code highlight]\nconst x = 1', expected: 'const x = 1' },
    { lang: 'python', source: '# [!code highlight]\nprint("hello")', expected: 'print("hello")' },
    {
      lang: 'html',
      source: '<!-- [!code highlight] -->\n<div>Hello</div>',
      expected: '<div>Hello</div>'
    },
    {
      lang: 'tsx',
      source: '<div>\n{/* [!code highlight] */}\n<span>Hello</span>\n</div>',
      expected: '<span>Hello</span>'
    }
  ])
    test(`annotates the following ${fixture.lang} line`, async () => {
      const html = await highlight(fixture.source, fixture.lang)
      const pre = parse(html).querySelector('pre')!
      const content = parse(pre.innerHTML)
      expect(content.querySelector('.line.highlighted')?.textContent).toBe(fixture.expected)
      expect(content.textContent).not.toContain('{}')
      expect(content.textContent).not.toContain('[!code highlight]')
    })

  test('retains literal escaped annotations and supports added/removed lines', async () => {
    expect(await highlight('const x = 1 // [\\!code highlight]')).toContain('[!code highlight]')
    const html = await highlight('// [!code ++]\nconst a = 1\n// [!code --]\nconst b = 2')
    expect(html).toContain('line diff add')
    expect(html).toContain('line diff remove')
  })

  test('folds only above 15 lines and always embeds the full copy source', async () => {
    const short = Array.from({ length: 15 }, (_, index) => `const n${index} = ${index}`).join('\n')
    const long = short + '\nconst last = 15'
    expect(await highlight(short + '\n')).not.toContain('<code-block')
    const html = await highlight(long)
    const root = parse(html)
    expect(root.querySelector('code-block')).not.toBeNull()
    expect(root.querySelector('[data-code-collapse]')?.hasAttribute('hidden')).toBe(true)
    expect(root.querySelector('[data-copy-code]')?.getAttribute('data-code')).toBe(long)
    expect(root.querySelector('pre')?.textContent).toContain('last')
    expect(root.querySelector('code-block')?.classList.contains('collapsed')).toBe(false)
  })
})
