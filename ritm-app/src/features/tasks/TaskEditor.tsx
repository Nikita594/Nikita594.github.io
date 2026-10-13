import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../../db/db'
import { useCategories, useLists } from '../../db/hooks'
import { addSubtask, patchSubtask, removeSubtask, updateTask } from '../../db/tasks'
import type { Priority, Task } from '../../db/types'
import { formatMinutes, parseHHMM } from '../../domain/dates'
import { PRIORITY_LABELS } from '../../domain/tasks'
import { Icon } from '../../ui/icons'
import { cx, Drawer, IconButton, inputCls } from '../../ui/kit'
import { closeTask, useOpenTaskId } from './editorStore'
import { removeTask, TaskCheckbox, toggleTask } from './TaskRow'
import { RepeatField } from './RepeatField'

export function TaskEditorHost() {
  const id = useOpenTaskId()
  const task = useLiveQuery(() => (id ? db.tasks.get(id) : undefined), [id])
  if (!id || !task) return null
  return (
    <Drawer onClose={closeTask} label="Задача">
      <TaskEditor key={task.id} task={task} />
    </Drawer>
  )
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180]

/** Текстовое поле, которое сохраняет изменения с небольшой задержкой и при уходе с поля. */
function useDraft(value: string, save: (v: string) => void) {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef({ draft, value, save })
  latest.current = { draft, value, save }
  const flush = () => {
    clearTimeout(timer.current)
    if (latest.current.draft !== latest.current.value) latest.current.save(latest.current.draft)
  }
  useEffect(() => () => flush(), []) // сохранить при закрытии панели
  return {
    value: draft,
    onChange: (v: string) => {
      setDraft(v)
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, 400)
    },
    flush,
  }
}

function AutoTextarea(props: { value: string; onChange: (v: string) => void; onBlur: () => void; className?: string; placeholder?: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [props.value])
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={props.label}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={props.onBlur}
      className={cx('w-full resize-none bg-transparent outline-none placeholder:text-faint', props.className)}
    />
  )
}

function Row({ icon, label, children }: { icon: Parameters<typeof Icon>[0]['name']; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-3 border-b border-line py-1.5 last:border-0">
      <span className="flex w-28 shrink-0 items-center gap-2 text-sm text-muted">
        <Icon name={icon} size={16} />
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

const selectCls = 'h-8 min-w-0 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent'

function TaskEditor({ task }: { task: Task }) {
  const lists = useLists()
  const categories = useCategories()
  const title = useDraft(task.title, (v) => void updateTask(task.id, { title: v.trim() }))
  const note = useDraft(task.note, (v) => void updateTask(task.id, { note: v }))
  const [newSub, setNewSub] = useState('')
  const set = (changes: Partial<Task>) => void updateTask(task.id, changes)

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <TaskCheckbox task={task} onToggle={() => void toggleTask(task)} />
        <span className="flex-1 text-sm text-muted">{task.status === 'done' ? 'Выполнено' : 'Задача'}</span>
        <IconButton
          icon="trash"
          label="Удалить задачу"
          onClick={() => {
            closeTask()
            void removeTask(task)
          }}
        />
        <IconButton icon="close" label="Закрыть" onClick={closeTask} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <AutoTextarea
          label="Название"
          value={title.value}
          onChange={title.onChange}
          onBlur={title.flush}
          placeholder="Название задачи"
          className="text-lg font-medium"
        />
        <AutoTextarea
          label="Заметка"
          value={note.value}
          onChange={note.onChange}
          onBlur={note.flush}
          placeholder="Заметка"
          className="mt-1 min-h-10 text-sm text-muted"
        />

        <div className="mt-3">
          <Row icon="calendar" label="Срок">
            <input
              type="date"
              aria-label="Дата"
              className={selectCls}
              value={task.dueDate ?? ''}
              onChange={(e) => set(e.target.value ? { dueDate: e.target.value } : { dueDate: undefined, dueTime: undefined, repeat: undefined })}
            />
            {task.dueDate && (
              <input
                type="time"
                aria-label="Время"
                className={selectCls}
                value={task.dueTime !== undefined ? formatMinutes(task.dueTime) : ''}
                onChange={(e) => set({ dueTime: parseHHMM(e.target.value) })}
              />
            )}
            {task.dueDate && (
              <IconButton icon="close" label="Убрать срок" size={16} className="h-8 w-8" onClick={() => set({ dueDate: undefined, dueTime: undefined, repeat: undefined })} />
            )}
          </Row>

          <RepeatField task={task} />

          <Row icon="clock" label="Длительность">
            <select
              aria-label="Длительность"
              className={selectCls}
              value={task.durationMin ?? ''}
              onChange={(e) => set({ durationMin: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">не задана</option>
              {[...new Set([...DURATIONS, ...(task.durationMin ? [task.durationMin] : [])])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}`}
                  </option>
                ))}
            </select>
          </Row>

          <Row icon="flag" label="Приоритет">
            <div className="flex gap-1" role="radiogroup" aria-label="Приоритет">
              {([3, 2, 1, 0] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={task.priority === p}
                  aria-label={PRIORITY_LABELS[p]}
                  title={PRIORITY_LABELS[p]}
                  onClick={() => set({ priority: p })}
                  className={cx(
                    'flex h-8 items-center gap-1 rounded-lg px-2 text-xs',
                    task.priority === p ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:bg-surface-2',
                  )}
                >
                  <Icon name="flag" size={14} className={['text-faint', 'text-p1', 'text-p2', 'text-p3'][p]} />
                  {['нет', 'низк.', 'средн.', 'высок.'][p]}
                </button>
              ))}
            </div>
          </Row>

          <Row icon="folder" label="Список">
            <select aria-label="Список" className={selectCls} value={task.listId} onChange={(e) => set({ listId: e.target.value })}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Row>

          <Row icon="tag" label="Категория">
            <select
              aria-label="Категория"
              className={selectCls}
              value={task.categoryId ?? ''}
              onChange={(e) => set({ categoryId: e.target.value || undefined })}
            >
              <option value="">без категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Row>
        </div>

        <div className="mt-5">
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Подзадачи</h3>
          {task.subtasks.map((s) => (
            <div key={s.id} className="group flex items-center gap-2 py-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={s.done}
                aria-label={s.done ? 'Снять отметку' : 'Отметить'}
                onClick={() => void patchSubtask(task, s.id, { done: !s.done })}
                className={cx('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', s.done ? 'border-transparent bg-faint text-white' : 'border-faint')}
              >
                {s.done && <Icon name="check" size={11} strokeWidth={3} />}
              </button>
              <input
                aria-label="Подзадача"
                defaultValue={s.title}
                onBlur={(e) => e.target.value.trim() !== s.title && void patchSubtask(task, s.id, { title: e.target.value.trim() })}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className={cx('min-w-0 flex-1 bg-transparent text-sm outline-none', s.done && 'text-faint line-through')}
              />
              <IconButton icon="close" label="Удалить подзадачу" size={14} className="h-7 w-7 opacity-60 group-hover:opacity-100" onClick={() => void removeSubtask(task, s.id)} />
            </div>
          ))}
          <form
            className="flex items-center gap-2 py-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newSub.trim()) return
              void addSubtask(task, newSub)
              setNewSub('')
            }}
          >
            <Icon name="plus" size={16} className="text-faint" />
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder="Добавить подзадачу"
              aria-label="Новая подзадача"
              className={cx(inputCls, 'h-8 border-transparent bg-transparent px-0 focus:border-transparent')}
            />
          </form>
        </div>
      </div>
    </>
  )
}
