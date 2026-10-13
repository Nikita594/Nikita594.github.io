import { useRef } from 'react'
import type { Task } from '../../db/types'
import { formatDayLabel, formatDuration } from '../../domain/dates'
import { cx } from '../../ui/kit'
import { setTaskDrag } from './taskDrag'

/**
 * Задачи, которые ещё не стоят в календаре этой недели.
 * Мышью — тянуть в слот. Нажатие (и на телефоне) — выбрать задачу, потом нажать на время.
 */
export function TaskPanel({
  tasks,
  onPick,
  picked,
  today,
}: {
  tasks: Task[]
  onPick: (t: Task) => void
  picked: Task | null
  today: string
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-1">
        <h2 className="text-sm font-semibold">Задачи без времени</h2>
        <p className="text-xs text-muted">Перетащите в календарь или нажмите, а потом выберите время.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!tasks.length && <p className="px-1 py-4 text-sm text-faint">Все задачи этой недели уже в календаре.</p>}
        {tasks.map((t) => (
          <PanelItem key={t.id} task={t} onPick={onPick} active={picked?.id === t.id} today={today} />
        ))}
      </div>
    </div>
  )
}

function PanelItem({ task, onPick, active, today }: { task: Task; onPick: (t: Task) => void; active: boolean; today: string }) {
  const start = useRef<{ x: number; y: number; dragging: boolean } | null>(null)
  return (
    <button
      type="button"
      data-panel-task={task.id}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return
        start.current = { x: e.clientX, y: e.clientY, dragging: false }
        const move = (ev: PointerEvent) => {
          const s = start.current
          if (!s || s.dragging) return
          if (Math.abs(ev.clientX - s.x) + Math.abs(ev.clientY - s.y) > 5) {
            s.dragging = true
            setTaskDrag({ task, x: ev.clientX, y: ev.clientY })
          }
        }
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          setTimeout(() => (start.current = null), 0)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
      onClick={() => {
        if (start.current?.dragging) return
        onPick(task)
      }}
      className={cx(
        'mb-1 flex w-full cursor-grab flex-col items-start rounded-lg border px-2.5 py-1.5 text-left text-sm active:cursor-grabbing',
        active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent',
      )}
    >
      <span className="w-full truncate">{task.title}</span>
      <span className="text-[11px] text-muted">
        {task.dueDate ? formatDayLabel(task.dueDate, today) : 'без срока'} · {formatDuration(task.durationMin ?? 60)}
      </span>
    </button>
  )
}
