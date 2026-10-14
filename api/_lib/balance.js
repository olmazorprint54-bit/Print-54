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

// Birinchi AI ishi tekin (AI botda, kurs ishidan tashqari): mijozda hali pullik AI
// buyurtma (bekor qilinmagan, to'lov kutmayotgan) bo'lmasa. Tekin xizmatlar
// (resume, obyektivka), chop etish va to'ldirishlar hisobga kirmaydi.
const NOT_AI = ["paper", "book", "binding", "topup", "resume", "obyektivka", "img2pdf", "word2pdf", "excel2pdf", "pptx2pdf", "pdfmerge", "pdfsplit", "pdf2word", "pdf2pptx"];
const FIRST_FREE_EXCEPT = ["kurs"];
const hadAiOrder = (rows) => (rows || []).some((o) => !NOT_AI.includes(o.service) && o.status !== "cancelled" && !(o.details && o.details.awaitingPayment));

// Balans, eng kam to'ldirish (avval to'ldirgan bo'lsa — MIN_NEXT) va birinchi ish tekinligi
async function walletOf(userId) {
  if (!userId) return { balance: 0, minTopup: MIN_FIRST, firstFree: false };
  const { data, error } = await supabase.from("orders").select("service, status, details").eq("telegram_user_id", userId).limit(5000);
  if (error) throw error;
  const topped = (data || []).some((o) => o.details && o.details.topup && o.details.payment);
  return { balance: sumOf(data), minTopup: topped ? MIN_NEXT : MIN_FIRST, firstFree: !hadAiOrder(data) };
}
const balanceOf = async (userId) => (await walletOf(userId)).balance;

// Buyurtma uchun yetmasa — eng kam to'ldirish (yetmagan qismi, 100 so'mga yaxlitlab)
function topupNeed(price, balance, minTopup = MIN_FIRST) {
  const min = Math.max(minTopup, Math.ceil((price - balance) / 100) * 100);
  return { min, options: [min] };
}

module.exports = { MIN_FIRST, MIN_NEXT, MAX_TOPUP, FIRST_FREE_EXCEPT, walletOf, balanceOf, sumOf, topupNeed };
