import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { backupFileName, BackupError, exportData, importData, parseBackup, shouldRemindBackup, summarize } from './backup'
import { placeTask } from './blocks'
import { createCategory } from './categories'
import { db, SCHEMA_VERSION, TABLES } from './db'
import { addEntry } from './entries'
import { createHabit, toggleCheck } from './habits'
import { setSetting } from './settings'
import { completeTask, createList, createTask } from './tasks'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

/** Заполняем все таблицы, включая таблицы версии 2. */
async function fill() {
  const school = await createList('Школа', '#2563eb')
  const cat = await createCategory('Чтение', '#16a34a')
  const t = await createTask({
    title: 'Эссе «Почему я»',
    note: 'многострочная\nзаметка с эмодзи 🙂 и кавычками "так"',
    listId: school.id,
    priority: 3,
    dueDate: '2026-10-15',
    dueTime: 1080,
    durationMin: 90,
    categoryId: 'study',
    subtasks: [{ id: 's1', title: 'черновик', done: true }],
  })
  const r = await createTask({ title: 'Слова', dueDate: '2026-10-13', repeat: { kind: 'weekly', days: [1, 3, 5], until: '2027-06-01' } })
  await completeTask(r.id, new Date(2026, 9, 13, 20))
  await placeTask(t, '2026-10-14', 16 * 60)
  await addEntry({ start: 1_791_900_000_000, end: 1_791_901_500_000, categoryId: cat.id, taskId: t.id, source: 'timer' })
  await addEntry({ start: 1_791_800_000_000, end: 1_791_803_600_000, categoryId: 'games', source: 'manual', unplanned: true, before: 'устал после школы' })
  const h = await createHabit('Зарядка', '#0891b2', [1, 2, 3, 4, 5])
  await toggleCheck(h.id, '2026-10-12')
  await toggleCheck(h.id, '2026-10-13')
  await db.goals.bulkAdd([
    { id: 'g1', title: 'Поступить в университет в США', level: 'main', status: 'active', note: '', order: 0, createdAt: 1 },
    { id: 'g2', title: 'Английский A1 → B1 к августу', level: 'season', parentId: 'g1', from: '2026-09-01', to: '2027-08-31', status: 'active', note: '', order: 1, createdAt: 2 },
  ])
  await db.savings.add({ id: 'sv', title: 'Ноутбук для монтажа', target: 15_000_000, currency: 'RUB', createdAt: 3 })
  await db.money.add({ id: 'm1', date: '2026-10-10', kind: 'income', amount: 500_000, currency: 'RUB', note: 'подработка', savingsId: 'sv', createdAt: 4 })
  await db.reviews.add({ id: '2026-10-05', answers: { good: 'сделал эссе', hindered: 'игры', focus: 'SAT' }, snapshot: { hours: 12 }, createdAt: 5 })
  await setSetting('theme', 'dark')
  await setSetting('dailyLimitMin', 420)
  await setSetting('pomodoro', { phase: 'focus', status: 'running', runningSince: 1, elapsedBefore: 0, durationMs: 1, round: 0 })
}

async function snapshot() {
  const out: Record<string, unknown[]> = {}
  for (const t of TABLES) out[t] = await db.table(t).toArray()
  return out
}

describe('резервная копия', () => {
  it('сохранить → чистое устройство → восстановить: всё совпадает', async () => {
    await fill()
    const before = await snapshot()
    const file = JSON.stringify(await exportData(new Date(2026, 9, 14, 12)))

    // «чистое устройство»: база удалена и создана заново
    await db.delete()
    await db.open()
    await importData(parseBackup(file))
    const after = await snapshot()

    for (const t of TABLES) {
      if (t === 'settings') continue
      expect(after[t], t).toEqual(before[t])
    }
    // пользовательские настройки восстановлены, служебные — от этого устройства
    const settings = Object.fromEntries((after.settings as { key: string; value: unknown }[]).map((s) => [s.key, s.value]))
    expect(settings.theme).toBe('dark')
    expect(settings.dailyLimitMin).toBe(420)
    expect(settings.pomodoro).toBeUndefined() // запущенный таймер из копии не воскресает
    expect(settings.lastBackupAt).toBe(new Date(2026, 9, 14, 12).getTime())
    expect(settings.installedAt).toBeTypeOf('number')
  })

  it('сводка для окна подтверждения', async () => {
    await fill()
    const s = summarize(await exportData())
    expect(s).toMatchObject({ tasks: 2, done: 1, lists: 1, habits: 1, blocks: 1, entries: 2 })
  })

  it('восстановление заменяет, а не добавляет', async () => {
    await createTask({ title: 'Будет удалена' })
    const empty = await exportData()
    await createTask({ title: 'Тоже будет удалена' })
    await importData(parseBackup(JSON.stringify(empty)))
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Будет удалена'])
  })

  it('старая копия без новых таблиц читается', () => {
    const b = parseBackup(JSON.stringify({ app: 'ritm', schemaVersion: 1, exportedAt: '2026-10-01T00:00:00Z', tables: { tasks: [], lists: [] } }))
    expect(b.tables.goals).toEqual([])
  })

  it.each([
    ['не JSON', 'привет', 'не получилось прочитать JSON'],
    ['чужой файл', JSON.stringify({ hello: 1 }), 'Это не резервная копия'],
    ['новее приложения', JSON.stringify({ app: 'ritm', schemaVersion: SCHEMA_VERSION + 1, tables: {} }), 'более новой версии'],
    ['битая запись', JSON.stringify({ app: 'ritm', schemaVersion: 1, tables: { tasks: [{ title: 'без id' }] } }), 'Повреждена запись'],
  ])('понятная ошибка: %s', (_, text, message) => {
    expect(() => parseBackup(text)).toThrow(BackupError)
    expect(() => parseBackup(text)).toThrow(message)
  })

  it('имя файла', () => {
    expect(backupFileName(new Date(2026, 9, 4))).toBe('ritm-backup-2026-10-04.json')
  })
})

describe('напоминание о копии', () => {
  const day = 86_400_000
  const now = 100 * day
  const base = { lastBackupAt: 0, installedAt: now - 3 * day, backupSnoozedUntil: 0, hasData: true, now }
  it('неделю после установки — молчим', () => expect(shouldRemindBackup(base)).toBe(false))
  it('через 7 дней после установки без копии — напоминаем', () => expect(shouldRemindBackup({ ...base, installedAt: now - 7 * day })).toBe(true))
  it('копия была 2 дня назад — молчим', () => expect(shouldRemindBackup({ ...base, installedAt: now - 30 * day, lastBackupAt: now - 2 * day })).toBe(false))
  it('«Позже» — молчим до указанного времени', () =>
    expect(shouldRemindBackup({ ...base, installedAt: now - 30 * day, backupSnoozedUntil: now + day })).toBe(false))
  it('нечего сохранять — молчим', () => expect(shouldRemindBackup({ ...base, installedAt: now - 30 * day, hasData: false })).toBe(false))
})
