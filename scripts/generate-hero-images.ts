import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { heroSlides, sayingDecorativeImages, traceFallbackImages } from '../src/data/home-media'
import { generateResponsiveImages, verifyResponsiveImages } from './lib/responsive-images.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
if (args.some((arg) => !['--hero', '--check'].includes(arg)))
  throw new Error('Usage: generate-hero-images.ts [--hero] [--check]')
const profiles = [
  {
    sources: heroSlides.map((slide) => slide.src),
    output: '/images/home-hero',
    manifest: 'src/data/hero-images.json',
    widths: [768, 1280, 1920]
  },
  {
    sources: [
      ...new Set([...sayingDecorativeImages, ...traceFallbackImages].map((image) => image.src))
    ],
    output: '/images/card-media',
    manifest: 'src/data/card-images.json',
    widths: [480, 960, 1920]
  },
  {
    sources: ['/media/effects/tracer-companion.webp'],
    output: '/media/effects/responsive',
    manifest: 'src/data/companion-images.json',
    widths: [240, 480, 960]
  }
]
for (const profile of args.includes('--hero') ? profiles.slice(0, 1) : profiles) {
  if (args.includes('--check')) {
    const count = await verifyResponsiveImages(
      root,
      profile.sources,
      profile.output,
      profile.manifest,
      profile.widths
    )
    console.log(`PASS ${count} responsive files: ${profile.manifest}`)
  } else {
    await generateResponsiveImages(
      root,
      profile.sources,
      profile.output,
      profile.manifest,
      profile.widths
    )
    console.log(
      `Generated ${profile.sources.length} responsive sources: ${resolve(root, profile.manifest)}`
    )
  }
}
