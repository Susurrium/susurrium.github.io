/**
 * Production bridge for decisions made in the local card-crop workbench.
 *
 * Only records explicitly confirmed in the workbench are present in the
 * generated map.  The workbench export is applied with
 * `scripts/apply-card-crops.mjs`; absent, pending, and `neither` records keep
 * the existing asset-specific diagonal and centered-cover fallback.
 */
import { cardCropSelectionsGenerated } from '@/data/card-crop-selections.generated'
import {
  CARD_CROP_PROFILE,
  CARD_CROP_SCHEMA_VERSION,
  DEFAULT_CARD_CROP_TRANSFORM,
  normalizeCropTransform,
  type CardCropFrame,
  type CardCropRecord,
  type CardCropRuntime,
  type CardCropTransform,
  type NormalizedCropRect
} from '@/lib/card-crop/types'

export {
  CARD_CROP_PROFILE,
  CARD_CROP_FRAME_HEIGHT,
  CARD_CROP_FRAME_RATIO,
  CARD_CROP_FRAME_WIDTH,
  CARD_CROP_SCHEMA_VERSION,
  cropRectFromTransform,
  cutSideForFrame,
  frameForImageSide,
  frameForCutSide,
  imageSideForFrame,
  layoutVariantForFrame,
  normalizeCropTransform
} from '@/lib/card-crop/types'
export type {
  CardCropProfile,
  CardCropFit,
  CardCropFrame,
  CardImageSide,
  CardLayoutVariant,
  CardCropRecord,
  CardCropRuntime,
  CardCropSelection,
  CardCropTransform,
  NormalizedCropRect
} from '@/lib/card-crop/types'

/** The localStorage namespace used by the browser workbench. */
export const cardCropEditorStorageKey = 'susurrium:card-crop-editor:v2'

/**
 * Machine-readable scope of the shared crop contract.  Archive Saying and
 * Trace cards are the acceptance baseline; Home is an auxiliary consumer
 * with a different outer layout.  A future scene-specific exception must be
 * represented explicitly rather than inferred from an index or route.
 */
export const cardCropPolicy = Object.freeze({
  profile: CARD_CROP_PROFILE,
  primaryScenes: ['sayings', 'traces'] as const,
  auxiliaryScenes: ['home'] as const,
  mobileFocus: 'same-transform' as const,
  sceneOverrides: 'explicit-only' as const,
  cropRects: 'reference-only' as const
})

/**
 * Generated/curated decisions. Keep this object small and reviewable; the
 * source image itself remains in `public/images/home-media`.
 */
export const cardCropSelections: Readonly<Record<string, CardCropRecord>> =
  cardCropSelectionsGenerated

const basename = (value: string): string => value.split(/[/?#]/).pop() ?? value

const isFrame = (value: unknown): value is CardCropFrame =>
  value === 'diagonal-left' || value === 'diagonal-right'

const normalizeCropRect = (value: unknown): NormalizedCropRect | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  const numberOrUndefined = (entry: unknown): number | undefined => {
    const number = Number(entry)
    return Number.isFinite(number) ? number : undefined
  }
  const x = numberOrUndefined(candidate.x)
  const y = numberOrUndefined(candidate.y)
  const width = numberOrUndefined(candidate.width)
  const height = numberOrUndefined(candidate.height)
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return undefined
  }

  const normalizedWidth = Math.min(1, Math.max(0, width))
  const normalizedHeight = Math.min(1, Math.max(0, height))
  return {
    x: Math.min(1 - normalizedWidth, Math.max(0, x)),
    y: Math.min(1 - normalizedHeight, Math.max(0, y)),
    width: normalizedWidth,
    height: normalizedHeight
  }
}

/** Safely retrieve a confirmed crop for a source URL or filename. */
export function getCardCropRecord(sourceOrFilename?: string | null): CardCropRecord | undefined {
  if (!sourceOrFilename) return undefined
  return cardCropSelections[basename(sourceOrFilename)]
}

/**
 * Turn a record into the small runtime payload used by a card. `neither` is
 * intentionally not emitted: an unresolved asset must use the safe legacy
 * fallback rather than silently disappearing from the page.
 */
export function getCardCropRuntime(sourceOrFilename?: string | null): CardCropRuntime | undefined {
  const record = getCardCropRecord(sourceOrFilename)
  if (!record) return undefined

  const selectedFrame = isFrame(record.selection)
    ? record.selection
    : record.selection === 'both'
      ? (record.preferredFrame ?? 'diagonal-right')
      : undefined
  if (!selectedFrame) return undefined

  return {
    fit: record.fit,
    frame: selectedFrame,
    transform: normalizeCropTransform(
      record.transforms[selectedFrame] ?? DEFAULT_CARD_CROP_TRANSFORM
    ),
    cropRect: record.cropRects?.[selectedFrame]
  }
}

/** Build a valid record from untrusted exported JSON before applying it. */
export function normalizeCardCropRecord(
  filename: string,
  value: Partial<CardCropRecord> | null | undefined
): CardCropRecord | undefined {
  if (!value || typeof value !== 'object') return undefined
  const selection = value.selection
  if (
    selection !== 'diagonal-left' &&
    selection !== 'diagonal-right' &&
    selection !== 'both' &&
    selection !== 'neither'
  ) {
    return undefined
  }

  const transforms: Partial<Record<CardCropFrame, Partial<CardCropTransform>>> =
    value.transforms ?? {}
  const rawCropRects = value.cropRects
  const cropRects =
    rawCropRects && typeof rawCropRects === 'object'
      ? {
          'diagonal-left': normalizeCropRect(
            (rawCropRects as Record<string, unknown>)['diagonal-left']
          ),
          'diagonal-right': normalizeCropRect(
            (rawCropRects as Record<string, unknown>)['diagonal-right']
          )
        }
      : undefined
  const hasCompleteCropRects = Boolean(
    cropRects?.['diagonal-left'] && cropRects?.['diagonal-right']
  )
  return {
    filename: basename(filename),
    fit: value.fit === 'contain' ? 'contain' : 'cover',
    preferredFrame: isFrame(value.preferredFrame) ? value.preferredFrame : undefined,
    schemaVersion: CARD_CROP_SCHEMA_VERSION,
    selection,
    transforms: {
      'diagonal-left': normalizeCropTransform(transforms['diagonal-left']),
      'diagonal-right': normalizeCropTransform(transforms['diagonal-right'])
    },
    ...(hasCompleteCropRects
      ? { cropRects: cropRects as Record<CardCropFrame, NormalizedCropRect> }
      : {}),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined
  }
}
