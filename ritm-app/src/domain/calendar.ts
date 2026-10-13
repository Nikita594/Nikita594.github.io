import type { Minutes } from '../db/types'

export const SNAP = 15

/** Округление до шага сетки (15 минут). */
export function snap(min: number, step = SNAP): Minutes {
  return Math.round(min / step) * step
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

export interface Span {
  id: string
  startMin: Minutes
  endMin: Minutes
}

export interface Placed {
  id: string
  /** Колонка внутри группы пересекающихся блоков и сколько всего колонок. */
  col: number
  cols: number
}

/**
 * Раскладка пересекающихся блоков рядом друг с другом, как в календарях:
 * группа — цепочка пересекающихся блоков, внутри неё каждый блок занимает первую свободную колонку.
 */
export function layoutOverlaps(spans: Span[]): Map<string, Placed> {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const result = new Map<string, Placed>()
  let group: { span: Span; col: number }[] = []
  let groupEnd = -1
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1))
    for (const g of group) result.set(g.span.id, { id: g.span.id, col: g.col, cols })
    group = []
  }
  for (const s of sorted) {
    if (group.length && s.startMin >= groupEnd) flush()
    const busy = new Set(group.filter((g) => g.span.endMin > s.startMin).map((g) => g.col))
    let col = 0
    while (busy.has(col)) col++
    group.push({ span: s, col })
    groupEnd = Math.max(groupEnd, s.endMin)
  }
  if (group.length) flush()
  return result
}

/** Сумма минут (пересечения не вычитаются: два блока в одно время — это два плана). */
export function totalMinutes(spans: Pick<Span, 'startMin' | 'endMin'>[]): number {
  return spans.reduce((sum, s) => sum + Math.max(0, s.endMin - s.startMin), 0)
}

/** Блок, сдвинутый на delta минут без выхода за границы дня. Длина сохраняется. */
export function moveSpan(startMin: Minutes, endMin: Minutes, delta: number, dayStart: Minutes, dayEnd: Minutes) {
  const len = endMin - startMin
  const start = clamp(snap(startMin + delta), dayStart, dayEnd - len)
  return { startMin: start, endMin: start + len }
}

/** Новый конец при растягивании: не короче 15 минут и не дальше конца дня. */
export function resizeEnd(startMin: Minutes, rawEnd: number, dayEnd: Minutes) {
  return clamp(snap(rawEnd), startMin + SNAP, dayEnd)
}

/** Отрезок, выделенный протягиванием от a до b (в любую сторону). */
export function dragRange(a: number, b: number, dayStart: Minutes, dayEnd: Minutes) {
  let start = snap(Math.min(a, b))
  let end = snap(Math.max(a, b))
  if (end - start < SNAP) end = start + SNAP
  start = clamp(start, dayStart, dayEnd - SNAP)
  end = clamp(end, start + SNAP, dayEnd)
  return { startMin: start, endMin: end }
}
