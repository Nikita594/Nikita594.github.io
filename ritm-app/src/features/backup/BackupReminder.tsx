import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { shouldRemindBackup } from '../../db/backup'
import { db } from '../../db/db'
import { setSetting, useSettings } from '../../db/settings'
import { Button } from '../../ui/kit'
import { toast } from '../../ui/toast'
import { useNow } from '../../lib/useToday'
import { saveBackup } from './actions'

const DAY = 86_400_000

/** Тихая строка внизу экрана, если копии не было больше недели. */
export function BackupReminder() {
  const s = useSettings()
  const now = useNow(10 * 60_000).getTime()
  const hasData = useLiveQuery(async () => (await db.tasks.count()) + (await db.habits.count()) + (await db.entries.count()) > 0, [], false)
  const [hidden, setHidden] = useState(false)
  if (hidden || !shouldRemindBackup({ ...s, hasData, now })) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl flex-wrap items-center gap-2 ui-card ui-banner px-4 py-2.5 text-sm shadow-lg md:bottom-4 md:left-64"
    >
      <span className="min-w-0 flex-1">Резервной копии не было больше недели.</span>
      <Button
        variant="primary"
        className="h-8"
        onClick={async () => {
          const r = await saveBackup()
          if (r !== 'cancelled') toast('Копия сохранена')
        }}
      >
        Сохранить копию
      </Button>
      <Button
        variant="ghost"
        className="h-8"
        onClick={() => {
          setHidden(true)
          void setSetting('backupSnoozedUntil', now + 3 * DAY)
        }}
      >
        Позже
      </Button>
    </div>
  )
}
