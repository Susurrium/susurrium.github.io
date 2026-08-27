/**
 * Root-only entrance configuration. `HIST-ENTRANCE` is copied from the fixed
 * historical snapshot; `XYX-TYPING` is locked to xyx404@d4e1efc for the
 * Typed.js timing. Media intentionally stays local so GitHub Pages has no
 * runtime dependency.
 */
export const entrance = {
  greeting: "Hi, I'm Susurrium 👋.",
  title: 'Susurrium',
  subtitle: 'A beginner who is learning',
  dynamicWords: ['<Front-end />', 'data stories', 'open-source craft', 'long-term writing'],
  homeHref: '/home',
  media: {
    webm: '/media/entrance-loop.webm',
    mp4: '/media/entrance-loop.mp4',
    mobileWebm: '/media/entrance-loop-mobile.webm',
    mobileMp4: '/media/entrance-loop-mobile.mp4',
    poster: '/media/entrance-poster.webp'
  },
  typed: {
    startDelay: 300,
    typeSpeed: 150,
    backSpeed: 50,
    loop: true
  }
} as const
