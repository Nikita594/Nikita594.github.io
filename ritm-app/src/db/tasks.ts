import { uid } from '../lib/id'
import { db } from './db'
import { INBOX_ID } from './seed'
import type { ID, List, Subtask, Task } from './types'

// Все изменения задач и списков — через эти функции, чтобы правила были в одном месте.

export type NewTask = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> & { title: string }

export async function createTask(input: NewTask): Promise<Task> {
  const now = Date.now()
  const task: Task = {
    note: '',
    listId: INBOX_ID,
    priority: 0,
    subtasks: [],
    status: 'open',
    order: now,
    ...input,
    title: input.title.trim(),
    id: uid(),
    createdAt: now,
    updatedAt: now,
  }
  await db.tasks.add(task)
  return task
}

export async function updateTask(id: ID, changes: Partial<Task>) {
  await db.tasks.update(id, { ...changes, updatedAt: Date.now() })
}

/** Удаляет задачу и всё, что на неё ссылается. Возвращает функцию «вернуть». */
export async function deleteTask(id: ID): Promise<() => Promise<void>> {
  return db.transaction('rw', db.tasks, db.blocks, async () => {
    const task = await db.tasks.get(id)
    const blocks = await db.blocks.where('taskId').equals(id).toArray()
    await db.tasks.delete(id)
    await db.blocks.bulkUpdate(blocks.map((b) => ({ key: b.id, changes: { taskId: undefined } })))
    return async () => {
      if (!task) return
      await db.transaction('rw', db.tasks, db.blocks, async () => {
        await db.tasks.put(task)
        await db.blocks.bulkUpdate(blocks.map((b) => ({ key: b.id, changes: { taskId: id } })))
      })
    }
  })
}

export async function setTaskDone(id: ID, done: boolean) {
  await updateTask(id, done ? { status: 'done', completedAt: Date.now() } : { status: 'open', completedAt: undefined })
}

export async function moveTask(id: ID, listId: ID) {
  await updateTask(id, { listId })
}

// Подзадачи хранятся внутри задачи.

export async function addSubtask(task: Task, title: string) {
  const sub: Subtask = { id: uid(), title: title.trim(), done: false }
  await updateTask(task.id, { subtasks: [...task.subtasks, sub] })
}

export async function patchSubtask(task: Task, subId: ID, changes: Partial<Subtask>) {
  await updateTask(task.id, { subtasks: task.subtasks.map((s) => (s.id === subId ? { ...s, ...changes } : s)) })
}

export async function removeSubtask(task: Task, subId: ID) {
  await updateTask(task.id, { subtasks: task.subtasks.filter((s) => s.id !== subId) })
}

// Списки

export async function createList(name: string, color: string): Promise<List> {
  const last = await db.lists.orderBy('order').last()
  const list: List = { id: uid(), name: name.trim(), color, order: (last?.order ?? 0) + 1, createdAt: Date.now() }
  await db.lists.add(list)
  return list
}

export async function updateList(id: ID, changes: Partial<List>) {
  await db.lists.update(id, changes)
}

/** Удаляет список; его задачи переезжают во «Входящие». */
export async function deleteList(id: ID) {
  if (id === INBOX_ID) return
  await db.transaction('rw', db.lists, db.tasks, async () => {
    await db.tasks.where('listId').equals(id).modify({ listId: INBOX_ID })
    await db.lists.delete(id)
  })
}
