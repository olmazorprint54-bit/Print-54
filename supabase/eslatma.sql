-- UNUTILGAN BUYURTMA ESLATMASI — mijoz xizmatni ko'rib, 15 daqiqada buyurtma bermasa, bot eslatadi.
-- Supabase → SQL Editor → New query → shu kodni joylab "Run" bosing. Bir necha marta ishga tushirsa ham xavfsiz.
--
-- MUHIM: pastdagi ikki joyda  CRON_SECRET_QIYMATI  so'zini Vercel'dagi CRON_SECRET qiymati bilan almashtiring
-- (ikkala loyihada CRON_SECRET bir xil bo'lsin). CRON_SECRET bo'lmasa, Vercel'ga istalgan uzun so'z qilib qo'shing.

create table if not exists service_views (
  user_id bigint not null,
  bot_id text not null,           -- bot tokenining raqam qismi (qaysi bot)
  bot text,
  chat_id bigint not null,
  service text not null,          -- oxirgi ko'rilgan xizmat
  viewed_at timestamptz not null default now(),
  pending boolean not null default true,
  last_reminded timestamptz,      -- kuniga 1 tadan ko'p yubormaslik uchun
  muted text[] not null default '{}', -- "Bekor qilish" bosilgan xizmatlar
  primary key (user_id, bot_id)
);
create index if not exists service_views_pending_idx on service_views (pending, viewed_at);
alter table service_views enable row level security; -- faqat server (service key) o'qiydi

-- Har 5 daqiqada ikkala loyihani chaqiradi
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'eslatma';
select cron.schedule('eslatma', '*/5 * * * *', $$
  select net.http_get(url := 'https://ai-xizmatlari.vercel.app/api/cleanup-uploads?remind=1', headers := '{"Authorization": "Bearer CRON_SECRET_QIYMATI"}'::jsonb);
  select net.http_get(url := 'https://print-54.vercel.app/api/cleanup-uploads?remind=1', headers := '{"Authorization": "Bearer CRON_SECRET_QIYMATI"}'::jsonb);
$$);
