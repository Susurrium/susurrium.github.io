import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

import {
  contentTagsSchema,
  contentText,
  hasValidEditorialDates,
  sourceUrlSchema
} from './lib/content-validation'

// Define blog collection
const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Required
  schema: ({ image }) =>
    z
      .object({
        // Required
        title: contentText(60),
        description: contentText(160),
        publishDate: z.coerce.date(),
        // Optional
        updatedDate: z.coerce.date().optional(),
        heroImage: z
          .object({
            src: image(),
            alt: contentText(160).optional(),
            inferSize: z.boolean().optional(),
            width: z.number().int().positive().optional(),
            height: z.number().int().positive().optional(),

            color: z.string().optional()
          })
          .optional(),
        tags: contentTagsSchema,
        language: contentText(80).optional(),
        draft: z.boolean().default(false),
        // Special fields
        comment: z.boolean().default(true)
      })
      .refine(hasValidEditorialDates, {
        message: 'updatedDate cannot be earlier than publishDate',
        path: ['updatedDate']
      })
})

// Define docs collection
const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z
      .object({
        title: contentText(60),
        description: contentText(160),
        publishDate: z.coerce.date().optional(),
        updatedDate: z.coerce.date().optional(),
        tags: contentTagsSchema,
        draft: z.boolean().default(false),
        // Special fields
        order: z.number().default(999)
      })
      .refine(hasValidEditorialDates, {
        message: 'updatedDate cannot be earlier than publishDate',
        path: ['updatedDate']
      })
})

// Trace is deliberately separate from Blog: it is a short-to-medium record
// with its own list/detail route and is not included in the Blog tag, archive
// or RSS views. A description and cover are optional conveniences for cards;
// the Markdown/MDX body remains the source of truth for the record itself.
const trace = defineCollection({
  loader: glob({ base: './src/content/traces', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z
      .object({
        title: contentText(80),
        description: contentText(180).optional(),
        publishDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        tags: contentTagsSchema,
        cover: image().optional(),
        coverAlt: contentText(160).optional(),
        draft: z.boolean().default(false)
      })
      .refine(hasValidEditorialDates, {
        message: 'updatedDate cannot be earlier than publishDate',
        path: ['updatedDate']
      })
      .refine((entry) => !entry.cover || Boolean(entry.coverAlt), {
        message: 'coverAlt is required when cover is set',
        path: ['coverAlt']
      })
})

// Saying is a third content type, not a shortened Blog or Trace. The required
// text is the primary quote; originalText, author and source are deliberately
// small optional attribution fields. Its taxonomy is local to Saying and is
// never merged into Blog or Trace.
const saying = defineCollection({
  loader: glob({ base: './src/content/sayings', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      text: contentText(500),
      originalText: contentText(500).optional(),
      author: contentText(80).optional(),
      source: contentText(160).optional(),
      sourceUrl: sourceUrlSchema.optional(),
      tags: contentTagsSchema,
      draft: z.boolean().default(false)
    })
})

export const collections = { blog, docs, trace, saying }
