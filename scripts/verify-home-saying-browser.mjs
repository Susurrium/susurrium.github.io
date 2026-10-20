import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const site = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const endpoint = process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224'
const manifest = JSON.parse(
  await readFile(new URL('../src/data/card-images.json', import.meta.url))
)
const browser = await chromium.connectOverCDP(endpoint)
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const storageKey = 'susurrium-saying-regression-random'
const rootSelector = '[data-home-random-saying]'

try {
  await context.addInitScript((key) => {
    window.__susurriumRandom = () => Number(sessionStorage.getItem(key) ?? '0')
  }, storageKey)
  const page = await context.newPage()
  const response = await page.goto(`${site}/home`)
  assert(response?.ok(), `Home returned ${response?.status()}`)
  const root = page.locator(rootSelector)
  if (!(await root.count())) {
    console.log('PASS Home Saying: no published candidates; image checks skipped')
  } else {
    const catalog = JSON.parse(await root.locator('[data-random-saying-catalog]').textContent())
    assert(catalog.length > 0, 'Home Saying catalog must contain its rendered fallback')

    async function verifyImage(selected, label) {
      const candidate = manifest[selected.image.src]
      const zoom = selected.image.crop?.transform.zoom ?? 1
      const expectedSizes = candidate
        ? `(max-width: 767px) calc(100vw * ${zoom}), ${Math.ceil(640 * zoom)}px`
        : null
      const urls = (candidate?.candidates.map(({ src }) => src) ?? [selected.image.src]).map(
        (src) => new URL(src, site).href
      )
      const image = root.locator('[data-card-image]')
      await image.scrollIntoViewIfNeeded()
      await page.waitForFunction(
        ({ rootSelector, id, urls }) => {
          const root = document.querySelector(rootSelector)
          const image = root?.querySelector('[data-card-image]')
          return (
            root?.querySelector('[data-media-card]')?.dataset.contentId === id &&
            image?.complete &&
            image.naturalWidth > 0 &&
            urls.includes(image.currentSrc)
          )
        },
        { rootSelector, id: selected.id, urls },
        { timeout: 10000 }
      )
      assert.equal(await image.getAttribute('src'), selected.image.src, `${label}: src`)
      assert.equal(
        await image.getAttribute('srcset'),
        candidate?.srcset ?? null,
        `${label}: srcset`
      )
      assert.equal(await image.getAttribute('sizes'), expectedSizes, `${label}: sizes`)
      assert.equal(await root.locator('[data-card-title]').textContent(), `“${selected.text}”`)
      console.log(
        `PASS ${label}: ${selected.id}, currentSrc=${await image.evaluate((image) => image.currentSrc)}`
      )
    }

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      for (const [index, selected] of catalog.entries()) {
        await page.evaluate(({ key, value }) => sessionStorage.setItem(key, String(value)), {
          key: storageKey,
          value: (index + 0.5) / catalog.length
        })
        await page.reload()
        await verifyImage(selected, `${width}px refresh`)
      }

      const viewAll = root.locator('a[href="/sayings"]')
      if (await viewAll.count()) {
        await page.evaluate((key) => {
          sessionStorage.setItem(key, '0')
          window.__sayingRegressionDocument = true
        }, storageKey)
        await viewAll.click()
        await page.waitForURL(/\/sayings\/?$/)
        await page.locator('[role="banner"] a[href="/home"]').first().click()
        await page.waitForURL(/\/home\/?$/)
        await verifyImage(catalog[0], `${width}px client navigation back to Home`)
        assert(
          await page.evaluate(() => window.__sayingRegressionDocument),
          'Home uses client navigation'
        )
      }
    }

    // 用真实无候选图片验证旧 srcset/sizes 的清理，复用实际客户端选择逻辑。
    const withoutCandidates = {
      ...catalog[0],
      image: { ...catalog[0].image, src: '/images/social-card.webp' }
    }
    assert(!manifest[withoutCandidates.image.src], 'Fixture must have no responsive candidates')
    delete withoutCandidates.image.srcset
    delete withoutCandidates.image.sizes
    await page.evaluate((selected) => {
      const original = document.querySelector('saying-random-card')
      const replacement = original.cloneNode(true)
      replacement.querySelector('[data-random-saying-catalog]').textContent = JSON.stringify([
        selected
      ])
      original.replaceWith(replacement)
    }, withoutCandidates)
    await verifyImage(withoutCandidates, 'No responsive candidates')
    console.log('Home Saying browser regression complete: 0 failures')
  }
} finally {
  await context.close()
  await browser.close()
}
