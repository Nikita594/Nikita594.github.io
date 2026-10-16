// Сценарии проверок. Каждый получает ctx из run.mjs и бросает ошибку, если что-то не так.

export function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

/** Все таблицы базы как есть (для сравнения устройств). Служебные настройки устройства не сравниваем. */
async function dbDump(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('ritm')
        r.onsuccess = async () => {
          const db = r.result
          const out = {}
          for (const name of [...db.objectStoreNames].sort()) {
            out[name] = await new Promise((res) => {
              const q = db.transaction(name).objectStore(name).getAll()
              q.onsuccess = () => res(q.result)
            })
          }
          const device = ['pomodoro', 'backupSnoozedUntil', 'lastBackupAt', 'installedAt']
          out.settings = out.settings.filter((s) => !device.includes(s.key))
          resolve(out)
        }
        r.onerror = () => reject(r.error)
      }),
  )
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
    const sw = await page.evaluate(
      () =>
        navigator.serviceWorker
          ?.getRegistrations?.()
          .then((r) => r.length)
          .catch(() => 0) ?? 0,
    )
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

  async 'Виды: Сегодня, 7 дней, Выполнено'(ctx) {
    const b = await ctx.browser('views')
    const page = await b.newPage()
    await page.goto(ctx.url + '#/today')
    const input = page.getByLabel('Новая задача')
    for (const s of ['SAT practice', 'эссе завтра', 'старая задача вчера', 'тренировка каждый день']) {
      await input.fill(s)
      await input.press('Enter')
    }
    await page.locator('[data-task-id]').filter({ hasText: 'SAT practice' }).waitFor()
    await page.getByRole('button', { name: /С прошлых дней/ }).waitFor()
    assert(!(await page.getByText('старая задача').isVisible()), 'просроченные свёрнуты')
    assert(!(await page.getByText('эссе').isVisible()), 'завтрашней задачи нет в «Сегодня»')
    await page.locator('[data-task-id]').filter({ hasText: 'SAT practice' }).getByRole('checkbox').click()
    await page.getByRole('button', { name: /Сделано сегодня/ }).waitFor()
    await page.screenshot({ path: ctx.out + '/today.png' })

    await page.goto(ctx.url + '#/next7')
    await page.getByRole('heading', { name: 'Следующие 7 дней' }).waitFor()
    const tomorrow = page.locator('section').filter({ has: page.getByRole('button', { name: /^Завтра/ }) })
    await tomorrow.getByText('эссе').waitFor()
    await tomorrow.getByText('тренировка').waitFor() // будущий повтор
    await page.screenshot({ path: ctx.out + '/next7.png', fullPage: true })

    await page.goto(ctx.url + '#/done')
    await page
      .locator('section')
      .filter({ has: page.getByRole('button', { name: /^Сегодня/ }) })
      .getByText('SAT practice')
      .waitFor()
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Неделя: создать блок протягиванием, перенести, растянуть, поставить задачу из панели'(ctx) {
    const b = await ctx.browser('week')
    const page = await b.newPage()
    await page.goto(ctx.url + '#/inbox')
    await page.getByLabel('Новая задача').fill('эссе 1ч30м #учёба')
    await page.getByLabel('Новая задача').press('Enter')
    await page.locator('[data-task-id]').filter({ hasText: 'эссе' }).waitFor()

    await page.goto(ctx.url + '#/week')
    await page.getByRole('heading', { name: 'Неделя' }).waitFor()
    // показываем утро и берём первые два дня недели (они всегда есть)
    await page.evaluate(() => (document.querySelector('[data-week-grid]').scrollTop = (9 * 60 - 360) * 0.8))
    const cols = page.locator('[data-date]')
    const day1 = await cols.nth(0).getAttribute('data-date')
    const day2 = await cols.nth(1).getAttribute('data-date')
    const box = async (i) => cols.nth(i).boundingBox()
    const yOf = (bx, min) => bx.y + (min - 360) * 0.8

    // 1. протянуть 10:00 → 11:30
    let c = await box(0)
    await page.mouse.move(c.x + c.width / 2, yOf(c, 600) + 2)
    await page.mouse.down()
    await page.mouse.move(c.x + c.width / 2, yOf(c, 690) - 2, { steps: 8 })
    await page.mouse.up()
    const dialog = page.getByRole('dialog', { name: 'Блок времени' })
    await dialog.waitFor()
    await dialog.getByLabel('Категория').selectOption({ label: 'Спорт' })
    await dialog.getByLabel('Название').fill('Тренировка')
    await dialog.getByLabel('Название').blur()
    await dialog.getByRole('button', { name: 'Готово' }).click()
    const block = page.getByRole('button', { name: 'Тренировка, 10:00–11:30' })
    await block.waitFor()

    // 2. перенести на следующий день на час позже
    let bb = await block.boundingBox()
    c = await box(1)
    await page.mouse.move(bb.x + 20, bb.y + 8)
    await page.mouse.down()
    await page.mouse.move(c.x + 20, bb.y + 8 + 48, { steps: 10 })
    await page.mouse.up()
    const moved = page.getByRole('button', { name: 'Тренировка, 11:00–12:30' })
    await moved.waitFor()
    assert((await moved.locator('xpath=..').getAttribute('data-date')) === day2, 'блок переехал на второй день')

    // 3. растянуть до 13:00
    bb = await moved.boundingBox()
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 3)
    await page.mouse.down()
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 3 + 24, { steps: 6 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'Тренировка, 11:00–13:00' }).waitFor()

    // 4. задачу из панели — в первый день на 14:00
    await page.evaluate(() => (document.querySelector('[data-week-grid]').scrollTop = (12 * 60 - 360) * 0.8))
    const item = page.locator('[data-panel-task]').filter({ hasText: 'эссе' })
    const ib = await item.boundingBox()
    c = await box(0)
    await page.mouse.move(ib.x + 20, ib.y + 10)
    await page.mouse.down()
    await page.mouse.move(c.x + c.width / 2, yOf(c, 14 * 60) + 4, { steps: 12 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'эссе, 14:00–15:30' }).waitFor()
    assert((await page.locator('[data-panel-task]').filter({ hasText: 'эссе' }).count()) === 0, 'задача ушла из панели')
    await page.screenshot({ path: ctx.out + '/week.png' })

    // 5. после перезагрузки всё на месте, у задачи появился срок
    await page.reload()
    await page.getByRole('button', { name: 'Тренировка, 11:00–13:00' }).waitFor()
    await page.getByRole('button', { name: 'эссе, 14:00–15:30' }).waitFor()
    const due = await page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('ritm')
          r.onsuccess = () => {
            const q = r.result.transaction('tasks').objectStore('tasks').getAll()
            q.onsuccess = () => res(q.result.find((t) => t.title === 'эссе'))
          }
        }),
    )
    assert(due.dueDate === day1 && due.dueTime === 840, 'срок задачи: ' + JSON.stringify([due.dueDate, due.dueTime]))
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Неделя на телефоне: один день, блок создаётся нажатием'(ctx) {
    const b = await ctx.browser('week-mobile', { viewport: { width: 375, height: 740 }, launch: { hasTouch: true, isMobile: true } })
    const page = await b.newPage()
    await page.goto(ctx.url + '#/week')
    await page.getByRole('tablist', { name: 'День недели' }).waitFor()
    assert((await page.locator('[data-date]').count()) === 1, 'на телефоне показан один день')
    await page.evaluate(() => (document.querySelector('[data-week-grid]').scrollTop = (9 * 60 - 360) * 0.8))
    const c = await page.locator('[data-date]').boundingBox()
    await page.touchscreen.tap(c.x + c.width / 2, c.y + (10 * 60 + 10 - 360) * 0.8)
    const dialog = page.getByRole('dialog', { name: 'Блок времени' })
    await dialog.waitFor()
    await dialog.getByRole('button', { name: 'Готово' }).click()
    await page.getByRole('button', { name: /10:00–11:00/ }).waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 0, `страница шире экрана на ${overflow}px`)
    await page.screenshot({ path: ctx.out + '/week-mobile.png' })
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Помодоро: фокус с паузой записывается в «факт», ручной ввод'(ctx) {
    const b = await ctx.browser('timer')
    const page = await b.newPage()
    await page.clock.install({ time: new Date('2026-10-13T18:00:00+03:00') })
    await page.goto(ctx.url + '#/timer')
    await page.getByRole('heading', { name: 'Таймер' }).waitFor()
    await page.getByLabel('Категория').selectOption({ label: 'Английский' })
    await page.getByRole('button', { name: 'Начать фокус' }).click()
    await page.getByRole('button', { name: 'Пауза' }).waitFor()
    await page.clock.runFor('10:00')
    const clock = await page.getByTestId('clock').innerText()
    assert(clock === '15:00', 'через 10 минут осталось 15:00, а показано ' + clock)
    await page.getByRole('button', { name: 'Пауза' }).click()
    await page.clock.runFor('05:00')
    assert((await page.getByTestId('clock').innerText()) === '15:00', 'на паузе время стоит')
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await page.getByRole('button', { name: 'Пауза' }).waitFor()
    await page.clock.runFor('15:01')
    await page.getByText('Фокус закончен — время отдохнуть').waitFor()
    await page.getByRole('button', { name: 'Начать перерыв' }).waitFor()
    const row = page.locator('[data-entry-id]').first()
    await row.waitFor()
    const text = await row.innerText()
    assert(/25 мин/.test(text) && /таймер/.test(text) && /Английский/.test(text), 'запись: ' + text)

    // перезагрузка: запись и перерыв на месте
    await page.reload()
    await page.getByRole('button', { name: 'Начать перерыв' }).waitFor()
    await page.locator('[data-entry-id]').first().waitFor()
    assert((await page.locator('[data-entry-id]').count()) === 1, 'запись пережила перезагрузку')

    // ручной ввод
    await page.getByRole('button', { name: 'Добавить время' }).click()
    const dialog = page.getByRole('dialog', { name: 'Добавить время' })
    await dialog.getByLabel('Категория').selectOption({ label: 'Спорт' })
    await dialog.getByLabel('С', { exact: true }).fill('07:00')
    await dialog.getByLabel('До', { exact: true }).fill('08:00')
    await dialog.getByText('Будет записано 1 ч').waitFor()
    await dialog.getByRole('button', { name: 'Добавить' }).click()
    await page.locator('[data-entry-id]').filter({ hasText: 'вручную' }).waitFor()
    await page.screenshot({ path: ctx.out + '/timer.png' })
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Привычки: создать, отметить, серия, отметка с экрана «Сегодня»'(ctx) {
    const b = await ctx.browser('habits', { viewport: { width: 375, height: 740 } })
    const page = await b.newPage()
    await page.goto(ctx.url + '#/habits')
    await page.getByText('Привычек пока нет').waitFor()
    await page.getByRole('button', { name: 'Добавить привычку' }).click()
    const dialog = page.getByRole('dialog', { name: 'Новая привычка' })
    await dialog.getByPlaceholder('Например, 20 новых слов').fill('Слова')
    await dialog.getByRole('button', { name: 'Создать' }).click()
    const row = page.locator('[data-habit="Слова"]')
    await row.waitFor()
    // отметить вчера и сегодня → серия 2 дня
    await row.getByRole('button', { name: 'Слова, Вчера' }).click()
    await row.getByRole('button', { name: 'Слова, Сегодня' }).click()
    await row.getByText('Серия: 2 дня').waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 0, `страница шире экрана на ${overflow}px`)
    await page.screenshot({ path: ctx.out + '/habits.png' })

    // на «Сегодня» привычка уже отмечена; снимаем отметку оттуда
    await page.goto(ctx.url + '#/today')
    const cell = page.getByRole('button', { name: 'Слова, Сегодня: отмечено' })
    await cell.waitFor()
    await cell.click()
    await page.getByRole('button', { name: 'Слова, Сегодня', exact: true }).waitFor()
    await page.goto(ctx.url + '#/habits')
    await page.locator('[data-habit="Слова"]').getByText('Серия: 1 день').waitFor()

    // статистика в окне привычки
    await page
      .locator('[data-habit="Слова"]')
      .getByRole('button', { name: /Слова Серия/ })
      .click()
    await page.getByRole('dialog', { name: 'Привычка' }).getByText('Лучшая').waitFor()
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Матрица: задачи по квадрантам, перетаскивание меняет приоритет и срок'(ctx) {
    const b = await ctx.browser('matrix')
    const page = await b.newPage()
    await page.goto(ctx.url + '#/matrix')
    const q = (n) => page.locator(`[data-quadrant="${n}"]`)
    await q(1).waitFor()
    // задача, добавленная в квадрант, туда и попадает
    await q(4).getByLabel('Новая задача').fill('прочитать книгу')
    await q(4).getByLabel('Новая задача').press('Enter')
    await q(4).getByText('прочитать книгу').waitFor()
    await q(1).getByLabel('Новая задача').fill('эссе')
    await q(1).getByLabel('Новая задача').press('Enter')
    await q(1).getByText('эссе').waitFor()
    // из «потом» в «срочно и важно»
    await q(4).locator('[draggable]').filter({ hasText: 'прочитать книгу' }).dragTo(q(1))
    await q(1).getByText('прочитать книгу').waitFor()
    await page.getByText(/приоритет: высокий, срок: сегодня/).waitFor()
    assert((await q(4).getByText('прочитать книгу').count()) === 0, 'ушла из четвёртого квадранта')
    // «Вернуть»
    await page.getByRole('button', { name: 'Вернуть' }).click()
    await q(4).getByText('прочитать книгу').waitFor()
    await page.screenshot({ path: ctx.out + '/matrix.png' })
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Горячие клавиши (в т. ч. на русской раскладке) и тёмная тема'(ctx) {
    const b = await ctx.browser('keys')
    const page = await b.newPage()
    await page.goto(ctx.url + '#/inbox')
    await page.getByRole('heading', { name: 'Входящие' }).waitFor()

    // N — новая задача
    await page.keyboard.press('n')
    const dialog = page.getByRole('dialog', { name: 'Новая задача' })
    await dialog.getByLabel('Новая задача').fill('задача с клавиатуры !1')
    await dialog.getByLabel('Новая задача').press('Enter')
    await dialog.waitFor({ state: 'detached' })
    await page.locator('[data-task-id]').filter({ hasText: 'задача с клавиатуры' }).waitFor()

    // та же клавиша на русской раскладке: key «т», code KeyN
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'т', code: 'KeyN', bubbles: true })))
    await dialog.waitFor()
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })

    // / — поиск; в поле поиска буквы печатаются, а не переключают разделы
    await page.keyboard.press('/')
    await page.getByRole('heading', { name: 'Поиск' }).waitFor()
    await page.keyboard.type('w')
    assert((await page.getByLabel('Поиск задач').inputValue()) === 'w', 'буква попала в поле поиска')
    await page.getByLabel('Поиск задач').blur()
    await page.keyboard.press('w')
    await page.getByRole('heading', { name: 'Неделя' }).waitFor()
    await page.keyboard.press('t')
    await page.getByRole('heading', { name: 'Сегодня' }).waitFor()

    // ? — справка
    await page.keyboard.press('Shift+Slash')
    await page.getByRole('dialog', { name: 'Горячие клавиши' }).waitFor()
    await page.keyboard.press('Escape')

    // тёмная тема переживает перезагрузку без мигания (класс ставится до загрузки приложения)
    await page.goto(ctx.url + '#/settings')
    await page.getByRole('radio', { name: 'Тёмная' }).click()
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    assert(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'тёмная тема сразу после перезагрузки')
    await page.goto(ctx.url + '#/inbox')
    await page.locator('[data-task-id]').first().waitFor()
    await page.screenshot({ path: ctx.out + '/dark-inbox.png' })
    await page.goto(ctx.url + '#/week')
    await page.getByRole('heading', { name: 'Неделя' }).waitFor()
    await page.screenshot({ path: ctx.out + '/dark-week.png' })
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Резервная копия: сохранить, восстановить на чистом устройстве и в однофайловой версии — без потерь'(ctx) {
    // устройство А: наполняем данными через интерфейс
    const a = await ctx.browser('backup-a')
    const page = await a.newPage()
    await page.goto(ctx.url + '#/inbox')
    await page.getByRole('button', { name: 'Новый список' }).click()
    await page.getByPlaceholder('Например, Школа').fill('Школа')
    await page.getByRole('button', { name: 'Создать' }).click()
    await page.getByRole('heading', { name: 'Школа' }).waitFor()
    const input = page.getByLabel('Новая задача')
    for (const t of ['эссе «Почему я» завтра в 18:00 1ч30м !1 #учёба', 'слова каждый день #англ', 'монтаж серии в пятницу 2ч #канал']) {
      await input.fill(t)
      await input.press('Enter')
    }
    await page.locator('[data-task-id]').filter({ hasText: 'монтаж серии' }).waitFor()
    await page.locator('[data-task-id]').filter({ hasText: 'эссе' }).click()
    const editor = page.getByRole('dialog', { name: 'Задача' })
    await editor.getByLabel('Новая подзадача').fill('черновик')
    await editor.getByLabel('Новая подзадача').press('Enter')
    await editor.getByLabel('Заметка').fill('строка 1\nстрока 2 «кавычки» 🙂')
    await page.keyboard.press('Escape')
    await page.locator('[data-task-id]').filter({ hasText: 'слова' }).getByRole('checkbox').click()
    await page.goto(ctx.url + '#/habits')
    await page.getByRole('button', { name: 'Добавить привычку' }).click()
    await page.getByPlaceholder('Например, 20 новых слов').fill('Зарядка')
    await page.getByRole('button', { name: 'Создать' }).click()
    await page.getByRole('button', { name: 'Зарядка, Сегодня', exact: true }).click()
    await page.goto(ctx.url + '#/timer')
    await page.getByRole('button', { name: 'Добавить время' }).click()
    await page.getByRole('dialog', { name: 'Добавить время' }).getByLabel('Категория').selectOption({ label: 'Игры' })
    await page.getByRole('dialog', { name: 'Добавить время' }).getByRole('button', { name: 'Добавить' }).click()
    await page.locator('[data-entry-id]').first().waitFor()
    await page.goto(ctx.url + '#/week')
    await page.evaluate(() => (document.querySelector('[data-week-grid]').scrollTop = (9 * 60 - 360) * 0.8))
    const col = await page.locator('[data-date]').nth(2).boundingBox()
    await page.mouse.click(col.x + col.width / 2, col.y + (10 * 60 + 5 - 360) * 0.8)
    await page.getByRole('dialog', { name: 'Блок времени' }).getByRole('button', { name: 'Готово' }).click()
    await page.goto(ctx.url + '#/settings')
    await page.getByRole('radio', { name: 'Тёмная' }).click()
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))

    const before = await dbDump(page)
    assert(
      before.tasks.length === 4 && before.habits.length === 1 && before.blocks.length === 1 && before.entries.length === 1,
      'данные созданы: ' + JSON.stringify(Object.fromEntries(Object.entries(before).map(([k, v]) => [k, v.length]))),
    )

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Сохранить копию' }).click()])
    assert(/^ritm-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), 'имя файла: ' + download.suggestedFilename())
    const file = ctx.out + '/backup.json'
    await download.saveAs(file)
    await page.getByText(/Последняя копия: сегодня/).waitFor()
    await a.close()

    // устройство Б: чистое, восстанавливаем
    for (const [name, url] of [
      ['backup-b', ctx.url + '#/settings'],
      ['backup-single', ctx.singleUrl + '#/settings'],
    ]) {
      const b = await ctx.browser(name)
      const p = await b.newPage()
      await p.goto(url)
      await p.getByRole('heading', { name: 'Настройки' }).waitFor()
      const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Восстановить из файла' }).click()])
      await chooser.setFiles(file)
      const confirm = p.getByRole('dialog', { name: 'Восстановить из копии?' })
      await confirm.getByText('3 задачи в работе').waitFor()
      await confirm.getByText('1 привычка').waitFor()
      await confirm.getByRole('button', { name: 'Восстановить' }).click()
      await p.getByText('Данные восстановлены').waitFor()
      await p.waitForFunction(() => document.documentElement.classList.contains('dark'))
      const after = await dbDump(p)
      for (const table of Object.keys(before)) {
        assert(JSON.stringify(after[table]) === JSON.stringify(before[table]), `${name}: таблица ${table} отличается`)
      }
      // и видно в интерфейсе
      await p.goto(url.replace('#/settings', '#/search?q=эссе'))
      await p.locator('[data-task-id]').filter({ hasText: 'эссе' }).waitFor()
      assert(!b.errors.length, name + ': ошибки в консоли: ' + b.errors.join('; '))
      await b.close()
    }
  },

  async 'Резервная копия: тихое напоминание через неделю и «Позже»'(ctx) {
    const b = await ctx.browser('backup-remind')
    const page = await b.newPage()
    await page.goto(ctx.url + '#/today')
    await page.getByLabel('Новая задача').fill('что-то важное')
    await page.getByLabel('Новая задача').press('Enter')
    await page.locator('[data-task-id]').first().waitFor()
    assert(!(await page.getByText('Резервной копии не было больше недели.').isVisible()), 'в первую неделю не напоминаем')
    // «установили» приложение 8 дней назад
    await page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('ritm')
          r.onsuccess = () => {
            const tx = r.result.transaction('settings', 'readwrite')
            tx.objectStore('settings').put({ key: 'installedAt', value: Date.now() - 8 * 86400000 })
            tx.oncomplete = res
          }
        }),
    )
    await page.reload()
    const bar = page.getByText('Резервной копии не было больше недели.')
    await bar.waitFor()
    await page.screenshot({ path: ctx.out + '/backup-reminder.png' })
    await page.getByRole('button', { name: 'Позже' }).click()
    await bar.waitFor({ state: 'detached' })
    // дождаться, пока «Позже» запишется в базу
    await page.waitForFunction(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('ritm')
          r.onsuccess = () => {
            const q = r.result.transaction('settings').objectStore('settings').get('backupSnoozedUntil')
            q.onsuccess = () => res((q.result?.value ?? 0) > Date.now())
          }
        }),
    )
    await page.reload()
    await page.locator('[data-task-id]').first().waitFor()
    await page.waitForTimeout(300)
    assert(!(await bar.isVisible()), '«Позже» скрывает напоминание на несколько дней')
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Готово: Chrome считает приложение устанавливаемым (встроенная проверка браузера)'(ctx) {
    const b = await ctx.browser('install')
    const page = await b.newPage()
    await page.goto(ctx.url)
    await page.getByRole('heading', { name: 'Сегодня' }).waitFor()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // после установки service worker страница под его управлением
    await page.getByRole('heading', { name: 'Сегодня' }).waitFor()
    const cdp = await b.newCDPSession(page)
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    assert(installabilityErrors.length === 0, 'Chrome: ' + JSON.stringify(installabilityErrors))
    const { url, errors } = await cdp.send('Page.getAppManifest')
    assert(url && !errors.length, 'манифест без ошибок: ' + JSON.stringify(errors))
    assert(await page.evaluate(() => !!navigator.serviceWorker.controller), 'страницей управляет service worker')
    await b.close()
  },

  async 'Готово: все экраны на ширине 375 px без горизонтальной прокрутки'(ctx) {
    const b = await ctx.browser('w375', { viewport: { width: 375, height: 740 }, launch: { hasTouch: true, isMobile: true } })
    const page = await b.newPage()
    await page.goto(ctx.url + '#/inbox')
    // немного данных, чтобы экраны были не пустыми
    const input = page.getByLabel('Новая задача')
    for (const t of ['очень длинное название задачи, которое не должно растягивать страницу шире экрана телефона завтра 1ч #учёба', 'слова каждый день']) {
      await input.fill(t)
      await input.press('Enter')
    }
    await page.locator('[data-task-id]').nth(1).waitFor()
    const routes = ['today', 'next7', 'inbox', 'done', 'search?q=слова', 'week', 'timer', 'habits', 'matrix', 'settings']
    for (const r of routes) {
      await page.goto(ctx.url + '#/' + r)
      await page.locator('h1').first().waitFor()
      await page.waitForTimeout(150)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      assert(overflow <= 0, `${r}: шире экрана на ${overflow}px`)
      await page.screenshot({ path: `${ctx.out}/375-${r.split('?')[0]}.png` })
    }
    // задача открывается на весь экран и закрывается
    await page.goto(ctx.url + '#/inbox')
    await page.locator('[data-task-id]').first().click()
    const editor = page.getByRole('dialog', { name: 'Задача' })
    await editor.waitFor()
    const box = await editor.boundingBox()
    assert(box.width <= 375, 'редактор помещается в ширину')
    await page.screenshot({ path: `${ctx.out}/375-editor.png` })
    assert(!b.errors.length, 'ошибки в консоли: ' + b.errors.join('; '))
    await b.close()
  },

  async 'Готово: данные переживают полный перезапуск браузера (PWA и файл)'(ctx) {
    for (const [name, url] of [
      ['restart-pwa', ctx.url + '#/inbox'],
      ['restart-file', ctx.singleUrl + '#/inbox'],
    ]) {
      let b = await ctx.browser(name)
      let page = await b.newPage()
      await page.goto(url)
      await page.getByLabel('Новая задача').fill('переживу перезапуск')
      await page.getByLabel('Новая задача').press('Enter')
      await page.locator('[data-task-id]').filter({ hasText: 'переживу перезапуск' }).waitFor()
      await b.close()
      b = await ctx.browser(name) // тот же профиль — как повторный запуск браузера
      page = await b.newPage()
      await page.goto(url)
      await page.locator('[data-task-id]').filter({ hasText: 'переживу перезапуск' }).waitFor()
      await b.close()
    }
  },
}
