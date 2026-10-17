import * as chrono from 'chrono-node/ru'
import type { Category, DateStr, List, Minutes, Priority, Repeat, Weekday } from '../db/types'
import { addDays, todayStr, toDateStr, weekdayOf } from './dates'
import { firstOccurrence, nextOccurrence } from './repeat'
import { normalize } from './tasks'

/**
 * Быстрый ввод: «английский завтра в 18:00 1ч !2 #учёба».
 *
 *   дата и время — библиотека chrono-node (русская локаль) + наши поправки ниже;
 *   длительность — «1ч», «1.5ч», «45м», «30 мин», «1ч30м», «на 2 часа», «полчаса»;
 *   приоритет   — «!1» высокий, «!2» средний, «!3» низкий, «!0» без приоритета;
 *   категория   — «#учёба» (регистр и ё/е не важны, можно начало слова: «#англ»);
 *   список      — «~школа»;
 *   повтор      — «каждый день», «по будням», «каждую пятницу», «по пн и чт», «каждые 3 дня», «каждый месяц».
 */

export interface QuickAddResult {
  title: string
  dueDate?: DateStr
  dueTime?: Minutes
  durationMin?: number
  priority?: Priority
  repeat?: Repeat
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

const WEEKDAY_NOM = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
const WEEKDAY_DAT_PL = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям']

/** Любая форма дня недели → номер 1..7. */
function weekdayNumber(word: string): Weekday | undefined {
  const w = word.toLowerCase()
  for (const forms of [WEEKDAY_ACC, WEEKDAY_NOM, WEEKDAY_DAT_PL, WEEKDAY_SHORT]) {
    const i = forms.indexOf(w)
    if (i >= 0) return (i + 1) as Weekday
  }
  return undefined
}
const DAY_WORD = [...WEEKDAY_DAT_PL, ...WEEKDAY_ACC, ...WEEKDAY_NOM, ...WEEKDAY_SHORT].join('|')

/** Ищет повтор, возвращает правило и вырезанный текст. Для «каждую неделю» и «каждый месяц» день берётся позже из срока. */
function parseRepeat(text: string): { rule: Repeat | 'weekly-auto' | 'monthly-auto'; text: string } | undefined {
  const tries: [RegExp, (m: RegExpExecArray) => Repeat | 'weekly-auto' | 'monthly-auto'][] = [
    [re(`${B}(?:каждый\\s+будний\\s+день|по\\s+будням|в\\s+будни)${E}`), () => ({ kind: 'weekdays' })],
    [re(`${B}(?:каждый\\s+день|ежедневно)${E}`), () => ({ kind: 'daily' })],
    [
      re(`${B}(?:каждые|каждый|раз\\s+в)\\s+(\\d+)\\s+(?:дня|дней|день)${E}`),
      (m) => (Number(m[1]) === 1 ? { kind: 'daily' } : { kind: 'interval', every: Math.min(365, Number(m[1])) }),
    ],
    [
      // «каждые 2 недели» — раз в 14 дней от срока
      re(`${B}(?:каждые|каждый|раз\\s+в)\\s+(\\d+)\\s+(?:недели|недель|неделю)${E}`),
      (m) => (Number(m[1]) === 1 ? 'weekly-auto' : { kind: 'interval', every: Math.min(365, Number(m[1]) * 7) }),
    ],
    [re(`${B}(?:каждую\\s+неделю|еженедельно|раз\\s+в\\s+неделю)${E}`), () => 'weekly-auto'],
    [
      // «каждый месяц 15-го», «ежемесячно 5 числа», «каждое 20-е число»
      re(
        `${B}(?:(?:каждый\\s+месяц|ежемесячно|раз\\s+в\\s+месяц)\\s+(\\d{1,2})(?:-?(?:го|е|ое))?(?:\\s+числа)?(?![./]\\d)|каждое\\s+(\\d{1,2})(?:-?е)?\\s+число)${E}`,
      ),
      (m) => ({ kind: 'monthly', day: Math.min(31, Math.max(1, Number(m[1] ?? m[2]))) }),
    ],
    [re(`${B}(?:каждый\\s+месяц|ежемесячно|раз\\s+в\\s+месяц)${E}`), () => 'monthly-auto'],
    [
      re(`${B}(?:каждый|каждую|каждое|по)\\s+((?:${DAY_WORD})(?:\\s*(?:,|и)\\s*(?:${DAY_WORD}))*)${E}`),
      (m) => {
        const days = [...new Set(m[1].split(/\s*(?:,|\sи\s)\s*/u).map((w) => weekdayNumber(w.trim())))]
          .filter((d): d is Weekday => d !== undefined)
          .sort()
        return { kind: 'weekly', days }
      },
    ],
  ]
  for (const [pattern, make] of tries) {
    const m = pattern.exec(text)
    if (m) return { rule: make(m), text: cut(text, m.index, m.index + m[0].length) }
  }
  return undefined
}

/** Одиночные слова, которые chrono принимает за дату, хотя в названии задачи это просто слово. */
const NOT_A_DATE = new Set([
  'неделя',
  'неделе',
  'неделю',
  'недели',
  'месяц',
  'месяца',
  'месяце',
  'год',
  'года',
  'день',
  'дня',
  'утро',
  'вечер',
  'ночь',
  // «окружающая среда», «среда разработки» — не день недели; «в среду», «до среды», «ср» дату дают
  'среда',
  'среду',
  'среды',
])

/**
 * Приводит формы, которые chrono не понимает, к тем, что понимает.
 * Запоминает замены: если chrono замену не взял, в название вернётся исходный текст.
 */
function rewrite(text: string, swaps: { from: string; to: string }[]): string {
  let t = text
  const sub = (pattern: RegExp, make: (m: string, ...g: string[]) => string | null) => {
    t = t.replace(pattern, (m: string, ...g: string[]) => {
      const to = make(m, ...g)
      if (to === null || to === m) return m
      swaps.push({ from: m, to })
      return to
    })
  }
  // «к пятнице», «до пятницы» → «в пятницу»
  WEEKDAY_DAT.forEach((w, i) => sub(re(`${B}(?:к|ко)\\s+${w}${E}`), () => `в ${WEEKDAY_ACC[i]}`))
  WEEKDAY_GEN.forEach((w, i) => sub(re(`${B}до\\s+${w}${E}`), () => `в ${WEEKDAY_ACC[i]}`))
  // «во вторник» → «в вторник» (иначе «во» остаётся в названии)
  sub(re(`${B}во\\s+вторник${E}`), () => 'в вторник')
  // «пн», «в вс» → «в понедельник», «в воскресенье»
  WEEKDAY_SHORT.forEach((w, i) => sub(re(`${B}(?:(?:в|во)\\s+)?${w}${E}`), () => `в ${WEEKDAY_ACC[i]}`))
  // «в 2 часа дня», «в 7 вечера», «3 часа ночи» → «в 14:00», «в 19:00», «в 03:00»
  const toClock = (h: string, part: string) => {
    let hour = Number(h)
    if (hour > 12) return null
    if ((part === 'дня' || part === 'вечера') && hour < 12) hour += 12
    if (part === 'ночи' && hour === 12) hour = 0
    return `в ${String(hour).padStart(2, '0')}:00`
  }
  sub(re(`${B}в\\s+(\\d{1,2})\\s*(?:час|часа|часов)?\\s+(утра|дня|вечера|ночи)${E}`), (_, h, part) => toClock(h, part))
  sub(re(`${B}(\\d{1,2})\\s*(?:час|часа|часов)\\s+(утра|дня|вечера|ночи)${E}`), (_, h, part) => toClock(h, part))
  // «в 10 часов», «до 18 часов», «к 9 часам» → «в 10» (иначе chrono читает «10 часов» как «через 10 часов»)
  sub(re(`${B}(?:в|во|к|ко|до)\\s+(\\d{1,2})\\s*(?:час|часа|часов|часам)${E}(?!\\s+(?:утра|дня|вечера|ночи))`), (_, h) =>
    Number(h) <= 23 ? `в ${h}` : null,
  )
  // «в 10.10» — это время 10:10, а не 10 октября
  sub(re(`${B}в\\s+(\\d{1,2})\\.(\\d{2})${E}(?![.,]?\\d)`), (_, h, mm) => (Number(h) <= 23 && Number(mm) <= 59 ? `в ${h}:${mm}` : null))
  // «20.10», «20.10.2026», «5/11» → «20 октября». Месяц — двумя цифрами, чтобы «параграф 2.3» и «2.5%» не стали датами.
  sub(re(`${B}(?<![\\d.,])(\\d{1,2})[./](\\d{2})(?:[./](\\d{4}))?${E}(?![.,]?\\d|%)`), (_, d, mo, y) => {
    const day = Number(d)
    const month = Number(mo)
    if (day < 1 || month < 1 || month > 12) return null
    // такого дня в месяце нет (29.02 допускаем — бывает в високосный год)
    if (day > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return null
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
  // граница слова внутри: «урок 45 мин» — «к» здесь конец слова «урок», а не предлог
  const notTime = '(?<!(?<![\\p{L}\\p{N}])(?:в|во|к|до|через|после)\\s+)'
  // число целиком: в «1.5ч» не начинать с «5»
  const num = '(?<![\\d.,])'
  const durations: [RegExp, (m: RegExpExecArray) => number][] = [
    [re(`${B}(?:на\\s+)?(\\d+)\\s*ч\\s*(\\d+)\\s*(?:м|мин)${E}`), (m) => Number(m[1]) * 60 + Number(m[2])],
    [re(`${B}на\\s+полчаса${E}|${B}${notTime}полчаса${E}`), () => 30],
    [re(`${B}на\\s+час${E}`), () => 60],
    [
      re(`${B}${notTime}(?:на\\s+)?${num}(\\d+(?:[.,]\\d+)?)\\s*(?:ч|час|часа|часов)${E}(?!\\s+(?:утра|дня|вечера|ночи))`),
      (m) => Math.round(parseNumber(m[1]) * 60),
    ],
    [re(`${B}${notTime}(?:на\\s+)?${num}(\\d+)\\s*(?:м|мин|минут|минуты|минуту)${E}`), (m) => Number(m[1])],
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

  // 4. Повтор (до дат: «каждую пятницу» не должно стать просто «в пятницу»)
  const repeat = parseRepeat(text)
  if (repeat) text = repeat.text

  // 5. Дата и время. chrono может вернуть дату и время отдельными кусками («завтра … в 18:00») — склеиваем.
  const swaps: { from: string; to: string }[] = []
  text = rewrite(text, swaps)
  const today = todayStr(now)
  const parsed = chrono.casual.parse(text, now, { forwardDate: true }).filter((r) => !NOT_A_DATE.has(normalize(r.text)))
  const hasDate = (r: chrono.ParsedResult) => r.start.isCertain('day') || r.start.isCertain('weekday') || r.start.isCertain('month')
  const dateRes = parsed.find(hasDate)
  const timeRes = dateRes?.start.isCertain('hour') ? dateRes : parsed.find((r) => r.start.isCertain('hour') && !hasDate(r))
  const dateFromText = !!dateRes
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
  // замены, которые chrono не взял (например, «29 февраля» в невисокосный год), возвращаем как было
  for (const sw of swaps) {
    const i = text.indexOf(sw.to)
    if (i >= 0) text = text.slice(0, i) + sw.from + text.slice(i + sw.to.length)
  }

  // У повторяющейся задачи всегда есть срок: если дата не названа — первый повтор начиная с сегодня.
  if (repeat) {
    const base = result.dueDate ?? today
    const rule: Repeat =
      repeat.rule === 'weekly-auto'
        ? { kind: 'weekly', days: [weekdayOf(base)] }
        : repeat.rule === 'monthly-auto'
          ? { kind: 'monthly', day: Number(base.slice(8, 10)) }
          : repeat.rule
    result.repeat = rule
    // «каждый месяц 1.10»: chrono перенёс прошедшую дату на год вперёд — берём ближайший повтор
    const farAway = dateFromText && rule.kind === 'monthly' && result.dueDate !== undefined && result.dueDate > addDays(today, 31)
    if (!dateFromText || farAway) {
      let first = firstOccurrence(rule, today) ?? today
      const nowMin = now.getHours() * 60 + now.getMinutes()
      if (first === today && result.dueTime !== undefined && result.dueTime <= nowMin) first = nextOccurrence(rule, today) ?? today
      result.dueDate = first
    }
  }

  result.title = text.replace(/\s+/g, ' ').trim()
  return result
}
