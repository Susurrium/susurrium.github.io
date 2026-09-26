import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import * as pagefind from 'pagefind'

function assertSuccess(errors: string[], stage: string): void {
  if (errors.length) throw new Error(`Pagefind ${stage} failed: ${errors.join('; ')}`)
}

export async function buildSearchIndex(directory: string, service = pagefind): Promise<number> {
  try {
    const created = await service.createIndex()
    assertSuccess(created.errors, 'initialization')
    if (!created.index) throw new Error('Pagefind returned no index')
    const added = await created.index.addDirectory({ path: directory })
    assertSuccess(added.errors, 'indexing')
    const written = await created.index.writeFiles({ outputPath: resolve(directory, 'pagefind') })
    assertSuccess(written.errors, 'output')
    return added.page_count
  } finally {
    await service.close()
  }
}

export default function searchIndex(enabled = true): AstroIntegration {
  return {
    name: 'susurrium-search-index',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        if (!enabled) return
        const count = await buildSearchIndex(fileURLToPath(dir))
        logger.info(`Pagefind scanned ${count} HTML page(s); data-pagefind-body controls indexing`)
      }
    }
  }
}
