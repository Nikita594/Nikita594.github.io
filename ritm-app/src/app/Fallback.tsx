import { Component, type ReactNode } from 'react'
import { Logo } from '../ui/Logo'

/** Экран вместо приложения, если что-то пошло совсем не так. Без хранилища приложение работать не может. */
export function FallbackScreen({ storage }: { storage: boolean }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
      <Logo size={40} />
      {storage ? (
        <>
          <h1 className="text-xl font-semibold">Браузер не даёт сохранять данные</h1>
          <p className="text-sm text-muted">
            Так бывает в Safari, если открыть файл ritm.html с диска, или в приватном режиме. Откройте файл в Chrome или Яндекс Браузере —
            или пользуйтесь сайтом nikita594.github.io/ritm.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Что-то сломалось</h1>
          <p className="text-sm text-muted">Данные на месте — они хранятся отдельно. Попробуйте перезагрузить страницу.</p>
        </>
      )}
      <button
        type="button"
        className="h-10 self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent"
        onClick={() => location.reload()}
      >
        Перезагрузить
      </button>
    </div>
  )
}

/** Ловит ошибки отрисовки (например, потерянное соединение с IndexedDB на iPhone), чтобы не было пустого экрана. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <FallbackScreen storage={false} /> : this.props.children
  }
}
