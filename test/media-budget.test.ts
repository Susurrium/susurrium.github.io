import { createHash } from 'node:crypto'
import { describe, expect, test } from 'bun:test'

import { assetRole, inspectMediaBudgets, mediaLimits, MiB } from '../scripts/lib/media-budget.mjs'

const hash = createHash('sha256').update('fixture').digest('hex')
const entry = (path: string, bytes: number, sha256 = hash) => ({ path, bytes, sha256 })

describe('media budget boundaries and reporting', () => {
  for (const extension of ['jpg', 'jpeg', 'png', 'webp', 'avif']) {
    test(`${extension} keeps exact recommended/hard boundaries for both source and delivery`, () => {
      const limit = mediaLimits[`.${extension}`]
      for (const prefix of ['src/content/blog/post', 'public/images', 'dist/_astro']) {
        expect(
          inspectMediaBudgets([entry(`${prefix}/photo.${extension}`, limit.recommended)]).warnings
        ).toHaveLength(0)
        expect(
          inspectMediaBudgets([entry(`${prefix}/photo.${extension}`, limit.recommended + 1)])
            .warnings
        ).toHaveLength(1)
        expect(
          inspectMediaBudgets([entry(`${prefix}/photo.${extension}`, limit.hard)]).failures
        ).toHaveLength(0)
        expect(
          inspectMediaBudgets([entry(`${prefix}/photo.${extension}`, limit.hard + 1)]).failures
        ).toHaveLength(1)
      }
    })
  }

  test('distinguishes production delivery, article sources, icon masters and reference fixtures', () => {
    expect(assetRole('public/images/a.webp')).toBe('delivery')
    expect(assetRole('dist/_astro/a.webp')).toBe('delivery')
    expect(assetRole('src/content/blog/a/cover.png')).toBe('source')
    expect(assetRole('src/assets/favicon/master.png')).toBe('master')
    expect(assetRole('test/fixtures/reference-images/largeskull/a.jpg')).toBe('reference')
    const result = inspectMediaBudgets([entry('src/assets/favicon/master.png', 2 * MiB)])
    expect(result.warnings[0]).toContain('[master]')
    expect(result.failures).toHaveLength(0)
    expect(
      inspectMediaBudgets([entry('src/assets/favicon/master.png', 5 * MiB + 1)]).failures
    ).toHaveLength(1)
  })

  test('groups an exact source/published copy, retaining every path and role', () => {
    const result = inspectMediaBudgets([
      entry('src/content/traces/a/photo.webp', MiB),
      entry('dist/_astro/photo.webp', MiB)
    ])
    expect(result.warningGroups).toHaveLength(1)
    expect(result.warningGroups[0].paths).toEqual([
      'src/content/traces/a/photo.webp',
      'dist/_astro/photo.webp'
    ])
    expect([...result.warningGroups[0].roles].sort()).toEqual(['delivery', 'source'])
    expect(result.warnings[0]).toContain('dist/_astro/photo.webp')
  })

  test('does not merge distinct encodings or files subject to different budgets', () => {
    expect(
      inspectMediaBudgets([
        entry('public/a.webp', MiB),
        entry('dist/a.webp', MiB, createHash('sha256').update('different').digest('hex')),
        entry('src/content/a.png', 1.5 * MiB)
      ]).warningGroups
    ).toHaveLength(3)
  })

  test('legacy allowance requires verified source paths or exact generated fingerprints', () => {
    const bytes = 3 * MiB
    const options = {
      verifiedLegacy: new Set(['public/a.jpg']),
      legacyFingerprints: new Set([`${bytes}:${hash}`])
    }
    expect(
      inspectMediaBudgets([entry('public/a.jpg', bytes), entry('dist/a.jpg', bytes)], options)
        .failures
    ).toHaveLength(0)
    expect(inspectMediaBudgets([entry('public/other.jpg', bytes)], options).failures).toHaveLength(
      1
    )
    expect(
      inspectMediaBudgets([entry('dist/a.jpg', bytes, 'changed')], options).failures
    ).toHaveLength(1)
  })

  test('retains repository cap and rejects invalid metadata', () => {
    expect(inspectMediaBudgets([entry('src/assets/large.bin', 50 * MiB)]).failures).toHaveLength(1)
    expect(() => inspectMediaBudgets([entry('public/a.webp', Number.NaN)])).toThrow(
      'Invalid asset size'
    )
  })
})
