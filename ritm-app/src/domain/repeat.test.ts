import { describe, expect, it } from 'vitest'
import type { Repeat } from '../db/types'
import { describeRepeat, firstOccurrence, nextDueAfterDone, nextOccurrence, occursOn } from './repeat'

// 2026-10-12 — понедельник, 2026-10-13 — вторник, 2026-10-16 — пятница, 2026-10-17 — суббота.

describe('следующий повтор', () => {
  it('каждый день', () => {
    expect(nextOccurrence({ kind: 'daily' }, '2026-10-13')).toBe('2026-10-14')
    expect(nextOccurrence({ kind: 'daily' }, '2026-12-31')).toBe('2027-01-01')
  })
  it('по будням: после пятницы — понедельник', () => {
    expect(nextOccurrence({ kind: 'weekdays' }, '2026-10-13')).toBe('2026-10-14')
    expect(nextOccurrence({ kind: 'weekdays' }, '2026-10-16')).toBe('2026-10-19')
    expect(nextOccurrence({ kind: 'weekdays' }, '2026-10-17')).toBe('2026-10-19')
  })
  it('по выбранным дням недели: пн, ср, пт', () => {
    const r: Repeat = { kind: 'weekly', days: [1, 3, 5] }
    expect(nextOccurrence(r, '2026-10-12')).toBe('2026-10-14')
    expect(nextOccurrence(r, '2026-10-14')).toBe('2026-10-16')
    expect(nextOccurrence(r, '2026-10-16')).toBe('2026-10-19')
  })
  it('раз в неделю без выбранных дней — тот же день недели', () => {
    expect(nextOccurrence({ kind: 'weekly', days: [] }, '2026-10-13')).toBe('2026-10-20')
  })
  it('раз в N дней', () => {
    expect(nextOccurrence({ kind: 'interval', every: 3 }, '2026-10-13')).toBe('2026-10-16')
    expect(nextOccurrence({ kind: 'interval', every: 14 }, '2026-10-25')).toBe('2026-11-08')
  })
  it('раз в месяц', () => {
    expect(nextOccurrence({ kind: 'monthly', day: 15 }, '2026-10-15')).toBe('2026-11-15')
    expect(nextOccurrence({ kind: 'monthly', day: 15 }, '2026-10-10')).toBe('2026-10-15')
    expect(nextOccurrence({ kind: 'monthly', day: 15 }, '2026-12-20')).toBe('2027-01-15')
  })
  it('раз в месяц, 31-го: в коротких месяцах — последний день', () => {
    const r: Repeat = { kind: 'monthly', day: 31 }
    expect(nextOccurrence(r, '2027-01-31')).toBe('2027-02-28')
    expect(nextOccurrence(r, '2028-01-31')).toBe('2028-02-29')
    expect(nextOccurrence(r, '2027-02-28')).toBe('2027-03-31')
    expect(nextOccurrence(r, '2027-03-31')).toBe('2027-04-30')
  })
  it('после даты окончания повторов нет', () => {
    expect(nextOccurrence({ kind: 'daily', until: '2026-10-14' }, '2026-10-14')).toBeNull()
    expect(nextOccurrence({ kind: 'daily', until: '2026-10-14' }, '2026-10-13')).toBe('2026-10-14')
  })
})

describe('первый повтор для задачи без срока', () => {
  it('по будням в субботу — понедельник', () => expect(firstOccurrence({ kind: 'weekdays' }, '2026-10-17')).toBe('2026-10-19'))
  it('каждый день — сегодня', () => expect(firstOccurrence({ kind: 'daily' }, '2026-10-13')).toBe('2026-10-13'))
  it('по пятницам во вторник — пятница', () => expect(firstOccurrence({ kind: 'weekly', days: [5] }, '2026-10-13')).toBe('2026-10-16'))
  it('по вторникам во вторник — сегодня', () => expect(firstOccurrence({ kind: 'weekly', days: [2] }, '2026-10-13')).toBe('2026-10-13'))
  it('15-го числа', () => expect(firstOccurrence({ kind: 'monthly', day: 15 }, '2026-10-13')).toBe('2026-10-15'))
})

describe('после выполнения', () => {
  const today = '2026-10-13'
  it('в срок: следующий повтор', () => {
    expect(nextDueAfterDone({ kind: 'daily' }, today, today)).toBe('2026-10-14')
  })
  it('заранее: следующий после срока', () => {
    expect(nextDueAfterDone({ kind: 'weekly', days: [5] }, '2026-10-16', today)).toBe('2026-10-23')
  })
  it('с опозданием на неделю: ежедневная — завтра, а не «вчера, позавчера…»', () => {
    expect(nextDueAfterDone({ kind: 'daily' }, '2026-10-06', today)).toBe('2026-10-14')
  })
  it('с опозданием: по субботам — ближайшая суббота', () => {
    expect(nextDueAfterDone({ kind: 'weekly', days: [6] }, '2026-10-10', today)).toBe('2026-10-17')
  })
  it('с опозданием: раз в 3 дня сохраняет шаг', () => {
    // 5, 8, 11, 14…
    expect(nextDueAfterDone({ kind: 'interval', every: 3 }, '2026-10-05', today)).toBe('2026-10-14')
  })
  it('серия закончилась', () => {
    expect(nextDueAfterDone({ kind: 'daily', until: today }, today, today)).toBeNull()
  })
})

describe('есть ли повтор в день', () => {
  it('по будням', () => {
    expect(occursOn({ kind: 'weekdays' }, '2026-10-12', '2026-10-16')).toBe(true)
    expect(occursOn({ kind: 'weekdays' }, '2026-10-12', '2026-10-17')).toBe(false)
  })
  it('раз в 2 дня от якоря', () => {
    expect(occursOn({ kind: 'interval', every: 2 }, '2026-10-13', '2026-10-15')).toBe(true)
    expect(occursOn({ kind: 'interval', every: 2 }, '2026-10-13', '2026-10-16')).toBe(false)
  })
  it('до якоря и после окончания — нет', () => {
    expect(occursOn({ kind: 'daily' }, '2026-10-13', '2026-10-12')).toBe(false)
    expect(occursOn({ kind: 'daily', until: '2026-10-20' }, '2026-10-13', '2026-10-21')).toBe(false)
  })
})

describe('подписи', () => {
  it.each<[Repeat, string]>([
    [{ kind: 'daily' }, 'Каждый день'],
    [{ kind: 'weekdays' }, 'По будням'],
    [{ kind: 'weekly', days: [5] }, 'Каждую неделю, в пятницу'],
    [{ kind: 'weekly', days: [2] }, 'Каждую неделю, во вторник'],
    [{ kind: 'weekly', days: [5, 1, 3] }, 'Пн, ср, пт'],
    [{ kind: 'interval', every: 3 }, 'Каждые 3 дня'],
    [{ kind: 'interval', every: 5 }, 'Каждые 5 дней'],
    [{ kind: 'monthly', day: 15 }, 'Каждый месяц, 15-го'],
  ])('%j → %s', (rule, text) => expect(describeRepeat(rule)).toBe(text))
})
