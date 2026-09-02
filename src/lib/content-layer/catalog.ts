import { getCollection } from 'astro:content'

import { adaptBlogEntry, adaptSayingEntry, adaptTraceEntry } from './adapters'
import { contentTypeRegistry } from './registry'
import type {
  BlogEntry,
  ContentCatalog,
  ContentCatalogSources,
  ContentKind,
  ContentRecord,
  ContentRecordOf,
  LoadedContentCatalog,
  SayingEntry,
  TraceEntry
} from './types'

export {
  getRecordOfKind,
  getRecordOfKind as getContentRecord,
  queryContent,
  sortContentRecords
} from './queries'

export interface LoadContentCatalogOptions {
  /** Published is the safe default for public pages; preview explicitly includes drafts. */
  readonly mode?: 'published' | 'preview'
}

const catalogCache = new Map<ContentCatalog['mode'], Promise<LoadedContentCatalog>>()

export function createContentCatalog(
  records: readonly ContentRecord[],
  mode: ContentCatalog['mode'] = 'published'
): ContentCatalog {
  const all = [...records]
  return {
    all,
    mode,
    byKind: {
      blog: all.filter((record): record is ContentRecordOf<'blog'> => record.kind === 'blog'),
      saying: all.filter((record): record is ContentRecordOf<'saying'> => record.kind === 'saying'),
      trace: all.filter((record): record is ContentRecordOf<'trace'> => record.kind === 'trace')
    }
  }
}

/**
 * The only production boundary that reads the three Astro collections.
 * Keeping the physical collections separate preserves their schemas while
 * giving every page one logical catalog.
 */
async function readContentCatalog(mode: ContentCatalog['mode']): Promise<LoadedContentCatalog> {
  const [blogEntries, traceEntries, sayingEntries] = await Promise.all([
    getCollection('blog'),
    getCollection('trace'),
    getCollection('saying')
  ])

  const sources: ContentCatalogSources = {
    byKind: {
      blog: (mode === 'preview'
        ? blogEntries
        : blogEntries.filter((entry) => !entry.data.draft)) as BlogEntry[],
      saying: (mode === 'preview'
        ? sayingEntries
        : sayingEntries.filter((entry) => !entry.data.draft)) as SayingEntry[],
      trace: (mode === 'preview'
        ? traceEntries
        : traceEntries.filter((entry) => !entry.data.draft)) as TraceEntry[]
    }
  }
  const records: ContentRecord[] = [
    ...sources.byKind.blog.map(adaptBlogEntry),
    ...sources.byKind.trace.map(adaptTraceEntry),
    ...sources.byKind.saying.map(adaptSayingEntry)
  ]

  return { ...createContentCatalog(records, mode), sources }
}

export function loadContentCatalog(
  options: LoadContentCatalogOptions = {}
): Promise<LoadedContentCatalog> {
  const mode = options.mode ?? 'published'
  const cached = catalogCache.get(mode)
  if (cached) return cached

  const loading = readContentCatalog(mode)

  const recoverable = loading.catch((error: unknown) => {
    if (catalogCache.get(mode) === recoverable) catalogCache.delete(mode)
    throw error
  })
  catalogCache.set(mode, recoverable)
  return recoverable
}

export function getSourceEntry(
  catalog: LoadedContentCatalog,
  kind: 'blog',
  id: string
): BlogEntry | undefined
export function getSourceEntry(
  catalog: LoadedContentCatalog,
  kind: 'trace',
  id: string
): TraceEntry | undefined
export function getSourceEntry(
  catalog: LoadedContentCatalog,
  kind: 'saying',
  id: string
): SayingEntry | undefined
export function getSourceEntry(
  catalog: LoadedContentCatalog,
  kind: ContentKind,
  id: string
): BlogEntry | TraceEntry | SayingEntry | undefined {
  return catalog.sources.byKind[kind].find((entry) => entry.id === id)
}

/** Registry-oriented access used by page builders and future content types. */
export function getContentRecords<K extends ContentKind>(
  catalog: ContentCatalog,
  kind: K
): readonly ContentRecordOf<K>[] {
  return catalog.byKind[kind] as readonly ContentRecordOf<K>[]
}

export function getSourceEntries<K extends ContentKind>(catalog: LoadedContentCatalog, kind: K) {
  return catalog.sources.byKind[kind]
}

/** Keep the registry and its source boundary visibly coupled at build time. */
export function getRegisteredContentKinds(): ContentKind[] {
  return Object.keys(contentTypeRegistry) as ContentKind[]
}
