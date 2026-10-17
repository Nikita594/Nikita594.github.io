import { useEffect, useRef } from 'react'

// Горячие клавиши по физической клавише (event.code), поэтому работают и на русской раскладке:
// «N» и «Т» — одна и та же кнопка KeyN.

export interface Hotkey {
  /** event.code: 'KeyN', 'Slash', 'Digit1'… */
  code: string
  shift?: boolean
  /** ⌘ на Mac или Ctrl на Windows. */
  mod?: boolean
  run: () => void
}

/** Сейчас печатают текст — одиночные буквы не перехватываем. */
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function matchHotkey(
  e: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>,
  keys: Hotkey[],
): Hotkey | undefined {
  if (e.altKey) return undefined
  const mod = e.metaKey || e.ctrlKey
  return keys.find((k) => k.code === e.code && !!k.shift === e.shiftKey && !!k.mod === mod)
}

export function useHotkeys(keys: Hotkey[], enabled = true) {
  const ref = useRef(keys)
  ref.current = keys
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented) return
      const hit = matchHotkey(e, ref.current)
      if (!hit) return
      // с ⌘/Ctrl срабатывает и в поле ввода (⌘K), одиночные клавиши — нет
      if (!hit.mod && isTyping(e.target)) return
      // открыто окно — клавиши разделов не трогаем
      if (!hit.mod && document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      hit.run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

/** Подписи для справки: «⌘K» на Mac, «Ctrl+K» в остальных. */
export const MOD_LABEL = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
