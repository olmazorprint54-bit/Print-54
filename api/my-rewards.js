// api/submit-order.js
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

function orderText(body) {
  const label = SERVICE_LABELS[body.service] || body.service;
  const lines = [`🧾 <b>Yangi buyurtma</b> — ${escapeHtml(label)}`];

  if (body.service === "paper") {
    lines.push(`Rang: ${body.color === "bw" ? "Oq-qora" : "Rangli"}`);
    lines.push(`Tur: ${body.side === "single" ? "Bir tomonlama" : "Ikki tomonlama"}`);
    lines.push(`Miqdor: ${body.qty} varaq`);
    if (body.freePagesUsed) lines.push(`🎁 Bepul varaqlardan foydalanildi: ${body.freePagesUsed}`);
  } else if (body.service === "book") {
    lines.push(`Format: ${escapeHtml(String(body.format).toUpperCase())}`);
    lines.push(`Rang: ${body.color === "bw" ? "Oq-qora" : "Rangli"}`);
    lines.push(`Sahifalar: ${body.qty} bet`);
  } else if (body.service === "binding") {
    lines.push(`Format: ${escapeHtml(String(body.format).toUpperCase())}`);
    lines.push(`Miqdor: ${body.qty} dona`);
  }

  lines.push(`💰 Jami: ${Number(body.total).toLocaleString("ru-RU")} so'm`);

  if (body.user) {
    const u = body.user;
    const name = escapeHtml([u.first_name, u.last_name].filter(Boolean).join(" "));
    lines.push("");
    lines.push(`👤 Mijoz: ${name}${u.username ? " (@" + escapeHtml(u.username) + ")" : ""}`);
  }

  return lines.join("\n");
}

async function sendTelegramMessage(text, orderId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.OWNER_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "✅ Buyurtma tayyor", callback_data: `done:${orderId}` }]],
      },
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error("Telegram API xatosi: " + JSON.stringify(data));
  }
  return data.result.message_id;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const freePagesUsed = Math.max(0, parseInt(body.freePagesUsed, 10) || 0);

    const { data: inserted, error } = await supabase
      .from("orders")
      .insert({
        service: body.service,
        color: body.color || null,
        side: body.side || null,
        format: body.format || null,
        qty: body.qty || null,
        total: body.total || null,
        free_pages_used: freePagesUsed,
        telegram_user_id: body.user ? body.user.id : null,
        telegram_username: body.user ? body.user.username : null,
        telegram_name: body.user
          ? [body.user.first_name, body.user.last_name].filter(Boolean).join(" ")
          : null,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    if (freePagesUsed > 0 && body.user && body.user.id) {
      const { data: userRow } = await supabase
        .from("users")
        .select("free_pages")
        .eq("telegram_user_id", body.user.id)
        .single();

      if (userRow) {
        const newBalance = Math.max(0, (userRow.free_pages || 0) - freePagesUsed);
        await supabase
          .from("users")
          .update({ free_pages: newBalance })
          .eq("telegram_user_id", body.user.id);
      }
    }

    const messageId = await sendTelegramMessage(orderText(body), inserted.id);

    await supabase
      .from("orders")
      .update({ telegram_message_id: messageId })
      .eq("id", inserted.id);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
};
