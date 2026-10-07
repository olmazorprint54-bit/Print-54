// api/resume-pdf.js
// ---------------------------------------------------------------
// Resume buyurtmasini AI'siz, avtomatik PDF qiladi:
//   1) buyurtmadagi maydonlardan A4 sahifa (api/_lib/resume-html.js)
//   2) Chrome (serverda @sparticuz/chromium) orqali PDF
//   3) PDF egasiga buyurtma xabariga javob bo'lib, "✅ Mijozga
//      yuborish" tugmasi bilan boradi. Ega tekshirib tugmani bossa,
//      telegram-webhook.js faylni mijozga yetkazadi.
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


async function launchBrowser() {
  const puppeteer = require("puppeteer-core");
  if (process.env.LOCAL_CHROME) {
    return puppeteer.launch({ executablePath: process.env.LOCAL_CHROME, headless: true });
  }
  const chromium = require("@sparticuz/chromium");
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

async function sendPdfToOwner(order, pdf, name) {
  const form = new FormData();
  form.append("chat_id", String(process.env.OWNER_CHAT_ID));
  form.append("document", new Blob([pdf], { type: "application/pdf" }), fileName(name));
  form.append("caption", `🤖 Resume avtomatik tayyorlandi — #${order.id}\n\nTekshirib chiqing. Hammasi to'g'ri bo'lsa, tugmani bosing — fayl mijozga boradi. Tuzatish kerak bo'lsa, o'zingiz tayyorlab, buyurtma xabariga javob qilib yuboring.`);
  form.append("reply_markup", JSON.stringify({ inline_keyboard: [[{ text: "✅ Mijozga yuborish", callback_data: `aisend:${order.id}` }]] }));
  if (order.telegram_message_id) {
    form.append("reply_parameters", JSON.stringify({ message_id: order.telegram_message_id, allow_sending_without_reply: true }));
  }
  const out = await telegram("sendDocument", form);
  if (!out.ok) throw new Error("Telegram API xatosi: " + JSON.stringify(out));
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

    const d = resumeData(order.details.fields, await photoUrl(order));
    const pdf = await renderPdf(resumeHtml(d));
    await sendPdfToOwner(order, pdf, d.name);
    res.status(200).json({ ok: true, size: pdf.length });
  } catch (err) {
    console.error(err);
    // Avtomatik bo'lmadi — ega qo'lda tayyorlaydi
    await telegram("sendMessage", {
      chat_id: process.env.OWNER_CHAT_ID,
      text: `⚠️ #${orderId} resume'ni avtomatik tayyorlab bo'lmadi. Iltimos, qo'lda tayyorlab, buyurtma xabariga javob qilib yuboring.`,
      ...(order && order.telegram_message_id ? { reply_parameters: { message_id: order.telegram_message_id, allow_sending_without_reply: true } } : {}),
    }).catch(() => {});
    res.status(500).json({ ok: false });
  }
};

module.exports.renderPdf = renderPdf;
