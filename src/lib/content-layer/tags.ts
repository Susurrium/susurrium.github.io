import type { PaginateFunction } from 'astro'

import { buildSayingImageAssignmentMap, createPageItem } from './page-data'
import { resolveContentPageSize, type ContentPaginationInput } from './pagination'
import { contentTagHref, isContentSurfaceEnabled } from './policy'
import { contentKinds, contentTagPath, getContentTypeDefinition } from './registry'
import type { ContentCatalog, ContentKind, ContentRecordOf, PageItem } from './types'

export interface ContentTagCount {
  readonly tag: string
  readonly count: number
  readonly href: string
}

/** A type-level entry point used by pages that need to expose tag indexes. */
export interface ContentTagIndexEntry {
  readonly kind: ContentKind
  readonly label: string
  readonly href: string
  /** Number of distinct tags in this content type, not number of records. */
  readonly tagCount: number
}

/**
 * The data required by the search-page tag browser.
 *
 * This deliberately extends the type-level index entry instead of changing
 * `ContentTagIndexEntry`: existing callers only need the compact entry point,
 * while the interactive browser needs the scoped tag previews as well.
 */
export interface ContentTagBrowserEntry extends ContentTagIndexEntry {
  readonly tags: readonly ContentTagCount[]
}

function recordsForKind<K extends ContentKind>(
  catalog: ContentCatalog,
  kind: K
): readonly ContentRecordOf<K>[] {
  return catalog.byKind[kind] as readonly ContentRecordOf<K>[]
}

export function getContentTagCounts(catalog: ContentCatalog, kind: ContentKind): ContentTagCount[] {
  if (!isContentSurfaceEnabled(kind, 'tags')) return []
  const counts = new Map<string, number>()
  for (const record of recordsForKind(catalog, kind)) {
    for (const tag of record.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort(
      ([leftTag, leftCount], [rightTag, rightCount]) =>
        rightCount - leftCount || leftTag.localeCompare(rightTag)
    )
    .map(([tag, count]) => ({ count, href: contentTagHref(kind, tag), tag }))
}

/**
 * Return one discoverable index link per registered, tag-enabled content type.
 * The registry owns ordering and labels so callers never hand-build a list of
 * content kinds or taxonomy URLs.
 */
export function getContentTagIndexEntries(catalog: ContentCatalog): ContentTagIndexEntry[] {
  return contentKinds.flatMap((kind) => {
    const definition = getContentTypeDefinition(kind)
    if (!definition.capabilities.tags || !isContentSurfaceEnabled(kind, 'tags')) return []

    return [
      {
        href: contentTagPath(kind),
        kind,
        label: `${definition.label} Tags`,
        tagCount: getContentTagCounts(catalog, kind).length
      }
    ]
  })
}

/**
 * Return registry-ordered, type-scoped tag data for the search-page browser.
 *
 * Tags remain scoped to their content kind and retain the existing canonical
 * URLs. The caller can choose how many entries to preview without losing the
 * complete type-specific index link.
 */
export function getContentTagBrowserEntries(catalog: ContentCatalog): ContentTagBrowserEntry[] {
  return getContentTagIndexEntries(catalog).map((entry) => ({
    ...entry,
    tags: getContentTagCounts(catalog, entry.kind)
  }))
}

export function getTagRecords(catalog: ContentCatalog, kind: ContentKind, tag: string) {
  const normalizedTag = tag.toLowerCase()
  return recordsForKind(catalog, kind).filter((record) =>
    record.tags.some((candidate) => candidate.toLowerCase() === normalizedTag)
  )
}

/** Shared static-path builder used by each intentionally thin scoped route. */
export function buildTagStaticPaths(
  catalog: ContentCatalog,
  kind: ContentKind,
  paginate: PaginateFunction,
  pageSize: ContentPaginationInput
) {
  const definition = getContentTypeDefinition(kind)
  if (!definition.capabilities.tags || !isContentSurfaceEnabled(kind, 'tags')) return []
  const tags = getContentTagCounts(catalog, kind)
  // Saying image placement is an archive-level decision.  Build it from the
  // complete Saying catalog once so a filtered tag page never reuses its own
  // page-local index and gives an existing Saying a different image/frame.
  const sayingImageAssignments =
    kind === 'saying' ? buildSayingImageAssignmentMap(catalog.byKind.saying) : undefined

  return tags.flatMap(({ tag }) => {
    const items: PageItem[] = getTagRecords(catalog, kind, tag).map((record, index) => {
      const imageAssignment = sayingImageAssignments?.get(record.key)
      return createPageItem(record, {
        detailed: true,
        ...(imageAssignment ? { imageAssignment } : {}),
        index
      })
    })
    return paginate(items, {
      pageSize: resolveContentPageSize(pageSize),
      params: { tag }
    })
  })
}
