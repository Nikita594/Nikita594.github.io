import type { ReactNode } from 'react'
import { Screen } from '../../ui/Screen'
import { CategoriesSettings } from './CategoriesSettings'

export function SettingsSection({ title, children, hint }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function SettingsScreen() {
  return (
    <Screen title="Настройки">
      <SettingsSection title="Категории времени" hint="По ним считается, на что уходит время.">
        <CategoriesSettings />
      </SettingsSection>
    </Screen>
  )
}
