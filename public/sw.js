// The installed app's service worker. Nothing is cached but the offline
// page: every page, script and API call still comes from the server, so a
// deploy is never hidden behind a stale copy. When a page can't be loaded
// at all (no connection), the offline page is shown instead of the
// browser's error.
//
// Lives at the site root (not in public/js, which is bundled) so its scope
// is the whole site. Bump CACHE when offline.html or its image changes.
const CACHE = 'offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll([OFFLINE_URL, '/images/app-icon-192.png']))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
        // Starts the page's request while the worker boots, so having a
        // worker doesn't slow page loads down
        if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method === 'GET' && req.url.endsWith('/images/app-icon-192.png')) {
        event.respondWith(fetch(req).catch(() => caches.match(req)));
        return;
    }
    if (req.mode !== 'navigate') return;
    event.respondWith((async () => {
        try {
            return (await event.preloadResponse) || await fetch(req);
        } catch (err) {
            return (await caches.match(OFFLINE_URL)) || Response.error();
        }
    })());
});
