import { describe, expect, test } from 'bun:test'

import { buildSearchIndex } from '../src/integrations/search-index'

function fakeService(failure?: 'create' | 'index' | 'write') {
  const calls: string[] = []
  const errors = (stage: string) => (failure === stage ? ['fixture failure'] : [])
  return {
    calls,
    service: {
      createIndex: async () => {
        calls.push('create')
        return {
          errors: errors('create'),
          index: {
            addDirectory: async () => {
              calls.push('index')
              return { errors: errors('index'), page_count: 4 }
            },
            writeFiles: async () => {
              calls.push('write')
              return { errors: errors('write'), outputPath: 'fixture/pagefind' }
            }
          }
        }
      },
      close: async () => {
        calls.push('close')
        return null
      }
    }
  }
}

describe('search index build contract', () => {
  for (const stage of ['create', 'index', 'write'] as const) {
    test(`${stage} errors fail the build and release the service`, async () => {
      const { calls, service } = fakeService(stage)
      await expect(
        buildSearchIndex('fixture', service as Parameters<typeof buildSearchIndex>[1])
      ).rejects.toThrow('fixture failure')
      expect(calls.at(-1)).toBe('close')
      if (stage !== 'write') expect(calls).not.toContain('write')
    })
  }
  test('returns indexed pages only after output succeeds', async () => {
    const { calls, service } = fakeService()
    expect(
      await buildSearchIndex('fixture', service as Parameters<typeof buildSearchIndex>[1])
    ).toBe(4)
    expect(calls).toEqual(['create', 'index', 'write', 'close'])
  })
})
