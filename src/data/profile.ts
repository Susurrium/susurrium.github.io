/**
 * Canonical, owner-confirmed About copy.
 *
 * Home and About intentionally render this data in different layouts, but
 * they must never drift into two versions of the same introduction. The
 * inline <del> elements are intentional owner copy and are rendered by the
 * existing trusted static `set:html` surface.
 */
export const profileIntro = {
  role: 'Developer / Designer / Blogger',
  paragraphs: [
    '你好，我是 Susurrium，一个目前就读于北京大学医学部非典型医学牲。',
    '一边被<del>分化生化物化</del>药理药代药动折磨，一边在<del>完成CS231n 的 Assignment</del>查找梯度消失的原因时心态崩溃。',
    '非常佩服A神，于是选择用相同的模版做了这个博客。',
    '最喜欢的游戏的<del>那个夏天的</del>ow。'
  ]
} as const
