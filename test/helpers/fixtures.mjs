import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'bun:test'

export const fixtureDirectory = fileURLToPath(
  new URL('../../artifacts/test-fixtures/', import.meta.url)
)
const created = new Set()
const scope = new AsyncLocalStorage()

export function createTestDirectory(label) {
  const directories = scope.getStore()
  if (!directories) throw new Error('Create fixtures inside testWithFixtures')
  if (!/^[a-z][a-z0-9-]*$/.test(label)) throw new Error(`Invalid fixture label: ${label}`)
  mkdirSync(fixtureDirectory, { recursive: true })
  const path = mkdtempSync(join(realpathSync(fixtureDirectory), `${label}-`))
  created.add(path)
  directories.add(path)
  return path
}

export function removeTestDirectory(path) {
  if (!created.has(path)) throw new Error(`Unregistered fixture cleanup: ${path}`)
  if (existsSync(path)) {
    if (
      dirname(path) !== realpathSync(fixtureDirectory) ||
      lstatSync(path).isSymbolicLink() ||
      realpathSync(path) !== path
    )
      throw new Error(`Unsafe fixture cleanup: ${path}`)
    rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
  created.delete(path)
}

// 捕获实际测试异常并继续抛出，失败夹具保留供复现。
export function testWithFixtures(name, body, options) {
  return test(
    name,
    () =>
      scope.run(new Set(), async () => {
        const directories = scope.getStore()
        try {
          await body()
          for (const path of directories) if (created.has(path)) removeTestDirectory(path)
        } catch (error) {
          if (directories.size)
            console.error(`Test fixtures retained: ${[...directories].join(', ')}`)
          throw error
        }
      }),
    options
  )
}
