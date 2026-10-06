-- AI buyurtmalar uchun "orders" jadvaliga qo'shimcha ustunlar.
-- Supabase → SQL Editor → New query → shu kodni joylab "Run" bosing.
-- Bir necha marta ishga tushirilsa ham xavfsiz (if not exists).

alter table orders add column if not exists details jsonb;    -- mavzu, tafsilotlar, egaga yuborilgan matn
alter table orders add column if not exists file_id text;     -- tayyor faylning Telegram file_id si
alter table orders add column if not exists file_name text;   -- tayyor fayl nomi

create index if not exists orders_telegram_message_id_idx on orders (telegram_message_id);
