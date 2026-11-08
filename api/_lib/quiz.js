// api/_lib/quiz.js
// ---------------------------------------------------------------
// Botdagi viktorina: 10 ta tasodifiy savol (quiz-bank.js), javob — inline tugmalar.
// Har savolga 30 soniya: kech bosilgan javob noto'g'ri hisoblanadi.
// 10 tadan 9 tasi to'g'ri (90%) bo'lsa — 1 ta bepul AI ish (users.ai_credits). Bonus mijozga BIR MARTA beriladi:
// o'ynash cheklanmagan, lekin bonus olingach keyingi g'alabalarda berilmaydi.
// Holat: Storage ai-uploads/<mijoz>/prefs/quiz.json; bonus belgisi: prefs/bonus-quiz.json (upsert:false).
// ---------------------------------------------------------------
const crypto = require("crypto");
const supabase = require("./db");
const { telegram } = require("./bots");
const BANK = require("./quiz-bank");

const BUCKET = "ai-uploads";
const N = 10, PASS = 9, LIMIT_SEC = 30;
const statePath = (uid) => `${parseInt(uid, 10)}/prefs/quiz.json`;
const markPath = (uid) => `${parseInt(uid, 10)}/prefs/bonus-quiz.json`;
const LET = ["A", "B", "C", "D"];

const T = {
  intro: [
    "🎮 <b>Viktorina</b>\n\n10 ta qiziqarli savol: geografiya, tarix, fan, adabiyot va mantiq. Har savolga 30 soniya.\n\n🎁 10 tadan 9 tasini topsangiz — <b>1 ta tekin ish</b> (kurs ishi va jonli personajdan tashqari). Bonus bir marta beriladi, o'ynash esa cheklanmagan.",
    "🎮 <b>Викторина</b>\n\n10 интересных вопросов (на узбекском): география, история, наука, литература и логика. 30 секунд на вопрос.\n\n🎁 9 из 10 правильных — <b>1 бесплатная работа</b> (кроме курсовой и живого персонажа). Бонус даётся один раз, играть можно сколько угодно.",
    "🎮 <b>Quiz</b>\n\n10 fun questions (in Uzbek): geography, history, science, literature and logic. 30 seconds per question.\n\n🎁 Get 9 of 10 right — <b>1 free order</b> (except coursework and live character). The bonus is given once; play as much as you like.",
  ],
  introDone: ["\n\n✅ Siz bonusni allaqachon olgansiz — endi shunchaki bilimingizni sinang!", "\n\n✅ Вы уже получили бонус — теперь просто проверьте знания!", "\n\n✅ You already got the bonus — now just test yourself!"],
  start: ["▶️ Boshlash", "▶️ Начать", "▶️ Start"],
  again: ["🔁 Yana o'ynash", "🔁 Сыграть ещё", "🔁 Play again"],
  right: ["✅ To'g'ri!", "✅ Верно!", "✅ Correct!"],
  wrong: ["❌ Noto'g'ri. To'g'ri javob: ", "❌ Неверно. Правильный ответ: ", "❌ Wrong. Correct answer: "],
  late: ["⏰ Vaqt tugadi. To'g'ri javob: ", "⏰ Время вышло. Правильный ответ: ", "⏰ Time is up. Correct answer: "],
  result: ["🏁 Natija: <b>{n} / 10</b>", "🏁 Результат: <b>{n} / 10</b>", "🏁 Result: <b>{n} / 10</b>"],
  won: ["🎉 Tabriklaymiz! Sizga <b>1 ta tekin ish</b> berildi. Ilovada buyurtma berishda «🎁 Bonusdan foydalanish» yoqilgan bo'ladi.", "🎉 Поздравляем! Вам начислена <b>1 бесплатная работа</b>. При заказе в приложении включите «🎁 Использовать бонус».", "🎉 Congratulations! You got <b>1 free order</b>. Turn on «🎁 Use bonus» when ordering in the app."],
  wonAgain: ["👏 Ajoyib natija! Bonus avval berilgan, lekin bilimingiz zo'r.", "👏 Отличный результат! Бонус уже был получен, но знания на высоте.", "👏 Great score! The bonus was already given, but well done."],
  lost: ["Bonus uchun kamida 9 ta to'g'ri javob kerak. Yana urinib ko'ring!", "Для бонуса нужно минимум 9 правильных ответов. Попробуйте ещё!", "You need at least 9 correct answers for the bonus. Try again!"],
  old: ["Bu o'yin tugagan. Yangisini boshlang.", "Эта игра завершена. Начните новую.", "This game is over. Start a new one."],
};
const I = (l) => (l === "ru" ? 1 : l === "en" ? 2 : 0);
const tr = (l, k) => T[k][I(l)];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function readJson(p) {
  const { data } = await supabase.storage.from(BUCKET).download(p);
  if (!data) return null;
  try { return JSON.parse(Buffer.from(await data.arrayBuffer()).toString("utf8")); } catch (e) { return null; }
}
async function writeState(uid, st) {
  const { error } = await supabase.storage.from(BUCKET).upload(statePath(uid), Buffer.from(JSON.stringify(st)), { contentType: "application/json", upsert: true });
  if (error) throw error;
}
const bonusTaken = async (uid) => !!(await readJson(markPath(uid)).catch(() => null));

function pick(n) {
  const idx = BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, n).map((q) => {
    const order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = crypto.randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    return { q, order }; // order[k] — k-tugmadagi javob (0 = to'g'ri)
  });
}

async function intro(bot, chatId, uid, l) {
  const done = await bonusTaken(uid);
  return telegram(bot, "sendMessage", {
    chat_id: chatId, parse_mode: "HTML", text: tr(l, "intro") + (done ? tr(l, "introDone") : ""),
    reply_markup: { inline_keyboard: [[{ text: tr(l, "start"), callback_data: "qz:go" }]] },
  });
}

async function sendQuestion(bot, chatId, st) {
  const it = st.qs[st.i], q = BANK[it.q];
  const text = `❓ <b>${st.i + 1}/${N}.</b> ${esc(q[0])}\n\n` + it.order.map((o, k) => `${LET[k]}) ${esc(q[1 + o])}`).join("\n");
  const rows = [[0, 1], [2, 3]].map((r) => r.map((k) => ({ text: LET[k], callback_data: `qz:${st.id}:${st.i}:${k}` })));
  const r = await telegram(bot, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text, reply_markup: { inline_keyboard: rows } });
  st.sentAt = Date.now();
  return r;
}

async function start(bot, chatId, uid) {
  const st = { id: crypto.randomBytes(3).toString("hex"), qs: pick(N), i: 0, ok: 0, at: new Date().toISOString() };
  await sendQuestion(bot, chatId, st);
  await writeState(uid, st);
}

// Bonus: bir martalik belgi (upsert:false — parallel bosishda ham bitta), so'ng ai_credits +1
async function grant(uid) {
  const body = Buffer.from(JSON.stringify({ at: new Date().toISOString() }));
  const { error } = await supabase.storage.from(BUCKET).upload(markPath(uid), body, { contentType: "application/json", upsert: false });
  if (error) return false; // allaqachon bor
  try { await require("./bonus").addCredit(uid); }
  catch (e) { await supabase.storage.from(BUCKET).remove([markPath(uid)]).catch(() => {}); throw e; } // bonus yo'qolmasin
  return true;
}

// cq.data: "qz:go" | "qz:<id>:<i>:<k>"
async function onCallback(bot, cq, l) {
  const uid = cq.from.id, chatId = cq.message && cq.message.chat.id;
  const answer = (text, alert) => telegram(bot, "answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text, show_alert: !!alert } : {}) });
  if (cq.data === "qz:go") { await answer(); await start(bot, chatId, uid); return; }
  const [, id, si, sk] = cq.data.split(":");
  const st = await readJson(statePath(uid)).catch(() => null);
  if (!st || st.id !== id || +si !== st.i) { await answer(tr(l, "old")); return; }
  const it = st.qs[st.i], q = BANK[it.q];
  const late = Date.now() - (st.sentAt || 0) > LIMIT_SEC * 1000;
  const good = !late && it.order[+sk] === 0;
  if (good) st.ok++;
  const correct = q[1];
  await answer(good ? tr(l, "right") : (late ? tr(l, "late") : tr(l, "wrong")) + correct);
  // savol xabarini yopamiz: javob va natija ko'rinadi, tugmalar olib tashlanadi
  const mark = good ? "✅" : late ? "⏰" : "❌";
  await telegram(bot, "editMessageText", {
    chat_id: chatId, message_id: cq.message.message_id, parse_mode: "HTML",
    text: `${mark} <b>${st.i + 1}/${N}.</b> ${esc(q[0])}\n<i>${esc(correct)}</i>`,
  }).catch(() => {});
  st.i++;
  if (st.i < N) { await sendQuestion(bot, chatId, st); await writeState(uid, st); return; }
  st.done = true; await writeState(uid, st);
  let text = tr(l, "result").replace("{n}", st.ok) + "\n\n";
  if (st.ok >= PASS) text += (await grant(uid).catch((e) => { console.error("Viktorina bonusi:", e); return false; })) ? tr(l, "won") : tr(l, "wonAgain");
  else text += tr(l, "lost");
  await telegram(bot, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text, reply_markup: { inline_keyboard: [[{ text: tr(l, "again"), callback_data: "qz:go" }]] } });
}

module.exports = { intro, onCallback, N, PASS };
