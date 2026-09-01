import { heroCropSelectionsGenerated } from '@/data/hero-crop-selections.generated'
import {
  DEFAULT_HERO_CROP_TRANSFORM,
  HERO_CROP_SCHEMA_VERSION,
  normalizeHeroCropTransform,
  type HeroCropRecord,
  type HeroCropTransform,
  type HeroCropViewport
} from '@/lib/hero-crop/types'

export {
  DEFAULT_HERO_CROP_TRANSFORM,
  HERO_CROP_SCHEMA_VERSION,
  normalizeHeroCropTransform
} from '@/lib/hero-crop/types'
export type { HeroCropRecord, HeroCropTransform, HeroCropViewport } from '@/lib/hero-crop/types'

export const heroCropEditorStorageKey = 'susurrium:hero-crop-editor:v1'

export const heroCropSelections: Readonly<Record<string, HeroCropRecord>> =
  heroCropSelectionsGenerated

const basename = (value: string): string => value.split(/[/?#]/).pop() ?? value

export function getHeroCropRecord(sourceOrFilename?: string | null): HeroCropRecord | undefined {
  if (!sourceOrFilename) return undefined
  return heroCropSelections[basename(sourceOrFilename)]
}

/** Resolve a viewport-specific transform, falling back to centered cover. */
export function getHeroCropTransform(
  sourceOrFilename?: string | null,
  viewport: HeroCropViewport = 'desktop'
): HeroCropTransform {
  const record = getHeroCropRecord(sourceOrFilename)
  if (!record) return DEFAULT_HERO_CROP_TRANSFORM
  return normalizeHeroCropTransform(record[viewport])
}

/** Normalize an exported record before it is written to the generated bridge. */
export function normalizeHeroCropRecord(
  filename: string,
  value: Partial<HeroCropRecord> | null | undefined
): HeroCropRecord | undefined {
  if (!value || typeof value !== 'object') return undefined
  return {
    filename: basename(filename),
    desktop: normalizeHeroCropTransform(value.desktop),
    mobile: normalizeHeroCropTransform(value.mobile),
    ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
    schemaVersion: HERO_CROP_SCHEMA_VERSION
  }
}
