import type {
  ContentCapabilities,
  ContentKind,
  ContentPresentation,
  ContentSort,
  ReadingHeaderProfile,
  ReadingRelatedProfile
} from './types'

export interface ContentTypeDefinition {
  readonly kind: ContentKind
  readonly label: string
  readonly pluralLabel: string
  readonly basePath: string
  readonly tagPath: string
  readonly defaultSort: ContentSort
  readonly capabilities: ContentCapabilities
  readonly defaults: {
    readonly cardPresentation: ContentPresentation
    readonly readingHeader: ReadingHeaderProfile
    readonly related: ReadingRelatedProfile
  }
  /** Accessible/action copy used by the Media family when no page override is set. */
  readonly defaultActionLabel: string
}

/**
 * The one compile-time registry for public content types.
 *
 * Physical Astro collections remain independent. The registry only describes
 * how a collection participates in shared infrastructure; it is deliberately
 * not a runtime plugin system. Adding a type therefore remains statically
 * checkable and requires no changes in generic card or page components.
 */
export const contentTypeRegistry = {
  blog: {
    basePath: '/blog',
    capabilities: {
      comments: true,
      dates: true,
      images: true,
      related: true,
      tags: true
    },
    defaults: {
      cardPresentation: 'text',
      readingHeader: 'hero',
      related: 'recommendations'
    },
    defaultSort: 'editorial-date-desc',
    defaultActionLabel: 'Read Blog',
    kind: 'blog',
    label: 'Blog',
    pluralLabel: 'Blog',
    tagPath: '/blog/tags'
  },
  trace: {
    basePath: '/traces',
    capabilities: {
      comments: true,
      dates: true,
      images: true,
      related: true,
      tags: true
    },
    defaults: {
      cardPresentation: 'media-content',
      readingHeader: 'article',
      related: 'adjacent'
    },
    defaultSort: 'publish-date-desc',
    defaultActionLabel: 'Read Trace',
    kind: 'trace',
    label: 'Trace',
    pluralLabel: 'Traces',
    tagPath: '/traces/tags'
  },
  saying: {
    basePath: '/sayings',
    capabilities: {
      comments: true,
      dates: false,
      images: false,
      related: true,
      tags: true
    },
    defaults: {
      cardPresentation: 'media-decorative',
      readingHeader: 'quote',
      related: 'adjacent'
    },
    defaultSort: 'id-asc',
    defaultActionLabel: 'View complete saying',
    kind: 'saying',
    label: 'Saying',
    pluralLabel: 'Sayings',
    tagPath: '/sayings/tags'
  }
} as const satisfies Record<ContentKind, ContentTypeDefinition>

export const contentKinds = Object.keys(contentTypeRegistry) as ContentKind[]

export function getContentTypeDefinition(kind: ContentKind): ContentTypeDefinition {
  return contentTypeRegistry[kind]
}

export function contentPath(kind: ContentKind, id?: string): string {
  const basePath = getContentTypeDefinition(kind).basePath
  if (
    id !== undefined &&
    (id.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
      id.split('/')[0] === 'tags')
  ) {
    throw new Error(
      `Invalid ${kind} content id "${id}": use nonempty path segments and avoid the reserved tags route.`
    )
  }
  return id === undefined
    ? basePath
    : `${basePath}/${id.split('/').map(encodeURIComponent).join('/')}`
}

/** Keep ordinary tag URLs; reserve a reversible single-segment slug for URL delimiters. */
export function contentTagSlug(tag: string): string {
  return /[/\\?#%]|^~/.test(tag)
    ? `~${encodeURIComponent(tag).replace(/_/g, '%5F').replace(/%/g, '_')}`
    : tag
}

export function contentTagLabel(slug: string): string {
  return slug.startsWith('~') ? decodeURIComponent(slug.slice(1).replace(/_/g, '%')) : slug
}

export function contentTagPath(kind: ContentKind, tag?: string): string {
  const tagPath = getContentTypeDefinition(kind).tagPath
  return tag === undefined ? tagPath : `${tagPath}/${encodeURIComponent(contentTagSlug(tag))}`
}

export function contentLabel(kind: ContentKind): string {
  return getContentTypeDefinition(kind).label
}
