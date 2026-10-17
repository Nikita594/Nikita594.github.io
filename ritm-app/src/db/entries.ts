import { uid } from '../lib/id'
import { db } from './db'
import type { ID, Moment, TimeEntry } from './types'

export async function addEntry(input: Omit<TimeEntry, 'id'>): Promise<TimeEntry> {
  const entry: TimeEntry = { ...input, id: uid() }
  await db.entries.add(entry)
  return entry
}

export async function updateEntry(id: ID, changes: Partial<TimeEntry>) {
  await db.entries.update(id, changes)
}

export async function deleteEntry(id: ID): Promise<() => Promise<void>> {
  const entry = await db.entries.get(id)
  await db.entries.delete(id)
  return async () => {
    if (entry) await db.entries.put(entry)
  }
}

/** Записи, начавшиеся в промежутке [from, to). */
export function entriesBetween(from: Moment, to: Moment) {
  return db.entries.where('start').between(from, to, true, false).toArray()
}
