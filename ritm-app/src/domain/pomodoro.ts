import type { ID, Moment } from '../db/types'

// Таймер помодоро — чистые функции над состоянием. Время считаем по часам (Date.now),
// а не по тикам: так таймер не сбивается в фоне и переживает перезагрузку.

export type Phase = 'focus' | 'short' | 'long'

export interface PomodoroState {
  phase: Phase
  status: 'idle' | 'running' | 'paused'
  /** Когда запущен текущий отрезок (после старта или «продолжить»). */
  runningSince?: Moment
  /** Сколько уже набежало до текущего отрезка (из-за пауз). */
  elapsedBefore: number
  /** Длина фазы, мс. */
  durationMs: number
  /** Сколько фокусов подряд закончено (для длинного перерыва). */
  round: number
  taskId?: ID
  categoryId?: ID
}

export interface PomodoroSettings {
  focusMin: number
  shortMin: number
  longMin: number
  longEvery: number
}

export interface FocusRecord {
  start: Moment
  end: Moment
  taskId?: ID
  categoryId?: ID
}

/** Короче минуты фокус не записываем — это скорее случайный старт. */
export const MIN_RECORD_MS = 60_000

export function phaseMs(phase: Phase, s: PomodoroSettings) {
  return (phase === 'focus' ? s.focusMin : phase === 'short' ? s.shortMin : s.longMin) * 60_000
}

export function initialState(s: PomodoroSettings): PomodoroState {
  return { phase: 'focus', status: 'idle', elapsedBefore: 0, durationMs: phaseMs('focus', s), round: 0 }
}

export function elapsed(st: PomodoroState, now: Moment): number {
  const running = st.status === 'running' && st.runningSince !== undefined ? now - st.runningSince : 0
  return Math.min(st.durationMs, st.elapsedBefore + running)
}

export function remaining(st: PomodoroState, now: Moment): number {
  return Math.max(0, st.durationMs - elapsed(st, now))
}

export function start(st: PomodoroState, now: Moment): PomodoroState {
  if (st.status === 'running') return st
  return { ...st, status: 'running', runningSince: now }
}

export function pause(st: PomodoroState, now: Moment): PomodoroState {
  if (st.status !== 'running') return st
  return { ...st, status: 'paused', elapsedBefore: elapsed(st, now), runningSince: undefined }
}

/** Момент, когда фаза закончится (если идёт). */
export function endsAt(st: PomodoroState): Moment | undefined {
  if (st.status !== 'running' || st.runningSince === undefined) return undefined
  return st.runningSince + (st.durationMs - st.elapsedBefore)
}

function nextPhase(st: PomodoroState, s: PomodoroSettings, focusDone: boolean): PomodoroState {
  if (st.phase === 'focus') {
    const round = focusDone ? st.round + 1 : st.round
    const phase: Phase = focusDone && round % Math.max(1, s.longEvery) === 0 ? 'long' : 'short'
    return { ...st, phase, status: 'idle', elapsedBefore: 0, runningSince: undefined, durationMs: phaseMs(phase, s), round }
  }
  return { ...st, phase: 'focus', status: 'idle', elapsedBefore: 0, runningSince: undefined, durationMs: phaseMs('focus', s) }
}

/** Запись фокуса, заканчивающаяся в end: длительность — фактически набежавшее время, без пауз. */
function record(st: PomodoroState, focusedMs: number, end: Moment): FocusRecord | undefined {
  if (st.phase !== 'focus' || focusedMs < MIN_RECORD_MS) return undefined
  return { start: end - focusedMs, end, taskId: st.taskId, categoryId: st.categoryId }
}

/**
 * Если фаза закончилась к моменту now — переходим к следующей.
 * Запись фокуса заканчивается в момент окончания фазы, а не «сейчас» (приложение могло быть закрыто).
 */
export function tick(st: PomodoroState, now: Moment, s: PomodoroSettings): { state: PomodoroState; record?: FocusRecord; finished?: Phase } {
  const end = endsAt(st)
  if (end === undefined || now < end) return { state: st }
  return { state: nextPhase(st, s, true), record: record(st, st.durationMs, end), finished: st.phase }
}

/** «Стоп»: закончить раньше. Фокус дольше минуты записывается; следующая фаза — перерыв. */
export function stop(st: PomodoroState, now: Moment, s: PomodoroSettings): { state: PomodoroState; record?: FocusRecord } {
  const done = elapsed(st, now)
  if (st.phase !== 'focus') return { state: nextPhase(st, s, false) }
  const rec = record(st, done, now)
  // фокус не закончен — круг не засчитываем, просто возвращаемся к началу фокуса
  if (!rec) return { state: { ...initialState(s), round: st.round, taskId: st.taskId, categoryId: st.categoryId } }
  return { state: nextPhase(st, s, false), record: rec }
}

/** Пропустить перерыв. */
export function skipBreak(st: PomodoroState, s: PomodoroSettings): PomodoroState {
  return st.phase === 'focus' ? st : nextPhase(st, s, false)
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
