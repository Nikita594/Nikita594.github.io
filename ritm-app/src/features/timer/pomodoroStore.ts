import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { DEFAULT_SETTINGS, getSetting, setSetting, type Settings } from '../../db/settings'
import type { TimeEntry } from '../../db/types'
import { uid } from '../../lib/id'
import {
  initialState,
  pause as pauseState,
  skipBreak as skipState,
  start as startState,
  stop as stopState,
  tick,
  type FocusRecord,
  type Phase,
  type PomodoroSettings,
  type PomodoroState,
} from '../../domain/pomodoro'

// Состояние таймера хранится в настройках (ключ 'pomodoro'), поэтому переживает перезагрузку.

export function pomodoroSettings(
  s: Pick<Settings, 'pomodoroFocusMin' | 'pomodoroShortBreakMin' | 'pomodoroLongBreakMin' | 'pomodoroLongEvery'>,
): PomodoroSettings {
  return {
    focusMin: s.pomodoroFocusMin,
    shortMin: s.pomodoroShortBreakMin,
    longMin: s.pomodoroLongBreakMin,
    longEvery: s.pomodoroLongEvery,
  }
}

async function loadSettings(): Promise<PomodoroSettings> {
  const keys = ['pomodoroFocusMin', 'pomodoroShortBreakMin', 'pomodoroLongBreakMin', 'pomodoroLongEvery'] as const
  const values = await Promise.all(keys.map((k) => getSetting(k)))
  return { focusMin: values[0], shortMin: values[1], longMin: values[2], longEvery: values[3] }
}

async function load(): Promise<PomodoroState> {
  const saved = (await getSetting('pomodoro')) as PomodoroState | null
  return saved ?? initialState(await loadSettings())
}

function toEntry(r: FocusRecord): TimeEntry {
  return { id: uid(), start: r.start, end: r.end, taskId: r.taskId, categoryId: r.categoryId, source: 'timer' }
}

/** Изменить состояние в одной транзакции (защищает от двойной записи, если открыты две вкладки). */
async function mutate(fn: (st: PomodoroState, s: PomodoroSettings) => { state: PomodoroState; record?: FocusRecord; finished?: Phase }) {
  return db.transaction('rw', db.settings, db.entries, async () => {
    const result = fn(await load(), await loadSettings())
    await setSetting('pomodoro', result.state)
    if (result.record) await db.entries.add(toEntry(result.record))
    return result
  })
}

export const pomodoro = {
  start: () => mutate((st) => ({ state: startState(st, Date.now()) })),
  pause: () => mutate((st) => ({ state: pauseState(st, Date.now()) })),
  stop: () => mutate((st, s) => stopState(st, Date.now(), s)),
  skipBreak: () => mutate((st, s) => ({ state: skipState(st, s) })),
  tick: () => mutate((st, s) => tick(st, Date.now(), s)),
  setTarget: (taskId: string | undefined, categoryId: string | undefined) => mutate((st) => ({ state: { ...st, taskId, categoryId } })),
  /** Сбросить на начало фокуса (например, после смены длительности в настройках). */
  reset: () => mutate((st, s) => ({ state: { ...initialState(s), taskId: st.taskId, categoryId: st.categoryId } })),
}

export function usePomodoroState(): PomodoroState | undefined {
  const saved = useLiveQuery(() => db.settings.get('pomodoro'), [])
  const settings = useLiveQuery(() => loadSettings(), [])
  if (saved === undefined && settings === undefined) return undefined
  return (saved?.value as PomodoroState | null | undefined) ?? initialState(settings ?? pomodoroSettings(DEFAULT_SETTINGS))
}
