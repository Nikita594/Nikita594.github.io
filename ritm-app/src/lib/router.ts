import { useSyncExternalStore } from 'react'

// Навигация через «#/путь»: работает и на GitHub Pages, и при открытии файла двойным кликом.

export interface Route {
  /** Первая часть пути: 'today', 'list', 'week'… */
  name: string
  /** Остальные части: для '#/list/abc' → ['abc']. */
  params: string[]
  query: URLSearchParams
}

export const DEFAULT_ROUTE = 'today'

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const [path, qs = ''] = raw.split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  return { name: parts[0] || DEFAULT_ROUTE, params: parts.slice(1), query: new URLSearchParams(qs) }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const hash = '#/' + path.replace(/^\/+/, '')
  if (opts.replace) history.replaceState(null, '', hash)
  else if (window.location.hash !== hash) window.location.hash = hash
  if (opts.replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function href(path: string) {
  return '#/' + path.replace(/^\/+/, '')
}
