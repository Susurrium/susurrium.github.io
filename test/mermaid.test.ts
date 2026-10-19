import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import { expect, test } from 'bun:test'
import { parse } from 'node-html-parser'
import sharp from 'sharp'

import { publishDiagramAssets } from '../src/integrations/mermaid'
import { createDiagramMeasurer } from '../src/lib/mermaid/fonts.mjs'
import {
  cacheDirectory,
  generateDiagram,
  readDiagramAsset,
  renderMermaidHtml
} from '../src/lib/mermaid/server.mjs'
import { instanceSvg, rasterSvg, readSvg } from '../src/lib/mermaid/svg.mjs'
import { prepareFeedContent } from '../src/lib/rss-content'
import rehypeMermaidSource from '../src/plugins/rehype-mermaid-source'
import { createTestDirectory, testWithFixtures } from './helpers/fixtures.mjs'

const graph =
  'flowchart TD\naccTitle: 中文发布流程\naccDescr: 写作、检查并发布文章\nA[写作] --> B[检查] --> C[发布]'
async function compile(source: string) {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: { type: 'shiki', excludeLangs: ['mermaid'] },
    rehypePlugins: [rehypeMermaidSource]
  })
  return (await processor.render(source, { fileURL: pathToFileURL(resolve('mermaid-article.md')) }))
    .code
}

testWithFixtures(
  'Pele 真实字体、按需 PNG、缓存恢复与公开资源收集',
  async () => {
    const root = createTestDirectory('mermaid')
    const compiled = await compile(
      '普通段落\n\n```mermaid\n' + graph + '\n```\n\n```js\nconst count = 1\n```'
    )
    expect(compiled).toContain('data-mermaid-source')
    expect(compiled).toContain('astro-code')
    const started = performance.now()
    const first = await generateDiagram(graph, { root })
    const coldMs = performance.now() - started
    expect(first.cached).toBe(false)
    expect(first.feed).toBeUndefined()
    expect((await readdir(cacheDirectory(root))).some((name) => name.endsWith('.png'))).toBe(false)
    const warmStart = performance.now()
    const cached = await generateDiagram(graph, { root })
    const warmMs = performance.now() - warmStart
    expect(cached.cached).toBe(true)
    expect(cached.key).toBe(first.key)
    expect((await readDiagramAsset(first.svg.name, root)).toString()).toContain('写作')
    expect(first.fonts.some((font) => font.name.endsWith('.woff2'))).toBe(true)
    const page = await renderMermaidHtml(compiled, { root })
    const dom = parse(page)
    expect(dom.querySelectorAll('.mermaid-viewport > svg').length).toBe(1)
    expect(dom.querySelectorAll('figure img').length).toBe(0)
    expect(dom.querySelector('button[data-copy-code]')!.getAttribute('data-code')).toBe(
      graph + '\n'
    )
    expect(dom.querySelector('details')!.getAttribute('data-pagefind-ignore')).toBe('all')
    expect(dom.querySelector('svg')!.getAttribute('data-pagefind-ignore')).toBe('all')
    expect(page).toContain('@font-face')
    expect(page).not.toContain('data-mermaid-file')
    const feed = await generateDiagram(graph, { root, feed: true })
    const png = await readDiagramAsset(feed.feed!.name, root)
    expect((await sharp(png).metadata()).format).toBe('png')
    const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let surfaces = 0
    for (let index = 0; index < data.length; index += 3)
      if (data[index] === 237 && data[index + 1] === 244 && data[index + 2] === 248) surfaces++
    expect(surfaces).toBeGreaterThan(100)
    const feedHtml = await renderMermaidHtml(compiled, {
      root,
      feed: true,
      permalink: new URL('https://susurrium.github.io/blog/diagram')
    })
    expect(feedHtml).toContain('-feed.png')
    expect(feedHtml).not.toContain('<details')
    const output = resolve(root, 'dist')
    await mkdir(output)
    await writeFile(resolve(output, 'index.html'), page)
    await writeFile(
      resolve(output, 'rss.xml'),
      `<rss><channel><item><content:encoded><![CDATA[${feedHtml}]]></content:encoded></item></channel></rss>`
    )
    expect(await publishDiagramAssets(output, root)).toBe(
      first.fonts.filter((font) => font.name.endsWith('.woff2')).length + 1
    )
    expect(
      (await readdir(resolve(output, '_diagrams'))).some(
        (name) => name.endsWith('.ttf') || name.endsWith('.svg')
      )
    ).toBe(false)
    await writeFile(resolve(cacheDirectory(root), first.svg.name), 'broken cache')
    expect((await generateDiagram(graph, { root })).cached).toBe(false)
    console.log(
      JSON.stringify({
        mermaid: {
          coldMs: Math.round(coldMs),
          warmMs: Math.round(warmMs),
          svgBytes: first.svg.bytes,
          pngBytes: png.length
        }
      })
    )
  },
  60000
)

test('相同图表的实例 ID 独立，页面路径参与 ID，引用保持有效', async () => {
  const source = await compile('```mermaid\n' + graph + '\n```\n\n```mermaid\n' + graph + '\n```')
  const page = parse(await renderMermaidHtml(source, { pageKey: '/blog/one' }))
  const ids = page.querySelectorAll('[id]').map((node) => node.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const svg of page.querySelectorAll('svg'))
    expect(svg.querySelector(`[id="${svg.getAttribute('aria-labelledby')}"]`)).not.toBeNull()
  const other = await renderMermaidHtml(source, { pageKey: '/blog/two' })
  expect(other).not.toContain(`id="${ids[0]}"`)
})

test('RSS 保留同源 PNG、说明与原文链接，清除交互和源码', async () => {
  const result = await prepareFeedContent(await compile('```mermaid\n' + graph + '\n```'), {
    permalink: new URL('https://susurrium.github.io/blog/diagram')
  })
  expect(result).toContain('src="https://susurrium.github.io/_diagrams/')
  expect(result).toContain('-feed.png')
  expect(result).toContain('中文发布流程')
  expect(result).toContain('阅读原文')
  expect(result).not.toContain('<button')
  expect(result).not.toContain('flowchart TD')
}, 30000)

test('常用类型由 Pele 和固定字体测量生成 SVG 与真实 PNG', async () => {
  const definitions = [
    'sequenceDiagram\nparticipant A as 作者\nparticipant B as 网站\nA->>B: 发布',
    'classDiagram\nclass Article {\n +String title\n}\nArticle --> Author',
    'stateDiagram-v2\n[*] --> Draft\nDraft --> Published',
    'erDiagram\nAUTHOR ||--o{ ARTICLE : writes',
    'gantt\ntitle 发布计划\ndateFormat YYYY-MM-DD\nsection 写作\n文章 :2026-10-18, 2d',
    'pie title 内容\n"文章" : 3\n"随记" : 2',
    'mindmap\n root((博客))\n  文章\n  随记'
  ]
  for (const definition of definitions) {
    const result = await generateDiagram(definition, { feed: true })
    expect(result.svg.width).toBeGreaterThan(0)
    expect(result.feed!.height).toBeGreaterThan(0)
    expect(
      (await sharp(await readDiagramAsset(result.feed!.name)).metadata()).width
    ).toBeGreaterThan(0)
  }
}, 120000)

test('字体实际测量支持混合文本、粗体与 kerning，缺字明确失败', () => {
  const { measurer } = createDiagramMeasurer()
  expect(measurer.width('中文 Latin', 16, 0)).toBeGreaterThan(70)
  expect(measurer.width('中文 Latin', 16, 1)).toBeGreaterThan(70)
  expect(measurer.width('AV', 16, 0)).toBeLessThanOrEqual(
    measurer.width('A', 16, 0) + measurer.width('V', 16, 0)
  )
  expect(() => measurer.width('\u{10ffff}', 16, 0)).toThrow('字体不包含字符')
})

test('错误定位、资源拦截、源码与连线限制及缓存元数据错误', async () => {
  await expect(
    renderMermaidHtml(await compile('```mermaid\nflowchart TD\nA[未闭合\n```'))
  ).rejects.toThrow('mermaid-article.md:4')
  await expect(
    renderMermaidHtml(await compile('```mermaid\n\n\nflowchart TD\nA[未闭合\n```'))
  ).rejects.toThrow('mermaid-article.md:6')
  await expect(
    generateDiagram(
      'flowchart TD\nA@{ img: "https://example.invalid/private.png", label: "remote", h: 60 }'
    )
  ).rejects.toThrow('禁止请求外部资源')
  await expect(generateDiagram('x'.repeat(50001))).rejects.toThrow('50000')
  await expect(
    generateDiagram(
      'flowchart LR\n' + Array.from({ length: 502 }, (_, index) => `N${index}`).join('-->')
    )
  ).rejects.toThrow()
  expect(() => readSvg('<svg><script>alert(1)</script></svg>')).toThrow('不允许元素')
  expect(() => readSvg('<svg onload="alert(1)"></svg>')).toThrow('不允许属性')
  expect(() => readSvg('<svg><path fill="url(https://example.invalid/a)"/></svg>')).toThrow(
    '外部资源'
  )
  const outlined = rasterSvg(
    '<svg style="--_fg:var(--pele-fg,#000)"><text fill="var(--_fg)">A</text></svg>',
    'Noto Sans SC'
  )
  expect(outlined).toContain('fill="#202127"')
  const mixed = rasterSvg(
    '<svg><text stroke="color-mix(in srgb,#ff0000 75%,#0000ff)">A</text></svg>',
    'Noto Sans SC'
  )
  expect(mixed).toContain('rgb(191,0,64)')
  expect(mixed).not.toContain('color-mix')
  expect(
    instanceSvg('<svg><defs><clipPath id="a"/></defs><g clip-path="url(#a)"/></svg>', 'one')
  ).toContain('url(#one-a)')
}, 30000)

testWithFixtures(
  '损坏的缓存元数据明确失败，字体资源缺失重新生成',
  async () => {
    const root = createTestDirectory('mermaid-cache')
    const result = await generateDiagram(graph, { root })
    await writeFile(resolve(cacheDirectory(root), result.fonts[0].name), 'broken font')
    expect((await generateDiagram(graph, { root })).cached).toBe(false)
    await writeFile(resolve(cacheDirectory(root), `${result.key}.json`), '{broken')
    await expect(generateDiagram(graph, { root })).rejects.toThrow()
    expect(await readFile(resolve(cacheDirectory(root), `${result.key}.json`), 'utf8')).toBe(
      '{broken'
    )
    await writeFile(resolve(cacheDirectory(root), `${result.key}.json`), '{}')
    await expect(generateDiagram(graph, { root })).rejects.toThrow('缓存元数据无效')
    await writeFile(resolve(cacheDirectory(root), `${result.key}.json`), 'null')
    await expect(generateDiagram(graph, { root })).rejects.toThrow('缓存元数据无效')
  },
  30000
)
