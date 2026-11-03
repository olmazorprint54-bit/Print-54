// api/_lib/pres-fit.js
// ---------------------------------------------------------------
// Tayyor taqdimot joylashuvini HAQIQIY shriftlar bilan tekshirish: PPTX -> HTML (pptx-render.js) ->
// Chrome'da har bir yozuvli shakl o'lchanadi. Topiladigan xatolar:
//   overY  — matn qutidan pastga chiqib ketdi
//   overX  — bir qatorli (wrap="none") matn qutidan eniga chiqdi
//   broken — so'z qatorlarga bo'linib ketdi (tor quti: "M a z m u n")
//   move   — ikki yozuv ustma-ust tushdi: pastdagisi shuncha px pastga surilsa bo'sh joyga tushadi
//            (bo'sh joy bo'lmasa — yuqoridagisi overY bo'lib kichrayadi)
// Shablonning o'zida ham ustma-ust turgan juftlar (dizayn: katta raqam ustida sarlavha) — tuzatilmaydi:
// overlaps(items, ignore) ga shablon o'lchovidan olingan juftlar beriladi.
// Tuzatishni pres-gen.js qiladi (qutini kengaytirish / shriftni kichraytirish / surish / qisqartirish).
// ---------------------------------------------------------------
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pptxToHtml } = require("./pptx-render");

// sahifada ishlaydigan o'lchov (puppeteer page.evaluate): har slayd — yozuvli shakllar ro'yxati
function probe() {
  return [...document.querySelectorAll("section.sl")].map((sec) => {
    const H = sec.getBoundingClientRect().height, items = [];
    sec.querySelectorAll(".sh[data-id]").forEach((sh) => {
      const tx = sh.querySelector(":scope > .tx");
      if (!tx || !tx.textContent.trim()) return;
      const box = sh.getBoundingClientRect();
      const cs = getComputedStyle(tx);
      const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0, padT = parseFloat(cs.paddingTop) || 0, padB = parseFloat(cs.paddingBottom) || 0;
      const range = document.createRange();
      range.selectNodeContents(tx);
      const rects = [...range.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5);
      if (!rects.length) return;
      let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity;
      for (const q of rects) { top = Math.min(top, q.top); bot = Math.max(bot, q.bottom); left = Math.min(left, q.left); right = Math.max(right, q.right); }
      let broken = false, maxWord = 0;
      const walker = document.createTreeWalker(tx, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent, re = /\S+/g;
        let m;
        while ((m = re.exec(t))) {
          const wr = document.createRange();
          wr.setStart(node, m.index); wr.setEnd(node, m.index + m[0].length);
          const cr = [...wr.getClientRects()].filter((q) => q.width > 0.5);
          if (cr.length > 1) broken = true;
          maxWord = Math.max(maxWord, cr.reduce((a, q) => a + q.width, 0));
        }
      }
      const span = tx.querySelector("span");
      const fpx = span ? parseFloat(getComputedStyle(span).fontSize) : 0;
      const nowrap = [...tx.querySelectorAll(".p")].some((p) => p.style.whiteSpace === "nowrap");
      const innerW = box.width - padL - padR, innerH = box.height - padT - padB;
      const ch = bot - top, cw = right - left;
      items.push({
        id: sh.dataset.id, boxW: box.width, boxH: box.height, innerW, innerH, cw, ch, maxWord, fpx, broken,
        overY: ch > Math.max(innerH, 4) * 1.04 + 3, overX: nowrap && cw > box.width + 3,
        r: { top, bot, left, right },
      });
    });
    return { H, items };
  });
}

const inter = (a, b) => { const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bot, b.bot) - Math.max(a.top, b.top); return w > 2 && h > 2 ? w * h : 0; };
const hit = (a, b, k = 0.12) => {
  const x = inter(a, b);
  if (!x) return false;
  const area = (r) => (r.right - r.left) * (r.bot - r.top);
  return x >= k * Math.min(area(a), area(b));
};
const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// bir slayddagi ustma-ust juftlar (ignore — shablonda ustma-ust turgan juftlar: kalit -> o'sha joy maydoni;
// yangi matnda ustma-ustlik shablondagidan sezilarli katta bo'lsa — baribir tuzatiladi)
function overlaps(slide, ignore = new Map(), grown = () => false) {
  const all = slide.items;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A = all[i], B = all[j];
    if (!hit(A.r, B.r)) continue;
    const was = ignore.get(pairKey(A.id, B.id));
    if (was != null && inter(A.r, B.r) <= was * 1.6 + 400 && !grown(A.id) && !grown(B.id)) continue;
    const [U, D] = A.r.top <= B.r.top ? [A, B] : [B, A];
    const dy = U.r.bot - D.r.top + 6;
    const moved = { top: D.r.top + dy, bot: D.r.bot + dy, left: D.r.left, right: D.r.right };
    const free = dy > 0 && moved.bot <= slide.H - 4 && all.every((O) => O === D || O === U || !hit(O.r, moved, 0));
    if (free) { D.move = Math.max(D.move || 0, dy); D.r = moved; continue; }
    // shablon bezagidagi kichik yozuv (masalan "of") ga uzun matn tushgan: o'sha yozuv namunadek qisqaradi
    const area = (X) => (X.r.right - X.r.left) * (X.r.bot - X.r.top);
    const small = area(A) <= area(B) ? A : B;
    if (grown(small.id)) { small.shrinkText = true; continue; }
    const room = D.r.top - U.r.top - 4;
    if (room > 0) { U.overY = true; U.innerH = Math.min(U.innerH, room); }
  }
}
// shablon o'lchovidan: har slayddagi ustma-ust juftlar
const designPairs = (slide) => {
  const s = new Map(), all = slide.items;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const x = inter(all[i].r, all[j].r); if (x) s.set(pairKey(all[i].id, all[j].id), x); }
  return s;
};

// buf — PPTX; withPage — resume-pdf.js dagi Chrome sahifasi. Natija: probe() ro'yxati (slaydlar bo'yicha)
async function measure(buf, withPage) {
  const { html, width, height } = await pptxToHtml(buf);
  const tmp = path.join(os.tmpdir(), `fit-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  fs.writeFileSync(tmp, html);
  try {
    return await withPage(async (page) => {
      await page.setViewport({ width: Math.round(width), height: Math.round(height) });
      await page.goto("file://" + (tmp.startsWith("/") ? "" : "/") + tmp.split("\\").join("/"), { waitUntil: "networkidle0", timeout: 60000 });
      await page.evaluate(async () => { await document.fonts.ready; });
      return page.evaluate(probe);
    });
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* tozalanadi */ }
  }
}

// Tayyor taqdimot muammolari. layoutOf(n) — n-slayd shablonning qaysi slaydidan; designOf(L) — o'sha shablon
// slaydidagi dizayn juftlari (Set) yoki null
function issuesOf(measured, layoutOf, designOf, grown = () => false) {
  const out = [];
  measured.forEach((sl, i) => {
    overlaps(sl, designOf(layoutOf(i + 1)) || new Map(), (id) => grown(i + 1, id));
    for (const x of sl.items) if (x.overY || x.overX || x.broken || x.move || x.shrinkText) { const { r, ...rest } = x; out.push({ n: i + 1, ...rest }); }
  });
  return out;
}

module.exports = { measure, probe, overlaps, designPairs, issuesOf };
