/**
 * Public MetingJS music configuration.
 *
 * The playlist id currently follows the first reference site (xyx404). The
 * second reference site uses `8152976493`; changing `id` is enough to switch
 * to that playlist later.
 *
 * MetingJS turns this provider request into APlayer audio, cover and lyric
 * records in the browser. The endpoint is deliberately kept in one place so
 * it can be replaced if the public service changes or becomes unavailable.
 */
export interface MusicProviderConfig {
  id: string
  server: 'netease'
  type: 'playlist'
  api: string
  mutex: boolean
  preload: 'none' | 'metadata' | 'auto'
  order: 'random' | 'list'
  volume: number
  lrcType: number
  playlistUrl: string
}

export const musicConfig: MusicProviderConfig = {
  id: '12812783625',
  server: 'netease',
  type: 'playlist',
  // Same Meting protocol as the reference sites' default endpoint. The
  // reference endpoint currently answers 403 in some environments, so use a
  // compatible public endpoint that is presently reachable.
  api: 'https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r',
  mutex: true,
  preload: 'none',
  order: 'random',
  volume: 0.7,
  lrcType: 0,
  playlistUrl: 'https://music.163.com/#/playlist?id=12812783625'
}
