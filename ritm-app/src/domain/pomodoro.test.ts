import { describe, expect, it } from 'vitest'
import { elapsed, formatClock, initialState, pause, remaining, skipBreak, start, stop, tick } from './pomodoro'

const S = { focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4 }
const MIN = 60_000
const t0 = new Date(2026, 9, 13, 18, 0).getTime()

describe('помодоро', () => {
  it('идёт по часам, а не по тикам', () => {
    const st = start(initialState(S), t0)
    expect(remaining(st, t0 + 10 * MIN)).toBe(15 * MIN)
    expect(formatClock(remaining(st, t0 + 10 * MIN + 1500))).toBe('14:59')
  })

  it('пауза останавливает счёт', () => {
    let st = start(initialState(S), t0)
    st = pause(st, t0 + 10 * MIN)
    expect(elapsed(st, t0 + 60 * MIN)).toBe(10 * MIN)
    st = start(st, t0 + 60 * MIN)
    expect(remaining(st, t0 + 65 * MIN)).toBe(10 * MIN)
  })

  it('по окончании фокуса — запись в «факт» и короткий перерыв', () => {
    const st = { ...start(initialState(S), t0), taskId: 't', categoryId: 'english' }
    expect(tick(st, t0 + 24 * MIN, S).record).toBeUndefined()
    const r = tick(st, t0 + 25 * MIN + 500, S)
    expect(r.finished).toBe('focus')
    expect(r.record).toEqual({ start: t0, end: t0 + 25 * MIN, taskId: 't', categoryId: 'english' })
    expect(r.state).toMatchObject({ phase: 'short', status: 'idle', round: 1, durationMs: 5 * MIN, taskId: 't' })
  })

  it('с паузой запись равна чистому времени фокуса и заканчивается в момент окончания', () => {
    let st = start(initialState(S), t0)
    st = pause(st, t0 + 10 * MIN)
    st = start(st, t0 + 20 * MIN) // пауза 10 минут
    const r = tick(st, t0 + 40 * MIN, S) // приложение было закрыто, открыли позже
    expect(r.record).toEqual({ start: t0 + 10 * MIN, end: t0 + 35 * MIN, taskId: undefined, categoryId: undefined })
  })

  it('после четвёртого фокуса — длинный перерыв', () => {
    const st = { ...start(initialState(S), t0), round: 3 }
    expect(tick(st, t0 + 26 * MIN, S).state).toMatchObject({ phase: 'long', round: 4, durationMs: 15 * MIN })
  })

  it('после перерыва — снова фокус, без записи', () => {
    const brk = tick(start(initialState(S), t0), t0 + 25 * MIN, S).state
    const r = tick(start(brk, t0 + 30 * MIN), t0 + 36 * MIN, S)
    expect(r.record).toBeUndefined()
    expect(r.state).toMatchObject({ phase: 'focus', status: 'idle' })
  })

  it('«Стоп» на 12-й минуте записывает 12 минут и не засчитывает круг', () => {
    const r = stop(start(initialState(S), t0), t0 + 12 * MIN, S)
    expect(r.record).toMatchObject({ start: t0, end: t0 + 12 * MIN })
    expect(r.state).toMatchObject({ phase: 'short', round: 0 })
  })

  it('«Стоп» через 20 секунд ничего не записывает', () => {
    const r = stop(start(initialState(S), t0), t0 + 20_000, S)
    expect(r.record).toBeUndefined()
    expect(r.state).toMatchObject({ phase: 'focus', status: 'idle' })
  })

  it('пропустить перерыв', () => {
    const brk = tick(start(initialState(S), t0), t0 + 25 * MIN, S).state
    expect(skipBreak(brk, S)).toMatchObject({ phase: 'focus', status: 'idle', round: 1 })
  })
})
