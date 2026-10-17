import { useState } from 'react'
import { INBOX_ID } from '../db/seed'
import type { NewTask } from '../db/tasks'
import { todayStr } from '../domain/dates'
import { useHotkeys, MOD_LABEL, type Hotkey } from '../lib/hotkeys'
import { navigate, useRoute } from '../lib/router'
import { Modal } from '../ui/kit'
import { toast } from '../ui/toast'
import { AddTask } from '../features/tasks/AddTask'
import { pomodoro } from '../features/timer/pomodoroStore'
import { unlockSound } from '../features/timer/sound'

/** Справка по клавишам: [клавиши, что делают]. Используется и в окне «?», и в настройках. */
export const SHORTCUTS: [string, string][] = [
  ['N', 'Новая задача'],
  [`/  или  ${MOD_LABEL}K`, 'Поиск'],
  ['T  или  1', 'Сегодня'],
  ['2', 'Следующие 7 дней'],
  ['I  или  3', 'Входящие'],
  ['W  или  4', 'Неделя'],
  ['5', 'Таймер'],
  ['P', 'Запустить таймер или поставить на паузу'],
  ['H  или  6', 'Привычки'],
  ['M  или  7', 'Матрица'],
  ['?', 'Эта справка'],
  ['Esc', 'Закрыть окно'],
]

export function ShortcutsTable() {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {SHORTCUTS.map(([k, what]) => (
        <div key={k} className="contents">
          <dt>
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-xs whitespace-pre">{k}</kbd>
          </dt>
          <dd className="text-muted">{what}</dd>
        </div>
      ))}
      <p className="col-span-2 mt-2 text-xs text-faint">Работают и на русской раскладке: N — это та же клавиша, что «Т».</p>
    </dl>
  )
}

/** Глобальные клавиши, окно быстрого добавления и справка. */
export function Shortcuts() {
  const route = useRoute()
  const [adding, setAdding] = useState(false)
  const [help, setHelp] = useState(false)
  const go = (path: string) => () => navigate(path)

  const keys: Hotkey[] = [
    { code: 'KeyN', run: () => setAdding(true) },
    { code: 'Slash', run: go('search') },
    { code: 'KeyK', mod: true, run: go('search') },
    { code: 'KeyT', run: go('today') },
    { code: 'Digit1', run: go('today') },
    { code: 'Digit2', run: go('next7') },
    { code: 'KeyI', run: go('inbox') },
    { code: 'Digit3', run: go('inbox') },
    { code: 'KeyW', run: go('week') },
    { code: 'Digit4', run: go('week') },
    { code: 'Digit5', run: go('timer') },
    { code: 'KeyH', run: go('habits') },
    { code: 'Digit6', run: go('habits') },
    { code: 'KeyM', run: go('matrix') },
    { code: 'Digit7', run: go('matrix') },
    { code: 'Slash', shift: true, run: () => setHelp(true) },
    {
      code: 'KeyP',
      run: async () => {
        unlockSound()
        const { state } = await pomodoro.toggle()
        toast(state.status === 'running' ? 'Таймер запущен' : 'Таймер на паузе')
      },
    },
  ]
  useHotkeys(keys)

  // куда положить новую задачу — зависит от открытого экрана
  const defaults: Partial<NewTask> =
    route.name === 'list'
      ? { listId: route.params[0] }
      : route.name === 'today' || route.name === 'next7'
        ? { dueDate: todayStr() }
        : { listId: INBOX_ID }

  return (
    <>
      {adding && (
        <Modal title="Новая задача" onClose={() => setAdding(false)}>
          <AddTask
            autoFocus
            defaults={defaults}
            onCreated={() => {
              setAdding(false)
              toast('Задача добавлена')
            }}
          />
        </Modal>
      )}
      {help && (
        <Modal title="Горячие клавиши" onClose={() => setHelp(false)}>
          <ShortcutsTable />
        </Modal>
      )}
    </>
  )
}
