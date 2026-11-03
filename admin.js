const API = SITE_API_URL;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "৳" + Number(n || 0).toLocaleString("en-US");
const STATUSES = ["নতুন", "কনফার্মড", "শিপড", "ডেলিভারড", "বাতিল"];
const PAY = { cod: "ক্যাশ অন ডেলিভারি", bkash: "বিকাশ", nagad: "নগদ" };

const S = { orders: [], products: [], categories: [], coupons: [], reviews: [], slides: [], notify: {}, settings: {}, pass: "" };
try { S.pass = sessionStorage.getItem("adminPass") || ""; } catch (e) {}

let toastTimer;
function toast(t) {
  const el = $("toast");
  el.textContent = t; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

async function call(cmd, extra) {
  if (API.includes("WEB_APP_URL")) throw new Error("config.js ফাইলে Web App URL বসানো হয়নি");
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "admin", password: S.pass, cmd, ...extra })
  });
  const r = await res.json();
  if (r.auth === false) { logout(); throw new Error(r.error); }
  if (!r.ok) throw new Error(r.error || "সমস্যা হয়েছে");
  return r;
}

/* ---------- লগইন ---------- */
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  S.pass = $("pass").value;
  $("loginMsg").textContent = "যাচাই হচ্ছে...";
  try {
    await call("login");
    try { sessionStorage.setItem("adminPass", S.pass); } catch (err) {}
    $("loginMsg").textContent = "";
    start();
  } catch (err) {
    $("loginMsg").className = "form-msg err";
    $("loginMsg").textContent = "⚠️ " + (err.message === "Failed to fetch" ? "সার্ভারে সংযোগ হয়নি" : err.message);
  }
});

function logout() {
  S.pass = "";
  try { sessionStorage.removeItem("adminPass"); } catch (e) {}
  $("app").hidden = true;
  $("login").hidden = false;
}
$("logout").addEventListener("click", logout);

async function start() {
  $("login").hidden = true;
  $("app").hidden = false;
  await loadAll();
}

async function loadAll() {
  try {
    const [o, p, c, s, rv, nt, sd, ct] = await Promise.all([call("orders"), call("products"), call("coupons"), call("settings"), call("reviews"), call("notify"), call("slides"), call("categories")]);
    S.orders = o.orders; S.products = p.products; S.coupons = c.coupons; S.settings = s.settings;
    S.reviews = rv.reviews; S.notify = nt.notify; S.slides = sd.slides; S.categories = ct.categories;
    renderAll();
  } catch (e) { toast("⚠️ " + e.message); }
}
$("refresh").addEventListener("click", async () => { await loadAll(); toast("আপডেট হয়েছে"); });

function renderAll() { renderDash(); renderOrders(); renderCategories(); renderProducts(); renderCoupons(); renderReviews(); renderNotify(); renderSettings(); renderSlides(); renderCharts(); }

/* ---------- ট্যাব ---------- */
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("active", x === b));
  document.querySelectorAll(".a-main > section").forEach((s) => { s.hidden = s.id !== "tab-" + b.dataset.tab; });
});

/* ---------- ড্যাশবোর্ড ---------- */
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function renderDash() {
  const valid = S.orders.filter((o) => o.status !== "বাতিল");
  const today = S.orders.filter((o) => String(o.date).startsWith(todayStr()));
  const todayValid = today.filter((o) => o.status !== "বাতিল");
  const sum = (a) => a.reduce((s, o) => s + Number(o.total || 0), 0);
  const stats = [
    ["আজকের অর্ডার", today.length],
    ["আজকের বিক্রি", money(sum(todayValid))],
    ["নতুন (পেন্ডিং)", S.orders.filter((o) => o.status === "নতুন").length, "warn"],
    ["মোট অর্ডার", S.orders.length],
    ["মোট বিক্রি", money(sum(valid.filter((o) => o.status === "ডেলিভারড")))],
    ["মোট পণ্য", S.products.length],
    ["রিভিউ অনুমোদনের অপেক্ষায়", S.reviews.filter((r) => r.status === "pending").length, S.reviews.some((r) => r.status === "pending") ? "warn" : ""]
  ];
  $("stats").innerHTML = stats.map(([l, v, c]) => `<div class="stat ${c || ""}"><small>${l}</small><b>${v}</b></div>`).join("");

  const low = S.products.filter((p) => Number(p.stock) <= 5);
  $("lowStock").innerHTML = low.length
    ? low.map((p) => `<div>${esc(p.emoji)} ${esc(p.name)} — <b style="color:#d93025">${p.stock} টি</b></div>`).join("")
    : "সব পণ্যের স্টক ঠিক আছে ✅";
  $("recent").innerHTML = S.orders.slice(0, 5).map((o) =>
    `<div>${esc(o.orderId)} · ${esc(o.name)} · ${money(o.total)} · <span class="pill">${esc(o.status)}</span></div>`).join("") || "কোনো অর্ডার নেই";
}

/* ---------- অর্ডার ---------- */
$("oStatus").innerHTML = `<option value="">সব স্ট্যাটাস</option>` + STATUSES.map((s) => `<option>${s}</option>`).join("");
$("oSearch").addEventListener("input", renderOrders);
$("oStatus").addEventListener("change", renderOrders);

function renderOrders() {
  const q = $("oSearch").value.trim().toLowerCase();
  const st = $("oStatus").value;
  const list = S.orders.filter((o) =>
    (!st || o.status === st) &&
    (!q || [o.orderId, o.name, o.phone].join(" ").toLowerCase().includes(q)));
  $("ordersList").innerHTML = list.map((o) => {
    const wa = "88" + String(o.phone).replace(/\D/g, "");
    return `
    <article class="order s-${esc(o.status)}">
      <div class="o-top"><b>${esc(o.orderId)}</b><span class="o-meta">${esc(o.date)}</span></div>
      <div><b>${esc(o.name)}</b> · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>${o.email ? ` · ✉️ ${esc(o.email)}` : ""}</div>
      <div class="o-meta">📍 ${esc(o.address)} (${esc(o.area)})</div>
      <div class="o-items">🛒 ${esc(o.items)}</div>
      <div class="o-meta">
        পণ্য ${money(o.subtotal)} + ডেলিভারি ${money(o.delivery)}${o.discount ? ` − ছাড় ${money(o.discount)} (${esc(o.coupon)})` : ""}
        = <b>${money(o.total)}</b> · ${esc(PAY[o.payMethod] || o.payMethod)}${o.trxId ? ` · TrxID: <b>${esc(o.trxId)}</b>` : ""}
      </div>
      ${o.note ? `<div class="o-meta">📝 ${esc(o.note)}</div>` : ""}
      <div class="o-actions">
        <select data-status="${esc(o.orderId)}">${STATUSES.map((s) => `<option${s === o.status ? " selected" : ""}>${s}</option>`).join("")}</select>
        <a href="https://wa.me/${wa}?text=${encodeURIComponent(`আসসালামু আলাইকুম ${o.name}, আপনার অর্ডার ${o.orderId} এর স্ট্যাটাস: ${o.status}।`)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <button data-print="${esc(o.orderId)}">🖨️ ইনভয়েস</button>
      </div>
    </article>`;
  }).join("") || `<div class="a-card">কোনো অর্ডার পাওয়া যায়নি।</div>`;
}

$("ordersList").addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-status]");
  if (!sel) return;
  sel.disabled = true;
  try {
    await call("setStatus", { orderId: sel.dataset.status, status: sel.value });
    toast("✅ স্ট্যাটাস আপডেট হয়েছে");
    await loadAll();
  } catch (err) { toast("⚠️ " + err.message); sel.disabled = false; }
});

$("ordersList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-print]");
  if (b) printInvoice(S.orders.find((o) => o.orderId === b.dataset.print));
});

function printInvoice(o) {
  if (!o) return;
  let lines = [];
  try { lines = JSON.parse(o.itemsJson); } catch (e) {}
  const w = window.open("", "_blank");
  if (!w) return toast("পপ-আপ অনুমতি দিন");
  w.document.write(`<!DOCTYPE html><html lang="bn"><meta charset="utf-8"><title>ইনভয়েস ${esc(o.orderId)}</title>
  <style>body{font-family:sans-serif;max-width:640px;margin:20px auto;padding:0 12px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;text-align:left}.r{text-align:right}h2{margin:0}</style>
  <h2>🌿 খাঁটিঘর</h2><p>ফোন: ${esc(S.settings.phone)}</p><hr>
  <p><b>অর্ডার:</b> ${esc(o.orderId)} &nbsp; <b>তারিখ:</b> ${esc(o.date)}</p>
  <p><b>গ্রাহক:</b> ${esc(o.name)}<br><b>মোবাইল:</b> ${esc(o.phone)}<br><b>ঠিকানা:</b> ${esc(o.address)}</p>
  <table><tr><th>পণ্য</th><th class="r">দাম</th><th class="r">পরিমাণ</th><th class="r">মোট</th></tr>
  ${lines.map((l) => `<tr><td>${esc(l.name)} (${esc(l.unit)})</td><td class="r">${money(l.price)}</td><td class="r">${l.qty}</td><td class="r">${money(l.price * l.qty)}</td></tr>`).join("")}
  <tr><td colspan="3" class="r">সাবটোটাল</td><td class="r">${money(o.subtotal)}</td></tr>
  <tr><td colspan="3" class="r">ডেলিভারি</td><td class="r">${money(o.delivery)}</td></tr>
  ${o.discount ? `<tr><td colspan="3" class="r">ছাড়</td><td class="r">−${money(o.discount)}</td></tr>` : ""}
  <tr><td colspan="3" class="r"><b>সর্বমোট</b></td><td class="r"><b>${money(o.total)}</b></td></tr></table>
  <p><b>পেমেন্ট:</b> ${esc(PAY[o.payMethod] || o.payMethod)} ${o.payMethod === "cod" ? "— ডেলিভারিতে " + money(o.total) + " নিন" : ""}</p>
  <p>ধন্যবাদ! 🙏</p><script>onload=()=>print()<\/script>`);
  w.document.close();
}

$("csvBtn").addEventListener("click", () => {
  const cols = ["orderId", "date", "name", "phone", "address", "area", "items", "subtotal", "delivery", "discount", "coupon", "total", "payMethod", "trxId", "note", "status"];
  const cell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const csv = "﻿" + [cols.join(",")].concat(S.orders.map((o) => cols.map((c) => cell(c === "phone" ? "\t" + o[c] : o[c])).join(","))).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "orders.csv";
  a.click();
});

/* ---------- মডাল ---------- */
const modal = $("modal"), modalForm = $("modalForm");
function openModal(html, onSave) {
  modalForm.innerHTML = html + `<p class="form-msg err" id="mErr"></p>
    <div class="mbtns"><button type="button" class="btn btn-outline" id="mCancel">বাতিল</button><button type="submit" class="btn">💾 সংরক্ষণ</button></div>`;
  modalForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = modalForm.querySelector("[type=submit]");
    btn.disabled = true;
    try { await onSave(new FormData(modalForm)); modal.close(); await loadAll(); toast("✅ সংরক্ষিত"); }
    catch (err) { $("mErr").textContent = "⚠️ " + err.message; }
    btn.disabled = false;
  };
  $("mCancel").onclick = () => modal.close();
  modal.showModal();
}

/* ---------- ক্যাটাগরি ---------- */
function renderCategories() {
  $("catTable").innerHTML = `<tr><th>আইকন</th><th>নাম</th><th>পণ্য</th><th>ক্রম</th><th></th></tr>` +
    (S.categories.map((c, i) => `<tr>
      <td>${esc(c.emoji || "🗂️")}</td><td><b>${esc(c.name)}</b></td><td>${c.count}</td>
      <td class="acts"><button data-cmove="${esc(c.name)}" data-dir="-1"${i === 0 ? " disabled" : ""}>⬆️</button> <button data-cmove="${esc(c.name)}" data-dir="1"${i === S.categories.length - 1 ? " disabled" : ""}>⬇️</button></td>
      <td class="acts"><button data-cgedit="${esc(c.name)}">✏️</button> <button data-cgdel="${esc(c.name)}">🗑️</button></td>
    </tr>`).join("") || `<tr><td colspan="5">এখনো কোনো ক্যাটাগরি নেই — "➕ নতুন ক্যাটাগরি" চাপুন</td></tr>`);
}

function categoryModal(c) {
  c = c || { name: "", emoji: "" };
  openModal(`<h3>${c.name ? "ক্যাটাগরি এডিট" : "নতুন ক্যাটাগরি"}</h3>
    <label>ক্যাটাগরির নাম *<input name="name" required maxlength="40" placeholder="যেমন: কিচেন অ্যাপলায়েন্স" value="${esc(c.name)}"></label>
    <label>আইকন (ইমোজি, ঐচ্ছিক)<input name="emoji" maxlength="8" placeholder="🍳" value="${esc(c.emoji)}"></label>
    ${c.name ? `<p class="a-hint">নাম বদলালে এই ক্যাটাগরির সব পণ্যের ক্যাটাগরিও নিজে বদলে যাবে।</p>` : ""}`,
  async (fd) => {
    await call("saveCategory", { category: { name: fd.get("name"), emoji: fd.get("emoji"), oldName: c.name } });
  });
}

// পণ্যের ফর্মের ড্রপডাউন: শুধু তৈরি করা ক্যাটাগরি থেকে বাছাই
function categorySelect(current) {
  const names = S.categories.map((c) => c.name);
  if (current && names.indexOf(current) < 0) names.push(current); // পুরনো/অনুপস্থিত মান হারাবে না
  if (!names.length) return `<select name="category" required disabled><option value="">আগে "ক্যাটাগরি" ট্যাবে ক্যাটাগরি যোগ করুন</option></select>`;
  return `<select name="category" required><option value="">— ক্যাটাগরি বাছুন —</option>` +
    names.map((n) => `<option value="${esc(n)}"${n === current ? " selected" : ""}>${esc(n)}</option>`).join("") + `</select>`;
}

$("addCategory").addEventListener("click", () => categoryModal());
$("catTable").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-cgedit]"), del = e.target.closest("[data-cgdel]"), mv = e.target.closest("[data-cmove]");
  try {
    if (ed) categoryModal(S.categories.find((c) => c.name === ed.dataset.cgedit));
    if (mv) { await call("moveCategory", { name: mv.dataset.cmove, dir: Number(mv.dataset.dir) }); await loadAll(); }
    if (del && confirm("ক্যাটাগরিটি মুছে ফেলবেন?")) { await call("deleteCategory", { name: del.dataset.cgdel }); toast("মুছে ফেলা হয়েছে"); await loadAll(); }
  } catch (err) { toast("⚠️ " + err.message); }
});

/* ---------- পণ্য ---------- */
function renderProducts() {
  $("prodTable").innerHTML = `<tr><th>ছবি</th><th>নাম</th><th>ক্যাটাগরি</th><th>দাম</th><th>স্টক</th><th>অবস্থা</th><th></th></tr>` +
    S.products.map((p) => `<tr>
      <td>${p.image ? `<img src="${esc(p.image)}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:6px">` : esc(p.emoji)}</td>
      <td>${esc(p.name)}<br><small>${esc(p.unit)}</small></td><td>${esc(p.category)}</td>
      <td>${money(p.price)} <small><del>${p.oldPrice ? money(p.oldPrice) : ""}</del></small></td>
      <td style="${Number(p.stock) <= 5 ? "color:#d93025;font-weight:700" : ""}">${p.stock}</td>
      <td><span class="pill ${String(p.active).toUpperCase() === "TRUE" ? "" : "off"}">${String(p.active).toUpperCase() === "TRUE" ? "চালু" : "বন্ধ"}</span></td>
      <td class="acts"><button data-edit="${esc(p.id)}">✏️</button> <button data-del="${esc(p.id)}">🗑️</button></td>
    </tr>`).join("");
}

function productModal(p) {
  p = p || { name: "", unit: "", category: "", price: "", oldPrice: "", emoji: "🛒", image: "", tag: "", desc: "", stock: 10, active: true };
  const act = String(p.active).toUpperCase() !== "FALSE";
  openModal(`<h3>${p.id ? "পণ্য এডিট" : "নতুন পণ্য"}</h3>
    <label>পণ্যের নাম *<input name="name" required value="${esc(p.name)}"></label>
    <div class="row2"><label>ওজন/একক<input name="unit" placeholder="৫০০ গ্রাম" value="${esc(p.unit)}"></label>
    <label>ক্যাটাগরি *${categorySelect(p.category)}</label></div>
    <div class="row2"><label>বিক্রয় মূল্য *<input name="price" type="number" min="0" required value="${esc(p.price)}"></label>
    <label>আগের দাম<input name="oldPrice" type="number" min="0" value="${esc(p.oldPrice)}"></label></div>
    <div class="row2"><label>স্টক *<input name="stock" type="number" min="0" required value="${esc(p.stock)}"></label>
    <label>ইমোজি<input name="emoji" value="${esc(p.emoji)}"></label></div>
    <div class="img-field"><b style="font-size:.95rem">ছবি (ঐচ্ছিক) — সঠিক মাপ 800×800</b>
      <div class="img-prev has-slot" data-prev="image" style="--ar:1/1;max-width:140px"><span>ছবি নেই</span></div>
      <div class="img-row"><input name="image" placeholder="https://... অথবা আপলোড করুন" value="${esc(p.image)}"><button type="button" class="up-btn" data-upload="image" data-w="800" data-h="800">⬆️ আপলোড</button></div></div>
    <label>ট্যাগ (যেমন: নতুন)<input name="tag" value="${esc(p.tag)}"></label>
    <label>বিবরণ (পণ্যের পপ-আপে দেখাবে)<textarea name="desc" rows="3" maxlength="600">${esc(p.desc)}</textarea></label>
    <label class="pay-opt"><input type="checkbox" name="active"${act ? " checked" : ""}> ওয়েবসাইটে দেখান</label>`,
  async (fd) => {
    const product = Object.fromEntries(fd.entries());
    product.id = p.id || "";
    product.active = fd.has("active");
    await call("saveProduct", { product });
  });
}

$("addProduct").addEventListener("click", () => productModal());
$("prodTable").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
  if (ed) productModal(S.products.find((p) => String(p.id) === ed.dataset.edit));
  if (del && confirm("এই পণ্যটি মুছে ফেলবেন? (পুরনো অর্ডার ঠিক থাকবে)")) {
    try { await call("deleteProduct", { id: del.dataset.del }); toast("মুছে ফেলা হয়েছে"); await loadAll(); }
    catch (err) { toast("⚠️ " + err.message); }
  }
});

/* ---------- কুপন ---------- */
function renderCoupons() {
  $("couponTable").innerHTML = `<tr><th>কোড</th><th>ধরন</th><th>মান</th><th>ন্যূনতম অর্ডার</th><th>অবস্থা</th><th></th></tr>` +
    S.coupons.map((c) => `<tr><td><b>${esc(c.code)}</b></td><td>${c.type === "flat" ? "টাকা" : "শতাংশ"}</td>
      <td>${c.type === "flat" ? money(c.value) : c.value + "%"}</td><td>${money(c.minOrder)}</td>
      <td><span class="pill ${String(c.active).toUpperCase() === "TRUE" ? "" : "off"}">${String(c.active).toUpperCase() === "TRUE" ? "চালু" : "বন্ধ"}</span></td>
      <td class="acts"><button data-cedit="${esc(c.code)}">✏️</button> <button data-cdel="${esc(c.code)}">🗑️</button></td></tr>`).join("");
}

function couponModal(c) {
  c = c || { code: "", type: "percent", value: 10, minOrder: 0, active: true };
  openModal(`<h3>${c.code ? "কুপন এডিট" : "নতুন কুপন"}</h3>
    <label>কোড *<input name="code" required ${c.code ? "readonly" : ""} value="${esc(c.code)}" style="text-transform:uppercase"></label>
    <label>ধরন<select name="type"><option value="percent"${c.type !== "flat" ? " selected" : ""}>শতাংশ (%)</option><option value="flat"${c.type === "flat" ? " selected" : ""}>নির্দিষ্ট টাকা (৳)</option></select></label>
    <div class="row2"><label>মান *<input name="value" type="number" min="1" required value="${esc(c.value)}"></label>
    <label>ন্যূনতম অর্ডার (৳)<input name="minOrder" type="number" min="0" value="${esc(c.minOrder)}"></label></div>
    <label class="pay-opt"><input type="checkbox" name="active"${String(c.active).toUpperCase() !== "FALSE" ? " checked" : ""}> চালু আছে</label>`,
  async (fd) => {
    const coupon = Object.fromEntries(fd.entries());
    coupon.active = fd.has("active");
    await call("saveCoupon", { coupon });
  });
}

$("addCoupon").addEventListener("click", () => couponModal());
$("couponTable").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-cedit]"), del = e.target.closest("[data-cdel]");
  if (ed) couponModal(S.coupons.find((c) => c.code === ed.dataset.cedit));
  if (del && confirm("কুপনটি মুছে ফেলবেন?")) {
    try { await call("deleteCoupon", { code: del.dataset.cdel }); await loadAll(); }
    catch (err) { toast("⚠️ " + err.message); }
  }
});

/* ---------- সেটিংস ---------- */
function renderSettings() {
  const f = $("settingsForm");
  Object.keys(S.settings).forEach((k) => { if (f.elements[k]) f.elements[k].value = S.settings[k]; });
}
$("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const settings = Object.fromEntries(new FormData(e.target).entries());
  try {
    await call("saveSettings", { settings });
    $("setMsg").className = "form-msg ok";
    $("setMsg").textContent = "✅ সংরক্ষিত হয়েছে";
    await loadAll();
  } catch (err) {
    $("setMsg").className = "form-msg err";
    $("setMsg").textContent = "⚠️ " + err.message;
  }
});

/* ---------- রিভিউ ---------- */
const RV_LABEL = { pending: "অপেক্ষায়", approved: "অনুমোদিত", rejected: "বাতিল" };
$("rvFilter").innerHTML = `<option value="">সব রিভিউ</option>` + Object.keys(RV_LABEL).map((k) => `<option value="${k}">${RV_LABEL[k]}</option>`).join("");
$("rvFilter").addEventListener("change", renderReviews);

function renderReviews() {
  const st = $("rvFilter").value;
  const pname = (id) => (S.products.find((p) => String(p.id) === String(id)) || {}).name || "পণ্য #" + id;
  const list = S.reviews.filter((r) => !st || r.status === st);
  $("reviewList").innerHTML = list.map((r) => `
    <article class="rvc s-${esc(r.status)}">
      <div class="o-top"><b>${esc(pname(r.productId))}</b><span class="o-meta">${esc(r.date)}</span></div>
      <div><span class="rv-stars">${"★".repeat(Number(r.rating))}${"☆".repeat(5 - Number(r.rating))}</span> · <b>${esc(r.name)}</b>
        ${String(r.verified).toUpperCase() === "TRUE" ? `<span class="pill">✔ ভেরিফাইড (${esc(r.orderId)})</span>` : `<span class="pill off">ম্যানুয়াল</span>`}
        <span class="pill ${r.status === "pending" ? "warn" : r.status === "rejected" ? "off" : ""}">${RV_LABEL[r.status] || esc(r.status)}</span></div>
      ${r.text ? `<div>${esc(r.text)}</div>` : ""}
      <div class="o-actions">
        ${r.status !== "approved" ? `<button data-rvs="${esc(r.reviewId)}|approved">✅ অনুমোদন</button>` : ""}
        ${r.status !== "rejected" ? `<button data-rvs="${esc(r.reviewId)}|rejected">🚫 বাতিল</button>` : ""}
        <button data-rvdel="${esc(r.reviewId)}">🗑️ মুছুন</button>
      </div>
    </article>`).join("") || `<div class="a-card">কোনো রিভিউ নেই।</div>`;
}

$("reviewList").addEventListener("click", async (e) => {
  const s = e.target.closest("[data-rvs]"), d = e.target.closest("[data-rvdel]");
  try {
    if (s) { const [reviewId, status] = s.dataset.rvs.split("|"); await call("setReviewStatus", { reviewId, status }); toast("✅ আপডেট হয়েছে"); await loadAll(); }
    if (d && confirm("রিভিউটি মুছে ফেলবেন?")) { await call("deleteReview", { reviewId: d.dataset.rvdel }); await loadAll(); }
  } catch (err) { toast("⚠️ " + err.message); }
});

$("addReview").addEventListener("click", () => {
  openModal(`<h3>রিভিউ যোগ করুন</h3>
    <label>পণ্য *<select name="productId" required>${S.products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
    <label>ক্রেতার নাম *<input name="name" required maxlength="40" placeholder="যেমন: রাহেলা"></label>
    <label>রেটিং *<select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"★".repeat(n)} (${n})</option>`).join("")}</select></label>
    <label>মন্তব্য<textarea name="text" rows="3" maxlength="500"></textarea></label>
    <p class="a-hint">এটি সরাসরি "অনুমোদিত" হিসেবে সাইটে দেখাবে (ভেরিফাইড চিহ্ন ছাড়া)। শুধু সত্যিকারের ক্রেতার মতামত যোগ করুন।</p>`,
  async (fd) => { await call("saveReview", { review: Object.fromEntries(fd.entries()) }); });
});

/* ---------- নোটিফিকেশন ---------- */
function renderNotify() {
  const f = $("notifyForm"), n = S.notify || {};
  ["emailAdmin", "emailCustomer", "smsAdmin", "smsCustomer", "statusNotify"].forEach((k) => { f.elements[k].checked = !!n[k]; });
  ["adminEmail", "adminPhone", "smsUrl", "smsKey", "smsSender"].forEach((k) => { f.elements[k].value = n[k] || ""; });
}
const notifyPayload = () => {
  const f = $("notifyForm"), o = {};
  ["emailAdmin", "emailCustomer", "smsAdmin", "smsCustomer", "statusNotify"].forEach((k) => { o[k] = f.elements[k].checked; });
  ["adminEmail", "adminPhone", "smsUrl", "smsKey", "smsSender"].forEach((k) => { o[k] = f.elements[k].value.trim(); });
  return o;
};
const notifyMsg = (t, ok) => { $("notifyMsg").className = "form-msg " + (ok ? "ok" : "err"); $("notifyMsg").textContent = t; };

$("smsPreset").addEventListener("change", (e) => {
  const v = e.target.value;
  if (v && v !== "custom") $("notifyForm").elements.smsUrl.value = v;
  if (v === "custom") $("notifyForm").elements.smsUrl.focus();
});

$("notifyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await call("saveNotify", { notify: notifyPayload() }); notifyMsg("✅ সংরক্ষিত হয়েছে", true); await loadAll(); }
  catch (err) { notifyMsg("⚠️ " + err.message, false); }
});

async function testNotify(channel) {
  notifyMsg("পাঠানো হচ্ছে...", true);
  try {
    await call("saveNotify", { notify: notifyPayload() }); // টেস্টের আগে বর্তমান সেটিং সংরক্ষণ
    const r = await call("testNotify", { channel });
    notifyMsg("✅ " + r.message, true);
  } catch (err) { notifyMsg("⚠️ " + err.message, false); }
}
$("testEmail").addEventListener("click", () => testNotify("email"));
$("testSms").addEventListener("click", () => testNotify("sms"));

/* ---------- ছবি আপলোড (ব্রাউজারেই কেটে ছোট করে, তারপর Google Drive এ) ---------- */
async function resizeCover(file, w, h, quality = 0.86) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("ছবিটি পড়া যায়নি")); i.src = url; });
    const small = img.width < w * 0.9 || img.height < h * 0.9;
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const cx = cv.getContext("2d");
    cx.imageSmoothingQuality = "high";
    cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);
    const k = Math.max(w / img.width, h / img.height);          // কভার: পুরো ক্যানভাস ভরবে, মাঝখান থেকে কাটবে
    const dw = img.width * k, dh = img.height * k;
    cx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return { b64: cv.toDataURL("image/jpeg", quality).split(",")[1], small };
  } finally { URL.revokeObjectURL(url); }
}

function setPreview(name, url) {
  const box = modalForm.querySelector(`[data-prev="${name}"]`);
  if (!box) return;
  box.style.backgroundImage = url ? `url("${url.replace(/"/g, "%22")}")` : "";
  box.classList.toggle("has", !!url);
}

modalForm.addEventListener("click", (e) => {
  const clr = e.target.closest("[data-clear-img]");
  if (clr) { const inp = modalForm.elements[clr.dataset.clearImg]; inp.value = ""; setPreview(clr.dataset.clearImg, ""); return; }
  const btn = e.target.closest("[data-upload]");
  if (!btn) return;
  const field = btn.dataset.upload, w = +btn.dataset.w, h = +btn.dataset.h;
  const pick = document.createElement("input");
  pick.type = "file"; pick.accept = "image/jpeg,image/png,image/webp";
  pick.onchange = async () => {
    const file = pick.files[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return toast("⚠️ ছবি ১২ MB এর বেশি");
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = "⏳ আপলোড হচ্ছে...";
    try {
      const { b64, small } = await resizeCover(file, w, h);
      const r = await call("uploadImage", { data: b64, name: file.name.replace(/\.[^.]+$/, "") });
      modalForm.elements[field].value = r.url;
      setPreview(field, r.url);
      toast(small ? `⚠️ ছবি ${w}×${h} এর চেয়ে ছোট ছিল, একটু ঝাপসা হতে পারে` : "✅ ছবি আপলোড হয়েছে");
    } catch (err) { toast("⚠️ " + err.message); }
    btn.disabled = false; btn.textContent = old;
  };
  pick.click();
});
// মডাল খোলার পর বিদ্যমান ছবির প্রিভিউ দেখানো
new MutationObserver(() => {
  modalForm.querySelectorAll("[data-prev]").forEach((box) => {
    const inp = modalForm.elements[box.dataset.prev];
    if (inp && !box.dataset.bound) { box.dataset.bound = "1"; setPreview(box.dataset.prev, inp.value); inp.addEventListener("change", () => setPreview(box.dataset.prev, inp.value)); }
  });
}).observe(modalForm, { childList: true });

/* ---------- হোমপেজ স্লাইডার ম্যানেজার ---------- */
function renderSlides() {
  $("slideCount").textContent = `${S.slides.length}/5 টি স্লাইড · ক্রম বদলাতে ⬆️⬇️ চাপুন`;
  $("addSlide").disabled = S.slides.length >= 5;
  $("slideList").innerHTML = S.slides.map((x, i) => {
    const on = String(x.active).toUpperCase() === "TRUE";
    return `<div class="sl-card${on ? "" : " off"}">
      <div class="sl-thumb t-${esc(x.theme || "green")}">${x.imgDesktop ? `<img src="${esc(x.imgDesktop)}" alt="">` : esc(x.title || x.badge || "")}</div>
      <div class="sl-info"><b>${i + 1}. ${esc(x.title || x.badge || "(শুধু ছবি)")}</b>
        <small>${x.imgDesktop ? "🖼️ ছবির স্লাইড" : "🎨 ডিজাইন করা স্লাইড"}${x.imgMobile ? " · 📱 মোবাইল ছবি আছে" : ""} · ${on ? "চালু" : "বন্ধ"}${x.link ? " · 🔗 " + esc(x.link) : ""}</small></div>
      <div class="sl-actions">
        <button data-sl-move="${esc(x.slideId)}|-1" ${i === 0 ? "disabled" : ""} aria-label="উপরে">⬆️</button>
        <button data-sl-move="${esc(x.slideId)}|1" ${i === S.slides.length - 1 ? "disabled" : ""} aria-label="নিচে">⬇️</button>
        <button data-sl-edit="${esc(x.slideId)}">✏️ এডিট</button>
        <button data-sl-del="${esc(x.slideId)}">🗑️</button>
      </div></div>`;
  }).join("") || `<div class="a-card">কোনো স্লাইড নেই — সাইটে ডিফল্ট ব্যানার দেখাবে। "নতুন স্লাইড" চাপুন।</div>`;
}

function slideModal(x) {
  x = x || { badge: "", title: "", subtitle: "", btnText: "", link: "#products", imgDesktop: "", imgMobile: "", theme: "green", active: true };
  const act = String(x.active).toUpperCase() !== "FALSE";
  openModal(`<h3>${x.slideId ? "স্লাইড এডিট" : "নতুন স্লাইড"}</h3>
    <div class="img-field"><b style="font-size:.95rem">🖥️ ডেস্কটপ/ট্যাবলেট ছবি — 1600×800 (2:1)</b>
      <div class="img-prev" data-prev="imgDesktop" style="--ar:2/1"><span>ছবি নেই (ছবি না দিলে রঙিন ডিজাইন দেখাবে)</span></div>
      <div class="img-row"><input name="imgDesktop" placeholder="https://... অথবা আপলোড করুন" value="${esc(x.imgDesktop)}"><button type="button" class="up-btn" data-upload="imgDesktop" data-w="1600" data-h="800">⬆️ আপলোড</button><button type="button" class="up-btn" data-clear-img="imgDesktop" aria-label="মুছুন">✕</button></div></div>
    <div class="img-field"><b style="font-size:.95rem">📱 মোবাইল ছবি (ঐচ্ছিক) — 1000×800 (5:4)</b>
      <div class="img-prev" data-prev="imgMobile" style="--ar:5/4;max-width:260px"><span>ফাঁকা থাকলে ডেস্কটপ ছবিই কাটছাঁট হয়ে দেখাবে</span></div>
      <div class="img-row"><input name="imgMobile" placeholder="https://... অথবা আপলোড করুন" value="${esc(x.imgMobile)}"><button type="button" class="up-btn" data-upload="imgMobile" data-w="1000" data-h="800">⬆️ আপলোড</button><button type="button" class="up-btn" data-clear-img="imgMobile" aria-label="মুছুন">✕</button></div></div>
    <label>ছোট ব্যাজ লেখা<input name="badge" maxlength="60" placeholder="যেমন: 🎁 ঈদ অফার" value="${esc(x.badge)}"></label>
    <label>শিরোনাম<input name="title" maxlength="140" placeholder="ছবির ওপরে বড় লেখা (ছবিতে লেখা থাকলে ফাঁকা রাখুন)" value="${esc(x.title)}"></label>
    <label>উপশিরোনাম<input name="subtitle" maxlength="240" value="${esc(x.subtitle)}"></label>
    <div class="row2"><label>বাটনের লেখা<input name="btnText" maxlength="40" placeholder="এখনই কিনুন" value="${esc(x.btnText)}"></label>
    <label>বাটন/ছবির লিংক<input name="link" maxlength="300" placeholder="#products" value="${esc(x.link)}"></label></div>
    <label>ডিজাইনের রং (ছবি ছাড়া স্লাইডের জন্য)<select name="theme">
      <option value="green"${x.theme === "green" ? " selected" : ""}>সবুজ</option><option value="gold"${x.theme === "gold" ? " selected" : ""}>সোনালি/মধু</option><option value="teal"${x.theme === "teal" ? " selected" : ""}>নীলচে-সবুজ</option></select></label>
    <label class="pay-opt"><input type="checkbox" name="active"${act ? " checked" : ""}> সাইটে দেখান</label>`,
  async (fd) => {
    const slide = Object.fromEntries(fd.entries());
    slide.slideId = x.slideId || "";
    slide.active = fd.has("active");
    await call("saveSlide", { slide });
  });
}

$("addSlide").addEventListener("click", () => slideModal());
$("slideList").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-sl-edit]"), del = e.target.closest("[data-sl-del]"), mv = e.target.closest("[data-sl-move]");
  try {
    if (ed) slideModal(S.slides.find((x) => x.slideId === ed.dataset.slEdit));
    if (mv) { const [slideId, dir] = mv.dataset.slMove.split("|"); await call("moveSlide", { slideId, dir: Number(dir) }); await loadAll(); }
    if (del && confirm("স্লাইডটি মুছে ফেলবেন?")) { await call("deleteSlide", { slideId: del.dataset.slDel }); toast("মুছে ফেলা হয়েছে"); await loadAll(); }
  } catch (err) { toast("⚠️ " + err.message); }
});

/* ---------- ড্যাশবোর্ড চার্ট (বিক্রি, অবস্থা, সেরা পণ্য) ---------- */
const p2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtK = (n) => (n >= 1000 ? (n / 1000) + "K" : String(n));
function niceMax(v) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= v);
}

function last7() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ key: dayKey(d), label: `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`, rev: 0, orders: 0 });
  }
  S.orders.forEach((o) => {
    if (o.status === "বাতিল") return;
    const day = days.find((x) => String(o.date).startsWith(x.key));
    if (day) { day.rev += Number(o.total) || 0; day.orders++; }
  });
  return days;
}

function renderSalesChart(days) {
  const W = 720, H = 250, L = 50, R = 10, T = 22, B = 30, iw = W - L - R, ih = H - T - B, band = iw / days.length;
  const max = niceMax(Math.max(1, ...days.map((d) => d.rev))), bw = Math.min(24, band * 0.5);
  const y = (v) => T + ih - (v / max) * ih;
  const peak = days.reduce((m, d, i) => (d.rev > days[m].rev ? i : m), 0);
  const ticks = [0, max / 2, max];
  const total = days.reduce((s, d) => s + d.rev, 0);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="গত ৭ দিনে মোট বিক্রি ${money(total)}"><title>গত ৭ দিনের বিক্রি</title>`;
  ticks.forEach((t) => { svg += `<line class="${t === 0 ? "base" : "grid"}" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${fmtK(t)}</text>`; });
  days.forEach((d, i) => {
    const cx = L + band * i + band / 2, x0 = cx - bw / 2, h = (d.rev / max) * ih, top = y(d.rev);
    svg += `<rect class="band" tabindex="0" x="${L + band * i}" y="${T}" width="${band}" height="${ih}" data-i="${i}" aria-label="${d.label}: ${d.orders}টি অর্ডার, ${money(d.rev)}"/>`;
    if (h >= 1) {
      const r = Math.min(4, h, bw / 2);   // ডেটার মাথা ৪px গোল, বেসলাইনে সমতল
      svg += `<path class="bar" d="M${x0},${top + h} V${top + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${top + h} Z"/>`;
    }
    svg += `<text x="${cx}" y="${H - 10}" text-anchor="middle">${d.label}</text>`;
  });
  if (days[peak].rev > 0) svg += `<text class="val" x="${L + band * peak + band / 2}" y="${y(days[peak].rev) - 6}" text-anchor="middle">${money(days[peak].rev)}</text>`;
  svg += `</svg>`;
  $("salesChart").innerHTML = svg;
  $("salesSub").textContent = `মোট ${money(total)} · ${days.reduce((s, d) => s + d.orders, 0)}টি অর্ডার (বাতিল বাদে)`;
  $("salesTable").innerHTML = `<table><tr><th>তারিখ</th><th>অর্ডার</th><th>বিক্রি</th></tr>${days.map((d) => `<tr><td>${d.key}</td><td>${d.orders}</td><td>${money(d.rev)}</td></tr>`).join("")}</table>`;

  const tip = $("chartTip"), card = tip.parentElement;
  const show = (el) => {
    const d = days[+el.dataset.i], r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
    tip.innerHTML = `${d.key}<br><b>${money(d.rev)}</b> · ${d.orders}টি অর্ডার`;
    tip.hidden = false;
    tip.style.left = (r.left + r.width / 2 - c.left) + "px";
    tip.style.top = (r.top - c.top + ih * (1 - d.rev / max) * (r.height / ih) + 6) + "px";
  };
  $("salesChart").querySelectorAll(".band").forEach((el) => {
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("focus", () => show(el));
    el.addEventListener("mouseleave", () => { tip.hidden = true; });
    el.addEventListener("blur", () => { tip.hidden = true; });
  });
}

function hbars(el, rows, fmt) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  el.innerHTML = rows.length
    ? rows.map(([name, v]) => `<div class="hbar"><div class="hbar-top"><span>${esc(name)}</span><span>${fmt(v)}</span></div><i><u style="width:${Math.max(2, v / max * 100)}%"></u></i></div>`).join("")
    : `<p class="none">এখনো কোনো ডেটা নেই</p>`;
}

function renderCharts() {
  renderSalesChart(last7());
  hbars($("statusBars"), STATUSES.map((s) => [s, S.orders.filter((o) => o.status === s).length]), (v) => v + "টি");
  const sold = {};
  S.orders.forEach((o) => {
    if (o.status === "বাতিল") return;
    let lines = []; try { lines = JSON.parse(o.itemsJson); } catch (e) { /* ignore */ }
    lines.forEach((l) => { sold[l.name] = (sold[l.name] || 0) + (Number(l.qty) || 0); });
  });
  hbars($("topProducts"), Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5), (v) => v + " পিস");
}
$("chartToggle").addEventListener("click", () => {
  const showTable = $("salesTable").hidden;
  $("salesTable").hidden = !showTable;
  $("salesChart").hidden = showTable;
  $("chartToggle").textContent = showTable ? "📊 চার্ট" : "📋 টেবিল";
});

/* ---------- শুরু ---------- */
if (S.pass) call("login").then(start).catch(() => logout());
