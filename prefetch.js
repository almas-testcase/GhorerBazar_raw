/* =====================================================================
   Speed: start loading the shop data (products, categories, settings, slides) as early as possible and
   remember the last answer in the browser, so repeat visits paint instantly from the saved copy and then refresh.
   Loaded in <head> right after config.js. Exposes window.ShopData used by script.js (home) and pages.js (other pages).
   ===================================================================== */
(function () {
  "use strict";
  var API = (typeof SITE_API_URL !== "undefined" && String(SITE_API_URL).indexOf("WEB_APP_URL") < 0) ? SITE_API_URL : "";
  var KEY = "khatighor:shop:v1", MAX_AGE = 6 * 60 * 60 * 1000; // a saved copy older than 6 hours is ignored
  var pending = null;

  function request() {
    return fetch(API + "?action=products").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  var ShopData = {
    api: API,
    // last good answer (or null)
    cached: function () {
      try {
        var o = JSON.parse(localStorage.getItem(KEY));
        if (o && o.d && o.d.ok && Date.now() - o.t < MAX_AGE) return o.d;
      } catch (e) { /* storage blocked or corrupt */ }
      return null;
    },
    save: function (d) {
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { /* quota / private mode */ }
    },
    // the request that was started in <head> (used once), or a fresh one
    load: function () {
      var p = pending || request();
      pending = null;
      return p;
    }
  };
  if (API && window.fetch) { pending = request(); pending.catch(function () {}); } // start now; errors are handled by whoever awaits it
  window.ShopData = ShopData;
})();
