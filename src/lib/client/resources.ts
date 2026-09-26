const pendingResources = new Map<string, Promise<void>>()
const persistentResources = new Map<string, HTMLElement>()

// A dynamic resource has no matching tag in the next static document. Give
// Astro a destination marker so its public persistence contract can retain
// the stylesheet/script while it moves the persistent music/QR shell.
if (typeof document !== 'undefined') {
  document.addEventListener('astro:before-swap', (event) => {
    for (const [name, element] of persistentResources) {
      if (!document.head.contains(element)) continue
      const marker = event.newDocument.createElement('meta')
      marker.setAttribute('data-astro-transition-persist', name)
      event.newDocument.head.append(marker)
    }
  })
}

/** Retryable, bounded loading for optional browser resources. */
export function loadBrowserResource(
  url: string,
  kind: 'script' | 'stylesheet',
  persistName?: string,
  timeoutMs = 12_000
): Promise<void> {
  const key = `${kind}:${url}`
  const pending = pendingResources.get(key)
  if (pending) return pending

  const promise = new Promise<void>((resolve, reject) => {
    const element =
      kind === 'script' ? document.createElement('script') : document.createElement('link')
    if (element instanceof HTMLScriptElement) {
      element.src = url
      element.async = true
    } else {
      element.rel = 'stylesheet'
      element.href = url
    }
    if (persistName) {
      element.setAttribute('data-astro-transition-persist', persistName)
      persistentResources.set(persistName, element)
    }
    const finish = (error?: Error) => {
      clearTimeout(timer)
      element.onload = null
      element.onerror = null
      if (error) {
        if (persistName && persistentResources.get(persistName) === element)
          persistentResources.delete(persistName)
        element.remove()
        reject(error)
      } else resolve()
    }
    const timer = setTimeout(() => finish(new Error(`${kind} load timed out`)), timeoutMs)
    element.onload = () => finish()
    element.onerror = () => finish(new Error(`${kind} could not be loaded`))
    document.head.append(element)
  })
  pendingResources.set(key, promise)
  void promise.catch(() => {
    if (pendingResources.get(key) === promise) pendingResources.delete(key)
  })
  return promise
}
