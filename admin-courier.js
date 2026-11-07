/* =====================================================================
   Couriers: connect Steadfast / Pathao (API) or book with Sundarban / CarryBee (manual tracking number).
   Backend: google-apps-script.gs (courierConfig / saveCourier / testCourier / sendToCourier / saveManualTracking / syncCourier).
   ===================================================================== */

const CR = { sel: "", stores: null };
const crProviders = () => (S.courier && S.courier.providers) || [];
const crProv = (id) => crProviders().find((p) => p.id === id);
const crName = (id) => (crProv(id) || {}).name || "Courier";
const crActive = () => crProv(S.courier && S.courier.active);
const courierReady = () => !!(S.courier && S.courier.hasKeys); // the default courier is an API courier that is connected
const courierIsApi = (id) => { const p = crProv(id); return !!p && p.type === "api"; };

const COURIER_LABEL_EN = {
  pending: "Pending pickup", in_review: "In review", hold: "On hold", delivered: "Delivered", partial_delivered: "Partially delivered", cancelled: "Cancelled", unknown: "Unknown",
  delivered_approval_pending: "Delivered (awaiting approval)", partial_delivered_approval_pending: "Partially delivered (awaiting approval)", cancelled_approval_pending: "Cancelled (awaiting approval)", unknown_approval_pending: "Unknown (awaiting approval)",
  booked: "Booked with courier"
};
const courierLabelOf = (s) => COURIER_LABEL_EN[String(s)] || String(s || "Pending");
const courierPillClass = (s) => { s = String(s).toLowerCase(); return /^delivered|^partial/.test(s) ? "is-delivered" : /cancel|return|fail/.test(s) ? "is-cancelled" : "is-pending"; };
const courierFinal = (o) => {
  const s = String(o.courierStatus || "").toLowerCase();
  if (!courierIsApi(o.courier)) return true; // manual couriers have no automatic status
  return o.courier === "steadfast" ? ["delivered", "partial_delivered", "cancelled"].indexOf(s) >= 0 : ["delivered", "partial delivery", "cancelled", "return"].indexOf(s) >= 0;
};
const courierTrackUrl = (o) => {
  if (!o.trackingCode) return "";
  if (o.courier === "steadfast") return "https://steadfast.com.bd/t/" + encodeURIComponent(o.trackingCode);
  if (o.courier === "pathao") return "https://merchant.pathao.com/tracking?consignment_id=" + encodeURIComponent(o.trackingCode) + "&phone=" + String(o.phone || "").replace(/\D/g, "").slice(-11);
  const p = crProv(o.courier); return p && p.trackPage ? p.trackPage : "";
};

/* ---------- block shown inside every order card (Orders page) ---------- */
function courierBlock(o) {
  if (o.consignmentId) {
    const st = String(o.courierStatus || "pending"), url = courierTrackUrl(o), manual = !courierIsApi(o.courier);
    return `<div class="o-courier"><span class="o-courier-ico">🚚</span><span><b>${esc(crName(o.courier))}</b> · ${manual ? "CN" : "Tracking"} <b>${esc(o.trackingCode || o.consignmentId)}</b></span>
      <span class="status-pill ${courierPillClass(st)}">${esc(courierLabelOf(st))}</span>
      ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Track ↗</a>` : ""}
      ${courierFinal(o) ? "" : `<button type="button" data-courier-sync="${esc(o.orderId)}">🔄 Refresh</button>`}
      <button type="button" data-courier-manual="${esc(o.orderId)}" title="Change the courier or tracking number">✏️</button></div>`;
  }
  if (o.status === "বাতিল") return "";
  if (courierReady()) return `<div class="o-courier"><button type="button" class="o-courier-send" data-courier-send="${esc(o.orderId)}">🚚 Send to ${esc(crName(S.courier.active))}</button><button type="button" data-courier-manual="${esc(o.orderId)}">📦 Add tracking manually</button><span class="o-meta">Sending creates the delivery and a tracking code</span></div>`;
  return `<div class="o-courier"><button type="button" class="o-courier-send" data-courier-manual="${esc(o.orderId)}">📦 Add courier tracking</button><span class="o-meta">or</span> <button type="button" data-goto="courier">Connect a courier</button></div>`;
}

/* ---------- actions ---------- */
async function courierSendOrders(ids, btn) {
  if (!ids.length) return toast("No orders to send");
  const old = btn ? btn.textContent : ""; if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
  let ok = 0; const errs = [];
  try {
    for (let i = 0; i < ids.length; i += 15) {
      const r = await call("sendToCourier", { orderIds: ids.slice(i, i + 15) });
      (r.results || []).forEach((x) => { if (x.ok) ok++; else errs.push(`${x.orderId}: ${x.error}`); });
      if (btn && ids.length > 15) btn.textContent = `Sending… ${Math.min(i + 15, ids.length)}/${ids.length}`;
    }
    toast(ok ? `✅ ${ok} order${ok === 1 ? "" : "s"} sent to the courier` : "⚠️ Nothing was sent");
    if (errs.length) alert("Some orders were not sent:\n\n" + errs.slice(0, 8).join("\n"));
    await loadAll();
  } catch (err) { toast("⚠️ " + err.message); }
  if (btn) { btn.disabled = false; btn.textContent = old; }
}
async function courierSyncNow(ids, btn, quiet) {
  const old = btn ? btn.textContent : ""; if (btn) { btn.disabled = true; btn.textContent = "Syncing…"; }
  try {
    const r = await call("syncCourier", ids ? { orderIds: ids } : {});
    if (!quiet) toast(r.checked ? `✅ Checked ${r.checked} · ${r.changed} updated${r.remaining ? ` · ${r.remaining} more next time` : ""}` : "Nothing to update");
    if (r.changed || !quiet) await loadAll();
    try { localStorage.setItem("courierSyncedAt", String(Date.now())); } catch (e) { /* ignore */ }
  } catch (err) { if (!quiet) toast("⚠️ " + err.message); }
  if (btn) { btn.disabled = false; btn.textContent = old; }
}

// Add / change a courier + tracking number by hand (Sundarban, CarryBee, or any courier)
function courierManualModal(orderId) {
  const o = S.orders.find((x) => x.orderId === orderId); if (!o) return;
  const provs = crProviders();
  const def = o.courier || (S.courier && S.courier.active && !courierIsApi(S.courier.active) ? S.courier.active : (provs.find((p) => p.type === "manual") || provs[0] || {}).id);
  openModal(`<h3>Courier tracking for #${esc(o.orderId)}</h3>
    <p class="a-hint">Book the parcel in your courier's own portal first, then save its number here. The customer gets the number and a tracking link${S.courier && S.courier.markShipped ? ", and the order becomes “Shipped”" : ""}.</p>
    <label>Courier<select name="courier">${provs.map((p) => `<option value="${esc(p.id)}"${p.id === def ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label id="crCodeLabel">Tracking / CN number<input name="code" required maxlength="40" placeholder="e.g. 1234567890" value="${esc(o.trackingCode || "")}"></label>`,
  async (fd) => { await call("saveManualTracking", { orderId, courier: fd.get("courier"), code: String(fd.get("code") || "").trim() }); });
  const sel = modalForm.elements.courier, lab = () => { const p = crProv(sel.value); $("crCodeLabel").firstChild.textContent = (p && p.codeLabel ? p.codeLabel : "Tracking number"); };
  sel.addEventListener("change", lab); lab();
}

$("ordersList").addEventListener("click", (e) => {
  const s = e.target.closest("[data-courier-send]"), r = e.target.closest("[data-courier-sync]"), m = e.target.closest("[data-courier-manual]");
  if (s) courierSendOrders([s.dataset.courierSend], s);
  if (r) courierSyncNow([r.dataset.courierSync], r);
  if (m) courierManualModal(m.dataset.courierManual);
});

/* ---------- Courier page ---------- */
function crFieldHtml(f) {
  if (f.bool) return `<label class="opt"><input type="checkbox" data-cf="${esc(f.key)}"${f.value ? " checked" : ""}> <span>${esc(f.label)}</span></label>`;
  return `<label>${esc(f.label)}<input data-cf="${esc(f.key)}" type="${f.secret ? "password" : "text"}" autocomplete="${f.secret ? "new-password" : "off"}" spellcheck="false" value="${esc(f.value)}" placeholder="${esc(f.label)}"></label>`;
}
const CR_HELP = {
  steadfast: ["Log in to your <b>Steadfast merchant panel</b> (steadfast.com.bd).", "Open <b>Settings → API</b> (the menu name can differ slightly) and copy the <b>API Key</b> and <b>Secret Key</b>.", "Paste them here and click <b>Save &amp; connect</b>."],
  pathao: ["Log in to your <b>Pathao Merchant</b> account and open the <b>Developer / Merchant API</b> section.", "Copy your <b>Client ID</b> and <b>Client Secret</b>. Use the same <b>email and password</b> you log in to Pathao with.", "Click <b>Save &amp; connect</b>, then <b>Test connection</b> — your stores will appear so you can pick the <b>Store ID</b>. Try the <b>sandbox</b> option first if you want to practise."]
};
function renderCourierFields() {
  const p = crProv(CR.sel); if (!p) return;
  const box = $("courierFields");
  if (p.type === "api") {
    box.innerHTML = p.fields.map(crFieldHtml).join("") + `<div id="courierStores" class="courier-stores" hidden></div>` +
      `<details class="courier-help"><summary>Where do I find these details?</summary><ol>${(CR_HELP[p.id] || []).map((x) => `<li>${x}</li>`).join("")}</ol>
       ${p.id === "pathao" ? `<p class="a-hint">Pathao's technical documentation is only available inside the merchant portal, so this connection follows their published API pattern. Please send <b>one real test order</b> after connecting and check it appears in your Pathao dashboard.</p>` : ""}
       <p class="a-hint">Your details are stored privately inside Apps Script (not in the Google Sheet) and are never shown in full again.</p></details>`;
    $("courierTestBtn").hidden = false;
  } else {
    box.innerHTML = `<div class="courier-manual"><b>${esc(p.name)} is booked manually</b>
      <p>${esc(p.name)} does not offer a public connection (API) for online shops yet, so parcels are booked in ${esc(p.name)}'s own portal. After booking, open the order in <b>Orders</b> and click <b>📦 Add tracking</b> — paste the ${esc((p.codeLabel || "tracking number").toLowerCase())}.</p>
      <ul><li>The customer receives the number and a tracking link (SMS/email) and sees it on your Track Order page.</li><li>The order becomes “Shipped” automatically (if enabled below).</li><li>Mark the order “Delivered” yourself when it arrives.</li></ul>
      ${p.trackPage ? `<p><a href="${esc(p.trackPage)}" target="_blank" rel="noopener">Open ${esc(p.name)}'s tracking page ↗</a></p>` : ""}
      <p class="a-hint">If ${esc(p.name)} gives you API access later, tell the developer and it can be connected here.</p></div>`;
    $("courierTestBtn").hidden = true;
  }
  const f = $("courierForm").elements;
  f.makeDefault.checked = S.courier && S.courier.active === CR.sel;
  f.makeDefault.nextElementSibling.textContent = `Use ${p.name} as my default courier`;
}

function renderCourier() {
  const c = S.courier, f = $("courierForm"); if (!f || !c) return;
  if (!CR.sel || !crProv(CR.sel)) CR.sel = c.active || "steadfast";
  const act = crActive(), ready = courierReady();
  $("courierStatus").className = "courier-status " + (ready ? "is-on" : "is-off");
  $("courierStatus").innerHTML = ready
    ? `<b>✅ ${esc(act.name)} connected</b><span>Orders can be sent in one click</span>`
    : act && act.type === "manual" ? `<b>${esc(act.name)} (manual)</b><span>Add the tracking number on each order — customers still get the tracking link</span>`
      : `<b>No courier connected yet</b><span>Pick your courier below and add its details. It takes about 2 minutes.</span>`;
  $("courierProviders").innerHTML = crProviders().map((p) => `<button type="button" class="prov-card${p.id === CR.sel ? " is-on" : ""}" role="radio" aria-checked="${p.id === CR.sel}" data-prov="${esc(p.id)}">
      <span class="prov-name">${esc(p.name)}</span>
      <span class="prov-tags">${p.id === c.active ? `<i class="tag-default">Default</i>` : ""}${p.type === "api" ? (p.connected ? `<i class="tag-ok">Connected</i>` : `<i class="tag-off">Not connected</i>`) : `<i class="tag-manual">Manual tracking</i>`}</span></button>`).join("");
  renderCourierFields();
  f.elements.markShipped.checked = !!c.markShipped; f.elements.autoSend.checked = !!c.autoSend;
  f.elements.syncStatus.checked = !!c.syncStatus; f.elements.hourlySync.checked = !!c.hourlySync;

  const withCourier = S.orders.filter((o) => o.consignmentId);
  const toSend = S.orders.filter((o) => o.status === "কনফার্মড" && !o.consignmentId);
  const active = withCourier.filter((o) => !courierFinal(o) || (!courierIsApi(o.courier) && o.status === "শিপড"));
  $("courierStats").innerHTML = [
    ["With a courier", withCourier.length], ["On the way", active.length],
    ["Delivered", withCourier.filter((o) => o.status === "ডেলিভারড").length], ["Confirmed, not sent yet", toSend.length]
  ].map(([l, v]) => `<div class="stat"><small>${l}</small><b>${num(v)}</b></div>`).join("");
  $("courierSendAll").textContent = toSend.length ? `🚚 Send ${num(toSend.length)} confirmed order${toSend.length === 1 ? "" : "s"} to ${esc(act ? act.name : "courier")}` : "🚚 Send confirmed orders (none waiting)";
  $("courierSendAll").disabled = !ready || !toSend.length;
  $("courierSyncNow").disabled = !withCourier.some((o) => courierIsApi(o.courier));
  $("courierTable").innerHTML = `<thead><tr><th>Order</th><th>Customer</th><th>Courier</th><th>Tracking</th><th>Status</th><th>Updated</th></tr></thead><tbody>` +
    (withCourier.slice(0, 40).map((o) => { const st = String(o.courierStatus || "pending"), url = courierTrackUrl(o);
      return `<tr><td><b>#${esc(o.orderId)}</b></td><td>${esc(o.name)}</td><td>${esc(crName(o.courier))}</td><td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(o.trackingCode)} ↗</a>` : esc(o.trackingCode || "—")}</td><td><span class="status-pill ${courierPillClass(st)}">${esc(courierLabelOf(st))}</span></td><td>${esc(o.courierUpdated || "")}</td></tr>`; }).join("")
      || `<tr><td colspan="6" class="empty">No orders have been given to a courier yet.</td></tr>`) + `</tbody>`;
}

function courierPayload() {
  const f = $("courierForm").elements, p = crProv(CR.sel), creds = {};
  if (p && p.type === "api") {
    creds[p.id] = {};
    $("courierFields").querySelectorAll("[data-cf]").forEach((el) => { creds[p.id][el.dataset.cf] = el.type === "checkbox" ? el.checked : el.value.trim(); });
  }
  return { active: f.makeDefault.checked ? CR.sel : (S.courier ? S.courier.active : CR.sel), creds, markShipped: f.markShipped.checked, autoSend: f.autoSend.checked, syncStatus: f.syncStatus.checked, hourlySync: f.hourlySync.checked };
}
function courierMsg(t, ok) { const m = $("courierMsg"); m.className = "form-msg " + (ok ? "ok" : "err"); m.textContent = t; }

function paintStores(stores) {
  const box = $("courierStores"); if (!box) return;
  if (!stores || !stores.length) { box.hidden = true; return; }
  const cur = $("courierFields").querySelector('[data-cf="storeId"]');
  box.hidden = false;
  box.innerHTML = `<label>Your Pathao stores <select id="courierStoreSel"><option value="">— pick your store —</option>${stores.map((s) => `<option value="${esc(s.id)}"${cur && cur.value === s.id ? " selected" : ""}>${esc(s.name)} (ID ${esc(s.id)})</option>`).join("")}</select></label>`;
  $("courierStoreSel").addEventListener("change", (e) => { if (cur) cur.value = e.target.value; });
}

$("courierProviders").addEventListener("click", (e) => {
  const b = e.target.closest("[data-prov]"); if (!b) return;
  CR.sel = b.dataset.prov; renderCourier();
});
$("courierForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter || $("courierForm").querySelector("[type=submit]"); btn.disabled = true;
  courierMsg("Saving…", true);
  const p = crProv(CR.sel);
  try {
    S.courier = await call("saveCourier", { config: courierPayload() });
    renderCourier(); renderOrders();
    if (p && p.type === "api" && crProv(CR.sel).connected) {
      courierMsg("Saved — testing the connection…", true);
      const t = await call("testCourier", { provider: CR.sel });
      courierMsg("✅ " + t.message, true); paintStores(t.stores);
    } else if (p && p.type === "api") courierMsg("✅ Saved. Fill in every field to connect.", true);
    else courierMsg("✅ Saved.", true);
  } catch (err) { courierMsg("⚠️ " + err.message, false); }
  btn.disabled = false;
});
$("courierTestBtn").addEventListener("click", async (e) => {
  const b = e.currentTarget; b.disabled = true; courierMsg("Testing…", true);
  try { const t = await call("testCourier", { provider: CR.sel }); courierMsg("✅ " + t.message, true); paintStores(t.stores); }
  catch (err) { courierMsg("⚠️ " + err.message, false); }
  b.disabled = false;
});
$("courierSendAll").addEventListener("click", (e) => {
  const ids = S.orders.filter((o) => o.status === "কনফার্মড" && !o.consignmentId).map((o) => o.orderId);
  if (ids.length && confirm(`Send ${ids.length} confirmed order(s) to ${crName(S.courier.active)} now?`)) courierSendOrders(ids, e.currentTarget);
});
$("courierSyncNow").addEventListener("click", (e) => courierSyncNow(null, e.currentTarget));

// When the Courier page is opened, refresh statuses automatically (at most once every 5 minutes)
function courierOpened() {
  renderCourier();
  let last = 0; try { last = Number(localStorage.getItem("courierSyncedAt") || 0); } catch (e) { /* ignore */ }
  if (Date.now() - last > 5 * 60 * 1000 && S.orders.some((o) => o.consignmentId && courierIsApi(o.courier) && !courierFinal(o))) courierSyncNow(null, null, true);
}
