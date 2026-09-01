import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(process.cwd())
const dist = resolve(root, process.env.VERIFY_DIST_DIR ?? 'dist')
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

  // Empty content collections are valid and Git does not preserve empty
  // directories. Keep verification deterministic for both representations.
  if (!existsSync(base)) return entries

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name)
      if (entry.isDirectory()) walk(absolute)
      if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name))) {
        const source = readFileSync(absolute, 'utf8')
        const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
        const rawDate = frontmatter.match(/^publishDate:\s*(.+)$/m)?.[1]?.trim() ?? ''
        entries.push({
          date: rawDate ? new Date(rawDate) : undefined,
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

function publishedRecent(directory, { byDate = true } = {}) {
  return collectionEntries(directory)
    .filter((entry) => !entry.draft)
    .sort((left, right) => {
      const leftTime = left.date?.getTime()
      const rightTime = right.date?.getTime()
      if (byDate && Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
        const dateDifference = rightTime - leftTime
        if (dateDifference !== 0) return dateDifference
      } else if (byDate && Number.isFinite(leftTime)) {
        return -1
      } else if (byDate && Number.isFinite(rightTime)) {
        return 1
      }
      if (left.id === right.id) return 0
      return left.id < right.id ? -1 : 1
    })
}

const chinaYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric'
})

function yearInChina(date) {
  return Number(chinaYearFormatter.format(date))
}

function idsIn(segment) {
  return [...segment.matchAll(/data-content-id="([^"]+)"/g)].map((match) => match[1])
}

function archivePagePaths(route) {
  const archiveRoot = distFile(route)
  const paths = []
  const indexPath = join(route, 'index.html')
  if (existsSync(distFile(indexPath))) paths.push(indexPath)
  if (!existsSync(archiveRoot)) return paths

  for (const entry of readdirSync(archiveRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue
    const pagePath = join(route, entry.name, 'index.html')
    if (existsSync(distFile(pagePath))) paths.push(pagePath)
  }

  return paths.sort((left, right) => {
    const pageNumber = (path) => (path === indexPath ? 1 : Number(path.split(/[\\/]/)[1]))
    return pageNumber(left) - pageNumber(right)
  })
}

function configuredPagination(kind) {
  const source = readFileSync(resolve(root, 'src/site.config.ts'), 'utf8')
  const block = source.match(new RegExp(`${kind}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))?.[1] ?? ''
  return {
    enabled: !/\benabled:\s*false\b/.test(block),
    pageSize: Number(block.match(/pageSize:\s*(\d+)/)?.[1] ?? 8)
  }
}

function verifyPaginatedArchive(route, kind, entries, { label, taxonomyPath }) {
  const pagination = configuredPagination(kind)
  const { pageSize } = pagination
  const pages = archivePagePaths(route)
  const expectedPageCount = pagination.enabled
    ? Math.max(1, Math.ceil(entries.length / pageSize))
    : 1
  expect(
    pages.length === expectedPageCount,
    `${label} archive generates ${expectedPageCount} page(s) at pageSize ${pageSize}`
  )
  if (pages.length === 0) return

  const allPageIds = []
  pages.forEach((path, index) => {
    const html = readDist(path)
    const pageIds = idsIn(html)
    allPageIds.push(...pageIds)
    const expectedCount = pagination.enabled
      ? Math.min(pageSize, Math.max(0, entries.length - index * pageSize))
      : entries.length
    expect(
      pageIds.length === expectedCount,
      `${label} page ${index + 1} renders ${expectedCount} card(s)`
    )
    expect(
      index === 0 || /sr-only[^>]*>\s*Previous/i.test(html),
      `${label} page ${index + 1} exposes a previous-page link when applicable`
    )
    expect(
      index === pages.length - 1 || /sr-only[^>]*>\s*Next/i.test(html),
      `${label} page ${index + 1} exposes a next-page link when applicable`
    )
    expect(
      index === pages.length - 1 || html.includes('Next →'),
      `${label} page ${index + 1} uses the shared visible Next button label`
    )
    expect(
      index === 0 || html.includes('← Previous'),
      `${label} page ${index + 1} uses the shared visible Previous button label`
    )
    if (index === 0) verifyArchiveTaxonomy(html, { kind, label, path: taxonomyPath })
  })

  const expectedIds = entries.map((entry) => entry.id)
  expect(
    new Set(allPageIds).size === allPageIds.length,
    `${label} pagination does not duplicate cards across pages`
  )
  expect(
    allPageIds.length === expectedIds.length && expectedIds.every((id) => allPageIds.includes(id)),
    `${label} pagination covers every published entry exactly once`
  )
}

function segmentAfter(html, marker, until) {
  const start = html.indexOf(marker)
  if (start < 0) return ''
  const end = html.indexOf(until, start)
  return html.slice(start, end < 0 ? html.length : end)
}

function verifyArchiveTaxonomy(html, { kind, path, label }) {
  const navigation = segmentAfter(html, 'data-taxonomy-navigation', '</nav>')
  const count = Number(navigation.match(/data-taxonomy-count="(\d+)"/)?.[1] ?? -1)
  const tagActions = (navigation.match(/data-taxonomy-action="tag"/g) ?? []).length
  const links = [...navigation.matchAll(/href="([^"]+)"/g)].map((match) => match[1])

  expect(
    navigation.includes(`data-taxonomy-scope="${kind}"`) && count >= 0,
    `${label} archive exposes a scoped taxonomy navigation with a count`
  )
  if (count < 0) return

  expect(
    tagActions === Math.min(count, 6),
    `${label} archive previews at most six tags and keeps the preview count in sync`
  )
  expect(
    navigation.includes(`href="${path}"`) && navigation.includes('data-taxonomy-action="index"'),
    `${label} archive keeps a direct View all tags entry at ${path}`
  )
  expect(
    count === 0
      ? navigation.includes('data-taxonomy-empty')
      : !navigation.includes('data-taxonomy-empty'),
    `${label} archive reports the empty taxonomy state only when its count is zero`
  )
  expect(
    links.filter((href) => href.startsWith(`${path}/`)).length === tagActions,
    `${label} archive tag chips stay inside the ${kind} taxonomy route`
  )
  expect(
    !links.some(
      (href) =>
        /^\/(?:blog|traces|sayings)\/tags(?:\/|$)/.test(href) &&
        !href.startsWith(`${path}/`) &&
        href !== path
    ),
    `${label} archive taxonomy does not leak another content type's tag route`
  )
}

function verifySearchFilterEntryPoints() {
  const searchSource = readFileSync(resolve(root, 'src/pages/search/index.astro'), 'utf8')
  const filterCall = searchSource.indexOf('<PFSearch')
  const pagefindBranch = searchSource.indexOf('{integ.pagefind')
  expect(
    searchSource.includes('getContentTagBrowserEntries') &&
      searchSource.includes('loadContentCatalog') &&
      filterCall >= 0 &&
      pagefindBranch < filterCall,
    'Search page passes registry-driven tag data into the single Pagefind filter interface'
  )

  const searchOutput = distFile('search/index.html')
  expect(existsSync(searchOutput), 'Search output exists')
  if (!existsSync(searchOutput)) return

  const html = readDist('search/index.html')
  const filterPanel = segmentAfter(html, 'data-search-filter-root', '</aside>')
  const expectedKinds = ['all', 'blog', 'trace', 'saying']
  const kinds = [...filterPanel.matchAll(/data-search-filter-type="([^"]+)"/g)].map(
    (match) => match[1]
  )
  expect(
    expectedKinds.every((kind) => kinds.includes(kind)),
    'Search page exposes All, Blog, Trace, and Saying content-type filters'
  )
  expect(
    kinds.indexOf('all') < kinds.indexOf('blog') &&
      kinds.indexOf('blog') < kinds.indexOf('trace') &&
      kinds.indexOf('trace') < kinds.indexOf('saying'),
    'Search content-type filters keep the registry order after All'
  )
  expect(
    filterPanel.includes('data-search-filter-tags="blog"') &&
      filterPanel.includes('data-search-filter-tags="trace"') &&
      filterPanel.includes('data-search-filter-tags="saying"') &&
      filterPanel.includes('data-search-filter-tag'),
    'Search page renders type-scoped tag controls for the Pagefind filter interface'
  )
  expect(
    !html.includes('Browse tags') &&
      !html.includes('data-search-taxonomy') &&
      !html.includes('href="/tags'),
    'Search page keeps one filter interface without a duplicate aggregate tag browser'
  )
  expect(html.includes('site-search'), 'Search page keeps the local Pagefind search interface')
}

expect(existsSync(dist), 'production dist exists')
expect(existsSync(distFile('home/index.html')), 'Home output exists')

if (existsSync(distFile('home/index.html'))) {
  const home = readDist('home/index.html')
  const allBlogs = publishedRecent('src/content/blog')
  const expectedBlogs = allBlogs.slice(0, 3).map((entry) => entry.id)
  const allTraces = publishedRecent('src/content/traces')
  const expectedTraces = allTraces.slice(0, 3).map((entry) => entry.id)
  const allSayings = publishedRecent('src/content/sayings', { byDate: false })
  const currentYear = yearInChina(new Date())
  const availableYears = [...new Set(allBlogs.map((entry) => yearInChina(entry.date)))]
    .filter((year) => year <= currentYear)
    .sort((left, right) => right - left)
  const selectedYear = availableYears[0]
  const selectedBlogIds = allBlogs
    .filter((entry) => selectedYear !== undefined && yearInChina(entry.date) === selectedYear)
    .map((entry) => entry.id)
  const olderBlogIds = allBlogs
    .filter((entry) => selectedYear !== undefined && yearInChina(entry.date) !== selectedYear)
    .map((entry) => entry.id)

  const homeOrder = ['data-home-hero', 'data-home-waves']
  if (allSayings.length > 0) homeOrder.push('data-home-random-saying')
  homeOrder.push('data-home-profile-intro', 'data-home-writing-grid')
  if (selectedBlogIds.length > 0) homeOrder.push('data-blog-timeline')
  homeOrder.push('data-home-education', 'data-home-residence', 'data-home-github-activity')
  const positions = homeOrder.map((marker) => home.indexOf(marker))
  expect(
    positions.every((position) => position >= 0),
    'Home exposes all Phase 2 section contracts'
  )
  expect(
    positions.every((position, index) => index === 0 || position > positions[index - 1]),
    'Home section contracts follow Hero → waves → Saying → ProfileIntro → writing → timeline → Education → Residence → GitHub order'
  )

  const profileSegment = segmentAfter(home, 'data-home-profile-intro', 'data-home-writing-grid')
  expect(
    profileSegment.includes('Developer / Designer / Blogger') &&
      profileSegment.includes('你好，我是 Susurrium，目前在北京大学医学部学习。') &&
      profileSegment.includes('我平时喜欢写代码、做设计，也常常因为好奇去折腾一些新工具和新想法。'),
    'Home ProfileIntro renders the canonical About introduction copy'
  )
  expect(
    !/China\s*\/\s*Beijing|zhuozhiyongde|GitHub/.test(profileSegment),
    'Home ProfileIntro omits location and GitHub metadata'
  )
  expect(
    profileSegment.includes('home-profile-intro__about-heading home-section-heading') &&
      profileSegment.includes('data-home-action="ahead"'),
    'Home ProfileIntro uses the shared Home section heading and ahead CTA'
  )
  const profileSource = readFileSync(
    resolve(root, 'src/components/home/ProfileIntro.astro'),
    'utf8'
  )
  expect(
    profileSource.includes('width={128}') &&
      profileSource.includes('height={128}') &&
      profileSource.includes("class='home-profile-intro__about-heading home-section-heading'") &&
      profileSource.includes('home-profile-intro__about-body') &&
      !profileSource.includes('home-profile-intro__about-title') &&
      !profileSource.includes('clamp(2rem, 4vw, 2.75rem)'),
    'Home ProfileIntro reserves the enlarged avatar and reuses the shared section heading scale'
  )

  const homeSource = readFileSync(resolve(root, 'src/pages/home/index.astro'), 'utf8')
  const sharedRailRule = homeSource.match(/\.home-saying-profile\s*\{[\s\S]*?\}/)?.[0] ?? ''
  expect(
    sharedRailRule.includes('width: 100%') &&
      sharedRailRule.includes('min-width: 0') &&
      sharedRailRule.includes('margin: 0') &&
      !sharedRailRule.includes('83.333%') &&
      homeSource.includes('.home-page :global(.home-section-heading h2)'),
    'Home Profile/Saying wrapper stays on the outer rail and reuses the shared h2 token'
  )

  const sayingSource = readFileSync(
    resolve(root, 'src/components/home/RandomSayingCard.astro'),
    'utf8'
  )
  expect(
    sayingSource.includes("class='home-saying-card'") &&
      sayingSource.includes('margin-inline: 0') &&
      sayingSource.includes('min-width: 100%') &&
      sayingSource.includes('w-fit self-end'),
    'Home Saying card removes only the archive card horizontal inset for outer-rail alignment'
  )

  if (allSayings.length > 0) {
    const sayingSegment = segmentAfter(home, 'data-home-random-saying', 'data-home-profile-intro')
    const cardPosition = sayingSegment.indexOf('<saying-random-card')
    const actionPosition = sayingSegment.indexOf('data-home-saying-actions')
    expect(
      /<h2[^>]*id="home-random-saying-heading"[^>]*class="[^"]*\bsr-only\b/.test(sayingSegment),
      'Home Saying keeps an accessible hidden section heading'
    )
    expect(
      !sayingSegment.includes('class="home-section-heading"'),
      'Home Saying removes the visible section heading row'
    )
    expect(
      cardPosition >= 0 && actionPosition > cardPosition,
      'Home Saying places its action row after the card'
    )
    expect(
      sayingSegment.includes('data-home-action="ahead"'),
      'Home Saying View all uses the ahead CTA style'
    )
  }

  expect(
    (home.match(/data-home-action="ahead"/g) ?? []).length === 3 + (allSayings.length > 0 ? 1 : 0),
    'Home Profile, available Saying, Blog, and Trace actions share the ahead CTA style'
  )

  const about = readDist('about/index.html')
  expect(
    about.includes('Developer / Designer / Blogger') &&
      about.includes('你好，我是 Susurrium，目前在北京大学医学部学习。') &&
      about.includes('我平时喜欢写代码、做设计，也常常因为好奇去折腾一些新工具和新想法。'),
    'About renders the same canonical introduction copy as Home ProfileIntro'
  )
  expect(
    about.includes('data-about-action="ahead"'),
    'About Sayings archive entry uses the ahead CTA style'
  )
  expect(
    (home.match(/<h1\b/gi) ?? []).length === 1,
    'Home keeps one semantic h1 while About remains a peer section h2'
  )

  const slides = [...home.matchAll(/data-slide-index="(\d+)"/g)].map((match) => Number(match[1]))
  expect(
    JSON.stringify(slides) === JSON.stringify([0, 1, 2, 3, 4, 5]),
    'Hero has six ordered slides'
  )
  expect(
    (home.match(/href="#gentle-wave"/g) ?? []).length === 4,
    'Hero has four Media wave layers'
  )
  expect(!home.includes('https://s2.loli.net/'), 'Home does not hotlink Media image assets')

  for (const asset of [
    {
      hash: 'e77260690388904ca6f0ca2b19f5f3206468f97b6d7272a06c920df1d9cb0e6d',
      path: 'images/largeskull/hero-01.jpg'
    },
    {
      hash: '319f2a38009f13e8ae5f1c6cbea9013b74e5408f29b6958fa1ac1571e991b8ca',
      path: 'images/largeskull/hero-02.webp'
    },
    {
      hash: '010664a398386fa5f387764e9c41c28f2bc729151915229dc172fbe11abb9909',
      path: 'images/largeskull/hero-03.jpg'
    },
    {
      hash: '235f105fcc5bbf6ea9acb69f2b75def95fb8f79867be0beafc27fa153da35dc4',
      path: 'images/largeskull/hero-04.webp'
    },
    {
      hash: 'd7f20af3e09c32dd6a1494af6a02383599218131a2796a71c33e4f796bd615c6',
      path: 'images/largeskull/hero-05.webp'
    },
    {
      hash: '277c5db8d016a8993467481d88ad840926adc8d54f8b49de5213e047476f6c0f',
      path: 'images/largeskull/hero-06.png'
    }
  ]) {
    const sourcePath = resolve(root, 'public', asset.path)
    expect(existsSync(distFile(asset.path)), `${asset.path} is emitted locally`)
    expect(
      existsSync(sourcePath) && sha256(sourcePath) === asset.hash,
      `${asset.path} retains its locked source hash`
    )
  }

  // Blog cards include their own linked tag <ul>; stop at the sibling Trace
  // column contract instead of the first nested closing list tag.
  const blogSegment = segmentAfter(home, 'data-home-recent-blog-list', 'data-home-traces-column')
  const traceSegment = segmentAfter(home, 'data-home-recent-trace-list', '</section>')
  expect(
    JSON.stringify(idsIn(blogSegment)) === JSON.stringify(expectedBlogs),
    'Home renders the newest three Blog entries on the left'
  )
  expect(
    JSON.stringify(idsIn(traceSegment)) === JSON.stringify(expectedTraces),
    'Home renders the newest three Trace entries on the right'
  )
  expect(!/<img\b/i.test(blogSegment), 'Home Blog cards are text-only')
  expect(
    (blogSegment.match(/data-presentation="text"/g) ?? []).length === expectedBlogs.length,
    'Home Blog cards are resolved through the text presentation'
  )
  expect(
    (traceSegment.match(/data-image-source="(?:content|fallback)"/g) ?? []).length ===
      expectedTraces.length,
    'Home Trace cards expose a resolved image source'
  )
  expect(
    (traceSegment.match(/data-presentation="media-content"/g) ?? []).length ===
      expectedTraces.length,
    'Home Trace cards are resolved through the Media content presentation'
  )

  const sayingCatalogMatch = home.match(
    /<script type="application\/json" data-random-saying-catalog>([\s\S]*?)<\/script>/
  )
  if (allSayings.length === 0) {
    expect(
      !sayingCatalogMatch && !home.includes('data-home-random-saying'),
      'Home omits the Saying area when no published Saying exists'
    )
  } else if (!sayingCatalogMatch) {
    fail('Home emits a published Saying catalog for client-side per-visit selection')
  } else {
    const catalog = JSON.parse(sayingCatalogMatch[1])
    const expectedSayings = allSayings.map((entry) => entry.id)
    expect(
      JSON.stringify(catalog.map((entry) => entry.id)) === JSON.stringify(expectedSayings),
      'Home random Saying catalog contains every and only published Saying in archive order'
    )
    expect(
      catalog.every((entry) => entry.href === `/sayings/${entry.id}`),
      'Random Saying catalog points to stable detail routes'
    )
    expect(
      catalog.every((entry) => entry.image?.source === 'decorative'),
      'Random Saying catalog carries decorative image assignments'
    )
  }

  const timeline = segmentAfter(home, 'data-blog-timeline', '<footer')
  const timelineYear = timeline.match(/data-timeline-year="(\d*)"/)?.[1] ?? ''
  if (selectedBlogIds.length === 0) {
    expect(
      !home.includes('data-blog-timeline'),
      'Home omits the Timeline area when no published Blog exists'
    )
  }
  expect(
    selectedYear === undefined ? timelineYear === '' : Number(timelineYear) === selectedYear,
    selectedYear === undefined
      ? 'Blog timeline state matches the empty published Blog collection'
      : `Blog timeline selects the newest available natural year (${selectedYear})`
  )
  expect(
    selectedBlogIds.every((id) => timeline.includes(`href="/blog/${id}"`)),
    'Blog timeline links to every Blog entry in its selected year'
  )
  expect(
    olderBlogIds.every((id) => !timeline.includes(`href="/blog/${id}"`)),
    'Blog timeline omits Blog entries from older years'
  )
  expect(!timeline.includes('/traces/'), 'Blog timeline excludes Trace routes')
  expect(!timeline.includes('/sayings/'), 'Blog timeline excludes Saying routes')
  expect(!existsSync(distFile('timeline')), 'No standalone Timeline route is generated')
}

const mediaSource = readFileSync(resolve(root, 'src/data/home-media.ts'), 'utf8')
for (const name of ['heroSlides', 'sayingDecorativeImages', 'traceFallbackImages']) {
  expect(
    new RegExp(`export const ${name}`).test(mediaSource),
    `${name} remains an explicit media pool`
  )
}

const contentConfig = readFileSync(resolve(root, 'src/content.config.ts'), 'utf8')
const sayingConfigStart = contentConfig.indexOf('const saying = defineCollection')
const sayingConfig = sayingConfigStart >= 0 ? contentConfig.slice(sayingConfigStart) : ''
expect(
  sayingConfig.includes('originalText') &&
    sayingConfig.includes('author') &&
    sayingConfig.includes('source') &&
    sayingConfig.includes('sourceUrl') &&
    /\btags:\s*z\./.test(sayingConfig) &&
    !sayingConfig.includes('publishDate') &&
    !sayingConfig.includes('originalLanguage'),
  'Saying schema keeps quote, attribution, source-link, and scoped-tag fields without dates'
)

verifySearchFilterEntryPoints()

const blogArchive = distFile('blog/index.html')
for (const path of ['src/pages/traces/[...page].astro', 'src/pages/sayings/[...page].astro']) {
  const source = readFileSync(resolve(root, path), 'utf8')
  expect(
    source.includes('ContentArchiveTaxonomy') && source.includes('getContentTagCounts'),
    `${path} uses the shared archive taxonomy entry point`
  )
}
if (existsSync(blogArchive)) {
  const html = readDist('blog/index.html')
  expect(
    html.includes('data-taxonomy-action="ahead"') && html.includes('href="/blog/tags"'),
    'Blog tag archive entry uses the ahead CTA style'
  )
}

const tracePages = archivePagePaths('traces')
if (tracePages.length > 0) {
  const traces = publishedRecent('src/content/traces')
  const html = readDist(tracePages[0])
  const tracePagination = configuredPagination('trace')
  const traceFirstPageCount = tracePagination.enabled
    ? Math.min(tracePagination.pageSize, traces.length)
    : traces.length
  verifyPaginatedArchive('traces', 'trace', traces, {
    label: 'Trace',
    taxonomyPath: '/traces/tags'
  })
  expect(
    (html.match(/data-presentation="media-content"/g) ?? []).length === traceFirstPageCount,
    'Trace archive resolves its default presentation centrally'
  )
  expect(
    (html.match(/<h2[^>]*data-card-title/g) ?? []).length === traceFirstPageCount,
    'Trace archive cards continue the page outline at h2'
  )
  expect(!html.includes('draft-field-note'), 'Trace archive excludes draft content')

  const firstTrace = traces[0]
  if (firstTrace) {
    const detailPath = `traces/${firstTrace.id}/index.html`
    if (existsSync(distFile(detailPath))) {
      const detail = readDist(detailPath)
      expect(/<time\b[^>]*datetime=/i.test(detail), 'Trace detail exposes its publish time')
      expect(!/>Updated</i.test(detail), 'Trace detail does not expose an updated-time field')
      expect(
        !/<article-copyright\b/i.test(detail) && !detail.includes('Support the author'),
        'Trace detail omits the copyright card and sponsorship row'
      )
    }
  }
}

const blogDetails = publishedRecent('src/content/blog')
const firstBlog = blogDetails[0]
if (firstBlog) {
  const detailPath = `blog/${firstBlog.id}/index.html`
  if (existsSync(distFile(detailPath))) {
    const detail = readDist(detailPath)
    expect(
      /<article-copyright\b/i.test(detail) && detail.includes('Support the author'),
      'Blog detail retains the copyright card and sponsorship row'
    )
  }
}

const sayingPages = archivePagePaths('sayings')
if (sayingPages.length > 0) {
  const sayings = publishedRecent('src/content/sayings', { byDate: false })
  const html = readDist(sayingPages[0])
  const sayingPagination = configuredPagination('saying')
  const sayingFirstPageCount = sayingPagination.enabled
    ? Math.min(sayingPagination.pageSize, sayings.length)
    : sayings.length
  verifyPaginatedArchive('sayings', 'saying', sayings, {
    label: 'Saying',
    taxonomyPath: '/sayings/tags'
  })
  expect(
    (html.match(/data-presentation="media-decorative"/g) ?? []).length ===
      sayingFirstPageCount,
    'Saying archive resolves its default presentation centrally'
  )
  expect(
    (html.match(/<h2[^>]*data-card-title/g) ?? []).length === sayingFirstPageCount,
    'Saying archive cards continue the page outline at h2'
  )
  expect(!html.includes('draft-saying'), 'Saying archive excludes draft content')

  const firstSaying = sayings[0]
  if (firstSaying) {
    const detailPath = `sayings/${firstSaying.id}/index.html`
    if (existsSync(distFile(detailPath))) {
      const detail = readDist(detailPath)
      expect(
        !/<time\b|data-card-date|article:published_time/i.test(detail),
        'Saying detail has no date presentation or article publish metadata'
      )
      expect(
        !/<article-copyright\b/i.test(detail) && !detail.includes('Support the author'),
        'Saying detail omits the copyright card and sponsorship row'
      )
    }
  }

  const bilingualDetail = distFile('sayings/montaigne-voice/index.html')
  if (existsSync(bilingualDetail)) {
    const detail = readDist('sayings/montaigne-voice/index.html')
    expect(
      detail.includes('Original') && detail.includes('Translation'),
      'Bilingual Saying detail keeps a simple original/translation presentation'
    )
  }
}

const cardHost = readFileSync(resolve(root, 'src/components/cards/ContentCard.astro'), 'utf8')
expect(
  cardHost.includes('toContentCardViewData') &&
    cardHost.includes('item.placement.presentation') &&
    cardHost.includes('createResolvedPageItem') &&
    cardHost.includes('TextCard') &&
    cardHost.includes('MediaCard'),
  'Card host resolves one PageItem view model and dispatches to the shared visual families'
)
for (const path of [
  'src/pages/home/index.astro',
  'src/pages/blog/[...page].astro',
  'src/pages/archives/index.astro',
  'src/pages/traces/[...page].astro',
  'src/pages/sayings/[...page].astro',
  'src/components/home/RandomSayingCard.astro',
  'src/components/content/TagDetailPage.astro'
]) {
  expect(
    readFileSync(resolve(root, path), 'utf8').includes('ContentCard'),
    `${path} renders through the card host`
  )
}
for (const path of [
  'src/pages/blog/tags/[tag]/[...page].astro',
  'src/pages/traces/tags/[tag]/[...page].astro',
  'src/pages/sayings/tags/[tag]/[...page].astro'
]) {
  expect(
    readFileSync(resolve(root, path), 'utf8').includes('TagDetailPage'),
    `${path} delegates to the shared taxonomy/card page`
  )
}
for (const path of ['src/pages/tags/index.astro', 'src/pages/tags/[tag]/[...page].astro']) {
  expect(!existsSync(resolve(root, path)), `${path} legacy aggregate taxonomy source is deleted`)
}

for (const { kind, path } of [
  { kind: 'blog', path: 'blog/tags/index.html' },
  { kind: 'trace', path: 'traces/tags/index.html' },
  { kind: 'saying', path: 'sayings/tags/index.html' }
]) {
  expect(existsSync(distFile(path)), `${path} scoped taxonomy output exists`)
  if (!existsSync(distFile(path))) continue
  const html = readDist(path)
  expect(
    html.includes(`data-taxonomy-scope="${kind}"`),
    `${path} exposes only its ${kind} taxonomy scope`
  )
  expect(!/href="\/tags(?:\/|")/.test(html), `${path} contains no legacy aggregate taxonomy link`)
}
expect(!existsSync(distFile('tags')), 'No aggregate /tags output is generated')

const mediaCardSource = readFileSync(
  resolve(root, 'src/components/cards/MediaCard.astro'),
  'utf8'
)
expect(
  mediaCardSource.includes('@media (max-width: 767px)') &&
    mediaCardSource.includes('flex-direction: column'),
  'Media cards retain the source viewport-based mobile vertical layout'
)

const heroSource = readFileSync(resolve(root, 'src/components/home/HeroGallery.astro'), 'utf8')
for (const className of ['hero-gallery__artboard', 'hero-gallery__title']) {
  expect(heroSource.includes(className), `Hero retains the Media brand ${className} layer`)
}
expect(
  !readDist('home/index.html').includes('= 所见高山远木'),
  'Home removes the deprecated visible Hero phrase'
)
expect(
  heroSource.includes("data-scroll-mode='fixed'"),
  'Hero exposes its fixed-to-flow scroll contract'
)

const aboutSource = readFileSync(resolve(root, 'src/pages/about/index.astro'), 'utf8')
expect(
  aboutSource.includes("href='/sayings'"),
  'About provides its single complete Sayings archive entry'
)
expect(
  !/hits\.seeyoufarm/i.test(aboutSource),
  'About does not render the deprecated visitor-count badge'
)

console.log(`Phase 2 verification complete: ${failures.length} failure(s).`)
if (failures.length > 0) process.exit(1)
