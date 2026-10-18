import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  unlink,
  writeFile
} from 'node:fs/promises'
import { createServer } from 'node:net'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'bun:test'
import { parse } from 'node-html-parser'

const project = fileURLToPath(new URL('../', import.meta.url))
const browserPath = resolve(project, 'artifacts/mermaid-browsers')

function run(root: string, command: string, args: string[]) {
  const log = resolve(root, 'commands.log')
  appendFileSync(log, `\n${command} ${args.join(' ')}\n`)
  const child = spawn(command, args, {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      MERMAID_BROWSER_PATH: browserPath,
      ASTRO_PREVIEW_BACKGROUND: '1',
      ASTRO_DEV_BACKGROUND: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk
    appendFileSync(log, chunk)
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
    appendFileSync(log, chunk)
  })
  const done = new Promise<number>((accept, reject) => {
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`命令超时：${output}`))
    }, 180000)
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      accept(code ?? 1)
    })
  })
  return { child, done, output: () => output }
}

async function freePort() {
  const server = createServer()
  await new Promise<void>((accept) => server.listen(0, '127.0.0.1', accept))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('没有分配端口')
  await new Promise<void>((accept, reject) =>
    server.close((error) => (error ? reject(error) : accept()))
  )
  return address.port
}

async function waitFor(url: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch (error) {
      if (!(error instanceof TypeError)) throw error
    }
    await new Promise((accept) => setTimeout(accept, 250))
  }
  throw new Error(`服务器没有就绪：${url}`)
}

test('完整站点 Mermaid：MD/MDX、草稿、缓存、浏览器主题、导航、打印及开发更新', async () => {
  const parent = resolve(project, 'artifacts/mermaid-build-tests')
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(resolve(parent, 'case-'))
  if (!root.startsWith(parent + sep + 'case-')) throw new Error('夹具路径越界')
  let completed = false
  let service: ReturnType<typeof run> | undefined
  try {
    for (const path of [
      'src',
      'public',
      'scripts',
      'package.json',
      'bun.lock',
      'tsconfig.json',
      'astro.config.ts',
      'uno.config.ts',
      'patches'
    ])
      await cp(resolve(project, path), resolve(root, path), { recursive: true })
    const installed = run(root, process.execPath, ['install', '--offline', '--frozen-lockfile'])
    expect(await installed.done, installed.output()).toBe(0)
    const samples = [
      {
        kind: 'blog',
        id: 'mermaid-build-markdown',
        extension: 'md',
        title: '流程图测试',
        graph: 'flowchart LR\nA[中文写作] --> B[检查] --> C[发布]',
        draft: false
      },
      {
        kind: 'blog',
        id: 'mermaid-build-mdx',
        extension: 'mdx',
        title: '时序图测试',
        graph: 'sequenceDiagram\nparticipant A as 作者\nparticipant B as 网站\nA->>B: 发布文章',
        draft: false
      },
      {
        kind: 'traces',
        id: 'mermaid-build-trace',
        extension: 'md',
        title: '宽图测试',
        graph:
          'flowchart LR\n' +
          Array.from({ length: 15 }, (_, index) => `N${index}[节点${index}]`).join(' --> '),
        draft: false
      },
      {
        kind: 'sayings',
        id: 'mermaid-build-saying',
        extension: 'mdx',
        title: '引文图表测试',
        graph: 'stateDiagram-v2\n[*] --> Draft\nDraft --> Published',
        draft: false
      },
      {
        kind: 'blog',
        id: 'mermaid-build-draft',
        extension: 'md',
        title: '草稿图表禁止发布',
        graph: 'flowchart TD\nA[草稿保密内容] --> B[未公开]',
        draft: true
      }
    ]
    const sourceFor = (sample: (typeof samples)[number]) =>
      `---\n${sample.kind === 'sayings' ? `text: ${sample.title}` : `title: ${sample.title}\ndescription: Mermaid 集成验证\npublishDate: 2026-10-18`}\ndraft: ${sample.draft}\n---\n\n${sample.extension === 'mdx' ? '{1 + 1}\n\n' : ''}## 图表\n\n\`\`\`mermaid\n${sample.graph.split('\n')[0]}\naccTitle: ${sample.title}\naccDescr: 解释图中的中文节点与关系\n${sample.graph.split('\n').slice(1).join('\n')}\n\`\`\`\n\n[查看随记](/traces/mermaid-build-trace)\n\n\`\`\`js\nconst ordinary = 1\n\`\`\`\n\n公式 $x^2$。\n`
    for (const sample of samples)
      await writeFile(
        resolve(root, 'src/content', sample.kind, `${sample.id}.${sample.extension}`),
        sourceFor(sample)
      )
    const built = run(root, 'node', ['node_modules/astro/bin/astro.mjs', 'build'])
    const status = await built.done
    await writeFile(resolve(root, 'build.log'), built.output())
    expect(status, built.output()).toBe(0)
    const output = resolve(root, 'dist')
    const assets = await readdir(resolve(output, '_diagrams'))
    expect(assets.filter((name) => name.endsWith('.svg')).length).toBe(8)
    expect(assets.filter((name) => name.endsWith('.png')).length).toBe(2)
    for (const name of assets.filter((name) => name.endsWith('.svg')))
      expect(await readFile(resolve(output, '_diagrams', name), 'utf8')).not.toContain(
        '草稿保密内容'
      )
    const firstPath = resolve(output, 'blog/mermaid-build-markdown/index.html')
    const firstHtml = await readFile(firstPath, 'utf8')
    expect(firstHtml).toContain('data-mermaid-diagram')
    expect(firstHtml).not.toContain('data-mermaid-source')
    expect(firstHtml).toContain('data-copy-code')
    const mdxHtml = await readFile(resolve(output, 'blog/mermaid-build-mdx/index.html'), 'utf8')
    expect(mdxHtml).toContain('data-mermaid-diagram')
    expect(mdxHtml).not.toContain('{1 + 1}')
    const rss = await readFile(resolve(output, 'rss.xml'), 'utf8')
    expect(rss).toContain('https://susurrium.github.io/_diagrams/')
    expect(rss).toContain('-feed.png')
    expect(rss).not.toContain('草稿图表禁止发布')
    // 已编译正文继续从源码标记恢复被删除的缓存文件。
    const firstImage = parse(firstHtml).querySelector('.mermaid-light')!.getAttribute('src')!
    await unlink(resolve(root, 'artifacts/mermaid-cache', firstImage.split('/').at(-1)!))
    const rebuilt = run(root, 'node', ['node_modules/astro/bin/astro.mjs', 'build'])
    expect(await rebuilt.done, rebuilt.output()).toBe(0)
    expect(await readFile(firstPath, 'utf8')).toContain(firstImage)

    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    service = run(root, 'node', [
      'node_modules/astro/bin/astro.mjs',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port)
    ])
    await waitFor(base + '/home')
    process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath
    const { chromium } = await import('playwright')
    const browser = await chromium.launch()
    try {
      const context = await browser.newContext({
        permissions: ['clipboard-read', 'clipboard-write']
      })
      const page = await context.newPage()
      const requests: string[] = []
      page.on('request', (request) => {
        if (request.resourceType() === 'script') requests.push(request.url())
      })
      await page.goto(base + '/blog/mermaid-build-markdown')
      await page.locator('.mermaid-light').waitFor({ state: 'visible' })
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLImageElement>('.mermaid-diagram img')].every(
          (image) =>
            !image.getBoundingClientRect().width || (image.complete && image.naturalWidth > 0)
        )
      )
      const evidence = resolve(project, 'artifacts/mermaid-verification')
      await mkdir(evidence, { recursive: true })
      await page
        .locator('.mermaid-diagram')
        .screenshot({ path: resolve(evidence, 'desktop-light.png') })
      for (
        let attempt = 0;
        attempt < 3 && (await page.locator('html').getAttribute('data-theme')) !== 'dark';
        attempt++
      )
        await page.locator('#toggleDarkMode').first().click()
      expect(await page.locator('.mermaid-dark').isVisible()).toBe(true)
      expect(await page.locator('.mermaid-light').isVisible()).toBe(false)
      await page
        .locator('.mermaid-diagram')
        .screenshot({ path: resolve(evidence, 'desktop-dark.png') })
      await page.getByText('查看源码', { exact: true }).focus()
      await page.keyboard.press('Enter')
      expect(await page.locator('.mermaid-source pre').isVisible()).toBe(true)
      await page.getByText('复制源码', { exact: true }).click()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('flowchart LR')
      const search = await page.evaluate(async () => {
        const pagefind = await import('/pagefind/pagefind.js')
        return {
          title: (await pagefind.search('流程图测试')).results.length,
          source: (await pagefind.search('flowchart')).results.length
        }
      })
      expect(search.title).toBeGreaterThan(0)
      expect(search.source).toBe(0)
      await page.emulateMedia({ colorScheme: 'dark' })
      for (
        let attempt = 0;
        attempt < 3 &&
        (await page.locator('html').getAttribute('data-theme-preference')) !== 'system';
        attempt++
      )
        await page.locator('#toggleDarkMode').first().click()
      expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
      await page.emulateMedia({ colorScheme: 'light' })
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
      expect(await page.locator('.mermaid-light').isVisible()).toBe(true)
      for (
        let attempt = 0;
        attempt < 3 && (await page.locator('html').getAttribute('data-theme')) !== 'dark';
        attempt++
      )
        await page.locator('#toggleDarkMode').first().click()
      await page.getByText('查看随记', { exact: true }).click()
      await page.waitForURL('**/traces/mermaid-build-trace')
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('.mermaid-diagram').waitFor()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      expect(
        await page
          .locator('.mermaid-viewport')
          .evaluate((element) => element.scrollWidth > element.clientWidth)
      ).toBe(true)
      await page
        .locator('.mermaid-diagram')
        .screenshot({ path: resolve(evidence, 'mobile-wide-dark.png') })
      await page.goBack()
      await page.locator('.mermaid-diagram').waitFor()
      await page.emulateMedia({ media: 'print' })
      expect(await page.locator('.mermaid-light').isVisible()).toBe(true)
      expect(await page.locator('.mermaid-dark').isVisible()).toBe(false)
      expect(await page.locator('.mermaid-source').isVisible()).toBe(false)
      expect(requests.some((url) => /(?:mermaid|playwright).*\.m?js/.test(url))).toBe(false)
      const noScript = await browser.newContext({ javaScriptEnabled: false })
      const noScriptPage = await noScript.newPage()
      await noScriptPage.goto(base + '/blog/mermaid-build-mdx')
      expect(await noScriptPage.locator('.mermaid-light').isVisible()).toBe(true)
      await noScript.close()
      await context.close()
    } finally {
      await browser.close()
    }
    service.child.kill()
    await service.done
    service = run(root, 'node', [
      'node_modules/astro/bin/astro.mjs',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(port)
    ])
    const before = await (await waitFor(base + '/blog/mermaid-build-markdown')).text()
    const beforeImage = parse(before).querySelector('.mermaid-light')!.getAttribute('src')!
    expect((await fetch(base + beforeImage)).status).toBe(200)
    const changed = { ...samples[0], title: '更新后的流程图' }
    await writeFile(resolve(root, 'src/content/blog/mermaid-build-markdown.md'), sourceFor(changed))
    let updated = ''
    for (let attempt = 0; attempt < 60; attempt++) {
      updated = await (await fetch(base + '/blog/mermaid-build-markdown')).text()
      if (updated.includes('更新后的流程图') && !updated.includes(beforeImage)) break
      await new Promise((accept) => setTimeout(accept, 250))
    }
    expect(updated).toContain('更新后的流程图')
    const afterImage = parse(updated).querySelector('.mermaid-light')!.getAttribute('src')!
    expect(afterImage).not.toBe(beforeImage)
    expect((await fetch(base + afterImage)).status).toBe(200)
    service.child.kill()
    await service.done
    service = undefined
    await writeFile(
      resolve(root, 'src/content/blog/mermaid-build-markdown.md'),
      sourceFor({ ...samples[0], graph: 'flowchart TD\nA[未闭合' })
    )
    const invalidBuild = run(root, 'node', ['node_modules/astro/bin/astro.mjs', 'build'])
    expect(await invalidBuild.done).not.toBe(0)
    expect(invalidBuild.output()).toContain('Mermaid')
    expect(invalidBuild.output()).toContain('mermaid-build-markdown.md:')
    await writeFile(
      resolve(root, 'src/content/blog/mermaid-build-markdown.md'),
      sourceFor(samples[0])
    )
    await unlink(resolve(root, 'src/content/sayings/mermaid-build-saying.mdx'))
    const removed = run(root, 'node', ['node_modules/astro/bin/astro.mjs', 'build'])
    expect(await removed.done, removed.output()).toBe(0)
    expect(
      (await readdir(resolve(output, '_diagrams'))).filter((name) => name.endsWith('.svg')).length
    ).toBe(6)
    completed = true
  } finally {
    if (service) {
      service.child.kill()
      await service.done
    }
    if (completed) {
      if (
        (await realpath(root)) !== root ||
        (await lstat(root)).isSymbolicLink() ||
        !root.startsWith(parent + sep + 'case-')
      )
        throw new Error('夹具清理路径越界')
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } else console.error(`Mermaid integration fixture retained: ${root}`)
  }
}, 420000)
