// PRO (Morph) shablon spec'ini tayyorlaydi: analyze.py natijasiga sequence:true qo'shadi va
// Morph juftlarini bog'laydi — "!!nom"li yozuv oldingi slaydda xuddi shu nom va matn bilan bo'lsa,
// AI'ga berilmaydi (off) va o'sha birinchi nusxadan olinadi (copy: [slayd, id]). Rasmlar ham shunday.
// Ishlatish: node post-morph.js <shablon.pptx> <spec.json>   (jszip — ai-xizmatlari/node_modules)
const fs = require("fs");
const path = require("path");
const JSZip = require(require.resolve("jszip", { paths: [process.cwd(), path.join(__dirname, "../../../ai-xizmatlari")] }));

(async () => {
  const [, , pptx, specFile] = process.argv;
  const zip = await JSZip.loadAsync(fs.readFileSync(pptx));
  const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
  const seen = new Map(); // "nom|matn" -> [slayd, id]
  const seenPic = new Map(); // "nom|rasm" -> [slayd, id]
  let texts = 0, pics = 0;
  for (const s of spec.slides) {
    const xml = await zip.file(s.part).async("string");
    const rels = (await zip.file(s.part.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels"))?.async("string")) || "";
    // guruh ichidagi yozuv: nomi — "!!guruh#tartib" (Morph guruhni bir butun sifatida bog'laydi)
    const groups = [...xml.matchAll(/<p:grpSp>([\s\S]*?)<\/p:grpSp>/g)].map((m) => ({ from: m.index, to: m.index + m[0].length, name: (/<p:cNvPr id="\d+" name="([^"]*)"/.exec(m[1]) || [])[1] || "", ids: [...m[1].matchAll(/<p:cNvPr id="(\d+)"/g)].map((x) => x[1]) }));
    const nameOf = (id) => {
      const own = (new RegExp(`<p:cNvPr id="${id}" name="([^"]*)"`).exec(xml) || [])[1] || "";
      if (own.startsWith("!!")) return own;
      const g = groups.find((g) => g.name.startsWith("!!") && g.ids.includes(String(id)));
      return g ? `${g.name}#${g.ids.indexOf(String(id))}` : own;
    };
    for (const t of s.slots) {
      // ikki rangli so'z: AltText "split:<x pt>" — panel qirrasi (server gradientni qayta hisoblaydi)
      const sp = new RegExp(`<p:cNvPr id="${t.id}"[^>]*descr="split:(\\d+)"`).exec(xml);
      if (sp) t.split = +sp[1];
      if (t.kind === "fixed") continue;
      const nm = nameOf(t.id);
      if (!nm.startsWith("!!")) continue;
      const key = nm + "|" + t.text;
      if (seen.has(key)) { t.off = true; t.copy = seen.get(key); texts++; } else seen.set(key, [s.n, t.id]);
    }
    for (const p of s.photos) {
      const nm = nameOf(p.id);
      const at = xml.indexOf(`<p:cNvPr id="${p.id}"`);
      const rid = (/r:embed="(rId\d+)"/.exec(xml.slice(at)) || [])[1];
      const target = (new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels) || new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels) || [])[1] || "";
      const key = nm + "|" + target;
      if (nm.startsWith("!!") && seenPic.has(key)) { p.copy = seenPic.get(key); pics++; } else seenPic.set(key, [s.n, p.id]);
    }
  }
  // tik harflar (har qatorda bitta harf) — AI so'z yozadi, server harflarga bo'ladi
  for (const s of spec.slides) for (const t of s.slots) if (/^(\S\n){2,5}\S$/.test(t.text)) { t.stack = true; t.kind = "label"; t.max = 5; }
  // juda katta (70+ pt) bitta so'zli sarlavha — AI qisqa kalit so'z yozadi (mavzu to'liq emas)
  for (const s of spec.slides) for (const t of s.slots) if (!t.stack && t.kind !== "fixed" && t.sz >= 70 && /^\S{2,}$/.test(t.text.trim())) { t.word = Math.max(6, Math.min(12, t.text.trim().length + 2)); t.max = t.word; }
  // --media: shablon suratlari (fon, rasm, harf ichidagi rasm) fayli bilan almashadi — rasm ramkalari kerak emas
  if (process.argv.includes("--media")) {
    const crypto = require("crypto");
    const size = (b) => { for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xff) return null; const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }; i += 2 + len; } return null; };
    const groups = new Map();
    // focus: rasm eng katta ko'rinadigan slayd — surat shu slayd mavzusi bo'yicha qidiriladi (karta oldingi slaydlarda kichik turgan bo'lsa ham)
    const pres = await zip.file("ppt/presentation.xml").async("string");
    const sldSz = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres) || [0, 12192000, 6858000];
    const SW = +sldSz[1], SH = +sldSz[2];
    const best = new Map();
    for (const s of spec.slides) {
      s.photos = [];
      const relFile = s.part.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
      const rels = (await zip.file(relFile)?.async("string")) || "";
      const xml = await zip.file(s.part).async("string");
      const areaOf = (rid) => {
        let top = 0;
        for (const p of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
          if (!p[0].includes(`r:embed="${rid}"`)) continue;
          const b = /<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(p[0]);
          if (!b) continue;
          const [x, y, w, h] = b.slice(1).map(Number);
          const vw = Math.min(x + w, SW) - Math.max(x, 0), vh = Math.min(y + h, SH) - Math.max(y, 0);
          if (vw > 0 && vh > 0) top = Math.max(top, vw * vh);
        }
        return top;
      };
      for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
        const t = /Target="\.\.\/media\/([^"]+\.jpe?g)"/i.exec(m[0]), id = /\bId="([^"]+)"/.exec(m[0]);
        if (!t || !id) continue;
        const file = "ppt/media/" + t[1], buf = await zip.file(file).async("nodebuffer"), sz = size(buf);
        if (!sz || Math.min(sz.w, sz.h) < 400) continue;
        const h = crypto.createHash("md5").update(buf).digest("hex");
        if (!groups.has(h)) groups.set(h, { files: [], w: sz.w, h: sz.h, slides: [] });
        const g = groups.get(h);
        if (!g.files.includes(file)) g.files.push(file);
        if (!g.slides.includes(s.n)) g.slides.push(s.n);
        const area = areaOf(id[1]);
        if (area > (best.get(h) || 0)) { best.set(h, area); g.focus = s.n; }
      }
    }
    spec.media = [...groups.values()];
    spec.media.forEach((g, i) => console.log(`  media ${i}: ${g.w}x${g.h} slaydlar ${g.slides.join(",")} focus ${g.focus} ${g.files.join(" ")}`));
  }
  spec.sequence = true;
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 1));
  const own = spec.slides.map((s) => s.slots.filter((t) => t.kind !== "fixed" && !t.off).length);
  console.log(path.basename(specFile), "slaydlar:", spec.slides.length, "| nusxa matn:", texts, "rasm:", pics, "| AI yozadi:", own.join(","));
})().catch((e) => { console.error(e); process.exit(1); });
