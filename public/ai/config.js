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
    essay: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    lesson: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h6M8 11h6"/></svg>',
    test: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 8 1.5 1.5L12 7M8 14l1.5 1.5L12 13M14.5 8.5H17M14.5 14.5H17"/></svg>',
    questions: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M10 9.5a2.2 2.2 0 1 1 3 2c-.6.3-1 .8-1 1.5M12 16h.01"/></svg>',
    crossword: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linejoin="round"><path d="M3 9h6v6H3zM9 9h6v6H9zM15 9h6v6h-6zM9 3h6v6H9zM9 15h6v6H9z"/></svg>',
  };

  window.AI_CONFIG = {
    endpoint: "/api/ai-request",

    // Narxlar (so'm). null — "kelishiladi" deb ko'rsatiladi.
    // Narxni belgilash uchun raqam yozing, masalan: presentation: 15000
    prices: {
      presentation: null,
      essay: null,
      lesson: null,
      test: null,
      questions: null,
      crossword: null,
    },

    services: [
      {
        id: "presentation", title: "Taqdimot", sub: "PowerPoint slaydlar",
        icon: ICONS.presentation, color: "#4FA8FF",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Quyosh tizimi sayyoralari", required: true, max: 200 },
          { id: "subject", type: "text", label: "Fan yoki yo'nalish", placeholder: "Masalan: Astronomiya", max: 120 },
          { id: "slides", type: "chips", label: "Slaydlar soni", options: ["8", "10", "12", "15", "20"], default: "10" },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "template", type: "templates", label: "Dizayn shabloni", set: "presentation", default: "classic" },
          { id: "images", type: "switch", label: "Slaydlarga mavzuga mos rasmlar qo'shilsin", default: true },
          { id: "author", type: "text", label: "Muallif (F.I.Sh)", placeholder: "Birinchi slaydda ko'rsatiladi", max: 120 },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "pptx", l: "PowerPoint (.pptx)" }, { v: "pdf", l: "PDF" }], default: "pptx" },
          PRINT_FIELD,
        ],
      },
      {
        id: "essay", title: "Mustaqil ish", sub: "Referat, kurs ishi",
        icon: ICONS.essay, color: "#A78BFA",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Amir Temur davlatining boshqaruv tizimi", required: true, max: 200 },
          { id: "subject", type: "text", label: "Fan", placeholder: "Masalan: O'zbekiston tarixi", required: true, max: 120 },
          { id: "level", type: "chips", label: "Ta'lim bosqichi", options: [{ v: "school", l: "Maktab" }, { v: "college", l: "Kollej / litsey" }, { v: "bachelor", l: "OTM (bakalavr)" }, { v: "master", l: "Magistratura" }], default: "bachelor" },
          { id: "pages", type: "chips", label: "Hajmi (bet)", options: ["10", "15", "20", "25", "30"], default: "15" },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "template", type: "templates", label: "Titul varag'i shabloni", set: "essay", default: "otm" },
          { id: "_h1", type: "heading", label: "Titul varag'i uchun ma'lumotlar" },
          { id: "institution", type: "text", label: "Muassasa nomi", placeholder: "Masalan: Toshkent davlat iqtisodiyot universiteti", max: 160 },
          { id: "student", type: "text", label: "Bajardi (F.I.Sh)", placeholder: "Ism familiya", max: 120 },
          { id: "group", type: "text", label: "Guruh / sinf", placeholder: "Masalan: BMI-21", max: 40 },
          { id: "teacher", type: "text", label: "Qabul qildi (o'qituvchi)", placeholder: "Ixtiyoriy", max: 120 },
          { id: "city", type: "text", label: "Shahar", placeholder: "Toshkent", max: 60 },
          { id: "parts", type: "multichips", label: "Tarkibi", options: [{ v: "plan", l: "Reja" }, { v: "intro", l: "Kirish" }, { v: "main", l: "Asosiy qism" }, { v: "conclusion", l: "Xulosa" }, { v: "refs", l: "Adabiyotlar" }], default: ["plan", "intro", "main", "conclusion", "refs"] },
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
          { id: "template", type: "templates", label: "Ishlanma shakli", set: "lesson", default: "table" },
          { id: "teacher", type: "text", label: "O'qituvchi (F.I.Sh)", placeholder: "Ixtiyoriy", max: 120 },
          { id: "school", type: "text", label: "Maktab", placeholder: "Masalan: 54-maktab", max: 120 },
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
          { id: "count", type: "chips", label: "Savollar soni", options: ["10", "15", "20", "30", "50"], default: "20" },
          { id: "answers", type: "chips", label: "Javob variantlari", options: [{ v: "3", l: "A–C" }, { v: "4", l: "A–D" }, { v: "5", l: "A–E" }], default: "4" },
          { id: "difficulty", type: "chips", label: "Qiyinlik", options: [{ v: "easy", l: "Oson" }, { v: "medium", l: "O'rta" }, { v: "hard", l: "Qiyin" }, { v: "mixed", l: "Aralash" }], default: "mixed" },
          { id: "variants", type: "chips", label: "Nechta variant (nusxa)", options: ["1", "2", "4"], default: "2" },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "template", type: "templates", label: "Varaq shakli", set: "test", default: "classic" },
          { id: "key", type: "switch", label: "Javoblar kaliti alohida varaqda", default: true },
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
          { id: "count", type: "chips", label: "Savollar soni", options: ["10", "15", "20", "30"], default: "15" },
          { id: "grade", type: "text", label: "Sinf yoki daraja", placeholder: "Masalan: 9-sinf", max: 60 },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "template", type: "templates", label: "Varaq shakli", set: "questions", default: "list" },
          { id: "withAnswers", type: "switch", label: "Javoblari ham berilsin", default: true },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "docx", l: "Word" }, { v: "pdf", l: "PDF" }], default: "pdf" },
          PRINT_FIELD,
        ],
      },
      {
        id: "crossword", title: "Krossvord", sub: "Chop etishga tayyor",
        icon: ICONS.crossword, color: "#2DD4BF",
        fields: [
          { id: "topic", type: "text", label: "Mavzu", placeholder: "Masalan: Hayvonot olami", required: true, max: 200 },
          { id: "words", type: "chips", label: "So'zlar soni", options: ["10", "15", "20", "25"], default: "15" },
          { id: "grade", type: "text", label: "Kim uchun", placeholder: "Masalan: 4-sinf o'quvchilari", max: 60 },
          { id: "custom", type: "textarea", label: "O'z so'zlaringiz (ixtiyoriy)", placeholder: "Har bir so'zni yangi qatordan yozing. Bo'sh qoldirsangiz, so'zlarni AI tanlaydi", max: 1500 },
          { id: "lang", type: "chips", label: "Til", options: LANGS, default: "uz_lat" },
          { id: "template", type: "templates", label: "Ko'rinishi", set: "crossword", default: "classic" },
          { id: "key", type: "switch", label: "Javoblar varaqasi ham bo'lsin", default: true },
          { id: "format", type: "chips", label: "Fayl turi", options: [{ v: "pdf", l: "PDF" }, { v: "png", l: "Rasm (PNG)" }, { v: "docx", l: "Word" }], default: "pdf" },
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
      { v: "tarix", l: "Tarix", keys: ["tarix", "history", "истори", "temur", "sulola", "xonlik", "qadimgi", "urush", "mustaqillik"] },
      { v: "tabiat", l: "Tabiat", keys: ["tabiat", "geografiya", "ekolog", "o'rmon", "suv", "okean", "dengiz", "daryo", "iqlim", "nature", "природ"] },
      { v: "kimyo", l: "Kimyo", keys: ["kimyo", "chemistry", "хими", "metall", "kislota", "molekula"] },
      { v: "biologiya", l: "Biologiya", keys: ["biolog", "hujayra", "genetika", "anatomiya", "tibbiyot", "kasallik", "organizm", "биолог", "медицин"] },
      { v: "matematika", l: "Matematika", keys: ["matematika", "algebra", "geometriya", "математ"] },
      { v: "fizika", l: "Fizika", keys: ["fizika", "physics", "elektr", "energiya", "mexanika", "muhandis", "физик"] },
      { v: "informatika", l: "Informatika", keys: ["informatika", "kompyuter", "texnologiya", "dasturlash", "axborot", "robot", "sun'iy intellekt", "информат", "технолог"] },
      { v: "iqtisod", l: "Iqtisod", keys: ["iqtisod", "biznes", "marketing", "menejment", "moliya", "buxgalter", "tadbirkor", "startap", "экономик"] },
      { v: "adabiyot", l: "Adabiyot", keys: ["adabiyot", "she'r", "navoiy", "roman", "ona tili", "kitob", "литератур"] },
      { v: "ingliz", l: "Ingliz tili", keys: ["ingliz", "english", "английск"] },
      { v: "umumiy", l: "Umumiy", keys: [] },
    ],

    templates: {
      // kind: "canva" — Canva'da yasalgan shablon (rasmlari: ai/templates/<id>/1..7.jpg,
      // asl PPTX: shablonlar/<toifa>/). Qolganlari — HTML ko'rinishli oddiy mavzular.
      presentation: [
        { id: "tarix-qolyozma", name: "Qadimiy qo'lyozma", kind: "canva", category: "tarix", pages: 7 },
        { id: "tarix-temuriylar", name: "Temuriylar va Ipak yo'li", kind: "canva", category: "tarix", pages: 7 },
        { id: "tarix-yangi", name: "Yangi tarix", kind: "canva", category: "tarix", pages: 7 },
        { id: "tabiat-akvarel", name: "Akvarel o'rmon", kind: "canva", category: "tabiat", pages: 7 },
        { id: "tabiat-okean", name: "Okean va suv", kind: "canva", category: "tabiat", pages: 7 },
        // lib: true — Canva'ning tayyor bepul shablonlari (Canva kutubxonasidan)
        { id: "tabiat-toglar", name: "Tog'lar", kind: "canva", lib: true, category: "tabiat", pages: 7 },
        { id: "tabiat-botanika", name: "Vintaj botanika", kind: "canva", lib: true, category: "tabiat", pages: 7 },
        { id: "tabiat-ekologiya", name: "Ekologiya", kind: "canva", lib: true, category: "tabiat", pages: 7 },
        { id: "kimyo-laboratoriya", name: "Laboratoriya chizmasi", kind: "canva", lib: true, category: "kimyo", pages: 7 },
        { id: "kimyo-tungi", name: "Tungi laboratoriya", kind: "canva", lib: true, category: "kimyo", pages: 7 },
        { id: "kimyo-kashfiyot", name: "Rangli kashfiyot", kind: "canva", lib: true, category: "kimyo", pages: 7 },
        { id: "biologiya-hujayra", name: "3D hujayralar", kind: "canva", lib: true, category: "biologiya", pages: 7 },
        { id: "biologiya-dnk", name: "DNK tuzilishi", kind: "canva", lib: true, category: "biologiya", pages: 7 },
        { id: "biologiya-yashil", name: "Yashil doska", kind: "canva", lib: true, category: "biologiya", pages: 7 },
        { id: "matematika-zamonaviy", name: "Zamonaviy matematika", kind: "canva", lib: true, category: "matematika", pages: 7 },
        { id: "matematika-doska", name: "Bo'r doska", kind: "canva", lib: true, category: "matematika", pages: 7 },
        { id: "matematika-pastel", name: "Pastel matematika", kind: "canva", lib: true, category: "matematika", pages: 7 },
        { id: "adabiyot-kitob", name: "Eski kitob", kind: "canva", lib: true, category: "adabiyot", pages: 7 },
        { id: "adabiyot-tarix", name: "Adabiyot tarixi", kind: "canva", lib: true, category: "adabiyot", pages: 7 },
        { id: "adabiyot-klassik", name: "Oltin klassika", kind: "canva", lib: true, category: "adabiyot", pages: 7 },
        { id: "umumiy-kok", name: "Zamonaviy ko'k", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-sinf", name: "Boshlang'ich sinf", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        // foydalanuvchi Canva'da yulduzcha qo'ygan shablonlar
        { id: "tarix-misr", name: "Qadimgi Misr", kind: "canva", lib: true, category: "tarix", pages: 7 },
        { id: "tarix-muzey", name: "Muzey", kind: "canva", lib: true, category: "tarix", pages: 7 },
        { id: "tarix-sanoat", name: "Sanoat davri", kind: "canva", lib: true, category: "tarix", pages: 7 },
        { id: "tarix-harbiy", name: "Harbiy tarix", kind: "canva", lib: true, category: "tarix", pages: 7 },
        { id: "tabiat-yashil-tabiat", name: "Yashil tabiat", kind: "canva", lib: true, category: "tabiat", pages: 7 },
        { id: "tabiat-yer", name: "Yerni asraylik", kind: "canva", lib: true, category: "tabiat", pages: 7 },
        { id: "tabiat-ekologiya2", name: "Ekologiya 2", kind: "canva", lib: true, category: "tabiat", pages: 7 },
        { id: "tabiat-ferma", name: "Qishloq hayoti", kind: "canva", lib: true, category: "tabiat", pages: 7 },
        { id: "kimyo-metallar", name: "Metallar", kind: "canva", lib: true, category: "kimyo", pages: 7 },
        { id: "biologiya-qon", name: "Qon aylanishi", kind: "canva", lib: true, category: "biologiya", pages: 7 },
        { id: "biologiya-tibbiyot", name: "Tibbiyot", kind: "canva", lib: true, category: "biologiya", pages: 7 },
        { id: "biologiya-kasallik", name: "Kasalliklar", kind: "canva", lib: true, category: "biologiya", pages: 7 },
        { id: "biologiya-sezgi", name: "Sezgi a'zolari", kind: "canva", lib: true, category: "biologiya", pages: 7 },
        { id: "biologiya-klinika", name: "Klinika", kind: "canva", lib: true, category: "biologiya", pages: 7 },
        { id: "fizika-elektr", name: "Elektr toki", kind: "canva", lib: true, category: "fizika", pages: 7 },
        { id: "fizika-energiya", name: "Energiya", kind: "canva", lib: true, category: "fizika", pages: 7 },
        { id: "fizika-muhandislik", name: "Muhandislik", kind: "canva", lib: true, category: "fizika", pages: 7 },
        { id: "informatika-kompyuter", name: "Kompyuter qismlari", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "informatika-innovatsiya", name: "Innovatsiya", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "informatika-kelajak", name: "Kelajak texnologiyasi", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "informatika-elektromobil", name: "Elektromobil", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "informatika-neon", name: "Neon texnologiya", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "informatika-gibrid", name: "Gibrid avtomobil", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "informatika-futuristik", name: "Futuristik", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "informatika-kibersport", name: "Kibersport", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "informatika-oyin", name: "O'yinlar", kind: "canva", lib: true, category: "informatika", pages: 7 },
        { id: "iqtisod-kompaniya", name: "Kompaniya profili", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-marketing", name: "Raqamli marketing", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-mahsulot", name: "Mahsulot taqdimoti", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-ijtimoiy", name: "Ijtimoiy innovatsiya", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-moliya", name: "Shaxsiy moliya", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-qizil", name: "Qizil biznes", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-taklif", name: "Biznes taklif", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-startap", name: "Startap", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-profil", name: "Kompaniya haqida", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-trening", name: "Trening", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-avtosalon", name: "Avtosalon", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-kiyim", name: "Kiyim brendi", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-moda", name: "Vintaj moda", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "iqtisod-kouch", name: "Life coach", kind: "canva", lib: true, category: "iqtisod", pages: 7 },
        { id: "adabiyot-kitobxon", name: "Kitobxonlik", kind: "canva", lib: true, category: "adabiyot", pages: 7 },
        { id: "adabiyot-goyalar", name: "Kitob g'oyalari", kind: "canva", lib: true, category: "adabiyot", pages: 7 },
        { id: "adabiyot-ertak", name: "Ertak kitob", kind: "canva", lib: true, category: "adabiyot", pages: 7 },
        { id: "adabiyot-mavzu", name: "Asar mavzusi", kind: "canva", lib: true, category: "adabiyot", pages: 7 },
        { id: "ingliz-learning", name: "Learning English", kind: "canva", lib: true, category: "ingliz", pages: 7 },
        { id: "umumiy-neon", name: "Neon bulut", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-loyiha", name: "Yoqimli loyiha", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-bolalar", name: "Bolalar ijodi", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-talim", name: "Ta'lim", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-hayot", name: "Muvozanatli hayot", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-lahzalar", name: "Kundalik lahzalar", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-kawaii", name: "Kawaii", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-anime", name: "Anime ish stoli", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-nafis", name: "Nafis ko'k", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-kumush", name: "Kumush portfolio", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-akvarel", name: "Akvarel portfolio", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-minimal", name: "Minimal portfolio", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "umumiy-bayram", name: "Bayram", kind: "canva", lib: true, category: "umumiy", pages: 7 },
        { id: "classic", name: "Klassik ko'k", category: "umumiy", bg: "#FFFFFF", title: "#1F3A93", text: "#334155", accent: "#2E6BE6", font: "sans", deco: "bar" },
        { id: "minimal", name: "Minimal", category: "umumiy", bg: "#FAFAF7", title: "#111111", text: "#444444", accent: "#111111", font: "serif", deco: "line" },
        { id: "night", name: "Tun", category: "umumiy", bg: "linear-gradient(135deg,#0F172A,#1E293B)", title: "#FFFFFF", text: "#CBD5E1", accent: "#38BDF8", font: "sans", deco: "glow" },
        { id: "nature", name: "Yashil", category: "tabiat", bg: "#F1F8F2", title: "#1B5E20", text: "#2E3B2F", accent: "#43A047", font: "sans", deco: "leaf" },
        { id: "academic", name: "Akademik", category: "umumiy", bg: "#FFFDF7", title: "#7B1E1E", text: "#333333", accent: "#C9A227", font: "serif", deco: "frame" },
        { id: "gradient", name: "Gradient", category: "umumiy", bg: "linear-gradient(135deg,#6D28D9,#DB2777)", title: "#FFFFFF", text: "#F5F3FF", accent: "#FDE68A", font: "sans", deco: "circles" },
        { id: "kids", name: "Bolalar uchun", category: "umumiy", bg: "#FFF8E1", title: "#E65100", text: "#4E342E", accent: "#29B6F6", font: "round", deco: "dots" },
        { id: "cmyk", name: "Print 54 CMYK", category: "umumiy", bg: "#FFFFFF", title: "#111111", text: "#333333", accent: "#E6007E", font: "sans", deco: "cmyk" },
      ],
      essay: [
        { id: "otm", name: "OTM standart", style: "otm" },
        { id: "school", name: "Maktab", style: "school" },
        { id: "modern", name: "Zamonaviy", style: "modern" },
      ],
      lesson: [
        { id: "table", name: "Klassik jadval", style: "table" },
        { id: "techmap", name: "Texnologik xarita", style: "techmap" },
        { id: "notes", name: "Qisqa konspekt", style: "notes" },
      ],
      test: [
        { id: "classic", name: "Klassik", style: "classic" },
        { id: "twocol", name: "Ikki ustun (tejamkor)", style: "twocol" },
        { id: "sheet", name: "Javob varaqasi bilan", style: "sheet" },
      ],
      questions: [
        { id: "list", name: "Ro'yxat", style: "list" },
        { id: "cards", name: "Kesiladigan kartochkalar", style: "cards" },
      ],
      crossword: [
        { id: "classic", name: "Klassik", style: "classic" },
        { id: "color", name: "Rangli (bolalar)", style: "color" },
      ],
    },
  };
})();
