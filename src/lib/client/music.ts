const escapeText = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

function safeMediaUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

/** APlayer interpolates provider metadata into HTML; treat it as untrusted. */
export function normalizeMusicTracks(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 500).flatMap((track: unknown) => {
    if (!track || typeof track !== 'object') return []
    const record = track as Record<string, unknown>
    const url = safeMediaUrl(record.url)
    if (!url) return []
    return [
      {
        name: escapeText(record.name ?? record.title),
        artist: escapeText(record.artist ?? record.author),
        url,
        cover: safeMediaUrl(record.cover ?? record.pic),
        lrc: ''
      }
    ]
  })
}
