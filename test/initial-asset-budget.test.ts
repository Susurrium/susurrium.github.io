import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, expect, test } from 'bun:test'
import { parse } from 'node-html-parser'

import { createInitialAssetInspector } from '../scripts/lib/initial-asset-budget.mjs'

const directories: string[] = []
async function fixture(assets: Record<string, string>) {
  const directory = await mkdtemp(resolve(tmpdir(), 'susurrium-budget-'))
  directories.push(directory)
  const files: string[] = []
  for (const [path, source] of Object.entries(assets)) {
    const file = resolve(directory, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, source)
    files.push(file)
  }
  return createInitialAssetInspector(directory, files)
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!directory.startsWith(`${resolve(tmpdir())}${sep}susurrium-budget-`))
      throw new Error('Unsafe fixture cleanup')
    await rm(directory, { recursive: true, force: true, maxRetries: 5 })
  }
})
const compressed = (...sources: string[]) =>
  sources.reduce((sum, source) => sum + gzipSync(source).byteLength, 0)

test('counts shared static imports and re-exports once, including CSS, but excludes dynamic chunks', async () => {
  const assets = {
    'assets/entry.js': 'import "./shared.js"; import "./theme.css"; import("./lazy.js");',
    'assets/second.js': 'export { value } from "./shared.js?cached=1";',
    'assets/shared.js': 'export const value = 42; import "./entry.js";',
    'assets/lazy.js': 'console.log("only loaded on interaction");',
    'assets/theme.css': '@import "./base.css"; body { color: blue; }',
    'assets/base.css': 'html { font-size: 16px; }'
  }
  const inspect = await fixture(assets)
  const result = await inspect(
    parse(
      '<script type="module" src="/assets/entry.js"></script><script type="module" src="/assets/second.js"></script><link rel="stylesheet" href="/assets/base.css">'
    ),
    'https://budget.invalid/home/index.html'
  )
  expect(result).toEqual({
    scripts: compressed(
      assets['assets/entry.js'],
      assets['assets/second.js'],
      assets['assets/shared.js']
    ),
    styles: compressed(assets['assets/theme.css'], assets['assets/base.css'])
  })
})

test('counts inline module dependencies, CSS imports and explicit modulepreloads relative to the page base', async () => {
  const assets = {
    'assets/main.js': 'export const main = true;',
    'assets/preload.js': 'export const preload = true;',
    'assets/base.css': 'body { background: white; }'
  }
  const inspect = await fixture(assets)
  const inlineScript = 'import "./main.js"; import("./ignored.js");'
  const inlineStyle = '@import url("./base.css");'
  const result = await inspect(
    parse(
      `<base href="/assets/"><script type="module">${inlineScript}</script><style>${inlineStyle}</style><link rel="modulepreload" href="preload.js"><script type="application/ld+json">{"name":"not executable"}</script><script src="https://cdn.invalid/remote.js"></script>`
    ),
    'https://budget.invalid/nested/index.html'
  )
  expect(result).toEqual({
    scripts: compressed(assets['assets/main.js'], assets['assets/preload.js'], inlineScript),
    styles: compressed(assets['assets/base.css'], inlineStyle)
  })
})
