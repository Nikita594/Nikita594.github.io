import Dexie, { type EntityTable } from 'dexie'
import type { Category, Goal, Habit, HabitCheck, List, MoneyEntry, Savings, Setting, Task, TimeBlock, TimeEntry, WeekReview } from './types'
import { seed } from './seed'

export const DB_NAME = 'ritm'

/**
 * Версии схемы. Правило: старые версии не меняем, добавляем новую
 * `this.version(n).stores({...}).upgrade(tx => ...)`, а для старых резервных копий —
 * шаг в EXPORT_MIGRATIONS (src/db/backup.ts).
 */
export const SCHEMA_VERSION = 1

export class RitmDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  lists!: EntityTable<List, 'id'>
  categories!: EntityTable<Category, 'id'>
  blocks!: EntityTable<TimeBlock, 'id'>
  entries!: EntityTable<TimeEntry, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitChecks!: EntityTable<HabitCheck, 'id'>
  goals!: EntityTable<Goal, 'id'>
  savings!: EntityTable<Savings, 'id'>
  money!: EntityTable<MoneyEntry, 'id'>
  reviews!: EntityTable<WeekReview, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = DB_NAME) {
    super(name)
    // Здесь перечислены только поля, по которым ищем. Остальные поля хранятся и так.
    this.version(1).stores({
      tasks: 'id, listId, status, dueDate, categoryId, goalId, completedAt, pinnedWeek, repeatOf',
      lists: 'id, order',
      categories: 'id, order',
      blocks: 'id, date, taskId',
      entries: 'id, start, categoryId, taskId',
      habits: 'id, order',
      habitChecks: 'id, habitId, date',
      goals: 'id, parentId, level',
      savings: 'id',
      money: 'id, date, savingsId',
      reviews: 'id',
      settings: 'key',
    })
    this.on('populate', (tx) => seed(tx))
  }
}

export const TABLES = [
  'tasks',
  'lists',
  'categories',
  'blocks',
  'entries',
  'habits',
  'habitChecks',
  'goals',
  'savings',
  'money',
  'reviews',
  'settings',
] as const
export type TableName = (typeof TABLES)[number]

export const db = new RitmDB()
