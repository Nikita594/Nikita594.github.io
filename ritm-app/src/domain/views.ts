import type { DateStr, Task } from '../db/types'
import { addDays, toDateStr } from './dates'
import { occursOn } from './repeat'
import { compareDoneTasks, compareOpenTasks } from './tasks'

export interface DayGroup {
  date: DateStr
  tasks: Task[]
  /** Будущие повторы, которых ещё нет как отдельных задач (только для показа). */
  upcoming: Task[]
}

export const overdue = (tasks: Task[], today: DateStr) =>
  tasks.filter((t) => t.status === 'open' && t.dueDate && t.dueDate < today).sort(compareOpenTasks)

export const dueOn = (tasks: Task[], date: DateStr) => tasks.filter((t) => t.status === 'open' && t.dueDate === date).sort(compareOpenTasks)

/** Местная дата момента выполнения. */
export const doneDay = (t: Task) => (t.completedAt ? toDateStr(new Date(t.completedAt)) : '')

export const doneOn = (tasks: Task[], date: DateStr) =>
  tasks.filter((t) => t.status === 'done' && doneDay(t) === date).sort(compareDoneTasks)

/** Семь дней начиная с today: задачи по срокам и будущие повторы. */
export function nextDays(tasks: Task[], today: DateStr, count = 7): DayGroup[] {
  const open = tasks.filter((t) => t.status === 'open')
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i)
    const upcoming = open
      .filter((t) => t.repeat && t.dueDate && t.dueDate < date && occursOn(t.repeat, t.dueDate, date))
      .sort(compareOpenTasks)
    return { date, tasks: dueOn(open, date), upcoming }
  })
}

/** Выполненные задачи по дням, свежие сверху. */
export function groupDone(tasks: Task[]): { date: DateStr; tasks: Task[] }[] {
  const map = new Map<DateStr, Task[]>()
  for (const t of tasks.filter((x) => x.status === 'done').sort(compareDoneTasks)) {
    const d = doneDay(t)
    map.set(d, [...(map.get(d) ?? []), t])
  }
  return [...map.entries()].map(([date, list]) => ({ date, tasks: list }))
}
