import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { parse as parseCss, walk } from 'css-tree'
import { parse } from 'node-html-parser'

import {
  assetPrefix,
  diagramLibraryLicense,
  diagramLicense,
  readDiagramAsset
} from '../lib/mermaid/server.mjs'

export async function publishDiagramAssets(directory: string, root = process.cwd()) {
  const names = new Set<string>()
  async function inspect(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = resolve(path, entry.name)
      if (entry.isDirectory()) {
        await inspect(file)
        continue
      }
      if (!/\.(html|xml)$/.test(entry.name)) continue
      const source = await readFile(file, 'utf8')
      const document = parse(source)
      // RSS 的正文经过 XML 转义；解码后再由 HTML parser 提取图片地址。
      const documents = [
        document,
        ...document.querySelectorAll('content\\:encoded').map((node) => parse(node.text))
      ]
      for (const tree of documents) {
        for (const image of tree.querySelectorAll('img[src]')) {
          const url = new URL(image.getAttribute('src')!, 'https://susurrium.github.io')
          if (url.pathname.startsWith(assetPrefix))
            names.add(url.pathname.slice(assetPrefix.length))
        }
        for (const style of tree.querySelectorAll('.mermaid-diagram style'))
          walk(parseCss(style.rawText), (node) => {
            if (node.type === 'Url' && node.value.startsWith(assetPrefix))
              names.add(node.value.slice(assetPrefix.length))
          })
      }
    }
  }
  await inspect(directory)
  const output = resolve(directory, assetPrefix.slice(1))
  await mkdir(output, { recursive: true })
  await writeFile(resolve(output, 'PELE-LICENSE.txt'), diagramLibraryLicense())
  if (!names.size) return 0
  for (const name of names)
    await writeFile(resolve(output, name), await readDiagramAsset(name, root))
  await writeFile(resolve(output, 'FONT-LICENSE.txt'), diagramLicense())
  return names.size
}

export default function mermaidIntegration(): AstroIntegration {
  let root: string
  return {
    name: 'susurrium-mermaid',
    hooks: {
      'astro:config:setup': ({ config, addMiddleware, updateConfig }) => {
        root = fileURLToPath(config.root)
        addMiddleware({
          entrypoint: new URL('../middleware/mermaid.ts', import.meta.url),
          order: 'post'
        })
        updateConfig({
          vite: {
            ssr: { external: ['fontkit', '@resvg/resvg-js', 'subset-font'] }
          }
        })
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          const path = new URL(request.url ?? '/', 'http://localhost').pathname
          if (!path.startsWith(assetPrefix)) return next()
          try {
            const name = path.slice(assetPrefix.length)
            const buffer =
              name === 'FONT-LICENSE.txt'
                ? diagramLicense()
                : name === 'PELE-LICENSE.txt'
                  ? diagramLibraryLicense()
                  : await readDiagramAsset(name, root)
            response.setHeader(
              'Content-Type',
              name.endsWith('.svg')
                ? 'image/svg+xml'
                : name.endsWith('.png')
                  ? 'image/png'
                  : name.endsWith('.woff2')
                    ? 'font/woff2'
                    : 'text/plain; charset=utf-8'
            )
            response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            response.end(buffer)
          } catch (error) {
            next(error)
          }
        })
      },
      'astro:build:done': async ({ dir, logger }) => {
        const count = await publishDiagramAssets(fileURLToPath(dir), root)
        logger.info(`Mermaid: published ${count} referenced diagram assets`)
      }
    }
  }
}
