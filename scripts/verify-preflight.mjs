import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { subset } from 'semver'

import { nodeRequirement, requireNodeVersion } from './lib/node-runtime.mjs'

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
  if (condition) pass(message)
  else fail(message)
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

const pkg = JSON.parse(read('package.json'))
const configuredNodeVersion = read('.node-version').trim()

pass(`.node-version: ${requireNodeVersion(configuredNodeVersion)}`)
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
  const installed = JSON.parse(read(`node_modules/${name}/package.json`))
  const range = installed.engines?.node
  if (range)
    expect(
      subset(nodeRequirement, range),
      `Node ${nodeRequirement} satisfies ${name} requirement ${range}`
    )
}
expect(
  process.versions.bun === '1.4.0',
  `Bun is exactly 1.4.0 (actual: ${process.versions.bun ?? 'not Bun'})`
)
expect(pkg.packageManager === 'bun@1.4.0', 'packageManager is bun@1.4.0')
for (const dependency of ['astro', 'astro-pure', '@astrojs/mdx', 'pagefind', 'sharp', 'rehype']) {
  const version = pkg.dependencies?.[dependency] ?? pkg.devDependencies?.[dependency]
  expect(/^\d+\.\d+\.\d+$/.test(version ?? ''), `${dependency} has an exact reviewed version`)
  const installed = JSON.parse(read(`node_modules/${dependency}/package.json`))
  expect(installed.version === version, `${dependency} installed version matches ${version}`)
}
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
  'scripts/check-docs.mjs',
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
const browserAction = read('.github/actions/browser-regression/action.yml')
expect(/^\s*- main\s*$/m.test(ciWorkflow), 'CI validates pushes to main')
expect(/^\s*- develop\s*$/m.test(ciWorkflow), 'CI validates pushes to develop')
expect(
  ciWorkflow.includes('browser-regression:'),
  'CI defines a separate production-preview browser regression job'
)
expect(
  ciWorkflow.includes('uses: ./.github/actions/browser-regression') &&
    browserAction.includes('bun run verify:phase6:browser') &&
    browserAction.includes('bun run verify:home-hero') &&
    browserAction.includes('bun run verify:browser:lifecycle'),
  'CI runs mobile accessibility, Home Hero boundary, and ClientRouter lifecycle browser regressions'
)

const lifecycleRegression = read('scripts/verify-browser-lifecycle.mjs')
expect(
  lifecycleRegression.includes('assertInitialDarkEffectSurface'),
  'ClientRouter lifecycle regression covers a direct saved-dark Home visit'
)

const deployWorkflow = read('.github/workflows/deploy.yml')
expect(
  ciWorkflow.includes('actions/upload-artifact@') &&
    ciWorkflow.includes('actions/download-artifact@'),
  'CI browser regression reuses the validated build artifact'
)
expect(
  deployWorkflow.includes("if: github.ref == 'refs/heads/main'") &&
    deployWorkflow.includes('uses: ./.github/actions/browser-regression'),
  'Pages is restricted to main and verifies its artifact in Chrome'
)
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
