import { expect, test } from 'bun:test'
import { encodeIco } from 'icojs'
import sharp from 'sharp'

import { verifyFavicon } from '../scripts/lib/favicon-verification.mjs'

const png = (size = 16, color = '#12345680', compressionLevel = 6) =>
  sharp({ create: { width: size, height: size, channels: 4, background: color } })
    .png({ compressionLevel })
    .toBuffer()
const ico = async (images: Buffer[]) =>
  Buffer.from(await encodeIco(images.map((buffer) => ({ buffer, usePngIcon: true }))))

test('PNG 检查接受无损编码差异，拒绝尺寸和 RGBA 变化', async () => {
  const original = await png(16, '#12345680', 0)
  const compressed = await png(16, '#12345680', 9)
  expect(original.equals(compressed)).toBe(false)
  expect(await verifyFavicon(original, compressed, 'icon.png')).toContain('identical RGBA pixels')
  await expect(verifyFavicon(original, await png(32), 'icon.png')).rejects.toThrow('width differs')
  await expect(verifyFavicon(original, await png(16, '#123456ff'), 'icon.png')).rejects.toThrow(
    'RGBA pixels differ'
  )
})

test('ICO 检查逐帧核对数量、尺寸、顺序和像素', async () => {
  const frames = await Promise.all([png(16), png(32), png(48)])
  const original = await ico(frames)
  expect(await verifyFavicon(original, original, 'favicon.ico')).toBe('identical bytes')
  await expect(
    verifyFavicon(original, await ico(frames.slice(0, 2)), 'favicon.ico')
  ).rejects.toThrow('frame count differs')
  await expect(
    verifyFavicon(original, await ico([...frames].reverse()), 'favicon.ico')
  ).rejects.toThrow('differs')
  await expect(
    verifyFavicon(
      original,
      await ico([await png(16, '#abcdef80'), ...frames.slice(1)]),
      'favicon.ico'
    )
  ).rejects.toThrow('RGBA pixels differ')
  await expect(verifyFavicon(Buffer.from('invalid'), original, 'favicon.ico')).rejects.toThrow()
  await expect(verifyFavicon(original.subarray(0, 20), original, 'favicon.ico')).rejects.toThrow()
})
