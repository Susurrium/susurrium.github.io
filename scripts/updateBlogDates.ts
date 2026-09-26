#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'

import { atomicWrite, isMain } from './lib/file-operations.mjs'

type Metadata = { filePath?: string; hash: string; publishDate: string; updatedDate: string }
type Database = Record<string, Metadata>
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const digest = (value: string, algorithm = 'sha256') =>
  createHash(algorithm).update(value).digest('hex')

export async function listBlogFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) files.push(path)
    }
  }
  try {
    await walk(directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || files.length) throw error
  }
  return files.sort()
}

export function parseBlogDocument(source: string) {
  const match = source.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/)
  if (!match) throw new Error('缺少合法的 YAML frontmatter。')
  const document = parseDocument(match[1])
  if (document.errors.length)
    throw new Error(document.errors.map((error) => error.message).join('; '))
  const publishDate = document.get('publishDate')
  const updatedDate = document.get('updatedDate')
  if (typeof publishDate !== 'string' || !Number.isFinite(Date.parse(publishDate)))
    throw new Error('publishDate 必须是有效日期。')
  if (
    updatedDate !== undefined &&
    (typeof updatedDate !== 'string' || !Number.isFinite(Date.parse(updatedDate)))
  )
    throw new Error('updatedDate 必须是有效日期。')
  const identity = document.clone()
  identity.delete('updatedDate')
  // Metadata-only date edits never trigger another date update.
  const hash = digest(`${identity.toString()}\n${match[2].replaceAll('\r\n', '\n')}`)
  return {
    document,
    body: match[2],
    publishDate,
    updatedDate: updatedDate as string | undefined,
    hash,
    newline: source.includes('\r\n') ? '\r\n' : '\n'
  }
}

export async function updateBlogDates({
  projectRoot = defaultRoot,
  dryRun = false,
  now = new Date()
} = {}) {
  const blogRoot = resolve(projectRoot, 'src/content/blog')
  const databasePath = resolve(projectRoot, 'scripts/blog-metadata.json')
  let previous: Database = {}
  try {
    previous = JSON.parse(await readFile(databasePath, 'utf8')) as Database
    if (!previous || typeof previous !== 'object' || Array.isArray(previous))
      throw new Error('日期元数据库必须是对象。')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const next: Database = {}
  const changes: { path: string; filePath: string; content: string }[] = []
  const added: string[] = []
  const errors: string[] = []
  const timestamp = now.toISOString()
  for (const path of await listBlogFiles(blogRoot)) {
    const filePath = relative(blogRoot, path).replaceAll('\\', '/')
    try {
      const source = await readFile(path, 'utf8')
      const entry = parseBlogDocument(source)
      const old = previous[filePath]
      // Upgrade the original flat MD5 database without falsely dating unchanged posts.
      const unchanged =
        old?.hash === entry.hash || (old?.hash.length === 32 && old.hash === digest(source, 'md5'))
      let updatedDate = entry.updatedDate ?? entry.publishDate
      if (!old) added.push(filePath)
      else if (!unchanged) {
        updatedDate = new Date(
          Math.max(Date.parse(timestamp), Date.parse(entry.publishDate))
        ).toISOString()
        entry.document.set('updatedDate', updatedDate)
        const frontmatter = entry.document.toString().trimEnd().replaceAll('\n', entry.newline)
        changes.push({
          path,
          filePath,
          content: `---${entry.newline}${frontmatter}${entry.newline}---${entry.newline}${entry.body}`
        })
      }
      next[filePath] = { filePath, hash: entry.hash, publishDate: entry.publishDate, updatedDate }
    } catch (error) {
      errors.push(`${filePath}: ${(error as Error).message}`)
    }
  }
  // A malformed file must not erase its metadata or partially apply the batch.
  if (errors.length) throw new Error(`日期更新失败；未写入任何文件。\n${errors.join('\n')}`)
  const removed = Object.keys(previous).filter((key) => !Object.hasOwn(next, key))
  if (!dryRun) {
    for (const change of changes) await atomicWrite(change.path, change.content)
    await atomicWrite(databasePath, `${JSON.stringify(next, null, 2)}\n`)
  }
  return {
    total: Object.keys(next).length,
    added,
    changed: changes.map(({ filePath }) => filePath),
    removed,
    dryRun
  }
}

if (isMain(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((arg) => !['--dry-run', '--'].includes(arg)))
      throw new Error('Usage: bun run date [--dry-run]')
    const summary = await updateBlogDates({ dryRun: process.argv.includes('--dry-run') })
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    console.error((error as Error).message)
    process.exitCode = 1
  }
}
