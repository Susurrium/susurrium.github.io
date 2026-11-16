import { describe, expect, test } from 'bun:test'

import { cardCropSelections, getCardCropRuntime } from '../src/data/card-crops'
import { traceFallbackImages } from '../src/data/home-media'
import { frameForImageSide, layoutVariantForFrame } from '../src/lib/card-crop/types'
import {
  buildAlternatingCardImageAssignments,
  splitAlternatingQueues
} from '../src/lib/card-layout/alternating'
import {
  planCardMedia,
  type MediaPlanningPolicy,
  type MediaPlanningRecord
} from '../src/lib/card-layout/planner'
import { buildContentMediaMap } from '../src/lib/content-layer/media'
import {
  buildDetailPageData,
  buildHomePageData,
  createResolvedPageItem,
  getPageItems,
  resolveMediaImage
} from '../src/lib/content-layer/page-data'
import { buildCollectionStaticPaths } from '../src/lib/content-layer/pagination'
import { contentTypeRegistry } from '../src/lib/content-layer/registry'
import { buildTagStaticPaths } from '../src/lib/content-layer/tags'
import type { ContentCatalog, PageItem, TraceRecord } from '../src/lib/content-layer/types'

// 固定 Astro 版本的真实分页实现，验证传入规划结果后的切片和 URL。
const { generatePaginateFunction } = await import(
  new URL('dist/core/render/paginate.js', import.meta.resolve('astro/package.json')).href
)
const routePart = (content: string, dynamic = false, spread = false) => ({
  content,
  dynamic,
  spread
})

const policy: MediaPlanningPolicy = {
  enabled: true,
  source: 'cover-or-pool',
  pool: 'scenes',
  poolSource: 'fallback',
  sort: 'publish-date-desc',
  layout: 'alternating',
  scope: 'public-kind'
}
const record = (id: string, day: number, image?: TraceRecord['image']): TraceRecord => ({
  kind: 'trace',
  key: `trace:${id}`,
  id,
  title: id,
  cardTitle: id,
  href: `/traces/${id}/`,
  draft: false,
  publishedAt: new Date(`2026-01-${String(day).padStart(2, '0')}`),
  tags: ['all'],
  image
})
const cover = (id: string) => ({
  key: `cover-${id}`,
  src: `/covers/${id}.webp`,
  alt: `Photo ${id}`
})
const plan = (records: readonly MediaPlanningRecord[]) =>
  planCardMedia(records, { trace: policy }, { scenes: traceFallbackImages })

describe('shared card media planning', () => {
  test('preserves the full ordered pool sequence and repeat rounds', () => {
    const records = Array.from({ length: 49 }, (_, i) => record(String(i).padStart(2, '0'), 1))
    const actual = [...plan(records).values()]
    const expected = buildAlternatingCardImageAssignments(traceFallbackImages, records.length, {
      source: 'fallback'
    })
    expect(actual).toEqual(expected)
  })

  test('plans all covers without requiring a pool and preserves semantic alt text', () => {
    const records = [
      record('a', 3, cover('a')),
      record('b', 2, cover('b')),
      record('c', 1, cover('c'))
    ]
    const actual = [...planCardMedia(records, { trace: policy }, {}).values()]
    expect(actual.map((image) => image.imageSide)).toEqual(['left', 'right', 'left'])
    actual.forEach((image, index) => {
      expect(image).toMatchObject({
        source: 'content',
        decorative: false,
        alt: records[index]!.image!.alt,
        src: records[index]!.image!.src
      })
      expect(image.frame).toBe(frameForImageSide(image.imageSide))
      expect(image.layoutVariant).toBe(layoutVariantForFrame(image.frame))
    })
  })

  test('mixes covers and fallbacks in the same slots, without advancing a second cover sequence', () => {
    const records = [record('a', 3), record('b', 2, cover('b')), record('c', 1)]
    const actual = [...plan(records).values()]
    const pool = buildAlternatingCardImageAssignments(traceFallbackImages, 3, {
      source: 'fallback'
    })
    expect(actual.map((image) => image.imageSide)).toEqual(['left', 'right', 'left'])
    expect(actual[0]).toEqual(pool[0])
    expect(actual[1]).toMatchObject({ src: '/covers/b.webp', source: 'content', decorative: false })
    expect(actual[2]).toEqual(pool[2])
  })

  test('does not require an unused pool side when a cover occupies it', () => {
    const asset = splitAlternatingQueues(traceFallbackImages).left[0]!.asset
    const images = planCardMedia(
      [record('a', 2), record('b', 1, cover('b'))],
      { trace: policy },
      { scenes: [asset] }
    )
    expect([...images.values()].map((image) => image.imageSide)).toEqual(['left', 'right'])
  })

  test('uses both approved crops and keeps a single approved frame restrictive', () => {
    const dualKey = 'content-national-day-2026.webp'
    for (const frame of ['diagonal-left', 'diagonal-right'] as const) {
      expect(getCardCropRuntime(dualKey, frame)?.transform).toEqual(
        cardCropSelections[dualKey]!.transforms[frame]
      )
      const key = 'content-national-day-2026'
      const coverRecord = record('photo', 1, { ...cover('photo'), key })
      const records = frame === 'diagonal-left' ? [record('before', 2), coverRecord] : [coverRecord]
      const image = plan(records).get(coverRecord.key)!
      expect(image.crop).toEqual(getCardCropRuntime(dualKey, frame))
    }
    const single = traceFallbackImages.find(
      (asset) => cardCropSelections[asset.src.split('/').pop()!]?.selection === 'diagonal-right'
    )!
    expect(single).toBeDefined()
    expect(() =>
      plan([
        record('new', 2),
        record('restricted', 1, { src: single.src, alt: 'Restricted photo' })
      ])
    ).toThrow(/trace:restricted.*target right\/diagonal-left.*allowed diagonal-right/)
  })

  test('reads distinct transforms for each approved direction, including pool queues', () => {
    const original = cardCropSelections['content-national-day-2026.webp']!
    const mutable = cardCropSelections as Record<string, typeof original>
    const filename = 'planner-dual-fixture.webp'
    // 独立的测试记录，用于验证方向解析；不替换生产规划行为。
    mutable[filename] = {
      ...original,
      filename,
      transforms: {
        'diagonal-left': { x: 23, y: 45, zoom: 1.3 },
        'diagonal-right': { x: 78, y: 56, zoom: 1.7 }
      }
    }
    try {
      const asset = {
        key: 'dual',
        src: `/fixtures/${filename}`,
        description: 'Both crops',
        cutSide: 'right' as const
      }
      const images = planCardMedia(
        [record('a', 2), record('b', 1)],
        { trace: policy },
        { scenes: [asset] }
      )
      expect([...images.values()].map((image) => image.crop.transform)).toEqual([
        mutable[filename]!.transforms['diagonal-right'],
        mutable[filename]!.transforms['diagonal-left']
      ])
      expect([...images.values()].map((image) => image.occurrence)).toEqual([1, 2])
    } finally {
      delete mutable[filename]
    }
  })

  test('sorts equal dates by stable key, filters drafts, and replans after adding content', () => {
    const records = [
      record('b', 2, cover('b')),
      record('c', 1),
      record('a', 2),
      { ...record('draft', 3), draft: true }
    ]
    const original = plan(records)
    expect([...original.keys()]).toEqual(['trace:a', 'trace:b', 'trace:c'])
    expect([...plan([...records].reverse())]).toEqual([...original])
    const added = plan([...records, record('new', 3)])
    expect(added.get('trace:b')!.src).toBe(original.get('trace:b')!.src)
    expect(added.get('trace:b')!.imageSide).toBe('left')
    expect(added.get('trace:a')!.key).not.toBe(original.get('trace:a')!.key)
    expect([...added.values()].map((image) => image.imageSide)).toEqual([
      'left',
      'right',
      'left',
      'right'
    ])
  })

  test('accepts a test-only content kind entirely through policy configuration', () => {
    const records = ['c', 'a', 'b'].map((id) => ({
      ...record(id, 1),
      kind: 'field-note',
      key: `field-note:${id}`,
      image: cover(id)
    }))
    const images = planCardMedia(
      records,
      { 'field-note': { ...policy, source: 'pool', poolSource: 'decorative', sort: 'id-asc' } },
      { scenes: traceFallbackImages }
    )
    expect([...images.keys()]).toEqual(['field-note:a', 'field-note:b', 'field-note:c'])
    expect(
      [...images.values()].every((image) => image.decorative && image.source === 'decorative')
    ).toBe(true)
    expect(planCardMedia(records, { 'field-note': { enabled: false } }, {}).size).toBe(0)
    expect(contentTypeRegistry.blog.media.enabled).toBe(false)
    expect(() => planCardMedia(records, {}, {})).toThrow('Missing media policy')
  })
})

describe('canonical map across page surfaces', () => {
  test('paginates odd page sizes after planning and reuses exact media through tags, Home and detail', () => {
    const records = Array.from({ length: 7 }, (_, i) =>
      record(`entry-${i}`, 10 - i, i % 2 ? cover(String(i)) : undefined)
    )
    const catalog: ContentCatalog = {
      mode: 'published',
      all: records,
      byKind: { blog: [], trace: records, saying: [] }
    }
    const canonical = buildContentMediaMap(records)
    const paginate = generatePaginateFunction(
      {
        params: ['...page'],
        segments: [[routePart('traces')], [routePart('...page', true, true)]]
      },
      '/',
      'always'
    )
    const paths = buildCollectionStaticPaths(catalog, 'trace', paginate, { pagination: 3 })
    const pages = paths.map(({ props }) => props.page.data as PageItem[])
    expect(paths.map(({ props }) => props.page.url.current)).toEqual([
      '/traces/',
      '/traces/2/',
      '/traces/3/'
    ])
    expect(paths[1]!.props.page.url.prev).toBe('/traces/')
    expect(
      pages.map((page) => page.map((item) => item.placement.imageAssignment!.imageSide))
    ).toEqual([['left', 'right', 'left'], ['right', 'left', 'right'], ['left']])
    const home = getPageItems(
      buildHomePageData(catalog, { recentLimit: 7 }),
      'recent-writing',
      'trace'
    )
    const filtered = {
      ...catalog,
      all: records.map((r, i) => ({ ...r, tags: i % 2 === 0 ? ['even'] : [] })),
      byKind: {
        ...catalog.byKind,
        trace: records.map((r, i) => ({ ...r, tags: i % 2 === 0 ? ['even'] : [] }))
      }
    }
    const tagPaginate = generatePaginateFunction(
      {
        params: ['tag', '...page'],
        segments: [
          [routePart('traces')],
          [routePart('tags')],
          [routePart('tag', true)],
          [routePart('...page', true, true)]
        ]
      },
      '/',
      'always'
    )
    const tagPaths = buildTagStaticPaths(filtered, 'trace', tagPaginate, 3)
    const tags = tagPaths.flatMap(({ props }) => props.page.data as PageItem[])
    expect(tagPaths.map(({ props }) => props.page.url.current)).toEqual([
      '/traces/tags/even/',
      '/traces/tags/even/2/'
    ])
    expect(tags.map((item) => item.placement.imageAssignment!.imageSide)).toEqual([
      'left',
      'left',
      'left',
      'left'
    ])
    for (const item of [...pages.flat(), ...home, ...tags])
      expect(item.placement.imageAssignment).toEqual(canonical.get(item.contentKey))
    const primary = records[1]!
    const detail = buildDetailPageData('trace-detail', primary.href, primary, records, {
      mediaMap: canonical,
      primaryMeaning: '文章',
      relatedGroupKey: 'traces',
      relatedMeaning: '相关条目',
      relatedSectionMeaning: '导航'
    })
    for (const item of [...getPageItems(detail, 'article'), ...getPageItems(detail, 'related')])
      expect(item.placement.imageAssignment).toEqual(canonical.get(item.contentKey))
    expect(() => resolveMediaImage(createResolvedPageItem(primary))).toThrow(
      'Missing canonical media assignment'
    )
  })
})
