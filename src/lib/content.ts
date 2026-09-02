import type { CollectionEntry } from 'astro:content'

type DatedEntry = {
  id?: string
  data: {
    publishDate: Date
  }
}

type IdentifiedEntry = {
  id?: string
}

type PublishableEntry = {
  data: {
    draft: boolean
  }
}

export type SiteContentEntry =
  | CollectionEntry<'blog'>
  | CollectionEntry<'trace'>
  | CollectionEntry<'saying'>

/** Shared accent used by every content detail page's reading background. */
export const readingHighlightColor = 'hsl(var(--primary) / var(--un-text-opacity))'

/** Keep draft filtering explicit at every non-preview query boundary. */
export function published<T extends PublishableEntry>(entries: T[]): T[] {
  return entries.filter((entry) => !entry.data.draft)
}

/**
 * Latest first, without mutating Astro's collection result.
 *
 * A date alone is not enough for the Trace archive: two records may share a
 * day. Use the stable content id as an explicit secondary key rather than
 * depending on loader enumeration order.
 */
export function sortByDate<T extends DatedEntry>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    const byDate = right.data.publishDate.getTime() - left.data.publishDate.getTime()
    if (byDate !== 0) return byDate

    const leftId = left.id ?? ''
    const rightId = right.id ?? ''
    if (leftId === rightId) return 0
    return leftId < rightId ? -1 : 1
  })
}

/** Stable archive order for collections without an editorial date. */
export function sortById<T extends IdentifiedEntry>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    const leftId = left.id ?? ''
    const rightId = right.id ?? ''
    if (leftId === rightId) return 0
    return leftId < rightId ? -1 : 1
  })
}

export function formatContentDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)
}
