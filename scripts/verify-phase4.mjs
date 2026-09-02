import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

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

function firstGeneratedDetail(route) {
  const base = resolve(dist, route)
  if (!existsSync(base)) return undefined
  let found
  const walk = (current) => {
    if (found) return
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name)
      if (entry.isDirectory()) {
        // Numeric children are Astro's archive pagination pages, not detail
        // routes. Skip them so the reading-profile regression always targets
        // a real Trace article after pagination is enabled. Taxonomy indexes
        // under `tags/` are also archive utilities, never reading pages.
        if (current === base && (/^\d+$/.test(entry.name) || entry.name === 'tags')) continue
        walk(absolute)
      } else if (entry.isFile() && entry.name === 'index.html' && current !== base) {
        found = relative(dist, absolute).replace(/\\/g, '/')
        return
      }
    }
  }
  walk(base)
  return found
}

const traceDetailPath = firstGeneratedDetail('traces')

const vendorAssets = [
  {
    path: 'vendor/pku/canvas-ribbon@1.1.3.min.js',
    hash: '0397a7e1a38f78ef831c1e284cf39c81263bdd022e1b462ad4c0955acf9ea3a6'
  },
  {
    path: 'vendor/pku/canvas-fluttering-ribbon@1.1.3.min.js',
    hash: 'ae4d9f6cdc03736996029a8806cc162ec4340a92fc4bfa2bc273d4a46466b68a'
  },
  {
    path: 'vendor/pku/canvas-nest@1.1.3.min.js',
    hash: '2c8951c894a012c98e55c3ba80045863c627cc5d144665bd54c286ac75f2a7dd'
  },
  {
    path: 'vendor/george/sakura.js',
    hash: '4c82981d16b44ea6f7c25cea1700d9a3c4a708c453b10b93616c676cc79fd17a'
  },
  {
    path: 'vendor/george/fireworks.js',
    hash: 'd505e5aeeb885dc1f2a88b7464ad12677a456ceb70038f6db02ed1e29695ea42'
  },
  {
    path: 'vendor/george/tinycolor.min.js',
    hash: 'af61a9951eda26670b81a7e33e49465f36086e92455e9b35fb19d15ab28d9d50'
  },
  {
    path: 'vendor/george/anime.min.js',
    hash: '5cbda29ea5096ac9404c59c77493a2f467d0eb4a27f16c750b61fc0d888dd716'
  }
]

expect(existsSync(dist), 'production dist exists')
for (const asset of vendorAssets) {
  const publicAsset = resolve(root, 'public', asset.path)
  const outputAsset = resolve(dist, asset.path)
  expect(existsSync(publicAsset), `${asset.path} is checked in as a local vendor asset`)
  expect(existsSync(outputAsset), `${asset.path} is emitted by the production build`)
  expect(
    existsSync(publicAsset) && sha256(publicAsset) === asset.hash,
    `${asset.path} retains its locked source hash`
  )
}

const host = source('src/components/effects/VisualEffectsHost.astro')
const profilePolicy = source('src/data/effects.ts')
const baseLayout = source('src/layouts/BaseLayout.astro')

expect(
  host.includes('frame.srcdoc = this.sourceDocument(kind, this.sources)') &&
    host.includes('for (const frame of this.frames.values()) frame.remove()'),
  'effect host isolates vendor globals in disposable iframe documents'
)
expect(
  host.includes("'astro:before-preparation'") &&
    host.includes("'astro:before-swap'") &&
    host.includes('disconnectedCallback()') &&
    host.includes('AbortController'),
  'effect host releases route-scoped listeners and frames during ClientRouter navigation'
)
expect(
  host.includes('mobile="false" zIndex="-1" alpha="0.6" size="150" data-click="false"') &&
    host.includes("'fluttering_ribbon'") &&
    host.includes("'canvas_nest'"),
  'ambient canvas iframe preserves the locked three-script order and source-page ribbon parameters'
)
expect(
  host.includes("'susurrium:ambient-pointer'") &&
    host.includes("'susurrium:ambient-scroll'") &&
    host.includes('ambientMobileQuery'),
  'ambient canvas iframe receives parent pointer and scroll context while remaining disabled on mobile'
)
expect(
  host.includes('petalRuntime') &&
    host.includes('colorRuntime') &&
    host.includes('clickBurstAnime') &&
    host.includes('clickBurstRuntime') &&
    host.includes('numberOfParticles = 20') === false,
  'click-burst runtime keeps the original local source files rather than reimplementing its particle algorithm'
)
expect(
  host.includes("'susurrium:click-burst'") &&
    host.includes("'[data-click-burst-zone]'") &&
    host.includes("'[data-no-click-burst]'") &&
    host.includes('\'[class*="card"]\''),
  'click relay only accepts blank, noninteractive page areas'
)
expect(
  /standard:[\s\S]*?click: true[\s\S]*?ambientBackdrop: true/.test(profilePolicy) &&
    /reading:[\s\S]*?click: false[\s\S]*?ambientBackdrop: false/.test(profilePolicy) &&
    /links:[\s\S]*?click: true[\s\S]*?petals: true[\s\S]*?ambientBackdrop: false/.test(profilePolicy),
  'route effect policy keeps standard, reading and Links profiles explicit'
)
expect(
  baseLayout.includes('<VisualEffectsHost profile={effectProfile} />') &&
    baseLayout.includes('data-effect-profile={effectProfile}') &&
    baseLayout.includes('data-click-burst-zone') &&
    baseLayout.includes('data-page-content-layer') &&
    baseLayout.includes('data-page-footer-layer') &&
    baseLayout.includes('Header is a'),
  'BaseLayout keeps the Header above effects while content and Footer occupy the page layer'
)

const outputProfiles = [
  {
    path: 'home/index.html',
    profile: 'standard',
    attributes: ['data-ambient-backdrop="true"', 'data-petals="false"', 'data-click="true"']
  },
  {
    path: 'links/index.html',
    profile: 'links',
    attributes: ['data-ambient-backdrop="false"', 'data-petals="true"', 'data-click="true"']
  },
  {
    path: 'about/index.html',
    profile: 'about',
    attributes: ['data-ambient-backdrop="true"', 'data-petals="false"', 'data-click="true"']
  },
  ...(traceDetailPath
    ? [
        {
          path: traceDetailPath,
          profile: 'reading',
          attributes: ['data-ambient-backdrop="false"', 'data-petals="false"', 'data-click="false"']
        }
      ]
    : [])
]

for (const page of outputProfiles) {
  if (!existsSync(resolve(dist, page.path))) {
    fail(`${page.path} exists for profile verification`)
    continue
  }
  const html = output(page.path)
  expect(
    html.includes(`data-effect-profile="${page.profile}"`),
    `${page.path} emits the ${page.profile} effect profile`
  )
  expect(
    html.includes('data-visual-effects-host'),
    `${page.path} emits a non-persistent effects host`
  )
  for (const attribute of page.attributes) {
    expect(html.includes(attribute), `${page.path} emits ${attribute}`)
  }
}

if (existsSync(resolve(dist, 'index.html'))) {
  const entrance = output('index.html')
  expect(
    !entrance.includes('data-visual-effects-host'),
    'root entrance does not mount visual effects'
  )
}

const allBuiltHtml = ['home/index.html', 'links/index.html', ...(traceDetailPath ? [traceDetailPath] : [])]
  .filter((path) => existsSync(resolve(dist, path)))
  .map(output)
  .join('\n')
expect(
  !/cdn\.cbd\.int\/butterfly-extsrc|george-blog\.top\/wp-content\/themes\/argon\/George\/(?:sakura|fireworks)|(?:cdn\.jsdelivr\.net|unpkg\.com).*?(?:anime|tinycolor)/i.test(
    allBuiltHtml
  ),
  'production pages do not hotlink remote effect runtimes'
)

console.log(`Phase 4 verification complete: ${failures.length} failure(s).`)
if (failures.length > 0) process.exit(1)
