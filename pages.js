/* Multi-page storefront. Cart storage intentionally matches script.js for cross-page continuity. */
(() => {
  "use strict";

  const defaults = {
    deliveryInside: 70, deliveryOutside: 120, freeDeliveryAbove: 1500,
    phone: "01852677251", whatsapp: "8801852677251", bkash: "01XXXXXXXXX", nagad: "01XXXXXXXXX"
  };
  const demo = [
    { id: 1, name: "খাঁটি সরিষার তেল", unit: "১ লিটার", category: "তেল", price: 320, oldPrice: 380, emoji: "🫒", image: "images/mustard-oil.svg", stock: 50, desc: "কাঠের ঘানিতে ভাঙানো ১০০% খাঁটি সরিষার তেল। ঝাঁঝালো ঘ্রাণ ও স্বাদ, কোনো ভেজাল বা কেমিক্যাল নেই।" },
    { id: 2, name: "সুন্দরবনের খাঁটি মধু", unit: "৫০০ গ্রাম", category: "মধু", price: 650, oldPrice: 780, emoji: "🍯", image: "images/honey.svg", stock: 30, desc: "সুন্দরবনের মৌসুমি ফুলের প্রাকৃতিক মধু। প্রক্রিয়াজাত নয়, চিনি মেশানো নয়।" },
    { id: 3, name: "কাজুবাদাম (প্রিমিয়াম)", unit: "৫০০ গ্রাম", category: "বাদাম", price: 780, oldPrice: 900, emoji: "🥜", image: "images/cashews.svg", stock: 40, desc: "বড় দানার ফ্রেশ কাজুবাদাম, মচমচে ও সুস্বাদু। স্ন্যাকস ও রান্না দুটোতেই দারুণ।" },
    { id: 4, name: "হলুদ গুঁড়া", unit: "৫০০ গ্রাম", category: "মশলা", price: 240, oldPrice: 280, emoji: "🟡", image: "images/turmeric.svg", stock: 60, desc: "বাছাই করা কাঁচা হলুদ থেকে তৈরি, কৃত্রিম রঙ ছাড়া খাঁটি হলুদ গুঁড়া।" },
    { id: 5, name: "মরিচ গুঁড়া", unit: "৫০০ গ্রাম", category: "মশলা", price: 290, oldPrice: 340, emoji: "🌶️", image: "images/chili.svg", stock: 60, desc: "ঝাল ও সুগন্ধি শুকনা মরিচের গুঁড়া, কোনো ভেজাল বা কৃত্রিম রঙ নেই।" },
    { id: 6, name: "ঘি (খাঁটি গাওয়া)", unit: "৫০০ গ্রাম", category: "ঘি", price: 890, oldPrice: 1050, emoji: "🧈", image: "images/ghee.svg", stock: 20, desc: "গাওয়া দুধের মাখন থেকে তৈরি দানাদার খাঁটি ঘি। ঘ্রাণেই চেনা যায় আসল স্বাদ।" }
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const englishDigits = (value) => String(value).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const money = (value) => "৳" + Number(value || 0).toLocaleString("bn-BD");
  const apiUrl = typeof SITE_API_URL === "string" ? SITE_API_URL : "";
  const apiConnected = apiUrl && !apiUrl.includes("WEB_APP_URL");
  let products = [];
  let categoryList = []; // অ্যাডমিনের সাজানো ক্যাটাগরির ক্রম
  let settings = { ...defaults };
  let coupon = null;
  let cart = readCart();

  function readCart() {
    try {
      const saved = JSON.parse(localStorage.getItem("cart") || "[]");
      return Array.isArray(saved) ? saved.filter((line) => line && line.id != null && Number(line.qty) > 0).map((line) => ({ id: line.id, qty: Math.floor(Number(line.qty)) })) : [];
    } catch (error) {
      return [];
    }
  }

  function saveCart() {
    try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (error) { notify("কার্ট সংরক্ষণ করা যায়নি। ব্রাউজারের স্টোরেজ পরীক্ষা করুন।"); }
    updateCartCount();
  }

  function notify(message) {
    const node = $("#pageToast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  function pageHeader() {
    $("#siteHeader").innerHTML = `
      <div class="marquee"><div class="marquee-track"><div class="mq"><span>🌿 ১০০% খাঁটি ও ভেজালমুক্ত পণ্য</span><span>🚚 সারাদেশে ক্যাশ অন ডেলিভারি</span><span>↩️ ৭ দিনের সহজ রিটার্ন</span><span>🌿 ১০০% খাঁটি ও ভেজালমুক্ত পণ্য</span><span>🚚 সারাদেশে ক্যাশ অন ডেলিভারি</span><span>↩️ ৭ দিনের সহজ রিটার্ন</span></div></div></div>
      <header class="header"><div class="container header-inner page-header-inner">
        <a href="index.html" class="logo brand-logo" aria-label="খাঁটিঘর হোম"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M7 17.5 20 7l13 10.5v15H7z"/><path d="M15 32V21h10v11"/><path d="M20 17c-4-5-8-2-7 1 1 3 6 3 7 3"/><path d="M20 17c4-5 8-2 7 1-1 3-6 3-7 3"/></svg></span><span class="brand-wordmark">খাঁটি<small>ঘর</small></span></a>
        <form class="h-search" id="globalSearch" role="search"><input id="globalSearchInput" type="search" placeholder="তেল, মধু, মশলা, বাদাম খুঁজুন..." aria-label="পণ্য খুঁজুন"><button type="submit" aria-label="খুঁজুন"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></button></form>
        <div class="h-actions">
          <a class="h-link h-action-link page-track-link" href="track.html"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><small>অর্ডার ট্র্যাক</small></a>
          <a class="cart-btn h-action-button page-cart-button" href="cart.html" aria-label="কার্ট দেখুন"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i><small>কার্ট</small><b id="pageCartCount">০</b></a>
          <div class="h-more-wrap"><button type="button" class="h-more-toggle h-action-button" id="pageMoreToggle" aria-expanded="false" aria-controls="pageMoreMenu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><small>আরও</small></button>
            <div class="h-more-menu" id="pageMoreMenu" hidden><a href="index.html">হোমপেজ</a><a href="shop.html">সব পণ্য</a><a href="cart.html">আপনার কার্ট</a><a href="track.html">অর্ডার ট্র্যাক</a><a href="index.html#faq">সচরাচর জিজ্ঞাসা</a><button type="button" id="pageTheme" aria-label="থিম বদলান">☾ থিম বদলান</button></div>
          </div>
        </div>
      </div></header>
      <nav class="catbar"><div class="container catbar-inner page-nav"><a class="cat cat-offers" href="shop.html?offer=1">সেরা অফার</a><div class="cat-list"><a class="cat" href="shop.html">সব পণ্য</a><a class="cat" href="shop.html?cat=${encodeURIComponent("তেল")}">তেল</a><a class="cat" href="shop.html?cat=${encodeURIComponent("মধু")}">মধু</a><a class="cat" href="shop.html?cat=${encodeURIComponent("মশলা")}">মশলা</a><a class="cat" href="shop.html?cat=${encodeURIComponent("বাদাম")}">বাদাম</a></div></div></nav>`;
    const moreToggle = $("#pageMoreToggle");
    const moreMenu = $("#pageMoreMenu");
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
    $("#pageTheme").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (error) { notify("থিম পছন্দ সংরক্ষণ করা যায়নি।"); }
      $("#pageTheme").textContent = next === "dark" ? "☀️ থিম বদলান" : "☾ থিম বদলান";
    });
    $("#pageTheme").textContent = document.documentElement.dataset.theme === "dark" ? "☀️ থিম বদলান" : "☾ থিম বদলান";
    $("#globalSearch").addEventListener("submit", (event) => {
      event.preventDefault();
      const query = $("#globalSearchInput").value.trim();
      location.href = "shop.html" + (query ? "?q=" + encodeURIComponent(query) : "");
    });
  }

  // পণ্য আছে এমন ক্যাটাগরি, অ্যাডমিনের ক্রমে (তালিকায় না থাকলে শেষে)
  function categoryNames(withEmpty = false) {
    const used = new Set(products.map((p) => p.category).filter(Boolean));
    const order = categoryList.map((c) => c.name).filter((n) => withEmpty || used.has(n));
    return [...order, ...[...used].filter((n) => !order.includes(n))];
  }

  function renderPageCategoryNav() {
    const categories = categoryNames(true);
    $(".page-nav .cat-list").innerHTML = `<a class="cat" href="shop.html">সব পণ্য</a>${categories.map((category) => `<a class="cat" href="shop.html?cat=${encodeURIComponent(category)}">${escapeHtml(category)}<span class="cat-chevron" aria-hidden="true">⌄</span></a>`).join("")}`;
  }

  function pageFooter() {
    const cfgC = typeof SITE_CONTACT !== "undefined" ? SITE_CONTACT : {};
    const cfgS = typeof SITE_SOCIAL !== "undefined" ? SITE_SOCIAL : {};
    const contactEmail = settings.email || cfgC.email || "";
    const contactAddress = settings.address || cfgC.address || "";
    const httpsOnly = (u) => (/^https:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
    const socialHtml = [["facebook", "s-fb", "fa-facebook-f", "ফেসবুক"], ["twitter", "s-tw", "fa-twitter", "টুইটার"], ["instagram", "s-ig", "fa-instagram", "ইনস্টাগ্রাম"], ["linkedin", "s-li", "fa-linkedin-in", "লিংকডইন"], ["tiktok", "s-tk", "fa-tiktok", "টিকটক"]]
      .map(([key, cls, icon, label]) => { const u = httpsOnly(settings[key] || cfgS[key]); return u ? `<a href="${escapeHtml(u)}" class="${cls}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}"><i class="fa-brands ${icon}" aria-hidden="true"></i></a>` : ""; }).join("")
      + `<a href="https://wa.me/${escapeHtml(settings.whatsapp)}" class="s-wa" target="_blank" rel="noopener noreferrer" aria-label="হোয়াটসঅ্যাপ" title="WhatsApp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i></a>`;
    $("#siteFooter").innerHTML = `<footer class="footer catalog-footer"><div class="container"><div class="footer-grid">
      <div class="f-brand"><a href="index.html" class="logo brand-logo" aria-label="খাঁটিঘর হোম"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M7 17.5 20 7l13 10.5v15H7z"/><path d="M15 32V21h10v11"/><path d="M20 17c-4-5-8-2-7 1 1 3 6 3 7 3"/><path d="M20 17c4-5 8-2 7 1-1 3-6 3-7 3"/></svg></span><span class="brand-wordmark">খাঁটি<small>ঘর</small></span></a><p>ভেজালমুক্ত তেল, মশলা, বাদাম ও মধু — সরাসরি উৎস থেকে আপনার ঘরে। বিশ্বাস ও মানই আমাদের পরিচয়।</p></div>
      <div><h4>কেনাকাটা</h4><div class="footer-links"><a href="shop.html">সব পণ্য</a><a href="cart.html">আপনার কার্ট</a><a href="checkout.html">চেকআউট</a></div></div>
      <div><h4>সাহায্য</h4><div class="footer-links"><a href="track.html">অর্ডার ট্র্যাক করুন</a><a href="index.html#faq">সচরাচর জিজ্ঞাসা</a><a href="terms.html">রিটার্ন ও শর্তাবলী</a><a href="privacy.html">গোপনীয়তা নীতি</a></div></div>
      <div><h4>যোগাযোগ</h4><div class="footer-links f-contact">${contactEmail ? `<p><i class="fa-solid fa-envelope" aria-hidden="true"></i><a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a></p>` : ""}<p><i class="fa-solid fa-phone" aria-hidden="true"></i><a href="tel:${escapeHtml(settings.phone)}">${escapeHtml(settings.phone)}</a></p>${contactAddress ? `<p><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>${escapeHtml(contactAddress)}</span></p>` : ""}</div>
        <div class="social f-social">${socialHtml}</div></div>
      </div><div class="footer-pay"><img src="images/sslcommerz.png" alt="SSLCommerz — নিরাপদ পেমেন্ট গেটওয়ে" width="2647" height="427" loading="lazy"></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} খাঁটিঘর। সর্বস্বত্ব সংরক্ষিত। · Developed by <b>Almas Forhadi</b></span></div></div></footer>`;
  }

  async function loadProducts() {
    if (apiConnected) {
      try {
        const response = await fetch(apiUrl + "?action=products");
        if (!response.ok) throw new Error("পণ্য লোড করা যায়নি।");
        const data = await response.json();
        if (data.ok && Array.isArray(data.products)) {
          products = data.products;
          categoryList = Array.isArray(data.categories) ? data.categories : [];
          settings = { ...settings, ...(data.settings || {}) };
          return;
        }
        throw new Error(data.error || "পণ্যের তথ্য পাওয়া যায়নি।");
      } catch (error) {
        console.error("Product API error:", error);
        notify("সার্ভার থেকে পণ্য আনা যায়নি; নমুনা পণ্য দেখানো হচ্ছে।");
      }
    }
    products = demo;
  }

  function productById(id) { return products.find((product) => String(product.id) === String(id)); }
  function discount(product) { return product.oldPrice > product.price ? Math.round((1 - product.price / product.oldPrice) * 100) : 0; }
  function productCard(product) {
    const visual = product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : escapeHtml(product.emoji || "🛍️");
    return `<article class="product${product.stock <= 0 ? " out" : ""}">
      <a class="product-img" href="product.html?id=${encodeURIComponent(product.id)}">${discount(product) ? `<span class="off-badge">−${discount(product)}%</span>` : ""}${visual}</a>
      <div class="product-body"><small>${escapeHtml(product.category || "")}</small><h3><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
      <small>${escapeHtml(product.unit || "")}</small><div class="price">${money(product.price)} ${product.oldPrice > product.price ? `<del>${money(product.oldPrice)}</del>` : ""}</div>
      <div class="card-actions"><button type="button" class="btn btn-outline add-to-cart-btn" data-add="${escapeHtml(product.id)}" ${product.stock <= 0 ? "disabled" : ""}><svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>Add To Cart</button><a class="btn" href="product.html?id=${encodeURIComponent(product.id)}">বিস্তারিত</a></div></div></article>`;
  }

  function lineItems() {
    return cart.map((line) => ({ product: productById(line.id), qty: line.qty })).filter((line) => line.product);
  }
  function subtotal() { return lineItems().reduce((sum, line) => sum + Number(line.product.price) * line.qty, 0); }
  function updateCartCount() {
    const count = cart.reduce((sum, line) => sum + line.qty, 0);
    const badge = $("#pageCartCount");
    if (badge) { badge.textContent = count.toLocaleString("bn-BD"); badge.classList.toggle("has", count > 0); }
    const fc = $("#pageFloatCount");
    if (fc) { fc.textContent = count.toLocaleString("bn-BD"); $("#pageFloatTotal").textContent = money(subtotal()); }
    const nb = $("#pageBnCount");
    if (nb) { nb.textContent = count.toLocaleString("bn-BD"); nb.hidden = count <= 0; }
  }

  function pageFloatingCart() {
    if (document.querySelector(".floating-cart")) return;
    const a = document.createElement("a");
    a.className = "floating-cart";
    a.href = "cart.html";
    a.setAttribute("aria-label", "কার্ট দেখুন");
    a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><span><b id="pageFloatCount">০</b> পণ্য</span><strong id="pageFloatTotal">৳০</strong>`;
    document.body.appendChild(a);
  }

  function pageBottomNav() {
    if (document.querySelector(".bottom-nav")) return;
    const here = location.pathname.split("/").pop() || "index.html";
    const item = (href, svg, label, extra = "") => `<a href="${href}" class="bn-item${here === href ? " on" : ""}">${svg}<small>${label}</small>${extra}</a>`;
    const nav = document.createElement("nav");
    nav.className = "bottom-nav bn-pages";
    nav.setAttribute("aria-label", "মোবাইল মেনু");
    nav.innerHTML = item("index.html", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/></svg>`, "হোম")
      + item("shop.html", `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/></svg>`, "শপ")
      + item("cart.html", `<i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>`, "কার্ট", `<b id="pageBnCount" hidden>০</b>`)
      + item("track.html", `<i class="fa-solid fa-location-dot" aria-hidden="true"></i>`, "ট্র্যাক");
    document.body.appendChild(nav);
    document.body.classList.add("has-bn");
  }

  function addToCart(id, qty = 1) {
    const product = productById(id);
    if (!product || product.stock <= 0) return notify("এই পণ্যটি এখন স্টকে নেই।");
    const line = cart.find((item) => String(item.id) === String(id));
    const available = product.stock - (line ? line.qty : 0);
    if (available < qty) return notify(`স্টকে মাত্র ${available.toLocaleString("bn-BD")}টি আছে।`);
    if (line) line.qty += qty; else cart.push({ id: product.id, qty });
    saveCart();
    notify("✅ কার্টে যোগ হয়েছে");
  }

  function renderShop() {
    const sort = $("#shopSort");
    const query = new URLSearchParams(location.search);
    const offersOnly = query.get("offer") === "1";
    const q = (query.get("q") || "").trim().toLocaleLowerCase();
    const cats = categoryNames();
    const picked = new Set(query.get("cat") ? [query.get("cat")] : []);
    const prices = products.map((p) => Number(p.price) || 0);
    const lo = Math.floor(Math.min(0, ...prices)), hi = Math.max(100, Math.ceil(Math.max(...prices, 0) / 10) * 10);
    const rMin = $("#rangeMin"), rMax = $("#rangeMax");
    [rMin, rMax].forEach((r) => { r.min = lo; r.max = hi; });
    rMin.value = lo; rMax.value = hi;
    $("#shopOffer").checked = offersOnly;
    const heading = (text) => { $("#shopTitle").textContent = text; $("#shopCrumb").textContent = text; document.title = text + " | খাঁটিঘর"; };
    $("#shopCats").innerHTML = cats.map((cat) => `<label class="side-check"><input type="checkbox" value="${escapeHtml(cat)}" ${picked.has(cat) ? "checked" : ""}><span>${escapeHtml(cat)}</span><em>${products.filter((p) => p.category === cat).length.toLocaleString("bn-BD")}</em></label>`).join("");
    const bn = (n) => "৳ " + Number(n).toLocaleString("bn-BD");
    const draw = () => {
      let a = Number(rMin.value), b = Number(rMax.value);
      if (a > b) [a, b] = [b, a];
      const span = hi - lo || 1;
      $("#drFill").style.cssText = `left:${((a - lo) / span) * 100}%;right:${100 - ((b - lo) / span) * 100}%`;
      $("#pvMin").textContent = bn(a); $("#pvMax").textContent = bn(b);
      const sel = [...document.querySelectorAll("#shopCats input:checked")].map((i) => i.value);
      const offer = $("#shopOffer").checked, stock = $("#shopStock").checked;
      let found = products.filter((p) => (!q || `${p.name} ${p.category}`.toLocaleLowerCase().includes(q)) && (!sel.length || sel.includes(p.category)) && p.price >= a && p.price <= b && (!offer || p.oldPrice > p.price) && (!stock || p.stock > 0));
      if (sort.value === "low") found.sort((x, y) => x.price - y.price);
      if (sort.value === "high") found.sort((x, y) => y.price - x.price);
      if (sort.value === "disc") found.sort((x, y) => discount(y) - discount(x));
      if (sort.value === "name") found.sort((x, y) => x.name.localeCompare(y.name, "bn"));
      heading(offersOnly && !sel.length ? "সেরা অফার" : sel.length === 1 ? sel[0] : q ? `“${query.get("q")}” এর ফলাফল` : "সব পণ্য");
      $("#shopStatus").textContent = `${found.length.toLocaleString("bn-BD")}টি পণ্য পাওয়া গেছে`;
      $("#shopProducts").innerHTML = found.length ? found.map(productCard).join("") : `<div class="empty-state"><p>এই খোঁজে কোনো পণ্য পাওয়া যায়নি।</p><button type="button" class="btn btn-small" id="emptyReset">ফিল্টার মুছুন</button></div>`;
      $("#shopProducts").setAttribute("aria-busy", "false");
    };
    const reset = () => {
      document.querySelectorAll("#shopCats input, #shopStock, #shopOffer").forEach((i) => { i.checked = false; });
      rMin.value = lo; rMax.value = hi; sort.value = "";
      draw();
    };
    if (window.matchMedia("(max-width: 860px)").matches) document.querySelectorAll("#shopSide details").forEach((d) => { d.open = false; });
    $("#shopReset").addEventListener("click", reset);
    $("#shopProducts").addEventListener("click", (e) => { if (e.target.id === "emptyReset") reset(); });
    ["#shopSide", "#shopSort"].forEach((sel) => $(sel).addEventListener("input", draw));
    draw();
  }

  const starRow = (n) => `<span class="pd-stars" aria-label="${n} স্টার">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? "on" : ""}">★</i>`).join("")}</span>`;
  const reviewDist = (list) => { const d = [0, 0, 0, 0, 0]; list.forEach((v) => { const r = Math.min(5, Math.max(1, Math.round(Number(v.rating) || 0))); d[r - 1]++; }); return d; };

  function reviewsPanel(data) {
    const list = data && data.reviews ? data.reviews : [];
    const count = data && data.count != null ? data.count : list.length;
    const avg = data && data.average != null ? Number(data.average) : (list.length ? list.reduce((s, v) => s + Number(v.rating || 0), 0) / list.length : 0);
    const dist = data && data.distribution ? data.distribution : reviewDist(list);
    const bn = (n) => Number(n).toLocaleString("bn-BD");
    const summary = count
      ? `<div class="pd-rv-score"><b>${bn(avg.toFixed(1))}</b><div><span>গড় রেটিং</span>${starRow(avg)}<small>(${bn(count)}টি রিভিউ)</small></div></div>
         <div class="pd-recommend"><b>${bn(Math.round(((dist[3] || 0) + (dist[4] || 0)) / count * 100))}%</b><span>সুপারিশ করেছেন</span><small>(${bn((dist[3] || 0) + (dist[4] || 0))} / ${bn(count)})</small></div>
         <div class="pd-rv-bars">${[5, 4, 3, 2, 1].map((n) => `<div><span>${bn(n)} ★</span><i><u style="width:${Math.round((dist[n - 1] || 0) / count * 100)}%"></u></i><em>${bn(Math.round((dist[n - 1] || 0) / count * 100))}%</em></div>`).join("")}</div>`
      : `<p class="pd-empty">এখনো কোনো রিভিউ নেই। প্রথম রিভিউটি আপনিই দিন!</p>`;
    const items = list.map((v) => `<li><span class="pd-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span><div><div class="pd-rv-head"><b>${escapeHtml(v.name || "ক্রেতা")}</b>${v.verified ? `<em class="pd-ver">✔ ভেরিফাইড ক্রেতা</em>` : ""}<small>${escapeHtml(v.date || "")}</small></div>${starRow(v.rating)}${v.text ? `<p>${escapeHtml(v.text)}</p>` : ""}</div></li>`).join("");
    return `<div class="pd-rv-grid">
      <div class="pd-rv-left">${summary}</div>
      <div class="pd-rv-right">
        <h3 class="pd-h">আপনার রিভিউ দিন</h3>
        <form id="pdReviewForm" class="pd-rv-form" novalidate>
          <p class="pd-hint">আপনার মোবাইল নম্বর প্রকাশ করা হবে না। * চিহ্নিত ঘরগুলো পূরণ করা আবশ্যক। শুধু ডেলিভারি পাওয়া ক্রেতারা রিভিউ দিতে পারবেন।</p>
          <div class="pd-row2"><label>অর্ডার আইডি *<input name="orderId" autocomplete="off"></label><label>মোবাইল নম্বর *<input name="phone" type="tel" maxlength="11" inputmode="numeric" placeholder="01XXXXXXXXX"></label></div>
          <label>পণ্য সম্পর্কে আপনার মতামত<textarea name="text" rows="4" maxlength="500" placeholder="আপনার রিভিউ লিখুন..."></textarea></label>
          <div class="pd-upload-wrap"><span>ছবি আপলোড (ঐচ্ছিক)</span>
            <div class="pd-drop" id="pdDrop" tabindex="0" role="button" aria-label="ছবি বাছুন"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H15M12 20v-8m0 0-3 3m3-3 3 3"/></svg><b>ছবি এখানে ড্র্যাগ করে ছাড়ুন</b><small>অথবা ক্লিক করে ফাইল বাছুন (সর্বোচ্চ ৩টি)</small><input type="file" id="pdFiles" accept="image/*" multiple hidden></div>
            <div class="pd-previews" id="pdPreviews"></div></div>
          <div class="pd-rv-foot"><label>আপনার রেটিং:<select name="rating"><option value="">বাছুন</option><option value="5">৫ - চমৎকার</option><option value="4">৪ - ভালো</option><option value="3">৩ - মোটামুটি</option><option value="2">২ - খারাপ</option><option value="1">১ - খুব খারাপ</option></select></label><button class="pd-submit" type="submit">রিভিউ জমা দিন</button></div>
          <p class="form-msg" id="pdRvMsg" role="alert"></p>
        </form>
      </div>
    </div>${items ? `<ul class="pd-rv-list">${items}</ul>` : ""}`;
  }

  function renderProduct() {
    const product = productById(new URLSearchParams(location.search).get("id"));
    const target = $("#productDetail");
    if (!product) {
      target.innerHTML = `<div class="page-empty"><span>🔎</span><h2>পণ্যটি পাওয়া যায়নি</h2><p>পণ্যটি সরানো হয়েছে অথবা লিংকটি ভুল।</p><a class="btn" href="shop.html">সব পণ্য দেখুন</a></div>`;
      $("#productTabs").innerHTML = ""; document.querySelector(".related-section").hidden = true;
      return;
    }
    document.title = `${product.name} | খাঁটিঘর`;
    $("#pdCrumb").textContent = product.name;
    const raw = Array.isArray(product.images) ? product.images : typeof product.images === "string" ? product.images.split(/[,\n|]/) : [];
    const images = [...new Set([product.image, ...raw].map((x) => String(x || "").trim()).filter(Boolean))];
    const out = product.stock <= 0, off = discount(product);
    const badge = off ? `<span class="off-badge">−${off.toLocaleString("bn-BD")}%</span>` : "";
    const mainVisual = (src) => src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)}">` : `<span class="pd-emoji">${escapeHtml(product.emoji || "🛍️")}</span>`;
    const phone = String(settings.phone || "").replace(/\s/g, "");
    const waText = encodeURIComponent(`আমি "${product.name}" অর্ডার করতে চাই।`);
    const cartIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`;
    target.innerHTML = `<div class="pd-card">
      <div class="pd-gallery">
        ${images.length > 1 ? `<div class="pd-thumbs" id="pdThumbs">${images.map((src, i) => `<button type="button" class="${i === 0 ? "on" : ""}" data-src="${escapeHtml(src)}" aria-label="ছবি ${(i + 1).toLocaleString("bn-BD")}"><img src="${escapeHtml(src)}" alt=""></button>`).join("")}</div>` : ""}
        <div class="pd-main" id="pdMain">${badge}${mainVisual(images[0])}</div>
      </div>
      <div class="pd-info">
        <h1>${escapeHtml(product.name)}</h1>
        <div class="pd-price"><b>${money(product.price)}</b>${product.oldPrice > product.price ? `<del>${money(product.oldPrice)}</del><span class="pd-save">${off.toLocaleString("bn-BD")}% সাশ্রয়</span>` : ""}</div>
        <ul class="pd-meta">${product.unit ? `<li><span>পরিমাণ</span><b>${escapeHtml(product.unit)}</b></li>` : ""}${product.category ? `<li><span>ক্যাটাগরি</span><a href="shop.html?cat=${encodeURIComponent(product.category)}">${escapeHtml(product.category)}</a></li>` : ""}<li><span>অবস্থা</span><b class="${out ? "no" : "yes"}">${out ? "স্টক শেষ" : `স্টকে আছে${product.stock <= 5 ? ` · মাত্র ${product.stock.toLocaleString("bn-BD")}টি বাকি` : ""}`}</b></li></ul>
        <div class="pd-qty-row"><span>পরিমাণ:</span><div class="pd-qty"><button type="button" id="pdMinus" aria-label="কমান">−</button><input id="pdQty" type="text" inputmode="numeric" value="1" aria-label="পরিমাণ"><button type="button" id="pdPlus" aria-label="বাড়ান">+</button></div></div>
        <div class="pd-btns">
          <button type="button" class="pd-btn pd-add" id="pdAdd" ${out ? "disabled" : ""}>${cartIcon} কার্টে যোগ করুন</button>
          <button type="button" class="pd-btn pd-buy" id="pdBuy" ${out ? "disabled" : ""}>এখনই কিনুন</button>
          <a class="pd-btn pd-wa" target="_blank" rel="noopener" href="https://wa.me/${escapeHtml(settings.whatsapp)}?text=${waText}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.7.62.72.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.8a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 1 1 8.37 4.63zM12.05 0a11.8 11.8 0 0 0-10.1 17.8L0 24l6.35-1.65A11.8 11.8 0 1 0 12.05 0z"/></svg> হোয়াটসঅ্যাপে অর্ডার</a>
          <a class="pd-btn pd-call" href="tel:${escapeHtml(phone)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg> ফোনে অর্ডার</a>
        </div>
        <p class="pd-note">🚚 সারাদেশে ডেলিভারি · 💵 ক্যাশ অন ডেলিভারি · ↩️ ৭ দিনের সহজ রিটার্ন</p>
      </div></div>`;

    const desc = escapeHtml(product.desc || "১০০% খাঁটি ও যত্নে বাছাই করা পণ্য।").replace(/\n/g, "<br>");
    const vid = String(product.video || "").trim();
    const ytId = (vid.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
    const videoEmbed = ytId ? `https://www.youtube.com/embed/${ytId}` : "";
    $("#productTabs").innerHTML = `<div class="pd-tabs" role="tablist"><button type="button" class="on" role="tab" data-tab="desc">বিবরণ</button>${videoEmbed ? `<button type="button" role="tab" data-tab="vid">পণ্যের ভিডিও</button>` : ""}<button type="button" role="tab" data-tab="rev" id="pdRevTab">ক্রেতাদের রিভিউ</button></div>
      <div class="pd-panel" id="pdPanelDesc"><h3 class="pd-h">পণ্যের বিবরণ</h3><p class="pd-desc">${desc}</p></div>
      ${videoEmbed ? `<div class="pd-panel" id="pdPanelVid" hidden><div class="pd-video"><iframe src="${escapeHtml(videoEmbed)}" title="পণ্যের ভিডিও" loading="lazy" allowfullscreen></iframe></div></div>` : ""}
      <div class="pd-panel" id="pdPanelRev" hidden></div>`;

    const qty = $("#pdQty");
    const clamp = () => { let n = parseInt(englishDigits(qty.value), 10); if (!n || n < 1) n = 1; if (product.stock > 0 && n > product.stock) n = product.stock; qty.value = n; return n; };
    $("#pdMinus").addEventListener("click", () => { qty.value = clamp() - 1; clamp(); });
    $("#pdPlus").addEventListener("click", () => { qty.value = clamp() + 1; clamp(); });
    qty.addEventListener("change", clamp);
    $("#pdAdd").addEventListener("click", () => addToCart(product.id, clamp()));
    $("#pdBuy").addEventListener("click", () => { addToCart(product.id, clamp()); location.href = "checkout.html"; });
    const thumbs = $("#pdThumbs");
    if (thumbs) thumbs.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-src]");
      if (!b) return;
      thumbs.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      $("#pdMain").innerHTML = badge + mainVisual(b.dataset.src);
    });

    let reviewData = null;
    const revPanel = $("#pdPanelRev");
    const paintReviews = () => {
      revPanel.innerHTML = reviewsPanel(reviewData);
      const total = reviewData ? (reviewData.count != null ? reviewData.count : (reviewData.reviews || []).length) : 0;
      $("#pdRevTab").textContent = `ক্রেতাদের রিভিউ (${total.toLocaleString("bn-BD")})`;
    };
    paintReviews();
    if (apiConnected) {
      fetch(`${apiUrl}?action=reviews&productId=${encodeURIComponent(product.id)}`).then((r) => r.json()).then((r) => { if (r && r.ok) { reviewData = r; paintReviews(); paintShots(); } }).catch(() => {});
    }
    $("#productTabs").addEventListener("click", (e) => {
      const tab = e.target.closest("[data-tab]");
      if (!tab) return;
      document.querySelectorAll("#productTabs .pd-tabs button").forEach((b) => b.classList.toggle("on", b === tab));
      $("#pdPanelDesc").hidden = tab.dataset.tab !== "desc";
      const vp = $("#pdPanelVid"); if (vp) vp.hidden = tab.dataset.tab !== "vid";
      revPanel.hidden = tab.dataset.tab !== "rev";
    });
    let shots = [];
    const readShot = (file) => new Promise((resolve) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 700 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
      img.src = url;
    });
    const paintShots = () => { const box = $("#pdPreviews"); if (box) box.innerHTML = shots.map((src, i) => `<div><img src="${src}" alt=""><button type="button" data-rm="${i}" aria-label="সরান">✕</button></div>`).join(""); };
    const addShots = async (files) => {
      for (const f of [...files].filter((x) => x.type.startsWith("image/"))) {
        if (shots.length >= 3) { notify("সর্বোচ্চ ৩টি ছবি দেওয়া যায়।"); break; }
        const data = await readShot(f); if (data) shots.push(data);
      }
      paintShots();
    };
    const tabsRoot = $("#productTabs");
    tabsRoot.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-rm]");
      if (rm) { shots.splice(Number(rm.dataset.rm), 1); paintShots(); return; }
      if (e.target.closest("#pdDrop") && e.target.id !== "pdFiles") $("#pdFiles").click();
    });
    tabsRoot.addEventListener("change", (e) => { if (e.target.id === "pdFiles") { addShots(e.target.files); e.target.value = ""; } });
    tabsRoot.addEventListener("keydown", (e) => { if (e.target.id === "pdDrop" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); $("#pdFiles").click(); } });
    tabsRoot.addEventListener("dragover", (e) => { if (e.target.closest("#pdDrop")) { e.preventDefault(); $("#pdDrop").classList.add("over"); } });
    tabsRoot.addEventListener("dragleave", () => { const d = $("#pdDrop"); if (d) d.classList.remove("over"); });
    tabsRoot.addEventListener("drop", (e) => { if (e.target.closest("#pdDrop")) { e.preventDefault(); $("#pdDrop").classList.remove("over"); addShots(e.dataTransfer.files); } });
    $("#productTabs").addEventListener("submit", async (e) => {
      if (e.target.id !== "pdReviewForm") return;
      e.preventDefault();
      const f = e.target, msg = $("#pdRvMsg");
      const say = (t, ok) => { msg.className = "form-msg " + (ok ? "ok" : "err"); msg.textContent = t; };
      const orderId = f.orderId.value.trim(), phoneNo = englishDigits(f.phone.value.trim()), rating = Number(f.rating.value);
      if (!apiConnected) return say("রিভিউ জমা দেওয়ার সুবিধা এখনো চালু হয়নি।");
      if (!orderId) return say("অর্ডার আইডি দিন।");
      if (!/^01[3-9]\d{8}$/.test(phoneNo)) return say("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।");
      if (!rating) return say("রেটিং বাছুন।");
      const btn = f.querySelector("[type=submit]"); btn.disabled = true;
      try {
        const r = await postApi({ action: "review", productId: product.id, orderId, phone: phoneNo, rating, text: f.text.value.trim(), images: shots });
        if (!r.ok) return say(r.error || "রিভিউ জমা হয়নি।");
        f.reset(); shots = []; paintShots(); say("✅ ধন্যবাদ! আপনার রিভিউ অনুমোদনের পর প্রকাশিত হবে।", true);
      } catch (err) { say("সমস্যা হয়েছে, আবার চেষ্টা করুন।"); }
      finally { btn.disabled = false; }
    });

    const related = products.filter((p) => p.id !== product.id && p.category === product.category);
    const more = related.length >= 5 ? related : [...related, ...products.filter((p) => p.id !== product.id && p.category !== product.category)];
    $("#relatedProducts").innerHTML = more.slice(0, 5).map(productCard).join("");
  }

  function cartRow(line, checkout = false) {
    const product = line.product;
    const visual = product.image ? `<img src="${escapeHtml(product.image)}" alt="">` : escapeHtml(product.emoji || "🛍️");
    return `<div class="page-cart-row"><div class="page-cart-thumb">${visual}</div><div class="page-cart-info"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.unit || "")} · ${money(product.price)}</small>
      ${checkout ? `<small>পরিমাণ: ${line.qty.toLocaleString("bn-BD")}</small>` : `<div class="page-cart-actions page-qty"><button type="button" data-qty="${escapeHtml(product.id)}" data-delta="-1" aria-label="একটি কমান">−</button><span>${line.qty.toLocaleString("bn-BD")}</span><button type="button" data-qty="${escapeHtml(product.id)}" data-delta="1" aria-label="একটি বাড়ান">+</button></div>`}</div>
      <div class="page-cart-price"><b>${money(product.price * line.qty)}</b>${checkout ? "" : `<button class="page-cart-remove" type="button" data-remove="${escapeHtml(product.id)}">সরান</button>`}</div></div>`;
  }

  function renderCartPage() {
    const lines = lineItems();
    const root = $("#cartPage");
    if (!lines.length) {
      root.innerHTML = `<div class="page-empty"><span>🛒</span><h2>আপনার কার্ট খালি</h2><p>পছন্দের পণ্য যোগ করে কেনাকাটা শুরু করুন।</p><a class="btn" href="shop.html">পণ্য দেখুন</a></div>`;
      return;
    }
    root.innerHTML = `<div class="cart-page"><section class="cart-lines" aria-label="কার্টের পণ্য"><div class="cart-lines-head"><span>পণ্য</span><span>মোট</span></div>${lines.map((line) => cartRow(line)).join("")}</section>
      <aside class="cart-summary"><h2>অর্ডারের সারাংশ</h2><div class="page-summary-row"><span>পণ্যের দাম</span><b>${money(subtotal())}</b></div>
      <div class="page-summary-row"><span>ডেলিভারি</span><b>চেকআউটে হিসাব হবে</b></div><div class="page-summary-row total"><span>সাবটোটাল</span><b>${money(subtotal())}</b></div>
      <a class="btn btn-block" href="checkout.html">চেকআউটে যান →</a><a class="btn btn-outline btn-block" href="shop.html" style="margin-top:10px">আরও কেনাকাটা করুন</a></aside></div>`;
  }

  function delivery(area) {
    const charge = Number(area === "outside" ? settings.deliveryOutside : settings.deliveryInside) || 0;
    const threshold = Number(settings.freeDeliveryAbove) || 0;
    return threshold > 0 && subtotal() >= threshold ? 0 : charge;
  }

  function renderCheckout() {
    const root = $("#checkoutPage");
    const lines = lineItems();
    if (!lines.length) {
      root.innerHTML = `<div class="page-empty"><span>🛒</span><h2>আপনার কার্ট খালি</h2><p>চেকআউটের আগে কার্টে পণ্য যোগ করুন।</p><a class="btn" href="shop.html">পণ্য দেখুন</a></div>`;
      return;
    }
    root.innerHTML = `<div class="checkout-layout"><form id="pageOrderForm" class="page-form" novalidate>
      <h2>১. ডেলিভারির তথ্য</h2><label>আপনার নাম *<input name="name" autocomplete="name" required minlength="3" placeholder="আপনার নাম"></label>
      <label>মোবাইল নম্বর *<input name="phone" type="tel" autocomplete="tel" inputmode="numeric" maxlength="11" required placeholder="01XXXXXXXXX"></label>
      <label>ইমেইল <small>ঐচ্ছিক</small><input name="email" type="email" autocomplete="email" maxlength="80" placeholder="you@example.com"></label>
      <label>ডেলিভারি এলাকা *<select name="area" id="checkoutArea"><option value="inside">ঢাকার ভিতরে (${money(settings.deliveryInside)})</option><option value="outside">ঢাকার বাইরে (${money(settings.deliveryOutside)})</option></select></label>
      <label>সম্পূর্ণ ঠিকানা *<textarea name="address" rows="3" autocomplete="street-address" required minlength="10" placeholder="বাসা/রোড, থানা, জেলা"></textarea></label>
      <label>অর্ডারের নোট <small>ঐচ্ছিক</small><input name="note" maxlength="200" placeholder="যেমন: কল দিয়ে আসবেন"></label>
      <h2>২. পেমেন্ট পদ্ধতি</h2><fieldset><label><input type="radio" name="payMethod" value="cod" checked> 💵 ক্যাশ অন ডেলিভারি</label><label><input type="radio" name="payMethod" value="bkash"> বিকাশ</label><label><input type="radio" name="payMethod" value="nagad"> নগদ</label></fieldset>
      <div id="pagePaymentInfo" hidden><p id="pagePaymentHelp"></p><label>ট্রানজেকশন আইডি *<input name="trxId" maxlength="30" placeholder="TrxID"></label></div>
      <input class="hp" name="website" tabindex="-1" autocomplete="off">
      <p id="pageOrderMessage" class="form-msg" role="alert"></p><button class="btn btn-block" id="pageOrderSubmit" type="submit">✅ অর্ডার কনফার্ম করুন</button>
      <p class="co-note">🔒 আপনার তথ্য নিরাপদে রাখা হবে। অর্ডারের পর আমরা কল করে নিশ্চিত করব।</p></form>
      <aside class="checkout-summary"><h2>৩. অর্ডার সামারি</h2><div id="checkoutLines">${lines.map((line) => cartRow(line, true)).join("")}</div>
      <div class="coupon"><input id="pageCoupon" type="text" placeholder="কুপন কোড (থাকলে)" aria-label="কুপন কোড"><button class="btn btn-small" id="pageCouponApply" type="button">প্রয়োগ</button></div><p id="pageCouponMessage" class="coupon-msg" role="status"></p>
      <div class="page-summary-row"><span>পণ্যের দাম</span><b id="checkoutSubtotal">${money(subtotal())}</b></div><div class="page-summary-row"><span>ডেলিভারি</span><b id="checkoutDelivery">${money(delivery("inside"))}</b></div>
      <div id="checkoutDiscountRow" class="page-summary-row" hidden><span>কুপন ছাড়</span><b id="checkoutDiscount"></b></div><div class="page-summary-row total"><span>সর্বমোট</span><b id="checkoutTotal">${money(subtotal() + delivery("inside"))}</b></div></aside></div>`;
    const form = $("#pageOrderForm");
    const updateTotal = () => {
      const ship = delivery($("#checkoutArea").value);
      const cut = coupon ? coupon.discount : 0;
      $("#checkoutDelivery").textContent = ship ? money(ship) : "ফ্রি";
      $("#checkoutDiscountRow").hidden = !cut;
      $("#checkoutDiscount").textContent = "−" + money(cut);
      $("#checkoutTotal").textContent = money(Math.max(0, subtotal() + ship - cut));
      const method = form.elements.payMethod.value;
      $("#pagePaymentInfo").hidden = method === "cod";
      $("#pagePaymentHelp").innerHTML = `${method === "bkash" ? "বিকাশ" : "নগদ"} <b>Send Money</b> করুন: <b>${escapeHtml(settings[method] || "")}</b> নম্বরে <b>${money(Math.max(0, subtotal() + ship - cut))}</b>, তারপর TrxID দিন।`;
    };
    $("#checkoutArea").addEventListener("change", updateTotal);
    form.addEventListener("change", (event) => { if (event.target.name === "payMethod") updateTotal(); });
    $("#pageCouponApply").addEventListener("click", async () => {
      const code = $("#pageCoupon").value.trim();
      const message = $("#pageCouponMessage");
      if (!code) { message.textContent = "কুপন কোড লিখুন।"; message.className = "coupon-msg err"; return; }
      if (!apiConnected) { message.textContent = "কুপন যাচাইয়ের জন্য Google Apps Script সংযোগ করুন।"; message.className = "coupon-msg err"; return; }
      const button = $("#pageCouponApply");
      button.disabled = true;
      try {
        const result = await postApi({ action: "coupon", code, subtotal: subtotal() });
        if (!result.ok) throw new Error(result.error || "এই কুপনটি প্রয়োগ করা যায়নি।");
        coupon = { code: result.code, discount: Number(result.discount) || 0 };
        message.textContent = `🎉 ${coupon.code} প্রয়োগ হয়েছে — ${money(coupon.discount)} ছাড়!`;
        message.className = "coupon-msg ok";
        updateTotal();
      } catch (error) {
        message.textContent = error.message || "কুপন যাচাই করা যায়নি।";
        message.className = "coupon-msg err";
      } finally { button.disabled = false; }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = $("#pageOrderMessage");
      const button = $("#pageOrderSubmit");
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const phone = englishDigits(String(data.get("phone") || "").trim());
      const email = String(data.get("email") || "").trim();
      const address = String(data.get("address") || "").trim();
      const payMethod = String(data.get("payMethod") || "cod");
      const trxId = String(data.get("trxId") || "").trim();
      const fail = (text) => { message.textContent = "⚠️ " + text; message.className = "form-msg err"; };
      message.textContent = "";
      if (data.get("website")) return;
      if (!cart.length) return fail("কার্ট খালি। আগে পণ্য যোগ করুন।");
      if (name.length < 3) return fail("সঠিক নাম লিখুন।");
      if (!/^01[3-9]\d{8}$/.test(phone)) return fail("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।");
      if (address.length < 10) return fail("সম্পূর্ণ ঠিকানা লিখুন।");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("সঠিক ইমেইল দিন অথবা ফাঁকা রাখুন।");
      if (payMethod !== "cod" && trxId.length < 6) return fail("পেমেন্টের ট্রানজেকশন আইডি (TrxID) দিন।");
      if (!apiConnected) return fail("অর্ডার গ্রহণের জন্য Google Apps Script Web App URL config.js ফাইলে সেট করুন।");
      button.disabled = true;
      button.textContent = "অর্ডার পাঠানো হচ্ছে...";
      try {
        const result = await postApi({
          action: "order", name, phone, address, email, area: data.get("area"),
          note: String(data.get("note") || "").trim(), payMethod, trxId,
          coupon: coupon ? coupon.code : "", items: cart.map((line) => ({ id: line.id, qty: line.qty }))
        });
        if (!result.ok) throw new Error(result.error || "অর্ডার সম্পন্ন হয়নি।");
        cart = [];
        coupon = null;
        saveCart();
        root.innerHTML = `<div class="page-result"><h2>✅ ধন্যবাদ, ${escapeHtml(name)}!</h2><p>আপনার অর্ডার গ্রহণ করা হয়েছে।</p><p>অর্ডার আইডি: <b>${escapeHtml(result.orderId)}</b></p><p>সর্বমোট: <b>${money(result.total)}</b></p><p>অর্ডার ট্র্যাক করতে আইডিটি সংরক্ষণ করুন।</p><a class="btn" href="track.html">অর্ডার ট্র্যাক করুন</a> <a class="btn btn-outline" href="shop.html">আরও কেনাকাটা করুন</a></div>`;
      } catch (error) {
        fail(error.message && error.message !== "Failed to fetch" ? error.message : "অর্ডার পাঠানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।");
      } finally {
        if (document.body.contains(button)) { button.disabled = false; button.textContent = "✅ অর্ডার কনফার্ম করুন"; }
      }
    });
    updateTotal();
    const couponCode = new URLSearchParams(location.search).get("coupon");
    if (couponCode) {
      $("#pageCoupon").value = couponCode;
      $("#pageCouponApply").click();
    }
  }

  async function postApi(payload) {
    const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("সার্ভারের সাথে যোগাযোগ করা যায়নি।");
    return response.json();
  }

  function initTrack() {
    const params = new URLSearchParams(location.search);
    $("#trackPageForm").elements.oid.value = params.get("id") || "";
    $("#trackPageForm").elements.phone.value = params.get("phone") || "";
    $("#trackPageForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = $("button[type=submit]", form);
      const resultNode = $("#trackPageResult");
      const id = form.elements.oid.value.trim();
      const phone = englishDigits(form.elements.phone.value.trim());
      resultNode.className = "form-msg";
      if (!id || !/^01[3-9]\d{8}$/.test(phone)) { resultNode.textContent = "সঠিক অর্ডার আইডি ও ১১ ডিজিটের মোবাইল নম্বর দিন।"; resultNode.classList.add("err"); return; }
      if (!apiConnected) { resultNode.textContent = "অর্ডার ট্র্যাক করতে Google Apps Script Web App URL config.js ফাইলে সেট করুন।"; resultNode.classList.add("err"); return; }
      button.disabled = true;
      button.textContent = "খোঁজা হচ্ছে...";
      try {
        const response = await fetch(`${apiUrl}?action=track&id=${encodeURIComponent(id)}&phone=${encodeURIComponent(phone)}`);
        if (!response.ok) throw new Error("সার্ভারের সাথে যোগাযোগ করা যায়নি।");
        const data = await response.json();
        if (!data.ok) throw new Error(data.error || "এই তথ্য দিয়ে অর্ডার পাওয়া যায়নি।");
        const order = data.order;
        resultNode.className = "page-result";
        resultNode.innerHTML = `<h2>✅ অর্ডার পাওয়া গেছে</h2><div class="page-track-info"><p>অর্ডার আইডি: <b>${escapeHtml(order.orderId)}</b></p><p>অবস্থা: <b>${escapeHtml(order.status)}</b></p><p>অর্ডারের পণ্য: ${escapeHtml(order.items)}</p><p>মোট: <b>${money(order.total)}</b></p></div>`;
      } catch (error) {
        resultNode.className = "page-result error";
        resultNode.textContent = error.message || "অর্ডারের তথ্য আনা যায়নি।";
      } finally {
        button.disabled = false;
        button.textContent = "🔍 অর্ডার খুঁজুন";
      }
    });
  }

  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    if (add) addToCart(add.dataset.add);
    const adjust = event.target.closest("[data-qty]");
    if (adjust) {
      const id = adjust.dataset.qty;
      const line = cart.find((item) => String(item.id) === String(id));
      const product = productById(id);
      if (!line || !product) return;
      const next = line.qty + Number(adjust.dataset.delta);
      if (next > product.stock) return notify(`স্টকে মাত্র ${product.stock.toLocaleString("bn-BD")}টি আছে।`);
      if (next <= 0) cart = cart.filter((item) => item !== line); else line.qty = next;
      saveCart();
      renderCartPage();
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      cart = cart.filter((line) => String(line.id) !== String(remove.dataset.remove));
      saveCart();
      renderCartPage();
      notify("🗑️ কার্ট থেকে সরানো হয়েছে");
    }
  });

  async function init() {
    pageHeader();
    pageBottomNav();
    pageFloatingCart();
    pageFooter();
    updateCartCount();
    await loadProducts();
    renderPageCategoryNav();
    cart = cart.map((line) => {
      const product = productById(line.id);
      return product ? { id: line.id, qty: Math.min(line.qty, Math.max(0, Number(product.stock) || 0)) } : null;
    }).filter((line) => line && line.qty > 0);
    saveCart();
    pageFooter();
    const page = document.body.dataset.page;
    if (page === "shop") renderShop();
    if (page === "product") renderProduct();
    if (page === "cart") renderCartPage();
    if (page === "checkout") renderCheckout();
    if (page === "track") initTrack();
  }

  init();
})();
