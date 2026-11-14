import { useEffect, useState } from 'react'

/**
 * Giữ màn hình luôn sáng khi `active` (Screen Wake Lock API).
 * Trình duyệt tự nhả khoá khi tab bị ẩn, nên xin lại mỗi lần tab hiện trở lại.
 */
export function useWakeLock(active: boolean): boolean {
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
        setLocked(true)
        lock.addEventListener('release', () => setLocked(false))
      } catch {
        setLocked(false) // pin yếu / chế độ tiết kiệm pin có thể từ chối
      }
    }

    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      void sentinel?.release()
      setLocked(false)
    }
  }, [active])

  return locked
}
