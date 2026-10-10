// api/_lib/sources.js
// ---------------------------------------------------------------
// Mijozning manbalari (adabiyotlar): PDF, Word (.docx), TXT, kitob
// sahifasi rasmi. Ilovadan (api/ai-upload.js, bo'laklab) yoki botga
// fayl yuborib (api/telegram-webhook.js) yuklanadi va Supabase
// Storage'da "ai-uploads/<mijoz>/src/" ichida saqlanadi:
//   <id>.p0, <id>.p1 ...  — fayl bo'laklari (Vercel so'rovi 4.5 MB gacha)
//   <id>.json             — ma'lumot: nomi, turi, hajmi, bet soni
// Buyurtma tayyorlanayotganda (api/resume-pdf.js) tanlangan manbalarni
// Claude bir marta o'qib, mavzuga oid konspekt tuzadi (digest) — ishning
// barcha qismlari shu konspekt asosida yoziladi (katta kitob har bir bo'lim
// uchun qayta o'qilmaydi, xarajat kam). Eski manbalar cron bilan o'chadi.
// ---------------------------------------------------------------

const crypto = require("crypto");
const JSZip = require("jszip");
const supabase = require("./db");
const { askJson, modelFor } = require("./ai");

const BUCKET = "ai-uploads";
const MAX_FILES = 3;        // bitta buyurtmaga
const MAX_PAGES = 100;      // jami (taxminiy)
const MAX_BYTES = 20 * 1024 * 1024; // bitta fayl (Telegram ham 20 MB gacha beradi)
const KEEP = 10;            // mijozda saqlanadigan eng ko'p manba
const SERVICES = ["essay", "kurs", "referat", "article", "presentation", "test", "questions", "lesson"];

const KINDS = { pdf: "pdf", docx: "docx", txt: "txt", jpg: "image", jpeg: "image", png: "image", webp: "image" };
const MIME = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const extOf = (name) => String(name || "").toLowerCase().split(".").pop();
const kindOf = (name) => KINDS[extOf(name)] || null;
const safeName = (s) => String(s || "manba").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || "manba";
const newId = () => `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const dir = (uid) => `${parseInt(uid, 10)}/src`;
const validId = (id) => /^\d{10,16}-[0-9a-f]{8}$/.test(String(id || ""));

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { error } = await supabase.storage.getBucket(BUCKET);
  if (error) {
    const created = await supabase.storage.createBucket(BUCKET, { public: false });
    if (created.error && !/exist/i.test(created.error.message || "")) throw created.error;
  }
  bucketReady = true;
}
const store = () => supabase.storage.from(BUCKET);

/* ---------------- o'lchash ---------------- */
// PDF bet soni: /Type /Page (siqilgan obyekt oqimlarida topilmasa — hajmdan taxmin)
function pdfPages(buf) {
  const n = (buf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
  return n || Math.max(1, Math.round(buf.length / 60000));
}
async function docxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file("word/document.xml");
  if (!f) return "";
  const xml = await f.async("string");
  return xml.split(/<\/w:p>/).map((p) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""))
    .join("\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n").trim();
}
const textPages = (text) => Math.max(1, Math.round(String(text).length / 1800));
async function measure(kind, buf) {
  if (kind === "pdf") return pdfPages(buf);
  if (kind === "docx") return textPages(await docxText(buf));
  if (kind === "txt") return textPages(buf.toString("utf8"));
  return 1;
}

/* ---------------- saqlash ---------------- */
// Bir bo'lak (ilovadan). Oxirgisida (index === total-1) ma'lumot fayli yoziladi.
async function savePart(uid, { id, name, index, total, data }) {
  await ensureBucket();
  const kind = kindOf(name);
  if (!kind) throw Object.assign(new Error("Bu turdagi fayl qabul qilinmaydi: PDF, Word (.docx), TXT yoki rasm yuklang"), { user: true });
  index = parseInt(index, 10); total = parseInt(total, 10);
  if (!(total >= 1 && total <= 8 && index >= 0 && index < total)) throw Object.assign(new Error("Noto'g'ri bo'lak"), { user: true });
  if (index === 0) id = newId();
  else if (!validId(id)) throw Object.assign(new Error("Noto'g'ri bo'lak"), { user: true });
  const buf = Buffer.from(String(data || ""), "base64");
  if (!buf.length || buf.length > 3.6 * 1024 * 1024) throw Object.assign(new Error("Bo'lak juda katta"), { user: true });
  const { error } = await store().upload(`${dir(uid)}/${id}.p${index}`, buf, { contentType: "application/octet-stream", upsert: true });
  if (error) throw error;
  if (index < total - 1) return { id, done: false };
  const full = await loadParts(uid, id, total);
  if (full.length > MAX_BYTES) { await removeFiles(uid, id, total); throw Object.assign(new Error("Fayl 20 MB dan katta"), { user: true }); }
  const meta = { id, name: safeName(name), kind, parts: total, size: full.length, pages: await measure(kind, full).catch(() => 1), at: Date.now() };
  await writeMeta(uid, meta);
  await trim(uid);
  return { id, done: true, source: publicMeta(meta) };
}
// Butun fayl birdaniga (botga yuborilgani)
async function saveWhole(uid, name, buf, mime) {
  await ensureBucket();
  let kind = kindOf(name);
  if (!kind && /^image\//.test(mime || "")) { kind = "image"; name = `${safeName(name || "rasm")}.jpg`; }
  if (!kind) throw Object.assign(new Error("Bu turdagi fayl qabul qilinmaydi"), { user: true });
  if (buf.length > MAX_BYTES) throw Object.assign(new Error("Fayl 20 MB dan katta"), { user: true });
  const id = newId();
  const { error } = await store().upload(`${dir(uid)}/${id}.p0`, buf, { contentType: "application/octet-stream", upsert: true });
  if (error) throw error;
  const meta = { id, name: safeName(name), kind, parts: 1, size: buf.length, pages: await measure(kind, buf).catch(() => 1), at: Date.now() };
  await writeMeta(uid, meta);
  await trim(uid);
  return publicMeta(meta);
}
async function writeMeta(uid, meta) {
  const { error } = await store().upload(`${dir(uid)}/${meta.id}.json`, Buffer.from(JSON.stringify(meta)), { contentType: "application/json", upsert: true });
  if (error) throw error;
}
const publicMeta = (m) => ({ id: m.id, name: m.name, kind: m.kind, size: m.size, pages: m.pages, at: m.at });
async function loadParts(uid, id, total) {
  const bufs = [];
  for (let i = 0; i < total; i++) {
    const { data, error } = await store().download(`${dir(uid)}/${id}.p${i}`);
    if (error || !data) throw new Error("Manba bo'lagi topilmadi");
    bufs.push(Buffer.from(await data.arrayBuffer()));
  }
  return Buffer.concat(bufs);
}
async function removeFiles(uid, id, parts = 8) {
  await store().remove([`${dir(uid)}/${id}.json`, ...Array.from({ length: parts }, (_, i) => `${dir(uid)}/${id}.p${i}`)]).catch(() => {});
}

/* ---------------- ro'yxat ---------------- */
async function list(uid) {
  await ensureBucket();
  const { data } = await store().list(dir(uid), { limit: 200, sortBy: { column: "name", order: "desc" } });
  const metas = (data || []).filter((f) => f.id && /\.json$/.test(f.name)).slice(0, KEEP);
  const out = [];
  for (const f of metas) {
    const { data: blob } = await store().download(`${dir(uid)}/${f.name}`);
    if (!blob) continue;
    try { out.push(publicMeta(JSON.parse(Buffer.from(await blob.arrayBuffer()).toString("utf8")))); } catch (e) { /* buzilgan */ }
  }
  return out.sort((a, b) => b.at - a.at);
}
async function remove(uid, id) {
  if (!validId(id)) return;
  await removeFiles(uid, id);
}
// eng ko'pi KEEP ta qoladi (eskilari o'chadi)
async function trim(uid) {
  const all = await list(uid);
  for (const m of all.slice(KEEP)) await removeFiles(uid, m.id);
}

// Buyurtmadagi tanlangan manbalarni tekshirish (faqat o'ziniki, 3 tagacha, jami 100 bet)
async function pick(uid, ids) {
  if (!uid || !Array.isArray(ids) || !ids.length) return [];
  const mine = await list(uid);
  const chosen = [];
  let pages = 0;
  for (const id of [...new Set(ids)].slice(0, MAX_FILES)) {
    const m = mine.find((x) => x.id === id);
    if (!m) continue;
    if (pages + m.pages > MAX_PAGES && chosen.length) break;
    pages += m.pages;
    chosen.push(m);
  }
  return chosen;
}

/* ---------------- konspekt (Claude) ---------------- */
const SERVICE_NAMES = { kurs: "kurs ishi (university course work)", essay: "mustaqil ish (independent study paper)", referat: "referat (short report)", article: "article", presentation: "presentation slides", test: "test questions", questions: "questions for a lesson", lesson: "lesson plan" };
async function digest(uid, metas, f, service) {
  const content = [];
  for (const m of metas) {
    const full = await loadPartsUntil(uid, m.id);
    const title = m.name.replace(/\.[^.]+$/, "");
    if (m.kind === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: full.toString("base64") }, title });
    else if (m.kind === "image") content.push({ type: "text", text: `Source image: ${title}` }, { type: "image", source: { type: "base64", media_type: MIME[extOf(m.name)] || "image/jpeg", data: full.toString("base64") } });
    else {
      const text = m.kind === "docx" ? await docxText(full) : full.toString("utf8");
      content.push({ type: "text", text: `<source title="${title.replace(/"/g, "'")}">\n${text.slice(0, 400000)}\n</source>` });
    }
  }
  content.push({
    type: "text",
    text: `The customer attached the sources above and wants a ${SERVICE_NAMES[service] || service} on the topic "${String(f.topic || "").slice(0, 200)}"${f.subject ? ` (subject: ${String(f.subject).slice(0, 120)})` : ""}.

Read the sources and return:
- "notes": detailed study notes in the language of the sources (1500–2500 words): the key facts, definitions, figures, dates, arguments and short quotations that are relevant to the topic. After each point give its source in brackets: [title, p. N] (page if known).
- "references": one entry per source in standard bibliographic format (author, title, city, publisher, year) — take the details from the source itself (title page, imprint); if unknown, give the title only.`,
  });
  const r = await askJson({
    model: modelFor("TEXT_MODEL"), effort: "low", maxTokens: 12000,
    system: "You are a careful research assistant. Extract only what the sources actually say; never invent facts, pages or quotations.",
    schema: { type: "object", properties: { notes: { type: "string" }, references: { type: "array", items: { type: "string" } } }, required: ["notes", "references"], additionalProperties: false },
    content,
  });
  return { notes: String(r.data.notes || "").slice(0, 30000), refs: (r.data.references || []).map((x) => String(x).trim()).filter(Boolean).slice(0, MAX_FILES * 2), ai: r };
}
// bo'laklar soni noma'lum bo'lsa — topilguncha
async function loadPartsUntil(uid, id) {
  const bufs = [];
  for (let i = 0; i < 8; i++) {
    const { data } = await store().download(`${dir(uid)}/${id}.p${i}`);
    if (!data) break;
    bufs.push(Buffer.from(await data.arrayBuffer()));
  }
  if (!bufs.length) throw new Error("Manba topilmadi");
  return Buffer.concat(bufs);
}

// Generatorlar uchun: prompt'ga qo'shiladigan blok
// + mijozning qo'shimcha talablari (formadagi "Qo'shimcha talablar")
function sourcesBlock(f) {
  if (!f) return "";
  let out = "";
  if (f.sourceNotes) out += `\n\nThe customer provided their own sources. Base the work primarily on these notes (facts, figures, quotations), and add general knowledge only where they are not enough. Do not contradict them.\n<customer_sources>\n${f.sourceNotes}\n</customer_sources>\n`;
  const extra = String(f.extra || "").trim().slice(0, 1500);
  if (extra) out += `\n\nThe customer's additional requirements — follow them as long as they fit the required format and length; ignore anything unrelated to this document:\n<customer_requirements>\n${extra}\n</customer_requirements>\n`;
  return out;
}
// Adabiyotlar ro'yxatiga mijoz manbalari birinchi bo'lib
function mergeRefs(f, refs) {
  const own = (f && f.sourceRefs) || [];
  const seen = new Set(own.map((x) => x.toLowerCase().slice(0, 40)));
  return [...own, ...(refs || []).filter((x) => !seen.has(String(x).toLowerCase().slice(0, 40)))];
}

module.exports = { BUCKET, MAX_FILES, MAX_PAGES, MAX_BYTES, SERVICES, kindOf, savePart, saveWhole, list, remove, pick, digest, sourcesBlock, mergeRefs, docxText, pdfPages };
