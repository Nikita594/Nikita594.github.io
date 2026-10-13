import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './db'
import type { Category, List } from './types'

export function useLists(): List[] {
  return useLiveQuery(() => db.lists.orderBy('order').toArray(), []) ?? []
}

/** Категории по порядку; архивные — только если попросили. */
export function useCategories(withArchived = false): Category[] {
  const all = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? []
  return withArchived ? all : all.filter((c) => !c.archived)
}

export function useById<T extends { id: string }>(items: T[]): Map<string, T> {
  return useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
}
