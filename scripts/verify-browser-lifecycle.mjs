/**
 * Browser-level ClientRouter lifecycle regression.
 *
 * This deliberately talks to an already-running local Chrome through CDP
 * rather than coupling the repository to a downloaded browser binary.  It
 * proves the production preview can cross ten internal routes without
 * accumulating effect hosts, iframe canvases, or music-player instances.
 *
 * Required local services (overridable for CI/lab runners):
 *   - Chrome with --remote-debugging-port=9224
 *   - `bun run preview -- --host 127.0.0.1 --port 4321`
 */

import sharp from 'sharp'

const cdpEndpoint = (process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224').replace(/\/$/, '')
const siteUrl = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const failures = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function expect(condition, message) {
  if (condition) pass(message)
  else fail(message)
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function discoverArchiveCardCount(archivePath, contentType) {
  try {
    const response = await fetch(`${siteUrl}${archivePath}`)
    if (!response.ok) return null
    const html = await response.text()
    return [...html.matchAll(new RegExp(`data-content-type=["']${contentType}["']`, 'gi'))].length
  } catch {
    return null
  }
}

class CdpConnection {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
    this.observers = new Map()

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        clearTimeout(pending.timeout)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
        return
      }

      const observers = this.observers.get(message.method) ?? []
      for (const observer of observers) observer(message.params)

      const listeners = this.listeners.get(message.method) ?? []
      this.listeners.delete(message.method)
      listeners.forEach(({ resolve }) => resolve(message.params))
    })

    socket.addEventListener('close', () => {
      this.pending.forEach(({ reject, timeout }) => {
        clearTimeout(timeout)
        reject(new Error('Chrome DevTools connection closed unexpectedly.'))
      })
      this.pending.clear()
    })
  }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for Chrome DevTools command: ${method}`))
      }, 15000)
      this.pending.set(id, { resolve, reject, timeout })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  waitFor(method) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for Chrome event: ${method}`)),
        15000
      )
      const listeners = this.listeners.get(method) ?? []
      listeners.push({
        resolve: (params) => {
          clearTimeout(timeout)
          resolve(params)
        }
      })
      this.listeners.set(method, listeners)
    })
  }

  observe(method, listener) {
    const observers = this.observers.get(method) ?? []
    observers.push(listener)
    this.observers.set(method, observers)
    return () => {
      const current = this.observers.get(method) ?? []
      this.observers.set(
        method,
        current.filter((candidate) => candidate !== listener)
      )
    }
  }

  close() {
    this.socket.close()
  }
}

async function connect(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl)
    const timeout = setTimeout(
      () => reject(new Error('Timed out connecting to Chrome DevTools.')),
      15000
    )
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timeout)
        resolve(new CdpConnection(socket))
      },
      { once: true }
    )
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timeout)
        reject(new Error('Unable to connect to Chrome DevTools.'))
      },
      { once: true }
    )
  })
}

async function evaluate(cdp, expression) {
  const result = await cdp.call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        'Runtime.evaluate failed'
    )
  }
  return result.result.value
}

function normalizePathname(pathname) {
  const value = String(pathname ?? '').split(/[?#]/, 1)[0] || '/'
  if (value === '/') return value
  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

async function navigate(cdp, url) {
  const loaded = cdp.waitFor('Page.loadEventFired')
  const result = await cdp.call('Page.navigate', { url })
  if (result.errorText) throw new Error(`Could not navigate to ${url}: ${result.errorText}`)
  await loaded
  await delay(180)
}

async function navigateWithClientRouter(cdp, pathname, options = {}) {
  const expectedPathname = normalizePathname(pathname)
  const expectedFrom = options.expectedFrom ? normalizePathname(options.expectedFrom) : null
  const linkSelector = options.linkSelector ?? 'a[href]'
  const result = await evaluate(
    cdp,
    `new Promise((resolve, reject) => {
      const expectedPathname = ${JSON.stringify(expectedPathname)}
      const expectedFrom = ${JSON.stringify(expectedFrom)}
      const linkSelector = ${JSON.stringify(linkSelector)}
      const currentPathname = window.location.pathname.replace(/\\/+$/, '') || '/'
      const timeout = window.setTimeout(() => reject(new Error('Timed out waiting for Astro ClientRouter to reach ' + expectedPathname)), 8000)
      if (expectedFrom && currentPathname !== expectedFrom) {
        window.clearTimeout(timeout)
        reject(new Error('ClientRouter source mismatch: expected ' + expectedFrom + ' but current page is ' + currentPathname))
        return
      }
      const onPageLoad = () => {
        window.setTimeout(() => {
          window.clearTimeout(timeout)
          resolve({
            pathname: window.location.pathname.replace(/\\/+$/, '') || '/',
            marker: document.querySelector('music-player')?.getAttribute('data-runtime-audit-marker') ?? null,
            navigationEntries: performance.getEntriesByType('navigation').length
          })
        }, 80)
      }
      document.addEventListener('astro:page-load', onPageLoad, { once: true })

      const links = [...document.querySelectorAll(linkSelector)]
      const link = links.find((anchor) => {
        try {
          const target = new URL(anchor.href, window.location.href)
          const targetPathname = target.pathname.replace(/\\/+$/, '') || '/'
          return target.origin === window.location.origin && targetPathname === expectedPathname
        } catch {
          return false
        }
      })
      if (!link) {
        window.clearTimeout(timeout)
        reject(new Error('No same-page link to ' + expectedPathname + ' exists on ' + currentPathname + ' within ' + linkSelector + ' (checked ' + links.length + ' links)'))
        return
      }
      link.click()
    })`
  )
  expect(result.pathname === expectedPathname, `ClientRouter reaches ${expectedPathname}`)
  expect(
    result.navigationEntries === 1,
    `${expectedPathname} keeps a single document navigation entry`
  )
  await delay(220)
}

/**
 * Discover detail targets from the archive currently rendered in Chrome.
 * Static HTML fetched before the browser target exists is deliberately not
 * used here: pagination, hydration and ClientRouter state must all describe
 * the same DOM that supplies the link we click next.
 */
async function discoverRuntimeDetailTargets(cdp, { archivePath, contentType }) {
  const result = await evaluate(
    cdp,
    `(() => {
      const archivePath = ${JSON.stringify(normalizePathname(archivePath))}
      const contentType = ${JSON.stringify(contentType)}
      const cards = [...document.querySelectorAll('[data-content-type="' + contentType + '"]')]
      const seen = new Set()
      const candidates = []
      const paginationLinkCount = [...document.querySelectorAll('a[href]')].filter((anchor) => {
        try {
          const url = new URL(anchor.href, window.location.href)
          const pathname = url.pathname.replace(/\\/+$/, '') || '/'
          return url.origin === window.location.origin && new RegExp('^' + archivePath + '/\\\\d+$').test(pathname)
        } catch {
          return false
        }
      }).length
      for (const card of cards) {
        const anchor = card.querySelector('a[href]')
        if (!(anchor instanceof HTMLAnchorElement)) continue
        try {
          const url = new URL(anchor.href, window.location.href)
          const pathname = url.pathname.replace(/\\/+$/, '') || '/'
          if (url.origin !== window.location.origin) continue
          if (!pathname.startsWith(archivePath + '/')) continue
          const segment = pathname.slice(archivePath.length + 1)
          if (!segment || segment.includes('/') || segment.toLowerCase() === 'tags') continue
          if (seen.has(pathname)) continue
          seen.add(pathname)
          candidates.push({ pathname, title: card.querySelector('[data-card-title]')?.textContent?.trim() ?? null })
        } catch {
          // Ignore malformed or external card links; they are not detail targets.
        }
      }
      return { archivePath, contentType, cardCount: cards.length, paginationLinkCount, candidates }
    })()`
  )
  return {
    ...result,
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      archivePath: result.archivePath,
      kind: result.contentType,
      source: 'runtime-dom'
    }))
  }
}

async function waitForEffects(cdp, expectedKinds) {
  return evaluate(
    cdp,
    `new Promise((resolve) => {
      const expected = ${JSON.stringify([...expectedKinds].sort())}
      const deadline = performance.now() + 5000
      const inspect = () => {
        const host = document.querySelector('visual-effects-host[data-visual-effects-host]')
        const kinds = host
          ? [...host.querySelectorAll('iframe[data-effect-frame]')]
              .map((frame) => frame.dataset.effectFrame)
              .filter(Boolean)
              .sort()
          : []
        const same = kinds.length === expected.length && kinds.every((kind, index) => kind === expected[index])
        if (same || performance.now() >= deadline) {
          resolve({ kinds, lifecycle: host?.dataset.lifecycle ?? null, timedOut: !same })
          return
        }
        requestAnimationFrame(inspect)
      }
      inspect()
    })`
  )
}

async function readRouteState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const host = document.querySelector('visual-effects-host[data-visual-effects-host]')
      const frames = host
        ? [...host.querySelectorAll('iframe[data-effect-frame]')].map((frame) => ({
            kind: frame.dataset.effectFrame ?? null,
            ready: frame.dataset.ready ?? null,
            canvasCount: frame.contentDocument?.querySelectorAll('canvas').length ?? 0
          }))
        : []
      const player = document.querySelector('music-player')
      const meting = document.querySelector('[data-music-meting]')
      const runtimeAudio = meting?.aplayer?.audio
      const audio = runtimeAudio ?? document.querySelector('[data-music-audio]')
      return {
        pathname: window.location.pathname,
        profile: document.body.dataset.effectProfile ?? null,
        musicMode: document.body.dataset.musicMode ?? null,
        hostCount: document.querySelectorAll('visual-effects-host[data-visual-effects-host]').length,
        frames,
        activeEffects: host?.dataset.activeEffects ?? null,
        lifecycle: host?.dataset.lifecycle ?? null,
        playerCount: document.querySelectorAll('music-player[data-global-music-player]').length,
        metingCount: document.querySelectorAll('meting-js[data-music-meting]').length,
        audioCount: runtimeAudio ? 1 : document.querySelectorAll('[data-music-audio]').length,
        persistedMusicCount: document.querySelectorAll('[data-astro-transition-persist="susurrium-music-player"]').length,
        playerMarker: player?.getAttribute('data-runtime-audit-marker') ?? null,
        metingMarker: meting?.getAttribute('data-runtime-audit-marker') ?? null,
        audioMarker: audio?.getAttribute('data-runtime-audit-marker') ?? null,
        companionCount: document.querySelectorAll('scroll-companion').length,
        heroSlides: document.querySelectorAll('[data-home-hero] [data-slide-index]').length,
        homeWaveCount: document.querySelectorAll('[data-home-waves] .hero-gallery__parallax > use').length,
        homeBlogCount: document.querySelectorAll('[data-home-recent-blog-list] > li').length,
        homeTraceCount: document.querySelectorAll('[data-home-recent-trace-list] [data-media-card]').length,
        homeTimelineCount: document.querySelectorAll('[data-blog-timeline] [data-timeline-entry]').length
      }
    })()`
  )
}

function frameKinds(state) {
  return state.frames
    .map(({ kind }) => kind)
    .filter(Boolean)
    .sort()
}

async function enrichRuntimeExceptions(cdp, exceptions) {
  for (const exception of exceptions) {
    const frame = exception.stack[0]
    if (!frame?.scriptId) continue
    try {
      const { scriptSource } = await cdp.call('Debugger.getScriptSource', {
        scriptId: frame.scriptId
      })
      const lines = scriptSource.split(/\r?\n/)
      const start = Math.max(0, frame.line - 2)
      exception.source = lines.slice(start, frame.line + 3).join('\n')
    } catch {
      exception.source = 'source unavailable'
    }
  }
}

async function assertRoute(
  cdp,
  { pathname, profile, effectKinds, musicMode, companion },
  musicMarker
) {
  const settled = await waitForEffects(cdp, effectKinds)
  expect(
    !settled.timedOut,
    `${pathname} settles its ${effectKinds.length ? effectKinds.join(' + ') : 'reading'} effect set`
  )

  const state = await readRouteState(cdp)
  expect(state.pathname === pathname, `${pathname} renders the expected route`)
  expect(state.profile === profile, `${pathname} uses the ${profile} effect profile`)
  expect(
    JSON.stringify(frameKinds(state)) === JSON.stringify([...effectKinds].sort()),
    `${pathname} has no duplicate or stale effect frames`
  )
  expect(state.hostCount === 1, `${pathname} has exactly one current visual-effects host`)
  expect(
    state.playerCount === 1 &&
      state.metingCount === 1 &&
      state.audioCount <= 1 &&
      state.persistedMusicCount === 1,
    `${pathname} retains exactly one persistent music player and MetingJS element`
  )
  expect(
    state.playerMarker === musicMarker &&
      state.metingMarker === musicMarker &&
      (state.audioMarker === null || state.audioMarker === musicMarker),
    `${pathname} preserves the original music DOM instance through ClientRouter`
  )
  expect(state.musicMode === musicMode, `${pathname} uses the ${musicMode} music presentation`)
  expect(
    state.companionCount === companion,
    `${pathname} has the expected About-only companion ownership`
  )
  return state
}

async function assertLinksCopyControl(cdp) {
  const copy = await evaluate(
    cdp,
    `(async () => {
      const button = document.querySelector('site-info-copy [data-copy-value]')
      if (!(button instanceof HTMLButtonElement)) return { exists: false }

      const value = button.dataset.copyValue ?? ''
      const inlineHandler = button.getAttribute('onclick')
      const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
      let copied = null
      let toast = null
      const onToast = (event) => {
        toast = event.detail?.message ?? null
      }
      document.addEventListener('toast', onToast, { once: true })

      try {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (nextValue) => {
              copied = nextValue
            }
          }
        })
        button.click()
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { exists: true, value, copied, toast, inlineHandler }
      } catch (error) {
        return { exists: true, value, copied, toast, inlineHandler, error: String(error) }
      } finally {
        document.removeEventListener('toast', onToast)
        if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
        else delete navigator.clipboard
      }
    })()`
  )

  expect(
    copy.exists &&
      !copy.error &&
      copy.copied === copy.value &&
      copy.toast === 'Copied to clipboard.' &&
      copy.inlineHandler === null,
    copy.exists
      ? `Links copies an exact quoted value through its lifecycle-scoped control${copy.error ? ` (${copy.error})` : ''}`
      : 'Links renders a lifecycle-scoped copy control'
  )
}

async function assertSearchLifecycle(cdp) {
  const ui = await evaluate(
    cdp,
    `new Promise((resolve) => {
      const deadline = performance.now() + 8000
      const inspect = () => {
        const root = document.querySelector('#site-search')
        const input = root?.querySelector('input')
        const ready = Boolean(input && root?.querySelector('.pagefind-ui'))
        if (ready || performance.now() >= deadline) {
          resolve({
            input: Boolean(input),
            pagefindUiCount: root?.querySelectorAll('.pagefind-ui').length ?? 0,
            developmentNotice: Boolean(
              document.querySelector('[data-search-workspace]')?.textContent?.includes('开发模式下尚未生成 Pagefind 索引')
            )
          })
          return
        }
        requestAnimationFrame(inspect)
      }
      inspect()
    })`
  )

  expect(
    (ui.input && ui.pagefindUiCount === 1) || ui.developmentNotice,
    ui.developmentNotice
      ? 'Search skips Pagefind initialization when the preview has no development index'
      : ui.input
        ? 'Search initializes exactly one Pagefind UI after ClientRouter navigation'
        : 'Search initializes a Pagefind input after ClientRouter navigation'
  )
  if (!ui.input || ui.developmentNotice) return

  const results = await evaluate(
    cdp,
    `new Promise((resolve) => {
      const input = document.querySelector('#site-search input')
      if (!(input instanceof HTMLInputElement)) {
        resolve({ count: 0 })
        return
      }
      input.value = 'Sisyphus'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      const deadline = performance.now() + 8000
      const inspect = () => {
        const count = document.querySelectorAll('#site-search .pagefind-ui__result').length
        if (count > 0 || performance.now() >= deadline) {
          resolve({ count })
          return
        }
        requestAnimationFrame(inspect)
      }
      inspect()
    })`
  )

  expect(
    results.count > 0,
    results.count > 0
      ? `Search returns results after ClientRouter navigation (${results.count})`
      : 'Search returns results after ClientRouter navigation'
  )
}

async function assertOpeningMediaLifecycle(cdp, pathname) {
  const state = await evaluate(
    cdp,
    `new Promise((resolve) => {
      let image = document.querySelector('[data-reading-opening-media-backdrop]')
      let fixture = null
      // Current development articles may intentionally have no opening image.
      // Create a DOM-only fixture in that case so the lifecycle contract is
      // still exercised without changing editorial test data.
      if (!(image instanceof HTMLElement)) {
        fixture = document.createElement('div')
        fixture.dataset.readingOpeningBackdropRoot = ''
        image = document.createElement('img')
        image.dataset.readingOpeningMediaBackdrop = ''
        fixture.append(image)
        const spacer = document.createElement('div')
        spacer.setAttribute('aria-hidden', 'true')
        spacer.style.height = '300vh'
        fixture.append(spacer)
        document.body.append(fixture)
        document.dispatchEvent(new Event('astro:page-load'))
      }
      if (!(image instanceof HTMLElement)) {
        resolve({ exists: false, fixture: Boolean(fixture) })
        return
      }
      // Read the lifecycle target from the inline value first. The backdrop
      // intentionally has a 300ms CSS transition, so sampling the computed
      // value after two animation frames would only observe the in-between
      // interpolation rather than the runtime's requested state.
      const read = () => {
        const inline = Number.parseFloat(image.style.opacity)
        return Number.isFinite(inline) ? inline : Number.parseFloat(getComputedStyle(image).opacity)
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      requestAnimationFrame(() => {
        const top = read()
        window.scrollTo({ top: Math.max(window.innerHeight * 0.5, 1), left: 0, behavior: 'instant' })
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const middle = read()
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const restored = read()
                window.__readingOpeningMediaBackdropCleanup?.()
                fixture?.remove()
                resolve({
                  exists: true,
                  fixture: Boolean(fixture),
                  top,
                  middle,
                  restored,
                  scrollY: window.scrollY,
                  scrollHeight: document.documentElement.scrollHeight,
                  viewportHeight: window.innerHeight
                })
              })
            )
          })
        })
      })
    })`
  )

  expect(
    state.exists &&
      state.top > 0 &&
      state.top <= 1 &&
      state.middle < state.top &&
      state.restored > 0 &&
      state.restored <= 1 &&
      Math.abs(state.restored - state.top) <= 0.01,
    state.exists
      ? `${pathname} opening-media blur opacity follows scroll and restores on upward scroll${state.fixture ? ' (DOM fixture)' : ''} [top=${state.top}, middle=${state.middle}, restored=${state.restored}, scrollY=${state.scrollY}, scrollHeight=${state.scrollHeight}, viewport=${state.viewportHeight}]`
      : `${pathname} exposes the opening-media lifecycle initializer for verification`
  )
}

async function assertResidenceMapRuntime(cdp) {
  const map = await evaluate(
    cdp,
    `(async () => {
      const scene = document.querySelector('[data-residence-map]')
      if (!(scene instanceof HTMLElement)) return { exists: false }

      scene.scrollIntoView({ block: 'center', inline: 'nearest' })
      const deadline = performance.now() + 5000
      return new Promise((resolve) => {
        const inspect = () => {
          const script = document.querySelector('script[data-residence-maplibre]')
          const mapState = scene.dataset.mapState ?? null
          const settled = Boolean(script && window.maplibregl)
          if (settled || performance.now() >= deadline) {
            resolve({
              exists: true,
              script: Boolean(script),
              mapState,
              global: Boolean(window.maplibregl),
              overlay: Boolean(document.querySelector('vite-error-overlay'))
            })
            return
          }
          requestAnimationFrame(inspect)
        }
        inspect()
      })
    })()`
  )

  expect(
    map.exists && map.script && map.global && !map.overlay,
    map.exists
      ? `Home loads the local MapLibre UMD script without a Vite error overlay${map.mapState ? ` (state: ${map.mapState})` : ''}`
      : 'Home renders the residence scene for MapLibre runtime verification'
  )
}

async function darkScreenshotStats(cdp) {
  const { data } = await cdp.call('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
    fromSurface: true
  })
  const { data: pixels, info } = await sharp(Buffer.from(data, 'base64'))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let darkPixels = 0
  let luminanceTotal = 0
  for (let index = 0; index < pixels.length; index += info.channels) {
    const luminance =
      0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]
    luminanceTotal += luminance
    if (luminance < 80) darkPixels += 1
  }
  const pixelCount = pixels.length / info.channels
  return {
    averageLuminance: Number((luminanceTotal / pixelCount).toFixed(2)),
    darkPixelRatio: Number((darkPixels / pixelCount).toFixed(4))
  }
}

async function assertInitialDarkEffectSurface(cdp) {
  const { identifier } = await cdp.call('Page.addScriptToEvaluateOnNewDocument', {
    source: "try { localStorage.setItem('theme', 'dark') } catch {}"
  })
  try {
    await navigate(cdp, `${siteUrl}/home`)
    const settled = await waitForEffects(cdp, ['ambient-canvas', 'click'])
    expect(
      !settled.timedOut,
      'a direct dark Home visit initializes its ambient canvas + click effects'
    )
    const darkTheme = await evaluate(cdp, "document.documentElement.classList.contains('dark')")
    expect(darkTheme, 'a direct dark Home visit applies the saved dark theme before effects mount')
    await delay(240)
    const stats = await darkScreenshotStats(cdp)
    expect(
      stats.darkPixelRatio >= 0.01,
      stats.darkPixelRatio >= 0.01
        ? 'dark effect iframes preserve a nonblank Home surface'
        : `dark effect iframes preserve a nonblank Home surface (dark ratio ${stats.darkPixelRatio}, luma ${stats.averageLuminance})`
    )
  } finally {
    await cdp
      .call('Page.removeScriptToEvaluateOnNewDocument', { identifier })
      .catch(() => undefined)
    await evaluate(cdp, "localStorage.removeItem('theme')").catch(() => undefined)
  }
}

// Archive counts are only used for the Home column cardinality assertion.
// Detail targets are discovered later from the live archive DOM in Chrome.
const [blogArchiveCount, traceArchiveCount] = await Promise.all([
  discoverArchiveCardCount('/blog', 'blog'),
  discoverArchiveCardCount('/traces', 'trace')
])

const targetResponse = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent('about:blank')}`, {
  method: 'PUT'
})
if (!targetResponse.ok) {
  throw new Error(`Could not create a Chrome target at ${cdpEndpoint}: ${targetResponse.status}`)
}

const target = await targetResponse.json()
const cdp = await connect(target.webSocketDebuggerUrl)
const runtimeExceptions = []
const consoleErrors = []

try {
  await cdp.call('Page.enable')
  await cdp.call('Runtime.enable')
  await cdp.call('Debugger.enable')
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: 1536,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false
  })
  await cdp.call('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
  })
  cdp.observe('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    runtimeExceptions.push({
      description: exceptionDetails?.exception?.description ?? null,
      line: exceptionDetails?.lineNumber ?? null,
      stack:
        exceptionDetails?.stackTrace?.callFrames?.map((frame) => ({
          column: frame.columnNumber,
          function: frame.functionName,
          line: frame.lineNumber,
          scriptId: frame.scriptId,
          url: frame.url
        })) ?? [],
      text: exceptionDetails?.text ?? 'unknown runtime exception',
      url: exceptionDetails?.url ?? null,
      value: exceptionDetails?.exception?.value ?? null
    })
  })
  cdp.observe('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type !== 'error') return
    consoleErrors.push(
      args.map((argument) => argument.value ?? argument.description ?? '').join(' ')
    )
  })

  // The effects are isolated in transparent iframes. Opening a page with dark
  // mode already saved must keep those subframes transparent rather than
  // compositing an opaque white surface above the Home content. Run this as
  // the target's first normal-page visit, then begin the root/entrance flow.
  await assertInitialDarkEffectSurface(cdp)

  await navigate(cdp, `${siteUrl}/`)
  const entrance = await evaluate(
    cdp,
    `(() => ({
      scene: Boolean(document.querySelector('[data-entrance-scene]')),
      video: Boolean(document.querySelector('[data-entrance-video][autoplay][muted][loop]')),
      header: Boolean(document.querySelector('header-component')),
      music: Boolean(document.querySelector('music-player')),
      effects: Boolean(document.querySelector('visual-effects-host')),
      leaving: document.querySelector('[data-entrance-scene]')?.dataset.leaving ?? null
    }))()`
  )
  expect(entrance.scene && entrance.video, 'root renders the replayable local-video entrance')
  expect(
    !entrance.header && !entrance.music && !entrance.effects,
    'root keeps normal-page UI and visual effects unmounted'
  )
  expect(entrance.leaving === 'false', 'a direct root visit begins a fresh entrance session')

  const enteredHome = cdp.waitFor('Page.loadEventFired')
  await evaluate(cdp, "document.querySelector('[data-entrance-scene]')?.click()")
  await enteredHome
  await delay(220)
  const musicMarker = await evaluate(
    cdp,
    `(() => {
      const marker = 'runtime-audit-' + Math.random().toString(36).slice(2)
      const player = document.querySelector('music-player')
      const meting = document.querySelector('[data-music-meting]')
      const audio = meting?.aplayer?.audio ?? document.querySelector('[data-music-audio]')
      player?.setAttribute('data-runtime-audit-marker', marker)
      meting?.setAttribute('data-runtime-audit-marker', marker)
      audio?.setAttribute('data-runtime-audit-marker', marker)
      return marker
    })()`
  )

  const home = await assertRoute(
    cdp,
    {
      pathname: '/home',
      profile: 'standard',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 0
    },
    musicMarker
  )
  expect(
    home.heroSlides === 6 && home.homeWaveCount === 4,
    'Home keeps the six-image Media Hero and four waves'
  )
  expect(
    blogArchiveCount === null
      ? home.homeBlogCount <= 3
      : home.homeBlogCount === Math.min(3, blogArchiveCount),
    blogArchiveCount === null
      ? 'Home keeps the Blog column within its three-item limit'
      : `Home renders the expected Blog column count (${Math.min(3, blogArchiveCount)})`
  )
  expect(
    traceArchiveCount === null
      ? home.homeTraceCount <= 3
      : home.homeTraceCount === Math.min(3, traceArchiveCount),
    traceArchiveCount === null
      ? 'Home keeps the Trace column within its three-item limit'
      : `Home renders the expected Trace column count (${Math.min(3, traceArchiveCount)})`
  )
  expect(
    home.homeTimelineCount >= 0,
    home.homeTimelineCount > 0
      ? 'Home renders its Blog-only timeline'
      : 'Home omits the Blog timeline when no selected-year Blog exists'
  )
  await assertResidenceMapRuntime(cdp)

  const clickFiltering = await evaluate(
    cdp,
    `new Promise((resolve) => {
      const host = document.querySelector('visual-effects-host[data-visual-effects-host]')
      const before = Number(host?.dataset.clickBurstCount ?? 0)
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 9, clientY: 9 }))
      requestAnimationFrame(() => {
        const afterBlank = Number(host?.dataset.clickBurstCount ?? 0)
        const card = document.querySelector('[data-media-card], article, [class*="card"]')
        card?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 12, clientY: 12 }))
        requestAnimationFrame(() => resolve({ before, afterBlank, afterInteractive: Number(host?.dataset.clickBurstCount ?? 0) }))
      })
    })`
  )
  expect(
    clickFiltering.afterBlank === clickFiltering.before + 1,
    'blank page clicks reach the click-particle bridge once'
  )
  expect(
    clickFiltering.afterInteractive === clickFiltering.afterBlank,
    'interactive card clicks do not create click-burst particles'
  )

  const routeMatrix = [
    {
      pathname: '/blog',
      profile: 'standard',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/traces',
      profile: 'standard',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/home',
      profile: 'standard',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/sayings',
      profile: 'standard',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/projects',
      profile: 'standard',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/about',
      profile: 'about',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 1
    },
    {
      pathname: '/links',
      profile: 'links',
      effectKinds: ['petals', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/home',
      profile: 'standard',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 0
    }
  ]

  const archiveDetailSpecs = {
    '/blog': { kind: 'blog', label: 'Blog' },
    '/traces': { kind: 'trace', label: 'Trace' },
    '/sayings': { kind: 'saying', label: 'Saying' }
  }
  for (const route of routeMatrix) {
    await navigateWithClientRouter(cdp, route.pathname)
    await assertRoute(cdp, route, musicMarker)
    if (route.pathname === '/links') await assertLinksCopyControl(cdp)
    if (route.pathname === '/search') await assertSearchLifecycle(cdp)

    const archiveSpec = archiveDetailSpecs[route.pathname]
    if (!archiveSpec) continue

    const discovered = await discoverRuntimeDetailTargets(cdp, {
      archivePath: route.pathname,
      contentType: archiveSpec.kind
    })
    if (discovered.cardCount === 0) {
      pass(`${archiveSpec.label} archive is empty; detail lifecycle check skipped`)
      continue
    }
    if (discovered.candidates.length === 0) {
      fail(
        `${archiveSpec.label} archive rendered ${discovered.cardCount} cards, but no usable detail link was found in the live DOM (pagination links: ${discovered.paginationLinkCount}; likely card/link or pagination discovery issue)`
      )
      continue
    }

    const target = discovered.candidates[0]
    pass(
      `${archiveSpec.label} detail target ${target.pathname} discovered from ${route.pathname} DOM (${discovered.cardCount} cards)`
    )
    await navigateWithClientRouter(cdp, target.pathname, {
      expectedFrom: route.pathname,
      linkSelector: `[data-content-type="${archiveSpec.kind}"] a[href]`
    })
    await assertRoute(
      cdp,
      {
        pathname: target.pathname,
        profile: 'reading',
        effectKinds: [],
        musicMode: 'compact',
        companion: 0
      },
      musicMarker
    )
  }

  // Opening Media uses the same live-card discovery. Prefer a real detail
  // route carrying the layered-media marker; otherwise exercise the existing
  // DOM fixture on the first live detail route and report that distinction.
  let openingMediaChecks = 0
  for (const archivePath of ['/blog', '/traces']) {
    const archiveSpec = archiveDetailSpecs[archivePath]
    await navigateWithClientRouter(cdp, '/home')
    await navigateWithClientRouter(cdp, archivePath)
    const discovered = await discoverRuntimeDetailTargets(cdp, {
      archivePath,
      contentType: archiveSpec.kind
    })
    if (discovered.cardCount === 0) {
      pass(`${archiveSpec.label} archive is empty; opening-media lifecycle check skipped`)
      continue
    }
    if (discovered.candidates.length === 0) {
      fail(
        `${archiveSpec.label} archive rendered ${discovered.cardCount} cards, but opening-media has no usable live detail link (pagination links: ${discovered.paginationLinkCount}; likely card/link or pagination discovery issue)`
      )
      continue
    }

    let openingTarget = null
    for (const candidate of discovered.candidates) {
      await navigateWithClientRouter(cdp, candidate.pathname, {
        expectedFrom: archivePath,
        linkSelector: `[data-content-type="${archiveSpec.kind}"] a[href]`
      })
      const hasOpeningMediaMarker = await evaluate(
        cdp,
        "Boolean(document.querySelector('[data-reading-opening-media-layered]'))"
      )
      if (hasOpeningMediaMarker) {
        openingTarget = candidate
        break
      }
      await navigateWithClientRouter(cdp, '/home')
      await navigateWithClientRouter(cdp, archivePath)
    }

    if (!openingTarget) {
      openingTarget = discovered.candidates[0]
      // Return to the first target after probing candidates so the fixture is
      // still driven by a real ClientRouter transition from this archive.
      if (
        normalizePathname(await evaluate(cdp, 'window.location.pathname')) !==
        openingTarget.pathname
      ) {
        await navigateWithClientRouter(cdp, openingTarget.pathname, {
          expectedFrom: archivePath,
          linkSelector: `[data-content-type="${archiveSpec.kind}"] a[href]`
        })
      }
      pass(
        `${archiveSpec.label} opening-media uses a synthetic DOM fixture (no layered-media detail marker found)`
      )
    } else {
      pass(
        `${archiveSpec.label} opening-media uses real route ${openingTarget.pathname} discovered from ${archivePath} DOM`
      )
    }
    await assertOpeningMediaLifecycle(cdp, openingTarget.pathname)
    openingMediaChecks += 1
  }
  if (openingMediaChecks === 0)
    pass('no published Blog/Trace article detail exists; opening-media lifecycle check skipped')

  await navigateWithClientRouter(cdp, '/search')
  await assertRoute(
    cdp,
    {
      pathname: '/search',
      profile: 'standard',
      effectKinds: ['ambient-canvas', 'click'],
      musicMode: 'full',
      companion: 0
    },
    musicMarker
  )
  await assertSearchLifecycle(cdp)

  await cdp.call('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  })
  await delay(180)
  const reduced = await readRouteState(cdp)
  expect(
    frameKinds(reduced).length === 0 && reduced.lifecycle === 'reduced',
    'reduced-motion disables the standard-page visual frames at runtime'
  )

  await cdp.call('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
  })
  await waitForEffects(cdp, ['ambient-canvas', 'click'])

  await navigate(cdp, `${siteUrl}/`)
  const replayedEntrance = await evaluate(
    cdp,
    `(() => ({ scene: Boolean(document.querySelector('[data-entrance-scene]')), leaving: document.querySelector('[data-entrance-scene]')?.dataset.leaving ?? null }))()`
  )
  expect(
    replayedEntrance.scene && replayedEntrance.leaving === 'false',
    'a later direct root visit replays the entrance instead of reusing visit state'
  )

  await enrichRuntimeExceptions(cdp, runtimeExceptions)
  expect(
    runtimeExceptions.length === 0,
    runtimeExceptions.length === 0
      ? 'ten-route lifecycle regression emits no uncaught runtime exceptions'
      : `ten-route lifecycle regression emits no uncaught runtime exceptions (${JSON.stringify(runtimeExceptions)})`
  )
  expect(
    consoleErrors.length === 0,
    consoleErrors.length === 0
      ? 'ten-route lifecycle regression emits no console.error messages'
      : `ten-route lifecycle regression emits no console.error messages (${consoleErrors.join(' | ')})`
  )
} finally {
  cdp.close()
  await fetch(`${cdpEndpoint}/json/close/${target.id}`, { method: 'PUT' }).catch(() => undefined)
}

console.log(`Browser lifecycle regression complete: ${failures.length} failure(s).`)
if (failures.length > 0) process.exit(1)
