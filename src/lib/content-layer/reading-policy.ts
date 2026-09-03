import { contentPolicyConfig, resolveContentPolicy, type ContentPolicyConfig } from './policy'
import type { ContentKind, PageKind, ReadingHeaderProfile, ReadingRelatedProfile } from './types'

/** Detail-page kinds that have a reading surface. */
export type ReadingDetailPageKind = Extract<
  PageKind,
  'blog-detail' | 'trace-detail' | 'saying-detail'
>

/** A feature may follow data availability, be explicitly requested, or be hidden. */
export type ReadingFeatureMode = 'auto' | 'on' | 'off'

/** Visual implementations of the reading surface background capability. */
export type ReadingBackgroundVariant = 'gradient'

export interface ReadingBackgroundConfig {
  readonly mode: ReadingFeatureMode
  readonly variant: ReadingBackgroundVariant
}

/** Tag content remains type-scoped; only its local presentation mode is shared. */
export type ReadingTagMode = 'hidden' | 'links' | 'plain'

/** Layouts describe semantic order, not a source collection. */
export type ReadingHeaderLayout = 'article' | 'media-first-article' | 'quote'

/** Visual implementations of the common opening-media capability. */
export type ReadingMediaVariant = 'standard' | 'layered-blur'

/** Backdrop implementations attached to opening media, rather than to a type. */
export type ReadingOpeningMediaBackdropVariant = 'blur' | 'projected-blur'

export interface ReadingOpeningMediaBackdropConfig {
  readonly mode: ReadingFeatureMode
  readonly variant: ReadingOpeningMediaBackdropVariant
}

export interface ReadingOpeningMediaConfig {
  readonly mode: ReadingFeatureMode
  readonly variant: ReadingMediaVariant
  readonly backdrop: ReadingOpeningMediaBackdropConfig
}

/** Date/meta formatting is a presentation choice, not a content type branch. */
export type ReadingMetadataVariant = 'article' | 'blog'

export type ReadingDescriptionVariant = 'plain' | 'quoted'

export type ReadingRelatedMode = 'none' | 'adjacent' | 'recommendations'

/**
 * A related-content renderer is a visual compatibility choice, not a
 * collection check.  `article-bottom` keeps Blog's established Astro Pure
 * output; `cards` is the source-agnostic fallback for future types.
 */
export type ReadingRelatedVariant = 'article-bottom' | 'cards'

/**
 * Resolve a capability switch at the render boundary.  Neither `auto` nor
 * `on` invents missing content; both preserve the no-fake-data rule.
 */
export function isReadingFeatureVisible(mode: ReadingFeatureMode, available: boolean): boolean {
  return mode !== 'off' && available
}

/** Static metrics are one public capability; tags remain a separate capability. */
export interface ReadingStatsConfig {
  readonly publishedDate: ReadingFeatureMode
  readonly updatedDate: ReadingFeatureMode
  readonly readingTime: ReadingFeatureMode
  readonly language: ReadingFeatureMode
}

export interface ReadingHeaderConfig extends ReadingStatsConfig {
  readonly layout: ReadingHeaderLayout
  readonly metadataVariant: ReadingMetadataVariant
  readonly openingMedia: ReadingOpeningMediaConfig
  readonly draft: ReadingFeatureMode
  readonly tags: ReadingTagMode
  readonly description: {
    readonly mode: ReadingFeatureMode
    readonly variant: ReadingDescriptionVariant
  }
  readonly commentInfo: ReadingFeatureMode
  readonly quoteOriginal: ReadingFeatureMode
  readonly quoteAttribution: ReadingFeatureMode
  readonly quoteSourceLink: ReadingFeatureMode
  readonly divider: ReadingFeatureMode
}

export interface ReadingBodyConfig {
  readonly imageZoom: ReadingFeatureMode
  readonly signature: ReadingFeatureMode
}

export interface ReadingFooterConfig {
  readonly copyright: ReadingFeatureMode
  readonly related: ReadingRelatedMode
  readonly relatedVariant: ReadingRelatedVariant
  readonly comments: ReadingFeatureMode
}

export interface ReadingPageConfig {
  readonly background: ReadingBackgroundConfig
  readonly pageKind: ReadingDetailPageKind
  readonly contentKind: ContentKind
  readonly header: ReadingHeaderConfig
  readonly body: ReadingBodyConfig
  readonly footer: ReadingFooterConfig
}

export interface ReadingHeaderConfigOverride {
  readonly layout?: ReadingHeaderLayout
  readonly metadataVariant?: ReadingMetadataVariant
  readonly openingMedia?: {
    readonly mode?: ReadingFeatureMode
    readonly variant?: ReadingMediaVariant
    readonly backdrop?: Partial<ReadingOpeningMediaBackdropConfig>
  }
  readonly draft?: ReadingFeatureMode
  readonly publishedDate?: ReadingFeatureMode
  readonly updatedDate?: ReadingFeatureMode
  readonly readingTime?: ReadingFeatureMode
  readonly language?: ReadingFeatureMode
  readonly tags?: ReadingTagMode
  readonly description?: Partial<ReadingHeaderConfig['description']>
  readonly commentInfo?: ReadingFeatureMode
  readonly quoteOriginal?: ReadingFeatureMode
  readonly quoteAttribution?: ReadingFeatureMode
  readonly quoteSourceLink?: ReadingFeatureMode
  readonly divider?: ReadingFeatureMode
}

export interface ReadingPageConfigOverride {
  readonly background?: Partial<ReadingBackgroundConfig>
  readonly header?: ReadingHeaderConfigOverride
  readonly body?: Partial<ReadingBodyConfig>
  readonly footer?: Partial<ReadingFooterConfig>
}

/**
 * Page-level presentation switches.  The keys are page meanings, so a future
 * content type can opt into an existing reading recipe without changing the
 * shared header/footer orchestration.
 */
export interface ReadingPageConfigRegistry {
  readonly overrides: Partial<Record<ReadingDetailPageKind, ReadingPageConfigOverride>>
}

/**
 * The editable page-level layer.  Keep content records free of these choices:
 * one article can be rendered by more than one page, while each page remains
 * free to decide which common capabilities it exposes.
 */
export const readingPageConfig: ReadingPageConfigRegistry = {
  overrides: {
    'blog-detail': {
      body: { signature: 'off' }
    }
  }
}

export interface ResolveReadingPageConfigOptions {
  readonly contentPolicy?: ContentPolicyConfig
  readonly pageConfig?: ReadingPageConfigRegistry
  readonly override?: ReadingPageConfigOverride
}

type ReadingPageDefaults = Omit<ReadingPageConfig, 'contentKind' | 'pageKind'>

const articleHeader = (options: Partial<ReadingHeaderConfig> = {}): ReadingHeaderConfig => ({
  commentInfo: 'off',
  description: { mode: 'auto', variant: 'quoted' },
  divider: 'on',
  draft: 'off',
  language: 'off',
  layout: 'article',
  metadataVariant: 'article',
  openingMedia: {
    backdrop: { mode: 'off', variant: 'blur' },
    mode: 'off',
    variant: 'standard'
  },
  publishedDate: 'on',
  quoteAttribution: 'off',
  quoteOriginal: 'off',
  quoteSourceLink: 'off',
  readingTime: 'off',
  tags: 'links',
  updatedDate: 'auto',
  ...options
})

const baselineReadingPages: Record<ReadingDetailPageKind, ReadingPageDefaults> = {
  'blog-detail': {
    body: { imageZoom: 'on', signature: 'on' },
    background: { mode: 'on', variant: 'gradient' },
    footer: {
      comments: 'auto',
      copyright: 'auto',
      related: 'recommendations',
      relatedVariant: 'article-bottom'
    },
    header: {
      commentInfo: 'auto',
      description: { mode: 'on', variant: 'quoted' },
      divider: 'on',
      draft: 'auto',
      language: 'auto',
      layout: 'media-first-article',
      metadataVariant: 'blog',
      openingMedia: {
        backdrop: { mode: 'on', variant: 'projected-blur' },
        mode: 'auto',
        variant: 'layered-blur'
      },
      publishedDate: 'on',
      quoteAttribution: 'off',
      quoteOriginal: 'off',
      quoteSourceLink: 'off',
      readingTime: 'on',
      tags: 'links',
      updatedDate: 'auto'
    }
  },
  'trace-detail': {
    body: { imageZoom: 'off', signature: 'off' },
    background: { mode: 'on', variant: 'gradient' },
    footer: {
      comments: 'auto',
      copyright: 'off',
      related: 'adjacent',
      relatedVariant: 'cards'
    },
    header: articleHeader({
      commentInfo: 'auto',
      description: { mode: 'auto', variant: 'quoted' },
      openingMedia: {
        backdrop: { mode: 'on', variant: 'projected-blur' },
        mode: 'auto',
        variant: 'layered-blur'
      },
      publishedDate: 'on',
      updatedDate: 'auto'
    })
  },
  'saying-detail': {
    body: { imageZoom: 'off', signature: 'off' },
    background: { mode: 'on', variant: 'gradient' },
    footer: {
      comments: 'auto',
      copyright: 'off',
      related: 'adjacent',
      relatedVariant: 'cards'
    },
    header: {
      commentInfo: 'auto',
      description: { mode: 'off', variant: 'plain' },
      divider: 'on',
      draft: 'off',
      language: 'off',
      layout: 'quote',
      metadataVariant: 'article',
      openingMedia: {
        backdrop: { mode: 'on', variant: 'projected-blur' },
        mode: 'auto',
        variant: 'layered-blur'
      },
      publishedDate: 'off',
      quoteAttribution: 'auto',
      quoteOriginal: 'auto',
      quoteSourceLink: 'auto',
      readingTime: 'off',
      tags: 'links',
      updatedDate: 'off'
    }
  }
}

const pageKindForContentKind: Record<ContentKind, ReadingDetailPageKind> = {
  blog: 'blog-detail',
  saying: 'saying-detail',
  trace: 'trace-detail'
}

function modeFromCommentPolicy(mode: 'auto' | 'enabled' | 'disabled'): ReadingFeatureMode {
  if (mode === 'disabled') return 'off'
  if (mode === 'enabled') return 'on'
  return 'auto'
}

function layoutFromLegacyProfile(profile: ReadingHeaderProfile): ReadingHeaderLayout {
  if (profile === 'hero') return 'media-first-article'
  if (profile === 'quote') return 'quote'
  return 'article'
}

function relatedFromLegacyProfile(profile: ReadingRelatedProfile): ReadingRelatedMode {
  return profile
}

function mergeHeader(
  base: ReadingHeaderConfig,
  override: ReadingHeaderConfigOverride | undefined
): ReadingHeaderConfig {
  if (!override) {
    return {
      ...base,
      description: { ...base.description },
      openingMedia: {
        ...base.openingMedia,
        backdrop: { ...base.openingMedia.backdrop }
      }
    }
  }

  return {
    ...base,
    ...override,
    description: { ...base.description, ...override.description },
    openingMedia: {
      ...base.openingMedia,
      ...override.openingMedia,
      backdrop: {
        ...base.openingMedia.backdrop,
        ...override.openingMedia?.backdrop
      }
    }
  }
}

/**
 * Resolve a complete reading-page configuration.
 *
 * The old content policy remains a valid source of global/type defaults. A
 * page preset then makes the detail-page decision explicit, and a typed page
 * override is applied last. Components never need to inspect ContentKind to
 * decide whether a feature should be rendered.
 */
export function resolveReadingPageConfig(
  pageKind: ReadingDetailPageKind | undefined,
  contentKind: ContentKind,
  options: ResolveReadingPageConfigOptions = {}
): ReadingPageConfig {
  const resolvedPageKind = pageKind ?? pageKindForContentKind[contentKind]
  const defaults = baselineReadingPages[resolvedPageKind]
  const pageOverride = (options.pageConfig ?? readingPageConfig).overrides[resolvedPageKind]
  const contentPolicy = resolveContentPolicy(
    contentKind,
    options.contentPolicy ?? contentPolicyConfig
  )

  const policyHeader: ReadingHeaderConfigOverride = {
    layout: layoutFromLegacyProfile(contentPolicy.readingHeader),
    tags: contentPolicy.tags,
    ...(contentPolicy.comments === 'disabled' ? { commentInfo: 'off' as const } : {})
  }

  const policyFooter: Partial<ReadingFooterConfig> = {
    comments: modeFromCommentPolicy(contentPolicy.comments),
    copyright: contentPolicy.surfaces.copyright ? 'auto' : 'off',
    related: relatedFromLegacyProfile(contentPolicy.related)
  }

  let header = mergeHeader(defaults.header, policyHeader)
  header = mergeHeader(header, pageOverride?.header)
  header = mergeHeader(header, options.override?.header)

  return {
    background: {
      ...defaults.background,
      ...pageOverride?.background,
      ...options.override?.background
    },
    contentKind,
    footer: {
      ...defaults.footer,
      ...policyFooter,
      ...pageOverride?.footer,
      ...options.override?.footer
    },
    header,
    pageKind: resolvedPageKind,
    body: {
      ...defaults.body,
      ...pageOverride?.body,
      ...options.override?.body
    }
  }
}

/** Runtime-free validation for build-time configuration diagnostics. */
export function validateReadingPageConfig(config: ReadingPageConfig): string[] {
  // Keep this hook intentionally permissive.  A page is allowed to combine
  // any common capability with any semantic recipe; unsupported combinations
  // must degrade through the normalized data contract, not be rejected by a
  // content-type rule.  TypeScript validates the closed option unions above.
  const validRelatedVariants = new Set<ReadingRelatedVariant>(['article-bottom', 'cards'])
  const validBackgroundVariants = new Set<ReadingBackgroundVariant>(['gradient'])
  const validMediaVariants = new Set<ReadingMediaVariant>(['standard', 'layered-blur'])
  const validBackdropVariants = new Set<ReadingOpeningMediaBackdropVariant>([
    'blur',
    'projected-blur'
  ])
  const errors: string[] = []

  if (!validRelatedVariants.has(config.footer.relatedVariant)) {
    errors.push(`Unknown related renderer: ${config.footer.relatedVariant}`)
  }
  if (!validBackgroundVariants.has(config.background.variant)) {
    errors.push(`Unknown reading background: ${config.background.variant}`)
  }
  if (!validMediaVariants.has(config.header.openingMedia.variant)) {
    errors.push(`Unknown opening-media variant: ${config.header.openingMedia.variant}`)
  }
  if (!validBackdropVariants.has(config.header.openingMedia.backdrop.variant)) {
    errors.push(`Unknown opening-media backdrop: ${config.header.openingMedia.backdrop.variant}`)
  }

  return errors
}

const defaultContentKind: Record<ReadingDetailPageKind, ContentKind> = {
  'blog-detail': 'blog',
  'saying-detail': 'saying',
  'trace-detail': 'trace'
}

const defaultReadingConfigErrors = (
  Object.keys(baselineReadingPages) as ReadingDetailPageKind[]
).flatMap((pageKind) =>
  validateReadingPageConfig(resolveReadingPageConfig(pageKind, defaultContentKind[pageKind]))
)

if (defaultReadingConfigErrors.length > 0) {
  throw new Error(
    `Invalid reading page configuration:\n${defaultReadingConfigErrors.map((error) => `- ${error}`).join('\n')}`
  )
}
