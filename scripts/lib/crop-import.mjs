import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

export const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function cropItems(input, profile, schemaVersion) {
  if (!isRecord(input)) throw new Error('裁剪文件必须是 JSON 对象。')
  if (input.profile !== undefined && input.profile !== profile)
    throw new Error(`输入 profile 为 ${String(input.profile)}，期望 ${profile}。`)
  if (input.schemaVersion !== undefined && input.schemaVersion !== schemaVersion)
    throw new Error(`不支持 schemaVersion ${String(input.schemaVersion)}，期望 ${schemaVersion}。`)
  const items = input.items ?? input.records ?? input.decisions ?? input
  if (!isRecord(items)) throw new Error('输入文件没有有效的 items/records 对象。')
  return items
}

export function validateCropFilename(filename) {
  if (
    !filename ||
    basename(filename) !== filename ||
    /[\\/:]/.test(filename) ||
    !/\.webp$/i.test(filename)
  )
    throw new Error(`不安全或不支持的素材文件名：${filename}`)
}

export function validateTransform(value, label) {
  if (!isRecord(value)) throw new Error(`${label} 缺少裁剪 transform。`)
  for (const [key, minimum, maximum] of [
    ['x', 0, 100],
    ['y', 0, 100],
    ['zoom', 1, 4]
  ]) {
    if (
      typeof value[key] !== 'number' ||
      !Number.isFinite(value[key]) ||
      value[key] < minimum ||
      value[key] > maximum
    )
      throw new Error(`${label}.${key} 必须是 ${minimum}–${maximum} 之间的有限数字。`)
  }
  return { x: value.x, y: value.y, zoom: value.zoom }
}

export function validateCropRecord(value, filename, schemaVersion) {
  validateCropFilename(filename)
  if (!isRecord(value)) throw new Error(`${filename} 不是裁剪对象。`)
  if (value.filename !== undefined && value.filename !== filename)
    throw new Error(`${filename} 与记录中的 filename 不一致。`)
  if (value.schemaVersion !== undefined && value.schemaVersion !== schemaVersion)
    throw new Error(`${filename} 的 schemaVersion 不受支持。`)
}

export async function readGeneratedRecords(path, name) {
  let source
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
  const match = source.match(new RegExp(`${name}[^=]*=\\s*(\\{[\\s\\S]*\\})\\s*;?\\s*$`))
  if (!match) throw new Error(`无法读取现有裁剪配置 ${path}；已停止，避免覆盖。`)
  const records = JSON.parse(match[1])
  if (!isRecord(records)) throw new Error(`现有裁剪配置不是对象：${path}`)
  return records
}

export function printCropSummary(summary, skipped, dryRun) {
  console.log(
    `${dryRun ? 'dry-run：' : ''}新增 ${summary.added.length}；变更 ${summary.changed.length}；删除 ${summary.removed.length}；保留 ${summary.unchanged.length}；跳过 ${skipped.length}。`
  )
  for (const action of ['added', 'changed', 'removed'])
    for (const filename of summary[action]) console.log(`${action}: ${filename}`)
  for (const message of skipped) console.log(`skip: ${message}`)
}
