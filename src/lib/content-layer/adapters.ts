import type { CollectionEntry } from 'astro:content'

import { contentPath } from './registry'
import type {
  BlogRecord,
  ContentImageInput,
  ContentKind,
  ContentRecord,
  SayingRecord,
  TraceRecord
} from './types'

function imageSource(source: unknown): string | undefined {
  if (typeof source === 'string') return source
  if (!source || typeof source !== 'object' || !('src' in source)) return undefined

  const src = (source as { src?: unknown }).src
  return typeof src === 'string' ? src : undefined
}

function toImageInput(
  source: unknown,
  alt: string | undefined,
  contentId: string
): ContentImageInput | undefined {
  const src = imageSource(source)
  return src ? { alt, key: `content-${contentId}`, src } : undefined
}

export function contentKey(kind: ContentKind, id: string): string {
  return `${kind}:${id}`
}

export function adaptBlogEntry(entry: CollectionEntry<'blog'>): BlogRecord {
  return {
    cardTitle: entry.data.title,
    comment: entry.data.comment,
    description: entry.data.description,
    draft: entry.data.draft,
    href: contentPath('blog', entry.id),
    id: entry.id,
    image: toImageInput(entry.data.heroImage, entry.data.heroImage?.alt, entry.id),
    key: contentKey('blog', entry.id),
    kind: 'blog',
    language: entry.data.language,
    publishedAt: entry.data.publishDate,
    tags: [...(entry.data.tags ?? [])],
    title: entry.data.title,
    updatedAt: entry.data.updatedDate
  }
}

export function adaptTraceEntry(entry: CollectionEntry<'trace'>): TraceRecord {
  return {
    cardTitle: entry.data.title,
    description: entry.data.description,
    draft: entry.data.draft,
    href: contentPath('trace', entry.id),
    id: entry.id,
    image: toImageInput(entry.data.cover, entry.data.coverAlt, entry.id),
    key: contentKey('trace', entry.id),
    kind: 'trace',
    publishedAt: entry.data.publishDate,
    tags: [...(entry.data.tags ?? [])],
    title: entry.data.title,
    updatedAt: entry.data.updatedDate
  }
}

export function adaptSayingEntry(entry: CollectionEntry<'saying'>): SayingRecord {
  return {
    author: entry.data.author,
    cardTitle: `“${entry.data.text}”`,
    draft: entry.data.draft,
    href: contentPath('saying', entry.id),
    id: entry.id,
    key: contentKey('saying', entry.id),
    kind: 'saying',
    originalText: entry.data.originalText,
    source: entry.data.source,
    sourceUrl: entry.data.sourceUrl,
    tags: [...(entry.data.tags ?? [])],
    title: entry.data.text
  }
}

export function adaptContentEntry(entry: CollectionEntry<'blog'>): BlogRecord
export function adaptContentEntry(entry: CollectionEntry<'trace'>): TraceRecord
export function adaptContentEntry(entry: CollectionEntry<'saying'>): SayingRecord
export function adaptContentEntry(
  entry: CollectionEntry<'blog'> | CollectionEntry<'trace'> | CollectionEntry<'saying'>
): ContentRecord
export function adaptContentEntry(
  entry: CollectionEntry<'blog'> | CollectionEntry<'trace'> | CollectionEntry<'saying'>
): ContentRecord {
  if (entry.collection === 'blog') return adaptBlogEntry(entry)
  if (entry.collection === 'trace') return adaptTraceEntry(entry)
  return adaptSayingEntry(entry)
}

export function imageSourceUrl(source: unknown): string | undefined {
  return imageSource(source)
}
