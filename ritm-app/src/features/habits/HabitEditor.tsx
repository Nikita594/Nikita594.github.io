import { useState } from 'react'
import { createHabit, deleteHabit, toggleCheck, updateHabit } from '../../db/habits'
import type { DateStr, Habit, Weekday } from '../../db/types'
import { addDays, formatDayLabel, fromDateStr, WEEKDAY_SHORT } from '../../domain/dates'
import { bestStreak, completionRate, currentStreak, habitStart, isScheduled, weeksGrid } from '../../domain/habits'
import { ALL_WEEKDAYS } from '../../domain/repeat'
import { days as daysText } from '../../domain/text'
import { useToday } from '../../lib/useToday'
import { Button, ColorPicker, cx, Field, inputCls, Modal, PALETTE } from '../../ui/kit'
import { toast } from '../../ui/toast'

function DaysPicker({ value, onChange }: { value: Weekday[]; onChange: (d: Weekday[]) => void }) {
  const every = value.length === 0 || value.length === 7
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1" role="group" aria-label="Дни недели">
        {ALL_WEEKDAYS.map((d) => {
          const on = every || value.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const current = every ? [...ALL_WEEKDAYS] : value
                const next = on ? current.filter((x) => x !== d) : [...current, d]
                if (next.length) onChange(next.length === 7 ? [] : (next.sort() as Weekday[]))
              }}
              className={cx('h-9 flex-1 rounded-lg text-xs', on ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted')}
            >
              {WEEKDAY_SHORT[d - 1]}
            </button>
          )
        })}
      </div>
      <span className="text-xs text-faint">{every ? 'Каждый день' : 'Только в выбранные дни; остальные дни серию не прерывают'}</span>
    </div>
  )
}

/** Календарь отметок за последние ~12 недель. */
function History({ habit, checks, today }: { habit: Habit; checks: Set<DateStr>; today: DateStr }) {
  const from = [habitStart(habit), addDays(today, -83)].sort()[1]
  const weeks = weeksGrid(from, today)
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-1 text-[10px] leading-4 text-faint">
          {WEEKDAY_SHORT.map((w) => (
            <span key={w} className="h-4">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="flex flex-col gap-1">
            {week.map((d) => {
              const future = d > today || d < habitStart(habit)
              const checked = checks.has(d)
              return (
                <button
                  key={d}
                  type="button"
                  disabled={d > today}
                  title={formatDayLabel(d, today)}
                  aria-label={`${formatDayLabel(d, today)}${checked ? ': отмечено' : ''}`}
                  onClick={() => void toggleCheck(habit.id, d)}
                  className={cx(
                    'h-4 w-4 rounded-sm',
                    !checked && (future ? 'bg-transparent' : isScheduled(habit, d) ? 'bg-line' : 'bg-surface-2'),
                  )}
                  style={{ background: checked ? habit.color : undefined }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-1 text-[11px] text-faint">
        с {fromDateStr(from).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
      </div>
    </div>
  )
}

export function HabitEditor({ habit, checks, onClose }: { habit?: Habit; checks: Set<DateStr>; onClose: () => void }) {
  const today = useToday()
  const [name, setName] = useState(habit?.name ?? '')
  const [color, setColor] = useState(habit?.color ?? PALETTE[0])
  const [days, setDays] = useState<Weekday[]>(habit?.days ?? [])

  const save = async () => {
    if (!name.trim()) return
    if (habit) await updateHabit(habit.id, { name: name.trim(), color, days })
    else await createHabit(name, color, days)
    onClose()
  }

  const stats = habit && {
    current: currentStreak(habit, checks, today),
    best: bestStreak(habit, checks, today),
    rate: completionRate(habit, checks, today),
  }

  return (
    <Modal
      title={habit ? 'Привычка' : 'Новая привычка'}
      onClose={onClose}
      footer={
        <>
          {habit && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={async () => {
                await updateHabit(habit.id, { archived: !habit.archived })
                onClose()
              }}
            >
              {habit.archived ? 'Вернуть из архива' : 'В архив'}
            </Button>
          )}
          <Button variant="primary" disabled={!name.trim()} onClick={() => void save()}>
            {habit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Название">
          <input
            autoFocus={!habit}
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, 20 новых слов"
          />
        </Field>
        <Field label="Когда">
          <DaysPicker value={days} onChange={setDays} />
        </Field>
        <Field label="Цвет">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        {habit && stats && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Серия', daysText(stats.current)],
                ['Лучшая', daysText(stats.best)],
                ['За 30 дней', stats.rate.planned ? `${stats.rate.done} из ${stats.rate.planned}` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface-2 px-2 py-2">
                  <div className="text-sm font-semibold">{value}</div>
                  <div className="text-[11px] text-muted">{label}</div>
                </div>
              ))}
            </div>
            <History habit={habit} checks={checks} today={today} />
            <button
              type="button"
              className="self-start text-xs text-p3 hover:underline"
              onClick={async () => {
                if (!confirm(`Удалить привычку «${habit.name}» вместе со всеми отметками?`)) return
                onClose()
                const undo = await deleteHabit(habit.id)
                toast('Привычка удалена', { label: 'Вернуть', run: () => void undo() })
              }}
            >
              Удалить привычку
            </button>
          </>
        )}
      </form>
    </Modal>
  )
}
