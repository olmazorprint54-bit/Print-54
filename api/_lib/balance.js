// api/_lib/balance.js
// ---------------------------------------------------------------
// Mijoz balansi (kartaga o'tkazma bilan to'ldiriladi). Alohida jadval
// yo'q — balans "orders" jadvalidan hisoblanadi (daftar):
//   + details.topup bor va to'lov tasdiqlangan (details.payment) -> payment.amount
//   - details.spent — buyurtma uchun balansdan yechilgan summa
// Kamida MIN_TOPUP so'm to'ldiriladi; chek faqat to'ldirishda tekshiriladi.
// ---------------------------------------------------------------
const supabase = require("./db");

const MIN_TOPUP = 5000;
const MAX_TOPUP = 1000000;
const TOPUP_OPTIONS = [5000, 10000, 20000, 50000];

function sumOf(rows) {
  let sum = 0;
  for (const o of rows || []) {
    const d = o.details || {};
    if (d.topup && d.payment) sum += Number(d.payment.amount) || 0;
    if (d.spent) sum -= Number(d.spent) || 0;
  }
  return sum;
}

async function balanceOf(userId) {
  if (!userId) return 0;
  const { data, error } = await supabase.from("orders").select("details").eq("telegram_user_id", userId).limit(5000);
  if (error) throw error;
  return sumOf(data);
}

// Buyurtma uchun yetmasa — eng kam to'ldirish (100 so'mga yaxlitlab) va tanlovlar
function topupNeed(price, balance) {
  const min = Math.max(MIN_TOPUP, Math.ceil((price - balance) / 100) * 100);
  return { min, options: [min, ...TOPUP_OPTIONS.filter((x) => x > min)].slice(0, 4) };
}

module.exports = { MIN_TOPUP, MAX_TOPUP, balanceOf, sumOf, topupNeed };
