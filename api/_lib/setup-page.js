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
  try {
    const list = await connectBots(host);
    if (!list.length) {
      res.status(200).send(page("Ulanadigan bot yo'q", "<p>Vercel → Settings → Environment Variables bo'limida <b>TELEGRAM_BOT_TOKEN</b> va <b>BOT_MODE=ai</b> borligini tekshiring, so'ng qayta deploy qiling.</p>"));
      return;
    }
    const rows = list.map((b) => `<div class="r">${b.ok
      ? `✅ <b>@${esc(b.username)}</b> — ulandi`
      : `<span class="e">❌ <b>${esc(b.username ? "@" + b.username : b.bot)}</b> — ${esc(b.error)}</span>`}
      ${b.ok && !b.ownerStarted ? `<div class="w">⚠️ Telegram'da @${esc(b.username)} ga kirib <b>/start</b> bosing, keyin shu sahifani yangilang — aks holda buyurtmalar sizga kelmaydi.</div>` : ""}</div>`).join("");
    res.status(200).send(page("🔌 Botni ulash", rows + `<p style="font-size:14px;opacity:.7">Endi botni oching — «Ilova» tugmasi paydo bo'ladi.</p>`));
  } catch (err) {
    console.error(err);
    res.status(500).send(page("❌ Xatolik", "<p>Ulab bo'lmadi. Birozdan so'ng sahifani yangilang.</p>"));
  }
};
