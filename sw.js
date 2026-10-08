/* ============================================================
   Service worker da Figaro's:
   - imagens do site: mostra na hora a cópia salva e atualiza por trás
   - páginas, CSS, JS e cardápio: sempre da rede (nada fica velho);
     a cópia salva só é usada sem internet
   - API, painel e qualquer outro domínio: não passam por aqui
   Para invalidar tudo, troque VERSION.
   ============================================================ */
const VERSION = "fg-2026-10-08-futuro";
const PAGES = `${VERSION}-pages`;
const IMAGES = `${VERSION}-images`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const home = await cache.match(new URL("./", self.registration.scope).href);
      if (home) return home;
    }
    throw err;
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(event.request);
  const update = fetch(event.request).then((response) => {
    if (response.ok && response.type === "basic") cache.put(event.request, response.clone());
    return response;
  });
  if (cached) { event.waitUntil(update.catch(() => {})); return cached; }
  return update;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (/\/(api|admin)(\/|$)/.test(path) || path.endsWith("/sw.js")) return;
  if (request.destination === "image" || /\/(assets|uploads)\//.test(path)) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }
  event.respondWith(networkFirst(request));
});
