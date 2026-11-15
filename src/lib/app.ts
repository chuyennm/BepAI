import { useEffect, useState, useSyncExternalStore } from 'react'

// ───────── Thông báo nhanh (toast) ─────────
const TOAST_EVENT = 'bepai:toast'

export function toast(message: string): void {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }))
}

export function useToast(): string | null {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let timer = 0
    const onToast = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(null), 2600)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast)
      window.clearTimeout(timer)
    }
  }, [])
  return message
}

// ───────── Trạng thái mạng ─────────
const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}

// ───────── Cài đặt PWA ─────────
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: InstallPromptEvent | null = null
const installListeners = new Set<() => void>()
const notifyInstall = () => installListeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    notifyInstall()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyInstall()
  })
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Trả về hàm mở hộp thoại cài đặt, hoặc null nếu trình duyệt chưa cho phép. */
export function useInstallPrompt(): (() => Promise<boolean>) | null {
  const available = useSyncExternalStore(
    (notify) => {
      installListeners.add(notify)
      return () => installListeners.delete(notify)
    },
    () => deferredPrompt !== null,
  )
  if (!available) return null
  return async () => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    notifyInstall()
    return outcome === 'accepted'
  }
}

export function registerServiceWorker(): void {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // Khi có bản mới, service worker mới nhận quyền điều khiển → tải lại một lần để dùng ngay bản mới.
    const hadController = !!navigator.serviceWorker.controller
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return
      reloaded = true
      window.location.reload()
    })
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* không đăng ký được (ví dụ mở bằng file://): app vẫn chạy bình thường khi có mạng */
      })
    })
  }
}
