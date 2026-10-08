// Rebuild the six production favicon assets from the approved 1024px master.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import { verifyFavicon } from './lib/favicon-verification.mjs'
import { atomicWrite } from './lib/file-operations.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = resolve(root, 'src/assets/favicon/master.png')

function makeIco(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // icon type
  header.writeUInt16LE(frames.length, 4)

  const directory = Buffer.alloc(frames.length * 16)
  let offset = header.length + directory.length
  const payloads = []
  frames.forEach(({ size, data }, index) => {
    const p = index * 16
    directory.writeUInt8(size >= 256 ? 0 : size, p)
    directory.writeUInt8(size >= 256 ? 0 : size, p + 1)
    directory.writeUInt8(0, p + 2) // no palette
    directory.writeUInt8(0, p + 3)
    directory.writeUInt16LE(1, p + 4) // planes
    directory.writeUInt16LE(32, p + 6) // bits per pixel
    directory.writeUInt32LE(data.length, p + 8)
    directory.writeUInt32LE(offset, p + 12)
    payloads.push(data)
    offset += data.length
  })
  return Buffer.concat([header, directory, ...payloads])
}

async function main() {
  const args = process.argv.slice(2)
  let targetDir = resolve(root, 'public/favicon')
  let check = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true
    else if (args[i] === '--out' && args[i + 1] && !args[i + 1].startsWith('--')) {
      targetDir = resolve(root, args[++i])
    } else throw new Error('Usage: node scripts/generate-favicon.mjs [--out <directory>] [--check]')
  }

  const input = await readFile(source)
  const metadata = await sharp(input).metadata()
  if (
    metadata.format !== 'png' ||
    metadata.width !== 1024 ||
    metadata.height !== 1024 ||
    !metadata.hasAlpha
  ) {
    throw new Error('Expected a 1024x1024 PNG master with alpha.')
  }
  // Render the whole batch before writing. Match the original Lanczos3 settings.
  const rendered = new Map()
  for (const size of [16, 32, 48, 180, 192, 512]) {
    rendered.set(
      size,
      await sharp(input)
        .resize(size, size, {
          fit: 'contain',
          kernel: 'lanczos3',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer()
    )
  }
  const outputs = new Map([
    ['favicon-16x16.png', rendered.get(16)],
    ['favicon-32x32.png', rendered.get(32)],
    ['apple-touch-icon.png', rendered.get(180)],
    ['android-chrome-192x192.png', rendered.get(192)],
    ['android-chrome-512x512.png', rendered.get(512)],
    ['favicon.ico', makeIco([16, 32, 48].map((size) => ({ size, data: rendered.get(size) })))]
  ])
  for (const [name, data] of outputs) {
    const target = resolve(targetDir, name)
    if (check) {
      const result = await verifyFavicon(await readFile(target), data, name)
      console.log(`MATCH ${name}: ${result}`)
    } else {
      await atomicWrite(target, data)
      console.log(`Generated ${target}`)
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
