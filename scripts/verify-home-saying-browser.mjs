import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { parse } from 'node-html-parser'
import { chromium } from 'playwright'

const site = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const endpoint = process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224'
const manifest = JSON.parse(
  await readFile(new URL('../src/data/card-images.json', import.meta.url), 'utf8')
)
const response = await fetch(`${site}/home`)
assert(response.ok, `Home returned ${response.status}`)
const source = await response.text()
const document = parse(source)
const catalogElement = document.querySelector('[data-random-saying-catalog]')
const catalog = catalogElement ? JSON.parse(catalogElement.textContent) : []
const evidence = []
const key = 'susurrium-saying-regression-random'
const browser = await chromium.connectOverCDP(endpoint)
const sayingUrls = new Set(
  catalog.flatMap(({ image }) => [
    image.src,
    ...(manifest[image.src]?.candidates.map(({ src }) => src) ?? [])
  ])
)

async function setup(width = 1440, dpr = 1, defaultRandom = 0.999999, javaScriptEnabled = true) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: dpr,
    javaScriptEnabled
  })
  await context.addInitScript(
    ({ key, defaultRandom }) => {
      window.__sayingSelections = 0
      window.__sayingFrames = []
      window.__susurriumRandom = () => {
        window.__sayingSelections++
        return Number(sessionStorage.getItem(key) ?? defaultRandom)
      }
      const sample = () => {
        const root = document.querySelector('saying-random-card')
        const card = root?.querySelector('[data-media-card]')
        if (card) {
          const id = card.dataset.contentId
          if (window.__sayingFrames.at(-1)?.id !== id)
            window.__sayingFrames.push({ id, time: performance.now() })
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    },
    { key, defaultRandom }
  )
  const page = await context.newPage()
  const requests = []
  const exceptions = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (sayingUrls.has(path)) requests.push(path)
  })
  page.on('pageerror', (error) => exceptions.push(error.message))
  return { context, page, requests, exceptions }
}

async function verify(page, selected, label, responsive = true) {
  const root = page.locator('saying-random-card')
  const image = root.locator('[data-card-image]')
  const options = responsive ? manifest[selected.image.src] : undefined
  const allowed = (options?.candidates.map(({ src }) => src) ?? [selected.image.src]).map(
    (src) => new URL(src, site).href
  )
  await image.scrollIntoViewIfNeeded()
  await page.waitForFunction(
    ({ allowed, id }) => {
      const root = document.querySelector('saying-random-card')
      const image = root?.querySelector('[data-card-image]')
      return (
        root?.dataset.sayingId === id &&
        image?.complete &&
        image.naturalWidth > 0 &&
        allowed.includes(image.currentSrc) &&
        root.querySelector('[data-card-media-frame]')?.dataset.previewState === 'ready'
      )
    },
    { allowed, id: selected.id },
    { timeout: 10000 }
  )
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  )
  assert.equal(await image.getAttribute('src'), selected.image.src, `${label}: src`)
  assert.equal(
    await image.getAttribute('fetchpriority'),
    'low',
    `${label}: complete image preserves Hero priority`
  )
  assert.equal(
    await page.locator('[data-home-saying-preload]').getAttribute('fetchpriority'),
    'low',
    `${label}: preload priority matches the image`
  )
  assert.equal(
    await image.getAttribute('srcset'),
    responsive ? (selected.image.srcset ?? null) : null,
    `${label}: srcset`
  )
  assert.equal(
    await image.getAttribute('sizes'),
    responsive ? (selected.image.sizes ?? null) : null,
    `${label}: sizes`
  )
  assert(
    await root.locator('[data-card-preview]').isHidden(),
    `${label}: preview removed after decoding`
  )
  const timeline = await page.evaluate(() => ({
    frames: window.__sayingFrames,
    selections: window.__sayingSelections,
    selected: performance.getEntriesByName('home-saying-selected')[0]?.startTime,
    mounted: performance.getEntriesByName('home-saying-mounted')[0]?.startTime,
    ready: performance.getEntriesByName('home-saying-image-ready').at(-1)?.startTime
  }))
  assert(
    timeline.frames.length > 0 && timeline.frames.every(({ id }) => id === selected.id),
    `${label}: identity correct from first rendered frame`
  )
  assert.equal(timeline.selections, 1, `${label}: one selection per visit`)
  evidence.push({ label, id: selected.id, ...timeline })
  console.log(`PASS ${label}: ${selected.id}, first frame correct, one selection`)
}

function verifyRequests(requests, selected, label) {
  const allowed = new Set([
    selected.image.src,
    ...(manifest[selected.image.src]?.candidates.map(({ src }) => src) ?? [])
  ])
  assert(
    requests.every((path) => allowed.has(path)),
    `${label}: unexpected Saying image requests: ${requests.join(', ')}`
  )
  assert.equal(
    requests.length,
    new Set(requests).size,
    `${label}: preload and image share the request`
  )
}

function fixture(entries, responsive = true) {
  const html = parse(source)
  const data = html.querySelector('[data-random-saying-catalog]')
  data.set_content(JSON.stringify(entries).replace(/</g, '\\u003c'))
  for (const template of html.querySelectorAll('template[data-saying-template]')) {
    if (!entries.some(({ id }) => id === template.getAttribute('data-saying-template')))
      template.remove()
    else if (!responsive) {
      const image = template.querySelector('[data-card-image]')
      image.removeAttribute('srcset')
      image.removeAttribute('sizes')
    }
  }
  if (!entries.length) html.querySelector('[data-home-random-saying]').remove()
  return html.toString()
}

try {
  if (!catalog.length) {
    assert(!document.querySelector('[data-home-random-saying]'))
    console.log('PASS Home Saying: no published candidates; area omitted')
  } else {
    assert(document.querySelectorAll('template[data-saying-template]').length === catalog.length)
    assert(
      !document.querySelector('saying-random-card [data-card-image]'),
      'Static display slot starts without a fallback image'
    )
    assert(
      source.indexOf('charset="utf-8"') >= 0 && source.indexOf('charset="utf-8"') < 1024,
      'Encoding declaration remains at the beginning of HTML'
    )
    assert(
      source.indexOf('name="viewport"') < source.indexOf('data-home-saying-runtime'),
      'Viewport is declared before responsive preloading'
    )
    assert(
      source.indexOf('fetchpriority="high"') < source.indexOf('data-home-saying-runtime'),
      'Hero preload is discovered before Saying initialization'
    )
    const selected = catalog.at(-1)

    // 保持外部模块和所选图片未完成，验证初始化和预览不依赖其完成。
    {
      const test = await setup()
      let releaseScripts
      let releaseImage
      const scripts = new Promise((resolve) => {
        releaseScripts = resolve
      })
      const image = new Promise((resolve) => {
        releaseImage = resolve
      })
      await test.context.route('**/_astro/*.js', async (route) => {
        await scripts
        await route.continue()
      })
      const selectedUrls = new Set(manifest[selected.image.src].candidates.map(({ src }) => src))
      await test.context.route('**/images/card-media/*', async (route) => {
        if (selectedUrls.has(new URL(route.request().url()).pathname)) await image
        await route.continue()
      })
      try {
        await test.page.goto(`${site}/home`, { waitUntil: 'commit' })
        await test.page.waitForSelector(
          `saying-random-card[data-saying-id="${selected.id}"] [data-card-preview]`
        )
        assert(
          await test.page.locator('saying-random-card [data-card-title]').isVisible(),
          'Text is readable while external modules and full image are pending'
        )
        assert.equal(
          await test.page
            .locator('saying-random-card [data-card-media-frame]')
            .getAttribute('data-preview-state'),
          'loading'
        )
        const before = await test.page
          .locator('saying-random-card [data-card-media-frame]')
          .boundingBox()
        const transforms = await test.page.locator('saying-random-card').evaluate((root) => {
          const properties = ['objectFit', 'objectPosition', 'transform', 'transformOrigin']
          const image = getComputedStyle(root.querySelector('[data-card-image]'))
          const preview = getComputedStyle(root.querySelector('[data-card-preview]'))
          return properties.map((property) => [image[property], preview[property]])
        })
        assert(
          transforms.every(([image, preview]) => image === preview),
          'Preview and full image share the same crop transform'
        )
        releaseScripts()
        await test.page.waitForLoadState('domcontentloaded')
        await test.page.evaluate(() => document.fonts.ready)
        releaseImage()
        await verify(test.page, selected, 'Blocked external modules and delayed full image')
        const after = await test.page
          .locator('saying-random-card [data-card-media-frame]')
          .boundingBox()
        assert.equal(before.width, after.width, 'Image load preserves frame width')
        assert.equal(before.height, after.height, 'Image load preserves frame height')
        verifyRequests(test.requests, selected, 'Blocked modules')
        assert.deepEqual(test.exceptions, [])
      } finally {
        releaseScripts()
        releaseImage()
        await test.context.close()
      }
    }

    for (const [width, dpr] of [
      [1440, 1],
      [1440, 2],
      [390, 1],
      [390, 2]
    ]) {
      const test = await setup(width, dpr)
      try {
        await test.page.goto(`${site}/home`, { waitUntil: 'domcontentloaded' })
        await verify(test.page, selected, `${width}px DPR${dpr} cold visit`)
        verifyRequests(test.requests, selected, 'Cold visit')
        assert.equal(
          test.requests.length,
          1,
          'Cold visit requests exactly one selected image candidate'
        )
        for (const [index, entry] of catalog.entries()) {
          await test.page.evaluate(({ key, value }) => sessionStorage.setItem(key, String(value)), {
            key,
            value: (index + 0.5) / catalog.length
          })
          test.requests.length = 0
          await test.page.reload({ waitUntil: 'domcontentloaded' })
          await verify(test.page, entry, `${width}px DPR${dpr} refresh`)
          verifyRequests(test.requests, entry, 'Refresh')
        }
        assert.deepEqual(test.exceptions, [])
      } finally {
        await test.context.close()
      }
    }

    {
      const test = await setup(390, 2)
      const cdp = await test.context.newCDPSession(test.page)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 100,
        downloadThroughput: 200000,
        uploadThroughput: 100000
      })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      try {
        await test.page.goto(`${site}/home`, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await verify(test.page, selected, 'Slow network and 4x CPU slowdown')
        verifyRequests(test.requests, selected, 'Slow network')
        assert.deepEqual(test.exceptions, [])
      } finally {
        await test.context.close()
      }
    }

    {
      const test = await setup()
      try {
        await test.page.goto(`${site}/blog`, { waitUntil: 'domcontentloaded' })
        await test.page.evaluate(() => {
          window.__sayingDocumentMarker = true
        })
        for (let visit = 0; visit < 3; visit++) {
          const expected = catalog[visit % catalog.length]
          await test.page.evaluate(({ key, value }) => sessionStorage.setItem(key, String(value)), {
            key,
            value: ((visit % catalog.length) + 0.5) / catalog.length
          })
          await test.page.locator('[role="banner"] a[href="/home"]').first().click()
          await test.page.waitForURL(/\/home\/?$/)
          await test.page.waitForFunction(
            () => document.querySelector('saying-random-card [data-card-image]')?.complete
          )
          assert.equal(
            await test.page.locator('saying-random-card').getAttribute('data-saying-id'),
            expected.id
          )
          assert.equal(await test.page.evaluate(() => window.__sayingSelections), visit + 1)
          assert(
            await test.page.evaluate(() => window.__sayingDocumentMarker),
            'ClientRouter preserves document identity'
          )
          await test.page.locator('[role="banner"] a[href="/blog"]').first().click()
          await test.page.waitForURL(/\/blog\/?$/)
        }
        await test.page.evaluate(() => history.back())
        await test.page.waitForURL(/\/home\/?$/)
        await test.page.waitForFunction(
          () => document.querySelector('saying-random-card [data-card-image]')?.complete
        )
        assert.equal(
          await test.page.evaluate(() => window.__sayingSelections),
          4,
          'History navigation selects once'
        )
        await test.page.evaluate(() => history.forward())
        await test.page.waitForURL(/\/blog\/?$/)
        assert.equal(
          await test.page.evaluate(() => window.__sayingSelections),
          4,
          'Leaving Home does not select'
        )
        assert.deepEqual(test.exceptions, [])
        console.log(
          'PASS repeated client navigation from a non-Home entry: one selection per visit'
        )
      } finally {
        await test.context.close()
      }
    }

    for (const [label, entries, responsive] of [
      ['single candidate', [selected], true],
      [
        'no responsive candidates',
        [{ ...selected, image: { src: selected.image.src, source: selected.image.source } }],
        false
      ],
      ['empty candidates', [], true]
    ]) {
      const test = await setup()
      try {
        await test.context.route(`${site}/home`, (route) =>
          route.fulfill({ contentType: 'text/html', body: fixture(entries, responsive) })
        )
        await test.page.goto(`${site}/home`, { waitUntil: 'domcontentloaded' })
        if (entries.length) await verify(test.page, entries[0], label, responsive)
        else assert.equal(await test.page.locator('[data-home-random-saying]').count(), 0)
        assert.deepEqual(test.exceptions, [])
        console.log(`PASS fixture: ${label}`)
      } finally {
        await test.context.close()
      }
    }

    {
      const test = await setup()
      let failed = false
      const urls = new Set(manifest[selected.image.src].candidates.map(({ src }) => src))
      await test.context.route('**/images/card-media/*', async (route) => {
        if (!failed && urls.has(new URL(route.request().url()).pathname)) {
          failed = true
          await route.abort('failed')
        } else await route.continue()
      })
      try {
        await test.page.goto(`${site}/home`, { waitUntil: 'domcontentloaded' })
        const retry = test.page.locator('[data-saying-image-retry]')
        await retry.waitFor({ state: 'visible' })
        assert(await test.page.locator('saying-random-card [data-card-preview]').isVisible())
        await retry.click()
        await verify(test.page, selected, 'Failed image and retry preserve the same Saying')
        assert.deepEqual(test.exceptions, [])
      } finally {
        await test.context.close()
      }
    }

    {
      const test = await setup(390, 1, 0, false)
      try {
        await test.page.goto(`${site}/home`)
        assert.equal(
          await test.page.locator('[data-home-random-saying] [data-media-card]').count(),
          1
        )
        assert.equal(
          await test.page
            .locator('[data-home-random-saying] [data-media-card]')
            .getAttribute('data-content-id'),
          catalog[0].id
        )
        assert(await test.page.locator('[data-home-random-saying] [data-card-title]').isVisible())
        console.log('PASS JavaScript disabled: fixed readable card and navigation')
      } finally {
        await test.context.close()
      }
    }
  }
  const directory = resolve(process.env.SAYING_EVIDENCE_DIR ?? 'artifacts/saying-verification')
  await mkdir(directory, { recursive: true })
  await writeFile(
    resolve(directory, 'results.json'),
    JSON.stringify(
      { htmlBytes: Buffer.byteLength(source), htmlGzipBytes: gzipSync(source).length, evidence },
      null,
      2
    )
  )
  console.log('Home Saying browser regression complete: 0 failures')
} finally {
  await browser.close()
}
