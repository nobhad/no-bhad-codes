/**
 * Service Worker for NO BHAD WORKS PWA
 * Implements caching strategies and offline functionality
 */

const CACHE_NAME = 'nbw-v10.0.9';
const RUNTIME_CACHE = 'nbw-runtime';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/fonts/Acme/Acme-Regular.woff2',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/images/business-card_front.svg',
  '/images/business-card_back.svg',
  '/images/coyote_paw.svg',
  '/images/avatar.svg',
  '/favicon.ico',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests
  if (url.origin !== location.origin) {
    // For external resources like CDNs, use network first
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
    );
    return;
  }

  // For navigation requests, try network first for fresh content
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the new response
          return caches.open(RUNTIME_CACHE)
            .then(cache => {
              cache.put(request, response.clone());
              return response;
            });
        })
        .catch(() => {
          // Fallback to cache or offline page
          return caches.match(request)
            .then(response => response || caches.match('/'));
        })
    );
    return;
  }

  // For static assets, use cache first
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request))
    );
    return;
  }

  // For everything else, network first with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200) {
          return response;
        }

        // Cache the response
        return caches.open(RUNTIME_CACHE)
          .then(cache => {
            cache.put(request, response.clone());
            return response;
          });
      })
      .catch(() => caches.match(request))
  );
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});