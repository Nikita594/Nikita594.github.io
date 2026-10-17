import { describe, expect, it } from 'vitest'
import type { Weekday } from '../db/types'
import { bestStreak, completionRate, currentStreak, isScheduled, weeksGrid } from './habits'
import { plural } from './text'

// Сегодня — вторник 13 октября 2026. Привычка создана 1 октября (четверг).
const today = '2026-10-13'
const created = new Date(2026, 9, 1, 9, 0).getTime()
const daily = { days: [] as Weekday[], createdAt: created }
const weekdays = { days: [1, 2, 3, 4, 5] as Weekday[], createdAt: created }
const set = (...d: string[]) => new Set(d)

describe('серии', () => {
  it('подряд до вчера, сегодня ещё не отмечено — серия не рвётся', () => {
    expect(currentStreak(daily, set('2026-10-10', '2026-10-11', '2026-10-12'), today)).toBe(3)
  })
  it('сегодня отмечено — считается', () => {
    expect(currentStreak(daily, set('2026-10-11', '2026-10-12', '2026-10-13'), today)).toBe(3)
  })
  it('пропуск вчера — серия 0 (или 1, если сегодня отмечено)', () => {
    expect(currentStreak(daily, set('2026-10-10', '2026-10-11'), today)).toBe(0)
    expect(currentStreak(daily, set('2026-10-10', '2026-10-11', '2026-10-13'), today)).toBe(1)
  })
  it('по будням: выходные не рвут серию', () => {
    // пт 9, пн 12 — между ними сб и вс
    expect(currentStreak(weekdays, set('2026-10-08', '2026-10-09', '2026-10-12'), today)).toBe(3)
  })
  it('отметка в выходной не удлиняет серию по будням', () => {
    expect(currentStreak(weekdays, set('2026-10-09', '2026-10-10', '2026-10-12'), today)).toBe(2)
  })
  it('дни до создания привычки не считаются пропусками', () => {
    expect(
      currentStreak(
        daily,
        set(...['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((d) => `2026-10-${d}`)),
        today,
      ),
    ).toBe(12)
  })
  it('привычку создали сегодня и отметили вчера задним числом — серия 2', () => {
    const fresh = { days: [] as Weekday[], createdAt: new Date(2026, 9, 13, 20, 0).getTime() }
    expect(currentStreak(fresh, set('2026-10-12', '2026-10-13'), today)).toBe(2)
    expect(bestStreak(fresh, set('2026-10-12', '2026-10-13'), today)).toBe(2)
    expect(completionRate(fresh, set('2026-10-12', '2026-10-13'), today)).toEqual({ done: 2, planned: 2 })
  })
  it('лучшая серия', () => {
    const checks = set('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-06', '2026-10-12')
    expect(bestStreak(daily, checks, today)).toBe(4)
    expect(currentStreak(daily, checks, today)).toBe(1)
  })
  it('без отметок — ноль', () => {
    expect(currentStreak(daily, set(), today)).toBe(0)
    expect(bestStreak(daily, set(), today)).toBe(0)
  })
})

describe('расписание и статистика', () => {
  it('по будням: сб и вс не нужны', () => {
    expect(isScheduled(weekdays, '2026-10-17')).toBe(false)
    expect(isScheduled(weekdays, '2026-10-16')).toBe(true)
    expect(isScheduled(daily, '2026-10-17')).toBe(true)
  })
  it('процент за 30 дней: считаются дни с создания, неотмеченное «сегодня» не в минус', () => {
    // с 1 по 13 октября 13 дней, сегодня не отмечено → в плане 12
    expect(completionRate(daily, set('2026-10-01', '2026-10-05', '2026-10-12'), today)).toEqual({ done: 3, planned: 12 })
  })
  it('сетка недель с понедельника', () => {
    const g = weeksGrid('2026-10-01', today)
    expect(g).toHaveLength(3)
    expect(g[0][0]).toBe('2026-09-28')
    expect(g[2][6]).toBe('2026-10-18')
  })
})

it('склонение', () => {
  expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => plural(n, 'день', 'дня', 'дней'))).toEqual([
    'день',
    'дня',
    'дней',
    'дней',
    'дней',
    'день',
    'дня',
    'дней',
    'дней',
  ])
})
