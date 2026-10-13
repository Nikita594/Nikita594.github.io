import type { Transaction } from 'dexie'
import type { Category, List } from './types'

export const INBOX_ID = 'inbox'

/** Встроенные категории времени. id постоянные — на них можно ссылаться в коде (например, «игры»). */
export const BUILTIN_CATEGORIES: Omit<Category, 'order'>[] = [
  { id: 'study', name: 'Учёба', color: '#2563eb', builtin: true, archived: false },
  { id: 'english', name: 'Английский', color: '#7c3aed', builtin: true, archived: false },
  { id: 'sat', name: 'SAT', color: '#db2777', builtin: true, archived: false },
  { id: 'work', name: 'Работа', color: '#ca8a04', builtin: true, archived: false },
  { id: 'channel', name: 'Канал', color: '#dc2626', builtin: true, archived: false },
  { id: 'sport', name: 'Спорт', color: '#16a34a', builtin: true, archived: false },
  { id: 'games', name: 'Игры', color: '#0891b2', builtin: true, archived: false },
  { id: 'rest', name: 'Отдых', color: '#64748b', builtin: true, archived: false },
]

export const GAMES_CATEGORY_ID = 'games'

/** Заполняет пустую базу при первом запуске. */
export async function seed(tx: Transaction) {
  const now = Date.now()
  const inbox: List = { id: INBOX_ID, name: 'Входящие', color: '#64748b', order: 0, createdAt: now }
  await tx.table('lists').add(inbox)
  await tx.table('categories').bulkAdd(BUILTIN_CATEGORIES.map((c, i) => ({ ...c, order: i })))
}
