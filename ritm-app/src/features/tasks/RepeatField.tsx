import { updateTask } from '../../db/tasks'
import type { Repeat, Task, Weekday } from '../../db/types'
import { todayStr, WEEKDAY_SHORT, weekdayOf } from '../../domain/dates'
import { ALL_WEEKDAYS, firstOccurrence } from '../../domain/repeat'
import { Icon } from '../../ui/icons'
import { cx } from '../../ui/kit'

const ctl = 'h-8 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent'

/** Правило по умолчанию для выбранного вида повтора. */
function defaultRule(kind: Repeat['kind'], task: Task): Repeat {
  const base = task.dueDate ?? todayStr()
  switch (kind) {
    case 'daily':
      return { kind }
    case 'weekdays':
      return { kind }
    case 'weekly':
      return { kind, days: [weekdayOf(base)] }
    case 'interval':
      return { kind, every: 2 }
    case 'monthly':
      return { kind, day: Number(base.slice(8, 10)) }
  }
}

export function RepeatField({ task }: { task: Task }) {
  const rule = task.repeat
  const setRule = (r: Repeat | undefined) => {
    const changes: Partial<Task> = { repeat: r }
    // у повторяющейся задачи обязательно есть срок
    if (r && !task.dueDate) changes.dueDate = firstOccurrence(r, todayStr()) ?? todayStr()
    void updateTask(task.id, changes)
  }
  const patch = (p: Partial<Repeat>) => rule && setRule({ ...rule, ...p } as Repeat)

  return (
    <div className="flex min-h-10 items-start gap-3 border-b border-line py-1.5">
      <span className="flex h-8 w-[7.5rem] shrink-0 items-center gap-2 text-sm text-muted">
        <Icon name="repeat" size={16} className="shrink-0" />
        Повтор
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <select
          aria-label="Повтор"
          className={cx(ctl, 'self-start')}
          value={rule?.kind ?? ''}
          onChange={(e) => setRule(e.target.value ? defaultRule(e.target.value as Repeat['kind'], task) : undefined)}
        >
          <option value="">не повторять</option>
          <option value="daily">каждый день</option>
          <option value="weekdays">по будням</option>
          <option value="weekly">по дням недели</option>
          <option value="interval">раз в несколько дней</option>
          <option value="monthly">раз в месяц</option>
        </select>

        {rule?.kind === 'weekly' && (
          <div className="flex gap-1" role="group" aria-label="Дни недели">
            {ALL_WEEKDAYS.map((d) => {
              const on = rule.days.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const days = on ? rule.days.filter((x) => x !== d) : [...rule.days, d]
                    if (days.length) patch({ days: days.sort() as Weekday[] })
                  }}
                  className={cx('h-8 w-8 rounded-lg text-xs', on ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted hover:text-text')}
                >
                  {WEEKDAY_SHORT[d - 1]}
                </button>
              )
            })}
          </div>
        )}

        {rule?.kind === 'interval' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            каждые
            <input
              type="number"
              min={1}
              max={365}
              aria-label="Через сколько дней"
              className={cx(ctl, 'w-20')}
              value={rule.every}
              onChange={(e) => Number(e.target.value) >= 1 && patch({ every: Math.min(365, Math.round(Number(e.target.value))) })}
            />
            дн.
          </label>
        )}

        {rule?.kind === 'monthly' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            число месяца
            <input
              type="number"
              min={1}
              max={31}
              aria-label="Число месяца"
              className={cx(ctl, 'w-20')}
              value={rule.day}
              onChange={(e) => {
                const d = Math.round(Number(e.target.value))
                if (d >= 1 && d <= 31) patch({ day: d })
              }}
            />
          </label>
        )}

        {rule && (
          <label className="flex items-center gap-2 text-sm text-muted">
            до
            <input
              type="date"
              aria-label="Повторять до"
              className={cx(ctl, 'w-[8.5rem]')}
              value={rule.until ?? ''}
              onChange={(e) => patch({ until: e.target.value || undefined })}
            />
            {!rule.until && <span className="text-xs text-faint">без конца</span>}
          </label>
        )}
      </div>
    </div>
  )
}
