import { useEffect } from 'react'
import type { ThemeSetting } from '../db/settings'

/**
 * Применяет тему к <html> и следит за системной темой, если выбрано «как в системе».
 * null — настройка ещё не прочитана из базы: ничего не трогаем, тему уже поставил скрипт в index.html.
 */
export function useApplyTheme(theme: ThemeSetting | null) {
  useEffect(() => {
    if (theme === null) return
    try {
      localStorage.setItem('ritm-theme', theme)
    } catch {
      /* в приватном режиме localStorage может быть недоступен */
    }
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121413' : '#f6f5f2')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
