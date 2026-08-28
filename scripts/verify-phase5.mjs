import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const dist = resolve(root, 'dist')
const failures = []

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function expect(condition, message) {
  if (condition) pass(message)
  else fail(message)
}

function source(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function output(path) {
  return readFileSync(resolve(dist, path), 'utf8')
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

const localAssets = [
  {
    path: 'media/effects/tnxg-background-aijo-karen.webp',
    hash: 'bdfa95bf30097a9bd10500e8847c33bbf28cbf9a7013f933db3f63b5ea57f511'
  },
  {
    path: 'media/residence/skywt-plane.png',
    hash: '6139475bcd1bda273eee07cde12aa71441174bb0900213ad8bff34379a87ea81'
  },
  {
    path: 'media/residence/skywt-plane-shadow.png',
    hash: '03f6072b1cc94215798f51f6dfa52186fb52e50e9637d655cdb41d203f960565'
  },
  {
    path: 'media/residence/skywt-cloud.png',
    hash: 'd8aaab9f2c82b9553418ecad218954b4a013b7a2b3ed31865b1e0e74b3b5d49c'
  },
  {
    path: 'media/residence/residence-map.svg',
    hash: 'a078e00f0ff7676349a4f0bcc445a7817bca2757f3eaca53da8bea53a49472c0'
  },
  {
    path: 'media/residence/visitor-avatar.svg',
    hash: '278fa0d90c15e9a59d8484ecc8cbafcb76c5b0ffcf0ea6acb309ffe8d56b719b'
  },
  {
    path: 'vendor/maplibre-gl@5.24.0/maplibre-gl.js',
    hash: '45a9b07a9189ce56054c620a947ccf41e291e58c95e9b61533b740aaa65ee5cb'
  },
  {
    path: 'vendor/maplibre-gl@5.24.0/maplibre-gl.css',
    hash: 'ab1e70d59ec40465bae7e7030da2f3ccf28133fd502e62bd598eefbadfd7a732'
  }
]

expect(existsSync(dist), 'production dist exists')
for (const asset of localAssets) {
  const publicAsset = resolve(root, 'public', asset.path)
  const outputAsset = resolve(dist, asset.path)
  expect(existsSync(publicAsset), `${asset.path} is checked in as a local source asset`)
  expect(existsSync(outputAsset), `${asset.path} is emitted by the production build`)
  expect(existsSync(publicAsset) && sha256(publicAsset) === asset.hash, `${asset.path} retains its locked source hash`)
}

const residenceCard = source('src/components/home/ResidenceCard.astro')
const residenceController = source('src/scripts/residence-map.ts')
const heatmap = source('src/components/home/GitHubContributionHeatmap.astro')
const contributionData = source('src/data/github-contributions.ts')
const heatmapStyles = source('src/assets/styles/github-contribution-heatmap.css')
const companion = source('src/components/effects/ScrollCompanion.astro')
const baseLayout = source('src/layouts/BaseLayout.astro')

expect(
  residenceCard.includes('data-residence-map') &&
    residenceCard.includes('FlightOverlay') &&
    residenceController.includes('mapLibreScriptUrl') &&
    residenceController.includes("document.createElement('script')") &&
    residenceController.includes('data-residence-maplibre') &&
    residenceController.includes("script.addEventListener('load'") &&
    residenceController.includes("script.addEventListener('error'") &&
    !residenceController.includes('import(/* @vite-ignore */') &&
    residenceController.includes('mapLibreCssUrl') &&
    residenceController.includes('IntersectionObserver') &&
    residenceController.includes("'astro:before-swap'") &&
    residenceController.includes("'astro:page-load'"),
  'residence preserves lazy MapLibre loading and ClientRouter teardown/re-entry'
)
expect(
  heatmap.includes("username = 'Susurrium'") &&
    heatmap.includes('githeatmap-grid') &&
    contributionData.includes('Promise.allSettled') &&
    contributionData.includes('GITHUB_FETCH_TIMEOUT') &&
    contributionData.includes('createGitHubContributionHeatmapSkeleton'),
  'heatmap preserves HanLife 53-week structure with no-token failure fallback'
)
expect(
  companion.includes('travel * 140') &&
    companion.includes('travel * 42') &&
    companion.includes('progress <= 0.25') &&
    companion.includes("progress / 0.35") &&
    companion.includes('data-src={resolvedSrc}') &&
    companion.includes('activateImage') &&
    companion.includes('deactivateImage') &&
    !companion.includes('companion-breathe'),
  'About companion uses the current TNXG formula without historical breathing or hidden-view downloads'
)
expect(
  heatmapStyles.includes('.githeatmap-link:focus-visible') && heatmapStyles.includes('outline: 2px solid'),
  'heatmap retains a visible keyboard focus indicator'
)
expect(
  baseLayout.includes("effectProfiles[effectProfile].companion") && baseLayout.includes('<ScrollCompanion />'),
  'BaseLayout mounts the companion only for its explicit route profile'
)

const home = existsSync(resolve(dist, 'home/index.html')) ? output('home/index.html') : ''
const about = existsSync(resolve(dist, 'about/index.html')) ? output('about/index.html') : ''
const traceOutputDirectory = resolve(dist, 'traces')
const traceDetailDirectory = existsSync(traceOutputDirectory)
  ? readdirSync(traceOutputDirectory, { withFileTypes: true }).find((entry) => entry.isDirectory())?.name
  : undefined
const traceDetailOutput = traceDetailDirectory ? `traces/${traceDetailDirectory}/index.html` : undefined
const reading = traceDetailOutput && existsSync(resolve(dist, traceDetailOutput)) ? output(traceDetailOutput) : ''

expect(home.includes('data-residence-map'), 'Home emits the residence scene')
expect(home.includes('githeatmap-link') && home.includes('github.com/Susurrium'), 'Home emits the GitHub contribution heatmap')
expect(about.includes('<scroll-companion') && about.includes('/media/effects/tnxg-background-aijo-karen.webp'), 'About emits the local TNXG companion')
expect(Boolean(traceDetailOutput), 'production build emits a Trace detail page for reading-profile regression')
expect(!reading.includes('<scroll-companion'), 'reading pages do not emit the About companion')
expect(
  ![home, about, reading].join('\n').includes('cdn.tnxg.top/images/cover/background_aijo_karen.webp'),
  'production HTML never hotlinks the TNXG companion asset'
)

console.log(`Phase 5 verification complete: ${failures.length} failure(s).`)
if (failures.length > 0) process.exit(1)
