/**
 * Build a read-only inventory of Git branch/ref/checkpoint states.
 *
 * The command never checks out, resets, writes to the index, or mutates Git
 * objects.  It only reads refs/objects and writes a new report directory.  A
 * report is refused when the destination already exists so an audit cannot
 * silently overwrite evidence from an earlier run.
 *
 * A "state" is a unique (commit, tree) pair (or a tree-only checkpoint).  A
 * state is compared with the selected HEAD by path and blob id.  Unchanged
 * paths are counted but omitted from path-diffs.csv by default; use
 * --include-unchanged when a complete matrix is required.
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const DEFAULT_HEAD = 'HEAD'
const REPORT_VERSION = 2
const MAX_OUTPUT = 128 * 1024 * 1024
const objectResolutionCache = new Map()
const commitMetadataCache = new Map()

function usage() {
  return `Usage: node scripts/branch-state-audit.mjs [options]

Read-only options:
  --head REV                  comparison baseline (default: HEAD)
  --out DIR                   report directory (must not already exist)
  --bundle FILE               include heads advertised by a git bundle (repeatable)
  --snapshot-dir DIR          include branches/metadata from a saved snapshot (repeatable)
  --ref-prefix PREFIX         limit refs to a prefix (repeatable; default: all refs)
  --exclude-ref PREFIX        omit refs with this prefix (repeatable)
  --path-prefix PREFIX        include only paths below this prefix (repeatable)
  --no-reflog                 do not scan reflog entries
  --no-fsck                   do not inventory unreachable/dangling objects
  --include-unreachable-trees add fsck tree objects as candidate states
  --include-unchanged         include unchanged paths in path-diffs.csv
  --help                      show this message

The default output is artifacts/branch-state-audit-<timestamp>.  Pass an
absolute --out path to keep evidence outside the repository if desired.
The report also writes path-decisions.csv with deterministic per-path triage
categories; unclassified paths are reported in report.md and run.json.
`
}

function fail(message) {
  console.error(`branch-state-audit: ${message}`)
  process.exitCode = 1
  throw new Error(message)
}

function parseArgs(argv) {
  const options = {
    head: DEFAULT_HEAD,
    out: null,
    bundles: [],
    snapshots: [],
    refPrefixes: [],
    excludeRefs: [],
    pathPrefixes: [],
    scanReflog: true,
    scanFsck: true,
    includeUnreachableTrees: false,
    includeUnchanged: false
  }

  const takeValue = (index, name) => {
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`${name} requires a value`)
    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      console.log(usage())
      process.exit(0)
    }
    if (arg === '--head') {
      options.head = takeValue(index, arg)
      index += 1
      continue
    }
    if (arg === '--out') {
      options.out = takeValue(index, arg)
      index += 1
      continue
    }
    if (arg === '--bundle') {
      options.bundles.push(takeValue(index, arg))
      index += 1
      continue
    }
    if (arg === '--snapshot-dir' || arg === '--snapshot') {
      options.snapshots.push(takeValue(index, arg))
      index += 1
      continue
    }
    if (arg === '--ref-prefix') {
      options.refPrefixes.push(takeValue(index, arg))
      index += 1
      continue
    }
    if (arg === '--exclude-ref') {
      options.excludeRefs.push(takeValue(index, arg))
      index += 1
      continue
    }
    if (arg === '--path-prefix') {
      options.pathPrefixes.push(takeValue(index, arg).replaceAll('\\', '/'))
      index += 1
      continue
    }
    if (arg === '--no-reflog') {
      options.scanReflog = false
      continue
    }
    if (arg === '--no-fsck') {
      options.scanFsck = false
      continue
    }
    if (arg === '--include-unreachable-trees') {
      options.includeUnreachableTrees = true
      continue
    }
    if (arg === '--include-unchanged') {
      options.includeUnchanged = true
      continue
    }
    fail(`unknown option: ${arg}`)
  }

  return options
}

function commandResult(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
    shell: false,
    windowsHide: true
  })
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const status = result.status ?? (result.error ? 1 : 0)
  if (result.error && !allowFailure) {
    fail(`unable to run ${command}: ${result.error.message}`)
  }
  if (status !== 0 && !allowFailure) {
    fail(`${command} ${args.join(' ')} failed (${status}): ${stderr.trim() || stdout.trim()}`)
  }
  return { stdout, stderr, status, error: result.error?.message ?? null }
}

function git(args, options) {
  return commandResult('git', args, options)
}

function gitText(args, options) {
  return git(args, options).stdout.trim()
}

function normalizeSha(value) {
  const sha = String(value ?? '').trim()
  return /^[0-9a-f]{7,64}$/i.test(sha) ? sha.toLowerCase() : ''
}

function safeGitText(args) {
  const result = git(args, { allowFailure: true })
  if (result.status !== 0) return ''
  return result.stdout.trim()
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function writeCsv(path, headers, rows) {
  const body = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
  writeFileSync(path, body, 'utf8')
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ')
}

function sha256File(path) {
  const hash = createHash('sha256')
  hash.update(readFileSync(path))
  return hash.digest('hex')
}

function fileInfo(path) {
  try {
    const stat = statSync(path)
    return {
      exists: true,
      sizeBytes: stat.isFile() ? stat.size : null,
      sha256: stat.isFile() ? sha256File(path) : null
    }
  } catch (error) {
    return { exists: false, sizeBytes: null, sha256: null, error: error.message }
  }
}

function classifyRef(refName) {
  if (refName === 'HEAD') return 'head'
  if (refName.startsWith('refs/heads/')) return 'branch'
  if (refName.startsWith('refs/remotes/')) return 'remote'
  if (refName.startsWith('refs/tags/')) return 'tag'
  if (refName.includes('/checkpoints/')) return 'checkpoint'
  if (refName.includes('/captures/')) return 'capture'
  if (refName.startsWith('refs/codex/')) return 'codex-ref'
  return 'ref'
}

function refAllowed(refName, options) {
  if (refName === 'HEAD') return true
  if (options.refPrefixes.length > 0 && !options.refPrefixes.some((prefix) => refName.startsWith(prefix))) {
    return false
  }
  return !options.excludeRefs.some((prefix) => refName.startsWith(prefix))
}

function resolveObject(objectSha, refName = objectSha) {
  const rawObject = normalizeSha(objectSha)
  if (rawObject && objectResolutionCache.has(rawObject)) return objectResolutionCache.get(rawObject)
  if (!rawObject) {
    return { rawObject: objectSha ?? '', rawObjectType: '', commitSha: '', treeSha: '', error: 'invalid object id' }
  }

  const rawObjectType = safeGitText(['cat-file', '-t', rawObject])
  if (!rawObjectType) {
    const value = { rawObject, rawObjectType: '', commitSha: '', treeSha: '', error: `object not found: ${rawObject}` }
    objectResolutionCache.set(rawObject, value)
    return value
  }

  let commitSha = ''
  let treeSha = ''
  if (rawObjectType === 'commit') {
    commitSha = safeGitText(['rev-parse', '--verify', `${rawObject}^{commit}`])
    treeSha = safeGitText(['show', '-s', '--format=%T', rawObject])
  } else if (rawObjectType === 'tree') {
    treeSha = rawObject
  } else if (rawObjectType === 'tag') {
    commitSha = safeGitText(['rev-parse', '--verify', `${rawObject}^{commit}`])
    treeSha = safeGitText(['rev-parse', '--verify', `${rawObject}^{tree}`])
  } else {
    const value = {
      rawObject,
      rawObjectType,
      commitSha: '',
      treeSha: '',
      error: `object type ${rawObjectType} is not a commit/tree/tag (${refName})`
    }
    objectResolutionCache.set(rawObject, value)
    return value
  }

  if (commitSha && !normalizeSha(commitSha)) commitSha = ''
  if (treeSha && !normalizeSha(treeSha)) treeSha = ''
  if (!treeSha) {
    const value = {
      rawObject,
      rawObjectType,
      commitSha,
      treeSha: '',
      error: `unable to resolve a tree for ${refName}`
    }
    objectResolutionCache.set(rawObject, value)
    return value
  }
  const value = { rawObject, rawObjectType, commitSha, treeSha, error: '' }
  objectResolutionCache.set(rawObject, value)
  return value
}

function commitMetadata(commitSha) {
  if (!commitSha) return { parentShas: [], subject: '', authorDate: '', committerDate: '' }
  if (commitMetadataCache.has(commitSha)) return commitMetadataCache.get(commitSha)
  const text = safeGitText([
    'show',
    '-s',
    '--format=%P%x00%an%x00%aI%x00%ci%x00%s',
    commitSha
  ])
  const [parents = '', author = '', authorDate = '', committerDate = '', subject = ''] = text.split('\x00')
  const value = {
    parentShas: parents ? parents.split(/\s+/).filter(Boolean) : [],
    author: author.trim(),
    subject: subject.trim(),
    authorDate: authorDate.trim(),
    committerDate: committerDate.trim()
  }
  commitMetadataCache.set(commitSha, value)
  return value
}

function parseRefs() {
  const output = gitText(['for-each-ref', '--format=%(refname)%00%(objectname)%00%(objecttype)', 'refs'])
  const refs = []
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue
    const [rawRefName = '', rawObjectSha = '', rawObjectType = ''] = line.split('\x00')
    const refName = rawRefName.trim()
    if (!refName) continue
    refs.push({ refName, objectSha: rawObjectSha.trim(), objectTypeHint: rawObjectType.trim() })
  }
  return refs
}

function parseReflog() {
  const result = git(['reflog', '--all', '--format=%H%x00%gD%x00%gs%x00%ci'], { allowFailure: true })
  if (result.status !== 0 && !result.stdout) {
    return { entries: [], warning: result.stderr.trim() || 'reflog scan failed' }
  }
  const entries = []
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    const [sha = '', selector = '', subject = '', date = ''] = line.split('\x00')
    if (!normalizeSha(sha)) continue
    entries.push({ sha: sha.trim(), selector: selector.trim(), subject: subject.trim(), date: date.trim() })
  }
  return { entries, warning: result.status !== 0 ? result.stderr.trim() : '' }
}

function parseFsck() {
  const result = git(['fsck', '--full', '--no-reflogs', '--unreachable', '--no-progress'], {
    allowFailure: true
  })
  const entries = []
  const unparsed = []
  const output = `${result.stdout}\n${result.stderr}`
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(unreachable|dangling|missing)\s+(commit|tree|blob|tag)\s+([0-9a-f]{7,64})/i)
    if (match) {
      entries.push({ reachability: match[1].toLowerCase(), objectType: match[2].toLowerCase(), objectSha: match[3].toLowerCase() })
    } else if (line.trim() && !/^Checking object directories/i.test(line)) {
      unparsed.push(line.trim())
    }
  }
  return {
    entries,
    warning: result.status !== 0 && result.status !== 1 ? result.stderr.trim() : '',
    unparsed
  }
}

function parseBundle(path) {
  const absolutePath = resolve(path)
  const info = fileInfo(absolutePath)
  const result = git(['bundle', 'list-heads', absolutePath], { allowFailure: true })
  const heads = []
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-f]{7,64})\s+(.+)$/i)
    if (match) heads.push({ sha: match[1].toLowerCase(), refName: match[2].trim() })
  }
  return {
    path: absolutePath,
    info,
    heads,
    status: result.status === 0 ? 'ok' : 'error',
    error: result.status === 0 ? '' : result.stderr.trim() || result.stdout.trim() || 'git bundle list-heads failed'
  }
}

function parseSnapshot(directory) {
  const absoluteDir = resolve(directory)
  const sourceFiles = []
  let branches = []
  let metadata = null
  let metadataError = ''
  if (!existsSync(absoluteDir)) {
    return { path: absoluteDir, sourceFiles, branches, metadata, metadataError: 'directory does not exist' }
  }

  const knownFiles = new Set([
    'branches.txt',
    'bundle-verify.txt',
    'index.patch',
    'log-all.txt',
    'snapshot.json',
    'staged-name-status.txt',
    'status.porcelain-v2.txt',
    'unstaged-name-status.txt',
    'untracked.txt',
    'worktree-from-head.patch',
    'worktrees.txt'
  ])
  for (const entry of readdirSync(absoluteDir)) {
    const path = resolve(absoluteDir, entry)
    const info = fileInfo(path)
    if (info.exists && info.sizeBytes !== null) sourceFiles.push({ name: entry, path, ...info, known: knownFiles.has(entry) })
  }

  const branchesPath = resolve(absoluteDir, 'branches.txt')
  if (existsSync(branchesPath)) {
    for (const line of readFileSync(branchesPath, 'utf8').split(/\r?\n/)) {
      // `git branch` prefixes the checked-out branch with `*`; retain that
      // fact as metadata instead of dropping the row from the inventory.
      const match = line.match(/^\s*(\*)?\s*(\S+)\s+([0-9a-f]{7,64})(?:\s+(.*))?$/i)
      if (!match) continue
      branches.push({
        name: match[2],
        sha: match[3].toLowerCase(),
        subject: (match[4] ?? '').trim(),
        checkedOut: Boolean(match[1])
      })
    }
  }

  const snapshotJsonPath = resolve(absoluteDir, 'snapshot.json')
  if (existsSync(snapshotJsonPath)) {
    try {
      metadata = JSON.parse(readFileSync(snapshotJsonPath, 'utf8'))
    } catch (error) {
      metadataError = `snapshot.json parse failed: ${error.message}`
    }
  }
  return { path: absoluteDir, sourceFiles, branches, metadata, metadataError }
}

function snapshotEvidence(snapshot) {
  const rows = []
  const evidenceNames = new Set([
    'untracked.txt',
    'staged-name-status.txt',
    'unstaged-name-status.txt',
    'status.porcelain-v2.txt',
    'index.patch',
    'worktree-from-head.patch'
  ])
  for (const file of snapshot.sourceFiles) {
    if (!evidenceNames.has(file.name)) continue
    let text = ''
    try {
      text = readFileSync(file.path, 'utf8')
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/)
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (!line) continue
      let recordKind = ''
      let pathA = ''
      let pathB = ''
      if (file.name === 'untracked.txt') {
        recordKind = 'untracked-path'
        pathA = line.trim()
      } else if (file.name === 'staged-name-status.txt' || file.name === 'unstaged-name-status.txt') {
        recordKind = 'name-status'
        const fields = line.split(/\t+/)
        pathA = (fields[1] || fields[0] || '').trim()
        pathB = (fields[2] || '').trim()
      } else if (file.name === 'status.porcelain-v2.txt') {
        // Porcelain v2 has comment records, ordinary records with a tabbed
        // path, and `? path` records for untracked files.  Do not turn the
        // status metadata (`# branch.*`) or the `?` marker into fake paths.
        if (line.startsWith('#')) continue
        if (line.startsWith('? ')) {
          recordKind = 'porcelain-v2-untracked'
          pathA = line.slice(2).trim()
        } else {
          const tab = line.indexOf('\t')
          if (tab < 0) continue
          recordKind = 'porcelain-v2'
          pathA = line.slice(tab + 1).trim()
        }
      } else if (file.name.endsWith('.patch') && line.startsWith('diff --git ')) {
        recordKind = 'patch-diff-header'
        const match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
        pathA = match?.[1] ?? ''
        pathB = match?.[2] ?? ''
      } else {
        continue
      }
      if (!pathA) continue
      rows.push({
        snapshot: snapshot.path,
        evidenceFile: file.name,
        recordKind,
        lineNumber: index + 1,
        pathA,
        pathB,
        raw: line.slice(0, 4096)
      })
    }
  }
  return rows
}

function listTree(treeSha, cache) {
  if (cache.has(treeSha)) return cache.get(treeSha)
  const result = git(['ls-tree', '-r', '-l', '-z', treeSha], { allowFailure: true })
  if (result.status !== 0) {
    const value = { entries: new Map(), error: result.stderr.trim() || `cannot read tree ${treeSha}` }
    cache.set(treeSha, value)
    return value
  }
  const entries = new Map()
  for (const record of result.stdout.split('\x00')) {
    if (!record) continue
    const tab = record.indexOf('\t')
    if (tab < 0) continue
    const [mode = '', objectType = '', objectSha = '', size = ''] = record.slice(0, tab).trim().split(/\s+/)
    const path = record.slice(tab + 1)
    if (!path) continue
    entries.set(path, {
      mode,
      objectType,
      objectSha,
      size: size === '-' ? null : Number.parseInt(size, 10)
    })
  }
  const value = { entries, error: '' }
  cache.set(treeSha, value)
  return value
}

function pathInScope(path, prefixes) {
  if (prefixes.length === 0) return true
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix.replace(/\/$/, '')}/`))
}

function compareTrees(candidateTree, currentTree, treeCache, options) {
  const candidate = listTree(candidateTree, treeCache)
  const current = listTree(currentTree, treeCache)
  if (candidate.error || current.error) {
    return {
      rows: [],
      counts: { total: 0, unchanged: 0, changed: 0, currentMissing: 0, historicalMissing: 0 },
      error: candidate.error || current.error
    }
  }

  const paths = new Set([...candidate.entries.keys(), ...current.entries.keys()])
  const rows = []
  const counts = { total: 0, unchanged: 0, changed: 0, currentMissing: 0, historicalMissing: 0 }
  for (const path of [...paths].sort()) {
    if (!pathInScope(path, options.pathPrefixes)) continue
    const candidateEntry = candidate.entries.get(path)
    const currentEntry = current.entries.get(path)
    let status = 'UNCHANGED'
    if (!candidateEntry && currentEntry) {
      status = 'CURRENT_MISSING'
      counts.currentMissing += 1
    } else if (candidateEntry && !currentEntry) {
      status = 'HISTORICAL_MISSING'
      counts.historicalMissing += 1
    } else if (
      candidateEntry.objectSha !== currentEntry.objectSha ||
      candidateEntry.mode !== currentEntry.mode ||
      candidateEntry.objectType !== currentEntry.objectType
    ) {
      status = 'CHANGED'
      counts.changed += 1
    } else {
      counts.unchanged += 1
    }
    counts.total += 1
    if (status !== 'UNCHANGED' || options.includeUnchanged) {
      rows.push({
        path,
        status,
        candidate: candidateEntry ?? null,
        current: currentEntry ?? null
      })
    }
  }
  return { rows, counts, error: '' }
}

function addSource(sources, source) {
  const resolved = resolveObject(source.objectSha, source.refName)
  const metadata = resolved.commitSha ? commitMetadata(resolved.commitSha) : {}
  sources.push({
    sourceKind: source.sourceKind,
    sourceId: source.sourceId,
    refName: source.refName,
    objectSha: resolved.rawObject,
    objectType: resolved.rawObjectType || source.objectTypeHint || '',
    commitSha: resolved.commitSha,
    treeSha: resolved.treeSha,
    stateKey: resolved.treeSha ? `${resolved.commitSha || 'tree'}:${resolved.treeSha}` : '',
    subject: source.subject || metadata.subject || '',
    author: metadata.author || '',
    authorDate: metadata.authorDate || '',
    committerDate: metadata.committerDate || '',
    parentShas: metadata.parentShas || [],
    timestamp: source.timestamp || '',
    metadata: source.metadata || {},
    error: resolved.error || source.error || ''
  })
}

function stateKind(state) {
  return state.commitSha ? 'commit' : 'tree'
}

function createDefaultOutput() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return resolve(ROOT, 'artifacts', `branch-state-audit-${stamp}`)
}

function ensureSafeOutput(output) {
  const absolute = resolve(output)
  if (existsSync(absolute)) fail(`refusing to overwrite existing output directory: ${absolute}`)
  // Relative paths are allowed below the repository (artifacts/ is ignored),
  // and absolute paths may be outside it. The repository root itself is never
  // a valid report destination.
  if (absolute === ROOT) fail('report output cannot be the repository root')
  return absolute
}

function sourceInventoryRows(inventory) {
  return inventory.map((item) => [
    item.sourceKind,
    item.path ?? '',
    item.status ?? (item.info?.exists ? 'ok' : 'missing'),
    item.info?.sizeBytes ?? '',
    item.info?.sha256 ?? '',
    item.details ?? item.error ?? ''
  ])
}

// The path classifier is deliberately conservative and deterministic.  It is
// a triage aid for the evidence matrix, not a claim that a historical file is
// safe to publish.  A historical content file therefore remains a
// USER_CONFIRM_CONTENT candidate unless its name clearly identifies a
// generated preview or a draft.
const PATH_CLASSIFIER_VERSION = 1
const PATH_CATEGORY_ORDER = [
  'QUARANTINE_TEMP',
  'REJECT_ORPHAN_DOC_ASSET',
  'USER_CONFIRM_CONTENT',
  'REJECT_GENERATED_CONTENT',
  'REJECT_DRAFT_CONTENT',
  'REJECT_SUPERSEDED_RUNTIME',
  'REJECT_UNUSED_ASSET',
  'REJECT_SIDE_EFFECT_WORKFLOW',
  'REJECT_GENERATED_STATE',
  'EXPECTED_EVOLUTION',
  'CURRENT_ONLY',
  'UNCLASSIFIED'
]

const PATH_CATEGORY_RANK = new Map(PATH_CATEGORY_ORDER.map((category, index) => [category, index]))

const PATH_CATEGORY_DETAILS = Object.freeze({
  CURRENT_ONLY: {
    decision: 'KEEP_CURRENT',
    rationale: '路径只出现在比较 HEAD；保留当前实现，历史状态没有可直接恢复的同路径文件。'
  },
  EXPECTED_EVOLUTION: {
    decision: 'KEEP_CURRENT_REVIEW',
    rationale: '路径在历史状态与比较 HEAD 中都存在但 blob、模式或类型不同；按当前架构保留，并在需要时审阅差异。'
  },
  QUARANTINE_TEMP: {
    decision: 'EXCLUDE_QUARANTINE',
    rationale: '路径符合临时截图、预览、调试日志或工作台产物命名；不纳入发布树，证据由快照/审计产物保留。'
  },
  REJECT_ORPHAN_DOC_ASSET: {
    decision: 'EXCLUDE_ORPHAN',
    rationale: '路径位于文档托管用的旧截图资产目录，当前发布运行时没有引用；除非重新确认用途，否则不恢复。'
  },
  USER_CONFIRM_CONTENT: {
    decision: 'HOLD_FOR_OWNER_CONFIRMATION',
    rationale: '路径是历史内容文件且不是明确的预览或草稿；可能包含真实公开文章，须由站长确认保留、迁移或归档。'
  },
  REJECT_GENERATED_CONTENT: {
    decision: 'EXCLUDE_GENERATED',
    rationale: '路径名为 card-preview-*，属于卡片预览生成内容；不作为正式内容发布。'
  },
  REJECT_DRAFT_CONTENT: {
    decision: 'EXCLUDE_DRAFT',
    rationale: '路径名为 draft-*，属于未完成草稿；不进入发布提交，需单独确认后再处理。'
  },
  REJECT_SUPERSEDED_RUNTIME: {
    decision: 'REJECT_SUPERSEDED',
    rationale: '历史运行时组件/页面已被当前架构替代；先采用当前入口与组件，只有证明存在行为缺口时才逐项移植。'
  },
  REJECT_UNUSED_ASSET: {
    decision: 'EXCLUDE_UNUSED_ASSET',
    rationale: '历史 public/src/assets 文件当前未作为发布树中的同一路径使用；不自动恢复，须先确认引用、版权和体积预算。'
  },
  REJECT_SIDE_EFFECT_WORKFLOW: {
    decision: 'EXCLUDE_SIDE_EFFECT',
    rationale: '该工作流会产生状态写回或额外权限/触发器副作用，不属于本次发布准备范围；需单独审阅后启用。'
  },
  REJECT_GENERATED_STATE: {
    decision: 'EXCLUDE_GENERATED_STATE',
    rationale: '链接健康状态是脚本运行生成的状态文件；发布审计只读运行，不将其作为源内容恢复。'
  },
  UNCLASSIFIED: {
    decision: 'REVIEW_REQUIRED',
    rationale: '没有命中确定性规则；必须人工确认用途、来源、隐私/许可证和运行时影响后再决定。'
  }
})

const TEMP_ROOT_PATHS = new Set([
  'browser-diagnosis.png',
  'entrance-mobile-preview.png',
  'home-card-desktop.png',
  'home-card-mobile.png'
])

function normalizeAuditPath(path) {
  return String(path ?? '').replaceAll('\\', '/').replace(/^\.\//, '')
}

function isQuarantineTempPath(path) {
  const normalized = normalizeAuditPath(path).toLowerCase()
  if (/^(?:\.tmp-|tmp-|timeline-|\.avatar-)/.test(normalized)) return true
  if (TEMP_ROOT_PATHS.has(normalized)) return true
  return /^(?:astro-(?:build|dev|preview)|browser-diagnosis|entrance-mobile-preview|home-card-(?:desktop|mobile)).*\.(?:log|png|jpg|jpeg|webp)$/i.test(normalized)
}

function classifyAuditPath(path, status) {
  const normalized = normalizeAuditPath(path)

  // Historical-only paths are classified by their path semantics first.  A
  // path that is merely changed/current-only is an architecture comparison,
  // not evidence that the current file should be rejected.
  if (status === 'HISTORICAL_MISSING') {
    if (isQuarantineTempPath(normalized)) return { category: 'QUARANTINE_TEMP', ...PATH_CATEGORY_DETAILS.QUARANTINE_TEMP }
    if (normalized.startsWith('.github/assets/')) {
      return { category: 'REJECT_ORPHAN_DOC_ASSET', ...PATH_CATEGORY_DETAILS.REJECT_ORPHAN_DOC_ASSET }
    }
    if (normalized.startsWith('src/content/')) {
      if (/(^|\/)card-preview-[^/]+$/i.test(normalized)) {
        return { category: 'REJECT_GENERATED_CONTENT', ...PATH_CATEGORY_DETAILS.REJECT_GENERATED_CONTENT }
      }
      if (/(^|\/)draft-[^/]+$/i.test(normalized)) {
        return { category: 'REJECT_DRAFT_CONTENT', ...PATH_CATEGORY_DETAILS.REJECT_DRAFT_CONTENT }
      }
      return { category: 'USER_CONFIRM_CONTENT', ...PATH_CATEGORY_DETAILS.USER_CONFIRM_CONTENT }
    }
    if (normalized === '.github/workflows/check-links.yml') {
      return { category: 'REJECT_SIDE_EFFECT_WORKFLOW', ...PATH_CATEGORY_DETAILS.REJECT_SIDE_EFFECT_WORKFLOW }
    }
    if (normalized === 'scripts/link-health.json') {
      return { category: 'REJECT_GENERATED_STATE', ...PATH_CATEGORY_DETAILS.REJECT_GENERATED_STATE }
    }
    if (normalized.startsWith('src/components/') || normalized.startsWith('src/pages/')) {
      return { category: 'REJECT_SUPERSEDED_RUNTIME', ...PATH_CATEGORY_DETAILS.REJECT_SUPERSEDED_RUNTIME }
    }
    if (normalized.startsWith('src/assets/') || normalized.startsWith('public/')) {
      return { category: 'REJECT_UNUSED_ASSET', ...PATH_CATEGORY_DETAILS.REJECT_UNUSED_ASSET }
    }
    return { category: 'UNCLASSIFIED', ...PATH_CATEGORY_DETAILS.UNCLASSIFIED }
  }

  if (status === 'CURRENT_MISSING') return { category: 'CURRENT_ONLY', ...PATH_CATEGORY_DETAILS.CURRENT_ONLY }
  if (status === 'CHANGED') return { category: 'EXPECTED_EVOLUTION', ...PATH_CATEGORY_DETAILS.EXPECTED_EVOLUTION }
  return { category: 'UNCLASSIFIED', ...PATH_CATEGORY_DETAILS.UNCLASSIFIED }
}

function primaryPathCategory(categories) {
  return [...categories].sort((left, right) => {
    const leftRank = PATH_CATEGORY_RANK.get(left) ?? Number.MAX_SAFE_INTEGER
    const rightRank = PATH_CATEGORY_RANK.get(right) ?? Number.MAX_SAFE_INTEGER
    return leftRank - rightRank || left.localeCompare(right)
  })[0] ?? 'UNCLASSIFIED'
}

function buildPathDecisions(pathRows) {
  const grouped = new Map()
  for (const row of pathRows) {
    if (row.status === 'UNCHANGED') continue
    const path = normalizeAuditPath(row.path)
    const classification = classifyAuditPath(path, row.status)
    let decision = grouped.get(path)
    if (!decision) {
      decision = {
        path,
        statuses: new Set(),
        statusCounts: new Map(),
        categories: new Map(),
        stateIds: new Set(),
        treeShas: new Set(),
        diffRows: 0
      }
      grouped.set(path, decision)
    }
    decision.statuses.add(row.status)
    decision.statusCounts.set(row.status, (decision.statusCounts.get(row.status) ?? 0) + 1)
    decision.categories.set(classification.category, classification)
    if (row.stateId) decision.stateIds.add(row.stateId)
    if (row.treeSha) decision.treeShas.add(row.treeSha)
    decision.diffRows += 1
  }

  return [...grouped.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => {
      const categorySet = [...entry.categories.keys()].sort((left, right) => {
        const leftRank = PATH_CATEGORY_RANK.get(left) ?? Number.MAX_SAFE_INTEGER
        const rightRank = PATH_CATEGORY_RANK.get(right) ?? Number.MAX_SAFE_INTEGER
        return leftRank - rightRank || left.localeCompare(right)
      })
      const category = primaryPathCategory(categorySet)
      const details = entry.categories.get(category) ?? PATH_CATEGORY_DETAILS.UNCLASSIFIED
      const statusCounts = Object.fromEntries([...entry.statusCounts.entries()].sort(([left], [right]) => left.localeCompare(right)))
      const stateIds = [...entry.stateIds].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      const treeShas = [...entry.treeShas].sort()
      return {
        path: entry.path,
        category,
        categorySet,
        decision: details.decision,
        rationale: details.rationale,
        statuses: [...entry.statuses].sort(),
        statusCounts,
        diffRows: entry.diffRows,
        stateCount: stateIds.length,
        treeCount: treeShas.length,
        stateIds,
        treeShas
      }
    })
}

function pathDecisionSummary(pathDecisions) {
  const categoryCounts = Object.fromEntries(PATH_CATEGORY_ORDER.map((category) => [category, 0]))
  const categorySetCounts = Object.fromEntries(PATH_CATEGORY_ORDER.map((category) => [category, 0]))
  const unclassified = []
  for (const decision of pathDecisions) {
    categoryCounts[decision.category] = (categoryCounts[decision.category] ?? 0) + 1
    for (const category of decision.categorySet) categorySetCounts[category] = (categorySetCounts[category] ?? 0) + 1
    if (decision.categorySet.includes('UNCLASSIFIED')) unclassified.push(decision)
  }
  return {
    pathCount: pathDecisions.length,
    categoryCounts,
    categorySetCounts,
    unclassifiedPathCount: unclassified.length,
    unclassifiedRuntimePathCount: unclassified.filter((decision) => /^(?:src\/|\.github\/workflows\/)/.test(decision.path)).length
  }
}

function renderReport({
  options,
  output,
  startedAt,
  head,
  refs,
  sources,
  states,
  pathRows,
  pathDecisions,
  inventory,
  fsckEntries,
  evidenceCount,
  warnings
}) {
  const changedRows = pathRows.filter((row) => row.status !== 'UNCHANGED')
  const decisionSummary = pathDecisionSummary(pathDecisions)
  const categoryMembership = Object.entries(decisionSummary.categorySetCounts)
    .sort(([left], [right]) => {
      const leftRank = PATH_CATEGORY_RANK.get(left) ?? Number.MAX_SAFE_INTEGER
      const rightRank = PATH_CATEGORY_RANK.get(right) ?? Number.MAX_SAFE_INTEGER
      return leftRank - rightRank || left.localeCompare(right)
    })
    .map(([category, count]) => `${category}=${count}`)
    .join(', ')
  const statusCounts = changedRows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1
    return counts
  }, {})
  const uniquePathsByStatus = changedRows.reduce((paths, row) => {
    if (!paths[row.status]) paths[row.status] = new Set()
    paths[row.status].add(row.path)
    return paths
  }, {})
  const stateRows = [...states.values()].sort((left, right) => left.stateId.localeCompare(right.stateId))
  const refKindCounts = refs.reduce((counts, ref) => {
    const kind = classifyRef(ref.refName)
    counts[kind] = (counts[kind] ?? 0) + 1
    return counts
  }, {})
  const sourceKindCounts = sources.reduce((counts, source) => {
    counts[source.sourceKind] = (counts[source.sourceKind] ?? 0) + 1
    return counts
  }, {})
  const lines = [
    '# Branch/state audit',
    '',
    `- Report version: ${REPORT_VERSION}`,
    `- Generated: ${startedAt}`,
    `- Repository: \`${ROOT}\``,
    `- Comparison HEAD: \`${head.input}\` → commit \`${head.commitSha}\`, tree \`${head.treeSha}\``,
    `- Output: \`${output}\``,
    '',
    '## Scope',
    '',
    `- Ref records: ${refs.length}`,
    `- Ref kinds: ${Object.entries(refKindCounts).sort(([left], [right]) => left.localeCompare(right)).map(([kind, count]) => `${kind}=${count}`).join(', ') || 'none'}`,
    `- Source records: ${sources.length} (${Object.entries(sourceKindCounts).sort(([left], [right]) => left.localeCompare(right)).map(([kind, count]) => `${kind}=${count}`).join(', ')})`,
    `- Unique states: ${stateRows.length}`,
    `- Unique trees compared: ${new Set(stateRows.map((state) => state.treeSha)).size}`,
    `- Reflog scan: ${options.scanReflog ? 'enabled' : 'disabled'}`,
    `- Unreachable-object inventory: ${options.scanFsck ? `enabled (${fsckEntries.length} objects)` : 'disabled'}`,
    `- Snapshot evidence records: ${evidenceCount}`,
    `- Path scope: ${options.pathPrefixes.length ? options.pathPrefixes.join(', ') : 'repository-wide'}`,
    `- Unchanged path rows: ${options.includeUnchanged ? 'included' : 'counted only (omitted from path-diffs.csv)'}`,
    `- Path decisions: ${decisionSummary.pathCount} unique changed path(s); unclassified=${decisionSummary.unclassifiedPathCount} (runtime=${decisionSummary.unclassifiedRuntimePathCount})`,
    '',
    '## State summary',
    '',
    '| State | Kind | Commit | Tree | Current tree | Sources | Diff rows | Current missing | Historical missing | Changed | Unchanged |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ]
  for (const state of stateRows) {
    lines.push(
      `| ${markdownCell(state.stateId)} | ${stateKind(state)} | ${markdownCell(state.commitSha)} | ${markdownCell(state.treeSha)} | ${state.isCurrentTree ? 'yes' : 'no'} | ${state.sourceIds.length} | ${state.differenceCount} | ${state.counts.currentMissing} | ${state.counts.historicalMissing} | ${state.counts.changed} | ${state.counts.unchanged} |`
    )
  }
  lines.push(
    '',
    '## Difference summary',
    '',
    `- Changed rows: ${statusCounts.CHANGED ?? 0} across ${uniquePathsByStatus.CHANGED?.size ?? 0} unique path(s)`,
    `- Paths only in current HEAD: ${statusCounts.CURRENT_MISSING ?? 0} rows across ${uniquePathsByStatus.CURRENT_MISSING?.size ?? 0} unique path(s)`,
    `- Paths only in historical state: ${statusCounts.HISTORICAL_MISSING ?? 0} rows across ${uniquePathsByStatus.HISTORICAL_MISSING?.size ?? 0} unique path(s)`,
    `- Unresolved source records: ${sources.filter((source) => source.error).length}`,
    '',
    '## Path decisions',
    '',
    `The deterministic classifier (version ${PATH_CLASSIFIER_VERSION}) groups each unique changed path into a review category. ` +
      'These labels are triage decisions, not permission to publish or delete content.',
    '',
    '| Category | Unique paths |',
    '| --- | ---: |'
  )
  for (const [category, count] of Object.entries(decisionSummary.categoryCounts).sort(([left], [right]) => {
    const leftRank = PATH_CATEGORY_RANK.get(left) ?? Number.MAX_SAFE_INTEGER
    const rightRank = PATH_CATEGORY_RANK.get(right) ?? Number.MAX_SAFE_INTEGER
    return leftRank - rightRank || left.localeCompare(right)
  })) {
    lines.push(`| ${markdownCell(category)} | ${count} |`)
  }
  lines.push(
    '',
    `- Category membership including secondary statuses: ${categoryMembership || 'none'}.`,
    `- Unclassified paths: ${decisionSummary.unclassifiedPathCount}; unclassified runtime candidates: ${decisionSummary.unclassifiedRuntimePathCount}.`,
    '- See `path-decisions.csv` for the status set/count, state/tree coverage, rationale, and deterministic decision for every path.',
    '',
    'The CSV files are the authoritative machine-readable matrix. A path marked `HISTORICAL_MISSING` is a candidate for review, not an automatic recommendation to restore it. Content correctness, privacy, licensing, runtime behavior, and product intent require a separate human decision ledger.',
    '',
    '## Source inventory',
    '',
    '| Kind | Source | Status | Details |',
    '| --- | --- | --- | --- |'
  )
  for (const item of inventory) {
    lines.push(`| ${markdownCell(item.sourceKind)} | ${markdownCell(item.path)} | ${markdownCell(item.status)} | ${markdownCell(item.details ?? item.error ?? '')} |`)
  }
  lines.push(
    '',
    '## Files',
    '',
    '- `refs.csv`: every discovered ref/source alias and its resolved commit/tree.',
    '- `states.csv`: unique commit/tree states and per-state counts.',
    '- `path-diffs.csv`: path/blob/mode differences against the selected HEAD.',
    '- `path-decisions.csv`: one deterministic classification/decision row per unique changed path, including status and tree coverage.',
    '- `unreachable.csv`: fsck object inventory; only commits become states by default.',
    '- `sources.csv`: bundle/snapshot evidence files and hashes.',
    '- `snapshot-evidence.csv`: parsed untracked/status/patch path records from supplied snapshots.',
    '- `run.json`: command options, versions, counts, and warnings.',
    '',
    '## Warnings',
    ''
  )
  if (warnings.length === 0) lines.push('- None.')
  else for (const warning of warnings) lines.push(`- ${markdownCell(warning)}`)
  lines.push('')
  return lines.join('\n')
}

function main() {
  const startedAt = new Date().toISOString()
  const options = parseArgs(process.argv.slice(2))
  const output = ensureSafeOutput(options.out ? resolve(ROOT, options.out) : createDefaultOutput())
  const warnings = []
  const inventory = []

  const gitVersion = safeGitText(['--version'])
  const headCommitSha = safeGitText(['rev-parse', '--verify', `${options.head}^{commit}`])
  const resolvedHeadTreeSha = safeGitText(['rev-parse', '--verify', `${options.head}^{tree}`])
  if (!normalizeSha(headCommitSha) || !normalizeSha(resolvedHeadTreeSha)) {
    fail(`unable to resolve --head ${options.head} to a commit/tree`)
  }
  const head = { input: options.head, commitSha: headCommitSha, treeSha: resolvedHeadTreeSha }

  const refs = []
  const sources = []
  const evidenceRows = []
  addSource(sources, {
    sourceKind: 'head',
    sourceId: 'head',
    refName: options.head,
    objectSha: headCommitSha,
    subject: 'selected comparison HEAD'
  })

  for (const ref of parseRefs()) {
    if (!refAllowed(ref.refName, options)) continue
    refs.push(ref)
    addSource(sources, {
      sourceKind: classifyRef(ref.refName),
      sourceId: ref.refName,
      refName: ref.refName,
      objectSha: ref.objectSha,
      objectTypeHint: ref.objectTypeHint
    })
  }

  if (options.scanReflog) {
    const reflog = parseReflog()
    if (reflog.warning) warnings.push(`reflog: ${reflog.warning}`)
    reflog.entries.forEach((entry, index) => {
      addSource(sources, {
        sourceKind: 'reflog',
        sourceId: `reflog:${entry.selector}:${index}`,
        refName: entry.selector,
        objectSha: entry.sha,
        subject: entry.subject,
        timestamp: entry.date,
        metadata: { selector: entry.selector }
      })
    })
  }

  const bundlePaths = new Set(options.bundles.map((path) => resolve(path)))
  const snapshotRecords = options.snapshots.map(parseSnapshot)
  for (const snapshot of snapshotRecords) {
    const snapshotName = basename(snapshot.path)
    if (snapshot.metadata?.bundle) bundlePaths.add(resolve(snapshot.path, snapshot.metadata.bundle))
    evidenceRows.push(...snapshotEvidence(snapshot))
    inventory.push({
      sourceKind: 'snapshot-dir',
      path: snapshot.path,
      status: snapshot.metadataError ? 'error' : existsSync(snapshot.path) ? 'ok' : 'missing',
      details: snapshot.metadataError || `${snapshot.branches.length} branch rows; ${snapshot.sourceFiles.length} evidence files`
    })
    for (const file of snapshot.sourceFiles) {
      inventory.push({
        sourceKind: 'snapshot-file',
        path: file.path,
        status: file.exists ? 'ok' : 'missing',
        info: file,
        details: `${file.name}${file.known ? '' : ' (unclassified snapshot file)'}`
      })
    }
    for (const branch of snapshot.branches) {
      addSource(sources, {
        sourceKind: 'snapshot-branch',
        sourceId: `snapshot:${snapshotName}:${branch.name}`,
        refName: `snapshot:${snapshotName}:${branch.name}`,
        objectSha: branch.sha,
        subject: branch.subject,
        metadata: { snapshot: snapshot.path, branch: branch.name, checkedOut: branch.checkedOut }
      })
    }
    if (snapshot.metadata?.head) {
      addSource(sources, {
        sourceKind: 'snapshot-head',
        sourceId: `snapshot:${snapshotName}:head`,
        refName: `snapshot:${snapshotName}:head`,
        objectSha: snapshot.metadata.head,
        metadata: { snapshot: snapshot.path }
      })
    }
  }

  for (const bundlePath of bundlePaths) {
    const bundle = parseBundle(bundlePath)
    inventory.push({
      sourceKind: 'bundle',
      path: bundle.path,
      status: bundle.status,
      info: bundle.info,
      details: bundle.error || `${bundle.heads.length} advertised head(s)`
    })
    if (bundle.status !== 'ok') {
      warnings.push(`bundle ${bundle.path}: ${bundle.error}`)
      continue
    }
    for (const headEntry of bundle.heads) {
      addSource(sources, {
        sourceKind: 'bundle-head',
        sourceId: `bundle:${basename(bundle.path)}:${headEntry.refName}`,
        refName: `bundle:${basename(bundle.path)}:${headEntry.refName}`,
        objectSha: headEntry.sha,
        metadata: { bundle: bundle.path, advertisedRef: headEntry.refName }
      })
    }
  }

  let fsckEntries = []
  if (options.scanFsck) {
    const fsck = parseFsck()
    fsckEntries = fsck.entries
    if (fsck.warning) warnings.push(`fsck: ${fsck.warning}`)
    if (fsck.unparsed.length > 0) warnings.push(`fsck emitted ${fsck.unparsed.length} unparsed line(s)`)
    for (const entry of fsck.entries) {
      if (entry.objectType !== 'commit' && !(entry.objectType === 'tree' && options.includeUnreachableTrees)) continue
      addSource(sources, {
        sourceKind: `fsck-${entry.reachability}`,
        sourceId: `fsck:${entry.reachability}:${entry.objectType}:${entry.objectSha}`,
        refName: `fsck:${entry.reachability}:${entry.objectType}:${entry.objectSha}`,
        objectSha: entry.objectSha,
        metadata: { reachability: entry.reachability, objectType: entry.objectType }
      })
    }
  }

  const stateMap = new Map()
  for (const source of sources) {
    if (!source.stateKey) continue
    let state = stateMap.get(source.stateKey)
    if (!state) {
      state = {
        stateId: `state-${stateMap.size + 1}`,
        stateKey: source.stateKey,
        commitSha: source.commitSha,
        treeSha: source.treeSha,
        sourceIds: [],
        sourceKinds: new Set(),
        refNames: [],
        subject: source.subject,
        author: source.author,
        authorDate: source.authorDate,
        committerDate: source.committerDate,
        parentShas: source.parentShas,
        isCurrentTree: source.treeSha === head.treeSha,
        counts: { total: 0, unchanged: 0, changed: 0, currentMissing: 0, historicalMissing: 0 },
        differenceCount: 0,
        diffError: ''
      }
      stateMap.set(source.stateKey, state)
    }
    state.sourceIds.push(source.sourceId)
    state.sourceKinds.add(source.sourceKind)
    if (source.refName) state.refNames.push(source.refName)
    if (!state.subject && source.subject) state.subject = source.subject
    if (!state.author && source.author) state.author = source.author
    if (!state.authorDate && source.authorDate) state.authorDate = source.authorDate
    if (!state.committerDate && source.committerDate) state.committerDate = source.committerDate
    if (state.parentShas.length === 0 && source.parentShas.length > 0) state.parentShas = source.parentShas
  }

  const treeCache = new Map()
  const pathRows = []
  for (const state of stateMap.values()) {
    const comparison = compareTrees(state.treeSha, head.treeSha, treeCache, options)
    state.counts = comparison.counts
    state.diffError = comparison.error
    state.differenceCount = comparison.rows.filter((row) => row.status !== 'UNCHANGED').length
    if (comparison.error) warnings.push(`${state.stateId} (${state.treeSha}): ${comparison.error}`)
    for (const row of comparison.rows) {
      pathRows.push({ stateId: state.stateId, treeSha: state.treeSha, ...row })
    }
  }

  const pathDecisions = buildPathDecisions(pathRows)
  const decisionSummary = pathDecisionSummary(pathDecisions)
  if (decisionSummary.unclassifiedPathCount > 0) {
    warnings.push(
      `path classifier left ${decisionSummary.unclassifiedPathCount} unique path(s) unclassified ` +
        `(${decisionSummary.unclassifiedRuntimePathCount} runtime candidate(s)); review path-decisions.csv`
    )
  }

  const sourceRows = sources
    .slice()
    .sort((left, right) => `${left.sourceKind}:${left.sourceId}`.localeCompare(`${right.sourceKind}:${right.sourceId}`))
    .map((source) => [
      source.sourceKind,
      source.sourceId,
      source.refName,
      source.objectSha,
      source.objectType,
      source.commitSha,
      source.treeSha,
      source.stateKey ? stateMap.get(source.stateKey)?.stateId ?? '' : '',
      source.subject,
      source.author,
      source.authorDate,
      source.committerDate,
      source.parentShas.join(' '),
      JSON.stringify(source.metadata),
      source.error
    ])

  const stateRows = [...stateMap.values()]
    .sort((left, right) => left.stateId.localeCompare(right.stateId, undefined, { numeric: true }))
    .map((state) => [
      state.stateId,
      stateKind(state),
      state.commitSha,
      state.treeSha,
      state.sourceIds.length,
      state.sourceIds.join(' '),
      [...state.sourceKinds].sort().join(' '),
      state.refNames.join(' '),
      state.isCurrentTree,
      state.subject,
      state.author,
      state.authorDate,
      state.committerDate,
      state.parentShas.join(' '),
      state.counts.total,
      state.differenceCount,
      state.counts.currentMissing,
      state.counts.historicalMissing,
      state.counts.changed,
      state.counts.unchanged,
      state.diffError
    ])

  const pathDiffRows = pathRows
    .sort((left, right) => left.stateId.localeCompare(right.stateId, undefined, { numeric: true }) || left.path.localeCompare(right.path))
    .map((row) => [
      row.stateId,
      row.treeSha,
      row.path,
      row.status,
      row.candidate?.mode ?? '',
      row.candidate?.objectType ?? '',
      row.candidate?.objectSha ?? '',
      row.candidate?.size ?? '',
      row.current?.mode ?? '',
      row.current?.objectType ?? '',
      row.current?.objectSha ?? '',
      row.current?.size ?? '',
      Boolean(row.candidate),
      Boolean(row.current)
    ])

  const pathDecisionRows = pathDecisions.map((decision) => [
    decision.path,
    decision.category,
    decision.categorySet.join('|'),
    decision.decision,
    decision.rationale,
    decision.statuses.join('|'),
    decision.diffRows,
    decision.stateCount,
    decision.treeCount,
    decision.treeShas.slice(0, 5).join(' '),
    decision.stateIds.slice(0, 10).join(' '),
    JSON.stringify(decision.statusCounts),
    decision.categorySet.includes('UNCLASSIFIED')
  ])

  const fsckRows = fsckEntries
    .sort((left, right) => `${left.objectType}:${left.objectSha}`.localeCompare(`${right.objectType}:${right.objectSha}`))
    .map((entry) => [
      entry.reachability,
      entry.objectType,
      entry.objectSha,
      entry.objectType === 'commit' || (entry.objectType === 'tree' && options.includeUnreachableTrees),
      `fsck:${entry.reachability}:${entry.objectType}:${entry.objectSha}`
    ])

  mkdirSync(output, { recursive: true })
  writeCsv(resolve(output, 'refs.csv'), [
    'source_kind',
    'source_id',
    'ref_name',
    'raw_object',
    'object_type',
    'commit_sha',
    'tree_sha',
    'state_id',
    'subject',
    'author',
    'author_date',
    'committer_date',
    'parents',
    'metadata_json',
    'error'
  ], sourceRows)
  writeCsv(resolve(output, 'states.csv'), [
    'state_id',
    'state_kind',
    'commit_sha',
    'tree_sha',
    'source_count',
    'source_ids',
    'source_kinds',
    'ref_names',
    'is_current_tree',
    'subject',
    'author',
    'author_date',
    'committer_date',
    'parents',
    'path_count',
    'difference_count',
    'current_missing_count',
    'historical_missing_count',
    'changed_count',
    'unchanged_count',
    'diff_error'
  ], stateRows)
  writeCsv(resolve(output, 'path-diffs.csv'), [
    'state_id',
    'tree_sha',
    'path',
    'status',
    'candidate_mode',
    'candidate_type',
    'candidate_blob',
    'candidate_size',
    'current_mode',
    'current_type',
    'current_blob',
    'current_size',
    'has_candidate',
    'has_current'
  ], pathDiffRows)
  writeCsv(resolve(output, 'path-decisions.csv'), [
    'path',
    'category',
    'category_set',
    'decision',
    'rationale',
    'status_set',
    'diff_row_count',
    'state_count',
    'tree_count',
    'sample_tree_shas',
    'sample_state_ids',
    'status_counts_json',
    'is_unclassified'
  ], pathDecisionRows)
  writeCsv(resolve(output, 'unreachable.csv'), ['reachability', 'object_type', 'object_sha', 'state_eligible', 'source_id'], fsckRows)
  writeCsv(resolve(output, 'sources.csv'), ['source_kind', 'path', 'status', 'size_bytes', 'sha256', 'details'], sourceInventoryRows(inventory))
  writeCsv(resolve(output, 'snapshot-evidence.csv'), [
    'snapshot',
    'evidence_file',
    'record_kind',
    'line_number',
    'path_a',
    'path_b',
    'raw'
  ], evidenceRows.map((row) => [
    row.snapshot,
    row.evidenceFile,
    row.recordKind,
    row.lineNumber,
    row.pathA,
    row.pathB,
    row.raw
  ]))

  const run = {
    reportVersion: REPORT_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    repository: ROOT,
    gitVersion,
    command: process.argv.slice(2),
    options,
    head,
    counts: {
      refs: refs.length,
      sourceRecords: sources.length,
      sourceErrors: sources.filter((source) => source.error).length,
      states: stateMap.size,
      uniqueTrees: new Set([...stateMap.values()].map((state) => state.treeSha)).size,
      pathRows: pathRows.length,
      changedPathRows: pathRows.filter((row) => row.status !== 'UNCHANGED').length,
      uniqueChangedPaths: new Set(pathRows.filter((row) => row.status === 'CHANGED').map((row) => row.path)).size,
      uniqueCurrentMissingPaths: new Set(pathRows.filter((row) => row.status === 'CURRENT_MISSING').map((row) => row.path)).size,
      uniqueHistoricalMissingPaths: new Set(pathRows.filter((row) => row.status === 'HISTORICAL_MISSING').map((row) => row.path)).size,
      pathDecisions: decisionSummary.pathCount,
      pathDecisionCategories: decisionSummary.categoryCounts,
      pathDecisionCategorySetCounts: decisionSummary.categorySetCounts,
      unclassifiedPathDecisions: decisionSummary.unclassifiedPathCount,
      unclassifiedRuntimeCandidates: decisionSummary.unclassifiedRuntimePathCount,
      fsckObjects: fsckEntries.length,
      snapshotEvidenceRecords: evidenceRows.length,
      warnings: warnings.length
    },
    pathClassifierVersion: PATH_CLASSIFIER_VERSION,
    files: ['report.md', 'refs.csv', 'states.csv', 'path-diffs.csv', 'path-decisions.csv', 'unreachable.csv', 'sources.csv', 'snapshot-evidence.csv', 'run.json']
  }
  writeJson(resolve(output, 'run.json'), run)
  writeFileSync(resolve(output, 'report.md'), renderReport({ options, output, startedAt, head, refs, sources, states: stateMap, pathRows, pathDecisions, inventory, fsckEntries, evidenceCount: evidenceRows.length, warnings }), 'utf8')

  console.log(`Audit report written to ${output}`)
  console.log(`States: ${stateMap.size}; unique trees: ${run.counts.uniqueTrees}; changed path rows: ${run.counts.changedPathRows}`)
  if (warnings.length > 0) console.warn(`Warnings: ${warnings.length} (see report.md and run.json)`)
}

try {
  main()
} catch (error) {
  if (process.exitCode !== 1) {
    console.error(`branch-state-audit: ${error.stack || error.message}`)
    process.exitCode = 1
  }
}
