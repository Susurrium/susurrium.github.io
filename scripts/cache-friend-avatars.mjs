import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { avatarSources, updateAvatars, verifyAvatars } from './lib/friend-avatars.mjs'

const root = process.cwd()
const args = process.argv.slice(2)
if (args.some((argument) => argument !== '--check'))
  throw new Error('Usage: cache:avatars [--check]')
const links = JSON.parse(await readFile(resolve(root, 'public/links.json'), 'utf8'))
const sources = avatarSources(links)
if (args.includes('--check')) {
  const manifest = JSON.parse(
    await readFile(resolve(root, 'src/data/friend-avatars.generated.json'), 'utf8')
  )
  const count = await verifyAvatars(root, sources, manifest)
  const unavailable = sources.filter((source) => manifest.images[source].state === 'unavailable')
  console.log(
    `PASS ${count} friend avatar candidates; ${unavailable.length} explicitly unavailable source(s). No network requests.`
  )
} else {
  const result = await updateAvatars(root, sources)
  await mkdir(resolve(root, 'artifacts/avatar-update'), { recursive: true })
  await writeFile(
    resolve(root, 'artifacts/avatar-update/result.json'),
    JSON.stringify(result, null, 2) + '\n'
  )
  for (const failure of result.failures)
    console.error(`Avatar update failed: ${failure.source}: ${failure.error}`)
  console.log(
    `Avatar manifest updated: ${sources.length} source(s), ${result.failures.length} download failure(s).`
  )
  if (result.failures.length) process.exitCode = 1
}
