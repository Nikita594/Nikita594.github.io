import { uid } from '../lib/id'
import { db } from './db'
import { INBOX_ID } from './seed'
import type { DateStr, ID, List, Subtask, Task } from './types'
import { todayStr } from '../domain/dates'
import { nextDueAfterDone } from '../domain/repeat'

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

/**
 * Удаляет задачу. Блоки в календаре остаются (время-то было запланировано), но получают название задачи,
 * чтобы не превратиться в «Без названия». Возвращает функцию «вернуть».
 */
export async function deleteTask(id: ID): Promise<() => Promise<void>> {
  return db.transaction('rw', db.tasks, db.blocks, async () => {
    const task = await db.tasks.get(id)
    const blocks = await db.blocks.where('taskId').equals(id).toArray()
    await db.tasks.delete(id)
    await db.blocks.bulkUpdate(blocks.map((b) => ({ key: b.id, changes: { taskId: undefined, title: b.title ?? task?.title } })))
    return async () => {
      if (!task) return
      await db.transaction('rw', db.tasks, db.blocks, async () => {
        await db.tasks.put(task)
        await db.blocks.bulkUpdate(blocks.map((b) => ({ key: b.id, changes: { taskId: id, title: b.title } })))
      })
    }
  })
}

export async function setTaskDone(id: ID, done: boolean) {
  await updateTask(id, done ? { status: 'done', completedAt: Date.now() } : { status: 'open', completedAt: undefined })
}

/**
 * Снять отметку «выполнено». Для записи о выполненном повторе это отмена выполнения:
 * запись исчезает, а серия возвращается на тот день (как кнопка «Вернуть»), — иначе появился бы дубль задачи.
 */
export async function reopenTask(id: ID) {
  await db.transaction('rw', db.tasks, db.blocks, async () => {
    const copy = await db.tasks.get(id)
    if (!copy || copy.status !== 'done') return
    const series = copy.repeatOf ? await db.tasks.get(copy.repeatOf) : undefined
    if (!series || !series.repeat || series.status !== 'open') {
      await db.tasks.update(id, { status: 'open', completedAt: undefined, updatedAt: Date.now() })
      return
    }
    const history = await db.tasks.where('repeatOf').equals(series.id).toArray()
    const newest = history.every((h) => (h.completedAt ?? 0) <= (copy.completedAt ?? 0))
    await db.tasks.delete(id)
    // блоки этого выполненного дня снова указывают на серию
    const blocks = await db.blocks.where('taskId').equals(id).toArray()
    await db.blocks.bulkUpdate(blocks.map((b) => ({ key: b.id, changes: { taskId: series.id } })))
    // последнее выполнение — серия возвращается на его день; более старые просто удаляются из истории
    if (newest && copy.dueDate && (!series.dueDate || series.dueDate > copy.dueDate)) {
      await db.tasks.update(series.id, { dueDate: copy.dueDate, subtasks: copy.subtasks, updatedAt: Date.now() })
    }
  })
}

export interface CompleteResult {
  /** Новый срок повторяющейся задачи; undefined — задача не повторяется или серия закончилась. */
  nextDue?: DateStr
  undo: () => Promise<void>
}

/**
 * Отметить задачу выполненной.
 * Повторяющаяся: в истории остаётся выполненная копия, а сама задача переезжает на следующую дату
 * (подзадачи снова не отмечены). Если повторы закончились — задача просто выполнена.
 */
export async function completeTask(id: ID, now: Date = new Date()): Promise<CompleteResult> {
  return db.transaction('rw', db.tasks, db.blocks, async () => {
    const task = await db.tasks.get(id)
    if (!task || task.status === 'done') return { undo: async () => {} }
    const at = now.getTime()
    const next = task.repeat && task.dueDate ? nextDueAfterDone(task.repeat, task.dueDate, todayStr(now)) : null
    if (!task.repeat || !next) {
      await db.tasks.update(id, { status: 'done', completedAt: at, updatedAt: at })
      return { undo: () => setTaskDone(id, false) }
    }
    const copy: Task = {
      ...task,
      id: uid(),
      status: 'done',
      completedAt: at,
      repeat: undefined,
      repeatOf: task.id,
      subtasks: task.subtasks.map((s) => ({ ...s })),
      createdAt: at,
      updatedAt: at,
    }
    await db.tasks.add(copy)
    await db.tasks.update(id, { dueDate: next, subtasks: task.subtasks.map((s) => ({ ...s, done: false })), updatedAt: at })
    // блоки в календаре до следующего повтора относятся к выполненному разу
    const relinked = await db.blocks
      .where('taskId')
      .equals(id)
      .and((b) => b.date < next)
      .toArray()
    await db.blocks.bulkUpdate(relinked.map((b) => ({ key: b.id, changes: { taskId: copy.id } })))
    return {
      nextDue: next,
      undo: async () => {
        await db.transaction('rw', db.tasks, db.blocks, async () => {
          await db.tasks.delete(copy.id)
          await db.tasks.put(task)
          await db.blocks.bulkUpdate(relinked.map((b) => ({ key: b.id, changes: { taskId: id } })))
        })
      },
    }
  })
}

export async function moveTask(id: ID, listId: ID) {
  await updateTask(id, { listId })
}

// Подзадачи хранятся внутри задачи. Каждое изменение читает свежую задачу из базы:
// иначе два быстрых изменения подряд (по устаревшей копии на экране) затирали бы друг друга.

async function changeSubtasks(taskId: ID, fn: (subs: Subtask[]) => Subtask[]) {
  await db.transaction('rw', db.tasks, async () => {
    const fresh = await db.tasks.get(taskId)
    if (fresh) await db.tasks.update(taskId, { subtasks: fn(fresh.subtasks), updatedAt: Date.now() })
  })
}

export async function addSubtask(task: Pick<Task, 'id'>, title: string) {
  const sub: Subtask = { id: uid(), title: title.trim(), done: false }
  await changeSubtasks(task.id, (subs) => [...subs, sub])
}

export async function patchSubtask(task: Pick<Task, 'id'>, subId: ID, changes: Partial<Subtask>) {
  await changeSubtasks(task.id, (subs) => subs.map((s) => (s.id === subId ? { ...s, ...changes } : s)))
}

export async function removeSubtask(task: Pick<Task, 'id'>, subId: ID) {
  await changeSubtasks(task.id, (subs) => subs.filter((s) => s.id !== subId))
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
