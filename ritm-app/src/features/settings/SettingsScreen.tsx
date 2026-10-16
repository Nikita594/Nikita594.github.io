import type { ReactNode } from 'react'
import { setSetting, useSettings, type SettingKey, type ThemeSetting } from '../../db/settings'
import { ShortcutsTable } from '../../app/Shortcuts'
import { cx } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { pomodoro, usePomodoroState } from '../timer/pomodoroStore'
import { BackupSettings } from '../backup/BackupSettings'
import { CategoriesSettings } from './CategoriesSettings'
import { NumberSetting } from './NumberSetting'

export function SettingsSection({ title, children, hint }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function SettingsScreen() {
  const settings = useSettings()
  const timer = usePomodoroState()
  /** Длительности таймера: если он сейчас не идёт — сразу применяем новые. */
  const setTimer = async (key: SettingKey, v: number) => {
    await setSetting(key, v as never)
    if (timer?.status === 'idle') await pomodoro.reset()
  }
  return (
    <Screen title="Настройки">
      <SettingsSection title="Резервная копия" hint="Все задачи, списки, привычки, календарь и записи времени — в одном файле.">
        <BackupSettings />
      </SettingsSection>
      <SettingsSection title="Оформление">
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Тема">
          {(
            [
              ['system', 'Как в системе'],
              ['light', 'Светлая'],
              ['dark', 'Тёмная'],
            ] as [ThemeSetting, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={settings.theme === value}
              onClick={() => void setSetting('theme', value)}
              className={cx(
                'h-9 flex-1 rounded-lg text-sm',
                settings.theme === value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </SettingsSection>
      <SettingsSection title="Таймер" hint="Новые длительности применятся к следующему запуску.">
        <NumberSetting
          label="Фокус"
          suffix="мин"
          min={1}
          max={180}
          value={settings.pomodoroFocusMin}
          onChange={(v) => void setTimer('pomodoroFocusMin', v)}
        />
        <NumberSetting
          label="Короткий перерыв"
          suffix="мин"
          min={1}
          max={60}
          value={settings.pomodoroShortBreakMin}
          onChange={(v) => void setTimer('pomodoroShortBreakMin', v)}
        />
        <NumberSetting
          label="Длинный перерыв"
          suffix="мин"
          min={1}
          max={90}
          value={settings.pomodoroLongBreakMin}
          onChange={(v) => void setTimer('pomodoroLongBreakMin', v)}
        />
        <NumberSetting
          label="Длинный перерыв после"
          suffix="фок."
          min={2}
          max={10}
          value={settings.pomodoroLongEvery}
          onChange={(v) => void setTimer('pomodoroLongEvery', v)}
        />
      </SettingsSection>
      <SettingsSection title="Календарь недели" hint="Какие часы показывать в сетке.">
        <NumberSetting
          label="С"
          suffix="ч"
          min={0}
          max={settings.calendarEndHour - 4}
          value={settings.calendarStartHour}
          onChange={(v) => void setSetting('calendarStartHour', v)}
        />
        <NumberSetting
          label="До"
          suffix="ч"
          min={settings.calendarStartHour + 4}
          max={24}
          value={settings.calendarEndHour}
          onChange={(v) => void setSetting('calendarEndHour', v)}
        />
      </SettingsSection>
      <SettingsSection title="Горячие клавиши" hint="Для компьютера. Нажмите «?» в любом месте, чтобы увидеть их снова.">
        <ShortcutsTable />
      </SettingsSection>
      <SettingsSection title="Категории времени" hint="По ним считается, на что уходит время.">
        <CategoriesSettings />
      </SettingsSection>
    </Screen>
  )
}
