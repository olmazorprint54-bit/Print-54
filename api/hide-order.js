// api/hide-order.js
// ---------------------------------------------------------------
// Mijoz "Buyurtmalarim" ro'yxatidan (faqat o'zi uchun) bir
// buyurtmani olib tashlaydi. Ma'lumot Supabase'dan o'chmaydi —
// faqat "hidden_by_customer" true qilinadi, shuning uchun sizning
// statistikangizda saqlanib qoladi. Mijoz Telegram imzosi bo'yicha
// aniqlanadi.
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
    const orderId = parseInt((req.body || {}).orderId, 10);
    if (!orderId) {
      res.status(400).json({ ok: false, error: "orderId kerak" });
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({ hidden_by_customer: true })
      .eq("id", orderId)
      .eq("telegram_user_id", auth.user.id);

    if (error) throw error;

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Buyurtmani olib tashlab bo'lmadi" });
  }
};
