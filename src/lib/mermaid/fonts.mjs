import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { parse, walk } from 'css-tree'
import { create } from 'fontkit'
import subsetFont from 'subset-font'

const require = createRequire(import.meta.url)
const directory = dirname(require.resolve('@fontsource/noto-sans-sc/400.css'))
export const fontFamily = 'Diagram Noto'
const loaded = new Map()
let index

function includes(range, point) {
  const [first, last = first] = range.slice(2).split('-')
  return (
    point >= parseInt(first.replaceAll('?', '0'), 16) &&
    point <= parseInt(last.replaceAll('?', 'f'), 16)
  )
}

function fontIndex() {
  if (index) return index
  const faces = []
  const fingerprint = createHash('sha256')
  for (const weight of [400, 700]) {
    const css = readFileSync(resolve(directory, `${weight}.css`), 'utf8')
    fingerprint.update(css)
    walk(parse(css), {
      visit: 'Atrule',
      enter(node) {
        if (node.name !== 'font-face') return
        let path
        const ranges = []
        walk(node, (entry) => {
          if (entry.type === 'Url' && entry.value.endsWith('.woff2')) path = entry.value
          if (entry.type === 'UnicodeRange') ranges.push(entry.value)
        })
        if (!path || !ranges.length) throw new Error('Mermaid 字体清单不完整')
        const buffer = readFileSync(resolve(directory, path))
        fingerprint.update(buffer)
        faces.push({ path, weight, ranges, buffer })
      }
    })
  }
  index = { faces, hash: fingerprint.digest('hex') }
  return index
}

export function fontFingerprint() {
  return fontIndex().hash
}

// 测量与交付使用相同字体文件；按连续字体片段执行 shaping，保留英文 kerning。
export function createDiagramMeasurer() {
  const used = new Map()
  function faceFor(character, weight) {
    const point = character.codePointAt(0)
    const face = fontIndex().faces.find(
      (candidate) =>
        candidate.weight === weight && candidate.ranges.some((range) => includes(range, point))
    )
    if (!face)
      throw new Error(`Mermaid 字体不包含字符 ${character} (U+${point.toString(16).toUpperCase()})`)
    if (!loaded.has(face.path)) loaded.set(face.path, create(face.buffer))
    const font = loaded.get(face.path)
    if (!font.hasGlyphForCodePoint(point)) throw new Error(`Mermaid 字体缺少字形 ${character}`)
    if (!used.has(face.path)) used.set(face.path, { face, font, characters: new Set() })
    used.get(face.path).characters.add(character)
    return { face, font }
  }
  const measurer = {
    width(text, size, style = 0) {
      let width = 0
      let run = ''
      let current
      const flush = () => {
        if (run) width += (current.font.layout(run).advanceWidth * size) / current.font.unitsPerEm
        run = ''
      }
      for (const character of text) {
        if (character.codePointAt(0) < 32) continue
        const next = faceFor(character, style & 1 ? 700 : 400)
        if (current?.face !== next.face) {
          flush()
          current = next
        }
        run += character
      }
      flush()
      return width
    }
  }
  return {
    measurer,
    async assets() {
      const assets = []
      for (const { face, font, characters } of used.values()) {
        const text = [...characters].sort().join('')
        for (const format of ['woff2', 'sfnt']) {
          const buffer = await subsetFont(face.buffer, text, { targetFormat: format })
          const hash = createHash('sha256').update(buffer).digest('hex')
          assets.push({
            name: `${hash}.${format === 'sfnt' ? 'ttf' : 'woff2'}`,
            buffer: Buffer.from(buffer),
            hash,
            bytes: buffer.length,
            weight: face.weight,
            family: font.familyName,
            range: [...characters]
              .map((character) => `U+${character.codePointAt(0).toString(16)}`)
              .join(',')
          })
        }
      }
      return assets
    }
  }
}

export function fontStyles(assets, prefix) {
  return assets
    .filter((asset) => asset.name.endsWith('.woff2'))
    .map(
      (asset) =>
        `@font-face{font-family:"${fontFamily}";font-style:normal;font-weight:${asset.weight};font-display:block;src:url("${prefix}${asset.name}") format("woff2");unicode-range:${asset.range}}`
    )
    .join('')
}

export function diagramLicense() {
  return readFileSync(resolve(directory, 'LICENSE'))
}
