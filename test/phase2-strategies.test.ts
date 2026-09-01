import { describe, expect, test } from 'bun:test'
import {
  getSayingDecorativeImage,
  getCardCutSide,
  getTraceCardImage,
  cardCutSideByFilename,
  resolvePresentation,
  selectRandom,
  stableContentHash,
  takeRecent,
  sayingDecorativeImages,
  traceFallbackImages
} from '../src/data/home-media'
import { sortByDate, sortById } from '../src/lib/content'
import { normalizeContentPresentation } from '../src/lib/compatibility/content-presentation'

describe('Phase 2 presentation policy', () => {
  test('uses page override, then content default, then a safe fallback', () => {
    expect(resolvePresentation('trace')).toBe('media-content')
    expect(resolvePresentation('saying')).toBe('media-decorative')
    expect(resolvePresentation('blog')).toBe('text')
    expect(resolvePresentation('trace', 'text')).toBe('text')
    expect(resolvePresentation('unknown')).toBe('text')
    expect(resolvePresentation('trace', 'not-a-presentation')).toBe('media-content')
    expect(resolvePresentation('trace', 'large-skull-content')).toBe('media-content')
    expect(resolvePresentation('saying', 'large-skull-decorative')).toBe('media-decorative')
    expect(resolvePresentation('blog', 'arthals-text')).toBe('text')
  })

  test('normalizes historical values only at the compatibility boundary', () => {
    expect(normalizeContentPresentation('text')).toBe('text')
    expect(normalizeContentPresentation('large-skull-content')).toBe('media-content')
    expect(normalizeContentPresentation('large-skull-decorative')).toBe('media-decorative')
    expect(normalizeContentPresentation('arthals-text')).toBe('text')
    expect(normalizeContentPresentation('  large-skull-content  ')).toBe('media-content')
    expect(normalizeContentPresentation('unknown', 'media-content')).toBe('media-content')
    expect(normalizeContentPresentation(null, 'media-decorative')).toBe('media-decorative')
  })

  test('keeps recently sorted collections independently capped at three', () => {
    expect(takeRecent(['newest', 'second', 'third', 'older'])).toEqual(['newest', 'second', 'third'])
    expect(takeRecent(['only'])).toEqual(['only'])
    expect(takeRecent([], 3)).toEqual([])
  })

  test('uses content ID as a deterministic secondary archive key', () => {
    const sameDay = new Date('2026-08-27T00:00:00.000Z')
    const entries = [
      { id: 'zeta', data: { publishDate: sameDay } },
      { id: 'alpha', data: { publishDate: sameDay } },
      { id: 'middle', data: { publishDate: sameDay } }
    ]

    expect(sortByDate(entries).map((entry) => entry.id)).toEqual(['alpha', 'middle', 'zeta'])
  })

  test('keeps undated Saying archives in a stable ID order', () => {
    const entries = [{ id: 'zeta' }, { id: 'alpha' }, { id: 'middle' }]
    expect(sortById(entries).map((entry) => entry.id)).toEqual(['alpha', 'middle', 'zeta'])
  })
})

describe('Phase 2 Saying selection', () => {
  test('selects endpoints with injectable random values and handles empty input', () => {
    const entries = ['first', 'middle', 'last']
    expect(selectRandom(entries, () => 0)).toBe('first')
    expect(selectRandom(entries, () => 0.5)).toBe('middle')
    expect(selectRandom(entries, () => 0.999999)).toBe('last')
    expect(selectRandom(entries, () => 1)).toBe('last')
    expect(selectRandom(['only'], () => 0.9)).toBe('only')
    expect(selectRandom([], () => 0)).toBeUndefined()
  })

  test('assigns decoration by stable archive index and wraps its own pool', () => {
    expect(sayingDecorativeImages.length).toBeGreaterThan(1)
    const first = getSayingDecorativeImage(0)
    const last = getSayingDecorativeImage(sayingDecorativeImages.length - 1)
    const wrapped = getSayingDecorativeImage(sayingDecorativeImages.length)

    expect(first.source).toBe('decorative')
    expect(first.decorative).toBe(true)
    expect(first.alt).toBe('')
    expect(last.key).toBe(sayingDecorativeImages.at(-1)?.key)
    expect(wrapped.key).toBe(first.key)
  })

  test('keeps one editorial cut side per supplied local file', () => {
    const catalogFilenames = new Set(
      [...sayingDecorativeImages, ...traceFallbackImages].map((asset) => asset.src.split('/').pop())
    )

    expect(catalogFilenames.size).toBe(54)
    expect(Object.keys(cardCutSideByFilename).sort()).toEqual([...catalogFilenames].sort())
    expect(getCardCutSide({ src: '/images/home-media/thumb-1920-695454.webp' })).toBe('left')
    expect(getCardCutSide({ src: '/images/home-media/thumb-1920-704341.webp' })).toBe('right')
    expect(getCardCutSide({ src: '/images/other-cover.webp' })).toBe('right')
  })
})

describe('Phase 2 Trace image policy', () => {
  test('prefers a supplied content cover with its meaningful alt text', () => {
    const image = getTraceCardImage('with-cover', {
      alt: 'A real cover image',
      key: 'test-cover',
      src: '/images/test-cover.webp'
    })

    expect(image).toEqual({
      alt: 'A real cover image',
      decorative: false,
      key: 'test-cover',
      source: 'content',
      src: '/images/test-cover.webp'
    })
  })

  test('uses a stable ID hash rather than mutable list order for fallbacks', () => {
    expect(traceFallbackImages.length).toBeGreaterThan(1)
    const firstBuild = getTraceCardImage('same-trace')
    const secondBuild = getTraceCardImage('same-trace')
    const anotherTrace = getTraceCardImage('another-trace')

    expect(stableContentHash('same-trace')).toBe(stableContentHash('same-trace'))
    expect(firstBuild).toEqual(secondBuild)
    expect(firstBuild.source).toBe('fallback')
    expect(firstBuild.decorative).toBe(true)
    expect(firstBuild.alt).toBe('')
    expect(firstBuild.key).toBe(
      traceFallbackImages[stableContentHash('same-trace') % traceFallbackImages.length]?.key
    )
    expect(anotherTrace.key).toBe(
      traceFallbackImages[stableContentHash('another-trace') % traceFallbackImages.length]?.key
    )
  })
})
