-- ============================================================
-- SETUP MODUL BACAAN TERPROTEKSI — Al-Kahfi Team App
-- Cara pakai: Supabase dashboard -> project 'kahfiteam' -> SQL Editor
-- -> New Query -> paste SEMUA isi file ini -> RUN.
-- Aman dijalankan berkali-kali (idempoten).
-- ============================================================
-- Yang dibuat file ini:
--   1. Bucket PRIVAT 'lms-files' untuk berkas PDF materi kursus & modul bacaan.
--   2. Tabel 'log_akses_modul' untuk mencatat siapa membuka modul apa dan kapan.
--
-- ⚠️  PENTING — kenapa BUKAN bucket 'photos' yang dijadikan privat:
--     bucket 'photos' menyimpan SELURUH foto app (avatar, bukti GMV, lampiran
--     laporan, bukti keuangan, selfie absen) dan record-nya menyimpan URL PUBLIK.
--     Mematikan public access di sana akan membuat semua foto itu gagal tampil
--     seketika. Karena itu berkas LMS dipindah ke bucket privat SENDIRI.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bucket privat khusus berkas LMS
-- ------------------------------------------------------------
-- public = false → URL objeknya TIDAK bisa dibuka langsung dari browser.
-- Satu-satunya cara membaca adalah lewat signed URL berumur pendek yang
-- dibuatkan aplikasi setelah user login.
insert into storage.buckets (id, name, public)
values ('lms-files', 'lms-files', false)
on conflict (id) do update set public = false;

-- Policy pada storage.objects KHUSUS bucket 'lms-files'.
-- Bucket lain (termasuk 'photos') sama sekali tidak terpengaruh.
drop policy if exists "lms files read"   on storage.objects;
create policy "lms files read" on storage.objects
  for select using (bucket_id = 'lms-files');

drop policy if exists "lms files insert" on storage.objects;
create policy "lms files insert" on storage.objects
  for insert with check (bucket_id = 'lms-files');

drop policy if exists "lms files update" on storage.objects;
create policy "lms files update" on storage.objects
  for update using (bucket_id = 'lms-files') with check (bucket_id = 'lms-files');

drop policy if exists "lms files delete" on storage.objects;
create policy "lms files delete" on storage.objects
  for delete using (bucket_id = 'lms-files');

-- ------------------------------------------------------------
-- 2. Jejak akses modul
-- ------------------------------------------------------------
-- SENGAJA tabel sendiri, bukan baris di kv_store: log ini bertambah terus
-- setiap kali modul dibuka. Kalau ditaruh di kv_store dia akan ikut tertarik
-- setiap backup dan menggemukkan snapshot harian, padahal isinya bukan data
-- yang tak tergantikan — ini catatan audit, bukan progres belajar.
create table if not exists public.log_akses_modul (
  id         bigserial primary key,
  modul_id   text        not null,
  user_id    text        not null,
  user_nama  text,
  jenis      text        not null default 'modul-bacaan',  -- 'modul-bacaan' | 'materi-kursus'
  waktu_buka timestamptz not null default now()
);

create index if not exists idx_log_akses_modul_waktu on public.log_akses_modul (waktu_buka desc);
create index if not exists idx_log_akses_modul_modul on public.log_akses_modul (modul_id, waktu_buka desc);
create index if not exists idx_log_akses_modul_user  on public.log_akses_modul (user_id, waktu_buka desc);

alter table public.log_akses_modul enable row level security;

-- Sama permisifnya dengan kv_store (app ini tidak punya backend & memakai
-- publishable key). Ini pagar produk, bukan pagar kriptografis — lihat
-- PANDUAN-LMS.md bagian 14.
drop policy if exists "log akses modul insert" on public.log_akses_modul;
create policy "log akses modul insert" on public.log_akses_modul
  for insert with check (true);

drop policy if exists "log akses modul read" on public.log_akses_modul;
create policy "log akses modul read" on public.log_akses_modul
  for select using (true);

-- ============================================================
-- Selesai.
-- Cek: menu Storage harus muncul bucket "lms-files" berstatus Private,
-- dan menu Table Editor harus muncul tabel "log_akses_modul".
--
-- Berkas PDF yang diunggah SEBELUM setup ini masih ada di bucket 'photos'
-- (publik). Aplikasi tetap bisa membacanya, tapi berkas itu belum terlindungi —
-- unggah ulang lewat form modul/materi supaya pindah ke bucket privat.
-- ============================================================
