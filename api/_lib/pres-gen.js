// api/_lib/pres-gen.js
// ---------------------------------------------------------------
// Taqdimot (PowerPoint) — asl Canva shabloni asosida:
//   1) shablon (.pptx) yopiq GitHub repozitoriyasidan olinadi
//      (TEMPLATES_REPO, GITHUB_TOKEN), tuzilmasi — api/_lib/pres/<id>.json
//      (tools/pptx-shablon/analyze.py yasaydi)
//   2) Claude Opus slaydlar matnini yozadi va har bir slayd uchun
//      shablonning mos ko'rinishini (layout) tanlaydi
//   3) slaydlar ko'paytiriladi, namuna matnlar almashtiriladi (shrift,
//      rang, bezaklar saqlanadi), rasm joylariga mijoz rasmlari yoki
//      Pexels'dan mavzuga mos rasmlar qo'yiladi
// Natija — tahrirlanadigan .pptx
// ---------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { askJson, hasKey } = require("./ai");

const MODEL = "claude-opus-5-5";
const MAX_SLIDES = 30; // 300 soniyalik chegara ichida
const LANG_NAMES = { uz_lat: "Uzbek (Latin script)", uz_cyr: "Uzbek (Cyrillic script)", ru: "Russian", en: "English" };
const LANG_TAG = { uz_lat: "uz-Latn-UZ", uz_cyr: "uz-Cyrl-UZ", ru: "ru-RU", en: "en-US" };
const SPEC_DIR = path.join(__dirname, "pres");
const NOFOLD = { createFolders: false }; // PowerPoint zip ichidagi papka yozuvlarini "buzuq" deb hisoblaydi

const clean = (v, max = 300) => String(v == null ? "" : v).replace(/[ \t]+/g, " ").trim().slice(0, max);
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------------- shablonlar ---------------- */
let specCache = null;
function specs() {
  if (specCache) return specCache;
  specCache = {};
  try {
    for (const f of fs.readdirSync(SPEC_DIR)) if (f.endsWith(".json")) specCache[f.slice(0, -5)] = require(path.join(SPEC_DIR, f));
  } catch (e) { /* papka yo'q */ }
  return specCache;
}
const hasTemplate = (id) => !!specs()[id];

function canAutoPres(f) {
  return !!(hasKey() && process.env.GITHUB_TOKEN && f && hasTemplate(f.template) && f.format !== "pdf" && clean(f.topic) && (parseInt(f.slides, 10) || 10) <= MAX_SLIDES);
}

// Shablon fayli: yopiq repozitoriyadan, issiq server paytida /tmp da saqlanadi
async function loadTemplate(id) {
  if (process.env.TEMPLATES_DIR) return fs.readFileSync(path.join(process.env.TEMPLATES_DIR, `${id}.pptx`)); // lokal sinov
  const tmp = path.join("/tmp", `shablon-${id}.pptx`);
  try { return fs.readFileSync(tmp); } catch (e) { /* yo'q */ }
  const repo = process.env.TEMPLATES_REPO || "olmazorprint54-bit/print54-shablonlar";
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(id)}.pptx`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.raw", "User-Agent": "print54" },
  });
  if (!res.ok) throw new Error(`Shablonni yuklab bo'lmadi (${id}): ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  try { fs.writeFileSync(tmp, buf); } catch (e) { /* /tmp yo'q (lokal) */ }
  return buf;
}

/* ---------------- AI ---------------- */
// Claude uchun shablon ko'rinishlari: faqat matn joyi bor slaydlar
function layoutsOf(spec) {
  return spec.slides
    .map((s) => ({ ...s, editable: s.slots.filter((t) => t.kind !== "fixed") }))
    .filter((s) => s.editable.length);
}

function describe(layouts) {
  const kindName = { title: "TITLE", text: "TEXT", label: "LABEL" };
  return layouts.map((s) => {
    const slots = s.editable.map((t, i) => `[${i + 1}] ${kindName[t.kind]} max ${t.max} chars${t.paras > 1 && t.kind === "text" ? `, ${t.paras} paragraphs/list items in sample` : ""}`).join("; ");
    return `Layout ${s.n}${s.role === "title" ? " (TITLE SLIDE)" : s.role === "end" ? " (CLOSING / THANK-YOU SLIDE)" : ""}: ${slots}${s.photos.length ? `; photo frames: ${s.photos.length}` : ""}`;
  }).join("\n");
}

const SYSTEM = `You create school and university presentations for students and teachers in Uzbekistan.
- Content is factually accurate, specific and educational (facts, dates, examples), suited to the level; no filler.
- Write in the requested language; for Uzbek use the current official Latin (or Cyrillic) spelling with o', g', sh, ch.
- Each text must fit its slot: never exceed the max characters; aim for 60–100% of the max for TEXT slots.
- TEXT slots: short complete sentences or list items separated by \\n. TITLE: short heading. LABEL: 1–4 words.
- No markdown, no emojis, no numbering prefixes unless the slot is a list.`;

async function writeSlides(d, spec) {
  const layouts = layoutsOf(spec);
  const titleL = layouts.find((s) => s.role === "title") || layouts[0];
  const endL = layouts.find((s) => s.role === "end");
  const content = layouts.filter((s) => s !== titleL && s !== endL);
  const schema = {
    type: "object",
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: { layout: { type: "integer" }, texts: { type: "array", items: { type: "string" } }, image_query: { type: "string" } },
          required: ["layout", "texts", "image_query"], additionalProperties: false,
        },
      },
    },
    required: ["slides"], additionalProperties: false,
  };
  const r = await askJson({
    model: MODEL, system: SYSTEM, effort: "medium", maxTokens: 32000, schema,
    prompt: `Create a presentation.
Topic: ${d.topic}
Subject: ${d.subject || "—"}
Language: ${LANG_NAMES[d.lang]}
Number of slides: exactly ${d.count}
Author (for the title slide): ${d.author || "— (leave the author/subtitle slot with the subject or a short subtitle)"}
${d.tables ? "Include one slide with a comparison or key facts presented as a compact list of \"name — value\" lines.\n" : ""}
The design template has these slide layouts (slots in reading order):
${describe(layouts)}

Rules:
- Slide 1 uses Layout ${titleL.n}: title = the topic (shortened if needed), other slots = subtitle / author.
${endL ? `- The last slide uses Layout ${endL.n}: a short thank-you and closing words.\n` : ""}- Other slides use content layouts (${content.map((s) => s.n).join(", ")}); vary them, repeating is allowed. Order: introduction / plan, main parts, conclusion.
- "texts" has exactly one string per slot of the chosen layout, in slot order.
- "image_query": for layouts with photo frames, 2–5 English words for a stock photo search matching the slide (else "").`,
  });
  const byN = Object.fromEntries(layouts.map((s) => [s.n, s]));
  const slides = (r.data.slides || []).slice(0, d.count).map((s, i) => {
    let L = byN[s.layout];
    if (!L) L = i === 0 ? titleL : content[i % content.length] || titleL;
    const texts = L.editable.map((_, k) => clean((s.texts || [])[k] || "", 2000));
    return { L, texts, query: clean(s.image_query, 80) };
  });
  if (slides.length < Math.min(3, d.count)) throw new Error("AI slaydlarni to'liq yozmadi");
  return { slides, ai: r };
}

/* ---------------- rasmlar ---------------- */
function jpegSize(buf) {
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return null;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("rasm: " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

// Pexels: so'rov bo'yicha bir nechta foto (ishlatilganlari takrorlanmaydi)
async function pexels(query, orientation, used) {
  if (!process.env.PEXELS_API_KEY || !query) return null;
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=${orientation}`, {
    headers: { Authorization: process.env.PEXELS_API_KEY },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const p = (data.photos || []).find((x) => !used.has(x.id));
  if (!p) return null;
  used.add(p.id);
  const buf = await download(p.src.large2x || p.src.large);
  return { buf, w: p.width, h: p.height };
}

// Pixabay (Pexels kalit bermay qo'ygani uchun asosiy manba): PIXABAY_API_KEY
async function pixabay(query, orientation, used) {
  if (!process.env.PIXABAY_API_KEY || !query) return null;
  const orient = orientation === "landscape" ? "horizontal" : orientation === "portrait" ? "vertical" : "all";
  const res = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(process.env.PIXABAY_API_KEY)}&q=${encodeURIComponent(query.slice(0, 100))}&image_type=photo&orientation=${orient}&safesearch=true&per_page=10`);
  if (!res.ok) return null;
  const data = await res.json();
  const p = (data.hits || []).find((x) => !used.has("pb" + x.id));
  if (!p) return null;
  used.add("pb" + p.id);
  const buf = await download(p.largeImageURL || p.webformatURL);
  return { buf, w: p.imageWidth, h: p.imageHeight };
}

// Foto qidirish: Pixabay, bo'lmasa Pexels
async function stockPhoto(query, orientation, used) {
  return (await pixabay(query, orientation, used).catch(() => null)) || (await pexels(query, orientation, used).catch(() => null));
}

/* ---------------- PPTX yig'ish ---------------- */
function shapeRange(xml, id) {
  const m = new RegExp(`<p:cNvPr\\b[^>]*\\bid="${id}"`).exec(xml);
  if (!m) return null;
  let start = -1;
  for (const tag of ["<p:sp>", "<p:sp ", "<p:pic>", "<p:pic "]) start = Math.max(start, xml.lastIndexOf(tag, m.index));
  const close = xml.startsWith("<p:pic", start) ? "</p:pic>" : "</p:sp>";
  const end = xml.indexOf(close, m.index);
  return start < 0 || end < 0 ? null : [start, end + close.length];
}

// XML element: o'zi yopiladigan (<a:x .../>) yoki juft (<a:x ...>...</a:x>)
function el(src, tag) {
  const m = new RegExp(`<a:${tag}\\b[^>]*\\/>|<a:${tag}\\b[^>]*>[\\s\\S]*?<\\/a:${tag}>`).exec(src);
  return m ? m[0] : null;
}

function fillText(sp, text, slot, lang) {
  const body = /<p:txBody>([\s\S]*?)<\/p:txBody>/.exec(sp);
  if (!body) return sp;
  const inner = body[1];
  const bodyPr = el(inner, "bodyPr") || "<a:bodyPr/>";
  const lst = el(inner, "lstStyle") || "<a:lstStyle/>";
  const firstP = (/<a:p>[\s\S]*?<\/a:p>/.exec(inner) || [""])[0];
  let pPr = el(firstP, "pPr") || "";
  let rPr = el(firstP, "rPr") || '<a:rPr lang="en-US"/>';
  // Sig'magan matn: shrift kichraytiriladi.
  //  matn — maydon ikki o'lchamli: sig'im shrift kvadratiga teskari;
  //  sarlavha/yorliq — namunadagidek qatorlar soni va eng uzun so'z qutiga sig'sin
  const caps = slot.text && slot.text === slot.text.toUpperCase();
  const perLine = Math.max(4, (slot.perLine || slot.max) * (caps ? 0.85 : 1));
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  let k = 1;
  if (slot.kind === "text") {
    if (text.length > Math.max(slot.max, 10) * 1.05) k = Math.sqrt(Math.max(slot.max, 10) / text.length);
    k = Math.min(k, perLine / longest);
  } else {
    const lines = Math.max(1, Math.ceil((slot.chars || 1) / perLine));
    k = Math.min(1, (perLine * lines) / Math.max(text.length, 1), perLine / longest);
  }
  if (k < 0.97) {
    k = Math.max(0.35, k);
    const scale = (s) => s.replace(/\bsz="(\d+)"/g, (_, v) => `sz="${Math.round(v * k)}"`).replace(/<a:spcPts val="(\d+)"\/>/g, (_, v) => `<a:spcPts val="${Math.round(v * k)}"/>`);
    rPr = scale(rPr);
    pPr = scale(pPr);
  }
  rPr = rPr.replace(/\blang="[^"]*"/, `lang="${lang}"`);
  if (slot.text && slot.text === slot.text.toUpperCase() && /[A-Z]/.test(slot.text) && !/\bcap="all"/.test(rPr)) text = text.toLocaleUpperCase(lang.slice(0, 2));
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const paras = (lines.length ? lines : [""]).map((l) => `<a:p>${pPr}<a:r>${rPr}<a:t>${xmlEsc(l)}</a:t></a:r></a:p>`).join("");
  return sp.replace(body[0], `<p:txBody>${bodyPr}${lst}${paras}</p:txBody>`);
}

// Rasmni ramkaga "cover" qilib joylash (ortiqcha qismi kesiladi)
function fillPhoto(sp, rid, img, frame) {
  const ia = img.w / img.h;
  const fa = frame.w / frame.h;
  let l = 0, t = 0;
  if (ia > fa) l = Math.round(((ia / fa - 1) / 2) * -100000);
  else t = Math.round(((fa / ia - 1) / 2) * -100000);
  return sp
    .replace(/r:embed="[^"]+"/, `r:embed="${rid}"`)
    .replace(/<a:srcRect[^>]*\/>/, "")
    .replace(/<a:stretch>[\s\S]*?<\/a:stretch>/, `<a:stretch><a:fillRect l="${l}" t="${t}" r="${l}" b="${t}"/></a:stretch>`)
    .replace(/<a:extLst>[\s\S]*?svgBlip[\s\S]*?<\/a:extLst>/, "");
}

async function buildPptx(tplBuf, spec, slides, photosFor, lang) {
  const zip = await JSZip.loadAsync(tplBuf);
  const presPath = "ppt/presentation.xml";
  const presRelsPath = "ppt/_rels/presentation.xml.rels";
  let pres = await zip.file(presPath).async("string");
  let presRels = await zip.file(presRelsPath).async("string");
  let types = await zip.file("[Content_Types].xml").async("string");

  // asl slaydlar (manba) xotirada
  const src = {};
  for (const s of spec.slides) {
    const rel = s.part.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
    src[s.n] = { xml: await zip.file(s.part).async("string"), rels: zip.file(rel) ? await zip.file(rel).async("string") : null };
  }
  // eski slaydlar va eslatmalar olib tashlanadi
  zip.forEach((p) => { if (/^ppt\/(slides|notesSlides)\//.test(p)) zip.remove(p); });
  presRels = presRels.replace(/<Relationship [^>]*Type="[^"]*\/slide"[^>]*\/>/g, "");
  types = types.replace(/<Override [^>]*PartName="\/ppt\/(slides|notesSlides)\/[^"]*"[^>]*\/>/g, "");
  if (!/Extension="jpeg"/i.test(types)) types = types.replace("<Types ", '<Types ').replace(/(<Types[^>]*>)/, '$1<Default Extension="jpeg" ContentType="image/jpeg"/>');

  const ids = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const n = i + 1;
    let xml = src[s.L.n].xml;
    let rels = (src[s.L.n].rels || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>')
      .replace(/<Relationship [^>]*notesSlide[^>]*\/>/g, "");
    s.L.editable.forEach((slot, k) => {
      const r = shapeRange(xml, slot.id);
      if (r) xml = xml.slice(0, r[0]) + fillText(xml.slice(r[0], r[1]), s.texts[k] || "", slot, lang) + xml.slice(r[1]);
    });
    const imgs = s.L.photos.length ? await photosFor(s, s.L.photos) : [];
    imgs.forEach((img, k) => {
      if (!img) return;
      const frame = s.L.photos[k];
      const r = shapeRange(xml, frame.id);
      if (!r) return;
      const rid = `rIdP${k + 1}`;
      const media = `gen${n}_${k + 1}.jpeg`;
      zip.file(`ppt/media/${media}`, img.buf, NOFOLD);
      rels = rels.replace("</Relationships>", `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media}"/></Relationships>`);
      xml = xml.slice(0, r[0]) + fillPhoto(xml.slice(r[0], r[1]), rid, img, frame) + xml.slice(r[1]);
    });
    zip.file(`ppt/slides/slide${n}.xml`, xml, NOFOLD);
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, rels, NOFOLD);
    types = types.replace("</Types>", `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
    presRels = presRels.replace("</Relationships>", `<Relationship Id="rIdS${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/></Relationships>`);
    ids.push(`<p:sldId id="${255 + n}" r:id="rIdS${n}"/>`);
  }
  pres = pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${ids.join("")}</p:sldIdLst>`);
  zip.file(presPath, pres, NOFOLD);
  zip.file(presRelsPath, presRels, NOFOLD);
  zip.file("[Content_Types].xml", types, NOFOLD);
  const app = zip.file("docProps/app.xml");
  if (app) zip.file("docProps/app.xml", (await app.async("string")).replace(/<Slides>\d+<\/Slides>/, `<Slides>${slides.length}</Slides>`).replace(/<Notes>\d+<\/Notes>/, "<Notes>0</Notes>"), NOFOLD);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/* ---------------- asosiy ---------------- */
// photoUrls — mijoz yuklagan rasmlar (imzolangan havolalar)
async function generatePresentation(f, photoUrls = []) {
  const lang = LANG_NAMES[f.lang] ? f.lang : "uz_lat";
  const d = {
    topic: clean(f.topic, 200), subject: clean(f.subject, 120), author: clean(f.author, 120), lang,
    count: Math.min(MAX_SLIDES, Math.max(3, parseInt(f.slides, 10) || 10)),
    images: f.images !== false, tables: !!f.tables,
  };
  const spec = specs()[f.template];
  const [tpl, written] = await Promise.all([loadTemplate(f.template), writeSlides(d, spec)]);

  // rasmlar: avval mijozniki, keyin Pexels (rasmlar o'chirilgan bo'lsa — shablonniki qoladi)
  const own = [];
  for (const u of photoUrls) {
    try { const buf = await download(u); const sz = jpegSize(buf); if (sz) own.push({ buf, ...sz }); } catch (e) { /* o'tkazamiz */ }
  }
  const used = new Set();
  const photosFor = async (s, frames) => Promise.all(frames.map(async (fr, k) => {
    if (own.length) return own.shift();
    if (!d.images) return null;
    const orient = fr.w / fr.h > 1.2 ? "landscape" : fr.w / fr.h < 0.83 ? "portrait" : "square";
    try { return await stockPhoto(k ? `${s.query} ${["detail", "closeup", "people"][k % 3]}` : s.query || d.topic, orient, used); } catch (e) { return null; }
  }));
  const buffer = await buildPptx(tpl, spec, written.slides, photosFor, LANG_TAG[lang]);
  const name = `Taqdimot - ${d.topic}`.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").slice(0, 90);
  return { buffer, name, ai: written.ai };
}

module.exports = { MODEL, MAX_SLIDES, canAutoPres, hasTemplate, generatePresentation, buildPptx, layoutsOf, describe, jpegSize, fillText, fillPhoto };
