import * as chrono from 'chrono-node/ru'
import type { Category, DateStr, List, Minutes, Priority } from '../db/types'
import { addDays, todayStr, toDateStr } from './dates'
import { normalize } from './tasks'

/**
 * Быстрый ввод: «английский завтра в 18:00 1ч !2 #учёба».
 *
 *   дата и время — библиотека chrono-node (русская локаль) + наши поправки ниже;
 *   длительность — «1ч», «1.5ч», «45м», «30 мин», «1ч30м», «на 2 часа», «полчаса»;
 *   приоритет   — «!1» высокий, «!2» средний, «!3» низкий, «!0» без приоритета;
 *   категория   — «#учёба» (регистр и ё/е не важны, можно начало слова: «#англ»);
 *   список      — «~школа».
 */

export interface QuickAddResult {
  title: string
  dueDate?: DateStr
  dueTime?: Minutes
  durationMin?: number
  priority?: Priority
  categoryId?: string
  listId?: string
  /** Что не удалось понять, например «#нечто» без такой категории. */
  unknown: string[]
}

export interface QuickAddContext {
  now?: Date
  categories?: Pick<Category, 'id' | 'name' | 'archived'>[]
  lists?: Pick<List, 'id' | 'name'>[]
}

// В JS \b не работает с кириллицей, поэтому границы слова — через «не буква и не цифра».
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const re = (src: string) => new RegExp(src, 'giu')

const WEEKDAY_ACC = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье']
const WEEKDAY_DAT = ['понедельнику', 'вторнику', 'среде', 'четвергу', 'пятнице', 'субботе', 'воскресенью']
const WEEKDAY_GEN = ['понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы', 'воскресенья']
const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

/** Одиночные слова, которые chrono принимает за дату, хотя в названии задачи это просто слово. */
const NOT_A_DATE = new Set(['неделя', 'неделе', 'неделю', 'недели', 'месяц', 'месяца', 'месяце', 'год', 'года', 'день', 'дня', 'утро', 'вечер', 'ночь'])

/** Приводит формы, которые chrono не понимает, к тем, что понимает. */
function rewrite(text: string): string {
  let t = text
  // «к пятнице», «до пятницы» → «в пятницу»
  WEEKDAY_DAT.forEach((w, i) => (t = t.replace(re(`${B}(?:к|ко)\\s+${w}${E}`), `в ${WEEKDAY_ACC[i]}`)))
  WEEKDAY_GEN.forEach((w, i) => (t = t.replace(re(`${B}до\\s+${w}${E}`), `в ${WEEKDAY_ACC[i]}`)))
  // «во вторник» → «в вторник» (иначе «во» остаётся в названии)
  t = t.replace(re(`${B}во\\s+вторник${E}`), 'в вторник')
  // «пн», «в вс» → «в понедельник», «в воскресенье»
  WEEKDAY_SHORT.forEach((w, i) => (t = t.replace(re(`${B}(?:(?:в|во)\\s+)?${w}${E}`), `в ${WEEKDAY_ACC[i]}`)))
  // «в 2 часа дня», «в 7 вечера», «3 часа ночи» → «в 14:00», «в 19:00», «в 03:00»
  const toClock = (h: string, part: string) => {
    let hour = Number(h)
    if (hour > 12) return null
    if ((part === 'дня' || part === 'вечера') && hour < 12) hour += 12
    if (part === 'ночи' && hour === 12) hour = 0
    return `в ${String(hour).padStart(2, '0')}:00`
  }
  t = t.replace(re(`${B}в\\s+(\\d{1,2})\\s*(?:час|часа|часов)?\\s+(утра|дня|вечера|ночи)${E}`), (m, h, part) => toClock(h, part) ?? m)
  t = t.replace(re(`${B}(\\d{1,2})\\s*(?:час|часа|часов)\\s+(утра|дня|вечера|ночи)${E}`), (m, h, part) => toClock(h, part) ?? m)
  // «20.10», «20.10.2026», «5/11» → «20 октября», «20 октября 2026»
  t = t.replace(re(`${B}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{4}))?${E}`), (m, d, mo, y) => {
    const day = Number(d)
    const month = Number(mo)
    if (day < 1 || day > 31 || month < 1 || month > 12) return m
    return `${day} ${MONTH_GEN[month - 1]}${y ? ' ' + y : ''}`
  })
  return t
}

function cut(text: string, start: number, end: number) {
  return text.slice(0, start) + ' ' + text.slice(end)
}

/** Ищет категорию или список по имени: сначала точное совпадение, потом единственное по началу слова. */
function findByName<T extends { id: string; name: string }>(items: T[], token: string): T | undefined {
  const key = (s: string) => normalize(s).replace(/[\s-]+/g, '_')
  const k = key(token)
  const exact = items.find((i) => key(i.name) === k)
  if (exact) return exact
  const prefixed = items.filter((i) => key(i.name).startsWith(k))
  return prefixed.length === 1 ? prefixed[0] : undefined
}

function parseNumber(s: string) {
  return Number(s.replace(',', '.'))
}

export function parseQuickAdd(input: string, ctx: QuickAddContext = {}): QuickAddResult {
  const now = ctx.now ?? new Date()
  const result: QuickAddResult = { title: '', unknown: [] }
  let text = ' ' + input + ' '

  // 1. Приоритет
  text = text.replace(re(`${B}!([0-3])${E}`), (_, n) => {
    result.priority = ([0, 3, 2, 1] as Priority[])[Number(n)]
    return ' '
  })

  // 2. Категория и список
  const categories = (ctx.categories ?? []).filter((c) => !c.archived)
  text = text.replace(re(`(?<=^|\\s)#([\\p{L}\\p{N}_-]+)`), (m, name) => {
    const cat = findByName(categories, name)
    if (!cat) {
      result.unknown.push(m)
      return m
    }
    result.categoryId = cat.id
    return ' '
  })
  text = text.replace(re(`(?<=^|\\s)~([\\p{L}\\p{N}_-]+)`), (m, name) => {
    const list = findByName(ctx.lists ?? [], name)
    if (!list) {
      result.unknown.push(m)
      return m
    }
    result.listId = list.id
    return ' '
  })

  // 3. Длительность. «в 2 часа» и «через 2 часа» — это время, их не трогаем.
  const notTime = '(?<!(?:в|во|к|до|через|после)\\s+)'
  const durations: [RegExp, (m: RegExpExecArray) => number][] = [
    [re(`${B}(?:на\\s+)?(\\d+)\\s*ч\\s*(\\d+)\\s*(?:м|мин)${E}`), (m) => Number(m[1]) * 60 + Number(m[2])],
    [re(`${B}на\\s+полчаса${E}|${B}полчаса${E}`), () => 30],
    [re(`${B}на\\s+час${E}`), () => 60],
    [re(`${B}${notTime}(?:на\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(?:ч|час|часа|часов)${E}(?!\\s+(?:утра|дня|вечера|ночи))`), (m) => Math.round(parseNumber(m[1]) * 60)],
    [re(`${B}${notTime}(?:на\\s+)?(\\d+)\\s*(?:м|мин|минут|минуты|минуту)${E}`), (m) => Number(m[1])],
  ]
  for (const [pattern, toMinutes] of durations) {
    pattern.lastIndex = 0
    const m = pattern.exec(text)
    if (m) {
      const min = toMinutes(m)
      if (min > 0 && min <= 24 * 60) {
        result.durationMin = min
        text = cut(text, m.index, m.index + m[0].length)
        break
      }
    }
  }

  // 4. Дата и время. chrono может вернуть дату и время отдельными кусками («завтра … в 18:00») — склеиваем.
  text = rewrite(text)
  const today = todayStr(now)
  const parsed = chrono.casual.parse(text, now, { forwardDate: true }).filter((r) => !NOT_A_DATE.has(normalize(r.text)))
  const hasDate = (r: chrono.ParsedResult) => r.start.isCertain('day') || r.start.isCertain('weekday') || r.start.isCertain('month')
  const dateRes = parsed.find(hasDate)
  const timeRes = dateRes?.start.isCertain('hour') ? dateRes : parsed.find((r) => r.start.isCertain('hour') && !hasDate(r))
  if (dateRes || timeRes) {
    let date = dateRes ? toDateStr(dateRes.start.date()) : today
    if (timeRes) {
      const s = timeRes.start
      let hour = s.get('hour') ?? 0
      const minute = s.get('minute') ?? 0
      // «в 7» без «утра/вечера» и без минут — скорее всего вечер
      if (!s.isCertain('meridiem') && hour >= 1 && hour <= 7 && !/\d:\d/.test(timeRes.text)) hour += 12
      result.dueTime = hour * 60 + minute
      if (!dateRes) {
        // только время: сегодня, а если уже прошло — завтра
        date = result.dueTime > now.getHours() * 60 + now.getMinutes() ? today : addDays(today, 1)
      }
    }
    // «в пятницу», сказанное в пятницу, — это следующая пятница
    if (dateRes && dateRes.start.isCertain('weekday') && !dateRes.start.isCertain('day') && date === today) date = addDays(date, 7)
    result.dueDate = date
    // вырезаем найденное с конца, чтобы не сбились позиции
    const spans = [...new Set([dateRes, timeRes])].filter((r) => r !== undefined).sort((a, b) => b.index - a.index)
    for (const r of spans) {
      // предлог прямо перед датой тоже убираем: «сделать до | пятницы»
      const head = text.slice(0, r.index).replace(re(`${B}(?:в|во|до|к|ко|на)\\s*$`), '')
      text = head + ' ' + text.slice(r.index + r.text.length)
    }
  }

  result.title = text.replace(/\s+/g, ' ').trim()
  return result
}
