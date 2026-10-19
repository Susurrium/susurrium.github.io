import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { Resvg } from '@resvg/resvg-js'
import { parse as parseHtml } from 'node-html-parser'
import { detectType, render } from 'pele'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'

import {
  createDiagramMeasurer,
  diagramLicense,
  fontFamily,
  fontFingerprint,
  fontStyles
} from './fonts.mjs'
import { instanceSvg, lightColors, rasterSvg, readSvg } from './svg.mjs'

export { diagramLicense }
export function diagramLibraryLicense() {
  return readFileSync(resolve(dirname(require.resolve('pele/package.json')), 'LICENSE'))
}
const require = createRequire(import.meta.url)
export const assetPrefix = '/_diagrams/'
const revision = 3
const inFlight = new Map()
const stylesheet = unified().use(rehypeStringify, { allowDangerousHtml: true })
const resourceName = /^[a-f0-9]{64}(?:\.woff2|\.ttf|-diagram\.svg|-feed\.png)$/
const digest = (value) => createHash('sha256').update(value).digest('hex')
const renderOptions = {
  fontFamily,
  fontFamilyMono: fontFamily,
  idPrefix: 'diagram',
  autoDirection: false,
  images: true,
  links: false,
  limit: 50000,
  maxEdges: 500,
  outputLimit: 4000000
}

export function cacheDirectory(root = process.cwd()) {
  return resolve(root, 'artifacts/mermaid-cache')
}

function packageVersion(name) {
  let directory = dirname(require.resolve(name))
  while (true) {
    const path = resolve(directory, 'package.json')
    if (existsSync(path)) {
      const metadata = JSON.parse(readFileSync(path, 'utf8'))
      if (metadata.name === name) return metadata.version
    }
    const parent = dirname(directory)
    if (parent === directory) throw new Error(`找不到依赖 ${name} 的版本信息`)
    directory = parent
  }
}

async function atomicWrite(path, data) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomUUID()}.pending`
  await writeFile(temporary, data)
  await rename(temporary, path)
}

async function validAsset(asset, root) {
  if (!asset || !resourceName.test(asset.name)) throw new Error('Mermaid 缓存资源名称无效')
  try {
    return digest(await readDiagramAsset(asset.name, root)) === asset.hash
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function shared(id, run) {
  if (inFlight.has(id)) return inFlight.get(id)
  const task = run()
  inFlight.set(id, task)
  try {
    return await task
  } finally {
    inFlight.delete(id)
  }
}

export async function generateDiagram(source, { root = process.cwd(), feed = false } = {}) {
  source = source.trim()
  if (!source || source.length > 50000) throw new Error('Mermaid 源码必须为 1–50000 个字符')
  const now = detectType(source) === 'gantt' ? new Date().toISOString().slice(0, 10) : null
  const versions = [
    'pele',
    'fontkit',
    'color',
    'subset-font',
    '@resvg/resvg-js',
    '@fontsource/noto-sans-sc'
  ].map(packageVersion)
  const key = digest(
    JSON.stringify({
      revision,
      source,
      versions,
      renderOptions,
      lightColors,
      font: fontFingerprint(),
      now,
      platform: process.platform,
      architecture: process.arch
    })
  )
  const directory = cacheDirectory(root)
  const metadataPath = resolve(directory, `${key}.json`)
  const result = await shared(metadataPath, async () => {
    let metadata
    try {
      metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (
      metadata !== undefined &&
      (!metadata || metadata.key !== key || !metadata.svg || !Array.isArray(metadata.fonts))
    )
      throw new Error('Mermaid 缓存元数据无效')
    if (metadata?.key === key && metadata.svg && Array.isArray(metadata.fonts)) {
      const valid = await Promise.all(
        [metadata.svg, ...metadata.fonts].map((asset) => validAsset(asset, root))
      )
      if (valid.every(Boolean)) return { ...metadata, cached: true }
    }
    const fonts = createDiagramMeasurer()
    // 保留 image 节点供校验明确拒绝，避免静默丢失作者内容。
    const rendered = render(source, {
      measurer: fonts.measurer,
      ...renderOptions,
      now: now ? new Date(`${now}T00:00:00Z`) : undefined,
      icons: () => {
        throw new Error('Mermaid 不支持自定义图标')
      }
    })
    const { svg } = readSvg(rendered.svg)
    if (!(
      rendered.width > 0 &&
      rendered.height > 0 &&
      Number.isFinite(rendered.width + rendered.height)
    ))
      throw new Error('Mermaid 图片尺寸无效')
    const fontAssets = await fonts.assets()
    for (const asset of fontAssets) await atomicWrite(resolve(directory, asset.name), asset.buffer)
    const buffer = Buffer.from(rendered.svg)
    const asset = {
      name: `${key}-diagram.svg`,
      hash: digest(buffer),
      bytes: buffer.length,
      width: rendered.width,
      height: rendered.height,
      title: svg.querySelector('title')?.text ?? '',
      description: svg.querySelector('desc')?.text ?? ''
    }
    await atomicWrite(resolve(directory, asset.name), buffer)
    const generated = {
      key,
      svg: asset,
      fonts: fontAssets.map((asset) => {
        const item = { ...asset }
        delete item.buffer
        return item
      })
    }
    await atomicWrite(metadataPath, JSON.stringify(generated))
    return { ...generated, cached: false }
  })
  if (!feed) return result
  return shared(`${metadataPath}/feed`, async () => {
    if (result.feed && (await validAsset(result.feed, root))) return result
    const sourceSvg = (await readDiagramAsset(result.svg.name, root)).toString()
    const fontFiles = result.fonts
      .filter((font) => font.name.endsWith('.ttf'))
      .map((font) => resolve(directory, font.name))
    const family = result.fonts[0]?.family
    if (!family) throw new Error('Mermaid 图表缺少字体')
    const image = new Resvg(rasterSvg(sourceSvg, family), {
      background: '#ffffff',
      font: {
        fontFiles,
        loadSystemFonts: false,
        defaultFontFamily: family,
        sansSerifFamily: family,
        monospaceFamily: family
      },
      fitTo: { mode: 'zoom', value: 2 }
    })
    if (image.imagesToResolve().length) throw new Error('Mermaid 禁止请求外部资源')
    const png = image.render()
    const buffer = png.asPng()
    const asset = {
      name: `${key}-feed.png`,
      hash: digest(buffer),
      bytes: buffer.length,
      width: png.width,
      height: png.height
    }
    await atomicWrite(resolve(directory, asset.name), buffer)
    const generated = { ...result, feed: asset }
    delete generated.cached
    await atomicWrite(metadataPath, JSON.stringify(generated))
    return { ...generated, cached: result.cached, feedCached: false }
  })
}

function html(node) {
  return stylesheet.stringify({ type: 'root', children: [node] })
}
function element(tagName, properties = {}, children = []) {
  return { type: 'element', tagName, properties, children }
}
const text = (value) => ({ type: 'text', value })

/** @param {string} source @param {{root?: string, feed?: boolean, permalink?: URL, pageKey?: string}} [options] */
export async function renderMermaidHtml(
  source,
  { root = process.cwd(), feed = false, permalink, pageKey = '' } = {}
) {
  if (!source.includes('data-mermaid-source')) return source
  if (feed && !permalink) throw new Error('Mermaid RSS 缺少原文链接')
  const document = parseHtml(source, { blockTextElements: { script: true, style: true } })
  let index = 0
  for (const figure of document.querySelectorAll('figure[data-mermaid-source]')) {
    const code = figure.querySelector('pre code')
    if (!code) throw new Error('Mermaid 图表缺少源码')
    const definition = code.text
    let diagram
    try {
      diagram = await generateDiagram(definition, { root, feed })
    } catch (error) {
      const line = Number(figure.getAttribute('data-mermaid-line')) + Math.max(0, error.line ?? 0)
      throw new Error(
        `Mermaid ${figure.getAttribute('data-mermaid-file')}:${line}：${error.message}`,
        { cause: error }
      )
    }
    const title = diagram.svg.title || 'Mermaid 图表'
    const description = diagram.svg.description
    const caption = element('figcaption', {}, [
      text(title),
      ...(description ? [text(`：${description}`)] : [])
    ])
    if (feed) {
      const png = diagram.feed
      figure.replaceWith(
        html(
          element('figure', {}, [
            element('img', {
              src: assetPrefix + png.name,
              width: Math.ceil(diagram.svg.width),
              height: Math.ceil(diagram.svg.height),
              alt: description ? `${title}：${description}` : title,
              loading: 'lazy',
              decoding: 'async'
            }),
            caption,
            element('p', {}, [element('a', { href: String(permalink) }, [text('阅读原文')])])
          ])
        )
      )
    } else {
      const prefix = `diagram-${digest(`${pageKey}:${index++}:${diagram.key}`).slice(0, 20)}`
      const svg = instanceSvg((await readDiagramAsset(diagram.svg.name, root)).toString(), prefix)
      const sourceBlock = element(
        'details',
        { className: ['mermaid-source'], 'data-pagefind-ignore': 'all' },
        [
          element('summary', {}, [text('查看源码')]),
          element(
            'button',
            {
              type: 'button',
              'data-copy-code': '',
              'data-code': definition,
              'aria-label': '复制代码'
            },
            [text('复制源码')]
          ),
          element('pre', {}, [element('code', {}, [text(definition)])])
        ]
      )
      figure.replaceWith(
        html(
          element(
            'figure',
            { className: ['mermaid-diagram'], 'data-mermaid-diagram': diagram.key },
            [
              element('style', { 'data-pagefind-ignore': 'all' }, [
                text(fontStyles(diagram.fonts, assetPrefix))
              ]),
              element(
                'mermaid-viewport',
                {
                  className: ['mermaid-viewport'],
                  tabIndex: 0,
                  role: 'region',
                  'aria-label': `${title}，可缩放与滚动`,
                  'data-pagefind-ignore': 'all'
                },
                [{ type: 'raw', value: svg }]
              ),
              caption,
              sourceBlock
            ]
          )
        )
      )
    }
  }
  return document.toString()
}

export async function readDiagramAsset(name, root = process.cwd()) {
  if (!resourceName.test(name)) throw new Error(`Mermaid 资源名称无效：${name}`)
  return readFile(resolve(cacheDirectory(root), name))
}
