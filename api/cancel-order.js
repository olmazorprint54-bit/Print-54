// api/cancel-order.js
// ---------------------------------------------------------------
// Mijoz "Buyurtmalarim" bo'limidan o'z buyurtmasini bekor qiladi:
//   1) Buyurtma haqiqatan shu mijozniki ekanini tekshiradi (Telegram
//      imzosi — initData bo'yicha)
//   2) Supabase'da statusni "cancelled" qiladi
//   3) Agar buyurtmada bepul varaqlar ishlatilgan bo'lsa, ularni
//      mijozning balansiga qaytarib qo'shadi
//   4) Sizga yuborilgan Telegram xabarini "bekor qilindi" deb
//      tahrirlaydi (matn ustidan chiziq bilan)
// ---------------------------------------------------------------


const { authUser, orderBot, botKey, telegram } = require("./_lib/bots");

const supabase = require("./_lib/db");
const SERVICE_LABELS = { paper: "Qog'oz chop etish", book: "Kitob chiqarish", binding: "Pereplyot" };
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function orderText(o) {
  const label = SERVICE_LABELS[o.service] || o.service;
  const lines = [`🧾 <b>Yangi buyurtma</b> — ${escapeHtml(label)}`];

  if (o.service === "paper") {
    lines.push(`Rang: ${o.color === "bw" ? "Oq-qora" : "Rangli"}`);
    lines.push(`Tur: ${o.side === "single" ? "Bir tomonlama" : "Ikki tomonlama"}`);
    lines.push(`Miqdor: ${o.qty} varaq`);
  } else if (o.service === "book") {
    lines.push(`Format: ${escapeHtml(String(o.format).toUpperCase())}`);
    lines.push(`Rang: ${o.color === "bw" ? "Oq-qora" : "Rangli"}`);
    lines.push(`Sahifalar: ${o.qty} bet`);
  } else if (o.service === "binding") {
    lines.push(`Format: ${escapeHtml(String(o.format).toUpperCase())}`);
    lines.push(`Miqdor: ${o.qty} dona`);
  }

  lines.push(`💰 Jami: ${Number(o.total).toLocaleString("ru-RU")} so'm`);

  const name = escapeHtml(o.telegram_name || "");
  lines.push("");
  lines.push(`👤 Mijoz: ${name}${o.telegram_username ? " (@" + escapeHtml(o.telegram_username) + ")" : ""}`);

  return lines.join("\n");
}

// Egaga yuborilgan xabar qaysi bot orqali ketgan bo'lsa, o'sha bot tahrirlaydi
async function editTelegramMessage(bot, messageId, text) {
  const data = await telegram(bot, "editMessageText", {
    chat_id: process.env.OWNER_CHAT_ID,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] },
  });
  if (!data.ok) {
    // Xabar juda eski bo'lsa yoki allaqachon o'zgargan bo'lsa Telegram
    // xato qaytarishi mumkin — buni buyurtmani bekor qilishga
    // to'sqinlik qilmasligi uchun faqat log qilamiz.
    console.error("Telegram editMessageText xatosi:", data);
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const auth = authUser(req.body);
    if (!auth) {
      res.status(401).json({ ok: false, error: "Ilovani yopib, qayta oching" });
      return;
    }
    const userId = auth.user.id;
    const orderId = parseInt((req.body || {}).orderId, 10);
    if (!orderId) {
      res.status(400).json({ ok: false, error: "orderId kerak" });
      return;
    }

    // Buyurtma haqiqatan shu foydalanuvchiniki ekanini tekshiramiz
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("telegram_user_id", userId)
      .single();

    if (fetchError || !order) {
      res.status(404).json({ ok: false, error: "Buyurtma topilmadi" });
      return;
    }

    if (order.status === "cancelled") {
      res.status(200).json({ ok: true }); // allaqachon bekor qilingan
      return;
    }

    // Kartaga to'lab chek yuborgan — egasi tekshirmoqda, bekor qilinmaydi
    const d = order.details || {};
    if (d.spent && !d.awaitingPayment) {
      res.status(409).json({ ok: false, error: "Buyurtma balansdan to'langan va AI tayyorlamoqda — bekor qilib bo'lmaydi." });
      return;
    }
    if (d.awaitingPayment && d.payMethod === "card" && d.receipt) {
      res.status(409).json({ ok: false, error: "Chek yuborilgan — to'lov tekshirilmoqda. Savol bo'lsa, biz bilan bog'laning." });
      return;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (updateError) throw updateError;

    // Agar bu buyurtmada bepul varaqlar ishlatilgan bo'lsa,
    // ularni mijozning balansiga qaytarib qo'shamiz
    const usedFree = order.free_pages_used || 0;
    if (usedFree > 0) {
      const { data: userRow } = await supabase
        .from("users")
        .select("free_pages")
        .eq("telegram_user_id", userId)
        .single();

      if (userRow) {
        await supabase
          .from("users")
          .update({ free_pages: (userRow.free_pages || 0) + usedFree })
          .eq("telegram_user_id", userId);
      }
    }

    if (order.telegram_message_id) {
      // AI buyurtmalarda egaga yuborilgan asl matn details.text da saqlanadi
      const original = order.details && order.details.text ? order.details.text : orderText(order);
      const strikedText = `<s>${original}</s>\n\n❌ <b>Mijoz tomonidan bekor qilindi</b>`;
      const ownerBot = botKey((order.details && order.details.ownerBot) || orderBot(order));
      await editTelegramMessage(ownerBot, order.telegram_message_id, strikedText);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Buyurtmani bekor qilib bo'lmadi" });
  }
};
