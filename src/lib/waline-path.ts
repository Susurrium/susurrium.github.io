/**
 * Return the canonical article id used by Waline.
 *
 * GitHub Pages may redirect a route such as `/about` to `/about/`, while
 * Astro's generated pathname can omit the trailing slash. Waline treats the
 * pathname as the article's unique id, so both representations must resolve
 * to the same value. Keep the root route as `/`.
 */
export function normalizeWalinePath(pathname: string): string {
  const value = String(pathname ?? '').split(/[?#]/, 1)[0] || '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  if (withLeadingSlash === '/') return '/'

  return withLeadingSlash.replace(/\/+$/, '') || '/'
}
