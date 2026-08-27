import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const bun = process.platform === 'win32' ? 'bun.exe' : 'bun'
const astroCli = resolve(process.cwd(), 'node_modules/astro/bin/astro.mjs')
const node = process.execPath
const buildSequence = [
  // `astro build` owns the required content sync.  Checking its resulting
  // generated types avoids Astro 6's intermittent second sync deadlock on
  // Windows while keeping a full type/diagnostic gate in every build.
  [node, [astroCli, 'build']],
  [node, [astroCli, 'check', '--noSync']]
]

const sequences = {
  build: buildSequence,
  ci: [
    [bun, ['run', 'preflight']],
    [bun, ['run', 'lint:check']],
    // Do not execute `bun run build` here. On Windows that adds a nested Bun
    // launcher above this synchronous runner and can intermittently leave the
    // Astro child waiting after "Building static entrypoints". Use the same
    // concrete build contract as the standalone command instead.
    ...buildSequence,
    [bun, ['run', 'verify:phase1']],
    [bun, ['run', 'test:phase2']],
    [bun, ['run', 'verify:phase2']],
    [bun, ['run', 'verify:phase3']],
    [bun, ['run', 'test:phase4']],
    [bun, ['run', 'verify:phase4']],
    [bun, ['run', 'test:phase5']],
    [bun, ['run', 'verify:phase5']],
    [bun, ['run', 'verify:phase6']],
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
    // Keep Astro's output on the caller's console rather than buffering a
    // second process stream during the Windows build sequence.
    stdio: 'inherit',
    shell: false
  })

  if (result.error) {
    console.error(`Unable to run ${command} ${args.join(' ')}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) process.exit(result.status ?? 1)
}
