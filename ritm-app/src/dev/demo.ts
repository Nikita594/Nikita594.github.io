// Демо-данные для разработки и скриншотов дизайнов. Подключается только в режиме разработки (см. main.tsx):
// в консоли — await __ritm.fillDemo(), страница перезагрузится с заполненной неделей.
import { createBlock } from '../db/blocks'
import { db } from '../db/db'
import { addEntry } from '../db/entries'
import { checkId, createHabit } from '../db/habits'
import { createList, createTask } from '../db/tasks'
import { addDays, todayStr, weekDays, weekStart } from '../domain/dates'

export async function fillDemo() {
  const today = todayStr()
  await Promise.all([db.tasks.clear(), db.blocks.clear(), db.habits.clear(), db.habitChecks.clear(), db.entries.clear()])
  await db.lists.where('id').notEqual('inbox').delete()

  const school = await createList('Школа', '#6366f1')
  const channel = await createList('Канал', '#ec4899')

  await createTask({
    title: 'Алгебра: №214–220',
    listId: school.id,
    dueDate: today,
    dueTime: 16 * 60,
    durationMin: 60,
    priority: 3,
    categoryId: 'study',
  })
  await createTask({ title: 'SAT Reading — 2 секции', dueDate: today, dueTime: 18 * 60, durationMin: 50, priority: 2, categoryId: 'sat' })
  await createTask({
    title: 'Смонтировать ролик про сетап',
    listId: channel.id,
    dueDate: today,
    priority: 1,
    categoryId: 'channel',
    subtasks: [
      { id: 's1', title: 'Нарезка', done: true },
      { id: 's2', title: 'Звук', done: false },
      { id: 's3', title: 'Обложка', done: false },
    ],
  })
  await createTask({ title: 'Английский: 20 слов', dueDate: today, priority: 0, categoryId: 'english' })
  await createTask({ title: 'Позвонить бабушке', dueDate: addDays(today, -1), priority: 0 })
  await createTask({ title: 'Тренировка', dueDate: today, status: 'done', completedAt: Date.now() - 3600_000, categoryId: 'sport' })
  await createTask({
    title: 'Физика: лабораторная',
    listId: school.id,
    dueDate: addDays(today, 1),
    dueTime: 15 * 60,
    priority: 2,
    categoryId: 'study',
  })
  await createTask({
    title: 'Сценарий следующего видео',
    listId: channel.id,
    dueDate: addDays(today, 2),
    priority: 1,
    categoryId: 'channel',
  })
  await createTask({ title: 'Купить наушники', priority: 0 })
  await createTask({ title: 'Пробный SAT', dueDate: addDays(today, 4), dueTime: 10 * 60, durationMin: 180, priority: 3, categoryId: 'sat' })

  const days = weekDays(weekStart(today))
  const plan: [number, number, number, string][] = [
    [0, 15 * 60, 16 * 60 + 30, 'study'],
    [0, 18 * 60, 19 * 60, 'sport'],
    [1, 16 * 60, 17 * 60, 'english'],
    [1, 19 * 60, 21 * 60, 'channel'],
    [2, 15 * 60, 17 * 60, 'study'],
    [3, 17 * 60, 18 * 60 + 30, 'sat'],
    [3, 20 * 60, 21 * 60, 'games'],
    [4, 16 * 60, 18 * 60, 'work'],
    [5, 11 * 60, 13 * 60, 'channel'],
    [6, 12 * 60, 14 * 60, 'rest'],
  ]
  for (const [d, startMin, endMin, categoryId] of plan) await createBlock({ date: days[d], startMin, endMin, categoryId })
  await createBlock({ date: today, startMin: 16 * 60, endMin: 17 * 60, categoryId: 'study', title: 'Алгебра' })
  await createBlock({ date: today, startMin: 18 * 60, endMin: 18 * 60 + 50, categoryId: 'sat', title: 'SAT Reading' })

  const habits = [
    await createHabit('Спорт', '#22c55e', [1, 3, 5]),
    await createHabit('Чтение 20 минут', '#f59e0b', []),
    await createHabit('Без телефона до 9', '#0ea5e9', []),
  ]
  const old = Date.now() - 30 * 86400_000
  for (const h of habits) await db.habits.update(h.id, { createdAt: old })
  for (let i = 1; i < 21; i++) {
    const date = addDays(today, -i)
    for (const [n, h] of habits.entries()) {
      if ((i + n) % 5 === 0) continue
      await db.habitChecks.put({ id: checkId(h.id, date), habitId: h.id, date })
    }
  }
  await db.habitChecks.put({ id: checkId(habits[1].id, today), habitId: habits[1].id, date: today })

  const start = Date.now() - 2 * 3600_000
  await addEntry({ categoryId: 'study', start, end: start + 50 * 60_000, source: 'timer' })
  location.reload()
}

export { setSetting } from '../db/settings'
