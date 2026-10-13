import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/db'
import { INBOX_ID } from '../../db/seed'
import { deleteList } from '../../db/tasks'
import { compareDoneTasks, compareOpenTasks } from '../../domain/tasks'
import { navigate } from '../../lib/router'
import { Empty, IconButton } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { AddTask } from '../tasks/AddTask'
import { Section, TaskList } from '../tasks/TaskList'
import { ListEditor } from './ListEditor'

export function ListScreen({ listId }: { listId: string }) {
  // список и задачи читаем одним запросом, чтобы экран не мигал «Список не найден» во время загрузки
  const data = useLiveQuery(
    async () => ({ list: await db.lists.get(listId), tasks: await db.tasks.where('listId').equals(listId).toArray() }),
    [listId],
  )
  const list = data?.list
  const tasks = data?.tasks
  const [editing, setEditing] = useState(false)
  if (data && !list) {
    return (
      <Screen title="Список не найден">
        <Empty title="Такого списка нет">Возможно, его удалили.</Empty>
      </Screen>
    )
  }
  const open = (tasks ?? []).filter((t) => t.status === 'open').sort(compareOpenTasks)
  const done = (tasks ?? []).filter((t) => t.status === 'done').sort(compareDoneTasks)
  const isInbox = listId === INBOX_ID

  return (
    <Screen
      title={list?.name ?? ''}
      actions={
        !isInbox &&
        list && (
          <>
            <IconButton icon="edit" label="Переименовать список" onClick={() => setEditing(true)} />
            <IconButton
              icon="trash"
              label="Удалить список"
              onClick={() => {
                const msg = open.length || done.length ? `Удалить список «${list.name}»? Его задачи переедут во «Входящие».` : `Удалить список «${list.name}»?`
                if (confirm(msg)) {
                  void deleteList(list.id)
                  navigate('inbox')
                }
              }}
            />
          </>
        )
      }
    >
      <AddTask defaults={{ listId }} />
      {tasks && !open.length && !done.length && (
        <Empty title={isInbox ? 'Во «Входящих» пусто' : 'В списке пока пусто'}>
          {isInbox ? 'Сюда попадают задачи, для которых не выбран список.' : 'Добавьте первую задачу в строке выше.'}
        </Empty>
      )}
      <TaskList tasks={open} />
      {done.length > 0 && (
        <Section title="Выполнено" count={done.length} defaultOpen={false}>
          <TaskList tasks={done} />
        </Section>
      )}
      {editing && list && <ListEditor list={list} onClose={() => setEditing(false)} />}
    </Screen>
  )
}
