import type { Heading, Root } from 'mdast'
import type { Plugin } from 'unified'

function normalizeHeadingText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ')
}

function getInlineText(node: {
  alt?: unknown
  children?: readonly unknown[]
  value?: unknown
}): string {
  if (typeof node.value === 'string') return node.value
  if (typeof node.alt === 'string') return node.alt
  if (!Array.isArray(node.children)) return ''

  return node.children
    .map((child) => getInlineText(child as Parameters<typeof getInlineText>[0]))
    .join('')
}

/** Remove a repeated frontmatter title when it is also the first body heading. */
const remarkRemoveDuplicateTitleHeading: Plugin<[], Root> = () => (tree, file) => {
  const title = file.data.astro?.frontmatter?.title
  if (typeof title !== 'string') return

  const firstNode = tree.children[0]
  const firstHeading = firstNode?.type === 'heading' ? (firstNode as Heading) : undefined
  if (!firstHeading || firstHeading.depth !== 1) return

  if (normalizeHeadingText(getInlineText(firstHeading)) === normalizeHeadingText(title)) {
    tree.children.splice(0, 1)
  }
}

export default remarkRemoveDuplicateTitleHeading
