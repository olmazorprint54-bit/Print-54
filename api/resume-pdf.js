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
const { resumeData, resumeHtml } = require("./_lib/resume-html");
const { internalKey } = require("./_lib/internal-key");
const { buildObyektivka } = require("./_lib/obyektivka-docx");
const { orderBot, telegram, toOwner } = require("./_lib/bots");
const { generateTest, makeVariants, testHtml, testDocx, fileBase, LETTERS } = require("./_lib/test-gen");
const { costLine } = require("./_lib/ai");
const { confirmReferral } = require("./_lib/referral");
const { GENERATORS } = require("./_lib/doc-gen");
const { generatePresentation } = require("./_lib/pres-gen");
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const { blocksToHtml, blocksToDocx } = require("./_lib/doc-render");

// Avtomatik tayyorlanadigan xizmatlar (mijozga boradigan izoh uchun)
const READY = {
  resume: "Resume'ingiz", obyektivka: "Obyektivkangiz", test: "Testingiz",
  presentation: "Taqdimotingiz", essay: "Mustaqil ishingiz", referat: "Referatingiz", article: "Maqolangiz", lesson: "Dars ishlanmangiz", questions: "Savollaringiz", crossword: "Krossvordingiz",
};
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const supabase = require("./_lib/db");

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

// kind: "pdf" (A4) yoki "png" (1-sahifa rasmi, krossvord uchun)
async function renderPdf(html, kind = "pdf") {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (kind === "png") await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 25000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (window.__fit) window.__fit();
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    });
    if (kind === "png") {
      await page.addStyleTag({ content: "body{padding:12mm 15mm} .pb ~ *{display:none!important} .pb{display:none}" });
      return Buffer.from(await page.screenshot({ type: "png", fullPage: true }));
    }
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

// Telegram quiz: savollar botda viktorina bo'lib keladi (1-variant tartibida)
async function sendQuiz(order, t) {
  if (!order.telegram_user_id) return;
  const bot = orderBot(order);
  const letters = LETTERS[t.d.lang];
  await telegram(bot, "sendMessage", { chat_id: order.telegram_user_id, text: `📝 <b>${t.title.replace(/[<>&]/g, "")}</b>\n${t.questions.length} ta savol — javobni tanlang.`, parse_mode: "HTML" });
  for (let i = 0; i < t.questions.length; i++) {
    const q = t.questions[i];
    // Telegram chegaralari: savol 300, javob 100 belgi
    const long = q.question.length > 290 || q.options.some((o) => o.length > 100);
    const body = {
      chat_id: order.telegram_user_id,
      type: "quiz",
      question: long ? `${i + 1}. ${t.d.lang === "en" ? "Question" : "Savol"} (${letters.slice(0, q.options.length).split("").join(", ")})` : `${i + 1}. ${q.question}`,
      options: q.options.map((o, j) => ({ text: long ? letters[j] : o })),
      correct_option_id: q.correct,
    };
    if (long) await telegram(bot, "sendMessage", { chat_id: order.telegram_user_id, text: `${i + 1}. ${q.question}\n\n${q.options.map((o, j) => `${letters[j]}) ${o}`).join("\n")}`.slice(0, 4000) });
    let r = await telegram(bot, "sendPoll", body);
    if (!r.ok && r.parameters && r.parameters.retry_after) {
      await new Promise((ok) => setTimeout(ok, (r.parameters.retry_after + 1) * 1000));
      r = await telegram(bot, "sendPoll", body);
    }
    await new Promise((ok) => setTimeout(ok, 400)); // bitta chatga sekundiga ~1 xabar
  }
}

const costTitle = (s, f) => ({
  presentation: `Taqdimot — ${f.slides || 10} slayd${f.photos && f.photos.length ? `, ${f.photos.length} ta o'z rasmi` : ""}`,
  test: `Test — ${f.count || 20} savol, ${f.variants || 1} variant`,
  essay: `Mustaqil ish — ${f.pages || 15} bet`,
  referat: `Referat — ${f.pages || 10} bet`,
  article: `Maqola (${{ scientific: "ilmiy", thesis: "tezis", popular: "ommabop" }[f.kind] || "ilmiy"}) — ${f.pages || 6} bet`,
  lesson: `Dars ishlanma — ${f.duration || 45} daqiqa`,
  questions: `Savollar — ${f.count || 15} ta`,
  crossword: `Krossvord — ${f.words || 15} so'z`,
}[s] || s);

// AI narxi: buyurtmaga yoziladi va egaga qisqa hisobot (narxlarni belgilash uchun)
async function reportCost(order, ai) {
  const info = { model: ai.model, input: ai.usage.input, output: ai.usage.output, usd: Number(ai.usd.toFixed(5)) };
  const { data } = await supabase.from("orders").select("details").eq("id", order.id).single();
  await supabase.from("orders").update({ details: { ...((data && data.details) || order.details), ai: info } }).eq("id", order.id);
  const f = order.details.fields || {};
  await toOwner(orderBot(order), "sendMessage", {
    chat_id: process.env.OWNER_CHAT_ID,
    text: `🤖 #${order.id} ${costTitle(order.service, f)}${order.total ? ` — ${Number(order.total).toLocaleString("ru-RU")} so'm${order.details.payment ? " (to'langan)" : ""}` : ""}${order.details.trial ? ` — bepul sinov (narxi ${Number(order.details.listPrice || 0).toLocaleString("ru-RU")} so'm bo'lardi)` : ""}${order.details.credit ? ` — 🎁 referal bonusi (narxi ${Number(order.details.listPrice || 0).toLocaleString("ru-RU")} so'm)` : ""}\n${costLine(ai)}`,
  }).catch((e) => console.error(e));
}

// Mijoz yuklagan barcha rasmlar (taqdimot uchun)
async function photoUrls(order) {
  const paths = (order.details && Array.isArray(order.details.photos) && order.details.photos) || [];
  if (!paths.length) return [];
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 600);
  return (data || []).map((x) => x.signedUrl).filter(Boolean);
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
    if (order.status !== "active" || order.details.awaitingPayment) {
      res.status(200).json({ ok: true, skipped: order.details.awaitingPayment ? "unpaid" : order.status });
      return;
    }

    let file;
    let ai = null;
    if (order.service === "presentation") {
      // Claude Opus slaydlarni yozadi, asl Canva shabloni to'ldiriladi (api/_lib/pres-gen.js)
      const pres = await generatePresentation(order.details.fields, await photoUrls(order));
      ai = pres.ai;
      file = { buffer: pres.buffer, name: pres.name + ".pptx", mime: PPTX };
    } else if (GENERATORS[order.service]) {
      // Matnni Claude yozadi, hujjat shakli — kodda (api/_lib/doc-gen.js)
      const doc = await GENERATORS[order.service](order.details.fields);
      ai = doc.ai;
      const fmt = order.details.fields.format;
      file = fmt === "pdf"
        ? { buffer: await renderPdf(blocksToHtml(doc.blocks, doc.render)), name: doc.name + ".pdf", mime: "application/pdf" }
        : fmt === "png"
          ? { buffer: await renderPdf(blocksToHtml(doc.blocks, doc.render), "png"), name: doc.name + ".png", mime: "image/png" }
          : { buffer: await blocksToDocx(doc.blocks, doc.render), name: doc.name + ".docx", mime: DOCX };
    } else if (order.service === "test") {
      // Savollarni Claude tuzadi; variantlar, kalit va fayl — avtomatik
      const t = await generateTest(order.details.fields);
      ai = t.ai;
      const variants = makeVariants(t.questions, t.d.variants, order.id);
      if (t.d.format === "quiz") await sendQuiz(order, t);
      file = t.d.format === "pdf"
        ? { buffer: await renderPdf(testHtml(t, variants)), name: fileBase(t.d) + ".pdf", mime: "application/pdf" }
        : { buffer: await testDocx(t, variants), name: fileBase(t.d) + ".docx", mime: DOCX };
    } else if (order.service === "obyektivka") {
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
    if (ai) await reportCost(order, ai);
    await confirmReferral(orderBot(order), order).catch((e) => console.error("Referal:", e));
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
