import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { describe, expect } from 'bun:test'
import sharp from 'sharp'

import {
  generateResponsiveImages,
  publicImagePath,
  verifyResponsiveImages
} from '../scripts/lib/responsive-images.mjs'
import { generateSayingPreviews, verifySayingPreviews } from '../scripts/lib/saying-previews.mjs'
import { cardImageOptions } from '../src/lib/media/card-image'
import { readingImageOptions } from '../src/lib/media/reading-image'
import { createTestDirectory, testWithFixtures as test } from './helpers/fixtures.mjs'

async function fixture(width = 1000) {
  const root = createTestDirectory('responsive')
  const source = resolve(root, 'public/images/test.webp')
  await mkdir(dirname(source), { recursive: true })
  await sharp({ create: { width, height: 600, channels: 4, background: '#33669980' } })
    .webp()
    .toFile(source)
  return { root, source }
}
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

test('card responsive options follow the selected source and account for crop zoom', () => {
  const source = '/images/home-media/43935854_p0_master1200.webp'
  expect(cardImageOptions(source, 1.25)).toEqual({
    srcset:
      '/images/card-media/43935854_p0_master1200-480.webp 480w, /images/card-media/43935854_p0_master1200-960.webp 960w, /images/card-media/43935854_p0_master1200-1200.webp 1200w',
    sizes:
      '(max-width: 767px) calc(max(calc(100vw - 48px), calc(224px * 1.6)) * 1.3125), (max-width: 1023px) calc(max(calc((100vw - 112px) / 2), calc(222px * 1.6)) * 1.3125), calc(max(calc((min(100vw, 1120px) - 136px) / 2), calc(222px * 1.6)) * 1.3125)'
  })
  expect(cardImageOptions('/images/social-card.webp')).toEqual({})
  expect(cardImageOptions(undefined)).toEqual({})
})

test('Saying previews preserve sources, alpha and aspect ratio, and verify their encoded pixels', async () => {
  const { root, source } = await fixture(500)
  const before = await readFile(source)
  const manifest = await generateSayingPreviews(root, ['/images/test.webp'], 'previews.json')
  const record = manifest.images['/images/test.webp']
  const decoded = Buffer.from(await (await fetch(record.dataUri)).arrayBuffer())
  const metadata = await sharp(decoded).metadata()
  expect(metadata.width).toBe(48)
  expect(metadata.hasAlpha).toBe(true)
  expect(Math.abs(metadata.height! - (600 * 48) / 500)).toBeLessThanOrEqual(1)
  expect(decoded.length).toBe(record.bytes)
  expect(await readFile(source)).toEqual(before)
  expect(await verifySayingPreviews(root, ['/images/test.webp'], 'previews.json')).toBe(1)
  record.dataUri = 'data:image/webp;base64,invalid'
  await writeFile(resolve(root, 'previews.json'), JSON.stringify(manifest))
  await expect(verifySayingPreviews(root, ['/images/test.webp'], 'previews.json')).rejects.toThrow(
    'preview changed'
  )
})

test('Saying preview checks reject changed sources and keep small originals at their native size', async () => {
  const { root, source } = await fixture(20)
  const manifest = await generateSayingPreviews(root, ['/images/test.webp'], 'previews.json')
  expect(manifest.images['/images/test.webp'].width).toBe(20)
  await expect(verifySayingPreviews(root, [], 'previews.json')).rejects.toThrow('catalogue')
  await sharp({ create: { width: 20, height: 30, channels: 4, background: '#ff000080' } })
    .webp()
    .toFile(source)
  await expect(verifySayingPreviews(root, ['/images/test.webp'], 'previews.json')).rejects.toThrow(
    'preview changed'
  )
})
