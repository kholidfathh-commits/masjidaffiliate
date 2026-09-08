# PANDUAN MANAJEMEN SAMPEL — Al-Kahfi Corp App

Fitur untuk melacak **sampel produk TikTok Affiliate** yang datang ke kantor:
identitas, umur, siapa saja yang memakainya, seberapa sering, dan keputusan akhirnya.

Prinsipnya sederhana:

- **STAFF:** Datang → Input → Print → Tempel
- **AFFILIATOR:** Ambil → Scan → Gunakan → Kontenkan → Kembalikan
- **MANAJER:** Monitor → Temukan sampel mati → Putuskan

Sampel **bukan milik satu Affiliator**. Semua sampel ada di gudang bersama dan boleh
dipakai siapa saja. Nama "Penerima Awal" hanya dicatat sebagai histori, supaya kalau
seller bertanya kita tahu siapa yang pertama menerimanya.

---

## 1. Untuk Staff Operasional — Sampel Datang

1. Buka menu **Sampel → Manajemen Sampel**.
2. Klik **+ Tambah Sampel**.
3. Isi yang wajib saja:
   - **Nama Produk** (mis. `Gamis Aluna`)
   - **Kategori** (mis. `Fashion`)
   - **Tanggal Kedatangan** — otomatis hari ini, boleh diubah
4. Opsional: Seller, Affiliator Penerima Awal, Catatan, Foto Produk.
5. Klik **Simpan** — atau **Simpan & Tambah Lagi** kalau sampelnya banyak.

Sistem otomatis membuat:

- **Sample ID** — contoh `SMP-260909-0001`
  (`SMP` = sampel · `260909` = tanggal registrasi · `0001` = nomor urut hari itu)
- **QR Code** — otomatis, tidak perlu diketik.

### Kalau sampelnya banyak (input beruntun)

Tombol **Simpan & Tambah Lagi** tidak menutup form. Nama produk langsung
dikosongkan dan kursor kembali ke sana; **kategori, tanggal, dan seller
dipertahankan** karena satu kiriman biasanya dari seller yang sama.
Di bagian atas form muncul baris hijau berisi sampel yang barusan dibuat +
tombol **Cetak Label**, jadi tidak perlu bolak-balik halaman.

### Cetak Label

Klik **Cetak Label** → jendela cetak terbuka sendiri (menu & sidebar aplikasi
**tidak** ikut tercetak). Isi label:

```
[ QR ]   SMP-260909-0001
         Gamis Aluna
         FASHION
         Datang: 09/09/2026
```

Nama Affiliator **sengaja tidak dicetak** karena sampel dipakai bersama.

Ukuran label bisa dipilih di dropdown sebelah kanan:

| Pilihan | Keterangan |
|---|---|
| **50 × 30 mm** | default, printer label kecil |
| 60 × 40 mm | sedang |
| 70 × 50 mm | besar |
| A4 — 24 label | dicetak di kertas A4 biasa, 3 kolom × 8 baris |

Kalau browser memblokir popup, izinkan popup untuk situs ini — atau pakai tombol
**Unduh QR** di halaman detail sampel.

Terakhir: tempelkan label pada zipper/kemasan sampel, lalu serahkan ke Affiliator.

---

## 2. Untuk Affiliator — Memakai Sampel

1. Ambil produknya di gudang.
2. Buka menu **Sampel → Scan Sampel** (atau tombol biru **Scan Sampel**).
3. Arahkan kamera HP ke QR pada label.
   - Kalau kamera tidak bisa dipakai, ketik **Sample ID**-nya di kolom bawah — hasilnya sama.
4. Detail sampel terbuka: nama produk, umur, berapa kali dipakai, siapa yang terakhir memakainya.
5. Kalau memang mau dikontenkan, tekan tombol besar:

   ### 🎥 Gunakan Sampel

6. Muncul **"Penggunaan berhasil dicatat"**. Selesai.

**Penting:** memindai QR saja **TIDAK** dihitung sebagai pemakaian. Kamu bebas
scan hanya untuk melihat datanya. Yang dicatat hanya saat tombol **Gunakan Sampel**
ditekan. Nama dan jam diambil otomatis dari akun yang sedang login — tidak perlu
mengisi apa pun.

Boleh menggunakan sampel yang sama berkali-kali dalam sehari. Kalau tombolnya
tidak sengaja tertekan dua kali beruntun, sistem hanya mencatat satu kali.

Riwayat pemakaianmu sendiri ada di tab **Riwayat Saya**.

---

## 3. Untuk Manajer — Monitoring & Keputusan

### Dashboard

Tab **Dashboard** menampilkan:

- Sampel Aktif · Baru Bulan Ini · Dipakai 30 Hari · Tak Dipakai >30 Hari · Perlu Review
- Ringkasan penggunaan hari ini / minggu ini / bulan ini
- **Top Sampel — 30 Hari** (yang paling produktif)
- **Sampel Perlu Review** (paling prioritas dievaluasi) + tombol **Lihat Semua**

Kartu angkanya bisa diklik — langsung membuka daftar yang sudah tersaring.

### Sample Aging

Tab **Sample Aging** untuk menemukan sampel lama yang sudah tidak produktif.
Status aging dihitung **otomatis** dari umur + pemakaian:

| Status | Aturan |
|---|---|
| **Baru / Aktif** | 0–30 hari |
| **Pantau** | 31–60 hari |
| **Lambat** | 61–90 hari |
| **Perlu Review** | lebih dari 90 hari **dan** tidak dipakai ≥ 30 hari |

Sampel tua yang masih rutin dipakai **tidak** masuk Perlu Review — memang masih produktif.

Filter yang tersedia: umur, pemakaian (dipakai hari ini / tidak dipakai >7, >30, >60 hari /
belum pernah dipakai), kategori, status, dan pencarian Sample ID / nama produk / seller.

### Keputusan Sampel (Owner & Manajer)

Buka detail sampel → bagian **Keputusan Sampel**:

| Tombol | Akibat |
|---|---|
| **Tetap Simpan** | status tetap **Aktif**, tapi tercatat bahwa sampel sudah dievaluasi |
| **Jual** | status → **Terjual** |
| **Bagikan** | status → **Dibagikan** |
| **Buang** | status → **Dibuang** |

Boleh menambahkan catatan keputusan. Setelah disimpan:

- sampel **tidak bisa** dicatat pemakaiannya lagi oleh Affiliator;
- **seluruh histori tetap tersimpan** dan tetap bisa dilihat;
- keputusannya tercatat di **Riwayat Keputusan** (siapa, kapan, alasannya).

> Untuk barang yang keluar gudang, **pakai keputusan Jual/Bagikan/Buang**, jangan
> tombol Hapus. Hapus menghilangkan data sampelnya permanen; keputusan menjaga histori tetap utuh.

---

## 4. Siapa Boleh Apa

| Tindakan | Karyawan / Affiliator | Leader & Sekretariat | Owner & Manajer |
|---|:---:|:---:|:---:|
| Scan QR, cari, lihat detail | ✅ | ✅ | ✅ |
| **Gunakan Sampel** | ✅ | ✅ | ✅ |
| Lihat Riwayat Saya | ✅ | ✅ | ✅ |
| Tambah & edit sampel | — | ✅ | ✅ |
| Cetak label / QR | — | ✅ | ✅ |
| Dashboard & Sample Aging | — | ✅ | ✅ |
| Jual / Bagikan / Buang | — | — | ✅ |
| Hapus sampel | — | — | ✅ |
| Hitung ulang statistik | — | — | ✅ |

Kalau ada staf kantor berperan **Karyawan** yang perlu meng-input sampel, Owner/Manajer
cukup mencentang **Sekretariat** pada akunnya di menu **Anggota Tim** — hak input & cetak
labelnya langsung aktif, tanpa mengubah perannya.

---

## 5. Pertanyaan yang Sering Muncul

**Seller menanyakan siapa yang pernah mengontenkan produknya.**
Buka detail sampel → **Riwayat Penggunaan**. Isinya nama + tanggal + jam setiap pemakaian.

**Kenapa angka "Total" berbeda dengan jumlah baris di Riwayat Penggunaan?**
Riwayat yang ditampilkan hanya **4 bulan terakhir** (supaya aplikasi tetap ringan dan
kuota Supabase aman). Angka **Total** sudah menghitung seluruh pemakaian sejak awal.

**Angka Total terasa tidak cocok.**
Owner/Manajer bisa membuka tab **Dashboard** lalu klik **Hitung Ulang** — angka Total &
Terakhir Dipakai dibangun ulang dari seluruh riwayat pemakaian.

**QR-nya rusak / labelnya hilang.**
Buka detail sampel → **Cetak Label** lagi. QR-nya tetap sama, jadi label lama dan label
baru mengarah ke sampel yang sama.

**Sampel lama (sebelum fitur ini ada) belum punya QR.**
Buka detailnya → tombol **Buat QR** akan muncul.

**Satu produk datang 3 pcs.**
Buat **3 Sample ID** kalau ketiganya dipakai terpisah — 1 unit fisik = 1 Sample ID.
Kalau memang dianggap satu paket, cukup 1 Sample ID.

**Scan QR tapi belum login.**
Aplikasi akan meminta login dulu, lalu **otomatis membuka sampel yang tadi dipindai**.

---

## 6. Catatan Teknis Singkat

- Sumber kebenaran aktivitas sampel = **Log Pemakaian**, bukan angka penghitung.
- Data disimpan per-baris di `kv_store`: `sampel:rec:<kode>`,
  `sampelpakai:rec:<tanggal>-<acak>`, `sampelstat:<kode>`.
- Ketiganya sudah masuk **Backup & Restore** dan auto-backup harian.
- QR memakai encoder buatan sendiri (`src/sampel/qr.js`) — tanpa library tambahan.
- Logika perhitungan ada di `src/sampel/data.js`, diuji lewat `node uji-sampel.mjs`.

**Batasan yang perlu diketahui:** aplikasi ini belum memakai Supabase Auth + RLS
(masih di backlog untuk seluruh app), jadi pembatasan hak akses modul sampel
diperiksa di sisi aplikasi — sama seperti modul lain. Selama akun & password tidak
dibagikan, tim tidak bisa saling melewati batasan lewat UI.
