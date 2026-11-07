/* =====================================================================
   Admin shell: navigation, dashboard data, customers, reports, search, notifications.
   Everything is computed from the data admin.js already loads (S.orders, S.products, S.reviews…),
   so no extra backend call is needed. Loaded after admin.js (shares its globals: S, $, esc, money, toast…).
   ===================================================================== */

// STATUS_EN (status labels) is defined in admin.js
const STATUS_KEY = { "নতুন": "pending", "কনফার্মড": "confirmed", "শিপড": "shipped", "ডেলিভারড": "delivered", "বাতিল": "cancelled" };
const PAY_EN = { cod: "Cash on delivery", bkash: "bKash", nagad: "Nagad" };
const DAY = 86400000;
const LOW_STOCK = 5;
const ADM = { range: 30, salesDays: 30, view: "dash" };

/* ---------- helpers ---------- */
const num = (n) => Number(n || 0).toLocaleString("en-US");
const cash = (n) => "৳" + num(Math.round(n));
const compact = (n) => (n >= 1e7 ? +(n / 1e7).toFixed(1) + "Cr" : n >= 1e5 ? +(n / 1e5).toFixed(1) + "L" : n >= 1000 ? +(n / 1000).toFixed(1) + "K" : String(Math.round(n)));
const isCancelled = (o) => o.status === "বাতিল";
const phoneKey = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// Orders store "dd/MM/yyyy hh:mm a" (Dhaka time), reviews "dd/MM/yyyy"
function parseDate(s) {
  if (s instanceof Date) return s;
  const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?)?/);
  if (!m) { const d = new Date(s); return isNaN(d) ? null : d; }
  let hh = m[4] ? +m[4] : 0;
  if (m[6]) { const pm = /p/i.test(m[6]); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
  return new Date(+m[3], +m[2] - 1, +m[1], hh, m[5] ? +m[5] : 0);
}
function timeAgo(d) {
  if (!d) return "";
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 30 * 86400) return Math.floor(s / 86400) + "d ago";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Windows are aligned to calendar days: range=1 → today; 7 → today + 6 previous days; offset=1 → the window just before
function windowOf(days, offset = 0) {
  const end = startOfDay(Date.now()).getTime() + DAY - offset * days * DAY;
  return [end - days * DAY, end];
}
const inWin = (d, w) => d && d.getTime() >= w[0] && d.getTime() < w[1];
const ordersIn = (w) => S.orders.filter((o) => !isCancelled(o) && inWin(parseDate(o.date), w));
const reviewsIn = (w) => S.reviews.filter((r) => r.status !== "rejected" && inWin(parseDate(r.date), w));
const sumTotal = (list) => list.reduce((s, o) => s + Number(o.total || 0), 0);
const uniq = (list) => new Set(list.map((o) => phoneKey(o.phone)).filter(Boolean)).size;

function delta(cur, prev) {
  if (!prev) return cur ? { pct: null, dir: "up" } : { pct: 0, dir: "flat" };
  const pct = (cur - prev) / prev * 100;
  return { pct, dir: pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat" };
}

/* ---------- navigation ---------- */
function showView(name, opts = {}) {
  if (!document.getElementById("tab-" + name)) name = "dash";
  ADM.view = name;
  document.querySelectorAll("#admContent > section").forEach((s) => { s.hidden = s.id !== "tab-" + name; });
  document.querySelectorAll("#tabs [data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll("#tabs .adm-group").forEach((g) => {
    const has = !!g.querySelector(`[data-tab="${name}"]`);
    const parent = g.querySelector(".adm-nav-parent"), sub = g.querySelector(".adm-sub");
    if (has) { sub.hidden = false; parent.setAttribute("aria-expanded", "true"); }
    parent.classList.toggle("active", has);
  });
  if (!opts.noHash) { try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ } }
  closeSidebar();
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
  if (name === "customers") renderCustomers();
  if (name === "reports") renderReports();
  if (name === "campaigns" && typeof loadCampaigns === "function") loadCampaigns();
  if (name === "courier" && typeof courierOpened === "function") courierOpened();
}

function openSidebar() { $("admSidebar").classList.add("open"); $("admBackdrop").hidden = false; $("admMenuToggle").setAttribute("aria-expanded", "true"); }
function closeSidebar() { $("admSidebar").classList.remove("open"); $("admBackdrop").hidden = true; $("admMenuToggle").setAttribute("aria-expanded", "false"); }

$("tabs").addEventListener("click", (e) => {
  const parent = e.target.closest(".adm-nav-parent");
  if (parent) {
    const sub = parent.parentElement.querySelector(".adm-sub");
    const open = sub.hidden;
    sub.hidden = !open;
    parent.setAttribute("aria-expanded", String(open));
    return;
  }
  const b = e.target.closest("[data-tab]");
  if (b) showView(b.dataset.tab);
});
$("admMenuToggle").addEventListener("click", () => ($("admSidebar").classList.contains("open") ? closeSidebar() : openSidebar()));
$("admBackdrop").addEventListener("click", closeSidebar);

// any element with data-goto="view" (optionally data-click="#selector") jumps to a view
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-goto]");
  if (!g || !$("app") || $("app").hidden) return;
  closeMenus();
  showView(g.dataset.goto);
  if (g.dataset.click) { const t = document.querySelector(g.dataset.click); if (t) setTimeout(() => t.click(), 50); }
});

/* ---------- dropdown menus (bell, profile, search) ---------- */
function closeMenus(except) {
  [["admBell", "admBellMenu"], ["admProfileBtn", "admProfileMenu"]].forEach(([b, m]) => {
    if (m === except) return;
    $(m).hidden = true; $(b).setAttribute("aria-expanded", "false");
  });
  if (except !== "admSearchResults") { $("admSearchResults").hidden = true; $("admSearch").setAttribute("aria-expanded", "false"); }
}
[["admBell", "admBellMenu"], ["admProfileBtn", "admProfileMenu"]].forEach(([b, m]) => {
  $(b).addEventListener("click", (e) => {
    e.stopPropagation();
    const open = $(m).hidden;
    closeMenus(m);
    $(m).hidden = !open;
    $(b).setAttribute("aria-expanded", String(open));
  });
});
document.addEventListener("click", (e) => { if (!e.target.closest(".adm-menu-wrap, .adm-search")) closeMenus(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeMenus(); closeSidebar(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !$("app").hidden) { e.preventDefault(); $("admSearch").focus(); $("admSearch").select(); }
});
$("admProfileMenu").addEventListener("click", closeMenus);

/* ---------- KPI cards + sparklines ---------- */
function buckets(w, n) {
  const step = (w[1] - w[0]) / n;
  return Array.from({ length: n }, (_, i) => [w[0] + i * step, w[0] + (i + 1) * step]);
}
function series(items, dateOf, valueOf, w, n) {
  const b = buckets(w, n).map((x) => ({ from: x[0], to: x[1], v: 0 }));
  items.forEach((it) => {
    const t = dateOf(it) && dateOf(it).getTime();
    if (t == null || t < w[0] || t >= w[1]) return;
    const i = Math.min(n - 1, Math.floor((t - w[0]) / ((w[1] - w[0]) / n)));
    b[i].v += valueOf(it);
  });
  return b.map((x) => x.v);
}
function sparkSvg(vals) {
  const W = 120, H = 44, P = 3;
  const max = Math.max(1, ...vals), n = vals.length;
  const pts = vals.map((v, i) => [P + (n === 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (n - 1)), H - P - (v / max) * (H - 2 * P)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
  const area = line + `L${pts[n - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H}Z`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="presentation"><path class="spark-area" d="${area}"/><path class="spark-line" d="${line}" fill="none"/></svg>`;
}
function setKpi(key, value, d, vals) {
  const card = document.querySelector(`[data-kpi="${key}"]`);
  if (!card) return;
  card.querySelector(".kpi-value").textContent = value;
  const el = card.querySelector(".kpi-delta");
  el.className = "kpi-delta is-" + d.dir;
  el.querySelector("b").textContent = d.pct === null ? "New" : (d.pct > 0 ? "+" : "") + d.pct.toFixed(1) + "%";
  el.title = "Compared with the previous " + (ADM.range === 1 ? "day" : ADM.range + " days");
  card.querySelector(".kpi-spark").innerHTML = sparkSvg(vals);
}
function renderDataWarning() {
  const bad = S.orders.filter((o) => !parseDate(o.date)).length, box = $("dataWarn"); if (!box) return;
  box.hidden = !bad;
  if (bad) box.innerHTML = `ℹ️ ${num(bad)} order${bad === 1 ? " has" : "s have"} a date that could not be read, so ${bad === 1 ? "it is" : "they are"} left out of the dashboard totals and charts. Check the <b>date</b> column of the Orders sheet (format <code>dd/MM/yyyy hh:mm AM</code>).`;
}
function renderKpis() {
  const days = ADM.range, cur = windowOf(days), prev = windowOf(days, 1), n = days === 1 ? 12 : Math.min(days, 14);
  const oc = ordersIn(cur), op = ordersIn(prev);
  const rc = reviewsIn(cur), rp = reviewsIn(prev);
  const dOf = (o) => parseDate(o.date);
  setKpi("orders", num(oc.length), delta(oc.length, op.length), series(oc, dOf, () => 1, cur, n));
  setKpi("revenue", cash(sumTotal(oc)), delta(sumTotal(oc), sumTotal(op)), series(oc, dOf, (o) => Number(o.total) || 0, cur, n));
  // Customers = all-time total; the % and the graph show NEW customers (first order) in the period vs the previous one
  const cl = customersList(), newIn = (w) => cl.filter((c) => inWin(c.first, w)).length;
  setKpi("customers", num(cl.length), delta(newIn(cur), newIn(prev)), series(cl.filter((c) => c.first), (c) => c.first, () => 1, cur, n));
  setKpi("reviews", num(rc.length), delta(rc.length, rp.length), series(rc, (r) => parseDate(r.date), () => 1, cur, n));
}

/* ---------- sales overview chart ---------- */
function salesBuckets(days) {
  const w = windowOf(days);
  let list;
  if (days === 365) { // monthly, last 12 calendar months
    const now = new Date(); list = [];
    for (let i = 11; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1), to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      list.push({ from: from.getTime(), to: to.getTime(), label: from.toLocaleDateString("en-GB", { month: "short" }), full: from.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) });
    }
  } else {
    const n = days === 90 ? 13 : days; // 90D → weekly points
    const step = (w[1] - w[0]) / n;
    list = Array.from({ length: n }, (_, i) => {
      const from = w[0] + i * step, to = from + step, d = new Date(from), e = new Date(to - 1);
      const fmt = (x) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return { from, to, label: fmt(d), full: step > DAY ? fmt(d) + " – " + fmt(e) : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) };
    });
  }
  list.forEach((b) => { b.rev = 0; b.orders = 0; });
  S.orders.forEach((o) => {
    if (isCancelled(o)) return;
    const t = parseDate(o.date); if (!t) return;
    const b = list.find((x) => t.getTime() >= x.from && t.getTime() < x.to);
    if (b) { b.rev += Number(o.total) || 0; b.orders++; }
  });
  return list;
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v); }

function renderSales() {
  const data = salesBuckets(ADM.salesDays);
  const W = 760, H = 280, L = 48, R = 16, T = 20, B = 34, iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(1, ...data.map((d) => d.rev)));
  const x = (i) => L + (data.length === 1 ? iw / 2 : (i * iw) / (data.length - 1));
  const y = (v) => T + ih - (v / max) * ih;
  const pts = data.map((d, i) => [x(i), y(d.rev)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${T + ih} L${pts[0][0].toFixed(1)},${T + ih}Z`;
  const total = data.reduce((s, d) => s + d.rev, 0), orders = data.reduce((s, d) => s + d.orders, 0);
  const every = Math.max(1, Math.ceil(data.length / 8));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sales: ${cash(total)} from ${num(orders)} orders"><title>Sales overview</title>`;
  [0, 1, 2, 3, 4].forEach((k) => {
    const v = (max / 4) * k;
    svg += `<line class="${k === 0 ? "axis" : "grid"}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`;
  });
  svg += `<path class="sales-area" d="${area}"/><path class="sales-line" d="${line}" fill="none"/>`;
  let lastLabel = -99;
  data.forEach((d, i) => {
    if (data.length <= 31 || d.rev > 0) svg += `<circle class="sales-dot" cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.5"/>`;
    const want = i % every === 0 || (i === data.length - 1 && i - lastLabel >= Math.ceil(every * 0.75));
    if (want) { lastLabel = i; svg += `<text class="tick" x="${x(i)}" y="${H - 10}" text-anchor="middle">${d.label}</text>`; }
  });
  const bw = data.length === 1 ? iw : iw / (data.length - 1);
  data.forEach((d, i) => { svg += `<rect class="hit" tabindex="0" x="${x(i) - bw / 2}" y="${T}" width="${bw}" height="${ih}" data-i="${i}" aria-label="${d.full}: ${num(d.orders)} orders, ${cash(d.rev)}"/>`; });
  svg += `</svg>`;
  $("salesChart").innerHTML = svg;

  const tip = $("chartTip"), card = tip.parentElement, svgEl = $("salesChart").querySelector("svg");
  const show = (el) => {
    const d = data[+el.dataset.i], sb = svgEl.getBoundingClientRect(), cb = card.getBoundingClientRect(), k = sb.width / W;
    tip.innerHTML = `<small>${d.full}</small><b>${cash(d.rev)}</b><small>${num(d.orders)} orders</small>`;
    tip.hidden = false;
    tip.style.left = (sb.left - cb.left + pts[+el.dataset.i][0] * k) + "px";
    tip.style.top = (sb.top - cb.top + pts[+el.dataset.i][1] * (sb.height / H)) + "px";
  };
  $("salesChart").querySelectorAll(".hit").forEach((el) => {
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("focus", () => show(el));
    el.addEventListener("mouseleave", () => { tip.hidden = true; });
    el.addEventListener("blur", () => { tip.hidden = true; });
  });
}
$("salesRangeTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-days]");
  if (!b) return;
  ADM.salesDays = +b.dataset.days;
  $("salesRangeTabs").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
  renderSales();
});
$("dashRange").addEventListener("change", (e) => { ADM.range = +e.target.value; renderKpis(); renderTop(); });

/* ---------- recent orders / top products / low stock ---------- */
const initials = (n) => String(n || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
function renderRecent() {
  const rows = S.orders.slice(0, 5).map((o) => {
    const key = STATUS_KEY[o.status] || "pending";
    return `<tr data-order="${esc(o.orderId)}" tabindex="0">
      <td class="r-id">#${esc(o.orderId)}</td>
      <td class="r-cust"><span class="adm-avatar sm" data-image-slot="customer-avatar" aria-hidden="true">${esc(initials(o.name))}</span> ${esc(o.name)}</td>
      <td class="r-amt">${cash(o.total)}</td>
      <td><span class="status-pill is-${key}">${STATUS_EN[o.status] || esc(o.status)}</span></td>
      <td class="r-date">${timeAgo(parseDate(o.date))}</td></tr>`;
  }).join("");
  $("recentOrders").querySelector("tbody").innerHTML = rows || `<tr><td colspan="5" class="empty">No orders yet</td></tr>`;
}
$("recentOrders").addEventListener("click", (e) => {
  const tr = e.target.closest("[data-order]");
  if (tr) { showView("orders"); $("oSearch").value = tr.dataset.order; renderOrders(); }
});

function renderTop() {
  const w = windowOf(ADM.range), sold = {};
  ordersIn(w).forEach((o) => {
    let lines = []; try { lines = JSON.parse(o.itemsJson); } catch (e) { /* ignore */ }
    lines.forEach((l) => { const k = String(l.id); sold[k] = sold[k] || { name: l.name, qty: 0 }; sold[k].qty += Number(l.qty) || 0; });
  });
  const top = Object.entries(sold).sort((a, b) => b[1].qty - a[1].qty).slice(0, 3);
  const max = Math.max(1, ...top.map((t) => t[1].qty));
  $("topProducts").innerHTML = top.map(([id, t]) => {
    const p = S.products.find((x) => String(x.id) === id) || {};
    const thumb = p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : `<span>${esc(p.emoji || "🛒")}</span>`;
    return `<li class="top-item"><span class="top-thumb">${thumb}</span>
      <div class="top-info"><b>${esc(p.name || t.name)}</b>${p.unit ? ` <small>(${esc(p.unit)})</small>` : ""}<span class="top-price">${cash(p.price || 0)}</span>
        <span class="top-bar"><i style="width:${Math.max(4, t.qty / max * 100)}%"></i></span></div>
      <span class="top-sold"><b>${num(t.qty)}</b> sold</span></li>`;
  }).join("") || `<li class="empty">No sales in this period</li>`;
}
const activeProducts = () => S.products.filter((p) => String(p.active).toUpperCase() === "TRUE");
function renderLowStock() {
  const out = activeProducts().filter((p) => Number(p.stock) <= 0), low = activeProducts().filter((p) => Number(p.stock) > 0 && Number(p.stock) <= LOW_STOCK);
  $("lowStock").innerHTML = out.length + low.length
    ? out.map((p) => `<button type="button" class="low-item is-out" data-lowgo="out">${esc(p.emoji || "")} ${esc(p.name)} — <b>out of stock</b></button>`).concat(low.map((p) => `<button type="button" class="low-item" data-lowgo="low">${esc(p.emoji || "")} ${esc(p.name)} — <b>${num(p.stock)}</b> left</button>`)).join("")
    : `<p class="empty">All products are well stocked ✅</p>`;
}
$("lowStock").addEventListener("click", (e) => { const b = e.target.closest("[data-lowgo]"); if (b) { showView("products"); $("pStock").value = b.dataset.lowgo; renderProducts(); } });

/* ---------- notifications (bell) + sidebar counters ---------- */
function renderNotices() {
  const newOrders = S.orders.filter((o) => o.status === "নতুন").length;
  const pendRev = S.reviews.filter((r) => r.status === "pending").length;
  const low = activeProducts().filter((p) => Number(p.stock) <= LOW_STOCK).length;
  const total = newOrders + pendRev + low;
  const badge = $("admBellCount"); badge.hidden = !total; badge.textContent = total > 99 ? "99+" : total;
  const items = [
    [newOrders, "new orders waiting", "orders", () => { $("oStatus").value = "নতুন"; renderOrders(); }],
    [pendRev, "reviews waiting for approval", "reviews", () => { $("rvFilter").value = "pending"; renderReviews(); }],
    [low, "products low in stock", "products", null]
  ].filter((x) => x[0]);
  $("admBellMenu").innerHTML = `<div class="adm-dd-title">Notifications</div>` + (items.length
    ? items.map(([n, t, v], i) => `<button type="button" class="adm-notice" data-notice="${i}"><b>${num(n)}</b> ${t}</button>`).join("")
    : `<p class="empty">You are all caught up 🎉</p>`);
  $("admBellMenu").onclick = (e) => {
    const b = e.target.closest("[data-notice]"); if (!b) return;
    const it = items[+b.dataset.notice]; closeMenus(); showView(it[2]); if (it[3]) it[3]();
  };
  const no = $("navOrdersCount"); no.hidden = !newOrders; no.textContent = newOrders;
  const nr = $("navReviewsCount"); nr.hidden = !pendRev; nr.textContent = pendRev;
}

/* ---------- global search (Ctrl+K) ---------- */
function customersList() {
  const map = new Map();
  S.orders.slice().reverse().forEach((o) => { // oldest → newest, so the latest name/email wins
    if (isCancelled(o)) return;               // a cancelled order does not make someone a customer
    const k = phoneKey(o.phone); if (!k) return;
    const c = map.get(k) || { key: k, phone: o.phone, name: o.name, email: "", orders: 0, spent: 0, last: null, first: null };
    c.name = o.name || c.name; c.phone = o.phone || c.phone; if (o.email) c.email = o.email;
    const dt = parseDate(o.date);
    c.orders++; c.spent += Number(o.total) || 0;
    if (dt && (!c.last || dt > c.last)) c.last = dt;
    if (dt && (!c.first || dt < c.first)) c.first = dt;
    map.set(k, c);
  });
  return [...map.values()].sort((a, b) => (b.last || 0) - (a.last || 0));
}
const GS = (() => {
  const RK = "khatighor:admin:recent", PER = 5;
  const hl = AdminSearch.hl;
  const getRecent = () => { try { const a = JSON.parse(localStorage.getItem(RK)); return Array.isArray(a) ? a.slice(0, 5) : []; } catch (e) { return []; } };
  const setRecent = (l) => { try { localStorage.setItem(RK, JSON.stringify(l.slice(0, 5))); } catch (e) { /* storage blocked */ } };
  const remember = (q) => { q = q.trim(); if (q.length < 2) return; setRecent([q].concat(getRecent().filter((x) => x.toLowerCase() !== q.toLowerCase()))); };
  const pages = () => [...document.querySelectorAll("#tabs [data-tab]")].map((b) => ({ tab: b.dataset.tab, label: (b.querySelector(".adm-label") || b).textContent.trim() }));
  const stars = (n) => { const k = Math.max(0, Math.min(5, Math.round(n))); return "★".repeat(k) + "☆".repeat(5 - k); };
  let active = -1, n = 0;
  const box = () => $("admSearchResults"), input = () => $("admSearch");
  const opts = () => [...box().querySelectorAll("[data-sr]")];
  const close = () => { box().hidden = true; input().setAttribute("aria-expanded", "false"); input().removeAttribute("aria-activedescendant"); active = -1; };
  const setActive = (i) => {
    const o = opts(); if (!o.length) { active = -1; return; }
    active = (i + o.length) % o.length;
    o.forEach((el, k) => { el.classList.toggle("is-active", k === active); el.setAttribute("aria-selected", k === active ? "true" : "false"); });
    input().setAttribute("aria-activedescendant", o[active].id); o[active].scrollIntoView({ block: "nearest" });
  };
  const row = (type, val, inner) => `<button type="button" class="sr-row" role="option" id="sr-${n++}" data-sr="${type}|${esc(val)}">${inner}</button>`;
  const sec = (title, total, rows, more) => rows.length ? `<div class="sr-group" role="group" aria-label="${title}"><div class="sr-title"><span>${title}</span><small>${total}</small></div>${rows.join("")}${more || ""}</div>` : "";
  const moreRow = (type, val, label) => `<button type="button" class="sr-more" role="option" id="sr-${n++}" data-sr="${type}|${esc(val)}">${label} →</button>`;
  const HINT = `<div class="sr-hint"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close</div>`;

  function render() {
    const raw = input().value.trim(); n = 0;
    if (!raw) {
      const rec = getRecent();
      box().innerHTML = (rec.length ? `<div class="sr-group"><div class="sr-title"><span>Recent searches</span><button type="button" class="sr-clear" data-sr-clear>Clear</button></div>${rec.map((r) => row("recent", r, `<span class="sr-ico">🕘</span><span class="sr-main">${esc(r)}</span>`)).join("")}</div>` : "") +
        `<div class="sr-group"><div class="sr-title"><span>Go to</span></div><div class="sr-chips">${pages().filter((p) => ["orders", "products", "customers", "reports", "coupons", "courier"].includes(p.tab)).map((p) => `<button type="button" class="sr-chip" role="option" id="sr-${n++}" data-sr="page|${p.tab}">${esc(p.label)}</button>`).join("")}</div></div>` + HINT;
    } else {
      const M = AdminSearch.match;
      const ords = M(S.orders, raw, (o) => [o.orderId, o.name, o.phone, o.email, o.items, o.address, o.area, o.trxId, STATUS_EN[o.status] || o.status]);
      const prods = M(S.products, raw, (p) => [p.name, p.category, p.unit, p.tag, p.id]);
      const custs = M(customersList(), raw, (c) => [c.name, c.phone, c.email]);
      const coups = M(S.coupons || [], raw, (c) => [c.code]);
      const revs = M(S.reviews || [], raw, (r) => [r.name, r.text, r.orderId]);
      const pgs = M(pages(), raw, (p) => [p.label, p.tab]);
      const html =
        sec("Pages", pgs.length, pgs.slice(0, 3).map(({ item: p }) => row("page", p.tab, `<span class="sr-ico">↗</span><span class="sr-main">${hl(p.label, raw)}</span>`))) +
        sec("Orders", ords.length, ords.slice(0, PER).map(({ item: o }) => row("order", o.orderId, `<span class="sr-ico">🧾</span><span class="sr-main"><span class="sr-l1"><b>#${hl(o.orderId, raw)}</b> ${hl(o.name, raw)}</span><small>${hl(o.phone, raw)} · ${esc(String(o.items || "").slice(0, 46))}</small></span><span class="sr-side"><span class="pill${isCancelled(o) ? " expired" : o.status === "নতুন" ? " warn" : ""}">${esc(STATUS_EN[o.status] || o.status)}</span><small>${cash(o.total)}</small></span>`)),
          ords.length > PER ? moreRow("orders", raw, `See all ${ords.length} orders`) : "") +
        sec("Products", prods.length, prods.slice(0, PER).map(({ item: p }) => row("product", p.name, `<span class="sr-ico">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()">` : esc(p.emoji || "🛍️")}</span><span class="sr-main"><span class="sr-l1">${hl(p.name, raw)}</span><small>${hl(p.category || "", raw)}${p.unit ? " · " + hl(p.unit, raw) : ""}</small></span><span class="sr-side">${Number(p.stock) <= 0 ? '<span class="pill expired">Out</span>' : Number(p.stock) <= 5 ? `<span class="pill warn">${num(p.stock)} left</span>` : ""}<small>${cash(p.price)}</small></span>`)),
          prods.length > PER ? moreRow("products", raw, `See all ${prods.length} products`) : "") +
        sec("Customers", custs.length, custs.slice(0, PER).map(({ item: c }) => row("customer", c.phone, `<span class="adm-avatar sm" aria-hidden="true">${esc(initials(c.name))}</span><span class="sr-main"><span class="sr-l1">${hl(c.name, raw)}</span><small>${hl(c.phone, raw)}${c.email ? " · " + hl(c.email, raw) : ""}</small></span><span class="sr-side"><small>${num(c.orders)} order${c.orders === 1 ? "" : "s"}</small><small>${cash(c.spent)}</small></span>`)),
          custs.length > PER ? moreRow("customers", raw, `See all ${custs.length} customers`) : "") +
        sec("Coupons", coups.length, coups.slice(0, 3).map(({ item: c }) => row("coupon", c.code, `<span class="sr-ico">🏷️</span><span class="sr-main"><span class="sr-l1"><b>${hl(c.code, raw)}</b></span><small>${c.type === "flat" ? cash(c.value) + " off" : num(c.value) + "% off"}</small></span><span class="sr-side">${typeof couponExpired === "function" && couponExpired(c) ? '<span class="pill expired">Expired</span>' : ""}</span>`))) +
        sec("Reviews", revs.length, revs.slice(0, 3).map(({ item: r }) => row("review", r.reviewId, `<span class="sr-ico">⭐</span><span class="sr-main"><span class="sr-l1">${hl(r.name, raw)} <span class="sr-stars">${stars(r.rating)}</span></span><small>${hl(String(r.text || "").slice(0, 70), raw)}</small></span>`)));
      box().innerHTML = html ? html + HINT : `<div class="sr-empty"><b>No results for “${esc(raw)}”</b><span>Check the spelling, or try a name, phone number, order ID or product.</span></div>`;
    }
    box().hidden = false; input().setAttribute("aria-expanded", "true");
    setActive(raw ? 0 : -1); // while typing the first result is ready: Enter opens it
  }

  function go(type, val) {
    const raw = input().value.trim();
    if (type === "recent") { input().value = val; render(); input().focus(); return; }
    remember(raw);
    close(); closeMenus(); input().value = ""; input().blur();
    const toOrders = (q) => { showView("orders"); $("oStatus").value = ""; $("oSearch").value = q; ORD.limit = 30; renderOrders(); };
    const toProducts = (q) => { showView("products"); $("pSearch").value = q; $("pCat").value = ""; $("pStock").value = ""; renderProducts(); };
    if (type === "page") showView(val);
    else if (type === "order" || type === "customer" || type === "orders") toOrders(val);
    else if (type === "product" || type === "products") toProducts(val);
    else if (type === "customers") { showView("customers"); $("custSearch").value = val; renderCustomers(); }
    else if (type === "coupon") showView("coupons");
    else if (type === "review") showView("reviews");
  }

  let timer = 0;
  input().addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 70); });
  input().addEventListener("focus", render);
  input().addEventListener("click", () => { if (box().hidden) render(); });
  input().addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (box().hidden) render(); else setActive(active < 0 ? 0 : active + (e.key === "ArrowDown" ? 1 : -1)); }
    else if (e.key === "Enter") { e.preventDefault(); clearTimeout(timer); if (box().hidden) render(); const o = opts()[active >= 0 ? active : 0]; if (o) o.click(); }
    else if (e.key === "Escape") { if (!box().hidden) { e.stopPropagation(); close(); } }
    else if (e.key === "Tab") close();
  });
  box().addEventListener("mousedown", (e) => e.preventDefault()); // keep the input focused while clicking
  box().addEventListener("mousemove", (e) => { const el = e.target.closest("[data-sr]"); if (!el) return; const i = opts().indexOf(el); if (i >= 0 && i !== active) setActive(i); });
  box().addEventListener("click", (e) => {
    if (e.target.closest("[data-sr-clear]")) { setRecent([]); render(); return; }
    const b = e.target.closest("[data-sr]"); if (!b) return;
    const i = b.dataset.sr.indexOf("|"); go(b.dataset.sr.slice(0, i), b.dataset.sr.slice(i + 1));
  });
  // "/" jumps to the search box (when not typing somewhere else)
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "") && !$("app").hidden) { e.preventDefault(); input().focus(); input().select(); }
  });
  return { close };
})();

/* ---------- customers view ---------- */
function renderCustomers() {
  const q = ($("custSearch").value || "").trim().toLowerCase();
  const all = customersList(), rawQ = ($("custSearch").value || "").trim();
  const list = q ? AdminSearch.match(all, q, (c) => [c.name, c.phone, c.email]).map((m) => m.item) : all;
  $("custTable").innerHTML = `<thead><tr><th>Customer</th><th>Mobile</th><th>Email</th><th>Orders</th><th>Total spent</th><th>Last order</th></tr></thead><tbody>` +
    (list.map((c) => `<tr data-cust="${esc(c.phone)}" tabindex="0"><td><span class="adm-avatar sm" aria-hidden="true">${esc(initials(c.name))}</span> ${AdminSearch.hl(c.name, rawQ)}</td><td>${AdminSearch.hl(c.phone, rawQ)}</td><td>${AdminSearch.hl(c.email || "—", rawQ)}</td><td>${num(c.orders)}</td><td>${cash(c.spent)}</td><td>${c.last ? timeAgo(c.last) : "—"}</td></tr>`).join("")
      || `<tr><td colspan="6" class="empty">No customers yet — they appear here after the first order.</td></tr>`) + `</tbody>`;
}
AdminSearch.onType($("custSearch"), renderCustomers, 80);
$("custTable").addEventListener("click", (e) => {
  const tr = e.target.closest("[data-cust]");
  if (tr) { showView("orders"); $("oStatus").value = ""; $("oSearch").value = tr.dataset.cust; renderOrders(); }
});
const csvCell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
function downloadCsv(name, rows) {
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name; a.click();
}
$("custCsv").addEventListener("click", () => downloadCsv("customers.csv",
  [["Name", "Mobile", "Email", "Orders", "Total spent", "Last order"]].concat(customersList().map((c) => [c.name, "\t" + c.phone, c.email, c.orders, Math.round(c.spent), c.last ? c.last.toISOString().slice(0, 10) : ""]))));

/* ---------- reports view ---------- */
let REPORT_ROWS = [];
function renderReports() {
  const days = +$("repRange").value, w = windowOf(days), pw = windowOf(days, 1);
  const all = S.orders.filter((o) => inWin(parseDate(o.date), w)), prevAll = S.orders.filter((o) => inWin(parseDate(o.date), pw));
  const valid = all.filter((o) => !isCancelled(o)), prevValid = prevAll.filter((o) => !isCancelled(o)), cancelled = all.length - valid.length;
  const revenue = sumTotal(valid), prevRev = sumTotal(prevValid), delivered = valid.filter((o) => o.status === "ডেলিভারড");
  const aov = valid.length ? revenue / valid.length : 0, prevAov = prevValid.length ? prevRev / prevValid.length : 0;
  const dl = (cur, prev) => { const x = delta(cur, prev); return `<span class="kpi-delta is-${x.dir}"><i class="kpi-arrow" aria-hidden="true"></i><b>${x.pct === null ? "New" : (x.pct > 0 ? "+" : "") + x.pct.toFixed(1) + "%"}</b> <small>vs previous period</small></span>`; };
  const card = (label, value, extra) => `<article class="kpi-card"><div class="kpi-body"><span class="kpi-label">${label}</span><strong class="kpi-value">${value}</strong>${extra || ""}</div></article>`;
  $("repKpis").innerHTML = card("Revenue", cash(revenue), dl(revenue, prevRev)) + card("Orders", num(valid.length), dl(valid.length, prevValid.length)) + card("Average order value", cash(aov), dl(aov, prevAov)) +
    card("Delivered revenue", cash(sumTotal(delivered))) + card("Cancelled orders", num(cancelled) + (all.length ? ` (${Math.round(cancelled / all.length * 100)}%)` : ""));
  const pay = {}; valid.forEach((o) => { const k = PAY_EN[o.payMethod] || o.payMethod || "Other"; pay[k] = pay[k] || { n: 0, v: 0 }; pay[k].n++; pay[k].v += Number(o.total) || 0; });
  const bar = (rows, fmt) => { const max = Math.max(1, ...rows.map((r) => r[1])); return rows.map(([l, v, extra]) => `<div class="hbar"><div class="hbar-top"><span>${esc(l)}</span><span>${fmt(v, extra)}</span></div><i><u style="width:${Math.max(2, v / max * 100)}%"></u></i></div>`).join("") || `<p class="empty">No data</p>`; };
  $("repPay").innerHTML = bar(Object.entries(pay).map(([k, v]) => [k, v.v, v.n]), (v, n) => `${cash(v)} · ${num(n)} orders`);
  $("repStatus").innerHTML = bar(Object.keys(STATUS_EN).map((s) => [STATUS_EN[s], all.filter((o) => o.status === s).length]), (v) => num(v));
  const sold = {};
  valid.forEach((o) => { let lines = []; try { lines = JSON.parse(o.itemsJson); } catch (e) { /* ignore */ } lines.forEach((l) => { const k = l.name; sold[k] = sold[k] || { qty: 0, rev: 0 }; sold[k].qty += Number(l.qty) || 0; sold[k].rev += (Number(l.price) || 0) * (Number(l.qty) || 0); }); });
  $("repTop").innerHTML = bar(Object.entries(sold).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8).map(([k, v]) => [k, v.qty, v.rev]), (q, r) => `${num(q)} sold · ${cash(r)}`);
  const monthly = days === 365;
  REPORT_ROWS = salesBuckets(days).map((b) => [b.full, b.orders, Math.round(b.rev), b.orders ? Math.round(b.rev / b.orders) : 0]);
  $("repTable").innerHTML = `<thead><tr><th>${monthly ? "Month" : days === 90 ? "Week" : "Date"}</th><th>Orders</th><th>Revenue</th><th>Avg. order</th></tr></thead><tbody>` +
    REPORT_ROWS.slice().reverse().map((r) => `<tr><td>${esc(r[0])}</td><td>${num(r[1])}</td><td>${cash(r[2])}</td><td>${cash(r[3])}</td></tr>`).join("") + `</tbody>`;
}
$("repRange").addEventListener("change", renderReports);
$("repCsv").addEventListener("click", () => downloadCsv("sales-report.csv", [["Period", "Orders", "Revenue", "Average order"]].concat(REPORT_ROWS)));

/* ---------- entry point called by admin.js after every data load ---------- */
function renderAdminShell() {
  $("admYear").textContent = new Date().getFullYear();
  renderKpis(); renderSales(); renderRecent(); renderTop(); renderLowStock(); renderNotices(); renderDataWarning();
  document.body.classList.remove("adm-loading");
  if (ADM.view === "customers") renderCustomers();
  if (ADM.view === "reports") renderReports();
  if (ADM.view === "courier" && typeof renderCourier === "function") renderCourier();
}

// open the view from the URL hash (e.g. admin.html#orders) once the app is shown
(function initView() {
  const h = (location.hash || "").slice(1);
  if (h && document.getElementById("tab-" + h)) showView(h, { noHash: true, keepScroll: true });
})();


/* ---------- icons: fill every [data-ico] with a Font Awesome glyph (design layer; safe if FA fails to load) ---------- */
const ADM_ICONS = {
  dashboard: "fa-house", products: "fa-cube", orders: "fa-cart-shopping", customers: "fa-user-group", reviews: "fa-comment-dots",
  coupons: "fa-ticket", marketing: "fa-bullhorn", appearance: "fa-palette", settings: "fa-gear", reports: "fa-chart-column",
  users: "fa-user-shield", help: "fa-circle-question", menu: "fa-bars", search: "fa-magnifying-glass", bell: "fa-bell",
  chart: "fa-chart-simple", bolt: "fa-bolt", trophy: "fa-trophy", "add-product": "fa-cube", warn: "fa-triangle-exclamation", courier: "fa-truck-fast"
};
(function paintIcons() {
  document.querySelectorAll("[data-ico]").forEach((el) => {
    const cls = ADM_ICONS[el.dataset.ico];
    if (cls && !el.firstElementChild) el.innerHTML = `<i class="fa-solid ${cls}" aria-hidden="true"></i>`;
  });
  const kpi = { orders: "fa-bag-shopping", customers: "fa-user-group", revenue: "fa-sack-dollar", reviews: "fa-star" };
  Object.keys(kpi).forEach((k) => {
    const el = document.querySelector(`[data-kpi="${k}"] .kpi-icon`);
    if (el && !el.firstElementChild) el.innerHTML = `<i class="fa-solid ${kpi[k]}" aria-hidden="true"></i>`;
  });
})();
