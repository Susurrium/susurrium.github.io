#!/usr/bin/env node

/**
 * Apply an exported Card Crop Editor JSON file to the checked-in production
 * bridge. The command deliberately writes only the generated map; originals
 * and the editor's localStorage draft are never touched.
 *
 * Usage:
 *   bun scripts/apply-card-crops.mjs path/to/card-crop-editor-v2.json
 *   bun scripts/apply-card-crops.mjs path/to/file.json --dry-run
 */
import { access, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mediaRoot = resolve(projectRoot, 'public', 'images', 'home-media')
const outputPath = resolve(projectRoot, 'src', 'data', 'card-crop-selections.generated.ts')
const profile = 'archive-card'
const frameWidth = 640
const frameHeight = 448
const frameRatio = frameWidth / frameHeight
const schemaVersion = 2

const args = process.argv.slice(2)
const inputPath = args.find((arg) => !arg.startsWith('-'))
const dryRun = args.includes('--dry-run')
const allowEmpty = args.includes('--allow-empty')

if (!inputPath) {
  console.error('Usage: bun scripts/apply-card-crops.mjs <editor-json> [--dry-run]')
  process.exitCode = 1
  process.exit()
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const numberOr = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback)
const normalizeTransform = (value) => ({
  x: clamp(numberOr(value?.x, 50), 0, 100),
  y: clamp(numberOr(value?.y, 50), 0, 100),
  zoom: clamp(numberOr(value?.zoom, 1), 1, 4)
})

const cropRect = (width, height, transform) => {
  const sourceRatio = width / height
  const coverWidth = sourceRatio >= frameRatio ? height * frameRatio : width
  const coverHeight = sourceRatio >= frameRatio ? height : width / frameRatio
  const normalized = normalizeTransform(transform)
  const cropWidth = Math.min(width, coverWidth / normalized.zoom)
  const cropHeight = Math.min(height, coverHeight / normalized.zoom)
  return {
    height: cropHeight / height,
    width: cropWidth / width,
    x: ((width - cropWidth) * (normalized.x / 100)) / width,
    y: ((height - cropHeight) * (normalized.y / 100)) / height
  }
}

const readInput = async () => {
  const absolute = resolve(process.cwd(), inputPath)
  const raw = await readFile(absolute, 'utf8')
  const parsed = JSON.parse(raw)
  if (parsed?.profile !== undefined && parsed.profile !== profile) {
    throw new Error(`输入配置 profile 为“${String(parsed.profile)}”，期望 ${profile}。`)
  }
  const items = parsed?.items ?? parsed?.decisions ?? parsed
  if (!items || typeof items !== 'object' || Array.isArray(items)) {
    throw new Error('输入文件没有找到 items/decisions 对象。')
  }
  return items
}

const safeFilename = (value) => {
  const raw = String(value)
  const file = basename(raw)
  if (!file || /[\\/]/.test(raw) || file !== raw) return undefined
  return file
}

const makeRecord = async (filename, value) => {
  if (!value || typeof value !== 'object') return { reason: '不是对象' }
  const selection = value.selection
  if (!['diagonal-left', 'diagonal-right', 'both'].includes(selection)) {
    return {
      reason: selection === 'neither' ? '标记为两个框都不合适，保留在编辑器中处理' : '尚未确认'
    }
  }

  const sourcePath = resolve(mediaRoot, filename)
  if (!sourcePath.startsWith(`${mediaRoot}${sep}`)) return { reason: '文件名越界' }
  try {
    await access(sourcePath)
  } catch {
    return { reason: '找不到对应 WebP 素材' }
  }

  const metadata = await sharp(sourcePath).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  if (!width || !height) return { reason: '无法读取图片尺寸' }

  const left = normalizeTransform(value.transforms?.['diagonal-left'])
  const right = normalizeTransform(value.transforms?.['diagonal-right'])
  const preferredFrame =
    value.preferredFrame === 'diagonal-left' || value.preferredFrame === 'diagonal-right'
      ? value.preferredFrame
      : selection === 'diagonal-left'
        ? 'diagonal-left'
        : 'diagonal-right'

  return {
    record: {
      filename,
      fit: value.fit === 'contain' ? 'contain' : 'cover',
      preferredFrame,
      schemaVersion,
      selection,
      transforms: {
        'diagonal-left': left,
        'diagonal-right': right
      },
      cropRects: {
        'diagonal-left': cropRect(width, height, left),
        'diagonal-right': cropRect(width, height, right)
      },
      ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {})
    }
  }
}

const items = await readInput()
const records = {}
const skipped = []
for (const [rawFilename, value] of Object.entries(items)) {
  const filename = safeFilename(rawFilename)
  if (!filename) {
    skipped.push(`${rawFilename}: 文件名不安全`)
    continue
  }
  const result = await makeRecord(filename, value)
  if (result.record) records[filename] = result.record
  else skipped.push(`${filename}: ${result.reason}`)
}

const source = `/** Generated by scripts/apply-card-crops.mjs (${profile}). Do not edit by hand. */\nimport type { CardCropRecord } from '@/lib/card-crop/types'\n\nexport const cardCropSelectionsGenerated: Readonly<Record<string, CardCropRecord>> = ${JSON.stringify(records, null, 2)}\n`

console.log(`可应用 ${Object.keys(records).length} 张；跳过 ${skipped.length} 张。`)
if (skipped.length > 0) skipped.forEach((message) => console.log(`- ${message}`))
if (Object.keys(records).length === 0 && !allowEmpty) {
  console.error('没有可应用的已确认记录；为避免误清空现有生产配置，未写入文件。')
  process.exitCode = 1
  process.exit()
}
if (!dryRun) {
  await writeFile(outputPath, source, 'utf8')
  console.log(`已写入 ${outputPath}`)
} else {
  console.log('dry-run：未写入生产配置。')
}
