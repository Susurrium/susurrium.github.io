import type { ProfileTimelineEntry } from './profile-timeline'

export interface EducationEntry {
  school: string
  field: string
  startDate: string
  endDate?: string | null
  isCurrent?: boolean
  href: string
  image: string
  imageAlt: string
}

/**
 * Education is deliberately kept small and factual until more entries are
 * confirmed. Both About and Home consume this same record.
 */
export const educationEntries: readonly EducationEntry[] = [
  {
    school: '北京大学',
    field: '医学部',
    startDate: '2025-09',
    endDate: null,
    isCurrent: true,
    href: 'https://www.pku.edu.cn/',
    image: '/images/PKU.svg',
    imageAlt: '北京大学校徽'
  }
]

export function toProfileTimelineEntry(entry: EducationEntry): ProfileTimelineEntry {
  return {
    title: entry.school,
    subtitle: entry.field,
    startDate: entry.startDate,
    endDate: entry.endDate,
    isCurrent: entry.isCurrent,
    href: entry.href,
    image: entry.image,
    imageAlt: entry.imageAlt
  }
}
