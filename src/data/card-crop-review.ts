/**
 * Local, editor-facing catalogue for reviewing the image crop used by the
 * Media cards.
 *
 * This is intentionally separate from the production frame policy in
 * `home-media.ts`. The card's diagonal and its desktop image side are one
 * atomic layout choice; the side retained from the source image is a separate
 * focal-position choice. The review tool must be able to record both frames
 * being acceptable, or neither frame being acceptable, without silently
 * forcing a focal crop.
 */
import {
  sayingDecorativeImages,
  traceFallbackImages,
  type CardCutSide,
  type HomeMediaAsset
} from '@/data/home-media'

export type CardCropUsage = 'saying' | 'trace'

/** The side of the source image that remains visible for a cover crop. */
export type CardCropKeepSide = 'left' | 'right'

/** The four conclusions an editor can make during the side-by-side review. */
export type CardCropVerdict = 'left' | 'right' | 'both' | 'neither'

/** A concrete follow-up after a verdict has been recorded. */
export type CardCropResolution = 'left' | 'right' | 'center' | 'custom' | 'contain' | 'replace'

export interface CardCropPosition {
  readonly x: number
  readonly y: number
}

export interface CardCropDecision {
  /** `left` means retain the left side and discard the right side. */
  readonly verdict: CardCropVerdict
  /** Optional concrete mode used while the decision is still a draft. */
  readonly resolution?: CardCropResolution
  /** Only used by the `custom` resolution; values are percentages. */
  readonly position?: CardCropPosition
  readonly updatedAt?: string
}

export interface CardCropReviewItem {
  /** Stable review key. It includes the usage so reused files can diverge. */
  readonly id: string
  readonly usage: CardCropUsage
  readonly usageLabel: string
  readonly ordinal: number
  readonly assetKey: string
  readonly filename: string
  readonly src: string
  readonly description: string
  /** Current frame policy, shown as a reference; its image side is implied. */
  readonly diagonalSide: CardCutSide
}

export const cardCropReviewStorageKey = 'susurrium:card-crop-review:v1'

export const cardCropPositionByResolution: Readonly<
  Record<Exclude<CardCropResolution, 'custom' | 'contain' | 'replace'>, string>
> = {
  left: '0% 50%',
  right: '100% 50%',
  center: '50% 50%'
}

const filenameFromSrc = (src: string): string => src.split(/[/?#]/).pop() ?? src

const makeReviewItem = (
  usage: CardCropUsage,
  usageLabel: string,
  ordinal: number,
  asset: HomeMediaAsset
): CardCropReviewItem => ({
  id: `${usage}:${filenameFromSrc(asset.src)}`,
  usage,
  usageLabel,
  ordinal,
  assetKey: asset.key,
  filename: filenameFromSrc(asset.src),
  src: asset.src,
  description: asset.description,
  diagonalSide: asset.cutSide
})

/**
 * One row per actual card usage.  Hero assets are deliberately excluded:
 * Hero is a full-bleed background and does not use the card crop contract.
 */
export const cardCropReviewItems: readonly CardCropReviewItem[] = [
  ...sayingDecorativeImages.map((asset, index) =>
    makeReviewItem('saying', 'Saying 装饰图', index + 1, asset)
  ),
  ...traceFallbackImages.map((asset, index) =>
    makeReviewItem('trace', 'Trace 无图回退', index + 1, asset)
  )
]

export const cardCropReviewItemCount = cardCropReviewItems.length

export const getCropPosition = (resolution: CardCropResolution): string => {
  if (resolution === 'custom' || resolution === 'contain' || resolution === 'replace') {
    return cardCropPositionByResolution.center
  }

  return cardCropPositionByResolution[resolution]
}

export const isCardCropVerdict = (value: unknown): value is CardCropVerdict =>
  value === 'left' || value === 'right' || value === 'both' || value === 'neither'

export const isCardCropResolution = (value: unknown): value is CardCropResolution =>
  value === 'left' ||
  value === 'right' ||
  value === 'center' ||
  value === 'custom' ||
  value === 'contain' ||
  value === 'replace'
