/**
 * Geometry for the fixed Home Hero media layer.
 *
 * The Hero's layout box and its fixed media can differ by a few pixels on a
 * responsive viewport (for example when a legacy minimum height wins).  A
 * visibility state expressed as a ratio lets the media reveal exactly the
 * portion of the Hero that is still above the viewport, instead of switching
 * an entire fixed image on while only a thin edge of the Hero remains.
 */
export interface HeroVisibilityState {
  /** Height of the Hero layout box after invalid values are normalized. */
  readonly heroHeight: number
  /** Height of the fixed media box after invalid values are normalized. */
  readonly mediaHeight: number
  /** Portion of the Hero layout box still visible from its top edge. */
  readonly visibleHeight: number
  /** Portion of the fixed media box to clip from its bottom edge. */
  readonly clipBottom: number
  /** Visible media height after mapping the Hero ratio onto the media box. */
  readonly visibleMediaHeight: number
  /** Whether the Hero has fully passed the top of the viewport. */
  readonly covered: boolean
}

const positiveFinite = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback

/**
 * Resolve a scroll boundary into a continuous, top-anchored media clip.
 *
 * `heroBottom` is measured in viewport coordinates.  Values outside the
 * Hero's [0, height] interval are clamped, making the function safe during
 * rubber-band scrolling, resize, and an initial restored scroll position.
 */
export function resolveHeroVisibility(
  heroBottom: number,
  heroHeightInput: number,
  mediaHeightInput = heroHeightInput
): HeroVisibilityState {
  const heroHeight = positiveFinite(heroHeightInput, 0)
  const mediaHeight = positiveFinite(mediaHeightInput, heroHeight)
  const safeBottom = Number.isFinite(heroBottom) ? heroBottom : 0
  const visibleHeight = Math.min(heroHeight, Math.max(0, safeBottom))
  const ratio = heroHeight > 0 ? visibleHeight / heroHeight : 0
  const visibleMediaHeight = mediaHeight * ratio

  return {
    clipBottom: Math.max(0, mediaHeight - visibleMediaHeight),
    covered: visibleHeight <= 0,
    heroHeight,
    mediaHeight,
    visibleHeight,
    visibleMediaHeight
  }
}
