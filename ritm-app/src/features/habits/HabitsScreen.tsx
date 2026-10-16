import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import { toggleCheck } from '../../db/habits'
import type { DateStr, Habit, HabitCheck } from '../../db/types'
import { addDays, formatDayLabel, fromDateStr, WEEKDAY_SHORT, weekdayOf } from '../../domain/dates'
import { bestStreak, currentStreak, isScheduled } from '../../domain/habits'
import { days as daysText } from '../../domain/text'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useToday } from '../../lib/useToday'
import { Icon } from '../../ui/icons'
import { Button, cx, Empty } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { Section } from '../tasks/TaskList'
import { HabitEditor } from './HabitEditor'

/** Отметки по привычкам: habitId → множество дат. */
export function useHabitChecks(): Map<string, Set<DateStr>> | undefined {
  const checks = useLiveQuery(() => db.habitChecks.toArray(), [])
  return useMemo(() => {
    if (!checks) return undefined
    const map = new Map<string, Set<DateStr>>()
    for (const c of checks as HabitCheck[]) {
      if (!map.has(c.habitId)) map.set(c.habitId, new Set())
      map.get(c.habitId)!.add(c.date)
    }
    return map
  }, [checks])
}

export function CheckCell({ habit, date, checked, size = 32 }: { habit: Habit; date: DateStr; checked: boolean; size?: number }) {
  const scheduled = isScheduled(habit, date)
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={`${habit.name}, ${formatDayLabel(date)}${checked ? ': отмечено' : scheduled ? '' : ': по расписанию не нужно'}`}
      onClick={() => void toggleCheck(habit.id, date)}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full transition-colors',
        checked ? 'text-white' : scheduled ? 'border-2 border-line hover:border-faint' : 'text-faint hover:bg-surface-2',
      )}
      style={{ width: size, height: size, background: checked ? habit.color : undefined }}
    >
      {checked ? (
        <Icon name="check" size={size * 0.5} strokeWidth={3} />
      ) : (
        !scheduled && <span className="h-1 w-1 rounded-full bg-current" />
      )}
    </button>
  )
}

export function HabitsScreen() {
  const today = useToday()
  // 14 дней — только когда рядом с меню есть место и для названий (от 1024 px)
  const wide = useMediaQuery('(min-width: 1024px)')
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray(), [])
  const checks = useHabitChecks()
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const count = wide ? 14 : 7
  const cell = wide ? 30 : 28
  const dates = Array.from({ length: count }, (_, i) => addDays(today, i - count + 1))
  const active = (habits ?? []).filter((h) => !h.archived)
  const archived = (habits ?? []).filter((h) => h.archived)

  const row = (h: Habit) => {
    const set = checks?.get(h.id) ?? new Set<DateStr>()
    const streak = currentStreak(h, set, today)
    const best = bestStreak(h, set, today)
    return (
      <div key={h.id} className="flex items-center gap-2 border-b border-line py-2 last:border-0" data-habit={h.name}>
        <button type="button" onClick={() => setEditing(h)} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left hover:bg-surface-2">
          <div className="flex items-center gap-2 truncate text-sm font-medium">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.color }} />
            <span className="truncate">{h.name}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {streak ? `Серия: ${daysText(streak)}` : 'Серии пока нет'}
            {best > streak && ` · лучшая: ${best}`}
          </div>
        </button>
        <div className={cx('flex', wide ? 'gap-1' : 'gap-0.5')}>
          {dates.map((d) => (
            <CheckCell key={d} habit={h} date={d} checked={set.has(d)} size={cell} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <Screen
      title="Привычки"
      actions={
        <Button variant="ghost" icon="plus" onClick={() => setEditing('new')}>
          Новая
        </Button>
      }
    >
      {habits && !active.length && (
        <Empty title="Привычек пока нет">
          Например, «Слова по-английски» каждый день или «Зал» по понедельникам, средам и пятницам.
          <div className="mt-3">
            <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
              Добавить привычку
            </Button>
          </div>
        </Empty>
      )}
      {active.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface px-2 py-1">
          <div className="flex items-end gap-2 border-b border-line pt-1 pb-2">
            <div className="flex-1" />
            <div className={cx('flex', wide ? 'gap-1' : 'gap-0.5')}>
              {dates.map((d) => (
                <div
                  key={d}
                  className={cx(
                    'flex flex-col items-center text-[11px] leading-tight',
                    d === today ? 'font-semibold text-accent' : 'text-faint',
                  )}
                  style={{ width: cell }}
                >
                  <span>{WEEKDAY_SHORT[weekdayOf(d) - 1]}</span>
                  <span>{fromDateStr(d).getDate()}</span>
                </div>
              ))}
            </div>
          </div>
          {active.map(row)}
        </div>
      )}
      {archived.length > 0 && (
        <Section title="В архиве" count={archived.length} defaultOpen={false}>
          <div className="rounded-2xl border border-line bg-surface px-2 py-1 opacity-70">{archived.map(row)}</div>
        </Section>
      )}
      {editing && (
        <HabitEditor
          habit={editing === 'new' ? undefined : editing}
          checks={editing === 'new' ? new Set() : (checks?.get(editing.id) ?? new Set())}
          onClose={() => setEditing(null)}
        />
      )}
    </Screen>
  )
}
