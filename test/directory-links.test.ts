import { expect, test } from 'bun:test'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'

import rehypeDirectoryLinks from '../src/plugins/rehype-directory-links'

test('authored page links use directory URLs while resource links and fragments retain their meaning', async () => {
  const output = String(
    await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeDirectoryLinks)
      .use(rehypeStringify)
      .process(
        '<a href="/traces/existing-note">Note</a><a href="/projects#sponsorship">Support</a><a href="https://susurrium.github.io/blog/folder/中文?q=one#part">Blog</a><a href="#part">Part</a><a href="/blog/manual.pdf">PDF</a><a href="https://other.test/home">Other</a><a href="../photo.webp">Photo</a>'
      )
  )
  expect(output).toContain('href="/traces/existing-note/"')
  expect(output).toContain('href="/projects/#sponsorship"')
  expect(output).toContain(
    'href="https://susurrium.github.io/blog/folder/%E4%B8%AD%E6%96%87/?q=one#part"'
  )
  for (const href of ['#part', '/blog/manual.pdf', 'https://other.test/home', '../photo.webp'])
    expect(output).toContain(`href="${href}"`)
})

test('an authored HTML file URL remains a file URL', async () => {
  const output = String(
    await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeDirectoryLinks)
      .use(rehypeStringify)
      .process('<a href="/blog/example/index.html">HTML</a>')
  )
  expect(output).toContain('href="/blog/example/index.html"')
})
