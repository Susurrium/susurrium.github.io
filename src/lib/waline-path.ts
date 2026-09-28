/**
 * Return the canonical article id used by Waline.
 *
 * GitHub Pages may redirect a route such as `/about` to `/about/`, while
 * Astro's generated pathname can omit the trailing slash. Waline treats the
 * pathname as the article's unique id, so both representations must resolve
 * to the same value. Keep the root route as `/`.
 */
export function normalizeWalinePath(pathname: string): string {
  const rawValue = String(pathname ?? '').split(/[?#]/, 1)[0] || '/'
  // Astro exposes non-ASCII route segments URI-encoded. Use the decoded route
  // as the comment id while keeping reserved characters such as %2F encoded.
  let value = rawValue
  try {
    value = decodeURI(rawValue)
  } catch {
    // Keep the original path if it contains malformed percent encoding.
  }
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  if (withLeadingSlash === '/') return '/'

  return withLeadingSlash.replace(/\/+$/, '') || '/'
}
