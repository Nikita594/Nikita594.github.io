import { useState } from 'react'
import { createCategory, removeCategory, updateCategory } from '../../db/categories'
import { useCategories } from '../../db/hooks'
import type { Category } from '../../db/types'
import { Button, ColorPicker, cx, Field, IconButton, inputCls, Modal, PALETTE } from '../../ui/kit'
import { toast } from '../../ui/toast'

function CategoryModal({ cat, onClose }: { cat?: Category; onClose: () => void }) {
  const [name, setName] = useState(cat?.name ?? '')
  const [color, setColor] = useState(cat?.color ?? PALETTE[0])
  const save = async () => {
    if (!name.trim()) return
    if (cat) await updateCategory(cat.id, { name: name.trim(), color })
    else await createCategory(name, color)
    onClose()
  }
  return (
    <Modal
      title={cat ? 'Категория' : 'Новая категория'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => void save()}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Название" hint="В быстром вводе пишется через решётку, например #чтение">
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Чтение" />
        </Field>
        <Field label="Цвет">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </form>
    </Modal>
  )
}

export function CategoriesSettings() {
  const cats = useCategories(true)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  return (
    <div>
      <ul className="flex flex-col">
        {cats.map((c) => (
          <li key={c.id} className={cx('flex items-center gap-3 rounded-lg px-2 py-1.5', c.archived && 'opacity-50')}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
            <button type="button" className="flex-1 text-left text-sm" onClick={() => setEditing(c)}>
              {c.name}
              {c.archived && <span className="ml-2 text-xs text-muted">скрыта</span>}
            </button>
            {c.archived ? (
              <Button variant="ghost" className="h-8" onClick={() => void updateCategory(c.id, { archived: false })}>
                Вернуть
              </Button>
            ) : (
              <IconButton
                icon="trash"
                label={c.builtin ? 'Скрыть категорию' : 'Удалить категорию'}
                size={16}
                className="h-8 w-8"
                onClick={async () => {
                  const r = await removeCategory(c.id)
                  toast(r === 'deleted' ? 'Категория удалена' : 'Категория скрыта — старые записи сохранены')
                }}
              />
            )}
          </li>
        ))}
      </ul>
      <Button className="mt-2" icon="plus" onClick={() => setEditing('new')}>
        Добавить категорию
      </Button>
      {editing && <CategoryModal cat={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
