import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import { addEntry, deleteEntry } from '../../db/entries'
import { useById, useCategories } from '../../db/hooks'
import { useSettings } from '../../db/settings'
import type { TimeEntry } from '../../db/types'
import { addDays, formatDuration, formatMinutes, fromDateStr, parseHHMM, toDateStr, todayStr } from '../../domain/dates'
import { elapsed, formatClock, remaining, type Phase } from '../../domain/pomodoro'
import { useToday } from '../../lib/useToday'
import { Button, cx, Empty, Field, IconButton, inputCls, Modal } from '../../ui/kit'
import { Screen } from '../../ui/Screen'
import { toast } from '../../ui/toast'
import { pomodoro, usePomodoroState } from './pomodoroStore'
import { unlockSound } from './sound'

const PHASE_LABEL: Record<Phase, string> = { focus: 'Фокус', short: 'Короткий перерыв', long: 'Длинный перерыв' }

function useTicker(active: boolean, ms = 250) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => set((x) => x + 1), ms)
    return () => clearInterval(t)
  }, [active, ms])
}

function Ring({ progress, children, focus }: { progress: number; children: React.ReactNode; focus: boolean }) {
  const r = 108
  const c = 2 * Math.PI * r
  return (
    <div className="relative mx-auto h-60 w-60">
      <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
        <circle cx="120" cy="120" r={r} fill="none" stroke="var(--c-line)" strokeWidth="10" />
        <circle
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke={focus ? 'var(--c-accent)' : 'var(--c-p1)'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export function TimerScreen() {
  const st = usePomodoroState()
  const settings = useSettings()
  const today = useToday()
  const categories = useCategories()
  const catById = useById(useCategories(true))
  const tasks = useLiveQuery(() => db.tasks.where('status').equals('open').sortBy('title'), []) ?? []
  const allTasks = useById(useLiveQuery(() => db.tasks.toArray(), []) ?? [])
  const dayStart = fromDateStr(today).setHours(0, 0, 0, 0)
  const entries =
    useLiveQuery(
      () =>
        db.entries
          .where('start')
          .between(dayStart, dayStart + 86_400_000, true, false)
          .sortBy('start'),
      [dayStart],
    ) ?? []
  const [manual, setManual] = useState(false)
  useTicker(st?.status === 'running')

  if (!st) return <Screen title="Таймер">{null}</Screen>
  const now = Date.now()
  const left = remaining(st, now)
  const progress = st.durationMs ? elapsed(st, now) / st.durationMs : 0
  // во время длинного перерыва показываем все четыре круга закрашенными
  const longEvery = Math.max(1, settings.pomodoroLongEvery)
  const filledRounds = st.phase === 'long' ? longEvery : st.round % longEvery
  // выбранная задача уже выполнена или удалена — показываем её отдельно, чтобы было видно, куда пишется время
  const targetMissing = !!st.taskId && !tasks.some((t) => t.id === st.taskId)
  const focusToday = entries.reduce((sum, e) => sum + (e.end - e.start), 0)

  const notifyAvailable = typeof Notification !== 'undefined' && Notification.permission === 'default'

  return (
    <Screen
      title="Таймер"
      actions={
        <Button variant="ghost" icon="plus" onClick={() => setManual(true)}>
          Добавить время
        </Button>
      }
    >
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-center text-sm font-medium text-muted">{PHASE_LABEL[st.phase]}</div>
        <Ring progress={progress} focus={st.phase === 'focus'}>
          <div className="text-5xl font-semibold tabular-nums" aria-live="off" data-testid="clock">
            {formatClock(left)}
          </div>
          <div className="mt-2 flex gap-1.5" aria-label={`Фокусов подряд: ${st.round}`}>
            {Array.from({ length: longEvery }, (_, i) => (
              <span key={i} className={cx('h-2 w-2 rounded-full', i < filledRounds ? 'bg-accent' : 'bg-line')} />
            ))}
          </div>
        </Ring>

        <div className="mt-5 flex justify-center gap-2">
          {st.status === 'running' ? (
            <Button variant="soft" icon="pause" className="h-11 px-5" onClick={() => void pomodoro.pause()}>
              Пауза
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="play"
              className="h-11 px-6"
              onClick={() => {
                unlockSound()
                void pomodoro.start()
              }}
            >
              {st.status === 'paused' ? 'Продолжить' : st.phase === 'focus' ? 'Начать фокус' : 'Начать перерыв'}
            </Button>
          )}
          {st.status !== 'idle' && (
            <Button
              variant="ghost"
              icon="stop"
              className="h-11"
              onClick={async () => {
                const r = await pomodoro.stop()
                if (r.record) toast(`Записано ${formatDuration(Math.round((r.record.end - r.record.start) / 60000))}`)
              }}
            >
              Стоп
            </Button>
          )}
          {st.phase !== 'focus' && st.status === 'idle' && (
            <Button variant="ghost" className="h-11" onClick={() => void pomodoro.skipBreak()}>
              Пропустить перерыв
            </Button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Над чем работаю">
            <select
              className={inputCls}
              value={st.taskId ?? ''}
              onChange={(e) => {
                const task = tasks.find((t) => t.id === e.target.value)
                void pomodoro.setTarget(task?.id, task?.categoryId ?? st.categoryId)
              }}
            >
              <option value="">без задачи</option>
              {targetMissing && <option value={st.taskId}>{`${allTasks.get(st.taskId!)?.title ?? 'задача удалена'} (выполнена)`}</option>}
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Категория">
            <select
              className={inputCls}
              value={st.categoryId ?? ''}
              onChange={(e) => void pomodoro.setTarget(st.taskId, e.target.value || undefined)}
            >
              <option value="">без категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {notifyAvailable && (
          <button
            type="button"
            className="mt-3 text-xs text-muted underline-offset-2 hover:underline"
            onClick={() => void Notification.requestPermission()}
          >
            Показывать уведомление, когда время выйдет
          </button>
        )}
      </section>

      <section className="mt-5">
        <div className="mb-1 flex items-baseline justify-between px-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Сегодня</h2>
          {focusToday > 0 && <span className="text-sm text-muted">{formatDuration(Math.round(focusToday / 60000))}</span>}
        </div>
        {!entries.length && <Empty title="Сегодня время ещё не записано">Запустите таймер или добавьте время вручную.</Empty>}
        {entries.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            category={e.categoryId ? catById.get(e.categoryId) : undefined}
            taskTitle={e.taskId ? allTasks.get(e.taskId)?.title : undefined}
          />
        ))}
      </section>

      {manual && <ManualEntry onClose={() => setManual(false)} />}
    </Screen>
  )
}

function EntryRow({ entry, category, taskTitle }: { entry: TimeEntry; category?: { name: string; color: string }; taskTitle?: string }) {
  const start = new Date(entry.start)
  const end = new Date(entry.end)
  const fmt = (d: Date) => formatMinutes(d.getHours() * 60 + d.getMinutes())
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2" data-entry-id={entry.id}>
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: category?.color ?? 'var(--c-faint)' }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{taskTitle ?? category?.name ?? 'Без категории'}</div>
        <div className="text-xs text-muted">
          {fmt(start)}–{fmt(end)} · {formatDuration(Math.round((entry.end - entry.start) / 60000))}
          {taskTitle && category && ` · ${category.name}`} · {entry.source === 'timer' ? 'таймер' : 'вручную'}
        </div>
      </div>
      <IconButton
        icon="trash"
        label="Удалить запись"
        size={16}
        className="opacity-60 group-hover:opacity-100"
        onClick={async () => {
          const undo = await deleteEntry(entry.id)
          toast('Запись удалена', { label: 'Вернуть', run: () => void undo() })
        }}
      />
    </div>
  )
}

/** Ручной ввод «факта»: например, тренировка без телефона. */
export function ManualEntry({ onClose, defaults }: { onClose: () => void; defaults?: Partial<{ categoryId: string; date: string }> }) {
  const categories = useCategories()
  const tasks = useLiveQuery(() => db.tasks.where('status').equals('open').sortBy('title'), []) ?? []
  const now = new Date()
  // по умолчанию — последний час; после полуночи он начался вчера, поэтому день берём от начала
  const endAt = new Date(Math.floor(now.getTime() / 300_000) * 300_000)
  const startAt = new Date(endAt.getTime() - 60 * 60_000)
  const clock = (d: Date) => formatMinutes(d.getHours() * 60 + d.getMinutes())
  const [date, setDate] = useState(defaults?.date ?? toDateStr(startAt))
  const [start, setStart] = useState(clock(startAt))
  const [end, setEnd] = useState(clock(endAt))
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? '')
  const [taskId, setTaskId] = useState('')
  const s = parseHHMM(start)
  const e = parseHHMM(end)
  // конец раньше начала — значит, через полночь
  const minutes = s !== undefined && e !== undefined ? (e > s ? e - s : e + 1440 - s) : 0
  const valid = minutes > 0 && minutes <= 16 * 60

  const save = async () => {
    if (!valid || s === undefined || e === undefined) return
    const base = fromDateStr(date).setHours(0, 0, 0, 0)
    const startMs = base + s * 60_000
    await addEntry({
      start: startMs,
      end: startMs + minutes * 60_000,
      categoryId: categoryId || undefined,
      taskId: taskId || undefined,
      source: 'manual',
    })
    toast(`Добавлено ${formatDuration(minutes)}`)
    onClose()
  }

  return (
    <Modal
      title="Добавить время"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" disabled={!valid} onClick={() => void save()}>
            Добавить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Категория">
          <select className={inputCls} value={categoryId} onChange={(ev) => setCategoryId(ev.target.value)}>
            <option value="">без категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Задача (необязательно)">
          <select
            className={inputCls}
            value={taskId}
            onChange={(ev) => {
              setTaskId(ev.target.value)
              const t = tasks.find((x) => x.id === ev.target.value)
              if (t?.categoryId && !categoryId) setCategoryId(t.categoryId)
            }}
          >
            <option value="">без задачи</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="День">
            <input
              type="date"
              className={inputCls}
              value={date}
              max={addDays(todayStr(), 1)}
              onChange={(ev) => ev.target.value && setDate(ev.target.value)}
            />
          </Field>
          <Field label="С">
            <input type="time" className={inputCls} value={start} onChange={(ev) => setStart(ev.target.value)} />
          </Field>
          <Field label="До">
            <input type="time" className={inputCls} value={end} onChange={(ev) => setEnd(ev.target.value)} />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">
          {valid ? `Будет записано ${formatDuration(minutes)}` : 'Проверьте время: от минуты до 16 часов.'}
        </p>
      </div>
    </Modal>
  )
}
