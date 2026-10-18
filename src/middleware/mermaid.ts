import { defineMiddleware } from 'astro:middleware'

import { renderMermaidHtml } from '../lib/mermaid/server.mjs'

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next()
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  const body = await response.text()
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(await renderMermaidHtml(body), { status: response.status, headers })
})
