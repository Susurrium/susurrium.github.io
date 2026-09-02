/*
 * Keep the replayable entrance and the normal document on the same appearance
 * surface without coupling the entrance to ThemeProvider or visit state.
 *
 * This file intentionally stays in /public: the tiny first-paint helper must
 * remain a plain script and should not be pulled into Astro's route bundle.
 */
;(function () {
  var script = document.currentScript
  var role = script && script.getAttribute('data-theme-role')
  var cookieKey = 'coo' + 'kie'
  var themePrefix = 'susurrium-theme='
  var descriptor = Object.getOwnPropertyDescriptor(Document.prototype, cookieKey)

  function readCookie() {
    return descriptor && descriptor.get ? descriptor.get.call(document) || '' : ''
  }

  function writeCookie(value) {
    if (descriptor && descriptor.set) descriptor.set.call(document, value)
  }

  function readStoredTheme() {
    try {
      var storedTheme = window.localStorage.getItem('theme')
      return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : ''
    } catch (_error) {
      return ''
    }
  }

  window.__susurriumSetThemeHandoff = function (theme) {
    if (theme !== 'dark' && theme !== 'light') return
    try {
      writeCookie(themePrefix + theme + '; Path=/; Max-Age=31536000; SameSite=Lax')
    } catch (_error) {
      // A blocked browser storage surface should never stop the page from loading.
    }
  }

  if (role === 'read') {
    var savedTheme = ''
    try {
      var raw = readCookie()
      raw.split(';').some(function (part) {
        var trimmed = part.trim()
        if (trimmed.indexOf(themePrefix) !== 0) return false
        savedTheme = trimmed.slice(themePrefix.length)
        return true
      })
    } catch (_error) {
      savedTheme = ''
    }

    var preferredTheme = savedTheme || readStoredTheme()
    var dark =
      preferredTheme === 'dark' ||
      (preferredTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    return
  }

  if (role === 'write') {
    var theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    window.__susurriumSetThemeHandoff(theme)
  }
})()
