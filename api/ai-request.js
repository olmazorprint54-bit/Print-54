// api/ai-request.js
// ---------------------------------------------------------------
// AI xizmatlari uchun buyurtmani qabul qiladi:
//   1) Supabase "orders" jadvaliga yozadi (mijoz "Buyurtmalarim"da
//      ko'radi)
//   2) Do'kon egasiga Telegram xabar yuboradi. Ega tayyor faylni shu
//      xabarga javob (reply) qilib yuborsa, telegram-webhook.js uni
//      mijozga yetkazadi.
// Hozircha AI chaqirilmaydi — API kalit ulangach, shu yerda hujjat
// yaratiladi.
// ---------------------------------------------------------------

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SERVICE_LABELS = {
  presentation: "Taqdimot",
  essay: "Mustaqil ish",
  lesson: "Dars ishlanma",
  test: "Test tuzish",
  questions: "Savollar tuzish",
  crossword: "Krossvord",
};

// Har bir xizmatning "hajm" maydoni (orders.qty ga yoziladi)
const QTY_FIELD = { presentation: "slides", essay: "pages", test: "count", questions: "count", crossword: "words" };

const MAX_LINES = 40;
const MAX_VALUE = 600;
const MAX_MESSAGE = 4000; // Telegram chegarasi 4096

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clean(value, max) {
  const s = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function cleanSummary(summary) {
  return (Array.isArray(summary) ? summary.slice(0, MAX_LINES) : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => ({ label: clean(item.label, 80), value: clean(item.value, MAX_VALUE) }))
    .filter((item) => item.label && item.value);
}

function requestText(body, summary, orderId) {
  const label = SERVICE_LABELS[body.service];
  const lines = [`✨ <b>Yangi AI buyurtma${orderId ? " #" + orderId : ""}</b> — ${escapeHtml(label)}`, ""];

  for (const item of summary) lines.push(`<b>${escapeHtml(item.label)}:</b> ${escapeHtml(item.value)}`);

  // Uzun matn (savollar uchun manba yoki krossvord so'zlari) alohida
  const longText = body.fields && (body.fields.source || body.fields.custom);
  if (longText) {
    lines.push("");
    lines.push("<b>Foydalanuvchi matni:</b>");
    lines.push(escapeHtml(String(longText).slice(0, 1500)));
  }

  const price = Number(body.price);
  lines.push("");
  lines.push(`💰 Narx: ${Number.isFinite(price) && price > 0 ? price.toLocaleString("ru-RU") + " so'm" : "kelishiladi"}`);

  const u = body.user;
  if (u && u.id) {
    const name = escapeHtml([u.first_name, u.last_name].filter(Boolean).join(" ") || "Foydalanuvchi");
    const id = parseInt(u.id, 10);
    lines.push(`👤 Mijoz: <a href="tg://user?id=${id}">${name}</a>${u.username ? " (@" + escapeHtml(u.username) + ")" : ""}`);
  }

  if (orderId) {
    lines.push("");
    lines.push("📎 <i>Tayyor faylni shu xabarga javob (Reply) qilib yuboring — mijozga avtomatik boradi.</i>");
  }

  let text = lines.join("\n");
  if (text.length > MAX_MESSAGE) text = text.slice(0, MAX_MESSAGE - 1) + "…";
  return text;
}

async function sendToOwner(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.OWNER_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error("Telegram API xatosi: " + JSON.stringify(data));
  return data.result.message_id;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    if (!SERVICE_LABELS[body.service]) {
      res.status(400).json({ ok: false, error: "Noto'g'ri so'rov" });
      return;
    }

    const summary = cleanSummary(body.summary);
    const fields = body.fields || {};
    const u = body.user && body.user.id ? body.user : null;
    const price = Number(body.price);
    const qty = parseInt(fields[QTY_FIELD[body.service]], 10);

    // Bazaga yozamiz. Yozib bo'lmasa ham (masalan, jadval ustunlari hali
    // qo'shilmagan bo'lsa) buyurtma yo'qolmasin — egasiga baribir yuboramiz.
    let orderId = null;
    const { data: inserted, error } = await supabase
      .from("orders")
      .insert({
        service: body.service,
        qty: Number.isFinite(qty) ? qty : null,
        total: Number.isFinite(price) && price > 0 ? price : null,
        telegram_user_id: u ? u.id : null,
        telegram_username: u ? u.username || null : null,
        telegram_name: u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : null,
        status: "active",
        details: { topic: clean(fields.topic, 200), summary },
      })
      .select()
      .single();
    if (error) console.error("AI buyurtmani bazaga yozib bo'lmadi:", error);
    else orderId = inserted.id;

    const text = requestText(body, summary, orderId);
    const messageId = await sendToOwner(text);

    if (orderId) {
      await supabase
        .from("orders")
        .update({ telegram_message_id: messageId, details: { topic: clean(fields.topic, 200), summary, text } })
        .eq("id", orderId);
    }

    res.status(200).json({ ok: true, orderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "So'rovni yuborib bo'lmadi" });
  }
};
