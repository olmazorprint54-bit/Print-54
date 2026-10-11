// api/_lib/pay.js
// ---------------------------------------------------------------
// Pullik AI xizmatlar uchun Telegram to'lovi (Click yoki Payme).
// @BotFather -> Bot Settings -> Payments orqali olingan token Vercel
// env'da: PAYMENT_PROVIDER_TOKEN. Token yo'q bo'lsa — sinov rejimi:
// AI xizmatlar to'lovsiz, lekin har bir mijozga kuniga FREE_DAILY ta.
//
// Oqim: ai-request.js buyurtmani "to'lov kutilmoqda" holatida yozadi va
// to'lov havolasini (invoice) qaytaradi -> ilova tg.openInvoice bilan
// ochadi -> telegram-webhook.js pre_checkout_query'ni tekshiradi ->
// successful_payment kelgach AI ishga tushadi (api/resume-pdf.js).
// ---------------------------------------------------------------

const { telegram } = require("./bots");

const FREE_DAILY = Number(process.env.FREE_DAILY) || 3;
const providerToken = () => String(process.env.PAYMENT_PROVIDER_TOKEN || "").trim();
const payload = (orderId) => `ai:${orderId}`;
const orderIdOf = (p) => (/^ai:(\d+)$/.test(String(p)) ? parseInt(String(p).slice(3), 10) : null);

const TITLES = {
  test: "Test tuzish", questions: "Savollar tuzish", crossword: "Krossvord", lesson: "Dars ishlanma",
  referat: "Referat", article: "Maqola", essay: "Mustaqil ish", kurs: "Kurs ishi", presentation: "Taqdimot",
};

// To'lov havolasi (tg.openInvoice uchun). price — so'mda
async function createInvoice(bot, order, price) {
  const title = (TITLES[order.service] || "AI xizmat").slice(0, 32);
  const topic = String((order.details && order.details.topic) || "").slice(0, 200);
  const out = await telegram(bot, "createInvoiceLink", {
    title,
    description: `${topic || title} — AI tayyorlaydi, fayl shu botga keladi.`.slice(0, 255),
    payload: payload(order.id),
    provider_token: providerToken(),
    currency: "UZS",
    prices: [{ label: title, amount: Math.round(price * 100) }],
  });
  if (!out.ok) throw new Error("To'lov havolasini yaratib bo'lmadi: " + out.description);
  return out.result;
}

// ---------------------------------------------------------------
// Kartaga o'tkazma (Click/Payme ulanmaguncha). Vercel env:
//   PAY_CARD       — karta raqami (16 raqam)
//   PAY_CARD_NAME  — karta egasi (mijozga ko'rinadi)
// Oqim: ai-request.js buyurtmani "to'lov kutilmoqda" (payMethod: "card")
// holatida yozadi, mijozga karta va summani yuboradi -> mijoz chek
// rasmini botga yuboradi -> egasiga chek + "✅ To'lov keldi" tugmasi ->
// egasi bosgach AI ishga tushadi (telegram-webhook.js).
// ---------------------------------------------------------------
const RECEIPT_HOURS = 24; // shu muddat ichida yuborilgan rasm/fayl — chek
function payCard() {
  const digits = String(process.env.PAY_CARD || "").replace(/\D/g, "");
  if (digits.length < 16 || digits.length > 19) return null;
  return { number: digits.replace(/(\d{4})(?=\d)/g, "$1 "), name: String(process.env.PAY_CARD_NAME || "").trim().slice(0, 60) };
}

const fmtSum = (n) => Number(n || 0).toLocaleString("ru-RU") + " so'm";
const escHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Mijozga botda: karta, to'ldirish summasi, nima qilish kerak (l — mijoz tili).
// amount — o'tkaziladigan noyob summa; order.total — buyurtma narxi; balance — hozirgi balans
function cardText(card, order, amount, balance = 0, l = "uz") {
  const L = require("./i18n-bot");
  const s = (n) => L.sum(l, n);
  const topic = String((order.details && order.details.topic) || "").slice(0, 120);
  const price = Number(order.total) || 0;
  const left = balance + amount - price;
  const onlyTopup = order.service === "topup";
  const extra = amount - (Number(order.details && order.details.topup) || amount);
  return [
    L.T(l, "cardTitle"),
    "",
    L.T(l, "cardAmount", s(amount)),
    ...(onlyTopup
      ? [L.T(l, "cardBal", s(balance), s(left))]
      : [`🧾 ${escHtml(L.label(l, order.service))}${topic ? ` «${escHtml(topic)}»` : ""}: ${s(price)}`,
        L.T(l, "cardBalAfter", s(balance), s(Math.max(0, left)))]),
    "",
    `${L.T(l, "cardNo")}: <code>${card.number}</code>`,
    ...(card.name ? [`${L.T(l, "cardOwner")}: ${escHtml(card.name)}`] : []),
    L.T(l, "cardCopy"),
    "",
    L.T(l, "cardHow"),
    L.T(l, "cardStep1", s(amount)),
    L.T(l, "cardStep2"),
    onlyTopup ? L.T(l, "cardStep3Topup") : L.T(l, "cardStep3Order"),
    ...(extra > 0 ? ["", L.T(l, "cardExtra", extra)] : []),
  ].join("\n");
}

// Bekor qilingan to'lov: karta xabari o'rniga qisqa yozuv (karta va summa qolmasin)
function cancelledText(order, l = "uz") {
  const L = require("./i18n-bot");
  if (order.service === "topup") return L.T(l, "cancelledTopup");
  const topic = String((order.details && order.details.topic) || "").slice(0, 100);
  return L.T(l, "cancelledOrder", `${L.label(l, order.service)}${topic ? ` «${topic}»` : ""}`);
}

module.exports = { FREE_DAILY, providerToken, payload, orderIdOf, createInvoice, payCard, cardText, cancelledText, fmtSum, RECEIPT_HOURS, TITLES };
