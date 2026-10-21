import type { ContentRecord } from './content-layer/types'

export function rssItemDates(record: ContentRecord) {
  return {
    pubDate: record.publishedAt,
    ...(record.updatedAt
      ? { customData: `<atom:updated>${record.updatedAt.toISOString()}</atom:updated>` }
      : {})
  }
}
