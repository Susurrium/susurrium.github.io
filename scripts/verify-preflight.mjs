import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
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
  condition ? pass(message) : fail(message)
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function command(name, args) {
  return execFileSync(name, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function compareVersions(actual, minimum) {
  const left = actual.split('.').map(Number)
  const right = minimum.split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

const pkg = JSON.parse(read('package.json'))
const configuredNodeVersion = read('.node-version').trim()

expect(
  compareVersions(configuredNodeVersion, '22.12.0') >= 0,
  `.node-version ${configuredNodeVersion} satisfies >=22.12.0`
)
expect(
  process.versions.bun === '1.4.0',
  `Bun is exactly 1.4.0 (actual: ${process.versions.bun ?? 'not Bun'})`
)
expect(pkg.packageManager === 'bun@1.4.0', 'packageManager is bun@1.4.0')
expect(pkg.dependencies?.astro === '6.1.8', 'Astro is pinned to 6.1.8')
expect(pkg.dependencies?.['astro-pure'] === '1.4.6', 'astro-pure is pinned to 1.4.6')
expect(pkg.overrides?.['@types/hast'] === '3.0.5', '@types/hast override is pinned to 3.0.5')
expect(
  pkg.scripts?.['capture:visual-baseline'] === 'node scripts/capture-visual-baseline.mjs',
  'visual baseline capture command is available'
)

const astroConfig = read('astro.config.ts')
expect(
  astroConfig.includes("site: 'https://susurrium.github.io'"),
  'Astro site points to the GitHub user site'
)
expect(!/^\s*base\s*:/m.test(astroConfig), 'Astro base is not configured')

for (const path of [
  'docs/archive/IMPLEMENTATION_PLAN.zh-CN.md',
  'docs/SOURCE_LEDGER.md',
  'docs/archive/PREPARATION_STATUS.md',
  'docs/DEVELOPMENT.md',
  'docs/FINAL_RELEASE_HANDOFF.zh-CN.md',
  'docs/VISUAL_BASELINE.md',
  'scripts/capture-visual-baseline.mjs',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml'
]) {
  expect(existsSync(resolve(root, path)), `${path} exists`)
}

for (const path of ['.github/workflows/ci.yml', '.github/workflows/deploy.yml']) {
  if (!existsSync(resolve(root, path))) continue
  expect(!/^\s*schedule\s*:/m.test(read(path)), `${path} has no schedule trigger`)
}

const ciWorkflow = read('.github/workflows/ci.yml')
expect(/^\s*- main\s*$/m.test(ciWorkflow), 'CI validates pushes to main')
expect(/^\s*- develop\s*$/m.test(ciWorkflow), 'CI validates pushes to develop')
expect(
  ciWorkflow.includes('browser-regression:'),
  'CI defines a separate production-preview browser regression job'
)
expect(
  ciWorkflow.includes('bun run verify:phase6:browser') &&
    ciWorkflow.includes('bun run verify:home-hero') &&
    ciWorkflow.includes('bun run verify:browser:lifecycle'),
  'CI runs mobile accessibility, Home Hero boundary, and ClientRouter lifecycle browser regressions'
)

const lifecycleRegression = read('scripts/verify-browser-lifecycle.mjs')
expect(
  lifecycleRegression.includes('assertInitialDarkEffectSurface'),
  'ClientRouter lifecycle regression covers a direct saved-dark Home visit'
)

const deployWorkflow = read('.github/workflows/deploy.yml')
const hasManualPagesTrigger = /^[ \t]*workflow_dispatch:[ \t]*$/m.test(deployWorkflow)
const hasPushTrigger = /^[ \t]*push:[ \t]*$/m.test(deployWorkflow)
const hasMainOnlyPushTrigger =
  /^[ \t]*push:[ \t]*\r?\n[ \t]+branches:[ \t]*\[[ \t]*main[ \t]*\][ \t]*$/m.test(deployWorkflow)
expect(hasManualPagesTrigger, 'Pages deployment can be triggered manually')
expect(
  !hasPushTrigger || hasMainOnlyPushTrigger,
  'Pages deployment is manual during preparation or restricted to main for a clean release'
)
expect(
  !/^\s*pull_request\s*:/m.test(deployWorkflow),
  'Pages deployment has no pull request trigger'
)
expect(
  deployWorkflow.includes('bun install --frozen-lockfile'),
  'Pages deployment uses the frozen lockfile'
)
expect(
  deployWorkflow.includes('bun run ci'),
  'Pages deployment runs the development validation gate'
)
expect(
  deployWorkflow.indexOf('run: bun run release:gate') >= 0 &&
    deployWorkflow.indexOf('run: bun run release:gate') <
      deployWorkflow.indexOf('uses: actions/upload-pages-artifact@v5'),
  'Pages deployment runs the strict release gate before uploading an artifact'
)

try {
  const origin = command('git', ['remote', 'get-url', 'origin'])
  expect(
    /github\.com[/:]Susurrium\/susurrium\.github\.io(?:\.git)?$/i.test(origin),
    `origin is the Susurrium GitHub Pages repository (${origin})`
  )
} catch {
  warn('Git origin could not be inspected in this environment')
}

try {
  const upstream = command('git', ['remote', 'get-url', 'upstream'])
  expect(
    /github\.com[/:]zhuozhiyongde\/Arthals-Ink(?:\.git)?$/i.test(upstream),
    `upstream is Arthals-Ink (${upstream})`
  )
  const upstreamPush = command('git', ['remote', 'get-url', '--push', 'upstream'])
  expect(upstreamPush === 'DISABLED', 'upstream push is disabled')
} catch {
  warn('upstream remote is not available (expected in a minimal CI clone)')
}

console.log(`Preflight complete: ${failures.length} failure(s), ${warnings.length} warning(s).`)
if (failures.length > 0) process.exit(1)
