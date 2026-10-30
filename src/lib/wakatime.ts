export const wakaTimeSnapshotUrl =
  'https://raw.githubusercontent.com/Susurrium/wakatime-stats/main/stats.json'

export interface WakaTimeSnapshot {
  schemaVersion: 1
  range: 'all_time'
  fetchedAt: string
  sourceUpdatedAt: string
  metrics: {
    vscode: { editor: 'VS Code'; seconds: number }
    codexAi: { editor: 'Codex Vscode'; seconds: number }
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('WakaTime 统计快照必须是对象。')
  return value as Record<string, unknown>
}

export function validateWakaTimeSnapshot(value: unknown): WakaTimeSnapshot {
  const snapshot = record(value)
  if (snapshot.schemaVersion !== 1 || snapshot.range !== 'all_time')
    throw new Error('WakaTime 统计快照版本或范围无效。')
  for (const key of ['fetchedAt', 'sourceUpdatedAt']) {
    if (typeof snapshot[key] !== 'string' || !Number.isFinite(Date.parse(snapshot[key])))
      throw new Error(`WakaTime ${key} 无效。`)
  }
  const metrics = record(snapshot.metrics)
  for (const [key, editor] of [
    ['vscode', 'VS Code'],
    ['codexAi', 'Codex Vscode']
  ]) {
    const metric = record(metrics[key])
    if (
      metric.editor !== editor ||
      typeof metric.seconds !== 'number' ||
      !Number.isFinite(metric.seconds) ||
      metric.seconds < 0
    )
      throw new Error(`WakaTime ${key} 的来源或时长无效。`)
  }
  return snapshot as unknown as WakaTimeSnapshot
}

export function formatWakaTimeDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours.toLocaleString('en-US')} hrs ${minutes % 60} mins` : `${minutes} mins`
}

export async function fetchWakaTimeSnapshot(signal?: AbortSignal): Promise<WakaTimeSnapshot> {
  const timeout = AbortSignal.timeout(8_000)
  const response = await fetch(wakaTimeSnapshotUrl, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: 'error'
  })
  if (!response.ok) throw new Error(`WakaTime 统计读取失败：HTTP ${response.status}`)
  return validateWakaTimeSnapshot(await response.json())
}

let buildSnapshot: Promise<WakaTimeSnapshot> | undefined

export function loadWakaTimeBuildSnapshot(): Promise<WakaTimeSnapshot> {
  // Home 与 About 在同次构建中共用一份真实快照。
  return (buildSnapshot ??= fetchWakaTimeSnapshot())
}
