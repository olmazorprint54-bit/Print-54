// api/_lib/referral.js
// ---------------------------------------------------------------
// AI bot referal tizimi (faqat alohida AI loyiha — BOT_MODE=ai).
// Do'st havola orqali /start bosadi (botda yangi bo'lsa) -> referrals jadvaliga
// yoziladi va shu zahoti hisoblanadi. Bonus: REF_FIRST (3) ta do'st — 1 ta bepul
// AI buyurtma, keyin har REF_NEXT (2) ta yangi do'st — yana 1 ta (users.ai_credits).
// users.ai_referrals — bonus hisoblangan do'stlar soni (eski "tasdiqlanmagan"
// do'stlar ham keyingi qo'shilishda hisobga kiradi).
// Jadval ustunlari: supabase/yangi-loyiha.sql
// ---------------------------------------------------------------

const { AI_MODE, telegram } = require("./bots");
const LB = require("./i18n-bot");
const supabase = require("./db");

const REF_FIRST = 3; // birinchi bonus — 3 ta do'st
const REF_NEXT = 2; // keyin har 2 ta do'st — yana 1 ta
const REF_STEP = REF_FIRST; // (eski nom)

// n ta do'st uchun jami bonus: 3 → 1, 5 → 2, 7 → 3 ...
const earnedFor = (n) => (n < REF_FIRST ? 0 : 1 + Math.floor((n - REF_FIRST) / REF_NEXT));
// keyingi bonus qaysi songa yetganda / oldingisi qaysi sonda berilgan
const nextAt = (n) => (n < REF_FIRST ? REF_FIRST : REF_FIRST + (Math.floor((n - REF_FIRST) / REF_NEXT) + 1) * REF_NEXT);
const prevAt = (n) => (n < REF_FIRST ? 0 : nextAt(n) - REF_NEXT);

async function friendsOf(referrerId) {
  const { count } = await supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", referrerId);
  return count || 0;
}

// /start <id> — yangi foydalanuvchi bo'lsa, referal yoziladi va darhol hisoblanadi.
// isNew — foydalanuvchi bazada avval bo'lmagan.
async function registerReferral(bot, from, startText, isNew) {
  const refId = parseInt(String(startText || "").split(" ")[1], 10);
  if (!AI_MODE || !isNew || !Number.isSafeInteger(refId) || refId <= 0 || refId === from.id) return false;
  const now = new Date().toISOString();
  const { error } = await supabase.from("referrals").insert({ referrer_id: refId, referred_id: from.id, confirmed_at: now });
  if (error) return false; // allaqachon bor (referred_id unique) yoki jadval yo'q

  // bonus: shartli yangilash (bir vaqtda ikki do'st qo'shilsa ham ikki marta berilmasin)
  let count = 0, add = 0, credits = 0;
  for (let i = 0; i < 4; i++) {
    count = await friendsOf(refId);
    const { data: u } = await supabase.from("users").select("ai_referrals, ai_credits").eq("telegram_user_id", refId).single();
    const counted = u ? u.ai_referrals || 0 : 0;
    add = Math.max(0, earnedFor(count) - earnedFor(counted));
    credits = (u ? u.ai_credits || 0 : 0) + add;
    if (!u) {
      const { error: e2 } = await supabase.from("users").insert({ telegram_user_id: refId, ai_referrals: count, ai_credits: credits });
      if (!e2) break;
      continue;
    }
    if (count <= counted) { add = 0; break; }
    const { data: upd } = await supabase.from("users").update({ ai_referrals: count, ai_credits: credits }).eq("telegram_user_id", refId).eq("ai_referrals", counted).select();
    if (upd && upd.length) break;
    add = 0;
  }
  // eski "kutilmoqda" yozuvlar ham endi hisoblangan
  await supabase.from("referrals").update({ confirmed_at: now }).eq("referrer_id", refId).is("confirmed_at", null).then(() => {}, () => {});

  const name = from.first_name || (from.username ? "@" + from.username : "—");
  const l = await LB.getLang(refId).catch(() => "uz");
  await telegram(bot, "sendMessage", {
    chat_id: refId,
    text: add > 0 ? LB.T(l, "aiRefEarn", name, count, add, credits, nextAt(count) - count) : LB.T(l, "aiRefJoin", name, count, nextAt(count) - count),
  }).catch(() => {});
  return true;
}

// Eski qoida (do'st birinchi pullik buyurtmasida hisoblanardi) — endi do'st qo'shilganda
// hisoblanadi, shuning uchun bu yerda hech narsa qilinmaydi (chaqiruvlar o'zgarmasin).
async function confirmReferral() {}

// Bonusni ishlatish: 1 ta kamaytiramiz (shartli — ikki marta sarflanmasin)
async function takeCredit(userId) {
  if (!AI_MODE) return false;
  for (let i = 0; i < 3; i++) {
    const { data } = await supabase.from("users").select("ai_credits").eq("telegram_user_id", userId).single();
    const n = data ? data.ai_credits || 0 : 0;
    if (n <= 0) return false;
    const { data: upd } = await supabase.from("users").update({ ai_credits: n - 1 }).eq("telegram_user_id", userId).eq("ai_credits", n).select();
    if (upd && upd.length) return true;
  }
  return false;
}

// Profil uchun: bonuslar, tasdiqlangan va kutilayotgan do'stlar, taklif havolasi
const usernames = {};
async function rewardsOf(bot, userId) {
  const [{ data: u }, friends] = await Promise.all([
    supabase.from("users").select("ai_credits, ai_referrals").eq("telegram_user_id", userId).single(),
    friendsOf(userId).catch(() => 0),
  ]);
  if (!usernames[bot]) {
    const me = await telegram(bot, "getMe", {}).catch(() => null);
    if (me && me.ok) usernames[bot] = me.result.username;
  }
  return {
    credits: u ? u.ai_credits || 0 : 0,
    confirmed: Math.max(friends, u ? u.ai_referrals || 0 : 0),
    pending: 0,
    step: REF_FIRST,
    first: REF_FIRST,
    every: REF_NEXT,
    next: nextAt(Math.max(friends, u ? u.ai_referrals || 0 : 0)),
    prev: prevAt(Math.max(friends, u ? u.ai_referrals || 0 : 0)),
    link: usernames[bot] ? `https://t.me/${usernames[bot]}?start=${userId}` : null,
  };
}

module.exports = { REF_STEP, REF_FIRST, REF_NEXT, earnedFor, nextAt, registerReferral, confirmReferral, takeCredit, rewardsOf };
