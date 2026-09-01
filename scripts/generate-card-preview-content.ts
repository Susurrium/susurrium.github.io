import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { sayingDecorativeImages, traceFallbackImages } from '../src/data/home-media'
import { minimumAlternatingSlots } from '../src/lib/card-layout/alternating'

const projectRoot = path.resolve(import.meta.dirname, '..')
const contentRoot = path.join(projectRoot, 'src', 'content')
const previewPrefix = 'card-preview-'

type PreviewKind = 'saying' | 'trace'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')

function isPublished(source: string): boolean {
  return !/^draft\s*:\s*true\s*$/im.test(source)
}

function nextPreviewIndex(names: readonly string[], kind: PreviewKind): number {
  const prefix = `${previewPrefix}${kind}-`
  const indexes = names.flatMap((name) => {
    if (!name.startsWith(prefix) || !name.endsWith('.md')) return []
    const value = Number(name.slice(prefix.length, -3))
    return Number.isInteger(value) && value > 0 ? [value] : []
  })
  return indexes.length === 0 ? 1 : Math.max(...indexes) + 1
}

function pad(value: number): string {
  return String(value).padStart(3, '0')
}

function sayingFixture(index: number): string {
  return `---
text: 'Card preview Saying ${pad(index)} — strict alternating image fixture.'
author: 'Development fixture'
source: 'Card crop review'
tags: ['card-preview']
draft: false
---

This temporary Saying exists only to expose one real Media card during development. Remove the
card-preview fixtures after the image-side review is complete.
`
}

function traceFixture(index: number): string {
  // Keep every fixture newer than the existing Trace notes while remaining
  // deterministic. The archive's date sort therefore puts the review cards in
  // a predictable block before the original notes.
  const timestamp = new Date(Date.UTC(2026, 7, 28, 12, 0, 0) - (index - 1) * 60 * 60 * 1000)
    .toISOString()
    .replace('.000Z', 'Z')
  return `---
title: 'Card preview Trace ${pad(index)} — strict alternating image fixture.'
description: 'Temporary development Trace for reviewing the real diagonal card crop.'
publishDate: ${timestamp}
tags: ['card-preview']
draft: false
---

This temporary Trace exists only to expose one real Media fallback card during development.
Remove the card-preview fixtures after the image-side review is complete.
`
}

async function ensureFixtures(kind: PreviewKind, target: number): Promise<number> {
  const directory = path.join(contentRoot, kind === 'saying' ? 'sayings' : 'traces')
  await mkdir(directory, { recursive: true })
  const names = await readdir(directory)
  const sources = await Promise.all(
    names
      .filter((name) => /\.mdx?$/.test(name))
      .map(async (name) => ({ name, source: await readFile(path.join(directory, name), 'utf8') }))
  )
  const publishedCount = sources.filter(({ source }) => isPublished(source)).length
  const missing = Math.max(0, target - publishedCount)
  let index = nextPreviewIndex(names, kind)

  for (let created = 0; created < missing; created += 1) {
    const filename = `${previewPrefix}${kind}-${pad(index)}.md`
    const filePath = path.join(directory, filename)
    const source = kind === 'saying' ? sayingFixture(index) : traceFixture(index)
    if (dryRun) {
      console.log(`[dry-run] create ${path.relative(projectRoot, filePath)}`)
    } else {
      await writeFile(filePath, source, 'utf8')
      console.log(`created ${path.relative(projectRoot, filePath)}`)
    }
    index += 1
  }

  return missing
}

const sayingTarget = minimumAlternatingSlots(sayingDecorativeImages)
const traceTarget = minimumAlternatingSlots(traceFallbackImages)
const sayingCreated = await ensureFixtures('saying', sayingTarget)
const traceCreated = await ensureFixtures('trace', traceTarget)

console.log(
  `${dryRun ? 'would create' : 'created'} ${sayingCreated + traceCreated} fixture(s); targets: Saying=${sayingTarget}, Trace=${traceTarget}`
)
