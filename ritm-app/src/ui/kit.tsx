import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'ghost' | 'soft' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  soft: 'bg-surface-2 text-text hover:bg-line',
  ghost: 'text-muted hover:bg-surface-2 hover:text-text',
  danger: 'text-p3 hover:bg-surface-2',
}

export function Button({
  variant = 'soft',
  icon,
  className,
  children,
  ...rest
}: { variant?: Variant; icon?: IconName } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className,
  size = 20,
  ...rest
}: { icon: IconName; label: string; size?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

/** Закрытие по Esc для всплывающих окон. Последнее открытое окно закрывается первым. */
const escStack: (() => void)[] = []
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && escStack.length) {
      e.preventDefault()
      e.stopImmediatePropagation()
      escStack[escStack.length - 1]()
    }
  })
}
export function useEscape(onClose: () => void, active = true) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (!active) return
    const fn = () => ref.current()
    escStack.push(fn)
    return () => {
      const i = escStack.lastIndexOf(fn)
      if (i >= 0) escStack.splice(i, 1)
    }
  }, [active])
}

/** Окно по центру; на телефоне — лист снизу. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton icon="close" label="Закрыть" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Панель справа (на телефоне — на весь экран). */
export function Drawer({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-label={label}
        className="flex h-full w-full flex-col bg-surface shadow-xl sm:max-w-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </aside>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-16 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-accent'

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: color, width: size, height: size }} />
}

export const PALETTE = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#64748b']

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Цвет ${c}`}
          onClick={() => onChange(c)}
          className={cx('h-7 w-7 rounded-full ring-offset-2 ring-offset-surface', value === c && 'ring-2 ring-text')}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}
