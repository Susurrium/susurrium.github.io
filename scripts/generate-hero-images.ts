import { mkdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import sharp from 'sharp'

import { heroSlides } from '../src/data/home-media'

// Keep the original images and focal-point keys stable. Only browser delivery
// uses these lossless-in-layout, lower-bandwidth derivatives.
const output = resolve('public/images/home-hero')
await mkdir(output, { recursive: true })
const manifest: Record<string, { srcset: string; width: number; height: number }> = {}
for (const slide of heroSlides) {
  const source = resolve('public', slide.src.slice(1))
  const metadata = await sharp(source).metadata()
  if (!metadata.width || !metadata.height) throw new Error(`Missing dimensions: ${source}`)
  const widths = [...new Set([768, 1280, 1920].map((width) => Math.min(width, metadata.width!)))]
  const candidates = []
  for (const width of widths) {
    const name = `${basename(slide.src, '.webp')}-${width}.webp`
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(resolve(output, name))
    candidates.push(`/images/home-hero/${name} ${width}w`)
  }
  manifest[slide.src] = {
    srcset: candidates.join(', '),
    width: metadata.width,
    height: metadata.height
  }
}
await writeFile('src/data/hero-images.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Generated responsive candidates for ${heroSlides.length} Hero images.`)
