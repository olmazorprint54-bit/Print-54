/* ================================================================
   AI XIZMATLAR — MANTIQ
   Xizmatlar menyusi, shakllar, shablonlar ko'rinishi va so'rov
   yuborish. Sozlamalar: ai/config.js
   ================================================================ */
(function () {
  const CFG = window.AI_CONFIG;
  const root = document.getElementById("aiRoot");
  if (!CFG || !root) return;

  const tg = window.Telegram ? window.Telegram.WebApp : null;
  const YEAR = new Date().getFullYear();

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const optV = (o) => (typeof o === "object" ? o.v : o);
  const optL = (o) => (typeof o === "object" ? o.l : o);
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const fmt = (n) => Math.round(n).toLocaleString("ru-RU") + " so'm";
  // Narxlar: ai/prices.js (server ham shundan hisoblaydi); u yerda yo'q xizmat — config.js
  const PR = window.AI_PRICES;
  const priceText = (id) => {
    const p = PR && PR.fromPrice(id);
    if (p != null) return p === 0 ? "Tekin" : PR.TRIAL ? "Tekin (sinov)" : fmt(p) + "dan";
    return CFG.prices[id] == null ? "Narxi kelishiladi" : CFG.prices[id] === 0 ? "Tekin" : fmt(CFG.prices[id]);
  };
  const haptic = (kind) => { try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred(kind); } catch (e) {} };
  const tick = () => { try { tg && tg.HapticFeedback && tg.HapticFeedback.selectionChanged(); } catch (e) {} };

  const valuesBy = {};
  let current = null; // tanlangan xizmat

  /* ---------------------------------------------------------------
     REJIM ALMASHTIRISH
     --------------------------------------------------------------- */
  function setMode(mode) {
    document.body.classList.toggle("ai-mode", mode === "ai");
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    if (mode === "ai" && !current) renderGrid();
    syncBackButton();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => { tick(); setMode(b.dataset.mode); }));
  // "Buyurtmalarim" tugmasi bosilsa — chop etish rejimiga qaytamiz
  const btnOrders = document.getElementById("btnOther");
  if (btnOrders) btnOrders.addEventListener("click", () => setMode("print"));

  function syncBackButton() {
    if (!tg || !tg.BackButton) return;
    const inForm = document.body.classList.contains("ai-mode") && current;
    inForm ? tg.BackButton.show() : tg.BackButton.hide();
  }
  if (tg && tg.BackButton) tg.BackButton.onClick(() => { if (current) openGrid(); });

  /* ---------------------------------------------------------------
     XIZMATLAR TO'RI
     --------------------------------------------------------------- */
  function renderGrid() {
    // Umumiy AI ilova (public/app) o'z bosh qismini beradi
    const APP = window.AI_APP || {};
    root.innerHTML = APP.heroHtml ? `${APP.heroHtml}<div class="ai-grid">${gridCards()}</div>` : `
      <div class="ai-hero glass">
        <h2>✨ AI xizmatlar</h2>
        <p>Taqdimot, mustaqil ish, referat, dars ishlanma, test, krossvord va resume'ni sun'iy intellekt yordamida tayyorlang — va shu yerning o'zida chop ettiring.</p>
        <div class="ai-note">⏳ <span>Xizmat sinov bosqichida: so'rovingizni qoldiring, tayyor hujjatni shu bot orqali yuboramiz.</span></div>
      </div>
      <div class="ai-grid">${gridCards()}</div>`;
  }
  // Umumiy ilovada hali AI bilan avtomatik bo'lmagan xizmatlar — "Tez kunda"
  const soonSet = () => new Set((window.AI_APP || {}).soon || []);
  function gridCards() {
    const soon = soonSet();
    const list = [...CFG.services.filter((s) => !soon.has(s.id)), ...CFG.services.filter((s) => soon.has(s.id))];
    return list.map((s) => soon.has(s.id) ? `
          <div class="ai-card glass soon">
            <div class="ic" style="background:${s.color}">${s.icon}</div>
            <div class="t">${esc(s.title)}</div>
            <div class="s">${esc(s.sub)}</div>
            <div class="p">Tez kunda</div>
          </div>` : `
          <div class="ai-card glass" data-open="${s.id}">
            <div class="ic" style="background:${s.color}">${s.icon}</div>
            <div class="t">${esc(s.title)}</div>
            <div class="s">${esc(s.sub)}</div>
            <div class="p">${esc(priceText(s.id))}</div>
          </div>`).join("");
  }

  function openGrid() {
    current = null;
    renderGrid();
    syncBackButton();
    window.scrollTo(0, 0);
  }
  window.aiOpenGrid = openGrid; // umumiy ilova pastki menyusi uchun

  /* ---------------------------------------------------------------
     SHAKL
     --------------------------------------------------------------- */
  function getValues(svc) {
    if (!valuesBy[svc.id]) {
      const v = {};
      svc.fields.forEach((f) => {
        if (f.type === "heading") return;
        if (Array.isArray(f.default)) v[f.id] = f.default.map((x) => (x && typeof x === "object" ? { ...x } : x));
        else if (f.default !== undefined) v[f.id] = f.default;
        else v[f.id] = f.type === "switch" ? false : "";
      });
      valuesBy[svc.id] = v;
    }
    return valuesBy[svc.id];
  }

  const label = (f) => `<div class="field-title">${esc(f.label)}${f.required ? '<span class="ai-req">*</span>' : ""}</div>` +
    (f.hint && f.type !== "photos" && f.type !== "relatives" ? `<div class="ai-hint">${esc(f.hint)}</div>` : "");

  function fieldHtml(svc, f, v) {
    switch (f.type) {
      case "heading":
        return `<div class="ai-heading">${esc(f.label)}</div>`;
      case "text":
        return `<div class="ai-field" data-f="${f.id}">${label(f)}
          <input class="ai-input" data-input="${f.id}"${f.inputmode ? ` inputmode="${f.inputmode}"` : ""} maxlength="${f.max || 200}" placeholder="${esc(f.placeholder || "")}" value="${esc(v[f.id])}">
          <div class="ai-err">Iltimos, shu maydonni to'ldiring</div></div>`;
      case "number":
        return `<div class="ai-field" data-f="${f.id}">${label(f)}
          <input class="ai-input" data-input="${f.id}" type="number" inputmode="numeric" min="${f.min}" max="${f.max}" placeholder="${esc(f.placeholder || "")}" value="${esc(v[f.id])}">
          <div class="ai-err">${f.min} dan ${f.max} gacha son kiriting</div></div>`;
      case "textarea":
        return `<div class="ai-field" data-f="${f.id}">${label(f)}
          <textarea class="ai-input" data-input="${f.id}" maxlength="${f.max || 1000}" placeholder="${esc(f.placeholder || "")}">${esc(v[f.id])}</textarea>
          <div class="ai-count" data-count="${f.id}">${String(v[f.id] || "").length} / ${f.max || 1000}</div>
          <div class="ai-err">Iltimos, shu maydonni to'ldiring</div></div>`;
      case "chips":
        return `<div class="ai-field">${label(f)}<div class="chips${f.compact ? " compact" : ""}" data-chips="${f.id}">
          ${f.options.map((o) => `<div class="chip${v[f.id] === optV(o) ? " active" : ""}" data-v="${esc(optV(o))}">${esc(optL(o))}</div>`).join("")}
          </div></div>`;
      case "multichips":
        return `<div class="ai-field">${label(f)}<div class="chips" data-multi="${f.id}">
          ${f.options.map((o) => `<div class="chip multi${v[f.id].includes(optV(o)) ? " active" : ""}" data-v="${esc(optV(o))}">${esc(optL(o))}</div>`).join("")}
          </div></div>`;
      case "switch":
        return `<div class="ai-field"><label class="switch-row glass"><span>${esc(f.label)}</span>
          <span class="switch"><input type="checkbox" data-switch="${f.id}"${v[f.id] ? " checked" : ""}><span class="slider"></span></span></label></div>`;
      case "relatives":
        return `<div class="ai-field" data-f="${f.id}">${label(f)}
          <div class="ai-hint">${esc(f.hint || "")}</div>
          <div class="rel-list" data-rel="${f.id}">${relCards(svc, f, v)}</div>
          <div class="tpl-more glass" data-rel-add="${f.id}">+ Qarindosh qo'shish</div>
          <div class="ai-err">Qarindoshlar bo'limidagi qizil maydonlarni to'g'rilang</div></div>`;
      case "photos":
        return `<div class="ai-field" data-f="${f.id}">${label(f)}
          <div class="ai-hint">${esc(f.hint || "")}</div>
          <div class="ph-grid" data-photos="${f.id}">${photoTiles(svc, f)}</div>
          <input type="file" accept="image/*" multiple hidden data-photo-input="${f.id}">
          <div class="ai-err">Rasmlar hali yuklanmoqda — biroz kuting</div></div>`;
      case "templates":
        return `<div class="ai-field" data-f="${f.id}">${label(f)}
          ${hasCategories(f) ? `<div class="chips tpl-cats" data-cats="${f.id}">${categoryChips(svc, f)}</div>` : ""}
          <div class="tpl-row${f.set === "presentation" ? "" : " doc"}" data-tpl="${f.id}">${templateCards(svc, f, v)}</div>
          <div class="tpl-more glass" data-preview="${f.id}">🔍 Kattaroq ko'rish</div></div>`;
      default:
        return "";
    }
  }

  /* ---------------------------------------------------------------
     MIJOZ RASMLARI (telefonda kichraytirilib, serverga yuklanadi)
     --------------------------------------------------------------- */
  const photoState = {}; // xizmat id -> [{ key, thumb, path, status: "up" | "ok" | "err" }]
  const photosOf = (svc) => (photoState[svc.id] = photoState[svc.id] || []);
  let photoSeq = 0;

  function photoTiles(svc, f) {
    const list = photosOf(svc);
    return list.map((p) => `<div class="ph-tile ${p.status}" data-ph="${p.key}">
        <img src="${p.thumb}" alt="">
        ${p.status === "up" ? '<div class="ph-spin"></div>' : ""}
        ${p.status === "err" ? '<div class="ph-bad">Yuklanmadi</div>' : ""}
        <div class="ph-x" data-ph-del="${p.key}">×</div>
      </div>`).join("") +
      (list.length < f.max ? `<div class="ph-add glass" data-ph-add="${f.id}"><b>+</b><span>Rasm qo'shish</span></div>` : "");
  }

  function syncPhotos(svc) {
    const f = svc.fields.find((x) => x.type === "photos");
    if (!f) return;
    getValues(svc)[f.id] = photosOf(svc).filter((p) => p.status === "ok").map((p) => p.path);
    const grid = root.querySelector(`[data-photos="${f.id}"]`);
    if (grid && current === svc) grid.innerHTML = photoTiles(svc, f);
    if (!photosOf(svc).some((p) => p.status === "up")) {
      const el = root.querySelector(`.ai-field[data-f="${f.id}"]`);
      if (el) el.classList.remove("error");
    }
    if (current === svc) refreshLive(svc);
  }

  // Katta rasmni 1600px gacha kichraytirib JPEG qilamiz (+ kichik ko'rinish)
  function shrinkImage(file, aspect) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const draw = (maxSide, q) => {
          // aspect (kenglik/balandlik) berilsa — markazdan qirqiladi (3x4 = 0.75)
          let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
          if (aspect) {
            if (sw / sh > aspect) { sx = (sw - sh * aspect) / 2; sw = sh * aspect; }
            else { sy = (sh - sw / aspect) / 2; sh = sw / aspect; }
          }
          const k = Math.min(1, maxSide / Math.max(sw, sh));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(sw * k));
          c.height = Math.max(1, Math.round(sh * k));
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
          return c.toDataURL("image/jpeg", q);
        };
        const out = { full: draw(1600, 0.85), thumb: draw(240, 0.7) };
        URL.revokeObjectURL(url);
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Rasmni ochib bo'lmadi")); };
      img.src = url;
    });
  }

  async function uploadPhoto(svc, p, full) {
    try {
      const res = await fetch(CFG.uploadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: full.split(",")[1], initData: tg ? tg.initData : null, bot: (window.AI_APP || {}).bot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Server xatosi");
      p.path = data.path;
      p.status = "ok";
    } catch (err) {
      console.error(err);
      p.status = "err";
      haptic("error");
    }
    syncPhotos(svc);
  }

  async function addPhotos(svc, f, files) {
    const list = photosOf(svc);
    const room = f.max - list.length;
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) continue;
      const p = { key: "p" + ++photoSeq, thumb: "", path: null, status: "up" };
      try {
        const { full, thumb } = await shrinkImage(file, f.aspect);
        p.thumb = thumb;
        list.push(p);
        syncPhotos(svc);
        uploadPhoto(svc, p, full);
      } catch (err) {
        console.error(err);
        haptic("error");
      }
    }
  }

  /* ---------------------------------------------------------------
     TEKSHIRUVLAR (obyektivka: to'liq F.I.Sh., sana, qisqartmalar)
     --------------------------------------------------------------- */
  const ABBR_RE = /(^|[\s,(])(vil|tum|sh|sh-|mah|ko['‘’ʻ]?ch|kuch|r-n|obl|resp|res)\.(?=\s|,|$)/i;
  function checkText(kind, value, required) {
    const s = String(value || "").trim();
    if (!s) return required ? "Iltimos, shu maydonni to'ldiring" : "";
    if (kind === "fio" && s.split(/\s+/).length < 3) return "Familiya, ism va otasining ismini to'liq yozing — masalan: Karimov Anvar Rustamovich";
    if (kind === "date" && !/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return "Sanani kun.oy.yil ko'rinishida yozing — masalan: 14.03.1985";
    if (kind === "year" && !/\b(19|20)\d{2}\b/.test(s)) return "Yilni to'liq yozing — masalan: 1965 yil, Samarqand viloyati, Urgut tumani";
    if (kind === "work") {
      const bad = s.split(/\n+/).map((x) => x.trim()).filter(Boolean).find((x) => !/^(19|20)\d{2}/.test(x));
      if (bad) return `Har bir qator yil bilan boshlansin: «${clip(bad, 30)}» — masalan: 2009-2018 yy. - ...`;
    }
    const m = kind && s.match(ABBR_RE);
    if (m) return `Qisqartirmang: «${m[2]}.» o'rniga to'liq yozing (viloyati, tumani, shahri, mahallasi, ko'chasi)`;
    return "";
  }

  /* ---------------------------------------------------------------
     QARINDOSHLAR (obyektivka)
     --------------------------------------------------------------- */
  const REL_TYPES = ["Otasi", "Onasi", "Akasi", "Ukasi", "Opasi", "Singlisi", "Turmush o'rtog'i", "O'g'li", "Qizi", "Qaynotasi", "Qaynonasi"];
  const relErrors = {}; // xizmat id -> [{ maydon: xato }]
  const REL_INPUTS = [
    ["name", "Familiyasi, ismi, otasining ismi", "Masalan: Karimov Rustam Aliyevich"],
    ["birth", "Tug'ilgan yili va joyi", "Masalan: 1958 yil, Samarqand viloyati, Urgut tumani"],
  ];
  const REL_ALIVE = [
    ["work", "Ish joyi va lavozimi (pensiyada bo'lsa: «Pensiyada (oldingi lavozimi)»)", "Masalan: Urgut tumani 3-maktab o'qituvchisi"],
    ["address", "Turar joyi (to'liq manzil)", "Masalan: Urgut tumani, Navbahor ko'chasi, 12-uy"],
  ];
  const REL_DEAD = [
    ["deathYear", "Vafot etgan yili", "Masalan: 2015"],
    ["lastJob", "Oxirgi kasbi", "Masalan: maktab o'qituvchisi"],
  ];

  function relCards(svc, f, v) {
    const errs = relErrors[svc.id] || [];
    const input = (i, r, [k, lbl, ph]) => {
      const e = (errs[i] || {})[k];
      return `<div class="rel-in${e ? " bad" : ""}"><div class="rel-lbl">${esc(lbl)}</div>
        <input class="ai-input" data-rin="${i}" data-k="${k}" placeholder="${esc(ph)}" value="${esc(r[k] || "")}"${k === "deathYear" ? ' inputmode="numeric" maxlength="4"' : ' maxlength="300"'}>
        ${e ? `<div class="rel-err">${esc(e)}</div>` : ""}</div>`;
    };
    return (v[f.id] || []).map((r, i) => `<div class="rel-card glass">
        <div class="rel-head"><b>${i + 1}. ${esc(r.rel || "Qarindosh")}</b><span class="rel-x" data-rel-del="${i}">×</span></div>
        <div class="chips rel-chips${(errs[i] || {}).rel ? " bad" : ""}" data-relchips="${i}">${REL_TYPES.map((t) => `<div class="chip${r.rel === t ? " active" : ""}" data-v="${esc(t)}">${esc(t)}</div>`).join("")}</div>
        ${REL_INPUTS.map((x) => input(i, r, x)).join("")}
        <label class="switch-row rel-dead"><span>Vafot etgan</span><span class="switch"><input type="checkbox" data-rsw="${i}"${r.dead ? " checked" : ""}><span class="slider"></span></span></label>
        ${(r.dead ? REL_DEAD : REL_ALIVE).map((x) => input(i, r, x)).join("")}
      </div>`).join("");
  }

  function redrawRelatives(svc) {
    const f = svc.fields.find((x) => x.type === "relatives");
    const list = f && root.querySelector(`[data-rel="${f.id}"]`);
    if (list) list.innerHTML = relCards(svc, f, getValues(svc));
  }

  // true — xato bor
  function validateRelatives(svc, v, f) {
    const rows = v[f.id] || [];
    const errs = rows.map((r) => {
      const e = {};
      if (!r.rel) e.rel = "Qarindoshligini tanlang";
      const put = (k, msg) => { if (msg) e[k] = msg; };
      put("name", checkText("fio", r.name, true));
      put("birth", checkText("year", r.birth, true) || checkText("noabbr", r.birth, true));
      if (r.dead) put("deathYear", /^(19|20)\d{2}$/.test(String(r.deathYear || "").trim()) ? "" : "Yilni yozing — masalan: 2015");
      else {
        put("work", checkText("noabbr", r.work, true));
        put("address", checkText("noabbr", r.address, true));
      }
      return e;
    });
    relErrors[svc.id] = errs;
    redrawRelatives(svc);
    return !rows.length || errs.some((e) => Object.keys(e).length);
  }

  /* ---------------------------------------------------------------
     SHABLON TOIFALARI (fan bo'yicha filtr)
     --------------------------------------------------------------- */
  const catState = {}; // xizmat id -> { cat, manual, tplManual }
  const getCat = (svc) => (catState[svc.id] = catState[svc.id] || { cat: "all", manual: false, tplManual: false });
  const hasCategories = (f) => f.set === "presentation" && Array.isArray(CFG.categories);

  function detectCategory(v) {
    const text = `${v.subject || ""} ${v.topic || ""}`.toLowerCase();
    if (!text.trim()) return null;
    const hit = CFG.categories.find((c) => c.keys.some((k) => text.includes(k)));
    return hit ? hit.v : null;
  }

  function categoryChips(svc, f) {
    const used = new Set(CFG.templates[f.set].map((t) => t.category));
    const hasAuto = CFG.templates[f.set].some((t) => t.auto) && CFG.templates[f.set].some((t) => !t.auto);
    const cats = [{ v: "all", l: "Barchasi" }].concat(hasAuto ? [{ v: "ai", l: "⚡ AI tayyorlaydi" }] : [], CFG.categories.filter((c) => used.has(c.v)));
    const st = getCat(svc);
    return cats.map((c) => `<div class="chip${st.cat === c.v ? " active" : ""}" data-cat="${c.v}">${esc(c.l)}</div>`).join("");
  }

  // AI tayyorlaydigan shablonlar (auto) har doim ro'yxat boshida
  const autoFirst = (list) => list.filter((t) => t.auto).concat(list.filter((t) => !t.auto));
  function templateList(svc, f, v) {
    const all = CFG.templates[f.set];
    if (!hasCategories(f)) return all;
    const st = getCat(svc);
    if (st.cat === "ai") return all.filter((t) => t.auto);
    if (st.cat !== "all") return autoFirst(all.filter((t) => t.category === st.cat));
    const det = detectCategory(v);
    return det ? autoFirst(all.filter((t) => t.category === det)).concat(autoFirst(all.filter((t) => t.category !== det))) : autoFirst(all);
  }

  // Mavzu yoki fan yozilganda mos toifani avtomatik tanlaydi
  // ✨ AI dizayn va aqlli uslublar (s-*) mavzuga o'zi moslashadi — ularni almashtirmaymiz
  const isSmartTpl = (id) => id === "ai-dizayn" || /^s-/.test(String(id || ""));
  function autoCategory(svc, f, v) {
    const st = getCat(svc);
    if (st.manual || isSmartTpl(v[f.id])) return;
    const det = detectCategory(v);
    const next = det && CFG.templates[f.set].some((t) => t.category === det) ? det : "all";
    if (next === st.cat) return;
    st.cat = next;
    if (!st.tplManual && next !== "all") {
      const inCat = CFG.templates[f.set].filter((t) => t.category === next);
      const cur = CFG.templates[f.set].find((t) => t.id === v[f.id]);
      const first = inCat.find((t) => t.auto) || (cur && cur.auto ? null : inCat[0]);
      if (first) v[f.id] = first.id;
    }
  }

  // t.page — A4 hujjat (resume), aks holda 16:9 slayd
  const canvaImg = (t, n) => t.page
    ? `<div class="page-box"><div class="page"${t.ratio ? ` style="aspect-ratio:${t.ratio}"` : ""}><img class="el" src="/ai/templates/${t.id}/${n}.jpg" alt="" loading="lazy" style="inset:0;width:100%;height:100%;object-fit:cover;object-position:top"></div></div>`
    : `<div class="slide-box"><div class="slide"><img class="el" src="/ai/templates/${t.id}/${n}.jpg" alt="" loading="lazy" style="inset:0;width:100%;height:100%;object-fit:cover"></div></div>`;

  function templateCards(svc, f, v) {
    return templateList(svc, f, v).map((t) => `
      <div class="tpl-card glass${v[f.id] === t.id ? " active" : ""}" data-v="${t.id}">
        ${t.kind === "canva" ? canvaImg(t, 1) : f.set === "presentation" ? slideHtml(t, "title", sampleData(svc, v)) : pageHtml(svc.id, t, "main", sampleData(svc, v))}
        <div class="tpl-name">${esc(t.name)}</div>
        ${t.auto ? '<div class="tpl-badge">⚡ 1 daqiqada</div>' : ""}
      </div>`).join("");
  }

  // showIf: maydon faqat bog'liq kalit yoqilganda ko'rinadi
  const shown = (svc, v, id) => { const f = svc.fields.find((x) => x.id === id); return !f || !f.showIf || !!v[f.showIf]; };
  function applyShowIf(svc) {
    const v = getValues(svc);
    svc.fields.filter((f) => f.showIf).forEach((f) => {
      const el = root.querySelector(`.ai-field[data-f="${f.id}"]`);
      if (el) el.hidden = !v[f.showIf];
    });
  }

  function renderForm(svc) {
    const v = getValues(svc);
    root.innerHTML = `
      <div class="ai-top">
        <div class="ai-back glass" data-back="1"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></div>
        <div class="ic" style="background:${svc.color}">${svc.icon}</div>
        <div><div class="t">${esc(svc.title)}</div><div class="s">${esc(svc.sub)}</div></div>
      </div>
      <form id="aiForm" onsubmit="return false">
        ${svc.fields.map((f) => fieldHtml(svc, f, v)).join("")}
      </form>
      <section>
        <div class="receipt glass ai-summary" id="aiSummary">${summaryHtml(svc, v)}</div>
        <button type="button" class="order-btn" id="aiSubmit">So'rov yuborish</button>
        <div class="ai-disclaimer">AI tayyorlagan matnni topshirishdan oldin o'qib chiqing: sun'iy intellekt ba'zan fakt yoki manbalarda xato qilishi mumkin.</div>
        <div class="status-msg" id="aiStatus"></div>
      </section>`;
  }

  function openService(id) {
    if (soonSet().has(id)) { openGrid(); return; }
    const svc = CFG.services.find((s) => s.id === id);
    if (!svc) return;
    current = svc;
    renderForm(svc);
    applyShowIf(svc);
    syncBackButton();
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------
     YAKUNIY MA'LUMOT (chek)
     --------------------------------------------------------------- */
  function displayValue(f, val) {
    if (f.type === "chips") { const o = f.options.find((x) => optV(x) === val); return o ? optL(o) : val; }
    if (f.type === "multichips") return val.map((x) => { const o = f.options.find((y) => optV(y) === x); return o ? optL(o) : x; }).join(", ");
    if (f.type === "switch") return val ? "Ha" : "Yo'q";
    if (f.type === "photos") return val && val.length ? `${val.length} ta rasm` : "";
    if (f.type === "relatives") return val && val.length ? `${val.length} ta qarindosh` : "";
    if (f.type === "templates") { const t = CFG.templates[f.set].find((x) => x.id === val); return t ? t.name : val; }
    return String(val || "").trim();
  }

  function summaryPairs(svc, v) {
    return svc.fields
      .filter((f) => f.type !== "heading")
      .map((f) => ({ label: f.label, value: displayValue(f, v[f.id]) }))
      .filter((p) => p.value !== "");
  }

  // Server (api/_lib/resume-html.js canAutoResume) bilan bir xil shart
  const isAutoResume = (v) => {
    const t = CFG.templates.resume.find((x) => x.id === v.template);
    return !!(t && t.auto && v.format !== "docx");
  };

  // Test: oddiy dizaynlar va Telegram quiz — AI avtomatik (api/_lib/test-gen.js)
  const isAutoTest = (v) => {
    const t = CFG.templates.test.find((x) => x.id === v.template);
    return v.format === "quiz" || !!(t && t.auto);
  };

  // Matnli AI xizmatlar: oddiy dizaynlar avtomatik (api/_lib/doc-gen.js)
  const AI_DOCS = ["essay", "referat", "lesson", "questions", "crossword"];
  const isAutoDoc = (svc, v) => {
    const f = svc.fields.find((x) => x.type === "templates");
    const t = f && CFG.templates[f.set].find((x) => x.id === v.template);
    return !!(t && t.auto);
  };

  // Avtomatik (AI) tayyorlanadimi — server bilan bir xil shart
  // Taqdimot: AI tayyorlaydigan shablon, PowerPoint, 30 slaydgacha (api/_lib/pres-gen.js)
  const isAutoPres = (v) => {
    const t = CFG.templates.presentation.find((x) => x.id === v.template);
    return !!(t && t.auto && v.format !== "pdf" && (parseInt(v.slides, 10) || 10) <= 30);
  };
  const isAuto = (svc, v) => svc.id === "obyektivka" || (svc.id === "resume" ? isAutoResume(v) : svc.id === "test" ? isAutoTest(v) : svc.id === "presentation" ? isAutoPres(v) : AI_DOCS.includes(svc.id) ? isAutoDoc(svc, v) : false);
  // Buyurtma narxi: avtomatik bo'lsa — hajmga qarab, aks holda kelishiladi
  const orderPrice = (svc, v) => {
    const p = PR && PR.priceOf(svc.id, v);
    if (p != null && (p === 0 || isAuto(svc, v))) return p;
    return p != null ? null : CFG.prices[svc.id];
  };
  const orderPriceText = (svc, v) => { const p = orderPrice(svc, v); return p == null ? "Narxi kelishiladi" : p === 0 ? "Tekin" : PR && PR.TRIAL ? "Tekin (sinov)" : fmt(p); };

  function summaryHtml(svc, v) {
    const pick = (id) => { const f = svc.fields.find((x) => x.id === id); return f ? displayValue(f, v[id]) : ""; };
    // bo'sh son maydonida standart (fallback) qiymat ko'rsatiladi
    const n = (id) => v[id] || (svc.fields.find((x) => x.id === id) || {}).fallback;
    const amount = { obyektivka: "2–3 bet, Word (.docx)", presentation: `${n("slides")} ta slayd`, essay: `${n("pages")} bet`, referat: `${n("pages")} bet`, resume: "1–2 bet", test: `${n("count")} ta savol`, questions: `${n("count")} ta savol`, crossword: `${n("words")} ta so'z`, lesson: v.duration && `${v.duration} daqiqa` }[svc.id];
    const rows = [
      ["Xizmat", svc.title],
      [svc.id === "resume" ? "Lavozim" : svc.id === "obyektivka" ? "F.I.Sh." : "Mavzu", pick("topic") || pick("position") || pick("fio") || "—"],
      ["Hajmi", amount || "—"],
      ["Shablon", pick("template")],
      ...(svc.id === "resume" ? [["Tayyor bo'ladi", isAutoResume(v) ? "⚡ 1 daqiqada (avtomatik)" : "Dizayner tayyorlaydi"]] : []),
      ...(svc.id === "test" ? [["Tayyor bo'ladi", isAutoTest(v) ? "⚡ 1–3 daqiqada (AI)" : "Dizayner tayyorlaydi"]] : []),
      ...(svc.id === "presentation" ? [["Tayyor bo'ladi", isAutoPres(v) ? "⚡ 2–4 daqiqada (AI)" : "Dizayner tayyorlaydi"]] : []),
      ...(AI_DOCS.includes(svc.id) ? [["Tayyor bo'ladi", isAutoDoc(svc, v) ? "⚡ 1–3 daqiqada (AI)" : "Dizayner tayyorlaydi"]] : []),
      ...(svc.id === "obyektivka" ? [["Tayyor bo'ladi", "⚡ 1 daqiqada (avtomatik)"], ["Qarindoshlar", `${(v.relatives || []).length} ta`]] : []),
      ...(v.photos && v.photos.length && shown(svc, v, "photos") ? [svc.id === "resume" ? ["Rasm", "Yuklandi"] : ["O'z rasmlari", `${v.photos.length} ta`]] : []),
      ...(v.charts ? [["Diagramma", "Ha"]] : []),
      ...(v.tables ? [["Jadval", "Ha"]] : []),
      ["Til", pick("lang")],
      ...(svc.fields.some((f) => f.id === "print") ? [["Chop etish", pick("print")]] : []),
    ];
    return rows.map(([k, val]) => `<div class="receipt-line"><span>${esc(k)}</span><span>${esc(val)}</span></div>`).join("") +
      // tekin xizmatda chop etish alohida hisoblanadi
      (() => { const t = orderPrice(svc, v) === 0 && v.print && v.print !== "none" ? "Tekin (chop etish alohida)" : orderPriceText(svc, v);
        return `<div class="receipt-total"><span class="t-label">NARXI</span><span class="t-value" style="font-size:${t.length > 12 ? "16px" : "23px"}">${esc(t)}</span></div>`; })();
  }

  function refreshLive(svc) {
    const v = getValues(svc);
    const sum = document.getElementById("aiSummary");
    if (sum) sum.innerHTML = summaryHtml(svc, v);
    svc.fields.filter((f) => f.type === "templates").forEach((f) => {
      const row = root.querySelector(`[data-tpl="${f.id}"]`);
      if (!row) return;
      if (hasCategories(f)) {
        const before = getCat(svc).cat;
        autoCategory(svc, f, v);
        const cats = root.querySelector(`[data-cats="${f.id}"]`);
        if (cats) {
          const sl = cats.scrollLeft;
          cats.innerHTML = categoryChips(svc, f);
          cats.scrollLeft = sl;
          // toifa o'zi almashganda tanlangan tugmani ko'rinadigan joyga suramiz
          const act = getCat(svc).cat !== before && cats.querySelector(".chip.active");
          if (act) cats.scrollLeft += act.getBoundingClientRect().left - cats.getBoundingClientRect().left - (cats.clientWidth - act.offsetWidth) / 2;
        }
        if (getCat(svc).cat !== before) row.scrollLeft = 0;
        if (sum) sum.innerHTML = summaryHtml(svc, v);
      }
      const scroll = row.scrollLeft;
      row.innerHTML = templateCards(svc, f, v);
      row.scrollLeft = scroll;
    });
  }
  let liveTimer = null;
  const refreshLiveSoon = (svc) => { clearTimeout(liveTimer); liveTimer = setTimeout(() => refreshLive(svc), 250); };

  /* ---------------------------------------------------------------
     HODISALAR
     --------------------------------------------------------------- */
  root.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) { tick(); openService(open.dataset.open); return; }
    if (e.target.closest("[data-back]")) { openGrid(); return; }
    if (e.target.closest("[data-again]")) { openGrid(); return; }
    if (e.target.closest("[data-contact]")) { contactOwner(); return; }
    if (!current) return;
    const v = getValues(current);

    // obyektivka: qarindosh qo'shish / o'chirish / qarindoshlik turi
    const relAdd = e.target.closest("[data-rel-add]");
    if (relAdd) {
      const list = v[relAdd.dataset.relAdd] || (v[relAdd.dataset.relAdd] = []);
      if (list.length < 20) list.push({ rel: "" });
      (relErrors[current.id] || []).push({});
      tick();
      redrawRelatives(current);
      refreshLive(current);
      return;
    }
    const relDel = e.target.closest("[data-rel-del]");
    if (relDel) {
      const f = current.fields.find((x) => x.type === "relatives");
      v[f.id].splice(+relDel.dataset.relDel, 1);
      (relErrors[current.id] || []).splice(+relDel.dataset.relDel, 1);
      tick();
      redrawRelatives(current);
      refreshLive(current);
      return;
    }
    const relChip = e.target.closest("[data-relchips] .chip");
    if (relChip) {
      const i = +relChip.parentElement.dataset.relchips;
      const f = current.fields.find((x) => x.type === "relatives");
      v[f.id][i].rel = relChip.dataset.v;
      const er = (relErrors[current.id] || [])[i];
      if (er) delete er.rel;
      tick();
      redrawRelatives(current);
      return;
    }

    const phAdd = e.target.closest("[data-ph-add]");
    if (phAdd) {
      const input = root.querySelector(`[data-photo-input="${phAdd.dataset.phAdd}"]`);
      if (input) input.click();
      return;
    }
    const phDel = e.target.closest("[data-ph-del]");
    if (phDel) {
      const list = photosOf(current);
      const i = list.findIndex((p) => p.key === phDel.dataset.phDel);
      if (i >= 0) list.splice(i, 1);
      tick();
      syncPhotos(current);
      return;
    }

    const catChip = e.target.closest("[data-cat]");
    if (catChip) {
      const st = getCat(current);
      st.cat = catChip.dataset.cat;
      st.manual = true;
      // mijoz shablonni o'zi tanlamagan bo'lsa — toifaning birinchisini belgilaymiz
      const fid = catChip.parentElement.dataset.cats;
      const set = current.fields.find((x) => x.id === fid)?.set;
      const first = st.cat !== "all" && !st.tplManual && set && CFG.templates[set].find((t) => t.category === st.cat);
      if (first) v[fid] = first.id;
      const row = root.querySelector(`[data-tpl="${catChip.parentElement.dataset.cats}"]`);
      if (row) row.scrollLeft = 0;
      tick();
      refreshLive(current);
      return;
    }

    const chip = e.target.closest(".chip");
    if (chip) {
      const single = chip.parentElement.dataset.chips;
      const multi = chip.parentElement.dataset.multi;
      if (single) {
        v[single] = chip.dataset.v;
        chip.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
      } else if (multi) {
        const arr = v[multi];
        const i = arr.indexOf(chip.dataset.v);
        if (i >= 0) arr.splice(i, 1); else arr.push(chip.dataset.v);
        chip.classList.toggle("active", i < 0);
      }
      tick();
      refreshLive(current);
      return;
    }

    const card = e.target.closest(".tpl-card");
    if (card) {
      const fid = card.parentElement.dataset.tpl;
      v[fid] = card.dataset.v;
      getCat(current).tplManual = true;
      card.parentElement.querySelectorAll(".tpl-card").forEach((c) => c.classList.toggle("active", c === card));
      tick();
      refreshLive(current);
      return;
    }

    const prev = e.target.closest("[data-preview]");
    if (prev) { openPreview(current, prev.dataset.preview); return; }

    if (e.target.closest("#aiSubmit")) submit(current);
  });

  root.addEventListener("input", (e) => {
    if (!current) return;
    const v = getValues(current);
    const ri = e.target.dataset.rin;
    if (ri !== undefined) {
      const f = current.fields.find((x) => x.type === "relatives");
      v[f.id][+ri][e.target.dataset.k] = e.target.value;
      // yozishni boshlaganda qizil belgi olib tashlanadi
      const box = e.target.closest(".rel-in");
      if (box && box.classList.contains("bad")) {
        box.classList.remove("bad");
        const er = box.querySelector(".rel-err");
        if (er) er.remove();
        const errs = (relErrors[current.id] || [])[+ri];
        if (errs) delete errs[e.target.dataset.k];
      }
      return;
    }
    const id = e.target.dataset.input;
    if (id) {
      v[id] = e.target.value;
      const fieldEl = e.target.closest(".ai-field");
      if (fieldEl && e.target.value.trim()) fieldEl.classList.remove("error");
      const counter = root.querySelector(`[data-count="${id}"]`);
      if (counter) counter.textContent = `${e.target.value.length} / ${e.target.maxLength}`;
      refreshLiveSoon(current);
    }
  });

  root.addEventListener("change", (e) => {
    if (!current) return;
    const id = e.target.dataset.switch;
    if (id) { getValues(current)[id] = e.target.checked; tick(); applyShowIf(current); refreshLive(current); return; }
    const rsw = e.target.dataset.rsw;
    if (rsw !== undefined) {
      const f = current.fields.find((x) => x.type === "relatives");
      getValues(current)[f.id][+rsw].dead = e.target.checked;
      tick();
      redrawRelatives(current);
      return;
    }
    const pid = e.target.dataset.photoInput;
    if (pid) {
      const f = current.fields.find((x) => x.id === pid);
      const files = e.target.files;
      if (f && files && files.length) addPhotos(current, f, files);
      e.target.value = "";
    }
  });

  /* ---------------------------------------------------------------
     YUBORISH
     --------------------------------------------------------------- */
  function validate(svc, v) {
    let firstBad = null;
    svc.fields.forEach((f) => {
      const el0 = root.querySelector(`.ai-field[data-f="${f.id}"]`);
      if (f.type === "relatives") {
        const bad = validateRelatives(svc, v, f);
        if (el0) el0.classList.toggle("error", bad);
        if (bad && !firstBad) firstBad = root.querySelector(".rel-in.bad, .rel-chips.bad") || el0;
        return;
      }
      if (f.check) {
        const msg = checkText(f.check, v[f.id], f.required);
        if (el0) {
          el0.classList.toggle("error", !!msg);
          const er = el0.querySelector(".ai-err");
          if (er && msg) er.textContent = msg;
        }
        if (msg && !firstBad) firstBad = el0;
        return;
      }
      // son maydoni: bo'sh bo'lsa standart qiymat olinadi, yozilgan bo'lsa chegarada bo'lishi kerak
      const num = f.type === "number" && String(v[f.id] || "").trim();
      if (!f.required && !num) return;
      const ok = num ? Number.isInteger(+num) && +num >= f.min && +num <= f.max : String(v[f.id] || "").trim().length > 0;
      const el = root.querySelector(`.ai-field[data-f="${f.id}"]`);
      if (el) el.classList.toggle("error", !ok);
      if (!ok && !firstBad) firstBad = el;
    });
    return firstBad;
  }

  async function submit(svc) {
    const v = getValues(svc);
    const status = document.getElementById("aiStatus");
    const btn = document.getElementById("aiSubmit");
    let bad = validate(svc, v);
    const phField = svc.fields.find((x) => x.type === "photos");
    if (!bad && phField && shown(svc, v, phField.id) && photosOf(svc).some((p) => p.status === "up")) {
      bad = root.querySelector(`.ai-field[data-f="${phField.id}"]`);
      if (bad) bad.classList.add("error");
    }
    if (bad) {
      haptic("error");
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
      status.textContent = "Belgilangan maydonlarni to'ldiring.";
      return;
    }

    svc.fields.forEach((f) => { if (f.fallback && !String(v[f.id] || "").trim()) v[f.id] = f.fallback; });
    const visible = { ...v };
    svc.fields.forEach((f) => { if (!shown(svc, v, f.id)) visible[f.id] = Array.isArray(v[f.id]) ? [] : ""; });
    btn.disabled = true;
    status.textContent = "Yuborilmoqda...";
    try {
      const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
      const res = await fetch(CFG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: svc.id,
          fields: visible,
          summary: summaryPairs(svc, visible),
          price: orderPrice(svc, visible),
          user,
          initData: tg ? tg.initData : null,
          bot: (window.AI_APP || {}).bot, // umumiy ilovada — qaysi bot ochgani
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Server xatosi");
      if (data.pay) {
        // Pullik AI xizmat: avval to'lov (Click/Payme), keyin AI ishlaydi
        status.textContent = "";
        btn.disabled = false;
        openPayment(svc, data);
        return;
      }
      haptic("success");
      renderDone(svc, data.auto);
    } catch (err) {
      console.error(err);
      haptic("error");
      btn.disabled = false;
      status.textContent = "Xatolik yuz berdi, birozdan so'ng qayta urinib ko'ring.";
    }
  }

  // Telegram to'lov oynasi. To'lov o'tgach server AI'ni ishga tushiradi.
  function openPayment(svc, data) {
    const status = document.getElementById("aiStatus");
    if (!tg || !tg.openInvoice) {
      if (status) status.textContent = "To'lov uchun ilovani Telegram ichida oching.";
      return;
    }
    tg.openInvoice(data.pay, (res) => {
      if (res === "paid") { haptic("success"); renderDone(svc, true, true); return; }
      if (res === "pending") { renderDone(svc, true, true); return; }
      haptic("warning");
      if (status) status.innerHTML = res === "failed"
        ? "To'lov o'tmadi. Kartani tekshirib, qayta urinib ko'ring."
        : "To'lov qilinmadi. Buyurtma to'lovdan keyin tayyorlanadi.";
      const again = document.getElementById("aiPayAgain") || Object.assign(document.createElement("button"), { id: "aiPayAgain", type: "button", className: "order-btn", textContent: "💳 To'lovni qayta ochish" });
      again.onclick = () => openPayment(svc, data);
      if (status && !again.isConnected) status.after(again);
    });
  }

  function renderDone(svc, auto, paid) {
    photoState[svc.id] = [];
    syncPhotos(svc);
    root.innerHTML = `
      <div class="ai-done glass">
        <div class="big">✅</div>
        <h3>${paid ? "To'lov qabul qilindi!" : "So'rovingiz qabul qilindi!"}</h3>
        <p>${auto ? `«${esc(svc.title)}» avtomatik tayyorlanmoqda — bir necha daqiqa ichida fayl shu botga xabar bo'lib keladi.` : `«${esc(svc.title)}» tayyor bo'lgach, fayl shu botga xabar bo'lib keladi.`} Buyurtma holatini va tayyor faylni «Buyurtmalarim» bo'limida ham ko'rishingiz mumkin.</p>
        <button type="button" class="order-btn" data-again="1">Yana so'rov qoldirish</button>
        <div class="pill-btn glass" data-contact="1" style="margin-top:10px;">Biz bilan bog'lanish</div>
      </div>`;
    current = null;
    syncBackButton();
    window.scrollTo(0, 0);
    if (typeof window.updateOrdersBadge === "function") window.updateOrdersBadge();
  }

  window.aiContactOwner = () => contactOwner();
  function contactOwner() {
    if (typeof window.openOwnerChat === "function") { window.openOwnerChat(); return; }
    const url = "https://t.me/Print_54";
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank");
  }

  /* ---------------------------------------------------------------
     KATTA KO'RISH OYNASI
     --------------------------------------------------------------- */
  const modal = document.createElement("div");
  modal.className = "ai-modal";
  modal.innerHTML = `
    <div class="ai-modal-head"><div class="t" id="aiModalTitle"></div><div class="x glass" data-close="1">×</div></div>
    <div class="ai-modal-body" id="aiModalBody"></div>
    <button type="button" class="order-btn" id="aiModalPick">Shu shablonni tanlash</button>`;
  document.body.appendChild(modal);
  let modalCtx = null;

  function openPreview(svc, fid) {
    const f = svc.fields.find((x) => x.id === fid);
    modalCtx = { svc, f, pick: getValues(svc)[fid] };
    drawModal();
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("open");
    document.body.style.overflow = "";
    modalCtx = null;
  }

  function drawModal() {
    const { svc, f, pick } = modalCtx;
    const v = getValues(svc);
    const d = sampleData(svc, v);
    const tpl = CFG.templates[f.set].find((t) => t.id === pick) || CFG.templates[f.set][0];
    document.getElementById("aiModalTitle").textContent = f.label;

    let list = templateList(svc, f, v);
    if (!list.includes(tpl)) list = [tpl].concat(list);
    const chips = `<div class="chips">${list.map((t) => `<div class="chip${t.id === tpl.id ? " active" : ""}" data-mpick="${t.id}">${esc(t.name)}</div>`).join("")}</div>`;
    let pages;
    if (tpl.kind === "canva") {
      // kutubxona shablonlarida slayd turlari har xil — umumiy izoh yoziladi
      const caps = tpl.lib ? [] : ["Titul slayd", "Reja", "Matn", "Rasm va matn", "Ikki ustun", "Xulosa", "Yakuniy slayd"];
      const n = tpl.pages || 1;
      const cap = (i) => tpl.page ? (n > 1 ? `${i + 1}-sahifa` : "") : caps[i] || (i === 0 ? "Titul slayd" : i === n - 1 ? "Yakuniy slayd" : `${i + 1}-slayd`);
      pages = [`<div class="cap">${svc.id === "resume" ? "Namunadagi ism, rasm va ma'lumotlar o'rniga sizning ma'lumotlaringiz yoziladi" : svc.id === "lesson" ? "Namunadagi matnlar o'rniga sizning darsingiz bo'yicha o'zbekcha matn yoziladi" : tpl.page ? "Namunadagi savollar va matnlar o'rniga sizning mavzuingiz bo'yicha yangi matn yoziladi" : "Namunadagi matnlar o'rniga sizning mavzuingiz bo'yicha o'zbekcha matn yoziladi"}</div>`]
        .concat(Array.from({ length: n }, (_, i) => `${canvaImg(tpl, i + 1)}<div class="cap">${cap(i)}</div>`));
    } else if (f.set === "presentation") {
      pages = [["title", "Titul slayd"], ["content", "Mazmun slaydi"], ["split", "Rasm va matn"]]
        .map(([k, cap]) => `${slideHtml(tpl, k, d)}<div class="cap">${cap}</div>`);
    } else {
      const kinds = { essay: [["main", "Titul varag'i"], ["inner", "Reja va kirish"]], referat: [["main", "Titul varag'i"], ["inner", "Reja va kirish"]], resume: [["main", "Resume"]], obyektivka: [["main", "Ma'lumotnoma"], ["rel", "Qarindoshlar haqida ma'lumot"]], lesson: [["main", "1-sahifa"]], test: [["main", "Test varag'i"]], questions: [["main", "Savollar varag'i"]], crossword: [["main", "Krossvord"]] }[svc.id] || [["main", ""]];
      if ((svc.id === "test" || svc.id === "crossword") && v.key) kinds.push(["key", "Javoblar"]);
      pages = kinds.map(([k, cap]) => `${pageHtml(svc.id, tpl, k, d)}<div class="cap">${cap}</div>`);
    }
    document.getElementById("aiModalBody").innerHTML = chips + pages.join("");
  }

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) { closeModal(); return; }
    const mp = e.target.closest("[data-mpick]");
    if (mp && modalCtx) { modalCtx.pick = mp.dataset.mpick; tick(); drawModal(); return; }
    if (e.target.closest("#aiModalPick") && modalCtx) {
      getValues(modalCtx.svc)[modalCtx.f.id] = modalCtx.pick;
      getCat(modalCtx.svc).tplManual = true;
      const svc = modalCtx.svc;
      closeModal();
      refreshLive(svc);
      haptic("success");
    }
  });

  /* ---------------------------------------------------------------
     NAMUNA MA'LUMOTLAR (ko'rinish uchun)
     --------------------------------------------------------------- */
  function sampleData(svc, v) {
    const subjectDefault = { presentation: "Astronomiya", essay: "O'zbekiston tarixi", referat: "Adabiyot", lesson: "Biologiya", test: "Matematika", questions: "Tarix", crossword: "Tabiatshunoslik" }[svc.id];
    const topicDefault = { presentation: "Quyosh tizimi sayyoralari", essay: "Amir Temur davlatining boshqaruv tizimi", referat: "Alisher Navoiy ijodi", lesson: "Hujayraning tuzilishi", test: "Kasrlarni qo'shish", questions: "Ikkinchi jahon urushi", crossword: "Hayvonot olami" }[svc.id];
    return {
      topic: String(v.topic || "").trim() || topicDefault,
      subject: String(v.subject || "").trim() || subjectDefault,
      author: String(v.author || v.student || v.teacher || "").trim(),
      institution: String(v.institution || v.school || "").trim(),
      student: String(v.student || "").trim(),
      group: String(v.group || "").trim(),
      teacher: String(v.teacher || "").trim(),
      city: String(v.city || "").trim() || "Toshkent",
      grade: String(v.grade || "").trim(),
      answers: parseInt(v.answers, 10) || 4,
      docType: svc.id === "referat" ? "REFERAT" : "MUSTAQIL ISH",
      // resume uchun
      name: String(v.name || "").trim() || "Aliyev Sardor",
      position: String(v.position || "").trim() || "Buxgalter",
      phone: String(v.phone || "").trim() || "+998 90 123 45 67",
      email: String(v.email || "").trim(),
      experience: String(v.experience || "").trim(),
      education: String(v.education || "").trim(),
      skills: String(v.skills || "").trim(),
      langs: Array.isArray(v.langs) ? v.langs : [],
      photo: v.photo !== false,
      // obyektivka uchun
      cyr: v.lang === "cyr",
      fio: String(v.fio || "").trim() || "Karimov Anvar Rustamovich",
      job: String(v.job || "").trim() || "Urgut tumani 5-umumta'lim maktabi direktori",
      since: String(v.since || "").trim() || "06.09.2018",
      birthDate: String(v.birthDate || "").trim() || "14.03.1985",
      birthPlace: String(v.birthPlace || "").trim() || "Samarqand viloyati, Urgut tumani",
      eduLevel: v.eduLevel || "oliy",
      graduated: String(v.graduated || "").trim().split(/\n+/)[0] || "2007 yil Samarqand davlat universiteti",
      nation: String(v.nation || "").trim() || "o'zbek",
      work: String(v.work || "").trim() || "2003-2007 yy. - Samarqand davlat universiteti talabasi\n2009-2018 yy. - Urgut tumani 5-maktab o'qituvchisi\n2018 y. - h.v. - Urgut tumani 5-maktab direktori",
      relatives: (v.relatives || []).filter((r) => r.name).length ? v.relatives : [{ rel: "Otasi", name: "Karimov Rustam Aliyevich", birth: "1958 yil, Urgut tumani", work: "Pensiyada", address: "Urgut tumani" }, { rel: "Onasi", name: "Karimova Zuhra Salimovna", birth: "1961 yil, Samarqand shahri", dead: true, deathYear: "2019", lastJob: "uy bekasi" }],
      photoUrl: (photosOf(svc).find((p) => p.status !== "err" && p.thumb) || {}).thumb || "",
    };
  }

  /* ---------------------------------------------------------------
     TAQDIMOT SLAYDLARI (HTML ko'rinish)
     --------------------------------------------------------------- */
  const FONTS = {
    sans: "'Segoe UI', Roboto, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    round: "'Trebuchet MS', 'Comic Sans MS', sans-serif",
  };

  function decoHtml(t) {
    const a = t.accent;
    switch (t.deco) {
      case "bar":
        return `<div class="el" style="left:0;top:0;bottom:0;width:2.4cqw;background:${a}"></div>
                <div class="el" style="right:5cqw;bottom:5cqw;width:5cqw;height:5cqw;border-radius:1cqw;background:${a};opacity:.18"></div>`;
      case "line":
        return `<div class="el" style="left:9cqw;right:9cqw;bottom:7cqw;height:.3cqw;background:${a};opacity:.35"></div>`;
      case "glow":
        return `<div class="el" style="right:-14cqw;top:-18cqw;width:48cqw;height:48cqw;border-radius:50%;background:radial-gradient(circle, ${a} 0%, transparent 65%);opacity:.45"></div>`;
      case "leaf":
        return `<div class="el" style="right:-10cqw;bottom:-14cqw;width:38cqw;height:38cqw;border-radius:50% 0 50% 50%;background:${a};opacity:.16"></div>
                <div class="el" style="right:14cqw;bottom:-6cqw;width:16cqw;height:16cqw;border-radius:50% 0 50% 50%;background:${a};opacity:.12"></div>`;
      case "frame":
        return `<div class="el" style="inset:3cqw;border:.5cqw double ${a};border-radius:.6cqw"></div>`;
      case "circles":
        return `<div class="el" style="right:-8cqw;top:-10cqw;width:34cqw;height:34cqw;border-radius:50%;background:rgba(255,255,255,.14)"></div>
                <div class="el" style="left:-6cqw;bottom:-12cqw;width:26cqw;height:26cqw;border-radius:50%;background:rgba(255,255,255,.10)"></div>`;
      case "dots": {
        const cols = ["#F44336", "#FFC107", "#4CAF50", "#29B6F6", "#AB47BC"];
        const pos = [[6, 8, 4], [88, 12, 6], [80, 78, 5], [10, 82, 3.5], [92, 48, 3], [50, 90, 2.5]];
        return pos.map(([x, y, s], i) => `<div class="el" style="left:${x}%;top:${y}%;width:${s}cqw;height:${s}cqw;border-radius:50%;background:${cols[i % cols.length]};opacity:.8"></div>`).join("");
      }
      case "cmyk":
        return ["#00A8E8", "#E6007E", "#FFD400", "#14161F"].map((c, i) =>
          `<div class="el" style="right:${-6 + i * 4.2}cqw;top:-8cqw;width:3.2cqw;height:30cqw;background:${c};transform:rotate(35deg);transform-origin:top"></div>`).join("");
      default:
        return "";
    }
  }

  function slideHtml(t, kind, d) {
    const ff = FONTS[t.font] || FONTS.sans;
    const dark = /linear-gradient|#0F172A/.test(t.bg);
    const bullets = ["Asosiy tushunchalar", "Tarixiy ma'lumotlar", "Amaliy ahamiyati", "Xulosa va takliflar"];
    const bulletHtml = (items, size) => items.map((b) => `
      <div style="display:flex;align-items:center;gap:1.6cqw;margin-top:2cqw;font:500 ${size}cqw/1.3 ${ff};color:${t.text}">
        <span style="flex:none;width:1.4cqw;height:1.4cqw;border-radius:${t.font === "round" ? "50%" : ".3cqw"};background:${t.accent}"></span>${b}
      </div>`).join("");
    let body;
    if (kind === "title") {
      body = `
        <div class="el" style="left:9cqw;right:12cqw;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center">
          <div style="font:${t.font === "serif" ? 700 : 800} 5.6cqw/1.15 ${ff};color:${t.title}">${esc(clip(d.topic, 70))}</div>
          <div style="margin-top:2.4cqw;width:12cqw;height:.9cqw;border-radius:1cqw;background:${t.accent}"></div>
          <div style="margin-top:2.4cqw;font:500 2.5cqw/1.3 ${ff};color:${t.text}">${esc(d.author || d.subject)}</div>
        </div>`;
    } else if (kind === "content") {
      body = `
        <div class="el" style="left:9cqw;right:9cqw;top:8cqw">
          <div style="font:700 4.4cqw/1.2 ${ff};color:${t.title}">${esc(clip(d.topic, 46))}</div>
          ${bulletHtml(bullets, 2.7)}
        </div>`;
    } else {
      body = `
        <div class="el" style="left:7cqw;top:9cqw;width:40cqw;height:38cqw;border-radius:2cqw;overflow:hidden;background:${dark ? "rgba(255,255,255,.12)" : t.accent + "22"}">
          <svg viewBox="0 0 100 95" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid slice">
            <circle cx="72" cy="28" r="11" fill="${t.accent}" opacity=".85"/>
            <path d="M0 95 L32 48 L52 72 L68 56 L100 95 Z" fill="${t.accent}" opacity=".55"/>
          </svg>
        </div>
        <div class="el" style="left:52cqw;right:7cqw;top:10cqw">
          <div style="font:700 3.6cqw/1.2 ${ff};color:${t.title}">${esc(clip(d.topic, 34))}</div>
          ${bulletHtml(bullets.slice(0, 3), 2.3)}
        </div>`;
    }
    return `<div class="slide-box"><div class="slide" style="background:${t.bg}">${decoHtml(t)}${body}</div></div>`;
  }

  /* ---------------------------------------------------------------
     HUJJAT SAHIFALARI (HTML ko'rinish)
     --------------------------------------------------------------- */
  const line = (w, mt = 1.6, c = "#d1d5db", h = 0.9) => `<div style="height:${h}cqw;width:${w}%;margin-top:${mt}cqw;border-radius:1cqw;background:${c}"></div>`;
  const lines = (n, mt = 1.6) => Array.from({ length: n }, (_, i) => line([96, 92, 98, 88, 94, 70][i % 6], mt)).join("");
  const C = (txt, size, weight = 400, mt = 0, extra = "") => `<div style="text-align:center;font-size:${size}cqw;font-weight:${weight};margin-top:${mt}cqw;line-height:1.3;${extra}">${txt}</div>`;
  const blank = (s, fallback) => esc(s) || `<span style="color:#9ca3af">${fallback}</span>`;

  function pageHtml(svcId, t, kind, d) {
    const inner = (PAGES[svcId] && PAGES[svcId](t.style, kind, d)) || "";
    return `<div class="page-box"><div class="page">${inner}</div></div>`;
  }

  // Resume: kiritilgan matnni qatorlarga bo'lib, namuna ko'rinishida chizamiz
  const rLines = (txt, fb) => (txt ? txt.split(/\n+/).filter(Boolean).slice(0, 4) : fb).map((x) => esc(clip(x, 60)));
  function resumeBody(d, accent, sec) {
    const exp = rLines(d.experience, ["2021–hozir — «Ipak Yo'li» MChJ, buxgalter", "2019–2021 — «Baraka» savdo, yordamchi buxgalter"]);
    const edu = rLines(d.education, ["2015–2019 — TDIU, Buxgalteriya hisobi"]);
    const skills = d.skills ? d.skills.split(/[,\n]+/).map((x) => x.trim()).filter(Boolean).slice(0, 6) : ["1C", "Excel", "Hisobotlar", "Muloqot"];
    const item = (x) => `<div style="font-size:2.7cqw;margin-top:1.4cqw">• ${x}</div>`;
    return `${sec("Ish tajribasi")}${exp.map(item).join("")}
      ${sec("Ma'lumoti")}${edu.map(item).join("")}
      ${sec("Ko'nikmalar")}<div style="display:flex;flex-wrap:wrap;gap:1.2cqw;margin-top:1.6cqw">${skills.map((x) => `<span style="font-size:2.4cqw;padding:.6cqw 1.8cqw;border-radius:3cqw;background:${accent}1f;color:${accent}">${esc(clip(x, 20))}</span>`).join("")}</div>
      ${d.langs.length ? sec("Tillar") + `<div style="font-size:2.7cqw;margin-top:1.4cqw">${esc(d.langs.join(", "))}</div>` : ""}`;
  }
  const photoBox = (d, size, c) => !d.photo ? "" : d.photoUrl
    ? `<div style="flex:none;width:${size}cqw;height:${size * 1.2}cqw;border-radius:1.5cqw;background:${c} url(${d.photoUrl}) center/cover"></div>`
    : `<div style="flex:none;width:${size}cqw;height:${size * 1.2}cqw;border-radius:1.5cqw;background:${c};display:grid;place-items:center;font-size:${size * 0.45}cqw;color:#fff">👤</div>`;

  const PAGES = {
    resume(style, kind, d) {
      const contact = [d.phone, d.email, d.city].filter(Boolean).map(esc);
      if (style === "modern") {
        const a = "#2563EB";
        const sec = (t) => `<div style="margin-top:4cqw;font-size:3cqw;font-weight:800;color:${a};text-transform:uppercase;letter-spacing:.08em">${t}</div>`;
        return `<div class="el" style="left:0;top:0;bottom:0;width:33%;background:#1E293B;color:#E2E8F0;padding:8cqw 4cqw;font-family:Arial,sans-serif">
            ${photoBox(d, 18, "#334155")}
            <div style="margin-top:4cqw;font-size:2.6cqw;font-weight:700;color:#93C5FD">ALOQA</div>
            ${contact.map((x) => `<div style="font-size:2.3cqw;margin-top:1.4cqw;word-break:break-all">${x}</div>`).join("")}
          </div>
          <div class="el" style="left:37%;right:6cqw;top:8cqw;font-family:Arial,sans-serif">
            <div style="font-size:6cqw;font-weight:800;line-height:1.1">${esc(clip(d.name, 30))}</div>
            <div style="font-size:3.2cqw;color:${a};margin-top:1cqw">${esc(clip(d.position, 40))}</div>
            ${resumeBody(d, a, sec)}
          </div>`;
      }
      if (style === "minimal") {
        const sec = (t) => `<div style="margin-top:4cqw;padding-bottom:.8cqw;border-bottom:.3cqw solid #e5e7eb;font-size:2.8cqw;letter-spacing:.2em;color:#6b7280">${t.toUpperCase()}</div>`;
        return `<div style="padding:10cqw 10cqw;font-family:Georgia,serif">
            <div style="text-align:center;font-size:6.4cqw;letter-spacing:.06em">${esc(clip(d.name, 30))}</div>
            <div style="text-align:center;font-size:3cqw;color:#6b7280;margin-top:1cqw">${esc(clip(d.position, 40))}</div>
            <div style="text-align:center;font-size:2.4cqw;color:#6b7280;margin-top:1.6cqw">${contact.join(" · ")}</div>
            ${resumeBody(d, "#111827", sec)}
          </div>`;
      }
      const a = "#0F766E";
      const sec = (t) => `<div style="margin-top:4cqw;font-size:3.1cqw;font-weight:700;color:${a}">${t}</div>`;
      return `<div style="padding:8cqw 8cqw;font-family:Arial,sans-serif">
          <div style="display:flex;gap:4cqw;align-items:center;padding-bottom:3cqw;border-bottom:.6cqw solid ${a}">
            ${photoBox(d, 16, a)}
            <div><div style="font-size:6cqw;font-weight:800;line-height:1.1">${esc(clip(d.name, 30))}</div>
              <div style="font-size:3.2cqw;color:${a};margin-top:1cqw">${esc(clip(d.position, 40))}</div>
              <div style="font-size:2.4cqw;color:#6b7280;margin-top:1.2cqw">${contact.join(" · ")}</div></div>
          </div>
          ${resumeBody(d, a, sec)}
        </div>`;
    },
    referat(style, kind, d) { return PAGES.essay(style, kind, d); },
    obyektivka(style, kind, d) {
      const T = (s) => (d.cyr && window.uzCyr ? window.uzCyr(s) : s);
      // 06.09.2018 -> "2018 yil 06 sentabrdan:" (serverdagi obyektivka-docx.js bilan bir xil)
      const sinceLine = (x) => {
        const m = x.since.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!m || +m[2] < 1 || +m[2] > 12) return sm(x.since + ":");
        const mon = (x.cyr ? ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"] : ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"])[+m[2] - 1];
        return sm(`${m[3]} yil ${m[1].padStart(2, "0")} ${mon}dan:`);
      };
      const sm = (txt, b) => `<div style="font-size:2.3cqw;${b ? "font-weight:700;" : ""}line-height:1.3">${esc(T(txt))}</div>`;
      if (kind === "rel") {
        const cell = (t, b) => `<td style="border:.2cqw solid #333;padding:.6cqw;font-size:2cqw;text-align:center;${b ? "font-weight:700" : ""}">${esc(T(t))}</td>`;
        return `<div style="padding:8cqw 7cqw 0 9cqw">${sm(d.fio + "ning yaqin qarindoshlari haqida", true).replace("<div", '<div align="center"')}${sm("MA'LUMOT", true).replace("<div", '<div align="center"')}
          <table style="width:100%;border-collapse:collapse;margin-top:2cqw"><tr>${["Qarindoshligi", "F.I.Sh.", "Tug'ilgan yili va joyi", "Ish joyi va lavozimi", "Turar joyi"].map((h) => cell(h, true)).join("")}</tr>
          ${d.relatives.slice(0, 8).map((r) => `<tr>${cell(r.rel || "", true)}${cell(r.name || "")}${cell(r.birth || "")}${r.dead ? `<td colspan="2" style="border:.2cqw solid #333;padding:.6cqw;font-size:2cqw;text-align:center">${esc(T((r.deathYear || "") + " yilda vafot etgan" + (r.lastJob ? " (" + r.lastJob + ")" : "")))}</td>` : cell(r.work || "") + cell(r.address || "")}</tr>`).join("")}</table></div>`;
      }
      const pairRow = (a, av, b, bv) => `<div style="display:flex;gap:3cqw;margin-top:1.6cqw"><div style="flex:1">${sm(a, true)}${sm(av)}</div><div style="flex:1.1">${b ? sm(b, true) + sm(bv) : ""}</div></div>`;
      return `<div style="padding:7cqw 5cqw 0 9cqw">
        <div style="text-align:center">${sm("MA'LUMOTNOMA", true)}${sm(d.fio, true)}</div>
        <div style="display:flex;gap:3cqw;margin-top:2cqw"><div style="flex:1">${sinceLine(d)}${sm(d.job, true)}
          ${pairRow("Tug'ilgan yili:", d.birthDate, "Tug'ilgan joyi:", d.birthPlace)}${pairRow("Millati:", d.nation, "Partiyaviyligi:", "yo'q")}</div>
          <div style="flex:none;width:16cqw;height:21cqw;border:.25cqw solid #333;${d.photoUrl ? `background:url(${d.photoUrl}) center/cover` : "display:grid;place-items:center;font-size:2cqw;color:#666"}">${d.photoUrl ? "" : "3x4"}</div></div>
        ${pairRow("Ma'lumoti:", d.eduLevel, "Tamomlagan:", d.graduated)}
        <div style="text-align:center;margin-top:3cqw">${sm("MEHNAT FAOLIYATI", true)}</div>
        ${d.work.split(/\n+/).slice(0, 6).map((x) => sm(x)).join("")}</div>`;
    },
    essay(style, kind, d) {
      if (kind === "inner") {
        return `<div style="padding:9cqw 9cqw">
          ${C("REJA", 4.2, 700)}
          ${["Kirish", "1. " + clip(d.topic, 40), "2. Asosiy jihatlar va tahlil", "3. Hozirgi kundagi ahamiyati", "Xulosa", "Foydalanilgan adabiyotlar"].map((r) => `<div style="font-size:3cqw;margin-top:2cqw">${esc(r)}</div>`).join("")}
          ${C("KIRISH", 4.2, 700, 6)}
          ${lines(9, 1.8)}
        </div>`;
      }
      const ministry = "O'ZBEKISTON RESPUBLIKASI OLIY TA'LIM, FAN VA INNOVATSIYALAR VAZIRLIGI";
      if (style === "modern") {
        return `<div class="el" style="left:0;top:0;bottom:0;width:7cqw;background:#4FA8FF"></div>
          <div class="el" style="left:7cqw;top:0;width:30cqw;height:2cqw;background:#A78BFA"></div>
          <div style="padding:14cqw 9cqw 0 16cqw">
            <div style="font-size:2.8cqw;color:#6b7280;font-family:Arial,sans-serif">${blank(d.institution, "Muassasa nomi")}</div>
            <div style="margin-top:22cqw;font-size:3cqw;letter-spacing:.3em;color:#4FA8FF;font-weight:700;font-family:Arial,sans-serif">${d.docType}</div>
            <div style="margin-top:3cqw;font-size:7cqw;font-weight:800;line-height:1.15;font-family:Arial,sans-serif">${esc(clip(d.topic, 60))}</div>
            <div style="margin-top:3cqw;font-size:3.2cqw;color:#4b5563;font-family:Arial,sans-serif">Fan: ${esc(d.subject)}</div>
          </div>
          <div class="el" style="left:16cqw;bottom:16cqw;font-size:3cqw;line-height:1.6;font-family:Arial,sans-serif">
            <div>Bajardi: <b>${blank(d.student, "F.I.Sh")}</b></div>
            <div>Guruh: ${blank(d.group, "—")}</div>
            ${d.teacher ? `<div>Qabul qildi: ${esc(d.teacher)}</div>` : ""}
          </div>
          <div class="el" style="left:16cqw;bottom:7cqw;font-size:2.8cqw;color:#6b7280;font-family:Arial,sans-serif">${esc(d.city)} — ${YEAR}</div>`;
      }
      if (style === "school") {
        return `<div class="el" style="inset:4cqw;border:.6cqw double #1f2937"></div>
          <div style="padding:12cqw 10cqw 0">
            ${C(blank(d.institution, "___-sonli umumiy o'rta ta'lim maktabi"), 3.4, 700)}
            ${C(d.docType, 8, 800, 26)}
            ${C(`Fan: ${esc(d.subject)}`, 3.6, 400, 4)}
            ${C(`Mavzu: «${esc(clip(d.topic, 70))}»`, 4.2, 700, 3)}
          </div>
          <div class="el" style="right:12cqw;bottom:24cqw;font-size:3.2cqw;line-height:1.7">
            <div>Bajardi: ${blank(d.student, "F.I.Sh")}</div>
            <div>${blank(d.group, "___")}-sinf o'quvchisi</div>
            <div>Rahbar: ${blank(d.teacher, "F.I.Sh")}</div>
          </div>
          <div class="el" style="left:0;right:0;bottom:11cqw">${C(`${esc(d.city)} — ${YEAR}`, 3.2)}</div>`;
      }
      return `<div style="padding:9cqw 9cqw 0">
          ${C(ministry, 2.9, 700)}
          ${C(blank(d.institution, "OLIY TA'LIM MUASSASASI NOMI"), 3.2, 700, 3, "text-transform:uppercase")}
          ${C(`«${esc(d.subject)}» fanidan`, 3.2, 400, 18)}
          ${C(d.docType, 8, 800, 4)}
          ${C(`Mavzu: «${esc(clip(d.topic, 70))}»`, 4, 700, 5)}
        </div>
        <div class="el" style="right:10cqw;bottom:22cqw;font-size:3.2cqw;line-height:1.7">
          <div>Bajardi: ${blank(d.student, "F.I.Sh")}</div>
          <div>Guruh: ${blank(d.group, "______")}</div>
          <div>Qabul qildi: ${blank(d.teacher, "F.I.Sh")}</div>
        </div>
        <div class="el" style="left:0;right:0;bottom:9cqw">${C(`${esc(d.city)} — ${YEAR}`, 3.2)}</div>`;
    },

    lesson(style, kind, d) {
      const head = `${C("DARS ISHLANMA", 5, 800)}
        <div style="font-size:2.9cqw;margin-top:3cqw;line-height:1.6">
          <div><b>Fan:</b> ${esc(d.subject)} &nbsp; <b>Sinf:</b> ${esc(d.grade || "7")}</div>
          <div><b>Mavzu:</b> ${esc(clip(d.topic, 60))}</div>
          ${d.teacher ? `<div><b>O'qituvchi:</b> ${esc(d.teacher)}</div>` : ""}
        </div>`;
      if (style === "techmap") {
        const box = (h, c) => `<div style="border:.4cqw solid ${c};border-radius:1.5cqw;padding:2cqw;font-size:2.6cqw"><b style="color:${c}">${h}</b>${lines(2, 1.2)}</div>`;
        return `<div style="padding:8cqw">${head}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.4cqw;margin-top:4cqw">
            ${box("Maqsad", "#2563eb")}${box("Kutilgan natija", "#16a34a")}${box("Metodlar", "#d97706")}${box("Jihozlar", "#db2777")}
          </div>
          ${["Tashkiliy qism", "Uy vazifasini so'rash", "Yangi mavzu bayoni", "Mustahkamlash", "Baholash"].map((s, i) => `
            <div style="display:flex;gap:2cqw;align-items:center;margin-top:2.6cqw;font-size:2.7cqw">
              <span style="flex:none;width:5cqw;height:5cqw;border-radius:50%;background:#1f2937;color:#fff;display:grid;place-items:center;font-size:2.4cqw">${i + 1}</span>
              <span style="flex:1">${s}</span><span style="color:#6b7280">${[2, 8, 20, 10, 5][i]} daq.</span>
            </div>`).join("")}
        </div>`;
      }
      if (style === "notes") {
        return `<div style="padding:8cqw">${head}
          ${["Darsning maqsadi", "Dars jihozi", "Darsning borishi", "Uyga vazifa"].map((h) => `<div style="font-size:3.2cqw;font-weight:700;margin-top:4cqw">${h}</div>${lines(3, 1.4)}`).join("")}
        </div>`;
      }
      const cell = "border:.25cqw solid #9ca3af;padding:1.2cqw";
      return `<div style="padding:8cqw">${head}
        <table style="width:100%;border-collapse:collapse;margin-top:4cqw;font-size:2.4cqw">
          <tr style="background:#e5e7eb">${["Bosqich", "Vaqt", "O'qituvchi", "O'quvchi"].map((h) => `<th style="${cell}">${h}</th>`).join("")}</tr>
          ${["Tashkiliy", "Takrorlash", "Yangi mavzu", "Mustahkamlash", "Baholash", "Uyga vazifa"].map((r, i) => `
            <tr><td style="${cell}">${r}</td><td style="${cell};text-align:center">${[2, 8, 20, 10, 3, 2][i]}′</td><td style="${cell}">${line(80, 0)}</td><td style="${cell}">${line(70, 0)}</td></tr>`).join("")}
        </table>
      </div>`;
    },

    test(style, kind, d) {
      const letters = "ABCDE".slice(0, d.answers).split("");
      if (kind === "key") {
        return `<div style="padding:9cqw">${C("JAVOBLAR KALITI", 4.6, 800)}
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2cqw;margin-top:5cqw;font-size:3cqw">
            ${Array.from({ length: 20 }, (_, i) => `<div>${i + 1} — <b>${letters[(i * 7 + 2) % letters.length]}</b></div>`).join("")}
          </div></div>`;
      }
      const head = `${C(`${esc(d.subject).toUpperCase()} FANIDAN TEST`, 4, 800)}
        ${C(`Mavzu: ${esc(clip(d.topic, 50))}`, 2.9, 400, 1.5)}
        <div style="display:flex;justify-content:space-between;font-size:2.6cqw;margin-top:3cqw"><span>F.I.Sh: ____________</span><span>Sinf: ____</span><span>I-variant</span></div>`;
      const q = (n, size) => `<div style="margin-top:2.6cqw;font-size:${size}cqw;break-inside:avoid">
          <div style="display:flex;gap:1cqw"><b>${n}.</b>${line(85, 0.9, "#9ca3af", 0.8)}</div>
          <div style="display:flex;gap:3cqw;margin-top:1.2cqw;color:#374151">${letters.map((l) => `<span>${l}) ____</span>`).join("")}</div>
        </div>`;
      if (style === "twocol") {
        return `<div style="padding:7cqw">${head}
          <div style="column-count:2;column-gap:4cqw;margin-top:1cqw">${Array.from({ length: 12 }, (_, i) => q(i + 1, 2.2)).join("")}</div></div>`;
      }
      if (style === "sheet") {
        return `<div style="padding:8cqw">${head}
          ${Array.from({ length: 5 }, (_, i) => q(i + 1, 2.6)).join("")}
          <div style="margin-top:4cqw;border:.4cqw solid #1f2937;border-radius:1.5cqw;padding:2cqw">
            ${C("JAVOBLAR VARAQASI", 2.8, 800)}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.4cqw 4cqw;margin-top:2cqw;font-size:2.4cqw">
              ${Array.from({ length: 10 }, (_, i) => `<div style="display:flex;align-items:center;gap:1.4cqw"><b style="width:4cqw">${i + 1}</b>${letters.map((l) => `<span style="width:3.6cqw;height:3.6cqw;border:.3cqw solid #374151;border-radius:50%;display:grid;place-items:center;font-size:1.9cqw">${l}</span>`).join("")}</div>`).join("")}
            </div>
          </div></div>`;
      }
      return `<div style="padding:8cqw">${head}${Array.from({ length: 7 }, (_, i) => q(i + 1, 2.8)).join("")}</div>`;
    },

    questions(style, kind, d) {
      const head = `${C("SAVOLLAR", 4.6, 800)}${C(`Mavzu: ${esc(clip(d.topic, 50))}`, 2.9, 400, 1.5)}`;
      if (style === "cards") {
        return `<div style="padding:7cqw">${head}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.4cqw;margin-top:4cqw">
            ${Array.from({ length: 8 }, (_, i) => `<div style="border:.35cqw dashed #9ca3af;border-radius:1.6cqw;padding:2.4cqw;min-height:22cqw;font-size:2.6cqw">
              <b style="color:#db2777">${i + 1}-savol</b>${lines(3, 1.4)}</div>`).join("")}
          </div></div>`;
      }
      return `<div style="padding:8cqw">${head}
        ${Array.from({ length: 8 }, (_, i) => `<div style="margin-top:3cqw;font-size:2.8cqw"><div style="display:flex;gap:1cqw"><b>${i + 1}.</b>${line(88, 0.9, "#9ca3af", 0.8)}</div>
          <div style="margin:2cqw 0 0 4cqw;border-bottom:.25cqw dotted #9ca3af;height:2.4cqw"></div></div>`).join("")}
      </div>`;
    },

    crossword(style, kind, d) {
      // 10x10 namuna to'r: [qator, ustun, yo'nalish (a — eniga, d — bo'yiga), so'z, raqam]
      const words = [[1, 3, "a", "KIYIK", 1], [1, 3, "d", "KAPALAK", 1], [1, 7, "d", "KAPTAR", 2], [3, 1, "a", "QOPLON", 3], [5, 3, "a", "LAYLAK", 4], [5, 8, "d", "KIT", 5], [7, 0, "a", "ECHKI", 6]];
      const palette = ["#FDE68A", "#BFDBFE", "#FBCFE8", "#BBF7D0", "#DDD6FE", "#FED7AA", "#A5F3FC"];
      const grid = {};
      words.forEach(([r, c, dir, word, num], wi) => {
        for (let k = 0; k < word.length; k++) {
          const key = dir === "a" ? `${r},${c + k}` : `${r + k},${c}`;
          grid[key] = grid[key] || { w: wi, ch: word[k] };
          if (k === 0) grid[key].n = num;
        }
      });
      const color = style === "color";
      let cells = "";
      for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
        const g = grid[`${r},${c}`];
        cells += g
          ? `<div style="position:relative;aspect-ratio:1;border:.3cqw solid #1f2937;background:${color ? palette[g.w] : "#fff"};${color ? "border-radius:1cqw;" : ""}">
               ${g.n ? `<span style="position:absolute;left:.5cqw;top:.1cqw;font-size:1.8cqw;font-family:Arial">${g.n}</span>` : ""}
               ${kind === "key" ? `<span style="position:absolute;inset:0;display:grid;place-items:center;font:700 3cqw Arial">${g.ch}</span>` : ""}
             </div>`
          : `<div></div>`;
      }
      const title = color
        ? `<div style="text-align:center;font:800 5.4cqw 'Trebuchet MS',sans-serif;color:#E65100">${esc(clip(d.topic, 30))}</div>`
        : C(`KROSSVORD: «${esc(clip(d.topic, 30))}»`, 4, 800);
      return `<div style="padding:7cqw">${title}${kind === "key" ? C("Javoblar", 3, 700, 1) : ""}
        <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:${color ? ".6cqw" : "0"};width:76%;margin:4cqw auto 0">${cells}</div>
        ${kind === "key" ? "" : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3cqw;margin-top:4cqw;font-size:2.5cqw">
          <div><b>Eniga:</b>${[1, 3, 4, 6].map((n) => `<div style="display:flex;gap:1cqw;margin-top:1.2cqw">${n}.${line(80, 0.8, "#d1d5db", 0.7)}</div>`).join("")}</div>
          <div><b>Bo'yiga:</b>${[1, 2, 5].map((n) => `<div style="display:flex;gap:1cqw;margin-top:1.2cqw">${n}.${line(80, 0.8, "#d1d5db", 0.7)}</div>`).join("")}</div>
        </div>`}
      </div>`;
    },
  };

  /* ---------------------------------------------------------------
     TO'G'RIDAN-TO'G'RI HAVOLA
     Telegram: t.me/<bot>?startapp=ai yoki ?startapp=ai_presentation
     Brauzer:  index.html#ai yoki #ai_presentation
     --------------------------------------------------------------- */
  (function openFromLink() {
    const startParam = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
    const ref = String(startParam || decodeURIComponent(location.hash.slice(1)) || "");
    const m = ref.match(/^ai(?:_(\w+))?$/);
    if (!m) return;
    setMode("ai");
    if (m[1]) openService(m[1]);
  })();
})();
