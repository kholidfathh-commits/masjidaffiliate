-- ============================================================
-- SETUP SUPABASE STORAGE untuk Al-Kahfi Team App (foto → CDN, hemat egress)
-- Cara pakai: buka Supabase dashboard -> project 'kahfiteam' -> SQL Editor
-- -> New Query -> paste SEMUA isi file ini -> klik RUN.
-- Aman dijalankan berkali-kali (idempoten).
-- ============================================================
-- Tujuan: foto (avatar, bukti GMV, lampiran laporan, bukti keuangan, selfie absen)
-- disimpan sebagai FILE di Storage, bukan base64 di database. Foto disajikan via CDN +
-- di-cache browser (Cache-Control 1 tahun) -> tidak ke-download berulang -> egress turun,
-- ukuran database tetap kecil.

-- 1. Buat bucket PUBLIK 'photos' (public = URL bisa dibuka langsung + di-cache CDN).
--    Tool internal; foto tidak sensitif tinggi & URL memakai id acak yang sulit ditebak.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

-- 2. Policy pada storage.objects khusus bucket 'photos'.
--    Publishable/anon key (dipakai app) boleh upload/baca/hapus di bucket ini saja.
--    Sama permisifnya dengan tabel kv_store (RLS internal). Bucket lain TIDAK terpengaruh.

drop policy if exists "photos public read"  on storage.objects;
create policy "photos public read" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "photos anon insert" on storage.objects;
create policy "photos anon insert" on storage.objects
  for insert with check (bucket_id = 'photos');

drop policy if exists "photos anon update" on storage.objects;
create policy "photos anon update" on storage.objects
  for update using (bucket_id = 'photos') with check (bucket_id = 'photos');

drop policy if exists "photos anon delete" on storage.objects;
create policy "photos anon delete" on storage.objects
  for delete using (bucket_id = 'photos');

-- ============================================================
-- Selesai. Cek: menu Storage harus muncul bucket "photos" (Public).
-- Setelah ini, foto BARU otomatis masuk Storage. Untuk memindahkan foto LAMA:
-- buka app -> Pengaturan App -> "Optimasi Foto (Hemat Egress)" -> klik tombolnya.
-- (Opsional) Ganti nama bucket lewat env VITE_SUPABASE_BUCKET; default 'photos'.
-- ============================================================
