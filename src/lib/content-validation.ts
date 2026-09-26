import { z } from 'astro/zod'

export const contentText = (maxLength: number) => z.string().trim().min(1).max(maxLength)

export const contentTagsSchema = z
  .array(contentText(80))
  .default([])
  .transform((tags) => [...new Set(tags.map((tag) => tag.normalize('NFC').toLowerCase()))])

export const sourceUrlSchema = z.url({ protocol: /^https?$/ })

export function hasValidEditorialDates(entry: { publishDate?: Date; updatedDate?: Date }): boolean {
  return !entry.publishDate || !entry.updatedDate || entry.updatedDate >= entry.publishDate
}
