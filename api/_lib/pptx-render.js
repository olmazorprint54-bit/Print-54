// api/_lib/pptx-render.js
// ---------------------------------------------------------------
// PowerPoint (.pptx) -> HTML (har bir slayd — mutlaq joylashtirilgan sahifa).
// HTML ni api/resume-pdf.js dagi Chrome PDF qiladi. AI ham, LibreOffice ham yo'q:
// .pptx — zip ichidagi XML; slayd, maket (layout), master va tema o'qiladi.
// Qo'llab-quvvatlanadi: fon (rang, gradient, rasm), shakllar (oddiy va erkin chizilgan),
// rasmlar (qirqish bilan), matn (shrift, o'lcham, rang, abzats, ro'yxat), guruhlar,
// jadvallar, aylantirish/aks ettirish. Diagramma, SmartArt, animatsiya, soya — yo'q.
// ---------------------------------------------------------------
const path = require("path");
const JSZip = require("jszip");
const { DOMParser } = require("@xmldom/xmldom");

const EMU = 9525; // 1 px = 9525 EMU (96 dpi)
const PT = 96 / 72;
const LH = 1.2;   // PowerPoint'da 100% qator oralig'i ~ shrift o'lchamining 1.2 baravari

/* ---------------- XML yordamchilari ---------------- */
const parse = (s) => new DOMParser({ errorHandler: () => {} }).parseFromString(s, "text/xml").documentElement;
const kids = (el) => (el ? Array.from(el.childNodes).filter((n) => n.nodeType === 1) : []);
const ch = (el, ln) => kids(el).find((n) => n.localName === ln) || null;
const chs = (el, ln) => kids(el).filter((n) => n.localName === ln);
const at = (el, name, d) => (el && el.hasAttribute(name) ? el.getAttribute(name) : d);
const num = (el, name, d) => { const v = parseFloat(at(el, name)); return Number.isFinite(v) ? v : d; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f2 = (n) => Math.round(n * 100) / 100;
const on = (v) => v === "1" || v === "true";
const walk = (el, ln, out = []) => { for (const k of kids(el)) { if (k.localName === ln) out.push(k); walk(k, ln, out); } return out; };

/* ---------------- paket ---------------- */
async function openPackage(buf) {
  let zip;
  try { zip = await JSZip.loadAsync(buf); } catch (e) { throw new Error("zip"); }
  const text = async (p) => { const f = zip.file(p.replace(/^\//, "")); return f ? f.async("string") : null; };
  const xml = async (p) => { const t = await text(p); return t ? parse(t) : null; };
  const rels = async (p) => {
    const dir = path.posix.dirname(p), base = path.posix.basename(p);
    const t = await text(`${dir}/_rels/${base}.rels`);
    const map = {};
    if (!t) return map;
    for (const r of kids(parse(t))) {
      const tgt = at(r, "Target", "");
      map[at(r, "Id")] = { type: at(r, "Type", "").split("/").pop(), target: /^https?:/.test(tgt) ? tgt : tgt.startsWith("/") ? tgt.slice(1) : path.posix.normalize(`${dir}/${tgt}`) };
    }
    return map;
  };
  return { zip, text, xml, rels };
}

/* ---------------- rang ---------------- */
function hexToHsl(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  let r, g, b;
  if (s === 0) r = g = b = l;
  else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
  return [r, g, b].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0")).join("");
}
const PRESET_CLR = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080", grey: "808080", orange: "FFA500", purple: "800080" };

// Rang elementi (srgbClr / schemeClr / sysClr / prstClr) -> {hex, a}
function colorOf(el, env) {
  const c = kids(el).find((k) => /Clr$/.test(k.localName));
  if (!c) return null;
  let hex, a = 1;
  const v = at(c, "val", "");
  if (c.localName === "srgbClr") hex = v.toUpperCase().padStart(6, "0");
  else if (c.localName === "sysClr") hex = at(c, "lastClr", v === "window" ? "FFFFFF" : "000000").toUpperCase();
  else if (c.localName === "prstClr") hex = PRESET_CLR[v] || "000000";
  else if (c.localName === "schemeClr") {
    let n = v;
    if (n === "phClr") n = env.phClr || "accent1";
    n = (env.clrMap && env.clrMap[n]) || n;
    hex = (env.theme.colors[n] || "000000").toUpperCase();
  } else return null;
  for (const t of kids(c)) {
    const x = num(t, "val", 0) / 100000;
    if (t.localName === "alpha") a = x;
    else if (t.localName === "alphaMod") a *= x;
    else if (t.localName === "lumMod" || t.localName === "lumOff" || t.localName === "satMod" || t.localName === "satOff") {
      const [h, s, l] = hexToHsl(hex);
      hex = hslToHex(h, t.localName === "satMod" ? Math.min(1, s * x) : t.localName === "satOff" ? Math.min(1, s + x) : s, t.localName === "lumMod" ? l * x : t.localName === "lumOff" ? Math.min(1, l + x) : l);
    } else if (t.localName === "tint") {
      hex = [0, 2, 4].map((i) => Math.round(255 - (255 - parseInt(hex.slice(i, i + 2), 16)) * x).toString(16).padStart(2, "0")).join("");
    } else if (t.localName === "shade") {
      hex = [0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * x).toString(16).padStart(2, "0")).join("");
    }
  }
  return { hex, a };
}
const css = (c) => (c ? (c.a < 1 ? `rgba(${parseInt(c.hex.slice(0, 2), 16)},${parseInt(c.hex.slice(2, 4), 16)},${parseInt(c.hex.slice(4, 6), 16)},${f2(c.a)})` : "#" + c.hex) : "");

/* ---------------- tema / shriftlar ---------------- */
function readTheme(doc) {
  const colors = {}, fonts = { major: "Calibri", minor: "Calibri" };
  if (doc) {
    const cs = walk(doc, "clrScheme")[0];
    for (const k of kids(cs)) {
      const c = kids(k)[0];
      if (c) colors[k.localName] = (c.localName === "sysClr" ? at(c, "lastClr", "000000") : at(c, "val", "000000")).toUpperCase();
    }
    const fs = walk(doc, "fontScheme")[0];
    const mj = fs && ch(ch(fs, "majorFont"), "latin"), mn = fs && ch(ch(fs, "minorFont"), "latin");
    if (mj) fonts.major = at(mj, "typeface", "Calibri");
    if (mn) fonts.minor = at(mn, "typeface", "Calibri");
  }
  return { colors, fonts };
}
// PowerPoint shriftlari -> o'lchamdosh ochiq (Google Fonts) analoglari
const FONT_ALIAS = {
  calibri: "Carlito", arial: "Arimo", "times new roman": "Tinos", cambria: "Caladea", "courier new": "Cousine", helvetica: "Arimo",
  "segoe ui": "Noto Sans", verdana: "Noto Sans", tahoma: "Noto Sans", "trebuchet ms": "Fira Sans", georgia: "Gelasio", impact: "Anton",
  "century gothic": "Questrial", "gill sans mt": "Lato", "franklin gothic book": "Libre Franklin", garamond: "EB Garamond", "palatino linotype": "Crimson Text",
  "book antiqua": "Crimson Text", "comic sans ms": "Comic Neue", "arial narrow": "Arimo", rockwell: "Arvo", "bookman old style": "Bree Serif",
};
const fontsUsed = new Set();
function fontFamily(name) {
  if (!name) return "";
  const alias = FONT_ALIAS[name.toLowerCase()];
  fontsUsed.add(alias || name);
  return `'${name.replace(/['"]/g, "")}',${alias ? `'${alias}',` : ""}'Arimo','Noto Sans',sans-serif`;
}

/* ---------------- media ---------------- */
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp" };

/* ---------------- uslub zanjiri ---------------- */
// Daraja xossalari: lvlNpPr elementlari ro'yxatidan birlashtirilgan xossalar (keyingisi ustun)
function mergeLevel(list) {
  const out = { attrs: {}, kids: {}, def: { attrs: {}, kids: {} } };
  for (const p of list) {
    if (!p) continue;
    for (const a of Array.from(p.attributes || [])) out.attrs[a.name] = a.value;
    for (const k of kids(p)) {
      if (k.localName === "defRPr") {
        for (const a of Array.from(k.attributes || [])) out.def.attrs[a.name] = a.value;
        for (const d of kids(k)) out.def.kids[d.localName] = d;
      } else if (/^bu(None|Char|AutoNum|Blip)$/.test(k.localName)) {
        for (const b of ["buNone", "buChar", "buAutoNum", "buBlip"]) delete out.kids[b];
        out.kids[k.localName] = k;
      } else out.kids[k.localName] = k;
    }
  }
  return out;
}
const lvlEl = (styleEl, n) => (styleEl ? ch(styleEl, `lvl${n}pPr`) : null);

/* ---------------- shakl geometriyasi ---------------- */
function presetSvg(prst, w, h, adj) {
  const A = (n, d) => (adj[n] !== undefined ? adj[n] : d);
  const s = Math.min(w, h);
  const poly = (pts) => `<polygon points="${pts.map((p) => p.map(f2).join(",")).join(" ")}"/>`;
  switch (prst) {
    case "ellipse": return `<ellipse cx="${f2(w / 2)}" cy="${f2(h / 2)}" rx="${f2(w / 2)}" ry="${f2(h / 2)}"/>`;
    case "roundRect": { const r = (s * A("adj", 16667)) / 100000; return `<rect width="${f2(w)}" height="${f2(h)}" rx="${f2(r)}"/>`; }
    case "round2SameRect": { const r = (s * A("adj1", 16667)) / 100000; return `<path d="M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h} H0 V${r} A${r},${r} 0 0 1 ${r},0 Z"/>`; }
    case "triangle": return poly([[(w * A("adj", 50000)) / 100000, 0], [w, h], [0, h]]);
    case "rtTriangle": return poly([[0, 0], [w, h], [0, h]]);
    case "diamond": return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case "parallelogram": { const o = (s * A("adj", 25000)) / 100000; return poly([[o, 0], [w, 0], [w - o, h], [0, h]]); }
    case "trapezoid": { const o = (s * A("adj", 25000)) / 100000; return poly([[o, 0], [w - o, 0], [w, h], [0, h]]); }
    case "pentagon": case "homePlate": { const o = (s * A("adj", 50000)) / 100000; return poly([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h]]); }
    case "chevron": { const o = (s * A("adj", 50000)) / 100000; return poly([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h], [o, h / 2]]); }
    case "hexagon": { const o = (s * A("adj", 25000)) / 100000; return poly([[o, 0], [w - o, 0], [w, h / 2], [w - o, h], [o, h], [0, h / 2]]); }
    case "octagon": { const o = (s * A("adj", 29289)) / 100000; return poly([[o, 0], [w - o, 0], [w, o], [w, h - o], [w - o, h], [o, h], [0, h - o], [0, o]]); }
    case "rightArrow": { const hh = (h * A("adj1", 50000)) / 100000, hl = (s * A("adj2", 50000)) / 100000, y0 = (h - hh) / 2; return poly([[0, y0], [w - hl, y0], [w - hl, 0], [w, h / 2], [w - hl, h], [w - hl, y0 + hh], [0, y0 + hh]]); }
    case "leftArrow": { const hh = (h * A("adj1", 50000)) / 100000, hl = (s * A("adj2", 50000)) / 100000, y0 = (h - hh) / 2; return poly([[w, y0], [hl, y0], [hl, 0], [0, h / 2], [hl, h], [hl, y0 + hh], [w, y0 + hh]]); }
    case "plus": { const o = (s * A("adj", 25000)) / 100000; return poly([[o, 0], [w - o, 0], [w - o, o], [w, o], [w, h - o], [w - o, h - o], [w - o, h], [o, h], [o, h - o], [0, h - o], [0, o], [o, o]]); }
    case "star5": { const pts = []; for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * Math.PI / 180, r = i % 2 ? 0.38 : 1; pts.push([w / 2 + (w / 2) * r * Math.cos(a), h / 2 + (h / 2) * r * Math.sin(a)]); } return poly(pts); }
    case "line": case "straightConnector1": case "bentConnector3": return `<line x1="0" y1="0" x2="${f2(w)}" y2="${f2(h)}"/>`;
    case "donut": { const t = (s * A("adj", 25000)) / 100000; return `<path fill-rule="evenodd" d="M0,${h / 2} a${w / 2},${h / 2} 0 1 0 ${w},0 a${w / 2},${h / 2} 0 1 0 ${-w},0 Z M${t},${h / 2} a${w / 2 - t},${h / 2 - t} 0 1 1 ${w - 2 * t},0 a${w / 2 - t},${h / 2 - t} 0 1 1 ${-(w - 2 * t)},0 Z"/>`; }
    default: return `<rect width="${f2(w)}" height="${f2(h)}"/>`;
  }
}
// Erkin chizilgan geometriya (custGeom) -> SVG yo'llar
function custSvg(geom, w, h, fillOk, strokeOk, dOnly) {
  const out = [];
  for (const p of kids(ch(geom, "pathLst"))) {
    const pw = num(p, "w", 0) || w, ph = num(p, "h", 0) || h;
    const sx = w / pw, sy = h / ph;
    let d = "", cx = 0, cy = 0;
    const P = (n) => [num(n, "x", 0) * sx, num(n, "y", 0) * sy];
    for (const c of kids(p)) {
      const pts = chs(c, "pt").map(P);
      if (c.localName === "moveTo" && pts[0]) { d += `M${f2(pts[0][0])},${f2(pts[0][1])} `; [cx, cy] = pts[0]; }
      else if (c.localName === "lnTo" && pts[0]) { d += `L${f2(pts[0][0])},${f2(pts[0][1])} `; [cx, cy] = pts[0]; }
      else if (c.localName === "cubicBezTo" && pts.length >= 3) { d += `C${pts.slice(0, 3).map((q) => q.map(f2).join(",")).join(" ")} `; [cx, cy] = pts[2]; }
      else if (c.localName === "quadBezTo" && pts.length >= 2) { d += `Q${pts.slice(0, 2).map((q) => q.map(f2).join(",")).join(" ")} `; [cx, cy] = pts[1]; }
      else if (c.localName === "arcTo") {
        const wr = num(c, "wR", 0) * sx, hr = num(c, "hR", 0) * sy, st = (num(c, "stAng", 0) / 60000) * Math.PI / 180, sw = (num(c, "swAng", 0) / 60000) * Math.PI / 180;
        if (wr > 0 && hr > 0) {
          const t1 = Math.atan2(wr * Math.sin(st), hr * Math.cos(st)); // ko'rinish burchagi -> parametrik
          const t2 = Math.atan2(wr * Math.sin(st + sw), hr * Math.cos(st + sw));
          const ox = cx - wr * Math.cos(t1), oy = cy - hr * Math.sin(t1);
          const ex = ox + wr * Math.cos(t2), ey = oy + hr * Math.sin(t2);
          d += `A${f2(wr)},${f2(hr)} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${f2(ex)},${f2(ey)} `;
          cx = ex; cy = ey;
        }
      } else if (c.localName === "close") d += "Z ";
    }
    if (d && dOnly) out.push(d.trim());
    else if (d) out.push(`<path d="${d.trim()}"${at(p, "fill") === "none" || !fillOk ? ' fill="none"' : ""}${at(p, "stroke") === "0" || !strokeOk ? ' stroke="none"' : ""}/>`);
  }
  return dOnly ? out.join(" ") : out.join("");
}

/* ---------------- asosiy konvertor ---------------- */
async function pptxToHtml(buf) {
  const pkg = await openPackage(buf);
  const pres = await pkg.xml("ppt/presentation.xml");
  if (!pres) throw new Error("presentation");
  const presRels = await pkg.rels("ppt/presentation.xml");
  const sz = walk(pres, "sldSz")[0];
  const W = f2(num(sz, "cx", 9144000) / EMU), H = f2(num(sz, "cy", 6858000) / EMU);
  const defaultText = ch(pres, "defaultTextStyle");
  fontsUsed.clear();

  // media (rasm) -> CSS sinflar (bir marta)
  const classes = [];
  const mediaClass = {};
  const mediaOf = async (p) => {
    if (mediaClass[p] !== undefined) return mediaClass[p];
    const ext = p.split(".").pop().toLowerCase();
    const f = pkg.zip.file(p);
    if (!MIME[ext] || !f) return (mediaClass[p] = null);
    const b64 = await f.async("base64");
    classes.push(`.m${classes.length}{background-image:url("data:${MIME[ext]};base64,${b64}")}`);
    return (mediaClass[p] = `m${classes.length - 1}`);
  };

  const sldIds = walk(pres, "sldId");
  const slidesHtml = [];
  const cache = {};
  const loadPart = async (p) => {
    if (cache[p]) return cache[p];
    const doc = await pkg.xml(p);
    return (cache[p] = { doc, rels: doc ? await pkg.rels(p) : {} });
  };
  const themeCache = {};

  for (const sid of sldIds) {
    const rel = presRels[sid.getAttribute("r:id")];
    if (!rel) continue;
    const slide = await loadPart(rel.target);
    if (!slide.doc || at(slide.doc, "show") === "0") continue;
    const layoutRel = Object.values(slide.rels).find((r) => r.type === "slideLayout");
    const layout = layoutRel ? await loadPart(layoutRel.target) : { doc: null, rels: {} };
    const masterRel = Object.values(layout.rels).find((r) => r.type === "slideMaster");
    const master = masterRel ? await loadPart(masterRel.target) : { doc: null, rels: {} };
    const themeRel = Object.values(master.rels).find((r) => r.type === "theme");
    const theme = themeRel ? (themeCache[themeRel.target] = themeCache[themeRel.target] || readTheme(await pkg.xml(themeRel.target))) : readTheme(null);
    const clrMapEl = master.doc && walk(master.doc, "clrMap")[0];
    const clrMap = {};
    if (clrMapEl) for (const a of Array.from(clrMapEl.attributes)) clrMap[a.name] = a.value;
    const env = { theme, clrMap };
    const txStyles = master.doc && ch(master.doc, "txStyles");

    // yer egalari (placeholder) qidirish
    const phOf = (sp) => { const ph = walk(ch(sp, "nvSpPr") || ch(sp, "nvPicPr") || ch(sp, "nvGraphicFramePr") || sp, "ph")[0]; return ph ? { type: at(ph, "type", "body"), idx: at(ph, "idx") } : null; };
    const treeShapes = (doc) => { const t = doc && walk(doc, "spTree")[0]; return kids(t).filter((k) => ["sp", "pic", "grpSp", "graphicFrame", "cxnSp"].includes(k.localName)); };
    const layoutShapes = treeShapes(layout.doc), masterShapes = treeShapes(master.doc);
    const findLayout = (ph) => {
      let s = ph.idx !== undefined ? layoutShapes.find((x) => { const p = phOf(x); return p && p.idx === ph.idx; }) : null;
      if (!s) s = layoutShapes.find((x) => { const p = phOf(x); return p && p.type === ph.type; });
      return s || null;
    };
    const mType = (t) => (t === "ctrTitle" ? "title" : ["body", "subTitle", "obj", "tbl", "chart", "pic", "media"].includes(t) ? "body" : t);
    const findMaster = (ph) => { const t = mType(ph.type); return masterShapes.find((x) => { const p = phOf(x); return p && mType(p.type) === t; }) || null; };

    // fon
    const bgOf = async (doc, rels) => {
      const bg = doc && walk(doc, "bg")[0];
      if (!bg) return null;
      const pr = ch(bg, "bgPr");
      if (pr) return fillCss(pr, { ...env }, rels);
      const ref = ch(bg, "bgRef");
      if (ref) { const c = colorOf(ref, env); return c ? { css: css(c) } : null; }
      return null;
    };
    const fillCss = async (spPr, e, rels) => {
      const solid = ch(spPr, "solidFill");
      if (solid) { const c = colorOf(solid, e); return c ? { css: css(c), color: c } : null; }
      const grad = ch(spPr, "gradFill");
      if (grad) {
        const stops = kids(ch(grad, "gsLst")).map((g) => ({ pos: num(g, "pos", 0) / 1000, c: colorOf(g, e) })).filter((g) => g.c);
        if (!stops.length) return null;
        const lin = ch(grad, "lin");
        const list = stops.map((g) => `${css(g.c)} ${f2(g.pos)}%`).join(",");
        return { css: ch(grad, "path") ? `radial-gradient(circle at center,${list})` : `linear-gradient(${f2(((lin ? num(lin, "ang", 0) : 0) / 60000) + 90)}deg,${list})`, color: stops[0].c, isGrad: true };
      }
      const blip = ch(spPr, "blipFill");
      if (blip) {
        const b = ch(blip, "blip");
        const r = b && rels[at(b, "r:embed")];
        const cl = r && (await mediaOf(r.target));
        if (cl) return { image: cl, bf: blip };
      }
      if (ch(spPr, "noFill")) return { none: true };
      return null;
    };
    const imageStyle = (fill) => {
      let size = "100% 100%", pos = "0 0";
      const sr = fill.src;
      if (sr) {
        const l = num(sr, "l", 0) / 100000, t = num(sr, "t", 0) / 100000, r = num(sr, "r", 0) / 100000, b = num(sr, "b", 0) / 100000;
        const vw = 1 - l - r, vh = 1 - t - b;
        if (vw > 0 && vh > 0) { size = `${f2(100 / vw)}% ${f2(100 / vh)}%`; pos = `${vw < 1 ? f2((l / (1 - vw)) * 100) : 0}% ${vh < 1 ? f2((t / (1 - vh)) * 100) : 0}%`; }
      }
      return `background-size:${size};background-position:${pos};background-repeat:no-repeat;${fill.alpha < 1 ? `opacity:${fill.alpha};` : ""}`;
    };

    // Rasm qatlami: stretch/fillRect (shakl chegarasidan chiqishi mumkin) va srcRect (qirqish)
    const imgLayer = (bf, cl, w, h) => {
      const b = ch(bf, "blip");
      const am = b && walk(b, "alphaModFix")[0];
      const fr = ch(ch(bf, "stretch"), "fillRect");
      let L = 0, T = 0, BW = w, BH = h;
      if (fr) {
        const l = num(fr, "l", 0) / 100000, t = num(fr, "t", 0) / 100000, r = num(fr, "r", 0) / 100000, bt = num(fr, "b", 0) / 100000;
        L = l * w; T = t * h; BW = w * (1 - l - r); BH = h * (1 - t - bt);
      }
      return `<div class="sh ${cl}" style="left:${f2(L)}px;top:${f2(T)}px;width:${f2(BW)}px;height:${f2(BH)}px;${imageStyle({ src: ch(bf, "srcRect"), alpha: am ? num(am, "amt", 100000) / 100000 : 1 })}"></div>`;
    };
    // Shakl bo'yicha qirqish: erkin chizilgan -> clip-path, ellips/yumaloq to'rtburchak -> radius
    const clipCss = (geomEl, w, h) => {
      if (!geomEl) return "overflow:hidden;";
      if (geomEl.localName === "custGeom") { const d = custSvg(geomEl, w, h, true, true, true); return d ? `clip-path:path('${d}');` : "overflow:hidden;"; }
      const prst = at(geomEl, "prst", "rect");
      if (prst === "ellipse") return "border-radius:50%;overflow:hidden;";
      if (prst === "roundRect") { const g = ch(ch(geomEl, "avLst"), "gd"); const m = g && String(at(g, "fmla", "")).match(/val\s+(-?\d+)/); return `border-radius:${f2((Math.min(w, h) * (m ? parseInt(m[1], 10) : 16667)) / 100000)}px;overflow:hidden;`; }
      return "overflow:hidden;";
    };

    // chiziq (kontur)
    const lineOf = (spPr, e, style) => {
      const ln = spPr && ch(spPr, "ln");
      if (ln && ch(ln, "noFill")) return null;
      let c = ln && ch(ln, "solidFill") ? colorOf(ch(ln, "solidFill"), e) : null;
      if (!c && style && ch(style, "lnRef") && num(ch(style, "lnRef"), "idx", 0) > 0) c = colorOf(ch(style, "lnRef"), e);
      if (!c) return null;
      const w = ln && ln.hasAttribute("w") ? num(ln, "w", 12700) / EMU : style ? 1.33 : 1;
      const dash = ln && ch(ln, "prstDash") ? at(ch(ln, "prstDash"), "val") : null;
      return { color: css(c), w: Math.max(0.5, f2(w)), dash: dash && dash !== "solid" ? (dash.includes("sys") || dash === "dot" ? `${f2(w)},${f2(w * 2)}` : `${f2(w * 4)},${f2(w * 3)}`) : null };
    };

    // ---- matn ----
    const renderText = (txBody, ph, shapeEl, e, ownStyleList, boxW) => {
      const pType = ph ? ph.type : null;
      const styleKind = ph ? (pType === "title" || pType === "ctrTitle" ? "titleStyle" : ["dt", "ftr", "sldNum"].includes(pType) ? "otherStyle" : "bodyStyle") : null;
      const masterStyle = styleKind && txStyles ? ch(txStyles, styleKind) : null;
      const lay = ph ? findLayout(ph) : null, mas = ph ? findMaster(ph) : null;
      const lstOf = (s) => (s ? ch(ch(s, "txBody"), "lstStyle") : null);
      const bodyPr = ch(txBody, "bodyPr");
      const layBodyPr = lay && ch(ch(lay, "txBody"), "bodyPr"), masBodyPr = mas && ch(ch(mas, "txBody"), "bodyPr");
      const bp = (name, d) => (bodyPr && bodyPr.hasAttribute(name) ? at(bodyPr, name) : layBodyPr && layBodyPr.hasAttribute(name) ? at(layBodyPr, name) : masBodyPr && masBodyPr.hasAttribute(name) ? at(masBodyPr, name) : d);
      const fitEl = (bodyPr && ch(bodyPr, "normAutofit")) || (layBodyPr && ch(layBodyPr, "normAutofit")) || null;
      const fScale = fitEl ? num(fitEl, "fontScale", 100000) / 100000 : 1;
      const lnRed = fitEl ? num(fitEl, "lnSpcReduction", 0) / 100000 : 0;
      const inset = (n, d) => { const v = parseFloat(bp(n)); return (Number.isFinite(v) ? v : d) / EMU; };
      const pad = `${f2(inset("tIns", 45720))}px ${f2(inset("rIns", 91440))}px ${f2(inset("bIns", 45720))}px ${f2(inset("lIns", 91440))}px`;
      const anchor = bp("anchor", "t");
      const wrap = bp("wrap", "square") !== "none";
      const vert = bp("vert", "horz");
      const justify = anchor === "ctr" ? "center" : anchor === "b" ? "flex-end" : "flex-start";
      const chainOf = (lvl) => [lvlEl(defaultText, lvl), lvlEl(masterStyle, lvl), lvlEl(lstOf(mas), lvl), lvlEl(lstOf(lay), lvl), lvlEl(ch(txBody, "lstStyle"), lvl)];
      const counters = {};
      let html = "";
      let first = true;
      for (const p of chs(txBody, "p")) {
        const pPr = ch(p, "pPr");
        const lvl = Math.min(9, (num(pPr, "lvl", 0) | 0) + 1);
        const L = mergeLevel([...chainOf(lvl), pPr]);
        const algn = L.attrs.algn || "l";
        const marL = (parseFloat(L.attrs.marL) || 0) / EMU, indent = (parseFloat(L.attrs.indent) || 0) / EMU;
        const rEnv = { ...e };
        // abzats uchun asosiy shrift o'lchami (bo'sh abzats balandligi)
        const baseSz = (r) => { const v = parseFloat((r && r.sz) || L.def.attrs.sz); return Number.isFinite(v) ? v : 1800; };
        // runlar
        let runs = "", maxSize = 0, any = false;
        const runStyle = (rPr) => {
          const attrs = { ...L.def.attrs }, kd = { ...L.def.kids };
          if (rPr) { for (const a of Array.from(rPr.attributes)) attrs[a.name] = a.value; for (const k of kids(rPr)) kd[k.localName] = k; }
          const size = (parseFloat(attrs.sz) || 1800) * fScale;
          const px = (size / 100) * PT;
          let st = `font-size:${f2(px)}px;`;
          const clr = kd.solidFill ? colorOf(kd.solidFill, rEnv) : null;
          if (clr) st += `color:${css(clr)};`;
          else if (!kd.gradFill) st += "color:#000;";
          let face = kd.latin ? at(kd.latin, "typeface", "") : "";
          if (face.startsWith("+mj")) face = theme.fonts.major; else if (face.startsWith("+mn") || !face) face = theme.fonts.minor;
          if (face) st += `font-family:${fontFamily(face)};`;
          if (on(attrs.b)) st += "font-weight:700;";
          if (on(attrs.i)) st += "font-style:italic;";
          const dec = [attrs.u && attrs.u !== "none" ? "underline" : "", attrs.strike && attrs.strike !== "noStrike" ? "line-through" : ""].filter(Boolean).join(" ");
          if (dec) st += `text-decoration:${dec};`;
          if (attrs.cap === "all") st += "text-transform:uppercase;";
          if (attrs.cap === "small") st += "font-variant:small-caps;";
          if (attrs.spc) st += `letter-spacing:${f2((parseFloat(attrs.spc) / 100) * PT)}px;`;
          if (attrs.baseline && parseFloat(attrs.baseline) !== 0) st += `vertical-align:${parseFloat(attrs.baseline) > 0 ? "super" : "sub"};font-size:${f2(px * 0.65)}px;`;
          if (kd.highlight) { const hc = colorOf(kd.highlight, rEnv); if (hc) st += `background:${css(hc)};`; }
          return { st, px };
        };
        for (const r of kids(p)) {
          if (r.localName === "r" || r.localName === "fld") {
            const t = ch(r, "t");
            const txt = t ? t.textContent : "";
            const rs = runStyle(ch(r, "rPr"));
            maxSize = Math.max(maxSize, rs.px);
            if (txt === "") continue;
            any = true;
            runs += `<span style="${rs.st}">${esc(txt).replace(/\u000b/g, "<br>").replace(/ {2}/g, " &nbsp;")}</span>`;
          } else if (r.localName === "br") {
            const rs = runStyle(ch(r, "rPr"));
            maxSize = Math.max(maxSize, rs.px);
            runs += `<br>`;
          }
        }
        const endPx = runStyle(ch(p, "endParaRPr")).px;
        const sizePx = maxSize || endPx;
        // qator oralig'i
        let lh = LH;
        const ls = L.kids.lnSpc;
        if (ls) { const pc = ch(ls, "spcPct"), pt = ch(ls, "spcPts"); if (pc) lh = (num(pc, "val", 100000) / 100000) * LH; else if (pt) lh = ((num(pt, "val", 1200) / 100) * PT) / sizePx; }
        lh = Math.max(0.6, lh - lnRed * LH);
        const sp = (k) => { const el = L.kids[k]; if (!el) return 0; const pt = ch(el, "spcPts"), pc = ch(el, "spcPct"); return pt ? (num(pt, "val", 0) / 100) * PT : pc ? (num(pc, "val", 0) / 100000) * sizePx * LH : 0; };
        // ro'yxat belgisi
        let bullet = "";
        const bu = L.kids;
        if (!bu.buNone && (bu.buChar || bu.buAutoNum) && any) {
          const bw = Math.max(12, -indent);
          let mark = "";
          if (bu.buChar) mark = at(bu.buChar, "char", "•");
          else {
            const key = `${lvl}`;
            counters[key] = (counters[key] || 0) + (bu.buAutoNum && at(bu.buAutoNum, "startAt") && !counters[key] ? parseInt(at(bu.buAutoNum, "startAt"), 10) : 1);
            for (let k = lvl + 1; k <= 9; k++) delete counters[`${k}`];
            const n = counters[key];
            const t = at(bu.buAutoNum, "type", "arabicPeriod");
            mark = /alphaLc/.test(t) ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : /alphaUc/.test(t) ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : /romanLc/.test(t) ? roman(n).toLowerCase() : /romanUc/.test(t) ? roman(n) : String(n);
            mark += /ParenBoth/.test(t) ? ")" : /ParenR/.test(t) ? ")" : /Period/.test(t) ? "." : "";
            if (/ParenBoth/.test(t)) mark = "(" + mark;
          }
          const bc = bu.buClr ? colorOf(bu.buClr, rEnv) : null;
          const bf = bu.buFont ? at(bu.buFont, "typeface", "") : "";
          const bs = bu.buSzPct ? num(bu.buSzPct, "val", 100000) / 100000 : 1;
          const symbolFont = /wingdings|symbol/i.test(bf);
          bullet = `<span style="display:inline-block;min-width:${f2(bw)}px;text-indent:0;${bc ? `color:${css(bc)};` : ""}font-size:${f2(sizePx * bs)}px;${bf && !symbolFont ? `font-family:${fontFamily(bf)};` : ""}">${esc(symbolFont ? "•" : mark)}</span>`;
        } else if (!any && !runs.includes("<br>")) runs = "";
        const before = first ? 0 : sp("spcBef"), after = sp("spcAft");
        first = false;
        const textAlign = { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" }[algn] || "left";
        const body = runs || `<span style="font-size:${f2(sizePx)}px">&#8203;</span>`;
        html += `<div class="p" style="margin:${f2(before)}px 0 ${f2(after)}px 0;padding-left:${f2(marL + (indent > 0 ? indent : 0))}px;text-indent:${f2(indent < 0 ? indent : 0)}px;text-align:${textAlign};line-height:${f2(lh)};${wrap ? "" : "white-space:nowrap;"}">${bullet}${body}</div>`;
      }
      const wm = vert === "vert" ? "writing-mode:vertical-rl;" : vert === "vert270" ? "writing-mode:vertical-rl;transform:rotate(180deg);" : "";
      return `<div class="tx" style="padding:${pad};justify-content:${justify};${wm}">${html}</div>`;
    };
    const roman = (n) => { const m = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let s = ""; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };

    // ---- shakllar ----
    const xfrmOf = (spPr) => {
      const x = spPr && ch(spPr, "xfrm");
      if (!x) return null;
      const off = ch(x, "off"), ext = ch(x, "ext");
      if (!off || !ext) return null;
      return { x: num(off, "x", 0), y: num(off, "y", 0), cx: num(ext, "cx", 0), cy: num(ext, "cy", 0), rot: num(x, "rot", 0) / 60000, flipH: on(at(x, "flipH")), flipV: on(at(x, "flipV")) };
    };
    const renderShape = async (el, ctx, e, rels, isSlide) => {
      const ln0 = el.localName;
      if (ln0 === "grpSp") {
        const grp = ch(el, "grpSpPr");
        const x = grp && ch(grp, "xfrm");
        if (!x) return "";
        const off = ch(x, "off"), ext = ch(x, "ext"), co = ch(x, "chOff"), ce = ch(x, "chExt");
        const gx = num(off, "x", 0), gy = num(off, "y", 0), gcx = num(ext, "cx", 0), gcy = num(ext, "cy", 0);
        const cox = num(co, "x", 0), coy = num(co, "y", 0), cecx = num(ce, "cx", gcx) || gcx, cecy = num(ce, "cy", gcy) || gcy;
        const left = gx * ctx.fx + ctx.ox, top = gy * ctx.fy + ctx.oy, w = gcx * ctx.fx, h = gcy * ctx.fy;
        const inner = { fx: w / cecx, fy: h / cecy, ox: -cox * (w / cecx), oy: -coy * (h / cecy) };
        let out = "";
        for (const k of kids(el)) if (["sp", "pic", "grpSp", "graphicFrame", "cxnSp"].includes(k.localName)) out += await renderShape(k, inner, e, rels, isSlide);
        const rot = num(x, "rot", 0) / 60000;
        return `<div class="g" style="left:${f2(left)}px;top:${f2(top)}px;width:${f2(w)}px;height:${f2(h)}px;${rot ? `transform:rotate(${f2(rot)}deg);` : ""}">${out}</div>`;
      }
      const nv = ch(el, "nvSpPr") || ch(el, "nvPicPr") || ch(el, "nvGraphicFramePr") || ch(el, "nvCxnSpPr");
      const cNv = nv && ch(nv, "cNvPr");
      if (cNv && on(at(cNv, "hidden"))) return "";
      const ph = isSlide || ctx.layoutLevel ? phOf(el) : null;
      let spPr = ch(el, "spPr");
      const layEl = ph && isSlide ? findLayout(ph) : null;
      const masEl = ph ? (isSlide ? findMaster(ph) : null) : null;
      let xf = xfrmOf(spPr) || (layEl && xfrmOf(ch(layEl, "spPr"))) || (masEl && xfrmOf(ch(masEl, "spPr")));
      if (ln0 === "graphicFrame") {
        const gx = ch(el, "xfrm");
        if (gx) { const off = ch(gx, "off"), ext = ch(gx, "ext"); xf = { x: num(off, "x", 0), y: num(off, "y", 0), cx: num(ext, "cx", 0), cy: num(ext, "cy", 0), rot: 0, flipH: false, flipV: false }; }
      }
      if (!xf) return "";
      const left = xf.x * ctx.fx + ctx.ox, top = xf.y * ctx.fy + ctx.oy, w = xf.cx * ctx.fx, h = xf.cy * ctx.fy;
      const pos = `left:${f2(left)}px;top:${f2(top)}px;width:${f2(w)}px;height:${f2(h)}px;`;
      const rot = xf.rot ? `rotate(${f2(xf.rot)}deg)` : "";
      const flip = `${xf.flipH ? "scaleX(-1)" : ""}${xf.flipV ? " scaleY(-1)" : ""}`.trim();
      const style = ch(el, "style");

      if (ln0 === "graphicFrame") {
        const tbl = walk(el, "tbl")[0];
        if (!tbl) return ""; // diagramma, SmartArt — qo'llab-quvvatlanmaydi
        return `<div class="sh" style="${pos}${rot ? `transform:${rot};` : ""}">${await renderTable(tbl, w, h, e, ctx)}</div>`;
      }

      if (ln0 === "pic") {
        const blip = ch(ch(el, "blipFill"), "blip");
        const r = blip && rels[at(blip, "r:embed")];
        const cl = r && (await mediaOf(r.target));
        if (!cl) return "";
        const bf = ch(el, "blipFill");
        const geom = spPr && (ch(spPr, "custGeom") || ch(spPr, "prstGeom"));
        const lnE = lineOf(spPr, e, null);
        return `<div class="sh" style="${pos}${clipCss(geom, w, h)}transform:${[rot, flip].filter(Boolean).join(" ") || "none"};${lnE ? `outline:${lnE.w}px solid ${lnE.color};outline-offset:-${lnE.w / 2}px;` : ""}">${imgLayer(bf, cl, w, h)}</div>`;
      }

      // sp / cxnSp
      const geom = spPr && (ch(spPr, "prstGeom") || ch(spPr, "custGeom"));
      const layGeom = !geom && layEl && ch(ch(layEl, "spPr"), "prstGeom");
      const gEl = geom || layGeom;
      const fillEnv = { ...e, phClr: style && ch(style, "fillRef") ? (() => { const c = kids(ch(style, "fillRef")).find((k) => /Clr$/.test(k.localName)); return c && c.localName === "schemeClr" ? at(c, "val") : undefined; })() : undefined };
      let fill = spPr ? await fillCss(spPr, fillEnv, rels) : null;
      if (!fill && layEl) fill = await fillCss(ch(layEl, "spPr") || layEl, fillEnv, rels);
      if (!fill && masEl && masEl !== layEl) fill = await fillCss(ch(masEl, "spPr") || masEl, fillEnv, rels);
      if (!fill && style && ch(style, "fillRef") && num(ch(style, "fillRef"), "idx", 0) > 0 && ln0 === "sp") { const c = colorOf(ch(style, "fillRef"), fillEnv); if (c) fill = { css: css(c), color: c }; }
      const lnE = lineOf(spPr || (layEl && ch(layEl, "spPr")), e, style);
      let svg = "";
      const isLine = gEl && ch(spPr, "prstGeom") && /^(line|straightConnector1|bentConnector\d)$/.test(at(ch(spPr, "prstGeom"), "prst", ""));
      const hasFill = fill && !fill.none && (fill.css || fill.image);
      if (gEl && (hasFill || lnE)) {
        const sw = lnE ? lnE.w : 0;
        let inner = "", defs = "";
        if (gEl.localName === "custGeom") inner = custSvg(gEl, w, h, hasFill, !!lnE);
        else {
          const adj = {};
          for (const g of chs(ch(gEl, "avLst"), "gd")) { const m = String(at(g, "fmla", "")).match(/val\s+(-?\d+)/); if (m) adj[at(g, "name")] = parseInt(m[1], 10); }
          inner = presetSvg(at(gEl, "prst", "rect"), w, h, adj);
        }
        const fillAttr = hasFill && fill.css && !isLine ? css2svg(fill, defs) : "none";
        const grad = fill && fill.isGrad ? gradDef(fill.css, `g${uid++}`) : null;
        svg = `<svg class="sv" viewBox="0 0 ${f2(w)} ${f2(h)}" preserveAspectRatio="none" style="${flip ? `transform:${flip};` : ""}overflow:visible">${grad ? grad.def : ""}<g fill="${grad ? `url(#${grad.id})` : fillAttr}" ${lnE ? `stroke="${lnE.color}" stroke-width="${lnE.w}"${lnE.dash ? ` stroke-dasharray="${lnE.dash}"` : ""} stroke-linejoin="round"` : 'stroke="none"'}>${inner}</g></svg>`;
        if (fill && fill.image) svg = `<div class="sh" style="left:0;top:0;width:100%;height:100%;${clipCss(gEl, w, h)}">${imgLayer(fill.bf, fill.image, w, h)}</div>` + svg;
      } else if (hasFill && fill.image) {
        svg = `<div class="sh" style="left:0;top:0;width:100%;height:100%;overflow:hidden;">${imgLayer(fill.bf, fill.image, w, h)}</div>`;
      } else if (hasFill) {
        svg = `<div class="sh" style="left:0;top:0;width:100%;height:100%;background:${fill.css};"></div>`;
      }
      const txBody = ch(el, "txBody");
      const hasText = txBody && chs(txBody, "p").some((p) => kids(p).some((k) => ["r", "fld"].includes(k.localName)) || false);
      const text = hasText ? renderText(txBody, ph, el, e, null, w) : "";
      if (!svg && !text) return "";
      return `<div class="sh" style="${pos}${rot ? `transform:${rot};` : ""}">${svg}${text}</div>`;
    };
    let uid = 1;
    const css2svg = (fill) => (fill.isGrad ? "none" : fill.css);
    const gradDef = (cssGrad, id) => {
      const m = cssGrad.match(/^(linear|radial)-gradient\(([^,]+),(.*)\)$/);
      if (!m) return null;
      const stops = [...m[3].matchAll(/(#[0-9a-fA-F]{6}|rgba?\([^)]*\))\s+([\d.]+)%/g)].map((s) => `<stop offset="${s[2]}%" stop-color="${s[1].startsWith("rgba") ? s[1].replace(/rgba\((\d+),(\d+),(\d+),[^)]*\)/, "rgb($1,$2,$3)") : s[1]}"${s[1].startsWith("rgba") ? ` stop-opacity="${(s[1].match(/,([\d.]+)\)$/) || [])[1] || 1}"` : ""}/>`).join("");
      if (m[1] === "radial") return { id, def: `<defs><radialGradient id="${id}">${stops}</radialGradient></defs>` };
      const ang = ((parseFloat(m[2]) - 90) * Math.PI) / 180, dx = Math.cos(ang) / 2, dy = Math.sin(ang) / 2;
      return { id, def: `<defs><linearGradient id="${id}" x1="${f2(0.5 - dx)}" y1="${f2(0.5 - dy)}" x2="${f2(0.5 + dx)}" y2="${f2(0.5 + dy)}">${stops}</linearGradient></defs>` };
    };

    // jadval
    const renderTable = async (tbl, w, h, e, ctx) => {
      const cols = chs(ch(tbl, "tblGrid"), "gridCol").map((c) => num(c, "w", 0) * ctx.fx);
      const tblPr = ch(tbl, "tblPr");
      const firstRow = on(at(tblPr, "firstRow")), band = on(at(tblPr, "bandRow"));
      const acc = e.theme.colors[e.clrMap.accent1 || "accent1"] || "4472C4";
      let rows = "";
      let ri = 0;
      for (const tr of chs(tbl, "tr")) {
        const rh = num(tr, "h", 0) * ctx.fy;
        let cells = "";
        let ci = 0;
        for (const tc of chs(tr, "tc")) {
          if (on(at(tc, "hMerge")) || on(at(tc, "vMerge"))) { ci++; continue; }
          const tcPr = ch(tc, "tcPr");
          const span = parseInt(at(tc, "gridSpan", "1"), 10), rspan = parseInt(at(tc, "rowSpan", "1"), 10);
          let bg = "";
          const fl = tcPr ? await fillCss(tcPr, e, {}) : null;
          if (fl && fl.css) bg = `background:${fl.css};`;
          else if (!fl && firstRow && ri === 0) bg = `background:#${acc};`;
          else if (!fl && band && ri % 2 === 1) bg = "background:rgba(0,0,0,.06);";
          const bd = ["L", "R", "T", "B"].map((s) => { const l = tcPr && ch(tcPr, `ln${s}`); const lc = l && ch(l, "solidFill") ? colorOf(ch(l, "solidFill"), e) : null; return lc ? `border-${{ L: "left", R: "right", T: "top", B: "bottom" }[s]}:${f2(Math.max(0.5, num(l, "w", 12700) / EMU))}px solid ${css(lc)};` : ""; }).join("");
          const txt = ch(tc, "txBody") ? renderText(ch(tc, "txBody"), null, tc, e, null, 0) : "";
          const white = firstRow && ri === 0 && !fl ? "color:#fff;font-weight:700;" : "";
          cells += `<td colspan="${span}" rowspan="${rspan}" style="${bg}${bd}${white}">${txt.replace('class="tx"', 'class="tx cell"')}</td>`;
          ci++;
        }
        rows += `<tr style="height:${f2(rh)}px">${cells}</tr>`;
        ri++;
      }
      return `<table class="tb" style="width:${f2(w)}px"><colgroup>${cols.map((c) => `<col style="width:${f2(c)}px">`).join("")}</colgroup>${rows}</table>`;
    };

    // slayd yig'ish
    let bg = (await bgOf(slide.doc, slide.rels)) || (await bgOf(layout.doc, layout.rels)) || (await bgOf(master.doc, master.rels)) || { css: "#fff" };
    let bgHtml = "";
    if (bg.image) bgHtml = `<div class="sh" style="left:0;top:0;width:100%;height:100%;overflow:hidden;">${imgLayer(bg.bf, bg.image, W, H)}</div>`;
    const base = { fx: 1 / EMU, fy: 1 / EMU, ox: 0, oy: 0 };
    let inner = "";
    const showMaster = at(slide.doc, "showMasterSp", "1") !== "0";
    const layoutShowMaster = at(layout.doc, "showMasterSp", "1") !== "0";
    const decor = (shapes) => shapes.filter((s) => !phOf(s));
    if (showMaster && layoutShowMaster) for (const s of decor(masterShapes)) inner += await renderShape(s, { ...base, layoutLevel: true }, env, master.rels, false);
    if (showMaster) for (const s of decor(layoutShapes)) inner += await renderShape(s, { ...base, layoutLevel: true }, env, layout.rels, false);
    for (const s of treeShapes(slide.doc)) inner += await renderShape(s, base, env, slide.rels, true);
    slidesHtml.push(`<section class="sl" style="${bg.css && !bg.image ? `background:${bg.css};` : "background:#fff;"}">${bgHtml}${inner}</section>`);
  }
  if (!slidesHtml.length) throw new Error("slides");

  const links = [...fontsUsed].filter((f) => !/^(arial|helvetica|times|sans-serif|serif)/i.test(f)).slice(0, 12)
    .map((f) => `<link href="https://fonts.googleapis.com/css?family=${encodeURIComponent(f).replace(/%20/g, "+")}:400,400i,700,700i&display=swap" rel="stylesheet">`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>${links}
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400&family=Arimo:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
@page{size:${W}px ${H}px;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
.sl{position:relative;width:${W}px;height:${H}px;overflow:hidden;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sl:last-child{break-after:auto;page-break-after:auto}
.sh,.g{position:absolute}
.g{pointer-events:none}
.sv{position:absolute;left:0;top:0;width:100%;height:100%}
.tx{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column;overflow:visible;word-wrap:break-word;font-family:"Calibri","Carlito","Arimo",sans-serif}
.tx.cell{position:static;display:block;height:auto}
.p{margin:0;min-height:1em}
.tb{border-collapse:collapse;table-layout:fixed}
.tb td{padding:0;vertical-align:top;border:0;overflow:hidden}
${classes.join("\n")}
</style></head><body>${slidesHtml.join("")}</body></html>`;
  return { html, slides: slidesHtml.length, width: W, height: H };
}

module.exports = { pptxToHtml };
