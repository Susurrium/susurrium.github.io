/**
 * Development fixture for the Home residence scene.
 *
 * This preserves the historically implemented SkyWT-style map interaction
 * while keeping the release candidate at city-level precision.  The owner
 * must explicitly approve a finer public location and marker image before a
 * production deployment. All browser-facing images are same-origin so
 * MapLibre markers can load them after the page has hydrated.
 */
export const residence = {
  caption: '现在住在北京，把工作、学习与沿途的光线留进长期记录。',
  city: '北京',
  darkMapStyle: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  displayName: '北京 · 城市级位置',
  label: '北京 · 城市级位置',
  latitude: 39.9,
  longitude: 116.4,
  mapImage: '/media/residence/residence-map.svg',
  mapImageAlt: '北京城市级位置地图静态回退',
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  mapZoom: 6,
  markerX: 50.8,
  markerY: 57.5,
  ownerAvatar: '/media/residence/avatar.jpg',
  publicPrecision: 'city',
  region: '城市级',
  timezone: 'Asia/Shanghai',
  visitorAvatar: '/media/residence/visitor-avatar.svg'
} as const

export type ResidenceConfig = typeof residence
