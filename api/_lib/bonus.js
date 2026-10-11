// api/_lib/bonus.js
// ---------------------------------------------------------------
// Obuna bonuslari: Telegram kanalga qo'shilgan va Instagram sahifaga
// obuna bo'lgan mijozga har biri uchun bir martalik sovg'a.
//  • AI bot (BOT_MODE=ai): 1 ta bepul AI buyurtma (users.ai_credits,
//    kurs ishiga ishlatilmaydi — referal bonusi bilan bir xil).
//  • Hisoblash boti: "1 ta bepul AI xizmat YOKI 10 ta bepul varaq" —
//    ikkalasi ham beriladi, AI xizmat ishlatilsa sovg'a tugaydi (qolgan
//    varaqlar ham), 10 varaq to'liq ishlatilsa ham tugaydi. Holati
//    marker faylning o'zida: { ai: 1, pages: 10, used? }.
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
// Chop etish buyurtmasi bekor qilinsa, sovg'a varaqlari qaytadi (sovg'a
// AI xizmatga ishlatilmagan bo'lsa).
// ---------------------------------------------------------------
const { AI_MODE, telegram } = require("./bots");
const supabase = require("./db");

const BUCKET = "ai-uploads";
const markPath = (uid, kind) => `${parseInt(uid, 10)}/prefs/bonus-${kind}.json`;
const GIFT_PAGES = 10; // hisoblash botida har bir obuna uchun bepul varaqlar
const KINDS = ["tg", "ig"];

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

async function readMark(uid, kind) {
  const { data } = await supabase.storage.from(BUCKET).download(markPath(uid, kind));
  if (!data) return null;
  try { return JSON.parse(Buffer.from(await data.arrayBuffer()).toString("utf8")); } catch (e) { return {}; }
}
async function claimed(uid, kind) {
  return !!(await readMark(uid, kind));
}
async function writeMark(uid, kind, obj) {
  const { error } = await supabase.storage.from(BUCKET).upload(markPath(uid, kind), Buffer.from(JSON.stringify(obj)), { contentType: "application/json", upsert: true });
  if (error) throw error;
}
const isOpen = (m) => m && m.ai > 0 && m.pages > 0;

// Hisoblash boti: ochiq sovg'alar — { ai: nechta AI xizmat, pages: jami varaq }
async function giftsOf(uid) {
  const out = { ai: 0, pages: 0 };
  if (AI_MODE || !uid) return out;
  const marks = await Promise.all(KINDS.map((k) => readMark(uid, k).catch(() => null)));
  marks.filter(isOpen).forEach((m) => { out.ai += 1; out.pages += m.pages; });
  return out;
}
// Bepul AI xizmatga ishlatish — sovg'a tugaydi (qolgan varaqlari ham)
async function takeGiftAi(uid) {
  if (AI_MODE || !uid) return false;
  for (const k of KINDS) {
    const m = await readMark(uid, k).catch(() => null);
    if (!isOpen(m)) continue;
    await writeMark(uid, k, { ...m, ai: 0, pages: 0, used: "ai", usedAt: new Date().toISOString() });
    return true;
  }
  return false;
}
// Chop etishda n ta bepul varaq — avval sovg'alardan. Qaytaradi: { used, from: [{kind, n}] }
async function takeGiftPages(uid, n) {
  const out = { used: 0, from: [] };
  if (AI_MODE || !uid || !(n > 0)) return out;
  for (const k of KINDS) {
    if (out.used >= n) break;
    const m = await readMark(uid, k).catch(() => null);
    if (!isOpen(m)) continue;
    const take = Math.min(m.pages, n - out.used);
    const left = m.pages - take;
    await writeMark(uid, k, left > 0 ? { ...m, pages: left } : { ...m, pages: 0, ai: 0, used: "pages", usedAt: new Date().toISOString() });
    out.used += take;
    out.from.push({ kind: k, n: take });
  }
  return out;
}
// Buyurtma bekor qilindi — varaqlar sovg'aga qaytadi (AI xizmatga ishlatilgan bo'lsa — yo'q)
async function returnGiftPages(uid, from) {
  let back = 0;
  for (const f of Array.isArray(from) ? from : []) {
    if (!KINDS.includes(f.kind) || !(f.n > 0)) continue;
    const m = await readMark(uid, f.kind).catch(() => null);
    if (!m || m.used === "ai") continue;
    const rest = { ...m, ai: 1, pages: Math.min(GIFT_PAGES, (m.pages || 0) + f.n) };
    delete rest.used; delete rest.usedAt;
    await writeMark(uid, f.kind, rest);
    back += f.n;
  }
  return back;
}

// Profil uchun: { tg: {url, done}, ig: {url, done} } — sozlanmaganlari yo'q
async function bonusTasks(uid) {
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
  const cfg = TASKS[kind] && TASKS[kind]();
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
  const mark = { at: new Date().toISOString(), ...(AI_MODE ? {} : { ai: 1, pages: GIFT_PAGES }) };
  const body = Buffer.from(JSON.stringify(mark));
  const opts = { contentType: "application/json", upsert: false };
  let { error } = await supabase.storage.from(BUCKET).upload(markPath(uid, kind), body, opts);
  if (error && !/exist|duplicate/i.test(error.message || "")) {
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    ({ error } = await supabase.storage.from(BUCKET).upload(markPath(uid, kind), body, opts));
  }
  if (error) return { ok: false, code: "done" }; // allaqachon olingan (parallel bosish)
  if (!AI_MODE) return { ok: true, gift: { ai: 1, pages: GIFT_PAGES } };
  try {
    return { ok: true, credits: await addCredit(uid) };
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([markPath(uid, kind)]).catch(() => {});
    throw e;
  }
}

module.exports = { bonusTasks, claimBonus, channel, instagram, giftsOf, takeGiftAi, takeGiftPages, returnGiftPages, GIFT_PAGES };
