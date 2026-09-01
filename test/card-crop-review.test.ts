import { describe, expect, test } from 'bun:test'

import {
  cardCropPositionByResolution,
  cardCropReviewItemCount,
  cardCropReviewItems,
  getCropPosition,
  isCardCropResolution,
  isCardCropVerdict
} from '../src/data/card-crop-review'

describe('card crop review catalogue', () => {
  test('covers the two real card pools without pulling Hero into card review', () => {
    expect(cardCropReviewItemCount).toBe(54)
    expect(cardCropReviewItems.filter((item) => item.usage === 'saying')).toHaveLength(34)
    expect(cardCropReviewItems.filter((item) => item.usage === 'trace')).toHaveLength(20)
    expect(new Set(cardCropReviewItems.map((item) => item.id)).size).toBe(54)
  })

  test('uses usage-qualified keys and keeps the current diagonal only as reference', () => {
    const traceItem = cardCropReviewItems.find(
      (item) => item.filename === 'thumb-1920-1381117.webp'
    )

    expect(traceItem?.id).toBe('trace:thumb-1920-1381117.webp')
    expect(traceItem?.usageLabel).toBe('Trace 无图回退')
    expect(traceItem?.src).toContain('/images/home-media/thumb-1920-1381117.webp')
    expect(['left', 'right']).toContain(traceItem?.diagonalSide)
  })

  test('maps retained sides to explicit object positions', () => {
    expect(cardCropPositionByResolution.left).toBe('0% 50%')
    expect(cardCropPositionByResolution.right).toBe('100% 50%')
    expect(cardCropPositionByResolution.center).toBe('50% 50%')
    expect(getCropPosition('custom')).toBe('50% 50%')
    expect(getCropPosition('contain')).toBe('50% 50%')
    expect(getCropPosition('replace')).toBe('50% 50%')
  })

  test('exposes the four review verdicts and the non-forcing resolutions', () => {
    expect(['left', 'right', 'both', 'neither'].every(isCardCropVerdict)).toBe(true)
    expect(
      ['left', 'right', 'center', 'custom', 'contain', 'replace'].every(isCardCropResolution)
    ).toBe(true)
    expect(isCardCropVerdict('unreviewed')).toBe(false)
    expect(isCardCropResolution('random')).toBe(false)
  })
})
