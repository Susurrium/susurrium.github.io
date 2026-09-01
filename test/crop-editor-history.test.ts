import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'

import {
  CONFIRMATION_HISTORY_LIMIT,
  CONFIRMATION_HISTORY_SCHEMA_VERSION,
  trimConfirmationHistory
} from '../src/lib/crop-editor/confirmation-history'

const projectRoot = resolve(import.meta.dir, '..')
const read = (path: string) => readFileSync(resolve(projectRoot, path), 'utf8')

describe('editor confirmation recovery contract', () => {
  test('keeps a bounded chronological history independent from operation undo', () => {
    expect(CONFIRMATION_HISTORY_SCHEMA_VERSION).toBe(1)
    expect(CONFIRMATION_HISTORY_LIMIT).toBe(20)
    expect(trimConfirmationHistory(Array.from({ length: 23 }, (_, index) => index))).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 3)
    )
  })

  test('stores separate Hero histories for desktop and mobile', () => {
    const script = read('src/scripts/hero-crop-editor.ts')
    const editor = read('src/components/tools/HeroCropEditor.astro')
    expect(script).toContain('confirmationHistory: Record<Viewport, HeroConfirmationSnapshot[]>')
    expect(script).toContain('const restoreLatest = () =>')
    expect(script).toContain('const restoreHistory = (index: number, confirmImmediately: boolean)')
    expect(script).toContain('state.confirmed[viewport] = false')
    expect(editor).toContain("data-hero-action='restore-latest'")
    expect(editor).toContain("data-hero-action='toggle-history'")
    expect(editor).toContain('data-hero-history-list')
  })

  test('keeps separate card histories for both diagonal frames', () => {
    const script = read('src/scripts/card-crop-editor.ts')
    const editor = read('src/components/tools/CardCropEditor.astro')
    expect(script).toContain(
      'confirmationHistory: Record<CardCropFrame, CardConfirmationSnapshot[]>'
    )
    expect(script).toContain("selection === 'both' ? FRAME_VALUES : [selection]")
    expect(script).toContain("state.selection = 'pending'")
    expect(script).toContain('const restoreLatest = () =>')
    expect(script).toContain('const restoreHistory = (index: number, confirmImmediately: boolean)')
    expect(editor).toContain("data-editor-action='restore-latest'")
    expect(editor).toContain("data-editor-action='toggle-history'")
    expect(editor).toContain('data-editor-history-list')
  })

  test('does not let operation undo erase semantic history', () => {
    expect(read('src/scripts/hero-crop-editor.ts')).toContain('mergeHeroHistories')
    expect(read('src/scripts/card-crop-editor.ts')).toContain('mergeCardHistories')
  })
})
