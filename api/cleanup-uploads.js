// api/cleanup-uploads.js
// ---------------------------------------------------------------
// Har kuni (vercel.json -> crons) mijozlar yuklagan eski rasmlarni
// Supabase Storage'dan o'chiradi. Bepul tarifda joy 1 GB — rasmlar
// Telegram'ga yuborilgan yoki PDF ichiga kirgan bo'ladi, ularni uzoq
// saqlash shart emas.
// ---------------------------------------------------------------

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = "ai-uploads";
const KEEP_DAYS = 14;

module.exports = async (req, res) => {
  // CRON_SECRET o'rnatilgan bo'lsa, faqat Vercel cron chaqira oladi
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ ok: false });
    return;
  }

  try {
    const store = supabase.storage.from(BUCKET);
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    const { data: folders, error } = await store.list("", { limit: 1000 });
    if (error) throw error;

    let removed = 0;
    for (const folder of folders || []) {
      if (folder.id) continue; // ildizda faqat foydalanuvchi papkalari bo'ladi
      const { data: files } = await store.list(folder.name, { limit: 1000 });
      const old = (files || [])
        .filter((f) => f.id && new Date(f.created_at).getTime() < cutoff)
        .map((f) => `${folder.name}/${f.name}`);
      if (old.length) {
        await store.remove(old);
        removed += old.length;
      }
    }
    res.status(200).json({ ok: true, removed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
};
