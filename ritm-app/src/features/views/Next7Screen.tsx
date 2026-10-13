import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { addDays, formatDayLabel, formatLongDay } from '../../domain/dates'
import { nextDays, overdue } from '../../domain/views'
import { useToday } from '../../lib/useToday'
import type { Task } from '../../db/types'
import { describeRepeat } from '../../domain/repeat'
import { Icon } from '../../ui/icons'
import { Screen } from '../../ui/Screen'
import { AddTask } from '../tasks/AddTask'
import { openTask } from '../tasks/editorStore'
import { Section, TaskList } from '../tasks/TaskList'

/** Будущий повтор: показываем бледно, отметить пока нельзя. Нажатие открывает саму задачу. */
function UpcomingRow({ task }: { task: Task }) {
  return (
    <button
      type="button"
      onClick={() => openTask(task.id)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-faint hover:bg-surface-2"
      title={task.repeat ? describeRepeat(task.repeat) : undefined}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon name="repeat" size={14} />
      </span>
      <span className="truncate">{task.title}</span>
    </button>
  )
}

export function Next7Screen() {
  const today = useToday()
  const last = addDays(today, 6)
  const tasks = useLiveQuery(
    () =>
      db.tasks
        .where('dueDate')
        .belowOrEqual(last)
        .filter((t) => t.status === 'open')
        .toArray(),
    [last],
  )
  const all = tasks ?? []
  const late = overdue(all, today)
  const days = nextDays(all, today)

  return (
    <Screen title="Следующие 7 дней" subtitle={`до ${formatLongDay(last)}`}>
      <AddTask defaults={{ dueDate: today }} />
      {late.length > 0 && (
        <Section title="С прошлых дней" defaultOpen={false}>
          <TaskList tasks={late} showList />
        </Section>
      )}
      {days.map((d) => (
        <Section key={d.date} title={formatDayLabel(d.date, today)} count={d.tasks.length || undefined}>
          {d.tasks.length || d.upcoming.length ? (
            <>
              <TaskList tasks={d.tasks} hideDate showList />
              {d.upcoming.map((t) => (
                <UpcomingRow key={t.id} task={t} />
              ))}
            </>
          ) : (
            <p className="px-2 py-1.5 text-sm text-faint">Свободно</p>
          )}
        </Section>
      ))}
    </Screen>
  )
}
