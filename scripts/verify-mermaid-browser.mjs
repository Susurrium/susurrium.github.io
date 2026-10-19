import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'node-html-parser'
import { chromium } from 'playwright'

import { discoverPublishedContent } from './lib/browser-content.mjs'

const site = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const endpoint = process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224'
const evidence = process.env.MERMAID_EVIDENCE_DIR
if (evidence) await mkdir(evidence, { recursive: true })
const paths = []
for (const entry of await discoverPublishedContent(site)) {
  const response = await fetch(site + entry.path)
  assert(response.ok, `${entry.path} returned ${response.status}`)
  const document = parse(await response.text())
  assert(
    !document.querySelector('[data-mermaid-source]'),
    `${entry.path} contains an unfinished diagram`
  )
  if (document.querySelector('[data-mermaid-diagram]')) paths.push(entry.path)
}
if (!paths.length)
  console.log('PASS Mermaid: no published diagrams; isolated build tests cover rendering')
else {
  const browser = await chromium.connectOverCDP(endpoint)
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const scripts = new Set()
    const fontErrors = []
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.add(request.url())
    })
    page.on('response', (response) => {
      if (response.url().includes('/_diagrams/') && !response.ok()) fontErrors.push(response.url())
    })
    for (const path of paths) {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(site + path)
      const diagrams = page.locator('.mermaid-diagram')
      await page.locator('.mermaid-interactive').first().waitFor()
      await page.evaluate(() => document.fonts.ready)
      const ids = await page
        .locator('.mermaid-diagram [id]')
        .evaluateAll((nodes) => nodes.map((node) => node.id))
      assert.equal(ids.length, new Set(ids).size, `${path} contains duplicate SVG IDs`)
      const colors = []
      for (const theme of ['light', 'dark']) {
        for (
          let attempt = 0;
          attempt < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
          attempt++
        )
          await page.locator('#toggleDarkMode').first().click()
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
        const svg = page.locator('.mermaid-viewport > svg')
        colors.push(await svg.first().evaluate((node) => getComputedStyle(node).fill))
        for (let index = 0; index < (await diagrams.count()); index++) {
          assert(await svg.nth(index).isVisible())
          const missing = await svg.nth(index).evaluate((node) =>
            [...node.querySelectorAll('text')]
              .filter((text) => {
                const rect = text.getBBox()
                return text.textContent?.trim() && !(rect.width > 0 && rect.height > 0)
              })
              .map((node) => node.textContent)
          )
          assert.deepEqual(missing, [], `${path} contains unmeasurable labels`)
          if (evidence)
            await diagrams.nth(index).screenshot({
              path: resolve(evidence, `${path.split('/').at(-1)}-${index}-${theme}.png`)
            })
        }
      }
      assert.notEqual(colors[0], colors[1], `${path} theme colors do not change`)
      await page.setViewportSize({ width: 390, height: 844 })
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${path} overflows viewport`
      )
      for (let index = 0; index < (await diagrams.count()); index++) {
        const diagram = diagrams.nth(index)
        const button = diagram.getByRole('button', { name: '放大图表' })
        if (await button.isVisible()) {
          const svg = diagram.locator('svg.pele')
          const before = await svg.getAttribute('viewBox')
          await button.click()
          const zoomed = await svg.getAttribute('viewBox')
          assert.notEqual(zoomed, before)
          await page.emulateMedia({ media: 'print' })
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          )
          await page.waitForFunction(
            ({ index, before }) => {
              const svg = document.querySelectorAll('.mermaid-diagram svg.pele').item(index)
              return svg?.getAttribute('viewBox') === before
            },
            { index, before }
          )
          assert.equal(await svg.getAttribute('viewBox'), before)
          assert(!(await button.isVisible()))
          await page.emulateMedia({ media: 'screen' })
          await page.waitForFunction(
            ({ index, zoomed }) => {
              const svg = document.querySelectorAll('.mermaid-diagram svg.pele').item(index)
              return svg?.getAttribute('viewBox') === zoomed
            },
            { index, zoomed }
          )
          assert.equal(await svg.getAttribute('viewBox'), zoomed)
          await diagram.getByRole('button', { name: '重置缩放' }).click()
        }
        if (evidence)
          await diagram.screenshot({
            path: resolve(evidence, `${path.split('/').at(-1)}-${index}-mobile.png`)
          })
      }
      console.log(`PASS Mermaid ${path}: inline SVG, fonts, themes, mobile zoom, print`)
    }
    assert.deepEqual(fontErrors, [], 'diagram assets failed to load')
    for (const url of scripts) {
      const source = await (await fetch(url)).text()
      assert(
        !source.includes('No diagram type detected for the given text.'),
        `Pele renderer entered client bundle: ${url}`
      )
      assert(!source.includes('chromium.launch'), `server renderer entered client bundle: ${url}`)
    }
  } finally {
    await context.close()
    await browser.close()
  }
}
