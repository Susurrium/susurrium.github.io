/**
 * Release marker policy for generated HTML.
 *
 * The Arthals friend is an intentional, manifest-declared exception on the
 * links page only.  Keep this policy independent from the rest of the release
 * audit so it can be regression-tested without mutating the production dist.
 */

const ARTHALS_NAME = "Arthals' ink"
const ARTHALS_LINK = 'https://arthals.ink/'
const ARTHALS_AVATAR = 'https://cdn.arthals.ink/Arthals.png'

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function manifestArthalsFriend(linksManifest) {
  for (const group of linksManifest?.friends ?? []) {
    for (const friend of group?.link_list ?? []) {
      if (
        typeof friend?.name === 'string' &&
        typeof friend?.link === 'string' &&
        typeof friend?.avatar === 'string' &&
        friend.name.trim().toLowerCase() === ARTHALS_NAME.toLowerCase() &&
        friend.link === ARTHALS_LINK &&
        friend.avatar === ARTHALS_AVATAR
      ) {
        return friend
      }
    }
  }
  return null
}

/**
 * Return the generated visitor-visible/attribute text used by marker checks.
 * Callers should pass text after scripts/styles have been removed from
 * visible text, matching verify-phase6's release-audit semantics.
 */
export function arthalsMarkerText({ visibleText, renderedAttributeText }) {
  return decodeHtmlEntities(`${visibleText} ${renderedAttributeText}`)
}

/**
 * Remove only the exact, manifest-declared Arthals friend fields from the
 * links page marker text. Any additional Arthals identity/domain occurrence is
 * deliberately retained and will fail the strict release gate.
 */
export function stripAllowedArthalsFriend({ path, markerText, linksManifest }) {
  if (path !== 'links/index.html') return markerText

  const friend = manifestArthalsFriend(linksManifest)
  if (!friend) return markerText

  // Do not treat an isolated marker as the declared friend. The generated
  // links card must expose all three manifest fields before any exception is
  // applied.
  const hasDeclaredFriendFields = [friend.name, friend.link, friend.avatar].every((value) =>
    new RegExp(escapeRegExp(value), 'i').test(markerText)
  )
  if (!hasDeclaredFriendFields) return markerText

  return [friend.name, friend.link, friend.avatar].reduce(
    (text, value) => text.replace(new RegExp(escapeRegExp(value), 'gi'), ' '),
    markerText
  )
}

export function manifestContainsArthalsFriend(linksManifest) {
  return Boolean(manifestArthalsFriend(linksManifest))
}
