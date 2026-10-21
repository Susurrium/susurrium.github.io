import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse as parseCss } from 'css-tree'
import { parse } from 'node-html-parser'
import { chromium } from 'playwright'

import { discoverPublishedContent } from './lib/browser-content.mjs'

const site = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const browser = await chromium.connectOverCDP(process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224')
const evidence = resolve('artifacts/pure-verification')
await mkdir(evidence, { recursive: true })
const checks = []
const requests = []
const errors = []
const contexts = []
let failure

try {
  let selected
  for (const entry of await discoverPublishedContent(site)) {
    const response = await fetch(`${site}${entry.path}/`)
    assert(response.ok(), `Published detail ${entry.path} returned ${response.status}`)
    const source = await response.text()
    if (parse(source).querySelector('code-block')) {
      selected = { ...entry, source }
      break
    }
  }
  if (!selected) {
    console.log(
      'PASS no published long-code article; isolated compiler tests cover annotations and folding'
    )
  } else {
    const document = parse(selected.source)
    const server = document.querySelector('waline-page-info')?.getAttribute('data-server')
    const productionOrigin = document
      .querySelector('waline-page-info')
      ?.getAttribute('data-production-origin')
    const preload = document.querySelectorAll('link[rel="preload"][as="font"]')
    assert.equal(preload.length, 1, 'only the normal body font is preloaded')
    assert(!document.querySelector('code-block.collapsed'), 'server HTML remains fully readable')

    async function contextFor(origin, javaScriptEnabled = true) {
      const context = await browser.newContext({
        javaScriptEnabled,
        viewport: { width: 1280, height: 900 }
      })
      contexts.push(context)
      await context.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (server && url.origin === new URL(server).origin) {
          requests.push({
            origin,
            method: request.method(),
            url: request.url(),
            body: request.postData()
          })
          const data = url.pathname.endsWith('/article')
            ? [{ time: 42, reaction0: 0 }]
            : url.searchParams.get('type') === 'count'
              ? [3]
              : { page: 1, pageSize: 10, count: 0, totalPages: 0, data: [] }
          await route.fulfill({
            json: { errno: 0, errmsg: '', data },
            headers: {
              'access-control-allow-origin': '*',
              'access-control-allow-headers': 'content-type',
              'access-control-allow-methods': 'GET, POST, OPTIONS'
            }
          })
        } else if (url.origin === origin) {
          const response = await fetch(site + url.pathname + url.search)
          const headers = Object.fromEntries(response.headers)
          delete headers['content-encoding']
          delete headers['content-length']
          await route.fulfill({
            status: response.status,
            headers,
            body: Buffer.from(await response.arrayBuffer())
          })
        } else if (request.url().includes('@waline/emojis')) {
          await route.fulfill({
            json: { name: 'Fixture', type: 'image', icon: '', prefix: '', items: [] },
            headers: { 'access-control-allow-origin': '*' }
          })
        } else {
          await route.abort()
        }
      })
      return context
    }

    // 使用真实前端模块，统计服务通过隔离响应验证，不写生产数据。
    const context = await contextFor(new URL(site).origin)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    const fonts = []
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fonts.push(request.url())
    })
    await page.goto(`${site}${selected.path}/`)
    await page.locator('code-block.collapsed').first().waitFor()
    if (server) {
      await page.waitForFunction(
        () => document.querySelector('.waline-pageview-count')?.textContent === '42'
      )
      assert.equal(
        await page.locator('#waline textarea').count(),
        0,
        'comment form waits for the viewport'
      )
      assert.equal(await page.locator('.waline-comment-count').first().textContent(), '3')
      checks.push('counts load independently before comment initialization')
    }
    await page.evaluate(() => document.fonts.ready)
    const fontState = await page.evaluate(() => ({
      family: getComputedStyle(document.documentElement).fontFamily,
      variables: ['--font-satoshi', '--font-paralines'].map((name) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      ),
      loaded: [...document.fonts]
        .filter((font) => font.status === 'loaded')
        .map((font) => ({ family: font.family, style: font.style, weight: font.weight }))
    }))
    assert(fontState.family.includes('Satoshi'))
    for (const value of fontState.variables) {
      assert.equal(
        parseCss(value, { context: 'value' }).children.size,
        1,
        'font variables retain the existing explicit fallback order'
      )
    }
    assert(
      fontState.loaded.some((font) => font.family.includes('Satoshi') && font.style === 'normal')
    )
    const fontContext = await contextFor(new URL(site).origin)
    const fontPage = await fontContext.newPage()
    const fontRequests = []
    fontPage.on('request', (request) => {
      if (request.resourceType() === 'font') fontRequests.push(request.url())
    })
    await fontPage.goto(site + '/404.html')
    await fontPage.evaluate(() => document.fonts.ready)
    assert.equal(
      await fontPage.evaluate(
        () =>
          [...document.fonts].find(
            (font) => font.family.includes('Satoshi') && font.style === 'italic'
          )?.status
      ),
      'unloaded'
    )
    const fontCount = new Set(fontRequests).size
    await fontPage.evaluate(() => {
      const sample = document.createElement('p')
      sample.style.fontStyle = 'italic'
      sample.textContent = 'Satoshi italic verification'
      document.body.append(sample)
    })
    await fontPage.waitForFunction(() =>
      [...document.fonts].some(
        (font) =>
          font.family.includes('Satoshi') && font.style === 'italic' && font.status === 'loaded'
      )
    )
    assert(new Set(fontRequests).size > fontCount, 'italic is fetched on actual use')
    assert(
      [...fonts, ...fontRequests].every((url) => new URL(url).origin === new URL(site).origin),
      'fonts stay same-origin'
    )
    assert.equal(
      fontRequests.length,
      new Set(fontRequests).size,
      'font preload and stylesheet reuse one request'
    )
    checks.push('normal/italic local fonts load with one normal preload')

    const block = page.locator('code-block').first()
    const toggle = block.locator('[data-code-collapse]')
    await toggle.focus()
    await page.keyboard.press('Space')
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
    await page.keyboard.press('Enter')
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    const copy = block.locator('[data-copy-code]')
    const source = await copy.getAttribute('data-code')
    await block.hover()
    await copy.click()
    // Windows 原生剪贴板会把换行转换为 CRLF；完整内容仍须逐字符一致。
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    assert.equal(clipboard.replaceAll('\r\n', '\n'), source.replaceAll('\r\n', '\n'))
    await page.emulateMedia({ media: 'print' })
    assert.equal(
      await block.locator('pre').evaluate((element) => getComputedStyle(element).maxHeight),
      'none'
    )
    assert.equal(await toggle.isVisible(), false)
    await page.emulateMedia({ media: 'screen' })
    checks.push('keyboard folding, complete clipboard copy and complete print output')

    if (server) {
      await page.locator('#waline').scrollIntoViewIfNeeded()
      await page.locator('#waline textarea').waitFor()
      const rssLink = page.locator('#waline .wl-rss > a').first()
      await rssLink.waitFor()
      assert.equal(await rssLink.evaluate((element) => getComputedStyle(element).display), 'flex')
      await page.evaluate(() => {
        const meta = document.createElement('div')
        meta.className = 'wl-meta'
        meta.dataset.metaProbe = ''
        meta.textContent = 'Metadata layout probe'
        document.querySelector('#waline').append(meta)
      })
      assert.notEqual(
        await page
          .locator('[data-meta-probe]')
          .evaluate((element) => getComputedStyle(element).display),
        'none'
      )
      await page.locator('#waline').evaluate((element) => element.classList.add('hide-meta'))
      assert.equal(
        await page
          .locator('[data-meta-probe]')
          .evaluate((element) => getComputedStyle(element).display),
        'none'
      )
      assert.equal(
        requests.filter(
          (request) => request.origin === new URL(site).origin && request.method === 'POST'
        ).length,
        0
      )
      checks.push(
        'real Waline initialization, feed flex layout, metadata visibility and no preview writes'
      )
    }

    await page.setViewportSize({ width: 812, height: 375 })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 44, bottom: 34, left: 20, right: 24 }
    })
    await page.evaluate(() => window.scrollTo(0, 0))
    const safe = await page.locator('.site-page-shell').evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        top: style.paddingTop,
        bottom: style.paddingBottom,
        left: style.paddingLeft,
        right: style.paddingRight
      }
    })
    assert.deepEqual(safe, { top: '44px', bottom: '34px', left: '48px', right: '52px' })
    await page.goto(site + '/home/')
    const homeSafe = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON()
      return {
        viewport: document.documentElement.clientWidth,
        hero: rect('[data-home-hero]'),
        media: rect('[data-home-hero-media]'),
        header: rect('header-component'),
        music: rect('#nav-music')
      }
    })
    assert.equal(homeSafe.hero.top, 0, 'Home hero starts at the viewport edge')
    assert.equal(homeSafe.media.top, 0)
    assert(homeSafe.media.width >= homeSafe.viewport)
    assert(homeSafe.header.left >= 20 && homeSafe.header.right <= homeSafe.viewport - 24)
    assert(homeSafe.header.top >= 44)
    assert(homeSafe.music.bottom <= 375 - 34)
    await page.goto(site + '/')
    const entranceSafe = await page.evaluate(() => ({
      scene: document.querySelector('[data-entrance-scene]').getBoundingClientRect().toJSON(),
      content: document.querySelector('.entrance-scene__content').getBoundingClientRect().toJSON()
    }))
    assert.equal(entranceSafe.scene.top, 0)
    assert(
      entranceSafe.content.left >= 20 && entranceSafe.content.right <= entranceSafe.scene.right - 24
    )
    assert(
      entranceSafe.content.top >= 44 &&
        entranceSafe.content.bottom <= entranceSafe.scene.bottom - 34 + 1
    )
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 0, bottom: 0, left: 0, right: 0 }
    })
    checks.push(
      'native landscape safe areas protect article, Home navigation, entrance and player while backgrounds cover the viewport'
    )

    if (server && productionOrigin) {
      const productionContext = await contextFor(productionOrigin)
      const productionPage = await productionContext.newPage()
      productionPage.on('pageerror', (error) => errors.push(error.message))
      await productionPage.goto(`${productionOrigin}${selected.path}/`)
      await productionPage.waitForFunction(
        () => document.querySelector('.waline-pageview-count')?.textContent === '42'
      )
      await productionPage.locator('#waline').scrollIntoViewIfNeeded()
      await productionPage.locator('#waline textarea').waitFor()
      const increments = requests.filter(
        (request) => request.origin === productionOrigin && request.method === 'POST'
      )
      assert.equal(
        increments.length,
        1,
        'one increment per visit, including after comment initialization'
      )
      assert.equal(JSON.parse(increments[0].body).type, 'time')
      checks.push('production-origin visit increments once against an isolated counter endpoint')
    }

    const noJs = await contextFor(new URL(site).origin, false)
    const noJsPage = await noJs.newPage()
    await noJsPage.goto(`${site}${selected.path}/`)
    assert.equal(await noJsPage.locator('code-block.collapsed').count(), 0)
    assert.equal(await noJsPage.locator('[data-code-collapse]').first().isVisible(), false)
    assert.equal(
      await noJsPage
        .locator('code-block pre')
        .first()
        .evaluate((element) => getComputedStyle(element).maxHeight),
      'none'
    )
    checks.push('complete code remains available without JavaScript')
    assert.deepEqual(errors, [])
  }
} catch (error) {
  failure = error
} finally {
  const result = JSON.stringify({ checks, requests, errors, failure: failure?.stack }, null, 2)
  await writeFile(resolve(evidence, `results-${Date.now()}.json`), result)
  await writeFile(resolve(evidence, 'results.json'), result)
  await Promise.all(contexts.map((context) => context.close()))
  await browser.close()
}
checks.forEach((check) => console.log(`PASS ${check}`))
if (failure) throw failure
