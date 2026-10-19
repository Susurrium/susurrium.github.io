import Color from 'color'
import { generate, parse as parseCss, walk } from 'css-tree'
import { parse } from 'node-html-parser'

export const lightColors = {
  '--pele-bg': '#ffffff',
  '--pele-fg': '#202127',
  '--pele-muted': '#505966',
  '--pele-line': '#505966',
  '--pele-surface': '#edf4f8',
  '--pele-surface-alt': '#f3eef9',
  '--pele-border': '#52798e',
  '--pele-accent': '#326a87',
  '--pele-critical': '#b4233b',
  '--pele-font': 'Diagram Noto',
  '--pele-font-mono': 'Diagram Noto'
}
const tags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
  'defs',
  'marker',
  'clipPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
  'mask'
])

function checkValue(value, context) {
  walk(parseCss(value, { context }), (node) => {
    if (node.type === 'Url' && !node.value.startsWith('#'))
      throw new Error('Mermaid 禁止请求外部资源')
    if (node.type === 'Atrule') throw new Error('Mermaid SVG 不允许样式规则')
  })
}

export function readSvg(source) {
  const document = parse(source, { lowerCaseTagName: false })
  const svg = document.querySelector('svg')
  if (!svg || document.childNodes.length !== 1) throw new Error('Mermaid SVG 根节点无效')
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    if (node.rawTagName === 'image') throw new Error('Mermaid 禁止请求外部资源')
    if (!tags.has(node.rawTagName)) throw new Error(`Mermaid SVG 不允许元素 ${node.rawTagName}`)
    for (const [name, value] of Object.entries(node.attributes)) {
      if (/^on/i.test(name) || ['href', 'xlink:href', 'src'].includes(name))
        throw new Error(`Mermaid SVG 不允许属性 ${name}`)
      if (name === 'style') checkValue(value, 'declarationList')
      else if (['fill', 'stroke', 'clip-path', 'mask', 'filter'].includes(name))
        checkValue(value, 'value')
    }
  }
  return { document, svg }
}

export function instanceSvg(source, prefix) {
  const { document, svg } = readSvg(source)
  const ids = new Map()
  for (const node of [svg, ...svg.querySelectorAll('[id]')]) {
    if (!node.id) continue
    ids.set(node.id, `${prefix}-${node.id}`)
    node.setAttribute('id', ids.get(node.id))
  }
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      const value = node.getAttribute(attribute)
      if (value)
        node.setAttribute(
          attribute,
          value
            .split(/\s+/)
            .map((id) => ids.get(id) ?? id)
            .join(' ')
        )
    }
    for (const [name, value] of Object.entries(node.attributes)) {
      if (!value.includes('url(')) continue
      const context = name === 'style' ? 'declarationList' : 'value'
      const ast = parseCss(value, { context })
      walk(ast, (entry) => {
        if (entry.type === 'Url' && ids.has(entry.value.slice(1)))
          entry.value = `#${ids.get(entry.value.slice(1))}`
      })
      node.setAttribute(name, generate(ast))
    }
  }
  svg.setAttribute('data-pagefind-ignore', 'all')
  return document.toString()
}

function mixedColor(node) {
  const groups = [[]]
  node.children.forEach((entry) => {
    if (entry.type === 'Operator' && entry.value === ',') groups.push([])
    else groups.at(-1).push(entry)
  })
  if (groups.length !== 3 || groups[0].map(generate).join(' ') !== 'in srgb')
    throw new Error('Mermaid PNG 不支持此颜色插值空间')
  const colors = groups.slice(1).map((group) => {
    const last = group.at(-1)
    const percentage = last?.type === 'Percentage' ? Number(group.pop().value) : undefined
    return { color: Color(group.map(generate).join(' ')).rgb(), percentage }
  })
  const first = colors[0].percentage ?? 100 - (colors[1].percentage ?? 50)
  const second = colors[1].percentage ?? 100 - first
  const total = first + second
  if (first < 0 || second < 0 || !(total > 0)) throw new Error('Mermaid PNG 颜色权重无效')
  const weights = [first / total, second / total]
  const alpha = colors.reduce((sum, entry, index) => sum + entry.color.alpha() * weights[index], 0)
  const rgb = [0, 1, 2].map((channel) =>
    alpha
      ? colors.reduce(
          (sum, entry, index) =>
            sum + entry.color.array()[channel] * entry.color.alpha() * weights[index],
          0
        ) / alpha
      : 0
  )
  return Color.rgb(rgb)
    .alpha(alpha * Math.min(1, total / 100))
    .string(4)
}

function resolveValue(value, variables, resolving = new Set()) {
  const ast = parseCss(value, { context: 'value' })
  walk(ast, {
    visit: 'Function',
    leave(node, item, list) {
      if (node.name === 'color-mix') {
        list.replace(item, parseCss(mixedColor(node), { context: 'value' }).children)
        return
      }
      if (node.name !== 'var') return
      const name = generate(node.children.first)
      if (resolving.has(name)) throw new Error(`Mermaid CSS 变量循环：${name}`)
      const fallback = node.children.toArray().slice(2).map(generate).join('')
      const replacement = variables.get(name) ?? fallback
      if (!replacement) throw new Error(`Mermaid CSS 变量缺失：${name}`)
      const resolved = resolveValue(replacement, variables, new Set([...resolving, name]))
      list.replace(item, parseCss(resolved, { context: 'value' }).children)
    }
  })
  return generate(ast)
}

// PNG 渲染器使用显式颜色，避免依赖其 CSS 自定义属性支持情况。
export function rasterSvg(source, family) {
  const { document, svg } = readSvg(source)
  const variables = new Map(
    Object.entries({ ...lightColors, '--pele-font': family, '--pele-font-mono': family })
  )
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    const style = node.getAttribute('style')
    if (style)
      walk(parseCss(style, { context: 'declarationList' }), {
        visit: 'Declaration',
        enter(entry) {
          if (entry.property.startsWith('--')) variables.set(entry.property, generate(entry.value))
        }
      })
  }
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const [name, value] of Object.entries(node.attributes)) {
      if (name === 'style') {
        const ast = parseCss(value, { context: 'declarationList' })
        ast.children.forEach((entry, item, list) => {
          if (entry.property.startsWith('--')) list.remove(item)
          else
            entry.value = parseCss(resolveValue(generate(entry.value), variables), {
              context: 'value'
            })
        })
        node.setAttribute(name, generate(ast))
      } else if (value.includes('var(') || value.includes('color-mix('))
        node.setAttribute(name, resolveValue(value, variables))
    }
  }
  return document.toString()
}
