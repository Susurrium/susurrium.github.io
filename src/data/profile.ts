/**
 * Canonical copy for the short personal introduction.
 *
 * Home and About intentionally render this data in different layouts, but
 * they must never drift into two versions of the same introduction.
 */
export const profileIntro = {
  role: 'Developer / Designer / Blogger',
  paragraphs: [
    '你好，我是 Susurrium，目前在北京大学医学部学习。',
    '我平时喜欢写代码、做设计，也常常因为好奇去折腾一些新工具和新想法。'
  ]
} as const
