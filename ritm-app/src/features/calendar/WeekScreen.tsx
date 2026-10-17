import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import { useById, useCategories } from '../../db/hooks'
import { useSettings } from '../../db/settings'
import type { Task } from '../../db/types'
import { addDays, formatWeekRange, fromDateStr, WEEKDAY_SHORT, weekDays, weekdayOf, weekStart } from '../../domain/dates'
import { compareOpenTasks } from '../../domain/tasks'
import { navigate, useRoute } from '../../lib/router'
import { useIsWide } from '../../lib/useMediaQuery'
import { useToday } from '../../lib/useToday'
import { Button, cx, IconButton } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { BlockEditor } from './BlockEditor'
import { useTaskDrag } from './taskDrag'
import { TaskPanel } from './TaskPanel'
import { WeekGrid } from './WeekGrid'

export function WeekScreen() {
  const route = useRoute()
  const today = useToday()
  const wide = useIsWide()
  const settings = useSettings()
  const monday = /^\d{4}-\d{2}-\d{2}$/.test(route.params[0] ?? '') ? weekStart(route.params[0]) : weekStart(today)
  const days = useMemo(() => weekDays(monday), [monday])
  const sunday = days[6]

  // на телефоне показываем один день
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const day = pickedDay && days.includes(pickedDay) ? pickedDay : days.includes(today) ? today : monday

  const [openBlock, setOpenBlock] = useState<string | null>(null)
  const [placing, setPlacing] = useState<Task | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const taskDrag = useTaskDrag()

  const blocks = useLiveQuery(() => db.blocks.where('date').between(monday, sunday, true, true).toArray(), [monday, sunday]) ?? []
  const openTasks = useLiveQuery(() => db.tasks.where('status').equals('open').toArray(), []) ?? []
  const tasksById = useById(openTasks)
  const doneLinked = useLiveQuery(
    () => db.tasks.bulkGet(blocks.map((b) => b.taskId).filter((id): id is string => !!id)),
    [blocks.map((b) => b.taskId).join()],
  )
  const allTasks = useMemo(() => {
    const m = new Map(tasksById)
    for (const t of doneLinked ?? []) if (t) m.set(t.id, t)
    return m
  }, [tasksById, doneLinked])
  const categories = useById(useCategories(true))

  // в панели: открытые задачи без блока на этой неделе, со сроком не позже воскресенья или без срока
  const scheduled = new Set(blocks.map((b) => b.taskId))
  const panelTasks = openTasks.filter((t) => !scheduled.has(t.id) && (!t.dueDate || t.dueDate <= sunday)).sort(compareOpenTasks)

  const go = (offset: number) => navigate(`week/${addDays(monday, offset * 7)}`)
  const pick = (t: Task) => {
    setPlacing(placing?.id === t.id ? null : t)
    setSheetOpen(false)
  }

  return (
    <Screen
      wide
      title="Неделя"
      subtitle={formatWeekRange(monday)}
      actions={
        <>
          <IconButton icon="chevronLeft" label="Предыдущая неделя" onClick={() => go(-1)} />
          <Button variant="ghost" className="px-2" onClick={() => navigate('week')} disabled={monday === weekStart(today)}>
            Сегодня
          </Button>
          <IconButton icon="chevronRight" label="Следующая неделя" onClick={() => go(1)} />
          <IconButton
            icon="list"
            label="Задачи без времени"
            className={cx((wide ? panelOpen : sheetOpen) && 'bg-surface-2 text-text')}
            onClick={() => (wide ? setPanelOpen(!panelOpen) : setSheetOpen(true))}
          />
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {!wide && (
          <div className="flex shrink-0 gap-1 border-b border-line px-2 py-1.5" role="tablist" aria-label="День недели">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === day}
                onClick={() => setPickedDay(d)}
                className={cx(
                  'flex flex-1 flex-col items-center rounded-lg py-1 text-xs',
                  d === day ? 'bg-accent text-on-accent' : d === today ? 'text-accent' : 'text-muted',
                )}
              >
                {WEEKDAY_SHORT[weekdayOf(d) - 1]}
                <span className="text-sm font-medium">{fromDateStr(d).getDate()}</span>
              </button>
            ))}
          </div>
        )}

        {placing && (
          <div className="flex shrink-0 items-center gap-2 bg-accent-soft px-4 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">Нажмите на время, чтобы поставить «{placing.title}»</span>
            <Button variant="ghost" className="h-7" onClick={() => setPlacing(null)}>
              Отмена
            </Button>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <WeekGrid
            days={wide ? days : [day]}
            today={today}
            blocks={blocks}
            tasks={allTasks}
            categories={categories}
            startHour={settings.calendarStartHour}
            endHour={settings.calendarEndHour}
            placing={placing}
            onPlaced={() => setPlacing(null)}
            onOpenBlock={(b) => setOpenBlock(b.id)}
          />
          {wide && panelOpen && (
            <aside className="w-64 shrink-0 border-l border-line bg-surface">
              <TaskPanel tasks={panelTasks} onPick={pick} picked={placing} today={today} />
            </aside>
          )}
        </div>
      </div>

      {!wide && sheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setSheetOpen(false)}>
          <div className="h-[70dvh] w-full rounded-t-2xl bg-surface pb-safe" onClick={(e) => e.stopPropagation()}>
            <TaskPanel tasks={panelTasks} onPick={pick} picked={placing} today={today} />
          </div>
        </div>
      )}

      {/* задача «в руке» при перетаскивании */}
      {taskDrag && (
        <div
          className="pointer-events-none fixed z-50 max-w-56 truncate rounded-lg bg-text px-3 py-1.5 text-sm text-bg shadow-lg"
          style={{ left: taskDrag.x + 12, top: taskDrag.y + 12 }}
        >
          {taskDrag.task.title}
        </div>
      )}

      {openBlock && <BlockEditor blockId={openBlock} onClose={() => setOpenBlock(null)} />}
    </Screen>
  )
}
