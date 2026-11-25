// api/_lib/gallery.js
// ---------------------------------------------------------------
// Shablonlar galereyasi — Telegram chatning o'zida (AI bot). Ikki xizmat uchun:
//   p — 💎 Super taqdimot (presentation_pro), o — 📊 oddiy Taqdimot (presentation).
// Mijoz xizmat tugmasini bossa: matnli xabar + toifalar → shablon kartasi (4 slayd kollaji,
// ostida «🎬 Shablonni ko'rish», «◀️ / ▶️», «✅ Tanlash»). Karta BITTA xabarda: editMessageMedia bilan
// rasm ↔ video almashadi, chat to'lib ketmaydi. Toifalar xabari ↔ karta almashganda eskisi o'chiriladi.
// «Tanlash» ilovada xizmat formasini shu shablon bilan ochadi. Har shablonda «Shablon kodi» (t.code) bor —
// mijoz ilovada shu kodni yozsa, shablon o'zi tanlanadi.
// Shablonlar va toifalar public/ai/config.js dan olinadi (alohida ro'yxat yuritilmaydi).
// Media: https://<host>/ai/templates/<id>/card.jpg (muqova + 3 eng chiroyli slayd, reja slaydisiz; yo'q bo'lsa 1.jpg)
// va preview.mp4 (ovozsiz — Telegram GIF kabi aylantiradi; PRO — animatsiya, oddiy — slayd-shou).
// Reyting: buyurtmalardagi details.rating (fayl yetkazilgach mijoz qo'ygan baho), 3 ta bahodan keyin ko'rinadi.
// «⭐ Top reyting» toifasi kamida TOP_MIN shablon 3+ baho olgandan keyin o'zi paydo bo'ladi.
// callback_data: gl:<s>:<amal>:<toifa>:<tartib> (eski gl:<amal>:<toifa>:<tartib> — PRO deb olinadi)
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
const config = () => CFG || { templates: {}, proCategories: [], categories: [] };

// oddiy taqdimot toifalari uchun botdagi belgilar (ilovada belgisiz)
const EMO = { umumiy: "📚", powerpoint: "🖥", tarix: "🏛", tabiat: "🌿", geografiya: "🗺", kimyo: "⚗️", tibbiyot: "🩺", biologiya: "🧬", matematika: "📐", fizika: "⚛️", astronomiya: "🔭", informatika: "💻", iqtisod: "💼", huquq: "⚖️", pedagogika: "🧑‍🏫", adabiyot: "📖", ingliz: "🇬🇧", rus: "🇷🇺", sanat: "🎨", sport: "⚽", tarbiya: "🤝", bayram: "🎉", turizm: "✈️", qishloq: "🌾", bogcha: "🧸" };
const SETS = {
  p: { svc: "presentation_pro", tpl: () => config().templates.presentation_pro || [], cats: () => config().proCategories || [] },
  o: {
    svc: "presentation",
    // kod bilan chiziladigan (rasmsiz) va «AI dizayn» shablonlari galereyada ko'rsatilmaydi
    tpl: () => (config().templates.presentation || []).filter((t) => t.kind === "canva" && t.id !== "ai-dizayn"),
    cats: () => (config().presExtraCats || []).concat((config().categories || []).map((c) => ({ v: c.v, l: `${EMO[c.v] || "📁"} ${c.l}` }))),
  },
};
const SET_OF = { presentation_pro: "p", presentation: "o" };
const inCat = (t, c) => (Array.isArray(t.cats) ? t.cats.includes(c) : t.category === c);
const TOP_MIN = 5;
const rated = (s, map) => SETS[s].tpl().filter((t) => map[t.id] && map[t.id].n >= 3)
  .sort((a, b) => map[b.id].sum / map[b.id].n - map[a.id].sum / map[a.id].n || map[b.id].n - map[a.id].n);
const listOf = (s, c, map) => (c === "all" ? SETS[s].tpl() : c === "reyting" ? rated(s, map || {}) : SETS[s].tpl().filter((t) => inCat(t, c)));
// emoji va bezaksiz nom: «💎 Ochiq kitob · varaq» -> «Ochiq kitob — varaq»
const cleanName = (n) => String(n || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s*[·•|]\s*/g, " — ").replace(/\s+/g, " ").trim();
const catLabel = (s, c, l) => (c === "all" ? tx(l).all : c === "reyting" ? tx(l).top : (SETS[s].cats().find((x) => x.v === c) || {}).l || c);

const TX = {
  uz: { head: { p: "💎 <b>Super taqdimot</b>\n\nTaqdimotingiz uchun o'zingizga mos shablonni tanlang 👇\n\n<i>Har bir shablonning slaydlari va jonli animatsiyasini shu yerda ko'rasiz.</i>", o: "📊 <b>Taqdimot</b>\n\nTaqdimotingiz uchun o'zingizga mos shablonni tanlang 👇\n\n<i>Har bir shablonning slaydlarini shu yerda ko'rasiz. Shablon tanlamasangiz — AI dizaynni o'zi yaratadi.</i>" }, noTpl: "✨ Shablonsiz — AI o'zi dizayn qiladi", top: "⭐ Top reyting", code: "🔢 Shablon kodi", all: "📂 Barchasi", look: "🎬 Shablonni ko'rish", photo: "🖼 Rasmga qaytish", prev: "◀️ Oldingi", next: "Keyingi ▶️", pick: "✅ Shu shablonni tanlash", cats: "📂 Toifalar", rate: "baho", anim: { p: "🎬 Animatsiya namunasi", o: "🎬 Slaydlar namunasi" }, pickHint: "«Tanlash» bosilsa, mavzuni yozib buyurtma berasiz." },
  ru: { head: { p: "💎 <b>Супер-презентация</b>\n\nВыберите подходящий шаблон для вашей презентации 👇\n\n<i>Слайды и живую анимацию каждого шаблона увидите прямо здесь.</i>", o: "📊 <b>Презентация</b>\n\nВыберите подходящий шаблон для вашей презентации 👇\n\n<i>Слайды каждого шаблона увидите прямо здесь. Без шаблона — AI создаст дизайн сам.</i>" }, noTpl: "✨ Без шаблона — дизайн от AI", top: "⭐ Топ рейтинга", code: "🔢 Код шаблона", all: "📂 Все", look: "🎬 Смотреть шаблон", photo: "🖼 К картинке", prev: "◀️ Назад", next: "Далее ▶️", pick: "✅ Выбрать этот шаблон", cats: "📂 Категории", rate: "оценок", anim: { p: "🎬 Пример анимации", o: "🎬 Пример слайдов" }, pickHint: "Нажмите «Выбрать», укажите тему и оформите заказ." },
  en: { head: { p: "💎 <b>Super presentation</b>\n\nChoose the template that suits your presentation 👇\n\n<i>See each template's slides and live animation right here.</i>", o: "📊 <b>Presentation</b>\n\nChoose the template that suits your presentation 👇\n\n<i>See each template's slides right here. No template — AI designs it for you.</i>" }, noTpl: "✨ No template — AI designs it", top: "⭐ Top rated", code: "🔢 Template code", all: "📂 All", look: "🎬 Watch template", photo: "🖼 Back to picture", prev: "◀️ Previous", next: "Next ▶️", pick: "✅ Choose this template", cats: "📂 Categories", rate: "ratings", anim: { p: "🎬 Animation sample", o: "🎬 Slides sample" }, pickHint: "Tap «Choose», write your topic and order." },
};
const tx = (l) => TX[l] || TX.uz;

// ⭐ reytinglar (10 daqiqa xotirada); shablon id lari ikki xizmatda takrorlanmaydi
let RATE = { at: 0, map: {} };
async function ratings() {
  if (Date.now() - RATE.at < 10 * 60 * 1000) return RATE.map;
  const map = {};
  try {
    const { data } = await supabase.from("orders").select("details").in("service", ["presentation_pro", "presentation"]).not("details->rating", "is", null).limit(5000);
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

// MV — shablon rasmlari yangilanganda Telegram eski (keshlangan) rasmni ko'rsatmasligi uchun versiya
const MV = { "huquq-qonunlar": 2 };
const media = (host, id, kind) => `https://${host}/ai/templates/${id}/${kind === "video" ? "preview.mp4" : kind === "card" ? "card.jpg" : "1.jpg"}${MV[id] ? "?v=" + MV[id] : ""}`;
const cb = (s, a, c, i) => `gl:${s}:${a}:${c}:${i}`; // 64 baytdan qisqa
const svcLink = (appLink, s) => appLink + "&open=" + SETS[s].svc;

// toifalar (sonsiz — telefonda sig'maydi); «⭐ Top reyting» yetarli baho to'plangandagina
async function catKeyboard(s, l, appLink) {
  const t = tx(l);
  const top = rated(s, await ratings()).length >= TOP_MIN;
  const rows = [];
  if (s === "o" && appLink) rows.push([{ text: t.noTpl, web_app: { url: svcLink(appLink, s) } }]);
  rows.push([{ text: t.all, callback_data: cb(s, "c", "all", 0) }]);
  const cs = (top ? [{ text: t.top, callback_data: cb(s, "c", "reyting", 0) }] : [])
    .concat(SETS[s].cats().filter((c) => listOf(s, c.v).length).map((c) => ({ text: c.l, callback_data: cb(s, "c", c.v, 0) })));
  for (let i = 0; i < cs.length; i += 2) rows.push(cs.slice(i, i + 2));
  return { inline_keyboard: rows };
}

async function card(s, c, i, l, video, appLink) {
  const t = tx(l);
  const map = await ratings();
  let list = listOf(s, c, map);
  if (!list.length) { c = "all"; list = SETS[s].tpl(); }
  const n = list.length;
  i = ((i % n) + n) % n;
  const tpl = list[i];
  const r = map[tpl.id];
  const caption = `${s === "p" ? "💎" : "📊"} <b>${cleanName(tpl.name)}</b>\n${catLabel(s, c, l)} · ${i + 1}/${n}` +
    (r && r.n >= 3 ? `\n${stars(r.sum / r.n)} (${r.n} ${t.rate})` : "") +
    (video ? `\n\n${t.anim[s]}` : "") +
    (tpl.code ? `\n\n${t.code}: <b>${tpl.code}</b>` : "") +
    (video ? "" : `\n${t.pickHint}`);
  const kb = [
    [video ? { text: t.photo, callback_data: cb(s, "p", c, i) } : { text: t.look, callback_data: cb(s, "v", c, i) }],
    [{ text: t.prev, callback_data: cb(s, "p", c, i - 1) }, { text: `${i + 1} / ${n}`, callback_data: "noop" }, { text: t.next, callback_data: cb(s, "p", c, i + 1) }],
    [{ text: t.pick, web_app: { url: svcLink(appLink, s) + "&tpl=" + encodeURIComponent(tpl.id) } }],
    [{ text: t.cats, callback_data: cb(s, "m", c, 0) }],
  ];
  return { tpl, caption, reply_markup: { inline_keyboard: kb } };
}

// Galereyani boshlash: matn + toifalar (rasmsiz). svc — presentation_pro yoki presentation
async function start(bot, chatId, l, host, svc, appLink) {
  await load(host);
  const s = SET_OF[svc] || "p";
  return telegram(bot, "sendMessage", { chat_id: chatId, text: tx(l).head[s], parse_mode: "HTML", reply_markup: await catKeyboard(s, l, appLink) });
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
  const m = /^gl:(?:([po]):)?([cmpv]):([a-z]+):(-?\d+)$/.exec(cq.data || "");
  const answer = (text) => telegram(bot, "answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text } : {}) }).catch(() => {});
  if (!m || !cq.message) { await answer(); return; }
  const [, sRaw, a, c, iStr] = m;
  const s = sRaw || "p";
  const msg = { chat_id: cq.message.chat.id, message_id: cq.message.message_id };
  if (c !== "all" && c !== "reyting" && !SETS[s].cats().some((x) => x.v === c)) { await answer(); return; }
  const isMedia = !!(cq.message.photo || cq.message.animation || cq.message.video || cq.message.document);
  const drop = () => telegram(bot, "deleteMessage", msg).catch(() => {});
  if (a === "m") { // kartadan toifalarga: matnli xabar yuboriladi, karta o'chadi
    await answer();
    if (isMedia) { await start(bot, msg.chat_id, l, host, SETS[s].svc, appLink); await drop(); }
    else await telegram(bot, "editMessageText", { ...msg, text: tx(l).head[s], parse_mode: "HTML", reply_markup: await catKeyboard(s, l, appLink) }).catch(() => {});
    return;
  }
  const video = a === "v";
  const k = await card(s, c, Number(iStr), l, video, appLink);
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
    await editCard(bot, msg, await card(s, c, Number(iStr), l, false, appLink), host, false).catch(() => {});
  }
}

module.exports = { start, onCallback, ratings, has: (svc) => !!SET_OF[svc], cleanName };
