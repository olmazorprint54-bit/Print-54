// api/_lib/db.js
// ---------------------------------------------------------------
// Supabase mijozi. Env noto'g'ri bo'lsa ham funksiya ishga tushadi
// (aks holda Vercel faqat FUNCTION_INVOCATION_FAILED ko'rsatadi):
// bazaga murojaat qilinganda tushunarli xato beriladi, /api/setup
// sahifasi esa qaysi sozlama noto'g'ri ekanini ko'rsatadi.
// ---------------------------------------------------------------

const { createClient } = require("@supabase/supabase-js");

// Kerakli sozlamalar: [nomi, tekshiruv, izoh]. Qiymatlarning o'zi hech qayerda ko'rsatilmaydi.
const CHECKS = [
  ["TELEGRAM_BOT_TOKEN", (v) => /^\d+:[\w-]{30,}$/.test(v), "@BotFather bergan token (123456:ABC...)"],
  ["OWNER_CHAT_ID", (v) => /^-?\d+$/.test(v), "Telegram ID — faqat raqam"],
  ["SUPABASE_URL", (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(v), "https://xxxx.supabase.co"],
  ["SUPABASE_SERVICE_KEY", (v) => /^(sb_secret_|eyJ)/.test(v), "Secret kalit (sb_secret_...) — publishable emas"],
];

// SUPABASE_URL dagi ko'p uchraydigan xatolar (qiymatning o'zi ko'rsatilmaydi)
function urlMistake(v) {
  if (/^(sb_|eyJ)/.test(v)) return "Bu kalit, URL emas";
  if (/supabase\.com/.test(v)) return "Bu Supabase sayti manzili — loyiha URL'i https://<ID>.supabase.co bo'ladi";
  if (!/^https:\/\//.test(v)) return "Boshida https:// yo'q";
  if (/\/(rest|auth)\/v1/.test(v)) return "Oxiridagi /rest/v1 ni olib tashlang";
  if (/\.supabase\.co\/.+/.test(v)) return "supabase.co dan keyingi qismini olib tashlang";
  if (/\s/.test(v)) return "Ichida bo'sh joy bor";
  if (!/\.supabase\.co\/?$/.test(v)) return "Oxiri .supabase.co bilan tugashi kerak";
  return "";
}

// Supabase'dan nusxalanganda ko'p qo'shilib qoladigan "/rest/v1/" qismini olib tashlaymiz
const supabaseUrl = () => String(process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, "");
const envValue = (name) => (name === "SUPABASE_URL" ? supabaseUrl() : String(process.env[name] || "").trim());

function envReport() {
  return CHECKS.map(([name, ok, hint]) => {
    const v = envValue(name);
    const state = !v ? "missing" : ok(v) ? "ok" : "invalid";
    const why = state === "invalid" && name === "SUPABASE_URL" ? urlMistake(v) : "";
    return { name, hint: why ? `${why}. Kerak: ${hint}` : hint, state };
  });
}

let client = null;
let error = null;
try {
  client = createClient(supabaseUrl(), envValue("SUPABASE_SERVICE_KEY"));
} catch (e) {
  error = e;
  console.error("Supabase sozlamasi noto'g'ri:", e.message);
}

// Sozlama xato bo'lsa — har qanday murojaat aniq xato bilan to'xtaydi
const broken = new Proxy({}, {
  get(_, prop) {
    if (prop === "envReport") return envReport;
    if (typeof prop === "symbol" || prop === "then") return undefined;
    throw new Error("Supabase sozlamasi noto'g'ri (SUPABASE_URL / SUPABASE_SERVICE_KEY): " + (error && error.message));
  },
});

if (client) client.envReport = envReport;
module.exports = client || broken;
