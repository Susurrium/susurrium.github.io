import { rm } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const root = resolve(process.cwd())
const targets = ['.astro', '.vercel', 'dist']

for (const target of targets) {
  const absolute = resolve(root, target)
  if (!absolute.startsWith(`${root}${sep}`)) {
    throw new Error(`Refusing to clean outside the repository: ${absolute}`)
  }
  await rm(absolute, { force: true, recursive: true })
  console.log(`Removed generated directory: ${target}`)
}
