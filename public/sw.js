/* BepAI Service Worker
 * - Cache-First cho app shell và tài nguyên tĩnh (precache khi cài đặt).
 * - Network-First cho mọi request ra ngoài (API của AI), có cache dự phòng cho GET.
 * Khi build, vite.config.ts chèn self.__BUILD__ và self.__PRECACHE__ vào đầu file này.
 */
const BUILD = self.__BUILD__ || 'dev'
const PRECACHE = self.__PRECACHE__ || ['./']
const STATIC_CACHE = `bepai-static-${BUILD}`
const RUNTIME_CACHE = 'bepai-runtime'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('bepai-static-') && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request, { ignoreSearch: true })
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    if (request.mode === 'navigate') {
      const shell = (await cache.match('./index.html')) || (await cache.match('./'))
      if (shell) return shell
    }
    throw err
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    // Ảnh món ăn tải kiểu no-cors trả về response "opaque" — vẫn lưu để xem lại khi mất mạng.
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return // POST tới API AI: luôn đi thẳng ra mạng
  const url = new URL(request.url)
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request))
  } else if (request.destination === 'image') {
    // Ảnh món ăn không đổi: lấy từ cache trước cho nhanh và xem được khi mất mạng.
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => (await cache.match(request)) || networkFirst(request)),
    )
  } else if (url.protocol.startsWith('http')) {
    event.respondWith(networkFirst(request))
  }
})
