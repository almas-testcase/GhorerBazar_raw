# 🌿 খাঁটিঘর — ই-কমার্স সাইট

**HTML + CSS + JavaScript** দিয়ে বানানো একটি পূর্ণাঙ্গ অনলাইন দোকান। হোস্টিং **GitHub Pages**, ব্যাকএন্ড **Google Apps Script**, ডাটাবেজ **Google Sheet** — সার্ভার খরচ ০।

**ক্রেতার দিকে:** আলাদা হোম, পণ্য তালিকা, পণ্যের বিস্তারিত, কার্ট, চেকআউট ও অর্ডার ট্র্যাকিং পেজ; সার্চ, ক্যাটাগরি, কার্ট, কুপন, COD/বিকাশ/নগদ, মোবাইল-ফার্স্ট ডিজাইন, 🌙 ডার্ক মোড, PWA।
**অ্যাডমিনের দিকে:** ড্যাশবোর্ড চার্ট, অর্ডার/পণ্য/কুপন/স্লাইডার/রিভিউ ম্যানেজমেন্ট, ইমেইল ও SMS নোটিফিকেশন, Meta Pixel — সব `admin.html` থেকে।

## 🚀 দ্রুত শুরু
1. `config.js` এ আপনার Google Apps Script Web App URL বসান
2. GitHub এ আপলোড → **Settings → Pages → Deploy from a branch → main / (root)**
3. `admin.html` এ লগইন করে পণ্য, স্লাইডার, সেটিংস সাজান

## 💸 বিনা খরচে GitHub Pages-এ লাইভ
1. GitHub-এ সাইন আপ করে নতুন **Public** repository খুলুন।
2. এই প্রজেক্টের ফাইলগুলো repository-র root-এ upload করুন; `index.html`-ও root-এ থাকতে হবে।
3. **Settings → Pages → Build and deployment → Deploy from a branch** বেছে `main` branch ও `/(root)` নির্বাচন করে Save করুন।
4. GitHub যে `https://আপনার-ইউজারনেম.github.io/রিপোজিটরি-নাম/` ঠিকানা দেবে, সেটিই বিনা domain খরচে ব্যবহার করা যাবে।

GitHub Pages static site বিনা hosting খরচে প্রকাশ করে। বাস্তব পণ্য অ্যাডমিন থেকে যোগ/সম্পাদনা, অর্ডার ও ট্র্যাকিং চালাতে `config.js`-এ Google Apps Script Web App URL সংযোগ করতে হবে; সেই ডেটা Google Sheets-এ থাকে। URL না বসালে সাইটের demo পণ্য দেখা যাবে, কিন্তু অ্যাডমিনের পরিবর্তন বা বাস্তব অর্ডার সংরক্ষিত হবে না।

📖 **সম্পূর্ণ ধাপে ধাপে গাইড (বাংলা):** [`README-বাংলা-গাইড.md`](./README-%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE-%E0%A6%97%E0%A6%BE%E0%A6%87%E0%A6%A1.md)

## 📁 গঠন
| ফাইল | কাজ |
|---|---|
| `index.html` `style.css` `script.js` | হোমপেজ, হোমপেজের পণ্য বিভাগ ও দোকানের মূল আচরণ |
| `shop.html` `product.html` `cart.html` `checkout.html` `track.html` | আলাদা পণ্য, বিস্তারিত, কার্ট, চেকআউট ও ট্র্যাকিং পেজ |
| `pages.css` `pages.js` | আলাদা পেজগুলোর ডিজাইন ও ই-কমার্স কাজ |
| `admin.html` `admin.css` `admin.js` | অ্যাডমিন প্যানেল (পাসওয়ার্ড সুরক্ষিত) |
| `google-apps-script.gs` | ব্যাকএন্ড (Google Sheet এ বসবে) |
| `config.js` | Web App URL, Pixel ID, ঐচ্ছিক স্লাইড |
| `manifest.webmanifest` `sw.js` `icons/` | ইনস্টলযোগ্য অ্যাপ ও অফলাইন সহায়তা |
| `404.html` `robots.txt` `sitemap.xml` | GitHub Pages ও SEO |

> ⚠️ লাইভ করার পর `robots.txt`, `sitemap.xml` এ `YOUR-USERNAME/YOUR-REPO` নিজের ঠিকানা দিয়ে বদলান।

হোমপেজে সার্চসহ শপিং হেডার, ক্যাটাগরি নেভিগেশন, অফার ব্যানার, ডান-থেকে-বামে স্বয়ংক্রিয় ক্যাটাগরি ও পণ্য-কার্ড ক্যারোসেল, ক্যাম্পেইন ব্যানার, প্রতিটি ক্যাটাগরির আলাদা পণ্য-সেকশন এবং সব পণ্যের তালিকা আছে। কার্ডের ওপর mouse নিলে বা keyboard focus করলে চলা থামে; “আরও পণ্য দেখুন” চাপলে একই ক্যাটাগরির বাড়তি পণ্য আসে। ডেমো পণ্যের নিজস্ব SVG `images/`-এ আছে; অ্যাডমিনে পণ্য যোগ ও ছবি upload করলে সংযুক্ত Google Sheets থেকে তা হোমপেজ/শপে দেখাবে। ডিজাইনটি নিজস্ব খাঁটিঘর ব্র্যান্ডিং ব্যবহার করে।

আলাদা পেজগুলো সরাসরি GitHub Pages-এ কাজ করে। পণ্যের ডেমো তালিকা ব্যাকএন্ড সংযোগ ছাড়াই দেখা যাবে; বাস্তব পণ্য, কুপন, অর্ডার ও ট্র্যাকিং চালাতে `config.js`-এ Google Apps Script Web App URL বসান। কার্ট পেজ বদলালেও ব্রাউজারের `localStorage`-এ সংরক্ষিত থাকবে।

---

## Maintenance notes (speed & safety)

- **After editing any CSS/JS file**, bump the `?v=NN` number in the HTML files (and `CACHE` in `sw.js`). Versioned files are cached by the browser/service worker until the number changes.
- **Apps Script**: after pasting a new `google-apps-script.gs`, use *Deploy → Manage deployments → Edit → New version*. Public data (products, settings, slides) is cached for ~60 s on the server; any change made in the admin panel refreshes it immediately.
- **Product gallery**: after updating Apps Script, run `setup()` once to ensure the Products sheet has the `images` column, then deploy a new version of the existing Web App deployment. Keep its Web App URL the same as `SITE_API_URL` in `config.js`.
- **Admin password**: change `ADMIN_PASSWORD` in *Apps Script → Project Settings → Script properties*. The admin panel shows a red warning while the default password is still in use.
- Home/other pages start loading data in `<head>` (`prefetch.js`) and repeat visitors see the last saved data instantly while fresh data loads.
- `images/admin-down-img.png` (1.8 MB) is no longer used by the admin dashboard and can be deleted.
- হস্তান্তরের আগে [HANDOVER-CHECKLIST.md](HANDOVER-CHECKLIST.md) দেখুন।
