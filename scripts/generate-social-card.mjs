/**
 * Build the default Open Graph card from the approved Home artwork.
 *
 * The source image is kept untouched. This script only creates a dedicated
 * 1200x630 derivative so social platforms receive the intended aspect ratio,
 * crop, and small amount of site branding.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptsDirectory, '..')
const sourcePath = path.join(
  projectRoot,
  'public/images/home-media/thumb-1920-1381117.webp'
)
const outputPath = path.join(projectRoot, 'public/images/social-card.webp')

const width = 1200
const height = 630

// A restrained right/bottom vignette keeps the title readable without
// flattening the sunset and the silhouette in the source artwork.
const overlay = Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rightVignette" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#06131a" stop-opacity="0" />
        <stop offset="58%" stop-color="#06131a" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#06131a" stop-opacity="0.42" />
      </linearGradient>
      <linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="58%" stop-color="#06131a" stop-opacity="0" />
        <stop offset="100%" stop-color="#06131a" stop-opacity="0.34" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#rightVignette)" />
    <rect width="${width}" height="${height}" fill="url(#bottomVignette)" />
    <g>
      <rect x="722" y="492" width="420" height="92" rx="14" fill="#06131a" fill-opacity="0.28" />
      <rect x="750" y="518" width="58" height="3" rx="1.5" fill="#9bd6df" fill-opacity="0.95" />
      <text
        x="750"
        y="558"
        fill="#f5f8f8"
        font-family="Arial, Helvetica, sans-serif"
        font-size="34"
        font-weight="600"
        letter-spacing="0.8"
        stroke="#06131a"
        stroke-opacity="0.28"
        stroke-width="2"
        paint-order="stroke"
      >Susurrium&apos;s blog</text>
    </g>
  </svg>
`)

await sharp(sourcePath)
  .resize(width, height, {
    fit: 'cover',
    position: 'center'
  })
  .modulate({ brightness: 1.02, saturation: 1.03 })
  .composite([{ input: overlay, blend: 'over' }])
  .webp({ quality: 90, effort: 6 })
  .withMetadata({
    density: 96
  })
  .toFile(outputPath)

const metadata = await sharp(outputPath).metadata()
console.log(
  JSON.stringify(
    {
      output: outputPath,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    },
    null,
    2
  )
)
