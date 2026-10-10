// api/_lib/setup-page.js
// ---------------------------------------------------------------
// Yangi Vercel loyihasidagi botni ulash: deploy'dan keyin brauzerda
// https://<loyiha>.vercel.app/api/setup ni bir marta oching (vercel.json uni
// telegram-webhook.js ga yo'naltiradi — Hobby tarifida 12 tadan ortiq
// funksiya bo'lishi mumkin emas).
// Botlar faqat shu loyihaning asosiy (production) manziliga ulanadi,
// shuning uchun buni kim ochsa ham zarari yo'q — natija bir xil.
// ---------------------------------------------------------------

const { connectBots } = require("./setup");
const { envReport } = require("./db");

// Sozlamalar holati (qiymatlar ko'rsatilmaydi, faqat bor/yo'q/noto'g'ri)
function envHtml() {
  const rows = envReport();
  const extra = [
    { name: "ANTHROPIC_API_KEY", state: /^sk-ant-/.test(String(process.env.ANTHROPIC_API_KEY || "").trim()) ? "ok" : process.env.ANTHROPIC_API_KEY ? "invalid" : "missing", hint: "AI uchun (sk-ant-...) — bo'lmasa AI xizmatlari qo'lda" },
    { name: "BOT_MODE", state: process.env.BOT_MODE === "ai" ? "ok" : "missing", hint: "ai" },
    { name: "GITHUB_TOKEN", state: process.env.GITHUB_TOKEN ? "ok" : "missing", hint: "Taqdimot shablonlarini o'qish uchun (yopiq repozitoriya)" },
    { name: "PIXABAY_API_KEY", state: process.env.PIXABAY_API_KEY || process.env.PEXELS_API_KEY ? "ok" : "missing", hint: "Taqdimotga mavzuga mos rasmlar (pixabay.com/api/docs)" },
    ...["PRES_MODEL", "TEXT_MODEL", "CHAT_MODEL"].map((name) => {
      const { modelChoice, MODELS, MODEL_NAMES } = require("./ai");
      const c = modelChoice(name);
      return { name, state: c.valid ? "ok" : "invalid", hint: `Hozir: ${MODEL_NAMES[MODELS[c.key]]}${c.set ? "" : " (standart)"} — qiymati: opus yoki sonnet` };
    }),
  ];
  const known = new Set(["TELEGRAM_BOT_TOKEN", "OWNER_CHAT_ID", "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "ANTHROPIC_API_KEY", "BOT_MODE", "APP_BOT", "USD_UZS", "CRON_SECRET", "PEXELS_API_KEY", "PIXABAY_API_KEY", "GITHUB_TOKEN", "TEMPLATES_REPO", "PAYMENT_PROVIDER_TOKEN", "FREE_DAILY", "PRES_MODEL", "TEXT_MODEL", "CHAT_MODEL", "FREE_CHAT_DAILY"]);
  // nomi xato yozilgan bo'lishi mumkin bo'lganlar (masalan SUPABASE_URL2)
  const odd = Object.keys(process.env).filter((k) => /^(SUPABASE|TELEGRAM|OWNER|ANTHROPIC|BOT_|APP_)/.test(k) && !known.has(k) && !/^TELEGRAM_BOT_TOKEN_[A-Z0-9_]+$/.test(k));
  const icon = { ok: "✅", missing: "❌ yo'q", invalid: "⚠️ noto'g'ri" };
  // taqdimot: AI tayyorlaydigan shablonlar soni (api/_lib/pres/*.json server bilan birga kelganmi)
  let presCount = 0;
  try { presCount = require("fs").readdirSync(require("path").join(__dirname, "pres")).filter((f) => f.endsWith(".json")).length; } catch (e) { /* yo'q */ }
  extra.push({ name: `Taqdimot shablonlari: ${presCount} ta`, state: presCount ? "ok" : "missing", hint: "api/_lib/pres/*.json" });
  const all = [...rows, ...extra];
  const html = `<table style="width:100%;border-collapse:collapse;font-size:14px">${all.map((r) => `<tr class="r"><td style="padding:6px 0"><code>${r.name}</code></td><td>${icon[r.state]}</td></tr>${r.state === "ok" ? "" : `<tr><td colspan="2" class="w" style="padding-bottom:6px">${esc(r.hint)}</td></tr>`}`).join("")}</table>`
    + (odd.length ? `<p class="w">Tushunarsiz nomlar (to'g'ri nomga o'zgartiring yoki o'chiring): ${odd.map((k) => `<code>${esc(k)}</code>`).join(", ")}</p>` : "");
  return { html, ok: rows.every((r) => r.state === "ok") };
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function page(title, body) {
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Botni ulash</title><style>
body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#F5F6FA;color:#111827;padding:24px 16px}
.c{max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 6px 24px rgba(17,24,39,.08)}
h1{font-size:20px;margin:0 0 14px}.r{padding:12px 0;border-top:1px solid #EEF0F4}.w{color:#B45309;font-size:14px}.e{color:#DC2626}
@media (prefers-color-scheme:dark){body{background:#0B0B14;color:#E5E7EB}.c{background:#161625;box-shadow:none}.r{border-color:#2A2A3D}}
</style></head><body><div class="c"><h1>${title}</h1>${body}</div></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  // Faqat asosiy manzil: sinov (preview) manzillariga ulanib qolmasin
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV !== "production" || !host) {
    res.status(400).send(page("⚠️ Faqat asosiy manzilda", "<p>Bu sahifani loyihaning asosiy (production) manzilida oching.</p>"));
    return;
  }
  const env = envHtml();
  if (!env.ok) {
    res.status(200).send(page("⚙️ Sozlamalarni tuzating", `<p>Vercel → Settings → Environment Variables bo'limida quyidagilarni to'g'rilang, so'ng <b>Redeploy</b> qiling va sahifani yangilang.</p>${env.html}`));
    return;
  }
  try {
    const list = await connectBots(host);
    if (!list.length) {
      res.status(200).send(page("Ulanadigan bot yo'q", "<p>Vercel → Settings → Environment Variables bo'limida <b>TELEGRAM_BOT_TOKEN</b> va <b>BOT_MODE=ai</b> borligini tekshiring, so'ng qayta deploy qiling.</p>" + env.html));
      return;
    }
    const rows = list.map((b) => `<div class="r">${b.ok
      ? `✅ <b>@${esc(b.username)}</b> — ulandi`
      : `<span class="e">❌ <b>${esc(b.username ? "@" + b.username : b.bot)}</b> — ${esc(b.error)}</span>`}
      ${b.ok && !b.ownerStarted ? `<div class="w">⚠️ Telegram'da @${esc(b.username)} ga kirib <b>/start</b> bosing, keyin shu sahifani yangilang — aks holda buyurtmalar sizga kelmaydi.</div>` : ""}</div>`).join("");
    res.status(200).send(page("🔌 Botni ulash", rows + `<details style="margin-top:14px"><summary>Sozlamalar</summary>${env.html}</details>` + `<p style="font-size:14px;opacity:.7">Endi botni oching — «Ilova» tugmasi paydo bo'ladi.</p>`));
  } catch (err) {
    console.error(err);
    res.status(500).send(page("❌ Xatolik", "<p>Ulab bo'lmadi. Birozdan so'ng sahifani yangilang.</p>"));
  }
};
