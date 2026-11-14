import { useCallback, useSyncExternalStore } from 'react'

/**
 * Lưu trữ cục bộ (localStorage) có đồng bộ giữa các component.
 * Mọi dữ liệu người dùng — món đã lưu, ghi chú, danh sách đi chợ, API key —
 * chỉ nằm trên thiết bị này nên dùng được khi mất mạng.
 */
const PREFIX = 'bepai:'
const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

export function getStored<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T
  let value = fallback
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw != null) value = JSON.parse(raw) as T
  } catch {
    /* dữ liệu hỏng hoặc bị chặn localStorage: dùng mặc định */
  }
  cache.set(key, value)
  return value
}

export function setStored<T>(key: string, value: T): void {
  cache.set(key, value)
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* hết dung lượng: vẫn giữ trong bộ nhớ phiên này */
  }
  listeners.get(key)?.forEach((notify) => notify())
}

export function useStored<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (notify: () => void) => {
      let set = listeners.get(key)
      if (!set) listeners.set(key, (set = new Set()))
      set.add(notify)
      return () => {
        set.delete(notify)
      }
    },
    [key],
  )
  const value = useSyncExternalStore(subscribe, () => getStored(key, fallback))
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = getStored(key, fallback)
      setStored(key, typeof next === 'function' ? (next as (p: T) => T)(prev) : next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return [value, update]
}
