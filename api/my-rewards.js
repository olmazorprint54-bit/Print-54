// api/my-rewards.js
// ---------------------------------------------------------------
// Foydalanuvchining bepul varaqlar balansi va taklif qilgan
// do'stlar sonini qaytaradi (faqat o'qish, hech narsa yozmaydi).
// Mijoz Telegram imzosi (initData) bo'yicha aniqlanadi.
// ---------------------------------------------------------------

const { createClient } = require("@supabase/supabase-js");

const { authUser } = require("./_lib/bots");

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
    const auth = authUser(req.body);
    if (!auth) {
      res.status(401).json({ ok: false, error: "Ilovani yopib, qayta oching" });
      return;
    }
    const userId = auth.user.id;

    const { data: userRow, error } = await supabase
      .from("users")
      .select("free_pages, referral_count")
      .eq("telegram_user_id", userId)
      .single();

    // PGRST116 = qator topilmadi (yangi foydalanuvchi) — xato emas
    if (error && error.code !== "PGRST116") throw error;

    res.status(200).json({
      ok: true,
      free_pages: userRow ? userRow.free_pages || 0 : 0,
      referral_count: userRow ? userRow.referral_count || 0 : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Ma'lumotni olib bo'lmadi" });
  }
};
