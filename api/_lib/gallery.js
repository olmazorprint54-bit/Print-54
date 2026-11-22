// api/_lib/gallery.js
// ---------------------------------------------------------------
// 💎 Super taqdimot shablonlari galereyasi — Telegram chatning o'zida (AI bot).
// Mijoz «💎 Super taqdimot» tugmasini bossa: matnli xabar + toifalar → shablon kartasi (4 slayd kollaji,
// ostida «🎬 Shablonni ko'rish», «◀️ / ▶️», «✅ Tanlash»). Karta BITTA xabarda: editMessageMedia bilan
// rasm ↔ video almashadi, chat to'lib ketmaydi. Toifalar xabari ↔ karta almashganda eskisi o'chiriladi.
// «Tanlash» ilovada Super taqdimot formasini shu shablon bilan ochadi. Har shablonda «Shablon kodi» (t.code) bor —
// mijoz ilovada shu kodni yozsa, shablon o'zi tanlanadi.
// Shablonlar va toifalar public/ai/config.js dan olinadi (alohida ro'yxat yuritilmaydi).
// Media: https://<host>/ai/templates/<id>/card.jpg (muqova + 3 eng chiroyli slayd, reja slaydisiz; yo'q bo'lsa 1.jpg)
// va preview.mp4 (ovozsiz — Telegram GIF kabi aylantiradi).
// Reyting: buyurtmalardagi details.rating (fayl yetkazilgach mijoz qo'ygan baho), 3 ta bahodan keyin ko'rinadi.
// «⭐ Top reyting» toifasi kamida TOP_MIN shablon 3+ baho olgandan keyin o'zi paydo bo'ladi.
// ---------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { telegram } = require("./bots");
const supabase = require("./db");

let CFG = null;
function evalConfig(code) {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.window.AI_CONFIG;
}
// config.js funksiya paketiga kirmagan bo'lsa — saytning o'zidan (statik fayl) olinadi
async function load(host) {
  if (CFG) return CFG;
  try { CFG = evalConfig(fs.readFileSync(path.join(__dirname, "../../public/ai/config.js"), "utf8")); }
  catch (e) { CFG = evalConfig(await (await fetch(`https://${host}/ai/config.js`)).text()); }
  return CFG;
}
const config = () => CFG || { templates: {}, proCategories: [] };
const templates = () => config().templates.presentation_pro || [];
const cats = () => config().proCategories || [];
const TOP_MIN = 5;
const rated = (map) => templates().filter((t) => map[t.id] && map[t.id].n >= 3)
  .sort((a, b) => map[b.id].sum / map[b.id].n - map[a.id].sum / map[a.id].n || map[b.id].n - map[a.id].n);
const listOf = (c, map) => (c === "all" ? templates() : c === "reyting" ? rated(map || {}) : templates().filter((t) => (t.cats || []).includes(c)));
// emoji va bezaksiz nom: «💎 Ochiq kitob · varaq» -> «Ochiq kitob — varaq»
const cleanName = (n) => String(n || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s*[·•|]\s*/g, " — ").replace(/\s+/g, " ").trim();
const catLabel = (c, l) => (c === "all" ? tx(l).all : c === "reyting" ? tx(l).top : (cats().find((x) => x.v === c) || {}).l || c);

const TX = {
  uz: { head: "💎 <b>Super taqdimot</b>\n\nTaqdimotingiz uchun o'zingizga mos shablonni tanlang 👇\n\n<i>Har bir shablonning slaydlari va jonli animatsiyasini shu yerda ko'rasiz.</i>", top: "⭐ Top reyting", code: "🔢 Shablon kodi", all: "📂 Barchasi", look: "🎬 Shablonni ko'rish", photo: "🖼 Rasmga qaytish", prev: "◀️ Oldingi", next: "Keyingi ▶️", pick: "✅ Shu shablonni tanlash", cats: "📂 Toifalar", rate: "baho", anim: "🎬 Animatsiya namunasi", pickHint: "«Tanlash» bosilsa, mavzuni yozib buyurtma berasiz." },
  ru: { head: "💎 <b>Супер-презентация</b>\n\nВыберите подходящий шаблон для вашей презентации 👇\n\n<i>Слайды и живую анимацию каждого шаблона увидите прямо здесь.</i>", top: "⭐ Топ рейтинга", code: "🔢 Код шаблона", all: "📂 Все", look: "🎬 Смотреть шаблон", photo: "🖼 К картинке", prev: "◀️ Назад", next: "Далее ▶️", pick: "✅ Выбрать этот шаблон", cats: "📂 Категории", rate: "оценок", anim: "🎬 Пример анимации", pickHint: "Нажмите «Выбрать», укажите тему и оформите заказ." },
  en: { head: "💎 <b>Super presentation</b>\n\nChoose the template that suits your presentation 👇\n\n<i>See each template's slides and live animation right here.</i>", top: "⭐ Top rated", code: "🔢 Template code", all: "📂 All", look: "🎬 Watch template", photo: "🖼 Back to picture", prev: "◀️ Previous", next: "Next ▶️", pick: "✅ Choose this template", cats: "📂 Categories", rate: "ratings", anim: "🎬 Animation sample", pickHint: "Tap «Choose», write your topic and order." },
};
const tx = (l) => TX[l] || TX.uz;

// ⭐ reytinglar (10 daqiqa xotirada)
let RATE = { at: 0, map: {} };
async function ratings() {
  if (Date.now() - RATE.at < 10 * 60 * 1000) return RATE.map;
  const map = {};
  try {
    const { data } = await supabase.from("orders").select("details").in("service", ["presentation_pro"]).not("details->rating", "is", null).limit(5000);
    (data || []).forEach((o) => {
      const d = o.details || {}; const id = d.fields && d.fields.template; const r = Number(d.rating);
      if (!id || !(r >= 1 && r <= 5)) return;
      const m = (map[id] = map[id] || { sum: 0, n: 0 }); m.sum += r; m.n++;
    });
  } catch (e) { console.error("Reyting:", e); }
  RATE = { at: Date.now(), map };
  return map;
}
const stars = (avg) => "⭐ " + avg.toFixed(1).replace(".", ",");

const media = (host, id, kind) => `https://${host}/ai/templates/${id}/${kind === "video" ? "preview.mp4" : kind === "card" ? "card.jpg" : "1.jpg"}`;
// callback_data: gl:<amal>:<toifa>:<tartib>  (64 baytdan qisqa)
const cb = (a, c, i) => `gl:${a}:${c}:${i}`;

// toifalar (sonsiz — telefonda sig'maydi); «⭐ Top reyting» yetarli baho to'plangandagina
async function catKeyboard(l) {
  const t = tx(l);
  const top = rated(await ratings()).length >= TOP_MIN;
  const rows = [[{ text: t.all, callback_data: cb("c", "all", 0) }]];
  const cs = (top ? [{ text: t.top, callback_data: cb("c", "reyting", 0) }] : [])
    .concat(cats().filter((c) => listOf(c.v).length).map((c) => ({ text: c.l, callback_data: cb("c", c.v, 0) })));
  for (let i = 0; i < cs.length; i += 2) rows.push(cs.slice(i, i + 2));
  return { inline_keyboard: rows };
}

async function card(c, i, l, video, appLink) {
  const t = tx(l);
  const map = await ratings();
  let list = listOf(c, map);
  if (!list.length) { c = "all"; list = templates(); }
  const n = list.length;
  i = ((i % n) + n) % n;
  const tpl = list[i];
  const r = map[tpl.id];
  const caption = `💎 <b>${cleanName(tpl.name)}</b>\n${catLabel(c, l)} · ${i + 1}/${n}` +
    (r && r.n >= 3 ? `\n${stars(r.sum / r.n)} (${r.n} ${t.rate})` : "") +
    (video ? `\n\n${t.anim}` : "") +
    (tpl.code ? `\n\n${t.code}: <b>${tpl.code}</b>` : "") +
    (video ? "" : `\n${t.pickHint}`);
  const kb = [
    [video ? { text: t.photo, callback_data: cb("p", c, i) } : { text: t.look, callback_data: cb("v", c, i) }],
    [{ text: t.prev, callback_data: cb("p", c, i - 1) }, { text: `${i + 1} / ${n}`, callback_data: "noop" }, { text: t.next, callback_data: cb("p", c, i + 1) }],
    [{ text: t.pick, web_app: { url: appLink + "&open=presentation_pro&tpl=" + encodeURIComponent(tpl.id) } }],
    [{ text: t.cats, callback_data: cb("m", c, 0) }],
  ];
  return { tpl, caption, reply_markup: { inline_keyboard: kb } };
}

// Galereyani boshlash: matn + toifalar (rasmsiz)
async function start(bot, chatId, l, host) {
  await load(host);
  return telegram(bot, "sendMessage", { chat_id: chatId, text: tx(l).head, parse_mode: "HTML", reply_markup: await catKeyboard(l) });
}

// karta rasmi: card.jpg (kollaj); yuklanmasa — 1.jpg
async function sendCard(bot, chatId, k, host) {
  const p = { chat_id: chatId, caption: k.caption, parse_mode: "HTML", reply_markup: k.reply_markup };
  const r = await telegram(bot, "sendPhoto", { ...p, photo: media(host, k.tpl.id, "card") });
  if (r && r.ok === false) return telegram(bot, "sendPhoto", { ...p, photo: media(host, k.tpl.id, "photo") });
  return r;
}
async function editCard(bot, msg, k, host, video) {
  const e = (kind) => telegram(bot, "editMessageMedia", { ...msg, media: { type: video ? "animation" : "photo", media: media(host, k.tpl.id, kind), caption: k.caption, parse_mode: "HTML" }, reply_markup: k.reply_markup });
  const r = await e(video ? "video" : "card");
  if (!video && r && r.ok === false && !/not modified/i.test(r.description || "")) return e("photo");
  return r;
}

// gl:* tugmalari
async function onCallback(cq, bot, l, host, appLink) {
  await load(host);
  const m = /^gl:([cmpv]):([a-z]+):(-?\d+)$/.exec(cq.data || "");
  const answer = (text) => telegram(bot, "answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text } : {}) }).catch(() => {});
  if (!m || !cq.message) { await answer(); return; }
  const [, a, c, iStr] = m;
  const msg = { chat_id: cq.message.chat.id, message_id: cq.message.message_id };
  if (c !== "all" && c !== "reyting" && !cats().some((x) => x.v === c)) { await answer(); return; }
  const isMedia = !!(cq.message.photo || cq.message.animation || cq.message.video || cq.message.document);
  const drop = () => telegram(bot, "deleteMessage", msg).catch(() => {});
  if (a === "m") { // kartadan toifalarga: matnli xabar yuboriladi, karta o'chadi
    await answer();
    if (isMedia) { await start(bot, msg.chat_id, l, host); await drop(); }
    else await telegram(bot, "editMessageText", { ...msg, text: tx(l).head, parse_mode: "HTML", reply_markup: await catKeyboard(l) }).catch(() => {});
    return;
  }
  const video = a === "v";
  const k = await card(c, Number(iStr), l, video, appLink);
  await answer(video ? "🎬" : "");
  if (!isMedia) { // toifalar (matnli) xabaridan — yangi karta, toifalar xabari o'chadi
    const r = await sendCard(bot, msg.chat_id, k, host);
    if (r && r.ok !== false) await drop();
    return;
  }
  const r = await editCard(bot, msg, k, host, video);
  // video yo'q yoki yuklanmadi — rasm bilan qoladi
  if (video && r && r.ok === false) {
    console.error("Galereya video:", k.tpl.id, r.description);
    await editCard(bot, msg, await card(c, Number(iStr), l, false, appLink), host, false).catch(() => {});
  }
}

module.exports = { start, onCallback, ratings, templates, cats, cleanName };
