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
  referat: "Referat", article: "Maqola", essay: "Mustaqil ish", presentation: "Taqdimot",
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

module.exports = { FREE_DAILY, providerToken, payload, orderIdOf, createInvoice };
