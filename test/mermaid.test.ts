import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import { expect, test } from 'bun:test'
import { parse } from 'node-html-parser'
import sharp from 'sharp'

import { publishDiagramAssets } from '../src/integrations/mermaid'
import {
  cacheDirectory,
  generateDiagram,
  readDiagramAsset,
  renderMermaidHtml
} from '../src/lib/mermaid/server.mjs'
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
  'Mermaid 编译、真实渲染、缓存恢复、RSS 和公开资源收集',
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
    const warmStart = performance.now()
    const cached = await generateDiagram(graph, { root })
    const warmMs = performance.now() - warmStart
    expect(cached.key).toBe(first.key)
    expect(cached.cached).toBe(true)
    const svg = (await readDiagramAsset(first.assets.light.name, root)).toString()
    expect(svg).toContain('@font-face')
    expect(svg).toContain('data:font/woff2;base64,')
    expect(svg).toContain('写作')
    expect(svg).not.toContain('<foreignObject')
    expect(
      (await sharp(await readDiagramAsset(first.assets.feed.name, root)).metadata()).format
    ).toBe('png')
    const page = await renderMermaidHtml(compiled, { root })
    const dom = parse(page)
    expect(dom.querySelectorAll('[data-mermaid-diagram]').length).toBe(1)
    expect(dom.querySelectorAll('figure img').length).toBe(2)
    expect(dom.querySelector('button[data-copy-code]')!.getAttribute('data-code')).toBe(
      graph + '\n'
    )
    expect(dom.querySelector('details')!.getAttribute('data-pagefind-ignore')).toBe('all')
    expect(page).not.toContain('data-mermaid-file')
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
    expect(await publishDiagramAssets(output, root)).toBe(3)
    expect(await readFile(resolve(output, '_diagrams', first.assets.light.name))).toEqual(
      await readDiagramAsset(first.assets.light.name, root)
    )
    await writeFile(resolve(cacheDirectory(root), first.assets.dark.name), 'broken cache')
    expect((await generateDiagram(graph, { root })).cached).toBe(false)
    console.log(
      JSON.stringify({
        mermaid: {
          coldMs: Math.round(coldMs),
          warmMs: Math.round(warmMs),
          bytes: Object.fromEntries(
            Object.entries(first.assets).map(([name, asset]) => [name, asset.bytes])
          )
        }
      })
    )
  },
  120000
)

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

test('常用 Mermaid 类型均由真实 Chromium 渲染', async () => {
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
    const result = await generateDiagram(definition)
    expect(result.assets.light.width).toBeGreaterThan(0)
    expect(result.assets.dark.height).toBeGreaterThan(0)
  }
}, 120000)

test('语法错误携带源文件位置；阻止远程资源请求', async () => {
  await expect(
    renderMermaidHtml(await compile('```mermaid\nflowchart TD\nA[未闭合\n```'))
  ).rejects.toThrow('mermaid-article.md:1')
  await expect(
    generateDiagram(
      'flowchart TD\nA@{ img: "https://example.invalid/private.png", label: "remote", h: 60 }'
    )
  ).rejects.toThrow('禁止请求外部资源')
}, 60000)
