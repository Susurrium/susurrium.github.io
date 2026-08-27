const cdpEndpoint = (process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224').replace(/\/$/, '')
const siteUrl = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')
const detailPath = '/blog/advanced-mathematics'

function pass(message) {
  console.log(`PASS ${message}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
  pass(message)
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

class CdpConnection {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        clearTimeout(pending.timeout)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
        return
      }

      const listeners = this.listeners.get(message.method) ?? []
      this.listeners.delete(message.method)
      listeners.forEach(({ resolve }) => resolve(message.params))
    })

    socket.addEventListener('close', () => {
      this.pending.forEach(({ reject, timeout }) => {
        clearTimeout(timeout)
        reject(new Error('Chrome DevTools connection closed unexpectedly.'))
      })
      this.pending.clear()
    })
  }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for Chrome DevTools command: ${method}`))
      }, 10000)
      this.pending.set(id, { resolve, reject, timeout })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  waitFor(method) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for Chrome event: ${method}`)), 10000)
      const listeners = this.listeners.get(method) ?? []
      listeners.push({
        resolve: (params) => {
          clearTimeout(timeout)
          resolve(params)
        }
      })
      this.listeners.set(method, listeners)
    })
  }

  close() {
    this.socket.close()
  }
}

async function connect(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl)
    const timeout = setTimeout(() => reject(new Error('Timed out connecting to Chrome DevTools.')), 10000)
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timeout)
        resolve(new CdpConnection(socket))
      },
      { once: true }
    )
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timeout)
        reject(new Error('Unable to connect to Chrome DevTools.'))
      },
      { once: true }
    )
  })
}

async function evaluate(cdp, expression) {
  const result = await cdp.call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function navigate(cdp, url) {
  const loaded = cdp.waitFor('Page.loadEventFired')
  await cdp.call('Page.navigate', { url })
  await loaded
  await delay(100)
}

async function dispatchKey(cdp, key, code, keyCode) {
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode
  })
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode
  })
}

const targetResponse = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent('about:blank')}`, {
  method: 'PUT'
})
if (!targetResponse.ok) {
  throw new Error(`Could not create a Chrome target at ${cdpEndpoint}: ${targetResponse.status}`)
}

const target = await targetResponse.json()
const cdp = await connect(target.webSocketDebuggerUrl)

try {
  await cdp.call('Page.enable')
  await cdp.call('Runtime.enable')
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  })
  await cdp.call('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
  })

  await navigate(cdp, `${siteUrl}${detailPath}`)
  const opened = await evaluate(
    cdp,
    `new Promise((resolve) => {
      const button = document.getElementById('sidebar-btn')
      const sidebar = document.getElementById('sidebar')
      const shade = document.getElementById('sidebar-shade')
      button.focus()
      button.click()
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({
        mobile: matchMedia('(max-width: 768px)').matches,
        open: sidebar.classList.contains('show'),
        expanded: button.getAttribute('aria-expanded'),
        shadeVisible: getComputedStyle(shade).display !== 'none',
        focusInside: sidebar.contains(document.activeElement)
      })))
    })`
  )
  assert(opened.mobile, 'browser smoke uses the mobile table-of-contents breakpoint')
  assert(opened.open && opened.expanded === 'true' && opened.shadeVisible, 'mobile table of contents opens with synchronized ARIA state')
  assert(opened.focusInside, 'opening the mobile table of contents moves focus inside it')

  await evaluate(
    cdp,
    `(() => {
      const sidebar = document.getElementById('sidebar')
      const focusable = sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      focusable[focusable.length - 1].focus()
    })()`
  )
  await dispatchKey(cdp, 'Tab', 'Tab', 9)
  const wrapped = await evaluate(
    cdp,
    `(() => {
      const sidebar = document.getElementById('sidebar')
      const focusable = sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      return document.activeElement === focusable[0]
    })()`
  )
  assert(wrapped, 'mobile table of contents traps Tab focus within its dialog-like panel')

  await dispatchKey(cdp, 'Escape', 'Escape', 27)
  const closed = await evaluate(
    cdp,
    `(() => {
      const button = document.getElementById('sidebar-btn')
      const sidebar = document.getElementById('sidebar')
      return {
        open: sidebar.classList.contains('show'),
        expanded: button.getAttribute('aria-expanded'),
        focusRestored: document.activeElement === button
      }
    })()`
  )
  assert(!closed.open && closed.expanded === 'false' && closed.focusRestored, 'Escape closes the panel and restores focus to its trigger')

  await cdp.call('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  })
  await navigate(cdp, `${siteUrl}${detailPath}`)
  const reducedMotion = await evaluate(
    cdp,
    `new Promise((resolve) => {
      const button = document.getElementById('sidebar-btn')
      const sidebar = document.getElementById('sidebar')
      button.click()
      requestAnimationFrame(() => resolve(getComputedStyle(sidebar).animationName))
    })`
  )
  assert(reducedMotion === 'none', 'reduced-motion preference disables the mobile table-of-contents animation')

  console.log('Phase 6 browser smoke complete: 0 failure(s).')
} finally {
  cdp.close()
  await fetch(`${cdpEndpoint}/json/close/${target.id}`, { method: 'PUT' }).catch(() => undefined)
}
