import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { parse as parseCss, walk } from 'css-tree'
import { init, parse as parseModule } from 'es-module-lexer'

function cssImports(source) {
  const imports = []
  walk(parseCss(source), (node) => {
    if (node.type !== 'Atrule' || node.name.toLowerCase() !== 'import' || !node.prelude) return
    let reference
    walk(node.prelude, (part) => {
      if (reference === undefined && (part.type === 'Url' || part.type === 'String'))
        reference = part.value
    })
    if (reference !== undefined) imports.push(reference)
  })
  return imports
}

// Cache parsing and compression across pages, but count every page's distinct
// static dependency closure. Dynamic imports only enter the budget when an
// explicit preload causes the browser to fetch them during initial loading.
export function createInitialAssetInspector(directory, files) {
  const available = new Set(files)
  const cache = new Map()
  async function load(file, kind) {
    const key = `${kind}:${file}`
    if (!cache.has(key))
      cache.set(
        key,
        (async () => {
          const bytes = await readFile(file)
          const source = bytes.toString('utf8')
          await init
          const imports =
            kind === 'style'
              ? cssImports(source)
              : parseModule(source)[0]
                  .filter((entry) => entry.d === -1 && entry.n !== undefined)
                  .map((entry) => entry.n)
          return { bytes: gzipSync(bytes).byteLength, imports }
        })()
      )
    return cache.get(key)
  }

  return async function inspect(html, documentUrl) {
    const origin = new URL(documentUrl).origin
    const base = new URL(html.querySelector('base[href]')?.getAttribute('href') ?? '', documentUrl)
    const seen = new Set()
    let scripts = 0
    let styles = 0
    async function visit(reference, parentUrl, kind, moduleImport = false) {
      // Bare module names require an import map and are not output by this
      // bundler. CSS @import and HTML attributes allow bare relative paths.
      if (moduleImport && !/^(?:\.{1,2}\/|\/|[a-z][a-z\d+.-]*:)/i.test(reference)) return
      const url = new URL(reference, parentUrl)
      if (url.origin !== origin) return
      const file = resolve(directory, `.${decodeURIComponent(url.pathname)}`)
      if (!available.has(file) || seen.has(file)) return
      seen.add(file)
      if (extname(file).toLowerCase() === '.css') kind = 'style'
      const asset = await load(file, kind)
      if (kind === 'style') styles += asset.bytes
      else scripts += asset.bytes
      for (const dependency of asset.imports) await visit(dependency, url, kind, kind === 'script')
    }

    for (const element of html.querySelectorAll('script[src], link[href]')) {
      if (element.tagName === 'SCRIPT') {
        await visit(element.getAttribute('src'), base, 'script')
        continue
      }
      const rel = (element.getAttribute('rel') ?? '').toLowerCase().split(/\s+/)
      const as = element.getAttribute('as')
      if (rel.includes('stylesheet') || (rel.includes('preload') && as === 'style'))
        await visit(element.getAttribute('href'), base, 'style')
      else if (rel.includes('modulepreload') || (rel.includes('preload') && as === 'script'))
        await visit(element.getAttribute('href'), base, 'script')
    }

    const inlineScripts = []
    for (const element of html.querySelectorAll('script:not([src])')) {
      const type = (element.getAttribute('type') ?? '').trim().toLowerCase()
      if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue
      inlineScripts.push(element.text)
      if (type === 'module') {
        await init
        for (const entry of parseModule(element.text)[0])
          if (entry.d === -1 && entry.n !== undefined) await visit(entry.n, base, 'script', true)
      }
    }
    const inlineStyles = html.querySelectorAll('style').map((element) => element.text)
    for (const source of inlineStyles)
      for (const dependency of cssImports(source)) await visit(dependency, base, 'style')
    if (inlineScripts.length) scripts += gzipSync(inlineScripts.join('\n')).byteLength
    if (inlineStyles.length) styles += gzipSync(inlineStyles.join('\n')).byteLength
    return { scripts, styles }
  }
}
