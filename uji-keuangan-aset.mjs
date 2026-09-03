// ============================================================================
// UJI KEUANGAN (NPM & Tren Laba) + MODUL ASET — jalankan: node uji-keuangan-aset.mjs
// ----------------------------------------------------------------------------
// BUKAN framework test dan TIDAK menambah dependency — satu file Node biasa.
// Database production tidak pernah disentuh (semua data di sini data contoh).
// Menjaga: rumus NPM (termasuk pembagian nol), konsistensi Tren Laba Bersih,
// hitungan Total Aset (kuantitas > 1, harga kosong, filter divisi), keunikan
// kode aset, dan kebenaran encoder barcode Code 128-B.
// ============================================================================
import * as K from './src/keuangan/hitung.js';
import * as A from './src/aset/data.js';

let lulus = 0, gagal = 0;
const cek = (nama, syarat, detail) => {
  if (syarat) { lulus++; console.log('  LULUS  ', nama); }
  else { gagal++; console.log('  GAGAL  ', nama, detail !== undefined ? `\n           → ${JSON.stringify(detail)}` : ''); }
};
const judul = (t) => console.log(`\n=== ${t} ===`);

// ============================================================================
judul('A. Net Profit Margin');
// ============================================================================
const npm1 = K.hitungNpm(2134000, 10000000);
cek('A1. 2.134.000 / 10.000.000 → 21,34%', npm1.dapatDihitung && npm1.teks === '21,34%', npm1);
cek('A2. nilai numerik benar', Math.abs(npm1.nilai - 21.34) < 1e-9, npm1.nilai);

cek('A3. Pendapatan Rp0 → "Belum dapat dihitung" (bukan 0%/NaN/Infinity)', (() => {
  const r = K.hitungNpm(-500000, 0);
  return !r.dapatDihitung && r.teks === 'Belum dapat dihitung' && r.nilai === null;
})(), K.hitungNpm(-500000, 0));

cek('A4. Laba 0 & pendapatan 0 → tetap "Belum dapat dihitung"',
  K.hitungNpm(0, 0).teks === 'Belum dapat dihitung');

cek('A5. Beban > pendapatan → NPM negatif ditampilkan apa adanya', (() => {
  const r = K.hitungNpm(-2500000, 5000000); // rugi 2,5jt dari pendapatan 5jt
  return r.dapatDihitung && r.teks === '-50%';
})(), K.hitungNpm(-2500000, 5000000));

cek('A6. Laba = pendapatan (tanpa beban) → 100%', K.hitungNpm(7500000, 7500000).teks === '100%');
cek('A7. Maksimal 2 angka di belakang koma', K.hitungNpm(1, 3).teks === '33,33%', K.hitungNpm(1, 3).teks);
cek('A8. Bilangan bulat tidak dipaksa ",00"', K.hitungNpm(2500000, 10000000).teks === '25%', K.hitungNpm(2500000, 10000000).teks);

// Ketahanan angka: tidak boleh ada NaN / Infinity / undefined / null bocor ke teks
const kotor = [
  [NaN, 1000], [1000, NaN], [Infinity, 1000], [1000, Infinity], [-Infinity, 1000],
  [null, null], [undefined, undefined], ['abc', 'def'], [1000, null], [null, 1000],
];
cek('A9. 10 input kotor → semua "Belum dapat dihitung", tidak ada NaN/Infinity', (() => {
  return kotor.every(([l, p]) => {
    const r = K.hitungNpm(l, p);
    return r.teks === 'Belum dapat dihitung' && !/NaN|Infinity|undefined|null/.test(r.teks);
  });
})(), kotor.map(([l, p]) => K.hitungNpm(l, p).teks));

cek('A10. fmtPersen menolak angka tidak valid', K.fmtPersen(NaN) === '–' && K.fmtPersen(Infinity) === '–');

// ============================================================================
judul('B. Tren Laba Bersih (= Pendapatan − Beban)');
// ============================================================================
const pend = [
  { date: '2026-04-01', day: 'Apr', value: 10000000 },
  { date: '2026-05-01', day: 'Mei', value: 8000000 },
  { date: '2026-06-01', day: 'Jun', value: 0 },
];
const beb = [
  { date: '2026-04-01', day: 'Apr', value: 4000000 },
  { date: '2026-05-01', day: 'Mei', value: 12000000 },
  { date: '2026-06-01', day: 'Jun', value: 3000000 },
];
const laba = K.deretLabaBersih(pend, beb);
cek('B1. Laba = Pendapatan − Beban tiap titik',
  laba.map(x => x.value).join(',') === '6000000,-4000000,-3000000', laba.map(x => x.value));
cek('B2. Bulan rugi tetap tampil sebagai nilai negatif', laba[1].value === -4000000);
cek('B3. Label bulan & tanggal ikut dari deret pendapatan',
  laba[0].day === 'Apr' && laba[0].date === '2026-04-01');
cek('B4. Konsisten dengan kartu: Σlaba = Σpendapatan − Σbeban', (() => {
  const s = (a) => a.reduce((x, y) => x + y.value, 0);
  return s(laba) === s(pend) - s(beb);
})());
cek('B5. Beban lebih pendek dari pendapatan → dianggap 0, tidak NaN',
  K.deretLabaBersih(pend, []).every(x => Number.isFinite(x.value)));
cek('B6. Nilai kotor (null/undefined) → 0, tidak NaN', (() => {
  const r = K.deretLabaBersih([{ date: 'x', value: null }], [{ date: 'x', value: undefined }]);
  return r[0].value === 0;
})());
cek('B7. adaIsinya mendeteksi deret kosong', !K.adaIsinya([{ value: 0 }], [{ value: 0 }]) && K.adaIsinya([{ value: 0 }], [{ value: -5 }]));

// ============================================================================
judul('C. Total Aset');
// ============================================================================
const aset = [
  { id: 'a1', kode: 'AST-0001', nama: 'Laptop MacBook', kategori: 'Komputer & Laptop', divisi: 'mcn', jumlah: 2, hargaSatuan: 15000000, tanggalBeli: '2026-03-10', kondisi: 'baik', lokasi: 'Studio' },
  { id: 'a2', kode: 'AST-0002', nama: 'Kamera Sony', kategori: 'Kamera & Audio', divisi: 'mcn', jumlah: 1, hargaSatuan: 12000000, tanggalBeli: '2026-04-02', kondisi: 'baik' },
  { id: 'a3', kode: 'AST-0003', nama: 'Meja Kerja', kategori: 'Furniture', divisi: 'corp', jumlah: 6, hargaSatuan: 750000, tanggalBeli: '', kondisi: 'baik' },
  // data lama: TANPA harga, TANPA jumlah, TANPA tanggal, TANPA kondisi
  { id: 'a4', kode: 'AST-0004', nama: 'Tripod lama', divisi: 'tap' },
];

const rAll = A.ringkasAset(aset, 'all');
cek('C1. Total unit memperhitungkan kuantitas (2+1+6+1 = 10)', rAll.totalUnit === 10, rAll);
cek('C2. Total nilai = Σ(harga × kuantitas) = 46.500.000',
  rAll.totalNilai === 2 * 15000000 + 12000000 + 6 * 750000, rAll.totalNilai);
cek('C3. Jumlah data aset = 4', rAll.jumlahData === 4);
cek('C4. Aset tanpa harga dihitung 0 rupiah, TIDAK NaN', Number.isFinite(rAll.totalNilai));
cek('C5. Aset tanpa harga & tanpa tanggal terhitung sebagai data belum lengkap',
  rAll.tanpaHarga === 1 && rAll.tanpaTanggal === 2, { h: rAll.tanpaHarga, t: rAll.tanpaTanggal });

const rMcn = A.ringkasAset(aset, 'mcn');
cek('C6. Filter divisi MCN → 3 unit, Rp42.000.000',
  rMcn.totalUnit === 3 && rMcn.totalNilai === 42000000, rMcn);
const rTap = A.ringkasAset(aset, 'tap');
cek('C7. Filter divisi TAP (aset tanpa harga) → 1 unit, Rp0',
  rTap.totalUnit === 1 && rTap.totalNilai === 0, rTap);
cek('C8. Divisi tanpa aset → semua nol, tidak error', (() => {
  const r = A.ringkasAset(aset, 'affiliator');
  return r.jumlahData === 0 && r.totalUnit === 0 && r.totalNilai === 0;
})());
cek('C9. Daftar kosong / data kotor tidak crash', (() => {
  const r = A.ringkasAset([null, undefined, 'bukan objek', {}], 'all');
  return Number.isFinite(r.totalNilai) && Number.isFinite(r.totalUnit);
})(), A.ringkasAset([null, undefined, {}], 'all'));
cek('C10. Σ nilai per divisi = total keseluruhan', (() => {
  const per = A.nilaiPerDivisi(aset);
  return Object.values(per).reduce((a, b) => a + b, 0) === rAll.totalNilai;
})(), A.nilaiPerDivisi(aset));

// ============================================================================
judul('D. Normalisasi data lama & validasi');
// ============================================================================
const lama = A.normalisasiAset({ id: 'x', nama: ' Kursi ' });
cek('D1. Data lama tanpa jumlah → dianggap 1 unit', lama.jumlah === 1);
cek('D2. Data lama tanpa harga → null (dibedakan dari Rp0)', lama.hargaSatuan === null);
cek('D3. Data lama tanpa divisi → default corp', lama.divisi === 'corp');
cek('D4. Data lama tanpa kondisi → default baik', lama.kondisi === 'baik');
cek('D5. Tanggal tidak valid dibuang, tidak bikin "Invalid Date"',
  A.normalisasiAset({ id: 'y', tanggalBeli: '10-03-2026' }).tanggalBeli === '');
cek('D6. Jumlah pecahan/negatif dibulatkan aman',
  A.normalisasiAset({ id: 'z', jumlah: -3 }).jumlah === 1 && A.normalisasiAset({ id: 'z', jumlah: 2.7 }).jumlah === 2);
cek('D7. fmtTanggalId format Indonesia', A.fmtTanggalId('2026-03-10') === '10 Maret 2026', A.fmtTanggalId('2026-03-10'));
cek('D8. fmtTanggalId kosong → "–" (bukan Invalid Date)', A.fmtTanggalId('') === '–' && A.fmtTanggalId(null) === '–');

cek('D9. Kode duplikat ditolak (case-insensitive)',
  A.kodeTerpakai(aset, 'ast-0002') === true && A.kodeTerpakai(aset, 'AST-9999') === false);
cek('D10. Saat edit, kode milik sendiri tidak dianggap duplikat',
  A.kodeTerpakai(aset, 'AST-0002', 'a2') === false);
cek('D11. Kode berikutnya melanjutkan nomor tertinggi', A.kodeBerikutnya(aset) === 'AST-0005', A.kodeBerikutnya(aset));
cek('D12. Kode berikutnya saat daftar kosong', A.kodeBerikutnya([]) === 'AST-0001');
cek('D13. Validasi menolak kode kosong', A.validasiAset({ kode: '', nama: 'x' }, aset) !== null);
cek('D14. Validasi menolak kode duplikat', /sudah dipakai/.test(A.validasiAset({ kode: 'AST-0001', nama: 'x' }, aset) || ''));
cek('D15. Validasi menolak nama kosong', /Nama aset/.test(A.validasiAset({ kode: 'AST-0009', nama: '  ' }, aset) || ''));
cek('D16. Validasi menolak harga negatif', /negatif/.test(A.validasiAset({ kode: 'AST-0009', nama: 'x', hargaSatuan: -1 }, aset) || ''));
cek('D17. Validasi meloloskan data lengkap',
  A.validasiAset({ kode: 'AST-0009', nama: 'Printer', jumlah: 1, hargaSatuan: 2000000, tanggalBeli: '2026-01-05' }, aset) === null);
cek('D18. Validasi meloloskan harga & tanggal KOSONG (opsional)',
  A.validasiAset({ kode: 'AST-0010', nama: 'Hibah', jumlah: '', hargaSatuan: '', tanggalBeli: '' }, aset) === null);
cek('D19. rapikanKode menyeragamkan huruf & spasi', A.rapikanKode(' ast 0001 ') === 'AST-0001');

// ============================================================================
judul('E. Barcode Code 128-B (dibuktikan dengan decode balik)');
// ============================================================================
// Integritas tabel pola
cek('E1. Tabel pola berisi 107 simbol', A.POLA_CODE128.length === 107);
cek('E2. Pola 0–105 berjumlah 11 modul, STOP 13 modul', (() => {
  const jml = (p) => [...p].reduce((s, c) => s + Number(c), 0);
  return A.POLA_CODE128.slice(0, 106).every(p => p.length === 6 && jml(p) === 11) && jml(A.POLA_CODE128[106]) === 13;
})());
cek('E3. Semua pola unik (tidak ada tabrakan simbol)', new Set(A.POLA_CODE128).size === 107);

// Checksum dihitung ulang dengan rumus independen
const checksumMandiri = (teks) => {
  let s = 104;
  [...teks].forEach((ch, i) => { s += (ch.charCodeAt(0) - 32) * (i + 1); });
  return s % 103;
};
const idx = A.indeksCode128B('AST-0001');
cek('E4. Struktur: START-B, 8 data, checksum, STOP', idx.length === 11 && idx[0] === 104 && idx[10] === 106, idx);
cek('E5. Checksum cocok dengan perhitungan independen', idx[9] === checksumMandiri('AST-0001'), { dihitung: idx[9], mandiri: checksumMandiri('AST-0001') });
cek('E6. Checksum "0" = 17 (dihitung manual: (104 + 16×1) mod 103)', A.indeksCode128B('0')[2] === 17, A.indeksCode128B('0'));

// DECODE BALIK: bukti terkuat bahwa encoder benar
const decode = (teks) => {
  const b = A.barcodeCode128(teks);
  if (!b) return null;
  // rangkai lebar → string pola per 6 elemen (STOP 7 elemen di akhir)
  const lebar = b.segmen.map(s => String(s.lebar));
  const simbol = [];
  for (let i = 0; i + 6 <= lebar.length; i += 6) {
    const potong = lebar.slice(i, i + 6).join('');
    if (i + 7 === lebar.length) break;
    simbol.push(A.POLA_CODE128.indexOf(potong));
  }
  const stop = lebar.slice(lebar.length - 7).join('');
  const data = simbol.slice(1, -1);
  return {
    valid: simbol[0] === 104 && stop === A.POLA_CODE128[106] && !simbol.includes(-1),
    checksum: simbol[simbol.length - 1],
    teks: data.map(v => String.fromCharCode(v + 32)).join(''),
  };
};
for (const contoh of ['AST-0001', 'AST-9999', 'A', 'KMR-2026-XYZ', 'AST-0042']) {
  const d = decode(contoh);
  cek(`E7. Decode balik "${contoh}" → teks & checksum benar`,
    d && d.valid && d.teks === contoh && d.checksum === checksumMandiri(contoh), d);
}
cek('E8. Lebar total = 11×(2+panjang) + 13 modul', (() => {
  const t = 'AST-0001';
  return A.barcodeCode128(t).totalModul === 11 * (t.length + 2) + 13;
})(), A.barcodeCode128('AST-0001').totalModul);
cek('E9. Segmen pertama selalu batang hitam', A.barcodeCode128('AST-0001').segmen[0].hitam === true);
cek('E10. Karakter di luar ASCII 32–126 ditolak (tidak menghasilkan barcode rusak)',
  A.barcodeCode128('ASET-Ω') === null && A.bisaBarcode('ASET-Ω') === false);
cek('E11. Teks kosong ditolak', A.barcodeCode128('') === null);
cek('E12. Barcode dibuat dari KODE, bukan nama — kode sama → barcode identik', (() => {
  const a = JSON.stringify(A.barcodeCode128('AST-0001'));
  const b = JSON.stringify(A.barcodeCode128('AST-0001'));
  const c = JSON.stringify(A.barcodeCode128('AST-0002'));
  return a === b && a !== c;
})());

// ============================================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`RINGKASAN: ${lulus} LULUS, ${gagal} GAGAL`);
console.log('='.repeat(60));
process.exit(gagal ? 1 : 0);
