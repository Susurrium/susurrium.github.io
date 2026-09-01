import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'

const root = resolve(import.meta.dir, '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('card crop render contract', () => {
  test('the editor preview is the production Media card, not a parallel mock', () => {
    const editor = read('src/components/tools/CardCropEditor.astro')
    const editorScript = read('src/scripts/card-crop-editor.ts')
    const production = read('src/components/cards/MediaCard.astro')

    expect(editor).toContain("import MediaCard from '@/components/cards/MediaCard.astro'")
    expect(editor).toContain('<MediaCard')
    expect(editor).toContain("data-preview-source='media-card'")
    expect(editor).toContain('data-card-crop-profile={cardCropPolicy.profile}')
    expect(editor).toContain("class='card-crop-editor__card-preview'")
    expect(editor).not.toContain("class='card-crop-editor__card-cover'")
    expect(production).toContain(
      "import CardMediaFrame from '@/components/cards/CardMediaFrame.astro'"
    )
    expect(production).toContain(
      'dataAttributes?: Record<string, string | number | boolean | undefined>'
    )
    expect(editorScript).toContain('profile !== CARD_CROP_PROFILE')
  })

  test('the preview rail documents and implements the archive list geometry', () => {
    const editor = read('src/components/tools/CardCropEditor.astro')
    const editorScript = read('src/scripts/card-crop-editor.ts')

    expect(editor).toContain('card-crop-editor__preview-rail')
    expect(editor).toContain('`-mx-4` rail')
    expect(editor).toContain('aspect-ratio: var(--editor-canvas-ratio, 640 / 448)')
    expect(editorScript).toContain('syncCanvasRatio')
  })

  test('exposes a safe bulk confirmation reset without deleting crop drafts', () => {
    const editor = read('src/components/tools/CardCropEditor.astro')
    const editorScript = read('src/scripts/card-crop-editor.ts')

    expect(editor).toContain("data-editor-action='clear-confirmations'")
    expect(editor).toContain('取消全部确认')
    expect(editorScript).toContain('const clearConfirmations = () =>')
    expect(editorScript).toContain("state.selection = 'pending'")
    expect(editorScript).toContain('焦点、缩放、适配方式和斜边草稿会保留')
  })
})
