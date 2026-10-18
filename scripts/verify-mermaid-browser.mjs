import assert from 'node:assert/strict'
import { parse } from 'node-html-parser'
import { chromium } from 'playwright'

import { discoverPublishedContent } from './lib/browser-content.mjs'

const site = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const endpoint = process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224'
const entries = await discoverPublishedContent(site)
const paths = []
for (const entry of entries) {
  const response = await fetch(site + entry.path)
  assert(response.ok, `${entry.path} returned ${response.status}`)
  const document = parse(await response.text())
  assert(
    !document.querySelector('[data-mermaid-source]'),
    `${entry.path} contains an unfinished diagram`
  )
  if (document.querySelector('[data-mermaid-diagram]')) paths.push(entry.path)
}
if (!paths.length) {
  console.log('PASS Mermaid: no published diagrams; isolated build tests cover rendering')
} else {
  const browser = await chromium.connectOverCDP(endpoint)
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const scripts = []
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url())
    })
    for (const path of paths) {
      await page.goto(site + path)
      await page.waitForFunction(() =>
        [...document.querySelectorAll('.mermaid-diagram img')].every(
          (image) =>
            !image.getBoundingClientRect().width || (image.complete && image.naturalWidth > 0)
        )
      )
      for (const theme of ['light', 'dark']) {
        for (
          let attempt = 0;
          attempt < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
          attempt++
        )
          await page.locator('#toggleDarkMode').first().click()
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
        for (const image of await page.locator(`.mermaid-${theme}`).all())
          assert(await image.isVisible())
      }
      await page.setViewportSize({ width: 390, height: 844 })
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${path} overflows viewport`
      )
      await page.emulateMedia({ media: 'print' })
      for (const image of await page.locator('.mermaid-light').all())
        assert(await image.isVisible())
      for (const image of await page.locator('.mermaid-dark').all())
        assert(!(await image.isVisible()))
      await page.emulateMedia({ media: 'screen' })
      console.log(`PASS Mermaid ${path}: assets, themes, mobile, print`)
    }
    assert(
      !scripts.some((url) => /(?:mermaid|playwright).*\.m?js/.test(url)),
      'Mermaid runtime was requested'
    )
  } finally {
    await context.close()
    await browser.close()
  }
}
