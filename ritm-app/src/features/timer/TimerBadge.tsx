import { useEffect, useState } from 'react'
import { formatClock, remaining } from '../../domain/pomodoro'
import { usePomodoroState } from './pomodoroStore'

/** Остаток времени для меню, пока таймер идёт. */
export function useTimerLabel(): string | null {
  const st = usePomodoroState()
  const [, tick] = useState(0)
  const running = st?.status === 'running'
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  if (!st || st.status === 'idle') return null
  return formatClock(remaining(st, Date.now())) + (st.status === 'paused' ? ' ⏸' : '')
}
