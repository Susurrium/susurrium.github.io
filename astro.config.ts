// @ts-check

import { fileURLToPath } from 'node:url'
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
// Adapter
// import vercel from '@astrojs/vercel'
// import node from '@astrojs/node'
// Integrations
import AstroPureIntegration from 'astro-pure'
import { defineConfig, fontProviders } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import { remarkAlert } from 'remark-github-blockquote-alert'
import remarkMath from 'remark-math'

import mermaidIntegration from './src/integrations/mermaid.ts'
import searchIndex from './src/integrations/search-index.ts'
// Others
// import { visualizer } from 'rollup-plugin-visualizer'

// Local integrations
// Local rehype & remark plugins
import rehypeAutolinkHeadings from './src/plugins/rehype-auto-link-headings.ts'
import rehypeMermaidSource from './src/plugins/rehype-mermaid-source.ts'
import remarkRemoveDuplicateTitleHeading from './src/plugins/remark-remove-duplicate-title-heading.ts'
// Shiki
import {
  addCollapse,
  addCopyButton,
  addLanguage,
  addTitle,
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerRemoveNotationEscape,
  updateStyle
} from './src/plugins/shiki-transformers.ts'
import config from './src/site.config.ts'

// The upstream Pagefind hook resolves even when its subprocess fails. Keep
// Pure's content/style integration and own indexing through the pinned API.
const pure = AstroPureIntegration(config)
delete pure.hooks['astro:build:done']

// https://astro.build/config
export default defineConfig({
  // Top-Level Options
  site: 'https://susurrium.github.io',
  // Deploy to a sub path; See https://astro-pure.js.org/docs/setup/deployment#platform-with-base-path
  // base: '/astro-pure/',
  trailingSlash: 'never',
  compressHTML: true,
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Satoshi',
      cssVariable: '--font-satoshi',
      fallbacks: [],
      weights: ['300 900'],
      styles: ['normal', 'italic'],
      optimizedFallbacks: false,
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/Satoshi-Variable.woff2'],
            weight: '300 900',
            style: 'normal'
          },
          {
            src: ['./src/assets/fonts/Satoshi-VariableItalic.woff2'],
            weight: '300 900',
            style: 'italic'
          }
        ]
      }
    },
    {
      provider: fontProviders.local(),
      name: 'Abril Fatface',
      cssVariable: '--font-abril',
      fallbacks: [],
      optimizedFallbacks: false,
      options: {
        variants: [
          { src: ['./src/assets/fonts/AbrilFatface-Regular.woff2'], weight: 400, style: 'normal' }
        ]
      }
    },
    {
      provider: fontProviders.local(),
      name: 'Paralines',
      cssVariable: '--font-paralines',
      fallbacks: [],
      optimizedFallbacks: false,
      options: {
        variants: [
          { src: ['./src/assets/fonts/Paralines-Regular.woff2'], weight: 400, style: 'normal' }
        ]
      }
    }
  ],

  // Adapter
  // https://docs.astro.build/en/guides/deploy/
  // 1. Vercel (serverless)
  // adapter: vercel(),
  // output: 'server',
  // 2. Vercel (static)
  // adapter: vercelStatic(),
  // 3. Local (standalone)
  // adapter: node({ mode: 'standalone' }),
  // output: 'server',
  // ---

  image: {
    responsiveStyles: true,
    service: {
      entrypoint: 'astro/assets/services/sharp'
    }
  },

  integrations: [
    // Register sitemap explicitly so replayable/noindex utility pages are not
    // submitted to crawlers. Keep this list in sync with route-level `noindex`
    // metadata because the sitemap integration cannot inspect rendered head
    // props.
    sitemap({
      filter: (page) =>
        !new Set(['/', '/404', '/search', '/tools/card-crop-review']).has(new URL(page).pathname)
    }),
    // astro-pure will automatically add mdx & unocss
    // mdx(),
    mdx({ optimize: true }),
    pure,
    mermaidIntegration(),
    searchIndex(config.integ.pagefind)
    // (await import('@playform/compress')).default({
    //   SVG: false,
    //   Exclude: ['index.*.js']
    // }),

    // Temporary fix vercel adapter
    // static build method is not needed
  ],
  // root: './my-project-directory',

  // Prefetch Options
  prefetch: true,
  // Server Options
  server: { host: true },
  // Markdown Options
  markdown: {
    syntaxHighlight: { type: 'shiki', excludeLangs: ['mermaid'] },
    processor: unified({
      remarkPlugins: [remarkMath, remarkAlert, remarkRemoveDuplicateTitleHeading],
      rehypePlugins: [
        rehypeMermaidSource,
        [rehypeKatex, { strict: false }],
        rehypeHeadingIds,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { className: ['anchor'] },
            content: { type: 'text', value: '#' }
          }
        ]
      ]
    }),
    // https://docs.astro.build/en/guides/syntax-highlighting/
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        transformerRemoveNotationEscape(),
        updateStyle(),
        addTitle(),
        addLanguage(),
        addCopyButton(2000),
        addCollapse(15)
      ]
    }
  },
  experimental: {
    contentIntellisense: true
  },
  vite: {
    // Browser audit profiles are generated under `artifacts/`; they contain
    // locked Chromium session files on Windows and must not be watched.
    server: {
      watch: {
        ignored: [fileURLToPath(new URL('./artifacts/**', import.meta.url)).replaceAll('\\', '/')]
      }
    },
    plugins: [
      //   visualizer({
      //     emitFile: true,
      //     filename: 'stats.html'
      //   })
    ]
  }
})
