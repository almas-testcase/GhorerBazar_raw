# KhatiGhor — Handover Checklist (ক্রেতাকে বুঝিয়ে দেওয়ার আগে)

## ১. নিজের ঠিকানা/তথ্য বসান (একবারই)
- [ ] **Admin → Settings:** ফোন, WhatsApp (`8801XXXXXXXXX`), ইমেইল, ঠিকানা, খোলার সময়, ডেলিভারি চার্জ, ফ্রি-ডেলিভারির সীমা
- [ ] **bKash / Nagad নম্বর** দিন — নম্বর না দিলে চেকআউটে এই দুটি অপশন নিজে থেকেই লুকানো থাকে (শুধু Cash on Delivery)
- [ ] **Social links** (Facebook, Instagram …) — ফাঁকা থাকলে আইকন দেখায় না
- [ ] **Meta Pixel ID** (থাকলে) — Admin → Settings
- [ ] **Products / Categories / Hero slider / Brands / Reviews** — নিজের আসল তথ্য ও ছবি দিন; ডেমো পণ্য এবং test/placeholder review মুছুন

## ২. নিরাপত্তা (অবশ্যই)
- [ ] **Admin পাসওয়ার্ড বদলান** — ডিফল্ট `changeme123` থাকলে Admin-এর উপরে লাল সতর্কতা দেখায়। Apps Script → Project Settings → Script Properties → `ADMIN_PASSWORD` (দীর্ঘ, অনন্য পাসওয়ার্ড দিন)
- [ ] Courier API key (Steadfast/Pathao) **শুধু** Admin → Courier থেকে দিন — কখনও Sheet বা কোডে লিখবেন না
- [ ] Google Sheet ও Apps Script প্রজেক্ট **শুধু মালিকের অ্যাকাউন্টে** শেয়ার রাখুন
- [ ] Apps Script কোড বদলালে: Deploy → Manage deployments → ✏️ → **New version** → Deploy (একই URL থাকে)

## ৩. লাইভ করার পর (ডোমেইন পেলে)
- [ ] `sitemap.xml` — `YOUR-USERNAME.github.io/YOUR-REPO` বদলে আসল ডোমেইন বসান
- [ ] `robots.txt` — শেষ লাইনের `#` সরিয়ে `Sitemap:` এ আসল ডোমেইন দিন
- [ ] (ঐচ্ছিক) শেয়ার ছবির জন্য `index.html` এ `<meta property="og:image" content="https://আপনার-ডোমেইন/images/og.jpg">` যোগ করুন (1200×630 ছবি)
- [ ] Google Search Console-এ sitemap জমা দিন

## ৪. কোড বদলালে
- [ ] CSS/JS বদলালে HTML-এ `?v=` সংখ্যা বাড়ান (বর্তমান public pages CSS version `37`) এবং `sw.js` এর `CACHE` একই সংখ্যায় বাড়ান — নইলে পুরনো ভার্সন ব্রাউজারে থেকে যায়
- [ ] Admin-এর জন্য `admin.html` এর `?v=` বাড়ান

## ৫. হস্তান্তরের আগে পরীক্ষা (৫ মিনিট)
- [ ] একটি আসল অর্ডার দিন (COD) → Admin → Orders-এ আসছে কি দেখুন → স্ট্যাটাস বদলান → Track Order পেজে মিলছে কি দেখুন
- [ ] Coupon বানিয়ে চেকআউটে প্রয়োগ করুন
- [ ] মোবাইলে (Chrome) হোম, শপ, কার্ট, চেকআউট খুলে দেখুন
- [ ] Admin → Dashboard খুলে সংখ্যাগুলো Sheet-এর সাথে মিলিয়ে নিন
- [ ] টেস্ট অর্ডারগুলো Sheet থেকে মুছে ফেলুন

## ৬. ব্যাকআপ
- [ ] Google Sheet-এর কপি রাখুন (File → Make a copy) — মাসে একবার
- [ ] Admin → Orders → **Export CSV** দিয়ে অর্ডারের ব্যাকআপ নিন
