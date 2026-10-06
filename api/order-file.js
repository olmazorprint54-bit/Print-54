// api/order-file.js
// ---------------------------------------------------------------
// Mijoz "Buyurtmalarim" bo'limida "Faylni olish" tugmasini bossa,
// tayyor fayl bot orqali uning chatiga qayta yuboriladi. Fayl faqat
// buyurtma egasining o'ziga boradi.
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

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, telegram_user_id, file_id, details")
      .eq("id", orderId)
      .eq("telegram_user_id", userId)
      .single();

    if (error || !order || !order.file_id) {
      res.status(404).json({ ok: false, error: "Fayl topilmadi" });
      return;
    }

    const topic = order.details && order.details.topic ? `«${order.details.topic}»` : `#${order.id}`;
    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: order.telegram_user_id, document: order.file_id, caption: `📎 ${topic}` }),
    });
    const data = await tgRes.json();
    if (!data.ok) throw new Error("Telegram API xatosi: " + JSON.stringify(data));

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Faylni yuborib bo'lmadi" });
  }
};
