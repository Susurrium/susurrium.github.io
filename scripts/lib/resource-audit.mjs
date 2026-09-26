import { ident, parse as parseCss, string, tokenize, tokenTypes, url as cssUrl, walk as walkCss } from 'css-tree'
import { parse as parseHtml } from 'node-html-parser'

/** WHATWG srcset tokenization: commas inside data URLs are part of the URL. */
export function srcsetUrls(value) {
  const urls = []
  let position = 0
  while (position < value.length) {
    while (/[\s,]/.test(value[position] ?? '') && position < value.length) position++
    const start = position
    while (position < value.length && !/\s/.test(value[position])) position++
    let url = value.slice(start, position)
    if (!url) break
    if (url.endsWith(',')) {
      urls.push(url.replace(/,+$/, ''))
      continue
    }
    urls.push(url)
    let parentheses = 0
    while (position < value.length) {
      const character = value[position++]
      if (character === '(') parentheses++
      if (character === ')') parentheses--
      if (character === ',' && parentheses === 0) break
    }
  }
  return urls
}

export function cssResourceUrls(source, inline = false) {
  const urls = []
  const ast = parseCss(source, {
    context: inline ? 'declarationList' : 'stylesheet',
    parseCustomProperty: true,
    // Native CSS nesting can become Raw nodes in css-tree's grammar. The full
    // token pass below still audits every byte, including those Raw regions.
    onParseError() {}
  })
  walkCss(ast, (node) => {
    if (node.type === 'Url') urls.push(node.value)
    if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') {
      const first = node.prelude?.children?.first
      if (first?.type === 'String') urls.push(first.value)
    }
  })
  const tokens = []
  tokenize(source, (type, start, end) => {
    if (type === tokenTypes.BadUrl || type === tokenTypes.BadString) throw new Error('Malformed CSS URL or string.')
    if (type !== tokenTypes.Comment && type !== tokenTypes.WhiteSpace) tokens.push({ type, text: source.slice(start, end) })
  })
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const previous = tokens[index - 1]
    if (token.type === tokenTypes.Url) urls.push(cssUrl.decode(token.text))
    if (token.type === tokenTypes.String && previous) {
      const inUrl = previous.type === tokenTypes.Function && ident.decode(previous.text.slice(0, -1)).toLowerCase() === 'url'
      const inImport = previous.type === tokenTypes.AtKeyword && ident.decode(previous.text.slice(1)).toLowerCase() === 'import'
      if (inUrl || inImport) urls.push(string.decode(token.text))
    }
  }
  return [...new Set(urls)]
}

export function htmlDocument(source) {
  return parseHtml(source, {
    comment: false,
    blockTextElements: { script: true, style: true, pre: true }
  })
}

export function htmlResourceUrls(document) {
  const resources = []
  for (const element of document.querySelectorAll(
    'script,link,img,audio,video,source,iframe,object,embed,image'
  )) {
    const tagName = element.rawTagName.toLowerCase()
    if (
      tagName === 'link' &&
      !/(?:^|\s)(?:stylesheet|preload|modulepreload|prefetch|icon|apple-touch-icon|manifest)(?:\s|$)/i.test(
        element.getAttribute('rel') ?? ''
      )
    )
      continue
    const urls = ['src', 'href', 'poster', 'data', 'xlink:href']
      .map((name) => element.getAttribute(name))
      .filter(Boolean)
    const srcset = element.getAttribute('srcset') ?? element.getAttribute('imagesrcset')
    if (srcset) urls.push(...srcsetUrls(srcset))
    for (const url of new Set(urls)) resources.push({ tagName, url, kind: 'html' })
  }
  for (const element of document.querySelectorAll('style,[style]')) {
    const isStyle = element.rawTagName.toLowerCase() === 'style'
    for (const url of cssResourceUrls(
      isStyle ? element.textContent : element.getAttribute('style'),
      !isStyle
    ))
      resources.push({ tagName: 'style', url, kind: 'css' })
  }
  return resources
}

export function normalizeResourceUrl(value, base) {
  const url = new URL(value.trim(), base)
  if (!['http:', 'https:', 'data:', 'blob:'].includes(url.protocol))
    throw new Error(`Unsupported resource protocol: ${url.protocol}`)
  if (url.username || url.password) throw new Error('Resource URLs must not contain credentials.')
  return url
}
