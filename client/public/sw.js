/* NEONSPIRE service worker: precache the shell, stale-while-revalidate for
 * same-origin static assets, network-only for the API and WebSocket. */
const CACHE = 'neonspire-v1'
const SHELL = ['.', 'index.html', 'manifest.webmanifest', 'icon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname === '/admin') return // network-only
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request)
        .then((res) => {
          const cacheable =
            url.pathname === '/' || /\.(js|css|html|svg|png|woff2?|webmanifest|json)$/.test(url.pathname)
          if (res.ok && cacheable) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => cached ?? caches.match('index.html'))
      // stale-while-revalidate: cached copy now, refresh in the background
      return cached ?? fresh
    }),
  )
})
