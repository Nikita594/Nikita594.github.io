import type { ReactNode } from 'react'

/** Каркас экрана: заголовок с кнопками и прокручиваемое содержимое. */
export function Screen({
  title,
  subtitle,
  actions,
  children,
  wide,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>
      {wide ? (
        // экран сам управляет прокруткой (календарь); снизу оставляем место под панель навигации телефона
        <div className="min-h-0 flex-1 overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="mx-auto w-full max-w-3xl px-3 py-3 md:px-6 md:py-5">{children}</div>
        </div>
      )}
    </div>
  )
}
