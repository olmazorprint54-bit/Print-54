// api/_lib/feedback.js
// ---------------------------------------------------------------
// Tayyor fayl ostidagi g'amxo'rlik tugmalari:
//   ⭐ Baholash        — 1–5 yulduz; baho buyurtmaga (details.rating) yoziladi, shablon reytingi shundan
//                        hisoblanadi (galereyada keyingi mijozlarga ko'rinadi), egaga qisqa xabar boradi
//   🛠 Kamchilikni tuzatish — mijoz nima noto'g'ri ekanini yozadi (force_reply), so'rov egaga buyurtma xabariga
//                        javob bo'lib boradi; ega tuzatilgan faylni o'sha buyurtma xabariga javob qilib yuboradi
//   📞 Bog'lanish      — egasining Telegram'i
// ---------------------------------------------------------------
const { telegram, toOwner } = require("./bots");
const supabase = require("./db");

const OWNER_URL = () => `https://t.me/${String(process.env.OWNER_USERNAME || "Print_54").replace(/^@/, "")}`;
const TX = {
  uz: { rate: "⭐ Baholash", fix: "🛠 Kamchilikni tuzatish", contact: "📞 Bog'lanish", your: "✅ Bahoingiz", thanks: "Rahmat! Fikringiz keyingi mijozlar uchun muhim 🙏", low: "Kechirasiz, kutganingizdek chiqmagan bo'lsa 😔 Nimani yaxshilashimiz kerakligini yozing — tuzatib beramiz.", ask: "🛠 #{id} — kamchilikni yozib yuboring: qaysi slayd yoki qaysi qism, nima noto'g'ri. Shu xabarga javob qilib yozing 👇", got: "✅ So'rovingiz qabul qilindi. Tuzatib, faylni shu yerga qayta yuboramiz.", ph: "Masalan: 3-slayddagi sarlavha noto'g'ri" , notYours: "Bu buyurtma sizniki emas." },
  ru: { rate: "⭐ Оценить", fix: "🛠 Исправить недочёт", contact: "📞 Связаться", your: "✅ Ваша оценка", thanks: "Спасибо! Ваше мнение важно для следующих клиентов 🙏", low: "Извините, если результат не оправдал ожиданий 😔 Напишите, что улучшить — исправим.", ask: "🛠 #{id} — опишите недочёт: какой слайд или часть, что не так. Ответьте на это сообщение 👇", got: "✅ Запрос принят. Исправим и пришлём файл сюда.", ph: "Например: неверный заголовок на 3-м слайде", notYours: "Это не ваш заказ." },
  en: { rate: "⭐ Rate", fix: "🛠 Fix an issue", contact: "📞 Contact us", your: "✅ Your rating", thanks: "Thank you! Your feedback helps the next customers 🙏", low: "Sorry it wasn't what you expected 😔 Tell us what to improve — we'll fix it.", ask: "🛠 #{id} — describe the issue: which slide or part and what's wrong. Reply to this message 👇", got: "✅ Request received. We'll fix it and send the file here again.", ph: "E.g.: wrong title on slide 3", notYours: "This is not your order." },
};
const tx = (l) => TX[l] || TX.uz;

// Fayl ostidagi qatorlar
const rows = (orderId, l) => [
  [{ text: tx(l).rate, callback_data: `rt:${orderId}` }, { text: tx(l).fix, callback_data: `fx:${orderId}` }],
  [{ text: tx(l).contact, url: OWNER_URL() }],
];

async function ownOrder(id, userId) {
  const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  return data && String(data.telegram_user_id) === String(userId) ? data : null;
}
// klaviaturada rt:<id> qatorini almashtirish (boshqa tugmalar — Trend qo'shish va h.k. — saqlanadi)
function swapRow(kb, id, row) {
  const ik = ((kb && kb.inline_keyboard) || []).map((r) => r.slice());
  const at = ik.findIndex((r) => r.some((b) => b.callback_data && /^rt:\d+/.test(b.callback_data) && b.callback_data.split(":")[1] === String(id)));
  if (at >= 0) ik[at] = row; else ik.push(row);
  return { inline_keyboard: ik };
}

async function onCallback(cq, bot, l) {
  const answer = (text, alert) => telegram(bot, "answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text, show_alert: !!alert } : {}) }).catch(() => {});
  const m = /^(rt|fx):(\d+)(?::([1-5]))?$/.exec(cq.data || "");
  if (!m) { await answer(); return; }
  const [, kind, id, n] = m;
  const order = await ownOrder(id, cq.from.id);
  if (!order) { await answer(tx(l).notYours, true); return; }
  const msg = cq.message ? { chat_id: cq.message.chat.id, message_id: cq.message.message_id } : null;

  if (kind === "fx") {
    await answer();
    await telegram(bot, "sendMessage", { chat_id: cq.from.id, text: tx(l).ask.replace("{id}", id), reply_markup: { force_reply: true, input_field_placeholder: tx(l).ph } });
    return;
  }
  if (!n) { // yulduzlar qatorini ko'rsatish
    await answer();
    if (msg) await telegram(bot, "editMessageReplyMarkup", { ...msg, reply_markup: swapRow(cq.message.reply_markup, id, [1, 2, 3, 4, 5].map((k) => ({ text: `${k} ⭐`, callback_data: `rt:${id}:${k}` }))) }).catch(() => {});
    return;
  }
  const r = Number(n);
  const d = order.details || {};
  await supabase.from("orders").update({ details: { ...d, rating: r, ratedAt: new Date().toISOString() } }).eq("id", order.id);
  await answer(tx(l).thanks);
  if (msg) await telegram(bot, "editMessageReplyMarkup", { ...msg, reply_markup: swapRow(cq.message.reply_markup, id, [{ text: `${tx(l).your}: ${"⭐".repeat(r)}`, callback_data: "noop" }, { text: tx(l).fix, callback_data: `fx:${id}` }]) }).catch(() => {});
  if (r <= 3) await telegram(bot, "sendMessage", { chat_id: cq.from.id, text: tx(l).low, reply_markup: { inline_keyboard: [[{ text: tx(l).fix, callback_data: `fx:${id}` }], [{ text: tx(l).contact, url: OWNER_URL() }]] } }).catch(() => {});
  const who = [cq.from.first_name, cq.from.last_name].filter(Boolean).join(" ") + (cq.from.username ? ` (@${cq.from.username})` : "");
  const tpl = d.fields && d.fields.template ? ` · ${d.fields.template}` : "";
  await toOwner(bot, "sendMessage", { chat_id: process.env.OWNER_CHAT_ID, text: `${"⭐".repeat(r)} ${r}/5 — #${order.id} ${order.service}${tpl}\n👤 ${who}`, disable_notification: r >= 4 }).catch(() => {});
}

// Mijoz «🛠 #id — ...» xabariga javob yozdi — egaga yetkazamiz. true qaytsa xabar shu yerda tugadi.
async function onReply(msg, bot, l) {
  const r = msg.reply_to_message;
  if (!r || !r.from || !r.from.is_bot || !msg.text) return false;
  const m = /^🛠 #(\d+)/.exec(r.text || "");
  if (!m) return false;
  const order = await ownOrder(m[1], msg.from.id);
  if (!order) return false;
  const who = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") + (msg.from.username ? ` (@${msg.from.username})` : "");
  await toOwner(bot, "sendMessage", {
    chat_id: process.env.OWNER_CHAT_ID,
    text: `🛠 Tuzatish so'rovi — #${order.id} (${order.service})\n👤 ${who}\n\n${msg.text}\n\n↩️ Tuzatilgan faylni shu buyurtma xabariga javob qilib yuboring.`,
    ...(order.telegram_message_id ? { reply_parameters: { message_id: order.telegram_message_id, allow_sending_without_reply: true } } : {}),
  });
  const d = order.details || {};
  await supabase.from("orders").update({ details: { ...d, fixRequests: (d.fixRequests || []).concat([{ at: new Date().toISOString(), text: String(msg.text).slice(0, 1000) }]) } }).eq("id", order.id);
  await telegram(bot, "sendMessage", { chat_id: msg.chat.id, text: tx(l).got });
  return true;
}

module.exports = { rows, onCallback, onReply };
