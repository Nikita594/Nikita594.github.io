import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createBlock, placeTask, updateBlock } from '../../db/blocks'
import type { Category, DateStr, Minutes, Task, TimeBlock } from '../../db/types'
import { dragRange, layoutOverlaps, moveSpan, resizeEnd, totalMinutes, visibleHours } from '../../domain/calendar'
import { formatDuration, formatMinutes, fromDateStr, minutesNow, WEEKDAY_SHORT, weekdayOf } from '../../domain/dates'
import { useNow } from '../../lib/useToday'
import { cx } from '../../ui/kit'
import { getTaskDrag, setTaskDrag, useTaskDrag } from './taskDrag'

const HOUR_PX = 48
const PPM = HOUR_PX / 60 // пикселей в минуте
const NO_CATEGORY_COLOR = '#64748b'

type Drag =
  | { kind: 'create'; date: DateStr; anchor: Minutes; cur: Minutes }
  | {
      kind: 'move'
      block: TimeBlock
      grab: Minutes
      date: DateStr
      startMin: Minutes
      endMin: Minutes
      moved: boolean
      x0: number
      y0: number
    }
  | { kind: 'resize'; block: TimeBlock; endMin: Minutes }

export interface WeekGridProps {
  days: DateStr[]
  today: DateStr
  blocks: TimeBlock[]
  tasks: Map<string, Task>
  categories: Map<string, Category>
  startHour: number
  endHour: number
  /** Задача, выбранная для расстановки нажатием (на телефоне). */
  placing: Task | null
  onPlaced: () => void
  onOpenBlock: (block: TimeBlock) => void
}

export function WeekGrid({
  days,
  today,
  blocks,
  tasks,
  categories,
  startHour: setStart,
  endHour: setEnd,
  placing,
  onPlaced,
  onOpenBlock,
}: WeekGridProps) {
  // блоки раньше или позже часов из настроек не прячем: сетка расширяется, чтобы их было видно
  const { startHour, endHour } = visibleHours(
    setStart,
    setEnd,
    blocks.filter((b) => days.includes(b.date)),
  )
  const dayStart = startHour * 60
  const dayEnd = endHour * 60
  const scrollRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef<(HTMLDivElement | null)[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Чем нажали последний раз: в Safari у click нет pointerType, поэтому запоминаем сами. */
  const lastPointer = useRef('mouse')
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  const taskDrag = useTaskDrag()
  const now = useNow(30_000)

  // при открытии прокручиваем к текущему часу (или к 8 утра)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = days.includes(today) ? minutesNow(now) - 90 : 8 * 60
    el.scrollTop = Math.max(0, (target - dayStart) * PPM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]])

  /** Где на сетке точка экрана: день и минуты (без округления). */
  const hit = (x: number, y: number): { date: DateStr; min: number } | null => {
    for (let i = 0; i < days.length; i++) {
      const el = colRefs.current[i]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x < r.right) return { date: days[i], min: dayStart + (y - r.top) / PPM }
    }
    return null
  }

  /** Как hit, но только в видимой части сетки (под шапкой дней): чтобы нельзя было «бросить» задачу в невидимое время. */
  const hitVisible = (x: number, y: number) => {
    const el = scrollRef.current
    if (!el) return null
    const header = el.firstElementChild?.getBoundingClientRect().bottom ?? el.getBoundingClientRect().top
    if (y < header || y > el.getBoundingClientRect().bottom) return null
    return hit(x, y)
  }

  const autoScroll = (y: number) => {
    const el = scrollRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (y < r.top + 40) el.scrollTop -= 12
    else if (y > r.bottom - 40) el.scrollTop += 12
  }

  // Перетаскивание блоков и выделение нового — слушаем окно, пока тянем.
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      autoScroll(e.clientY)
      const h = hit(e.clientX, e.clientY)
      if (d.kind === 'create') {
        if (h && h.date === d.date) setDrag({ ...d, cur: h.min })
      } else if (d.kind === 'resize') {
        const col = colRefs.current[days.indexOf(d.block.date)]
        if (!col) return
        const min = dayStart + (e.clientY - col.getBoundingClientRect().top) / PPM
        setDrag({ ...d, endMin: resizeEnd(d.block.startMin, min, dayEnd) })
      } else if (d.kind === 'move') {
        const moved = d.moved || Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) > 5
        if (!moved || !h) return
        const span = moveSpan(d.block.startMin, d.block.endMin, h.min - d.grab - d.block.startMin, dayStart, dayEnd)
        setDrag({ ...d, moved, date: h.date, ...span })
      }
    }
    const onUp = () => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      if (d.kind === 'create') {
        const click = Math.abs(d.cur - d.anchor) < 8
        const range = click ? clickRange(d.anchor) : dragRange(d.anchor, d.cur, dayStart, dayEnd)
        void createBlock({ date: d.date, ...range }).then(onOpenBlock)
      } else if (d.kind === 'resize') {
        if (d.endMin > d.block.startMin) void updateBlock(d.block.id, { endMin: d.endMin })
      } else if (d.kind === 'move') {
        if (!d.moved) onOpenBlock(d.block)
        else
          void updateBlock(d.block.id, {
            date: d.date,
            startMin: d.startMin,
            endMin: d.endMin,
          })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  // Задачу тянут из панели: показываем, куда встанет, и ставим при отпускании.
  useEffect(() => {
    if (!taskDrag) return
    const onMove = (e: PointerEvent) => {
      const d = getTaskDrag()
      if (d) setTaskDrag({ ...d, x: e.clientX, y: e.clientY })
      autoScroll(e.clientY)
    }
    const onUp = (e: PointerEvent) => {
      const d = getTaskDrag()
      setTaskDrag(null)
      const h = hitVisible(e.clientX, e.clientY)
      if (d && h) void placeTask(d.task, h.date, slotStart(h.min), dayEnd)
    }
    const onCancel = () => setTaskDrag(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskDrag !== null])

  /** Начало слота под пальцем/курсором: округляем вниз до 15 минут. */
  const slotStart = (min: number) => Math.max(dayStart, Math.min(dayEnd - 15, Math.floor(min / 15) * 15))
  /** Простой клик по пустому месту — блок на час, начиная с получаса под курсором. */
  const clickRange = (min: number) => {
    const start = Math.max(dayStart, Math.min(dayEnd - 60, Math.floor(min / 30) * 30))
    return { startMin: start, endMin: Math.min(dayEnd, start + 60) }
  }

  const onColumnDown = (date: DateStr) => (e: ReactPointerEvent) => {
    lastPointer.current = e.pointerType
    if (e.button !== 0 || e.target !== e.currentTarget) return
    const h = hit(e.clientX, e.clientY)
    if (!h) return
    if (placing) {
      // пальцем — только по нажатию (click): иначе первое касание при прокрутке поставило бы задачу
      if (e.pointerType !== 'touch') void placeTask(placing, date, slotStart(h.min), dayEnd).then(onPlaced)
      return
    }
    // на сенсорном экране тянуть по пустому месту — это прокрутка; блок создаём по нажатию (click)
    if (e.pointerType === 'touch') return
    e.preventDefault()
    setDrag({ kind: 'create', date, anchor: h.min, cur: h.min })
  }

  const onColumnClick = (date: DateStr) => (e: React.MouseEvent) => {
    // только для касаний: мышь обрабатывается через pointerdown/up
    if (lastPointer.current !== 'touch' || e.target !== e.currentTarget) return
    const h = hit(e.clientX, e.clientY)
    if (!h) return
    if (placing) void placeTask(placing, date, slotStart(h.min), dayEnd).then(onPlaced)
    else void createBlock({ date, ...clickRange(h.min) }).then(onOpenBlock)
  }

  const onBlockDown = (block: TimeBlock) => (e: ReactPointerEvent) => {
    lastPointer.current = e.pointerType
    if (e.button !== 0) return
    e.stopPropagation()
    if (e.pointerType === 'touch') return // на телефоне блок открывается по нажатию, двигается за ручку
    const h = hit(e.clientX, e.clientY)
    if (!h) return
    e.preventDefault()
    setDrag({
      kind: 'move',
      block,
      grab: h.min - block.startMin,
      date: block.date,
      startMin: block.startMin,
      endMin: block.endMin,
      moved: false,
      x0: e.clientX,
      y0: e.clientY,
    })
  }

  const onHandleDown = (block: TimeBlock, kind: 'resize' | 'move') => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    if (kind === 'resize') setDrag({ kind: 'resize', block, endMin: block.endMin })
    else {
      const h = hit(e.clientX, e.clientY)
      if (h)
        setDrag({
          kind: 'move',
          block,
          grab: h.min - block.startMin,
          date: block.date,
          startMin: block.startMin,
          endMin: block.endMin,
          moved: true,
          x0: e.clientX,
          y0: e.clientY,
        })
    }
  }

  // Блоки с учётом того, что сейчас тянут
  const shown = useMemo(() => {
    let list = blocks
    if (drag?.kind === 'move' && drag.moved)
      list = list.map((b) =>
        b.id === drag.block.id
          ? {
              ...b,
              date: drag.date,
              startMin: drag.startMin,
              endMin: drag.endMin,
            }
          : b,
      )
    if (drag?.kind === 'resize') list = list.map((b) => (b.id === drag.block.id ? { ...b, endMin: drag.endMin } : b))
    return list
  }, [blocks, drag])

  const taskHit = taskDrag ? hitVisible(taskDrag.x, taskDrag.y) : null
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const height = (dayEnd - dayStart) * PPM
  const nowMin = minutesNow(now)

  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto select-none" data-week-grid>
      {/* Заголовки дней */}
      <div className="sticky top-0 z-20 flex border-b border-line bg-bg/95 backdrop-blur">
        <div className="w-12 shrink-0" />
        {days.map((d) => {
          const planned = totalMinutes(shown.filter((b) => b.date === d))
          return (
            <div key={d} className="min-w-0 flex-1 border-l border-line px-1 py-1.5 text-center">
              {days.length === 1 ? (
                <div className="text-xs text-muted">
                  {planned ? `Запланировано ${formatDuration(planned)}` : 'Пока ничего не запланировано'}
                </div>
              ) : (
                <>
                  <div className={cx('text-xs', d === today ? 'font-semibold text-accent' : 'text-muted')}>
                    {WEEKDAY_SHORT[weekdayOf(d) - 1]}{' '}
                    <span
                      className={cx(
                        'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm',
                        d === today && 'bg-accent text-on-accent',
                      )}
                    >
                      {fromDateStr(d).getDate()}
                    </span>
                  </div>
                  <div className="h-4 text-[11px] text-faint">{planned ? formatDuration(planned) : ''}</div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex" style={{ height }}>
        {/* Часы */}
        <div className="relative w-12 shrink-0">
          {hours.map((h) => (
            <div key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-faint" style={{ top: (h * 60 - dayStart) * PPM }}>
              {h > startHour ? `${h}:00` : ''}
            </div>
          ))}
        </div>

        {days.map((date, i) => {
          const dayBlocks = shown.filter((b) => b.date === date)
          const layout = layoutOverlaps(dayBlocks)
          return (
            <div
              key={date}
              ref={(el) => {
                colRefs.current[i] = el
              }}
              data-date={date}
              onPointerDown={onColumnDown(date)}
              onClick={onColumnClick(date)}
              className={cx(
                'relative min-w-0 flex-1 border-l border-line',
                placing ? 'cursor-copy' : 'cursor-crosshair',
                date === today && 'bg-accent-soft/30',
              )}
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, var(--c-line) 0, var(--c-line) 1px, transparent 1px, transparent ${HOUR_PX}px)`,
              }}
            >
              {dayBlocks.map((b) => {
                const place = layout.get(b.id)!
                const task = b.taskId ? tasks.get(b.taskId) : undefined
                const cat = b.categoryId ? categories.get(b.categoryId) : undefined
                const color = cat?.color ?? NO_CATEGORY_COLOR
                const title = task?.title ?? b.title ?? cat?.name ?? 'Без названия'
                const h = (b.endMin - b.startMin) * PPM
                const active = drag && 'block' in drag && drag.block.id === b.id
                return (
                  <div
                    key={b.id}
                    data-block-id={b.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${title}, ${formatMinutes(b.startMin)}–${formatMinutes(b.endMin)}`}
                    onPointerDown={onBlockDown(b)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (lastPointer.current === 'touch') onOpenBlock(b)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && onOpenBlock(b)}
                    className={cx(
                      'group absolute overflow-hidden rounded-md border-l-[3px] px-1.5 text-xs leading-tight',
                      active ? 'z-10 shadow-lg' : 'cursor-grab',
                      task?.status === 'done' && 'opacity-60',
                    )}
                    style={{
                      top: (b.startMin - dayStart) * PPM + 1,
                      height: Math.max(h - 2, 10),
                      left: `calc(${(place.col / place.cols) * 100}% + 1px)`,
                      width: `calc(${100 / place.cols}% - 3px)`,
                      background: color + '2e',
                      borderLeftColor: color,
                    }}
                  >
                    <div className={cx('truncate pt-0.5 font-medium', task?.status === 'done' && 'line-through')}>{title}</div>
                    {h >= 34 && (
                      <div className="truncate text-[11px] text-muted">
                        {formatMinutes(b.startMin)}–{formatMinutes(b.endMin)}
                      </div>
                    )}
                    {/* ручка переноса (для пальца) */}
                    <div
                      aria-hidden
                      onPointerDown={onHandleDown(b, 'move')}
                      className="absolute top-0 right-0 hidden h-5 w-5 cursor-move touch-none items-center justify-center text-muted md:group-hover:flex [@media(pointer:coarse)]:flex"
                    >
                      ⠿
                    </div>
                    {/* ручка длины */}
                    <div
                      aria-hidden
                      onPointerDown={onHandleDown(b, 'resize')}
                      className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none [@media(pointer:coarse)]:h-3"
                    >
                      <div className="mx-auto mt-0.5 h-1 w-6 rounded-full bg-current opacity-0 group-hover:opacity-30 [@media(pointer:coarse)]:opacity-30" />
                    </div>
                  </div>
                )
              })}

              {/* выделение нового блока */}
              {drag?.kind === 'create' && drag.date === date && (
                <Ghost {...dragRange(drag.anchor, drag.cur, dayStart, dayEnd)} dayStart={dayStart} />
              )}

              {/* куда встанет перетаскиваемая задача */}
              {taskDrag && taskHit?.date === date && (
                <Ghost
                  startMin={slotStart(taskHit.min)}
                  endMin={Math.min(dayEnd, slotStart(taskHit.min) + (taskDrag.task.durationMin ?? 60))}
                  dayStart={dayStart}
                  label={taskDrag.task.title}
                />
              )}

              {/* линия «сейчас» */}
              {date === today && nowMin >= dayStart && nowMin <= dayEnd && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (nowMin - dayStart) * PPM }}>
                  <div className="h-0.5 bg-p3" />
                  <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-p3" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Ghost({ startMin, endMin, dayStart, label }: { startMin: number; endMin: number; dayStart: number; label?: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-dashed border-accent bg-accent-soft/70 px-1.5 text-xs"
      style={{
        top: (startMin - dayStart) * PPM,
        height: (endMin - startMin) * PPM,
      }}
    >
      <div className="truncate pt-0.5 font-medium">{label ?? 'Новый блок'}</div>
      <div className="text-[11px] text-muted">
        {formatMinutes(startMin)}–{formatMinutes(endMin)}
      </div>
    </div>
  )
}
