import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
  )
}

/** Ширина как у планшета и компьютера (≥ 768 px). */
export const useIsWide = () => useMediaQuery('(min-width: 768px)')
