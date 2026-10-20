import cardImages from '@/data/card-images.json'

export function cardImageOptions(
  src: string | undefined,
  zoom = 1
): { srcset?: string; sizes?: string } {
  const candidate = src ? (cardImages as Record<string, { srcset: string }>)[src] : undefined
  return candidate
    ? {
        srcset: candidate.srcset,
        sizes: `(max-width: 767px) calc(100vw * ${zoom}), ${Math.ceil(640 * zoom)}px`
      }
    : {}
}
