import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useState } from 'react'
import { db } from '../../db/db'
import { compareDoneTasks, compareOpenTasks, matchesSearch } from '../../domain/tasks'
import { navigate, useRoute } from '../../lib/router'
import { Icon } from '../../ui/icons'
import { Empty } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { Section, TaskList } from '../tasks/TaskList'

export function SearchScreen() {
  const route = useRoute()
  const [query, setQuery] = useState(route.query.get('q') ?? '')
  const deferred = useDeferredValue(query)
  const all = useLiveQuery(() => db.tasks.toArray(), [])
  const found = (all ?? []).filter((t) => matchesSearch(t, deferred))
  const open = found.filter((t) => t.status === 'open').sort(compareOpenTasks)
  const done = found.filter((t) => t.status === 'done').sort(compareDoneTasks)

  return (
    <Screen title="Поиск">
      <div className="ui-input mb-3 flex items-center gap-2 px-3 focus-within:border-accent">
        <Icon name="search" size={18} className="text-faint" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            navigate('search?q=' + encodeURIComponent(e.target.value), { replace: true })
          }}
          placeholder="Название, заметка или подзадача"
          aria-label="Поиск задач"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      {deferred.trim() && all && !found.length && <Empty title="Ничего не нашлось">Попробуйте другое слово.</Empty>}
      {open.length > 0 && <TaskList tasks={open} showList />}
      {done.length > 0 && (
        <Section title="Выполненные" count={done.length}>
          <TaskList tasks={done} showList />
        </Section>
      )}
    </Screen>
  )
}
