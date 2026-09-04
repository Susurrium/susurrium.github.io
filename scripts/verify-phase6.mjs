import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import {
  arthalsMarkerText,
  isEditorialContentPage,
  stripAllowedArthalsFriend
} from './release-marker-policy.mjs'

const root = resolve(process.cwd())
const dist = resolve(root, 'dist')
const strict = process.argv.includes('--strict')
const showExternalDetails = process.argv.includes('--external-details')
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

const allowedMusicRuntimePaths = new Set([
  '/anzhiyu-theme-static@1.0.0/aplayer/APlayer.min.css',
  '/anzhiyu-blog-static@1.0.1/js/APlayer.min.js',
  '/hexo-anzhiyu-music@1.0.1/assets/js/Meting2.min.js'
])

const allowedUmamiRuntimePaths = new Set(['/script.js'])
const allowedCodeTimeRuntimePaths = new Set(['/endpoint'])

function isAllowedMusicRuntime(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'cdn.cbd.int' && allowedMusicRuntimePaths.has(parsed.pathname)
  } catch {
    return false
  }
}

function isAllowedUmamiRuntime(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'cloud.umami.is' && allowedUmamiRuntimePaths.has(parsed.pathname)
  } catch {
    return false
  }
}

function isAllowedCodeTimeRuntime(url) {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === 'shields.jannchie.com' && allowedCodeTimeRuntimePaths.has(parsed.pathname)
    )
  } catch {
    return false
  }
}

function isAllowedExternalRuntime(url) {
  return isAllowedMusicRuntime(url) || isAllowedUmamiRuntime(url) || isAllowedCodeTimeRuntime(url)
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

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#38;|&#x26;/gi, '&')
}

/**
 * Release content checks must describe what a visitor (including an assistive
 * technology user) can receive from the rendered DOM. Do not scan source
 * comments, CSS class names, or bundled JavaScript for editorial markers.
 */
function visibleText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<!--[^]*?-->/g, ' ')
      .replace(/<(?:script|style|template)\b[^>]*>[^]*?<\/(?:script|style|template)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function renderedAttributeText(html) {
  const values = []
  const tags = html.match(/<(?:a|img|audio|video|source|iframe|link|meta)\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    for (const name of ['href', 'src', 'poster', 'alt', 'title', 'aria-label', 'content']) {
      const value = attribute(tag, name)
      if (value) values.push(value)
    }
  }
  return decodeHtmlEntities(values.join(' '))
}

const allowedFriendAvatarUrls = new Set()
let linksManifest = null
try {
  linksManifest = JSON.parse(readFileSync(resolve(root, 'public/links.json'), 'utf8'))
  for (const group of linksManifest?.friends ?? []) {
    for (const friend of group?.link_list ?? []) {
      if (typeof friend?.avatar === 'string') allowedFriendAvatarUrls.add(friend.avatar)
    }
  }
} catch {
  // The links page has its own required-output check; an unreadable manifest
  // should not turn the general resource audit into a parser error.
}

function isAllowedFriendAvatar(url) {
  const normalized = decodeHtmlEntities(url)
  return allowedFriendAvatarUrls.has(url) || allowedFriendAvatarUrls.has(normalized)
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
    !/<(?:link|guid)[^>]*>https:\/\/susurrium\.github\.io\/traces\//i.test(rss),
  'RSS remains a valid Blog-only feed (including the empty-feed case)'
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
  /^(?:blog|traces|sayings)\/[^/]+\/index\.html$/.test(path) &&
  !path.includes('/tags/')
)
// Published editorial content may mention upstream projects or other marker
// text as part of its subject matter. Keep marker checks focused on
// site-owned/generated pages while retaining structural and resource checks
// for every HTML document, including article detail pages.
const releaseMarkerEntries = htmlEntries.filter(({ path }) => !isEditorialContentPage(path))
// A taxonomy result page has content cards too, but it is not a reading
// document.  Require the reading-shell marker so pagination/taxonomy output
// cannot be mistaken for an article and incorrectly fail the TOC audit.
const readingDetailPages = contentDetailPages.filter(({ text }) =>
  text.includes('data-pagefind-body')
)
// The reading shell intentionally omits the sidebar when an article has no
// headings. Only pages that actually render a TOC need the mobile trigger
// contract; treating heading-less pages as failures would reject their valid
// compact layout.
const tocDetailPages = readingDetailPages.filter(({ text }) => text.includes('id="sidebar"'))
const inaccessibleMobileTocs = tocDetailPages.filter(
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
    ? `detail pages with headings expose an accessible mobile table-of-contents control contract (${tocDetailPages.length} checked)`
    : `${inaccessibleMobileTocs.length} detail page(s) with headings lack the mobile table-of-contents accessibility contract (${firstPaths(
        inaccessibleMobileTocs.map(({ path }) => path)
      )})`
)
expect(
  !existsSync(resolve(dist, 'tags')),
  'legacy aggregate /tags output is absent from the release build'
)
for (const path of ['blog/tags/index.html', 'traces/tags/index.html', 'sayings/tags/index.html']) {
  expect(existsSync(resolve(dist, path)), `${path} scoped taxonomy index is present`)
}
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
// Keep a bounded, actionable inventory for resources that still need an
// individual release decision.  Grouping by tag/host keeps the gate readable;
// retaining exact URLs and pages makes the warning useful for reviewing
// article media one item at a time. Normal output shows a bounded sample;
// `--external-details` prints the complete inventory for an audit pass.
const externalRenderedResources = new Map()

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
        const approvedFriendAvatar = tagName === 'img' && isAllowedFriendAvatar(url)
        if (!sameOrigin && !isAllowedExternalRuntime(url) && !approvedFriendAvatar) {
          const key = `${tagName}:${hostname}`
          const record = externalRenderedResources.get(key) ?? {
            count: 0,
            pages: new Set(),
            urls: new Set()
          }
          record.count += 1
          record.urls.add(url)
          record.pages.add(entry.path)
          externalRenderedResources.set(key, record)
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
  externalRenderedResources.size === 0,
  externalRenderedResources.size === 0
    ? 'production HTML has no unapproved external rendered resource'
    : `production HTML still loads unapproved external rendered resources: ${[
        ...externalRenderedResources
      ]
        .map(([key, { count, pages, urls }]) => {
          const shownUrls = showExternalDetails ? [...urls] : [...urls].slice(0, 8)
          const shownPages = showExternalDetails ? [...pages] : [...pages].slice(0, 8)
          const suffix = showExternalDetails ? '' : ' (use --external-details for all)'
          return `${key} (${count}; urls: ${shownUrls.join(' | ')}; pages: ${shownPages.join(' | ')}${suffix})`
        })
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
const siteConfigSource = readFileSync(resolve(root, 'src/site.config.ts'), 'utf8')
const walineEnabled = /waline:\s*{[\s\S]*?\benable:\s*true\b/.test(siteConfigSource)
const walineServer =
  siteConfigSource.match(/waline:\s*{[\s\S]*?\bserver:\s*['"]([^'"]+)['"]/)?.[1] ?? ''
const forbiddenClientApis = [
  {
    label: 'GitHub repository-card runtime API',
    pattern: /api\.github\.com\/repos\//i
  },
  {
    label: 'legacy Waline runtime endpoint',
    pattern: /waline\.arthals\.ink/i
  },
  ...(walineEnabled
    ? []
    : [
        {
          label: 'disabled Waline pageview client runtime',
          pattern: /@waline\/client(?:@|\/)|waline-pageview-count|waline-comment-count/i
        }
      ])
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
if (walineEnabled) {
  expect(
    walineServer.length > 0 && clientRuntimeEntries.some(({ text }) => text.includes(walineServer)),
    'enabled Waline runtime points to the configured server'
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
releaseBlocker(
  /export const musicConfig/.test(musicSource) &&
    /server:\s*['"]netease['"]/.test(musicSource) &&
    /type:\s*['"]playlist['"]/.test(musicSource) &&
    /api\.injahow\.cn\/meting\//.test(musicSource) &&
    /id:\s*['"]12812783625['"]/.test(musicSource),
  'music uses the temporary public NetEase Meting playlist'
)

const markerChecks = [
  { label: 'temporary Media image descriptions', pattern: /Media temporary image/i },
  { label: 'temporary Saying fixture text', pattern: /Temporary development saying/i },
  {
    label: 'Friend Circle local snapshot placeholder',
    pattern: /Friend Circle is being prepared\./i
  },
  { label: 'Arthals identity/configuration', pattern: /Arthals(?:&#39;|')? ink|\bArthals\b/i },
  { label: 'upstream author/profile references', pattern: /zhuozhiyongde/i },
  { label: 'upstream Arthals domain references', pattern: /(?:cdn\.)?arthals\.ink/i }
]

for (const { label, pattern } of markerChecks) {
  const matches = releaseMarkerEntries
    .filter(({ path, text }) =>
      pattern.test(
        label === 'Arthals identity/configuration' || label === 'upstream Arthals domain references'
          ? stripAllowedArthalsFriend({
              path,
              markerText: arthalsMarkerText({
                visibleText: visibleText(text),
                renderedAttributeText: renderedAttributeText(text)
              }),
              linksManifest
            })
          : `${visibleText(text)} ${renderedAttributeText(text)}`
      )
    )
    .map(({ path }) => path)
  releaseBlocker(
    matches.length === 0,
    matches.length === 0
      ? `${label} has been replaced for release`
      : `${label} remains in ${matches.length} generated page(s) (${firstPaths(matches)})`
  )
}

const residencePlaceholderPages = htmlEntries
  .filter(({ text }) => /位置占位/i.test(`${visibleText(text)} ${renderedAttributeText(text)}`))
  .map(({ path }) => path)
releaseBlocker(
  residencePlaceholderPages.length === 0,
  residencePlaceholderPages.length === 0
    ? 'residence rendered output has no temporary location label'
    : `residence rendered output still contains a temporary location label (${firstPaths(
        residencePlaceholderPages
      )})`
)

const deployWorkflow = readFileSync(resolve(root, '.github/workflows/deploy.yml'), 'utf8')
const hasManualPagesTrigger = /^[ \t]*workflow_dispatch:[ \t]*$/m.test(deployWorkflow)
const hasPushTrigger = /^[ \t]*push:[ \t]*$/m.test(deployWorkflow)
const hasMainOnlyPushTrigger =
  /^[ \t]*push:[ \t]*\r?\n[ \t]+branches:[ \t]*\[[ \t]*main[ \t]*\][ \t]*$/m.test(deployWorkflow)
const releaseAuditIsClean = failures.length === 0 && warnings.length === 0
expect(
  hasManualPagesTrigger && (!hasPushTrigger || (hasMainOnlyPushTrigger && releaseAuditIsClean)),
  releaseAuditIsClean
    ? 'Pages deployment is manual or restricted to main after a clean release audit'
    : 'Pages deployment remains manual while release gate findings exist'
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
