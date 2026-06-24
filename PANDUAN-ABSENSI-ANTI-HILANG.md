# Panduan: Absensi Anti-Hilang (penyimpanan per-record)

## Apa yang berubah
Dulu **semua** data absensi disimpan dalam **1 sel** (`attendance:all`). Setiap kali ada yang
absen, seluruh daftar ditulis ulang — jadi kalau 2 orang absen barengan atau internet ngadat,
daftar bisa ketimpa dan **data hilang**.

Sekarang **tiap absen jadi 1 baris sendiri** (`attendance:rec:<id>`). Absen baru = tambah 1 baris,
tidak menyentuh data orang lain. **Tabrakan & timpa-massal hilang total.**

Perubahan ini **hanya untuk modul Absensi** dulu (pilot). Laporan Harian, GMV, dll menyusul setelah
ini terbukti aman.

> Tidak ada perubahan database. Tidak ada library baru. Yang di-commit cuma `src/App.jsx`.

---

## Langkah deploy (urut, jangan dilewati)

**1. Backup dulu — WAJIB sebelum apa pun.**
Buka app → Pengaturan App → Backup & Keamanan Data →
- Klik **"Download Backup"** (simpan file-nya), DAN
- Klik **"Backup ke Drive Sekarang"**.

Ini jaring pengaman. Kalau ada apa-apa, data bisa dipulihkan dari sini.

**2. Commit & push lewat GitHub Desktop.**
File yang berubah: **`src/App.jsx`** saja. Commit → Push ke `main`.

**3. Tunggu Vercel selesai deploy** (cek di dashboard Vercel, status "Ready"), lalu **hard refresh**
di app (tutup-buka lagi / refresh paksa). Minta tim juga refresh sekali.

**4. Migrasi jalan OTOMATIS.** Pertama kali app dibuka setelah deploy, data absensi lama otomatis
dipindah ke format baru. Kamu tidak perlu klik apa-apa. Data lama tetap diarsipkan sebagai cadangan.

---

## Cara tes (5 menit, biar yakin)

1. **Tes barengan:** minta 2 orang absen di waktu hampir bersamaan → buka Riwayat Absensi →
   **kedua absen harus muncul** (dulu salah satu bisa hilang).
2. **Tes riwayat lama:** buka Riwayat Absensi → data absen sebelum deploy **harus tetap ada**.
3. **Tes edit & hapus:** edit 1 absen, lalu hapus 1 absen → cek hasilnya benar.
4. **Tes backup:** Pengaturan App → Download Backup → buka file JSON → cari `"attendance:all"` →
   harus berisi daftar absensi (artinya absensi tetap ikut ke-backup).

Kalau 4 hal di atas beres, modul Absensi aman.

---

## Kalau ada masalah
Jangan panik, data lama tidak dihapus. Pulihkan saja:
Pengaturan App → Backup & Keamanan Data → **"Pulihkan (Gabung) — Aman"** → pilih file backup dari
Langkah 1. Data kembali tanpa menghapus data baru.

---

## Setelah ini (rencana lanjutan)
Kalau Absensi aman 1–2 hari, lanjut pakai pola yang sama ke:
1. **Laporan Harian** (`daily-reports:all`) — paling sering dipakai tim.
2. **GMV harian** (`gmv:daily`, `affiliate-gmv:daily`).
3. **Tiket, Izin, Kalender**, dst.

Tinggal bilang ke saya modul mana yang mau dikerjakan berikutnya.
