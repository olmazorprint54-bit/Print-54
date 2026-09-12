// api/track-visit.js
// ---------------------------------------------------------------
// Mini app ochilganda chaqiriladi — foydalanuvchi va tashrif
// ma'lumotlarini Supabase'ga yozadi (faqat sizga ko'rinadigan
// statistika uchun).
// ---------------------------------------------------------------

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const user = body.user || null;

    // Har bir tashrifni alohida qator sifatida yozamiz
    const { error: visitError } = await supabase.from("visits").insert({
      telegram_user_id: user ? user.id : null,
    });
    if (visitError) throw visitError;

    // Noyob foydalanuvchini yangilaymiz (bor bo'lsa ustiga yozadi)
    if (user && user.id) {
      const { error: userError } = await supabase.from("users").upsert(
        {
          telegram_user_id: user.id,
          username: user.username || null,
          first_name: user.first_name || null,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "telegram_user_id" }
      );
      if (userError) throw userError;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
};
