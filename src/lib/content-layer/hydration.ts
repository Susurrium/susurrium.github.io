import { getSourceEntry } from './catalog'
import { toStandardCardData } from './page-data'
import type {
  ContentRecord,
  LoadedContentCatalog,
  PageItem,
  RenderablePageItem,
  ResolvedPageItem
} from './types'

function resolveRecord(item: PageItem, catalog: LoadedContentCatalog): ContentRecord {
  const record = catalog.all.find((candidate) => candidate.key === item.contentKey)
  if (!record) throw new Error(`Missing content record for ${item.contentKey}`)
  return record
}

/**
 * Reattach domain and source data only at the render boundary. This operation
 * is intentionally synchronous and cheap: generated Blog reading-time data is
 * obtained only by the Blog card/profile that actually renders it, so detail
 * pages do not render every related article body again.
 */
export function hydratePageItem(item: PageItem, catalog: LoadedContentCatalog): RenderablePageItem {
  const record = resolveRecord(item, catalog)
  const source =
    record.kind === 'blog'
      ? getSourceEntry(catalog, 'blog', record.id)
      : record.kind === 'trace'
        ? getSourceEntry(catalog, 'trace', record.id)
        : getSourceEntry(catalog, 'saying', record.id)
  if (!source) throw new Error(`Missing source entry for ${record.key}`)

  const resolved: ResolvedPageItem = {
    card: toStandardCardData(record),
    contentKey: item.contentKey,
    key: item.key,
    placement: item.placement,
    record
  }

  return { ...resolved, source } as RenderablePageItem
}

export function hydratePageItems(
  items: readonly PageItem[],
  catalog: LoadedContentCatalog
): RenderablePageItem[] {
  return items.map((item) => hydratePageItem(item, catalog))
}
