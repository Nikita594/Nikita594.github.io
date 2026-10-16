import { describe, expect, it } from 'vitest'
import { dragRange, layoutOverlaps, moveSpan, resizeEnd, snap, totalMinutes, visibleHours } from './calendar'

describe('сетка 15 минут', () => {
  it('округление', () => {
    expect(snap(607)).toBe(600)
    expect(snap(608)).toBe(615)
    expect(snap(1081)).toBe(1080)
  })
  it('протягивание вверх и вниз даёт одно и то же', () => {
    expect(dragRange(600, 690, 360, 1440)).toEqual({ startMin: 600, endMin: 690 })
    expect(dragRange(690, 600, 360, 1440)).toEqual({ startMin: 600, endMin: 690 })
  })
  it('слишком короткое выделение — минимум 15 минут', () => {
    expect(dragRange(600, 603, 360, 1440)).toEqual({ startMin: 600, endMin: 615 })
  })
  it('перенос не выходит за границы дня и сохраняет длину', () => {
    expect(moveSpan(600, 660, 30, 360, 1440)).toEqual({ startMin: 630, endMin: 690 })
    expect(moveSpan(1380, 1440, 120, 360, 1440)).toEqual({ startMin: 1380, endMin: 1440 })
    expect(moveSpan(400, 460, -100, 360, 1440)).toEqual({ startMin: 360, endMin: 420 })
  })
  it('растягивание: не короче 15 минут, не дальше конца дня', () => {
    expect(resizeEnd(600, 610, 1440)).toBe(615)
    expect(resizeEnd(600, 1500, 1440)).toBe(1440)
    expect(resizeEnd(600, 724, 1440)).toBe(720)
  })
})

describe('раскладка пересекающихся блоков', () => {
  it('не пересекаются — каждый во всю ширину', () => {
    const r = layoutOverlaps([
      { id: 'a', startMin: 600, endMin: 660 },
      { id: 'b', startMin: 660, endMin: 720 },
    ])
    expect(r.get('a')).toEqual({ id: 'a', col: 0, cols: 1 })
    expect(r.get('b')).toEqual({ id: 'b', col: 0, cols: 1 })
  })
  it('два пересекаются — по половине', () => {
    const r = layoutOverlaps([
      { id: 'a', startMin: 600, endMin: 700 },
      { id: 'b', startMin: 650, endMin: 720 },
    ])
    expect(r.get('a')).toMatchObject({ col: 0, cols: 2 })
    expect(r.get('b')).toMatchObject({ col: 1, cols: 2 })
  })
  it('освободившаяся колонка используется снова', () => {
    const r = layoutOverlaps([
      { id: 'long', startMin: 600, endMin: 800 },
      { id: 'b', startMin: 610, endMin: 650 },
      { id: 'c', startMin: 660, endMin: 700 },
    ])
    expect(r.get('long')).toMatchObject({ col: 0, cols: 2 })
    expect(r.get('b')).toMatchObject({ col: 1, cols: 2 })
    expect(r.get('c')).toMatchObject({ col: 1, cols: 2 })
  })
})

it('сумма минут', () => {
  expect(
    totalMinutes([
      { startMin: 600, endMin: 660 },
      { startMin: 700, endMin: 730 },
    ]),
  ).toBe(90)
})

describe('исправления после ревью', () => {
  it('растягивание блока, который начинается после конца видимых часов, не даёт отрицательную длину', () => {
    expect(resizeEnd(1350, 1300, 1320)).toBe(1365)
    expect(resizeEnd(1350, 1420, 1320)).toBe(1365) // не короче 15 минут; дальше видимых часов не тянем (сетка и так расширяется под блок)
  })
  it('видимые часы расширяются под ранние и поздние блоки', () => {
    expect(visibleHours(6, 24, [])).toEqual({ startHour: 6, endHour: 24 })
    expect(visibleHours(8, 22, [{ startMin: 5 * 60 + 30, endMin: 6 * 60 + 30 }])).toEqual({ startHour: 5, endHour: 22 })
    expect(visibleHours(8, 22, [{ startMin: 22 * 60 + 30, endMin: 23 * 60 + 15 }])).toEqual({ startHour: 8, endHour: 24 })
  })
})
