import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/db'
import { formatDayLabel } from '../../domain/dates'
import { groupDone } from '../../domain/views'
import { useToday } from '../../lib/useToday'
import { Button, Empty } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { Section, TaskList } from '../tasks/TaskList'

const PAGE = 14

export function DoneScreen() {
  const today = useToday()
  const [days, setDays] = useState(PAGE)
  const tasks = useLiveQuery(() => db.tasks.where('status').equals('done').toArray(), [])
  const groups = groupDone(tasks ?? [])
  const shown = groups.slice(0, days)

  return (
    <Screen title="Выполнено">
      {tasks && !groups.length && <Empty title="Пока пусто">Здесь будут выполненные задачи, по дням.</Empty>}
      {shown.map((g) => (
        <Section key={g.date} title={formatDayLabel(g.date, today)} count={g.tasks.length}>
          <TaskList tasks={g.tasks} hideDate showList />
        </Section>
      ))}
      {groups.length > days && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => setDays(days + PAGE)}>Показать раньше</Button>
        </div>
      )}
    </Screen>
  )
}
