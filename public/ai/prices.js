/* ================================================================
   AI XIZMATLAR NARXI (so'm) — ilova ham, server ham shu fayldan oladi.
   Server mijoz yuborgan narxga ishonmaydi, shu yerda qayta hisoblaydi.
   To'lov hozircha kartaga o'tkazma (api/_lib/pay.js). Telegram orqali
   (Click/Payme) ulansa — u yerda eng kam to'lov 12 981 so'm, MIN ni
   13 000 qilish kerak bo'ladi.
   0 — tekin. Ro'yxatda yo'q xizmat — "narxi kelishiladi" (qo'lda).
   ================================================================ */
(function (root) {
  // SINOV DAVRI (true): pullik AI xizmatlar tekin (mijozga kuniga FREE_DAILY ta).
  // false — narx olinadi (kartaga to'lov uchun Vercel env PAY_CARD kerak).
  var TRIAL = false;
  var MIN = 0;
  // Mijoz o'z manbalarini (adabiyot) yuklasa — qo'shimcha, jami betga qarab
  // (AI ularni o'qiydi): [shu betgacha, narx]
  var SOURCE_TIERS = [[10, 500], [15, 750], [25, 1200], [Infinity, 1500]];
  var SOURCE_FEE = SOURCE_TIERS[0][1]; // eng kami ("+500 so'mdan")
  var SOURCE_SERVICES = ["essay", "kurs", "referat", "article", "presentation", "test", "questions", "lesson"];
  var num = function (v, d) { var n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : d; };

  function sourceFee(pages) {
    var n = Number(pages) || 0;
    for (var i = 0; i < SOURCE_TIERS.length; i++) if (n <= SOURCE_TIERS[i][0]) return SOURCE_TIERS[i][1];
    return SOURCE_TIERS[SOURCE_TIERS.length - 1][1];
  }

  // base — shu hajmgacha (upTo); undan keyin har bir birlik uchun step
  var TABLE = {
    presentation: { base: 3500, upTo: 10, field: "slides", fallback: 10, step: 300 },
    test:      { base: 2500, upTo: 30, field: "count", fallback: 20, step: 30 },
    questions: { base: 2500, upTo: 30, field: "count", fallback: 15, step: 30 },
    crossword: { base: 3500 },
    lesson:    { base: 4500, extra: { duration: { "80": 25 } } },
    article:   { base: 7500, upTo: 5, field: "pages", fallback: 6, step: 350 },
    referat:   { base: 3500, upTo: 10, field: "pages", fallback: 10, step: 200 },
    essay:     { base: 4500, upTo: 15, field: "pages", fallback: 12, step: 300 },
    kurs:      { base: 10000, upTo: 30, field: "pages", fallback: 30, step: 300 },
    resume:    { base: 0 },
    obyektivka:{ base: 0 },
  };

  // f.sourcePages — tanlangan manbalarning jami beti (server o'zi hisoblaydi)
  function priceOf(service, f) {
    var t = TABLE[service];
    if (!t) return null;
    if (!t.base) return 0;
    f = f || {};
    var p = t.base;
    if (t.field) {
      var n = num(f[t.field], t.fallback);
      if (n > t.upTo) p += (n - t.upTo) * t.step;
    }
    if (t.extra) for (var k in t.extra) if (t.extra[k][f[k]]) p += t.extra[k][f[k]];
    if (f.sources && f.sources.length && SOURCE_SERVICES.indexOf(service) >= 0) p += sourceFee(f.sourcePages);
    return Math.max(MIN, Math.round(p / 5) * 5);
  }

  // Xizmatlar ro'yxatida: "3 500 so'mdan"
  function fromPrice(service) {
    var t = TABLE[service];
    if (!t) return null;
    return t.base ? Math.max(MIN, t.base) : 0;
  }

  var api = { TRIAL: TRIAL, MIN: MIN, TABLE: TABLE, SOURCE_FEE: SOURCE_FEE, SOURCE_TIERS: SOURCE_TIERS, SOURCE_SERVICES: SOURCE_SERVICES, sourceFee: sourceFee, priceOf: priceOf, fromPrice: fromPrice };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AI_PRICES = api;
})(this);
