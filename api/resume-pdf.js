// api/resume-pdf.js
// ---------------------------------------------------------------
// Resume buyurtmasini AI'siz, avtomatik PDF qiladi:
//   1) buyurtmadagi maydonlardan A4 sahifa (api/_lib/resume-html.js)
//   2) Chrome (serverda @sparticuz/chromium) orqali PDF
//   3) PDF to'g'ridan-to'g'ri mijozga boradi, buyurtma bajariladi.
//      Ega faqat chop etish so'ralganda yoki xato bo'lganda xabar oladi.
// Faqat ai-request.js chaqiradi (ichki imzo bilan).
// ---------------------------------------------------------------

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { resumeData, resumeHtml } = require("./_lib/resume-html");
const { internalKey } = require("./_lib/internal-key");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = "ai-uploads";


// Ikkala paket ham ESM — require() o'rniga import() (Vercel'dagi Node
// versiyasi ESM ni require() bilan yuklay olmaydi)
async function launchBrowser() {
  const { default: puppeteer } = await import("puppeteer-core");
  if (process.env.LOCAL_CHROME) {
    return puppeteer.launch({ executablePath: process.env.LOCAL_CHROME, headless: true });
  }
  const { default: chromium } = await import("@sparticuz/chromium");
  chromium.setGraphicsMode = false;
  return puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
}

async function renderPdf(html) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 25000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    });
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  } finally {
    await browser.close();
  }
}

async function photoUrl(order) {
  const path = order.details && Array.isArray(order.details.photos) && order.details.photos[0];
  if (!path) return "";
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  return (data && data.signedUrl) || "";
}

const fileName = (name) => `Resume - ${String(name || "mijoz").replace(/[\\/:*?"<>|]+/g, "").slice(0, 60)}.pdf`;

async function telegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, body instanceof FormData
    ? { method: "POST", body }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

function pdfForm(chatId, pdf, name, caption, replyTo) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", new Blob([pdf], { type: "application/pdf" }), fileName(name));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  if (replyTo) form.append("reply_parameters", JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
  return form;
}

// Tayyor PDF to'g'ridan-to'g'ri mijozga boradi; buyurtma bajarilgan bo'ladi.
// Chop etish so'ralgan bo'lsa yoki mijozga yetmasa — nusxa egaga ham boradi.
async function deliver(order, pdf, name) {
  const fields = order.details.fields;
  const wantsPrint = fields.print && fields.print !== "none";
  let doc = null;
  if (order.telegram_user_id) {
    const sent = await telegram("sendDocument", pdfForm(order.telegram_user_id, pdf, name,
      `🎉 <b>Resume'ingiz tayyor!</b>\n\nFaylni istalgan vaqtda "Buyurtmalarim" bo'limidan ham qayta olishingiz mumkin.${wantsPrint ? "\n\n🖨 Chop etilgan nusxasini do'konimizdan olib ketishingiz mumkin." : ""}`));
    if (sent.ok) doc = sent.result.document;
  }

  if (wantsPrint || !doc) {
    const sent = await telegram("sendDocument", pdfForm(process.env.OWNER_CHAT_ID, pdf, name,
      doc
        ? `🖨 <b>Chop etish uchun</b> — #${order.id} (${fields.print === "color" ? "rangli" : "oq-qora"})\nResume avtomatik tayyorlanib, mijozga yuborildi.`
        : `⚠️ #${order.id} — resume tayyor, lekin mijozga yuborib bo'lmadi (botni bloklagan bo'lishi mumkin). U "Buyurtmalarim"dan olishi mumkin.`,
      order.telegram_message_id));
    if (!doc && sent.ok) doc = sent.result.document;
  }
  if (!doc) throw new Error("PDF hech kimga yuborilmadi");

  await supabase
    .from("orders")
    .update({ status: "completed", file_id: doc.file_id, file_name: doc.file_name || fileName(name) })
    .eq("id", order.id);
}

// Avtomatik bo'lmadi — buyurtma egaga oddiy (qo'lda bajariladigan) ko'rinishda boradi
async function fallbackToOwner(orderId, order, reason) {
  const manual = order && order.details && order.details.manualText;
  const why = reason ? `\n<i>Sabab: ${String(reason).replace(/[<>&]/g, "").slice(0, 200)}</i>` : "";
  const warn = `⚠️ <b>Resume'ni avtomatik tayyorlab bo'lmadi</b> — iltimos, qo'lda tayyorlang.${why}`;
  if (manual && !order.telegram_message_id) {
    const sent = await telegram("sendMessage", { chat_id: process.env.OWNER_CHAT_ID, text: `${warn}\n\n${manual}`, parse_mode: "HTML", disable_web_page_preview: true });
    if (sent.ok) {
      await supabase
        .from("orders")
        .update({ telegram_message_id: sent.result.message_id, details: { ...order.details, text: manual } })
        .eq("id", order.id);
    }
    return;
  }
  await telegram("sendMessage", {
    chat_id: process.env.OWNER_CHAT_ID,
    text: `${warn}\n#${orderId} — tayyor faylni buyurtma xabariga javob qilib yuboring.`,
    parse_mode: "HTML",
    ...(order && order.telegram_message_id ? { reply_parameters: { message_id: order.telegram_message_id, allow_sending_without_reply: true } } : {}),
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const orderId = parseInt((req.body || {}).orderId, 10);
  const key = String(req.headers["x-internal-key"] || "");
  const expected = internalKey(orderId);
  if (!orderId || key.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expected))) {
    res.status(403).json({ ok: false });
    return;
  }

  let order = null;
  try {
    const found = await supabase.from("orders").select("*").eq("id", orderId).single();
    order = found.data;
    if (!order || order.service !== "resume" || !order.details || !order.details.fields) throw new Error("Resume buyurtma topilmadi: " + orderId);
    if (order.status === "cancelled") {
      res.status(200).json({ ok: true, skipped: "cancelled" });
      return;
    }

    const d = resumeData(order.details.fields, await photoUrl(order));
    const pdf = await renderPdf(resumeHtml(d));
    await deliver(order, pdf, d.name);
    res.status(200).json({ ok: true, size: pdf.length });
  } catch (err) {
    console.error(err);
    await fallbackToOwner(orderId, order, err && err.message).catch((e) => console.error(e));
    res.status(500).json({ ok: false });
  }
};

module.exports.renderPdf = renderPdf;
