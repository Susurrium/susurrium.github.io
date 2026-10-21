import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect } from 'bun:test'
import sharp from 'sharp'

import { renderAvatar, updateAvatars, verifyAvatars } from '../scripts/lib/friend-avatars.mjs'
import { createTestDirectory, testWithFixtures as test } from './helpers/fixtures.mjs'

test('avatar candidates preserve transparency, dimensions and source bytes; verification rejects corruption', async () => {
  const root = createTestDirectory('avatars')
  const original = await sharp({
    create: { width: 360, height: 240, channels: 4, background: '#33669980' }
  })
    .png()
    .toBuffer()
  const before = Buffer.from(original)
  const source = 'https://reviewed.test/avatar.png'
  const result = await updateAvatars(root, [source], async () => ({ buffer: original }))
  const record = result.manifest.images[source]
  expect(record.candidates.map((item: { width: number }) => item.width)).toEqual([
    80, 160, 320, 360
  ])
  expect(await verifyAvatars(root, [source], result.manifest)).toBe(4)
  expect(original).toEqual(before)
  const path = resolve(root, 'public', record.candidates[0].src.slice(1))
  expect((await sharp(await readFile(path)).metadata()).hasAlpha).toBe(true)
  await writeFile(path, 'corrupted')
  await expect(verifyAvatars(root, [source], result.manifest)).rejects.toThrow()
})

test('an unavailable source is explicit, while a failed refresh keeps verified existing assets', async () => {
  const root = createTestDirectory('avatars')
  const ready = 'https://reviewed.test/ready.png'
  const missing = 'https://reviewed.test/unavailable.png'
  const bytes = await sharp({
    create: { width: 20, height: 12, channels: 3, background: '#335577' }
  })
    .png()
    .toBuffer()
  const first = await updateAvatars(root, [ready], async () => ({ buffer: bytes }))
  const offline = async () => {
    throw new Error('network unavailable')
  }
  const updated = await updateAvatars(root, [ready, missing], offline)
  expect(updated.failures).toHaveLength(2)
  expect(updated.manifest.images[ready]).toEqual(first.manifest.images[ready])
  expect(updated.manifest.images[missing]).toEqual({
    state: 'unavailable',
    error: 'network unavailable'
  })
  expect(await verifyAvatars(root, [ready, missing], updated.manifest)).toBe(1)
  await expect(verifyAvatars(root, [ready], updated.manifest)).rejects.toThrow(
    'reviewed source list'
  )
})

test('local reviewed avatars use local bytes and malformed image data fails before manifest replacement', async () => {
  const root = createTestDirectory('avatars')
  await mkdir(resolve(root, 'public/images'), { recursive: true })
  const source = '/images/local.png'
  await writeFile(
    resolve(root, 'public/images/local.png'),
    await sharp({ create: { width: 100, height: 80, channels: 3, background: '#554433' } })
      .png()
      .toBuffer()
  )
  const result = await updateAvatars(root, [source], async () => {
    throw new Error('Unexpected network access')
  })
  expect(result.failures).toHaveLength(0)
  const before = await readFile(resolve(root, 'src/data/friend-avatars.generated.json'))
  await expect(
    updateAvatars(root, ['https://reviewed.test/broken'], async () => ({
      buffer: Buffer.from('not an image')
    }))
  ).rejects.toThrow('Cannot generate avatar')
  expect(await readFile(resolve(root, 'src/data/friend-avatars.generated.json'))).toEqual(before)
})

test('multi-frame avatars retain their animation', async () => {
  const first = await sharp({
    create: { width: 12, height: 10, channels: 4, background: '#ff000080' }
  })
    .png()
    .toBuffer()
  const second = await sharp({
    create: { width: 12, height: 10, channels: 4, background: '#0000ff80' }
  })
    .png()
    .toBuffer()
  const animated = await sharp([first, second], { join: { animated: true } })
    .gif({ delay: [100, 200], loop: 0 })
    .toBuffer()
  const result = await renderAvatar(animated)
  expect(result.frames).toBe(2)
  const metadata = await sharp(result.candidates[0].buffer, { animated: true }).metadata()
  expect(metadata.pages).toBe(2)
  expect(metadata.delay).toEqual([100, 200])
})
