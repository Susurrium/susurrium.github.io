import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'

import { getHeroCropTransform, normalizeHeroCropRecord } from '../src/data/hero-crops'
import { normalizeHeroCropTransform } from '../src/lib/hero-crop/types'

const projectRoot = resolve(import.meta.dir, '..')
const read = (path: string) => readFileSync(resolve(projectRoot, path), 'utf8')

describe('Hero crop contract', () => {
  test('normalizes focal values to the supported range', () => {
    expect(normalizeHeroCropTransform({ x: -10, y: 140, zoom: 20 })).toEqual({
      x: 0,
      y: 100,
      zoom: 4
    })
    expect(normalizeHeroCropTransform(undefined)).toEqual({ x: 50, y: 50, zoom: 1 })
  })

  test('falls back to centered cover until a Hero record is applied', () => {
    expect(getHeroCropTransform('/images/home-media/not-yet-configured.webp', 'desktop')).toEqual({
      x: 50,
      y: 50,
      zoom: 1
    })
    expect(getHeroCropTransform('/images/home-media/not-yet-configured.webp', 'mobile')).toEqual({
      x: 50,
      y: 50,
      zoom: 1
    })
  })

  test('normalizes exported records without allowing an unsafe filename or value', () => {
    expect(
      normalizeHeroCropRecord('../thumb-1920-1381117.webp', {
        desktop: { x: 12, y: 88, zoom: 1.7 },
        mobile: { x: 64, y: 40, zoom: 2.2 },
        schemaVersion: 999 as never
      })
    ).toMatchObject({
      filename: 'thumb-1920-1381117.webp',
      desktop: { x: 12, y: 88, zoom: 1.7 },
      mobile: { x: 64, y: 40, zoom: 2.2 },
      schemaVersion: 1
    })
  })

  test('keeps editor and Home on one Hero stage contract', () => {
    const editor = read('src/components/tools/HeroCropEditor.astro')
    const editorScript = read('src/scripts/hero-crop-editor.ts')
    const hero = read('src/components/home/HeroGallery.astro')
    const frame = read('src/components/home/HeroMediaFrame.astro')

    expect(editor).toContain("import HeroGallery from '@/components/home/HeroGallery.astro'")
    expect(editor).toContain('<HeroGallery')
    expect(editor).toContain("data-hero-motion='preview'")
    expect(editor).toContain("data-hero-action='load-production'")
    expect(editor).toContain("data-hero-action='clear-confirmations'")
    expect(editor).toContain('data-hero-stage-viewport')
    expect(editorScript).toContain('syncStageGeometry')
    expect(editorScript).toContain('--hero-editor-scale')
    expect(editorScript).toContain("action === 'clear-confirmations'")
    expect(hero).toContain('data-hero-mode={mode}')
    expect(hero).toContain("data-home-hero-boundary={isEditor ? undefined : ''}")
    expect(frame).toContain('--hero-media-position-desktop')
    expect(frame).toContain("data-hero-viewport='mobile'")
    // Active variables must come from the viewport rules. An inline active
    // value would override the production mobile media query.
    expect(frame).not.toContain('`--hero-media-position:${position}`')
  })
})
