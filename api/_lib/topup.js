// api/_lib/topup.js
// ---------------------------------------------------------------
// Hisobni to'ldirish (buyurtmasiz): ilova profilidan (api/ai-request.js,
// service "topup") yoki botdagi "💳 Hisobni to'ldirish" tugmasidan
// (telegram-webhook.js). Buyurtma "topup" — narxi 0, chek tasdiqlangach
// to'lov summasi balansga qo'shiladi.
// ---------------------------------------------------------------
const supabase = require("./db");
const { telegram } = require("./bots");
const { payCard, cardText, fmtSum } = require("./pay");
const { walletOf, MAX_TOPUP, MIN_FIRST, MIN_NEXT } = require("./balance");
const { uniqueAmount } = require("./receipt");

// Botdagi doimiy tugmalar (xabar yozish joyi ostida)
const KB = { topup: "💳 Hisobni to'ldirish", balance: "💰 Balansim" };
const keyboard = () => ({ keyboard: [[{ text: KB.topup }, { text: KB.balance }]], resize_keyboard: true, is_persistent: true });
// "Boshqa summa" so'rovi — mijoz shu xabarga javob qilib summani yozadi
const ASK_MARK = "✏️ Qancha so'mga to'ldirasiz?";
const MIN_NOTE = `Birinchi to'ldirish — kamida ${fmtSum(MIN_FIRST)}, keyingilari — kamida ${fmtSum(MIN_NEXT)}.`;

async function createTopup(bot, u, amount) {
  const card = payCard();
  if (!card) return { ok: false, error: "Hisobni to'ldirish hozircha yoqilmagan." };
  amount = Math.round(Number(amount) || 0);
  const w = await walletOf(u.id);
  if (amount > MAX_TOPUP) return { ok: false, error: "Summa juda katta." };
  if (amount < w.minTopup) return { ok: false, error: `To'ldirish summasi ${fmtSum(w.minTopup)}dan kam bo'lmasin.` };
  const payAmount = await uniqueAmount(amount).catch(() => amount);
  const details = { bot, topic: "Hisobni to'ldirish", awaitingPayment: true, payMethod: "card", topup: amount, payAmount };
  const { data: row, error } = await supabase
    .from("orders")
    .insert({
      service: "topup",
      qty: null,
      total: 0,
      telegram_user_id: u.id,
      telegram_username: u.username || null,
      telegram_name: [u.first_name, u.last_name].filter(Boolean).join(" "),
      status: "active",
      details,
    })
    .select()
    .single();
  if (error || !row) throw error || new Error("Buyurtmani bazaga yozib bo'lmadi");
  const sent = await telegram(bot, "sendMessage", {
    chat_id: u.id,
    text: cardText(card, { service: "topup", details, total: 0 }, payAmount, w.balance),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: `paycancel:${row.id}` }]] },
  }).catch((e) => ({ ok: false, description: String(e) }));
  if (!sent.ok) console.error("Karta xabarini yuborib bo'lmadi:", sent.description);
  else await supabase.from("orders").update({ details: { ...details, payMsg: sent.result.message_id } }).eq("id", row.id);
  return { ok: true, orderId: row.id, card: { number: card.number, name: card.name, price: payAmount, topup: amount, balance: w.balance } };
}

// "💳 Hisobni to'ldirish": balans va summa tanlovi
async function sendMenu(bot, chatId, userId) {
  const w = await walletOf(userId);
  const opts = [w.minTopup, 10000, 20000, 50000].filter((x, i, a) => a.indexOf(x) === i);
  return telegram(bot, "sendMessage", {
    chat_id: chatId,
    text: [
      "💳 <b>Hisobni to'ldirish</b>",
      "",
      `👛 Balansingiz: <b>${fmtSum(w.balance)}</b>`,
      `📌 ${MIN_NOTE}`,
      "",
      "Summani tanlang yoki o'zingiz yozing 👇",
    ].join("\n"),
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        opts.slice(0, 2).map((a) => ({ text: fmtSum(a), callback_data: `topup:${a}` })),
        opts.slice(2, 4).map((a) => ({ text: fmtSum(a), callback_data: `topup:${a}` })),
        [{ text: "✏️ Boshqa summa", callback_data: "topupask" }],
      ].filter((r) => r.length),
    },
  });
}

async function sendBalance(bot, chatId, userId) {
  const w = await walletOf(userId);
  return telegram(bot, "sendMessage", {
    chat_id: chatId,
    text: `👛 Balansingiz: <b>${fmtSum(w.balance)}</b>\n\nBuyurtmalar narxi balansdan avtomatik yechiladi.`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: KB.topup, callback_data: "topupmenu" }]] },
  });
}

async function askAmount(bot, chatId, userId) {
  const w = await walletOf(userId);
  return telegram(bot, "sendMessage", {
    chat_id: chatId,
    text: `${ASK_MARK}\nSummani raqam bilan yozing — kamida ${fmtSum(w.minTopup)}.`,
    reply_markup: { force_reply: true, input_field_placeholder: `Masalan: ${w.minTopup + 2000}` },
  });
}

// "7 000", "7000 so'm" -> 7000
const parseAmount = (text) => {
  const digits = String(text || "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

module.exports = { KB, keyboard, ASK_MARK, MIN_NOTE, createTopup, sendMenu, sendBalance, askAmount, parseAmount };
