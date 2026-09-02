/**
 * Route-level visual effect policy.
 *
 * The source algorithms live in local vendor files, while this module is the
 * small project-owned contract that decides where each effect may appear.
 * Keeping it pure makes the page matrix testable without a browser.
 */
export type EffectProfile = 'standard' | 'reading' | 'links' | 'about'

export type EffectProfileConfig = {
  click: boolean
  companion: boolean
  petals: boolean
  ambientBackdrop: boolean
}

export const effectProfiles = {
  standard: {
    click: true,
    companion: false,
    petals: false,
    ambientBackdrop: true
  },
  reading: {
    click: false,
    companion: false,
    petals: false,
    ambientBackdrop: false
  },
  links: {
    click: true,
    companion: false,
    petals: true,
    ambientBackdrop: false
  },
  // The companion is implemented in Phase 5.  Its route policy is already
  // explicit so About does not need a later architecture change.
  about: {
    click: true,
    companion: true,
    petals: false,
    ambientBackdrop: true
  }
} as const satisfies Record<EffectProfile, EffectProfileConfig>

export const defaultEffectProfile: EffectProfile = 'standard'

export function isEffectProfile(value: unknown): value is EffectProfile {
  return typeof value === 'string' && Object.hasOwn(effectProfiles, value)
}

export function resolveEffectProfile(value?: unknown): EffectProfile {
  return isEffectProfile(value) ? value : defaultEffectProfile
}
