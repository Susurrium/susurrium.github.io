import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const manifest = require.resolve('playwright/package.json')
const cli = resolve(dirname(manifest), require(manifest).bin.playwright)
const temporary = resolve('artifacts/runtime-tmp')
mkdirSync(temporary, { recursive: true })
const result = spawnSync(
  process.execPath,
  [
    cli,
    'install',
    ...(process.argv.includes('--with-deps') ? ['--with-deps'] : []),
    'chromium'
  ],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: resolve('artifacts/mermaid-browsers'),
      TMPDIR: temporary,
      TMP: temporary,
      TEMP: temporary
    }
  }
)
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
