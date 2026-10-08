// api/my-orders.js
// ---------------------------------------------------------------
// Mijozning o'z buyurtmalar tarixini qaytaradi. Mijoz Telegram
// imzosi (initData) bo'yicha aniqlanadi — boshqa birovning
// buyurtmalarini ko'rib bo'lmaydi. Har bir bot ilovasida faqat
// o'sha botdan berilgan buyurtmalar ko'rinadi.
// ---------------------------------------------------------------

const { authUser, orderBot } = require("./_lib/bots");

const supabase = require("./_lib/db");

// Mijozga kerak bo'lmagan ichki maydonlar (egaga yuborilgan matn va h.k.)
function publicOrder(o) {
  const d = o.details || {};
  const { text, manualText, ownerBot, fileBot, invoice, payment, ...details } = d;
  return { ...o, details };
}

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

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("telegram_user_id", auth.user.id)
      .eq("hidden_by_customer", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    // to'lov oynasi yopilib, to'lanmay qolgan buyurtmalar ro'yxatda ko'rinmaydi
    const orders = (data || []).filter((o) => orderBot(o) === auth.bot && !(o.details && o.details.awaitingPayment)).slice(0, 50).map(publicOrder);
    res.status(200).json({ ok: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Buyurtmalarni olib bo'lmadi" });
  }
};
