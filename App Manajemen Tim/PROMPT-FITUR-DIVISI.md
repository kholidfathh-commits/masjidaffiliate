# PROMPT — Fitur "Divisi" (Review per Divisi) + Sinkron Struktur 2026-2029

> Salin seluruh isi di bawah garis ini ke sesi coding (Claude Code).

---

Baca dulu `CLAUDE.md` dan `App Manajemen Tim/progress.MD` sebelum mengubah kode. Semua ATURAN WAJIB di CLAUDE.md berlaku. Balas dan narasikan dalam Bahasa Indonesia.

## Tujuan

Aplikasi ini datanya per divisi tersebar di banyak menu (Tiket, Laporan Harian, Target & GMV, Kalender, Masalah & Solusi). Buat SATU halaman baru bernama **"Divisi"** yang merangkum kondisi tiap divisi secara utuh: siapa anggotanya, apa yang sudah dan sedang dikerjakan, rencana ke depan, dan kendalanya. Sekaligus samakan daftar divisi dengan struktur organisasi Al-Kahfi Corp 2026-2029.

Kerjakan dalam 3 bagian, urut.

---

## BAGIAN 1 — Sinkron daftar divisi dengan struktur 2026-2029

Struktur resmi: Dewan Direksi (Aditya) → CEO (Azka) → Manager (Kholid), didampingi Keuangan (Camelia) dan Sekretariat (Alma). Di bawah Manager ada 5 leader divisi: Mabit Scholar (Agung), MCN (Ardiansyah), TAP (Fajar), MMC (Najib, membawahi volunteer), Affiliator (Siti).

Perubahan pada `DIVISIONS`:

1. **Hapus `media`** ("Media & Creative") dari `DIVISIONS`, `DIVISION_FEATURES`, dan `LEADER_DIV_SHORT`. Divisi ini sudah tidak ada.
   - **Anti-crash wajib:** masih mungkin ada user lama dengan `division: 'media'`. Semua lookup label divisi harus pakai fallback aman (mis. helper `divLabel(key)` yang mengembalikan `DIVISIONS[key]?.label || 'Divisi Lama (pindahkan)'`). Jangan biarkan `DIVISIONS[div].label` langsung pada key yang bisa hilang → blank screen.
   - Di halaman **Anggota Tim**, kalau owner/manajer dan masih ada anggota berdivisi `media`, tampilkan banner kecil: "X anggota masih di divisi lama — ubah divisinya lewat tombol Edit."
2. **Relabel `event` → "MMC (Malam Mabit Cuan)"**. Key internal TETAP `'event'` supaya nol migrasi data. Beri komentar di kode: `// key 'event' = divisi MMC (Malam Mabit Cuan) — kegiatan rutin 2 pekan sekali di Masjid Affiliate untuk pembelajaran affiliate`. Di `LEADER_DIV_SHORT`: `event: 'MMC'`.
3. Divisi lain tetap: `manajemen` (menampung CEO, Manager, Sekretariat, Dewan Direksi), `keuangan`, `mabit` (Mabit Scholar), `mcn`, `tap`, `internal` (Affiliator Internal).
4. Urutan tampil di semua dropdown/filter divisi: Manajemen, Keuangan, Mabit Scholar, MCN, TAP, MMC (Malam Mabit Cuan), Affiliator Internal.
5. JANGAN sentuh `GMV_DIVISIONS` (mcn/tap/internal) — biarkan apa adanya.

## BAGIAN 2 — Modul data baru: Rencana Divisi

Modul array per-record baru dengan prefix `divplan:` (ikuti pola modul per-record yang sudah ada, mis. tasks):

- Ikuti pola modul per-record yang ada: key virtual `division-plans:all` → buat loader `loadDivisionPlans`, daftarkan `'division-plans:all': loadDivisionPlans` di `PER_RECORD_LOADERS`, `'division-plans:all': 'divplan:'` di `PER_RECORD_PREFIX`, dan **tambahkan `'division-plans:all'` ke `BACKUP_KEYS`** (wajib — kalau tidak, data tak ikut backup).
- Baca prefix di kv_store **WAJIB pakai `LIKE`**, jangan range `gte/lt` (aturan CLAUDE.md #5).
- Field per rencana: `id`, `division` (key divisi), `title` (wajib), `detail` (opsional), `target` (indikator keberhasilan, opsional), `picId` + `picName` (opsional, dipilih dari anggota divisi tsb), `dueDate` (opsional), `status` (`rencana` | `berjalan` | `selesai` | `batal`, default `rencana`), `createdById`, `createdByName`, `createdAt`, `updatedAt`, `doneAt` (diisi saat status jadi `selesai`).
- Hak tulis (tambah/edit/hapus/ubah status): owner & manajer untuk semua divisi; leader hanya untuk divisinya sendiri. Role operasional tidak punya akses tulis maupun baca (mereka tidak melihat halaman ini).

## BAGIAN 3 — Halaman baru "Divisi" (view id: `division-review`)

**Menu sidebar:** grup "Utama", tepat di bawah Dashboard. Label "Divisi", icon lucide `Network` atau `Building2`. `show:` hanya owner, manajer, dan leader. Kalau user operasional membuka view ini (mis. sisa state), redirect ke dashboard.

**Hak akses isi halaman:**
- Owner & manajer: melihat SEMUA divisi, ada switcher divisi (tab pill atau dropdown) di atas halaman.
- Leader: otomatis terkunci ke divisinya sendiri, tanpa switcher.

**Filter periode** di header halaman: pakai komponen **`DateRangePopover`** yang sudah ada (dipakai di 9+ titik; props `value/onChange/tabs/defaultTab/maxDate/showPresets`). Default: Bulan Ini.

**Pemuatan data:** ikuti pola view lain — modul per-record lewat loader (`loadTasks()`, `loadAttendanceRecs()`, `loadDailyReports()`, `loadGmvEntries()`, `loadCalendar()`), modul array lewat `storage.getList('problems:all')` / `storage.getList('users:list')`. Polling refresh `setInterval(pollWhenVisible(load), 30000)` — JANGAN interval lebih rapat (hemat egress Supabase).

**Definisi "anggota divisi":** `allUsers.filter(u => (u.division || 'internal') === div)`. Leader divisi = user role `leader` di divisi tsb.

**Susunan halaman (atas ke bawah):**

1. **Header divisi** — nama divisi, `Avatar` + nama leader, jumlah anggota.
2. **Kartu ringkasan** (4–5 kartu kecil): jumlah anggota · tiket selesai (periode, pakai `completedAt`) · tiket berjalan (todo/in_progress/qc) · laporan harian masuk (periode) · GMV periode (HANYA untuk divisi mcn/tap/internal, dari `gmvEntries` filter `e.division` + rentang `e.date`; sembunyikan kartu ini untuk divisi lain).
3. **Anggota** — grid kartu kecil per anggota: `Avatar`, nama, jabatan (`displayJobTitle`), badge role, dan status absensi HARI INI: hadir = ada record absensi `type === 'in'` dengan `wibDayKey(rec.timestamp)` === hari ini; kalau ada izin approved di `leave-requests` hari ini tampilkan "izin".
4. **Sedang dikerjakan** — tiket status todo/in_progress/qc yang `assigneeId`-nya anggota divisi: judul, `assigneeName`, `deadline` (merah jika lewat), badge `TASK_STATUS`. Ditambah agenda kalender 7 hari ke depan yang `attendeeIds`-nya memuat anggota divisi atau `createdById` anggota divisi.
5. **Sudah dilakukan (periode terpilih)** — tiga blok ringkas: tiket `done` dalam periode (`completedAt`, judul, PIC) · masalah `status === 'resolved'` dalam periode (`resolvedAt`) · 5 laporan harian terakhir anggota divisi. PENTING: laporan harian punya 2 format — legacy (field langsung `r.activities`/`r.results`) dan template (`r.fieldsSnapshot` array `{id,label,type,value}`). Sudah ada pola pembacanya (`fieldsOf(r)` di fitur "Buat dari Laporan Harian" ReportsView) — angkat jadi helper bersama, jangan tulis parser baru. Cuplikan potong ±120 karakter.
6. **Rencana ke depan** — daftar Rencana Divisi (Bagian 2), urut: status `berjalan` dulu, lalu `rencana`, lalu berdasarkan `dueDate` terdekat; `selesai`/`batal` masuk bagian riwayat yang bisa dilipat (collapse). Tombol "+ Rencana" hanya untuk yang berhak. Empty state: ajakan mengisi rencana divisi.
7. **Kendala aktif** — masalah dengan `status !== 'resolved'` dan `p.division === div` (record masalah PUNYA field `division` sendiri — jangan filter lewat pelapor). Tampilkan badge urgency + nama pelapor.

**Aturan UI (wajib, dari CLAUDE.md):** warna gelap/gradient pakai inline `style={{}}` bukan `bg-[#hex]`; semua modal via `createPortal` ke body, animasi opacity-only; perhatikan urutan deklarasi const (TDZ) karena single-file; komponen baru tetap di `src/App.jsx`.

## Referensi struktur data (SUDAH DIVERIFIKASI dari kode — pakai nama field ini)

- **User** (`users:list`): `{id, name, role: owner|manajer|leader|operasional, division, leaderId, jobTitle, isSecretariat, avatarImage}` — render foto pakai komponen `Avatar`.
- **Tiket** (loader `loadTasks`, prefix `tasks:rec:`): `{id, title, assigneeId, assigneeName, createdById, createdByName, status: todo|in_progress|qc|done, deadline, completedAt, qcSubmittedAt, comments[]}`.
- **Absensi** (loader `loadAttendanceRecs`, prefix `attendance:rec:`): `{id, userId, userName, division, type: 'in'|'out', timestamp(ISO)}` — pengelompokan tanggal WAJIB `wibDayKey(timestamp)`.
- **Laporan harian** (loader `loadDailyReports`, prefix `daily-reports:rec:`): `{id, date, authorId, authorName, templateId, templateName, fieldsSnapshot[]?}` + kemungkinan field legacy langsung (`activities`, `results`, `blockers`, `nextDayPlan`).
- **GMV** (loader `loadGmvEntries`, prefix `gmv:rec:`): `{id, division: mcn|tap|internal, date: 'YYYY-MM-DD', gmv, autoSynced?}`.
- **Kalender** (loader `loadCalendar`, prefix `calendar:rec:`): `{id, title, date, type, attendeeIds[], attendeeNames[], createdById}`.
- **Masalah** (`storage.getList('problems:all')`): `{id, title, division, urgency, status: 'open'|...|'resolved', reportedById, reportedByName, createdAt, resolvedAt, rootCause{why1..why5, root, corrective, preventive}}` — filter per divisi pakai `p.division`; render label divisi WAJIB dengan guard `DIVISIONS[p.division] &&` (pola sudah ada di ProblemsView baris ±8097, penting karena divisi `media` akan dihapus).
- **Izin** (loader `loadLeaves`, prefix `leave-requests:rec:`): `{id, userId, type: izin|sakit, date, status: pending|approved|...}`.

---

## Verifikasi sebelum dianggap selesai

1. `npx vite build --outDir /tmp/dist-verif --emptyOutDir` lulus, brace/bracket balance 0.
2. App tidak blank. Uji per role: owner/manajer melihat menu Divisi + bisa ganti-ganti divisi; leader hanya divisinya; operasional TIDAK melihat menu.
3. User lama berdivisi `media` tidak membuat crash di halaman manapun (Anggota Tim, Dashboard, KPI, dsb.) — label fallback tampil.
4. Rencana Divisi: tambah → muncul; ikut ter-backup (cek fitur Backup & Restore menyertakan `divplan:`); edit oleh leader divisi lain DITOLAK.
5. Label "MMC (Malam Mabit Cuan)" tampil konsisten di semua dropdown/filter/kartu.
6. Update `App Manajemen Tim/progress.MD`: catat fitur baru, key data baru, dan keputusan (media dihapus, event = MMC).

Sebelum deploy besar: ingatkan user backup dulu via Pengaturan App → Backup & Restore.
