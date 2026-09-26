import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const isMain = (url) =>
  Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url))

/** Flush a complete replacement beside its target before an atomic rename. */
export async function atomicWrite(path, content) {
  try {
    if ((await readFile(path, 'utf8')) === content) return false
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    const handle = await open(temporary, 'wx')
    try {
      await handle.writeFile(content, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, path)
    return true
  } finally {
    await rm(temporary, { force: true })
  }
}

export function recordChanges(previous, next) {
  return {
    added: Object.keys(next).filter((key) => !Object.hasOwn(previous, key)),
    changed: Object.keys(next).filter(
      (key) =>
        Object.hasOwn(previous, key) && JSON.stringify(previous[key]) !== JSON.stringify(next[key])
    ),
    removed: Object.keys(previous).filter((key) => !Object.hasOwn(next, key)),
    unchanged: Object.keys(next).filter(
      (key) =>
        Object.hasOwn(previous, key) && JSON.stringify(previous[key]) === JSON.stringify(next[key])
    )
  }
}
