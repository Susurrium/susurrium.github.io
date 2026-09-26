import { posix } from 'node:path'
import type { Element, Root } from 'hast'
import rehypeParse from 'rehype-parse'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

export interface FeedContentOptions {
  readonly permalink: URL
  /** Astro's physical source path, independent of its public slug. */
  readonly filePath?: string
  readonly contentLinks?: ReadonlyMap<string, string>
  readonly resolveAsset?: (sourcePath: string) => Promise<string | undefined>
}

export function normalizeContentFilePath(filePath: string): string {
  return posix.normalize(`/${filePath.replace(/\\/g, '/').replace(/^\/+/, '')}`)
}

/** Resolve source-relative assets and Markdown links before making feed URLs absolute. */
export async function resolveFeedReference(
  value: string,
  options: FeedContentOptions,
  image = false
): Promise<string> {
  const { permalink, filePath } = options
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)) return new URL(value, permalink).href
  const suffixIndex = value.search(/[?#]/)
  const pathname = suffixIndex < 0 ? value : value.slice(0, suffixIndex)
  const suffix = suffixIndex < 0 ? '' : value.slice(suffixIndex)
  if (filePath) {
    let decodedPath = pathname
    try {
      decodedPath = decodeURI(pathname)
    } catch {
      /* Literal percent signs are valid file names. */
    }
    const sourcePath = posix.normalize(
      posix.join(posix.dirname(normalizeContentFilePath(filePath)), decodedPath)
    )
    const contentHref =
      options.contentLinks?.get(sourcePath) ??
      options.contentLinks?.get(`${sourcePath}/index.md`) ??
      options.contentLinks?.get(`${sourcePath}/index.mdx`)
    const assetHref = image ? await options.resolveAsset?.(sourcePath) : undefined
    const href = assetHref ?? contentHref
    if (href) return `${new URL(href, permalink).href}${suffix}`
  }
  return new URL(value, permalink).href
}

// KaTeX's MathML is useful in feed readers without the site's stylesheet.
const mathTags = [
  'math',
  'semantics',
  'annotation',
  'mrow',
  'mi',
  'mn',
  'mo',
  'ms',
  'mtext',
  'mspace',
  'mfrac',
  'msqrt',
  'mroot',
  'msup',
  'msub',
  'msubsup',
  'munder',
  'mover',
  'munderover',
  'mtable',
  'mtr',
  'mtd',
  'menclose',
  'mpadded',
  'mphantom',
  'mstyle'
]
const feedSchema = {
  ...defaultSchema,
  clobberPrefix: '',
  tagNames: [...(defaultSchema.tagNames ?? []), ...mathTags],
  attributes: {
    ...defaultSchema.attributes,
    ...Object.fromEntries(
      mathTags.map((tag) => [
        tag,
        [
          'display',
          'mathVariant',
          'stretchy',
          'fence',
          'separator',
          'accent',
          'accentunder',
          'columnalign',
          'rowalign',
          'columnspacing',
          'rowspacing',
          'linethickness',
          'encoding',
          'xmlns'
        ]
      ])
    )
  }
}

/** Clean rendered Markdown/MDX; the website's compiler owns GFM, math and components. */
export async function prepareFeedContent(
  html: string,
  options: FeedContentOptions
): Promise<string> {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html) as Root
  const pending: Promise<void>[] = []
  visit(tree, 'element', (node: Element, index, parent) => {
    const classes = node.properties.className
    if (
      ['script', 'style', 'button'].includes(node.tagName) ||
      (Array.isArray(classes) && classes.includes('katex-html'))
    ) {
      if (parent && index !== undefined) {
        parent.children.splice(index, 1)
        return index
      }
      return
    }
    delete node.properties.srcSet
    for (const attribute of ['src', 'href', 'poster'] as const) {
      const value = node.properties[attribute]
      if (typeof value !== 'string' || !value) continue
      pending.push(
        resolveFeedReference(value, options, attribute !== 'href').then((absolute) => {
          node.properties[attribute] = absolute
        })
      )
    }
  })
  await Promise.all(pending)
  const processor = unified().use(rehypeSanitize, feedSchema).use(rehypeStringify)
  return processor.stringify(await processor.run(tree))
}
