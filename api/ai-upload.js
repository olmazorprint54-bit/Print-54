// api/ai-upload.js
// ---------------------------------------------------------------
// AI buyurtma uchun mijoz rasmini qabul qiladi (taqdimotga qo'yish
// uchun). Rasm telefonda kichraytirilib JPEG (base64) bo'lib keladi
// va Supabase Storage'dagi yopiq "ai-uploads" papkasiga saqlanadi.
// Javobda saqlangan yo'l (path) qaytadi — u buyurtma bilan birga
// ai-request.js ga yuboriladi.
//
// Faqat Telegram ichidan kelgan so'rovlar qabul qilinadi (initData
// imzosi bot tokeni bilan tekshiriladi).
// ---------------------------------------------------------------

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = "ai-uploads";
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_AGE = 24 * 60 * 60; // initData 1 kundan eski bo'lmasin

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
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE) return null;
  try {
    const user = JSON.parse(params.get("user") || "null");
    return user && user.id ? user : null;
  } catch (e) {
    return null;
  }
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { error } = await supabase.storage.getBucket(BUCKET);
  if (error) {
    const created = await supabase.storage.createBucket(BUCKET, { public: false });
    if (created.error && !/exist/i.test(created.error.message || "")) throw created.error;
  }
  bucketReady = true;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const user = verifyInitData(body.initData, process.env.TELEGRAM_BOT_TOKEN);
    if (!user) {
      res.status(401).json({ ok: false, error: "Ilovani Telegram ichida oching" });
      return;
    }

    const buf = Buffer.from(String(body.image || ""), "base64");
    const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (!isJpeg || buf.length > MAX_BYTES) {
      res.status(400).json({ ok: false, error: "Rasm noto'g'ri yoki juda katta" });
      return;
    }

    await ensureBucket();
    const path = `${parseInt(user.id, 10)}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: "image/jpeg" });
    if (error) throw error;

    res.status(200).json({ ok: true, path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Rasmni yuklab bo'lmadi" });
  }
};

module.exports.verifyInitData = verifyInitData;
