import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const bun = process.platform === 'win32' ? 'bun.exe' : 'bun'
// Use the pinned Node runtime for Astro 7's native compiler/Vite 8. Keep Bun
// for package management and tests; execute the CLI directly without shims.
const astroCli = resolve(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs')
const node = process.execPath
const buildSequence = [
  // `astro build` owns the required content sync. Checking its resulting
  // generated types avoids a second content sync while keeping a full
  // type/diagnostic gate in every build.
  [node, [astroCli, 'build']],
  [node, [astroCli, 'check', '--noSync']]
]

const sequences = {
  build: buildSequence,
  ci: [
    [bun, ['run', 'preflight']],
    [node, ['scripts/check-docs.mjs']],
    [bun, ['run', 'lint:check']],
    // Do not execute `bun run build` here. On Windows that adds a nested Bun
    // launcher above this synchronous runner and can intermittently leave the
    // Astro child waiting after "Building static entrypoints". Use the same
    // concrete build contract as the standalone command instead.
    ...buildSequence,
    [bun, ['run', 'verify:phase1']],
    [bun, ['run', 'verify:phase2']],
    [bun, ['run', 'verify:phase3']],
    [bun, ['run', 'verify:phase4']],
    // Run each test once; the full suite includes every numbered phase.
    [bun, ['run', 'test:all']],
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

const runCommand = ([command, args]) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      // Keep Astro's output on the caller's console rather than buffering a
      // second process stream during the Windows build sequence.
      stdio: 'inherit',
      shell: false
    })

    child.once('error', (error) => {
      console.error(`Unable to run ${command} ${args.join(' ')}: ${error.message}`)
      resolve(1)
    })
    child.once('close', (status) => resolve(status ?? 1))
  })

for (const command of sequence) {
  const status = await runCommand(command)
  if (status !== 0) process.exit(status)
}
