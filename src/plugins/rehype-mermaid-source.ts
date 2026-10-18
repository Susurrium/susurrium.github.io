import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

// 保留源码到最终渲染边界，避免编译草稿时发布图表资源。
const rehypeMermaidSource: Plugin<[], Root> = () => (tree, file) => {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'pre' || index === undefined || !parent) return
    const code = node.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code'
    )
    if (!code || !(code.properties.className as string[] | undefined)?.includes('language-mermaid'))
      return
    parent.children[index] = {
      type: 'element',
      tagName: 'figure',
      properties: {
        'data-mermaid-source': '',
        'data-mermaid-file': file.path,
        'data-mermaid-line': node.position?.start.line ?? 1
      },
      children: [node]
    }
    return SKIP
  })
}

export default rehypeMermaidSource
