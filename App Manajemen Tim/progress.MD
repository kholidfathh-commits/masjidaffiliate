# Progress — Aplikasi Manajemen Tim Al-Kahfi Corp

Catatan pengembangan teknis aplikasi manajemen tim internal Al-Kahfi Corp (MCN TAP + Masjid Affiliate). Live di Vercel, dipakai tim harian.

**Periode:** 13 Jun – 24 Jun 2026
**Domain:** https://alkahficorp.vercel.app
**Terakhir diperbarui:** 24 Jun 2026

---

## 1. Arsitektur & Stack

- **Sumber kebenaran:** `src/App.jsx` (~12.400+ baris, single file) + `src/index.css`.
- **Stack:** React 18 + Vite 5 + Tailwind 3 + Supabase/localStorage hybrid.
- **Storage:** Supabase free tier (region Tokyo), tabel `kv_store`. Risiko: auto-pause 7 hari, tanpa PITR/backup otomatis → mitigasi lewat fitur Backup & Restore + auto-backup harian + backup Google Drive.
- **Versi artifact paralel:** `AlKahfiTeamApp.jsx` (pakai `window.storage`, style inline), diturunkan dari versi deploy via script konversi.
- **Peran:** 4 role (owner / manajer / leader / operasional) + flag `isSecretariat`.
- **Divisi:** manajemen, internal, mcn, tap, media, event, mabit, keuangan.
- **Tema (sejak redesign 13 Jun):** biru elektrik #2563EB, bg app #F4F7FE, sidebar gelap navy #0B1120, font Inter.
- **PWA:** installable di HP (jalur internal, bukan App Store) via `public/manifest.webmanifest` + `public/sw.js`.

---

## 2. Konvensi & Aturan Wajib

- Warna gelap/gradient pakai inline `style={{}}` (BUKAN `bg-[#hex]`).
- Modal dirender via `createPortal` ke body.
- Animasi fade = opacity-only.
- Key data baru WAJIB ditambahkan ke `BACKUP_KEYS`.
- Modul array yang baru per-record: bikin loader + daftarkan di `PER_RECORD_LOADERS` & `PER_RECORD_PREFIX` (key array tetap di `BACKUP_KEYS` sebagai handle logis).
- **Prefix per-record di kv_store WAJIB dibaca pakai `LIKE`, JANGAN range `gte/lt`** (collation Supabase locale-aware, `:` vs `;` tidak urut ASCII → baris tak ketemu di production).
- Urutan deklarasi penting: di single-file, `useMemo`/`const` yang mereferensikan const lain HARUS dideklarasikan setelahnya (hindari TDZ → blank screen yang tidak ketangkap `vite build`).
- **Verifikasi:** `npm run build` wajib lulus; brace/bracket balance = 0. Build verif aman pakai `npx vite build --outDir /tmp/dist-verif --emptyOutDir` (rm di mount sering ditolak).
- **Deploy (user non-teknis):** edit App.jsx → GitHub Desktop commit ke `main` → push → Vercel auto-deploy → hard refresh. `index.css` di-commit hanya kalau CSS berubah.

---

## 3. Riwayat Pengembangan

### 13 Jun 2026 — Update besar (~11.000 baris)

- **Font:** Inter menggantikan Fraunces + Plus Jakarta (index.html, index.css, 2 inline `<style>` di LandingPage/AuthShell).
- **Selfie wajib absen:** `SelfieCaptureModal`, key `selfie:<recId>` terpisah + `attendance:selfie-index`, auto-prune 60 hari, TIDAK ikut backup kecuali index-nya.
- **Jam kerja per karyawan:** `attendance:config.custom[userId]`, helper `effectiveAttConfig()`, flag `flexible`.
- **KPI v2 (5 komponen):** attendance / punctuality / tasks / reports / target GMV. Bobot target dialihkan ke tugas + laporan bila user tak pegang target. `normalizeKpiConfig()` migrasi config lama. Leaderboard pakai skor KPI.
- **SWOT otomatis:** `analyzeBusiness()` + `SwotPanel` di BusinessDashboard per tab.
- **Export PPT:** pptxgenjs 3.12 via cdnjs (`loadPptxGen()`), `exportBusinessPpt()`, modal periode pekanan/bulanan.
- **GMV akun affiliator auto-sync** ke gmv:daily divisi internal (`syncInternalDivision`, flag `autoSynced`); rincian angka harian per akun (tabel expandable).
- Multi-delete + hapus semua creator; upload gambar di feedback & lampiran bukti di laporan harian/mingguan (`compressImageFile`, maks 3, base64 inline).
- Notif kalender H-1 (15:00) & hari-H (06:30) tipe 'calendar' di TopBar.
- Komponen global `Avatar` + `ImageLightbox`; foto profil tampil di UsersView/KPI/Leaderboard/Feedback/Absensi/Aktivitas.
- **Bug fix:** Pengaturan App blank (ikon `Database` tidak di-import + hooks-before-return di SettingsView); opsi form builder tidak bisa >1 (textarea pakai state lokal `optionsText`).

### 13 Jun 2026 — Ronde 2 (build lulus)

- **PPT fix:** CDN cdnjs gagal di production → pptxgenjs@3.12.0 masuk package.json + dynamic `import('pptxgenjs')` (chunk terpisah ~385KB).
- **Riwayat absensi → tabel rekap harian:** gabung in/out per orang per tanggal (Tanggal·Nama·Masuk·Pulang·Durasi·Status), klik baris → detail lokasi/selfie/edit/hapus; peta iframe dihapus (`osmEmbed` tak terpakai).
- **`AccountTrendChart`:** line chart SVG + toggle Pekanan/Bulanan + garis target harian di rincian akun affiliator.
- **`displayJobTitle()` + `LEADER_DIV_SHORT`:** manajer/owner tanpa badge jabatan, leader otomatis "Leader MCN/TAP/Affiliator/…" — dipakai di UsersView/KPI/Leaderboard.
- **Bukti foto GMV:** field `proofs` (maks 2) di affiliate-gmv:daily entry, ikon kamera hijau di tabel rincian.

### 13 Jun 2026 — Ronde 3: Redesign UI biru "Creativa" (build lulus)

- Seluruh aksen indigo → blue (479 kelas via sed + hex inline: #4F46E5→#2563EB, #4338CA→#1D4ED8; 0 sisa indigo).
- bg app #F4F7FE; sidebar gelap navy #0B1120 (inline style, active pill glow biru rgba(37,99,235,0.22) + inset ring).
- Hero dashboard gradient #070D1F→#0B1B45 + radial glow biru + tombol biru glow.
- LandingPage ditulis ulang full dark (nav, headline gradient "Satu Dashboard, Semua Terkendali", mockup 3D melayang, stats bar 4 kolom).
- AuthShell dua panel gelap (form tetap kartu putih melayang dengan glow).
- Efek 3D di index.css: `.scene-3d` / `.card-3d` / `.card-3d-r` / `.animate-float` / `.lift-3d` / `.glow-blue` / `.shine-hover`.
- Area kerja tetap terang (pilihan user). PPT theme ikut biru (INDIGO='2563EB', DARK='0B1437').

### 13 Jun 2026 — Kalkulator Komisi TAP (build lulus)

- Menu `tap-commission` di sidebar (Creator & Seller), akses divisi tap + manajemen + owner/manajer.
- `DEFAULT_TAP_TIERS` 4 tier (0-50rb→agency 1%, -100rb→2%, -200rb→3%, -300rb→4%; minRaise 4/5/6/7, minAff 3).
- `computeTapCommission()`: affiliator = raise − agency. Status: <agency Tidak Layak / =agency Aff 0% / aff1 Kurang Menarik / aff2 Cukup / aff≥3 Ideal (+Layak jika raise≥minRaise); >300rb = warning (pakai tier tertinggi).
- 3 tab: Kalkulator (form + bar visual + nominal), Riwayat (tabel, simpan maks 500), Pengaturan Tier (owner/manajer/leader-tap).
- Keys baru di BACKUP_KEYS: `tap-commission:tiers`, `tap-commission:history`.

### 13 Jun 2026 — Ronde 4 (build lulus)

- **`syncInternalFromAccounts()`** (top-level): sinkron SEMUA tanggal akun affiliator → gmv:daily internal (menggantikan `syncInternalDivision` per-tanggal yang tidak backfill data lama). Dipanggil di load Dashboard/GmvView/AffiliateAccountsView + tiap save/delete entry akun.
- **"Tugas Tim" → "Tiket"** (sidebar, judul, tombol, quick action, notif).
- **Menu "Tugas Harian"** (`DailyTasksView`, keys daily-tasks:all + daily-tasks:log): checklist berulang harian — *dihapus lagi di Ronde 5*.
- Kartu Target Aktif dashboard = target GMV divisi bulan ini + target tim manual (sebelumnya 0 padahal gmv:targets terisi).
- **`InteractiveLineChart`** (hover/touch tooltip, garis target dashed, label tanggal) menggantikan MiniBarChart di Traffic Harian per Divisi.
- Responsif: tabel `overflow-x-auto`, grid collapse mobile, sidebar drawer mobile, chart viewBox + touch event.

### 14 Jun 2026 — Ronde 5 (dinihari, build lulus)

- **`InteractiveLineChart` multi-garis:** props `lines=[{label,color,series}]`, tooltip gabungan per tanggal. Dipakai di Dashboard Bisnis (3 garis divisi saat Keseluruhan; 1 garis + target saat per-divisi).
- **FITUR TUGAS HARIAN DIHAPUS** (DailyTasksView/Form, route, sidebar, backup keys) — user memilih Laporan Harian saja. Menu Laporan Harian PINDAH ke grup Operasional.
- **`exportBusinessPpt` ditulis ulang** (format owner 8 bagian): cover → 1 Ringkasan eksekutif → 2 Target vs Realisasi → 3 Perbandingan periode lalu → Rincian per divisi → 4 Pencapaian → 5 Aktivitas tim → 6 Masalah & Solusi (Fakta→Penyebab→Dampak→Solusi) → 7-8 Rencana + Keputusan owner otomatis.
- `analyzeBusiness` kini terima `tasks` + return `team{}`, `urgentProblems`, `resolvedInRange`, `targetOfDiv`, `expectedSoFar`. Problem `rootCause = {why1..why5, root, corrective, preventive}`.

### 14 Jun 2026 — Ronde 6 "menuju 10/10" (~12.070 baris, build lulus)

- **Jadwal (live/piket) DILEBUR ke Kalender Tim:** EVENT_TYPE + live/piket_admin/piket_grup, migrasi sekali jalan schedule:all → calendar:all (flag `calendar:schedule-migrated`, id `sch-`). ScheduleView/Form + route dihapus.
- **Laporan Mingguan "Buat dari Laporan Harian":** rangkum otomatis (aktivitas per hari, kendala, GMV & konten dijumlah), prefill ReportForm via prop `prefill`.
- **`FocusTodayWidget`** di Dashboard: top-3 prioritas/orang (tiket telat → deadline hari ini → akun GMV PIC belum input → laporan harian belum (≥jam 10) → masalah kritis → in-progress).
- **Menu "Kepuasan Mitra"** (`PartnerFeedbackView`, key partner-feedback:all): rating 1-5 seller/creator + catatan, ringkasan bln ini vs lalu, ≤2★ badge follow-up. Masuk `analyzeBusiness` (param partnerFeedback).
- **SWOT faktor EKSTERNAL manual** (key swot:external, ExternalSwotModal, owner/manajer, prefix [Eksternal], otomatis ke PPT).
- Insight masalah menua >7 hari; pengingat backup (banner amber Dashboard jika >7 hari/belum pernah, `backup:last`).
- "To-Do List" → "To-Do Pribadi". BACKUP_KEYS + partner-feedback:all, swot:external, backup:last.
- **Penilaian 7 prinsip user:** rata-rata 7,3/10. Gap utama (sebagian sudah ditutup ronde ini): kepuasan eksternal, prioritas harian, duplikasi modul. Gap fondasi teknis (data race kv_store & RLS permissive) belum.

### 14 Jun 2026 — Ronde 7: Akses & Izin / Gating Peran (~12.400 baris, build lulus)

- **Gating peran:** Tiket & Laporan Mingguan show role!=='operasional' + NoAccess guard; notif/quick-action tiket hanya pengelola; widget Masalah Aktif prop `showProblems` (staff hidden).
- **BusinessDashboard:** staff terkunci tab divisinya (`lockedDiv`), tanpa SWOT/PPT (`isMgmtUser`). **GmvView:** `myDiv` scoping (`visibleDivs`), owner/manajer/manajemen/keuangan = semua.
- **KPI v2.2:** punctuality 0 bila tak pernah absen (`hasData`); izin approved = kredit kehadiran 50% (param `leaves`), alpa = 0; laporan harian hanya dinilai bila ada form assigned (param `templates`, `reports.required`).
- **GForm rule:** `DailyReportFormDynamic` — staff tanpa myTemplates → modal blokir; dropdown hanya form miliknya.
- **Izin:** key leave-requests:all, config `izinHmin` (default H-1), `LeaveRequestModal` (izin/sakit — sakit boleh hari-H), panel "Izin Saya" + "Persetujuan Izin" (canDecideLeave), banner izin-hari-ini, notif bell tipe 'leave'.
- **Mobile absensi:** rekap dual-layout (kartu `md:hidden` + tabel `hidden md:block`), helper `renderRecDetail`.

### 14 Jun 2026 — Ronde 8 (build lulus)

- **Leader bisa kasih Tiket lintas-divisi:** `assignableUsers` leader = semua operasional + leader (dropdown label + divisi).
- **SWOT/Evaluasi per periode:** helper `periodPresets()` + komponen `PeriodPicker` (hari ini/kemarin/7hari/pekan ini-lalu/bulan ini-lalu/custom); state `swotPeriod`.
- **Absensi jam kerja per hari:** `DEFAULT_ATTENDANCE_CONFIG.perDay{enabled, days{0..6:{jamMasuk,jamPulang,libur}}}` default Sen-Jum 08-17 / Sabtu 08-15 / Minggu libur; `effectiveAttConfig(config,userId,dateObj)` resolusi per-user > perHari > default; `computeFlags` hormati libur. Editor jadwal per hari di AttendanceSettingsModal. Const `HARI_ID` ditambah.

### 14 Jun 2026 — PWA + Ikon (build lulus)

- App installable di HP (jalur internal). File baru di `public/`: manifest.webmanifest (display standalone, theme #2563EB), sw.js (network-first navigasi + cache-first aset hash, abaikan Supabase/CDN/font), ikon icon-192/512/maskable/apple-touch-icon (dibuat via PIL).
- index.html + link manifest, apple-touch-icon, meta apple/mobile-web-app-capable, viewport-fit=cover, registrasi `/sw.js`. Tanpa dep npm baru.
- **Ikon diganti:** crescent biru → KUBAH HIJAU latar hitam (gradient #4EBE3C→#217821). Regenerate semua ikon; favicon SVG ikut; cache SW v1→v2.

### 14 Jun 2026 — Filter tanggal absensi + Badge notif (build lulus)

- **Filter tanggal absensi:** state `filterDate`, input `type=date` + tombol "Hari ini"/"Semua" di Riwayat Absensi, ringkasan "X orang hadir pada <tanggal>" (`presentSummary`).
- **Badge notif ikon app:** `navigator.setAppBadge(unreadCount)`/`clearAppBadge` di TopBar. Catatan: badge hanya update saat app terbuka (belum ada push server).

### 15 Jun 2026 — Tiket akses ulang (build lulus)

- Tiket kini TERLIHAT semua role (sidebar show:true, NoAccess di TasksView dihapus; `canSeeTask` memfilter operasional ke tiket yang di-assign).
- Buat tiket hanya owner/leader/manajer (`can.createTasks` saja). Penerima HANYA bisa ubah STATUS (`canChangeStatus`), tidak bisa edit form/hapus.
- Status: todo/in_progress/done. Notif "Tugas baru untukmu" juga ke assignee operasional.
- FocusTodayWidget: tiket terlambat/deadline hari ini/in-progress tampil untuk SEMUA termasuk staff.

### 15 Jun 2026 — FIX BUG TIMEZONE (build lulus)

- **Akar masalah:** `new Date("YYYY-MM-DD")` dibaca UTC lalu digeser ke zona device → tanggal beda antar device (-1 hari di GMV & Laporan Harian).
- **Solusi terpusat:** helper `isDateOnly()` + `wibDayKey(ts)` (Intl en-CA timeZone Asia/Jakarta). `fmtDate`/`fmtDateTime`: tanggal-saja → parse `+'T00:00:00'`; timestamp → dipaksa `timeZone:'Asia/Jakarta'`.
- Semua `toISOString().split('T')[0]`/`.slice(0,10)` diganti `dayKey()`/`dayKey(X)` lokal. Absensi grouping/filter + analyzeBusiness pakai `wibDayKey(r.timestamp)`.
- Diuji dengan TZ=America/LA: date-only 2026-06-13 → "13 Jun 2026"; wibDayKey(UTC 14T23:30Z) → 2026-06-15.

### 15 Jun 2026 — QC + Laporan tabel + GCal OAuth (build lulus, dep baru `xlsx@0.18.5`)

- **Tiket QC:** TASK_STATUS + `qc` (Menunggu QC, amber); `done` jadi emerald. Penerima tidak bisa pilih 'done' langsung (`statusOptionsFor(t)`). `qcApprove`/`qcRevise` (prompt → in_progress + qcResult 'revisi'). Tombol Setujui/Revisi muncul saat status==='qc' & `canQC(t)`. Notif qc-wait/qc-rev/qc-ok.
- **Laporan Harian:** toggle `viewMode` Kartu/Tabel; tabel `reportsByTemplate` (group by templateName, kolom Nama sticky). **Export Excel** `exportExcel()` dynamic `import('xlsx')` (workbook multi-sheet). Tombol lama jadi "Download CSV".
- **Google Calendar OAuth (client-side, tanpa backend):** `GOOGLE_CLIENT_ID` dari env `VITE_GOOGLE_CLIENT_ID`, `loadGis()`, `getGcalToken()`, `addEventToGoogleCalendar(event)` (POST events?sendUpdates=all, WIB, attendees). EventForm checkbox + submit async dalam gesture klik. Panduan `PANDUAN-GOOGLE-CALENDAR.md`.
- **Bug kalender fix:** CalendarView optimistic update + polling 10 dtk (`setEvents0`).

### 17 Jun 2026 — Izin detail + Status Harian Tim (build lulus)

- **`LeaveDetailModal`** (komponen baru): detail izin lengkap + aksi Setujui/Tolak (`canDecide`) / Batalkan (`canCancel`). Baris "Izin Saya" & "Persetujuan Izin" jadi clickable.
- **Panel "Status Harian Tim"** (khusus `canSeeOthers`): date picker `boardDate` + tombol Hari ini; `dailyBoard` useMemo hitung per user status hadir/izin/libur/belum/belumabsen/alpa; ringkasan jumlah. Pakai `wibDayKey(r.timestamp)`.
- **FIX blank screen absensi:** `boardUsers`/`dailyBoard` useMemo sempat ditaruh SEBELUM `teamForFilter` & `fmtTime` → TDZ "Cannot access before initialization" → app blank (tidak ketangkap vite build). Solusi: pindah blok board ke SETELAH fmtTime. **Pelajaran:** urutan deklarasi const di single-file kritis.

### 18 Jun 2026 — FIX KRITIS DATA HILANG (build lulus)

- **Akar masalah:** `storage.get` lama RETURN null saat error Supabase → `getList` balikin `[]` → pola "baca→ubah→tulis" menimpa SELURUH array dengan data nyaris kosong saat koneksi ngadat = data hilang massal.
- **Solusi:** `storage.get` kini retry 3x (350/700/1050ms) lalu **MELEMPAR error** (bukan balikin null). `getList` meneruskan throw → fungsi simpan abort SEBELUM set → data lama aman.
- Wrap try/catch + alert "Gagal menyimpan, data lama tidak diubah" di saveEntry/deleteEntry GMV + handleSaveReport/handleDelete. Mount load dibungkus try/finally `setLoading(false)`.
- get yang throw otomatis melindungi SEMUA read-modify-write lain (abort, bukan overwrite); reads di view lain → state lama dipertahankan, self-heal di poll berikutnya.

### 18 Jun 2026 — Restore Gabung + Auto-Backup harian (build lulus)

- Top-level helpers: `buildBackupDump(byName)`, `autoBackupIfDue(byName)` (snapshot 1x/hari ke `backup:auto:<YYYY-MM-DD>`, index `backup:auto:index`, simpan maks `AUTO_BACKUP_KEEP=7`, prune), `mergeArraysById(current,backup)` (union by id, item SEKARANG menang), `applyMergeRestore(data)`.
- useEffect `autoBackupIfDue` saat login (1x/hari).
- **SettingsView:** tombol HIJAU "Pulihkan (Gabung) — Aman" (`doRestoreMerge`, owner+manajer) = pulihkan data hilang TANPA menghapus data baru; daftar Auto-Backup harian; restore TIMPA TOTAL dipindah ke `<details>` "Opsi lanjutan" (owner-only, berisiko).
- Diuji: backup[a,b] + current[b',c] → [a,b',c].

### 18 Jun 2026 — Backup ke Google Drive (build lulus 7.74s, tanpa dep baru)

- Konteks: alternatif rebuild ke Google/AppSheet ditolak (downgrade) → BOLT-ON Drive ke app yang ada. Pakai Client ID Google yang SAMA dengan Calendar, scope `drive.file` (non-sensitif, tak perlu verifikasi Google).
- Helper top-level: `GDRIVE_SCOPE`, `GDRIVE_FOLDER_NAME='Al-Kahfi Backup'`, `GDRIVE_BACKUP_KEEP=30`, `getDriveToken()`, `driveFindOrCreateFolder`, `driveUploadJson` (multipart/related), `drivePruneOld`, `backupToGoogleDrive(byName,{silent})`, `driveAutoBackupIfDue` (flag `drive:auto-backup`).
- **SettingsView:** kartu 'Backup ke Google Drive' — tombol manual + toggle Auto-Backup Harian + tampil backup terakhir. BACKUP_KEYS + `drive:auto-backup`, `backup:drive-last`; ikon Cloud/CloudUpload. Restore = download dari Drive → Pulihkan (Gabung). Panduan `PANDUAN-BACKUP-GOOGLE-DRIVE.md`.
- **Tahap 2 (belum):** foto selfie/bukti GMV ke Drive untuk hemat DB — butuh folder terpusat/endpoint (client-side OAuth = upload per-user berantakan).

### 18 Jun 2026 — Setup Google OAuth SELESAI (oleh user, dipandu via screenshot)

- Project Google Cloud "Al-Kahfi Team App", Calendar API + Drive API enabled, OAuth consent (External/Testing), Client ID Web (origin https://alkahficorp.vercel.app), test users digitalalkahfi@gmail.com + kholidfathh@gmail.com.
- `VITE_GOOGLE_CLIENT_ID` di-set di Vercel project `masjidaffiliate` (Production+Preview, Sensitive ON) + redeploy. Calendar auto-add JALAN; Backup Drive sempat 403 sampai Drive API di-enable.
- Vercel: akun kholidfathh-3494 (Hobby), project masjidaffiliate = alkahficorp.vercel.app.

### 18 Jun 2026 — Fix agenda kalender + Export absensi Excel (build lulus)

- **Fix agenda kalender masuk Google tapi tidak tersimpan di app:** akar — `handleSave` tidak cek hasil `storage.set` (return false diam-diam) + `EventForm.submit` panggil addEvent SEBELUM onSave dengan `confirm()` yang skip onSave bila Batal. Fix: `const ok = await storage.set(...)`; gagal → alert + revert + return; hapus confirm, Google jadi best-effort, `onSave(payload)` SELALU dipanggil.
- **Export Absensi → .xlsx asli:** `downloadRecap` dari CSV → `.xlsx` via dynamic `import('xlsx')`, 1 baris per orang per hari (group `wibDayKey|userId`). Fungsi baru `exportBoardExcel` untuk Status Harian Tim (semua anggota + status + jam + keterangan, file `Status-Harian-<tgl>.xlsx`). Pakai `ws['!cols']` untuk lebar kolom.

### 23 Jun 2026 — MODUL KEUANGAN (build lulus 5.74s)

- Dari brief tim keuangan + analisis "Rekup Al-Kahfi Corp.xlsx" (29 sheet). User memilih integrasi ke app (bukan Google Sheets/Looker).
- Komponen `KeuanganView` + helper `FinStat`/`FinBreakdown`/`FinanceInputModal`. Konsep: SEKALI input cash flow → otomatis ke Dashboard, Cash Flow, Laba Rugi.
- Data key tunggal `keuangan:cashflow` (array {id,tanggal,divisi,tipe,kategori,keterangan,jumlah,bukti...}), ditambah ke BACKUP_KEYS.
- `FIN_DIVISIONS` = {mcn,tap,affiliator,corp}; `FIN_CAT_IN` (6 kategori, 'Saldo Awal' dikecualikan dari pendapatan tapi ikut saldo kas via `finIsSaldoAwal`); `FIN_CAT_OUT` (14 kategori dari data riil).
- 3 tab: Dashboard (4 metrik + tren 6 bln + Posisi Kas per Divisi + breakdown kategori), Cash Flow (tabel running saldo + Export Excel + edit/hapus), Laba Rugi (otomatis per bulan per divisi). Filter divisi + navigasi bulan.
- **Akses:** feature flag `'finance'` di DIVISION_FEATURES (manajemen+keuangan) + owner/manajer auto; sidebar grup "Keuangan" (icon Wallet). `canManageFinance` = owner/manajer/divisi keuangan/manajemen. Import lucide + Wallet, Receipt.

### 23 Jun 2026 — MODUL KEUANGAN Ronde 2 (build lulus 5.04s)

- **Impor data historis:** parse 3 ledger Excel (Affiliate/MCN/TAP) jadi 421 transaksi. Tiap divisi diberi entri 'Saldo Awal' (2025-12-31, plug = saldo akhir − net flow) supaya saldo app = Excel persis: affiliator 31.399.942 / mcn 20.953.481 / tap 25.643.552 = total kas 77.996.975. 18 typo tanggal dibetulkan. Hasil = file restore JSON `keuangan-import-alkahfi.json` ({_meta,data:{'keuangan:cashflow':[...]}}) → user impor via Pengaturan App → Backup & Restore → "Pulihkan (Gabung)" SETELAH deploy code baru.
- **Analisis SWOT Keuangan:** `analyzeFinance(list)` (rule-based) + komponen `FinanceAnalysis` (dirender di bawah tab Dashboard, bukan tab terpisah). Skor kesehatan 0-100 (margin 30 / konsistensi-untung 20 / runway-kas 20 / tren-laba 15 / diversifikasi 15) → Sehat≥80 / Cukup Sehat≥60 / Perlu Perhatian≥40 / Kritis + SWOT 4 kuadran + rekomendasi. Bulan berjalan dikecualikan dari skor. Pada data impor: skor ~69 "Cukup Sehat", April 2026 rugi −31jt (deviden+komisi > pendapatan), Mei pulih.

### 24 Jun 2026 — STORAGE PER-RECORD (root fix data hilang)

Root fix lost-update (2+ orang absen barengan) + timpa-massal saat koneksi ngadat. Pola baru: tiap item = 1 baris ber-prefix, BUKAN satu array besar.

- **Tambahan di `storage`:** `listByPrefix(prefix)` (paginasi 1000 via `.range`, query `.like('key', prefix+'%')`, retry 3x lalu THROW) + `deleteByPrefix(prefix)`.
- **HOTFIX penting:** versi pertama pakai range `.gte/.lt` → di production baris TAK KETEMU (collation locale-aware: `:` vs `;` tidak urut ASCII) → absen tercatat tapi Riwayat kosong. Ganti ke `LIKE` → beres. **JANGAN balik ke range gte/lt untuk prefix di kv_store.**

Modul yang dikonversi:

- **Ronde 1 — Absensi** (`attendance:rec:`, `loadAttendanceRecs()`): serap/migrasi array lama `attendance:all` otomatis & idempoten (arsip ke `attendance:all:archived-v2`, hapus array lama hanya bila semua ter-migrasi). Writes doAbsen/saveEdit/deleteRecord/deleteAllRecords per-record. Reads di 3 lokasi (App load, KpiView, dashboard KPI). Backup: special-case `buildBackupDump` & `applyMergeRestore` → tetap kompatibel format array lama. Panduan `PANDUAN-ABSENSI-ANTI-HILANG.md`.
- **Ronde 2 — Laporan Harian** (`daily-reports:rec:`, `loadDailyReports`). Backup digeneralisasi: const `PER_RECORD_LOADERS` {key→loader} & `PER_RECORD_PREFIX` {key→prefix}; nambah modul cukup bikin loader + daftarkan di 2 map.
- **Ronde 3 — GMV** (`gmv:rec:` `loadGmvEntries` + `affiliate-gmv:rec:` `loadAffEntries`). `syncInternalFromAccounts` di-rewrite (forEach→for...of karena await; upsert divisi 'internal' per-record). `deleteAcct` cascade hapus tiap affiliate-gmv:rec milik akun.
- **Ronde 4 — Tiket / Izin / Kalender** sekaligus: `tasks:rec:` (patchTask/handleAddComment via `storage.get` 1 baris + set); `leave-requests:rec:` (submit/cancel/decide per-record); `calendar:rec:` (handleSave/handleDelete optimistic + `migrateOldSchedule` nulis `sch-<id>` per-record).

Hasil: SEMUA modul array rawan-tabrakan kini per-record (absensi, laporan harian, GMV divisi, GMV akun, tiket, izin, kalender). Sisa array yang SENGAJA dibiarkan (low-risk): affiliate-accounts:all, creators:all, sellers:all, targets:all, problems:all, announcements:all, partner-feedback:all, content-ideas:all, daily-report-templates:all, todos:all, keuangan:cashflow, feedback:all, activities:all, gmv:targets.

### 24 Jun 2026 — Egress over-kuota + optimasi (build 5.18s)

- Cek usage Supabase (org kholidfathh; project 'kahfiteam' NANO = live). DATABASE 77MB/500MB (aman), tapi **EGRESS 8.91GB / 5GB → LEWAT KUOTA**, grace period s/d 23 Jul 2026 lalu di-restrict.
- **Akar:** polling tarik-ulang data terus — `loadNotifs` (TopBar global always-on) tiap 12s + tiap view poll 10-15s.
- **Fix (optimasi kode, gratis):** loadNotifs 12s→60s; SEMUA `setInterval(load)` per-view 10/12/15s→30s; calendar setEvents0 10s→30s (total 13 interval).
- **Langkah lanjutan bila masih mepet:** foto profil (`avatarImage` base64 inline di users:list) + bukti GMV/lampiran laporan base64 → pindah ke Supabase Storage/on-demand. Angka billing kumulatif, laju naik melambat.

### 24 Jun 2026 — Google Calendar TERPUSAT (build 5.23s)

- **Keluhan:** karyawan selalu diminta "hubungkan ke Google" (`addGcal` default true → tiap pengelola dipaksa OAuth akun sendiri). User mau HANYA akun pusat Kholidfath yang connect.
- **Solusi:** jembatan Apps Script Web App (jalan sebagai akun pusat) — client-side tak bisa pakai akun lain dari browser orang lain.
- **Kode:** const `GCAL_ENDPOINT`/`GCAL_SECRET` (env `VITE_GCAL_ENDPOINT`/`VITE_GCAL_SECRET`); `addEventToGoogleCalendar` ditulis ulang → POST `no-cors` text/plain ke endpoint (tidak lagi OAuth per-user). EventForm `gcalReady` pakai GCAL_ENDPOINT, submit silent best-effort, checkbox "Tambahkan ke Google Calendar tim". EventDetailModal di-gate `GCAL_ENDPOINT && canManageCalendar(user)`.
- Drive backup TETAP pakai GOOGLE_CLIENT_ID OAuth per-user (tak berubah).
- **File baru:** `AppsScript-GCal-Bridge.gs` (doPost → CalendarApp.getDefaultCalendar().createEvent, cek SECRET, guests+sendInvites, WIB +07:00, doGet ping) + `PANDUAN-GOOGLE-CALENDAR-PUSAT.md`.
- Setelah deploy code (tanpa setup Apps Script pun), prompt Google karyawan SUDAH hilang; agenda tetap sinkron in-app.

### 24 Jun 2026 — FIX BUG KALENDER "agenda lama hilang saat tambah agenda baru" (build 4.96s)

- **Akar:** `editing` di CalendarView punya 2 makna — (a) agenda yang sedang diedit (punya id), (b) prefill tanggal saat klik sel = `{date}` TANPA id. `handleSave` lama tentukan baru-vs-edit dari truthy (`const isNew = !editing`) → agenda hasil klik sel masuk jalur edit → `rec` tanpa id → `storage.set('calendar:rec:undefined', rec)`. Agenda berikutnya via klik sel menimpa key yang SAMA → yang pertama hilang. (Muncul setelah konversi kalender per-record Ronde 4.)
- **Fix:** `const isNew = !(editing && editing.id)` (penentu dari ada-tidaknya id) + branch new/edit & optimistic dibalik mengikutinya. Self-heal di `loadCalendar`: record tanpa id (key rusak `calendar:rec:undefined`) otomatis diberi id baru, dipindah, key rusak dihapus (idempoten).
- **Pelajaran:** hati-hati state dipakai ganda (prefill vs entity); kunci per-record HARUS dari id yang dijamin ada.

---

## 4. Status Terkini (per 24 Jun 2026)

- App live & dipakai harian. Build terakhir lulus (~4.96–5.23s), ~12.400+ baris.
- Seluruh modul array rawan-tabrakan sudah per-record → data hilang massal teratasi di akar.
- Backup berlapis: manual + auto-backup harian (7 hari) + Google Drive (30 file) + Restore Gabung (aman).
- Google Calendar terpusat (akun Kholidfath), tanpa prompt OAuth ke karyawan.
- Modul Keuangan lengkap (cash flow, laba rugi, dashboard, SWOT) + data historis 421 transaksi siap diimpor.
- PWA installable, ikon kubah hijau, badge notif (saat app terbuka).
- **Perhatian aktif:** EGRESS Supabase over-kuota — sudah dioptimasi (polling 30-60s), grace period s/d **23 Jul 2026**. Pantau beberapa hari; bila masih mepet, pindahkan foto base64 ke Storage.

---

## 5. Backlog Tersisa

- Harden `handleDelete` kalender (cek `storage.set` seperti handleSave).
- Foto selfie/bukti GMV → Google Drive/Supabase Storage (tahap 2, kurangi base64 di DB — terkait egress).
- Command Palette (Cmd+K), loading skeleton.
- Supabase Auth + RLS (saat ini publishable key + RLS permissive).
- Push notification beneran (Web Push + VAPID + server, mis. Supabase Edge Function) — muncul saat app ditutup.
- Publish OAuth consent screen (saat ini Testing).
- Neraca penuh keuangan (baru ada Posisi Kas per divisi); leader divisi belum bisa lihat angka divisinya (sengaja, sensitif).

---

## 6. Deploy & Verifikasi

**Alur deploy:** edit `src/App.jsx` → GitHub Desktop commit ke `main` → push → Vercel auto-deploy → hard refresh.

**File yang ikut commit selain App.jsx (sesuai perubahan):**

- `package.json` + `package-lock.json` — bila ada dep baru (mis. xlsx@0.18.5).
- `index.css` — hanya bila CSS berubah.
- Panduan/file pendukung: `PANDUAN-GOOGLE-CALENDAR.md`, `PANDUAN-BACKUP-GOOGLE-DRIVE.md`, `PANDUAN-GOOGLE-CALENDAR-PUSAT.md`, `PANDUAN-ABSENSI-ANTI-HILANG.md`, `AppsScript-GCal-Bridge.gs`.

**Verifikasi build:** `npx vite build --outDir /tmp/dist-verif --emptyOutDir` (rm di mount sering ditolak). Pastikan brace/bracket balance = 0, 0 sisa pola array-write lama untuk key yang sudah per-record.

**Sebelum deploy besar:** backup dulu (Pengaturan App → Backup & Restore) → push → hard refresh (migrasi per-record jalan otomatis & idempoten).

> Catatan: `node_modules` & `dist` di-ignore (.gitignore); Vercel `npm install` otomatis. Konteks lengkap tambahan ada di `CONTEXT.md` milik user.
