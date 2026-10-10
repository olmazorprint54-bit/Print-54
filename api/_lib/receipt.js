// api/_lib/receipt.js
// ---------------------------------------------------------------
// Kartaga to'lov chekini (skrinshot yoki PDF) AI tekshiradi. Hammasi mos
// kelsa — buyurtma avtomatik tasdiqlanadi, aks holda egasi qo'lda ko'radi.
// Tekshiruv:
//   - bu haqiqatan muvaffaqiyatli o'tkazma cheki;
//   - summa aynan buyurtmaning noyob summasi (masalan 4 517 so'm);
//   - qabul qiluvchi karta oxirgi 4 raqami bizning karta (ko'rinsa);
//   - vaqt: buyurtmadan keyin (eski chekni qayta yuborib bo'lmaydi);
//   - tranzaksiya raqami / rasm avval boshqa buyurtmada ishlatilmagan;
//   - mijoz avval "pul tushmadi" deb belgilanmagan.
// ---------------------------------------------------------------
const { askJson, hasKey, MODELS } = require("./ai");
const { telegram, token } = require("./bots");
const supabase = require("./db");

const MAX_BYTES = 5 * 1024 * 1024;
const TZ_HOURS = 5; // Toshkent vaqti (UTC+5) — cheklardagi vaqt shu bo'yicha
const nullable = (type) => ({ anyOf: [{ type }, { type: "null" }] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_receipt", "success", "amount", "recipient_card_last4", "paid_at", "transaction_id"],
  properties: {
    is_receipt: { type: "boolean", description: "Is this a bank/payment app transfer receipt (Click, Payme, Uzum, bank app, etc.)?" },
    success: { type: "boolean", description: "Does the receipt show the transfer as successful/completed (not pending, not failed)?" },
    amount: { ...nullable("number"), description: "Transferred amount in UZS as a plain number without commission (e.g. 4517). null if not visible." },
    recipient_card_last4: { ...nullable("string"), description: "Last 4 digits of the RECIPIENT card, if visible (e.g. from '8600 **** **** 9012' -> '9012'). null if not visible." },
    paid_at: { ...nullable("string"), description: "Date and time of the transfer as shown, in format YYYY-MM-DD HH:MM. null if not visible." },
    transaction_id: { ...nullable("string"), description: "Transaction / receipt / check number, if visible. null otherwise." },
  },
};

const SYSTEM = "You read payment receipts (screenshots or PDFs) from Uzbek payment apps (Click, Payme, Uzum, Paynet, bank apps). Extract the fields exactly as shown. Do not guess: use null for anything not clearly visible. Amounts like '4 517,00 so'm' or '4,517.00 UZS' mean 4517.";

// Mijoz yuborgan chek -> Claude uchun blok (rasm yoki PDF)
async function fileBlock(bot, msg) {
  let file = null, kind = "image", mime = "image/jpeg";
  if (msg.photo && msg.photo.length) {
    const sizes = [...msg.photo].sort((a, b) => a.width - b.width);
    file = sizes.filter((p) => Math.max(p.width, p.height) <= 1600).pop() || sizes[0];
  } else if (msg.document && /^image\/(jpeg|png|webp)$/.test(msg.document.mime_type || "")) {
    file = msg.document; mime = msg.document.mime_type;
  } else if (msg.document && /pdf$/i.test(msg.document.mime_type || msg.document.file_name || "")) {
    file = msg.document; kind = "document"; mime = "application/pdf";
  }
  if (!file || (file.file_size || 0) > MAX_BYTES) return null;
  const f = await telegram(bot, "getFile", { file_id: file.file_id });
  if (!f.ok) throw new Error("getFile: " + f.description);
  const res = await fetch(`https://api.telegram.org/file/bot${token(bot)}/${f.result.file_path}`);
  if (!res.ok) throw new Error("download " + res.status);
  return { type: kind, source: { type: "base64", media_type: mime, data: Buffer.from(await res.arrayBuffer()).toString("base64") } };
}

// "2026-10-10 18:45" (Toshkent) -> Date
function parseLocal(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ""));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - TZ_HOURS, +m[5]));
  return isNaN(d) ? null : d;
}

const fileKey = (msg) => (msg.photo && msg.photo.length ? msg.photo[msg.photo.length - 1].file_unique_id : msg.document && msg.document.file_unique_id) || null;

// Natija: { ok, reasons: [...], read: {...}, ai, fileKey }
async function verify(bot, msg, order, card) {
  const want = Number(order.details.payAmount || order.total);
  const key = fileKey(msg);
  const reasons = [];
  if (!hasKey()) return { ok: false, reasons: ["AI ulanmagan"], fileKey: key };
  const block = await fileBlock(bot, msg);
  if (!block) return { ok: false, reasons: ["chek rasm yoki PDF emas (yoki 5 MB dan katta)"], fileKey: key };

  const ai = await askJson({
    model: MODELS.sonnet,
    system: SYSTEM,
    content: [block, { type: "text", text: "Extract the receipt fields." }],
    schema: SCHEMA,
    maxTokens: 1000,
    effort: "low",
  });
  const r = ai.data;

  if (!r.is_receipt) reasons.push("to'lov chekiga o'xshamaydi");
  else if (!r.success) reasons.push("to'lov muvaffaqiyatli deb ko'rsatilmagan");
  if (r.amount == null) reasons.push("summa o'qilmadi");
  else if (Math.round(r.amount) !== want) reasons.push(`summa mos emas: chekda ${Math.round(r.amount).toLocaleString("ru-RU")}, kerak ${want.toLocaleString("ru-RU")}`);
  const last4 = card && card.number.replace(/\D/g, "").slice(-4);
  if (r.recipient_card_last4 && last4 && String(r.recipient_card_last4).replace(/\D/g, "").slice(-4) !== last4) reasons.push(`boshqa kartaga: *${r.recipient_card_last4}`);
  const at = parseLocal(r.paid_at);
  if (!at) reasons.push("to'lov vaqti o'qilmadi");
  else {
    const created = new Date(order.created_at).getTime();
    if (at.getTime() < created - 10 * 60e3) reasons.push(`chek buyurtmadan oldingi vaqtda (${r.paid_at})`);
    if (at.getTime() > Date.now() + 10 * 60e3) reasons.push(`chek vaqti kelajakda (${r.paid_at})`);
  }

  // avval ishlatilgan chek yoki "pul tushmadi" deb belgilangan mijoz
  const since = new Date(Date.now() - 30 * 24 * 3600e3).toISOString();
  const { data: recent } = await supabase.from("orders").select("id, telegram_user_id, details").gte("created_at", since).limit(2000);
  for (const o of recent || []) {
    if (o.id === order.id || !o.details) continue;
    const p = o.details.payment || {};
    if (r.transaction_id && p.txn && String(p.txn) === String(r.transaction_id)) reasons.push(`bu chek #${o.id} buyurtmada ishlatilgan`);
    else if (key && p.fileKey === key) reasons.push(`bu rasm #${o.id} buyurtmada ishlatilgan`);
    if (o.details.fraud && String(o.telegram_user_id) === String(order.telegram_user_id)) reasons.push(`mijoz avval #${o.id} da "pul tushmadi" deb belgilangan`);
  }

  return { ok: !reasons.length, reasons: [...new Set(reasons)], read: r, ai, fileKey: key };
}

// Har bir buyurtmaga noyob summa (narx + 1..99 so'm): egasi Click/Payme xabaridagi
// summadan qaysi buyurtma ekanini taniydi, chekni boshqa buyurtmaga ishlatib bo'lmaydi
async function uniqueAmount(price) {
  const since = new Date(Date.now() - 48 * 3600e3).toISOString();
  const { data } = await supabase.from("orders").select("id, details").gte("created_at", since).limit(2000);
  const taken = new Set((data || []).map((o) => o.details && o.details.payAmount).filter(Boolean));
  const free = [];
  for (let k = 1; k <= 99; k++) if (!taken.has(price + k)) free.push(price + k);
  if (!free.length) return price + 1 + Math.floor(Math.random() * 99);
  return free[Math.floor(Math.random() * free.length)];
}

module.exports = { verify, uniqueAmount, parseLocal, fileKey, SCHEMA };
