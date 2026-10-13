import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { placeTask } from './blocks'
import { db } from './db'
import { INBOX_ID } from './seed'
import { addSubtask, completeTask, createList, createTask, deleteList, deleteTask, moveTask, patchSubtask, setTaskDone } from './tasks'

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

describe('повторяющиеся задачи', () => {
  const now = new Date(2026, 9, 13, 20, 0) // вторник

  it('выполнение оставляет запись в истории и переносит задачу на следующий раз', async () => {
    const t = await createTask({
      title: 'Английский',
      dueDate: '2026-10-13',
      dueTime: 1080,
      repeat: { kind: 'weekdays' },
      subtasks: [{ id: 's', title: 'слова', done: true }],
    })
    const { nextDue } = await completeTask(t.id, now)
    expect(nextDue).toBe('2026-10-14')
    const series = (await db.tasks.get(t.id))!
    expect(series.status).toBe('open')
    expect(series.dueDate).toBe('2026-10-14')
    expect(series.dueTime).toBe(1080)
    expect(series.subtasks[0].done).toBe(false)
    const history = await db.tasks.where('repeatOf').equals(t.id).toArray()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ status: 'done', dueDate: '2026-10-13', title: 'Английский' })
    expect(history[0].repeat).toBeUndefined()
  })

  it('«Вернуть» отменяет перенос и убирает запись из истории', async () => {
    const t = await createTask({ title: 'SAT', dueDate: '2026-10-13', repeat: { kind: 'daily' } })
    const { undo } = await completeTask(t.id, now)
    await undo()
    expect((await db.tasks.get(t.id))?.dueDate).toBe('2026-10-13')
    expect(await db.tasks.where('repeatOf').equals(t.id).count()).toBe(0)
  })

  it('последний повтор серии — задача просто выполнена', async () => {
    const t = await createTask({ title: 'Курс', dueDate: '2026-10-13', repeat: { kind: 'daily', until: '2026-10-13' } })
    const { nextDue } = await completeTask(t.id, now)
    expect(nextDue).toBeUndefined()
    expect((await db.tasks.get(t.id))?.status).toBe('done')
  })

  it('обычная задача просто выполнена', async () => {
    const t = await createTask({ title: 'Разовая' })
    await completeTask(t.id, now)
    expect((await db.tasks.get(t.id))?.status).toBe('done')
    expect(await db.tasks.count()).toBe(1)
  })
})

describe('календарь', () => {
  it('задача, перетащенная в слот, получает блок своей длительности и срок', async () => {
    const t = await createTask({ title: 'Эссе', durationMin: 90, categoryId: 'study' })
    const block = await placeTask(t, '2026-10-15', 16 * 60)
    expect(block).toMatchObject({ date: '2026-10-15', startMin: 960, endMin: 1050, taskId: t.id, categoryId: 'study' })
    expect(await db.tasks.get(t.id)).toMatchObject({ dueDate: '2026-10-15', dueTime: 960, durationMin: 90 })
  })
  it('без длительности — час; у конца дня блок сдвигается, чтобы влезть', async () => {
    const t = await createTask({ title: 'Чтение' })
    const block = await placeTask(t, '2026-10-15', 23 * 60 + 30)
    expect(block).toMatchObject({ startMin: 23 * 60, endMin: 24 * 60 })
  })
})
