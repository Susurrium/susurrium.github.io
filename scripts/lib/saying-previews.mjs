import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

import { atomicWrite } from './file-operations.mjs'
import { publicImagePath } from './responsive-images.mjs'

const settings = { version: 1, width: 48, quality: 35 }
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')

async function previewFor(root, src) {
  const original = await readFile(publicImagePath(root, src))
  const metadata = await sharp(original).metadata()
  if (
    metadata.format !== 'webp' ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error(`Expected a static WebP for Saying preview: ${src}`)
  const buffer = await sharp(original)
    .resize({ width: settings.width, withoutEnlargement: true })
    .webp({ quality: settings.quality, effort: 6 })
    .toBuffer()
  const preview = await sharp(buffer).metadata()
  return {
    sourceSha256: digest(original),
    width: preview.width,
    height: preview.height,
    bytes: buffer.length,
    sha256: digest(buffer),
    dataUri: `data:image/webp;base64,${buffer.toString('base64')}`
  }
}

export async function generateSayingPreviews(root, sources, manifestPath) {
  if (new Set(sources).size !== sources.length) throw new Error('Duplicate Saying preview source')
  const images = {}
  for (const src of sources) images[src] = await previewFor(root, src)
  const manifest = { ...settings, images }
  await atomicWrite(resolve(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

export async function verifySayingPreviews(root, sources, manifestPath) {
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'))
  if (Object.entries(settings).some(([key, value]) => manifest[key] !== value))
    throw new Error('Saying preview settings changed; regenerate previews')
  if (
    !manifest.images ||
    Object.keys(manifest.images).sort().join('\n') !== [...sources].sort().join('\n')
  )
    throw new Error('Saying preview manifest differs from the configured catalogue')
  for (const src of sources) {
    const expected = await previewFor(root, src)
    if (JSON.stringify(manifest.images[src]) !== JSON.stringify(expected))
      throw new Error(`Saying preview changed; regenerate previews: ${src}`)
  }
  return sources.length
}
