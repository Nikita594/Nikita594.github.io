// Проверки в настоящем браузере (Chromium через Playwright).
// Перед запуском: npm run build && npm run build:single
// Запуск: npm run e2e   (если playwright не установлен в проект: PLAYWRIGHT_PATH=/путь/к/playwright npm run e2e)
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { serve } from './server.mjs'
import { scenarios } from './scenarios.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const profiles = join(here, '.profiles')
const out = join(here, 'out')
await rm(profiles, { recursive: true, force: true })
await mkdir(out, { recursive: true })

const { server, url } = await serve(join(root, 'dist'))
const singleUrl = 'file://' + join(root, 'dist-single', 'index.html')

const ctx = {
  url,
  singleUrl,
  out,
  /** Новый «чистый» браузер со своим профилем; профиль переживает закрытие браузера. */
  async browser(name, opts = {}) {
    const browser = await chromium.launchPersistentContext(join(profiles, name), {
      headless: true,
      viewport: opts.viewport ?? { width: 1280, height: 800 },
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
      acceptDownloads: true,
      ...opts.launch,
    })
    const errors = []
    browser.on('page', (p) => {
      p.on('pageerror', (e) => errors.push(String(e)))
      p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    })
    browser.errors = errors
    return browser
  },
}

let failed = 0
const only = process.argv[2]
for (const [name, fn] of Object.entries(scenarios)) {
  if (only && !name.includes(only)) continue
  try {
    await fn(ctx)
    console.log('✓', name)
  } catch (e) {
    failed++
    console.log('✗', name, '\n   ', e?.message ?? e)
  }
}
server.close()
console.log(failed ? `\nНе прошло: ${failed}` : '\nВсе проверки прошли')
process.exit(failed ? 1 : 0)
