/* =====================================================================
   Smart search: instant, typo-tolerant product search with a live suggestion panel.
   - Ranks results (exact word > word start > contains > category > unit/description > typo match)
   - Every typed word must match (so "mustard oil 1" narrows down), Bangla + English digits work
   - Shows image, name (matched text highlighted), unit, price, discount and stock; matching categories;
     recent searches and category shortcuts when the box is empty; "did you mean" when nothing matches
   - Keyboard: ↑ ↓ to move, Enter to open, Esc to close. Screen-reader friendly (combobox / listbox).
   Used by script.js (home page) and pages.js (all other pages); also exposes SearchSuggest.search() to rank
   product lists on the home grid and the shop page.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- text helpers ---------- */
  var SL = window.SearchLang || { parse: function (q) { return { text: q, max: null, min: null, offer: false }; }, alts: function () { return []; }, skel: function () { return ""; }, isBn: function () { return false; } };
  var BN_DIGITS = "০১২৩৪৫৬৭৮৯";
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[০-৯]/g, function (d) { return BN_DIGITS.indexOf(d); })
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function money(v) { return "৳" + Number(v || 0).toLocaleString("en-US"); }

  /* edit distance, stops early once it is above `max` */
  function editDistance(a, b, max) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i; var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      var t = prev; prev = cur; cur = t;
    }
    return prev[lb];
  }
  function maxTypos(len) { return len <= 3 ? 0 : len <= 6 ? 1 : 2; }

  /* ---------- index (rebuilt only when the product list changes) ---------- */
  var indexCache = { list: null, size: -1, rows: [] };
  function buildIndex(products) {
    if (indexCache.list === products && indexCache.size === products.length) return indexCache.rows;
    var rows = products.map(function (p) {
      var name = norm(p.name), cat = norm(p.category);
      return {
        p: p, name: name, cat: cat,
        nameWords: name.split(" ").filter(Boolean), catWords: cat.split(" ").filter(Boolean),
        meta: norm((p.unit || "") + " " + (p.tag || "")),
        desc: norm(p.desc || p.description || ""),
        sk: name.split(" ").concat(cat.split(" ")).filter(function (w) { return w.length >= 3 && !/^[0-9]+$/.test(w); }).map(SL.skel)
      };
    });
    indexCache = { list: products, size: products.length, rows: rows };
    return rows;
  }

  /* score of ONE spelling of a query word against one product (0 = no match) */
  function baseScore(t, r, exactOnly) {
    var best = 0, i, w;
    for (i = 0; i < r.nameWords.length; i++) {
      w = r.nameWords[i];
      if (w === t) { best = 100; break; }
      if (!exactOnly && w.indexOf(t) === 0) best = Math.max(best, 80);
    }
    if (exactOnly) {
      if (!best) for (i = 0; i < r.catWords.length; i++) if (r.catWords[i] === t) { best = 60; break; }
      return best;
    }
    if (best < 80 && r.name.indexOf(t) >= 0) best = Math.max(best, 55);
    if (best < 55) {
      for (i = 0; i < r.catWords.length; i++) {
        w = r.catWords[i];
        if (w === t) { best = Math.max(best, 60); break; }
        if (w.indexOf(t) === 0) best = Math.max(best, 45);
      }
    }
    if (best < 45 && r.meta.indexOf(t) >= 0) best = Math.max(best, 30);
    if (best < 30 && t.length >= 3 && r.desc.indexOf(t) >= 0) best = Math.max(best, 14);
    return best;
  }

  /* one query word: its own spelling, then same-meaning words (English/Bangla/Banglish), then similar sound, then typos */
  function scoreToken(tok, r) {
    var best = baseScore(tok.t, r), i, s;
    if (best < 80) {
      for (i = 0; i < tok.alts.length; i++) {
        var a = tok.alts[i];
        s = baseScore(a, r, a.length < (SL.isBn(a) ? 2 : 4)) * 0.92;
        if (s > best) best = s;
      }
    }
    if (best < 55 && tok.k && tok.k.length >= 2 && tok.t.length >= 3 && !/[0-9]/.test(tok.t)) { // sounds alike (Banglish <-> Bangla)
      for (i = 0; i < r.sk.length; i++) {
        var k = r.sk[i];
        if (k.length < 2) continue;
        if (k === tok.k) s = 40;
        else if (tok.t.length >= 4 && tok.k.length >= 3 && k.indexOf(tok.k) === 0) s = 30;
        else if (tok.k.length >= 4 && k.length >= 4 && editDistance(k, tok.k, 1) <= 1) s = 24;
        else continue;
        if (s > best) best = s;
      }
    }
    if (!best && tok.t.length >= 4 && !/[0-9]/.test(tok.t)) { // typo tolerance (e.g. "mustrad oil", "hony")
      var max = maxTypos(tok.t.length), words = r.nameWords.concat(r.catWords);
      for (i = 0; i < words.length; i++) {
        var w = words[i], d = Math.min(editDistance(tok.t, w, max), editDistance(tok.t, w.slice(0, tok.t.length), max));
        if (d <= max) best = Math.max(best, 34 - d * 6);
      }
    }
    return best;
  }

  /* Returns [{p, score}] best first. Every word has to match (in any language). Also understands
     "under 500", "above 300" and "offer" typed inside the query. `result.meta` tells the UI what was understood. */
  function search(products, query) {
    var pq = SL.parse(query), q = norm(pq.text), out = [];
    out.meta = { max: pq.max, min: pq.min, offer: pq.offer, alts: [] };
    var filtered = pq.max != null || pq.min != null || pq.offer;
    if (!products || !products.length || (!q && !filtered)) return out;
    var tokens = q ? q.split(" ").filter(Boolean).map(function (t) { return { t: t, alts: SL.alts(t), k: SL.skel(t) }; }) : [];
    tokens.forEach(function (tk) { tk.alts.slice(0, 4).forEach(function (a) { if (out.meta.alts.indexOf(a) < 0) out.meta.alts.push(a); }); });
    var rows = buildIndex(products);
    rows.forEach(function (r) {
      var p = r.p, price = Number(p.price) || 0;
      if (pq.max != null && price > pq.max) return;
      if (pq.min != null && price < pq.min) return;
      if (pq.offer && !(p.oldPrice > p.price)) return;
      var total = 0;
      for (var i = 0; i < tokens.length; i++) {
        var s = scoreToken(tokens[i], r);
        if (!s) return;
        total += s;
      }
      if (q) {
        if (r.name.indexOf(q) === 0) total += 40; else if (r.name.indexOf(q) > 0) total += 20;
        if (r.name === q) total += 60;
      } else total += p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0; // filter-only search: bigger discount first
      if (Number(p.stock) <= 0) total -= 25; // out of stock sinks, but is still found
      total += Math.min(8, (Number(p.rating) || 0) * 1.5) + Math.min(4, (Number(p.reviews) || 0) / 10);
      out.push({ p: p, score: total });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  /* best "did you mean" word for a query that found nothing */
  function didYouMean(products, query) {
    var tokens = norm(query).split(" ").filter(function (x) { return x.length >= 3; });
    if (!tokens.length) return "";
    var pool = {};
    products.forEach(function (p) {
      (norm(p.name) + " " + norm(p.category)).split(" ").forEach(function (w) { if (w.length >= 3) pool[w] = 1; });
    });
    var words = Object.keys(pool), fixed = [], changed = false;
    tokens.forEach(function (t) {
      var best = t, bd = 99;
      words.forEach(function (w) {
        var d = Math.min(editDistance(t, w, 2), editDistance(t, w.slice(0, t.length), 2));
        if (d < bd) { bd = d; best = w; }
      });
      if (bd > 0 && bd <= 2) { fixed.push(best); changed = true; } else fixed.push(t);
    });
    return changed ? fixed.join(" ") : "";
  }

  /* ---------- recent searches ---------- */
  var RKEY = "khatighor:recent:v1";
  function getRecent() {
    try { var a = JSON.parse(localStorage.getItem(RKEY)); return Array.isArray(a) ? a.filter(function (x) { return typeof x === "string" && x; }).slice(0, 6) : []; } catch (e) { return []; }
  }
  function setRecent(list) { try { localStorage.setItem(RKEY, JSON.stringify(list.slice(0, 6))); } catch (e) { /* storage blocked */ } }
  function addRecent(q) {
    q = String(q || "").trim().slice(0, 60);
    if (q.length < 2) return;
    var l = getRecent().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
    l.unshift(q); setRecent(l);
  }

  /* ---------- highlight matched words (safe: text is escaped piece by piece) ---------- */
  function highlight(text, query) {
    var words = String(SL.parse(query).text || "").trim().split(/\s+/).filter(function (w) { return w.length > 0; });
    words.slice().forEach(function (w) { SL.alts(norm(w)).forEach(function (a) { if (a.length >= 2 && words.indexOf(a) < 0) words.push(a); }); });
    text = String(text == null ? "" : text);
    if (!words.length) return esc(text);
    var re = new RegExp("(" + words.map(reEsc).sort(function (a, b) { return b.length - a.length; }).join("|") + ")", "gi");
    return text.split(re).map(function (part, i) { return i % 2 ? "<mark>" + esc(part) + "</mark>" : esc(part); }).join("");
  }

  /* ---------- the suggestion panel ---------- */
  var uid = 0;

  function attach(opts) {
    var form = opts.form, input = opts.input;
    if (!form || !input || form.__ss) return;
    form.__ss = true;
    var id = "ss" + (++uid), listId = id + "-list", open = false, active = -1, retry = 0, timer = 0;

    var panel = document.createElement("div");
    panel.className = "ss-panel"; panel.id = listId; panel.setAttribute("role", "listbox");
    panel.setAttribute("aria-label", "Search suggestions"); panel.hidden = true;
    form.appendChild(panel);
    form.classList.add("ss-form");

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    if (!input.getAttribute("aria-keyshortcuts")) input.setAttribute("aria-keyshortcuts", "/");
    input.setAttribute("enterkeyhint", "search");
    input.setAttribute("inputmode", "search");

    function products() { try { return (opts.getProducts() || []).filter(function (p) { return p && p.name; }); } catch (e) { return []; } }
    function options() { return Array.prototype.slice.call(panel.querySelectorAll(".ss-opt")); }

    function setOpen(v) {
      open = v; panel.hidden = !v;
      input.setAttribute("aria-expanded", v ? "true" : "false");
      form.classList.toggle("ss-open", v);
      if (!v) { active = -1; input.removeAttribute("aria-activedescendant"); clearTimeout(timer); }
    }
    function setActive(i) {
      var o = options();
      if (!o.length) { active = -1; return; }
      active = (i + o.length) % o.length;
      o.forEach(function (el, n) { el.classList.toggle("is-active", n === active); el.setAttribute("aria-selected", n === active ? "true" : "false"); });
      var el = o[active];
      input.setAttribute("aria-activedescendant", el.id);
      el.scrollIntoView({ block: "nearest" });
    }

    var catLink = function (c) { return "shop.html?cat=" + encodeURIComponent(c); };
    function categoryChips(list) {
      return list.map(function (c) { return '<a class="ss-chip ss-opt" role="option" id="' + oid() + '" href="' + catLink(c) + '">' + esc(c) + "</a>"; }).join("");
    }
    function categories(all) {
      var seen = {}, list = [];
      var fromOpts = typeof opts.getCategories === "function" ? opts.getCategories() : null;
      (fromOpts || all.map(function (p) { return p.category; })).forEach(function (c) { if (c && !seen[c]) { seen[c] = 1; list.push(c); } });
      return list;
    }
    var n = 0;
    function oid() { return id + "-o" + (n++); }

    function productRow(p, q) {
      var out = Number(p.stock) <= 0, off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
      var thumb = '<span class="ss-thumb" aria-hidden="true"><span class="ss-emoji">' + esc(p.emoji || "🛍️") + "</span>" +
        (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "") + "</span>";
      var meta = [p.unit, p.category].filter(Boolean).map(esc).join(" · ");
      return '<a class="ss-opt ss-item' + (out ? " is-out" : "") + '" role="option" id="' + oid() + '" href="product.html?id=' + encodeURIComponent(p.id) + '" data-q="' + esc(q) + '">' + thumb +
        '<span class="ss-info"><span class="ss-name">' + highlight(p.name, q) + '</span><span class="ss-meta">' + meta + "</span></span>" +
        '<span class="ss-price">' + (out ? '<b class="ss-out">Out of stock</b>' : "<b>" + money(p.price) + "</b>" + (off ? "<s>" + money(p.oldPrice) + '</s><em>−' + off + "%</em>" : "")) + "</span></a>";
    }

    function render() {
      n = 0;
      var q = input.value.trim(), all = products(), html = "";
      if (!q) {
        var recent = getRecent(), cats = categories(all).slice(0, 8);
        if (recent.length) {
          html += '<div class="ss-head"><span>Recent searches</span><button type="button" class="ss-clear" data-clear>Clear</button></div><div class="ss-recent">' +
            recent.map(function (r) { return '<span class="ss-r"><button type="button" class="ss-opt ss-rbtn" role="option" id="' + oid() + '" data-q="' + esc(r) + '"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>' + esc(r) + '</button><button type="button" class="ss-del" data-del="' + esc(r) + '" aria-label="Remove ' + esc(r) + '" tabindex="-1">✕</button></span>'; }).join("") + "</div>";
        }
        if (cats.length) html += '<div class="ss-head"><span>Browse categories</span></div><div class="ss-chips">' + cats.map(function (c) { return '<a class="ss-chip ss-opt" role="option" id="' + oid() + '" href="' + catLink(c) + '">' + esc(c) + "</a>"; }).join("") + "</div>";
        if (!html) html = '<div class="ss-empty">Type to search oil, honey, spices, nuts…</div>';
        panel.innerHTML = html; setActive(-1); return;
      }
      if (!all.length) { // products are still loading
        panel.innerHTML = '<div class="ss-loading" aria-live="polite"><span></span><span></span><span></span></div>';
        if (retry++ < 12) { clearTimeout(timer); timer = setTimeout(function () { if (open) render(); }, 400); }
        return;
      }
      retry = 0;
      var hits = search(all, q), nq = norm(SL.parse(q).text), m = hits.meta || {};
      var chips = [];
      if (m.max != null) chips.push("Under ৳" + m.max);
      if (m.min != null) chips.push("Above ৳" + m.min);
      if (m.offer) chips.push("On offer");
      var note = (chips.length || (m.alts && m.alts.length && hits.length))
        ? '<div class="ss-note">' + (chips.length ? chips.map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("") : "") +
          (m.alts && m.alts.length ? '<small>Also matching: ' + m.alts.slice(0, 3).map(esc).join(" · ") + "</small>" : "") + "</div>" : "";
      var catHits = categories(all).filter(function (c) { var nc = norm(c); return nc.indexOf(nq) >= 0 || (nq.length >= 3 && nc.indexOf(nq.split(" ")[0]) === 0 && nq.split(" ").length === 1); }).slice(0, 3);
      if (catHits.length) html += '<div class="ss-head"><span>Categories</span></div><div class="ss-chips">' + catHits.map(function (c) { return '<a class="ss-chip ss-opt" role="option" id="' + oid() + '" href="' + catLink(c) + '">' + highlight(c, q) + "</a>"; }).join("") + "</div>";
      if (hits.length) {
        html += note + '<div class="ss-head"><span>Products</span><small>' + hits.length + " found</small></div>" + hits.slice(0, 6).map(function (h) { return productRow(h.p, q); }).join("");
        html += '<a class="ss-opt ss-all" role="option" id="' + oid() + '" href="shop.html?q=' + encodeURIComponent(q) + '" data-q="' + esc(q) + '">See all ' + hits.length + " result" + (hits.length > 1 ? "s" : "") + ' for “' + esc(q) + '” <span aria-hidden="true">→</span></a>';
      } else if (!catHits.length) {
        var dym = didYouMean(all, q);
        html += '<div class="ss-none"><b>No products found for “' + esc(q) + "”</b><span>Check the spelling or try a shorter word.</span>" +
          (dym ? '<button type="button" class="ss-dym ss-opt" role="option" id="' + oid() + '" data-q="' + esc(dym) + '">Did you mean <u>' + esc(dym) + "</u>?</button>" : "") + "</div>" +
          '<div class="ss-head"><span>Browse categories</span></div><div class="ss-chips">' + categoryChips(categories(all).slice(0, 8)) + "</div>";
      }
      panel.innerHTML = html; setActive(-1);
    }
    function show() { setOpen(true); render(); }

    input.addEventListener("focus", show);
    input.addEventListener("click", function () { if (!open) show(); });
    input.addEventListener("input", function () { if (!open) setOpen(true); render(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!open) { show(); return; }
        setActive(active < 0 ? (e.key === "ArrowDown" ? 0 : -1) : active + (e.key === "ArrowDown" ? 1 : -1));
      } else if (e.key === "Enter") {
        var o = options();
        if (open && active >= 0 && o[active]) { e.preventDefault(); o[active].click(); }
      } else if (e.key === "Escape") {
        if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
      } else if (e.key === "Tab") setOpen(false);
    });
    form.addEventListener("submit", function () { addRecent(input.value); setOpen(false); });

    panel.addEventListener("mousedown", function (e) { if (!e.target.closest("a")) e.preventDefault(); }); // keep the input focused
    panel.addEventListener("mousemove", function (e) {
      var el = e.target.closest(".ss-opt"); if (!el) return;
      var i = options().indexOf(el); if (i >= 0 && i !== active) setActive(i);
    });
    panel.addEventListener("click", function (e) {
      var del = e.target.closest("[data-del]");
      if (del) { e.preventDefault(); setRecent(getRecent().filter(function (x) { return x !== del.getAttribute("data-del"); })); render(); return; }
      if (e.target.closest("[data-clear]")) { setRecent([]); render(); return; }
      var pick = e.target.closest("button[data-q]");
      if (pick) { input.value = pick.getAttribute("data-q"); input.dispatchEvent(new Event("input", { bubbles: true })); input.focus(); return; }
      var link = e.target.closest("a[data-q]");
      if (link) addRecent(link.getAttribute("data-q"));
    });
    document.addEventListener("pointerdown", function (e) { if (open && !form.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", function (e) { // "/" jumps to the search box (when not typing somewhere else)
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "") && !(document.activeElement && document.activeElement.isContentEditable)) {
        e.preventDefault(); input.focus(); input.select();
      }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) setOpen(false); });
  }

  window.SearchSuggest = { attach: attach, search: search, norm: norm, didYouMean: didYouMean };
})();
