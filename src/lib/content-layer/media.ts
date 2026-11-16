import { sayingDecorativeImages, traceFallbackImages } from '@/data/home-media'
import { planCardMedia } from '@/lib/card-layout/planner'

import { contentKinds, contentTypeRegistry } from './registry'
import type { ContentRecord } from './types'

export function buildContentMediaMap(records: readonly ContentRecord[]) {
  return planCardMedia(
    records,
    Object.fromEntries(contentKinds.map((kind) => [kind, contentTypeRegistry[kind].media])),
    {
      saying: sayingDecorativeImages,
      trace: traceFallbackImages
    }
  )
}
