# CLAUDE.md — Al-Kahfi Team App

## ⚠️ BAHASA (WAJIB)
**Selalu balas, jelaskan, dan narasikan dalam BAHASA INDONESIA.** User tidak berbahasa Inggris. Semua penjelasan, ringkasan, rencana, dan pesan progres HARUS Bahasa Indonesia yang sederhana & jelas. (Nama variabel/kode/istilah teknis di dalam kode tetap apa adanya — jangan diterjemahkan.)

---

Panduan konteks untuk Claude Code. **Baca file ini + `App Manajemen Tim/progress.MD` sebelum mengubah kode.** `progress.MD` = riwayat teknis lengkap & sumber kebenaran.

## Apa ini
Sistem manajemen tim internal **Al-Kahfi Corp (MCN TAP + Masjid Affiliate)**. Live & dipakai harian.
- Production: https://alkahficorp.vercel.app
- Repo: github.com/kholidfathh-commits/masjidaffiliate

## Stack
- React 18 + Vite 5 + Tailwind 3. `src/App.jsx` (~14.900 baris — hampir semua komponen di sini) + `src/index.css`.
- **Pengecualian: modul LMS ada di `src/lms/` (6 file), dimuat `React.lazy`.** App.jsx hanya menyimpan import + 3 baris rute + registry. Detail: `PANDUAN-LMS.md`. Modul di `src/lms/` TIDAK BOLEH meng-import App.jsx (circular import → layar putih); dependensi disuntik lewat `initLms()`.
- **Pengecualian 2: logika ABSENSI ada di `src/absensi/logika.js`** — fungsi MURNI (tanggal WIB, rentang filter, status harian, aktivitas terakhir, rentang izin). Tanpa React/JSX/storage supaya bisa diuji `node uji-absensi.mjs`. Sama seperti `src/lms/`: TIDAK BOLEH meng-import App.jsx.
- **Pengecualian 3: `src/keuangan/hitung.js` (NPM & deret Laba Bersih) dan `src/aset/data.js` (modul Aset/Inventaris + encoder barcode Code 128-B tanpa dependency).** Keduanya fungsi MURNI, diuji `node uji-keuangan-aset.mjs`, dan TIDAK BOLEH meng-import App.jsx.
- **Pengecualian 4: `src/tiket/urutan.js`** — urutan/sortir halaman Tiket (default terbaru dulu, 5 mode). Fungsi MURNI, diuji `node uji-tiket.mjs`, TIDAK BOLEH meng-import App.jsx.
- **Pengecualian 5: `src/catatan/data.js`** — modul CATATAN KERJA (Work Notes): hak akses pribadi/divisi/organisasi, pencarian judul-isi-penulis, filter, urutan (disematkan di atas), dan teks berformat sederhana. Fungsi MURNI, diuji `node uji-catatan.mjs`, TIDAK BOLEH meng-import App.jsx (ia hanya meng-import `src/absensi/logika.js` untuk tanggal WIB).
- **Pengecualian 6: `src/sampel/data.js` + `src/sampel/qr.js`** — modul MANAJEMEN SAMPEL: kode sampel & token QR, umur, statistik pemakaian, aging, filter/urutan, hak akses, ukuran label, link produk (`data.js`) dan **encoder QR buatan sendiri** (`qr.js`: mode byte, level koreksi M, versi 1–10, Reed-Solomon + pemilihan mask). Fungsi MURNI, diuji `node uji-sampel.mjs` (228 tes), TIDAK BOLEH meng-import App.jsx (`data.js` hanya meng-import `src/absensi/logika.js` untuk tanggal WIB). QR ditulis sendiri, BUKAN library npm — alasan sama seperti barcode Code 128 di modul Aset: tanpa dependency & tanpa langkah install tambahan saat deploy.
- **Pengecualian 7: `src/peran/hierarki.js`** — HIERARKI PERAN & PENGAWASAN: daftar peran (`ROLE_KEYS`, `ROLE_RANK`), siapa mengawasi siapa (`lingkupTim`, `lingkupTimIds`, `idBawahanTransitif`), hak lihat/kelola user (`bisaLihatUser`, `bisaKelolaUser`), dan aturan form (`peranBolehDibuat`, `calonAtasan`, `validasiAtasan`, `normalisasiAtasanId`). Fungsi MURNI, diuji `node uji-peran.mjs` (89 tes), TIDAK BOLEH meng-import App.jsx. **JANGAN menulis ulang rumus `u.leaderId === user.id` di App.jsx** — `uji-peran.mjs` §10 sengaja GAGAL bila pola itu muncul lagi, karena rumus salinan itulah yang dulu membuat lapisan Co-Leader mustahil ditambah tanpa mengubah 15 tempat. Detail: `PANDUAN-PERAN-DAN-PROMOSI.md`.
- Data: **Supabase** (tabel `kv_store`, key-value) dengan fallback localStorage. Region Tokyo. Password di-hash PBKDF2.
- Deploy: push ke `main` → Vercel auto-deploy.
- **5 role: owner / manajer / leader / wakil (Co-Leader) / operasional** (+ flag `isSecretariat`). Peran disimpan di field `role` tiap objek di `users:list`; atasan langsung di field `leaderId` (namanya lama, artinya kini "atasan langsung" — boleh Leader maupun Co-Leader). Cakupan data dihitung TRANSITIF: Leader → Co-Leader → Karyawan. Divisi (struktur 2026-2029): manajemen, keuangan, mabit, mcn, tap, event (= MMC "Malam Mabit Cuan"), internal. Divisi `media` sudah dihapus — label key dinamis WAJIB via helper `divLabel()`.

## ATURAN WAJIB (langgar = app rusak / blank screen)
1. **Warna gelap/gradient → inline `style={{}}`, BUKAN `bg-[#hex]`.** Tema: biru #2563EB, bg app #F4F7FE, sidebar navy #0B1120, font Inter.
2. **Modal → `createPortal` ke body.** Animasi fade = opacity-only.
3. **Setiap key data baru WAJIB masuk `BACKUP_KEYS`** (kalau tidak, data tak ikut backup).
4. **Modul array baru per-record:** bikin loader + daftarkan di `PER_RECORD_LOADERS` & `PER_RECORD_PREFIX`.
5. **Baca prefix per-record di kv_store WAJIB pakai `LIKE`, JANGAN range `gte/lt`.** (Collation Supabase locale-aware → baris tak ketemu di production.)
6. **Urutan deklarasi const kritis** (single-file): `useMemo`/`const` yang mereferensikan const lain HARUS dideklarasikan SETELAHNYA. Salah urutan → TDZ → blank screen yang **tidak** ketangkap `vite build`. (Catatan: `import` ES ter-hoist, jadi konstanta dari `src/lms/data.js` aman dipakai di registry baris ~470.)
7. **File baru di `src/lms/` ditulis DULU, `App.jsx` PALING AKHIR.** Kalau App.jsx (yang sudah berisi import ke file baru) ter-commit lebih dulu, build Vercel gagal karena import menggantung.
8. **Jangan baca deep link di dalam `useState(() => ...)`.** `src/main.jsx` memakai `React.StrictMode`, yang memanggil initializer useState DUA KALI saat development. Kalau initializer punya efek samping (mis. `history.replaceState` untuk membersihkan alamat), panggilan kedua akan membaca alamat yang sudah bersih → nilainya hilang dan fiturnya "tidak jalan di dev, jalan di production". Baca sekali di level modul (lihat `TOKEN_SAMPEL_AWAL`).

## Verifikasi (WAJIB sebelum anggap selesai)
- `npx vite build --outDir /tmp/dist-verif --emptyOutDir` harus lulus (rm di folder ini kadang ditolak, makanya build ke /tmp).
- Jalankan uji yang relevan: `node uji-tiket.mjs` (38 tes), `node uji-keuangan-aset.mjs` (62), `node uji-absensi.mjs` (80), `node uji-lms.mjs` (79), `node uji-akses.mjs` (31), `node uji-catatan.mjs` (90), `node uji-sampel.mjs` (228), `node uji-peran.mjs` (89). Project ini JS murni — TIDAK ada typecheck/ESLint.
- **`uji-akses.mjs` membaca badan fungsi LANGSUNG dari `src/App.jsx` lewat regex** (`canSeeTask`, `penerimaTiket`, `DIVISION_FEATURES`, `canAccessFeature`). Kalau salah satu fungsi itu diganti nama / dipindah, uji ini gagal dengan pesan "... tidak ketemu" — perbaiki regex-nya, jangan menyalin fungsinya.
- **`uji-peran.mjs` §0 & §10 juga membaca `src/App.jsx` lewat regex** — memastikan App.jsx benar-benar MEMAKAI `src/peran/hierarki.js` (bukan menyalin rumusnya), bahwa peran `wakil` terdaftar di `ROLES`/`DEFAULT_ROLE_LABELS`, dan bahwa TIDAK ada otorisasi berbasis nama/username orang tertentu.
- **`uji-sampel.mjs` §18 juga membaca `src/App.jsx` lewat regex** (registry per-record, `BACKUP_KEYS`, rute, menu sidebar, `TOKEN_SAMPEL_AWAL`, pemeriksaan hak akses sebelum tulis). Ini penjaga aturan wajib no. 3, 4, 5 & 8 — kalau gagal, biasanya memang ada aturan yang terlanggar, bukan regexnya yang salah.
- Pastikan brace/bracket balance = 0.
- Untuk perubahan besar: cek app tidak blank (bukan cuma build lulus).

## Alur Deploy (user non-teknis)
Edit `src/App.jsx` → commit ke `main` (GitHub Desktop) → push → Vercel auto-deploy → hard refresh.
File lain ikut di-commit HANYA bila berubah: `package.json`/`package-lock.json` (dep baru), `index.css` (CSS berubah), file PANDUAN/`.gs`.
**Sebelum deploy besar:** backup dulu via Pengaturan App → Backup & Restore.

## Perhatian Aktif (per 1 Jul 2026)
- **Egress Supabase pernah over-kuota → project sempat DI-RESTRICT (402) 1 Jul, PULIH sendiri 1 Jul ~20:49** setelah kuota reset siklus billing (egress dihitung PER BULAN, bukan kumulatif — sempat salah paham "grace s/d 23 Jul"). **Pelajaran:** restriksi lepas otomatis beberapa jam setelah siklus baru; upgrade Pro = lepas instan (opsi bila tim tak bisa nunggu). Data AMAN & UTUH saat restore layanan (dicek: 1.076 baris; 14 user, absensi 311, dll — tidak ada yang hilang; restriksi = blokir serving, BUKAN hapus data).
- **CEGAH KEBLOKIR LAGI — ✅ SEMUA AKTIF DI PRODUCTION (2 Jul 2026):** (1) foto→Storage AKTIF: bucket `photos` dibuat (SQL setup dijalankan via Chrome 2 Jul), migrasi "Optimalkan Foto" dijalankan owner → 119 foto (brankas 235→116; sisa 116 = blob yatim tak dipakai record, sengaja dibiarkan), semua avatar/lampiran/bukti kini URL Storage cache 1 thn; (2) `pollWhenVisible` live; (3) polling 30–60s. Backup pra-migrasi 18MB ada di scratchpad sesi Claude 2 Jul.
- **Foto → Supabase Storage (SUDAH di kode, 1 Jul):** `putImage` upload ke bucket `photos` (URL publik CDN, cache 1 thn) dengan **fallback otomatis ke brankas DB `img:`** bila bucket belum siap → app tak pernah rusak. **Butuh setup SEKALI oleh user:** jalankan `supabase-storage-setup.sql` di Supabase SQL Editor (bikin bucket + policy), lalu Pengaturan App → "Optimalkan Foto Sekarang" untuk memindahkan foto lama + selfie. Panduan: `PANDUAN-SUPABASE-STORAGE.md`.

## Backlog (lihat progress.MD §5 untuk detail)
Harden `handleDelete` kalender · Command Palette (Cmd+K) · Supabase Auth + RLS penuh · Web Push beneran · Neraca penuh keuangan. (foto → Storage: SELESAI di kode, tunggu user jalankan SQL setup)
