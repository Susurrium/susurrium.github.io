import { htmlDocument } from './resource-audit.mjs'

export function describeContentDocument(path, source) {
  const match = path.match(/^\/(blog|traces|sayings)\/(.+)$/)
  if (!match || /^(?:tags(?:\/|$)|\d+$)/.test(match[2])) return null
  const document = htmlDocument(source)
  const article = document.querySelector('article')
  if (!article) return null
  const title = article.querySelector('h1')?.textContent?.trim() ?? ''
  const searchText = title || article.textContent.trim()
  const words = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(searchText)].filter(
    (word) => word.isWordLike && word.segment.length >= 2
  )
  const query = words[0]?.segment ?? searchText.slice(0, 24)
  return {
    path,
    kind: { blog: 'blog', traces: 'trace', sayings: 'saying' }[match[1]],
    title,
    query,
    hasToc: Boolean(document.querySelector('#sidebar-btn') && document.querySelector('#sidebar')),
    indexed: article.hasAttribute('data-pagefind-body')
  }
}

export async function discoverPublishedContent(siteUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${siteUrl}/sitemap-0.xml`)
  if (!response.ok)
    throw new Error(`Could not discover built content from sitemap: ${response.status}`)
  const paths = [
    ...new Set(
      htmlDocument(await response.text())
        .querySelectorAll('loc')
        .map((element) => new URL(element.textContent).pathname.replace(/\/+$/, ''))
        .filter((path) => /^\/(?:blog|traces|sayings)\/(?!tags(?:\/|$)|\d+$).+/.test(path))
    )
  ]
  const records = []
  // Bound discovery concurrency for larger sites.
  for (let start = 0; start < paths.length; start += 4) {
    const batch = await Promise.all(
      paths.slice(start, start + 4).map(async (path) => {
        const detail = await fetchImpl(`${siteUrl}${path}`)
        if (!detail.ok) throw new Error(`Published detail ${path} returned ${detail.status}`)
        return describeContentDocument(path, await detail.text())
      })
    )
    records.push(...batch.filter(Boolean))
  }
  return records
}
