// api/_lib/bots.js
// ---------------------------------------------------------------
// Bir nechta Telegram bot — bitta server. Har bir botning kaliti
// (masalan "ai") va tokeni Vercel env'da:
//   print54 (asosiy)  -> TELEGRAM_BOT_TOKEN
//   ai                -> TELEGRAM_BOT_TOKEN_AI
//   <kalit>           -> TELEGRAM_BOT_TOKEN_<KALIT>
// Yangi bot qo'shish uchun kod o'zgarmaydi: env'ga token qo'shiladi
// va Print 54 botida egasi /ulash buyrug'ini yuboradi.
//
// Alohida Vercel loyihasi (o'z Supabase'i bilan) faqat AI bot uchun
// bo'lsa: BOT_MODE=ai — asosiy bot (TELEGRAM_BOT_TOKEN) chop etishsiz,
// /start da umumiy ilovani ochadi; APP_BOT — ilovadagi nom/rang kaliti
// (public/app/bots.js). Ulash: https://<loyiha>.vercel.app/api/setup
// Buyurtma qaysi botdan kelgani orders.details.bot da saqlanadi
// (yo'q bo'lsa — print54). Fayl va xabarlar o'sha bot orqali boradi.
// ---------------------------------------------------------------

const crypto = require("crypto");

const MAIN = "print54";
const PREFIX = "TELEGRAM_BOT_TOKEN_";
const INIT_MAX_AGE = 24 * 60 * 60; // initData 1 kundan eski bo'lmasin

const envName = (key) => (key === MAIN ? "TELEGRAM_BOT_TOKEN" : PREFIX + key.toUpperCase());

function token(key) {
  return process.env[envName(key)] || "";
}

// Mijozdan kelgan kalitni tekshiradi: tokeni bor bo'lsa — o'sha, aks holda asosiy bot
function botKey(raw) {
  const key = String(raw || "").toLowerCase();
  return /^[a-z0-9_]{1,32}$/.test(key) && key !== MAIN && token(key) ? key : MAIN;
}

// env'da tokeni bor qo'shimcha botlar
function extraBots() {
  return Object.keys(process.env)
    .filter((k) => k.startsWith(PREFIX) && process.env[k])
    .map((k) => k.slice(PREFIX.length).toLowerCase())
    .filter((k) => /^[a-z0-9_]{1,32}$/.test(k) && k !== MAIN);
}

// Bu Vercel loyihasi faqat AI bot uchunmi (chop etishsiz)
const AI_MODE = process.env.BOT_MODE === "ai";

// Umumiy ilova (public/app) qaysi nom/rang bilan ochilsin
const appKey = (bot) => (bot === MAIN ? process.env.APP_BOT || "ai" : bot);

const orderBot = (order) => botKey(order && order.details && order.details.bot);

async function telegram(key, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token(key)}/${method}`, body instanceof FormData
    ? { method: "POST", body }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  return res.json();
}

// Egaga xabar: avval buyurtma kelgan bot orqali, ega u botda /start
// bosmagan bo'lsa — asosiy (Print 54) bot orqali. Javobda .via — qaysi
// bot yubora oldi (egasining javobini to'g'ri buyurtmaga bog'lash uchun).
async function toOwner(bot, method, body) {
  let out = await telegram(bot, method, body);
  let via = bot;
  if (!out.ok && bot !== MAIN) {
    console.error(`Egaga ${bot} bot orqali yuborib bo'lmadi:`, out.description);
    out = await telegram(MAIN, method, body);
    via = MAIN;
  }
  return { ...out, via };
}

// Telegram file_id faqat o'sha botda ishlaydi. Fayl boshqa botga tegishli
// bo'lsa — yuklab olib, kerakli bot orqali qayta yuboramiz (20 MB gacha).
async function sendFile(fromBot, toBot, chatId, fileId, fileName, extra) {
  if (fromBot === toBot) return telegram(toBot, "sendDocument", { chat_id: chatId, document: fileId, ...extra });
  const info = await telegram(fromBot, "getFile", { file_id: fileId });
  if (!info.ok) return info;
  const file = await fetch(`https://api.telegram.org/file/bot${token(fromBot)}/${info.result.file_path}`);
  if (!file.ok) return { ok: false, description: "Faylni yuklab bo'lmadi: " + file.status };
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", new Blob([await file.arrayBuffer()]), fileName || info.result.file_path.split("/").pop());
  for (const [k, v] of Object.entries(extra || {})) form.append(k, typeof v === "string" ? v : JSON.stringify(v));
  return telegram(toBot, "sendDocument", form);
}

// Telegram Mini App initData imzosini tekshiradi. To'g'ri bo'lsa
// foydalanuvchini, aks holda null qaytaradi.
function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (expected.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;
  const authDate = parseInt(params.get("auth_date"), 10);
  if (!authDate || Date.now() / 1000 - authDate > INIT_MAX_AGE) return null;
  try {
    const user = JSON.parse(params.get("user") || "null");
    return user && user.id ? user : null;
  } catch (e) {
    return null;
  }
}

// So'rov tanasidagi { initData, bot } bo'yicha foydalanuvchini aniqlaydi.
// Qaytaradi: { user, bot } yoki null (imzo noto'g'ri / Telegram tashqarisida)
function authUser(body) {
  const bot = botKey(body && body.bot);
  const user = verifyInitData(body && body.initData, token(bot));
  return user ? { user, bot } : null;
}

// Webhook so'rovlari haqiqatan Telegram'dan kelganini tekshirish uchun
// maxfiy kalit (setWebhook secret_token) — bot tokenidan hosil qilinadi
function webhookSecret(key) {
  return crypto.createHmac("sha256", token(key)).update("tg-webhook").digest("hex").slice(0, 48);
}

module.exports = { MAIN, AI_MODE, appKey, token, botKey, extraBots, orderBot, telegram, toOwner, sendFile, verifyInitData, authUser, webhookSecret };
