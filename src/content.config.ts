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

// Trace is deliberately separate from Blog: it is a short-form record with its
// own list/detail route and is not included in the Blog tag, archive or RSS views.
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

// Sayings are a third content type, not a shortened Blog or Trace. Their tags
// remain local metadata until a future product decision explicitly exposes them.
const saying = defineCollection({
  loader: glob({ base: './src/content/sayings', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z
      .object({
        text: z.string().min(1).max(500),
        author: z.string().min(1).max(80).optional(),
        source: z.string().min(1).max(160).optional(),
        sourceUrl: z.url().optional(),
        publishDate: z.coerce.date(),
        tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
        draft: z.boolean().default(false)
      })
      .refine((entry) => !entry.sourceUrl || Boolean(entry.source), {
        message: 'source is required when sourceUrl is set',
        path: ['source']
      })
})

export const collections = { blog, docs, trace, saying }
