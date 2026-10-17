// Скриншоты экранов во всех дизайнах — для работы над оформлением.
// 1) npm run dev -- --port 5180   2) node scripts/shots.mjs [дизайн] [экран]
//    (если playwright не в проекте: PLAYWRIGHT_PATH=/путь/к/playwright node scripts/shots.mjs)
// Переменные: SHOTS_URL (по умолчанию http://localhost:5180/), SHOTS_OUT (папка, по умолчанию scripts/shots/).
// Картинки: <дизайн>-<экран>-<desktop|phone>.png. Приложение заполняется демо-данными (src/dev/demo.ts).
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
const url = process.env.SHOTS_URL || 'http://localhost:5180/'
const out = process.env.SHOTS_OUT || join(dirname(fileURLToPath(import.meta.url)), 'shots')
const [onlyDesign, onlyScreen] = process.argv.slice(2)

const DESIGNS = ['aurora', 'paper', 'pulse', 'mono']
const SCREENS = ['today', 'next7', 'week', 'timer', 'habits', 'matrix', 'inbox', 'settings', 'search', 'done', 'task', 'menu']
const VIEWPORTS = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({
    viewport,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    deviceScaleFactor: 1,
    colorScheme: 'light',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('ошибка на странице:', e.message))
  await page.goto(url + '#/today')
  await page.waitForFunction(() => window.__ritm)
  await page.evaluate(() => window.__ritm.fillDemo())
  await page.waitForLoadState('load')
  await page.waitForFunction(() => window.__ritm)
  for (const design of DESIGNS) {
    if (onlyDesign && design !== onlyDesign) continue
    for (const mode of design === 'mono' ? ['light', 'dark'] : ['']) {
      await page.evaluate(
        async ([d, m]) => {
          await window.__ritm.setSetting('design', d)
          if (m) await window.__ritm.setSetting('theme', m)
        },
        [design, mode],
      )
      const name = design + (mode === 'dark' ? '-dark' : '')
      for (const screen of SCREENS) {
        if (onlyScreen && screen !== onlyScreen) continue
        if (screen === 'menu' && vpName === 'desktop') continue
        try {
          if (screen === 'task') {
            await page.goto(url + '#/today')
            await page.locator('.ui-task-title').first().click({ timeout: 5000 })
          } else if (screen === 'menu') {
            await page.goto(url + '#/today')
            await page.getByRole('button', { name: 'Ещё' }).click({ timeout: 5000 })
          } else {
            await page.goto(url + '#/' + screen)
          }
          await page.waitForTimeout(500)
          await page.screenshot({ path: join(out, `${name}-${screen}-${vpName}.png`) })
        } catch (e) {
          console.log(`не снялось: ${name} ${screen} ${vpName}:`, e.message.split('\n')[0])
        }
        await page.keyboard.press('Escape')
      }
    }
  }
  await ctx.close()
}
await browser.close()
console.log('готово:', out)
