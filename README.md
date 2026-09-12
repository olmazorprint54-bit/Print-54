# 54 Printing — Telegram Mini App (Supabase + Vercel versiyasi)

Bu versiya **hech qanday oldindan to'lovsiz**, ikkalasi ham (Supabase va
Vercel) bepul tarifda ishlaydi.

## 1) Supabase loyihasini yaratish

1. https://supabase.com ga kiring, "Start your project" → GitHub yoki
   email bilan ro'yxatdan o'ting
2. "New project" → nom bering (masalan `54printing`) → parol o'rnating
   (buni eslab qoling) → region tanlang → "Create new project"
3. Loyiha tayyor bo'lgach, chap menyudan **SQL Editor** ni oching

## 2) Jadvallarni yaratish

SQL Editor'da "New query" tugmasini bosing, quyidagi kodni to'liq
nusxalab joylashtiring va **"Run"** tugmasini bosing:

```sql
create table orders (
  id bigint generated always as identity primary key,
  service text,
  color text,
  side text,
  format text,
  qty integer,
  total numeric,
  telegram_user_id bigint,
  telegram_username text,
  telegram_name text,
  created_at timestamptz default now()
);

create table visits (
  id bigint generated always as identity primary key,
  telegram_user_id bigint,
  created_at timestamptz default now()
);

create table users (
  telegram_user_id bigint primary key,
  username text,
  first_name text,
  last_seen timestamptz default now()
);
```

## 3) API kalitlarini olish

Chap menyudan **Project Settings → API** ni oching. Ikkita qiymatni
saqlab qo'ying (keyingi qadamda kerak bo'ladi):

- **Project URL** (masalan `https://xxxxx.supabase.co`)
- **service_role** kaliti (Settings → API → "Project API keys"
  ostida, "reveal" bosib ko'rinadi — bu maxfiy kalit, hech kimga
  bermang)

## 4) Vercel'ga yuklash

1. https://vercel.com ga kiring, GitHub akkountingiz bilan
   ro'yxatdan o'ting (agar GitHub'da akkountingiz yo'q bo'lsa, avval
   github.com'da bepul akkount oching)
2. Bu loyihani (`print-app-vercel` papkasini) GitHub'ga yuklang:
   - github.com'da "New repository" → nom bering → yarating
   - Repository sahifasida "Add file" → "Upload files" → shu papka
     ichidagi barcha fayl va papkalarni tashlang → "Commit changes"
3. Vercel'da **"Add New" → "Project"** → GitHub repositoryingizni
   tanlang → "Import"
4. **Environment Variables** bo'limida quyidagilarni qo'shing (har
   birini alohida "Name" / "Value" qatoriga):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | 3-qadamdagi Project URL |
   | `SUPABASE_SERVICE_KEY` | 3-qadamdagi service_role kaliti |
   | `TELEGRAM_BOT_TOKEN` | BotFather'dan olgan tokeningiz |
   | `OWNER_CHAT_ID` | sizning shaxsiy chat ID'ingiz |

5. **"Deploy"** tugmasini bosing. Bir necha daqiqadan so'ng sizga
   link beriladi (masalan `https://54printing.vercel.app`)

## 5) Botga ulash

1. @BotFather → `/mybots` → botingiz → **Bot Settings → Menu Button
   → Configure Menu Button**
2. Vercel'dan olgan linkingizni kiriting (masalan
   `https://54printing.vercel.app`)

Tayyor — botingizni ochsangiz, "Menu" tugmasi orqali mini app
ochiladi.

## 6) Statistikangizni ko'rish

Supabase Dashboard → **Table Editor**:
- `orders` — barcha buyurtmalar (sana, xizmat turi, summasi va h.k.)
- `visits` — har bir tashrif (qachon, kim)
- `users` — noyob foydalanuvchilar ro'yxati

Kunlik/haftalik/oylik sonlarni ko'rish uchun SQL Editor'da masalan:

```sql
select date(created_at) as kun, count(*) as buyurtmalar_soni
from orders
group by kun
order by kun desc;
```

Bu ma'lumotlar faqat sizning Supabase akkountingiz orqali ko'rinadi.

## Narxlarni keyinchalik o'zgartirish

`public/index.html` faylida `PRICING` obyekti bor. O'zgartirib,
GitHub'ga qayta yuklasangiz (yoki "Commit" qilsangiz), Vercel
avtomatik qayta deploy qiladi.
