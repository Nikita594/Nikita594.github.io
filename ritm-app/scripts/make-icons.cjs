// Одноразовый скрипт: рисует PNG-иконки из SVG через Chromium. Запуск: node scripts/make-icons.cjs
const path = require('path')
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
const out = path.join(__dirname, '..', 'public', 'icons')
const svg = (pad, radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="${radius}" fill="#0f766e"/>
<g transform="translate(32 32) scale(${1 - pad}) translate(-32 -31)" fill="#fff">
<rect x="15" y="26" width="8" height="22" rx="4"/><rect x="28" y="14" width="8" height="34" rx="4"/><rect x="41" y="32" width="8" height="16" rx="4"/></g></svg>`
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const shots = [
    ['icon-192.png', 192, svg(0, 14)],
    ['icon-512.png', 512, svg(0, 14)],
    ['icon-maskable-512.png', 512, svg(0.25, 0)],
    ['apple-touch-icon.png', 180, svg(0.1, 0)],
  ]
  for (const [name, size, s] of shots) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml,${encodeURIComponent(s)}" width="${size}" height="${size}">`,
    )
    await page.screenshot({ path: path.join(out, name), omitBackground: true })
  }
  await browser.close()
})()
