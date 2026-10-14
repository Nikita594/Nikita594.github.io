import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { DateStr } from '../../db/types'
import { currentStreak, isScheduled } from '../../domain/habits'
import { Section } from '../tasks/TaskList'
import { CheckCell, useHabitChecks } from './HabitsScreen'

/** Привычки, нужные сегодня, — на экране «Сегодня». */
export function TodayHabits({ today }: { today: DateStr }) {
  const habits = useLiveQuery(
    () =>
      db.habits
        .orderBy('order')
        .filter((h) => !h.archived)
        .toArray(),
    [],
  )
  const checks = useHabitChecks()
  const due = (habits ?? []).filter((h) => isScheduled(h, today))
  if (!due.length || !checks) return null
  const done = due.filter((h) => checks.get(h.id)?.has(today)).length
  return (
    <Section title="Привычки" count={done === due.length ? undefined : due.length - done}>
      <div className="flex flex-col">
        {due.map((h) => {
          const set = checks.get(h.id) ?? new Set<string>()
          const streak = currentStreak(h, set, today)
          return (
            <div key={h.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <CheckCell habit={h} date={today} checked={set.has(today)} size={22} />
              <span className={set.has(today) ? 'text-sm text-faint' : 'text-sm'}>{h.name}</span>
              {streak > 1 && <span className="text-xs text-faint">серия {streak}</span>}
            </div>
          )
        })}
      </div>
    </Section>
  )
}
