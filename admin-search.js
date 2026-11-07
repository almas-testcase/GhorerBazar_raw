/* =====================================================================
   Admin smart search engine (shared by the global search bar and the Orders / Products / Customers search boxes)
   - Every typed word must match, in any order ("rahim 0171" finds Rahim with that number)
   - Ranks results: exact word > word start > contains; earlier fields (name, ID) count more than later ones
   - Typo tolerant for words of 4+ letters; Bangla and English digits both work; phone numbers match with or without +88 / spaces
   - AdminSearch.match(items, query, fieldsFn) -> [{ item, score }] best first (stable: equal scores keep list order)
   - AdminSearch.hl(text, query) -> safe HTML with the matched words highlighted
   ===================================================================== */
(function () {
  "use strict";
  var SL = window.SearchLang || { alts: function () { return []; }, skel: function () { return ""; }, isBn: function () { return false; } };
  var BN = "০১২৩৪৫৬৭৮৯";
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[০-৯]/g, function (d) { return BN.indexOf(d); })
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function editDistance(a, b, max) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i; var rowMin = i;
      for (j = 1; j <= lb; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      var t = prev; prev = cur; cur = t;
    }
    return prev[lb];
  }
  var maxTypos = function (len) { return len <= 3 ? 0 : len <= 6 ? 1 : 2; };

  /* normalized copy of each item's fields, remembered per item object (a reload gives new objects, so it is always fresh) */
  var cache = new WeakMap();
  function prepared(item, fieldsFn) {
    var c = cache.get(item);
    if (c && c.fn === fieldsFn) return c.f;
    var f = fieldsFn(item).map(function (v) {
      var text = norm(v), digits = String(v == null ? "" : v).replace(/\D/g, "");
      var words = text ? text.split(" ") : [];
      return { text: text, words: words, digits: digits.length >= 6 ? digits : "", sk: words.length > 14 ? [] : words.filter(function (w) { return w.length >= 3 && !/^[0-9]+$/.test(w); }).map(SL.skel) };
    });
    cache.set(item, { fn: fieldsFn, f: f });
    return f;
  }

  function tokenScore(tok, fields) {
    var t = tok.t, best = baseScore(t, fields), i, k, f, w, s;
    for (i = 0; i < tok.alts.length && best < 80; i++) { // same meaning in another language ("oil" = তেল)
      var a = tok.alts[i];
      s = baseScore(a, fields, a.length < (SL.isBn(a) ? 2 : 4)) * 0.92;
      if (s > best) best = s;
    }
    if (best < 55 && tok.k.length >= 2 && t.length >= 3 && !/[0-9]/.test(t)) { // sounds alike (Banglish <-> Bangla)
      for (i = 0; i < fields.length; i++) {
        for (k = 0; k < fields[i].sk.length; k++) {
          var sk = fields[i].sk[k];
          s = sk === tok.k ? 38 : (t.length >= 4 && tok.k.length >= 3 && sk.indexOf(tok.k) === 0) ? 28 : 0;
          if (s > best) best = s;
        }
      }
    }
    if (!best && t.length >= 4 && !/[0-9]/.test(t)) {
      var max = maxTypos(t.length);
      for (i = 0; i < fields.length && !best; i++) {
        f = fields[i];
        if (f.words.length > 12) continue; // long free text: skip typo matching (slow and noisy)
        for (k = 0; k < f.words.length; k++) {
          w = f.words[k];
          var d = Math.min(editDistance(t, w, max), editDistance(t, w.slice(0, t.length), max));
          if (d <= max) best = Math.max(best, 32 - d * 6);
        }
      }
    }
    return best;
  }

  function baseScore(t, fields, exactOnly) {
    var best = 0, i, k, f, w, tDigits = /^\d+$/.test(t);
    for (i = 0; i < fields.length; i++) {
      f = fields[i];
      var weight = i === 0 ? 1 : i === 1 ? .9 : .75, s = 0;
      for (k = 0; k < f.words.length; k++) {
        w = f.words[k];
        if (w === t) { s = 100; break; }
        if (!exactOnly && w.indexOf(t) === 0) s = Math.max(s, 80);
      }
      if (exactOnly) { best = Math.max(best, s * weight); continue; }
      if (s < 80 && f.text.indexOf(t) >= 0) s = Math.max(s, 52);
      if (s < 52 && tDigits && f.digits && t.length >= 3 && f.digits.indexOf(t) >= 0) s = Math.max(s, 60); // phone typed without +88 / spaces
      best = Math.max(best, s * weight);
    }
    return best;
  }

  function match(items, query, fieldsFn) {
    var q = norm(query);
    if (!q) return items.map(function (item) { return { item: item, score: 0 }; });
    var tokens = q.split(" ").filter(Boolean).map(function (t) { return { t: t, alts: SL.alts(t), k: SL.skel(t) }; }), out = [];
    for (var n = 0; n < items.length; n++) {
      var item = items[n], fields = prepared(item, fieldsFn), total = 0, ok = true;
      for (var i = 0; i < tokens.length; i++) {
        var s = tokenScore(tokens[i], fields);
        if (!s) { ok = false; break; }
        total += s;
      }
      if (!ok) continue;
      if (fields[0] && fields[0].text === q) total += 60;
      else if (fields[0] && fields[0].text.indexOf(q) === 0) total += 30;
      out.push({ item: item, score: total, i: n });
    }
    out.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    return out;
  }

  function hl(text, query) {
    text = String(text == null ? "" : text);
    var words = String(query || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return esc(text);
    words.slice().forEach(function (w) { SL.alts(norm(w)).forEach(function (a) { if (a.length >= 2 && words.indexOf(a) < 0) words.push(a); }); });
    var re = new RegExp("(" + words.map(reEsc).sort(function (a, b) { return b.length - a.length; }).join("|") + ")", "gi");
    return text.split(re).map(function (p, i) { return i % 2 ? "<mark>" + esc(p) + "</mark>" : esc(p); }).join("");
  }

  /* small helper: run fn after the user pauses typing; Esc clears the box */
  function onType(input, fn, wait) {
    var timer = 0;
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(fn, wait == null ? 90 : wait); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value) { input.value = ""; clearTimeout(timer); fn(); }
    });
  }

  window.AdminSearch = { match: match, hl: hl, norm: norm, onType: onType };
})();
