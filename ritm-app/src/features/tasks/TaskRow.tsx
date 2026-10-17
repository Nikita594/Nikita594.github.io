import type { Category, List, Task } from '../../db/types'
import { completeTask, deleteTask, reopenTask } from '../../db/tasks'
import { diffDays, formatDayLabel, formatDuration, formatMinutes, todayStr } from '../../domain/dates'
import { INBOX_ID } from '../../db/seed'
import { describeRepeat } from '../../domain/repeat'
import { Icon } from '../../ui/icons'
import { ColorDot, cx } from '../../ui/kit'
import { toast } from '../../ui/toast'
import { openTask } from './editorStore'

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
      // форму и цвет галочки задаёт дизайн (крючок ui-check, src/designs)
      data-priority={task.priority}
      className="ui-check"
    >
      {done && <Icon name="check" size={14} strokeWidth={3} />}
    </button>
  )
}

export async function toggleTask(task: Task) {
  if (task.status === 'done') {
    await reopenTask(task.id)
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
      className="ui-task group flex cursor-pointer items-start gap-3 px-2 py-2"
      data-task-id={task.id}
      data-done={done}
      data-priority={task.priority}
    >
      <div className="pt-0.5">
        <TaskCheckbox task={task} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="ui-task-title text-sm leading-5 break-words">{task.title || 'Без названия'}</div>
        {hasMeta ? (
          <div className="ui-task-meta mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
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
              <span className="ui-chip inline-flex items-center gap-1">
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
      {/* на экранах дня время — справа, крупно */}
      {hideDate && task.dueTime !== undefined && (
        <span className="ui-task-time shrink-0 pt-0.5 font-num text-sm tabular-nums">{formatMinutes(task.dueTime)}</span>
      )}
    </div>
  )
}
