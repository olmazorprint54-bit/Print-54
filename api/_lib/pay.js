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

// Mijozga botda: karta, to'ldirish summasi, nima qilish kerak.
// amount — o'tkaziladigan noyob summa; order.total — buyurtma narxi; balance — hozirgi balans
function cardText(card, order, amount, balance = 0) {
  const title = TITLES[order.service] || "AI xizmat";
  const topic = String((order.details && order.details.topic) || "").slice(0, 120);
  const price = Number(order.total) || 0;
  const left = balance + amount - price;
  const onlyTopup = order.service === "topup";
  const extra = amount - (Number(order.details && order.details.topup) || amount);
  return [
    `💳 <b>Hisobni to'ldirish: ${fmtSum(amount)}</b>`,
    ...(onlyTopup
      ? [`Balansingiz: ${fmtSum(balance)} → to'lovdan keyin ${fmtSum(left)}. Buyurtmalar narxi balansdan avtomatik yechiladi.`]
      : [`${escHtml(title)}${topic ? ` — «${escHtml(topic)}»` : ""}: ${fmtSum(price)}${balance > 0 ? ` (balansda ${fmtSum(balance)} bor)` : ""}`,
        ...(left > 0 ? [`Qolgan ${fmtSum(left)} balansingizda qoladi — keyingi buyurtmalar undan yechiladi.`] : [])]),
    "",
    `Karta: <code>${card.number}</code>`,
    ...(card.name ? [`Egasi: ${escHtml(card.name)}`] : []),
    "",
    `1) Shu kartaga <b>aynan ${fmtSum(amount)}</b> o'tkazing (Click, Payme yoki bank ilovasi orqali).`,
    ...(extra > 0 ? [`ℹ️ +${extra} so'm — to'lovingizni aniq tanib olish uchun qo'shildi, komissiya emas — u ham balansingizga tushadi.`] : []),
    "2) To'lov chekini (skrinshot yoki PDF) shu chatga yuboring.",
    "",
    onlyTopup ? "Chek avtomatik tekshiriladi va balansingiz to'ldiriladi." : "Chek avtomatik tekshiriladi, so'ng balans to'ldiriladi, AI ishni boshlaydi va tayyor fayl shu yerga keladi.",
  ].join("\n");
}

module.exports = { FREE_DAILY, providerToken, payload, orderIdOf, createInvoice, payCard, cardText, fmtSum, RECEIPT_HOURS, TITLES };
