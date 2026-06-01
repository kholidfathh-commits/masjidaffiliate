-- ============================================================
-- SETUP DATABASE SUPABASE untuk Al-Kahfi Team App
-- Cara pakai: buka Supabase dashboard -> SQL Editor -> New Query
-- -> paste SEMUA isi file ini -> klik RUN
-- ============================================================

-- 1. Tabel key-value untuk menyimpan semua data aplikasi
create table if not exists kv_store (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- 2. Aktifkan Row Level Security
alter table kv_store enable row level security;

-- 3. Hapus policy lama (kalau ada) supaya tidak dobel saat re-run
drop policy if exists "Allow all access kv_store" on kv_store;

-- 4. Policy: izinkan publishable/anon key untuk semua operasi
--    (cocok untuk tool internal tim; password tetap aman karena ter-hash PBKDF2)
create policy "Allow all access kv_store" on kv_store
  for all
  using (true)
  with check (true);

-- ============================================================
-- Selesai. Tabel kv_store siap dipakai aplikasi.
-- ============================================================
