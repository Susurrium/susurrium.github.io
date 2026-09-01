import type {
  CardCropFrame,
  CardCropRuntime,
  CardImageSide,
  CardLayoutVariant
} from '@/lib/card-crop/types'

/**
 * One explicit image choice made by the alternating archive planner.
 *
 * The assignment carries the already-resolved crop frame so a card renderer
 * never has to infer a diagonal from an archive index or from CSS parity.
 */
export interface CardImageAssignment {
  readonly alt: string
  readonly assetDescription: string
  readonly crop: CardCropRuntime
  readonly frame: CardCropFrame
  readonly imageSide: CardImageSide
  readonly key: string
  readonly layoutVariant: CardLayoutVariant
  readonly occurrence: number
  readonly repeated: boolean
  readonly source: 'decorative' | 'fallback'
  readonly src: string
}
