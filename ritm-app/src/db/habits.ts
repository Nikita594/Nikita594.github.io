import { uid } from '../lib/id'
import { db } from './db'
import type { DateStr, Habit, ID, Weekday } from './types'

export const checkId = (habitId: ID, date: DateStr) => `${habitId}_${date}`

export async function createHabit(name: string, color: string, days: Weekday[]): Promise<Habit> {
  const last = await db.habits.orderBy('order').last()
  const habit: Habit = { id: uid(), name: name.trim(), color, days, archived: false, order: (last?.order ?? 0) + 1, createdAt: Date.now() }
  await db.habits.add(habit)
  return habit
}

export async function updateHabit(id: ID, changes: Partial<Habit>) {
  await db.habits.update(id, changes)
}

/** Отметить / снять отметку за день. Возвращает новое состояние. */
export async function toggleCheck(habitId: ID, date: DateStr): Promise<boolean> {
  return db.transaction('rw', db.habitChecks, async () => {
    const id = checkId(habitId, date)
    if (await db.habitChecks.get(id)) {
      await db.habitChecks.delete(id)
      return false
    }
    await db.habitChecks.add({ id, habitId, date })
    return true
  })
}

/** Удалить привычку вместе с отметками. Возвращает «вернуть». */
export async function deleteHabit(id: ID): Promise<() => Promise<void>> {
  return db.transaction('rw', db.habits, db.habitChecks, async () => {
    const habit = await db.habits.get(id)
    const checks = await db.habitChecks.where('habitId').equals(id).toArray()
    await db.habitChecks.bulkDelete(checks.map((c) => c.id))
    await db.habits.delete(id)
    return async () => {
      await db.transaction('rw', db.habits, db.habitChecks, async () => {
        if (habit) await db.habits.put(habit)
        await db.habitChecks.bulkPut(checks)
      })
    }
  })
}
