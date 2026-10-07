// api/_lib/resume-html.js
// ---------------------------------------------------------------
// Mijoz kiritgan ma'lumotlardan A4 resume sahifasini (HTML) yasaydi.
// Uchta dizayn — ilovadagi "Klassik", "Zamonaviy (yon panel)" va
// "Minimal" namunalari bilan bir xil ko'rinishda. HTML keyin
// resume-pdf.js da Chrome orqali PDF ga aylantiriladi.
// AI ishlatilmaydi: matn mijoz yozganidek joylanadi.
// ---------------------------------------------------------------

const STYLES = ["classic", "modern", "minimal"];

const LABELS = {
  uz_lat: { exp: "Ish tajribasi", edu: "Ma'lumoti", skills: "Ko'nikmalar", langs: "Tillar", contact: "Aloqa", born: "Tug'ilgan yil" },
  ru: { exp: "Опыт работы", edu: "Образование", skills: "Навыки", langs: "Языки", contact: "Контакты", born: "Год рождения" },
  en: { exp: "Work experience", edu: "Education", skills: "Skills", langs: "Languages", contact: "Contact", born: "Born" },
};

const LANG_NAMES = {
  ru: { "O'zbek": "Узбекский", Rus: "Русский", Ingliz: "Английский", Turk: "Турецкий", Koreys: "Корейский", Nemis: "Немецкий", Arab: "Арабский" },
  en: { "O'zbek": "Uzbek", Rus: "Russian", Ingliz: "English", Turk: "Turkish", Koreys: "Korean", Nemis: "German", Arab: "Arabic" },
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const text = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

// "2019–2021 — Bank, kassir" kabi qatorni sana va matnga ajratadi
const DATE_RE = /^((?:19|20)\d{2}(?:\s*(?:[-–—]|dan)\s*(?:(?:19|20)\d{2}|hozir(?:gacha)?|h\.?\s?v\.?|present|now|н\.?\s?в\.?|по\s+настоящее(?:\s+время)?)?)?(?:\s*(?:yil|y\.|г\.?))?)\s*(?:[-–—:,]\s*)?(.*)$/i;
function splitItem(line) {
  const m = line.match(DATE_RE);
  if (!m || !m[2]) return { date: "", body: line };
  const date = m[1].trim().replace(/\s*(?:[-–—]|dan)$/i, "").replace(/\s*[-–—]\s*/, " – ");
  return { date, body: m[2] };
}
const linesOf = (v) => text(v, 1200).split(/\n+/).map((x) => x.trim().replace(/^[•\-*·]\s*/, "")).filter(Boolean);

// Buyurtma maydonlaridan resume ma'lumotini yig'adi
function resumeData(fields, photoUrl) {
  const f = fields || {};
  const lang = LABELS[f.lang] ? f.lang : "uz_lat";
  const names = LANG_NAMES[lang] || {};
  return {
    style: STYLES.includes(f.template) ? f.template : "classic",
    lang,
    name: text(f.name, 80),
    position: text(f.position, 120),
    phone: text(f.phone, 40),
    email: text(f.email, 120),
    city: text(f.city, 60),
    birth: text(f.birth, 20),
    experience: linesOf(f.experience).map(splitItem),
    education: linesOf(f.education).map(splitItem),
    skills: text(f.skills, 600).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean).slice(0, 20),
    langs: (Array.isArray(f.langs) ? f.langs : []).map((x) => names[x] || x),
    photoUrl: f.photo !== false && photoUrl ? photoUrl : "",
  };
}

const canAutoResume = (fields) => !!(fields && STYLES.includes(fields.template) && fields.format !== "docx" && text(fields.name, 80));

function itemsHtml(list) {
  return list.map((it) => `<div class="item">${it.date ? `<div class="date">${esc(it.date)}</div>` : ""}<div class="body">${esc(it.body)}</div></div>`).join("");
}

function resumeHtml(d) {
  const L = LABELS[d.lang];
  const contact = [d.phone, d.email, d.city, d.birth && `${L.born}: ${d.birth}`].filter(Boolean);
  const sec = (title, inner) => (inner ? `<section><h2>${esc(title)}</h2>${inner}</section>` : "");
  const exp = sec(L.exp, itemsHtml(d.experience));
  const edu = sec(L.edu, itemsHtml(d.education));
  const skills = sec(L.skills, d.skills.length ? `<div class="chips">${d.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : "");
  const langs = sec(L.langs, d.langs.length ? `<p>${esc(d.langs.join(", "))}</p>` : "");
  const photo = d.photoUrl ? `<img class="photo" src="${esc(d.photoUrl)}" alt="">` : "";
  const head = `<h1>${esc(d.name)}</h1>${d.position ? `<div class="pos">${esc(d.position)}</div>` : ""}`;

  let body;
  if (d.style === "modern") {
    body = `<aside>${photo}
        <h3>${esc(L.contact)}</h3>${contact.map((c) => `<p>${esc(c)}</p>`).join("")}
        ${d.skills.length ? `<h3>${esc(L.skills)}</h3>${d.skills.map((s) => `<p>• ${esc(s)}</p>`).join("")}` : ""}
        ${d.langs.length ? `<h3>${esc(L.langs)}</h3><p>${esc(d.langs.join(", "))}</p>` : ""}
      </aside>
      <main>${head}${exp}${edu}</main>`;
  } else if (d.style === "minimal") {
    body = `<header>${photo}${head}<div class="contact">${contact.map(esc).join(" · ")}</div></header>${exp}${edu}${skills}${langs}`;
  } else {
    body = `<header>${photo}<div>${head}<div class="contact">${contact.map(esc).join(" · ")}</div></div></header>${exp}${edu}${skills}${langs}`;
  }

  return `<!doctype html><html lang="${d.lang === "ru" ? "ru" : d.lang === "en" ? "en" : "uz"}"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=PT+Serif:wght@400;700&display=block&subset=latin-ext,cyrillic" rel="stylesheet">
<style>${CSS[d.style]}</style></head><body class="${d.style}">${body}</body></html>`;
}

const BASE = `
@page{ size:A4; margin:14mm 0 }
@page :first{ margin-top:0 }
*{ box-sizing:border-box; margin:0; padding:0 }
html{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
body{ font-size:10.5pt; line-height:1.45; color:#1f2937 }
section{ margin-top:7mm }
.item{ display:flex; gap:5mm; margin-top:2.2mm; break-inside:avoid }
.date{ flex:none; width:34mm; font-weight:600; color:#374151 }
.body{ flex:1; white-space:pre-wrap }
.chips{ display:flex; flex-wrap:wrap; gap:2mm; margin-top:2.5mm }
.chips span{ padding:1mm 3.2mm; border-radius:4mm; font-size:9.5pt }
p{ margin-top:2mm }
h2{ break-after:avoid }
.photo{ display:block; object-fit:cover; border-radius:2.5mm }
`;

const CSS = {
  classic: BASE + `
body{ font-family:Inter,Arial,sans-serif; padding:16mm 17mm }
header{ display:flex; gap:7mm; align-items:center; padding-bottom:5mm; border-bottom:1.3mm solid #0F766E }
.photo{ width:32mm; height:38mm; flex:none }
h1{ font-size:24pt; font-weight:800; line-height:1.1; color:#111827 }
.pos{ font-size:13pt; color:#0F766E; margin-top:1.5mm; font-weight:600 }
.contact{ font-size:9.5pt; color:#6b7280; margin-top:2.5mm }
h2{ font-size:12.5pt; font-weight:700; color:#0F766E }
.chips span{ background:#0F766E1f; color:#0F766E }
`,
  modern: BASE + `
@page{ margin:0 }
html{ background:linear-gradient(to right, #1E293B 0 33%, #fff 33% 100%) }
body{ font-family:Inter,Arial,sans-serif; display:flex }
aside, main{ -webkit-box-decoration-break:clone; box-decoration-break:clone }
aside{ width:33%; flex:none; color:#E2E8F0; padding:16mm 7mm; font-size:9.5pt; word-break:break-word }
aside .photo{ width:100%; aspect-ratio:5/6; margin-bottom:6mm }
aside h3{ font-size:10pt; font-weight:700; color:#93C5FD; text-transform:uppercase; letter-spacing:.06em; margin-top:6mm }
aside h3:first-of-type{ margin-top:0 }
main{ flex:1; padding:16mm 13mm 16mm 9mm }
h1{ font-size:24pt; font-weight:800; line-height:1.1; color:#0f172a }
.pos{ font-size:13pt; color:#2563EB; margin-top:1.5mm; font-weight:600 }
h2{ font-size:11.5pt; font-weight:800; color:#2563EB; text-transform:uppercase; letter-spacing:.08em }
.date{ width:30mm }
`,
  minimal: BASE + `
body{ font-family:"PT Serif",Georgia,serif; padding:18mm 20mm; color:#111827 }
header{ text-align:center }
.photo{ width:28mm; height:34mm; margin:0 auto 5mm }
h1{ font-size:24pt; font-weight:400; letter-spacing:.06em }
.pos{ font-size:12.5pt; color:#6b7280; margin-top:1.5mm }
.contact{ font-size:9.5pt; color:#6b7280; margin-top:2.5mm }
h2{ font-size:10pt; font-weight:400; letter-spacing:.22em; text-transform:uppercase; color:#6b7280; padding-bottom:1.5mm; border-bottom:.3mm solid #e5e7eb }
.chips span{ border:.3mm solid #d1d5db; color:#374151 }
`,
};

module.exports = { resumeData, resumeHtml, canAutoResume, STYLES };
