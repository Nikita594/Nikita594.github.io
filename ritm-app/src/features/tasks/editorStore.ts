import { useSyncExternalStore } from 'react'

// Какая задача сейчас открыта в панели редактирования.

let openId: string | null = null
const listeners = new Set<() => void>()

export function openTask(id: string) {
  openId = id
  listeners.forEach((l) => l())
}

export function closeTask() {
  openId = null
  listeners.forEach((l) => l())
}

export function useOpenTaskId() {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => openId,
  )
}
