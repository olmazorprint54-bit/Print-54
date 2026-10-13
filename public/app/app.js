/* ================================================================
   UMUMIY AI ILOVA — qobiq: bot nomi/rangi, tema, pastki menyu,
   Buyurtmalarim, Profil. Xizmatlar va formalar ../ai/ai.js da.
   ================================================================ */
(function () {
  const tg = window.Telegram ? window.Telegram.WebApp : null;
  const CFG = window.AI_CONFIG;
  const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tick = () => { try { tg && tg.HapticFeedback && tg.HapticFeedback.selectionChanged(); } catch (e) {} };
  const $ = (id) => document.getElementById(id);
  let tasks = {}, firstFree = false; // Bonuslar bo'limi (pastda)

  if (tg) { try { tg.ready(); tg.expand(); } catch (e) {} }

  /* ---------- bot ---------- */
  const key = window.APP_BOT_KEY || window.APP_BOT_DEFAULT;
  const bot = (window.APP_BOTS || {})[key] || window.APP_BOTS[window.APP_BOT_DEFAULT];
  // "Biz bilan bog'lanish" — shu botning egasi bilan
  window.openOwnerChat = () => {
    const url = bot.contact || "https://t.me/Print_54";
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank");
  };
  document.documentElement.style.setProperty("--acc", bot.accent);
  document.documentElement.style.setProperty("--acc-dark", bot.accentDark || bot.accent);
  document.title = bot.name;
  $("appName").textContent = bot.name;
  $("appLogo").textContent = bot.logo || "AI";
  if (user && user.first_name) $("appHi").textContent = `Salom, ${user.first_name} 👋`;

  /* ---------- tema ---------- */
  const store = {
    get() { try { return localStorage.getItem("app-theme") || "auto"; } catch (e) { return "auto"; } },
    set(v) { try { localStorage.setItem("app-theme", v); } catch (e) {} },
  };
  function applyTheme() {
    const pref = store.get();
    // Telegram ichida — Telegram temasi, tashqarida — qurilma temasi
    const inTg = tg && tg.platform && tg.platform !== "unknown";
    const sysDark = inTg ? tg.colorScheme === "dark" : window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = pref === "dark" || (pref === "auto" && sysDark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.querySelectorAll("[data-theme-pick]").forEach((el) => el.classList.toggle("on", el.dataset.themePick === pref));
    // Telegram sarlavha va fon rangi ham temaga mos
    try {
      const c = dark ? "#0B0B14" : "#F5F6FA";
      tg && tg.setHeaderColor && tg.setHeaderColor(c);
      tg && tg.setBackgroundColor && tg.setBackgroundColor(c);
      tg && tg.setBottomBarColor && tg.setBottomBarColor(c);
    } catch (e) {}
  }
  applyTheme();
  if (tg && tg.onEvent) tg.onEvent("themeChanged", applyTheme);
  // Til: o'zbek (standart) / rus / ingliz — ilova qayta yuklanadi; bot xabarlari uchun serverga ham
  const curLang = (window.AI_I18N && window.AI_I18N.lang) || "uz";
  document.querySelectorAll("[data-lang-pick]").forEach((el) => el.classList.toggle("on", el.dataset.langPick === curLang));
  $("langSeg").addEventListener("click", async (e) => {
    const p = e.target.closest("[data-lang-pick]");
    if (!p || p.dataset.langPick === curLang || !window.AI_I18N) return;
    tick();
    if (user) await api("/api/my-rewards", { setLang: p.dataset.langPick }).catch(() => null);
    window.AI_I18N.set(p.dataset.langPick);
  });
  $("themeSeg").addEventListener("click", (e) => {
    const p = e.target.closest("[data-theme-pick]");
    if (!p) return;
    store.set(p.dataset.themePick);
    tick();
    applyTheme();
  });

  /* ---------- pastki menyu ---------- */
  function go(view) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === view));
    document.querySelectorAll("[data-go]").forEach((n) => n.classList.toggle("on", n.dataset.go === view));
    if (view === "home" && window.aiOpenGrid) window.aiOpenGrid();
    if (view === "orders") loadOrders();
    window.scrollTo(0, 0);
  }
  document.querySelector(".app-nav").addEventListener("click", (e) => {
    const n = e.target.closest("[data-go]");
    if (!n) return;
    tick();
    go(n.dataset.go);
  });

  /* ---------- bosh sahifa: qidiruv va "Tekin" belgisi ---------- */
  // havola bilan xizmat ochilmagan bo'lsa (#ai_resume kabi) — xizmatlar ro'yxati
  if (!$("aiRoot").innerHTML.trim() && window.aiOpenGrid) window.aiOpenGrid();
  function decorateGrid() {
    document.querySelectorAll("#aiRoot .ai-card .p").forEach((p) => p.classList.toggle("free", p.textContent.trim() === "Tekin"));
    // ochilmagan bonuslar bo'lsa — bosh sahifada "Bepul AI xizmat oling" banneri
    const hero = document.querySelector("#aiRoot .app-hero");
    const old = document.querySelector("#aiRoot .bonus-banner");
    const n = openTasks();
    if (!hero || !n) { if (old) old.remove(); return; }
    if (old) return;
    hero.insertAdjacentHTML("afterend", `<div class="bonus-banner" data-go-bonus="1"><span class="bb-ico">🎁</span><span class="bb-txt"><b>Bepul AI xizmat oling</b><span>«Bonuslar» bo'limida sovg'alar sizni kutmoqda</span></span><span class="bb-arr">›</span></div>`);
  }
  $("aiRoot").addEventListener("click", (e) => { if (e.target.closest("[data-go-bonus]")) { tick(); go("bonus"); } });
  new MutationObserver(decorateGrid).observe($("aiRoot"), { childList: true });
  decorateGrid();
  document.addEventListener("input", (e) => {
    if (e.target.id !== "appSearch") return;
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll("#aiRoot .ai-card").forEach((c) => c.classList.toggle("hidden", !!q && !c.textContent.toLowerCase().includes(q)));
  });

  /* ---------- Buyurtmalarim ---------- */
  const TITLES = Object.fromEntries(CFG.services.map((s) => [s.id, s.title]));
  const STATUS = { active: ["⏳ Tayyorlanmoqda", "wait"], completed: ["✅ Tayyor", "done"], cancelled: ["Bekor qilingan", ""] };
  // kartaga to'lov: chek botga yuboriladi, egasi tasdiqlagach "Tayyorlanmoqda"
  const PAY_STATUS = { waiting: ["💳 To'lov kutilmoqda", "wait"], checking: ["🔎 To'lov tekshirilmoqda", "wait"] };
  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => t.classList.remove("show"), 2600);
  }
  // Server mijozni Telegram imzosi (initData) bo'yicha taniydi; bot — qaysi bot ilovasi
  const api = (path, extra) => fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: tg ? tg.initData : "", bot: key, ...extra }),
  }).then((r) => r.json().catch(() => ({})));
  async function fetchOrders() {
    if (!user) return null;
    const data = await api("/api/my-orders");
    // bu ilovada faqat AI xizmatlar buyurtmalari
    return data.ok ? (data.orders || []).filter((o) => TITLES[o.service]) : null;
  }
  async function loadOrders() {
    const box = $("ordersList");
    if (!user) { box.innerHTML = `<div class="empty"><b>📭</b>Buyurtmalarni ko'rish uchun ilovani Telegram ichida oching</div>`; return; }
    box.innerHTML = `<div class="empty">Yuklanmoqda...</div>`;
    try {
      const list = await fetchOrders();
      if (!list) throw new Error("server");
      updateBadge(list);
      box.innerHTML = list.length ? list.map((o) => {
        const pay = o.status === "active" && o.details && o.details.payState;
        const [st, cls] = pay ? PAY_STATUS[pay] : STATUS[o.status] || [o.status, ""];
        const topic = o.details && o.details.topic;
        const date = new Date(o.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        // mijozning o'z tartib raqami (umumiy #id emas); tayyor/bekor qilinganini o'chirish mumkin
        return `<div class="order card">
          <div class="row1"><div><div class="ttl">${esc(TITLES[o.service])}</div>${topic ? `<div class="topic">${esc(topic)}</div>` : ""}</div><span class="st ${cls}">${st}</span></div>
          <div class="meta"><span>№${o.n || ""} · ${date}${o.total > 0 ? ` · ${Math.round(o.total).toLocaleString("ru-RU")} so'm${o.details && o.details.spent ? " (balansdan)" : ""}` : o.total === 0 ? " · Tekin" : ""}</span>${o.status !== "active"
            ? `<button class="del" data-hide="${o.id}" aria-label="O'chirish" title="Tarixdan o'chirish"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button>` : ""}</div>
          ${o.status === "completed" && o.file_id ? `<button class="get" data-file="${o.id}">📥 Faylni olish</button>` : ""}
          ${o.status === "active" && !(o.details && (o.details.spent || o.details.payState === "checking")) ? `<div class="acts"><button class="danger" data-cancel="${o.id}">Bekor qilish</button></div>` : ""}
        </div>`;
      }).join("") : `<div class="empty"><b>🗂</b>Hali buyurtma yo'q.<br>«Asosiy» bo'limidan xizmat tanlang.</div>`;
    } catch (err) {
      box.innerHTML = `<div class="empty"><b>⚠️</b>Buyurtmalarni yuklab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.</div>`;
    }
  }
  $("ordersList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-file],[data-cancel],[data-hide]");
    if (!b || !user) return;
    if (b.dataset.cancel && !(await confirmAsk("Buyurtmani bekor qilasizmi?"))) return;
    if (b.dataset.hide && !(await confirmAsk("Buyurtmani tarixdan o'chirasizmi?"))) return;
    tick();
    b.disabled = true;
    try {
      if (b.dataset.file) {
        const data = await api("/api/order-file", { orderId: +b.dataset.file });
        toast(data.ok ? "✅ Fayl botga yuborildi" : data.error || "Faylni yuborib bo'lmadi");
      } else if (b.dataset.cancel) {
        const data = await api("/api/cancel-order", { orderId: +b.dataset.cancel });
        toast(data.ok ? "Buyurtma bekor qilindi" : data.error || "Bekor qilib bo'lmadi");
        if (data.ok) return loadOrders();
      } else {
        const card = b.closest(".order");
        card.classList.add("gone");
        const data = await api("/api/hide-order", { orderId: +b.dataset.hide });
        if (data.ok) return loadOrders();
        card.classList.remove("gone");
        toast(data.error || "Olib tashlab bo'lmadi");
      }
    } catch (err) { toast("Internet aloqasini tekshiring"); }
    b.disabled = false;
  });
  // Telegram'ning o'z tasdiqlash oynasi (brauzerda — oddiy confirm)
  function confirmAsk(text) {
    return new Promise((resolve) => {
      try {
        if (window.t) text = window.t(text);
        if (tg && tg.showConfirm && tg.platform !== "unknown") { tg.showConfirm(text, (ok) => resolve(!!ok)); return; }
      } catch (e) {}
      resolve(window.confirm(text));
    });
  }
  function updateBadge(list) {
    const n = list.filter((o) => o.status === "active").length;
    const b = $("ordersBadge");
    b.textContent = n;
    b.classList.toggle("show", n > 0);
  }
  // ai.js buyurtma yuborilgach chaqiradi
  window.updateOrdersBadge = async () => { try { const l = await fetchOrders(); if (l) updateBadge(l); } catch (e) {} };
  window.updateOrdersBadge();

  /* ---------- Profil ---------- */
  if (user) {
    $("profName").textContent = [user.first_name, user.last_name].filter(Boolean).join(" ");
    $("profUser").textContent = user.username ? "@" + user.username : "";
    $("profAvatar").textContent = (user.first_name || "?")[0].toUpperCase();
    if (user.photo_url) { $("profAvatar").style.backgroundImage = `url("${user.photo_url}")`; $("profAvatar").textContent = ""; }
  }
  document.querySelector(".view[data-view='profile']").addEventListener("click", (e) => {
    if (e.target.closest("[data-contact]") && window.aiContactOwner) window.aiContactOwner();
  });

  /* ---------- Referal: do'stlarni taklif qilish (faqat alohida AI botda) ---------- */
  let refLink = null;
  function showRewards(r) {
    $("refCard").hidden = false;
    // 3 ta do'st — 1 bepul, keyin har 2 ta do'st — yana 1 (server: first / every / next / prev)
    const first = r.first || r.step || 3, every = r.every || 2;
    const next = r.next || first, prev = r.prev || 0, left = Math.max(0, next - r.confirmed);
    $("refText").textContent = `${first} ta do'stingizni taklif qiling — 1 ta bepul AI buyurtma. Keyin har ${every} ta do'st uchun yana 1 ta.`;
    $("refCredits").textContent = r.credits;
    $("refDone").textContent = r.confirmed;
    $("refWait").textContent = left;
    $("refBar").style.width = Math.round(((r.confirmed - prev) / Math.max(1, next - prev)) * 100) + "%";
    $("refNote").textContent = (r.credits > 0 ? `Sizda ${r.credits} ta bepul buyurtma bor — buyurtma berishda «🎁 Bonusdan foydalanish» yoqilgan bo'ladi. ` : "") +
      `Keyingi bonusgacha yana ${left} ta do'st.`;
    refLink = r.link;
    $("refShare").hidden = !refLink;
  }
  async function loadRewards() {
    if (!user) return;
    try {
      const data = await api("/api/my-rewards");
      if (!data.ok || !data.ai) return; // Print 54 loyihasidagi botlarda — referal yo'q
      window.AI_BONUS = data.ai.credits;
      window.AI_FIRST_FREE = !!data.firstFree;
      if (data.balance != null) {
        $("balCard").hidden = false;
        $("balSum").textContent = Math.round(data.balance).toLocaleString("ru-RU") + " so'm";
        balMin = data.minTopup || 5000;
        $("balMinBtn").dataset.balTop = balMin;
        $("balMinBtn").textContent = balMin.toLocaleString("ru-RU") + " so'm";
        $("balCustom").min = balMin;
      }
      if (window.aiBonusChanged) window.aiBonusChanged();
      showRewards(data.ai);
      showBonus(data);
    } catch (e) {}
  }
  // Hisobni to'ldirish (buyurtmasiz): karta va noyob summa, chek botga yuboriladi.
  // Birinchi to'ldirish kamida 5 000, keyingilari kamida 3 000 so'm (server aytadi)
  let balMin = 5000;
  $("balMinBtn").addEventListener("click", () => startTopup(balMin));
  $("balCustomGo").addEventListener("click", () => {
    const amount = Math.round(Number($("balCustom").value) || 0);
    if (amount < balMin) { toast(`Kamida ${balMin.toLocaleString("ru-RU")} so'm`); $("balCustom").focus(); return; }
    if (amount > 1000000) { toast("Summa juda katta"); return; }
    startTopup(amount);
  });
  async function startTopup(amount) {
    if (!user) return;
    if (!(await confirmAsk(`Hisobni ${amount.toLocaleString("ru-RU")} so'mga to'ldirasizmi?`))) return;
    tick();
    const box = $("balPay");
    box.hidden = false;
    box.textContent = "Tayyorlanmoqda...";
    try {
      const data = await api("/api/ai-request", { service: "topup", topup: amount });
      if (!data.ok) { box.textContent = data.error || "Xatolik yuz berdi"; return; }
      const c = data.card;
      const sum = c.price.toLocaleString("ru-RU") + " so'm";
      box.innerHTML = `Shu kartaga <b>aynan ${esc(sum)}</b> o'tkazing:
        <div class="bal-card" data-copy="${esc(c.number.replace(/\s/g, ""))}">${esc(c.number)}<span>Nusxa</span></div>
        ${c.name ? `<div>${esc(c.name)}</div>` : ""}
        ${c.topup && c.price > c.topup ? `<div class="bal-extra">ℹ️ +${c.price - c.topup} so'm — to'lovingizni aniq tanib olish uchun qo'shildi, komissiya emas — u ham balansingizga tushadi.</div>` : ""}
        <div style="margin-top:6px">So'ng to'lov chekini (skrinshot) <b>botga</b> yuboring — chek avtomatik tekshiriladi va balans to'ldiriladi.</div>
        <button type="button" class="order-btn bal-go">Botga o'tish</button>`;
      box.querySelector(".bal-card").onclick = (ev) => {
        const el = ev.currentTarget;
        if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.copy).then(() => { el.querySelector("span").textContent = "✓ Nusxa olindi"; }, () => {});
      };
      box.querySelector(".bal-go").onclick = () => { if (tg && tg.close) tg.close(); };
    } catch (err) { box.textContent = "Internet aloqasini tekshiring"; }
  }
  // Profilda narxlar (public/ai/prices.js jadvalidan)
  if (window.AI_PRICES && window.AI_PRICES.priceList) {
    $("priceList").innerHTML = window.AI_PRICES.priceList().map((p) => `<div class="price-row"><span>${p.icon} ${esc(p.title)}</span><b>${esc(p.text)}</b></div>`).join("");
    $("priceCard").hidden = false;
    $("priceHead").addEventListener("click", () => {
      tick();
      $("priceBody").hidden = !$("priceBody").hidden;
      $("priceHead").classList.toggle("open", !$("priceBody").hidden);
    });
  }
  /* ---------- Bonuslar: obuna vazifalari (kanal, Instagram) va bepul buyurtmalar ---------- */
  const IG_WAIT = 8000; // Instagram'ni ochgach "Obuna bo'ldim" shuncha vaqtdan keyin bosiladi
  const opened = {
    get(k) { try { return Number(localStorage.getItem("bonus-open-" + k)) || 0; } catch (e) { return 0; } },
    set(k) { try { localStorage.setItem("bonus-open-" + k, String(Date.now())); } catch (e) {} },
  };
  function openTasks() {
    return Object.values(tasks).filter((t) => !t.done).length + (firstFree ? 1 : 0);
  }
  function showBonus(data) {
    tasks = data.tasks || {};
    firstFree = !!data.firstFree;
    $("navBonus").hidden = false;
    $("bonusNum").textContent = data.ai.credits;
    $("taskFirst").hidden = !firstFree;
    [["tg", "taskTg"], ["ig", "taskIg"]].forEach(([k, id]) => {
      const t = tasks[k];
      $(id).hidden = !t;
      if (t) paintTask(k);
    });
    const n = openTasks();
    $("bonusBadge").textContent = n;
    $("bonusBadge").classList.toggle("show", n > 0);
    decorateGrid();
  }
  function paintTask(k) {
    const t = tasks[k];
    const btn = document.querySelector(`[data-task="${k}"]`);
    const card = btn.closest(".bonus-task");
    card.classList.toggle("done", !!t.done);
    btn.disabled = false;
    if (t.done) { btn.textContent = "✅ Olindi"; btn.disabled = true; return; }
    const at = opened.get(k);
    if (!at) { btn.textContent = k === "tg" ? "Qo'shilish" : "Obuna bo'lish"; return; }
    btn.textContent = k === "tg" ? "✅ Tekshirish" : "✅ Obuna bo'ldim";
    btn.dataset.step = "check";
    // Instagram: sahifani ochib, biroz turgandan keyingina tasdiqlash mumkin
    const left = k === "ig" ? at + IG_WAIT - Date.now() : 0;
    if (left > 0) { btn.disabled = true; clearTimeout(paintTask["tm" + k]); paintTask["tm" + k] = setTimeout(() => paintTask(k), left + 50); }
  }
  function openUrl(url) {
    if (url.startsWith("https://t.me/") && tg && tg.openTelegramLink) tg.openTelegramLink(url);
    else if (tg && tg.openLink) tg.openLink(url);
    else window.open(url, "_blank");
  }
  $("taskFirst").addEventListener("click", (e) => { if (e.target.closest("[data-bonus-go]")) { tick(); go("home"); } });
  document.querySelector(".view[data-view='bonus']").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-task]");
    if (!btn || btn.disabled || !user) return;
    const k = btn.dataset.task;
    const t = tasks[k];
    if (!t || t.done) return;
    tick();
    if (btn.dataset.step !== "check") {
      opened.set(k);
      openUrl(t.url);
      setTimeout(() => paintTask(k), 400);
      return;
    }
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "Tekshirilmoqda...";
    try {
      const r = await api("/api/my-rewards", { claim: k });
      if (r.ok) {
        try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred("success"); } catch (er) {}
        toast("🎁 +1 bepul AI xizmat qo'shildi!");
        return loadRewards();
      }
      if (r.code === "notMember") { toast("Avval kanalga qo'shiling, so'ng «Tekshirish»ni bosing"); openUrl(t.url); }
      else if (r.code === "done") { toast("Bu bonus allaqachon olingan"); return loadRewards(); }
      else toast(r.error || "Hozir tekshirib bo'lmadi. Birozdan so'ng qayta urinib ko'ring");
    } catch (er) { toast("Internet aloqasini tekshiring"); }
    btn.textContent = was;
    btn.disabled = false;
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) Object.keys(tasks).forEach((k) => tasks[k] && paintTask(k)); });

  /* ---------- AI yordamchi: suzuvchi 🤖 tugma va chat ----------
     Server: /api/ai-request {service:"chat"} — bot suhbati bilan bir xil xotira va kunlik limit.
     Javobdagi tavsiya qilingan xizmatlar — tugma (bosilsa shu xizmat ochiladi). */
  const fab = $("aiFab"), sheet = $("chatSheet"), body = $("chatBody"), txt = $("chatText");
  const SUGS = ["Menga qaysi xizmat mos?", "Narxlar qancha?", "Birinchi buyurtma qanday tekin bo'ladi?", "Taqdimotni qanday buyurtma qilaman?"];
  let chatLoaded = false, chatBusy = false;
  const fmtMsg = (t) => esc(t).replace(/\*\*([^*\n][^*]*?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const tr = (t) => (window.t ? window.t(t) : t);
  function bubble(role, text, actions) {
    const d = document.createElement("div");
    d.className = "cs-msg " + (role === "user" ? "me" : "bot");
    d.innerHTML = (role === "user" ? esc(text).replace(/\n/g, "<br>") : fmtMsg(text)) +
      (actions && actions.length ? `<div class="cs-acts">${actions.map((id) => `<button type="button" class="cs-act" data-chat-open="${esc(id)}">${esc(TITLES[id] || id)} →</button>`).join("")}</div>` : "");
    d.setAttribute("data-no-i18n", ""); // matn allaqachon tarjima qilingan
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d;
  }
  function setLeft(left) {
    $("chatLeft").textContent = left == null ? tr("Xizmat tanlash va savollar bo'yicha yordam") : tr(`Bugun yana ${left} ta savol bepul`);
  }
  function showSugs(on) {
    $("chatSug").innerHTML = on ? SUGS.map((q) => `<button type="button" class="cs-chip" data-chat-q="${esc(q)}">${esc(q)}</button>`).join("") : "";
  }
  function welcome() {
    const d = bubble("bot", tr("Salom! Men AI yordamchiman 🤖 Qaysi xizmat kerakligini tanlashga yordam beraman, narxlar va bonuslarni tushuntiraman, masala va savollaringizga ham javob beraman."));
    d.removeAttribute("data-no-i18n");
    showSugs(true);
  }
  async function openChat() {
    tick();
    sheet.hidden = false;
    document.body.classList.add("chat-open");
    if (!chatLoaded) {
      chatLoaded = true;
      body.innerHTML = "";
      if (user) {
        try {
          const r = await api("/api/ai-request", { service: "chat", history: true });
          if (r.ok) { (r.msgs || []).forEach((m) => bubble(m.role, m.text)); setLeft(r.left); }
        } catch (e) {}
      }
      if (!body.childElementCount) welcome();
    }
    setTimeout(() => txt.focus(), 150);
  }
  function closeChat() {
    sheet.hidden = true;
    document.body.classList.remove("chat-open");
  }
  async function sendChat(q) {
    q = String(q || "").trim();
    if (!q || chatBusy) return;
    if (!user) { bubble("bot", tr("Yordamchidan foydalanish uchun ilovani Telegram ichida oching.")); return; }
    chatBusy = true;
    showSugs(false);
    bubble("user", q);
    txt.value = "";
    txt.style.height = "";
    const typing = bubble("bot", "");
    typing.classList.add("typing");
    typing.innerHTML = "<span></span><span></span><span></span>";
    try {
      const r = await api("/api/ai-request", { service: "chat", chat: q, lang: (window.AI_I18N && window.AI_I18N.lang) || "uz" });
      typing.remove();
      if (r.limit) {
        const d = bubble("bot", tr(`Bugungi bepul ${r.free || 10} ta savol tugadi 🙏 Ertaga yana yozishingiz mumkin. Tayyor fayllar (taqdimot, mustaqil ish, test) esa ilovada buyurtma qilinadi.`));
        d.removeAttribute("data-no-i18n");
        setLeft(0);
      } else if (r.ok) {
        bubble("bot", r.reply, r.actions);
        setLeft(r.left);
        try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred("success"); } catch (e) {}
      } else {
        const d = bubble("bot", tr(r.error || "Kechirasiz, hozir javob bera olmadim. Birozdan so'ng qayta yozing."));
        d.removeAttribute("data-no-i18n");
      }
    } catch (e) {
      typing.remove();
      const d = bubble("bot", tr("Internet aloqasini tekshiring"));
      d.removeAttribute("data-no-i18n");
    }
    chatBusy = false;
  }
  fab.addEventListener("click", openChat);
  $("chatClose").addEventListener("click", closeChat);
  $("chatNew").addEventListener("click", async () => {
    if (!(await confirmAsk("Suhbatni tozalab, yangidan boshlaymizmi?"))) return;
    tick();
    if (user) await api("/api/ai-request", { service: "chat", reset: true }).catch(() => null);
    body.innerHTML = "";
    welcome();
  });
  $("chatForm").addEventListener("submit", () => sendChat(txt.value));
  txt.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(txt.value); } });
  txt.addEventListener("input", () => { txt.style.height = "auto"; txt.style.height = Math.min(txt.scrollHeight, 120) + "px"; });
  $("chatSug").addEventListener("click", (e) => { const c = e.target.closest("[data-chat-q]"); if (c) sendChat(tr(c.dataset.chatQ)); });
  body.addEventListener("click", (e) => {
    const a = e.target.closest("[data-chat-open]");
    if (!a) return;
    tick();
    closeChat();
    go("home");
    if (window.aiOpenService) window.aiOpenService(a.dataset.chatOpen);
  });

  window.aiBonusUsed = loadRewards;
  window.aiBalanceChanged = loadRewards;
  loadRewards();
  $("refShare").addEventListener("click", () => {
    if (!refLink) return;
    tick();
    const text = `${bot.name} — taqdimot, mustaqil ish, test va boshqalarni AI bir necha daqiqada tayyorlaydi. Shu havola orqali kiring 👇`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank");
  });
})();
