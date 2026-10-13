import { useMemo, useState, type ReactNode } from 'react'
import { db } from '../../db/db'
import { useCategories, useLists } from '../../db/hooks'
import { createTask, type NewTask } from '../../db/tasks'
import { formatDayLabel, formatDuration, formatMinutes } from '../../domain/dates'
import { parseQuickAdd, type QuickAddResult } from '../../domain/quickAdd'
import { describeRepeat } from '../../domain/repeat'
import { PRIORITY_LABELS } from '../../domain/tasks'
import { Icon, type IconName } from '../../ui/icons'
import { cx } from '../../ui/kit'
import { toast } from '../../ui/toast'

function Chip({ icon, children, warn }: { icon: IconName; children: ReactNode; warn?: boolean }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5', warn ? 'bg-surface-2 text-p2' : 'bg-accent-soft text-text')}
    >
      <Icon name={icon} size={12} />
      {children}
    </span>
  )
}

/** Что распознано в строке быстрого ввода — показываем до сохранения. */
export function ParsePreview({ parsed }: { parsed: QuickAddResult }) {
  const cats = useCategories()
  const lists = useLists()
  const chips: ReactNode[] = []
  if (parsed.dueDate)
    chips.push(
      <Chip key="d" icon="calendar">
        {formatDayLabel(parsed.dueDate)}
        {parsed.dueTime !== undefined && ` ${formatMinutes(parsed.dueTime)}`}
      </Chip>,
    )
  if (parsed.repeat)
    chips.push(
      <Chip key="r" icon="repeat">
        {describeRepeat(parsed.repeat)}
      </Chip>,
    )
  if (parsed.durationMin)
    chips.push(
      <Chip key="t" icon="clock">
        {formatDuration(parsed.durationMin)}
      </Chip>,
    )
  if (parsed.priority !== undefined)
    chips.push(
      <Chip key="p" icon="flag">
        {PRIORITY_LABELS[parsed.priority]}
      </Chip>,
    )
  const cat = cats.find((c) => c.id === parsed.categoryId)
  if (cat)
    chips.push(
      <Chip key="c" icon="tag">
        {cat.name}
      </Chip>,
    )
  const list = lists.find((l) => l.id === parsed.listId)
  if (list)
    chips.push(
      <Chip key="l" icon="folder">
        {list.name}
      </Chip>,
    )
  for (const u of parsed.unknown) chips.push(<Chip key={u} icon="tag" warn>{`${u} — такой нет`}</Chip>)
  if (!chips.length) return null
  return <div className="flex flex-wrap gap-1.5 px-3 pb-2 text-xs">{chips}</div>
}

export function useQuickAddParser(text: string) {
  const categories = useCategories()
  const lists = useLists()
  return useMemo(() => parseQuickAdd(text, { categories, lists }), [text, categories, lists])
}

/** Превращает строку быстрого ввода в задачу. defaults — то, что подставляет экран (список, срок). */
export async function createFromQuickAdd(parsed: QuickAddResult, defaults: Partial<NewTask> = {}) {
  const fields: Partial<NewTask> = { ...defaults }
  if (parsed.dueDate) {
    fields.dueDate = parsed.dueDate
    fields.dueTime = parsed.dueTime
  }
  if (parsed.repeat) fields.repeat = parsed.repeat
  if (parsed.durationMin) fields.durationMin = parsed.durationMin
  if (parsed.priority !== undefined) fields.priority = parsed.priority
  if (parsed.categoryId) fields.categoryId = parsed.categoryId
  if (parsed.listId) fields.listId = parsed.listId
  return createTask({ ...fields, title: parsed.title })
}

/** Строка «Добавить задачу» с разбором дат, длительности, приоритета и категории. */
export function AddTask({
  defaults,
  placeholder = 'Добавить задачу',
  autoFocus,
  onCreated,
}: {
  defaults?: Partial<NewTask>
  placeholder?: string
  autoFocus?: boolean
  onCreated?: () => void
}) {
  const [text, setText] = useState('')
  const [help, setHelp] = useState(false)
  const parsed = useQuickAddParser(text)
  return (
    <form
      className="mb-2 rounded-xl border border-line bg-surface focus-within:border-accent"
      onSubmit={async (e) => {
        e.preventDefault()
        const value = text
        if (!value.trim()) return
        // поле очищаем сразу, чтобы можно было печатать следующую задачу, пока эта сохраняется
        setText('')
        // разбираем заново по свежим данным: категории могли ещё не загрузиться, пока печатали
        const fresh = parseQuickAdd(value, { categories: await db.categories.toArray(), lists: await db.lists.toArray() })
        if (!fresh.title) {
          setText(value)
          toast('Добавьте название задачи')
          return
        }
        await createFromQuickAdd(fresh, defaults)
        onCreated?.()
      }}
    >
      <div className="flex items-center gap-2 px-3">
        <Icon name="plus" size={18} className="shrink-0 text-accent" />
        <input
          data-quick-add
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="Новая задача"
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
          className="shrink-0 rounded-md px-1.5 text-xs text-faint hover:text-text"
        >
          Как писать
        </button>
      </div>
      {text.trim() && <ParsePreview parsed={parsed} />}
      {help && <QuickAddHelp />}
    </form>
  )
}

function QuickAddHelp() {
  const rows: [string, string][] = [
    ['завтра, в пятницу, через 3 дня, 20.10', 'срок'],
    ['в 18:00, в 7 вечера, в 9:30', 'время'],
    ['каждый день, по будням, каждую пятницу, каждые 3 дня', 'повтор'],
    ['1ч, 45м, 1ч30м, на 2 часа', 'длительность'],
    ['!1, !2, !3', 'приоритет: высокий, средний, низкий'],
    ['#учёба, #англ', 'категория'],
    ['~школа', 'список'],
  ]
  return (
    <div className="border-t border-line px-3 py-2 text-xs text-muted">
      <p className="mb-1">Пишите в любом порядке, например: «английский завтра в 18:00 1ч !2 #учёба».</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map(([ex, what]) => (
          <div key={ex} className="contents">
            <dt className="text-text">{ex}</dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
