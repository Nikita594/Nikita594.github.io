import { uid } from '../lib/id'
import { db } from './db'
import type { DateStr, ID, Minutes, Task, TimeBlock } from './types'

export async function createBlock(input: Omit<TimeBlock, 'id'>): Promise<TimeBlock> {
  const block: TimeBlock = { ...input, id: uid() }
  await db.blocks.add(block)
  return block
}

export async function updateBlock(id: ID, changes: Partial<TimeBlock>) {
  await db.blocks.update(id, changes)
}

/** Удаляет блок; возвращает «вернуть». */
export async function deleteBlock(id: ID): Promise<() => Promise<void>> {
  const block = await db.blocks.get(id)
  await db.blocks.delete(id)
  return async () => {
    if (block) await db.blocks.put(block)
  }
}

/**
 * Задачу перетащили в слот календаря: создаём блок её длительности (или час),
 * а задаче ставим этот день и время начала.
 */
export async function placeTask(task: Task, date: DateStr, startMin: Minutes, dayEnd: Minutes = 24 * 60): Promise<TimeBlock> {
  const len = task.durationMin ?? 60
  const start = Math.min(startMin, dayEnd - Math.min(len, dayEnd))
  return db.transaction('rw', db.blocks, db.tasks, async () => {
    const block = await createBlock({
      date,
      startMin: start,
      endMin: Math.min(dayEnd, start + len),
      taskId: task.id,
      categoryId: task.categoryId,
    })
    await db.tasks.update(task.id, { dueDate: date, dueTime: start, durationMin: task.durationMin ?? len, updatedAt: Date.now() })
    return block
  })
}
