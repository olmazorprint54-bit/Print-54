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
  }
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
        const [st, cls] = STATUS[o.status] || [o.status, ""];
        const topic = o.details && o.details.topic;
        const date = new Date(o.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        return `<div class="order card">
          <div class="row1"><div><div class="ttl">${esc(TITLES[o.service])}</div>${topic ? `<div class="topic">${esc(topic)}</div>` : ""}</div><span class="st ${cls}">${st}</span></div>
          <div class="meta">#${o.id} · ${date}${o.total === 0 ? " · Tekin" : ""}</div>
          ${o.status === "completed" && o.file_id ? `<button class="get" data-file="${o.id}">📥 Faylni olish</button>` : ""}
          <div class="acts">${o.status === "active"
            ? `<button class="danger" data-cancel="${o.id}">Bekor qilish</button>`
            : `<button data-hide="${o.id}">Ro'yxatdan olib tashlash</button>`}</div>
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
    $("refStep").textContent = r.step;
    $("refCredits").textContent = r.credits;
    $("refDone").textContent = r.confirmed;
    $("refWait").textContent = r.pending;
    const inStep = r.confirmed % r.step;
    $("refBar").style.width = Math.round((inStep / r.step) * 100) + "%";
    $("refNote").textContent = (r.credits > 0 ? `Sizda ${r.credits} ta bepul buyurtma bor — buyurtma berishda «🎁 Bonusdan foydalanish» yoqilgan bo'ladi. ` : "") +
      `Keyingi bonusgacha yana ${r.step - inStep} ta do'st.`;
    refLink = r.link;
    $("refShare").hidden = !refLink;
  }
  async function loadRewards() {
    if (!user) return;
    try {
      const data = await api("/api/my-rewards");
      if (!data.ok || !data.ai) return; // Print 54 loyihasidagi botlarda — referal yo'q
      window.AI_BONUS = data.ai.credits;
      if (window.aiBonusChanged) window.aiBonusChanged();
      showRewards(data.ai);
    } catch (e) {}
  }
  window.aiBonusUsed = loadRewards;
  loadRewards();
  $("refShare").addEventListener("click", () => {
    if (!refLink) return;
    tick();
    const text = `${bot.name} — taqdimot, mustaqil ish, test va boshqalarni AI bir necha daqiqada tayyorlaydi. Shu havola orqali kiring 👇`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank");
  });
})();
