// api/_lib/gallery.js
// ---------------------------------------------------------------
// 💎 Super taqdimot shablonlari galereyasi — Telegram chatning o'zida (AI bot).
// Mijoz «💎 Super taqdimot» tugmasini bossa: toifalar → shablon rasmi (ostida «🎬 Shablonni ko'rish»,
// «◀️ / ▶️», «✅ Tanlash»). Hammasi BITTA xabarda: editMessageMedia bilan rasm ↔ video almashadi,
// chat to'lib ketmaydi. «Tanlash» ilovada Super taqdimot formasini shu shablon bilan ochadi.
// Shablonlar va toifalar public/ai/config.js dan olinadi (alohida ro'yxat yuritilmaydi).
// Media: https://<host>/ai/templates/<id>/1.jpg va preview.mp4 (ovozsiz — Telegram GIF kabi aylantiradi).
// Reyting: buyurtmalardagi details.rating (fayl yetkazilgach mijoz qo'ygan baho), 3 ta bahodan keyin ko'rinadi.
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
const listOf = (c) => (c === "all" ? templates() : templates().filter((t) => (t.cats || []).includes(c)));
// emoji va bezaksiz nom: «💎 Ochiq kitob · varaq» -> «Ochiq kitob — varaq»
const cleanName = (n) => String(n || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s*[·•|]\s*/g, " — ").replace(/\s+/g, " ").trim();
const catLabel = (c) => (c === "all" ? "📂 Barchasi" : (cats().find((x) => x.v === c) || {}).l || c);

const TX = {
  uz: { head: "💎 <b>Super taqdimot shablonlari</b>\n\nMorph animatsiyali premium dizaynlar. Toifani tanlang — har bir shablonning rasmini va jonli animatsiyasini shu yerda ko'rasiz 👇", all: "📂 Barchasi", look: "🎬 Shablonni ko'rish", photo: "🖼 Rasmga qaytish", prev: "◀️ Oldingi", next: "Keyingi ▶️", pick: "✅ Shu shablonni tanlash", cats: "📂 Toifalar", rate: "baho", anim: "🎬 Animatsiya namunasi", pickHint: "«Tanlash» bosilsa, mavzuni yozib buyurtma berasiz." },
  ru: { head: "💎 <b>Шаблоны супер-презентации</b>\n\nПремиум-дизайны с анимацией Morph. Выберите категорию — картинку и живую анимацию каждого шаблона увидите прямо здесь 👇", all: "📂 Все", look: "🎬 Смотреть шаблон", photo: "🖼 К картинке", prev: "◀️ Назад", next: "Далее ▶️", pick: "✅ Выбрать этот шаблон", cats: "📂 Категории", rate: "оценок", anim: "🎬 Пример анимации", pickHint: "Нажмите «Выбрать», укажите тему и оформите заказ." },
  en: { head: "💎 <b>Super presentation templates</b>\n\nPremium Morph-animated designs. Pick a category — see each template's picture and live animation right here 👇", all: "📂 All", look: "🎬 Watch template", photo: "🖼 Back to picture", prev: "◀️ Previous", next: "Next ▶️", pick: "✅ Choose this template", cats: "📂 Categories", rate: "ratings", anim: "🎬 Animation sample", pickHint: "Tap «Choose», write your topic and order." },
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

const media = (host, id, kind) => `https://${host}/ai/templates/${id}/${kind === "video" ? "preview.mp4" : "1.jpg"}`;
// callback_data: gl:<amal>:<toifa>:<tartib>  (64 baytdan qisqa)
const cb = (a, c, i) => `gl:${a}:${c}:${i}`;

function catKeyboard(l) {
  const t = tx(l);
  const rows = [[{ text: `${t.all} (${templates().length})`, callback_data: cb("c", "all", 0) }]];
  const cs = cats().map((c) => ({ text: `${c.l} (${listOf(c.v).length})`, callback_data: cb("c", c.v, 0) }));
  for (let i = 0; i < cs.length; i += 2) rows.push(cs.slice(i, i + 2));
  return { inline_keyboard: rows };
}

async function card(c, i, l, video, appLink) {
  const t = tx(l);
  const list = listOf(c);
  const n = list.length;
  i = ((i % n) + n) % n;
  const tpl = list[i];
  const r = (await ratings())[tpl.id];
  const caption = `💎 <b>${cleanName(tpl.name)}</b>\n${catLabel(c)} · ${i + 1}/${n}` +
    (r && r.n >= 3 ? `\n${stars(r.sum / r.n)} (${r.n} ${t.rate})` : "") +
    (video ? `\n\n${t.anim}` : `\n\n${t.pickHint}`);
  const kb = [
    [video ? { text: t.photo, callback_data: cb("p", c, i) } : { text: t.look, callback_data: cb("v", c, i) }],
    [{ text: t.prev, callback_data: cb("p", c, i - 1) }, { text: `${i + 1} / ${n}`, callback_data: "noop" }, { text: t.next, callback_data: cb("p", c, i + 1) }],
    [{ text: t.pick, web_app: { url: appLink + "&open=presentation_pro&tpl=" + encodeURIComponent(tpl.id) } }],
    [{ text: t.cats, callback_data: cb("m", c, 0) }],
  ];
  return { tpl, caption, reply_markup: { inline_keyboard: kb } };
}

// Galereyani boshlash: muqova (eng yangi shablon rasmi) + toifalar
async function start(bot, chatId, l, host) {
  await load(host);
  const first = templates()[templates().length - 1];
  return telegram(bot, "sendPhoto", { chat_id: chatId, photo: media(host, first.id, "photo"), caption: tx(l).head, parse_mode: "HTML", reply_markup: catKeyboard(l) });
}

// gl:* tugmalari
async function onCallback(cq, bot, l, host, appLink) {
  await load(host);
  const m = /^gl:([cmpv]):([a-z]+):(-?\d+)$/.exec(cq.data || "");
  const answer = (text) => telegram(bot, "answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text } : {}) }).catch(() => {});
  if (!m || !cq.message) { await answer(); return; }
  const [, a, c, iStr] = m;
  const msg = { chat_id: cq.message.chat.id, message_id: cq.message.message_id };
  if (c !== "all" && !cats().some((x) => x.v === c)) { await answer(); return; }
  if (a === "m") {
    const first = templates()[templates().length - 1];
    await answer();
    await telegram(bot, "editMessageMedia", { ...msg, media: { type: "photo", media: media(host, first.id, "photo"), caption: tx(l).head, parse_mode: "HTML" }, reply_markup: catKeyboard(l) });
    return;
  }
  const video = a === "v";
  const k = await card(c, Number(iStr), l, video, appLink);
  await answer(video ? "🎬" : "");
  const r = await telegram(bot, "editMessageMedia", {
    ...msg,
    media: { type: video ? "animation" : "photo", media: media(host, k.tpl.id, video ? "video" : "photo"), caption: k.caption, parse_mode: "HTML" },
    reply_markup: k.reply_markup,
  });
  // video yo'q yoki yuklanmadi — rasm bilan qoladi
  if (video && r && r.ok === false) {
    console.error("Galereya video:", k.tpl.id, r.description);
    const p = await card(c, Number(iStr), l, false, appLink);
    await telegram(bot, "editMessageMedia", { ...msg, media: { type: "photo", media: media(host, p.tpl.id, "photo"), caption: p.caption, parse_mode: "HTML" }, reply_markup: p.reply_markup }).catch(() => {});
  }
}

module.exports = { start, onCallback, ratings, templates, cats, cleanName };
