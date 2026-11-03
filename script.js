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
  { id: 1, name: "খাঁটি সরিষার তেল", unit: "১ লিটার", category: "তেল", price: 320, oldPrice: 380, emoji: "🫒", image: "images/mustard-oil.svg", tag: "বেস্ট সেলার", stock: 50, desc: "কাঠের ঘানিতে ভাঙানো ১০০% খাঁটি সরিষার তেল। ঝাঁঝালো ঘ্রাণ ও স্বাদ, কোনো ভেজাল বা কেমিক্যাল নেই।" },
  { id: 2, name: "সুন্দরবনের খাঁটি মধু", unit: "৫০০ গ্রাম", category: "মধু", price: 650, oldPrice: 780, emoji: "🍯", image: "images/honey.svg", tag: "২০% ছাড়", stock: 30, desc: "সুন্দরবনের মৌসুমি ফুলের প্রাকৃতিক মধু। প্রক্রিয়াজাত নয়, চিনি মেশানো নয়।" },
  { id: 3, name: "কাজুবাদাম (প্রিমিয়াম)", unit: "৫০০ গ্রাম", category: "বাদাম", price: 780, oldPrice: 900, emoji: "🥜", image: "images/cashews.svg", tag: "", stock: 40, desc: "বড় দানার ফ্রেশ কাজুবাদাম, মচমচে ও সুস্বাদু। স্ন্যাকস ও রান্না দুটোতেই দারুণ।" },
  { id: 4, name: "হলুদ গুঁড়া", unit: "৫০০ গ্রাম", category: "মশলা", price: 240, oldPrice: 280, emoji: "🟡", image: "images/turmeric.svg", tag: "", stock: 60, desc: "বাছাই করা কাঁচা হলুদ থেকে তৈরি, কৃত্রিম রঙ ছাড়া খাঁটি হলুদ গুঁড়া।" },
  { id: 5, name: "মরিচ গুঁড়া", unit: "৫০০ গ্রাম", category: "মশলা", price: 290, oldPrice: 340, emoji: "🌶️", image: "images/chili.svg", tag: "নতুন", stock: 60, desc: "ঝাল ও সুগন্ধি শুকনা মরিচের গুঁড়া, কোনো ভেজাল বা কৃত্রিম রঙ নেই।" },
  { id: 6, name: "ঘি (খাঁটি গাওয়া)", unit: "৫০০ গ্রাম", category: "ঘি", price: 890, oldPrice: 1050, emoji: "🧈", image: "images/ghee.svg", tag: "", stock: 20, desc: "গাওয়া দুধের মাখন থেকে তৈরি দানাদার খাঁটি ঘি। ঘ্রাণেই চেনা যায় আসল স্বাদ।" }
];

/* =====================================================
   ২. এখান থেকে নিচে সাধারণত কিছু বদলানোর দরকার নেই
   ===================================================== */
const bn = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
const toBn = (n) => String(n).replace(/\d/g, (d) => bn[d]);
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
  category: "সব",
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

/* --- পণ্য ও সেটিংস লোড --- */
async function loadShop() {
  if (connected()) {
    try {
      const res = await fetch(CONFIG.API_URL + "?action=products");
      const data = await res.json();
      if (data.ok) {
        state.products = data.products;
        state.categoryList = Array.isArray(data.categories) ? data.categories : [];
        Wish.fromApi = true;
        renderFeatured(data.featured);
        state.settings = { ...state.settings, ...data.settings };
        if (Array.isArray(data.slides) && data.slides.length) Slider.mount(data.slides);
      }
    } catch (e) { /* নিচে নমুনা পণ্য দেখাবে */ }
  }
  if (!state.products.length) state.products = DEMO_PRODUCTS;
  applySettings();
  Pixel.init(state.settings.metaPixelId || (typeof SITE_PIXEL_ID !== "undefined" ? SITE_PIXEL_ID : ""));
  renderChips();
  renderTiles();
  renderProducts();
  updateStructuredData();
  if (Wish.fromApi) Wish.prune();
  Wish.sync();
  // কার্টে থাকা মুছে ফেলা/স্টকহীন পণ্য সরানো
  state.cart = state.cart.filter((c) => state.products.some((p) => String(p.id) === String(c.id)));
  renderCart();
  if (!loadShop.done) {
    loadShop.done = true;
    const m = location.hash.match(/^#product-(.+)$/);
    if (m) openView(decodeURIComponent(m[1]), false);
  }
}

/* --- অফার কাউন্টডাউন: অ্যাডমিন যে সময় দেবে সেই পর্যন্ত চলে, সময় না থাকলে/পেরিয়ে গেলে ব্যান্ড লুকানো --- */
const Offer = {
  timer: null,
  set(endStr, text) {
    clearInterval(this.timer);
    const band = $("offerBand");
    const end = endStr ? new Date(endStr).getTime() : NaN;
    if (!(end > Date.now())) { band.hidden = true; return; }
    $("offerText").textContent = text || "🔥 বিশেষ অফার শেষ হতে বাকি:";
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
  $("navReviews").hidden = !list.length;
  $("featured").innerHTML = list.map((r) => `
    <article class="review">
      <div class="stars" aria-label="${toBn(r.rating)} স্টার">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
      <p>${esc(r.text)}</p>
      <footer><b>— ${esc(r.name)}</b>${r.verified ? ` <span class="rv-ver">✔ ভেরিফাইড ক্রেতা</span>` : ""}${r.product ? `<small>${esc(r.product)}</small>` : ""}</footer>
    </article>`).join("");
}

function applySettings() {
  const s = state.settings;
  $("waBtn").href = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent("আসসালামু আলাইকুম, আমি পণ্য অর্ডার করতে চাই।")}`;
  $("ftPhone").textContent = toBn(s.phone);
  $("areaSelect").innerHTML =
    `<option value="inside">ঢাকার ভিতরে (${money(s.deliveryInside)})</option>` +
    `<option value="outside">ঢাকার বাইরে (${money(s.deliveryOutside)})</option>`;
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
  if (code) pa.querySelector("small").textContent = `কোড: ${code} · চেপে কপি করুন`;

  Offer.set(s.offerEndsAt, s.offerText);

  const free = Number(s.freeDeliveryAbove) > 0 ? `🎁 ${money(s.freeDeliveryAbove)} এর উপরে অর্ডারে ফ্রি ডেলিভারি` : "";
  const msgs = [s.notice && "📢 " + s.notice, "🚚 সারাদেশে ক্যাশ অন ডেলিভারি", free,
    "🌿 ১০০% খাঁটি ও ভেজালমুক্ত পণ্য", "↩️ ৭ দিনের সহজ রিটার্ন", "📞 অর্ডার করতে কল করুন: " + toBn(s.phone)].filter(Boolean);
  const group = msgs.map((m) => `<span>${esc(m)}</span>`).join("");
  $("marqueeTrack").innerHTML = `<div class="mq">${group + group}</div><div class="mq" aria-hidden="true">${group + group}</div>`;
}

/* --- ক্যাটাগরি, ফিল্টার ও পণ্য তালিকা --- */
const starsHtml = (avg) => `<span class="stars-fill" style="--p:${Math.round(Number(avg) / 5 * 100)}%" aria-hidden="true">★★★★★</span>`;
const ratingHtml = (avg, n) => `<div class="rate" title="${toBn(avg)} / ৫">${starsHtml(avg)}<small>${toBn(avg)} (${toBn(n)})</small></div>`;
const discountOf = (p) => (p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
const searchText = () => $("hSearch").value.trim().toLowerCase();

function renderChips() {
  const cats = ["সব", ...categoryNames(true)];
  const count = (c) => (c === "সব" ? state.products.length : state.products.filter((p) => p.category === c).length);
  $("catNav").innerHTML = cats.map((c) =>
    `<button type="button" class="cat${c === state.category ? " active" : ""}" data-cat="${esc(c)}">${c === "সব" ? "সব পণ্য" : esc(c)}${c === "সব" ? "" : '<span class="cat-chevron" aria-hidden="true">⌄</span>'}</button>`).join("");
  $("fCats").innerHTML = cats.map((c) =>
    `<button type="button" class="f-cat${c === state.category ? " active" : ""}" data-cat="${esc(c)}"><span>${c === "সব" ? "সব পণ্য" : esc(c)}</span><em>${toBn(count(c))}</em></button>`).join("");
  $("ftCats").innerHTML = cats.map((c) =>
    `<a href="#products" data-cat="${esc(c)}">${c === "সব" ? "সব পণ্য" : esc(c)}</a>`).join("");
}

function filteredProducts() {
  const q = searchText();
  const min = parseFloat(state.minPrice), max = parseFloat(state.maxPrice);
  const list = state.products.filter((p) =>
    (state.category === "সব" || p.category === state.category) &&
    (!q || (p.name + " " + p.category).toLowerCase().includes(q)) &&
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
  return sorter ? list.sort(sorter) : list;
}

function activeFilterList() {
  const f = [];
  if (state.category !== "সব") f.push(["cat", state.category]);
  if (state.minPrice !== "" || state.maxPrice !== "") {
    f.push(["price", `${state.minPrice !== "" ? money(state.minPrice) : "৳০"} – ${state.maxPrice !== "" ? money(state.maxPrice) : "∞"}`]);
  }
  if (state.inStock) f.push(["stock", "স্টকে আছে"]);
  if (state.offerOnly) f.push(["offer", "ছাড়ের পণ্য"]);
  if (state.topRated) f.push(["rated", "৪★ ও তার বেশি"]);
  if (searchText()) f.push(["q", "“" + $("hSearch").value.trim() + "”"]);
  return f;
}

function renderProducts() {
  const list = filteredProducts();
  const active = activeFilterList();

  $("resultCount").innerHTML = `<b>${toBn(list.length)}</b>টি পণ্য পাওয়া গেছে`;
  $("fApply").textContent = list.length ? `${toBn(list.length)}টি পণ্য দেখুন` : "কোনো পণ্য নেই";
  $("activeFilters").innerHTML = active.length
    ? active.map(([k, label]) => `<button type="button" class="af" data-clear="${k}">${esc(label)} ✕</button>`).join("") +
      `<button type="button" class="af clear" data-clear="all">সব মুছুন</button>`
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
    $("productList").innerHTML = `<div class="empty-state"><p>😕 এই ফিল্টারে কোনো পণ্য পাওয়া যায়নি।</p><button type="button" class="btn btn-small" data-clear="all">ফিল্টার রিসেট করুন</button></div>`;
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
    ? `<div class="stepper"><button type="button" data-dec="${id}" aria-label="কমান">−</button><span>${toBn(line.qty)}</span><button type="button" data-inc="${id}" aria-label="বাড়ান">+</button></div>`
    : `<button type="button" class="btn btn-outline add-to-cart-btn" data-add="${id}" ${out ? "disabled" : ""}>${cartIcon}Add To Cart</button>`;
  return addOnly ? first : `${first}<button type="button" class="btn" data-buy="${id}" ${out ? "disabled" : ""}>${buyIcon}এখনই কিনুন</button>`;
}

function productCard(p, addOnly = false) {
  const out = p.stock <= 0;
  const off = discountOf(p);
  return `
    <article class="product${out ? " out" : ""}">
      <div class="product-img" data-view="${esc(p.id)}" title="পণ্যের বিস্তারিত দেখুন">
        ${wishBtnHtml(p.id)}
        ${out ? `<span class="tag out-tag">স্টক শেষ</span>` : p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
        ${!out && off ? `<span class="off-badge">−${toBn(off)}%</span>` : ""}
        <span class="product-emoji" aria-hidden="true">${esc(p.emoji || "🛍️")}</span>
        ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : ""}
      </div>
      <div class="product-body">
        <h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <small>${esc(p.unit)}${!out && p.stock <= 5 ? ` · <b class="low">মাত্র ${toBn(p.stock)}টি বাকি</b>` : ""}</small>
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
    return `<button type="button" class="cat-tile" data-cat="${esc(c)}"><span class="ct-ico">${ico}</span><b>${esc(c)}</b><small>${toBn(items.length)}টি পণ্য</small></button>`;
  }).join("");
  $("catTilesTrack").innerHTML = `<div class="cat-tile-set">${tiles}</div>`;
  buildCategoryTicker();

  updateCategoryControls();
  renderHomeCatalog(cats);
}

function buildCategoryTicker() {
  const rail = $("catTiles");
  const track = $("catTilesTrack");
  const original = track.querySelector(".cat-tile-set:not(.cat-tile-copy)");
  if (!original || !original.children.length) return;
  const groupWidth = original.getBoundingClientRect().width;
  if (!groupWidth) return;
  const perHalf = Math.max(1, Math.ceil((rail.clientWidth + 24) / groupWidth));
  const groupCount = perHalf * 2;
  if (Number(track.dataset.groupCount) === groupCount) return;
  const template = original.innerHTML;
  track.innerHTML = "";
  for (let index = 0; index < groupCount; index++) {
    const group = document.createElement("div");
    group.className = "cat-tile-set";
    if (index >= perHalf) {
      group.classList.add("cat-tile-copy");
      group.setAttribute("aria-hidden", "true");
      group.inert = true;
    } else if (index > 0) {
      group.classList.add("cat-tile-repeat");
    }
    group.innerHTML = template;
    track.append(group);
  }
  track.dataset.groupCount = String(groupCount);
  track.style.animationDirection = "normal";
}

function updateCategoryControls() {
  const rail = $("catTiles");
  if (!rail) return;
  const track = $("catTilesTrack");
  buildCategoryTicker();
  const canScroll = track.scrollWidth / 2 > rail.clientWidth + 2;
  $("catScrollPrev").hidden = !canScroll;
  $("catScrollNext").hidden = !canScroll;
}

window.addEventListener("resize", updateCategoryControls);
if ("ResizeObserver" in window) new ResizeObserver(updateCategoryControls).observe($("catTiles"));

function renderHomeCatalog(categories) {
  const root = $("homeCatalog");
  if (!root || document.body.dataset.page !== "home") return;

  const products = state.products;
  const featuredItems = products.filter((p) => p.stock > 0).slice(0, 4);
  const featuredCards = featuredItems.map(featuredProductCard).join("");
  const featuredSection = featuredItems.length ? `
    <section class="home-product-section home-featured-section" aria-labelledby="homeFeaturedTitle">
      <div class="sec-row"><h2 class="sec-title" id="homeFeaturedTitle">টপ সেলিং পণ্য</h2><a class="sec-link home-more" href="shop.html">সব পণ্য দেখুন <span aria-hidden="true">→</span></a></div>
      <div class="home-product-viewport"><div class="home-product-track home-featured-track">
        <div class="home-featured-products">${featuredCards}</div>
      </div></div>
    </section>` : "";
  // 🔥 আজকের সেরা ডিল: টপ সেলিং এর ঠিক পরে (কম পণ্যে ডুপ্লিকেট দেখাবে না)
  const deals = products.filter((p) => p.stock > 0 && discountOf(p) > 0)
    .sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 8);
  const dealsSection = deals.length >= 3 && products.length >= 8 ? `
    <section class="home-product-section home-category-section home-deals-section" id="dealsSec" aria-labelledby="homeDealsTitle">
      <div class="sec-row"><h2 class="sec-title" id="homeDealsTitle">🔥 আজকের সেরা ডিল</h2><a href="shop.html?offer=1" class="sec-link">সব দেখুন →</a></div>
      <div class="home-slider" data-slider>
        <button type="button" class="hs-nav hs-prev" aria-label="আগের পণ্য" hidden><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <div class="products home-category-products" tabindex="-1">${deals.map((p) => productCard(p, true)).join("")}</div>
        <button type="button" class="hs-nav hs-next" aria-label="পরের পণ্য" hidden><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
      </div>
    </section>` : "";
  const bannerProducts = [
    products.find((product) => product.category === "তেল" && product.image),
    products.find((product) => product.category === "মধু" && product.image)
  ].filter(Boolean);
  const editorialBanner = bannerProducts.length ? `
    <section class="home-editorial-banner" aria-label="খাঁটিঘরের বিশেষ সংগ্রহ">
      <div class="home-editorial-copy"><span>বিশুদ্ধতার প্রতিশ্রুতি</span><h2>প্রতিদিনের রান্নায় খাঁটি স্বাদ</h2><p>বাছাই করা পণ্য, যত্নে প্যাক করা — পৌঁছে যাবে আপনার দরজায়।</p><a href="shop.html">আমাদের সংগ্রহ দেখুন <span aria-hidden="true">→</span></a></div>
      <div class="home-editorial-art">${bannerProducts.map((product) => `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`).join("")}</div>
    </section>` : "";
  const allVisible = homeVisible.all || 10; // ১০টি = ৫/২ কলামে পুরো সারি, ডানে ফাঁকা থাকে না
  const allItems = products.slice(0, allVisible);
  const allCards = allItems.map(productCard).join("");
  const allColumns = Math.min(allItems.length, 5);
  const allSection = `
    <section class="home-product-section" aria-labelledby="homeAllTitle">
      <div class="sec-row"><div><span class="eyebrow">🛍️ আমাদের সংগ্রহ</span><h2 class="sec-title" id="homeAllTitle">সব পণ্য</h2></div><a class="sec-link home-more" href="shop.html">সব পণ্য দেখুন →</a></div>
      ${products.length ? `<div class="home-product-viewport"><div class="home-product-track"><div class="products" style="--home-product-count:${allColumns}">${allCards}</div></div></div>${products.length > allVisible ? `<button type="button" class="home-load-more" data-home-more="all">আরও পণ্য দেখুন <span aria-hidden="true">＋</span></button>` : ""}` : `<p class="home-empty">এখনো কোনো পণ্য যোগ করা হয়নি।</p>`}
    </section>`;
  const categorySections = categories.map((category, index) => {
    const items = products.filter((p) => p.category === category);
    const sectionId = `home-category-${index}`;
    const key = "category:" + category;
    const categoryCards = items.map((product) => productCard(product, true)).join("");
    return `
      <section class="home-product-section home-category-section" aria-labelledby="${sectionId}">
        <div class="sec-row"><h2 class="sec-title" id="${sectionId}">${esc(category)} <small>(${toBn(items.length)}টি)</small></h2><a class="sec-link home-more" href="shop.html?cat=${encodeURIComponent(category)}">আরও দেখুন <span aria-hidden="true">→</span></a></div>
        <div class="home-slider" data-slider>
          <button type="button" class="hs-nav hs-prev" aria-label="আগের পণ্য" hidden><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
          <div class="products home-category-products" tabindex="-1">${categoryCards}</div>
          <button type="button" class="hs-nav hs-next" aria-label="পরের পণ্য" hidden><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        </div>
      </section>`;
  }).join("");

  root.innerHTML = featuredSection + dealsSection + editorialBanner + categorySections + allSection;
  setupHomeSliders();
}

/* ক্যাটাগরি সেকশনের পণ্য-সারি: প্রতি ৩ সেকেন্ডে ডান থেকে বামে সরে (একটি করে কার্ড), শেষে পৌঁছে আবার শুরুতে ফেরে।
   মাউস/টাচ/ফোকাস থাকলে থামে, ট্যাব লুকানো বা পর্দার বাইরে থাকলে চলে না, "reduce motion" চালু থাকলে নিজে নিজে চলে না। */
const SLIDE_MS = 3000;
const slideState = { timer: null, hold: new WeakMap() };
function sliderStep(el) {
  const first = el.querySelector(".product");
  if (!first) return 0;
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  return first.getBoundingClientRect().width + gap;
}
function sliderGo(el, dir) {
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 2) return;
  let left = el.scrollLeft + dir * sliderStep(el);
  if (dir > 0 && el.scrollLeft >= max - 2) left = 0;
  else if (dir < 0 && el.scrollLeft <= 2) left = max;
  el.scrollTo({ left, behavior: "smooth" });
}
function updateSliderNav() {
  document.querySelectorAll("[data-slider]").forEach((box) => {
    const el = box.querySelector(".home-category-products");
    const more = el.scrollWidth - el.clientWidth > 2;
    box.querySelectorAll(".hs-nav").forEach((b) => { b.hidden = !more; });
    box.classList.toggle("is-sliding", more);
  });
}
function setupHomeSliders() {
  updateSliderNav();
  if (slideState.timer) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  slideState.timer = setInterval(() => {
    if (document.hidden || reduce.matches) return;
    document.querySelectorAll("[data-slider] .home-category-products").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      if ((slideState.hold.get(el) || 0) > Date.now() || el.matches(":hover") || el.contains(document.activeElement)) return;
      sliderGo(el, 1);
    });
  }, SLIDE_MS);
}
document.addEventListener("click", (e) => {
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
    <span class="best-ribbon"><i class="fa-solid fa-fire" aria-hidden="true"></i>বেস্ট সেলিং</span>
    <a class="product-img" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${esc(p.name)} এর বিস্তারিত">
      <span class="product-emoji" aria-hidden="true">${esc(p.emoji || "🛍️")}</span>
      ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : ""}
    </a>
    <div class="product-body"><small>${esc(p.category || "")}</small><h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
      <div class="price">${money(p.price)} ${p.oldPrice > p.price ? `<del>${money(p.oldPrice)}</del>` : ""}</div>${p.oldPrice > p.price ? `<span class="save-pill">সাশ্রয় ${money(p.oldPrice - p.price)}</span>` : ""}
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
  Object.assign(state, { category: "সব", minPrice: "", maxPrice: "", inStock: false, offerOnly: false, topRated: false });
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
    location.href = "shop.html" + (category && category !== "সব" ? "?cat=" + encodeURIComponent(category) : "");
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
  if (k === "cat") state.category = "সব";
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
  if (can <= 0) { toast(`স্টকে মাত্র ${toBn(p.stock)}টি আছে`); return false; }
  if (line) line.qty += can; else state.cart.push({ id: p.id, qty: can });
  Pixel.track("AddToCart", { content_ids: [String(p.id)], content_name: p.name, content_type: "product", contents: [{ id: String(p.id), quantity: can }], value: p.price * can, currency: "BDT" });
  renderCart();
  if (can < qty) toast(`স্টকে মাত্র ${toBn(p.stock)}টি আছে`);
  else if (!silent) toast("✅ কার্টে যোগ হয়েছে");
  return true;
}

function changeQty(id, delta) {
  const line = state.cart.find((c) => String(c.id) === String(id));
  const p = findProduct(id);
  if (!line || !p) return;
  line.qty += delta;
  if (line.qty > p.stock) { line.qty = p.stock; toast(`স্টকে মাত্র ${toBn(p.stock)}টি আছে`); }
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
        <button type="button" data-dec="${esc(l.p.id)}" aria-label="কমান">−</button>
        <span>${toBn(l.qty)}</span>
        <button type="button" data-inc="${esc(l.p.id)}" aria-label="বাড়ান">+</button>
      </div>
      <div class="cart-line"><b>${money(l.p.price * l.qty)}</b><button type="button" class="cart-rm" data-rm="${esc(l.p.id)}" aria-label="${esc(l.p.name)} কার্ট থেকে সরান">সরান</button></div>
    </div>`;
}

function renderFreeDelivery(sub) {
  const free = Number(state.settings.freeDeliveryAbove) || 0;
  const html = !free || !sub ? ""
    : sub >= free
      ? `<div class="fd ok"><p>🎉 অভিনন্দন! আপনি <b>ফ্রি ডেলিভারি</b> পাচ্ছেন</p><i><u style="width:100%"></u></i></div>`
      : `<div class="fd"><p>আর <b>${money(free - sub)}</b> কিনলে <b>ফ্রি ডেলিভারি</b>!</p><i><u style="width:${Math.round(sub / free * 100)}%"></u></i></div>`;
  $("fdDrawer").innerHTML = html;
  $("fdCheckout").innerHTML = html;
}

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
  $("bnCount").hidden = !count;
  const save = lines.reduce((n, l) => n + Math.max(0, l.p.oldPrice - l.p.price) * l.qty, 0);
  $("saveDrawer").hidden = !save;
  $("saveDrawer").textContent = `🎉 আপনি সাশ্রয় করছেন ${money(save)}`;
  $("saveRow").hidden = !save;
  $("sumSave").textContent = money(save);
  renderFreeDelivery(sub);
  refreshCardActions();

  const empty = `<p class="empty">কার্ট খালি। পণ্য যোগ করুন 🛒</p>`;
  $("drawerBody").innerHTML = lines.length ? lines.map(cartRowHtml).join("") : empty;
  $("goCheckout").classList.toggle("disabled", !lines.length);

  form.hidden = !lines.length;
  $("checkoutEmpty").hidden = !!lines.length;
  $("checkoutItems").innerHTML = lines.length ? lines.map(cartRowHtml).join("") : empty;
  form.querySelectorAll("input, select, textarea, button").forEach((el) => {
    if (el.closest("#checkoutItems")) return;
    el.disabled = !lines.length;
  });

  if (state.coupon) { state.coupon = null; setCouponMsg("কার্ট বদলেছে — কুপন আবার প্রয়োগ করুন।", false); }
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
    toast("🗑️ কার্ট থেকে সরানো হয়েছে");
  }
});

/* --- পণ্য বিস্তারিত (কুইক ভিউ) --- */
const qv = $("qv");
let qvQty = 1;
let qvId = null;

function openView(id, push = true) {
  const p = findProduct(id);
  if (!p) return;
  qvQty = 1;
  qvId = p.id;
  const out = p.stock <= 0;
  const off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const related = state.products.filter((x) => x.category === p.category && x.id !== p.id && x.stock > 0).slice(0, 3);
  $("qvBody").innerHTML = `
    <button type="button" class="qv-close" data-qvclose aria-label="বন্ধ করুন">✕</button>
    <div class="qv-grid">
      <div class="qv-img">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : esc(p.emoji)}${off ? `<span class="tag">${toBn(off)}% ছাড়</span>` : ""}</div>
      <div class="qv-info">
        <small class="qv-cat">${esc(p.category || "")}</small>
        <h2>${esc(p.name)}</h2>
        ${p.reviews ? `<a href="#qvReviews" class="qv-rate" data-rvjump>${starsHtml(p.rating)} <small>${toBn(p.rating)} · ${toBn(p.reviews)}টি রিভিউ</small></a>` : ""}
        <p class="qv-unit">${esc(p.unit)}</p>
        <div class="price big">${money(p.price)} ${p.oldPrice > p.price ? `<del>${money(p.oldPrice)}</del>` : ""}</div>
        <p class="qv-stock ${out ? "out" : "in"}">${out ? "❌ স্টক শেষ" : p.stock <= 5 ? `⚠️ মাত্র ${toBn(p.stock)}টি বাকি` : "✅ স্টকে আছে"}</p>
        <p class="qv-desc">${esc(p.desc || "১০০% খাঁটি ও ফ্রেশ। সরাসরি উৎস থেকে সংগ্রহ করা, কোনো ভেজাল বা কেমিক্যাল নেই।")}</p>
        <ul class="qv-points"><li>✔ ভেজালমুক্ত</li><li>✔ ক্যাশ অন ডেলিভারি</li><li>✔ ৭ দিনের রিটার্ন</li></ul>
        ${out ? "" : `
        <div class="qv-qty"><span>পরিমাণ</span>
          <div class="mini-qty big"><button type="button" data-qvminus aria-label="কমান">−</button><span id="qvQty">১</span><button type="button" data-qvplus aria-label="বাড়ান">+</button></div>
        </div>`}
        <div class="qv-actions">
          <button type="button" class="btn btn-outline add-to-cart-btn" data-qvadd ${out ? "disabled" : ""}><svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>Add To Cart</button>
          <button type="button" class="btn" data-qvbuy ${out ? "disabled" : ""}>এখনই কিনুন</button>
        </div>
        <div class="qv-links"><button type="button" class="qv-fav${Wish.has(p.id) ? " on" : ""}" data-wish="${esc(p.id)}" aria-pressed="${Wish.has(p.id)}"><svg viewBox="0 0 24 24" aria-hidden="true">${HEART}</svg><span>${Wish.has(p.id) ? "পছন্দের তালিকায় আছে" : "পছন্দের তালিকায় রাখুন"}</span></button><button type="button" class="qv-share" data-qvshare>🔗 লিংক কপি করুন</button></div>
      </div>
    </div>
    ${connected() ? `<div class="qv-reviews" id="qvReviews"><h4>⭐ ক্রেতাদের রিভিউ</h4><div id="qvRvBody"><p class="loading">রিভিউ লোড হচ্ছে...</p></div></div>` : ""}
    ${related.length ? `<div class="qv-related"><h4>এগুলোও দেখতে পারেন</h4><div class="rel-grid">${related.map((r) => `
      <button type="button" class="rel" data-view="${esc(r.id)}"><span class="rel-img">${r.image ? `<img src="${esc(r.image)}" alt="">` : esc(r.emoji)}</span><b>${esc(r.name)}</b><small>${money(r.price)}</small></button>`).join("")}</div></div>` : ""}`;
  if (!qv.open) qv.showModal();
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
         <div class="rv-big"><b>${toBn(r.average)}</b>${starsHtml(r.average)}<small>${toBn(r.count)}টি রিভিউ</small></div>
         <div class="rv-bars">${[5, 4, 3, 2, 1].map((n) => {
           const c = r.distribution[n - 1];
           return `<div><span>${toBn(n)}★</span><i><u style="width:${Math.round(c / r.count * 100)}%"></u></i><em>${toBn(c)}</em></div>`;
         }).join("")}</div>
       </div>`
    : `<p class="rv-empty">এখনো কোনো রিভিউ নেই। প্রথম রিভিউটি আপনিই দিন!</p>`;
  const list = r.reviews.map((v) => `
    <div class="rv">
      <div class="rv-top"><b>${esc(v.name)}</b>${v.verified ? `<span class="rv-ver">✔ ভেরিফাইড ক্রেতা</span>` : ""}<span class="rv-date">${esc(v.date)}</span></div>
      ${starsHtml(v.rating)}${v.text ? `<p>${esc(v.text)}</p>` : ""}
    </div>`).join("");
  return head + (list ? `<div class="rv-list">${list}</div>` : "") +
    `<button type="button" class="btn btn-outline btn-small" data-rvopen>✍️ রিভিউ লিখুন</button><div id="rvFormWrap"></div>`;
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
    show(`<p class="rv-empty">রিভিউ লোড করা যায়নি।</p>`);
  }
}

function reviewFormHtml() {
  qvRating = 0;
  return `
    <form id="rvForm" class="rv-form" novalidate>
      <p class="rv-hint">শুধু ডেলিভারি পাওয়া ক্রেতারা রিভিউ দিতে পারবেন — অর্ডার আইডি ও মোবাইল নম্বর দিন।</p>
      <div class="rv-row"><input name="orderId" placeholder="অর্ডার আইডি" autocomplete="off"><input name="phone" type="tel" maxlength="11" inputmode="numeric" placeholder="মোবাইল নম্বর"></div>
      <div class="star-pick" id="starPick" role="radiogroup" aria-label="রেটিং">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${toBn(n)} স্টার">★</button>`).join("")}</div>
      <textarea name="text" rows="3" maxlength="500" placeholder="পণ্য সম্পর্কে আপনার অভিজ্ঞতা লিখুন (ঐচ্ছিক)"></textarea>
      <button class="btn btn-small" type="submit">রিভিউ জমা দিন</button>
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
  if (!orderId) return say("অর্ডার আইডি দিন।");
  if (!/^01[3-9]\d{8}$/.test(phone)) return say("সঠিক মোবাইল নম্বর দিন।");
  if (!qvRating) return say("স্টার চেপে রেটিং দিন।");
  const btn = f.querySelector("[type=submit]");
  btn.disabled = true;
  try {
    const r = await api({ action: "review", productId: qvId, orderId, phone, rating: qvRating, text: f.text.value.trim() });
    if (!r.ok) return say(r.error || "রিভিউ জমা হয়নি।");
    $("rvFormWrap").innerHTML = `<p class="form-msg ok">✅ ধন্যবাদ! আপনার রিভিউ জমা হয়েছে, অনুমোদনের পর প্রকাশিত হবে।</p>`;
  } catch (err) {
    say("সমস্যা হয়েছে, আবার চেষ্টা করুন।");
  } finally {
    btn.disabled = false;
  }
});

function closeView() { if (qv.open) qv.close(); }
qv.addEventListener("close", () => {
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
  if (t.closest("[data-qvplus]") || t.closest("[data-qvminus]")) {
    const next = qvQty + (t.closest("[data-qvplus]") ? 1 : -1);
    if (next > p.stock) toast(`স্টকে মাত্র ${toBn(p.stock)}টি আছে`);
    else if (next >= 1) { qvQty = next; $("qvQty").textContent = toBn(qvQty); }
    return;
  }
  if (t.closest("[data-qvadd]") && addToCart(p.id, false, qvQty)) closeView();
  if (t.closest("[data-qvbuy]") && addToCart(p.id, true, qvQty)) { closeView(); location.href = "checkout.html"; }
  if (t.closest("[data-qvshare]")) {
    const url = location.href.split("#")[0] + "#product-" + p.id;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("🔗 লিংক কপি হয়েছে"), () => toast(url));
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
    toast(added ? "❤️ পছন্দের তালিকায় যোগ হয়েছে" : "পছন্দের তালিকা থেকে সরানো হয়েছে");
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
      if (b.classList.contains("wish-btn")) b.setAttribute("aria-label", on ? "পছন্দের তালিকা থেকে সরান" : "পছন্দের তালিকায় রাখুন");
      const lbl = b.querySelector("span");
      if (lbl) lbl.textContent = on ? "পছন্দের তালিকায় আছে" : "পছন্দের তালিকায় রাখুন";
    });
    const n = this.ids.length;
    [["wishCount", n], ["bnWishCount", n]].forEach(([id, v]) => { $(id).textContent = toBn(v); $(id).hidden = !v; });
    $("wishOpen").classList.toggle("has", n > 0);
    if (openPanel === "wishDrawer") renderWish();
  }
};
Wish.load();
const wishBtnHtml = (id) => `<button type="button" class="wish-btn${Wish.has(id) ? " on" : ""}" data-wish="${esc(id)}" aria-pressed="${Wish.has(id)}" aria-label="${Wish.has(id) ? "পছন্দের তালিকা থেকে সরান" : "পছন্দের তালিকায় রাখুন"}"><svg viewBox="0 0 24 24" aria-hidden="true">${HEART}</svg></button>`;

function renderWish() {
  const list = Wish.ids.map(findProduct).filter(Boolean);
  $("wishBody").innerHTML = list.length ? list.map((p) => {
    const out = p.stock <= 0, id = esc(p.id);
    const img = p.image ? `<img src="${esc(p.image)}" alt="">` : esc(p.emoji);
    return `<div class="cart-row wish-row">
      <div class="cart-thumb">${img}</div>
      <div class="cart-info"><b>${esc(p.name)}</b><small>${esc(p.unit)} · ${money(p.price)}${p.oldPrice > p.price ? ` <del>${money(p.oldPrice)}</del>` : ""}</small>${out ? `<div class="w-out">স্টক শেষ</div>` : ""}</div>
      <div class="w-act"><button type="button" class="btn btn-small btn-outline add-to-cart-btn" data-wish-add="${id}" ${out ? "disabled" : ""}><svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>Add To Cart</button><button type="button" class="w-x" data-wish="${id}" aria-label="${esc(p.name)} তালিকা থেকে সরান">✕ সরান</button></div>
    </div>`;
  }).join("") : `<p class="empty">আপনার পছন্দের তালিকা খালি।<br>পণ্যের ছবির ডান-নিচের ❤️ চাপুন।</p>`;
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
  toast(added ? `✅ ${toBn(added)}টি পণ্য কার্টে যোগ হয়েছে` : "কার্টে যোগ করার মতো পণ্য নেই");
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
  const track = $("catTilesTrack");
  track.style.animationDirection = direction < 0 ? "reverse" : "normal";
  clearTimeout(scrollCategoryRail.timer);
  scrollCategoryRail.timer = setTimeout(() => { track.style.animationDirection = "normal"; }, 5000);
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
  $("sumDelivery").textContent = t.delivery === 0 && t.sub > 0 ? "ফ্রি" : money(t.delivery);
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
  if (!code) return setCouponMsg("কুপন কোড লিখুন।", false);
  if (!connected()) return setCouponMsg("শিট সংযোগ করার পর কুপন কাজ করবে।", false);
  const btn = $("couponBtn");
  btn.disabled = true;
  try {
    const r = await api({ action: "coupon", code, subtotal: totals().sub });
    if (r.ok) {
      state.coupon = { code: r.code, discount: r.discount };
      setCouponMsg(`🎉 ${r.code} প্রয়োগ হয়েছে — ${money(r.discount)} ছাড়!`, true);
    } else {
      state.coupon = null;
      setCouponMsg(r.error, false);
    }
  } catch (e) {
    setCouponMsg("কুপন যাচাই করা যায়নি, আবার চেষ্টা করুন।", false);
  }
  btn.disabled = false;
  updateSummary();
});

/* --- পেমেন্ট পদ্ধতি --- */
function renderPayHelp() {
  const m = form.payMethod.value;
  $("payInfo").hidden = m === "cod";
  if (m !== "cod") {
    $("payHelp").innerHTML = `${m === "bkash" ? "বিকাশ" : "নগদ"} <b>Send Money</b> করুন: <b>${esc(toBn(state.settings[m]))}</b> নম্বরে <b>${money(totals().total)}</b>, তারপর নিচে TrxID দিন।`;
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

  if (!state.cart.length) return fail("কার্ট খালি। আগে পণ্য যোগ করুন।");
  if (name.length < 3) return fail("সঠিক নাম লিখুন।", form.name);
  if (!/^01[3-9]\d{8}$/.test(phone)) return fail("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন 01712345678)।", form.phone);
  if (address.length < 10) return fail("সম্পূর্ণ ঠিকানা লিখুন।", form.address);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("সঠিক ইমেইল দিন অথবা ঘরটি ফাঁকা রাখুন।", form.email);
  if (payMethod !== "cod" && trxId.length < 6) return fail("পেমেন্টের ট্রানজেকশন আইডি (TrxID) দিন।", form.trxId);
  if (!connected()) return fail("এখনো Google Sheet সংযোগ করা হয়নি। গাইডের ধাপ ৩ দেখুন।");

  btn.disabled = true;
  btn.textContent = "অর্ডার পাঠানো হচ্ছে...";

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
    if (!r.ok) throw new Error(r.error || "অর্ডার হয়নি");

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
    fail(err.message && err.message !== "Failed to fetch" ? err.message : "সমস্যা হয়েছে। ইন্টারনেট দেখে আবার চেষ্টা করুন বা কল করুন।");
    updateSummary();
  } finally {
    btn.disabled = !state.cart.length;
    btn.textContent = "✅ অর্ডার কনফার্ম করুন";
  }
});

function showSuccess(r, name, phone, email) {
  const s = $("success");
  const text = `আমার অর্ডার আইডি ${r.orderId}, নাম ${name}। মোট ${money(r.total)}।`;
  s.hidden = false;
  s.innerHTML = `
    <div class="tick">✅</div>
    <h3>ধন্যবাদ, ${esc(name)}! আপনার অর্ডার গ্রহণ করা হয়েছে</h3>
    <p>অর্ডার আইডি: <b class="oid">${esc(r.orderId)}</b></p>
    <p>সর্বমোট: <b>${money(r.total)}</b> — শীঘ্রই আমরা কল করে কনফার্ম করব।</p>
    ${email ? `<p class="small">📧 কনফার্মেশন ইমেইল পাঠানো হয়েছে: ${esc(email)}</p>` : ""}
    <p class="small">এই আইডি ও আপনার মোবাইল নম্বর দিয়ে যেকোনো সময় অর্ডার ট্র্যাক করতে পারবেন।</p>
    <div class="hero-buttons" style="justify-content:center">
      <a class="btn btn-small" target="_blank" rel="noopener" href="https://wa.me/${esc(state.settings.whatsapp)}?text=${encodeURIComponent(text)}">💬 হোয়াটসঅ্যাপে জানান</a>
      <a class="btn btn-small btn-outline" href="track.html?id=${encodeURIComponent(r.orderId)}&phone=${encodeURIComponent(phone)}">📦 ট্র্যাক করুন</a>
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
  if (!connected()) { out.innerHTML = `<p class="form-msg err">শিট সংযোগ করার পর ট্র্যাকিং কাজ করবে।</p>`; return; }
  out.innerHTML = `<p class="loading">খোঁজা হচ্ছে...</p>`;
  try {
    const url = `${CONFIG.API_URL}?action=track&id=${encodeURIComponent(trackForm.oid.value.trim())}&phone=${encodeURIComponent(toEn(trackForm.phone.value.trim()))}`;
    const r = await (await fetch(url)).json();
    if (!r.ok) { out.innerHTML = `<p class="form-msg err">⚠️ ${esc(r.error)}</p>`; return; }
    const steps = ["নতুন", "কনফার্মড", "শিপড", "ডেলিভারড"];
    const o = r.order;
    const cancelled = o.status === "বাতিল";
    const at = steps.indexOf(o.status);
    out.innerHTML = `
      <div class="track-card">
        <p><b>${esc(o.orderId)}</b> · ${esc(o.date)}</p>
        <p>${esc(o.items)}</p>
        <p>সর্বমোট: <b>${money(o.total)}</b></p>
        ${cancelled ? `<p class="form-msg err">❌ এই অর্ডারটি বাতিল করা হয়েছে।</p>` : `
        <ol class="steps">${steps.map((s, i) => `<li class="${i <= at ? "done" : ""}">${s}</li>`).join("")}</ol>`}
        ${o.status === "ডেলিভারড" ? `<p class="form-msg ok">⭐ পণ্য কেমন লাগল? <a href="#products" style="text-decoration:underline">পণ্য খুলে রিভিউ দিন</a></p>` : ""}
      </div>`;
  } catch (err) {
    out.innerHTML = `<p class="form-msg err">⚠️ সমস্যা হয়েছে, আবার চেষ্টা করুন।</p>`;
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
  { badge: "🚚 সারাদেশে ক্যাশ অন ডেলিভারি", title: "১০০% খাঁটি তেল, মশলা, বাদাম ও মধু সরাসরি আপনার ঘরে", subtitle: "ভেজালমুক্ত, ফ্রেশ ও বিশ্বস্ত মানের গ্রোসারি পণ্য। পণ্য হাতে পেয়ে দেখে টাকা দিন।", btnText: "এখনই কিনুন", link: "shop.html", theme: "green" },
  { badge: "🍯 সিজন স্পেশাল", title: "সুন্দরবনের খাঁটি মধু — এখন বিশেষ ছাড়ে", subtitle: "প্রাকৃতিক, চিনি-মুক্ত ও ভেজালমুক্ত। প্রতিটি বোতলে আসল স্বাদের নিশ্চয়তা।", btnText: "মধু দেখুন", link: "shop.html", theme: "gold" },
  { badge: "🎁 ফ্রি ডেলিভারি অফার", title: "বেশি কিনুন, ডেলিভারি চার্জ বাঁচান", subtitle: "নির্দিষ্ট টাকার অর্ডারে ফ্রি ডেলিভারি, সাথে ৭ দিনের সহজ রিটার্ন ও ক্যাশ অন ডেলিভারি।", btnText: "শপিং শুরু করুন", link: "shop.html", theme: "teal" }
];

function slideHtml(sl, i) {
  const theme = THEME_ART[sl.theme] ? sl.theme : "green";
  if (sl.imgDesktop) {
    const safe = safeHref(sl.link);
    const link = safe ? ` href="${esc(safe)}"` : "";
    const tag = safe ? "a" : "div";
    const cap = sl.title || sl.subtitle;
    return `<${tag} class="slide has-img t-${theme}${cap ? " cap" : ""}"${link}>
      <picture>${sl.imgMobile ? `<source media="(max-width:560px)" srcset="${esc(sl.imgMobile)}">` : ""}<img src="${esc(sl.imgDesktop)}" alt="${esc(sl.title || sl.badge || "অফার ব্যানার")}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" draggable="false"></picture>
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
    this.dots.innerHTML = this.slides.map((_, n) => `<button type="button" data-sl="${n}" aria-label="ব্যানার ${toBn(n + 1)}"></button>`).join("");
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
    b.setAttribute("aria-label", t === "dark" ? "লাইট মোড চালু করুন" : "ডার্ক মোড চালু করুন");
    $("themeIco").textContent = t === "dark" ? "☀️" : "🌙";
  },
  init() {
    this.apply(this.cur());
    $("themeBtn").addEventListener("click", () => {
      const t = this.cur() === "dark" ? "light" : "dark";
      this.apply(t);
      try { localStorage.setItem("theme", t); } catch (e) { /* ব্লকড */ }
      toast(t === "dark" ? "🌙 ডার্ক মোড চালু" : "☀️ লাইট মোড চালু");
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
      { "@type": "Store", "name": "খাঁটিঘর", "url": base, "telephone": "+88" + String(state.settings.phone || "").replace(/\D/g, ""), "priceRange": "৳৳", ...(Object.values(socialLinks()).some(Boolean) ? { "sameAs": Object.values(socialLinks()).filter(Boolean) } : {}), ...(state.settings.email ? { "email": state.settings.email } : {}), ...(state.settings.address ? { "address": state.settings.address } : {}), "description": "১০০% খাঁটি তেল, মশলা, বাদাম ও মধু — সারাদেশে ক্যাশ অন ডেলিভারি" },
      ...state.products.slice(0, 50).map((p) => ({
        "@type": "Product", "name": p.name, "description": p.desc || p.name, "category": p.category || undefined,
        "image": p.image ? abs(p.image) : undefined,
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
