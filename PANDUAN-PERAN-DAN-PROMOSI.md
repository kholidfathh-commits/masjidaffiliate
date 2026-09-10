# PANDUAN PERAN & PROMOSI JABATAN — Al-Kahfi Team App

Dokumen ini menjawab satu pertanyaan: **kalau ada orang naik/turun jabatan, apa yang harus dilakukan?**
Jawabannya sejak 10 September 2026: **cukup diubah lewat aplikasi. Tidak perlu koding, tidak perlu buka Supabase.**

---

## 1. Lima peran yang ada

| Peran (tampilan) | Nilai di database | Melihat data siapa? |
|---|---|---|
| Owner | `owner` | Seluruh perusahaan |
| Manajer | `manajer` | Seluruh perusahaan |
| Leader | `leader` | Dirinya + Co-Leader di bawahnya + **seluruh** staf di bawah Co-Leader itu |
| **Co-Leader** | `wakil` | Dirinya + staf yang **atasan langsungnya dia** |
| Karyawan | `operasional` | Hanya dirinya sendiri |

Dua hal yang menentukan hak akses seseorang — **hanya dua ini**, tidak ada yang lain:

1. **Peran** (field `role`)
2. **Atasan Langsung** (field `leaderId`)

Nama orang, email, username, dan tulisan "Posisi / Jabatan" **TIDAK PERNAH** dipakai untuk menentukan hak akses.
"Posisi / Jabatan" hanya untuk menargetkan jalur belajar otomatis di menu Pembelajaran.

> **Kenapa `leaderId`, bukan `coLeaderId` atau `supervisorId`?**
> Nama fieldnya sengaja tidak diubah supaya data 29 anggota yang sudah ada tidak perlu dimigrasi.
> Artinya yang diperluas: dulu "id Leader", sekarang "id atasan langsung" — boleh Leader, boleh Co-Leader.

---

## 2. Cara menaikkan/menurunkan jabatan seseorang

Login sebagai **Owner atau Manajer** → menu **Anggota Tim** → cari orangnya → tombol **pensil (Edit)**.

Di formulir, ubah:

- **Peran** → pilih dari dropdown (Owner / Manajer / Leader / Co-Leader / Karyawan)
- **Atasan Langsung** → siapa yang mengawasi orang ini
- **Divisi / Tim** → menentukan menu khusus divisi (Seller, Komisi, dll)
- **Posisi / Jabatan** → untuk jalur belajar

Klik **Simpan**. Selesai. Hak aksesnya langsung ikut berubah.

### Contoh: mempromosikan seorang Affiliator menjadi Co-Leader

1. Edit orangnya → **Peran: Co-Leader** → **Atasan Langsung: (nama Leader divisinya)** → Simpan.
2. Lalu tentukan **siapa saja stafnya**: edit satu per satu staf yang akan dibawahinya →
   ubah **Atasan Langsung** menjadi nama Co-Leader tadi → Simpan.
3. Orang itu kini melihat laporan, absensi, KPI, dan pembelajaran staf tersebut — **hanya mereka**.

Langkah 2 penting: promosi tanpa memindahkan staf akan membuat Co-Leader "mengawasi 0 anggota".
Jumlah orang yang diawasi terlihat langsung di kartu anggota ("Mengawasi N anggota").

---

## 3. Aturan pengaman yang otomatis dijalankan aplikasi

- **Tidak bisa memberi peran di atas peran sendiri.** Leader hanya bisa memberi peran Co-Leader & Karyawan;
  Co-Leader hanya Karyawan. Owner/Manajer bisa semuanya.
- **Tidak bisa mengedit akun sendiri untuk menaikkan peran sendiri.**
- **Atasan harus berpangkat lebih tinggi.** Karyawan tidak bisa jadi atasan Co-Leader.
- **Tidak bisa membuat struktur melingkar** (A jadi atasan B, sementara B atasan A).
- **Leader/Co-Leader hanya bisa menempatkan orang di bawah dirinya atau bawahannya** — bukan di tim orang lain.
- **Naik jadi Leader/Manajer/Owner otomatis mengosongkan field Atasan**, supaya orang itu tidak lagi
  terhitung sebagai anggota tim atasan lamanya.
- **Peringatan merah "anggota menggantung"** muncul di halaman Anggota Tim bila ada staf yang atasannya
  sudah tidak berperan mengawasi (mis. Co-Leader-nya diturunkan). Laporan & izin mereka jadi tidak ada
  yang berwenang menangani — tetapkan atasan baru.
- Setiap perubahan peran/atasan/divisi **dicatat di Log Aktivitas** dengan bunyi
  "mengubah <nama>: peran Karyawan → Co-Leader, atasan ... → ...".

---

## 4. Setelah perubahan disimpan

- **Orang lain** langsung melihat struktur baru.
- **Orang yang perannya diubah**, kalau saat itu sedang membuka aplikasi, akan mengikuti peran baru
  setelah halamannya menyegarkan data (paling pasti: **refresh / hard refresh**, atau logout–login).
  Sesi login hanya menyimpan `{ id }` — peran SELALU dibaca ulang dari database, tidak pernah di-cache.

---

## 5. Batas keamanan yang harus disadari (penting)

Otorisasi aplikasi ini ditegakkan di **frontend**. Tabel `kv_store` di Supabase memakai policy
`using(true)` dengan publishable key, sehingga:

> Siapa pun yang tahu URL + publishable key (keduanya memang terkirim ke browser) secara teknis
> masih bisa membaca/menulis `kv_store` langsung lewat REST API, **tanpa melalui aplikasi**.

Artinya pembatasan Co-Leader di dokumen ini adalah **pagar produk** (menentukan apa yang muncul,
apa yang boleh ditekan, dan diperiksa ulang sebelum setiap penulisan) — **bukan pagar kriptografis**.
Batasan ini berlaku untuk SELURUH aplikasi sejak awal, bukan khusus fitur Co-Leader.

Penutup sesungguhnya = **Supabase Auth + RLS penuh** (ada di Backlog `progress.MD` §5).
Sampai itu dikerjakan, jangan simpan data yang benar-benar rahasia (mis. data gaji per orang)
di aplikasi ini dengan asumsi hanya atasannya yang bisa membacanya.

---

## 6. Untuk developer / Claude Code

Semua aturan di atas ada di **satu file**: `src/peran/hierarki.js` (fungsi murni, tanpa React).
Diuji `node uji-peran.mjs` (89 tes) dan `node uji-akses.mjs` (31 tes).

**Jangan** menulis ulang rumus "siapa bawahan siapa" (`u.leaderId === user.id`) di `App.jsx` —
`uji-peran.mjs` §10 sengaja gagal bila pola itu muncul lagi. Rumus salinan yang tersebar di ~15 tempat
itulah yang dulu membuat penambahan lapisan Co-Leader terasa seperti pekerjaan koding besar.

Menambah peran baru di masa depan (mis. "Supervisor" di antara Manajer & Leader) cukup:
1. Tambah key di `ROLE_KEYS`, `ROLE_RANK`, dan bila perlu `ROLE_BERATASAN` / `ROLE_PENGAWAS`.
2. Tambah satu baris di `ROLES` (`src/App.jsx`) untuk label, warna, ikon.
3. Tambah di `peranBolehDibuat()` siapa yang boleh memberikannya.

Tidak perlu menyentuh halaman Laporan, Absensi, KPI, Tiket, Kalender, atau LMS — semuanya sudah
membaca aturan dari modul yang sama.
