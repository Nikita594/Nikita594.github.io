import { useEffect, useState, type ReactNode } from 'react'
import { useSettings } from '../db/settings'
import { href, useRoute, type Route } from '../lib/router'
import { registerServiceWorker, requestPersistentStorage } from '../lib/sw'
import { useApplyTheme } from '../lib/theme'
import { Icon } from '../ui/icons'
import { cx, Empty } from '../ui/kit'
import { Screen } from '../ui/Screen'
import { toast, Toasts } from '../ui/toast'
import { BOTTOM_NAV, TASK_VIEWS, TOOLS } from './nav'
import { Sidebar } from './Sidebar'

function Placeholder({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <Empty title="Скоро здесь что-то будет">Этот раздел появится на одном из следующих шагов.</Empty>
    </Screen>
  )
}

function renderScreen(route: Route): ReactNode {
  const item = [...TASK_VIEWS, ...TOOLS].find((n) => n.route === route.name)
  if (item) return <Placeholder title={item.label} />
  if (route.name === 'settings') return <Placeholder title="Настройки" />
  return <Placeholder title="Ритм" />
}

export function App() {
  const route = useRoute()
  const settings = useSettings()
  const [menuOpen, setMenuOpen] = useState(false)
  useApplyTheme(settings.theme)

  useEffect(() => {
    registerServiceWorker(() => toast('Приложение обновилось', { label: 'Перезагрузить', run: () => location.reload() }, 15000))
    void requestPersistentStorage()
  }, [])

  const addList = () => toast('Списки появятся на следующем шаге')

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
            {n.label}
          </a>
        ))}
        <button type="button" onClick={() => setMenuOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted">
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

      <Toasts />
    </div>
  )
}
