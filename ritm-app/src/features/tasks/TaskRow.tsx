import type { Category, List, Priority, Task } from '../../db/types'
import { completeTask, deleteTask, setTaskDone } from '../../db/tasks'
import { diffDays, formatDayLabel, formatDuration, formatMinutes, todayStr } from '../../domain/dates'
import { INBOX_ID } from '../../db/seed'
import { describeRepeat } from '../../domain/repeat'
import { Icon } from '../../ui/icons'
import { ColorDot, cx } from '../../ui/kit'
import { toast } from '../../ui/toast'
import { openTask } from './editorStore'

const PRIORITY_RING: Record<Priority, string> = {
  0: 'border-faint',
  1: 'border-p1',
  2: 'border-p2',
  3: 'border-p3',
}
const PRIORITY_FILL: Record<Priority, string> = {
  0: 'bg-faint',
  1: 'bg-p1',
  2: 'bg-p2',
  3: 'bg-p3',
}

export function TaskCheckbox({ task, onToggle }: { task: Task; onToggle?: (done: boolean) => void }) {
  const done = task.status === 'done'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? 'Вернуть в работу' : 'Отметить выполненной'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle ? onToggle(!done) : void toggleTask(task)
      }}
      className={cx(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
        done ? cx(PRIORITY_FILL[task.priority], 'border-transparent text-white') : PRIORITY_RING[task.priority],
      )}
    >
      {done && <Icon name="check" size={14} strokeWidth={3} />}
    </button>
  )
}

export async function toggleTask(task: Task) {
  if (task.status === 'done') {
    await setTaskDone(task.id, false)
    return
  }
  const { nextDue, undo } = await completeTask(task.id)
  toast(nextDue ? `Готово. Следующий раз — ${formatDayLabel(nextDue).toLowerCase()}` : 'Готово', {
    label: 'Вернуть',
    run: () => void undo(),
  })
}

export async function removeTask(task: Task) {
  const undo = await deleteTask(task.id)
  toast('Задача удалена', { label: 'Вернуть', run: () => void undo() })
}

export function DueLabel({ task, today = todayStr() }: { task: Task; today?: string }) {
  if (!task.dueDate) return null
  const diff = diffDays(task.dueDate, today)
  const overdue = task.status === 'open' && diff < 0
  return (
    <span className={cx('inline-flex items-center gap-1', overdue ? 'text-p2' : diff === 0 && task.status === 'open' ? 'text-accent' : '')}>
      <Icon name="calendar" size={13} />
      {formatDayLabel(task.dueDate, today)}
      {task.dueTime !== undefined && ` ${formatMinutes(task.dueTime)}`}
    </span>
  )
}

export function TaskRow({
  task,
  list,
  category,
  showList,
  hideDate,
}: {
  task: Task
  list?: List
  category?: Category
  showList?: boolean
  hideDate?: boolean
}) {
  const done = task.status === 'done'
  const subDone = task.subtasks.filter((s) => s.done).length
  // «Входящие» не подписываем — это список по умолчанию
  if (list?.id === INBOX_ID) showList = false
  const hasMeta =
    (!hideDate && task.dueDate) || task.durationMin || task.subtasks.length || task.repeat || category || (showList && list) || task.note
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) openTask(task.id)
      }}
      className="group flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2"
      data-task-id={task.id}
    >
      <div className="pt-0.5">
        <TaskCheckbox task={task} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cx('text-sm leading-5 break-words', done && 'text-faint line-through')}>{task.title || 'Без названия'}</div>
        {hasMeta ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            {!hideDate && <DueLabel task={task} />}
            {task.durationMin ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" size={13} />
                {formatDuration(task.durationMin)}
              </span>
            ) : null}
            {task.subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Icon name="list" size={13} />
                {subDone}/{task.subtasks.length}
              </span>
            )}
            {task.repeat && (
              <span className="inline-flex items-center gap-1" title={describeRepeat(task.repeat)}>
                <Icon name="repeat" size={13} />
                <span className="sr-only">{describeRepeat(task.repeat)}</span>
              </span>
            )}
            {task.note && <Icon name="note" size={13} aria-label="Есть заметка" />}
            {category && (
              <span className="inline-flex items-center gap-1">
                <ColorDot color={category.color} size={7} />
                {category.name}
              </span>
            )}
            {showList && list && (
              <span className="inline-flex items-center gap-1">
                <Icon name="folder" size={13} />
                {list.name}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
