import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import GithubSlugger from 'github-slugger'
import { toString } from 'mdast-util-to-string'
import { parse as parseHtml } from 'node-html-parser'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { parseDocument } from 'yaml'

export const currentDocuments = [
  'README.md',
  'docs/CONTENT.md',
  'docs/DEVELOPMENT.md',
  'docs/ARCHITECTURE.md',
  'docs/MEDIA_WORKBENCH.md',
  'docs/SOURCE_LEDGER.md',
  'docs/THIRD_PARTY_NOTICES.md'
]

export function checkDocumentation(root, { entryPoints = currentDocuments } = {}) {
  root = resolve(root)
  const failures = []
  const parser = unified().use(remarkParse).use(remarkGfm)
  const documents = new Map()
  const graph = new Map()
  const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts
  const archiveIndex = resolve(root, 'docs/archive/README.md')
  const archives = []
  let localLinks = 0
  let externalLinks = 0
  let yamlExamples = 0

  const insideRoot = (path) => path === root || path.startsWith(`${root}${sep}`)
  const load = (path) => {
    if (documents.has(path)) return documents.get(path)
    const tree = parser.parse(readFileSync(path, 'utf8'))
    const slugger = new GithubSlugger()
    const anchors = new Set()
    visit(tree, 'heading', (node) => anchors.add(slugger.slug(toString(node))))
    // 显式 HTML 锚点与 Markdown 标题一同接受检查。
    visit(tree, 'html', (node) => {
      for (const anchor of parseHtml(node.value).querySelectorAll('[id], a[name]')) {
        const id = anchor.getAttribute('id') ?? anchor.getAttribute('name')
        if (id) anchors.add(id)
      }
    })
    const document = { tree, anchors }
    documents.set(path, document)
    graph.set(path, new Set())
    return document
  }
  const collect = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) collect(path)
      else if (entry.isFile() && extname(path) === '.md') {
        load(path)
        if (path.startsWith(`${resolve(root, 'docs/archive')}${sep}`) && path !== archiveIndex)
          archives.push(path)
      }
    }
  }

  for (const path of [...entryPoints, 'docs/archive/README.md']) {
    const absolute = resolve(root, path)
    if (!existsSync(absolute)) failures.push(`${path}: required document is missing`)
    else load(absolute)
  }
  if (existsSync(resolve(root, 'docs'))) collect(resolve(root, 'docs'))
  for (const path of ['CODE_OF_CONDUCT.md', 'packages/pure/README.md']) {
    const absolute = resolve(root, path)
    if (existsSync(absolute)) load(absolute)
  }

  // Map 迭代包含通过链接发现的 Markdown，保证间接引用也被检查。
  for (const [source, { tree }] of documents) {
    const sourceName = relative(root, source).split(sep).join('/')
    const isCurrent = entryPoints.includes(sourceName)
    const at = (node) => `${sourceName}:${node.position.start.line}`
    if (tree.children.filter((node) => node.type === 'heading' && node.depth === 1).length !== 1)
      failures.push(`${sourceName}: expected one document title`)
    visit(tree, (node) => {
      if (isCurrent && node.type === 'code' && ['yaml', 'yml'].includes(node.lang)) {
        yamlExamples += 1
        for (const error of parseDocument(node.value).errors)
          failures.push(`${at(node)}: invalid YAML example: ${error.message}`)
      }
      if (isCurrent && ['code', 'inlineCode'].includes(node.type)) {
        for (const match of node.value.matchAll(/\bbun run ([a-zA-Z][\w:-]*)/g)) {
          if (!Object.hasOwn(scripts, match[1]))
            failures.push(`${at(node)}: unknown package script ${match[1]}`)
        }
      }
      if (!['link', 'image', 'definition'].includes(node.type)) return
      let url
      let target
      let fragment
      try {
        const base = node.url.startsWith('/')
          ? pathToFileURL(`${root}${sep}`)
          : pathToFileURL(source)
        url = node.url.startsWith('//')
          ? new URL(`https:${node.url}`)
          : new URL(node.url.startsWith('/') ? `.${node.url}` : node.url, base)
        if (url.protocol !== 'file:') {
          externalLinks += 1
          return
        }
        target = fileURLToPath(url)
        fragment = decodeURIComponent(url.hash.slice(1))
      } catch (error) {
        failures.push(`${at(node)}: invalid link ${node.url}: ${error.message}`)
        return
      }
      localLinks += 1
      if (!insideRoot(target)) {
        failures.push(`${at(node)}: local link leaves repository: ${node.url}`)
        return
      }
      if (!existsSync(target)) {
        failures.push(`${at(node)}: missing target ${node.url}`)
        return
      }
      if (statSync(target).isFile() && extname(target) === '.md') {
        graph.get(source).add(target)
        const targetDocument = load(target)
        if (fragment && !targetDocument.anchors.has(fragment))
          failures.push(`${at(node)}: missing anchor ${node.url}`)
      }
    })
  }

  for (const path of archives) {
    if (!graph.get(archiveIndex)?.has(path))
      failures.push(`docs/archive/README.md: unindexed historical document ${relative(root, path)}`)
  }
  const reachable = new Set()
  const traverse = (path) => {
    if (reachable.has(path)) return
    reachable.add(path)
    for (const target of graph.get(path) ?? []) traverse(target)
  }
  traverse(resolve(root, 'README.md'))
  for (const path of documents.keys()) {
    if (!reachable.has(path)) failures.push(`${relative(root, path)}: unreachable from README.md`)
  }
  return { documents: documents.size, localLinks, externalLinks, yamlExamples, failures }
}
