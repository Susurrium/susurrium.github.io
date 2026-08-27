/**
 * Home media and presentation policy.
 *
 * The six temporary images were downloaded from the locked LargeSkull source
 * (LargeSkull/LargeSkull.github.io@9599a54f23cdfc4606f2f5edc07e8138e050205b)
 * and verified against the hashes recorded in docs/SOURCE_LEDGER.md.
 *
 * Keep the three arrays separate even while they deliberately contain the
 * same development placeholders. They represent three different product
 * contracts and will be replaced independently before publication.
 */

export type ContentKind = 'blog' | 'trace' | 'saying'

export type ContentPresentation =
  | 'arthals-text'
  | 'large-skull-content'
  | 'large-skull-decorative'

export type HomeMediaAsset = {
  key: string
  src: string
  description: string
}

export type ImageSource = 'content' | 'fallback' | 'decorative' | 'none'

export type ResolvedCardImage = {
  key?: string
  src?: string
  alt: string
  decorative: boolean
  source: ImageSource
}

export type ContentImageInput = {
  src: string
  alt?: string
  key?: string
}

const temporaryLargeSkullImages = [
  {
    key: 'ls-01',
    src: '/images/largeskull/hero-01.jpg',
    description: 'LargeSkull temporary image one'
  },
  {
    key: 'ls-02',
    src: '/images/largeskull/hero-02.webp',
    description: 'LargeSkull temporary image two'
  },
  {
    key: 'ls-03',
    src: '/images/largeskull/hero-03.jpg',
    description: 'LargeSkull temporary image three'
  },
  {
    key: 'ls-04',
    src: '/images/largeskull/hero-04.webp',
    description: 'LargeSkull temporary image four'
  },
  {
    key: 'ls-05',
    src: '/images/largeskull/hero-05.webp',
    description: 'LargeSkull temporary image five'
  },
  {
    key: 'ls-06',
    src: '/images/largeskull/hero-06.png',
    description: 'LargeSkull temporary image six'
  }
] as const satisfies readonly HomeMediaAsset[]

// Do not collapse these into aliases of a single array. Their independent
// identity makes the later editorial replacement safe and reviewable.
export const heroSlides: readonly HomeMediaAsset[] = temporaryLargeSkullImages.map((asset) => ({
  ...asset
}))

export const sayingDecorativeImages: readonly HomeMediaAsset[] = temporaryLargeSkullImages.map(
  (asset) => ({ ...asset })
)

export const traceFallbackImages: readonly HomeMediaAsset[] = temporaryLargeSkullImages.map(
  (asset) => ({ ...asset })
)

const defaultPresentations: Record<ContentKind, ContentPresentation> = {
  blog: 'arthals-text',
  trace: 'large-skull-content',
  saying: 'large-skull-decorative'
}

const allPresentations = new Set<ContentPresentation>([
  'arthals-text',
  'large-skull-content',
  'large-skull-decorative'
])

/** Page override > content default > safe Arthals text fallback. */
export function resolvePresentation(
  contentKind: string,
  pageOverride?: string
): ContentPresentation {
  if (pageOverride && allPresentations.has(pageOverride as ContentPresentation)) {
    return pageOverride as ContentPresentation
  }

  return defaultPresentations[contentKind as ContentKind] ?? 'arthals-text'
}

/** A stable FNV-1a hash. Do not use list indexes for Trace fallbacks. */
export function stableContentHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function getSayingDecorativeImage(archiveIndex: number): ResolvedCardImage {
  if (sayingDecorativeImages.length === 0) {
    return { alt: '', decorative: true, source: 'none' }
  }

  const normalizedIndex = Math.max(0, Math.trunc(archiveIndex))
  const asset = sayingDecorativeImages[normalizedIndex % sayingDecorativeImages.length]
  return {
    alt: '',
    decorative: true,
    key: asset.key,
    source: 'decorative',
    src: asset.src
  }
}

export function getTraceCardImage(
  contentId: string,
  cover?: ContentImageInput | null
): ResolvedCardImage {
  if (cover?.src) {
    return {
      alt: cover.alt ?? '',
      decorative: false,
      key: cover.key ?? `content-${contentId}`,
      source: 'content',
      src: cover.src
    }
  }

  if (traceFallbackImages.length === 0) {
    return { alt: '', decorative: true, source: 'none' }
  }

  const asset = traceFallbackImages[stableContentHash(contentId) % traceFallbackImages.length]
  return {
    alt: '',
    decorative: true,
    key: asset.key,
    source: 'fallback',
    src: asset.src
  }
}

/**
 * Select on the client, not in Astro frontmatter: a static build has only one
 * build-time random value. The optional random function makes the behaviour
 * deterministic in tests while preserving a fresh pick on every visit.
 */
export function selectRandom<T>(items: readonly T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined

  const value = random()
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0
  return items[Math.floor(normalized * items.length)]
}

export function takeRecent<T>(items: readonly T[], limit = 3): T[] {
  return items.slice(0, Math.max(0, limit))
}
