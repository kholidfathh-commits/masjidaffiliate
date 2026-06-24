# Panduan: Google Calendar Terpusat (1 akun untuk semua)

**Tujuan:** semua agenda dari aplikasi masuk ke **satu Google Calendar** (akun pusat
**digitalalkahfi@gmail.com**). Manager, Leader, dan Sekretariat bisa menambah agenda yang
otomatis masuk ke Google Calendar-mu — **anggota lain tidak perlu login Google lagi.**

Setup ini **dilakukan sekali** olehmu (Kholidfath). Setelah itu beres selamanya.

> Sudah saya matikan semua prompt "hubungkan ke Google" di aplikasi. Jadi walaupun setup di bawah
> belum kamu kerjakan, **karyawan sudah tidak akan diminta login Google lagi.** Agenda tetap tampil
> untuk semua di menu **Kalender Tim** (sinkron lewat server app). Langkah di bawah hanya untuk
> menyalakan kiriman otomatis ke Google Calendar.

---

## Bagian 1 — Buat "jembatan" Apps Script (± 5 menit)

1. Buka **script.google.com** — pastikan login sebagai **digitalalkahfi@gmail.com** (akun pusat).
2. Klik **New project** (Proyek baru).
3. Hapus semua tulisan contoh di editor, lalu **paste seluruh isi** file
   **`AppsScript-GCal-Bridge.gs`** (yang saya buat di folder repo).
4. Di baris `var SECRET = '...'`, ganti dengan **kode rahasia bebas** buatanmu, misalnya:
   `alkahfi-kalender-2026`. **Catat kode ini** — nanti dipakai lagi.
5. Klik ikon **Simpan** (disket). Beri nama proyek, misal **"Al-Kahfi GCal Bridge"**.

## Bagian 2 — Deploy jadi Web App

6. Klik tombol biru **Deploy** (kanan atas) → **New deployment**.
7. Klik ikon gerigi ⚙️ di sebelah "Select type" → pilih **Web app**.
8. Isi:
   - **Description:** bebas (mis. "v1")
   - **Execute as:** **Me (digitalalkahfi@gmail.com)** ← WAJIB begini
   - **Who has access:** **Anyone** ← WAJIB begini (biar app bisa kirim tanpa login)
9. Klik **Deploy**.
10. Muncul minta izin → **Authorize access** → pilih akun **digitalalkahfi@gmail.com**.
    - Kalau ada layar "Google hasn't verified this app": klik **Advanced** →
      **Go to Al-Kahfi GCal Bridge (unsafe)** → **Allow**. (Ini wajar karena script milikmu sendiri.)
11. Setelah jadi, **copy "Web app URL"** — bentuknya:
    `https://script.google.com/macros/s/AKfycb..../exec`
    Simpan baik-baik.

> Tes cepat: buka URL itu di browser. Kalau muncul tulisan **"Al-Kahfi Google Calendar bridge AKTIF."**
> berarti jembatannya hidup.

## Bagian 3 — Sambungkan ke aplikasi (Vercel)

12. Buka **vercel.com** → project **masjidaffiliate** → **Settings** → **Environment Variables**.
13. Tambah **dua** variabel ini (centang **Production** dan **Preview**):

    | Name | Value |
    |------|-------|
    | `VITE_GCAL_ENDPOINT` | URL Web app dari langkah 11 |
    | `VITE_GCAL_SECRET` | kode rahasia dari langkah 4 (harus **sama persis**) |

14. Buka tab **Deployments** → titik tiga pada deployment teratas → **Redeploy**.
    (Atau cukup commit & push `src/App.jsx` lewat GitHub Desktop — Vercel deploy otomatis.)

## Bagian 4 — Tes

15. Buka aplikasi → **Kalender Tim** → buat agenda baru → **Simpan**.
16. Buka **Google Calendar** akun **digitalalkahfi@gmail.com** → agenda harus muncul di sana.
17. Kalau agenda diisi peserta yang punya **Gmail** (di Profil mereka), mereka otomatis **diundang
    via email**.

Selesai. Mulai sekarang, setiap agenda dari Manager/Leader/Sekretariat masuk ke Google Calendar-mu,
tanpa siapa pun perlu login lagi.

---

## Tanya–Jawab Singkat

**Anggota lain bagaimana lihat di Google Calendar HP mereka?**
Dua pilihan: (a) cukup pakai **Kalender Tim di aplikasi** (sudah sinkron untuk semua), atau
(b) kalau mau muncul di Google Calendar HP mereka, di Google Calendar-mu buka **Settings → Setelan
kalender → Bagikan ke orang tertentu**, masukkan email mereka. Atau pastikan mereka diisi sebagai
**peserta** (punya Gmail) supaya dapat undangan otomatis.

**Kalau mau ganti kode rahasia?**
Ubah di dua tempat sekaligus: `var SECRET` di Apps Script (lalu Deploy → Manage deployments → Edit
→ Version: New version → Deploy) dan `VITE_GCAL_SECRET` di Vercel (lalu Redeploy).

**Aman tidak?**
Untuk alat internal tim, cukup aman. Kode rahasia mencegah orang asing iseng. Script hanya bisa
membuat agenda, tidak bisa baca data lain.

**Kalau jembatan belum dipasang?**
Aplikasi tetap jalan normal. Agenda tersimpan & tampil untuk semua di app; hanya belum dikirim ke
Google Calendar. Tidak ada error ke pengguna.
