import { describe, expect, test } from 'bun:test'
import {
  defaultEffectProfile,
  effectProfiles,
  isEffectProfile,
  resolveEffectProfile
} from '../src/data/effects'

describe('Phase 4 route visual-effect policy', () => {
  test('keeps ordinary pages, reading pages, and Links mutually explicit', () => {
    expect(effectProfiles.standard).toEqual({
      click: true,
      companion: false,
      petals: false,
      pkuBackdrop: true
    })
    expect(effectProfiles.reading).toEqual({
      click: false,
      companion: false,
      petals: false,
      pkuBackdrop: false
    })
    expect(effectProfiles.links).toEqual({
      click: true,
      companion: false,
      petals: true,
      pkuBackdrop: false
    })
  })

  test('reserves the About companion policy without enabling it elsewhere', () => {
    expect(effectProfiles.about).toEqual({
      click: true,
      companion: true,
      petals: false,
      pkuBackdrop: true
    })
  })

  test('rejects arbitrary profile input and keeps a stable ordinary-page fallback', () => {
    expect(defaultEffectProfile).toBe('standard')
    expect(isEffectProfile('links')).toBe(true)
    expect(isEffectProfile('entrance')).toBe(false)
    expect(isEffectProfile('toString')).toBe(false)
    expect(resolveEffectProfile('reading')).toBe('reading')
    expect(resolveEffectProfile('not-a-profile')).toBe('standard')
    expect(resolveEffectProfile()).toBe('standard')
  })
})
