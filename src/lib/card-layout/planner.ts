import { getCardCropRecord, getCardCropRuntime } from '@/data/card-crops'
import type { HomeMediaAsset } from '@/data/home-media'
import {
  DEFAULT_CARD_CROP_TRANSFORM,
  frameForImageSide,
  layoutVariantForFrame
} from '@/lib/card-crop/types'

import { splitAlternatingQueues } from './alternating'
import type { CardImageAssignment } from './types'

export type MediaPlanningPolicy =
  | { readonly enabled: false }
  | {
      readonly enabled: true
      readonly source: 'cover-or-pool' | 'pool'
      readonly pool: string
      readonly sort: 'publish-date-desc' | 'id-asc'
      readonly layout: 'alternating'
      readonly scope: 'public-kind'
      readonly poolSource: 'fallback' | 'decorative'
    }

/** 只依赖适配后的公共字段，新增静态类型可直接提供策略。 */
export interface MediaPlanningRecord {
  readonly key: string
  readonly kind: string
  readonly title: string
  readonly draft: boolean
  readonly publishedAt?: Date
  readonly image?: { readonly key?: string; readonly src: string; readonly alt?: string }
}

export function planCardMedia(
  records: readonly MediaPlanningRecord[],
  policies: Readonly<Record<string, MediaPlanningPolicy>>,
  pools: Readonly<Record<string, readonly HomeMediaAsset[]>>
): ReadonlyMap<string, CardImageAssignment> {
  const result = new Map<string, CardImageAssignment>()
  for (const kind of new Set(
    records.filter((record) => !record.draft).map((record) => record.kind)
  )) {
    const policy = policies[kind]
    if (!policy) throw new Error(`Missing media policy for ${kind}`)
    if (!policy.enabled) continue
    const ordered = records
      .filter((record) => record.kind === kind && !record.draft)
      .sort(
        (a, b) =>
          (policy.sort === 'publish-date-desc'
            ? (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
            : 0) || a.key.localeCompare(b.key)
      )
    const needsPool = ordered.some((record) => policy.source === 'pool' || !record.image)
    const pool = pools[policy.pool]
    if (needsPool && !pool) throw new Error(`Missing media pool ${policy.pool} for ${kind}`)
    // 指定封面仍占用完整序列的槽位，备用图库保持原有按槽位分配的顺序。
    const queues = needsPool ? splitAlternatingQueues(pool!) : undefined
    const occurrences = new Map<string, number>()
    ordered.forEach((record, index) => {
      const imageSide = index % 2 === 0 ? 'left' : 'right'
      const frame = frameForImageSide(imageSide)
      const cover = policy.source === 'cover-or-pool' ? record.image : undefined
      let assignment: CardImageAssignment
      if (cover) {
        const key = cover.key ?? `content-${record.key}`
        const stableCropKey = `${encodeURIComponent(key)}.webp`
        const cropKey = getCardCropRecord(stableCropKey) ? stableCropKey : cover.src
        let crop
        try {
          crop = getCardCropRuntime(cropKey, frame)
        } catch (error) {
          throw new Error(
            `Media conflict for ${record.key} (${record.title}), image ${key} (${cover.src}): target ${imageSide}/${frame}. ${error instanceof Error ? error.message : String(error)}`
          )
        }
        assignment = {
          alt: cover.alt ?? '',
          assetDescription: cover.alt ?? '',
          decorative: false,
          crop: crop ?? { fit: 'cover', frame, transform: DEFAULT_CARD_CROP_TRANSFORM },
          frame,
          imageSide,
          key,
          layoutVariant: layoutVariantForFrame(frame),
          occurrence: 1,
          repeated: false,
          source: 'content',
          src: cover.src
        }
      } else {
        const queue = queues![imageSide]
        const candidate = queue[Math.floor(index / 2) % queue.length]
        if (!candidate)
          throw new Error(
            `Missing ${imageSide} media pool candidate for ${record.key} at slot ${index}`
          )
        assignment = {
          alt: '',
          assetDescription: candidate.asset.description,
          decorative: true,
          crop: candidate.crop,
          frame: candidate.frame,
          imageSide: candidate.imageSide,
          key: candidate.asset.key,
          layoutVariant: candidate.layoutVariant,
          occurrence: 1,
          repeated: false,
          source: policy.poolSource,
          src: candidate.asset.src
        }
      }
      const occurrence = (occurrences.get(assignment.key) ?? 0) + 1
      occurrences.set(assignment.key, occurrence)
      if (result.has(record.key)) throw new Error(`Duplicate media content key ${record.key}`)
      result.set(record.key, { ...assignment, occurrence, repeated: occurrence > 1 })
    })
  }
  return result
}
