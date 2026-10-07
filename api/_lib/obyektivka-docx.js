// api/_lib/obyektivka-docx.js
// ---------------------------------------------------------------
// Obyektivka (ma'lumotnoma) — rasmiy namunadagi Word (.docx) fayl.
// AI ishlatilmaydi: mijoz kiritgan ma'lumotlar shaklga joylanadi.
// Talablar (namuna izohidan): Times New Roman 11 (sarlavhalar 14/12),
// hoshiyalar: yuqori 1,5 sm, past 1 sm, o'ng 1 sm, chap 2 sm,
// fayl nomi — to'liq F.I.Sh., 3x4 rasm.
// Hujjat lotin (asosiy) yoki kirill alifbosida; lotinda yozilgan matn
// kirillga public/ai/translit.js bilan o'giriladi.
// ---------------------------------------------------------------

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ImageRun, VerticalAlign, PageBreak,
} = require("docx");
const uzCyr = require("../../public/ai/translit.js");

const CM = 567; // 1 sm — twip
const FONT = "Times New Roman";
const LAT_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const CYR_MONTHS = ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];

const clean = (v, max = 600) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const lines = (v) => String(v || "").split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 40);

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const LINE = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const CELL_LINES = { top: LINE, bottom: LINE, left: LINE, right: LINE };

const canAutoObyektivka = (fields) => !!(fields && clean(fields.fio, 200).split(" ").length >= 3);

function obyektivkaData(f) {
  const cyr = f.lang === "cyr";
  const T = cyr ? uzCyr : (x) => x;
  const t = (v, max) => T(clean(v, max));
  const rels = (Array.isArray(f.relatives) ? f.relatives : []).slice(0, 20).map((r) => ({
    rel: t(r.rel, 40), name: t(r.name, 120), birth: t(r.birth, 160), dead: !!r.dead,
    deathYear: clean(r.deathYear, 10), lastJob: t(r.lastJob, 200), work: t(r.work, 300), address: t(r.address, 300),
  })).filter((r) => r.rel || r.name);

  let since = "";
  const m = clean(f.since, 20).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) {
    const dd = m[1].padStart(2, "0");
    since = cyr ? `${m[3]} йил ${dd} ${CYR_MONTHS[+m[2] - 1]}дан:` : `${m[3]} yil ${dd} ${LAT_MONTHS[+m[2] - 1]}dan:`;
  } else if (clean(f.since)) since = t(f.since, 60) + ":";

  const yoq = cyr ? "йўқ" : "yo'q";
  const or = (v) => t(v, 400) || yoq;
  return {
    cyr, T,
    fio: t(f.fio, 120),
    since, job: t(f.job, 400),
    birthDate: clean(f.birthDate, 20), birthPlace: t(f.birthPlace, 200),
    nation: t(f.nation, 60), party: or(f.party),
    eduLevel: t(f.eduLevel, 60), graduated: lines(f.graduated).map((x) => T(x)),
    specialty: t(f.specialty, 200), degree: or(f.degree), title: or(f.academicTitle),
    langs: or(f.foreignLangs), awards: or(f.awards), deputy: or(f.deputy),
    work: lines(f.work).map((x) => T(x)),
    rels,
  };
}

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: (o.size || 11) * 2, bold: !!o.bold, italics: !!o.italic });
const para = (text, o = {}) => new Paragraph({
  alignment: o.align || AlignmentType.LEFT,
  spacing: { before: o.before || 0, after: o.after == null ? 0 : o.after, line: 240 },
  children: [run(text, o)],
});
// "Yorliq:" (qalin) va qiymat(lar) — bitta katak
const pair = (label, values) => [para(label, { bold: true })].concat((Array.isArray(values) ? values : [values]).map((v) => para(v))).concat([para("", { size: 6 })]);

function cell(children, o = {}) {
  return new TableCell({
    children, rowSpan: o.rowSpan, columnSpan: o.columnSpan,
    width: o.width ? { size: o.width, type: WidthType.DXA } : undefined,
    borders: o.borders || { top: NONE, bottom: NONE, left: NONE, right: NONE },
    verticalAlign: o.vAlign || VerticalAlign.TOP,
    margins: o.margins || { top: 0, bottom: 0, left: 0, right: 80 },
  });
}

async function buildObyektivka(fields, photo) {
  const d = obyektivkaData(fields);
  const L = (s) => d.T(s); // yorliqlar lotinda yozilgan — kerak bo'lsa kirillga
  const W = 21 * CM - 3 * CM; // matn kengligi
  const colL = Math.round(W * 0.37), colR = Math.round(W * 0.38), colP = W - colL - colR;

  const photoCell = photo
    ? cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: "jpg", data: photo, transformation: { width: 113, height: 151 } })] })], { rowSpan: 3, width: colP })
    : cell([para(L("3x4 sm rasm"), { align: AlignmentType.CENTER, before: 900 })], { rowSpan: 3, width: colP, borders: CELL_LINES, vAlign: VerticalAlign.CENTER });

  const head = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [colL, colR, colP],
    borders: NO_BORDERS,
    rows: [
      new TableRow({ children: [
        cell([para(d.since)].concat(d.job ? [para(d.job, { bold: true, after: 120 })] : []), { columnSpan: 2, width: colL + colR }),
        photoCell,
      ] }),
      new TableRow({ children: [cell(pair(L("Tug'ilgan yili:"), d.birthDate), { width: colL }), cell(pair(L("Tug'ilgan joyi:"), d.birthPlace), { width: colR })] }),
      new TableRow({ children: [cell(pair(L("Millati:"), d.nation), { width: colL }), cell(pair(L("Partiyaviyligi:"), d.party), { width: colR })] }),
      new TableRow({ children: [
        cell(pair(L("Ma'lumoti:"), d.eduLevel), { width: colL }),
        cell(pair(L("Tamomlagan:"), d.graduated.length ? d.graduated : [L("yo'q")]), { columnSpan: 2, width: colR + colP }),
      ] }),
      new TableRow({ children: [
        cell([para(L("Ma'lumoti bo'yicha"), { bold: true }), para(L("mutaxassisligi:"), { bold: true }), para("", { size: 6 })], { width: colL }),
        cell([para(""), para(d.specialty || L("yo'q")), para("", { size: 6 })], { columnSpan: 2, width: colR + colP }),
      ] }),
      new TableRow({ children: [
        cell(pair(L("Ilmiy darajasi:"), d.degree), { width: colL }),
        cell(pair(L("Ilmiy unvoni:"), d.title), { columnSpan: 2, width: colR + colP }),
      ] }),
    ],
  });

  const tail = [
    ...pair(L("Qaysi chet tillarini biladi:"), d.langs),
    ...pair(L("Davlat mukofotlari bilan taqdirlanganmi (qanaqa):"), d.awards),
    ...pair(L("Xalq deputatlari respublika, viloyat, shahar va tuman Kengashi deputatimi yoki boshqa saylanadigan organlarning a'zosimi (to'liq ko'rsatilishi lozim):"), d.deputy),
    para(L("MEHNAT FAOLIYATI"), { bold: true, size: 14, align: AlignmentType.CENTER, before: 120, after: 80 }),
    ...d.work.map((w) => para(w, { after: 80 })),
  ];

  const relSection = [];
  if (d.rels.length) {
    const cw = [Math.round(W * 0.14), Math.round(W * 0.2), Math.round(W * 0.18), Math.round(W * 0.23)];
    cw.push(W - cw.reduce((a, b) => a + b, 0));
    const c = (text, i, o = {}) => cell([para(text, { align: AlignmentType.CENTER, bold: o.bold })], {
      width: o.span ? cw[3] + cw[4] : cw[i], columnSpan: o.span ? 2 : undefined, borders: CELL_LINES, vAlign: VerticalAlign.CENTER,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
    });
    const header = new TableRow({ tableHeader: true, children: ["Qarindoshligi", "Familiyasi, ismi va otasining ismi", "Tug'ilgan yili va joyi", "Ish joyi va lavozimi", "Turar joyi"].map((h, i) => c(L(h), i, { bold: true })) });
    const rows = d.rels.map((r) => new TableRow({
      cantSplit: true,
      children: [c(r.rel, 0, { bold: true }), c(r.name, 1), c(r.birth, 2)].concat(r.dead
        ? [c(`${r.deathYear} ${L("yilda vafot etgan")}${r.lastJob ? ` (${r.lastJob})` : ""}`, 3, { span: true })]
        : [c(r.work, 3), c(r.address, 4)]),
    }));
    relSection.push(
      new Paragraph({ children: [new PageBreak()] }),
      para(`${d.fio}${L("ning yaqin qarindoshlari haqida")}`, { bold: true, size: 12, align: AlignmentType.CENTER }),
      para(L("MA'LUMOT"), { bold: true, size: 12, align: AlignmentType.CENTER, after: 200 }),
      new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: cw, rows: [header].concat(rows) }),
    );
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 21 * CM, height: 29.7 * CM }, margin: { top: Math.round(1.5 * CM), bottom: CM, right: CM, left: 2 * CM } } },
      children: [
        para(L("MA'LUMOTNOMA"), { bold: true, size: 14, align: AlignmentType.CENTER }),
        para(d.fio, { bold: true, size: 14, align: AlignmentType.CENTER, after: 200 }),
        head,
        ...tail,
        ...relSection,
      ],
    }],
  });
  return { buffer: await Packer.toBuffer(doc), fileName: `${d.fio.replace(/[\\/:*?"<>|]+/g, "").slice(0, 100) || "Obyektivka"}.docx` };
}

module.exports = { buildObyektivka, obyektivkaData, canAutoObyektivka };
