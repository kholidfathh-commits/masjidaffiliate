# PROMPT FITUR LMS BARU — Satu Prompt Lengkap

Paste seluruh blok di bawah ke Claude Code, atau cukup ketik: *"Baca PROMPT-FITUR-LMS.md dan kerjakan."*

Sebelum mulai: backup dulu lewat app → Pengaturan App → Backup & Restore.

---

```
Baca dulu CLAUDE.md dan PANDUAN-LMS.md sebelum menyentuh kode. Patuhi semua ATURAN WAJIB
di sana, terutama: hemat egress, pola per-record kv_store, prefix tidak boleh mengandung '_',
setiap key baru masuk BACKUP_KEYS + PER_RECORD_LOADERS + PER_RECORD_PREFIX, file src/lms/
ditulis DULU dan App.jsx PALING AKHIR, bahasa UI Indonesia.

TUGAS BESAR: 3 fitur LMS baru. Kerjakan BERURUTAN sebagai Tahap 1 → 2 → 3. Setelah tiap
tahap: jalankan `npx vite build --outDir /tmp/dist-verif --emptyOutDir` dan `node uji-lms.mjs`,
keduanya harus lulus sebelum lanjut ke tahap berikutnya (Jidoka: kalau gagal, perbaiki dulu).
Tahap 3 memakai komponen dari Tahap 2, jadi urutan tidak boleh ditukar.

════════════════════════════════════════════════════════
TAHAP 1 — LABEL WAJIB / SUNNAH / MUBAH PADA KURSUS
════════════════════════════════════════════════════════

1. Di src/lms/data.js tambahkan:
   export const COURSE_PRIORITY = {
     wajib:  { label: 'Wajib',  color: 'bg-blue-100 text-blue-800',       desc: 'Harus diselesaikan (onboarding)' },
     sunnah: { label: 'Sunnah', color: 'bg-emerald-100 text-emerald-800', desc: 'Sangat dianjurkan' },
     mubah:  { label: 'Mubah',  color: 'bg-slate-100 text-slate-700',     desc: 'Boleh dipelajari bila perlu' },
   };
2. Di form kursus (CourseBuilder di LearningAdmin.jsx) tambahkan pilihan "Prioritas Kursus"
   (3 pilihan di atas, tampilkan desc-nya). Default: wajib. Simpan sebagai field `priority`.
3. Kompatibilitas mundur: kursus lama tanpa field priority DIANGGAP 'wajib' di semua
   tampilan. Jangan migrasi data — cukup fallback saat membaca.
4. Tampilkan badge prioritas (pakai LmsBadge yang sudah ada) di: daftar kursus admin
   (KursusTab), pemilih kursus di builder Jalur Belajar, kartu kursus di MyLearning.jsx,
   dan header kursus di CoursePlayer.jsx.
5. Saat admin menambahkan kursus ke Jalur Belajar, nilai default `required` pada entry
   jalur mengikuti prioritas: wajib → true, sunnah/mubah → false. Admin tetap bisa
   mengubahnya manual seperti sekarang.
6. JANGAN mengubah mesin progress (computeCourseProgress / computePathProgress /
   isLessonDone). Label ini metadata tampilan + nilai default saja.

════════════════════════════════════════════════════════
TAHAP 2 — MATERI PDF (UPLOAD + % DIBACA) & VIDEO YOUTUBE (% DITONTON)
════════════════════════════════════════════════════════

── A. Infrastruktur upload file ──
1. Di App.jsx sudah ada `putImage` (upload ke bucket Storage 'photos', CDN publik,
   cache 1 tahun). Buat fungsi serupa `putFile(blob, { folder, contentType })` yang
   meng-upload Blob apa adanya (bukan base64) ke bucket yang sama, folder 'lms-pdf/',
   nama file = id acak + '.pdf', cacheControl '31536000', kembalikan URL publik.
   TANPA fallback ke database (PDF terlalu besar untuk kv_store). Kalau bucket belum
   siap, lempar error jelas: "Bucket Storage belum siap — jalankan supabase-storage-setup.sql".
2. Suntikkan lewat initLms() sebagai `putFile`, ekspor dari data.js sebagai `lmsPutFile`
   (ikuti pola lmsPutImage).

── B. Tipe materi baru: pdf ──
3. Tambah di LESSON_TYPES: pdf → { label: 'Bacaan PDF', icon: 'FileText' }.
4. Di editor materi (LearningAdmin.jsx): kalau tipe pdf, tampilkan input upload file.
   Validasi: application/pdf, maksimal 20 MB. Simpan di lesson: pdfUrl, pdfName, pdfSize.
   Ada tombol ganti file. Materi video/dokumen lama tidak berubah.
5. Di CoursePlayer.jsx: render PDF DI DALAM aplikasi memakai pdfjs-dist (dependency baru;
   import secara dynamic/lazy HANYA saat materi pdf dibuka supaya bundle utama tidak
   membengkak). Tampilan: satu halaman per layar di canvas, lebar menyesuaikan container
   (aman di HP), tombol Sebelumnya/Berikutnya + "Halaman X dari Y".
6. Pelacakan baca: kumpulkan nomor halaman unik yang pernah dibuka (Set).
   persen = halaman dibuka / total halaman × 100 (bulatkan). Persen 100 → otomatis selesai.

── C. Video YouTube di dalam aplikasi ──
7. Saat ini materi video hanya tombol "Buka Video" (tab baru, tanpa pelacakan). Ubah:
   kalau videoUrl adalah link YouTube (dukung watch?v=, youtu.be/, shorts/, embed/),
   tampilkan player embed memakai YouTube IFrame API (script dimuat sekali, on-demand).
   Kalau BUKAN YouTube (mis. Google Drive), pertahankan perilaku lama persis.
8. Pelacakan tonton: selama playing, catat detik tontonan maksimum (monotonik, tidak
   turun saat mundur). persen = detikMaks / durasi × 100. Persen ≥ 90 → otomatis selesai
   (simpan sebagai 100).

── D. Penyimpanan progress — BAGIAN PALING KRITIS ──
9. Pakai record progress yang SUDAH ADA (lms:progress:rec:<userId>:<lessonId>, key
   deterministik). Tambah field: percent (0–100), done (boolean), detail
   ({ lastPage, pagesViewed } untuk pdf / { maxSeconds, duration } untuk video), updatedAt.
   JANGAN buat prefix baru untuk ini.
10. KOMPATIBILITAS MUNDUR — WAJIB: selama ini "ada record progress" = selesai. Sekarang
    record bisa berisi progress parsial. Kontrak baru:
    - Record LAMA tanpa field `done` → tetap dianggap SELESAI (jangan rusak data lama).
    - Record BARU → selesai hanya jika done === true.
    Sesuaikan buildCtx() di data.js: progressSet hanya berisi lessonId yang selesai
    menurut aturan ini. isLessonDone tidak perlu tahu bedanya.
11. HEMAT EGRESS — aturan tulis: simpan record parsial HANYA saat (a) pertama kali
    persen > 0, (b) persen naik ≥ 10 poin sejak simpanan terakhir, (c) saat selesai,
    (d) saat user meninggalkan materi dan ada perubahan belum tersimpan.
    JANGAN menulis tiap detik/interval. JANGAN menambah polling baca.
12. Tombol "Tandai Selesai" manual TETAP ADA untuk semua tipe (jalan keluar kalau player
    bermasalah). Menekannya menyimpan { percent: 100, done: true }.

── E. Tampilan persen ──
13. Di CoursePlayer: materi pdf/video yang berjalan menampilkan badge kecil "Dibaca X%" /
    "Ditonton X%". Di outline daftar materi, materi dengan 0 < persen < 100 menampilkan
    angka persen kecil di samping judulnya.

── F. Pengujian & dokumentasi ──
14. Perbarui uji-lms.mjs, tambah kasus: record lama tanpa `done` dihitung selesai;
    record parsial (done false, percent 40) TIDAK selesai; record done true selesai;
    tipe pdf berperilaku seperti tipe konten di isLessonDone.
15. Perbarui PANDUAN-LMS.md: tipe materi baru, aturan selesai baru, aturan tulis progress.

════════════════════════════════════════════════════════
TAHAP 3 — MODUL BACAAN (PERPUSTAKAAN, SIFATNYA SUNNAH)
════════════════════════════════════════════════════════

Fitur "Modul Bacaan": perpustakaan internal yang bisa dibuka karyawan bolak-balik kapan
saja (contoh isi: Buku Hook, Sejarah Al-Kahfi Corp, panduan kerja). Sifatnya SUNNAH:
tidak wajib, TANPA enrollment, TANPA progress, tidak mempengaruhi persen jalur mana pun.

── A. Data (ikuti persis "Cara menambah data LMS baru" di PANDUAN-LMS.md bag. 3) ──
1. Prefix baru di data.js:
   - lms:library:rec:<id>  → metadata modul bacaan
   - lms:library:body:<id> → isi teks (dipisah agar tidak ikut tertarik saat memuat
     daftar — tiru pola lms:lesson:body:)
2. Record metadata: { id, title, description, category, type: 'pdf'|'text', pdfUrl,
   pdfName, status: 'draft'|'published', order, createdAt, createdById, createdByName,
   updatedAt }.
3. Loader: loadLmsLibrary() + loadLibraryBody(id) on-demand dengan cache per sesi (tiru
   loadLessonBody, termasuk MELEMPAR error saat gagal baca — jangan kembalikan string kosong).
4. Backup — WAJIB: tambah 'lms:library:all' dan 'lms:library-bodies:all' ke
   LMS_BACKUP_KEYS; daftarkan keduanya di App.jsx pada PER_RECORD_LOADERS dan
   PER_RECORD_PREFIX; 'lms:library-bodies:all' masuk HEAVY_BACKUP_KEYS (sama seperti
   lms:lesson-bodies:all).

── B. Admin (LearningAdmin.jsx) ──
5. Tambah tab ke-5 "Modul Bacaan" (icon Library/BookMarked, tampilkan jumlah).
6. Isi tab: daftar modul + tombol "Modul Baru" → modal form: judul (wajib), deskripsi
   singkat, kategori (teks bebas, mis. "Panduan Hook", "Sejarah"), jenis isi: upload PDF
   (pakai lmsPutFile, validasi pdf ≤ 20 MB) ATAU teks panjang (textarea, disimpan ke
   lms:library:body: saat Simpan). Tombol Terbitkan/Jadikan Draft, Edit, Hapus
   (konfirmasi; hapus juga body-nya).

── C. Karyawan (MyLearning.jsx) ──
7. Tambah bagian "Modul Bacaan" di bawah daftar jalur belajar, dengan keterangan:
   "Sunnah — bacaan bebas, tidak mempengaruhi progres belajar Anda."
8. Tampilkan HANYA yang published, urut berdasarkan order. Kartu: judul, kategori (badge),
   deskripsi singkat, ikon jenis. Ada input cari (filter judul + kategori, sisi klien).
9. Klik kartu → pembaca: tipe pdf pakai komponen PDF viewer dari Tahap 2 TANPA menulis
   progress apa pun; tipe text render body (whitespace-pre-wrap, gaya sama dengan materi
   teks kursus). Tombol kembali ke daftar.
10. Ingat halaman terakhir dibaca per modul di localStorage (key: 'lms-lib-lastpage:<id>')
    supaya enak dibuka bolak-balik — JANGAN simpan ke database.
11. Data dimuat SEKALI saat halaman dibuka + ikut tombol Muat Ulang yang ada. Tanpa
    polling. Isi (body/PDF) dimuat on-demand per modul yang dibuka.
12. Perbarui tabel model data + daftar file di PANDUAN-LMS.md.

════════════════════════════════════════════════════════
VERIFIKASI AKHIR (setelah ketiga tahap selesai)
════════════════════════════════════════════════════════

- npx vite build --outDir /tmp/dist-verif --emptyOutDir → lulus.
- node uji-lms.mjs → lulus semua, termasuk kasus baru.
- Laporkan checklist manual ini ke saya untuk saya cek sendiri di app:
  1. Kursus baru berlabel Sunnah → badge muncul di 4 tempat → masuk jalur otomatis opsional.
  2. Upload PDF 3+ halaman → buka sebagai karyawan → persen naik per halaman → halaman
     terakhir → otomatis Selesai.
  3. Video YouTube → tonton ≥90% → otomatis Selesai. Video Google Drive → perilaku lama.
  4. Materi lama yang sudah selesai TETAP selesai (data lama tidak rusak).
  5. Admin buat modul bacaan PDF + teks → draft tidak terlihat karyawan → terbitkan →
     muncul di Pembelajaran Saya → halaman terakhir diingat → persen jalur TIDAK berubah.
  6. Backup di Pengaturan App memuat kedua key library baru. Tampilan HP tidak meluber.

BATASAN UMUM: Jangan ubah logika kuis/tugas praktik/validasi kompetensi. Jangan tambah
polling. Jangan simpan file PDF ke kv_store. Jangan membuat enrollment/progress untuk
modul bacaan. Jangan sentuh fitur di luar LMS.
```
