// api/_lib/referral.js
// ---------------------------------------------------------------
// AI bot referal tizimi (faqat alohida AI loyiha — BOT_MODE=ai).
// Do'st havola orqali /start bosadi -> referrals jadvaliga "kutilmoqda"
// bo'lib yoziladi. Do'st birinchi pullik AI xizmatini olganda referal
// tasdiqlanadi. Har REF_STEP ta tasdiqlangan do'st uchun taklif qilgan
// mijozga 1 ta bepul AI buyurtma (users.ai_credits).
// Jadval ustunlari: supabase/yangi-loyiha.sql
// ---------------------------------------------------------------

const { AI_MODE, telegram } = require("./bots");
const supabase = require("./db");

const REF_STEP = 3;

// /start <id> — yangi foydalanuvchi bo'lsa, referalni "kutilmoqda" holatida yozamiz.
// isNew — foydalanuvchi bazada avval bo'lmagan.
async function registerReferral(bot, from, startText, isNew) {
  const refId = parseInt(String(startText || "").split(" ")[1], 10);
  if (!AI_MODE || !isNew || !Number.isSafeInteger(refId) || refId <= 0 || refId === from.id) return false;
  const { error } = await supabase.from("referrals").insert({ referrer_id: refId, referred_id: from.id });
  if (error) return false; // allaqachon bor (referred_id unique) yoki jadval yo'q
  const name = from.first_name || (from.username ? "@" + from.username : "Yangi foydalanuvchi");
  await telegram(bot, "sendMessage", {
    chat_id: refId,
    text: `🎉 ${name} sizning havolangiz orqali qo'shildi!\n\nU birinchi buyurtmasini olgach, hisobingizga yoziladi. Har ${REF_STEP} ta do'st uchun — 1 ta bepul AI buyurtma 🎁`,
  }).catch(() => {});
  return true;
}

// Buyurtma mijozga yetkazildi: do'stning birinchi pullik xizmati bo'lsa — referal tasdiqlanadi
async function confirmReferral(bot, order) {
  if (!AI_MODE || !order || !order.telegram_user_id) return;
  const d = order.details || {};
  const worth = Number(order.total) > 0 || Number(d.listPrice) > 0; // tekin resume/obyektivka hisobga olinmaydi
  if (!worth) return;
  // shartli yangilash: bir vaqtda ikki buyurtma tugasa ham faqat bittasi tasdiqlaydi
  const { data: rows } = await supabase
    .from("referrals")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("referred_id", order.telegram_user_id)
    .is("confirmed_at", null)
    .select();
  const ref = rows && rows[0];
  if (!ref) return;

  const { data: u } = await supabase.from("users").select("ai_referrals, ai_credits").eq("telegram_user_id", ref.referrer_id).single();
  const count = (u ? u.ai_referrals || 0 : 0) + 1;
  const earned = count % REF_STEP === 0;
  const credits = (u ? u.ai_credits || 0 : 0) + (earned ? 1 : 0);
  await supabase.from("users").upsert({ telegram_user_id: ref.referrer_id, ai_referrals: count, ai_credits: credits }, { onConflict: "telegram_user_id" });

  const left = REF_STEP - (count % REF_STEP);
  await telegram(bot, "sendMessage", {
    chat_id: ref.referrer_id,
    text: earned
      ? `🎁 Tabriklaymiz! ${count} ta do'stingiz xizmatimizdan foydalandi — sizga 1 ta bepul AI buyurtma berildi.\n\nUni ilovada buyurtma berishda «🎁 Bonusdan foydalanish» orqali ishlatasiz. Hozir bonuslar: ${credits} ta.`
      : `✅ Do'stingiz birinchi buyurtmasini oldi — referal hisoblandi (${count} ta).\n\nYana ${left} ta do'st — va 1 ta bepul AI buyurtma sizniki 🎁`,
  }).catch(() => {});
}

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
  const [{ data: u }, { count: pending }] = await Promise.all([
    supabase.from("users").select("ai_credits, ai_referrals").eq("telegram_user_id", userId).single(),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId).is("confirmed_at", null),
  ]);
  if (!usernames[bot]) {
    const me = await telegram(bot, "getMe", {}).catch(() => null);
    if (me && me.ok) usernames[bot] = me.result.username;
  }
  return {
    credits: u ? u.ai_credits || 0 : 0,
    confirmed: u ? u.ai_referrals || 0 : 0,
    pending: pending || 0,
    step: REF_STEP,
    link: usernames[bot] ? `https://t.me/${usernames[bot]}?start=${userId}` : null,
  };
}

module.exports = { REF_STEP, registerReferral, confirmReferral, takeCredit, rewardsOf };
