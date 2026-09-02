import type { CollectionEntry } from 'astro:content'
import type { CardCropRuntime, CardImageSide, CardLayoutVariant } from '@/lib/card-crop/types'
import type { CardImageAssignment } from '@/lib/card-layout/types'

/**
 * The content layer owns these names.  `home-media.ts` re-exports the two
 * presentation types for the existing visual modules, so the migration does
 * not create a second vocabulary for cards.
 */
export type ContentKind = 'blog' | 'trace' | 'saying'

export type ContentPresentation = 'text' | 'media-content' | 'media-decorative'

/** Build-time reading-header profiles. They describe semantics, not a source collection. */
export type ReadingHeaderProfile = 'article' | 'hero' | 'quote'

/** Build-time related-content profiles. */
export type ReadingRelatedProfile = 'adjacent' | 'recommendations' | 'none'

/** Surfaces on which a content type may participate. */
export type ContentSurface =
  | 'archive'
  | 'copyright'
  | 'home'
  | 'main-nav'
  | 'reading'
  | 'rss'
  | 'search'
  | 'tags'

export interface ContentCapabilities {
  readonly comments: boolean
  readonly dates: boolean
  readonly images: boolean
  readonly related: boolean
  readonly tags: boolean
}

export type PageKind =
  | 'home'
  | 'blog-archive'
  | 'blog-tag'
  | 'blog-year-archive'
  | 'trace-archive'
  | 'saying-archive'
  | 'blog-detail'
  | 'trace-detail'
  | 'saying-detail'

export type HeadingLevel = 2 | 3 | 4 | 5 | 6

export type BlogEntry = CollectionEntry<'blog'>
export type TraceEntry = CollectionEntry<'trace'>
export type SayingEntry = CollectionEntry<'saying'>
export type AnyContentEntry = BlogEntry | TraceEntry | SayingEntry

export type ImageSource = 'content' | 'fallback' | 'decorative' | 'none'

export interface ContentImageInput {
  readonly src: string
  readonly alt?: string
  readonly key?: string
}

export interface ResolvedCardImage {
  readonly key?: string
  readonly src?: string
  readonly alt: string
  readonly decorative: boolean
  readonly source: ImageSource
  /** Explicit editor-approved crop; absent means use the legacy safe fallback. */
  readonly crop?: CardCropRuntime
  /** Development/QA metadata emitted by the archive queue planner. */
  readonly imageSide?: CardImageSide
  readonly layoutVariant?: CardLayoutVariant
  readonly occurrence?: number
  readonly repeated?: boolean
}

export interface ContentRecordBase {
  /** Stable identity across every page projection. */
  readonly key: string
  readonly kind: ContentKind
  /** Astro collection id; also the stable route slug. */
  readonly id: string
  readonly href: string
  /** Semantic primary text.  Saying uses its quote text here. */
  readonly title: string
  /** Exact title text used by a generic card projection. */
  readonly cardTitle: string
  readonly description?: string
  readonly publishedAt?: Date
  readonly updatedAt?: Date
  readonly tags: readonly string[]
  readonly draft: boolean
}

export interface BlogRecord extends ContentRecordBase {
  readonly kind: 'blog'
  readonly language?: string
  readonly comment: boolean
  readonly image?: ContentImageInput
}

export interface TraceRecord extends ContentRecordBase {
  readonly kind: 'trace'
  readonly image?: ContentImageInput
}

export interface SayingRecord extends ContentRecordBase {
  readonly kind: 'saying'
  readonly originalText?: string
  readonly author?: string
  readonly source?: string
  readonly sourceUrl?: string
}

export type ContentRecord = BlogRecord | TraceRecord | SayingRecord
export type ContentRecordOf<K extends ContentKind> = Extract<ContentRecord, { kind: K }>

/**
 * The data contract for one genuinely identical card visual.
 *
 * It intentionally contains no Astro collection entry and no content-type
 * schema.  A Blog, Trace, or Saying adapter can produce this same shape; the
 * visual component does not need one implementation per source collection.
 */
export interface StandardCardData {
  readonly contentId: string
  readonly contentType: ContentKind
  readonly date?: Date
  readonly description?: string
  readonly footerText: string
  readonly href: string
  readonly image?: ContentImageInput
  readonly title: string
}

/** Standard data plus the resolved image policy required by Media. */
export type MediaCardData = Omit<StandardCardData, 'image'> & {
  readonly image: ResolvedCardImage
}

export interface CardPlacement {
  readonly actionLabel?: string
  readonly detailed: boolean
  readonly headingLevel?: HeadingLevel
  /** Explicit archive image choice; absent for non-archive/legacy callers. */
  readonly imageAssignment?: CardImageAssignment
  readonly index: number
  readonly presentation: ContentPresentation
}

/**
 * One item in the common page tree.
 *
 * PageData intentionally stores only a stable content reference and placement
 * information. The domain record, card view model and raw Astro entry are
 * resolved later at the render boundary. This prevents a page builder from
 * accidentally coupling its public data shape to one card implementation.
 */
export interface PageItem {
  /** Unique within the page tree; repeated content may use another placement key. */
  readonly key: string
  readonly contentKey: string
  readonly placement: CardPlacement
}

/** A PageItem after its canonical domain record has been resolved. */
export type ResolvedPageItem = PageItem & {
  readonly record: ContentRecord
  readonly card: StandardCardData
}

/**
 * A render boundary may reattach the raw Astro entry by stable key.  The raw
 * entry is intentionally absent from `PageData` itself so static path props
 * stay small and serializable.
 */
export type RenderablePageItem =
  | (ResolvedPageItem & {
      readonly record: BlogRecord
      readonly source: BlogEntry
      readonly readingMinutes?: number | string
    })
  | (ResolvedPageItem & {
      readonly record: TraceRecord
      readonly source: TraceEntry
      readonly readingMinutes?: number | string
    })
  | (ResolvedPageItem & {
      readonly record: SayingRecord
      readonly source: SayingEntry
      readonly readingMinutes?: number | string
    })

export type PageSectionRole =
  | 'article'
  | 'collection'
  | 'featured'
  | 'related'
  | 'timeline'
  | 'taxonomy'
export type PageGroupRole = 'candidates' | 'items' | 'primary' | 'related' | 'year'

export interface PageGroup {
  readonly key: string
  /** Human-readable semantic meaning of this group on its page. */
  readonly meaning: string
  /** Stable machine-readable role used by generic page renderers. */
  readonly role?: PageGroupRole
  readonly items: readonly PageItem[]
}

export interface PageSection {
  readonly key: string
  /** Human-readable semantic meaning of this section on its page. */
  readonly meaning: string
  /** Stable machine-readable role used by generic page renderers. */
  readonly role?: PageSectionRole
  readonly title?: string
  readonly groups: readonly PageGroup[]
}

/**
 * The fixed outer hierarchy used by every list/detail page:
 * page -> sections -> groups -> items.
 *
 * A page gives its own meaning to section/group keys, but it never invents a
 * second top-level data shape.  This is the boundary between content data and
 * page composition.
 */
export interface PageData<K extends PageKind = PageKind> {
  readonly page: {
    readonly kind: K
    readonly route: string
  }
  readonly sections: readonly PageSection[]
}

export interface ContentCatalog {
  readonly mode: 'published' | 'preview'
  readonly all: readonly ContentRecord[]
  readonly byKind: {
    readonly blog: readonly BlogRecord[]
    readonly trace: readonly TraceRecord[]
    readonly saying: readonly SayingRecord[]
  }
}

export interface ContentCatalogSources {
  readonly byKind: {
    readonly blog: readonly BlogEntry[]
    readonly trace: readonly TraceEntry[]
    readonly saying: readonly SayingEntry[]
  }
}

export interface LoadedContentCatalog extends ContentCatalog {
  /** Build-time source entries; never embedded in PageData or serialized props. */
  readonly sources: ContentCatalogSources
}

export type ContentSort = 'editorial-date-desc' | 'publish-date-desc' | 'id-asc'

export interface ContentQuery {
  readonly kinds?: readonly ContentKind[]
  readonly tag?: string
  readonly sort?: ContentSort
  readonly limit?: number
  readonly offset?: number
}
