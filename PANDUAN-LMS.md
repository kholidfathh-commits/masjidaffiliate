# PANDUAN LMS (Pembelajaran) — Al-Kahfi Team App

Dokumentasi developer untuk modul LMS V1. Ringkas saja; detail teknis app induk tetap
di `CLAUDE.md` dan `App Manajemen Tim/progress.MD`.

---

## 1. Apa ini

Modul pembelajaran internal: karyawan baru otomatis mendapat jalur belajar sesuai
divisi/jabatan, belajar mandiri, dikuis, mengerjakan tugas praktik, direview leader,
lalu divalidasi kompeten.

**Letak kode:** `src/lms/` (7 file). `src/App.jsx` hanya disentuh di 9 titik integrasi.

| File | Isi |
|---|---|
| `data.js` | Lapisan data, mesin progress, auto-enrollment, penilaian kuis. Tanpa JSX. |
| `ui.jsx` | Komponen UI bersama (kartu, badge, progress bar, modal, form). |
| `MyLearning.jsx` | Halaman karyawan + pemilik state alur belajar. |
| `CoursePlayer.jsx` | Pemutar kursus: materi, PDF, video YouTube, kuis, tugas praktik. |
| `PdfReader.jsx` | Pembaca PDF di dalam app (pdfjs-dist di-import dinamis). Dipakai kursus & modul bacaan. |
| `TeamLearning.jsx` | Halaman leader: progres tim, review tugas, validasi kompetensi. |
| `LearningAdmin.jsx` | Halaman owner/manajer: ringkasan, course builder, jalur belajar, peserta. |

---

## 2. Model data

Tidak ada tabel baru. Semua tetap di `kv_store`, pola **per-record** (1 record = 1 baris).

| Prefix baris | Isi |
|---|---|
| `lms:path:rec:<id>` | Jalur belajar + daftar kursus + target divisi/jabatan |
| `lms:course:rec:<id>` | Kursus + modul + materi (metadata, termasuk soal kuis) |
| `lms:lesson:body:<lessonId>` | **Isi materi** (dipisah supaya tidak ikut tertarik saat memuat daftar) |
| `lms:enroll:rec:<userId>:<pathId>` | Pendaftaran jalur belajar |
| `lms:progress:rec:<userId>:<lessonId>` | Penyelesaian materi |
| `lms:attempt:rec:<userId>:<lessonId>:<nnn>` | Percobaan kuis |
| `lms:submission:rec:<userId>:<lessonId>` | Tugas praktik + riwayat kiriman & review |
| `lms:validation:rec:<userId>:<pathId>` | Validasi kompetensi oleh leader |
| `lms:attempt-reset:rec:<id>` | Arsip riwayat kuis yang di-reset leader |
| `lms:library:rec:<id>` | **Modul bacaan** — metadata (judul, kategori, jenis, status, urutan) |
| `lms:library:body:<id>` | **Isi teks** modul bacaan (dipisah, alasan sama seperti `lms:lesson:body:`) |

**Kunci komposit itu sengaja.** Karena key-nya deterministik (`<userId>:<pathId>`),
menulis dua kali menghasilkan baris yang sama — inilah yang membuat auto-enrollment
idempoten dan tidak pernah membuat pendaftaran ganda. Bonus: peserta bisa menarik
**hanya barisnya sendiri** dengan `listByPrefix(prefix + userId + ':')`, jauh lebih
hemat kuota daripada menarik seluruh organisasi.

**Jangan taruh key config di bawah prefix record.** Prefix record memakai `:rec:`
justru supaya tidak pernah bentrok dengan key logis backup (`lms:paths:all`).

---

## 3. Cara menambah data LMS baru

Ikuti pola yang sudah ada (contoh terdekat: `loadDivisionPlans` di `App.jsx`):

1. Tambah `export const LMS_X_PREFIX = 'lms:x:rec:';` di `data.js`.
2. Tambah `export async function loadLmsX() { return await st().listByPrefix(LMS_X_PREFIX); }`.
3. Tambah key logisnya ke `LMS_BACKUP_KEYS` di `data.js`.
4. Daftarkan di `App.jsx` pada `PER_RECORD_LOADERS` **dan** `PER_RECORD_PREFIX`.

Langkah 3 & 4 wajib — kalau dilewat, datanya **tidak ikut backup**.

⚠️ Prefix tidak boleh mengandung `_` (karakter wildcard LIKE di Postgres).

---

## 4. Perhitungan progress

```
persen = materi WAJIB yang selesai / total materi WAJIB × 100
```

Materi opsional tidak menghambat penyelesaian. Sebuah materi dianggap selesai bila:

| Tipe | Syarat selesai |
|---|---|
| text / pdf / video / document | ada record `lms:progress:rec:` yang berstatus **selesai** (lihat 4.1) |
| quiz | ada percobaan yang **lulus** |
| assignment | submission berstatus **APPROVED** |

### 4.1 Kontrak "selesai" pada record progress (kompatibilitas mundur)

Dulu artinya sederhana: *ada record progress* = **selesai**. Sejak materi PDF dan video
YouTube bisa menyimpan progres **parsial**, satu record dipakai untuk dua arti:

- Record **lama** (tidak punya field `done` sama sekali) → tetap dianggap **SELESAI**.
  Progres peserta yang sudah ada tidak boleh rusak hanya karena formatnya berkembang.
- Record **baru** → selesai **hanya** bila `done === true`.

Satu-satunya sumber aturan ini: `isProgressDone()` di `data.js`. `buildCtx()` memakainya
saat menyusun `progressSet`, jadi `isLessonDone()` tidak perlu tahu bedanya.
**Halaman yang menyusun `progressSet` sendiri (mis. `ctxByUser` di `LearningAdmin.jsx`)
WAJIB ikut memakai `isProgressDone()`** — kalau tidak, angka admin beda dengan angka peserta.

Field record progress: `percent` (0–100), `done` (boolean), `detail`
(`{ lastPage, pagesViewed, totalPages }` untuk PDF · `{ maxSeconds, duration }` untuk video),
`updatedAt`, dan `completedAt` saat selesai. **Tidak ada prefix baru** — semuanya tetap di
`lms:progress:rec:<userId>:<lessonId>` yang key-nya deterministik.

### 4.2 Aturan tulis progres parsial (hemat egress)

Record parsial **hanya** ditulis saat:

1. pertama kali persennya > 0,
2. persen naik ≥ **10 poin** sejak simpanan terakhir,
3. materi selesai,
4. peserta meninggalkan materi sementara masih ada perubahan belum tersimpan.

**Tidak pernah** menulis per detik/interval, dan tidak ada polling baca baru. Simpanan
**parsial sengaja TIDAK memanggil `reload()`** (itu 4 pembacaan tabel) — angkanya dipegang
state lokal `CoursePlayer`; hanya penyelesaian yang memicu `reload()`.

### 4.3 Materi PDF & video YouTube

| Hal | Aturan |
|---|---|
| PDF disimpan di | Supabase Storage folder `lms-pdf/` lewat `lmsPutFile()`. **Tidak pernah** masuk `kv_store`. Maks 20 MB. |
| Persen dibaca | halaman unik yang pernah dibuka ÷ total halaman. 100% → otomatis selesai. |
| Persen ditonton | detik tontonan **tertinggi** (monotonik, tidak turun saat mundur) ÷ durasi. ≥ 90% → otomatis selesai (disimpan 100). |
| Video bukan YouTube | perilaku **lama** dipertahankan persis: tombol buka tab baru, tanpa pelacakan. Pengenalan link ada di `youtubeId()` (`data.js`). |
| Jalan keluar | tombol **Tandai Selesai** manual tetap ada untuk semua materi konten, kalau pemutar bermasalah di perangkat peserta. |

`pdfjs-dist` di-import **dinamis** — kodenya (±365 kB) baru diunduh saat ada PDF yang
benar-benar dibuka, jadi bundle utama tidak ikut membengkak. Script YouTube IFrame API
juga dimuat sekali, on-demand.

**Batasan yang diketahui (jujur saja):**

- Berkas font bawaan pdf.js (`standard_fonts/`, ±800 kB) **tidak** ikut dihosting.
  PDF yang memakai font standar TANPA menyematkannya (Helvetica/Times dari beberapa
  alat ekspor lama) akan digambar memakai font sistem — terbaca, tapi jarak hurufnya
  bisa sedikit berbeda. PDF dari Word/Canva/Google Docs menyematkan fontnya, jadi aman.
  Kalau suatu saat ini mengganggu, salin folder itu ke `public/` lalu isi
  `standardFontDataUrl` di `PdfReader.jsx`.
- pdf.js menggambar lewat `requestAnimationFrame`. Kalau tab disembunyikan, penggambaran
  berhenti sampai tab dibuka lagi — perilaku normal browser, bukan kerusakan.
- Berkas PDF yang diunggah lalu batal disimpan menjadi objek yatim di bucket Storage
  (sama seperti lampiran gambar tugas praktik). Tidak ada pembersih otomatis.

### 4.4 Label prioritas kursus (Wajib / Sunnah / Mubah)

Field `priority` pada record kursus. **Metadata tampilan + nilai bawaan saja — mesin
progress tidak pernah melihatnya.** Yang menentukan persen tetap `required` pada materi
dan pada entry jalur belajar.

- Kursus **lama tanpa field `priority` dianggap `wajib`** di semua tampilan
  (`coursePriority()` di `data.js`). Tidak ada migrasi data — cukup fallback saat membaca.
- Saat admin memasukkan kursus ke jalur belajar, nilai bawaan kotak **Wajib** mengikuti
  prioritasnya: `wajib` → dicentang, `sunnah`/`mubah` → tidak. Admin tetap bisa mengubah.
- Badge-nya tampil di 4 tempat: daftar kursus admin, pemilih kursus di builder jalur,
  kartu kursus di *Pembelajaran Saya*, dan header kursus di pemutar.

Progress **tidak pernah disimpan** — selalu dihitung ulang dari sumber kebenaran
(`progress` / `attempts` / `submissions`) lewat `computeCourseProgress()` dan
`computePathProgress()`. Yang disimpan hanya *status* enrollment
(NOT_STARTED / IN_PROGRESS / COMPLETED), dan itu pun hanya ditulis kalau berubah.

Kursus berstatus `draft` **dibuang** dari perhitungan di semua halaman, supaya angka
yang dilihat peserta, leader, dan manajemen selalu sama.

---

## 5. Auto-enrollment

Dipicu di `App.jsx` → `UsersView.handleSave`, setelah anggota tersimpan.

Aturan pencocokan (`pathMatchesUser`):

- Jalur harus berstatus **published**.
- Target divisi & jabatan dua-duanya kosong → **tidak pernah** auto-enroll (harus manual).
- Hanya divisi diisi → cocok bila divisi karyawan termasuk.
- Hanya jabatan diisi → cocok bila jabatan karyawan termasuk.
- Dua-duanya diisi → harus cocok di **keduanya**.

Sifatnya:
- **Idempoten** — aman dijalankan berapa kali pun.
- **Tidak pernah menghapus** enrollment lama, termasuk saat posisi karyawan berubah
  (riwayat belajar tetap utuh). Perubahan posisi hanya menambah jalur baru.
- **Tidak memblokir** penyimpanan anggota. Kalau gagal, jalankan ulang lewat tombol
  *Jalankan Auto-Enroll Sekarang* di **Kelola Pembelajaran → Peserta**.

---

## 6. Kuis & kunci jawaban

App ini **tidak punya backend** (SPA langsung ke Supabase), jadi penilaian dihitung
di browser. Supaya kunci jawaban tidak terbaca lewat DevTools, yang disimpan adalah
`SHA-256(salt + jawaban)` per soal — dibuat `sealQuestion()`, dicek `isAnswerCorrect()`.

**Batasnya jujur:** untuk pilihan ganda 4 opsi, kunci masih bisa ditebak dengan 4x
percobaan hash oleh orang yang paham teknis. Karena itu skor bersifat **indikatif**,
dan keputusan **KOMPETEN** tetap di tangan leader lewat validasi kompetensi.
Penilaian benar-benar server-side baru mungkin setelah backlog *Supabase Auth + RLS penuh*
dikerjakan — jangan diselundupkan sebagai tambalan kecil.

Nomor percobaan **selalu dibaca ulang dari server** sebelum menyimpan
(`loadMyAttempts`), karena key attempt deterministik: kalau state lokal basi, percobaan
sebelumnya bisa tertimpa diam-diam.

Reset kesempatan: leader/admin lewat **Pembelajaran Tim → Progres Tim → Reset Kesempatan Kuis**.
Riwayat lama diarsipkan ke `lms:attempt-reset:rec:` sebelum dihapus, dan penghapusan
**dibatalkan** kalau arsipnya gagal tersimpan.

---

## 7. Hak akses

Memakai sistem role yang sudah ada, tanpa role baru.

| Peran | Akses |
|---|---|
| owner / manajer | semua: kelola kursus, jalur, lihat & review semua peserta |
| leader | hanya anggota dengan `leaderId === leader.id`: progres, review tugas, validasi, reset kuis |
| operasional | hanya Pembelajaran Saya (dirinya sendiri) |

Menu digating **role**, bukan `canAccessFeature` — sebab `DIVISION_FEATURES` untuk
divisi `mabit` dan `event` masih kosong, jadi leader kedua divisi itu tidak akan pernah
melihat menunya.

`canReviewLearner()` diperiksa **ulang sebelum menyimpan**, bukan hanya saat menampilkan.

> **Catatan jujur:** otorisasi di app ini ditegakkan di frontend. Policy RLS Supabase
> masih `using (true)` dan anon key ada di bundle, jadi ini pagar produk — bukan pagar
> keamanan kriptografis. Batasan ini berlaku untuk **seluruh app**, bukan khusus LMS.

---

## 8. Hemat kuota (penting)

Project ini pernah kena restrict kuota egress Supabase. Aturan yang dipegang modul ini:

- **Materi & kurikulum tidak pernah dipolling.** Dimuat 1x saat halaman dibuka + tombol
  *Muat Ulang* manual.
- **Polling 30 detik hanya untuk antrean review**, dan hanya saat tab *Perlu Direview*
  sedang dibuka.
- **Isi materi dimuat on-demand** per materi yang dibuka, dengan cache per sesi.
- **Peserta hanya menarik barisnya sendiri** lewat `loadMy*(userId)`.
- **Video = URL eksternal** (YouTube/Drive), tidak pernah masuk database.
- **PDF = berkas di Supabase Storage** (`lms-pdf/`), tidak pernah masuk database.
- **Modul bacaan dimuat sekali** bersama halamannya (metadata saja); isi teks & PDF-nya
  on-demand per modul yang dibuka. Tidak ada polling.
- **Gambar lampiran lewat `lmsPutImage()`** → Supabase Storage (CDN), record hanya simpan ref.
- **Tidak ada data LMS yang ditambahkan ke Dashboard atau TopBar** — dua tempat itu jalan
  untuk semua user sepanjang jam kerja.

Halaman LMS dimuat `React.lazy`, jadi karyawan yang tidak pernah membukanya tidak ikut
mengunduh kodenya. Bundle utama hanya naik ~1,5% (973 → 990 kB).

---

## 9. Backup

Seluruh key LMS masuk `BACKUP_KEYS`. Pengecualiannya:
`lms:lesson-bodies:all` **dan** `lms:library-bodies:all` masuk `HEAVY_BACKUP_KEYS`, artinya
**dikecualikan dari auto-backup harian ke Supabase** (menulis satu baris JSONB raksasa bisa
melewati statement timeout dan membuat SELURUH snapshot harian app gagal diam-diam). Isi
materi & isi modul bacaan tetap ikut di **backup manual** dan **Google Drive**. Data peserta
yang tak tergantikan (progres, kuis, tugas) tetap masuk snapshot harian.

Berkas PDF **tidak ikut backup database** — dia file di Supabase Storage, sama seperti foto.
Yang tersimpan di record cuma URL-nya.

---

## 10. Menjalankan & memverifikasi

```bash
npm run dev                                              # jalankan lokal
npx vite build --outDir /tmp/dist-verif --emptyOutDir    # WAJIB lulus sebelum deploy
```

Tidak ada framework test di repo ini (dan sengaja tidak dibuat). Verifikasi memakai
**checklist manual** — lihat bagian 11.

⚠️ Build lulus **tidak** menjamin app hidup: kesalahan urutan deklarasi (TDZ) lolos dari
`vite build` tapi membuat layar putih. Selalu buka app-nya setelah perubahan besar.

---

## 11. Checklist verifikasi manual

**A — Admin**
1. Kelola Pembelajaran → Kursus → Kursus Baru → isi judul → tambah modul → tambah materi
   (teks, video, kuis, tugas) → Simpan.
2. Terbitkan kursus.
3. Jalur Belajar → buat jalur → masukkan kursus → target Divisi + Jabatan → Terbitkan.

**B — Karyawan baru**
4. Anggota Tim → tambah karyawan, isi Divisi + Jabatan yang cocok dengan target jalur.
5. Login sebagai karyawan itu → Pembelajaran Saya → jalur muncul otomatis.
6. Buka kursus → selesaikan materi → progres bertambah.
7. Kerjakan kuis → jawab salah (harus BELUM LULUS, kesempatan berkurang) → ulangi dengan
   jawaban benar (harus LULUS).
8. Kirim tugas praktik → status jadi *Menunggu Review*.

**C — Leader**
9. Pembelajaran Tim → Progres Tim → anggota terlihat dengan persennya.
10. Perlu Direview → buka → coba *Minta Revisi* tanpa catatan (harus ditolak) → isi catatan →
    atau *Setujui*.

**D — Selesai**
11. Setelah semua materi wajib selesai & tugas disetujui → jalur jadi 100% *Selesai*.
12. Validasi Kompetensi → *Tandai Kompeten* → karyawan melihat status **Kompeten** di
    Pembelajaran Saya.

**E — Materi PDF, video, & modul bacaan**
13. Kursus → materi tipe *Bacaan PDF* → unggah PDF 3+ halaman → buka sebagai karyawan →
    persen naik tiap ganti halaman → halaman terakhir → otomatis **Selesai**.
14. Materi video dengan link **YouTube** → tonton ≥ 90% → otomatis **Selesai**.
    Materi video dengan link **Google Drive** → tetap tombol "Buka Video" tanpa pelacakan.
15. Materi lama yang sudah selesai **tetap** selesai (record lama tanpa `done` tidak rusak).
16. Kelola Pembelajaran → **Modul Bacaan** → buat 1 PDF + 1 teks → draft **tidak** terlihat
    karyawan → Terbitkan → muncul di *Pembelajaran Saya* → halaman terakhir diingat →
    persen jalur belajar **tidak berubah sama sekali**.
17. Pengaturan App → Backup memuat `lms:library:all` dan `lms:library-bodies:all`.

**Yang wajib dicek juga:** leader tidak melihat anggota tim lain · karyawan tidak melihat
menu Kelola Pembelajaran · kursus draft tidak terlihat karyawan · tampilan HP tidak meluber.

---

## 12. Uji logika otomatis (opsional)

```bash
node uji-lms.mjs
```

Satu file Node biasa, tanpa framework & tanpa dependency baru, memakai storage tiruan
di memori (database production tidak disentuh). Menguji 68 hal: perhitungan progres,
label prioritas kursus, kontrak "selesai" record progress (termasuk kompatibilitas mundur
record lama & progres parsial PDF/video), pengenalan link YouTube, penargetan & idempotensi
auto-enrollment, penilaian kuis, penomoran percobaan, batas wewenang leader, dan pemisahan
record modul bacaan. **Jalankan setiap kali `src/lms/data.js` diubah.**

---

## 13. Modul Bacaan (perpustakaan internal)

Bacaan bebas yang boleh dibuka karyawan bolak-balik kapan saja — Buku Hook, Sejarah
Al-Kahfi Corp, panduan kerja. **Sifatnya sunnah**, dan itu ditegakkan di kode, bukan
cuma di kalimat:

- **TANPA enrollment.** Tidak ada record `lms:enroll:rec:` untuk modul bacaan.
- **TANPA progress.** Tidak ada satu pun penulisan ke `lms:progress:rec:` dari pembacanya.
- **Tidak pernah masuk perhitungan** `computeCourseProgress` / `computePathProgress`.
- Halaman terakhir yang dibaca disimpan di **localStorage** (`lms-lib-lastpage:<id>`),
  bukan di database — itu kenyamanan pribadi, bukan progres belajar.

| Hal | Aturan |
|---|---|
| Metadata | `lms:library:rec:<id>` — `{ id, title, description, category, type: 'pdf'\|'text', pdfUrl, pdfName, pdfSize, status, order, createdAt, createdById, createdByName, updatedAt }` |
| Isi teks | `lms:library:body:<id>` — record terpisah, dimuat **on-demand** + cache per sesi, dan **melempar error** saat gagal baca (bukan mengembalikan string kosong) |
| Isi PDF | Supabase Storage `lms-pdf/`, record hanya menyimpan URL |
| Admin | Kelola Pembelajaran → tab **Modul Bacaan**: buat, edit, urutkan, Terbitkan/Jadikan Draft, hapus (record + isinya) |
| Karyawan | *Pembelajaran Saya* → bagian **Modul Bacaan** di bawah jalur belajar. Hanya yang `published`, urut `order`, ada pencarian judul + kategori di sisi klien |
| Pembaca | tipe `pdf` memakai `PdfReader.jsx` yang sama dengan materi kursus — **tanpa** satu pun penulisan progres; tipe `text` di-render `whitespace-pre-wrap` |

Mengubah modul dari teks ke PDF **tidak** menghapus baris isinya — disengaja, supaya
tulisan lamanya tidak hilang kalau admin berubah pikiran. Dua konsekuensi yang WAJIB
dijaga bersamanya:

1. Form edit **selalu** memuat isi modul, apa pun tipenya. Kalau pemuatan dibatasi ke
   tipe `text` saja, modul yang dikembalikan dari PDF ke teks akan disimpan dengan isi
   KOSONG dan tulisan lamanya hilang tanpa peringatan.
2. Hapus modul **selalu** menghapus baris isinya, apa pun tipenya — kalau dibatasi ke
   tipe `text`, modul yang pernah teks lalu jadi PDF meninggalkan baris yatim yang ikut
   terbawa backup selamanya.
