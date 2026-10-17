import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db/db'
import { toggleCheck } from '../../db/habits'
import type { DateStr, Habit, HabitCheck } from '../../db/types'
import { formatDayLabel } from '../../domain/dates'
import { isScheduled } from '../../domain/habits'
import { Icon } from '../../ui/icons'
import { cx } from '../../ui/kit'

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
      data-state={checked ? 'done' : scheduled ? 'todo' : 'off'}
      className={cx(
        'ui-habit-cell flex shrink-0 items-center justify-center rounded-full transition-colors',
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
