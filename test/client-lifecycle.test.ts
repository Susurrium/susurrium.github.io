import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, test } from 'bun:test'
import ts from 'typescript'

class ElementStub extends EventTarget {
  dataset: Record<string, string> = {}
  lookup: Record<string, ElementStub | undefined> = {}
  all: Record<string, ElementStub[]> = {}
  attributes = new Map<string, string>()
  classes = new Set<string>()
  isConnected = true
  hidden = false
  disabled = false
  title = ''
  textContent = ''
  value = ''
  style = { overflow: '' }
  parent?: ElementStub
  children: ElementStub[] = []
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, enabled: boolean) =>
      enabled ? this.classes.add(name) : this.classes.delete(name)
  }
  closest(selector: string): ElementStub | null {
    return this.lookup[selector] ?? this.parent?.closest(selector) ?? null
  }
  focus() {}
  querySelector(selector: string) {
    return this.lookup[selector] ?? null
  }
  querySelectorAll(selector: string) {
    return this.all[selector] ?? []
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  append(node: ElementStub) {
    this.children.push(node)
    node.parent = this
  }
  replaceChildren(...nodes: ElementStub[]) {
    this.children = []
    nodes.forEach((node) => this.append(node))
  }
  contains(node: ElementStub) {
    return this.children.includes(node)
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this)
  }
}

function environment(imports: Record<string, unknown> = {}) {
  const registry = new Map<string, new () => ElementStub>()
  const head = new ElementStub()
  const document = Object.assign(new EventTarget(), {
    body: new ElementStub(),
    documentElement: new ElementStub(),
    head,
    createElement: () => new ElementStub()
  })
  const context = vm.createContext({
    HTMLElement: ElementStub,
    Element: ElementStub,
    HTMLScriptElement: class extends ElementStub {},
    AbortController,
    URLSearchParams,
    URL,
    Event,
    CustomEvent,
    customElements: {
      get: (name: string) => registry.get(name),
      define: (name: string, value: new () => ElementStub) => registry.set(name, value)
    },
    document,
    window: Object.assign(new EventTarget(), {
      location: {
        href: 'https://site.test/search?type=blog&tag=Astro',
        search: '?type=blog&tag=Astro'
      },
      matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
      setTimeout,
      clearTimeout
    }),
    setTimeout,
    clearTimeout,
    navigator: {},
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    queueMicrotask,
    console,
    exports: {},
    require: (id: string) => imports[id] ?? {}
  })
  return {
    registry,
    head,
    document,
    context,
    load(file: string, append = '') {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      const script = file.endsWith('.astro')
        ? source.match(/<script>([\s\S]*?)<\/script>/)![1]
        : source
      const compiled = ts.transpileModule(
        script
          .replaceAll('import.meta.env.DEV', 'true')
          .replaceAll('import.meta.env.BASE_URL', "'/'") + append,
        {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
        }
      ).outputText
      vm.runInContext(compiled, context)
    }
  }
}

describe('component lifecycle regression scenarios', () => {
  test('restored URL filters are ready before the asynchronous Pagefind UI exists', () => {
    const env = environment()
    env.load('src/components/search/PFSearch.astro')
    const all = new ElementStub()
    all.dataset = { searchFilterType: 'all', searchFilterValue: '' }
    const blog = new ElementStub()
    blog.dataset = { searchFilterType: 'blog', searchFilterValue: 'Blog' }
    const tag = new ElementStub()
    tag.dataset = { searchFilterKind: 'blog' }
    tag.value = 'Astro'
    const root = new ElementStub()
    root.all = { '[data-search-filter-type]': [all, blog], '[data-search-filter-tag]': [tag] }
    root.lookup['[data-search-filter-type="blog"]'] = blog
    const Constructor = env.registry.get('site-search')!
    const search = new Constructor() as ElementStub & {
      connectedCallback(): void
      pendingFilters: unknown
    }
    search.lookup['[data-search-filter-root]'] = root
    search.connectedCallback()
    expect(search.pendingFilters).toEqual({ 'content-type': 'Blog', tag: ['Astro'] })
  })

  test('persistent player subscriptions stay constant and an error survives reconnect', async () => {
    const env = environment()
    env.load('src/components/MusicPlayer.astro')
    const callbacks: Record<string, Array<() => void>> = {}
    const player = {
      audio: { dataset: {}, currentSrc: '' },
      paused: true,
      on: (name: string, callback: () => void) => (callbacks[name] ??= []).push(callback)
    }
    const meting = Object.assign(new ElementStub(), { aplayer: player })
    const Constructor = env.registry.get('music-player')!
    const music = new Constructor() as ElementStub & {
      connectedCallback(): void
      disconnectedCallback(): void
    }
    music.lookup = {
      '[data-music-meting]': meting,
      '[data-music-nav]': new ElementStub(),
      '[data-music-toggle]': new ElementStub(),
      '[data-music-error]': new ElementStub()
    }
    for (let index = 0; index < 5; index += 1) {
      music.connectedCallback()
      music.disconnectedCallback()
    }
    music.connectedCallback()
    await Promise.resolve()
    expect(Object.values(callbacks).map((items) => items.length)).toEqual([1, 1, 1, 1, 1])
    callbacks.error[0]()
    expect(music.dataset.playbackState).toBe('error')
    music.connectedCallback()
    expect(music.dataset.playbackState).toBe('error')
    expect(music.lookup['[data-music-error]']?.hidden).toBe(false)
  })

  test('each mounted Waline instance is destroyed when its page disconnects', () => {
    let created = 0
    let destroyed = 0
    const env = environment({
      '@waline/client': {
        init: () => {
          created += 1
          return {
            destroy: () => {
              destroyed += 1
            }
          }
        }
      },
      'virtual:config': {
        default: { integ: { waline: { enable: true, server: 'https://comments.test' } } }
      }
    })
    env.load('src/components/waline/Comment.astro')
    const Constructor = env.registry.get('comment-component')!
    const comments = new Constructor() as ElementStub & {
      connectedCallback(): void
      disconnectedCallback(): void
    }
    comments.lookup['#waline'] = new ElementStub()
    comments.dataset.walinePath = '/blog/article'
    comments.connectedCallback()
    comments.disconnectedCallback()
    comments.connectedCallback()
    comments.disconnectedCallback()
    expect({ created, destroyed }).toEqual({ created: 2, destroyed: 2 })
  })

  test('Waline reaction teardown absorbs its cancelled request while preserving other failures', async () => {
    // Exercise the installed component itself, including the pinned dependency
    // patch. Vue and the API are isolated so no comment server is contacted.
    const source = readFileSync(
      new URL('../node_modules/@waline/client/dist/slim.js', import.meta.url),
      'utf8'
    )
    const file = ts.createSourceFile('waline.js', source, ts.ScriptTarget.ESNext, true)
    let reactionComponent: ts.ObjectLiteralExpression | undefined
    const find = (node: ts.Node) => {
      if (
        ts.isObjectLiteralExpression(node) &&
        node.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(file) === '__name' &&
            ts.isNoSubstitutionTemplateLiteral(property.initializer) &&
            property.initializer.text === 'ArticleReaction'
        )
      )
        reactionComponent = node
      ts.forEachChild(node, find)
    }
    find(file)
    expect(reactionComponent).toBeDefined()
    const mount = (request: (options: { signal: AbortSignal }) => Promise<unknown>) => {
      let unmount!: () => void
      let pending!: Promise<unknown>
      const context = vm.createContext({
        AbortController,
        bt: () => ({ value: {} }),
        ee: () => ({
          value: {
            serverURL: 'https://comments.test',
            lang: 'zh-CN',
            path: '/article',
            reaction: ['/heart.svg'],
            locale: {}
          }
        }),
        Pe: {},
        R: (value: unknown) => ({ value }),
        S: (getter: () => unknown) => ({
          get value() {
            return getter()
          }
        }),
        F: (callback: () => void) => callback(),
        I: (callback: () => void) => {
          unmount = callback
        },
        v: (_source: unknown, callback: () => Promise<unknown>) => {
          pending = callback()
        },
        r: request
      })
      vm.runInContext(`(${reactionComponent!.getText(file)}).setup({})`, context)
      return { unmount, pending }
    }
    let aborted = false
    const cancellation = mount(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true
              reject(signal.reason)
            },
            { once: true }
          )
        })
    )
    cancellation.unmount()
    await expect(cancellation.pending).resolves.toBeUndefined()
    expect(aborted).toBe(true)
    const failure = new Error('Reaction service unavailable')
    const unavailable = mount(() => Promise.reject(failure))
    await expect(unavailable.pending).rejects.toBe(failure)
    unavailable.unmount()
  })

  test('releasing a cancelled globe twice cannot remove CSS owned by the main map', async () => {
    const env = environment()
    env.load(
      'src/scripts/residence-map.ts',
      '\n;globalThis.acquireStyles = acquireMapLibreStylesheet;'
    )
    const acquire = env.context.acquireStyles as () => Promise<() => void>
    const mainPending = acquire()
    const globePending = acquire()
    expect(env.head.children.length).toBe(1)
    env.head.children[0].dispatchEvent(new Event('load'))
    const [releaseMain, releaseGlobe] = await Promise.all([mainPending, globePending])
    releaseGlobe()
    releaseGlobe()
    expect(env.head.children.length).toBe(1)
    releaseMain()
    expect(env.head.children.length).toBe(0)
  })

  test('optional resources retry after failure and remain paired with their routed persistence markers', async () => {
    const env = environment()
    env.load('src/lib/client/resources.ts')
    const load = env.context.exports.loadBrowserResource as (
      url: string,
      kind: string,
      persistName: string
    ) => Promise<void>
    const url = 'https://assets.test/player.css'
    const failed = load(url, 'stylesheet', 'player-style')
    expect(load(url, 'stylesheet', 'player-style')).toBe(failed)
    ;(env.head.children[0] as ElementStub & { onerror(): void }).onerror()
    await expect(failed).rejects.toThrow('stylesheet could not be loaded')
    expect(env.head.children.length).toBe(0)

    const retry = load(url, 'stylesheet', 'player-style')
    const retained = env.head.children[0] as ElementStub & { onload(): void }
    retained.onload()
    await retry
    const destination = { head: new ElementStub(), createElement: () => new ElementStub() }
    env.document.dispatchEvent(
      Object.assign(new Event('astro:before-swap'), {
        newDocument: destination
      })
    )
    expect(
      destination.head.children.map((node) => node.attributes.get('data-astro-transition-persist'))
    ).toEqual(['player-style'])
    expect(load(url, 'stylesheet', 'player-style')).toBe(retry)
    expect(env.head.children).toEqual([retained])
  })

  test('copy feedback awaits the clipboard and a failed attempt can be retried successfully', async () => {
    const env = environment({
      '@/lib/client/theme': { readThemePreference: () => 'light', setThemePreference() {} }
    })
    const button = new ElementStub()
    button.dataset.code = 'const answer = 42'
    button.lookup['button[data-copy-code]'] = button
    const messages: string[] = []
    env.document.addEventListener('toast', (event) =>
      messages.push((event as CustomEvent).detail.message)
    )
    let rejectWrite!: (error: Error) => void
    env.context.navigator.clipboard = {
      writeText: () =>
        new Promise<void>((_, reject) => {
          rejectWrite = reject
        })
    }
    env.load('src/components/layout/ThemeProvider.astro')
    const click = () =>
      env.document.dispatchEvent(
        Object.defineProperty(new Event('click'), 'target', {
          value: button
        })
      )
    click()
    expect(button.disabled).toBe(true)
    expect(messages).toEqual([])
    expect(button.classes.has('copied')).toBe(false)
    rejectWrite(new Error('Clipboard permission denied'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(button.disabled).toBe(false)
    expect(button.attributes.get('aria-label')).toBe('复制失败，点击重试')
    expect(messages).toEqual(['复制失败，请重试或手动选择代码。'])
    env.context.navigator.clipboard.writeText = () => Promise.resolve()
    click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(button.classes.has('copied')).toBe(true)
    expect(button.attributes.get('aria-label')).toBe('代码已复制')
    expect(messages).toEqual(['复制失败，请重试或手动选择代码。', '代码已复制。'])
  })

  test('reopening a loading globe cancels the old close cycle and ignores its queued native close event', async () => {
    const env = environment()
    const timers = new Map<number, () => void>()
    let nextTimer = 1
    Object.assign(env.context.window, {
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      setTimeout: (callback: () => void) => {
        const id = nextTimer++
        timers.set(id, callback)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id)
    })
    env.load(
      'src/scripts/residence-map.ts',
      `
      globalThis.startScene = setupResidenceScene;
      acquireMapLibreStylesheet = async () => () => {};
      loadMapLibre = async () => ({
        Map: class {
          addControl() {} on() {} resize() {} remove() {} stop() {}
          setProjection() {} getZoom() { return 1.2 } flyTo() {}
        },
        NavigationControl: class {}
      });
      createAvatarMarker = () => ({ remove() {} });
      applyChineseMapLabels = () => {};
      waitForMapLoad = () => new Promise((resolve) => {
        globalThis.finishMapLoad = resolve;
      });
    `
    )
    const trigger = new ElementStub()
    const close = new ElementStub()
    const dialog = Object.assign(new ElementStub(), {
      open: false,
      showModal() {
        this.open = true
      },
      close() {
        this.open = false
      }
    })
    dialog.lookup = {
      '[data-globe-canvas]': new ElementStub(),
      '[data-globe-map-host]': new ElementStub(),
      '[data-globe-close]': close
    }
    const scene = new ElementStub()
    scene.dataset = { longitude: '116.4', latitude: '39.9', mapStyle: '/style.json' }
    scene.lookup = {
      '[data-map-canvas]': new ElementStub(),
      '[data-globe-dialog]': dialog,
      '[data-globe-trigger]': trigger
    }
    env.context.startScene(scene)
    trigger.dispatchEvent(new Event('click'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(dialog.open).toBe(true)
    expect(dialog.dataset.globeState).toBe('loading')
    close.dispatchEvent(new Event('click'))
    expect(dialog.dataset.globeState).toBe('closing')
    const pendingCloseId = Math.max(...timers.keys())
    expect(timers.has(pendingCloseId)).toBe(true)
    // A successful style response during the animation must not erase the
    // closing state, which is what allows openGlobe to cancel the old timer.
    env.context.finishMapLoad()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(dialog.dataset.globeState).toBe('closing')
    trigger.dispatchEvent(new Event('click'))
    expect(timers.has(pendingCloseId)).toBe(false)
    expect(dialog.dataset.globeState).toBe('loading')
    dialog.dispatchEvent(new Event('close'))
    expect(dialog.open).toBe(true)
    expect(dialog.dataset.globeState).toBe('loading')
    expect(env.document.body.style.overflow).toBe('hidden')
    expect(env.document.body.dataset.globeOpen).toBe('true')
    env.document.dispatchEvent(new Event('astro:before-swap'))
  })
})
