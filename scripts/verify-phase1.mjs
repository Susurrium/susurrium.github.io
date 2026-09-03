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

function file(path) {
  return resolve(dist, path)
}

function read(path) {
  return readFileSync(file(path), 'utf8')
}

function contentEntries(directory) {
  const base = resolve(root, directory)
  const entries = []

  // Empty content collections are a supported release state. A checkout may
  // not materialize an empty directory, so treat a missing base exactly like
  // an existing directory with no Markdown entries.
  if (!existsSync(base)) return entries

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name)
      if (entry.isDirectory()) walk(absolute)
      if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name))) {
        const source = readFileSync(absolute, 'utf8')
        const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
        const id = relative(base, absolute)
          .replace(/\\/g, '/')
          .replace(/\.(?:md|mdx)$/, '')
          // Match Astro's content id for directory-based entries: an
          // `index.md` file is addressed by its directory name, not by an
          // additional `/index` path segment.
          .replace(/\/index$/, '')
        entries.push({
          id,
          source,
          draft: /^draft:\s*true\s*$/m.test(frontmatter?.[1] ?? '')
        })
      }
    }
  }

  walk(base)
  return entries
}

function assertNav(path) {
  const html = read(path)
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    attributes: match[1],
    text: match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }))
  const brand = anchors.find(({ attributes }) => /aria-label="Brand"/.test(attributes))
  expect(brand?.attributes.includes('href="/home"'), `${path} brand links to /home`)

  const nav = anchors
    .filter(({ attributes }) => /data-nav-menu-item/.test(attributes))
    .map(({ attributes, text }) => ({
      href: attributes.match(/href="([^"]+)"/)?.[1],
      text
    }))
  const expected = [
    { href: '/home', text: 'Home' },
    { href: '/blog', text: 'Blog' },
    { href: '/traces', text: 'Traces' },
    { href: '/projects', text: 'Projects' },
    { href: '/about', text: 'About' },
    { href: '/links', text: 'Links' }
  ]
  expect(
    JSON.stringify(nav) === JSON.stringify(expected),
    `${path} has the locked six-item navigation`
  )
}

expect(existsSync(dist), 'production dist exists')

for (const path of ['index.html', 'home/index.html', 'traces/index.html', 'sayings/index.html']) {
  expect(existsSync(file(path)), `${path} exists`)
}

const entrance = read('index.html')
expect(!entrance.includes('<header-component'), 'entrance does not mount the site header')
expect(!entrance.includes('<footer'), 'entrance does not mount the site footer')
expect(!/<meta[^>]+http-equiv="refresh"/i.test(entrance), 'entrance does not auto-redirect')
expect(/<meta name="robots" content="noindex, follow"/.test(entrance), 'entrance is noindex')
expect(
  /<link rel="canonical" href="https:\/\/susurrium\.github\.io\/home"/.test(entrance),
  'entrance canonical points to /home'
)
expect(/href="\/home"/.test(entrance), 'entrance exposes an explicit /home link')
expect(
  !read('home/index.html').includes('data-pagefind-ignore'),
  '/home is indexable separately from the entrance'
)

for (const collection of [
  { directory: 'src/content/traces', route: 'traces', label: 'Trace' },
  { directory: 'src/content/sayings', route: 'sayings', label: 'Saying' }
]) {
  const entries = contentEntries(collection.directory)
  const normalizedIds = new Set()
  for (const entry of entries) {
    const key = entry.id.toLocaleLowerCase('en-US')
    expect(!normalizedIds.has(key), `${collection.label} slug ${entry.id} is unique`)
    normalizedIds.add(key)

    const output = `${collection.route}/${entry.id}/index.html`
    if (entry.draft) {
      expect(
        !existsSync(file(output)),
        `${collection.label} draft ${entry.id} is excluded from production`
      )
      expect(
        !read(`${collection.route}/index.html`).includes(entry.id),
        `${collection.label} draft ${entry.id} is absent from archive`
      )
    } else {
      expect(existsSync(file(output)), `${collection.label} ${entry.id} detail route exists`)
      const detail = read(output)
      expect(
        detail.includes('data-pagefind-body'),
        `${collection.label} ${entry.id} detail exposes its body to Pagefind`
      )
      expect(
        detail.includes(`data-pagefind-meta="content-type:${collection.label}"`),
        `${collection.label} ${entry.id} exposes content type metadata`
      )
      expect(
        detail.includes(`href="/${collection.route}"`),
        `${collection.label} ${entry.id} links back to its archive`
      )
    }
  }
}

for (const path of [
  'home/index.html',
  'blog/index.html',
  'traces/index.html',
  'sayings/index.html',
  'projects/index.html',
  'about/index.html',
  'links/index.html'
]) {
  if (existsSync(file(path))) assertNav(path)
  else fail(`${path} was expected for navigation verification`)
}

for (const legacyRoute of ['notes', 'says', 'timeline']) {
  expect(!existsSync(file(legacyRoute)), `${legacyRoute} legacy route is not generated`)
}

for (const path of ['archives/index.html', 'rss.xml']) {
  expect(existsSync(file(path)), `${path} exists for Blog-only boundary verification`)
  if (!existsSync(file(path))) continue
  const html = read(path)
  const routeLinks = [...html.matchAll(/<(?:link|guid)\b[^>]*>([\s\S]*?)<\/(?:link|guid)>/gi)]
    .map((match) => match[1])
    .join('\n')
  expect(!routeLinks.includes('/traces/'), `${path} excludes Trace routes from Blog-only surfaces`)
  expect(
    !routeLinks.includes('/sayings/'),
    `${path} excludes Saying routes from Blog-only surfaces`
  )
}

// Taxonomy is intentionally scoped to its content type.  There is no
// aggregate /tags route and no compatibility redirect: the old test content
// is disposable, so stale taxonomy output must disappear completely.
for (const { kind, path, otherPaths } of [
  { kind: 'Blog', path: 'blog/tags/index.html', otherPaths: ['/traces/tags', '/sayings/tags'] },
  { kind: 'Trace', path: 'traces/tags/index.html', otherPaths: ['/blog/tags', '/sayings/tags'] },
  { kind: 'Saying', path: 'sayings/tags/index.html', otherPaths: ['/blog/tags', '/traces/tags'] }
]) {
  expect(existsSync(file(path)), `${path} exists for ${kind}-scoped taxonomy`)
  if (!existsSync(file(path))) continue
  const html = read(path)
  expect(
    html.includes(`data-taxonomy-scope="${kind.toLowerCase()}"`),
    `${path} declares its ${kind} taxonomy scope`
  )
  expect(!/href="\/tags(?:\/|")/.test(html), `${path} contains no legacy aggregate tag link`)
  for (const otherPath of otherPaths) {
    expect(!html.includes(`href="${otherPath}`), `${path} excludes ${otherPath} taxonomy links`)
  }
}

expect(!existsSync(file('tags')), 'legacy /tags output is absent')

console.log(`Phase 1 verification complete: ${failures.length} failure(s).`)
if (failures.length > 0) process.exit(1)
