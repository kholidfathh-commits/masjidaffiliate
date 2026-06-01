# Al-Kahfi Team App

Sistem manajemen tim untuk **Al-Kahfi Corp · MCN TAP · Masjid Affiliate Agency**.

Dashboard tugas, creator management, laporan harian (form custom per posisi), jadwal live, target tim, komentar tugas, role hierarchy (Manajer / Leader / Operasional).

---

## Tech Stack

- **React 18** + **Vite** (SPA, no SSR)
- **Tailwind CSS 3** (JIT mode)
- **Lucide React** (icons)
- **localStorage** untuk penyimpanan data
- **Web Crypto API** (PBKDF2 100k iterasi) untuk hash password

---

## ✅ Penyimpanan Data: Supabase (Multi-Device)

Aplikasi ini menyimpan data tim di **Supabase (database cloud)**, jadi:

- ✅ Daftar 1x → login dari HP / laptop / browser manapun
- ✅ Data tim sinkron antar semua device & user
- ✅ Tidak hilang walau hapus cache browser

Data sesi & preferensi UI (sidebar, dll) tetap di localStorage per-device — ini sengaja, supaya tiap orang punya sesi login sendiri.

### WAJIB: Setup tabel database dulu (sekali saja)

Sebelum aplikasi bisa dipakai, jalankan SQL setup di Supabase:

1. Buka [supabase.com](https://supabase.com) → masuk ke project Anda
2. Klik **SQL Editor** (menu kiri) → **New Query**
3. Buka file **`supabase-setup.sql`** (ada di folder ini), copy SEMUA isinya
4. Paste ke SQL Editor → klik **RUN**
5. Harusnya muncul "Success" — tabel `kv_store` siap

Kredensial Supabase (URL + publishable key) sudah di-hardcode di `src/App.jsx` sebagai fallback, jadi tidak wajib setup environment variable. Kalau mau ganti project Supabase, edit `SUPABASE_URL` & `SUPABASE_KEY` di `src/App.jsx` atau set env var `VITE_SUPABASE_URL` & `VITE_SUPABASE_KEY`.

**Catatan keamanan:** Setup ini pakai publishable key + policy terbuka (cocok untuk tool internal). Password tetap aman karena ter-hash PBKDF2 sebelum disimpan. Untuk keamanan lebih ketat, bisa upgrade ke Row Level Security penuh + Supabase Auth nanti.

---

## Setup Lokal

### Prasyarat

- **Node.js 18+** (cek dengan `node -v`)
- **npm** atau **pnpm** atau **yarn**
- **Tabel Supabase sudah di-setup** (lihat section di atas)

### Langkah Install

```bash
# Clone repo (setelah upload ke GitHub)
git clone https://github.com/USERNAME/alkahfi-team-app.git
cd alkahfi-team-app

# Install dependencies
npm install

# Run development server
npm run dev
```

Buka browser ke `http://localhost:5173`.

Build untuk production:

```bash
npm run build
npm run preview   # untuk test hasil build local
```

Hasil build ada di folder `dist/`.

---

## Deploy ke Vercel

### Cara 1: Via Dashboard Vercel (paling gampang)

1. **Upload code ke GitHub** dulu:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/USERNAME/alkahfi-team-app.git
   git push -u origin main
   ```

2. Buka [vercel.com](https://vercel.com), login pakai GitHub.

3. Klik **"Add New Project"** → pilih repo `alkahfi-team-app`.

4. Vercel auto-detect framework sebagai **Vite**. Setting yang dipakai:
   - Framework Preset: **Vite**
   - Build Command: `npm run build` (auto)
   - Output Directory: `dist` (auto)
   - Install Command: `npm install` (auto)

5. Klik **"Deploy"**.

6. Tunggu ~1-2 menit. Aplikasi live di `https://NAMA-PROJECT.vercel.app`.

### Cara 2: Via CLI Vercel

```bash
npm i -g vercel
vercel login
vercel              # ikuti prompt
vercel --prod       # untuk deploy production
```

### Auto-deploy

Setiap push ke branch `main` di GitHub otomatis trigger deploy baru di Vercel.

---

## Pemakaian Pertama Kali

1. Buka aplikasi (lokal `http://localhost:5173` atau Vercel URL).
2. Karena belum ada user, akan muncul halaman **"Setup Pertama"** → daftarkan akun Manajer pertama.
3. Setelah masuk dashboard, dari menu **"Anggota Tim"** tambahkan Leader dan Operasional sesuai struktur tim.
4. Setting nama aplikasi, logo, dan custom role labels via menu **"Pengaturan App"**.

---

## Struktur Folder

```
alkahfi-team-app/
├── index.html              # HTML entry point + font preload
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite build config
├── tailwind.config.js      # Tailwind theme & content paths
├── postcss.config.js       # PostCSS untuk Tailwind
├── vercel.json             # Vercel SPA routing & security headers
├── .gitignore
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Single-file app (6000+ lines, semua komponen di sini)
    └── index.css           # Tailwind directives + custom utilities
```

---

## Fitur Utama

### Role & Permission
- **Manajer**: akses penuh ke semua data dan setting
- **Leader**: lihat & kelola operasional di bawahnya
- **Operasional**: hanya lihat data sendiri (kecuali To-Do List & Pengumuman yang terbuka)

### Modul yang Tersedia

| Modul | Deskripsi |
|---|---|
| **Dashboard** | Hero + Hari Ini summary + Target Widget + Stats compact + Pinned Reports + Aktivitas |
| **Tugas Tim** | Task management dengan deadline, prioritas, status, komentar (3-pihak permission) |
| **To-Do List** | Kanban personal dengan drag & drop, visible untuk semua tim |
| **Database Creator** | Daftar creator dengan TikTok username, GMV, status |
| **Pengelolaan Creator** | Assign creator ke Creator Manager, mapping hierarki |
| **Laporan Mingguan** | Laporan tim per minggu |
| **Laporan Harian** | **Form custom per posisi (ala Google Form)** — Manajer/Leader bikin template, Operasional submit |
| **Jadwal Live & Piket** | Schedule live, piket, shift |
| **Kalender Tim** | Event meeting, agenda, training dengan export .ics |
| **Leaderboard** | Ranking creator/anggota berdasarkan GMV |
| **Bank Ide Konten** | Kumpulan ide konten dengan status flow |
| **Pengumuman** | Broadcast info ke seluruh tim |
| **Target Tim** | Widget dashboard dengan progress bar visible untuk semua |
| **Anggota Tim** | CRUD user dengan reset password |
| **Pengaturan App** | Nama, subtitle, logo, custom role labels, daftar posisi |

### Fitur Terkini
- Profile photo + edit password (self-service)
- Search global di header (cari tugas, creator, anggota)
- Notifikasi (tugas baru, komentar, pengumuman)
- Quick action button "Tambah" di header
- Download laporan harian dengan custom date range
- Komentar tugas dengan permission ketat (pemberi tugas + penerima + leader + manajer)

---

## Troubleshooting

### Build error: "Cannot find module ..."
```bash
rm -rf node_modules package-lock.json
npm install
```

### Tailwind classes tidak ke-render setelah deploy
Pastikan `tailwind.config.js` punya `content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}']` (sudah di-set di repo ini).

### Storage penuh
localStorage browser ~5-10MB. Kalau penuh (biasanya karena terlalu banyak foto profil base64), hapus data lama atau pakai foto yang lebih kecil. Aplikasi sudah auto-compress avatar ke 256x256 JPEG ~30-50KB.

### "Window is not defined" saat build
Tidak akan terjadi di app ini karena tidak pakai SSR. Vite build static client-side bundle saja.

---

## Lisensi

Internal — Al-Kahfi Corp / MCN TAP. Tidak untuk distribusi publik tanpa izin.

---

## Kontribusi & Pengembangan Lanjut

Untuk roadmap migrasi ke backend (Supabase recommended), kontak developer.

Aspek yang perlu di-handle saat migrasi ke backend:
1. Auth: pindah dari localStorage hash → Supabase Auth atau Auth0
2. Data sync: ganti semua `storage.set/get/getList` jadi API call
3. Real-time: pakai Supabase Realtime / WebSocket untuk update live
4. File upload: pindah avatar/logo dari base64 ke object storage (S3/Supabase Storage)
5. Multi-tenant: kalau mau jadi SaaS, butuh tenant isolation

---

Built with ❤️ untuk tim Al-Kahfi Corp.
