import { describe, expect, it, vi } from 'vitest'
import { matchHotkey, type Hotkey } from './hotkeys'

const run = vi.fn()
const keys: Hotkey[] = [
  { code: 'KeyN', run },
  { code: 'Slash', run },
  { code: 'Slash', shift: true, run },
  { code: 'KeyK', mod: true, run },
]
const ev = (code: string, o: Partial<{ shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({
  code,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...o,
})

describe('горячие клавиши', () => {
  it('по физической клавише: на русской раскладке «т» — это KeyN', () => {
    expect(matchHotkey(ev('KeyN'), keys)).toBe(keys[0])
  })
  it('Shift отличает «?» от «/»', () => {
    expect(matchHotkey(ev('Slash'), keys)).toBe(keys[1])
    expect(matchHotkey(ev('Slash', { shiftKey: true }), keys)).toBe(keys[2])
  })
  it('⌘K и Ctrl+K', () => {
    expect(matchHotkey(ev('KeyK', { metaKey: true }), keys)).toBe(keys[3])
    expect(matchHotkey(ev('KeyK', { ctrlKey: true }), keys)).toBe(keys[3])
    expect(matchHotkey(ev('KeyK'), keys)).toBeUndefined()
  })
  it('с ⌘ одиночные клавиши не срабатывают (⌘N — новое окно браузера)', () => {
    expect(matchHotkey(ev('KeyN', { metaKey: true }), keys)).toBeUndefined()
  })
  it('Alt не перехватываем', () => {
    expect(matchHotkey(ev('KeyN', { altKey: true }), keys)).toBeUndefined()
  })
})
