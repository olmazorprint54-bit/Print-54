// api/order-file.js
// ---------------------------------------------------------------
// Mijoz "Buyurtmalarim" bo'limida "Faylni olish" tugmasini bossa,
// tayyor fayl bot orqali uning chatiga qayta yuboriladi. Fayl faqat
// buyurtma egasining o'ziga (Telegram imzosi bo'yicha) va buyurtma
// berilgan bot orqali boradi.
// ---------------------------------------------------------------

const { authUser, orderBot, botKey, sendFile } = require("./_lib/bots");

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
    const orderId = parseInt((req.body || {}).orderId, 10);
    if (!orderId) {
      res.status(400).json({ ok: false, error: "orderId kerak" });
      return;
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, telegram_user_id, file_id, file_name, details")
      .eq("id", orderId)
      .eq("telegram_user_id", auth.user.id)
      .single();

    if (error || !order || !order.file_id) {
      res.status(404).json({ ok: false, error: "Fayl topilmadi" });
      return;
    }

    const bot = orderBot(order);
    // file_id qaysi botga tegishli (ega faylni boshqa botdan yuborgan bo'lishi mumkin)
    const fileBot = botKey((order.details && order.details.fileBot) || bot);
    const topic = order.details && order.details.topic ? `«${order.details.topic}»` : `#${order.id}`;
    const data = await sendFile(fileBot, bot, order.telegram_user_id, order.file_id, order.file_name, { caption: `📎 ${topic}` });
    if (!data.ok) throw new Error("Telegram API xatosi: " + JSON.stringify(data));

    // fayl endi buyurtma botida ham bor — keyingi safar to'g'ridan-to'g'ri yuboriladi
    if (fileBot !== bot && data.result && data.result.document) {
      await supabase
        .from("orders")
        .update({ file_id: data.result.document.file_id, details: { ...order.details, fileBot: bot } })
        .eq("id", order.id);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Faylni yuborib bo'lmadi" });
  }
};
