import { describe, expect, it } from 'vitest'
import {
  addDays,
  diffDays,
  formatDayLabel,
  formatDuration,
  formatMinutes,
  formatWeekRange,
  parseHHMM,
  weekDays,
  weekStart,
  weekdayOf,
} from './dates'

describe('недели начинаются с понедельника', () => {
  it('вторник 13 октября 2026 → понедельник 12 октября', () => {
    expect(weekStart('2026-10-13')).toBe('2026-10-12')
  })
  it('воскресенье относится к прошедшей неделе', () => {
    expect(weekStart('2026-10-18')).toBe('2026-10-12')
  })
  it('понедельник — сам себе начало недели', () => {
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
  })
  it('7 дней недели подряд', () => {
    expect(weekDays('2026-10-12')).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ])
  })
  it('номер дня недели: пн = 1, вс = 7', () => {
    expect(weekdayOf('2026-10-12')).toBe(1)
    expect(weekdayOf('2026-10-18')).toBe(7)
  })
})

describe('арифметика дней', () => {
  it('переход через месяц и год', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2027-01-01', '2026-12-31')).toBe(1)
  })
})

describe('форматирование', () => {
  it('время и длительность', () => {
    expect(formatMinutes(1080)).toBe('18:00')
    expect(formatMinutes(545)).toBe('09:05')
    expect(parseHHMM('7:30')).toBe(450)
    expect(parseHHMM('25:00')).toBeUndefined()
    expect(formatDuration(90)).toBe('1 ч 30 мин')
    expect(formatDuration(60)).toBe('1 ч')
    expect(formatDuration(25)).toBe('25 мин')
  })
  it('подписи дней', () => {
    expect(formatDayLabel('2026-10-13', '2026-10-13')).toBe('Сегодня')
    expect(formatDayLabel('2026-10-14', '2026-10-13')).toBe('Завтра')
    expect(formatDayLabel('2026-10-12', '2026-10-13')).toBe('Вчера')
    expect(formatDayLabel('2026-10-16', '2026-10-13')).toBe('пт, 16 окт')
    expect(formatDayLabel('2026-11-20', '2026-10-13')).toBe('20 нояб')
    expect(formatDayLabel('2027-01-05', '2026-10-13')).toBe('5 янв 2027')
  })
  it('диапазон недели', () => {
    expect(formatWeekRange('2026-10-12')).toBe('12–18 октября')
    expect(formatWeekRange('2026-09-28')).toBe('28 сентября – 4 октября')
  })
})
