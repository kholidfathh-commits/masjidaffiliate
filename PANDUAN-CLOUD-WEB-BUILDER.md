# Panduan: Pindah Total ke Cloud Web Builder (aplikasi + database MySQL)

Rencana: aplikasi jalan penuh di Cloud Web Builder dengan database MySQL milik platform. Vercel & Supabase dibiarkan apa adanya (tidak disentuh, jadi cadangan).

## File yang disiapkan Claude

| File | Fungsi |
|---|---|
| `app-mysql-cloud-web-builder.js` | Isi baru untuk `app.js` di IDE platform: server + API database MySQL |
| `alat-migrasi-cloud-web-builder.html` | Alat sekali-klik: kirim seluruh file aplikasi + seluruh data ke platform (dibuka di Chrome) |
| `pindah-total-cloud-web-builder.zip` | Arsip paket lengkap (cadangan/referensi) |

## Urutan langkah

1. **Backup data dari aplikasi lama:** buka https://alkahficorp.vercel.app → Pengaturan App → Backup & Restore → Export/Backup → file `.json` terunduh.
2. **Tempel server:** di IDE platform, buka `app.js` → hapus semua isinya → tempel seluruh isi `app-mysql-cloud-web-builder.js` → simpan.
3. **Jalankan:** klik Stop App (bila nyala) → Run App.
4. **Migrasi:** buka file `alat-migrasi-cloud-web-builder.html` (klik dua kali, terbuka di Chrome) → isi alamat aplikasi di platform → pilih file backup `.json` → klik **Mulai Migrasi** → tunggu sampai "SELESAI ✓".
5. **Cek:** buka alamat platform → login seperti biasa → pastikan data (user, absensi, GMV, laporan, keuangan) lengkap.
6. **Publish** di panel platform bila belum.

## Cara kerja (ringkas)

- `app.js` menyediakan API `/api/kv` di atas MySQL — pengganti Supabase. Tabel `kv_store` dibuat otomatis saat pertama jalan.
- Frontend yang dikirim alat migrasi adalah build khusus yang bicara ke `/api/kv` (bukan Supabase lagi). Foto baru tersimpan di MySQL (brankas `img:`).
- `/api/health` di alamat platform = alat cek kondisi (koneksi database, jumlah baris data).

## Catatan penting

- **Dua aplikasi jadi terpisah setelah migrasi.** Data yang diinput di platform TIDAK muncul di Vercel, dan sebaliknya. Tetapkan satu sebagai alat kerja resmi tim setelah masa uji.
- **Foto & selfie lama** tersimpan sebagai alamat Supabase Storage — tetap tampil normal selama Supabase tidak dihapus. Foto baru sepenuhnya masuk MySQL platform.
- **Yang nonaktif di platform:** kirim agenda ke Google Calendar tim & backup Google Drive (terikat konfigurasi Vercel). Fitur backup/restore manual di Pengaturan App tetap jalan.
- **Update aplikasi** tidak otomatis di platform (tidak ada jalur GitHub). Tiap ada perubahan kode, minta Claude buatkan build + alat migrasi baru (data tidak perlu dikirim ulang, hanya file).
- Kalau database belum konek, buka `alamat-platform/api/health`, screenshot hasilnya, kirim ke Claude.
