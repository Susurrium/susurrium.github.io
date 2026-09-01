import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

function removeDupsAndLowerCase(array: string[]) {
  if (!array.length) return array
  const lowercaseItems = array.map((str) => str.toLowerCase())
  const distinctItems = new Set(lowercaseItems)
  return Array.from(distinctItems)
}

// Define blog collection
const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Required
  schema: ({ image }) =>
    z.object({
      // Required
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date(),
      // Optional
      updatedDate: z.coerce.date().optional(),
      heroImage: z
        .object({
          src: image(),
          alt: z.string().optional(),
          inferSize: z.boolean().optional(),
          width: z.number().optional(),
          height: z.number().optional(),

          color: z.string().optional()
        })
        .optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      language: z.string().optional(),
      draft: z.boolean().default(false),
      // Special fields
      comment: z.boolean().default(true)
    })
})

// Define docs collection
const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      draft: z.boolean().default(false),
      // Special fields
      order: z.number().default(999)
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
        title: z.string().min(1).max(80),
        description: z.string().min(1).max(180).optional(),
        publishDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
        cover: image().optional(),
        coverAlt: z.string().min(1).max(160).optional(),
        draft: z.boolean().default(false)
      })
      .refine((entry) => !entry.updatedDate || entry.updatedDate >= entry.publishDate, {
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
    z
      .object({
        text: z.string().min(1).max(500),
        originalText: z.string().min(1).max(500).optional(),
        author: z.string().min(1).max(80).optional(),
        source: z.string().min(1).max(160).optional(),
        sourceUrl: z.url().optional(),
        tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
        draft: z.boolean().default(false)
      })
})

export const collections = { blog, docs, trace, saying }
