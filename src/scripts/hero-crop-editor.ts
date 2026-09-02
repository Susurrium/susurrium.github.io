import {
  CONFIRMATION_HISTORY_LIMIT,
  CONFIRMATION_HISTORY_SCHEMA_VERSION,
  createConfirmationId,
  isNonEmptyString,
  trimConfirmationHistory
} from '@/lib/crop-editor/confirmation-history'
import {
  DEFAULT_HERO_CROP_TRANSFORM,
  HERO_CROP_SCHEMA_VERSION,
  normalizeHeroCropTransform,
  type HeroCropTransform,
  type HeroCropViewport
} from '@/lib/hero-crop/types'

type Viewport = HeroCropViewport
type MotionMode = 'static' | 'preview' | 'runtime'

interface CatalogItem {
  description: string
  filename: string
  index: number
  key: string
  src: string
}

interface HeroState {
  desktop: HeroCropTransform
  mobile: HeroCropTransform
  confirmed: { desktop: boolean; mobile: boolean }
  confirmationHistory: Record<Viewport, HeroConfirmationSnapshot[]>
  updatedAt?: string
}

interface HeroConfirmationSnapshot {
  id: string
  confirmedAt: string
  transform: HeroCropTransform
}

type Draft = Record<string, HeroState>

interface PointerInteraction {
  before: string
  id: number
  startX: number
  startY: number
}

const VIEWPORTS: readonly Viewport[] = ['desktop', 'mobile']
const MOTION_MODES: readonly MotionMode[] = ['static', 'preview', 'runtime']

const emptyConfirmationHistory = (): Record<Viewport, HeroConfirmationSnapshot[]> => ({
  desktop: [],
  mobile: []
})

const sameHeroTransform = (left: HeroCropTransform, right: HeroCropTransform): boolean =>
  left.x === right.x && left.y === right.y && left.zoom === right.zoom

const normalizeHeroHistory = (
  value: unknown,
  transforms: Record<Viewport, HeroCropTransform>,
  confirmed: Record<Viewport, boolean>,
  updatedAt?: string,
  confirmedByDefault = false
): Record<Viewport, HeroConfirmationSnapshot[]> => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const history = emptyConfirmationHistory()

  for (const viewport of VIEWPORTS) {
    const entries = Array.isArray(source[viewport]) ? source[viewport] : []
    const normalized = entries.flatMap((entry, index) => {
      if (!entry || typeof entry !== 'object') return []
      const candidate = entry as Record<string, unknown>
      const confirmedAt = isNonEmptyString(candidate.confirmedAt)
        ? candidate.confirmedAt
        : isNonEmptyString(candidate.updatedAt)
          ? candidate.updatedAt
          : undefined
      if (!confirmedAt) return []
      const transform = normalizeHeroCropTransform(
        candidate.transform as Partial<HeroCropTransform>
      )
      return [
        {
          id: isNonEmptyString(candidate.id)
            ? candidate.id
            : `legacy-${viewport}-${confirmedAt}-${index}`,
          confirmedAt,
          transform
        }
      ]
    })
    history[viewport] = trimConfirmationHistory(normalized)

    // Older editor exports and checked-in production records had no history.
    // Seed one recoverable version whenever that older value represented a
    // confirmed viewport; pending drafts intentionally stay history-free.
    if (history[viewport].length === 0 && (confirmed[viewport] || confirmedByDefault)) {
      history[viewport] = [
        {
          id: `legacy-${viewport}`,
          confirmedAt: updatedAt ?? '历史配置（时间未记录）',
          transform: { ...transforms[viewport] }
        }
      ]
    }
  }
  return history
}

/** Merge operation-undo snapshots without ever deleting semantic history. */
const mergeHeroHistories = (
  fromSnapshot: Record<Viewport, HeroConfirmationSnapshot[]>,
  fromCurrent: Record<Viewport, HeroConfirmationSnapshot[]>
): Record<Viewport, HeroConfirmationSnapshot[]> => {
  const merged = emptyConfirmationHistory()
  for (const viewport of VIEWPORTS) {
    const seen = new Set<string>()
    const entries = [...(fromSnapshot[viewport] ?? []), ...(fromCurrent[viewport] ?? [])].filter(
      (entry) => {
        if (seen.has(entry.id)) return false
        seen.add(entry.id)
        return true
      }
    )
    merged[viewport] = trimConfirmationHistory(entries)
  }
  return merged
}

const isMotionMode = (value: unknown): value is MotionMode =>
  MOTION_MODES.includes(value as MotionMode)

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const isViewport = (value: unknown): value is Viewport => VIEWPORTS.includes(value as Viewport)

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null
  return Boolean(element?.matches('input, textarea, select, button, [contenteditable="true"]'))
}

const parseJsonScript = (root: HTMLElement, selector: string): unknown => {
  const script = root.querySelector<HTMLScriptElement>(selector)
  if (!script?.textContent) return undefined
  try {
    return JSON.parse(script.textContent)
  } catch {
    return undefined
  }
}

const parseCatalog = (root: HTMLElement): CatalogItem[] => {
  const value = parseJsonScript(root, '[data-hero-catalog]')
  if (!Array.isArray(value)) return []
  return value.filter((candidate): candidate is CatalogItem => {
    if (!candidate || typeof candidate !== 'object') return false
    const item = candidate as Record<string, unknown>
    return (
      typeof item.description === 'string' &&
      typeof item.filename === 'string' &&
      typeof item.index === 'number' &&
      typeof item.key === 'string' &&
      typeof item.src === 'string'
    )
  })
}

const normalizeState = (value: unknown, confirmedByDefault = false): HeroState => {
  if (!value || typeof value !== 'object') {
    return {
      confirmed: { desktop: confirmedByDefault, mobile: confirmedByDefault },
      desktop: { ...DEFAULT_HERO_CROP_TRANSFORM },
      mobile: { ...DEFAULT_HERO_CROP_TRANSFORM },
      confirmationHistory: emptyConfirmationHistory()
    }
  }
  const candidate = value as Record<string, unknown>
  const confirmed = candidate.confirmed
  const confirmedRecord =
    confirmed && typeof confirmed === 'object' ? (confirmed as Record<string, unknown>) : undefined
  const legacyConfirmed = candidate.selection === 'confirmed'
  const state: HeroState = {
    confirmed: {
      desktop:
        typeof confirmedRecord?.desktop === 'boolean'
          ? confirmedRecord.desktop
          : legacyConfirmed || confirmedByDefault,
      mobile:
        typeof confirmedRecord?.mobile === 'boolean'
          ? confirmedRecord.mobile
          : legacyConfirmed || confirmedByDefault
    },
    desktop: normalizeHeroCropTransform(candidate.desktop as Partial<HeroCropTransform>),
    mobile: normalizeHeroCropTransform(candidate.mobile as Partial<HeroCropTransform>),
    confirmationHistory: emptyConfirmationHistory(),
    ...(typeof candidate.updatedAt === 'string' ? { updatedAt: candidate.updatedAt } : {})
  }

  state.confirmationHistory = normalizeHeroHistory(
    candidate.confirmationHistory,
    { desktop: state.desktop, mobile: state.mobile },
    state.confirmed,
    state.updatedAt,
    confirmedByDefault || legacyConfirmed
  )
  return state
}

const payloadItems = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {}
  const root = value as Record<string, unknown>
  const source = root.items ?? root.records ?? root
  return source && typeof source === 'object' && !Array.isArray(source)
    ? (source as Record<string, unknown>)
    : {}
}

const hasConfirmationMetadata = (value: unknown): boolean =>
  Boolean(
    value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'confirmed')
  )

export function bootHeroCropEditor(): void {
  const root = document.querySelector<HTMLElement>('[data-hero-crop-editor]')
  if (!root || root.dataset.initialized === 'true') return
  root.dataset.initialized = 'true'

  const catalog = parseCatalog(root)
  if (catalog.length === 0) return
  const byFilename = new Map(catalog.map((item) => [item.filename, item]))
  const storageKey = root.dataset.storageKey ?? 'susurrium:hero-crop-editor:v1'
  const draft: Draft = {}
  let activeFilename = catalog[0].filename
  let viewport: Viewport = 'desktop'
  let undoStack: string[] = []
  let redoStack: string[] = []
  let pointerInteraction: PointerInteraction | undefined
  let saveMessageTimer: number | undefined
  let motionMode: MotionMode = 'static'
  let draftSource: 'production' | 'local' = 'production'
  let geometryFrame = 0
  let geometryObserver: ResizeObserver | undefined
  let historyOpen = false
  let historyRenderKey = ''

  const defaultState = (): HeroState => normalizeState(undefined)
  const ensureState = (filename: string): HeroState => {
    if (!draft[filename]) draft[filename] = defaultState()
    return draft[filename]
  }

  const embedded = payloadItems(parseJsonScript(root, '[data-hero-initial]'))
  for (const [filename, value] of Object.entries(embedded)) {
    if (byFilename.has(filename)) draft[filename] = normalizeState(value, true)
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw) {
      draftSource = 'local'
      for (const [filename, value] of Object.entries(payloadItems(JSON.parse(raw)))) {
        if (byFilename.has(filename)) draft[filename] = normalizeState(value)
      }
    }
  } catch {
    root.dataset.storageUnavailable = 'true'
  }

  const saveMessage = (message: string) => {
    const element = root.querySelector<HTMLElement>('[data-hero-save-state]')
    if (!element) return
    element.textContent = message
    if (saveMessageTimer !== undefined) window.clearTimeout(saveMessageTimer)
    saveMessageTimer = window.setTimeout(() => {
      element.textContent = '自动保存已开启'
    }, 1800)
  }

  const persist = () => {
    draftSource = 'local'
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          exportedAt: new Date().toISOString(),
          items: draft,
          confirmationHistoryVersion: CONFIRMATION_HISTORY_SCHEMA_VERSION,
          schemaVersion: HERO_CROP_SCHEMA_VERSION
        })
      )
      root.dataset.storageUnavailable = 'false'
      saveMessage('已自动保存')
    } catch {
      root.dataset.storageUnavailable = 'true'
      saveMessage('浏览器存储不可用，请及时导出配置')
    }
  }

  const snapshot = (): string => JSON.stringify(draft)
  const recordHistory = (before: string) => {
    if (before === snapshot()) return
    undoStack = [...undoStack, before].slice(-60)
    redoStack = []
  }
  const restoreSnapshot = (value: string) => {
    const parsed = payloadItems(JSON.parse(value))
    const currentHistory = new Map(
      Object.entries(draft).map(([filename, state]) => [filename, state.confirmationHistory])
    )
    for (const filename of catalog.map((item) => item.filename)) delete draft[filename]
    for (const [filename, state] of Object.entries(parsed)) {
      if (!byFilename.has(filename)) continue
      const restored = normalizeState(state)
      const previous = currentHistory.get(filename)
      if (previous)
        restored.confirmationHistory = mergeHeroHistories(restored.confirmationHistory, previous)
      draft[filename] = restored
    }
  }

  const activeItem = (): CatalogItem => byFilename.get(activeFilename) ?? catalog[0]
  const activeState = (): HeroState => ensureState(activeFilename)
  const activeTransform = (): HeroCropTransform => activeState()[viewport]

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

  const appendConfirmation = (state: HeroState, target: Viewport, confirmedAt: string) => {
    const history = state.confirmationHistory[target] ?? []
    const latest = history[history.length - 1]
    // Re-clicking confirm without changing the focal point is not a new
    // recoverable version. This keeps the history useful and bounded.
    if (latest && sameHeroTransform(latest.transform, state[target])) return
    history.push({
      id: createConfirmationId(`hero-${target}`),
      confirmedAt,
      transform: { ...state[target] }
    })
    state.confirmationHistory[target] = history.slice(-CONFIRMATION_HISTORY_LIMIT)
  }

  const applyConfirmationSnapshot = (
    state: HeroState,
    target: Viewport,
    historySnapshot: HeroConfirmationSnapshot
  ) => {
    state[target] = { ...historySnapshot.transform }
    state.confirmed[target] = true
    state.updatedAt = new Date().toISOString()
  }

  const renderConfirmationHistory = () => {
    const state = activeState()
    const history = state.confirmationHistory[viewport] ?? []
    const latest = history[history.length - 1]
    const restoreLatest = root.querySelector<HTMLButtonElement>(
      '[data-hero-action="restore-latest"]'
    )
    const toggle = root.querySelector<HTMLButtonElement>('[data-hero-action="toggle-history"]')
    const panel = root.querySelector<HTMLElement>('[data-hero-history-panel]')
    const list = root.querySelector<HTMLOListElement>('[data-hero-history-list]')
    const latestLabel = root.querySelector<HTMLElement>('[data-hero-latest-label]')

    if (restoreLatest) {
      const current = state[viewport]
      const canRestore = Boolean(
        latest && (!state.confirmed[viewport] || !sameHeroTransform(current, latest.transform))
      )
      restoreLatest.disabled = !canRestore
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
        : '尚无确认版本'
    }
    if (!list) return
    const renderKey = `${activeFilename}|${viewport}|${historyOpen}|${history.map((entry) => entry.id).join('|')}`
    if (renderKey === historyRenderKey) return
    historyRenderKey = renderKey
    list.replaceChildren()
    if (history.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'hero-crop-editor__history-empty'
      empty.textContent = '当前尺寸还没有确认记录。调整并确认后会自动保留版本。'
      list.append(empty)
      return
    }

    history
      .map((entry, index) => ({ entry, index }))
      .reverse()
      .forEach(({ entry, index }) => {
        const row = document.createElement('li')
        row.className = 'hero-crop-editor__history-item'

        const copy = document.createElement('div')
        copy.className = 'hero-crop-editor__history-copy'
        const title = document.createElement('strong')
        title.textContent = `${index === history.length - 1 ? '最近确认' : `第 ${index + 1} 次确认`} · ${formatConfirmationTime(entry.confirmedAt)}`
        const detail = document.createElement('small')
        detail.textContent = `焦点 ${Math.round(entry.transform.x)}% / ${Math.round(entry.transform.y)}% · 缩放 ${Math.round(entry.transform.zoom * 100)}%`
        copy.append(title, detail)

        const actions = document.createElement('div')
        actions.className = 'hero-crop-editor__history-actions'
        const load = document.createElement('button')
        load.type = 'button'
        load.textContent = '载入草稿'
        load.dataset.heroHistoryIndex = String(index)
        load.dataset.heroHistoryMode = 'draft'
        const restore = document.createElement('button')
        restore.type = 'button'
        restore.className = 'is-primary'
        restore.textContent = '恢复并确认'
        restore.dataset.heroHistoryIndex = String(index)
        restore.dataset.heroHistoryMode = 'confirm'
        actions.append(load, restore)
        row.append(copy, actions)
        list.append(row)
      })
  }

  /**
   * Match the dimensions used by the real Home Hero instead of inventing a
   * second 16:8/9:14 editor viewport. The inner stage is kept at the target
   * Home pixel dimensions and the outer viewport scales the whole stage
   * uniformly, so object-cover and every overlay use one coordinate system.
   */
  const syncStageGeometry = () => {
    const stage = root.querySelector<HTMLElement>('[data-hero-editor-stage]')
    const stageViewport = root.querySelector<HTMLElement>('[data-hero-stage-viewport]')
    const hero = stage?.querySelector<HTMLElement>('[data-hero-mode="editor"]')
    if (!stage || !stageViewport || !hero) return

    const rootFontSize =
      Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16
    const viewportWidth = Math.max(1, window.innerWidth)
    const viewportHeight = Math.max(1, window.innerHeight)
    const isMobile = viewport === 'mobile'

    // When the editor is open on a desktop browser, use a stable phone canvas
    // for the mobile tab.  When it is actually opened on a phone, use that
    // phone's live dimensions so the preview remains a same-device check.
    const targetWidth = isMobile
      ? viewportWidth <= 767
        ? viewportWidth
        : 390
      : viewportWidth >= 768
        ? viewportWidth
        : 1440
    const targetViewportHeight = isMobile
      ? viewportWidth <= 767
        ? viewportHeight
        : 844
      : viewportWidth >= 768
        ? viewportHeight
        : 900
    const targetHeight = isMobile
      ? clamp(targetViewportHeight * 0.62, 24 * rootFontSize, 34 * rootFontSize)
      : clamp(targetViewportHeight * 0.7, 25 * rootFontSize, 52 * rootFontSize)
    const ratio = targetWidth / Math.max(1, targetHeight)
    // Keep the inner stage at the real Home dimensions, then scale the whole
    // stage to the workbench width. This is what keeps typography, padding,
    // waves, and the bitmap in the same coordinate system.
    const availableWidth = stageViewport.clientWidth || (isMobile ? 390 : 864)
    const scale = clamp(availableWidth / Math.max(1, targetWidth), 0.01, 1)

    root.style.setProperty('--hero-editor-stage-ratio', String(ratio))
    root.style.setProperty('--hero-editor-scale', String(scale))
    root.style.setProperty('--hero-editor-target-width', `${targetWidth}px`)
    root.style.setProperty('--hero-editor-target-height', `${targetHeight}px`)
    root.dataset.heroTargetWidth = String(Math.round(targetWidth))
    root.dataset.heroTargetHeight = String(Math.round(targetHeight))
    const stageSize = root.querySelector<HTMLElement>('[data-hero-stage-size]')
    if (stageSize) {
      stageSize.textContent = `目标舞台 ${Math.round(targetWidth)} × ${Math.round(targetHeight)} · 比例 ${ratio.toFixed(2)}`
    }

    stageViewport.dataset.heroViewport = viewport
    stageViewport.style.height = `${targetHeight * scale}px`
    stage.dataset.heroViewport = viewport
    stage.style.setProperty('--hero-editor-target-width', `${targetWidth}px`)
    stage.style.setProperty('--hero-editor-target-height', `${targetHeight}px`)
    stage.style.setProperty('--hero-editor-scale', String(scale))
    hero.dataset.heroViewport = viewport
    hero.dataset.heroMotion = motionMode
    // The nested Hero fills the editor stage.  Its media height must therefore
    // be 100% of the measured stage, not the host document's raw `vh` value.
    hero.style.setProperty('--hero-gallery-image-height', '100%')

    // The inner stage is already kept at Home's real pixel dimensions and the
    // outer stage applies one uniform scale. Keep the wave height in those
    // inner pixels too; scaling it here would apply the editor scale twice and
    // make the desktop wave visibly thinner than Home's wave.
    const scheduleWave = () => {
      geometryFrame = 0
      const runtimeWave = isMobile
        ? targetViewportHeight * 0.1
        : clamp(targetViewportHeight * 0.13, 4.8 * rootFontSize, 9.375 * rootFontSize)
      hero.style.setProperty('--hero-gallery-wave-height', `${runtimeWave}px`)
    }
    if (geometryFrame) window.cancelAnimationFrame(geometryFrame)
    geometryFrame = window.requestAnimationFrame(scheduleWave)
  }

  const updateHistoryButtons = () => {
    const undo = root.querySelector<HTMLButtonElement>('[data-hero-action="undo"]')
    const redo = root.querySelector<HTMLButtonElement>('[data-hero-action="redo"]')
    if (undo) undo.disabled = undoStack.length === 0
    if (redo) redo.disabled = redoStack.length === 0
  }

  const statusText = (state: HeroState): string => {
    if (state.confirmed.desktop && state.confirmed.mobile) return '桌面 + 手机已确认'
    if (state.confirmed.desktop) return '桌面已确认'
    if (state.confirmed.mobile) return '手机已确认'
    return '待处理'
  }

  const renderQueue = () => {
    let confirmed = 0
    catalog.forEach((item) => {
      const state = ensureState(item.filename)
      if (state.confirmed.desktop && state.confirmed.mobile) confirmed += 1
      const status = root.querySelector<HTMLElement>(
        `[data-hero-item-status="${CSS.escape(item.filename)}"]`
      )
      if (status) status.textContent = statusText(state)
      const button = root.querySelector<HTMLButtonElement>(
        `[data-hero-select="${CSS.escape(item.filename)}"]`
      )
      if (button) {
        const active = item.filename === activeFilename
        button.classList.toggle('is-active', active)
        if (active) button.setAttribute('aria-current', 'true')
        else button.removeAttribute('aria-current')
      }
    })
    const progress = root.querySelector<HTMLElement>('[data-hero-progress]')
    if (progress) progress.textContent = `已确认 ${confirmed} / ${catalog.length}`
    updateHistoryButtons()
  }

  const setMediaTransform = (
    frame: HTMLElement,
    image: HTMLImageElement | null,
    value: HeroCropTransform
  ) => {
    const position = `${value.x}% ${value.y}%`
    frame.dataset.heroPosition = position
    frame.dataset.heroZoom = String(value.zoom)
    if (!image) return
    image.style.objectPosition = position
    image.style.transformOrigin = position
    image.style.transform = `scale(${value.zoom})`
  }

  const render = () => {
    const item = activeItem()
    const state = activeState()
    const transform = state[viewport]
    const stage = root.querySelector<HTMLElement>('[data-hero-editor-stage]')
    const stageViewport = root.querySelector<HTMLElement>('[data-hero-stage-viewport]')
    const frame = root.querySelector<HTMLElement>('[data-hero-editor-frame]')
    const image = root.querySelector<HTMLImageElement>('.hero-crop-editor__image')
    const zoom = root.querySelector<HTMLInputElement>('[data-hero-zoom]')
    const zoomValue = root.querySelector<HTMLOutputElement>('[data-hero-zoom-value]')
    const coordinates = root.querySelector<HTMLElement>('[data-hero-coordinates]')
    const viewportLabel = root.querySelector<HTMLElement>('[data-hero-viewport-label]')
    const assetIndex = root.querySelector<HTMLElement>('[data-hero-asset-index]')
    const assetName = root.querySelector<HTMLElement>('[data-hero-asset-name]')
    const assetDescription = root.querySelector<HTMLElement>('[data-hero-asset-description]')
    const assetStatus = root.querySelector<HTMLElement>('[data-hero-asset-status]')
    const confirmHeading = root.querySelector<HTMLElement>('[data-hero-confirm-heading]')
    const confirmHelp = root.querySelector<HTMLElement>('[data-hero-confirm-help]')
    const editorHero = stage?.querySelector<HTMLElement>('[data-hero-mode="editor"]')

    if (stage) {
      stage.dataset.heroViewport = viewport
      stage.classList.toggle('is-interacted', false)
    }
    if (stageViewport) stageViewport.dataset.heroViewport = viewport
    root.dataset.activeFilename = item.filename
    root.dataset.activeViewport = viewport
    root.dataset.heroMotion = motionMode
    if (editorHero) {
      editorHero.dataset.heroViewport = viewport
      editorHero.dataset.heroMotion = motionMode
    }
    syncStageGeometry()
    if (frame) {
      frame.dataset.heroViewport = viewport
      const other = viewport === 'desktop' ? state.mobile : state.desktop
      frame.style.setProperty(
        '--hero-media-position-desktop',
        `${state.desktop.x}% ${state.desktop.y}%`
      )
      frame.style.setProperty(
        '--hero-media-origin-desktop',
        `${state.desktop.x}% ${state.desktop.y}%`
      )
      frame.style.setProperty('--hero-media-zoom-desktop', String(state.desktop.zoom))
      frame.style.setProperty(
        '--hero-media-position-mobile',
        `${state.mobile.x}% ${state.mobile.y}%`
      )
      frame.style.setProperty('--hero-media-origin-mobile', `${state.mobile.x}% ${state.mobile.y}%`)
      frame.style.setProperty('--hero-media-zoom-mobile', String(state.mobile.zoom))
      frame.dataset.heroPositionOther = `${other.x}% ${other.y}%`
      setMediaTransform(frame, image, transform)
    }
    if (image) {
      image.src = item.src
      image.alt = item.description
    }
    if (zoom) zoom.value = String(transform.zoom)
    if (zoomValue) zoomValue.value = `${Math.round(transform.zoom * 100)}%`
    if (coordinates)
      coordinates.textContent = `焦点 ${Math.round(transform.x)}% / ${Math.round(transform.y)}%`
    if (viewportLabel) viewportLabel.textContent = viewport === 'desktop' ? '桌面预览' : '手机预览'
    if (assetIndex) assetIndex.textContent = `HERO ${String(item.index + 1).padStart(2, '0')}`
    if (assetName) assetName.textContent = item.filename
    if (assetDescription) assetDescription.textContent = item.description
    if (assetStatus) assetStatus.textContent = statusText(state)
    if (confirmHeading)
      confirmHeading.textContent = state.confirmed[viewport]
        ? `${viewport === 'desktop' ? '桌面' : '手机'}定位已确认`
        : '确认当前 Hero 定位'
    if (confirmHelp)
      confirmHelp.textContent = `当前为${viewport === 'desktop' ? '桌面' : '手机'}预览。确认后只保存这个尺寸的焦点和缩放，另一尺寸可以单独调整。`

    root.querySelectorAll<HTMLButtonElement>('button[data-hero-viewport]').forEach((button) => {
      const selected = button.dataset.heroViewport === viewport
      button.classList.toggle('is-active', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    root.querySelectorAll<HTMLButtonElement>('button[data-hero-motion]').forEach((button) => {
      const selected = button.dataset.heroMotion === motionMode
      button.classList.toggle('is-active', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    const source = root.querySelector<HTMLElement>('[data-hero-config-source]')
    if (source) {
      source.textContent =
        draftSource === 'local'
          ? '当前显示：本地草稿（尚未必应用到 Home）'
          : '当前显示：已应用生产配置'
    }
    renderConfirmationHistory()
    renderQueue()
  }

  const setTransform = (next: Partial<HeroCropTransform>, record = true) => {
    const state = activeState()
    const current = state[viewport]
    const normalized = normalizeHeroCropTransform({ ...current, ...next })
    if (
      normalized.x === current.x &&
      normalized.y === current.y &&
      normalized.zoom === current.zoom
    )
      return
    const before = record ? snapshot() : undefined
    state[viewport] = normalized
    state.confirmed[viewport] = false
    state.updatedAt = new Date().toISOString()
    if (record && before !== undefined) {
      recordHistory(before)
      persist()
    }
    render()
  }

  const select = (filename: string) => {
    if (!byFilename.has(filename)) return
    activeFilename = filename
    render()
    root.querySelector<HTMLElement>('[data-hero-editor-stage]')?.focus({ preventScroll: true })
  }

  const move = (direction: 1 | -1) => {
    const index = catalog.findIndex((item) => item.filename === activeFilename)
    const next = (index + direction + catalog.length) % catalog.length
    select(catalog[next].filename)
  }

  const confirm = (goNext = false) => {
    const before = snapshot()
    const state = activeState()
    const confirmedAt = new Date().toISOString()
    state.confirmed[viewport] = true
    state.updatedAt = confirmedAt
    appendConfirmation(state, viewport, confirmedAt)
    recordHistory(before)
    persist()
    render()
    if (goNext) move(1)
  }

  const restoreLatest = () => {
    const state = activeState()
    const history = state.confirmationHistory[viewport] ?? []
    const latest = history[history.length - 1]
    if (!latest) {
      saveMessage('当前尺寸还没有可恢复的确认版本')
      return
    }
    if (state.confirmed[viewport] && sameHeroTransform(state[viewport], latest.transform)) {
      saveMessage('当前已经是最近一次确认版本')
      return
    }
    if (
      !window.confirm(
        `恢复最近一次${viewport === 'desktop' ? '桌面' : '手机'}确认吗？当前未确认的调整会进入撤销记录。`
      )
    )
      return
    const before = snapshot()
    applyConfirmationSnapshot(state, viewport, latest)
    recordHistory(before)
    persist()
    render()
    saveMessage('已恢复最近一次确认版本')
  }

  const restoreHistory = (index: number, confirmImmediately: boolean) => {
    const state = activeState()
    const history = state.confirmationHistory[viewport] ?? []
    const historySnapshot = history[index]
    if (!historySnapshot) return
    const time = formatConfirmationTime(historySnapshot.confirmedAt)
    const actionText = confirmImmediately ? '恢复并确认' : '载入为待确认草稿'
    if (!window.confirm(`${actionText}（${time}）吗？当前调整会进入撤销记录。`)) return

    const before = snapshot()
    state[viewport] = { ...historySnapshot.transform }
    state.confirmed[viewport] = confirmImmediately
    state.updatedAt = new Date().toISOString()
    if (confirmImmediately) appendConfirmation(state, viewport, state.updatedAt)
    recordHistory(before)
    persist()
    render()
    saveMessage(confirmImmediately ? '已恢复并确认历史版本' : '已载入历史版本，请检查后再确认')
  }

  const copyToOther = () => {
    const before = snapshot()
    const state = activeState()
    const target: Viewport = viewport === 'desktop' ? 'mobile' : 'desktop'
    state[target] = { ...state[viewport] }
    state.confirmed[target] = false
    state.updatedAt = new Date().toISOString()
    recordHistory(before)
    persist()
    render()
    saveMessage(`已复制到${target === 'desktop' ? '桌面' : '手机'}草稿`)
  }

  const reset = () => setTransform({ ...DEFAULT_HERO_CROP_TRANSFORM })

  const loadProduction = () => {
    const hasLocalDraft = draftSource === 'local' && Object.keys(draft).length > 0
    if (
      hasLocalDraft &&
      !window.confirm(
        '用已应用到 Home 的 Hero 配置覆盖当前本地草稿吗？当前草稿会保留在撤销记录中。'
      )
    )
      return

    const before = snapshot()
    for (const filename of Object.keys(draft)) delete draft[filename]
    for (const [filename, value] of Object.entries(embedded)) {
      if (byFilename.has(filename)) draft[filename] = normalizeState(value, true)
    }
    try {
      window.localStorage.removeItem(storageKey)
      root.dataset.storageUnavailable = 'false'
    } catch {
      root.dataset.storageUnavailable = 'true'
    }
    draftSource = 'production'
    recordHistory(before)
    render()
    saveMessage('已加载已应用的 Hero 配置')
  }

  /** Clear only confirmation flags; keep every focal point and zoom intact. */
  const clearConfirmations = () => {
    const confirmedItems = catalog.filter((item) => {
      const state = ensureState(item.filename)
      return state.confirmed.desktop || state.confirmed.mobile
    })
    if (confirmedItems.length === 0) {
      saveMessage('当前没有已确认的 Hero')
      return
    }
    if (
      !window.confirm(
        `确定取消 ${confirmedItems.length} 张 Hero 的全部尺寸确认吗？焦点和缩放会保留，正式页面不会被直接修改。`
      )
    )
      return

    const before = snapshot()
    for (const item of confirmedItems) {
      const state = ensureState(item.filename)
      state.confirmed.desktop = false
      state.confirmed.mobile = false
      state.updatedAt = new Date().toISOString()
    }
    recordHistory(before)
    persist()
    render()
    saveMessage(`已取消 ${confirmedItems.length} 张 Hero 的确认`)
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
    const records = Object.fromEntries(
      catalog.map((item) => {
        const state = ensureState(item.filename)
        return [
          item.filename,
          {
            filename: item.filename,
            confirmed: state.confirmed,
            desktop: state.desktop,
            mobile: state.mobile,
            confirmationHistory: state.confirmationHistory,
            schemaVersion: HERO_CROP_SCHEMA_VERSION,
            ...(state.updatedAt ? { updatedAt: state.updatedAt } : {})
          }
        ]
      })
    )
    download('hero-crop-editor-v1.json', {
      exportedAt: new Date().toISOString(),
      items: records,
      confirmationHistoryVersion: CONFIRMATION_HISTORY_SCHEMA_VERSION,
      schemaVersion: HERO_CROP_SCHEMA_VERSION
    })
    saveMessage('已导出 Hero 配置')
  }

  const importPayload = (value: unknown) => {
    const source = payloadItems(value)
    const before = snapshot()
    let imported = 0
    let legacyImported = 0
    for (const [filename, candidate] of Object.entries(source)) {
      if (!byFilename.has(filename)) continue
      // Before schema v1 exports carried confirmation flags, an exported
      // record represented a reviewed production decision. Preserve that
      // meaning when an older JSON is brought into this editor; new exports
      // remain strict because they include explicit desktop/mobile flags.
      const legacy = !hasConfirmationMetadata(candidate)
      draft[filename] = normalizeState(candidate, legacy)
      imported += 1
      if (legacy) legacyImported += 1
    }
    if (imported === 0) {
      window.alert('没有找到可导入的 Hero 配置。')
      return
    }
    recordHistory(before)
    persist()
    render()
    saveMessage(
      legacyImported > 0
        ? `已导入 ${imported} 张 Hero（旧格式按已确认处理）`
        : `已导入 ${imported} 张 Hero`
    )
  }

  const canvas = root.querySelector<HTMLElement>('[data-hero-editor-stage]')
  if (canvas) {
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      pointerInteraction = {
        before: snapshot(),
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
      const transform = activeTransform()
      setTransform(
        {
          x: transform.x - (dx / Math.max(1, rect.width)) * 100,
          y: transform.y - (dy / Math.max(1, rect.height)) * 100
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
        const before = snapshot()
        setTransform({ zoom: activeTransform().zoom + (event.deltaY < 0 ? 0.1 : -0.1) }, false)
        recordHistory(before)
        persist()
        render()
      },
      { passive: false }
    )
    canvas.addEventListener('keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
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
        reset()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        confirm(true)
      }
    })
  }

  root.addEventListener('click', (event) => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('button') : null
    if (!target) return
    const filename = target.dataset.heroSelect
    if (filename) return select(filename)
    const nextViewport = target.dataset.heroViewport
    if (isViewport(nextViewport)) {
      viewport = nextViewport
      return render()
    }
    const nextMotion = target.dataset.heroMotion
    if (isMotionMode(nextMotion)) {
      motionMode = nextMotion
      render()
      return saveMessage(
        nextMotion === 'static'
          ? '已切换到静态构图'
          : nextMotion === 'preview'
            ? '已切换到运行预览（暂停）'
            : '已切换到运行预览（播放）'
      )
    }
    const historyIndex = target.dataset.heroHistoryIndex
    if (historyIndex !== undefined) {
      const index = Number(historyIndex)
      if (!Number.isInteger(index)) return
      return restoreHistory(index, target.dataset.heroHistoryMode === 'confirm')
    }
    const action = target.dataset.heroAction
    if (!action) return
    if (action === 'undo') {
      const previous = undoStack.pop()
      if (!previous) return
      redoStack.push(snapshot())
      restoreSnapshot(previous)
      persist()
      return render()
    }
    if (action === 'redo') {
      const next = redoStack.pop()
      if (!next) return
      undoStack.push(snapshot())
      restoreSnapshot(next)
      persist()
      return render()
    }
    if (action === 'export') return exportDraft()
    if (action === 'import')
      return root.querySelector<HTMLInputElement>('[data-hero-import]')?.click()
    if (action === 'load-production') return loadProduction()
    if (action === 'clear-confirmations') return clearConfirmations()
    if (action === 'restore-latest') return restoreLatest()
    if (action === 'toggle-history') {
      historyOpen = !historyOpen
      return render()
    }
    if (action === 'clear') {
      if (!window.confirm('确定清空六张 Hero 的定位草稿吗？正式页面不会受到影响。')) return
      const before = snapshot()
      for (const filename of Object.keys(draft)) delete draft[filename]
      recordHistory(before)
      persist()
      return render()
    }
    if (action === 'zoom-in') return setTransform({ zoom: activeTransform().zoom + 0.1 })
    if (action === 'zoom-out') return setTransform({ zoom: activeTransform().zoom - 0.1 })
    if (action === 'reset') return reset()
    if (action === 'confirm') return confirm()
    if (action === 'confirm-next') return confirm(true)
    if (action === 'copy-to-other') return copyToOther()
    if (action === 'previous') return move(-1)
    if (action === 'next') return move(1)
  })

  root.querySelector<HTMLInputElement>('[data-hero-zoom]')?.addEventListener('input', (event) => {
    setTransform({ zoom: Number((event.target as HTMLInputElement).value) })
  })

  root
    .querySelector<HTMLInputElement>('[data-hero-import]')
    ?.addEventListener('change', async (event) => {
      const input = event.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return
      try {
        importPayload(JSON.parse(await file.text()))
      } catch {
        window.alert('导入失败：文件不是有效的 Hero 配置 JSON。')
      } finally {
        input.value = ''
      }
    })

  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return
    if (event.key === 'Enter') {
      event.preventDefault()
      confirm(true)
    }
  })

  const scheduleGeometry = () => syncStageGeometry()
  window.addEventListener('resize', scheduleGeometry, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    const stageViewport = root.querySelector<HTMLElement>('[data-hero-stage-viewport]')
    if (stageViewport) {
      geometryObserver = new ResizeObserver(scheduleGeometry)
      geometryObserver.observe(stageViewport)
    }
  }
  document.addEventListener(
    'astro:before-swap',
    () => {
      window.removeEventListener('resize', scheduleGeometry)
      geometryObserver?.disconnect()
      geometryObserver = undefined
      if (geometryFrame) window.cancelAnimationFrame(geometryFrame)
      geometryFrame = 0
    },
    { once: true }
  )

  render()
}
