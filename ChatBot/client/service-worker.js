const CACHE_NAME = 'chatbot-cache-v1';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/styles.css',
    '/app/index.js',
    '/app/modules/chatUI.js',
    '/app/modules/formHandler.js',
    '/app/modules/themeHandler.js',
    '/images/favicon.ico',
    '/images/logo.png',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            // Cache static assets
            await cache.addAll(STATIC_ASSETS);
            // Cache offline page
            const offlineResponse = new Response(
                '<html><head><title>Offline</title><link rel="stylesheet" href="/styles.css"></head>' +
                '<body><div class="container"><h1>You are offline</h1>' +
                '<p>Please check your internet connection and try again.</p></div></body></html>',
                {
                    headers: { 'Content-Type': 'text/html' }
                }
            );
            await cache.put(OFFLINE_URL, offlineResponse);
        })()
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
            // Claim clients immediately
            await clients.claim();
        })()
    );
});

// Helper function to determine if a request is for an API endpoint
const isApiRequest = (request) => {
    return request.url.includes('/api/');
};

// Helper function to determine if a request is for a static asset
const isStaticAsset = (url) => {
    return STATIC_ASSETS.some(asset => url.endsWith(asset));
};

// Helper function to create a Response for network errors
const createNetworkErrorResponse = () => {
    return new Response(
        JSON.stringify({
            error: 'Network error. Please check your connection and try again.'
        }),
        {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        }
    );
};

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);

                // Try the network first
                try {
                    const networkResponse = await fetch(event.request);
                    
                    // Cache successful GET requests for static assets
                    if (event.request.method === 'GET' && isStaticAsset(event.request.url)) {
                        await cache.put(event.request, networkResponse.clone());
                    }
                    
                    return networkResponse;
                } catch (error) {
                    // Network failed, try cache
                    const cachedResponse = await cache.match(event.request);
                    
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // If it's an API request, return a network error response
                    if (isApiRequest(event.request)) {
                        return createNetworkErrorResponse();
                    }

                    // For page requests, return the offline page
                    if (event.request.mode === 'navigate') {
                        const offlineResponse = await cache.match(OFFLINE_URL);
                        return offlineResponse;
                    }

                    // For other requests, throw the error
                    throw error;
                }
            } catch (error) {
                console.error('Service Worker Error:', error);
                return createNetworkErrorResponse();
            }
        })()
    );
});

// Handle background sync for queued messages
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-messages') {
        event.waitUntil(
            (async () => {
                try {
                    const cache = await caches.open(CACHE_NAME);
                    const requests = await cache.keys();
                    const queuedRequests = requests.filter(request => 
                        request.url.includes('/api/openai') && 
                        request.method === 'POST'
                    );

                    await Promise.all(queuedRequests.map(async (request) => {
                        try {
                            await fetch(request);
                            await cache.delete(request);
                        } catch (error) {
                            console.error('Failed to sync message:', error);
                        }
                    }));
                } catch (error) {
                    console.error('Sync error:', error);
                }
            })()
        );
    }
});

// Handle push notifications
self.addEventListener('push', (event) => {
    const options = {
        body: event.data.text(),
        icon: '/images/logo.png',
        badge: '/images/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View Message'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('New Message', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});
