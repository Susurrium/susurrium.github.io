import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const bun = process.platform === 'win32' ? 'bun.exe' : 'bun'
const astroCli = resolve(process.cwd(), 'node_modules/astro/bin/astro.mjs')
const node = process.execPath

const sequences = {
  build: [
    [node, [astroCli, 'check']],
    [bun, ['run', 'astro', 'build']]
  ],
  ci: [
    [bun, ['run', 'preflight']],
    [bun, ['run', 'lint:check']],
    [bun, ['run', 'build']],
    [bun, ['run', 'verify:phase1']],
    [bun, ['run', 'test:phase2']],
    [bun, ['run', 'verify:phase2']],
    [bun, ['run', 'verify:phase3']],
    [bun, ['run', 'test:phase4']],
    [bun, ['run', 'verify:phase4']],
    [bun, ['run', 'check:assets']]
  ],
  preflight: [
    [node, ['scripts/check-node-version.mjs']],
    [bun, ['scripts/verify-preflight.mjs']]
  ]
}

const sequenceName = process.argv[2]
const sequence = sequences[sequenceName]

if (!sequence) {
  console.error(`Unknown sequential task: ${sequenceName ?? '(missing)'}`)
  process.exit(1)
}

for (const [command, args] of sequence) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true
  })

  if (result.error) {
    console.error(`Unable to run ${command} ${args.join(' ')}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) process.exit(result.status ?? 1)
}
