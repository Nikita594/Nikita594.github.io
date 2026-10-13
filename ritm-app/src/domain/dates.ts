import { addDays as dfAddDays, differenceInCalendarDays, format, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DateStr, Minutes, Weekday } from '../db/types'

// Все даты храним строками ГГГГ-ММ-ДД по местному времени: так не бывает сдвигов из-за часовых поясов.

export function toDateStr(d: Date): DateStr {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Полдень этого дня — безопасно для арифметики дней при переходе на летнее время. */
export function fromDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function todayStr(now: Date = new Date()): DateStr {
  return toDateStr(now)
}

export function addDays(s: DateStr, n: number): DateStr {
  return toDateStr(dfAddDays(fromDateStr(s), n))
}

export function diffDays(a: DateStr, b: DateStr): number {
  return differenceInCalendarDays(fromDateStr(a), fromDateStr(b))
}

/** Понедельник недели, в которую входит дата. */
export function weekStart(s: DateStr): DateStr {
  return toDateStr(startOfWeek(fromDateStr(s), { weekStartsOn: 1 }))
}

export function weekDays(monday: DateStr): DateStr[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** 1 — понедельник … 7 — воскресенье. */
export function weekdayOf(s: DateStr): Weekday {
  const js = fromDateStr(s).getDay() // 0 — воскресенье
  return (js === 0 ? 7 : js) as Weekday
}

export const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

export function formatMinutes(min: Minutes): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function parseHHMM(s: string): Minutes | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return undefined
  return h * 60 + min
}

/** «1 ч 30 мин», «45 мин», «2 ч». */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h && m) return `${h} ч ${m} мин`
  if (h) return `${h} ч`
  return `${m} мин`
}

/** «Сегодня», «Завтра», «Вчера», «ср, 21 окт», «5 янв 2027». */
export function formatDayLabel(s: DateStr, today: DateStr = todayStr()): string {
  const diff = diffDays(s, today)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Завтра'
  if (diff === -1) return 'Вчера'
  const d = fromDateStr(s)
  const sameYear = d.getFullYear() === fromDateStr(today).getFullYear()
  if (sameYear && Math.abs(diff) < 7) return format(d, 'EEEEEE, d MMM', { locale: ru }).replace('.', '')
  return format(d, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: ru }).replace('.', '')
}

/** «понедельник, 19 октября». */
export function formatLongDay(s: DateStr): string {
  return format(fromDateStr(s), 'EEEE, d MMMM', { locale: ru })
}

/** «12–18 октября», «28 сентября – 4 октября». */
export function formatWeekRange(monday: DateStr): string {
  const a = fromDateStr(monday)
  const b = fromDateStr(addDays(monday, 6))
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${format(b, 'd MMMM', { locale: ru })}`
  return `${format(a, 'd MMMM', { locale: ru })} – ${format(b, 'd MMMM', { locale: ru })}`
}

export function minutesNow(now: Date = new Date()): Minutes {
  return now.getHours() * 60 + now.getMinutes()
}
