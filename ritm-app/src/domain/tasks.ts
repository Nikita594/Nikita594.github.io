import type { Task } from '../db/types'

/** Порядок открытых задач: сначала со сроком (раньше — выше), потом по приоритету, потом по времени создания. */
export function compareOpenTasks(a: Task, b: Task): number {
  const ad = a.dueDate ?? '9999-99-99'
  const bd = b.dueDate ?? '9999-99-99'
  if (ad !== bd) return ad < bd ? -1 : 1
  const at = a.dueTime ?? 24 * 60
  const bt = b.dueTime ?? 24 * 60
  if (at !== bt) return at - bt
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.order - b.order
}

/** Выполненные: свежие сверху. */
export function compareDoneTasks(a: Task, b: Task): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0)
}

/** Приводим к нижнему регистру и считаем «е» и «ё» одной буквой. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').trim()
}

/** Ищет по названию, заметке и подзадачам. Все слова запроса должны найтись. */
export function matchesSearch(task: Task, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return false
  const hay = normalize([task.title, task.note, ...task.subtasks.map((s) => s.title)].join(' '))
  return words.every((w) => hay.includes(w))
}

export const PRIORITY_LABELS = ['Без приоритета', 'Низкий', 'Средний', 'Высокий'] as const
