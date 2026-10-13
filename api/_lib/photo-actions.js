// api/_lib/photo-actions.js
// ---------------------------------------------------------------
// AI botga oddiy chatda rasm yuborilganda: «📄 PDF qilish» va
// «🤖 AI javobi» tugmalari (albom bo'lsa — bitta xabar).
//  • PDF — AI'siz, tekin: rasmlar Storage'ga ko'chiriladi, "img2pdf"
//    buyurtmasi yaratiladi va api/resume-pdf.js PDF yasab yuboradi.
//  • AI javobi — oxirgi rasm bilan AI suhbat (chat.js): masalani yechadi
//    yoki rasmga qarab xizmat tavsiya qiladi.
// Kutilayotgan rasmlar: ai-uploads/<mijoz>/chat/photos.json (30 daqiqa, 30 ta).
// ---------------------------------------------------------------
const crypto = require("crypto");
const { telegram, token } = require("./bots");
const supabase = require("./db");
const LB = require("./i18n-bot");

const BUCKET = "ai-uploads";
const KEEP_MS = 30 * 60 * 1000;
const MAX = 30;
const statePath = (uid) => `${parseInt(uid, 10)}/chat/photos.json`;
const groupMark = (uid, g) => `${parseInt(uid, 10)}/chat/pg-${String(g).replace(/[^\w-]/g, "")}.json`;

async function load(uid) {
  try {
    const { data } = await supabase.storage.from(BUCKET).download(statePath(uid));
    if (data) {
      const s = JSON.parse(Buffer.from(await data.arrayBuffer()).toString("utf8"));
      if (s && Array.isArray(s.items)) return s;
    }
  } catch (e) { /* yangi */ }
  return { items: [] };
}
async function save(uid, s) {
  await supabase.storage.from(BUCKET).upload(statePath(uid), Buffer.from(JSON.stringify(s)), { contentType: "application/json", upsert: true });
}
const fresh = (items) => items.filter((x) => Date.now() - x.at < KEEP_MS).slice(-MAX);

// Rasm yoki rasm-fayl (jpeg/png/webp) — saqlanadigan qism
function pickImage(msg) {
  if (msg.photo && msg.photo.length) return { p: msg.photo.map((x) => ({ file_id: x.file_id, width: x.width, height: x.height, file_size: x.file_size })) };
  const d = msg.document;
  if (d && /^image\/(jpeg|png|webp)$/.test(d.mime_type || "")) return { d: { file_id: d.file_id, mime_type: d.mime_type, file_size: d.file_size } };
  return null;
}

const kb = (l) => ({ inline_keyboard: [[{ text: LB.T(l, "phBtnPdf"), callback_data: "ph:pdf" }, { text: LB.T(l, "phBtnAi"), callback_data: "ph:ai" }]] });

// Rasm keldi: saqlaymiz va tugmalarni chiqaramiz (albomda — bir marta)
async function onPhoto(msg, bot) {
  const img = pickImage(msg);
  if (!img) return false;
  const uid = msg.from.id;
  const s = await load(uid);
  s.items = fresh(s.items);
  s.items.push({ ...img, cap: String(msg.caption || "").slice(0, 1000), g: msg.media_group_id || null, at: Date.now() });
  s.items = s.items.slice(-MAX);
  await save(uid, s);
  if (msg.media_group_id) {
    // albomning birinchi rasmidagina xabar (parallel kelganda ham bitta — upsert:false)
    const { error } = await supabase.storage.from(BUCKET).upload(groupMark(uid, msg.media_group_id), Buffer.from("1"), { contentType: "application/json", upsert: false });
    if (error) return true;
  }
  const l = await LB.getLang(uid);
  await telegram(bot, "sendMessage", { chat_id: msg.chat.id, text: LB.T(l, "phAsk"), reply_markup: kb(l), reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } });
  return true;
}

// Telegram'dan faylni yuklab olish
async function download(bot, fileId) {
  const f = await telegram(bot, "getFile", { file_id: fileId });
  if (!f.ok) throw new Error("getFile: " + f.description);
  const res = await fetch(`https://api.telegram.org/file/bot${token(bot)}/${f.result.file_path}`);
  if (!res.ok) throw new Error("download " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

// Tugmalar: ph:pdf → nechta rasm bir varaqqa; ph:pdf:N → PDF; ph:ai → AI javobi; ph:x → bekor
async function onCallback(cq, bot, { startPdf, aiReply }) {
  const uid = cq.from.id;
  const l = await LB.getLang(uid);
  const chat_id = cq.message.chat.id, message_id = cq.message.message_id;
  const answer = (text) => telegram(bot, "answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text } : {}) });
  const edit = (text, markup) => telegram(bot, "editMessageText", { chat_id, message_id, text, reply_markup: markup || { inline_keyboard: [] } }).catch(() => {});
  const s = await load(uid);
  s.items = fresh(s.items);
  if (!s.items.length) { await answer(); await edit(LB.T(l, "phNone")); return; }

  if (cq.data === "ph:x") { await answer(); await edit(LB.T(l, "phCancel")); return; }

  if (cq.data === "ph:pdf") {
    await answer();
    const n = s.items.length;
    await edit(LB.T(l, "phPdfPick", n), { inline_keyboard: [
      ["1", "2", "4", "6", "9"].map((k) => ({ text: k, callback_data: "ph:pdf:" + k })),
      [{ text: LB.T(l, "phBtnBack"), callback_data: "ph:back" }],
    ] });
    return;
  }
  if (cq.data === "ph:back") { await answer(); await edit(LB.T(l, "phAsk"), kb(l)); return; }

  const m = cq.data.match(/^ph:pdf:(1|2|4|6|9)$/);
  if (m) {
    await answer(LB.T(l, "phPdfWait", s.items.length));
    const items = s.items.slice();
    s.items = [];
    await save(uid, s);
    await edit(LB.T(l, "phPdfWait", items.length));
    // rasmlar Storage'ga (resume-pdf o'sha yerdan oladi)
    const paths = [];
    for (let i = 0; i < items.length; i += 5) {
      const part = await Promise.all(items.slice(i, i + 5).map(async (it) => {
        const fid = it.p ? it.p[it.p.length - 1].file_id : it.d.file_id;
        const buf = await download(bot, fid);
        const path = `${parseInt(uid, 10)}/${crypto.randomBytes(8).toString("hex")}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: it.d ? it.d.mime_type : "image/jpeg", upsert: false });
        if (error) throw error;
        return path;
      }));
      paths.push(...part);
    }
    const u = cq.from;
    const fields = { perPage: m[1], orient: "auto", margin: "small", fit: "contain", photos: paths };
    const { data: order, error } = await supabase.from("orders").insert({
      service: "img2pdf", status: "active", total: 0, qty: paths.length,
      telegram_user_id: u.id, telegram_username: u.username || null, telegram_name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
      details: { bot, topic: LB.T(l, "phTopic"), fields, photos: paths, source: "chat" },
    }).select().single();
    if (error) throw error;
    await startPdf(order.id);
    return;
  }

  if (cq.data === "ph:ai") {
    await answer();
    const last = s.items[s.items.length - 1];
    await edit(LB.T(l, "phAiWait"));
    // AI suhbatga xuddi rasm yuborilgandek (izoh bo'lsa — savol)
    const fake = { from: cq.from, chat: { id: chat_id }, caption: last.cap || "", ...(last.p ? { photo: last.p } : { document: last.d }) };
    await aiReply(fake, l);
    return;
  }
  await answer();
}

module.exports = { onPhoto, onCallback, pickImage };
