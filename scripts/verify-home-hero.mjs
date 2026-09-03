/**
 * Verify the Home Hero's fixed-media handoff at real viewport sizes.
 *
 * This check deliberately samples the exact reverse-scroll boundary where a
 * fixed image can otherwise flash over the content layer.  It uses the same
 * Chrome DevTools connection as the other browser audits and does not mutate
 * repository content.
 */

const cdpEndpoint = (process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224').replace(/\/$/, '')
const siteUrl = (process.env.HOME_HERO_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

class CdpConnection {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (!message.id) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message))
      else pending.resolve(message.result)
    })
    socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('Chrome connection closed.'))
      this.pending.clear()
    })
  }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }, 10000)
      this.pending.set(id, {
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
        resolve: (value) => {
          clearTimeout(timeout)
          resolve(value)
        }
      })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket.close()
  }
}

async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  return new CdpConnection(socket)
}

async function evaluate(cdp, expression) {
  const result = await cdp.call('Runtime.evaluate', {
    awaitPromise: true,
    expression,
    returnByValue: true
  })
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.text ?? 'Runtime evaluation failed')
  return result.result.value
}

async function sample(cdp, label, scroll) {
  return evaluate(
    cdp,
    `(async () => {
      window.scrollTo(0, ${Math.max(0, Math.round(scroll))});
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const hero = document.querySelector('[data-home-hero]');
      const media = document.querySelector('[data-home-hero-media]');
      const cover = document.querySelector('[data-home-content-cover]');
      const rect = hero?.getBoundingClientRect();
      const style = media ? getComputedStyle(media) : null;
      return {
        label: ${JSON.stringify(label)},
        scrollY: window.scrollY,
        heroBottom: rect?.bottom ?? null,
        mediaHeight: media?.getBoundingClientRect().height ?? null,
        visibleMediaHeight: Number(media?.dataset.mediaVisibleHeight ?? NaN),
        clipBottom: media?.style.getPropertyValue('--hero-gallery-clip-bottom') ?? '',
        clipPath: style?.clipPath ?? '',
        position: style?.position ?? '',
        opacity: style ? Number(style.opacity) : null,
        visibility: style?.visibility ?? '',
        mode: media?.dataset.scrollMode ?? '',
        covered: media?.dataset.mediaCovered ?? '',
        phase: hero?.dataset.heroPhase ?? '',
        coverMode: cover?.dataset.coverMode ?? ''
      };
    })()`
  )
}

const targetResponse = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent('about:blank')}`, {
  method: 'PUT'
})
if (!targetResponse.ok) {
  throw new Error(`Could not create a Chrome target at ${cdpEndpoint}: ${targetResponse.status}`)
}

const target = await targetResponse.json()
const cdp = await connect(target)
try {
  await cdp.call('Page.enable')
  await cdp.call('Runtime.enable')

  const variants = [
    { height: 900, mobile: false, name: 'desktop', width: 1440 },
    { height: 844, mobile: true, name: 'mobile', width: 390 },
    { height: 480, mobile: true, name: 'mobile-short', width: 390 }
  ]

  for (const variant of variants) {
    await cdp.call('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 1,
      height: variant.height,
      mobile: variant.mobile,
      width: variant.width
    })
    await cdp.call('Page.navigate', { url: `${siteUrl}/home` })
    await delay(900)

    const geometry = await evaluate(
      cdp,
      `(() => {
        window.scrollTo(0, 0);
        const hero = document.querySelector('[data-home-hero]');
        if (!hero) return null;
        const rect = hero.getBoundingClientRect();
        return { pageTop: rect.top + window.scrollY, height: rect.height };
      })()`
    )
    if (!geometry) throw new Error(`${variant.name}: Home Hero is missing.`)

    const boundary = geometry.pageTop + geometry.height
    const top = await sample(cdp, 'top', 0)
    const near = await sample(cdp, 'near-boundary', boundary - 1)
    const deep = await sample(cdp, 'deep', boundary + 80)
    const reverseNear = await sample(cdp, 'reverse-near-boundary', boundary - 1)
    const reverseTop = await sample(cdp, 'reverse-top', 0)

    const nearLimit = Math.max(12, (near.mediaHeight ?? 0) * 0.08)
    if (!(near.visibleMediaHeight >= 0 && near.visibleMediaHeight <= nearLimit)) {
      throw new Error(
        `${variant.name}: near-boundary media exposes ${near.visibleMediaHeight}px (limit ${nearLimit}px).`
      )
    }
    if (near.position !== 'fixed' || near.mode !== 'fixed' || near.covered !== 'false') {
      throw new Error(`${variant.name}: near-boundary fixed-media state is inconsistent.`)
    }
    if (near.coverMode !== 'hero' || deep.coverMode !== 'released') {
      throw new Error(`${variant.name}: content-cover handoff is out of sync with Hero geometry.`)
    }
    if (deep.covered !== 'true' || deep.visibility !== 'hidden' || deep.visibleMediaHeight !== 0) {
      throw new Error(`${variant.name}: fully covered Hero did not remain clipped/hidden.`)
    }
    if (
      top.covered !== 'false' ||
      top.visibleMediaHeight < (top.mediaHeight ?? 0) - 1 ||
      reverseTop.visibleMediaHeight < (reverseTop.mediaHeight ?? 0) - 1
    ) {
      throw new Error(`${variant.name}: returning to the top did not restore the full Hero media.`)
    }
    if (reverseNear.visibleMediaHeight > nearLimit) {
      throw new Error(`${variant.name}: reverse scroll exposed a full image at the boundary.`)
    }

    console.log(
      `PASS ${variant.name}: top=${top.visibleMediaHeight}/${top.mediaHeight}, ` +
        `near=${near.visibleMediaHeight}/${near.mediaHeight}, deep=${deep.visibleMediaHeight}, ` +
        `reverseNear=${reverseNear.visibleMediaHeight}, reverseTop=${reverseTop.visibleMediaHeight}`
    )
  }

  console.log('Home Hero scroll verification complete: 0 failure(s).')
} finally {
  cdp.close()
  await fetch(`${cdpEndpoint}/json/close/${target.id}`, { method: 'PUT' }).catch(() => undefined)
}
