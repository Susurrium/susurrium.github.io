/**
 * Shared contract for the card-crop workbench and the production card.
 *
 * The editor deliberately stores a focal transform instead of a pixel
 * rectangle.  A focal transform survives responsive resizing while still
 * describing the exact operation the editor performs: cover the fixed frame,
 * then pan and zoom the source image underneath it.
 */

export const CARD_CROP_SCHEMA_VERSION = 2 as const

/**
 * The profile represented by the current editor/export contract.  It is
 * deliberately named instead of inferred from a route so a future Home or
 * mobile exception has to be explicit in data rather than silently changing
 * the archive card output.
 */
export const CARD_CROP_PROFILE = 'archive-card' as const
export type CardCropProfile = typeof CARD_CROP_PROFILE

/** The canonical horizontal Media media frame (640 × 448). */
export const CARD_CROP_FRAME_WIDTH = 640 as const
export const CARD_CROP_FRAME_HEIGHT = 448 as const
export const CARD_CROP_FRAME_RATIO = CARD_CROP_FRAME_WIDTH / CARD_CROP_FRAME_HEIGHT

export type CardCropFrame = 'diagonal-left' | 'diagonal-right'
export type CardCropSelection = CardCropFrame | 'both' | 'neither'
export type CardCropFit = 'cover' | 'contain'

/**
 * The visual side of the media region on a desktop Media card.
 *
 * This is intentionally separate from `CardCropFrame`: a frame describes
 * where the diagonal edge is drawn, while this type describes where the
 * complete media region is placed in the card. The conversion helpers below
 * are the only legal bridge between the two concepts.
 */
export type CardImageSide = 'left' | 'right'

/**
 * The two valid desktop card compositions. A diagonal and its media side are
 * one atomic choice; callers must not combine them independently.
 */
export type CardLayoutVariant = 'image-left-diagonal-right' | 'image-right-diagonal-left'

/** Percentages are 0–100; zoom is a cover multiplier and is always ≥ 1. */
export interface CardCropTransform {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

/** A source-relative crop rectangle derived from a transform. */
export interface NormalizedCropRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Runtime data consumed by MediaCard. */
export interface CardCropRuntime {
  readonly frame: CardCropFrame
  readonly fit: CardCropFit
  readonly transform: CardCropTransform
  readonly cropRect?: NormalizedCropRect
}

/** One confirmed (or intentionally unresolved) source asset decision. */
export interface CardCropRecord {
  readonly filename: string
  readonly selection: CardCropSelection
  readonly preferredFrame?: CardCropFrame
  readonly fit: CardCropFit
  readonly transforms: Readonly<Record<CardCropFrame, CardCropTransform>>
  readonly cropRects?: Readonly<Record<CardCropFrame, NormalizedCropRect>>
  readonly updatedAt?: string
  readonly schemaVersion: typeof CARD_CROP_SCHEMA_VERSION
}

export const DEFAULT_CARD_CROP_TRANSFORM: CardCropTransform = Object.freeze({
  x: 50,
  y: 50,
  zoom: 1
})

export const DEFAULT_CARD_CROP_FRAME: CardCropFrame = 'diagonal-right'

export const clampCropNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const normalizeCropTransform = (
  value: Partial<CardCropTransform> | null | undefined
): CardCropTransform => ({
  x: clampCropNumber(Number.isFinite(value?.x) ? Number(value?.x) : 50, 0, 100),
  y: clampCropNumber(Number.isFinite(value?.y) ? Number(value?.y) : 50, 0, 100),
  zoom: clampCropNumber(Number.isFinite(value?.zoom) ? Number(value?.zoom) : 1, 1, 4)
})

/**
 * Convert the editor's percentages into a source-relative rectangle.  This is
 * useful when exporting deterministic derivatives with Sharp, and gives the
 * production layer a resolution-independent representation of the decision.
 */
export const cropRectFromTransform = (
  sourceWidth: number,
  sourceHeight: number,
  transform: CardCropTransform,
  frameRatio = CARD_CROP_FRAME_RATIO
): NormalizedCropRect => {
  const width = Math.max(1, Number(sourceWidth) || 1)
  const height = Math.max(1, Number(sourceHeight) || 1)
  const ratio = Math.max(0.01, Number(frameRatio) || CARD_CROP_FRAME_RATIO)
  const sourceRatio = width / height

  // The unzoomed cover crop is the largest source rectangle with the frame's
  // aspect ratio. Zoom reduces that rectangle around the chosen focal point.
  const coverWidth = sourceRatio >= ratio ? height * ratio : width
  const coverHeight = sourceRatio >= ratio ? height : width / ratio
  const normalized = normalizeCropTransform(transform)
  const cropWidth = Math.min(width, coverWidth / normalized.zoom)
  const cropHeight = Math.min(height, coverHeight / normalized.zoom)
  const availableX = Math.max(0, width - cropWidth)
  const availableY = Math.max(0, height - cropHeight)

  return {
    height: cropHeight / height,
    width: cropWidth / width,
    x: (availableX * (normalized.x / 100)) / width,
    y: (availableY * (normalized.y / 100)) / height
  }
}

export const frameForCutSide = (side: 'left' | 'right'): CardCropFrame =>
  side === 'left' ? 'diagonal-left' : 'diagonal-right'

export const cutSideForFrame = (frame: CardCropFrame): 'left' | 'right' =>
  frame === 'diagonal-left' ? 'left' : 'right'

/** Convert the authoritative diagonal frame into the media side it implies. */
export const imageSideForFrame = (frame: CardCropFrame): CardImageSide =>
  frame === 'diagonal-left' ? 'right' : 'left'

/** Convert a media side into its only valid diagonal frame. */
export const frameForImageSide = (side: CardImageSide): CardCropFrame =>
  side === 'right' ? 'diagonal-left' : 'diagonal-right'

/** Return the atomic layout name used by queue assignments and diagnostics. */
export const layoutVariantForFrame = (frame: CardCropFrame): CardLayoutVariant =>
  frame === 'diagonal-left' ? 'image-right-diagonal-left' : 'image-left-diagonal-right'
