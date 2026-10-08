import { requireNodeVersion } from './lib/node-runtime.mjs'

console.log(`PASS ${requireNodeVersion(process.versions.node)}`)
