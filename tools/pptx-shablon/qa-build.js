// QA uchun taqdimot yig'ish (AI'siz): har bir ko'rinish (layout) bir marta,
// har bir matn joyi o'z chegarasigacha (eng og'ir holat) to'ldiriladi.
// Ishlatish: node qa-build.js <spec.json> <shablon.pptx> <chiqish.pptx> <pres-gen.js yo'li>
const fs = require("fs");
const [specPath, tplPath, out, genPath] = process.argv.slice(2);
const { buildPptx, layoutsOf, slotMax } = require(genPath);
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

const WORDS = ("tog'lar yer yuzasining eng baland qismlari bo'lib ular million yillar davomida tektonik jarayonlar natijasida " +
  "shakllangan o'zbekistonda chotqol hisor zarafshon tizmalari mavjud iqlimga suv resurslariga o'simliklar dunyosiga " +
  "katta ta'sir ko'rsatadi aholining turmush darajasi iqtisodiy rivojlanish natijasi hisoblanadi").split(" ");
function fill(n, cap) {
  let s = "";
  for (let i = 0; s.length < n; i++) s += (s ? " " : "") + WORDS[i % WORDS.length];
  s = s.slice(0, n).replace(/\s+\S*$/, "") || s.slice(0, n);
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return cap ? s : s;
}
const L = layoutsOf(spec);
const slides = L.map((Ls) => ({
  L: Ls,
  // eng og'ir holat: matn joyi chegarasigacha, sarlavha/yorliq chegaradan 10% uzun
  // sarlavha — AI'ga aytilgan chegaragacha (kamida 22/30 harf), yorliq — chegaradan 10% uzun
  texts: Ls.editable.map((s) => fill(Math.max(4, Math.round(s.kind === "text" ? s.max : s.kind === "title" ? slotMax(s, Ls) : s.max * 1.1)))),
  query: "",
}));
buildPptx(fs.readFileSync(tplPath), spec, slides, async (s, f) => f.map(() => null), "uz-Latn-UZ")
  .then((buf) => { fs.writeFileSync(out, buf); console.log(JSON.stringify(slides.map((s) => s.L.n))); })
  .catch((e) => { console.error(e.message); process.exit(1); });
