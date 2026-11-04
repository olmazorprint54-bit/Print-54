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
  spec.sequence = true;
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 1));
  const own = spec.slides.map((s) => s.slots.filter((t) => t.kind !== "fixed" && !t.off).length);
  console.log(path.basename(specFile), "slaydlar:", spec.slides.length, "| nusxa matn:", texts, "rasm:", pics, "| AI yozadi:", own.join(","));
})().catch((e) => { console.error(e); process.exit(1); });
