const cdpEndpoint = (process.env.CHROME_CDP_URL ?? 'http://127.0.0.1:9224').replace(/\/$/, '')
const siteUrl = (process.env.PHASE6_SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '')

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

async function discoverDetailPath(archivePath) {
  try {
    const response = await fetch(`${siteUrl}${archivePath}`)
    if (!response.ok) return null
    const html = await response.text()
    const detailPattern = new RegExp(`href=["']${archivePath}/([^"'#?]+)["']`, 'gi')
    for (const match of html.matchAll(detailPattern)) {
      const segment = decodeURIComponent(match[1])
      // The archive always links to its scoped taxonomy index. It is not a
      // reading detail and must not enter the mobile TOC branch below.
      if (!segment || segment.includes('/') || segment.toLowerCase() === 'tags') continue
      return `${archivePath}/${segment}`
    }
    return null
  } catch {
    return null
  }
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
      const timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for Chrome event: ${method}`)),
        10000
      )
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
    const timeout = setTimeout(
      () => reject(new Error('Timed out connecting to Chrome DevTools.')),
      10000
    )
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

const detailPath = await discoverDetailPath('/blog')

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

  if (!detailPath) {
    await navigate(cdp, `${siteUrl}/blog`)
    const emptyArchive = await evaluate(
      cdp,
      `(() => ({
        archive: Boolean(document.querySelector('[data-page-kind="blog"], main')),
        empty: /No posts yet\\.?|没有文章/.test(document.body.textContent ?? ''),
        detailControls: Boolean(document.getElementById('sidebar-btn'))
      }))()`
    )
    assert(
      emptyArchive.archive && emptyArchive.empty,
      'empty Blog archive renders an explicit no-posts state'
    )
    assert(!emptyArchive.detailControls, 'empty Blog archive does not render detail-only controls')
  } else {
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
        mobile: matchMedia('(max-width: 767px)').matches,
        open: sidebar.classList.contains('show'),
        expanded: button.getAttribute('aria-expanded'),
        shadeVisible: getComputedStyle(shade).display !== 'none',
        focusInside: sidebar.contains(document.activeElement)
      })))
    })`
    )
    assert(opened.mobile, 'browser smoke uses the mobile table-of-contents breakpoint')
    assert(
      opened.open && opened.expanded === 'true' && opened.shadeVisible,
      'mobile table of contents opens with synchronized ARIA state'
    )
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
    assert(
      !closed.open && closed.expanded === 'false' && closed.focusRestored,
      'Escape closes the panel and restores focus to its trigger'
    )

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
    assert(
      reducedMotion === 'none',
      'reduced-motion preference disables the mobile table-of-contents animation'
    )
  }

  // Trace/Saying keep their Media card as one primary link, so the
  // archive-level taxonomy navigation is the discoverable tag entry point.
  await cdp.call('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
  })
  for (const archive of [
    { kind: 'trace', path: '/traces', tagPath: '/traces/tags' },
    { kind: 'saying', path: '/sayings', tagPath: '/sayings/tags' }
  ]) {
    await navigate(cdp, `${siteUrl}${archive.path}`)
    const taxonomy = await evaluate(
      cdp,
      `(() => {
        const navigation = document.querySelector('[data-taxonomy-navigation]')
        const heading = document.querySelector('h1')
        const cards = document.querySelector('[data-traces-list], [data-sayings-archive]')
        const navigationRect = navigation?.getBoundingClientRect()
        const headingRect = heading?.getBoundingClientRect()
        const cardsRect = cards?.getBoundingClientRect()
        return {
          count: Number(navigation?.getAttribute('data-taxonomy-count') ?? -1),
          empty: Boolean(navigation?.querySelector('[data-taxonomy-empty]')),
          indexHref: navigation?.querySelector('[data-taxonomy-action="index"]')?.getAttribute('href'),
          tagHrefs: [...(navigation?.querySelectorAll('[data-taxonomy-action="tag"]') ?? [])].map((link) => link.getAttribute('href')),
          navigationVisible: Boolean(navigation && navigationRect && navigationRect.width > 0),
          navigationTop: navigationRect?.top ?? null,
          headingBottom: headingRect?.bottom ?? null,
          cardsTop: cardsRect?.top ?? null,
          noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        }
      })()`
    )
    assert(
      taxonomy.navigationVisible && taxonomy.indexHref === archive.tagPath,
      `${archive.kind} archive exposes its visible View all tags entry`
    )
    assert(
      taxonomy.tagHrefs.length <= 6 &&
        taxonomy.tagHrefs.every((href) => href?.startsWith(`${archive.tagPath}/`)),
      `${archive.kind} archive tag previews stay within their scoped route`
    )
    assert(
      (taxonomy.count === 0) === taxonomy.empty,
      `${archive.kind} archive keeps its empty taxonomy message in sync with the count`
    )
    assert(
      taxonomy.noHorizontalOverflow,
      `${archive.kind} archive taxonomy does not overflow the mobile viewport`
    )
    if (taxonomy.cardsTop !== null) {
      assert(
        taxonomy.navigationTop < taxonomy.cardsTop &&
          taxonomy.headingBottom <= taxonomy.navigationTop,
        `${archive.kind} archive places taxonomy between the heading and cards`
      )
    }
    await navigate(cdp, `${siteUrl}${taxonomy.indexHref}`)
    const indexPathname = await evaluate(cdp, 'location.pathname')
    assert(
      indexPathname === archive.tagPath,
      `${archive.kind} archive View all tags opens its index page`
    )
    const firstTagHref = taxonomy.tagHrefs[0]
    if (firstTagHref) {
      await navigate(cdp, `${siteUrl}${firstTagHref}`)
      const pathname = await evaluate(cdp, 'location.pathname')
      assert(
        pathname.startsWith(`${archive.tagPath}/`),
        `${archive.kind} archive tag chip opens its scoped result page`
      )
    }
  }

  await navigate(cdp, `${siteUrl}/search`)
  await delay(500)
  const searchFilters = await evaluate(
    cdp,
    `(() => {
      const filterRoot = document.querySelector('[data-search-filter-root]')
      const typeButtons = [...(filterRoot?.querySelectorAll('[data-search-filter-type]') ?? [])]
      const drawer = document.querySelector('[data-search-filter-drawer]')
      const filterRect = filterRoot?.getBoundingClientRect()
      return {
        bodyHasContent: (document.body.innerText ?? '').trim().length > 0,
        kinds: typeButtons.map((button) => button.getAttribute('data-search-filter-type')),
        filterVisible: Boolean(filterRoot && filterRect && filterRect.width > 0),
        drawerOpen: Boolean(drawer?.open),
        mainSearchHref: document.querySelector('a[title="Search"]')?.getAttribute('href'),
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        pagefindRoot: Boolean(document.querySelector('site-search')),
        duplicateTaxonomy: Boolean(document.querySelector('[data-search-taxonomy]'))
      }
    })()`
  )
  assert(searchFilters.bodyHasContent, 'Search page renders visible content')
  assert(searchFilters.filterVisible, 'Search page exposes the unified filter panel')
  assert(
    ['all', 'blog', 'trace', 'saying'].every((kind) => searchFilters.kinds.includes(kind)),
    'Search page exposes All, Blog, Trace, and Saying content-type filters'
  )
  assert(
    searchFilters.kinds.indexOf('all') < searchFilters.kinds.indexOf('blog') &&
      searchFilters.kinds.indexOf('blog') < searchFilters.kinds.indexOf('trace') &&
      searchFilters.kinds.indexOf('trace') < searchFilters.kinds.indexOf('saying'),
    'Search content-type filters keep registry order after All'
  )
  assert(
    searchFilters.mainSearchHref === '/search',
    'Header search icon still points directly to /search'
  )
  assert(searchFilters.pagefindRoot, 'Search page keeps the existing Pagefind custom element')
  assert(
    !searchFilters.duplicateTaxonomy,
    'Search page does not render the removed duplicate tag browser'
  )
  assert(
    searchFilters.noHorizontalOverflow,
    'Search filter panel does not overflow the mobile viewport'
  )

  await evaluate(cdp, `document.querySelector('[data-search-filter-drawer] summary')?.click()`)
  await delay(100)
  const openedFilters = await evaluate(
    cdp,
    `(() => ({
      open: Boolean(document.querySelector('[data-search-filter-drawer]')?.open),
      tagControls: document.querySelectorAll('[data-search-filter-tag]').length,
      kindTagCounts: Object.fromEntries(
        ['blog', 'trace', 'saying'].map((kind) => {
          const button = document.querySelector(
            '[data-search-filter-type="' + kind + '"]'
          )
          const panel = document.querySelector('[data-search-filter-tags="' + kind + '"]')
          const declared = Number(
            button?.querySelector('.search-filter-count')?.textContent?.match(/\\d+/)?.[0] ?? 0
          )
          const actual = document.querySelectorAll(
            '[data-search-filter-tags="' + kind + '"] [data-search-filter-tag]'
          ).length
          const emptyState = Boolean(panel?.querySelector('.search-filter-empty'))
          return [kind, { declared, actual, emptyState }]
        })
      )
    }))()`
  )
  assert(openedFilters.open, 'Mobile search filters can be expanded from the summary')
  const tagCountEntries = Object.values(openedFilters.kindTagCounts)
  assert(
    openedFilters.tagControls ===
      tagCountEntries.reduce((total, { actual }) => total + actual, 0) &&
      tagCountEntries.every(
        ({ declared, actual, emptyState }) => declared === actual && (actual === 0) === emptyState
      ),
    'Search filter panel keeps declared tag counts and empty states synchronized'
  )

  await evaluate(
    cdp,
    `(() => {
      const input = document.querySelector('.pagefind-ui__search-input')
      if (!(input instanceof HTMLInputElement)) return false
      input.value = 'Sisyphus'
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Sisyphus' }))
      return true
    })()`
  )
  await delay(1000)
  await evaluate(cdp, `document.querySelector('[data-search-filter-type="saying"]')?.click()`)
  await delay(800)
  const sayingSearch = await evaluate(
    cdp,
    `(() => ({
      url: location.href,
      selected: document.querySelector('[data-search-filter-type="saying"]')?.getAttribute('aria-selected'),
      links: [...document.querySelectorAll('.pagefind-ui__result-link')].map((link) => link.getAttribute('href'))
    }))()`
  )
  assert(
    sayingSearch.selected === 'true' && sayingSearch.url.includes('type=saying'),
    'Selecting Saying applies the content-type Pagefind filter'
  )
  assert(
    sayingSearch.links.length > 0 &&
      sayingSearch.links.every((href) => href?.startsWith('/sayings/')),
    'Saying filter limits matching search results to Saying routes'
  )

  await evaluate(cdp, `document.querySelector('[data-search-filter-type="trace"]')?.click()`)
  await delay(500)
  const traceSearch = await evaluate(
    cdp,
    `(() => ({
      url: location.href,
      selected: document.querySelector('[data-search-filter-type="trace"]')?.getAttribute('aria-selected'),
      links: [...document.querySelectorAll('.pagefind-ui__result-link')].map((link) => link.getAttribute('href'))
    }))()`
  )
  assert(
    traceSearch.selected === 'true' && traceSearch.url.includes('type=trace'),
    'Selecting Trace applies the content-type Pagefind filter'
  )
  assert(
    traceSearch.links.every((href) => href?.startsWith('/traces/')),
    'Trace filter limits matching search results to Trace routes, including the empty state'
  )

  const availableTagKind = Object.entries(openedFilters.kindTagCounts).find(
    ([, { actual }]) => actual > 0
  )?.[0]
  if (availableTagKind) {
    await evaluate(
      cdp,
      `(() => {
        const kind = ${JSON.stringify(availableTagKind)}
        const button = [...document.querySelectorAll('[data-search-filter-type]')].find(
          (candidate) => candidate.getAttribute('data-search-filter-type') === kind
        )
        button?.click()
      })()`
    )
    await delay(300)
    const tagSearch = await evaluate(
      cdp,
      `(() => {
        const kind = ${JSON.stringify(availableTagKind)}
        const input = [...document.querySelectorAll('[data-search-filter-tag]')].find(
          (candidate) => candidate.getAttribute('data-search-filter-kind') === kind
        )
        if (!(input instanceof HTMLInputElement)) return null
        input.click()
        return { kind, value: input.value, checked: input.checked }
      })()`
    )
    await delay(500)
    const tagState = await evaluate(cdp, `(() => ({ url: location.href }))()`)
    assert(
      tagSearch?.checked && tagState.url.includes('tag='),
      'Selecting a scoped tag applies the Pagefind tag filter and preserves URL state'
    )
  } else {
    pass('Scoped tag interaction skipped because all published collections expose zero tags')
  }

  console.log(
    `Phase 6 browser smoke complete: 0 failure(s).${detailPath ? '' : ' Detail route was absent; archive empty-state path verified.'}`
  )
} finally {
  cdp.close()
  await fetch(`${cdpEndpoint}/json/close/${target.id}`, { method: 'PUT' }).catch(() => undefined)
}
