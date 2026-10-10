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
  const { text, manualText, ownerBot, fileBot, invoice, payment, payMsg, receipt, ...details } = d;
  // kartaga to'lov: "to'lov kutilmoqda" yoki "chek tekshirilmoqda"
  if (d.awaitingPayment && d.payMethod === "card") details.payState = receipt ? "checking" : "waiting";
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

    // Hammasi (o'chirilganlari ham) — mijozning o'z tartib raqami (1, 2, 3 ...) o'chirishdan keyin ham o'zgarmasin
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("telegram_user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (error) throw error;

    // to'lov oynasi (Click/Payme) yopilib, to'lanmay qolgan buyurtmalar hisoblanmaydi va ko'rinmaydi;
    // kartaga to'lov kutilayotganlari ko'rinadi (chek yuborish, bekor qilish)
    const mine = (data || []).filter((o) => orderBot(o) === auth.bot && !(o.details && o.details.awaitingPayment && o.details.payMethod !== "card"));
    mine.forEach((o, i) => { o.n = i + 1; });
    const orders = mine.filter((o) => !o.hidden_by_customer).reverse().slice(0, 50).map(publicOrder);
    res.status(200).json({ ok: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Buyurtmalarni olib bo'lmadi" });
  }
};
