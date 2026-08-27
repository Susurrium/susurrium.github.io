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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function navigate(cdp, url) {
  const loaded = cdp.waitFor('Page.loadEventFired')
  const result = await cdp.call('Page.navigate', { url })
  if (result.errorText) throw new Error(`Could not navigate to ${url}: ${result.errorText}`)
  await loaded
  await delay(180)
}

async function navigateWithClientRouter(cdp, pathname) {
  const result = await evaluate(
    cdp,
    `new Promise((resolve, reject) => {
      const expectedPathname = ${JSON.stringify(pathname)}
      const timeout = window.setTimeout(() => reject(new Error('Timed out waiting for Astro ClientRouter to reach ' + expectedPathname)), 8000)
      const onPageLoad = () => {
        window.setTimeout(() => {
          window.clearTimeout(timeout)
          resolve({
            pathname: window.location.pathname,
            marker: document.querySelector('music-player')?.getAttribute('data-runtime-audit-marker') ?? null,
            navigationEntries: performance.getEntriesByType('navigation').length
          })
        }, 80)
      }
      document.addEventListener('astro:page-load', onPageLoad, { once: true })

      const link = [...document.querySelectorAll('a[href]')].find((anchor) => {
        try {
          return new URL(anchor.href, window.location.href).pathname === expectedPathname
        } catch {
          return false
        }
      })
      if (!link) {
        window.clearTimeout(timeout)
        reject(new Error('No same-page link to ' + expectedPathname + ' exists on ' + window.location.pathname))
        return
      }
      link.click()
    })`
  )
  expect(result.pathname === pathname, `ClientRouter reaches ${pathname}`)
  expect(result.navigationEntries === 1, `${pathname} keeps a single document navigation entry`)
  await delay(220)
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
      const audio = document.querySelector('[data-music-audio]')
      return {
        pathname: window.location.pathname,
        profile: document.body.dataset.effectProfile ?? null,
        musicMode: document.body.dataset.musicMode ?? null,
        hostCount: document.querySelectorAll('visual-effects-host[data-visual-effects-host]').length,
        frames,
        activeEffects: host?.dataset.activeEffects ?? null,
        lifecycle: host?.dataset.lifecycle ?? null,
        playerCount: document.querySelectorAll('music-player[data-global-music-player]').length,
        audioCount: document.querySelectorAll('[data-music-audio]').length,
        persistedMusicCount: document.querySelectorAll('[data-astro-transition-persist="susurrium-music-player"]').length,
        playerMarker: player?.getAttribute('data-runtime-audit-marker') ?? null,
        audioMarker: audio?.getAttribute('data-runtime-audit-marker') ?? null,
        companionCount: document.querySelectorAll('scroll-companion').length,
        heroSlides: document.querySelectorAll('[data-home-hero] [data-slide-index]').length,
        homeWaveCount: document.querySelectorAll('[data-home-waves] .large-skull-hero__parallax > use').length,
        homeBlogCount: document.querySelectorAll('[data-home-recent-blog-list] > li').length,
        homeTraceCount: document.querySelectorAll('[data-home-recent-trace-list] [data-largeskull-card]').length,
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
    state.playerCount === 1 && state.audioCount === 1 && state.persistedMusicCount === 1,
    `${pathname} retains exactly one persistent music player and audio element`
  )
  expect(
    state.playerMarker === musicMarker && state.audioMarker === musicMarker,
    `${pathname} preserves the original music DOM instance through ClientRouter`
  )
  expect(state.musicMode === musicMode, `${pathname} uses the ${musicMode} music presentation`)
  expect(
    state.companionCount === companion,
    `${pathname} has the expected About-only companion ownership`
  )
  return state
}

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
      const audio = document.querySelector('[data-music-audio]')
      player?.setAttribute('data-runtime-audit-marker', marker)
      audio?.setAttribute('data-runtime-audit-marker', marker)
      return marker
    })()`
  )

  const home = await assertRoute(
    cdp,
    {
      pathname: '/home',
      profile: 'standard',
      effectKinds: ['pku', 'click'],
      musicMode: 'full',
      companion: 0
    },
    musicMarker
  )
  expect(
    home.heroSlides === 6 && home.homeWaveCount === 4,
    'Home keeps the six-image LargeSkull Hero and four waves'
  )
  expect(
    home.homeBlogCount === 3 && home.homeTraceCount === 3,
    'Home keeps independent three-item Blog and Trace columns'
  )
  expect(home.homeTimelineCount > 0, 'Home renders its Blog-only timeline')

  const clickFiltering = await evaluate(
    cdp,
    `new Promise((resolve) => {
      const host = document.querySelector('visual-effects-host[data-visual-effects-host]')
      const before = Number(host?.dataset.clickBurstCount ?? 0)
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 9, clientY: 9 }))
      requestAnimationFrame(() => {
        const afterBlank = Number(host?.dataset.clickBurstCount ?? 0)
        const card = document.querySelector('[data-largeskull-card], article, [class*="card"]')
        card?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 12, clientY: 12 }))
        requestAnimationFrame(() => resolve({ before, afterBlank, afterInteractive: Number(host?.dataset.clickBurstCount ?? 0) }))
      })
    })`
  )
  expect(
    clickFiltering.afterBlank === clickFiltering.before + 1,
    'blank page clicks reach the George click-particle bridge once'
  )
  expect(
    clickFiltering.afterInteractive === clickFiltering.afterBlank,
    'interactive card clicks do not create George click particles'
  )

  const routeMatrix = [
    {
      pathname: '/blog',
      profile: 'standard',
      effectKinds: ['pku', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/blog/xv6-os-lab-part8',
      profile: 'reading',
      effectKinds: [],
      musicMode: 'compact',
      companion: 0
    },
    {
      pathname: '/traces',
      profile: 'standard',
      effectKinds: ['pku', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/traces/fourth-field-note',
      profile: 'reading',
      effectKinds: [],
      musicMode: 'compact',
      companion: 0
    },
    {
      pathname: '/home',
      profile: 'standard',
      effectKinds: ['pku', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/sayings',
      profile: 'standard',
      effectKinds: ['pku', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/sayings/make-space',
      profile: 'reading',
      effectKinds: [],
      musicMode: 'compact',
      companion: 0
    },
    {
      pathname: '/projects',
      profile: 'standard',
      effectKinds: ['pku', 'click'],
      musicMode: 'full',
      companion: 0
    },
    {
      pathname: '/about',
      profile: 'about',
      effectKinds: ['pku', 'click'],
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
      effectKinds: ['pku', 'click'],
      musicMode: 'full',
      companion: 0
    }
  ]

  for (const route of routeMatrix) {
    await navigateWithClientRouter(cdp, route.pathname)
    await assertRoute(cdp, route, musicMarker)
  }

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
  await waitForEffects(cdp, ['pku', 'click'])

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
