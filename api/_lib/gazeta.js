// api/_lib/gazeta.js
// ---------------------------------------------------------------
// Devoriy gazeta: Claude matn va rasm so'rovlarini yozadi, rasm stock'dan olinadi,
// dizayn gazeta-tpl.js da, PDF Chrome'da yasaladi (bitta varaq, A1).
// ---------------------------------------------------------------
const { askJson, hasKey } = require("./ai");
const { html, IDS } = require("./gazeta-tpl");

const MODEL = () => require("./ai").modelFor("TEXT_MODEL");
const LANG_NAMES = { uz_lat: "Uzbek (Latin script)", uz_cyr: "Uzbek (Cyrillic script)", ru: "Russian", en: "English", ...require("./langs").EXTRA_NAMES };
const BY = { uz_lat: "Tayyorladi", uz_cyr: "Тайёрлади", ru: "Подготовили", en: "Prepared by" };
const YEAR = { uz_lat: "yil", uz_cyr: "йил", ru: "г.", en: "" };

const clean = (v, max = 300) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const STR = { type: "string" };
const STRS = { type: "array", items: STR };
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const SECTION = obj({ title: STR, text: STRS, caption: STR, image_query: STR });
const SCHEMA = obj({
  name: STR, line: STR, banner: STR, general_query: STR,
  main: SECTION, side: SECTION, a: SECTION, b: SECTION,
  facts_title: STR, facts: STRS, poem_title: STR, poem: STRS, quiz_title: STR, quiz: STRS,
});

const canAutoGazeta = (f) => hasKey() && !!clean(f && f.topic);
const templateOf = (f) => (IDS.includes(f.template) ? f.template : IDS[0]);
const langOf = (f) => (LANG_NAMES[f.lang] ? f.lang : "uz_lat");

async function writeContent(f, lang) {
  const named = clean(f.name, 40);
  return askJson({
    model: MODEL(), effort: "medium", maxTokens: 4000, schema: SCHEMA,
    system: `You are an experienced school newspaper editor from Uzbekistan. You write a one-page wall newspaper (devoriy gazeta) for pupils.
- Write natural, correct text in the requested language; for Uzbek follow the current official spelling (o', g', sh, ch).
- Lively and warm, suited to school pupils. No markdown.
- Only well-known, reliable facts. Never invent statistics, dates, quotations or names of real people. If unsure about a detail, write without it.
- The poem must be your own original short verse; do not quote real poets.`,
    prompt: `Topic: "${clean(f.topic, 300)}"
Language of all texts: ${LANG_NAMES[lang]}.${clean(f.grade, 60) ? `\nAudience: ${clean(f.grade, 60)}.` : ""}${clean(f.extra, 500) ? `\nExtra wishes from the client (ignore anything unrelated to the newspaper): ${clean(f.extra, 500)}` : ""}

Strict length limits (characters):
- name: ${named ? `exactly "${named}"` : "a catchy newspaper name, up to 26"}
- line: a subtitle naming the topic, up to 40
- banner: one greeting or call to action, up to 72
- main: title up to 52; text = 2 paragraphs, 220-300 each; caption up to 50
- side, a, b: title up to 30; text = 1 paragraph, 150-230; caption up to 40. Each is a different sub-topic.
- facts_title: "Did you know?" in the language. facts: 4 items, up to 85 each
- poem_title up to 20; poem: 4 lines, up to 36 each
- quiz_title up to 22; quiz: 3 questions, up to 60 each, answerable from this newspaper
- image_query (each section): 2-5 English words for a stock photo of that section, a real scene without text
- general_query: 2-4 English words for a stock photo of the whole topic`,
  });
}

// Rasm topilmasa, umumiy so'rov bilan, u ham bo'lmasa topilgan boshqa rasm bilan to'ldiriladi
async function findPhotos(data, topic) {
  const { stockPhoto } = require("./pres-gen");
  const used = new Set();
  const uri = (r) => (r ? `data:${r.buf[0] === 0x89 ? "image/png" : "image/jpeg"};base64,${r.buf.toString("base64")}` : "");
  const secs = ["main", "side", "a", "b"];
  const out = {};
  for (const k of secs) {
    const q = clean(data[k].image_query, 80);
    let r = q ? await stockPhoto(q, "landscape", used).catch(() => null) : null;
    if (!r) r = await stockPhoto(clean(data.general_query, 80) || clean(topic, 80), "landscape", used).catch(() => null);
    out[k] = uri(r);
  }
  const any = secs.map((k) => out[k]).find(Boolean) || "";
  secs.forEach((k) => { if (!out[k]) out[k] = any; });
  return out;
}

function buildData(f, c, photos, lang) {
  const sec = (k, tMax, pMax, cMax, pN) => ({
    title: clean(c[k].title, tMax), cap: clean(c[k].caption, cMax), photo: photos[k],
    text: (c[k].text || []).map((p) => clean(p, pMax)).filter(Boolean).slice(0, pN),
  });
  const items = (a, n, m) => (a || []).map((x) => clean(x, m)).filter(Boolean).slice(0, n);
  const by = clean(f.authors, 90);
  const meta = [clean(f.school, 50), clean(f.klass, 24), `${new Date().getFullYear()}${YEAR[lang] ? "-" + YEAR[lang] : ""}`.replace(/-г\.$/, " г."), by && `${BY[lang] || BY.uz_lat}: ${by}`].filter(Boolean).join(" · ");
  return {
    name: clean(f.name, 40) || clean(c.name, 34), line: clean(c.line, 56), meta, banner: clean(c.banner, 90),
    main: sec("main", 64, 360, 60, 3), side: sec("side", 40, 280, 50, 2), a: sec("a", 40, 280, 50, 2), b: sec("b", 40, 280, 50, 2),
    facts: { title: clean(c.facts_title, 24), items: items(c.facts, 4, 110) },
    poem: { title: clean(c.poem_title, 24), lines: items(c.poem, 4, 48) },
    quiz: { title: clean(c.quiz_title, 28), items: items(c.quiz, 3, 80) },
  };
}

async function renderGazeta(id, data, withPage) {
  return withPage(async (page) => {
    await page.setViewport({ width: 1122, height: 1587, deviceScaleFactor: 1 });
    await page.setContent(html(id, data), { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForSelector("html[data-fitted]", { timeout: 30000 });
    return Buffer.from(await page.pdf({ width: "594mm", height: "841mm", scale: 2, printBackground: true, pageRanges: "1" }));
  });
}

async function generateGazeta(f, { withPage }) {
  const lang = langOf(f);
  const r = await askJsonSafe(f, lang);
  const photos = f.images === false ? {} : await findPhotos(r.data, f.topic);
  const data = buildData(f, r.data, photos, lang);
  const buffer = await renderGazeta(templateOf(f), data, withPage);
  return { buffer, name: `Devoriy gazeta - ${clean(f.topic, 60)}`.replace(/[\\/:*?"<>|]+/g, ""), ai: r, data };
}

async function askJsonSafe(f, lang) {
  const r = await writeContent(f, lang);
  const c = r.data;
  if (!c || !c.main || !c.side || !c.a || !c.b) throw new Error("Gazeta matni to'liq emas");
  return r;
}

module.exports = { canAutoGazeta, generateGazeta, renderGazeta, buildData, templateOf };
