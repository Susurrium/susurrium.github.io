import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const current = process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321'
const baseline = process.env.PERFORMANCE_BASE_URL
const samples = Number(process.env.PERFORMANCE_SAMPLES ?? 5)
if (!Number.isInteger(samples) || samples < 1 || samples > 20)
  throw new Error('PERFORMANCE_SAMPLES must be an integer from 1 to 20')
const output = resolve('artifacts/performance-comparison')
await mkdir(output, { recursive: true })
const browser = await chromium.connectOverCDP(process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224')
const result = {
  browser: browser.version(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
  conditions: {
    seed: 0.25,
    desktop: { width: 1440, height: 900, dpr: 1, observationMs: 8000 },
    mobile: {
      width: 390,
      height: 844,
      dpr: 2,
      cpu: 4,
      latency: 150,
      downstream: 1600000,
      observationMs: 15000
    }
  },
  samples: [],
  summary: []
}
const scenarios = [
  { path: '/home/', mobile: false },
  { path: '/home/', mobile: true },
  { path: '/blog/campus-network-coexistence/', mobile: false },
  { path: '/links/', mobile: false }
]
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
try {
  for (const scenario of scenarios)
    for (let repetition = 0; repetition < samples; repetition++) {
      for (const [label, site] of [
        ...(baseline ? [['before', baseline]] : []),
        ['after', current]
      ]) {
        const owner = await browser.newContext({
          viewport: scenario.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
          deviceScaleFactor: scenario.mobile ? 2 : 1,
          isMobile: scenario.mobile,
          hasTouch: scenario.mobile
        })
        try {
          await owner.addInitScript(() => {
            window.__susurriumRandom = () => 0.25
            const measurement = { lcp: [], shifts: [], tasks: [] }
            Reflect.set(window, '__performanceMeasurement', measurement)
            for (const [type, key] of [
              ['largest-contentful-paint', 'lcp'],
              ['layout-shift', 'shifts'],
              ['longtask', 'tasks']
            ])
              new PerformanceObserver((list) =>
                measurement[key].push(...list.getEntries().map((entry) => entry.toJSON()))
              ).observe({ type, buffered: true })
          })
          const page = await owner.newPage()
          const errors = []
          page.on('pageerror', (error) => errors.push(error.message))
          const cdp = await owner.newCDPSession(page)
          await cdp.send('Network.enable')
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
          if (scenario.mobile) {
            await cdp.send('Network.emulateNetworkConditions', {
              offline: false,
              latency: 150,
              downloadThroughput: 1600000 / 8,
              uploadThroughput: 750000 / 8
            })
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
          }
          const resources = new Map()
          cdp.on('Network.requestWillBeSent', (event) =>
            resources.set(event.requestId, { url: event.request.url, type: event.type })
          )
          cdp.on('Network.loadingFinished', (event) =>
            Object.assign(resources.get(event.requestId) ?? {}, {
              bytes: event.encodedDataLength,
              complete: true
            })
          )
          cdp.on('Network.loadingFailed', (event) =>
            Object.assign(resources.get(event.requestId) ?? {}, { failure: event.errorText })
          )
          const path = label === 'before' ? scenario.path.replace(/\/$/, '') : scenario.path
          const response = await page.goto(site.replace(/\/$/, '') + path, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          })
          if (!response.ok())
            throw new Error(`Measurement page returned ${response.status()}: ${page.url()}`)
          await page.waitForTimeout(scenario.mobile ? 15000 : 8000)
          const observations = await page.evaluate(() =>
            Reflect.get(window, '__performanceMeasurement')
          )
          const lcp = observations.lcp.at(-1)?.startTime
          if (!Number.isFinite(lcp) || lcp <= 0)
            throw new Error(`No LCP observation for ${page.url()}`)
          // 按会话窗口取最大 CLS，定义见 https://web.dev/articles/cls 。
          let session = 0,
            sessionStart = -Infinity,
            last = -Infinity,
            cls = 0
          for (const shift of observations.shifts.filter((entry) => !entry.hadRecentInput)) {
            if (shift.startTime - last >= 1000 || shift.startTime - sessionStart >= 5000) {
              session = 0
              sessionStart = shift.startTime
            }
            session += shift.value
            last = shift.startTime
            cls = Math.max(cls, session)
          }
          const network = [...resources.values()].filter((resource) =>
            /^https?:/.test(resource.url)
          )
          const own = new URL(site).origin
          const row = {
            ...scenario,
            label,
            repetition,
            lcp,
            cls,
            longTaskMs: observations.tasks.reduce((sum, task) => sum + task.duration, 0),
            localBytes: network
              .filter((resource) => new URL(resource.url).origin === own)
              .reduce((sum, resource) => sum + (resource.bytes ?? 0), 0),
            externalBytes: network
              .filter((resource) => new URL(resource.url).origin !== own)
              .reduce((sum, resource) => sum + (resource.bytes ?? 0), 0),
            unfinished: network.filter((resource) => !resource.complete && !resource.failure)
              .length,
            errors,
            network
          }
          result.samples.push(row)
          await writeFile(resolve(output, 'results.json'), JSON.stringify(result, null, 2) + '\n')
          console.log(
            JSON.stringify({
              label,
              path: scenario.path,
              mobile: scenario.mobile,
              repetition,
              lcp: row.lcp,
              cls,
              bytes: row.localBytes + row.externalBytes,
              errors
            })
          )
        } finally {
          await owner.close()
        }
      }
    }
  for (const scenario of scenarios)
    for (const label of baseline ? ['before', 'after'] : ['after']) {
      const rows = result.samples.filter(
        (sample) =>
          sample.label === label &&
          sample.path === scenario.path &&
          sample.mobile === scenario.mobile
      )
      result.summary.push({
        ...scenario,
        label,
        samples: rows.length,
        lcpMedian: median(rows.map((row) => row.lcp)),
        localBytesMedian: median(rows.map((row) => row.localBytes)),
        totalBytesMedian: median(rows.map((row) => row.localBytes + row.externalBytes)),
        longTaskMsMedian: median(rows.map((row) => row.longTaskMs)),
        maximumCls: Math.max(...rows.map((row) => row.cls))
      })
    }
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(result, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(result.summary, null, 2))
