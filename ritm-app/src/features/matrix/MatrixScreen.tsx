import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/db'
import { updateTask } from '../../db/tasks'
import type { Task } from '../../db/types'
import { formatDayLabel } from '../../domain/dates'
import { moveToQuadrant, QUADRANTS, quadrantOf, type Quadrant } from '../../domain/matrix'
import { compareOpenTasks, PRIORITY_LABELS } from '../../domain/tasks'
import { useToday } from '../../lib/useToday'
import { cx } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { toast } from '../../ui/toast'
import { AddTask } from '../tasks/AddTask'
import { TaskList } from '../tasks/TaskList'

const ACCENT: Record<Quadrant, string> = { 1: 'text-text', 2: 'text-accent', 3: 'text-p1', 4: 'text-muted' }

/** Значения по умолчанию для задачи, добавленной прямо в квадрант. */
function defaultsFor(q: Quadrant, today: string): Partial<Task> {
  const { important, urgent } = QUADRANTS[q - 1]
  return { priority: important ? 3 : 0, ...(urgent ? { dueDate: today } : {}) }
}

export function MatrixScreen() {
  const today = useToday()
  const tasks = useLiveQuery(() => db.tasks.where('status').equals('open').toArray(), []) ?? []
  const [over, setOver] = useState<Quadrant | null>(null)
  const byQ = (q: Quadrant) => tasks.filter((t) => quadrantOf(t, today) === q).sort(compareOpenTasks)

  const drop = async (taskId: string, q: Quadrant) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const changes = moveToQuadrant(task, q, today)
    if (!Object.keys(changes).length) return
    const before = { priority: task.priority, dueDate: task.dueDate }
    await updateTask(task.id, changes)
    const parts = [
      changes.priority !== undefined && `приоритет: ${PRIORITY_LABELS[changes.priority].toLowerCase()}`,
      changes.dueDate && `срок: ${formatDayLabel(changes.dueDate, today).toLowerCase()}`,
    ].filter(Boolean)
    toast(`«${task.title}» — ${parts.join(', ')}`, { label: 'Вернуть', run: () => void updateTask(task.id, before) })
  }

  return (
    <Screen title="Матрица" subtitle="Важно — высокий или средний приоритет. Срочно — срок до конца завтра." wide>
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-2 md:grid-rows-2 md:overflow-hidden md:p-4">
        {QUADRANTS.map(({ q, title, hint }) => {
          const list = byQ(q)
          return (
            <section
              key={q}
              aria-label={title}
              data-quadrant={q}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(q)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                const id = e.dataTransfer.getData('text/x-ritm-task')
                if (id) void drop(id, q)
              }}
              className={cx(
                'flex min-h-48 flex-col rounded-2xl border bg-surface md:min-h-0',
                over === q ? 'border-accent ring-2 ring-accent/30' : 'border-line',
              )}
            >
              <header className="flex items-baseline gap-2 px-3 pt-3">
                <h2 className={cx('text-sm font-semibold', ACCENT[q])}>{title}</h2>
                <span className="text-xs text-faint">{hint}</span>
                <span className="ml-auto text-xs text-faint">{list.length || ''}</span>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
                {list.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/x-ritm-task', t.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <TaskList tasks={[t]} showList />
                  </div>
                ))}
                {!list.length && <p className="px-2 py-3 text-sm text-faint">Пусто</p>}
              </div>
              <div className="px-2 pb-2">
                <AddTask defaults={defaultsFor(q, today)} placeholder="Добавить сюда" compact />
              </div>
            </section>
          )
        })}
      </div>
    </Screen>
  )
}
