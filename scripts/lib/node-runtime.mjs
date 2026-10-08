import { readFileSync } from 'node:fs'
import { satisfies, validRange } from 'semver'

export const nodeRequirement = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
).engines.node

if (!validRange(nodeRequirement)) throw new Error(`Invalid Node requirement: ${nodeRequirement}`)

export function requireNodeVersion(version) {
  if (!satisfies(version, nodeRequirement))
    throw new Error(`Node ${version} does not satisfy ${nodeRequirement}`)
  return `Node ${version} satisfies ${nodeRequirement}`
}
