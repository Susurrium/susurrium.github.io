import type { IconsType } from 'astro-pure/types'

export type ConnectLinkKind = 'email' | 'profile' | 'feed'

export interface ConnectLink {
  icon: IconsType
  label: string
  href: string
  kind: ConnectLinkKind
  description: string
}

/**
 * The single source of truth for every way to connect to Susurrium.
 *
 * About renders the full cards while the footer renders the compact icon
 * treatment. Keeping the records here means changing a URL or ordering once
 * updates both surfaces on the next Astro dev refresh/build.
 */
export const connectLinks = [
  {
    icon: 'email',
    label: 'Email',
    href: 'mailto:susurrus66@gmail.com',
    kind: 'email',
    description: 'susurrus66@gmail.com'
  },
  {
    icon: 'github',
    label: 'GitHub',
    href: 'https://github.com/Susurrium',
    kind: 'profile',
    description: '@Susurrium'
  },
  {
    icon: 'rss',
    label: 'RSS',
    href: '/rss.xml',
    kind: 'feed',
    description: '订阅本站更新'
  },
  {
    icon: 'bilibili',
    label: 'Bilibili',
    href: 'https://space.bilibili.com/3546977719552374',
    kind: 'profile',
    description: '个人空间'
  },
  {
    icon: 'steam',
    label: 'Steam',
    href: 'https://steamcommunity.com/profiles/76561199706970949/',
    kind: 'profile',
    description: '个人主页'
  }
] as const satisfies readonly ConnectLink[]

export function isExternalConnectLink(link: ConnectLink): boolean {
  return /^https?:\/\//i.test(link.href)
}

export function connectLinkRel(link: ConnectLink): string | undefined {
  if (link.kind === 'profile') return 'me noopener noreferrer'
  if (isExternalConnectLink(link)) return 'noopener noreferrer'
  if (link.kind === 'feed') return 'alternate'
  return undefined
}
