/* =====================================================
   ১. আপনার নিজের তথ্য এখানে বদলান
   ===================================================== */
const CONFIG = {
  // Web App URL এখন config.js ফাইলে বসাতে হবে
  API_URL: SITE_API_URL,

  // নিচের তথ্যগুলো Google Sheet-এর Settings ট্যাব/অ্যাডমিন প্যানেল থেকে বদলালে সেটাই কাজ করবে।
  // শিট সংযোগ না থাকলে এগুলো ব্যবহার হয়।
  DEFAULTS: {
    deliveryInside: 70,
    deliveryOutside: 120,
    freeDeliveryAbove: 1500,
    whatsapp: "8801852677251",
    phone: "01852677251",
    bkash: "01XXXXXXXXX",
    nagad: "01XXXXXXXXX",
    notice: "",
    email: "", address: "", hours: "", facebook: "", linkedin: "", tiktok: "",
    offerEndsAt: "", offerText: "", promoCoupon: ""
  }
};

// শিট সংযোগের আগে দেখানোর নমুনা পণ্য (সংযোগ হলে শিটের পণ্য দেখাবে)
const DEMO_PRODUCTS = [
  { id: 1, name: "Pure Mustard Oil", unit: "1 litre", category: "Oil", price: 320, oldPrice: 380, emoji: "🫒", image: "images/mustard-oil.svg", tag: "Best Seller", stock: 50, desc: "100% pure mustard oil, cold-pressed the traditional way. Strong aroma and taste with no adulteration or additives." },
  { id: 2, name: "Sundarban Pure Honey", unit: "500 g", category: "Honey", price: 650, oldPrice: 780, emoji: "🍯", image: "images/honey.svg", tag: "20% Off", stock: 30, desc: "Natural honey from seasonal Sundarban flowers. Unprocessed, with no added sugar." },
  { id: 3, name: "Cashew Nuts (Premium)", unit: "500 g", category: "Nuts", price: 780, oldPrice: 900, emoji: "🥜", image: "images/cashews.svg", tag: "", stock: 40, desc: "Large, fresh and crunchy cashew nuts. Great for snacking and cooking." },
  { id: 4, name: "Turmeric Powder", unit: "500 g", category: "Spices", price: 240, oldPrice: 280, emoji: "🟡", image: "images/turmeric.svg", tag: "", stock: 60, desc: "Made from selected raw turmeric, pure and free from artificial colour." },
  { id: 5, name: "Chilli Powder", unit: "500 g", category: "Spices", price: 290, oldPrice: 340, emoji: "🌶️", image: "images/chili.svg", tag: "New", stock: 60, desc: "Hot and aromatic dried chilli powder with no adulteration or artificial colour." },
  { id: 6, name: "Pure Ghee (Desi)", unit: "500 g", category: "Ghee", price: 890, oldPrice: 1050, emoji: "🧈", image: "images/ghee.svg", tag: "", stock: 20, desc: "Granular pure ghee made from desi cow-milk butter. The authentic taste is clear from the aroma." }
];

/* =====================================================
   ২. এখান থেকে নিচে সাধারণত কিছু বদলানোর দরকার নেই
   ===================================================== */
const bn = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
const toBn = (n) => String(n); // numbers are shown with Latin digits
const toEn = (s) => String(s).replace(/[০-৯]/g, (d) => bn.indexOf(d));
const money = (n) => "৳" + toBn(Number(n).toLocaleString("en-US"));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
// সোশ্যাল লিংক শুধু https:// হলে গ্রহণযোগ্য (অ্যাডমিন সেটিংস → config.js এর SITE_SOCIAL)
const httpsOnly = (u) => (/^https:\/\/[^\s]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");
const socialLinks = () => {
  const cfg = typeof SITE_SOCIAL !== "undefined" ? SITE_SOCIAL : {};
  const s = state.settings || {};
  return { facebook: httpsOnly(s.facebook || cfg.facebook), twitter: httpsOnly(s.twitter || cfg.twitter), instagram: httpsOnly(s.instagram || cfg.instagram), linkedin: httpsOnly(s.linkedin || cfg.linkedin), tiktok: httpsOnly(s.tiktok || cfg.tiktok) };
};
// শুধু http(s), #অ্যাঙ্কর বা সাইটের ভেতরের পথ; javascript:/data: নয়
const safeHref = (u) => { u = String(u || "").trim(); return u && !/^(javascript|data|vbscript):/i.test(u) && /^(#|https?:\/\/|\/|[\w.\-]+\/|[\w.\-]+$)/i.test(u) ? u : ""; };
const form = $("orderForm");
const connected = () => !CONFIG.API_URL.includes("WEB_APP_URL");

const state = {
  products: [],
  settings: { ...CONFIG.DEFAULTS },
  cart: [],
  coupon: null,
  category: "All",
  minPrice: "",
  maxPrice: "",
  inStock: false,
  offerOnly: false,
  topRated: false
};

/* --- সংরক্ষিত কার্ট --- */
try { state.cart = JSON.parse(localStorage.getItem("cart")) || []; } catch (e) { state.cart = []; }
const saveCart = () => { try { localStorage.setItem("cart", JSON.stringify(state.cart)); } catch (e) {} };

/* --- পপ-আপ বার্তা --- */
let toastTimer;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* --- Meta Pixel (Facebook) ---
   Pixel ID পাওয়া মাত্র নিজে থেকে চালু হয় (অ্যাডমিন > সেটিংস, না থাকলে config.js)।
   ID না থাকলে কিছুই লোড হয় না। ব্রাউজারে "Do Not Track" চালু থাকলে সম্মান করা হয়। */
const Pixel = {
  ready: false,
  queue: [],
  init(rawId) {
    const id = String(rawId || "").replace(/\D/g, "");
    if (this.ready || id.length < 8 || navigator.doNotTrack === "1") return;
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", id);
    fbq("track", "PageView");
    this.ready = true;
    this.queue.splice(0).forEach((a) => this.track(a[0], a[1], a[2]));
  },
  track(name, params, eventId) {
    if (!this.ready) { if (this.queue.length < 20) this.queue.push([name, params, eventId]); return; }
    try {
      if (eventId) fbq("track", name, params || {}, { eventID: eventId });
      else fbq("track", name, params || {});
    } catch (e) { /* ট্র্যাকিং ব্যর্থ হলে দোকানে প্রভাব নেই */ }
  }
};
const pixelItems = (lines) => ({
  content_ids: lines.map((l) => String(l.p.id)),
  content_type: "product",
  contents: lines.map((l) => ({ id: String(l.p.id), quantity: l.qty })),
  num_items: lines.reduce((n, l) => n + l.qty, 0)
});

/* --- সার্ভারে অনুরোধ --- */
async function api(body) {
  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  return res.json();
}

/* --- Load products & settings: paint instantly from the saved copy (if any), then refresh from the server --- */
function applyShopData(data) {
  state.products = data.products;
  state.categoryList = Array.isArray(data.categories) ? data.categories : [];
  Wish.fromApi = true;
  renderFeatured(data.featured);
  state.settings = { ...state.settings, ...data.settings };
  if (Array.isArray(data.slides) && data.slides.length) Slider.mount(data.slides);
}
function paintShop(final) {
  if (!state.products.length) state.products = DEMO_PRODUCTS;
  applySettings();
  if (final) Pixel.init(state.settings.metaPixelId || (typeof SITE_PIXEL_ID !== "undefined" ? SITE_PIXEL_ID : ""));
  renderChips();
  renderTiles();
  renderProducts();
  updateStructuredData();
  if (Wish.fromApi) Wish.prune();
  Wish.sync();
  // remove cart lines whose product was deleted
  state.cart = state.cart.filter((c) => state.products.some((p) => String(p.id) === String(c.id)));
  renderCart();
  if (!loadShop.done) {
    loadShop.done = true;
    const m = location.hash.match(/^#product-(.+)$/);
    if (m) openView(decodeURIComponent(m[1]), false);
  }
}
async function loadShop() {
  if (connected()) {
    try {
      const warm = window.ShopData && ShopData.cached();
      if (warm && !loadShop.warmed && !state.products.length) { loadShop.warmed = true; applyShopData(warm); paintShop(false); }
      const data = window.ShopData ? await ShopData.load() : await (await fetch(CONFIG.API_URL + "?action=products")).json();
      if (data.ok) { applyShopData(data); if (window.ShopData) ShopData.save(data); }
    } catch (e) { /* sample products are shown below */ }
  }
  paintShop(true);
}

/* --- অফার কাউন্টডাউন: অ্যাডমিন যে সময় দেবে সেই পর্যন্ত চলে, সময় না থাকলে/পেরিয়ে গেলে ব্যান্ড লুকানো --- */
const Offer = {
  timer: null,
  set(endStr, text) {
    clearInterval(this.timer);
    const band = $("offerBand");
    const end = endStr ? new Date(endStr).getTime() : NaN;
    if (!(end > Date.now())) { band.hidden = true; return; }
    $("offerText").textContent = text || "🔥 Special offer ends in:";
    band.hidden = false;
    const pad = (n) => toBn(String(n).padStart(2, "0"));
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      $("t-h").textContent = pad(Math.floor(left / 3600000));
      $("t-m").textContent = pad(Math.floor((left % 3600000) / 60000));
      $("t-s").textContent = pad(Math.floor((left % 60000) / 1000));
      if (left === 0) { clearInterval(this.timer); band.hidden = true; }
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }
};

$("promoA").addEventListener("click", (e) => {
  e.preventDefault();
  const code = $("promoA").dataset.code;
  if (!code) return;
  $("couponInput").value = code;
  if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
  location.href = "checkout.html?coupon=" + encodeURIComponent(code);
});

/* --- হোমপেজে আসল ক্রেতাদের রিভিউ (অনুমোদিত, ৪★+) — না থাকলে সেকশনই দেখায় না --- */
function renderFeatured(list) {
  list = Array.isArray(list) ? list : [];
  $("reviews").hidden = !list.length;
  const palette = ["#F48721", "#2E7D6B", "#5B6EE1", "#C2410C", "#8E5BD9", "#0F766E"];
  const cards = list.map((r, i) => {
    const name = String(r.name || "Customer").trim();
    const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const sub = esc(r.role || r.product || (r.verified ? "Verified buyer" : "Customer"));
    const av = /^https:\/\//.test(r.avatar || "") ? `<span class="rv-av" aria-hidden="true"><img src="${esc(r.avatar)}" alt="" loading="lazy"></span>`
      : `<span class="rv-av" style="background:${palette[i % palette.length]}" aria-hidden="true">${esc(initials)}</span>`;
    return `<article class="rv-card">
      <p>${esc(r.text)}</p>
      <div class="rv-stars" aria-label="${toBn(r.rating)} stars">${"★".repeat(r.rating)}<span>${"★".repeat(5 - r.rating)}</span></div>
      <div class="rv-who">${av}<div><b>${esc(name)}</b><small>${sub}</small></div></div>
    </article>`;
  }).join("");
  $("featured").innerHTML = list.length ? `<div class="home-slider rv-slider" data-slider>
      <button type="button" class="hs-nav hs-prev" aria-label="Previous reviews" hidden><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
      <div class="products home-category-products rv-row" tabindex="-1">${cards}</div>
      <button type="button" class="hs-nav hs-next" aria-label="Next reviews" hidden><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
    </div>` : "";
  if (typeof updateSliderNav === "function") updateSliderNav();
}

function applySettings() {
  const s = state.settings;
  // bKash / Nagad are offered only when a real number is saved in Admin > Settings (never show a placeholder number)
  ["bkash", "nagad"].forEach((m) => {
    const ok = /^01\d{9}$/.test(toEn(String(s[m] || "")).replace(/\D/g, ""));
    const radio = form.querySelector(`input[name="payMethod"][value="${m}"]`);
    if (!radio) return;
    radio.closest("label").hidden = !ok;
    if (!ok && radio.checked) { form.payMethod.value = "cod"; renderPayHelp(); }
  });
  $("waBtn").href = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent("Hello, I would like to place an order.")}`;
  $("ftPhone").textContent = toBn(s.phone);
  $("areaSelect").innerHTML =
    `<option value="inside">Inside Dhaka (${money(s.deliveryInside)})</option>` +
    `<option value="outside">Outside Dhaka (${money(s.deliveryOutside)})</option>`;
  $("ftPhoneLink").href = `tel:${s.phone}`;
  $("ftWa").href = `https://wa.me/${s.whatsapp}`;

  // ফুটারের যোগাযোগ (ফাঁকা থাকলে সারিটাই লুকানো — কোনো নমুনা লেখা দেখানো হয় না)
  const soc = socialLinks();
  [["ftFb", soc.facebook], ["ftTw", soc.twitter], ["ftIg", soc.instagram], ["ftLi", soc.linkedin], ["ftTk", soc.tiktok]].forEach(([id, url]) => {
    $(id).hidden = !url;
    if (url) $(id).href = url;
  });
  const ctc = typeof SITE_CONTACT !== "undefined" ? SITE_CONTACT : {};
  const email = s.email || ctc.email, address = s.address || ctc.address;
  $("ftEmailRow").hidden = !email; if (email) { $("ftEmail").textContent = email; $("ftEmail").href = "mailto:" + email; }
  $("ftAddrRow").hidden = !address; $("ftAddr").textContent = address || "";
  $("ftHoursRow").hidden = !s.hours; $("ftHours").textContent = s.hours || "";

  // প্রোমো কুপন কার্ড: চাপলে কোড কপি হয় ও কুপন ঘরে বসে
  const code = String(s.promoCoupon || "").trim().toUpperCase();
  const pa = $("promoA");
  pa.hidden = !code; pa.dataset.code = code;
  if (code) pa.querySelector("small").textContent = `Code: ${code} · tap to copy`;

  Offer.set(s.offerEndsAt, s.offerText);

  const free = Number(s.freeDeliveryAbove) > 0 ? `🎁 Free delivery on orders above ${money(s.freeDeliveryAbove)}` : "";
  const msgs = [s.notice && "📢 " + s.notice, "🚚 Cash on delivery nationwide", free,
    "🌿 100% pure & adulteration-free products", "↩️ Easy 7-day returns", "📞 Call to order: " + toBn(s.phone)].filter(Boolean);
  const group = msgs.map((m) => `<span>${esc(m)}</span>`).join("");
  $("marqueeTrack").innerHTML = `<div class="mq">${group + group}</div><div class="mq" aria-hidden="true">${group + group}</div>`;
}

/* --- ক্যাটাগরি, ফিল্টার ও পণ্য তালিকা --- */
const starsHtml = (avg) => `<span class="stars-fill" style="--p:${Math.round(Number(avg) / 5 * 100)}%" aria-hidden="true">★★★★★</span>`;
const ratingHtml = (avg, n) => `<div class="rate" title="${toBn(avg)} / 5">${starsHtml(avg)}<small>${toBn(avg)} (${toBn(n)})</small></div>`;
const discountOf = (p) => (p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
const searchText = () => $("hSearch").value.trim().toLowerCase();

function renderChips() {
  const cats = ["All", ...categoryNames(true)];
  const count = (c) => (c === "All" ? state.products.length : state.products.filter((p) => p.category === c).length);
  $("catNav").innerHTML = cats.map((c) =>
    `<button type="button" class="cat${c === state.category ? " active" : ""}" data-cat="${esc(c)}">${c === "All" ? "All Products" : esc(c)}${c === "All" ? "" : '<span class="cat-chevron" aria-hidden="true">⌄</span>'}</button>`).join("");
  $("fCats").innerHTML = cats.map((c) =>
    `<button type="button" class="f-cat${c === state.category ? " active" : ""}" data-cat="${esc(c)}"><span>${c === "All" ? "All Products" : esc(c)}</span><em>${toBn(count(c))}</em></button>`).join("");
  // ফুটার "কেনাকাটা": অ্যাডমিনের বাছাই করা সর্বোচ্চ ৫টি ক্যাটাগরি (কিছু না বাছলে প্রথম ৫টি)
  const all = categoryNames(true);
  const picked = String((state.settings || {}).footerCats || "").split("|").filter((n) => all.includes(n));
  $("ftCats").innerHTML = (picked.length ? picked : all).slice(0, 5).map((c) =>
    `<a href="#products" data-cat="${esc(c)}">${esc(c)}</a>`).join("");
}

function filteredProducts() {
  const q = searchText();
  const min = parseFloat(state.minPrice), max = parseFloat(state.maxPrice);
  const hits = q && window.SearchSuggest ? new Map(SearchSuggest.search(state.products, q).map((h) => [h.p, h.score])) : null;
  const list = state.products.filter((p) =>
    (state.category === "All" || p.category === state.category) &&
    (!q || (hits ? hits.has(p) : (p.name + " " + p.category).toLowerCase().includes(q))) &&
    (isNaN(min) || p.price >= min) && (isNaN(max) || p.price <= max) &&
    (!state.inStock || p.stock > 0) &&
    (!state.offerOnly || discountOf(p) > 0) &&
    (!state.topRated || (p.rating || 0) >= 4));
  const sorters = {
    low: (a, b) => a.price - b.price,
    high: (a, b) => b.price - a.price,
    disc: (a, b) => discountOf(b) - discountOf(a),
    rate: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0),
    new: (a, b) => Number(b.id) - Number(a.id),
    name: (a, b) => a.name.localeCompare(b.name, "bn")
  };
  const sorter = sorters[$("sort").value];
  if (sorter) return list.sort(sorter);
  return hits ? list.sort((a, b) => hits.get(b) - hits.get(a)) : list; // best match first while searching
}

function activeFilterList() {
  const f = [];
  if (state.category !== "All") f.push(["cat", state.category]);
  if (state.minPrice !== "" || state.maxPrice !== "") {
    f.push(["price", `${state.minPrice !== "" ? money(state.minPrice) : "৳0"} – ${state.maxPrice !== "" ? money(state.maxPrice) : "∞"}`]);
  }
  if (state.inStock) f.push(["stock", "In stock"]);
  if (state.offerOnly) f.push(["offer", "Discounted"]);
  if (state.topRated) f.push(["rated", "4★ & above"]);
  if (searchText()) f.push(["q", "“" + $("hSearch").value.trim() + "”"]);
  return f;
}

function renderProducts() {
  const list = filteredProducts();
  const active = activeFilterList();

  $("resultCount").innerHTML = `<b>${toBn(list.length)}</b> products found`;
  $("fApply").textContent = list.length ? `Show ${toBn(list.length)} products` : "No products";
  $("activeFilters").innerHTML = active.length
    ? active.map(([k, label]) => `<button type="button" class="af" data-clear="${k}">${esc(label)} ✕</button>`).join("") +
      `<button type="button" class="af clear" data-clear="all">Clear all</button>`
    : "";
  const badge = $("filterBadge");
  const n = active.filter(([k]) => k !== "q").length;
  badge.hidden = !n;
  badge.textContent = toBn(n);
  $("fCount").hidden = !n;
  $("fCount").textContent = toBn(n);
  document.querySelectorAll("[data-price]").forEach((b) => {
    const [lo, hi] = b.dataset.price.split("-");
    b.classList.toggle("active", state.minPrice === lo && state.maxPrice === hi);
  });

  $("productList").setAttribute("aria-busy", "false");
  if (!list.length) {
    $("productList").innerHTML = `<div class="empty-state"><p>😕 No products match these filters.</p><button type="button" class="btn btn-small" data-clear="all">Reset filters</button></div>`;
    return;
  }

  $("productList").innerHTML = list.map(productCard).join("");
}

/* --- পণ্য কার্ড (তালিকা ও ডিল সারি দুই জায়গায় ব্যবহার) --- */
function cardActionsHtml(p, featured = false, addOnly = false) {
  const out = p.stock <= 0, id = esc(p.id);
  const line = state.cart.find((c) => String(c.id) === String(p.id));
  const cartIcon = `<svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>`;
  const buyIcon = featured
    ? `<svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>`
    : "🛒 ";
  const first = line
    ? `<div class="stepper"><button type="button" data-dec="${id}" aria-label="Decrease">−</button><span>${toBn(line.qty)}</span><button type="button" data-inc="${id}" aria-label="Increase">+</button></div>`
    : `<button type="button" class="btn btn-outline add-to-cart-btn" data-add="${id}" ${out ? "disabled" : ""}>${cartIcon}Add To Cart</button>`;
  return addOnly ? first : `${first}<button type="button" class="btn" data-buy="${id}" ${out ? "disabled" : ""}>${buyIcon}Buy now</button>`;
}

function productCard(p, addOnly = false) {
  const out = p.stock <= 0;
  const off = discountOf(p);
  return `
    <article class="product${out ? " out" : ""}">
      <div class="product-img" data-view="${esc(p.id)}" title="View product details">
        ${wishBtnHtml(p.id)}
        ${out ? `<span class="tag out-tag">Out of stock</span>` : p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
        ${!out && off ? `<span class="off-badge">−${toBn(off)}%</span>` : ""}
        <span class="product-emoji" aria-hidden="true">${esc(p.emoji || "🛍️")}</span>
        ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : ""}
      </div>
      <div class="product-body">
        <h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <small>${esc(p.unit)}${!out && p.stock <= 5 ? ` · <b class="low">Only ${toBn(p.stock)} left</b>` : ""}</small>
        ${p.reviews ? ratingHtml(p.rating, p.reviews) : `<div class="rate sp" aria-hidden="true">&nbsp;</div>`}
        <div class="price">${money(p.price)} ${p.oldPrice > p.price ? `<del>${money(p.oldPrice)}</del>` : ""}</div>
        <div class="card-actions${addOnly ? " home-category-actions" : ""}" data-actions="${esc(p.id)}">${cardActionsHtml(p, false, addOnly)}</div>
      </div>
    </article>`;
}

// কার্ট বদলালে শুধু কার্ডের বাটনগুলো হালনাগাদ (পুরো তালিকা নয়)
function refreshCardActions() {
  document.querySelectorAll("[data-actions]").forEach((el) => {
    const p = state.products.find((x) => String(x.id) === el.dataset.actions);
    if (p) el.innerHTML = cardActionsHtml(p, el.classList.contains("home-featured-actions"), el.classList.contains("home-category-actions"));
  });
}

/* --- ক্যাটাগরি: অ্যাডমিনের সাজানো ক্রমে (যেগুলোতে পণ্য আছে শুধু সেগুলো) --- */
// withEmpty=true: অ্যাডমিনে যোগ করা ফাঁকা (পণ্যহীন) ক্যাটাগরিও ধরে — নেভবারের জন্য
function categoryNames(withEmpty = false) {
  const used = new Set(state.products.map((p) => p.category).filter(Boolean));
  const order = (state.categoryList || []).map((c) => c.name).filter((n) => withEmpty || used.has(n));
  return [...order, ...[...used].filter((n) => !order.includes(n))];
}

/* --- ক্যাটাগরি টাইল --- */
function renderTiles() {
  const cats = categoryNames();
  $("shopcats").hidden = cats.length < 2;
  const tiles = cats.map((c) => {
    const items = state.products.filter((p) => p.category === c);
    const withImg = items.find((p) => p.image);
    const ico = withImg ? `<img src="${esc(withImg.image)}" alt="" loading="lazy">` : esc((items.find((p) => p.emoji) || {}).emoji || "🛒");
    return `<button type="button" class="cat-tile" data-cat="${esc(c)}"><span class="ct-ico">${ico}</span><b>${esc(c)}</b><small>${toBn(items.length)} items</small></button>`;
  }).join("");
  catSlide.template = tiles;
  catSlide.copies = 0;
  $("catTilesTrack").innerHTML = tiles;
  resetCategorySlider();

  updateCategoryControls();
  renderHomeCatalog(cats);
}

/* ক্যাটাগরি স্লাইডার: প্রতি ২ সেকেন্ডে একটি করে ক্যাটাগরি ডান থেকে বামে সরে (অসীম ঘূর্ণি)।
   মাউস/ফোকাস থাকলে থামে, ট্যাব লুকানো বা "reduce motion" চালু থাকলে নিজে চলে না। */
const CAT_SLIDE_MS = 2000, CAT_ANIM_MS = 600;
const catSlide = { timer: null, busy: false, hold: 0 };
const catRail = () => $("catTiles");
const catTrack = () => $("catTilesTrack");
function catCanSlide() {
  const rail = catRail(), track = catTrack();
  if (!rail || !track || track.children.length < 2) return false;
  return track.scrollWidth > rail.clientWidth - 8 + 2;
}
function catStepWidth(track) {
  const first = track.firstElementChild;
  if (!first) return 0;
  return first.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
}
// ক্যাটাগরি কম হলেও যেন স্লাইড হয়: প্রয়োজনে একই সারির কপি যোগ করে সারি পর্দার চেয়ে লম্বা করা হয়
function fillCategoryTrack() {
  const rail = catRail(), track = catTrack();
  if (!rail || !track || !catSlide.template || catSlide.busy) return;
  const base = track.children.length / (1 + catSlide.copies);
  if (base < 2) return;
  const one = track.getBoundingClientRect().width / (1 + catSlide.copies);
  const avail = rail.clientWidth - 8;
  const need = one >= avail + catStepWidth(track) ? 0 : Math.max(1, Math.ceil(avail / one));
  if (need === catSlide.copies) return;
  track.innerHTML = catSlide.template.repeat(1 + need);
  catSlide.copies = need;
}
function resetCategorySlider() {
  const track = catTrack();
  catSlide.busy = false;
  track.style.transition = "none";
  track.style.transform = "none";
  fillCategoryTrack();
  updateCategoryControls();
}
function categoryStep(dir) {
  if (catSlide.busy || !catCanSlide()) return;
  const track = catTrack();
  const step = catStepWidth(track);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dur = reduce ? 0 : CAT_ANIM_MS;
  catSlide.busy = true;
  if (dir < 0) { // শেষ ক্যাটাগরি সামনে এনে ডান দিকে সরিয়ে দেখানো
    track.style.transition = "none";
    track.prepend(track.lastElementChild);
    track.style.transform = `translateX(${-step}px)`;
    void track.offsetWidth;
  }
  track.style.transition = `transform ${dur}ms cubic-bezier(.4, 0, .2, 1)`;
  track.style.transform = dir > 0 ? `translateX(${-step}px)` : "translateX(0)";
  setTimeout(() => {
    track.style.transition = "none";
    if (dir > 0) track.append(track.firstElementChild);
    track.style.transform = "none";
    catSlide.busy = false;
  }, dur + 30);
}
function updateCategoryControls() {
  if (!catRail()) return;
  fillCategoryTrack();
  const can = catCanSlide();
  $("catScrollPrev").hidden = !can;
  $("catScrollNext").hidden = !can;
}
function startCategorySlider() {
  if (catSlide.timer) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  catSlide.timer = setInterval(() => {
    const rail = catRail();
    if (!rail || document.hidden || reduce.matches || catSlide.hold > Date.now()) return;
    if (rail.matches(":hover") || rail.contains(document.activeElement)) return;
    const r = rail.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    categoryStep(1);
  }, CAT_SLIDE_MS);
}
window.addEventListener("resize", updateCategoryControls);
if ("ResizeObserver" in window) new ResizeObserver(updateCategoryControls).observe($("catTiles"));
startCategorySlider();

function renderHomeCatalog(categories) {
  const root = $("homeCatalog");
  if (!root || document.body.dataset.page !== "home") return;

  const products = state.products;
  const featuredItems = products.filter((p) => p.stock > 0).slice(0, 4);
  const featuredCards = featuredItems.map(featuredProductCard).join("");
  const featuredSection = featuredItems.length ? `
    <section class="home-product-section home-featured-section" aria-labelledby="homeFeaturedTitle">
      <div class="sec-row"><h2 class="sec-title" id="homeFeaturedTitle">Top Selling Products</h2><a class="sec-link home-more" href="shop.html">View all products <span aria-hidden="true">→</span></a></div>
      <div class="home-product-viewport"><div class="home-product-track home-featured-track">
        <div class="home-featured-products">${featuredCards}</div>
      </div></div>
    </section>` : "";
  // 🔥 Today's Best Deals: টপ সেলিং এর ঠিক পরে (কম পণ্যে ডুপ্লিকেট দেখাবে না)
  const deals = products.filter((p) => p.stock > 0 && discountOf(p) > 0)
    .sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 8);
  const dealsSection = deals.length >= 3 && products.length >= 8 ? `
    <section class="home-product-section home-category-section home-deals-section" id="dealsSec" aria-labelledby="homeDealsTitle">
      <div class="sec-row"><h2 class="sec-title" id="homeDealsTitle">🔥 Today's Best Deals</h2><a href="shop.html?offer=1" class="sec-link">See all →</a></div>
      <div class="home-slider" data-slider>
        <button type="button" class="hs-nav hs-prev" aria-label="Previous products" hidden><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <div class="products home-category-products" tabindex="-1">${deals.map((p) => productCard(p, true)).join("")}</div>
        <button type="button" class="hs-nav hs-next" aria-label="Next products" hidden><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
      </div>
    </section>` : "";
  // "Our Brands": logo cards managed in Admin > Brands (stored as JSON in the "brands" setting)
  let brandItems = [];
  try { const l = JSON.parse(state.settings.brands || "[]"); if (Array.isArray(l)) brandItems = l; } catch (e) { /* ignore bad JSON */ }
  brandItems = brandItems.filter((b) => b && b.logo && (/^https?:\/\//i.test(b.logo) || /^[\w\-\/.]+$/.test(b.logo)));
  const brandCards = brandItems.map((b) => {
    const img = `<img src="${esc(b.logo)}" alt="${esc(b.name || "Brand")}" loading="lazy">`;
    return b.link && /^(https?:\/\/|#|[\w\-\/.?=&]+$)/i.test(b.link) ? `<a class="brand-card" href="${esc(b.link)}" title="${esc(b.name || "")}">${img}</a>` : `<div class="brand-card" title="${esc(b.name || "")}">${img}</div>`;
  }).join("");
  const brandsSection = brandItems.length ? `
    <section class="home-product-section home-brands-section" aria-labelledby="homeBrandsTitle">
      <div class="sec-row"><h2 class="sec-title" id="homeBrandsTitle">Our Brands</h2></div>
      <div class="home-slider brand-slider" data-slider>
        <button type="button" class="hs-nav hs-prev" aria-label="Previous brands" hidden><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <div class="products home-category-products brand-row" tabindex="-1">${brandCards}</div>
        <button type="button" class="hs-nav hs-next" aria-label="Next brands" hidden><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
      </div>
    </section>` : "";
  const bannerProducts = [
    products.find((product) => product.image),
    products.filter((product) => product.image)[1]
  ].filter(Boolean);
  const editorialBanner = bannerProducts.length ? `
    <section class="home-editorial-banner" aria-label="KhatiGhor special collection">
      <div class="home-editorial-copy"><span>Our promise of purity</span><h2>Authentic taste in everyday cooking</h2><p>Carefully selected, carefully packed — delivered to your door.</p><a href="shop.html">Explore our collection <span aria-hidden="true">→</span></a></div>
      <div class="home-editorial-art">${bannerProducts.map((product) => `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`).join("")}</div>
    </section>` : "";
  // "All Products": স্লাইড নয় — স্থির গ্রিডে মাত্র ২ সারি (ডেস্কটপে ১০টি; ছোট স্ক্রিনে CSS বাড়তি কার্ড লুকায়),
  // নিচে "Load More" বাটন সব পণ্যের পেজে (shop.html) নিয়ে যায়
  const allItems = products.slice(0, 10);
  const allCards = allItems.map(productCard).join("");
  const allSection = `
    <section class="home-product-section home-all-section" aria-labelledby="homeAllTitle">
      <div class="sec-row"><div><span class="eyebrow">🛍️ Our Collection</span><h2 class="sec-title" id="homeAllTitle">All Products</h2></div><a class="sec-link home-more" href="shop.html">View all products →</a></div>
      ${products.length ? `<div class="products home-all-grid">${allCards}</div><a class="home-load-more" href="shop.html">Load More <span aria-hidden="true">＋</span></a>` : `<p class="home-empty">No products have been added yet.</p>`}
    </section>`;
  const categorySections = categories.map((category, index) => {
    const items = products.filter((p) => p.category === category);
    const sectionId = `home-category-${index}`;
    const key = "category:" + category;
    const categoryCards = items.map((product) => productCard(product, true)).join("");
    return `
      <section class="home-product-section home-category-section" aria-labelledby="${sectionId}">
        <div class="sec-row"><h2 class="sec-title" id="${sectionId}">${esc(category)} <small>(${toBn(items.length)})</small></h2><a class="sec-link home-more" href="shop.html?cat=${encodeURIComponent(category)}">View more <span aria-hidden="true">→</span></a></div>
        <div class="home-slider" data-slider data-category-slider>
          <button type="button" class="hs-nav hs-prev" aria-label="Previous products" hidden><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
          <div class="products home-category-products" tabindex="-1">${categoryCards}</div>
          <button type="button" class="hs-nav hs-next" aria-label="Next products" hidden><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        </div>
      </section>`;
  }).join("");

  root.innerHTML = featuredSection + brandsSection + dealsSection + editorialBanner + categorySections + allSection;
  setupHomeSliders();
}

/* ক্যাটাগরি সেকশনের পণ্য-সারি: প্রতি ২.৫ সেকেন্ডে ডান থেকে বামে সরে (একটি করে কার্ড), শেষে পৌঁছে আবার শুরুতে ফেরে।
   মাউস/টাচ/ফোকাস থাকলে থামে, ট্যাব লুকানো বা পর্দার বাইরে থাকলে চলে না, "reduce motion" চালু থাকলে নিজে নিজে চলে না। */
const SLIDE_MS = 2500;
const slideState = { timer: null, hold: new WeakMap() };
function sliderStep(el) {
  const first = el.querySelector(".product, .brand-card, .rv-card");
  if (!first) return 0;
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  return first.getBoundingClientRect().width + gap;
}
/* Endless loop, always right → left: after each step the first card moves to the end (and the reverse for "previous"),
   so cards keep coming round instead of rewinding to the start. `_rot` = how many cards have been rotated (for the dots). */
const SLIDE_ANIM_MS = 600;
function sliderBase(el) { return [...sliderItems(el)].filter((x) => !x.dataset.clone).length; }
/* Short rows (e.g. 2-3 reviews or a few brands) would never overflow, so they could not slide.
   Add hidden copies of the same cards until the row is longer than the screen, so it loops like the others. */
function fillLoopRow(el) {
  if (!el.matches(".rv-row, .brand-row")) return;
  const all = [...sliderItems(el)];
  const base = all.filter((x) => !x.dataset.clone);
  if (base.length < 2) return;
  const step = sliderStep(el);
  if (!step) return;
  const oneRound = base.length * step;
  const copies = oneRound >= el.clientWidth + step ? 0 : Math.ceil((el.clientWidth + step) / oneRound);
  if (copies * base.length === all.length - base.length) return;
  all.filter((x) => x.dataset.clone).forEach((x) => x.remove());
  for (let k = 0; k < copies; k++) {
    base.forEach((b) => {
      const c = b.cloneNode(true);
      c.dataset.clone = "1";
      c.setAttribute("aria-hidden", "true");
      c.querySelectorAll("a").forEach((a) => a.setAttribute("tabindex", "-1"));
      if (c.tagName === "A") c.setAttribute("tabindex", "-1");
      el.append(c);
    });
  }
  el._rot = 0;
}
function sliderItems(el) { return el.querySelectorAll(":scope > .product, :scope > .brand-card, :scope > .rv-card"); }
function sliderGo(el, dir) {
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 2 || el._busy) return;
  const step = sliderStep(el);
  if (!step) return;
  const n = sliderItems(el).length;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dur = reduce ? 0 : SLIDE_ANIM_MS;
  el._busy = true;
  el.style.scrollSnapType = "none";
  if (dir < 0) {
    const base = el.scrollLeft;
    el.prepend(el.lastElementChild);
    el._rot = ((el._rot || 0) - 1 + n) % n;
    el.scrollTo({ left: base + step, behavior: "instant" });
    el.scrollTo({ left: base, behavior: dur ? "smooth" : "instant" });
    setTimeout(() => { el.style.scrollSnapType = ""; el._busy = false; }, dur + 40);
    return;
  }
  const base = el.scrollLeft;
  el.scrollTo({ left: base + step, behavior: dur ? "smooth" : "instant" });
  setTimeout(() => {
    el.append(el.firstElementChild);
    el._rot = ((el._rot || 0) + 1) % n;
    el.scrollTo({ left: base, behavior: "instant" });
    el.style.scrollSnapType = "";
    el._busy = false;
  }, dur + 40);
}
function sliderJump(el, page, per) {
  const step = sliderStep(el), n = sliderItems(el).length, base = sliderBase(el);
  if (!step || !n || !base) return;
  const scrollIdx = Math.round(el.scrollLeft / step);
  const cur = ((el._rot || 0) + scrollIdx) % n;
  const box = el.closest("[data-slider]");
  const target = box && box.hasAttribute("data-category-slider")
    ? Math.round((base - 1) * page / 3)
    : Math.min(base - 1, page * per);
  const shift = (scrollIdx + ((target - cur + n) % n)) % n;
  el.style.scrollSnapType = "none";
  for (let i = 0; i < shift; i++) el.append(el.firstElementChild);
  el.scrollTo({ left: 0, behavior: "instant" });
  el._rot = target;
  el.style.scrollSnapType = "";
  if (box) syncSliderDots(box);
}
function updateSliderNav() {
  document.querySelectorAll("[data-slider]").forEach((box) => {
    const el = box.querySelector(".home-category-products");
    fillLoopRow(el);
    const more = el.scrollWidth - el.clientWidth > 2;
    box.querySelectorAll(".hs-nav").forEach((b) => { b.hidden = !more; });
    box.classList.toggle("is-sliding", more);
    renderSliderDots(box);
  });
}
/* কার্ডের নিচে মাঝখানে পেজ-ডট: প্রতিটি ডট = এক "স্ক্রিন" কার্ড; সক্রিয়টি ভরাট */
function sliderPer(el) {
  const step = sliderStep(el);
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  return { step, per: step ? Math.max(1, Math.round((el.clientWidth + gap) / step)) : 1 };
}
function renderSliderDots(box) {
  const el = box.querySelector(".home-category-products");
  const n = sliderBase(el);
  const { per } = sliderPer(el);
  const pages = box.hasAttribute("data-category-slider") ? 4 : Math.ceil(n / per);
  let dots = box.querySelector(".hs-dots");
  if (pages < 2 || (!box.hasAttribute("data-category-slider") && el.scrollWidth - el.clientWidth <= 2)) { if (dots) dots.remove(); return; }
  if (!dots) { dots = document.createElement("div"); dots.className = "hs-dots"; box.append(dots); }
  if (dots.children.length !== pages) dots.innerHTML = Array.from({ length: pages }, (_, i) => `<button type="button" data-dot="${i}" aria-label="Slide ${i + 1}"></button>`).join("");
  syncSliderDots(box);
}
function syncSliderDots(box) {
  const el = box.querySelector(".home-category-products"), dots = box.querySelector(".hs-dots");
  if (!dots) return;
  const { step, per } = sliderPer(el);
  const n = sliderBase(el), total = sliderItems(el).length;
  const pages = dots.children.length;
  const idx = ((((el._rot || 0) + Math.round(el.scrollLeft / step)) % total) + total) % total % n;
  const page = box.hasAttribute("data-category-slider")
    ? (n > 1 ? Math.round(idx * 3 / (n - 1)) : 0)
    : Math.min(pages - 1, Math.floor(idx / per));
  [...dots.children].forEach((d, i) => d.classList.toggle("on", i === page));
}
document.addEventListener("scroll", (e) => {
  const el = e.target;
  if (el && el.classList && el.classList.contains("home-category-products")) { const box = el.closest("[data-slider]"); if (box) syncSliderDots(box); }
}, true);
function setupHomeSliders() {
  updateSliderNav();
  if (slideState.timer) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  slideState.timer = setInterval(() => {
    if (document.hidden || reduce.matches) return;
    document.querySelectorAll("[data-slider] .home-category-products").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const box = el.closest("[data-slider]");
      if ((slideState.hold.get(el) || 0) > Date.now() || (box && box.matches(":hover")) || el.contains(document.activeElement)) return;
      sliderGo(el, 1);
    });
  }, SLIDE_MS);
}
document.addEventListener("click", (e) => {
  const dot = e.target.closest(".hs-dots button");
  if (dot) {
    const box = dot.closest("[data-slider]"), el = box.querySelector(".home-category-products");
    const { per } = sliderPer(el);
    slideState.hold.set(el, Date.now() + 6000);
    sliderJump(el, Number(dot.dataset.dot), per);
    return;
  }
  const btn = e.target.closest(".hs-nav");
  if (!btn) return;
  const el = btn.closest("[data-slider]").querySelector(".home-category-products");
  slideState.hold.set(el, Date.now() + 6000);
  sliderGo(el, btn.classList.contains("hs-next") ? 1 : -1);
});
document.addEventListener("pointerdown", (e) => {
  const el = e.target.closest && e.target.closest(".home-category-products");
  if (el) slideState.hold.set(el, Date.now() + 6000);
}, { passive: true });
window.addEventListener("resize", updateSliderNav);

function featuredProductCard(p) {
  const off = discountOf(p);
  return `<article class="product home-featured-card">
    <span class="best-ribbon"><i class="fa-solid fa-fire" aria-hidden="true"></i>Best Selling</span>
    <a class="product-img" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="Details of ${esc(p.name)}">
      <span class="product-emoji" aria-hidden="true">${esc(p.emoji || "🛍️")}</span>
      ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : ""}
    </a>
    <div class="product-body"><small>${esc(p.category || "")}</small><h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
      <div class="price">${money(p.price)} ${p.oldPrice > p.price ? `<del>${money(p.oldPrice)}</del>` : ""}</div>${p.oldPrice > p.price ? `<span class="save-pill">Save ${money(p.oldPrice - p.price)}</span>` : ""}
      <div class="card-actions home-featured-actions" data-actions="${esc(p.id)}">${cardActionsHtml(p, true)}</div>
    </div>
  </article>`;
}

const homeVisible = Object.create(null);
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-home-more]");
  if (!button) return;
  const key = button.dataset.homeMore;
  homeVisible[key] = (homeVisible[key] || (key === "all" ? 10 : 5)) + 10;
  renderHomeCatalog(categoryNames());
});

function resetFilters() {
  Object.assign(state, { category: "All", minPrice: "", maxPrice: "", inStock: false, offerOnly: false, topRated: false });
  $("pMin").value = ""; $("pMax").value = "";
  $("fStock").checked = false; $("fOffer").checked = false; $("fRated").checked = false;
  $("hSearch").value = ""; $("sort").value = "";
  renderChips();
  renderProducts();
}

function syncPriceInputs() { $("pMin").value = state.minPrice; $("pMax").value = state.maxPrice; }

// ক্যাটাগরি বাটন (হেডার, সাইডবার, ফুটার)
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  e.preventDefault();
  if (document.body.dataset.page === "home") {
    const category = b.dataset.cat;
    location.href = "shop.html" + (category && category !== "All" ? "?cat=" + encodeURIComponent(category) : "");
    return;
  }
  state.category = b.dataset.cat;
  renderChips();
  renderProducts();
  if (!b.closest("#filters")) $("products").scrollIntoView({ behavior: "smooth" });
});

// ফিল্টার ট্যাগ মোছা / রিসেট
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-clear]");
  if (!c) return;
  const k = c.dataset.clear;
  if (k === "all") return resetFilters();
  if (k === "cat") state.category = "All";
  if (k === "price") { state.minPrice = ""; state.maxPrice = ""; syncPriceInputs(); }
  if (k === "stock") { state.inStock = false; $("fStock").checked = false; }
  if (k === "offer") { state.offerOnly = false; $("fOffer").checked = false; }
  if (k === "rated") { state.topRated = false; $("fRated").checked = false; }
  if (k === "q") $("hSearch").value = "";
  renderChips();
  renderProducts();
});

$("fClear").addEventListener("click", resetFilters);
$("pMin").addEventListener("input", () => { state.minPrice = $("pMin").value; renderProducts(); });
$("pMax").addEventListener("input", () => { state.maxPrice = $("pMax").value; renderProducts(); });
document.querySelectorAll("[data-price]").forEach((b) => b.addEventListener("click", () => {
  const [lo, hi] = b.dataset.price.split("-");
  const same = state.minPrice === lo && state.maxPrice === hi;
  state.minPrice = same ? "" : lo;
  state.maxPrice = same ? "" : hi;
  syncPriceInputs();
  renderProducts();
}));
$("fStock").addEventListener("change", () => { state.inStock = $("fStock").checked; renderProducts(); });
$("fOffer").addEventListener("change", () => { state.offerOnly = $("fOffer").checked; renderProducts(); });
$("fRated").addEventListener("change", () => { state.topRated = $("fRated").checked; renderProducts(); });
$("sort").addEventListener("change", renderProducts);

// মোবাইল ফিল্টার শিট
let filterFocus = null;
function openFilters() { filterFocus = document.activeElement; $("filters").classList.add("open"); $("filterOpen").setAttribute("aria-expanded", "true"); $("overlay").hidden = false; $("fClose").focus({ preventScroll: true }); }
function closeFilters() {
  if (!$("filters").classList.contains("open")) return;
  $("filters").classList.remove("open");
  $("filterOpen").setAttribute("aria-expanded", "false");
  if (!openPanel) $("overlay").hidden = true;
  if (filterFocus && document.contains(filterFocus)) { try { filterFocus.focus({ preventScroll: true }); } catch (err) { /* ok */ } }
  filterFocus = null;
}
$("filterOpen").addEventListener("click", openFilters);
$("fClose").addEventListener("click", closeFilters);
$("fApply").addEventListener("click", () => { closeFilters(); $("products").scrollIntoView({ behavior: "smooth" }); });

/* --- হেডারের সার্চ বার --- */
$("hSearch").addEventListener("input", renderProducts);
if (window.SearchSuggest) SearchSuggest.attach({ form: $("hSearchForm"), input: $("hSearch"), getProducts: () => state.products, getCategories: () => categoryNames(false) });
$("hSearchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (searchText()) Pixel.track("Search", { search_string: $("hSearch").value.trim() });
  const query = $("hSearch").value.trim();
  location.href = "shop.html" + (query ? "?q=" + encodeURIComponent(query) : "");
});

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  const buy = e.target.closest("[data-buy]");
  if (add) { addToCart(add.dataset.add); }
  if (buy && addToCart(buy.dataset.buy, true)) { closeCart(); location.href = "checkout.html"; }
});

document.addEventListener("error", (e) => {
  if (e.target.matches && e.target.matches(".product-img img")) e.target.hidden = true;
}, true);
document.addEventListener("load", (e) => {
  if (e.target.matches && e.target.matches(".product-img img")) e.target.closest(".product-img").classList.add("has-image");
}, true);

/* --- কার্ট --- */
const findProduct = (id) => state.products.find((p) => String(p.id) === String(id));

function addToCart(id, silent, qty = 1) {
  const p = findProduct(id);
  if (!p) return false;
  const line = state.cart.find((c) => String(c.id) === String(id));
  const can = Math.min(qty, p.stock - (line ? line.qty : 0));
  if (can <= 0) { toast(`Only ${toBn(p.stock)} in stock`); return false; }
  if (line) line.qty += can; else state.cart.push({ id: p.id, qty: can });
  Pixel.track("AddToCart", { content_ids: [String(p.id)], content_name: p.name, content_type: "product", contents: [{ id: String(p.id), quantity: can }], value: p.price * can, currency: "BDT" });
  renderCart();
  if (can < qty) toast(`Only ${toBn(p.stock)} in stock`);
  else if (!silent) toast("✅ Added to cart");
  return true;
}

function changeQty(id, delta) {
  const line = state.cart.find((c) => String(c.id) === String(id));
  const p = findProduct(id);
  if (!line || !p) return;
  line.qty += delta;
  if (line.qty > p.stock) { line.qty = p.stock; toast(`Only ${toBn(p.stock)} in stock`); }
  if (line.qty <= 0) state.cart = state.cart.filter((c) => c !== line);
  renderCart();
}

function cartLines() {
  return state.cart.map((c) => ({ p: findProduct(c.id), qty: c.qty })).filter((l) => l.p);
}

function cartRowHtml(l) {
  const img = l.p.image ? `<img src="${esc(l.p.image)}" alt="">` : esc(l.p.emoji);
  return `
    <div class="cart-row">
      <div class="cart-thumb">${img}</div>
      <div class="cart-info"><b>${esc(l.p.name)}</b><small>${esc(l.p.unit)} · ${money(l.p.price)}</small></div>
      <div class="mini-qty">
        <button type="button" data-dec="${esc(l.p.id)}" aria-label="Decrease">−</button>
        <span>${toBn(l.qty)}</span>
        <button type="button" data-inc="${esc(l.p.id)}" aria-label="Increase">+</button>
      </div>
      <div class="cart-line"><b>${money(l.p.price * l.qty)}</b><button type="button" class="cart-rm" data-rm="${esc(l.p.id)}" aria-label="Remove ${esc(l.p.name)} from cart">Remove</button></div>
    </div>`;
}

function renderFreeDelivery(sub) {
  const free = Number(state.settings.freeDeliveryAbove) || 0;
  const html = !free || !sub ? ""
    : sub >= free
      ? `<div class="fd ok"><p>🎉 Congratulations! You get <b>free delivery</b></p><i><u style="width:100%"></u></i></div>`
      : `<div class="fd"><p>Add <b>${money(free - sub)}</b> more for <b>free delivery</b>!</p><i><u style="width:${Math.round(sub / free * 100)}%"></u></i></div>`;
  $("fdDrawer").innerHTML = html;
  $("fdCheckout").innerHTML = html;
}

/* --- Cart drawer: "You may also like" (same categories as the cart first, then discounted / top-rated) --- */
function renderUpsell(lines) {
  const box = $("drawerUpsell");
  if (!box) return;
  const inCart = new Set(lines.map((l) => String(l.p.id))), cats = new Set(lines.map((l) => l.p.category));
  const picks = lines.length ? state.products
    .filter((p) => p.stock > 0 && !inCart.has(String(p.id)))
    .map((p) => ({ p, s: (cats.has(p.category) ? 3 : 0) + (discountOf(p) > 0 ? 1 : 0) + (p.rating || 0) / 5 }))
    .sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.p) : [];
  box.hidden = !picks.length;
  const track = $("upTrack"), keep = track.scrollLeft;
  track.innerHTML = picks.map((p) => `
    <div class="up-card">
      <a class="up-img" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async">` : esc(p.emoji || "🛍️")}</a>
      <div class="up-info">
        <a class="up-name" href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a>
        <span class="up-price">${discountOf(p) ? `<s>${money(p.oldPrice)}</s>` : ""}<b>${money(p.price)}</b></span>
        <button type="button" class="up-add" data-up-add="${esc(p.id)}">+ Add</button>
      </div>
    </div>`).join("");
  track.scrollLeft = keep;
}
$("drawerUpsell").addEventListener("click", (e) => {
  const add = e.target.closest("[data-up-add]");
  if (add) { addToCart(add.dataset.upAdd); return; }
  const nav = e.target.closest("[data-up]");
  if (nav) { const t = $("upTrack"); t.scrollBy({ left: Number(nav.dataset.up) * (t.clientWidth * 0.8), behavior: "smooth" }); }
});

function renderCart() {
  saveCart();
  const lines = cartLines();
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  $("cartCount").textContent = toBn(count);
  $("cartCount").classList.toggle("has", count > 0);
  $("floatingCartCount").textContent = toBn(count);
  $("floatingCartTotal").textContent = money(sub);
  $("drawerTotal").textContent = money(sub);
  $("bnCount").textContent = toBn(count);
  $("bnCount").hidden = false; // always show the count (0 when the cart is empty)
  const save = lines.reduce((n, l) => n + Math.max(0, l.p.oldPrice - l.p.price) * l.qty, 0);
  $("saveDrawer").hidden = !save;
  $("saveDrawer").textContent = `🎉 You are saving ${money(save)}`;
  $("saveRow").hidden = !save;
  $("sumSave").textContent = money(save);
  renderFreeDelivery(sub);
  refreshCardActions();

  const empty = `<p class="empty">Your cart is empty. Add products 🛒</p>`;
  $("drawerBody").innerHTML = lines.length ? lines.map(cartRowHtml).join("") : empty;
  $("goCheckout").classList.toggle("disabled", !lines.length);
  renderUpsell(lines);

  form.hidden = !lines.length;
  $("checkoutEmpty").hidden = !!lines.length;
  $("checkoutItems").innerHTML = lines.length ? lines.map(cartRowHtml).join("") : empty;
  form.querySelectorAll("input, select, textarea, button").forEach((el) => {
    if (el.closest("#checkoutItems")) return;
    el.disabled = !lines.length;
  });

  if (state.coupon) { state.coupon = null; setCouponMsg("Cart changed — please apply the coupon again.", false); }
  updateSummary();
}

document.addEventListener("click", (e) => {
  const inc = e.target.closest("[data-inc]");
  const dec = e.target.closest("[data-dec]");
  const rm = e.target.closest("[data-rm]");
  if (inc) changeQty(inc.dataset.inc, 1);
  if (dec) changeQty(dec.dataset.dec, -1);
  if (rm) { // পণ্যটি পুরো কার্ট থেকে সরানো
    state.cart = state.cart.filter((c) => String(c.id) !== String(rm.dataset.rm));
    renderCart();
    toast("🗑️ Removed from cart");
  }
});

/* --- পণ্য বিস্তারিত (কুইক ভিউ) --- */
const qv = $("qv");
let qvQty = 1;
let qvId = null;
let qvGalleryImages = [], qvGalleryIndex = 0, qvGalleryTimer = null;

function showQuickViewImage(index) {
  const gallery = $("qvBody").querySelector(".qv-gallery");
  if (!gallery || !qvGalleryImages.length) return;
  qvGalleryIndex = (index + qvGalleryImages.length) % qvGalleryImages.length;
  const image = gallery.querySelector("[data-qvmain] img");
  if (image) {
    image.dataset.qvImage = qvGalleryImages[qvGalleryIndex];
    bindQuickViewImage(image);
    image.classList.remove("gallery-swap");
    void image.offsetWidth;
    image.classList.add("gallery-swap");
  }
  gallery.querySelectorAll("[data-qvimage]").forEach((button, i) => {
    const active = i === qvGalleryIndex;
    button.classList.toggle("on", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const count = gallery.querySelector(".qv-gallery-count");
  if (count) count.textContent = `${qvGalleryIndex + 1} / ${qvGalleryImages.length}`;
}

function quickViewImageCandidates(value) {
  const url = String(value || "").trim();
  const candidates = [url];
  let driveId = (url.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/i) || [])[1];
  try {
    const parsed = new URL(url);
    if (!driveId && parsed.hostname === "drive.google.com") {
      driveId = (parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || [])[1] || parsed.searchParams.get("id");
    }
  } catch (e) {}
  if (driveId) {
    candidates.push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`);
    candidates.push(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`);
  }
  return [...new Set(candidates.filter(Boolean))];
}

function bindQuickViewImage(img) {
  if (!img.dataset.qvBound) {
    img.dataset.qvBound = "true";
    img.addEventListener("error", () => {
      const candidates = quickViewImageCandidates(img.dataset.qvImage);
      const index = Number(img.dataset.qvFallbackIndex || 0);
      if (index < candidates.length) {
        img.dataset.qvFallbackIndex = String(index + 1);
        img.src = candidates[index];
        return;
      }
      img.hidden = true;
      const fallback = img.parentElement.querySelector(".qv-image-error");
      if (fallback) fallback.hidden = false;
    });
  }
  const candidates = quickViewImageCandidates(img.dataset.qvImage);
  img.dataset.qvFallbackIndex = "1";
  img.hidden = false;
  const fallback = img.parentElement.querySelector(".qv-image-error");
  if (fallback) fallback.hidden = true;
  if (candidates.length) img.src = candidates[0];
}

function openView(id, push = true) {
  clearInterval(qvGalleryTimer);
  qvGalleryTimer = null;
  const p = findProduct(id);
  if (!p) return;
  qvQty = 1;
  qvId = p.id;
  let rawImages = Array.isArray(p.images) ? p.images : [];
  if (typeof p.images === "string") {
    try {
      const parsed = JSON.parse(p.images);
      rawImages = Array.isArray(parsed) ? parsed : p.images.split(/[,\n|]/);
    } catch (e) { rawImages = p.images.split(/[,\n|]/); }
  }
  const images = [...new Set([p.image, ...rawImages].map((image) => String(image || "").trim()).filter(Boolean))].slice(0, 3);
  qvGalleryImages = images;
  qvGalleryIndex = 0;
  const out = p.stock <= 0;
  const off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const related = state.products.filter((x) => x.category === p.category && x.id !== p.id && x.stock > 0).slice(0, 3);
  $("qvBody").innerHTML = `
    <button type="button" class="qv-close" data-qvclose aria-label="Close">✕</button>
    <div class="qv-grid">
      <div class="qv-gallery">
        <div class="qv-img" data-qvmain data-magnifier>${images[0] ? `<img class="gallery-image" data-qv-image="${esc(images[0])}" alt="${esc(p.name)}"><span class="qv-image-error" hidden>Image unavailable<br>Check image link access</span>` : esc(p.emoji)}${off ? `<span class="tag">${toBn(off)}% off</span>` : ""}${images.length > 1 ? `<button type="button" class="qv-gallery-nav qv-gallery-prev" data-qvstep="-1" aria-label="Previous product image">‹</button><button type="button" class="qv-gallery-nav qv-gallery-next" data-qvstep="1" aria-label="Next product image">›</button><span class="qv-gallery-count" aria-live="polite">1 / ${images.length}</span>` : ""}<span class="gallery-lens" aria-hidden="true"></span></div>
        ${images.length > 1 ? `<div class="qv-thumbs" role="group" aria-label="Product images">${images.map((src, i) => `<button type="button" class="${i === 0 ? "on" : ""}" data-qvimage="${esc(src)}" aria-label="Show product image ${i + 1}" aria-pressed="${i === 0}"><img data-qv-image="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="qv-info">
        <small class="qv-cat">${esc(p.category || "")}</small>
        <h2>${esc(p.name)}</h2>
        ${p.reviews ? `<a href="#qvReviews" class="qv-rate" data-rvjump>${starsHtml(p.rating)} <small>${toBn(p.rating)} · ${toBn(p.reviews)} reviews</small></a>` : ""}
        <p class="qv-unit">${esc(p.unit)}</p>
        <div class="price big">${money(p.price)} ${p.oldPrice > p.price ? `<del>${money(p.oldPrice)}</del>` : ""}</div>
        <p class="qv-stock ${out ? "out" : "in"}">${out ? "❌ Out of stock" : p.stock <= 5 ? `⚠️ Only ${toBn(p.stock)} left` : "✅ In stock"}</p>
        <p class="qv-desc">${esc(p.desc || "100% pure and fresh. Sourced directly with no adulteration or chemicals.")}</p>
        <ul class="qv-points"><li>✔ Adulteration-free</li><li>✔ Cash on delivery</li><li>✔ 7-day returns</li></ul>
        ${out ? "" : `
        <div class="qv-qty"><span>Quantity</span>
          <div class="mini-qty big"><button type="button" data-qvminus aria-label="Decrease">−</button><span id="qvQty">1</span><button type="button" data-qvplus aria-label="Increase">+</button></div>
        </div>`}
        <div class="qv-actions">
          <button type="button" class="btn btn-outline add-to-cart-btn" data-qvadd ${out ? "disabled" : ""}><svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>Add To Cart</button>
          <button type="button" class="btn" data-qvbuy ${out ? "disabled" : ""}>Buy now</button>
        </div>
        <div class="qv-links"><button type="button" class="qv-fav${Wish.has(p.id) ? " on" : ""}" data-wish="${esc(p.id)}" aria-pressed="${Wish.has(p.id)}"><svg viewBox="0 0 24 24" aria-hidden="true">${HEART}</svg><span>${Wish.has(p.id) ? "In your wishlist" : "Add to wishlist"}</span></button><button type="button" class="qv-share" data-qvshare>🔗 Copy link</button></div>
      </div>
    </div>
    ${connected() ? `<div class="qv-reviews" id="qvReviews"><h4>⭐ Customer reviews</h4><div id="qvRvBody"><p class="loading">Loading reviews...</p></div></div>` : ""}
    ${related.length ? `<div class="qv-related"><h4>You may also like</h4><div class="rel-grid">${related.map((r) => `
      <button type="button" class="rel" data-view="${esc(r.id)}"><span class="rel-img">${r.image ? `<img src="${esc(r.image)}" alt="">` : esc(r.emoji)}</span><b>${esc(r.name)}</b><small>${money(r.price)}</small></button>`).join("")}</div></div>` : ""}`;
  if (!qv.open) qv.showModal();
  $("qvBody").querySelectorAll("img[data-qv-image]").forEach(bindQuickViewImage);
  const gallery = $("qvBody").querySelector(".qv-gallery");
  if (gallery) {
    let resumeTimer;
    const start = () => {
      clearTimeout(resumeTimer);
      if (!qvGalleryTimer) qvGalleryTimer = setInterval(() => showQuickViewImage(qvGalleryIndex + 1), 4200);
    };
    const stop = () => { clearInterval(qvGalleryTimer); qvGalleryTimer = null; clearTimeout(resumeTimer); };
    const updateLens = (main, image, lens, clientX, clientY) => {
      const rect = main.getBoundingClientRect();
      const radius = lens.getBoundingClientRect().width / 2;
      const x = Math.max(radius, Math.min(rect.width - radius, clientX - rect.left));
      const y = Math.max(radius, Math.min(rect.height - radius, clientY - rect.top));
      const px = x / rect.width, py = y / rect.height;
      lens.style.left = `${x}px`;
      lens.style.top = `${y}px`;
      lens.style.backgroundImage = `url("${image.currentSrc || image.src}")`;
      lens.style.backgroundPosition = `${px * 100}% ${py * 100}%`;
      lens.classList.add("is-visible");
    };
    gallery.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "touch") return;
      const main = e.target.closest("[data-qvmain]"), image = main && main.querySelector("img"), lens = main && main.querySelector(".gallery-lens");
      if (!main || !image || !lens || e.target.closest("button")) return;
      updateLens(main, image, lens, e.clientX, e.clientY);
    });
    gallery.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch" || e.target.closest("button")) return;
      const main = e.target.closest("[data-qvmain]"), image = main && main.querySelector("img"), lens = main && main.querySelector(".gallery-lens");
      if (!main || !image || !lens) return;
      if (lens.classList.contains("is-visible")) lens.classList.remove("is-visible");
      else updateLens(main, image, lens, e.clientX, e.clientY);
    });
    gallery.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "touch") gallery.querySelector(".gallery-lens")?.classList.remove("is-visible");
    });
    if (images.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gallery.addEventListener("pointerenter", stop);
      gallery.addEventListener("pointerleave", () => { resumeTimer = setTimeout(start, 900); });
      gallery.addEventListener("focusin", stop);
      gallery.addEventListener("focusout", () => { resumeTimer = setTimeout(start, 900); });
      start();
    }
  }
  qv.scrollTop = 0;
  Pixel.track("ViewContent", { content_ids: [String(p.id)], content_name: p.name, content_type: "product", content_category: p.category || "", value: p.price, currency: "BDT" });
  if (connected()) loadReviews(p.id);
  if (push) { try { history.replaceState(null, "", "#product-" + p.id); } catch (err) { /* কিছু ইন-অ্যাপ ব্রাউজারে সীমাবদ্ধ */ } }
}

/* --- রিভিউ ও রেটিং --- */
const reviewCache = {};
let qvRating = 0;

function reviewsHtml(r) {
  const head = r.count
    ? `<div class="rv-sum">
         <div class="rv-big"><b>${toBn(r.average)}</b>${starsHtml(r.average)}<small>${toBn(r.count)} reviews</small></div>
         <div class="rv-bars">${[5, 4, 3, 2, 1].map((n) => {
           const c = r.distribution[n - 1];
           return `<div><span>${toBn(n)}★</span><i><u style="width:${Math.round(c / r.count * 100)}%"></u></i><em>${toBn(c)}</em></div>`;
         }).join("")}</div>
       </div>`
    : `<p class="rv-empty">No reviews yet. Be the first to review!</p>`;
  const list = r.reviews.map((v) => `
    <div class="rv">
      <div class="rv-top"><b>${esc(v.name)}</b>${v.verified ? `<span class="rv-ver">✔ Verified buyer</span>` : ""}<span class="rv-date">${esc(v.date)}</span></div>
      ${starsHtml(v.rating)}${v.text ? `<p>${esc(v.text)}</p>` : ""}
    </div>`).join("");
  return head + (list ? `<div class="rv-list">${list}</div>` : "") +
    `<button type="button" class="btn btn-outline btn-small" data-rvopen>✍️ Write a review</button><div id="rvFormWrap"></div>`;
}

async function loadReviews(id) {
  const show = (html) => { if (String(qvId) === String(id) && $("qvRvBody")) $("qvRvBody").innerHTML = html; };
  try {
    if (!reviewCache[id]) {
      const r = await (await fetch(`${CONFIG.API_URL}?action=reviews&productId=${encodeURIComponent(id)}`)).json();
      if (!r.ok) throw new Error("reviews");
      reviewCache[id] = r;
    }
    show(reviewsHtml(reviewCache[id]));
  } catch (e) {
    show(`<p class="rv-empty">Could not load reviews.</p>`);
  }
}

function reviewFormHtml() {
  qvRating = 0;
  return `
    <form id="rvForm" class="rv-form" novalidate>
      <p class="rv-hint">Only customers who have received their delivery can review — enter your order ID and mobile number.</p>
      <div class="rv-row"><input name="orderId" placeholder="Order ID" autocomplete="off"><input name="phone" type="tel" maxlength="11" inputmode="numeric" placeholder="Mobile number"></div>
      <div class="star-pick" id="starPick" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${toBn(n)} star">★</button>`).join("")}</div>
      <textarea name="text" rows="3" maxlength="500" placeholder="Share your experience with this product (optional)"></textarea>
      <button class="btn btn-small" type="submit">Submit review</button>
      <p class="form-msg" id="rvMsg" role="alert"></p>
    </form>`;
}

qv.addEventListener("submit", async (e) => {
  if (e.target.id !== "rvForm") return;
  e.preventDefault();
  const f = e.target, msg = $("rvMsg");
  const say = (t, ok) => { msg.className = "form-msg " + (ok ? "ok" : "err"); msg.textContent = t; };
  const orderId = f.orderId.value.trim();
  const phone = toEn(f.phone.value.trim());
  if (!orderId) return say("Enter your order ID.");
  if (!/^01[3-9]\d{8}$/.test(phone)) return say("Enter a valid mobile number.");
  if (!qvRating) return say("Select a star rating.");
  const btn = f.querySelector("[type=submit]");
  btn.disabled = true;
  try {
    const r = await api({ action: "review", productId: qvId, orderId, phone, rating: qvRating, text: f.text.value.trim() });
    if (!r.ok) return say(r.error || "Review was not submitted.");
    $("rvFormWrap").innerHTML = `<p class="form-msg ok">✅ Thank you! Your review has been submitted and will be published after approval.</p>`;
  } catch (err) {
    say("Something went wrong, please try again.");
  } finally {
    btn.disabled = false;
  }
});

function closeView() { if (qv.open) qv.close(); }
qv.addEventListener("close", () => {
  clearInterval(qvGalleryTimer);
  qvGalleryTimer = null;
  qvGalleryImages = [];
  if (/^#product-/.test(location.hash)) { try { history.replaceState(null, "", location.pathname + location.search); } catch (err) { /* ok */ } }
});
qv.addEventListener("click", (e) => {
  const t = e.target;
  if (t === qv || t.closest("[data-qvclose]")) return closeView();
  if (t.closest("[data-rvopen]")) { $("rvFormWrap").innerHTML = reviewFormHtml(); return; }
  const star = t.closest("[data-star]");
  if (star) {
    qvRating = Number(star.dataset.star);
    document.querySelectorAll("#starPick [data-star]").forEach((b) => b.classList.toggle("on", Number(b.dataset.star) <= qvRating));
    return;
  }
  if (t.closest("[data-rvjump]")) { e.preventDefault(); const box = $("qvReviews"); if (box) box.scrollIntoView({ behavior: "smooth" }); return; }
  const p = findProduct(qvId);
  if (!p) return;
  const imageButton = t.closest("[data-qvimage]");
  if (imageButton) {
    showQuickViewImage(qvGalleryImages.indexOf(imageButton.dataset.qvimage));
    return;
  }
  const imageStep = t.closest("[data-qvstep]");
  if (imageStep) { showQuickViewImage(qvGalleryIndex + Number(imageStep.dataset.qvstep)); return; }
  if (t.closest("[data-qvplus]") || t.closest("[data-qvminus]")) {
    const next = qvQty + (t.closest("[data-qvplus]") ? 1 : -1);
    if (next > p.stock) toast(`Only ${toBn(p.stock)} in stock`);
    else if (next >= 1) { qvQty = next; $("qvQty").textContent = toBn(qvQty); }
    return;
  }
  if (t.closest("[data-qvadd]") && addToCart(p.id, false, qvQty)) closeView();
  if (t.closest("[data-qvbuy]") && addToCart(p.id, true, qvQty)) { closeView(); location.href = "checkout.html"; }
  if (t.closest("[data-qvshare]")) {
    const url = location.href.split("#")[0] + "#product-" + p.id;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("🔗 Link copied"), () => toast(url));
  }
});
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-wish]")) return;
  const v = e.target.closest("[data-view]");
  if (v) { e.preventDefault(); openView(v.dataset.view); }
});

/* --- পছন্দের তালিকা (Wishlist): ব্রাউজারে সংরক্ষিত, ট্যাবের মধ্যে সিঙ্ক --- */
const HEART = '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
const Wish = {
  ids: [],
  fromApi: false,
  load() {
    try { this.ids = JSON.parse(localStorage.getItem("wishlist")) || []; } catch (e) { this.ids = []; }
    this.ids = this.ids.map(String);
  },
  save() { try { localStorage.setItem("wishlist", JSON.stringify(this.ids)); } catch (e) { /* ব্লকড */ } },
  has(id) { return this.ids.includes(String(id)); },
  toggle(id) {
    id = String(id);
    const i = this.ids.indexOf(id);
    const added = i < 0;
    if (added) this.ids.unshift(id); else this.ids.splice(i, 1);
    this.save();
    this.sync();
    const p = findProduct(id);
    if (added && p) Pixel.track("AddToWishlist", { content_ids: [id], content_name: p.name, content_type: "product", value: p.price, currency: "BDT" });
    toast(added ? "❤️ Added to wishlist" : "Removed from wishlist");
    return added;
  },
  prune() { // যে পণ্য আর নেই সেগুলো বাদ
    const keep = this.ids.filter((id) => findProduct(id));
    if (keep.length !== this.ids.length) { this.ids = keep; this.save(); }
  },
  sync() {
    document.querySelectorAll("[data-wish]").forEach((b) => {
      const on = this.has(b.dataset.wish);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
      if (b.classList.contains("wish-btn")) b.setAttribute("aria-label", on ? "Remove from wishlist" : "Add to wishlist");
      const lbl = b.querySelector("span");
      if (lbl) lbl.textContent = on ? "In your wishlist" : "Add to wishlist";
    });
    const n = this.ids.length;
    [["wishCount", n], ["bnWishCount", n]].forEach(([id, v]) => { $(id).textContent = toBn(v); $(id).hidden = !v; });
    $("wishOpen").classList.toggle("has", n > 0);
    if (openPanel === "wishDrawer") renderWish();
  }
};
Wish.load();
const wishBtnHtml = (id) => `<button type="button" class="wish-btn${Wish.has(id) ? " on" : ""}" data-wish="${esc(id)}" aria-pressed="${Wish.has(id)}" aria-label="${Wish.has(id) ? "Remove from wishlist" : "Add to wishlist"}"><svg viewBox="0 0 24 24" aria-hidden="true">${HEART}</svg></button>`;

function renderWish() {
  const list = Wish.ids.map(findProduct).filter(Boolean);
  $("wishBody").innerHTML = list.length ? list.map((p) => {
    const out = p.stock <= 0, id = esc(p.id);
    const img = p.image ? `<img src="${esc(p.image)}" alt="">` : esc(p.emoji);
    return `<div class="cart-row wish-row">
      <div class="cart-thumb">${img}</div>
      <div class="cart-info"><b>${esc(p.name)}</b><small>${esc(p.unit)} · ${money(p.price)}${p.oldPrice > p.price ? ` <del>${money(p.oldPrice)}</del>` : ""}</small>${out ? `<div class="w-out">Out of stock</div>` : ""}</div>
      <div class="w-act"><button type="button" class="btn btn-small btn-outline add-to-cart-btn" data-wish-add="${id}" ${out ? "disabled" : ""}><svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>Add To Cart</button><button type="button" class="w-x" data-wish="${id}" aria-label="${esc(p.name)} Remove from list">✕ Remove</button></div>
    </div>`;
  }).join("") : `<p class="empty">Your wishlist is empty.<br>Tap the ❤️ on a product image.</p>`;
  $("wishAddAll").disabled = !list.some((p) => p.stock > 0);
}

document.addEventListener("click", (e) => {
  const w = e.target.closest("[data-wish]");
  if (w) { e.preventDefault(); Wish.toggle(w.dataset.wish); return; }
  const a = e.target.closest("[data-wish-add]");
  if (a) addToCart(a.dataset.wishAdd);
});
window.addEventListener("storage", (e) => { if (e.key === "wishlist") { Wish.load(); Wish.sync(); } });

/* --- ড্রয়ার (কার্ট ও পছন্দের তালিকা): ফোকাস ধরে রাখা, পেছনের অংশ নিষ্ক্রিয়, বন্ধ করলে ফোকাস ফেরত --- */
let lastFocus = null, openPanel = null;
const backdropEls = () => document.querySelectorAll(".marquee, .header, .catbar, main, .footer, .bottom-nav, .float, .scroll-top");
function openDrawer(id, focusId) {
  if (openPanel === id) return;
  if (openPanel) closeDrawer(true);
  if (!lastFocus) lastFocus = document.activeElement;
  $(id).classList.add("open"); $(id).setAttribute("aria-hidden", "false");
  $("overlay").hidden = false;
  backdropEls().forEach((el) => { el.inert = true; });
  openPanel = id;
  $(focusId).focus({ preventScroll: true });
}
function closeDrawer(keep) {
  if (!openPanel) return;
  $(openPanel).classList.remove("open"); $(openPanel).setAttribute("aria-hidden", "true");
  openPanel = null;
  if (keep === true) return;
  if (!$("filters").classList.contains("open")) $("overlay").hidden = true;
  backdropEls().forEach((el) => { el.inert = false; });
  if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (err) { /* ok */ } }
  lastFocus = null;
}
function openCart() { openDrawer("drawer", "cartClose"); }
function closeCart() { closeDrawer(); }
function openWish() { renderWish(); openDrawer("wishDrawer", "wishClose"); }
$("cartOpen").addEventListener("click", openCart);
$("floatingCart").addEventListener("click", openCart);
$("cartClose").addEventListener("click", closeCart);
$("wishOpen").addEventListener("click", openWish);
$("bnWish").addEventListener("click", openWish);
$("wishClose").addEventListener("click", closeCart);
$("wishToCart").addEventListener("click", () => { closeDrawer(true); openDrawer("drawer", "cartClose"); });
$("wishAddAll").addEventListener("click", () => {
  const items = Wish.ids.map(findProduct).filter((p) => p && p.stock > 0);
  let added = 0;
  items.forEach((p) => { if (addToCart(p.id, true)) added++; });
  toast(added ? `✅ ${toBn(added)} products added to cart` : "No products available to add to cart");
});
$("overlay").addEventListener("click", () => { closeCart(); closeFilters(); });

const moreToggle = $("moreToggle");
const moreMenu = $("moreMenu");
moreToggle.addEventListener("click", () => {
  const open = moreToggle.getAttribute("aria-expanded") !== "true";
  moreToggle.setAttribute("aria-expanded", String(open));
  moreMenu.hidden = !open;
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".h-more-wrap")) {
    moreToggle.setAttribute("aria-expanded", "false");
    moreMenu.hidden = true;
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    moreToggle.setAttribute("aria-expanded", "false");
    moreMenu.hidden = true;
  }
});

function scrollCategoryRail(direction) {
  catSlide.hold = Date.now() + 5000;
  categoryStep(direction);
}
$("catScrollPrev").addEventListener("click", () => scrollCategoryRail(-1));
$("catScrollNext").addEventListener("click", () => scrollCategoryRail(1));
$("goCheckout").addEventListener("click", (e) => { if (!state.cart.length) e.preventDefault(); else trackCheckout(); closeCart(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCart(); closeFilters(); } });

/* --- মূল্য হিসাব --- */
function totals() {
  const lines = cartLines();
  const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const s = state.settings;
  let delivery = Number($("areaSelect").value === "outside" ? s.deliveryOutside : s.deliveryInside) || 0;
  if (Number(s.freeDeliveryAbove) > 0 && sub >= Number(s.freeDeliveryAbove)) delivery = 0;
  if (!lines.length) delivery = 0;
  const discount = state.coupon ? state.coupon.discount : 0;
  return { sub, delivery, discount, total: Math.max(0, sub + delivery - discount) };
}

function updateSummary() {
  const t = totals();
  $("sumPrice").textContent = money(t.sub);
  $("sumDelivery").textContent = t.delivery === 0 && t.sub > 0 ? "Free" : money(t.delivery);
  $("discountRow").hidden = !t.discount;
  $("sumDiscount").textContent = "−" + money(t.discount);
  $("sumTotal").textContent = money(t.total);
  renderPayHelp();
}
$("areaSelect").addEventListener("change", updateSummary);

/* --- কুপন --- */
function setCouponMsg(text, ok) {
  const m = $("couponMsg");
  m.textContent = text;
  m.className = "coupon-msg " + (text ? (ok ? "ok" : "err") : "");
}

$("couponBtn").addEventListener("click", async () => {
  const code = $("couponInput").value.trim();
  if (!code) return setCouponMsg("Enter a coupon code.", false);
  if (!connected()) return setCouponMsg("Coupons will work once the sheet is connected.", false);
  const btn = $("couponBtn");
  btn.disabled = true;
  try {
    const r = await api({ action: "coupon", code, subtotal: totals().sub });
    if (r.ok) {
      state.coupon = { code: r.code, discount: r.discount };
      setCouponMsg(`🎉 ${r.code} applied — ${money(r.discount)} off!`, true);
    } else {
      state.coupon = null;
      setCouponMsg(r.error, false);
    }
  } catch (e) {
    setCouponMsg("Could not verify the coupon, please try again.", false);
  }
  btn.disabled = false;
  updateSummary();
});

/* --- পেমেন্ট পদ্ধতি --- */
function renderPayHelp() {
  const m = form.payMethod.value;
  $("payInfo").hidden = m === "cod";
  if (m !== "cod") {
    $("payHelp").innerHTML = `${m === "bkash" ? "bKash" : "Nagad"}: <b>Send Money</b> to <b>${esc(toBn(state.settings[m]))}</b> — amount <b>${money(totals().total)}</b>, then enter the TrxID below.`;
  }
}
form.addEventListener("change", (e) => { if (e.target.name === "payMethod") renderPayHelp(); });

/* --- চেকআউট শুরু (Pixel: InitiateCheckout, একবারই) --- */
let checkoutTracked = false;
function trackCheckout() {
  if (checkoutTracked || !state.cart.length) return;
  checkoutTracked = true;
  Pixel.track("InitiateCheckout", { ...pixelItems(cartLines()), value: totals().sub, currency: "BDT" });
}
form.addEventListener("focusin", trackCheckout);

// হোয়াটসঅ্যাপ/কল বাটনে ক্লিক (Pixel: Contact)
document.addEventListener("click", (e) => {
  if (e.target.closest("#waBtn, #ftWa")) Pixel.track("Contact", { method: "whatsapp" });
  else if (e.target.closest("#ftPhoneLink")) Pixel.track("Contact", { method: "phone" });
});

/* --- অর্ডার পাঠানো --- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("formMsg");
  const btn = $("submitBtn");
  msg.className = "form-msg";
  msg.textContent = "";
  if (form.website.value) return; // স্প্যাম বট

  const name = form.name.value.trim();
  const phone = toEn(form.phone.value.trim());
  const address = form.address.value.trim();
  const payMethod = form.payMethod.value;
  const trxId = form.trxId.value.trim();
  const email = form.email.value.trim();
  [form.name, form.phone, form.address, form.trxId, form.email].forEach((f) => f.classList.remove("invalid"));

  const fail = (text, field) => {
    if (field) { field.classList.add("invalid"); field.focus(); }
    msg.className = "form-msg err";
    msg.textContent = "⚠️ " + text;
  };

  if (!state.cart.length) return fail("Your cart is empty. Add products first.");
  if (name.length < 3) return fail("Enter a valid name.", form.name);
  if (!/^01[3-9]\d{8}$/.test(phone)) return fail("Enter a valid 11-digit mobile number (e.g. 01712345678).", form.phone);
  if (address.length < 10) return fail("Enter your full address.", form.address);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email or leave the field empty.", form.email);
  if (payMethod !== "cod" && trxId.length < 6) return fail("Enter the payment transaction ID (TrxID).", form.trxId);
  if (!connected()) return fail("Google Sheet is not connected yet. See step 3 of the guide.");

  btn.disabled = true;
  btn.textContent = "Placing order...";

  try {
    const r = await api({
      action: "order",
      name, phone, address, email,
      area: $("areaSelect").value,
      note: form.note.value.trim(),
      payMethod, trxId,
      coupon: state.coupon ? state.coupon.code : "",
      items: state.cart.map((c) => ({ id: c.id, qty: c.qty }))
    });
    if (!r.ok) throw new Error(r.error || "Order failed");

    Pixel.track("Purchase", { ...pixelItems(cartLines()), value: r.total, currency: "BDT" }, r.orderId);
    checkoutTracked = false;
    showSuccess(r, name, phone, email);
    state.cart = [];
    state.coupon = null;
    form.reset();
    $("couponInput").value = "";
    setCouponMsg("", true);
    renderPayHelp();
    loadShop(); // নতুন স্টক দেখানো
  } catch (err) {
    fail(err.message && err.message !== "Failed to fetch" ? err.message : "Something went wrong. Check your internet and try again, or call us.");
    updateSummary();
  } finally {
    btn.disabled = !state.cart.length;
    btn.textContent = "✅ Confirm order";
  }
});

function showSuccess(r, name, phone, email) {
  const s = $("success");
  const text = `My order ID is ${r.orderId}, name ${name}. Total ${money(r.total)}.`;
  s.hidden = false;
  s.innerHTML = `
    <div class="tick">✅</div>
    <h3>Thank you, ${esc(name)}! Your order has been received</h3>
    <p>Order ID: <b class="oid">${esc(r.orderId)}</b></p>
    <p>Total: <b>${money(r.total)}</b> — we will call you shortly to confirm.</p>
    ${email ? `<p class="small">📧 Confirmation email sent to: ${esc(email)}</p>` : ""}
    <p class="small">You can track your order any time with this ID and your mobile number.</p>
    <div class="hero-buttons" style="justify-content:center">
      <a class="btn btn-small" target="_blank" rel="noopener" href="https://wa.me/${esc(state.settings.whatsapp)}?text=${encodeURIComponent(text)}">💬 Tell us on WhatsApp</a>
      <a class="btn btn-small btn-outline" href="track.html?id=${encodeURIComponent(r.orderId)}&phone=${encodeURIComponent(phone)}">📦 Track order</a>
    </div>`;
  s.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* --- অর্ডার ট্র্যাকিং --- */
const trackForm = $("trackForm");
document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-fill]");
  if (!f) return;
  const [id, phone] = f.dataset.fill.split("|");
  trackForm.oid.value = id;
  trackForm.phone.value = phone;
});

trackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("trackResult");
  if (!connected()) { out.innerHTML = `<p class="form-msg err">Tracking will work once the sheet is connected.</p>`; return; }
  out.innerHTML = `<p class="loading">Searching...</p>`;
  try {
    const url = `${CONFIG.API_URL}?action=track&id=${encodeURIComponent(trackForm.oid.value.trim())}&phone=${encodeURIComponent(toEn(trackForm.phone.value.trim()))}`;
    const r = await (await fetch(url)).json();
    if (!r.ok) { out.innerHTML = `<p class="form-msg err">⚠️ ${esc(r.error)}</p>`; return; }
    const steps = ["নতুন", "কনফার্মড", "শিপড", "ডেলিভারড"]; // status values stored in the sheet
    const STATUS_EN = { "নতুন": "New", "কনফার্মড": "Confirmed", "শিপড": "Shipped", "ডেলিভারড": "Delivered" };
    const o = r.order;
    const cancelled = o.status === "বাতিল";
    const at = steps.indexOf(o.status);
    out.innerHTML = `
      <div class="track-card">
        <p><b>${esc(o.orderId)}</b> · ${esc(o.date)}</p>
        <p>${esc(o.items)}</p>
        <p>Total: <b>${money(o.total)}</b></p>
        ${o.trackingCode ? `<p>🚚 ${esc(o.courier || "Courier")} tracking: <b>${esc(o.trackingCode)}</b>${o.courierStatus ? ` · ${esc(o.courierStatus)}` : ""}${o.trackingUrl && /^https:\/\//.test(o.trackingUrl) ? ` · <a href="${esc(o.trackingUrl)}" target="_blank" rel="noopener" style="text-decoration:underline">Track delivery ↗</a>` : ""}</p>` : ""}
        ${cancelled ? `<p class="form-msg err">❌ This order has been cancelled.</p>` : `
        <ol class="steps">${steps.map((s, i) => `<li class="${i <= at ? "done" : ""}">${STATUS_EN[s] || s}</li>`).join("")}</ol>`}
        ${o.status === "ডেলিভারড" ? `<p class="form-msg ok">⭐ How did you like the product? <a href="#products" style="text-decoration:underline">Open the product and leave a review</a></p>` : ""}
      </div>`;
  } catch (err) {
    out.innerHTML = `<p class="form-msg err">⚠️ Something went wrong, please try again.</p>`;
  }
});


/* --- মোবাইল বটম নেভ --- */
$("bnCart").addEventListener("click", openCart);

/* --- হিরো স্লাইডার ---
   স্লাইডের তথ্য আসে: অ্যাডমিন > 🖼️ স্লাইডার (সবচেয়ে অগ্রাধিকার) → config.js এর SITE_SLIDES → নিচের DEFAULT_SLIDES।
   ছবির মাপ: ডেস্কটপ/ট্যাবলেট 1600×800 px (2:1), মোবাইল 1000×800 px (5:4) — README দেখুন। */
const THEME_ART = {
  green: ["images/honey.svg", "images/cashews.svg", "images/chili.svg", "images/mustard-oil.svg"],
  gold: ["images/honey.svg"],
  teal: ["images/ghee.svg"]
};
const DEFAULT_SLIDES = [
  { badge: "🚚 Cash on delivery nationwide", title: "100% pure oil, spices, nuts & honey, straight to your home", subtitle: "Adulteration-free, fresh and trusted-quality grocery products. Pay after you receive.", btnText: "Buy now", link: "shop.html", theme: "green" },
  { badge: "🍯 Seasonal Special", title: "Pure Sundarban honey — now at a special price", subtitle: "Natural, sugar-free and adulteration-free. Authentic taste in every bottle.", btnText: "Shop honey", link: "shop.html", theme: "gold" },
  { badge: "🎁 Free Delivery Offer", title: "Buy more, save on delivery", subtitle: "Free delivery on orders above a set amount, plus easy 7-day returns and cash on delivery.", btnText: "Start shopping", link: "shop.html", theme: "teal" }
];

function slideHtml(sl, i) {
  const theme = THEME_ART[sl.theme] ? sl.theme : "green";
  if (sl.imgDesktop) {
    const safe = safeHref(sl.link);
    const link = safe ? ` href="${esc(safe)}"` : "";
    const tag = safe ? "a" : "div";
    const cap = sl.title || sl.subtitle;
    return `<${tag} class="slide has-img t-${theme}${cap ? " cap" : ""}"${link}>
      <picture>${sl.imgMobile ? `<source media="(max-width:560px)" srcset="${esc(sl.imgMobile)}">` : ""}<img src="${esc(sl.imgDesktop)}" alt="${esc(sl.title || sl.badge || "Offer banner")}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" draggable="false"></picture>
      ${cap ? `<div class="slide-text">${sl.badge ? `<span class="badge">${esc(sl.badge)}</span>` : ""}${sl.title ? `<h2>${esc(sl.title)}</h2>` : ""}${sl.subtitle ? `<p>${esc(sl.subtitle)}</p>` : ""}${sl.btnText ? `<span class="btn btn-gold">${esc(sl.btnText)}</span>` : ""}</div>` : ""}
    </${tag}>`;
  }
  const art = THEME_ART[theme];
  return `<article class="slide t-${theme}">
      <div class="slide-text">
        ${sl.badge ? `<span class="badge">${esc(sl.badge)}</span>` : ""}
        ${sl.title ? `<h2>${esc(sl.title)}</h2>` : ""}
        ${sl.subtitle ? `<p>${esc(sl.subtitle)}</p>` : ""}
        ${sl.btnText && safeHref(sl.link) ? `<div class="hero-buttons"><a href="${esc(safeHref(sl.link))}" class="btn btn-gold">${esc(sl.btnText)}</a></div>` : ""}
      </div>
      <div class="slide-art${art.length === 1 ? " one" : ""}" aria-hidden="true">${art.map((src) => `<span><img src="${esc(src)}" alt="" loading="lazy"></span>`).join("")}</div>
    </article>`;
}

const Slider = {
  i: 0, timer: null, sig: "", slides: [], dragging: false, hold: 0, interval: 5500,
  root: $("slider"), track: $("slides"), dots: $("slDots"),
  mount(list) {
    list = (list && list.length ? list : DEFAULT_SLIDES).slice(0, 5);
    const sig = JSON.stringify(list);
    if (sig === this.sig) return;
    this.sig = sig;
    this.track.innerHTML = list.map(slideHtml).join("");
    this.slides = [...this.track.children];
    const many = this.slides.length > 1;
    this.dots.hidden = !many;
    this.root.querySelectorAll(".sl-nav").forEach((b) => { b.hidden = !many; });
    this.dots.innerHTML = this.slides.map((_, n) => `<button type="button" data-sl="${n}" aria-label="Banner ${toBn(n + 1)}"></button>`).join("");
    this.root.style.setProperty("--sl-time", this.interval + "ms");
    this.go(0, true);
    this.play();
  },
  go(n, instant) {
    const len = this.slides.length;
    const wrapped = !instant && len > 1 && ((this.i === len - 1 && n >= len) || (this.i === 0 && n < 0));
    this.i = ((n % len) + len) % len;
    if (wrapped) {                       // শেষ ↔ প্রথম: দীর্ঘ ঝাঁকুনি নয়, নরম ফেড
      this.track.classList.add("wrapping");
      this.track.style.transform = `translate3d(-${this.i * 100}%,0,0)`;
      setTimeout(() => this.track.classList.remove("wrapping"), 650);
    } else {
      this.track.style.transform = `translate3d(-${this.i * 100}%,0,0)`;
    }
    this.slides.forEach((sl, k) => { sl.inert = k !== this.i; sl.setAttribute("aria-hidden", String(k !== this.i)); });
    this.mark();
  },
  mark() {                               // ডট ও প্রোগ্রেস অ্যানিমেশন নতুন করে শুরু
    [...this.dots.children].forEach((d, k) => {
      d.classList.remove("on");
      if (k === this.i) { void d.offsetWidth; d.classList.add("on"); }
    });
  },
  play() {
    clearTimeout(this.timer);
    this.root.classList.remove("paused");
    if (this.slides.length < 2 || this.hold > 0 || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.mark();
    this.timer = setTimeout(() => { this.go(this.i + 1); this.play(); }, this.interval);
  },
  stop() { clearTimeout(this.timer); this.root.classList.add("paused"); },
  pause() { this.hold++; this.stop(); },
  resume() { this.hold = Math.max(0, this.hold - 1); if (!this.hold) this.play(); }
};

(function initSliderEvents() {
  const S = Slider, root = S.root, track = S.track;
  root.addEventListener("click", (e) => {
    const d = e.target.closest("[data-sl]");
    if (d) S.go(Number(d.dataset.sl));
    else if (e.target.closest(".sl-prev")) S.go(S.i - 1);
    else if (e.target.closest(".sl-next")) S.go(S.i + 1);
    else return;
    S.play();
  });
  root.addEventListener("mouseenter", () => S.pause());
  root.addEventListener("mouseleave", () => S.resume());
  root.addEventListener("focusin", () => S.pause());
  root.addEventListener("focusout", () => S.resume());
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { S.go(S.i - 1); S.play(); }
    if (e.key === "ArrowRight") { S.go(S.i + 1); S.play(); }
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? S.stop() : S.play()));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => (en.isIntersecting ? S.resume() : S.pause()), { threshold: 0.25 }).observe(root);
  }

  // আঙুল/মাউসের সাথে সাথে স্লাইড টানা (ড্র্যাগ), ছেড়ে দিলে স্ন্যাপ
  let sx = null, dx = 0, moved = false, w = 1;
  root.addEventListener("pointerdown", (e) => {
    if ((e.pointerType === "mouse" && e.button !== 0) || e.target.closest(".sl-nav, .sl-dots") || S.slides.length < 2) return;
    sx = e.clientX; dx = 0; moved = false; w = root.clientWidth;
  });
  root.addEventListener("pointermove", (e) => {
    if (sx === null) return;
    dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 8) { moved = true; track.classList.add("dragging"); S.pause(); try { root.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } }
    if (moved) {
      const edge = (S.i === 0 && dx > 0) || (S.i === S.slides.length - 1 && dx < 0) ? 0.35 : 1;
      track.style.transform = `translate3d(calc(-${S.i * 100}% + ${dx * edge}px),0,0)`;
    }
  });
  const end = () => {
    if (sx === null) return;
    sx = null;
    if (!moved) return;
    track.classList.remove("dragging");
    const target = Math.abs(dx) > w * 0.15 ? S.i + (dx < 0 ? 1 : -1) : S.i;
    S.go(Math.max(0, Math.min(S.slides.length - 1, target)));
    S.resume();
    setTimeout(() => { moved = false; }, 0);
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);
  root.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
})();

Slider.mount(typeof SITE_SLIDES !== "undefined" && SITE_SLIDES.length ? SITE_SLIDES : null);

/* --- স্ক্রলে নরম অ্যানিমেশন (JS না চললে সবকিছু এমনিই দেখায়) --- */
document.documentElement.classList.add("js");
(function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: 0.06, rootMargin: "0px 0px -30px 0px" });
  els.forEach((el) => io.observe(el));
})();

/* --- লাইট/ডার্ক থিম: ক্রেতার পছন্দ সংরক্ষিত; পছন্দ না থাকলে ডিভাইসের সেটিং অনুসরণ --- */
const Theme = {
  cur() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; },
  stored() { try { const t = localStorage.getItem("theme"); return t === "dark" || t === "light" ? t : null; } catch (e) { return null; } },
  apply(t) {
    document.documentElement.setAttribute("data-theme", t);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#0e1812" : "#17703c");
    const b = $("themeBtn");
    b.setAttribute("aria-pressed", String(t === "dark"));
    b.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    $("themeIco").textContent = t === "dark" ? "☀️" : "🌙";
  },
  init() {
    this.apply(this.cur());
    $("themeBtn").addEventListener("click", () => {
      const t = this.cur() === "dark" ? "light" : "dark";
      this.apply(t);
      try { localStorage.setItem("theme", t); } catch (e) { /* ব্লকড */ }
      toast(t === "dark" ? "🌙 Dark mode on" : "☀️ Light mode on");
    });
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const follow = (e) => { if (!this.stored()) this.apply(e.matches ? "dark" : "light"); };
      if (mq.addEventListener) mq.addEventListener("change", follow); else if (mq.addListener) mq.addListener(follow);
    }
  }
};
Theme.init();

/* --- উপরে যাওয়ার বাটন: স্ক্রল প্রোগ্রেস রিং, ৬০০px পরে দেখা দেয় --- */
(function () {
  const btn = $("toTop"), bar = $("toTopBar"), C = 2 * Math.PI * 19;
  bar.style.strokeDasharray = C.toFixed(2);
  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    bar.style.strokeDashoffset = (C * (1 - (max > 0 ? Math.min(1, y / max) : 0))).toFixed(2);
    btn.classList.toggle("show", y > 600);
  };
  window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update);
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const logo = document.querySelector(".header .logo");
    if (logo) logo.focus({ preventScroll: true });
  });
  update();
})();

/* --- হেডার: স্ক্রল করলে নরম ছায়া --- */
(function () {
  const hd = document.querySelector(".header");
  const on = () => hd.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", on, { passive: true });
  on();
})();

/* --- সার্চ ইঞ্জিনের জন্য স্ট্রাকচার্ড ডেটা (দোকান + পণ্য + রেটিং) --- */
function updateStructuredData() {
  const base = location.href.split("#")[0];
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return undefined; } };
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Store", "name": "KhatiGhor", "url": base, "telephone": "+88" + String(state.settings.phone || "").replace(/\D/g, ""), "priceRange": "৳৳", ...(Object.values(socialLinks()).some(Boolean) ? { "sameAs": Object.values(socialLinks()).filter(Boolean) } : {}), ...(state.settings.email ? { "email": state.settings.email } : {}), ...(state.settings.address ? { "address": state.settings.address } : {}), "description": "১০০% খাঁটি তেল, মশলা, বাদাম ও মধু — সারাদেশে ক্যাশ অন ডেলিভারি" },
      ...state.products.slice(0, 50).map((p) => ({
        "@type": "Product", "name": p.name, "description": p.desc || p.name, "category": p.category || undefined,
        ...([p.image, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean).length ? {
          "image": [p.image, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean).map(abs)
        } : {}),
        "offers": { "@type": "Offer", "priceCurrency": "BDT", "price": String(p.price), "url": base + "#product-" + p.id, "availability": p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
        ...(p.reviews ? { "aggregateRating": { "@type": "AggregateRating", "ratingValue": String(p.rating), "reviewCount": String(p.reviews) } } : {})
      }))
    ]
  };
  let el = document.getElementById("ld");
  if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = "ld"; document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
}

/* --- অফলাইন-সহায়ক সার্ভিস ওয়ার্কার (শুধু http/https এ, যেমন GitHub Pages) --- */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}

/* --- শুরু --- */
applySettings();
renderCart();
loadShop();
