import sayingPreviews from '@/data/saying-previews.generated.json'
import { resolveMediaImage } from '@/lib/content-layer/page-data'
import type { RenderablePageItem, SayingRecord } from '@/lib/content-layer/types'
import { cardImageOptions } from '@/lib/media/card-image'

export type HomeSayingItem = RenderablePageItem & { record: SayingRecord }

export function homeSayingItems(items: readonly RenderablePageItem[]): HomeSayingItem[] {
  return items.filter((item): item is HomeSayingItem => item.record.kind === 'saying')
}

export function buildHomeSayingCatalog(items: readonly HomeSayingItem[]) {
  const ids = new Set<string>()
  return items.map((item) => {
    if (ids.has(item.record.id)) throw new Error(`Duplicate Home Saying: ${item.record.id}`)
    ids.add(item.record.id)
    const image = resolveMediaImage(item)
    if (!image.src) throw new Error(`Home Saying has no image: ${item.record.id}`)
    return {
      id: item.record.id,
      href: item.card.href,
      image: {
        src: image.src,
        source: image.source,
        ...cardImageOptions(image.src, image.crop?.transform.zoom)
      }
    }
  })
}

export function homeSayingPreview(item: HomeSayingItem): string {
  const image = resolveMediaImage(item)
  const record = image.src
    ? (sayingPreviews.images as Record<string, { dataUri: string }>)[image.src]
    : undefined
  if (!record?.dataUri) throw new Error(`Missing Saying preview; regenerate media: ${image.src}`)
  return record.dataUri
}
