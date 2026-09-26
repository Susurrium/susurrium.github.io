export type ThemePreference = 'system' | 'dark' | 'light'
let memoryPreference: ThemePreference | undefined

export function readThemePreference(): ThemePreference {
  try {
    const preference = localStorage.getItem('theme')
    if (preference === 'dark' || preference === 'light') return preference
  } catch {
    /* A blocked storage surface still permits an in-memory theme. */
    return memoryPreference ?? 'system'
  }
  return 'system'
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): 'dark' | 'light' {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

export function setThemePreference(preference: ThemePreference, save = false) {
  memoryPreference = preference
  if (save) {
    try {
      localStorage.setItem('theme', preference)
    } catch {
      /* Continue without persistence. */
    }
  }
  const theme = resolveTheme(preference, window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.themePreference = preference
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0B0B10' : '#FCFCFD')
  document.querySelectorAll<HTMLElement>('#toggleDarkMode').forEach((button) => {
    button.dataset.theme = preference
    button.setAttribute(
      'aria-label',
      `切换配色，当前：${preference === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}`
    )
  })
  window.__susurriumSetThemeHandoff?.(theme)
  return preference
}
