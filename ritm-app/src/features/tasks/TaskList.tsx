import { useState, type ReactNode } from 'react'
import { useById, useCategories, useLists } from '../../db/hooks'
import type { Task } from '../../db/types'
import { Icon } from '../../ui/icons'
import { cx } from '../../ui/kit'
import { TaskRow } from './TaskRow'

export function TaskList({ tasks, showList, hideDate }: { tasks: Task[]; showList?: boolean; hideDate?: boolean }) {
  const lists = useById(useLists())
  const cats = useById(useCategories(true))
  return (
    <div className="flex flex-col">
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          list={lists.get(t.listId)}
          category={t.categoryId ? cats.get(t.categoryId) : undefined}
          showList={showList}
          hideDate={hideDate}
        />
      ))}
    </div>
  )
}

/** Раздел со сворачиваемым заголовком. */
export function Section({
  title,
  count,
  defaultOpen = true,
  children,
  extra,
}: {
  title: ReactNode
  count?: number
  defaultOpen?: boolean
  children: ReactNode
  extra?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="mt-3 first:mt-0">
      <div className="flex items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-1.5 py-1.5 text-left text-xs font-semibold tracking-wide text-muted uppercase"
          aria-expanded={open}
        >
          <Icon name="chevronDown" size={14} className={cx('transition-transform', !open && '-rotate-90')} />
          {title}
          {count !== undefined && <span className="font-normal text-faint">{count}</span>}
        </button>
        {extra}
      </div>
      {open && children}
    </section>
  )
}
