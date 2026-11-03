// Google Apps Script Web App URL এখানে একবারই বসান (দোকান ও অ্যাডমিন দুটোই এটি ব্যবহার করে)
const SITE_API_URL = "https://script.google.com/macros/s/AKfycbzYOFvKOTirvsh6UkLencQQzFUN4GwXUd4-xl-JPJEZDg_pO3N4tfTM9YvWAQjqL4nn/exec";

// Meta (Facebook) Pixel ID — শুধু সংখ্যা। এখানে বসান, অথবা অ্যাডমিন প্যানেল > সেটিংস > "Meta Pixel ID" ঘরে (কোড না ছুঁয়েই, যেকোনো সময়)।
// দুই জায়গায় থাকলে অ্যাডমিন প্যানেলের আইডি অগ্রাধিকার পায়। ফাঁকা থাকলে Pixel বন্ধ থাকে।
const SITE_PIXEL_ID = "";

// হোমপেজ স্লাইডার (ঐচ্ছিক)। অ্যাডমিন প্যানেলের "🖼️ স্লাইডার" ট্যাবে স্লাইড থাকলে সেটাই অগ্রাধিকার পায়।
// ব্যাকএন্ড ছাড়াই ছবি বসাতে চাইলে এখানে লিখুন (ছবি images/ ফোল্ডারে রাখুন):
//   const SITE_SLIDES = [
//     { imgDesktop: "images/slide1.jpg", imgMobile: "images/slide1-m.jpg", title: "", link: "#products" },
//     { imgDesktop: "images/slide2.jpg", imgMobile: "images/slide2-m.jpg", title: "ঈদ অফার", subtitle: "সব পণ্যে ১০% ছাড়", btnText: "কিনুন", link: "#products" },
//   ];
// ছবির মাপ: ডেস্কটপ 1600×800 px (2:1) · মোবাইল 1000×800 px (5:4) · প্রতিটি ২০০ KB এর নিচে (JPG/WebP)।
const SITE_SLIDES = [];

// ফুটারের যোগাযোগ — এখানে নিজের ইমেইল ও ঠিকানা বসান। অ্যাডমিন → সেটিংসে দিলে সেটাই অগ্রাধিকার পায়। ফাঁকা রাখলে ওই সারি দেখায় না।
const SITE_CONTACT = {
  email: "almasforhasi1999@gmail.com",
  address: "আপনার ঠিকানা, ঢাকা, বাংলাদেশ"
};

// সোশ্যাল মিডিয়া লিংক (ফুটারের আইকন)। অ্যাডমিন → সেটিংসে দিলে সেটাই অগ্রাধিকার পায়।
// ফাঁকা রাখলে ওই আইকন দেখায় না। অবশ্যই https:// দিয়ে শুরু করুন। নিচেরগুলো নমুনা — নিজের পেজের লিংক বসান।
const SITE_SOCIAL = {
  facebook: "https://www.facebook.com/",     // যেমন: "https://facebook.com/আপনার-পেজ"
  twitter: "https://twitter.com/",           // যেমন: "https://twitter.com/আপনার-আইডি"
  instagram: "https://www.instagram.com/",   // যেমন: "https://www.instagram.com/আপনার-আইডি"
  linkedin: "https://www.linkedin.com/",     // যেমন: "https://www.linkedin.com/company/আপনার-পেজ"
  tiktok: ""      // যেমন: "https://www.tiktok.com/@আপনার-আইডি"
};
