// ============================================================================
// UJI LOGIKA ABSENSI — jalankan dengan:  node uji-absensi.mjs
// ----------------------------------------------------------------------------
// BUKAN framework test dan TIDAK menambah dependency — satu file Node biasa.
// Database production tidak pernah disentuh (semua data di sini data contoh).
// Menjaga logika yang paling mudah rusak diam-diam: rentang filter rekap,
// status harian (hadir/telat/izin/sakit/belum absen), aktivitas terakhir,
// rentang izin multi-hari, dan keamanan timezone Asia/Jakarta.
// Jalankan setiap kali src/absensi/logika.js diubah.
// ============================================================================
import * as A from './src/absensi/logika.js';

let lulus = 0, gagal = 0;
const cek = (nama, syarat, detail) => {
  if (syarat) { lulus++; console.log('  LULUS  ', nama); }
  else { gagal++; console.log('  GAGAL  ', nama, detail !== undefined ? `\n           → ${JSON.stringify(detail)}` : ''); }
};
const judul = (t) => console.log(`\n=== ${t} ===`);

// Jadwal kerja contoh: Senin–Jumat 08:00–17:00, Minggu libur.
const jadwalKerja = { jamMasuk: '08:00', jamPulang: '17:00', libur: false, toleransiMenit: 0 };
const jadwalLibur = { ...jadwalKerja, libur: true };
const ACUAN = '2026-08-27'; // Kamis

const absen = (userId, tanggal, jam, type = 'in', extra = {}) => ({
  id: `${userId}-${tanggal}-${jam}-${type}`, userId, userName: userId, type,
  timestamp: new Date(`${tanggal}T${jam}:00+07:00`).toISOString(),
  late: false, lateBy: 0, ...extra,
});
const izin = (userId, type, date, dateEnd, status = 'approved', extra = {}) => ({
  id: `izin-${userId}-${date}`, userId, userName: userId, type, date,
  ...(dateEnd ? { dateEnd } : {}), status, reason: 'contoh', createdAt: `${date}T01:00:00.000Z`, ...extra,
});

// ============================================================================
judul('A. Rentang filter rekap (acuan 27 Agu 2026)');
// ============================================================================
const r7 = A.rentangPreset('7-hari', ACUAN);
cek('1. 7 Hari Terakhir = 21–27 Agu (inklusif)', r7.start === '2026-08-21' && r7.end === '2026-08-27', r7);
cek('1b. 7 Hari Terakhir benar-benar 7 hari', A.jumlahHari(r7.start, r7.end) === 7, A.jumlahHari(r7.start, r7.end));

const r28 = A.rentangPreset('28-hari', ACUAN);
cek('2. 28 Hari Terakhir = 31 Jul–27 Agu', r28.start === '2026-07-31' && r28.end === '2026-08-27', r28);
cek('2b. 28 Hari Terakhir benar-benar 28 hari', A.jumlahHari(r28.start, r28.end) === 28, A.jumlahHari(r28.start, r28.end));

const rBI = A.rentangPreset('bulan-ini', ACUAN);
cek('3. Bulan Ini = 1–27 Agu', rBI.start === '2026-08-01' && rBI.end === '2026-08-27', rBI);

const rBL = A.rentangPreset('bulan-lalu', ACUAN);
cek('4. Bulan Lalu = 1–31 Jul (bulan kalender penuh)', rBL.start === '2026-07-01' && rBL.end === '2026-07-31', rBL);
cek('4b. Bulan Lalu = 31 hari', A.jumlahHari(rBL.start, rBL.end) === 31, A.jumlahHari(rBL.start, rBL.end));

const rHari = A.rentangPreset('hari-ini', ACUAN);
cek('4c. Hari Ini = satu tanggal saja', rHari.start === ACUAN && rHari.end === ACUAN, rHari);
const rKemarin = A.rentangPreset('kemarin', ACUAN);
cek('4d. Kemarin = 26 Agu saja', rKemarin.start === '2026-08-26' && rKemarin.end === '2026-08-26', rKemarin);

// Rentang dipakai sebagai RANGE (>= start && <= end), bukan equality
cek('4e. dalamRentang inklusif di kedua ujung',
  A.dalamRentang('2026-08-21', r7.start, r7.end) && A.dalamRentang('2026-08-27', r7.start, r7.end)
  && !A.dalamRentang('2026-08-20', r7.start, r7.end) && !A.dalamRentang('2026-08-28', r7.start, r7.end));
cek('4f. rentang kosong = semua tanggal lolos', A.dalamRentang('1999-01-01', '', ''));

// Kasus batas kalender
cek('4g. Bulan Lalu dari 1 Mar 2027 = 1–28 Feb 2027',
  A.rentangPreset('bulan-lalu', '2027-03-01').start === '2027-02-01' && A.rentangPreset('bulan-lalu', '2027-03-01').end === '2027-02-28');
cek('4h. Bulan Lalu dari 1 Mar 2028 = 1–29 Feb (kabisat)',
  A.rentangPreset('bulan-lalu', '2028-03-01').end === '2028-02-29');
cek('4i. Bulan Lalu dari Januari = Desember tahun sebelumnya',
  A.rentangPreset('bulan-lalu', '2026-01-15').start === '2025-12-01' && A.rentangPreset('bulan-lalu', '2026-01-15').end === '2025-12-31');
// 3 Sep mundur 6 hari (inklusif 7 hari): 3,2,1 Sep + 31,30,29,28 Agu → mulai 28 Agu.
cek('4j. 7 hari melewati batas bulan → mulai 28 Agu',
  A.rentangPreset('7-hari', '2026-09-03').start === '2026-08-28'
  && A.jumlahHari(A.rentangPreset('7-hari', '2026-09-03').start, '2026-09-03') === 7,
  A.rentangPreset('7-hari', '2026-09-03'));

cek('4k. idLama dijaga supaya Dashboard/Keuangan tidak berubah perilaku',
  A.rentangPreset('bulan-ini', ACUAN).idLama === 'this-month'
  && A.rentangPreset('bulan-lalu', ACUAN).idLama === 'month'
  && A.rentangPreset('7-hari', ACUAN).idLama === 'custom'
  && A.rentangPreset('hari-ini', ACUAN).idLama === 'day');
cek('4l. preset tak dikenal → null (tidak crash)', A.rentangPreset('ngawur', ACUAN) === null);

// ============================================================================
judul('L15. Timezone Asia/Jakarta tidak menggeser tanggal');
// ============================================================================
// 30 Agu 2026 pukul 00:30 WIB = 29 Agu 17:30 UTC. Harus tetap terbaca 30 Agu.
cek('15a. 00:30 WIB tetap tanggal WIB-nya', A.wibDayKey('2026-08-29T17:30:00.000Z') === '2026-08-30');
// 30 Agu 23:30 WIB = 30 Agu 16:30 UTC → tetap 30 Agu.
cek('15b. 23:30 WIB tidak lompat ke besok', A.wibDayKey('2026-08-30T16:30:00.000Z') === '2026-08-30');
cek('15c. tepat tengah malam WIB', A.wibDayKey('2026-08-29T17:00:00.000Z') === '2026-08-30');
cek('15d. sedetik sebelum tengah malam WIB', A.wibDayKey('2026-08-29T16:59:59.000Z') === '2026-08-29');
cek('15e. geserHari tidak terpengaruh zona perangkat', A.geserHari('2026-03-01', -1) === '2026-02-28');
cek('15f. wibMenit membaca jam WIB', A.wibMenit('2026-08-27T00:55:00.000Z') === 7 * 60 + 55, A.wibMenit('2026-08-27T00:55:00.000Z'));

// ============================================================================
judul('F. Status harian — satu status utama per orang per tanggal');
// ============================================================================
const st = (o) => A.hitungStatusHarian({ tanggal: ACUAN, hariIni: ACUAN, menitSekarang: 12 * 60, jadwal: jadwalKerja, ...o });

// 5. hadir normal
const s5 = st({ masuk: absen('u1', ACUAN, '07:55'), pulang: absen('u1', ACUAN, '17:05', 'out') });
cek('5. Hadir normal → status hadir', s5.key === A.STATUS.HADIR && !s5.konflik, s5);

// 6. terlambat
const s6 = st({ masuk: absen('u1', ACUAN, '08:15', 'in', { late: true, lateBy: 15 }), pulang: absen('u1', ACUAN, '17:05', 'out') });
cek('6. Terlambat → status terlambat + menit telat', s6.key === A.STATUS.TERLAMBAT && s6.label === 'Terlambat 15m', s6);

// 7. sakit tanpa check-in
const s7 = st({ izin: izin('u2', 'sakit', ACUAN) });
cek('7. Sakit tanpa check-in → status sakit', s7.key === A.STATUS.SAKIT && s7.label === 'Sakit', s7);

// 8. izin tanpa check-in
const s8 = st({ izin: izin('u3', 'izin', ACUAN) });
cek('8. Izin tanpa check-in → status izin', s8.key === A.STATUS.IZIN && s8.label === 'Izin', s8);

// 9. tidak ada attendance maupun izin
const s9siang = st({});
cek('9a. Siang hari kerja, belum absen → "Belum absen"', s9siang.key === A.STATUS.BELUM_ABSEN, s9siang);
const s9pagi = A.hitungStatusHarian({ tanggal: ACUAN, hariIni: ACUAN, menitSekarang: 7 * 60, jadwal: jadwalKerja });
cek('9b. Pagi sebelum jam masuk → "Belum masuk" (bukan tanpa keterangan)', s9pagi.key === A.STATUS.BELUM_MASUK, s9pagi);
const s9sore = A.hitungStatusHarian({ tanggal: ACUAN, hariIni: ACUAN, menitSekarang: 18 * 60, jadwal: jadwalKerja });
cek('9c. Setelah jam pulang → "Belum ada keterangan"', s9sore.key === A.STATUS.TANPA_DATA && s9sore.label === 'Belum ada keterangan', s9sore);
const s9lampau = A.hitungStatusHarian({ tanggal: '2026-08-20', hariIni: ACUAN, jadwal: jadwalKerja });
cek('9d. Tanggal lampau kosong → "Belum ada keterangan", BUKAN vonis alpa', s9lampau.key === A.STATUS.TANPA_DATA, s9lampau);
const s9tegas = A.hitungStatusHarian({ tanggal: '2026-08-20', hariIni: ACUAN, jadwal: jadwalKerja, tegasTanpaKeterangan: true });
cek('9e. Saklar tegasTanpaKeterangan siap dipakai nanti', s9tegas.key === A.STATUS.TANPA_KETERANGAN, s9tegas);

// 11. check-in tapi belum check-out
const s11 = st({ masuk: absen('u1', ACUAN, '07:55') });
cek('11. Check-in tanpa check-out → "Belum pulang"', s11.key === A.STATUS.BELUM_PULANG, s11);

// Libur & masa depan
cek('F-libur. Hari libur tanpa absen → Libur', st({ jadwal: jadwalLibur }).key === A.STATUS.LIBUR);
cek('F-depan. Tanggal masa depan → belum waktunya',
  A.hitungStatusHarian({ tanggal: '2026-09-30', hariIni: ACUAN, jadwal: jadwalKerja }).key === A.STATUS.BELUM_WAKTUNYA);

// Konflik data: izin approved TAPI juga absen masuk
const sKonflik = st({ izin: izin('u4', 'sakit', ACUAN), masuk: absen('u4', ACUAN, '07:55') });
cek('F-konflik. Sakit + check-in → ditandai konflik, tidak diam-diam memilih',
  sKonflik.key === A.STATUS.SAKIT && sKonflik.konflik === true, sKonflik);
cek('F-tunggal. Tidak pernah mengembalikan dua status sekaligus', typeof sKonflik.key === 'string');

// Izin yang belum disetujui tidak boleh mengubah status
const izinPending = izin('u5', 'sakit', ACUAN, null, 'pending');
cek('F-pending. Izin pending tidak dianggap status resmi',
  A.izinPadaTanggal([izinPending], ACUAN) === null);
cek('F-ditolak. Izin ditolak tidak dianggap status resmi',
  A.izinPadaTanggal([izin('u5', 'sakit', ACUAN, null, 'rejected')], ACUAN) === null);

// ============================================================================
judul('G. Rentang izin / sakit multi-hari');
// ============================================================================
const sakit3hari = izin('u6', 'sakit', '2026-08-29', '2026-08-31');
cek('10a. Sakit 29–31 Agu berlaku pada 29 Agu', A.izinBerlakuPada(sakit3hari, '2026-08-29'));
cek('10b. …juga pada 30 Agu', A.izinBerlakuPada(sakit3hari, '2026-08-30'));
cek('10c. …juga pada 31 Agu', A.izinBerlakuPada(sakit3hari, '2026-08-31'));
cek('10d. …TIDAK berlaku pada 1 Sep', !A.izinBerlakuPada(sakit3hari, '2026-09-01'));
cek('10e. …TIDAK berlaku pada 28 Agu', !A.izinBerlakuPada(sakit3hari, '2026-08-28'));

const izinLama = izin('u7', 'sakit', '2026-08-11'); // data lama TANPA dateEnd
cek('10f. Data lama tanpa dateEnd = izin 1 hari (backward compatible)',
  A.izinBerlakuPada(izinLama, '2026-08-11') && !A.izinBerlakuPada(izinLama, '2026-08-12'));
cek('10g. dateEnd rusak (lebih kecil dari date) diperlakukan 1 hari',
  A.izinSelesai(izin('u7', 'izin', '2026-08-11', '2026-08-01')) === '2026-08-11');

// ============================================================================
judul('C. Status hari ini vs aktivitas terakhir');
// ============================================================================
// 12. aktivitas terakhir = Sakit
const akt12 = A.aktivitasTerakhir({
  masukList: [absen('u8', '2026-08-20', '07:50')],
  izinList: [izin('u8', 'sakit', '2026-08-29')],
  hariIni: '2026-08-31',
});
cek('12. Aktivitas terakhir = Sakit 29 Agu', akt12.terakhir.jenis === 'sakit' && akt12.terakhir.tanggal === '2026-08-29', akt12.terakhir);
cek('12b. Terakhir hadir tetap tercatat terpisah', akt12.terakhirHadir.tanggal === '2026-08-20', akt12.terakhirHadir);

// 13. aktivitas terakhir = Hadir
const akt13 = A.aktivitasTerakhir({
  masukList: [absen('u9', '2026-08-30', '07:54'), absen('u9', '2026-08-25', '08:00')],
  izinList: [izin('u9', 'izin', '2026-08-28')],
  hariIni: '2026-08-31',
});
cek('13. Aktivitas terakhir = Hadir 30 Agu (mengalahkan izin 28 Agu)',
  akt13.terakhir.jenis === 'hadir' && akt13.terakhir.tanggal === '2026-08-30', akt13.terakhir);

// 14. sakit 3 hari lalu, hari ini tidak ada keterangan
const statusHariIni14 = A.hitungStatusHarian({
  tanggal: '2026-08-31', hariIni: '2026-08-31', menitSekarang: 18 * 60,
  izin: A.izinPadaTanggal([izin('u10', 'sakit', '2026-08-28')], '2026-08-31'),
  jadwal: jadwalKerja,
});
const akt14 = A.aktivitasTerakhir({ masukList: [], izinList: [izin('u10', 'sakit', '2026-08-28')], hariIni: '2026-08-31' });
cek('14a. Sakit 28 Agu TIDAK jadi status hari ini 31 Agu',
  statusHariIni14.key === A.STATUS.TANPA_DATA, statusHariIni14);
cek('14b. …tapi tetap muncul sebagai aktivitas terakhir: Sakit 28 Agu',
  akt14.terakhir.jenis === 'sakit' && akt14.terakhir.tanggal === '2026-08-28', akt14.terakhir);

// Sakit yang rentangnya MEMANG sampai hari ini → status hari ini tetap Sakit
const statusRange = A.hitungStatusHarian({
  tanggal: '2026-08-31', hariIni: '2026-08-31', menitSekarang: 18 * 60,
  izin: A.izinPadaTanggal([sakit3hari], '2026-08-31'), jadwal: jadwalKerja,
});
cek('14c. Sakit 29–31 Agu → 31 Agu tetap Sakit', statusRange.key === A.STATUS.SAKIT, statusRange);

// Belum pernah absen sama sekali
const aktKosong = A.aktivitasTerakhir({ masukList: [], izinList: [], hariIni: '2026-08-31' });
cek('C-kosong. Belum pernah absen → aktivitas terakhir null', aktKosong.terakhir === null && aktKosong.terakhirHadir === null);

// Izin masa depan tidak dihitung sebagai aktivitas terakhir
const aktDepan = A.aktivitasTerakhir({ masukList: [], izinList: [izin('u11', 'izin', '2026-09-10')], hariIni: '2026-08-31' });
cek('C-depan. Izin bertanggal masa depan bukan "aktivitas terakhir"', aktDepan.terakhir === null, aktDepan);

// Izin berjalan dipotong di hari ini (tidak terlihat seperti aktivitas masa depan)
const aktJalan = A.aktivitasTerakhir({ masukList: [], izinList: [sakit3hari], hariIni: '2026-08-30' });
cek('C-jalan. Izin 29–31 saat ini 30 Agu → aktivitas terakhir 30 Agu', aktJalan.terakhir.tanggal === '2026-08-30', aktJalan.terakhir);

// ============================================================================
judul('H. Rekap menampilkan SEMUA karyawan (bukan hanya yang check-in)');
// ============================================================================
const tim = [
  { id: 'fajar', name: 'Fajar', division: 'mcn', jobTitle: 'Content Creator' },
  { id: 'faqih', name: 'Faqih', division: 'tap', jobTitle: 'Videographer' },
  { id: 'mujahid', name: 'Mujahid', division: 'tap', jobTitle: 'Editor' },
  { id: 'nadia', name: 'Nadia', division: 'mcn', jobTitle: 'Admin' },
];
const recs = [
  absen('fajar', ACUAN, '07:55'), absen('fajar', ACUAN, '17:05', 'out'),
  absen('nadia', ACUAN, '08:20', 'in', { late: true, lateBy: 20 }),
];
const lvs = [izin('faqih', 'sakit', ACUAN), izin('mujahid', 'izin', ACUAN)];
const idx = A.indeksAbsensi(recs);
const idxIzin = A.indeksIzin(lvs);
const barisHari = A.bangunBarisRekap({
  users: tim, indeks: idx, izinPerUser: idxIzin,
  start: ACUAN, end: ACUAN, hariIni: ACUAN, menitSekarang: 18 * 60,
  jadwalUntuk: () => jadwalKerja, sertakanTanpaData: true,
});
cek('H1. Semua 4 karyawan muncul walau hanya 2 yang check-in', barisHari.length === 4, barisHari.map(b => b.userName));
const cari = (id) => barisHari.find(b => b.userId === id);
cek('H2. Fajar → hadir tepat waktu', cari('fajar').status.key === A.STATUS.HADIR);
cek('H3. Faqih → Sakit (tanpa check-in, tetap terlihat)', cari('faqih').status.key === A.STATUS.SAKIT);
cek('H4. Mujahid → Izin', cari('mujahid').status.key === A.STATUS.IZIN);
cek('H5. Nadia → Terlambat 20m', cari('nadia').status.key === A.STATUS.TERLAMBAT && cari('nadia').status.label === 'Terlambat 20m');
cek('H6. Baris izin tidak kehilangan alasan/detail', cari('faqih').izin && cari('faqih').izin.reason === 'contoh');
cek('H7. Durasi terhitung untuk yang lengkap', cari('fajar').durasiMenit === 550, cari('fajar').durasiMenit);
cek('H8. Yang tidak punya data pun tetap punya status', !!cari('nadia').status.key);

const ringkas = A.ringkasStatus(barisHari);
cek('H9. Ringkasan menghitung hadir/izin dengan benar',
  ringkas.hadirTotal === 2 && ringkas.izinTotal === 2, ringkas);

// ============================================================================
judul('I. Rekap rentang tanggal — struktur & urutan');
// ============================================================================
const recs7 = [
  absen('fajar', '2026-08-27', '07:55'), absen('fajar', '2026-08-27', '17:00', 'out'),
  absen('fajar', '2026-08-26', '07:50'), absen('fajar', '2026-08-26', '17:00', 'out'),
  absen('faqih', '2026-08-26', '07:58'), absen('faqih', '2026-08-26', '17:02', 'out'),
  absen('fajar', '2026-08-20', '07:40'), // DI LUAR rentang 7 hari
];
const baris7 = A.bangunBarisRekap({
  users: tim, indeks: A.indeksAbsensi(recs7),
  izinPerUser: A.indeksIzin([izin('faqih', 'sakit', '2026-08-25', '2026-08-27')]),
  start: r7.start, end: r7.end, hariIni: ACUAN, menitSekarang: 18 * 60,
  jadwalUntuk: () => jadwalKerja, sertakanTanpaData: false,
});
cek('I1. Record di luar rentang tidak ikut', !baris7.some(b => b.tanggal === '2026-08-20'));
cek('I2. Semua baris ada di dalam 21–27 Agu', baris7.every(b => b.tanggal >= '2026-08-21' && b.tanggal <= '2026-08-27'));
cek('I3. Urut tanggal terbaru dulu',
  baris7.every((b, i) => i === 0 || baris7[i - 1].tanggal >= b.tanggal), baris7.map(b => b.tanggal));
cek('I4. Tanggal sama → urut nama A→Z', (() => {
  const g = baris7.filter(b => b.tanggal === '2026-08-26').map(b => b.userName);
  return g.join(',') === [...g].sort().join(',');
})(), baris7.filter(b => b.tanggal === '2026-08-26').map(b => b.userName));
cek('I5. Sakit 25–27 Agu memunculkan baris 25,26,27 untuk Faqih',
  ['2026-08-25', '2026-08-26', '2026-08-27'].every(d => baris7.some(b => b.userId === 'faqih' && b.tanggal === d)),
  baris7.filter(b => b.userId === 'faqih').map(b => b.tanggal));
cek('I6. Faqih 26 Agu: check-in + sakit → konflik ditandai',
  baris7.find(b => b.userId === 'faqih' && b.tanggal === '2026-08-26').status.konflik === true);
cek('I7. Satu orang tidak pernah dobel pada tanggal yang sama', (() => {
  const k = baris7.map(b => `${b.tanggal}|${b.userId}`);
  return new Set(k).size === k.length;
})());

// ============================================================================
judul('J. Performa — indeks dibangun sekali, tanpa N+1');
// ============================================================================
const banyakRec = [];
for (let h = 0; h < 28; h++) {
  const d = A.geserHari(ACUAN, -h);
  for (let u = 0; u < 30; u++) { banyakRec.push(absen('user' + u, d, '08:00')); banyakRec.push(absen('user' + u, d, '17:00', 'out')); }
}
const timBesar = Array.from({ length: 30 }, (_, i) => ({ id: 'user' + i, name: 'User ' + String(i).padStart(2, '0'), division: 'mcn', jobTitle: 'Staf' }));
const t0 = process.hrtime.bigint();
const idxBesar = A.indeksAbsensi(banyakRec);
const barisBesar = A.bangunBarisRekap({
  users: timBesar, indeks: idxBesar, izinPerUser: new Map(),
  start: r28.start, end: r28.end, hariIni: ACUAN, menitSekarang: 18 * 60,
  jadwalUntuk: () => jadwalKerja, sertakanTanpaData: true,
});
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
cek('J1. 30 karyawan × 28 hari = 840 baris', barisBesar.length === 840, barisBesar.length);
cek(`J2. Selesai < 250ms (aktual ${ms.toFixed(1)}ms)`, ms < 250, ms);
cek('J3. Indeks absensi mengelompokkan 1680 record jadi 840 grup', idxBesar.perHari.size === 840, idxBesar.perHari.size);

// ============================================================================
judul('Ketahanan data kotor');
// ============================================================================
cek('X1. Record tanpa userId/timestamp diabaikan, tidak crash',
  A.indeksAbsensi([null, {}, { userId: 'a' }, { timestamp: '2026-08-27T01:00:00Z' }]).perHari.size === 0);
cek('X2. bangunBarisRekap tanpa argumen tidak crash', Array.isArray(A.bangunBarisRekap()));
cek('X3. hitungStatusHarian tanpa argumen tidak crash', !!A.hitungStatusHarian().key);
cek('X4. Izin untuk user yang sudah dihapus tidak memunculkan baris hantu',
  A.bangunBarisRekap({
    users: tim, indeks: A.indeksAbsensi([]), izinPerUser: A.indeksIzin([izin('sudah-dihapus', 'izin', ACUAN)]),
    start: ACUAN, end: ACUAN, hariIni: ACUAN, jadwalUntuk: () => jadwalKerja,
  }).length === 0);
cek('X5. parseJam menolak nilai tidak valid', A.parseJam('') === null && A.parseJam('abc') === null && A.parseJam('08:00') === 480);
cek('X6. Izin dobel pada tanggal sama → dipilih satu (yang terbaru dibuat)', (() => {
  const a = izin('u', 'sakit', ACUAN, null, 'approved', { id: 'a', createdAt: '2026-08-26T01:00:00Z' });
  const b = izin('u', 'sakit', ACUAN, null, 'approved', { id: 'b', createdAt: '2026-08-26T05:00:00Z' });
  return A.izinPadaTanggal([a, b], ACUAN).id === 'b';
})());

// ============================================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`RINGKASAN: ${lulus} LULUS, ${gagal} GAGAL`);
console.log('='.repeat(60));
process.exit(gagal ? 1 : 0);
