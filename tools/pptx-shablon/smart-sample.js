// Aqlli shablonlar namunasi (AI'siz): har bir rang uslubida barcha slayd turlari.
// Ilova ko'rinishlari (preview) va chaplashish tekshiruvi uchun.
// node smart-sample.js <smart-gen.js> <chiqish_papka> [rasm.jpg]
const fs = require("fs");
const path = require("path");
const [genPath, out, imgPath] = process.argv.slice(2);
const { THEMES, renderSmart } = require(genPath);
const E = { title: "", subtitle: "", text: "", highlight: "", image_query: "", items: [], left: { title: "", items: [] }, right: { title: "", items: [] }, chart: { kind: "bar", name: "", labels: [], values: [] }, table: { head: [], rows: [] } };
const slides = [
  { ...E, type: "title", title: "Quyosh sistemasi", subtitle: "Koinotning cheksizligida bizning o'rnimizni anglash" },
  { ...E, type: "agenda", title: "Taqdimot rejasi", items: [
    { title: "Quyosh sistemasi", text: "Quyosh, sayyoralar, mitti sayyoralar, asteroidlar va kometalar o'zaro aloqada" },
    { title: "Sayyoralar xususiyatlari", text: "Har bir sayyoraning o'ziga xos geologik va atmosfera xususiyatlari" },
    { title: "Koinot tadqiqotlari", text: "2022–2026 yillarda Quyosh sistemasini o'rganishdagi muhim kashfiyotlar" },
    { title: "Kosmik missiyalar", text: "Quyosh sistemasini o'rganishga yo'naltirilgan missiyalar soni va sarmoyalar" } ] },
  { ...E, type: "text_image", title: "Quyosh sistemasi nima?", text: "Quyosh sistemasi — markaziy yulduzimiz Quyosh va uning atrofida aylanuvchi sakkizta sayyora, mitti sayyoralar, asteroidlar, kometalar va boshqa kosmik jismlardan tashkil topgan ulkan tizim.\nBizning Yerimiz Quyoshdan uchinchi o'rinda joylashgan. Sistema taxminan 4,6 milliard yil oldin gaz va chang bulutining kollapsi natijasida shakllangan.", image_query: "solar system planets" },
  { ...E, type: "comparison", title: "Sayyoralar: o'ziga xos xususiyatlar", text: "Har bir sayyora o'zining geologik tuzilishi, atmosferasi va harorat sharoitlari bilan ajralib turadi.",
    left: { title: "Ichki sayyoralar (toshli)", items: ["Tuzilishi: asosan toshli yuzaga ega", "Atmosfera: Merkuriy va Marsda juda siyrak, Venerada zich", "Harorat: Venera ekstremal issiq, Yer hayot uchun qulay"] },
    right: { title: "Tashqi sayyoralar (gaz gigantlari)", items: ["Tuzilishi: vodorod va geliydan iborat", "Atmosfera: qattiq yuza yo'q, kuchli shamollar", "Xususiyati: ko'plab yo'ldoshlar va halqalar tizimi"] } },
  { ...E, type: "timeline", title: "Koinot tadqiqotlari", text: "2022–2026 yillarda Quyosh sistemasini o'rganishda erishilgan muhim natijalar.", items: [
    { title: "2022", text: "Artemis 1 missiyasi: Oy atrofida uchuvchisiz sinov parvozi" }, { title: "2023", text: "Psyche missiyasi metall asteroidga yo'l oldi" },
    { title: "2024", text: "Europa Clipper Yupiterning yo'ldoshini o'rganishga uchdi" }, { title: "2025", text: "Saturnning Enselad yo'ldoshida yangi organik moddalar topildi" },
    { title: "2026", text: "Mars namunalarini Yerga qaytarish dasturi bosqichma-bosqich davom etmoqda" } ] },
  { ...E, type: "chart", title: "Kosmik missiyalarga sarmoya", text: "Diagrammada kosmik tadqiqotlarga ajratilgan global sarmoyalar ko'rsatilgan (taxminiy, milliard dollar). Har yili o'rtacha 50–70 milliard dollarga o'smoqda.", chart: { kind: "line", name: "Sarmoya, mlrd $", labels: ["2023", "2024", "2025", "2026", "2027", "2028"], values: [560, 610, 670, 730, 800, 880] } },
  { ...E, type: "table", title: "Sayyoralar jadvali", text: "Quyosh sistemasidagi ayrim sayyoralarning asosiy ko'rsatkichlari.", table: { head: ["Sayyora", "Quyoshdan masofa", "Yo'ldoshlar", "Turi"], rows: [["Merkuriy", "58 mln km", "0", "Toshli"], ["Yer", "150 mln km", "1", "Toshli"], ["Yupiter", "778 mln km", "95", "Gaz giganti"], ["Saturn", "1,4 mlrd km", "146", "Gaz giganti"]] } },
  { ...E, type: "stats", title: "Raqamlarda", text: "Quyosh sistemasi haqida qiziqarli faktlar.", items: [{ title: "8", text: "sayyora Quyosh atrofida aylanadi" }, { title: "4,6 mlrd", text: "yil — sistemaning yoshi" }, { title: "99,8%", text: "sistema massasi Quyoshga to'g'ri keladi" }] },
  { ...E, type: "quote", text: "Koinot — bu biz o'rganishimiz kerak bo'lgan eng katta kitob.", subtitle: "Galileo Galiley" },
  { ...E, type: "bullets", title: "Nega o'rganamiz?", text: "Quyosh sistemasini o'rganish insoniyat uchun muhim ahamiyatga ega.", items: [{ title: "Bilim", text: "Yer va hayotning kelib chiqishini tushunish" }, { title: "Texnologiya", text: "Kosmik tadqiqotlar yangi texnologiyalarni rivojlantiradi" }, { title: "Xavfsizlik", text: "Asteroidlar xavfini oldindan aniqlash" }] },
  { ...E, type: "conclusion", title: "Yakun: kelajak istiqbollari", items: [{ title: "Cheksiz tadqiqotlar", text: "Quyosh sistemasi hali ko'p sirlarni saqlaydi" }, { title: "Innovatsion texnologiyalar", text: "Missiyalar yangi texnologiyalar yaratishga undaydi" }, { title: "Insoniyat kelajagi", text: "Boshqa sayyoralarni o'zlashtirish imkoniyatlari" }], highlight: "Quyosh sistemasi nafaqat astronomik obyektlar to'plami, balki insoniyatning ilmiy taraqqiyoti va koinotni anglash sari intilishining timsoli." },
  { ...E, type: "thanks", title: "E'tiboringiz uchun rahmat!", subtitle: "Savollaringiz bo'lsa, marhamat" },
];
const img = imgPath ? { data: "data:image/jpeg;base64," + fs.readFileSync(imgPath).toString("base64"), w: 1600, h: 1000 } : null;
fs.mkdirSync(out, { recursive: true });
(async () => {
  for (const id of Object.keys(THEMES)) {
    const buf = await renderSmart({ theme: id, slides }, { topic: "Quyosh sistemasi", subject: "Astronomiya", author: "Aliyev Ali", lang: "uz_lat" }, [img, img]);
    fs.writeFileSync(path.join(out, id + ".pptx"), buf);
    console.log("OK", id, Math.round(buf.length / 1024) + "KB");
  }
})().catch((e) => { console.error(e); process.exit(1); });
