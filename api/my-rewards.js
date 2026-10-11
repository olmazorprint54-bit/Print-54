// api/my-rewards.js
// ---------------------------------------------------------------
// Foydalanuvchining bepul varaqlar balansi va taklif qilgan
// do'stlar sonini qaytaradi (faqat o'qish, hech narsa yozmaydi).
// Mijoz Telegram imzosi (initData) bo'yicha aniqlanadi.
// ---------------------------------------------------------------


const { authUser, AI_MODE } = require("./_lib/bots");
const { rewardsOf } = require("./_lib/referral");
const { walletOf, MIN_FIRST } = require("./_lib/balance");
const { bonusTasks, claimBonus, giftsOf } = require("./_lib/bonus");

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
    const userId = auth.user.id;

    // Ilova profilida til tanlandi — bot xabarlari ham shu tilda bo'lsin
    if ((req.body || {}).setLang) {
      const ok = await require("./_lib/i18n-bot").setLang(userId, String(req.body.setLang)).catch((e) => { console.error("Til:", e); return false; });
      res.status(200).json({ ok: !!ok });
      return;
    }

    // Obuna bonusi: Telegram kanal (bot tekshiradi) yoki Instagram — bir martalik sovg'a
    // (AI bot: 1 ta bepul buyurtma; hisoblash boti: 1 ta AI xizmat yoki 10 ta bepul varaq)
    if ((req.body || {}).claim) {
      const r = await claimBonus(auth.bot, userId, String(req.body.claim));
      res.status(200).json(r);
      return;
    }

    // Alohida AI bot: bepul AI buyurtmalar (referal va obuna bonuslari)
    if (AI_MODE) {
      const [ai, w, tasks] = await Promise.all([
        rewardsOf(auth.bot, userId),
        walletOf(userId).catch(() => ({ balance: 0, minTopup: MIN_FIRST, firstFree: false })),
        bonusTasks(userId).catch(() => ({})),
      ]);
      res.status(200).json({ ok: true, ai, tasks, balance: w.balance, minTopup: w.minTopup, firstFree: !!w.firstFree && process.env.FIRST_FREE !== "0" });
      return;
    }

    const { data: userRow, error } = await supabase
      .from("users")
      .select("free_pages, referral_count")
      .eq("telegram_user_id", userId)
      .single();

    // PGRST116 = qator topilmadi (yangi foydalanuvchi) — xato emas
    if (error && error.code !== "PGRST116") throw error;

    // AI xizmatlar balansi (kartaga to'ldiriladi) va obuna sovg'alari
    const [w, gift, tasks] = await Promise.all([
      walletOf(userId).catch(() => ({ balance: 0, minTopup: MIN_FIRST })),
      giftsOf(userId).catch(() => ({ ai: 0, pages: 0 })),
      bonusTasks(userId).catch(() => ({})),
    ]);
    res.status(200).json({
      ok: true,
      // bepul varaqlar = referal varaqlari + ochiq sovg'alar varaqlari
      free_pages: (userRow ? userRow.free_pages || 0 : 0) + gift.pages,
      gift,
      tasks,
      referral_count: userRow ? userRow.referral_count || 0 : 0,
      balance: w.balance,
      minTopup: w.minTopup,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Ma'lumotni olib bo'lmadi" });
  }
};
