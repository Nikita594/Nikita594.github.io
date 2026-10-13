import { describe, expect, it } from 'vitest'
import type { Task } from '../db/types'
import { groupDone, nextDays, overdue } from './views'

const t = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2),
  title: 'x',
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
const today = '2026-10-13'

describe('виды', () => {
  it('просроченные — только открытые со сроком раньше сегодня', () => {
    const tasks = [
      t({ title: 'вчера', dueDate: '2026-10-12' }),
      t({ title: 'сегодня', dueDate: today }),
      t({ title: 'вчера, но сделано', dueDate: '2026-10-12', status: 'done' }),
      t({ title: 'без срока' }),
    ]
    expect(overdue(tasks, today).map((x) => x.title)).toEqual(['вчера'])
  })

  it('7 дней: задачи по дням и будущие повторы', () => {
    const tasks = [
      t({ title: 'эссе', dueDate: '2026-10-15' }),
      t({ title: 'зарядка', dueDate: today, repeat: { kind: 'daily' } }),
      t({ title: 'зал', dueDate: '2026-10-14', repeat: { kind: 'weekly', days: [3, 5] } }),
    ]
    const days = nextDays(tasks, today)
    expect(days.map((d) => d.date)).toEqual([
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
    ])
    expect(days[0].tasks.map((x) => x.title)).toEqual(['зарядка'])
    expect(days[0].upcoming).toEqual([])
    expect(days[1].tasks.map((x) => x.title)).toEqual(['зал'])
    expect(days[1].upcoming.map((x) => x.title)).toEqual(['зарядка'])
    expect(days[2].tasks.map((x) => x.title)).toEqual(['эссе'])
    expect(days[3].upcoming.map((x) => x.title).sort()).toEqual(['зал', 'зарядка'])
    expect(days[4].upcoming.map((x) => x.title)).toEqual(['зарядка'])
  })

  it('выполненные группируются по дню выполнения, свежие сверху', () => {
    const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime()
    const groups = groupDone([
      t({ title: 'a', status: 'done', completedAt: at(12, 10) }),
      t({ title: 'b', status: 'done', completedAt: at(13, 9) }),
      t({ title: 'c', status: 'done', completedAt: at(13, 18) }),
      t({ title: 'открытая' }),
    ])
    expect(groups).toEqual([
      { date: '2026-10-13', tasks: [expect.objectContaining({ title: 'c' }), expect.objectContaining({ title: 'b' })] },
      { date: '2026-10-12', tasks: [expect.objectContaining({ title: 'a' })] },
    ])
  })
})
