/* =====================================================================
   Category bar auto-slide (phones / tablets): the dark category bar glides right → left in a seamless loop.
   - Runs only when the items do not fit (≤ 1050px) and the user has not asked for reduced motion.
   - Pauses while the finger / mouse / keyboard focus is on the bar, and resumes a moment after.
   - Swiping by hand still works; the loop simply continues from where the finger left off.
   - Uses an aria-hidden copy of the items to make the loop endless (copy is not focusable).
   ===================================================================== */
(function () {
  "use strict";
  var MQ = window.matchMedia("(max-width: 1050px)");
  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)");
  var SPEED = 38;          // pixels per second (gentle, readable)
  var RESUME_MS = 2200;    // wait after the user lets go before gliding again
  var bar = null, copy = null, raf = 0, last = 0, pos = 0, pausedUntil = 0, touching = false, mo = null, rebuildTimer = 0;

  function items() { // the real (non-copy) children that should repeat
    var out = [];
    var offers = bar.querySelector(".cat-offers");
    if (offers) out.push(offers);
    var list = bar.querySelector(".cat-list");
    if (list) Array.prototype.forEach.call(list.children, function (c) { out.push(c); });
    return out;
  }

  function teardown() {
    cancelAnimationFrame(raf); raf = 0;
    if (copy && copy.parentNode) copy.parentNode.removeChild(copy);
    copy = null;
    if (bar) bar.classList.remove("is-gliding");
  }

  function build() {
    if (!bar) return;
    if (mo) mo.disconnect();
    teardown();
    if (MQ.matches && !REDUCE.matches) {
      var real = items();
      var avail = bar.clientWidth;
      // total width of the real items (offers link + list); only loop when they overflow
      var list = bar.querySelector(".cat-list");
      var w = (bar.querySelector(".cat-offers") ? bar.querySelector(".cat-offers").offsetWidth : 0) + (list ? list.scrollWidth : 0);
      if (real.length > 1 && w > avail + 8) {
        copy = document.createElement("div");
        copy.className = "cat-loop-copy";
        copy.setAttribute("aria-hidden", "true");
        copy.style.gap = getComputedStyle(bar).columnGap;           // same spacing as the real bar → seamless seam
        var offersEl = bar.querySelector(".cat-offers");
        if (offersEl) copy.appendChild(offersEl.cloneNode(true));
        if (list) copy.appendChild(list.cloneNode(true));
        copy.removeAttribute("id");
        Array.prototype.forEach.call(copy.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
        Array.prototype.forEach.call(copy.querySelectorAll("a, button"), function (n) { n.setAttribute("tabindex", "-1"); });
        if (copy.firstElementChild && copy.firstElementChild.matches("a, button")) copy.firstElementChild.setAttribute("tabindex", "-1");
        bar.appendChild(copy);
        bar.classList.add("is-gliding");
        pos = bar.scrollLeft; last = 0;
        raf = requestAnimationFrame(tick);
      }
    }
    watch();
  }

  function loopWidth() { return copy ? copy.offsetLeft - (parseFloat(getComputedStyle(bar).paddingLeft) || 0) : 0; }

  function tick(ts) {
    raf = requestAnimationFrame(tick);
    if (!last) { last = ts; return; }
    var dt = Math.min(64, ts - last); last = ts;
    if (touching || ts < pausedUntil || document.hidden) { pos = bar.scrollLeft; return; }
    // if the user scrolled by hand, continue from there
    if (Math.abs(bar.scrollLeft - pos) > 1.5) pos = bar.scrollLeft;
    pos += SPEED * dt / 1000;
    var wrap = loopWidth();
    if (wrap > 0 && pos >= wrap) pos -= wrap; // jump back by exactly one loop: visually seamless
    bar.scrollLeft = pos;
  }

  function pause(ms) { pausedUntil = performance.now() + ms; }

  function watch() {
    if (!bar) return;
    if (!mo) mo = new MutationObserver(schedule);
    mo.observe(bar, { childList: true, subtree: true, characterData: true });
  }
  function schedule() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(build, 180); }

  function attach(el) {
    bar = el;
    var stop = function () { touching = true; };
    var go = function () { touching = false; pause(RESUME_MS); };
    bar.addEventListener("touchstart", stop, { passive: true });
    bar.addEventListener("touchend", go, { passive: true });
    bar.addEventListener("touchcancel", go, { passive: true });
    bar.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") stop(); }, { passive: true });
    window.addEventListener("pointerup", function () { if (touching) go(); }, { passive: true });
    // mouse hover pauses (touch screens fire no real hover, so they are not affected)
    bar.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pause(1e9); });
    bar.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") pause(RESUME_MS); });
    bar.addEventListener("focusin", function () { pause(1e9); });
    bar.addEventListener("focusout", function () { pause(RESUME_MS); });
    bar.addEventListener("wheel", function () { pause(RESUME_MS); }, { passive: true });
    window.addEventListener("resize", schedule);
    (MQ.addEventListener ? MQ.addEventListener("change", build) : MQ.addListener(build));
    (REDUCE.addEventListener ? REDUCE.addEventListener("change", build) : REDUCE.addListener(build));
    build();
  }

  // The bar is created by JavaScript on most pages, so wait until it exists (and has its categories)
  function find() {
    var el = document.querySelector(".catbar-inner");
    if (el) { attach(el); return true; }
    return false;
  }
  if (!find()) {
    var wait = new MutationObserver(function () { if (find()) wait.disconnect(); });
    wait.observe(document.documentElement, { childList: true, subtree: true });
  }
})();

/* =====================================================================
   Phone menu: the "Menu" button (top right) opens a slide-in panel with All Products, Best Offers, every category
   and quick links. On wide screens the small dropdown is used instead. Works on every page (reads the category bar).
   ===================================================================== */
(function () {
  "use strict";
  var MQ = window.matchMedia("(max-width: 800px)");
  var sheet = null, backdrop = null, lastFocus = null, isOpen = false;
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  function categoryNames() {
    var out = [], list = document.querySelector(".catbar .cat-list");
    if (!list) return out;
    Array.prototype.forEach.call(list.children, function (el) {
      var n = el.getAttribute("data-cat");
      if (n == null) { var href = el.getAttribute("href") || "", m = href.match(/[?&]cat=([^&]+)/); n = m ? decodeURIComponent(m[1]) : ""; }
      if (n && n !== "All" && out.indexOf(n) < 0) out.push(n);
    });
    return out;
  }
  function currentCat() { try { return new URLSearchParams(location.search).get("cat") || ""; } catch (e) { return ""; } }

  function build() {
    var cats = categoryNames(), cur = currentCat(), dark = document.documentElement.dataset.theme === "dark";
    sheet.innerHTML =
      '<div class="mm-head"><span class="mm-title">Menu</span><button type="button" class="mm-close" aria-label="Close menu">✕</button></div>' +
      '<div class="mm-body">' +
        '<a class="mm-all" href="shop.html"><span><i class="fa-solid fa-store" aria-hidden="true"></i> All Products</span><b aria-hidden="true">→</b></a>' +
        '<a class="mm-offer" href="shop.html?offer=1"><span><i class="fa-solid fa-fire" aria-hidden="true"></i> Best Offers</span><b aria-hidden="true">→</b></a>' +
        (cats.length ? '<h3 class="mm-h">Shop by category</h3><div class="mm-cats">' + cats.map(function (c) {
          return '<a class="mm-cat' + (c === cur ? " is-on" : "") + '" href="shop.html?cat=' + encodeURIComponent(c) + '"><span>' + esc(c) + '</span><i aria-hidden="true">›</i></a>';
        }).join("") + "</div>" : "") +
        '<h3 class="mm-h">Quick links</h3><div class="mm-links">' +
          '<a href="track.html"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> Track Order</a>' +
          '<a href="cart.html"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Your Cart</a>' +
          '<a href="index.html#faq"><i class="fa-solid fa-circle-question" aria-hidden="true"></i> FAQ</a>' +
          '<a href="terms.html"><i class="fa-solid fa-file-lines" aria-hidden="true"></i> Returns &amp; Terms</a>' +
          '<button type="button" class="mm-theme"><i class="fa-solid ' + (dark ? "fa-sun" : "fa-moon") + '" aria-hidden="true"></i> ' + (dark ? "Light theme" : "Dark theme") + "</button>" +
        "</div>" +
      "</div>";
  }

  function ensure() {
    if (sheet) return;
    backdrop = document.createElement("div"); backdrop.className = "mm-backdrop"; backdrop.hidden = true;
    sheet = document.createElement("aside"); sheet.className = "mm-sheet"; sheet.hidden = true;
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Menu");
    document.body.appendChild(backdrop); document.body.appendChild(sheet);
    backdrop.addEventListener("click", close);
    sheet.addEventListener("click", function (e) {
      if (e.target.closest(".mm-close")) { close(); return; }
      if (e.target.closest(".mm-theme")) {
        var b = document.getElementById("themeBtn") || document.getElementById("pageTheme"); if (b) b.click();
        build(); var c = sheet.querySelector(".mm-theme"); if (c) c.focus(); return;
      }
      var a = e.target.closest("a[href]");
      if (a && a.getAttribute("href").indexOf("index.html#") === 0 && /(index\.html|\/)$/.test(location.pathname)) close(); // same page: just scroll
    });
    sheet.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = sheet.querySelectorAll("a[href], button"), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function open(toggle) {
    ensure(); build();
    lastFocus = toggle || document.activeElement;
    backdrop.hidden = false; sheet.hidden = false;
    document.documentElement.classList.add("mm-lock");
    requestAnimationFrame(function () { backdrop.classList.add("on"); sheet.classList.add("on"); });
    isOpen = true;
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    var c = sheet.querySelector(".mm-close"); if (c) c.focus();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    backdrop.classList.remove("on"); sheet.classList.remove("on");
    document.documentElement.classList.remove("mm-lock");
    document.querySelectorAll("#moreToggle, #pageMoreToggle").forEach(function (t) { t.setAttribute("aria-expanded", "false"); });
    setTimeout(function () { if (!isOpen) { backdrop.hidden = true; sheet.hidden = true; } }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // capture phase: on phones the Menu button opens this panel instead of the small dropdown
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("#moreToggle, #pageMoreToggle");
    if (!t || !MQ.matches) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (isOpen) close(); else open(t);
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) close(); });
  var onChange = function () { if (!MQ.matches && isOpen) close(); };
  if (MQ.addEventListener) MQ.addEventListener("change", onChange); else MQ.addListener(onChange);
})();

/* =====================================================================
   Desktop "Menu" dropdown: click to toggle, outside click / Escape to close.
   Phones use the slide-in panel above.
   ===================================================================== */
(function () {
  "use strict";
  var WIDE = window.matchMedia("(min-width: 801px)");
  function parts(wrap) {
    var toggle = wrap.querySelector(".h-more-toggle"), menu = wrap.querySelector(".h-more-menu");
    return toggle && menu ? { toggle: toggle, menu: menu } : null;
  }
  function setOpen(wrap, open) {
    var p = parts(wrap); if (!p) return;
    p.menu.hidden = !open;
    p.toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function closeAll() {
    document.querySelectorAll(".h-more-wrap").forEach(function (wrap) { setOpen(wrap, false); });
  }

  document.addEventListener("click", function (e) {
    if (!WIDE.matches) return;
    var toggle = e.target.closest && e.target.closest(".h-more-toggle");
    if (toggle) {
      e.preventDefault(); e.stopImmediatePropagation();
      var wrap = toggle.closest(".h-more-wrap"), p = parts(wrap);
      var open = p && p.toggle.getAttribute("aria-expanded") !== "true";
      closeAll();
      if (open) setOpen(wrap, true);
      return;
    }
    if (!e.target.closest(".h-more-wrap")) closeAll();
  }, true);

  document.addEventListener("keydown", function (e) {
    if (!WIDE.matches) return;
    if (e.key === "Escape") {
      var open = document.querySelector('.h-more-toggle[aria-expanded="true"]');
      if (open) { e.preventDefault(); e.stopImmediatePropagation(); closeAll(); open.focus(); }
      return;
    }
    if (e.key === "ArrowDown" && e.target.matches(".h-more-toggle")) {
      e.preventDefault();
      var wrap = e.target.closest(".h-more-wrap");
      setOpen(wrap, true);
      var first = wrap.querySelector(".h-more-menu a, .h-more-menu button");
      if (first) first.focus();
    }
  }, true);
})();
