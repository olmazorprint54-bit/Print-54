// api/_lib/ai.js
// ---------------------------------------------------------------
// Claude (Anthropic API) bilan ishlash: tuzilgan JSON javob olish va
// har bir so'rovning narxini hisoblash. Kalit Vercel env'da:
// ANTHROPIC_API_KEY (kodga yozilmaydi).
// ---------------------------------------------------------------

const { Anthropic } = require("@anthropic-ai/sdk");

// $ / 1 mln token: [kirish, chiqish] (keshdan o'qish — kirishning 10%,
// keshga yozish — 125%)
const PRICES = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [2, 10],
};

const MODEL_NAMES = {
  "claude-opus-5-5": "Opus 5.5",
  "claude-sonnet-5-5": "Sonnet 5.5",
  "claude-haiku-4-5": "Haiku 4.5",
};

// Modelni egasi Vercel env orqali tanlaydi (kodsiz):
//   PRES_MODEL — taqdimot (standart: opus)
//   TEXT_MODEL — mustaqil ish, referat, maqola, test va boshqalar (standart: sonnet)
// Qiymat: "opus" yoki "sonnet". Noto'g'ri qiymat bo'lsa — standart model.
const MODELS = { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5" };
const DEFAULTS = { PRES_MODEL: "opus", TEXT_MODEL: "sonnet" };
function modelChoice(env) {
  const v = String(process.env[env] || "").trim().toLowerCase();
  const key = MODELS[v] ? v : Object.keys(MODELS).find((k) => MODELS[k] === v);
  return { key: key || DEFAULTS[env], valid: !v || !!key, set: !!v };
}
const modelFor = (env) => MODELS[modelChoice(env).key];

const hasKey = () => !!process.env.ANTHROPIC_API_KEY;

let client = null;
const getClient = () => client || (client = new Anthropic({ maxRetries: 2 }));

function costOf(model, usage) {
  const [inP, outP] = PRICES[model] || PRICES["claude-opus-5-5"];
  const u = usage || {};
  const input = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
  return (input * inP + (u.output_tokens || 0) * outP) / 1e6;
}

// Bitta so'rov -> sxemaga mos JSON. Javob uzun bo'lishi mumkin, shuning
// uchun oqim (stream) bilan olinadi. Xavfsizlik filtri noto'g'ri rad etsa,
// so'rov server tomonida boshqa modelda qayta bajariladi (fallbacks).
// content — prompt o'rniga bloklar ro'yxati (hujjat, rasm, matn) bo'lishi mumkin
async function askJson({ model, system, prompt, content, schema, maxTokens = 32000, effort = "medium" }) {
  const stream = getClient().beta.messages.stream({
    model,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: content || prompt }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("AI so'rovni rad etdi");
  if (msg.stop_reason === "max_tokens") throw new Error("AI javobi chegaradan oshdi");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return {
    data: JSON.parse(text),
    model: msg.model,
    usage: { input: msg.usage.input_tokens || 0, output: msg.usage.output_tokens || 0 },
    usd: costOf(msg.model, msg.usage),
  };
}

// Egaga hisobot uchun: "Sonnet 5.5 · 1.2K + 4.5K token · $0.047 (≈ 600 so'm)"
function costLine(ai) {
  const k = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n));
  const rate = Number(process.env.USD_UZS) || 12800;
  const som = Math.round((ai.usd * rate) / 10) * 10;
  return `${MODEL_NAMES[ai.model] || ai.model} · ${k(ai.usage.input)} kirish + ${k(ai.usage.output)} chiqish token · $${ai.usd.toFixed(3)} (≈ ${som.toLocaleString("ru-RU")} so'm)`;
}

module.exports = { hasKey, askJson, costOf, costLine, modelFor, modelChoice, MODEL_NAMES, MODELS };
