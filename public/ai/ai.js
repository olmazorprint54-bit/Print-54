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
  const priceText = (id) => (CFG.prices[id] == null ? "Narxi kelishiladi" : fmt(CFG.prices[id]));
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
    root.innerHTML = `
      <div class="ai-hero glass">
        <h2>✨ AI xizmatlar</h2>
        <p>Taqdimot, mustaqil ish, dars ishlanma, test va krossvordni sun'iy intellekt yordamida tayyorlang — va shu yerning o'zida chop ettiring.</p>
        <div class="ai-note">⏳ <span>Xizmat sinov bosqichida: so'rovingizni qoldiring, tayyor hujjatni shu bot orqali yuboramiz.</span></div>
      </div>
      <div class="ai-grid">
        ${CFG.services.map((s) => `
          <div class="ai-card glass" data-open="${s.id}">
            <div class="ic" style="background:${s.color}">${s.icon}</div>
            <div class="t">${esc(s.title)}</div>
            <div class="s">${esc(s.sub)}</div>
            <div class="p">${esc(priceText(s.id))}</div>
          </div>`).join("")}
      </div>`;
  }

  function openGrid() {
    current = null;
    renderGrid();
    syncBackButton();
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------
     SHAKL
     --------------------------------------------------------------- */
  function getValues(svc) {
    if (!valuesBy[svc.id]) {
      const v = {};
      svc.fields.forEach((f) => {
        if (f.type === "heading") return;
        if (Array.isArray(f.default)) v[f.id] = f.default.slice();
        else if (f.default !== undefined) v[f.id] = f.default;
        else v[f.id] = f.type === "switch" ? false : "";
      });
      valuesBy[svc.id] = v;
    }
    return valuesBy[svc.id];
  }

  const label = (f) => `<div class="field-title">${esc(f.label)}${f.required ? '<span class="ai-req">*</span>' : ""}</div>`;

  function fieldHtml(svc, f, v) {
    switch (f.type) {
      case "heading":
        return `<div class="ai-heading">${esc(f.label)}</div>`;
      case "text":
        return `<div class="ai-field" data-f="${f.id}">${label(f)}
          <input class="ai-input" data-input="${f.id}" maxlength="${f.max || 200}" placeholder="${esc(f.placeholder || "")}" value="${esc(v[f.id])}">
          <div class="ai-err">Iltimos, shu maydonni to'ldiring</div></div>`;
      case "textarea":
        return `<div class="ai-field" data-f="${f.id}">${label(f)}
          <textarea class="ai-input" data-input="${f.id}" maxlength="${f.max || 1000}" placeholder="${esc(f.placeholder || "")}">${esc(v[f.id])}</textarea>
          <div class="ai-count" data-count="${f.id}">${String(v[f.id] || "").length} / ${f.max || 1000}</div></div>`;
      case "chips": {
        // f.custom = {min, max} bo'lsa, oxirida sonni qo'lda yozish katagi chiqadi
        const own = f.custom && v[f.id] && !f.options.some((o) => optV(o) === v[f.id]);
        return `<div class="ai-field" data-f="${f.id}">${label(f)}<div class="chips${f.compact ? " compact" : ""}" data-chips="${f.id}">
          ${f.options.map((o) => `<div class="chip${v[f.id] === optV(o) ? " active" : ""}" data-v="${esc(optV(o))}">${esc(optL(o))}</div>`).join("")}
          ${f.custom ? `<input class="chip-input${own ? " active" : ""}" data-custom="${f.id}" type="number" inputmode="numeric" min="${f.custom.min}" max="${f.custom.max}" placeholder="Boshqa" value="${own ? esc(v[f.id]) : ""}">` : ""}
          </div>${f.custom ? `<div class="ai-err">${f.custom.min} dan ${f.custom.max} gacha son kiriting</div>` : ""}</div>`;
      }
      case "multichips":
        return `<div class="ai-field">${label(f)}<div class="chips" data-multi="${f.id}">
          ${f.options.map((o) => `<div class="chip multi${v[f.id].includes(optV(o)) ? " active" : ""}" data-v="${esc(optV(o))}">${esc(optL(o))}</div>`).join("")}
          </div></div>`;
      case "switch":
        return `<div class="ai-field"><label class="switch-row glass"><span>${esc(f.label)}</span>
          <span class="switch"><input type="checkbox" data-switch="${f.id}"${v[f.id] ? " checked" : ""}><span class="slider"></span></span></label></div>`;
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
    const cats = [{ v: "all", l: "Barchasi" }].concat(CFG.categories.filter((c) => used.has(c.v)));
    const st = getCat(svc);
    return cats.map((c) => `<div class="chip${st.cat === c.v ? " active" : ""}" data-cat="${c.v}">${esc(c.l)}</div>`).join("");
  }

  function templateList(svc, f, v) {
    const all = CFG.templates[f.set];
    if (!hasCategories(f)) return all;
    const st = getCat(svc);
    if (st.cat !== "all") return all.filter((t) => t.category === st.cat);
    const det = detectCategory(v);
    return det ? all.filter((t) => t.category === det).concat(all.filter((t) => t.category !== det)) : all;
  }

  // Mavzu yoki fan yozilganda mos toifani avtomatik tanlaydi
  function autoCategory(svc, f, v) {
    const st = getCat(svc);
    if (st.manual) return;
    const det = detectCategory(v);
    const next = det && CFG.templates[f.set].some((t) => t.category === det) ? det : "all";
    if (next === st.cat) return;
    st.cat = next;
    if (!st.tplManual && next !== "all") {
      const first = CFG.templates[f.set].find((t) => t.category === next);
      if (first) v[f.id] = first.id;
    }
  }

  const canvaImg = (t, n) => `<div class="slide-box"><div class="slide"><img class="el" src="ai/templates/${t.id}/${n}.jpg" alt="" loading="lazy" style="inset:0;width:100%;height:100%;object-fit:cover"></div></div>`;

  function templateCards(svc, f, v) {
    return templateList(svc, f, v).map((t) => `
      <div class="tpl-card glass${v[f.id] === t.id ? " active" : ""}" data-v="${t.id}">
        ${t.kind === "canva" ? canvaImg(t, 1) : f.set === "presentation" ? slideHtml(t, "title", sampleData(svc, v)) : pageHtml(svc.id, t, "main", sampleData(svc, v))}
        <div class="tpl-name">${esc(t.name)}</div>
      </div>`).join("");
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
    const svc = CFG.services.find((s) => s.id === id);
    if (!svc) return;
    current = svc;
    renderForm(svc);
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
    if (f.type === "templates") { const t = CFG.templates[f.set].find((x) => x.id === val); return t ? t.name : val; }
    return String(val || "").trim();
  }

  function summaryPairs(svc, v) {
    return svc.fields
      .filter((f) => f.type !== "heading")
      .map((f) => ({ label: f.label, value: displayValue(f, v[f.id]) }))
      .filter((p) => p.value !== "");
  }

  function summaryHtml(svc, v) {
    const pick = (id) => { const f = svc.fields.find((x) => x.id === id); return f ? displayValue(f, v[id]) : ""; };
    const amount = { presentation: v.slides && `${v.slides} ta slayd`, essay: v.pages && `${v.pages} bet`, test: v.count && `${v.count} ta savol`, questions: v.count && `${v.count} ta savol`, crossword: v.words && `${v.words} ta so'z`, lesson: v.duration && `${v.duration} daqiqa` }[svc.id];
    const rows = [
      ["Xizmat", svc.title],
      ["Mavzu", pick("topic") || "—"],
      ["Hajmi", amount || "—"],
      ["Shablon", pick("template")],
      ["Til", pick("lang")],
      ["Chop etish", pick("print")],
    ];
    return rows.map(([k, val]) => `<div class="receipt-line"><span>${esc(k)}</span><span>${esc(val)}</span></div>`).join("") +
      `<div class="receipt-total"><span class="t-label">NARXI</span><span class="t-value" style="font-size:${CFG.prices[svc.id] == null ? "16px" : "23px"}">${esc(priceText(svc.id))}</span></div>`;
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
        const own = chip.parentElement.querySelector("[data-custom]");
        if (own) { own.value = ""; own.classList.remove("active"); chip.closest(".ai-field").classList.remove("error"); }
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
    const id = e.target.dataset.input;
    if (id) {
      v[id] = e.target.value;
      const fieldEl = e.target.closest(".ai-field");
      if (fieldEl && e.target.value.trim()) fieldEl.classList.remove("error");
      const counter = root.querySelector(`[data-count="${id}"]`);
      if (counter) counter.textContent = `${e.target.value.length} / ${e.target.maxLength}`;
      refreshLiveSoon(current);
      return;
    }
    const cid = e.target.dataset.custom;
    if (cid) {
      const f = current.fields.find((x) => x.id === cid);
      const raw = e.target.value.trim();
      const box = e.target.parentElement;
      const field = e.target.closest(".ai-field");
      // bo'sh qoldirilsa — standart qiymatga qaytamiz
      v[cid] = raw ? String(parseInt(raw, 10)) : f.default;
      e.target.classList.toggle("active", !!raw);
      box.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", !raw && c.dataset.v === v[cid]));
      if (!raw || customOk(f, v[cid])) field.classList.remove("error");
      refreshLiveSoon(current);
    }
  });
  root.addEventListener("focusout", (e) => {
    const cid = e.target.dataset && e.target.dataset.custom;
    if (!cid || !current) return;
    const f = current.fields.find((x) => x.id === cid);
    e.target.closest(".ai-field").classList.toggle("error", !!e.target.value.trim() && !customOk(f, getValues(current)[cid]));
  });

  root.addEventListener("change", (e) => {
    if (!current) return;
    const id = e.target.dataset.switch;
    if (id) { getValues(current)[id] = e.target.checked; tick(); }
  });

  /* ---------------------------------------------------------------
     YUBORISH
     --------------------------------------------------------------- */
  const customOk = (f, val) => { const n = Number(val); return Number.isInteger(n) && n >= f.custom.min && n <= f.custom.max; };

  function validate(svc, v) {
    let firstBad = null;
    svc.fields.forEach((f) => {
      if (!f.required && !f.custom) return;
      const ok = f.custom ? customOk(f, v[f.id]) : String(v[f.id] || "").trim().length > 0;
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
    const bad = validate(svc, v);
    if (bad) {
      haptic("error");
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
      status.textContent = "Belgilangan maydonlarni to'ldiring.";
      return;
    }

    btn.disabled = true;
    status.textContent = "Yuborilmoqda...";
    try {
      const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
      const res = await fetch(CFG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: svc.id,
          fields: v,
          summary: summaryPairs(svc, v),
          price: CFG.prices[svc.id],
          user,
          initData: tg ? tg.initData : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Server xatosi");
      haptic("success");
      renderDone(svc);
    } catch (err) {
      console.error(err);
      haptic("error");
      btn.disabled = false;
      status.textContent = "Xatolik yuz berdi, birozdan so'ng qayta urinib ko'ring.";
    }
  }

  function renderDone(svc) {
    root.innerHTML = `
      <div class="ai-done glass">
        <div class="big">✅</div>
        <h3>So'rovingiz qabul qilindi!</h3>
        <p>«${esc(svc.title)}» tayyor bo'lgach, hujjatni shu bot orqali yuboramiz. Savollaringiz bo'lsa, biz bilan bog'laning.</p>
        <button type="button" class="order-btn" data-again="1">Yana so'rov qoldirish</button>
        <div class="pill-btn glass" data-contact="1" style="margin-top:10px;">Biz bilan bog'lanish</div>
      </div>`;
    current = null;
    syncBackButton();
    window.scrollTo(0, 0);
  }

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
      const cap = (i) => caps[i] || (i === 0 ? "Titul slayd" : i === n - 1 ? "Yakuniy slayd" : `${i + 1}-slayd`);
      pages = [`<div class="cap">Namunadagi matnlar o'rniga sizning mavzuingiz bo'yicha o'zbekcha matn yoziladi</div>`]
        .concat(Array.from({ length: n }, (_, i) => `${canvaImg(tpl, i + 1)}<div class="cap">${cap(i)}</div>`));
    } else if (f.set === "presentation") {
      pages = [["title", "Titul slayd"], ["content", "Mazmun slaydi"], ["split", "Rasm va matn"]]
        .map(([k, cap]) => `${slideHtml(tpl, k, d)}<div class="cap">${cap}</div>`);
    } else {
      const kinds = { essay: [["main", "Titul varag'i"], ["inner", "Reja va kirish"]], lesson: [["main", "1-sahifa"]], test: [["main", "Test varag'i"]], questions: [["main", "Savollar varag'i"]], crossword: [["main", "Krossvord"]] }[svc.id] || [["main", ""]];
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
    const subjectDefault = { presentation: "Astronomiya", essay: "O'zbekiston tarixi", lesson: "Biologiya", test: "Matematika", questions: "Tarix", crossword: "Tabiatshunoslik" }[svc.id];
    const topicDefault = { presentation: "Quyosh tizimi sayyoralari", essay: "Amir Temur davlatining boshqaruv tizimi", lesson: "Hujayraning tuzilishi", test: "Kasrlarni qo'shish", questions: "Ikkinchi jahon urushi", crossword: "Hayvonot olami" }[svc.id];
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

  const PAGES = {
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
            <div style="margin-top:22cqw;font-size:3cqw;letter-spacing:.3em;color:#4FA8FF;font-weight:700;font-family:Arial,sans-serif">MUSTAQIL ISH</div>
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
            ${C("MUSTAQIL ISH", 8, 800, 26)}
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
          ${C("MUSTAQIL ISH", 8, 800, 4)}
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
