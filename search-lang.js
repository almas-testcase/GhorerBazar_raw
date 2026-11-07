/* =====================================================================
   Search language layer (shared by the storefront search and the admin search)
   Makes searching work in Bangla, English or "Banglish" (Bangla typed with English letters):
     - SearchLang.alts(word)   -> same-meaning words in every spelling, e.g. "oil" -> tel, তেল, তৈল
     - SearchLang.skel(word)   -> sound skeleton, so "sorisha" and "সরিষা" give the same key ("srs")
     - SearchLang.parse(query) -> pulls "under 500", "above 300", "offer" out of the text as filters
   To teach the search a new word, add a line to GROUPS below: every word in one line means the same thing.
   ===================================================================== */
(function () {
  "use strict";
  var BN_DIGITS = "০১২৩৪৫৬৭৮৯";
  var isBn = function (s) { return /[ঀ-৿]/.test(s); };
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[০-৯]/g, function (d) { return BN_DIGITS.indexOf(d); })
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }

  /* ---------- 1. Same-meaning words (English · Banglish · Bangla) ---------- */
  var GROUPS = [
    ["oil", "tel", "tail", "তেল", "তৈল"],
    ["mustard", "sorisha", "shorisha", "sarisha", "sorshe", "shorshe", "sorsher", "সরিষা", "সরিষার", "সরষে", "সর্ষে"],
    ["honey", "modhu", "madhu", "mou", "মধু"],
    ["ghee", "ghi", "ghrito", "ঘি", "ঘী", "ঘৃত"],
    ["butter", "makhon", "মাখন"],
    ["nuts", "nut", "badam", "বাদাম", "মেওয়া", "dryfruit", "dry fruit", "dry fruits"],
    ["almond", "kathbadam", "kath badam", "কাঠবাদাম", "আমন্ড"],
    ["cashew", "kaju", "kajubadam", "কাজু", "কাজুবাদাম"],
    ["peanut", "chinabadam", "china badam", "চিনাবাদাম", "চিনা বাদাম"],
    ["pistachio", "pesta", "পেস্তা", "পেস্তাবাদাম"],
    ["walnut", "akhrot", "আখরোট"],
    ["raisin", "kishmish", "kismis", "কিসমিস", "কিশমিশ"],
    ["dates", "date", "khejur", "khajur", "খেজুর"],
    ["spice", "spices", "masala", "moshla", "moshlla", "mosla", "মশলা", "মসলা"],
    ["turmeric", "holud", "halud", "হলুদ"],
    ["chilli", "chili", "chilly", "morich", "marich", "lonka", "মরিচ", "লঙ্কা", "লংকা"],
    ["cumin", "jira", "zira", "জিরা", "জীরা"],
    ["coriander", "dhone", "dhonia", "dhania", "ধনে", "ধনিয়া"],
    ["cinnamon", "dalchini", "daruchini", "দারুচিনি", "দারচিনি"],
    ["cardamom", "elach", "elachi", "এলাচ", "এলাচি"],
    ["clove", "lobongo", "labongo", "লবঙ্গ", "লবং"],
    ["pepper", "golmorich", "gol morich", "গোলমরিচ"],
    ["ginger", "ada", "আদা"],
    ["garlic", "roshun", "rasun", "রসুন"],
    ["onion", "peyaj", "piyaj", "peaj", "পেঁয়াজ", "পেয়াজ"],
    ["nigella", "kalojira", "kalo jira", "কালোজিরা", "কালো জিরা"],
    ["fenugreek", "methi", "মেথি"],
    ["rice", "chal", "chaal", "চাল"],
    ["flour", "atta", "ata", "আটা", "moida", "maida", "ময়দা"],
    ["lentil", "dal", "daal", "ডাল", "musur", "মসুর", "মুগ"],
    ["salt", "nun", "lobon", "লবণ", "নুন"],
    ["sugar", "chini", "চিনি"],
    ["jaggery", "gur", "goor", "molasses", "গুড়", "গুড"],
    ["milk", "dudh", "doodh", "দুধ"],
    ["tea", "cha", "চা", "চায়ের"],
    ["coffee", "kofi", "কফি"],
    ["pickle", "achar", "achaar", "আচার"],
    ["coconut", "narikel", "নারিকেল", "নারকেল"],
    ["sesame", "til", "তিল"],
    ["seed", "seeds", "bij", "beej", "বীজ", "বিচি"],
    ["pure", "khati", "khaati", "খাঁটি", "খাটি", "asol", "আসল", "organic"],
    ["kitchen", "rannaghor", "ranna", "রান্নাঘর", "রান্না"],
    ["bread", "ruti", "রুটি"],
    ["egg", "dim", "ডিম"],
    ["fish", "mach", "maach", "মাছ"],
    ["meat", "mangsho", "mangsa", "মাংস"],
    ["fruit", "fruits", "fol", "phol", "ফল"],
    ["vegetable", "vegetables", "sobji", "shobji", "sabji", "সবজি", "সবজী", "তরকারি"],
    ["juice", "jus", "জুস"],
    ["biscuit", "biskut", "বিস্কুট"],
    ["noodles", "noodle", "নুডলস"],
    ["soyabean", "soybean", "soyabin", "soya", "সয়াবিন"],
    ["olive", "zaitun", "জলপাই", "অলিভ"],
    ["mix", "mixed", "mishro", "মিক্স", "মিশ্র"],
    ["kg", "kilo", "kilogram", "কেজি", "কিলো"],
    ["litre", "liter", "ltr", "লিটার"],
    ["gram", "gm", "gms", "গ্রাম"]
  ];

  var index = {};               // normalized word -> array of group numbers
  var groupTerms = GROUPS.map(function (g, gi) {
    return g.map(function (w) {
      var n = norm(w);
      if (n) (index[n] = index[n] || []).push(gi);
      return n;
    }).filter(Boolean);
  });

  /* words with the same meaning as `t` (already normalized). Handles endings: "sorishar" / "সরিষার" still find "sorisha" / "সরিষা". */
  function alts(t) {
    if (!t || t.length < 2) return [];
    var hit = {}, out = [];
    function take(gi) { if (!hit[gi]) { hit[gi] = 1; groupTerms[gi].forEach(function (w) { if (w !== t && out.indexOf(w) < 0) out.push(w); }); } }
    (index[t] || []).forEach(take);
    if (t.length >= 3) {
      Object.keys(index).forEach(function (k) {
        var minLen = isBn(k) ? 2 : 4;
        if (k.length < minLen) return;
        // typed start of a known word ("mus" -> mustard) or a known word plus an ending ("sorishar" -> sorisha)
        if ((k.indexOf(t) === 0 && t.length >= 3) || (t.indexOf(k) === 0 && t.length - k.length <= 3)) index[k].forEach(take);
      });
    }
    return out.slice(0, 16);
  }

  /* ---------- 2. Sound skeleton: Bangla and Banglish spellings of a word give the same key ---------- */
  var BN = { "ক": "k", "খ": "k", "গ": "g", "ঘ": "g", "ঙ": "n", "চ": "c", "ছ": "c", "জ": "j", "ঝ": "j", "ঞ": "n", "ট": "t", "ঠ": "t", "ড": "d", "ঢ": "d", "ণ": "n", "ত": "t", "থ": "t", "দ": "d", "ধ": "d", "ন": "n", "প": "p", "ফ": "f", "ব": "b", "ভ": "b", "ম": "m", "য": "j", "র": "r", "ল": "l", "শ": "s", "ষ": "s", "স": "s", "ৎ": "t", "ং": "n" };
  function skel(word) {
    var s = String(word == null ? "" : word).toLowerCase()
      .replace(/ph/g, "f").replace(/sh/g, "s").replace(/ch/g, "C").replace(/kh/g, "k").replace(/gh/g, "g")
      .replace(/jh/g, "j").replace(/th/g, "t").replace(/dh/g, "d").replace(/bh/g, "b").replace(/ng/g, "n");
    var out = "", last = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i), m;
      if (BN[ch] != null) m = BN[ch];
      else if (ch === "C") m = "c";
      else if (/[bdfgjklmnprstc]/.test(ch)) m = ch === "c" ? "k" : ch;
      else if (ch === "v" || ch === "w") m = "b";
      else if (ch === "z") m = "j";
      else if (ch === "q") m = "k";
      else if (ch === "x") m = "ks";
      else if (ch >= "0" && ch <= "9") m = ch;
      else m = ""; // vowels, h, y, signs, spaces
      if (m && m !== last) out += m;
      if (m) last = m;
    }
    return out;
  }

  /* ---------- 3. Filters typed inside the search: "under 500", "above 300", "offer" ---------- */
  function parse(query) {
    var q = String(query == null ? "" : query).toLowerCase().replace(/[০-৯]/g, function (d) { return BN_DIGITS.indexOf(d); });
    var r = { max: null, min: null, offer: false, text: q };
    var n = "(?:৳|tk\\.?|taka|টাকা)?\\s*(\\d+)";
    function grab(re, key) {
      var m = r.text.match(re);
      if (m) { r[key] = Number(m[1]); r.text = r.text.replace(re, " "); }
    }
    grab(new RegExp("(?:under|below|less than|within|upto|up to|max|maximum)\\s*" + n), "max");
    grab(new RegExp("(?:<=|<|≤)\\s*" + n), "max");
    grab(new RegExp("(\\d+)\\s*(?:টাকার|টাকা|tk|taka)?\\s*(?:এর|র|er|r)?\\s*(?:নিচে|নীচে|কমে|কম|niche|nice|kom|kome)(?=\\s|$)"), "max");
    grab(new RegExp("(?:above|over|more than|from|min|minimum)\\s*" + n), "min");
    grab(new RegExp("(?:>=|>|≥)\\s*" + n), "min");
    grab(new RegExp("(\\d+)\\s*(?:টাকার|টাকা|tk|taka)?\\s*(?:এর|র|er|r)?\\s*(?:উপরে|ওপরে|বেশি|upore|uppore|opore|beshi|besi)(?=\\s|$)"), "min");
    var off = /(^|\s)(offers?|discount|discounted|sale|deals?)(?=\s|$)|অফার|ছাড়|ডিসকাউন্ট/;
    if (off.test(r.text)) { r.offer = true; r.text = r.text.replace(off, " "); }
    r.text = r.text.replace(/\s+/g, " ").trim();
    return r;
  }

  window.SearchLang = { norm: norm, alts: alts, skel: skel, parse: parse, isBn: isBn };
})();
