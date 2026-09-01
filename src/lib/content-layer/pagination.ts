import type { Page, PaginateFunction } from 'astro'

import {
  buildCollectionPageData,
  getPageItems,
  type PageItemOptions
} from './page-data'
import { sortContentRecords } from './queries'
import { getContentTypeDefinition } from './registry'
import type {
  ContentCatalog,
  ContentKind,
  ContentRecord,
  PageItem,
  PageKind
} from './types'

/** Per-content-type pagination settings owned by the site, not the theme. */
export interface ContentPaginationConfig {
  readonly enabled: boolean
  readonly pageSize: number
}

export interface PaginationCopy {
  /** Visible labels are intentionally fixed below; only screen-reader context varies by type. */
  readonly previousSrLabel?: string
  readonly nextSrLabel?: string
}

export interface PaginationLink {
  readonly url: string
  readonly text: string
  readonly srLabel: string
}

/** Props accepted by astro-pure's presentational Paginator component. */
export interface PaginatorProps {
  readonly prevUrl?: PaginationLink
  readonly nextUrl?: PaginationLink
}

export type ContentPaginationInput = ContentPaginationConfig | number

type ArchivePageKind = Extract<PageKind, 'blog-archive' | 'trace-archive' | 'saying-archive'>

const archivePageKinds: Record<ContentKind, ArchivePageKind> = {
  blog: 'blog-archive',
  saying: 'saying-archive',
  trace: 'trace-archive'
}

/**
 * Resolve one page size while keeping the legacy numeric helper input useful
 * for callers that have not moved to the site-level configuration yet.
 */
export function resolveContentPageSize(input: ContentPaginationInput): number {
  const config: ContentPaginationConfig =
    typeof input === 'number' ? { enabled: true, pageSize: input } : input

  if (!Number.isInteger(config.pageSize) || config.pageSize < 1) {
    throw new Error(`Content pagination pageSize must be a positive integer, got ${config.pageSize}`)
  }

  return config.enabled ? config.pageSize : Number.POSITIVE_INFINITY
}

export interface CollectionPaginationOptions {
  readonly itemOptions?: PageItemOptions
  readonly pagination: ContentPaginationInput
  /** Additional static props required by a type-specific archive view. */
  readonly props?: Record<string, unknown>
}

/**
 * Build the static paths for a type-scoped archive.
 *
 * The complete archive PageData is built before Astro slices the PageItems.
 * This preserves global card indexes and editor-approved image assignments
 * across page boundaries and keeps detail-page placements identical.
 */
export function buildCollectionStaticPaths(
  catalog: ContentCatalog,
  kind: ContentKind,
  paginate: PaginateFunction,
  options: CollectionPaginationOptions
) {
  const definition = getContentTypeDefinition(kind)
  const records = sortContentRecords(
    catalog.byKind[kind] as readonly ContentRecord[],
    definition.defaultSort
  )
  const pageSize = resolveContentPageSize(options.pagination)

  if (pageSize !== Number.POSITIVE_INFINITY) {
    const numericId = records.find((record) => /^\d+$/.test(record.id))
    if (numericId) {
      throw new Error(
        `The ${kind} id "${numericId.id}" conflicts with the numeric archive pagination route. ` +
          'Use a non-numeric content id or change the pagination URL strategy.'
      )
    }
  }

  const pageData = buildCollectionPageData(
    archivePageKinds[kind],
    definition.basePath,
    records,
    options.itemOptions
  )
  const items: PageItem[] = getPageItems(pageData, 'content', 'items')

  return paginate(items, {
    pageSize,
    ...(options.props === undefined ? {} : { props: options.props })
  })
}

/** Convert Astro's page metadata into the small prop contract of Paginator. */
export function toPaginatorProps<T>(
  page: Page<T>,
  copy: PaginationCopy = {}
): PaginatorProps {
  const previousSrLabel = copy.previousSrLabel ?? 'Previous page'
  const nextSrLabel = copy.nextSrLabel ?? 'Next page'

  return {
    ...(page.url.prev
      ? {
          prevUrl: {
          srLabel: previousSrLabel,
          text: '← Previous',
            url: page.url.prev
          }
        }
      : {}),
    ...(page.url.next
      ? {
          nextUrl: {
          srLabel: nextSrLabel,
          text: 'Next →',
            url: page.url.next
          }
        }
      : {})
  }
}
