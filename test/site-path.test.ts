import { expect, test } from 'bun:test'

import { directoryPath } from '../src/lib/site-path'

test('directory URLs preserve queries, fragments, encoding and the root path', () => {
  expect(directoryPath('/projects#sponsorship')).toBe('/projects/#sponsorship')
  expect(directoryPath('/search?q=中文&tag=ci%2Fcd#results')).toBe(
    '/search/?q=%E4%B8%AD%E6%96%87&tag=ci%2Fcd#results'
  )
  expect(directoryPath('/blog/folder/%E4%B8%AD%E6%96%87%20name/')).toBe(
    '/blog/folder/%E4%B8%AD%E6%96%87%20name/'
  )
  expect(directoryPath('/')).toBe('/')
})
