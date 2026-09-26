/** Bound headers and the entire streamed body with one deadline and byte limit. */
export async function downloadAvatar(
  url,
  { timeoutMs = 10_000, maxBytes = 5 * 1024 * 1024, fetchImpl = fetch } = {}
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(maxBytes) || maxBytes <= 0)
    throw new Error('Invalid avatar download limits.')
  const controller = new AbortController()
  let timer
  let reader
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Avatar download timed out after ${timeoutMs}ms`)
      controller.abort(error)
      reject(error)
    }, timeoutMs)
  })
  try {
    const response = await Promise.race([
      fetchImpl(url, { redirect: 'follow', signal: controller.signal }),
      timeout
    ])
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
    const announced = Number(response.headers.get('content-length'))
    if (announced > maxBytes) throw new Error(`Avatar exceeds ${maxBytes} byte limit.`)
    if (!response.body) throw new Error('Avatar response has no body.')
    reader = response.body.getReader()
    const chunks = []
    let size = 0
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout])
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new Error(`Avatar exceeds ${maxBytes} byte limit.`)
      chunks.push(value)
    }
    if (size === 0) throw new Error('Avatar response is empty.')
    return {
      buffer: Buffer.concat(chunks, size),
      contentType: response.headers.get('content-type')
    }
  } finally {
    clearTimeout(timer)
    controller.abort()
    if (reader) await reader.cancel().catch(() => undefined)
  }
}
