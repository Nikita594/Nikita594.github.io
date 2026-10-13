import { describe, expect, it } from 'vitest'
import type { Task } from '../db/types'
import { compareOpenTasks, matchesSearch } from './tasks'

const t = (over: Partial<Task>): Task => ({
  id: Math.random().toString(),
  title: 'задача',
  note: '',
  listId: 'inbox',
  priority: 0,
  subtasks: [],
  status: 'open',
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe('сортировка задач', () => {
  it('срок раньше — выше, без срока — в конце', () => {
    const list = [t({ title: 'без срока' }), t({ title: 'пт', dueDate: '2026-10-16' }), t({ title: 'ср', dueDate: '2026-10-14' })]
    expect(list.sort(compareOpenTasks).map((x) => x.title)).toEqual(['ср', 'пт', 'без срока'])
  })
  it('в один день: по времени, задачи без времени — после', () => {
    const d = '2026-10-14'
    const list = [t({ title: 'весь день', dueDate: d }), t({ title: '18:00', dueDate: d, dueTime: 1080 }), t({ title: '9:00', dueDate: d, dueTime: 540 })]
    expect(list.sort(compareOpenTasks).map((x) => x.title)).toEqual(['9:00', '18:00', 'весь день'])
  })
  it('при равном сроке важнее — выше', () => {
    const list = [t({ title: 'низкий', priority: 1 }), t({ title: 'высокий', priority: 3 })]
    expect(list.sort(compareOpenTasks).map((x) => x.title)).toEqual(['высокий', 'низкий'])
  })
})

describe('поиск', () => {
  const task = t({ title: 'Подготовить эссе', note: 'для Common App', subtasks: [{ id: '1', title: 'черновик', done: false }] })
  it('по названию без учёта регистра', () => expect(matchesSearch(task, 'ЭССЕ')).toBe(true))
  it('по заметке и подзадачам', () => {
    expect(matchesSearch(task, 'common')).toBe(true)
    expect(matchesSearch(task, 'черновик')).toBe(true)
  })
  it('все слова должны найтись', () => {
    expect(matchesSearch(task, 'эссе черновик')).toBe(true)
    expect(matchesSearch(task, 'эссе SAT')).toBe(false)
  })
  it('ё = е', () => expect(matchesSearch(t({ title: 'Учёба' }), 'учеба')).toBe(true))
  it('пустой запрос ничего не находит', () => expect(matchesSearch(task, '  ')).toBe(false))
})
