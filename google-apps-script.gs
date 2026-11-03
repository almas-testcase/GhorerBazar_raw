/**
 * খাঁটিঘর ই-কমার্স ব্যাকএন্ড (Google Apps Script)
 * কীভাবে বসাবেন: README-বাংলা-গাইড.md দেখুন
 *
 * শিট: Products, Orders, Coupons, Reviews, Settings (setup() চালালে নিজে তৈরি হবে)
 * অ্যাডমিন পাসওয়ার্ড: Project Settings > Script Properties > ADMIN_PASSWORD
 * নোটিফিকেশন (ইমেইল/SMS) সেটিং: অ্যাডমিন প্যানেল > সেটিংস > নোটিফিকেশন
 */

const PRODUCT_COLS = ["id", "name", "unit", "category", "price", "oldPrice", "emoji", "image", "tag", "stock", "active", "desc"];
const ORDER_COLS = ["orderId", "date", "name", "phone", "address", "area", "items", "itemsJson", "subtotal", "delivery", "discount", "coupon", "total", "payMethod", "trxId", "note", "status", "email"];
const COUPON_COLS = ["code", "type", "value", "minOrder", "active"];
const REVIEW_COLS = ["reviewId", "productId", "orderId", "name", "rating", "text", "date", "status", "verified"];
const CATEGORY_COLS = ["name", "emoji"];
const SLIDE_COLS = ["slideId", "badge", "title", "subtitle", "btnText", "link", "imgDesktop", "imgMobile", "theme", "active"];
const MAX_SLIDES = 5;
const DEFAULT_SLIDE_ROWS = [
  ["S1", "🚚 সারাদেশে ক্যাশ অন ডেলিভারি", "১০০% খাঁটি তেল, মশলা, বাদাম ও মধু সরাসরি আপনার ঘরে", "ভেজালমুক্ত, ফ্রেশ ও বিশ্বস্ত মানের গ্রোসারি পণ্য। পণ্য হাতে পেয়ে দেখে টাকা দিন।", "এখনই কিনুন", "#products", "", "", "green", true],
  ["S2", "🍯 সিজন স্পেশাল", "সুন্দরবনের খাঁটি মধু — এখন বিশেষ ছাড়ে", "প্রাকৃতিক, চিনি-মুক্ত ও ভেজালমুক্ত। প্রতিটি বোতলে আসল স্বাদের নিশ্চয়তা।", "মধু দেখুন", "#products", "", "", "gold", true],
  ["S3", "🎁 ফ্রি ডেলিভারি অফার", "বেশি কিনুন, ডেলিভারি চার্জ বাঁচান", "নির্দিষ্ট টাকার অর্ডারে ফ্রি ডেলিভারি, সাথে ৭ দিনের সহজ রিটার্ন ও ক্যাশ অন ডেলিভারি।", "শপিং শুরু করুন", "#products", "", "", "teal", true]
];
const STATUSES = ["নতুন", "কনফার্মড", "শিপড", "ডেলিভারড", "বাতিল"];
const REVIEW_STATUSES = ["pending", "approved", "rejected"];
const SHOP_NAME = "খাঁটিঘর";
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
  hours: "প্রতিদিন সকাল ৯টা – রাত ১০টা",
  facebook: "",
  linkedin: "",
  tiktok: "",
  offerEndsAt: "",   // যেমন 2026-11-30T23:59 — ফাঁকা বা পেরিয়ে গেলে কাউন্টডাউন ব্যান্ড লুকানো থাকে
  offerText: "",
  promoCoupon: ""    // হিরোর পাশে দেখানোর কুপন কোড (Coupons ট্যাবে থাকা কোড)
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
  [["Products", PRODUCT_COLS], ["Orders", ORDER_COLS], ["Coupons", COUPON_COLS], ["Reviews", REVIEW_COLS], ["Slides", SLIDE_COLS], ["Categories", CATEGORY_COLS]].forEach((x) => {
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
      [1, "খাঁটি সরিষার তেল", "১ লিটার", "তেল", 320, 380, "🫒", "", "বেস্ট সেলার", 50, true, "কাঠের ঘানিতে ভাঙানো ১০০% খাঁটি সরিষার তেল।"],
      [2, "সুন্দরবনের খাঁটি মধু", "৫০০ গ্রাম", "মধু", 650, 780, "🍯", "", "২০% ছাড়", 30, true, "সুন্দরবনের মৌসুমি ফুলের প্রাকৃতিক মধু।"],
      [3, "কাজুবাদাম (প্রিমিয়াম)", "৫০০ গ্রাম", "বাদাম", 780, 900, "🥜", "", "", 40, true, "বড় দানার ফ্রেশ কাজুবাদাম।"],
      [4, "হলুদ গুঁড়া", "৫০০ গ্রাম", "মশলা", 240, 280, "🟡", "", "", 60, true, "খাঁটি হলুদ গুঁড়া, কৃত্রিম রঙ ছাড়া।"],
      [5, "মরিচ গুঁড়া", "৫০০ গ্রাম", "মশলা", 290, 340, "🌶️", "", "নতুন", 60, true, "ঝাল ও সুগন্ধি মরিচ গুঁড়া।"],
      [6, "ঘি (খাঁটি গাওয়া)", "৫০০ গ্রাম", "ঘি", 890, 1050, "🧈", "", "", 20, true, "গাওয়া দুধের মাখন থেকে তৈরি খাঁটি ঘি।"]
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

/* ---------- পাবলিক GET ---------- */
function doGet(e) {
  const a = (e && e.parameter && e.parameter.action) || "";
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (a === "products") {
      const ratings = ratingMap(ss);
      const products = readTable(ss.getSheetByName("Products"), PRODUCT_COLS)
        .filter((p) => isTrue(p.active))
        .map((p) => publicProduct(p, ratings[String(p.id)]));
      const slides = readTable(ss.getSheetByName("Slides"), SLIDE_COLS)
        .filter((x) => isTrue(x.active)).slice(0, MAX_SLIDES).map(publicSlide);
      return json({ ok: true, products: products, settings: getSettings(ss), slides: slides, featured: featuredReviews(ss), categories: publicCategories(ss) });
    }
    if (a === "reviews") return json(listReviews(ss, e.parameter.productId));
    if (a === "track") return json(trackOrder(e.parameter.id, e.parameter.phone));
    return ContentService.createTextOutput("খাঁটিঘর সার্ভার চালু আছে ✅");
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
    if (data.action === "coupon") return json(checkCoupon(data.code, Number(data.subtotal) || 0));
    if (data.action === "review") return json(submitReview(data));
    if (data.action === "admin") return json(adminAction(data));
    return json({ ok: false, error: "অজানা অনুরোধ" });
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
    if (name.length < 3) return { ok: false, error: "সঠিক নাম দিন" };
    if (!/^01[3-9]\d{8}$/.test(phone)) return { ok: false, error: "সঠিক মোবাইল নম্বর দিন" };
    if (address.length < 10) return { ok: false, error: "সম্পূর্ণ ঠিকানা দিন" };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "সঠিক ইমেইল দিন অথবা ঘরটি ফাঁকা রাখুন" };
    if (!Array.isArray(d.items) || !d.items.length || d.items.length > 30) return { ok: false, error: "কার্ট খালি" };

    // সাম্প্রতিক অর্ডার ডুপ্লিকেট আটকানো (একই ফোন ৩০ সেকেন্ডে)
    const orders = ss.getSheetByName("Orders");
    const cache = CacheService.getScriptCache();
    if (cache.get("o" + phone)) return { ok: false, error: "একটু অপেক্ষা করে আবার চেষ্টা করুন" };

    const pSheet = ss.getSheetByName("Products");
    const products = readTable(pSheet, PRODUCT_COLS);
    let subtotal = 0;
    const lines = [], stockChanges = [];
    for (const it of d.items) {
      const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
      const idx = products.findIndex((p) => String(p.id) === String(it.id) && isTrue(p.active));
      if (idx < 0) return { ok: false, error: "একটি পণ্য আর পাওয়া যাচ্ছে না" };
      const p = products[idx];
      if (Number(p.stock) < qty) return { ok: false, error: p.name + " এর স্টক মাত্র " + p.stock + " টি আছে" };
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
    if (payMethod !== "cod" && trxId.length < 6) return { ok: false, error: "পেমেন্টের ট্রানজেকশন আইডি দিন" };

    const total = subtotal + delivery - discount;
    const orderId = "KG" + Utilities.formatDate(new Date(), "Asia/Dhaka", "yyMMdd") + "-" + (orders.getLastRow() + 100);
    const itemsText = lines.map((l) => l.name + " (" + l.unit + ") x" + l.qty).join(", ");
    const areaText = area === "inside" ? "ঢাকার ভিতরে" : "ঢাকার বাইরে";
    const note = str(d.note, 300);
    orders.appendRow([
      orderId,
      Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy hh:mm a"),
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

function checkCoupon(code, subtotal) {
  code = String(code || "").trim().toUpperCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const c = readTable(ss.getSheetByName("Coupons"), COUPON_COLS)
    .find((x) => String(x.code).toUpperCase() === code && isTrue(x.active));
  if (!c) return { ok: false, error: "কুপন কোডটি সঠিক নয়" };
  if (subtotal < Number(c.minOrder || 0)) return { ok: false, error: "এই কুপনের জন্য ন্যূনতম অর্ডার ৳" + c.minOrder };
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
  if (!o) return { ok: false, error: "অর্ডার খুঁজে পাওয়া যায়নি। আইডি ও মোবাইল নম্বর মিলিয়ে দেখুন।" };
  return { ok: true, order: { orderId: o.orderId, date: o.date, items: o.items, total: o.total, status: o.status, payMethod: o.payMethod } };
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

// হোমপেজের "ক্রেতাদের কথা": অনুমোদিত, ৪★+ ও লেখাসহ সর্বশেষ ৬টি
function featuredReviews(ss) {
  const names = {};
  readTable(ss.getSheetByName("Products"), PRODUCT_COLS).forEach((p) => { names[String(p.id)] = p.name; });
  return readTable(ss.getSheetByName("Reviews"), REVIEW_COLS)
    .filter((r) => r.status === "approved" && Number(r.rating) >= 4 && String(r.text).trim().length >= 15)
    .reverse().slice(0, 6)
    .map((r) => ({ name: r.name, rating: Number(r.rating), text: r.text, verified: isTrue(r.verified), product: names[String(r.productId)] || "" }));
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
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rating = parseInt(d.rating, 10);
    if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "১ থেকে ৫ স্টারের মধ্যে রেটিং দিন" };
    const text = str(d.text, 500);
    const phone = String(d.phone || "").replace(/\D/g, "");
    const orderId = String(d.orderId || "").trim().toUpperCase();
    const order = readTable(ss.getSheetByName("Orders"), ORDER_COLS)
      .find((o) => String(o.orderId).toUpperCase() === orderId && String(o.phone).replace(/\D/g, "") === phone);
    if (!order) return { ok: false, error: "অর্ডার আইডি ও মোবাইল নম্বর মেলেনি" };
    if (order.status !== "ডেলিভারড") return { ok: false, error: "পণ্য ডেলিভারি হওয়ার পর রিভিউ দিতে পারবেন" };
    let lines = [];
    try { lines = JSON.parse(order.itemsJson); } catch (e) { /* ignore */ }
    if (!lines.some((l) => String(l.id) === String(d.productId))) return { ok: false, error: "এই অর্ডারে এই পণ্যটি নেই" };

    const sh = ss.getSheetByName("Reviews");
    const rows = readTable(sh, REVIEW_COLS);
    if (rows.some((r) => String(r.productId) === String(d.productId) && String(r.orderId).toUpperCase() === orderId)) {
      return { ok: false, error: "এই অর্ডারের জন্য আপনি আগেই রিভিউ দিয়েছেন" };
    }
    const firstName = String(order.name).split(/\s+/)[0];
    sh.appendRow([
      "R" + (rows.length + 1) + "-" + Utilities.formatDate(new Date(), "Asia/Dhaka", "yyMMddHHmm"),
      d.productId, orderId, clean(firstName), rating, clean(text),
      Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy"), "pending", true
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
  try { return fn(); } catch (err) { Logger.log("নোটিফিকেশন ব্যর্থ: " + err); return null; }
}

const taka = (n) => "৳" + Number(n || 0).toLocaleString("en-US");
const payText = { cod: "ক্যাশ অন ডেলিভারি", bkash: "বিকাশ", nagad: "নগদ" };
function h(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function notifyNewOrder(o) {
  const n = getNotify();
  const adminTo = n.adminEmail || Session.getEffectiveUser().getEmail();
  if (n.emailAdmin && adminTo) {
    MailApp.sendEmail({
      to: adminTo, name: SHOP_NAME,
      subject: "🛒 নতুন অর্ডার " + o.orderId + " — " + taka(o.total),
      htmlBody: orderEmailHtml(o, "নতুন অর্ডার এসেছে", true)
    });
  }
  if (n.emailCustomer && o.email) {
    MailApp.sendEmail({
      to: o.email, name: SHOP_NAME,
      subject: "আপনার অর্ডার " + o.orderId + " গ্রহণ করা হয়েছে",
      htmlBody: orderEmailHtml(o, "ধন্যবাদ " + o.name + "! আপনার অর্ডার গ্রহণ করা হয়েছে", false)
    });
  }
  if (n.smsAdmin && n.adminPhone) {
    sendSms(n, n.adminPhone, "নতুন অর্ডার " + o.orderId + ": " + o.name + ", " + o.phone + ", " + taka(o.total));
  }
  if (n.smsCustomer) {
    sendSms(n, o.phone, "ধন্যবাদ " + o.name + "! আপনার অর্ডার " + o.orderId + " গ্রহণ করা হয়েছে। মোট " + taka(o.total) + "। শীঘ্রই কল করে কনফার্ম করা হবে। - " + SHOP_NAME);
  }
}

function notifyStatus(order, status) {
  const n = getNotify();
  if (!n.statusNotify) return;
  const text = {
    "কনফার্মড": "আপনার অর্ডার " + order.orderId + " কনফার্ম হয়েছে। শীঘ্রই পাঠানো হবে।",
    "শিপড": "আপনার অর্ডার " + order.orderId + " শিপ করা হয়েছে। শীঘ্রই পৌঁছে যাবে।",
    "ডেলিভারড": "আপনার অর্ডার " + order.orderId + " ডেলিভারি সম্পন্ন হয়েছে। ধন্যবাদ! পণ্য কেমন লাগল জানাতে ওয়েবসাইটে রিভিউ দিন।",
    "বাতিল": "আপনার অর্ডার " + order.orderId + " বাতিল করা হয়েছে। প্রশ্ন থাকলে আমাদের কল করুন।"
  }[status];
  if (!text) return;
  const phone = String(order.phone).replace(/\D/g, "");
  if (n.smsCustomer && phone) safe(() => sendSms(n, phone, text + " - " + SHOP_NAME));
  if (n.emailCustomer && order.email) {
    safe(() => MailApp.sendEmail({
      to: order.email, name: SHOP_NAME, subject: "অর্ডার " + order.orderId + " — " + status,
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
    : "<p style='margin:12px 0;color:#555'>আমরা শীঘ্রই ফোন করে অর্ডার কনফার্ম করব।</p>";
  return "<div style='font-family:sans-serif;max-width:560px;margin:auto;border:1px solid #e6e2d6;border-radius:12px;overflow:hidden'>" +
    "<div style='background:#123f24;color:#fff;padding:14px 18px;font-size:18px'>🌿 " + SHOP_NAME + "</div>" +
    "<div style='padding:18px'><h3 style='margin:0 0 6px;color:#123f24'>" + h(title) + "</h3>" +
    "<p style='margin:0;color:#555'>অর্ডার আইডি: <b>" + h(o.orderId) + "</b></p>" + customer +
    "<table style='width:100%;border-collapse:collapse;font-size:14px'><tr style='background:#e8f4ec'><th style='padding:6px 8px;text-align:left'>পণ্য</th><th>পরিমাণ</th><th style='text-align:right;padding:6px 8px'>মূল্য</th></tr>" + rows + "</table>" +
    "<p style='text-align:right;margin:10px 0 0'>পণ্য: " + taka(o.subtotal) + " · ডেলিভারি: " + taka(o.delivery) +
    (o.discount ? " · ছাড়: −" + taka(o.discount) : "") + "<br><b style='font-size:18px;color:#123f24'>সর্বমোট: " + taka(o.total) + "</b></p>" +
    "<p style='color:#555'>পেমেন্ট: " + h(payText[o.payMethod] || o.payMethod) + (o.trxId ? " (TrxID: " + h(o.trxId) + ")" : "") + "</p>" +
    "</div></div>";
}

// {key} {sender} {number} (8801...) {number_local} (01...) {message} বসিয়ে URL বানায়
function sendSms(n, phone, message) {
  if (!n.smsUrl) throw new Error("SMS গেটওয়ে URL দেওয়া নেই");
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
function adminAction(d) {
  const pass = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!pass || String(d.password) !== pass) return { ok: false, error: "পাসওয়ার্ড ভুল", auth: false };
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
  if (ctx.after) safe(ctx.after); // ধীর কাজ (SMS/ইমেইল) লক ছাড়ার পরে
  return ctx.result || res;
}

function adminDispatch(d, ss, ctx) {
  switch (d.cmd) {
    case "login":
      return { ok: true };
    case "orders": {
      const rows = readTable(ss.getSheetByName("Orders"), ORDER_COLS).reverse();
      return { ok: true, orders: rows, statuses: STATUSES };
    }
    case "setStatus": {
      if (STATUSES.indexOf(d.status) < 0) return { ok: false, error: "ভুল স্ট্যাটাস" };
      const sh = ss.getSheetByName("Orders");
      const rows = readTable(sh, ORDER_COLS);
      const i = rows.findIndex((r) => r.orderId === d.orderId);
      if (i < 0) return { ok: false, error: "অর্ডার পাওয়া যায়নি" };
      const old = rows[i].status;
      sh.getRange(i + 2, ORDER_COLS.indexOf("status") + 1).setValue(d.status);
      // বাতিল করলে স্টক ফেরত, বাতিল থেকে ফিরলে আবার কমানো
      if ((old === "বাতিল") !== (d.status === "বাতিল")) adjustStock(ss, rows[i].itemsJson, d.status === "বাতিল" ? 1 : -1);
      if (old !== d.status && d.silent !== true) ctx.after = () => notifyStatus(rows[i], d.status);
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
      if (cats.length && cats.indexOf(cat) < 0) return { ok: false, error: "তালিকা থেকে একটি ক্যাটাগরি বেছে নিন" };
      const vals = [
        p.id, str(p.name, 100), str(p.unit, 40), cat,
        Number(p.price) || 0, Number(p.oldPrice) || 0, str(p.emoji, 8), str(p.image, 500),
        str(p.tag, 30), Number(p.stock) || 0, p.active === false || p.active === "false" ? false : true,
        str(p.desc, 600)
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
      if (!sh) return { ok: false, error: "আগে Apps Script এ setup চালান" };
      const c = d.category || {};
      const name = clean(str(c.name, 40)), emoji = str(c.emoji, 8), oldName = str(c.oldName, 40);
      if (!name) return { ok: false, error: "ক্যাটাগরির নাম দিন" };
      const rows = readTable(sh, CATEGORY_COLS);
      const dup = rows.findIndex((r) => String(r.name).trim().toLowerCase() === name.toLowerCase() && String(r.name).trim() !== oldName);
      if (dup >= 0) return { ok: false, error: "এই নামের ক্যাটাগরি আগেই আছে" };
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
      if (used) return { ok: false, error: "এই ক্যাটাগরিতে " + used + "টি পণ্য আছে। আগে পণ্যগুলো অন্য ক্যাটাগরিতে সরান বা মুছুন।" };
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
    case "coupons":
      return { ok: true, coupons: readTable(ss.getSheetByName("Coupons"), COUPON_COLS) };
    case "saveCoupon": {
      const sh = ss.getSheetByName("Coupons");
      const c = d.coupon || {};
      const code = str(c.code, 30).toUpperCase();
      if (!code) return { ok: false, error: "কোড দিন" };
      const vals = [code, c.type === "flat" ? "flat" : "percent", Number(c.value) || 0, Number(c.minOrder) || 0, c.active !== false];
      const i = readTable(sh, COUPON_COLS).findIndex((r) => String(r.code).toUpperCase() === code);
      if (i >= 0) sh.getRange(i + 2, 1, 1, COUPON_COLS.length).setValues([vals]);
      else sh.appendRow(vals);
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
      if (![link, d1, m1].every(safeUrl)) return { ok: false, error: "লিংক/ছবির ঠিকানা সঠিক নয় (http://, https:// বা # দিয়ে শুরু হতে হবে)" };
      const theme = ["green", "gold", "teal"].indexOf(x.theme) >= 0 ? x.theme : "green";
      if (!d1 && !str(x.title, 140) && !str(x.badge, 60)) return { ok: false, error: "ছবি অথবা অন্তত একটি শিরোনাম দিন" };
      const i = x.slideId ? rows.findIndex((r) => r.slideId === x.slideId) : -1;
      if (i < 0 && rows.length >= MAX_SLIDES) return { ok: false, error: "সর্বোচ্চ " + MAX_SLIDES + "টি স্লাইড রাখা যায়। আগে একটি মুছুন।" };
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
      if (!b64) return { ok: false, error: "ছবি পাওয়া যায়নি" };
      if (b64.length > 4200000) return { ok: false, error: "ছবি খুব বড় (৩ MB এর নিচে রাখুন)" };
      const bytes = Utilities.base64Decode(b64);
      const mime = imageMime(bytes);
      if (!mime) return { ok: false, error: "শুধু JPG, PNG বা WebP ছবি দেওয়া যাবে" };
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
      if (REVIEW_STATUSES.indexOf(d.status) < 0) return { ok: false, error: "ভুল স্ট্যাটাস" };
      const sh = ss.getSheetByName("Reviews");
      const i = readTable(sh, REVIEW_COLS).findIndex((r) => r.reviewId === d.reviewId);
      if (i < 0) return { ok: false, error: "রিভিউ পাওয়া যায়নি" };
      sh.getRange(i + 2, REVIEW_COLS.indexOf("status") + 1).setValue(d.status);
      return { ok: true };
    }
    case "saveReview": { // অ্যাডমিন নিজে (যেমন ফেসবুক থেকে পাওয়া) রিভিউ যোগ করবেন
      const r = d.review || {};
      const rating = parseInt(r.rating, 10);
      if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "১-৫ রেটিং দিন" };
      if (!str(r.name, 40)) return { ok: false, error: "ক্রেতার নাম দিন" };
      const sh = ss.getSheetByName("Reviews");
      sh.appendRow([
        "R" + (sh.getLastRow() + 1) + "-m", r.productId, "manual", clean(str(r.name, 40)), rating, clean(str(r.text, 500)),
        Utilities.formatDate(new Date(), "Asia/Dhaka", "dd/MM/yyyy"), "approved", false
      ]);
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
      if (next.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.adminEmail)) return { ok: false, error: "সঠিক ইমেইল দিন" };
      if (next.smsUrl && !/^https?:\/\//i.test(next.smsUrl)) return { ok: false, error: "SMS URL http:// বা https:// দিয়ে শুরু হতে হবে" };
      PropertiesService.getScriptProperties().setProperty("NOTIFY", JSON.stringify(next));
      return { ok: true };
    }
    case "testNotify": {
      const n = getNotify();
      ctx.after = null;
      let msg;
      if (d.channel === "sms") {
        if (!n.adminPhone) return { ok: false, error: "আগে আপনার মোবাইল নম্বর দিয়ে সংরক্ষণ করুন" };
        try { msg = "SMS পাঠানো হয়েছে। গেটওয়ে উত্তর: " + sendSms(n, n.adminPhone, "টেস্ট SMS — " + SHOP_NAME + " অর্ডার নোটিফিকেশন চালু আছে ✅"); }
        catch (err) { return { ok: false, error: String(err.message || err) }; }
      } else {
        const to = n.adminEmail || Session.getEffectiveUser().getEmail();
        try { MailApp.sendEmail({ to: to, name: SHOP_NAME, subject: "টেস্ট ইমেইল — " + SHOP_NAME, htmlBody: "<p>✅ ইমেইল নোটিফিকেশন ঠিকভাবে চলছে।</p>" }); }
        catch (err) { return { ok: false, error: String(err.message || err) }; }
        msg = "টেস্ট ইমেইল পাঠানো হয়েছে: " + to;
      }
      return { ok: true, message: msg };
    }
  }
  return { ok: false, error: "অজানা কমান্ড" };
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

function readTable(sh, cols) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().map((r) => {
    const o = {};
    cols.forEach((c, i) => { o[c] = r[i]; });
    return o;
  });
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
    desc: p.desc || "",
    rating: rt ? Math.round(rt.sum / rt.count * 10) / 10 : 0,
    reviews: rt ? rt.count : 0
  };
}

const isTrue = (v) => v === true || String(v).toUpperCase() === "TRUE";
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
function clean(v) { v = String(v || ""); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
