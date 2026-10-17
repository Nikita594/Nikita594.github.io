import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { DesignId } from '../designs/designs'

export type ThemeSetting = 'system' | 'light' | 'dark'

/** Все настройки и их значения по умолчанию. */
export const DEFAULT_SETTINGS = {
  /** Дизайн приложения (src/designs). */
  design: 'aurora' as DesignId,
  /** Светлая или тёмная — только для дизайнов, где это выбирается (Монохром). */
  theme: 'system' as ThemeSetting,
  /** Сколько часов в день можно запланировать без предупреждения (версия 2). */
  dailyLimitMin: 8 * 60,
  /** Сон: с 23:00 до 7:00. */
  sleepStartMin: 23 * 60,
  sleepEndMin: 7 * 60,
  /** Видимые часы в календаре недели. */
  calendarStartHour: 6,
  calendarEndHour: 24,
  pomodoroFocusMin: 25,
  pomodoroShortBreakMin: 5,
  pomodoroLongBreakMin: 15,
  pomodoroLongEvery: 4,
  /** Курс для копилки: сколько копеек в одном долларе (версия 2). */
  usdRateKopecks: 9500,
  /** Когда последний раз сохраняли резервную копию (мс) и когда нажали «Позже». */
  lastBackupAt: 0 as number,
  backupSnoozedUntil: 0 as number,
  /** Когда приложение запустили впервые на этом устройстве. */
  installedAt: 0 as number,
  /** Состояние таймера помодоро, чтобы он пережил перезагрузку. */
  pomodoro: null as unknown,
}

export type Settings = typeof DEFAULT_SETTINGS
export type SettingKey = keyof Settings

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key)
  return (row ? row.value : DEFAULT_SETTINGS[key]) as Settings[K]
}

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value })
}

/** Все настройки разом; пока база не ответила — значения по умолчанию. */
export function useSettings(): Settings {
  const rows = useLiveQuery(() => db.settings.toArray(), [])
  const result = { ...DEFAULT_SETTINGS }
  for (const row of rows ?? []) {
    if (row.key in result) (result as Record<string, unknown>)[row.key] = row.value
  }
  return result
}
