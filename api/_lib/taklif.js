// api/_lib/taklif.js
// ---------------------------------------------------------------
// Taklifnoma va tabrik kartochkasi (to'y, tug'ilgan kun): tik 1080x1920 rasm (PNG) yoki PDF.
// Fon — public/ai/takl/<id>.jpg (to'y, matnsiz AI rasm) yoki kodda chizilgan bezak (tug'ilgan kun).
// Matn qatlami HTML'da: ismlar yozma shriftda, sana/soat/joy ikonkalar bilan. Taklif matnini
// mijoz yozmasa — Claude qisqa yozadi (bo'lmasa tayyor matn). Rasm Chrome'da (withPage).
// ---------------------------------------------------------------
const { askJson, hasKey } = require("./ai");

const W = 1080, H = 1920;
const clean = (v, max = 200) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// area: matn joyi [x, y, w, h] (1080x1920 da); ink — asosiy rang, acc — bezak, soft — mayda matn
const TPL = {
  "toy-atirgul": { kind: "toy", bg: "toy-atirgul.jpg", area: [300, 470, 560, 980], ink: "#5f4a24", acc: "#b38a3e", soft: "#7a6a4e" },
  "toy-barg": { kind: "toy", bg: "toy-barg.jpg", area: [250, 300, 580, 1320], ink: "#5e3c46", acc: "#9c6b78", soft: "#7d6168" },
  "toy-bordo": { kind: "toy", bg: "toy-bordo.jpg", area: [215, 470, 650, 930], ink: "#f6dc9f", acc: "#d6aa58", soft: "#ecd9b6", dark: true },
  "toy-kok": { kind: "toy", bg: "toy-kok.jpg", area: [235, 590, 580, 740], ink: "#2d4770", acc: "#7b98c2", soft: "#56698a" },
  "tk-pushti": { kind: "tk", draw: "pushti", area: [150, 300, 780, 1430], ink: "#7a3550", acc: "#d98aa6", soft: "#8c5a6c" },
  "tk-bolalar": { kind: "tk", draw: "bolalar", area: [150, 330, 780, 1360], ink: "#1f4f8a", acc: "#ff8a3d", soft: "#3d6aa3" },
  "tk-oltin": { kind: "tk", draw: "oltin", area: [150, 300, 780, 1430], ink: "#f3d48a", acc: "#d4a94e", soft: "#e8dcc0", dark: true },
};
const IDS = Object.keys(TPL);

const L = {
  uz_lat: {
    va: "va", date: "SANA", time: "SOAT", place: "MANZIL", resp: "Hurmat bilan,",
    toyCap: "NIKOH TO'YIMIZGA TAKLIF ETAMIZ", tkCap: "TUG'ILGAN KUN BAZMIGA TAKLIF", tabrikCap: "Tug'ilgan kuning muborak!", age: (n) => `${n} yosh`,
    toyIntro: "Hayotimizning eng go'zal va unutilmas kunida siz azizlarni biz bilan birga bo'lishga taklif etamiz",
    toyClose: "Sizning tashrifingiz biz uchun eng katta sovg'a va sharafdir!",
    tkIntro: "Quvonchli kunimizni siz bilan birga nishonlashni istaymiz", tkClose: "Sizni intiqlik bilan kutib qolamiz!",
    tabIntro: "Senga mustahkam sog'liq, cheksiz baxt, quvonch va barcha orzularing ushalishini tilaymiz!", tabClose: "Yangi yoshing muborak bo'lsin!",
  },
  ru: {
    va: "и", date: "ДАТА", time: "ВРЕМЯ", place: "МЕСТО", resp: "С уважением,",
    toyCap: "ПРИГЛАШАЕМ НА НАШУ СВАДЬБУ", tkCap: "ПРИГЛАШЕНИЕ НА ДЕНЬ РОЖДЕНИЯ", tabrikCap: "С днём рождения!", age: (n) => `${n} ${ruYears(n)}`,
    toyIntro: "В самый прекрасный и незабываемый день нашей жизни мы будем рады видеть вас рядом с нами",
    toyClose: "Ваше присутствие — лучший подарок и большая честь для нас!",
    tkIntro: "Приглашаем вас разделить с нами этот радостный день", tkClose: "С нетерпением ждём вас!",
    tabIntro: "Желаем крепкого здоровья, безграничного счастья, радости и исполнения всех мечтаний!", tabClose: "С новым годом жизни!",
  },
};
function ruYears(n) { const k = Math.abs(parseInt(n, 10)) % 100, d = k % 10; return k > 10 && k < 20 ? "лет" : d === 1 ? "год" : d >= 2 && d <= 4 ? "года" : "лет"; }
function dict(lang) {
  if (lang === "ru") return L.ru;
  if (lang === "uz_cyr") {
    const toCyr = require("../../public/ai/translit.js");
    const out = {};
    for (const [k, v] of Object.entries(L.uz_lat)) out[k] = typeof v === "function" ? (n) => toCyr(v(n)) : toCyr(v);
    return out;
  }
  return L.uz_lat;
}
const isTk = (f) => f && (f.kind === "tk" || f.kind === "tabrik");
const isTab = (f) => f && f.kind === "tabrik";
const langOf = (f) => (["uz_lat", "uz_cyr", "ru"].includes(f.lang) ? f.lang : "uz_lat");
const templateOf = (f) => {
  const kind = isTk(f) ? "tk" : "toy";
  const id = kind === "tk" ? f.tplTk : f.tplToy;
  return TPL[id] && TPL[id].kind === kind ? id : kind === "tk" ? "tk-pushti" : "toy-atirgul";
};

/* ---------------- matn (AI yoki tayyor) ---------------- */
async function writeText(f, lang, t) {
  const own = clean(f.text, 300);
  const D = dict(lang);
  const tab = t.kind === "tk" && isTab(f);
  const def = t.kind === "toy" ? { intro: D.toyIntro, closing: D.toyClose } : tab ? { intro: D.tabIntro, closing: D.tabClose } : { intro: D.tkIntro, closing: D.tkClose };
  if (own) return { data: { intro: own, closing: def.closing }, ai: null };
  if (!hasKey()) return { data: def, ai: null };
  const LN = { uz_lat: "Uzbek (Latin script, modern spelling with o', g')", uz_cyr: "Uzbek (Cyrillic script)", ru: "Russian" }[lang];
  const what = t.kind === "toy"
    ? `a wedding invitation from the couple (${clean(f.kuyov, 40)} and ${clean(f.kelin, 40)}) to guests`
    : tab ? `a birthday greeting card for ${clean(f.name, 40)}${f.age ? `, turning ${clean(f.age, 5)}` : ""}` : `a birthday party invitation for ${clean(f.name, 40)}${f.age ? ` (turning ${clean(f.age, 5)})` : ""}`;
  try {
    const r = await askJson({
      model: require("./ai").modelFor("TEXT_MODEL"), effort: "low", maxTokens: 800,
      system: "You write short, warm, elegant texts for invitations and greeting cards in Uzbekistan. Respectful tone, local traditions, no clichés in English, no emojis.",
      schema: { type: "object", properties: { intro: { type: "string" }, closing: { type: "string" } }, required: ["intro", "closing"], additionalProperties: false },
      prompt: `Write the texts for ${what}. Language: ${LN}.
- intro: one warm sentence, 60–130 characters${tab ? " (the main wish)" : " (inviting the guest)"}; do not repeat names, date or place.
- closing: one short line, 25–70 characters.
${clean(f.extra, 300) ? `Customer's wish for the text: ${clean(f.extra, 300)}` : ""}`,
    });
    const intro = clean(r.data.intro, 200), closing = clean(r.data.closing, 110);
    return { data: { intro: intro || def.intro, closing: closing || def.closing }, ai: r };
  } catch (e) {
    console.error("Taklifnoma matni:", e.message);
    return { data: def, ai: null };
  }
}

/* ---------------- bezaklar (tug'ilgan kun) ---------------- */
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function balloon(x, y, r, c1, c2, rot = 0) {
  const id = "g" + Math.round(x * 7 + y * 3 + r);
  return `<g transform="rotate(${rot} ${x} ${y})"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".25" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
    <path d="M${x} ${y + r * 1.2} q ${-r * 0.25} ${r * 0.9} ${r * 0.1} ${r * 1.9} t ${-r * 0.1} ${r * 1.6}" stroke="${c2}" stroke-opacity=".55" stroke-width="3" fill="none"/>
    <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.18}" fill="url(#${id})"/>
    <path d="M${x - r * 0.12} ${y + r * 1.15} l ${r * 0.12} ${r * 0.14} l ${r * 0.12} ${-r * 0.14} z" fill="${c2}"/></g>`;
}
function confetti(seed, n, colors, box) {
  const R = rng(seed); let s = "";
  for (let i = 0; i < n; i++) {
    const x = box[0] + R() * box[2], y = box[1] + R() * box[3], c = colors[Math.floor(R() * colors.length)];
    s += R() < 0.5 ? `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(4 + R() * 7).toFixed(1)}" fill="${c}" opacity=".85"/>`
      : `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(8 + R() * 10).toFixed(0)}" height="${(16 + R() * 14).toFixed(0)}" rx="3" fill="${c}" opacity=".85" transform="rotate(${(R() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
  }
  return s;
}
function drawBg(kind) {
  if (kind === "pushti") {
    const P = ["#f7a8c0", "#e2638a"], G = ["#f6dc96", "#c99a3e"], Wt = ["#ffffff", "#e8d9dc"];
    return `<div class="bgc" style="background:linear-gradient(160deg,#fde6ee 0%,#fff6ec 55%,#fde9f0 100%)"></div>
    <svg class="bgc" viewBox="0 0 ${W} ${H}">${confetti(7, 70, ["#e2638a", "#f2b8c9", "#d4a94e", "#f6dc96"], [0, 0, W, H])}
      ${balloon(120, 230, 95, ...P, -12)}${balloon(270, 150, 80, ...G, 8)}${balloon(70, 470, 70, ...Wt, -5)}
      ${balloon(960, 1540, 100, ...P, 10)}${balloon(830, 1660, 80, ...G, -6)}${balloon(1010, 1760, 65, ...Wt, 4)}
      ${balloon(90, 1700, 70, ...G, -10)}${balloon(990, 260, 72, ...Wt, 12)}</svg>`;
  }
  if (kind === "bolalar") {
    const cs = [["#ff7b7b", "#e0393e"], ["#ffd65c", "#f0a500"], ["#7cc8ff", "#2b86d6"], ["#8ee08a", "#3aa845"], ["#c79bff", "#7b4fd6"]];
    let flags = ""; for (let i = 0; i < 12; i++) { const x = 20 + i * 90, c = cs[i % cs.length][0]; flags += `<path d="M${x} ${70 + Math.sin(i / 1.9) * 18} l 90 ${Math.sin((i + 1) / 1.9) * 18 - Math.sin(i / 1.9) * 18} l -45 95 z" fill="${c}"/>`; }
    return `<div class="bgc" style="background:linear-gradient(180deg,#bfe5ff 0%,#e9f7ff 55%,#fffbe8 100%)"></div>
    <svg class="bgc" viewBox="0 0 ${W} ${H}">
      <g fill="#fff" opacity=".9"><ellipse cx="180" cy="420" rx="120" ry="45"/><ellipse cx="260" cy="395" rx="85" ry="50"/><ellipse cx="880" cy="1180" rx="130" ry="45"/><ellipse cx="800" cy="1155" rx="80" ry="45"/></g>
      <path d="M0 70 Q 540 140 1080 70" stroke="#7a5a3a" stroke-width="4" fill="none"/>${flags}
      ${confetti(11, 60, cs.map((c) => c[0]), [0, 200, W, H - 200])}
      ${balloon(110, 330, 90, ...cs[0], -10)}${balloon(250, 250, 75, ...cs[2], 6)}${balloon(960, 340, 88, ...cs[1], 10)}${balloon(830, 270, 70, ...cs[3], -4)}
      ${balloon(120, 1560, 85, ...cs[4], 8)}${balloon(960, 1600, 92, ...cs[0], -8)}${balloon(830, 1700, 70, ...cs[2], 5)}</svg>`;
  }
  // oltin (qora fon)
  const G = ["#f6dc96", "#b8862e"], B = ["#4a4a55", "#14141a"], Wt = ["#ffffff", "#c9c2b0"];
  return `<div class="bgc" style="background:radial-gradient(120% 80% at 50% 30%,#2a2533 0%,#141219 60%,#0b0a0f 100%)"></div>
    <svg class="bgc" viewBox="0 0 ${W} ${H}">${confetti(5, 110, ["#d4a94e", "#f6dc96", "#ffffff", "#a5843f"], [0, 0, W, H])}
      <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#d4a94e" stroke-width="3" opacity=".8"/>
      <rect x="58" y="58" width="${W - 116}" height="${H - 116}" fill="none" stroke="#d4a94e" stroke-width="1.5" opacity=".5"/>
      ${balloon(150, 260, 95, ...G, -12)}${balloon(300, 170, 75, ...B, 8)}${balloon(930, 1560, 100, ...G, 10)}${balloon(790, 1680, 78, ...Wt, -6)}${balloon(960, 300, 70, ...B, 12)}</svg>`;
}

/* ---------------- HTML ---------------- */
const ICON = {
  date: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M12 13.2c-.9-1.1-2.6-.5-2.4.8.2 1.1 2.4 2.5 2.4 2.5s2.2-1.4 2.4-2.5c.2-1.3-1.5-1.9-2.4-.8z"/></svg>`,
  time: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
  place: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>`,
};
const heart = (c) => `<svg class="orn" viewBox="0 0 300 20"><path d="M10 10H128M172 10H290" stroke="${c}" stroke-width="1.4"/><path d="M150 16c-5-4-10-6.5-10-10.2 0-2.6 2-4.3 4.5-4.3 2.2 0 4 1.5 5.5 3.3 1.5-1.8 3.3-3.3 5.5-3.3 2.5 0 4.5 1.7 4.5 4.3 0 3.7-5 6.2-10 10.2z" fill="${c}"/></svg>`;

function html(id, d, origin) {
  const t = TPL[id];
  const [ax, ay, aw, ah] = t.area;
  const bg = t.bg ? `<img class="bgc" src="${origin}/ai/takl/${t.bg}" alt="">` : drawBg(t.draw);
  const cols = [["date", d.date], ["time", d.time], ["place", d.place]].filter((c) => c[1]);
  const row = cols.length ? `<div class="row">${cols.map(([k, v], i) => `${i ? '<div class="sep"></div>' : ""}<div class="col"><div class="ic">${ICON[k](t.acc)}</div><div class="cv${k === "place" ? " pl" : ""}">${esc(v)}</div><div class="cc">${esc(d.L[k])}</div></div>`).join("")}</div>` : "";
  const photo = d.photo ? `<div class="ph"><img src="${esc(d.photo)}" alt=""></div>` : d.ageBig ? `<div class="agebig">${esc(d.ageBig)}</div>` : "";
  const body = t.kind === "toy"
    ? `<div class="intro">${esc(d.intro)}</div>${heart(t.acc)}
       <div class="names"><div class="nm">${esc(d.n1)}</div><div class="va">${esc(d.L.va)}</div><div class="nm">${esc(d.n2)}</div></div>
       <div class="cap">${esc(d.L.toyCap)}</div>${row}${d.addr ? `<div class="addr">${esc(d.addr)}</div>` : ""}
       <div class="close">${esc(d.closing)}</div>${heart(t.acc)}
       <div class="hosts"><div class="hr">${esc(d.L.resp)}</div><div class="hn">${esc(d.hosts)}</div></div>`
    : `${photo}${d.tab ? `<div class="tabcap">${esc(d.L.tabrikCap)}</div>` : `<div class="cap">${esc(d.L.tkCap)}</div>`}
       <div class="names"><div class="nm">${esc(d.n1)}</div></div>${d.ageTxt ? `<div class="age">${esc(d.ageTxt)}</div>` : ""}
       ${heart(t.acc)}<div class="intro">${esc(d.intro)}</div>${d.tab ? "" : row}${!d.tab && d.addr ? `<div class="addr">${esc(d.addr)}</div>` : ""}
       <div class="close">${esc(d.closing)}</div>${d.hosts ? `<div class="hosts"><div class="hr">${esc(d.L.resp)}</div><div class="hn">${esc(d.hosts)}</div></div>` : ""}`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Montserrat:wght@500;600&display=block&subset=latin-ext,cyrillic" rel="stylesheet">
<style>
@page{ size:${W}px ${H}px; margin:0 }
*{ box-sizing:border-box; margin:0; padding:0 }
html,body{ width:${W}px; height:${H}px; overflow:hidden }
body{ position:relative; font-family:'Cormorant Garamond',Georgia,serif; color:${t.ink}; --k:1 }
.bgc{ position:absolute; inset:0; width:${W}px; height:${H}px; object-fit:cover }
.area{ position:absolute; left:${ax}px; top:${ay}px; width:${aw}px; height:${ah}px; display:flex; align-items:center; justify-content:center }
.in{ width:100%; display:flex; flex-direction:column; align-items:center; text-align:center; gap:calc(26px*var(--k)) }
.intro{ font-size:calc(40px*var(--k)); line-height:1.3; font-weight:500; color:${t.ink}; max-width:96% }
.orn{ width:calc(300px*var(--k)); height:auto }
.names{ display:flex; flex-direction:column; align-items:center; line-height:1 }
.nm{ font-family:'Great Vibes',cursive; font-size:calc(150px*var(--k)); color:${t.ink}; line-height:1.05; padding:0 10px; white-space:nowrap }
.va{ font-size:calc(46px*var(--k)); font-style:italic; color:${t.acc}; margin:calc(-6px*var(--k)) 0 }
.cap,.tabcap{ font-family:'Montserrat',Arial,sans-serif; font-weight:600; letter-spacing:.2em; font-size:calc(30px*var(--k)); color:${t.ink}; line-height:1.45; max-width:92% }
.tabcap{ font-family:'Great Vibes',cursive; letter-spacing:0; font-weight:400; font-size:calc(92px*var(--k)); color:${t.acc}; line-height:1.1 }
.row{ display:flex; align-items:stretch; justify-content:center; width:100%; margin-top:calc(6px*var(--k)) }
.col{ flex:1 1 0; display:flex; flex-direction:column; align-items:center; gap:calc(8px*var(--k)); padding:0 calc(14px*var(--k)); min-width:0 }
.sep{ width:2px; background:${t.acc}; opacity:.6; margin:calc(10px*var(--k)) 0 }
.ic svg{ width:calc(64px*var(--k)); height:calc(64px*var(--k)) }
.cv{ font-size:calc(46px*var(--k)); font-weight:700; line-height:1.1; color:${t.ink}; white-space:nowrap }
.cv.pl{ white-space:normal; word-break:break-word }
.cv.pl{ font-family:'Great Vibes',cursive; font-weight:400; font-size:calc(56px*var(--k)) }
.cc{ font-family:'Montserrat',Arial,sans-serif; font-size:calc(22px*var(--k)); letter-spacing:.18em; color:${t.soft}; font-weight:600 }
.addr{ font-size:calc(32px*var(--k)); color:${t.soft}; font-style:italic; max-width:94% }
.close{ font-size:calc(40px*var(--k)); font-style:italic; color:${t.ink}; line-height:1.3; max-width:94% }
.hosts{ display:flex; flex-direction:column; align-items:center; gap:calc(4px*var(--k)) }
.hr{ font-size:calc(30px*var(--k)); color:${t.soft} }
.hn{ font-family:'Great Vibes',cursive; font-size:calc(66px*var(--k)); color:${t.ink}; line-height:1.15 }
.age{ font-family:'Montserrat',Arial,sans-serif; font-weight:600; font-size:calc(40px*var(--k)); letter-spacing:.12em; color:${t.acc} }
.ph{ width:calc(400px*var(--k)); height:calc(400px*var(--k)); border-radius:50%; padding:calc(12px*var(--k)); background:${t.dark ? "linear-gradient(135deg,#f6dc96,#b8862e)" : `linear-gradient(135deg,#fff,${t.acc})`}; box-shadow:0 14px 40px rgba(0,0,0,.18); flex:none }
.ph img{ width:100%; height:100%; border-radius:50%; object-fit:cover; display:block; background:#eee }
.agebig{ width:calc(320px*var(--k)); height:calc(320px*var(--k)); border-radius:50%; display:flex; align-items:center; justify-content:center; flex:none;
  font-family:'Montserrat',Arial,sans-serif; font-weight:600; font-size:calc(190px*var(--k)); color:#fff; background:radial-gradient(circle at 35% 30%,${t.acc},${t.ink}); box-shadow:0 14px 40px rgba(0,0,0,.18) }
</style></head><body>${bg}<div class="area"><div class="in">${body}</div></div>
<script>
window.__fit = function () {
  var a = document.querySelector(".area"), i = document.querySelector(".in"), k = 1;
  document.body.style.setProperty("--k", k);
  // ismlar va uzun qatorlar eniga sig'sin, keyin balandlik
  for (var n = 0; n < 60 && (i.scrollHeight > a.clientHeight || i.scrollWidth > a.clientWidth + 2 || [].some.call(document.querySelectorAll(".nm,.hn,.cv"), function (e) { return e.scrollWidth > a.clientWidth + 2; })); n++) {
    k -= 0.02; document.body.style.setProperty("--k", k.toFixed(2));
  }
  document.documentElement.setAttribute("data-fitted", "1");
};
</script></body></html>`;
}

function dataOf(f, lang, text, photo) {
  const D = dict(lang);
  const kind = isTk(f) ? "tk" : "toy";
  const tab = kind === "tk" && isTab(f);
  const age = clean(f.age, 4).replace(/[^\d]/g, "");
  const n1 = kind === "toy" ? clean(f.kuyov, 30) : clean(f.name, 30);
  const n2 = clean(f.kelin, 30);
  return {
    L: D, tab, n1, n2,
    intro: text.intro, closing: text.closing,
    date: clean(f.sana, 40), time: clean(f.vaqt, 20), place: clean(f.joy, 50), addr: clean(f.manzil, 120),
    hosts: clean(f.mezbon, 80) || (kind === "toy" ? `${n1} ${D.va} ${n2}` : ""),
    ageTxt: age && (photo || kind !== "tk") ? D.age(age) : "",
    ageBig: !photo && kind === "tk" && age ? age : "",
    photo: kind === "tk" ? photo : null,
  };
}

const canAutoTaklif = (f) => !!f && (isTk(f) ? !!clean(f.name) : !!(clean(f.kuyov) && clean(f.kelin)));

async function generateTaklif(f, { withPage, origin, photoUrl }) {
  const lang = langOf(f);
  const id = templateOf(f);
  const t = TPL[id];
  const text = await writeText(f, lang, t);
  const d = dataOf(f, lang, text.data, photoUrl || null);
  const page = html(id, d, origin);
  const pdf = f.format === "pdf";
  const buffer = await withPage(async (p) => {
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await p.setContent(page, { waitUntil: "networkidle0", timeout: 45000 });
    await p.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
      window.__fit();
    });
    return pdf
      ? Buffer.from(await p.pdf({ width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: "1" }))
      : Buffer.from(await p.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
  });
  const who = t.kind === "toy" ? `${d.n1} va ${d.n2}` : d.n1;
  const name = `${isTk(f) ? (d.tab ? "Tabrik" : "Taklifnoma") : "To'y taklifnomasi"} - ${who}`.replace(/[\\/:*?"<>|]+/g, "").slice(0, 80);
  return { buffer, name, ext: pdf ? "pdf" : "png", mime: pdf ? "application/pdf" : "image/png", ai: text.ai };
}

module.exports = { TPL, IDS, html, dataOf, writeText, templateOf, canAutoTaklif, generateTaklif, langOf };
