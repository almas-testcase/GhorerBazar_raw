/* খাঁটিঘর — থিম (লাইট/ডার্ক)। <head> এ আগে লোড হয়, যাতে পেজ আঁকার আগেই সঠিক থিম বসে (ঝিলিক নেই)।
   অগ্রাধিকার: ক্রেতার নিজের বেছে নেওয়া → ডিভাইসের সেটিং (prefers-color-scheme) */
(function () {
  /* সাইটের ডিজাইন শুধু লাইট থিমের জন্য; ডার্ক মোডে রঙ ভেঙে যেত, তাই সবসময় লাইট রাখা হয় */
  try { localStorage.removeItem("theme"); } catch (e) { /* ব্লকড স্টোরেজ */ }
  document.documentElement.setAttribute("data-theme", "light");
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", "#F48721");
})();

/* হেডারের আসল উচ্চতা --hdr-h এ রাখে, যাতে ক্যাটাগরি নেভ ঠিক তার নিচে আটকে থাকে (সব পেজ ও স্ক্রিনে) */
(function () {
  var root = document.documentElement, tries = 0;
  function set(h) { root.style.setProperty("--hdr-h", Math.round(h.getBoundingClientRect().height) + "px"); }
  function bind() {
    var h = document.querySelector(".header");
    if (!h) { if (tries++ < 120) requestAnimationFrame(bind); return; }
    set(h);
    if (window.ResizeObserver) new ResizeObserver(function () { set(h); }).observe(h);
    window.addEventListener("resize", function () { set(h); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
