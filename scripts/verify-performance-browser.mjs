import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

import { discoverPublishedContent } from './lib/browser-content.mjs'

const site = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const directory = resolve('artifacts/performance-verification')
await mkdir(directory, { recursive: true })
const browser = await chromium.connectOverCDP(process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224')
const contexts = []
const results = { checks: [], failures: [], version: browser.version() }

async function context(options = {}) {
  const value = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options })
  contexts.push(value)
  await value.addInitScript(() => {
    window.__susurriumRandom = () => 0.25
    window.__performanceIntervals = new Map()
    const start = window.setInterval
    const stop = window.clearInterval
    window.setInterval = function (callback, delay, ...args) {
      const id = start.call(this, callback, delay, ...args)
      window.__performanceIntervals.set(id, { delay, source: String(callback) })
      return id
    }
    window.clearInterval = function (id) {
      window.__performanceIntervals.delete(id)
      return stop.call(this, id)
    }
  })
  return value
}

async function check(name, run) {
  try {
    const evidence = await run()
    results.checks.push({ name, evidence })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.failures.push({ name, error: error.stack })
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

try {
  await check('Hero first decode gates later images and only one slide is prefetched', async () => {
    const owner = await context()
    const page = await owner.newPage()
    const requests = []
    let release
    const held = new Promise((resolveHold) => {
      release = resolveHold
    })
    await page.route('**/images/home-hero/*1381117*', async (route) => {
      await held
      await route.continue()
    })
    page.on('request', (request) => {
      if (request.url().includes('/images/home-hero/')) requests.push(request.url())
    })
    try {
      await page.goto(`${site}/home/`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(300)
      assert.equal(requests.length, 1, JSON.stringify(requests))
    } finally {
      release()
    }
    await page.waitForFunction(
      () => document.querySelector('[data-home-hero]').dataset.playback === 'running'
    )
    await page.waitForTimeout(400)
    assert.equal(requests.length, 2, JSON.stringify(requests))
    const waves = await page
      .locator('.hero-gallery__parallax > use')
      .evaluateAll((elements) =>
        elements.flatMap((element) =>
          element
            .getAnimations()
            .map((animation) => ({
              state: animation.playState,
              time: Number(animation.currentTime)
            }))
        )
      )
    assert.equal(waves.length, 4)
    assert(waves.every((wave) => wave.state === 'running' && wave.time > 0))
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    await page.waitForFunction(
      () => document.querySelector('[data-home-hero]').dataset.playback === 'paused'
    )
    const clock = () =>
      page
        .locator('.hero-gallery__slide')
        .first()
        .evaluate((slide) => Number(slide.getAnimations()[0].currentTime))
    const before = await clock()
    await page.waitForTimeout(250)
    const after = await clock()
    assert(Math.abs(after - before) < 1, `Offscreen animation advanced ${after - before}ms`)
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForFunction(
      () => document.querySelector('[data-home-hero]').dataset.playback === 'running'
    )
    const evidence = { requests, waves, pausedClockDifference: after - before }
    await owner.close()
    return evidence
  })

  await check(
    'reduced motion loads one Hero and the mobile entrance has one poster and no video',
    async () => {
      const owner = await context({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        reducedMotion: 'reduce'
      })
      const page = await owner.newPage()
      const requests = []
      page.on('request', (request) => requests.push(request.url()))
      await page.goto(`${site}/home/`, { waitUntil: 'load' })
      await page.waitForTimeout(300)
      assert.equal(requests.filter((url) => url.includes('/images/home-hero/')).length, 1)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.waitForFunction(
        () => document.querySelector('[data-home-hero]').dataset.playback === 'running'
      )
      await page.emulateMedia({ reducedMotion: 'reduce' })
      requests.length = 0
      await page.goto(`${site}/`, { waitUntil: 'load' })
      await page.waitForTimeout(300)
      assert(!requests.some((url) => /waterfall.*\.(webm|mp4)/.test(url)), JSON.stringify(requests))
      assert(!requests.some((url) => url.endsWith('/entrance-waterfall-poster.webp')))
      assert(requests.some((url) => url.endsWith('/entrance-waterfall-poster-mobile.webp')))
      await owner.close()
      return { resources: requests.filter((url) => /waterfall|home-hero/.test(url)) }
    }
  )

  await check(
    'failed Hero prefetch holds the current image and recovers through retry',
    async () => {
      const owner = await context()
      const page = await owner.newPage()
      let failures = 0
      await page.route('**/images/home-hero/*43935854*', (route) => {
        if (++failures <= 3) return route.abort('failed')
        return route.continue()
      })
      await page.goto(`${site}/home/`, { waitUntil: 'domcontentloaded' })
      await page.locator('[data-hero-retry]').waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForFunction(
        () => document.querySelector('[data-home-hero]').dataset.playback === 'waiting'
      )
      const opacity = await page
        .locator('.hero-gallery__slide')
        .first()
        .evaluate((slide) => Number(getComputedStyle(slide).opacity))
      assert.equal(opacity, 1)
      assert.equal(failures, 3)
      await page.locator('[data-hero-retry]').click()
      await page.waitForFunction(
        () => document.querySelector('[data-home-hero]').dataset.playback === 'running'
      )
      assert.equal(failures, 4)
      await owner.close()
      return { failuresBeforeRetry: 3, heldOpacity: opacity }
    }
  )

  await check(
    'without JavaScript the Hero retains its first image and the entrance retains its poster',
    async () => {
      const owner = await context({ javaScriptEnabled: false })
      const page = await owner.newPage()
      const requests = []
      page.on('request', (request) => requests.push(request.url()))
      await page.goto(`${site}/home/`, { waitUntil: 'load' })
      await page.waitForTimeout(400)
      assert.equal(requests.filter((url) => url.includes('/images/home-hero/')).length, 1)
      const first = page.locator('[data-hero-image]').first()
      assert(await first.evaluate((image) => image.complete && image.naturalWidth > 0))
      assert.equal(
        await page
          .locator('.hero-gallery__slide')
          .first()
          .evaluate((slide) => getComputedStyle(slide).animationPlayState),
        'paused'
      )
      requests.length = 0
      await page.goto(`${site}/`, { waitUntil: 'load' })
      assert(
        await page
          .locator('[data-entrance-poster] img')
          .evaluate((image) => image.complete && image.naturalWidth > 0)
      )
      assert(!requests.some((url) => /waterfall.*\.(webm|mp4)/.test(url)))
      await owner.close()
      return { firstHeroAndPoster: true }
    }
  )

  await check(
    'normal-motion entrance mounts its local sources and starts muted playback',
    async () => {
      const owner = await context({ reducedMotion: 'no-preference' })
      const page = await owner.newPage()
      await page.goto(`${site}/`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => {
        const video = document.querySelector('[data-entrance-video]')
        return (
          video?.readyState >= 2 &&
          !video.paused &&
          video.muted &&
          video.loop &&
          document.querySelector('[data-entrance-scene]')?.dataset.videoReady === 'true'
        )
      })
      const source = await page.locator('video').evaluate((video) => video.currentSrc)
      assert(source.startsWith(site + '/media/entrance-loop-waterfall'))
      await owner.close()
      return { source }
    }
  )

  await check(
    'twenty ClientRouter swaps retain only current listeners and no TOC polling',
    async () => {
      const owner = await context()
      const page = await owner.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      const cdp = await owner.newCDPSession(page)
      const listeners = async (expression) => {
        const object = await cdp.send('Runtime.evaluate', { expression })
        const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
          objectId: object.result.objectId
        })
        return listeners.filter((listener) => listener.type === 'scroll').length
      }
      await page.goto(`${site}/about/`, { waitUntil: 'load' })
      const baselines = new Map()
      const snapshots = []
      for (let index = 0; index < 21; index++) {
        const route = ['/about/', '/projects/', '/blog/'][index % 3]
        if (new URL(page.url()).pathname !== route) {
          await page.locator(`header-component a[href="${route}"]`).click()
          await page.waitForURL((url) => url.pathname === route)
        }
        await page.waitForTimeout(100)
        const sample = {
          route,
          window: await listeners('window'),
          document: await listeners('document'),
          tocPolling: await page.evaluate(
            () =>
              [...window.__performanceIntervals.values()].filter((record) =>
                record.source.includes('headingProgress')
              ).length
          )
        }
        assert.equal(sample.tocPolling, 0)
        if (!baselines.has(route)) baselines.set(route, sample)
        else assert.deepEqual(sample, baselines.get(route))
        snapshots.push(sample)
      }
      assert.deepEqual(errors, [])
      await owner.close()
      return snapshots
    }
  )

  await check(
    'local cover cards select derivatives and friend avatars use local candidates',
    async () => {
      const owner = await context()
      const page = await owner.newPage()
      await page.goto(`${site}/traces/`, { waitUntil: 'load' })
      const image = page
        .locator('[data-content-type="trace"][data-image-source="content"] [data-card-image]')
        .first()
      await image.scrollIntoViewIfNeeded()
      await image.evaluate((element) => element.decode())
      const cover = await image.evaluate((element) => ({
        src: element.currentSrc,
        srcset: element.srcset,
        sizes: element.sizes
      }))
      assert(cover.srcset && cover.sizes)
      const response = await page.request.get(cover.src)
      assert(response.ok())
      assert((await response.body()).length < 200 * 1024, `Desktop card used ${cover.src}`)
      const remote = []
      page.on('request', (request) => {
        if (request.resourceType() === 'image' && !request.url().startsWith(site))
          remote.push(request.url())
      })
      await page.goto(`${site}/links/`, { waitUntil: 'load' })
      assert.deepEqual(remote, [])
      assert((await page.locator('img[src^="/media/friend-avatars/"]').count()) > 0)
      await owner.close()
      return cover
    }
  )

  await check('comments load at their anchor without a second view increment', async () => {
    const content = await discoverPublishedContent(site)
    const article = content.find((record) => record.kind === 'blog' && record.hasToc)
    assert(article, 'A published Blog with headings is required')
    const owner = await context()
    const page = await owner.newPage()
    const increments = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/article'))
        increments.push({ url: request.url(), body: request.postData() })
    })
    await page.goto(`${site}${article.path}/`, { waitUntil: 'load' })
    assert.equal(await page.locator('comment-component').getAttribute('data-comment-state'), 'idle')
    assert.equal(await page.locator('.wl-editor').count(), 0)
    assert.equal(await page.locator('comment-component waline-pageview').count(), 1)
    await page.waitForTimeout(1000)
    const before = increments.length
    assert.equal(before, 1, JSON.stringify(increments))
    await page.locator('a[href="#waline"]').click()
    await page.locator('.wl-editor').waitFor()
    assert.equal(increments.length, before)
    await page.locator('header-component a[href="/blog/"]').click()
    await page.waitForURL((url) => url.pathname === '/blog/')
    await page.goBack()
    await page.locator('.wl-editor').waitFor()
    assert(
      (await page.locator('link[data-astro-transition-persist="waline-client-style"]').count()) ===
        1
    )
    await owner.close()
    return { incrementsBeforeComments: before, route: article.path }
  })

  await check('comment stylesheet failure exposes a working retry', async () => {
    const owner = await context()
    const page = await owner.newPage()
    let failures = 0
    await page.route('**/_astro/waline*.css', (route) =>
      ++failures === 1 ? route.abort('failed') : route.continue()
    )
    const article = (await discoverPublishedContent(site)).find((record) => record.kind === 'blog')
    assert(article)
    await page.goto(`${site}${article.path}/#waline`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('comment-component').dataset.commentState === 'error'
    )
    await page.locator('[data-comment-load]').click()
    await page.locator('.wl-editor').waitFor()
    assert.equal(failures, 2)
    await owner.close()
    return { stylesheetAttempts: failures }
  })

  await check('page links target directory URLs and preserve fragments', async () => {
    const owner = await context({ reducedMotion: 'reduce' })
    const page = await owner.newPage()
    const invalid = []
    for (const path of [
      '/home/',
      '/blog/',
      '/traces/',
      '/sayings/',
      '/about/',
      '/links/',
      '/projects/',
      '/search/'
    ]) {
      const response = await page.goto(`${site}${path}`, { waitUntil: 'domcontentloaded' })
      assert.equal(response.request().redirectedFrom(), null)
      const links = await page
        .locator('a[href]')
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('href')))
      for (const href of links) {
        if (!href.startsWith('/') || href.startsWith('//')) continue
        const url = new URL(href, 'https://susurrium.github.io')
        if (
          /^\/(?:home|blog|traces|sayings|about|links|projects|search|archives|promise)(?:\/|$)/.test(
            url.pathname
          ) &&
          !url.pathname.endsWith('/')
        )
          invalid.push({ path, href })
      }
    }
    assert.deepEqual(invalid, [])
    await owner.close()
    return { pages: 8 }
  })
} finally {
  for (const owner of contexts) if (browser.contexts().includes(owner)) await owner.close()
  await writeFile(resolve(directory, 'results.json'), JSON.stringify(results, null, 2) + '\n')
  await browser.close()
}
console.log(
  `Performance regression: ${results.checks.length} passed, ${results.failures.length} failed.`
)
if (results.failures.length) process.exitCode = 1
