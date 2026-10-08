// api/resume-pdf.js
// ---------------------------------------------------------------
// Resume buyurtmasini AI'siz, avtomatik PDF qiladi:
//   1) buyurtmadagi maydonlardan A4 sahifa (api/_lib/resume-html.js)
//   2) Chrome (serverda @sparticuz/chromium) orqali PDF
//   3) PDF to'g'ridan-to'g'ri mijozga boradi, buyurtma bajariladi.
//      Ega faqat chop etish so'ralganda yoki xato bo'lganda xabar oladi.
//      Hammasi buyurtma kelgan bot orqali boradi (api/_lib/bots.js).
// Faqat ai-request.js chaqiradi (ichki imzo bilan).
// ---------------------------------------------------------------

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { resumeData, resumeHtml } = require("./_lib/resume-html");
const { internalKey } = require("./_lib/internal-key");
const { buildObyektivka } = require("./_lib/obyektivka-docx");
const { orderBot, telegram, toOwner } = require("./_lib/bots");

// Avtomatik tayyorlanadigan xizmatlar (mijozga boradigan izoh uchun)
const READY = { resume: "Resume'ingiz", obyektivka: "Obyektivkangiz" };

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

// Chrome'ni ishga tushirish eng ko'p CPU oladi — server "issiq" turgan
// paytda keyingi buyurtmalar ochiq brauzerdan foydalanadi
let browserPromise = null;
async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.connected) return b;
  }
  browserPromise = launchBrowser();
  return browserPromise;
}

async function renderPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 25000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (window.__fit) window.__fit();
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    });
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  } finally {
    await page.close().catch(() => {});
    // lokal sinovlarda jarayon tugashi uchun brauzer yopiladi
    if (process.env.LOCAL_CHROME) {
      browserPromise = null;
      await browser.close();
    }
  }
}

async function photoUrl(order) {
  const path = order.details && Array.isArray(order.details.photos) && order.details.photos[0];
  if (!path) return "";
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  return (data && data.signedUrl) || "";
}

const fileName = (name) => `Resume - ${String(name || "mijoz").replace(/[\\/:*?"<>|]+/g, "").slice(0, 60)}.pdf`;

// file: { buffer, name, mime }
function docForm(chatId, file, caption, replyTo) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", new Blob([file.buffer], { type: file.mime }), file.name);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  if (replyTo) form.append("reply_parameters", JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
  return form;
}

// Tayyor fayl to'g'ridan-to'g'ri mijozga boradi; buyurtma bajarilgan bo'ladi.
// Chop etish so'ralgan bo'lsa yoki mijozga yetmasa — nusxa egaga ham boradi.
async function deliver(order, file) {
  const what = READY[order.service] || "Faylingiz";
  const fields = order.details.fields;
  const wantsPrint = fields.print && fields.print !== "none";
  const bot = orderBot(order);
  let doc = null;
  let fileBot = bot; // file_id faqat o'sha botda ishlaydi
  if (order.telegram_user_id) {
    const sent = await telegram(bot, "sendDocument", docForm(order.telegram_user_id, file,
      `🎉 <b>${what} tayyor!</b>\n\nFaylni istalgan vaqtda "Buyurtmalarim" bo'limidan ham qayta olishingiz mumkin.${wantsPrint ? "\n\n🖨 Chop etilgan nusxasini do'konimizdan olib ketishingiz mumkin." : ""}`));
    if (sent.ok) doc = sent.result.document;
  }

  if (wantsPrint || !doc) {
    const sent = await toOwner(bot, "sendDocument", docForm(process.env.OWNER_CHAT_ID, file,
      doc
        ? `🖨 <b>Chop etish uchun</b> — #${order.id} (${fields.print === "color" ? "rangli" : "oq-qora"})\nFayl avtomatik tayyorlanib, mijozga yuborildi.`
        : `⚠️ #${order.id} — fayl tayyor, lekin mijozga yuborib bo'lmadi (botni bloklagan bo'lishi mumkin). U "Buyurtmalarim"dan olishi mumkin.`,
      order.telegram_message_id));
    if (!doc && sent.ok) {
      doc = sent.result.document;
      fileBot = sent.via;
    }
  }
  if (!doc) throw new Error("Fayl hech kimga yuborilmadi");

  await supabase
    .from("orders")
    .update({ status: "completed", file_id: doc.file_id, file_name: doc.file_name || file.name, details: { ...order.details, fileBot } })
    .eq("id", order.id);
}

// Avtomatik bo'lmadi — buyurtma egaga oddiy (qo'lda bajariladigan) ko'rinishda boradi
async function fallbackToOwner(orderId, order, reason) {
  const manual = order && order.details && order.details.manualText;
  const why = reason ? `\n<i>Sabab: ${String(reason).replace(/[<>&]/g, "").slice(0, 200)}</i>` : "";
  const warn = `⚠️ <b>Avtomatik tayyorlab bo'lmadi</b> — iltimos, qo'lda tayyorlang.${why}`;
  if (manual && !order.telegram_message_id) {
    const sent = await toOwner(orderBot(order), "sendMessage", { chat_id: process.env.OWNER_CHAT_ID, text: `${warn}\n\n${manual}`, parse_mode: "HTML", disable_web_page_preview: true });
    if (sent.ok) {
      await supabase
        .from("orders")
        .update({ telegram_message_id: sent.result.message_id, details: { ...order.details, text: manual, ownerBot: sent.via } })
        .eq("id", order.id);
    }
    return;
  }
  const ownerBot = (order && order.details && order.details.ownerBot) || orderBot(order);
  await toOwner(ownerBot, "sendMessage", {
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
    if (!order || !READY[order.service] || !order.details || !order.details.fields) throw new Error("Avtomatik buyurtma topilmadi: " + orderId);
    if (order.status === "cancelled") {
      res.status(200).json({ ok: true, skipped: "cancelled" });
      return;
    }

    let file;
    if (order.service === "obyektivka") {
      // Word fayl — Chrome kerak emas; 3x4 rasm hujjat ichiga joylanadi
      const url = await photoUrl(order);
      const photo = url ? Buffer.from(await (await fetch(url)).arrayBuffer()) : null;
      const doc = await buildObyektivka(order.details.fields, photo);
      file = { buffer: doc.buffer, name: doc.fileName, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    } else {
      const d = resumeData(order.details.fields, await photoUrl(order));
      const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
      file = { buffer: await renderPdf(resumeHtml(d, origin)), name: fileName(d.name), mime: "application/pdf" };
    }
    await deliver(order, file);
    // rasm PDF ichida — omborda saqlash shart emas (bepul joy 1 GB)
    if (order.details.photos && order.details.photos.length) {
      await supabase.storage.from(BUCKET).remove(order.details.photos).catch((e) => console.error(e));
    }
    res.status(200).json({ ok: true, size: file.buffer.length });
  } catch (err) {
    console.error(err);
    await fallbackToOwner(orderId, order, err && err.message).catch((e) => console.error(e));
    res.status(500).json({ ok: false });
  }
};

module.exports.renderPdf = renderPdf;
