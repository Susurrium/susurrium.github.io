export function normalizePathname(pathname) {
  const value = String(pathname ?? '').split(/[?#]/, 1)[0] || '/'
  if (value === '/') return value
  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

export function matchesBrowserRoute({ pathname, canonical }, expectedPath, canonicalSiteUrl) {
  // Pages 的目录重定向允许尾斜杠；canonical 仍须精确指向发布站的目标路由。
  return (
    normalizePathname(pathname) === expectedPath &&
    canonical === new URL(expectedPath, canonicalSiteUrl).href
  )
}
