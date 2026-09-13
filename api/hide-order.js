// api/hide-order.js
// ---------------------------------------------------------------
// Mijoz "Buyurtmalarim" ro'yxatidan (faqat o'zi uchun) bir
// buyurtmani olib tashlaydi. Ma'lumot Supabase'dan o'chmaydi —
// faqat "hidden_by_customer" true qilinadi, shuning uchun sizning
// statistikangizda saqlanib qoladi.
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
    const { orderId, userId } = req.body || {};
    if (!orderId || !userId) {
      res.status(400).json({ ok: false, error: "orderId va userId kerak" });
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({ hidden_by_customer: true })
      .eq("id", orderId)
      .eq("telegram_user_id", userId);

    if (error) throw error;

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
};
