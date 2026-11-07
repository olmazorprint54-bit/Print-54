// api/_lib/newlat.js
// ---------------------------------------------------------------
// O'zbek tilining yangi lotin alifbosi (2026-yil 21-oktyabrdagi qonun):
//   O‘ → Ö, G‘ → Ğ, Sh → Ş, Ch → Ç ("ng" o'zgarmaydi, tutuq belgisi ’ qoladi).
// Til tanlovi "uz_new": AI odatdagi lotincha yozadi (uz_lat), tayyor matn shu yerda yangi alifboga o'giriladi:
//   HTML (PDF/PNG oldidan), Word/PowerPoint fayl ichidagi matn, yoki istalgan JSON obyekt.
// Havola, e-pochta va inglizcha ko'rinadigan so'zlar (w, th, ck, ph, ea, ou, ch dan boshqa c) o'zgartirilmaydi.
// ---------------------------------------------------------------
const JSZip = require("jszip");

const APOS = "[‘ʻ'’`ʼ]";
const RE_OG = new RegExp(`([OoGg])${APOS}`, "g");
const MAP_OG = { O: "Ö", o: "ö", G: "Ğ", g: "ğ" };
const SKIP_TOKEN = /(https?:\/\/|www\.|@|\.(com|uz|org|ru|net)\b)/i;
const FOREIGN = /w|th|ck|ph|ee|oo|ea|ou|c(?!h)|^ch[rlt]/i;

function word(w) {
  if (!w || SKIP_TOKEN.test(w)) return w;
  let s = w.replace(RE_OG, (_, c) => MAP_OG[c]);
  if (FOREIGN.test(s)) return s;
  return s
    .replace(/SH/g, "Ş").replace(/Sh/g, "Ş").replace(/sh/g, "ş").replace(/sH/g, "ş")
    .replace(/CH/g, "Ç").replace(/Ch/g, "Ç").replace(/ch/g, "ç").replace(/cH/g, "ç");
}
// Oddiy matn: bo'shliqlar va tinish belgilari saqlanadi
function toNew(text) {
  if (text == null) return text;
  return String(text).replace(/[^\s<>"()\[\]{},;:!?«»“”]+/g, word);
}
// Obyekt ichidagi barcha matnlar
function deep(v) {
  if (typeof v === "string") return toNew(v);
  if (Array.isArray(v)) return v.map(deep);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = /^(photo|src|url|href|image_query|query|id)$/.test(k) ? x : deep(x);
    return out;
  }
  return v;
}
// HTML: faqat teglar orasidagi matn; <script>/<style> ichiga tegilmaydi
function convertHtml(html) {
  const parts = String(html).split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/i);
  return parts.map((p) => (p.startsWith("<") ? p : decodeEncode(p, (t) => toNew(t)))).join("");
}
const ENT = { "&apos;": "'", "&#39;": "'", "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">" };
function decodeEncode(s, fn) {
  const plain = s.replace(/&(apos|#39|quot|amp|lt|gt);/g, (m) => ENT[m]);
  const done = fn(plain);
  if (done === plain) return s;
  return done.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Word (w:t) va PowerPoint (a:t) ichidagi matn
async function convertOffice(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files).filter((n) => /^(word\/(document|header\d*|footer\d*|footnotes|endnotes)|ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+))\.xml$/.test(n));
  for (const n of files) {
    const xml = await zip.file(n).async("string");
    const out = xml.replace(/(<(w|a):t(?:\s[^>]*)?>)([^<]*)(<\/\2:t>)/g, (m, open, _ns, text, close) => open + decodeEncode(text, toNew) + close);
    if (out !== xml) zip.file(n, out);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { toNew, deep, convertHtml, convertOffice };
