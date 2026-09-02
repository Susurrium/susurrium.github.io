/**
 * Home media and presentation policy.
 *
 * This is the local editorial catalogue selected from
 * `E:\UserData\Desktop\blog_image`. All 54 supplied images are converted to
 * WebP under `public/images/home-media/` and intentionally retained, including
 * images with logos, watermarks, text, or visibly different visual styles.
 *
 * Keep the three arrays independent: Hero has a fixed six-image sequence,
 * Saying has its own decorative rotation, and Trace has its own deterministic
 * no-cover fallback pool. The same local file may appear in more than one
 * contract when that is part of the editorial plan.
 */

import { getCardCropRuntime } from '@/data/card-crops'
import { normalizeContentPresentation } from '@/lib/compatibility/content-presentation'
import type {
  ContentImageInput,
  ContentKind,
  ContentPresentation,
  ResolvedCardImage
} from '@/lib/content-layer/types'

export type {
  ContentImageInput,
  ContentKind,
  ContentPresentation,
  ImageSource,
  ResolvedCardImage
} from '@/lib/content-layer/types'

export type CardCutSide = 'left' | 'right'

export type HomeMediaAsset = {
  key: string
  src: string
  description: string
  /** Which side owns the diagonal edge in the Media card. */
  cutSide: CardCutSide
}

/**
 * Asset-specific slant decisions. This is deliberately keyed by filename,
 * rather than by archive/index position: the same image must keep the same
 * composition whenever it appears in Saying, Trace, or a random rotation.
 *
 * `right` keeps the image on the left and clips the cover's top-right corner
 * on desktop (bottom-right on mobile). `left` mirrors that treatment: the
 * image sits on the right and the bottom-left corner is clipped on mobile.
 * Choices protect the primary subject, readable marks, and the strongest
 * direction of travel in each source image; they are not an alternating
 * parity rule.
 */
export const cardCutSideByFilename: Readonly<Record<string, CardCutSide>> = {
  '13534647_p0_master1200.webp': 'right',
  '43935854_p0_master1200.webp': 'right',
  '85970602_p0_master1200.webp': 'right',
  'riki32-naruto-7203819.webp': 'right',
  'thumb-1920-1083849.webp': 'right',
  'thumb-1920-1100118.webp': 'left',
  'thumb-1920-1110448.webp': 'right',
  'thumb-1920-1199807.webp': 'right',
  'thumb-1920-1305986.webp': 'left',
  'thumb-1920-1348996.webp': 'left',
  'thumb-1920-1377699.webp': 'right',
  'thumb-1920-1381117.webp': 'right',
  'thumb-1920-206280.webp': 'left',
  'thumb-1920-25430.webp': 'left',
  'thumb-1920-330278.webp': 'left',
  'thumb-1920-411820.webp': 'left',
  'thumb-1920-432644.webp': 'right',
  'thumb-1920-444982.webp': 'right',
  'thumb-1920-476288.webp': 'right',
  'thumb-1920-484717.webp': 'right',
  'thumb-1920-556375.webp': 'left',
  'thumb-1920-568874.webp': 'right',
  'thumb-1920-582756.webp': 'left',
  'thumb-1920-608170.webp': 'right',
  'thumb-1920-655989.webp': 'right',
  'thumb-1920-655990.webp': 'left',
  'thumb-1920-672421.webp': 'right',
  'thumb-1920-689823.webp': 'left',
  'thumb-1920-695454.webp': 'left',
  'thumb-1920-704042.webp': 'left',
  'thumb-1920-704341.webp': 'right',
  'thumb-1920-704565.webp': 'right',
  'thumb-1920-705101.webp': 'left',
  'thumb-1920-705691.webp': 'right',
  'thumb-1920-710137.webp': 'left',
  'thumb-1920-719184.webp': 'left',
  'thumb-1920-723809.webp': 'left',
  'thumb-1920-725406.webp': 'left',
  'thumb-1920-729590.webp': 'right',
  'thumb-1920-76071.webp': 'right',
  'thumb-1920-769914.webp': 'left',
  'thumb-1920-806818.webp': 'left',
  'thumb-1920-83606.webp': 'left',
  'thumb-1920-888035.webp': 'right',
  'thumb-1920-893435.webp': 'left',
  'thumb-1920-905838.webp': 'right',
  'thumb-1920-916541.webp': 'right',
  'thumb-1920-919724.webp': 'right',
  'thumb-1920-919958.webp': 'left',
  'thumb-1920-920085.webp': 'left',
  'thumb-1920-934905.webp': 'right',
  'thumb-1920-939173.webp': 'left',
  'thumb-1920-949729.webp': 'left',
  'thumb-1920-986446.webp': 'left'
}

const localAsset = (key: string, filename: string, description: string): HomeMediaAsset => ({
  key,
  src: `/images/home-media/${filename}`,
  description,
  cutSide: cardCutSideByFilename[filename] ?? 'right'
})

// Fixed editorial order: dark cinematic opener → gold fantasy → pink/blue dusk
// → cool blue/pink reader → group action → Tracer climax.
export const heroSlides: readonly HomeMediaAsset[] = [
  localAsset(
    'hero-01',
    'thumb-1920-1381117.webp',
    'Ruined elevated city at sunset with a lone swordswoman'
  ),
  localAsset(
    'hero-02',
    '43935854_p0_master1200.webp',
    'Ornate celestial fantasy portrait with luminous ribbons'
  ),
  localAsset(
    'hero-03',
    'thumb-1920-949729.webp',
    'Pink and blue dusk sky with a floating anime character'
  ),
  localAsset(
    'hero-04',
    'thumb-1920-725406.webp',
    'Blue and pink interior scene with a seated reader'
  ),
  localAsset(
    'hero-05',
    'thumb-1920-986446.webp',
    'Three stylized characters viewed against a cloud-filled sky'
  ),
  localAsset(
    'hero-06',
    'thumb-1920-556375.webp',
    'Tracer launching through a vivid orange and blue action scene'
  )
]

// Decorative Saying pool. Keep every selected image, including intentional
// logos, watermarks, and text; visual variety is part of the design.
export const sayingDecorativeImages: readonly HomeMediaAsset[] = [
  localAsset(
    'saying-01',
    '43935854_p0_master1200.webp',
    'Ornate celestial fantasy portrait with luminous ribbons'
  ),
  localAsset('saying-02', 'riki32-naruto-7203819.webp', 'Naruto-inspired character illustration'),
  localAsset('saying-03', 'thumb-1920-1083849.webp', 'Illustrated character scene'),
  localAsset('saying-04', 'thumb-1920-1100118.webp', 'Stylized anime illustration'),
  localAsset('saying-05', 'thumb-1920-1199807.webp', 'Character-focused illustration'),
  localAsset('saying-06', 'thumb-1920-1348996.webp', 'Colorful illustrated scene'),
  localAsset('saying-07', 'thumb-1920-1377699.webp', 'Stylized character artwork'),
  localAsset('saying-08', 'thumb-1920-206280.webp', 'Graphic character artwork'),
  localAsset('saying-09', 'thumb-1920-432644.webp', 'Illustrated fantasy scene'),
  localAsset('saying-10', 'thumb-1920-556375.webp', 'Tracer action artwork with Overwatch mark'),
  localAsset('saying-11', 'thumb-1920-582756.webp', 'Illustrated character composition'),
  localAsset('saying-12', 'thumb-1920-608170.webp', 'Anime-style visual composition'),
  localAsset('saying-13', 'thumb-1920-672421.webp', 'Illustrated fantasy artwork'),
  localAsset('saying-14', 'thumb-1920-689823.webp', 'Character illustration'),
  localAsset('saying-15', 'thumb-1920-695454.webp', 'Tracer flying through a bright action scene'),
  localAsset('saying-16', 'thumb-1920-704042.webp', 'Stylized illustration'),
  localAsset('saying-17', 'thumb-1920-704341.webp', 'Character artwork'),
  localAsset('saying-18', 'thumb-1920-704565.webp', 'Illustrated scene'),
  localAsset('saying-19', 'thumb-1920-705101.webp', 'Character-focused artwork'),
  localAsset('saying-20', 'thumb-1920-705691.webp', 'Colorful illustrated composition'),
  localAsset('saying-21', 'thumb-1920-710137.webp', 'Stylized fantasy illustration'),
  localAsset('saying-22', 'thumb-1920-723809.webp', 'Illustrated character scene'),
  localAsset('saying-23', 'thumb-1920-725406.webp', 'Graphic illustration'),
  localAsset('saying-24', 'thumb-1920-769914.webp', 'Character artwork'),
  localAsset('saying-25', 'thumb-1920-806818.webp', 'Illustrated fantasy scene'),
  localAsset('saying-26', 'thumb-1920-888035.webp', 'Traveler in a bright meadow'),
  localAsset('saying-27', 'thumb-1920-893435.webp', 'Anime-inspired illustration'),
  localAsset('saying-28', 'thumb-1920-905838.webp', 'Stylized character artwork'),
  localAsset('saying-29', 'thumb-1920-916541.webp', 'Illustrated scene'),
  localAsset('saying-30', 'thumb-1920-919724.webp', 'Character composition'),
  localAsset('saying-31', 'thumb-1920-919958.webp', 'Fantasy artwork'),
  localAsset('saying-32', 'thumb-1920-939173.webp', 'Illustrated character scene'),
  localAsset('saying-33', 'thumb-1920-949729.webp', 'Dusk-sky character artwork'),
  localAsset('saying-34', 'thumb-1920-986446.webp', 'Three-character sky composition')
]

// No-image Trace fallback pool. This deliberately has a separate identity and
// order from the Saying pool so stable ID hashing remains independently tunable.
export const traceFallbackImages: readonly HomeMediaAsset[] = [
  localAsset('trace-01', '13534647_p0_master1200.webp', 'Atmospheric illustrated environment'),
  localAsset('trace-02', '85970602_p0_master1200.webp', 'Scenic fantasy artwork'),
  localAsset('trace-03', 'thumb-1920-1110448.webp', 'Landscape illustration'),
  localAsset('trace-04', 'thumb-1920-1305986.webp', 'Atmospheric scene'),
  localAsset('trace-05', 'thumb-1920-1381117.webp', 'Ruined elevated city at sunset'),
  localAsset('trace-06', 'thumb-1920-25430.webp', 'Scenic illustrated background'),
  localAsset('trace-07', 'thumb-1920-330278.webp', 'Landscape artwork'),
  localAsset('trace-08', 'thumb-1920-411820.webp', 'Atmospheric environment'),
  localAsset('trace-09', 'thumb-1920-444982.webp', 'Scenic background illustration'),
  localAsset('trace-10', 'thumb-1920-476288.webp', 'Illustrated environment'),
  localAsset('trace-11', 'thumb-1920-484717.webp', 'Landscape scene'),
  localAsset('trace-12', 'thumb-1920-568874.webp', 'Atmospheric illustrated scene'),
  localAsset('trace-13', 'thumb-1920-655989.webp', 'Wide scenic artwork'),
  localAsset('trace-14', 'thumb-1920-655990.webp', 'Illustrated environment'),
  localAsset('trace-15', 'thumb-1920-719184.webp', 'Landscape illustration'),
  localAsset('trace-16', 'thumb-1920-729590.webp', 'Atmospheric scene'),
  localAsset('trace-17', 'thumb-1920-76071.webp', 'Scenic background'),
  localAsset('trace-18', 'thumb-1920-83606.webp', 'Illustrated environment'),
  localAsset('trace-19', 'thumb-1920-920085.webp', 'Landscape artwork'),
  localAsset('trace-20', 'thumb-1920-934905.webp', 'Atmospheric scenic illustration')
]

const defaultPresentations: Record<ContentKind, ContentPresentation> = {
  blog: 'text',
  trace: 'media-content',
  saying: 'media-decorative'
}

/** Page override > content default > safe text fallback. */
export function resolvePresentation(
  contentKind: string,
  pageOverride?: string
): ContentPresentation {
  const fallback = defaultPresentations[contentKind as ContentKind] ?? 'text'
  return normalizeContentPresentation(pageOverride, fallback)
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

/**
 * Resolve the fixed slant for either a catalogue asset or a projected card
 * image. Non-catalogue content covers intentionally use the conservative
 * right-side treatment until an editor adds a filename-specific decision.
 */
export function getCardCutSide(
  image?: {
    readonly src?: string
    readonly cutSide?: CardCutSide
    readonly crop?: { readonly frame?: 'diagonal-left' | 'diagonal-right' }
  } | null
): CardCutSide {
  if (image?.crop?.frame) return image.crop.frame === 'diagonal-left' ? 'left' : 'right'
  if (image?.cutSide) return image.cutSide

  const filename = image?.src?.split(/[/?#]/).pop()
  return filename && cardCutSideByFilename[filename] ? cardCutSideByFilename[filename] : 'right'
}

export function getSayingDecorativeImage(archiveIndex: number): ResolvedCardImage {
  if (sayingDecorativeImages.length === 0) {
    return { alt: '', decorative: true, source: 'none' }
  }

  const normalizedIndex = Math.max(0, Math.trunc(archiveIndex))
  const asset = sayingDecorativeImages[normalizedIndex % sayingDecorativeImages.length]
  const crop = getCardCropRuntime(asset.src)
  return {
    alt: '',
    decorative: true,
    key: asset.key,
    source: 'decorative',
    src: asset.src,
    ...(crop ? { crop } : {})
  }
}

export function getTraceCardImage(
  contentId: string,
  cover?: ContentImageInput | null
): ResolvedCardImage {
  if (cover?.src) {
    const crop = getCardCropRuntime(cover.src)
    return {
      alt: cover.alt ?? '',
      decorative: false,
      key: cover.key ?? `content-${contentId}`,
      source: 'content',
      src: cover.src,
      ...(crop ? { crop } : {})
    }
  }

  if (traceFallbackImages.length === 0) {
    return { alt: '', decorative: true, source: 'none' }
  }

  const asset = traceFallbackImages[stableContentHash(contentId) % traceFallbackImages.length]
  const crop = getCardCropRuntime(asset.src)
  return {
    alt: '',
    decorative: true,
    key: asset.key,
    source: 'fallback',
    src: asset.src,
    ...(crop ? { crop } : {})
  }
}

/**
 * Select on the client, not in Astro frontmatter: a static build has only one
 * build-time random value. The optional random function makes the behaviour
 * deterministic in tests while preserving a fresh pick on every visit.
 */
export function selectRandom<T>(
  items: readonly T[],
  random: () => number = Math.random
): T | undefined {
  if (items.length === 0) return undefined

  const value = random()
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0
  return items[Math.floor(normalized * items.length)]
}

export function takeRecent<T>(items: readonly T[], limit = 3): T[] {
  return items.slice(0, Math.max(0, limit))
}
