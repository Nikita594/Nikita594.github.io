/** Русское склонение после числа: 1 день, 2 дня, 5 дней, 11 дней, 21 день. */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 10
  const b = Math.abs(n) % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few
  return many
}

/** «5 дней», «1 день». */
export const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`
