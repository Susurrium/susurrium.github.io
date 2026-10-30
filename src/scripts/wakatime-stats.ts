import { fetchWakaTimeSnapshot, formatWakaTimeDuration } from '@/lib/wakatime'

class WakaTimeStats extends HTMLElement {
  private observer: IntersectionObserver | null = null
  private controller: AbortController | null = null

  connectedCallback() {
    if (this.observer || this.controller) return
    this.dataset.refreshState = 'idle'
    const observer = new IntersectionObserver(
      (entries) => {
        if (this.observer !== observer || !this.isConnected) return
        if (!entries.some((entry) => entry.isIntersecting)) return
        this.observer?.disconnect()
        this.observer = null
        void this.refresh()
      },
      { rootMargin: '200px' }
    )
    this.observer = observer
    observer.observe(this)
  }

  disconnectedCallback() {
    this.observer?.disconnect()
    this.observer = null
    this.controller?.abort()
    this.controller = null
    this.removeAttribute('aria-busy')
    this.dataset.refreshState = 'idle'
  }

  private async refresh() {
    const controller = new AbortController()
    this.controller = controller
    this.dataset.refreshState = 'loading'
    this.setAttribute('aria-busy', 'true')
    try {
      const snapshot = await fetchWakaTimeSnapshot(controller.signal)
      if (!this.isConnected || this.controller !== controller) return
      const initialTime = Date.parse(this.dataset.sourceUpdatedAt ?? '')
      if (!Number.isFinite(initialTime)) throw new Error('WakaTime 组件缺少构建快照时间。')
      if (Date.parse(snapshot.sourceUpdatedAt) < initialTime) {
        this.dataset.refreshState = 'ready'
        return
      }
      const codeTime = this.querySelector('[data-wakatime-value="vscode"]')
      const aiCodeTime = this.querySelector('[data-wakatime-value="codexAi"]')
      if (!codeTime || !aiCodeTime) throw new Error('WakaTime 组件缺少时长节点。')
      codeTime.textContent = formatWakaTimeDuration(snapshot.metrics.vscode.seconds)
      aiCodeTime.textContent = formatWakaTimeDuration(snapshot.metrics.codexAi.seconds)
      this.dataset.sourceUpdatedAt = snapshot.sourceUpdatedAt
      this.dataset.refreshState = 'ready'
    } catch (error) {
      if (controller.signal.aborted || this.controller !== controller) return
      // 保留服务器输出的有效时长；刷新失败不会写入虚构的零值。
      this.dataset.refreshState = 'unavailable'
      console.warn('WakaTime 统计暂时无法刷新。', error)
    } finally {
      if (this.controller === controller) {
        this.setAttribute('aria-busy', 'false')
        this.controller = null
      }
    }
  }
}

if (!customElements.get('wakatime-stats')) customElements.define('wakatime-stats', WakaTimeStats)
