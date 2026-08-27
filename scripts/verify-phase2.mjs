import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

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

function distFile(path) {
  return resolve(dist, path)
}

function readDist(path) {
  return readFileSync(distFile(path), 'utf8')
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function collectionEntries(directory) {
  const base = resolve(root, directory)
  const entries = []

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name)
      if (entry.isDirectory()) walk(absolute)
      if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name))) {
        const source = readFileSync(absolute, 'utf8')
        const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
        const rawDate = frontmatter.match(/^publishDate:\s*(.+)$/m)?.[1]?.trim() ?? ''
        entries.push({
          date: new Date(rawDate),
          draft: /^draft:\s*true\s*$/m.test(frontmatter),
          id: relative(base, absolute)
            .replace(/\\/g, '/')
            .replace(/\.(?:md|mdx)$/, '')
            .toLocaleLowerCase('en-US')
        })
      }
    }
  }

  walk(base)
  return entries
}

function publishedRecent(directory) {
  return collectionEntries(directory)
    .filter((entry) => !entry.draft)
    .sort((left, right) => {
      const byDate = right.date.getTime() - left.date.getTime()
      if (byDate !== 0) return byDate
      if (left.id === right.id) return 0
      return left.id < right.id ? -1 : 1
    })
}

function idsIn(segment) {
  return [...segment.matchAll(/data-content-id="([^"]+)"/g)].map((match) => match[1])
}

function segmentAfter(html, marker, until) {
  const start = html.indexOf(marker)
  if (start < 0) return ''
  const end = html.indexOf(until, start)
  return html.slice(start, end < 0 ? html.length : end)
}

expect(existsSync(dist), 'production dist exists')
expect(existsSync(distFile('home/index.html')), 'Home output exists')

if (existsSync(distFile('home/index.html'))) {
  const home = readDist('home/index.html')
  const homeOrder = [
    'data-home-hero',
    'data-home-waves',
    'data-home-random-saying',
    'data-home-writing-grid',
    'data-blog-timeline'
  ]
  const positions = homeOrder.map((marker) => home.indexOf(marker))
  expect(positions.every((position) => position >= 0), 'Home exposes all Phase 2 section contracts')
  expect(
    positions.every((position, index) => index === 0 || position > positions[index - 1]),
    'Home section contracts follow Hero → waves → Saying → writing → timeline order'
  )

  const slides = [...home.matchAll(/data-slide-index="(\d+)"/g)].map((match) => Number(match[1]))
  expect(JSON.stringify(slides) === JSON.stringify([0, 1, 2, 3, 4, 5]), 'Hero has six ordered slides')
  expect((home.match(/href="#gentle-wave"/g) ?? []).length === 4, 'Hero has four LargeSkull wave layers')
  expect(!home.includes('https://s2.loli.net/'), 'Home does not hotlink LargeSkull image assets')

  for (const asset of [
    { hash: 'e77260690388904ca6f0ca2b19f5f3206468f97b6d7272a06c920df1d9cb0e6d', path: 'images/largeskull/hero-01.jpg' },
    { hash: '319f2a38009f13e8ae5f1c6cbea9013b74e5408f29b6958fa1ac1571e991b8ca', path: 'images/largeskull/hero-02.webp' },
    { hash: '010664a398386fa5f387764e9c41c28f2bc729151915229dc172fbe11abb9909', path: 'images/largeskull/hero-03.jpg' },
    { hash: '235f105fcc5bbf6ea9acb69f2b75def95fb8f79867be0beafc27fa153da35dc4', path: 'images/largeskull/hero-04.webp' },
    { hash: 'd7f20af3e09c32dd6a1494af6a02383599218131a2796a71c33e4f796bd615c6', path: 'images/largeskull/hero-05.webp' },
    { hash: '277c5db8d016a8993467481d88ad840926adc8d54f8b49de5213e047476f6c0f', path: 'images/largeskull/hero-06.png' }
  ]) {
    const sourcePath = resolve(root, 'public', asset.path)
    expect(existsSync(distFile(asset.path)), `${asset.path} is emitted locally`)
    expect(existsSync(sourcePath) && sha256(sourcePath) === asset.hash, `${asset.path} retains its locked source hash`)
  }

  const expectedBlogs = publishedRecent('src/content/blog').slice(0, 3).map((entry) => entry.id)
  const expectedTraces = publishedRecent('src/content/traces').slice(0, 3).map((entry) => entry.id)
  // Blog cards include their own linked tag <ul>; stop at the sibling Trace
  // column contract instead of the first nested closing list tag.
  const blogSegment = segmentAfter(home, 'data-home-recent-blog-list', 'data-home-traces-column')
  const traceSegment = segmentAfter(home, 'data-home-recent-trace-list', '</section>')
  expect(JSON.stringify(idsIn(blogSegment)) === JSON.stringify(expectedBlogs), 'Home renders the newest three Blog entries on the left')
  expect(JSON.stringify(idsIn(traceSegment)) === JSON.stringify(expectedTraces), 'Home renders the newest three Trace entries on the right')
  expect(!/<img\b/i.test(blogSegment), 'Home Blog cards are text-only')
  expect(
    (blogSegment.match(/data-presentation="arthals-text"/g) ?? []).length === expectedBlogs.length,
    'Home Blog cards are resolved through the Arthals text presentation'
  )
  expect((traceSegment.match(/data-image-source="(?:content|fallback)"/g) ?? []).length === expectedTraces.length, 'Home Trace cards expose a resolved image source')
  expect(
    (traceSegment.match(/data-presentation="large-skull-content"/g) ?? []).length === expectedTraces.length,
    'Home Trace cards are resolved through the LargeSkull content presentation'
  )

  const sayingCatalogMatch = home.match(/<script type="application\/json" data-random-saying-catalog>([\s\S]*?)<\/script>/)
  if (!sayingCatalogMatch) {
    fail('Home emits a published Saying catalog for client-side per-visit selection')
  } else {
    const catalog = JSON.parse(sayingCatalogMatch[1])
    const expectedSayings = publishedRecent('src/content/sayings').map((entry) => entry.id)
    expect(
      JSON.stringify(catalog.map((entry) => entry.id)) === JSON.stringify(expectedSayings),
      'Home random Saying catalog contains every and only published Saying in archive order'
    )
    expect(catalog.every((entry) => entry.href === `/sayings/${entry.id}`), 'Random Saying catalog points to stable detail routes')
    expect(catalog.every((entry) => entry.image?.source === 'decorative'), 'Random Saying catalog carries decorative image assignments')
  }

  const timeline = segmentAfter(home, 'data-blog-timeline', '<footer')
  const allBlogIds = publishedRecent('src/content/blog').map((entry) => entry.id)
  expect(
    allBlogIds.every((id) => timeline.includes(`href="/blog/${id}"`)),
    'Blog timeline links to every published Blog entry'
  )
  expect(!timeline.includes('/traces/'), 'Blog timeline excludes Trace routes')
  expect(!timeline.includes('/sayings/'), 'Blog timeline excludes Saying routes')
  expect(!existsSync(distFile('timeline')), 'No standalone Timeline route is generated')
}

const mediaSource = readFileSync(resolve(root, 'src/data/home-media.ts'), 'utf8')
for (const name of ['heroSlides', 'sayingDecorativeImages', 'traceFallbackImages']) {
  expect(new RegExp(`export const ${name}`).test(mediaSource), `${name} remains an explicit media pool`)
}

const traceArchive = distFile('traces/index.html')
if (existsSync(traceArchive)) {
  const traces = publishedRecent('src/content/traces')
  const html = readDist('traces/index.html')
  expect((html.match(/data-content-type="trace"/g) ?? []).length === traces.length, 'Trace archive renders every published Trace as a Trace card')
  expect((html.match(/data-presentation="large-skull-content"/g) ?? []).length === traces.length, 'Trace archive resolves its default presentation centrally')
  expect((html.match(/<h2[^>]*data-card-title/g) ?? []).length === traces.length, 'Trace archive cards continue the page outline at h2')
  expect(!html.includes('draft-field-note'), 'Trace archive excludes draft content')
}

const sayingArchive = distFile('sayings/index.html')
if (existsSync(sayingArchive)) {
  const sayings = publishedRecent('src/content/sayings')
  const html = readDist('sayings/index.html')
  expect((html.match(/data-content-type="saying"/g) ?? []).length === sayings.length, 'Saying archive renders every published Saying as a decorative card')
  expect((html.match(/data-presentation="large-skull-decorative"/g) ?? []).length === sayings.length, 'Saying archive resolves its default presentation centrally')
  expect((html.match(/<h2[^>]*data-card-title/g) ?? []).length === sayings.length, 'Saying archive cards continue the page outline at h2')
  expect(!html.includes('draft-saying'), 'Saying archive excludes draft content')
}

const cardHost = readFileSync(resolve(root, 'src/components/cards/ContentCard.astro'), 'utf8')
expect(cardHost.includes('resolvePresentation(contentKind, presentationOverride)'), 'Card host owns page override → type default presentation resolution')
for (const path of [
  'src/pages/home/index.astro',
  'src/pages/blog/[...page].astro',
  'src/pages/archives/index.astro',
  'src/pages/tags/[tag]/[...page].astro',
  'src/pages/traces/index.astro',
  'src/pages/sayings/index.astro',
  'src/components/home/RandomSayingCard.astro'
]) {
  expect(readFileSync(resolve(root, path), 'utf8').includes("ContentCard"), `${path} renders through the card host`)
}

const largeSkullCardSource = readFileSync(resolve(root, 'src/components/cards/LargeSkullCard.astro'), 'utf8')
expect(
  largeSkullCardSource.includes('@media (max-width: 767px)') && largeSkullCardSource.includes('flex-direction: column'),
  'LargeSkull cards retain the source viewport-based mobile vertical layout'
)

const heroSource = readFileSync(resolve(root, 'src/components/home/LargeSkullHero.astro'), 'utf8')
for (const className of ['large-skull-hero__artboard', 'large-skull-hero__title', 'large-skull-hero__meta']) {
  expect(heroSource.includes(className), `Hero retains the LargeSkull brand ${className} layer`)
}

const aboutSource = readFileSync(resolve(root, 'src/pages/about/index.astro'), 'utf8')
expect(aboutSource.includes("href='/sayings'"), 'About provides its single complete Sayings archive entry')
expect(!/codetime|shields\.jannchie|hits\.seeyoufarm/i.test(aboutSource), 'About does not render disabled visitor or CodeTime badges')

console.log(`Phase 2 verification complete: ${failures.length} failure(s).`)
if (failures.length > 0) process.exit(1)
