import manifest from '@/data/friend-avatars.generated.json'

type AvatarRecord = {
  state: string
  candidates?: Array<{ src: string; width: number; height: number }>
}

export function friendAvatar(source: string) {
  const record = (manifest.images as Record<string, AvatarRecord>)[source]
  if (!record) throw new Error(`Friend avatar is missing from the generated manifest: ${source}`)
  if (record.state === 'unavailable') return undefined
  if (record.state !== 'ready' || !record.candidates?.length)
    throw new Error(`Invalid friend avatar: ${source}`)
  return {
    src: record.candidates[0].src,
    srcset: record.candidates.map((candidate) => `${candidate.src} ${candidate.width}w`).join(', ')
  }
}
