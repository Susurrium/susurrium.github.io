import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const root = resolve(process.cwd())
const dist = resolve(root, 'dist')
const failures = []

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function expect(condition, message) {
  if (condition) pass(message)
  else fail(message)
}

function source(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function output(path) {
  return readFileSync(resolve(dist, path), 'utf8')
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function count(html, expression) {
  return [...html.matchAll(expression)].length
}

function firstGeneratedDetail(route) {
  const base = resolve(dist, route)
  if (!existsSync(base)) return undefined
  let found
  const walk = (current) => {
    if (found) return
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== route) walk(absolute)
        continue
      }
      if (entry.isFile() && entry.name === 'index.html' && current !== base) {
        // Blog pagination pages live under numeric directories; a detail page
        // has the BlogPost hero/copyright contract instead.
        if (route === 'blog') {
          const html = readFileSync(absolute, 'utf8')
          if (
            !/\bdata-reading-opening-media-variant=["']layered-blur["']/.test(html) &&
            !html.includes('article-copyright')
          )
            continue
        }
        found = relative(dist, absolute).replace(/\\/g, '/')
        return
      }
    }
  }
  walk(base)
  return found
}

const blogDetailPath = firstGeneratedDetail('blog')

const media = [
  {
    path: 'media/entrance-loop-waterfall.webm',
    hash: 'ff6488f821cb87d4cbd77770701d8895eba61d8d6f23f52f3ee8709da11f3598'
  },
  {
    path: 'media/entrance-loop-waterfall.mp4',
    hash: '991e7e350af89c3550f206411a1be46a56042badf05e60ac40b2da5e5c1d59c7'
  },
  {
    path: 'media/entrance-loop-waterfall-mobile.webm',
    hash: 'a0d777e8446c1b3ff9e5a0ff969de5b11a91596d8b46bc46f8e2f59995b3fae2'
  },
  {
    path: 'media/entrance-loop-waterfall-mobile.mp4',
    hash: '706182ed35e8ad6064aeabb2d9e3c3dceffc68fc9b15a8014ae4b29df770dec6'
  },
  {
    path: 'media/entrance-waterfall-poster.webp',
    hash: '39d7ee3b42f3fb48d4d546973418bf564061c67a9549e6a98b738494febfd2a4'
  },
  {
    path: 'media/entrance-waterfall-poster-mobile.webp',
    hash: 'f946e566bfd85df014f7f8dc6a202d9f9832fb1bc7a734109cb6780e2ceafabf'
  }
]

expect(existsSync(dist), 'production dist exists')
for (const path of ['index.html', 'home/index.html', ...(blogDetailPath ? [blogDetailPath] : [])]) {
  expect(existsSync(resolve(dist, path)), `${path} exists`)
}

for (const asset of media) {
  const publicAsset = resolve(root, 'public', asset.path)
  const outputAsset = resolve(dist, asset.path)
  expect(existsSync(publicAsset), `${asset.path} is checked in under public`)
  expect(existsSync(outputAsset), `${asset.path} is emitted by the production build`)
  expect(
    existsSync(publicAsset) && sha256(publicAsset) === asset.hash,
    `${asset.path} retains its historical locked hash`
  )
}

if (existsSync(resolve(dist, 'index.html'))) {
  const entrance = output('index.html')
  expect(entrance.includes('data-entrance-scene'), 'root mounts the replayable entrance scene')
  expect(entrance.includes('data-entrance-video'), 'root contains its local video element')
  expect(entrance.includes('data-entrance-poster'), 'root contains a poster fallback')
  expect(entrance.includes('entrance-typed-text'), 'root mounts the Typed.js text component')
  expect(
    /<video\b[^>]*\bmuted\b[^>]*\bautoplay\b[^>]*\bloop\b/i.test(entrance),
    'root video is muted, autoplaying, and looping'
  )
  expect(!entrance.includes('<header-component'), 'root does not mount the site header')
  expect(!entrance.includes('<footer'), 'root does not mount the site footer')
  expect(!entrance.includes('<music-player'), 'root does not mount global music')
  expect(
    !entrance.includes('data-astro-transition-persist'),
    'root does not mount persistent normal-page UI'
  )
  expect(!entrance.includes('ClientRouter.astro_astro'), 'root does not mount ClientRouter')
  expect(!/sessionStorage|localStorage/.test(entrance), 'root has no visit-skipping storage')
  expect(
    !/addEventListener\(["']ended["']/.test(entrance),
    'root video has no ended-event navigation'
  )
  expect(entrance.includes('location.replace'), 'root enters Home with history replacement')
  expect(/href="\/home"/.test(entrance), 'root keeps a keyboard-accessible /home link')
  expect(/<meta name="robots" content="noindex, follow"/.test(entrance), 'root remains noindex')
  expect(
    /<link rel="canonical" href="https:\/\/susurrium\.github\.io\/home"/.test(entrance),
    'root canonical remains /home'
  )
  for (const asset of media) {
    expect(entrance.includes(`/${asset.path}`), `root references local ${asset.path}`)
  }
}

const entranceData = source('src/data/entrance.ts')
const typedSource = source('src/components/entrance/EntranceTypedText.astro')
const sceneSource = source('src/components/entrance/EntranceScene.astro')
expect(entranceData.includes('startDelay: 600'), 'Typed.js start delay is locked to 600 ms')
expect(entranceData.includes('typeSpeed: 52'), 'Typed.js type speed is locked to 52')
expect(entranceData.includes('backSpeed: 28'), 'Typed.js back speed is locked to 28')
expect(entranceData.includes('backDelay: 1500'), 'Typed.js back delay is locked to 1500 ms')
expect(entranceData.includes('loop: true'), 'Typed.js loops its text sequence')
expect(typedSource.includes("import Typed from 'typed.js'"), 'Typed.js is bundled locally')
expect(
  typedSource.includes("contentType: 'null'"),
  'Typed.js text is rendered as text rather than HTML'
)
expect(
  !/sessionStorage/.test(sceneSource),
  'entrance source does not restore historical session skipping'
)
expect(sceneSource.includes('window.location.replace'), 'entrance source uses replace navigation')
expect(
  sceneSource.includes('.then(showVideo).catch(showPoster)'),
  'entrance reveals cached video after a successful play promise'
)

const musicData = source('src/data/music.ts')
const musicSource = source('src/components/MusicPlayer.astro')
const articleImageZoom = source('src/components/reading/ArticleImageZoom.astro')
const copyrightSource = source('src/components/reading/ContentCopyright.astro')
const contentReadingPage = source('src/layouts/ContentReadingPage.astro')
const contentReadingShell = source('src/layouts/ContentReadingShell.astro')
const readingFooter = source('src/components/reading/ReadingFooter.astro')
const baseLayout = source('src/layouts/BaseLayout.astro')
const transitionGuardSource = source('src/components/ViewTransitionRejectionGuard.astro')
const signatureSource = source('src/components/shared/Signature.astro')
const siteConfigSource = source('src/site.config.ts')
const readingPolicySource = source('src/lib/content-layer/reading-policy.ts')
const randomSayingSource = source('src/components/home/RandomSayingCard.astro')
const linksSource = source('src/pages/links/index.astro')
const packageManifest = JSON.parse(source('package.json'))
expect(musicData.includes('export const musicConfig'), 'music config exposes one provider contract')
expect(
  /server:\s*['"]netease['"]/.test(musicData) && /type:\s*['"]playlist['"]/.test(musicData),
  'music config targets a NetEase playlist'
)
expect(
  musicData.includes('api.injahow.cn/meting/'),
  'music config uses the declared public Meting endpoint'
)
expect(
  musicData.includes("id: '12812783625'"),
  'music config keeps the temporary reference playlist'
)
expect(
  musicSource.includes('data-global-music-player'),
  'music player exposes its global-player contract'
)
expect(
  packageManifest.dependencies['typed.js'] === '2.1.0',
  'Typed.js is pinned to the locally bundled 2.1.0 release'
)
expect(
  packageManifest.dependencies.qrcodejs === '1.0.0',
  'QRCode renderer is pinned to the locally bundled qrcodejs 1.0.0 release'
)
expect(
  musicSource.includes('<meting-js') && musicSource.includes('data-music-meting'),
  'music player mounts one MetingJS custom element'
)
expect(musicSource.includes('candidate.audio.autoplay = false'), 'music player disables autoplay')
expect(
  musicSource.includes('this.meting.lock = true'),
  'music player protects the persistent MetingJS instance during swaps'
)
expect(
  musicSource.includes("candidate.audio.dataset.musicAudio = 'true'"),
  'music player marks the APlayer-owned audio element for runtime audits'
)
expect(
  musicSource.includes("'astro:after-swap'"),
  'music player resynchronizes after ClientRouter swaps'
)
expect(baseLayout.includes('<ClientRouter />'), 'normal pages mount ClientRouter')
expect(
  baseLayout.includes(
    "import ViewTransitionRejectionGuard from '@/components/ViewTransitionRejectionGuard.astro'"
  ) && baseLayout.includes('<ViewTransitionRejectionGuard />'),
  'normal pages install the narrow native View Transition rejection guard before ClientRouter'
)
expect(
  transitionGuardSource.includes("window.addEventListener('unhandledrejection'") &&
    transitionGuardSource.includes("['AbortError', 'InvalidStateError', 'TimeoutError']") &&
    transitionGuardSource.includes('event.preventDefault()'),
  'View Transition guard only consumes documented benign browser transition rejections'
)
expect(
  /<div transition:persist='susurrium-music-player'>\s*<MusicPlayer\s*\/>/m.test(baseLayout),
  'music persistence marker is on a native DOM wrapper'
)
expect(
  packageManifest.dependencies['medium-zoom'] === '1.1.0',
  'Medium Zoom is pinned to the locally bundled 1.1.0 release'
)
expect(
  articleImageZoom.includes("import mediumZoom, { type Zoom } from 'medium-zoom/dist/pure'"),
  'article image zoom imports Medium Zoom from the local pure package entry'
)
expect(
  !/src=\{?['\"]https?:\/\//.test(articleImageZoom),
  'article image zoom has no remote runtime script source'
)
expect(
  articleImageZoom.includes('astro:before-preparation') &&
    articleImageZoom.includes('astro:before-swap') &&
    articleImageZoom.includes('this.#zoom?.detach(this.#images)'),
  'article image zoom releases current images across ClientRouter navigation'
)
expect(
  contentReadingShell.includes(
    "import ArticleImageZoom from '@/components/reading/ArticleImageZoom.astro'"
  ) && !contentReadingShell.includes("from 'astro-pure/advanced'"),
  "Reading pages use the local image zoom controller rather than Pure's CDN wrapper"
)
expect(
  readingFooter.includes("import Copyright from '@/components/reading/ContentCopyright.astro'") &&
    !readingFooter.includes('Copyright, Hero'),
  "Reading pages use the local Copyright component rather than Pure's CDN QR wrapper"
)
expect(
  copyrightSource.includes("import qrcodeScriptUrl from 'qrcodejs/qrcode.min.js?url'") &&
    copyrightSource.includes('class ArticleCopyright') &&
    copyrightSource.includes('disconnectedCallback') &&
    !copyrightSource.includes("import { showToast } from 'astro-pure/utils'"),
  'local Copyright bundles QRCode safely without the Pure client barrel or a CDN'
)
expect(
  signatureSource.includes('class SignatureDrawing') &&
    signatureSource.includes('disconnectedCallback') &&
    signatureSource.includes('IntersectionObserver') &&
    signatureSource.includes('clearTimeout'),
  'signature drawing owns and clears its route-scoped timers and observer'
)
expect(
  !signatureSource.includes('document.querySelectorAll'),
  'signature drawing does not perform global document scans after navigation'
)
expect(
  /signature:\s*\{[\s\S]*?enabled:\s*false/.test(siteConfigSource),
  'signature visibility is disabled by the site-wide feature switch'
)
expect(
  readingPolicySource.includes("'blog-detail': {") &&
    readingPolicySource.includes("body: { signature: 'off' }"),
  'Blog detail pages default to a hidden signature policy'
)
expect(
  contentReadingShell.includes('siteFeatures.signature.enabled'),
  'reading pages keep signature rendering behind the site-wide switch'
)
expect(
  linksSource.includes('siteFeatures.signature.enabled'),
  'Links keeps signature rendering reversible behind the site-wide switch'
)
expect(
  randomSayingSource.includes("'astro:page-load'") &&
    randomSayingSource.includes('AbortController') &&
    randomSayingSource.includes('disconnectedCallback') &&
    randomSayingSource.includes('#lastVisitKey'),
  'random Saying reselects once per Home visit without retaining stale listeners'
)
expect(
  !linksSource.includes('friends.arthals.ink') &&
    !linksSource.includes('import FriendCircle') &&
    !linksSource.includes('friend-circle-lite-root') &&
    !linksSource.includes("text: 'Friend Circle'"),
  'Links keeps Friend Circle code available but does not render or request it'
)
expect(
  linksSource.includes('<site-info-copy') && !linksSource.includes('onclick={script}'),
  'Links uses a local copy control instead of interpolating values into inline handlers'
)

for (const path of ['home/index.html', ...(blogDetailPath ? [blogDetailPath] : [])]) {
  if (!existsSync(resolve(dist, path))) continue
  const html = output(path)
  expect(html.includes('ClientRouter.astro_astro'), `${path} emits ClientRouter runtime`)
  expect(
    count(html, /data-astro-transition-persist="susurrium-music-player"/g) === 1,
    `${path} emits exactly one persistent music wrapper`
  )
  expect(count(html, /<music-player\b/g) === 1, `${path} emits exactly one music player`)
  expect(count(html, /<meting-js\b/g) === 1, `${path} emits exactly one MetingJS element`)
  expect(html.includes('data-provider="netease"'), `${path} declares the NetEase provider`)
  expect(
    html.includes('__susurriumViewTransitionRejectionGuard'),
    `${path} emits the native View Transition rejection guard`
  )
}

if (existsSync(resolve(dist, 'home/index.html'))) {
  const home = output('home/index.html')
  expect(
    /<body\b[^>]*data-music-mode="full"/.test(home),
    'Home exposes full music presentation mode'
  )
}

if (blogDetailPath && existsSync(resolve(dist, blogDetailPath))) {
  const detail = output(blogDetailPath)
  expect(
    /<body\b[^>]*data-music-mode="compact"/.test(detail),
    'Blog detail exposes compact music presentation mode'
  )
  expect(
    !/cdn\.(?:jsdelivr|unpkg)\.net\/.*medium-zoom/i.test(detail),
    'Blog detail emits no Medium Zoom CDN request'
  )
  expect(
    !/cdn\.(?:jsdelivr|unpkg)\.net\/.*qrcodejs/i.test(detail),
    'Blog detail emits no QRCode CDN request'
  )
  expect(detail.includes('article-copyright'), 'Blog detail emits the local Copyright component')
}

if (existsSync(resolve(dist, 'links/index.html'))) {
  const links = output('links/index.html')
  expect(
    !links.includes('friend-circle-lite-root') &&
      !links.includes('data-friend-circle-status') &&
      !links.includes('Friend Circle'),
    'Links emits no Friend Circle heading, placeholder, or status'
  )
  expect(!links.includes('friends.arthals.ink'), 'Links emits no Friend Circle remote endpoint')
  expect(
    links.includes('<site-info-copy') &&
      links.includes('data-copy-value=') &&
      !links.includes('onclick="navigator.clipboard.writeText'),
    'Links emits copy controls without executable value interpolation'
  )
}

expect(
  contentReadingPage.includes("musicMode='compact'"),
  'Shared reading composition opts all detail pages into compact music mode'
)

const headerSource = source('src/components/layout/SiteHeader.astro')
expect(headerSource.includes('AbortController'), 'header owns abortable ClientRouter listeners')
expect(
  headerSource.includes('disconnectedCallback'),
  'header cleans listeners when its element is replaced'
)

const contentLayout = source('src/layouts/ContentLayout.astro')
expect(
  /<script[^>]*\bdata-astro-rerun\b/.test(contentLayout),
  'detail sidebar bindings rerun after ClientRouter navigation'
)
expect(
  contentLayout.includes(';(() => {') && contentLayout.includes('})()'),
  'rerun sidebar bindings stay scoped instead of redeclaring globals after a swap'
)

console.log(`Phase 3 verification complete: ${failures.length} failure(s).`)
if (failures.length > 0) process.exit(1)
