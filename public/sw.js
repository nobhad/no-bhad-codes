/**
 * ===============================================
 * SERVICE WORKER
 * ===============================================
 * @file public/sw.js
 *
 * Progressive Web App service worker.
 * Strategies:
 *   - Network-first for API requests (always fresh data)
 *   - Cache-first for static assets (fast loads)
 *   - Offline fallback page when network unavailable
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `nbc-static-${CACHE_VERSION}`;
const API_CACHE = `nbc-api-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

/**
 * Static assets to pre-cache on install.
 * Keep this list minimal — only critical shell assets.
 */
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

/**
 * File extensions that should use cache-first strategy.
 */
const STATIC_EXTENSIONS = [
  '.css', '.js', '.mjs',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
  '.json', '.webmanifest'
];

// ============================================
// INSTALL
// ============================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATE
// ============================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ============================================
// FETCH
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // API requests: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }
});

// ============================================
// STRATEGIES
// ============================================

/**
 * Network-first: try network, fall back to cache.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Network error', { status: 503 });
  }
}

/**
 * Cache-first: try cache, fall back to network.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Network error', { status: 503 });
  }
}

/**
 * Network-first for navigation, with offline fallback page.
 */
async function networkFirstWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return caches.match(OFFLINE_URL);
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if a pathname is a static asset based on extension.
 */
function isStaticAsset(pathname) {
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}
