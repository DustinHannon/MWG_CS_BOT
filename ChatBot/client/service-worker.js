// Cache names
const CACHE_NAME = 'mwg-chatbot-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app/index.js',
    '/app/modules/chatUI.js',
    '/app/modules/formHandler.js',
    '/app/modules/themeHandler.js',
    '/images/logo.png',
    '/images/favicon.ico',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(error => {
                console.error('Error caching static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map(name => {
                            console.log('Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API requests
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached response if found
                if (response) {
                    return response;
                }

                // Otherwise fetch from network
                return fetch(event.request)
                    .then(networkResponse => {
                        // Cache dynamic assets
                        if (shouldCacheResponse(networkResponse)) {
                            return caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(event.request, networkResponse.clone());
                                    return networkResponse;
                                });
                        }
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('Fetch error:', error);
                        // Return offline page or fallback content
                        return caches.match('/offline.html');
                    });
            })
    );
});

// Helper function to determine if response should be cached
function shouldCacheResponse(response) {
    // Only cache successful responses
    if (!response || response.status !== 200) return false;

    // Only cache GET requests
    if (response.method !== 'GET') return false;

    // Check content type
    const contentType = response.headers.get('content-type');
    if (contentType) {
        // Cache common static asset types
        return contentType.includes('text/html') ||
               contentType.includes('text/css') ||
               contentType.includes('application/javascript') ||
               contentType.includes('image/');
    }

    return false;
}

// Handle errors
self.addEventListener('error', event => {
    console.error('Service Worker error:', event.error);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker unhandled rejection:', event.reason);
});
