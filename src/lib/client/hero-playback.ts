/** 保留 CSS 动画配方，通过共享时钟控制预读、解码与不可见时的暂停。 */
export function createHeroPlayback(hero: HTMLElement, signal: AbortSignal) {
  const images = [...hero.querySelectorAll<HTMLImageElement>('[data-hero-image]')]
  let animations: Animation[] = []
  let slides: Animation[] = []
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const retryButton = hero.querySelector<HTMLButtonElement>('[data-hero-retry]')
  const ready = new Set<number>()
  const attempts = new Map<number, number>()
  let visible = true
  let pending: number | undefined
  let timer = 0
  let retryTimer = 0
  let nextBoundary = 6000
  let guarded = false
  let failed: number | undefined
  let running = false
  const refreshAnimations = () => {
    animations = [
      ...hero.querySelectorAll('.hero-gallery__slide, .hero-gallery__parallax > use')
    ].flatMap((element) => element.getAnimations())
    slides = animations.filter(
      (animation) =>
        'animationName' in animation && animation.animationName === 'hero-gallery-image-animation'
    )
    animations.forEach((animation) => animation.pause())
  }
  refreshAnimations()

  const eligible = () =>
    visible &&
    !document.hidden &&
    !motion.matches &&
    !['pending', 'revealing'].includes(document.documentElement.dataset.homeHandoff ?? '')
  const clock = () => Number(slides[0]?.currentTime ?? 0)
  const nextIndex = () => Math.round(nextBoundary / 6000) % images.length
  const clearTimer = () => {
    window.clearTimeout(timer)
    timer = 0
  }
  const pause = () => {
    clearTimer()
    animations.forEach((animation) => animation.pause())
    running = false
  }

  const load = async (index: number) => {
    if (signal.aborted || ready.has(index) || pending !== undefined) return
    const image = images[index]
    if (!image) throw new Error(`Missing Hero slide: ${index}`)
    pending = index
    attempts.set(index, (attempts.get(index) ?? 0) + 1)
    try {
      if (image.dataset.heroDeferredSrc) {
        if (image.dataset.heroDeferredSrcset) image.srcset = image.dataset.heroDeferredSrcset
        image.src = image.dataset.heroDeferredSrc
      }
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          image.removeEventListener('load', loaded)
          image.removeEventListener('error', error)
          signal.removeEventListener('abort', aborted)
          window.clearTimeout(timeout)
        }
        const loaded = () => {
          cleanup()
          resolve()
        }
        const error = () => {
          cleanup()
          reject(new Error(`Hero image failed: ${image.currentSrc || image.src}`))
        }
        const aborted = () => {
          cleanup()
          reject(new DOMException('Hero disconnected', 'AbortError'))
        }
        const timeout = window.setTimeout(() => {
          cleanup()
          reject(new Error(`Hero image timed out: ${index}`))
        }, 20000)
        image.addEventListener('load', loaded)
        image.addEventListener('error', error)
        signal.addEventListener('abort', aborted, { once: true })
        if (image.complete) {
          if (image.naturalWidth > 0) loaded()
          else error()
        }
      })
      await image.decode()
      if (signal.aborted) return
      ready.add(index)
      failed = undefined
      if (retryButton) retryButton.hidden = true
      if (index === 0) performance.mark('home-hero-image-ready')
    } catch (error) {
      if (signal.aborted) return
      failed = index
      hero.dataset.playbackError = String(index)
      console.error('Unable to prepare Home Hero.', error)
      if ((attempts.get(index) ?? 0) < 3) {
        retryTimer = window.setTimeout(() => {
          retryTimer = 0
          if (eligible()) {
            failed = undefined
            void load(index)
          }
        }, 2000)
      } else if (retryButton) retryButton.hidden = false
    } finally {
      pending = undefined
      if (!signal.aborted) sync()
    }
  }

  const schedule = () => {
    clearTimer()
    if (!running || images.length < 2) return
    const deadline = guarded ? nextBoundary : nextBoundary - 1000
    timer = window.setTimeout(
      () => {
        timer = 0
        if (!guarded) guarded = true
        else {
          nextBoundary += 6000
          guarded = false
        }
        sync()
      },
      Math.max(0, deadline - clock())
    )
  }

  const sync = () => {
    if (signal.aborted) return
    if (!eligible() || !ready.has(0)) {
      pause()
      hero.dataset.playback = motion.matches ? 'reduced' : 'paused'
      if (
        eligible() &&
        !ready.has(0) &&
        pending === undefined &&
        !retryTimer &&
        (attempts.get(0) ?? 0) < 3
      )
        void load(0)
      return
    }
    const next = nextIndex()
    if (failed === next && !retryTimer && pending === undefined && (attempts.get(next) ?? 0) < 3)
      failed = undefined
    if (guarded && !ready.has(next)) {
      pause()
      hero.dataset.playback = 'waiting'
    } else {
      if (!running) animations.forEach((animation) => animation.play())
      running = true
      hero.dataset.playback = 'running'
      schedule()
    }
    if (images.length > 1 && !ready.has(next) && failed !== next && !retryTimer) void load(next)
  }

  const retry = () => {
    window.clearTimeout(retryTimer)
    retryTimer = 0
    const index = failed ?? (!ready.has(0) ? 0 : nextIndex())
    attempts.delete(index)
    failed = undefined
    if (retryButton) retryButton.hidden = true
    void load(index)
  }
  motion.addEventListener(
    'change',
    () => {
      pause()
      nextBoundary = 6000
      guarded = false
      refreshAnimations()
      sync()
    },
    { signal }
  )
  document.addEventListener('visibilitychange', sync, { signal })
  window.addEventListener('online', retry, { signal })
  retryButton?.addEventListener('click', retry, { signal })
  const handoff = new MutationObserver(sync)
  handoff.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-home-handoff']
  })
  signal.addEventListener(
    'abort',
    () => {
      pause()
      window.clearTimeout(retryTimer)
      handoff.disconnect()
      for (const image of images.slice(1)) {
        image.removeAttribute('srcset')
        image.removeAttribute('src')
      }
    },
    { once: true }
  )
  void load(0)
  return {
    setVisible(value: boolean) {
      if (visible !== value) {
        visible = value
        sync()
      }
    }
  }
}
