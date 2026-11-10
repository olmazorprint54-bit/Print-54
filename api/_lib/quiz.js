// api/_lib/quiz.js
// ---------------------------------------------------------------
// Viktorina (ilovaning «Bonuslar» bo'limida): mijoz fan tanlaydi, 10 ta tasodifiy savol, har biriga 30 soniya.
// Javoblar faqat serverda tekshiriladi (to'g'ri javob ilovaga oldindan berilmaydi), kech javob noto'g'ri hisoblanadi.
// O'ynash uchun Telegram kanal va Instagram obunasi shart (sozlangan bo'lsa).
// 10 tadan 8 tasi to'g'ri — 1 ta tekin ish, mijozga BIR MARTA. Bu tekin ish faqat oddiy xizmatlar uchun (QUIZ_OK):
// PRO taqdimot, kurs ishi, maqola, devoriy gazeta va boshqa qimmat xizmatlarga ishlatilmaydi.
// Holat: Storage ai-uploads/<mijoz>/prefs/quiz.json; bonus: prefs/bonus-quiz.json { at, left }.
// ---------------------------------------------------------------
const crypto = require("crypto");
const supabase = require("./db");
const BANK = require("./quiz-bank");

const BUCKET = "ai-uploads";
// Viktorina vaqtincha yopiq («Tez kunda»): bonuslar ko'payib ketdi. Qayta ochish — Vercel env QUIZ=1
const QUIZ_ON = () => process.env.QUIZ === "1";
const N = 10, PASS = 8, LIMIT_SEC = 30, GRACE_MS = 3000; // internet kechikishi uchun 3 soniya
const QUIZ_OK = ["presentation", "essay", "referat", "test", "questions", "crossword", "lesson"];
const statePath = (uid) => `${parseInt(uid, 10)}/prefs/quiz.json`;
const markPath = (uid) => `${parseInt(uid, 10)}/prefs/bonus-quiz.json`;
const ALL = { id: "mix", icon: "🎲", name: "Aralash", qs: BANK.flatMap((c) => c.qs) };
const catOf = (id) => (id === "mix" ? ALL : BANK.find((c) => c.id === id));

async function readJson(p) {
  const { data } = await supabase.storage.from(BUCKET).download(p);
  if (!data) return null;
  try { return JSON.parse(Buffer.from(await data.arrayBuffer()).toString("utf8")); } catch (e) { return null; }
}
async function writeJson(p, obj, upsert = true) {
  return supabase.storage.from(BUCKET).upload(p, Buffer.from(JSON.stringify(obj)), { contentType: "application/json", upsert });
}

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function pick(cat) {
  return shuffle(cat.qs.map((_, i) => i)).slice(0, N).map((q) => ({ q, order: shuffle([0, 1, 2, 3]) })); // order[k] — k-tugmadagi javob (0 = to'g'ri)
}
function view(cat, st) {
  const it = st.qs[st.i], q = cat.qs[it.q];
  return { i: st.i, n: N, text: q[0], opts: it.order.map((o) => q[1 + o]), limit: LIMIT_SEC };
}

// Obuna sharti: Telegram kanal (jonli tekshiruv) va Instagram (mijoz tasdiqlagan belgi)
async function needSub(bot, uid) {
  if (String(uid) === String(process.env.OWNER_CHAT_ID)) return [];
  const B = require("./bonus");
  const need = [];
  const tg = await B.subscription(bot, uid);
  if (!tg.ok) need.push("tg");
  if (B.instagram()) { const t = await B.bonusTasks(uid).catch(() => ({})); if (t.ig && !t.ig.done) need.push("ig"); }
  return need;
}

async function status(uid) {
  const mark = await readJson(markPath(uid)).catch(() => null);
  return {
    cats: [...BANK.map((c) => ({ id: c.id, icon: c.icon, name: c.name, n: c.qs.length })), { id: "mix", icon: ALL.icon, name: ALL.name, n: ALL.qs.length }],
    taken: !!mark, left: mark ? mark.left || 0 : 0, pass: PASS, n: N, ok: QUIZ_OK, soon: !QUIZ_ON(),
  };
}

async function start(bot, uid, catId) {
  if (!QUIZ_ON()) return { ok: false, error: "Viktorina tez kunda ochiladi" };
  const cat = catOf(String(catId || ""));
  if (!cat) return { ok: false, error: "Fan topilmadi" };
  const need = await needSub(bot, uid);
  if (need.length) return { ok: false, code: "needSub", need };
  const st = { id: crypto.randomBytes(4).toString("hex"), cat: cat.id, qs: pick(cat), i: 0, ok: 0, sentAt: Date.now() };
  await writeJson(statePath(uid), st);
  return { ok: true, id: st.id, q: view(cat, st) };
}

// Bonus: bir martalik belgi (upsert:false — parallel so'rovda ham bitta)
async function grant(uid) {
  const { error } = await writeJson(markPath(uid), { at: new Date().toISOString(), left: 1 }, false);
  return !error;
}

async function answer(uid, id, i, k) {
  if (!QUIZ_ON()) return { ok: false, code: "old" };
  const st = await readJson(statePath(uid)).catch(() => null);
  if (!st || st.id !== id || +i !== st.i || st.done) return { ok: false, code: "old" };
  const cat = catOf(st.cat), it = st.qs[st.i];
  const late = Date.now() - st.sentAt > LIMIT_SEC * 1000 + GRACE_MS;
  const good = !late && k != null && it.order[+k] === 0;
  if (good) st.ok++;
  const right = it.order.indexOf(0);
  st.i++;
  const out = { ok: true, good, late, right, score: st.ok };
  if (st.i < N) { st.sentAt = Date.now(); out.q = view(cat, st); }
  else {
    st.done = true;
    out.done = true;
    out.passed = st.ok >= PASS;
    out.granted = out.passed ? await grant(uid).catch(() => false) : false;
  }
  await writeJson(statePath(uid), st);
  return out;
}

// Buyurtmada viktorina tekin ishini ishlatish (faqat QUIZ_OK xizmatlar)
async function takeQuizCredit(uid, service) {
  if (!QUIZ_OK.includes(service)) return false;
  const m = await readJson(markPath(uid)).catch(() => null);
  if (!m || !(m.left > 0)) return false;
  const { error } = await writeJson(markPath(uid), { ...m, left: 0, usedAt: new Date().toISOString(), usedFor: service });
  return !error;
}

module.exports = { status, start, answer, takeQuizCredit, QUIZ_OK, N, PASS };
