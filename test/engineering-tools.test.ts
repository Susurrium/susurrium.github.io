import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { describe, expect } from 'bun:test'
import sharp from 'sharp'
import { parse } from 'yaml'

import { applyCardCrops } from '../scripts/apply-card-crops.mjs'
import { applyHeroCrops } from '../scripts/apply-hero-crops.mjs'
import { downloadAvatar } from '../scripts/lib/avatar-download.mjs'
import {
  describeContentDocument,
  discoverPublishedContent
} from '../scripts/lib/browser-content.mjs'
import {
  cssResourceUrls,
  htmlDocument,
  htmlResourceUrls,
  normalizeResourceUrl,
  srcsetUrls
} from '../scripts/lib/resource-audit.mjs'
import { createContent } from '../scripts/new-content.mjs'
import { updateBlogDates } from '../scripts/updateBlogDates'
import { createTestDirectory, testWithFixtures as test } from './helpers/fixtures.mjs'

async function sandbox() {
  return createTestDirectory('tools')
}
async function put(root: string, path: string, value: string) {
  const target = resolve(root, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, value)
}
const transform = { x: 30, y: 70, zoom: 1.5 }
const hero = (x = 30) => ({ desktop: { ...transform, x }, mobile: transform, schemaVersion: 1 })
const card = (x = 30) => ({
  selection: 'both',
  fit: 'cover',
  transforms: { 'diagonal-left': { ...transform, x }, 'diagonal-right': transform },
  schemaVersion: 2
})
async function imageFixture(root: string, name: string) {
  const path = resolve(root, 'public/images/home-media', name)
  await mkdir(dirname(path), { recursive: true })
  await sharp({ create: { width: 16, height: 10, channels: 3, background: '#abcdef' } })
    .webp()
    .toFile(path)
}

describe('crop import transactions', () => {
  test('Hero rejects wrong profile, version and malformed legacy batch without changing output', async () => {
    const root = await sandbox()
    await imageFixture(root, 'one.webp')
    const result = await applyHeroCrops({ items: { 'one.webp': hero() } }, { projectRoot: root })
    const before = await readFile(result.outputPath, 'utf8')
    for (const input of [
      { profile: 'archive-card', schemaVersion: 2, items: { 'one.webp': card() } },
      { schemaVersion: 9, items: { 'one.webp': hero() } },
      { items: { 'one.webp': {} } },
      { items: { 'one.webp': hero(45), 'other.webp': { desktop: { x: null } } } }
    ])
      await expect(applyHeroCrops(input, { projectRoot: root })).rejects.toThrow()
    expect(await readFile(result.outputPath, 'utf8')).toBe(before)
    expect((await readdir(dirname(result.outputPath))).some((name) => name.endsWith('.tmp'))).toBe(
      false
    )
  })

  test('Hero preserves unconfirmed viewport and unrelated records; dry-run provides a diff', async () => {
    const root = await sandbox()
    await imageFixture(root, 'one.webp')
    await imageFixture(root, 'two.webp')
    const first = await applyHeroCrops(
      { items: { 'one.webp': hero(), 'two.webp': hero() } },
      { projectRoot: root }
    )
    const before = await readFile(first.outputPath, 'utf8')
    const input = {
      profile: 'home-hero',
      schemaVersion: 1,
      items: {
        'one.webp': {
          ...hero(80),
          mobile: { ...transform, x: 90 },
          confirmed: { desktop: true, mobile: false }
        }
      }
    }
    const plan = await applyHeroCrops(input, { projectRoot: root, dryRun: true })
    expect(plan.records['one.webp'].mobile).toEqual(transform)
    expect(plan.summary.changed).toEqual(['one.webp'])
    expect(plan.summary.unchanged).toEqual(['two.webp'])
    expect(await readFile(first.outputPath, 'utf8')).toBe(before)
    const applied = await applyHeroCrops(input, { projectRoot: root })
    expect(applied.records['one.webp'].desktop.x).toBe(80)
  })

  test('Card partial import merges, explicit replace reports removals, empty replacement is guarded', async () => {
    const root = await sandbox()
    await imageFixture(root, 'one.webp')
    await imageFixture(root, 'two.webp')
    await applyCardCrops(
      { items: { 'one.webp': card(), 'two.webp': card() } },
      { projectRoot: root }
    )
    const merged = await applyCardCrops({ items: { 'one.webp': card(80) } }, { projectRoot: root })
    expect(Object.keys(merged.records)).toEqual(['one.webp', 'two.webp'])
    expect(merged.summary.removed).toEqual([])
    const pending = await applyCardCrops(
      { items: { 'one.webp': { ...card(), selection: 'pending' } } },
      { projectRoot: root, dryRun: true }
    )
    expect(pending.summary.changed).toEqual([])
    expect(pending.skipped).toHaveLength(1)
    const before = await readFile(merged.outputPath, 'utf8')
    const planned = await applyCardCrops(
      { items: { 'one.webp': card(80) } },
      { projectRoot: root, replace: true, dryRun: true }
    )
    expect(planned.summary.removed).toEqual(['two.webp'])
    expect(await readFile(merged.outputPath, 'utf8')).toBe(before)
    await expect(
      applyCardCrops({ items: {} }, { projectRoot: root, replace: true })
    ).rejects.toThrow()
    const empty = await applyCardCrops(
      { items: {} },
      { projectRoot: root, replace: true, allowEmpty: true }
    )
    expect(empty.summary.removed).toEqual(['one.webp', 'two.webp'])
  })

  test('corrupt production bridge aborts rather than pretending it was empty', async () => {
    const root = await sandbox()
    await imageFixture(root, 'one.webp')
    await put(root, 'src/data/hero-crop-selections.generated.ts', 'malformed')
    await expect(
      applyHeroCrops({ items: { 'one.webp': hero() } }, { projectRoot: root })
    ).rejects.toThrow('现有裁剪配置')
    expect(
      await readFile(resolve(root, 'src/data/hero-crop-selections.generated.ts'), 'utf8')
    ).toBe('malformed')
  })
})

describe('content authoring and dates', () => {
  test('creates valid YAML with apostrophes, multiline text, Unicode and current language field', async () => {
    const root = await sandbox()
    const title = "Susurrium's 博客\n第二行"
    const result = await createContent({
      title,
      projectRoot: root,
      language: 'zh-CN',
      folder: true
    })
    const data = parse(result.content.split('---\n')[1])
    expect(data).toMatchObject({ title, description: title, language: 'zh-CN', draft: true })
    expect(data.lang).toBeUndefined()
    await expect(createContent({ title, projectRoot: root, folder: true })).rejects.toThrow()
  })

  test('generates all three collections and dry-run writes no directories', async () => {
    const root = await sandbox()
    const dry = await createContent({
      title: '短句',
      type: 'saying',
      author: '作者',
      projectRoot: root,
      dryRun: true
    })
    expect(parse(dry.content.split('---\n')[1])).toMatchObject({
      text: '短句',
      author: '作者',
      draft: true
    })
    expect(await readdir(root)).toEqual([])
    const trace = await createContent({ title: '记录', type: 'trace', projectRoot: root })
    expect(trace.path).toContain('traces')
    expect(parse(trace.content.split('---\n')[1]).publishDate).toBeDefined()
    for (const slug of ['../escape', 'tags', '42', 'C:escape', 'con'])
      await expect(createContent({ title: 'valid', slug, projectRoot: root })).rejects.toThrow()
  })

  test('rejects equivalent flat, MDX and directory-index routes before writing', async () => {
    for (const existing of ['entry.md', 'entry.mdx', 'entry/index.md', 'Entry/index.mdx']) {
      const root = await sandbox()
      await put(root, `src/content/blog/${existing}`, 'existing article')
      for (const folder of [false, true]) {
        for (const mdx of [false, true]) {
          await expect(
            createContent({ title: 'Entry', slug: 'entry', projectRoot: root, folder, mdx })
          ).rejects.toThrow('内容路由 entry 已存在')
        }
      }
      await expect(
        createContent({ title: 'Entry', slug: 'entry', projectRoot: root, dryRun: true })
      ).rejects.toThrow('内容路由 entry 已存在')
      expect(await readFile(resolve(root, `src/content/blog/${existing}`), 'utf8')).toBe(
        'existing article'
      )
    }
  })

  test('date updater discovers nested same-name files, preserves CRLF, and is idempotent', async () => {
    const root = await sandbox()
    const source = '---\r\ntitle: Test\r\npublishDate: 2026-09-01\r\n---\r\nBody\r\n'
    await put(root, 'src/content/blog/a/index.md', source)
    await put(root, 'src/content/blog/b/index.md', source)
    const first = await updateBlogDates({ projectRoot: root })
    expect(first.added).toEqual(['a/index.md', 'b/index.md'])
    const path = resolve(root, 'src/content/blog/a/index.md')
    await writeFile(path, source.replace('Body', 'Changed body'))
    const before = await readFile(path, 'utf8')
    const plan = await updateBlogDates({
      projectRoot: root,
      dryRun: true,
      now: new Date('2026-09-08T12:00:00Z')
    })
    expect(plan.changed).toEqual(['a/index.md'])
    expect(await readFile(path, 'utf8')).toBe(before)
    await updateBlogDates({ projectRoot: root, now: new Date('2026-09-08T12:00:00Z') })
    expect(await readFile(path, 'utf8')).toContain('updatedDate: 2026-09-08T12:00:00.000Z\r\n')
    expect((await updateBlogDates({ projectRoot: root })).changed).toEqual([])
    const metadata = JSON.parse(await readFile(resolve(root, 'scripts/blog-metadata.json'), 'utf8'))
    expect(metadata['a/index.md'].filePath).toBe('a/index.md')
    expect(metadata['b/index.md'].filePath).toBe('b/index.md')
  })

  test('date parser failure aborts the entire plan and preserves database', async () => {
    const root = await sandbox()
    await put(root, 'src/content/blog/a.md', '---\npublishDate: 2026-09-01\n---\nBody')
    await updateBlogDates({ projectRoot: root })
    const database = resolve(root, 'scripts/blog-metadata.json')
    const before = await readFile(database, 'utf8')
    await put(root, 'src/content/blog/b.md', '---\npublishDate: [broken\n---\nBody')
    await expect(updateBlogDates({ projectRoot: root })).rejects.toThrow('未写入任何文件')
    expect(await readFile(database, 'utf8')).toBe(before)
  })
})

describe('rendered resource parsing', () => {
  test('finds quoted URLs, escaped CSS, imports and custom properties, excluding comments', () => {
    const css =
      '@import "//outside.test/a.css"; a{background:url("https://outside.test/x.png");--photo:url(https://outside.test/y.png)}/* url(https://ignored.test/a) */'
    expect(cssResourceUrls(css)).toEqual([
      '//outside.test/a.css',
      'https://outside.test/x.png',
      'https://outside.test/y.png'
    ])
    expect(cssResourceUrls('background: url(\\68 ttps://outside.test/a)', true)).toEqual([
      'https://outside.test/a'
    ])
  })

  test('HTML resources include unquoted attributes, entities, srcset and inline CSS', () => {
    const resources = htmlResourceUrls(
      htmlDocument(
        '<img src=//outside.test/a alt="" srcset="/a.png 1x, //outside.test/b 2x"><div style="background:url(&quot;https://outside.test/c?q=1&amp;b=2&quot;)"></div><script>const fake = "<img src=//ignored.test/a>"</script>'
      )
    )
    expect(resources.map(({ url }) => url)).toEqual([
      '//outside.test/a',
      '/a.png',
      '//outside.test/b',
      'https://outside.test/c?q=1&b=2'
    ])
    expect(normalizeResourceUrl(resources[0].url, 'https://susurrium.github.io/home').origin).toBe(
      'https://outside.test'
    )
  })

  test('srcset keeps data payloads and normalized URLs reject active protocols', () => {
    expect(srcsetUrls('data:image/png;base64,AAAA 1x, /two.png 2x')).toEqual([
      'data:image/png;base64,AAAA',
      '/two.png'
    ])
    expect(
      normalizeResourceUrl('../图.png', 'https://susurrium.github.io/blog/post/').pathname
    ).toBe('/blog/%E5%9B%BE.png')
    expect(() =>
      normalizeResourceUrl('javascript:alert(1)', 'https://susurrium.github.io')
    ).toThrow()
    expect(() =>
      normalizeResourceUrl('https://user:password@example.com/a', 'https://susurrium.github.io')
    ).toThrow()
  })
})

describe('browser content discovery', () => {
  const plain =
    '<article data-pagefind-body><h1>一条新引句</h1><div id="content">正文</div></article>'
  const withToc =
    '<article data-pagefind-body><h1>New article</h1></article><button id="sidebar-btn"></button><aside id="sidebar"></aside>'

  test('distinguishes genuine reading pages with and without TOC; excludes taxonomy/pagination', () => {
    expect(describeContentDocument('/sayings/replaced-quote', plain)).toMatchObject({
      hasToc: false,
      indexed: true,
      kind: 'saying'
    })
    expect(describeContentDocument('/blog/nested/new-post', withToc)).toMatchObject({
      hasToc: true,
      query: 'New',
      kind: 'blog'
    })
    expect(describeContentDocument('/blog/tags/astro', plain)).toBeNull()
    expect(describeContentDocument('/blog/2', plain)).toBeNull()
  })

  test('empty sitemap produces an explicit empty catalog and HTTP failure is not mistaken for empty', async () => {
    expect(
      await discoverPublishedContent(
        'https://example.test',
        async () => new Response('<urlset></urlset>')
      )
    ).toEqual([])
    await expect(
      discoverPublishedContent(
        'https://example.test',
        async () => new Response('', { status: 500 })
      )
    ).rejects.toThrow('sitemap')
  })

  test('search sample follows the published content rather than any hardcoded quote', async () => {
    const catalog = await discoverPublishedContent(
      'https://example.test',
      async (url) =>
        new Response(
          String(url).endsWith('.xml')
            ? '<urlset><url><loc>https://production.test/blog/new-post</loc></url></urlset>'
            : withToc
        )
    )
    expect(catalog).toHaveLength(1)
    expect(catalog[0]).toMatchObject({ path: '/blog/new-post', query: 'New', hasToc: true })
  })
})

describe('bounded avatar downloads', () => {
  test('returns a small streamed image body', async () => {
    const result = await downloadAvatar('https://example.test/a', {
      fetchImpl: async () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
    })
    expect([...result.buffer]).toEqual([1, 2, 3])
    expect(result.contentType).toBe('image/png')
  })

  test('rejects declared and streamed oversize bodies', async () => {
    for (const headers of [{ 'content-length': '100' }, {}])
      await expect(
        downloadAvatar('https://example.test/a', {
          maxBytes: 2,
          fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { headers })
        })
      ).rejects.toThrow('byte limit')
  })

  test('deadline still applies after headers when the body stalls', async () => {
    let cancelled = false
    await expect(
      downloadAvatar('https://example.test/a', {
        timeoutMs: 20,
        fetchImpl: async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array([1]))
              },
              cancel() {
                cancelled = true
              }
            })
          )
      })
    ).rejects.toThrow('timed out')
    expect(cancelled).toBe(true)
  })
})
