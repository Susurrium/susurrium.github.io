import { describe, expect, test } from 'bun:test'

import { cardCropPolicy, getCardCropRuntime, normalizeCardCropRecord } from '../src/data/card-crops'
import {
  CARD_CROP_FRAME_RATIO,
  cropRectFromTransform,
  normalizeCropTransform
} from '../src/lib/card-crop/types'

describe('unified card crop contract', () => {
  test('normalizes editor values to safe bounds', () => {
    expect(normalizeCropTransform({ x: -20, y: 140, zoom: 99 })).toEqual({
      x: 0,
      y: 100,
      zoom: 4
    })
    expect(normalizeCropTransform(undefined)).toEqual({ x: 50, y: 50, zoom: 1 })
  })

  test('derives a source-relative cover rectangle at the canonical frame ratio', () => {
    const rect = cropRectFromTransform(1920, 1080, { x: 50, y: 50, zoom: 1 })
    expect(rect.width).toBeCloseTo((1080 * CARD_CROP_FRAME_RATIO) / 1920, 6)
    expect(rect.height).toBeCloseTo(1, 6)
    expect(rect.x).toBeCloseTo((1 - rect.width) / 2, 6)
    expect(rect.y).toBeCloseTo(0, 6)
  })

  test('does not expose an unconfirmed generated crop to production', () => {
    expect(
      getCardCropRuntime('/images/home-media/this-file-is-not-in-the-catalog.webp')
    ).toBeUndefined()
  })

  test('keeps the scope decision explicit and sanitizes optional crop rectangles', () => {
    expect(cardCropPolicy).toMatchObject({
      profile: 'archive-card',
      primaryScenes: ['sayings', 'traces'],
      auxiliaryScenes: ['home'],
      mobileFocus: 'same-transform',
      sceneOverrides: 'explicit-only',
      cropRects: 'reference-only'
    })

    const record = normalizeCardCropRecord('demo.webp', {
      selection: 'diagonal-left',
      fit: 'cover',
      transforms: {},
      cropRects: {
        'diagonal-left': { x: -2, y: 0.2, width: 2, height: 0.5 },
        'diagonal-right': { x: 0.4, y: 0.3, width: 0.2, height: 0.4 }
      },
      schemaVersion: 2
    })
    expect(record?.cropRects).toEqual({
      'diagonal-left': { x: 0, y: 0.2, width: 1, height: 0.5 },
      'diagonal-right': { x: 0.4, y: 0.3, width: 0.2, height: 0.4 }
    })
  })
})
