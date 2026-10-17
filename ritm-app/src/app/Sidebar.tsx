import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { INBOX_ID } from '../db/seed'
import { href, useRoute } from '../lib/router'
import { Icon, type IconName } from '../ui/icons'
import { ColorDot } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { TASK_VIEWS, TOOLS } from './nav'
import { useTimerLabel } from '../features/timer/TimerBadge'

function NavLink({
  to,
  icon,
  label,
  active,
  color,
  badge,
  onNavigate,
}: {
  to: string
  icon?: IconName
  label: string
  active: boolean
  color?: string
  badge?: string | null
  onNavigate?: () => void
}) {
  return (
    <a
      href={href(to)}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className="ui-nav-item flex h-9 items-center gap-3 px-3 text-sm"
    >
      {icon ? (
        <Icon name={icon} size={18} />
      ) : (
        <span className="flex w-[18px] justify-center">
          <ColorDot color={color!} className="ui-dot" />
        </span>
      )}
      <span className="truncate">{label}</span>
      {badge && <span className="ml-auto text-xs text-accent tabular-nums">{badge}</span>}
    </a>
  )
}

export function Sidebar({ onNavigate, onAddList }: { onNavigate?: () => void; onAddList: () => void }) {
  const route = useRoute()
  const lists = useLiveQuery(() => db.lists.orderBy('order').toArray(), [])
  const isActive = (r: string) => route.name === r
  const timer = useTimerLabel()
  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-label="Разделы">
      <div className="ui-brand mb-2 flex items-center gap-2 px-3 pt-1">
        <Logo />
        <span className="text-lg font-semibold tracking-tight">Ритм</span>
      </div>
      <a href={href('search')} onClick={onNavigate} className="ui-search mb-2 flex h-9 items-center gap-2 px-3 text-sm">
        <Icon name="search" size={16} />
        Поиск
        <kbd className="ml-auto rounded border border-line px-1.5 text-[11px]">/</kbd>
      </a>
      {TASK_VIEWS.map((n) => (
        <NavLink key={n.route} to={n.route} icon={n.icon} label={n.label} active={isActive(n.route)} onNavigate={onNavigate} />
      ))}
      <div className="my-2 border-t border-line" />
      {TOOLS.map((n) => (
        <NavLink
          key={n.route}
          to={n.route}
          icon={n.icon}
          label={n.label}
          active={isActive(n.route)}
          badge={n.route === 'timer' ? timer : undefined}
          onNavigate={onNavigate}
        />
      ))}
      <div className="mt-3 mb-1 flex items-center justify-between px-3">
        <span className="ui-nav-label text-xs font-medium tracking-wide uppercase">Списки</span>
        <button
          type="button"
          onClick={onAddList}
          className="rounded p-1 text-faint hover:bg-surface-2 hover:text-text"
          aria-label="Новый список"
          title="Новый список"
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      {lists
        ?.filter((l) => l.id !== INBOX_ID)
        .map((l) => (
          <NavLink
            key={l.id}
            to={`list/${l.id}`}
            label={l.name}
            color={l.color}
            active={route.name === 'list' && route.params[0] === l.id}
            onNavigate={onNavigate}
          />
        ))}
      <div className="mt-auto pt-3">
        <NavLink to="settings" icon="settings" label="Настройки" active={isActive('settings')} onNavigate={onNavigate} />
      </div>
    </nav>
  )
}
