// api/telegram-webhook.js
// ---------------------------------------------------------------
// Telegram'dan kelgan yangilanishlarni (bosilgan tugmalarni) qabul
// qiladi. Hozircha faqat "✅ Buyurtma tayyor" tugmasini qayta
// ishlaydi: buyurtmani "completed" deb belgilaydi va xabarni
// yangilaydi.
// ---------------------------------------------------------------

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function orderText(o) {
  const lines = [`🧾 <b>Yangi buyurtma</b> (${escapeHtml(o.service)})`];

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

async function callTelegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

module.exports = async (req, res) => {
  try {
    const update = req.body || {};
    const cq = update.callback_query;

    if (cq && cq.data && cq.data.startsWith("done:")) {
      const orderId = cq.data.split(":")[1];

      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (!error && order && order.status !== "completed") {
        await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);

        const newText = `${orderText(order)}\n\n✅ <b>Buyurtma tayyor</b>`;
        await callTelegram("editMessageText", {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          text: newText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [] },
        });
      }

      await callTelegram("answerCallbackQuery", {
        callback_query_id: cq.id,
        text: "Bajarildi deb belgilandi ✅",
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(200).json({ ok: true }); // Telegram qayta urinmasligi uchun har doim 200 qaytaramiz
  }
};
