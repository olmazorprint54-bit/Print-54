// api/_lib/doc-tools.js
// ---------------------------------------------------------------
// «PDF vositalari» — AI'siz, to'liq kodda, tekin:
//   word2pdf   Word (.docx)          -> PDF   (mammoth -> HTML -> Chrome)
//   excel2pdf  Excel (.xlsx/.xls/.csv) -> PDF (SheetJS -> HTML -> Chrome)
//   pptx2pdf   PowerPoint (.pptx)    -> PDF   (pptx-render.js -> HTML -> Chrome)
//   pdfmerge   bir nechta PDF        -> bitta PDF        (pdf-lib)
//   pdfsplit   PDF'dan sahifalar     -> PDF yoki ZIP      (pdf-lib)
//   pdf2word   PDF                   -> Word (.docx)      (pdfjs: matn)
//   pdf2pptx   PDF                   -> PowerPoint (.pptx) (har sahifa — rasm)
// Fayllar Storage'dan (<mijoz>/docs/...) olinadi, natija {buffer, name, mime}.
// Chrome kerak bo'lgan ishlar uchun renderPdf / withPage api/resume-pdf.js dan beriladi.
// Mijozga ko'rsatiladigan xato — UserError (user: true).
// ---------------------------------------------------------------
const fs = require("fs");
const JSZip = require("jszip");

class UserError extends Error {
  constructor(m) { super(m); this.user = true; }
}
const E = (m) => new UserError(m);

const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isZip = (b) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;
const isOle = (b) => b.length > 3 && b[0] === 0xd0 && b[1] === 0xcf;
const isPdf = (b) => b.length > 8 && b.slice(0, 1024).toString("latin1").includes("%PDF-");
const baseOf = (name, fallback) => String(name || fallback).replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || fallback;
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Sans:wght@400;600;700&display=swap&subset=latin-ext,cyrillic" rel="stylesheet">`;
const MAX_PDF_PAGES = 400;

/* ---------------------------------------------------------------
   Word -> PDF
   --------------------------------------------------------------- */
async function wordToPdf(file, o, { renderPdf }) {
  const buf = file.buffer;
  if (isOle(buf)) throw E("Bu eski Word formati (.doc). Faylni Word'da «Saqlash → .docx» qilib qayta yuklang.");
  if (!isZip(buf)) throw E("Bu Word (.docx) fayl emas yoki buzilgan.");
  const mammoth = require("mammoth");
  let res;
  try {
    res = await mammoth.convertToHtml({ buffer: buf }, {
      convertImage: mammoth.images.imgElement((img) => img.read("base64").then((d) => ({ src: `data:${img.contentType};base64,${d}` }))),
    });
  } catch (e) {
    throw E("Word faylni o'qib bo'lmadi: u buzilgan yoki parol bilan himoyalangan bo'lishi mumkin.");
  }
  if (!res.value || !res.value.replace(/<[^>]+>/g, "").trim() && !/<img/.test(res.value)) throw E("Hujjatda matn yoki rasm topilmadi.");
  const margin = { small: 12, normal: 20, wide: 25 }[o.margin] || 20;
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
@page{size:A4 ${o.orient === "landscape" ? "landscape" : "portrait"};margin:${margin}mm}
*{box-sizing:border-box}
body{margin:0;font-family:"Tinos","Times New Roman",serif;font-size:12pt;line-height:1.35;color:#000;word-wrap:break-word}
h1,h2,h3,h4,h5,h6{font-family:"Noto Sans",Arial,sans-serif;line-height:1.25;margin:14pt 0 6pt;page-break-after:avoid}
h1{font-size:20pt}h2{font-size:16pt}h3{font-size:14pt}h4,h5,h6{font-size:12pt}
p{margin:0 0 7pt}
ul,ol{margin:0 0 7pt;padding-left:22pt}
table{border-collapse:collapse;width:100%;margin:6pt 0 10pt}
td,th{border:.75pt solid #555;padding:3pt 5pt;vertical-align:top;font-size:11pt}
tr{page-break-inside:avoid}
img{max-width:100%;height:auto}
a{color:#1a56c4}
</style></head><body>${res.value}</body></html>`;
  return { buffer: await renderPdf(html), name: baseOf(file.name, "hujjat") + ".pdf", mime: MIME.pdf };
}

/* ---------------------------------------------------------------
   Excel -> PDF
   --------------------------------------------------------------- */
async function excelToPdf(file, o, { renderPdf }) {
  const buf = file.buffer;
  const XLSX = require("xlsx");
  let wb;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: true, dense: false });
  } catch (e) {
    throw E("Excel faylni o'qib bo'lmadi: u buzilgan yoki parol bilan himoyalangan bo'lishi mumkin.");
  }
  const sheets = [];
  let cells = 0;
  for (const name of wb.SheetNames.slice(0, 12)) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) continue;
    const r = XLSX.utils.decode_range(ws["!ref"]);
    const cols = r.e.c - r.s.c + 1, rows = r.e.r - r.s.r + 1;
    cells += cols * rows;
    if (cells > 250000) throw E("Jadval juda katta (250 000 katakdan oshdi). Kerakli qismini alohida faylga ajratib yuklang.");
    const table = (XLSX.utils.sheet_to_html(ws, { editable: false }).match(/<table[\s\S]*<\/table>/) || [""])[0];
    if (!table) continue;
    sheets.push({ name, cols, table });
  }
  if (!sheets.length) throw E("Faylda ma'lumot topilmadi (varaqlar bo'sh).");
  const pageFor = (c) => (o.orient === "portrait" ? "p" : o.orient === "landscape" ? "l" : c > 7 ? "l" : "p");
  const fontFor = (c) => (c <= 6 ? 10.5 : c <= 10 ? 9 : c <= 15 ? 7.5 : c <= 22 ? 6.2 : c <= 32 ? 5.2 : 4.4);
  const grid = o.grid === "none" ? "none" : ".5pt solid #9ca3af";
  const body = sheets.map((s, i) => `<section class="sh ${pageFor(s.cols)}" style="font-size:${fontFor(s.cols)}pt;${i ? "break-before:page;" : ""}">${sheets.length > 1 ? `<h2>${esc(s.name)}</h2>` : ""}${s.table}</section>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
@page p{size:A4 portrait;margin:12mm}
@page l{size:A4 landscape;margin:10mm}
.sh.p{page:p}.sh.l{page:l}
*{box-sizing:border-box}
body{margin:0;font-family:"Noto Sans",Arial,sans-serif;color:#111}
h2{font-size:12pt;margin:0 0 6pt}
table{border-collapse:collapse;max-width:100%}
td,th{border:${grid};padding:2pt 4pt;vertical-align:top;white-space:pre-wrap;word-break:break-word}
td[data-t="n"]{text-align:right}
tr{page-break-inside:avoid}
</style></head><body>${body}</body></html>`;
  return { buffer: await renderPdf(html), name: baseOf(file.name, "jadval") + ".pdf", mime: MIME.pdf };
}

/* ---------------------------------------------------------------
   Jonli personaj: tayyor PPTX ga harakatlanuvchi, ovozli personaj (api/_lib/characters.js)
   --------------------------------------------------------------- */
async function charAdd(files, o) {
  const pp = files.find((f) => f.role !== "music");
  const music = files.find((f) => f.role === "music");
  if (!pp) throw E("Taqdimot faylini yuklang.");
  if (isOle(pp.buffer)) throw E("Bu eski PowerPoint formati (.ppt) yoki parol bilan himoyalangan fayl. PowerPoint'da «Saqlash → .pptx» qilib qayta yuklang.");
  if (!isZip(pp.buffer)) throw E("Bu PowerPoint (.pptx) fayl emas yoki buzilgan.");
  const C = require("./characters");
  if (!C.get(o.character)) throw E("Personajni tanlang.");
  if (o.sound === "custom" && !music) throw E("Musiqa faylini yuklang yoki «Personaj ovozi» / «Ovozsiz» ni tanlang.");
  let r;
  try {
    r = await C.addCharacter(pp.buffer, o.character, {
      sound: ["char", "none", "custom"].includes(o.sound) ? o.sound : "char",
      music: music && music.buffer, musicExt: music ? String(music.name).toLowerCase().split(".").pop() : "mp3",
      where: ["last", "first", "both", "custom"].includes(o.where) ? o.where : "last",
      slideText: o.slideNums, side: o.charSide === "left" ? "left" : "right", size: ["m", "l", "xl"].includes(o.charSize) ? o.charSize : "l",
    });
  } catch (e) {
    if (e && e.user) throw E(e.message);
    console.error("Personaj qo'shish:", e);
    throw E("Personajni qo'shib bo'lmadi: taqdimot fayli buzilgan bo'lishi mumkin.");
  }
  return { buffer: r.buffer, name: baseOf(pp.name, "taqdimot") + "-personajli.pptx", mime: MIME.pptx };
}

/* ---------------------------------------------------------------
   PowerPoint -> PDF (api/_lib/pptx-render.js: slaydlar HTML ga, Chrome PDF qiladi)
   --------------------------------------------------------------- */
async function pptxToPdf(file, o, { renderHtmlFile }) {
  const buf = file.buffer;
  if (isOle(buf)) throw E("Bu eski PowerPoint formati (.ppt) yoki parol bilan himoyalangan fayl. PowerPoint'da «Saqlash → .pptx» qilib qayta yuklang.");
  if (!isZip(buf)) throw E("Bu PowerPoint (.pptx) fayl emas yoki buzilgan.");
  let r;
  try {
    r = await require("./pptx-render").pptxToHtml(buf);
  } catch (e) {
    console.error("PPTX o'qish:", e);
    throw E(e && e.message === "slides" ? "Taqdimotda ko'rsatiladigan slayd topilmadi." : "PowerPoint faylni o'qib bo'lmadi: fayl buzilgan bo'lishi mumkin.");
  }
  if (r.slides > 200) throw E("Taqdimotda 200 tadan ortiq slayd bor — qismlarga bo'lib yuklang.");
  return { buffer: await renderHtmlFile(r.html), name: baseOf(file.name, "taqdimot") + ".pdf", mime: MIME.pdf };
}

/* ---------------------------------------------------------------
   PDF birlashtirish / bo'lish (pdf-lib)
   --------------------------------------------------------------- */
async function loadPdf(file) {
  const { PDFDocument } = require("pdf-lib");
  if (!isPdf(file.buffer)) throw E(`«${file.name}» PDF fayl emas.`);
  try {
    return await PDFDocument.load(file.buffer, { ignoreEncryption: false, updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(e.message || "")) throw E(`«${file.name}» parol bilan himoyalangan — avval parolni olib tashlang.`);
    throw E(`«${file.name}» ni ochib bo'lmadi: fayl buzilgan bo'lishi mumkin.`);
  }
}
async function mergePdfs(files) {
  const { PDFDocument } = require("pdf-lib");
  if (files.length < 2) throw E("Birlashtirish uchun kamida 2 ta PDF yuklang.");
  const out = await PDFDocument.create();
  let total = 0;
  for (const f of files) {
    const src = await loadPdf(f);
    total += src.getPageCount();
    if (total > MAX_PDF_PAGES) throw E(`Jami sahifalar ${MAX_PDF_PAGES} tadan oshmasin.`);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return { buffer: Buffer.from(await out.save()), name: "birlashtirilgan.pdf", mime: MIME.pdf };
}

// "1-3, 5, 8-" -> [0,1,2,4,7,...] (tartibi yozilganicha)
function parsePages(text, n) {
  const out = [];
  for (const part of String(text || "").split(/[\s,;]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)?(?:[-–](\d+)?)?$/);
    if (!m || (m[1] === undefined && m[2] === undefined)) throw E(`Sahifa raqamlarini shunday yozing: 1-3, 5, 8-10 (xato: «${part.slice(0, 20)}»)`);
    const a = m[1] === undefined ? 1 : parseInt(m[1], 10);
    const dash = part.includes("-") || part.includes("–");
    const b = !dash ? a : m[2] === undefined ? n : parseInt(m[2], 10);
    if (a < 1 || b < 1 || a > n || b > n) throw E(`PDF da ${n} ta sahifa bor — «${part}» shu oraliqdan tashqarida.`);
    if (a <= b) for (let i = a; i <= b; i++) out.push(i - 1);
    else for (let i = a; i >= b; i--) out.push(i - 1);
  }
  return out;
}
async function splitPdf(file, o) {
  const { PDFDocument } = require("pdf-lib");
  const src = await loadPdf(file);
  const n = src.getPageCount();
  const base = baseOf(file.name, "hujjat");
  const mode = o.mode || "pick";
  if (mode === "each") {
    if (n > 100) throw E("«Har bir sahifa alohida» uchun PDF 100 sahifadan oshmasin.");
    const zip = new JSZip();
    const w = String(n).length;
    for (let i = 0; i < n; i++) {
      const d = await PDFDocument.create();
      const [p] = await d.copyPages(src, [i]);
      d.addPage(p);
      zip.file(`${base}-${String(i + 1).padStart(w, "0")}.pdf`, await d.save());
    }
    return { buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), name: `${base}-sahifalar.zip`, mime: MIME.zip };
  }
  if (!String(o.pages || "").trim()) throw E("Sahifa raqamlarini yozing. Masalan: 1-3, 5");
  let idx = parsePages(o.pages, n);
  if (mode === "remove") {
    const del = new Set(idx);
    idx = src.getPageIndices().filter((i) => !del.has(i));
    if (!idx.length) throw E("Barcha sahifalarni olib tashlab bo'lmaydi.");
  }
  if (!idx.length) throw E("Sahifalar tanlanmadi.");
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, idx);
  pages.forEach((p) => out.addPage(p));
  return { buffer: Buffer.from(await out.save()), name: `${base}-${mode === "remove" ? "qolgan" : "ajratilgan"}.pdf`, mime: MIME.pdf };
}

/* ---------------------------------------------------------------
   PDF -> Word: matn, sarlavhalar, abzatslar (rasm va murakkab jadval saqlanmaydi)
   --------------------------------------------------------------- */
let pdfjsLib = null;
function pdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.js");
  }
  return pdfjsLib;
}
async function openPdf(buf) {
  if (!isPdf(buf)) throw E("Bu PDF fayl emas.");
  try {
    return await pdfjs().getDocument({ data: new Uint8Array(buf), verbosity: 0, isEvalSupported: false, disableFontFace: true, useSystemFonts: true }).promise;
  } catch (e) {
    if (e && e.name === "PasswordException") throw E("PDF parol bilan himoyalangan — avval parolni olib tashlang.");
    throw E("PDF faylni ochib bo'lmadi: u buzilgan bo'lishi mumkin.");
  }
}
const median = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const BULLET = /^([•●▪◦‣·■□○\-–—*]|\d{1,3}[.)]|[a-zA-Zа-яА-Я][.)]|[IVXivx]{1,4}[.)])\s/;

// Bir sahifa elementlaridan satrlar
function pageLines(items) {
  const its = items.filter((i) => i.s && i.s.trim() !== "" || i.s === " ").sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of its) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(it.y - last.y) <= Math.max(it.h, last.h) * 0.45) { last.items.push(it); last.h = Math.max(last.h, it.h); }
    else lines.push({ y: it.y, h: it.h || 10, items: [it] });
  }
  return lines.map((ln) => {
    ln.items.sort((a, b) => a.x - b.x);
    let text = "", end = null;
    for (const it of ln.items) {
      if (end !== null) {
        const gap = it.x - end;
        if (gap > it.h * 2.6) text += "\t";
        else if (gap > it.h * 0.18 && !text.endsWith(" ") && !it.s.startsWith(" ")) text += " ";
      }
      text += it.s;
      end = it.x + it.w;
    }
    const first = ln.items[0], lastIt = ln.items[ln.items.length - 1];
    return { text: text.replace(/[  ]+$/g, ""), x0: first.x, x1: lastIt.x + lastIt.w, y: ln.y, h: ln.h };
  }).filter((l) => l.text.trim());
}

async function pdfParagraphs(buf) {
  const doc = await openPdf(buf);
  if (doc.numPages > MAX_PDF_PAGES) throw E(`PDF ${MAX_PDF_PAGES} sahifadan oshmasin.`);
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter((i) => typeof i.str === "string").map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || i.height || 10, w: i.width || 0 }));
    pages.push({ w: vp.width, h: vp.height, lines: pageLines(items) });
  }
  const all = pages.flatMap((p) => p.lines);
  const chars = all.reduce((s, l) => s + l.text.length, 0);
  if (chars < 15) throw E("Bu PDF skaner (rasm) ko'rinishida — undan matn ajratib bo'lmaydi. Matnli (nusxa olinadigan) PDF yuklang.");
  // asosiy shrift o'lchami: belgilar soni bo'yicha medianа
  const body = median(all.flatMap((l) => Array(Math.min(60, Math.max(1, l.text.length))).fill(l.h))) || 11;
  const paras = [];
  for (const pg of pages) {
    const L = pg.lines;
    if (!L.length) continue;
    const left = Math.min(...L.map((l) => l.x0)), right = Math.max(...L.map((l) => l.x1));
    const width = Math.max(1, right - left);
    let prev = null, cur = null;
    for (const l of L) {
      const head = l.h >= body * 1.22;
      const startNew = !cur || head || prev.head
        || (prev.y - l.y) > body * 1.9
        || BULLET.test(l.text)
        || prev.x1 < right - width * 0.14
        || l.x0 > prev.x0 + body * 1.2 && l.x0 > left + body * 0.8;
      if (startNew) {
        cur = { text: l.text, size: l.h, head, x0: l.x0, x1: l.x1, left, right, pw: pg.w, lines: 1 };
        paras.push(cur);
      } else {
        const hyphen = /[A-Za-zА-Яа-яЁёʻʼ‘’']-$/.test(cur.text) && /^[a-zа-яёʻʼ]/.test(l.text);
        cur.text = hyphen ? cur.text.slice(0, -1) + l.text : cur.text + (cur.text.endsWith("\t") ? "" : " ") + l.text;
        cur.x1 = Math.max(cur.x1, l.x1);
        cur.lines++;
      }
      prev = { y: l.y, x0: l.x0, x1: l.x1, head };
    }
  }
  const first = pages[0];
  return { paras, body, page: { w: first.w, h: first.h }, pages: doc.numPages };
}

async function pdfToWord(file) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Tab, PageOrientation } = require("docx");
  const { paras, body, page } = await pdfParagraphs(file.buffer);
  const bodyPt = Math.min(14, Math.max(9, Math.round(body * 2) / 2));
  const children = paras.map((p) => {
    const parts = p.text.split("\t");
    const runs = [];
    parts.forEach((t, i) => { if (i) runs.push(new Tab()); if (t) runs.push(t); });
    const sizePt = p.head ? Math.min(22, Math.max(bodyPt + 1, Math.round(p.size * 2) / 2)) : bodyPt;
    const cx = (p.x0 + p.x1) / 2, center = p.lines === 1 && Math.abs(cx - p.pw / 2) < p.pw * 0.03 && p.x0 > p.left + p.pw * 0.08;
    return new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: p.head ? 200 : 0, after: p.head ? 120 : 100, line: 276 },
      keepNext: !!p.head,
      children: [new TextRun({ children: runs, size: Math.round(sizePt * 2), bold: !!p.head, font: "Times New Roman" })],
    });
  });
  const land = page.w > page.h;
  const doc = new Document({
    creator: "Print 54",
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838, orientation: land ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children,
    }],
  });
  return { buffer: await Packer.toBuffer(doc), name: baseOf(file.name, "hujjat") + ".docx", mime: MIME.docx };
}

/* ---------------------------------------------------------------
   PDF -> PowerPoint: har bir sahifa — slayd (rasm sifatida)
   --------------------------------------------------------------- */
const PPTX_MAX_PAGES = 50;
async function pdfToJpegs(buf, withPage, { width = 1600, quality = 0.84 } = {}) {
  const lib = fs.readFileSync(require.resolve("pdfjs-dist/build/pdf.min.js"), "utf8");
  const worker = fs.readFileSync(require.resolve("pdfjs-dist/build/pdf.worker.min.js"), "utf8");
  return withPage(async (page) => {
    await page.setContent("<!doctype html><html><body style='margin:0'><canvas id='c'></canvas></body></html>");
    await page.addScriptTag({ content: lib });
    const n = await page.evaluate((workerCode, b64) => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" }));
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      window.__doc = window.pdfjsLib.getDocument({ data: u8, isEvalSupported: false }).promise;
      return window.__doc.then((d) => d.numPages);
    }, worker, buf.toString("base64"));
    if (n > PPTX_MAX_PAGES) throw E(`PowerPoint uchun PDF ${PPTX_MAX_PAGES} sahifadan oshmasin (sizda ${n} ta). Avval «PDF ni bo'lish» orqali qismlarga ajrating.`);
    const out = [];
    for (let i = 1; i <= n; i++) {
      out.push(await page.evaluate(async (num, w, q) => {
        const d = await window.__doc;
        const p = await d.getPage(num);
        const v1 = p.getViewport({ scale: 1 });
        const v = p.getViewport({ scale: w / v1.width });
        const c = document.getElementById("c");
        c.width = Math.round(v.width); c.height = Math.round(v.height);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        await p.render({ canvasContext: ctx, viewport: v }).promise;
        return { w: v1.width, h: v1.height, img: c.toDataURL("image/jpeg", q) };
      }, i, width, quality));
    }
    return out;
  });
}
async function pdfToPptx(file, o, { withPage }) {
  if (!isPdf(file.buffer)) throw E("Bu PDF fayl emas.");
  let pages;
  try {
    pages = await pdfToJpegs(file.buffer, withPage);
  } catch (e) {
    if (e && e.user) throw e;
    if (/password/i.test(String(e && e.message))) throw E("PDF parol bilan himoyalangan — avval parolni olib tashlang.");
    console.error("PDF -> PPTX:", e);
    throw E("PDF sahifalarini rasmga aylantirib bo'lmadi: fayl buzilgan bo'lishi mumkin.");
  }
  const PptxGenJS = require("pptxgenjs");
  const p = new PptxGenJS();
  const W = 10;
  const H = Math.round((W * pages[0].h / pages[0].w) * 1000) / 1000; // slayd o'lchami — 1-sahifaniki
  p.defineLayout({ name: "PDF", width: W, height: H });
  p.layout = "PDF";
  pages.forEach((pg) => {
    const s = p.addSlide();
    // sahifa nisbati boshqacha bo'lsa — kattalashtirmasdan markazga
    let w = W, h = (W * pg.h) / pg.w;
    if (h > H) { h = H; w = (H * pg.w) / pg.h; }
    s.addImage({ data: pg.img.replace(/^data:/, ""), x: (W - w) / 2, y: (H - h) / 2, w, h });
  });
  const buffer = await p.write({ outputType: "nodebuffer" });
  return { buffer: Buffer.from(buffer), name: baseOf(file.name, "taqdimot") + ".pptx", mime: MIME.pptx };
}

/* ---------------------------------------------------------------
   Birlashgan kirish nuqtasi
   --------------------------------------------------------------- */
const { TOOLS, EXT, MAX_FILES } = require("./doc-tools-meta");
async function runTool(service, files, options, deps) {
  const o = options || {};
  if (!files.length) throw E("Fayl topilmadi — qaytadan yuklang.");
  switch (service) {
    case "char_add": return charAdd(files, o);
    case "word2pdf": return wordToPdf(files[0], o, deps);
    case "excel2pdf": return excelToPdf(files[0], o, deps);
    case "pptx2pdf": return pptxToPdf(files[0], o, deps);
    case "pdfmerge": return mergePdfs(files);
    case "pdfsplit": return splitPdf(files[0], o);
    case "pdf2word": return pdfToWord(files[0]);
    case "pdf2pptx": return pdfToPptx(files[0], o, deps);
    default: throw new Error("Noma'lum vosita: " + service);
  }
}

module.exports = { runTool, TOOLS, EXT, MAX_FILES, UserError, parsePages, pdfParagraphs, isPdf, isZip, isOle };
