// api/_lib/setup.js
// ---------------------------------------------------------------
// Botlarni shu serverga ulaydi: webhook (maxfiy kalit bilan) va
// "Ilova" tugmasi (umumiy AI ilova). Print 54 rejimida faqat
// qo'shimcha botlar ulanadi — Print 54 ning o'z tugmasiga tegilmaydi.
// BOT_MODE=ai bo'lgan alohida loyihada asosiy bot ham ulanadi.
// Chaqiriladi: Print 54 botida /ulash yoki /api/setup sahifasi.
// ---------------------------------------------------------------

const { MAIN, AI_MODE, appKey, extraBots, telegram, webhookSecret } = require("./bots");

const appUrl = (host, bot) => `https://${host}/app/?b=${encodeURIComponent(appKey(bot))}`;
const hookUrl = (host, bot) => `https://${host}/api/telegram-webhook${bot === MAIN ? "" : "?b=" + encodeURIComponent(bot)}`;

// Har bir bot uchun natija: { bot, username, ok, ownerStarted, error }
async function connectBots(host) {
  const bots = AI_MODE ? [MAIN, ...extraBots()] : extraBots();
  const out = [];
  for (const bot of bots) {
    const me = await telegram(bot, "getMe", {});
    if (!me.ok) {
      out.push({ bot, ok: false, error: "token noto'g'ri" });
      continue;
    }
    const hook = await telegram(bot, "setWebhook", {
      url: hookUrl(host, bot),
      secret_token: webhookSecret(bot),
      allowed_updates: ["message", "callback_query", "pre_checkout_query"],
    });
    const menu = await telegram(bot, "setChatMenuButton", {
      menu_button: { type: "web_app", text: "Ilova", web_app: { url: appUrl(host, bot) } },
    });
    const hello = await telegram(bot, "sendMessage", {
      chat_id: process.env.OWNER_CHAT_ID,
      text: "✅ Bot serverga ulandi. Buyurtmalar shu chatga keladi.",
    });
    out.push({
      bot,
      username: me.result.username,
      ok: !!(hook.ok && menu.ok),
      ownerStarted: !!hello.ok,
      error: hook.ok && menu.ok ? null : (hook.ok ? menu : hook).description || "xato",
    });
  }
  return out;
}

module.exports = { connectBots, appUrl, hookUrl };
