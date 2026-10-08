/* ================================================================
   AI XIZMATLAR NARXI (so'm) — ilova ham, server ham shu fayldan oladi.
   Server mijoz yuborgan narxga ishonmaydi, shu yerda qayta hisoblaydi.
   Telegram orqali (Click/Payme) eng kam to'lov — 12 981 so'm, shuning
   uchun pullik xizmat 13 000 so'mdan arzon bo'lmaydi.
   0 — tekin. Ro'yxatda yo'q xizmat — "narxi kelishiladi" (qo'lda).
   ================================================================ */
(function (root) {
  // SINOV DAVRI: pullik AI xizmatlar tekin (mijozga kuniga FREE_DAILY ta),
  // xarajat o'lchanadi. Narxlar belgilangach false qilinadi.
  var TRIAL = true;
  var MIN = 13000;
  var num = function (v, d) { var n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : d; };

  // base — shu hajmgacha (upTo); undan keyin har bir birlik uchun step
  var TABLE = {
    presentation: { base: 20000, upTo: 10, field: "slides", fallback: 10, step: 1000 },
    test:      { base: 13000, upTo: 30, field: "count", fallback: 20, step: 300 },
    questions: { base: 13000, upTo: 30, field: "count", fallback: 15, step: 300 },
    crossword: { base: 13000 },
    lesson:    { base: 15000, extra: { duration: { "80": 5000 } } },
    referat:   { base: 15000, upTo: 10, field: "pages", fallback: 10, step: 1000 },
    essay:     { base: 20000, upTo: 15, field: "pages", fallback: 15, step: 1000 },
    resume:    { base: 0 },
    obyektivka:{ base: 0 },
  };

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
    return Math.max(MIN, Math.round(p / 500) * 500);
  }

  // Xizmatlar ro'yxatida: "13 000 so'mdan"
  function fromPrice(service) {
    var t = TABLE[service];
    if (!t) return null;
    return t.base ? Math.max(MIN, t.base) : 0;
  }

  var api = { TRIAL: TRIAL, MIN: MIN, TABLE: TABLE, priceOf: priceOf, fromPrice: fromPrice };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AI_PRICES = api;
})(this);
