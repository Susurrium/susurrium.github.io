import type { ContentPresentation } from '@/lib/content-layer/types'

/**
 * Historical presentation values accepted only at data/input boundaries.
 *
 * The source-coupled spellings stay here so persisted page JSON and old Astro
 * props can be read without leaking those names back into the domain contract.
 * New code must emit one of the canonical `ContentPresentation` values.
 */
const legacyPresentationMap: Readonly<Record<string, ContentPresentation>> = {
  'arthals-text': 'text',
  'large-skull-content': 'media-content',
  'large-skull-decorative': 'media-decorative'
}

const canonicalPresentations = new Set<ContentPresentation>([
  'text',
  'media-content',
  'media-decorative'
])

/** Whether a value is a supported current or historical spelling. */
export function isKnownContentPresentation(value: unknown): boolean {
  if (typeof value !== 'string') return false

  const candidate = value.trim()
  return (
    canonicalPresentations.has(candidate as ContentPresentation) ||
    Object.prototype.hasOwnProperty.call(legacyPresentationMap, candidate)
  )
}

/**
 * Convert a canonical or historical value to the current presentation union.
 * Unknown, empty, and non-string values use the caller's safe fallback.
 */
export function normalizeContentPresentation(
  value: unknown,
  fallback: ContentPresentation = 'text'
): ContentPresentation {
  if (typeof value !== 'string') return fallback

  const candidate = value.trim()
  if (canonicalPresentations.has(candidate as ContentPresentation)) {
    return candidate as ContentPresentation
  }

  return legacyPresentationMap[candidate] ?? fallback
}
