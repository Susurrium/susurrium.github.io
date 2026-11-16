import type { CardImageAssignment } from '@/lib/card-layout/types'
import { normalizeContentPresentation } from '@/lib/compatibility/content-presentation'

import { buildContentMediaMap } from './media'
import { contentTagHref, isContentSurfaceEnabled, resolveContentPolicy } from './policy'
import { getContentYear, sortContentRecords } from './queries'
import { getContentTypeDefinition } from './registry'
import type {
  CardPlacement,
  ContentCatalog,
  ContentPresentation,
  ContentRecord,
  HeadingLevel,
  MediaCardData,
  PageData,
  PageGroup,
  PageGroupRole,
  PageItem,
  PageKind,
  PageSection,
  PageSectionRole,
  ResolvedCardImage,
  ResolvedPageItem,
  StandardCardData
} from './types'

export interface PageItemOptions {
  readonly showPinned?: boolean
  readonly actionLabel?: string
  readonly detailed?: boolean
  readonly headingLevel?: HeadingLevel
  readonly imageAssignment?: CardImageAssignment
  readonly index?: number
  readonly key?: string
  /** A page-level visual decision. Omit it to use the registry/policy default. */
  /** Canonical value, or a historical persisted value accepted at this boundary. */
  readonly presentation?: ContentPresentation | string
}

/** Detail footers display adjacent entries; keep path props bounded as the archive grows. */
export function adjacentContentRecords<T extends ContentRecord>(
  records: readonly T[],
  index: number
): T[] {
  return records.slice(Math.max(0, index - 1), index + 2)
}

function footerFor(record: ContentRecord): string {
  if (resolveContentPolicy(record.kind).tags !== 'hidden' && record.tags.length > 0)
    return record.tags.map((tag) => `#${tag}`).join(' ')
  return record.kind === 'blog' ? 'Blog' : record.kind === 'trace' ? 'Trace' : 'Saying'
}

/** Convert a domain record to the common, presentation-neutral card contract. */
export function toStandardCardData(record: ContentRecord): StandardCardData {
  const image = record.kind === 'saying' ? undefined : record.image
  return {
    contentId: record.id,
    contentType: record.kind,
    date: record.kind === 'blog' ? (record.updatedAt ?? record.publishedAt) : record.publishedAt,
    description:
      record.kind === 'saying'
        ? [record.originalText, record.author ? `— ${record.author}` : undefined]
            .filter(Boolean)
            .join(' · ') || undefined
        : record.description,
    footerText: record.kind === 'saying' ? (record.source ?? 'Saying') : footerFor(record),
    href: record.href,
    image,
    title: record.cardTitle
  }
}

/**
 * Build a page item without embedding a record, card view model, or raw source.
 * The returned object is safe to place in Astro static-path props.
 */
export function createPageItem(record: ContentRecord, options: PageItemOptions = {}): PageItem {
  const placement: CardPlacement = {
    ...(options.showPinned ? { showPinned: true } : {}),
    actionLabel: options.actionLabel ?? getContentTypeDefinition(record.kind).defaultActionLabel,
    detailed: options.detailed ?? false,
    headingLevel: options.headingLevel,
    ...(options.imageAssignment ? { imageAssignment: options.imageAssignment } : {}),
    index: options.index ?? 0,
    presentation: normalizeContentPresentation(
      options.presentation,
      resolveContentPolicy(record.kind).cardPresentation
    )
  }

  return {
    contentKey: record.key,
    key: options.key ?? record.key,
    placement
  }
}

/** Pure helper for compatibility callers that already hold a domain record. */
export function createResolvedPageItem(
  record: ContentRecord,
  options: PageItemOptions = {}
): ResolvedPageItem {
  const item = createPageItem(record, options)
  return { ...item, card: toStandardCardData(record), record }
}

export function createPageGroup(
  key: string,
  meaning: string,
  items: readonly PageItem[],
  role?: PageGroupRole
): PageGroup {
  return { items: [...items], key, meaning, ...(role === undefined ? {} : { role }) }
}

export function createPageSection(
  key: string,
  meaning: string,
  groups: readonly PageGroup[],
  title?: string,
  role?: PageSectionRole
): PageSection {
  return {
    groups: [...groups],
    key,
    meaning,
    ...(role === undefined ? {} : { role }),
    ...(title === undefined ? {} : { title })
  }
}

export function createPageData<K extends PageKind>(
  kind: K,
  route: string,
  sections: readonly PageSection[]
): PageData<K> {
  return { page: { kind, route }, sections: [...sections] }
}

export interface DetailPageDataOptions {
  readonly mediaMap?: ReadonlyMap<string, CardImageAssignment>
  readonly primaryMeaning: string
  readonly relatedGroupKey: string
  readonly relatedMeaning: string
  readonly relatedSectionMeaning: string
  /**
   * Optional placement copied from the canonical archive card for the
   * primary item.  Detail pages use this only to resolve the same image;
   * their semantic/card presentation defaults remain owned by this builder.
   */
  readonly primaryCardPlacement?: Pick<CardPlacement, 'imageAssignment' | 'index'>
}

/** Build the same primary/related hierarchy for every detail page kind. */
export function buildDetailPageData<K extends PageKind>(
  kind: K,
  route: string,
  primary: ContentRecord,
  related: readonly ContentRecord[],
  options: DetailPageDataOptions
): PageData<K> {
  const primaryItemOptions: PageItemOptions = {
    imageAssignment: options.mediaMap?.get(primary.key),
    ...(options.primaryCardPlacement?.imageAssignment
      ? { imageAssignment: options.primaryCardPlacement.imageAssignment }
      : {}),
    ...(options.primaryCardPlacement?.index !== undefined
      ? { index: options.primaryCardPlacement.index }
      : {})
  }

  return createPageData(kind, route, [
    createPageSection(
      'article',
      options.primaryMeaning,
      [
        createPageGroup(
          'primary',
          '当前正文条目',
          [createPageItem(primary, primaryItemOptions)],
          'primary'
        )
      ],
      undefined,
      'article'
    ),
    createPageSection(
      'related',
      options.relatedSectionMeaning,
      [
        createPageGroup(
          options.relatedGroupKey,
          options.relatedMeaning,
          related.map((record, index) =>
            createPageItem(record, { index, imageAssignment: options.mediaMap?.get(record.key) })
          ),
          'related'
        )
      ],
      undefined,
      'related'
    )
  ])
}

export function getPageItems(page: PageData, sectionKey: string, groupKey?: string): PageItem[] {
  const section = page.sections.find(({ key }) => key === sectionKey)
  if (!section) return []
  if (groupKey === undefined) return section.groups.flatMap(({ items }) => [...items])
  return [...(section.groups.find(({ key }) => key === groupKey)?.items ?? [])]
}

/** Resolve the Media image policy after the item has crossed the page boundary. */
export function resolveMediaImage(item: ResolvedPageItem): ResolvedCardImage {
  const { record } = item
  const assignment = item.placement.imageAssignment
  if (assignment) {
    return assignment
  }
  if (getContentTypeDefinition(record.kind).media.enabled) {
    throw new Error(`Missing canonical media assignment for ${record.key}`)
  }
  return { alt: '', decorative: true, source: 'none' as const }
}

export function toMediaCardData(item: ResolvedPageItem): MediaCardData {
  return {
    ...item.card,
    image: resolveMediaImage(item),
    ...(item.placement.showPinned && item.record.kind === 'blog' && item.record.pinned
      ? { pinned: true }
      : {})
  }
}

export function buildCollectionPageData(
  kind: PageKind,
  route: string,
  records: readonly ContentRecord[],
  options: PageItemOptions = {},
  mediaMap = buildContentMediaMap(records)
): PageData {
  const items = records.map((record, index) => {
    const imageAssignment = mediaMap.get(record.key)
    return createPageItem(record, {
      ...options,
      ...(kind === 'blog-archive' ? { showPinned: true } : {}),
      ...(imageAssignment ? { imageAssignment } : {}),
      index: options.index ?? index
    })
  })
  return createPageData(kind, route, [
    createPageSection(
      'content',
      '当前页面可展示的内容集合',
      [createPageGroup('items', '内容条目', items, 'items')],
      undefined,
      'collection'
    )
  ])
}

export function buildHomePageData(
  catalog: ContentCatalog,
  options: { readonly recentLimit?: number; readonly now?: Date } = {}
): PageData<'home'> {
  const recentLimit = Math.max(0, options.recentLimit ?? 3)
  // Read the already-normalized buckets directly. Keeping this pure page
  // builder free of the Astro `getCollection()` module makes it usable in
  // unit tests and in any non-Astro render analysis without pulling the
  // build-only catalog boundary into the runtime graph.
  const blogs = isContentSurfaceEnabled('blog', 'home') ? catalog.byKind.blog : []
  const traces = isContentSurfaceEnabled('trace', 'home') ? catalog.byKind.trace : []
  const sayings = isContentSurfaceEnabled('saying', 'home') ? catalog.byKind.saying : []
  const blogsByEditorialDate = sortContentRecords(blogs, 'editorial-date-desc')
  const blogsByPublishDate = sortContentRecords(blogs, 'publish-date-desc')
  const tracesByPublishDate = sortContentRecords(traces, 'publish-date-desc')
  const sayingsById = sortContentRecords(sayings, 'id-asc')
  const recentBlogs = blogsByEditorialDate.slice(0, recentLimit)
  const recentTraces = tracesByPublishDate.slice(0, recentLimit)
  const mediaMap = buildContentMediaMap(catalog.all)

  const yearInChina = (date: Date) => getContentYear(date)
  const currentYear = yearInChina(options.now ?? new Date())
  const availableYears = [
    ...new Set(
      blogsByPublishDate
        .map((post) => post.publishedAt)
        .filter((date): date is Date => date !== undefined)
        .map(yearInChina)
    )
  ]
    .filter((year) => year <= currentYear)
    .sort((left, right) => right - left)
  const timelineYear = availableYears[0]
  const timelineBlogs =
    timelineYear === undefined
      ? []
      : blogsByPublishDate.filter(
          (post) => post.publishedAt && yearInChina(post.publishedAt) === timelineYear
        )

  const sayingItems = sayingsById.map((record, index) => {
    const imageAssignment = mediaMap.get(record.key)
    return createPageItem(record, {
      actionLabel: 'Read',
      ...(imageAssignment ? { imageAssignment } : {}),
      index
    })
  })
  const recentBlogItems = recentBlogs.map((record, index) =>
    createPageItem(record, {
      detailed: true,
      headingLevel: 4,
      index,
      imageAssignment: mediaMap.get(record.key)
    })
  )
  const recentTraceItems = recentTraces.map((record, index) =>
    createPageItem(record, {
      actionLabel: 'Read',
      index,
      headingLevel: 4,
      imageAssignment: mediaMap.get(record.key)
    })
  )
  const timelineItems = timelineBlogs.map((record, index) =>
    createPageItem(record, { index, imageAssignment: mediaMap.get(record.key) })
  )

  return createPageData('home', '/home', [
    createPageSection(
      'featured-saying',
      'Home 顶部随机 Saying 的候选内容',
      [createPageGroup('candidates', '可随机选择的已发布 Saying', sayingItems, 'candidates')],
      undefined,
      'featured'
    ),
    createPageSection(
      'recent-writing',
      'Home 最近更新的两类写作内容',
      [
        createPageGroup('blog', '最近的 Blog', recentBlogItems, 'items'),
        createPageGroup('trace', '最近的 Trace', recentTraceItems, 'items')
      ],
      'Recent',
      'collection'
    ),
    createPageSection(
      'blog-timeline',
      '由 Blog 发布时间生成的时间线',
      [
        createPageGroup(
          timelineYear === undefined ? 'empty' : `year-${timelineYear}`,
          timelineYear === undefined ? '没有可展示的 Blog 年份' : `${timelineYear} 年的 Blog`,
          timelineItems,
          'year'
        )
      ],
      undefined,
      'timeline'
    )
  ])
}

/** Create a type-scoped tag link for non-card callers. */
export function pageTagHref(record: ContentRecord, tag: string): string {
  return contentTagHref(record.kind, tag)
}
