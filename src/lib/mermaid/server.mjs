import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { generate, parse as parseCss, walk } from 'css-tree'
import { parse as parseHtml } from 'node-html-parser'
import rehypeStringify from 'rehype-stringify'
import subsetFont from 'subset-font'
import { unified } from 'unified'

const require = createRequire(import.meta.url)
export const assetPrefix = '/_diagrams/'
const revision = 1
const inFlight = new Map()
const fontCache = new Map()
const printable = Array.from({ length: 95 }, (_, index) => String.fromCodePoint(index + 32)).join(
  ''
)
const fontPath = require.resolve('@fontsource/noto-sans-sc/400.css')
const licensePath = resolve(dirname(fontPath), 'LICENSE')
const stylesheet = unified().use(rehypeStringify)

export function cacheDirectory(root = process.cwd()) {
  return resolve(root, 'artifacts/mermaid-cache')
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
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

function containsCodePoint(range, codePoint) {
  const value = range.slice(2)
  const [first, last = first] = value.split('-')
  const lower = parseInt(first.replaceAll('?', '0'), 16)
  const upper = parseInt(last.replaceAll('?', 'f'), 16)
  return codePoint >= lower && codePoint <= upper
}

async function diagramFont(source) {
  const text = printable + source
  const points = [...new Set([...text].map((character) => character.codePointAt(0)))]
  const ast = parseCss(await readFile(fontPath, 'utf8'))
  const faces = []
  walk(ast, {
    visit: 'Atrule',
    enter(node) {
      if (node.name !== 'font-face') return
      let path
      let ranges = []
      let rangeCss
      walk(node, (child) => {
        if (child.type !== 'Declaration') return
        if (child.property === 'src')
          walk(child.value, (entry) => {
            if (entry.type === 'Url' && entry.value.endsWith('.woff2')) path = entry.value
          })
        if (child.property === 'unicode-range') {
          rangeCss = generate(child.value)
          walk(child.value, (entry) => {
            if (entry.type === 'UnicodeRange') ranges.push(entry.value)
          })
        }
      })
      if (path && points.some((point) => ranges.some((range) => containsCodePoint(range, point))))
        faces.push({ path, rangeCss, ranges })
    }
  })
  // 对缺字尽早报错，避免由不同操作系统的备用字体改变图表布局。
  for (const character of text) {
    const point = character.codePointAt(0)
    if (/\s/u.test(character) || point < 32) continue
    if (!faces.some((face) => face.ranges.some((range) => containsCodePoint(range, point))))
      throw new Error(`Mermaid 字体不包含字符 ${character} (U+${point.toString(16).toUpperCase()})`)
  }
  const css = []
  for (const face of faces) {
    const buffer = await subsetFont(await readFile(resolve(dirname(fontPath), face.path)), text, {
      targetFormat: 'woff2'
    })
    css.push(
      `@font-face{font-family:"Diagram Noto";font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff2;base64,${buffer.toString('base64')}) format("woff2");unicode-range:${face.rangeCss}}`
    )
  }
  return css.join('')
}

async function atomicWrite(path, data) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomUUID()}.pending`
  await writeFile(temporary, data)
  await rename(temporary, path)
}

function mermaidConfig(dark, key) {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    htmlLabels: false,
    maxTextSize: 50000,
    maxEdges: 500,
    deterministicIds: true,
    deterministicIDSeed: key,
    fontFamily: 'Diagram Noto',
    theme: 'base',
    secure: [
      'secure',
      'securityLevel',
      'startOnLoad',
      'suppressErrorRendering',
      'maxTextSize',
      'maxEdges',
      'theme',
      'themeVariables',
      'themeCSS',
      'fontFamily',
      'htmlLabels',
      'dompurifyConfig'
    ],
    themeVariables: {
      darkMode: dark,
      background: dark ? '#101016' : '#ffffff',
      primaryColor: dark ? '#202f3b' : '#edf4f8',
      primaryTextColor: dark ? '#f5f5f5' : '#202127',
      primaryBorderColor: dark ? '#a6d4e3' : '#52798e',
      lineColor: dark ? '#d2d7df' : '#505966',
      secondaryColor: dark ? '#303044' : '#f3eef9',
      tertiaryColor: dark ? '#25372d' : '#eef6ed',
      fontFamily: 'Diagram Noto',
      fontSize: '16px'
    }
  }
}

async function renderAssets(source, key, css, directory) {
  const temporary = resolve('artifacts/runtime-tmp')
  await mkdir(temporary, { recursive: true })
  Object.assign(process.env, { TMPDIR: temporary, TMP: temporary, TEMP: temporary })
  process.env.PLAYWRIGHT_BROWSERS_PATH =
    process.env.MERMAID_BROWSER_PATH ?? resolve('artifacts/mermaid-browsers')
  const [{ default: rehypeMermaid }, { chromium }] = await Promise.all([
    import('rehype-mermaid'),
    import('playwright')
  ])
  const blocked = new Set()
  const localResources = [
    'mermaid-isomorphic',
    'mermaid',
    'katex/dist/katex.css',
    '@fortawesome/fontawesome-free/css/all.css'
  ].map((name) => pathToFileURL(resolve(dirname(require.resolve(name)), '..')).href + '/')
  const browserType = {
    async launch(options) {
      const browser = await chromium.launch(options)
      const newContext = browser.newContext.bind(browser)
      browser.newContext = async (...args) => {
        const context = await newContext(...args)
        await context.route('**/*', (route) => {
          const url = route.request().url()
          if (url.startsWith('data:') || localResources.some((prefix) => url.startsWith(prefix)))
            return route.continue()
          blocked.add(url)
          return route.abort('blockedbyclient')
        })
        return context
      }
      return browser
    }
  }
  const render = async (variant) => {
    /** @type {import('hast').Root} */
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: { className: ['mermaid'] },
          children: [{ type: 'text', value: source }]
        }
      ]
    }
    await unified()
      .use(rehypeMermaid, {
        strategy: variant === 'feed' ? 'img-png' : 'img-svg',
        browserType,
        css: `data:text/css;base64,${Buffer.from(css).toString('base64')}`,
        prefix: `diagram-${key}-${variant}`,
        mermaidConfig: mermaidConfig(variant === 'dark', key)
      })
      .run(tree)
    const img = tree.children[0]
    if (img.tagName !== 'img' || !img.properties.src) throw new Error('Mermaid 没有生成图片')
    const response = await globalThis.fetch(img.properties.src)
    let buffer = Buffer.from(await response.arrayBuffer())
    if (variant !== 'feed') {
      const svg = parseHtml(buffer.toString())
      const element = svg.querySelector('svg')
      if (!element) throw new Error('Mermaid 没有生成 SVG 根节点')
      element.insertAdjacentHTML('afterbegin', `<style>${css}</style>`)
      buffer = Buffer.from(svg.toString())
    }
    const name = `${key}-${variant}.${variant === 'feed' ? 'png' : 'svg'}`
    await atomicWrite(resolve(directory, name), buffer)
    return {
      name,
      bytes: buffer.length,
      hash: digest(buffer),
      width: Number(img.properties.width),
      height: Number(img.properties.height),
      title: String(img.properties.title ?? ''),
      description: String(img.properties.alt ?? '')
    }
  }
  const results = await Promise.allSettled(['light', 'dark', 'feed'].map(render))
  if (blocked.size) throw new Error(`Mermaid 禁止请求外部资源：${[...blocked].join(', ')}`)
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
  const assets = Object.fromEntries(
    results.map((result, index) => [['light', 'dark', 'feed'][index], result.value])
  )
  for (const asset of Object.values(assets))
    if (!(asset.width > 0 && asset.height > 0 && Number.isFinite(asset.width + asset.height)))
      throw new Error('Mermaid 图片尺寸无效')
  return { key, assets }
}

export async function generateDiagram(source, { root = process.cwd() } = {}) {
  source = source.trim()
  if (!source.trim() || source.length > 50000) throw new Error('Mermaid 源码必须为 1–50000 个字符')
  const versions = [
    'rehype-mermaid',
    'mermaid-isomorphic',
    'mermaid',
    'playwright',
    'subset-font',
    '@fontsource/noto-sans-sc'
  ].map(packageVersion)
  if (!fontCache.has(source)) {
    const pending = diagramFont(source)
    fontCache.set(source, pending)
    pending.catch(() => fontCache.delete(source))
    if (fontCache.size > 128) fontCache.delete(fontCache.keys().next().value)
  }
  const css = await fontCache.get(source)
  const key = digest(
    JSON.stringify({
      revision,
      source,
      versions,
      platform: process.platform,
      architecture: process.arch,
      css,
      config: mermaidConfig(false, '')
    })
  )
  const directory = cacheDirectory(root)
  const id = `${directory}/${key}`
  if (inFlight.has(id)) return inFlight.get(id)
  const task = (async () => {
    const metadataPath = resolve(directory, `${key}.json`)
    let metadata
    try {
      metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (metadata) {
      let valid =
        metadata.key === key &&
        ['light', 'dark', 'feed'].every((variant) => metadata.assets?.[variant])
      for (const asset of Object.values(metadata.assets ?? {})) {
        if (!/^[a-f0-9]{64}-(light\.svg|dark\.svg|feed\.png)$/.test(asset.name))
          throw new Error('Mermaid 缓存资源名称无效')
        try {
          if (digest(await readFile(resolve(directory, asset.name))) !== asset.hash) valid = false
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
          valid = false
        }
      }
      if (valid) return { ...metadata, cached: true }
    }
    const result = await renderAssets(source, key, css, directory)
    await atomicWrite(metadataPath, JSON.stringify(result))
    return { ...result, cached: false }
  })()
  inFlight.set(id, task)
  try {
    return await task
  } finally {
    inFlight.delete(id)
  }
}

function html(node) {
  return stylesheet.stringify({ type: 'root', children: [node] })
}

function element(tagName, properties = {}, children = []) {
  return { type: 'element', tagName, properties, children }
}
const text = (value) => ({ type: 'text', value })

/** @param {string} source @param {{root?: string, feed?: boolean, permalink?: URL}} [options] */
export async function renderMermaidHtml(
  source,
  { root = process.cwd(), feed = false, permalink } = {}
) {
  if (!source.includes('data-mermaid-source')) return source
  const document = parseHtml(source, { blockTextElements: { script: true, style: true } })
  for (const figure of document.querySelectorAll('figure[data-mermaid-source]')) {
    const code = figure.querySelector('pre code')
    if (!code) throw new Error('Mermaid 图表缺少源码')
    const definition = code.text
    let diagram
    try {
      diagram = await generateDiagram(definition, { root })
    } catch (error) {
      throw new Error(
        `Mermaid ${figure.getAttribute('data-mermaid-file')}:${figure.getAttribute('data-mermaid-line')}：${error.message}`,
        { cause: error }
      )
    }
    const { light, dark, feed: png } = diagram.assets
    const title = light.title || 'Mermaid 图表'
    const description = light.description
    const image = (asset, className) =>
      element('img', {
        src: assetPrefix + asset.name,
        width: Math.ceil(asset.width),
        height: Math.ceil(asset.height),
        style: `width:${Math.ceil(asset.width)}px`,
        alt: description ? `${title}：${description}` : title,
        className,
        loading: 'lazy',
        decoding: 'async'
      })
    const caption = element('figcaption', {}, [
      text(title),
      ...(description ? [text(`：${description}`)] : [])
    ])
    if (feed) {
      figure.replaceWith(
        html(
          element('figure', {}, [
            image(png),
            caption,
            element('p', {}, [element('a', { href: String(permalink) }, [text('阅读原文')])])
          ])
        )
      )
    } else {
      figure.replaceWith(
        html(
          element(
            'figure',
            { className: ['mermaid-diagram'], 'data-mermaid-diagram': diagram.key },
            [
              element(
                'div',
                {
                  className: ['mermaid-viewport'],
                  tabIndex: 0,
                  role: 'region',
                  'aria-label': `${title}，可横向滚动`
                },
                [image(light, ['mermaid-light']), image(dark, ['mermaid-dark'])]
              ),
              caption,
              element('details', { className: ['mermaid-source'], 'data-pagefind-ignore': 'all' }, [
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
              ])
            ]
          )
        )
      )
    }
  }
  return document.toString()
}

export async function readDiagramAsset(name, root = process.cwd()) {
  if (!/^[a-f0-9]{64}-(light\.svg|dark\.svg|feed\.png)$/.test(name))
    throw new Error(`Mermaid 资源名称无效：${name}`)
  return readFile(resolve(cacheDirectory(root), name))
}

export async function diagramLicense() {
  return readFile(licensePath)
}
