/**
 * Root-only entrance configuration. The copy and Typed.js timing are kept in
 * one place so the entrance can be tuned without touching its lifecycle.
 * Media intentionally stays local so GitHub Pages has no runtime dependency.
 */
export const entrance = {
  greeting: "Hi, I'm Susurrium.",
  title: 'Susurrium',
  dynamicWords: [
    'A tracer of the past, a seeker of echoes that last.',
    'A learner amid the susurrus of doubt, a shadow drifting about.',
    'A reader of quiet pages, a scribe of passing phrases.',
    'A coder at first light, a builder of my small world, byte by byte.',
  ],
  featuredLine: {
    prefix: 'I hope to sketch the architecture of tomorrow with',
    keyword: 'AI agents',
  },
  homeHref: '/home',
  scrollToEnter: {
    enabled: true,
    threshold: 200,
    resetAfter: 500,
    maxDeltaPerEvent: 120,
    desktopMinWidth: 721
  },
  media: {
    webm: '/media/entrance-loop-waterfall.webm',
    mp4: '/media/entrance-loop-waterfall.mp4',
    mobileWebm: '/media/entrance-loop-waterfall-mobile.webm',
    mobileMp4: '/media/entrance-loop-waterfall-mobile.mp4',
    poster: '/media/entrance-waterfall-poster.webp',
    mobilePoster: '/media/entrance-waterfall-poster-mobile.webp'
  },
  typed: {
    startDelay: 600,
    typeSpeed: 52,
    backSpeed: 28,
    backDelay: 1500,
    loop: true
  }
} as const
