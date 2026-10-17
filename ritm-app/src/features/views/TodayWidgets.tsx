import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import type { DateStr, Task } from '../../db/types'
import { totalMinutes } from '../../domain/calendar'
import { formatDuration, formatLongDay, fromDateStr, WEEKDAY_SHORT, weekDays, weekStart } from '../../domain/dates'
import { currentStreak, isScheduled } from '../../domain/habits'
import { elapsed, formatClock, remaining } from '../../domain/pomodoro'
import { plural } from '../../domain/text'
import { href } from '../../lib/router'
import { Button } from '../../ui/kit'
import { CheckCell, useHabitChecks } from '../habits/HabitCells'
import { pomodoro, usePomodoroState } from '../timer/pomodoroStore'
import { unlockSound } from '../timer/sound'

/** Шапка «Сегодня»: дата, сколько задач, сколько запланировано, загрузка недели. */
export function TodayHero({ today, open, done }: { today: DateStr; open: Task[]; done: number }) {
  const monday = weekStart(today)
  const days = weekDays(monday)
  const blocks = useLiveQuery(() => db.blocks.where('date').between(days[0], days[6], true, true).toArray(), [days[0]]) ?? []
  const perDay = days.map((d) => totalMinutes(blocks.filter((b) => b.date === d)))
  const max = Math.max(60, ...perDay)
  const todayBlocks = perDay[days.indexOf(today)] ?? 0
  // запланировано: по календарю, а если там пусто — по длительностям задач
  const planned = todayBlocks || open.reduce((s, t) => s + (t.durationMin ?? 0), 0)
  const n = open.length
  const date = fromDateStr(today)
  return (
    <section className="ui-hero mb-3 flex items-end justify-between gap-4 overflow-hidden px-5 py-5 md:px-7 md:py-6">
      <div className="min-w-0">
        <div className="ui-hero-date mb-1.5 text-sm">
          {formatLongDay(today).replace(',', ' ·')} <span className="sr-only">{date.getFullYear()}</span>
        </div>
        <h1 className="ui-hero-title text-[2rem] leading-[1.05] md:text-[2.6rem]">
          {n ? (
            <>
              Сегодня{' '}
              <b>
                {n}&nbsp;{plural(n, 'задача', 'задачи', 'задач')}
              </b>
            </>
          ) : done ? (
            <>
              Сегодня <b>всё сделано</b>
            </>
          ) : (
            <>
              Сегодня <b>свободно</b>
            </>
          )}
        </h1>
        <p className="ui-hero-sum mt-2 text-sm">
          {planned ? <>Запланировано {formatDuration(planned)}</> : 'Время пока не расписано'}
          {done > 0 && <> · сделано {done}</>}
        </p>
      </div>
      <a
        href={href('week')}
        className="ui-load hidden shrink-0 flex-col items-center gap-1.5 sm:flex"
        aria-label="Загрузка недели — открыть неделю"
      >
        <span className="flex h-16 items-end gap-1.5">
          {days.map((d, i) => (
            <span
              key={d}
              className="ui-load-bar w-3 rounded-full"
              data-today={d === today}
              style={{ height: `${Math.max(10, Math.round((perDay[i] / max) * 100))}%` }}
              title={`${WEEKDAY_SHORT[i]}: ${perDay[i] ? formatDuration(perDay[i]) : 'свободно'}`}
            />
          ))}
        </span>
        <span className="flex gap-1.5 text-[10px] text-faint">
          {days.map((d, i) => (
            <span key={d} className="w-3 text-center" style={d === today ? { color: 'var(--c-text)', fontWeight: 700 } : undefined}>
              {WEEKDAY_SHORT[i][0]}
            </span>
          ))}
        </span>
      </a>
    </section>
  )
}

function useTick(active: boolean) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => set((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [active])
}

/** Мини-таймер на «Сегодня». */
export function FocusWidget() {
  const st = usePomodoroState()
  const task = useLiveQuery(() => (st?.taskId ? db.tasks.get(st.taskId) : undefined), [st?.taskId])
  const cat = useLiveQuery(() => (st?.categoryId ? db.categories.get(st.categoryId) : undefined), [st?.categoryId])
  useTick(st?.status === 'running')
  if (!st) return null
  const now = Date.now()
  const progress = st.durationMs ? elapsed(st, now) / st.durationMs : 0
  const r = 52
  const c = 2 * Math.PI * r
  const label = st.phase === 'focus' ? (task?.title ?? cat?.name ?? 'Фокус') : st.phase === 'short' ? 'Короткий перерыв' : 'Длинный перерыв'
  return (
    <section className="ui-widget p-5" data-kind="focus" aria-label="Таймер">
      <div className="mb-3 flex items-center justify-between text-[11px] font-semibold tracking-[0.12em] uppercase opacity-75">
        <a href={href('timer')}>{st.phase === 'focus' ? 'Фокус' : 'Перерыв'}</a>
        <span>{st.round % 4}&nbsp;/&nbsp;4</span>
      </div>
      <div className="flex items-center gap-4 lg:flex-col">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle className="ui-ring-track" cx="60" cy="60" r={r} fill="none" strokeWidth="9" />
            <circle
              className="ui-ring-bar"
              cx="60"
              cy="60"
              r={r}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - progress)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="ui-display text-[1.6rem] leading-none">{formatClock(remaining(st, now))}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2 lg:items-center">
          <span className="max-w-full truncate text-sm font-medium">{label}</span>
          {st.status === 'running' ? (
            <Button variant="primary" icon="pause" onClick={() => void pomodoro.pause()}>
              Пауза
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="play"
              onClick={() => {
                unlockSound()
                void pomodoro.start()
              }}
            >
              {st.status === 'paused' ? 'Продолжить' : 'Старт'}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

/** Привычки на сегодня с отметкой в одно касание. */
export function HabitsWidget({ today }: { today: DateStr }) {
  const habits = useLiveQuery(
    () =>
      db.habits
        .orderBy('order')
        .filter((h) => !h.archived)
        .toArray(),
    [],
  )
  const checks = useHabitChecks()
  const due = (habits ?? []).filter((h) => isScheduled(h, today))
  if (!checks || !habits) return null
  const doneCount = due.filter((h) => checks.get(h.id)?.has(today)).length
  return (
    <section className="ui-widget p-5" data-kind="habits" aria-label="Привычки на сегодня">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold tracking-[0.12em] uppercase opacity-75">
        <a href={href('habits')}>Привычки</a>
        {due.length > 0 && (
          <span>
            {doneCount}&nbsp;/&nbsp;{due.length}
          </span>
        )}
      </div>
      {!due.length && (
        <p className="text-sm opacity-80">
          {habits.length ? 'Сегодня по расписанию ничего нет.' : 'Привычек пока нет. '}
          {!habits.length && (
            <a href={href('habits')} className="underline underline-offset-2">
              Добавить
            </a>
          )}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {due.map((h) => {
          const set = checks.get(h.id) ?? new Set<string>()
          const streak = currentStreak(h, set, today)
          return (
            <div key={h.id} className="flex items-center gap-3 py-1">
              <CheckCell habit={h} date={today} checked={set.has(today)} size={30} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{h.name}</div>
                <div className="text-xs opacity-75">
                  {streak ? `серия ${streak} ${plural(streak, 'день', 'дня', 'дней')}` : 'серии пока нет'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
