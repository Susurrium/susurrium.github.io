import { describe, expect, test } from 'bun:test'

import { resolveHeroVisibility } from '../src/lib/home/hero-visibility'

describe('Home Hero visibility geometry', () => {
  test('clips the fixed media to the small visible Hero strip near the boundary', () => {
    const state = resolveHeroVisibility(8, 384, 400)

    expect(state.covered).toBe(false)
    expect(state.visibleHeight).toBe(8)
    expect(state.visibleMediaHeight).toBeCloseTo(8.3333, 3)
    expect(state.clipBottom).toBeCloseTo(391.6667, 3)
  })

  test('fully clips after the Hero has passed the viewport', () => {
    const state = resolveHeroVisibility(-1, 384, 400)

    expect(state).toMatchObject({
      clipBottom: 400,
      covered: true,
      visibleHeight: 0,
      visibleMediaHeight: 0
    })
  })

  test('clamps overscroll and maps a mismatched media height proportionally', () => {
    const state = resolveHeroVisibility(500, 384, 400)

    expect(state.covered).toBe(false)
    expect(state.visibleHeight).toBe(384)
    expect(state.visibleMediaHeight).toBe(400)
    expect(state.clipBottom).toBe(0)
  })

  test('handles invalid measurements without producing NaN CSS values', () => {
    const state = resolveHeroVisibility(Number.NaN, Number.NaN, Number.NaN)

    expect(state).toEqual({
      clipBottom: 0,
      covered: true,
      heroHeight: 0,
      mediaHeight: 0,
      visibleHeight: 0,
      visibleMediaHeight: 0
    })
  })
})
