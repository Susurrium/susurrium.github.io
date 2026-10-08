import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, resolve, sep } from 'node:path'
import sharp from 'sharp'

import { atomicWrite } from './file-operations.mjs'

const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')
export function publicImagePath(root, src) {
  if (!src.startsWith('/') || src.startsWith('//') || /[\\?#]/.test(src))
    throw new Error(`Invalid local image URL: ${src}`)
  const base = resolve(root, 'public')
  const path = resolve(base, src.slice(1))
  if (!path.startsWith(`${base}${sep}`)) throw new Error(`Image leaves public directory: ${src}`)
  return path
}

async function sourceImage(root, src) {
  const buffer = await readFile(publicImagePath(root, src))
  const metadata = await sharp(buffer).metadata()
  if (
    metadata.format !== 'webp' ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error(`Expected a static WebP with dimensions: ${src}`)
  if (metadata.width > 1920) throw new Error(`Public image exceeds 1920px source width: ${src}`)
  return { buffer, metadata, sourceSha256: digest(buffer) }
}

export async function generateResponsiveImages(root, sources, outputDir, manifestPath, widths) {
  if (new Set(sources).size !== sources.length) throw new Error('Duplicate responsive image source')
  if (!widths.length || widths.some((width) => !Number.isInteger(width) || width <= 0))
    throw new Error('Invalid responsive widths')
  if (new Set(sources.map((src) => basename(src))).size !== sources.length)
    throw new Error('Conflicting responsive output names')
  const inputs = []
  // 整批校验完成后才生成或写入文件，损坏的图库不会产生部分更新。
  for (const src of sources) inputs.push({ src, ...(await sourceImage(root, src)) })
  const manifest = {}
  const pending = []
  for (const { src, buffer, metadata, sourceSha256 } of inputs) {
    const candidates = []
    const candidateWidths = [
      ...new Set(widths.map((width) => Math.min(width, metadata.width)))
    ].sort((a, b) => a - b)
    for (const width of candidateWidths) {
      const name = `${basename(src, '.webp')}-${width}.webp`
      const url = `${outputDir}/${name}`
      const rendered = await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer()
      const result = await sharp(rendered).metadata()
      candidates.push({
        src: url,
        width: result.width,
        height: result.height,
        bytes: rendered.length,
        sha256: digest(rendered)
      })
      pending.push({ path: publicImagePath(root, url), buffer: rendered })
    }
    manifest[src] = {
      width: metadata.width,
      height: metadata.height,
      quality: 86,
      sourceSha256,
      srcset: candidates.map((candidate) => `${candidate.src} ${candidate.width}w`).join(', '),
      candidates
    }
  }
  for (const output of pending) await atomicWrite(output.path, output.buffer)
  await atomicWrite(resolve(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

export async function verifyResponsiveImages(root, sources, outputDir, manifestPath, widths) {
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'))
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
    throw new Error(`Invalid manifest: ${manifestPath}`)
  if (Object.keys(manifest).sort().join('\n') !== [...sources].sort().join('\n'))
    throw new Error(`Image manifest differs from configured catalogue: ${manifestPath}`)
  let count = 0
  for (const src of sources) {
    const original = await sourceImage(root, src)
    const record = manifest[src]
    if (
      record.sourceSha256 !== original.sourceSha256 ||
      record.width !== original.metadata.width ||
      record.height !== original.metadata.height ||
      record.quality !== 86
    )
      throw new Error(`Responsive source changed; regenerate images: ${src}`)
    const expectedWidths = [...new Set(widths.map((width) => Math.min(width, record.width)))].sort(
      (a, b) => a - b
    )
    if (!Array.isArray(record.candidates) || record.candidates.length !== expectedWidths.length)
      throw new Error(`Missing responsive candidates: ${src}`)
    for (const [index, candidate] of record.candidates.entries()) {
      const width = expectedWidths[index]
      const expectedSrc = `${outputDir}/${basename(src, '.webp')}-${width}.webp`
      if (candidate.src !== expectedSrc || candidate.width !== width)
        throw new Error(`Wrong responsive width/path: ${src}`)
      const buffer = await readFile(publicImagePath(root, candidate.src))
      const metadata = await sharp(buffer).metadata()
      if (
        metadata.format !== 'webp' ||
        metadata.width !== width ||
        metadata.height !== candidate.height ||
        Math.abs(metadata.height - (record.height * width) / record.width) > 1
      )
        throw new Error(`Responsive image format or aspect ratio changed: ${candidate.src}`)
      if (candidate.bytes !== buffer.length || candidate.sha256 !== digest(buffer))
        throw new Error(`Responsive output changed: ${candidate.src}`)
      count++
    }
    if (
      record.srcset !==
      record.candidates.map((candidate) => `${candidate.src} ${candidate.width}w`).join(', ')
    )
      throw new Error(`Responsive srcset differs from candidates: ${src}`)
  }
  return count
}
