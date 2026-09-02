import { getCardCropRuntime } from '@/data/card-crops'
import type { HomeMediaAsset } from '@/data/home-media'
import {
  DEFAULT_CARD_CROP_TRANSFORM,
  frameForCutSide,
  imageSideForFrame,
  layoutVariantForFrame,
  type CardCropRuntime,
  type CardImageSide
} from '@/lib/card-crop/types'

import type { CardImageAssignment } from './types'

export type CardImageQueueSide = CardImageSide

export interface AlternatingQueueOptions {
  /** The side used by the first card. The archive baseline starts on the left. */
  readonly startSide?: CardImageQueueSide
  readonly source: CardImageAssignment['source']
}

export interface ResolvedQueueAsset {
  readonly asset: HomeMediaAsset
  readonly crop: CardCropRuntime
  readonly frame: CardImageAssignment['frame']
  readonly imageSide: CardImageQueueSide
  readonly layoutVariant: CardImageAssignment['layoutVariant']
}

const oppositeSide = (side: CardImageQueueSide): CardImageQueueSide =>
  side === 'left' ? 'right' : 'left'

/**
 * Resolve one catalogue asset into its atomic layout variant.
 *
 * A confirmed editor frame is authoritative. For an asset without a
 * confirmed record, the legacy filename decision is converted through the
 * same frame mapping, so even the fallback path cannot create an invalid
 * image/diagonal combination.
 */
export function resolveQueueAsset(asset: HomeMediaAsset): ResolvedQueueAsset {
  const configuredCrop = getCardCropRuntime(asset.src)
  const frame = configuredCrop?.frame ?? frameForCutSide(asset.cutSide)
  const crop: CardCropRuntime = configuredCrop ?? {
    fit: 'cover',
    frame,
    transform: DEFAULT_CARD_CROP_TRANSFORM
  }

  return {
    asset,
    crop,
    frame,
    imageSide: imageSideForFrame(frame),
    layoutVariant: layoutVariantForFrame(frame)
  }
}

/** Split the catalogue into the two fixed visual-side queues. */
export function splitAlternatingQueues(assets: readonly HomeMediaAsset[]): {
  readonly left: readonly ResolvedQueueAsset[]
  readonly right: readonly ResolvedQueueAsset[]
} {
  const resolved = assets.map(resolveQueueAsset)
  return {
    left: resolved.filter(({ imageSide }) => imageSide === 'left'),
    right: resolved.filter(({ imageSide }) => imageSide === 'right')
  }
}

/**
 * The shortest possible even sequence that shows every asset at least once
 * while keeping strict left/right alternation.
 */
export function minimumAlternatingSlots(assets: readonly HomeMediaAsset[]): number {
  const queues = splitAlternatingQueues(assets)
  if (queues.left.length === 0 || queues.right.length === 0) return 0
  return Math.max(queues.left.length, queues.right.length) * 2
}

/**
 * Fill one visual-side queue in stable rounds. Every asset is used once in
 * catalogue order before that queue starts its next round.
 */
function distributeQueue(
  queue: readonly ResolvedQueueAsset[],
  targetLength: number
): readonly ResolvedQueueAsset[] {
  if (targetLength <= 0 || queue.length === 0) return []
  return Array.from({ length: targetLength }, (_, index) => queue[index % queue.length]!)
}

/**
 * Build an explicit, strictly alternating image sequence.
 *
 * The function never flips an asset. The left and right queues cycle
 * independently, each completing a full ordered round before reusing its
 * first asset. The returned `repeated` and `occurrence` fields make every
 * reuse inspectable in development tooling.
 */
export function buildAlternatingCardImageAssignments(
  assets: readonly HomeMediaAsset[],
  count: number,
  options: AlternatingQueueOptions
): readonly CardImageAssignment[] {
  const targetCount = Math.max(0, Math.trunc(Number(count) || 0))
  if (targetCount === 0) return []

  const queues = splitAlternatingQueues(assets)
  if (queues.left.length === 0 || queues.right.length === 0) {
    throw new Error(
      'Strict card alternation requires at least one fixed asset on each visual side.'
    )
  }

  const startSide = options.startSide ?? 'left'
  const sideSlots = {
    left: Array.from({ length: targetCount }, (_, index) => {
      const side = index % 2 === 0 ? startSide : oppositeSide(startSide)
      return side === 'left' ? index : undefined
    }).filter((index): index is number => index !== undefined),
    right: Array.from({ length: targetCount }, (_, index) => {
      const side = index % 2 === 0 ? startSide : oppositeSide(startSide)
      return side === 'right' ? index : undefined
    }).filter((index): index is number => index !== undefined)
  }
  const expanded = {
    left: distributeQueue(queues.left, sideSlots.left.length),
    right: distributeQueue(queues.right, sideSlots.right.length)
  }
  const cursor = { left: 0, right: 0 }
  const occurrences = new Map<string, number>()

  return Array.from({ length: targetCount }, (_, index) => {
    const side: CardImageQueueSide = index % 2 === 0 ? startSide : oppositeSide(startSide)
    const queue = expanded[side]
    const queueIndex = cursor[side]++
    const resolved = queue[queueIndex]
    if (!resolved) throw new Error(`Unable to build card image assignment at slot ${index}.`)

    const key = resolved.asset.key
    const occurrence = (occurrences.get(key) ?? 0) + 1
    occurrences.set(key, occurrence)

    return {
      alt: '',
      assetDescription: resolved.asset.description,
      crop: resolved.crop,
      frame: resolved.frame,
      imageSide: resolved.imageSide,
      key,
      layoutVariant: resolved.layoutVariant,
      occurrence,
      repeated: occurrence > 1,
      source: options.source,
      src: resolved.asset.src
    }
  })
}
