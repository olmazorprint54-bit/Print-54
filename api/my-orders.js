// api/my-orders.js
// ---------------------------------------------------------------
// Mijozning o'z buyurtmalar tarixini qaytaradi (Telegram user ID
// bo'yicha filtrlangan holda).
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
    const { userId } = req.body || {};
    if (!userId) {
      res.status(400).json({ ok: false, error: "userId kerak" });
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("telegram_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.status(200).json({ ok: true, orders: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
};
