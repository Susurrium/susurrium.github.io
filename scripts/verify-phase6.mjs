import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

const root = resolve(process.cwd())
const dist = resolve(root, 'dist')
const strict = process.argv.includes('--strict')
const failures = []
const warnings = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function warn(message) {
  warnings.push(message)
  console.warn(`WARN ${message}`)
}

function expect(condition, message) {
  if (condition) pass(message)
  else fail(message)
}

function releaseBlocker(condition, message) {
  if (condition) pass(message)
  else if (strict) fail(message)
  else warn(message)
}

function readOutput(path) {
  return readFileSync(resolve(dist, path), 'utf8')
}

function filesUnder(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(['\"])(.*?)\\1`, 'i'))
  return match?.[2] ?? null
}

function absoluteResourceExists(htmlPath, url) {
  const cleanUrl = url.split('#')[0]?.split('?')[0] ?? ''
  if (
    !cleanUrl ||
    cleanUrl.startsWith('#') ||
    /^(?:data|mailto|tel|javascript):/i.test(cleanUrl) ||
    /^(?:https?:)?\/\//i.test(cleanUrl)
  ) {
    return true
  }

  const file = cleanUrl.startsWith('/')
    ? resolve(dist, cleanUrl.replace(/^\/+/, ''))
    : resolve(dirname(htmlPath), cleanUrl)
  return existsSync(file) || existsSync(resolve(file, 'index.html'))
}

/**
 * Music sources are assigned by the persistent client player rather than
 * emitted as static <audio src> markup. Check the declared catalogue against
 * public/ directly so the final release gate can still prove that every daily
 * selection has a real, same-origin file to play.
 */
function localPublicAssetExists(url) {
  const cleanUrl = url.split('#')[0]?.split('?')[0] ?? ''
  if (!cleanUrl.startsWith('/') || cleanUrl.startsWith('//')) return false

  const publicDirectory = resolve(root, 'public')
  const asset = resolve(publicDirectory, cleanUrl.replace(/^\/+/, ''))
  const assetRelativePath = relative(publicDirectory, asset)
  return (
    !assetRelativePath.startsWith('..') && !assetRelativePath.includes(':') && existsSync(asset)
  )
}

function firstPaths(paths) {
  return paths.slice(0, 5).join(', ')
}

function resourceUrls(tag) {
  const urls = [attribute(tag, 'src'), attribute(tag, 'href'), attribute(tag, 'poster')].filter(
    Boolean
  )
  const srcset = attribute(tag, 'srcset')
  if (srcset) {
    for (const candidate of srcset.split(',')) {
      const [url] = candidate.trim().split(/\s+/, 1)
      if (url) urls.push(url)
    }
  }
  return [...new Set(urls)]
}

const requiredOutputs = [
  'index.html',
  'home/index.html',
  '404.html',
  'search/index.html',
  'robots.txt',
  'rss.xml',
  'sitemap-index.xml',
  'sitemap-0.xml'
]

expect(existsSync(dist), 'production dist exists')
for (const path of requiredOutputs) {
  expect(existsSync(resolve(dist, path)), `${path} exists in the production output`)
}

const entrance = existsSync(resolve(dist, 'index.html')) ? readOutput('index.html') : ''
const home = existsSync(resolve(dist, 'home/index.html')) ? readOutput('home/index.html') : ''
const notFound = existsSync(resolve(dist, '404.html')) ? readOutput('404.html') : ''
const search = existsSync(resolve(dist, 'search/index.html')) ? readOutput('search/index.html') : ''
const robots = existsSync(resolve(dist, 'robots.txt')) ? readOutput('robots.txt') : ''
const rss = existsSync(resolve(dist, 'rss.xml')) ? readOutput('rss.xml') : ''
const sitemapIndex = existsSync(resolve(dist, 'sitemap-index.xml'))
  ? readOutput('sitemap-index.xml')
  : ''
const sitemap = existsSync(resolve(dist, 'sitemap-0.xml')) ? readOutput('sitemap-0.xml') : ''

expect(
  entrance.includes('name="robots" content="noindex, follow"') &&
    entrance.includes('https://susurrium.github.io/home'),
  'replayable entrance remains noindex with /home as its canonical destination'
)
expect(
  home.includes('rel="canonical" href="https://susurrium.github.io/home"') &&
    home.includes('name="description"') &&
    home.includes('property="og:image"') &&
    home.includes('application/rss+xml'),
  'Home emits canonical, description, Open Graph and RSS discovery metadata'
)
expect(
  notFound.includes('name="robots" content="noindex, follow"') && notFound.includes('<h1'),
  '404 page is discoverable to users but excluded from search indexing'
)
expect(
  search.includes('name="robots" content="noindex, follow"') && search.includes('site-search'),
  'search utility page is noindex while retaining its local search interface'
)
expect(
  robots.includes('Sitemap: https://susurrium.github.io/sitemap-index.xml'),
  'robots.txt advertises the canonical sitemap URL'
)
expect(
  sitemapIndex.includes('https://susurrium.github.io/sitemap-0.xml') &&
    sitemap.includes('https://susurrium.github.io/home') &&
    !sitemap.includes('<loc>https://susurrium.github.io</loc>') &&
    !sitemap.includes('draft-field-note') &&
    !sitemap.includes('draft-saying'),
  'sitemap contains public indexable routes while excluding the noindex entrance and draft fixtures'
)
expect(
  rss.includes('<rss') &&
    rss.includes('https://susurrium.github.io/blog/') &&
    !/<(?:link|guid)[^>]*>https:\/\/susurrium\.github\.io\/traces\//i.test(rss),
  'RSS remains a Blog-only feed with canonical URLs'
)
expect(
  !/(?:src|url)=(['"])(?:undefined|null)\1/i.test(rss),
  'RSS omits optional media elements instead of emitting undefined/null URLs'
)

const htmlFiles = filesUnder(dist).filter((file) => file.endsWith('.html'))
const htmlEntries = htmlFiles.map((file) => ({
  file,
  path: relative(dist, file).replaceAll('\\', '/'),
  text: readFileSync(file, 'utf8')
}))

const contentDetailPages = htmlEntries.filter(({ path }) =>
  /^(?:blog|traces|sayings)\/(?!\d+\/)[^/]+\/index\.html$/.test(path)
)
const inaccessibleMobileTocs = contentDetailPages.filter(
  ({ text }) =>
    !(
      text.includes('aria-controls="sidebar"') &&
      text.includes('aria-expanded="false"') &&
      text.includes('aria-label="Close table of contents"')
    )
)
expect(
  inaccessibleMobileTocs.length === 0,
  inaccessibleMobileTocs.length === 0
    ? 'detail pages expose an accessible mobile table-of-contents control contract'
    : `${inaccessibleMobileTocs.length} detail page(s) lack the mobile table-of-contents accessibility contract (${firstPaths(
        inaccessibleMobileTocs.map(({ path }) => path)
      )})`
)
expect(
  readFileSync(resolve(root, 'src/layouts/ContentLayout.astro'), 'utf8').includes(
    'prefers-reduced-motion'
  ),
  'mobile table-of-contents animation has a reduced-motion override'
)

const missingLanguage = htmlEntries.filter(
  ({ text }) => !/<html\b[^>]*\blang=['"][^'"]+['"]/i.test(text)
)
expect(missingLanguage.length === 0, 'every static HTML document declares a document language')

const missingImageAlt = []
const insecureBlankLinks = []
const missingLocalResources = []
const externalRuntimeResources = new Map()

for (const entry of htmlEntries) {
  for (const tag of entry.text.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt(?:\s*=|\s|>)/i.test(tag)) missingImageAlt.push(entry.path)
  }

  for (const tag of entry.text.match(/<a\b[^>]*>/gi) ?? []) {
    if (
      attribute(tag, 'target') === '_blank' &&
      !/\brel\s*=\s*(['"])[^'"]*\b(?:noopener|noreferrer)\b/i.test(tag)
    ) {
      insecureBlankLinks.push(entry.path)
    }
  }

  for (const tag of entry.text.match(/<(?:script|link|img|audio|video|source|iframe)\b[^>]*>/gi) ??
    []) {
    for (const url of resourceUrls(tag)) {
      if (!absoluteResourceExists(entry.file, url))
        missingLocalResources.push(`${entry.path}: ${url}`)

      if (/^https?:\/\//i.test(url)) {
        const tagName = tag.match(/^<([a-z]+)/i)?.[1]?.toLowerCase()
        const hostname = new URL(url).hostname
        const sameOrigin = hostname === 'susurrium.github.io'
        if (!sameOrigin && tagName !== 'link') {
          const key = `${tagName}:${hostname}`
          externalRuntimeResources.set(key, (externalRuntimeResources.get(key) ?? 0) + 1)
        }
        if (
          !sameOrigin &&
          tagName === 'link' &&
          /\brel\s*=\s*(['"])(?:stylesheet|preload)\1/i.test(tag)
        ) {
          const key = `${tagName}:${hostname}`
          externalRuntimeResources.set(key, (externalRuntimeResources.get(key) ?? 0) + 1)
        }
      }
    }
  }
}

expect(missingLocalResources.length === 0, 'static HTML resource references resolve inside dist')
releaseBlocker(
  missingImageAlt.length === 0,
  missingImageAlt.length === 0
    ? 'all static images have an explicit alt decision'
    : `${missingImageAlt.length} image(s) lack alt text (${firstPaths([...new Set(missingImageAlt)])})`
)
releaseBlocker(
  insecureBlankLinks.length === 0,
  insecureBlankLinks.length === 0
    ? 'all target=_blank links include a safe rel policy'
    : `${insecureBlankLinks.length} target=_blank link(s) lack noopener/noreferrer (${firstPaths([
        ...new Set(insecureBlankLinks)
      ])})`
)
releaseBlocker(
  externalRuntimeResources.size === 0,
  externalRuntimeResources.size === 0
    ? 'production HTML has no external script, style or media runtime resource'
    : `production HTML still loads external runtime resources: ${[...externalRuntimeResources]
        .map(([key, count]) => `${key} (${count})`)
        .join(', ')}`
)

const clientRuntimeEntries = [
  ...filesUnder(dist)
    .filter((file) => file.endsWith('.js'))
    .map((file) => ({
      path: relative(dist, file).replaceAll('\\', '/'),
      text: readFileSync(file, 'utf8')
    })),
  ...htmlEntries.flatMap(({ path, text }) =>
    [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match, index) => ({
      path: `${path}#inline-script-${index + 1}`,
      text: match[1]
    }))
  )
]
const forbiddenClientApis = [
  {
    label: 'GitHub repository-card runtime API',
    pattern: /api\.github\.com\/repos\//i
  },
  {
    label: 'disabled Waline runtime endpoint',
    pattern: /waline\.arthals\.ink/i
  },
  {
    label: 'disabled Waline pageview client runtime',
    pattern: /@waline\/client(?:@|\/)|waline-pageview-count|waline-comment-count/i
  }
]

for (const { label, pattern } of forbiddenClientApis) {
  const matches = clientRuntimeEntries
    .filter((entry) => pattern.test(entry.text))
    .map(({ path }) => path)
  releaseBlocker(
    matches.length === 0,
    matches.length === 0
      ? `${label} is absent from client-delivered production assets`
      : `${label} remains in ${matches.length} client-delivered file(s) (${firstPaths(matches)})`
  )
}

const generatedCss = filesUnder(dist).filter((file) => file.endsWith('.css'))
const externalCssUrls = generatedCss.filter((file) =>
  /(?:url\(\s*|@import\s+(?:url\()?\s*['"]?)https?:\/\//i.test(readFileSync(file, 'utf8'))
)
expect(externalCssUrls.length === 0, 'generated CSS does not hotlink or import external assets')

const residenceSource = readFileSync(resolve(root, 'src/data/residence.ts'), 'utf8')
const residenceUrls = residenceSource.match(/https:\/\/[^'"\s]+/g) ?? []
expect(
  residenceUrls.length > 0 &&
    residenceUrls.every((url) => new URL(url).hostname === 'basemaps.cartocdn.com'),
  'the only declared client map runtime is the allowlisted CARTO style service'
)

const musicSource = readFileSync(resolve(root, 'src/data/music.ts'), 'utf8')
const musicCatalogueMatch = musicSource.match(/export const dailyMusic[^=]*=\s*\[([\s\S]*?)\n\]/)
const musicCatalogue = musicCatalogueMatch?.[1] ?? ''
const musicTrackIds = [...musicCatalogue.matchAll(/\bid\s*:\s*['"][^'"]+['"]/g)]
const musicAudioSources = [...musicCatalogue.matchAll(/\baudioSrc\s*:\s*['"]([^'"]+)['"]/g)].map(
  (match) => match[1]
)
const hasMusicFixture = /本地占位曲目|尚未配置可播放音频/.test(musicCatalogue)
releaseBlocker(
  musicTrackIds.length > 0 &&
    musicAudioSources.length === musicTrackIds.length &&
    musicAudioSources.every((source) => localPublicAssetExists(source)) &&
    !hasMusicFixture,
  'every daily music track has a non-placeholder same-origin audio file in public/'
)

const markerChecks = [
  { label: 'temporary LargeSkull image descriptions', pattern: /LargeSkull temporary image/i },
  { label: 'temporary Saying fixture text', pattern: /Temporary development saying/i },
  { label: 'temporary residence location label', pattern: /位置占位/i },
  { label: 'Arthals identity/configuration', pattern: /Arthals(?:&#39;|')? ink|\bArthals\b/i },
  { label: 'upstream author/profile references', pattern: /zhuozhiyongde/i },
  { label: 'upstream Arthals domain references', pattern: /(?:cdn\.)?arthals\.ink/i }
]

for (const { label, pattern } of markerChecks) {
  const matches = htmlEntries.filter(({ text }) => pattern.test(text)).map(({ path }) => path)
  releaseBlocker(
    matches.length === 0,
    matches.length === 0
      ? `${label} has been replaced for release`
      : `${label} remains in ${matches.length} generated page(s) (${firstPaths(matches)})`
  )
}

const deployWorkflow = readFileSync(resolve(root, '.github/workflows/deploy.yml'), 'utf8')
expect(
  /^\s*workflow_dispatch\s*:/m.test(deployWorkflow) && !/^\s*push\s*:/m.test(deployWorkflow),
  'Pages deployment remains manual while the fixture-content release gate is open'
)
expect(
  deployWorkflow.indexOf('run: bun run release:gate') >= 0 &&
    deployWorkflow.indexOf('run: bun run release:gate') <
      deployWorkflow.indexOf('uses: actions/upload-pages-artifact@v5'),
  'Pages workflow cannot upload an artifact without the strict release gate'
)

console.log(
  `Phase 6 ${strict ? 'strict release gate' : 'readiness audit'} complete: ${failures.length} failure(s), ${warnings.length} warning(s).`
)
if (failures.length > 0) process.exit(1)
