/* ================================================================
   BOTLAR — bitta umumiy AI ilova, har bir bot o'z nomi va rangi bilan.
   Bot ilovani shunday ochadi: https://print-54.vercel.app/app/?b=<kalit>
   Kalit serverdagi token nomi bilan bir xil: "ai" -> TELEGRAM_BOT_TOKEN_AI
   (Vercel env). Yangi bot: shu yerga qo'shing, tokenni Vercel'ga
   qo'shing va Print 54 botida /ulash yuboring.
   accent — yorug' temadagi asosiy rang, accentDark — qorong'i temada.
   contact — "Biz bilan bog'lanish" havolasi.
   ================================================================ */
window.APP_BOTS = {
  ai: { name: "AI Yordamchi", logo: "AI", accent: "#4F46E5", accentDark: "#22D3EE", contact: "https://t.me/Print_54" },
};
window.APP_BOT_DEFAULT = "ai";
window.APP_BOT_KEY = (function () {
  var k = "";
  try { k = (new URLSearchParams(location.search).get("b") || "").toLowerCase(); } catch (e) {}
  return /^[a-z0-9_]{1,32}$/.test(k) ? k : window.APP_BOT_DEFAULT;
})();
