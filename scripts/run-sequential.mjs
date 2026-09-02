import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const bun = process.platform === 'win32' ? 'bun.exe' : 'bun'
// On Windows, `bun run astro` resolves the `.bin/astro.exe` shim, which
// launches Astro through Node and can stall after "Building static
// entrypoints". Invoke Astro's ESM CLI directly through Bun so the package
// build/check scripts use the same runtime that has been verified locally.
const astroCli = resolve(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs')
// The project is pinned to Bun and astro-pure currently exposes TypeScript
// entrypoints. The package script is the same stable boundary developers and
// CI use from the command line, so keep the wrapper on that path as well. Use
// the async child-process API below: on Windows, spawnSync can leave Bun's
// Astro child waiting after "Building static entrypoints" even though the
// same command completes normally when launched asynchronously.
const node = process.execPath
const buildSequence = [
  // `astro build` owns the required content sync. Checking its resulting
  // generated types avoids a second content sync while keeping a full
  // type/diagnostic gate in every build.
  [bun, [astroCli, 'build']],
  [bun, [astroCli, 'check', '--noSync']]
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
    [bun, ['run', 'test:content-layer']],
    [bun, ['run', 'verify:phase2']],
    [bun, ['run', 'verify:phase3']],
    [bun, ['run', 'test:phase4']],
    [bun, ['run', 'verify:phase4']],
    [bun, ['run', 'test:phase5']],
    // Keep the phase-specific checks above readable while also making every
    // repository test part of the authoritative CI contract. This catches
    // editor, content-layer and release-policy regressions that are not tied
    // to one numbered phase.
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
