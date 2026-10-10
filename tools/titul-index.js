// Tayyor titullar ro'yxati (ilovadagi qidiruv uchun): public/ai/titullar.js ni yangilaydi.
// Ishlatish: node tools/titul-index.js <titullar.docx joylashgan papka>
// (titullar.docx o'zi yopiq repozitoriyada — print54-shablonlar)
process.env.TEMPLATES_DIR = process.argv[2] || process.env.TEMPLATES_DIR;
const fs = require("fs");
const path = require("path");
const T = require("../api/_lib/titul");
(async () => {
  const list = await T.list();
  const out = `// Avtomatik yasalgan: node tools/titul-index.js — qo'lda o'zgartirmang (${list.length} ta OTM)\nwindow.AI_TITULS = ${JSON.stringify(list)};\n`;
  fs.writeFileSync(path.join(__dirname, "../public/ai/titullar.js"), out);
  console.log("public/ai/titullar.js:", list.length, "ta OTM");
})().catch((e) => { console.error(e); process.exit(1); });
