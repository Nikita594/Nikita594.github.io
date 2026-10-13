// Кладёт готовые сборки в папку ../ritm (её раздаёт GitHub Pages):
//   dist/                        → ritm/
//   dist-single/index.html       → ritm/ritm-offline.html
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(app, '..', 'ritm')

await stat(join(app, 'dist', 'index.html'))
await stat(join(app, 'dist-single', 'index.html'))
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(join(app, 'dist'), target, { recursive: true })
await cp(join(app, 'dist-single', 'index.html'), join(target, 'ritm-offline.html'))
console.log('Готово: ' + target)
