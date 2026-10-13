import { useEffect, useState } from 'react'
import { inputCls } from '../../ui/kit'

/** Число с подписью; сохраняется, когда значение корректное. */
export function NumberSetting({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2 text-muted">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          aria-label={label}
          className={inputCls + ' w-20 text-right'}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = Math.round(Number(e.target.value))
            if (e.target.value !== '' && n >= min && n <= max) onChange(n)
          }}
          onBlur={() => setDraft(String(value))}
        />
        {suffix && <span className="w-8">{suffix}</span>}
      </span>
    </label>
  )
}
