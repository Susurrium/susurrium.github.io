import { contentTagPath, contentTypeRegistry } from './registry'
import {
  isKnownContentPresentation,
  normalizeContentPresentation
} from '@/lib/compatibility/content-presentation'
import type {
  ContentKind,
  ContentPresentation,
  ContentSurface,
  ReadingHeaderProfile,
  ReadingRelatedProfile
} from './types'

export type ContentPolicyPreset = 'baseline' | 'uniform' | 'custom'
export type CommentPolicyMode = 'auto' | 'enabled' | 'disabled'
export type TagDisplayMode = 'hidden' | 'links' | 'plain'

export interface ContentPolicyOverride {
  readonly cardPresentation?: ContentPresentation
  readonly readingHeader?: ReadingHeaderProfile
  readonly related?: ReadingRelatedProfile
  readonly comments?: CommentPolicyMode
  readonly tags?: TagDisplayMode
  readonly surfaces?: Partial<Record<ContentSurface, boolean>>
}

export interface ContentPolicyConfig {
  /** Change this one value to preview a different global composition at build time. */
  readonly preset: ContentPolicyPreset
  /** Values used by the `uniform` preset. Missing fields still remain hidden. */
  readonly uniform: Required<
    Pick<ContentPolicyOverride, 'cardPresentation' | 'readingHeader' | 'related'>
  >
  /** Per-type adjustments used by the `custom` preset (and allowed as baseline exceptions). */
  readonly overrides: Partial<Record<ContentKind, ContentPolicyOverride>>
}

/**
 * User-editable build-time policy. The default is the current visual baseline.
 * No value from here is read by browser code, so changing it creates a new
 * static presentation rather than a visitor-dependent runtime branch.
 */
export const contentPolicyConfig: ContentPolicyConfig = {
  preset: 'baseline',
  uniform: {
    cardPresentation: 'text',
    readingHeader: 'article',
    related: 'adjacent'
  },
  overrides: {}
}

export interface ResolvedContentPolicy {
  readonly kind: ContentKind
  readonly cardPresentation: ContentPresentation
  readonly readingHeader: ReadingHeaderProfile
  readonly related: ReadingRelatedProfile
  readonly comments: CommentPolicyMode
  readonly tags: TagDisplayMode
  readonly surfaces: Readonly<Record<ContentSurface, boolean>>
}

const allSurfaces: Readonly<Record<ContentSurface, boolean>> = {
  archive: true,
  copyright: true,
  home: true,
  'main-nav': true,
  reading: true,
  rss: true,
  search: true,
  tags: true
}

const baselineSurfaceOverrides: Partial<
  Record<ContentKind, Partial<Record<ContentSurface, boolean>>>
> = {
  saying: {
    copyright: false,
    'main-nav': false,
    rss: false
  },
  trace: {
    copyright: false,
    rss: false
  }
}

function surfaceDefaults(kind: ContentKind): Readonly<Record<ContentSurface, boolean>> {
  return {
    ...allSurfaces,
    ...baselineSurfaceOverrides[kind],
    ...(!contentTypeRegistry[kind].capabilities.tags ? { tags: false } : {}),
    ...(!contentTypeRegistry[kind].capabilities.related ? { reading: false } : {})
  }
}

/** Resolve the complete build-time policy for one content type. */
export function resolveContentPolicy(
  kind: ContentKind,
  config: ContentPolicyConfig = contentPolicyConfig
): ResolvedContentPolicy {
  const definition = contentTypeRegistry[kind]
  const typeOverride = config.overrides[kind] ?? {}
  const uniform = config.preset === 'uniform' ? config.uniform : undefined
  const surfaces = {
    ...surfaceDefaults(kind),
    ...typeOverride.surfaces
  }
  const configuredPresentation = uniform?.cardPresentation ?? typeOverride.cardPresentation

  return {
    cardPresentation: normalizeContentPresentation(
      configuredPresentation,
      definition.defaults.cardPresentation
    ),
    comments: typeOverride.comments ?? 'auto',
    kind,
    readingHeader:
      uniform?.readingHeader ?? typeOverride.readingHeader ?? definition.defaults.readingHeader,
    related: uniform?.related ?? typeOverride.related ?? definition.defaults.related,
    surfaces,
    tags: typeOverride.tags ?? (surfaces.tags ? 'links' : 'hidden')
  }
}

export function isContentSurfaceEnabled(
  kind: ContentKind,
  surface: ContentSurface,
  config: ContentPolicyConfig = contentPolicyConfig
): boolean {
  return resolveContentPolicy(kind, config).surfaces[surface]
}

/** Build a type-scoped tag URL. Kept next to policy so renderers never hand-build taxonomy routes. */
export function contentTagHref(kind: ContentKind, tag: string): string {
  return contentTagPath(kind, tag)
}

/** Runtime-free validation used by tests and build diagnostics. */
export function validateContentPolicy(config: ContentPolicyConfig = contentPolicyConfig): string[] {
  const errors: string[] = []
  const validHeaders = new Set<ReadingHeaderProfile>(['article', 'hero', 'quote'])
  const validRelated = new Set<ReadingRelatedProfile>(['adjacent', 'recommendations', 'none'])

  if (!isKnownContentPresentation(config.uniform.cardPresentation)) {
    errors.push(`Unknown uniform card presentation: ${config.uniform.cardPresentation}`)
  }
  if (!validHeaders.has(config.uniform.readingHeader)) {
    errors.push(`Unknown uniform reading header: ${config.uniform.readingHeader}`)
  }
  if (!validRelated.has(config.uniform.related)) {
    errors.push(`Unknown uniform related profile: ${config.uniform.related}`)
  }

  for (const [kind, override] of Object.entries(config.overrides) as [
    ContentKind,
    ContentPolicyOverride
  ][]) {
    if (!contentTypeRegistry[kind]) errors.push(`Unknown content policy kind: ${kind}`)
    if (override.cardPresentation && !isKnownContentPresentation(override.cardPresentation)) {
      errors.push(`Unknown card presentation for ${kind}: ${override.cardPresentation}`)
    }
    if (override.readingHeader && !validHeaders.has(override.readingHeader)) {
      errors.push(`Unknown reading header for ${kind}: ${override.readingHeader}`)
    }
    if (override.related && !validRelated.has(override.related)) {
      errors.push(`Unknown related profile for ${kind}: ${override.related}`)
    }
  }

  return errors
}

const policyErrors = validateContentPolicy()
if (policyErrors.length > 0) {
  throw new Error(
    `Invalid content policy:\n${policyErrors.map((error) => `- ${error}`).join('\n')}`
  )
}
