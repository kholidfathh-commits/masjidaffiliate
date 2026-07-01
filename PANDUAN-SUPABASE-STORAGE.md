# Panduan: Foto ke Supabase Storage (Hemat Egress)

Tujuan: memindahkan foto (avatar/profil, bukti GMV, lampiran laporan, bukti keuangan, selfie absen)
dari **database** ke **Supabase Storage**. Foto lalu disajikan lewat CDN dan di-cache browser, jadi:

- **Egress turun** — foto tidak lagi ke-download berulang tiap halaman auto-refresh.
- **Database tetap kecil** — foto tidak lagi disimpan sebagai base64 di dalam data.

> Aman: kalau setup di bawah **belum** dijalankan, app tetap jalan normal — foto sementara disimpan
> di "brankas DB" seperti sebelumnya. Setelah setup selesai, foto **baru** otomatis masuk Storage.

---

## Langkah 1 — Setup sekali di Supabase (butuh ± 2 menit)

1. Buka **https://supabase.com/dashboard** → pilih project **`kahfiteam`**.
2. Menu kiri → **SQL Editor** → **New query**.
3. Buka file **`supabase-storage-setup.sql`** (ada di repo), **salin semua isinya**, tempel ke editor.
4. Klik **Run** (atau `Ctrl/Cmd + Enter`). Harus muncul "Success".
5. Cek: menu kiri → **Storage** → harus ada bucket **`photos`** berlabel **Public**.

Selesai. Mulai sekarang, setiap foto **baru** yang diupload di app langsung tersimpan di Storage.

---

## Langkah 2 — Pindahkan foto LAMA (opsional, tapi disarankan)

Foto yang sudah terlanjur tersimpan di database bisa dipindahkan ke Storage sekaligus:

1. Sebaiknya **backup dulu**: Pengaturan App → Backup & Restore → unduh backup.
2. Buka **Pengaturan App** → bagian **"Optimasi Foto (Hemat Egress)"**.
3. Klik **"Optimalkan Foto Sekarang"**. Jangan tutup halaman sampai selesai.
4. Kalau muncul pesan _"bucket belum disiapkan"_, berarti Langkah 1 belum jalan — ulangi Langkah 1 lalu klik lagi.

Aman diulang: foto yang sudah pindah otomatis dilewati. Jalankan saat tim tidak sedang banyak input.

---

## Catatan penting

- **Backup foto:** foto di Storage **tidak** ikut file backup JSON / Google Drive (yang ikut hanya
  data + foto yang masih di brankas DB). Foto di Storage aman tersimpan permanen di Supabase.
  Jika suatu saat pindah/rebuild project Supabase, **pindahkan juga isi bucket `photos`**.
- **Selfie absen** tetap otomatis terhapus setelah 60 hari (objek di Storage ikut dibersihkan).
- **Keamanan:** bucket `photos` bersifat publik (siapa pun dengan URL bisa membuka foto), setara dengan
  posisi akses `kv_store` sekarang. URL memakai id acak yang sulit ditebak. Password tetap aman (di-hash).
- **Ganti nama bucket** (opsional): set env `VITE_SUPABASE_BUCKET` di Vercel; default `photos`.
