const API = SITE_API_URL;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "৳" + Number(n || 0).toLocaleString("en-US");
const STATUSES = ["নতুন", "কনফার্মড", "শিপড", "ডেলিভারড", "বাতিল"];
const PAY = { cod: "Cash on delivery", bkash: "bKash", nagad: "Nagad" };
// Status values are stored in the sheet in Bangla; these are the labels shown in the admin
const STATUS_EN = { "নতুন": "Pending", "কনফার্মড": "Confirmed", "শিপড": "Shipped", "ডেলিভারড": "Delivered", "বাতিল": "Cancelled" };

const S = { orders: [], products: [], categories: [], coupons: [], reviews: [], slides: [], notify: {}, settings: {}, pass: "", defaultPassword: false };
try { S.pass = sessionStorage.getItem("adminPass") || ""; } catch (e) {}

let toastTimer;
function toast(t) {
  const el = $("toast");
  el.textContent = t; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

async function call(cmd, extra) {
  if (API.includes("WEB_APP_URL")) throw new Error("Web App URL is not set in config.js");
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "admin", password: S.pass, cmd, ...extra })
  });
  const r = await res.json();
  if (r.auth === false) { logout(); throw new Error(r.error); }
  if (!r.ok) throw new Error(r.error || "Something went wrong");
  return r;
}

/* ---------- লগইন ---------- */
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  S.pass = $("pass").value;
  $("loginMsg").textContent = "Verifying...";
  try {
    const auth = await call("login");
    S.defaultPassword = auth.defaultPassword === true;
    try { sessionStorage.setItem("adminPass", S.pass); } catch (err) {}
    $("loginMsg").textContent = "";
    start();
  } catch (err) {
    $("loginMsg").className = "form-msg err";
    $("loginMsg").textContent = "⚠️ " + (err.message === "Failed to fetch" ? "Could not connect to the server" : err.message);
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
  document.body.classList.add("adm-loading");
  await loadAll();
  document.body.classList.remove("adm-loading");
  startLiveRefresh();
}

/* Live refresh: every 2 minutes (only while the tab is visible and nothing is being edited) — a toast announces new orders */
let lastOrderCount = null, liveTimer = null;
function startLiveRefresh() {
  clearInterval(liveTimer);
  lastOrderCount = S.orders.length;
  liveTimer = setInterval(async () => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
    if (document.hidden || $("modal").open || typing || $("app").hidden) return;
    const before = lastOrderCount;
    await loadAll();
    if (before != null && S.orders.length > before) {
      const n = S.orders.length - before;
      toast(`🔔 ${n} new order${n === 1 ? "" : "s"} received`);
      try { document.title = `(${n}) New orders · Admin Panel`; setTimeout(() => { document.title = "Admin Panel | KhatiGhor"; }, 20000); } catch (e) { /* ignore */ }
    }
    lastOrderCount = S.orders.length;
  }, 120000);
}

async function loadAll() {
  try {
    let d;
    try { d = await call("bootstrap"); }                         // one request for everything
    catch (e) { if (!/unknown command|অজানা কমান্ড/i.test(e.message)) throw e; d = await loadAllLegacy(); } // older backend: fall back to separate calls
    S.orders = d.orders; S.products = d.products; S.coupons = d.coupons; S.settings = d.settings;
    S.reviews = d.reviews; S.notify = d.notify; S.slides = d.slides; S.categories = d.categories; S.courier = d.courier || null;
    const warn = $("pwWarn"); if (warn) warn.hidden = !d.defaultPassword;
    renderAll();
  } catch (e) { toast("⚠️ " + e.message); }
}
async function loadAllLegacy() {
  const [o, p, c, s, rv, nt, sd, ct, cr] = await Promise.all([call("orders"), call("products"), call("coupons"), call("settings"), call("reviews"), call("notify"), call("slides"), call("categories"), call("courierConfig").catch(() => null)]);
  return { orders: o.orders, products: p.products, coupons: c.coupons, settings: s.settings, reviews: rv.reviews, notify: nt.notify, slides: sd.slides, categories: ct.categories, courier: cr, defaultPassword: S.defaultPassword };
}
$("refresh").addEventListener("click", async () => { await loadAll(); toast("Updated"); });

function renderAll() { renderBrands(); renderOrders(); renderCategories(); renderProducts(); renderCoupons(); renderReviews(); renderNotify(); renderSettings(); renderSlides(); if (typeof renderAdminShell === "function") renderAdminShell(); }

/* Navigation, dashboard, customers, reports, search and notifications live in admin-dashboard.js */

/* ---------- অর্ডার ---------- */
$("oStatus").innerHTML = `<option value="">All statuses</option>` + STATUSES.map((s) => `<option value="${s}">${STATUS_EN[s]}</option>`).join("");
const ORD = { limit: 30 };
const ordersChanged = () => { ORD.limit = 30; renderOrders(); };
AdminSearch.onType($("oSearch"), ordersChanged);
$("oStatus").addEventListener("change", ordersChanged);
$("oMore").addEventListener("click", () => { ORD.limit += 30; renderOrders(); });
$("oChips").addEventListener("click", (e) => { const b = e.target.closest("[data-ostat]"); if (b) { $("oStatus").value = b.dataset.ostat; ordersChanged(); } });
const filteredOrders = () => {
  const q = $("oSearch").value.trim().toLowerCase(), st = $("oStatus").value;
  const pool = st ? S.orders.filter((o) => o.status === st) : S.orders;
  if (!q) return pool;
  // smart search: every word must match (any order), typos allowed, best match first
  return AdminSearch.match(pool, q, (o) => [o.orderId, o.name, o.phone, o.email, o.items, o.address, o.area, o.trxId, STATUS_EN[o.status] || o.status, o.coupon, o.note]).map((m) => m.item);
};

function renderOrders() {
  const st = $("oStatus").value, list = filteredOrders(), shown = list.slice(0, ORD.limit);
  const counts = {}; S.orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
  $("oChips").innerHTML = [["", "All", S.orders.length]].concat(STATUSES.map((s) => [s, STATUS_EN[s], counts[s] || 0])).map(([v, l, n]) => `<button type="button" class="o-chip${st === v ? " is-on" : ""}" data-ostat="${v}">${l} <b>${n}</b></button>`).join("");
  $("oCount").textContent = list.length ? `Showing ${shown.length} of ${list.length} order${list.length === 1 ? "" : "s"}` : "";
  $("oMore").hidden = list.length <= shown.length;
  $("oMore").textContent = `Show ${Math.min(30, list.length - shown.length)} more (${list.length - shown.length} remaining)`;
  $("ordersList").innerHTML = shown.map((o) => {
    const dg = String(o.phone).replace(/\D/g, ""), wa = dg.indexOf("880") === 0 ? dg : "88" + dg;
    return `
    <article class="order s-${esc(o.status)}">
      <div class="o-top"><b>${esc(o.orderId)}</b><span class="o-meta">${esc(o.date)}</span></div>
      <div><b>${esc(o.name)}</b> · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>${o.email ? ` · ✉️ ${esc(o.email)}` : ""}</div>
      <div class="o-meta">📍 ${esc(o.address)} (${esc(o.area)})</div>
      <div class="o-items">🛒 ${esc(o.items)}</div>
      <div class="o-meta">
        Items ${money(o.subtotal)} + Delivery ${money(o.delivery)}${o.discount ? ` − Discount ${money(o.discount)} (${esc(o.coupon)})` : ""}
        = <b>${money(o.total)}</b> · ${esc(PAY[o.payMethod] || o.payMethod)}${o.trxId ? ` · TrxID: <b>${esc(o.trxId)}</b>` : ""}
      </div>
      ${o.note ? `<div class="o-meta">📝 ${esc(o.note)}</div>` : ""}
      ${typeof courierBlock === "function" ? courierBlock(o) : ""}
      <div class="o-actions">
        <select data-status="${esc(o.orderId)}" aria-label="Order status">${STATUSES.map((s) => `<option value="${s}"${s === o.status ? " selected" : ""}>${STATUS_EN[s]}</option>`).join("")}</select>
        <a href="https://wa.me/${wa}?text=${encodeURIComponent(`Hello ${o.name}, the status of your order ${o.orderId} is: ${STATUS_EN[o.status] || o.status}.`)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <button data-print="${esc(o.orderId)}">🖨️ Invoice</button>
      </div>
    </article>`;
  }).join("") || `<div class="a-card">No orders found.${S.orders.length ? " Try another search or status." : ""}</div>`;
}

$("ordersList").addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-status]");
  if (!sel) return;
  sel.disabled = true;
  try {
    await call("setStatus", { orderId: sel.dataset.status, status: sel.value });
    toast("✅ Status updated");
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
  if (!w) return toast("Please allow pop-ups");
  w.document.write(`<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>Invoice ${esc(o.orderId)}</title>
  <style>body{font-family:sans-serif;max-width:640px;margin:20px auto;padding:0 12px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;text-align:left}.r{text-align:right}h2{margin:0}</style>
  <h2>🌿 KhatiGhor</h2><p>Phone: ${esc(S.settings.phone)}</p><hr>
  <p><b>Order:</b> ${esc(o.orderId)} &nbsp; <b>Date:</b> ${esc(o.date)}</p>
  <p><b>Customer:</b> ${esc(o.name)}<br><b>Mobile:</b> ${esc(o.phone)}<br><b>Address:</b> ${esc(o.address)}</p>
  <table><tr><th>Item</th><th class="r">Price</th><th class="r">Qty</th><th class="r">Total</th></tr>
  ${lines.map((l) => `<tr><td>${esc(l.name)} (${esc(l.unit)})</td><td class="r">${money(l.price)}</td><td class="r">${l.qty}</td><td class="r">${money(l.price * l.qty)}</td></tr>`).join("")}
  <tr><td colspan="3" class="r">Subtotal</td><td class="r">${money(o.subtotal)}</td></tr>
  <tr><td colspan="3" class="r">Delivery</td><td class="r">${money(o.delivery)}</td></tr>
  ${o.discount ? `<tr><td colspan="3" class="r">Discount</td><td class="r">−${money(o.discount)}</td></tr>` : ""}
  <tr><td colspan="3" class="r"><b>Total</b></td><td class="r"><b>${money(o.total)}</b></td></tr></table>
  <p><b>Payment:</b> ${esc(PAY[o.payMethod] || o.payMethod)} ${o.payMethod === "cod" ? "— collect " + money(o.total) + " on delivery" : ""}</p>
  <p>Thank you! 🙏</p><script>onload=()=>print()<\/script>`);
  w.document.close();
}

$("csvBtn").addEventListener("click", () => {
  const list = filteredOrders();
  if (!list.length) return toast("No orders to export");
  const cols = [["Order ID", "orderId"], ["Date", "date"], ["Customer", "name"], ["Phone", "phone"], ["Email", "email"], ["Address", "address"], ["Area", "area"], ["Items", "items"], ["Subtotal", "subtotal"], ["Delivery", "delivery"], ["Discount", "discount"], ["Coupon", "coupon"], ["Total", "total"], ["Payment", "payMethod"], ["TrxID", "trxId"], ["Note", "note"], ["Status", "status"], ["Courier", "courier"], ["Tracking", "trackingCode"], ["Courier status", "courierStatus"]];
  const val = (o, k) => (k === "status" ? STATUS_EN[o.status] || o.status : k === "payMethod" ? PAY[o.payMethod] || o.payMethod : k === "phone" ? "\t" + o.phone : o[k]);
  const safeCell = (v) => { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const csv = "\ufeff" + [cols.map((c) => c[0]).join(",")].concat(list.map((o) => cols.map((c) => safeCell(val(o, c[1]))).join(","))).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "orders-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  toast(`✅ Exported ${list.length} order${list.length === 1 ? "" : "s"}`);
});

/* ---------- মডাল ---------- */
const modal = $("modal"), modalForm = $("modalForm");
function openModal(html, onSave) {
  modalForm.innerHTML = html + `<p class="form-msg err" id="mErr"></p>
    <div class="mbtns"><button type="button" class="btn btn-outline" id="mCancel">Cancel</button><button type="submit" class="btn">💾 Save</button></div>`;
  modalForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = modalForm.querySelector("[type=submit]");
    btn.disabled = true;
    try { await onSave(new FormData(modalForm)); modal.close(); await loadAll(); toast("✅ Saved"); }
    catch (err) { $("mErr").textContent = "⚠️ " + err.message; }
    btn.disabled = false;
  };
  $("mCancel").onclick = () => modal.close();
  modal.showModal();
}

/* ---------- ক্যাটাগরি ---------- */
function renderCategories() {
  $("catTable").innerHTML = `<tr><th>Icon</th><th>Name</th><th>Products</th><th>Order</th><th></th></tr>` +
    (S.categories.map((c, i) => `<tr>
      <td>${esc(c.emoji || "🗂️")}</td><td><b>${esc(c.name)}</b></td><td>${c.count}</td>
      <td class="acts"><button data-cmove="${esc(c.name)}" data-dir="-1"${i === 0 ? " disabled" : ""}>⬆️</button> <button data-cmove="${esc(c.name)}" data-dir="1"${i === S.categories.length - 1 ? " disabled" : ""}>⬇️</button></td>
      <td class="acts"><button data-cgedit="${esc(c.name)}">✏️</button> <button data-cgdel="${esc(c.name)}">🗑️</button></td>
    </tr>`).join("") || `<tr><td colspan="5">No categories yet — click "➕ New category"</td></tr>`);
}

function categoryModal(c) {
  c = c || { name: "", emoji: "" };
  openModal(`<h3>${c.name ? "Edit category" : "New category"}</h3>
    <label>Category name *<input name="name" required maxlength="40" placeholder="e.g. Kitchen Appliances" value="${esc(c.name)}"></label>
    <label>Icon (emoji, optional)<input name="emoji" maxlength="8" placeholder="🍳" value="${esc(c.emoji)}"></label>
    ${c.name ? `<p class="a-hint">If you rename it, the category of all its products is updated automatically.</p>` : ""}`,
  async (fd) => {
    await call("saveCategory", { category: { name: fd.get("name"), emoji: fd.get("emoji"), oldName: c.name } });
  });
}

// পণ্যের ফর্মের ড্রপডাউন: শুধু তৈরি করা ক্যাটাগরি থেকে বাছাই
function categorySelect(current) {
  const names = S.categories.map((c) => c.name);
  if (current && names.indexOf(current) < 0) names.push(current); // পুরনো/অনুপস্থিত মান হারাবে না
  if (!names.length) return `<select name="category" required disabled><option value="">First add categories in the "Categories" page</option></select>`;
  return `<select name="category" required><option value="">— Select a category —</option>` +
    names.map((n) => `<option value="${esc(n)}"${n === current ? " selected" : ""}>${esc(n)}</option>`).join("") + `</select>`;
}

$("addCategory").addEventListener("click", () => categoryModal());
$("catTable").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-cgedit]"), del = e.target.closest("[data-cgdel]"), mv = e.target.closest("[data-cmove]");
  try {
    if (ed) categoryModal(S.categories.find((c) => c.name === ed.dataset.cgedit));
    if (mv) { await call("moveCategory", { name: mv.dataset.cmove, dir: Number(mv.dataset.dir) }); await loadAll(); }
    if (del && confirm("Delete this category?")) { await call("deleteCategory", { name: del.dataset.cgdel }); toast("Deleted"); await loadAll(); }
  } catch (err) { toast("⚠️ " + err.message); }
});

/* ---------- পণ্য ---------- */
const isActive = (p) => String(p.active).toUpperCase() === "TRUE";
function renderProducts() {
  const catSel = $("pCat"), cur = catSel.value;
  const cats = [...new Set(S.products.map((p) => p.category).filter(Boolean))];
  catSel.innerHTML = `<option value="">All categories</option>` + cats.map((c) => `<option${c === cur ? " selected" : ""}>${esc(c)}</option>`).join("");
  const q = $("pSearch").value.trim().toLowerCase(), cat = catSel.value, f = $("pStock").value;
  const base = S.products.filter((p) =>
    (!cat || p.category === cat) &&
    (!f || (f === "low" ? Number(p.stock) > 0 && Number(p.stock) <= 5 : f === "out" ? Number(p.stock) <= 0 : !isActive(p))));
  // smart search: every word must match, typos allowed, best match first
  const list = q ? AdminSearch.match(base, q, (p) => [p.name, p.category, p.unit, p.tag, p.id, p.desc]).map((m) => m.item) : base;
  const rawQ = $("pSearch").value.trim();
  $("pCount").textContent = S.products.length ? `${list.length} of ${S.products.length} products` : "";
  $("prodTable").innerHTML = `<tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr>` +
    (list.map((p) => `<tr>
      <td>${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" style="width:36px;height:36px;object-fit:cover;border-radius:6px">` : esc(p.emoji)}</td>
      <td>${AdminSearch.hl(p.name, rawQ)}<br><small>${AdminSearch.hl(p.unit, rawQ)}</small></td><td>${AdminSearch.hl(p.category, rawQ)}</td>
      <td>${money(p.price)} <small><del>${p.oldPrice ? money(p.oldPrice) : ""}</del></small></td>
      <td>${Number(p.stock) <= 0 ? '<span class="pill expired">Out of stock</span>' : Number(p.stock) <= 5 ? `<span class="pill warn">${p.stock} left</span>` : p.stock}</td>
      <td><span class="pill ${isActive(p) ? "" : "off"}">${isActive(p) ? "Active" : "Hidden"}</span></td>
      <td class="acts"><button data-edit="${esc(p.id)}" aria-label="Edit">✏️</button> <button data-del="${esc(p.id)}" aria-label="Delete">🗑️</button></td>
    </tr>`).join("") || `<tr><td colspan="7" class="empty">No products match.</td></tr>`);
}
AdminSearch.onType($("pSearch"), renderProducts, 80);
["pCat", "pStock"].forEach((id) => $(id).addEventListener("change", renderProducts));

function parseProductImages(value, limit = 2) {
  if (Array.isArray(value)) return [...new Set(value.map((url) => String(url || "").trim()).filter(Boolean))].slice(0, limit);
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parseProductImages(parsed, limit);
  } catch (e) {}
  return [...new Set(text.split(/[,\n|]/).map((url) => url.trim()).filter(Boolean))].slice(0, limit);
}

function productImageCandidates(value) {
  const url = String(value || "").trim();
  const candidates = [url];
  const driveId = url.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/(?:uc|open)\?(?:[^#]*&)?id=|googleusercontent\.com\/d\/)([A-Za-z0-9_-]+)/i)?.[1];
  if (driveId) {
    candidates.push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`);
    candidates.push(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`);
  }
  return [...new Set(candidates.filter(Boolean))];
}

function bindGalleryPreview(img) {
  const candidates = productImageCandidates(img.dataset.gallerySrc);
  let index = 0;
  img.addEventListener("error", () => {
    if (index < candidates.length) {
      img.src = candidates[index++];
      return;
    }
    img.hidden = true;
    const message = img.parentElement.querySelector(".product-gallery-error");
    if (message) message.hidden = false;
  });
  if (candidates.length) img.src = candidates[index++];
}

function renderProductImagePreviews() {
  const field = modalForm.elements.images, preview = modalForm.querySelector("#productGalleryPreview");
  if (!field || !preview) return;
  const primary = String(modalForm.elements.image.value || "").trim();
  const urls = parseProductImages(field.value, primary ? 2 : 3).filter((url) => url !== primary);
  preview.innerHTML = urls.map((url, i) => `<div class="product-gallery-thumb"><img data-gallery-src="${esc(url)}" alt="Additional product image ${i + 1}"><span class="product-gallery-error" hidden>Image unavailable<br>Check link access</span><button type="button" data-remove-gallery="${i}" aria-label="Remove image ${i + 1}">×</button></div>`).join("");
  preview.querySelectorAll("img[data-gallery-src]").forEach(bindGalleryPreview);
}

function productModal(p) {
  p = p || { name: "", unit: "", category: "", price: "", oldPrice: "", emoji: "🛒", image: "", images: [], tag: "", desc: "", stock: 10, active: true };
  const act = String(p.active).toUpperCase() !== "FALSE";
  const images = parseProductImages(p.images, p.image ? 2 : 3).filter((url) => url !== String(p.image || "").trim());
  openModal(`<h3>${p.id ? "Edit product" : "New product"}</h3>
    <label>Product name *<input name="name" required value="${esc(p.name)}"></label>
    <div class="row2"><label>Weight / unit<input name="unit" placeholder="500 g" value="${esc(p.unit)}"></label>
    <label>Category *${categorySelect(p.category)}</label></div>
    <div class="row2"><label>Selling price *<input name="price" type="number" min="0" required value="${esc(p.price)}"></label>
    <label>Old price<input name="oldPrice" type="number" min="0" value="${esc(p.oldPrice)}"></label></div>
    <div class="row2"><label>Stock *<input name="stock" type="number" min="0" required value="${esc(p.stock)}"></label>
    <label>Emoji<input name="emoji" value="${esc(p.emoji)}"></label></div>
    <div class="img-field"><b style="font-size:.95rem">Image (optional) — ideal size 800×800</b>
      <div class="img-prev has-slot" data-prev="image" style="--ar:1/1;max-width:140px"><span>No image</span></div>
      <div class="img-row"><input name="image" placeholder="https://... or upload" value="${esc(p.image)}"><button type="button" class="up-btn" data-upload="image" data-w="800" data-h="800">⬆️ Upload</button></div></div>
    <div class="img-field product-gallery-field"><b style="font-size:.95rem">Product gallery (up to 3 images total)</b>
      <div class="product-gallery-preview" id="productGalleryPreview"></div>
      <div class="img-row"><textarea name="images" rows="3" maxlength="5000" placeholder="Add one image URL per line">${esc(images.join("\n"))}</textarea><button type="button" class="up-btn" data-upload-gallery>⬆️ Upload images</button></div>
      <small class="a-hint">The main image counts toward the 3-image limit. Upload up to 2 additional images, or 3 if the main image is blank; paste one URL per line. Google Drive links must be shared as “Anyone with the link”.</small></div>
    <label>Tag (e.g. New)<input name="tag" value="${esc(p.tag)}"></label>
    <label>Description (shown in the product pop-up)<textarea name="desc" rows="3" maxlength="600">${esc(p.desc)}</textarea></label>
    <label class="pay-opt"><input type="checkbox" name="active"${act ? " checked" : ""}> Show on website</label>`,
  async (fd) => {
    const product = Object.fromEntries(fd.entries());
    product.id = p.id || "";
    product.active = fd.has("active");
    product.images = parseProductImages(fd.get("images"), product.image ? 2 : 3).filter((url) => url !== String(product.image || "").trim());
    await call("saveProduct", { product });
    if (product.images.length) {
      const saved = await call("products");
      const row = saved.products.find((item) => product.id
        ? String(item.id) === String(product.id)
        : String(item.name) === String(product.name) && String(item.image || "") === String(product.image || ""));
      const savedImages = parseProductImages(row && row.images, 3);
      if (!row || product.images.some((url) => !savedImages.includes(url))) {
        throw new Error("Gallery images were not saved. Update and deploy the latest Apps Script, then save this product again.");
      }
    }
  });
  renderProductImagePreviews();
}

$("addProduct").addEventListener("click", () => productModal());
$("prodTable").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
  if (ed) productModal(S.products.find((p) => String(p.id) === ed.dataset.edit));
  if (del && confirm("Delete this product? (Old orders stay intact)")) {
    try { await call("deleteProduct", { id: del.dataset.del }); toast("Deleted"); await loadAll(); }
    catch (err) { toast("⚠️ " + err.message); }
  }
});

/* ---------- কুপন ---------- */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const couponExpired = (c) => !!c.expires && c.expires < ymd(new Date());
const daysLeft = (c) => Math.round((new Date(c.expires + "T00:00:00") - new Date(ymd(new Date()) + "T00:00:00")) / 86400000);
const fmtDay = (s) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
function couponStatus(c) {
  if (couponExpired(c)) return `<span class="pill expired">Expired</span>`;
  if (String(c.active).toUpperCase() !== "TRUE") return `<span class="pill off">Off</span>`;
  if (c.expires && daysLeft(c) <= 7) return `<span class="pill warn">Active · ${daysLeft(c) === 0 ? "ends today" : daysLeft(c) + " day" + (daysLeft(c) === 1 ? "" : "s") + " left"}</span>`;
  return `<span class="pill">Active</span>`;
}
function renderCoupons() {
  $("couponTable").innerHTML = `<tr><th>Code</th><th>Type</th><th>Value</th><th>Min. order</th><th>Valid until</th><th>Status</th><th></th></tr>` +
    S.coupons.map((c) => `<tr class="${couponExpired(c) ? "is-expired" : ""}"><td><b>${esc(c.code)}</b></td><td>${c.type === "flat" ? "Amount" : "Percent"}</td>
      <td>${c.type === "flat" ? money(c.value) : c.value + "%"}</td><td>${money(c.minOrder)}</td>
      <td>${c.expires ? esc(fmtDay(c.expires)) : '<span class="a-hint" style="margin:0">No expiry</span>'}</td>
      <td>${couponStatus(c)}</td>
      <td class="acts"><button data-cedit="${esc(c.code)}">✏️</button> <button data-cdel="${esc(c.code)}">🗑️</button></td></tr>`).join("");
}
function couponModal(c) {
  c = c || { code: "", type: "percent", value: 10, minOrder: 0, active: true, expires: "" };
  openModal(`<h3>${c.code ? "Edit coupon" : "New coupon"}</h3>
    <label>Code *<input name="code" required ${c.code ? "readonly" : ""} value="${esc(c.code)}" style="text-transform:uppercase"></label>
    <label>Type<select name="type"><option value="percent"${c.type !== "flat" ? " selected" : ""}>Percentage (%)</option><option value="flat"${c.type === "flat" ? " selected" : ""}>Fixed amount (৳)</option></select></label>
    <div class="row2"><label>Value *<input name="value" type="number" min="1" required value="${esc(c.value)}"></label>
    <label>Minimum order (৳)<input name="minOrder" type="number" min="0" value="${esc(c.minOrder)}"></label></div>
    <label>Valid until <small>(last day the coupon works — leave empty for no expiry)</small><input name="expires" type="date" value="${esc(c.expires || "")}"></label>
    <div class="chip-row small" role="group" aria-label="Quick expiry dates">Quick set:
      <button type="button" class="chip" data-exp="7">7 days</button><button type="button" class="chip" data-exp="30">30 days</button>
      <button type="button" class="chip" data-exp="month">End of month</button><button type="button" class="chip" data-exp="">No expiry</button></div>
    <label class="pay-opt"><input type="checkbox" name="active"${String(c.active).toUpperCase() !== "FALSE" ? " checked" : ""}> Active</label>`,
  async (fd) => {
    const coupon = Object.fromEntries(fd.entries());
    coupon.active = fd.has("active");
    coupon.expires = String(fd.get("expires") || "");
    await call("saveCoupon", { coupon });
  });
}
// quick expiry buttons inside the coupon form
modalForm.addEventListener("click", (e) => {
  const b = e.target.closest("[data-exp]"); if (!b) return;
  const inp = modalForm.elements.expires; if (!inp) return;
  const v = b.dataset.exp, d = new Date();
  if (v === "") inp.value = "";
  else if (v === "month") inp.value = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  else { d.setDate(d.getDate() + Number(v)); inp.value = ymd(d); }
});
$("couponTable").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-cedit]"), del = e.target.closest("[data-cdel]");
  if (ed) couponModal(S.coupons.find((c) => c.code === ed.dataset.cedit));
  if (del && confirm("Delete this coupon?")) {
    try { await call("deleteCoupon", { code: del.dataset.cdel }); await loadAll(); }
    catch (err) { toast("⚠️ " + err.message); }
  }
});

/* ---------- সেটিংস ---------- */
function renderSettings() {
  const f = $("settingsForm");
  Object.keys(S.settings).forEach((k) => { if (f.elements[k]) f.elements[k].value = S.settings[k]; });
  renderFooterCatPicks();
}

/* ফুটারের "কেনাকাটা" ক্যাটাগরি বাছাই (সর্বোচ্চ ৫টি) */
const FOOTER_CAT_MAX = 5;
function renderFooterCatPicks() {
  const box = $("footerCatPicks"), hidden = $("settingsForm").elements.footerCats;
  const names = S.categories.map((c) => c.name);
  const picked = String(S.settings.footerCats || "").split("|").filter((n) => names.includes(n)).slice(0, FOOTER_CAT_MAX);
  hidden.value = picked.join("|");
  box.innerHTML = names.map((n) => `<label class="fc-pick"><input type="checkbox" value="${esc(n)}"${picked.includes(n) ? " checked" : ""}> ${esc(n)}</label>`).join("")
    || `<span class="a-hint">First add categories in the "Categories" page.</span>`;
  syncFooterCatPicks();
}
function syncFooterCatPicks() {
  const boxes = [...$("footerCatPicks").querySelectorAll("input[type=checkbox]")];
  const on = boxes.filter((b) => b.checked);
  boxes.forEach((b) => { b.disabled = !b.checked && on.length >= FOOTER_CAT_MAX; });
  $("settingsForm").elements.footerCats.value = on.map((b) => b.value).join("|");
  $("footerCatCount").textContent = on.length;
}
$("footerCatPicks").addEventListener("change", syncFooterCatPicks);
$("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const settings = Object.fromEntries(new FormData(e.target).entries());
  try {
    await call("saveSettings", { settings });
    $("setMsg").className = "form-msg ok";
    $("setMsg").textContent = "✅ Saved";
    await loadAll();
  } catch (err) {
    $("setMsg").className = "form-msg err";
    $("setMsg").textContent = "⚠️ " + err.message;
  }
});

/* ---------- Reviews (moderation + admin-added reviews + homepage selection) ---------- */
const RV_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
const RV_HOME_MAX = 9;
$("rvFilter").innerHTML = `<option value="">All reviews</option><option value="featured">🏠 On homepage</option>` + Object.keys(RV_LABEL).map((k) => `<option value="${k}">${RV_LABEL[k]}</option>`).join("");
$("rvFilter").addEventListener("change", renderReviews);
const isOn = (v) => String(v).toUpperCase() === "TRUE";

function renderReviews() {
  const st = $("rvFilter").value;
  const pname = (id) => (S.products.find((p) => String(p.id) === String(id)) || {}).name || (id ? "Product #" + id : "General review");
  const list = S.reviews.filter((r) => !st || (st === "featured" ? isOn(r.featured) : r.status === st));
  const homeCount = S.reviews.filter((r) => isOn(r.featured)).length;
  $("reviewList").innerHTML = list.map((r) => `
    <article class="rvc s-${esc(r.status)}">
      <div class="o-top"><b>${esc(pname(r.productId))}</b><span class="o-meta">${esc(String(r.date).slice(0, 10))}</span></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        ${r.avatar ? `<img src="${esc(r.avatar)}" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover">` : ""}
        <span class="rv-stars">${"★".repeat(Number(r.rating))}${"☆".repeat(5 - Number(r.rating))}</span> · <b>${esc(r.name)}</b>${r.role ? ` <small>(${esc(r.role)})</small>` : ""}
        ${isOn(r.verified) ? `<span class="pill">✔ Verified (${esc(r.orderId)})</span>` : r.orderId === "manual" ? `<span class="pill off">Added by admin</span>` : `<span class="pill off">Unverified</span>`}
        <span class="pill ${r.status === "pending" ? "warn" : r.status === "rejected" ? "off" : ""}">${RV_LABEL[r.status] || esc(r.status)}</span>
        ${isOn(r.featured) ? `<span class="pill">🏠 On homepage</span>` : ""}</div>
      ${r.text ? `<div>${esc(r.text)}</div>` : ""}
      <div class="o-actions">
        ${r.status !== "approved" ? `<button data-rvs="${esc(r.reviewId)}|approved">✅ Approve</button>` : ""}
        ${r.status !== "rejected" ? `<button data-rvs="${esc(r.reviewId)}|rejected">🚫 Reject</button>` : ""}
        ${isOn(r.featured) ? `<button data-rvf="${esc(r.reviewId)}|0">🏠 Remove from homepage</button>` : `<button data-rvf="${esc(r.reviewId)}|1"${homeCount >= RV_HOME_MAX ? " disabled title=\"Homepage limit reached\"" : ""}>🏠 Show on homepage</button>`}
        <button data-rvedit="${esc(r.reviewId)}">✏️ Edit</button>
        <button data-rvdel="${esc(r.reviewId)}">🗑️ Delete</button>
      </div>
    </article>`).join("") || `<div class="a-card">No reviews found.</div>`;
}

$("reviewList").addEventListener("click", async (e) => {
  const s = e.target.closest("[data-rvs]"), d = e.target.closest("[data-rvdel]"), f = e.target.closest("[data-rvf]"), ed = e.target.closest("[data-rvedit]");
  try {
    if (s) { const [reviewId, status] = s.dataset.rvs.split("|"); await call("setReviewStatus", { reviewId, status }); toast("✅ Updated"); await loadAll(); }
    if (f) { const [reviewId, on] = f.dataset.rvf.split("|"); await call("setReviewFeatured", { reviewId, featured: on === "1" }); toast(on === "1" ? "✅ Added to homepage" : "Removed from homepage"); await loadAll(); }
    if (ed) reviewModal(S.reviews.find((r) => r.reviewId === ed.dataset.rvedit));
    if (d && confirm("Delete this review?")) { await call("deleteReview", { reviewId: d.dataset.rvdel }); toast("Deleted"); await loadAll(); }
  } catch (err) { toast("⚠️ " + err.message); }
});

function reviewModal(r) {
  const edit = !!r;
  r = r || { productId: "", name: "", role: "", rating: 5, text: "", avatar: "", status: "approved", featured: false };
  const st = r.status || "approved";
  openModal(`<h3>${edit ? "Edit review" : "Add review"}</h3>
    <div class="row2"><label>Customer name *<input name="name" required maxlength="40" placeholder="e.g. Rahela Akter" value="${esc(r.name)}"></label>
    <label>Job / title <small>(optional)</small><input name="role" maxlength="60" placeholder="e.g. Student" value="${esc(r.role)}"></label></div>
    <div class="row2"><label>Rating *<select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${Number(r.rating) === n ? " selected" : ""}>${"★".repeat(n)}  (${n} out of 5)</option>`).join("")}</select></label>
    <label>For which product? <small>(optional)</small><select name="productId"><option value="">Not for a specific product</option>${S.products.map((p) => `<option value="${esc(p.id)}"${String(r.productId) === String(p.id) ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>
    <label>What did the customer say?<textarea name="text" rows="4" maxlength="500" placeholder="Write the review here">${esc(r.text)}</textarea></label>
    <div class="img-field"><b style="font-size:.95rem">👤 Customer photo <small>(optional)</small></b>
      <div class="img-row"><input name="avatar" placeholder="Paste a photo link, or click Upload" value="${esc(r.avatar)}"><button type="button" class="up-btn" data-upload="avatar" data-w="200" data-h="200">⬆️ Upload</button><button type="button" class="up-btn" data-clear-img="avatar" aria-label="Remove photo">✕</button></div>
      <div class="img-prev" data-prev="avatar" style="--ar:1/1;max-width:90px;border-radius:50%"><span>No photo</span></div></div>
    <label>Visibility<select name="status">
      <option value="approved"${st === "approved" ? " selected" : ""}>✅ Visible on the website</option>
      <option value="pending"${st === "pending" ? " selected" : ""}>⏳ Not visible yet (waiting for approval)</option>
      <option value="rejected"${st === "rejected" ? " selected" : ""}>🚫 Hidden</option></select></label>
    <label class="pay-opt"><input type="checkbox" name="featured"${isOn(r.featured) ? " checked" : ""}> 🏠 Also show in the homepage review slider</label>
    <p class="a-hint">Only add real customer feedback.</p>`,
  async (fd) => {
    const review = Object.fromEntries(fd.entries());
    review.featured = fd.has("featured") && review.status === "approved";
    if (edit) review.reviewId = r.reviewId;
    await call("saveReview", { review });
  });
}
$("addReview").addEventListener("click", () => reviewModal());

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
  try { await call("saveNotify", { notify: notifyPayload() }); notifyMsg("✅ Saved", true); await loadAll(); }
  catch (err) { notifyMsg("⚠️ " + err.message, false); }
});

async function testNotify(channel) {
  notifyMsg("Sending...", true);
  try {
    await call("saveNotify", { notify: notifyPayload() }); // save the current settings before testing
    const r = await call("testNotify", { channel });
    notifyMsg("✅ " + r.message, true);
  } catch (err) { notifyMsg("⚠️ " + err.message, false); }
}
$("testEmail").addEventListener("click", () => testNotify("email"));
$("testSms").addEventListener("click", () => testNotify("sms"));

/* ---------- ছবি আপলোড (ব্রাউজারেই কেটে ছোট করে, তারপর Google Drive এ) ---------- */
async function resizeCover(file, w, h, quality = 0.86, contain = false) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Could not read the image")); i.src = url; });
    const small = img.width < w * 0.9 || img.height < h * 0.9;
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const cx = cv.getContext("2d");
    cx.imageSmoothingQuality = "high";
    cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);
    const k = contain ? Math.min(w / img.width, h / img.height) : Math.max(w / img.width, h / img.height);          // কভার: পুরো ক্যানভাস ভরবে, মাঝখান থেকে কাটবে
    const dw = img.width * k, dh = img.height * k;
    cx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return { b64: cv.toDataURL("image/jpeg", quality).split(",")[1], small };
  } finally { URL.revokeObjectURL(url); }
}

function setPreview(name, url) {
  const box = modalForm.querySelector(`[data-prev="${name}"]`);
  if (!box) return;
  const token = String(Number(box.dataset.previewToken || 0) + 1);
  box.dataset.previewToken = token;
  box.style.backgroundImage = "";
  box.classList.remove("has", "image-error");
  if (!url) return;
  const candidates = productImageCandidates(url);
  let index = 0;
  const image = new Image();
  const loadNext = () => {
    if (box.dataset.previewToken !== token) return;
    if (index >= candidates.length) {
      box.classList.add("image-error");
      box.querySelector("span").textContent = "Image unavailable — check link access";
      return;
    }
    image.src = candidates[index++];
  };
  image.onload = () => {
    if (box.dataset.previewToken === token) {
      box.style.backgroundImage = `url("${image.src.replace(/"/g, "%22")}")`;
      box.classList.add("has");
      box.classList.remove("image-error");
    }
  };
  image.onerror = loadNext;
  loadNext();
}

modalForm.addEventListener("click", (e) => {
  const removeGallery = e.target.closest("[data-remove-gallery]");
  if (removeGallery) {
    const field = modalForm.elements.images, primary = String(modalForm.elements.image.value || "").trim();
    const urls = parseProductImages(field.value, primary ? 2 : 3).filter((url) => url !== primary);
    urls.splice(Number(removeGallery.dataset.removeGallery), 1);
    field.value = urls.join("\n");
    renderProductImagePreviews();
    return;
  }
  const galleryUpload = e.target.closest("[data-upload-gallery]");
  if (galleryUpload) {
    const pick = document.createElement("input");
    pick.type = "file"; pick.accept = "image/jpeg,image/png,image/webp"; pick.multiple = true;
    pick.onchange = async () => {
      const files = Array.from(pick.files || []);
      if (!files.length) return;
      const field = modalForm.elements.images, primary = String(modalForm.elements.image.value || "").trim();
      const urls = parseProductImages(field.value, primary ? 2 : 3).filter((url) => url !== primary);
      const slots = Math.max(0, (primary ? 2 : 3) - urls.length);
      if (!slots) return toast("⚠️ A product can have up to 3 images total");
      if (files.length > slots) toast(`⚠️ Only ${slots} more image${slots === 1 ? "" : "s"} can be added`);
      const selected = files.slice(0, slots), old = galleryUpload.textContent;
      galleryUpload.disabled = true;
      let uploaded = 0;
      try {
        for (const file of selected) {
          if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} is larger than 12 MB`);
          galleryUpload.textContent = `⏳ Uploading ${uploaded + 1}/${selected.length}...`;
          const { b64 } = await resizeCover(file, 800, 800, 0.86);
          const result = await call("uploadImage", { data: b64, name: file.name.replace(/\.[^.]+$/, "") });
          if (!result.url) throw new Error(`The server did not return an image URL for ${file.name}`);
          urls.push(result.url);
          uploaded++;
        }
        field.value = [...new Set(urls)].slice(0, primary ? 2 : 3).join("\n");
        renderProductImagePreviews();
        toast(`✅ Uploaded ${uploaded} image${uploaded === 1 ? "" : "s"}`);
      } catch (err) {
        field.value = [...new Set(urls)].slice(0, primary ? 2 : 3).join("\n");
        renderProductImagePreviews();
        toast(uploaded ? `⚠️ Uploaded ${uploaded} image${uploaded === 1 ? "" : "s"}; ${err.message}` : "⚠️ " + err.message);
      } finally {
        galleryUpload.disabled = false;
        galleryUpload.textContent = old;
      }
    };
    pick.click();
    return;
  }
  const clr = e.target.closest("[data-clear-img]");
  if (clr) {
    const inp = modalForm.elements[clr.dataset.clearImg];
    inp.value = "";
    setPreview(clr.dataset.clearImg, "");
    if (clr.dataset.clearImg === "image") renderProductImagePreviews();
    return;
  }
  const btn = e.target.closest("[data-upload]");
  if (!btn) return;
  const field = btn.dataset.upload, w = +btn.dataset.w, h = +btn.dataset.h;
  const pick = document.createElement("input");
  pick.type = "file"; pick.accept = "image/jpeg,image/png,image/webp";
  pick.onchange = async () => {
    const file = pick.files[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return toast("⚠️ Image is larger than 12 MB");
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = "⏳ Uploading...";
    try {
      const { b64, small } = await resizeCover(file, w, h, 0.86, btn.dataset.fit === "contain");
      const r = await call("uploadImage", { data: b64, name: file.name.replace(/\.[^.]+$/, "") });
      modalForm.elements[field].value = r.url;
      setPreview(field, r.url);
      if (field === "image") renderProductImagePreviews();
      toast(small ? `⚠️ The image was smaller than ${w}×${h}, so it may look slightly blurry` : "✅ Image uploaded");
    } catch (err) { toast("⚠️ " + err.message); }
    btn.disabled = false; btn.textContent = old;
  };
  pick.click();
});
modalForm.addEventListener("input", (e) => {
  if (e.target.name === "images") {
    const primary = String(modalForm.elements.image.value || "").trim();
    const limit = primary ? 2 : 3;
    const entered = parseProductImages(e.target.value, 100).filter((url) => url !== primary);
    if (entered.length > limit) {
      e.target.value = entered.slice(0, limit).join("\n");
      toast("⚠️ A product can have up to 3 images total");
    }
    renderProductImagePreviews();
  }
  if (e.target.name === "image") renderProductImagePreviews();
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
  $("slideCount").textContent = `${S.slides.length}/5 slides · use ⬆️⬇️ to change the order`;
  $("addSlide").disabled = S.slides.length >= 5;
  $("slideList").innerHTML = S.slides.map((x, i) => {
    const on = String(x.active).toUpperCase() === "TRUE";
    return `<div class="sl-card${on ? "" : " off"}">
      <div class="sl-thumb t-${esc(x.theme || "green")}">${x.imgDesktop ? `<img src="${esc(x.imgDesktop)}" alt="">` : esc(x.title || x.badge || "")}</div>
      <div class="sl-info"><b>${i + 1}. ${esc(x.title || x.badge || "(image only)")}</b>
        <small>${x.imgDesktop ? "🖼️ Image slide" : "🎨 Designed slide"}${x.imgMobile ? " · 📱 Has mobile image" : ""} · ${on ? "Active" : "Off"}${x.link ? " · 🔗 " + esc(x.link) : ""}</small></div>
      <div class="sl-actions">
        <button data-sl-move="${esc(x.slideId)}|-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">⬆️</button>
        <button data-sl-move="${esc(x.slideId)}|1" ${i === S.slides.length - 1 ? "disabled" : ""} aria-label="Move down">⬇️</button>
        <button data-sl-edit="${esc(x.slideId)}">✏️ Edit</button>
        <button data-sl-del="${esc(x.slideId)}">🗑️</button>
      </div></div>`;
  }).join("") || `<div class="a-card">No slides yet — the site shows the default banners. Click "New slide".</div>`;
}

function slideModal(x) {
  x = x || { badge: "", title: "", subtitle: "", btnText: "", link: "#products", imgDesktop: "", imgMobile: "", theme: "green", active: true };
  const act = String(x.active).toUpperCase() !== "FALSE";
  openModal(`<h3>${x.slideId ? "Edit slide" : "New slide"}</h3>
    <div class="img-field"><b style="font-size:.95rem">🖥️ Desktop / tablet image — 1600×800 (2:1)</b>
      <div class="img-prev" data-prev="imgDesktop" style="--ar:2/1"><span>No image (a coloured design is shown instead)</span></div>
      <div class="img-row"><input name="imgDesktop" placeholder="https://... or upload" value="${esc(x.imgDesktop)}"><button type="button" class="up-btn" data-upload="imgDesktop" data-w="1600" data-h="800">⬆️ Upload</button><button type="button" class="up-btn" data-clear-img="imgDesktop" aria-label="Remove">✕</button></div></div>
    <div class="img-field"><b style="font-size:.95rem">📱 Mobile image (optional) — 1000×800 (5:4)</b>
      <div class="img-prev" data-prev="imgMobile" style="--ar:5/4;max-width:260px"><span>If empty, the desktop image is cropped to fit</span></div>
      <div class="img-row"><input name="imgMobile" placeholder="https://... or upload" value="${esc(x.imgMobile)}"><button type="button" class="up-btn" data-upload="imgMobile" data-w="1000" data-h="800">⬆️ Upload</button><button type="button" class="up-btn" data-clear-img="imgMobile" aria-label="Remove">✕</button></div></div>
    <label>Small badge text<input name="badge" maxlength="60" placeholder="e.g. 🎁 Eid offer" value="${esc(x.badge)}"></label>
    <label>Title<input name="title" maxlength="140" placeholder="Large text over the image (leave empty if the image already contains text)" value="${esc(x.title)}"></label>
    <label>Subtitle<input name="subtitle" maxlength="240" value="${esc(x.subtitle)}"></label>
    <div class="row2"><label>Button text<input name="btnText" maxlength="40" placeholder="Buy now" value="${esc(x.btnText)}"></label>
    <label>Button / image link<input name="link" maxlength="300" placeholder="#products" value="${esc(x.link)}"></label></div>
    <label>Design colour (for slides without an image)<select name="theme">
      <option value="green"${x.theme === "green" ? " selected" : ""}>Green</option><option value="gold"${x.theme === "gold" ? " selected" : ""}>Gold / honey</option><option value="teal"${x.theme === "teal" ? " selected" : ""}>Teal</option></select></label>
    <label class="pay-opt"><input type="checkbox" name="active"${act ? " checked" : ""}> Show on site</label>`,
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
    if (del && confirm("Delete this slide?")) { await call("deleteSlide", { slideId: del.dataset.slDel }); toast("Deleted"); await loadAll(); }
  } catch (err) { toast("⚠️ " + err.message); }
});

/* ---------- Our Brands (home page logos; stored as JSON in the "brands" setting) ---------- */
const BRAND_MAX = 12;
function brandList() { try { const l = JSON.parse(S.settings.brands || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
async function saveBrands(list) { await call("saveSettings", { settings: { brands: JSON.stringify(list) } }); await loadAll(); }
function renderBrands() {
  const list = brandList();
  $("addBrand").disabled = list.length >= BRAND_MAX;
  $("brandList").innerHTML = list.map((b, i) => `<div class="sl-card">
      <div class="sl-thumb" style="background:#fff;display:grid;place-items:center"><img src="${esc(b.logo)}" alt="" style="max-width:90%;max-height:90%;object-fit:contain"></div>
      <div class="sl-info"><b>${i + 1}. ${esc(b.name || "(no name)")}</b><small>${b.link ? "🔗 " + esc(b.link) : "No link"}</small></div>
      <div class="sl-actions">
        <button data-br-move="${i}|-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">⬆️</button>
        <button data-br-move="${i}|1" ${i === list.length - 1 ? "disabled" : ""} aria-label="Move down">⬇️</button>
        <button data-br-edit="${i}">✏️ Edit</button>
        <button data-br-del="${i}">🗑️</button>
      </div></div>`).join("") || `<div class="a-card">No brands yet — the "Our Brands" section stays hidden. Click "Add brand".</div>`;
}
function brandModal(idx) {
  const list = brandList();
  const b = idx >= 0 ? list[idx] : { name: "", logo: "", link: "" };
  openModal(`<h3>${idx >= 0 ? "Edit brand" : "Add brand"}</h3>
    <div class="img-field"><b style="font-size:.95rem">🖼️ Brand logo — 400×200 (2:1), transparent/white background works best</b>
      <div class="img-prev" data-prev="logo" style="--ar:2/1;max-width:300px"><span>No logo yet</span></div>
      <div class="img-row"><input name="logo" placeholder="https://... or upload" value="${esc(b.logo)}"><button type="button" class="up-btn" data-upload="logo" data-w="400" data-h="200" data-fit="contain">⬆️ Upload</button><button type="button" class="up-btn" data-clear-img="logo" aria-label="Clear">✕</button></div></div>
    <label>Brand name<input name="name" maxlength="40" placeholder="e.g. Khejuri" value="${esc(b.name)}"></label>
    <label>Link (optional)<input name="link" maxlength="300" placeholder="https://... or shop.html?cat=Honey" value="${esc(b.link)}"></label>`,
  async (fd) => {
    const item = { name: String(fd.get("name") || "").trim(), logo: String(fd.get("logo") || "").trim(), link: String(fd.get("link") || "").trim() };
    if (!item.logo) throw new Error("Please add a logo image");
    const next = brandList();
    if (idx >= 0) next[idx] = item; else next.push(item);
    await call("saveSettings", { settings: { brands: JSON.stringify(next.slice(0, BRAND_MAX)) } });
  });
}
$("addBrand").addEventListener("click", () => brandModal(-1));
$("brandList").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-br-edit]"), del = e.target.closest("[data-br-del]"), mv = e.target.closest("[data-br-move]");
  try {
    if (ed) brandModal(Number(ed.dataset.brEdit));
    if (mv) { const [i, dir] = mv.dataset.brMove.split("|").map(Number); const l = brandList(), j = i + dir; if (j >= 0 && j < l.length) { [l[i], l[j]] = [l[j], l[i]]; await saveBrands(l); } }
    if (del && confirm("Delete this brand?")) { const l = brandList(); l.splice(Number(del.dataset.brDel), 1); await saveBrands(l); toast("Deleted"); }
  } catch (err) { toast("⚠️ " + err.message); }
});

/* ---------- শুরু ---------- */
if (S.pass) call("login").then(start).catch(() => logout());
