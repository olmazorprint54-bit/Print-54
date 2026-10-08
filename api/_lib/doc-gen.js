// api/_lib/doc-gen.js
// ---------------------------------------------------------------
// AI matnli xizmatlar: mustaqil ish, referat, dars ishlanma, savollar,
// krossvord. Matnni Claude (Sonnet 5.5) yozadi, hujjat shakli va titul
// varag'i — kodda (api/_lib/doc-render.js). Natija: { blocks, render, name, ai }
// ai — barcha so'rovlarning jami tokeni va narxi.
// Canva dizaynlari (dars ishlanma, krossvord) hozircha qo'lda.
// ---------------------------------------------------------------

const { askJson, hasKey } = require("./ai");

const MODEL = "claude-sonnet-5-5";
const LANG_NAMES = { uz_lat: "Uzbek (Latin script)", uz_cyr: "Uzbek (Cyrillic script)", ru: "Russian", en: "English" };
const AUTO_STYLES = {
  essay: ["otm", "school", "modern"],
  referat: ["otm", "school", "modern"],
  lesson: ["table", "techmap", "notes"],
  questions: ["list", "cards"],
  crossword: ["classic", "color"],
};
const MAX_PAGES = { essay: 30, referat: 30 }; // 300 soniyalik chegara ichida yozib bo'ladigani

const L = {
  uz_lat: {
    essay: "MUSTAQIL ISH", referat: "REFERAT", subject: "Fan", topic: "Mavzu", did: "Bajardi", group: "Guruh", got: "Qabul qildi",
    plan: "Reja", intro: "Kirish", concl: "Xulosa", refs: "Foydalanilgan adabiyotlar", ch: "bob",
    lesson: "Dars ishlanma", grade: "Sinf", type: "Dars turi", time: "Vaqti", teacher: "O'qituvchi", school: "Maktab",
    goals: "Darsning maqsadlari", edu: "Ta'limiy", dev: "Rivojlantiruvchi", up: "Tarbiyaviy", outcomes: "Kutilayotgan natijalar",
    equip: "Jihozlar", methods: "Metodlar", course: "Darsning borishi", stage: "Bosqich", min: "daq.", tAct: "O'qituvchi faoliyati",
    sAct: "O'quvchi faoliyati", method: "Metod", hw: "Uyga vazifa", assess: "Baholash",
    questions: "Savollar", answers: "Javoblar", across: "Gorizontal bo'yicha", down: "Vertikal bo'yicha",
    crossword: "Krossvord", key: "Javoblar", name: "F.I.Sh.", year: "yil",
    types: { new: "Yangi bilim beruvchi", reinforce: "Mustahkamlash", review: "Takrorlash", control: "Nazorat", mixed: "Aralash" },
  },
  uz_cyr: {
    essay: "МУСТАҚИЛ ИШ", referat: "РЕФЕРАТ", subject: "Фан", topic: "Мавзу", did: "Бажарди", group: "Гуруҳ", got: "Қабул қилди",
    plan: "Режа", intro: "Кириш", concl: "Хулоса", refs: "Фойдаланилган адабиётлар", ch: "боб",
    lesson: "Дарс ишланма", grade: "Синф", type: "Дарс тури", time: "Вақти", teacher: "Ўқитувчи", school: "Мактаб",
    goals: "Дарснинг мақсадлари", edu: "Таълимий", dev: "Ривожлантирувчи", up: "Тарбиявий", outcomes: "Кутилаётган натижалар",
    equip: "Жиҳозлар", methods: "Методлар", course: "Дарснинг бориши", stage: "Босқич", min: "дақ.", tAct: "Ўқитувчи фаолияти",
    sAct: "Ўқувчи фаолияти", method: "Метод", hw: "Уйга вазифа", assess: "Баҳолаш",
    questions: "Саволлар", answers: "Жавоблар", across: "Горизонтал бўйича", down: "Вертикал бўйича",
    crossword: "Кроссворд", key: "Жавоблар", name: "Ф.И.Ш.", year: "йил",
    types: { new: "Янги билим берувчи", reinforce: "Мустаҳкамлаш", review: "Такрорлаш", control: "Назорат", mixed: "Аралаш" },
  },
  ru: {
    essay: "САМОСТОЯТЕЛЬНАЯ РАБОТА", referat: "РЕФЕРАТ", subject: "Предмет", topic: "Тема", did: "Выполнил(а)", group: "Группа", got: "Проверил(а)",
    plan: "План", intro: "Введение", concl: "Заключение", refs: "Список литературы", ch: "глава",
    lesson: "План урока", grade: "Класс", type: "Тип урока", time: "Время", teacher: "Учитель", school: "Школа",
    goals: "Цели урока", edu: "Образовательная", dev: "Развивающая", up: "Воспитательная", outcomes: "Ожидаемые результаты",
    equip: "Оборудование", methods: "Методы", course: "Ход урока", stage: "Этап", min: "мин.", tAct: "Деятельность учителя",
    sAct: "Деятельность учащихся", method: "Метод", hw: "Домашнее задание", assess: "Оценивание",
    questions: "Вопросы", answers: "Ответы", across: "По горизонтали", down: "По вертикали",
    crossword: "Кроссворд", key: "Ответы", name: "Ф.И.О.", year: "год",
    types: { new: "Изучение нового", reinforce: "Закрепление", review: "Повторение", control: "Контроль", mixed: "Комбинированный" },
  },
  en: {
    essay: "INDEPENDENT WORK", referat: "REPORT", subject: "Subject", topic: "Topic", did: "Done by", group: "Group", got: "Checked by",
    plan: "Contents", intro: "Introduction", concl: "Conclusion", refs: "References", ch: "chapter",
    lesson: "Lesson plan", grade: "Grade", type: "Lesson type", time: "Duration", teacher: "Teacher", school: "School",
    goals: "Lesson objectives", edu: "Educational", dev: "Developmental", up: "Character", outcomes: "Expected outcomes",
    equip: "Materials", methods: "Methods", course: "Lesson procedure", stage: "Stage", min: "min", tAct: "Teacher activity",
    sAct: "Student activity", method: "Method", hw: "Homework", assess: "Assessment",
    questions: "Questions", answers: "Answers", across: "Across", down: "Down",
    crossword: "Crossword", key: "Answers", name: "Name", year: "",
    types: { new: "New material", reinforce: "Reinforcement", review: "Review", control: "Assessment", mixed: "Combined" },
  },
};
const LEVELS = { school: "school pupils", college: "college / lyceum students", bachelor: "university bachelor students", master: "master's degree students" };

const clean = (v, max = 300) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const clamp = (n, a, b, d) => (Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d);
const langOf = (f) => (LANG_NAMES[f.lang] ? f.lang : "uz_lat");
const fileSafe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 90);

function canAutoDoc(service, f) {
  if (!hasKey() || !f || !AUTO_STYLES[service]) return false;
  if (!AUTO_STYLES[service].includes(f.template)) return false;
  if (f.format === "png" && service !== "crossword") return false;
  return !!clean(f.topic);
}

// Bir nechta AI so'rovining jami narxi
function addCost(sum, ai) {
  if (!sum) return { model: ai.model, usage: { ...ai.usage }, usd: ai.usd };
  return { model: sum.model, usage: { input: sum.usage.input + ai.usage.input, output: sum.usage.output + ai.usage.output }, usd: sum.usd + ai.usd };
}

// Bir vaqtda ko'pi bilan n ta so'rov (API tezlik chegarasi uchun)
async function pool(tasks, n) {
  const out = new Array(tasks.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => {
    while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); }
  }));
  return out;
}

const STR = { type: "string" };
const STRS = { type: "array", items: STR };
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

const WRITER = `You are an experienced academic writer from Uzbekistan who writes student papers (mustaqil ish, referat) and teaching materials.
- Write natural, fluent, grammatically correct text in the requested language; for Uzbek follow the current official spelling (o', g', sh, ch; ' for tutuq belgisi).
- Be factually accurate. Use well-known facts, dates and names; if unsure about a precise figure, phrase it generally instead of inventing.
- Academic, clear style suited to the level. No markdown, no bullet symbols inside paragraphs, no headings inside paragraphs.
- Each paragraph is 4–8 sentences.`;

/* =================== MUSTAQIL ISH / REFERAT =================== */
function paperData(service, f) {
  const lang = langOf(f);
  const parts = service === "essay" && Array.isArray(f.parts) && f.parts.length ? f.parts : ["plan", "intro", "main", "conclusion", "refs"];
  return {
    service, lang,
    topic: clean(f.topic, 200), subject: clean(f.subject, 120),
    level: LEVELS[f.level] ? f.level : service === "essay" ? "bachelor" : "school",
    pages: clamp(parseInt(f.pages, 10), 3, MAX_PAGES[service], service === "essay" ? 15 : 10),
    style: AUTO_STYLES[service].includes(f.template) ? f.template : "otm",
    institution: clean(f.institution, 160), student: clean(f.student, 120), group: clean(f.group, 40),
    teacher: clean(f.teacher, 120), city: clean(f.city, 60) || (lang === "ru" ? "Ташкент" : lang === "uz_cyr" ? "Тошкент" : lang === "en" ? "Tashkent" : "Toshkent"),
    parts: new Set(parts),
  };
}

function titlePage(d) {
  const t = L[d.lang];
  const year = new Date().getFullYear();
  const lines = [];
  lines.push({ text: d.institution || " ", bold: true, size: 14 });
  lines.push({ text: d.service === "essay" ? t.essay : t.referat, bold: true, size: d.style === "modern" ? 28 : 24, gap: 55 });
  if (d.subject) lines.push({ text: `${t.subject}: ${d.subject}`, size: 14, gap: 8 });
  lines.push({ text: `${t.topic}: «${d.topic}»`, bold: true, size: 16, gap: 4 });
  const who = [
    d.student && `${t.did}: ${d.student}`,
    d.group && `${t.group}: ${d.group}`,
    d.teacher && `${t.got}: ${d.teacher}`,
  ].filter(Boolean);
  who.forEach((w, i) => lines.push({ text: w, align: "right", size: 14, gap: i ? 0 : 45 }));
  lines.push({ text: `${d.city} – ${year}${t.year ? " " + t.year : ""}`, size: 14 });
  return { t: "title", lines };
}

async function generatePaper(service, f) {
  const d = paperData(service, f);
  const t = L[d.lang];
  const lang = LANG_NAMES[d.lang];
  const essay = service === "essay";
  const bodyPages = Math.max(2, d.pages - 1 - (d.parts.has("plan") ? 1 : 0) - (d.parts.has("refs") ? 1 : 0));
  const words = bodyPages * 260;
  const nCh = essay ? (d.pages <= 10 ? 2 : 3) : 1;
  const nSec = essay ? (d.pages <= 8 ? 2 : 3) : clamp(Math.round(d.pages / 3), 2, 5, 3);
  const ctx = `Paper type: ${essay ? "mustaqil ish (independent study paper)" : "referat (short report)"}\nSubject: ${d.subject || "—"}\nTopic: ${d.topic}\nAudience: ${LEVELS[d.level]}\nLanguage: ${lang}`;
  let cost = null;

  // 1) Reja
  const outline = await askJson({
    model: MODEL, system: WRITER, effort: "medium", maxTokens: 4000,
    schema: obj({ chapters: { type: "array", items: obj({ title: STR, sections: STRS }) } }),
    prompt: `${ctx}\n\nMake the plan: exactly ${nCh} chapter(s)${essay ? "" : " (one chapter that just groups the sections; its title can repeat the topic)"}, each with exactly ${nSec} section titles. Titles are short, specific and logically ordered. Do not include introduction or conclusion.`,
  });
  cost = addCost(cost, outline);
  const chapters = outline.data.chapters.slice(0, nCh).map((c) => ({ title: clean(c.title, 200), sections: c.sections.slice(0, nSec).map((s) => clean(s, 200)) }));
  const allSections = chapters.flatMap((c) => c.sections);
  const introW = d.parts.has("intro") ? Math.round(words * 0.1) : 0;
  const conclW = d.parts.has("conclusion") ? Math.round(words * 0.08) : 0;
  const secW = Math.max(150, Math.round((words - introW - conclW) / allSections.length));
  const planText = chapters.map((c, i) => `${essay ? `${i + 1}-${t.ch}. ${c.title}\n` : ""}${c.sections.map((s, j) => `  ${essay ? `${i + 1}.${j + 1}` : j + 1}. ${s}`).join("\n")}`).join("\n");

  // 2) Matn (bo'limlar parallel yoziladi)
  const PARAS = { type: "array", items: STR };
  const tasks = [];
  if (d.parts.has("intro")) tasks.push(() => askJson({
    model: MODEL, system: WRITER, effort: "low", maxTokens: 6000, schema: obj({ paragraphs: PARAS }),
    prompt: `${ctx}\nPlan:\n${planText}\n\nWrite the INTRODUCTION (about ${introW} words): relevance of the topic, aim and tasks of the work, short overview of the structure.`,
  }));
  if (d.parts.has("main")) chapters.forEach((c) => c.sections.forEach((s) => tasks.push(() => askJson({
    model: MODEL, system: WRITER, effort: "low", maxTokens: 8000, schema: obj({ paragraphs: PARAS }),
    prompt: `${ctx}\nFull plan:\n${planText}\n\nWrite the text of the section "${s}"${essay ? ` (chapter "${c.title}")` : ""}: about ${secW} words. Do not repeat what other sections cover; do not write the section title.`,
  }))));
  if (d.parts.has("conclusion")) tasks.push(() => askJson({
    model: MODEL, system: WRITER, effort: "low", maxTokens: 5000, schema: obj({ paragraphs: PARAS }),
    prompt: `${ctx}\nPlan:\n${planText}\n\nWrite the CONCLUSION (about ${conclW} words): main findings of each part and a general conclusion.`,
  }));
  if (d.parts.has("refs")) tasks.push(() => askJson({
    model: MODEL, system: WRITER, effort: "low", maxTokens: 3000, schema: obj({ references: STRS }),
    prompt: `${ctx}\n\nList 6–10 references for this paper in standard bibliographic format (author, title, city, publisher, year). Use real, well-known sources only: laws and decrees of the Republic of Uzbekistan, textbooks, monographs, official websites (e.g. lex.uz). Do not invent books.`,
  }));
  const results = await pool(tasks, 3);
  results.forEach((r) => { cost = addCost(cost, r); });

  // 3) Hujjat
  const paras = (r) => (r.data.paragraphs || []).map((p) => clean(p, 4000)).filter(Boolean).map((text) => ({ t: "p", text }));
  let k = 0;
  const blocks = [titlePage(d)];
  if (d.parts.has("plan")) {
    blocks.push({ t: "h1", text: t.plan });
    const items = [];
    if (d.parts.has("intro")) items.push(t.intro);
    chapters.forEach((c, i) => {
      if (essay) items.push(`${i + 1}-${t.ch}. ${c.title}`);
      c.sections.forEach((s, j) => items.push(`${essay ? `   ${i + 1}.${j + 1}. ` : `${j + 1}. `}${s}`));
    });
    if (d.parts.has("conclusion")) items.push(t.concl);
    if (d.parts.has("refs")) items.push(t.refs);
    items.forEach((text) => blocks.push({ t: "p", text, indent: false }));
    blocks.push({ t: "pagebreak" });
  }
  if (d.parts.has("intro")) { blocks.push({ t: "h1", text: t.intro }, ...paras(results[k++])); blocks.push({ t: "pagebreak" }); }
  if (d.parts.has("main")) chapters.forEach((c, i) => {
    if (essay) blocks.push({ t: "h1", text: `${i + 1}-${t.ch.toUpperCase()}. ${c.title}` });
    c.sections.forEach((s, j) => blocks.push({ t: "h2", text: `${essay ? `${i + 1}.${j + 1}.` : `${j + 1}.`} ${s}` }, ...paras(results[k++])));
    blocks.push({ t: "pagebreak" });
  });
  if (d.parts.has("conclusion")) { blocks.push({ t: "h1", text: t.concl }, ...paras(results[k++])); blocks.push({ t: "pagebreak" }); }
  if (d.parts.has("refs")) {
    blocks.push({ t: "h1", text: t.refs });
    blocks.push({ t: "list", ordered: true, items: (results[k++].data.references || []).map((x) => clean(x, 400)).filter(Boolean).slice(0, 12) });
  }
  while (blocks[blocks.length - 1].t === "pagebreak") blocks.pop();
  return {
    blocks,
    render: { font: d.style === "modern" ? "Noto Sans" : "Times New Roman", size: 14, capsH1: d.style !== "modern" },
    name: fileSafe(`${essay ? "Mustaqil ish" : "Referat"} - ${d.topic}`),
    ai: cost,
  };
}

/* =================== DARS ISHLANMA =================== */
async function generateLesson(f) {
  const lang = langOf(f);
  const t = L[lang];
  const d = {
    subject: clean(f.subject, 120), topic: clean(f.topic, 200), grade: clean(f.grade, 10) || "7",
    type: t.types[f.type] ? f.type : "new", minutes: f.duration === "80" ? 80 : 45,
    methods: (Array.isArray(f.methods) ? f.methods : []).map((m) => clean(m, 60)).slice(0, 8),
    style: AUTO_STYLES.lesson.includes(f.template) ? f.template : "table",
    teacher: clean(f.teacher, 120), school: clean(f.school, 120),
  };
  const r = await askJson({
    model: MODEL, system: WRITER, effort: "medium", maxTokens: 12000,
    schema: obj({
      goals: obj({ educational: STR, developmental: STR, upbringing: STR }),
      outcomes: STRS, equipment: STRS,
      stages: { type: "array", items: obj({ name: STR, minutes: { type: "integer" }, method: STR, teacher: STR, students: STR }) },
      homework: STR, assessment: STR,
    }),
    prompt: `Write a detailed lesson plan for a teacher in an Uzbekistan general school (State educational standard, competency-based approach).
Subject: ${d.subject}
Grade: ${d.grade}
Topic: ${d.topic}
Lesson type: ${L.en.types[d.type]}
Duration: ${d.minutes} minutes (stage minutes must add up to exactly ${d.minutes})
Interactive methods to use: ${d.methods.join(", ") || "choose suitable ones"}
Language: ${LANG_NAMES[lang]}

Stages: organizational moment, checking homework / activation, explanation of the new topic (or the main activity for this lesson type), reinforcement with the chosen methods, assessment, homework. For each stage write concrete teacher actions (what exactly the teacher says/does, example questions) and student actions. 3–6 outcomes, realistic equipment.`,
  });
  const x = r.data;
  const blocks = [];
  blocks.push({ t: "h1", text: `${t.lesson}: «${d.topic}»` });
  blocks.push({ t: "table", widths: [30, 70], rows: [
    [t.subject, d.subject], [t.grade, d.grade], [t.topic, d.topic], [t.type, t.types[d.type]], [t.time, `${d.minutes} ${t.min}`],
    ...(d.teacher ? [[t.teacher, d.teacher]] : []), ...(d.school ? [[t.school, d.school]] : []),
    [t.methods, d.methods.join(", ") || x.stages.map((s) => s.method).filter(Boolean).join(", ")],
    [t.equip, x.equipment.join(", ")],
  ] });
  blocks.push({ t: "h2", text: t.goals });
  blocks.push({ t: "p", indent: false, text: `${t.edu}: ${x.goals.educational}` }, { t: "p", indent: false, text: `${t.dev}: ${x.goals.developmental}` }, { t: "p", indent: false, text: `${t.up}: ${x.goals.upbringing}` });
  blocks.push({ t: "h2", text: t.outcomes }, { t: "list", items: x.outcomes.map((o) => clean(o, 400)) });
  blocks.push({ t: "h2", text: t.course });
  if (d.style === "notes") {
    x.stages.forEach((s, i) => blocks.push({ t: "p", indent: false, text: `${i + 1}. ${s.name} (${s.minutes} ${t.min})` }, { t: "p", text: s.teacher }, { t: "p", text: s.students }));
  } else if (d.style === "techmap") {
    blocks.push({ t: "table", widths: [18, 10, 16, 32, 24], head: [t.stage, t.time, t.method, t.tAct, t.sAct],
      rows: x.stages.map((s) => [s.name, `${s.minutes} ${t.min}`, s.method, s.teacher, s.students]) });
  } else {
    blocks.push({ t: "table", widths: [22, 10, 40, 28], head: [t.stage, t.time, t.tAct, t.sAct],
      rows: x.stages.map((s) => [s.name, `${s.minutes} ${t.min}`, s.teacher, s.students]) });
  }
  blocks.push({ t: "h2", text: t.assess }, { t: "p", text: x.assessment });
  blocks.push({ t: "h2", text: t.hw }, { t: "p", text: x.homework });
  return { blocks, render: { size: 12, lineHeight: 1.25 }, name: fileSafe(`Dars ishlanma - ${d.subject} ${d.grade}-sinf - ${d.topic}`), ai: r };
}

/* =================== SAVOLLAR =================== */
const KIND_TEXT = { open: "open-ended question", yesno: "yes/no question", fill: "fill in the blank (use ____ for the blank)", match: "matching task (4–5 pairs)", think: "reflective / discussion question" };

async function generateQuestions(f) {
  const lang = langOf(f);
  const t = L[lang];
  const kinds = (Array.isArray(f.kinds) ? f.kinds : []).filter((k) => KIND_TEXT[k]);
  const d = {
    topic: clean(f.topic, 200), source: String(f.source || "").trim().slice(0, 3000),
    kinds: kinds.length ? kinds : ["open", "fill"], count: clamp(parseInt(f.count, 10), 5, 100, 15),
    grade: clean(f.grade, 60), style: AUTO_STYLES.questions.includes(f.template) ? f.template : "list", answers: f.withAnswers !== false,
  };
  const r = await askJson({
    model: MODEL, system: WRITER, effort: "medium", maxTokens: 32000,
    schema: obj({ title: STR, items: { type: "array", items: obj({ kind: { type: "string", enum: d.kinds }, question: STR, answer: STR, pairs: { type: "array", items: obj({ left: STR, right: STR }) } }) } }),
    prompt: `Create exactly ${d.count} questions on the topic "${d.topic}" for ${d.grade || "school pupils"}.
Question types to mix (roughly evenly): ${d.kinds.map((k) => KIND_TEXT[k]).join("; ")}.
${d.source ? `Base the questions strictly on this text:\n"""\n${d.source}\n"""\n` : ""}Language: ${LANG_NAMES[lang]}.
For each item give "kind", "question", a short correct "answer", and "pairs" (left/right items) only for matching tasks — empty array otherwise. Return also a short "title".`,
  });
  const items = r.data.items.slice(0, d.count).map((q) => ({ kind: q.kind, question: clean(q.question, 1200), answer: clean(q.answer, 600), pairs: (q.pairs || []).slice(0, 8) }));
  const LET = lang === "uz_cyr" || lang === "ru" ? "АБВГДЕЖЗ" : "ABCDEFGH";
  const qText = (q, i) => {
    if (q.kind !== "match" || !q.pairs.length) return `${i + 1}. ${q.question}`;
    const rights = q.pairs.map((p) => p.right).sort((a, b) => a.localeCompare(b));
    return `${i + 1}. ${q.question}\n${q.pairs.map((p, j) => `${j + 1}) ${p.left}`).join("\n")}\n${rights.map((x, j) => `${LET[j]}) ${x}`).join("\n")}`;
  };
  const ans = (q) => {
    if (q.kind !== "match" || !q.pairs.length) return q.answer;
    const rights = q.pairs.map((p) => p.right).sort((a, b) => a.localeCompare(b));
    return q.pairs.map((p, j) => `${j + 1}–${LET[rights.indexOf(p.right)]}`).join(", ");
  };
  const blocks = [{ t: "h1", text: clean(r.data.title, 200) || d.topic }];
  if (d.style === "cards") blocks.push({ t: "cards", items: items.map((q, i) => ({ text: qText(q, i) })) });
  else items.forEach((q, i) => blocks.push({ t: "p", indent: false, text: qText(q, i) }));
  if (d.answers) {
    blocks.push({ t: "pagebreak" }, { t: "h1", text: t.answers });
    items.forEach((q, i) => blocks.push({ t: "p", indent: false, text: `${i + 1}. ${ans(q)}` }));
  }
  return { blocks, render: { size: 13, lineHeight: 1.4 }, name: fileSafe(`Savollar - ${d.topic}`), ai: r };
}

/* =================== KROSSVORD =================== */
// So'zni katakchalarga bo'lish: o'zbek lotinida O' va G' — bitta katak
function units(word, lang) {
  let w = String(word).toUpperCase().replace(/[ʻʼ’‘`´]/g, "'").replace(/[^A-ZА-ЯЁЎҚҒҲ']/g, "");
  if (lang === "uz_lat") return (w.match(/[OG]'|[A-Z]/g) || []);
  if (lang === "en") return (w.match(/[A-Z]/g) || []);
  return (w.replace(/'/g, "").match(/[А-ЯЁЎҚҒҲ]/g) || []);
}

function rnd(seed) { let s = seed >>> 0 || 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Ochko'z joylashtirish: eng ko'p kesishuvli joy tanlanadi; bir necha urinishdan eng yaxshisi
function layoutCrossword(words, seed = 1) {
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rand = rnd(seed * 97 + attempt);
    const order = words.slice().sort((a, b) => b.u.length - a.u.length);
    if (attempt) for (let i = order.length - 1; i > 1; i--) { const j = 1 + Math.floor(rand() * i); [order[i], order[j]] = [order[j], order[i]]; }
    const grid = new Map();
    const key = (r, c) => r + "," + c;
    const placed = [];
    const fits = (w, r, c, dir) => {
      const dr = dir === "down" ? 1 : 0, dc = dir === "across" ? 1 : 0;
      if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * w.u.length, c + dc * w.u.length))) return -1;
      let cross = 0;
      for (let i = 0; i < w.u.length; i++) {
        const rr = r + dr * i, cc = c + dc * i;
        const cell = grid.get(key(rr, cc));
        if (cell) {
          if (cell.ch !== w.u[i] || cell[dir]) return -1;
          cross++;
        } else if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) return -1;
      }
      return cross;
    };
    const put = (w, r, c, dir) => {
      const dr = dir === "down" ? 1 : 0, dc = dir === "across" ? 1 : 0;
      for (let i = 0; i < w.u.length; i++) {
        const k = key(r + dr * i, c + dc * i);
        const cell = grid.get(k) || { ch: w.u[i] };
        cell[dir] = true;
        grid.set(k, cell);
      }
      placed.push({ ...w, r, c, dir });
    };
    put(order[0], 0, 0, "across");
    for (const w of order.slice(1)) {
      let pick = null;
      for (const [k, cell] of grid) {
        const [r0, c0] = k.split(",").map(Number);
        for (let i = 0; i < w.u.length; i++) {
          if (w.u[i] !== cell.ch) continue;
          for (const dir of ["across", "down"]) {
            if (cell[dir]) continue;
            const r = dir === "down" ? r0 - i : r0, c = dir === "across" ? c0 - i : c0;
            const cross = fits(w, r, c, dir);
            if (cross > 0 && (!pick || cross > pick.cross || (cross === pick.cross && rand() < 0.3))) pick = { r, c, dir, cross };
          }
        }
      }
      if (pick) put(w, pick.r, pick.c, pick.dir);
    }
    const rs = [...grid.keys()].map((k) => +k.split(",")[0]), cs = [...grid.keys()].map((k) => +k.split(",")[1]);
    const h = Math.max(...rs) - Math.min(...rs) + 1, wd = Math.max(...cs) - Math.min(...cs) + 1;
    const score = placed.length * 1000 - h * wd - Math.abs(h - wd) * 3;
    if (wd <= 22 && (!best || score > best.score)) best = { score, placed, grid, minR: Math.min(...rs), minC: Math.min(...cs), h, w: wd };
  }
  if (!best) return null;
  const cells = Array.from({ length: best.h }, () => Array(best.w).fill(null));
  for (const [k, cell] of best.grid) { const [r, c] = k.split(",").map(Number); cells[r - best.minR][c - best.minC] = { ch: cell.ch }; }
  // Raqamlash: o'qish tartibida
  const starts = best.placed.map((p) => ({ ...p, r: p.r - best.minR, c: p.c - best.minC })).sort((a, b) => a.r - b.r || a.c - b.c);
  let n = 0;
  const num = new Map();
  for (const p of starts) { const k = p.r + "," + p.c; if (!num.has(k)) num.set(k, ++n); p.n = num.get(k); cells[p.r][p.c].n = p.n; }
  return { cells, words: starts };
}

async function generateCrossword(f) {
  const lang = langOf(f);
  const t = L[lang];
  const custom = String(f.custom || "").split(/\n+/).map((x) => clean(x, 40)).filter(Boolean).slice(0, 40);
  const d = {
    topic: clean(f.topic, 200), count: clamp(parseInt(f.words, 10), 5, 40, 15), grade: clean(f.grade, 60),
    style: AUTO_STYLES.crossword.includes(f.template) ? f.template : "classic", key: f.key !== false,
  };
  const want = custom.length || d.count;
  const r = await askJson({
    model: MODEL, system: WRITER, effort: "medium", maxTokens: 8000,
    schema: obj({ title: STR, words: { type: "array", items: obj({ answer: STR, clue: STR }) } }),
    prompt: custom.length
      ? `Write crossword clues in ${LANG_NAMES[lang]} for exactly these answer words (keep the words as given, one clue each), topic "${d.topic}", for ${d.grade || "school pupils"}:\n${custom.join("\n")}\nReturn a short "title".`
      : `Make a crossword on the topic "${d.topic}" for ${d.grade || "school pupils"} in ${LANG_NAMES[lang]}.
Give ${want + 6} candidate answers (single words, 3–12 letters, no spaces, hyphens, digits${lang === "uz_lat" ? " or tutuq belgisi (')—o' and g' are fine" : ""}; common nouns related to the topic, many shared letters) with short clear clues (definitions, not the word itself). Return a short "title".`,
  });
  const seen = new Set();
  const words = r.data.words
    .map((w) => ({ answer: clean(w.answer, 40), clue: clean(w.clue, 300), u: units(w.answer, lang) }))
    // tutuq belgili so'zlar (ma'no, san'at) katakchaga to'g'ri sig'maydi
    .filter((w) => !(lang === "uz_lat" && /[^OGog][ʻʼ’‘'`]/.test(w.answer)))
    .filter((w) => w.u.length >= 2 && w.u.length <= 15 && !seen.has(w.u.join("")) && seen.add(w.u.join("")));
  // Kerakli sonda so'z joylashguncha nomzodlar sonini oshirib boramiz
  let lay = null;
  for (let extra = 0; extra <= words.length - Math.min(want, words.length); extra++) {
    const res = layoutCrossword(words.slice(0, Math.min(want, words.length) + extra), 1);
    if (res && (!lay || res.words.length > lay.words.length)) lay = res;
    if (lay && lay.words.length >= want) break;
  }
  if (!lay || lay.words.length < Math.max(4, Math.ceil(want * 0.6))) throw new Error(`Krossvordga so'zlarni joylab bo'lmadi (${lay ? lay.words.length : 0}/${want})`);
  const across = lay.words.filter((w) => w.dir === "across").sort((a, b) => a.n - b.n);
  const down = lay.words.filter((w) => w.dir === "down").sort((a, b) => a.n - b.n);
  const color = d.style === "color" ? "#FFF4C2" : null;
  const blocks = [
    { t: "h1", text: clean(r.data.title, 200) || `${t.crossword}: ${d.topic}` },
    { t: "p", indent: false, text: `${t.name}: ______________________________` },
    { t: "grid", cells: lay.cells, show: false, color },
    { t: "h2", text: t.across }, ...across.map((w) => ({ t: "p", indent: false, text: `${w.n}. ${w.clue}` })),
    { t: "h2", text: t.down }, ...down.map((w) => ({ t: "p", indent: false, text: `${w.n}. ${w.clue}` })),
  ];
  if (d.key) blocks.push({ t: "pagebreak" }, { t: "h1", text: t.key }, { t: "grid", cells: lay.cells, show: true, color });
  return {
    blocks,
    render: { font: "Noto Sans", size: 12, lineHeight: 1.35, css: color ? "h1{color:#B45309}" : "" },
    name: fileSafe(`Krossvord - ${d.topic}`),
    ai: r,
  };
}

const GENERATORS = {
  essay: (f) => generatePaper("essay", f),
  referat: (f) => generatePaper("referat", f),
  lesson: generateLesson,
  questions: generateQuestions,
  crossword: generateCrossword,
};

module.exports = { MODEL, AUTO_STYLES, MAX_PAGES, GENERATORS, canAutoDoc, layoutCrossword, units };
