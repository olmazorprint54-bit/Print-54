// api/ai-upload.js
// ---------------------------------------------------------------
// AI buyurtma uchun mijoz rasmini qabul qiladi (taqdimotga qo'yish
// uchun). Rasm telefonda kichraytirilib JPEG (base64) bo'lib keladi
// va Supabase Storage'dagi yopiq "ai-uploads" papkasiga saqlanadi.
// Javobda saqlangan yo'l (path) qaytadi — u buyurtma bilan birga
// ai-request.js ga yuboriladi.
//
// Faqat Telegram ichidan kelgan so'rovlar qabul qilinadi (initData
// imzosi ilova ochilgan botning tokeni bilan tekshiriladi).
// ---------------------------------------------------------------

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { authUser, verifyInitData } = require("./_lib/bots");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = "ai-uploads";
const MAX_BYTES = 3 * 1024 * 1024;

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
    const auth = authUser(body);
    if (!auth) {
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
    const path = `${parseInt(auth.user.id, 10)}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: "image/jpeg" });
    if (error) throw error;

    res.status(200).json({ ok: true, path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Rasmni yuklab bo'lmadi" });
  }
};

module.exports.verifyInitData = verifyInitData;
