// api/_lib/doc-render.js
// ---------------------------------------------------------------
// Bitta hujjat modeli -> Word (.docx) yoki HTML (Chrome orqali PDF).
// AI xizmatlari (mustaqil ish, referat, dars ishlanma, savollar,
// krossvord) hujjatni "bloklar" ro'yxati qilib tuzadi:
//   { t: "title", lines: [{ text, size, bold, align, gap }] }  — titul varag'i
//   { t: "h1" | "h2", text }      { t: "p", text, indent }
//   { t: "list", items, ordered }  { t: "table", head, rows, widths }
//   { t: "cards", items: [{ title, text }] }   — kesiladigan kartochkalar
//   { t: "grid", cells: [[null | { n, ch }]], show }  — krossvord to'ri
//   { t: "toc", title }   — mundarija (sahifa raqamlari bilan; Word'da)
//   { t: "image", data: <PNG Buffer>, w, h }  — rasm/grafik (piksel, 96 dpi)
//   { t: "pagebreak" }
// render: toc, pageNumbers (pastda o'rtada), titleFirst (1-sahifa — titul, raqamsiz),
//   footnotes: [adabiyotlar] — matndagi [3] kabi belgilar sahifa ostidagi snoskaga aylanadi
// Standart: Times New Roman 14, 1,5 interval, hoshiyalar 3/1,5/2/2 sm.
// ---------------------------------------------------------------

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, PageBreak, HeadingLevel, VerticalAlign,
  TableOfContents, FootnoteReferenceRun, Footer, PageNumber, ImageRun,
} = require("docx");
// Mundarijadagi sahifa raqamlarini hujjat yozilayotganda hisoblaydi (Word ochilganda yana yangilaydi)
let estimatePageNumbers = null;
try { ({ estimatePageNumbers } = require("docx/layout")); } catch (e) { /* eski versiya */ }

const CM = 567;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------- HTML (PDF) ---------------- */
function blocksToHtml(blocks, o = {}) {
  const font = o.font || "Times New Roman";
  const size = o.size || 14;
  const out = blocks.map((b) => {
    switch (b.t) {
      case "title":
        return `<section class="title">${b.lines.map((l) => `<div style="text-align:${l.align || "center"};font-size:${l.size || size}pt;font-weight:${l.bold ? 700 : 400}${l.gap ? `;margin-top:${l.gap}mm` : ""}">${esc(l.text)}</div>`).join("")}</section>`;
      case "image": return `<div style="text-align:center;margin:3mm 0"><img src="data:image/png;base64,${Buffer.from(b.data).toString("base64")}" style="width:${b.w * 0.75}pt;height:${b.h * 0.75}pt"></div>`;
      case "toc": return `<h1>${esc(b.title)}</h1>${blocks.filter((x) => x.t === "h1" || x.t === "h2").map((x) => `<p style="margin:0 0 1mm ${x.t === "h2" ? "8mm" : "0"};text-align:left">${esc(x.text)}</p>`).join("")}<div class="pb"></div>`;
      case "h1": return `<h1>${esc(b.text)}</h1>`;
      case "h2": return `<h2>${esc(b.text)}</h2>`;
      case "p": return `<p class="${b.indent === false || b.align ? "" : "ind"}" style="${b.align ? `text-align:${b.align};` : ""}${b.bold ? "font-weight:700;" : ""}${b.italic ? "font-style:italic;" : ""}${b.small ? "font-size:.9em;" : ""}">${b.label ? `<b>${esc(b.label)}</b> ` : ""}${o.footnotes ? esc(b.text).replace(/\s?\[(\d{1,2})\]/g, "<sup>$1</sup>") : esc(b.text)}</p>`;
      case "list": return `<${b.ordered ? "ol" : "ul"}>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</${b.ordered ? "ol" : "ul"}>`;
      case "table":
        return `<table class="tbl">${b.head ? `<thead><tr>${b.head.map((h, i) => `<th style="${b.widths ? `width:${b.widths[i]}%` : ""}">${esc(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      case "cards":
        return `<div class="cards">${b.items.map((c) => `<div class="card">${c.title ? `<div class="ct">${esc(c.title)}</div>` : ""}<div>${esc(c.text).replace(/\n/g, "<br>")}</div></div>`).join("")}</div>`;
      case "grid": {
        const w = b.cells[0].length;
        const cell = Math.min(9, Math.floor(170 / w));
        return `<div class="grid" style="grid-template-columns:repeat(${w},${cell}mm)">${b.cells.flat().map((c) => c
          ? `<div class="gc" style="width:${cell}mm;height:${cell}mm${b.color ? `;background:${b.color}` : ""}">${c.n ? `<span class="gn">${c.n}</span>` : ""}${b.show ? `<span class="gl">${esc(c.ch)}</span>` : ""}</div>`
          : `<div style="width:${cell}mm;height:${cell}mm"></div>`).join("")}</div>`;
      }
      case "pagebreak": return `<div class="pb"></div>`;
      default: return "";
    }
  }).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Tinos:wght@400;700&family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:20mm 15mm 20mm 30mm}
*{box-sizing:border-box}
body{margin:0;font-family:"${font}","Tinos","Times New Roman",serif;font-size:${size}pt;line-height:${o.lineHeight || 1.5};color:#000}
.title{height:250mm;display:flex;flex-direction:column;break-after:page}
.title > div:last-child{margin-top:auto}
h1{font-size:${size + 1}pt;text-align:center;margin:0 0 4mm;break-after:avoid;text-transform:${o.capsH1 ? "uppercase" : "none"}}
h2{font-size:${size}pt;margin:4mm 0 2mm;break-after:avoid}
p{margin:0 0 1mm;text-align:justify}
p.ind{text-indent:12.5mm}
ul,ol{margin:0 0 2mm;padding-left:10mm}
.tbl{width:100%;border-collapse:collapse;font-size:${Math.max(10, size - 2)}pt;line-height:1.3;margin:2mm 0 4mm}
.tbl th,.tbl td{border:1px solid #000;padding:2mm;vertical-align:top;text-align:left}
.tbl th{background:#f2f2f2}
.tbl tr{break-inside:avoid}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:0}
.card{border:1px dashed #555;padding:5mm;min-height:32mm;break-inside:avoid;font-size:${size - 1}pt;line-height:1.35}
.card .ct{font-weight:700;margin-bottom:2mm}
.grid{display:grid;justify-content:center;margin:4mm 0 6mm}
.gc{border:1px solid #000;margin:0 -1px -1px 0;position:relative;display:flex;align-items:center;justify-content:center}
.gn{position:absolute;top:0.3mm;left:0.6mm;font-size:6.5pt;line-height:1;font-family:Arial,sans-serif}
.gl{font-family:Arial,sans-serif;font-weight:700;font-size:11pt}
.pb{break-after:page}
${o.css || ""}
</style></head><body>${out}</body></html>`;
}

/* ---------------- Word ---------------- */
async function blocksToDocx(blocks, o = {}) {
  const FONT = o.font || "Times New Roman";
  const SIZE = (o.size || 14) * 2;
  const LINE = Math.round((o.lineHeight || 1.5) * 240);
  const run = (text, x = {}) => new TextRun({ text: String(text), font: FONT, size: x.size || SIZE, bold: x.bold, italics: x.italic });
  // [3] -> sahifa ostida snoska (adabiyot); noto'g'ri raqam — olib tashlanadi
  const footnotes = {};
  let fnId = 0;
  const withNotes = (line, x) => {
    if (!o.footnotes || !/\[\d{1,2}\]/.test(line)) return [run(line, x)];
    return String(line).split(/\s?\[(\d{1,2})\]/).flatMap((part, i) => {
      if (i % 2 === 0) return part ? [run(part, x)] : [];
      const ref = o.footnotes[Number(part) - 1];
      if (!ref) return [];
      fnId += 1;
      footnotes[fnId] = { children: [new Paragraph({ children: [new TextRun({ text: ref, font: FONT, size: 20 })] })] };
      return [new FootnoteReferenceRun(fnId)];
    });
  };
  const para = (text, x = {}) => new Paragraph({
    alignment: x.align === "left" ? AlignmentType.LEFT : x.align === "right" ? AlignmentType.RIGHT : x.align === "center" ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { line: x.line || LINE, before: x.before || 0, after: x.after == null ? 0 : x.after },
    indent: x.indent ? { firstLine: Math.round(1.25 * CM) } : undefined,
    keepNext: x.keepNext,
    pageBreakBefore: x.pageBreakBefore,
    heading: x.heading,
    children: [...(x.label ? [run(x.label + " ", { ...x, bold: true })] : []), ...String(text).split("\n").flatMap((line, i) => (i ? [new TextRun({ break: 1 }), ...withNotes(line, x)] : withNotes(line, x)))],
  });
  const LINEB = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const DASH = { style: BorderStyle.DASHED, size: 4, color: "555555" };
  const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const children = [];
  let breakNext = false;
  const push = (p) => { children.push(p); };

  for (const b of blocks) {
    if (b.t === "pagebreak") { breakNext = true; continue; }
    const pb = breakNext;
    breakNext = false;
    if (pb && b.t !== "title") push(new Paragraph({ children: [new PageBreak()] }));
    switch (b.t) {
      case "title":
        if (pb) push(new Paragraph({ children: [new PageBreak()] }));
        b.lines.forEach((l, i) => push(para(l.text, { align: l.align || "center", size: (l.size || o.size || 14) * 2, bold: l.bold, before: Math.round((l.gap || 0) * 56.7), line: 276 })));
        breakNext = true;
        break;
      case "image":
        push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true, children: [new ImageRun({ type: "png", data: b.data, transformation: { width: b.w, height: b.h } })] }));
        break;
      case "toc":
        push(para(b.title, { align: "center", bold: true, size: SIZE + 2, after: 240 }));
        push(new TableOfContents(b.title, { hyperlink: true, headingStyleRange: "1-2" }));
        break;
      // mundarija bo'lsa — sarlavhalar Word uslubi bilan (mundarija ularni topadi)
      case "h1": push(para(o.capsH1 && o.toc ? b.text.toUpperCase() : b.text, { align: "center", bold: true, size: SIZE + 2, after: 120, keepNext: true, heading: o.toc ? HeadingLevel.HEADING_1 : undefined })); break;
      case "h2": push(para(b.text, { align: "left", bold: true, before: 120, after: 60, keepNext: true, heading: o.toc ? HeadingLevel.HEADING_2 : undefined })); break;
      case "p": push(para(b.text, { indent: b.indent !== false && !b.align, align: b.align, bold: b.bold, italic: b.italic, label: b.label, size: b.small ? SIZE - 4 : undefined })); break;
      case "list": b.items.forEach((it, i) => push(para(`${b.ordered ? `${i + 1}. ` : "• "}${it}`, { align: "left" }))); break;
      case "table": {
        const widths = b.widths || b.rows[0].map(() => Math.floor(100 / b.rows[0].length));
        const cell = (text, bold, shade) => new TableCell({
          borders: { top: LINEB, bottom: LINEB, left: LINEB, right: LINEB },
          shading: shade ? { fill: "F2F2F2" } : undefined,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para(text, { align: "left", bold, size: SIZE - 4, line: 260 })],
        });
        const rows = [];
        if (b.head) rows.push(new TableRow({ tableHeader: true, children: b.head.map((h) => cell(h, true, true)) }));
        b.rows.forEach((r) => rows.push(new TableRow({ cantSplit: true, children: r.map((c) => cell(c)) })));
        push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths.map((w) => Math.round((w / 100) * 9000)), rows }));
        push(para("", { after: 120 }));
        break;
      }
      case "cards": {
        const rows = [];
        for (let i = 0; i < b.items.length; i += 2) {
          rows.push(new TableRow({ cantSplit: true, children: [b.items[i], b.items[i + 1]].map((c) => new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: DASH, bottom: DASH, left: DASH, right: DASH },
            margins: { top: 160, bottom: 160, left: 160, right: 160 },
            children: c ? [...(c.title ? [para(c.title, { align: "left", bold: true, size: SIZE - 2, line: 260 })] : []), para(c.text, { align: "left", size: SIZE - 2, line: 260 })] : [para("")],
          })) }));
        }
        push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
        break;
      }
      case "grid": {
        const w = b.cells[0].length;
        const sz = Math.min(500, Math.floor(9000 / w));
        push(new Table({
          alignment: AlignmentType.CENTER,
          columnWidths: Array(w).fill(sz),
          rows: b.cells.map((row) => new TableRow({ height: { value: sz, rule: "exact" }, children: row.map((c) => new TableCell({
            width: { size: sz, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: c ? { top: LINEB, bottom: LINEB, left: LINEB, right: LINEB } : { top: NONE, bottom: NONE, left: NONE, right: NONE },
            shading: c && b.color ? { fill: b.color.replace("#", "") } : undefined,
            margins: { top: 0, bottom: 0, left: 20, right: 20 },
            children: [new Paragraph({ alignment: b.show ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { line: 200 }, children: c
              ? (b.show ? [new TextRun({ text: c.ch, font: "Arial", size: 18, bold: true })] : [new TextRun({ text: c.n ? String(c.n) : "", font: "Arial", size: 11 })])
              : [] })],
          })) })),
        }));
        push(para("", { after: 120 }));
        break;
      }
      default: break;
    }
  }
  // sahifa raqami pastda o'rtada; titul (1-sahifa) raqamsiz; tayyor OTM tituli oldidan qo'shilsa — 2 dan
  const pageNo = () => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })] });
  const tocStyle = (id, name, left) => ({ id, name, basedOn: "Normal", next: "Normal", run: { font: FONT, size: SIZE }, paragraph: { spacing: { after: 60, line: 276 }, indent: left ? { left } : undefined } });
  const headStyle = (id, name, size) => ({ id, name, basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size, bold: true, color: "000000" } });
  const doc = new Document({
    ...(o.toc && estimatePageNumbers ? { pageNumbers: estimatePageNumbers } : {}),
    ...(o.toc ? { features: { updateFields: true } } : {}),
    ...(fnId ? { footnotes } : {}),
    ...(o.toc ? { styles: { paragraphStyles: [headStyle("Heading1", "Heading 1", SIZE + 2), headStyle("Heading2", "Heading 2", SIZE), tocStyle("TOC1", "toc 1", 0), tocStyle("TOC2", "toc 2", 400)] } } : {}),
    sections: [{
      properties: {
        page: { margin: { top: 2 * CM, bottom: 2 * CM, left: 3 * CM, right: 1.5 * CM }, ...(o.pageNumbers && !o.titleFirst ? { pageNumbers: { start: 2 } } : {}) },
        ...(o.pageNumbers && o.titleFirst ? { titlePage: true } : {}),
      },
      ...(o.pageNumbers ? { footers: { default: new Footer({ children: [pageNo()] }), ...(o.titleFirst ? { first: new Footer({ children: [new Paragraph("")] }) } : {}) } } : {}),
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { blocksToHtml, blocksToDocx };
