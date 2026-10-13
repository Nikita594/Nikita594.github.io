import { useSyncExternalStore } from 'react'

// Короткие сообщения внизу экрана, например «Задача выполнена · Вернуть».

export interface ToastItem {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(text: string, action?: ToastItem['action'], ms = 4000) {
  const item = { id: nextId++, text, action }
  items = [...items.slice(-2), item]
  emit()
  setTimeout(() => dismiss(item.id), ms)
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export function Toasts() {
  const list = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => items,
  )
  if (!list.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-text px-4 py-2.5 text-sm text-bg shadow-lg"
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="font-semibold text-accent-soft underline-offset-2 hover:underline"
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
