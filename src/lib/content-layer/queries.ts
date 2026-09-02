import type {
  ContentCatalog,
  ContentKind,
  ContentQuery,
  ContentRecord,
  ContentRecordOf,
  ContentSort
} from './types'

/** Return a calendar year using the site's single content timezone. */
export function getContentYear(date: Date, timeZone = 'Asia/Shanghai'): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(date))
}

function compareIds(left: ContentRecord, right: ContentRecord): number {
  return left.key.localeCompare(right.key)
}

function compareDates(
  left: ContentRecord,
  right: ContentRecord,
  useEditorialDate: boolean,
  useStableIdTieBreaker: boolean
): number {
  const leftDate = useEditorialDate ? (left.updatedAt ?? left.publishedAt) : left.publishedAt
  const rightDate = useEditorialDate ? (right.updatedAt ?? right.publishedAt) : right.publishedAt
  const byDate = (rightDate?.getTime() ?? 0) - (leftDate?.getTime() ?? 0)
  return byDate !== 0 ? byDate : useStableIdTieBreaker ? compareIds(left, right) : 0
}

/** Pure ordering policies shared by every page query. */
export function sortContentRecords<T extends ContentRecord>(
  records: readonly T[],
  sort: ContentSort = 'editorial-date-desc'
): T[] {
  const sorted = [...records]
  if (sort === 'id-asc') return sorted.sort(compareIds)
  return sorted.sort((left, right) =>
    compareDates(left, right, sort === 'editorial-date-desc', sort === 'publish-date-desc')
  )
}

export function queryContent(catalog: ContentCatalog, query: ContentQuery = {}): ContentRecord[] {
  const kinds = query.kinds ? new Set<ContentKind>(query.kinds) : undefined
  let records = catalog.all.filter((record) => !kinds || kinds.has(record.kind))

  if (query.tag !== undefined) {
    const normalizedTag = query.tag.toLowerCase()
    records = records.filter((record) =>
      record.tags.some((tag) => tag.toLowerCase() === normalizedTag)
    )
  }

  records = sortContentRecords(records, query.sort ?? 'editorial-date-desc')

  const offset = Math.max(0, query.offset ?? 0)
  const end = query.limit === undefined ? undefined : offset + Math.max(0, query.limit)
  return records.slice(offset, end)
}

export function getRecordOfKind<K extends ContentKind>(
  catalog: ContentCatalog,
  kind: K,
  id: string
): ContentRecordOf<K> | undefined {
  return catalog.all.find((record) => record.kind === kind && record.id === id) as
    | ContentRecordOf<K>
    | undefined
}
