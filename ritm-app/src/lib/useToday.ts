import { useEffect, useState } from 'react'
import { todayStr } from '../domain/dates'

/** Сегодняшняя дата; сама обновляется после полуночи и при возвращении в приложение. */
export function useToday(): string {
  const [today, setToday] = useState(todayStr)
  useEffect(() => {
    const check = () => setToday(todayStr())
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}

/** Текущее время, обновляется раз в минуту. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
