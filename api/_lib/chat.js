// api/_lib/chat.js
// ---------------------------------------------------------------
// AI botda to'g'ridan-to'g'ri suhbat: mijoz botga savol yozadi yoki
// masala rasmini yuboradi — Claude (CHAT_MODEL, standart Sonnet 5.5)
// javob beradi. Suhbat xotirasi (oxirgi xabarlar) va kunlik hisob
// Supabase Storage'da: ai-uploads/<mijoz>/chat/state.json (cron
// tozalamaydi). Kuniga FREE_CHAT_DAILY ta bepul xabar (bot egasiga
// cheklov yo'q). /yangi — suhbatni tozalash.
// ---------------------------------------------------------------

const { telegram, token } = require("./bots");
const { askText, modelFor } = require("./ai");
const supabase = require("./db");

const BUCKET = "ai-uploads";
const FREE = () => Number(process.env.FREE_CHAT_DAILY) || 10;
const HISTORY = 12; // eslab qolinadigan xabarlar (6 ta savol-javob)
const statePath = (uid) => `${parseInt(uid, 10)}/chat/state.json`;
const today = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10); // Toshkent vaqti

const SYSTEM = `You are "AI Yordamchi", a friendly tutor and assistant inside a Telegram bot for school pupils, students and teachers in Uzbekistan.
- Reply in the user's language (default: Uzbek, Latin script with o', g', sh, ch). If the user writes in Russian or English, reply in that language.
- For homework and problems: explain step by step so the pupil understands the method, then give the final answer clearly.
- If an image is attached, read it carefully (handwriting, textbook pages) and solve or explain what is asked.
- Be accurate. If you are not sure, say so briefly instead of inventing facts.
- Formatting for Telegram: short paragraphs, numbered steps, **bold** for key words and the final answer. No LaTeX, no tables, no headings with #. Write formulas in plain Unicode: x², √2, ×, ÷, ≤, π, fractions as a/b.
- Keep answers focused (usually under 1500 characters) unless the task really needs more.
- If the user asks for a presentation, essay (mustaqil ish), referat, article, test, lesson plan, crossword, resume or obyektivka as a file, give a short answer and suggest the «✨ Ilovani ochish» button — there it is prepared as a ready file.`;

/* ---------------- holat (xotira, kunlik hisob) ---------------- */
async function load(uid) {
  try {
    const { data } = await supabase.storage.from(BUCKET).download(statePath(uid));
    if (data) {
      const s = JSON.parse(Buffer.from(await data.arrayBuffer()).toString("utf8"));
      if (s && Array.isArray(s.msgs)) return s;
    }
  } catch (e) { /* yangi */ }
  return { day: today(), used: 0, usd: 0, msgs: [] };
}
async function save(uid, s) {
  const { error } = await supabase.storage.from(BUCKET).upload(statePath(uid), Buffer.from(JSON.stringify(s)), { contentType: "application/json", upsert: true });
  if (error && /bucket/i.test(error.message || "")) {
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    await supabase.storage.from(BUCKET).upload(statePath(uid), Buffer.from(JSON.stringify(s)), { contentType: "application/json", upsert: true });
  }
}

/* ---------------- Telegram formatlash ---------------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// **qalin**, `kod`, # sarlavha -> Telegram HTML (juft bo'lmagan belgilar o'zgarmaydi)
function toHtml(md) {
  return esc(md)
    .replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>")
    .replace(/\*\*([^*\n][^*]*?)\*\*/g, "<b>$1</b>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}
// 4096 belgi chegarasi: paragraflar bo'yicha bo'lish
function chunks(text, max = 3500) {
  const out = [];
  let cur = "";
  for (const para of String(text).split(/\n{2,}/)) {
    if ((cur + "\n\n" + para).length > max && cur) { out.push(cur); cur = ""; }
    if (para.length > max) { for (let i = 0; i < para.length; i += max) out.push(para.slice(i, i + max)); continue; }
    cur = cur ? cur + "\n\n" + para : para;
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------------- rasm ---------------- */
async function photoBlock(bot, msg) {
  let file = null, mime = "image/jpeg";
  if (msg.photo && msg.photo.length) {
    // ~1600px gacha bo'lgan eng kattasi (token tejash)
    const sizes = [...msg.photo].sort((a, b) => a.width - b.width);
    file = sizes.filter((p) => Math.max(p.width, p.height) <= 1600).pop() || sizes[0];
  } else if (msg.document && /^image\/(jpeg|png|webp)$/.test(msg.document.mime_type || "")) {
    file = msg.document; mime = msg.document.mime_type;
  }
  if (!file) return null;
  if ((file.file_size || 0) > 5 * 1024 * 1024) throw Object.assign(new Error("Rasm 5 MB dan katta — kichikroq rasm yuboring."), { user: true });
  const f = await telegram(bot, "getFile", { file_id: file.file_id });
  if (!f.ok) throw new Error("getFile: " + f.description);
  const res = await fetch(`https://api.telegram.org/file/bot${token(bot)}/${f.result.file_path}`);
  if (!res.ok) throw new Error("download " + res.status);
  return { type: "image", source: { type: "base64", media_type: mime, data: Buffer.from(await res.arrayBuffer()).toString("base64") } };
}

/* ---------------- javob ---------------- */
async function reply(msg, bot, { isOwner, appButton } = {}) {
  const uid = msg.from.id;
  const chat_id = msg.chat.id;
  const send = (text, extra = {}) => telegram(bot, "sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
  const s = await load(uid);
  if (s.day !== today()) { s.day = today(); s.used = 0; s.usd = 0; }
  if (!isOwner && s.used >= FREE()) {
    await send(`Bugungi bepul ${FREE()} ta savol tugadi 🙏\n\nErtaga yana yozishingiz mumkin. Taqdimot, mustaqil ish, test kabi tayyor fayllar esa ilovada 👇`, appButton ? { reply_markup: appButton } : {});
    return;
  }

  // "yozmoqda..." — javob tayyor bo'lguncha har 4 soniyada
  const typing = () => telegram(bot, "sendChatAction", { chat_id, action: "typing" }).catch(() => {});
  typing();
  const timer = setInterval(typing, 4000);
  try {
    const question = String(msg.text || msg.caption || "").slice(0, 4000);
    const image = await photoBlock(bot, msg);
    const content = [
      ...(image ? [image] : []),
      { type: "text", text: question || (image ? "Rasmdagi topshiriqni yechib, tushuntirib bering." : "Salom") },
    ];
    const history = s.msgs.slice(-HISTORY).map((m) => ({ role: m.role, content: m.text }));
    const r = await askText({ model: modelFor("CHAT_MODEL"), system: SYSTEM, messages: [...history, { role: "user", content }], maxTokens: 3000, effort: "low" });
    clearInterval(timer);
    const answer = r.text.trim() || "Kechirasiz, javob tayyorlay olmadim. Savolni boshqacha yozib ko'ring.";
    for (const part of chunks(answer)) await send(toHtml(part)).then((x) => (x.ok ? x : send(esc(part)))); // HTML xato bo'lsa — oddiy matn

    s.msgs.push({ role: "user", text: (image ? "[rasm] " : "") + (question || "Rasmdagi topshiriq") }, { role: "assistant", text: answer.slice(0, 6000) });
    s.msgs = s.msgs.slice(-HISTORY);
    s.used += 1;
    s.usd = +(s.usd + r.usd).toFixed(5);
    s.total = +((s.total || 0) + r.usd).toFixed(5);
    await save(uid, s);
  } catch (e) {
    clearInterval(timer);
    console.error("AI chat:", e);
    await send(e.user ? esc(e.message) : "Kechirasiz, hozir javob bera olmadim. Birozdan so'ng qayta yozing.");
  }
}

async function reset(msg, bot) {
  const s = await load(msg.from.id);
  s.msgs = [];
  await save(msg.from.id, s);
  await telegram(bot, "sendMessage", { chat_id: msg.chat.id, text: "🧹 Suhbat tozalandi. Yangi savolingizni yozing." });
}

module.exports = { reply, reset, toHtml, chunks, FREE, SYSTEM };
