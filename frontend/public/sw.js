/* Offline application shell only. API, sessions, streams and user data are never cached here. */
const SHELL = 'spoty-shell-v1';
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(SHELL);
  const response = await fetch('/', { credentials: 'omit', cache: 'reload' });
  if (!response.ok) throw Error('Shell unavailable');
  const html = await response.clone().text();
  await cache.put('/', response);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(match => match[1]);
  await cache.addAll([...new Set(['/icon.svg', ...assets])]);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.search) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try { const response = await fetch(request); if (response.ok && url.pathname === '/') await cache.put('/', response.clone()); return response; }
      catch { return await cache.match('/') || Response.error(); }
    })());
  } else if (/^\/(assets|avatars)\//.test(url.pathname) || url.pathname === '/icon.svg') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL), cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - 64))) if (new URL(old.url).pathname.startsWith('/assets/')) await cache.delete(old);
      }
      return response;
    })());
  }
});
