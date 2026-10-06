// api/ai-request.js
// ---------------------------------------------------------------
// AI xizmatlari uchun so'rovlarni qabul qiladi va do'kon egasiga
// Telegram orqali yuboradi. Hozircha bazaga yozmaydi va hech qanday
// AI chaqirmaydi — API kalit ulangach, shu yerda hujjat yaratiladi.
// ---------------------------------------------------------------

const SERVICE_LABELS = {
  presentation: "Taqdimot",
  essay: "Mustaqil ish",
  lesson: "Dars ishlanma",
  test: "Test tuzish",
  questions: "Savollar tuzish",
  crossword: "Krossvord",
};

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

function requestText(body) {
  const label = SERVICE_LABELS[body.service];
  const lines = [`✨ <b>Yangi AI so'rov</b> — ${escapeHtml(label)}`, ""];

  const summary = Array.isArray(body.summary) ? body.summary.slice(0, MAX_LINES) : [];
  for (const item of summary) {
    if (!item || typeof item !== "object") continue;
    const key = clean(item.label, 80);
    const value = clean(item.value, MAX_VALUE);
    if (key && value) lines.push(`<b>${escapeHtml(key)}:</b> ${escapeHtml(value)}`);
  }

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

  let text = lines.join("\n");
  if (text.length > MAX_MESSAGE) text = text.slice(0, MAX_MESSAGE - 1) + "…";
  return text;
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

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.OWNER_CHAT_ID;
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: requestText(body),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = await tgRes.json();
    if (!data.ok) throw new Error("Telegram API xatosi: " + JSON.stringify(data));

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "So'rovni yuborib bo'lmadi" });
  }
};
