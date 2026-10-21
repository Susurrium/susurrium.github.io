import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'

const nextFrame = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  })

async function measure(page, editor = false) {
  return page.evaluate((isEditor) => {
    const hero = document.querySelector(isEditor ? '.hero-gallery--editor' : '[data-home-hero]')
    const waves = hero.querySelector('.hero-gallery__waves')
    const svg = waves.querySelector('svg')
    const cover = document.querySelector('[data-home-content-cover]')
    const rect = hero.getBoundingClientRect()
    const canvas = document.createElement('canvas')
    const painter = canvas.getContext('2d')
    painter.fillStyle = getComputedStyle(waves.querySelector('use:last-child')).fill
    painter.fillRect(0, 0, 1, 1)
    return {
      left: rect.left,
      width: rect.width,
      bottom: rect.bottom,
      height: rect.height,
      scale: rect.width / hero.offsetWidth,
      waveBottom: waves.getBoundingClientRect().bottom,
      svgBottom: svg.getBoundingClientRect().bottom,
      coverTop: cover?.getBoundingClientRect().top,
      fill: Array.from(painter.getImageData(0, 0, 1, 1).data),
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: innerHeight,
      scrollY,
      dpr: devicePixelRatio
    }
  }, editor)
}

async function inspectBoundary(page, directory, name, geometry, insideOnly = false) {
  const { left, width, bottom, fill, viewportWidth } = geometry
  assert.equal(fill[3], 255, `${name}: the last wave must provide opaque coverage`)
  const x = Math.max(0, Math.ceil(left + width * 0.05))
  const right = Math.min(viewportWidth, Math.floor(left + width * 0.95))
  const clip = {
    x,
    y: Math.floor(bottom) - (insideOnly ? 3 : 1),
    width: right - x,
    height: insideOnly ? 4 : 3
  }
  const png = await page.screenshot({ clip })
  const screenshot = `${name}.png`
  await writeFile(resolve(directory, screenshot), png)
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let unexpectedPixels = 0
  let maximumDifference = 0
  // 工作台将波浪整体缩小；只采样边界内最后一个完整屏幕像素，避开波形起伏与容器外部。
  const firstRow = insideOnly ? Math.floor((bottom - clip.y) * geometry.dpr) - 1 : 0
  const lastRow = insideOnly ? firstRow + 1 : info.height
  assert(firstRow >= 0 && lastRow <= info.height, `${name}: boundary row is outside the screenshot`)
  for (
    let index = firstRow * info.width * info.channels;
    index < lastRow * info.width * info.channels;
    index += info.channels
  ) {
    const difference = Math.max(
      Math.abs(data[index] - fill[0]),
      Math.abs(data[index + 1] - fill[1]),
      Math.abs(data[index + 2] - fill[2])
    )
    maximumDifference = Math.max(maximumDifference, difference)
    // 下方遮罩的透明度为 0.965；容许其背景透色与边缘抗锯齿，仍能识别漏出的深色或亮色图像。
    if (difference > 32) unexpectedPixels++
  }
  const evidence = { screenshot, clip, firstRow, lastRow, unexpectedPixels, maximumDifference }
  assert.equal(
    unexpectedPixels,
    0,
    `${name}: exposed background at the wave boundary: ${JSON.stringify(evidence)}`
  )
  return evidence
}

async function inspectHome(page, directory, name) {
  await nextFrame(page)
  const geometry = await measure(page)
  const overlap = geometry.waveBottom - geometry.coverTop
  assert(Math.abs(overlap - 1) < 0.04, `${name}: wave/cover overlap is ${overlap}px`)
  assert(Math.abs(geometry.coverTop - geometry.bottom) < 0.04, `${name}: cover detached from Hero`)
  assert(
    Math.abs(geometry.svgBottom - geometry.waveBottom) < 0.04,
    `${name}: SVG detached from wave box`
  )
  // 先检查滚动后的几何；像素采样等待遮罩既有的淡入过渡完成。
  if (geometry.bottom > 4 && geometry.bottom < geometry.viewportHeight - 4) {
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('[data-home-content-cover]')).opacity === '1'
    )
  }
  const pixels =
    geometry.bottom > 4 && geometry.bottom < geometry.viewportHeight - 4
      ? await inspectBoundary(page, directory, name, geometry)
      : undefined
  return { name, geometry, pixels }
}

async function openHome(page, siteUrl) {
  await page.goto(`${siteUrl}/home`, { waitUntil: 'load' })
  await page.waitForFunction(() =>
    document
      .querySelector('[data-home-content-cover]')
      ?.style.getPropertyValue('--home-content-cover-top')
  )
}

export async function verifyHomeWaves({ cdpEndpoint, siteUrl }) {
  const directory = resolve('artifacts/hero-wave-verification')
  await mkdir(directory, { recursive: true })
  const browser = await chromium.connectOverCDP(cdpEndpoint)
  const results = { home: [], editor: [], navigation: [] }
  try {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 1350, height: 805 },
      { width: 1350, height: 768 },
      { width: 390, height: 844 },
      { width: 390, height: 480 }
    ]
    for (const viewport of viewports) {
      for (const dpr of [1, 1.25, 2]) {
        for (const theme of ['light', 'dark']) {
          for (const reducedMotion of ['no-preference', 'reduce']) {
            const context = await browser.newContext({
              viewport,
              deviceScaleFactor: dpr,
              reducedMotion,
              colorScheme: theme
            })
            try {
              await context.addInitScript((value) => localStorage.setItem('theme', value), theme)
              const page = await context.newPage()
              await openHome(page, siteUrl)
              const name = `${viewport.width}x${viewport.height}-dpr${dpr}-${theme}-${reducedMotion}`
              const initial = await measure(page)
              const seamScroll = Math.max(0, initial.height - 304)
              const states = [
                ['top', 0],
                ['seam', seamScroll],
                ['deep', initial.height + 80],
                ['reverse', seamScroll]
              ]
              for (const [state, scroll] of states) {
                await page.evaluate((y) => scrollTo(0, y), scroll)
                results.home.push(await inspectHome(page, directory, `${name}-${state}`))
              }
              if (viewport.height === 805 && dpr === 1.25) {
                await page.setViewportSize({ width: 1280, height: 769 })
                results.home.push(await inspectHome(page, directory, `${name}-resize`))
              }
            } finally {
              await context.close()
            }
          }
        }
      }
    }

    for (const viewport of [viewports[1], viewports[3]]) {
      for (const theme of ['light', 'dark']) {
        for (const reducedMotion of ['no-preference', 'reduce']) {
          const context = await browser.newContext({
            viewport,
            deviceScaleFactor: 1.25,
            reducedMotion,
            colorScheme: theme
          })
          try {
            await context.addInitScript((value) => localStorage.setItem('theme', value), theme)
            const page = await context.newPage()
            await page.goto(`${siteUrl}/tools/card-crop-review#hero-crop`, { waitUntil: 'load' })
            const root = page.locator('[data-hero-crop-editor]')
            await root.waitFor({ state: 'visible' })
            for (const target of ['desktop', 'mobile']) {
              await root.locator(`button[data-hero-viewport="${target}"]`).click()
              for (const motion of ['static', 'preview', 'runtime']) {
                await root.locator(`button[data-hero-motion="${motion}"]`).click()
                await root.locator('[data-hero-editor-stage]').scrollIntoViewIfNeeded()
                await nextFrame(page)
                const geometry = await measure(page, true)
                const name = `editor-${viewport.width}-${theme}-${reducedMotion}-${target}-${motion}`
                const overlap = (geometry.waveBottom - geometry.bottom) / geometry.scale
                assert(
                  Math.abs(overlap - 1) < 0.06,
                  `${name}: scaled bottom overlap is ${overlap}px`
                )
                const pixels = await inspectBoundary(page, directory, name, geometry, true)
                results.editor.push({ name, geometry, pixels })
              }
            }
          } finally {
            await context.close()
          }
        }
      }
    }

    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: viewports[1],
        deviceScaleFactor: 1.25,
        colorScheme: theme
      })
      try {
        await context.addInitScript((value) => localStorage.setItem('theme', value), theme)
        const page = await context.newPage()
        await openHome(page, siteUrl)
        await page.evaluate(() => {
          window.__heroWaveNavigationProbe = true
        })
        await page.locator('a[href="/about"]').first().click()
        await page.waitForURL(/\/about\/?$/)
        await page.locator('a[href="/home"]').first().click()
        await page.waitForFunction(() =>
          document
            .querySelector('[data-home-content-cover]')
            ?.style.getPropertyValue('--home-content-cover-top')
        )
        assert(
          await page.evaluate(() => window.__heroWaveNavigationProbe),
          'Navigation must retain the ClientRouter document'
        )
        await page.evaluate(() => scrollTo(0, 259))
        results.navigation.push(await inspectHome(page, directory, `navigation-${theme}`))
      } finally {
        await context.close()
      }
    }
    console.log(
      `PASS Home wave coverage: ${results.home.length} Home states, ${results.editor.length} scaled editor states, ${results.navigation.length} ClientRouter returns`
    )
  } catch (error) {
    results.failure = error.stack
    throw error
  } finally {
    await writeFile(resolve(directory, 'results.json'), JSON.stringify(results, null, 2))
    await browser.close()
  }
}
