import { useEffect } from 'react'
import { endsAt, formatClock, remaining } from '../../domain/pomodoro'
import { toast } from '../../ui/toast'
import { pomodoro, usePomodoroState } from './pomodoroStore'
import { chime, notify } from './sound'

/** Работает в фоне на любом экране: замечает конец фазы и показывает остаток в заголовке вкладки. */
export function PomodoroRunner() {
  const st = usePomodoroState()
  const end = st ? endsAt(st) : undefined

  useEffect(() => {
    if (end === undefined) return
    const finish = async () => {
      const r = await pomodoro.tick()
      if (!r.finished) return
      chime()
      const text = r.finished === 'focus' ? 'Фокус закончен — время отдохнуть' : 'Перерыв закончен'
      toast(text, undefined, 8000)
      notify('Ритм', text)
    }
    const timer = setTimeout(finish, Math.max(0, end - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [end])

  // остаток времени в заголовке вкладки
  useEffect(() => {
    if (!st || st.status !== 'running') {
      document.title = 'Ритм'
      return
    }
    const update = () => (document.title = `${formatClock(remaining(st, Date.now()))} · ${st.phase === 'focus' ? 'Фокус' : 'Перерыв'}`)
    update()
    const timer = setInterval(update, 1000)
    return () => {
      clearInterval(timer)
      document.title = 'Ритм'
    }
  }, [st])

  return null
}
