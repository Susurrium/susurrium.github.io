import type { CollectionEntry } from 'astro:content'

type DatedEntry = {
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

/** Latest first, without mutating Astro's collection result. */
export function sortByDate<T extends DatedEntry>(entries: T[]): T[] {
  return [...entries].sort(
    (left, right) => right.data.publishDate.getTime() - left.data.publishDate.getTime()
  )
}

export function formatContentDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)
}
