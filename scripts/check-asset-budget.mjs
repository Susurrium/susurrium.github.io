import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { parse } from 'node-html-parser'

import { createInitialAssetInspector } from './lib/initial-asset-budget.mjs'
import { formatMiB, inspectMediaBudgets, mediaLimits, MiB } from './lib/media-budget.mjs'

const root = resolve(process.cwd())
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
    ['public', 'src/assets', 'src/content', 'test/fixtures/reference-images'].map((directory) =>
      filesUnder(resolve(root, directory))
    )
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

const mediaEntries = await Promise.all(
  [...sourceFiles, ...distFiles].map(async (file) => ({
    path: relativePath(file),
    bytes: (await stat(file)).size,
    sha256: mediaLimits[extname(file).toLowerCase()] ? await sha256(file) : undefined
  }))
)
const mediaReport = inspectMediaBudgets(mediaEntries, { verifiedLegacy, legacyFingerprints })
warnings.push(...mediaReport.warnings)
failures.push(...mediaReport.failures)

const distBytes = (
  await Promise.all(distFiles.map(async (file) => (await stat(file)).size))
).reduce((sum, size) => sum + size, 0)

// Count inline code and the local static JS/CSS dependency closure. Third-party
// downloads, dynamic imports and lazy images require browser measurements.
let maximumDocumentBytes = 0
let maximumScriptBytes = 0
let maximumStyleBytes = 0
const inspectInitialAssets = createInitialAssetInspector(resolve(root, 'dist'), distFiles)
for (const file of distFiles.filter((file) => extname(file) === '.html')) {
  const document = await readFile(file)
  const html = parse(document.toString('utf8'))
  const { scripts, styles } = await inspectInitialAssets(
    html,
    `https://budget.invalid/${relativePath(file).slice(5)}`
  )
  maximumDocumentBytes = Math.max(maximumDocumentBytes, document.byteLength)
  maximumScriptBytes = Math.max(maximumScriptBytes, scripts)
  maximumStyleBytes = Math.max(maximumStyleBytes, styles)
  for (const [kind, bytes, recommended, hard] of [
    ['HTML', document.byteLength, 0.25 * MiB, 0.5 * MiB],
    ['local initial JS (gzip)', scripts, 0.2 * MiB, 0.4 * MiB],
    ['local initial CSS (gzip)', styles, 0.1 * MiB, 0.25 * MiB]
  ]) {
    if (bytes > hard)
      failures.push(
        `${relativePath(file)} ${kind} is ${formatMiB(bytes)}; hard limit ${formatMiB(hard)}`
      )
    else if (bytes > recommended)
      warnings.push(
        `${relativePath(file)} ${kind} is ${formatMiB(bytes)}; recommended maximum ${formatMiB(recommended)}`
      )
  }
}
console.log(
  `Maximum per-page costs: HTML ${formatMiB(maximumDocumentBytes)}, local initial JS gzip ${formatMiB(maximumScriptBytes)}, local initial CSS gzip ${formatMiB(maximumStyleBytes)}.`
)

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
