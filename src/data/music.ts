/**
 * Local-only music catalogue for `HIST-MUSIC` state and the `XYX-MUSIC-UI`
 * shell. Every eventual source must be a same-origin static asset.
 *
 * Keep `audioSrc` unset until an owned or explicitly authorised audio file has
 * been placed in `public/`. When that happens, use same-origin paths such as
 * `/media/music/a-quiet-morning.ogg` and `/media/music/a-quiet-morning.webp`.
 * The player intentionally rejects remote URLs so a static GitHub Pages build
 * never turns into an implicit third-party audio request.
 */
export interface MusicTrack {
  id: string
  title: string
  artist: string
  /** Future local, same-origin audio path. Deliberately absent in fixtures. */
  audioSrc?: string
  /** Optional local cover path for the compact XYX-inspired record shell. */
  coverSrc?: string
  reason: string
  context: string
  tags: readonly string[]
  licenseNote: string
}

/**
 * Self-authored UI fixtures, not playable music. They exercise the daily
 * selection and metadata interface without bundling, streaming, or requesting
 * any audio before final media is supplied.
 */
export const dailyMusic: readonly MusicTrack[] = [
  {
    id: 'morning-margin',
    title: '晨光留白',
    artist: '本地占位曲目',
    reason: '把节奏放慢一点，给刚开始的一天留出能呼吸的空白。',
    context: '适合打开编辑器前、窗边光线还很柔和的几分钟。',
    tags: ['轻盈', '专注'],
    licenseNote: '这是本地占位条目，尚未配置可播放音频。'
  },
  {
    id: 'rainy-draft',
    title: '雨后草稿',
    artist: '本地占位曲目',
    reason: '让未完成的想法先流动起来，不急着把每一句定稿。',
    context: '适合整理笔记、写下第一行草稿的午后。',
    tags: ['雨声', '书写'],
    licenseNote: '这是本地占位条目，尚未配置可播放音频。'
  },
  {
    id: 'night-window',
    title: '夜窗微光',
    artist: '本地占位曲目',
    reason: '在结束前回看一天，把值得记住的小事轻轻收好。',
    context: '适合合上工作窗口、准备离开屏幕的时候。',
    tags: ['夜晚', '回望'],
    licenseNote: '这是本地占位条目，尚未配置可播放音频。'
  }
]
