import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'ghost' | 'soft' | 'danger'

// Цвета кнопок задают дизайны через крючок ui-btn[data-variant] (src/designs).
const variants: Record<Variant, string> = {
  primary: 'hover:opacity-90',
  soft: '',
  ghost: '',
  danger: '',
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
      data-variant={variant}
      className={cx(
        'ui-btn inline-flex h-9 items-center justify-center gap-1.5 px-3 text-sm font-medium transition-colors disabled:opacity-40',
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
      className={cx('ui-iconbtn inline-flex h-9 w-9 shrink-0 items-center justify-center transition-colors', className)}
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
    <div className="ui-overlay fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('ui-modal flex max-h-[92dvh] w-full flex-col shadow-xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton icon="close" label="Закрыть" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line/70 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
    <div className="ui-overlay fixed inset-0 z-40 flex justify-end" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-label={label}
        className="ui-drawer flex h-full w-full flex-col shadow-xl sm:max-w-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </aside>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ui-empty mx-auto max-w-sm px-6 py-16 text-center">
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

export const inputCls = 'ui-input h-9 w-full px-3 text-sm outline-none placeholder:text-faint'

export function ColorDot({ color, size = 10, className }: { color: string; size?: number; className?: string }) {
  return (
    <span className={cx('ui-dot inline-block shrink-0 rounded-full', className)} style={{ background: color, width: size, height: size }} />
  )
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

/**
 * Поле с черновиком для даты, времени и чисел. Пока печатают, значение живёт в черновике:
 * в базу уходит только полное и правильное значение (isComplete), а при уходе с поля неполное откатывается.
 * Без этого поле, связанное напрямую с базой, сбрасывалось бы на каждой цифре (запись в IndexedDB асинхронная).
 */
export function DraftInput({
  value,
  onCommit,
  isComplete = () => true,
  commitEmptyOnBlur = false,
  ...rest
}: {
  value: string
  onCommit: (v: string) => void
  isComplete?: (v: string) => boolean
  /** Пустое поле при уходе с него — это «очистить» (например, убрать время). */
  commitEmptyOnBlur?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'>) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])
  return (
    <input
      {...rest}
      value={draft}
      onFocus={(e) => {
        focused.current = true
        rest.onFocus?.(e)
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        if (e.target.value !== '' && isComplete(e.target.value) && e.target.value !== value) onCommit(e.target.value)
      }}
      onBlur={(e) => {
        focused.current = false
        if (draft === '' && commitEmptyOnBlur && value !== '') onCommit('')
        else if (draft === '' || !isComplete(draft)) setDraft(value)
        rest.onBlur?.(e)
      }}
    />
  )
}

/** Полная дата ГГГГ-ММ-ДД с правдоподобным годом (в Chrome год набирается по цифре: 0002 → 0020 → 0202 → 2027). */
export const isFullDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1970

/** Число в диапазоне. */
export const inRange = (lo: number, hi: number) => (v: string) => /^\d+$/.test(v) && Number(v) >= lo && Number(v) <= hi
