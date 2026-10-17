import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/db'
import type { DateStr, Habit } from '../../db/types'
import { addDays, fromDateStr, WEEKDAY_SHORT, weekdayOf } from '../../domain/dates'
import { bestStreak, currentStreak } from '../../domain/habits'
import { days as daysText } from '../../domain/text'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useToday } from '../../lib/useToday'
import { Button, cx, Empty } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { Section } from '../tasks/TaskList'
import { CheckCell, useHabitChecks } from './HabitCells'
import { HabitEditor } from './HabitEditor'

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
            <span className="ui-color h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.color }} />
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
        <div className="ui-card px-2 py-1">
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
          <div className="ui-card px-2 py-1 opacity-70">{archived.map(row)}</div>
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
