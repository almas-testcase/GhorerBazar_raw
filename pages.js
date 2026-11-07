/* Multi-page storefront. Cart storage intentionally matches script.js for cross-page continuity. */
(() => {
  "use strict";

  const defaults = {
    deliveryInside: 70, deliveryOutside: 120, freeDeliveryAbove: 1500,
    phone: "01852677251", whatsapp: "8801852677251", bkash: "01XXXXXXXXX", nagad: "01XXXXXXXXX"
  };
  const demo = [
    { id: 1, name: "Pure Mustard Oil", unit: "1 litre", category: "Oil", price: 320, oldPrice: 380, emoji: "🫒", image: "images/mustard-oil.svg", stock: 50, desc: "100% pure mustard oil, cold-pressed the traditional way. Strong aroma and taste with no adulteration or additives." },
    { id: 2, name: "Sundarban Pure Honey", unit: "500 g", category: "Honey", price: 650, oldPrice: 780, emoji: "🍯", image: "images/honey.svg", stock: 30, desc: "Natural honey from seasonal Sundarban flowers. Unprocessed, with no added sugar." },
    { id: 3, name: "Cashew Nuts (Premium)", unit: "500 g", category: "Nuts", price: 780, oldPrice: 900, emoji: "🥜", image: "images/cashews.svg", stock: 40, desc: "Large, fresh and crunchy cashew nuts. Great for snacking and cooking." },
    { id: 4, name: "Turmeric Powder", unit: "500 g", category: "Spices", price: 240, oldPrice: 280, emoji: "🟡", image: "images/turmeric.svg", stock: 60, desc: "Made from selected raw turmeric, pure and free from artificial colour." },
    { id: 5, name: "Chilli Powder", unit: "500 g", category: "Spices", price: 290, oldPrice: 340, emoji: "🌶️", image: "images/chili.svg", stock: 60, desc: "Hot and aromatic dried chilli powder with no adulteration or artificial colour." },
    { id: 6, name: "Pure Ghee (Desi)", unit: "500 g", category: "Ghee", price: 890, oldPrice: 1050, emoji: "🧈", image: "images/ghee.svg", stock: 20, desc: "Granular pure ghee made from desi cow-milk butter. The authentic taste is clear from the aroma." }
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const englishDigits = (value) => String(value).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const money = (value) => "৳" + Number(value || 0).toLocaleString("en-US");
  const apiUrl = typeof SITE_API_URL === "string" ? SITE_API_URL : "";
  const apiConnected = apiUrl && !apiUrl.includes("WEB_APP_URL");
  let products = [];
  let categoryList = []; // category order set in the admin panel
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
    try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (error) {
      notify("Could not save the cart. Check your browser storage.");
      updateCartCount();
      return false;
    }
    updateCartCount();
    return true;
  }

  function notify(message) {
    const node = $("#pageToast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  function productImageCandidates(value) {
    const url = String(value || "").trim();
    const candidates = [url];
    let driveId = (url.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/i) || [])[1];
    try {
      const parsed = new URL(url);
      if (!driveId && parsed.hostname === "drive.google.com") {
        driveId = (parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || [])[1] || parsed.searchParams.get("id");
      }
    } catch (error) {}
    if (driveId) {
      candidates.push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`);
      candidates.push(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`);
    }
    return [...new Set(candidates.filter(Boolean))];
  }

  function bindProductImage(img) {
    const candidates = productImageCandidates(img.dataset.productImage);
    let index = 0;
    img.addEventListener("error", () => {
      if (index < candidates.length) {
        img.src = candidates[index++];
        return;
      }
      img.hidden = true;
      const fallback = img.parentElement.querySelector(".pd-image-error");
      if (fallback) fallback.hidden = false;
    });
    if (candidates.length) img.src = candidates[index++];
  }

  function pageHeader() {
    $("#siteHeader").innerHTML = `
      <div class="marquee"><div class="marquee-track"><div class="mq"><span>🌿 100% pure & adulteration-free products</span><span>🚚 Cash on delivery nationwide</span><span>↩️ Easy 7-day returns</span><span>🌿 100% pure & adulteration-free products</span><span>🚚 Cash on delivery nationwide</span><span>↩️ Easy 7-day returns</span></div></div></div>
      <header class="header"><div class="container header-inner page-header-inner">
        <a href="index.html" class="logo brand-logo" aria-label="KhatiGhor Home"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M7 17.5 20 7l13 10.5v15H7z"/><path d="M15 32V21h10v11"/><path d="M20 17c-4-5-8-2-7 1 1 3 6 3 7 3"/><path d="M20 17c4-5 8-2 7 1-1 3-6 3-7 3"/></svg></span><span class="brand-wordmark">Khati<small>Ghor</small></span></a>
        <form class="h-search" id="globalSearch" role="search"><input id="globalSearchInput" type="search" placeholder="Search: oil, তেল, honey, মধু…" aria-label="Search products"><button type="submit" aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></button></form>
        <div class="h-actions">
          <a class="h-link h-action-link page-track-link" href="track.html"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><small>Track Order</small></a>
          <a class="cart-btn h-action-button page-cart-button" href="cart.html" aria-label="View cart"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i><small>Cart</small><b id="pageCartCount">0</b></a>
          <div class="h-more-wrap"><button type="button" class="h-more-toggle h-action-button" id="pageMoreToggle" aria-expanded="false" aria-controls="pageMoreMenu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><small>Menu</small></button>
            <div class="h-more-menu" id="pageMoreMenu" hidden><a href="index.html"><i class="fa-solid fa-house" aria-hidden="true"></i> Homepage</a><a href="shop.html"><i class="fa-solid fa-store" aria-hidden="true"></i> All Products</a><a href="shop.html?offer=1"><i class="fa-solid fa-fire" aria-hidden="true"></i> Best Offers</a><a href="cart.html"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Your Cart</a><a href="track.html"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> Track Order</a><hr><a href="index.html#faq"><i class="fa-solid fa-circle-question" aria-hidden="true"></i> FAQ</a><a href="terms.html"><i class="fa-solid fa-file-lines" aria-hidden="true"></i> Returns &amp; Terms</a><a href="privacy.html"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Privacy Policy</a><hr><button type="button" id="pageTheme" aria-label="Change theme">☾ Change theme</button></div>
          </div>
        </div>
      </div></header>
      <nav class="catbar"><div class="container catbar-inner page-nav"><a class="cat cat-offers" href="shop.html?offer=1">Best Offers</a><div class="cat-list"><a class="cat" href="shop.html">All Products</a><a class="cat" href="shop.html?cat=${encodeURIComponent("Oil")}">Oil</a><a class="cat" href="shop.html?cat=${encodeURIComponent("Honey")}">Honey</a><a class="cat" href="shop.html?cat=${encodeURIComponent("Spices")}">Spices</a><a class="cat" href="shop.html?cat=${encodeURIComponent("Nuts")}">Nuts</a></div></div></nav>`;
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
      try { localStorage.setItem("theme", next); } catch (error) { notify("Could not save the theme preference."); }
      $("#pageTheme").textContent = next === "dark" ? "☀️ Change theme" : "☾ Change theme";
    });
    $("#pageTheme").textContent = document.documentElement.dataset.theme === "dark" ? "☀️ Change theme" : "☾ Change theme";
    if (window.SearchSuggest) SearchSuggest.attach({ form: $("#globalSearch"), input: $("#globalSearchInput"), getProducts: () => products, getCategories: () => categoryNames(false) });
    const presetQ = new URLSearchParams(location.search).get("q");
    if (presetQ && /shop\.html$/i.test(location.pathname)) $("#globalSearchInput").value = presetQ;
    $("#globalSearch").addEventListener("submit", (event) => {
      event.preventDefault();
      const query = $("#globalSearchInput").value.trim();
      location.href = "shop.html" + (query ? "?q=" + encodeURIComponent(query) : "");
    });
  }

  // items আছে এমন Category, অ্যাডমিনের ক্রমে (তালিকায় না থাকলে শেষে)
  function categoryNames(withEmpty = false) {
    const used = new Set(products.map((p) => p.category).filter(Boolean));
    const order = categoryList.map((c) => c.name).filter((n) => withEmpty || used.has(n));
    return [...order, ...[...used].filter((n) => !order.includes(n))];
  }

  function renderPageCategoryNav() {
    const categories = categoryNames(true);
    $(".page-nav .cat-list").innerHTML = `<a class="cat" href="shop.html">All Products</a>${categories.map((category) => `<a class="cat" href="shop.html?cat=${encodeURIComponent(category)}">${escapeHtml(category)}<span class="cat-chevron" aria-hidden="true">⌄</span></a>`).join("")}`;
  }

  function pageFooter() {
    const cfgC = typeof SITE_CONTACT !== "undefined" ? SITE_CONTACT : {};
    const cfgS = typeof SITE_SOCIAL !== "undefined" ? SITE_SOCIAL : {};
    const contactEmail = settings.email || cfgC.email || "";
    const contactAddress = settings.address || cfgC.address || "";
    const httpsOnly = (u) => (/^https:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
    const socialHtml = [["facebook", "s-fb", "fa-facebook-f", "Facebook"], ["twitter", "s-tw", "fa-twitter", "Twitter"], ["instagram", "s-ig", "fa-instagram", "Instagram"], ["linkedin", "s-li", "fa-linkedin-in", "LinkedIn"], ["tiktok", "s-tk", "fa-tiktok", "TikTok"]]
      .map(([key, cls, icon, label]) => { const u = httpsOnly(settings[key] || cfgS[key]); return u ? `<a href="${escapeHtml(u)}" class="${cls}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}"><i class="fa-brands ${icon}" aria-hidden="true"></i></a>` : ""; }).join("")
      + `<a href="https://wa.me/${escapeHtml(settings.whatsapp)}" class="s-wa" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i></a>`;
    // "Shop": অ্যাডমিনের বাছাই করা সর্বোচ্চ ৫টি Category (কিছু না বাছলে প্রথম ৫টি)
    const allCats = categoryNames(true);
    const pickedCats = String(settings.footerCats || "").split("|").filter((n) => allCats.includes(n));
    const footerCatLinks = (pickedCats.length ? pickedCats : allCats).slice(0, 5)
      .map((c) => `<a href="shop.html?cat=${encodeURIComponent(c)}">${escapeHtml(c)}</a>`).join("") || `<a href="shop.html">All Products</a>`;
    $("#siteFooter").innerHTML = `<footer class="footer catalog-footer"><div class="container"><div class="footer-grid">
      <div class="f-brand"><a href="index.html" class="logo brand-logo" aria-label="KhatiGhor Home"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M7 17.5 20 7l13 10.5v15H7z"/><path d="M15 32V21h10v11"/><path d="M20 17c-4-5-8-2-7 1 1 3 6 3 7 3"/><path d="M20 17c4-5 8-2 7 1-1 3-6 3-7 3"/></svg></span><span class="brand-wordmark">Khati<small>Ghor</small></span></a><p>Adulteration-free oil, spices, nuts and honey — straight from the source to your home. Trust and quality define us.</p></div>
      <div><h4>Shop</h4><div class="footer-links">${footerCatLinks}</div></div>
      <div><h4>Help</h4><div class="footer-links"><a href="track.html">Track your order</a><a href="index.html#faq">FAQ</a><a href="terms.html">Returns & Terms</a><a href="privacy.html">Privacy Policy</a></div></div>
      <div><h4>Contact</h4><div class="footer-links f-contact">${contactEmail ? `<p><i class="fa-solid fa-envelope" aria-hidden="true"></i><a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a></p>` : ""}<p><i class="fa-solid fa-phone" aria-hidden="true"></i><a href="tel:${escapeHtml(settings.phone)}">${escapeHtml(settings.phone)}</a></p>${contactAddress ? `<p><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>${escapeHtml(contactAddress)}</span></p>` : ""}</div>
        <div class="social f-social">${socialHtml}</div></div>
      </div><div class="footer-pay"><picture><source srcset="images/sslcommerz.webp" type="image/webp"><img src="images/sslcommerz.png" alt="SSLCommerz — Secure Payment Gateway" width="2647" height="427" loading="lazy" decoding="async"></picture></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} KhatiGhor. All rights reserved. · Developed by <b>Almas Forhadi</b></span></div></div></footer>`;
  }

  async function loadProducts() {
    if (apiConnected) {
      try {
        const apply = (data) => {
          products = data.products;
          categoryList = Array.isArray(data.categories) ? data.categories : [];
          settings = { ...settings, ...(data.settings || {}) };
        };
        const warm = window.ShopData && ShopData.cached();
        if (warm && Array.isArray(warm.products)) apply(warm); // instant paint from the saved copy; refreshed below
        const data = window.ShopData ? await ShopData.load() : await (await fetch(apiUrl + "?action=products")).json();
        if (data.ok && Array.isArray(data.products)) {
          apply(data);
          if (window.ShopData) ShopData.save(data);
          return;
        }
        throw new Error(data.error || "Product information was not found.");
      } catch (error) {
        console.error("Product API error:", error);
        if (products && products.length) return; // keep the saved copy if the network failed
        notify("Could not fetch products from the server; showing sample products.");
      }
    }
    products = demo;
  }

  function productById(id) { return products.find((product) => String(product.id) === String(id)); }
  function discount(product) { return product.oldPrice > product.price ? Math.round((1 - product.price / product.oldPrice) * 100) : 0; }
  function productCard(product) {
    const visual = product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">` : escapeHtml(product.emoji || "🛍️");
    return `<article class="product${product.stock <= 0 ? " out" : ""}">
      <a class="product-img" href="product.html?id=${encodeURIComponent(product.id)}">${discount(product) ? `<span class="off-badge">−${discount(product)}%</span>` : ""}${visual}</a>
      <div class="product-body"><small>${escapeHtml(product.category || "")}</small><h3><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
      <small>${escapeHtml(product.unit || "")}</small><div class="price">${money(product.price)} ${product.oldPrice > product.price ? `<del>${money(product.oldPrice)}</del>` : ""}</div>
      <div class="card-actions"><button type="button" class="btn btn-outline add-to-cart-btn" data-add="${escapeHtml(product.id)}" ${product.stock <= 0 ? "disabled" : ""}><svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>Add To Cart</button><a class="btn" href="product.html?id=${encodeURIComponent(product.id)}">Details</a></div></div></article>`;
  }

  function lineItems() {
    return cart.map((line) => ({ product: productById(line.id), qty: line.qty })).filter((line) => line.product);
  }
  function subtotal() { return lineItems().reduce((sum, line) => sum + Number(line.product.price) * line.qty, 0); }
  function updateCartCount() {
    const count = cart.reduce((sum, line) => sum + line.qty, 0);
    const badge = $("#pageCartCount");
    if (badge) { badge.textContent = count.toLocaleString("en-US"); badge.classList.toggle("has", count > 0); }
    const fc = $("#pageFloatCount");
    if (fc) { fc.textContent = count.toLocaleString("en-US"); $("#pageFloatTotal").textContent = money(subtotal()); }
    const nb = $("#pageBnCount");
    if (nb) { nb.textContent = count.toLocaleString("en-US"); nb.hidden = false; }
  }

  function pageFloatingCart() {
    if (document.querySelector(".floating-cart")) return;
    const a = document.createElement("a");
    a.className = "floating-cart";
    a.href = "cart.html";
    a.setAttribute("aria-label", "View cart");
    a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><span><b id="pageFloatCount">0</b> items</span><strong id="pageFloatTotal">৳0</strong>`;
    document.body.appendChild(a);
  }

  function pageBottomNav() {
    if (document.querySelector(".bottom-nav")) return;
    const here = location.pathname.split("/").pop() || "index.html";
    const item = (href, svg, label, extra = "") => `<a href="${href}" class="bn-item${here === href ? " on" : ""}">${svg}<small>${label}</small>${extra}</a>`;
    const nav = document.createElement("nav");
    nav.className = "bottom-nav bn-pages";
    nav.setAttribute("aria-label", "Mobile menu");
    nav.innerHTML = item("index.html", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/></svg>`, "Home")
      + item("shop.html", `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/></svg>`, "Shop")
      + item("cart.html", `<i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>`, "Cart", `<b id="pageBnCount">0</b>`)
      + item("track.html", `<i class="fa-solid fa-location-dot" aria-hidden="true"></i>`, "Track");
    document.body.appendChild(nav);
    document.body.classList.add("has-bn");
  }

  function addToCart(id, qty = 1) {
    const product = productById(id);
    if (!product || product.stock <= 0) {
      notify("This product is currently out of stock.");
      return false;
    }
    const line = cart.find((item) => String(item.id) === String(id));
    const available = product.stock - (line ? line.qty : 0);
    if (available < qty) {
      notify(`Only ${Math.max(0, available).toLocaleString("en-US")} in stock.`);
      return false;
    }
    const previousCart = cart.map((item) => ({ ...item }));
    if (line) line.qty += qty; else cart.push({ id: product.id, qty });
    if (!saveCart()) {
      cart = previousCart;
      updateCartCount();
      return false;
    }
    notify("✅ Added to cart");
    return true;
  }

  function renderShop() {
    const sort = $("#shopSort");
    const query = new URLSearchParams(location.search);
    const offersOnly = query.get("offer") === "1";
    const q = (query.get("q") || "").trim().toLocaleLowerCase();
    const hits = q && window.SearchSuggest ? new Map(SearchSuggest.search(products, q).map((h) => [h.p, h.score])) : null;
    const cats = categoryNames();
    const picked = new Set(query.get("cat") ? [query.get("cat")] : []);
    const prices = products.map((p) => Number(p.price) || 0);
    const lo = Math.floor(Math.min(0, ...prices)), hi = Math.max(100, Math.ceil(Math.max(...prices, 0) / 10) * 10);
    const rMin = $("#rangeMin"), rMax = $("#rangeMax");
    [rMin, rMax].forEach((r) => { r.min = lo; r.max = hi; });
    rMin.value = lo; rMax.value = hi;
    $("#shopOffer").checked = offersOnly;
    const heading = (text) => { $("#shopTitle").textContent = text; $("#shopCrumb").textContent = text; document.title = text + " | KhatiGhor"; };
    $("#shopCats").innerHTML = cats.map((cat) => `<label class="side-check"><input type="checkbox" value="${escapeHtml(cat)}" ${picked.has(cat) ? "checked" : ""}><span>${escapeHtml(cat)}</span><em>${products.filter((p) => p.category === cat).length.toLocaleString("en-US")}</em></label>`).join("");
    const bn = (n) => "৳ " + Number(n).toLocaleString("en-US");
    const draw = () => {
      let a = Number(rMin.value), b = Number(rMax.value);
      if (a > b) [a, b] = [b, a];
      const span = hi - lo || 1;
      $("#drFill").style.cssText = `left:${((a - lo) / span) * 100}%;right:${100 - ((b - lo) / span) * 100}%`;
      $("#pvMin").textContent = bn(a); $("#pvMax").textContent = bn(b);
      const sel = [...document.querySelectorAll("#shopCats input:checked")].map((i) => i.value);
      const offer = $("#shopOffer").checked, stock = $("#shopStock").checked;
      let found = products.filter((p) => (!hits || hits.has(p)) && (!sel.length || sel.includes(p.category)) && p.price >= a && p.price <= b && (!offer || p.oldPrice > p.price) && (!stock || p.stock > 0));
      if (hits && !sort.value) found.sort((x, y) => hits.get(y) - hits.get(x)); // best match first
      if (sort.value === "low") found.sort((x, y) => x.price - y.price);
      if (sort.value === "high") found.sort((x, y) => y.price - x.price);
      if (sort.value === "disc") found.sort((x, y) => discount(y) - discount(x));
      if (sort.value === "name") found.sort((x, y) => x.name.localeCompare(y.name, "bn"));
      heading(offersOnly && !sel.length ? "Best Offers" : sel.length === 1 ? sel[0] : q ? `Results for “${query.get("q")}”` : "All Products");
      $("#shopStatus").textContent = `${found.length.toLocaleString("en-US")} products found`;
      $("#shopProducts").innerHTML = found.length ? found.map(productCard).join("") : `<div class="empty-state"><p>No products found for this search.</p><button type="button" class="btn btn-small" id="emptyReset">Clear filters</button></div>`;
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

  const starRow = (n) => `<span class="pd-stars" aria-label="${n} stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? "on" : ""}">★</i>`).join("")}</span>`;
  const reviewDist = (list) => { const d = [0, 0, 0, 0, 0]; list.forEach((v) => { const r = Math.min(5, Math.max(1, Math.round(Number(v.rating) || 0))); d[r - 1]++; }); return d; };

  function reviewsPanel(data) {
    const list = data && data.reviews ? data.reviews : [];
    const count = data && data.count != null ? data.count : list.length;
    const avg = data && data.average != null ? Number(data.average) : (list.length ? list.reduce((s, v) => s + Number(v.rating || 0), 0) / list.length : 0);
    const dist = data && data.distribution ? data.distribution : reviewDist(list);
    const fmt = (n) => Number(n).toLocaleString("en-US");
    const good = (dist[3] || 0) + (dist[4] || 0);
    const pct = (n) => (count ? Math.round((dist[n - 1] || 0) / count * 100) : 0);
    const summary = `<div class="pd-rv-score"><b>${avg.toFixed(1)}</b><div><span>Average Rating</span>${starRow(avg)}<small>(${fmt(count)} ${count === 1 ? "Review" : "Reviews"})</small></div></div>
      <div class="pd-recommend"><b>${count ? (good / count * 100).toFixed(2) : "0.00"}%</b><span>Recommended</span><small>(${fmt(good)} of ${fmt(count)})</small></div>
      <div class="pd-rv-bars">${[5, 4, 3, 2, 1].map((n) => `<div><span>${starRow(n)}</span><i><u style="width:${pct(n)}%"></u></i><em>${pct(n)}%</em></div>`).join("")}</div>`;
    const items = list.map((v) => `<li><span class="pd-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span><div><div class="pd-rv-head"><b>${escapeHtml(v.name || "Customer")}</b>${v.verified ? `<em class="pd-ver">✔ Verified buyer</em>` : ""}<small>${escapeHtml(v.date || "")}</small></div>${starRow(v.rating)}${v.text ? `<p>${escapeHtml(v.text)}</p>` : ""}</div></li>`).join("");
    return `<div class="pd-rv-grid">
      <div class="pd-rv-left">${summary}</div>
      <div class="pd-rv-right">
        <h3 class="pd-h">Submit Your Review</h3>
        <form id="pdReviewForm" class="pd-rv-form" novalidate>
          <p class="pd-hint">Your email address will not be published. Required fields are marked *</p>
          <label>Your name *<input name="name" maxlength="40" autocomplete="name" placeholder="Enter your name"></label>
          <label>Write your opinion about the product<textarea name="text" rows="4" maxlength="500" placeholder="Write Your Review Here..."></textarea></label>
          <div class="pd-upload-wrap"><span>Upload Images (Optional)</span>
            <div class="pd-drop" id="pdDrop" tabindex="0" role="button" aria-label="Choose photos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H15M12 20v-8m0 0-3 3m3-3 3 3"/></svg><b>Drag &amp; Drop Images Here</b><small>or click to browse files ( 3 max )</small><input type="file" id="pdFiles" accept="image/*" multiple hidden></div>
            <div class="pd-previews" id="pdPreviews"></div></div>
          <div class="pd-rv-foot"><label>Your Rating: *<select name="rating"><option value="">Select One</option><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Average</option><option value="2">2 - Poor</option><option value="1">1 - Very poor</option></select></label><button class="pd-submit" type="submit">SUBMIT REVIEW</button></div>
          <p class="form-msg" id="pdRvMsg" role="alert"></p>
        </form>
      </div>
    </div>${items ? `<ul class="pd-rv-list">${items}</ul>` : ""}`;
  }

  function renderProduct() {
    const product = productById(new URLSearchParams(location.search).get("id"));
    const target = $("#productDetail");
    if (!product) {
      target.innerHTML = `<div class="page-empty"><span>🔎</span><h2>Product not found</h2><p>The product has been removed or the link is incorrect.</p><a class="btn" href="shop.html">View all products</a></div>`;
      $("#productTabs").innerHTML = ""; document.querySelector(".related-section").hidden = true;
      return;
    }
    document.title = `${product.name} | KhatiGhor`;
    $("#pdCrumb").textContent = product.name;
    let raw = Array.isArray(product.images) ? product.images : [];
    if (typeof product.images === "string") {
      try {
        const parsed = JSON.parse(product.images);
        raw = Array.isArray(parsed) ? parsed : product.images.split(/[,\n|]/);
      } catch (e) { raw = product.images.split(/[,\n|]/); }
    }
    const images = [...new Set([product.image, ...raw].map((x) => String(x || "").trim()).filter(Boolean))].slice(0, 3);
    const out = product.stock <= 0, off = discount(product);
    const badge = off ? `<span class="off-badge">−${off.toLocaleString("en-US")}%</span>` : "";
    let activeImageIndex = 0;
    const mainVisual = (src) => src ? `<img class="gallery-image" data-product-image="${escapeHtml(src)}" alt="${escapeHtml(product.name)}"><span class="pd-image-error" hidden>Image unavailable<br>Check image link access</span>` : `<span class="pd-emoji">${escapeHtml(product.emoji || "🛍️")}</span>`;
    const galleryNav = images.length > 1 ? `<button type="button" class="pd-gallery-nav pd-gallery-prev" data-gallery-step="-1" aria-label="Previous product image"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button><button type="button" class="pd-gallery-nav pd-gallery-next" data-gallery-step="1" aria-label="Next product image"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button><span class="pd-gallery-count" aria-live="polite">1 / ${images.length}</span>` : "";
    const waText = encodeURIComponent(`I would like to order "${product.name}".`);
    const cartIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`;
    const heartIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>`;
    let wishlist = [];
    try {
      const saved = JSON.parse(localStorage.getItem("wishlist") || "[]");
      if (!Array.isArray(saved)) throw new Error("Wishlist data is invalid");
      wishlist = saved.map(String);
    } catch (error) {
      notify("Could not read the wishlist. It may be cleared when you add a product.");
    }
    const wished = wishlist.includes(String(product.id));
    target.innerHTML = `<div class="pd-card">
      <div class="pd-gallery${images.length > 1 ? " has-thumbs" : ""}">
        ${images.length > 1 ? `<div class="pd-thumbs" id="pdThumbs" role="group" aria-label="Product images">${images.map((src, i) => `<button type="button" class="${i === 0 ? "on" : ""}" data-src="${escapeHtml(src)}" aria-label="Show product image ${(i + 1).toLocaleString("en-US")}" aria-pressed="${i === 0}"><img data-product-image="${escapeHtml(src)}" alt=""></button>`).join("")}</div>` : ""}
        <div class="pd-main" id="pdMain" data-magnifier>${badge}${mainVisual(images[0])}${galleryNav}<span class="gallery-lens" aria-hidden="true"></span></div>
      </div>
      <div class="pd-info">
        <h1>${escapeHtml(product.name)}</h1>
        <div class="pd-price"><b>${money(product.price)}</b>${product.oldPrice > product.price ? `<del>${money(product.oldPrice)}</del><span class="pd-save">${off.toLocaleString("en-US")}% off</span>` : ""}</div>
        <ul class="pd-meta">${product.unit ? `<li><span>Quantity</span><b>${escapeHtml(product.unit)}</b></li>` : ""}${product.category ? `<li><span>Category</span><a href="shop.html?cat=${encodeURIComponent(product.category)}">${escapeHtml(product.category)}</a></li>` : ""}<li><span>Availability</span><b class="${out ? "no" : "yes"}">${out ? "Out of stock" : `In stock${product.stock <= 5 ? ` · Only ${product.stock.toLocaleString("en-US")} left` : ""}`}</b></li></ul>
        <div class="pd-qty-row"><span>Quantity:</span><div class="pd-qty"><button type="button" id="pdMinus" aria-label="Decrease">−</button><input id="pdQty" type="text" inputmode="numeric" value="1" aria-label="Quantity"><button type="button" id="pdPlus" aria-label="Increase">+</button></div></div>
        <div class="pd-btns">
          <button type="button" class="pd-btn pd-add" id="pdAdd" ${out ? "disabled" : ""}>${cartIcon} Add to cart</button>
          <button type="button" class="pd-btn pd-buy" id="pdBuy" ${out ? "disabled" : ""}>Buy now</button>
          <button type="button" class="pd-btn pd-wish${wished ? " on" : ""}" id="pdWish" aria-pressed="${wished}">${heartIcon}<span>${wished ? "In Wishlist" : "Wishlist"}</span></button>
          <a class="pd-btn pd-wa" target="_blank" rel="noopener" href="https://wa.me/${escapeHtml(settings.whatsapp)}?text=${waText}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.7.62.72.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.8a9.87 9.87 0 0 0 5.03-1.38l.36-.21 3.74.98-1-3.65.24-.37a9.86 9.86 0 1 0-8.37 4.63zM12.05 0a11.8 11.8 0 0 0 10.1 17.8L24 24l-6.35-1.65A11.8 11.8 0 1 0 12.05 0z"/></svg> Order on WhatsApp</a>
        </div>
        <p class="pd-note">🚚 Nationwide delivery · 💵 Cash on delivery · ↩️ Easy 7-day returns</p>
      </div></div>`;
    target.querySelectorAll("img[data-product-image]").forEach(bindProductImage);

    const desc = escapeHtml(product.desc || "100% pure, carefully selected product.").replace(/\n/g, "<br>");
    const vid = String(product.video || "").trim();
    const ytId = (vid.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
    const videoEmbed = ytId ? `https://www.youtube.com/embed/${ytId}` : "";
    $("#productTabs").innerHTML = `<div class="pd-tabs" role="tablist"><button type="button" class="on" role="tab" data-tab="desc">Description</button>${videoEmbed ? `<button type="button" role="tab" data-tab="vid">Product video</button>` : ""}<button type="button" role="tab" data-tab="rev" id="pdRevTab">Customer reviews</button></div>
      <div class="pd-panel" id="pdPanelDesc"><h3 class="pd-h">Product description</h3><p class="pd-desc">${desc}</p></div>
      ${videoEmbed ? `<div class="pd-panel" id="pdPanelVid" hidden><div class="pd-video"><iframe src="${escapeHtml(videoEmbed)}" title="Product video" loading="lazy" allowfullscreen></iframe></div></div>` : ""}
      <div class="pd-panel" id="pdPanelRev" hidden></div>`;

    const qty = $("#pdQty");
    const clamp = () => { let n = parseInt(englishDigits(qty.value), 10); if (!n || n < 1) n = 1; if (product.stock > 0 && n > product.stock) n = product.stock; qty.value = n; return n; };
    $("#pdMinus").addEventListener("click", () => { qty.value = clamp() - 1; clamp(); });
    $("#pdPlus").addEventListener("click", () => { qty.value = clamp() + 1; clamp(); });
    qty.addEventListener("change", clamp);
    $("#pdAdd").addEventListener("click", () => addToCart(product.id, clamp()));
    $("#pdBuy").addEventListener("click", () => {
      if (addToCart(product.id, clamp())) location.assign(new URL("checkout.html", window.location.href).href);
    });
    $("#pdWish").addEventListener("click", (e) => {
      try {
        const saved = JSON.parse(localStorage.getItem("wishlist") || "[]");
        if (!Array.isArray(saved)) throw new Error("Wishlist data is invalid");
        const ids = saved.map(String), id = String(product.id), index = ids.indexOf(id);
        const added = index < 0;
        if (added) ids.unshift(id); else ids.splice(index, 1);
        localStorage.setItem("wishlist", JSON.stringify(ids));
        e.currentTarget.classList.toggle("on", added);
        e.currentTarget.setAttribute("aria-pressed", String(added));
        e.currentTarget.querySelector("span").textContent = added ? "In Wishlist" : "Wishlist";
        notify(added ? "❤️ Added to wishlist" : "Removed from wishlist");
      } catch (error) {
        notify("Could not save the wishlist. Check your browser storage.");
      }
    });
    const thumbs = $("#pdThumbs");
    const selectImage = (index) => {
      activeImageIndex = (index + images.length) % images.length;
      const main = $("#pdMain");
      main.innerHTML = badge + mainVisual(images[activeImageIndex]) + galleryNav + `<span class="gallery-lens" aria-hidden="true"></span>`;
      const image = main.querySelector(".gallery-image");
      if (image) bindProductImage(image);
      if (image) {
        image.classList.remove("gallery-swap");
        void image.offsetWidth;
        image.classList.add("gallery-swap");
      }
      const count = main.querySelector(".pd-gallery-count");
      if (count) count.textContent = `${activeImageIndex + 1} / ${images.length}`;
      if (thumbs) thumbs.querySelectorAll("button").forEach((button, i) => {
        const active = i === activeImageIndex;
        button.classList.toggle("on", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };
    if (thumbs) thumbs.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-src]");
      if (!b) return;
      selectImage(images.indexOf(b.dataset.src));
    });
    $("#pdMain").addEventListener("click", (e) => {
      const step = e.target.closest("[data-gallery-step]");
      if (step) selectImage(activeImageIndex + Number(step.dataset.galleryStep));
    });
    const main = $("#pdMain");
    let galleryTimer = null, resumeTimer = null, touchStartX = null;
    const stopGallery = () => { clearInterval(galleryTimer); galleryTimer = null; clearTimeout(resumeTimer); };
    const startGallery = () => {
      if (images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches || galleryTimer) return;
      galleryTimer = setInterval(() => selectImage(activeImageIndex + 1), 4200);
    };
    const pauseGallery = () => { stopGallery(); };
    const resumeGallery = () => { clearTimeout(resumeTimer); resumeTimer = setTimeout(startGallery, 900); };
    const updateLens = (image, lens, rect, clientX, clientY) => {
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
    main.addEventListener("pointerenter", pauseGallery);
    main.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      const lens = main.querySelector(".gallery-lens");
      if (lens) lens.classList.remove("is-visible");
      resumeGallery();
    });
    main.addEventListener("focusin", pauseGallery);
    main.addEventListener("focusout", resumeGallery);
    main.addEventListener("pointerdown", (e) => {
      pauseGallery();
      if (e.pointerType === "touch" && !e.target.closest("button")) touchStartX = e.clientX;
      if (e.pointerType === "touch" && !e.target.closest("button")) {
        const image = main.querySelector(".gallery-image"), lens = main.querySelector(".gallery-lens");
        if (image && lens) updateLens(image, lens, main.getBoundingClientRect(), e.clientX, e.clientY);
      }
    });
    main.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" || e.pointerType === "mouse") {
        const image = main.querySelector(".gallery-image"), lens = main.querySelector(".gallery-lens");
        if (!image || !lens || e.target.closest("button")) return;
        const rect = main.getBoundingClientRect();
        updateLens(image, lens, rect, e.clientX, e.clientY);
      }
    });
    main.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch" && touchStartX != null) {
        const delta = e.clientX - touchStartX;
        if (Math.abs(delta) > 45) selectImage(activeImageIndex + (delta < 0 ? 1 : -1));
        touchStartX = null;
        resumeGallery();
      }
    });
    main.addEventListener("pointercancel", () => { touchStartX = null; resumeGallery(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stopGallery(); else resumeGallery(); });
    startGallery();

    let reviewData = null;
    const revPanel = $("#pdPanelRev");
    const paintReviews = () => {
      revPanel.innerHTML = reviewsPanel(reviewData);
      const total = reviewData ? (reviewData.count != null ? reviewData.count : (reviewData.reviews || []).length) : 0;
      $("#pdRevTab").textContent = `Customer reviews (${total.toLocaleString("en-US")})`;
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
    const paintShots = () => { const box = $("#pdPreviews"); if (box) box.innerHTML = shots.map((src, i) => `<div><img src="${src}" alt=""><button type="button" data-rm="${i}" aria-label="Remove">✕</button></div>`).join(""); };
    const addShots = async (files) => {
      for (const f of [...files].filter((x) => x.type.startsWith("image/"))) {
        if (shots.length >= 3) { notify("You can add up to 3 photos."); break; }
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
      const reviewer = f.name.value.trim(), rating = Number(f.rating.value);
      if (!apiConnected) return say("Review submission is not enabled yet.");
      if (reviewer.length < 2) return say("Please enter your name.");
      if (!rating) return say("Select a rating.");
      const btn = f.querySelector("[type=submit]"); btn.disabled = true;
      try {
        const r = await postApi({ action: "review", productId: product.id, name: reviewer, rating, text: f.text.value.trim(), images: shots });
        if (!r.ok) return say(r.error || "Review was not submitted.");
        f.reset(); shots = []; paintShots(); say("✅ Thank you! Your review will be published after approval.", true);
      } catch (err) { say("Something went wrong, please try again."); }
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
      ${checkout ? `<small>Quantity: ${line.qty.toLocaleString("en-US")}</small>` : `<div class="page-cart-actions page-qty"><button type="button" data-qty="${escapeHtml(product.id)}" data-delta="-1" aria-label="Decrease by one">−</button><span>${line.qty.toLocaleString("en-US")}</span><button type="button" data-qty="${escapeHtml(product.id)}" data-delta="1" aria-label="Increase by one">+</button></div>`}</div>
      <div class="page-cart-price"><b>${money(product.price * line.qty)}</b>${checkout ? "" : `<button class="page-cart-remove" type="button" data-remove="${escapeHtml(product.id)}">Remove</button>`}</div></div>`;
  }

  function renderCartPage() {
    const lines = lineItems();
    const root = $("#cartPage");
    if (!lines.length) {
      root.innerHTML = `<div class="page-empty"><span>🛒</span><h2>Your cart is empty</h2><p>Add products to your cart to start shopping.</p><a class="btn" href="shop.html">Browse products</a></div>`;
      return;
    }
    root.innerHTML = `<div class="cart-page"><section class="cart-lines" aria-label="Cart items"><div class="cart-lines-head"><span>Product</span><span>Total</span></div>${lines.map((line) => cartRow(line)).join("")}</section>
      <aside class="cart-summary"><h2>Order summary</h2><div class="page-summary-row"><span>Subtotal</span><b>${money(subtotal())}</b></div>
      <div class="page-summary-row"><span>Delivery</span><b>Calculated at checkout</b></div><div class="page-summary-row total"><span>Subtotal</span><b>${money(subtotal())}</b></div>
      <a class="btn btn-block" href="checkout.html">Go to checkout →</a><a class="btn btn-outline btn-block" href="shop.html" style="margin-top:10px">Continue shopping</a></aside></div>`;
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
      root.innerHTML = `<div class="page-empty"><span>🛒</span><h2>Your cart is empty</h2><p>Add products to your cart before checkout.</p><a class="btn" href="shop.html">Browse products</a></div>`;
      return;
    }
    root.innerHTML = `<div class="checkout-layout"><form id="pageOrderForm" class="page-form" novalidate>
      <h2>1. Delivery details</h2><label>Your name *<input name="name" autocomplete="name" required minlength="3" placeholder="Your name"></label>
      <label>Mobile number *<input name="phone" type="tel" autocomplete="tel" inputmode="numeric" maxlength="11" required placeholder="01XXXXXXXXX"></label>
      <label>Email <small>optional</small><input name="email" type="email" autocomplete="email" maxlength="80" placeholder="you@example.com"></label>
      <label>Delivery area *<select name="area" id="checkoutArea"><option value="inside">Inside Dhaka (${money(settings.deliveryInside)})</option><option value="outside">Outside Dhaka (${money(settings.deliveryOutside)})</option></select></label>
      <label>Full address *<textarea name="address" rows="3" autocomplete="street-address" required minlength="10" placeholder="House/Road, Thana, District"></textarea></label>
      <label>Order note <small>optional</small><input name="note" maxlength="200" placeholder="e.g. Please call before arriving"></label>
      <h2>2. Payment method</h2><fieldset><label><input type="radio" name="payMethod" value="cod" checked> 💵 Cash on delivery</label><label><input type="radio" name="payMethod" value="bkash"> bKash</label><label><input type="radio" name="payMethod" value="nagad"> Nagad</label></fieldset>
      <div id="pagePaymentInfo" hidden><p id="pagePaymentHelp"></p><label>Transaction ID *<input name="trxId" maxlength="30" placeholder="TrxID"></label></div>
      <input class="hp" name="website" tabindex="-1" autocomplete="off">
      <p id="pageOrderMessage" class="form-msg" role="alert"></p><button class="btn btn-block" id="pageOrderSubmit" type="submit">✅ Confirm order</button>
      <p class="co-note">🔒 Your information will be kept safe. We will call to confirm after you order.</p></form>
      <aside class="checkout-summary"><h2>3. Order summary</h2><div id="checkoutLines">${lines.map((line) => cartRow(line, true)).join("")}</div>
      <div class="coupon"><input id="pageCoupon" type="text" placeholder="Coupon code (if any)" aria-label="Coupon code"><button class="btn btn-small" id="pageCouponApply" type="button">Apply</button></div><p id="pageCouponMessage" class="coupon-msg" role="status"></p>
      <div class="page-summary-row"><span>Subtotal</span><b id="checkoutSubtotal">${money(subtotal())}</b></div><div class="page-summary-row"><span>Delivery</span><b id="checkoutDelivery">${money(delivery("inside"))}</b></div>
      <div id="checkoutDiscountRow" class="page-summary-row" hidden><span>Coupon discount</span><b id="checkoutDiscount"></b></div><div class="page-summary-row total"><span>Total</span><b id="checkoutTotal">${money(subtotal() + delivery("inside"))}</b></div></aside></div>`;
    const form = $("#pageOrderForm");
    const updateTotal = () => {
      const ship = delivery($("#checkoutArea").value);
      const cut = coupon ? coupon.discount : 0;
      $("#checkoutDelivery").textContent = ship ? money(ship) : "Free";
      $("#checkoutDiscountRow").hidden = !cut;
      $("#checkoutDiscount").textContent = "−" + money(cut);
      $("#checkoutTotal").textContent = money(Math.max(0, subtotal() + ship - cut));
      ["bkash", "nagad"].forEach((m) => { // offer bKash / Nagad only when a real number is saved in Admin > Settings
        const ok = /^01\d{9}$/.test(englishDigits(String(settings[m] || "")).replace(/\D/g, ""));
        const radio = form.querySelector(`input[name="payMethod"][value="${m}"]`);
        if (!radio) return;
        radio.closest("label").hidden = !ok;
        if (!ok && radio.checked) form.elements.payMethod.value = "cod";
      });
      const method = form.elements.payMethod.value;
      $("#pagePaymentInfo").hidden = method === "cod";
      $("#pagePaymentHelp").innerHTML = `${method === "bkash" ? "bKash" : "Nagad"}: <b>Send Money</b> to <b>${escapeHtml(settings[method] || "")}</b> — amount <b>${money(Math.max(0, subtotal() + ship - cut))}</b>, then enter the TrxID.`;
    };
    $("#checkoutArea").addEventListener("change", updateTotal);
    form.addEventListener("change", (event) => { if (event.target.name === "payMethod") updateTotal(); });
    $("#pageCouponApply").addEventListener("click", async () => {
      const code = $("#pageCoupon").value.trim();
      const message = $("#pageCouponMessage");
      if (!code) { message.textContent = "Enter a coupon code."; message.className = "coupon-msg err"; return; }
      if (!apiConnected) { message.textContent = "Connect Google Apps Script to verify coupons."; message.className = "coupon-msg err"; return; }
      const button = $("#pageCouponApply");
      button.disabled = true;
      try {
        const result = await postApi({ action: "coupon", code, subtotal: subtotal() });
        if (!result.ok) throw new Error(result.error || "This coupon could not be applied.");
        coupon = { code: result.code, discount: Number(result.discount) || 0 };
        message.textContent = `🎉 ${coupon.code} applied — ${money(coupon.discount)} off!`;
        message.className = "coupon-msg ok";
        updateTotal();
      } catch (error) {
        message.textContent = error.message || "Could not verify the coupon.";
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
      if (!cart.length) return fail("Your cart is empty. Add products first.");
      if (name.length < 3) return fail("Enter a valid name.");
      if (!/^01[3-9]\d{8}$/.test(phone)) return fail("Enter a valid 11-digit mobile number.");
      if (address.length < 10) return fail("Enter your full address.");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email or leave it empty.");
      if (payMethod !== "cod" && trxId.length < 6) return fail("Enter the payment transaction ID (TrxID).");
      if (!apiConnected) return fail("Set the Google Apps Script Web App URL in config.js to accept orders.");
      button.disabled = true;
      button.textContent = "Placing order...";
      try {
        const result = await postApi({
          action: "order", name, phone, address, email, area: data.get("area"),
          note: String(data.get("note") || "").trim(), payMethod, trxId,
          coupon: coupon ? coupon.code : "", items: cart.map((line) => ({ id: line.id, qty: line.qty }))
        });
        if (!result.ok) throw new Error(result.error || "Order was not completed.");
        cart = [];
        coupon = null;
        saveCart();
        root.innerHTML = `<div class="page-result"><h2>✅ Thank you, ${escapeHtml(name)}!</h2><p>Your order has been received.</p><p>Order ID: <b>${escapeHtml(result.orderId)}</b></p><p>Total: <b>${money(result.total)}</b></p><p>Save this ID to track your order.</p><a class="btn" href="track.html">Track your order</a> <a class="btn btn-outline" href="shop.html">Continue shopping</a></div>`;
      } catch (error) {
        fail(error.message && error.message !== "Failed to fetch" ? error.message : "Could not place the order. Check your internet connection and try again.");
      } finally {
        if (document.body.contains(button)) { button.disabled = false; button.textContent = "✅ Confirm order"; }
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
    if (!response.ok) throw new Error("Could not reach the server.");
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
      if (!id || !/^01[3-9]\d{8}$/.test(phone)) { resultNode.textContent = "Enter a valid order ID and 11-digit mobile number."; resultNode.classList.add("err"); return; }
      if (!apiConnected) { resultNode.textContent = "Set the Google Apps Script Web App URL in config.js to track orders."; resultNode.classList.add("err"); return; }
      button.disabled = true;
      button.textContent = "Searching...";
      try {
        const response = await fetch(`${apiUrl}?action=track&id=${encodeURIComponent(id)}&phone=${encodeURIComponent(phone)}`);
        if (!response.ok) throw new Error("Could not reach the server.");
        const data = await response.json();
        if (!data.ok) throw new Error(data.error || "No order found with these details.");
        const order = data.order;
        resultNode.className = "page-result";
        resultNode.innerHTML = `<h2>✅ Order found</h2><div class="page-track-info"><p>Order ID: <b>${escapeHtml(order.orderId)}</b></p><p>Status: <b>${escapeHtml(({ "নতুন": "Pending", "কনফার্মড": "Confirmed", "শিপড": "Shipped", "ডেলিভারড": "Delivered", "বাতিল": "Cancelled" })[order.status] || order.status)}</b></p><p>Items: ${escapeHtml(order.items)}</p><p>Total: <b>${money(order.total)}</b></p>${order.trackingCode ? `<p>🚚 ${escapeHtml(order.courier || "Courier")} tracking: <b>${escapeHtml(order.trackingCode)}</b>${order.courierStatus ? ` · ${escapeHtml(order.courierStatus)}` : ""}${/^https:\/\//.test(order.trackingUrl || "") ? ` · <a href="${escapeHtml(order.trackingUrl)}" target="_blank" rel="noopener" style="text-decoration:underline">Track delivery ↗</a>` : ""}</p>` : ""}</div>`;
      } catch (error) {
        resultNode.className = "page-result error";
        resultNode.textContent = error.message || "Could not load order information.";
      } finally {
        button.disabled = false;
        button.textContent = "🔍 Find order";
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
      if (next > product.stock) return notify(`Only ${product.stock.toLocaleString("en-US")} in stock.`);
      if (next <= 0) cart = cart.filter((item) => item !== line); else line.qty = next;
      saveCart();
      renderCartPage();
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      cart = cart.filter((line) => String(line.id) !== String(remove.dataset.remove));
      saveCart();
      renderCartPage();
      notify("🗑️ Removed from cart");
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
