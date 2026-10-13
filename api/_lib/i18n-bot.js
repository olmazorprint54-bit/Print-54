// api/_lib/i18n-bot.js
// ---------------------------------------------------------------
// Bot xabarlari uch tilda (uz — standart, ru, en). Mijoz tili ilova
// profilida yoki botdagi /til buyrug'ida tanlanadi va Supabase
// Storage'da saqlanadi: ai-uploads/<mijoz>/prefs/lang.json (cron
// tozalashi bu papkaga tegmaydi). Ilova matnlari lug'ati —
// public/ai/i18n.js (bu yerda ham ishlatiladi: tr()).
// Egasiga boradigan xabarlar o'zbekcha qoladi.
// ---------------------------------------------------------------
const supabase = require("./db");
const { translate } = require("../../public/ai/i18n.js");

const LANGS = ["uz", "ru", "en"];
const BUCKET = "ai-uploads";
const prefPath = (uid) => `${parseInt(uid, 10)}/prefs/lang.json`;
const cache = new Map();

async function getLang(uid) {
  if (!uid) return "uz";
  const hit = cache.get(String(uid));
  if (hit && Date.now() - hit.at < 5 * 60e3) return hit.l;
  let l = "uz";
  try {
    const { data } = await supabase.storage.from(BUCKET).download(prefPath(uid));
    if (data) {
      const j = JSON.parse(Buffer.from(await data.arrayBuffer()).toString("utf8"));
      if (LANGS.includes(j.lang)) l = j.lang;
    }
  } catch (e) { /* yo'q — o'zbekcha */ }
  cache.set(String(uid), { l, at: Date.now() });
  return l;
}

async function setLang(uid, l) {
  if (!uid || !LANGS.includes(l)) return false;
  const body = Buffer.from(JSON.stringify({ lang: l }));
  const opts = { contentType: "application/json", upsert: true };
  let { error } = await supabase.storage.from(BUCKET).upload(prefPath(uid), body, opts);
  if (error) {
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    ({ error } = await supabase.storage.from(BUCKET).upload(prefPath(uid), body, opts));
  }
  if (error) throw error;
  cache.set(String(uid), { l, at: Date.now() });
  return true;
}

const tr = (l, s) => translate(l, s);
const sum = (l, n) => Number(n || 0).toLocaleString("ru-RU") + (l === "ru" ? " сум" : l === "en" ? " UZS" : " so'm");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Xizmat nomlari
const LABELS = {
  presentation: ["Taqdimot", "Презентация", "Presentation"],
  essay: ["Mustaqil ish", "Самостоятельная работа", "Independent work"],
  kurs: ["Kurs ishi", "Курсовая работа", "Coursework"],
  referat: ["Referat", "Реферат", "Report"],
  article: ["Maqola", "Статья", "Article"],
  lesson: ["Dars ishlanma", "План урока", "Lesson plan"],
  test: ["Test", "Тест", "Test"],
  questions: ["Savollar", "Вопросы", "Questions"],
  crossword: ["Krossvord", "Кроссворд", "Crossword"],
  resume: ["Resume / CV", "Резюме / CV", "Résumé / CV"],
  obyektivka: ["Obyektivka", "Объективка", "Obyektivka"],
  img2pdf: ["Rasmdan PDF", "Фото в PDF", "Images to PDF"],
  topup: ["Hisobni to'ldirish", "Пополнение баланса", "Balance top-up"],
  paper: ["Qog'oz chop etish", "Печать документов", "Document printing"],
  book: ["Kitob chiqarish", "Книга", "Book"],
  binding: ["Pereplyot", "Переплёт", "Binding"],
};
const I = (l) => (l === "ru" ? 1 : l === "en" ? 2 : 0);
const label = (l, service) => (LABELS[service] || [service, service, service])[I(l)];

// Pastki tugmalar — har tilda; bot har qaysi tildagi matnni taniydi
const KB = {
  topup: ["💳 Hisobni to'ldirish", "💳 Пополнить баланс", "💳 Top up balance"],
  balance: ["💰 Balansim", "💰 Мой баланс", "💰 My balance"],
  prices: ["💲 Narxlar", "💲 Цены", "💲 Prices"],
  contact: ["💬 Bog'lanish", "💬 Связаться", "💬 Contact"],
};
const kbText = (l, k) => KB[k][I(l)];
const kbKind = (text) => Object.keys(KB).find((k) => KB[k].includes(text)) || null;
// "Boshqa summa" so'rovi — javob qaysi tilda bo'lsa ham taniladi
const ASK = ["✏️ Qancha so'mga to'ldirasiz?", "✏️ На какую сумму пополнить?", "✏️ How much to top up?"];

const M = {
  appBtn: ["✨ Ilovani ochish", "✨ Открыть приложение", "✨ Open the app"],
  kbHint: [
    "👇 Hisobni to'ldirish, balans, narxlar va biz bilan bog'lanish — pastdagi tugmalarda.",
    "👇 Пополнение, баланс, цены и связь с нами — на кнопках внизу.",
    "👇 Top-up, balance, prices and contact — on the buttons below.",
  ],
  welcome: [
    (o) => `Assalomu alaykum${o.name}! 👋\n\nBu yerda taqdimot, mustaqil ish, referat, test, resume va obyektivkani bir necha daqiqada tayyorlashingiz mumkin. Resume va obyektivka — <b>tekin</b>.${o.ai ? "\n\n🎁 <b>Birinchi ishingiz — tekin!</b> (kurs ishidan tashqari)" : ""}\n\n💬 Savolingizni shu yerga yozing yoki masala rasmini yuboring — AI tushuntirib beradi (kuniga ${o.free} ta bepul). Yangi mavzu: /yangi${o.ai ? `\n\n🎁 Do'stlaringizni taklif qiling: ${o.step} ta do'st — 1 ta bepul AI buyurtma, keyin har 2 ta do'st — yana 1 ta. Havola «🎁 Bonuslar» bo'limida.` : ""}\n\n🌐 Til / Язык / Language: /til\n\nBoshlash uchun pastdagi tugmani bosing 👇`,
    (o) => `Здравствуйте${o.name}! 👋\n\nЗдесь можно за несколько минут подготовить презентацию, самостоятельную работу, реферат, тест, резюме и объективку. Резюме и объективка — <b>бесплатно</b>.${o.ai ? "\n\n🎁 <b>Первая работа — бесплатно!</b> (кроме курсовой)" : ""}\n\n💬 Напишите вопрос сюда или отправьте фото задачи — AI объяснит (${o.free} бесплатно в день). Новая тема: /yangi${o.ai ? `\n\n🎁 Приглашайте друзей: ${o.step} друга — 1 бесплатный AI-заказ, дальше за каждых 2 друзей — ещё 1. Ссылка в разделе «🎁 Бонусы».` : ""}\n\n🌐 Til / Язык / Language: /til\n\nНажмите кнопку ниже, чтобы начать 👇`,
    (o) => `Hello${o.name}! 👋\n\nHere you can get a presentation, independent work, report, test, résumé or official CV ready in a few minutes. Résumé and CV — <b>free</b>.${o.ai ? "\n\n🎁 <b>Your first order is free!</b> (except coursework)" : ""}\n\n💬 Type your question here or send a photo of a problem — AI will explain it (${o.free} free per day). New topic: /yangi${o.ai ? `\n\n🎁 Invite friends: ${o.step} friends = 1 free AI order, then every 2 more friends = 1 more. Link in “🎁 Bonuses”.` : ""}\n\n🌐 Til / Язык / Language: /til\n\nTap the button below to start 👇`,
  ],
  langPick: ["🌐 Tilni tanlang:", "🌐 Выберите язык:", "🌐 Choose a language:"],
  langSet: ["✅ Til: O'zbekcha", "✅ Язык: русский", "✅ Language: English"],
  chatReset: ["🧹 Suhbat tozalandi. Yangi savolingizni yozing.", "🧹 Диалог очищен. Напишите новый вопрос.", "🧹 Chat cleared. Ask your new question."],
  topupOff: ["Hisobni to'ldirish hozircha yoqilmagan.", "Пополнение баланса пока недоступно.", "Top-ups are not available yet."],
  // to'ldirish
  menu: [
    (o) => `💳 <b>Hisobni to'ldirish</b>\n\n👛 Balansingiz: <b>${o.bal}</b>\n📌 Birinchi to'ldirish — kamida ${o.first}, keyingilari — kamida ${o.next}.\n\nSummani tanlang yoki o'zingiz yozing 👇`,
    (o) => `💳 <b>Пополнение баланса</b>\n\n👛 Ваш баланс: <b>${o.bal}</b>\n📌 Первое пополнение — от ${o.first}, последующие — от ${o.next}.\n\nВыберите сумму или введите свою 👇`,
    (o) => `💳 <b>Top up balance</b>\n\n👛 Your balance: <b>${o.bal}</b>\n📌 First top-up — at least ${o.first}, next ones — at least ${o.next}.\n\nPick an amount or enter your own 👇`,
  ],
  other: ["✏️ Boshqa summa", "✏️ Другая сумма", "✏️ Other amount"],
  balance: [
    (b) => `👛 Balansingiz: <b>${b}</b>\n\nBuyurtmalar narxi balansdan avtomatik yechiladi.`,
    (b) => `👛 Ваш баланс: <b>${b}</b>\n\nСтоимость заказов списывается с баланса автоматически.`,
    (b) => `👛 Your balance: <b>${b}</b>\n\nOrder prices are deducted from your balance automatically.`,
  ],
  ask: [
    (min) => `${ASK[0]}\nSummani raqam bilan yozing — kamida ${min}.`,
    (min) => `${ASK[1]}\nВведите сумму цифрами — минимум ${min}.`,
    (min) => `${ASK[2]}\nEnter the amount in digits — at least ${min}.`,
  ],
  askHint: ["Masalan: ", "Например: ", "E.g.: "],
  errNumber: ["Summani raqam bilan yozing, masalan: 7000", "Введите сумму цифрами, например: 7000", "Enter the amount in digits, e.g.: 7000"],
  errMin: [(m) => `To'ldirish summasi ${m}dan kam bo'lmasin.`, (m) => `Сумма пополнения — не меньше ${m}.`, (m) => `Top-up must be at least ${m}.`],
  errMax: ["Summa juda katta.", "Слишком большая сумма.", "Amount is too large."],
  // narxlar va bog'lanish
  pricesHead: ["💲 <b>AI xizmatlar narxlari</b>", "💲 <b>Цены на AI-услуги</b>", "💲 <b>AI service prices</b>"],
  pricesPrintHead: ["🖨 <b>Chop etish narxlari</b>", "🖨 <b>Цены на печать</b>", "🖨 <b>Printing prices</b>"],
  pricesPrintNote: ["Aniq summani ilovada («Hisoblash» tugmasi) hisoblang.", "Точную сумму посчитайте в приложении (кнопка «Hisoblash»).", "Calculate the exact amount in the app (the “Hisoblash” button)."],
  pricesFoot: [
    "⚡ Hujjat 1–5 daqiqada tayyor bo'ladi.\n💰 Narx balansdan avtomatik yechiladi.",
    "⚡ Документ готов за 1–5 минут.\n💰 Стоимость списывается с баланса автоматически.",
    "⚡ Ready in 1–5 minutes.\n💰 The price is deducted from your balance automatically.",
  ],
  contact: ["💬 Savol, taklif yoki muammo bo'lsa — bizga to'g'ridan-to'g'ri yozing 👇", "💬 Есть вопрос, предложение или проблема — напишите нам напрямую 👇", "💬 Questions, ideas or problems — message us directly 👇"],
  write: ["✍️ Yozish", "✍️ Написать", "✍️ Message"],
  // karta xabari
  cardTitle: ["💳 <b>Hisobni to'ldirish</b>", "💳 <b>Пополнение баланса</b>", "💳 <b>Balance top-up</b>"],
  cardAmount: [(a) => `💰 To'lov summasi: <b>${a}</b>`, (a) => `💰 Сумма к оплате: <b>${a}</b>`, (a) => `💰 Amount to pay: <b>${a}</b>`],
  cardBal: [(b, l) => `👛 Balans: ${b} → <b>${l}</b>`, (b, l) => `👛 Баланс: ${b} → <b>${l}</b>`, (b, l) => `👛 Balance: ${b} → <b>${l}</b>`],
  cardBalAfter: [(b, l) => `👛 Balans: ${b} → to'lovdan keyin <b>${l}</b>`, (b, l) => `👛 Баланс: ${b} → после оплаты <b>${l}</b>`, (b, l) => `👛 Balance: ${b} → after payment <b>${l}</b>`],
  cardNo: ["🏦 Karta", "🏦 Карта", "🏦 Card"],
  cardOwner: ["👤 Egasi", "👤 Владелец", "👤 Holder"],
  cardCopy: ["<i>(karta raqamini bossangiz — nusxa olinadi)</i>", "<i>(нажмите на номер карты, чтобы скопировать)</i>", "<i>(tap the card number to copy it)</i>"],
  cardHow: ["📌 <b>Qanday to'lanadi:</b>", "📌 <b>Как оплатить:</b>", "📌 <b>How to pay:</b>"],
  cardStep1: [(a) => `1️⃣ Kartaga <b>aynan ${a}</b> o'tkazing (Click, Payme yoki bank ilovasi)`, (a) => `1️⃣ Переведите на карту <b>ровно ${a}</b> (Click, Payme или приложение банка)`, (a) => `1️⃣ Transfer <b>exactly ${a}</b> to the card (Click, Payme or a bank app)`],
  cardStep2: ["2️⃣ To'lov chekini (skrinshot yoki PDF) shu chatga yuboring", "2️⃣ Отправьте чек (скриншот или PDF) в этот чат", "2️⃣ Send the receipt (screenshot or PDF) to this chat"],
  cardStep3Topup: ["3️⃣ Chek avtomatik tekshiriladi — balansingiz to'ldiriladi ✅", "3️⃣ Чек проверится автоматически — баланс пополнится ✅", "3️⃣ The receipt is checked automatically — your balance is topped up ✅"],
  cardStep3Order: ["3️⃣ Chek avtomatik tekshiriladi — AI ishni boshlaydi, tayyor fayl shu yerga keladi ✅", "3️⃣ Чек проверится автоматически — AI начнёт работу, готовый файл придёт сюда ✅", "3️⃣ The receipt is checked automatically — AI starts working and the file arrives here ✅"],
  cardExtra: [(x) => `<i>ℹ️ +${x} so'm — to'lovingizni aniq tanib olish uchun. Komissiya emas, u ham balansingizga tushadi.</i>`, (x) => `<i>ℹ️ +${x} сум — чтобы точно распознать ваш платёж. Это не комиссия, сумма тоже зачислится на баланс.</i>`, (x) => `<i>ℹ️ +${x} UZS — so we can recognise your payment. It's not a fee, it goes to your balance too.</i>`],
  cancelBtn: ["❌ Bekor qilish", "❌ Отменить", "❌ Cancel"],
  cancelledTopup: ["❌ Hisobni to'ldirish bekor qilindi.", "❌ Пополнение баланса отменено.", "❌ Top-up cancelled."],
  cancelledOrder: [(t) => `❌ ${t} — to'lov bekor qilindi.`, (t) => `❌ ${t} — оплата отменена.`, (t) => `❌ ${t} — payment cancelled.`],
  // chek va tasdiq
  receiptGot: ["🧾 Chek qabul qilindi, tekshirilmoqda... ⏳", "🧾 Чек получен, проверяем... ⏳", "🧾 Receipt received, checking... ⏳"],
  topupDone: [
    (o) => `✅ <b>Hisobingiz to'ldirildi!</b>\n\n💰 +${o.amount}${o.left ? `\n👛 Balans: <b>${o.left}</b>` : ""}\n\nEndi ilovada buyurtma bering — narxi balansdan avtomatik yechiladi 🚀`,
    (o) => `✅ <b>Баланс пополнен!</b>\n\n💰 +${o.amount}${o.left ? `\n👛 Баланс: <b>${o.left}</b>` : ""}\n\nТеперь оформите заказ в приложении — стоимость спишется с баланса автоматически 🚀`,
    (o) => `✅ <b>Balance topped up!</b>\n\n💰 +${o.amount}${o.left ? `\n👛 Balance: <b>${o.left}</b>` : ""}\n\nNow place an order in the app — the price is deducted automatically 🚀`,
  ],
  orderPaid: [
    (o) => `✅ <b>To'lov tasdiqlandi!</b>${o.topup ? `\n\n💰 Hisobingizga: +${o.amount}\n🧾 Buyurtmaga: −${o.spent}${o.left ? `\n👛 Balans: <b>${o.left}</b>` : ""}` : ""}\n\n⏳ «${o.label}» tayyorlanmoqda — bir necha daqiqada fayl shu yerga keladi.`,
    (o) => `✅ <b>Оплата подтверждена!</b>${o.topup ? `\n\n💰 На баланс: +${o.amount}\n🧾 За заказ: −${o.spent}${o.left ? `\n👛 Баланс: <b>${o.left}</b>` : ""}` : ""}\n\n⏳ «${o.label}» готовится — файл придёт сюда через несколько минут.`,
    (o) => `✅ <b>Payment confirmed!</b>${o.topup ? `\n\n💰 To balance: +${o.amount}\n🧾 For the order: −${o.spent}${o.left ? `\n👛 Balance: <b>${o.left}</b>` : ""}` : ""}\n\n⏳ “${o.label}” is being prepared — the file will arrive here in a few minutes.`,
  ],
  rejected: [
    (o) => `⚠️ «${o.label}» uchun to'lov tasdiqlanmadi: pul kartaga tushmagan yoki chek mos emas (summa aynan ${o.amount} bo'lishi kerak).\n\nTo'g'ri chekni shu chatga qayta yuboring yoki biz bilan bog'laning.`,
    (o) => `⚠️ Оплата за «${o.label}» не подтверждена: деньги не поступили или чек не совпадает (сумма должна быть ровно ${o.amount}).\n\nОтправьте верный чек в этот чат или свяжитесь с нами.`,
    (o) => `⚠️ Payment for “${o.label}” wasn't confirmed: the money didn't arrive or the receipt doesn't match (the amount must be exactly ${o.amount}).\n\nSend the correct receipt here or contact us.`,
  ],
  cancelDone: ["Bekor qilindi.", "Отменено.", "Cancelled."],
  cancelNo: ["Bu buyurtmani endi bekor qilib bo'lmaydi.", "Этот заказ уже нельзя отменить.", "This order can no longer be cancelled."],
  cancelReceipt: ["Chek yuborilgan — to'lov tekshirilmoqda. Savol bo'lsa, biz bilan bog'laning.", "Чек отправлен — оплата проверяется. Если есть вопросы, свяжитесь с нами.", "Receipt sent — the payment is being checked. Contact us if you have questions."],
  notYours: ["Bu buyurtma sizniki emas.", "Это не ваш заказ.", "This isn't your order."],
  paidTag: ["✅ To'langan", "✅ Оплачено", "✅ Paid"],
  // hisoblash boti
  calcWelcome: [
    "Assalomu alaykum! Print 54 botiga xush kelibsiz 👋\n\nIlova orqali xizmatlarimiz narxini hisoblab, buyurtma berishingiz mumkin — pastdagi \"HISOBLASH\" tugmasini bosing.\n\n⚠️ Hozirda bot test rejimida ishlamoqda va yetkazib berish xizmati hozircha mavjud emas — kamchiliklar bo'lsa, uzr so'raymiz.\n\n🎁 Ko'proq buyurtmalar berish orqali tekinga chop etish imkoniyatingizni oshirib borishingiz mumkin! \n\n🎁  Shuningdek, do'stlaringizni taklif qilib ham qo'shimcha bepul varaqlar qo'lga kiritishingiz mumkin — batafsili \"Buyurtmalarim\" bo'limida.\n\n🌐 Til / Язык / Language: /til",
    "Здравствуйте! Добро пожаловать в бот Print 54 👋\n\nВ приложении можно рассчитать стоимость услуг и сделать заказ — нажмите кнопку «HISOBLASH» внизу.\n\n⚠️ Бот работает в тестовом режиме, доставки пока нет — извините за возможные недочёты.\n\n🎁 Чем больше заказов, тем больше бесплатной печати!\n\n🎁 Приглашайте друзей и получайте дополнительные бесплатные листы — подробнее в профиле.\n\n🌐 Til / Язык / Language: /til",
    "Hello! Welcome to the Print 54 bot 👋\n\nIn the app you can calculate prices and place orders — tap the “HISOBLASH” button below.\n\n⚠️ The bot is in test mode and there's no delivery yet — sorry for any glitches.\n\n🎁 The more you order, the more free printing you get!\n\n🎁 Invite friends to earn extra free sheets — details in your profile.\n\n🌐 Til / Язык / Language: /til",
  ],
  printReady: [
    (o) => `🎉 <b>Buyurtmangiz tayyor!</b>\n\n${o.label} — ${o.total}${o.spent ? ` (yana ${o.spent} balansdan to'langan)` : ""}\n\nDo'konimizdan olib ketishingiz mumkin.${o.bonus ? `\n\n🎁 Ushbu buyurtma uchun ${o.bonus} ta bepul list hisobingizga qo'shildi!` : ""}`,
    (o) => `🎉 <b>Ваш заказ готов!</b>\n\n${o.label} — ${o.total}${o.spent ? ` (ещё ${o.spent} оплачено с баланса)` : ""}\n\nЗаберите его в нашем магазине.${o.bonus ? `\n\n🎁 За этот заказ вам начислено бесплатных листов: ${o.bonus}!` : ""}`,
    (o) => `🎉 <b>Your order is ready!</b>\n\n${o.label} — ${o.total}${o.spent ? ` (plus ${o.spent} paid from balance)` : ""}\n\nYou can pick it up at our shop.${o.bonus ? `\n\n🎁 ${o.bonus} free sheets were added for this order!` : ""}`,
  ],
  locBtn: ["📍 Manzilni ko'rish", "📍 Посмотреть адрес", "📍 See location"],
  refJoined: [
    (n, c) => `🎉 ${n} sizning referal havolangiz orqali muvaffaqiyatli qo'shildi!\n\nHozirda sizda ${c} ta referal bor.`,
    (n, c) => `🎉 ${n} присоединился(-ась) по вашей ссылке!\n\nУ вас уже ${c} приглашённых.`,
    (n, c) => `🎉 ${n} joined with your invite link!\n\nYou now have ${c} referrals.`,
  ],
  ref5first: [
    (c, e) => `🎉 Ajoyib! ${c} ta do'stni taklif qildingiz — endi jami ${e} ta list bepul chiqarishingiz mumkin!\n\nBundan keyingi har bir yangi referal uchun +3 tadan qo'shiladi.`,
    (c, e) => `🎉 Отлично! Вы пригласили ${c} друзей — теперь можно бесплатно напечатать ${e} листов!\n\nЗа каждого следующего друга +3 листа.`,
    (c, e) => `🎉 Great! You invited ${c} friends — you can now print ${e} sheets for free!\n\nEach new referral adds +3 more.`,
  ],
  ref5more: [
    (e) => `🎁 Yana bir do'stingiz qo'shildi! Endi jami ${e} ta list bepul chiqarishingiz mumkin.`,
    (e) => `🎁 Присоединился ещё один друг! Теперь бесплатно — ${e} листов.`,
    (e) => `🎁 Another friend joined! You can now print ${e} sheets for free.`,
  ],
  // AI bot referali: do'st qo'shildi (bonusgacha yana left ta) / bonus berildi
  aiRefJoin: [
    (n, c, left) => `🎉 ${n} sizning havolangiz orqali qo'shildi! (jami ${c} ta do'st)\n\nYana ${left} ta do'st — va 1 ta bepul AI buyurtma sizniki 🎁`,
    (n, c, left) => `🎉 ${n} присоединился(-ась) по вашей ссылке! (всего друзей: ${c})\n\nЕщё ${left} — и 1 бесплатный AI-заказ ваш 🎁`,
    (n, c, left) => `🎉 ${n} joined with your link! (${c} friends total)\n\n${left} more and you get 1 free AI order 🎁`,
  ],
  aiRefEarn: [
    (n, c, add, cr, left) => `🎉 ${n} sizning havolangiz orqali qo'shildi! (jami ${c} ta do'st)\n\n🎁 Sizga ${add} ta bepul AI buyurtma berildi! Hozir bonuslar: ${cr} ta — buyurtma berishda «🎁 Bonusdan foydalanish» orqali ishlatasiz.\n\nKeyingi bonus — yana ${left} ta do'st.`,
    (n, c, add, cr, left) => `🎉 ${n} присоединился(-ась) по вашей ссылке! (всего друзей: ${c})\n\n🎁 Вам начислен бесплатный AI-заказ: ${add}. Сейчас бонусов: ${cr} — используйте при заказе через «🎁 Использовать бонус».\n\nСледующий бонус — ещё ${left} друга.`,
    (n, c, add, cr, left) => `🎉 ${n} joined with your link! (${c} friends total)\n\n🎁 You got ${add} free AI order! Bonuses now: ${cr} — use them via “🎁 Use bonus” when ordering.\n\nNext bonus — ${left} more friends.`,
  ],
  ref3: [
    (c, e) => `🎉 Tabriklaymiz! ${c} ta do'stni taklif qildingiz — sizga ${e} ta list bepul chiqarish imkoniyati berildi!\n\nYana ${5 - c} ta referal qo'shsangiz, jami 20 ta bo'ladi.`,
    (c, e) => `🎉 Поздравляем! Вы пригласили ${c} друзей — вам доступно ${e} бесплатных листов!\n\nЕщё ${5 - c} — и будет 20.`,
    (c, e) => `🎉 Congratulations! You invited ${c} friends — you get ${e} free sheets!\n\n${5 - c} more and it becomes 20.`,
  ],
  // bot chatiga yuborilgan rasm: PDF yoki AI javobi
  phAsk: ["📷 Rasm qabul qilindi. Nima qilamiz?", "📷 Фото получено. Что сделать?", "📷 Got your photo. What should I do?"],
  phBtnPdf: ["📄 PDF qilish", "📄 Сделать PDF", "📄 Make a PDF"],
  phBtnAi: ["🤖 AI javobi", "🤖 Ответ AI", "🤖 AI answer"],
  phBtnBack: ["← Orqaga", "← Назад", "← Back"],
  phPdfPick: [
    (n) => `📄 PDF: ${n} ta rasm.\n\n1 ta varaqqa nechta rasm joylansin?\n(Albomdagi barcha rasmlar bitta PDF ga kiradi — 30 tagacha)`,
    (n) => `📄 PDF: фото — ${n}.\n\nСколько фото разместить на одном листе?\n(Все фото из альбома войдут в один PDF — до 30)`,
    (n) => `📄 PDF: ${n} image(s).\n\nHow many images per page?\n(All photos from the album go into one PDF — up to 30)`,
  ],
  phPdfWait: [
    (n) => `⏳ PDF tayyorlanmoqda (${n} ta rasm)… 10–30 soniyada shu yerga keladi.`,
    (n) => `⏳ Готовлю PDF (фото: ${n})… придёт сюда через 10–30 секунд.`,
    (n) => `⏳ Making your PDF (${n} images)… it will arrive here in 10–30 seconds.`,
  ],
  phAiWait: ["🤖 AI rasmni ko'rib chiqyapti…", "🤖 AI изучает фото…", "🤖 AI is looking at the photo…"],
  phNone: ["Rasmlar topilmadi — iltimos, rasmni qaytadan yuboring.", "Фото не найдены — отправьте фото ещё раз.", "No photos found — please send the photo again."],
  phCancel: ["Bekor qilindi.", "Отменено.", "Cancelled."],
  phTopic: ["Rasmlardan PDF (chat)", "Фото в PDF (чат)", "Images to PDF (chat)"],
  phErr: ["Kechirasiz, xatolik yuz berdi. Rasmni qaytadan yuborib ko'ring.", "Извините, произошла ошибка. Отправьте фото ещё раз.", "Sorry, something went wrong. Please send the photo again."],
  // fayl yetkazildi
  delivered: [
    (o) => `🎉 <b>Buyurtmangiz tayyor!</b>\n${o.label}${o.topic}\n\nFaylni istalgan vaqtda "Buyurtmalarim" bo'limidan ham qayta olishingiz mumkin.`,
    (o) => `🎉 <b>Ваш заказ готов!</b>\n${o.label}${o.topic}\n\nФайл всегда можно снова получить в разделе «Мои заказы».`,
    (o) => `🎉 <b>Your order is ready!</b>\n${o.label}${o.topic}\n\nYou can get the file again anytime in “My orders”.`,
  ],
};
// T(l, "kalit", ...argumentlar)
function T(l, key, ...args) {
  const e = M[key];
  if (!e) return key;
  const v = e[I(l)] != null ? e[I(l)] : e[0];
  return typeof v === "function" ? v(...args) : v;
}

module.exports = { LANGS, getLang, setLang, T, tr, sum, esc, label, kbText, kbKind, KB, ASK, I };
