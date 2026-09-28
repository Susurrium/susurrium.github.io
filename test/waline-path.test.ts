import { describe, expect, test } from 'bun:test'

import { normalizeWalinePath } from '../src/lib/waline-path'

describe('Waline article path normalization', () => {
  test('uses one id for trailing-slash variants', () => {
    expect(normalizeWalinePath('/about')).toBe('/about')
    expect(normalizeWalinePath('/about/')).toBe('/about')
    expect(normalizeWalinePath('/blog/example///')).toBe('/blog/example')
  })

  test('keeps the root route as the root id', () => {
    expect(normalizeWalinePath('/')).toBe('/')
    expect(normalizeWalinePath('////')).toBe('/')
  })

  test('removes query and hash fragments and supplies a leading slash', () => {
    expect(normalizeWalinePath('/about/?preview=1#comments')).toBe('/about')
    expect(normalizeWalinePath('sayings/example/')).toBe('/sayings/example')
    expect(normalizeWalinePath('')).toBe('/')
  })

  test('decodes Unicode routes while preserving encoded reserved characters', () => {
    expect(normalizeWalinePath('/traces/%E5%8F%AF%E6%98%AF-%E7%94%9F%E6%B4%BB')).toBe(
      '/traces/可是-生活'
    )
    expect(normalizeWalinePath('/traces/a%2Fb')).toBe('/traces/a%2Fb')
    expect(normalizeWalinePath('/traces/%E0%A4%A')).toBe('/traces/%E0%A4%A')
  })
})
