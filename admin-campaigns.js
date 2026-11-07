/* =====================================================================
   Campaigns: a guided 3-step wizard to send an offer to past customers by SMS and/or email.
   Step 1 Audience → Step 2 Message (+ coupon, + website banner) → Step 3 Review & send.
   The server (google-apps-script.gs) resolves the audience and sends in batches; this file only collects
   the choices, validates them, shows a live preview and drives the progress bar.
   ===================================================================== */

const CAMP = { step: 1, d: null, info: null, preview: null, running: false, token: 0 };

const CAMP_AUDIENCES = [
  { id: "all", title: "All customers", text: "Everyone who has ordered from you." },
  { id: "recent", title: "Recent customers", text: "Ordered within the last few days.", needs: "days", label: "In the last", unit: "days" },
  { id: "repeat", title: "Repeat customers", text: "Ordered 2 or more times — your loyal fans." },
  { id: "new", title: "First-time customers", text: "Ordered only once — encourage a second order." },
  { id: "inactive", title: "Win-back", text: "Have not ordered for a while.", needs: "days", label: "No order for", unit: "days" },
  { id: "big", title: "Big spenders", text: "Customers who spent a lot in total.", needs: "minSpent", label: "Spent at least", unit: "৳" }
];
const CAMP_TEMPLATES = [
  { id: "festival", label: "🎉 Festival offer", name: "Festival offer", subject: "A special offer from {shop} 🎉", message: "Hi {name}, our festival offer is live at {shop}! Use code {coupon} on your next order and save. Order today for fast delivery." },
  { id: "winback", label: "💌 We miss you", name: "Win-back", subject: "We miss you at {shop}", message: "Hi {name}, we miss you at {shop}! Here is a special code {coupon} for your next order. See you soon!", audience: "inactive" },
  { id: "launch", label: "🆕 New products", name: "New arrivals", subject: "New arrivals at {shop}", message: "Hi {name}, new products have just arrived at {shop}. Be the first to try them — order today!" },
  { id: "thanks", label: "🙏 Thank you + review", name: "Thank you", subject: "Thank you from {shop}", message: "Hi {name}, thank you for shopping with {shop}! Share your feedback on our website, and use code {coupon} on your next order.", audience: "recent" }
];

const campDefault = () => ({
  name: "", audience: { type: "all", days: 30, minSpent: 3000, area: "" },
  sms: true, email: false, subject: "", message: "",
  couponMode: "none", coupon: "", newCoupon: { code: "", type: "percent", value: 10, minOrder: 0, expires: "" },
  banner: { on: false, text: "", end: "" }
});
const campAudMeta = (id) => CAMP_AUDIENCES.find((a) => a.id === id) || CAMP_AUDIENCES[0];
const campAudLabel = (a) => {
  const m = campAudMeta(a.type);
  const extra = m.needs === "days" ? ` (${a.days} days)` : m.needs === "minSpent" ? ` (≥ ৳${num(a.minSpent)})` : "";
  return m.title + extra + (a.area === "inside" ? " · Inside Dhaka" : a.area === "outside" ? " · Outside Dhaka" : "");
};
const campChannel = (d) => (d.sms && d.email ? "both" : d.email ? "email" : "sms");

/* ---------- SMS length (GSM 160 / Unicode 70 per part) ---------- */
function smsParts(text) {
  const uni = /[^\x00-\x7F]/.test(text), single = uni ? 70 : 160, multi = uni ? 67 : 153, len = text.length;
  return { len, parts: len === 0 ? 0 : len <= single ? 1 : Math.ceil(len / multi), unicode: uni };
}
const campSample = (d) => {
  const coupon = d.couponMode === "new" ? (d.newCoupon.code || "YOURCODE") : d.couponMode === "existing" ? (d.coupon || "YOURCODE") : "YOURCODE";
  return (t) => String(t).replace(/\{name\}/g, "Rahim").replace(/\{coupon\}/g, coupon).replace(/\{shop\}/g, "KhatiGhor");
};
const campCouponCode = (d) => (d.couponMode === "new" ? d.newCoupon.code.trim().toUpperCase() : d.couponMode === "existing" ? d.coupon : "");

/* ---------- entry points ---------- */
async function loadCampaigns() {
  try {
    const r = await call("campaigns");
    const rows = r.campaigns || [];
    $("campList").innerHTML = `<div class="table-wrap"><table class="a-table"><thead><tr><th>Campaign</th><th>Sent on</th><th>Audience</th><th>Channel</th><th>Customers</th><th>Delivered</th><th>Failed</th><th>Status</th></tr></thead><tbody>` +
      (rows.map((c) => {
        let aud = {}; try { aud = JSON.parse(c.audience || "{}"); } catch (e) { /* ignore */ }
        const st = c.status === "done" ? "is-delivered" : c.status === "failed" ? "is-cancelled" : "is-pending";
        return `<tr><td><b>${esc(c.name)}</b>${c.coupon ? ` <span class="pill">🎟️ ${esc(c.coupon)}</span>` : ""}</td><td>${esc(c.date)}</td><td>${esc(campAudLabel(Object.assign({ type: "all", days: 30, minSpent: 3000 }, aud)))}</td><td>${esc({ sms: "SMS", email: "Email", both: "SMS + Email" }[c.channel] || c.channel)}</td><td>${num(c.recipients)}</td><td>${num(c.sent)}</td><td>${num(c.failed)}</td><td><span class="status-pill ${st}">${esc(c.status === "done" ? "Sent" : c.status === "failed" ? "Failed" : "Sending…")}</span></td></tr>`;
      }).join("") || `<tr><td colspan="8" class="empty">No campaigns yet. Click <b>New campaign</b> to send your first offer.</td></tr>`) + `</tbody></table></div>`;
  } catch (err) { $("campList").innerHTML = `<div class="a-card">⚠️ ${esc(err.message)}</div>`; }
}

async function startCampaign() {
  CAMP.d = campDefault(); CAMP.step = 1; CAMP.preview = null; CAMP.running = false;
  $("campIntro").hidden = true; $("campList").hidden = true; $("newCampaign").hidden = true; $("campWizard").hidden = false;
  renderCampWizard();
  call("campaignInfo").then((r) => { CAMP.info = r; if (CAMP.step === 2) renderCampWizard(); }).catch(() => {});
  loadCampPreview();
}
function exitCampaign() {
  $("campWizard").hidden = true; $("campIntro").hidden = false; $("campList").hidden = false; $("newCampaign").hidden = false;
  loadCampaigns();
}

let campPreviewTimer;
function loadCampPreview() {
  clearTimeout(campPreviewTimer);
  const t = ++CAMP.token;
  CAMP.preview = null; paintCampPreview();
  campPreviewTimer = setTimeout(async () => {
    try { const r = await call("campaignPreview", { audience: CAMP.d.audience }); if (t === CAMP.token) { CAMP.preview = r; paintCampPreview(); } }
    catch (err) { if (t === CAMP.token) { CAMP.preview = { error: err.message }; paintCampPreview(); } }
  }, 250);
}
function paintCampPreview() {
  const box = $("campPreview"); if (!box) return;
  const p = CAMP.preview;
  if (!p) { box.innerHTML = `<span class="camp-muted">Counting customers…</span>`; }
  else if (p.error) { box.innerHTML = `<span class="camp-bad">⚠️ ${esc(p.error)}</span>`; }
  else if (!p.total) { box.innerHTML = `<b class="camp-bad">0 customers match</b><span class="camp-muted">Try another audience or a wider time range.</span>`; }
  else { box.innerHTML = `<div class="camp-count"><b>${num(p.total)}</b> customer${p.total === 1 ? "" : "s"} will receive this</div><div class="camp-muted">📱 ${num(p.withPhone)} with a mobile number (SMS) · ✉️ ${num(p.withEmail)} with an email</div>${p.sample.length ? `<div class="camp-muted">e.g. ${p.sample.map(esc).join(", ")}${p.total > p.sample.length ? "…" : ""}</div>` : ""}`; }
  const next = $("campNext1"); if (next) next.disabled = !(p && p.total > 0) || !CAMP.d.name.trim();
}

/* ---------- rendering ---------- */
const stepper = () => `<ol class="camp-steps" aria-label="Campaign steps">${["Audience", "Message", "Review & send"].map((t, i) => `<li class="${CAMP.step === i + 1 ? "is-current" : CAMP.step > i + 1 ? "is-done" : ""}"><span>${CAMP.step > i + 1 ? "✓" : i + 1}</span>${t}</li>`).join("")}</ol>`;

function renderCampWizard() {
  const d = CAMP.d, el = $("campWizard");
  el.innerHTML = `<div class="dash-card camp-card">${stepper()}${CAMP.step === 1 ? stepAudience(d) : CAMP.step === 2 ? stepMessage(d) : stepReview(d)}</div>`;
  if (CAMP.step === 1) paintCampPreview();
  if (CAMP.step === 2) { paintCounter(); paintBubble(); }
  window.scrollTo({ top: 0 });
}

function stepAudience(d) {
  const a = d.audience;
  const cards = CAMP_AUDIENCES.map((m) => `<label class="aud-card${a.type === m.id ? " is-on" : ""}"><input type="radio" name="aud" value="${m.id}"${a.type === m.id ? " checked" : ""}><span class="aud-title">${m.title}</span><span class="aud-text">${m.text}</span>
      ${a.type === m.id && m.needs ? `<span class="aud-extra">${m.label} <input type="number" min="${m.needs === "days" ? 1 : 0}" data-aud="${m.needs}" value="${a[m.needs]}"> ${m.unit}</span>` : ""}</label>`).join("");
  return `<h2>Who should get this offer?</h2><p class="camp-lead">Choose a group of your past customers. We only message people who have ordered from you.</p>
    <label class="camp-field">Campaign name <small>(only you see this)</small><input data-f="name" maxlength="60" placeholder="e.g. Eid offer 2026" value="${esc(d.name)}"></label>
    <div class="aud-grid" role="radiogroup" aria-label="Audience">${cards}</div>
    <label class="camp-field camp-narrow">Delivery area <select data-aud="area"><option value="">Anywhere</option><option value="inside"${a.area === "inside" ? " selected" : ""}>Inside Dhaka only</option><option value="outside"${a.area === "outside" ? " selected" : ""}>Outside Dhaka only</option></select></label>
    <div class="camp-preview" id="campPreview" aria-live="polite"></div>
    <div class="camp-nav"><button type="button" class="btn btn-outline" data-camp="cancel">Cancel</button><button type="button" class="btn" id="campNext1" data-camp="next" disabled>Next: write message →</button></div>`;
}

function stepMessage(d) {
  const info = CAMP.info || {};
  const smsNote = info.smsReady === false ? `<small class="camp-bad">SMS gateway not set up — <a href="#" data-goto="notify">set it up</a></small>` : `<small class="camp-muted">Sent through your SMS gateway</small>`;
  const mailNote = `<small class="camp-muted">${info.emailQuota != null ? `${num(info.emailQuota)} emails left today (Gmail limit)` : "Sent from your Gmail"}</small>`;
  const activeCoupons = (S.coupons || []).filter((c) => String(c.active).toUpperCase() !== "FALSE" && !couponExpired(c));
  const nc = d.newCoupon;
  return `<h2>Write your message</h2><p class="camp-lead">Pick a template to start fast, or write your own. <b>{name}</b> becomes the customer's first name.</p>
    <div class="camp-field"><span class="camp-label">Send by</span>
      <div class="chan-grid">
        <label class="chan-card${d.sms ? " is-on" : ""}"><input type="checkbox" data-ch="sms"${d.sms ? " checked" : ""}><span class="chan-title">📱 SMS</span>${smsNote}</label>
        <label class="chan-card${d.email ? " is-on" : ""}"><input type="checkbox" data-ch="email"${d.email ? " checked" : ""}><span class="chan-title">✉️ Email</span>${mailNote}</label>
      </div></div>
    <div class="camp-field"><span class="camp-label">Quick templates</span><div class="chip-row">${CAMP_TEMPLATES.map((t) => `<button type="button" class="chip" data-tpl="${t.id}">${t.label}</button>`).join("")}</div></div>
    ${d.email ? `<label class="camp-field">Email subject<input data-f="subject" maxlength="120" placeholder="e.g. A special offer from {shop}" value="${esc(d.subject)}"></label>` : ""}
    <div class="camp-field"><label class="camp-label" for="campMsg">Message</label>
      <textarea id="campMsg" data-f="message" rows="5" maxlength="600" placeholder="Hi {name}, …">${esc(d.message)}</textarea>
      <div class="camp-msg-foot"><div class="chip-row small">Insert: ${["{name}", "{coupon}", "{shop}"].map((v) => `<button type="button" class="chip" data-ins="${v}">${v}</button>`).join("")}</div><span class="camp-counter" id="campCounter"></span></div></div>
    <fieldset class="camp-field camp-coupon"><legend class="camp-label">Add a coupon <small>(optional — customers type it at checkout)</small></legend>
      <label class="opt"><input type="radio" name="cmode" value="none"${d.couponMode === "none" ? " checked" : ""}> No coupon</label>
      <label class="opt"><input type="radio" name="cmode" value="existing"${d.couponMode === "existing" ? " checked" : ""}> Use an existing coupon</label>
      ${d.couponMode === "existing" ? `<select data-f="coupon"><option value="">— Select a coupon —</option>${activeCoupons.map((c) => `<option value="${esc(c.code)}"${d.coupon === c.code ? " selected" : ""}>${esc(c.code)} — ${c.type === "flat" ? "৳" + num(c.value) + " off" : num(c.value) + "% off"}${c.expires ? " · until " + esc(fmtDay(c.expires)) : ""}</option>`).join("")}</select>${activeCoupons.length ? "" : `<small class="camp-bad">You have no active coupons yet — create a new one instead.</small>`}` : ""}
      <label class="opt"><input type="radio" name="cmode" value="new"${d.couponMode === "new" ? " checked" : ""}> Create a new coupon</label>
      ${d.couponMode === "new" ? `<div class="camp-newcoupon"><label>Code<input data-nc="code" maxlength="20" placeholder="e.g. EID10" value="${esc(nc.code)}" style="text-transform:uppercase"></label>
        <label>Discount type<select data-nc="type"><option value="percent"${nc.type === "percent" ? " selected" : ""}>Percentage (%)</option><option value="flat"${nc.type === "flat" ? " selected" : ""}>Fixed amount (৳)</option></select></label>
        <label>${nc.type === "flat" ? "Amount (৳)" : "Percent (%)"}<input type="number" min="1" data-nc="value" value="${esc(nc.value)}"></label>
        <label>Minimum order (৳)<input type="number" min="0" data-nc="minOrder" value="${esc(nc.minOrder)}"></label>
        <label>Valid until <small>(optional)</small><input type="date" data-nc="expires" value="${esc(nc.expires || "")}"></label></div>` : ""}
    </fieldset>
    <fieldset class="camp-field camp-banner"><legend class="camp-label">Promote on your website too</legend>
      <label class="opt"><input type="checkbox" data-bn="on"${d.banner.on ? " checked" : ""}> Show this offer in the site's top banner</label>
      ${d.banner.on ? `<div class="camp-newcoupon"><label>Banner text<input data-bn="text" maxlength="150" placeholder="e.g. 🎉 Eid offer — use code EID10 and save!" value="${esc(d.banner.text)}"></label>
        <label>Offer ends <small>(optional, starts a countdown)</small><input type="datetime-local" data-bn="end" value="${esc(d.banner.end)}"></label></div>` : ""}
    </fieldset>
    <div class="camp-bubble-wrap"><span class="camp-label">Preview <small>(for a customer called "Rahim")</small></span><div class="camp-bubble" id="campBubble"></div></div>
    <p class="camp-error" id="campErr" role="alert"></p>
    <div class="camp-nav"><button type="button" class="btn btn-outline" data-camp="back">← Back</button><button type="button" class="btn" data-camp="next">Next: review →</button></div>`;
}

function stepReview(d) {
  const p = CAMP.preview || { total: 0, withPhone: 0, withEmail: 0 };
  const s = campSample(d), code = campCouponCode(d);
  const smsN = d.sms ? p.withPhone : 0, mailN = d.email ? p.withEmail : 0;
  const parts = smsParts(s(d.message)).parts;
  const rows = [
    ["Campaign", esc(d.name)],
    ["Audience", `${esc(campAudLabel(d.audience))} — <b>${num(p.total)}</b> customers`],
    ["Will send", [d.sms ? `📱 <b>${num(smsN)}</b> SMS${parts > 1 ? ` (${parts} parts each)` : ""}` : "", d.email ? `✉️ <b>${num(mailN)}</b> emails` : ""].filter(Boolean).join(" &nbsp;·&nbsp; ")],
    ["Coupon", code ? `🎟️ <b>${esc(code)}</b>${d.couponMode === "new" ? " <small>(will be created)</small>" : ""}` : "None"],
    ["Website banner", d.banner.on ? `On — "${esc(d.banner.text)}"${d.banner.end ? ` until ${esc(d.banner.end.replace("T", " "))}` : ""}` : "Off"]
  ];
  const warn = [];
  if (d.email && CAMP.info && CAMP.info.emailQuota != null && mailN > CAMP.info.emailQuota) warn.push(`Only ${num(CAMP.info.emailQuota)} emails can be sent today (Gmail limit) — the rest will fail.`);
  if (d.sms) warn.push("Your SMS provider may charge for each message.");
  return `<h2>Review and send</h2><p class="camp-lead">Check everything once. Messages cannot be recalled after sending.</p>
    <dl class="camp-review">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    <div class="camp-bubble-wrap"><span class="camp-label">Message preview</span>${d.email ? `<div class="camp-subject">Subject: ${esc(s(d.subject))}</div>` : ""}<div class="camp-bubble">${esc(s(d.message))}</div></div>
    ${warn.map((w) => `<p class="camp-warn">⚠️ ${esc(w)}</p>`).join("")}
    <div class="camp-progress" id="campProgress" hidden><div class="camp-bar"><i id="campBar"></i></div><p id="campProgressText" class="camp-muted" aria-live="polite"></p></div>
    <div id="campResult"></div>
    <p class="camp-error" id="campErr" role="alert"></p>
    <div class="camp-nav" id="campNav3"><button type="button" class="btn btn-outline" data-camp="back">← Back</button><button type="button" class="btn btn-outline" data-camp="test">Send a test to me</button><button type="button" class="btn" data-camp="send">🚀 Send campaign</button></div>`;
}

function paintCounter() {
  const el = $("campCounter"), d = CAMP.d; if (!el) return;
  const i = smsParts(d.message);
  el.textContent = d.sms ? `${i.len}/600 characters · ${i.parts || 0} SMS part${i.parts === 1 ? "" : "s"}${i.unicode ? " (special characters use shorter parts)" : ""}` : `${i.len}/600 characters`;
}
function paintBubble() {
  const el = $("campBubble"); if (!el) return;
  const t = campSample(CAMP.d)(CAMP.d.message);
  el.textContent = t || "Your message will appear here…";
  el.classList.toggle("is-empty", !t);
}

/* ---------- validation ---------- */
function campError(step) {
  const d = CAMP.d;
  if (step >= 1) {
    if (!d.name.trim()) return "Give your campaign a name.";
    if (!CAMP.preview || !CAMP.preview.total) return "No customers match this audience.";
  }
  if (step >= 2) {
    if (!d.sms && !d.email) return "Choose at least one way to send: SMS or Email.";
    if (d.sms && CAMP.info && CAMP.info.smsReady === false) return "SMS gateway is not set up yet. Turn SMS off, or set it up under Marketing → Email & SMS alerts.";
    if (d.email && !d.subject.trim()) return "Add an email subject.";
    if (!d.message.trim()) return "Write a message.";
    const needCoupon = /\{coupon\}/.test(d.message) || /\{coupon\}/.test(d.subject);
    if (needCoupon && d.couponMode === "none") return "Your message uses {coupon}. Pick or create a coupon, or remove {coupon} from the text.";
    if (d.couponMode === "existing" && !d.coupon) return "Select which coupon to use.";
    if (d.couponMode === "new") {
      if (!/^[A-Za-z0-9_-]{3,20}$/.test(d.newCoupon.code.trim())) return "Coupon code: 3–20 letters or numbers (e.g. EID10).";
      if (!(Number(d.newCoupon.value) > 0)) return "Enter the discount value.";
      if (d.newCoupon.type === "percent" && Number(d.newCoupon.value) > 100) return "A percentage discount cannot be more than 100.";
      if (d.newCoupon.expires && d.newCoupon.expires < ymd(new Date())) return "The coupon expiry date is in the past.";
    }
    if (d.banner.on && !d.banner.text.trim()) return "Write the banner text, or switch the website banner off.";
  }
  return "";
}

/* ---------- sending ---------- */
const campPayload = () => {
  const d = CAMP.d;
  return { name: d.name.trim(), audience: d.audience, channel: campChannel(d), subject: d.subject.trim(), message: d.message.trim(), coupon: campCouponCode(d) };
};
async function sendCampaign() {
  const p = CAMP.preview, d = CAMP.d;
  if (!confirm(`Send "${d.name}" to ${num(p.total)} customer(s) now?\n\nThis cannot be undone.`)) return;
  CAMP.running = true;
  $("campNav3").hidden = true; $("campErr").textContent = "";
  const prog = $("campProgress"), bar = $("campBar"), txt = $("campProgressText");
  prog.hidden = false; txt.textContent = "Getting ready…";
  let sent = 0, failed = 0, errors = [];
  try {
    if (d.couponMode === "new") { // create the coupon first so customers can use it right away
      const c = d.newCoupon;
      await call("saveCoupon", { coupon: { code: c.code.trim().toUpperCase(), type: c.type, value: Number(c.value), minOrder: Number(c.minOrder) || 0, active: true, expires: c.expires || "" } });
    }
    if (d.banner.on) { // website banner (reuses the existing site settings)
      const code = campCouponCode(d);
      await call("saveSettings", { settings: Object.assign({ notice: d.banner.text.trim().slice(0, 190), offerEndsAt: d.banner.end || "" }, code ? { promoCoupon: code } : {}) });
    }
    let offset = 0, id = "", total = p.total;
    for (;;) {
      const r = await call("sendCampaignBatch", { campaign: campPayload(), offset, campaignId: id });
      id = r.campaignId; total = r.total || total;
      sent += r.sent; failed += r.failed; errors = errors.concat(r.errors || []);
      offset = r.next;
      const pct = Math.min(100, Math.round((offset / Math.max(1, total)) * 100));
      bar.style.width = pct + "%"; txt.textContent = `Sending… ${num(Math.min(offset, total))} of ${num(total)} customers (${pct}%). Please keep this page open.`;
      if (r.done || !r.processed) break;
    }
    bar.style.width = "100%";
    campFinish(sent, failed, errors, null);
  } catch (err) {
    campFinish(sent, failed, errors, err.message);
  }
  CAMP.running = false;
}
function campFinish(sent, failed, errors, fatal) {
  $("campProgress").hidden = true;
  const ok = !fatal && sent > 0;
  $("campResult").innerHTML = `<div class="camp-done ${ok ? "is-ok" : "is-bad"}"><div class="camp-done-ico">${ok ? "✅" : "⚠️"}</div><div><h3>${ok ? "Campaign sent!" : fatal ? "Campaign stopped" : "Nothing was delivered"}</h3>
    <p><b>${num(sent)}</b> message${sent === 1 ? "" : "s"} delivered · <b>${num(failed)}</b> failed.</p>${fatal ? `<p class="camp-bad">${esc(fatal)}</p>` : ""}${errors.length ? `<ul class="camp-errs">${errors.slice(0, 5).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    <div class="camp-nav"><button type="button" class="btn" data-camp="done">Back to campaigns</button></div></div></div>`;
}
async function sendCampaignTest() {
  const err = campError(2); const box = $("campErr");
  if (err) { box.textContent = err; return; }
  box.textContent = ""; box.className = "camp-error";
  try { const r = await call("testCampaign", { campaign: campPayload() }); box.className = "camp-error is-ok"; box.textContent = "✅ " + r.message; }
  catch (e) { box.textContent = "⚠️ " + e.message; }
}

/* ---------- events (delegated; text fields never re-render so typing is never interrupted) ---------- */
const campRoot = () => $("campWizard");
campRoot().addEventListener("input", (e) => {
  const t = e.target, d = CAMP.d; if (!d) return;
  if (t.dataset.f) { d[t.dataset.f] = t.value; if (t.dataset.f === "name") paintCampPreview(); if (t.dataset.f === "message") { paintCounter(); paintBubble(); } }
  else if (t.dataset.aud && t.tagName === "INPUT") { d.audience[t.dataset.aud] = Number(t.value) || 0; loadCampPreview(); }
  else if (t.dataset.nc) { d.newCoupon[t.dataset.nc] = t.value; paintBubble(); }
  else if (t.dataset.bn && t.type !== "checkbox") { d.banner[t.dataset.bn] = t.value; }
});
campRoot().addEventListener("change", (e) => {
  const t = e.target, d = CAMP.d; if (!d) return;
  if (t.name === "aud") { d.audience.type = t.value; renderCampWizard(); loadCampPreview(); }
  else if (t.dataset.aud === "area") { d.audience.area = t.value; loadCampPreview(); }
  else if (t.dataset.ch) { d[t.dataset.ch] = t.checked; renderCampWizard(); }
  else if (t.name === "cmode") { d.couponMode = t.value; renderCampWizard(); }
  else if (t.dataset.f === "coupon") { d.coupon = t.value; paintBubble(); }
  else if (t.dataset.nc === "type") { d.newCoupon.type = t.value; renderCampWizard(); }
  else if (t.dataset.bn === "on") { d.banner.on = t.checked; if (t.checked && !d.banner.end && d.couponMode === "new" && d.newCoupon.expires) d.banner.end = d.newCoupon.expires + "T23:59";
    if (t.checked && !d.banner.text) d.banner.text = "🎉 " + d.name + " — " + (campCouponCode(d) ? "use code " + campCouponCode(d) + " and save!" : "limited time offer!"); renderCampWizard(); }
});
campRoot().addEventListener("click", (e) => {
  const d = CAMP.d;
  const ins = e.target.closest("[data-ins]");
  if (ins && d) {
    const ta = $("campMsg"), v = ins.dataset.ins, s = ta.selectionStart || ta.value.length, en = ta.selectionEnd || s;
    ta.value = ta.value.slice(0, s) + v + ta.value.slice(en); d.message = ta.value; ta.focus(); ta.setSelectionRange(s + v.length, s + v.length); paintCounter(); paintBubble(); return;
  }
  const tpl = e.target.closest("[data-tpl]");
  if (tpl && d) {
    const t = CAMP_TEMPLATES.find((x) => x.id === tpl.dataset.tpl);
    if ((d.message.trim() && d.message !== "") && !confirm("Replace your current message with this template?")) return;
    d.message = t.message; d.subject = t.subject; if (!d.name.trim()) d.name = t.name;
    renderCampWizard(); return;
  }
  const b = e.target.closest("[data-camp]"); if (!b || !d) return;
  const act = b.dataset.camp;
  if (act === "cancel") { if (!d.name.trim() || confirm("Discard this campaign?")) exitCampaign(); }
  else if (act === "done") exitCampaign();
  else if (act === "back") { CAMP.step = Math.max(1, CAMP.step - 1); renderCampWizard(); }
  else if (act === "next") {
    const err = campError(CAMP.step);
    if (err) { const box = $("campErr"); if (box) { box.textContent = err; box.focus?.(); } else toast("⚠️ " + err); return; }
    CAMP.step = Math.min(3, CAMP.step + 1); renderCampWizard();
  }
  else if (act === "test") sendCampaignTest();
  else if (act === "send") { const err = campError(2); if (err) { $("campErr").textContent = err; return; } sendCampaign(); }
});
$("newCampaign").addEventListener("click", startCampaign);
// "set it up" link inside the wizard jumps to the Email & SMS settings (handled by the global [data-goto] listener)
