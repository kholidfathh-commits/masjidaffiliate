# PANDUAN LMS (Pembelajaran) — Al-Kahfi Team App

Dokumentasi developer untuk modul LMS V1. Ringkas saja; detail teknis app induk tetap
di `CLAUDE.md` dan `App Manajemen Tim/progress.MD`.

---

## 1. Apa ini

Modul pembelajaran internal: karyawan baru otomatis mendapat jalur belajar sesuai
divisi/jabatan, belajar mandiri, dikuis, mengerjakan tugas praktik, direview leader,
lalu divalidasi kompeten.

**Letak kode:** `src/lms/` (6 file). `src/App.jsx` hanya disentuh di 9 titik integrasi.

| File | Isi |
|---|---|
| `data.js` | Lapisan data, mesin progress, auto-enrollment, penilaian kuis. Tanpa JSX. |
| `ui.jsx` | Komponen UI bersama (kartu, badge, progress bar, modal, form). |
| `MyLearning.jsx` | Halaman karyawan + pemilik state alur belajar. |
| `CoursePlayer.jsx` | Pemutar kursus: materi, kuis, tugas praktik. |
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
| text / video / document | ada record `lms:progress:rec:` |
| quiz | ada percobaan yang **lulus** |
| assignment | submission berstatus **APPROVED** |

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
- **Gambar lampiran lewat `lmsPutImage()`** → Supabase Storage (CDN), record hanya simpan ref.
- **Tidak ada data LMS yang ditambahkan ke Dashboard atau TopBar** — dua tempat itu jalan
  untuk semua user sepanjang jam kerja.

Halaman LMS dimuat `React.lazy`, jadi karyawan yang tidak pernah membukanya tidak ikut
mengunduh kodenya. Bundle utama hanya naik ~1,5% (973 → 990 kB).

---

## 9. Backup

Seluruh key LMS masuk `BACKUP_KEYS`. Satu pengecualian:
`lms:lesson-bodies:all` masuk `HEAVY_BACKUP_KEYS`, artinya **dikecualikan dari auto-backup
harian ke Supabase** (menulis satu baris JSONB raksasa bisa melewati statement timeout dan
membuat SELURUH snapshot harian app gagal diam-diam). Isi materi tetap ikut di **backup
manual** dan **Google Drive**. Data peserta yang tak tergantikan (progres, kuis, tugas)
tetap masuk snapshot harian.

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

**Yang wajib dicek juga:** leader tidak melihat anggota tim lain · karyawan tidak melihat
menu Kelola Pembelajaran · kursus draft tidak terlihat karyawan · tampilan HP tidak meluber.
