// api/_lib/balance.js
// ---------------------------------------------------------------
// Mijoz balansi (kartaga o'tkazma bilan to'ldiriladi). Alohida jadval
// yo'q — balans "orders" jadvalidan hisoblanadi (daftar):
//   + details.topup bor va to'lov tasdiqlangan (details.payment) -> payment.amount
//   - details.spent — buyurtma uchun balansdan yechilgan summa (bekor qilinsa — qaytadi)
// Birinchi to'ldirish kamida MIN_FIRST, keyingilari kamida MIN_NEXT so'm;
// chek faqat to'ldirishda tekshiriladi.
// ---------------------------------------------------------------
const supabase = require("./db");

const MIN_FIRST = 5000;
const MIN_NEXT = 3000;
const MAX_TOPUP = 1000000;

function sumOf(rows) {
  let sum = 0;
  for (const o of rows || []) {
    const d = o.details || {};
    if (d.topup && d.payment) sum += Number(d.payment.amount) || 0;
    if (d.spent && o.status !== "cancelled") sum -= Number(d.spent) || 0;
  }
  return sum;
}

// Balans va eng kam to'ldirish (avval to'ldirgan bo'lsa — MIN_NEXT)
async function walletOf(userId) {
  if (!userId) return { balance: 0, minTopup: MIN_FIRST };
  const { data, error } = await supabase.from("orders").select("status, details").eq("telegram_user_id", userId).limit(5000);
  if (error) throw error;
  const topped = (data || []).some((o) => o.details && o.details.topup && o.details.payment);
  return { balance: sumOf(data), minTopup: topped ? MIN_NEXT : MIN_FIRST };
}
const balanceOf = async (userId) => (await walletOf(userId)).balance;

// Buyurtma uchun yetmasa — eng kam to'ldirish (yetmagan qismi, 100 so'mga yaxlitlab)
function topupNeed(price, balance, minTopup = MIN_FIRST) {
  const min = Math.max(minTopup, Math.ceil((price - balance) / 100) * 100);
  return { min, options: [min] };
}

module.exports = { MIN_FIRST, MIN_NEXT, MAX_TOPUP, walletOf, balanceOf, sumOf, topupNeed };
