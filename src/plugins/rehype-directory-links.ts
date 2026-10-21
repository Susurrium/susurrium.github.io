import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

import { directoryPath } from '../lib/site-path'

const pages = new Set([
  '/home',
  '/about',
  '/archives',
  '/links',
  '/projects',
  '/promise',
  '/search',
  '/tools/card-crop-review'
])
const resource =
  /\.(?:html?|mdx?|pdf|png|jpe?g|webp|avif|svg|gif|mp4|webm|mp3|ogg|txt|zip|json|xml|css|m?js)$/i

/** 兼容正文中的既有页面链接，保持片段和资源文件的原始语义。 */
export default function rehypeDirectoryLinks({ site = 'https://susurrium.github.io' } = {}) {
  const origin = new URL(site).origin
  return (tree: Root) => {
    visit(tree, 'element', (element) => {
      const href = element.properties.href
      if (element.tagName !== 'a' || typeof href !== 'string' || !href || /^[#?]/.test(href)) return
      if (!href.startsWith('/') && !/^https?:\/\//.test(href)) return
      const url = new URL(href, origin)
      if (url.origin !== origin || resource.test(url.pathname)) return
      const path = url.pathname.replace(/\/$/, '')
      if (!pages.has(path) && !/^\/(?:blog|traces|sayings)(?:\/|$)/.test(path)) return
      const target = directoryPath(url.pathname + url.search + url.hash)
      element.properties.href = /^https?:\/\//.test(href) ? new URL(target, origin).href : target
    })
  }
}
