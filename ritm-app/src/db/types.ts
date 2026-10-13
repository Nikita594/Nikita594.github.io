// Типы всех записей в базе. Описание полей — в ../../PLAN.md, раздел «Схема данных».

export type ID = string
/** Дата по местному времени в формате ГГГГ-ММ-ДД. */
export type DateStr = string
/** Минуты от начала суток: 18:00 → 1080. */
export type Minutes = number
/** Момент времени в миллисекундах (Date.now()). */
export type Moment = number

/** 0 — нет, 1 — низкий, 2 — средний, 3 — высокий. */
export type Priority = 0 | 1 | 2 | 3

/** День недели: 1 — понедельник … 7 — воскресенье. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Repeat =
  | { kind: 'daily'; until?: DateStr }
  | { kind: 'weekdays'; until?: DateStr }
  | { kind: 'weekly'; days: Weekday[]; until?: DateStr }
  | { kind: 'interval'; every: number; until?: DateStr }
  | { kind: 'monthly'; day: number; until?: DateStr }

export interface Subtask {
  id: ID
  title: string
  done: boolean
}

export interface Task {
  id: ID
  title: string
  note: string
  listId: ID
  priority: Priority
  dueDate?: DateStr
  dueTime?: Minutes
  durationMin?: number
  subtasks: Subtask[]
  repeat?: Repeat
  categoryId?: ID
  goalId?: ID
  pinnedWeek?: DateStr
  status: 'open' | 'done'
  completedAt?: Moment
  /** У записи о выполненном повторе — id исходной повторяющейся задачи. */
  repeatOf?: ID
  order: number
  createdAt: Moment
  updatedAt: Moment
}

export interface List {
  id: ID
  name: string
  color: string
  order: number
  createdAt: Moment
}

export interface Category {
  id: ID
  name: string
  color: string
  builtin: boolean
  /** Недельный лимит (используется для «игр» в версии 2). */
  weeklyLimitMin?: number
  archived: boolean
  order: number
}

export interface TimeBlock {
  id: ID
  date: DateStr
  startMin: Minutes
  endMin: Minutes
  categoryId?: ID
  taskId?: ID
  title?: string
}

export interface TimeEntry {
  id: ID
  categoryId?: ID
  taskId?: ID
  start: Moment
  end: Moment
  source: 'timer' | 'manual'
  /** Незапланированная сессия (версия 2). */
  unplanned?: boolean
  /** «Что было перед этим» (версия 2). */
  before?: string
  note?: string
}

export interface Habit {
  id: ID
  name: string
  color: string
  /** В какие дни недели привычка нужна. Все семь — каждый день. */
  days: Weekday[]
  archived: boolean
  order: number
  createdAt: Moment
}

export interface HabitCheck {
  /** `${habitId}_${date}` — одна отметка на привычку в день. */
  id: string
  habitId: ID
  date: DateStr
}

export interface Goal {
  id: ID
  title: string
  level: 'main' | 'season' | 'week'
  parentId?: ID
  from?: DateStr
  to?: DateStr
  status: 'active' | 'done' | 'dropped'
  note: string
  order: number
  createdAt: Moment
}

export type Currency = 'RUB' | 'USD'

export interface Savings {
  id: ID
  title: string
  /** Цель в копейках/центах валюты currency. */
  target: number
  currency: Currency
  createdAt: Moment
}

export interface MoneyEntry {
  id: ID
  date: DateStr
  kind: 'income' | 'expense' | 'save'
  /** Сумма в копейках/центах валюты currency. */
  amount: number
  currency: Currency
  note: string
  savingsId?: ID
  createdAt: Moment
}

export interface WeekReview {
  /** Понедельник недели. */
  id: DateStr
  answers: { good: string; hindered: string; focus: string }
  snapshot: unknown
  focusTaskId?: ID
  createdAt: Moment
}

export interface Setting {
  key: string
  value: unknown
}
