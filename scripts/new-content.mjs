#!/usr/bin/env node
import { mkdir, open, readdir } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { stringify } from 'yaml'

import { isMain } from './lib/file-operations.mjs'

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const collections = { blog: 'blog', trace: 'traces', saying: 'sayings' }

async function assertAvailableContentRoute(base, slug) {
  let entries
  try {
    entries = await readdir(base, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  const canonical = (value) => value.normalize('NFC').toLowerCase()
  const route = canonical(slug)
  for (const entry of entries) {
    let conflict =
      entry.isFile() &&
      /\.mdx?$/i.test(entry.name) &&
      canonical(entry.name.replace(/\.mdx?$/i, '')) === route
    if (entry.isDirectory() && canonical(entry.name) === route) {
      const children = await readdir(resolve(base, entry.name), { withFileTypes: true })
      conflict = children.some((child) => child.isFile() && /^index\.mdx?$/i.test(child.name))
    }
    if (conflict) throw new Error(`内容路由 ${slug} 已存在：${resolve(base, entry.name)}`)
  }
}

export function contentSlug(title) {
  return (
    title
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100)
      .replace(/-+$/g, '') || 'untitled'
  )
}

export async function createContent({
  title,
  type = 'blog',
  slug,
  description = '',
  language,
  author,
  source,
  mdx = false,
  folder = false,
  draft = true,
  projectRoot = defaultRoot,
  dryRun = false,
  now = new Date()
}) {
  if (!Object.hasOwn(collections, type)) throw new Error('type 必须是 blog、trace 或 saying。')
  if (typeof title !== 'string' || !title.trim())
    throw new Error('请提供标题；Saying 使用该文本作为正文引句。')
  title = title.trim()
  if (type === 'blog' && !description.trim()) description = title
  const maximum = type === 'blog' ? 60 : type === 'trace' ? 80 : 500
  if (title.length > maximum) throw new Error(`${type} 文本不能超过 ${maximum} 个字符。`)
  if (description.length > (type === 'blog' ? 160 : 180))
    throw new Error('description 超出内容类型长度限制。')
  if (author !== undefined && (!author.trim() || author.length > 80))
    throw new Error('author 需为 1–80 个字符。')
  if (source !== undefined && (!source.trim() || source.length > 160))
    throw new Error('source 需为 1–160 个字符。')
  const filename = slug ?? contentSlug(title)
  if (
    !/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(filename) ||
    /^(?:tags|\d+|con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(filename)
  )
    throw new Error('slug 必须是安全且未被分类/分页占用的单一路径名称。')
  const base = resolve(projectRoot, 'src/content', collections[type])
  const path = resolve(
    base,
    folder ? `${filename}/index.${mdx ? 'mdx' : 'md'}` : `${filename}.${mdx ? 'mdx' : 'md'}`
  )
  if (!path.startsWith(`${base}${sep}`)) throw new Error('内容路径越界。')
  // Flat Markdown, MDX, and directory index files share the same public route.
  // Reject collisions before dry-run output or any filesystem mutation.
  await assertAvailableContentRoute(base, filename)
  const data =
    type === 'saying'
      ? {
          text: title,
          ...(author ? { author } : {}),
          ...(source ? { source } : {}),
          tags: [],
          draft
        }
      : {
          title,
          ...(type === 'blog' || description ? { description } : {}),
          publishDate: now.toISOString(),
          tags: [],
          ...(language && type === 'blog' ? { language } : {}),
          draft
        }
  const content = `---\n${stringify(data)}---\n\n`
  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true })
    const file = await open(path, 'wx')
    try {
      await file.writeFile(content, 'utf8')
    } finally {
      await file.close()
    }
  }
  return { path, content, draft, dryRun }
}

if (isMain(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2).filter((arg, index) => index !== 0 || arg !== '--'),
      allowPositionals: true,
      options: {
        type: { type: 'string', default: 'blog' },
        slug: { type: 'string' },
        description: { type: 'string', default: '' },
        language: { type: 'string' },
        lang: { type: 'string', short: 'l' },
        author: { type: 'string' },
        source: { type: 'string' },
        mdx: { type: 'boolean', short: 'm' },
        folder: { type: 'boolean', short: 'f' },
        draft: { type: 'boolean', short: 'd' },
        publish: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
      }
    })
    if (values.help)
      console.log(
        'Usage: bun run new [--type blog|trace|saying] [--slug name] [--description text] [--language zh-CN] [--folder] [--mdx] [--publish] [--dry-run] <title or quote>\n默认创建草稿；--publish 才写 draft: false。'
      )
    else {
      if (values.publish && values.draft) throw new Error('--publish 和 --draft 不能同时使用。')
      const result = await createContent({
        ...values,
        title: positionals.join(' '),
        language: values.language ?? values.lang,
        draft: !values.publish,
        dryRun: Boolean(values['dry-run'])
      })
      console.log(`${result.dryRun ? 'dry-run: ' : 'Created: '}${result.path}\n${result.content}`)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
