import type { DateStr, Habit } from '../db/types'
import { addDays, diffDays, toDateStr, weekdayOf } from './dates'

// Серии привычек. Считаем только дни, в которые привычка нужна по расписанию:
// выходной по расписанию серию не рвёт, отметка в такой день серию не удлиняет.
// Сегодняшний день, пока не отмечен, тоже не рвёт серию — день ещё не кончился.

export type HabitLike = Pick<Habit, 'days' | 'createdAt'>

export const habitStart = (h: HabitLike): DateStr => toDateStr(new Date(h.createdAt))

/** С какого дня считать: дата создания или самая ранняя отметка (отметки можно ставить задним числом). */
function countFrom(h: HabitLike, checks: Set<DateStr>): DateStr {
  return [...checks].reduce((min, c) => (c < min ? c : min), habitStart(h))
}

export function isScheduled(h: HabitLike, date: DateStr): boolean {
  return h.days.length === 0 || h.days.includes(weekdayOf(date))
}

export function currentStreak(h: HabitLike, checks: Set<DateStr>, today: DateStr): number {
  const start = countFrom(h, checks)
  let d = today
  if (!checks.has(today)) d = addDays(today, -1) // сегодня ещё можно успеть
  let streak = 0
  while (d >= start) {
    if (isScheduled(h, d)) {
      if (!checks.has(d)) break
      streak++
    }
    d = addDays(d, -1)
  }
  return streak
}

export function bestStreak(h: HabitLike, checks: Set<DateStr>, today: DateStr): number {
  const earliest = countFrom(h, checks)
  let best = 0
  let run = 0
  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(h, d)) continue
    if (checks.has(d)) best = Math.max(best, ++run)
    else if (d !== today) run = 0
  }
  return best
}

/** Доля выполненных дней по расписанию за последние n дней (сегодня не считаем, если не отмечен). */
export function completionRate(h: HabitLike, checks: Set<DateStr>, today: DateStr, n = 30): { done: number; planned: number } {
  const from = [countFrom(h, checks), addDays(today, -(n - 1))].sort()[1]
  let done = 0
  let planned = 0
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(h, d)) continue
    if (checks.has(d)) {
      done++
      planned++
    } else if (d !== today) planned++
  }
  return { done, planned }
}

/** Сетка для календаря привычки: недели (пн–вс) от недели с from до недели с today. */
export function weeksGrid(from: DateStr, today: DateStr): DateStr[][] {
  const mondayOf = (d: DateStr) => addDays(d, -(weekdayOf(d) - 1))
  const first = mondayOf(from)
  const weeks = Math.floor(diffDays(mondayOf(today), first) / 7) + 1
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i)))
}
