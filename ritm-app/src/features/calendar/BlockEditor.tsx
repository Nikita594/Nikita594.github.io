import { useLiveQuery } from 'dexie-react-hooks'
import { deleteBlock, updateBlock } from '../../db/blocks'
import { db } from '../../db/db'
import { useCategories } from '../../db/hooks'
import type { TimeBlock } from '../../db/types'
import { formatDuration, formatMinutes, parseHHMM } from '../../domain/dates'
import { Button, DraftInput, Field, inputCls, isFullDate, Modal } from '../../ui/kit'
import { toast } from '../../ui/toast'
import { openTask } from '../tasks/editorStore'

export function BlockEditor({ blockId, onClose }: { blockId: string; onClose: () => void }) {
  const block = useLiveQuery(() => db.blocks.get(blockId), [blockId])
  const categories = useCategories()
  const tasks = useLiveQuery(() => db.tasks.where('status').equals('open').sortBy('title'), [])
  if (!block) return null
  const set = (changes: Partial<TimeBlock>) => void updateBlock(block.id, changes)
  const linked = tasks?.find((t) => t.id === block.taskId)

  const setTime = (which: 'startMin' | 'endMin', value: string) => {
    const m = parseHHMM(value)
    if (m === undefined) return
    if (which === 'startMin') {
      const len = block.endMin - block.startMin
      set({ startMin: m, endMin: Math.min(24 * 60, m + len) })
    } else if (m > block.startMin) set({ endMin: m })
  }

  return (
    <Modal
      title="Блок времени"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            icon="trash"
            className="mr-auto"
            onClick={async () => {
              onClose()
              const undo = await deleteBlock(block.id)
              toast('Блок удалён', { label: 'Вернуть', run: () => void undo() })
            }}
          >
            Удалить
          </Button>
          <Button variant="primary" onClick={onClose}>
            Готово
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Задача">
          <select
            className={inputCls}
            value={block.taskId ?? ''}
            onChange={(e) => {
              const task = tasks?.find((t) => t.id === e.target.value)
              set({ taskId: task?.id, categoryId: task?.categoryId ?? block.categoryId })
            }}
          >
            <option value="">без задачи</option>
            {tasks?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        {!linked && (
          <Field label="Название" hint="Например, «Тренировка» или «Свободное время»">
            <input
              className={inputCls}
              defaultValue={block.title ?? ''}
              onBlur={(e) => set({ title: e.target.value.trim() || undefined })}
            />
          </Field>
        )}
        <Field label="Категория">
          <select className={inputCls} value={block.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || undefined })}>
            <option value="">без категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="День">
            <DraftInput type="date" className={inputCls} value={block.date} isComplete={isFullDate} onCommit={(v) => set({ date: v })} />
          </Field>
          <Field label="Начало">
            <DraftInput
              type="time"
              step={900}
              className={inputCls}
              value={formatMinutes(block.startMin)}
              isComplete={(v) => parseHHMM(v) !== undefined}
              onCommit={(v) => setTime('startMin', v)}
            />
          </Field>
          <Field label="Конец">
            <DraftInput
              type="time"
              step={900}
              className={inputCls}
              value={formatMinutes(block.endMin % (24 * 60))}
              isComplete={(v) => parseHHMM(v) !== undefined}
              onCommit={(v) => setTime('endMin', v === '00:00' ? '24:00' : v)}
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">Длительность: {formatDuration(block.endMin - block.startMin)}</p>
        {linked && (
          <Button
            icon="edit"
            className="self-start"
            onClick={() => {
              onClose()
              openTask(linked.id)
            }}
          >
            Открыть задачу «{linked.title}»
          </Button>
        )}
      </div>
    </Modal>
  )
}
