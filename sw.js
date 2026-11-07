/* KhatiGhor service worker.
   - HTML pages: network first (always fresh), saved copy only when offline.
   - Files with a ?v= version (css/js): cache first — the version in the URL changes whenever they change.
   - Images / icons / other static files: show the saved copy instantly and refresh it in the background.
   - Never touches the admin panel, API calls or other websites (fonts, icons, Apps Script). */
const CACHE = "khatighor-v45";
const SHELL = ["./", "index.html", "favicon.svg", "manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (/\/admin/i.test(url.pathname) || url.pathname.endsWith("sw.js")) return; // admin must always be live

  // HTML / navigation → network first
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(fetch(req).then((res) => put(req, res)).catch(() => caches.match(req).then((r) => r || caches.match("index.html"))));
    return;
  }
  // versioned css/js → cache first
  if (url.searchParams.has("v") && /\.(css|js)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  // everything else (images, svg, icons, manifest) → stale-while-revalidate
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => put(req, res)).catch(() => hit);
      return hit || net;
    })
  );
});
