# Audit Awal Pengembangan Aset dan Rasio Keuangan

**Aplikasi:** Al-Kahfi Corp — Manajemen Tim  
**Tanggal audit:** 2 September 2026  
**Status:** Draf keputusan — **belum boleh langsung dikerjakan oleh Claude Code**

## 1. Tujuan Permintaan

Fitur yang ingin ditambahkan:

1. Total Aset pada dashboard.
2. Harga pembelian dan tanggal pembelian pada setiap aset.
3. Barcode atau QR Code pada setiap aset.
4. Indikator NPM.
5. Indikator GPM.
6. Indikator ROE.
7. Indikator ROA.

## 2. Kondisi Aplikasi Saat Ini — TETAP

- Aplikasi adalah React 18 + Vite 5 dengan sumber utama `src/App.jsx`.
- Data utama disimpan di Supabase `kv_store` dengan fallback `localStorage`.
- Hak akses saat ini: owner, manajer, leader, operasional, serta flag sekretariat.
- Dashboard utama sudah memuat tiket, GMV, anggota yang terlihat, target aktif, fokus hari ini, Dashboard Bisnis, KPI, masalah, evaluasi otomatis, agenda, laporan, dan aktivitas tim.
- Modul Keuangan sudah memiliki Dashboard, Cash Flow, Laba Rugi, Neraca basis kas, filter periode, filter divisi, input transaksi, bukti transaksi, ekspor Excel, analisis kesehatan keuangan, dan SWOT.
- Data transaksi keuangan masih berada dalam key array `keuangan:cashflow`.
- Kategori pengeluaran sudah memiliki `Aset & Peralatan`, tetapi belum ada daftar/register aset.
- Neraca saat ini menyatakan `Total Aset = Kas`, `Liabilitas = 0`, dan `Ekuitas = Modal + Laba Ditahan`.
- Pembelian pada kategori `Aset & Peralatan` saat ini langsung dianggap beban. Belum ada kapitalisasi aset, umur manfaat, penyusutan, nilai buku, pelepasan aset, atau histori perpindahan aset.
- Belum ada data HPP/biaya langsung yang terpisah dari beban operasional.
- Belum ada QR Code/barcode, pemindaian aset, halaman detail aset, atau tautan langsung menuju satu aset.

## 3. Kesimpulan Audit

Permintaan tidak aman bila dikerjakan sebagai penambahan kartu angka saja.

| Indikator | Bisa dihitung sekarang? | Masalah data saat ini |
|---|---:|---|
| Nilai perolehan aset terdaftar | Belum | Belum ada register aset |
| Total Aset akuntansi | Belum akurat | Neraca hanya menganggap kas sebagai aset |
| NPM | Bisa secara sederhana | Basisnya masih cash flow; kualitas bergantung pada kelengkapan pencatatan pendapatan dan beban |
| GPM | Belum | Belum ada pemisahan HPP/biaya langsung |
| ROE | Belum andal | Transaksi ekuitas belum lengkap; dividen masih diperlakukan sebagai beban |
| ROA | Belum akurat | Total aset hanya kas dan belum ada nilai buku aset tetap |

## 4. Rekomendasi Pengembangan — USULAN

### Tahap 1 — Register Aset Operasional

Buat modul `Aset` yang berdiri sendiri dan tidak langsung mengubah laporan akuntansi lama.

Data minimum yang disarankan:

- ID internal yang tidak berubah.
- Kode aset yang unik dan mudah dibaca, misalnya `AKF-AST-000001`.
- Nama aset.
- Kategori aset.
- Harga pembelian.
- Tanggal pembelian.
- Divisi pemilik.
- Lokasi.
- PIC/penanggung jawab.
- Kondisi: baik, perlu perbaikan, rusak.
- Status: aktif, dipinjamkan, perbaikan, dijual, hilang, dihapuskan.
- Nomor seri, merek, dan model bila ada.
- Bukti pembelian/foto aset bila ada.
- Catatan.
- QR Code.
- Jejak pembuat, waktu dibuat, dan waktu diperbarui.

Aturan QR yang disarankan:

- QR tidak menyimpan harga atau informasi sensitif.
- QR menyimpan tautan internal berbasis ID aset yang stabil.
- Saat dipindai, pengguna diarahkan ke halaman detail aset dan tetap wajib login.
- V1 menyediakan tampilan serta cetak label QR; proses stock opname atau check-in/check-out dibuat pada tahap lanjutan bila memang diperlukan.

Label angka yang aman pada Tahap 1:

- `Jumlah Aset Aktif`.
- `Nilai Perolehan Aset Terdaftar`.

Jangan dulu menamainya `Total Aset` akuntansi bila kas, nilai buku, piutang, persediaan, dan kewajiban belum dimodelkan dengan benar.

### Tahap 2 — Fondasi Akuntansi untuk Rasio

Sebelum indikator rasio ditampilkan, data perlu ditingkatkan:

- Pisahkan `HPP/Biaya Langsung` dari `Beban Operasional`.
- Pisahkan setoran modal, penarikan modal, dan dividen dari pendapatan/beban.
- Tentukan perlakuan pembelian aset: kapitalisasi, bukan langsung seluruhnya sebagai beban.
- Tambahkan umur manfaat, nilai residu, tanggal mulai penyusutan, metode penyusutan, akumulasi penyusutan, dan nilai buku.
- Tentukan apakah piutang, utang, persediaan, dan aset lancar lain masuk lingkup versi ini atau tetap `TBD`.
- Sediakan peringatan `Data belum cukup` ketika pembagi nol, periode pembanding tidak tersedia, atau klasifikasi transaksi belum lengkap.

Rumus awal yang disarankan:

- `NPM = Laba Bersih / Pendapatan × 100%`.
- `GPM = Laba Kotor / Pendapatan × 100%`, dengan `Laba Kotor = Pendapatan − HPP`.
- `ROE = Laba Bersih / Rata-rata Ekuitas × 100%`.
- `ROA = Laba Bersih / Rata-rata Total Aset × 100%`.

Untuk ROE dan ROA, gunakan rata-rata saldo awal dan akhir periode—bukan hanya saldo akhir—agar hasil tidak terlalu bias.

### Tahap 3 — Dashboard dan Pengendalian

- Tampilkan rasio pada Dashboard Keuangan dengan filter periode yang sudah ada.
- Untuk Dashboard Utama, tampilkan ringkasan hanya kepada peran yang diizinkan.
- Setiap kartu rasio menampilkan nilai, rumus singkat, periode, pembanding periode sebelumnya, dan status kualitas data.
- Klik kartu membuka rincian sumber angka agar hasil bisa diaudit.
- Tambahkan pengujian logika aset dan rasio keuangan, bukan hanya pengujian tampilan.

## 5. Guardrail Teknis — TETAP

- Jangan merusak Supabase, fallback localStorage, login, peran, modul lama, data lama, backup, restore, PWA, atau alur deploy.
- Modul aset sebaiknya disimpan per-record agar aman saat dipakai beberapa orang bersamaan.
- Key logis baru wajib masuk `BACKUP_KEYS`.
- Loader dan prefix modul per-record wajib masuk `PER_RECORD_LOADERS` dan `PER_RECORD_PREFIX`.
- Query prefix Supabase wajib menggunakan `LIKE`.
- Data transaksi lama kategori `Aset & Peralatan` tidak boleh otomatis diubah menjadi aset karena dapat berisi barang habis pakai atau transaksi yang bukan aset tetap.
- Migrasi data lama harus melalui proses tinjau dan konfirmasi.
- QR Code harus tetap menunjuk aset yang benar walaupun nama, lokasi, PIC, atau kondisi aset berubah.
- Semua perhitungan harus berada pada helper murni yang dapat diuji terpisah.
- Sebelum deploy besar, lakukan Backup & Restore dari Pengaturan App.

## 6. Keputusan yang Masih TBD

1. Definisi `Total Aset` yang diinginkan.
2. Apakah penyusutan dan nilai buku masuk versi pertama.
3. Definisi HPP/Biaya Langsung untuk bisnis MCN, TAP, Affiliator, dan Al-Kahfi Corp.
4. Perlakuan setoran modal, penarikan modal, serta dividen.
5. Peran yang boleh melihat, menambah, mengubah, menghapus, dan mencetak QR aset.
6. Tujuan QR: hanya membuka detail aset atau juga stock opname, peminjaman, dan perpindahan.
7. Sumber daftar aset awal serta metode impor.
8. Lokasi indikator: Dashboard Utama, Dashboard Keuangan, atau keduanya.

## 7. Verifikasi Kondisi Awal

- Build production: **LULUS**.
- Uji absensi: **80 lulus, 0 gagal**.
- Uji LMS: **79 lulus, 0 gagal**.
- Uji akses: **25 lulus, 0 gagal**.
- Total pengujian yang tersedia: **184 lulus, 0 gagal**.

## 8. Tahap Berikutnya

Setelah keputusan pada bagian 6 dijawab, dokumen berikut perlu dibuat:

1. PRD final dan acceptance criteria.
2. Struktur data final dan rumus rasio.
3. Matriks hak akses.
4. Rencana migrasi data.
5. Rencana implementasi bertahap.
6. Checklist pengujian dan rollback.
7. Master Prompt Claude Code yang siap ditempel.
8. Prompt eksekusi singkat per tahap agar perubahan dapat diperiksa sebelum lanjut.
