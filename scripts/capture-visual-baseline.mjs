/**
 * Capture the visual evidence required by IMPLEMENTATION_PLAN.zh-CN.md §18.3.
 *
 * This is intentionally a capture-and-review tool, not a naïve pixel-diff
 * gate. The product has deliberately registered differences from Arthals
 * (entrance, Home composition, content model, and approved effect surfaces),
 * so a raw image diff would turn known work into permanent noise. The manifest
 * records the exact URL mapping, viewport/theme coverage, screenshots, DOM
 * shell metrics, and browser exceptions for a reviewer to compare against the
 * documented variance ledger.
 *
 * Prerequisites:
 *   - an upstream static build served at VISUAL_UPSTREAM_URL (default :4322)
 *   - the current static build or preview served at VISUAL_CURRENT_URL
 *     (default :4321)
 *   - Chrome launched with --remote-debugging-port=9224, or CHROME_CDP_URL
 *
 * Output is intentionally ignored by Git under artifacts/visual-baseline/.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const cdpEndpoint = (process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224').replace(/\/$/, '')
const upstreamUrl = (process.env.VISUAL_UPSTREAM_URL ?? 'http://127.0.0.1:4322').replace(/\/$/, '')
const currentUrl = (process.env.VISUAL_CURRENT_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const outputDirectory = path.resolve(process.env.VISUAL_OUTPUT_DIR ?? 'artifacts/visual-baseline')

const pagePairs = [
  { id: 'home', label: 'Home', upstreamPath: '/', currentPath: '/home' },
  { id: 'blog-list', label: 'Blog list', upstreamPath: '/blog/', currentPath: '/blog' },
  {
    id: 'blog-tags',
    label: 'Blog tags',
    // Arthals has one Blog taxonomy route; this project scopes it under the
    // Blog namespace and deliberately removes the old aggregate /tags route.
    upstreamPath: '/tags/',
    currentPath: '/blog/tags'
  },
  { id: 'archives', label: 'Archives', upstreamPath: '/archives/', currentPath: '/archives' },
  { id: 'search', label: 'Search', upstreamPath: '/search/', currentPath: '/search' },
  { id: 'about', label: 'About', upstreamPath: '/about/', currentPath: '/about' },
  { id: 'links', label: 'Links', upstreamPath: '/links/', currentPath: '/links' }
]

// Detail captures are content-dependent. Keep them opt-in so deleting all
// development posts for the final release does not leave a stale fixture route
// in the visual harness. Set both paths when a representative article exists.
const visualBlogDetailPath = process.env.VISUAL_CURRENT_BLOG_DETAIL_PATH
const visualUpstreamBlogDetailPath = process.env.VISUAL_UPSTREAM_BLOG_DETAIL_PATH
if (visualBlogDetailPath) {
  pagePairs.push({
    id: 'blog-detail',
    label: 'Blog detail',
    upstreamPath: visualUpstreamBlogDetailPath ?? visualBlogDetailPath,
    currentPath: visualBlogDetailPath
  })
}

const visualGithubDetailPath = process.env.VISUAL_CURRENT_GITHUB_DETAIL_PATH
const visualUpstreamGithubDetailPath = process.env.VISUAL_UPSTREAM_GITHUB_DETAIL_PATH
if (visualGithubDetailPath) {
  pagePairs.push({
    id: 'blog-detail-github-card',
    label: 'Blog detail with GitHub card',
    upstreamPath: visualUpstreamGithubDetailPath ?? visualGithubDetailPath,
    currentPath: visualGithubDetailPath
  })
}

const variants = [
  { id: 'desktop-light', width: 1440, height: 1000, mobile: false, theme: 'light' },
  { id: 'desktop-dark', width: 1440, height: 1000, mobile: false, theme: 'dark' },
  { id: 'mobile-light', width: 390, height: 844, mobile: true, theme: 'light' },
  { id: 'mobile-dark', width: 390, height: 844, mobile: true, theme: 'dark' }
]

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

      for (const observer of this.observers.get(message.method) ?? []) observer(message.params)

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
      }, 20000)
      this.pending.set(id, { resolve, reject, timeout })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  waitFor(method) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for Chrome event: ${method}`)),
        20000
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

  observe(method, observer) {
    const observers = this.observers.get(method) ?? []
    observers.push(observer)
    this.observers.set(method, observers)
    return () =>
      this.observers.set(
        method,
        (this.observers.get(method) ?? []).filter((entry) => entry !== observer)
      )
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
  await delay(350)
}

async function reload(cdp) {
  const loaded = cdp.waitFor('Page.loadEventFired')
  await cdp.call('Page.reload', { ignoreCache: true })
  await loaded
  await delay(350)
}

async function createTarget() {
  const response = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT'
  })
  if (!response.ok)
    throw new Error(`Could not create a Chrome target at ${cdpEndpoint}: ${response.status}`)
  return response.json()
}

async function closeTarget(targetId) {
  await fetch(`${cdpEndpoint}/json/close/${targetId}`, { method: 'PUT' }).catch(() => undefined)
}

async function screenshot(cdp, filePath) {
  const { data } = await cdp.call('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
    fromSurface: true
  })
  await writeFile(filePath, Buffer.from(data, 'base64'))

  const { data: pixels, info } = await sharp(filePath).removeAlpha().raw().toBuffer({
    resolveWithObject: true
  })
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
    darkPixelRatio: Number((darkPixels / pixelCount).toFixed(4)),
    height: info.height,
    width: info.width
  }
}

async function inspectShell(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const box = element.getBoundingClientRect()
        return { height: Math.round(box.height), width: Math.round(box.width), x: Math.round(box.x), y: Math.round(box.y) }
      }
      const text = document.body?.innerText?.trim() ?? ''
      const nav = [...document.querySelectorAll('header-component a[href], header a[href]')]
        .map((anchor) => anchor.textContent?.replace(/\\s+/g, ' ').trim())
        .filter(Boolean)
      const style = getComputedStyle(document.documentElement)
      return {
        bodyTextLength: text.length,
        darkClass: document.documentElement.classList.contains('dark'),
        footer: rect('[data-page-footer-layer], footer'),
        header: rect('header-component, header'),
        main: rect('main'),
        nav,
        pathname: location.pathname,
        scrollHeight: Math.round(document.documentElement.scrollHeight),
        surface: {
          backgroundColor: getComputedStyle(document.body).backgroundColor,
          color: getComputedStyle(document.body).color,
          radius: style.getPropertyValue('--radius').trim()
        },
        title: document.title
      }
    })()`
  )
}

async function waitForTheme(cdp, theme) {
  const expectedDark = theme === 'dark'
  const deadline = Date.now() + 5_000
  let state
  do {
    state = await evaluate(
      cdp,
      `({
        darkClass: document.documentElement.classList.contains('dark'),
        readyState: document.readyState,
        storedTheme: (() => { try { return localStorage.getItem('theme') } catch { return 'unavailable' } })()
      })`
    )
    if (state.darkClass === expectedDark) return state
    await delay(100)
  } while (Date.now() < deadline)
  return state
}

async function capturePage({ page, variant, side, rootUrl, pathname }) {
  const target = await createTarget()
  const cdp = await connect(target.webSocketDebuggerUrl)
  const browserErrors = []
  const runtimeExceptions = []

  try {
    await cdp.call('Page.enable')
    await cdp.call('Runtime.enable')
    await cdp.call('Log.enable')
    cdp.observe('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      runtimeExceptions.push(exceptionDetails.text ?? 'unknown runtime exception')
    })
    cdp.observe('Log.entryAdded', ({ entry }) => {
      if (entry.level === 'error') browserErrors.push(entry.text)
    })
    await cdp.call('Emulation.setDeviceMetricsOverride', {
      width: variant.width,
      height: variant.height,
      deviceScaleFactor: 1,
      mobile: variant.mobile
    })
    await cdp.call('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [
        { name: 'prefers-color-scheme', value: variant.theme },
        { name: 'prefers-reduced-motion', value: 'no-preference' }
      ]
    })
    // A fresh CDP target starts as about:blank. Its evaluate-on-new-document
    // hook races the site's inline ThemeProvider in Chromium, so it cannot
    // faithfully model a returning visitor. Load once, save the preference
    // on the real origin, then reload: this is the same durable state a
    // visitor has before a direct revisit.
    await navigate(cdp, `${rootUrl}${pathname}`)
    await evaluate(
      cdp,
      `try { localStorage.setItem('theme', ${JSON.stringify(variant.theme)}) } catch {}`
    )
    await reload(cdp)
    await evaluate(
      cdp,
      'Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((resolve) => setTimeout(resolve, 2500))])'
    )
    await delay(400)
    const themeState = await waitForTheme(cdp, variant.theme)
    const top = await inspectShell(cdp)
    assert(top.bodyTextLength > 0, `${side}/${page.id}/${variant.id} rendered an empty body`)
    assert(top.header, `${side}/${page.id}/${variant.id} rendered without the site header`)
    assert(top.main, `${side}/${page.id}/${variant.id} rendered without the site main landmark`)
    assert(
      !/^404:\s*Not Found/i.test(top.title),
      `${side}/${page.id}/${variant.id} resolved to a framework 404 page`
    )
    assert(
      top.darkClass === (variant.theme === 'dark'),
      `${side}/${page.id}/${variant.id} did not apply ${variant.theme} theme (stored: ${themeState.storedTheme}, ready: ${themeState.readyState})`
    )
    const prefix = `${side}-${page.id}-${variant.id}`
    const topFile = `${prefix}-top.png`
    const topScreenshot = await screenshot(cdp, path.join(outputDirectory, topFile))
    assert(
      variant.theme !== 'dark' || topScreenshot.darkPixelRatio >= 0.01,
      `${side}/${page.id}/${variant.id} produced a visually blank dark screenshot`
    )

    await evaluate(
      cdp,
      'window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight - window.innerHeight))'
    )
    await delay(300)
    const bottom = await inspectShell(cdp)
    const bottomFile = `${prefix}-bottom.png`
    const bottomScreenshot = await screenshot(cdp, path.join(outputDirectory, bottomFile))

    return {
      id: page.id,
      label: page.label,
      side,
      theme: variant.theme,
      viewport: { height: variant.height, mobile: variant.mobile, width: variant.width },
      url: `${rootUrl}${pathname}`,
      top: { ...top, screenshot: topFile, screenshotStats: topScreenshot },
      bottom: { ...bottom, screenshot: bottomFile, screenshotStats: bottomScreenshot },
      browserErrors,
      runtimeExceptions
    }
  } finally {
    cdp.close()
    await closeTarget(target.id)
  }
}

await mkdir(outputDirectory, { recursive: true })
const manifest = {
  generatedAt: new Date().toISOString(),
  coverage: {
    areas: ['top', 'bottom'],
    expectedCaptures: pagePairs.length * variants.length * 2 * 2,
    pages: pagePairs.map(({ currentPath, id, label, upstreamPath }) => ({
      currentPath,
      id,
      label,
      upstreamPath
    })),
    variants
  },
  endpoints: { currentUrl, upstreamUrl },
  captures: []
}

for (const page of pagePairs) {
  for (const variant of variants) {
    console.log(`Capturing ${page.id} (${variant.id})`)
    manifest.captures.push(
      await capturePage({
        page,
        variant,
        side: 'upstream',
        rootUrl: upstreamUrl,
        pathname: page.upstreamPath
      })
    )
    manifest.captures.push(
      await capturePage({
        page,
        variant,
        side: 'current',
        rootUrl: currentUrl,
        pathname: page.currentPath
      })
    )
  }
}

const screenshotCount = manifest.captures.length * manifest.coverage.areas.length
assert(
  screenshotCount === manifest.coverage.expectedCaptures,
  'Visual capture coverage is incomplete.'
)
await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
)
console.log(
  `Visual baseline capture complete: ${screenshotCount} screenshots in ${outputDirectory}`
)
