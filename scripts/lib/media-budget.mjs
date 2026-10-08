import { extname } from 'node:path'

export const MiB = 1024 * 1024
export const mediaLimits = {
  '.woff2': { recommended: 0.1 * MiB, hard: 0.2 * MiB },
  '.avif': { recommended: 0.5 * MiB, hard: 2 * MiB },
  '.gif': { recommended: 2 * MiB, hard: 10 * MiB },
  '.jpeg': { recommended: 0.5 * MiB, hard: 2 * MiB },
  '.jpg': { recommended: 0.5 * MiB, hard: 2 * MiB },
  '.mp3': { recommended: 12 * MiB, hard: 25 * MiB },
  '.mp4': { recommended: 20 * MiB, hard: 50 * MiB },
  '.ogg': { recommended: 12 * MiB, hard: 25 * MiB },
  '.png': { recommended: 1 * MiB, hard: 5 * MiB },
  '.webm': { recommended: 20 * MiB, hard: 50 * MiB },
  '.webp': { recommended: 0.5 * MiB, hard: 2 * MiB }
}

export const formatMiB = (bytes) => `${(bytes / MiB).toFixed(2)} MiB`

export function assetRole(path) {
  if (path.startsWith('src/assets/favicon/')) return 'master'
  if (path.startsWith('test/fixtures/reference-images/')) return 'reference'
  if (path.startsWith('public/') || path.startsWith('dist/')) return 'delivery'
  return 'source'
}

export function inspectMediaBudgets(
  entries,
  { verifiedLegacy = new Set(), legacyFingerprints = new Set() } = {}
) {
  const failures = []
  const groups = new Map()
  for (const entry of entries) {
    const { path, bytes, sha256 } = entry
    if (!Number.isFinite(bytes) || bytes < 0) throw new Error(`Invalid asset size: ${path}`)
    if (bytes >= 50 * MiB)
      failures.push(
        `${path} is ${formatMiB(bytes)}; repository/generated files must stay below 50 MiB`
      )
    const limit = mediaLimits[extname(path).toLowerCase()]
    if (!limit) continue
    const fingerprint = sha256 ? `${bytes}:${sha256}` : undefined
    const legacy = path.startsWith('dist/')
      ? fingerprint && legacyFingerprints.has(fingerprint)
      : verifiedLegacy.has(path)
    if (bytes > limit.hard && !legacy) {
      failures.push(`${path} is ${formatMiB(bytes)}; hard media limit is ${formatMiB(limit.hard)}`)
      continue
    }
    if (bytes <= limit.recommended) continue
    const reason = bytes > limit.hard ? 'locked historical asset' : 'recommended maximum'
    const threshold = bytes > limit.hard ? limit.hard : limit.recommended
    // 只合并字节相同、阈值相同的告警，所有发布路径仍保留在明细中。
    const key = `${fingerprint ?? path}:${threshold}:${reason}`
    const group = groups.get(key) ?? { bytes, threshold, reason, paths: [], roles: new Set() }
    group.paths.push(path)
    group.roles.add(assetRole(path))
    groups.set(key, group)
  }
  const warningGroups = [...groups.values()]
  return {
    failures,
    warningGroups,
    warnings: warningGroups.map((group) => {
      const roles = [...group.roles].sort().join('+')
      return `[${roles}] ${formatMiB(group.bytes)}; ${group.reason} ${formatMiB(group.threshold)}: ${group.paths.join(', ')}`
    })
  }
}
