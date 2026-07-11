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
- React 18 + Vite 5 + Tailwind 3, **single-file** di `src/App.jsx` (~14.400 baris — SEMUA komponen di sini) + `src/index.css`.
- Data: **Supabase** (tabel `kv_store`, key-value) dengan fallback localStorage. Region Tokyo. Password di-hash PBKDF2.
- Deploy: push ke `main` → Vercel auto-deploy.
- 4 role: owner / manajer / leader / operasional (+ flag `isSecretariat`). Divisi: manajemen, internal, mcn, tap, media, event, mabit, keuangan.

## ATURAN WAJIB (langgar = app rusak / blank screen)
1. **Warna gelap/gradient → inline `style={{}}`, BUKAN `bg-[#hex]`.** Tema: biru #2563EB, bg app #F4F7FE, sidebar navy #0B1120, font Inter.
2. **Modal → `createPortal` ke body.** Animasi fade = opacity-only.
3. **Setiap key data baru WAJIB masuk `BACKUP_KEYS`** (kalau tidak, data tak ikut backup).
4. **Modul array baru per-record:** bikin loader + daftarkan di `PER_RECORD_LOADERS` & `PER_RECORD_PREFIX`.
5. **Baca prefix per-record di kv_store WAJIB pakai `LIKE`, JANGAN range `gte/lt`.** (Collation Supabase locale-aware → baris tak ketemu di production.)
6. **Urutan deklarasi const kritis** (single-file): `useMemo`/`const` yang mereferensikan const lain HARUS dideklarasikan SETELAHNYA. Salah urutan → TDZ → blank screen yang **tidak** ketangkap `vite build`.

## Verifikasi (WAJIB sebelum anggap selesai)
- `npx vite build --outDir /tmp/dist-verif --emptyOutDir` harus lulus (rm di folder ini kadang ditolak, makanya build ke /tmp).
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
