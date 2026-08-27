/**
 * Development fixture for the Home residence scene.
 *
 * This preserves the historically implemented SkyWT-style map interaction
 * until the owner replaces the location, copy and public marker image before
 * release.  All browser-facing images are same-origin so MapLibre markers can
 * load them after the page has hydrated.
 */
export const residence = {
  caption: '现在住在北京海淀，把工作、学习与沿途的光线留进长期记录。',
  city: '北京',
  darkMapStyle: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  displayName: '北京 · 海淀',
  label: '北京海淀 · 位置占位（发布前替换为最终坐标）',
  latitude: 39.9834,
  longitude: 116.3229,
  mapImage: '/media/residence/residence-map.svg',
  mapImageAlt: '北京海淀居住地地图静态回退',
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  mapZoom: 6,
  markerX: 50.8,
  markerY: 57.5,
  ownerAvatar: '/media/residence/avatar.jpg',
  region: '海淀',
  timezone: 'Asia/Shanghai',
  visitorAvatar: '/media/residence/visitor-avatar.svg'
} as const

export type ResidenceConfig = typeof residence
