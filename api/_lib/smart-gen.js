// api/_lib/smart-gen.js
// ---------------------------------------------------------------
// "Aqlli umumiy shablonlar" va "✨ AI dizayn":
//   Claude Opus har bir slayd uchun mazmunga mos TURNI tanlaydi (reja, vaqt
//   chizig'i, diagramma, jadval, taqqoslash, raqamlar...) va matn/raqamlarni
//   yozadi; kod esa tanlangan rang uslubida professional chizadi.
//   Diagramma va jadvallar — PowerPoint'ning haqiqiy (tahrirlanadigan) obyektlari.
// Shablon fayli kerak emas (GitHub'dan yuklanmaydi).
// ---------------------------------------------------------------

const PptxGenJS = require("pptxgenjs");
const { askJson } = require("./ai");

const MODEL = () => require("./ai").modelFor("PRES_MODEL"); // standart: Opus 5.5
const MAX_SLIDES = 30;
const LANG_NAMES = { uz_lat: "Uzbek (Latin script)", uz_cyr: "Uzbek (Cyrillic script)", ru: "Russian", en: "English" };

// Rang uslublari: fon, sarlavha, matn, urg'u, karta foni, to'q blok, shrift
const THEMES = {
  "s-minimal": { name: "Oq-ko'k minimal", bg: "FFFFFF", title: "0F2A5F", text: "334155", accent: "2563EB", card: "F1F5F9", dark: "0F2A5F", font: "Calibri", hint: "universal, business, science" },
  "s-tun": { name: "Tungi koinot", bg: "0B1020", title: "FFFFFF", text: "CBD5E1", accent: "38BDF8", card: "16213D", dark: "1E3A8A", font: "Calibri", hint: "space, astronomy, technology, night" },
  "s-yashil": { name: "Yashil tabiat", bg: "F4FAF4", title: "14532D", text: "1F2937", accent: "16A34A", card: "E3F4E6", dark: "14532D", font: "Calibri", hint: "nature, ecology, biology, agriculture" },
  "s-akademik": { name: "Akademik", bg: "FFFDF7", title: "7B1E1E", text: "333333", accent: "B8860B", card: "F5EEE1", dark: "7B1E1E", font: "Georgia", hint: "history, literature, law, philosophy" },
  "s-binafsha": { name: "Binafsha", bg: "2E1065", title: "FFFFFF", text: "E9D5FF", accent: "F472B6", card: "4C1D95", dark: "831843", font: "Calibri", hint: "art, creativity, marketing, modern" },
  "s-quyosh": { name: "Quyoshli", bg: "FFFBEB", title: "9A3412", text: "3F3F46", accent: "F59E0B", card: "FEF0C7", dark: "9A3412", font: "Calibri", hint: "geography, tourism, culture, holidays" },
  "s-dengiz": { name: "Dengiz", bg: "F0FDFA", title: "115E59", text: "334155", accent: "0D9488", card: "CCFBF1", dark: "134E4A", font: "Calibri", hint: "water, oceans, health, environment" },
  "s-qizil": { name: "Qizil korporativ", bg: "FFFFFF", title: "111827", text: "374151", accent: "DC2626", card: "FEE2E2", dark: "111827", font: "Calibri", hint: "economics, business, sport, energy" },
  "s-oltin": { name: "Qora-oltin", bg: "111111", title: "F5F5F5", text: "D4D4D4", accent: "D4AF37", card: "1F1F1F", dark: "3A2F0B", font: "Georgia", hint: "premium, finance, architecture, luxury" },
  "s-pastel": { name: "Pastel (bolalar)", bg: "FFF7ED", title: "BE185D", text: "4B5563", accent: "8B5CF6", card: "FCE7F3", dark: "6D28D9", font: "Segoe UI", hint: "kids, primary school, kindergarten" },
  "s-texno": { name: "Texno", bg: "F8FAFC", title: "1E1B4B", text: "334155", accent: "7C3AED", card: "EDE9FE", dark: "1E1B4B", font: "Segoe UI", hint: "IT, programming, AI, innovation" },
  "s-tibbiy": { name: "Tibbiyot", bg: "F0F9FF", title: "0C4A6E", text: "334155", accent: "0EA5E9", card: "E0F2FE", dark: "0C4A6E", font: "Calibri", hint: "medicine, anatomy, chemistry, health" },
};
const SMART_IDS = ["ai-dizayn", ...Object.keys(THEMES)];
const isSmart = (id) => SMART_IDS.includes(id);

const TYPES = {
  title: "title slide: title, subtitle",
  agenda: "plan/contents: items (3–6) each {title ≤40, text ≤90}",
  bullets: "key points: text (intro ≤200), items (3–5) each {title ≤40, text ≤140}",
  text_image: "explanation with a photo: text (≤550, 2–3 short paragraphs separated by \\n), image_query",
  comparison: "two-sided comparison: left {title, items 3–4 ≤110 each}, right {title, items 3–4 ≤110 each}, text (intro ≤160)",
  timeline: "chronology/stages: items (3–6) each {title = year or stage ≤16, text ≤110}, text (intro ≤160)",
  chart: "numbers over categories/years: chart {kind line|bar|pie, name, labels 3–8, values (numbers)}, text (explanation ≤300). Use only realistic, well-known figures; say 'taxminiy' if approximate",
  table: "structured facts: table {head 2–4 columns, rows 3–6}, text (intro ≤160). Cells ≤40 chars",
  stats: "key figures: items (3–4) each {title = the number like '8' or '4,6 mlrd' ≤12, text = what it means ≤60}, text (intro ≤160)",
  quote: "a famous quote related to the topic: text (the quote ≤220), subtitle (author)",
  conclusion: "conclusion: items (3–4) each {title ≤40, text ≤120}, highlight (final message ≤220)",
  thanks: "closing slide: title (thank-you words), subtitle",
};

/* ---------------- AI ---------------- */
async function writeSmart(d) {
  const STR = { type: "string" };
  const side = { type: "object", properties: { title: STR, items: { type: "array", items: STR } }, required: ["title", "items"], additionalProperties: false };
  const schema = {
    type: "object",
    properties: {
      theme: { type: "string", enum: Object.keys(THEMES) },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: Object.keys(TYPES) },
            title: STR, subtitle: STR, text: STR, highlight: STR, image_query: STR,
            items: { type: "array", items: { type: "object", properties: { title: STR, text: STR }, required: ["title", "text"], additionalProperties: false } },
            left: side, right: side,
            chart: { type: "object", properties: { kind: { type: "string", enum: ["line", "bar", "pie"] }, name: STR, labels: { type: "array", items: STR }, values: { type: "array", items: { type: "number" } } }, required: ["kind", "name", "labels", "values"], additionalProperties: false },
            table: { type: "object", properties: { head: { type: "array", items: STR }, rows: { type: "array", items: { type: "array", items: STR } } }, required: ["head", "rows"], additionalProperties: false },
          },
          required: ["type", "title", "subtitle", "text", "highlight", "image_query", "items", "left", "right", "chart", "table"],
          additionalProperties: false,
        },
      },
    },
    required: ["theme", "slides"],
    additionalProperties: false,
  };
  const themeList = Object.entries(THEMES).map(([id, t]) => `${id} — ${t.name} (${t.hint})`).join("\n");
  return askJson({
    model: MODEL(), effort: "medium", maxTokens: 32000, schema,
    system: `You create school and university presentations for students and teachers in Uzbekistan, like a professional presentation designer.
- Content is factually accurate, specific and educational; no filler. Respect every character limit.
- Write in the requested language; for Uzbek use the current official spelling (o', g', sh, ch).
- Choose the slide TYPE that best fits each part of the content: chronology → timeline, numbers → chart or stats, two sides → comparison, structured facts → table, explanations → text_image or bullets. Vary types; avoid more than two slides of the same type in a row.
- Fields not used by a type: empty string / empty array / chart {kind:"bar",name:"",labels:[],values:[]} / table {head:[],rows:[]} / left,right {title:"",items:[]}.
- No markdown, no emojis.`,
    prompt: `Topic: ${d.topic}
Subject: ${d.subject || "—"}
Language: ${LANG_NAMES[d.lang]}
Number of slides: exactly ${d.count} (first = title, last = thanks)
Author: ${d.author || "—"}
${d.theme ? `Theme: ${d.theme} (fixed)` : `Choose the most suitable theme:\n${themeList}`}
${d.charts ? "Include at least one chart slide with real data.\n" : ""}${d.tables ? "Include at least one table slide.\n" : ""}
Slide types (fields):
${Object.entries(TYPES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
For title and text_image slides give "image_query": 2–5 English words for a stock photo; otherwise "".`,
  });
}

/* ---------------- chizish ---------------- */
function jpegSize(buf) {
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return null;
}
// Rasmni ramkaga "cover" qilib joylash (cho'zilmaydi, ortiqcha qismi kesiladi)
function addCover(s, img, x, y, w, h) {
  const r = img.h / img.w;
  s.addImage({ data: img.data, x, y, w, h: w * r, sizing: { type: "cover", w, h } });
}
const SW = 13.333, SH = 7.5;
const clean = (v, n = 600) => String(v == null ? "" : v).replace(/[ \t]+/g, " ").trim().slice(0, n);

// Matn qutiga sig'adigan shrift o'lchami (taxminiy: harf eni ~0.5 em)
function fit(text, w, h, max, min = 10, bold = false) {
  const paras = String(text || "").split("\n");
  for (let pt = max; pt >= min; pt -= 1) {
    const cpl = Math.max(4, (w * 72) / (pt * (bold ? 0.56 : 0.5)));
    const lines = paras.reduce((n, p) => n + Math.max(1, Math.ceil(p.length / cpl)), 0);
    if (lines * pt * 1.22 <= h * 72) return pt;
  }
  return min;
}

function renderSmart(data, d, images) {
  const T = THEMES[data.theme] || THEMES["s-minimal"];
  const P = new (PptxGenJS.default || PptxGenJS)();
  P.layout = "LAYOUT_WIDE";
  P.title = d.topic;
  const F = T.font;
  const txt = (s, text, o) => {
    const size = fit(text, o.w, o.h, o.max || 18, o.min || 10, o.bold);
    s.addText(text, { x: o.x, y: o.y, w: o.w, h: o.h, fontFace: F, fontSize: size, color: o.color || T.text, bold: !!o.bold, italic: !!o.italic, align: o.align || "left", valign: o.valign || "top", margin: 0, paraSpaceAfter: o.gap || 0, lineSpacingMultiple: 1.05 });
  };
  const heading = (s, title) => {
    txt(s, clean(title, 90), { x: 0.6, y: 0.42, w: SW - 1.2, h: 0.85, max: 30, min: 18, bold: true, color: T.title, valign: "bottom" });
    s.addShape(P.ShapeType.rect, { x: 0.6, y: 1.36, w: 0.7, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
  };
  const card = (s, x, y, w, h, fill) => s.addShape(P.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: fill || T.card }, line: { color: fill || T.card } });
  const dark = (c) => parseInt(c.slice(0, 2), 16) * 0.3 + parseInt(c.slice(2, 4), 16) * 0.59 + parseInt(c.slice(4, 6), 16) * 0.11 < 128;
  const onDark = "FFFFFF";
  let imgIdx = 0;
  const nextImage = () => images[imgIdx++] || null;

  data.slides.forEach((sl, i) => {
    const s = P.addSlide();
    s.background = { color: T.bg };
    const items = (sl.items || []).filter((it) => clean(it.title) || clean(it.text));
    const type = sl.type;

    if (type === "title" || i === 0) {
      const img = nextImage();
      const tx = img ? 5.6 : 0.9;
      if (img) addCover(s, img, 0, 0, 5.1, SH);
      else s.addShape(P.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: SH, fill: { color: T.accent }, line: { color: T.accent } });
      txt(s, clean(sl.title || d.topic, 120), { x: tx, y: 2.2, w: SW - tx - 0.7, h: 2.0, max: 46, min: 26, bold: true, color: T.title, valign: "bottom" });
      s.addShape(P.ShapeType.rect, { x: tx, y: 4.38, w: 0.8, h: 0.07, fill: { color: T.accent }, line: { color: T.accent } });
      txt(s, clean(sl.subtitle || d.subject, 160), { x: tx, y: 4.6, w: SW - tx - 0.7, h: 0.9, max: 18, min: 12 });
      if (d.author) txt(s, d.author, { x: tx, y: 6.5, w: SW - tx - 0.7, h: 0.4, max: 13, min: 10, color: T.accent, bold: true });
      return;
    }
    if (type === "thanks") {
      txt(s, clean(sl.title, 80) || "E'tiboringiz uchun rahmat!", { x: 0.9, y: 2.5, w: SW - 1.8, h: 1.4, max: 48, min: 28, bold: true, color: T.title, align: "center", valign: "middle" });
      s.addShape(P.ShapeType.rect, { x: SW / 2 - 0.5, y: 4.05, w: 1.0, h: 0.07, fill: { color: T.accent }, line: { color: T.accent } });
      txt(s, clean(sl.subtitle, 160), { x: 1.5, y: 4.3, w: SW - 3, h: 0.8, max: 18, min: 12, align: "center" });
      return;
    }
    heading(s, sl.title);
    const intro = clean(sl.text, 600);
    const top = 1.65;

    if (type === "agenda") {
      const n = Math.min(6, items.length), cols = n > 3 ? 2 : 1, rows = Math.ceil(n / cols);
      const cw = (SW - 1.2 - (cols - 1) * 0.5) / cols, rh = Math.min(1.6, (SH - top - 0.5) / rows);
      items.slice(0, n).forEach((it, k) => {
        const x = 0.6 + (k % cols) * (cw + 0.5), y = top + 0.15 + Math.floor(k / cols) * rh;
        s.addShape(P.ShapeType.line, { x, y, w: cw, h: 0, line: { color: T.accent, width: 1.5 } });
        txt(s, String(k + 1).padStart(2, "0"), { x, y: y + 0.12, w: 0.8, h: 0.4, max: 18, bold: true, color: T.accent });
        txt(s, clean(it.title, 60), { x: x + 0.8, y: y + 0.12, w: cw - 0.8, h: 0.45, max: 20, min: 13, bold: true, color: T.title });
        txt(s, clean(it.text, 140), { x: x + 0.8, y: y + 0.6, w: cw - 0.8, h: rh - 0.75, max: 16, min: 11 });
      });
    } else if (type === "bullets" || type === "conclusion") {
      const hasBox = type === "conclusion" && clean(sl.highlight);
      const lw = hasBox ? 7.4 : SW - 1.2;
      let y = top;
      if (intro) { txt(s, intro, { x: 0.6, y, w: lw, h: 0.8, max: 19, min: 12 }); y += 0.95; }
      const n = Math.min(5, items.length), rh = (SH - y - 0.4) / Math.max(n, 1);
      items.slice(0, n).forEach((it, k) => {
        const yy = y + k * rh;
        s.addShape(P.ShapeType.ellipse, { x: 0.62, y: yy + 0.1, w: 0.16, h: 0.16, fill: { color: T.accent }, line: { color: T.accent } });
        txt(s, clean(it.title, 60), { x: 1.0, y: yy, w: lw - 0.4, h: 0.42, max: 20, min: 12, bold: true, color: T.title });
        txt(s, clean(it.text, 200), { x: 1.0, y: yy + 0.44, w: lw - 0.4, h: rh - 0.5, max: 16, min: 10 });
      });
      if (hasBox) {
        card(s, 8.4, top + 0.6, SW - 9.0, 3.6, T.dark);
        txt(s, d.lang === "ru" ? "Итог" : d.lang === "en" ? "Key takeaway" : d.lang === "uz_cyr" ? "Якуний хулоса" : "Yakuniy xulosa", { x: 8.75, y: top + 0.85, w: SW - 9.7, h: 0.45, max: 16, bold: true, color: onDark });
        txt(s, clean(sl.highlight, 300), { x: 8.75, y: top + 1.4, w: SW - 9.7, h: 2.6, max: 17, min: 11, color: onDark });
      }
    } else if (type === "text_image") {
      const img = nextImage();
      const tw = img ? 6.9 : SW - 1.2;
      txt(s, intro || items.map((it) => `${it.title}. ${it.text}`).join("\n"), { x: 0.6, y: top, w: tw, h: SH - top - 0.5, max: 18, min: 11, gap: 6 });
      if (img) addCover(s, img, 7.9, top, SW - 8.5, 4.9);
    } else if (type === "comparison") {
      let y = top;
      if (intro) { txt(s, intro, { x: 0.6, y, w: SW - 1.2, h: 0.6, max: 18, min: 12 }); y += 0.75; }
      const cw = (SW - 1.2 - 0.4) / 2, ch = SH - y - 0.45;
      [[sl.left, T.card, T.title, T.text], [sl.right, T.dark, onDark, onDark]].forEach(([side, fill, tc, xc], k) => {
        const x = 0.6 + k * (cw + 0.4);
        card(s, x, y, cw, ch, fill);
        txt(s, clean(side && side.title, 60), { x: x + 0.35, y: y + 0.25, w: cw - 0.7, h: 0.5, max: 18, min: 12, bold: true, color: k ? onDark : tc });
        const list = ((side && side.items) || []).slice(0, 4).map((t) => `• ${clean(t, 160)}`).join("\n");
        txt(s, list, { x: x + 0.35, y: y + 0.9, w: cw - 0.7, h: ch - 1.1, max: 19, min: 11, color: k ? onDark : xc, gap: 10 });
      });
    } else if (type === "timeline") {
      let y = top;
      if (intro) { txt(s, intro, { x: 0.6, y, w: SW - 1.2, h: 0.7, max: 18, min: 12 }); y += 0.85; }
      const n = Math.min(6, items.length), cw = (SW - 1.2) / Math.max(n, 1);
      s.addShape(P.ShapeType.line, { x: 0.6, y: y + 0.25, w: SW - 1.2, h: 0, line: { color: T.accent, width: 2 } });
      items.slice(0, n).forEach((it, k) => {
        const x = 0.6 + k * cw;
        s.addShape(P.ShapeType.ellipse, { x: x, y: y + 0.15, w: 0.2, h: 0.2, fill: { color: T.accent }, line: { color: T.bg, width: 2 } });
        txt(s, clean(it.title, 20), { x, y: y + 0.5, w: cw - 0.2, h: 0.5, max: 20, min: 12, bold: true, color: T.title });
        txt(s, clean(it.text, 160), { x, y: y + 1.05, w: cw - 0.25, h: SH - y - 1.5, max: 16, min: 10 });
      });
    } else if (type === "chart") {
      const c = sl.chart || {};
      const labels = (c.labels || []).map((l) => clean(l, 30)).slice(0, 8);
      const values = (c.values || []).map(Number).filter((v) => Number.isFinite(v)).slice(0, labels.length);
      if (labels.length >= 2 && values.length === labels.length) {
        const kind = { line: P.ChartType.line, bar: P.ChartType.bar, pie: P.ChartType.pie }[c.kind] || P.ChartType.bar;
        const pal = [T.accent, T.dark, T.title, "94A3B8", "F59E0B", "10B981", "EF4444", "8B5CF6"];
        s.addChart(kind, [{ name: clean(c.name, 60) || "", labels, values }], {
          x: 0.6, y: top + 0.1, w: 7.6, h: SH - top - 0.5,
          chartColors: c.kind === "pie" ? pal : [T.accent], showValue: true, dataLabelColor: dark(T.bg) ? "FFFFFF" : "333333", dataLabelFontSize: 11,
          catAxisLabelColor: T.text, valAxisLabelColor: T.text, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
          showLegend: c.kind === "pie", legendPos: "b", legendColor: T.text, lineDataSymbol: "circle", lineDataSymbolSize: 7, lineSize: 3,
          valGridLine: { color: dark(T.bg) ? "334155" : "E2E8F0", size: 0.5 }, catGridLine: { style: "none" },
          showTitle: !!clean(c.name), title: clean(c.name, 60), titleColor: T.text, titleFontSize: 12,
        });
        txt(s, intro, { x: 8.6, y: top + 0.2, w: SW - 9.2, h: SH - top - 0.6, max: 18, min: 11, gap: 6 });
      } else {
        txt(s, intro, { x: 0.6, y: top, w: SW - 1.2, h: SH - top - 0.5, max: 18, min: 11 });
      }
    } else if (type === "table") {
      let y = top;
      if (intro) { txt(s, intro, { x: 0.6, y, w: SW - 1.2, h: 0.6, max: 18, min: 12 }); y += 0.8; }
      const head = (sl.table && sl.table.head || []).map((h) => clean(h, 40)).slice(0, 4);
      const rows = (sl.table && sl.table.rows || []).slice(0, 7).map((r) => head.map((_, j) => clean(r[j], 60)));
      if (head.length) {
        const fs = rows.length > 5 || head.length > 3 ? 15 : 18;
        s.addTable([
          head.map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: T.accent } } })),
          ...rows.map((r, k) => r.map((cell) => ({ text: cell, options: { color: T.text, fill: { color: k % 2 ? T.bg : T.card } } }))),
        ], { x: 0.6, y, w: SW - 1.2, fontFace: F, fontSize: fs, border: { type: "solid", color: dark(T.bg) ? "334155" : "E2E8F0", pt: 0.75 }, margin: 0.08, autoPage: false });
      }
    } else if (type === "stats") {
      let y = top;
      if (intro) { txt(s, intro, { x: 0.6, y, w: SW - 1.2, h: 0.7, max: 18, min: 12 }); y += 0.95; }
      const n = Math.min(4, items.length), cw = (SW - 1.2 - (n - 1) * 0.35) / Math.max(n, 1);
      items.slice(0, n).forEach((it, k) => {
        const x = 0.6 + k * (cw + 0.35);
        card(s, x, y + 0.2, cw, 2.6);
        txt(s, clean(it.title, 14), { x: x + 0.25, y: y + 0.45, w: cw - 0.5, h: 1.0, max: 40, min: 20, bold: true, color: T.accent });
        txt(s, clean(it.text, 90), { x: x + 0.25, y: y + 1.5, w: cw - 0.5, h: 1.1, max: 17, min: 11, color: T.text });
      });
    } else if (type === "quote") {
      txt(s, "“", { x: 0.9, y: 1.6, w: 1.2, h: 1.2, max: 96, bold: true, color: T.accent });
      txt(s, clean(intro || sl.highlight, 300), { x: 1.6, y: 2.4, w: SW - 3.2, h: 2.6, max: 28, min: 16, italic: true, color: T.title, valign: "middle" });
      txt(s, clean(sl.subtitle, 80) ? `— ${clean(sl.subtitle, 80)}` : "", { x: 1.6, y: 5.2, w: SW - 3.2, h: 0.5, max: 16, color: T.accent, bold: true });
    } else {
      txt(s, intro || items.map((it) => `${it.title}. ${it.text}`).join("\n"), { x: 0.6, y: top, w: SW - 1.2, h: SH - top - 0.5, max: 18, min: 11, gap: 6 });
    }
  });
  return P.write({ outputType: "nodebuffer" });
}

/* ---------------- rasm ---------------- */
function toImage(buf) {
  const sz = jpegSize(Buffer.from(buf));
  return sz ? { data: "data:image/jpeg;base64," + Buffer.from(buf).toString("base64"), ...sz } : null;
}

// photoFinder(query) -> Buffer | null (pres-gen.js dagi Pixabay/Pexels)
async function generateSmart(f, photoBuffers, photoFinder) {
  const d = {
    topic: clean(f.topic, 200), subject: clean(f.subject, 120), author: clean(f.author, 120),
    lang: LANG_NAMES[f.lang] ? f.lang : "uz_lat",
    count: Math.min(MAX_SLIDES, Math.max(3, parseInt(f.slides, 10) || 10)),
    theme: THEMES[f.template] ? f.template : null,
    charts: !!f.charts, tables: !!f.tables, images: f.images !== false,
  };
  const r = await writeSmart(d);
  const data = r.data;
  if (d.theme) data.theme = d.theme;
  data.slides = (data.slides || []).slice(0, d.count);
  if (!data.slides.length) throw new Error("AI slaydlarni yozmadi");
  // rasmlar: titul va "matn + rasm" slaydlari uchun (avval mijoz rasmlari)
  const need = data.slides.filter((s, i) => i === 0 || s.type === "title" || s.type === "text_image");
  const images = [];
  const own = photoBuffers.slice();
  for (const s of need) {
    let buf = own.shift() || null;
    if (!buf && d.images) buf = await photoFinder(clean(s.image_query, 80) || d.topic).catch(() => null);
    images.push(buf ? toImage(buf) : null);
  }
  const buffer = await renderSmart(data, d, images);
  return { buffer, name: `Taqdimot - ${d.topic}`.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").slice(0, 90), ai: r, theme: data.theme };
}

module.exports = { THEMES, SMART_IDS, isSmart, generateSmart, renderSmart, fit };
