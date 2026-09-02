import {
  CARD_CROP_FRAME_HEIGHT,
  CARD_CROP_FRAME_RATIO,
  CARD_CROP_FRAME_WIDTH,
  CARD_CROP_PROFILE,
  CARD_CROP_SCHEMA_VERSION,
  DEFAULT_CARD_CROP_TRANSFORM,
  normalizeCropTransform,
  type CardCropFit,
  type CardCropFrame,
  type CardCropSelection,
  type CardCropTransform
} from '@/lib/card-crop/types'
import {
  CONFIRMATION_HISTORY_LIMIT,
  CONFIRMATION_HISTORY_SCHEMA_VERSION,
  createConfirmationId,
  isNonEmptyString,
  trimConfirmationHistory
} from '@/lib/crop-editor/confirmation-history'

type EditorUsage = 'saying' | 'trace'
type FilterUsage = 'all' | EditorUsage
type FilterStatus = 'all' | 'pending' | 'confirmed' | 'neither'

interface CatalogItem {
  defaultFrame: CardCropFrame
  description: string
  filename: string
  key: string
  src: string
  usages: EditorUsage[]
}

interface CropState {
  fit: CardCropFit
  selection: CardCropSelection | 'pending'
  transforms: Record<CardCropFrame, CardCropTransform>
  confirmationHistory: Record<CardCropFrame, CardConfirmationSnapshot[]>
  preferredFrame?: CardCropFrame
  updatedAt?: string
}

interface CardConfirmationSnapshot {
  id: string
  confirmedAt: string
  frame: CardCropFrame
  fit: CardCropFit
  selection: CardCropSelection
  transforms: Record<CardCropFrame, CardCropTransform>
  preferredFrame?: CardCropFrame
}

type Draft = Record<string, CropState>

interface StoredPayload {
  schemaVersion?: number
  decisions?: Record<string, unknown>
  items?: Record<string, unknown>
}

interface PointerInteraction {
  before: string
  id: number
  startX: number
  startY: number
}

const FRAME_VALUES: readonly CardCropFrame[] = ['diagonal-left', 'diagonal-right']
const SELECTION_VALUES: Array<CropState['selection']> = [
  'pending',
  'diagonal-left',
  'diagonal-right',
  'both',
  'neither'
]
const FIT_VALUES: readonly CardCropFit[] = ['cover', 'contain']

const emptyConfirmationHistory = (): Record<CardCropFrame, CardConfirmationSnapshot[]> => ({
  'diagonal-left': [],
  'diagonal-right': []
})

type ConfirmedCardSelection = Exclude<CardCropSelection, 'neither'>

const isConfirmedSelection = (value: unknown): value is ConfirmedCardSelection =>
  value === 'diagonal-left' || value === 'diagonal-right' || value === 'both'

const sameCardTransform = (left: CardCropTransform, right: CardCropTransform): boolean =>
  left.x === right.x && left.y === right.y && left.zoom === right.zoom

const sameCardSnapshot = (state: CropState, snapshot: CardConfirmationSnapshot): boolean =>
  state.fit === snapshot.fit &&
  state.selection === snapshot.selection &&
  state.preferredFrame === snapshot.preferredFrame &&
  sameCardTransform(state.transforms['diagonal-left'], snapshot.transforms['diagonal-left']) &&
  sameCardTransform(state.transforms['diagonal-right'], snapshot.transforms['diagonal-right'])

const normalizeCardHistory = (
  value: unknown,
  state: Omit<CropState, 'confirmationHistory'>
): Record<CardCropFrame, CardConfirmationSnapshot[]> => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const history = emptyConfirmationHistory()

  for (const frame of FRAME_VALUES) {
    const entries = Array.isArray(source[frame]) ? source[frame] : []
    const normalized = entries.flatMap((entry, index) => {
      if (!entry || typeof entry !== 'object') return []
      const candidate = entry as Record<string, unknown>
      if (!isConfirmedSelection(candidate.selection)) return []
      const rawTransforms = candidate.transforms
      const transformRecord =
        rawTransforms && typeof rawTransforms === 'object'
          ? (rawTransforms as Record<string, unknown>)
          : {}
      const confirmedAt = isNonEmptyString(candidate.confirmedAt)
        ? candidate.confirmedAt
        : isNonEmptyString(candidate.updatedAt)
          ? candidate.updatedAt
          : undefined
      if (!confirmedAt) return []
      return [
        {
          id: isNonEmptyString(candidate.id)
            ? candidate.id
            : `legacy-${frame}-${confirmedAt}-${index}`,
          confirmedAt,
          frame: isFrame(candidate.frame) ? candidate.frame : frame,
          fit: isFit(candidate.fit) ? candidate.fit : state.fit,
          selection: candidate.selection,
          transforms: {
            'diagonal-left': normalizeTransform(transformRecord['diagonal-left']),
            'diagonal-right': normalizeTransform(transformRecord['diagonal-right'])
          },
          ...(isFrame(candidate.preferredFrame) ? { preferredFrame: candidate.preferredFrame } : {})
        }
      ]
    })
    history[frame] = trimConfirmationHistory(normalized)
  }

  // Seed a single recoverable version for old exports/production records that
  // carried a verdict but no history. Pending and “neither” remain empty.
  if (
    history['diagonal-left'].length === 0 &&
    (state.selection === 'diagonal-left' || state.selection === 'both')
  ) {
    history['diagonal-left'] = [createLegacyCardSnapshot(state, 'diagonal-left')]
  }
  if (
    history['diagonal-right'].length === 0 &&
    (state.selection === 'diagonal-right' || state.selection === 'both')
  ) {
    history['diagonal-right'] = [createLegacyCardSnapshot(state, 'diagonal-right')]
  }
  return history
}

const createLegacyCardSnapshot = (
  state: Omit<CropState, 'confirmationHistory'>,
  frame: CardCropFrame
): CardConfirmationSnapshot => ({
  id: `legacy-${frame}`,
  confirmedAt: state.updatedAt ?? '历史配置（时间未记录）',
  frame,
  fit: state.fit,
  selection: isConfirmedSelection(state.selection) ? state.selection : frame,
  transforms: {
    'diagonal-left': { ...state.transforms['diagonal-left'] },
    'diagonal-right': { ...state.transforms['diagonal-right'] }
  },
  ...(state.preferredFrame ? { preferredFrame: state.preferredFrame } : {})
})

/** Merge operation-undo snapshots without ever deleting semantic history. */
const mergeCardHistories = (
  fromSnapshot: Record<CardCropFrame, CardConfirmationSnapshot[]>,
  fromCurrent: Record<CardCropFrame, CardConfirmationSnapshot[]>
): Record<CardCropFrame, CardConfirmationSnapshot[]> => {
  const merged = emptyConfirmationHistory()
  for (const frame of FRAME_VALUES) {
    const seen = new Set<string>()
    const entries = [...(fromSnapshot[frame] ?? []), ...(fromCurrent[frame] ?? [])].filter(
      (entry) => {
        if (seen.has(entry.id)) return false
        seen.add(entry.id)
        return true
      }
    )
    merged[frame] = trimConfirmationHistory(entries)
  }
  return merged
}

const isFrame = (value: unknown): value is CardCropFrame =>
  FRAME_VALUES.includes(value as CardCropFrame)

const isFit = (value: unknown): value is CardCropFit => FIT_VALUES.includes(value as CardCropFit)

const isSelection = (value: unknown): value is CropState['selection'] =>
  SELECTION_VALUES.includes(value as CropState['selection'])

const defaultTransform = (): CardCropTransform => ({ ...DEFAULT_CARD_CROP_TRANSFORM })

const defaultState = (item: CatalogItem): CropState => ({
  fit: 'cover',
  selection: 'pending',
  transforms: {
    'diagonal-left': defaultTransform(),
    'diagonal-right': defaultTransform()
  },
  confirmationHistory: emptyConfirmationHistory(),
  preferredFrame: item.defaultFrame
})

const normalizeTransform = (value: unknown): CardCropTransform => {
  if (!value || typeof value !== 'object') return defaultTransform()
  const candidate = value as Record<string, unknown>
  return normalizeCropTransform({
    x: Number(candidate.x),
    y: Number(candidate.y),
    zoom: Number(candidate.zoom)
  })
}

const normalizeState = (value: unknown, item: CatalogItem): CropState => {
  const fallback = defaultState(item)
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Record<string, unknown>

  // v2 editor payload.
  if (isSelection(candidate.selection)) {
    const transforms = candidate.transforms
    const transformRecord =
      transforms && typeof transforms === 'object' ? (transforms as Record<string, unknown>) : {}
    const state: CropState = {
      fit: isFit(candidate.fit) ? candidate.fit : 'cover',
      preferredFrame: isFrame(candidate.preferredFrame)
        ? candidate.preferredFrame
        : fallback.preferredFrame,
      selection: candidate.selection,
      transforms: {
        'diagonal-left': normalizeTransform(transformRecord['diagonal-left']),
        'diagonal-right': normalizeTransform(transformRecord['diagonal-right'])
      },
      confirmationHistory: emptyConfirmationHistory(),
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined
    }
    state.confirmationHistory = normalizeCardHistory(candidate.confirmationHistory, state)
    return state
  }

  // Migrate the old side-by-side review format without losing the editor's
  // useful work. Old `left` meant “retain source left”; the new transform is
  // represented by x=0 while the existing diagonal remains the frame default.
  const oldVerdict = candidate.verdict
  const migratedSelection: CropState['selection'] =
    oldVerdict === 'left'
      ? (fallback.preferredFrame ?? 'diagonal-right')
      : oldVerdict === 'right'
        ? (fallback.preferredFrame ?? 'diagonal-right')
        : oldVerdict === 'both'
          ? 'both'
          : oldVerdict === 'neither'
            ? 'neither'
            : 'pending'
  const oldPosition = candidate.position
  const position =
    oldPosition && typeof oldPosition === 'object' ? (oldPosition as Record<string, unknown>) : {}
  const oldX = Number(position.x)
  const oldY = Number(position.y)
  const migratedTransform = normalizeCropTransform({
    x: Number.isFinite(oldX) ? oldX : oldVerdict === 'left' ? 0 : oldVerdict === 'right' ? 100 : 50,
    y: Number.isFinite(oldY) ? oldY : 50,
    zoom: 1
  })
  const state: CropState = {
    ...fallback,
    selection: migratedSelection,
    transforms: {
      'diagonal-left': migratedTransform,
      'diagonal-right': migratedTransform
    },
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined
  }
  state.confirmationHistory = normalizeCardHistory(candidate.confirmationHistory, state)
  return state
}

const parseCatalog = (root: HTMLElement): CatalogItem[] => {
  const script = root.querySelector<HTMLScriptElement>('[data-editor-catalog]')
  if (!script?.textContent) return []
  try {
    const value: unknown = JSON.parse(script.textContent)
    if (!Array.isArray(value)) return []
    return value.filter((item): item is CatalogItem => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Record<string, unknown>
      return (
        typeof candidate.filename === 'string' &&
        typeof candidate.src === 'string' &&
        typeof candidate.description === 'string' &&
        isFrame(candidate.defaultFrame) &&
        Array.isArray(candidate.usages)
      )
    })
  } catch {
    return []
  }
}

const payloadSource = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {}
  const root = value as StoredPayload & Record<string, unknown>
  if (root.items && typeof root.items === 'object') return root.items
  if (root.decisions && typeof root.decisions === 'object') return root.decisions
  return root
}

const selectionStatus = (state: CropState): FilterStatus => {
  if (state.selection === 'pending') return 'pending'
  if (state.selection === 'neither') return 'neither'
  return 'confirmed'
}

const selectionLabel = (state: CropState): string => {
  if (state.selection === 'pending') return '待处理'
  if (state.selection === 'neither') return '两个框都不合适'
  if (state.selection === 'both') return '两个框都可以'
  return state.selection === 'diagonal-left' ? '已确认 · 斜边在左' : '已确认 · 斜边在右'
}

const frameLabel = (frame: CardCropFrame): string =>
  frame === 'diagonal-left' ? '斜边在左' : '斜边在右'

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null
  return Boolean(element?.matches('input, textarea, select, button, [contenteditable="true"]'))
}

/** Install the editor once for the current Astro page. */
export function bootCardCropEditor(): void {
  const root = document.querySelector<HTMLElement>('[data-card-crop-editor]')
  if (!root || root.dataset.initialized === 'true') return
  root.dataset.initialized = 'true'

  const catalog = parseCatalog(root)
  if (catalog.length === 0) return

  const byFilename = new Map(catalog.map((item) => [item.filename, item]))
  const resolveFilename = (key: string): string | undefined => {
    if (byFilename.has(key)) return key
    const suffix = key.split(':').pop()
    return suffix && byFilename.has(suffix) ? suffix : undefined
  }
  const storageKey = root.dataset.storageKey ?? 'susurrium:card-crop-editor:v2'
  const oldStorageKey = 'susurrium:card-crop-review:v1'
  const draft: Draft = {}
  let activeFilename = catalog[0].filename
  let activeFrame: CardCropFrame = catalog[0].defaultFrame
  let usageFilter: FilterUsage = 'all'
  let statusFilter: FilterStatus = 'all'
  let search = ''
  let undoStack: string[] = []
  let redoStack: string[] = []
  let pointerInteraction: PointerInteraction | undefined
  let saveMessageTimer: number | undefined
  let historyOpen = false
  let historyRenderKey = ''

  const ensureState = (filename: string): CropState => {
    const item = byFilename.get(filename)
    if (!item) return defaultState(catalog[0])
    if (!draft[filename]) draft[filename] = defaultState(item)
    return draft[filename]
  }

  const loadStored = (key: string): Record<string, unknown> | undefined => {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return undefined
      return payloadSource(JSON.parse(raw))
    } catch {
      return undefined
    }
  }

  const loadEmbedded = (): Record<string, unknown> | undefined => {
    const script = root.querySelector<HTMLScriptElement>('[data-editor-initial]')
    if (!script?.textContent) return undefined
    try {
      return payloadSource(JSON.parse(script.textContent))
    } catch {
      return undefined
    }
  }

  const embedded = loadEmbedded()
  if (embedded) {
    for (const [key, value] of Object.entries(embedded)) {
      const filename = resolveFilename(key)
      const item = filename ? byFilename.get(filename) : undefined
      if (filename && item) draft[filename] = normalizeState(value, item)
    }
  }

  // A local draft intentionally wins over checked-in production defaults: it
  // lets an editor resume an unfinished session without changing the build.
  const stored = loadStored(storageKey) ?? loadStored(oldStorageKey)
  if (stored) {
    for (const [key, value] of Object.entries(stored)) {
      const filename = resolveFilename(key)
      const item = filename ? byFilename.get(filename) : undefined
      if (filename && item) draft[filename] = normalizeState(value, item)
    }
  }

  activeFrame = ensureState(activeFilename).preferredFrame ?? catalog[0].defaultFrame

  const persist = () => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          exportedAt: new Date().toISOString(),
          items: draft,
          confirmationHistoryVersion: CONFIRMATION_HISTORY_SCHEMA_VERSION,
          schemaVersion: CARD_CROP_SCHEMA_VERSION
        })
      )
      root.dataset.storageUnavailable = 'false'
      setSaveMessage('已自动保存')
    } catch {
      root.dataset.storageUnavailable = 'true'
      setSaveMessage('浏览器存储不可用，请及时导出配置')
    }
  }

  const setSaveMessage = (message: string) => {
    const element = root.querySelector<HTMLElement>('[data-editor-save-state]')
    if (!element) return
    element.textContent = message
    if (saveMessageTimer !== undefined) window.clearTimeout(saveMessageTimer)
    saveMessageTimer = window.setTimeout(() => {
      element.textContent = '自动保存已开启'
    }, 1800)
  }

  const draftSnapshot = (): string => JSON.stringify(draft)

  const restoreSnapshot = (snapshot: string) => {
    const restored: unknown = JSON.parse(snapshot)
    const source = payloadSource(restored)
    const currentHistory = new Map(
      Object.entries(draft).map(([filename, state]) => [filename, state.confirmationHistory])
    )
    for (const filename of catalog.map((item) => item.filename)) delete draft[filename]
    for (const [filename, value] of Object.entries(source)) {
      const item = byFilename.get(filename)
      if (!item) continue
      const restoredState = normalizeState(value, item)
      const previous = currentHistory.get(filename)
      if (previous)
        restoredState.confirmationHistory = mergeCardHistories(
          restoredState.confirmationHistory,
          previous
        )
      draft[filename] = restoredState
    }
  }

  const recordHistory = (before: string) => {
    if (before === draftSnapshot()) return
    undoStack = [...undoStack, before].slice(-60)
    redoStack = []
  }

  const updateHistoryButtons = () => {
    const undo = root.querySelector<HTMLButtonElement>('[data-editor-action="undo"]')
    const redo = root.querySelector<HTMLButtonElement>('[data-editor-action="redo"]')
    if (undo) undo.disabled = undoStack.length === 0
    if (redo) redo.disabled = redoStack.length === 0
  }

  const activeItem = (): CatalogItem => byFilename.get(activeFilename) ?? catalog[0]
  const activeState = (): CropState => ensureState(activeFilename)
  const activeTransform = (): CardCropTransform => activeState().transforms[activeFrame]

  const formatConfirmationTime = (value: string): string => {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return '时间未记录'
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const cloneConfirmationSnapshot = (
    state: CropState,
    frame: CardCropFrame,
    selection: CardCropSelection,
    confirmedAt: string
  ): CardConfirmationSnapshot => ({
    id: createConfirmationId(`card-${frame}`),
    confirmedAt,
    frame,
    fit: state.fit,
    selection,
    transforms: {
      'diagonal-left': { ...state.transforms['diagonal-left'] },
      'diagonal-right': { ...state.transforms['diagonal-right'] }
    },
    ...(state.preferredFrame ? { preferredFrame: state.preferredFrame } : {})
  })

  const appendConfirmation = (
    state: CropState,
    selection: CardCropSelection,
    confirmedAt: string,
    force = false
  ) => {
    if (!isConfirmedSelection(selection)) return
    const targets: readonly CardCropFrame[] = selection === 'both' ? FRAME_VALUES : [selection]
    for (const frame of targets) {
      const history = state.confirmationHistory[frame] ?? []
      const latest = history[history.length - 1]
      if (!force && latest && sameCardSnapshot(state, latest)) continue
      history.push(cloneConfirmationSnapshot(state, frame, selection, confirmedAt))
      state.confirmationHistory[frame] = history.slice(-CONFIRMATION_HISTORY_LIMIT)
    }
  }

  const applyConfirmationSnapshot = (state: CropState, snapshot: CardConfirmationSnapshot) => {
    state.fit = snapshot.fit
    state.transforms = {
      'diagonal-left': { ...snapshot.transforms['diagonal-left'] },
      'diagonal-right': { ...snapshot.transforms['diagonal-right'] }
    }
    state.preferredFrame = snapshot.preferredFrame ?? snapshot.frame
  }

  const renderConfirmationHistory = () => {
    const state = activeState()
    const history = state.confirmationHistory[activeFrame] ?? []
    const latest = history[history.length - 1]
    const restoreLatestButton = root.querySelector<HTMLButtonElement>(
      '[data-editor-action="restore-latest"]'
    )
    const toggle = root.querySelector<HTMLButtonElement>('[data-editor-action="toggle-history"]')
    const panel = root.querySelector<HTMLElement>('[data-editor-history-panel]')
    const list = root.querySelector<HTMLOListElement>('[data-editor-history-list]')
    const latestLabel = root.querySelector<HTMLElement>('[data-editor-latest-label]')

    if (restoreLatestButton) {
      restoreLatestButton.disabled = !(
        latest &&
        (!sameCardSnapshot(state, latest) || selectionStatus(state) !== 'confirmed')
      )
    }
    if (toggle) {
      toggle.disabled = history.length === 0
      toggle.textContent = history.length > 0 ? `查看确认历史（${history.length}）` : '查看确认历史'
      toggle.setAttribute('aria-expanded', String(historyOpen))
    }
    if (panel) panel.hidden = !historyOpen || history.length === 0
    if (latestLabel) {
      latestLabel.textContent = latest
        ? `最近确认：${formatConfirmationTime(latest.confirmedAt)}`
        : '当前斜边还没有确认版本'
    }
    if (!list) return
    const renderKey = `${activeFilename}|${activeFrame}|${historyOpen}|${history.map((entry) => entry.id).join('|')}`
    if (renderKey === historyRenderKey) return
    historyRenderKey = renderKey
    list.replaceChildren()
    if (history.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'card-crop-editor__history-empty'
      empty.textContent = '当前斜边还没有确认记录。确认后会自动保留版本。'
      list.append(empty)
      return
    }

    history
      .map((entry, index) => ({ entry, index }))
      .reverse()
      .forEach(({ entry, index }) => {
        const row = document.createElement('li')
        row.className = 'card-crop-editor__history-item'

        const copy = document.createElement('div')
        copy.className = 'card-crop-editor__history-copy'
        const title = document.createElement('strong')
        title.textContent = `${index === history.length - 1 ? '最近确认' : `第 ${index + 1} 次确认`} · ${formatConfirmationTime(entry.confirmedAt)}`
        const detail = document.createElement('small')
        detail.textContent = `${entry.selection === 'both' ? '两个框都可以' : frameLabel(entry.frame)} · ${entry.fit === 'contain' ? '完整显示' : '填满裁剪框'} · 焦点 ${Math.round(entry.transforms[activeFrame].x)}% / ${Math.round(entry.transforms[activeFrame].y)}% · 缩放 ${Math.round(entry.transforms[activeFrame].zoom * 100)}%`
        copy.append(title, detail)

        const actions = document.createElement('div')
        actions.className = 'card-crop-editor__history-actions'
        const load = document.createElement('button')
        load.type = 'button'
        load.textContent = '载入草稿'
        load.dataset.editorHistoryIndex = String(index)
        load.dataset.editorHistoryMode = 'draft'
        const restore = document.createElement('button')
        restore.type = 'button'
        restore.className = 'is-primary'
        restore.textContent = '恢复并确认'
        restore.dataset.editorHistoryIndex = String(index)
        restore.dataset.editorHistoryMode = 'confirm'
        actions.append(load, restore)
        row.append(copy, actions)
        list.append(row)
      })
  }

  const syncCanvasRatio = () => {
    const previewCover = root.querySelector<HTMLElement>(
      '[data-editor-card-preview] .media-card__cover'
    )
    if (!previewCover) return
    const { width, height } = previewCover.getBoundingClientRect()
    if (width > 0 && height > 0) {
      root.style.setProperty('--editor-canvas-ratio', String(width / height))
    }
  }

  const renderCanvas = () => {
    const state = activeState()
    const transform = state.transforms[activeFrame]
    const imageWindow = root.querySelector<HTMLElement>('[data-editor-image-window]')
    const image = imageWindow?.querySelector<HTMLImageElement>('[data-media-image]') ?? null
    const cardPreview = root.querySelector<HTMLElement>('[data-editor-card-preview]')
    const previewCover = cardPreview?.querySelector<HTMLElement>('.media-card__cover') ?? null
    const preview =
      cardPreview?.querySelector<HTMLImageElement>('.card-crop-editor__preview-image') ?? null
    const zoomInput = root.querySelector<HTMLInputElement>('[data-editor-zoom]')
    const zoomValue = root.querySelector<HTMLOutputElement>('[data-editor-zoom-value]')
    const coordinates = root.querySelector<HTMLElement>('[data-editor-coordinates]')
    const previewLabel = root.querySelector<HTMLElement>('[data-editor-preview-label]')

    const syncMediaFrame = (frameElement: HTMLElement | null) => {
      if (!frameElement) return
      const mask = activeFrame === 'diagonal-left' ? 'left' : 'right'
      frameElement.dataset.frame = activeFrame
      frameElement.dataset.mediaFrame = activeFrame
      frameElement.dataset.mediaMask = mask
      frameElement.dataset.fit = state.fit
      frameElement.style.setProperty('--card-media-fit', state.fit)
      frameElement.classList.toggle('card-media-frame--left', mask === 'left')
      frameElement.classList.toggle('card-media-frame--right', mask === 'right')
    }
    syncMediaFrame(imageWindow)
    if (cardPreview) {
      const cutSide = activeFrame === 'diagonal-left' ? 'left' : 'right'
      cardPreview.dataset.frame = activeFrame
      cardPreview.dataset.cardCropFrame = activeFrame
      cardPreview.dataset.cardCutSide = cutSide
      cardPreview.dataset.cardImageSide = cutSide === 'left' ? 'right' : 'left'
      cardPreview.dataset.cardLayoutVariant =
        cutSide === 'left' ? 'image-right-diagonal-left' : 'image-left-diagonal-right'
      cardPreview.dataset.cardImageFit = state.fit
      cardPreview.dataset.cardImagePosition = `${transform.x}% ${transform.y}%`
      cardPreview.dataset.cardImageZoom = String(transform.zoom)
      cardPreview.dataset.cardImageOrigin = `${transform.x}% ${transform.y}%`
      cardPreview.style.setProperty('--media-card-image-fit', state.fit)
      cardPreview.style.setProperty(
        '--media-card-image-position',
        `${transform.x}% ${transform.y}%`
      )
      cardPreview.style.setProperty('--media-card-image-zoom', String(transform.zoom))
      cardPreview.style.setProperty(
        '--media-card-image-origin',
        `${transform.x}% ${transform.y}%`
      )
      cardPreview.classList.toggle('is-cut-left', cutSide === 'left')
    }
    syncMediaFrame(previewCover)

    const position = `${transform.x}% ${transform.y}%`
    if (image) {
      image.style.objectPosition = position
      image.style.transformOrigin = position
      image.style.transform = `scale(${transform.zoom})`
    }
    if (preview) {
      preview.style.objectPosition = position
      preview.style.transformOrigin = position
      preview.style.transform = `scale(${transform.zoom})`
    }
    if (zoomInput) zoomInput.value = String(transform.zoom)
    if (zoomValue) zoomValue.value = `${Math.round(transform.zoom * 100)}%`
    if (coordinates)
      coordinates.textContent = `焦点 ${Math.round(transform.x)}% / ${Math.round(transform.y)}%`
    if (previewLabel) previewLabel.textContent = frameLabel(activeFrame)

    /* Keep the editing canvas on the same media ratio as the production card. */
    syncCanvasRatio()

    root.querySelectorAll<HTMLButtonElement>('[data-editor-frame]').forEach((button) => {
      const selected = button.dataset.editorFrame === activeFrame
      button.classList.toggle('is-active', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    root.querySelectorAll<HTMLButtonElement>('[data-editor-fit]').forEach((button) => {
      const selected = button.dataset.editorFit === state.fit
      button.classList.toggle('is-active', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    renderConfirmationHistory()
    updateHistoryButtons()
  }

  const renderQueue = () => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    let visible = 0
    let confirmed = 0
    let pending = 0

    catalog.forEach((item) => {
      const state = ensureState(item.filename)
      const status = selectionStatus(state)
      if (status === 'confirmed') confirmed += 1
      if (status === 'pending') pending += 1
      const text = `${item.filename} ${item.description}`.toLocaleLowerCase()
      const matchesSearch = !normalizedSearch || text.includes(normalizedSearch)
      const matchesUsage = usageFilter === 'all' || item.usages.includes(usageFilter)
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      const shown = matchesSearch && matchesUsage && matchesStatus
      const queueItem = root.querySelector<HTMLElement>(
        `[data-editor-queue-item][data-editor-filename="${CSS.escape(item.filename)}"]`
      )
      if (!queueItem) return
      queueItem.hidden = !shown
      if (shown) visible += 1
      const button = queueItem.querySelector<HTMLButtonElement>('[data-editor-select]')
      const statusElement = queueItem.querySelector<HTMLElement>('[data-editor-item-status]')
      if (button) {
        const active = item.filename === activeFilename
        button.classList.toggle('is-active', active)
        if (active) button.setAttribute('aria-current', 'true')
        else button.removeAttribute('aria-current')
        button.dataset.editorStatus = status
      }
      if (statusElement) statusElement.textContent = selectionLabel(state)
    })

    const total = catalog.length
    const progress = root.querySelector<HTMLElement>('[data-editor-progress]')
    const pendingElement = root.querySelector<HTMLElement>('[data-editor-pending]')
    const visibleElement = root.querySelector<HTMLElement>('[data-editor-visible-count]')
    const emptyElement = root.querySelector<HTMLElement>('[data-editor-queue-empty]')
    if (progress) progress.textContent = `已确认 ${confirmed} / ${total}`
    if (pendingElement) pendingElement.textContent = `待处理 ${pending} 张`
    if (visibleElement) visibleElement.textContent = `${visible} 张`
    if (emptyElement) emptyElement.hidden = visible !== 0
    updateHistoryButtons()
  }

  const renderActive = () => {
    const item = activeItem()
    const state = activeState()
    const sourceImage =
      root
        .querySelector<HTMLElement>('[data-editor-image-window]')
        ?.querySelector<HTMLImageElement>('[data-media-image]') ?? null
    const previewCard = root.querySelector<HTMLElement>('[data-editor-card-preview]')
    const previewImage =
      previewCard?.querySelector<HTMLImageElement>('.card-crop-editor__preview-image') ?? null
    const assetName = root.querySelector<HTMLElement>('[data-editor-asset-name]')
    const assetDescription = root.querySelector<HTMLElement>('[data-editor-asset-description]')
    const assetUsage = root.querySelector<HTMLElement>('[data-editor-asset-usage]')
    const assetStatus = root.querySelector<HTMLElement>('[data-editor-asset-status]')
    const previewTitle = previewCard?.querySelector<HTMLElement>('[data-card-title]') ?? null
    const previewFooter = previewCard?.querySelector<HTMLElement>('[data-card-footer]') ?? null
    const decisionHeading = root.querySelector<HTMLElement>('[data-editor-decision-heading]')
    const decisionHelp = root.querySelector<HTMLElement>('[data-editor-decision-help]')

    if (sourceImage) {
      sourceImage.src = item.src
      sourceImage.alt = item.description
    }
    if (previewImage) {
      previewImage.src = item.src
      previewImage.alt = ''
    }
    if (previewCard) {
      previewCard.dataset.imageKey = item.key
      previewCard.dataset.imageFile = item.filename
      previewCard.dataset.imageSource = item.usages.includes('trace') ? 'fallback' : 'decorative'
    }
    if (previewImage) previewImage.dataset.imageKey = item.key
    if (assetName) assetName.textContent = item.filename
    if (assetDescription) assetDescription.textContent = item.description
    if (assetUsage)
      assetUsage.textContent = item.usages.map((usage) => usage.toUpperCase()).join(' · ')
    if (assetStatus) {
      assetStatus.textContent = selectionLabel(state)
      assetStatus.dataset.status = selectionStatus(state)
    }
    if (previewTitle) previewTitle.textContent = item.filename
    if (previewFooter) previewFooter.textContent = selectionLabel(state)
    if (decisionHeading) {
      decisionHeading.textContent =
        state.selection === 'pending' ? '确认当前框' : selectionLabel(state)
    }
    if (decisionHelp) {
      decisionHelp.textContent =
        state.selection === 'pending'
          ? `当前正在编辑“${frameLabel(activeFrame)}”。确认后会保存当前斜边、焦点、缩放和适配方式。`
          : '仍可切换另一种框继续微调；再次确认会覆盖该素材的当前决策。'
    }

    root.dataset.activeFrame = activeFrame
    root.dataset.activeFilename = item.filename
    renderCanvas()
    renderQueue()
  }

  const render = () => {
    renderActive()
  }

  const mutate = (operation: () => void, before = draftSnapshot()) => {
    operation()
    if (before !== draftSnapshot()) {
      recordHistory(before)
      persist()
      render()
    }
  }

  const setTransform = (next: Partial<CardCropTransform>, record = true) => {
    const state = activeState()
    const current = state.transforms[activeFrame]
    const normalized = normalizeCropTransform({ ...current, ...next })
    if (
      normalized.x === current.x &&
      normalized.y === current.y &&
      normalized.zoom === current.zoom
    )
      return
    const before = record ? draftSnapshot() : undefined
    state.transforms[activeFrame] = normalized
    // A confirmed verdict describes the exact transform that was reviewed.
    // Any later pan/zoom makes that verdict stale until the user confirms it
    // again, preventing an accidental edit from reaching production.
    state.selection = 'pending'
    state.updatedAt = new Date().toISOString()
    if (record && before !== undefined) {
      recordHistory(before)
      persist()
    }
    renderCanvas()
    renderQueue()
  }

  const setActive = (filename: string, frame?: CardCropFrame) => {
    if (!byFilename.has(filename)) return
    activeFilename = filename
    const item = byFilename.get(filename)
    const saved = ensureState(filename)
    activeFrame = frame ?? saved.preferredFrame ?? item?.defaultFrame ?? 'diagonal-right'
    render()
    root.querySelector<HTMLElement>('[data-editor-canvas]')?.focus({ preventScroll: true })
  }

  const visibleFilenames = (): string[] =>
    catalog
      .filter((item) => {
        const state = ensureState(item.filename)
        const status = selectionStatus(state)
        const text = `${item.filename} ${item.description}`.toLocaleLowerCase()
        return (
          (!search.trim() || text.includes(search.trim().toLocaleLowerCase())) &&
          (usageFilter === 'all' || item.usages.includes(usageFilter)) &&
          (statusFilter === 'all' || status === statusFilter)
        )
      })
      .map((item) => item.filename)

  const move = (direction: 1 | -1, unresolvedOnly = false) => {
    const visible = visibleFilenames()
    if (visible.length === 0) return
    const candidates = unresolvedOnly
      ? visible.filter((filename) => selectionStatus(ensureState(filename)) === 'pending')
      : visible
    if (candidates.length === 0) return
    const current = candidates.indexOf(activeFilename)
    const index =
      current < 0
        ? direction === 1
          ? 0
          : candidates.length - 1
        : (current + direction + candidates.length) % candidates.length
    setActive(candidates[index])
  }

  const confirm = (selection: CardCropSelection, goNext = false) => {
    const before = draftSnapshot()
    const state = activeState()
    const confirmedAt = new Date().toISOString()
    state.selection = selection
    state.preferredFrame = activeFrame
    state.updatedAt = confirmedAt
    appendConfirmation(state, selection, confirmedAt)
    recordHistory(before)
    persist()
    render()
    if (goNext) move(1, true)
  }

  const restoreLatest = () => {
    const state = activeState()
    const history = state.confirmationHistory[activeFrame] ?? []
    const latest = history[history.length - 1]
    if (!latest) {
      setSaveMessage('当前斜边还没有可恢复的确认版本')
      return
    }
    if (selectionStatus(state) === 'confirmed' && sameCardSnapshot(state, latest)) {
      setSaveMessage('当前已经是最近一次确认版本')
      return
    }
    if (!window.confirm('恢复最近一次确认吗？当前未确认的调整会进入撤销记录。')) return
    const before = draftSnapshot()
    applyConfirmationSnapshot(state, latest)
    state.selection = latest.selection
    state.updatedAt = new Date().toISOString()
    recordHistory(before)
    persist()
    render()
    setSaveMessage('已恢复最近一次确认版本')
  }

  const restoreHistory = (index: number, confirmImmediately: boolean) => {
    const state = activeState()
    const history = state.confirmationHistory[activeFrame] ?? []
    const historySnapshot = history[index]
    if (!historySnapshot) return
    const time = formatConfirmationTime(historySnapshot.confirmedAt)
    const actionText = confirmImmediately ? '恢复并确认' : '载入为待确认草稿'
    if (!window.confirm(`${actionText}（${time}）吗？当前调整会进入撤销记录。`)) return

    const before = draftSnapshot()
    applyConfirmationSnapshot(state, historySnapshot)
    state.selection = confirmImmediately ? historySnapshot.selection : 'pending'
    const restoredAt = new Date().toISOString()
    state.updatedAt = restoredAt
    if (confirmImmediately) appendConfirmation(state, historySnapshot.selection, restoredAt, true)
    recordHistory(before)
    persist()
    render()
    setSaveMessage(confirmImmediately ? '已恢复并确认历史版本' : '已载入历史版本，请检查后再确认')
  }

  /**
   * Remove only the editorial verdict.  The two transforms, fit mode and
   * preferred frame are deliberately retained so an editor can re-review a
   * large batch without losing the work already done on each image.
   */
  const clearConfirmations = () => {
    const confirmedItems = catalog.filter((item) => {
      const selection = ensureState(item.filename).selection
      return selection === 'diagonal-left' || selection === 'diagonal-right' || selection === 'both'
    })
    if (confirmedItems.length === 0) {
      setSaveMessage('当前没有已确认的素材')
      return
    }
    if (
      !window.confirm(
        `确定取消 ${confirmedItems.length} 张素材的全部确认吗？焦点、缩放、适配方式和斜边草稿会保留，正式页面不会被直接修改。`
      )
    )
      return

    const before = draftSnapshot()
    for (const item of confirmedItems) {
      const state = ensureState(item.filename)
      state.selection = 'pending'
      state.updatedAt = new Date().toISOString()
    }
    recordHistory(before)
    persist()
    render()
    setSaveMessage(`已取消 ${confirmedItems.length} 张素材的确认`)
  }

  const resetTransform = () => {
    setTransform(defaultTransform())
    root.querySelector<HTMLElement>('[data-editor-canvas]')?.classList.remove('is-interacted')
  }

  const download = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const exportDraft = () => {
    download('card-crop-editor-v2.json', {
      exportedAt: new Date().toISOString(),
      confirmationHistoryVersion: CONFIRMATION_HISTORY_SCHEMA_VERSION,
      profile: CARD_CROP_PROFILE,
      scope: {
        primaryScenes: ['sayings', 'traces'],
        auxiliaryScenes: ['home'],
        mobileFocus: 'same-transform',
        sceneOverrides: 'explicit-only',
        cropRects: 'reference-only'
      },
      frame: {
        height: CARD_CROP_FRAME_HEIGHT,
        ratio: CARD_CROP_FRAME_RATIO,
        width: CARD_CROP_FRAME_WIDTH
      },
      items: draft,
      schemaVersion: CARD_CROP_SCHEMA_VERSION
    })
    setSaveMessage('已导出当前配置')
  }

  const undo = () => {
    const previous = undoStack.pop()
    if (!previous) return
    redoStack.push(draftSnapshot())
    restoreSnapshot(previous)
    persist()
    render()
  }

  const redo = () => {
    const next = redoStack.pop()
    if (!next) return
    undoStack.push(draftSnapshot())
    restoreSnapshot(next)
    persist()
    render()
  }

  const importPayload = (value: unknown) => {
    const profile =
      value && typeof value === 'object' ? (value as Record<string, unknown>).profile : undefined
    if (profile !== undefined && profile !== CARD_CROP_PROFILE) {
      window.alert(`导入失败：这是“${String(profile)}”配置，不是 ${CARD_CROP_PROFILE} 卡片配置。`)
      return
    }
    const source = payloadSource(value)
    const before = draftSnapshot()
    let imported = 0
    for (const [filename, candidate] of Object.entries(source)) {
      const item = byFilename.get(filename)
      if (!item) continue
      draft[filename] = normalizeState(candidate, item)
      imported += 1
    }
    if (imported === 0) {
      window.alert('没有找到可导入的已知素材。请确认这是本工具导出的 JSON。')
      return
    }
    recordHistory(before)
    persist()
    render()
    setSaveMessage(`已导入 ${imported} 张素材`)
  }

  const canvas = root.querySelector<HTMLElement>('[data-editor-canvas]')
  if (canvas) {
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      const before = draftSnapshot()
      pointerInteraction = {
        before,
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY
      }
      canvas.classList.add('is-dragging', 'is-interacted')
      canvas.setPointerCapture(event.pointerId)
    })

    canvas.addEventListener('pointermove', (event) => {
      if (!pointerInteraction || event.pointerId !== pointerInteraction.id) return
      const rect = canvas.getBoundingClientRect()
      const dx = event.clientX - pointerInteraction.startX
      const dy = event.clientY - pointerInteraction.startY
      // object-position 0% aligns the source's left/top edge; dragging the
      // image right/down therefore decreases the position percentage.
      setTransform(
        {
          x: activeTransform().x - (dx / Math.max(1, rect.width)) * 100,
          y: activeTransform().y - (dy / Math.max(1, rect.height)) * 100
        },
        false
      )
      pointerInteraction.startX = event.clientX
      pointerInteraction.startY = event.clientY
    })

    const finishPointer = (event: PointerEvent) => {
      if (!pointerInteraction || event.pointerId !== pointerInteraction.id) return
      const before = pointerInteraction.before
      pointerInteraction = undefined
      canvas.classList.remove('is-dragging')
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      recordHistory(before)
      persist()
      render()
    }
    canvas.addEventListener('pointerup', finishPointer)
    canvas.addEventListener('pointercancel', finishPointer)

    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        canvas.classList.add('is-interacted')
        const before = draftSnapshot()
        const amount = event.deltaY < 0 ? 0.1 : -0.1
        setTransform({ zoom: activeTransform().zoom + amount }, false)
        recordHistory(before)
        persist()
        render()
      },
      { passive: false }
    )

    canvas.addEventListener('keydown', (event) => {
      if (
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown'
      ) {
        event.preventDefault()
        canvas.classList.add('is-interacted')
        const step = event.shiftKey ? 5 : 2
        const transform = activeTransform()
        setTransform({
          x:
            transform.x +
            (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
          y: transform.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)
        })
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setTransform({ zoom: activeTransform().zoom + 0.1 })
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setTransform({ zoom: activeTransform().zoom - 0.1 })
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        resetTransform()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        confirm(activeFrame, true)
      }
    })
  }

  root.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-editor-card-preview] a')) {
      event.preventDefault()
      return
    }
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('button, [data-editor-select]')
        : null
    if (!target) return

    const filename = target.dataset.editorSelect
    if (filename) {
      setActive(filename)
      return
    }

    const frame = target.dataset.editorFrame
    if (isFrame(frame)) {
      activeFrame = frame
      renderCanvas()
      renderActive()
      return
    }

    const fit = target.dataset.editorFit
    if (isFit(fit)) {
      mutate(() => {
        activeState().fit = fit
        activeState().selection = 'pending'
        activeState().updatedAt = new Date().toISOString()
      })
      return
    }

    const usage = target.dataset.editorUsage
    if (usage === 'all' || usage === 'saying' || usage === 'trace') {
      usageFilter = usage
      root.querySelectorAll<HTMLButtonElement>('[data-editor-usage]').forEach((button) => {
        const selected = button.dataset.editorUsage === usageFilter
        button.classList.toggle('is-active', selected)
        button.setAttribute('aria-pressed', String(selected))
      })
      renderQueue()
      return
    }

    const status = target.dataset.editorStatus
    if (
      status === 'all' ||
      status === 'pending' ||
      status === 'confirmed' ||
      status === 'neither'
    ) {
      statusFilter = status
      root
        .querySelectorAll<HTMLButtonElement>('.card-crop-editor__segmented [data-editor-status]')
        .forEach((button) => {
          const selected = button.dataset.editorStatus === statusFilter
          button.classList.toggle('is-active', selected)
          button.setAttribute('aria-pressed', String(selected))
        })
      renderQueue()
      return
    }

    const historyIndex = target.dataset.editorHistoryIndex
    if (historyIndex !== undefined) {
      const index = Number(historyIndex)
      if (!Number.isInteger(index)) return
      restoreHistory(index, target.dataset.editorHistoryMode === 'confirm')
      return
    }

    const action = target.dataset.editorAction
    if (!action) return
    if (action === 'undo') return undo()
    if (action === 'redo') return redo()
    if (action === 'export') return exportDraft()
    if (action === 'import') {
      root.querySelector<HTMLInputElement>('[data-editor-import]')?.click()
      return
    }
    if (action === 'clear-confirmations') return clearConfirmations()
    if (action === 'restore-latest') return restoreLatest()
    if (action === 'toggle-history') {
      historyOpen = !historyOpen
      return render()
    }
    if (action === 'clear') {
      if (
        !window.confirm(`确定清空这 ${catalog.length} 张素材的裁剪草稿吗？正式页面不会受到影响。`)
      )
        return
      const before = draftSnapshot()
      for (const filename of Object.keys(draft)) delete draft[filename]
      recordHistory(before)
      persist()
      render()
      return
    }
    if (action === 'zoom-in') return setTransform({ zoom: activeTransform().zoom + 0.1 })
    if (action === 'zoom-out') return setTransform({ zoom: activeTransform().zoom - 0.1 })
    if (action === 'reset-transform') return resetTransform()
    if (action === 'confirm-frame') return confirm(activeFrame)
    if (action === 'confirm-both') return confirm('both')
    if (action === 'confirm-neither') return confirm('neither')
    if (action === 'confirm-next') return confirm(activeFrame, true)
    if (action === 'previous') return move(-1)
    if (action === 'next') return move(1)
  })

  root
    .querySelector<HTMLInputElement>('[data-editor-search]')
    ?.addEventListener('input', (event) => {
      search = (event.target as HTMLInputElement).value
      renderQueue()
    })

  root.querySelector<HTMLInputElement>('[data-editor-zoom]')?.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement
    setTransform({ zoom: Number(input.value) })
  })

  root
    .querySelector<HTMLInputElement>('[data-editor-import]')
    ?.addEventListener('change', async (event) => {
      const input = event.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return
      try {
        importPayload(JSON.parse(await file.text()))
      } catch {
        window.alert('导入失败：文件不是有效的裁剪配置 JSON。')
      } finally {
        input.value = ''
      }
    })

  /* The archive card keeps a fixed height while its width changes with the
     viewport. Observe the real preview so the editing canvas follows that
     profile on resize instead of silently reverting to the old 640×448 ratio. */
  let ratioObserver: ResizeObserver | undefined
  if (typeof ResizeObserver !== 'undefined') {
    ratioObserver = new ResizeObserver(() => syncCanvasRatio())
    const previewCover = root.querySelector<HTMLElement>(
      '[data-editor-card-preview] .media-card__cover'
    )
    if (previewCover) ratioObserver.observe(previewCover)
  }
  const cleanup = () => {
    ratioObserver?.disconnect()
    ratioObserver = undefined
  }
  document.addEventListener('astro:before-swap', cleanup, { once: true })

  // Keep keyboard shortcuts scoped to the workbench and never hijack typing
  // in the search field or controls.
  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return
    if (event.key === 'Enter') {
      event.preventDefault()
      confirm(activeFrame, true)
    }
  })

  render()
}
