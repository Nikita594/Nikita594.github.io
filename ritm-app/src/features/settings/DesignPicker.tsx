import { setSetting, useSettings, type ThemeSetting } from '../../db/settings'
import { DESIGNS, getDesign, type Design } from '../../designs/designs'
import { Icon } from '../../ui/icons'
import { cx } from '../../ui/kit'

/** Маленький «экран» в стиле дизайна. Стили берутся из того же дизайна: data-design на самом превью. */
function Preview({ design }: { design: Design }) {
  return (
    <div
      data-design={design.id}
      className="ui-preview pointer-events-none flex h-28 flex-col gap-1.5 overflow-hidden p-3 text-text"
      aria-hidden="true"
    >
      <div className="ui-hero-title text-lg leading-none">
        17 <b>окт</b>
      </div>
      <div className="ui-task flex items-center gap-2 px-1.5 py-1" data-done="false">
        <span className="ui-check" data-priority="3" style={{ width: 14, height: 14, borderWidth: 2 }} />
        <span className="ui-task-title truncate text-[11px]">SAT Math</span>
      </div>
      <div className="ui-task flex items-center gap-2 px-1.5 py-1" data-done="true">
        <span className="ui-check flex items-center justify-center" aria-checked="true" style={{ width: 14, height: 14 }}>
          <Icon name="check" size={9} strokeWidth={3.5} />
        </span>
        <span className="ui-task-title truncate text-[11px]">Английский</span>
      </div>
      <div className="mt-auto flex gap-1">
        {[38, 60, 30, 72, 55].map((h, i) => (
          <span key={i} className="ui-load-bar w-2 rounded-sm" data-today={i === 3} style={{ height: h / 6 }} />
        ))}
      </div>
    </div>
  )
}

export function DesignPicker() {
  const settings = useSettings()
  const current = getDesign(settings.design)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Дизайн">
        {DESIGNS.map((d) => {
          const on = d.id === current.id
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={d.name}
              onClick={() => void setSetting('design', d.id)}
              className={cx(
                'flex flex-col overflow-hidden rounded-ctl text-left ring-offset-2 ring-offset-bg transition',
                on ? 'ring-2 ring-accent' : 'ring-1 ring-line hover:ring-faint',
              )}
            >
              <Preview design={d} />
              <span className="flex items-start gap-1.5 bg-surface px-2.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{d.name}</span>
                  <span className="block text-[11px] leading-snug text-muted">{d.description}</span>
                </span>
                {on && <Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent" />}
              </span>
            </button>
          )
        })}
      </div>
      {current.dark === 'theme' && (
        <div className="flex gap-1 rounded-ctl bg-surface-2 p-1" role="radiogroup" aria-label="Тема">
          {(
            [
              ['system', 'Как в системе'],
              ['light', 'Светлая'],
              ['dark', 'Тёмная'],
            ] as [ThemeSetting, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={settings.theme === value}
              onClick={() => void setSetting('theme', value)}
              className={cx(
                'h-9 flex-1 rounded-ctl text-sm',
                settings.theme === value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
