import { uid } from '../lib/id'
import { db } from './db'
import type { Category, ID } from './types'

export async function createCategory(name: string, color: string): Promise<Category> {
  const last = await db.categories.orderBy('order').last()
  const cat: Category = { id: uid(), name: name.trim(), color, builtin: false, archived: false, order: (last?.order ?? 0) + 1 }
  await db.categories.add(cat)
  return cat
}

export async function updateCategory(id: ID, changes: Partial<Category>) {
  await db.categories.update(id, changes)
}

/**
 * Свою категорию можно удалить, если на неё ничего не ссылается; иначе — только скрыть,
 * чтобы не потерять статистику. Встроенные категории только скрываются.
 */
export async function removeCategory(id: ID): Promise<'deleted' | 'archived'> {
  return db.transaction('rw', db.categories, db.tasks, db.blocks, db.entries, async () => {
    const cat = await db.categories.get(id)
    if (!cat) return 'deleted'
    const used =
      (await db.tasks.where('categoryId').equals(id).count()) +
      (await db.blocks.filter((b) => b.categoryId === id).count()) +
      (await db.entries.where('categoryId').equals(id).count())
    if (cat.builtin || used > 0) {
      await db.categories.update(id, { archived: true })
      return 'archived'
    }
    await db.categories.delete(id)
    return 'deleted'
  })
}
