import type { ImageMetadata } from 'astro'

import { imageSourceUrl } from './adapters'
import { resolveMediaImage } from './page-data'
import { resolveContentPolicy } from './policy'
import { contentLabel, contentPath, contentTagPath } from './registry'
import type { BlogEntry, ContentKind, ContentRecord, RenderablePageItem } from './types'

export type ReadingImageSource = ImageMetadata | string

export interface ReadingTagData {
  readonly href: string
  readonly label: string
}

/** Media prepared for a reading page, separate from card crop/media data. */
export interface ReadingOpeningMediaData {
  readonly alt: string
  readonly color?: string
  readonly key: string
  readonly source: ReadingImageSource
  readonly src: string
}

export interface ReadingQuoteData {
  readonly author?: string
  readonly originalText?: string
  readonly source?: string
  readonly sourceUrl?: string
  readonly text: string
}

/** Static reading metrics projected once for every detail-page type. */
export interface ReadingStatsData {
  readonly language?: string
  readonly publishedAt?: Date
  readonly readingTime?: string
  readonly updatedAt?: Date
}

export interface ReadingHeaderData {
  readonly accessibleTitle: string
  readonly commentInfo: boolean
  readonly eyebrow?: string
  readonly description?: string
  readonly draft: boolean
  readonly meta: ReadingStatsData
  readonly openingMedia?: ReadingOpeningMediaData
  readonly quote?: ReadingQuoteData
  readonly tags: readonly ReadingTagData[]
  readonly title: string
}

/** Render input for the reading-surface background capability. */
export interface ReadingBackgroundData {
  readonly color: string
}

export interface ReadingNavigationItem {
  readonly contentType: ContentKind
  readonly href: string
  readonly key: string
  readonly title: string
}

export interface ReadingNavigationModel {
  readonly next?: ReadingNavigationItem
  readonly previous?: ReadingNavigationItem
}

export interface ReadingCommentPolicy {
  readonly enabled: boolean
  readonly showPageInfo: boolean
}

export interface ReadingCopyrightData {
  readonly heroImage?: { readonly src?: string }
  readonly publishDate?: Date
  readonly text?: string
  readonly title: string
}

export interface ReadingFooterData {
  readonly commentsEnabled: boolean
  readonly copyright: ReadingCopyrightData
  readonly navigation: ReadingNavigationModel
  readonly relatedItems: readonly RenderablePageItem[]
}

export type ReadingCommentMode = 'auto' | 'on' | 'off'

export interface ReadingFrameData {
  readonly backHref: string
  readonly contentTypeLabel: string
  readonly meta: {
    readonly articleDate?: string
    readonly articleModifiedDate?: string
    readonly description: string
    readonly ogImage?: string
    readonly title: string
  }
}

export interface ReadingPresentationData {
  readonly headerProfile: ReturnType<typeof resolveContentPolicy>['readingHeader']
  readonly relatedProfile: ReturnType<typeof resolveContentPolicy>['related']
}

/*
 * `RenderablePageItem` keeps the raw collection entry alongside the canonical
 * record, but Astro's generated loader types do not narrow `source.data` when
 * the two discriminants are checked together.  This small read-only facade
 * describes only the media fields used below and keeps the narrowing explicit.
 */
type ReadingSourceData = {
  readonly cover?: ImageMetadata | string
  readonly coverAlt?: string
  readonly heroImage?: {
    readonly alt?: string
    readonly color?: string
    readonly src: ImageMetadata | string
  }
}

function displayTitle(record: ContentRecord): string {
  if (record.kind !== 'saying' || record.title.length <= 60) return record.title
  return `${record.title.slice(0, 57)}…`
}

function navigationItem(item: RenderablePageItem): ReadingNavigationItem {
  return {
    contentType: item.record.kind,
    href: item.record.href,
    key: item.contentKey,
    title: item.record.title
  }
}

function normalizeReadingTime(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim().length > 0) return value
  return undefined
}

/**
 * Project static metrics independently of header layout.  A missing value is
 * intentionally omitted so a renderer can hide it instead of inventing data.
 */
export function toReadingStatsData(
  item: RenderablePageItem,
  readingTime?: number | string
): ReadingStatsData {
  const { record } = item

  return {
    language: record.kind === 'blog' ? record.language : undefined,
    publishedAt: record.publishedAt,
    readingTime: normalizeReadingTime(
      readingTime ?? ('readingMinutes' in item ? item.readingMinutes : undefined)
    ),
    updatedAt: record.updatedAt
  }
}

/**
 * Resolve the current background input without coupling the renderer to a
 * collection. Explicit page input wins, then media-provided color, then the
 * shared reading fallback.
 */
export function toReadingBackgroundData(
  headerData: Pick<ReadingHeaderData, 'openingMedia'>,
  fallbackColor: string,
  explicitColor?: string
): ReadingBackgroundData {
  return {
    color: explicitColor ?? headerData.openingMedia?.color ?? fallbackColor
  }
}

function toOpeningMedia(item: RenderablePageItem): ReadingOpeningMediaData | undefined {
  const data = item.source.data as unknown as ReadingSourceData
  if (item.record.kind === 'blog') {
    const source = data.heroImage?.src
    const src = imageSourceUrl(source)
    if (!source || !src) return undefined

    return {
      alt: data.heroImage?.alt || item.record.title,
      ...(data.heroImage?.color && { color: data.heroImage.color }),
      key: item.contentKey,
      source: source as ReadingImageSource,
      src
    }
  }

  /**
   * Trace and Saying deliberately reuse the exact image decision used by the
   * Media card.  This includes archive assignments, Trace fallbacks and
   * Saying's decorative image rotation; reading headers must not reimplement
   * any of those rules from raw collection fields.
   */
  const cardImage = resolveMediaImage(item)
  if (!cardImage.src) return undefined

  // Preserve Astro image metadata for a Trace cover when it is the same
  // resolved asset. Fallback/decorative assets are already public URL strings.
  const rawTraceSource = item.record.kind === 'trace' ? data.cover : undefined
  const rawTraceSourceUrl = imageSourceUrl(rawTraceSource)
  const source: ReadingImageSource =
    rawTraceSource && rawTraceSourceUrl === cardImage.src
      ? (rawTraceSource as ReadingImageSource)
      : cardImage.src

  return {
    alt: cardImage.decorative ? '' : cardImage.alt || item.record.title,
    key: cardImage.key ?? item.contentKey,
    source,
    src: cardImage.src
  }
}

export interface ReadingHeaderDataOptions {
  /** Generated by the Markdown renderer at the detail-page boundary. */
  readonly readingTime?: number | string
  readonly commentInfo?: boolean
}

/**
 * Project one renderable content item into the common header data contract.
 * Source collection fields are interpreted here once; reading components only
 * receive this normalized model and never inspect Blog/Trace/Saying schemas.
 */
export function toReadingHeaderData(
  item: RenderablePageItem,
  options: ReadingHeaderDataOptions = {}
): ReadingHeaderData {
  const { record } = item
  const quote =
    record.kind === 'saying'
      ? {
          author: record.author,
          originalText: record.originalText,
          source: record.source,
          sourceUrl: record.sourceUrl,
          text: record.title
        }
      : undefined

  return {
    accessibleTitle: `${contentLabel(record.kind)}: ${record.title}`,
    commentInfo: options.commentInfo ?? false,
    eyebrow: contentLabel(record.kind),
    description: record.description,
    draft: record.draft,
    meta: toReadingStatsData(item, options.readingTime),
    openingMedia: toOpeningMedia(item),
    ...(quote && { quote }),
    tags: record.tags.map((tag) => ({ href: contentTagPath(record.kind, tag), label: tag })),
    title: record.title
  }
}

/**
 * Related detail items retain their page-defined order and include the primary
 * item. Derive adjacent links from canonical keys rather than source entries.
 */
export function toReadingNavigation(
  primary: RenderablePageItem,
  related: readonly RenderablePageItem[]
): ReadingNavigationModel {
  const index = related.findIndex((item) => item.contentKey === primary.contentKey)
  if (index < 0) return {}

  return {
    ...(related[index - 1] && { previous: navigationItem(related[index - 1]!) }),
    ...(related[index + 1] && { next: navigationItem(related[index + 1]!) })
  }
}

/**
 * Prepare the one legacy related renderer that still requires raw Blog
 * collection entries.  This is deliberately an adapter-level exception: the
 * public ReadingRelated component selects it by renderer variant and never
 * decides from `ContentKind`.
 */
export interface ReadingArticleBottomData {
  readonly collections: BlogEntry[]
  readonly id: string
}

export function toReadingArticleBottomData(
  primary: RenderablePageItem,
  related: readonly RenderablePageItem[]
): ReadingArticleBottomData | undefined {
  if (primary.record.kind !== 'blog') return undefined

  return {
    collections: related
      .filter(
        (item): item is Extract<RenderablePageItem, { record: { kind: 'blog' } }> =>
          item.record.kind === 'blog'
      )
      .map((item) => item.source),
    id: primary.record.id
  }
}

export function toReadingFooterData(
  primary: RenderablePageItem,
  related: readonly RenderablePageItem[],
  walineEnabled: boolean,
  commentMode: ReadingCommentMode = 'auto'
): ReadingFooterData {
  const commentPolicy = toReadingCommentPolicy(primary.record, walineEnabled, commentMode)
  return {
    commentsEnabled: commentPolicy.enabled,
    copyright: toReadingCopyrightData(primary.record),
    navigation: toReadingNavigation(primary, related),
    relatedItems: related
  }
}

export function toReadingPresentationData(kind: ContentKind): ReadingPresentationData {
  const policy = resolveContentPolicy(kind)
  return {
    headerProfile: policy.readingHeader,
    relatedProfile: policy.related
  }
}

export function toReadingFrameData(record: ContentRecord): ReadingFrameData {
  const title = displayTitle(record)
  const articleDate = record.publishedAt?.toISOString()
  const articleModifiedDate = record.updatedAt?.toISOString()

  return {
    backHref: contentPath(record.kind),
    contentTypeLabel: contentLabel(record.kind),
    meta: {
      ...(articleDate && { articleDate }),
      ...(articleModifiedDate && { articleModifiedDate }),
      description: record.description ?? record.title,
      ...(record.kind === 'blog' && {
        ogImage: record.image?.src ?? '/images/social-card.webp'
      }),
      title
    }
  }
}

export function toReadingCopyrightData(record: ContentRecord): ReadingCopyrightData {
  return {
    ...(record.kind === 'blog' && record.image?.src && { heroImage: { src: record.image.src } }),
    ...(record.publishedAt && { publishDate: record.publishedAt }),
    ...(record.kind === 'saying' && { text: record.title }),
    title: displayTitle(record)
  }
}

export function toReadingCommentPolicy(
  record: ContentRecord,
  walineEnabled: boolean,
  mode: ReadingCommentMode = 'auto'
): ReadingCommentPolicy {
  const policy = resolveContentPolicy(record.kind)
  if (mode === 'off') return { enabled: false, showPageInfo: false }

  if (mode === 'on') {
    const enabled = walineEnabled && !record.draft && (record.kind !== 'blog' || record.comment)
    return {
      enabled,
      showPageInfo: enabled
    }
  }

  const enabledByType =
    policy.comments === 'enabled' || (policy.comments === 'auto' && record.kind !== 'blog')
  const enabled =
    walineEnabled &&
    policy.comments !== 'disabled' &&
    !record.draft &&
    (record.kind !== 'blog' ? enabledByType : record.comment)

  return {
    enabled,
    showPageInfo: enabled
  }
}
