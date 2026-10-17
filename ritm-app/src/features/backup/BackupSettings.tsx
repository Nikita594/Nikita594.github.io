import { useEffect, useState } from 'react'
import { BackupError, importData, parseBackup, summarize, type Backup } from '../../db/backup'
import { useSettings } from '../../db/settings'
import { formatDayLabel, toDateStr } from '../../domain/dates'
import { plural } from '../../domain/text'
import { navigate } from '../../lib/router'
import { isSingleFile } from '../../lib/sw'
import { Button, Modal } from '../../ui/kit'
import { toast } from '../../ui/toast'
import { pickTextFile, saveBackup } from './actions'

function when(ms: number) {
  if (!ms) return 'ещё не сохранялась'
  const d = new Date(ms)
  return `${formatDayLabel(toDateStr(d)).toLowerCase()}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
}

function count(n: number, one: string, few: string, many: string) {
  return `${n} ${plural(n, one, few, many)}`
}

function RestoreConfirm({ backup, onClose }: { backup: Backup; onClose: () => void }) {
  const s = summarize(backup)
  const [busy, setBusy] = useState(false)
  const date = Date.parse(s.exportedAt)
  const lines = [
    count(s.tasks, 'задача в работе', 'задачи в работе', 'задач в работе'),
    count(s.done, 'выполненная', 'выполненные', 'выполненных'),
    count(s.lists, 'список', 'списка', 'списков'),
    count(s.habits, 'привычка', 'привычки', 'привычек'),
    count(s.blocks, 'блок в календаре', 'блока в календаре', 'блоков в календаре'),
    count(s.entries, 'запись времени', 'записи времени', 'записей времени'),
  ]
  return (
    <Modal
      title="Восстановить из копии?"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await importData(backup)
                onClose()
                toast('Данные восстановлены')
                navigate('today')
              } catch {
                setBusy(false)
                toast('Не получилось восстановить. Текущие данные не тронуты.')
              }
            }}
          >
            Восстановить
          </Button>
        </>
      }
    >
      <p className="text-sm">Копия от {Number.isNaN(date) ? 'неизвестной даты' : when(date)}. В ней:</p>
      <ul className="mt-2 list-disc pl-5 text-sm text-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">Всё, что сейчас есть на этом устройстве, заменится данными из копии.</p>
    </Modal>
  )
}

export function BackupSettings() {
  const settings = useSettings()
  const [restoring, setRestoring] = useState<Backup | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Последняя копия: {when(settings.lastBackupAt)}.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon="download"
          onClick={async () => {
            const r = await saveBackup()
            if (r !== 'cancelled') toast('Копия сохранена')
          }}
        >
          Сохранить копию
        </Button>
        <Button
          icon="upload"
          onClick={async () => {
            const text = await pickTextFile()
            if (text === null) return
            try {
              setRestoring(parseBackup(text))
            } catch (e) {
              toast(e instanceof BackupError ? e.message : 'Не получилось прочитать файл.', undefined, 6000)
            }
          }}
        >
          Восстановить из файла
        </Button>
      </div>
      <p className="text-xs text-faint">
        Данные хранятся только в этом браузере.{' '}
        {persisted === true
          ? 'Браузер обещал не удалять их сам, но копия всё равно нужна: например, при очистке браузера.'
          : 'Браузер может удалить их при нехватке места или если приложение долго не открывать — поэтому раз в неделю сохраняйте копию.'}
      </p>
      {!isSingleFile && location.protocol.startsWith('http') && (
        <p className="text-xs text-faint">
          Есть версия одним файлом — открывается двойным кликом, без интернета и сайта:{' '}
          <a href="./ritm-offline.html" download="ritm.html" className="text-accent underline-offset-2 hover:underline">
            скачать ritm.html
          </a>
          . У неё свои данные; перенести их можно копией.
        </p>
      )}
      {restoring && <RestoreConfirm backup={restoring} onClose={() => setRestoring(null)} />}
    </div>
  )
}
