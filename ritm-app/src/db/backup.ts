import { db, SCHEMA_VERSION, TABLES, type TableName } from './db'

// Резервная копия — один JSON-файл со всеми таблицами.
// Формат: { app: 'ritm', schemaVersion, exportedAt, tables: { tasks: [...], ... } }

export interface Backup {
  app: 'ritm'
  schemaVersion: number
  exportedAt: string
  tables: Record<TableName, unknown[]>
}

/** Служебные настройки этого устройства — в копию не кладём и при восстановлении не трогаем. */
const DEVICE_SETTINGS = new Set(['pomodoro', 'backupSnoozedUntil', 'lastBackupAt', 'installedAt'])

/**
 * Шаги миграции старых копий: EXPORT_MIGRATIONS[n] переводит таблицы копии из версии n в n + 1.
 * Добавлять вместе с новой версией схемы в db.ts.
 */
export const EXPORT_MIGRATIONS: Record<number, (tables: Record<string, unknown[]>) => Record<string, unknown[]>> = {}

export async function exportData(now: Date = new Date()): Promise<Backup> {
  return db.transaction(
    'r',
    TABLES.map((t) => db.table(t)),
    async () => {
      const tables = {} as Record<TableName, unknown[]>
      for (const t of TABLES) {
        const rows = await db.table(t).toArray()
        tables[t] = t === 'settings' ? rows.filter((r: { key: string }) => !DEVICE_SETTINGS.has(r.key)) : rows
      }
      return { app: 'ritm', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), tables }
    },
  )
}

export class BackupError extends Error {}

/** Читает и проверяет файл копии. Бросает BackupError с понятным текстом. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('Это не файл резервной копии: не получилось прочитать JSON.')
  }
  const b = data as Partial<Backup>
  if (!b || typeof b !== 'object' || b.app !== 'ritm' || typeof b.tables !== 'object' || b.tables === null) {
    throw new BackupError('Это не резервная копия «Ритма».')
  }
  const version = Number(b.schemaVersion)
  if (!Number.isInteger(version) || version < 1) throw new BackupError('В файле нет версии данных — похоже, он повреждён.')
  if (version > SCHEMA_VERSION)
    throw new BackupError('Копия сделана в более новой версии приложения. Обновите приложение и попробуйте снова.')

  let tables = b.tables as Record<string, unknown[]>
  for (let v = version; v < SCHEMA_VERSION; v++) tables = EXPORT_MIGRATIONS[v]?.(tables) ?? tables

  const clean = {} as Record<TableName, unknown[]>
  for (const t of TABLES) {
    const rows = tables[t] ?? [] // в старых копиях новых таблиц может не быть
    if (!Array.isArray(rows)) throw new BackupError(`Повреждена часть «${t}».`)
    const keyField = t === 'settings' ? 'key' : 'id'
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof (row as Record<string, unknown>)[keyField] !== 'string') {
        throw new BackupError(`Повреждена запись в части «${t}».`)
      }
    }
    clean[t] = rows
  }
  return { app: 'ritm', schemaVersion: SCHEMA_VERSION, exportedAt: String(b.exportedAt ?? ''), tables: clean }
}

/** Заменяет все данные на этом устройстве данными из копии. */
export async function importData(backup: Backup) {
  await db.transaction(
    'rw',
    TABLES.map((t) => db.table(t)),
    async () => {
      const keep = (await db.settings.toArray()).filter((r) => DEVICE_SETTINGS.has(r.key) && r.key !== 'pomodoro')
      for (const t of TABLES) {
        await db.table(t).clear()
        const rows =
          t === 'settings' ? backup.tables.settings.filter((r) => !DEVICE_SETTINGS.has((r as { key: string }).key)) : backup.tables[t]
        await db.table(t).bulkAdd(rows)
      }
      await db.settings.bulkPut(keep)
      // данные теперь совпадают с копией — значит, копия есть
      const at = Date.parse(backup.exportedAt)
      if (!Number.isNaN(at)) await db.settings.put({ key: 'lastBackupAt', value: at })
    },
  )
}

/** Что лежит в копии — для окна подтверждения. */
export function summarize(b: Backup) {
  const t = b.tables as Record<TableName, { status?: string; archived?: boolean; id?: string }[]>
  return {
    tasks: t.tasks.filter((x) => x.status === 'open').length,
    done: t.tasks.filter((x) => x.status === 'done').length,
    lists: t.lists.filter((x) => x.id !== 'inbox').length,
    habits: t.habits.length,
    blocks: t.blocks.length,
    entries: t.entries.length,
    exportedAt: b.exportedAt,
  }
}

export function backupFileName(now: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `ritm-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`
}

const WEEK = 7 * 24 * 60 * 60 * 1000

/** Пора ли тихо напомнить о копии: прошла неделя с последней копии (или с первого запуска) и есть что сохранять. */
export function shouldRemindBackup(s: {
  lastBackupAt: number
  installedAt: number
  backupSnoozedUntil: number
  hasData: boolean
  now: number
}) {
  if (!s.hasData || s.now < s.backupSnoozedUntil) return false
  const since = Math.max(s.lastBackupAt, s.installedAt)
  return since > 0 && s.now - since >= WEEK
}
