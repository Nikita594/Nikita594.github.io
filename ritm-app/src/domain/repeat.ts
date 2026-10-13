import type { DateStr, Repeat, Weekday } from '../db/types'
import { addDays, fromDateStr, toDateStr, WEEKDAY_SHORT, weekdayOf } from './dates'

/** Есть ли повтор в этот день (если серия начинается с anchor). */
export function occursOn(rule: Repeat, anchor: DateStr, date: DateStr): boolean {
  if (date < anchor) return false
  if (rule.until && date > rule.until) return false
  switch (rule.kind) {
    case 'daily':
      return true
    case 'weekdays':
      return weekdayOf(date) <= 5
    case 'weekly':
      return (rule.days.length ? rule.days : [weekdayOf(anchor)]).includes(weekdayOf(date))
    case 'interval': {
      const diff = Math.round((fromDateStr(date).getTime() - fromDateStr(anchor).getTime()) / 86400000)
      return diff % Math.max(1, rule.every) === 0
    }
    case 'monthly':
      return date === monthlyDate(date.slice(0, 7), rule.day)
  }
}

/** День месяца с поправкой на короткие месяцы: «31-е» в феврале — 28 (29). */
function monthlyDate(yearMonth: string, day: number): DateStr {
  const [y, m] = yearMonth.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${yearMonth}-${String(Math.min(day, last)).padStart(2, '0')}`
}

function nextMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  return toDateStr(new Date(y, m, 1)).slice(0, 7)
}

/** Ближайший повтор строго после from. null — серия закончилась (дата окончания). */
export function nextOccurrence(rule: Repeat, from: DateStr): DateStr | null {
  let next: DateStr
  switch (rule.kind) {
    case 'daily':
      next = addDays(from, 1)
      break
    case 'weekdays':
      next = addDays(from, 1)
      while (weekdayOf(next) > 5) next = addDays(next, 1)
      break
    case 'weekly': {
      const days = rule.days.length ? rule.days : [weekdayOf(from)]
      next = addDays(from, 1)
      while (!days.includes(weekdayOf(next))) next = addDays(next, 1)
      break
    }
    case 'interval':
      next = addDays(from, Math.max(1, rule.every))
      break
    case 'monthly': {
      const thisMonth = monthlyDate(from.slice(0, 7), rule.day)
      next = thisMonth > from ? thisMonth : monthlyDate(nextMonth(from.slice(0, 7)), rule.day)
      break
    }
  }
  return rule.until && next > rule.until ? null : next
}

/** Первый повтор начиная с from включительно — для задачи, у которой ещё нет срока. */
export function firstOccurrence(rule: Repeat, from: DateStr): DateStr | null {
  if (rule.kind === 'daily' || rule.kind === 'interval') return rule.until && from > rule.until ? null : from
  return nextOccurrence(rule, addDays(from, -1))
}

/**
 * Куда переехать задаче после выполнения.
 * Сделал раньше срока — следующий повтор после срока.
 * Сделал с опозданием — следующий повтор после сегодняшнего дня, без «долгов» за пропущенные.
 */
export function nextDueAfterDone(rule: Repeat, due: DateStr, today: DateStr): DateStr | null {
  let next = nextOccurrence(rule, due)
  while (next !== null && next <= today) next = nextOccurrence(rule, next)
  return next
}

const WEEKDAY_NAMES_ACC = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье']

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few
  return many
}

/** «Каждый день», «По будням», «Пн, ср, пт», «Каждые 3 дня», «Каждый месяц, 15-го». */
export function describeRepeat(rule: Repeat): string {
  let s: string
  switch (rule.kind) {
    case 'daily':
      s = 'Каждый день'
      break
    case 'weekdays':
      s = 'По будням'
      break
    case 'weekly': {
      const days = [...rule.days].sort()
      if (days.length === 1) s = `Каждую неделю, в ${WEEKDAY_NAMES_ACC[days[0] - 1]}`.replace('в вторник', 'во вторник')
      else if (days.length === 7) s = 'Каждый день'
      else
        s = days
          .map((d) => WEEKDAY_SHORT[d - 1])
          .join(', ')
          .replace(/^./, (c) => c.toUpperCase())
      break
    }
    case 'interval':
      s = rule.every === 1 ? 'Каждый день' : `Каждые ${rule.every} ${plural(rule.every, 'день', 'дня', 'дней')}`
      break
    case 'monthly':
      s = `Каждый месяц, ${rule.day}-го`
      break
  }
  return s
}

export const ALL_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]
