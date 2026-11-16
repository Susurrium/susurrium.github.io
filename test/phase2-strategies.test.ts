import { describe, expect, test } from 'bun:test'

import {
  cardCutSideByFilename,
  getCardCutSide,
  resolvePresentation,
  sayingDecorativeImages,
  selectRandom,
  takeRecent,
  traceFallbackImages
} from '../src/data/home-media'
import { splitAlternatingQueues } from '../src/lib/card-layout/alternating'
import { planCardMedia } from '../src/lib/card-layout/planner'
import { normalizeContentPresentation } from '../src/lib/compatibility/content-presentation'
import { sortByDate, sortById } from '../src/lib/content'
import { contentTypeRegistry } from '../src/lib/content-layer/registry'

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
    expect(takeRecent(['newest', 'second', 'third', 'older'])).toEqual([
      'newest',
      'second',
      'third'
    ])
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
    const slots = splitAlternatingQueues(sayingDecorativeImages).left.length * 2
    const records = Array.from({ length: slots + 1 }, (_, index) => ({
      kind: 'saying',
      key: `saying:${String(index).padStart(3, '0')}`,
      title: 'Quote',
      draft: false
    }))
    const assignments = [
      ...planCardMedia(
        records,
        { saying: contentTypeRegistry.saying.media },
        { saying: sayingDecorativeImages }
      ).values()
    ]
    const first = assignments[0]!
    const wrapped = assignments[slots]!

    expect(first.source).toBe('decorative')
    expect(first.decorative).toBe(true)
    expect(first.alt).toBe('')
    expect(wrapped.key).toBe(first.key)
    expect(wrapped.repeated).toBe(true)
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
    const cover = {
      alt: 'A real cover image',
      key: 'test-cover',
      src: '/images/test-cover.webp'
    }
    const image = planCardMedia(
      [{ kind: 'trace', key: 'trace:with-cover', title: 'Cover', draft: false, image: cover }],
      { trace: contentTypeRegistry.trace.media },
      {}
    ).get('trace:with-cover')

    expect(image).toMatchObject({
      alt: 'A real cover image',
      decorative: false,
      key: 'test-cover',
      source: 'content',
      src: '/images/test-cover.webp'
    })
  })

  test('uses the complete sorted collection for repeatable fallback assignments', () => {
    expect(traceFallbackImages.length).toBeGreaterThan(1)
    const records = ['same-trace', 'another-trace'].map((id) => ({
      kind: 'trace',
      key: `trace:${id}`,
      title: id,
      draft: false
    }))
    const firstBuild = planCardMedia(
      records,
      { trace: contentTypeRegistry.trace.media },
      { trace: traceFallbackImages }
    )
    const secondBuild = planCardMedia(
      [...records].reverse(),
      { trace: contentTypeRegistry.trace.media },
      { trace: traceFallbackImages }
    )

    expect([...firstBuild]).toEqual([...secondBuild])
    expect(firstBuild.get('trace:same-trace')).toMatchObject({
      source: 'fallback',
      decorative: true,
      alt: '',
      imageSide: 'right'
    })
    expect(firstBuild.get('trace:another-trace')?.imageSide).toBe('left')
  })
})
