# Panduan Backup ke Google Drive

Fitur ini mengirim cadangan **semua data tim** (anggota, GMV, creator, laporan, absensi, dll)
ke folder **"Al-Kahfi Backup"** di Google Drive milikmu. Tujuannya: kalau server (Supabase)
bermasalah, kamu masih punya salinan di tempat yang **beda** — jadi data tidak hilang total.

Aman: app pakai izin `drive.file`, artinya **hanya bisa melihat/mengelola file yang dia buat
sendiri**. App tidak bisa mengintip file pribadimu yang lain di Drive.

---

## 1. Syarat (sekali saja)

Fitur ini pakai **Client ID Google yang sama** dengan Google Calendar. Kalau Google Calendar
di app sudah jalan, biasanya backup Drive **langsung bisa dipakai tanpa setting tambahan.**

Kalau belum pernah setup Google sama sekali, ikuti dulu **PANDUAN-GOOGLE-CALENDAR.md**
(buat OAuth Client ID + isi `VITE_GOOGLE_CLIENT_ID` di Vercel).

### Kalau saat "Connect" muncul error izin/scope
Buka **Google Cloud Console → APIs & Services → OAuth consent screen → Scopes**, tambahkan:

```
https://www.googleapis.com/auth/drive.file
```

Simpan, lalu coba lagi. (Scope ini **tidak sensitif**, jadi tidak perlu verifikasi Google.)
Pastikan juga email kamu terdaftar di **Test users** kalau consent screen masih mode "Testing".

> Tidak perlu mengubah Authorized JavaScript origins — sudah sama dengan setup Calendar
> (`https://alkahficorp.vercel.app`). Tidak perlu enable API tambahan; Drive API otomatis aktif
> saat dipakai. Tidak ada dependency npm baru, jadi tidak perlu ubah package.json.

---

## 2. Cara pakai di app

1. Login sebagai **Owner / Manajer**.
2. Buka **Pengaturan App → Backup & Keamanan Data**.
3. Di bagian **"Backup ke Google Drive"** ada 2 tombol:
   - **Backup ke Drive Sekarang** → kirim 1 cadangan sekarang juga. Pertama kali akan minta
     login Google (pilih akun + izinkan). Setelah itu muncul link "buka file".
   - **Aktifkan Auto-Backup Harian** → setelah diaktifkan, app otomatis backup ke Drive
     **1× per hari** saat dibuka. Klik tombol hijaunya lagi untuk mematikan.

Disarankan: **aktifkan Auto-Backup Harian** sekali, biar tidak perlu ingat-ingat lagi.

---

## 3. Di mana file-nya & berapa lama disimpan

- Folder di Drive: **Al-Kahfi Backup**
- Nama file: `alkahfi-backup-2026-06-18_1430.json` (tanggal + jam)
- Disimpan **30 file terakhir**; yang lebih lama otomatis dihapus biar Drive tidak penuh.

---

## 4. Cara memulihkan data dari backup Drive

1. Buka Google Drive → folder **Al-Kahfi Backup** → **download** file backup yang kamu mau.
2. Di app: **Pengaturan App → Backup & Keamanan Data → Pulihkan (Gabung) — Aman**.
3. Pilih file `.json` yang tadi di-download.

**Pulihkan (Gabung)** itu aman: entri lama yang hilang **kembali**, data baru yang sudah ada
**tidak terhapus**. Jangan pakai "Timpa Total" kecuali memang mau reset penuh.

---

## 5. Catatan penting

- Backup ke Drive **menambah** lapisan keamanan, **tidak menggantikan** export manual `.json`
  ke laptop. Punya 2 tempat lebih aman daripada 1.
- Auto-backup harian butuh kamu **sudah connect Google minimal sekali**. Kalau sesi Google
  habis, sesekali app minta login ulang — itu normal.
- Foto selfie absen **tidak** ikut backup (ukurannya besar, otomatis terhapus 60 hari).
  Data absensinya sendiri tetap ikut ter-backup.
