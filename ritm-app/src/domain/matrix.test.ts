import { describe, expect, it } from 'vitest'
import { moveToQuadrant, quadrantOf } from './matrix'

const today = '2026-10-13'

describe('квадранты', () => {
  it.each([
    [{ priority: 3, dueDate: today }, 1],
    [{ priority: 2, dueDate: '2026-10-14' }, 1], // завтра — ещё срочно
    [{ priority: 3, dueDate: '2026-10-01' }, 1], // просрочено — срочно
    [{ priority: 3, dueDate: '2026-10-15' }, 2], // послезавтра — не срочно
    [{ priority: 2 }, 2], // без срока — не срочно
    [{ priority: 1, dueDate: today }, 3],
    [{ priority: 0, dueDate: '2026-10-14' }, 3],
    [{ priority: 1 }, 4],
    [{ priority: 0, dueDate: '2026-11-01' }, 4],
  ] as const)('%j → %i', (task, q) => {
    expect(quadrantOf({ ...task }, today)).toBe(q)
  })
})

describe('перетаскивание между квадрантами', () => {
  it('из «потом» в «срочно и важно»: высокий приоритет и срок сегодня', () => {
    expect(moveToQuadrant({ priority: 0 }, 1, today)).toEqual({ priority: 3, dueDate: today })
  })
  it('по вертикали меняется только приоритет', () => {
    expect(moveToQuadrant({ priority: 3, dueDate: today }, 3, today)).toEqual({ priority: 1 })
    expect(moveToQuadrant({ priority: 1 }, 2, today)).toEqual({ priority: 3 })
  })
  it('средний приоритет уже важный — не трогаем', () => {
    expect(moveToQuadrant({ priority: 2 }, 1, today)).toEqual({ dueDate: today })
  })
  it('в несрочные — послезавтра', () => {
    expect(moveToQuadrant({ priority: 3, dueDate: today }, 2, today)).toEqual({ dueDate: '2026-10-15' })
  })
  it('в свой же квадрант — ничего не меняется', () => {
    expect(moveToQuadrant({ priority: 3, dueDate: today }, 1, today)).toEqual({})
  })
  it('после переноса задача действительно в нужном квадранте', () => {
    for (const from of [
      { priority: 0 as const },
      { priority: 3 as const, dueDate: today },
      { priority: 1 as const, dueDate: '2026-12-01' },
    ])
      for (const q of [1, 2, 3, 4] as const) expect(quadrantOf({ ...from, ...moveToQuadrant(from, q, today) }, today)).toBe(q)
  })
})
