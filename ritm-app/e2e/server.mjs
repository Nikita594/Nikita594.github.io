// Мини-сервер для проверок: раздаёт dist/ по адресу /ritm/, как GitHub Pages.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
}

export function serve(root, prefix = '/ritm/') {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(302, { location: prefix }).end()
      return
    }
    let rel = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!rel || rel.endsWith('/')) rel += 'index.html'
    rel = normalize(rel).replace(/^(\.\.[/\\])+/, '')
    const file = join(root, rel)
    try {
      if (!(await stat(file)).isFile()) throw new Error()
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
      res.end(await readFile(file))
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}${prefix}` })),
  )
}
