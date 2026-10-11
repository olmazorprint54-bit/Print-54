/* ================================================================
   CHOP ETISH NARXLARI (so'm) — hisoblash ilovasi (public/index.html)
   ham, botdagi "💲 Narxlar" tugmasi ham shu fayldan oladi.
   ================================================================ */
(function (root) {
  var PRICING = {
    paper: {
      bw:    { tier1: 439, tier2: 349 },
      color: { tier1: 700, tier2: 649 },
      doubleAddOn: { bw: 85, color: 135 }
    },
    book: {
      a4: { bw: 249, color: 440, cover: 7000 },
      a5: { bw: 122.5, color: 220, cover: 5000 }
    },
    binding: { a4: 7000, a5: 5000 }
  };

  var som = function (n) { return Number(n).toLocaleString("ru-RU") + " so'm"; };

  // Narxlar ro'yxati (profil va bot uchun)
  function printList() {
    var p = PRICING.paper, b = PRICING.book;
    return [
      { icon: "🖨", title: "Oq-qora chop etish (A4)", text: "varag'i " + som(p.bw.tier1) + ", ko'p miqdorda " + som(p.bw.tier2) + "; ikki tomonlama +" + som(p.doubleAddOn.bw) },
      { icon: "🎨", title: "Rangli chop etish (A4)", text: "varag'i " + som(p.color.tier1) + ", ko'p miqdorda " + som(p.color.tier2) + "; ikki tomonlama +" + som(p.doubleAddOn.color) },
      { icon: "📚", title: "Kitob (A4)", text: "beti oq-qora " + som(b.a4.bw) + ", rangli " + som(b.a4.color) + " + muqova " + som(b.a4.cover) },
      { icon: "📗", title: "Kitob (A5)", text: "beti oq-qora " + som(b.a5.bw) + ", rangli " + som(b.a5.color) + " + muqova " + som(b.a5.cover) },
      { icon: "🔖", title: "Pereplyot", text: "A4 " + som(PRICING.binding.a4) + ", A5 " + som(PRICING.binding.a5) },
    ];
  }

  var api = { PRICING: PRICING, printList: printList };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PRINT_PRICES = api;
})(this);
