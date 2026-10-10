// api/_lib/titul.js
// ---------------------------------------------------------------
// Universitetlarning tayyor titul varaqlari (mustaqil ish, referat).
// Egasi bitta Word faylda har bir OTM titulini tayyorlagan (titullar.docx,
// yopiq repozitoriyada — taqdimot shablonlari yonida). Har bir sahifa
// {YIL} bilan tugaydi; o'zgaradigan joylar: {FAKULTET} {fan_nomi} {Ish_turi}
// {MAVZU} {GURUH} {TALABA} {OQITUVCHI} {YIL} (katta-kichik harf farqsiz).
//
// Sahifa uslublar (styles.xml) "pishirilgan" holda olinadi: har bir paragraf
// va matn bo'lagiga yakuniy shrift/o'lcham/tekislash to'g'ridan-to'g'ri
// yoziladi — shunda u boshqa hujjatga (docx kutubxonasi yasagan) xuddi
// asl ko'rinishida qo'shiladi, PDF uchun esa HTML'ga aylantiriladi.
// Ro'yxat (ilova uchun): public/ai/titullar.js — tools/titul-index.js yasaydi.
// ---------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const FILE = "titullar.docx";

/* ---------------- yuklash ---------------- */
async function loadFile() {
  if (process.env.TEMPLATES_DIR) return fs.readFileSync(path.join(process.env.TEMPLATES_DIR, FILE)); // lokal sinov
  const tmp = path.join("/tmp", FILE);
  try { return fs.readFileSync(tmp); } catch (e) { /* yo'q */ }
  const repo = process.env.TEMPLATES_REPO || "olmazorprint54-bit/print54-shablonlar";
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${FILE}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.raw", "User-Agent": "print54" },
  });
  if (!res.ok) throw new Error(`Titullar faylini yuklab bo'lmadi: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  try { fs.writeFileSync(tmp, buf); } catch (e) { /* /tmp yo'q (lokal) */ }
  return buf;
}
const canTitul = () => !!(process.env.TEMPLATES_DIR || process.env.GITHUB_TOKEN);

/* ---------------- XML yordamchilari ---------------- */
const attrs = (tag) => Object.fromEntries([...String(tag).matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// <w:x .../> yoki <w:x ...>...</w:x> — birinchi uchragani
function el(xml, tag) {
  const re = new RegExp(`<${tag}(?=[\\s/>])[^>]*?(?:/>|>[\\s\\S]*?</${tag}>)`);
  const m = re.exec(xml || "");
  return m ? m[0] : null;
}
// rPr / pPr ichidagi bolalar: teg nomi -> xml (bir xil teg — oxirgisi)
function children(xml) {
  const out = new Map();
  if (!xml) return out;
  const inner = xml.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "");
  const re = /<(w:\w+)(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g;
  let m;
  while ((m = re.exec(inner))) out.set(m[1], m[0]);
  return out;
}
// atributlari birlashadigan xossalar (masalan spacing: before bir uslubdan, after boshqasidan)
const MERGE_ATTRS = new Set(["w:spacing", "w:ind", "w:rFonts", "w:lang"]);
function mergeProps(base, over) {
  const out = new Map(base);
  for (const [k, v] of over) {
    if (MERGE_ATTRS.has(k) && out.has(k) && v.endsWith("/>")) {
      const a = { ...attrs(out.get(k).replace(/^<[\w:]+/, "")), ...attrs(v.replace(/^<[\w:]+/, "")) };
      out.set(k, `<${k} ${Object.entries(a).map(([n, x]) => `${n}="${x}"`).join(" ")}/>`);
    } else out.set(k, v);
  }
  return out;
}
// Word elementlar tartibiga qattiq qaraydi (sxema bo'yicha)
const R_ORDER = ["w:rFonts", "w:b", "w:bCs", "w:i", "w:iCs", "w:caps", "w:smallCaps", "w:strike", "w:dstrike", "w:outline", "w:shadow", "w:emboss", "w:imprint", "w:noProof", "w:snapToGrid", "w:vanish", "w:webHidden", "w:color", "w:spacing", "w:w", "w:kern", "w:position", "w:sz", "w:szCs", "w:highlight", "w:u", "w:effect", "w:bdr", "w:shd", "w:fitText", "w:vertAlign", "w:rtl", "w:cs", "w:em", "w:lang", "w:eastAsianLayout", "w:specVanish"];
const P_ORDER = ["w:keepNext", "w:keepLines", "w:framePr", "w:widowControl", "w:pBdr", "w:shd", "w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap", "w:overflowPunct", "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN", "w:bidi", "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind", "w:contextualSpacing", "w:mirrorIndents", "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment", "w:textboxTightWrap"];
const ordered = (map, order) => order.filter((k) => map.has(k)).map((k) => map.get(k)).join("");

/* ---------------- uslublarni o'qish ---------------- */
function readStyles(stylesXml, themeXml) {
  const theme = {};
  const mj = /<a:majorFont>[\s\S]*?<a:latin typeface="([^"]*)"/.exec(themeXml || "");
  const mn = /<a:minorFont>[\s\S]*?<a:latin typeface="([^"]*)"/.exec(themeXml || "");
  theme.major = mj ? mj[1] : "Times New Roman";
  theme.minor = mn ? mn[1] : "Times New Roman";
  const dd = el(stylesXml, "w:docDefaults") || "";
  const styles = {};
  let normal = null;
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/g)) {
    const a = attrs(m[0].slice(0, m[0].indexOf(">")));
    const id = a["w:styleId"];
    const based = /<w:basedOn w:val="([^"]+)"/.exec(m[0]);
    styles[id] = { pPr: children(el(m[0], "w:pPr")), rPr: children(el(m[0], "w:rPr")), basedOn: based && based[1], type: a["w:type"] };
    if (a["w:type"] === "paragraph" && a["w:default"] === "1") normal = id;
  }
  return { theme, styles, normal, dPr: children(el(el(dd, "w:pPrDefault") || "", "w:pPr")), dRr: children(el(el(dd, "w:rPrDefault") || "", "w:rPr")) };
}
function styleChain(S, id) {
  const chain = [];
  const seen = new Set();
  while (id && S.styles[id] && !seen.has(id)) { seen.add(id); chain.unshift(S.styles[id]); id = S.styles[id].basedOn; }
  return chain;
}
// mavzu (theme) shriftini aniq nomga aylantirish
function fixFonts(map, S) {
  const f = map.get("w:rFonts");
  if (!f) return map;
  const a = attrs(f.replace(/^<w:rFonts/, ""));
  const name = (t) => (/major/.test(t) ? S.theme.major : S.theme.minor);
  const ascii = a["w:ascii"] || (a["w:asciiTheme"] && name(a["w:asciiTheme"])) || a["w:hAnsi"] || (a["w:hAnsiTheme"] && name(a["w:hAnsiTheme"]));
  const out = new Map(map);
  if (ascii) out.set("w:rFonts", `<w:rFonts w:ascii="${ascii}" w:hAnsi="${ascii}" w:cs="${ascii}" w:eastAsia="${ascii}"/>`);
  return out;
}

/* ---------------- sahifalarga bo'lish ---------------- */
const textOf = (p) => unxml([...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""));
const hasDrawing = (p) => /<w:drawing>/.test(p);
function nameOf(paras) {
  for (const p of paras) {
    const t = textOf(p).replace(/\s+/g, " ").trim();
    if (!t || /VAZIRLIG|МИНИСТЕРСТВ|\{/i.test(t)) continue;
    return t;
  }
  return "";
}
const slug = (s) => s.toLowerCase().replace(/[‘’ʻʼ`']/g, "").replace(/[^a-z0-9а-яёўқғҳ]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 140);

let parsed = null;
async function load() {
  if (parsed) return parsed;
  const zip = await JSZip.loadAsync(await loadFile());
  const doc = await zip.file("word/document.xml").async("string");
  const S = readStyles(await zip.file("word/styles.xml").async("string"), zip.file("word/theme/theme1.xml") ? await zip.file("word/theme/theme1.xml").async("string") : "");
  const rels = await zip.file("word/_rels/document.xml.rels").async("string");
  const relMap = {};
  for (const r of rels.matchAll(/<Relationship [^>]*\/>/g)) { const a = attrs(r[0]); relMap[a.Id] = a.Target; }
  const body = doc.slice(doc.indexOf("<w:body>") + 8, doc.lastIndexOf("</w:body>"));
  const sectPr = el(body, "w:sectPr") || "";
  const paras = body.match(/<w:p\b[^>]*\/>|<w:p(?=[\s>])[\s\S]*?<\/w:p>/g) || [];
  const pages = [];
  let cur = [];
  for (const p of paras) {
    if (!cur.length && !textOf(p).trim() && !hasDrawing(p)) continue; // sahifa boshidagi bo'sh qatorlar
    cur.push(p);
    if (/\{\s*yil\s*\}/i.test(textOf(p))) { pages.push(cur); cur = []; }
  }
  const byId = new Map();
  for (const ps of pages) {
    const name = nameOf(ps);
    if (!name) continue;
    const id = slug(name);
    byId.delete(id); // bir xil nom ikki marta bo'lsa — keyingisi (keyinroq tuzatilgani) qoladi
    byId.set(id, { id, name: name.replace(/\s+/g, " "), paras: ps });
  }
  parsed = { zip, S, relMap, sectPr, pages: byId, doc };
  return parsed;
}
async function list() {
  const { pages } = await load();
  return [...pages.values()].map((p) => ({ id: p.id, name: p.name }));
}

/* ---------------- to'ldirish ---------------- */
const BLANK = "____________________";
function valuesFor(v) {
  const year = String(new Date().getFullYear());
  return {
    FAKULTET: v.faculty, FAN_NOMI: v.subject, FAN: v.subject, ISH_TURI: v.workType, MAVZU: v.topic,
    GURUH: v.group, TALABA: v.student, OQITUVCHI: v.teacher, KAFEDRA: v.department, YIL: year,
  };
}
// Bitta paragraf: uslublar pishiriladi, {BELGI}lar (bir necha bo'lakka bo'linib ketgan bo'lsa ham) almashtiriladi
function bakeParagraph(p, S, vals) {
  const pPrXml = el(p, "w:pPr") || "";
  const direct = children(pPrXml);
  const pStyle = /<w:pStyle w:val="([^"]+)"/.exec(pPrXml);
  const chain = styleChain(S, pStyle ? pStyle[1] : S.normal);
  let pp = new Map(S.dPr);
  let rr = new Map(S.dRr);
  for (const st of chain) { pp = mergeProps(pp, st.pPr); rr = mergeProps(rr, st.rPr); }
  pp = mergeProps(pp, direct);
  for (const k of ["w:pStyle", "w:numPr", "w:outlineLvl", "w:pageBreakBefore", "w:rPr", "w:sectPr", "w:pPrChange"]) pp.delete(k);
  const markR = fixFonts(mergeProps(rr, children(el(pPrXml, "w:rPr"))), S); // bo'sh qator balandligi uchun

  // bo'laklar: matnli run'lar va boshqalar (rasm, tab)
  const runs = (p.match(/<w:r\b[^>]*\/>|<w:r(?=[\s>])[\s\S]*?<\/w:r>/g) || []).map((r) => {
    const rp = fixFonts(mergeProps(rr, children(el(r, "w:rPr"))), S);
    rp.delete("w:rStyle");
    const drawing = el(r, "w:drawing");
    const br = /<w:br\b(?![^>]*w:type="page")[^>]*\/>/.test(r);
    const text = drawing ? null : unxml([...r.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => (m[1] == null ? "\t" : m[1])).join(""));
    return { rp, drawing, br, text };
  });
  // {BELGI} almashtirish — matnli bo'laklar ketma-ketligi bo'yicha
  const full = runs.map((r) => r.text || "").join("");
  const reps = [];
  for (const m of full.matchAll(/\{\s*([A-Za-z_]+)\s*\}/g)) {
    const key = m[1].toUpperCase();
    if (!(key in vals)) continue;
    let val = vals[key] == null || vals[key] === "" ? BLANK : String(vals[key]);
    const next = full[m.index + m[0].length];
    if (val !== BLANK && next && /[\p{L}\d]/u.test(next)) val += " "; // "{fan_nomi}fanidan" -> "Fizika fanidan"
    reps.push({ s: m.index, e: m.index + m[0].length, val });
  }
  let pos = 0;
  for (const r of runs) {
    if (r.text == null) continue;
    let out = "";
    for (let i = 0; i < r.text.length; i++, pos++) {
      const rep = reps.find((x) => pos >= x.s && pos < x.e);
      if (!rep) out += r.text[i];
      else if (pos === rep.s) out += rep.val;
    }
    r.text = out;
  }
  return { pp, markR, runs, text: runs.map((r) => r.text || "").join("") };
}

// Rasm: rId -> fayl (media)
function drawingImage(drawing, relMap) {
  const rid = /r:embed="([^"]+)"/.exec(drawing);
  const ext = /<wp:extent cx="(\d+)" cy="(\d+)"/.exec(drawing);
  return rid && relMap[rid[1]] ? { rid: rid[1], target: relMap[rid[1]], cx: ext ? +ext[1] : 0, cy: ext ? +ext[2] : 0 } : null;
}

async function pageFor(id, v) {
  const P = await load();
  const page = P.pages.get(id);
  if (!page) return null;
  const vals = valuesFor(v);
  const paras = page.paras.map((p) => bakeParagraph(p.replace(/<w:br w:type="page"\/>/g, "").replace(/<w:lastRenderedPageBreak\/>/g, ""), P.S, vals));
  return { P, page, paras };
}

/* ---------------- Word: tayyor hujjat boshiga qo'shish ---------------- */
const CT = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", emf: "image/x-emf", wmf: "image/x-wmf", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff" };
async function prependDocx(buf, id, v) {
  const t = await pageFor(id, v);
  if (!t) return buf;
  const zip = await JSZip.loadAsync(buf);
  let doc = await zip.file("word/document.xml").async("string");
  let rels = await zip.file("word/_rels/document.xml.rels").async("string");
  let types = await zip.file("[Content_Types].xml").async("string");
  const ridMap = {};
  let n = 0;
  const xmlParas = [];
  for (let i = 0; i < t.paras.length; i++) {
    const p = t.paras[i];
    const runsXml = await Promise.all(p.runs.map(async (r) => {
      const rPr = `<w:rPr>${ordered(r.rp, R_ORDER)}</w:rPr>`;
      if (r.drawing) {
        const img = drawingImage(r.drawing, t.P.relMap);
        if (!img) return "";
        if (!ridMap[img.rid]) {
          const src = "word/" + img.target.replace(/^\/?word\//, "").replace(/^\//, "");
          const file = t.P.zip.file(src);
          if (!file) return "";
          const ext = (src.split(".").pop() || "png").toLowerCase();
          const name = `titul_${++n}.${ext}`;
          zip.file(`word/media/${name}`, await file.async("nodebuffer"));
          ridMap[img.rid] = `rIdTitul${n}`;
          rels = rels.replace("</Relationships>", `<Relationship Id="rIdTitul${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/></Relationships>`);
          if (CT[ext] && !new RegExp(`Extension="${ext}"`, "i").test(types)) types = types.replace(/(<Types[^>]*>)/, `$1<Default Extension="${ext}" ContentType="${CT[ext]}"/>`);
        }
        const d = r.drawing.replace(/r:embed="[^"]+"/, `r:embed="${ridMap[img.rid]}"`).replace(/\s(?:wp14|w14):\w+="[^"]*"/g, "");
        return `<w:r>${rPr}${d}</w:r>`;
      }
      if (r.br) return `<w:r>${rPr}<w:br/></w:r>`;
      if (!r.text) return "";
      return r.text.split("\t").map((s, j) => `${j ? `<w:r>${rPr}<w:tab/></w:r>` : ""}${s ? `<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(s)}</w:t></w:r>` : ""}`).join("");
    }));
    // oxirgi paragraf — titul bo'limi tugaydi (ramka faqat titulda; keyingi sahifalar o'z sozlamasi bilan)
    const last = i === t.paras.length - 1;
    const sect = last ? sectionXml(t.P.sectPr) : "";
    xmlParas.push(`<w:p><w:pPr>${ordered(p.pp, P_ORDER)}<w:rPr>${ordered(p.markR, R_ORDER)}</w:rPr>${sect}</w:pPr>${runsXml.join("")}</w:p>`);
  }
  // kerakli nomlar fazolari (wp, a, pic ...) hujjat ildizida bo'lsin
  const rootEnd = doc.indexOf(">", doc.indexOf("<w:document"));
  let root = doc.slice(0, rootEnd);
  const srcRoot = t.P.doc.slice(t.P.doc.indexOf("<w:document"), t.P.doc.indexOf(">", t.P.doc.indexOf("<w:document")));
  for (const m of srcRoot.matchAll(/xmlns:(\w+)="([^"]+)"/g)) if (!new RegExp(`xmlns:${m[1]}=`).test(root)) root += ` xmlns:${m[1]}="${m[2]}"`;
  for (const [pre, uri] of [["wp", "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"], ["a", "http://schemas.openxmlformats.org/drawingml/2006/main"], ["pic", "http://schemas.openxmlformats.org/drawingml/2006/picture"], ["r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships"]]) {
    if (!new RegExp(`xmlns:${pre}=`).test(root)) root += ` xmlns:${pre}="${uri}"`;
  }
  doc = root + doc.slice(rootEnd);
  doc = doc.replace("<w:body>", `<w:body>${xmlParas.join("")}`);
  zip.file("word/document.xml", doc);
  zip.file("word/_rels/document.xml.rels", rels);
  zip.file("[Content_Types].xml", types);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
function sectionXml(sectPr) {
  const keep = ["w:pgSz", "w:pgMar", "w:pgBorders", "w:cols", "w:docGrid"].map((k) => el(sectPr, k)).filter(Boolean).join("");
  return `<w:sectPr>${keep}</w:sectPr>`;
}

/* ---------------- PDF: HTML ko'rinishi ---------------- */
const tw = (v) => Number(v || 0) / 20; // twip -> pt
function runCss(rp) {
  const a = (k) => (rp.has(k) ? attrs(rp.get(k).replace(/^<[\w:]+/, "")) : null);
  const on = (k) => rp.has(k) && !/w:val="(0|false)"/.test(rp.get(k));
  const font = a("w:rFonts");
  const sz = a("w:sz");
  const color = a("w:color");
  const u = a("w:u");
  return [
    font && font["w:ascii"] ? `font-family:'${font["w:ascii"]}','Tinos','Times New Roman',serif` : "",
    sz ? `font-size:${Number(sz["w:val"]) / 2}pt` : "",
    // har doim aniq: aks holda paragraf belgisining (qalin va h.k.) xossasi meros bo'lib o'tadi
    on("w:b") ? "font-weight:700" : "font-weight:400",
    on("w:i") ? "font-style:italic" : "font-style:normal",
    on("w:caps") ? "text-transform:uppercase" : "text-transform:none",
    u && u["w:val"] !== "none" ? "text-decoration:underline" : "text-decoration:none",
    color && /^[0-9A-Fa-f]{6}$/.test(color["w:val"]) ? `color:#${color["w:val"]}` : "",
  ].filter(Boolean).join(";");
}
function paraCss(pp, markR) {
  const a = (k) => (pp.has(k) ? attrs(pp.get(k).replace(/^<[\w:]+/, "")) : {});
  const sp = a("w:spacing");
  const ind = a("w:ind");
  const jc = a("w:jc")["w:val"];
  const sz = markR.has("w:sz") ? Number(attrs(markR.get("w:sz"))["w:val"]) / 2 : 11;
  let lh = "1.15";
  if (sp["w:line"]) lh = sp["w:lineRule"] === "exact" || sp["w:lineRule"] === "atLeast" ? `${tw(sp["w:line"])}pt` : String(+(Number(sp["w:line"]) / 240 * 1.15).toFixed(3));
  return [
    `margin:${tw(sp["w:before"])}pt ${tw(ind["w:right"] || ind["w:end"])}pt ${tw(sp["w:after"])}pt ${tw(ind["w:left"] || ind["w:start"])}pt`,
    ind["w:firstLine"] ? `text-indent:${tw(ind["w:firstLine"])}pt` : ind["w:hanging"] ? `text-indent:-${tw(ind["w:hanging"])}pt` : "",
    `text-align:${{ center: "center", right: "right", end: "right", both: "justify", distribute: "justify" }[jc] || "left"}`,
    `line-height:${lh}`, `font-size:${sz}pt`, runCss(markR),
  ].filter(Boolean).join(";");
}
async function pageHtml(id, v) {
  const t = await pageFor(id, v);
  if (!t) return "";
  const out = [];
  for (const p of t.paras) {
    const runs = [];
    for (const r of p.runs) {
      if (r.drawing) {
        const img = drawingImage(r.drawing, t.P.relMap);
        const file = img && t.P.zip.file("word/" + img.target.replace(/^\/?word\//, "").replace(/^\//, ""));
        if (!file) continue;
        const ext = (img.target.split(".").pop() || "png").toLowerCase();
        runs.push(`<img src="data:${CT[ext] || "image/png"};base64,${(await file.async("nodebuffer")).toString("base64")}" style="width:${img.cx / 12700}pt;height:${img.cy / 12700}pt;vertical-align:bottom">`);
      } else if (r.br) runs.push("<br>");
      else if (r.text) runs.push(`<span style="${runCss(r.rp)}">${xmlEsc(r.text).replace(/\t/g, "&emsp;&emsp;")}</span>`);
    }
    out.push(`<div style="${paraCss(p.pp, p.markR)}">${runs.join("") || "&nbsp;"}</div>`);
  }
  // sahifa: o'lcham, chekkalar va ramka (pgBorders) — asl Word sozlamasidan
  const s = t.P.sectPr;
  const sz = attrs(el(s, "w:pgSz") || "");
  const mar = attrs(el(s, "w:pgMar") || "");
  const pb = el(s, "w:pgBorders");
  let frame = "";
  if (pb) {
    const top = attrs(el(pb, "w:top") || "");
    const off = /offsetFrom="page"/.test(pb) ? Number(top["w:space"] || 24) : 24;
    const w = Math.max(1.5, Number(top["w:sz"] || 12) / 8);
    frame = `<div style="position:absolute;inset:${off}pt;border:${w * 1.6}pt double #000;pointer-events:none"></div>`;
  }
  return `<section class="titul" style="position:relative;width:${tw(sz["w:w"] || 11906)}pt;height:${tw(sz["w:h"] || 16838)}pt;padding:${tw(mar["w:top"])}pt ${tw(mar["w:right"])}pt ${tw(mar["w:bottom"])}pt ${tw(mar["w:left"])}pt;overflow:hidden;white-space:pre-wrap;break-after:page;font-family:'Times New Roman','Tinos',serif;line-height:1.15">${frame}${out.join("")}</section>`;
}
// blocksToHtml natijasiga titulni birinchi sahifa qilib qo'shish (u sahifa chekkasiz)
async function prependHtml(html, id, v) {
  const page = await pageHtml(id, v);
  if (!page) return html;
  return html.replace("</style>", "@page:first{margin:0}\n.titul,.titul *{box-sizing:border-box}\n</style>").replace(/<body>/, `<body>${page}`);
}

module.exports = { canTitul, list, load, pageFor, prependDocx, prependHtml, pageHtml, slug };
