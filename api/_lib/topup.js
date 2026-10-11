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

const L = require("./i18n-bot");

// Botdagi doimiy tugmalar (xabar yozish joyi ostida) — mijoz tilida
const keyboard = (l = "uz") => ({
  keyboard: [[{ text: L.kbText(l, "topup") }, { text: L.kbText(l, "balance") }], [{ text: L.kbText(l, "prices") }, { text: L.kbText(l, "contact") }]],
  resize_keyboard: true,
  is_persistent: true,
});
const OWNER_URL = () => `https://t.me/${String(process.env.OWNER_USERNAME || "Print_54").replace(/^@/, "")}`;
// "Boshqa summa" so'roviga javobmi (har qaysi tilda)
const isAsk = (text) => L.ASK.some((a) => String(text || "").startsWith(a));

async function createTopup(bot, u, amount) {
  const l = await L.getLang(u.id);
  const card = payCard();
  if (!card) return { ok: false, error: L.T(l, "topupOff") };
  amount = Math.round(Number(amount) || 0);
  const w = await walletOf(u.id);
  if (amount > MAX_TOPUP) return { ok: false, error: L.T(l, "errMax") };
  if (amount < w.minTopup) return { ok: false, error: L.T(l, "errMin", L.sum(l, w.minTopup)) };
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
    text: cardText(card, { service: "topup", details, total: 0 }, payAmount, w.balance, l),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: L.T(l, "cancelBtn"), callback_data: `paycancel:${row.id}` }]] },
  }).catch((e) => ({ ok: false, description: String(e) }));
  if (!sent.ok) console.error("Karta xabarini yuborib bo'lmadi:", sent.description);
  else await supabase.from("orders").update({ details: { ...details, payMsg: sent.result.message_id } }).eq("id", row.id);
  return { ok: true, orderId: row.id, card: { number: card.number, name: card.name, price: payAmount, topup: amount, balance: w.balance } };
}

// "💳 Hisobni to'ldirish": balans va summa tanlovi
async function sendMenu(bot, chatId, userId) {
  const [w, l] = await Promise.all([walletOf(userId), L.getLang(userId)]);
  const opts = [w.minTopup, 10000, 20000, 50000].filter((x, i, a) => a.indexOf(x) === i);
  return telegram(bot, "sendMessage", {
    chat_id: chatId,
    text: L.T(l, "menu", { bal: L.sum(l, w.balance), first: L.sum(l, MIN_FIRST), next: L.sum(l, MIN_NEXT) }),
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        opts.slice(0, 2).map((a) => ({ text: L.sum(l, a), callback_data: `topup:${a}` })),
        opts.slice(2, 4).map((a) => ({ text: L.sum(l, a), callback_data: `topup:${a}` })),
        [{ text: L.T(l, "other"), callback_data: "topupask" }],
      ].filter((r) => r.length),
    },
  });
}

async function sendBalance(bot, chatId, userId) {
  const [w, l] = await Promise.all([walletOf(userId), L.getLang(userId)]);
  return telegram(bot, "sendMessage", {
    chat_id: chatId,
    text: L.T(l, "balance", L.sum(l, w.balance)),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: L.kbText(l, "topup"), callback_data: "topupmenu" }]] },
  });
}

async function askAmount(bot, chatId, userId) {
  const [w, l] = await Promise.all([walletOf(userId), L.getLang(userId)]);
  return telegram(bot, "sendMessage", {
    chat_id: chatId,
    text: L.T(l, "ask", L.sum(l, w.minTopup)),
    reply_markup: { force_reply: true, input_field_placeholder: L.T(l, "askHint") + (w.minTopup + 2000) },
  });
}

// "7 000", "7000 so'm" -> 7000
const parseAmount = (text) => {
  const digits = String(text || "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

// "💲 Narxlar": AI xizmatlar narxi (public/ai/prices.js) + hisoblash botida chop etish narxlari
async function sendPrices(bot, chatId, { print = false, topup = false, l = "uz" } = {}) {
  const fmtRow = (p) => `${p.icon} <b>${L.esc(L.tr(l, p.title))}</b> — ${L.esc(L.tr(l, p.text))}`;
  const lines = require("../../public/ai/prices").priceList().map(fmtRow);
  const printLines = print ? require("../../public/ai/print-prices").printList().map(fmtRow) : [];
  return telegram(bot, "sendMessage", {
    chat_id: chatId,
    text: [
      ...(print ? [L.T(l, "pricesPrintHead"), "", ...printLines, "", L.T(l, "pricesPrintNote"), "", ""] : []),
      L.T(l, "pricesHead"),
      "",
      ...lines,
      "",
      L.T(l, "pricesFoot"),
    ].join("\n"),
    parse_mode: "HTML",
    ...(topup ? { reply_markup: { inline_keyboard: [[{ text: L.kbText(l, "topup"), callback_data: "topupmenu" }]] } } : {}),
  });
}

// "💬 Bog'lanish": egasining Telegram akkaunti
async function sendContact(bot, chatId, l = "uz") {
  return telegram(bot, "sendMessage", {
    chat_id: chatId,
    text: L.T(l, "contact"),
    reply_markup: { inline_keyboard: [[{ text: L.T(l, "write"), url: OWNER_URL() }]] },
  });
}

module.exports = { keyboard, isAsk, sendPrices, sendContact, createTopup, sendMenu, sendBalance, askAmount, parseAmount };
