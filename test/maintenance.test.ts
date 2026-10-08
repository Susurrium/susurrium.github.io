import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'bun:test'
import { subset } from 'semver'

import { matchesBrowserRoute } from '../scripts/lib/browser-route.mjs'
import { nodeRequirement, requireNodeVersion } from '../scripts/lib/node-runtime.mjs'
import {
  createTestDirectory,
  fixtureDirectory,
  removeTestDirectory,
  testWithFixtures as test
} from './helpers/fixtures.mjs'

test('本地与线上路由允许目录尾斜杠，严格核对 canonical 的域名和路径', () => {
  const site = 'https://susurrium.github.io'
  const canonical = `${site}/traces/tags`
  for (const pathname of ['/traces/tags', '/traces/tags/'])
    expect(matchesBrowserRoute({ pathname, canonical }, '/traces/tags', site)).toBe(true)
  for (const state of [
    { pathname: '/blog/tags/', canonical },
    { pathname: '/traces/tags/', canonical: 'https://other.invalid/traces/tags' },
    { pathname: '/traces/tags/', canonical: `${canonical}/` },
    { pathname: '/traces/tags/', canonical: `${site}/traces` },
    { pathname: '/traces/tags/', canonical: undefined }
  ])
    expect(matchesBrowserRoute(state, '/traces/tags', site)).toBe(false)
})

test('Node 声明覆盖 ICO 依赖要求，固定版本通过，低于最低版本时拒绝运行', () => {
  const ico = JSON.parse(
    readFileSync(new URL('../node_modules/icojs/package.json', import.meta.url), 'utf8')
  )
  const pinned = readFileSync(new URL('../.node-version', import.meta.url), 'utf8').trim()
  expect(subset(nodeRequirement, ico.engines.node)).toBe(true)
  expect(requireNodeVersion(pinned)).toContain(pinned)
  expect(requireNodeVersion('22.22.2')).toContain(nodeRequirement)
  expect(() => requireNodeVersion('22.12.0')).toThrow('does not satisfy')
  expect(() => requireNodeVersion('invalid')).toThrow('does not satisfy')
})

test('测试目录只允许清理本次登记的路径', () => {
  const root = createTestDirectory('cleanup')
  expect(dirname(root)).toBe(realpathSync(fixtureDirectory))
  expect(() => createTestDirectory('../outside')).toThrow('Invalid fixture label')
  expect(() => removeTestDirectory(fixtureDirectory)).toThrow('Unregistered')
  removeTestDirectory(root)
  expect(existsSync(root)).toBe(false)
})

test('直接运行 Bun 测试成功时清理，失败时保留真实夹具和日志', () => {
  const root = createTestDirectory('exit-check')
  const helper = new URL('./helpers/fixtures.mjs', import.meta.url).href
  for (const fails of [false, true]) {
    const resultFile = join(root, `result-${fails}.json`)
    const script = join(root, `exit-${fails}.test.ts`)
    writeFileSync(
      script,
      `import { expect } from 'bun:test'
import { writeFileSync } from 'node:fs'
import { createTestDirectory, testWithFixtures as test } from ${JSON.stringify(helper)}
test('fixture lifecycle', () => {
  const path = createTestDirectory('exit-child')
  writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify({ path }))
  expect(${fails}).toBe(false)
})
`
    )
    const result = spawnSync(process.execPath, ['test', script], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      encoding: 'utf8',
      timeout: 15000
    })
    expect(result.status, result.stderr).toBe(fails ? 1 : 0)
    const { path } = JSON.parse(readFileSync(resultFile, 'utf8'))
    expect(dirname(path)).toBe(realpathSync(fixtureDirectory))
    expect(existsSync(path)).toBe(fails)
    if (fails) writeFileSync(join(path, 'expected-failure.log'), result.stdout + result.stderr)
  }
})
