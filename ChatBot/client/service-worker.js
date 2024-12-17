/**
 * Service Worker (service-worker.js)
 * 
 * This service worker implements advanced caching strategies and offline support
 * for the Morgan White Group ChatBot. It provides:
 * 
 * Features:
 * - Static asset caching
 * - Runtime caching strategies
 * - Offline fallback
 * - Cache versioning
 * - Background sync
 * - Error handling
 * 
 * Caching Strategies:
 * 1. Network First: For API endpoints (with timeout)
 * 2. Cache First: For static assets and images
 * 3. Stale While Revalidate: For external resources
 * 
 * Related files:
 * - index.html: Main application shell
 * - app/index.js: Service worker registration
 */

// Cache version for updates
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `mwg-chatbot-${CACHE_VERSION}`;

/**
 * Static assets to cache on service worker installation
 * These files form the application shell
 */
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app/index.js',
    '/app/modules/chatUI.js',
    '/app/modules/formHandler.js',
    '/app/modules/themeHandler.js',
    '/images/logo.png',
    '/images/favicon.ico'
];

/**
 * Runtime caching configuration
 * Defines caching strategies for different types of requests
 */
const RUNTIME_CACHE_CONFIG = {
    // Network-first strategy for API endpoints
    networkFirst: [
        '/api/openai',
        '/api/session'
    ],
    // Cache-first strategy for static assets
    cacheFirst: [
        '/images/',
        'https://morganwhite.com/common/img/'
    ],
    // Stale-while-revalidate for third-party resources
    staleWhileRevalidate: [
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
    ]
};

/**
 * Install Event Handler
 * Caches static assets and enables immediate activation
 */
self.addEventListener('install', event => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            // Cache static assets with error handling
            await Promise.all(
                STATIC_ASSETS.map(async url => {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
                        await cache.put(url, response);
                    } catch (error) {
                        console.error(`Failed to cache ${url}:`, error);
                    }
                })
            );
            // Skip waiting to activate new service worker immediately
            await self.skipWaiting();
        })()
    );
});

/**
 * Activate Event Handler
 * Cleans up old caches and claims clients
 */
self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            // Clean up old caches
            const cacheKeys = await caches.keys();
            await Promise.all(
                cacheKeys
                    .filter(key => key.startsWith('mwg-chatbot-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
            // Take control of all clients immediately
            await self.clients.claim();
        })()
    );
});

/**
 * Fetch Event Handler
 * Routes requests to appropriate caching strategies
 */
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(handleFetch(event.request));
});

/**
 * Main fetch handler
 * Routes requests to appropriate caching strategy
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} The response
 */
async function handleFetch(request) {
    const url = new URL(request.url);

    // API endpoints - Network First
    if (RUNTIME_CACHE_CONFIG.networkFirst.some(endpoint => url.pathname.startsWith(endpoint))) {
        return handleNetworkFirst(request);
    }

    // Static assets - Cache First
    if (RUNTIME_CACHE_CONFIG.cacheFirst.some(path => url.pathname.startsWith(path) || request.url.includes(path))) {
        return handleCacheFirst(request);
    }

    // External resources - Stale While Revalidate
    if (RUNTIME_CACHE_CONFIG.staleWhileRevalidate.some(domain => request.url.includes(domain))) {
        return handleStaleWhileRevalidate(request);
    }

    // Default to network first for everything else
    return handleNetworkFirst(request);
}

/**
 * Network First strategy implementation
 * Attempts network request first, falls back to cache
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} The response
 */
async function handleNetworkFirst(request) {
    const TIMEOUT = 3000; // 3 second timeout

    try {
        // Try network first with timeout
        const networkPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Network timeout')), TIMEOUT)
        );

        const response = await Promise.race([networkPromise, timeoutPromise]);
        
        // Cache successful responses
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        // If no cached response, return offline fallback
        return handleOfflineFallback(request);
    }
}

/**
 * Cache First strategy implementation
 * Checks cache first, falls back to network
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} The response
 */
async function handleCacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) return cachedResponse;

    try {
        const networkResponse = await fetch(request);
        await cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        return handleOfflineFallback(request);
    }
}

/**
 * Stale While Revalidate strategy implementation
 * Returns cached response immediately while updating cache in background
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} The response
 */
async function handleStaleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Revalidate cache in the background
    const updateCache = async () => {
        try {
            const networkResponse = await fetch(request);
            await cache.put(request, networkResponse.clone());
            return networkResponse;
        } catch (error) {
            console.error('Background sync failed:', error);
            return null;
        }
    };

    // Return cached response immediately if available
    if (cachedResponse) {
        updateCache(); // Update cache in background
        return cachedResponse;
    }

    // If no cached response, wait for network
    const networkResponse = await updateCache();
    return networkResponse || handleOfflineFallback(request);
}

/**
 * Offline fallback handler
 * Provides appropriate fallback responses when offline
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} The fallback response
 */
async function handleOfflineFallback(request) {
    // Return offline page for HTML requests
    if (request.headers.get('Accept').includes('text/html')) {
        const cache = await caches.open(CACHE_NAME);
        const offlineResponse = await cache.match('/index.html');
        if (offlineResponse) return offlineResponse;
    }

    // Return offline image for image requests
    if (request.headers.get('Accept').includes('image')) {
        const cache = await caches.open(CACHE_NAME);
        const offlineImage = await cache.match('/images/logo.png');
        if (offlineImage) return offlineImage;
    }

    // Default offline response
    return new Response('Offline - Content not available', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store'
        })
    });
}

/**
 * Error Event Handler
 * Logs service worker errors
 */
self.addEventListener('error', event => {
    console.error('Service Worker error:', event.error);
});

/**
 * Unhandled Rejection Handler
 * Logs unhandled promise rejections
 */
self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker unhandled rejection:', event.reason);
});
