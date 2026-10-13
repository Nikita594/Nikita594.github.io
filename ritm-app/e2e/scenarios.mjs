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

  async 'Списки и задачи: создать, отредактировать, перенести, найти, пережить перезагрузку'(ctx) {
    const b = await ctx.browser('tasks')
    const page = await b.newPage()
    await page.goto(ctx.url + '#/inbox')
    await page.getByRole('heading', { name: 'Входящие' }).waitFor()

    // новый список
    await page.getByRole('button', { name: 'Новый список' }).click()
    await page.getByPlaceholder('Например, Школа').fill('Школа')
    await page.getByRole('button', { name: 'Создать' }).click()
    await page.getByRole('heading', { name: 'Школа' }).waitFor()

    // задача в списке
    await page.getByLabel('Новая задача').fill('Эссе для Common App')
    await page.getByLabel('Новая задача').press('Enter')
    await page.getByText('Эссе для Common App').click()
    const editor = page.getByRole('dialog', { name: 'Задача' })
    await editor.waitFor()
    await editor.getByRole('radio', { name: 'Высокий' }).click()
    await editor.getByLabel('Новая подзадача').fill('Черновик')
    await editor.getByLabel('Новая подзадача').press('Enter')
    await editor.getByLabel('Заметка').fill('500 слов')
    await editor.getByLabel('Список').selectOption({ label: 'Входящие' })
    await editor.getByRole('button', { name: 'Закрыть' }).first().click()
    await editor.waitFor({ state: 'detached' })

    // задача уехала во «Входящие»
    await page.goto(ctx.url + '#/inbox')
    await page.getByText('Эссе для Common App').waitFor()
    await page.getByText('0/1').waitFor()

    // поиск по заметке и подзадаче
    await page.goto(ctx.url + '#/search')
    await page.getByLabel('Поиск задач').fill('черновик')
    await page.getByText('Эссе для Common App').waitFor()

    // перезагрузка — всё на месте
    await page.reload()
    await page.getByText('Эссе для Common App').waitFor()
    await page.getByText('Эссе для Common App').click()
    await page.getByRole('dialog', { name: 'Задача' }).getByLabel('Заметка').waitFor()
    const note = await page.getByRole('dialog', { name: 'Задача' }).getByLabel('Заметка').inputValue()
    assert(note === '500 слов', 'заметка сохранилась: ' + note)
    await page.keyboard.press('Escape')

    // выполнить и вернуть
    await page.goto(ctx.url + '#/inbox')
    await page.getByRole('checkbox', { name: 'Отметить выполненной' }).first().click()
    await page.getByRole('button', { name: 'Вернуть' }).click()
    await page.getByRole('checkbox', { name: 'Отметить выполненной' }).first().waitFor()

    await page.screenshot({ path: ctx.out + '/inbox.png' })
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Быстрый ввод разбирает фразу и показывает, что понял'(ctx) {
    const b = await ctx.browser('quick')
    const page = await b.newPage()
    await page.goto(ctx.url + '#/inbox')
    const input = page.getByLabel('Новая задача')
    await input.fill('английский завтра в 18:00 1ч !2 #учёба')
    for (const chip of ['Завтра 18:00', '1 ч', 'Средний', 'Учёба']) await page.getByText(chip, { exact: true }).waitFor()
    await page.screenshot({ path: ctx.out + '/quick-add.png' })
    await input.press('Enter')
    const row = page.locator('[data-task-id]').filter({ hasText: 'английский' })
    await row.waitFor()
    const text = await row.innerText()
    assert(/Завтра 18:00/.test(text) && /1 ч/.test(text) && /Учёба/.test(text), 'в строке задачи: ' + text)
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Повтор: выполненная задача переезжает на следующий день, запись остаётся в истории'(ctx) {
    const b = await ctx.browser('repeat')
    const page = await b.newPage()
    await page.goto(ctx.url + '#/inbox')
    const input = page.getByLabel('Новая задача')
    await input.fill('зарядка каждый день')
    await page.getByText('Каждый день', { exact: true }).waitFor()
    await input.press('Enter')
    const row = page.locator('[data-task-id]').filter({ hasText: 'зарядка' })
    await row.getByText('Сегодня').waitFor()
    await row.getByRole('checkbox').click()
    await page.getByText(/Следующий раз — завтра/).waitFor()
    await page.locator('[data-task-id]').filter({ hasText: 'зарядка' }).getByText('Завтра').waitFor()
    await page.getByRole('button', { name: /Выполнено/ }).click()
    const doneRows = page.locator('[data-task-id]').filter({ hasText: 'зарядка' })
    assert((await doneRows.count()) === 2, 'одна задача в работе и одна запись в выполненных')
    // настройка повтора в редакторе
    await page.locator('[data-task-id]').filter({ hasText: 'зарядка' }).first().click()
    const editor = page.getByRole('dialog', { name: 'Задача' })
    await editor.getByLabel('Повтор', { exact: true }).selectOption('weekly')
    await editor.getByRole('group', { name: 'Дни недели' }).waitFor()
    await page.screenshot({ path: ctx.out + '/repeat-editor.png' })
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },
}
