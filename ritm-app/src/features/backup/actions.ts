import { backupFileName, exportData } from '../../db/backup'
import { setSetting } from '../../db/settings'

/**
 * Сохранить копию в файл. На телефоне — через «Поделиться» (можно сохранить в «Файлы» или отправить в Telegram),
 * на компьютере — обычное скачивание.
 */
export async function saveBackup(): Promise<'saved' | 'shared' | 'cancelled'> {
  const now = new Date()
  const data = await exportData(now)
  const name = backupFileName(now)
  const json = JSON.stringify(data, null, 1)
  const file = new File([json], name, { type: 'application/json' })

  const touch = matchMedia('(pointer: coarse)').matches
  if (touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      await setSetting('lastBackupAt', now.getTime())
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
      // поделиться не вышло — пробуем обычное скачивание
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  await setSetting('lastBackupAt', now.getTime())
  return 'saved'
}

/** Открыть окно выбора файла и вернуть его текст (null — ничего не выбрали). */
export function pickTextFile(accept = 'application/json,.json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      f.text().then(resolve, () => resolve(null))
    }
    // окно закрыли без выбора — в современных браузерах приходит cancel
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
