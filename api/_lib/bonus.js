// api/_lib/bonus.js
// ---------------------------------------------------------------
// Obuna bonuslari (faqat alohida AI bot — BOT_MODE=ai): Telegram
// kanalga qo'shilgan va Instagram sahifaga obuna bo'lgan mijozga
// har biri uchun bir martalik 1 ta bepul AI buyurtma (users.ai_credits,
// kurs ishiga ishlatilmaydi — referal bonusi bilan bir xil).
//
// Sozlash (Vercel env):
//   TG_CHANNEL     — kanal: @nomi yoki https://t.me/nomi
//                    (yopiq kanal: -100... raqami + TG_CHANNEL_URL taklif havolasi)
//   INSTAGRAM_URL  — https://instagram.com/sahifa
// Kanal obunasi bot orqali tekshiriladi (getChatMember) — buning uchun
// bot kanalga ADMIN qilib qo'shilgan bo'lishi kerak. Instagram obunasini
// tekshirib bo'lmaydi: havolani ochgandan keyin mijoz o'zi tasdiqlaydi.
// Kim olgani: Storage ai-uploads/<mijoz>/prefs/bonus-<tur>.json
// (upsert:false — ikki marta bosilsa ham bir marta yoziladi).
// ---------------------------------------------------------------
const { AI_MODE, telegram } = require("./bots");
const supabase = require("./db");

const BUCKET = "ai-uploads";
const markPath = (uid, kind) => `${parseInt(uid, 10)}/prefs/bonus-${kind}.json`;

function channel() {
  const raw = String(process.env.TG_CHANNEL || "").trim();
  if (!raw) return null;
  if (/^-100\d+$/.test(raw)) return process.env.TG_CHANNEL_URL ? { chat: raw, url: process.env.TG_CHANNEL_URL } : null;
  const name = raw.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  if (!/^[A-Za-z0-9_]{4,}$/.test(name)) return null;
  return { chat: "@" + name, url: process.env.TG_CHANNEL_URL || `https://t.me/${name}` };
}
function instagram() {
  const raw = String(process.env.INSTAGRAM_URL || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return { url: raw };
  return { url: "https://instagram.com/" + raw.replace(/^@/, "") };
}
const TASKS = { tg: channel, ig: instagram };

async function claimed(uid, kind) {
  const { data } = await supabase.storage.from(BUCKET).download(markPath(uid, kind));
  return !!data;
}

// Profil uchun: { tg: {url, done}, ig: {url, done} } — sozlanmaganlari yo'q
async function bonusTasks(uid) {
  if (!AI_MODE) return {};
  const out = {};
  await Promise.all(Object.entries(TASKS).map(async ([kind, cfg]) => {
    const c = cfg();
    if (!c) return;
    out[kind] = { url: c.url, done: await claimed(uid, kind).catch(() => false) };
  }));
  return out;
}

async function isMember(bot, chat, uid) {
  const r = await telegram(bot, "getChatMember", { chat_id: chat, user_id: uid });
  if (!r || !r.ok) {
    const err = new Error("getChatMember: " + (r && r.description));
    err.notAdmin = true;
    throw err;
  }
  const s = r.result.status;
  return s === "member" || s === "administrator" || s === "creator" || (s === "restricted" && r.result.is_member);
}

// 1 ta bonus qo'shamiz (shartli yangilash — parallel so'rovda yo'qolmasin)
async function addCredit(uid) {
  for (let i = 0; i < 4; i++) {
    const { data } = await supabase.from("users").select("ai_credits").eq("telegram_user_id", uid).single();
    if (!data) {
      const { error } = await supabase.from("users").insert({ telegram_user_id: uid, ai_credits: 1 });
      if (!error) return 1;
      continue;
    }
    const n = data.ai_credits || 0;
    const { data: upd } = await supabase.from("users").update({ ai_credits: n + 1 }).eq("telegram_user_id", uid).eq("ai_credits", n).select();
    if (upd && upd.length) return n + 1;
  }
  throw new Error("bonus qo'shilmadi");
}

// Bonusni olish. Qaytaradi: { ok, credits } yoki { ok:false, code }
// code: off | done | notMember | check (bot kanalda admin emas)
async function claimBonus(bot, uid, kind) {
  const cfg = AI_MODE && TASKS[kind] && TASKS[kind]();
  if (!cfg) return { ok: false, code: "off" };
  if (await claimed(uid, kind).catch(() => false)) return { ok: false, code: "done" };
  if (kind === "tg") {
    try {
      if (!(await isMember(bot, cfg.chat, uid))) return { ok: false, code: "notMember" };
    } catch (e) {
      console.error("Kanal tekshiruvi:", e.message);
      return { ok: false, code: "check" };
    }
  }
  const body = Buffer.from(JSON.stringify({ at: new Date().toISOString() }));
  const opts = { contentType: "application/json", upsert: false };
  let { error } = await supabase.storage.from(BUCKET).upload(markPath(uid, kind), body, opts);
  if (error && !/exist|duplicate/i.test(error.message || "")) {
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    ({ error } = await supabase.storage.from(BUCKET).upload(markPath(uid, kind), body, opts));
  }
  if (error) return { ok: false, code: "done" }; // allaqachon olingan (parallel bosish)
  try {
    return { ok: true, credits: await addCredit(uid) };
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([markPath(uid, kind)]).catch(() => {});
    throw e;
  }
}

module.exports = { bonusTasks, claimBonus, channel, instagram };
