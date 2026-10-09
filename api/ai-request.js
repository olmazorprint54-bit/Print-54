// api/ai-request.js
// ---------------------------------------------------------------
// AI xizmatlari uchun buyurtmani qabul qiladi:
//   1) Supabase "orders" jadvaliga yozadi (mijoz "Buyurtmalarim"da
//      ko'radi)
//   2) Do'kon egasiga Telegram xabar yuboradi. Ega tayyor faylni shu
//      xabarga javob (reply) qilib yuborsa, telegram-webhook.js uni
//      mijozga yetkazadi.
// Hozircha AI chaqirilmaydi — API kalit ulangach, shu yerda hujjat
// yaratiladi. Resume (o'zimizning 3 dizayn, PDF) esa AI'siz,
// avtomatik tayyorlanadi — api/resume-pdf.js.
// ---------------------------------------------------------------

const { waitUntil } = require("@vercel/functions");
const { canAutoResume } = require("./_lib/resume-html");
const { canAutoObyektivka } = require("./_lib/obyektivka-docx");
const { canAutoTest } = require("./_lib/test-gen");
const { canAutoDoc } = require("./_lib/doc-gen");
const { canAutoPres } = require("./_lib/pres-gen");
const { priceOf, TRIAL } = require("../public/ai/prices");
const { FREE_DAILY, providerToken, createInvoice } = require("./_lib/pay");

// AI'siz avtomatik tayyorlanadigan xizmatlar (api/resume-pdf.js)
const AUTO = {
  resume: canAutoResume, obyektivka: canAutoObyektivka, test: canAutoTest,
  essay: (f) => canAutoDoc("essay", f), referat: (f) => canAutoDoc("referat", f), article: (f) => canAutoDoc("article", f), lesson: (f) => canAutoDoc("lesson", f),
  questions: (f) => canAutoDoc("questions", f), crossword: (f) => canAutoDoc("crossword", f),
  presentation: canAutoPres,
};
const { internalKey } = require("./_lib/internal-key");
const { MAIN, authUser, botKey, telegram, toOwner } = require("./_lib/bots");

const supabase = require("./_lib/db");

const SERVICE_LABELS = {
  presentation: "Taqdimot",
  essay: "Mustaqil ish",
  referat: "Referat",
  article: "Maqola",
  lesson: "Dars ishlanma",
  test: "Test tuzish",
  questions: "Savollar tuzish",
  crossword: "Krossvord",
  resume: "Resume / CV",
  obyektivka: "Obyektivka",
};

// Har bir xizmatning "hajm" maydoni (orders.qty ga yoziladi)
const QTY_FIELD = { presentation: "slides", essay: "pages", referat: "pages", article: "pages", test: "count", questions: "count", crossword: "words" };

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
  return clean(fields.topic || fields.fio || [fields.name, fields.position].filter(Boolean).join(" — "), 200);
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

  const price = body.price == null ? NaN : Number(body.price);
  lines.push("");
  lines.push(`💰 Narx: ${Number.isFinite(price) && price > 0 ? price.toLocaleString("ru-RU") + " so'm" : price === 0 ? "tekin" : "kelishiladi"}`);

  const u = body.user;
  if (u && u.id) {
    const name = escapeHtml([u.first_name, u.last_name].filter(Boolean).join(" ") || "Foydalanuvchi");
    const id = parseInt(u.id, 10);
    lines.push(`👤 Mijoz: <a href="tg://user?id=${id}">${name}</a>${u.username ? " (@" + escapeHtml(u.username) + ")" : ""}`);
  }
  if (body.bot && body.bot !== MAIN) lines.push(`🤖 Bot: ${escapeHtml(body.bot)}`);

  if (orderId && body.autoResume) {
    lines.push("");
    lines.push("🤖 <i>Fayl avtomatik tayyorlanib, mijozga o'zi yuboriladi. Chop etish uchun nusxasi shu yerga keladi.</i>");
  } else if (orderId) {
    lines.push("");
    lines.push("📎 <i>Tayyor faylni shu xabarga javob (Reply) qilib yuboring — mijozga avtomatik boradi.</i>");
  }

  let text = lines.join("\n");
  if (text.length > MAX_MESSAGE) text = text.slice(0, MAX_MESSAGE - 1) + "…";
  return text;
}

// Egaga xabar buyurtma kelgan botning o'zi orqali boradi — tayyor faylni
// o'sha xabarga javob qilib yuborsa, fayl shu bot orqali mijozga yetadi
async function sendToOwner(bot, text) {
  const data = await toOwner(bot, "sendMessage", {
    chat_id: process.env.OWNER_CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  if (!data.ok) throw new Error("Telegram API xatosi: " + JSON.stringify(data));
  return { id: data.result.message_id, via: data.via };
}

// Buyurtma maydonlarining nusxasi (avtomatik tayyorlash uchun)
function cleanFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {}).slice(0, 40)) {
    if (typeof v === "string") out[k] = v.slice(0, 2500);
    else if (typeof v === "boolean" || typeof v === "number") out[k] = v;
    else if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === "object")) {
      // qatorlar ro'yxati (masalan, obyektivkadagi qarindoshlar)
      out[k] = v.slice(0, 20).map((row) => {
        const r = {};
        for (const [rk, rv] of Object.entries(row).slice(0, 12)) {
          if (typeof rv === "string") r[rk] = rv.slice(0, 300);
          else if (typeof rv === "boolean") r[rk] = rv;
        }
        return r;
      });
    } else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string").slice(0, 20).map((x) => x.slice(0, 200));
  }
  return out;
}

// Resume PDF ni alohida funksiyada yasatamiz (Chrome og'ir — buyurtma kutmasin)
async function startResumePdf(req, orderId) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const res = await fetch(`${proto}://${req.headers.host}/api/resume-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": internalKey(orderId) },
    body: JSON.stringify({ orderId }),
  });
  if (!res.ok) console.error("resume-pdf xatosi:", res.status);
}

// To'lovsiz sinov rejimida mijozning so'nggi 24 soatdagi bepul AI buyurtmalari
async function trialsToday(userId) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await supabase.from("orders").select("id, details").eq("telegram_user_id", userId).gte("created_at", since);
  return (data || []).filter((o) => o.details && o.details.trial).length;
}

// Mijoz yuklagan rasmlar yo'li faqat o'zining papkasidan bo'lishi kerak
function cleanPhotos(photos, userId) {
  if (!userId || !Array.isArray(photos)) return [];
  const re = new RegExp("^" + parseInt(userId, 10) + "/[\\w-]+\\.jpg$");
  return [...new Set(photos.filter((p) => typeof p === "string" && re.test(p)))].slice(0, MAX_PHOTOS);
}

// Rasmlarni egasiga buyurtma xabariga javob qilib, albom ko'rinishida yuboradi
async function sendPhotosToOwner(bot, paths, orderId, replyTo) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_TTL);
  if (error) throw error;
  const urls = data.map((x) => x.signedUrl).filter(Boolean);
  if (!urls.length) return;
  const out = await telegram(bot, "sendMediaGroup", {
    chat_id: process.env.OWNER_CHAT_ID,
    media: urls.map((url, i) => ({
      type: "photo",
      media: url,
      ...(i === 0 ? { caption: `📷 Mijoz rasmlari${orderId ? " — #" + orderId : ""} (${urls.length} ta)` } : {}),
    })),
    ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
  });
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

    // Mijoz faqat Telegram imzosi (initData) orqali aniqlanadi — boshqa
    // birovning nomidan buyurtma berib bo'lmaydi. Telegram tashqarisidan
    // (oddiy brauzer) kelgan so'rov mijozsiz qabul qilinadi.
    const auth = authUser(body);
    if (body.initData && !auth) {
      res.status(401).json({ ok: false, error: "Ilovani yopib, qayta oching" });
      return;
    }
    const u = auth ? auth.user : null;
    const bot = auth ? auth.bot : botKey(body.bot);
    body.user = u;
    body.bot = bot;

    const summary = cleanSummary(body.summary);
    const fields = body.fields || {};
    const qty = parseInt(fields[QTY_FIELD[body.service]], 10);
    const photos = cleanPhotos(fields.photos, u && u.id);
    const saved = cleanFields({ ...fields, photos });
    body.autoResume = !!(AUTO[body.service] && AUTO[body.service](saved));

    // Narx serverda hisoblanadi (public/ai/prices.js) — mijoz yuborganiga ishonilmaydi.
    // null — kelishiladi (qo'lda), 0 — tekin.
    const known = priceOf(body.service, saved);
    const price = known != null
      ? (known === 0 || body.autoResume ? known : NaN)
      : body.price == null ? NaN : Number(body.price);
    body.price = Number.isFinite(price) ? price : null;

    // Pullik avtomatik xizmat: avval to'lov (Click/Payme). To'lov ulanmagan
    // bo'lsa — sinov rejimi: to'lovsiz, lekin mijozga kuniga FREE_DAILY ta.
    const paid = !!(body.autoResume && price > 0);
    if (paid && !u) body.autoResume = false; // Telegram'siz — qo'lda
    const payNow = paid && !!u && !!providerToken() && !TRIAL;
    const trial = paid && !!u && !payNow;
    // Bot egasi (OWNER_CHAT_ID) sinab ko'rishi uchun limit yo'q
    const isOwner = !!u && String(u.id) === String(process.env.OWNER_CHAT_ID || "").trim();
    if (trial && !isOwner && (await trialsToday(u.id)) >= FREE_DAILY) {
      res.status(429).json({ ok: false, error: `Bepul sinov limiti (sutkasiga ${FREE_DAILY} ta) tugadi. Birozdan so'ng yana urinib ko'ring.` });
      return;
    }
    const flags = { ...(payNow ? { awaitingPayment: true } : {}), ...(trial ? { trial: true, listPrice: price } : {}) };

    // Bazaga yozamiz. Yozib bo'lmasa ham (masalan, jadval ustunlari hali
    // qo'shilmagan bo'lsa) buyurtma yo'qolmasin — egasiga baribir yuboramiz.
    let orderId = null;
    const { data: inserted, error } = await supabase
      .from("orders")
      .insert({
        service: body.service,
        qty: Number.isFinite(qty) ? qty : null,
        total: trial ? 0 : Number.isFinite(price) && price >= 0 ? price : null,
        telegram_user_id: u ? u.id : null,
        telegram_username: u ? u.username || null : null,
        telegram_name: u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : null,
        status: "active",
        details: { bot, topic: topicOf(fields), summary, fields: saved, ...(photos.length ? { photos } : {}), ...flags },
      })
      .select()
      .single();
    if (error) console.error("AI buyurtmani bazaga yozib bo'lmadi:", error);
    else orderId = inserted.id;

    // To'lov kutilmoqda: egaga hech narsa yuborilmaydi; to'lov o'tgach
    // telegram-webhook.js AI'ni ishga tushiradi
    if (payNow) {
      if (!orderId) throw new Error("Buyurtmani bazaga yozib bo'lmadi");
      const details = { bot, topic: topicOf(fields), summary, fields: saved, ...(photos.length ? { photos } : {}), ...flags };
      details.manualText = requestText({ ...body, autoResume: false }, summary, orderId);
      const link = await createInvoice(bot, { id: orderId, service: body.service, details }, price);
      await supabase.from("orders").update({ details: { ...details, invoice: link } }).eq("id", orderId);
      res.status(200).json({ ok: true, orderId, auto: true, pay: link, price });
      return;
    }

    // Avtomatik resume egaga kelmaydi — faqat chop etish so'ralsa (yoki
    // avtomatik bo'lmasa, resume-pdf.js manualText ni yuboradi)
    const auto = !!(orderId && body.autoResume);
    const wantsPrint = !!(fields.print && fields.print !== "none");
    const details = { bot, topic: topicOf(fields), summary, fields: saved, ...(photos.length ? { photos } : {}), ...flags };
    if (auto) details.manualText = requestText({ ...body, autoResume: false }, summary, orderId);

    let messageId = null;
    if (!auto || wantsPrint) {
      details.text = requestText(body, summary, orderId);
      const sent = await sendToOwner(bot, details.text);
      messageId = sent.id;
      details.ownerBot = sent.via; // egasi faylni shu botdagi xabarga javob qiladi
    }

    if (orderId) {
      await supabase
        .from("orders")
        .update({ telegram_message_id: messageId, details })
        .eq("id", orderId);
    }

    // Rasmlar yuborilmasa ham buyurtma qabul qilingan bo'ladi (avtomatik
    // resume'da rasm PDF ichida — alohida yuborilmaydi)
    if (photos.length && !auto) {
      try {
        await sendPhotosToOwner(details.ownerBot || bot, photos, orderId, messageId);
      } catch (err) {
        console.error("Mijoz rasmlarini yuborib bo'lmadi:", err);
      }
    }

    if (auto) waitUntil(startResumePdf(req, orderId).catch((err) => console.error(err)));

    res.status(200).json({ ok: true, orderId, auto });
  } catch (err) {
    console.error(err);
    // Sababi egaga ham boradi — Vercel loglarini ochmasdan ko'rish uchun
    const why = String((err && err.message) || err).replace(/[<>&]/g, "").slice(0, 300);
    try {
      const b = req.body || {};
      await toOwner(botKey(b.bot), "sendMessage", { chat_id: process.env.OWNER_CHAT_ID, text: `🛑 <b>AI so'rovda xato</b> (${SERVICE_LABELS[b.service] || b.service || "?"})\n<code>${why}</code>`, parse_mode: "HTML" });
    } catch (e) { console.error(e); }
    res.status(500).json({ ok: false, error: "So'rovni yuborib bo'lmadi", why: why.slice(0, 120) });
  }
};
