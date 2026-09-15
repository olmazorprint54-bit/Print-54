// api/my-rewards.js
// ---------------------------------------------------------------
// Foydalanuvchining bepul varaqlar balansi va taklif qilgan
// do'stlar sonini qaytaradi (faqat o'qish, hech narsa yozmaydi).
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
    const userId = body.userId;

    if (!userId) {
      res.status(400).json({ ok: false, error: "userId kerak" });
      return;
    }

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
    res.status(500).json({ ok: false, error: String(err) });
  }
};
