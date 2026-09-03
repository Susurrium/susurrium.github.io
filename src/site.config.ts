import type { Config, IntegrationUserConfig, ThemeUserConfig } from 'astro-pure/types'
import { connectLinks } from './data/connect'
import type { ContentPaginationConfig } from './lib/content-layer/pagination'

export const theme: ThemeUserConfig = {
  // === Basic configuration ===
  /** Title for your website. Will be used in metadata and as browser tab title. */
  title: "Susurrium's blog",
  /** Will be used in index page & copyright declaration */
  author: 'Susurrium',
  /** Description metadata for your website. Can be used in page metadata. */
  description: 'A tracer of the past, a seeker of echoes that last.',
  /** The default favicon for your site which should be a path to an image in the `public/` directory. */
  favicon: '/favicon/favicon.ico',
  /** Specify the default language for this site. */
  locale: {
    lang: 'zh-CN',
    attrs: 'zh_CN',
    // Date locale
    dateLocale: 'zh-CN',
    dateOptions: {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  },
  /** Set a logo image to show in the homepage. */
  logo: {
    src: 'src/assets/avatar.jpg',
    alt: 'Susurrium avatar'
  },

  // === Global configuration ===
  titleDelimiter: '•',
  prerender: true,
  npmCDN: 'https://cdn.jsdelivr.net/npm',

  // Still in test
  head: [
    /* Telegram channel */
    // {
    //   tag: 'meta',
    //   attrs: { name: 'telegram:channel', content: '@cworld0_cn' },
    //   content: ''
    // }
  ],
  customCss: [],

  /** Configure the header of your site. */
  header: {
    menu: [
      { title: 'Home', link: '/home' },
      { title: 'Blog', link: '/blog' },
      { title: 'Traces', link: '/traces' },
      { title: 'Projects', link: '/projects' },
      { title: 'About', link: '/about' },
      { title: 'Links', link: '/links' }
    ]
  },

  /** Configure the footer of your site. */
  footer: {
    // Year format
    year: '© 2026',
    // year: `© 2019 - ${new Date().getFullYear()}`,
    links: [],
    /** Enable displaying a “Astro & Pure theme powered” link in your site’s footer. */
    credits: false,
    /** Optional details about the social media accounts for this site. */
    // The full Connect records live in src/data/connect.ts. Keep the theme
    // config projection here for astro-pure while About and Footer consume
    // the same canonical order and URLs directly.
    social: connectLinks.map(({ icon, label, href }) => ({ icon, label, href }))
  },

  content: {
    /** External links configuration */
    externalLinks: {
      content: ' ↗',
      /** Properties for the external links element */
      properties: {
        style: 'user-select:none'
      }
    },
    /** Blog page size for pagination (optional) */
    blogPageSize: 8,
    // Currently support weibo, x, bluesky
    share: ['weibo']
  }
}

/**
 * Site-owned archive pagination. Keep this outside `theme.content`: astro-pure
 * exposes only its historical `blogPageSize` option there, while this site
 * needs independent controls for Blog, Trace, and Saying archives.
 */
export const contentPagination = {
  blog: {
    enabled: true,
    pageSize: theme.content.blogPageSize ?? 8
  },
  saying: {
    enabled: true,
    pageSize: 8
  },
  trace: {
    enabled: true,
    pageSize: 8
  }
} satisfies Record<'blog' | 'trace' | 'saying', ContentPaginationConfig>

/** Site-wide switches for optional visual capabilities. */
export const siteFeatures = {
  signature: {
    enabled: false
  }
} as const

export const integ: IntegrationUserConfig = {
  // Links management
  // See: https://astro-pure.js.org/docs/integrations/links
  links: {
    // Friend logbook
    logbook: [{ date: '2026-09-01', content: '开始接纳新的伙伴！' }],
    // Yourself link info
    applyTip: [
      { name: 'Name', val: theme.title },
      { name: 'Desc', val: theme.description || 'Null' },
      { name: 'Link', val: 'https://susurrium.github.io/' },
      { name: 'Avatar', val: 'https://susurrium.github.io/media/residence/avatar.jpg' }
    ],
    // Cache avatars in `public/avatars/` to improve user experience.
    cacheAvatar: false
  },
  // Enable page search function
  pagefind: true,
  // Pure 1.4.6 requires a quote provider even though this site renders the
  // Saying collection through its own content layer. Keep this local
  // compatibility fallback to satisfy the integration contract.
  quote: {
    server: '/data/development-quote.json',
    target: `(data) => data.text || 'Sayings are being prepared.'`
  },
  // UnoCSS typography
  // See: https://unocss.dev/presets/typography
  typography: {
    class: 'prose text-base text-muted-foreground',
    // The style of blockquote font, normal or italic (default to italic in typography)
    blockquoteStyle: 'italic',
    // The style of inline code block, code or modern (default to code in typography)
    inlineCodeBlockStyle: 'modern'
  },
  // A lightbox library that can add zoom effect
  // See: https://astro-pure.js.org/docs/integrations/others#medium-zoom
  mediumZoom: {
    enable: true, // disable it will not load the whole library
    selector: '.prose .zoomable',
    options: {
      className: 'zoomable'
    }
  },
  // Comment system
  waline: {
    enable: true,
    server: 'https://waline-susurrium.vercel.app',
    // Refer https://waline.js.org/en/guide/features/emoji.html
    emoji: ['bmoji', 'weibo'],
    // Refer https://waline.js.org/en/reference/client/props.html
    additionalConfigs: {
      // search: false,
      pageview: true,
      comment: true,
      locale: {
        reaction0: 'Like',
        placeholder: 'Welcome to comment. (Email to receive replies. Login is unnecessary)'
      },
      imageUploader: false
    }
  }
}

const config = { ...theme, integ } as Config
export default config
