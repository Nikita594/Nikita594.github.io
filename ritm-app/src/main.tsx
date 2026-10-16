import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { ErrorBoundary, FallbackScreen } from './app/Fallback'
import { db } from './db/db'
import './styles.css'

const root = createRoot(document.getElementById('root')!)

// Сначала открываем базу: если браузер не даёт хранить данные, показываем понятное сообщение вместо белого экрана.
db.open().then(
  () =>
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    ),
  () => root.render(<FallbackScreen storage />),
)
