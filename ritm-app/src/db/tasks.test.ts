import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { INBOX_ID } from './seed'
import { addSubtask, createList, createTask, deleteList, deleteTask, moveTask, patchSubtask, setTaskDone } from './tasks'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('первый запуск', () => {
  it('создаёт «Входящие» и 8 категорий', async () => {
    expect((await db.lists.toArray()).map((l) => l.name)).toEqual(['Входящие'])
    expect(await db.categories.count()).toBe(8)
  })
})

describe('задачи', () => {
  it('новая задача попадает во «Входящие»', async () => {
    const t = await createTask({ title: '  Эссе  ' })
    expect(t.title).toBe('Эссе')
    expect(t.listId).toBe(INBOX_ID)
    expect(t.status).toBe('open')
  })

  it('выполнение и возврат', async () => {
    const t = await createTask({ title: 'SAT practice' })
    await setTaskDone(t.id, true)
    let saved = await db.tasks.get(t.id)
    expect(saved?.status).toBe('done')
    expect(saved?.completedAt).toBeTypeOf('number')
    await setTaskDone(t.id, false)
    saved = await db.tasks.get(t.id)
    expect(saved?.status).toBe('open')
    expect(saved?.completedAt).toBeUndefined()
  })

  it('удаление можно отменить, блоки времени возвращают связь', async () => {
    const t = await createTask({ title: 'Удалить меня' })
    await db.blocks.add({ id: 'b1', date: '2026-10-14', startMin: 600, endMin: 660, taskId: t.id })
    const undo = await deleteTask(t.id)
    expect(await db.tasks.get(t.id)).toBeUndefined()
    expect((await db.blocks.get('b1'))?.taskId).toBeUndefined()
    await undo()
    expect((await db.tasks.get(t.id))?.title).toBe('Удалить меня')
    expect((await db.blocks.get('b1'))?.taskId).toBe(t.id)
  })

  it('подзадачи', async () => {
    const t = await createTask({ title: 'Видео' })
    await addSubtask(t, 'Сценарий')
    let saved = (await db.tasks.get(t.id))!
    expect(saved.subtasks.map((s) => s.title)).toEqual(['Сценарий'])
    await patchSubtask(saved, saved.subtasks[0].id, { done: true })
    saved = (await db.tasks.get(t.id))!
    expect(saved.subtasks[0].done).toBe(true)
  })
})

describe('списки', () => {
  it('перенос задачи между списками', async () => {
    const school = await createList('Школа', '#2563eb')
    const t = await createTask({ title: 'Алгебра' })
    await moveTask(t.id, school.id)
    expect((await db.tasks.get(t.id))?.listId).toBe(school.id)
  })

  it('при удалении списка задачи переезжают во «Входящие»', async () => {
    const school = await createList('Школа', '#2563eb')
    const t = await createTask({ title: 'Алгебра', listId: school.id })
    await deleteList(school.id)
    expect(await db.lists.get(school.id)).toBeUndefined()
    expect((await db.tasks.get(t.id))?.listId).toBe(INBOX_ID)
  })

  it('«Входящие» удалить нельзя', async () => {
    await deleteList(INBOX_ID)
    expect(await db.lists.get(INBOX_ID)).toBeDefined()
  })
})
