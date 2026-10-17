import { useState } from 'react'
import { createList, updateList } from '../../db/tasks'
import type { List } from '../../db/types'
import { navigate } from '../../lib/router'
import { Button, ColorPicker, Field, inputCls, Modal, PALETTE } from '../../ui/kit'

/** Окно «Новый список» / «Список» (переименовать, сменить цвет). */
export function ListEditor({ list, onClose }: { list?: List; onClose: () => void }) {
  const [name, setName] = useState(list?.name ?? '')
  const [color, setColor] = useState(list?.color ?? PALETTE[1])
  const save = async () => {
    if (!name.trim()) return
    if (list) await updateList(list.id, { name: name.trim(), color })
    else navigate(`list/${(await createList(name, color)).id}`)
    onClose()
  }
  return (
    <Modal
      title={list ? 'Список' : 'Новый список'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!name.trim()}>
            {list ? 'Сохранить' : 'Создать'}
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
        <Field label="Название">
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Школа" />
        </Field>
        <Field label="Цвет">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </form>
    </Modal>
  )
}
