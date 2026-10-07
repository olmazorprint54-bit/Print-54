// api/_lib/rez-html.js
// ---------------------------------------------------------------
// Canva'dan olingan 12 ta resume dizaynini avtomatik to'ldiradi.
// Har bir dizayn uchun (api/_lib/rez/<slug>.json):
//   - matnsiz fon: ai/templates/rez-<slug>/bg.jpg (bo'lim bezaklarisiz)
//     va bgd.jpg (bezaklar bilan) — bo'lim to'ldirilgan bo'lsa, uning
//     ikonka/chiziqlari bgd.jpg dan "yamoq" qilib qo'yiladi
//   - matn joylari: o'lcham (mm), shrift, rang, tekislash
// Matn joyiga sig'masa, sahifadagi __fit() uni kichraytiradi.
// Fayllar scratchpad'dagi rez/build.py bilan PPTX dan yasalgan.
// ---------------------------------------------------------------

const SPECS = {
  kulrang: require("./rez/kulrang.json"),
  zumrad: require("./rez/zumrad.json"),
  tungi: require("./rez/tungi.json"),
  moviy: require("./rez/moviy.json"),
  "kok-panel": require("./rez/kok-panel.json"),
  toq: require("./rez/toq.json"),
  diagonal: require("./rez/diagonal.json"),
  sariq: require("./rez/sariq.json"),
  pushti: require("./rez/pushti.json"),
  yashil: require("./rez/yashil.json"),
  jigarrang: require("./rez/jigarrang.json"),
  biznes: require("./rez/biznes.json"),
};
const REZ_IDS = Object.keys(SPECS).map((s) => "rez-" + s);

const HEAD = {
  uz_lat: { about: "Men haqimda", contact: "Aloqa", exp: "Tajriba", edu: "Ta'lim", skills: "Ko'nikmalar", langs: "Tillar" },
  ru: { about: "Обо мне", contact: "Контакты", exp: "Опыт работы", edu: "Образование", skills: "Навыки", langs: "Языки" },
  en: { about: "About me", contact: "Contact", exp: "Experience", edu: "Education", skills: "Skills", langs: "Languages" },
};
const CONTACT_LABEL = {
  uz_lat: { phone: "Telefon:", email: "E-mail:", city: "Manzil:", birth: "Tug'ilgan:" },
  ru: { phone: "Телефон:", email: "E-mail:", city: "Адрес:", birth: "Род.:" },
  en: { phone: "Phone:", email: "E-mail:", city: "Address:", birth: "Born:" },
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mm = (n) => `${Number(n).toFixed(2)}mm`;

const loadSpec = (templateId) => SPECS[String(templateId || "").replace(/^rez-/, "")] || null;

// Uslub (PPTX matn qutisidan) -> CSS. Shrift o'lchami --k bilan kichrayadi.
function css(st, opts = {}) {
  const lh = st.lnspc ? Math.max(1, st.lnspc * 1.2) : 1.22;
  return [
    `font-family:'${st.fam}','Open Sans',sans-serif`,
    `font-weight:${st.w}`,
    st.i ? "font-style:italic" : "",
    `font-size:calc(${st.size}pt * var(--k,1))`,
    `color:${st.color}`,
    `text-align:${opts.align || (opts.nojust && st.align === "justify" ? "left" : st.align)}`,
    st.spc ? `letter-spacing:calc(${st.spc}pt * var(--k,1))` : "",
    st.caps && !opts.nocaps ? "text-transform:uppercase" : opts.nocaps ? "text-transform:none" : "",
    `line-height:${opts.lh || lh}`,
  ].filter(Boolean).join(";");
}

// Mutlaq joylashgan quti. one — bir qator (kenglikka sig'dirish)
function box(b, st, inner, opts = {}) {
  const ins = st.ins || [0, 0, 0, 0];
  const justify = { t: "flex-start", ctr: "center", b: "flex-end" }[st.anchor] || "flex-start";
  return `<div class="fit${opts.one ? " one" : ""}" style="left:${mm(b[0])};top:${mm(b[1])};width:${mm(b[2])};height:${mm(b[3])};padding:${mm(ins[1])} ${mm(ins[2])} ${mm(ins[3])} ${mm(ins[0])};justify-content:${opts.justify || justify}"><div class="in" style="${css(st, opts)}">${inner}</div></div>`;
}

// Bezak yamog'i: bgd.jpg ning src qismi dst joyiga
function patch(bgd, src, dst = src) {
  const x = dst[0] + (dst[2] - src[2]) / 2;
  const y = dst[1] + (dst[3] - src[3]) / 2;
  return `<div class="patch" style="left:${mm(x)};top:${mm(y)};width:${mm(src[2])};height:${mm(src[3])};background-image:url('${bgd}');background-position:${mm(-src[0])} ${mm(-src[1])}"></div>`;
}

function itemsHtml(slot, list) {
  const { fmt, a, b } = slot;
  const A = (t) => `<div style="${css(a, { nocaps: true, nojust: true })}">${esc(t)}</div>`;
  const Bd = (t) => `<div style="${css(b, { nocaps: true, nojust: true })}">${esc(t)}</div>`;
  return list.map((it) => {
    let inner;
    if (fmt === "date") inner = it.date ? A(it.date) + Bd(it.body) : Bd(it.body);
    else if (fmt === "right") inner = `<div class="row"><div style="flex:1;${css(a, { nocaps: true, nojust: true })}">${esc(it.body)}</div>${it.date ? `<div style="flex:none;padding-left:2mm;${css(b, { nocaps: true, nojust: true, align: "right" })}">${esc(it.date)}</div>` : ""}</div>`;
    else if (fmt === "cols") inner = `<div class="row"><div style="flex:none;width:${mm(slot.dx)};${css(a, { nocaps: true, nojust: true })}">${esc(it.date)}</div><div style="flex:1;${css(b, { nocaps: true, nojust: true })}">${esc(it.body)}</div></div>`;
    else inner = it.date ? A(it.body) + Bd(it.date) : A(it.body);
    return `<div class="item">${inner}</div>`;
  }).join("");
}

function fontsLink(spec) {
  const fams = { ...spec.fonts, "Open Sans": [[400, false], [700, false]] };
  const q = Object.entries(fams).map(([fam, vs]) => {
    const set = new Set(vs.map(([w, i]) => `${i ? 1 : 0},${w}`));
    if (fam === "Open Sans") ["0,400", "0,700"].forEach((x) => set.add(x));
    return `family=${fam.replace(/ /g, "+")}:ital,wght@${[...set].sort().join(";")}`;
  });
  return `https://fonts.googleapis.com/css2?${q.join("&")}&display=block`;
}

// d — resume-html.js dagi resumeData() natijasi; origin — rasm/fonlar manzili
function rezHtml(d, spec, origin) {
  const dir = `${origin}/ai/templates/${spec.id}`;
  const bgd = `${dir}/bgd.jpg`;
  const H = HEAD[d.lang] || HEAD.uz_lat;
  const has = { about: !!d.about, exp: d.experience.length > 0, edu: d.education.length > 0, skills: d.skills.length > 0, langs: d.langs.length > 0 };
  const contacts = [["phone", d.phone], ["email", d.email], ["city", d.city], ["birth", d.birth && (CONTACT_LABEL[d.lang] || CONTACT_LABEL.uz_lat).birth + " " + d.birth]].filter(([, v]) => v);
  has.contact = contacts.length > 0;
  const parts = []; // matnlar
  const under = []; // bezak yamoqlari va rasm — matn ostida

  for (const [key, boxes] of Object.entries(spec.deco)) if (has[key]) boxes.forEach((b) => under.push(patch(bgd, b)));

  if (d.photoUrl) {
    const p = spec.photo.box;
    under.push(`<img class="photo" src="${esc(d.photoUrl)}" style="left:${mm(p[0])};top:${mm(p[1])};width:${mm(p[2])};height:${mm(p[3])};border-radius:${spec.photo.round ? "50%" : "1.5mm"}" alt="">`);
  }

  const words = d.name.split(/\s+/).filter(Boolean);
  for (const s of spec.slots) {
    if (s.t === "name") {
      // quti ikki qatorga yetsa — Canva'dagidek ism va familiya alohida qatorda
      const two = words.length > 1 && (s.lines > 1 || s.box[3] / (s.st.size * 0.3528) >= 1.5);
      parts.push(box(s.box, s.st, two ? `${esc(words[0])}<br>${esc(words.slice(1).join(" "))}` : esc(d.name), two ? { lh: 1.02 } : { one: true }));
    }
    else if (s.t === "name1") parts.push(box(s.box, s.st, esc(words[0] || ""), { one: true }));
    else if (s.t === "name2") parts.push(box(s.box, s.st, esc(words.slice(1).join(" ")), { one: true }));
    else if (s.t === "pos" && d.position) parts.push(box(s.box, s.st, esc(d.position), { one: true }));
    else if (s.t === "h" && has[s.key]) parts.push(box(s.box, s.st, esc(H[s.key]), { one: true }));
    else if (s.t === "about" && has.about) parts.push(box(s.box, s.st, `<div class="pre">${esc(d.about)}</div>`, { justify: "flex-start" }));
    else if (s.t === "list" && has[s.key]) {
      const list = s.key === "skills" ? d.skills : d.langs;
      parts.push(box(s.box, s.st, list.map((x) => `<div class="li">${s.bullet ? '<span class="b">•</span>' : ""}<span>${esc(x)}</span></div>`).join(""), { justify: "flex-start" }));
    } else if (s.t === "items" && has[s.key]) {
      parts.push(box(s.box, { ...s.a, ins: [0, 0, 0, 0], anchor: "t" }, itemsHtml(s, s.key === "exp" ? d.experience : d.education), { justify: "flex-start" }));
    } else if (s.t === "plaincontact" && has.contact) {
      parts.push(box(s.box, s.st, contacts.map(([, v]) => `<div class="li"><span>${esc(v)}</span></div>`).join(""), { justify: "flex-start" }));
    }
  }

  const c = spec.contact;
  if (c && has.contact) {
    parts.push(box(c.h.box, c.h.st, esc(H.contact), { one: true }));
    c.deco.forEach((b) => under.push(patch(bgd, b)));
    contacts.slice(0, c.lines.length).forEach(([field, value], i) => {
      const line = c.lines[i];
      parts.push(box(line.text.box, line.text.st, esc(field === "birth" && c.mode === "label" ? d.birth : value), { one: true }));
      if (c.mode === "icon" && c.icons[field]) under.push(patch(bgd, c.icons[field], line.icon));
      if (c.mode === "label") parts.push(box(line.label.box, line.label.st, esc((CONTACT_LABEL[d.lang] || CONTACT_LABEL.uz_lat)[field]), { one: true }));
    });
  }

  return `<!doctype html><html><head><meta charset="utf-8">
<link href="${fontsLink(spec)}" rel="stylesheet">
<style>
@page{ size:A4; margin:0 }
*{ box-sizing:border-box; margin:0; padding:0 }
html,body{ width:210mm; height:297mm; overflow:hidden; -webkit-print-color-adjust:exact; print-color-adjust:exact }
body{ position:relative; background:#fff url('${dir}/bg.jpg') 0 0 / 210mm 297mm no-repeat }
.fit,.patch,.photo{ position:absolute }
.fit{ display:flex; flex-direction:column; overflow:hidden }
.fit.one .in{ white-space:nowrap }
.patch{ background-repeat:no-repeat; background-size:210mm 297mm }
.photo{ object-fit:cover }
.pre{ white-space:pre-wrap }
.li{ display:flex; gap:.45em; margin-bottom:.32em }
.li .b{ flex:none }
.item{ margin-bottom:.75em; break-inside:avoid }
.row{ display:flex; align-items:baseline }
</style></head><body>${under.join("")}${parts.join("\n")}
<script>
// Joyiga sig'magan matnni 50% gacha kichraytiradi
window.__fit = function () {
  document.querySelectorAll(".fit").forEach(function (el) {
    var inner = el.firstElementChild, k = 1;
    var over = function () {
      var cs = getComputedStyle(el);
      var h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return inner.scrollHeight > h + 0.5 || inner.scrollWidth > w + 0.5;
    };
    while (over() && k > 0.5) { k -= 0.04; el.style.setProperty("--k", k.toFixed(2)); }
  });
};
</script></body></html>`;
}

module.exports = { rezHtml, loadSpec, REZ_IDS };
