import { useState } from 'react'
import { createTask, type NewTask } from '../../db/tasks'
import { Icon } from '../../ui/icons'

/** Строка «Добавить задачу». defaults — что подставить (список, срок) в зависимости от экрана. */
export function AddTask({ defaults, placeholder = 'Добавить задачу' }: { defaults?: Partial<NewTask>; placeholder?: string }) {
  const [text, setText] = useState('')
  return (
    <form
      className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        void createTask({ ...defaults, title: text })
        setText('')
      }}
    >
      <Icon name="plus" size={18} className="text-accent" />
      <input
        data-quick-add
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label="Новая задача"
        className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
      />
    </form>
  )
}
