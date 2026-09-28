import { describe, expect, test } from 'bun:test'
import type { Root } from 'mdast'

import remarkRemoveDuplicateTitleHeading from '../src/plugins/remark-remove-duplicate-title-heading'

function removeDuplicateTitle(nodes: Root['children'], title: string): Root {
  const tree: Root = { type: 'root', children: nodes }
  const transformer = remarkRemoveDuplicateTitleHeading()
  transformer?.(tree, { data: { astro: { frontmatter: { title } } } } as never)
  return tree
}

describe('duplicate frontmatter title heading removal', () => {
  test('removes a matching leading H1, including normalized inline text', () => {
    const tree = removeDuplicateTitle(
      [
        {
          type: 'heading',
          depth: 1,
          children: [
            { type: 'text', value: 'A title with ' },
            { type: 'emphasis', children: [{ type: 'text', value: 'formatting' }] }
          ]
        },
        { type: 'paragraph', children: [{ type: 'text', value: 'The article body.' }] }
      ],
      'A title with formatting'
    )

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]?.type).toBe('paragraph')
  })

  test('keeps a different leading heading', () => {
    const tree = removeDuplicateTitle(
      [{ type: 'heading', depth: 1, children: [{ type: 'text', value: 'A section' }] }],
      'Article title'
    )

    expect(tree.children[0]?.type).toBe('heading')
  })

  test('keeps a matching H1 when it is not the first body block', () => {
    const tree = removeDuplicateTitle(
      [
        { type: 'paragraph', children: [{ type: 'text', value: 'Opening text.' }] },
        { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Article title' }] }
      ],
      'Article title'
    )

    expect(tree.children).toHaveLength(2)
    expect(tree.children[1]?.type).toBe('heading')
  })
})
