// PRO (Morph) shablonni TARGET slaydgacha kengaytiradi: mazmun bloki (a..b) spec'da takrorlanadi, .pptx fayl o'zgarmaydi —
// server (pres-gen buildPptx) har takror slaydni o'sha manba slayd (part) dan yig'adi.
//  - takrordagi har slayd: yangi n, src (manba n), cycle (takror raqami);
//  - blok ichidagi nusxa (copy) shu takror ichiga ko'chiriladi;
//  - blokdan tashqaridan nusxalangan yozuv/rasm (masalan, mundarijadan sarlavha) takrorda AI'ga beriladi:
//    birinchi EKRANDAGI joyi yozadi, qolganlari undan nusxalanadi — har takror o'z sarlavhasi va suratiga ega;
//  - spec.media: blokdagi rasm fayllari takror uchun alohida guruh (<nom>_c<cycle>.<ext>), server faylni nusxalaydi.
// Ishlatish: node extend-sequence.js <spec.json> <a> <b> [target=15]
const fs = require("fs");
const [, , file, A, B, T = "15"] = process.argv;
const a = +A, b = +B, target = +T;
const spec = JSON.parse(fs.readFileSync(file, "utf8"));
if (!spec.sequence) throw new Error("sequence emas: " + file);
if (spec.slides.some((s) => s.cycle)) throw new Error("allaqachon kengaytirilgan: " + file);
const W = spec.size && (spec.size.w || spec.size[0]), H = spec.size && (spec.size.h || spec.size[1]);
const idx = (n) => spec.slides.findIndex((s) => s.n === n);
const ia = idx(a), ib = idx(b);
if (ia < 0 || ib < ia) throw new Error("blok noto'g'ri");
const head = spec.slides.slice(0, ib + 1), block = spec.slides.slice(ia, ib + 1), tail = spec.slides.slice(ib + 1);
const inBlock = new Set(block.map((s) => s.n));
const need = target - spec.slides.length;
if (need <= 0) { console.log("kerak emas:", spec.slides.length); process.exit(0); }
const onScreen = (t) => !t.box || !W || !(t.box[0] + t.box[2] <= 0 || t.box[0] >= W || t.box[1] + t.box[3] <= 0 || t.box[1] >= H);
const newN = (n, c) => n + c * 100;

const clones = [];
for (let c = 1; clones.length < need; c++) {
  const part = block.slice(0, need - clones.length).map((s) => JSON.parse(JSON.stringify(s)));
  // blokdan tashqaridagi manba -> shu takrordagi yozuvchi
  const writers = new Map();
  for (const key of ["slots", "photos"]) {
    for (const s of part) for (const t of s[key] || []) {
      if (!t.copy || inBlock.has(t.copy[0])) continue;
      const k = key + t.copy.join(":");
      const canWrite = key === "photos" ? true : onScreen(t) && t.kind !== "fixed";
      if (canWrite && !writers.has(k)) writers.set(k, [newN(s.n, c), t.id]);
    }
  }
  for (const key of ["slots", "photos"]) {
    for (const s of part) for (const t of s[key] || []) {
      if (!t.copy) continue;
      if (inBlock.has(t.copy[0])) { t.copy = [newN(t.copy[0], c), t.copy[1]]; continue; }
      const w = writers.get(key + t.copy.join(":"));
      if (!w) continue;                                  // takrorda ekranga chiqmaydi — eski manbadan qoladi
      if (w[0] === newN(s.n, c) && w[1] === t.id) { delete t.copy; delete t.off; } else t.copy = w;
    }
  }
  for (const s of part) { s.src = s.n; s.cycle = c; s.n = newN(s.n, c); clones.push(s); }
  // rasm fayllari: takror uchun alohida guruhlar
  if (spec.media) {
    const base = spec.media.filter((m) => !m.cycle);
    const map = new Map();
    const cut = new Set(part.map((s) => s.src));
    base.forEach((m, i) => { if (m.slides.some((n) => cut.has(n))) map.set(i, spec.media.length + map.size); });
    base.forEach((m, i) => {
      if (!map.has(i)) return;
      const g = { ...m, cycle: c, files: m.files.map((f) => f.replace(/(\.[^.]+)$/, `_c${c}$1`)), slides: m.slides.filter((n) => cut.has(n)).map((n) => newN(n, c)) };
      if (m.derive) g.derive = { ...m.derive, of: map.has(m.derive.of) ? map.get(m.derive.of) : m.derive.of };
      spec.media.push(g);
    });
  }
}
spec.slides = [...head, ...clones, ...tail];
fs.writeFileSync(file, JSON.stringify(spec, null, 1));
const blank = clones.filter((s) => (s.slots || []).length && !s.slots.some((t) => !t.off && t.kind !== "fixed")).length;
console.log(`${file.split(/[\\/]/).pop()}: ${head.length + tail.length} + ${clones.length} = ${spec.slides.length} slayd (blok ${a}-${b}), media ${spec.media ? spec.media.length : 0}, AI yozmaydigan takror: ${blank}`);
