import { useSyncExternalStore } from 'react'
import type { Task } from '../../db/types'

// Задача, которую тянут из боковой панели в календарь. Общее состояние панели и сетки.

export interface TaskDrag {
  task: Task
  x: number
  y: number
}

let current: TaskDrag | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setTaskDrag(d: TaskDrag | null) {
  current = d
  emit()
}

export function getTaskDrag() {
  return current
}

export function useTaskDrag() {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => current,
  )
}
