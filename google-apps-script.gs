/**
 * খাঁটিঘর ই-কমার্স ব্যাকএন্ড (Google Apps Script)
 * কীভাবে বসাবেন: README-বাংলা-গাইড.md দেখুন
 *
 * শিট: Products, Orders, Coupons, Reviews, Settings (setup() চালালে নিজে তৈরি হবে)
 * অ্যাডমিন পাসওয়ার্ড: Project Settings > Script Properties > ADMIN_PASSWORD
 * নোটিফিকেশন (ইমেইল/SMS) সেটিং: অ্যাডমিন প্যানেল > সেটিংস > নোটিফিকেশন
 */

const PRODUCT_COLS = ["id", "name", "unit", "category", "price", "oldPrice", "emoji", "image", "tag", "stock", "active", "desc", "images"];
const ORDER_COLS = ["orderId", "date", "name", "phone", "address", "area", "items", "itemsJson", "subtotal", "delivery", "discount", "coupon", "total", "payMethod", "trxId", "note", "status", "email", "courier", "consignmentId", "trackingCode", "courierStatus", "courierUpdated"];
const COUPON_COLS = ["code", "type", "value", "minOrder", "active", "expires"]; // expires = last valid day, "yyyy-MM-dd" (empty = never expires)
const REVIEW_COLS = ["reviewId", "productId", "orderId", "name", "rating", "text", "date", "status", "verified", "role", "avatar", "featured"];
const CATEGORY_COLS = ["name", "emoji"];
const SLIDE_COLS = ["slideId", "badge", "title", "subtitle", "btnText", "link", "imgDesktop", "imgMobile", "theme", "active"];
const CAMPAIGN_COLS = ["campaignId", "date", "name", "audience", "channel", "recipients", "sent", "failed", "status", "message", "coupon"];
const CAMPAIGN_BATCH = 20; // messages sent per request (keeps each call well inside Apps Script limits)
const MAX_SLIDES = 5;
const DEFAULT_SLIDE_ROWS = [
  ["S1", "🚚 Cash on delivery nationwide", "100% pure oil, spices, nuts & honey, straight to your home", "Adulteration-free, fresh and trusted-quality grocery products. Pay after you receive.", "Buy now", "#products", "", "", "green", true],
  ["S2", "🍯 Seasonal Special", "Pure Sundarban honey — now at a special price", "Natural, sugar-free and adulteration-free. Authentic taste in every bottle.", "Shop honey", "#products", "", "", "gold", true],
  ["S3", "🎁 Free Delivery Offer", "Buy more, save on delivery", "Free delivery on orders above a set amount, plus easy 7-day returns and cash on delivery.", "Start shopping", "#products", "", "", "teal", true]
];
const STATUSES = ["নতুন", "কনফার্মড", "শিপড", "ডেলিভারড", "বাতিল"];
const REVIEW_STATUSES = ["pending", "approved", "rejected"];
const SHOP_NAME = "KhatiGhor";
const DEFAULT_SETTINGS = {
  deliveryInside: "70",
  deliveryOutside: "120",
  freeDeliveryAbove: "0",
  whatsapp: "8801852677251",
  phone: "01852677251",
  bkash: "01852677251",
  nagad: "01852677251",
  notice: "",
  metaPixelId: "",
  email: "",
  address: "",
  hours: "Every day 9 AM – 10 PM",
  facebook: "",
  linkedin: "",
  tiktok: "",
  offerEndsAt: "",   // যেমন 2026-11-30T23:59 — ফাঁকা বা পেরিয়ে গেলে কাউন্টডাউন ব্যান্ড লুকানো থাকে
  offerText: "",
  promoCoupon: "",   // হিরোর পাশে দেখানোর কুপন কোড (Coupons ট্যাবে থাকা কোড)
  brands: "",        // "Our Brands" section on the home page: JSON list [{name, logo, link}] (max 12), managed in Admin > Brands
  footerCats: ""     // ফুটারের "কেনাকাটা" অংশে দেখানোর ক্যাটাগরি (সর্বোচ্চ ৫টি, "|" দিয়ে আলাদা); ফাঁকা = প্রথম ৫টি
};
const DEFAULT_NOTIFY = {
  adminEmail: "",       // ফাঁকা থাকলে স্ক্রিপ্টের মালিকের ইমেইলে যাবে
  adminPhone: "",
  smsUrl: "",           // SMS গেটওয়ের URL টেমপ্লেট, README দেখুন
  smsKey: "",
  smsSender: "",
  emailAdmin: true,     // নতুন অর্ডারে আমাকে ইমেইল
  emailCustomer: true,  // ক্রেতাকে ইমেইল (ক্রেতা ইমেইল দিলে)
  smsAdmin: false,      // নতুন অর্ডারে আমাকে SMS
  smsCustomer: false,   // ক্রেতাকে SMS
  statusNotify: true    // স্ট্যাটাস বদলালে ক্রেতাকে জানানো
};

/* ---------- প্রথমবার একবার চালান (পরে আপডেটেও আবার চালানো নিরাপদ) ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [["Products", PRODUCT_COLS], ["Orders", ORDER_COLS], ["Coupons", COUPON_COLS], ["Reviews", REVIEW_COLS], ["Slides", SLIDE_COLS], ["Categories", CATEGORY_COLS], ["Campaigns", CAMPAIGN_COLS]].forEach((x) => {
    const sh = sheetOf(ss, x[0], x[1]);
    // পুরনো শিটে নতুন কলাম থাকলে হেডার হালনাগাদ (ডেটা মুছে না)
    sh.getRange(1, 1, 1, x[1].length).setValues([x[1]]).setFontWeight("bold").setBackground("#e9f6ee");
  });
  const st = sheetOf(ss, "Settings", ["key", "value"]);
  const have = st.getLastRow() > 1 ? st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().map((r) => r[0]) : [];
  Object.keys(DEFAULT_SETTINGS).forEach((k) => { if (have.indexOf(k) < 0) st.appendRow([k, DEFAULT_SETTINGS[k]]); });

  const pr = ss.getSheetByName("Products");
  if (pr.getLastRow() < 2) {
    [
      [1, "Pure Mustard Oil", "1 litre", "Oil", 320, 380, "🫒", "", "Best Seller", 50, true, "100% pure cold-pressed mustard oil."],
      [2, "Sundarban Pure Honey", "500 g", "Honey", 650, 780, "🍯", "", "20% Off", 30, true, "Natural honey from seasonal Sundarban flowers."],
      [3, "Cashew Nuts (Premium)", "500 g", "Nuts", 780, 900, "🥜", "", "", 40, true, "Large, fresh cashew nuts."],
      [4, "Turmeric Powder", "500 g", "Spices", 240, 280, "🟡", "", "", 60, true, "Pure turmeric powder, no artificial colour."],
      [5, "Chilli Powder", "500 g", "Spices", 290, 340, "🌶️", "", "New", 60, true, "Hot and aromatic chilli powder."],
      [6, "Pure Ghee (Desi)", "500 g", "Ghee", 890, 1050, "🧈", "", "", 20, true, "Pure ghee made from desi cow-milk butter."]
    ].forEach((r) => pr.appendRow(r));
  }
  // ক্যাটাগরি তালিকা খালি থাকলে বিদ্যমান পণ্যের ক্যাটাগরি থেকে একবার তৈরি (পুরনো ডেটা বজায় থাকে)
  const ct = ss.getSheetByName("Categories");
  if (ct.getLastRow() < 2) {
    const seen = {};
    readTable(pr, PRODUCT_COLS).forEach((p) => {
      const n = String(p.category || "").trim();
      if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; ct.appendRow([n, ""]); }
    });
  }
  const sl = ss.getSheetByName("Slides");
  if (sl.getLastRow() < 2) DEFAULT_SLIDE_ROWS.forEach((r) => sl.appendRow(r));
  const cp = ss.getSheetByName("Coupons");
  if (cp.getLastRow() < 2) cp.appendRow(["WELCOME10", "percent", 10, 500, true]);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_PASSWORD")) props.setProperty("ADMIN_PASSWORD", "changeme123");
  if (!props.getProperty("NOTIFY")) props.setProperty("NOTIFY", JSON.stringify(DEFAULT_NOTIFY));
}


/* ---------- Speed: public responses are cached for a short time ----------
   Every page view used to read 7+ sheets. Now the finished JSON is kept in CacheService (chunked, because one
   entry is limited to ~100 KB). Any admin change bumps a version number, so edits show up immediately. */
const PUBLIC_CACHE_SECONDS = 60;
const CACHE_CHUNK = 90000;
function pubVersion() { return PropertiesService.getScriptProperties().getProperty("PUBV") || "0"; }
function bustPublicCache() { PropertiesService.getScriptProperties().setProperty("PUBV", String(Date.now())); }
function cachedJson(name, build, seconds) {
  const cache = CacheService.getScriptCache(), key = "pub" + pubVersion() + ":" + name;
  try {
    const head = cache.get(key);
    if (head) {
      const n = Number(head);
      const parts = []; for (let i = 0; i < n; i++) parts.push("c" + i);
      const got = cache.getAll(parts.map((p) => key + ":" + p));
      const text = parts.map((p) => got[key + ":" + p]).join("");
      if (parts.every((p) => got[key + ":" + p] != null)) return JSON.parse(text);
    }
  } catch (e) { /* fall through and rebuild */ }
  const out = build();
  try {
    const text = JSON.stringify(out), n = Math.max(1, Math.ceil(text.length / CACHE_CHUNK)), put = {};
    for (let i = 0; i < n; i++) put[key + ":c" + i] = text.slice(i * CACHE_CHUNK, (i + 1) * CACHE_CHUNK);
    put[key] = String(n);
    cache.putAll(put, seconds || PUBLIC_CACHE_SECONDS);
  } catch (e) { /* too large or cache unavailable: just skip caching */ }
  return out;
}

/* Soft rate limits (CacheService counters) — protect public endpoints from guessing / spam */
function hitLimit(name, max, seconds) {
  const cache = CacheService.getScriptCache(), k = "rl:" + name, n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), seconds);
  return n > max;
}

/* ---------- Public GET ---------- */
function doGet(e) {
  const a = (e && e.parameter && e.parameter.action) || "";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (a === "products") {
      return json(cachedJson("products", () => {
        const ratings = ratingMap(ss);
        const products = readTable(ss.getSheetByName("Products"), PRODUCT_COLS)
          .filter((p) => isTrue(p.active))
          .map((p) => publicProduct(p, ratings[String(p.id)]));
        const slides = readTable(ss.getSheetByName("Slides"), SLIDE_COLS)
          .filter((x) => isTrue(x.active)).slice(0, MAX_SLIDES).map(publicSlide);
        return { ok: true, products: products, settings: publicSettings(ss), slides: slides, featured: featuredReviews(ss), categories: publicCategories(ss) };
      }));
    }
    if (a === "reviews") { const pid = String(e.parameter.productId || "").slice(0, 20); return json(cachedJson("reviews:" + pid, () => listReviews(ss, pid), 120)); }
    if (a === "track") return json(trackOrder(e.parameter.id, e.parameter.phone));
    return ContentService.createTextOutput("KhatiGhor server is running ✅");
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------- POST ---------- */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === "order") {
      const r = placeOrder(data);
      if (r.ok) {
        const o = r._order;
        delete r._order;
        safe(() => notifyNewOrder(o)); // লক ছেড়ে দেওয়ার পরে, ব্যর্থ হলেও অর্ডার ঠিক থাকবে
      }
      return json(r);
    }
    if (data.action === "coupon") return json(hitLimit("coupon", 40, 60) ? { ok: false, error: "Too many attempts. Please wait a minute." } : checkCoupon(data.code, Number(data.subtotal) || 0));
    if (data.action === "review") return json(submitReview(data));
    if (data.action === "admin") return json(adminAction(data));
    return json({ ok: false, error: "Unknown request" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------- অর্ডার নেওয়া (দাম সবসময় সার্ভারে হিসাব হয়) ---------- */
function placeOrder(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const name = str(d.name, 80), phone = String(d.phone || "").replace(/\D/g, "");
    const address = str(d.address, 300);
    const email = str(d.email, 80).toLowerCase();
    if (name.length < 3) return { ok: false, error: "Please enter a valid name" };
    if (!/^01[3-9]\d{8}$/.test(phone)) return { ok: false, error: "Please enter a valid mobile number" };
    if (address.length < 10) return { ok: false, error: "Please enter your full address" };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email or leave the field empty" };
    if (!Array.isArray(d.items) || !d.items.length || d.items.length > 30) return { ok: false, error: "Your cart is empty" };

    // সাম্প্রতিক অর্ডার ডুপ্লিকেট আটকানো (একই ফোন ৩০ সেকেন্ডে)
    const orders = ss.getSheetByName("Orders");
    const cache = CacheService.getScriptCache();
    if (cache.get("o" + phone)) return { ok: false, error: "Please wait a moment and try again" };

    const pSheet = ss.getSheetByName("Products");
    const products = readTable(pSheet, PRODUCT_COLS);
    let subtotal = 0;
    const lines = [], stockChanges = [];
    for (const it of d.items) {
      const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
      const idx = products.findIndex((p) => String(p.id) === String(it.id) && isTrue(p.active));
      if (idx < 0) return { ok: false, error: "One of the products is no longer available" };
      const p = products[idx];
      if (Number(p.stock) < qty) return { ok: false, error: "Only " + p.stock + " of " + p.name + " in stock" };
      subtotal += Number(p.price) * qty;
      lines.push({ id: p.id, name: p.name, unit: p.unit, price: Number(p.price), qty: qty });
      stockChanges.push({ row: idx + 2, stock: Number(p.stock) - qty });
    }

    const s = getSettings(ss);
    const area = d.area === "outside" ? "outside" : "inside";
    let delivery = Number(area === "inside" ? s.deliveryInside : s.deliveryOutside) || 0;
    const free = Number(s.freeDeliveryAbove) || 0;
    if (free > 0 && subtotal >= free) delivery = 0;

    let discount = 0, couponCode = "";
    if (d.coupon) {
      const c = checkCoupon(d.coupon, subtotal);
      if (!c.ok) return c;
      discount = c.discount; couponCode = c.code;
    }

    const payMethod = ["cod", "bkash", "nagad"].indexOf(d.payMethod) >= 0 ? d.payMethod : "cod";
    const trxId = str(d.trxId, 40);
    if (payMethod !== "cod" && trxId.length < 6) return { ok: false, error: "Please enter the payment transaction ID" };

    const total = subtotal + delivery - discount;
    const orderId = "KG" + Utilities.formatDate(new Date(), "Asia/Dhaka", "yyMMdd") + "-" + (orders.getLastRow() + 100);
    const itemsText = lines.map((l) => l.name + " (" + l.unit + ") x" + l.qty).join(", ");
    const areaText = area === "inside" ? "Inside Dhaka" : "Outside Dhaka";
    const note = str(d.note, 300);
    orders.appendRow([
      orderId,
      "'" + Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy hh:mm a"),
      clean(name), "'" + phone, clean(address), areaText,
      itemsText, JSON.stringify(lines),
      subtotal, delivery, discount, couponCode, total,
      payMethod, clean(trxId), clean(note), "নতুন", email
    ]);
    stockChanges.forEach((c) => pSheet.getRange(c.row, PRODUCT_COLS.indexOf("stock") + 1).setValue(c.stock));
    cache.put("o" + phone, "1", 30);

    return {
      ok: true, orderId: orderId, total: total, subtotal: subtotal, delivery: delivery, discount: discount,
      _order: { orderId: orderId, name: name, phone: phone, email: email, address: address, area: areaText, items: itemsText,
        lines: lines, subtotal: subtotal, delivery: delivery, discount: discount, total: total, payMethod: payMethod, trxId: trxId, note: note }
    };
  } finally {
    lock.releaseLock();
  }
}

// Coupon expiry: valid through the END of the "expires" day (Dhaka time). Empty = no expiry.
function couponExpiry(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, "Asia/Dhaka", "yyyy-MM-dd");
  const s = String(v || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}
function couponExpired(c) {
  const exp = couponExpiry(c && c.expires);
  return !!exp && Utilities.formatDate(new Date(), "Asia/Dhaka", "yyyy-MM-dd") > exp;
}

function checkCoupon(code, subtotal) {
  code = String(code || "").trim().toUpperCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const c = readTable(ss.getSheetByName("Coupons"), COUPON_COLS)
    .find((x) => String(x.code).toUpperCase() === code && isTrue(x.active));
  if (!c) return { ok: false, error: "This coupon code is not valid" };
  if (couponExpired(c)) return { ok: false, error: "This coupon has expired" };
  if (subtotal < Number(c.minOrder || 0)) return { ok: false, error: "Minimum order for this coupon is ৳" + c.minOrder };
  let discount = c.type === "percent" ? Math.round(subtotal * Number(c.value) / 100) : Number(c.value);
  discount = Math.min(discount, subtotal);
  return { ok: true, code: code, discount: discount };
}

/* ---------- অর্ডার ট্র্যাকিং (অর্ডার আইডি + ফোন মিললে তবেই) ---------- */
function trackOrder(id, phone) {
  id = String(id || "").trim().toUpperCase();
  phone = String(phone || "").replace(/\D/g, "");
  const o = readTable(SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders"), ORDER_COLS)
    .find((x) => String(x.orderId).toUpperCase() === id && String(x.phone).replace(/\D/g, "") === phone);
  if (!o) return { ok: false, error: "Order not found. Please check the order ID and mobile number." };
  const hasCourier = !!(o.consignmentId && COURIERS[o.courier]);
  return { ok: true, order: { orderId: o.orderId, date: o.date, items: o.items, total: o.total, status: o.status, payMethod: o.payMethod,
    courier: hasCourier ? COURIERS[o.courier].name : "", trackingCode: hasCourier ? String(o.trackingCode || "") : "", trackingUrl: hasCourier ? courierTrackUrl(o) : "",
    courierStatus: hasCourier ? courierLabel(o.courier, o.courierStatus) : "" } };
}

/* =====================================================
   রিভিউ ও রেটিং (শুধু ডেলিভারড অর্ডারের ক্রেতা দিতে পারবেন, অ্যাডমিন অনুমোদনের পর দেখাবে)
   ===================================================== */
function ratingMap(ss) {
  const map = {};
  readTable(ss.getSheetByName("Reviews"), REVIEW_COLS).forEach((r) => {
    if (r.status !== "approved") return;
    const k = String(r.productId);
    map[k] = map[k] || { sum: 0, count: 0 };
    map[k].sum += Number(r.rating) || 0;
    map[k].count++;
  });
  return map;
}

// Home page "Customer reviews": reviews the admin marked "Show on homepage" (approved only);
// if none are marked, falls back to the latest approved 4★+ reviews that have text. Max 9.
function featuredReviews(ss) {
  const names = {};
  readTable(ss.getSheetByName("Products"), PRODUCT_COLS).forEach((p) => { names[String(p.id)] = p.name; });
  const approved = readTable(ss.getSheetByName("Reviews"), REVIEW_COLS).filter((r) => r.status === "approved");
  let picked = approved.filter((r) => isTrue(r.featured));
  if (!picked.length) picked = approved.filter((r) => Number(r.rating) >= 4 && String(r.text).trim().length >= 15);
  return picked.reverse().slice(0, 9)
    .map((r) => ({ name: r.name, rating: Number(r.rating), text: r.text, verified: isTrue(r.verified), role: r.role || "", avatar: r.avatar || "", product: names[String(r.productId)] || "" }));
}

function listReviews(ss, productId) {
  const rows = readTable(ss.getSheetByName("Reviews"), REVIEW_COLS)
    .filter((r) => String(r.productId) === String(productId) && r.status === "approved")
    .reverse();
  const count = rows.length;
  const avg = count ? Math.round(rows.reduce((s, r) => s + Number(r.rating), 0) / count * 10) / 10 : 0;
  const dist = [0, 0, 0, 0, 0];
  rows.forEach((r) => { dist[Math.min(5, Math.max(1, Number(r.rating))) - 1]++; });
  return {
    ok: true, average: avg, count: count, distribution: dist,
    reviews: rows.slice(0, 30).map((r) => ({
      name: r.name, rating: Number(r.rating), text: r.text, date: String(r.date).slice(0, 10), verified: isTrue(r.verified)
    }))
  };
}

function submitReview(d) {
  if (hitLimit("review", 8, 600)) return { ok: false, error: "We are receiving a lot of reviews right now. Please try again in a few minutes." };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rating = parseInt(d.rating, 10);
    if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Please select a rating from 1 to 5" };
    const name = clean(str(d.name, 40)).trim();
    if (name.length < 2) return { ok: false, error: "Please enter your name" };
    const text = str(d.text, 500);
    const productId = String(d.productId || "");
    if (!productId) return { ok: false, error: "Product not found" };

    const sh = ss.getSheetByName("Reviews");
    const rows = readTable(sh, REVIEW_COLS);
    // simple duplicate guard (same product + name + text)
    if (rows.some((r) => String(r.productId) === productId && String(r.name).toLowerCase() === name.toLowerCase() && String(r.text) === clean(text))) {
      return { ok: false, error: "You have already submitted this review" };
    }
    // No order ID needed. If an order ID + phone are supplied and match a delivered order containing this product, mark "verified".
    let verified = false;
    const orderId = String(d.orderId || "").trim().toUpperCase();
    if (orderId) {
      const phone = String(d.phone || "").replace(/\D/g, "");
      const order = readTable(ss.getSheetByName("Orders"), ORDER_COLS)
        .find((o) => String(o.orderId).toUpperCase() === orderId && String(o.phone).replace(/\D/g, "") === phone);
      if (order && order.status === "ডেলিভারড") {
        let lines = [];
        try { lines = JSON.parse(order.itemsJson); } catch (e) { /* ignore */ }
        verified = lines.some((l) => String(l.id) === productId);
      }
    }
    sh.appendRow([
      "R" + (rows.length + 1) + "-" + Utilities.formatDate(new Date(), "Asia/Dhaka", "yyMMddHHmm"),
      productId, verified ? orderId : "", name, rating, clean(text),
      Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy"), "pending", verified, "", "", false
    ]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================
   নোটিফিকেশন: ইমেইল (Gmail) ও SMS (যেকোনো গেটওয়ে)
   ===================================================== */
function getNotify() {
  let saved = {};
  try { saved = JSON.parse(PropertiesService.getScriptProperties().getProperty("NOTIFY") || "{}"); } catch (e) { /* ignore */ }
  return Object.assign({}, DEFAULT_NOTIFY, saved);
}

function safe(fn) {
  try { return fn(); } catch (err) { Logger.log("Notification failed: " + err); return null; }
}

const taka = (n) => "৳" + Number(n || 0).toLocaleString("en-US");
const payText = { cod: "Cash on delivery", bkash: "bKash", nagad: "Nagad" };
function h(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function notifyNewOrder(o) {
  const n = getNotify();
  const adminTo = n.adminEmail || Session.getEffectiveUser().getEmail();
  if (n.emailAdmin && adminTo) {
    MailApp.sendEmail({
      to: adminTo, name: SHOP_NAME,
      subject: "🛒 New order " + o.orderId + " — " + taka(o.total),
      htmlBody: orderEmailHtml(o, "A new order has arrived", true)
    });
  }
  if (n.emailCustomer && o.email) {
    MailApp.sendEmail({
      to: o.email, name: SHOP_NAME,
      subject: "Your order " + o.orderId + " has been received",
      htmlBody: orderEmailHtml(o, "Thank you " + o.name + "! Your order has been received", false)
    });
  }
  if (n.smsAdmin && n.adminPhone) {
    sendSms(n, n.adminPhone, "New order " + o.orderId + ": " + o.name + ", " + o.phone + ", " + taka(o.total));
  }
  if (n.smsCustomer) {
    sendSms(n, o.phone, "Thank you " + o.name + "! Your order " + o.orderId + " has been received. Total " + taka(o.total) + ". We will call you shortly to confirm. - " + SHOP_NAME);
  }
}

function notifyStatus(order, status) {
  const n = getNotify();
  if (!n.statusNotify) return;
  const text = {
    "কনফার্মড": "Your order " + order.orderId + " is confirmed. It will be shipped soon.",
    "শিপড": "Your order " + order.orderId + " has been shipped. It will reach you soon.",
    "ডেলিভারড": "Your order " + order.orderId + " has been delivered. Thank you! Please leave a review on our website.",
    "বাতিল": "Your order " + order.orderId + " has been cancelled. Call us if you have any questions."
  }[status];
  if (!text) return;
  if (status === "শিপড" && order.consignmentId && COURIERS[order.courier]) {
    const url = courierTrackUrl(order);
    text += " Courier: " + COURIERS[order.courier].name + (order.trackingCode ? ", tracking " + order.trackingCode : "") + "." + (url ? " Track: " + url : "");
  }
  const phone = String(order.phone).replace(/\D/g, "");
  if (n.smsCustomer && phone) safe(() => sendSms(n, phone, text + " - " + SHOP_NAME));
  if (n.emailCustomer && order.email) {
    safe(() => MailApp.sendEmail({
      to: order.email, name: SHOP_NAME, subject: "Order " + order.orderId + " — " + ({ "নতুন": "Pending", "কনফার্মড": "Confirmed", "শিপড": "Shipped", "ডেলিভারড": "Delivered", "বাতিল": "Cancelled" }[status] || status),
      htmlBody: '<div style="font-family:sans-serif;max-width:520px"><h3 style="color:#123f24">🌿 ' + SHOP_NAME + "</h3><p>" + h(text) + "</p></div>"
    }));
  }
}

function orderEmailHtml(o, title, forAdmin) {
  const rows = (o.lines || []).map((l) =>
    "<tr><td style='padding:6px 8px;border-bottom:1px solid #eee'>" + h(l.name) + " (" + h(l.unit) + ")</td>" +
    "<td style='padding:6px 8px;border-bottom:1px solid #eee;text-align:center'>" + l.qty + "</td>" +
    "<td style='padding:6px 8px;border-bottom:1px solid #eee;text-align:right'>" + taka(l.price * l.qty) + "</td></tr>").join("");
  const customer = forAdmin
    ? "<p style='margin:12px 0'><b>" + h(o.name) + "</b><br>📞 " + h(o.phone) + (o.email ? "<br>✉️ " + h(o.email) : "") +
      "<br>📍 " + h(o.address) + " (" + h(o.area) + ")" + (o.note ? "<br>📝 " + h(o.note) : "") + "</p>"
    : "<p style='margin:12px 0;color:#555'>We will call you shortly to confirm your order.</p>";
  return "<div style='font-family:sans-serif;max-width:560px;margin:auto;border:1px solid #e6e2d6;border-radius:12px;overflow:hidden'>" +
    "<div style='background:#123f24;color:#fff;padding:14px 18px;font-size:18px'>🌿 " + SHOP_NAME + "</div>" +
    "<div style='padding:18px'><h3 style='margin:0 0 6px;color:#123f24'>" + h(title) + "</h3>" +
    "<p style='margin:0;color:#555'>Order ID: <b>" + h(o.orderId) + "</b></p>" + customer +
    "<table style='width:100%;border-collapse:collapse;font-size:14px'><tr style='background:#e8f4ec'><th style='padding:6px 8px;text-align:left'>Item</th><th>Qty</th><th style='text-align:right;padding:6px 8px'>Price</th></tr>" + rows + "</table>" +
    "<p style='text-align:right;margin:10px 0 0'>Items: " + taka(o.subtotal) + " · Delivery: " + taka(o.delivery) +
    (o.discount ? " · Discount: −" + taka(o.discount) : "") + "<br><b style='font-size:18px;color:#123f24'>Total: " + taka(o.total) + "</b></p>" +
    "<p style='color:#555'>Payment: " + h(payText[o.payMethod] || o.payMethod) + (o.trxId ? " (TrxID: " + h(o.trxId) + ")" : "") + "</p>" +
    "</div></div>";
}

// {key} {sender} {number} (8801...) {number_local} (01...) {message} বসিয়ে URL বানায়
function sendSms(n, phone, message) {
  if (!n.smsUrl) throw new Error("SMS gateway URL is not set");
  const digits = String(phone).replace(/\D/g, "");
  const intl = digits.indexOf("880") === 0 ? digits : "88" + digits.replace(/^0?/, "0");
  const local = "0" + intl.slice(3);
  const url = n.smsUrl
    .replace(/\{key\}/g, encodeURIComponent(n.smsKey))
    .replace(/\{sender\}/g, encodeURIComponent(n.smsSender))
    .replace(/\{number_local\}/g, local)
    .replace(/\{number\}/g, intl)
    .replace(/\{message\}/g, encodeURIComponent(message));
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log("SMS " + intl + " → " + res.getResponseCode() + " " + String(res.getContentText()).slice(0, 200));
  return res.getResponseCode() + " " + String(res.getContentText()).slice(0, 200);
}

const MASK = "••••";
function publicNotify() {
  const n = getNotify();
  const out = Object.assign({}, n);
  out.smsKey = n.smsKey ? MASK + String(n.smsKey).slice(-4) : "";
  return out;
}

/* ---------- অ্যাডমিন ---------- */
const ADMIN_READ_ONLY = ["login", "bootstrap", "orders", "products", "coupons", "settings", "reviews", "notify", "slides", "categories", "courierConfig", "campaignInfo", "campaignPreview", "campaigns", "testCourier", "testNotify", "testCampaign"];
function adminAction(d) {
  const pass = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!pass || String(d.password) !== pass) {
    // each wrong guess is made slower (a few seconds) so guessing the password is impractical; the real admin is not locked out
    const cache = CacheService.getScriptCache(), n = Number(cache.get("admfail") || 0) + 1;
    cache.put("admfail", String(n), 600);
    if (n > 3) Utilities.sleep(Math.min(5000, 800 * (n - 3)));
    return { ok: false, error: "Wrong password", auth: false };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  const ctx = {};
  let res;
  lock.waitLock(20000);
  try {
    res = adminDispatch(d, ss, ctx);
  } finally {
    lock.releaseLock();
  }
  if (ADMIN_READ_ONLY.indexOf(d.cmd) < 0) safe(bustPublicCache); // any change → storefront cache refreshes immediately
  if (ctx.after) safe(ctx.after); // slow work (SMS / email) runs after the lock is released
  const out = ctx.result || res;
  if (d.cmd === "login" || d.cmd === "bootstrap") out.defaultPassword = pass === "changeme123";
  return out;
}

function adminDispatch(d, ss, ctx) {
  switch (d.cmd) {
    case "login":
      return { ok: true };
    case "bootstrap": // everything the admin screen needs, in ONE request (was 9 separate calls that queued behind each other)
      return {
        ok: true, statuses: STATUSES,
        orders: readTable(ss.getSheetByName("Orders"), ORDER_COLS).reverse().slice(0, 1500),
        products: readTable(ss.getSheetByName("Products"), PRODUCT_COLS),
        coupons: readTable(ss.getSheetByName("Coupons"), COUPON_COLS).map((c) => Object.assign(c, { expires: couponExpiry(c.expires) })),
        settings: getSettings(ss),
        reviews: readTable(ss.getSheetByName("Reviews"), REVIEW_COLS).reverse(),
        notify: publicNotify(),
        slides: readTable(ss.getSheetByName("Slides"), SLIDE_COLS),
        categories: categoryRows(ss),
        courier: publicCourier()
      };
    case "orders": {
      const rows = readTable(ss.getSheetByName("Orders"), ORDER_COLS).reverse().slice(0, 1500);
      return { ok: true, orders: rows, statuses: STATUSES };
    }
    case "setStatus": {
      if (STATUSES.indexOf(d.status) < 0) return { ok: false, error: "Invalid status" };
      const sh = ss.getSheetByName("Orders");
      const rows = readTable(sh, ORDER_COLS);
      const i = rows.findIndex((r) => r.orderId === d.orderId);
      if (i < 0) return { ok: false, error: "Order not found" };
      const old = rows[i].status;
      sh.getRange(i + 2, ORDER_COLS.indexOf("status") + 1).setValue(d.status);
      // বাতিল করলে স্টক ফেরত, বাতিল থেকে ফিরলে আবার কমানো
      if ((old === "বাতিল") !== (d.status === "বাতিল")) adjustStock(ss, rows[i].itemsJson, d.status === "বাতিল" ? 1 : -1);
      if (old !== d.status && d.silent !== true) ctx.after = () => notifyStatus(rows[i], d.status);
      if (d.status === "কনফার্মড" && old !== "কনফার্মড") {
        const cfg = getCourier(), prev = ctx.after;
        if (cfg.autoSend && courierApiReady(cfg) && !rows[i].consignmentId) ctx.after = () => { if (prev) prev(); safe(() => autoCourierSend(rows[i].orderId)); };
      }
      return { ok: true };
    }
    case "products":
      return { ok: true, products: readTable(ss.getSheetByName("Products"), PRODUCT_COLS) };
    case "saveProduct": {
      const sh = ss.getSheetByName("Products");
      const p = d.product || {};
      const rows = readTable(sh, PRODUCT_COLS);
      const cats = categoryRows(ss).map((c) => c.name);
      const cat = str(p.category, 40);
      if (cats.length && cats.indexOf(cat) < 0) return { ok: false, error: "Please select a category from the list" };
      const image = str(p.image, 500), images = productImageValues(p.images);
      if (image && !safeUrl(image)) return { ok: false, error: "Product image must be an http(s) URL or a site-relative path" };
      if (images.some((url) => !safeUrl(url))) return { ok: false, error: "Every additional product image must be an http(s) URL or a site-relative path" };
      const gallery = Array.from(new Set(images.filter((url) => url !== image)));
      if (gallery.length > (image ? 2 : 3)) return { ok: false, error: "A product can have up to 3 images total" };
      const vals = [
        p.id, str(p.name, 100), str(p.unit, 40), cat,
        Number(p.price) || 0, Number(p.oldPrice) || 0, str(p.emoji, 8), image,
        str(p.tag, 30), Number(p.stock) || 0, p.active === false || p.active === "false" ? false : true,
        str(p.desc, 600), JSON.stringify(gallery)
      ];
      const i = p.id ? rows.findIndex((r) => String(r.id) === String(p.id)) : -1;
      if (i >= 0) sh.getRange(i + 2, 1, 1, PRODUCT_COLS.length).setValues([vals]);
      else {
        vals[0] = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
        sh.appendRow(vals);
      }
      return { ok: true };
    }
    /* --- ক্যাটাগরি --- */
    case "categories":
      return { ok: true, categories: categoryRows(ss) };
    case "saveCategory": {
      const sh = ss.getSheetByName("Categories");
      if (!sh) return { ok: false, error: "Run setup in Apps Script first" };
      const c = d.category || {};
      const name = clean(str(c.name, 40)), emoji = str(c.emoji, 8), oldName = str(c.oldName, 40);
      if (!name) return { ok: false, error: "Enter a category name" };
      const rows = readTable(sh, CATEGORY_COLS);
      const dup = rows.findIndex((r) => String(r.name).trim().toLowerCase() === name.toLowerCase() && String(r.name).trim() !== oldName);
      if (dup >= 0) return { ok: false, error: "A category with this name already exists" };
      const i = oldName ? rows.findIndex((r) => String(r.name).trim() === oldName) : -1;
      if (i >= 0) {
        sh.getRange(i + 2, 1, 1, CATEGORY_COLS.length).setValues([[name, emoji]]);
        if (oldName !== name) { // নাম বদলালে সব পণ্যের ক্যাটাগরিও বদলে যাবে
          const ps = ss.getSheetByName("Products"), col = PRODUCT_COLS.indexOf("category") + 1;
          readTable(ps, PRODUCT_COLS).forEach((p, k) => { if (String(p.category).trim() === oldName) ps.getRange(k + 2, col).setValue(name); });
        }
      } else sh.appendRow([name, emoji]);
      return { ok: true };
    }
    case "deleteCategory": {
      const sh = ss.getSheetByName("Categories");
      const name = str(d.name, 40);
      const used = readTable(ss.getSheetByName("Products"), PRODUCT_COLS).filter((p) => String(p.category).trim() === name).length;
      if (used) return { ok: false, error: "This category has " + used + " product(s). Move or delete them first." };
      const i = readTable(sh, CATEGORY_COLS).findIndex((r) => String(r.name).trim() === name);
      if (i >= 0) sh.deleteRow(i + 2);
      return { ok: true };
    }
    case "moveCategory": { // dir: -1 উপরে, +1 নিচে
      const sh = ss.getSheetByName("Categories");
      const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, CATEGORY_COLS.length).getValues() : [];
      const i = rows.findIndex((r) => String(r[0]).trim() === str(d.name, 40)), j = i + (Number(d.dir) < 0 ? -1 : 1);
      if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
      sh.getRange(i + 2, 1, 1, CATEGORY_COLS.length).setValues([rows[j]]);
      sh.getRange(j + 2, 1, 1, CATEGORY_COLS.length).setValues([rows[i]]);
      return { ok: true };
    }
    case "deleteProduct": {
      const sh = ss.getSheetByName("Products");
      const i = readTable(sh, PRODUCT_COLS).findIndex((r) => String(r.id) === String(d.id));
      if (i >= 0) sh.deleteRow(i + 2);
      return { ok: true };
    }
    case "settings":
      return { ok: true, settings: getSettings(ss) };
    case "saveSettings": {
      const sh = ss.getSheetByName("Settings");
      const rows = sh.getDataRange().getValues();
      const incoming = Object.assign({}, d.settings || {});
      if ("metaPixelId" in incoming) incoming.metaPixelId = String(incoming.metaPixelId).replace(/\D/g, "").slice(0, 20);
      if ("email" in incoming) { const em = String(incoming.email).trim(); incoming.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? em.slice(0, 120) : ""; }
      ["facebook", "linkedin", "tiktok"].forEach((k) => { if (k in incoming) { const u = String(incoming[k]).trim(); incoming[k] = /^https:\/\/[^\s]+$/i.test(u) ? u.slice(0, 300) : ""; } });
      if ("offerEndsAt" in incoming) { const oe = String(incoming.offerEndsAt).trim(); incoming.offerEndsAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(oe) ? oe : ""; }
      if ("promoCoupon" in incoming) incoming.promoCoupon = String(incoming.promoCoupon).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
      if ("brands" in incoming) {
        let list = [];
        try { list = JSON.parse(String(incoming.brands) || "[]"); } catch (e) { list = []; }
        const okUrl = (u) => /^(https?:\/\/[^\s]+|[A-Za-z0-9_\-\/.]+)$/.test(String(u || "").trim());
        incoming.brands = JSON.stringify((Array.isArray(list) ? list : []).slice(0, 12).map((b) => ({
          name: String((b && b.name) || "").trim().slice(0, 40),
          logo: okUrl(b && b.logo) ? String(b.logo).trim().slice(0, 500) : "",
          link: (/^(https?:\/\/[^\s]+|#[\w-]*|[A-Za-z0-9_\-\/.?=&]+)$/.test(String((b && b.link) || "").trim())) ? String(b.link).trim().slice(0, 300) : ""
        })).filter((b) => b.logo));
      }
      if ("footerCats" in incoming) incoming.footerCats = String(incoming.footerCats).split("|").map((x) => x.trim()).filter(Boolean).slice(0, 5).join("|").slice(0, 400);
      ["address", "hours", "offerText", "notice"].forEach((k) => { if (k in incoming) incoming[k] = String(incoming[k]).trim().slice(0, 200); });
      Object.keys(incoming).forEach((k) => {
        if (!(k in DEFAULT_SETTINGS)) return;
        const i = rows.findIndex((r) => r[0] === k);
        // ফোন/আইডি জাতীয় মান টেক্সট হিসেবে রাখা (শুরুর ০ যেন না হারায়)
        const cell = i >= 0 ? sh.getRange(i + 1, 2) : sh.getRange(sh.getLastRow() + 1, 2);
        if (i < 0) sh.getRange(sh.getLastRow() + 1, 1).setValue(k);
        cell.setNumberFormat("@").setValue(String(incoming[k]));
      });
      return { ok: true };
    }
    case "courierConfig":
      return publicCourier();
    case "saveCourier": {
      const old = getCourier(), inc = d.config || {};
      const next = { active: COURIERS[inc.active] ? inc.active : old.active, markShipped: inc.markShipped === true, autoSend: inc.autoSend === true, syncStatus: inc.syncStatus === true, creds: JSON.parse(JSON.stringify(old.creds || {})) };
      Object.keys(inc.creds || {}).forEach((pid) => {
        const p = COURIERS[pid]; if (!p || p.type !== "api") return;
        next.creds[pid] = next.creds[pid] || {};
        p.fields.forEach((f) => {
          const v = inc.creds[pid][f.key];
          if (f.bool) next.creds[pid][f.key] = v === true;
          else if (f.secret && String(v || "").indexOf(MASK) === 0) { /* unchanged */ }
          else if (v !== undefined) next.creds[pid][f.key] = str(v, 200);
        });
      });
      PropertiesService.getScriptProperties().setProperty("COURIER", JSON.stringify(next));
      if (typeof inc.hourlySync === "boolean") { try { courierSetTrigger(inc.hourlySync); } catch (e) { return { ok: false, error: "Saved, but the hourly check could not be turned on: " + String(e.message || e) + " (re-authorise the script in Apps Script and try again)" }; } }
      return publicCourier();
    }
    case "testCourier":
      return courierTest(d.provider);
    case "sendToCourier":
      return courierSend(ss, Array.isArray(d.orderIds) ? d.orderIds.map(String) : [], ctx);
    case "saveManualTracking":
      return saveManualTracking(ss, d, ctx);
    case "syncCourier":
      return courierSync(ss, Array.isArray(d.orderIds) ? d.orderIds.map(String) : null);
    case "campaignInfo":
      return campaignInfo();
    case "campaignPreview":
      return campaignPreview(ss, d);
    case "sendCampaignBatch":
      return sendCampaignBatch(ss, d);
    case "testCampaign":
      return testCampaign(ss, d);
    case "campaigns":
      return { ok: true, campaigns: readTable(sheetOf(ss, "Campaigns", CAMPAIGN_COLS), CAMPAIGN_COLS).reverse().slice(0, 60) };
    case "coupons":
      return { ok: true, coupons: readTable(ss.getSheetByName("Coupons"), COUPON_COLS).map((c) => Object.assign(c, { expires: couponExpiry(c.expires) })) };
    case "saveCoupon": {
      const sh = ss.getSheetByName("Coupons");
      const c = d.coupon || {};
      const code = str(c.code, 30).toUpperCase();
      if (!code) return { ok: false, error: "Enter a code" };
      const expires = String(c.expires || "").trim();
      if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return { ok: false, error: "Invalid expiry date" };
      const vals = [code, c.type === "flat" ? "flat" : "percent", Number(c.value) || 0, Number(c.minOrder) || 0, c.active !== false, expires];
      const rows = readTable(sh, COUPON_COLS), i = rows.findIndex((r) => String(r.code).toUpperCase() === code);
      const rowNo = i >= 0 ? i + 2 : sh.getLastRow() + 1;
      sh.getRange(rowNo, COUPON_COLS.indexOf("expires") + 1).setNumberFormat("@"); // keep the date as plain text (Sheets would turn it into a Date)
      sh.getRange(rowNo, 1, 1, COUPON_COLS.length).setValues([vals]);
      return { ok: true };
    }
    case "deleteCoupon": {
      const sh = ss.getSheetByName("Coupons");
      const i = readTable(sh, COUPON_COLS).findIndex((r) => String(r.code).toUpperCase() === String(d.code).toUpperCase());
      if (i >= 0) sh.deleteRow(i + 2);
      return { ok: true };
    }

    /* --- হোমপেজ স্লাইডার --- */
    case "slides":
      return { ok: true, slides: readTable(ss.getSheetByName("Slides"), SLIDE_COLS), max: MAX_SLIDES };
    case "saveSlide": {
      const sh = ss.getSheetByName("Slides");
      const x = d.slide || {};
      const rows = readTable(sh, SLIDE_COLS);
      const link = str(x.link, 300), d1 = str(x.imgDesktop, 600), m1 = str(x.imgMobile, 600);
      if (![link, d1, m1].every(safeUrl)) return { ok: false, error: "Invalid link / image address (must start with http://, https:// or #)" };
      const theme = ["green", "gold", "teal"].indexOf(x.theme) >= 0 ? x.theme : "green";
      if (!d1 && !str(x.title, 140) && !str(x.badge, 60)) return { ok: false, error: "Add an image or at least a title" };
      const i = x.slideId ? rows.findIndex((r) => r.slideId === x.slideId) : -1;
      if (i < 0 && rows.length >= MAX_SLIDES) return { ok: false, error: "You can keep up to " + MAX_SLIDES + " slides. Delete one first." };
      const vals = [
        i >= 0 ? x.slideId : "S" + Date.now().toString(36).toUpperCase(),
        clean(str(x.badge, 60)), clean(str(x.title, 140)), clean(str(x.subtitle, 240)), clean(str(x.btnText, 40)),
        link, d1, m1, theme, x.active === false || x.active === "false" ? false : true
      ];
      if (i >= 0) sh.getRange(i + 2, 1, 1, SLIDE_COLS.length).setValues([vals]); else sh.appendRow(vals);
      return { ok: true };
    }
    case "deleteSlide": {
      const sh = ss.getSheetByName("Slides");
      const i = readTable(sh, SLIDE_COLS).findIndex((r) => r.slideId === d.slideId);
      if (i >= 0) sh.deleteRow(i + 2);
      return { ok: true };
    }
    case "moveSlide": { // dir: -1 উপরে, +1 নিচে
      const sh = ss.getSheetByName("Slides");
      const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, SLIDE_COLS.length).getValues() : [];
      const i = rows.findIndex((r) => r[0] === d.slideId), j = i + (Number(d.dir) < 0 ? -1 : 1);
      if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
      sh.getRange(i + 2, 1, 1, SLIDE_COLS.length).setValues([rows[j]]);
      sh.getRange(j + 2, 1, 1, SLIDE_COLS.length).setValues([rows[i]]);
      return { ok: true };
    }
    case "uploadImage": { // ব্রাউজার ছবি ছোট করে JPEG বানিয়ে পাঠায়; Google Drive এ রেখে পাবলিক লিংক ফেরত দেয়
      const b64 = String(d.data || "");
      if (!b64) return { ok: false, error: "Image not received" };
      if (b64.length > 4200000) return { ok: false, error: "Image is too large (keep it under 3 MB)" };
      const bytes = Utilities.base64Decode(b64);
      const mime = imageMime(bytes);
      if (!mime) return { ok: false, error: "Only JPG, PNG or WebP images are allowed" };
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mime];
      const base = str(d.name, 40).replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
      const file = imageFolder().createFile(Utilities.newBlob(bytes, mime, base + "-" + Date.now() + "." + ext));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return { ok: true, url: "https://lh3.googleusercontent.com/d/" + file.getId() };
    }

    /* --- রিভিউ ব্যবস্থাপনা --- */
    case "reviews":
      return { ok: true, reviews: readTable(ss.getSheetByName("Reviews"), REVIEW_COLS).reverse() };
    case "setReviewStatus": {
      if (REVIEW_STATUSES.indexOf(d.status) < 0) return { ok: false, error: "Invalid status" };
      const sh = ss.getSheetByName("Reviews");
      const i = readTable(sh, REVIEW_COLS).findIndex((r) => r.reviewId === d.reviewId);
      if (i < 0) return { ok: false, error: "Review not found" };
      sh.getRange(i + 2, REVIEW_COLS.indexOf("status") + 1).setValue(d.status);
      if (d.status !== "approved") sh.getRange(i + 2, REVIEW_COLS.indexOf("featured") + 1).setValue(false);
      return { ok: true };
    }
    case "saveReview": { // admin adds or edits a review (e.g. from Facebook / WhatsApp); optional photo, role and homepage flag
      const r = d.review || {};
      const rating = parseInt(r.rating, 10);
      if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Select a rating from 1 to 5" };
      const name = clean(str(r.name, 40)).trim();
      if (!name) return { ok: false, error: "Enter the customer name" };
      const sh = ss.getSheetByName("Reviews");
      const rows = readTable(sh, REVIEW_COLS);
      const status = REVIEW_STATUSES.indexOf(r.status) >= 0 ? r.status : "approved";
      const avatar = /^https:\/\/[^\s]+$/.test(String(r.avatar || "").trim()) ? String(r.avatar).trim().slice(0, 500) : "";
      const featured = r.featured === true || String(r.featured).toLowerCase() === "true";
      const vals = {
        reviewId: "R" + (rows.length + 1) + "-m" + Utilities.formatDate(new Date(), "Asia/Dhaka", "yyMMddHHmmss"),
        productId: String(r.productId || ""), orderId: "manual", name: name, rating: rating, text: clean(str(r.text, 500)),
        date: Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy"), status: status, verified: false,
        role: clean(str(r.role, 60)), avatar: avatar, featured: featured && status === "approved"
      };
      if (r.reviewId) {
        const i = rows.findIndex((x) => x.reviewId === r.reviewId);
        if (i < 0) return { ok: false, error: "Review not found" };
        const old = rows[i];
        vals.reviewId = old.reviewId; vals.orderId = old.orderId; vals.date = old.date; vals.verified = isTrue(old.verified);
        sh.getRange(i + 2, 1, 1, REVIEW_COLS.length).setValues([REVIEW_COLS.map((c) => vals[c])]);
      } else {
        sh.appendRow(REVIEW_COLS.map((c) => vals[c]));
      }
      return { ok: true };
    }
    case "setReviewFeatured": {
      const sh = ss.getSheetByName("Reviews");
      const i = readTable(sh, REVIEW_COLS).findIndex((r) => r.reviewId === d.reviewId);
      if (i < 0) return { ok: false, error: "Review not found" };
      const on = d.featured === true;
      sh.getRange(i + 2, REVIEW_COLS.indexOf("featured") + 1).setValue(on);
      if (on) sh.getRange(i + 2, REVIEW_COLS.indexOf("status") + 1).setValue("approved"); // only approved reviews can be shown
      return { ok: true };
    }
    case "deleteReview": {
      const sh = ss.getSheetByName("Reviews");
      const i = readTable(sh, REVIEW_COLS).findIndex((r) => r.reviewId === d.reviewId);
      if (i >= 0) sh.deleteRow(i + 2);
      return { ok: true };
    }

    /* --- নোটিফিকেশন --- */
    case "notify":
      return { ok: true, notify: publicNotify() };
    case "saveNotify": {
      const old = getNotify(), inc = d.notify || {};
      const next = {
        adminEmail: str(inc.adminEmail, 120), adminPhone: str(inc.adminPhone, 20).replace(/[^\d+]/g, ""),
        smsUrl: str(inc.smsUrl, 500), smsSender: str(inc.smsSender, 40),
        smsKey: String(inc.smsKey || "").indexOf(MASK) === 0 ? old.smsKey : str(inc.smsKey, 200),
        emailAdmin: inc.emailAdmin === true, emailCustomer: inc.emailCustomer === true,
        smsAdmin: inc.smsAdmin === true, smsCustomer: inc.smsCustomer === true, statusNotify: inc.statusNotify === true
      };
      if (next.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.adminEmail)) return { ok: false, error: "Enter a valid email" };
      if (next.smsUrl && !/^https?:\/\//i.test(next.smsUrl)) return { ok: false, error: "SMS URL must start with http:// or https://" };
      PropertiesService.getScriptProperties().setProperty("NOTIFY", JSON.stringify(next));
      return { ok: true };
    }
    case "testNotify": {
      const n = getNotify();
      ctx.after = null;
      let msg;
      if (d.channel === "sms") {
        if (!n.adminPhone) return { ok: false, error: "Save your mobile number first" };
        try { msg = "SMS sent. Gateway response: " + sendSms(n, n.adminPhone, "Test SMS — " + SHOP_NAME + " order notifications are working ✅"); }
        catch (err) { return { ok: false, error: String(err.message || err) }; }
      } else {
        const to = n.adminEmail || Session.getEffectiveUser().getEmail();
        try { MailApp.sendEmail({ to: to, name: SHOP_NAME, subject: "Test email — " + SHOP_NAME, htmlBody: "<p>✅ Email notifications are working correctly.</p>" }); }
        catch (err) { return { ok: false, error: String(err.message || err) }; }
        msg = "Test email sent to: " + to;
      }
      return { ok: true, message: msg };
    }
  }
  return { ok: false, error: "Unknown command" };
}

function adjustStock(ss, itemsJson, sign) {
  let lines = [];
  try { lines = JSON.parse(itemsJson); } catch (e) { return; }
  const sh = ss.getSheetByName("Products");
  const rows = readTable(sh, PRODUCT_COLS);
  lines.forEach((l) => {
    const i = rows.findIndex((r) => String(r.id) === String(l.id));
    if (i >= 0) sh.getRange(i + 2, PRODUCT_COLS.indexOf("stock") + 1).setValue(Math.max(0, Number(rows[i].stock) + sign * l.qty));
  });
}

/* ---------- সাহায্যকারী ফাংশন ---------- */
function sheetOf(ss, name, cols) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(cols);
    sh.getRange(1, 1, 1, cols.length).setFontWeight("bold").setBackground("#e9f6ee");
    sh.setFrozenRows(1);
  }
  return sh;
}

const _hdrChecked = {};
function ensureCols(sh, cols) {
  const have = sh.getMaxColumns();
  if (have < cols.length) {
    sh.insertColumnsAfter(have, cols.length - have);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
    _hdrChecked[sh.getName()] = true;
    return;
  }
  const key = sh.getName();
  if (_hdrChecked[key]) return;
  _hdrChecked[key] = true;
  if (sh.getLastRow() < 1) return;
  const hdr = sh.getRange(1, 1, 1, cols.length).getValues()[0];
  let dirty = false;
  cols.forEach((c, i) => { if (hdr[i] === "" || hdr[i] == null) { hdr[i] = c; dirty = true; } });
  if (dirty) sh.getRange(1, 1, 1, cols.length).setValues([hdr]).setFontWeight("bold");
}

function readTable(sh, cols) {
  if (sh) ensureCols(sh, cols);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().map((r) => {
    const o = {};
    cols.forEach((c, i) => { o[c] = r[i]; });
    return o;
  });
}


/* =====================================================
   CAMPAIGNS: send an offer to a group of past customers by SMS and/or email.
   Audience is always resolved on the server from the Orders sheet; sending happens in small batches
   (the admin page calls "sendCampaignBatch" repeatedly and shows a progress bar).
   ===================================================== */
function parseOrderDate(s) {
  if (Object.prototype.toString.call(s) === "[object Date]") return s;
  const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?)?/);
  if (!m) return null;
  let hh = m[4] ? +m[4] : 0;
  if (m[6]) { const pm = /p/i.test(m[6]); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
  return new Date(+m[3], +m[2] - 1, +m[1], hh, m[5] ? +m[5] : 0);
}
function normPhone(p) { // -> "01XXXXXXXXX" or "" when not a valid Bangladesh mobile number
  let d = String(p || "").replace(/\D/g, "");
  if (d.indexOf("880") === 0) d = d.slice(2);
  if (d.length === 10 && d.charAt(0) === "1") d = "0" + d;
  return /^01[3-9]\d{8}$/.test(d) ? d : "";
}
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());

function campaignAudience(ss, aud) {
  aud = aud || {};
  const orders = readTable(ss.getSheetByName("Orders"), ORDER_COLS);
  const map = {};
  orders.forEach((o) => {
    const key = String(o.phone).replace(/\D/g, "").slice(-10);
    if (!key) return;
    const c = map[key] || (map[key] = { key: key, name: "", phone: "", email: "", orders: 0, spent: 0, last: null, inside: false });
    c.name = o.name || c.name; c.phone = o.phone || c.phone; if (o.email) c.email = o.email;
    c.inside = /inside|ভিতরে/i.test(String(o.area));
    if (o.status !== "বাতিল") {
      c.orders++; c.spent += Number(o.total) || 0;
      const d = parseOrderDate(o.date);
      if (d && (!c.last || d > c.last)) c.last = d;
    }
  });
  const now = Date.now(), day = 86400000;
  const days = Math.max(1, Math.min(3650, Number(aud.days) || 30));
  const minSpent = Math.max(0, Number(aud.minSpent) || 3000);
  const list = Object.keys(map).map((k) => map[k]).filter((c) => c.orders >= 1).filter((c) => {
    if (aud.area === "inside" && !c.inside) return false;
    if (aud.area === "outside" && c.inside) return false;
    switch (aud.type) {
      case "recent": return c.last && now - c.last.getTime() <= days * day;
      case "inactive": return !c.last || now - c.last.getTime() > days * day;
      case "repeat": return c.orders >= 2;
      case "new": return c.orders === 1;
      case "big": return c.spent >= minSpent;
      default: return true; // "all"
    }
  });
  return list.sort((a, b) => (a.key < b.key ? -1 : 1));
}

function campaignInfo() {
  const n = getNotify();
  let quota = null;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (e) { /* ignore */ }
  return { ok: true, smsReady: !!(n.smsUrl && n.smsKey), emailQuota: quota, adminPhone: n.adminPhone || "", adminEmail: n.adminEmail || Session.getEffectiveUser().getEmail(), shop: SHOP_NAME };
}

function campaignPreview(ss, d) {
  const list = campaignAudience(ss, d.audience);
  return {
    ok: true, total: list.length,
    withPhone: list.filter((c) => normPhone(c.phone)).length,
    withEmail: list.filter((c) => validEmail(c.email)).length,
    sample: list.slice(0, 5).map((c) => c.name)
  };
}

function personalize(text, c, coupon) {
  const first = String((c && c.name) || "there").trim().split(/\s+/)[0] || "there";
  return String(text).replace(/\{name\}/g, first).replace(/\{coupon\}/g, coupon || "").replace(/\{shop\}/g, SHOP_NAME);
}
function campaignEmailHtml(msg) {
  return "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e3ece6;border-radius:12px;overflow:hidden'>" +
    "<div style='background:#0f7a43;color:#fff;padding:14px 20px;font-size:18px;font-weight:bold'>" + h(SHOP_NAME) + "</div>" +
    "<div style='padding:20px;font-size:15px;line-height:1.65;color:#222;white-space:pre-line'>" + h(msg) + "</div>" +
    "<div style='padding:12px 20px;background:#f6f8f7;color:#888;font-size:12px'>You received this because you ordered from " + h(SHOP_NAME) + ". Reply to this email if you do not want promotional messages.</div></div>";
}
function smsOk(res) { return /^2\d\d/.test(String(res)); }

function validateCampaign(ss, c) {
  c = c || {};
  const name = str(c.name, 60), message = str(c.message, 600), channel = c.channel;
  if (!name) return { error: "Give the campaign a name" };
  if (["sms", "email", "both"].indexOf(channel) < 0) return { error: "Choose SMS, Email or both" };
  if (!message) return { error: "Write a message" };
  if ((channel === "email" || channel === "both") && !str(c.subject, 120)) return { error: "Add an email subject" };
  let coupon = "";
  if (c.coupon) {
    const code = str(c.coupon, 30).toUpperCase();
    const row = readTable(ss.getSheetByName("Coupons"), COUPON_COLS).find((x) => String(x.code).toUpperCase() === code && isTrue(x.active));
    if (!row) return { error: "Coupon " + code + " was not found or is not active" };
    if (couponExpired(row)) return { error: "Coupon " + code + " has expired" };
    coupon = code;
  }
  if (/\{coupon\}/.test(message) && !coupon) return { error: "Your message uses {coupon} — pick or create a coupon" };
  return { name: name, message: message, subject: str(c.subject, 120), channel: channel, coupon: coupon };
}

function sendCampaignBatch(ss, d) {
  const v = validateCampaign(ss, d.campaign);
  if (v.error) return { ok: false, error: v.error };
  const n = getNotify();
  const wantSms = v.channel === "sms" || v.channel === "both", wantEmail = v.channel === "email" || v.channel === "both";
  if (wantSms && !n.smsUrl) return { ok: false, error: "SMS gateway is not set up (Marketing → Email & SMS alerts)" };
  const list = campaignAudience(ss, d.campaign.audience);
  const offset = Math.max(0, Number(d.offset) || 0), total = list.length;
  const sh = sheetOf(ss, "Campaigns", CAMPAIGN_COLS);
  ensureCols(sh, CAMPAIGN_COLS);
  let id = String(d.campaignId || "");
  if (!id) {
    if (!total) return { ok: false, error: "No customers match this audience" };
    id = "CP" + Utilities.formatDate(new Date(), "Asia/Dhaka", "yyMMddHHmmss");
    sh.appendRow([id, Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy hh:mm a"), clean(v.name), clean(JSON.stringify(d.campaign.audience || {})), v.channel, total, 0, 0, "sending", clean(v.message), v.coupon]);
  }
  const batch = list.slice(offset, offset + CAMPAIGN_BATCH);
  let sent = 0, failed = 0; const errors = [];
  batch.forEach((c) => {
    const text = personalize(v.message, c, v.coupon);
    if (wantSms) {
      const ph = normPhone(c.phone);
      if (ph) { try { const r = sendSms(n, ph, text); if (smsOk(r)) sent++; else { failed++; if (errors.length < 3) errors.push("SMS " + ph + ": " + r); } } catch (e) { failed++; if (errors.length < 3) errors.push(String(e.message || e)); } }
    }
    if (wantEmail && validEmail(c.email)) {
      try {
        if (MailApp.getRemainingDailyQuota() < 1) throw new Error("Daily email limit reached");
        MailApp.sendEmail({ to: c.email, name: SHOP_NAME, subject: personalize(v.subject, c, v.coupon), htmlBody: campaignEmailHtml(text) });
        sent++;
      } catch (e) { failed++; if (errors.length < 3) errors.push(String(e.message || e)); }
    }
  });
  const rows = readTable(sh, CAMPAIGN_COLS), i = rows.findIndex((r) => r.campaignId === id);
  const done = offset + CAMPAIGN_BATCH >= total;
  if (i >= 0) {
    const totSent = Number(rows[i].sent || 0) + sent, totFailed = Number(rows[i].failed || 0) + failed;
    sh.getRange(i + 2, CAMPAIGN_COLS.indexOf("sent") + 1, 1, 2).setValues([[totSent, totFailed]]);
    if (done) sh.getRange(i + 2, CAMPAIGN_COLS.indexOf("status") + 1).setValue(totSent === 0 && totFailed > 0 ? "failed" : "done");
  }
  return { ok: true, campaignId: id, total: total, processed: batch.length, next: offset + batch.length, sent: sent, failed: failed, done: done, errors: errors };
}

function testCampaign(ss, d) {
  const v = validateCampaign(ss, d.campaign);
  if (v.error) return { ok: false, error: v.error };
  const n = getNotify(), sample = { name: "Test Customer" }, text = personalize(v.message, sample, v.coupon), out = [];
  try {
    if (v.channel === "sms" || v.channel === "both") {
      if (!n.adminPhone) return { ok: false, error: "Save your mobile number first (Marketing → Email & SMS alerts)" };
      const r = sendSms(n, n.adminPhone, text); out.push(smsOk(r) ? "SMS sent to " + n.adminPhone : "SMS failed: " + r);
    }
    if (v.channel === "email" || v.channel === "both") {
      const to = n.adminEmail || Session.getEffectiveUser().getEmail();
      MailApp.sendEmail({ to: to, name: SHOP_NAME, subject: "[TEST] " + personalize(v.subject, sample, v.coupon), htmlBody: campaignEmailHtml(text) });
      out.push("Email sent to " + to);
    }
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
  return { ok: true, message: out.join(" · ") };
}


/* =====================================================
   COURIERS. Two kinds:
   - "api": we create the parcel and read its status automatically (Steadfast, Pathao)
   - "manual": the courier has no public API we can use — you book in their portal and paste the tracking/CN number on the order
   To add another courier: add an entry to COURIERS (+ an adapter in COURIER_API if it is an "api" courier).
   Credentials live in Script Properties (never in the sheet).
   ===================================================== */
const COURIERS = {
  steadfast: { name: "Steadfast", type: "api", fields: [{ key: "apiKey", label: "API Key" }, { key: "secretKey", label: "Secret Key", secret: true }],
    track: (o) => "https://steadfast.com.bd/t/" + encodeURIComponent(o.trackingCode) },
  pathao: { name: "Pathao", type: "api", fields: [{ key: "clientId", label: "Client ID" }, { key: "clientSecret", label: "Client Secret", secret: true }, { key: "username", label: "Merchant email" }, { key: "password", label: "Password", secret: true }, { key: "storeId", label: "Store ID" }, { key: "sandbox", label: "Use the sandbox (testing only)", bool: true }],
    track: (o) => "https://merchant.pathao.com/tracking?consignment_id=" + encodeURIComponent(o.trackingCode) + "&phone=" + normPhone(o.phone) },
  sundarban: { name: "Sundarban Courier", type: "manual", codeLabel: "CN number", track: () => "https://operation.sundarbancourierltd.com/" },
  carrybee: { name: "CarryBee", type: "manual", codeLabel: "Tracking number", track: () => "https://carrybee.com/track" }
};
const STEADFAST_FINAL = ["delivered", "partial_delivered", "cancelled"];
const STEADFAST_LABEL = {
  pending: "Pending pickup", in_review: "In review", hold: "On hold", delivered: "Delivered", partial_delivered: "Partially delivered", cancelled: "Cancelled", unknown: "Unknown",
  delivered_approval_pending: "Delivered (awaiting approval)", partial_delivered_approval_pending: "Partially delivered (awaiting approval)", cancelled_approval_pending: "Cancelled (awaiting approval)", unknown_approval_pending: "Unknown (awaiting approval)"
};
const DEFAULT_COURIER = { active: "steadfast", markShipped: true, autoSend: false, syncStatus: true, creds: {} };

function courierTrackUrl(o) { const c = COURIERS[o.courier]; return c && o.trackingCode ? c.track(o) : ""; }
function courierLabel(provider, st) {
  st = String(st || "");
  if (COURIERS[provider] && COURIERS[provider].type === "manual") return "Booked with courier";
  if (provider === "steadfast") return STEADFAST_LABEL[st] || st;
  return st; // Pathao etc.: show the courier's own wording
}
function courierIsFinal(provider, st) {
  st = String(st || "").toLowerCase();
  if (provider === "steadfast") return STEADFAST_FINAL.indexOf(st) >= 0;
  if (provider === "pathao") return ["delivered", "partial delivery", "cancelled", "return"].indexOf(st) >= 0;
  return true;
}
function courierToOrderStatus(provider, st) {
  st = String(st || "").toLowerCase();
  if (st === "delivered" || st === "partial_delivered" || st === "partial delivery") return "ডেলিভারড";
  if (st === "cancelled") return "বাতিল";
  return "";
}

function getCourier() {
  let saved = {};
  try { saved = JSON.parse(PropertiesService.getScriptProperties().getProperty("COURIER") || "{}"); } catch (e) { /* ignore */ }
  if (saved.apiKey && !saved.creds) { saved.creds = { steadfast: { apiKey: saved.apiKey, secretKey: saved.secretKey } }; saved.active = saved.provider || "steadfast"; } // older format
  const cfg = Object.assign({}, DEFAULT_COURIER, saved);
  cfg.creds = saved.creds || {};
  if (!COURIERS[cfg.active]) cfg.active = "steadfast";
  return cfg;
}
function courierConnected(cfg, id) {
  const p = COURIERS[id]; if (!p || p.type !== "api") return false;
  const c = (cfg.creds && cfg.creds[id]) || {};
  return p.fields.every((f) => f.bool || String(c[f.key] || "").trim());
}
function courierApiReady(cfg) { return courierConnected(cfg, cfg.active); }
function courierTriggerOn() { return ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "courierSyncJob"); }
function publicCourier() {
  const cfg = getCourier();
  return {
    ok: true, active: cfg.active, hasKeys: courierApiReady(cfg), markShipped: cfg.markShipped !== false, autoSend: cfg.autoSend === true, syncStatus: cfg.syncStatus !== false, hourlySync: courierTriggerOn(),
    providers: Object.keys(COURIERS).map((id) => {
      const p = COURIERS[id], c = cfg.creds[id] || {};
      return { id: id, name: p.name, type: p.type, connected: courierConnected(cfg, id), codeLabel: p.codeLabel || "", trackPage: p.type === "manual" ? p.track({}) : "",
        fields: (p.fields || []).map((f) => ({ key: f.key, label: f.label, secret: !!f.secret, bool: !!f.bool, value: f.bool ? c[f.key] === true : (f.secret && c[f.key] ? MASK + String(c[f.key]).slice(-4) : String(c[f.key] || "")) })) };
    })
  };
}

/* ---------- HTTP helper + per-courier adapters ---------- */
function apiFetch(url, method, headers, body) {
  const opt = { method: method, muteHttpExceptions: true, headers: Object.assign({ Accept: "application/json" }, headers || {}) };
  if (body) { opt.contentType = "application/json"; opt.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch(url, opt);
  const text = String(res.getContentText() || "");
  let json = {}; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
  return { code: res.getResponseCode(), json: json, text: text };
}
function courierErr(r) {
  const j = r.json || {};
  if (r.code === 401 || r.code === 403) return "The courier rejected your credentials. Please re-check them.";
  if (j.errors) { const k = Object.keys(j.errors)[0]; const v = j.errors[k]; return (Array.isArray(v) ? v[0] : v) || j.message || "Courier error"; }
  if (j.message) return String(j.message);
  return "Courier error (HTTP " + r.code + ")";
}
const STEADFAST_BASE = "https://portal.packzy.com/api/v1";
const steadfastH = (c) => ({ "Api-Key": c.apiKey, "Secret-Key": c.secretKey });
function pathaoBase(c) { return c.sandbox === true ? "https://courier-api-sandbox.pathao.com" : "https://courier-api.pathao.com"; }
function pathaoToken(c) {
  const cache = CacheService.getScriptCache(), key = "pathao_" + c.clientId + (c.sandbox === true ? "_sb" : "");
  const hit = cache.get(key); if (hit) return hit;
  const r = apiFetch(pathaoBase(c) + "/aladdin/api/v1/issue-token", "post", {}, { client_id: c.clientId, client_secret: c.clientSecret, username: c.username, password: c.password, grant_type: "password" });
  if (r.code !== 200 || !r.json.access_token) throw new Error(r.code === 400 || r.code === 401 || r.code === 422 ? "Pathao rejected the login (client id / secret / email / password). " + (r.json.message || "") : courierErr(r));
  cache.put(key, r.json.access_token, Math.max(60, Math.min(21000, Number(r.json.expires_in || 3600) - 300)));
  return r.json.access_token;
}
const pathaoCall = (c, method, path, body) => apiFetch(pathaoBase(c) + path, method, { Authorization: "Bearer " + pathaoToken(c) }, body);

const COURIER_API = {
  steadfast: {
    test(c) {
      const r = apiFetch(STEADFAST_BASE + "/get_balance", "get", steadfastH(c));
      if (r.code === 200 && r.json.status === 200) return { ok: true, message: "Connected to Steadfast. Your courier balance: ৳" + r.json.current_balance };
      return { ok: false, error: courierErr(r) };
    },
    create(c, o, phone, cod) {
      const r = apiFetch(STEADFAST_BASE + "/create_order", "post", steadfastH(c), { invoice: String(o.orderId), recipient_name: String(o.name).slice(0, 100), recipient_phone: phone, recipient_address: String(o.address).slice(0, 250), cod_amount: cod, note: orderNote(o) });
      const k = r.json && r.json.consignment;
      if (r.code !== 200 || !k) return { ok: false, error: courierErr(r) };
      return { ok: true, consignmentId: String(k.consignment_id), trackingCode: String(k.tracking_code || ""), status: String(k.status || "in_review") };
    },
    status(c, o) {
      const r = apiFetch(STEADFAST_BASE + "/status_by_cid/" + encodeURIComponent(o.consignmentId), "get", steadfastH(c));
      return r.code === 200 && r.json.delivery_status ? String(r.json.delivery_status) : "";
    }
  },
  pathao: {
    test(c) {
      const r = pathaoCall(c, "get", "/aladdin/api/v1/stores");
      if (r.code !== 200) return { ok: false, error: courierErr(r) };
      const list = (r.json.data && (r.json.data.data || r.json.data)) || [];
      const stores = (Array.isArray(list) ? list : []).map((s) => ({ id: String(s.store_id), name: String(s.store_name || "") }));
      return { ok: true, message: "Connected to Pathao" + (stores.length ? " · " + stores.length + " store(s) found — pick yours below" : ""), stores: stores };
    },
    create(c, o, phone, cod) {
      let qty = 1; try { qty = JSON.parse(o.itemsJson).reduce((s, l) => s + (Number(l.qty) || 0), 0) || 1; } catch (e) { /* ignore */ }
      if (String(o.address).trim().length < 10) return { ok: false, error: "Pathao needs an address of at least 10 characters" };
      const r = pathaoCall(c, "post", "/aladdin/api/v1/orders", {
        store_id: Number(c.storeId), merchant_order_id: String(o.orderId), recipient_name: String(o.name).slice(0, 100), recipient_phone: phone, recipient_address: String(o.address).slice(0, 220),
        delivery_type: 48, item_type: 2, special_instruction: orderNote(o).slice(0, 200), item_quantity: qty, item_weight: 0.5, amount_to_collect: cod, item_description: String(o.items || "").slice(0, 200)
      });
      const k = r.json && r.json.data;
      if (r.code !== 200 || !k || !k.consignment_id) return { ok: false, error: courierErr(r) };
      return { ok: true, consignmentId: String(k.consignment_id), trackingCode: String(k.consignment_id), status: String(k.order_status || "Pending") };
    },
    status(c, o) {
      const r = pathaoCall(c, "get", "/aladdin/api/v1/orders/" + encodeURIComponent(o.consignmentId) + "/info");
      return r.code === 200 && r.json.data && r.json.data.order_status ? String(r.json.data.order_status) : "";
    }
  }
};
const orderNote = (o) => (String(o.items || "").slice(0, 150) + (o.note ? " | " + o.note : "")).slice(0, 250);

function courierTest(provider) {
  const cfg = getCourier(), id = COURIERS[provider] ? provider : cfg.active;
  if (!courierConnected(cfg, id)) return { ok: false, error: "Fill in all the fields for " + COURIERS[id].name + " and save first." };
  try { return COURIER_API[id].test(cfg.creds[id]); } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function orderCellSet(sh, rowNo, map) {
  Object.keys(map).forEach((col) => { sh.getRange(rowNo, ORDER_COLS.indexOf(col) + 1).setValue(map[col]); });
}
const nowStamp = () => Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy hh:mm a");

// Create the consignment for one order with an API courier and (optionally) mark it Shipped
function courierSendOne(ss, cfg, order, rowNo, after) {
  const id = cfg.active, prov = COURIERS[id];
  if (!prov || prov.type !== "api") return { ok: false, error: prov.name + " is booked manually — use “Add tracking” on the order." };
  if (!courierConnected(cfg, id)) return { ok: false, error: "Connect " + prov.name + " first (Courier page)." };
  if (order.consignmentId) return { ok: false, error: "Already with a courier (" + order.trackingCode + ")" };
  if (order.status === "বাতিল") return { ok: false, error: "This order is cancelled" };
  const phone = normPhone(order.phone);
  if (!phone) return { ok: false, error: "Customer phone number is not a valid 11-digit mobile number" };
  const res = COURIER_API[id].create(cfg.creds[id], order, phone, order.payMethod === "cod" ? Number(order.total) || 0 : 0);
  if (!res.ok) return res;
  const sh = ss.getSheetByName("Orders");
  orderCellSet(sh, rowNo, { courier: id, consignmentId: res.consignmentId, trackingCode: res.trackingCode, courierStatus: res.status, courierUpdated: nowStamp() });
  const updated = Object.assign({}, order, { courier: id, consignmentId: res.consignmentId, trackingCode: res.trackingCode, courierStatus: res.status });
  if (cfg.markShipped !== false && (order.status === "নতুন" || order.status === "কনফার্মড")) {
    orderCellSet(sh, rowNo, { status: "শিপড" }); updated.status = "শিপড";
    if (after) after.push(() => notifyStatus(updated, "শিপড"));
  }
  return { ok: true, trackingCode: updated.trackingCode, consignmentId: updated.consignmentId, status: updated.status };
}

function courierSend(ss, ids, ctx) {
  const cfg = getCourier();
  const sh = ss.getSheetByName("Orders"), rows = readTable(sh, ORDER_COLS), after = [], results = [];
  ids.slice(0, 15).forEach((id) => {
    const i = rows.findIndex((r) => r.orderId === id);
    if (i < 0) { results.push({ orderId: id, ok: false, error: "Order not found" }); return; }
    let res; try { res = courierSendOne(ss, cfg, rows[i], i + 2, after); } catch (e) { res = { ok: false, error: String(e.message || e) }; }
    results.push(Object.assign({ orderId: id }, res));
  });
  if (after.length) ctx.after = () => after.forEach((f) => safe(f));
  return { ok: true, results: results, skipped: Math.max(0, ids.length - 15) };
}

function autoCourierSend(orderId) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  const after = [];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = getCourier();
    const rows = readTable(ss.getSheetByName("Orders"), ORDER_COLS), i = rows.findIndex((r) => r.orderId === orderId);
    if (i >= 0 && !rows[i].consignmentId) courierSendOne(ss, cfg, rows[i], i + 2, after);
  } finally { lock.releaseLock(); }
  after.forEach((f) => safe(f));
}

// Manual couriers (Sundarban, CarryBee …): you book the parcel in the courier's own portal, then save its number here
function saveManualTracking(ss, d, ctx) {
  const id = String(d.courier || ""), prov = COURIERS[id];
  if (!prov) return { ok: false, error: "Choose a courier" };
  const code = str(d.code, 40);
  if (!/^[A-Za-z0-9][A-Za-z0-9\-_\/ ]{2,39}$/.test(code)) return { ok: false, error: "Enter the " + (prov.codeLabel || "tracking number").toLowerCase() + " (3–40 letters/numbers)" };
  const sh = ss.getSheetByName("Orders"), rows = readTable(sh, ORDER_COLS), i = rows.findIndex((r) => r.orderId === d.orderId);
  if (i < 0) return { ok: false, error: "Order not found" };
  const o = rows[i], cfg = getCourier();
  orderCellSet(sh, i + 2, { courier: id, consignmentId: code, trackingCode: code, courierStatus: prov.type === "manual" ? "booked" : String(o.courierStatus || ""), courierUpdated: nowStamp() });
  const updated = Object.assign({}, o, { courier: id, consignmentId: code, trackingCode: code });
  if (cfg.markShipped !== false && (o.status === "নতুন" || o.status === "কনফার্মড")) {
    orderCellSet(sh, i + 2, { status: "শিপড" }); updated.status = "শিপড";
    ctx.after = () => notifyStatus(updated, "শিপড");
  }
  return { ok: true, status: updated.status };
}

// Read the delivery status of API-courier orders and copy it into the sheet (and the order status)
function courierSync(ss, ids) {
  const cfg = getCourier();
  const sh = ss.getSheetByName("Orders"), rows = readTable(sh, ORDER_COLS), after = [];
  let targets = rows.map((r, i) => ({ r: r, rowNo: i + 2 })).filter((x) => x.r.consignmentId && COURIER_API[x.r.courier] && courierConnected(cfg, x.r.courier) &&
    (ids ? ids.indexOf(x.r.orderId) >= 0 : !courierIsFinal(x.r.courier, x.r.courierStatus)));
  const total = targets.length; targets = targets.slice(0, 30);
  let changed = 0, failed = 0;
  targets.forEach((x) => {
    try {
      const st = COURIER_API[x.r.courier].status(cfg.creds[x.r.courier], x.r);
      if (!st) { failed++; return; }
      if (st !== String(x.r.courierStatus)) changed++;
      orderCellSet(sh, x.rowNo, { courierStatus: st, courierUpdated: nowStamp() });
      const want = cfg.syncStatus !== false ? courierToOrderStatus(x.r.courier, st) : "";
      if (want && want !== x.r.status) {
        orderCellSet(sh, x.rowNo, { status: want });
        if ((x.r.status === "বাতিল") !== (want === "বাতিল")) adjustStock(ss, x.r.itemsJson, want === "বাতিল" ? 1 : -1);
        const upd = Object.assign({}, x.r, { status: want, courierStatus: st });
        after.push(() => notifyStatus(upd, want));
      }
    } catch (e) { failed++; }
  });
  after.forEach((f) => safe(f));
  return { ok: true, checked: targets.length, changed: changed, failed: failed, remaining: Math.max(0, total - targets.length) };
}

function courierSyncJob() { // hourly trigger entry point
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { courierSync(SpreadsheetApp.getActiveSpreadsheet(), null); } finally { lock.releaseLock(); }
}
function courierSetTrigger(on) {
  ScriptApp.getProjectTriggers().forEach((t) => { if (t.getHandlerFunction() === "courierSyncJob") ScriptApp.deleteTrigger(t); });
  if (on) ScriptApp.newTrigger("courierSyncJob").timeBased().everyHours(1).create();
}

function publicSettings(ss) {
  const s = getSettings(ss);
  if (s.promoCoupon) {
    const c = readTable(ss.getSheetByName("Coupons"), COUPON_COLS).find((x) => String(x.code).toUpperCase() === String(s.promoCoupon).toUpperCase());
    if (!c || !isTrue(c.active) || couponExpired(c)) s.promoCoupon = "";
  }
  return s;
}

function getSettings(ss) {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  const sh = ss.getSheetByName("Settings");
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach((r) => { if (r[0]) s[r[0]] = String(r[1]); });
  }
  return s;
}

// ক্যাটাগরি তালিকা (শিটের ক্রমে) + প্রতিটিতে পণ্য সংখ্যা
function categoryRows(ss) {
  const counts = {};
  readTable(ss.getSheetByName("Products"), PRODUCT_COLS).forEach((p) => {
    const n = String(p.category || "").trim();
    if (n) counts[n] = (counts[n] || 0) + 1;
  });
  return readTable(ss.getSheetByName("Categories"), CATEGORY_COLS)
    .filter((c) => String(c.name).trim())
    .map((c) => ({ name: String(c.name).trim(), emoji: String(c.emoji || ""), count: counts[String(c.name).trim()] || 0 }));
}
function publicCategories(ss) {
  return categoryRows(ss).map((c) => ({ name: c.name, emoji: c.emoji }));
}

function publicSlide(x) {
  return { badge: x.badge || "", title: x.title || "", subtitle: x.subtitle || "", btnText: x.btnText || "", link: x.link || "",
    imgDesktop: x.imgDesktop || "", imgMobile: x.imgMobile || "", theme: x.theme || "green" };
}
// খালি, #অ্যাঙ্কর, http(s)://, অথবা সাইটের ভেতরের পথ (যেমন images/a.jpg) — javascript:/data: নয়
function safeUrl(u) {
  u = String(u || "").trim();
  if (!u) return true;
  if (/^(javascript|data|vbscript):/i.test(u)) return false;
  return /^(#|https?:\/\/|\/|[\w.\-]+\/|[\w.\-]+$)/i.test(u);
}
function imageMime(bytes) {
  const b = (i) => (bytes[i] & 255);
  if (bytes.length > 12 && b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return "image/jpeg";
  if (bytes.length > 12 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) return "image/png";
  if (bytes.length > 12 && b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  return "";
}
function imageFolder() {
  const it = DriveApp.getFoldersByName("খাঁটিঘর ছবি");
  return it.hasNext() ? it.next() : DriveApp.createFolder("খাঁটিঘর ছবি");
}

function publicProduct(p, rt) {
  return {
    id: p.id, name: p.name, unit: p.unit, category: p.category, price: Number(p.price),
    oldPrice: Number(p.oldPrice) || 0, emoji: p.emoji, image: p.image, tag: p.tag, stock: Number(p.stock) || 0,
    images: productImageValues(p.images).filter(safeUrl).slice(0, p.image ? 2 : 3), desc: p.desc || "",
    rating: rt ? Math.round(rt.sum / rt.count * 10) / 10 : 0,
    reviews: rt ? rt.count : 0
  };
}

function productImageValues(value) {
  if (Array.isArray(value)) return value.map((image) => str(image, 500)).filter(Boolean);
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((image) => str(image, 500)).filter(Boolean);
  } catch (e) { /* Older records may store newline/comma-separated URLs. */ }
  return text.split(/[,\n|]/).map((image) => str(image, 500)).filter(Boolean);
}

const isTrue = (v) => v === true || String(v).toUpperCase() === "TRUE";
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
function clean(v) { v = String(v || ""); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
