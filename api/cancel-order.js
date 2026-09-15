// api/cancel-order.js
// ---------------------------------------------------------------
// Mijoz "Buyurtmalarim" bo'limidan o'z buyurtmasini bekor qiladi:
//   1) Buyurtma haqiqatan shu mijozniki ekanini tekshiradi
//   2) Supabase'da statusni "cancelled" qiladi
//   3) Agar buyurtmada bepul varaqlar ishlatilgan bo'lsa, ularni
//      mijozning balansiga qaytarib qo'shadi
//   4) Sizga yuborilgan Telegram xabarini "bekor qilindi" deb
//      tahrirlaydi (matn ustidan chiziq bilan)
// ---------------------------------------------------------------

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
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

async function editTelegramMessage(messageId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.OWNER_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/editMessageText`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [] },
    }),
  });

  const data = await res.json();
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
    const { orderId, userId } = req.body || {};
    if (!orderId || !userId) {
      res.status(400).json({ ok: false, error: "orderId va userId kerak" });
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
      const strikedText = `<s>${orderText(order)}</s>\n\n❌ <b>Mijoz tomonidan bekor qilindi</b>`;
      await editTelegramMessage(order.telegram_message_id, strikedText);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
};
