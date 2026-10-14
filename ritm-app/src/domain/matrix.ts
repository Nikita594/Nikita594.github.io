import type { DateStr, Priority, Task } from '../db/types'
import { addDays } from './dates'

// Матрица Эйзенхауэра. Важно — высокий или средний приоритет.
// Срочно — срок до конца завтрашнего дня (или уже прошёл).

export type Quadrant = 1 | 2 | 3 | 4

export const QUADRANTS: { q: Quadrant; title: string; hint: string; important: boolean; urgent: boolean }[] = [
  { q: 1, title: 'Срочно и важно', hint: 'Сделать сейчас', important: true, urgent: true },
  { q: 2, title: 'Важно, не срочно', hint: 'Запланировать время', important: true, urgent: false },
  { q: 3, title: 'Срочно, не важно', hint: 'Сделать быстро', important: false, urgent: true },
  { q: 4, title: 'Не срочно и не важно', hint: 'Если останется время', important: false, urgent: false },
]

export const isImportant = (t: Pick<Task, 'priority'>) => t.priority >= 2
export const isUrgent = (t: Pick<Task, 'dueDate'>, today: DateStr) => !!t.dueDate && t.dueDate <= addDays(today, 1)

export function quadrantOf(t: Pick<Task, 'priority' | 'dueDate'>, today: DateStr): Quadrant {
  const imp = isImportant(t)
  const urg = isUrgent(t, today)
  return imp ? (urg ? 1 : 2) : urg ? 3 : 4
}

/**
 * Что поменять в задаче, чтобы она попала в квадрант q. Меняем только то, что нужно:
 * важность — приоритет (в важные — высокий, если был ниже среднего; в неважные — низкий);
 * срочность — срок (в срочные — сегодня; в несрочные — послезавтра, ближайший несрочный день).
 */
export function moveToQuadrant(
  t: Pick<Task, 'priority' | 'dueDate'>,
  q: Quadrant,
  today: DateStr,
): Partial<Pick<Task, 'priority' | 'dueDate'>> {
  const target = QUADRANTS[q - 1]
  const changes: Partial<Pick<Task, 'priority' | 'dueDate'>> = {}
  if (target.important !== isImportant(t)) changes.priority = (target.important ? 3 : 1) as Priority
  if (target.urgent !== isUrgent(t, today)) changes.dueDate = target.urgent ? today : addDays(today, 2)
  return changes
}
