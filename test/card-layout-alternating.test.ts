import { describe, expect, test } from 'bun:test'

import { sayingDecorativeImages, traceFallbackImages } from '../src/data/home-media'
import {
  frameForImageSide,
  imageSideForFrame,
  layoutVariantForFrame
} from '../src/lib/card-crop/types'
import {
  buildAlternatingCardImageAssignments,
  minimumAlternatingSlots,
  resolveQueueAsset,
  splitAlternatingQueues
} from '../src/lib/card-layout/alternating'

describe('atomic card layout mapping', () => {
  test('binds the diagonal edge to the only valid image side', () => {
    expect(imageSideForFrame('diagonal-left')).toBe('right')
    expect(imageSideForFrame('diagonal-right')).toBe('left')
    expect(frameForImageSide('right')).toBe('diagonal-left')
    expect(frameForImageSide('left')).toBe('diagonal-right')
    expect(layoutVariantForFrame('diagonal-left')).toBe('image-right-diagonal-left')
    expect(layoutVariantForFrame('diagonal-right')).toBe('image-left-diagonal-right')
  })

  test('uses the confirmed crop frame as the asset layout authority', () => {
    const resolved = resolveQueueAsset(sayingDecorativeImages[0]!)
    expect(resolved.crop.frame).toBe(resolved.frame)
    expect(resolved.imageSide).toBe(imageSideForFrame(resolved.frame))
    expect(resolved.layoutVariant).toBe(layoutVariantForFrame(resolved.frame))
  })
})

describe('strict alternating archive queues', () => {
  test.each([
    ['Saying', sayingDecorativeImages, 'decorative' as const],
    ['Trace', traceFallbackImages, 'fallback' as const]
  ])(
    'covers every %s asset and cycles each visual-side queue in order',
    (_name, assets, source) => {
      const target = minimumAlternatingSlots(assets)
      const assignments = buildAlternatingCardImageAssignments(assets, target, { source })
      const queues = splitAlternatingQueues(assets)

      expect(assignments).toHaveLength(target)
      expect(
        assignments.every(
          (item, index) => index === 0 || item.imageSide !== assignments[index - 1]!.imageSide
        )
      ).toBe(true)
      expect(new Set(assignments.map((item) => item.key)).size).toBe(assets.length)
      expect(assignments.filter((item) => item.repeated).length).toBe(target - assets.length)
      expect(assignments.filter((item) => item.imageSide === 'left').length).toBe(target / 2)
      expect(assignments.filter((item) => item.imageSide === 'right').length).toBe(target / 2)
      expect(queues.left.length + queues.right.length).toBe(assets.length)
      expect(assignments.every((item) => item.source === source)).toBe(true)
      expect(
        assignments.every(
          (item) =>
            item.frame === frameForImageSide(item.imageSide) && item.crop.frame === item.frame
        )
      ).toBe(true)
    }
  )

  test.each([
    ['Saying', sayingDecorativeImages, 'decorative' as const],
    ['Trace', traceFallbackImages, 'fallback' as const]
  ])(
    'starts a new ordered round only after each %s side queue is exhausted',
    (_name, assets, source) => {
      const queues = splitAlternatingQueues(assets)
      const target = minimumAlternatingSlots(assets) * 2
      const assignments = buildAlternatingCardImageAssignments(assets, target, { source })

      for (const side of ['left', 'right'] as const) {
        const expectedQueue = queues[side]
        const sideAssignments = assignments.filter((item) => item.imageSide === side)

        expect(sideAssignments.map((item) => item.key)).toEqual(
          sideAssignments.map((_, index) => expectedQueue[index % expectedQueue.length]!.asset.key)
        )
      }
    }
  )

  test('supports a right-side first slot without changing any asset direction', () => {
    const assignments = buildAlternatingCardImageAssignments(sayingDecorativeImages, 6, {
      source: 'decorative',
      startSide: 'right'
    })
    expect(assignments.map((item) => item.imageSide)).toEqual([
      'right',
      'left',
      'right',
      'left',
      'right',
      'left'
    ])
    expect(assignments.every((item) => item.frame === frameForImageSide(item.imageSide))).toBe(true)
  })
})
