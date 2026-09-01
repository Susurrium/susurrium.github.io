export interface ProfileTimelineEntry {
  title: string
  subtitle?: string
  startDate: string
  endDate?: string | null
  isCurrent?: boolean
  href?: string
  description?: string
  image?: string
  imageAlt?: string
}

/** The neutral endpoint label used for an ongoing entry. */
export const CURRENT_TIME_LABEL = '当下'

const monthDatePattern = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/

/**
 * Keep timeline labels at the same precision as the confirmed profile data:
 * year and month, without implying a false day-level precision.
 */
export function formatProfilePoint(value: string): string {
  const match = value.match(monthDatePattern)
  if (!match) return value

  const [, year, month] = match
  return `${year} 年 ${Number(month)} 月`
}

/** Format the standalone card period from the same source fields. */
export function formatProfilePeriod(
  entry: Pick<ProfileTimelineEntry, 'startDate' | 'endDate' | 'isCurrent'>
): string {
  const start = formatProfilePoint(entry.startDate)
  if (entry.isCurrent) return `${start} · ${CURRENT_TIME_LABEL}`
  if (entry.endDate) return `${start} — ${formatProfilePoint(entry.endDate)}`
  return start
}

/** Render the oldest confirmed point first and keep the order deterministic. */
export function sortProfileTimelineEntries(
  entries: readonly ProfileTimelineEntry[]
): ProfileTimelineEntry[] {
  return [...entries].sort(
    (left, right) => left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title)
  )
}
