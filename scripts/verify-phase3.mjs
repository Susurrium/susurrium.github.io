import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

const media = [
  {
    path: 'media/entrance-loop.webm',
    hash: '62e20114b0f068c2e377a16d6f673697c16a2917880e979c893044cf21e5e76c'
  },
  {
    path: 'media/entrance-loop.mp4',
    hash: '23cd4d3a0c314e728674d7fb8f7f171eaa7332f07ed7ebfb77b9b8b48baf113f'
  },
  {
    path: 'media/entrance-loop-mobile.webm',
    hash: '3699a27675e04c0a4c3c292e3de7834c8751e7e447749f7a340d9a32040f47b4'
  },
  {
    path: 'media/entrance-loop-mobile.mp4',
    hash: 'e29903028da61f379a0beb320a9ae2727bcbe73cc34cc9642466aed8656ec539'
  },
  {
    path: 'media/entrance-poster.webp',
    hash: '8f8e5695d882653c58f4884bacb384be35448bbe19cabc1af16668376f0e9c02'
  }
]

expect(existsSync(dist), 'production dist exists')
for (const path of ['index.html', 'home/index.html', 'blog/xv6-os-lab-part8/index.html']) {
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
expect(entranceData.includes('startDelay: 300'), 'Typed.js start delay is locked to 300 ms')
expect(entranceData.includes('typeSpeed: 150'), 'Typed.js type speed is locked to 150')
expect(entranceData.includes('backSpeed: 50'), 'Typed.js back speed is locked to 50')
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
const articleImageZoom = source('src/components/arthals/ArticleImageZoom.astro')
const copyrightSource = source('src/components/arthals/Copyright.astro')
const baseLayout = source('src/layouts/BaseLayout.astro')
const transitionGuardSource = source('src/components/ViewTransitionRejectionGuard.astro')
const blogPost = source('src/layouts/BlogPost.astro')
const signatureSource = source('src/components/arthals/Signature.astro')
const randomSayingSource = source('src/components/home/RandomSayingCard.astro')
const linksSource = source('src/pages/links/index.astro')
const packageManifest = JSON.parse(source('package.json'))
expect(!/https?:\/\//.test(musicData), 'music catalogue contains no remote URL')
expect(
  !/audioSrc\s*:/.test(musicData),
  'fixture catalogue intentionally ships without audio sources'
)
expect(
  musicData.includes('coverSrc?: string'),
  'music catalogue reserves a local-only cover path for final media'
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
expect(musicSource.includes('data-music-audio'), 'music player exposes its single audio contract')
expect(musicSource.includes('data-music-cover'), 'music player exposes its local cover contract')
expect(
  count(musicSource, /<audio\b/g) === 1,
  'music player source declares exactly one audio element'
)
expect(
  musicSource.includes('resolved.origin === window.location.origin'),
  'music player rejects remote audio paths'
)
expect(musicSource.includes('this.audio.autoplay = false'), 'music player disables autoplay')
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
  blogPost.includes("import ArticleImageZoom from '@/components/arthals/ArticleImageZoom.astro'") &&
    !blogPost.includes("from 'astro-pure/advanced'"),
  "Blog posts use the local image zoom controller rather than Pure's CDN wrapper"
)
expect(
  blogPost.includes("import Copyright from '@/components/arthals/Copyright.astro'") &&
    !blogPost.includes('Copyright, Hero'),
  "Blog posts use the local Copyright component rather than Pure's CDN QR wrapper"
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
  randomSayingSource.includes("'astro:page-load'") &&
    randomSayingSource.includes('AbortController') &&
    randomSayingSource.includes('disconnectedCallback') &&
    randomSayingSource.includes('#lastVisitKey'),
  'random Saying reselects once per Home visit without retaining stale listeners'
)
expect(
  !linksSource.includes('friends.arthals.ink') &&
    !linksSource.includes('import FriendCircle') &&
    linksSource.includes("data-friend-circle-status='deferred'"),
  'Links defers the non-allowlisted Friend Circle runtime to a future local snapshot'
)

for (const path of ['home/index.html', 'blog/xv6-os-lab-part8/index.html']) {
  if (!existsSync(resolve(dist, path))) continue
  const html = output(path)
  expect(html.includes('ClientRouter.astro_astro'), `${path} emits ClientRouter runtime`)
  expect(
    count(html, /data-astro-transition-persist="susurrium-music-player"/g) === 1,
    `${path} emits exactly one persistent music wrapper`
  )
  expect(count(html, /<music-player\b/g) === 1, `${path} emits exactly one music player`)
  expect(count(html, /<audio\b/g) === 1, `${path} emits exactly one audio element`)
  expect(!/<audio\b[^>]*\bsrc="https?:\/\//i.test(html), `${path} has no remote audio source`)
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

if (existsSync(resolve(dist, 'blog/xv6-os-lab-part8/index.html'))) {
  const detail = output('blog/xv6-os-lab-part8/index.html')
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
    links.includes('data-friend-circle-status="deferred"'),
    'Links emits the local Friend Circle deferred state'
  )
  expect(!links.includes('friends.arthals.ink'), 'Links emits no Friend Circle remote endpoint')
}

for (const path of [
  'src/layouts/BlogPost.astro',
  'src/layouts/TracePost.astro',
  'src/layouts/SayingPost.astro'
]) {
  expect(source(path).includes("musicMode='compact'"), `${path} opts into compact music mode`)
}

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
