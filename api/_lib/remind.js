// api/_lib/remind.js
// ---------------------------------------------------------------
// Unutilgan buyurtma eslatmasi: mijoz AI botda xizmat tugmasini bosib,
// 15 daqiqa ichida buyurtma bermasa, muloyim eslatma va shu xizmat tugmasi boradi.
// Qoidalar: mijozga kuniga ko'pi bilan 1 ta; shu orada istalgan buyurtma bergan bo'lsa yo'q;
// Toshkent vaqti 22:00–08:00 da yuborilmaydi (o'tkazib yuboriladi); "Bekor qilish" shu xizmatni o'chiradi.
// Jadval: supabase/eslatma.sql (service_views). Har 5 daqiqada Supabase pg_cron chaqiradi:
//   /api/cleanup-uploads?remind=1  (Authorization: Bearer CRON_SECRET)
// ---------------------------------------------------------------
const supabase = require("./db");
const { token, telegram, MAIN, extraBots } = require("./bots");
const L = require("./i18n-bot");

const WAIT_MIN = 15;
const botId = (bot) => String(token(bot) || "").split(":")[0];

const TEXT = {
  ask: [
    "😊 Siz «{s}» tayyorlamoqchi edingiz, balki unutib qo'ygandirsiz deb o'yladim. Davom etamizmi?",
    "😊 Вы хотели оформить «{s}» — может, просто отвлеклись? Продолжим?",
    "😊 You were about to order «{s}», maybe it slipped your mind? Shall we continue?",
  ],
  go: ["🚀 Davom etish", "🚀 Продолжить", "🚀 Continue"],
  off: ["❌ Bekor qilish", "❌ Отменить", "❌ Cancel"],
};
const t = (l, k) => TEXT[k][L.I(l)];

// Xizmat tugmasi bosildi — eslatma navbatga qo'yiladi (xato bo'lsa jim)
async function noteView(bot, from, chatId, service) {
  try {
    await supabase.from("service_views").upsert({
      user_id: from.id, bot_id: botId(bot), bot, chat_id: chatId, service,
      viewed_at: new Date().toISOString(), pending: true,
    }, { onConflict: "user_id,bot_id" });
  } catch (e) { console.error("Eslatma navbatga qo'yilmadi:", e.message); }
}

// "Bekor qilish": shu xizmat bo'yicha boshqa eslatma bo'lmaydi
async function mute(bot, uid, service) {
  const { data } = await supabase.from("service_views").select("muted").eq("user_id", uid).eq("bot_id", botId(bot)).maybeSingle();
  const muted = Array.from(new Set([...((data && data.muted) || []), service]));
  await supabase.from("service_views").update({ muted, pending: false }).eq("user_id", uid).eq("bot_id", botId(bot));
}

const tashkentHour = (d = new Date()) => (d.getUTCHours() + 5) % 24;

// Navbatdagi eslatmalarni yuboradi (shu deploydagi botlar uchun)
async function runReminders(appUrlFor) {
  const bots = [MAIN, ...extraBots()].filter((b) => token(b));
  const byId = new Map(bots.map((b) => [botId(b), b]));
  const cut = new Date(Date.now() - WAIT_MIN * 60e3).toISOString();
  const { data: rows, error } = await supabase.from("service_views").select("*")
    .eq("pending", true).lte("viewed_at", cut).in("bot_id", [...byId.keys()]).limit(200);
  if (error) throw error;
  const night = tashkentHour() >= 22 || tashkentHour() < 8;
  let sent = 0;
  for (const r of rows || []) {
    const bot = byId.get(r.bot_id);
    const done = (patch) => supabase.from("service_views").update({ pending: false, ...patch }).eq("user_id", r.user_id).eq("bot_id", r.bot_id);
    const dayAgo = Date.now() - 24 * 3600e3;
    if (night || !L.SVC[r.service] || (r.muted || []).includes(r.service) || (r.last_reminded && new Date(r.last_reminded).getTime() > dayAgo)) { await done(); continue; }
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("telegram_user_id", r.user_id).gte("created_at", r.viewed_at);
    if (count) { await done(); continue; }
    const l = await L.getLang(r.user_id);
    if (process.env.REMIND_STICKER) await telegram(bot, "sendSticker", { chat_id: r.chat_id, sticker: process.env.REMIND_STICKER }).catch(() => {});
    const name = L.svcText(l, r.service).replace(/^\S+\s/, "");
    const res = await telegram(bot, "sendMessage", {
      chat_id: r.chat_id,
      text: t(l, "ask").replace("{s}", name),
      reply_markup: { inline_keyboard: [
        [{ text: L.svcText(l, r.service).split(" ")[0] + " " + name, web_app: { url: appUrlFor(bot) + "&open=" + r.service } }],
        [{ text: t(l, "off"), callback_data: "remindoff:" + r.service }],
      ] },
    }).catch(() => null);
    await done({ last_reminded: new Date().toISOString() });
    if (res && res.ok) sent++;
  }
  return { checked: (rows || []).length, sent };
}

module.exports = { noteView, mute, runReminders, botId };
