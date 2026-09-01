/**
 * Hero uses a focal transform, not the card's diagonal-frame contract.
 * Values are normalized percentages so the same decision survives a viewport
 * resize; desktop and mobile may intentionally have different focal points.
 */
export const HERO_CROP_SCHEMA_VERSION = 1 as const

export type HeroCropViewport = 'desktop' | 'mobile'

export interface HeroCropTransform {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export interface HeroCropRecord {
  readonly filename: string
  readonly desktop: HeroCropTransform
  readonly mobile: HeroCropTransform
  readonly updatedAt?: string
  readonly schemaVersion: typeof HERO_CROP_SCHEMA_VERSION
}

export const DEFAULT_HERO_CROP_TRANSFORM: HeroCropTransform = Object.freeze({
  x: 50,
  y: 50,
  zoom: 1
})

export const clampHeroCropNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const normalizeHeroCropTransform = (
  value: Partial<HeroCropTransform> | null | undefined
): HeroCropTransform => ({
  x: clampHeroCropNumber(Number.isFinite(value?.x) ? Number(value?.x) : 50, 0, 100),
  y: clampHeroCropNumber(Number.isFinite(value?.y) ? Number(value?.y) : 50, 0, 100),
  zoom: clampHeroCropNumber(Number.isFinite(value?.zoom) ? Number(value?.zoom) : 1, 1, 4)
})
