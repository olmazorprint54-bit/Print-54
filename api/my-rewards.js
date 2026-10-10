// api/my-rewards.js
// ---------------------------------------------------------------
// Foydalanuvchining bepul varaqlar balansi va taklif qilgan
// do'stlar sonini qaytaradi (faqat o'qish, hech narsa yozmaydi).
// Mijoz Telegram imzosi (initData) bo'yicha aniqlanadi.
// ---------------------------------------------------------------


const { authUser, AI_MODE } = require("./_lib/bots");
const { rewardsOf } = require("./_lib/referral");
const { balanceOf } = require("./_lib/balance");

const supabase = require("./_lib/db");

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

    // Alohida AI bot: bepul AI buyurtmalar (referal bonusi)
    if (AI_MODE) {
      const [ai, balance] = await Promise.all([rewardsOf(auth.bot, userId), balanceOf(userId).catch(() => 0)]);
      res.status(200).json({ ok: true, ai, balance });
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
    res.status(500).json({ ok: false, error: "Ma'lumotni olib bo'lmadi" });
  }
};
