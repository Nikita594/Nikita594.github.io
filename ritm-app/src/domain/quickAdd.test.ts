import { describe, expect, it } from 'vitest'
import { BUILTIN_CATEGORIES } from '../db/seed'
import { parseQuickAdd } from './quickAdd'

// «Сейчас» во всех тестах: вторник, 13 октября 2026, 12:00.
const now = new Date(2026, 9, 13, 12, 0)
const ctx = {
  now,
  categories: BUILTIN_CATEGORIES,
  lists: [
    { id: 'inbox', name: 'Входящие' },
    { id: 'school', name: 'Школа' },
    { id: 'yt', name: 'YouTube сериал' },
  ],
}
const p = (s: string) => parseQuickAdd(s, ctx)

describe('фраза из задания', () => {
  it('«английский завтра в 18:00 1ч !2 #учёба»', () => {
    expect(p('английский завтра в 18:00 1ч !2 #учёба')).toEqual({
      title: 'английский',
      dueDate: '2026-10-14',
      dueTime: 18 * 60,
      durationMin: 60,
      priority: 2,
      categoryId: 'study',
      unknown: [],
    })
  })
  it('те же части в другом порядке', () => {
    const r = p('#учёба !2 завтра английский 1ч в 18:00')
    expect(r).toMatchObject({
      title: 'английский',
      dueDate: '2026-10-14',
      dueTime: 1080,
      durationMin: 60,
      priority: 2,
      categoryId: 'study',
    })
  })
})

describe('дни', () => {
  it.each([
    ['SAT practice сегодня', 'SAT practice', '2026-10-13'],
    ['эссе завтра', 'эссе', '2026-10-14'],
    ['эссе послезавтра', 'эссе', '2026-10-15'],
    ['через 3 дня сдать проект', 'сдать проект', '2026-10-16'],
    ['через неделю пробный SAT', 'пробный SAT', '2026-10-20'],
    ['15 октября', '', '2026-10-15'],
    ['20.10 контрольная', 'контрольная', '2026-10-20'],
    ['5.01 каникулы', 'каникулы', '2027-01-05'],
  ])('«%s»', (input, title, date) => {
    const r = p(input)
    expect(r.title).toBe(title)
    expect(r.dueDate).toBe(date)
    expect(r.dueTime).toBeUndefined()
  })
})

describe('дни недели (сегодня вторник)', () => {
  it.each([
    ['эссе в среду', '2026-10-14'],
    ['эссе в пятницу', '2026-10-16'],
    ['эссе в воскресенье', '2026-10-18'],
    ['эссе в понедельник', '2026-10-19'],
    ['эссе во вторник', '2026-10-20'], // сегодняшний день недели — значит, следующий
    ['эссе к пятнице', '2026-10-16'],
    ['эссе до среды', '2026-10-14'],
    ['эссе в пт', '2026-10-16'],
    ['эссе вс', '2026-10-18'],
  ])('«%s» → %s', (input, date) => {
    const r = p(input)
    expect(r.title).toBe('эссе')
    expect(r.dueDate).toBe(date)
  })
})

describe('время', () => {
  it('«в пятницу в 7 вечера»', () => {
    expect(p('тренировка в пятницу в 7 вечера')).toMatchObject({ title: 'тренировка', dueDate: '2026-10-16', dueTime: 19 * 60 })
  })
  it('«в понедельник в 9:30»', () => {
    expect(p('урок в понедельник в 9:30')).toMatchObject({ title: 'урок', dueDate: '2026-10-19', dueTime: 570 })
  })
  it('«в 7» без уточнения — вечер, сегодня', () => {
    expect(p('позвонить в 7')).toMatchObject({ title: 'позвонить', dueDate: '2026-10-13', dueTime: 19 * 60 })
  })
  it('«в 7 утра» — утро; сегодня 7:00 уже прошло, значит завтра', () => {
    expect(p('пробежка в 7 утра')).toMatchObject({ title: 'пробежка', dueDate: '2026-10-14', dueTime: 7 * 60 })
  })
  it('«в 9:30» уже прошло — завтра', () => {
    expect(p('созвон в 9:30')).toMatchObject({ dueDate: '2026-10-14', dueTime: 570 })
  })
  it('«в 2 часа дня» — время, а не длительность', () => {
    const r = p('встреча в 2 часа дня')
    expect(r).toMatchObject({ title: 'встреча', dueDate: '2026-10-13', dueTime: 14 * 60 })
    expect(r.durationMin).toBeUndefined()
  })
  it('«2 часа дня» без «в»', () => {
    expect(p('встреча 2 часа дня')).toMatchObject({ title: 'встреча', dueTime: 14 * 60 })
  })
  it('«через 2 дня» — это дата, а не время', () => {
    expect(p('проект через 2 дня')).toMatchObject({ title: 'проект', dueDate: '2026-10-15' })
    expect(p('проект через 2 дня').dueTime).toBeUndefined()
  })
  it('«13 ноября в 15:00»', () => {
    expect(p('олимпиада 13 ноября в 15:00')).toMatchObject({ title: 'олимпиада', dueDate: '2026-11-13', dueTime: 900 })
  })
})

describe('длительность', () => {
  it.each([
    ['чтение 1ч', 60],
    ['чтение 1.5ч', 90],
    ['чтение 1,5 ч', 90],
    ['чтение 45м', 45],
    ['чтение 30 мин', 30],
    ['чтение 1ч30м', 90],
    ['чтение 1ч 30мин', 90],
    ['чтение на 2 часа', 120],
    ['чтение полчаса', 30],
    ['чтение на час', 60],
  ])('«%s» → %i мин', (input, min) => {
    const r = p(input)
    expect(r.title).toBe('чтение')
    expect(r.durationMin).toBe(min)
  })
  it('«через 2 часа» — это время, а не длительность', () => {
    const r = p('напомнить через 2 часа')
    expect(r.durationMin).toBeUndefined()
    expect(r).toMatchObject({ dueDate: '2026-10-13', dueTime: 14 * 60 })
  })
})

describe('приоритет, категория, список', () => {
  it('!1 — высокий, !2 — средний, !3 — низкий, !0 — без', () => {
    expect(p('а !1').priority).toBe(3)
    expect(p('а !2').priority).toBe(2)
    expect(p('а !3').priority).toBe(1)
    expect(p('а !0').priority).toBe(0)
    expect(p('а').priority).toBeUndefined()
  })
  it('категория: регистр, ё/е, начало слова', () => {
    expect(p('слова #Учеба').categoryId).toBe('study')
    expect(p('слова #англ').categoryId).toBe('english')
    expect(p('тест #sat').categoryId).toBe('sat')
    expect(p('монтаж #канал').categoryId).toBe('channel')
  })
  it('неизвестная категория остаётся в тексте', () => {
    const r = p('купить #нечто')
    expect(r.categoryId).toBeUndefined()
    expect(r.title).toBe('купить #нечто')
    expect(r.unknown).toEqual(['#нечто'])
  })
  it('список через ~, имя с пробелом — через _', () => {
    expect(p('алгебра ~школа')).toMatchObject({ title: 'алгебра', listId: 'school' })
    expect(p('серия 3 ~youtube_сериал').listId).toBe('yt')
  })
})

describe('повторы (сегодня вторник, 12:00)', () => {
  it('«каждый день» — с сегодняшнего дня', () => {
    expect(p('слова английский каждый день')).toMatchObject({ title: 'слова английский', repeat: { kind: 'daily' }, dueDate: '2026-10-13' })
  })
  it('«по будням в 7 утра» — завтра, раз сегодня 7:00 прошло', () => {
    expect(p('пробежка по будням в 7 утра')).toMatchObject({
      title: 'пробежка',
      repeat: { kind: 'weekdays' },
      dueDate: '2026-10-14',
      dueTime: 420,
    })
  })
  it('«каждую пятницу в 18:00» — ближайшая пятница', () => {
    expect(p('монтаж каждую пятницу в 18:00')).toMatchObject({
      title: 'монтаж',
      repeat: { kind: 'weekly', days: [5] },
      dueDate: '2026-10-16',
      dueTime: 1080,
    })
  })
  it('«по понедельникам и четвергам»', () => {
    expect(p('репетитор по понедельникам и четвергам')).toMatchObject({
      title: 'репетитор',
      repeat: { kind: 'weekly', days: [1, 4] },
      dueDate: '2026-10-15',
    })
  })
  it('«по пн, ср, пт»', () => {
    expect(p('зал по пн, ср, пт 1ч')).toMatchObject({
      title: 'зал',
      repeat: { kind: 'weekly', days: [1, 3, 5] },
      dueDate: '2026-10-14',
      durationMin: 60,
    })
  })
  it('«каждые 3 дня»', () => {
    expect(p('полить цветы каждые 3 дня')).toMatchObject({
      title: 'полить цветы',
      repeat: { kind: 'interval', every: 3 },
      dueDate: '2026-10-13',
    })
  })
  it('«каждую неделю» — в тот же день недели, что и срок', () => {
    expect(p('пробный SAT каждую неделю в субботу')).toMatchObject({
      title: 'пробный SAT',
      repeat: { kind: 'weekly', days: [6] },
      dueDate: '2026-10-17',
    })
  })
  it('«каждый месяц» с датой', () => {
    expect(p('оплатить телефон каждый месяц 20.10')).toMatchObject({
      title: 'оплатить телефон',
      repeat: { kind: 'monthly', day: 20 },
      dueDate: '2026-10-20',
    })
  })
  it('без повтора поле не заполняется', () => {
    expect(p('эссе завтра').repeat).toBeUndefined()
  })
})

describe('обычные названия не превращаются в даты', () => {
  it.each(['прочитать 2 главы', 'сделать 5 задач', 'SAT тест 3', 'урок 7', 'неделя 3 конспект', 'монтаж 1 серии', 'сходить в магазин'])(
    '«%s»',
    (input) => {
      const r = p(input)
      expect(r.title).toBe(input)
      expect(r.dueDate).toBeUndefined()
      expect(r.durationMin).toBeUndefined()
    },
  )
})

describe('исправления после ревью (сейчас пятница 16 октября, 12:00)', () => {
  const fri = new Date(2026, 9, 16, 12, 0)
  const q = (s: string, now = fri) => parseQuickAdd(s, { ...ctx, now })

  it('«в 10 часов», «до 18 часов», «к 9 часам» — это время, а не «через N часов»', () => {
    expect(q('встреча в 10 часов')).toMatchObject({ title: 'встреча', dueDate: '2026-10-17', dueTime: 600 }) // 10:00 уже прошло
    expect(q('сдать до 18 часов')).toMatchObject({ title: 'сдать', dueDate: '2026-10-16', dueTime: 1080 })
    expect(q('встреча в 18 часов')).toMatchObject({ dueDate: '2026-10-16', dueTime: 1080 })
    expect(q('пост в 3 часа', new Date(2026, 9, 16, 10, 0))).toMatchObject({ title: 'пост', dueDate: '2026-10-16', dueTime: 15 * 60 })
    expect(q('встреча в 10 часов').durationMin).toBeUndefined()
  })

  it('длительность после слов на «к», «в»: «урок 45 мин», «урок 2 часа», «выучить 20 слов 30 мин»', () => {
    expect(q('урок 45 мин')).toMatchObject({ title: 'урок', durationMin: 45 })
    expect(q('урок 2 часа')).toMatchObject({ title: 'урок', durationMin: 120 })
    expect(q('урок 1ч')).toMatchObject({ title: 'урок', durationMin: 60 })
    expect(q('урок 45м')).toMatchObject({ title: 'урок', durationMin: 45 })
    expect(q('урок 1.5ч')).toMatchObject({ title: 'урок', durationMin: 90 })
    expect(q('урок на 2 часа')).toMatchObject({ title: 'урок', durationMin: 120 })
    expect(q('кружок 2 часа')).toMatchObject({ title: 'кружок', durationMin: 120 })
    expect(q('японский язык 30 мин')).toMatchObject({ title: 'японский язык', durationMin: 30 })
    expect(q('выучить 20 слов 30 мин')).toMatchObject({ title: 'выучить 20 слов', durationMin: 30 })
    for (const s of ['урок 45 мин', 'урок 2 часа', 'выучить 20 слов 30 мин']) expect(q(s).dueDate).toBeUndefined()
  })

  it('номера и проценты — не даты; «в 10.10» — время', () => {
    expect(q('параграф 2.3')).toEqual({ title: 'параграф 2.3', unknown: [] })
    expect(q('упражнение 4.5')).toEqual({ title: 'упражнение 4.5', unknown: [] })
    expect(q('купить молоко 2.5%')).toEqual({ title: 'купить молоко 2.5%', unknown: [] })
    expect(q('созвон в 10.10', new Date(2026, 9, 16, 9, 0))).toMatchObject({ title: 'созвон', dueDate: '2026-10-16', dueTime: 610 })
    expect(q('контрольная 20.10')).toMatchObject({ title: 'контрольная', dueDate: '2026-10-20' })
  })

  it('отклонённая дата не портит название: «29.02» в невисокосный год', () => {
    const r = q('олимпиада 29.02')
    expect(r.title).toBe('олимпиада 29.02')
  })

  it('«каждый месяц 15-го», «5 числа», «каждое 20-е число»', () => {
    expect(q('оплатить телефон каждый месяц 15-го')).toMatchObject({
      title: 'оплатить телефон',
      repeat: { kind: 'monthly', day: 15 },
      dueDate: '2026-11-15',
    })
    expect(q('оплатить каждый месяц 5 числа')).toMatchObject({
      title: 'оплатить',
      repeat: { kind: 'monthly', day: 5 },
      dueDate: '2026-11-05',
    })
    expect(q('отчёт каждое 20-е число')).toMatchObject({ title: 'отчёт', repeat: { kind: 'monthly', day: 20 }, dueDate: '2026-10-20' })
  })

  it('«каждый месяц 1.10» — ближайший повтор, а не через год', () => {
    expect(q('оплатить каждый месяц 1.10')).toMatchObject({ repeat: { kind: 'monthly', day: 1 }, dueDate: '2026-11-01' })
  })

  it('«среда» как слово остаётся в названии', () => {
    expect(q('доклад про окружающую среду')).toEqual({ title: 'доклад про окружающую среду', unknown: [] })
    expect(q('биология среда обитания').title).toBe('биология среда обитания')
    expect(q('охрана окружающей среды').title).toBe('охрана окружающей среды')
    expect(q('эссе в среду')).toMatchObject({ title: 'эссе', dueDate: '2026-10-21' })
    expect(q('эссе до среды')).toMatchObject({ title: 'эссе', dueDate: '2026-10-21' })
  })

  it('«через полчаса» — время, а не длительность', () => {
    const r = q('позвонить через полчаса')
    expect(r).toMatchObject({ title: 'позвонить', dueDate: '2026-10-16', dueTime: 12 * 60 + 30 })
    expect(r.durationMin).toBeUndefined()
    expect(q('чтение полчаса')).toMatchObject({ title: 'чтение', durationMin: 30 })
  })

  it('«каждые 2 недели» — повтор раз в 14 дней', () => {
    expect(q('зал каждые 2 недели')).toMatchObject({ title: 'зал', repeat: { kind: 'interval', every: 14 }, dueDate: '2026-10-16' })
    expect(q('зал каждые 2 недели в пятницу')).toMatchObject({
      title: 'зал',
      repeat: { kind: 'interval', every: 14 },
      dueDate: '2026-10-23',
    })
  })
})
