// Сценарии проверок. Каждый получает ctx из run.mjs и бросает ошибку, если что-то не так.

export function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function dbCount(page, table) {
  return page.evaluate(
    (table) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('ritm')
        r.onsuccess = () => {
          const tx = r.result.transaction(table, 'readonly')
          const c = tx.objectStore(table).count()
          c.onsuccess = () => resolve(c.result)
          c.onerror = () => reject(c.error)
        }
        r.onerror = () => reject(r.error)
      }),
    table,
  )
}

export const scenarios = {
  async 'PWA: открывается, ставит service worker, работает без сети'(ctx) {
    const b = await ctx.browser('pwa')
    const page = await b.newPage()
    await page.goto(ctx.url)
    await page.getByRole('heading', { name: 'Сегодня' }).waitFor()
    await page.evaluate(() => navigator.serviceWorker.ready)
    assert((await dbCount(page, 'categories')) === 8, 'должно быть 8 встроенных категорий')
    await b.setOffline(true)
    await page.reload()
    await page.getByRole('heading', { name: 'Сегодня' }).waitFor({ timeout: 5000 })
    await page.goto(ctx.url + '#/week')
    await page.getByRole('heading', { name: 'Неделя' }).waitFor({ timeout: 5000 })
    const manifest = await page.evaluate(async () => {
      const link = document.querySelector('link[rel=manifest]')
      return link ? (await fetch(link.href)).json() : null
    })
    assert(manifest && manifest.icons.some((i) => i.sizes === '512x512'), 'манифест с иконкой 512')
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Однофайловая версия открывается с file:// без ошибок'(ctx) {
    const b = await ctx.browser('single')
    const page = await b.newPage()
    await page.goto(ctx.singleUrl)
    await page.getByRole('heading', { name: 'Сегодня' }).waitFor()
    assert((await dbCount(page, 'lists')) === 1, 'список «Входящие» создан')
    const sw = await page.evaluate(() => navigator.serviceWorker?.getRegistrations?.().then((r) => r.length).catch(() => 0) ?? 0)
    assert(sw === 0, 'service worker не должен регистрироваться')
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Телефон 375 px: нет горизонтальной прокрутки'(ctx) {
    const b = await ctx.browser('mobile', { viewport: { width: 375, height: 740 } })
    const page = await b.newPage()
    await page.goto(ctx.url)
    await page.getByRole('heading', { name: 'Сегодня' }).waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 0, `страница шире экрана на ${overflow}px`)
    await page.screenshot({ path: ctx.out + '/mobile-today.png' })
    await b.close()
  },
}
