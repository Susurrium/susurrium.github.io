import type { CollectionEntry } from 'astro:content'

type DatedEntry = {
  id?: string
  data: {
    publishDate: Date
    updatedDate?: Date
  }
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

/** Keep draft filtering explicit at every non-preview query boundary. */
export function published<T extends PublishableEntry>(entries: T[]): T[] {
  return entries.filter((entry) => !entry.data.draft)
}

/**
 * Latest first, without mutating Astro's collection result.
 *
 * A date alone is not enough for the Saying decorative-image contract: two
 * records may intentionally share a day. Use the stable content id as an
 * explicit secondary key rather than depending on loader enumeration order.
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

export function formatContentDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)
}
