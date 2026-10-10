// api/_lib/doc-gen.js
// ---------------------------------------------------------------
// AI matnli xizmatlar: mustaqil ish, referat, dars ishlanma, savollar,
// krossvord. Matnni Claude (Sonnet 5.5) yozadi, hujjat shakli va titul
// varag'i — kodda (api/_lib/doc-render.js). Natija: { blocks, render, name, ai }
// ai — barcha so'rovlarning jami tokeni va narxi.
// Canva dizaynlari (dars ishlanma, krossvord) hozircha qo'lda.
// ---------------------------------------------------------------

const { askJson, askText, hasKey } = require("./ai");
const SRC = require("./sources");

const MODEL = () => require("./ai").modelFor("TEXT_MODEL"); // standart: Sonnet 5.5
const LANG_NAMES = { uz_lat: "Uzbek (Latin script)", uz_cyr: "Uzbek (Cyrillic script)", ru: "Russian", en: "English" };
const AUTO_STYLES = {
  essay: ["otm", "school", "modern"],
  referat: ["otm", "school", "modern"],
  kurs: ["otm", "modern"],
  article: ["oak", "conf", "modern"],
  lesson: ["table", "techmap", "notes"],
  questions: ["list", "cards"],
  crossword: ["classic", "color"],
};
const MAX_PAGES = { essay: 30, referat: 30, kurs: 40 }; // 300 soniyalik chegara ichida yozib bo'ladigani

const L = {
  uz_lat: {
    essay: "MUSTAQIL ISH", referat: "REFERAT", kurs: "KURS ISHI", toc: "MUNDARIJA", subject: "Fan", topic: "Mavzu", did: "Bajardi", group: "Guruh", got: "Qabul qildi",
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
    essay: "МУСТАҚИЛ ИШ", referat: "РЕФЕРАТ", kurs: "КУРС ИШИ", toc: "МУНДАРИЖА", subject: "Фан", topic: "Мавзу", did: "Бажарди", group: "Гуруҳ", got: "Қабул қилди",
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
    essay: "САМОСТОЯТЕЛЬНАЯ РАБОТА", referat: "РЕФЕРАТ", kurs: "КУРСОВАЯ РАБОТА", toc: "СОДЕРЖАНИЕ", subject: "Предмет", topic: "Тема", did: "Выполнил(а)", group: "Группа", got: "Проверил(а)",
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
    essay: "INDEPENDENT WORK", referat: "REPORT", kurs: "COURSE WORK", toc: "CONTENTS", subject: "Subject", topic: "Topic", did: "Done by", group: "Group", got: "Checked by",
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
    pages: clamp(parseInt(f.pages, 10), 3, MAX_PAGES[service], service === "essay" ? 12 : 10),
    style: AUTO_STYLES[service].includes(f.template) ? f.template : "otm",
    institution: clean(f.institution, 160), student: clean(f.student, 120), group: clean(f.group, 40),
    teacher: clean(f.teacher, 120), city: clean(f.city, 60) || (lang === "ru" ? "Ташкент" : lang === "uz_cyr" ? "Тошкент" : lang === "en" ? "Tashkent" : "Toshkent"),
    titul: clean(f.titul, 160), faculty: clean(f.faculty, 120),
    parts: new Set(parts),
  };
}

function titlePage(d) {
  const t = L[d.lang];
  const year = new Date().getFullYear();
  const lines = [];
  lines.push({ text: d.institution || " ", bold: true, size: 14 });
  lines.push({ text: d.service === "kurs" ? t.kurs : d.service === "essay" ? t.essay : t.referat, bold: true, size: d.style === "modern" ? 28 : 24, gap: 55 });
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
  // boblarsiz: reja 3–5 band (mustaqil ish odatda 12–14 bet); boblar — faqat kurs ishida
  const chap = false;
  const nCh = 1;
  const nSec = essay ? (d.pages <= 13 ? 3 : d.pages <= 18 ? 4 : 5) : clamp(Math.round(d.pages / 3), 2, 5, 3);
  const ctx = `Paper type: ${essay ? "mustaqil ish (independent study paper)" : "referat (short report)"}\nSubject: ${d.subject || "—"}\nTopic: ${d.topic}\nAudience: ${LEVELS[d.level]}\nLanguage: ${lang}` + SRC.sourcesBlock(f);
  let cost = null;

  // 1) Reja
  const outline = await askJson({
    model: MODEL(), system: WRITER, effort: "medium", maxTokens: 4000,
    schema: obj({ chapters: { type: "array", items: obj({ title: STR, sections: STRS }) } }),
    prompt: `${ctx}\n\nMake the plan: exactly ${nCh} chapter(s)${chap ? "" : " (one chapter that just groups the sections; its title can repeat the topic)"}, each with exactly ${nSec} section titles. Titles are short, specific and logically ordered. Do not include introduction or conclusion.`,
  });
  cost = addCost(cost, outline);
  const chapters = outline.data.chapters.slice(0, nCh).map((c) => ({ title: clean(c.title, 200), sections: c.sections.slice(0, nSec).map((s) => clean(s, 200)) }));
  const allSections = chapters.flatMap((c) => c.sections);
  const introW = d.parts.has("intro") ? Math.round(words * 0.1) : 0;
  const conclW = d.parts.has("conclusion") ? Math.round(words * 0.08) : 0;
  const secW = Math.max(150, Math.round((words - introW - conclW) / allSections.length));
  const planText = chapters.map((c, i) => `${chap ? `${i + 1}-${t.ch}. ${c.title}\n` : ""}${c.sections.map((s, j) => `  ${chap ? `${i + 1}.${j + 1}` : j + 1}. ${s}`).join("\n")}`).join("\n");

  // 2) Matn (bo'limlar parallel yoziladi)
  const PARAS = { type: "array", items: STR };
  const tasks = [];
  if (d.parts.has("intro")) tasks.push(() => askJson({
    model: MODEL(), system: WRITER, effort: "low", maxTokens: 6000, schema: obj({ paragraphs: PARAS }),
    prompt: `${ctx}\nPlan:\n${planText}\n\nWrite the INTRODUCTION (about ${introW} words): relevance of the topic, aim and tasks of the work, short overview of the structure.`,
  }));
  if (d.parts.has("main")) chapters.forEach((c) => c.sections.forEach((s) => tasks.push(() => askJson({
    model: MODEL(), system: WRITER, effort: "low", maxTokens: 8000, schema: obj({ paragraphs: PARAS }),
    prompt: `${ctx}\nFull plan:\n${planText}\n\nWrite the text of the section "${s}"${chap ? ` (chapter "${c.title}")` : ""}: about ${secW} words. Do not repeat what other sections cover; do not write the section title.`,
  }))));
  if (d.parts.has("conclusion")) tasks.push(() => askJson({
    model: MODEL(), system: WRITER, effort: "low", maxTokens: 5000, schema: obj({ paragraphs: PARAS }),
    prompt: `${ctx}\nPlan:\n${planText}\n\nWrite the CONCLUSION (about ${conclW} words): main findings of each part and a general conclusion.`,
  }));
  if (d.parts.has("refs")) tasks.push(() => askJson({
    model: MODEL(), system: WRITER, effort: "low", maxTokens: 3000, schema: obj({ references: STRS }),
    prompt: `${ctx}\n\nList 6–10 references for this paper in standard bibliographic format (author, title, city, publisher, year). Use real, well-known sources only: laws and decrees of the Republic of Uzbekistan, textbooks, monographs, official websites (e.g. lex.uz). Do not invent books.`,
  }));
  const results = await pool(tasks, 3);
  results.forEach((r) => { cost = addCost(cost, r); });

  // 3) Hujjat
  const paras = (r) => (r.data.paragraphs || []).map((p) => clean(p, 4000)).filter(Boolean).map((text) => ({ t: "p", text }));
  let k = 0;
  // Universitetning tayyor tituli (api/_lib/titul.js) — topilmasa umumiy titul
  let titul = null;
  if (d.titul) {
    try {
      const T = require("./titul");
      if (T.canTitul() && (await T.list()).some((x) => x.id === d.titul)) {
        titul = { id: d.titul, values: { workType: essay ? "MUSTAQIL ISH" : "REFERAT", subject: d.subject, topic: d.topic, group: d.group, student: d.student, teacher: d.teacher, faculty: d.faculty } };
      }
    } catch (e) { console.error("Titul:", e.message); }
  }
  const blocks = titul ? [] : [titlePage(d)];
  if (d.parts.has("plan")) {
    blocks.push({ t: "h1", text: t.plan });
    const items = [];
    if (d.parts.has("intro")) items.push(t.intro);
    chapters.forEach((c, i) => {
      if (chap) items.push(`${i + 1}-${t.ch}. ${c.title}`);
      c.sections.forEach((s, j) => items.push(`${chap ? `   ${i + 1}.${j + 1}. ` : `${j + 1}. `}${s}`));
    });
    if (d.parts.has("conclusion")) items.push(t.concl);
    if (d.parts.has("refs")) items.push(t.refs);
    items.forEach((text) => blocks.push({ t: "p", text, indent: false }));
    blocks.push({ t: "pagebreak" });
  }
  if (d.parts.has("intro")) { blocks.push({ t: "h1", text: t.intro }, ...paras(results[k++])); blocks.push({ t: "pagebreak" }); }
  if (d.parts.has("main")) chapters.forEach((c, i) => {
    if (chap) blocks.push({ t: "h1", text: `${i + 1}-${t.ch.toUpperCase()}. ${c.title}` });
    c.sections.forEach((s, j) => blocks.push({ t: "h2", text: `${chap ? `${i + 1}.${j + 1}.` : `${j + 1}.`} ${s}` }, ...paras(results[k++])));
    blocks.push({ t: "pagebreak" });
  });
  if (d.parts.has("conclusion")) { blocks.push({ t: "h1", text: t.concl }, ...paras(results[k++])); blocks.push({ t: "pagebreak" }); }
  if (d.parts.has("refs")) {
    blocks.push({ t: "h1", text: t.refs });
    blocks.push({ t: "list", ordered: true, items: SRC.mergeRefs(f, results[k++].data.references || []).map((x) => clean(x, 400)).filter(Boolean).slice(0, 12) });
  }
  while (blocks[blocks.length - 1].t === "pagebreak") blocks.pop();
  return {
    blocks,
    render: { font: d.style === "modern" ? "Noto Sans" : "Times New Roman", size: 14, capsH1: d.style !== "modern" },
    name: fileSafe(`${essay ? "Mustaqil ish" : "Referat"} - ${d.topic}`),
    ai: cost,
    ...(titul ? { titul } : {}),
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
    model: MODEL(), system: WRITER, effort: "medium", maxTokens: 12000,
    schema: obj({
      goals: obj({ educational: STR, developmental: STR, upbringing: STR }),
      outcomes: STRS, equipment: STRS,
      stages: { type: "array", items: obj({ name: STR, minutes: { type: "integer" }, method: STR, teacher: STR, students: STR }) },
      homework: STR, assessment: STR,
    }),
    prompt: SRC.sourcesBlock(f) + `Write a detailed lesson plan for a teacher in an Uzbekistan general school (State educational standard, competency-based approach).
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
    model: MODEL(), system: WRITER, effort: "medium", maxTokens: 32000,
    schema: obj({ title: STR, items: { type: "array", items: obj({ kind: { type: "string", enum: d.kinds }, question: STR, answer: STR, pairs: { type: "array", items: obj({ left: STR, right: STR }) } }) } }),
    prompt: SRC.sourcesBlock(f) + `Create exactly ${d.count} questions on the topic "${d.topic}" for ${d.grade || "school pupils"}.
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
    model: MODEL(), system: WRITER, effort: "medium", maxTokens: 8000,
    schema: obj({ title: STR, words: { type: "array", items: obj({ answer: STR, clue: STR }) } }),
    prompt: SRC.sourcesBlock(f) + (custom.length
      ? `Write crossword clues in ${LANG_NAMES[lang]} for exactly these answer words (keep the words as given, one clue each), topic "${d.topic}", for ${d.grade || "school pupils"}:\n${custom.join("\n")}\nReturn a short "title".`
      : `Make a crossword on the topic "${d.topic}" for ${d.grade || "school pupils"} in ${LANG_NAMES[lang]}.
Give ${want + 6} candidate answers (single words, 3–12 letters, no spaces, hyphens, digits${lang === "uz_lat" ? " or tutuq belgisi (')—o' and g' are fine" : ""}; common nouns related to the topic, many shared letters) with short clear clues (definitions, not the word itself). Return a short "title".`),
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

/* =================== MAQOLA =================== */
const ART = {
  uz_lat: { ann: "Annotatsiya.", kw: "Kalit so'zlar:", refs: "Foydalanilgan adabiyotlar", sci: ["Kirish", "Mavzuga oid adabiyotlar tahlili", "Tadqiqot metodologiyasi", "Tahlil va natijalar", "Xulosa va takliflar"] },
  uz_cyr: { ann: "Аннотация.", kw: "Калит сўзлар:", refs: "Фойдаланилган адабиётлар", sci: ["Кириш", "Мавзуга оид адабиётлар таҳлили", "Тадқиқот методологияси", "Таҳлил ва натижалар", "Хулоса ва таклифлар"] },
  ru: { ann: "Аннотация.", kw: "Ключевые слова:", refs: "Список литературы", sci: ["Введение", "Обзор литературы", "Методология исследования", "Анализ и результаты", "Выводы и предложения"] },
  en: { ann: "Abstract.", kw: "Keywords:", refs: "References", sci: ["Introduction", "Literature review", "Research methodology", "Analysis and results", "Conclusion and recommendations"] },
};
const ANN = { uz: ["Annotatsiya.", "Kalit so'zlar:", "Uzbek (Latin script)"], ru: ["Аннотация.", "Ключевые слова:", "Russian"], en: ["Abstract.", "Keywords:", "English"] };

async function generateArticle(f) {
  const lang = langOf(f);
  const A = ART[lang];
  const kind = ["scientific", "thesis", "popular"].includes(f.kind) ? f.kind : "scientific";
  const d = {
    topic: clean(f.topic, 220), subject: clean(f.subject, 120), lang, kind,
    pages: clamp(parseInt(f.pages, 10), 2, kind === "thesis" ? 4 : 15, kind === "thesis" ? 3 : 6),
    author: clean(f.author, 200), degree: clean(f.degree, 160), org: clean(f.org, 200), email: clean(f.email, 100),
    style: ["oak", "conf", "modern"].includes(f.template) ? f.template : "oak",
    annLangs: f.annotation === false || kind === "popular" ? [] : (Array.isArray(f.annLangs) && f.annLangs.length ? f.annLangs : ["uz", "ru", "en"]).filter((x) => ANN[x]),
  };
  const words = Math.max(500, d.pages * 280 - (d.annLangs.length ? 150 * d.annLangs.length : 0));
  const ctx = `Article type: ${{ scientific: "scientific journal article (Higher Attestation Commission of Uzbekistan / OAK requirements)", thesis: "conference abstract (thesis)", popular: "popular-science / journalistic article for a newspaper or magazine" }[kind]}
Field: ${d.subject}
Topic: ${d.topic}
Language of the article: ${LANG_NAMES[lang]}` + SRC.sourcesBlock(f);
  const ARTW = WRITER + `\n- Scientific style for articles: precise terms, logical argumentation, references to laws/decrees of the Republic of Uzbekistan and known research where relevant. Never invent statistics: give only well-known figures, otherwise describe qualitatively.`;
  let cost = null;

  // 1) sarlavha, annotatsiyalar, kalit so'zlar, bo'limlar
  const sections = kind === "scientific" ? A.sci : kind === "thesis" ? ["", "", ""] : null;
  const meta = await askJson({
    model: MODEL(), system: ARTW, effort: "medium", maxTokens: 6000,
    schema: obj({
      title: STR,
      annotations: { type: "array", items: obj({ lang: { type: "string", enum: ["uz", "ru", "en"] }, text: STR, keywords: STRS }) },
      sections: STRS,
    }),
    prompt: `${ctx}

Return:
- "title": the article title in ${LANG_NAMES[lang]} (precise, academic, ≤ 15 words).
- "annotations": ${d.annLangs.length ? `one item for each of these languages: ${d.annLangs.map((x) => ANN[x][2]).join(", ")} — "text" 60–110 words summarising aim, methods and results; "keywords" 5–7 keywords in the same language.` : "an empty array."}
- "sections": ${kind === "popular" ? "3–4 short, engaging subheadings for the body (in the article language)." : "an empty array."}`,
  });
  cost = addCost(cost, meta);
  const parts = kind === "popular" ? ["", ...meta.data.sections.slice(0, 4).map((x) => clean(x, 120))] : sections;
  const share = kind === "scientific" ? [0.12, 0.18, 0.12, 0.38, 0.2] : kind === "thesis" ? [0.25, 0.5, 0.25] : parts.map((_, i) => (i ? 0.85 / (parts.length - 1) : 0.15));
  const roles = kind === "scientific"
    ? ["introduction: relevance of the topic, aim and objectives of the research", "literature review: views of Uzbek and foreign scholars on the topic (name real, well-known researchers and works only)", "research methodology: methods used (analysis, synthesis, comparison, statistical analysis, survey etc.)", "analysis and results: the main findings with concrete arguments and examples", "conclusion and practical recommendations as a short numbered list inside the text"]
    : kind === "thesis"
      ? ["relevance of the problem and the aim", "main part: key ideas and arguments", "conclusion"]
      : parts.map((p, i) => (i ? `section "${p}"` : "lead paragraph that hooks the reader"));

  // 2) matn (bo'limlar parallel) + adabiyotlar
  const tasks = parts.map((p, i) => () => askJson({
    model: MODEL(), system: ARTW, effort: "low", maxTokens: 8000, schema: obj({ paragraphs: STRS }),
    prompt: `${ctx}\nTitle: ${meta.data.title}\n\nWrite the ${roles[i]} — about ${Math.round(words * share[i])} words. Do not write the section heading.`,
  }));
  if (kind !== "popular") tasks.push(() => askJson({
    model: MODEL(), system: ARTW, effort: "low", maxTokens: 3000, schema: obj({ references: STRS }),
    prompt: `${ctx}\n\nList ${kind === "thesis" ? "3–5" : "8–14"} references in standard bibliographic format (authors, title, journal/publisher, year, pages). Real, well-known sources only: laws and decrees of the Republic of Uzbekistan (lex.uz), textbooks, monographs, journal articles by known authors. Do not invent sources.`,
  }));
  const res = await pool(tasks, 3);
  res.forEach((r) => { cost = addCost(cost, r); });

  // 3) hujjat
  const blocks = [];
  blocks.push({ t: "h1", text: clean(meta.data.title, 300) || d.topic });
  const whoAlign = d.style === "modern" ? "left" : "right";
  if (d.author) blocks.push({ t: "p", text: d.author, align: whoAlign, bold: true });
  if (d.degree) blocks.push({ t: "p", text: d.degree, align: whoAlign, italic: true, small: true });
  if (d.org) blocks.push({ t: "p", text: d.org, align: whoAlign, italic: true, small: true });
  if (d.email) blocks.push({ t: "p", text: d.email, align: whoAlign, small: true });
  for (const a of (meta.data.annotations || []).filter((x) => d.annLangs.includes(x.lang))) {
    blocks.push({ t: "p", indent: false, small: true, label: ANN[a.lang][0], text: clean(a.text, 1500) });
    blocks.push({ t: "p", indent: false, small: true, label: ANN[a.lang][1], text: (a.keywords || []).map((k) => clean(k, 60)).filter(Boolean).join(", ") });
  }
  parts.forEach((p, i) => {
    if (p) blocks.push({ t: "h2", text: p });
    (res[i].data.paragraphs || []).map((x) => clean(x, 4000)).filter(Boolean).forEach((text) => blocks.push({ t: "p", text }));
  });
  if (kind !== "popular") {
    blocks.push({ t: "h2", text: A.refs });
    blocks.push({ t: "list", ordered: true, items: SRC.mergeRefs(f, res[parts.length].data.references || []).map((x) => clean(x, 400)).filter(Boolean).slice(0, 15) });
  }
  return {
    blocks,
    render: d.style === "modern" ? { font: "Noto Sans", size: 12, lineHeight: 1.4, css: "h1{text-align:left}" } : { size: 14, lineHeight: d.style === "conf" ? 1.15 : 1.5, capsH1: true },
    name: fileSafe(`Maqola - ${d.topic}`),
    ai: cost,
  };
}

/* =================== KURS ISHI =================== */
// 30–40 bet: 2–3 bob, MUNDARIJA (sahifa raqamlari bilan), adabiyotga havolalar sahifa
// ostida (snoska — bir bo'limda 3 tagacha), sahifa raqami pastda o'rtada — titulda yo'q,
// 2-sahifadan (doc-render.js). Internetdan so'nggi statistika (veb-qidiruv), amaliy bobda
// jadvallar va haqiqiy raqamli grafik (tools.png — Chrome orqali rasm).
const WORDS_PER_PAGE = 290; // Times New Roman 14, 1,5 interval, 3/1,5/2/2 sm
const UNDERSHOOT = 1.25;    // model odatda so'ralgandan ~20% kam yozadi
const CHART = obj({ title: STR, kind: { type: "string", enum: ["bar", "line"] }, unit: STR, labels: STRS, values: { type: "array", items: { type: "number" } }, source: STR });
const TABLE = obj({ title: STR, head: STRS, rows: { type: "array", items: STRS }, source: STR });

// Internetdan tadqiqot: rasmiy statistika va manbalar (veb-qidiruv). Ishlamasa — bo'sh.
async function research(ctx, lang, year) {
  try {
    const r = await askText({
      model: MODEL(), effort: "medium", maxTokens: 6000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      system: "You are a careful research assistant for a university course work in Uzbekistan. Use web search to find verifiable, up-to-date facts. Never invent numbers.",
      messages: [{ role: "user", content: `${ctx}

Search the web and collect material for this course work:
1. Official statistics on the topic for Uzbekistan for the last 4–6 years (stat.uz, cbu.uz, gov.uz, ministries, World Bank / IMF if needed): give exact figures with year and unit — at least one time series (4–6 years) that can be shown as a chart and data for 1–2 tables.
2. Relevant laws, decrees and state programmes (lex.uz) with number and date.
3. A few key facts or definitions from reliable sources.

Answer in ${lang}. Format exactly:
NOTES:
- <fact with figures> (Manba: <organisation>, <year>, <URL>)
...
REFERENCES:
<one reference per line in bibliographic format for each website or document you used, e.g. "O'zbekiston Respublikasi Prezidenti va Statistika agentligi. Rasmiy statistik ma'lumotlar. [Elektron resurs]. URL: https://stat.uz (murojaat sanasi: ${year})">` }],
    });
    const [notes, refs = ""] = r.text.split(/^\s*REFERENCES:\s*$/im);
    return {
      notes: notes.replace(/^\s*NOTES:\s*/i, "").trim().slice(0, 12000),
      refs: refs.split("\n").map((x) => clean(x.replace(/^\s*[-\d.)]+\s*/, ""), 400)).filter((x) => x.length > 15).slice(0, 6),
      ai: r,
    };
  } catch (e) {
    console.error("Tadqiqot (veb-qidiruv):", e.message);
    return { notes: "", refs: [], ai: null };
  }
}

// Grafik (SVG -> PNG): ustunli yoki chiziqli, 760×430
function chartHtml(c) {
  const W = 760, H = 430, L = 70, R = 20, T = 30, B = 70;
  const vals = c.values.map(Number);
  // o'q: yaxlit qadam (1, 2, 2.5, 5 × 10^n)
  const raw = (Math.max(...vals) * 1.1 || 1) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const stepV = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw);
  const ticks = Math.max(1, Math.ceil((Math.max(...vals) * 1.1 || 1) / stepV));
  const max = stepV * ticks;
  const step = (W - L - R) / vals.length;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("ru-RU") : String(Math.round(v * 10) / 10));
  const grid = Array.from({ length: ticks + 1 }, (_, i) => stepV * i).map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="13" fill="#555">${fmt(v)}</text>`).join("");
  const lab = c.labels.map((l, i) => `<text x="${L + step * (i + 0.5)}" y="${H - B + 22}" text-anchor="middle" font-size="14" fill="#222">${String(l).slice(0, 14).replace(/[<&]/g, "")}</text>`).join("");
  const marks = c.kind === "line"
    ? `<polyline fill="none" stroke="#1f4e9c" stroke-width="3" points="${vals.map((v, i) => `${L + step * (i + 0.5)},${y(v)}`).join(" ")}"/>` + vals.map((v, i) => `<circle cx="${L + step * (i + 0.5)}" cy="${y(v)}" r="5" fill="#1f4e9c"/><text x="${L + step * (i + 0.5)}" y="${y(v) - 12}" text-anchor="middle" font-size="13" font-weight="700">${fmt(v)}</text>`).join("")
    : vals.map((v, i) => `<rect x="${L + step * i + step * 0.18}" y="${y(v)}" width="${step * 0.64}" height="${H - B - y(v)}" fill="#2f5fb3"/><text x="${L + step * (i + 0.5)}" y="${y(v) - 8}" text-anchor="middle" font-size="13" font-weight="700">${fmt(v)}</text>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#fff;font-family:'Times New Roman',Tinos,serif"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#fff"/>${grid}<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#333"/>${marks}${lab}
    <text x="${L}" y="18" font-size="13" fill="#555">${String(c.unit || "").slice(0, 40).replace(/[<&]/g, "")}</text></svg></body></html>`;
}
const okChart = (c) => c && Array.isArray(c.labels) && Array.isArray(c.values) && c.labels.length >= 3 && c.labels.length <= 10 && c.labels.length === c.values.length && c.values.every((v) => Number.isFinite(Number(v)) && Number(v) >= 0) && c.values.some((v) => Number(v) > 0);
const okTable = (t) => t && Array.isArray(t.head) && t.head.length >= 2 && t.head.length <= 6 && Array.isArray(t.rows) && t.rows.length >= 2 && t.rows.every((r) => Array.isArray(r) && r.length === t.head.length);

// Snoskalar: bo'limda ko'pi bilan `max` ta, bir paragrafda bittadan; ortig'i olib tashlanadi
function limitCites(paragraphs, max) {
  let used = 0;
  return paragraphs.map((p) => {
    let inPara = 0;
    return p.replace(/\s?\[(\d{1,2})\]/g, (m) => (used < max && inPara < 1 ? ((used += 1), (inPara += 1), m) : ""));
  });
}

async function generateKurs(f, tools = {}) {
  const d = paperData("kurs", f);
  d.pages = clamp(parseInt(f.pages, 10), 30, MAX_PAGES.kurs, 30);
  if (!LEVELS[f.level]) d.level = "bachelor";
  const t = L[d.lang];
  const lang = LANG_NAMES[d.lang];
  const nCh = d.pages >= 36 ? 3 : 2;
  const nSec = 3;
  const year = new Date().getFullYear();
  // titul, mundarija, adabiyotlar (~1,5) va jadval/grafiklar (~1,5) sahifasidan tashqari matn
  const words = Math.round((d.pages - 5) * WORDS_PER_PAGE * UNDERSHOOT);
  const ctx0 = `Paper type: kurs ishi (university course work, academic style)\nSubject: ${d.subject || "—"}\nTopic: ${d.topic}\nAudience: ${LEVELS[d.level]}\nLanguage: ${lang}\nCurrent year: ${year}` + SRC.sourcesBlock(f);
  let cost = null;

  // 1) reja, adabiyotlar va internetdan tadqiqot — parallel
  const [outline, refsR, web] = await Promise.all([
    askJson({
      model: MODEL(), system: WRITER, effort: "medium", maxTokens: 4000,
      schema: obj({ chapters: { type: "array", items: obj({ title: STR, sections: STRS }) } }),
      prompt: `${ctx0}\n\nMake the plan of the course work: exactly ${nCh} chapters (the first — theoretical foundations, the last — practical analysis of the current state in Uzbekistan and proposals), each with exactly ${nSec} section titles. Titles are specific, academic and logically ordered. Do not include introduction or conclusion.`,
    }),
    askJson({
      model: MODEL(), system: WRITER, effort: "low", maxTokens: 4000, schema: obj({ references: STRS }),
      prompt: `${ctx0}\n\nList 12–15 references for this course work in standard bibliographic format (author, title, city, publisher, year, number of pages). Start with laws and decrees of the Republic of Uzbekistan if relevant, then textbooks, monographs, journal articles. Real, well-known sources only — do not invent.`,
    }),
    research(ctx0, lang, year),
  ]);
  cost = addCost(addCost(addCost(cost, outline), refsR), web.ai);
  const ctx = ctx0 + (web.notes ? `\n\nUp-to-date facts found on the internet (prefer them to memory; give figures with their year):\n<research>\n${web.notes}\n</research>` : "") +
    "\nIf the customer's sources or these facts are not enough, use your own reliable knowledge.";
  const chapters = outline.data.chapters.slice(0, nCh).map((c) => ({ title: clean(c.title, 200), sections: c.sections.slice(0, nSec).map((s) => clean(s, 200)) }));
  const refs = SRC.mergeRefs(f, [...(refsR.data.references || []), ...web.refs]).map((x) => clean(x, 400)).filter(Boolean).slice(0, 20);
  const planText = chapters.map((c, i) => `${i + 1}-${t.ch}. ${c.title}\n${c.sections.map((s, j) => `  ${i + 1}.${j + 1}. ${s}`).join("\n")}`).join("\n");
  const cite = (n) => `\n\nSources of the work (numbered):\n${refs.map((r, i) => `[${i + 1}] ${r}`).join("\n")}\n\nWhere a fact, figure, definition or quotation comes from one of these sources, put its number in square brackets after the sentence, e.g. "... samaradorlik oshadi [3]." Cite ${n} in this whole text — NOT in every paragraph, at most once per paragraph, only these numbers.`;
  const introW = Math.round(words * 0.07);
  const conclW = Math.round(words * 0.06);
  const secW = Math.round((words - introW - conclW) / (nCh * nSec));
  const paraN = (w) => Math.max(3, Math.round(w / 130));
  const body = (w) => `Write exactly ${paraN(w)} paragraphs, each 110–150 words (about ${w} words in total).`;

  // Jadval va grafiklar: amaliy (oxirgi) bobning 1- va 2-bo'limida; 3 bob bo'lsa — 2-bobda ham grafik
  const last = chapters.length - 1;
  const visuals = new Map([[`${last}.0`, { table: true, chart: true }], [`${last}.1`, { table: true }], ...(nCh === 3 ? [[`1.0`, { chart: true }]] : [])]);

  // 2) matn (parallel)
  const PARAS = { type: "array", items: STR };
  const tasks = [() => askJson({
    model: MODEL(), system: WRITER, effort: "low", maxTokens: 6000, schema: obj({ paragraphs: PARAS }),
    prompt: `${ctx}\nPlan:\n${planText}\n\nWrite the INTRODUCTION of the course work. ${body(introW)} Cover: relevance of the topic, degree of study, object and subject, aim and tasks, research methods, structure of the work.${cite("1–2 times")}`,
  })];
  chapters.forEach((c, i) => c.sections.forEach((s, j) => {
    const v = visuals.get(`${i}.${j}`) || {};
    const schema = obj({ paragraphs: PARAS, ...(v.table ? { table: TABLE } : {}), ...(v.chart ? { chart: CHART } : {}) });
    tasks.push(() => askJson({
      model: MODEL(), system: WRITER, effort: "low", maxTokens: 12000, schema,
      prompt: `${ctx}\nFull plan:\n${planText}\n\nWrite the text of the section "${s}" (chapter "${c.title}"). ${body(secW)} Academic style with definitions, analysis and examples${i === last ? ", concrete figures for Uzbekistan and practical proposals" : ""}. Do not repeat what other sections cover; do not write the section title.${
        v.table ? `\n\nAlso return "table": a compact table (2–6 columns, 3–8 rows) relevant to this section — use real figures with years from the research facts (or a clear qualitative comparison if exact figures are unknown); "source" — where the data comes from. In the text refer to it simply as "jadvalda" — its number and caption are added automatically.` : ""}${
        v.chart ? `\n\nAlso return "chart": data for one chart (bar or line) — ONLY real figures for 4–8 years or categories from the research facts, with "unit" (e.g. "mlrd so'm", "%") and "source". If there are no real figures, return empty labels and values.` : ""}${cite("1–3 times")}`,
    }));
  }));
  tasks.push(() => askJson({
    model: MODEL(), system: WRITER, effort: "low", maxTokens: 5000, schema: obj({ paragraphs: PARAS }),
    prompt: `${ctx}\nPlan:\n${planText}\n\nWrite the CONCLUSION of the course work. ${body(conclW)} Main findings of each chapter, conclusions and practical proposals. No citations.`,
  }));
  const results = await pool(tasks, 6);
  results.forEach((r) => { cost = addCost(cost, r); });

  // 3) hujjat
  const paras = (r, max) => limitCites((r.data.paragraphs || []).map((p) => clean(p, 5000)).filter(Boolean), max).map((text) => ({ t: "p", text }));
  let titul = null;
  if (d.titul) {
    try {
      const T = require("./titul");
      if (T.canTitul() && (await T.list()).some((x) => x.id === d.titul)) {
        titul = { id: d.titul, values: { workType: "KURS ISHI", subject: d.subject, topic: d.topic, group: d.group, student: d.student, teacher: d.teacher, faculty: d.faculty } };
      }
    } catch (e) { console.error("Titul:", e.message); }
  }
  let k = 0, nTable = 0, nFig = 0;
  const blocks = titul ? [] : [titlePage(d)];
  blocks.push({ t: "toc", title: t.toc }, { t: "pagebreak" });
  blocks.push({ t: "h1", text: t.intro.toUpperCase() }, ...paras(results[k++], 2), { t: "pagebreak" });
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    blocks.push({ t: "h1", text: `${i + 1}-${t.ch.toUpperCase()}. ${c.title}` });
    for (let j = 0; j < c.sections.length; j++) {
      const r = results[k++];
      const ps = paras(r, 3);
      const at = Math.min(2, ps.length);
      const extra = [];
      if (okTable(r.data.table)) {
        const tb = r.data.table;
        nTable += 1;
        extra.push({ t: "p", text: `${nTable}-jadval`, align: "right", italic: true },
          { t: "p", text: clean(tb.title, 200), align: "center", bold: true },
          { t: "table", head: tb.head.map((x) => clean(x, 80)), rows: tb.rows.slice(0, 10).map((row) => row.map((x) => clean(x, 120))) });
        if (clean(tb.source)) extra.push({ t: "p", text: `Manba: ${clean(tb.source, 300)}`, italic: true, small: true, indent: false });
      }
      if (okChart(r.data.chart) && tools.png) {
        try {
          const ch = r.data.chart;
          const png = await tools.png(chartHtml(ch));
          nFig += 1;
          extra.push({ t: "image", data: png, w: 600, h: 340 },
            { t: "p", text: `${nFig}-rasm. ${clean(ch.title, 200)}`, align: "center", bold: true });
          if (clean(ch.source)) extra.push({ t: "p", text: `Manba: ${clean(ch.source, 300)}`, align: "center", italic: true, small: true });
        } catch (e) { console.error("Grafik:", e.message); }
      }
      blocks.push({ t: "h2", text: `${i + 1}.${j + 1}. ${c.sections[j]}` }, ...ps.slice(0, at), ...extra, ...ps.slice(at));
    }
    blocks.push({ t: "pagebreak" });
  }
  blocks.push({ t: "h1", text: t.concl.toUpperCase() }, ...paras(results[k++], 0), { t: "pagebreak" });
  blocks.push({ t: "h1", text: t.refs.toUpperCase() }, { t: "list", ordered: true, items: refs });
  return {
    blocks,
    render: {
      font: d.style === "modern" ? "Noto Sans" : "Times New Roman", size: 14, capsH1: d.style !== "modern",
      toc: true, pageNumbers: true, footnotes: refs, titleFirst: !titul,
    },
    name: fileSafe(`Kurs ishi - ${d.topic}`),
    ai: cost,
    ...(titul ? { titul } : {}),
  };
}

const GENERATORS = {
  kurs: generateKurs,
  article: generateArticle,
  essay: (f) => generatePaper("essay", f),
  referat: (f) => generatePaper("referat", f),
  lesson: generateLesson,
  questions: generateQuestions,
  crossword: generateCrossword,
};

module.exports = { MODEL, AUTO_STYLES, MAX_PAGES, GENERATORS, canAutoDoc, layoutCrossword, units };
