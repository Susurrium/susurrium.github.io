import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import sharp from 'sharp'

import { downloadAvatar } from './avatar-download.mjs'
import { atomicWrite } from './file-operations.mjs'
import { publicImagePath } from './responsive-images.mjs'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const widths = [80, 160, 320, 480]
const manifestPath = 'src/data/friend-avatars.generated.json'

export function avatarSources(links) {
  return [
    ...new Set(links.friends.flatMap((group) => group.link_list.map((friend) => friend.avatar)))
  ].sort()
}

function assetPath(root, src) {
  if (!/^\/media\/friend-avatars\/[a-f0-9]{64}-\d+\.webp$/.test(src))
    throw new Error(`Invalid friend avatar candidate: ${src}`)
  const base = resolve(root, 'public/media/friend-avatars')
  const path = resolve(root, 'public', src.slice(1))
  if (!path.startsWith(`${base}${sep}`)) throw new Error('Avatar path leaves its output directory')
  return path
}

export async function renderAvatar(buffer) {
  const image = sharp(buffer, { animated: true, limitInputPixels: 40_000_000 })
  const metadata = await image.metadata()
  const height = metadata.pageHeight ?? metadata.height
  if (
    !metadata.width ||
    !height ||
    !['jpeg', 'png', 'gif', 'webp', 'heif', 'avif', 'svg'].includes(metadata.format)
  )
    throw new Error(
      `Unsupported avatar image or missing dimensions: ${metadata.format} ${metadata.width}x${height}`
    )
  const sourceSha256 = hash(buffer)
  const candidates = []
  for (const width of [...new Set(widths.map((value) => Math.min(value, metadata.width)))]) {
    const bytes = await image
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toBuffer()
    const rendered = await sharp(bytes, { animated: true }).metadata()
    if ((rendered.pages ?? 1) !== (metadata.pages ?? 1))
      throw new Error('Avatar animation frame count changed')
    candidates.push({
      src: `/media/friend-avatars/${sourceSha256}-${width}.webp`,
      width: rendered.width,
      height: rendered.pageHeight ?? rendered.height,
      bytes: bytes.length,
      sha256: hash(bytes),
      buffer: bytes
    })
  }
  return { sourceSha256, width: metadata.width, height, frames: metadata.pages ?? 1, candidates }
}

export async function verifyAvatars(root, sources, manifest) {
  if (manifest.schemaVersion !== 1 || !manifest.images || typeof manifest.images !== 'object')
    throw new Error('Unsupported friend avatar manifest')
  if (Object.keys(manifest.images).sort().join('\n') !== [...sources].sort().join('\n'))
    throw new Error('Friend avatar manifest differs from the reviewed source list')
  let count = 0
  for (const source of sources) {
    const record = manifest.images[source]
    if (record.state === 'unavailable') {
      if (!record.error || record.candidates?.length)
        throw new Error(`Invalid unavailable avatar: ${source}`)
      continue
    }
    if (
      record.state !== 'ready' ||
      !/^[a-f0-9]{64}$/.test(record.sourceSha256) ||
      !record.candidates?.length
    )
      throw new Error(`Invalid friend avatar: ${source}`)
    const expectedWidths = [...new Set(widths.map((width) => Math.min(width, record.width)))]
    if (record.candidates.map((item) => item.width).join(',') !== expectedWidths.join(','))
      throw new Error(`Avatar widths differ from the generation profile: ${source}`)
    for (const candidate of record.candidates) {
      const bytes = await readFile(assetPath(root, candidate.src))
      const metadata = await sharp(bytes, { animated: true }).metadata()
      if (
        candidate.src !== `/media/friend-avatars/${record.sourceSha256}-${candidate.width}.webp` ||
        bytes.length !== candidate.bytes ||
        hash(bytes) !== candidate.sha256 ||
        metadata.format !== 'webp' ||
        metadata.width !== candidate.width ||
        (metadata.pageHeight ?? metadata.height) !== candidate.height ||
        (metadata.pages ?? 1) !== record.frames ||
        Math.abs(candidate.height - (record.height * candidate.width) / record.width) > 1
      )
        throw new Error(`Friend avatar candidate failed verification: ${candidate.src}`)
      count++
    }
  }
  return count
}

export async function updateAvatars(root, sources, download = downloadAvatar) {
  let previous = { schemaVersion: 1, images: {} }
  try {
    previous = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const next = { schemaVersion: 1, images: {} }
  const failures = []
  const pending = []
  // 下载失败保留原有有效资产；损坏的本地清单和生成错误继续明确失败。
  await verifyAvatars(root, Object.keys(previous.images), previous)
  for (const source of sources) {
    let input
    if (source.startsWith('/')) input = { buffer: await readFile(publicImagePath(root, source)) }
    else {
      try {
        if (!/^https?:\/\//.test(source))
          throw new Error('Avatar source must be the reviewed HTTP/HTTPS URL')
        input = await download(source)
      } catch (error) {
        failures.push({ source, error: error.message })
        next.images[source] =
          previous.images[source]?.state === 'ready'
            ? previous.images[source]
            : { state: 'unavailable', error: error.message }
        continue
      }
    }
    const rendered = await renderAvatar(input.buffer).catch((error) => {
      throw new Error(`Cannot generate avatar ${source}: ${error.message}`, { cause: error })
    })
    for (const candidate of rendered.candidates) pending.push(candidate)
    next.images[source] = {
      ...rendered,
      state: 'ready',
      candidates: rendered.candidates.map(({ src, width, height, bytes, sha256 }) => ({
        src,
        width,
        height,
        bytes,
        sha256
      }))
    }
  }
  for (const candidate of pending) {
    const path = assetPath(root, candidate.src)
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${process.pid}.pending`
    await writeFile(temporary, candidate.buffer)
    await rename(temporary, path)
  }
  await verifyAvatars(root, sources, next)
  await atomicWrite(resolve(root, manifestPath), JSON.stringify(next, null, 2) + '\n')
  return { manifest: next, failures }
}
