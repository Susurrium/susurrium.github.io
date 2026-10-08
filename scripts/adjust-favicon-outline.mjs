// Preserve the approved warm-charcoal contour algorithm and the source alpha.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import { verifyFavicon } from './lib/favicon-verification.mjs'
import { atomicWrite } from './lib/file-operations.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const INPUT = resolve(root, 'src/assets/favicon/base-before-outline.png')
const W = 1024,
  H = 1024,
  N = W * H

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v))
}
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function distanceToTransparent(data) {
  const dist = new Uint16Array(N)
  dist.fill(65535)
  const queue = new Int32Array(N)
  let head = 0,
    tail = 0
  for (let p = 0; p < N; p++)
    if (data[p * 4 + 3] < 128) {
      dist[p] = 0
      queue[tail++] = p
    }
  const dx = [-1, 0, 1, -1, 1, -1, 0, 1]
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1]
  while (head < tail) {
    const p = queue[head++],
      nd = dist[p] + 1
    const x = p % W,
      y = (p / W) | 0
    for (let k = 0; k < 8; k++) {
      const xx = x + dx[k],
        yy = y + dy[k]
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue
      const q = yy * W + xx
      if (dist[q] > nd) {
        dist[q] = nd
        queue[tail++] = q
      }
    }
  }
  return dist
}

async function main() {
  const args = process.argv.slice(2)
  let output = resolve(root, 'artifacts/favicon/master.png')
  let check = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true
    else if (args[i] === '--out' && args[i + 1] && !args[i + 1].startsWith('--')) {
      output = resolve(root, args[++i])
    } else
      throw new Error('Usage: node scripts/adjust-favicon-outline.mjs [--out <file.png>] [--check]')
  }
  const base = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (base.info.width !== W || base.info.height !== H || base.info.channels !== 4)
    throw new Error(`unexpected input ${JSON.stringify(base.info)}`)
  const src = base.data,
    out = Buffer.from(src),
    dist = distanceToTransparent(src)
  let changed = 0,
    core = 0,
    middle = 0,
    sumDelta = 0,
    maxDelta = 0,
    rejectedDarkening = 0
  // Warm charcoal target: dark enough for dark browser chrome, but no longer
  // a neutral #000/#111.  Blend strength is strongest on the outer contour
  // and tapers toward the interior, with a hard luminance safety cap.
  const target = [64, 47, 43]
  for (let p = 0; p < N; p++) {
    const i = p * 4,
      a = src[i + 3]
    if (a < 32) continue
    const d = dist[p]
    const edge = d === 0 ? 1 : 1 - smoothstep(1, 8, d)
    if (edge <= 0) continue
    const r = src[i],
      g = src[i + 1],
      b = src[i + 2]
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (l >= 112) continue
    // Near-black ink receives the largest lift; medium-dark anti-aliasing
    // receives a restrained lift, avoiding a visible tonal ring.
    const dark = 1 - smoothstep(8, 112, l)
    const strength = 0.34 * dark * (0.62 + 0.38 * edge)
    if (strength <= 0) continue
    const nr = Math.round(r + (target[0] - r) * strength)
    const ng = Math.round(g + (target[1] - g) * strength)
    const nb = Math.round(b + (target[2] - b) * strength)
    const oldY = l
    const newY = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb
    // The warm target is intentionally darker in the blue channel.  Guard
    // against a small net-luma drop on already-brighter anti-aliased pixels.
    if (newY + 1e-6 < oldY) {
      rejectedDarkening++
      continue
    }
    const delta = Math.max(Math.abs(nr - r), Math.abs(ng - g), Math.abs(nb - b))
    if (delta) {
      out[i] = nr
      out[i + 1] = ng
      out[i + 2] = nb
      changed++
      sumDelta += delta
      maxDelta = Math.max(maxDelta, delta)
      if (d <= 3) core++
      else middle++
    }
  }
  for (let p = 0; p < N; p++)
    if (out[p * 4 + 3] !== src[p * 4 + 3]) throw new Error(`alpha changed at ${p}`)
  const square = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer()
  if (check) {
    const master = await readFile(resolve(root, 'src/assets/favicon/master.png'))
    const result = await verifyFavicon(master, square, 'master.png')
    console.log(`MATCH approved master: ${result}`)
  } else {
    await atomicWrite(output, square)
    console.log(`Generated ${output}`)
  }
  console.log(
    JSON.stringify({
      alphaUnchanged: true,
      changedPixels: changed,
      changedCorePixels: core,
      changedMiddlePixels: middle,
      averageMaxChannelDelta: changed ? sumDelta / changed : 0,
      maxChannelDelta: maxDelta,
      rejectedDarkening
    })
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
