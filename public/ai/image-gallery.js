/* ================================================================
   AI RASM GALEREYASI — «🎨 Rasm yaratish» bosilganda ochiladigan
   kategoriyalar va tayyor namunalar (prompt shablonlari).
   Matnlar uch tilda: [o'zbek, rus, ingliz]. Prompt (p) — inglizcha,
   mijozga ko'rinmaydi; {input} — mijoz yozgan matn.
   in: "text" — mijoz yozadi, "photo" — rasm yuklaydi,
       "photo_text" — rasm + qo'shimcha matn.
   r — rasm nisbati; tx: true — rasm ichiga yozuv chiziladi ({input}).
   img — namuna rasm (ai/gallery/<kategoriya>/<id>.jpg) — Nano Banana
   bilan chizilgach qo'shiladi; hozircha rangli belgi ko'rsatiladi.
   Yangi namuna qo'shish: shu faylga bitta qator — kod kerak emas.
   ================================================================ */
(function () {
  var TOPIC = ["Mavzu", "Тема", "Topic"];
  var FREE_BG = "linear-gradient(135deg,#a78bfa,#f472b6)";

  window.AI_IMAGE_GALLERY = [
    {
      id: "talim", e: "🎓", t: ["Ta'lim uchun", "Для учёбы", "For education"], bg: "linear-gradient(135deg,#60a5fa,#6366f1)",
      items: [
        { id: "slide", e: "📊", t: ["Slayd illyustratsiyasi", "Иллюстрация для слайда", "Slide illustration"], in: "text", r: "16:9", lb: TOPIC, ph: ["Masalan: Fotosintez", "Например: Фотосинтез", "E.g.: Photosynthesis"],
          p: "Clean, modern educational illustration for a presentation slide about {input}. Clear composition, soft harmonious colors, high detail, no text." },
        { id: "scheme", e: "🧭", t: ["Sxema / infografika", "Схема / инфографика", "Diagram / infographic"], in: "text", r: "4:3", lb: TOPIC, ph: ["Masalan: Suvning aylanishi", "Например: Круговорот воды", "E.g.: The water cycle"],
          p: "Educational infographic diagram that explains {input} step by step, simple flat vector icons and arrows, white background, clean layout." },
        { id: "science", e: "🔬", t: ["Ilmiy rasm", "Научная иллюстрация", "Scientific illustration"], in: "text", r: "1:1", lb: TOPIC, ph: ["Masalan: Hujayra tuzilishi", "Например: Строение клетки", "E.g.: Cell structure"],
          p: "Detailed, accurate scientific textbook illustration of {input}, clean light background, crisp lines." },
        { id: "history", e: "🏛", t: ["Tarixiy sahna", "Историческая сцена", "Historical scene"], in: "text", r: "16:9", lb: TOPIC, ph: ["Masalan: Ulug'bek rasadxonasi", "Например: Обсерватория Улугбека", "E.g.: Ulugh Beg observatory"],
          p: "Cinematic, historically inspired painting of {input}, Central Asian architecture and clothing, warm light, rich detail." },
      ],
    },
    {
      id: "korgazma", e: "🧪", t: ["Ko'rgazmali qurollar", "Наглядные пособия", "Classroom visuals"], bg: "linear-gradient(135deg,#34d399,#059669)",
      items: [
        { id: "poster", e: "🪐", t: ["Sinf plakati", "Плакат для класса", "Classroom poster"], in: "text", r: "3:4", lb: TOPIC, ph: ["Masalan: Quyosh tizimi", "Например: Солнечная система", "E.g.: Solar system"],
          p: "Bright classroom wall poster about {input}, large clear elements, kid friendly, colorful, portrait layout." },
        { id: "times", e: "✖️", t: ["Karra jadvali", "Таблица умножения", "Times table"], in: "text", r: "3:4", lb: ["Qaysi sonlar?", "Какие числа?", "Which numbers?"], ph: ["Masalan: 1 dan 10 gacha", "Например: от 1 до 10", "E.g.: 1 to 10"],
          p: "Colorful multiplication table classroom chart for {input}, very clear large digits, cheerful decorations at the edges." },
        { id: "alphabet", e: "🔤", t: ["Alifbo plakati", "Плакат с алфавитом", "Alphabet poster"], in: "text", r: "3:4", lb: ["Harflar", "Буквы", "Letters"], ph: ["Masalan: O'zbek lotin alifbosi", "Например: узбекская латиница", "E.g.: Uzbek Latin alphabet"],
          p: "Alphabet classroom poster: {input}, each letter large with a cute matching illustration, bright playful colors." },
        { id: "anatomy", e: "🫀", t: ["Inson tanasi", "Тело человека", "Human body"], in: "text", r: "3:4", lb: TOPIC, ph: ["Masalan: Yurak tuzilishi", "Например: Строение сердца", "E.g.: Structure of the heart"],
          p: "Friendly educational anatomy poster of {input}, clearly separated parts with leader lines, textbook style, light background." },
      ],
    },
    {
      id: "tarix", e: "🗺", t: ["Xarita va tarix", "Карты и история", "Maps & history"], bg: "linear-gradient(135deg,#f59e0b,#b45309)",
      items: [
        { id: "portrait", e: "👳", t: ["Tarixiy shaxs portreti", "Портрет исторической личности", "Historical portrait"], in: "text", r: "3:4", lb: ["Shaxs", "Личность", "Person"], ph: ["Masalan: Alisher Navoiy", "Например: Алишер Навои", "E.g.: Alisher Navoi"],
          p: "Dignified classical oil painting portrait of {input}, period-accurate clothing, museum quality, soft dramatic light." },
        { id: "city", e: "🕌", t: ["Qadimiy shahar", "Древний город", "Ancient city"], in: "text", r: "16:9", lb: ["Shahar", "Город", "City"], ph: ["Masalan: Qadimiy Buxoro", "Например: Древняя Бухара", "E.g.: Ancient Bukhara"],
          p: "Panoramic illustration of {input} in ancient times, bustling bazaar streets, domes and minarets, warm golden light, highly detailed." },
        { id: "map", e: "🗺", t: ["Tarixiy xarita", "Историческая карта", "Historical map"], in: "text", r: "4:3", lb: TOPIC, ph: ["Masalan: Buyuk Ipak yo'li", "Например: Великий шёлковый путь", "E.g.: The Great Silk Road"],
          p: "Vintage illustrated map of {input}, parchment texture, decorative compass rose, small drawings of cities and caravans." },
        { id: "event", e: "⚔️", t: ["Tarixiy voqea", "Историческое событие", "Historical event"], in: "text", r: "16:9", lb: ["Voqea", "Событие", "Event"], ph: ["Masalan: Ipak yo'li karvoni", "Например: караван Шёлкового пути", "E.g.: A Silk Road caravan"],
          p: "Epic painterly illustration depicting {input}, dramatic lighting, rich historical detail." },
      ],
    },
    {
      id: "ertak", e: "📖", t: ["Kitob va ertak", "Книги и сказки", "Books & fairy tales"], bg: "linear-gradient(135deg,#fb7185,#a855f7)",
      items: [
        { id: "cover", e: "📕", t: ["Ertak muqovasi", "Обложка сказки", "Storybook cover"], in: "text", r: "2:3", tx: true, lb: ["Ertak nomi", "Название сказки", "Story title"], ph: ["Masalan: Zumrad va Qimmat", "Например: Зумрад и Киммат", "E.g.: Zumrad and Qimmat"],
          p: "Whimsical children's storybook cover illustration, magical warm atmosphere, with the title text \"{input}\" written clearly at the top." },
        { id: "hero", e: "🐰", t: ["Ertak qahramoni", "Сказочный герой", "Story character"], in: "text", r: "1:1", lb: ["Qahramon", "Герой", "Character"], ph: ["Masalan: Aqlli quyoncha", "Например: Умный зайчик", "E.g.: A clever bunny"],
          p: "Cute storybook character design of {input}, full body, soft watercolor style, plain white background." },
        { id: "scene", e: "🌳", t: ["Ertak sahnasi", "Сцена из сказки", "Story scene"], in: "text", r: "16:9", lb: ["Sahna", "Сцена", "Scene"], ph: ["Masalan: Sehrli o'rmonda quyoncha", "Например: Зайчик в волшебном лесу", "E.g.: A bunny in a magic forest"],
          p: "Storybook illustration of {input}, soft watercolor textures, gentle colors, cozy and magical." },
        { id: "page", e: "📄", t: ["Kitob sahifasi", "Страница книги", "Book page"], in: "text", r: "3:4", lb: ["Sahifada nima?", "Что на странице?", "What's on the page?"], ph: ["Masalan: Ota va o'g'il bog'da", "Например: Папа с сыном в саду", "E.g.: Father and son in a garden"],
          p: "Children's picture book page illustration of {input}, cozy, warm palette, leave calm empty space at the bottom for text." },
      ],
    },
    {
      id: "bolalar", e: "🧸", t: ["Bolalar uchun", "Для детей", "For kids"], bg: "linear-gradient(135deg,#fde047,#fb923c)",
      items: [
        { id: "coloring", e: "🖍", t: ["Bo'yash daftari", "Раскраска", "Coloring page"], in: "text", r: "3:4", lb: ["Nima chizilsin?", "Что нарисовать?", "What to draw?"], ph: ["Masalan: Fil va maymun", "Например: Слон и обезьяна", "E.g.: An elephant and a monkey"],
          p: "Black and white coloring page for young kids of {input}, thick clean outlines, no shading, no gray, plain white background, A4 portrait." },
        { id: "letter", e: "🅰️", t: ["Harf kartochkasi", "Карточка с буквой", "Letter flashcard"], in: "text", r: "3:4", tx: true, lb: ["Harf va so'z", "Буква и слово", "Letter and word"], ph: ["Masalan: A — Anor", "Например: А — Арбуз", "E.g.: A — Apple"],
          p: "Kids alphabet flashcard showing \"{input}\": a big letter and a cute illustration of the word, bright simple colors, white background." },
        { id: "animals", e: "🦁", t: ["Hayvonlar", "Животные", "Animals"], in: "text", r: "1:1", lb: ["Hayvonlar", "Животные", "Animals"], ph: ["Masalan: Bo'ri, tulki, quyon", "Например: волк, лиса, заяц", "E.g.: wolf, fox, rabbit"],
          p: "Cute cartoon illustration of {input} for kindergarten, round friendly shapes, bright cheerful colors." },
        { id: "counting", e: "🍎", t: ["Sanash kartochkasi", "Карточка для счёта", "Counting card"], in: "text", r: "1:1", lb: ["Nima va nechta?", "Что и сколько?", "What and how many?"], ph: ["Masalan: 5 ta olma", "Например: 5 яблок", "E.g.: 5 apples"],
          p: "Kindergarten counting card clearly showing {input}, evenly spaced cute objects, white background." },
      ],
    },
    {
      id: "photo", e: "📸", t: ["Rasmimni o'zgartirish", "Изменить моё фото", "Transform my photo"], bg: "linear-gradient(135deg,#38bdf8,#818cf8)",
      items: [
        { id: "cartoon", e: "🧑‍🎤", t: ["3D multfilm qahramoni", "3D мультперсонаж", "3D cartoon character"], in: "photo", r: "1:1",
          p: "Turn the person in this photo into a 3D animated movie character, soft lighting, keep their facial features and hairstyle recognizable." },
        { id: "anime", e: "🌸", t: ["Anime uslubi", "Стиль аниме", "Anime style"], in: "photo", r: "1:1",
          p: "Redraw this photo in high quality anime style, clean line art, keep the person's features and clothing." },
        { id: "studio", e: "💡", t: ["Studiya portreti", "Студийный портрет", "Studio portrait"], in: "photo", r: "4:5",
          p: "Turn this photo into a professional studio portrait, soft key light, clean neutral background. Keep the face exactly identical." },
        { id: "painting", e: "🖼", t: ["Moybo'yoq rasm", "Портрет маслом", "Oil painting"], in: "photo", r: "4:5",
          p: "Turn this photo into a classical oil painting portrait with visible brush strokes. Keep the face recognizable." },
        { id: "background", e: "🏞", t: ["Fonni almashtirish", "Заменить фон", "Change background"], in: "photo_text", r: "4:5", lb: ["Yangi fon", "Новый фон", "New background"], ph: ["Masalan: Samarqand, Registon", "Например: Самарканд, Регистан", "E.g.: Samarkand, Registan"],
          p: "Keep the person exactly the same and replace the background with {input}. Match the lighting and perspective realistically." },
      ],
    },
    {
      id: "trend", e: "🔥", t: ["Trenddagi", "В тренде", "Trending"], bg: "linear-gradient(135deg,#f43f5e,#f97316)",
      items: [
        { id: "figure", e: "🧸", t: ["Kolleksion figurka", "Коллекционная фигурка", "Collectible figure"], in: "photo", r: "4:5",
          p: "Turn the person in this photo into a realistic collectible figure standing next to its toy box packaging on a desk, studio lighting, keep the face recognizable." },
        { id: "polaroid", e: "📷", t: ["Polaroid foto", "Полароид", "Polaroid photo"], in: "photo", r: "4:5",
          p: "Make a polaroid style photo of this person, retro film grain, warm faded tones, white polaroid frame." },
        { id: "mini", e: "🏙", t: ["Mini-dunyo", "Мини-мир", "Miniature world"], in: "text", r: "1:1", lb: ["Joy", "Место", "Place"], ph: ["Masalan: Samarqand", "Например: Самарканд", "E.g.: Samarkand"],
          p: "Tiny isometric miniature diorama of {input}, tilt-shift effect, adorable tiny details, soft studio light." },
        { id: "animefilm", e: "🎞", t: ["Anime film sahnasi", "Кадр из аниме", "Anime film scene"], in: "photo", r: "16:9",
          p: "Redraw this photo as a hand-painted anime film scene, soft pastel colors, dreamy light, keep the composition." },
      ],
    },
    {
      id: "tabrik", e: "🎉", t: ["Tabriknoma va afisha", "Открытки и афиши", "Cards & posters"], bg: "linear-gradient(135deg,#f472b6,#ec4899)",
      items: [
        { id: "birthday", e: "🎂", t: ["Tug'ilgan kun", "День рождения", "Birthday"], in: "text", r: "3:2", tx: true, lb: ["Tabrik matni", "Текст поздравления", "Greeting text"], ph: ["Masalan: Dilnoza, tug'ilgan kuning muborak!", "Например: С днём рождения, Дилноза!", "E.g.: Happy birthday, Dilnoza!"],
          p: "Festive birthday greeting card with balloons, cake and confetti, with the text \"{input}\" in beautiful lettering." },
        { id: "teacher", e: "💐", t: ["Ustozlar kuni", "День учителя", "Teachers' Day"], in: "text", r: "3:2", tx: true, lb: ["Tabrik matni", "Текст поздравления", "Greeting text"], ph: ["Masalan: Aziz ustozim, bayramingiz muborak!", "Например: С праздником, дорогой учитель!", "E.g.: Happy Teachers' Day!"],
          p: "Elegant Teachers' Day greeting card with flowers and books, with the text \"{input}\" in graceful lettering." },
        { id: "event", e: "📰", t: ["Tadbir afishasi", "Афиша мероприятия", "Event poster"], in: "text", r: "3:4", tx: true, lb: ["Tadbir nomi va sanasi", "Название и дата", "Event and date"], ph: ["Masalan: Kitobxonlik tanlovi, 15-oktabr", "Например: Конкурс чтецов, 15 октября", "E.g.: Reading contest, Oct 15"],
          p: "Bold modern event poster with the text \"{input}\" as the headline, eye-catching illustration, clean layout." },
        { id: "graduation", e: "🎓", t: ["Bitiruv kechasi", "Выпускной", "Graduation"], in: "text", r: "3:4", tx: true, lb: ["Matn", "Текст", "Text"], ph: ["Masalan: 11-sinf bitiruv kechasi 2027", "Например: Выпускной 11 класса 2027", "E.g.: Class of 2027 graduation"],
          p: "Elegant graduation party poster with caps, stars and gold accents, with the text \"{input}\"." },
      ],
    },
    {
      id: "bayram", e: "🎊", t: ["Bayramlar", "Праздники", "Holidays"], bg: "linear-gradient(135deg,#22c55e,#eab308)",
      items: [
        { id: "navruz", e: "🌷", t: ["Navro'z", "Навруз", "Navruz"], in: "text", r: "1:1", tx: true, lb: ["Tabrik matni", "Текст поздравления", "Greeting text"], ph: ["Masalan: Navro'z muborak!", "Например: С праздником Навруз!", "E.g.: Happy Navruz!"],
          p: "Festive Navruz spring greeting image with sumalak, tulips and blossoming trees, Uzbek ornaments, with the text \"{input}\"." },
        { id: "ramazon", e: "🌙", t: ["Ramazon hayiti", "Рамазан хайит", "Eid al-Fitr"], in: "text", r: "1:1", tx: true, lb: ["Tabrik matni", "Текст поздравления", "Greeting text"], ph: ["Masalan: Ramazon hayitingiz muborak!", "Например: С праздником Рамазан хайит!", "E.g.: Eid Mubarak!"],
          p: "Elegant Eid al-Fitr greeting image with a crescent moon, lanterns and soft gold light, with the text \"{input}\"." },
        { id: "qurbon", e: "🕌", t: ["Qurbon hayiti", "Курбан хайит", "Eid al-Adha"], in: "text", r: "1:1", tx: true, lb: ["Tabrik matni", "Текст поздравления", "Greeting text"], ph: ["Masalan: Qurbon hayitingiz muborak!", "Например: С праздником Курбан хайит!", "E.g.: Happy Eid al-Adha!"],
          p: "Elegant Eid al-Adha greeting image with a mosque silhouette and warm golden light, with the text \"{input}\"." },
        { id: "mustaqillik", e: "🇺🇿", t: ["Mustaqillik kuni", "День независимости", "Independence Day"], in: "text", r: "1:1", tx: true, lb: ["Tabrik matni", "Текст поздравления", "Greeting text"], ph: ["Masalan: Mustaqillik kuni muborak!", "Например: С Днём независимости!", "E.g.: Happy Independence Day!"],
          p: "Festive Uzbekistan Independence Day greeting image in blue, white and green colors with fireworks, with the text \"{input}\"." },
        { id: "newyear", e: "🎄", t: ["Yangi yil", "Новый год", "New Year"], in: "text", r: "1:1", tx: true, lb: ["Tabrik matni", "Текст поздравления", "Greeting text"], ph: ["Masalan: Yangi yil muborak!", "Например: С Новым годом!", "E.g.: Happy New Year!"],
          p: "Cozy New Year greeting image with a decorated tree, snow and warm lights, with the text \"{input}\"." },
        { id: "march8", e: "🌹", t: ["8-mart", "8 Марта", "March 8"], in: "text", r: "1:1", tx: true, lb: ["Tabrik matni", "Текст поздравления", "Greeting text"], ph: ["Masalan: 8-mart bayramingiz muborak!", "Например: С 8 Марта!", "E.g.: Happy Women's Day!"],
          p: "Elegant International Women's Day greeting image with tulips and soft pink tones, with the text \"{input}\"." },
      ],
    },
    {
      id: "toy", e: "💒", t: ["To'y va taklifnomalar", "Свадьбы и приглашения", "Weddings & invitations"], bg: "linear-gradient(135deg,#fcd34d,#d97706)",
      items: [
        { id: "wedding", e: "💍", t: ["To'y taklifnomasi", "Свадебное приглашение", "Wedding invitation"], in: "text", r: "3:4", tx: true, lb: ["Ismlar, sana, joy", "Имена, дата, место", "Names, date, place"], ph: ["Masalan: Aziz va Madina, 20-noyabr, «Navro'z» to'yxonasi", "Например: Азиз и Мадина, 20 ноября", "E.g.: Aziz & Madina, Nov 20"],
          p: "Elegant Uzbek wedding invitation card, ornamental gold patterns on cream paper, with the text \"{input}\" in refined lettering." },
        { id: "sunnat", e: "🎈", t: ["Sunnat to'yi", "Суннат-той", "Sunnat celebration"], in: "text", r: "3:4", tx: true, lb: ["Ism, sana, joy", "Имя, дата, место", "Name, date, place"], ph: ["Masalan: Abdulloh, 5-dekabr", "Например: Абдулла, 5 декабря", "E.g.: Abdulloh, Dec 5"],
          p: "Festive invitation card for a boy's sunnat celebration, Uzbek ornaments, bright joyful colors, with the text \"{input}\"." },
        { id: "beshik", e: "👶", t: ["Beshik to'yi", "Бешик-той", "Beshik celebration"], in: "text", r: "3:4", tx: true, lb: ["Ism, sana, joy", "Имя, дата, место", "Name, date, place"], ph: ["Masalan: Oysha, 12-yanvar", "Например: Ойша, 12 января", "E.g.: Oysha, Jan 12"],
          p: "Gentle invitation card for a baby's beshik celebration, soft pastel colors, traditional cradle motif, with the text \"{input}\"." },
        { id: "jubilee", e: "🥂", t: ["Yubiley", "Юбилей", "Anniversary"], in: "text", r: "3:4", tx: true, lb: ["Kim, nechchi yosh, sana", "Кто, сколько лет, дата", "Who, age, date"], ph: ["Masalan: Otamizning 60 yoshi, 3-mart", "Например: 60-летие папы, 3 марта", "E.g.: Dad's 60th, Mar 3"],
          p: "Elegant anniversary celebration invitation, gold and deep green palette, with the text \"{input}\"." },
      ],
    },
    {
      id: "futbolka", e: "👕", t: ["Futbolka va krujka", "Футболки и кружки", "T-shirts & mugs"], bg: "linear-gradient(135deg,#0ea5e9,#2563eb)",
      items: [
        { id: "name", e: "✍️", t: ["Ismli dizayn", "Дизайн с именем", "Name design"], in: "text", r: "1:1", tx: true, lb: ["Ism", "Имя", "Name"], ph: ["Masalan: Aziz", "Например: Азиз", "E.g.: Aziz"],
          p: "Stylish t-shirt print design featuring the name \"{input}\" in bold creative typography with decorative elements, plain white background." },
        { id: "sport", e: "⚽", t: ["Sport dizayni", "Спортивный дизайн", "Sport design"], in: "text", r: "1:1", lb: ["Sport turi, raqam", "Вид спорта, номер", "Sport, number"], ph: ["Masalan: Futbol, 10-raqam", "Например: Футбол, номер 10", "E.g.: Football, number 10"],
          p: "Dynamic sports t-shirt print design for {input}, energetic shapes, bold colors, plain white background." },
        { id: "mug", e: "☕", t: ["Krujka uchun", "Для кружки", "Mug design"], in: "text", r: "16:9", tx: true, lb: ["Yozuv", "Надпись", "Text"], ph: ["Masalan: Dunyodagi eng yaxshi ota", "Например: Лучший папа в мире", "E.g.: World's best dad"],
          p: "Wide mug wrap print design with the text \"{input}\" and cute matching illustrations, plain white background." },
        { id: "character", e: "🦸", t: ["Sevimli qahramon", "Любимый персонаж", "Favorite character"], in: "text", r: "1:1", lb: ["Qahramon", "Персонаж", "Character"], ph: ["Masalan: Futbol o'ynayotgan quyoncha", "Например: Зайчик-футболист", "E.g.: A bunny playing football"],
          p: "Cute sticker-style character illustration for a t-shirt print: {input}, thick outline, plain white background." },
      ],
    },
    {
      id: "sertifikat", e: "🏆", t: ["Sertifikat va diplom", "Сертификаты и дипломы", "Certificates"], bg: "linear-gradient(135deg,#eab308,#a16207)",
      items: [
        { id: "olympiad", e: "🥇", t: ["Olimpiada g'olibi", "Победитель олимпиады", "Olympiad winner"], in: "text", r: "4:3", tx: true, lb: ["Kimga va nima uchun", "Кому и за что", "To whom and for what"], ph: ["Masalan: Aliyev Ali — matematika olimpiadasi, 1-o'rin", "Например: Алиев Али — олимпиада по математике, 1 место", "E.g.: Ali Aliyev — math olympiad, 1st place"],
          p: "Elegant award diploma design with gold seal and ornamental border, landscape, with the text \"{input}\"." },
        { id: "best", e: "⭐", t: ["Eng yaxshi o'quvchi", "Лучший ученик", "Best student"], in: "text", r: "4:3", tx: true, lb: ["Ism va sinf", "Имя и класс", "Name and class"], ph: ["Masalan: Karimova Madina, 5-A sinf", "Например: Каримова Мадина, 5-А", "E.g.: Madina Karimova, 5A"],
          p: "Cheerful school certificate for the best student, stars and colorful border, landscape, with the text \"{input}\"." },
        { id: "course", e: "📜", t: ["Kurs sertifikati", "Сертификат курса", "Course certificate"], in: "text", r: "4:3", tx: true, lb: ["Kurs va ism", "Курс и имя", "Course and name"], ph: ["Masalan: Ingliz tili kursi — Rahimov Bek", "Например: Курс английского — Рахимов Бек", "E.g.: English course — Bek Rahimov"],
          p: "Modern professional course completion certificate, minimal design with navy and gold accents, landscape, with the text \"{input}\"." },
        { id: "thanks", e: "🙏", t: ["Tashakkurnoma", "Благодарность", "Letter of thanks"], in: "text", r: "4:3", tx: true, lb: ["Kimga va nima uchun", "Кому и за что", "To whom and for what"], ph: ["Masalan: Ota-onalar qo'mitasiga yordami uchun", "Например: Родительскому комитету за помощь", "E.g.: To the parents' committee for their help"],
          p: "Elegant letter of thanks design with floral ornament border, landscape, with the text \"{input}\"." },
      ],
    },
    {
      id: "kalendar", e: "📅", t: ["Kalendar va planner", "Календари и планеры", "Calendars & planners"], bg: "linear-gradient(135deg,#14b8a6,#0e7490)",
      items: [
        { id: "calendar", e: "🗓", t: ["Devoriy kalendar", "Настенный календарь", "Wall calendar"], in: "text", r: "3:4", lb: ["Mavzu va yil", "Тема и год", "Theme and year"], ph: ["Masalan: 2027, tabiat manzaralari", "Например: 2027, природа", "E.g.: 2027, nature"],
          p: "Beautiful wall calendar page design, theme: {input}, large illustration on top and a clean month grid below." },
        { id: "weekly", e: "📝", t: ["Haftalik reja", "Недельный планер", "Weekly planner"], in: "text", r: "3:4", lb: ["Kim uchun, uslub", "Для кого, стиль", "For whom, style"], ph: ["Masalan: Talaba uchun, minimal", "Например: для студента, минимализм", "E.g.: for a student, minimal"],
          p: "Printable weekly planner page, {input}, clean grid with days of the week, soft decorative accents." },
        { id: "schedule", e: "🏫", t: ["Dars jadvali", "Расписание уроков", "Class schedule"], in: "text", r: "4:3", lb: ["Sinf, uslub", "Класс, стиль", "Class, style"], ph: ["Masalan: 5-sinf, quvnoq", "Например: 5 класс, весёлое", "E.g.: 5th grade, playful"],
          p: "Printable school timetable template, {input}, empty table for days and lessons, cute school-themed decorations." },
        { id: "habit", e: "✅", t: ["Odat kuzatuvchisi", "Трекер привычек", "Habit tracker"], in: "text", r: "3:4", lb: ["Uslub", "Стиль", "Style"], ph: ["Masalan: Pastel ranglar", "Например: пастельные цвета", "E.g.: pastel colors"],
          p: "Printable monthly habit tracker page, {input}, tidy grid with 31 days, small decorative icons." },
      ],
    },
    {
      id: "stiker", e: "🏷", t: ["Stiker va yorliqlar", "Стикеры и наклейки", "Stickers & labels"], bg: "linear-gradient(135deg,#c084fc,#7c3aed)",
      items: [
        { id: "notebook", e: "📒", t: ["Daftar yorlig'i", "Наклейка на тетрадь", "Notebook label"], in: "text", r: "3:2", tx: true, lb: ["Ism, sinf, fan", "Имя, класс, предмет", "Name, class, subject"], ph: ["Masalan: Aziz Karimov, 3-B, Matematika", "Например: Азиз Каримов, 3-Б, Математика", "E.g.: Aziz Karimov, 3B, Math"],
          p: "Cute notebook name label design with lines for text, school doodles around the edges, with the text \"{input}\"." },
        { id: "names", e: "🔖", t: ["Ismli stikerlar", "Именные стикеры", "Name stickers"], in: "text", r: "1:1", tx: true, lb: ["Ism", "Имя", "Name"], ph: ["Masalan: Madina", "Например: Мадина", "E.g.: Madina"],
          p: "Sheet of cute round name stickers with the name \"{input}\" and small icons, die-cut white borders." },
        { id: "pack", e: "🐱", t: ["Stikerlar to'plami", "Набор стикеров", "Sticker pack"], in: "text", r: "1:1", lb: TOPIC, ph: ["Masalan: Mushukchalar", "Например: котики", "E.g.: kittens"],
          p: "Sticker sheet with 9 cute {input} stickers in different poses, white die-cut borders, plain background." },
        { id: "school", e: "🎒", t: ["Maktab buyumlariga", "Для школьных вещей", "School supplies"], in: "text", r: "1:1", lb: TOPIC, ph: ["Masalan: Kosmos", "Например: космос", "E.g.: space"],
          p: "Set of small labels for school supplies with a {input} theme, playful design, blank space for writing." },
      ],
    },
    {
      id: "mahsulot", e: "🛍", t: ["Mahsulot va reklama", "Товары и реклама", "Products & ads"], bg: "linear-gradient(135deg,#f97316,#dc2626)",
      items: [
        { id: "studio", e: "📦", t: ["Studiya fotosi", "Студийное фото", "Studio shot"], in: "photo", r: "1:1",
          p: "Turn this product photo into a professional e-commerce studio shot: clean white background, soft shadows, sharp details. Keep the product exactly the same." },
        { id: "lifestyle", e: "🛋", t: ["Hayotiy sahna", "Сцена в интерьере", "Lifestyle scene"], in: "photo_text", r: "4:5", lb: ["Qayerda?", "Где?", "Where?"], ph: ["Masalan: Oshxona stoli, ertalabki yorug'lik", "Например: кухонный стол, утренний свет", "E.g.: kitchen table, morning light"],
          p: "Place this exact product in a realistic lifestyle scene: {input}. Natural light, professional advertising photo." },
        { id: "sale", e: "🏷", t: ["Chegirma e'loni", "Объявление о скидке", "Sale announcement"], in: "text", r: "1:1", tx: true, lb: ["Matn", "Текст", "Text"], ph: ["Masalan: Barcha kiyimlarga 30% chegirma!", "Например: Скидка 30% на всю одежду!", "E.g.: 30% off all clothes!"],
          p: "Eye-catching sale social media post with bold typography \"{input}\", vibrant colors, modern layout." },
        { id: "menu", e: "🍔", t: ["Kafe menyusi", "Меню кафе", "Cafe menu"], in: "text", r: "3:4", tx: true, lb: ["Taomlar va narxlar", "Блюда и цены", "Dishes and prices"], ph: ["Masalan: Lavash 25 000, Burger 30 000, Choy 5 000", "Например: Лаваш 25 000, Бургер 30 000", "E.g.: Lavash 25,000, Burger 30,000"],
          p: "Appetizing cafe menu board design listing: {input}. Food illustrations, clear readable layout." },
      ],
    },
    {
      id: "logo", e: "🧩", t: ["Logotip va vizitka", "Логотипы и визитки", "Logos & business cards"], bg: "linear-gradient(135deg,#64748b,#0f172a)",
      items: [
        { id: "logo", e: "🔷", t: ["Logotip eskizi", "Эскиз логотипа", "Logo sketch"], in: "text", r: "1:1", tx: true, lb: ["Nomi va sohasi", "Название и сфера", "Name and field"], ph: ["Masalan: «Shirin» qandolatxona", "Например: кондитерская «Ширин»", "E.g.: \"Shirin\" bakery"],
          p: "Simple modern logo concept for {input}, flat vector, clean icon with the brand name, plain white background." },
        { id: "card", e: "💳", t: ["Vizitka foni", "Фон для визитки", "Business card background"], in: "text", r: "3:2", lb: ["Soha va uslub", "Сфера и стиль", "Field and style"], ph: ["Masalan: Yuridik xizmatlar, jiddiy", "Например: юр. услуги, строгий", "E.g.: law firm, serious"],
          p: "Elegant business card background design for {input}, subtle shapes, empty space for text, no text." },
        { id: "banner", e: "📣", t: ["Ijtimoiy tarmoq banneri", "Баннер для соцсетей", "Social media banner"], in: "text", r: "16:9", tx: true, lb: ["Biznes nomi va shiori", "Название и слоган", "Name and slogan"], ph: ["Masalan: Print 54 — tez va sifatli chop etish", "Например: Print 54 — быстрая печать", "E.g.: Print 54 — fast printing"],
          p: "Professional social media cover banner with the text \"{input}\", modern clean design, related illustration." },
      ],
    },
    {
      id: "avatar", e: "👤", t: ["Avatar va profil", "Аватары", "Avatars"], bg: "linear-gradient(135deg,#06b6d4,#8b5cf6)",
      items: [
        { id: "avatar3d", e: "🧑", t: ["3D avatar", "3D аватар", "3D avatar"], in: "photo", r: "1:1",
          p: "Create a friendly 3D avatar from this photo for a social media profile, colorful gradient background, keep the person recognizable." },
        { id: "minimal", e: "⚪", t: ["Minimal avatar", "Минималистичный аватар", "Minimal avatar"], in: "photo", r: "1:1",
          p: "Create a minimalist flat illustration avatar from this photo, solid pastel background, keep the person recognizable." },
        { id: "neon", e: "🌃", t: ["Neon avatar", "Неоновый аватар", "Neon avatar"], in: "photo", r: "1:1",
          p: "Create a stylish neon cyberpunk avatar from this photo, glowing rim light, dark background, keep the face recognizable." },
        { id: "business", e: "👔", t: ["Biznes portret", "Деловой портрет", "Business headshot"], in: "photo", r: "1:1",
          p: "Create a professional business headshot from this photo, business attire, softly blurred office background. Keep the face exactly identical." },
      ],
    },
    {
      id: "hujjat", e: "💼", t: ["Hujjat uchun rasm", "Фото на документы", "Document photos"], bg: "linear-gradient(135deg,#94a3b8,#475569)",
      items: [
        { id: "id34", e: "🪪", t: ["3×4 rasm (oq fon)", "Фото 3×4 (белый фон)", "3×4 photo (white)"], in: "photo", r: "3:4",
          p: "Turn this into a neat document-style portrait: plain white background, front facing, even lighting. Keep the face exactly identical, do not beautify." },
        { id: "formal", e: "🤵", t: ["Rasmiy kiyimda", "В деловой одежде", "In formal wear"], in: "photo", r: "3:4",
          p: "Document-style portrait with the person wearing a dark business suit and white shirt, plain white background. Keep the face exactly identical." },
        { id: "resume", e: "📄", t: ["Resume uchun", "Для резюме", "For a résumé"], in: "photo", r: "1:1",
          p: "Professional résumé photo, light gray background, soft flattering light, neat appearance. Keep the face exactly identical." },
      ],
    },
    {
      id: "oila", e: "👨‍👩‍👧", t: ["Oilaviy", "Семейные", "Family"], bg: "linear-gradient(135deg,#fb923c,#e11d48)",
      items: [
        { id: "restore", e: "🩹", t: ["Eski rasmni tiklash", "Реставрация фото", "Restore old photo"], in: "photo", r: "4:5",
          p: "Restore this old damaged photo: remove scratches, stains and noise, gently sharpen. Keep everything authentic, do not change faces." },
        { id: "colorize", e: "🎨", t: ["Rangga kiritish", "Раскрасить фото", "Colorize photo"], in: "photo", r: "4:5",
          p: "Colorize this black and white photo realistically with natural skin tones and period-appropriate colors. Keep all details." },
        { id: "portrait", e: "🖼", t: ["Oilaviy portret", "Семейный портрет", "Family portrait"], in: "photo", r: "4:5",
          p: "Turn this family photo into a warm painted family portrait. Keep everyone's faces recognizable." },
        { id: "kids", e: "🧚", t: ["Bola ertak qahramoni", "Ребёнок — сказочный герой", "Child as a fairy-tale hero"], in: "photo", r: "1:1",
          p: "Turn the child in this photo into a cute fairy-tale character illustration, keep the face recognizable, magical soft colors." },
      ],
    },
    {
      id: "erkin", e: "✏️", t: ["Erkin", "Свободно", "Free-form"], bg: FREE_BG, free: true, items: [],
    },
  ];
})();
