import { useEffect } from 'react'
import type { ThemeSetting } from '../db/settings'
import { getDesign, isDarkMode, type DesignId } from '../designs/designs'

/**
 * Применяет дизайн и тему к <html>: data-design="…" и класс .dark.
 * null — настройки ещё не прочитаны из базы: ничего не трогаем, это уже сделал скрипт в index.html (без мигания).
 */
export function useApplyDesign(designId: DesignId | null, theme: ThemeSetting | null) {
  useEffect(() => {
    if (designId === null || theme === null) return
    const design = getDesign(designId)
    try {
      localStorage.setItem('ritm-design', design.id)
      localStorage.setItem('ritm-theme', theme)
    } catch {
      /* в приватном режиме localStorage может быть недоступен */
    }
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = isDarkMode(design, theme, mq.matches)
      const root = document.documentElement
      root.dataset.design = design.id
      root.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? design.themeColor.dark : design.themeColor.light)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [designId, theme])
}
