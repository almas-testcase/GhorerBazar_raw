/* খাঁটিঘর সার্ভিস ওয়ার্কার — নেটওয়ার্ক-ফার্স্ট (সবসময় নতুন ফাইল আনে), ইন্টারনেট না থাকলে সংরক্ষিত কপি দেখায়।
   সাইট আপডেট করলে পুরনো কপি আটকে থাকে না। বাইরের API/ফন্ট/ছবি ক্যাশ করা হয় না। */
const CACHE = "khatighor-v21";
const SHELL = ["./", "index.html", "shop.html", "product.html", "cart.html", "checkout.html", "track.html", "style.css?v=21", "pages.css?v=21", "script.js", "pages.js", "config.js", "theme.js", "favicon.svg", "manifest.webmanifest", "images/mustard-oil.svg", "images/honey.svg", "images/cashews.svg", "images/turmeric.svg", "images/chili.svg", "images/ghee.svg", "images/sslcommerz.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
  );
});
