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
  referat: "Referat",
  lesson: "Dars ishlanma",
  test: "Test tuzish",
  questions: "Savollar tuzish",
  crossword: "Krossvord",
  resume: "Resume / CV",
};

// Har bir xizmatning "hajm" maydoni (orders.qty ga yoziladi)
const QTY_FIELD = { presentation: "slides", essay: "pages", referat: "pages", test: "count", questions: "count", crossword: "words" };

const BUCKET = "ai-uploads"; // mijoz rasmlari (api/ai-upload.js)
const MAX_PHOTOS = 10;
const LINK_TTL = 7 * 24 * 60 * 60; // rasm havolasi 7 kun amal qiladi

const MAX_LINES = 40;
const MAX_VALUE = 900; // resume tajribasi kabi uzun maydonlar uchun
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

// Buyurtmalarim'da ko'rinadigan qisqa nom (resume uchun — ism va lavozim)
function topicOf(fields) {
  return clean(fields.topic || [fields.name, fields.position].filter(Boolean).join(" — "), 200);
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

// Mijoz yuklagan rasmlar yo'li faqat o'zining papkasidan bo'lishi kerak
function cleanPhotos(photos, userId) {
  if (!userId || !Array.isArray(photos)) return [];
  const re = new RegExp("^" + parseInt(userId, 10) + "/[\\w-]+\\.jpg$");
  return [...new Set(photos.filter((p) => typeof p === "string" && re.test(p)))].slice(0, MAX_PHOTOS);
}

// Rasmlarni egasiga buyurtma xabariga javob qilib, albom ko'rinishida yuboradi
async function sendPhotosToOwner(paths, orderId, replyTo) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_TTL);
  if (error) throw error;
  const urls = data.map((x) => x.signedUrl).filter(Boolean);
  if (!urls.length) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.OWNER_CHAT_ID,
      media: urls.map((url, i) => ({
        type: "photo",
        media: url,
        ...(i === 0 ? { caption: `📷 Mijoz rasmlari${orderId ? " — #" + orderId : ""} (${urls.length} ta)` } : {}),
      })),
      ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
    }),
  });
  const out = await res.json();
  if (!out.ok) throw new Error("Telegram API xatosi: " + JSON.stringify(out));
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
    const photos = cleanPhotos(fields.photos, u && u.id);

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
        details: { topic: topicOf(fields), summary, ...(photos.length ? { photos } : {}) },
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
        .update({ telegram_message_id: messageId, details: { topic: topicOf(fields), summary, text, ...(photos.length ? { photos } : {}) } })
        .eq("id", orderId);
    }

    // Rasmlar yuborilmasa ham buyurtma qabul qilingan bo'ladi
    if (photos.length) {
      try {
        await sendPhotosToOwner(photos, orderId, messageId);
      } catch (err) {
        console.error("Mijoz rasmlarini yuborib bo'lmadi:", err);
      }
    }

    res.status(200).json({ ok: true, orderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "So'rovni yuborib bo'lmadi" });
  }
};
