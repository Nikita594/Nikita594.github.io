/**
 * Service worker нужен для работы без интернета и установки приложения.
 * В однофайловой версии (file://) он невозможен — просто не регистрируем.
 */
export function registerServiceWorker(onUpdated: () => void) {
  if (__SINGLE_FILE__ || !import.meta.env.PROD) return
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) onUpdated()
  })
  const register = () =>
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* без service worker приложение всё равно работает, только без офлайн-режима */
    })
  if (document.readyState === 'complete') void register()
  else window.addEventListener('load', () => void register(), { once: true })
}

/** Просим браузер не удалять данные при нехватке места. Ответ не важен — это просьба. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* не поддерживается — ничего страшного */
  }
}

export const isSingleFile = __SINGLE_FILE__
