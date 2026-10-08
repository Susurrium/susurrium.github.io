import type { ImageMetadata } from 'astro'
import cardImages from '@/data/card-images.json'

export function publicReadingImageOptions(src: string) {
  const record = (cardImages as Record<string, { srcset: string }>)[src]
  return record
    ? { srcset: record.srcset, sizes: '(max-width: 767px) calc(100vw - 2rem), 65ch' }
    : {}
}

export function readingImageOptions(image: ImageMetadata) {
  if (
    !Number.isFinite(image.width) ||
    image.width <= 0 ||
    !Number.isFinite(image.height) ||
    image.height <= 0
  )
    throw new Error('Reading cover is missing valid image dimensions')
  const width = Math.min(image.width, 1280)
  return {
    width,
    widths: [...new Set([480, 768, 1024, 1280].map((candidate) => Math.min(candidate, width)))],
    sizes: '(max-width: 767px) calc(100vw - 2rem), 65ch',
    format: 'webp' as const
  }
}
