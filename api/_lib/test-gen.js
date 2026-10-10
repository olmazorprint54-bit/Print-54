// api/_lib/test-gen.js
// ---------------------------------------------------------------
// "Test tuzish" — savollarni Claude (Sonnet 5.5) tuzadi, qolgani
// avtomatik: variantlar (savol va javoblar aralashtiriladi), javoblar
// kaliti, PDF (3 ta oddiy dizayn) yoki Word, yoki Telegram quiz.
// Canva dizaynlari hozircha qo'lda (egaga keladi).
// ---------------------------------------------------------------

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, PageBreak, Math: OMath, MathFraction, MathRun, SectionType,
} = require("docx");
const JSZip = require("jszip");
const { askJson, hasKey } = require("./ai");

const MODEL = () => require("./ai").modelFor("TEXT_MODEL"); // standart: Sonnet 5.5
const STYLES = ["classic", "twocol", "sheet"];

const LANG_NAMES = { uz_lat: "Uzbek (Latin script)", uz_cyr: "Uzbek (Cyrillic script)", ru: "Russian", en: "English" };
const LETTERS = { uz_lat: "ABCDE", en: "ABCDE", uz_cyr: "АБВГД", ru: "АБВГД" };
const LABELS = {
  uz_lat: { subject: "Fan", topic: "Mavzu", grade: "Sinf", variant: "Variant", name: "F.I.Sh.", date: "Sana", key: "Javoblar kaliti", sheet: "Javoblar varaqasi", q: "Savol" },
  uz_cyr: { subject: "Фан", topic: "Мавзу", grade: "Синф", variant: "Вариант", name: "Ф.И.Ш.", date: "Сана", key: "Жавоблар калити", sheet: "Жавоблар варақаси", q: "Савол" },
  ru: { subject: "Предмет", topic: "Тема", grade: "Класс", variant: "Вариант", name: "Ф.И.О.", date: "Дата", key: "Ключ ответов", sheet: "Бланк ответов", q: "Вопрос" },
  en: { subject: "Subject", topic: "Topic", grade: "Grade", variant: "Variant", name: "Name", date: "Date", key: "Answer key", sheet: "Answer sheet", q: "Question" },
};
const DIFFICULTY = {
  easy: "easy — basic recall and simple understanding",
  medium: "medium — understanding and application",
  hard: "hard — analysis, multi-step reasoning and tricky distractors",
  mixed: "mixed — roughly 30% easy, 50% medium, 20% hard, in random order",
};

const clean = (v, max = 200) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const clamp = (n, a, b, d) => (Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d);

function testData(f) {
  const lang = LANG_NAMES[f.lang] ? f.lang : "uz_lat";
  return {
    subject: clean(f.subject, 120),
    topic: clean(f.topic, 200),
    grade: clean(f.grade, 60),
    count: clamp(parseInt(f.count, 10), 5, 100, 20),
    answers: clamp(parseInt(f.answers, 10), 3, 5, 4),
    difficulty: DIFFICULTY[f.difficulty] ? f.difficulty : "mixed",
    variants: [1, 2, 4].includes(parseInt(f.variants, 10)) ? parseInt(f.variants, 10) : 1,
    lang,
    style: STYLES.includes(f.template) ? f.template : "classic",
    key: f.key !== false,
    format: ["docx", "pdf", "quiz"].includes(f.format) ? f.format : "pdf",
  };
}

// Avtomatik bo'ladimi: API kalit bor, oddiy dizayn, fan va mavzu yozilgan
function canAutoTest(f) {
  return !!(hasKey() && f && (STYLES.includes(f.template) || f.format === "quiz") && clean(f.subject) && clean(f.topic));
}

const SYSTEM = `You write school and university multiple-choice tests for teachers in Uzbekistan.
Quality rules:
- Every question is factually correct, unambiguous and has exactly one correct option.
- Distractors are plausible (common mistakes), similar in length and style to the correct option.
- No "all of the above" / "none of the above", no trick wording, no repeated questions.
- Spread the correct option position evenly across the options.
- Options are plain text without letter prefixes like "A)".
- Math: write formulas in plain text (x², √2, 3/4), no LaTeX. Write every fraction as a/b (e.g. 3/4) and a mixed number as "2 1/2" — never use ½-style characters; they are typeset as textbook fractions.`;

function testPrompt(d, count) {
  return `Create a test.
Subject: ${d.subject}
Topic: ${d.topic}
Level / grade: ${d.grade || "not specified — choose a typical school level for this topic"}
Number of questions: exactly ${count}
Options per question: exactly ${d.answers}
Difficulty: ${DIFFICULTY[d.difficulty]}
Language of everything (title, questions, options): ${LANG_NAMES[d.lang]}

Return "title" (short test title) and "questions": each with "question", "options" (${d.answers} strings) and "correct" (0-based index of the correct option).`;
}

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct: { type: "integer" },
        },
        required: ["question", "options", "correct"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false,
};

// Claude'dan savollar. Qaytaradi: { d, title, questions, ai }
async function generateTest(fields) {
  const d = testData(fields);
  const ai = await askJson({
    model: MODEL(),
    system: SYSTEM,
    prompt: require("./sources").sourcesBlock(fields) + testPrompt(d, d.count),
    schema: SCHEMA,
    maxTokens: 64000,
    effort: "medium",
  });
  const questions = (ai.data.questions || [])
    .map((q) => ({
      question: clean(q.question, 1000),
      options: (q.options || []).map((o) => clean(o, 400)),
      correct: q.correct,
    }))
    .filter((q) => q.question && q.options.length === d.answers && q.options.every(Boolean) &&
      Number.isInteger(q.correct) && q.correct >= 0 && q.correct < d.answers)
    .slice(0, d.count);
  if (questions.length < Math.ceil(d.count * 0.8)) throw new Error(`AI ${questions.length}/${d.count} ta yaroqli savol qaytardi`);
  return { d, title: clean(ai.data.title, 200) || d.topic, questions, ai };
}

/* ---------- variantlar ---------- */
// Takrorlanadigan tasodifiy sonlar (bir xil buyurtma — bir xil variantlar)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 1-variant — AI bergan tartibda, qolganlarida savollar va javoblar aralashtiriladi
function makeVariants(questions, n, seed) {
  const out = [questions];
  for (let v = 2; v <= n; v++) {
    const rand = rng(seed * 31 + v);
    out.push(shuffle(questions, rand).map((q) => {
      const order = shuffle(q.options.map((_, i) => i), rand);
      return { question: q.question, options: order.map((i) => q.options[i]), correct: order.indexOf(q.correct) };
    }));
  }
  return out;
}

/* ---------- PDF (HTML -> Chrome) ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Matndagi kasrlar: "3/4", aralash son "2 1/2" -> [matn, {w, n, d}, matn ...]
// 1–3 xonali sonlar (yillar "2024/2025" va sanalar "12/05/2024" kasr emas)
function fracParts(text) {
  const s = String(text == null ? "" : text);
  const out = [];
  const re = /(^|[^\d/.,])(?:(\d{1,3}) )?(\d{1,3})\/(\d{1,3})(?![\d/])/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (+m[4] === 0) continue;
    const start = m.index + m[1].length;
    if (start > last) out.push(s.slice(last, start));
    out.push({ w: m[2] || "", n: m[3], d: m[4] });
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function testHtml(t, variants) {
  const { d } = t;
  const L = LABELS[d.lang];
  const letters = LETTERS[d.lang];
  const multi = variants.length > 1;
  const head = (v) => `
    <div class="head">
      <h1>${esc(t.title)}</h1>
      <table class="meta"><tr>
        <td><b>${L.subject}:</b> ${esc(d.subject)}</td>
        ${d.grade ? `<td><b>${L.grade}:</b> ${esc(d.grade)}</td>` : ""}
        ${multi ? `<td class="var">${L.variant} ${v + 1}</td>` : ""}
      </tr></table>
      <div class="line"><b>${L.name}:</b> <span class="blank"></span> <b>${L.date}:</b> <span class="blank short"></span></div>
    </div>`;
  const fr = (s) => fracParts(s).map((x) => (typeof x === "string" ? esc(x) : `${x.w ? `${x.w}<span class="fw"></span>` : ""}<span class="fr"><span>${x.n}</span><span>${x.d}</span></span>`)).join("");
  const qs = (list) => `<ol class="qs">${list.map((q) => `
      <li><div class="q">${fr(q.question)}</div>
        <div class="opts">${q.options.map((o, i) => `<span class="o"><b>${letters[i]})</b> ${fr(o)}</span>`).join("")}</div></li>`).join("")}</ol>`;
  const sheet = (list, v) => `
    <div class="page sheet">
      <h2>${L.sheet}${multi ? ` — ${L.variant} ${v + 1}` : ""}</h2>
      <div class="line"><b>${L.name}:</b> <span class="blank"></span></div>
      <div class="grid">${list.map((_, i) => `<div class="row"><span class="n">${i + 1}.</span>${letters.slice(0, d.answers).split("").map((l) => `<span class="b">${l}</span>`).join("")}</div>`).join("")}</div>
    </div>`;
  const key = `
    <div class="page keyp">
      <h2>${L.key}</h2>
      ${variants.map((list, v) => `${multi ? `<h3>${L.variant} ${v + 1}</h3>` : ""}
        <div class="keys">${list.map((q, i) => `<span>${i + 1}–${letters[q.correct]}</span>`).join("")}</div>`).join("")}
    </div>`;
  const css = `
    @page{size:A4;margin:14mm 14mm 16mm}
    *{box-sizing:border-box}
    body{margin:0;font-family:"Noto Sans",Arial,sans-serif;font-size:${d.style === "twocol" ? "10.5pt" : "11.5pt"};color:#111;line-height:1.35}
    .page{break-before:page}
    .page:first-child{break-before:auto}
    h1{font-size:15pt;margin:0 0 6px;text-align:center}
    h2{font-size:14pt;margin:0 0 10px;text-align:center}
    h3{font-size:11.5pt;margin:12px 0 6px}
    .meta{width:100%;border-collapse:collapse;margin:4px 0 6px}
    .meta td{padding:2px 0}
    .meta .var{text-align:right;font-weight:700;font-size:12.5pt}
    .line{margin:4px 0 10px;display:flex;gap:6px;align-items:flex-end}
    .blank{flex:1;border-bottom:1px solid #333;height:14px}
    .blank.short{flex:0 0 32mm}
    .head{border-bottom:2px solid #111;margin-bottom:10px}
    /* raqam qator ichida (o'z joyida): ikki xonali raqam chetga yoki ustunlar orasidagi chiziqqa chiqmaydi */
    .qs{margin:0;padding:0;list-style:none;counter-reset:q}
    .qs li{counter-increment:q;display:grid;grid-template-columns:2.2em minmax(0,1fr);column-gap:.4em;align-items:baseline}
    .qs li::before{content:counter(q) ".";grid-row:1;text-align:right}
    .qs li>.q,.qs li>.opts{grid-column:2}
    ${d.style === "twocol" ? ".qs{columns:2;column-gap:9mm;column-rule:1px solid #ccc}" : ""}
    .qs li{break-inside:avoid;margin:0 0 ${d.style === "twocol" ? "7px" : "10px"}}
    .q{font-weight:600;margin-bottom:3px}
    .opts{display:${d.style === "twocol" ? "block" : "grid"};grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 14px}
    .o{display:block}
    /* kasr — darslikdagidek: surat chiziq ustida, maxraj ostida */
    .fr{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:.9em;line-height:1.12;margin:0 .1em}
    .fr>span:first-child{border-bottom:1px solid currentColor;padding:0 .2em}
    .fw{display:inline-block;width:.12em}
    .grid{columns:3;column-gap:10mm;margin-top:10px}
    .row{display:flex;align-items:center;gap:6px;margin:0 0 6px;break-inside:avoid}
    .row .n{width:24px;text-align:right;font-weight:700}
    .b{width:20px;height:20px;border:1.3px solid #333;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9pt}
    .keys{display:flex;flex-wrap:wrap;gap:6px 14px}
    .keys span{min-width:44px}`;
  const body = variants.map((list, v) => `<div class="page">${head(v)}${qs(list)}</div>${d.style === "sheet" ? sheet(list, v) : ""}`).join("") + (d.key ? key : "");
  return `<!doctype html><html><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">
    <style>${css}</style></head><body>${body}</body></html>`;
}

/* ---------- Word ---------- */
const MATH_SZ = 26; // yarim punkt: 13 pt

async function testDocx(t, variants) {
  const { d } = t;
  const L = LABELS[d.lang];
  const letters = LETTERS[d.lang];
  const multi = variants.length > 1;
  const FONT = "Times New Roman";
  const p = (text, o = {}) => new Paragraph({ alignment: o.center ? AlignmentType.CENTER : undefined, spacing: { after: o.after == null ? 60 : o.after }, indent: o.indent ? { left: o.indent } : undefined,
    children: [].concat(text).map((x) => (typeof x === "string" ? new TextRun({ text: x, font: FONT, size: o.size || 24, bold: o.bold }) : x)) });
  const run = (text, bold) => new TextRun({ text, font: FONT, size: 24, bold });
  // matn + kasrlar (Word formulasi: surat chiziq ustida)
  const rich = (text, bold) => fracParts(text).flatMap((x) => (typeof x === "string" ? [run(x, bold)] : [
    ...(x.w ? [run(x.w, bold)] : []),
    new OMath({ children: [new MathFraction({ numerator: [new MathRun(x.n)], denominator: [new MathRun(x.d)] })] }),
  ]));
  // Bo'limlar: har bir variantda sarlavha to'liq kenglikda, savollar — dizayn bo'yicha
  // (ikki ustunli shablon: 2 ustun, orasida chiziq); kalit — yangi sahifada
  const page = { margin: { top: 1000, bottom: 1000, left: 1100, right: 900 } };
  const twocol = d.style === "twocol";
  const sections = [];
  variants.forEach((list, v) => {
    const head = [];
    head.push(p(t.title, { center: true, bold: true, size: 30, after: 120 }));
    head.push(p([run(`${L.subject}: `, true), run(d.subject), ...(d.grade ? [run(`     ${L.grade}: `, true), run(d.grade)] : []), ...(multi ? [run(`     ${L.variant} ${v + 1}`, true)] : [])]));
    head.push(p([run(`${L.name}: `, true), run("______________________________   "), run(`${L.date}: `, true), run("__________")], { after: 200 }));
    sections.push({ properties: { page, ...(v > 0 ? { type: SectionType.NEXT_PAGE } : {}) }, children: head });
    const body = [];
    list.forEach((q, i) => {
      body.push(p([run(`${i + 1}. `, true), ...rich(q.question, true)], { after: 40 }));
      q.options.forEach((o, j) => body.push(p([run(`${letters[j]}) `, true), ...rich(o)], { indent: twocol ? 300 : 400, after: 20 })));
      body.push(p("", { after: twocol ? 60 : 80 }));
    });
    sections.push({ properties: { page, type: SectionType.CONTINUOUS, ...(twocol ? { column: { count: 2, space: 510, separate: true } } : {}) }, children: body });
  });
  const children = [];
  if (d.key) {
    children.push(p(L.key, { center: true, bold: true, size: 28, after: 160 }));
    const NONE = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
    variants.forEach((list, v) => {
      if (multi) children.push(p(`${L.variant} ${v + 1}`, { bold: true, after: 80 }));
      const rows = [];
      for (let i = 0; i < list.length; i += 10) {
        rows.push(new TableRow({ children: list.slice(i, i + 10).map((q, k) => new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
          children: [p(`${i + k + 1}–${letters[q.correct]}`, { center: true, after: 0 })],
        })) }));
      }
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
      children.push(p("", { after: 120 }));
    });
  }
  if (children.length) sections.push({ properties: { page, type: SectionType.NEXT_PAGE }, children });
  const buf = await Packer.toBuffer(new Document({ sections }));
  // Kasr raqamlari matndan kichik chiqmasin: formula shrifti 13 pt (Word'da odatiy 11 pt)
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml").async("string");
  zip.file("word/document.xml", xml.split("<m:r><m:t").join(`<m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:sz w:val="${MATH_SZ}"/><w:szCs w:val="${MATH_SZ}"/></w:rPr><m:t`));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

const fileBase = (d) => `Test - ${d.subject} - ${d.topic}`.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").slice(0, 90);

module.exports = { fracParts, MODEL, testData, canAutoTest, generateTest, makeVariants, testHtml, testDocx, fileBase, LETTERS };
