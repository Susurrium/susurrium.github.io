import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { afterEach, expect, test } from 'bun:test'

import { checkDocumentation } from '../scripts/lib/documentation.mjs'

const base = resolve('artifacts/docs-check-tests')
const roots: string[] = []

function fixture(files: Record<string, string> = {}) {
  mkdirSync(base, { recursive: true })
  const root = mkdtempSync(join(base, 'case-'))
  roots.push(root)
  const entries = {
    'package.json': JSON.stringify({ scripts: { ci: 'node ci.mjs' } }),
    'README.md': '# 项目\n\n[指南](docs/guide.md) · [历史](docs/archive/README.md)\n',
    'docs/guide.md': '# 指南\n\n## 标题\n\n## 标题\n',
    'docs/archive/README.md': '# 历史\n\n[记录](record.md)\n',
    'docs/archive/record.md': '# 记录\n\n历史命令 `bun run old-command`。\n',
    ...files
  }
  for (const [path, value] of Object.entries(entries)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), value)
  }
  return () => checkDocumentation(root, { entryPoints: ['README.md', 'docs/guide.md'] })
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    if (!root.startsWith(`${base}${sep}`)) throw new Error('测试目录越界')
    rmSync(root, { recursive: true, force: true })
  }
})

test('Markdown 表格、编码路径和重复标题锚点按真实语法解析', () => {
  const check = fixture({
    'README.md':
      '# 项目\n\n[历史](docs/archive/README.md)\n\n| 入口 |\n| --- |\n| [指南](docs/guide.md#标题-1) |\n| [空格](docs/a%20b.md) |\n',
    'docs/a b.md': '# 空格\n\n```markdown\n[仅示例](missing.md)\n```\n'
  })
  expect(check().failures).toEqual([])
})

test('失效文件与失效锚点都给出原文位置', () => {
  const check = fixture({ 'docs/guide.md': '# 指南\n\n[缺失](missing.md)\n\n[锚点](#缺失)\n' })
  expect(check().failures).toEqual([
    'docs/guide.md:3: missing target missing.md',
    'docs/guide.md:5: missing anchor #缺失'
  ])
})

test('历史文档必须出现在归档索引中', () => {
  const check = fixture({ 'docs/archive/README.md': '# 历史\n' })
  expect(
    check().failures.some((failure) => failure.includes('unindexed historical document'))
  ).toBe(true)
})

test('现行示例校验 YAML 和脚本入口，历史命令保留原时点', () => {
  const check = fixture({
    'docs/guide.md': '# 指南\n\n```yaml\ntags: [\n```\n\n`bun run missing`\n'
  })
  const failures = check().failures
  expect(failures.some((failure) => failure.includes('invalid YAML example'))).toBe(true)
  expect(failures.some((failure) => failure.includes('unknown package script missing'))).toBe(true)
  expect(failures.some((failure) => failure.includes('old-command'))).toBe(false)
})

test('间接 Markdown 引用被继续检查，显式 HTML 锚点有效', () => {
  const check = fixture({
    'docs/guide.md': '# 指南\n\n[附录](appendix.md#details)\n',
    'docs/appendix.md': '# 附录\n\n<a id="details"></a>\n\n[缺失](absent.txt)\n'
  })
  expect(check().failures).toEqual(['docs/appendix.md:5: missing target absent.txt'])
})

test('允许仓库根路径和外部链接，拒绝越界本地引用', () => {
  const check = fixture({
    'docs/guide.md':
      '# 指南\n\n[根](/README.md) [外部](https://example.org/a#x) [协议相对](//example.org/a) [越界](../../outside.md)\n'
  })
  expect(check().failures).toEqual([
    'docs/guide.md:3: local link leaves repository: ../../outside.md'
  ])
})
