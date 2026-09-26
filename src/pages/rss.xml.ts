import type { APIRoute, ImageMetadata } from 'astro'
import { getImage } from 'astro:assets'
import { render } from 'astro:content'
import mdxRenderer from '@astrojs/mdx/server.js'
import rss from '@astrojs/rss'
import {
  isContentSurfaceEnabled,
  loadContentCatalog,
  sortContentRecords
} from '@/lib/content-layer'
import { normalizeContentFilePath, prepareFeedContent } from '@/lib/rss-content'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import config from 'virtual:config'

const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/**/*.{jpeg,jpg,png,gif,avif,webp,svg}'
)
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )

export const GET: APIRoute = async (context) => {
  const catalog = await loadContentCatalog()
  const site = context.site ?? new URL(import.meta.env.SITE)
  const records = sortContentRecords(
    catalog.all.filter((record) => isContentSurfaceEnabled(record.kind, 'rss')),
    'editorial-date-desc'
  )
  const container = await AstroContainer.create({ astroConfig: { site: site.href } })
  container.addServerRenderer({ renderer: mdxRenderer })
  const contentLinks = new Map(
    [...catalog.sourcesByKey.entries()].flatMap(([key, entry]) => {
      const record = catalog.recordsByKey.get(key)
      return entry.filePath && record && isContentSurfaceEnabled(record.kind, 'reading')
        ? [[normalizeContentFilePath(entry.filePath), record.href] as const]
        : []
    })
  )
  const assetCache = new Map<string, Promise<string | undefined>>()
  const resolveAsset = (sourcePath: string) => {
    if (!assetCache.has(sourcePath)) {
      assetCache.set(
        sourcePath,
        (async () => {
          const image = await images[sourcePath]?.()
          return image ? (await getImage({ src: image.default })).src : undefined
        })()
      )
    }
    return assetCache.get(sourcePath)!
  }

  const items = []
  // One container is shared; sequential rendering avoids cross-request asset state.
  for (const record of records) {
    const post = catalog.sourcesByKey.get(record.key)
    if (!post) throw new Error(`RSS source entry not found for ${record.key}`)
    const permalink = new URL(record.href, site)
    const { Content } = await render(post)
    const html = await container.renderToString(Content, { request: new Request(permalink) })
    const introduction =
      record.kind === 'saying'
        ? `<blockquote><p>${escapeHtml(record.title)}</p></blockquote>${record.originalText ? `<p>${escapeHtml(record.originalText)}</p>` : ''}<p>${escapeHtml([record.author, record.source].filter(Boolean).join(' · '))}</p>`
        : record.image
          ? `<p><img src="${escapeHtml(record.image.src)}" alt="${escapeHtml(record.image.alt ?? record.title)}"></p>`
          : ''
    const content = await prepareFeedContent(introduction + html, {
      permalink,
      filePath: post.filePath,
      contentLinks,
      resolveAsset
    })
    items.push({
      title: record.title,
      description: record.description ?? record.title,
      pubDate: record.updatedAt ?? record.publishedAt,
      link: record.href,
      categories: [...record.tags],
      content
    })
  }

  return rss({
    trailingSlash: false,
    stylesheet: '/scripts/pretty-feed-v3.xsl',
    title: config.title,
    description: config.description,
    site,
    items
  })
}
