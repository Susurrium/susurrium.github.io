/** 页面目录地址保留查询串、片段和编码；资源地址由调用方继续使用原路径。 */
export function directoryPath(path: string): string {
  const url = new URL(path, 'https://susurrium.github.io')
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return `${url.pathname}${url.search}${url.hash}`
}
