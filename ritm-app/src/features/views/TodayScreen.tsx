import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Task } from '../../db/types'
import { formatLongDay } from '../../domain/dates'
import { doneOn, dueOn, overdue } from '../../domain/views'
import { useToday } from '../../lib/useToday'
import { Empty } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { TodayHabits } from '../habits/TodayHabits'
import { AddTask } from '../tasks/AddTask'
import { Section, TaskList } from '../tasks/TaskList'

export function TodayScreen() {
  const today = useToday()
  // открытые со сроком до сегодня включительно + всё, что выполнено (фильтруем по дню ниже)
  const tasks = useLiveQuery(async () => {
    const byId = new Map<string, Task>()
    for (const t of await db.tasks.where('dueDate').belowOrEqual(today).toArray()) byId.set(t.id, t)
    for (const t of await db.tasks.where('status').equals('done').toArray()) byId.set(t.id, t)
    return [...byId.values()]
  }, [today])
  const all = tasks ?? []
  const late = overdue(all, today)
  const now = dueOn(all, today)
  const done = doneOn(all, today)

  return (
    <Screen title="Сегодня" subtitle={formatLongDay(today)}>
      <AddTask defaults={{ dueDate: today }} />
      {tasks && !now.length && (
        <Empty title={done.length ? 'На сегодня всё' : 'На сегодня ничего не запланировано'}>
          {done.length ? 'Всё, что было на сегодня, сделано.' : 'Добавьте задачу в строке выше или загляните во «Входящие».'}
        </Empty>
      )}
      <TaskList tasks={now} hideDate showList />
      <TodayHabits today={today} />
      {late.length > 0 && (
        <Section title="С прошлых дней" defaultOpen={false}>
          <TaskList tasks={late} showList />
        </Section>
      )}
      {done.length > 0 && (
        <Section title="Сделано сегодня" count={done.length} defaultOpen={false}>
          <TaskList tasks={done} hideDate showList />
        </Section>
      )}
    </Screen>
  )
}
