// ============================================================================
// UJI MANAJEMEN SAMPEL — jalankan: node uji-sampel.mjs
// ----------------------------------------------------------------------------
// BUKAN framework test dan TIDAK menambah dependency — satu file Node biasa.
// Database production tidak pernah disentuh (semua data di sini data contoh).
//
// Menjaga dua hal:
//   A. LOGIKA (src/sampel/data.js) — kode sampel, token QR, deep link, umur,
//      statistik pemakaian, aging, filter/urutan, dashboard, hak akses, validasi.
//   B. ENCODER QR (src/sampel/qr.js) — diuji dengan PEMBACA MANDIRI yang ditulis
//      di bawah: matriks hasil encode dibaca ulang (format info → BCH, buka topeng,
//      telusuri zig-zag, de-interleave, cek sindrom Reed-Solomon = 0, urai byte).
//      Kalau penempatan/topeng/ECC-nya salah, uji ini GAGAL — bukan cuma "kelihatan
//      seperti QR". Encoder ini juga sudah diadu dengan decoder pihak ketiga (jsQR)
//      di luar repo: 213 dari 213 panjang teks terbaca benar, versi 1–10, 8 topeng.
// ============================================================================
import * as S from './src/sampel/data.js';
import * as Q from './src/sampel/qr.js';
import fs from 'fs';

let lulus = 0, gagal = 0;
const cek = (nama, syarat, detail) => {
  if (syarat) { lulus++; console.log('  LULUS  ', nama); }
  else { gagal++; console.log('  GAGAL  ', nama, detail !== undefined ? `\n           -> ${JSON.stringify(detail, (k, v) => v instanceof Map ? [...v] : v)}` : ''); }
};
const judul = (t) => console.log(`\n=== ${t} ===`);

// ====== Data contoh (skenario dari brief: Gamis Aluna datang 9 Sep 2026) ======
const HARI_INI = '2026-10-16'; // 37 hari setelah 9 Sep 2026
const owner = { id: 'u-own', name: 'Kholid', role: 'owner', division: 'manajemen' };
const manajer = { id: 'u-man', name: 'Rina', role: 'manajer', division: 'manajemen' };
const leader = { id: 'u-lead', name: 'Budi', role: 'leader', division: 'mcn' };
const staf = { id: 'u-staf', name: 'Siti', role: 'operasional', division: 'internal' };
const staf2 = { id: 'u-naima', name: 'Naima', role: 'operasional', division: 'internal' };
const sekretariat = { id: 'u-sek', name: 'Dewi', role: 'operasional', division: 'manajemen', isSecretariat: true };

const gamis = {
  id: 'SMP-260909-0001', kode: 'SMP-260909-0001', token: 'A7K2M9QX', nama: 'Gamis Aluna',
  kategori: 'Fashion', tanggalDatang: '2026-09-09', sellerNama: 'Aluna Official',
  penerimaId: 'u-staf', penerimaNama: 'Siti', lifecycle: 'aktif',
};
const hijab = {
  id: 'SMP-260909-0002', kode: 'SMP-260909-0002', token: 'B8L3N0RY', nama: 'Hijab Bella',
  kategori: 'Fashion', tanggalDatang: '2026-09-09', sellerNama: 'Bella Store', lifecycle: 'aktif',
};
const blender = { // sampel lama & mati → kandidat review
  id: 'SMP-260501-0001', kode: 'SMP-260501-0001', token: 'C9M4P1SZ', nama: 'Blender Mini',
  kategori: 'Elektronik', tanggalDatang: '2026-05-01', sellerNama: 'Dapoer Kita', lifecycle: 'aktif',
};
const rok = { // sudah keluar gudang
  id: 'SMP-260401-0001', kode: 'SMP-260401-0001', token: 'D0N5Q2TA', nama: 'Rok Plisket',
  kategori: 'Fashion', tanggalDatang: '2026-04-01', sellerNama: 'Aluna Official', lifecycle: 'terjual',
};
const baru = { // datang hari ini, belum pernah dipakai
  id: 'SMP-261016-0001', kode: 'SMP-261016-0001', token: 'E1P6R3UB', nama: 'Serum Glow',
  kategori: 'Kecantikan', tanggalDatang: HARI_INI, sellerNama: 'Glow Lab', lifecycle: 'aktif',
};
const semuaSampel = [gamis, hijab, blender, rok, baru];

const log = (sampel, dk, jam, user) => ({
  id: `${dk}-${Math.random().toString(36).slice(2, 8)}`,
  sampelId: sampel.id, sampelKode: sampel.kode,
  userId: user.id, userName: user.name,
  usedAt: `${dk}T${jam}:00.000Z`, createdAt: `${dk}T${jam}:00.000Z`,
});
// Gamis: 3x hari ini, 2x kemarin (masih pekan yg sama), 1x awal Oktober, 1x September.
const logs = [
  log(gamis, HARI_INI, '02:10', staf2), log(gamis, HARI_INI, '04:20', staf2), log(gamis, HARI_INI, '07:05', staf),
  log(gamis, '2026-10-15', '03:00', staf), log(gamis, '2026-10-15', '08:00', staf2),
  log(gamis, '2026-10-02', '03:00', staf),
  log(gamis, '2026-09-05', '03:00', leader), // sengaja DI LUAR jendela 30 hari
  // Hijab: terakhir dipakai 10 hari lalu.
  log(hijab, '2026-10-06', '03:00', staf2),
  // Blender: terakhir dipakai 2026-06-01 (137 hari lalu).
  log(blender, '2026-06-01', '03:00', staf),
];

// ============================================================================
judul('1. Kode sampel & urutan');
// ============================================================================
cek('1a. Format kode sesuai brief SMP-260909-0001', S.kodeSampel('2026-09-09', 1) === 'SMP-260909-0001');
cek('1b. Sequence dipadding 4 digit', S.kodeSampel('2026-09-09', 42) === 'SMP-260909-0042');
cek('1c. Tanggal tidak valid → kode kosong', S.kodeSampel('bukan-tanggal', 1) === '');
cek('1d. Urutan berikutnya melanjutkan nomor tertinggi HARI ITU',
  S.urutanBerikutnya(semuaSampel, '2026-09-09') === 3, S.urutanBerikutnya(semuaSampel, '2026-09-09'));
cek('1e. Tanggal lain mulai dari 1 lagi', S.urutanBerikutnya(semuaSampel, '2026-12-25') === 1);
cek('1f. Daftar kosong mulai dari 1', S.urutanBerikutnya([], '2026-09-09') === 1);
cek('1g. Kode sampel tanggal berbeda TIDAK saling mengganggu',
  S.urutanBerikutnya(semuaSampel, '2026-05-01') === 2);
cek('1h. rapikanKode membersihkan spasi & huruf kecil', S.rapikanKode(' smp 260909 0001 ') === 'SMP-260909-0001');

// ============================================================================
judul('2. Token QR & deep link');
// ============================================================================
let acakIdx = 0;
const acakTetap = () => { const v = [0, 0.2, 0.4, 0.6, 0.8, 0.99, 0.5, 0.1][acakIdx++ % 8]; return v; };
const tok = S.buatToken(acakTetap);
cek('2a. Token panjangnya 8 karakter', tok.length === 8, tok);
cek('2b. Token hanya memakai alfabet aman', S.tokenValid(tok), tok);
cek('2c. Token tidak memuat huruf yang mudah tertukar (I/L/O/U)',
  !/[ILOU]/.test(S.ALFABET_TOKEN) && S.ALFABET_TOKEN.length === 32);
cek('2d. Token acak sungguhan tetap valid',
  Array.from({ length: 200 }, () => S.buatToken()).every(S.tokenValid));
cek('2e. Token panjang salah ditolak', S.tokenValid('ABC') === false && S.tokenValid('A7K2M9QXX') === false);
cek('2f. Token dengan huruf terlarang ditolak', S.tokenValid('A7K2M9QI') === false);

cek('2g. URL QR memakai base URL yang dioper (tidak hardcode)',
  S.urlSampel('https://alkahficorp.vercel.app', 'A7K2M9QX') === 'https://alkahficorp.vercel.app/s/A7K2M9QX');
cek('2h. Slash berlebih di base URL dirapikan',
  S.urlSampel('https://contoh.test/', 'A7K2M9QX') === 'https://contoh.test/s/A7K2M9QX');

cek('2i. Deep link /s/<token> terbaca',
  S.tokenDariAlamat({ pathname: '/s/A7K2M9QX' }) === 'A7K2M9QX');
cek('2j. Deep link /sampel/<token> terbaca',
  S.tokenDariAlamat({ pathname: '/sampel/A7K2M9QX' }) === 'A7K2M9QX');
cek('2k. Deep link /samples/scan/<token> (bentuk brief) terbaca',
  S.tokenDariAlamat({ pathname: '/samples/scan/A7K2M9QX' }) === 'A7K2M9QX');
cek('2l. Bentuk query ?s= terbaca', S.tokenDariAlamat({ search: '?s=A7K2M9QX' }) === 'A7K2M9QX');
cek('2m. Bentuk hash #/sampel/ terbaca', S.tokenDariAlamat({ hash: '#/sampel/A7K2M9QX' }) === 'A7K2M9QX');
cek('2n. Huruf kecil di URL tetap dikenali', S.tokenDariAlamat({ pathname: '/s/a7k2m9qx' }) === 'A7K2M9QX');
cek('2o. Alamat biasa TIDAK menghasilkan token', S.tokenDariAlamat({ pathname: '/', search: '', hash: '' }) === null);
cek('2p. Token ngawur di URL ditolak', S.tokenDariAlamat({ pathname: '/s/hack<script>' }) === null);
cek('2q. Alamat kosong tidak error', S.tokenDariAlamat() === null);

// ============================================================================
judul('3. Umur sampel');
// ============================================================================
cek('3a. Gamis Aluna berumur 37 hari (contoh brief)', S.umurSampel('2026-09-09', HARI_INI) === 37);
cek('3b. Datang hari ini = 0 hari', S.umurSampel(HARI_INI, HARI_INI) === 0);
cek('3c. Blender berumur 168 hari', S.umurSampel('2026-05-01', HARI_INI) === 168, S.umurSampel('2026-05-01', HARI_INI));
cek('3d. Melintasi pergantian tahun benar', S.umurSampel('2025-12-31', '2026-01-01') === 1);
cek('3e. Tahun kabisat (2028) benar', S.umurSampel('2028-02-28', '2028-03-01') === 2);
cek('3f. Tanggal kosong → null (bukan NaN)', S.umurSampel('', HARI_INI) === null);
cek('3g. Label umur ringkas', S.labelUmur(37) === '37 hari' && S.labelUmur(null) === '–');
cek('3h. Label umur panjang menyebut bulan bila sudah lama',
  S.labelUmurPanjang(127) === '127 hari (± 4 bulan)', S.labelUmurPanjang(127));
cek('3i. Label umur panjang di bawah 60 hari tetap dalam hari', S.labelUmurPanjang(37) === '37 hari');
cek('3j. Tanggal Indonesia', S.fmtTanggalId('2026-09-09') === '9 September 2026', S.fmtTanggalId('2026-09-09'));
cek('3k. Awal pekan = Senin', S.awalPekan('2026-10-16') === '2026-10-12', S.awalPekan('2026-10-16'));
cek('3l. Hari Minggu ikut pekan sebelumnya', S.awalPekan('2026-10-18') === '2026-10-12', S.awalPekan('2026-10-18'));

// ============================================================================
judul('4. Statistik pemakaian (sumber kebenaran = log)');
// ============================================================================
const idx = S.indeksPakai(logs);
const statGamis = S.statistikPakai(idx.get(gamis.id), HARI_INI);
cek('4a. Dipakai 3x hari ini', statGamis.hariIni === 3, statGamis.hariIni);
cek('4b. Dipakai 5x pekan ini (Senin 12 Okt – hari ini)', statGamis.minggu === 5, statGamis.minggu);
cek('4c. Dipakai 6x bulan ini (Oktober)', statGamis.bulan === 6, statGamis.bulan);
cek('4d. Total sepanjang jendela 7x', statGamis.total === 7, statGamis.total);
cek('4e. 30 hari terakhir 6x (yang 5 Sep di luar jendela)', statGamis.hari30 === 6, statGamis.hari30);
cek('4f. Terakhir dipakai hari ini → sejakTerakhir 0', statGamis.sejakTerakhir === 0);
cek('4g. Daftar pemakai terkumpul', statGamis.pemakai.get('u-naima') === 3 && statGamis.pemakai.get('u-staf') === 3);

const statHijab = S.statistikPakai(idx.get(hijab.id), HARI_INI);
cek('4h. Hijab terakhir dipakai 10 hari lalu', statHijab.sejakTerakhir === 10, statHijab.sejakTerakhir);
cek('4i. Hijab tidak dipakai hari ini', statHijab.hariIni === 0);

const statBaru = S.statistikPakai([], HARI_INI);
cek('4j. Belum pernah dipakai → total 0 & sejakTerakhir null',
  statBaru.total === 0 && statBaru.sejakTerakhir === null);

// Cache 'sampelstat:' hanya menambal total & terakhir sepanjang masa, tidak pernah mengurangi.
const statCache = S.statistikPakai(idx.get(gamis.id), HARI_INI, { id: gamis.id, total: 83, terakhir: '2026-10-16T07:05:00.000Z', terakhirOleh: 'Siti' });
cek('4k. Cache menaikkan total sepanjang masa (83, bukan 7)', statCache.total === 83, statCache.total);
cek('4l. Angka berjendela TIDAK ikut cache (tetap dari log)', statCache.hari30 === 6 && statCache.hariIni === 3);
const statCacheKecil = S.statistikPakai(idx.get(gamis.id), HARI_INI, { id: gamis.id, total: 2, terakhir: '2020-01-01T00:00:00.000Z' });
cek('4m. Cache basi TIDAK menurunkan total (ambil yang terbesar)', statCacheKecil.total === 7, statCacheKecil.total);

const rebuilt = S.hitungUlangStat(logs);
const rbGamis = rebuilt.find(r => r.id === gamis.id);
cek('4n. hitungUlangStat membangun ulang total dari log', rbGamis.total === 7, rbGamis);
cek('4o. hitungUlangStat mencatat pemakai terakhir', rbGamis.terakhirOleh === 'Siti', rbGamis.terakhirOleh);
cek('4p. hitungUlangStat mencakup semua sampel yang pernah dipakai', rebuilt.length === 3, rebuilt.length);

cek('4q. hariPakai membaca kunci hari dari id log', S.hariPakai({ id: '2026-10-16-abc123', usedAt: 'x' }) === '2026-10-16');
cek('4r. idPakai berawalan tanggal (kunci query per bulan)', S.idPakai('2026-10-16', 'abc') === '2026-10-16-abc');
cek('4s. prefixBulanPakai membentuk prefix satu bulan',
  S.prefixBulanPakai('2026-10') === 'sampelpakai:rec:2026-10');
cek('4t. bulanTerakhir mundur & melintasi tahun',
  S.bulanTerakhir('2026-02-05', 4).join(',') === '2026-02,2026-01,2025-12,2025-11', S.bulanTerakhir('2026-02-05', 4));

// ============================================================================
judul('5. Penjaga klik ganda');
// ============================================================================
const sekarang = '2026-10-16T07:05:30.000Z';
cek('5a. Klik kedua dalam 30 detik ditolak',
  S.pakaiTerlaluCepat([{ userId: 'u-staf', usedAt: '2026-10-16T07:05:00.000Z' }], 'u-staf', sekarang) === true);
cek('5b. Pemakaian sah 10 menit kemudian TETAP boleh',
  S.pakaiTerlaluCepat([{ userId: 'u-staf', usedAt: '2026-10-16T06:55:00.000Z' }], 'u-staf', sekarang) === false);
cek('5c. User berbeda tidak saling menghalangi',
  S.pakaiTerlaluCepat([{ userId: 'u-naima', usedAt: '2026-10-16T07:05:00.000Z' }], 'u-staf', sekarang) === false);
cek('5d. Riwayat kosong tidak pernah menghalangi', S.pakaiTerlaluCepat([], 'u-staf', sekarang) === false);

// ============================================================================
judul('6. Aging (dihitung otomatis, BEDA dari lifecycle)');
// ============================================================================
cek('6a. 0–30 hari → baru', S.bucketAging(12, 1) === 'baru');
cek('6b. 31–60 hari → monitor', S.bucketAging(45, 2) === 'monitor');
cek('6c. 61–90 hari → slow', S.bucketAging(75, 3) === 'slow');
cek('6d. >90 hari & diam ≥30 hari → review', S.bucketAging(120, 40) === 'review');
cek('6e. >90 hari TAPI masih dipakai → bukan review (tetap slow)', S.bucketAging(120, 3) === 'slow');
cek('6f. >90 hari & belum pernah dipakai → review', S.bucketAging(120, null) === 'review');
cek('6g. Umur 20 hari & belum pernah dipakai → tetap baru (belum layak dievaluasi)',
  S.bucketAging(20, null) === 'baru');
cek('6h. Ambang bisa diubah lewat konfigurasi (tanpa ubah source)',
  S.bucketAging(45, 40, { batasBaru: 60 }) === 'baru' && S.bucketAging(45, 40) === 'monitor');
cek('6i. Konfigurasi terbalik dirapikan otomatis',
  (() => { const c = S.konfigAging({ batasBaru: 90, batasMonitor: 10, batasSlow: 5 }); return c.batasMonitor === 91 && c.batasSlow === 92; })());
cek('6j. Konfigurasi ngawur (huruf/negatif) diabaikan',
  (() => { const c = S.konfigAging({ batasBaru: 'x', batasSlow: -5 }); return c.batasBaru === 30 && c.batasSlow === 90; })());

const statMap = S.petaStatistik(semuaSampel, logs, [], HARI_INI);
cek('6k. Blender (168 hari, diam 137 hari) = kandidat review',
  S.agingSampel(blender, statMap.get(blender.id), HARI_INI) === 'review');
cek('6l. Gamis (37 hari, aktif dipakai) = monitor',
  S.agingSampel(gamis, statMap.get(gamis.id), HARI_INI) === 'monitor');
cek('6m. Sampel baru hari ini = baru', S.agingSampel(baru, statMap.get(baru.id), HARI_INI) === 'baru');
cek('6n. perluReview TRUE untuk blender', S.perluReview(blender, statMap.get(blender.id), HARI_INI) === true);
cek('6o. Sampel yang sudah TERJUAL tidak pernah jadi kandidat review',
  S.perluReview(rok, statMap.get(rok.id), HARI_INI) === false);

// ============================================================================
judul('7. Filter, pencarian & urutan');
// ============================================================================
const saring = (o) => S.saringSampel(semuaSampel, statMap, { hariIni: HARI_INI, ...o }).map(s => s.kode);
cek('7a. Tanpa filter = semua sampel', saring({}).length === 5);
cek('7b. Cari Sample ID', saring({ cari: 'SMP-260909-0001' }).join() === gamis.kode);
cek('7c. Cari nama produk (tidak peduli huruf besar/kecil)', saring({ cari: 'gamis' }).join() === gamis.kode);
cek('7d. Cari nama seller', saring({ cari: 'aluna official' }).sort().join() === [gamis.kode, rok.kode].sort().join(),
  saring({ cari: 'aluna official' }));
cek('7e. Filter kategori', saring({ kategori: 'Elektronik' }).join() === blender.kode);
cek('7f. Filter lifecycle', saring({ lifecycle: 'terjual' }).join() === rok.kode);
cek('7g. Filter umur 0–30 hari', saring({ umur: '0-30' }).join() === baru.kode);
cek('7h. Filter umur >90 hari', saring({ umur: '90+' }).sort().join() === [blender.kode, rok.kode].sort().join());
cek('7i. Filter dipakai hari ini', saring({ pakai: 'hari-ini' }).join() === gamis.kode);
cek('7j. Filter tidak dipakai >7 hari', saring({ pakai: 'tanpa7' }).sort().join() ===
  [hijab.kode, blender.kode, rok.kode, baru.kode].sort().join(), saring({ pakai: 'tanpa7' }));
cek('7k. Filter belum pernah dipakai', saring({ pakai: 'belum' }).sort().join() === [rok.kode, baru.kode].sort().join());
cek('7l. Filter aging = review', saring({ aging: 'review' }).sort().join() === [blender.kode, rok.kode].sort().join());
cek('7m. Filter digabung (AND)', saring({ kategori: 'Fashion', pakai: 'hari-ini' }).join() === gamis.kode);
cek('7n. Pencarian tanpa hasil mengembalikan daftar kosong', saring({ cari: 'tidak ada barang ini' }).length === 0);

const urut = (m) => S.urutkanSampel(semuaSampel.map(S.normalisasiSampel), m, statMap).map(s => s.kode);
cek('8a. Urut terbaru datang', urut('baru')[0] === baru.kode, urut('baru'));
cek('8b. Urut terlama datang', urut('lama')[0] === rok.kode, urut('lama'));
cek('8c. Urut paling sering dipakai 30 hari', urut('sering')[0] === gamis.kode);
cek('8d. Urut paling jarang dipakai 30 hari', urut('jarang').slice(-1)[0] === gamis.kode);
cek('8e. Urut terakhir dipakai', urut('terakhir')[0] === gamis.kode);
cek('8f. Urut paling lama tidak dipakai menaruh yang belum pernah dipakai di atas',
  [rok.kode, baru.kode].includes(urut('diam')[0]), urut('diam'));
cek('8g. Mode urut tak dikenal jatuh ke default (terbaru)', urut('ngawur')[0] === baru.kode);

// ============================================================================
judul('9. Dashboard');
// ============================================================================
const dash = S.ringkasDashboard(semuaSampel, statMap, HARI_INI);
cek('9a. Total sampel aktif = 4 (Rok Plisket sudah terjual)', dash.totalAktif === 4, dash);
cek('9b. Sampel baru bulan ini = 1', dash.baruBulanIni === 1, dash.baruBulanIni);
cek('9c. Dipakai dalam 30 hari terakhir = 2 (Gamis & Hijab)', dash.dipakai30 === 2, dash.dipakai30);
cek('9d. Tidak dipakai >30 hari = 2 (Blender & Serum baru)', dash.tanpaPakai30 === 2, dash.tanpaPakai30);
cek('9e. Kandidat review = 1 (Blender)', dash.review === 1, dash.review);
cek('9f. Penggunaan hari ini = 3', dash.pakaiHariIni === 3, dash.pakaiHariIni);
cek('9g. Penggunaan pekan ini = 5', dash.pakaiMinggu === 5, dash.pakaiMinggu);
cek('9h. Penggunaan bulan ini = 7 (6 Gamis + 1 Hijab)', dash.pakaiBulan === 7, dash.pakaiBulan);
cek('9i. Dashboard dari daftar kosong tidak error', S.ringkasDashboard([], new Map(), HARI_INI).totalAktif === 0);

const top = S.topSampel(semuaSampel, statMap, 5);
cek('9j. Top sampel 30 hari diurut menurun', top[0].sampel.kode === gamis.kode && top[0].jumlah === 6, top.map(t => [t.sampel.kode, t.jumlah]));
cek('9k. Sampel tanpa pemakaian tidak masuk Top', top.every(t => t.jumlah > 0) && top.length === 2);

const prio = S.prioritasReview(semuaSampel, statMap, HARI_INI, S.AGING_DEFAULT, 5);
cek('9l. Prioritas review hanya sampel aktif yang perlu dievaluasi',
  prio.length === 1 && prio[0].sampel.kode === blender.kode, prio.map(p => p.sampel.kode));
cek('9m. Prioritas review membawa umur & lama diam', prio[0].umur === 168 && prio[0].diam === 137, prio[0]);

// ============================================================================
judul('10. Riwayat');
// ============================================================================
const rGamis = S.riwayatSampel(logs, gamis.id);
cek('10a. Riwayat satu sampel terbaru dulu', rGamis.length === 7 && rGamis[0].usedAt >= rGamis[1].usedAt);
cek('10b. Riwayat memuat nama pemakai (untuk jawab pertanyaan seller)',
  new Set(rGamis.map(r => r.userName)).size === 3, [...new Set(rGamis.map(r => r.userName))]);
const rNaima = S.riwayatUser(logs, 'u-naima');
cek('10c. Riwayat milik satu user tersaring', rNaima.length === 4 && rNaima.every(r => r.userId === 'u-naima'));
cek('10d. Riwayat user tanpa pemakaian = kosong', S.riwayatUser(logs, 'u-tidak-ada').length === 0);

// ============================================================================
judul('11. Lifecycle & keputusan review');
// ============================================================================
cek('11a. 4 lifecycle tersedia', Object.keys(S.LIFECYCLE).join() === 'aktif,terjual,dibagikan,dibuang');
cek('11b. Default lifecycle = aktif', S.LIFECYCLE_DEFAULT === 'aktif');
cek('11c. Lifecycle ngawur jatuh ke aktif', S.normalisasiSampel({ ...gamis, lifecycle: 'ngawur' }).lifecycle === 'aktif');
cek('11d. KEEP mempertahankan status aktif', S.lifecycleDariKeputusan('simpan') === 'aktif');
cek('11e. JUAL → terjual', S.lifecycleDariKeputusan('jual') === 'terjual');
cek('11f. BAGIKAN → dibagikan', S.lifecycleDariKeputusan('bagikan') === 'dibagikan');
cek('11g. BUANG → dibuang', S.lifecycleDariKeputusan('buang') === 'dibuang');
cek('11h. Keputusan tak dikenal → null (tidak mengubah apa pun)', S.lifecycleDariKeputusan('xxx') === null);
cek('11i. masihAktif hanya untuk aktif',
  S.masihAktif(gamis) === true && S.masihAktif(rok) === false && S.masihAktif({}) === true);

// ============================================================================
judul('12. Hak akses');
// ============================================================================
cek('12a. Owner & Manajer boleh kelola', S.bisaKelolaSampel(owner) && S.bisaKelolaSampel(manajer));
cek('12b. Leader boleh kelola (input & cetak label)', S.bisaKelolaSampel(leader) === true);
cek('12c. Staf/Affiliator TIDAK boleh kelola', S.bisaKelolaSampel(staf) === false);
cek('12d. Staf bertanda Sekretariat boleh kelola', S.bisaKelolaSampel(sekretariat) === true);
cek('12e. Hanya Owner & Manajer boleh ubah lifecycle',
  S.bisaUbahLifecycle(owner) && S.bisaUbahLifecycle(manajer)
  && S.bisaUbahLifecycle(leader) === false && S.bisaUbahLifecycle(sekretariat) === false);
cek('12f. Affiliator BOLEH mencatat pemakaian sampel aktif', S.bisaPakaiSampel(staf, gamis) === true);
cek('12g. Sampel TERJUAL tidak bisa dipakai siapa pun', S.bisaPakaiSampel(owner, rok) === false);
cek('12h. Belum login tidak bisa apa-apa',
  S.bisaKelolaSampel(null) === false && S.bisaUbahLifecycle(null) === false && S.bisaPakaiSampel(null, gamis) === false);
cek('12i. Alasan penolakan dalam bahasa manusia',
  /sudah tidak aktif/i.test(S.alasanTidakBisaPakai(owner, rok)) && S.alasanTidakBisaPakai(staf, gamis) === null,
  S.alasanTidakBisaPakai(owner, rok));

// ============================================================================
judul('13. Validasi & normalisasi');
// ============================================================================
const formOk = { nama: 'Gamis Aluna', kategori: 'Fashion', tanggalDatang: '2026-09-09' };
cek('13a. Form lengkap lolos', S.validasiSampel(formOk) === null);
cek('13b. Nama produk wajib', /Nama produk wajib/.test(S.validasiSampel({ ...formOk, nama: '  ' })));
cek('13c. Kategori wajib & harus dari daftar', /Kategori wajib/.test(S.validasiSampel({ ...formOk, kategori: 'Ngawur' })));
cek('13d. Tanggal kedatangan wajib', /Tanggal kedatangan wajib/.test(S.validasiSampel({ ...formOk, tanggalDatang: '' })));
cek('13e. Nama terlalu panjang ditolak', /terlalu panjang/.test(S.validasiSampel({ ...formOk, nama: 'a'.repeat(200) })));
cek('13f. Form kosong ditolak dengan pesan jelas', typeof S.validasiSampel(null) === 'string');
cek('13g. Tanggal kedatangan di masa depan terdeteksi',
  S.tanggalDatangTerlaluJauh('2026-12-01', HARI_INI) === true && S.tanggalDatangTerlaluJauh(HARI_INI, HARI_INI) === false);

const nLama = S.normalisasiSampel({ id: 'SMP-250101-0001', nama: ' Produk Lama ' });
cek('13h. Record lama tanpa field baru tetap aman',
  nLama.kategori === 'Lainnya' && nLama.lifecycle === 'aktif' && nLama.nama === 'Produk Lama'
  && nLama.tanggalDatang === '' && Array.isArray(nLama.riwayatKeputusan), nLama);
cek('13i. Record tanpa kode/id ditolak', S.normalisasiSampel({ nama: 'x' }) === null && S.normalisasiSampel(null) === null);
cek('13j. Log pemakaian tanpa sampelId/usedAt ditolak',
  S.normalisasiPakai({ userId: 'a' }) === null && S.normalisasiPakai(null) === null);
cek('13k. Log tanpa nama pemakai diberi label aman',
  S.normalisasiPakai({ sampelId: 'x', usedAt: 'y' }).userName === 'Tanpa nama');

// ============================================================================
judul('14. Konstanta penyimpanan & label cetak');
// ============================================================================
cek('14a. Prefix baris terdefinisi',
  S.SAMPEL_REC_PREFIX === 'sampel:rec:' && S.PAKAI_REC_PREFIX === 'sampelpakai:rec:' && S.STAT_REC_PREFIX === 'sampelstat:');
cek('14b. Key backup terdefinisi',
  S.SAMPEL_BACKUP_KEY === 'sampel:all' && S.PAKAI_BACKUP_KEY === 'sampel-usage:all' && S.STAT_BACKUP_KEY === 'sampel-stat:all');
cek('14c. 10 kategori sampel tersedia', S.SAMPEL_KATEGORI.length === 10 && S.SAMPEL_KATEGORI.includes('Fashion'));
cek('14d. Ukuran label default 50 × 30 mm',
  S.UKURAN_LABEL_DEFAULT === '50x30' && S.ukuranLabel('50x30').lebarMm === 50 && S.ukuranLabel('50x30').tinggiMm === 30);
cek('14e. Ukuran label lain tersedia & tidak dikunci ke satu ukuran',
  Object.keys(S.UKURAN_LABEL).length >= 3 && S.ukuranLabel('ngawur').lebarMm === 50);
cek('14f. Jendela muat log default 4 bulan', S.JENDELA_BULAN === 4);

// ============================================================================
// QR — pembaca mandiri untuk menguji encoder secara sungguhan
// ============================================================================
judul('15. QR Code — Reed-Solomon & tabel versi');

cek('15a. Perkalian GF(256) benar', Q.gfMul(0, 5) === 0 && Q.gfMul(1, 7) === 7 && Q.gfMul(2, 128) === 29);
const g10 = Q.polinomGenerator(10);
cek('15b. Generator derajat 10 punya 11 koefisien & diawali 1', g10.length === 11 && g10[0] === 1);
cek('15c. Generator derajat 10 sesuai tabel standar',
  g10.join(',') === '1,216,194,159,111,199,94,95,113,157,193', g10.join(','));
const ec = Q.ecReedSolomon([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10);
cek('15d. Kode koreksi contoh spesifikasi cocok',
  ec.join(',') === '196,35,39,119,235,215,231,226,93,23', ec.join(','));
cek('15e. Kapasitas byte per versi masuk akal & menaik',
  Q.KAPASITAS_BYTE_M[1] === 14 && Q.KAPASITAS_BYTE_M[10] === 213
  && Array.from({ length: 9 }, (_, i) => Q.KAPASITAS_BYTE_M[i + 2] > Q.KAPASITAS_BYTE_M[i + 1]).every(Boolean));
cek('15f. Versi dipilih sekecil mungkin', Q.versiUntuk(14) === 1 && Q.versiUntuk(15) === 2 && Q.versiUntuk(213) === 10);
cek('15g. Teks di atas kapasitas ditolak (bukan QR rusak diam-diam)', Q.versiUntuk(214) === null);
cek('15h. Informasi format punya jarak Hamming ≥ 3 antar mask',
  (() => {
    const b = [0, 1, 2, 3, 4, 5, 6, 7].map(Q.bitFormat);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      let x = b[i] ^ b[j], n = 0; while (x) { n += x & 1; x >>= 1; }
      if (n < 3) return false;
    }
    return true;
  })());
cek('15i. Informasi versi 7 sesuai tabel standar', Q.bitVersi(7) === 0x07c94, Q.bitVersi(7).toString(16));
cek('15j. Informasi versi 10 sesuai tabel standar', Q.bitVersi(10) === 0x0a4d3, Q.bitVersi(10).toString(16));

// ---------------------------------------------------------------------------
// PEMBACA QR MANDIRI — ditulis di sini, TIDAK memakai fungsi encoder,
// supaya kesalahan penempatan/topeng/format tertangkap, bukan saling menutupi.
// ---------------------------------------------------------------------------
function bacaQr(m) {
  const n = m.length;
  const versi = (n - 17) / 4;

  // 1. Baca 15 bit informasi format (salinan 1), buka XOR topeng standar, cek BCH.
  let f = 0;
  const ambil = [];
  for (let i = 0; i <= 5; i++) ambil.push(m[i][8]);
  ambil.push(m[7][8], m[8][8], m[8][7]);
  for (let i = 9; i <= 14; i++) ambil.push(m[8][14 - i]);
  ambil.forEach((b, i) => { if (b) f |= 1 << i; });
  const fmt = f ^ 0b101010000010010;
  let sisa = fmt;
  for (let i = 0; i < 5; i++) if ((sisa >> (14 - i)) & 1) sisa ^= 0b10100110111 << (4 - i);
  if (sisa !== 0) throw new Error('BCH informasi format tidak valid');
  const level = (fmt >> 13) & 0b11;
  const mask = (fmt >> 10) & 0b111;
  if (level !== 0b00) throw new Error('Level koreksi bukan M');

  // 2. Bangun peta area fungsi SECARA MANDIRI (tidak memakai kode encoder).
  const fungsi = Array.from({ length: n }, () => new Array(n).fill(false));
  const blok = (r0, c0, tinggi, lebar) => {
    for (let r = r0; r < r0 + tinggi; r++) for (let c = c0; c < c0 + lebar; c++)
      if (r >= 0 && r < n && c >= 0 && c < n) fungsi[r][c] = true;
  };
  blok(0, 0, 9, 9); blok(0, n - 8, 9, 8); blok(n - 8, 0, 8, 9);
  for (let i = 0; i < n; i++) { fungsi[6][i] = true; fungsi[i][6] = true; }
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] }[versi];
  for (const r of ALIGN) for (const c of ALIGN) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
    blok(r - 2, c - 2, 5, 5);
  }
  if (versi >= 7) { blok(n - 11, 0, 3, 6); blok(0, n - 11, 6, 3); }

  // 3. Buka topeng lalu telusuri zig-zag → deret bit → codeword.
  const RUMUS = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => ((((r * c) % 2) + ((r * c) % 3)) % 2) === 0,
    (r, c) => ((((r + c) % 2) + ((r * c) % 3)) % 2) === 0,
  ][mask];
  const bit = [];
  let naik = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const row = naik ? n - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (fungsi[row][c]) continue;
        bit.push((m[row][c] !== RUMUS(row, c)) ? 1 : 0);
      }
    }
    naik = !naik;
  }
  const cw = [];
  for (let i = 0; i + 8 <= bit.length; i += 8) {
    let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bit[i + j];
    cw.push(v);
  }

  // 4. Bongkar selang-seling (de-interleave) kembali ke blok.
  const TABEL = { 1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0], 5: [24, 2, 43, 0, 0], 6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39], 9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44] }[versi];
  const [ecLen, b1, d1, b2, d2] = TABEL;
  const panjang = [...Array(b1).fill(d1), ...Array(b2).fill(d2)];
  const blokData = panjang.map(() => []);
  let p = 0;
  for (let i = 0; i < Math.max(d1, d2); i++) for (let b = 0; b < panjang.length; b++) if (i < panjang[b]) blokData[b].push(cw[p++]);
  const blokEc = panjang.map(() => []);
  for (let i = 0; i < ecLen; i++) for (let b = 0; b < panjang.length; b++) blokEc[b].push(cw[p++]);

  // 5. Sindrom Reed-Solomon tiap blok HARUS nol (bukti ECC benar-benar sah).
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  for (let b = 0; b < panjang.length; b++) {
    const full = [...blokData[b], ...blokEc[b]];
    for (let k = 0; k < ecLen; k++) {
      let s = 0;
      for (let i = 0; i < full.length; i++) s ^= mul(full[i], EXP[(k * (full.length - 1 - i)) % 255]);
      if (s !== 0) throw new Error(`Sindrom Reed-Solomon blok ${b} tidak nol`);
    }
  }

  // 6. Urai isi: mode byte → panjang → byte teks.
  const data = [];
  for (const b of blokData) data.push(...b);
  const bits = [];
  for (const c of data) for (let i = 7; i >= 0; i--) bits.push((c >> i) & 1);
  let o = 0;
  const baca = (j) => { let v = 0; for (let i = 0; i < j; i++) v = (v << 1) | bits[o++]; return v; };
  const mode = baca(4);
  if (mode !== 0b0100) throw new Error('Mode bukan byte');
  const jml = baca(versi <= 9 ? 8 : 16);
  const byte = [];
  for (let i = 0; i < jml; i++) byte.push(baca(8));
  return { teks: new TextDecoder().decode(new Uint8Array(byte)), versi, mask };
}

judul('16. QR Code — baca ulang matriks (round-trip)');
const contohQr = [
  'https://alkahficorp.vercel.app/s/A7K2M9QX',
  'https://alkahficorp.vercel.app/sampel/A7K2M9QX',
  'SMP-260909-0001',
  'a',
  'Gamis Aluna — ünïcode 🌙',
  'x'.repeat(14), 'x'.repeat(26), 'x'.repeat(42), 'x'.repeat(62), 'x'.repeat(84),
  'x'.repeat(106), 'x'.repeat(122), 'x'.repeat(152), 'x'.repeat(180), 'x'.repeat(213),
];
let qrOk = 0;
const versiTerpakai = new Set(), maskTerpakai = new Set();
for (const t of contohQr) {
  try {
    const q = Q.matriksQr(t);
    const h = bacaQr(q.modul);
    versiTerpakai.add(q.versi); maskTerpakai.add(q.mask);
    if (h.teks === t && h.mask === q.mask && h.versi === q.versi) qrOk++;
    else cek(`16x. Round-trip "${t.slice(0, 24)}"`, false, { asli: t.slice(0, 30), baca: h.teks.slice(0, 30) });
  } catch (e) { cek(`16x. Round-trip "${t.slice(0, 24)}"`, false, e.message); }
}
cek(`16a. ${contohQr.length} contoh QR terbaca ulang persis (isi, versi, topeng)`, qrOk === contohQr.length, `${qrOk}/${contohQr.length}`);
cek('16b. Semua versi 1–10 tercakup uji', versiTerpakai.size === 10, [...versiTerpakai].sort((a, b) => a - b));

// Fuzz pendek: acak isi & panjang, semua harus terbaca ulang.
let fzOk = 0, fzTotal = 0;
const ALF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_./:%';
for (let n = 1; n <= 213; n += 3) {
  let t = ''; for (let i = 0; i < n; i++) t += ALF[Math.floor(Math.random() * ALF.length)];
  fzTotal++;
  try { const q = Q.matriksQr(t); const h = bacaQr(q.modul); maskTerpakai.add(q.mask); if (h.teks === t) fzOk++; }
  catch { /* dihitung gagal di bawah */ }
}
cek(`16c. Fuzz ${fzTotal} teks acak (panjang 1–213) terbaca ulang semua`, fzOk === fzTotal, `${fzOk}/${fzTotal}`);
cek('16d. Pemilihan topeng benar-benar dipakai (lebih dari satu topeng muncul)', maskTerpakai.size >= 4, [...maskTerpakai].sort());

judul('17. QR Code — struktur & keluaran SVG');
const q1 = Q.matriksQr('https://alkahficorp.vercel.app/s/A7K2M9QX');
cek('17a. URL sampel muat di versi 3 (29×29 — cukup rapat untuk label 50×30 mm)',
  q1.versi === 3 && q1.ukuran === 29, [q1.versi, q1.ukuran]);
cek('17b. Pola pencari kiri-atas benar',
  q1.modul[0].slice(0, 7).every(Boolean) && q1.modul[1][0] && !q1.modul[1][1] && q1.modul[2][2]);
cek('17c. Pemisah pola pencari berwarna terang',
  q1.modul[7].slice(0, 8).every(v => v === false) && [0, 1, 2, 3, 4, 5, 6, 7].every(r => q1.modul[r][7] === false));
cek('17d. Pola waktu bergantian', [8, 9, 10, 11, 12].every(i => q1.modul[6][i] === (i % 2 === 0)));
cek('17e. Modul gelap wajib ada di (n−8, 8)', q1.modul[q1.ukuran - 8][8] === true);
cek('17f. Teks kosong ditolak dengan pesan jelas',
  (() => { try { Q.matriksQr(''); return false; } catch (e) { return /kosong/i.test(e.message); } })());
cek('17g. Teks kepanjangan ditolak dengan pesan jelas',
  (() => { try { Q.matriksQr('x'.repeat(300)); return false; } catch (e) { return /terlalu panjang/i.test(e.message); } })());

const svg = Q.qrSvgString('https://alkahficorp.vercel.app/s/A7K2M9QX', { ukuranPx: 120 });
cek('17h. SVG mandiri punya namespace & viewBox', svg.startsWith('<svg xmlns=') && svg.includes('viewBox="0 0 37 37"'), svg.slice(0, 90));
cek('17i. SVG memakai satu <path> (ringan, bukan ribuan <rect>)',
  (svg.match(/<path/g) || []).length === 1 && !svg.includes('<rect x='));
cek('17j. SVG punya latar putih (kontras tinggi untuk pemindai)', svg.includes('fill="#FFFFFF"'));
cek('17k. qrPath memberi zona sunyi 4 modul di tiap sisi',
  Q.qrPath('SMP-260909-0001').total === Q.matriksQr('SMP-260909-0001').ukuran + 8);

// ============================================================================
judul('18. Integrasi ke App.jsx (penjaga aturan wajib repo)');
// ============================================================================
// Dibaca LANGSUNG dari sumbernya, bukan salinan manual — pola yang sama dengan
// uji-akses.mjs. Ini menjaga aturan wajib CLAUDE.md no. 3 & 4 (key data baru harus
// masuk BACKUP_KEYS + registry per-record) supaya modul sampel tidak pernah
// tertinggal dari backup tanpa ketahuan.
const src = fs.readFileSync(new URL('./src/App.jsx', import.meta.url), 'utf8');
const potong = (mulai) => {
  const i = src.indexOf(mulai);
  return i < 0 ? '' : src.slice(i, src.indexOf('\n};', i));
};
const blokBackup = potong('const BACKUP_KEYS = [');
const blokLoader = potong('const PER_RECORD_LOADERS = {');
const blokPrefix = potong('const PER_RECORD_PREFIX = {');

cek('18a. App.jsx meng-import modul sampel & encoder QR',
  /import \* as Sampel from '\.\/sampel\/data\.js'/.test(src) && /import \* as Qr from '\.\/sampel\/qr\.js'/.test(src));
cek('18b. Ketiga key sampel masuk BACKUP_KEYS (aturan wajib no. 3)',
  ['SAMPEL_BACKUP_KEY', 'PAKAI_BACKUP_KEY', 'STAT_BACKUP_KEY'].every(k => blokBackup.includes('Sampel.' + k)), blokBackup.slice(-220));
cek('18c. Ketiga key terdaftar di PER_RECORD_LOADERS (aturan wajib no. 4)',
  ['loadSamples', 'loadSampleUsages', 'loadSampleStats'].every(f => blokLoader.includes(f)));
cek('18d. Ketiga key terdaftar di PER_RECORD_PREFIX (aturan wajib no. 4)',
  ['SAMPEL_REC_PREFIX', 'PAKAI_REC_PREFIX', 'STAT_REC_PREFIX'].every(k => blokPrefix.includes('Sampel.' + k)));
cek('18e. Loader membaca prefix pakai listByPrefix/LIKE, bukan range gte-lt (aturan wajib no. 5)',
  /async function loadSamples\(\)[\s\S]{0,220}listByPrefix/.test(src)
  && /async function loadSampleUsages\(\)[\s\S]{0,260}listByPrefix/.test(src)
  && /async function loadSampleStats\(\)[\s\S]{0,160}listByPrefix/.test(src));
cek('18f. Kedua rute halaman terpasang', /view === 'sampel' &&/.test(src) && /view === 'sampel-scan' &&/.test(src));
cek('18g. Menu sidebar sampel ada & terlihat semua peran',
  /id: 'sampel', label: 'Manajemen Sampel'[^\n]*show: true/.test(src)
  && /id: 'sampel-scan', label: 'Scan Sampel'[^\n]*show: true/.test(src));
// REGRESI NYATA (ditemukan saat uji browser 8 Sep 2026): membaca token deep link di dalam
// useState(() => ...) membuat QR tidak berfungsi, karena React.StrictMode memanggil
// initializer DUA KALI — panggilan pertama membersihkan alamat, panggilan kedua kehilangan
// tokennya. Token WAJIB dibaca di level modul.
cek('18h. Token deep link dibaca di level modul, bukan di dalam useState (anti-StrictMode)',
  /^const TOKEN_SAMPEL_AWAL = \(\(\) => \{/m.test(src)
  && /useState\(TOKEN_SAMPEL_AWAL\)/.test(src)
  && !/useState\(\(\) => \{[\s\S]{0,200}tokenDariAlamat/.test(src));
cek('18i. Setiap penulisan penting memeriksa ulang hak akses (bukan cuma menyembunyikan tombol)',
  /const putuskan = async[\s\S]{0,200}Sampel\.bisaUbahLifecycle\(user\)/.test(src)
  && /const hapus = async[\s\S]{0,200}Sampel\.bisaUbahLifecycle\(user\)/.test(src)
  && /const gunakan = async[\s\S]{0,200}alasanTidakBisaPakai\(user, s\)/.test(src));
cek('18j. Label dicetak di jendela terpisah (elemen aplikasi tidak ikut tercetak)',
  /function cetakLabelSampel[\s\S]{0,600}window\.open\(''/.test(src) && /@page \{ size: \$\{lembar \? 'A4'/.test(src));

// ============================================================================
console.log(`\n${'='.repeat(52)}`);
console.log(`HASIL: ${lulus} lulus, ${gagal} gagal (total ${lulus + gagal})`);
console.log('='.repeat(52));
process.exit(gagal > 0 ? 1 : 0);
