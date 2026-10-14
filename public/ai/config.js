/* ================================================================
   AI XIZMATLAR — SOZLAMALAR
   Xizmatlar, ularning shakl maydonlari va shablonlar shu yerda.
   Yangi shablon yoki maydon qo'shish uchun faqat shu faylni
   o'zgartirish kifoya.
   ================================================================ */
(function () {
  const LANGS = [
    { v: "uz_lat", l: "O'zbek (lotin)" },
    { v: "uz_cyr", l: "Ўзбек (кирилл)" },
    { v: "ru", l: "Rus" },
    { v: "en", l: "Ingliz" },
  ];

  // Chop etish taklifi — har bir xizmat oxirida
  const PRINT_FIELD = {
    id: "print", type: "chips", label: "Tayyor bo'lgach chop etib berilsinmi?",
    options: [
      { v: "none", l: "Kerak emas" },
      { v: "bw", l: "Oq-qora" },
      { v: "color", l: "Rangli" },
    ],
    default: "none",
  };

  const ICONS = {
    presentation: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/></svg>',
    kurs: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/></svg>',
    essay: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    lesson: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h6M8 11h6"/></svg>',
    test: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 8 1.5 1.5L12 7M8 14l1.5 1.5L12 13M14.5 8.5H17M14.5 14.5H17"/></svg>',
    questions: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M11.56 10.96a1.52 1.52 0 1 1 2.08 1.36c-.4.2-.64.56-.64.96M13 15.9h.01"/></svg>',
    article: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/><path d="M4 4l3 3"/></svg>',
    referat: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14h7M9 17h4"/></svg>',
    resume: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="9" r="2.6"/><path d="M8 16.5c.8-1.9 2.2-2.8 4-2.8s3.2.9 4 2.8"/></svg>',
    obyektivka: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><rect x="13" y="6" width="4" height="5" rx=".6"/><path d="M7 7h4M7 10h4M7 14h10M7 17h7"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L6 21"/><path d="M17 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/></svg>',
    presentation_ai: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 13-4-4-7 7"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/></svg>',
    teacher: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="12" rx="2"/><path d="M7 21l3-6M17 21l-3-6M8 8h5M8 11h8"/></svg>',
    img2pdf: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><circle cx="9.5" cy="12.5" r="1.5"/><path d="m18 17-3.5-3.5L8 20"/></svg>',
    presentation_pro: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/><path d="m12 6.5 1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4z"/></svg>',
    pdftools: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
    character: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2"/><circle cx="9" cy="10" r=".6"/><circle cx="15" cy="10" r=".6"/><path d="M6 5.5 4 3M18 5.5 20 3"/></svg>',
    crossword: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linejoin="round"><path d="M3 9h6v6H3zM9 9h6v6H9zM15 9h6v6h-6zM9 3h6v6H9zM9 15h6v6H9z"/></svg>',
  };

  /* ---------- AI rasm (Google Nano Banana) ----------
     purpose — nima uchun: o'lcham (nisbat) shundan; style — uslub (namuna: bg gradient,
     keyin haqiqiy namuna rasm "img"); examples — har maqsadga misol tavsiflar. */
  var IMG_PURPOSES = [
    { v: "slide", l: "Slayd uchun", s: "16:9", e: "📊" },
    { v: "post", l: "Instagram post", s: "1:1", e: "📱" },
    { v: "story", l: "Stories / Reels", s: "9:16", e: "📲" },
    { v: "poster", l: "Afisha / gazeta", s: "3:4", e: "📰" },
    { v: "card", l: "Tabriknoma", s: "3:2", e: "🎉" },
    { v: "cover", l: "Muqova", s: "2:3", e: "📘" },
    { v: "logo", l: "Logotip eskizi", s: "1:1", e: "🧩" },
    { v: "free", l: "Erkin o'lcham", s: "tanlaysiz", e: "✏️" },
  ];
  var IMG_STYLES = [
    { v: "photo", l: "Realistik foto", e: "📷", bg: "linear-gradient(135deg,#334155,#94a3b8)" },
    { v: "3d", l: "3D multfilm", e: "🧸", bg: "linear-gradient(135deg,#f472b6,#fb923c)" },
    { v: "watercolor", l: "Akvarel", e: "🎨", bg: "linear-gradient(135deg,#a5f3fc,#f9a8d4)" },
    { v: "flat", l: "Minimalist", e: "🔷", bg: "linear-gradient(135deg,#22d3ee,#6366f1)" },
    { v: "anime", l: "Anime", e: "🌸", bg: "linear-gradient(135deg,#c084fc,#f472b6)" },
    { v: "pencil", l: "Qalam chizgi", e: "✏️", bg: "linear-gradient(135deg,#e5e7eb,#9ca3af)" },
    { v: "infographic", l: "Infografika", e: "📈", bg: "linear-gradient(135deg,#34d399,#3b82f6)" },
    { v: "retro", l: "Retro / vintaj", e: "📻", bg: "linear-gradient(135deg,#f59e0b,#b45309)" },
  ];
  var IMG_EXAMPLES = {
    slide: ["Quyosh tizimi sayyoralari, koinot fonida", "Amir Temur davridagi Samarqand, Registon maydoni", "Fotosintez jarayoni: yashil barg, quyosh nuri, sxema"],
    post: ["Kitob do'koni reklamasi: stol ustida kitoblar va bir finjon qahva", "Yangi yil chegirmasi: sovg'a qutilari va qor", "Matematika kursiga qabul: doska, formulalar"],
    story: ["Tog'larda tong, motivatsion kayfiyat", "Telefonda AI yordamchi, zamonaviy neon uslub", "Ramazon tabrigi: oy, fonuslar"],
    poster: ["Navro'z bayrami afishasi: sumalak, bahor gullari", "Maktab sport musobaqasi afishasi", "Kitobxonlik tanlovi afishasi"],
    card: ["Ustozlar kuni tabriknomasi: gullar va kitoblar", "Tug'ilgan kun tabriknomasi: sharlar va tort", "8-mart tabriknomasi: lolalar"],
    cover: ["Referat muqovasi: kimyo laboratoriyasi", "Bolalar ertak kitobi muqovasi: o'rmon va quyoncha", "Tarix kitobi muqovasi: qadimiy Buxoro"],
    logo: ["Kafe logotipi: qahva finjoni, minimal", "IT o'quv markazi logotipi", "Gul do'koni logotipi"],
    free: ["Kosmosdagi kitob javoni, fantastik uslub", "Ipak yo'li karvoni, quyosh botishi", "Kelajak shahri, uchar mashinalar"],
  };

  /* ---------- AI video (Google Veo) ---------- */
  var VIDEO_EXAMPLES = {
    text: ["Samarqand Registon maydoni ustidan dron bilan uchish, quyosh botishi", "Qahvaxonada bug'lanayotgan qahva finjoni, sekin harakat, iliq yorug'lik", "Kosmonavt Oyda yuribdi, orqada Yer ko'rinadi"],
    image: ["Rasmdagi odam jilmayib qo'l silkitadi", "Kamera sekin yaqinlashadi, sochlar shamolda hilpiraydi", "Fondagi bulutlar suzadi, suv to'lqinlanadi"],
  };

  window.AI_CONFIG = {
    endpoint: "/api/ai-request",
    uploadEndpoint: "/api/ai-upload",

    // Narxlar (so'm). null — "kelishiladi", 0 — "Tekin" deb ko'rsatiladi.
    // Narxni belgilash uchun raqam yozing, masalan: presentation: 15000
    prices: {
      presentation: null,
      essay: null,
      referat: null,
      article: null,
      lesson: null,
      test: null,
      questions: null,
      crossword: null,
      resume: 0,
      obyektivka: 0,
    },

    services: [
      {
        id: "image", title: "Rasm yaratish", sub: "Afisha, post, tabriknoma, slayd uchun",
        icon: ICONS.image, color: "#F472B6", comingSoon: true,
        fields: [
          { id: "purpose", type: "cards", label: "Rasm nima uchun?", options: IMG_PURPOSES, default: "post" },
          { id: "ratio", type: "chips", label: "O'lcham (nisbat)", options: [{ v: "1:1", l: "1:1 kvadrat" }, { v: "4:5", l: "4:5" }, { v: "3:4", l: "3:4" }, { v: "2:3", l: "2:3" }, { v: "9:16", l: "9:16 tik" }, { v: "16:9", l: "16:9 yotiq" }, { v: "3:2", l: "3:2" }], default: "1:1", showIf: "purpose=free" },
          { id: "style", type: "cards", label: "Uslub", options: IMG_STYLES, default: "3d", look: "style" },
          { id: "prompt", type: "textarea", label: "Rasmda nima bo'lsin?", placeholder: "O'zbekcha oddiy yozing. Masalan: Navro'z bayrami afishasi, sumalak, bahor gullari", required: true, max: 1000 },
          { id: "examples", type: "examples", label: "💡 Misollar — bosing, tavsifga qo'yiladi", target: "prompt", from: "purpose", items: IMG_EXAMPLES },
          { id: "text", type: "text", label: "Rasmdagi yozuv (ixtiyoriy)", placeholder: "Masalan: Navro'z muborak!", max: 80, hint: "Rasm ichida aynan shu yozuv to'g'ri imlo bilan chiziladi" },
          { id: "enhance", type: "switch", label: "✨ Tavsifimni AI mukammal promptga aylantirsin", default: true },
          { id: "photos", type: "photos", label: "O'z rasmingiz (ixtiyoriy)", hint: "AI shu rasm asosida chizadi: uslubini o'zgartiradi, fonni almashtiradi yoki tahrirlaydi (3 tagacha)", max: 3, default: [] },
          { id: "quality", type: "chips", label: "Sifat", options: [{ v: "std", l: "⚡ Oddiy · 1K" }, { v: "pro", l: "💎 Yuqori · 2K (chop etish uchun)" }], default: "std" },
          { id: "variants", type: "chips", label: "Variantlar", options: [{ v: "1", l: "1 ta" }, { v: "2", l: "2 ta (tanlash uchun)" }], default: "1" },
        ],
      },
      {
        id: "video", title: "Video yaratish", sub: "Matn yoki rasmdan AI video",
        icon: ICONS.video, color: "#FB923C", comingSoon: true,
        fields: [
          { id: "mode", type: "chips", seg: true, label: "Video turi", options: [{ v: "text", l: "Matndan video" }, { v: "image", l: "Rasmdan video" }], default: "text" },
          { id: "photos", type: "photos", label: "Boshlang'ich rasm", hint: "Shu rasm jonlantiriladi — video shu kadrdan boshlanadi", max: 1, default: [], showIf: "mode=image" },
          { id: "prompt", type: "textarea", label: "Tavsif (prompt)", placeholder: "Videoda nima bo'lsin? Masalan: Samarqand Registon maydoni ustidan dron bilan uchish, quyosh botishi", required: true, max: 2000, enhance: true, hint: "Batafsil yozing: joy, harakat, kamera, kayfiyat. Kimdir gapirishi kerak bo'lsa — gapini qo'shtirnoqda yozing." },
          { id: "examples", type: "examples", label: "💡 Misollar — bosing, tavsifga qo'yiladi", target: "prompt", from: "mode", items: VIDEO_EXAMPLES },
          { id: "model", type: "chips", seg: true, label: "Model", options: [{ v: "fast", l: "⚡ Fast" }, { v: "quality", l: "💎 Quality" }, { v: "lite", l: "🪶 Lite" }], default: "fast" },
          { id: "sample", type: "sample", label: "Namuna", from: "model", items: {
            fast: { note: "Fast — tez va arzon, ijtimoiy tarmoqlar uchun yetarli sifat" },
            quality: { note: "Quality — eng yuqori sifat, kinoga yaqin tasvir va ovoz" },
            lite: { note: "Lite — eng arzon, sinab ko'rish va oddiy sahnalar uchun" },
          } },
          { id: "resolution", type: "chips", seg: true, label: "O'lcham (sifat)", options: [{ v: "720p", l: "720p" }, { v: "1080p", l: "1080p" }, { v: "4k", l: "4K" }], default: "720p" },
          { id: "aspect", type: "chips", seg: true, label: "Nisbat", options: [{ v: "16:9", l: "▭ 16:9 yotiq" }, { v: "9:16", l: "▯ 9:16 tik" }], default: "9:16" },
          { id: "duration", type: "chips", seg: true, label: "Davomiyligi", options: [{ v: "4", l: "4 s" }, { v: "6", l: "6 s" }, { v: "8", l: "8 s" }], default: "8" },
          { id: "audio", type: "switch", label: "🔊 Ovoz bilan (tovushlar, musiqa, nutq)", default: true },
        ],
      },
      {
        // ichida bo'limlar (hub): open — mavjud xizmatni ochadi, aks holda «Tez kunda»
        id: "teacher", title: "O'qituvchilar uchun", sub: "Dars ishlanmasi, keys, flesh kartalar va boshqalar",
        icon: ICONS.teacher, color: "#22C55E", comingSoon: true, fields: [],
        hub: [
          { id: "lesson", e: "📘", t: ["Dars ishlanmasi", "Конспект урока", "Lesson plan"], open: "lesson", bg: "linear-gradient(135deg,#60a5fa,#2563eb)" },
          { id: "techmap", e: "🧩", t: ["Texnologik xarita", "Технологическая карта", "Lesson flow map"], bg: "linear-gradient(135deg,#34d399,#059669)" },
          { id: "case", e: "📝", t: ["Keys", "Кейс", "Case study"], bg: "linear-gradient(135deg,#fbbf24,#d97706)" },
          { id: "glossary", e: "📗", t: ["Glossariy", "Глоссарий", "Glossary"], bg: "linear-gradient(135deg,#4ade80,#16a34a)" },
          { id: "attestation", e: "📚", t: ["Attestatsiyaga tayyorlanish", "Подготовка к аттестации", "Certification prep"], bg: "linear-gradient(135deg,#a78bfa,#7c3aed)" },
          { id: "flashcards", e: "🃏", t: ["Flesh kartalar", "Флеш-карточки", "Flashcards"], bg: "linear-gradient(135deg,#f472b6,#db2777)" },
          { id: "sorting", e: "🧺", t: ["Saralash o'yini", "Игра на сортировку", "Sorting game"], bg: "linear-gradient(135deg,#fb923c,#ea580c)" },
          { id: "listening", e: "🎧", t: ["Tinglash mashqlari", "Упражнения на аудирование", "Listening exercises"], bg: "linear-gradient(135deg,#38bdf8,#0284c7)" },
        ],
      },
      {
        // AI ishlatilmaydi — PDF to'liq kodda (api/resume-pdf.js imgPdfHtml), tekin
        id: "img2pdf", title: "Rasmdan PDF", sub: "JPG, PNG rasmlarni bitta PDF faylga",
        icon: ICONS.img2pdf, color: "#EF4444",
        fields: [
          { id: "photos", type: "photos", label: "Rasmlar", hint: "30 tagacha rasm — PDF da shu tartibda bo'ladi", max: 30, default: [], required: true },
          { id: "perPage", type: "chips", seg: true, label: "1 ta varaqqa nechta rasm?", options: [{ v: "1", l: "1" }, { v: "2", l: "2" }, { v: "4", l: "4" }, { v: "6", l: "6" }, { v: "9", l: "9" }], default: "1" },
          { id: "orient", type: "chips", seg: true, label: "Varaq yo'nalishi", options: [{ v: "auto", l: "Avto" }, { v: "portrait", l: "Tik" }, { v: "landscape", l: "Yotiq" }], default: "auto" },
          { id: "margin", type: "chips", seg: true, label: "Hoshiya (chet)", options: [{ v: "none", l: "Yo'q" }, { v: "small", l: "Kichik" }, { v: "normal", l: "O'rtacha" }], default: "small" },
          { id: "fit", type: "chips", seg: true, label: "Rasm joylashuvi", options: [{ v: "contain", l: "To'liq ko'rinsin" }, { v: "cover", l: "Katakni to'ldirsin" }], default: "contain" },
          { id: "name", type: "text", label: "Fayl nomi (ixtiyoriy)", placeholder: "Masalan: Hujjatlar", max: 80 },
        ],
      },
      {
        id: "presentation", title: "Taqdimot", sub: "PowerPoint slaydlar",
        icon: ICONS.presentation, color: "#4FA8FF",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Quyosh tizimi sayyoralari", required: true, max: 200 },
          { id: "subject", type: "text", label: "Fan yoki yo'nalish", placeholder: "Masalan: Astronomiya", max: 120 },
          { id: "slides", type: "number", label: "Slaydlar soni", placeholder: "Masalan: 10", min: 3, max: 60, fallback: "10" },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "sources", type: "sources", label: "📎 Manbalar (ixtiyoriy)", default: [] },
          // Shablonsiz (standart): dizaynni AI o'zi yaratadi — galereya ko'rinmaydi
          { id: "design", type: "chips", label: "Dizayn", options: [{ v: "ai", l: "✨ AI o'zi yaratadi (shablonsiz)" }, { v: "tpl", l: "🎨 Shablon tanlayman" }], default: "ai" },
          { id: "template", type: "templates", label: "Dizayn shabloni", set: "presentation", default: "ai-dizayn", showIf: "design=tpl" },
          { id: "images", type: "switch", label: "Slaydlarga mavzuga mos rasmlar qo'shilsin", default: true },
          { id: "photos", type: "photos", label: "O'z rasmlaringiz", hint: "Ixtiyoriy — yuklagan rasmlaringiz slaydlarga qo'yiladi (10 tagacha)", max: 10, default: [] },
          { id: "charts", type: "switch", label: "📊 Diagramma qo'shilsin", default: false },
          { id: "tables", type: "switch", label: "📋 Jadval qo'shilsin", default: false },
          { id: "author", type: "text", label: "Muallif (F.I.Sh)", placeholder: "Birinchi slaydda ko'rsatiladi", max: 120 },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "pptx", l: "PowerPoint (.pptx)" }, { v: "pdf", l: "PDF" }], default: "pptx" },
          PRINT_FIELD,
        ],
      },
      {
        id: "essay", title: "Mustaqil ish", sub: "OTM va maktab uchun",
        icon: ICONS.essay, color: "#A78BFA",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Amir Temur davlatining boshqaruv tizimi", required: true, max: 200 },
          { id: "subject", type: "text", label: "Fan", placeholder: "Masalan: O'zbekiston tarixi", required: true, max: 120 },
          { id: "level", type: "chips", label: "Ta'lim bosqichi", options: [{ v: "school", l: "Maktab" }, { v: "college", l: "Kollej / litsey" }, { v: "bachelor", l: "OTM (bakalavr)" }, { v: "master", l: "Magistratura" }], default: "bachelor" },
          { id: "pages", type: "number", label: "Hajmi (bet)", placeholder: "Masalan: 12", min: 3, max: 30, fallback: "12" },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "sources", type: "sources", label: "📎 Manbalar (ixtiyoriy)", default: [] },
          { id: "template", type: "templates", label: "Titul varag'i shabloni", set: "essay", default: "otm" },
          { id: "_h1", type: "heading", label: "Titul varag'i uchun ma'lumotlar" },
          { id: "institution", type: "text", label: "Muassasa nomi", placeholder: "Masalan: TDIU yoki Toshkent davlat iqtisodiyot universiteti", max: 160, suggest: "titul", hint: "Universitet nomini yozing — ro'yxatdan tanlansa, titul o'sha OTM namunasida bo'ladi" },
          { id: "titul", type: "hidden" },
          { id: "faculty", type: "text", label: "Fakultet", placeholder: "Masalan: Energetika", max: 120, showIf: "titul" },
          { id: "student", type: "text", label: "Bajardi (F.I.Sh)", placeholder: "Ism familiya", max: 120 },
          { id: "group", type: "text", label: "Guruh / sinf", placeholder: "Masalan: BMI-21", max: 40 },
          { id: "teacher", type: "text", label: "Qabul qildi (o'qituvchi)", placeholder: "Ixtiyoriy", max: 120 },
          { id: "city", type: "text", label: "Shahar", placeholder: "Toshkent", max: 60, hideIf: "titul" },
          { id: "parts", type: "multichips", label: "Tarkibi", options: [{ v: "plan", l: "Reja" }, { v: "intro", l: "Kirish" }, { v: "main", l: "Asosiy qism" }, { v: "conclusion", l: "Xulosa" }, { v: "refs", l: "Adabiyotlar" }], default: ["plan", "intro", "main", "conclusion", "refs"] },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "docx", l: "Word (.docx)" }, { v: "pdf", l: "PDF" }], default: "docx" },
          PRINT_FIELD,
        ],
      },
      {
        id: "kurs", title: "Kurs ishi", sub: "30–40 bet, boblar, mundarija, snoskalar",
        icon: ICONS.kurs, color: "#6366F1",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Kichik biznesni rivojlantirishda soliq siyosatining roli", required: true, max: 200 },
          { id: "subject", type: "text", label: "Fan", placeholder: "Masalan: O'zbekiston tarixi", required: true, max: 120 },
          { id: "pages", type: "number", label: "Hajmi (bet)", placeholder: "Masalan: 30", min: 30, max: 40, fallback: "30" },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "sources", type: "sources", label: "📎 Manbalar (ixtiyoriy)", default: [] },
          { id: "template", type: "templates", label: "Titul varag'i shabloni", set: "kurs", default: "otm" },
          { id: "_h1", type: "heading", label: "Titul varag'i uchun ma'lumotlar" },
          { id: "institution", type: "text", label: "Muassasa nomi", placeholder: "Masalan: TDIU yoki Toshkent davlat iqtisodiyot universiteti", max: 160, suggest: "titul", hint: "Universitet nomini yozing — ro'yxatdan tanlansa, titul o'sha OTM namunasida bo'ladi" },
          { id: "titul", type: "hidden" },
          { id: "faculty", type: "text", label: "Fakultet", placeholder: "Masalan: Energetika", max: 120, showIf: "titul" },
          { id: "student", type: "text", label: "Bajardi (F.I.Sh)", placeholder: "Ism familiya", max: 120 },
          { id: "group", type: "text", label: "Guruh / sinf", placeholder: "Masalan: BMI-21", max: 40 },
          { id: "teacher", type: "text", label: "Qabul qildi (o'qituvchi)", placeholder: "Ixtiyoriy", max: 120 },
          { id: "city", type: "text", label: "Shahar", placeholder: "Toshkent", max: 60, hideIf: "titul" },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "docx", l: "Word (.docx)" }], default: "docx", hint: "Mundarija sahifa raqamlari bilan va snoskalar Word faylida bo'ladi" },
          PRINT_FIELD,
        ],
      },
      {
        id: "article", title: "Maqola yozish", sub: "Ilmiy maqola, tezis, publitsistika",
        icon: ICONS.article, color: "#F59E0B",
        fields: [
          { id: "topic", type: "text", label: "Maqola mavzusi", placeholder: "Masalan: Raqamli iqtisodiyotda kichik biznesni rivojlantirish", required: true, max: 220 },
          { id: "subject", type: "text", label: "Fan / soha", placeholder: "Masalan: Iqtisodiyot", required: true, max: 120 },
          { id: "kind", type: "chips", label: "Maqola turi", options: [{ v: "scientific", l: "Ilmiy maqola (jurnal / OAK)" }, { v: "thesis", l: "Tezis (konferensiya)" }, { v: "popular", l: "Ilmiy-ommabop / publitsistik" }], default: "scientific" },
          { id: "pages", type: "number", label: "Hajmi (bet)", placeholder: "Masalan: 6", min: 2, max: 15, fallback: "6" },
          { id: "lang", type: "chips", label: "Maqola tili", options: LANGS, default: "uz_lat" },
          { id: "annotation", type: "switch", label: "Annotatsiya va kalit so'zlar bo'lsin", default: true },
          { id: "annLangs", type: "multichips", label: "Annotatsiya tillari", options: [{ v: "uz", l: "O'zbekcha" }, { v: "ru", l: "Ruscha" }, { v: "en", l: "Inglizcha" }], default: ["uz", "ru", "en"], showIf: "annotation" },
          { id: "sources", type: "sources", label: "📎 Manbalar (ixtiyoriy)", default: [] },
          { id: "template", type: "templates", label: "Rasmiylashtirish", set: "article", default: "oak" },
          { id: "_h1", type: "heading", label: "Muallif haqida" },
          { id: "author", type: "text", label: "Muallif(lar) F.I.Sh", placeholder: "Masalan: Aliyev Ali Valiyevich", required: true, max: 200 },
          { id: "degree", type: "text", label: "Lavozim / ilmiy daraja", placeholder: "Masalan: tayanch doktorant, i.f.f.d. (PhD)", max: 160 },
          { id: "org", type: "text", label: "Tashkilot", placeholder: "Masalan: Toshkent davlat iqtisodiyot universiteti", max: 200 },
          { id: "email", type: "text", label: "E-mail (ixtiyoriy)", placeholder: "Ixtiyoriy", max: 100 },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "docx", l: "Word (.docx)" }, { v: "pdf", l: "PDF" }], default: "docx" },
          PRINT_FIELD,
        ],
      },
      {
        id: "referat", title: "Referat", sub: "Mavzu bo'yicha qisqa ish",
        icon: ICONS.referat, color: "#60A5FA",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Alisher Navoiy ijodi", required: true, max: 200 },
          { id: "subject", type: "text", label: "Fan", placeholder: "Masalan: Adabiyot", required: true, max: 120 },
          { id: "level", type: "chips", label: "Ta'lim bosqichi", options: [{ v: "school", l: "Maktab" }, { v: "college", l: "Kollej / litsey" }, { v: "bachelor", l: "OTM (bakalavr)" }, { v: "master", l: "Magistratura" }], default: "school" },
          { id: "pages", type: "number", label: "Hajmi (bet)", placeholder: "Masalan: 10", min: 3, max: 30, fallback: "10" },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "sources", type: "sources", label: "📎 Manbalar (ixtiyoriy)", default: [] },
          { id: "template", type: "templates", label: "Titul varag'i shabloni", set: "referat", default: "school" },
          { id: "_h1", type: "heading", label: "Titul varag'i uchun ma'lumotlar" },
          { id: "institution", type: "text", label: "Muassasa nomi", placeholder: "Masalan: 54-maktab yoki universitet nomi", max: 160, suggest: "titul", hint: "Universitet nomini yozing — ro'yxatdan tanlansa, titul o'sha OTM namunasida bo'ladi" },
          { id: "titul", type: "hidden" },
          { id: "faculty", type: "text", label: "Fakultet", placeholder: "Masalan: Energetika", max: 120, showIf: "titul" },
          { id: "student", type: "text", label: "Bajardi (F.I.Sh)", placeholder: "Ism familiya", max: 120 },
          { id: "group", type: "text", label: "Guruh / sinf", placeholder: "Masalan: 9-B", max: 40 },
          { id: "teacher", type: "text", label: "Qabul qildi (o'qituvchi)", placeholder: "Ixtiyoriy", max: 120 },
          { id: "city", type: "text", label: "Shahar", placeholder: "Toshkent", max: 60, hideIf: "titul" },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "docx", l: "Word (.docx)" }, { v: "pdf", l: "PDF" }], default: "docx" },
          PRINT_FIELD,
        ],
      },
      {
        id: "lesson", title: "Dars ishlanma", sub: "O'qituvchilar uchun",
        icon: ICONS.lesson, color: "#4ADE80",
        fields: [
          { id: "subject", type: "text", label: "Fan", placeholder: "Masalan: Biologiya", required: true, max: 120 },
          { id: "grade", type: "chips", label: "Sinf", options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"], default: "7", compact: true },
          { id: "topic", type: "text", label: "Dars mavzusi", placeholder: "Masalan: Hujayraning tuzilishi", required: true, max: 200 },
          { id: "type", type: "chips", label: "Dars turi", options: [{ v: "new", l: "Yangi bilim" }, { v: "reinforce", l: "Mustahkamlash" }, { v: "review", l: "Takrorlash" }, { v: "control", l: "Nazorat" }, { v: "mixed", l: "Aralash" }], default: "new" },
          { id: "duration", type: "chips", label: "Davomiyligi", options: [{ v: "45", l: "45 daqiqa" }, { v: "80", l: "80 daqiqa (juftlik)" }], default: "45" },
          { id: "methods", type: "multichips", label: "Interfaol metodlar", options: ["Aqliy hujum", "Klaster", "Insert", "Venn diagrammasi", "Guruhlarda ishlash", "Keys-stadi", "Blits-so'rov", "BBB jadvali"], default: ["Aqliy hujum", "Guruhlarda ishlash"] },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "sources", type: "sources", label: "📎 Manbalar (ixtiyoriy)", default: [] },
          { id: "template", type: "templates", label: "Ishlanma shakli", set: "lesson", default: "table" },
          { id: "teacher", type: "text", label: "O'qituvchi (F.I.Sh)", placeholder: "Ixtiyoriy", max: 120 },
          { id: "school", type: "text", label: "Maktab", placeholder: "Masalan: 54-maktab", max: 120 },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "docx", l: "Word (.docx)" }, { v: "pdf", l: "PDF" }], default: "docx" },
          PRINT_FIELD,
        ],
      },
      {
        id: "test", title: "Test tuzish", sub: "Variantli testlar",
        icon: ICONS.test, color: "#FBBF24",
        fields: [
          { id: "subject", type: "text", label: "Fan", placeholder: "Masalan: Matematika", required: true, max: 120 },
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Kasrlarni qo'shish", required: true, max: 200 },
          { id: "grade", type: "text", label: "Sinf yoki daraja", placeholder: "Masalan: 6-sinf", max: 60 },
          { id: "count", type: "number", label: "Savollar soni", placeholder: "Masalan: 20", min: 5, max: 100, fallback: "20" },
          { id: "answers", type: "chips", label: "Javob variantlari", options: [{ v: "3", l: "A–C" }, { v: "4", l: "A–D" }, { v: "5", l: "A–E" }], default: "4" },
          { id: "difficulty", type: "chips", label: "Qiyinlik", options: [{ v: "easy", l: "Oson" }, { v: "medium", l: "O'rta" }, { v: "hard", l: "Qiyin" }, { v: "mixed", l: "Aralash" }], default: "mixed" },
          { id: "variants", type: "chips", label: "Nechta variant (nusxa)", options: ["1", "2", "4"], default: "2" },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "sources", type: "sources", label: "📎 Manbalar (ixtiyoriy)", default: [] },
          { id: "template", type: "templates", label: "Varaq shakli", set: "test", default: "classic" },
          { id: "key", type: "switch", label: "Javoblar kaliti alohida varaqda", default: true },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Natija", options: [{ v: "docx", l: "Word" }, { v: "pdf", l: "PDF" }, { v: "quiz", l: "Telegram quiz" }], default: "pdf" },
          PRINT_FIELD,
        ],
      },
      {
        id: "questions", title: "Savollar tuzish", sub: "Mavzu yoki matn bo'yicha",
        icon: ICONS.questions, color: "#F472B6",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Ikkinchi jahon urushi", required: true, max: 200 },
          { id: "source", type: "textarea", label: "Matn (ixtiyoriy)", placeholder: "Savollar aynan shu matn asosida tuzilsin desangiz, matnni shu yerga qo'ying", max: 3000 },
          { id: "kinds", type: "multichips", label: "Savol turlari", options: [{ v: "open", l: "Ochiq savol" }, { v: "yesno", l: "Ha / Yo'q" }, { v: "fill", l: "Bo'sh joyni to'ldiring" }, { v: "match", l: "Moslashtiring" }, { v: "think", l: "Mulohaza uchun" }], default: ["open", "fill"] },
          { id: "count", type: "number", label: "Savollar soni", placeholder: "Masalan: 15", min: 5, max: 100, fallback: "15" },
          { id: "grade", type: "text", label: "Sinf yoki daraja", placeholder: "Masalan: 9-sinf", max: 60 },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "sources", type: "sources", label: "📎 Manbalar (ixtiyoriy)", default: [] },
          { id: "template", type: "templates", label: "Varaq shakli", set: "questions", default: "list" },
          { id: "withAnswers", type: "switch", label: "Javoblari ham berilsin", default: true },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "docx", l: "Word" }, { v: "pdf", l: "PDF" }], default: "pdf" },
          PRINT_FIELD,
        ],
      },
      {
        id: "crossword", title: "Krossvord", sub: "Chop etishga tayyor",
        icon: ICONS.crossword, color: "#2DD4BF",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Hayvonot olami", required: true, max: 200 },
          { id: "words", type: "number", label: "So'zlar soni", placeholder: "Masalan: 15", min: 5, max: 40, fallback: "15" },
          { id: "grade", type: "text", label: "Kim uchun", placeholder: "Masalan: 4-sinf o'quvchilari", max: 60 },
          { id: "custom", type: "textarea", label: "O'z so'zlaringiz (ixtiyoriy)", placeholder: "Har bir so'zni yangi qatordan yozing. Bo'sh qoldirsangiz, so'zlarni AI tanlaydi", max: 1500 },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "template", type: "templates", label: "Ko'rinishi", set: "crossword", default: "classic" },
          { id: "key", type: "switch", label: "Javoblar varaqasi ham bo'lsin", default: true },
          { id: "extra", type: "textarea", label: "Qo'shimcha talablar (ixtiyoriy)", placeholder: "Masalan: o'qituvchi talabi bo'yicha 5 ta reja bo'lsin, misollar O'zbekiston hayotidan, sodda tilda yozilsin...", max: 1500 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "pdf", l: "PDF" }, { v: "png", l: "Rasm (PNG)" }, { v: "docx", l: "Word" }], default: "pdf" },
          PRINT_FIELD,
        ],
      },
      {
        id: "resume", title: "Resume / CV", sub: "Ishga joylashish uchun",
        icon: ICONS.resume, color: "#F59E0B",
        fields: [
          { id: "name", type: "text", label: "Ism familiya", placeholder: "Masalan: Aliyev Sardor", required: true, max: 120 },
          { id: "position", type: "text", label: "Qaysi lavozimga", placeholder: "Masalan: Buxgalter", required: true, max: 120 },
          { id: "phone", type: "text", label: "Telefon", placeholder: "+998 __ ___ __ __", max: 40 },
          { id: "email", type: "text", label: "Email", placeholder: "Ixtiyoriy", max: 120 },
          { id: "city", type: "text", label: "Shahar", placeholder: "Toshkent", max: 60 },
          { id: "birth", type: "text", label: "Tug'ilgan yil", placeholder: "Masalan: 1998", max: 20 },
          { id: "about", type: "textarea", label: "O'zingiz haqingizda (qisqacha)", placeholder: "Masalan: 5 yillik tajribaga ega buxgalterman. Mas'uliyatli, jamoada ishlashni yaxshi ko'raman", max: 500 },
          { id: "experience", type: "textarea", label: "Ish tajribasi", placeholder: "Qayerda, qaysi yillarda, qanday lavozimda ishlagansiz. Tajriba bo'lmasa, bo'sh qoldiring", max: 800 },
          { id: "education", type: "textarea", label: "Ma'lumoti", placeholder: "Masalan: 2016–2020, TDIU, Buxgalteriya hisobi (bakalavr)", max: 600 },
          { id: "skills", type: "textarea", label: "Ko'nikmalar", placeholder: "Masalan: 1C, Excel, hujjatlar bilan ishlash, muloqot", max: 600 },
          { id: "langs", type: "multichips", label: "Qaysi tillarni bilasiz", options: ["O'zbek", "Rus", "Ingliz", "Turk", "Koreys", "Nemis", "Arab"], default: ["O'zbek", "Rus"] },
          { id: "photo", type: "switch", label: "Resume rasm bilan bo'lsin", default: true },
          { id: "photos", type: "photos", label: "Rasmingiz", hint: "Yuzingiz aniq ko'rinadigan rasm (hujjat rasmiga o'xshash). Hozir yuklamasangiz, keyin botga yuborishingiz mumkin", max: 1, default: [], showIf: "photo" },
          { id: "lang", type: "chips", label: "Resume tili", options: [{ v: "uz_lat", l: "O'zbek" }, { v: "ru", l: "Rus" }, { v: "en", l: "Ingliz" }], default: "uz_lat" },
          { id: "template", type: "templates", label: "Dizayn", set: "resume", default: "classic" },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "pdf", l: "PDF" }, { v: "docx", l: "Word (.docx)" }], default: "pdf" },
          PRINT_FIELD,
        ],
      },
      {
        // Rasmiy shakl (ma'lumotnoma). check: fio | date | noabbr | work — ai.js dagi tekshiruvlar
        id: "obyektivka", title: "Obyektivka", sub: "Ma'lumotnoma — rasmiy shakl",
        icon: ICONS.obyektivka, color: "#22C55E",
        fields: [
          { id: "_h0", type: "heading", label: "Shaxsiy ma'lumotlar" },
          { id: "fio", type: "text", label: "Familiyasi, ismi, otasining ismi", placeholder: "Masalan: Karimov Anvar Rustamovich", hint: "Pasportdagidek to'liq yozing — otasining ismi bilan", required: true, check: "fio", max: 120 },
          { id: "birthDate", type: "text", label: "Tug'ilgan sanasi", placeholder: "Masalan: 14.03.1985", hint: "Kun.oy.yil ko'rinishida", required: true, check: "date", max: 10, inputmode: "decimal" },
          { id: "birthPlace", type: "text", label: "Tug'ilgan joyi", placeholder: "Masalan: Samarqand viloyati, Urgut tumani", hint: "Viloyat va tumanni to'liq yozing — «vil.», «tum.» kabi qisqartirmang", required: true, check: "noabbr", max: 160 },
          { id: "nation", type: "text", label: "Millati", placeholder: "Masalan: o'zbek", required: true, max: 40 },
          { id: "photos", type: "photos", label: "3x4 rasm", hint: "Oxirgi 3 oy ichida olingan rangli rasm, rasmiy kiyimda. Rasm 3x4 o'lchamga avtomatik qirqiladi", max: 1, default: [], aspect: 0.75 },
          { id: "_h1", type: "heading", label: "Hozirgi ish (o'qish) joyi" },
          { id: "job", type: "text", label: "Ish joyi va lavozimi", placeholder: "Masalan: Urgut tumani 5-umumta'lim maktabi direktori", hint: "Tashkilot nomi va lavozimni to'liq yozing. Talaba bo'lsangiz: «Samarqand davlat universiteti 3-kurs talabasi»", required: true, check: "noabbr", max: 300 },
          { id: "since", type: "text", label: "Qachondan beri", placeholder: "Masalan: 06.09.2018", hint: "Shu lavozimga (o'qishga) kirgan sana", required: true, check: "date", max: 10, inputmode: "decimal" },
          { id: "party", type: "text", label: "Partiyaviyligi", placeholder: "Masalan: yo'q", hint: "Partiya a'zosi bo'lmasangiz «yo'q» qoldiring", default: "yo'q", max: 160 },
          { id: "_h2", type: "heading", label: "Ma'lumoti" },
          { id: "eduLevel", type: "chips", label: "Ma'lumoti", options: ["oliy", "tugallanmagan oliy", "o'rta maxsus", "o'rta"], default: "oliy" },
          { id: "graduated", type: "textarea", label: "Tamomlagan o'quv yurtlari", placeholder: "Masalan:\n2007 yil Samarqand davlat universiteti (bakalavriat)\n2009 yil Samarqand davlat universiteti (magistratura)", hint: "Har birini yangi qatordan: yili va o'quv yurtining to'liq nomi", required: true, check: "noabbr", max: 800 },
          { id: "specialty", type: "text", label: "Ma'lumoti bo'yicha mutaxassisligi", placeholder: "Masalan: matematika", required: true, max: 160 },
          { id: "degree", type: "text", label: "Ilmiy darajasi", placeholder: "Masalan: yo'q", default: "yo'q", max: 160 },
          { id: "academicTitle", type: "text", label: "Ilmiy unvoni", placeholder: "Masalan: yo'q", default: "yo'q", max: 160 },
          { id: "foreignLangs", type: "text", label: "Qaysi chet tillarini biladi", placeholder: "Masalan: rus, ingliz tillari", hint: "Faqat mukammal biladigan tillarni yozing; lug'at yordamida bilsangiz yozilmaydi", default: "yo'q", max: 160 },
          { id: "awards", type: "text", label: "Davlat mukofotlari", placeholder: "Masalan: yo'q", hint: "Bo'lsa nomini to'liq yozing", default: "yo'q", max: 300 },
          { id: "deputy", type: "text", label: "Deputatlik (saylanadigan organlar a'zoligi)", placeholder: "Masalan: yo'q", default: "yo'q", max: 300 },
          { id: "_h3", type: "heading", label: "Mehnat faoliyati" },
          { id: "work", type: "textarea", label: "Mehnat faoliyati", placeholder: "Masalan:\n2003-2007 yy. - Samarqand davlat universiteti talabasi\n2009-2018 yy. - Urgut tumani 5-maktab matematika o'qituvchisi\n2018 y. - h.v. - Urgut tumani 5-maktab direktori", hint: "Har bir qator yil bilan boshlansin. Hozirgi ish: «2018 y. - h.v. - ...» (h.v. — hozirgi vaqtgacha)", required: true, check: "work", max: 2000 },
          { id: "relatives", type: "relatives", label: "Yaqin qarindoshlar", hint: "Ota-ona, aka-uka, opa-singil, turmush o'rtog'i, farzandlar, qaynota va qaynona — hammasini yozing", default: [{ rel: "Otasi" }, { rel: "Onasi" }] },
          { id: "lang", type: "chips", label: "Hujjat alifbosi", options: [{ v: "lat", l: "Lotin" }, { v: "cyr", l: "Kirill" }], default: "lat" },
          { id: "template", type: "templates", label: "Namuna", set: "obyektivka", default: "rasmiy" },
          PRINT_FIELD,
        ],
      },
    ],

    /* ------------------------------------------------------------
       SHABLONLAR
       Taqdimot shablonlari: ranglar, shrift va bezak turi.
       Hujjat shablonlari: ko'rinish uslubi (preview + generatsiya).
       ------------------------------------------------------------ */
    /* Taqdimot shablonlari toifalari. "keys" — "Fan" yoki "Mavzu"
       maydonida shu so'zlar uchrasa, toifa avtomatik tanlanadi. */
    categories: [
      { v: "umumiy", l: "Umumiy", keys: [] },
      { v: "powerpoint", l: "PowerPoint", keys: [] }, // shablonlar/PowerPoint papkasidagi dizaynlar
      { v: "tarix", l: "Tarix", keys: ["tarix", "history", "истори", "temur", "sulola", "xonlik", "qadimgi", "urush", "mustaqillik"] },
      { v: "tabiat", l: "Tabiat", keys: ["tabiat", "ekolog", "o'rmon", "suv", "okean", "dengiz", "daryo", "iqlim", "nature", "природ"] },
      { v: "geografiya", l: "Geografiya", keys: ["geografiya", "xarita", "materik", "relyef", "geography", "географ"] },
      { v: "kimyo", l: "Kimyo", keys: ["kimyo", "chemistry", "хими", "metall", "kislota", "molekula"] },
      { v: "tibbiyot", l: "Tibbiyot", keys: ["tibbiyot", "medic", "anatomiya", "kasallik", "hamshira", "stomatolog", "farmats", "медицин", "анатом"] },
      { v: "biologiya", l: "Biologiya", keys: ["biolog", "hujayra", "genetika", "organizm", "биолог"] },
      { v: "matematika", l: "Matematika", keys: ["matematika", "algebra", "geometriya", "математ"] },
      { v: "fizika", l: "Fizika", keys: ["fizika", "physics", "elektr", "energiya", "mexanika", "muhandis", "физик"] },
      { v: "astronomiya", l: "Astronomiya", keys: ["astronomiya", "kosmos", "koinot", "sayyora", "quyosh tizimi", "yulduz", "астроном", "космос"] },
      { v: "informatika", l: "Informatika", keys: ["informatika", "kompyuter", "texnologiya", "dasturlash", "axborot", "robot", "sun'iy intellekt", "информат", "технолог"] },
      { v: "iqtisod", l: "Iqtisod", keys: ["iqtisod", "biznes", "marketing", "menejment", "moliya", "buxgalter", "tadbirkor", "startap", "transport", "logistika", "экономик"] },
      { v: "huquq", l: "Huquq", keys: ["huquq", "qonun", "konstitutsiya", "yurid", "advokat", "право", "закон"] },
      { v: "pedagogika", l: "Pedagogika", keys: ["pedagog", "psixolog", "педагог", "психолог"] },
      { v: "adabiyot", l: "Adabiyot", keys: ["adabiyot", "she'r", "navoiy", "roman", "ona tili", "kitob", "литератур"] },
      { v: "ingliz", l: "Ingliz tili", keys: ["ingliz", "english", "английск"] },
      { v: "rus", l: "Rus tili", keys: ["rus tili", "русск"] },
      { v: "sanat", l: "San'at", keys: ["san'at", "musiqa", "rassom", "tasviriy", "haykal", "teatr", "искусств", "музык"] },
      { v: "sport", l: "Sport", keys: ["jismoniy tarbiya", "sport", "futbol", "olimpiya", "sog'lom turmush", "спорт", "физкульт"] },
      { v: "tarbiya", l: "Tarbiya", keys: ["tarbiya", "ma'naviyat", "oila", "odob", "qadriyat", "axloq", "воспитан"] },
      { v: "bayram", l: "Bayramlar", keys: ["bayram", "navro'z", "navroz", "ustozlar", "8-mart", "yangi yil", "bahor", "праздник"] },
      { v: "turizm", l: "Turizm", keys: ["turizm", "sayohat", "mehmonxona", "туризм"] },
      { v: "qishloq", l: "Qishloq xo'jaligi", keys: ["qishloq xo'jal", "agro", "dehqon", "fermer", "paxta", "g'alla", "сельск"] },
      { v: "bogcha", l: "Bog'cha", keys: ["bog'cha", "maktabgacha", "bolalar bog", "детский сад", "дошкол"] },
    ],

    templates: {
      // kind: "canva" — Canva'da yasalgan shablon (rasmlari: ai/templates/<id>/1..7.jpg,
      // asl PPTX: shablonlar/<toifa>/). Qolganlari — HTML ko'rinishli oddiy mavzular.
      presentation: [
        // ✨ Aqlli umumiy shablonlar (api/_lib/smart-gen.js): AI slayd turini mazmunga qarab tanlaydi —
        // vaqt chizig'i, haqiqiy diagramma va jadval, taqqoslash... "ai-dizayn" — rang uslubini ham AI tanlaydi
        { id: "ai-dizayn", name: "✨ AI dizayn (o'zi tanlaydi)", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-minimal", name: "Oq-ko'k minimal", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-tun", name: "Tungi koinot", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-yashil", name: "Yashil tabiat", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-akademik", name: "Akademik", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-binafsha", name: "Binafsha", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-quyosh", name: "Quyoshli", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-dengiz", name: "Dengiz", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-qizil", name: "Qizil korporativ", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-oltin", name: "Qora-oltin", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-pastel", name: "Pastel (bolalar)", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-texno", name: "Texno", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "s-tibbiy", name: "Tibbiyot", kind: "canva", category: "umumiy", pages: 7, auto: true },
        { id: "tarix-qolyozma", name: "Qadimiy qo'lyozma", kind: "canva", category: "tarix", pages: 7, auto: true },
        { id: "tarix-temuriylar", name: "Temuriylar va Ipak yo'li", kind: "canva", category: "tarix", pages: 7, auto: true },
        { id: "tarix-yangi", name: "Yangi tarix", kind: "canva", category: "tarix", pages: 7, auto: true },
        { id: "tabiat-akvarel", name: "Akvarel o'rmon", kind: "canva", category: "tabiat", pages: 7, auto: true },
        { id: "tabiat-okean", name: "Okean va suv", kind: "canva", category: "tabiat", pages: 7, auto: true },
        // lib: true — Canva'ning tayyor bepul shablonlari (Canva kutubxonasidan)
        { id: "tabiat-toglar", name: "Tog'lar", kind: "canva", lib: true, category: "tabiat", pages: 7, auto: true },
        { id: "tabiat-botanika", name: "Vintaj botanika", kind: "canva", lib: true, category: "tabiat", pages: 7, auto: true },
        { id: "tabiat-ekologiya", name: "Ekologiya", kind: "canva", lib: true, category: "tabiat", pages: 7, auto: true },
        { id: "kimyo-laboratoriya", name: "Laboratoriya chizmasi", kind: "canva", lib: true, category: "kimyo", pages: 7, auto: true },
        { id: "kimyo-tungi", name: "Tungi laboratoriya", kind: "canva", lib: true, category: "kimyo", pages: 7, auto: true },
        { id: "kimyo-kashfiyot", name: "Rangli kashfiyot", kind: "canva", lib: true, category: "kimyo", pages: 7, auto: true },
        { id: "biologiya-hujayra", name: "3D hujayralar", kind: "canva", lib: true, category: "biologiya", pages: 7, auto: true },
        { id: "biologiya-dnk", name: "DNK tuzilishi", kind: "canva", lib: true, category: "biologiya", pages: 7, auto: true },
        { id: "biologiya-yashil", name: "Yashil doska", kind: "canva", lib: true, category: "biologiya", pages: 7, auto: true },
        { id: "matematika-zamonaviy", name: "Zamonaviy matematika", kind: "canva", lib: true, category: "matematika", pages: 7, auto: true },
        { id: "matematika-doska", name: "Bo'r doska", kind: "canva", lib: true, category: "matematika", pages: 7, auto: true },
        { id: "matematika-pastel", name: "Pastel matematika", kind: "canva", lib: true, category: "matematika", pages: 7, auto: true },
        { id: "adabiyot-kitob", name: "Eski kitob", kind: "canva", lib: true, category: "adabiyot", pages: 7, auto: true },
        { id: "adabiyot-tarix", name: "Adabiyot tarixi", kind: "canva", lib: true, category: "adabiyot", pages: 7, auto: true },
        { id: "adabiyot-klassik", name: "Oltin klassika", kind: "canva", lib: true, category: "adabiyot", pages: 7, auto: true },
        { id: "umumiy-kok", name: "Zamonaviy ko'k", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-sinf", name: "Boshlang'ich sinf", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        // foydalanuvchi Canva'da yulduzcha qo'ygan shablonlar
        { id: "tarix-misr", name: "Qadimgi Misr", kind: "canva", lib: true, category: "tarix", pages: 7, auto: true },
        { id: "tarix-muzey", name: "Muzey", kind: "canva", lib: true, category: "tarix", pages: 7, auto: true },
        { id: "tarix-sanoat", name: "Sanoat davri", kind: "canva", lib: true, category: "tarix", pages: 7, auto: true },
        { id: "tarix-harbiy", name: "Harbiy tarix", kind: "canva", lib: true, category: "tarix", pages: 7, auto: true },
        { id: "tabiat-yashil-tabiat", name: "Yashil tabiat", kind: "canva", lib: true, category: "tabiat", pages: 7, auto: true },
        { id: "tabiat-yer", name: "Yerni asraylik", kind: "canva", lib: true, category: "tabiat", pages: 7, auto: true },
        { id: "tabiat-ekologiya2", name: "Ekologiya 2", kind: "canva", lib: true, category: "tabiat", pages: 7, auto: true },
        { id: "tabiat-ferma", name: "Qishloq hayoti", kind: "canva", lib: true, category: "tabiat", pages: 7, auto: true },
        { id: "kimyo-metallar", name: "Metallar", kind: "canva", lib: true, category: "kimyo", pages: 7, auto: true },
        { id: "biologiya-qon", name: "Qon aylanishi", kind: "canva", lib: true, category: "biologiya", pages: 7, auto: true },
        { id: "biologiya-tibbiyot", name: "Tibbiyot", kind: "canva", lib: true, category: "biologiya", pages: 7, auto: true },
        { id: "biologiya-kasallik", name: "Kasalliklar", kind: "canva", lib: true, category: "biologiya", pages: 7, auto: true },
        { id: "biologiya-sezgi", name: "Sezgi a'zolari", kind: "canva", lib: true, category: "biologiya", pages: 7, auto: true },
        { id: "biologiya-klinika", name: "Klinika", kind: "canva", lib: true, category: "biologiya", pages: 7, auto: true },
        { id: "fizika-elektr", name: "Elektr toki", kind: "canva", lib: true, category: "fizika", pages: 7, auto: true },
        { id: "fizika-energiya", name: "Energiya", kind: "canva", lib: true, category: "fizika", pages: 7, auto: true },
        { id: "fizika-muhandislik", name: "Muhandislik", kind: "canva", lib: true, category: "fizika", pages: 7, auto: true },
        { id: "informatika-kompyuter", name: "Kompyuter qismlari", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "informatika-innovatsiya", name: "Innovatsiya", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "informatika-kelajak", name: "Kelajak texnologiyasi", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "informatika-elektromobil", name: "Elektromobil", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "informatika-neon", name: "Neon texnologiya", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "informatika-gibrid", name: "Gibrid avtomobil", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "informatika-futuristik", name: "Futuristik", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "informatika-kibersport", name: "Kibersport", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "informatika-oyin", name: "O'yinlar", kind: "canva", lib: true, category: "informatika", pages: 7, auto: true },
        { id: "iqtisod-kompaniya", name: "Kompaniya profili", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-marketing", name: "Raqamli marketing", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-mahsulot", name: "Mahsulot taqdimoti", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-ijtimoiy", name: "Ijtimoiy innovatsiya", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-moliya", name: "Shaxsiy moliya", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-qizil", name: "Qizil biznes", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-taklif", name: "Biznes taklif", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-startap", name: "Startap", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-profil", name: "Kompaniya haqida", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-trening", name: "Trening", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-avtosalon", name: "Avtosalon", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-kiyim", name: "Kiyim brendi", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-moda", name: "Vintaj moda", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "iqtisod-kouch", name: "Life coach", kind: "canva", lib: true, category: "iqtisod", pages: 7, auto: true },
        { id: "adabiyot-kitobxon", name: "Kitobxonlik", kind: "canva", lib: true, category: "adabiyot", pages: 7, auto: true },
        { id: "adabiyot-goyalar", name: "Kitob g'oyalari", kind: "canva", lib: true, category: "adabiyot", pages: 7, auto: true },
        { id: "adabiyot-ertak", name: "Ertak kitob", kind: "canva", lib: true, category: "adabiyot", pages: 7, auto: true },
        { id: "adabiyot-mavzu", name: "Asar mavzusi", kind: "canva", lib: true, category: "adabiyot", pages: 7, auto: true },
        { id: "ingliz-learning", name: "Learning English", kind: "canva", lib: true, category: "ingliz", pages: 7, auto: true },
        { id: "umumiy-neon", name: "Neon bulut", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-loyiha", name: "Yoqimli loyiha", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-bolalar", name: "Bolalar ijodi", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-talim", name: "Ta'lim", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-hayot", name: "Muvozanatli hayot", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-lahzalar", name: "Kundalik lahzalar", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-kawaii", name: "Kawaii", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-anime", name: "Anime ish stoli", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-nafis", name: "Nafis ko'k", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-kumush", name: "Kumush portfolio", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-akvarel", name: "Akvarel portfolio", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-minimal", name: "Minimal portfolio", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "umumiy-bayram", name: "Bayram", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        // yangi toifalar (Canva kutubxonasidan)
        { id: "diplom-yashil", name: "Yashil himoya", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "diplom-bej", name: "Bej himoya", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "diplom-jigarrang", name: "Jigarrang himoya", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "diplom-kok", name: "Ko'k himoya", kind: "canva", lib: true, category: "umumiy", pages: 7, auto: true },
        { id: "pedagogika-psixologiya", name: "Psixologiya", kind: "canva", lib: true, category: "pedagogika", pages: 7, auto: true },
        { id: "pedagogika-pushti", name: "Pushti psixologiya", kind: "canva", lib: true, category: "pedagogika", pages: 7, auto: true },
        { id: "pedagogika-loyiha", name: "Psixologiya loyihasi", kind: "canva", lib: true, category: "pedagogika", pages: 7, auto: true },
        { id: "pedagogika-ruhiy", name: "Ruhiy salomatlik", kind: "canva", lib: true, category: "pedagogika", pages: 7, auto: true },
        { id: "huquq-korporativ", name: "Korporativ huquq", kind: "canva", lib: true, category: "huquq", pages: 7, auto: true },
        { id: "huquq-advokat", name: "Advokat", kind: "canva", lib: true, category: "huquq", pages: 7, auto: true },
        { id: "huquq-minimal", name: "Minimal huquq", kind: "canva", lib: true, category: "huquq", pages: 7, auto: true },
        { id: "huquq-qonunlar", name: "Qoida va qonunlar", kind: "canva", lib: true, category: "huquq", pages: 7, auto: true },
        { id: "geografiya-vintaj", name: "Vintaj geografiya", kind: "canva", lib: true, category: "geografiya", pages: 7, auto: true },
        { id: "geografiya-skrapbuk", name: "Sayohat daftari", kind: "canva", lib: true, category: "geografiya", pages: 7, auto: true },
        { id: "geografiya-relyef", name: "Yer relyefi", kind: "canva", lib: true, category: "geografiya", pages: 7, auto: true },
        { id: "geografiya-xarita", name: "Xarita o'qish", kind: "canva", lib: true, category: "geografiya", pages: 7, auto: true },
        { id: "astronomiya-galaktika", name: "Galaktika", kind: "canva", lib: true, category: "astronomiya", pages: 7, auto: true },
        { id: "astronomiya-kosmos", name: "Kosmos", kind: "canva", lib: true, category: "astronomiya", pages: 7, auto: true },
        { id: "astronomiya-kok", name: "Astronomiya", kind: "canva", lib: true, category: "astronomiya", pages: 7, auto: true },
        { id: "astronomiya-tungi", name: "Tungi osmon", kind: "canva", lib: true, category: "astronomiya", pages: 7, auto: true },
        { id: "tibbiyot-skelet", name: "Skelet", kind: "canva", lib: true, category: "tibbiyot", pages: 7, auto: true },
        { id: "tibbiyot-mushak", name: "Mushaklar", kind: "canva", lib: true, category: "tibbiyot", pages: 7, auto: true },
        { id: "tibbiyot-anatomiya", name: "Inson anatomiyasi", kind: "canva", lib: true, category: "tibbiyot", pages: 7, auto: true },
        { id: "tibbiyot-organlar", name: "Ichki organlar", kind: "canva", lib: true, category: "tibbiyot", pages: 7, auto: true },
        { id: "bayram-bahor", name: "Bahor", kind: "canva", lib: true, category: "bayram", pages: 7, auto: true },
        { id: "bayram-gullar", name: "Bahor gullari", kind: "canva", lib: true, category: "bayram", pages: 7, auto: true },
        { id: "bayram-navroz", name: "Navro'z", kind: "canva", lib: true, category: "bayram", pages: 7, auto: true },
        { id: "bayram-ustoz", name: "Ustozlar kuni", kind: "canva", lib: true, category: "bayram", pages: 7, auto: true },
        { id: "tarbiya-qadriyat", name: "Hayot qadriyatlari", kind: "canva", lib: true, category: "tarbiya", pages: 7, auto: true },
        { id: "tarbiya-oila", name: "Oila", kind: "canva", lib: true, category: "tarbiya", pages: 7, auto: true },
        { id: "tarbiya-xarakter", name: "Oila va tarbiya", kind: "canva", lib: true, category: "tarbiya", pages: 7, auto: true },
        { id: "sanat-klassik", name: "Klassik san'at", kind: "canva", lib: true, category: "sanat", pages: 7, auto: true },
        { id: "sanat-oltin", name: "Oltin san'at", kind: "canva", lib: true, category: "sanat", pages: 7, auto: true },
        { id: "sanat-vintaj", name: "Vintaj san'at", kind: "canva", lib: true, category: "sanat", pages: 7, auto: true },
        { id: "sport-zamonaviy", name: "Zamonaviy sport", kind: "canva", lib: true, category: "sport", pages: 7, auto: true },
        { id: "sport-dinamik", name: "Dinamik sport", kind: "canva", lib: true, category: "sport", pages: 7, auto: true },
        { id: "sport-rangli", name: "Rangli sport", kind: "canva", lib: true, category: "sport", pages: 7, auto: true },
        { id: "rus-daftar", name: "Daftar", kind: "canva", lib: true, category: "rus", pages: 7, auto: true },
        { id: "rus-rangli", name: "Rangli dars", kind: "canva", lib: true, category: "rus", pages: 7, auto: true },
        { id: "turizm-sayohat", name: "Sayohat", kind: "canva", lib: true, category: "turizm", pages: 7, auto: true },
        { id: "turizm-minimal", name: "Minimal sayohat", kind: "canva", lib: true, category: "turizm", pages: 7, auto: true },
        { id: "turizm-yevropa", name: "Yevropa bo'ylab", kind: "canva", lib: true, category: "turizm", pages: 7, auto: true },
        { id: "qishloq-ferma", name: "Ferma", kind: "canva", lib: true, category: "qishloq", pages: 7, auto: true },
        { id: "qishloq-dala", name: "Dala", kind: "canva", lib: true, category: "qishloq", pages: 7, auto: true },
        { id: "qishloq-yashil", name: "Yashil agro", kind: "canva", lib: true, category: "qishloq", pages: 7, auto: true },
        { id: "bogcha-bolalar", name: "Bolalar bog'chasi", kind: "canva", lib: true, category: "bogcha", pages: 7, auto: true },
        { id: "bogcha-dastur", name: "Bog'cha dasturi", kind: "canva", lib: true, category: "bogcha", pages: 7, auto: true },
        { id: "bogcha-sanash", name: "Sanashni o'rganamiz", kind: "canva", lib: true, category: "bogcha", pages: 7, auto: true },
        { id: "ingliz-sinf", name: "English class", kind: "canva", lib: true, category: "ingliz", pages: 7, auto: true },
        { id: "ingliz-dars", name: "English lesson", kind: "canva", lib: true, category: "ingliz", pages: 7, auto: true },
        { id: "ingliz-doska", name: "Class syllabus", kind: "canva", lib: true, category: "ingliz", pages: 7, auto: true },
        { id: "matematika-shakllar", name: "Geometrik shakllar", kind: "canva", lib: true, category: "matematika", pages: 7, auto: true },
        { id: "matematika-geometriya", name: "Geometriya", kind: "canva", lib: true, category: "matematika", pages: 7, auto: true },
        { id: "fizika-loyiha", name: "Fizika loyihasi", kind: "canva", lib: true, category: "fizika", pages: 7, auto: true },
        { id: "fizika-bolimlar", name: "Fizika bo'limlari", kind: "canva", lib: true, category: "fizika", pages: 7, auto: true },
        { id: "fizika-kosmik", name: "Kosmik fizika", kind: "canva", lib: true, category: "fizika", pages: 7, auto: true },
        { id: "kimyo-sinf", name: "Kimyo darsi", kind: "canva", lib: true, category: "kimyo", pages: 7, auto: true },
        { id: "kimyo-atom", name: "Atom tuzilishi", kind: "canva", lib: true, category: "kimyo", pages: 7, auto: true },
        { id: "kimyo-holat", name: "Modda holatlari", kind: "canva", lib: true, category: "kimyo", pages: 7, auto: true },
        // PowerPoint'ning o'z dizayn mavzulari (asl fayl: shablonlar/<file>)
        { id: "pp-facet", name: "Yashil qirralar", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation1.pptx", auto: true },
        { id: "pp-gallery", name: "Galereya", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation2.pptx", auto: true },
        { id: "pp-integral", name: "Moviy naqsh", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation3.pptx", auto: true },
        { id: "pp-ion", name: "Zumrad", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation4.pptx", auto: true },
        { id: "pp-ion-boardroom", name: "Binafsha", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation5.pptx", auto: true },
        { id: "pp-slice", name: "Moviy kesim", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation7.pptx", auto: true },
        { id: "pp-wisp", name: "Shabada", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation9.pptx", auto: true },
        { id: "pp-banded", name: "Ko'k chiziqlar", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation10.pptx", auto: true },
        { id: "pp-basis", name: "Asos", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation11.pptx", auto: true },
        { id: "pp-berlin", name: "Olovrang", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation12.pptx", auto: true },
        { id: "pp-circuit", name: "Sxema", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation13.pptx", auto: true },
        { id: "pp-damask", name: "Damask", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation14.pptx", auto: true },
        { id: "pp-droplet", name: "Tomchi", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation15.pptx", auto: true },
        { id: "pp-dividend", name: "Bordo", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation16.pptx", auto: true },
        { id: "pp-parallax", name: "Parallaks", kind: "canva", lib: true, category: "powerpoint", pages: 7, file: "PowerPoint/Presentation17.pptx", auto: true },
        { id: "classic", name: "Klassik ko'k", category: "umumiy", bg: "#FFFFFF", title: "#1F3A93", text: "#334155", accent: "#2E6BE6", font: "sans", deco: "bar", auto: true },
        { id: "minimal", name: "Minimal", category: "umumiy", bg: "#FAFAF7", title: "#111111", text: "#444444", accent: "#111111", font: "serif", deco: "line", auto: true },
        { id: "night", name: "Tun", category: "umumiy", bg: "linear-gradient(135deg,#0F172A,#1E293B)", title: "#FFFFFF", text: "#CBD5E1", accent: "#38BDF8", font: "sans", deco: "glow", auto: true },
        { id: "nature", name: "Yashil", category: "tabiat", bg: "#F1F8F2", title: "#1B5E20", text: "#2E3B2F", accent: "#43A047", font: "sans", deco: "leaf", auto: true },
        { id: "academic", name: "Akademik", category: "umumiy", bg: "#FFFDF7", title: "#7B1E1E", text: "#333333", accent: "#C9A227", font: "serif", deco: "frame", auto: true },
        { id: "gradient", name: "Gradient", category: "umumiy", bg: "linear-gradient(135deg,#6D28D9,#DB2777)", title: "#FFFFFF", text: "#F5F3FF", accent: "#FDE68A", font: "sans", deco: "circles", auto: true },
        { id: "kids", name: "Bolalar uchun", category: "umumiy", bg: "#FFF8E1", title: "#E65100", text: "#4E342E", accent: "#29B6F6", font: "round", deco: "dots", auto: true },
        { id: "cmyk", name: "Print 54 CMYK", category: "umumiy", bg: "#FFFFFF", title: "#111111", text: "#333333", accent: "#E6007E", font: "sans", deco: "cmyk", auto: true },
      ],
      kurs: [
        { id: "otm", name: "OTM standart", style: "otm", auto: true },
        { id: "modern", name: "Zamonaviy", style: "modern", auto: true },
      ],
      essay: [
        { id: "otm", name: "OTM standart", style: "otm", auto: true },
        { id: "school", name: "Maktab", style: "school", auto: true },
        { id: "modern", name: "Zamonaviy", style: "modern", auto: true },
      ],
      article: [
        { id: "oak", name: "OAK / jurnal standarti", style: "oak", auto: true },
        { id: "conf", name: "Konferensiya to'plami", style: "conf", auto: true },
        { id: "modern", name: "Zamonaviy", style: "modern", auto: true },
      ],
      referat: [
        { id: "school", name: "Maktab", style: "school", auto: true },
        { id: "otm", name: "OTM standart", style: "otm", auto: true },
        { id: "modern", name: "Zamonaviy", style: "modern", auto: true },
      ],
      lesson: [
        // Canva kutubxonasidan dars ishlanma shablonlari
        { id: "di-kok", name: "Ko'k jadval", kind: "canva", lib: true, page: true, pages: 1 },
        { id: "di-binafsha", name: "Binafsha", kind: "canva", lib: true, page: true, pages: 1 },
        { id: "di-45", name: "45 daqiqalik dars", kind: "canva", lib: true, page: true, pages: 1, ratio: "1/1.294" },
        { id: "di-moviy", name: "Moviy", kind: "canva", lib: true, page: true, pages: 1 },
        { id: "di-sariq", name: "Sariq banner", kind: "canva", lib: true, page: true, pages: 1, ratio: "1/1.294" },
        { id: "di-sodda", name: "Sodda sariq", kind: "canva", lib: true, page: true, pages: 1 },
        { id: "di-kunlik", name: "Kunlik reja", kind: "canva", lib: true, page: true, pages: 1, ratio: "1/1.294" },
        { id: "di-yashil", name: "Yashil", kind: "canva", lib: true, page: true, pages: 1 },
        { id: "table", name: "Klassik jadval", style: "table", auto: true },
        { id: "techmap", name: "Texnologik xarita", style: "techmap", auto: true },
        { id: "notes", name: "Qisqa konspekt", style: "notes", auto: true },
      ],
      test: [
        // Canva kutubxonasidan test varaqlari
        { id: "ts-kok", name: "Ko'k sodda", kind: "canva", lib: true, page: true, pages: 2 },
        { id: "ts-togri-notogri", name: "To'g'ri / noto'g'ri", kind: "canva", lib: true, page: true, pages: 2 },
        { id: "ts-olovrang", name: "Olovrang", kind: "canva", lib: true, page: true, pages: 2 },
        { id: "ts-moviy", name: "Moviy", kind: "canva", lib: true, page: true, pages: 2 },
        { id: "ts-yashil", name: "Yashil", kind: "canva", lib: true, page: true, pages: 2 },
        { id: "ts-adabiy", name: "Adabiy", kind: "canva", lib: true, page: true, pages: 1, ratio: "1/1.294" },
        { id: "ts-kartochka", name: "Kartochkali", kind: "canva", lib: true, page: true, pages: 2, ratio: "1/1.294" },
        { id: "ts-lugat", name: "Lug'at testi", kind: "canva", lib: true, page: true, pages: 2 },
        // auto — savollarni AI tuzadi, fayl avtomatik (api/_lib/test-gen.js)
        { id: "classic", name: "Klassik", style: "classic", auto: true },
        { id: "twocol", name: "Ikki ustun (tejamkor)", style: "twocol", auto: true },
        { id: "sheet", name: "Javob varaqasi bilan", style: "sheet", auto: true },
      ],
      questions: [
        { id: "list", name: "Ro'yxat", style: "list", auto: true },
        { id: "cards", name: "Kesiladigan kartochkalar", style: "cards", auto: true },
      ],
      obyektivka: [
        { id: "rasmiy", name: "Rasmiy shakl", style: "rasmiy", auto: true },
      ],
      crossword: [
        // Canva kutubxonasidan krossvord varaqlari
        { id: "kr-kapalak", name: "Kapalaklar", kind: "canva", lib: true, page: true, pages: 2, ratio: "1/1.294" },
        { id: "kr-yashil", name: "Yashil ramka", kind: "canva", lib: true, page: true, pages: 2, ratio: "1/1.294" },
        { id: "kr-binafsha", name: "Binafsha", kind: "canva", lib: true, page: true, pages: 3 },
        { id: "kr-qish", name: "Qishki", kind: "canva", lib: true, page: true, pages: 2 },
        { id: "kr-maktab", name: "Maktabga qaytib", kind: "canva", lib: true, page: true, pages: 2, ratio: "1/1.294" },
        { id: "kr-tabiat", name: "Tabiat", kind: "canva", lib: true, page: true, pages: 2, ratio: "1/1.294" },
        { id: "kr-sayyoralar", name: "Sayyoralar", kind: "canva", lib: true, page: true, pages: 2, ratio: "1/1.294" },
        { id: "kr-kok", name: "Ko'k sodda", kind: "canva", lib: true, page: true, pages: 2, ratio: "1/1.294" },
        { id: "classic", name: "Klassik", style: "classic", auto: true },
        { id: "color", name: "Rangli (bolalar)", style: "color", auto: true },
      ],
      resume: [
        // Canva kutubxonasidan A4 resume shablonlari (rasm: ai/templates/<id>/1.jpg)
        { id: "rez-kulrang", name: "Kulrang panel", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-zumrad", name: "Zumrad", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-tungi", name: "Tungi ko'k", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-moviy", name: "Moviy", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-kok-panel", name: "Ko'k panel", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-toq", name: "To'q panel", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-diagonal", name: "Ko'k diagonal", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-sariq", name: "Sariq-qora", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-pushti", name: "Pushti", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-yashil", name: "Yashil talaba", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-jigarrang", name: "Jigarrang", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        { id: "rez-biznes", name: "Biznes ko'k", kind: "canva", lib: true, page: true, pages: 1, auto: true },
        // auto — PDF avtomatik, bir daqiqada tayyor (api/resume-pdf.js)
        { id: "classic", name: "Klassik", style: "classic", auto: true },
        { id: "modern", name: "Zamonaviy (yon panel)", style: "modern", auto: true },
        { id: "minimal", name: "Minimal", style: "minimal", auto: true },
      ],
    },
  };
  // O'zimiz yaratgan dizaynlar (lib belgisi yo'qlar) har doim ro'yxat boshida turadi,
  // Canva kutubxonasidan olinganlar — ulardan keyin (tartib saqlanadi)
  // 0 — oddiy (HTML) dizaynlar, 1 — biz Canva'da yasaganlar, 2 — Canva kutubxonasidan
  const rank = (t) => (t.lib ? 2 : t.kind === "canva" ? 1 : 0);
  Object.values(window.AI_CONFIG.templates).forEach((list) => list.sort((a, b) => rank(a) - rank(b)));

  // 🖼 Rasmli taqdimot: oddiy taqdimot (matnni Claude yozadi) + har slaydga Google Nano Banana chizgan rasm.
  // Oddiy taqdimotga Google modeli qo'shilmaydi (u bepul foto bazasidan oladi).
  (function () {
    var C = window.AI_CONFIG;
    var pres = C.services.filter(function (s) { return s.id === "presentation"; })[0];
    var fields = pres.fields.filter(function (f) { return f.id !== "images" && f.id !== "photos"; }).map(function (f) { var o = {}; for (var k in f) o[k] = f[k]; return o; });
    var at = fields.map(function (f) { return f.id; }).indexOf("template") + 1;
    fields.splice(at, 0,
      { id: "imgStyle", type: "cards", label: "Rasmlar uslubi", options: IMG_STYLES.filter(function (s) { return ["photo", "3d", "watercolor", "flat", "infographic", "retro"].indexOf(s.v) >= 0; }), default: "photo", look: "style" },
      { id: "imgCount", type: "chips", label: "Rasmlar", options: [{ v: "all", l: "Har slaydga" }, { v: "half", l: "Muhim slaydlarga (~yarmiga)" }], default: "all", hint: "Rasmlarni Google Nano Banana chizadi" });
    var svc = { id: "presentation_ai", title: "Rasmli taqdimot", sub: "Har slaydga AI chizgan rasm", icon: ICONS.presentation_ai, color: "#A78BFA", comingSoon: true, fields: fields };
    C.services.splice(C.services.indexOf(pres) + 1, 0, svc);
    // 🚀 Super taqdimot (PRO): eng kuchli model, boyroq dizayn, AI rasmlar va infografika — tez kunda
    var proFields = pres.fields.map(function (f) { var o = {}; for (var k in f) o[k] = f[k]; return o; });
    var superSvc = { id: "presentation_pro", title: "Super taqdimot", sub: "Eng kuchli AI, boy dizayn va infografika", icon: ICONS.presentation_pro, color: "#F59E0B", comingSoon: true, fields: proFields };
    C.services.splice(C.services.indexOf(svc), 0, superSvc);
    // Rasm yaratish — rasmli taqdimotdan keyin
    var img = C.services.filter(function (s) { return s.id === "image"; })[0];
    C.services.splice(C.services.indexOf(img), 1);
    C.services.splice(C.services.indexOf(svc) + 1, 0, img);
    var vid = C.services.filter(function (s) { return s.id === "video"; })[0];
    C.services.splice(C.services.indexOf(vid), 1);
    C.services.splice(C.services.indexOf(img) + 1, 0, vid);
    var i2p = C.services.filter(function (s) { return s.id === "img2pdf"; })[0];
    C.services.splice(C.services.indexOf(i2p), 1);
    C.services.splice(C.services.indexOf(pres) + 1, 0, i2p);
    // 📄 PDF vositalari (hub): Word/Excel/rasm → PDF, birlashtirish, bo'lish, PDF → Word/PowerPoint. AI yo'q, tekin.
    // Ichki vositalar asosiy to'rda ko'rinmaydi (hidden) — «PDF vositalari» kartochkasi ichidan ochiladi.
    (function () {
      var DOC_HINT = "15 MB gacha";
      function files(label, hint, exts, max, min) { return { id: "files", type: "files", label: label, hint: hint, exts: exts, max: max || 1, min: min || 1, required: true, default: [] }; }
      var tools = [
        { id: "word2pdf", title: "Word → PDF", sub: "Word (.docx) faylni PDF ga aylantirish", color: "#2563EB", fields: [
          files("Word fayl (.docx)", "Faqat .docx · " + DOC_HINT, ["docx"]),
          { id: "orient", type: "chips", seg: true, label: "Varaq yo'nalishi", options: [{ v: "portrait", l: "Tik" }, { v: "landscape", l: "Yotiq" }], default: "portrait" },
          { id: "margin", type: "chips", seg: true, label: "Hoshiya (chet)", options: [{ v: "small", l: "Kichik" }, { v: "normal", l: "O'rtacha" }, { v: "wide", l: "Keng" }], default: "normal" },
        ] },
        { id: "excel2pdf", title: "Excel → PDF", sub: "Excel jadvalini PDF ga aylantirish", color: "#16A34A", fields: [
          files("Excel fayl", "Faqat .xlsx, .xls yoki .csv · " + DOC_HINT, ["xlsx", "xls", "xlsm", "csv"]),
          { id: "orient", type: "chips", seg: true, label: "Varaq yo'nalishi", options: [{ v: "auto", l: "Avto" }, { v: "portrait", l: "Tik" }, { v: "landscape", l: "Yotiq" }], default: "auto" },
          { id: "grid", type: "chips", seg: true, label: "Katak chiziqlari", options: [{ v: "lines", l: "Bor" }, { v: "none", l: "Yo'q" }], default: "lines" },
        ] },
        { id: "pptx2pdf", title: "PowerPoint → PDF", sub: "Taqdimot (.pptx) ni PDF ga aylantirish", color: "#DC2626", fields: [
          files("PowerPoint fayl (.pptx)", "Faqat .pptx · diagramma, animatsiya va maxsus shriftlar farq qilishi mumkin · " + DOC_HINT, ["pptx"]),
        ] },
        { id: "pdfmerge", title: "PDF birlashtirish", sub: "Bir nechta PDF ni bitta faylga", color: "#7C3AED", fields: [
          files("PDF fayllar", "2 tadan 10 tagacha · ▲▼ tugmalari bilan tartibini o'zgartiring · " + DOC_HINT, ["pdf"], 10, 2),
        ] },
        { id: "pdfsplit", title: "PDF ni bo'lish", sub: "Kerakli sahifalarni ajratish yoki olib tashlash", color: "#EA580C", fields: [
          files("PDF fayl", "Faqat .pdf · " + DOC_HINT, ["pdf"]),
          { id: "mode", type: "chips", label: "Nima qilamiz?", options: [{ v: "pick", l: "Kerakli sahifalarni ajratish" }, { v: "remove", l: "Sahifalarni olib tashlash" }, { v: "each", l: "Har bir sahifa alohida (ZIP)" }], default: "pick" },
          { id: "pages", type: "text", label: "Sahifa raqamlari", placeholder: "Masalan: 1-3, 5, 8-10", hint: "Vergul bilan yozing. «7-» — 7-sahifadan oxirigacha.", max: 120, showIf: "mode=pick|remove" },
        ] },
        { id: "pdf2word", title: "PDF → Word", sub: "PDF dagi matnni Word fayliga", color: "#0284C7", fields: [
          files("PDF fayl", "Matnli PDF (nusxa olinadigan). Skaner/rasm PDF dan matn chiqmaydi. Dizayn va murakkab jadvallar saqlanmasligi mumkin · " + DOC_HINT, ["pdf"]),
        ] },
        { id: "pdf2pptx", title: "PDF → PowerPoint", sub: "PDF sahifalarini slaydlarga", color: "#D97706", fields: [
          files("PDF fayl", "Har bir sahifa slaydga rasm bo'lib tushadi (matnni tahrirlab bo'lmaydi) · 50 sahifagacha · " + DOC_HINT, ["pdf"]),
        ] },
      ];
      tools.forEach(function (t) { t.icon = ICONS.pdftools; t.hidden = true; t.back = "pdftools"; });
      var i2p = C.services.filter(function (s) { return s.id === "img2pdf"; })[0];
      i2p.hidden = true;
      i2p.back = "pdftools";
      var G = function (a, b) { return "linear-gradient(135deg," + a + "," + b + ")"; };
      var hub = {
        id: "pdftools", title: "PDF vositalari", sub: "Word, Excel, PowerPoint, rasm → PDF · birlashtirish, bo'lish · PDF → Word, PowerPoint",
        icon: ICONS.pdftools, color: "#EF4444", fields: [], hubNote: false,
        hub: [
          { id: "img2pdf", e: "🖼", t: ["Rasmdan PDF", "Фото в PDF", "Images to PDF"], open: "img2pdf", bg: G("#f87171", "#dc2626") },
          { id: "word2pdf", e: "📘", t: ["Word → PDF", "Word → PDF", "Word to PDF"], open: "word2pdf", bg: G("#60a5fa", "#2563eb") },
          { id: "excel2pdf", e: "📗", t: ["Excel → PDF", "Excel → PDF", "Excel to PDF"], open: "excel2pdf", bg: G("#4ade80", "#16a34a") },
          { id: "pptx2pdf", e: "📙", t: ["PowerPoint → PDF", "PowerPoint → PDF", "PowerPoint to PDF"], open: "pptx2pdf", bg: G("#f87171", "#b91c1c") },
          { id: "pdfmerge", e: "🧷", t: ["PDF birlashtirish", "Объединить PDF", "Merge PDF"], open: "pdfmerge", bg: G("#a78bfa", "#7c3aed") },
          { id: "pdfsplit", e: "✂️", t: ["PDF ni bo'lish", "Разделить PDF", "Split PDF"], open: "pdfsplit", bg: G("#fb923c", "#ea580c") },
          { id: "pdf2word", e: "📝", t: ["PDF → Word", "PDF → Word", "PDF to Word"], open: "pdf2word", bg: G("#38bdf8", "#0284c7") },
          { id: "pdf2pptx", e: "📊", t: ["PDF → PowerPoint", "PDF → PowerPoint", "PDF to PowerPoint"], open: "pdf2pptx", bg: G("#fbbf24", "#d97706") },
        ],
      };
      C.services.splice(C.services.indexOf(i2p) + 1, 0, hub);
      tools.forEach(function (t) { C.services.push(t); });
    })();
    // 🎬 Jonli personaj (PRO): taqdimotga harakatlanuvchi, ovozli personaj qo'shish / o'z personajini yaratish
    (function () {
      var CH = window.AI_CHARACTERS || [];
      if (!CH.length) return; // ommaviy repoda personaj fayllari yo'q — bo'lim ko'rinmaydi
      var G = function (a, b) { return "linear-gradient(135deg," + a + "," + b + ")"; };
      var add = { id: "char_add", title: "Personaj qo'shish", sub: "Tayyor taqdimotingizga jonli personaj", color: "#F59E0B", icon: ICONS.character, hidden: true, back: "charstudio", fields: [
        { id: "files", type: "files", label: "Taqdimotingiz (.pptx)", hint: "O'zingiz tayyorlagan PowerPoint fayl · 15 MB gacha", exts: ["pptx"], max: 1, min: 1, required: true, default: [] },
        { id: "character", type: "characters", label: "Personajni tanlang", hint: "🔊 tugmasini bosib, ovozini eshitib ko'ring", default: CH[0].id },
        { id: "where", type: "chips", label: "Qaysi slaydga qo'yamiz?", options: [{ v: "last", l: "Oxirgi («Rahmat» slaydi)" }, { v: "first", l: "Birinchi" }, { v: "both", l: "Birinchi va oxirgi" }, { v: "custom", l: "Boshqa slaydlar" }], default: "last" },
        { id: "slideNums", type: "text", label: "Slayd raqamlari", placeholder: "Masalan: 3, 5-7", hint: "Vergul bilan yozing", max: 60, showIf: "where=custom" },
        { id: "sound", type: "chips", label: "Musiqa / ovoz", options: [{ v: "char", l: "🔊 Personaj ovozi" }, { v: "custom", l: "🎵 O'z musiqam" }, { v: "none", l: "🔇 Ovozsiz" }], default: "char" },
        { id: "music", type: "files", label: "Musiqa fayli", hint: "mp3, m4a yoki wav · 15 MB gacha", exts: ["mp3", "m4a", "wav"], max: 1, min: 1, required: true, default: [], showIf: "sound=custom" },
        { id: "charSize", type: "chips", seg: true, label: "Personaj o'lchami", options: [{ v: "m", l: "O'rta" }, { v: "l", l: "Katta" }, { v: "xl", l: "Juda katta" }], default: "l" },
        { id: "charSide", type: "chips", seg: true, label: "Joylashuvi", options: [{ v: "right", l: "O'ng pastda" }, { v: "left", l: "Chap pastda" }], default: "right" },
      ] };
      var make = { id: "char_make", title: "Personaj yaratish", sub: "Sevimli hayvoningizdan o'z personajingiz", color: "#EC4899", icon: ICONS.character, hidden: true, back: "charstudio", comingSoon: true, fields: [
        { id: "animal", type: "text", label: "Qaysi hayvon?", placeholder: "Masalan: mushukcha, quyon, panda, kuchukcha", required: true, max: 60 },
        { id: "photos", type: "photos", label: "Hayvoningiz rasmi (ixtiyoriy)", hint: "Uy hayvoningiz bo'lsa — rasmini yuklang, personaj shunga o'xshaydi", max: 1, default: [] },
        { id: "style", type: "chips", label: "Uslub", options: [{ v: "3d", l: "3D multfilm" }, { v: "plush", l: "Yumshoq o'yinchoq" }, { v: "real", l: "Realistik" }], default: "3d" },
        { id: "action", type: "chips", label: "Harakat", options: [{ v: "wave", l: "Salomlashadi" }, { v: "dance", l: "Raqsga tushadi" }, { v: "thanks", l: "Rahmat deydi" }, { v: "joy", l: "Quvonadi" }], default: "dance" },
      ] };
      var hub = { id: "charstudio", title: "Jonli personaj", sub: "Taqdimotga raqsga tushuvchi, ovozli personaj", icon: ICONS.character, color: "#F59E0B", fields: [], hubNote: false, hub: [
        { id: "char_add", e: "🎬", t: ["Taqdimotga personaj qo'shish", "Добавить персонажа в презентацию", "Add a character to a presentation"], open: "char_add", bg: G("#fbbf24", "#d97706") },
        { id: "char_make", e: "🪄", t: ["Personaj yaratish", "Создать персонажа", "Create a character"], open: "char_make", soon: true, bg: G("#f472b6", "#db2777") },
      ] };
      C.services.splice(C.services.indexOf(vid) + 1, 0, hub, add, make);
    })();
    var tch = C.services.filter(function (s) { return s.id === "teacher"; })[0];
    C.services.splice(C.services.indexOf(tch), 1);
    C.services.splice(C.services.indexOf(vid) + 1, 0, tch);
    // Bosh sahifa bo'limlari: ⭐ Standart (std) · 💎 PRO (pro) · 🆓 Tekin (free)
    var TIER = { presentation_pro: "pro", presentation_ai: "pro", image: "pro", video: "pro", resume: "free", obyektivka: "free", img2pdf: "free", pdftools: "free", charstudio: "pro" };
    C.services.forEach(function (s) { s.tier = TIER[s.id] || "std"; });
    C.tiers = [
      { id: "std", e: "⭐", l: "Standart" },
      { id: "pro", e: "💎", l: "PRO" },
      { id: "free", e: "🆓", l: "Tekin" },
    ];
    C.templates.presentation_ai = C.templates.presentation;
    fields.forEach(function (f) { if (f.type === "templates") f.set = "presentation"; });
  })();
})();
