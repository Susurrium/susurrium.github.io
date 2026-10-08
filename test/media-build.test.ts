import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'bun:test'
import { parse } from 'node-html-parser'
import sharp from 'sharp'

import { srcsetUrls } from '../scripts/lib/resource-audit.mjs'

const project = fileURLToPath(new URL('../', import.meta.url))
async function runFixture(root: string, command: string, args: string[]) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolveBuild, reject) => {
      const child = spawn(command, args, {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      const timeout = setTimeout(() => {
        child.kill()
        reject(new Error(`${command} timed out:\n${stdout}\n${stderr}`))
      }, 180000)
      child.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.once('close', (status) => {
        clearTimeout(timeout)
        resolveBuild({ status, stdout, stderr })
      })
    }
  )
}
test('real JPEG and transparent PNG survive content loading, Astro optimization and publication', async () => {
  const fixtures = resolve(project, 'artifacts/media-build-tests')
  await mkdir(fixtures, { recursive: true })
  const root = await mkdtemp(resolve(fixtures, 'case-'))
  if (!root.startsWith(`${fixtures}${sep}case-`)) throw new Error('Unsafe build fixture path')
  let completed = false
  try {
    for (const entry of [
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
      await cp(resolve(project, entry), resolve(root, entry), { recursive: true })
    // Astro 组件及其虚拟样式模块必须解析到同一测试根目录。
    const installed = await runFixture(root, process.execPath, [
      'install',
      '--frozen-lockfile',
      '--offline'
    ])
    await writeFile(resolve(root, 'install.stdout.log'), installed.stdout)
    await writeFile(resolve(root, 'install.stderr.log'), installed.stderr)
    expect(installed.status, `${installed.stdout}\n${installed.stderr}`).toBe(0)
    const cases = [
      { kind: 'blog', slug: 'media-build-jpeg', extension: 'jpg', alpha: false },
      { kind: 'blog', slug: 'media-build-blog-png', extension: 'png', alpha: true },
      { kind: 'traces', slug: 'media-build-png', extension: 'png', alpha: true }
    ]
    const originals = new Map<string, Buffer>()
    for (const item of cases) {
      const directory = resolve(root, 'src/content', item.kind, item.slug)
      await mkdir(directory, { recursive: true })
      const image = sharp({
        create: {
          width: 1800,
          height: 1200,
          channels: item.alpha ? 4 : 3,
          background: item.alpha ? '#33996680' : '#339966'
        }
      })
      const buffer = await (item.alpha ? image.png() : image.jpeg()).toBuffer()
      const path = resolve(directory, `cover.${item.extension}`)
      originals.set(path, buffer)
      await writeFile(path, buffer)
      const cover =
        item.kind === 'blog'
          ? `heroImage:\n  src: ./cover.${item.extension}\n  alt: Actual ${item.extension} cover`
          : `cover: ./cover.${item.extension}\ncoverAlt: Actual ${item.extension} cover`
      await writeFile(
        resolve(directory, 'index.md'),
        `---\ntitle: ${item.slug}\ndescription: Real image build regression\npublishDate: 2026-10-08\ntags: [media]\ndraft: false\n${cover}\n---\n\nBody image:\n\n![Actual body image](./cover.${item.extension})\n`
      )
    }
    const built = await runFixture(root, 'node', [
      resolve(root, 'node_modules/astro/bin/astro.mjs'),
      'build',
      '--root',
      root
    ])
    await writeFile(resolve(root, 'build.stdout.log'), built.stdout)
    await writeFile(resolve(root, 'build.stderr.log'), built.stderr)
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)
    for (const item of cases) {
      const route = item.kind === 'blog' ? 'blog' : 'traces'
      const html = parse(
        await readFile(resolve(root, 'dist', route, item.slug, 'index.html'), 'utf8')
      )
      const cover = html.querySelector('[data-reading-opening-media-image]')!
      expect(cover).not.toBeNull()
      expect(cover.getAttribute('alt')).toBe(`Actual ${item.extension} cover`)
      expect(Number(cover.getAttribute('width'))).toBe(1280)
      const sources = srcsetUrls(cover.getAttribute('srcset')!)
      expect(sources.length).toBe(4)
      const backdrop = html.querySelector('[data-reading-opening-media-backdrop]')!
      expect(backdrop.getAttribute('src')).toBe(cover.getAttribute('src'))
      expect(backdrop.getAttribute('srcset')).toBe(cover.getAttribute('srcset'))
      expect(backdrop.getAttribute('sizes')).toBe(cover.getAttribute('sizes'))
      for (const url of [cover.getAttribute('src')!, ...sources]) {
        const metadata = await sharp(await readFile(resolve(root, 'dist', url.slice(1)))).metadata()
        expect(metadata.format).toBe('webp')
        expect(metadata.width!).toBeLessThanOrEqual(1280)
        expect(metadata.height! / metadata.width!).toBeCloseTo(1200 / 1800, 2)
        if (item.alpha) expect(metadata.hasAlpha).toBe(true)
      }
      const body = html.querySelector('img[alt="Actual body image"]')!
      expect(body).not.toBeNull()
      expect(
        await readFile(resolve(root, 'dist', body.getAttribute('src')!.slice(1)))
      ).not.toHaveLength(0)
      const social = new URL(
        html.querySelector('meta[property="og:image"]')!.getAttribute('content')!
      )
      if (item.kind === 'blog') {
        expect(social.pathname).toContain('/_astro/')
        const metadata = await sharp(
          await readFile(resolve(root, 'dist', social.pathname.slice(1)))
        ).metadata()
        expect(
          Number(html.querySelector('meta[property="og:image:width"]')?.getAttribute('content'))
        ).toBe(metadata.width)
        expect(
          Number(html.querySelector('meta[property="og:image:height"]')?.getAttribute('content'))
        ).toBe(metadata.height)
      } else {
        expect(social.pathname).toBe('/images/social-card.webp')
      }
    }
    for (const [path, bytes] of originals) expect(await readFile(path)).toEqual(bytes)
    completed = true
  } finally {
    if (completed) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    else console.error(`Media build failure evidence retained at ${root}`)
  }
}, 240000)
