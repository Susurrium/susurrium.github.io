import cardImages from '@/data/card-images.json'

export type CardImageLayout = 'archive' | 'home-recent' | 'home-saying'

export function cardImageSizes(
  width: number,
  height: number,
  zoom = 1,
  layout: CardImageLayout = 'archive',
  fit: 'cover' | 'contain' = 'cover'
): string {
  if (![width, height, zoom].every((value) => Number.isFinite(value) && value > 0))
    throw new Error('Card image requires positive dimensions and crop zoom')
  const ratio = Number((width / height).toFixed(6))
  // MediaCard 的悬停与键盘聚焦会再放大 5%，候选图同时覆盖这部分像素需求。
  const scale = Number((zoom * 1.05).toFixed(6))
  const select = fit === 'cover' ? 'max' : 'min'
  const length = (frameWidth: string, frameHeight: string) =>
    `calc(${select}(${frameWidth}, calc(${frameHeight} * ${ratio})) * ${scale})`
  const mobile = length(layout === 'archive' ? 'calc(100vw - 48px)' : 'calc(100vw - 32px)', '224px')
  if (layout === 'home-recent')
    return `(max-width: 767px) ${mobile}, (max-width: 1023px) ${length('calc((100vw - 56px) * 0.54)', 'calc(clamp(248px, 20vw, 264px) - 2px)')}, (max-width: 1100px) ${length('calc((100vw - 80px) * 0.54)', 'calc(clamp(248px, 20vw, 264px) - 2px)')}, ${length('calc((min(100vw, 1120px) - 144px) * 0.27)', '262px')}`
  const margin = layout === 'home-saying' ? 0 : 32
  return `(max-width: 767px) ${mobile}, (max-width: 1023px) ${length(`calc((100vw - ${80 + margin}px) / 2)`, '222px')}, ${length(`calc((min(100vw, 1120px) - ${104 + margin}px) / 2)`, '222px')}`
}

export function cardImageOptions(
  src: string | undefined,
  zoom = 1,
  layout: CardImageLayout = 'archive',
  fit: 'cover' | 'contain' = 'cover'
): { srcset?: string; sizes?: string } {
  const candidate = src
    ? (cardImages as Record<string, { srcset: string; width: number; height: number }>)[src]
    : undefined
  return candidate
    ? {
        srcset: candidate.srcset,
        sizes: cardImageSizes(candidate.width, candidate.height, zoom, layout, fit)
      }
    : {}
}
