/* global AbortController, URL, clearTimeout, console, fetch, process, setTimeout */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const linksPath = resolve(root, 'public/links.json')
const healthPath = resolve(root, 'scripts/link-health.json')
const activeGroupId = 'cf-links'
const inactiveGroupId = 'inactive-links'
const permanentFailureCodes = new Set([
  'invalid-url',
  'insecure-url',
  'insecure-redirect',
  'tls-error',
  'http-404',
  'http-410'
])

function readOption(name, fallback) {
  const argument = process.argv.find((value) => value.startsWith(`${name}=`))
  const value = argument ? Number(argument.slice(name.length + 1)) : fallback
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

const dryRun = process.argv.includes('--dry-run')
const retries = readOption('--retries', Number(process.env.LINK_CHECK_RETRIES) || 3)
const timeoutMs = readOption('--timeout', Number(process.env.LINK_CHECK_TIMEOUT_MS) || 8_000)
const failureThreshold = readOption('--threshold', Number(process.env.LINK_FAILURE_THRESHOLD) || 2)
const concurrency = readOption('--concurrency', Number(process.env.LINK_CHECK_CONCURRENCY) || 4)

if (process.argv.includes('--help')) {
  console.log(`Usage: node scripts/check-links.mjs [options]

Checks the monitored friend links and partitions them between cf-links and
inactive-links. Temporary failures are moved after --threshold consecutive
failed runs; certificate, insecure-redirect, 404, and 410 failures move
immediately after the request retries are exhausted.

Options:
  --dry-run          report results without changing files
  --retries=N        requests per run (default: 3)
  --timeout=N        request timeout in milliseconds (default: 8000)
  --threshold=N      consecutive failed runs before moving (default: 2)
  --concurrency=N    simultaneous checks (default: 4)
`)
  process.exit(0)
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT' && fallback !== undefined) return fallback
    throw error
  }
}

function normalizeUrl(value) {
  const parsed = new URL(String(value))
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`unsupported protocol: ${parsed.protocol}`)
  }
  parsed.hash = ''
  return parsed.toString()
}

function errorCode(error) {
  const text = String(error?.cause?.code ?? error?.code ?? error?.message ?? 'request-failed')
  if (/certificate|cert_|tls|ssl/i.test(text)) return 'tls-error'
  if (/abort|timeout/i.test(text)) return 'timeout'
  if (/enotfound|dns/i.test(text)) return 'dns-error'
  return 'request-failed'
}

function isPermanentFailure(result) {
  return permanentFailureCodes.has(result.code)
}

async function requestOnce(url, method) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'user-agent': 'Susurrium link health check/1.0'
      }
    })
    const finalUrl = response.url || url
    const finalProtocol = new URL(finalUrl).protocol
    try {
      await response.body?.cancel()
    } catch {
      // Some HEAD responses do not expose a cancellable body.
    }

    if (finalProtocol !== 'https:') {
      return {
        ok: false,
        code: 'insecure-redirect',
        finalUrl,
        status: response.status
      }
    }

    if (response.status >= 200 && response.status < 400) {
      return { ok: true, finalUrl, status: response.status }
    }

    return {
      ok: false,
      code: `http-${response.status}`,
      finalUrl,
      status: response.status
    }
  } catch (error) {
    return { ok: false, code: errorCode(error), status: null }
  } finally {
    clearTimeout(timer)
  }
}

async function probe(rawUrl) {
  let normalized
  try {
    normalized = normalizeUrl(rawUrl)
  } catch {
    return { ok: false, code: 'invalid-url', status: null, attempts: 0 }
  }

  if (!normalized.startsWith('https://')) {
    return { ok: false, code: 'insecure-url', status: null, attempts: 0 }
  }

  let last = { ok: false, code: 'request-failed', status: null }
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    last = await requestOnce(normalized, 'HEAD')
    // A few hosts disable HEAD while serving GET normally.
    if (!last.ok && [403, 405, 501].includes(last.status)) {
      last = await requestOnce(normalized, 'GET')
    }
    if (last.ok) return { ...last, attempts: attempt }
    if (attempt < retries) await delay(Math.min(1_500, 250 * 2 ** (attempt - 1)))
  }

  return { ...last, attempts: retries }
}

async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await callback(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function groupById(manifest, id) {
  const group = manifest?.friends?.find((candidate) => candidate?.id_name === id)
  if (!group || !Array.isArray(group.link_list)) {
    throw new Error(`links.json is missing a valid ${id} group`)
  }
  return group
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function writeIfChanged(path, content) {
  let previous = ''
  try {
    previous = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  if (previous === content) return false
  if (!dryRun) await writeFile(path, content, 'utf8')
  return true
}

const manifest = await readJson(linksPath)
const health = await readJson(healthPath, { version: 1, links: {} })
const activeGroup = groupById(manifest, activeGroupId)
const inactiveGroup = groupById(manifest, inactiveGroupId)
const currentEntries = [
  ...activeGroup.link_list.map((friend, index) => ({ friend, source: 'active', index })),
  ...inactiveGroup.link_list.map((friend, index) => ({ friend, source: 'inactive', index }))
]

if (!health.links || typeof health.links !== 'object') health.links = {}

const records = new Map()
let nextOrder =
  Object.values(health.links)
    .map((record) => Number(record?.order))
    .filter(Number.isFinite)
    .reduce((maximum, order) => Math.max(maximum, order), -1) + 1

for (const entry of currentEntries) {
  const rawUrl = typeof entry.friend?.link === 'string' ? entry.friend.link : ''
  const key = (() => {
    try {
      return normalizeUrl(rawUrl)
    } catch {
      return `invalid:${rawUrl}`
    }
  })()
  if (!records.has(key)) {
    const previous = health.links[key]
    const previousOrder = Number(previous?.order)
    records.set(key, {
      order: Number.isFinite(previousOrder) ? previousOrder : nextOrder++,
      failures: Number.isFinite(Number(previous?.failures)) ? Number(previous.failures) : 0,
      status: previous?.status === 'down' ? 'down' : 'up',
      rawUrl
    })
  }
}

const checks = await mapWithConcurrency(
  [...records.entries()],
  concurrency,
  async ([key, record]) => {
    const result = await probe(record.rawUrl)
    const previousFailures = record.failures
    const permanentFailure = !result.ok && isPermanentFailure(result)
    const failures = result.ok
      ? 0
      : permanentFailure
        ? failureThreshold
        : Math.min(failureThreshold, previousFailures + 1)
    const status = result.ok
      ? 'up'
      : permanentFailure || failures >= failureThreshold || record.status === 'down'
        ? 'down'
        : 'up'

    record.failures = failures
    record.status = status
    return { key, record, result }
  }
)

const checkedRecords = new Map()
for (const check of checks) {
  checkedRecords.set(check.key, check.record)
  const state = check.record.status === 'down' ? 'BAD' : check.result.ok ? 'OK' : 'PENDING'
  const detail = check.result.ok
    ? `${check.result.status} ${check.result.finalUrl}`
    : `${check.result.code}${check.result.status ? ` (${check.result.status})` : ''}`
  console.log(`${state.padEnd(7)} ${check.record.rawUrl} — ${detail}`)
}

const orderedEntries = currentEntries
  .map((entry, index) => {
    const rawUrl = typeof entry.friend?.link === 'string' ? entry.friend.link : ''
    const key = (() => {
      try {
        return normalizeUrl(rawUrl)
      } catch {
        return `invalid:${rawUrl}`
      }
    })()
    return {
      ...entry,
      key,
      order: checkedRecords.get(key)?.order ?? Number.MAX_SAFE_INTEGER,
      originalIndex: index
    }
  })
  .sort((left, right) => left.order - right.order || left.originalIndex - right.originalIndex)

const oldSourceByKey = new Map()
for (const entry of currentEntries) {
  const rawUrl = typeof entry.friend?.link === 'string' ? entry.friend.link : ''
  let key
  try {
    key = normalizeUrl(rawUrl)
  } catch {
    key = `invalid:${rawUrl}`
  }
  if (!oldSourceByKey.has(key)) oldSourceByKey.set(key, entry.source)
}

activeGroup.link_list = orderedEntries
  .filter((entry) => checkedRecords.get(entry.key)?.status !== 'down')
  .map((entry) => entry.friend)
inactiveGroup.link_list = orderedEntries
  .filter((entry) => checkedRecords.get(entry.key)?.status === 'down')
  .map((entry) => entry.friend)

const movedToBad = [...checkedRecords.entries()]
  .filter(([key, record]) => record.status === 'down' && oldSourceByKey.get(key) === 'active')
  .map(([key]) => key)
const restored = [...checkedRecords.entries()]
  .filter(([key, record]) => record.status !== 'down' && oldSourceByKey.get(key) === 'inactive')
  .map(([key]) => key)

const nextHealth = {
  version: 1,
  links: Object.fromEntries(
    [...checkedRecords.entries()]
      .sort(([, left], [, right]) => left.order - right.order)
      .map(([key, record]) => [
        key,
        { order: record.order, failures: record.failures, status: record.status }
      ])
  )
}

const linksChanged = await writeIfChanged(linksPath, serialize(manifest))
const healthChanged = await writeIfChanged(healthPath, serialize(nextHealth))

console.log(`\nChecked ${checkedRecords.size} monitored link(s).`)
if (movedToBad.length > 0) console.log(`Moved to ${inactiveGroupId}: ${movedToBad.join(', ')}`)
if (restored.length > 0) console.log(`Restored to ${activeGroupId}: ${restored.join(', ')}`)
if (dryRun) {
  console.log('Dry run: no files were changed.')
} else {
  console.log(`Files changed: ${linksChanged || healthChanged ? 'yes' : 'no'}`)
}
