;(() => {
  if (window.__susurriumSaying) {
    window.__susurriumSaying.prepare(document)
    return
  }

  function preload(doc, image) {
    let link = doc.head.querySelector('[data-home-saying-preload]')
    if (
      link &&
      link.getAttribute('href') === image.src &&
      (link.getAttribute('imagesrcset') || '') === (image.srcset || '') &&
      (link.getAttribute('imagesizes') || '') === (image.sizes || '')
    )
      return
    link?.remove()
    link = doc.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.fetchPriority = 'low'
    link.dataset.homeSayingPreload = ''
    if (image.srcset) link.setAttribute('imagesrcset', image.srcset)
    if (image.sizes) link.setAttribute('imagesizes', image.sizes)
    link.setAttribute('href', image.src)
    doc.head.append(link)
  }

  function prepare(doc) {
    const data = doc.querySelector('[data-random-saying-catalog]')
    if (!data) return
    const catalog = JSON.parse(data.textContent)
    if (
      !Array.isArray(catalog) ||
      catalog.some(
        (entry) =>
          typeof entry.id !== 'string' ||
          !entry.id ||
          typeof entry.image?.src !== 'string' ||
          !entry.image.src
      )
    )
      throw new Error('Invalid Home Saying catalog')
    if (!catalog.length) return
    const existingId = doc.documentElement.dataset.homeSayingId
    let selected
    if (existingId) {
      selected = catalog.find((entry) => entry.id === existingId)
      if (!selected) throw new Error('Home Saying selection is missing from the catalog')
    } else {
      const random =
        typeof window.__susurriumRandom === 'function' ? window.__susurriumRandom() : Math.random()
      if (!Number.isFinite(random)) throw new Error('Invalid Home Saying random value')
      selected =
        catalog[Math.floor(Math.min(Math.max(random, 0), 1 - Number.EPSILON) * catalog.length)]
      doc.documentElement.dataset.homeSayingId = selected.id
      performance.mark('home-saying-selected', { detail: { id: selected.id } })
    }
    preload(doc, selected.image)
    // 导航准备发生在未激活的文档中，实际请求由当前文档提前发起。
    if (doc !== document) preload(document, selected.image)
    return selected
  }

  function initializeImage(root) {
    const image = root.querySelector('[data-card-image]')
    const preview = root.querySelector('[data-card-preview]')
    const frame = root.querySelector('[data-card-media-frame]')
    const retry = root.querySelector('[data-saying-image-retry]')
    if (!image || !preview || !frame || !retry) return
    if (!image.dataset.sayingImageBound) {
      image.dataset.sayingImageBound = 'true'
      let generation = 0
      const failed = () => {
        generation++
        frame.dataset.previewState = 'error'
        preview.hidden = false
        retry.hidden = false
        retry.disabled = false
      }
      const ready = async () => {
        const current = ++generation
        try {
          await image.decode()
          if (current !== generation || !image.isConnected) return
          frame.dataset.previewState = 'ready'
          preview.hidden = true
          retry.hidden = true
          retry.disabled = false
          performance.mark('home-saying-image-ready', { detail: { id: root.dataset.sayingId } })
        } catch (error) {
          if (current === generation && image.isConnected) {
            failed()
            console.error('Unable to decode Home Saying image.', error)
          }
        }
      }
      image.addEventListener('load', ready)
      image.addEventListener('error', failed)
      retry.addEventListener('click', () => {
        generation++
        retry.hidden = true
        retry.disabled = true
        frame.dataset.previewState = 'loading'
        const src = image.getAttribute('src')
        const srcset = image.getAttribute('srcset')
        image.removeAttribute('srcset')
        image.removeAttribute('src')
        if (srcset) image.setAttribute('srcset', srcset)
        image.setAttribute('src', src)
      })
      image.__sayingReady = ready
      image.__sayingFailed = failed
    }
    // 新文档先组装卡片，激活后再处理已经命中缓存的图片。
    if (root.ownerDocument === document && image.complete) {
      if (image.naturalWidth > 0 && frame.dataset.previewState !== 'ready') image.__sayingReady()
      else if (!image.naturalWidth) image.__sayingFailed()
    }
  }

  function mount(doc) {
    const selected = prepare(doc)
    if (!selected) return
    const root = doc.querySelector('saying-random-card')
    if (!root) return
    if (root.dataset.sayingId !== selected.id) {
      const template = doc.getElementById(`home-saying-template-${selected.id}`)
      if (!(template instanceof HTMLTemplateElement))
        throw new Error('Missing Home Saying template')
      root.dataset.sayingId = selected.id
      root.replaceChildren(doc.importNode(template.content, true))
      root.setAttribute('aria-busy', 'false')
      performance.mark('home-saying-mounted', { detail: { id: selected.id } })
    }
    initializeImage(root)
  }

  window.__susurriumSaying = { prepare, mount }
  document.addEventListener('astro:before-swap', (event) => mount(event.newDocument))
  document.addEventListener('astro:after-swap', () => mount(document))
  prepare(document)
})()
