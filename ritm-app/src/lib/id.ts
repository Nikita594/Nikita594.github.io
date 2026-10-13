/** Случайный id. crypto.randomUUID есть не везде (например, на file:// в старых браузерах), getRandomValues — есть. */
export function uid(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
