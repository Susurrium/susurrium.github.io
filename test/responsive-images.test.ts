import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, sep } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import sharp from 'sharp'

import {
  generateResponsiveImages,
  publicImagePath,
  verifyResponsiveImages
} from '../scripts/lib/responsive-images.mjs'
import { readingImageOptions } from '../src/lib/media/reading-image'

const roots: string[] = []
async function fixture(width = 1000) {
  const root = await mkdtemp(resolve(tmpdir(), 'susurrium-responsive-'))
  roots.push(root)
  const source = resolve(root, 'public/images/test.webp')
  await mkdir(dirname(source), { recursive: true })
  await sharp({ create: { width, height: 600, channels: 4, background: '#33669980' } })
    .webp()
    .toFile(source)
  return { root, source }
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!root.startsWith(`${resolve(tmpdir())}${sep}susurrium-responsive-`))
      throw new Error('Unsafe responsive fixture cleanup')
    await rm(root, { recursive: true, force: true, maxRetries: 5 })
  }
})

describe('responsive image generation and verification', () => {
  test('keeps source bytes, aspect ratio and alpha; never enlarges small inputs', async () => {
    const { root, source } = await fixture(500)
    const before = await readFile(source)
    const manifest = await generateResponsiveImages(
      root,
      ['/images/test.webp'],
      '/images/output',
      'manifest.json',
      [240, 480, 960]
    )
    expect(manifest['/images/test.webp'].candidates.map((item) => item.width)).toEqual([
      240, 480, 500
    ])
    for (const candidate of manifest['/images/test.webp'].candidates) {
      const metadata = await sharp(await readFile(publicImagePath(root, candidate.src))).metadata()
      expect(metadata.hasAlpha).toBe(true)
      expect(Math.abs(metadata.height! - (600 * metadata.width!) / 500)).toBeLessThanOrEqual(1)
    }
    expect(await readFile(source)).toEqual(before)
    expect(
      await verifyResponsiveImages(
        root,
        ['/images/test.webp'],
        '/images/output',
        'manifest.json',
        [240, 480, 960]
      )
    ).toBe(3)
  })

  test('detects stale sources, altered output bytes and catalogue changes', async () => {
    const { root, source } = await fixture()
    const manifest = await generateResponsiveImages(
      root,
      ['/images/test.webp'],
      '/images/output',
      'manifest.json',
      [240, 480]
    )
    await expect(
      verifyResponsiveImages(root, [], '/images/output', 'manifest.json', [240, 480])
    ).rejects.toThrow('catalogue')
    const output = publicImagePath(root, manifest['/images/test.webp'].candidates[0].src)
    const buffer = await readFile(output)
    await writeFile(output, await sharp(buffer).webp({ quality: 60 }).toBuffer())
    await expect(
      verifyResponsiveImages(
        root,
        ['/images/test.webp'],
        '/images/output',
        'manifest.json',
        [240, 480]
      )
    ).rejects.toThrow('output changed')
    await sharp({ create: { width: 1000, height: 600, channels: 3, background: '#ffffff' } })
      .webp()
      .toFile(source)
    await expect(
      verifyResponsiveImages(
        root,
        ['/images/test.webp'],
        '/images/output',
        'manifest.json',
        [240, 480]
      )
    ).rejects.toThrow('source changed')
  })

  test('rejects disguised formats, oversized inputs and unsafe URLs before writing', async () => {
    const { root, source } = await fixture()
    await writeFile(
      source,
      await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } })
        .png()
        .toBuffer()
    )
    await expect(
      generateResponsiveImages(
        root,
        ['/images/test.webp'],
        '/images/output',
        'manifest.json',
        [480]
      )
    ).rejects.toThrow('static WebP')
    await expect(readFile(resolve(root, 'manifest.json'))).rejects.toThrow()
    await sharp({ create: { width: 2000, height: 100, channels: 3, background: '#ffffff' } })
      .webp()
      .toFile(source)
    await expect(
      generateResponsiveImages(
        root,
        ['/images/test.webp'],
        '/images/output',
        'manifest.json',
        [480]
      )
    ).rejects.toThrow('1920px')
    expect(() => publicImagePath(root, '/../outside.webp')).toThrow('leaves public')
    expect(() => publicImagePath(root, '//remote.test/photo.webp')).toThrow('Invalid')
  })
})

test('reading cover and backdrop share bounded widths and preserve small image dimensions', () => {
  const image = { src: '/_astro/cover.jpg', width: 2400, height: 1317, format: 'jpg' as const }
  expect(readingImageOptions(image).width).toBe(1280)
  expect(readingImageOptions(image).widths).toEqual([480, 768, 1024, 1280])
  expect(readingImageOptions({ ...image, width: 200 }).widths).toEqual([200])
  expect(() => readingImageOptions({ ...image, width: 0 })).toThrow('valid image dimensions')
})
