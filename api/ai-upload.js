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
const { authUser, verifyInitData } = require("./_lib/bots");

const supabase = require("./_lib/db");
const SRC = require("./_lib/sources");

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

const DOC_EXT = ["pdf", "docx", "xlsx", "xls", "xlsm", "csv", "pptx"];
const DOC_MAX = 15 * 1024 * 1024;
const userErr = (m) => Object.assign(new Error(m), { user: true });
const docDir = (uid) => `${parseInt(uid, 10)}/docs`;
async function saveDocPart(uid, { id, name, index, total, data }) {
  await ensureBucket();
  const ext = String(name || "").toLowerCase().split(".").pop();
  if (!DOC_EXT.includes(ext)) throw userErr("Faqat PDF, Word (.docx), Excel (.xlsx, .xls, .csv) yoki PowerPoint (.pptx) fayl yuklash mumkin.");
  index = parseInt(index, 10); total = parseInt(total, 10);
  if (!(total >= 1 && total <= 7 && index >= 0 && index < total)) throw userErr("Noto'g'ri bo'lak");
  if (index === 0) id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  else if (!/^\d{10,16}-[0-9a-f]{8}$/.test(String(id || ""))) throw userErr("Noto'g'ri bo'lak");
  const buf = Buffer.from(String(data || ""), "base64");
  if (!buf.length || buf.length > 3.6 * 1024 * 1024) throw userErr("Bo'lak juda katta");
  const store = supabase.storage.from(BUCKET);
  const { error } = await store.upload(`${docDir(uid)}/${id}.p${index}`, buf, { contentType: "application/octet-stream", upsert: true });
  if (error) throw error;
  if (index < total - 1) return { id, done: false };
  const parts = [];
  for (let i = 0; i < total; i++) {
    const { data: blob, error: e } = await store.download(`${docDir(uid)}/${id}.p${i}`);
    if (e || !blob) throw new Error("Hujjat bo'lagi topilmadi");
    parts.push(Buffer.from(await blob.arrayBuffer()));
  }
  const full = Buffer.concat(parts);
  const rm = () => store.remove(Array.from({ length: total }, (_, i) => `${docDir(uid)}/${id}.p${i}`)).catch(() => {});
  if (full.length > DOC_MAX) { await rm(); throw userErr("Fayl 15 MB dan katta — kichikroq fayl yuklang."); }
  const magicOk = ext === "pdf" ? full.slice(0, 1024).toString("latin1").includes("%PDF-")
    : ext === "csv" ? !full.slice(0, 2000).includes(0)
    : ext === "xls" ? full[0] === 0xd0 && full[1] === 0xcf
    : full[0] === 0x50 && full[1] === 0x4b; // docx, xlsx, xlsm — zip
  if (!magicOk) { await rm(); throw userErr(ext === "docx" ? "Bu Word (.docx) fayl emas yoki buzilgan." : ext === "pptx" ? "Bu PowerPoint (.pptx) fayl emas yoki buzilgan." : "Fayl turi kengaytmasiga mos kelmaydi yoki buzilgan."); }
  const path = `${docDir(uid)}/${id}.${ext}`;
  const up = await store.upload(path, full, { contentType: "application/octet-stream", upsert: true });
  await rm();
  if (up.error) throw up.error;
  return { id, done: true, path, size: full.length };
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

    // Manbalar (adabiyotlar): bo'laklab yuklash, ro'yxat, o'chirish (api/_lib/sources.js)
    if (body.action === "src-part") {
      try {
        res.status(200).json({ ok: true, ...(await SRC.savePart(auth.user.id, body)) });
      } catch (e) {
        if (!e.user) throw e;
        res.status(400).json({ ok: false, error: e.message });
      }
      return;
    }
    if (body.action === "src-list") {
      res.status(200).json({ ok: true, sources: await SRC.list(auth.user.id), maxFiles: SRC.MAX_FILES, maxPages: SRC.MAX_PAGES });
      return;
    }
    // PDF vositalari: Word/Excel/PDF hujjati (bo'laklab), <mijoz>/docs/<id>.<ext>
    if (body.action === "doc-part") {
      try {
        res.status(200).json({ ok: true, ...(await saveDocPart(auth.user.id, body)) });
      } catch (e) {
        if (!e.user) throw e;
        res.status(400).json({ ok: false, error: e.message });
      }
      return;
    }
    if (body.action === "src-del") {
      await SRC.remove(auth.user.id, body.id);
      res.status(200).json({ ok: true });
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
