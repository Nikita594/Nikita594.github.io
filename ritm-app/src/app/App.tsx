import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { ThemeSetting } from '../db/settings'
import { href, useRoute, type Route } from '../lib/router'
import { registerServiceWorker, requestPersistentStorage } from '../lib/sw'
import { useApplyTheme } from '../lib/theme'
import { Icon } from '../ui/icons'
import { cx, Empty } from '../ui/kit'
import { Screen } from '../ui/Screen'
import { toast, Toasts } from '../ui/toast'
import { BOTTOM_NAV, TASK_VIEWS, TOOLS } from './nav'
import { BackupReminder } from '../features/backup/BackupReminder'
import { Shortcuts } from './Shortcuts'
import { Sidebar } from './Sidebar'
import { INBOX_ID } from '../db/seed'
import { ListEditor } from '../features/lists/ListEditor'
import { ListScreen } from '../features/lists/ListScreen'
import { SearchScreen } from '../features/search/SearchScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TaskEditorHost } from '../features/tasks/TaskEditor'
import { DoneScreen } from '../features/views/DoneScreen'
import { WeekScreen } from '../features/calendar/WeekScreen'
import { PomodoroRunner } from '../features/timer/PomodoroRunner'
import { useTimerLabel } from '../features/timer/TimerBadge'
import { TimerScreen } from '../features/timer/TimerScreen'
import { HabitsScreen } from '../features/habits/HabitsScreen'
import { MatrixScreen } from '../features/matrix/MatrixScreen'
import { Next7Screen } from '../features/views/Next7Screen'
import { TodayScreen } from '../features/views/TodayScreen'

function Placeholder({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <Empty title="Скоро здесь что-то будет">Этот раздел появится на одном из следующих шагов.</Empty>
    </Screen>
  )
}

function renderScreen(route: Route): ReactNode {
  switch (route.name) {
    case 'today':
      return <TodayScreen />
    case 'next7':
      return <Next7Screen />
    case 'done':
      return <DoneScreen />
    case 'week':
      return <WeekScreen />
    case 'timer':
      return <TimerScreen />
    case 'habits':
      return <HabitsScreen />
    case 'matrix':
      return <MatrixScreen />
    case 'inbox':
      return <ListScreen listId={INBOX_ID} />
    case 'list':
      return <ListScreen key={route.params[0]} listId={route.params[0]} />
    case 'search':
      return <SearchScreen />
    case 'settings':
      return <SettingsScreen />
  }
  const item = [...TASK_VIEWS, ...TOOLS].find((n) => n.route === route.name)
  return <Placeholder title={item?.label ?? 'Ритм'} />
}

export function App() {
  const route = useRoute()
  // null, пока не прочитали из базы (иначе на миг применилась бы тема по умолчанию)
  const theme = useLiveQuery(async () => ((await db.settings.get('theme'))?.value as ThemeSetting | undefined) ?? 'system', [], null)
  const [menuOpen, setMenuOpen] = useState(false)
  const timerLabel = useTimerLabel()
  useApplyTheme(theme)

  useEffect(() => {
    registerServiceWorker(() => toast('Приложение обновилось', { label: 'Перезагрузить', run: () => location.reload() }, 15000))
    void requestPersistentStorage()
  }, [])

  const [addingList, setAddingList] = useState(false)
  const addList = () => {
    setMenuOpen(false)
    setAddingList(true)
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:block">
        <Sidebar onAddList={addList} />
      </aside>

      <main className="min-w-0 flex-1">{renderScreen(route)}</main>

      {/* Нижняя панель на телефоне */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur pb-safe md:hidden"
        aria-label="Быстрые разделы"
      >
        {BOTTOM_NAV.map((n) => (
          <a
            key={n.route}
            href={href(n.route)}
            className={cx(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
              route.name === n.route ? 'text-accent' : 'text-muted',
            )}
          >
            <Icon name={n.icon} size={22} />
            <span className="tabular-nums">{n.route === 'timer' && timerLabel ? timerLabel : n.label}</span>
          </a>
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted"
        >
          <Icon name="menu" size={22} />
          Ещё
        </button>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="h-full w-72 max-w-[85%] bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setMenuOpen(false)} onAddList={addList} />
          </div>
        </div>
      )}

      <TaskEditorHost />
      <PomodoroRunner />
      <Shortcuts />
      <BackupReminder />
      {addingList && <ListEditor onClose={() => setAddingList(false)} />}
      <Toasts />
    </div>
  )
}
