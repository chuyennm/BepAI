import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'recipe'; id: string }
  | { name: 'cook'; id: string }
  | { name: 'ai' }
  | { name: 'shop' }
  | { name: 'saved' }
  | { name: 'settings' }

function parse(hash: string): Route {
  const [, first, second] = hash.replace(/^#/, '').split('/')
  const id = second ? decodeURIComponent(second) : ''
  if (first === 'r' && id) return { name: 'recipe', id }
  if (first === 'cook' && id) return { name: 'cook', id }
  if (first === 'ai' || first === 'shop' || first === 'saved' || first === 'settings') return { name: first }
  return { name: 'home' }
}

const subscribe = (notify: () => void) => {
  window.addEventListener('hashchange', notify)
  return () => window.removeEventListener('hashchange', notify)
}

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}

export function navigate(path: string): void {
  window.location.hash = path
}

export function goBack(fallback = '/'): void {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback)
}
