import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const root = resolve(process.cwd())
const MiB = 1024 * 1024
const warnings = []
const failures = []
const legacyBudget = JSON.parse(
  await readFile(resolve(root, 'scripts/asset-budget-legacy.json'), 'utf8')
)
const legacyEntries = legacyBudget.entries ?? {}
const legacyFingerprints = new Set(
  Object.values(legacyEntries).map((entry) => `${entry.bytes}:${entry.sha256}`)
)
if (legacyBudget.schemaVersion !== 1) failures.push('unsupported legacy asset budget schema')

const mediaLimits = {
  '.avif': { recommended: 0.5 * MiB, hard: 2 * MiB },
  '.gif': { recommended: 2 * MiB, hard: 10 * MiB },
  '.jpeg': { recommended: 0.5 * MiB, hard: 2 * MiB },
  '.jpg': { recommended: 0.5 * MiB, hard: 2 * MiB },
  '.mp3': { recommended: 12 * MiB, hard: 25 * MiB },
  '.mp4': { recommended: 20 * MiB, hard: 50 * MiB },
  '.ogg': { recommended: 12 * MiB, hard: 25 * MiB },
  '.png': { recommended: 1 * MiB, hard: 5 * MiB },
  '.webm': { recommended: 20 * MiB, hard: 50 * MiB },
  '.webp': { recommended: 0.5 * MiB, hard: 2 * MiB }
}
const audioExtensions = new Set(['.mp3', '.ogg'])

async function filesUnder(directory) {
  const output = []
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name)
      if (entry.isDirectory()) output.push(...(await filesUnder(absolute)))
      if (entry.isFile()) output.push(absolute)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return output
}

function formatMiB(bytes) {
  return `${(bytes / MiB).toFixed(2)} MiB`
}

function relativePath(file) {
  return file.slice(root.length + 1).replaceAll('\\', '/')
}

async function sha256(file) {
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
}

const sourceFiles = (
  await Promise.all(
    ['public', 'src/assets'].map((directory) => filesUnder(resolve(root, directory)))
  )
).flat()
const sourceFileMap = new Map(sourceFiles.map((file) => [relativePath(file), file]))
const verifiedLegacy = new Set()

for (const [relative, entry] of Object.entries(legacyEntries)) {
  const file = sourceFileMap.get(relative)
  if (!file) {
    failures.push(`legacy budget entry is stale because ${relative} does not exist`)
    continue
  }

  const bytes = (await stat(file)).size
  const hash = await sha256(file)
  if (bytes !== entry.bytes || hash !== entry.sha256) {
    failures.push(
      `legacy budget entry no longer matches ${relative}; remove or update it intentionally`
    )
    continue
  }
  verifiedLegacy.add(relative)
}

for (const file of sourceFiles) {
  const bytes = (await stat(file)).size
  const relative = relativePath(file)
  if (bytes >= 50 * MiB) {
    failures.push(`${relative} is ${formatMiB(bytes)}; repository files must stay below 50 MiB`)
  }
  const limit = mediaLimits[extname(file).toLowerCase()]
  if (!limit) continue
  if (bytes > limit.hard) {
    if (verifiedLegacy.has(relative)) {
      warnings.push(
        `${relative} is a hash-locked upstream test asset above the current hard media limit`
      )
    } else {
      failures.push(
        `${relative} is ${formatMiB(bytes)}; hard media limit is ${formatMiB(limit.hard)}`
      )
    }
  } else if (bytes > limit.recommended) {
    warnings.push(
      `${relative} is ${formatMiB(bytes)}; recommended maximum is ${formatMiB(limit.recommended)}`
    )
  }
}

const sourceAudioBytes = (
  await Promise.all(
    sourceFiles
      .filter((file) => audioExtensions.has(extname(file).toLowerCase()))
      .map(async (file) => (await stat(file)).size)
  )
).reduce((sum, size) => sum + size, 0)

if (sourceAudioBytes > 150 * MiB) {
  failures.push(`local music is ${formatMiB(sourceAudioBytes)}; hard limit is 150 MiB`)
} else if (sourceAudioBytes > 80 * MiB) {
  warnings.push(`local music is ${formatMiB(sourceAudioBytes)}; recommended maximum is 80 MiB`)
}

const distFiles = await filesUnder(resolve(root, 'dist'))
if (distFiles.length === 0)
  failures.push('dist is missing or empty; run the production build first')

for (const file of distFiles) {
  const bytes = (await stat(file)).size
  const relative = relativePath(file)
  if (bytes >= 50 * MiB) {
    failures.push(`${relative} is ${formatMiB(bytes)}; generated files must stay below 50 MiB`)
  }
  const limit = mediaLimits[extname(file).toLowerCase()]
  if (!limit) continue
  if (bytes > limit.hard) {
    const fingerprint = `${bytes}:${await sha256(file)}`
    if (legacyFingerprints.has(fingerprint)) {
      warnings.push(`${relative} is an exact generated copy of a hash-locked upstream test asset`)
    } else {
      failures.push(
        `${relative} is ${formatMiB(bytes)}; generated media hard limit is ${formatMiB(limit.hard)}`
      )
    }
  } else if (bytes > limit.recommended) {
    warnings.push(
      `${relative} is ${formatMiB(bytes)}; generated media recommended maximum is ${formatMiB(limit.recommended)}`
    )
  }
}

const distBytes = (
  await Promise.all(distFiles.map(async (file) => (await stat(file)).size))
).reduce((sum, size) => sum + size, 0)

if (distBytes > 900 * MiB) {
  failures.push(`dist is ${formatMiB(distBytes)}; hard limit is 900 MiB`)
} else if (distBytes > 500 * MiB) {
  warnings.push(`dist is ${formatMiB(distBytes)}; warning threshold is 500 MiB`)
}

for (const message of warnings) console.warn(`WARN ${message}`)
for (const message of failures) console.error(`FAIL ${message}`)

console.log(
  `Asset budget complete: ${distFiles.length} dist file(s), ${formatMiB(distBytes)}, ${warnings.length} warning(s), ${failures.length} failure(s).`
)

if (failures.length > 0) process.exit(1)
