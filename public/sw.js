/* Saath service worker — app-shell caching and an offline fallback.
   It never caches authenticated API responses, sharing tokens or SOS data. */
const VERSION = 'saath-v1'
const SHELL_CACHE = `${VERSION}-shell`
const TILE_CACHE = `${VERSION}-tiles`
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon.svg',
]
const TILE_LIMIT = 120

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= limit) return
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Never cache API calls, and never intercept cross-origin non-tile requests.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return

  const isTile =
    url.hostname.endsWith('basemaps.cartocdn.com') ||
    url.hostname.endsWith('tile.openstreetmap.org')

  if (isTile) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        try {
          const response = await fetch(request)
          if (response.ok) {
            await cache.put(request, response.clone())
            trimCache(TILE_CACHE, TILE_LIMIT)
          }
          return response
        } catch {
          return new Response('', { status: 504, statusText: 'Offline' })
        }
      }),
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(SHELL_CACHE)
          cache.put('/index.html', response.clone())
          return response
        } catch {
          const cache = await caches.open(SHELL_CACHE)
          return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error()
        }
      })(),
    )
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        try {
          const response = await fetch(request)
          if (response.ok && response.type === 'basic') {
            cache.put(request, response.clone())
          }
          return response
        } catch {
          return new Response('', { status: 504, statusText: 'Offline' })
        }
      }),
    )
  }
})
