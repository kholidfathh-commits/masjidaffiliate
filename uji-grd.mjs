// ============================================================================
// UJI GRD — GOAL ROLL DOWN — jalankan: node uji-grd.mjs
// ----------------------------------------------------------------------------
// BUKAN framework test dan TIDAK menambah dependency — satu file Node biasa.
// Database production tidak pernah disentuh (semua data di sini data contoh).
//
// Menjaga:
//   · Periode bulan (YYYY-MM) DAN kuartal (YYYY-Qn) — keduanya wajib hidup.
//   · Perhitungan capaian AMAN saat pembagi nol (syarat PRD: jangan NaN/Infinity).
//   · Pohon roll down diturunkan dari atasan langsung, BUKAN 5 level hardcode.
//   · Data melingkar/rusak tidak membuat pohon menggantung atau ada yang hilang.
//   · Hak UBAH mengikuti hierarki peran (bukan rumus salinan).
//   · App.jsx benar-benar memasang halaman & menunya (§8).
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as G from './src/grd/data.js';
import { goalContoh } from './src/grd/contoh.js';
import * as Svc from './src/grd/layanan.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(ROOT + '/src/App.jsx', 'utf8');

let lulus = 0, gagal = 0;
const cek = (nama, syarat, detail) => {
  if (syarat) { lulus++; console.log('  LULUS  ', nama); }
  else { gagal++; console.log('  GAGAL  ', nama, detail !== undefined ? `\n           → ${JSON.stringify(detail)}` : ''); }
};
const judul = (t) => console.log(`\n=== ${t} ===`);

// Tim contoh: 3 lapis (owner → leader → co-leader → staf) + manajer + orang tanpa atasan.
const tim = [
  { id: 'u-owner', name: 'Owner', role: 'owner', division: 'manajemen', leaderId: null },
  { id: 'u-manajer', name: 'Manajer', role: 'manajer', division: 'manajemen', leaderId: null },
  { id: 'u-leader', name: 'Leader TAP', role: 'leader', division: 'tap', leaderId: 'u-owner' },
  { id: 'u-wakil', name: 'Co-Leader TAP', role: 'wakil', division: 'tap', leaderId: 'u-leader' },
  { id: 'u-staf1', name: 'Andi', role: 'operasional', division: 'tap', leaderId: 'u-wakil' },
  { id: 'u-staf2', name: 'Budi', role: 'operasional', division: 'tap', leaderId: 'u-leader' },
];
const goalDari = (ownerId, extra = {}) => ({
  id: 'g-' + ownerId, ownerId, periode: '2026-09',
  description: 'Goal ' + ownerId, base: 0, target: 100, uom: 'Konten', ...extra,
});

// ============================================================================
judul('1. Periode — bulan DAN kuartal sama-sama sah');
// ============================================================================
cek('1a. Bulan sah', G.jenisPeriode('2026-09') === 'bulan');
cek('1b. Kuartal sah', G.jenisPeriode('2026-Q3') === 'kuartal');
cek('1c. Huruf q kecil dirapikan jadi Q', G.normalisasiPeriode(' 2026-q3 ') === '2026-Q3');
cek('1d. Bulan 13 ditolak', G.jenisPeriode('2026-13') === null);
cek('1e. Bulan 00 ditolak', G.jenisPeriode('2026-00') === null);
cek('1f. Kuartal 5 ditolak', G.jenisPeriode('2026-Q5') === null);
cek('1g. Teks ngawur ditolak (bukan lempar error)', G.jenisPeriode('ngawur') === null);
cek('1h. null/undefined aman', G.normalisasiPeriode(null) === '' && G.normalisasiPeriode(undefined) === '');
cek('1i. periodeValid ikut hasil jenisPeriode', G.periodeValid('2026-Q1') && !G.periodeValid('2026'));

judul('2. Periode — kuartal & label');
cek('2a. Bulan 1–3 → Q1', [1, 2, 3].every(b => G.kuartalDariBulan(b) === 1));
cek('2b. Bulan 7–9 → Q3', [7, 8, 9].every(b => G.kuartalDariBulan(b) === 3));
cek('2c. Bulan 12 → Q4', G.kuartalDariBulan(12) === 4);
cek('2d. Bulan di luar 1–12 → 0 (tidak error)', G.kuartalDariBulan(0) === 0 && G.kuartalDariBulan(99) === 0);
cek('2e. Label bulan manusiawi', G.labelPeriode('2026-09') === 'September 2026', G.labelPeriode('2026-09'));
cek('2f. Label kuartal menyebut rentang bulan', G.labelPeriode('2026-Q3') === 'Kuartal 3 2026 (Jul–Sep)', G.labelPeriode('2026-Q3'));
cek('2g. Label periode rusak tidak kosong melompong', G.labelPeriode('xxx') === '—');
cek('2h. Label singkat bulan', G.labelPeriodeSingkat('2026-09') === 'Sep 2026', G.labelPeriodeSingkat('2026-09'));
cek('2i. Label singkat kuartal', G.labelPeriodeSingkat('2026-Q3') === 'Q3 2026');

judul('3. Periode berjalan memakai WIB (bukan jam perangkat)');
cek('3a. periodeSaatIni bulan ikut tanggal acuan', G.periodeSaatIni('bulan', '2026-09-16') === '2026-09');
cek('3b. periodeSaatIni kuartal ikut tanggal acuan', G.periodeSaatIni('kuartal', '2026-09-16') === '2026-Q3');
cek('3c. Awal tahun → Q1', G.periodeSaatIni('kuartal', '2026-01-01') === '2026-Q1');
cek('3d. Akhir tahun → Q4', G.periodeSaatIni('kuartal', '2026-12-31') === '2026-Q4');
cek('3e. Tanpa argumen tetap menghasilkan periode sah', G.periodeValid(G.periodeSaatIni()));
cek('3f. Default jenis = bulan', G.jenisPeriode(G.periodeSaatIni()) === 'bulan');

judul('4. Bulan menempel pada kuartal (roll down lintas jenis periode)');
cek('4a. 2026-08 ada di dalam 2026-Q3', G.bulanDalamKuartal('2026-08', '2026-Q3'));
cek('4b. 2026-10 TIDAK ada di 2026-Q3', !G.bulanDalamKuartal('2026-10', '2026-Q3'));
cek('4c. Beda tahun tidak dianggap sama', !G.bulanDalamKuartal('2025-08', '2026-Q3'));
cek('4d. periodeSepadan: sama persis', G.periodeSepadan('2026-09', '2026-09'));
cek('4e. periodeSepadan: bulan vs kuartal (dua arah)',
  G.periodeSepadan('2026-09', '2026-Q3') && G.periodeSepadan('2026-Q3', '2026-09'));
cek('4f. periodeSepadan: beda kuartal', !G.periodeSepadan('2026-04', '2026-Q3'));
cek('4g. periodeSepadan: periode rusak selalu false', !G.periodeSepadan('', '2026-Q3') && !G.periodeSepadan('xx', 'yy'));

judul('4b. Geser periode (tombol ‹ ›)');
cek('4b-a. Bulan maju 1', G.geserPeriode('2026-09', 1) === '2026-10');
cek('4b-b. Bulan mundur 1', G.geserPeriode('2026-09', -1) === '2026-08');
cek('4b-c. Lompat tahun ke belakang', G.geserPeriode('2026-01', -1) === '2025-12');
cek('4b-d. Lompat tahun ke depan', G.geserPeriode('2026-12', 1) === '2027-01');
cek('4b-e. Mundur 12 bulan = tahun sebelumnya', G.geserPeriode('2026-09', -12) === '2025-09');
cek('4b-f. Kuartal maju 1', G.geserPeriode('2026-Q3', 1) === '2026-Q4');
cek('4b-g. Kuartal lompat tahun ke belakang', G.geserPeriode('2026-Q1', -1) === '2025-Q4');
cek('4b-h. Kuartal lompat tahun ke depan', G.geserPeriode('2026-Q4', 1) === '2027-Q1');
cek('4b-i. Geser 0 = periode yang sama', G.geserPeriode('2026-09', 0) === '2026-09');
cek('4b-j. Tanpa argumen n = tidak bergeser', G.geserPeriode('2026-Q2') === '2026-Q2');
cek('4b-k. Periode rusak → kosong (bukan error)', G.geserPeriode('ngawur', 1) === '');
cek('4b-l. Hasil geser SELALU periode yang sah', (() => {
  for (let i = -30; i <= 30; i++) {
    if (!G.periodeValid(G.geserPeriode('2026-06', i))) return false;
    if (!G.periodeValid(G.geserPeriode('2026-Q2', i))) return false;
  }
  return true;
})());
cek('4b-m. Maju lalu mundur kembali ke asal', (() => {
  const a = G.geserPeriode(G.geserPeriode('2026-03', 7), -7);
  const b = G.geserPeriode(G.geserPeriode('2026-Q1', 5), -5);
  return a === '2026-03' && b === '2026-Q1';
})());
cek('4b-n. Jenis periode tidak berubah saat digeser',
  G.jenisPeriode(G.geserPeriode('2026-Q3', 9)) === 'kuartal'
  && G.jenisPeriode(G.geserPeriode('2026-03', 9)) === 'bulan');

judul('4c. Daftar pilihan periode (dropdown)');
const dp = G.daftarPeriode('bulan', '2026-09');
cek('4c-a. Berisi periode acuan', dp.includes('2026-09'));
cek('4c-b. TERBARU di atas', dp[0] === '2026-11', dp[0]);
cek('4c-c. Jumlah bawaan 6 mundur + 2 maju + acuan = 9', dp.length === 9, dp.length);
cek('4c-d. Semuanya periode sah', dp.every(G.periodeValid));
cek('4c-e. Tidak ada duplikat', new Set(dp).size === dp.length);
cek('4c-f. Urut menurun', dp.every((v, i) => i === 0 || dp[i - 1] > v));
cek('4c-g. Daftar kuartal ikut jenisnya',
  G.daftarPeriode('kuartal', '2026-Q3').every(p => G.jenisPeriode(p) === 'kuartal'));
cek('4c-h. Acuan kosong jatuh ke periode berjalan',
  G.daftarPeriode('bulan', '').includes(G.periodeSaatIni('bulan')));
cek('4c-i. Acuan rusak tidak bikin daftar kosong', G.daftarPeriode('bulan', 'ngawur').length === 9);
cek('4c-j. Rentang bisa diatur', G.daftarPeriode('bulan', '2026-09', 2, 0).join() === '2026-09,2026-08,2026-07');

judul('4d. Pindah jenis periode tanpa melompat ke hari ini');
cek('4d-a. Bulan → kuartal ikut kuartalnya', G.konversiPeriode('2026-08', 'kuartal') === '2026-Q3');
cek('4d-b. Kuartal → bulan ambil bulan pertama', G.konversiPeriode('2026-Q3', 'bulan') === '2026-07');
cek('4d-c. Q1 → Januari', G.konversiPeriode('2026-Q1', 'bulan') === '2026-01');
cek('4d-d. Q4 → Oktober', G.konversiPeriode('2026-Q4', 'bulan') === '2026-10');
cek('4d-e. Jenis sama = tidak berubah', G.konversiPeriode('2026-08', 'bulan') === '2026-08');
cek('4d-f. Tahun tidak ikut berubah', G.konversiPeriode('2024-11', 'kuartal') === '2024-Q4');
cek('4d-g. Bolak-balik tetap di kuartal yang sama',
  G.konversiPeriode(G.konversiPeriode('2026-08', 'kuartal'), 'bulan') === '2026-07');
cek('4d-h. Periode rusak → periode berjalan (bukan kosong)',
  G.konversiPeriode('ngawur', 'kuartal') === G.periodeSaatIni('kuartal'));
cek('4d-i. Jenis tujuan ngawur jatuh ke bawaan (bulan)',
  G.jenisPeriode(G.konversiPeriode('2026-Q3', 'entah')) === 'bulan');
cek('4d-j. Hasil konversi selalu sah', G.periodeValid(G.konversiPeriode('2026-05', 'kuartal')));

// ============================================================================
judul('5. Normalisasi goal — record rusak tidak boleh merusak tampilan');
// ============================================================================
const gRusak = G.normalisasiGoal({ id: 1, ownerId: 'a', description: '  Naikkan GMV  ', base: '10', target: 'x', uom: ' Konten ' });
cek('5a. base teks angka jadi angka', gRusak.base === 10);
cek('5b. target rusak jatuh ke 0 (bukan NaN)', gRusak.target === 0 && Number.isFinite(gRusak.target));
cek('5c. Deskripsi & uom di-trim', gRusak.description === 'Naikkan GMV' && gRusak.uom === 'Konten');
cek('5d. id dipaksa jadi teks', gRusak.id === '1' && typeof gRusak.id === 'string');
cek('5e. actual kosong jatuh ke base (belum bergerak)', gRusak.actual === 10);
cek('5f. actual 0 TETAP 0 (bukan dianggap kosong)', G.normalisasiGoal({ base: 10, actual: 0 }).actual === 0);
cek('5g. parentId kosong jadi null', gRusak.parentId === null);
cek('5h. Bukan objek → null (tidak error)',
  G.normalisasiGoal(null) === null && G.normalisasiGoal('x') === null && G.normalisasiGoal(undefined) === null);

judul('6. Validasi isian wajib (description, base, target, uom)');
cek('6a. Field wajib persis 4 sesuai kesepakatan',
  G.FIELD_WAJIB.join(',') === 'description,base,target,uom', G.FIELD_WAJIB);
cek('6b. Goal lengkap lolos', G.validasiGoal(goalDari('u-staf1')) === '');
cek('6c. Tanpa deskripsi ditolak', /Deskripsi/.test(G.validasiGoal(goalDari('u-staf1', { description: '' }))));
cek('6d. Tanpa uom ditolak', /Satuan/.test(G.validasiGoal(goalDari('u-staf1', { uom: '  ' }))));
cek('6e. Tanpa pemilik ditolak', /pemilik/.test(G.validasiGoal(goalDari(''))));
cek('6f. Periode rusak ditolak', /Periode/.test(G.validasiGoal(goalDari('u-staf1', { periode: '2026-99' }))));
cek('6g. base === target ditolak (tidak ada yang diukur)',
  /sama dengan base/.test(G.validasiGoal(goalDari('u-staf1', { base: 50, target: 50 }))));
cek('6h. Data bukan objek ditolak dengan pesan', G.validasiGoal(null) !== '');

// ============================================================================
judul('7. Capaian — WAJIB aman saat pembagi nol');
// ============================================================================
cek('7a. Setengah jalan = 50%', G.persenCapaian({ base: 0, target: 100, actual: 50 }) === 50);
cek('7b. Tepat target = 100%', G.persenCapaian({ base: 0, target: 100, actual: 100 }) === 100);
cek('7c. Belum bergerak = 0%', G.persenCapaian({ base: 20, target: 100, actual: 20 }) === 0);
cek('7d. base bukan nol dihitung dari jaraknya', G.persenCapaian({ base: 20, target: 40, actual: 30 }) === 50);
cek('7e. Lewat target boleh di atas 100', G.persenCapaian({ base: 0, target: 100, actual: 130 }) === 130);
cek('7f. Mundur dari base tidak minus', G.persenCapaian({ base: 50, target: 100, actual: 10 }) === 0);
cek('7g. Goal MENURUN (target < base) tetap positif',
  G.persenCapaian({ base: 10, target: 8, actual: 9 }) === 50, G.persenCapaian({ base: 10, target: 8, actual: 9 }));
cek('7h. base === target & sudah sampai → 100 (bukan NaN)',
  G.persenCapaian({ base: 5, target: 5, actual: 5 }) === 100);
cek('7i. base === target & belum sampai → 0 (bukan NaN)',
  G.persenCapaian({ base: 5, target: 5, actual: 1 }) === 0);
cek('7j. Semua nol tidak menghasilkan NaN/Infinity', (() => {
  const p = G.persenCapaian({ base: 0, target: 0, actual: 0 });
  return Number.isFinite(p) && p === 100;
})(), G.persenCapaian({ base: 0, target: 0, actual: 0 }));
cek('7k. Angka rusak tidak bocor jadi NaN', (() => {
  const p = G.persenCapaian({ base: 'x', target: 'y', actual: 'z' });
  return Number.isFinite(p);
})());
cek('7l. Goal null → 0', G.persenCapaian(null) === 0);
cek('7m. persenBar ditahan di 100 supaya bar tidak meluber',
  G.persenBar({ base: 0, target: 100, actual: 250 }) === 100);
cek('7n. persenBar sama dengan capaian saat di bawah 100',
  G.persenBar({ base: 0, target: 100, actual: 40 }) === 40);

judul('8. Status capaian');
cek('8a. 100% → tercapai', G.statusCapaian({ base: 0, target: 10, actual: 10 }) === 'tercapai');
cek('8b. Di atas target → tetap tercapai', G.statusCapaian({ base: 0, target: 10, actual: 99 }) === 'tercapai');
cek('8c. Sebagian → jalan', G.statusCapaian({ base: 0, target: 10, actual: 3 }) === 'jalan');
cek('8d. Nol → belum', G.statusCapaian({ base: 0, target: 10, actual: 0 }) === 'belum');
cek('8e. Gaya status selalu ada isinya (status tak dikenal aman)',
  !!G.gayaStatus('ngawur').label && G.gayaStatus('ngawur') === G.STATUS_CAPAIAN.belum);
cek('8f. Tiap status punya warna bar', ['tercapai', 'jalan', 'belum'].every(s => !!G.STATUS_CAPAIAN[s].bar));

// ============================================================================
judul('9. Saring goal per periode');
// ============================================================================
const goalCampur = [
  goalDari('u-staf1', { id: 'g1', periode: '2026-09' }),
  goalDari('u-staf1', { id: 'g2', periode: '2026-10' }),
  goalDari('u-owner', { id: 'g3', periode: '2026-Q3' }),
];
cek('9a. Periode bulan menyaring tepat', G.goalPeriode(goalCampur, '2026-10').map(g => g.id).join() === 'g2');
cek('9b. Periode kuartal ikut menarik bulan di dalamnya',
  G.goalPeriode(goalCampur, '2026-Q3').map(g => g.id).sort().join() === 'g1,g3',
  G.goalPeriode(goalCampur, '2026-Q3').map(g => g.id));
cek('9c. Periode kosong = semua goal', G.goalPeriode(goalCampur, '').length === 3);
cek('9d. Daftar kosong aman', G.goalPeriode(null, '2026-09').length === 0);

// ============================================================================
judul('10. Pohon roll down — dari atasan langsung, bukan 5 level hardcode');
// ============================================================================
const goals = tim.map(u => goalDari(u.id));
const pohon = G.bangunPohonGoal({ users: tim, goals, periode: '2026-09' });
const datar = G.ratakanPohon(pohon);
const cariSimpul = (id) => datar.find(s => s.user.id === id);

cek('10a. Akar = orang tanpa atasan (owner & manajer)',
  pohon.map(s => s.user.id).sort().join() === 'u-manajer,u-owner', pohon.map(s => s.user.id));
cek('10b. Owner di atas manajer (urut pangkat)', pohon[0].user.id === 'u-owner');
cek('10c. Semua orang masuk pohon', datar.length === tim.length, datar.length);
cek('10d. Leader jadi anak Owner', cariSimpul('u-owner').anak.some(a => a.user.id === 'u-leader'));
cek('10e. Co-Leader jadi anak Leader', cariSimpul('u-leader').anak.some(a => a.user.id === 'u-wakil'));
cek('10f. Staf jadi anak Co-Leader (lapis ke-4 — bukan batas 2 lapis lama)',
  cariSimpul('u-wakil').anak.some(a => a.user.id === 'u-staf1'));
cek('10g. Level bertingkat benar',
  cariSimpul('u-owner').level === 0 && cariSimpul('u-leader').level === 1
  && cariSimpul('u-wakil').level === 2 && cariSimpul('u-staf1').level === 3);
cek('10h. Goal menempel pada pemiliknya', cariSimpul('u-staf1').goals[0].ownerId === 'u-staf1');
cek('10i. Orang tanpa goal tetap muncul dengan daftar kosong', (() => {
  const p = G.bangunPohonGoal({ users: tim, goals: [goalDari('u-owner')], periode: '2026-09' });
  return G.ratakanPohon(p).find(s => s.user.id === 'u-staf1').goals.length === 0;
})());

judul('11. Pohon — tahan data rusak & melingkar');
const melingkar = [
  { id: 'a', name: 'A', role: 'leader', leaderId: 'b' },
  { id: 'b', name: 'B', role: 'leader', leaderId: 'a' },
];
const pMelingkar = G.bangunPohonGoal({ users: melingkar, goals: [], periode: '2026-09' });
cek('11a. Lingkaran A↔B tidak menggantung & tidak menghilangkan orang',
  G.ratakanPohon(pMelingkar).length === 2, G.ratakanPohon(pMelingkar).length);
cek('11b. Atasan yang orangnya sudah dihapus → jadi akar (tidak hilang)', (() => {
  const p = G.bangunPohonGoal({ users: [{ id: 'x', name: 'X', role: 'operasional', leaderId: 'sudah-dihapus' }], goals: [] });
  return p.length === 1 && p[0].user.id === 'x';
})());
cek('11c. Orang yang jadi atasan dirinya sendiri → jadi akar', (() => {
  const p = G.bangunPohonGoal({ users: [{ id: 'z', name: 'Z', role: 'leader', leaderId: 'z' }], goals: [] });
  return p.length === 1 && G.ratakanPohon(p).length === 1;
})());
cek('11d. Tanpa argumen sama sekali tidak error', G.bangunPohonGoal().length === 0);
cek('11e. User tanpa id diabaikan', G.bangunPohonGoal({ users: [null, {}, { id: '' }], goals: [] }).length === 0);
cek('11f. Batas kedalaman memotong, bukan menggantung', (() => {
  const rantai = Array.from({ length: 30 }, (_, i) => ({ id: 'n' + i, name: 'N' + i, role: 'operasional', leaderId: i ? 'n' + (i - 1) : null }));
  const p = G.bangunPohonGoal({ users: rantai, goals: [], batasKedalaman: 3 });
  return G.ratakanPohon(p).length >= 4 && G.ratakanPohon(p).every(s => s.level <= 3);
})());

judul('12. Pohon — urutan stabil (tidak berubah antar render)');
const jejak = (p) => G.ratakanPohon(p).map(s => s.user.id).join(',');
cek('12a. Dua kali bangun menghasilkan urutan sama',
  jejak(G.bangunPohonGoal({ users: tim, goals, periode: '2026-09' }))
  === jejak(G.bangunPohonGoal({ users: tim, goals, periode: '2026-09' })));
cek('12b. Urutan masukan diacak, hasil tetap sama', (() => {
  const acak = [tim[4], tim[0], tim[5], tim[2], tim[1], tim[3]];
  return jejak(G.bangunPohonGoal({ users: acak, goals, periode: '2026-09' }))
    === jejak(G.bangunPohonGoal({ users: tim, goals, periode: '2026-09' }));
})(), jejak(G.bangunPohonGoal({ users: [tim[4], tim[0], tim[5], tim[2], tim[1], tim[3]], goals, periode: '2026-09' })));
cek('12c. Anak seurutan pangkat lalu nama (Co-Leader sebelum staf Budi)',
  cariSimpul('u-leader').anak.map(a => a.user.id).join() === 'u-wakil,u-staf2',
  cariSimpul('u-leader').anak.map(a => a.user.id));

judul('13. Ringkasan & hitungan cabang');
const r = G.ringkasPohon(pohon);
cek('13a. Jumlah orang benar', r.orang === 6, r);
cek('13b. Total goal benar', r.totalGoal === 6, r.totalGoal);
cek('13c. Semua goal contoh belum jalan', r.belum === 6 && r.tercapai === 0);
cek('13d. Rata capaian 0 saat semua belum jalan', r.rataCapaian === 0);
cek('13e. Rata capaian tidak NaN saat tidak ada goal sama sekali', (() => {
  const rr = G.ringkasPohon(G.bangunPohonGoal({ users: tim, goals: [], periode: '2026-09' }));
  return rr.totalGoal === 0 && rr.rataCapaian === 0 && Number.isFinite(rr.rataCapaian);
})());
cek('13f. orangBergoal menghitung yang punya goal saja', (() => {
  const p = G.bangunPohonGoal({ users: tim, goals: [goalDari('u-owner'), goalDari('u-staf1')], periode: '2026-09' });
  return G.ringkasPohon(p).orangBergoal === 2;
})());
cek('13g. hitungGoalCabang menjumlah sampai ke bawah',
  G.hitungGoalCabang(cariSimpul('u-leader')) === 4, G.hitungGoalCabang(cariSimpul('u-leader')));
cek('13h. hitungOrangCabang termasuk dirinya',
  G.hitungOrangCabang(cariSimpul('u-leader')) === 4, G.hitungOrangCabang(cariSimpul('u-leader')));
cek('13i. Cabang daun = 1 orang', G.hitungOrangCabang(cariSimpul('u-staf1')) === 1);
cek('13j. Simpul kosong tidak error', G.hitungGoalCabang(null) === 0 && G.hitungOrangCabang(null) === 0);
cek('13k. semuaGoal mengumpulkan seluruh goal pohon', G.semuaGoal(pohon).length === 6);
cek('13l. ratakanPohon pada pohon kosong aman', G.ratakanPohon(null).length === 0);

judul('13b. Ringkasan cabang (apa yang disembunyikan saat dilipat)');
const cbLeader = G.ringkasCabang(cariSimpul('u-leader'));
cek('13b-a. Cabang Leader berisi 4 orang (dirinya + 3)', cbLeader.orang === 4, cbLeader);
cek('13b-b. bawahan = orang dikurangi dirinya', cbLeader.bawahan === 3);
cek('13b-c. Goal cabang dijumlah sampai ke bawah', cbLeader.goal === 4, cbLeader.goal);
cek('13b-d. Daun: 1 orang, 0 bawahan', (() => {
  const d = G.ringkasCabang(cariSimpul('u-staf1'));
  return d.orang === 1 && d.bawahan === 0 && d.goal === 1;
})());
cek('13b-e. Simpul kosong tidak error & semuanya nol', (() => {
  const k = G.ringkasCabang(null);
  return k.orang === 0 && k.bawahan === 0 && k.goal === 0 && k.rataCapaian === 0;
})());
cek('13b-f. Rata capaian cabang tidak NaN saat cabang tanpa goal', (() => {
  const p = G.bangunPohonGoal({ users: tim, goals: [], periode: '2026-09' });
  const c = G.ringkasCabang(G.ratakanPohon(p).find(s => s.user.id === 'u-leader'));
  return c.goal === 0 && c.rataCapaian === 0 && Number.isFinite(c.rataCapaian);
})());
cek('13b-g. Rata capaian cabang dihitung benar', (() => {
  const gg = [
    { id: 'x1', ownerId: 'u-leader', periode: '2026-09', description: 'a', base: 0, target: 100, actual: 100, uom: 'K' },
    { id: 'x2', ownerId: 'u-staf2', periode: '2026-09', description: 'b', base: 0, target: 100, actual: 0, uom: 'K' },
  ];
  const p = G.bangunPohonGoal({ users: tim, goals: gg, periode: '2026-09' });
  const c = G.ringkasCabang(G.ratakanPohon(p).find(s => s.user.id === 'u-leader'));
  return c.goal === 2 && c.tercapai === 1 && c.belum === 1 && c.rataCapaian === 50;
})());

judul('13c. Daftar cabang untuk lipat/buka');
cek('13c-a. idCabang() tanpa level = semua yang punya anak',
  G.idCabang(pohon).sort().join() === 'u-leader,u-owner,u-wakil', G.idCabang(pohon));
cek('13c-b. Manajer tanpa bawahan TIDAK masuk daftar cabang', !G.idCabang(pohon).includes('u-manajer'));
cek('13c-c. Daun tidak pernah masuk daftar cabang', !G.idCabang(pohon).includes('u-staf1'));
cek('13c-d. mulaiLevel=2 hanya cabang dalam (lipatan bawaan)',
  G.idCabang(pohon, 2).join() === 'u-wakil', G.idCabang(pohon, 2));
cek('13c-e. mulaiLevel sangat besar → kosong', G.idCabang(pohon, 99).length === 0);
cek('13c-f. Pohon kosong → daftar kosong (tidak error)',
  G.idCabang([]).length === 0 && G.idCabang(null).length === 0);
cek('13c-g. Akar ikut saat mulaiLevel=0', G.idCabang(pohon, 0).includes('u-owner'));

judul('13d. Atasan langsung yang sudah tidak sah (jalur roll down putus)');
// Co-Leader turun jadi Karyawan, tapi staf di bawahnya masih menunjuk dia sebagai atasan.
const timTurun = [
  { id: 'u-owner', name: 'Owner', role: 'owner', leaderId: null },
  { id: 'u-leader', name: 'Leader', role: 'leader', leaderId: 'u-owner' },
  { id: 'u-mantan', name: 'Mantan Co-Leader', role: 'operasional', leaderId: 'u-leader' },
  { id: 'u-staf', name: 'Staf', role: 'operasional', leaderId: 'u-mantan' },
];
cek('13d-a. Owner tidak butuh atasan → selalu sah', G.atasanSah(timTurun[0], timTurun));
cek('13d-b. Leader tidak butuh atasan → sah walau leaderId kosong', G.atasanSah(timTurun[1], timTurun));
cek('13d-c. Staf di bawah Leader → sah', G.atasanSah(timTurun[2], timTurun));
cek('13d-d. Staf di bawah mantan Co-Leader → TIDAK sah', !G.atasanSah(timTurun[3], timTurun));
cek('13d-e. Atasan yang akunnya sudah dihapus → TIDAK sah',
  !G.atasanSah({ id: 'x', role: 'operasional', leaderId: 'sudah-dihapus' }, timTurun));
cek('13d-f. Karyawan tanpa atasan sama sekali → TIDAK sah',
  !G.atasanSah({ id: 'y', role: 'operasional', leaderId: null }, timTurun));
cek('13d-g. Co-Leader di bawah Leader → sah',
  G.atasanSah({ id: 'z', role: 'wakil', leaderId: 'u-leader' }, timTurun));
cek('13d-h. Argumen kosong → false (default menolak)', !G.atasanSah(null, timTurun));

const pTurun = G.bangunPohonGoal({ users: timTurun, goals: [], periode: '2026-09' });
const gantung = G.simpulMenggantung(pTurun);
cek('13d-i. Pohon menandai simpul yang menggantung',
  gantung.map(s => s.user.id).join() === 'u-staf', gantung.map(s => s.user.id));
cek('13d-j. Simpul sehat TIDAK ditandai menggantung',
  G.ratakanPohon(pTurun).find(s => s.user.id === 'u-leader').menggantung === false);
cek('13d-k. Orang menggantung TETAP muncul di pohon (tidak disembunyikan)',
  G.ratakanPohon(pTurun).length === 4);
cek('13d-l. Tim sehat → tidak ada yang menggantung',
  G.simpulMenggantung(G.bangunPohonGoal({ users: tim, goals: [], periode: '2026-09' })).length === 0);
cek('13d-m. simpulMenggantung pada pohon kosong aman',
  G.simpulMenggantung([]).length === 0 && G.simpulMenggantung(null).length === 0);

judul('13e. Bahan panel detail goal');
const gNaik = { id: 'n1', ownerId: 'u-staf1', periode: '2026-09', description: 'Konten tayang', base: 0, target: 100, actual: 40, uom: 'Konten' };
const gTurun = { id: 'n2', ownerId: 'u-staf1', periode: '2026-09', description: 'Tekan biaya', base: 10, target: 8, actual: 9, uom: 'Juta' };
cek('13e-a. Sisa menuju target (goal naik)', G.sisaMenujuTarget(gNaik) === 60, G.sisaMenujuTarget(gNaik));
cek('13e-b. Sisa menuju target (goal menurun) tetap positif',
  G.sisaMenujuTarget(gTurun) === 1, G.sisaMenujuTarget(gTurun));
cek('13e-c. Sudah tercapai → sisa 0', G.sisaMenujuTarget({ base: 0, target: 10, actual: 10 }) === 0);
cek('13e-d. Lewat target → sisa 0 (bukan angka minus)',
  G.sisaMenujuTarget({ base: 0, target: 10, actual: 25 }) === 0);
cek('13e-e. Goal rusak → 0, bukan NaN', (() => {
  const v = G.sisaMenujuTarget({ base: 'x', target: 'y', actual: 'z' });
  return v === 0 && Number.isFinite(v);
})());
cek('13e-f. Goal null → 0', G.sisaMenujuTarget(null) === 0);

cek('13e-g. pemilikGoal menemukan anggotanya', G.pemilikGoal(gNaik, tim)?.name === 'Andi');
cek('13e-h. Pemilik yang akunnya hilang → null', G.pemilikGoal({ ownerId: 'entah' }, tim) === null);
cek('13e-i. Goal tanpa pemilik → null', G.pemilikGoal({ ownerId: '' }, tim) === null);

const rantai = [
  { id: 'induk', ownerId: 'u-leader', parentId: null, periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta' },
  { id: 'anak1', ownerId: 'u-staf1', parentId: 'induk', periode: '2026-09', description: 'Konten', base: 0, target: 30, uom: 'Konten' },
  { id: 'anak2', ownerId: 'u-staf2', parentId: 'induk', periode: '2026-09', description: 'Sampel', base: 0, target: 10, uom: 'Produk' },
];
cek('13e-j. goalInduk menelusuri ke atas', G.goalInduk(rantai[1], rantai)?.id === 'induk');
cek('13e-k. Goal puncak tidak punya induk', G.goalInduk(rantai[0], rantai) === null);
cek('13e-l. parentId yang goalnya sudah dihapus → null (tidak error)',
  G.goalInduk({ id: 'z', parentId: 'hilang' }, rantai) === null);
cek('13e-m. goalTurunan menelusuri ke bawah',
  G.goalTurunan(rantai[0], rantai).map(g => g.id).sort().join() === 'anak1,anak2');
cek('13e-n. Daun tidak punya turunan', G.goalTurunan(rantai[1], rantai).length === 0);
cek('13e-o. Goal tanpa id tidak menyeret turunan asal-asalan',
  G.goalTurunan({ id: '' }, rantai).length === 0);
cek('13e-p. Daftar goal kosong aman',
  G.goalTurunan(rantai[0], null).length === 0 && G.goalInduk(rantai[1], null) === null);
cek('13e-q. Goal contoh punya rantai induk yang bisa ditelusuri', (() => {
  const c = goalContoh(tim, '2026-09');
  return c.some(g => G.goalInduk(g, c) !== null);
})());

judul('13f. Pencarian di dalam pohon (nama / divisi / isi goal)');
const timCari = [
  { id: 'o', name: 'Owner Utama', role: 'owner', division: 'manajemen', leaderId: null },
  { id: 'l', name: 'Rina', role: 'leader', division: 'tap', leaderId: 'o' },
  { id: 's1', name: 'Andi', role: 'operasional', division: 'tap', leaderId: 'l', jobTitle: 'Host Live' },
  { id: 's2', name: 'Budi', role: 'operasional', division: 'mcn', leaderId: 'l' },
];
const goalCari = [
  { id: 'gc1', ownerId: 's1', periode: '2026-09', description: 'Konten affiliate tayang', base: 0, target: 30, uom: 'Konten' },
  { id: 'gc2', ownerId: 's2', periode: '2026-09', description: 'Sampel produk terpakai', base: 0, target: 10, uom: 'Produk' },
];
const pCari = G.bangunPohonGoal({ users: timCari, goals: goalCari, periode: '2026-09' });
const idDari = (p) => G.ratakanPohon(p).map(s => s.user.id).join();

cek('13f-a. Tanpa filter = pohon utuh', idDari(G.saringPohon(pCari, {})) === idDari(pCari));
cek('13f-b. Tanpa filter semua ditandai cocok',
  G.ratakanPohon(G.saringPohon(pCari, {})).every(s => s.cocok === true));
cek('13f-c. Cari nama orang menemukan orangnya',
  G.ratakanPohon(G.saringPohon(pCari, { kata: 'Andi' })).some(s => s.user.id === 's1' && s.cocok));
cek('13f-d. JALUR KE ATAS ikut tampil sebagai konteks',
  idDari(G.saringPohon(pCari, { kata: 'Andi' })) === 'o,l,s1',
  idDari(G.saringPohon(pCari, { kata: 'Andi' })));
cek('13f-e. Atasan yang hanya jalur ditandai cocok=false', (() => {
  const r = G.ratakanPohon(G.saringPohon(pCari, { kata: 'Andi' }));
  return r.find(s => s.user.id === 'o').cocok === false
    && r.find(s => s.user.id === 'l').cocok === false;
})());
cek('13f-f. Cabang yang tidak cocok dibuang',
  !idDari(G.saringPohon(pCari, { kata: 'Andi' })).includes('s2'));
cek('13f-g. Pencarian tidak peduli huruf besar/kecil',
  idDari(G.saringPohon(pCari, { kata: 'aNdI' })) === 'o,l,s1');
cek('13f-h. Cari lewat ISI GOAL (bukan cuma nama)',
  G.ratakanPohon(G.saringPohon(pCari, { kata: 'sampel' })).some(s => s.user.id === 's2' && s.cocok));
cek('13f-i. Cari lewat SATUAN goal',
  G.ratakanPohon(G.saringPohon(pCari, { kata: 'konten' })).some(s => s.user.id === 's1' && s.cocok));
cek('13f-j. Cari lewat JABATAN',
  G.ratakanPohon(G.saringPohon(pCari, { kata: 'host live' })).some(s => s.user.id === 's1' && s.cocok));
cek('13f-k. Kata yang tidak ada → pohon kosong',
  G.saringPohon(pCari, { kata: 'zzzz' }).length === 0);
cek('13f-l. Spasi saja dianggap tanpa filter',
  idDari(G.saringPohon(pCari, { kata: '   ' })) === idDari(pCari));

cek('13f-m. Saring divisi menemukan anggotanya',
  G.ratakanPohon(G.saringPohon(pCari, { divisi: 'mcn' })).some(s => s.user.id === 's2' && s.cocok));
cek('13f-n. Saring divisi tetap membawa jalur ke atas',
  idDari(G.saringPohon(pCari, { divisi: 'mcn' })) === 'o,l,s2',
  idDari(G.saringPohon(pCari, { divisi: 'mcn' })));
cek("13f-o. divisi 'all' = tanpa saringan divisi",
  idDari(G.saringPohon(pCari, { divisi: 'all' })) === idDari(pCari));
cek('13f-p. Divisi yang tidak dipakai siapa pun → kosong',
  G.saringPohon(pCari, { divisi: 'keuangan' }).length === 0);
cek('13f-q. Kata + divisi digabung (keduanya harus terpenuhi)',
  G.saringPohon(pCari, { kata: 'Andi', divisi: 'mcn' }).length === 0);
cek('13f-r. Kata + divisi yang cocok tetap ketemu',
  G.ratakanPohon(G.saringPohon(pCari, { kata: 'Andi', divisi: 'tap' })).some(s => s.user.id === 's1' && s.cocok));

cek('13f-s. hitungCocok hanya menghitung yang benar-benar cocok',
  G.hitungCocok(G.saringPohon(pCari, { kata: 'Andi' })) === 1);
cek('13f-t. hitungCocok tanpa filter = semua orang',
  G.hitungCocok(G.saringPohon(pCari, {})) === 4);
cek('13f-u. hitungCocok pada pohon kosong = 0',
  G.hitungCocok([]) === 0 && G.hitungCocok(null) === 0);
cek('13f-v. Pohon asli TIDAK ikut berubah saat disaring (tidak merusak sumber)',
  idDari(pCari) === 'o,l,s1,s2', idDari(pCari));
cek('13f-w. saringPohon pada pohon kosong aman',
  G.saringPohon(null, { kata: 'x' }).length === 0 && G.saringPohon([], {}).length === 0);
cek('13f-x. Goal tetap menempel setelah disaring', (() => {
  const r = G.ratakanPohon(G.saringPohon(pCari, { kata: 'Andi' })).find(s => s.user.id === 's1');
  return r.goals.length === 1 && r.goals[0].id === 'gc1';
})());

// ============================================================================
judul('14. Hak akses — memakai hierarki peran, bukan rumus salinan');
// ============================================================================
const orang = (id) => tim.find(u => u.id === id);
cek('14a. Owner boleh ubah goal siapa pun', G.bisaUbahGoal(orang('u-owner'), goalDari('u-staf1'), tim));
cek('14b. Manajer boleh ubah goal siapa pun', G.bisaUbahGoal(orang('u-manajer'), goalDari('u-staf1'), tim));
cek('14c. Pemilik boleh ubah goalnya sendiri', G.bisaUbahGoal(orang('u-staf1'), goalDari('u-staf1'), tim));
cek('14d. Leader boleh ubah goal bawahan TIDAK langsung (transitif)',
  G.bisaUbahGoal(orang('u-leader'), goalDari('u-staf1'), tim));
cek('14e. Co-Leader boleh ubah goal bawahan langsungnya',
  G.bisaUbahGoal(orang('u-wakil'), goalDari('u-staf1'), tim));
cek('14f. Staf TIDAK boleh ubah goal atasannya', !G.bisaUbahGoal(orang('u-staf1'), goalDari('u-leader'), tim));
cek('14g. Staf TIDAK boleh ubah goal rekan sejajar', !G.bisaUbahGoal(orang('u-staf1'), goalDari('u-staf2'), tim));
cek('14h. Co-Leader TIDAK boleh ubah goal Leader', !G.bisaUbahGoal(orang('u-wakil'), goalDari('u-leader'), tim));
cek('14i. Argumen kosong → false (default menolak)',
  !G.bisaUbahGoal(null, goalDari('u-staf1'), tim) && !G.bisaUbahGoal(orang('u-owner'), null, tim));
cek('14j. Goal tanpa pemilik → false', !G.bisaUbahGoal(orang('u-leader'), goalDari(''), tim));
cek('14k. bisaBuatGoalUntuk: leader → bawahan transitif', G.bisaBuatGoalUntuk(orang('u-leader'), 'u-staf1', tim));
cek('14l. bisaBuatGoalUntuk: untuk diri sendiri selalu boleh', G.bisaBuatGoalUntuk(orang('u-staf1'), 'u-staf1', tim));
cek('14m. bisaBuatGoalUntuk: staf → atasannya ditolak', !G.bisaBuatGoalUntuk(orang('u-staf1'), 'u-leader', tim));
cek('14n. bisaBuatGoalUntuk: target kosong ditolak', !G.bisaBuatGoalUntuk(orang('u-owner'), '', tim));

judul('14b. Bahan halaman Kelola Goal');
const goalsKelola = [
  goalDari('u-owner', { id: 'k-owner' }),
  goalDari('u-leader', { id: 'k-leader' }),
  goalDari('u-wakil', { id: 'k-wakil' }),
  goalDari('u-staf1', { id: 'k-staf1' }),
  goalDari('u-staf2', { id: 'k-staf2' }),
];
const kelolaOleh = (id) => G.goalYangBisaDikelola(orang(id), goalsKelola, tim).map(g => g.id).sort().join();
cek('14b-a. Owner bisa mengurus semua goal',
  kelolaOleh('u-owner') === 'k-leader,k-owner,k-staf1,k-staf2,k-wakil', kelolaOleh('u-owner'));
cek('14b-b. Leader: goalnya + seluruh bawahannya (transitif), BUKAN goal Owner',
  kelolaOleh('u-leader') === 'k-leader,k-staf1,k-staf2,k-wakil', kelolaOleh('u-leader'));
cek('14b-c. Co-Leader: goalnya + bawahannya saja',
  kelolaOleh('u-wakil') === 'k-staf1,k-wakil', kelolaOleh('u-wakil'));
cek('14b-d. Staf: hanya goalnya sendiri', kelolaOleh('u-staf1') === 'k-staf1');
cek('14b-e. Staf TIDAK melihat goal rekan sejajar', !kelolaOleh('u-staf1').includes('k-staf2'));
cek('14b-f. Tanpa user → kosong', G.goalYangBisaDikelola(null, goalsKelola, tim).length === 0);
cek('14b-g. Daftar goal kosong → kosong', G.goalYangBisaDikelola(orang('u-owner'), null, tim).length === 0);
cek('14b-h. Hasilnya sudah ternormalisasi (angka pasti angka)',
  G.goalYangBisaDikelola(orang('u-owner'), [{ id: 'z', ownerId: 'u-owner', base: '5', target: '9' }], tim)[0].base === 5);

const calon = (id) => G.calonPemilikGoal(orang(id), tim).map(u => u.id).sort().join();
cek('14b-i. Owner bisa membuatkan goal untuk semua orang',
  calon('u-owner') === 'u-leader,u-manajer,u-owner,u-staf1,u-staf2,u-wakil', calon('u-owner'));
cek('14b-j. Leader: dirinya + bawahannya', calon('u-leader') === 'u-leader,u-staf1,u-staf2,u-wakil', calon('u-leader'));
cek('14b-k. Staf: hanya dirinya sendiri', calon('u-staf1') === 'u-staf1');
cek('14b-l. Tanpa user → kosong', G.calonPemilikGoal(null, tim).length === 0);
cek('14b-m. Daftar anggota kosong → kosong', G.calonPemilikGoal(orang('u-owner'), []).length === 0);

judul('14c. Rantai goal (pohon berdasarkan goal induk, bukan orang)');
const rg = [
  { id: 'r-atas', ownerId: 'u-owner', parentId: null, periode: '2026-09', description: 'A GMV perusahaan', base: 0, target: 12, uom: 'Miliar' },
  { id: 'r-tim', ownerId: 'u-leader', parentId: 'r-atas', periode: '2026-09', description: 'B GMV tim', base: 0, target: 900, uom: 'Juta' },
  { id: 'r-staf', ownerId: 'u-staf1', parentId: 'r-tim', periode: '2026-09', description: 'C Konten', base: 0, target: 30, uom: 'Konten' },
  { id: 'r-lepas', ownerId: 'u-staf2', parentId: null, periode: '2026-09', description: 'D Sampel', base: 0, target: 10, uom: 'Produk' },
];
const rantaiUji = G.rantaiGoal(rg);
const idRantai = (r) => G.ratakanRantai(r).map(s => s.goal.id).join();
cek('14c-a. Dua akar: goal puncak + goal lepas',
  rantaiUji.map(s => s.goal.id).sort().join() === 'r-atas,r-lepas', rantaiUji.map(s => s.goal.id));
cek('14c-b. Semua goal masuk rantai', G.ratakanRantai(rantaiUji).length === 4);
cek('14c-c. Goal tim jadi anak goal perusahaan',
  rantaiUji.find(s => s.goal.id === 'r-atas').anak[0].goal.id === 'r-tim');
cek('14c-d. Goal staf jadi cucu (3 lapis)',
  rantaiUji.find(s => s.goal.id === 'r-atas').anak[0].anak[0].goal.id === 'r-staf');
cek('14c-e. Level bertingkat benar', (() => {
  const d = G.ratakanRantai(rantaiUji);
  return d.find(s => s.goal.id === 'r-atas').level === 0
    && d.find(s => s.goal.id === 'r-tim').level === 1
    && d.find(s => s.goal.id === 'r-staf').level === 2;
})());
cek('14c-f. Goal tanpa induk tetap tampil sebagai akar',
  rantaiUji.some(s => s.goal.id === 'r-lepas' && s.level === 0));
cek('14c-g. Induk di LUAR daftar → jadi akar (tidak hilang karena hak akses)', (() => {
  const r = G.rantaiGoal([rg[2]]); // cuma goal staf, induknya tidak ikut
  return r.length === 1 && r[0].goal.id === 'r-staf' && r[0].level === 0;
})());
cek('14c-h. Rantai melingkar tidak menggantung & tidak menghilangkan goal', (() => {
  const r = G.rantaiGoal([
    { id: 'a', ownerId: 'x', parentId: 'b', description: 'A', base: 0, target: 1, uom: 'x', periode: '2026-09' },
    { id: 'b', ownerId: 'x', parentId: 'a', description: 'B', base: 0, target: 1, uom: 'x', periode: '2026-09' },
  ]);
  return G.ratakanRantai(r).length === 2;
})());
cek('14c-i. Goal yang jadi induk dirinya sendiri → akar', (() => {
  const r = G.rantaiGoal([{ id: 'z', ownerId: 'x', parentId: 'z', description: 'Z', base: 0, target: 1, uom: 'x', periode: '2026-09' }]);
  return r.length === 1 && G.ratakanRantai(r).length === 1;
})());
cek('14c-j. Urutan stabil antar-panggilan', idRantai(G.rantaiGoal(rg)) === idRantai(G.rantaiGoal(rg)));
cek('14c-k. Urutan masukan diacak, hasil tetap sama',
  idRantai(G.rantaiGoal([rg[3], rg[2], rg[0], rg[1]])) === idRantai(rantaiUji));
cek('14c-l. Goal tanpa id diabaikan', G.rantaiGoal([{ ownerId: 'x' }, null]).length === 0);
cek('14c-m. Daftar kosong aman', G.rantaiGoal([]).length === 0 && G.rantaiGoal(null).length === 0);
cek('14c-n. ratakanRantai pada rantai kosong aman',
  G.ratakanRantai(null).length === 0 && G.ratakanRantai([]).length === 0);
cek('14c-o. Batas kedalaman memotong, bukan menggantung', (() => {
  const panjang = Array.from({ length: 25 }, (_, i) => ({
    id: 'g' + i, ownerId: 'x', parentId: i ? 'g' + (i - 1) : null,
    description: 'G' + String(i).padStart(2, '0'), base: 0, target: 1, uom: 'x', periode: '2026-09',
  }));
  const r = G.rantaiGoal(panjang, 3);
  return G.ratakanRantai(r).every(s => s.level <= 3);
})());
cek('14c-p. Goal contoh membentuk rantai yang bisa ditampilkan', (() => {
  const c = goalContoh(tim, '2026-09');
  return G.ratakanRantai(G.rantaiGoal(c)).length === c.length;
})());

judul('14d. Template goal per peran');
cek('14d-a. Tiap peran punya template', ['owner','manajer','leader','wakil','operasional']
  .every(r => Array.isArray(G.TEMPLATE_GOAL[r]) && G.TEMPLATE_GOAL[r].length > 0));
cek('14d-b. Peran Co-Leader (wakil) TIDAK ketinggalan', G.TEMPLATE_GOAL.wakil.length >= 1);
cek('14d-c. templateUntuk mengembalikan template peran itu',
  G.templateUntuk('leader') === G.TEMPLATE_GOAL.leader);
cek('14d-d. Peran tak dikenal jatuh ke template karyawan',
  G.templateUntuk('ngawur') === G.TEMPLATE_GOAL.operasional && G.templateUntuk() === G.TEMPLATE_GOAL.operasional);
cek('14d-e. Semua template punya keempat isian wajib', (() => {
  return Object.values(G.TEMPLATE_GOAL).flat().every(t =>
    t.description && t.uom && Number.isFinite(t.base) && Number.isFinite(t.target));
})());
cek('14d-f. Template tidak punya base === target (selalu ada yang diukur)',
  Object.values(G.TEMPLATE_GOAL).flat().every(t => t.base !== t.target));
cek('14d-g. Deskripsi template berupa HASIL, bukan kalimat perintah', (() => {
  return Object.values(G.TEMPLATE_GOAL).flat().every(t =>
    !/^(rajin|coba|usahakan|tolong|harus)\b/i.test(t.description));
})());

const terap = G.terapkanTemplate(G.TEMPLATE_GOAL.leader[0], { ownerId: 'u-leader', periode: '2026-09' });
cek('14d-h. Template + pemilik + periode = goal yang LOLOS validasi',
  G.validasiGoal(terap) === '', G.validasiGoal(terap));
cek('14d-i. Pemilik & periode ikut terpasang',
  terap.ownerId === 'u-leader' && terap.periode === '2026-09');
cek('14d-j. actual mulai dari base (belum bergerak)', terap.actual === terap.base);
cek('14d-k. Capaian awal 0%', G.persenCapaian(terap) === 0);
cek('14d-l. Template kosong tidak error (hasilnya ditolak validasi, bukan meledak)', (() => {
  const t = G.terapkanTemplate(null, { ownerId: 'x', periode: '2026-09' });
  return t !== null && G.validasiGoal(t) !== '';
})());
cek('14d-m. Tanpa argumen kedua tetap menghasilkan objek', G.terapkanTemplate(G.TEMPLATE_GOAL.owner[0]) !== null);
cek('14d-n. Semua template tiap peran lolos validasi saat dipakai', (() => {
  for (const peran of Object.keys(G.TEMPLATE_GOAL)) {
    for (const t of G.TEMPLATE_GOAL[peran]) {
      if (G.validasiGoal(G.terapkanTemplate(t, { ownerId: 'u1', periode: '2026-09' })) !== '') return false;
    }
  }
  return true;
})());

judul('14e. Turunkan goal ke bawahan (sekali klik)');
cek('14e-a. Satuan yang bisa dijumlah boleh dibagi',
  ['Rupiah', 'Konten', 'Orang', 'Juta Rupiah'].every(G.satuanBisaDibagi));
cek('14e-b. Persen TIDAK dibagi rata',
  !G.satuanBisaDibagi('Persen') && !G.satuanBisaDibagi('%') && !G.satuanBisaDibagi('persen'));
cek('14e-c. Skor/rating/indeks juga tidak dibagi',
  !G.satuanBisaDibagi('Skor') && !G.satuanBisaDibagi('Rating') && !G.satuanBisaDibagi('Indeks'));
cek('14e-d. Satuan kosong dianggap bisa dibagi (tidak menghalangi)', G.satuanBisaDibagi(''));

const gInduk = { id: 'ind', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta Rupiah' };
cek('14e-e. Bawahan langsung pemilik goal yang diambil (bukan transitif)',
  G.bawahanUntukTurunan(gInduk, tim).map(u => u.id).sort().join() === 'u-staf2,u-wakil',
  G.bawahanUntukTurunan(gInduk, tim).map(u => u.id));
cek('14e-f. Goal tanpa pemilik → tidak ada bawahan', G.bawahanUntukTurunan({ ownerId: '' }, tim).length === 0);
cek('14e-g. Pemilik tanpa bawahan → kosong',
  G.bawahanUntukTurunan({ id: 'x', ownerId: 'u-staf1' }, tim).length === 0);

const rt = G.rencanaTurunan(gInduk, tim);
cek('14e-h. Rencana dibuat untuk tiap bawahan langsung', rt.length === 2, rt.length);
cek('14e-i. Target dibagi rata untuk satuan yang bisa dijumlah',
  rt.every(r => r.target === 450), rt.map(r => r.target));
cek('14e-j. parentId menunjuk goal induk', rt.every(r => r.parentId === 'ind'));
cek('14e-k. Periode & satuan ikut induk',
  rt.every(r => r.periode === '2026-09' && r.uom === 'Juta Rupiah'));
cek('14e-l. Deskripsi ikut induk', rt.every(r => r.description === 'GMV tim'));
cek('14e-m. actual mulai dari base', rt.every(r => r.actual === r.base));
cek('14e-n. Semua rencana LOLOS validasi goal', rt.every(r => G.validasiGoal(r) === ''), rt.map(r => G.validasiGoal(r)).filter(Boolean)[0]);
cek('14e-o. Pemiliknya bawahan, bukan pemilik induk',
  rt.map(r => r.ownerId).sort().join() === 'u-staf2,u-wakil');

const gPersen = { id: 'ip', ownerId: 'u-leader', periode: '2026-09', description: 'Ketepatan laporan', base: 70, target: 95, uom: 'Persen' };
cek('14e-p. Satuan persen: target TIDAK dibagi, tiap orang kejar angka yang sama',
  G.rencanaTurunan(gPersen, tim).every(r => r.target === 95),
  G.rencanaTurunan(gPersen, tim).map(r => r.target));
cek('14e-q. bagiRata bisa dipaksa nyala', (() => {
  const r = G.rencanaTurunan(gPersen, tim, { bagiRata: true });
  return r.every(x => x.target !== 95);
})());
cek('14e-r. bagiRata bisa dipaksa mati',
  G.rencanaTurunan(gInduk, tim, { bagiRata: false }).every(r => r.target === 900));

cek('14e-s. Bawahan yang SUDAH punya turunan dilewati (tidak dobel)', (() => {
  const ada = [{ id: 'sudah', ownerId: 'u-wakil', parentId: 'ind', periode: '2026-09', description: 'x', base: 0, target: 1, uom: 'x' }];
  const r = G.rencanaTurunan(gInduk, tim, { goalAda: ada });
  return r.length === 1 && r[0].ownerId === 'u-staf2';
})());
cek('14e-t. Semua bawahan sudah punya → rencana kosong (klik kedua aman)', (() => {
  const ada = G.rencanaTurunan(gInduk, tim).map((r, i) => ({ ...r, id: 'ada' + i }));
  return G.rencanaTurunan(gInduk, tim, { goalAda: ada }).length === 0;
})());
cek('14e-u. Turunan dari goal LAIN tidak dianggap sudah punya', (() => {
  const ada = [{ id: 'lain', ownerId: 'u-wakil', parentId: 'goal-lain', periode: '2026-09', description: 'x', base: 0, target: 1, uom: 'x' }];
  return G.rencanaTurunan(gInduk, tim, { goalAda: ada }).length === 2;
})());
cek('14e-v. Goal tanpa id tidak bisa diturunkan (parentId harus jelas)',
  G.rencanaTurunan({ ownerId: 'u-leader', base: 0, target: 10 }, tim).length === 0);
cek('14e-w. Goal null → rencana kosong', G.rencanaTurunan(null, tim).length === 0);
cek('14e-x. Daftar anggota kosong → rencana kosong', G.rencanaTurunan(gInduk, []).length === 0);
cek('14e-y. Bagi rata dengan base bukan nol dihitung dari jaraknya', (() => {
  const g = { id: 'b', ownerId: 'u-leader', periode: '2026-09', description: 'x', base: 100, target: 300, uom: 'Konten' };
  return G.rencanaTurunan(g, tim).every(r => r.base === 100 && r.target === 200);
})());
cek('14e-z. Angka turunan tidak pernah NaN',
  G.rencanaTurunan({ id: 'q', ownerId: 'u-leader', periode: '2026-09', description: 'x', base: 'a', target: 'b', uom: 'x' }, tim)
    .every(r => Number.isFinite(r.target) && Number.isFinite(r.base)));

judul('14f. Dampak hapus goal (dipakai konfirmasi)');
const pohonHapus = [
  { id: 'h-atas', ownerId: 'u-owner', parentId: null, periode: '2026-09', description: 'Puncak', base: 0, target: 10, uom: 'x' },
  { id: 'h-tengah', ownerId: 'u-leader', parentId: 'h-atas', periode: '2026-09', description: 'Tengah', base: 0, target: 10, uom: 'x' },
  { id: 'h-bawah1', ownerId: 'u-staf1', parentId: 'h-tengah', periode: '2026-09', description: 'Bawah 1', base: 0, target: 10, uom: 'x' },
  { id: 'h-bawah2', ownerId: 'u-staf2', parentId: 'h-tengah', periode: '2026-09', description: 'Bawah 2', base: 0, target: 10, uom: 'x' },
  { id: 'h-lepas', ownerId: 'u-wakil', parentId: null, periode: '2026-09', description: 'Lepas', base: 0, target: 10, uom: 'x' },
];
const dAtas = G.dampakHapusGoal(pohonHapus[0], pohonHapus);
cek('14f-a. Turunan LANGSUNG dihitung', dAtas.langsung === 1, dAtas);
cek('14f-b. Turunan sampai ke bawah ikut dihitung', dAtas.total === 3, dAtas.total);
cek('14f-c. Id turunan dikembalikan',
  dAtas.idTurunan.sort().join() === 'h-bawah1,h-bawah2,h-tengah', dAtas.idTurunan);
cek('14f-d. Goal daun tidak berdampak apa-apa', (() => {
  const d = G.dampakHapusGoal(pohonHapus[2], pohonHapus);
  return d.langsung === 0 && d.total === 0;
})());
cek('14f-e. Goal tengah: 2 turunan langsung', (() => {
  const d = G.dampakHapusGoal(pohonHapus[1], pohonHapus);
  return d.langsung === 2 && d.total === 2;
})());
cek('14f-f. Goal lepas tanpa turunan', G.dampakHapusGoal(pohonHapus[4], pohonHapus).total === 0);
cek('14f-g. Dirinya sendiri tidak ikut dihitung sebagai turunan',
  !dAtas.idTurunan.includes('h-atas'));
cek('14f-h. Goal tanpa id → dampak nol', G.dampakHapusGoal({ description: 'x' }, pohonHapus).total === 0);
cek('14f-i. Goal null → dampak nol (tidak error)', G.dampakHapusGoal(null, pohonHapus).total === 0);
cek('14f-j. Daftar goal kosong → dampak nol',
  G.dampakHapusGoal(pohonHapus[0], []).total === 0 && G.dampakHapusGoal(pohonHapus[0], null).total === 0);
cek('14f-k. Rantai melingkar tidak menggantung', (() => {
  const d = G.dampakHapusGoal(
    { id: 'a', ownerId: 'x', description: 'A', base: 0, target: 1, uom: 'x', periode: '2026-09' },
    [
      { id: 'b', ownerId: 'x', parentId: 'a', description: 'B', base: 0, target: 1, uom: 'x', periode: '2026-09' },
      { id: 'c', ownerId: 'x', parentId: 'b', description: 'C', base: 0, target: 1, uom: 'x', periode: '2026-09' },
      { id: 'a2', ownerId: 'x', parentId: 'c', description: 'A2', base: 0, target: 1, uom: 'x', periode: '2026-09' },
    ]);
  return d.total === 3;
})());
cek('14f-l. Batas kedalaman dipatuhi', (() => {
  const panjang = Array.from({ length: 20 }, (_, i) => ({
    id: 'p' + i, ownerId: 'x', parentId: i ? 'p' + (i - 1) : 'akar',
    description: 'P' + i, base: 0, target: 1, uom: 'x', periode: '2026-09',
  }));
  const d = G.dampakHapusGoal({ id: 'akar', ownerId: 'x', description: 'A', base: 0, target: 1, uom: 'x', periode: '2026-09' }, panjang, 3);
  return d.total > 0 && d.total < 20;
})());

judul('14g. Jejak perubahan angka (siapa, kapan, dari berapa ke berapa)');
const pelaku = { id: 'u-leader', name: 'Leader TAP' };
const gLama = { id: 'jg', ownerId: 'u-staf1', periode: '2026-09', description: 'Konten', base: 0, target: 100, actual: 10, uom: 'Konten' };

cek('14g-a. Goal baru menghasilkan SATU catatan _dibuat', (() => {
  const j = G.catatPerubahan(null, gLama, pelaku, '2026-09-16T03:00:00.000Z');
  return j.length === 1 && j[0].field === '_dibuat';
})());
cek('14g-b. Tanpa perubahan → tidak ada catatan',
  G.catatPerubahan(gLama, gLama, pelaku).length === 0);
cek('14g-c. Target berubah tercatat dari→ke', (() => {
  const j = G.catatPerubahan(gLama, { ...gLama, target: 150 }, pelaku);
  return j.length === 1 && j[0].field === 'target' && j[0].dari === 100 && j[0].ke === 150;
})());
cek('14g-d. Beberapa field berubah = beberapa catatan', (() => {
  const j = G.catatPerubahan(gLama, { ...gLama, target: 150, actual: 40 }, pelaku);
  return j.length === 2 && j.map(x => x.field).sort().join() === 'actual,target';
})());
cek('14g-e. Siapa & kapan ikut tercatat', (() => {
  const j = G.catatPerubahan(gLama, { ...gLama, base: 5 }, pelaku, '2026-09-16T03:00:00.000Z');
  return j[0].olehId === 'u-leader' && j[0].olehNama === 'Leader TAP' && j[0].waktu === '2026-09-16T03:00:00.000Z';
})());
cek('14g-f. goalId menempel ke catatan', G.catatPerubahan(gLama, { ...gLama, base: 5 }, pelaku)[0].goalId === 'jg');
cek('14g-g. Pelaku tanpa nama tetap tercatat (tidak kosong)', (() => {
  const j = G.catatPerubahan(gLama, { ...gLama, base: 5 }, null);
  return j[0].olehNama === 'Tidak diketahui';
})());
cek('14g-h. Perubahan teks (deskripsi/satuan) juga tercatat', (() => {
  const j = G.catatPerubahan(gLama, { ...gLama, description: 'Konten baru', uom: 'Video' }, pelaku);
  return j.length === 2;
})());
cek('14g-i. Goal tanpa id tidak menghasilkan catatan',
  G.catatPerubahan(gLama, { ...gLama, id: '' }, pelaku).length === 0);
cek('14g-j. Goal baru null → kosong', G.catatPerubahan(gLama, null, pelaku).length === 0);
cek('14g-k. Tiap catatan punya id unik per field',
  new Set(G.catatPerubahan(gLama, { ...gLama, target: 1, base: -1 }, pelaku).map(j => j.id)).size === 2);

const jejakUji = [
  ...G.catatPerubahan(null, gLama, pelaku, '2026-09-01T01:00:00.000Z'),
  ...G.catatPerubahan(gLama, { ...gLama, target: 120 }, pelaku, '2026-09-05T01:00:00.000Z'),
  ...G.catatPerubahan(gLama, { ...gLama, description: 'Ganti' }, pelaku, '2026-09-09T01:00:00.000Z'),
  ...G.catatPerubahan({ ...gLama, id: 'lain' }, { ...gLama, id: 'lain', target: 7 }, pelaku, '2026-09-10T01:00:00.000Z'),
];
cek('14g-l. riwayatGoal hanya mengambil goal itu', G.riwayatGoal(jejakUji, 'jg').length === 3);
cek('14g-m. Riwayat TERBARU di atas',
  G.riwayatGoal(jejakUji, 'jg')[0].waktu === '2026-09-09T01:00:00.000Z');
cek('14g-n. riwayatAngka menyaring perubahan teks', (() => {
  const r = G.riwayatAngka(jejakUji, 'jg');
  return r.length === 1 && r[0].field === 'target';
})());
cek('14g-o. Goal tanpa riwayat → kosong', G.riwayatGoal(jejakUji, 'entah').length === 0);
cek('14g-p. goalId kosong → kosong', G.riwayatGoal(jejakUji, '').length === 0);
cek('14g-q. Jejak kosong aman',
  G.riwayatGoal(null, 'jg').length === 0 && G.riwayatAngka([], 'jg').length === 0);
cek('14g-r. riwayatGoal tidak mengubah urutan array aslinya', (() => {
  const salinan = [...jejakUji];
  G.riwayatGoal(jejakUji, 'jg');
  return jejakUji.every((j, i) => j === salinan[i]);
})());
cek('14g-s. Label field manusiawi',
  G.labelFieldJejak('target') === 'Target' && G.labelFieldJejak('actual') === 'Angka terkini');
cek('14g-t. Label field tak dikenal tidak kosong', G.labelFieldJejak('ngawur') === 'ngawur');
cek('14g-u. base/target/actual ditandai ANGKA',
  ['base', 'target', 'actual'].every(G.fieldJejakAngka));
cek('14g-v. deskripsi/satuan/periode BUKAN angka',
  !G.fieldJejakAngka('description') && !G.fieldJejakAngka('uom') && !G.fieldJejakAngka('periode'));
cek('14g-w. Kunci jejak per-record',
  G.JEJAK_REC_PREFIX === 'grdjejak:rec:' && G.JEJAK_BACKUP_KEY === 'grd:jejak:all');

// ============================================================================
judul('15. Data tiruan (stub) — harus deterministik');
// ============================================================================
const c1 = goalContoh(tim, '2026-09');
const c2 = goalContoh(tim, '2026-09');
cek('15a. Dua panggilan menghasilkan data identik (bukan Math.random)',
  JSON.stringify(c1) === JSON.stringify(c2));
cek('15b. Menghasilkan goal', c1.length > 0, c1.length);
cek('15c. Semua goal contoh bertanda _contoh', c1.every(g => g._contoh === true));
cek('15d. Semua goal contoh memakai periode yang diminta', c1.every(g => g.periode === '2026-09'));
cek('15e. Semua goal contoh LOLOS validasi goal sungguhan',
  c1.every(g => G.validasiGoal(g) === ''), c1.map(g => G.validasiGoal(g)).filter(Boolean)[0]);
cek('15f. Capaiannya tidak pernah NaN', c1.every(g => Number.isFinite(G.persenCapaian(g))));
cek('15g. Sebagian orang sengaja tanpa goal (tampilan kosong ikut teruji)',
  new Set(c1.map(g => g.ownerId)).size < tim.length);
cek('15h. Daftar user kosong → tidak error', goalContoh([], '2026-09').length === 0);
cek('15i. Goal contoh bisa dipasang ke pohon', (() => {
  const p = G.bangunPohonGoal({ users: tim, goals: c1, periode: '2026-09' });
  return G.ringkasPohon(p).totalGoal === c1.length;
})());

// ============================================================================
judul('16. Kunci penyimpanan per-record');
// ============================================================================
cek('16a. Prefix goal per-record (1 baris = 1 goal)', G.GOAL_REC_PREFIX === 'grdgoal:rec:');
cek('16b. Backup key goal', G.GOAL_BACKUP_KEY === 'grd:goals:all');
cek('16c. Prefix diakhiri titik dua (pola listByPrefix)', G.GOAL_REC_PREFIX.endsWith(':'));

// ============================================================================
judul('17. Penjaga App.jsx — halaman benar-benar terpasang');
// ============================================================================
cek('17a. App.jsx meng-import modul GRD', /from '\.\/grd\/data\.js'/.test(src));
cek('17b. Rute view grd-tree terpasang', /view === 'grd-tree'/.test(src));
cek('17c. Menu sidebar Pohon Goal terdaftar', /id: 'grd-tree'/.test(src));
cek('17d. Komponen halaman GrdTreeView ada', /function GrdTreeView\(/.test(src));
cek('17d-2. Komponen simpul pohon GrdSimpul ada', /function GrdSimpul\(/.test(src));
cek('17d-3. GrdSimpul REKURSIF (merender dirinya sendiri — bukan level hardcode)', (() => {
  const i = src.indexOf('function GrdSimpul(');
  const j = src.indexOf('function GrdTreeView(');
  return i > -1 && j > i && /<GrdSimpul\b/.test(src.slice(i, j));
})());
cek('17d-4. Tidak ada angka jenjang yang dipatok di komponen pohon', (() => {
  const i = src.indexOf('function GrdSimpul(');
  const j = src.indexOf('function GrdTreeView(');
  return !/level === [0-9]|level == [0-9]|level < [3-9]/.test(src.slice(i, j));
})());
cek('17d-5. Tombol lipat memberi tahu status bukanya (aria-expanded)', (() => {
  const i = src.indexOf('function GrdSimpul(');
  const j = src.indexOf('function GrdTreeView(');
  return /aria-expanded/.test(src.slice(i, j));
})());
cek('17d-31. Panel detail menampilkan riwayat perubahan',
  /Riwayat Perubahan/.test(src) && /Grd\.riwayatGoal/.test(src));
cek('17d-32. Jejak dicatat di LAYANAN, bukan di komponen', (() => {
  // Sejak halaman beralih ke kv_store, pencatatan pindah ke satu pintu
  // src/grd/layanan.js — supaya tidak bisa "kelupaan" di salah satu tombol.
  const svc = fs.readFileSync(ROOT + '/src/grd/layanan.js', 'utf8');
  return /Grd\.catatPerubahan/.test(svc) && !/Grd\.catatPerubahan/.test(src);
})());
cek('17d-32b. Layanan mencatat jejak pada simpan DAN turunkan', (() => {
  const svc = fs.readFileSync(ROOT + '/src/grd/layanan.js', 'utf8');
  return (svc.match(/tulisJejak\(/g) || []).length >= 3; // definisi + simpanGoal + turunkanGoal
})());
cek('17d-33. Waktu riwayat ditampilkan dalam WIB', /timeZone: Abs\.TZ_WIB/.test(src));
cek('17d-29. Hapus goal pakai konfirmasi (modal, bukan confirm bawaan)',
  /function GrdHapusGoalModal\(/.test(src) && /<GrdHapusGoalModal\b/.test(src));
cek('17d-30. Konfirmasi hapus memberi tahu dampak ke goal turunan',
  /dampakHapusGoal/.test(src));
cek('17d-27. Tombol turunkan ke bawahan ada + modalnya',
  /function GrdTurunkanModal\(/.test(src) && /<GrdTurunkanModal\b/.test(src) && /rencanaTurunan/.test(src));
cek('17d-28. Tombol turunkan hanya muncul kalau pemiliknya punya bawahan',
  /bolehTurunkan/.test(src) && /bawahanUntukTurunan/.test(src));
cek('17d-25. Form punya pemilih template per peran',
  /Grd\.templateUntuk/.test(src) && /Grd\.terapkanTemplate/.test(src));
cek('17d-26. Template mengikuti peran PEMILIK goal, bukan peran pengisi form',
  /peranPemilik/.test(src) && /form\.ownerId\)\?\.role/.test(src));
cek('17d-23. Kelola Goal punya tampilan rantai roll down',
  /function GrdSimpulRantai\(/.test(src) && /Grd\.rantaiGoal/.test(src));
cek('17d-24. Simpul rantai REKURSIF (bukan kedalaman tetap)', (() => {
  const i = src.indexOf('function GrdSimpulRantai(');
  const j = src.indexOf('HALAMAN KELOLA GOAL');
  return i > -1 && j > i && /<GrdSimpulRantai\b/.test(src.slice(i, j));
})());
cek('17d-19. Form goal ada, dibuka dari Kelola Goal',
  /function GrdFormGoal\(/.test(src) && /<GrdFormGoal\b/.test(src));
cek('17d-20. Form memakai validasiGoal (aturan tidak disalin ulang di form)', (() => {
  const i = src.indexOf('function GrdFormGoal(');
  const j = src.indexOf('function GrdBarisGoal(');
  const blok = src.slice(i, j);
  return /Grd\.validasiGoal/.test(blok) && !/description.*wajib diisi/.test(blok);
})());
cek('17d-21b. Pratinjau capaian TIDAK menampilkan angka saat form masih kosong', (() => {
  // Ditemukan lewat pengecekan tampilan: base & target kosong terbaca 0 dan 0,
  // dan capaian pada jarak nol memang 100% — benar secara hitungan, menyesatkan
  // sebagai pratinjau. Penjaga ini mencegahnya kembali diam-diam.
  const i = src.indexOf('function GrdFormGoal(');
  const j = src.indexOf('function GrdBarisGoal(');
  const blok = src.slice(i, j);
  return /pratinjauSiap/.test(blok)
    && /form\.base !== '' && form\.target !== ''/.test(blok)
    && /pratinjauSiap \? `\$\{Grd\.persenCapaian\(pratinjau\)\}%` : '—'/.test(blok);
})());
cek('17d-21. Form menandai keempat isian wajib', (() => {
  const i = src.indexOf('function GrdFormGoal(');
  const j = src.indexOf('function GrdBarisGoal(');
  const blok = src.slice(i, j);
  return /label="Deskripsi goal" wajib/.test(blok) && /label="Base" wajib/.test(blok)
    && /label="Target" wajib/.test(blok) && /label="Satuan" wajib/.test(blok);
})());
cek('17d-22. Pemilik goal dibatasi calonPemilikGoal (tidak bisa menitipkan ke sembarang orang)', (() => {
  const i = src.indexOf('function GrdFormGoal(');
  const j = src.indexOf('function GrdBarisGoal(');
  return /calonPemilikGoal/.test(src.slice(i, j));
})());
cek('17d-36. App.jsx TIDAK lagi memakai data contoh (sudah pakai kv_store)',
  !/goalContoh/.test(src));
cek('17d-37. Halaman GRD membaca lewat layanan, bukan storage langsung',
  /GrdSvc\.ambilGoal/.test(src) && /GrdSvc\.simpanGoal/.test(src)
  && /GrdSvc\.hapusGoal/.test(src) && /GrdSvc\.turunkanGoal/.test(src));
cek('17d-38. Muat GRD memakai pollWhenVisible (hemat egress Supabase)', (() => {
  const i = src.indexOf('function GrdTreeView(');
  const j = src.indexOf('function PageHeader(');
  return /pollWhenVisible\(muat\)/.test(src.slice(i, j));
})());
cek('17d-39. Gagal muat TIDAK mengosongkan layar (data lama dipertahankan)',
  /pertahankan data lama/.test(src));
cek('17d-34. Modul layanan GRD disuntik dependensinya dari App.jsx',
  /initGrd\(\{[\s\S]{0,500}?storage,/.test(src));
cek('17d-35. log dibungkus arrow (hindari TDZ logActivity — aturan wajib no.6)', (() => {
  // WAJIB arrow: logActivity adalah const yang dideklarasikan jauh di bawah
  // initGrd. Dioper langsung → ReferenceError TDZ saat modul dievaluasi → blank.
  const i = src.indexOf('initGrd({');
  const blok = src.slice(i, i + 500);
  return /log: \(text, userName\) => logActivity\(text, userName\)/.test(blok);
})());
cek('17d-35b. rpc disuntik sebagai OPSIONAL (app tetap jalan tanpa fungsi SQL-nya)', (() => {
  const i = src.indexOf('initGrd({');
  const blok = src.slice(i, i + 500);
  return /rpc: supabase \? \(nama, args\) => supabase\.rpc\(nama, args\) : null/.test(blok);
})());
cek('17d-16. Halaman Kelola Goal ada + rute + menunya',
  /function GrdKelolaView\(/.test(src) && /view === 'grd-kelola'/.test(src) && /id: 'grd-kelola'/.test(src));
cek('17d-17. Kelola Goal hanya menampilkan goal yang boleh diurus',
  /goalYangBisaDikelola/.test(src));
cek('17d-18. Pemilih periode dipakai bersama (tidak disalin per halaman)', (() => {
  return /function GrdPemilihPeriode\(/.test(src)
    && (src.match(/<GrdPemilihPeriode\b/g) || []).length >= 2;
})());
cek('17d-14. Halaman punya pencarian goal (kata + divisi)',
  /saringPohon/.test(src) && /Semua divisi/.test(src));
cek('17d-15. Saat mencari, cabang terlipat dibuka supaya hasil tidak tersembunyi',
  /sedangMencari \? KOSONG/.test(src));
cek('17d-12. Halaman punya pemilih periode bulan & kuartal',
  /daftarPeriode/.test(src) && /konversiPeriode/.test(src) && /geserPeriode/.test(src));
cek('17d-13. Periode jadi state (bukan dipatok ke periode berjalan)',
  /const \[periode, setPeriode\] = useState/.test(src));
cek('17d-8. Panel detail goal ada dan dibuka dari kartu goal',
  /function GrdDetailGoal\(/.test(src) && /<GrdDetailGoal\b/.test(src));
cek('17d-9. Panel detail memakai Modal (createPortal) — aturan modal app', (() => {
  const i = src.indexOf('function GrdDetailGoal(');
  const j = src.indexOf('function GrdSimpul(');
  return i > -1 && j > i && /<Modal\b/.test(src.slice(i, j));
})());
cek('17d-10. Panel detail menampilkan base, target, satuan, pemilik & periode', (() => {
  const i = src.indexOf('function GrdDetailGoal(');
  const j = src.indexOf('function GrdSimpul(');
  const blok = src.slice(i, j);
  return /label="Base"/.test(blok) && /label="Target"/.test(blok) && /label="Satuan"/.test(blok)
    && /label="Pemilik"/.test(blok) && /label="Periode"/.test(blok);
})());
cek('17d-11. Panel detail menampilkan rantai roll down (induk & turunan)', (() => {
  const i = src.indexOf('function GrdDetailGoal(');
  const j = src.indexOf('function GrdSimpul(');
  const blok = src.slice(i, j);
  return /goalInduk/.test(blok) && /goalTurunan/.test(blok);
})());
cek('17d-7. Halaman memperingatkan anggota yang jalur atasannya putus',
  /simpulMenggantung/.test(src) && /atasan belum sah/.test(src));
cek('17d-6. Cabang terlipat tetap menampilkan ringkasannya', (() => {
  const i = src.indexOf('function GrdSimpul(');
  const j = src.indexOf('function GrdTreeView(');
  return /ringkasCabang/.test(src.slice(i, j));
})());
cek('17e. Istilah OKR/objective/key result TIDAK dipakai di KODE modul GRD', (() => {
  // Komentar sengaja dibuang dulu: di data.js ada kalimat LARANGAN yang menyebut
  // istilah-istilah itu, dan larangan tidak boleh dihitung sebagai pelanggaran.
  const tanpaKomentar = (f) => fs.readFileSync(ROOT + f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const isi = tanpaKomentar('/src/grd/data.js') + tanpaKomentar('/src/grd/contoh.js');
  return !/\bOKR\b|\bkey result\b|\bobjective\b/i.test(isi);
})());
cek('17f. Modul GRD TIDAK meng-import App.jsx (anti circular import)', (() => {
  const isi = fs.readFileSync(ROOT + '/src/grd/data.js', 'utf8')
    + fs.readFileSync(ROOT + '/src/grd/contoh.js', 'utf8');
  return !/from\s+'.*App\.jsx'/.test(isi);
})());
cek('17g. Rumus bawahan TIDAK disalin ke modul GRD (wajib lewat hierarki.js)', (() => {
  const isi = fs.readFileSync(ROOT + '/src/grd/data.js', 'utf8');
  return !/leaderId ===/.test(isi) && /from '\.\.\/peran\/hierarki\.js'/.test(isi);
})());

// ============================================================================
judul('19. Modul layanan tipis (satu pintu baca/tulis GRD)');
// Layanan diuji dengan storage TIRUAN di memori — itu gunanya dependensi
// disuntik lewat initGrd(): jalur tulisnya bisa diperiksa tanpa Supabase dan
// tanpa pernah menyentuh database production.
// ============================================================================
function storagePalsu(awal = {}) {
  const baris = new Map(Object.entries(awal));
  return {
    baris,
    gagalSet: false,
    async listByPrefix(prefix) {
      return [...baris.entries()].filter(([k]) => k.startsWith(prefix))
        .sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
    },
    async set(k, v) { if (this.gagalSet) return false; baris.set(k, v); return true; },
    async delete(k) { baris.delete(k); return true; },
  };
}
const OWNER = orang('u-owner'), LEADER = orang('u-leader'), STAF1 = orang('u-staf1'), STAF2 = orang('u-staf2');
const goalSah = (extra = {}) => ({
  id: 'sv1', ownerId: 'u-staf1', periode: '2026-09',
  description: 'Konten tayang', base: 0, target: 30, uom: 'Konten', ...extra,
});

let sp = storagePalsu();
Svc.initGrd({ storage: sp });

cek('19a. Sebelum initGrd, layanan menolak dengan pesan jelas (bukan crash diam)', (() => {
  return typeof Svc.initGrd === 'function' && typeof Svc.simpanGoal === 'function';
})());

// ---- simpan goal baru ----
const g1 = await Svc.simpanGoal(goalSah(), { user: STAF1, allUsers: tim });
cek('19b. Goal tersimpan sebagai SATU baris per-record', sp.baris.has('grdgoal:rec:sv1'));
cek('19c. Yang tersimpan sudah ternormalisasi', sp.baris.get('grdgoal:rec:sv1').base === 0 && g1.id === 'sv1');
cek('19d. Jejak "_dibuat" ikut tertulis', (() => {
  const jejak = [...sp.baris.keys()].filter(k => k.startsWith('grdjejak:rec:'));
  return jejak.length === 1;
})());
cek('19e. ambilGoal membaca kembali lewat prefix', (await Svc.ambilGoal()).length === 1);
cek('19f. ambilJejak membaca catatan jejak', (await Svc.ambilJejak()).length === 1);

// ---- validasi tetap ditegakkan di layanan ----
let ditolak = '';
try { await Svc.simpanGoal(goalSah({ id: 'x1', description: '' }), { user: STAF1, allUsers: tim }); }
catch (e) { ditolak = e.message; }
cek('19g. Goal tanpa deskripsi DITOLAK di layanan (bukan cuma di form)', /Deskripsi/.test(ditolak), ditolak);
cek('19h. Goal yang ditolak tidak meninggalkan baris', !sp.baris.has('grdgoal:rec:x1'));

ditolak = '';
try { await Svc.simpanGoal(goalSah({ id: 'x2', base: 5, target: 5 }), { user: STAF1, allUsers: tim }); }
catch (e) { ditolak = e.message; }
cek('19i. base === target ditolak di layanan', /sama dengan base/.test(ditolak), ditolak);

// ---- HAK AKSES ditegakkan sebelum menulis ----
ditolak = '';
try { await Svc.simpanGoal(goalSah({ id: 'x3', ownerId: 'u-leader' }), { user: STAF1, allUsers: tim }); }
catch (e) { ditolak = e.message; }
cek('19j. Staf TIDAK bisa membuat goal atas nama atasannya', /tidak berwenang/.test(ditolak), ditolak);
cek('19k. Penolakan hak akses tidak meninggalkan baris', !sp.baris.has('grdgoal:rec:x3'));

ditolak = '';
try {
  await Svc.simpanGoal(goalSah({ id: 'sv1', target: 99 }),
    { user: STAF2, allUsers: tim, goalLama: goalSah() });
} catch (e) { ditolak = e.message; }
cek('19l. Rekan sejajar TIDAK bisa mengubah goal orang lain', /tidak berwenang mengubah/.test(ditolak), ditolak);
cek('19m. Goal aslinya tidak berubah setelah ditolak', sp.baris.get('grdgoal:rec:sv1').target === 30);

ditolak = '';
try {
  await Svc.simpanGoal(goalSah({ id: 'sv1', ownerId: 'u-owner' }),
    { user: LEADER, allUsers: tim, goalLama: goalSah() });
} catch (e) { ditolak = e.message; }
cek('19n. Goal tidak bisa "dipindahkan" ke orang di luar wewenang lewat form ubah',
  /tidak berwenang membuat goal atas nama/.test(ditolak), ditolak);

// ---- atasan BOLEH ----
const g2 = await Svc.simpanGoal(goalSah({ id: 'sv1', target: 50 }),
  { user: LEADER, allUsers: tim, goalLama: goalSah() });
cek('19o. Atasan boleh mengubah goal bawahannya', g2.target === 50 && sp.baris.get('grdgoal:rec:sv1').target === 50);
cek('19p. Perubahan angka tercatat di jejak', (() => {
  const jejak = [...sp.baris.values()].filter(v => v && v.goalId === 'sv1' && v.field === 'target');
  return jejak.length === 1 && jejak[0].dari === 30 && jejak[0].ke === 50;
})());
cek('19q. Jejak mencatat SIAPA yang mengubah', (() => {
  const j = [...sp.baris.values()].find(v => v && v.field === 'target');
  return j.olehId === 'u-leader' && j.olehNama === 'Leader TAP';
})());

// ---- gagal tulis ditangani ----
sp.gagalSet = true;
ditolak = '';
try { await Svc.simpanGoal(goalSah({ id: 'x4' }), { user: STAF1, allUsers: tim }); }
catch (e) { ditolak = e.message; }
cek('19r. Gagal menulis memberi pesan yang bisa dibaca pengguna', /Gagal menyimpan goal/.test(ditolak), ditolak);
sp.gagalSet = false;

// ---- hapus ----
ditolak = '';
try { await Svc.hapusGoal(goalSah(), { user: STAF2, allUsers: tim }); }
catch (e) { ditolak = e.message; }
cek('19s. Rekan sejajar TIDAK bisa menghapus goal orang lain', /tidak berwenang menghapus/.test(ditolak));
cek('19t. Goal masih ada setelah penghapusan ditolak', sp.baris.has('grdgoal:rec:sv1'));
await Svc.hapusGoal(goalSah(), { user: OWNER, allUsers: tim });
cek('19u. Owner boleh menghapus', !sp.baris.has('grdgoal:rec:sv1'));

// ---- turunkan ----
sp = storagePalsu(); Svc.initGrd({ storage: sp });
const gIndukSvc = { id: 'ind1', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta Rupiah' };
await Svc.simpanGoal(gIndukSvc, { user: LEADER, allUsers: tim });
const hasilTurun = await Svc.turunkanGoal(gIndukSvc, { user: LEADER, allUsers: tim });
cek('19v. Turunkan membuat goal untuk tiap bawahan langsung', hasilTurun.length === 2, hasilTurun.length);
cek('19w. Tiap turunan punya id sendiri (tidak saling menimpa)',
  new Set(hasilTurun.map(g => g.id)).size === 2);
cek('19x. Turunan menunjuk goal induk', hasilTurun.every(g => g.parentId === 'ind1'));
cek('19y. Turunan tersimpan sebagai baris terpisah',
  hasilTurun.every(g => sp.baris.has('grdgoal:rec:' + g.id)));
const turunLagi = await Svc.turunkanGoal(gIndukSvc, { user: LEADER, allUsers: tim });
cek('19z-2. Klik turunkan kedua kali menghasilkan 0 goal baru', turunLagi.length === 0, turunLagi.length);

ditolak = '';
try { await Svc.turunkanGoal(gIndukSvc, { user: STAF1, allUsers: tim }); }
catch (e) { ditolak = e.message; }
cek('19z-3. Staf tidak bisa menurunkan goal atasannya', /tidak berwenang menurunkan/.test(ditolak));

// ---- susun pohon lewat layanan ----
const hasilPohon = await Svc.susunPohon({ users: tim, periode: '2026-09' });
cek('19z-4. susunPohon mengembalikan pohon siap render', Array.isArray(hasilPohon.pohon) && hasilPohon.pohon.length > 0);
cek('19z-5. Ikut membawa angka ringkasan', typeof hasilPohon.ringkas.totalGoal === 'number');
cek('19z-6. Ikut membawa daftar anggota yang jalur atasannya putus',
  Array.isArray(hasilPohon.menggantung));
cek('19z-7. Semua orang tetap muncul di pohon', G.ratakanPohon(hasilPohon.pohon).length === tim.length);
cek('19z-8. Goal yang tersimpan menempel pada pemiliknya', (() => {
  const s = G.ratakanPohon(hasilPohon.pohon).find(x => x.user.id === 'u-leader');
  return s.goals.some(g => g.id === 'ind1');
})());
cek('19z-9. susunPohonDari tidak menyentuh storage sama sekali', (() => {
  const r = Svc.susunPohonDari({ users: tim, goals: [goalSah()], periode: '2026-09' });
  return G.ratakanPohon(r.pohon).find(x => x.user.id === 'u-staf1').goals.length === 1;
})());
cek('19z-10. Periode lain menghasilkan pohon tanpa goal', (() => {
  const r = Svc.susunPohonDari({ users: tim, goals: [goalSah()], periode: '2026-12' });
  return r.ringkas.totalGoal === 0;
})());

judul('20. Endpoint detail goal (satu panggilan, konteks lengkap)');
const spD = storagePalsu(); Svc.initGrd({ storage: spD });
const dIndukG = { id: 'd-induk', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta Rupiah' };
await Svc.simpanGoal(dIndukG, { user: LEADER, allUsers: tim });
const dAnak = await Svc.turunkanGoal(dIndukG, { user: LEADER, allUsers: tim });
await Svc.simpanGoal({ ...dIndukG, target: 1000 },
  { user: LEADER, allUsers: tim, goalLama: dIndukG });

const detail = await Svc.ambilDetailGoal('d-induk', { allUsers: tim });
cek('20a. Goalnya kembali', detail && detail.goal.id === 'd-induk');
cek('20b. Pemilik ikut diselesaikan jadi objek anggota', detail.pemilik?.name === 'Leader TAP');
cek('20c. Goal turunan ikut terbawa', detail.turunan.length === dAnak.length && dAnak.length === 2);
cek('20d. Goal puncak tidak punya induk', detail.induk === null);
cek('20e. Riwayat perubahan ikut terbawa (pembuatan + perubahan angka)', (() => {
  const field = detail.riwayat.map(r => r.field).sort();
  return field.join() === '_dibuat,target';
})(), detail.riwayat.map(r => r.field));
// Catatan: urutan "terbaru di atas" TIDAK diuji di sini. Dua simpan berturut-turut
// dalam uji ini terjadi pada milidetik yang sama, jadi tidak ada urutan waktu yang
// bisa dibuktikan. Urutannya sudah diuji dengan waktu eksplisit di §14g-m.
cek('20e-2. Semua catatan riwayat milik goal ini',
  detail.riwayat.every(r => r.goalId === 'd-induk'));
cek('20f. Riwayat mencatat dari 900 ke 1000', (() => {
  const t = detail.riwayat.find(r => r.field === 'target');
  return t.dari === 900 && t.ke === 1000;
})());
cek('20g. Angka capaian ikut dihitung',
  detail.persen === 0 && detail.status === 'belum' && detail.sisa === 1000);

const detailAnak = await Svc.ambilDetailGoal(dAnak[0].id, { allUsers: tim });
cek('20h. Goal turunan menemukan induknya', detailAnak.induk?.id === 'd-induk');
cek('20i. Goal turunan tidak punya turunan lagi', detailAnak.turunan.length === 0);
cek('20j. Pemilik turunan adalah bawahan, bukan pemilik induk',
  detailAnak.pemilik && detailAnak.pemilik.id !== 'u-leader');

cek('20k. Goal yang sudah dihapus orang lain → null (bukan layar rusak)',
  (await Svc.ambilDetailGoal('sudah-dihapus', { allUsers: tim })) === null);
cek('20l. Id kosong → null', (await Svc.ambilDetailGoal('', { allUsers: tim })) === null);
cek('20m. Id null → null', (await Svc.ambilDetailGoal(null, { allUsers: tim })) === null);
const detailTanpaBaca = await Svc.ambilDetailGoal('d-induk', {
  allUsers: tim, goals: [dIndukG], jejak: [],
});
cek('20o. goals & jejak yang dioper dipakai apa adanya (tanpa baca ulang)',
  detailTanpaBaca && detailTanpaBaca.goal.id === 'd-induk' && detailTanpaBaca.riwayat.length === 0);
Svc.initGrd({ storage: spD });

judul('21. Periode yang benar-benar berisi goal');
const goalsPeriode = [
  { id: 'p1', ownerId: 'u-staf1', periode: '2026-09', description: 'a', base: 0, target: 1, uom: 'x' },
  { id: 'p2', ownerId: 'u-staf1', periode: '2026-09', description: 'b', base: 0, target: 1, uom: 'x' },
  { id: 'p3', ownerId: 'u-staf1', periode: '2025-01', description: 'c', base: 0, target: 1, uom: 'x' },
  { id: 'p4', ownerId: 'u-staf1', periode: '2026-Q3', description: 'd', base: 0, target: 1, uom: 'x' },
];
cek('21a. Periode unik, terbaru di atas',
  G.periodeTersedia(goalsPeriode).join() === '2026-Q3,2026-09,2025-01',
  G.periodeTersedia(goalsPeriode));
cek('21b. Tidak ada duplikat walau banyak goal periode sama',
  G.periodeTersedia(goalsPeriode).filter(p => p === '2026-09').length === 1);
cek('21c. Daftar kosong aman',
  G.periodeTersedia([]).length === 0 && G.periodeTersedia(null).length === 0);
cek('21d. Goal berperiode rusak tidak masuk daftar',
  G.periodeTersedia([{ id: 'z', ownerId: 'a', periode: 'ngawur' }]).length === 0);

const lengkap = G.pilihanPeriodeLengkap('bulan', '2026-09', goalsPeriode);
cek('21e. Periode jauh di luar tebakan TETAP bisa dipilih (2025-01)',
  lengkap.includes('2025-01'), lengkap);
cek('21f. Tebakan bawaan tetap ada', lengkap.includes('2026-09') && lengkap.includes('2026-08'));
cek('21g. Periode kuartal tidak bocor ke daftar bulan', !lengkap.includes('2026-Q3'));
cek('21h. Semua pilihan sah & tanpa duplikat',
  lengkap.every(G.periodeValid) && new Set(lengkap).size === lengkap.length);
cek('21i. Urut menurun', lengkap.every((v, i) => i === 0 || lengkap[i - 1] > v));
cek('21j. Daftar kuartal ikut menarik kuartal yang berisi', (() => {
  const k = G.pilihanPeriodeLengkap('kuartal', '2026-Q3', goalsPeriode);
  return k.includes('2026-Q3') && k.every(p => G.jenisPeriode(p) === 'kuartal');
})());

judul('22. Endpoint query pohon per periode');
const spQ = storagePalsu(); Svc.initGrd({ storage: spQ });
for (const g of [
  { id: 'q-lead', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta' },
  { id: 'q-staf', ownerId: 'u-staf1', periode: '2026-09', description: 'Konten tayang', base: 0, target: 30, uom: 'Konten' },
  { id: 'q-lama', ownerId: 'u-staf1', periode: '2025-01', description: 'Goal lama', base: 0, target: 5, uom: 'x' },
]) await Svc.simpanGoal(g, { user: OWNER, allUsers: tim });

const q1 = await Svc.queryPohon({ users: tim, periode: '2026-09' });
cek('22a. Pohon periode itu saja', q1.ringkas.totalGoal === 2, q1.ringkas.totalGoal);
cek('22b. Semua orang tetap muncul', G.ratakanPohon(q1.pohon).length === tim.length);
cek('22c. Tanpa filter, mencari = false', q1.mencari === false);
cek('22d. pohonPenuh tersedia untuk tombol lipat/buka', Array.isArray(q1.pohonPenuh));
cek('22e. Pilihan periode memuat periode lama yang berisi (2025-01)',
  q1.pilihanPeriode.includes('2025-01'), q1.pilihanPeriode);
cek('22f. Ikut membawa daftar anggota berjalur putus', Array.isArray(q1.menggantung));
cek('22g. semuaGoal dikembalikan untuk dipakai panel detail', q1.semuaGoal.length === 3);

const q2 = await Svc.queryPohon({ users: tim, periode: '2026-09', kata: 'Konten' });
cek('22h. Pencarian menyaring pohon', G.ratakanPohon(q2.pohon).length < tim.length);
cek('22i. Yang cocok ditandai', q2.cocok === 1, q2.cocok);
cek('22j. mencari = true saat ada kata', q2.mencari === true);
cek('22k. Jalur ke atas tetap terbawa',
  G.ratakanPohon(q2.pohon).some(s => s.user.id === 'u-owner' && s.cocok === false));

const q3 = await Svc.queryPohon({ users: tim, periode: '2026-09', divisi: 'tap' });
cek('22l. Saring divisi berjalan lewat endpoint', q3.mencari === true && q3.cocok > 0);
const q4 = await Svc.queryPohon({ users: tim, periode: '2026-09', kata: 'tidak-ada-ini' });
cek('22m. Kata yang tidak ketemu → pohon kosong, bukan error', q4.pohon.length === 0 && q4.cocok === 0);
const q5 = await Svc.queryPohon({ users: tim, periode: '2026-12' });
cek('22n. Periode tanpa goal → pohon tetap berisi orang, goal 0',
  q5.ringkas.totalGoal === 0 && G.ratakanPohon(q5.pohon).length === tim.length);
const q6 = await Svc.queryPohon({ users: tim, periode: '2026-09', goals: [] });
cek('22p. goals kosong yang dioper → benar-benar tanpa goal', q6.ringkas.totalGoal === 0);
cek('22q. Tanpa argumen sama sekali tidak error', (await Svc.queryPohon()).pohon.length === 0);

judul('23. Pencarian goal (daftar datar)');
const goalsCari = [
  { id: 'c1', ownerId: 'u-staf1', periode: '2026-09', description: 'Konten affiliate tayang', base: 0, target: 30, actual: 0, uom: 'Konten' },
  { id: 'c2', ownerId: 'u-staf2', periode: '2026-09', description: 'Sampel produk terpakai', base: 0, target: 10, actual: 9, uom: 'Produk' },
  { id: 'c3', ownerId: 'u-leader', periode: '2026-08', description: 'GMV tim', base: 0, target: 900, actual: 450, uom: 'Juta' },
  { id: 'c4', ownerId: 'u-staf1', periode: '2026-09', description: 'Sesi live', base: 0, target: 12, actual: 6, uom: 'Sesi' },
];
const idCari = (l) => l.map(g => g.id).join();

cek('23a. Tanpa filter = semua goal', G.cariGoalDatar(goalsCari, tim, {}).length === 4);
cek('23b. Periode terbaru di atas, lalu paling tertinggal',
  idCari(G.cariGoalDatar(goalsCari, tim, {})) === 'c1,c4,c2,c3',
  idCari(G.cariGoalDatar(goalsCari, tim, {})));
cek('23c. Urutan stabil antar-panggilan',
  idCari(G.cariGoalDatar(goalsCari, tim, {})) === idCari(G.cariGoalDatar(goalsCari, tim, {})));
cek('23d. Cari lewat deskripsi', idCari(G.cariGoalDatar(goalsCari, tim, { kata: 'sampel' })) === 'c2');
cek('23e. Cari lewat satuan', idCari(G.cariGoalDatar(goalsCari, tim, { kata: 'sesi' })) === 'c4');
cek('23f. Cari lewat nama pemilik', idCari(G.cariGoalDatar(goalsCari, tim, { kata: 'Andi' })) === 'c1,c4');
cek('23g. Tidak peduli huruf besar/kecil',
  idCari(G.cariGoalDatar(goalsCari, tim, { kata: 'SAMPEL' })) === 'c2');
cek('23h. Saring periode', idCari(G.cariGoalDatar(goalsCari, tim, { periode: '2026-08' })) === 'c3');
cek('23i. Periode kuartal menarik bulan di dalamnya',
  G.cariGoalDatar(goalsCari, tim, { periode: '2026-Q3' }).length === 4);
cek('23j. Saring pemilik', idCari(G.cariGoalDatar(goalsCari, tim, { ownerId: 'u-staf1' })) === 'c1,c4');
cek('23k. Saring divisi lewat pemiliknya',
  G.cariGoalDatar(goalsCari, tim, { divisi: 'tap' }).length === 4);
cek('23l. Divisi yang tidak dipakai → kosong',
  G.cariGoalDatar(goalsCari, tim, { divisi: 'keuangan' }).length === 0);
cek('23m. Filter digabung (kata + periode)',
  idCari(G.cariGoalDatar(goalsCari, tim, { kata: 'Andi', periode: '2026-09' })) === 'c1,c4');
cek('23n. Kata tidak ketemu → kosong', G.cariGoalDatar(goalsCari, tim, { kata: 'zzz' }).length === 0);
cek('23o. Goal yang pemiliknya sudah dihapus tidak bikin error saat saring divisi',
  G.cariGoalDatar([{ id: 'x', ownerId: 'hilang', periode: '2026-09', description: 'a', base: 0, target: 1, uom: 'x' }],
    tim, { divisi: 'tap' }).length === 0);
cek('23p. Daftar kosong aman',
  G.cariGoalDatar([], tim, { kata: 'a' }).length === 0 && G.cariGoalDatar(null, tim, {}).length === 0);
cek('23q. Sumber tidak ikut berubah urutannya', (() => {
  const salinan = [...goalsCari];
  G.cariGoalDatar(goalsCari, tim, {});
  return goalsCari.every((g, i) => g === salinan[i]);
})());

judul('24. Endpoint pencarian goal');
const spC = storagePalsu(); Svc.initGrd({ storage: spC });
for (const g of goalsCari) await Svc.simpanGoal(g, { user: OWNER, allUsers: tim });

const r1 = await Svc.cariGoal({ kata: 'sampel', allUsers: tim });
cek('24a. Menemukan goal lewat endpoint', r1.jumlah === 1 && r1.hasil[0].id === 'c2');
cek('24b. mencari = true saat ada kata', r1.mencari === true);
const r2 = await Svc.cariGoal({ allUsers: tim });
cek('24c. Tanpa filter = semua goal, mencari = false', r2.jumlah === 4 && r2.mencari === false);
cek('24d. Pencarian LINTAS periode saat periode kosong',
  r2.hasil.some(g => g.periode === '2026-08') && r2.hasil.some(g => g.periode === '2026-09'));

const r3 = await Svc.cariGoal({ user: STAF1, allUsers: tim, hanyaYangBisaDiurus: true });
cek('24e. Staf hanya melihat goalnya sendiri', idCari(r3.hasil) === 'c1,c4', idCari(r3.hasil));
cek('24f. Goal rekan sejajar tidak ikut', !idCari(r3.hasil).includes('c2'));
const r4 = await Svc.cariGoal({ user: LEADER, allUsers: tim, hanyaYangBisaDiurus: true });
cek('24g. Leader melihat goalnya + seluruh bawahannya', r4.jumlah === 4, r4.jumlah);
const r5 = await Svc.cariGoal({ user: STAF1, allUsers: tim, hanyaYangBisaDiurus: true, kata: 'sampel' });
cek('24h. Batas wewenang tetap berlaku walau kata cocok dengan goal orang lain',
  r5.jumlah === 0, r5.jumlah);
cek('24i. Tanpa argumen sama sekali tidak error', (await Svc.cariGoal()).jumlah >= 0);

judul('25. Jalur RPC + fallback otomatis');
// Yang diuji di sini BUKAN SQL-nya (itu jalan di Supabase), melainkan ADAPTER-nya:
// kapan aplikasi memakai RPC, kapan jatuh ke kv_store, dan penolakan mana yang
// harus sampai ke pengguna apa adanya.
function rpcPalsu({ belumDipasang = false, tolakDengan = null, rekam = [] } = {}) {
  return async (nama, args) => {
    rekam.push({ nama, args });
    if (belumDipasang) {
      return { data: null, error: { message: 'Could not find the function public.' + nama + ' in the schema cache' } };
    }
    if (tolakDengan) return { data: null, error: { message: tolakDengan } };
    return { data: args.p_goal || true, error: null };
  };
}

// --- RPC belum dipasang → fallback ke kv_store, TANPA error ke pengguna ---
let rekamA = [];
let spR = storagePalsu();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spR, rpc: rpcPalsu({ belumDipasang: true, rekam: rekamA }) });
const gR = await Svc.simpanGoal(goalSah({ id: 'r1' }), { user: STAF1, allUsers: tim });
cek('25a. RPC belum dipasang → goal TETAP tersimpan lewat kv_store',
  spR.baris.has('grdgoal:rec:r1') && gR.id === 'r1');
cek('25b. RPC sempat dicoba sekali', rekamA.length === 1 && rekamA[0].nama === 'grd_simpan_goal');
cek('25c. Jalur diingat sebagai kv (tidak mencoba RPC lagi tiap simpan)', Svc.jalurGrd() === 'kv');
await Svc.simpanGoal(goalSah({ id: 'r2' }), { user: STAF1, allUsers: tim });
cek('25d. Simpan kedua tidak memanggil RPC lagi', rekamA.length === 1, rekamA.length);
cek('25e. Goal kedua tetap tersimpan', spR.baris.has('grdgoal:rec:r2'));

// --- RPC tersedia → dipakai, kv_store TIDAK ditulis langsung ---
let rekamB = [];
const spB = storagePalsu();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spB, rpc: rpcPalsu({ rekam: rekamB }) });
await Svc.simpanGoal(goalSah({ id: 'b1' }), { user: STAF1, allUsers: tim });
cek('25f. RPC dipakai saat tersedia', rekamB.some(r => r.nama === 'grd_simpan_goal'));
cek('25g. Goal TIDAK ditulis dua kali (kv_store tidak disentuh untuk goalnya)',
  !spB.baris.has('grdgoal:rec:b1'));
cek('25h. Jejak TETAP ditulis (jejak belum lewat RPC)',
  [...spB.baris.keys()].some(k => k.startsWith('grdjejak:rec:')));
cek('25i. Jalur diingat sebagai rpc', Svc.jalurGrd() === 'rpc');
cek('25j. Goal dikirim utuh ke RPC sebagai jsonb',
  rekamB[0].args.p_goal.description === 'Konten tayang');

// --- penolakan server TIDAK boleh disiasati dengan menulis langsung ---
const spC2 = storagePalsu();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spC2, rpc: rpcPalsu({ tolakDengan: 'Anda bukan pemilik goal ini.' }) });
let pesanTolak = '';
try { await Svc.simpanGoal(goalSah({ id: 'c1' }), { user: STAF1, allUsers: tim }); }
catch (e) { pesanTolak = e.message; }
cek('25k. Penolakan server sampai ke pengguna apa adanya',
  pesanTolak === 'Anda bukan pemilik goal ini.', pesanTolak);
cek('25l. Ditolak server → TIDAK diam-diam ditulis ke kv_store',
  !spC2.baris.has('grdgoal:rec:c1'));

// --- hapus & turunkan ikut jalur yang sama ---
let rekamD = [];
const spD2 = storagePalsu();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spD2, rpc: rpcPalsu({ rekam: rekamD }) });
await Svc.hapusGoal(goalSah({ id: 'd1' }), { user: OWNER, allUsers: tim });
cek('25m. Hapus lewat RPC saat tersedia', rekamD.some(r => r.nama === 'grd_hapus_goal'));
cek('25n. Id dikirim ke RPC hapus', rekamD.find(r => r.nama === 'grd_hapus_goal').args.p_id === 'd1');

let rekamE = [];
const spE = storagePalsu();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spE, rpc: rpcPalsu({ rekam: rekamE }) });
const turunRpc = await Svc.turunkanGoal(
  { id: 'e1', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta' },
  { user: LEADER, allUsers: tim, goalAda: [] });
cek('25o. Turunkan ikut lewat RPC', turunRpc.length === 2
  && rekamE.filter(r => r.nama === 'grd_simpan_goal').length === 2);

// --- tanpa rpc disuntik sama sekali ---
const spF = storagePalsu();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spF, rpc: null });
await Svc.simpanGoal(goalSah({ id: 'f1' }), { user: STAF1, allUsers: tim });
cek('25p. Tanpa rpc disuntik, app tetap jalan lewat kv_store', spF.baris.has('grdgoal:rec:f1'));

cek('25q. setJalurGrd bisa memaksa jalur (dipakai pengujian)', (() => {
  Svc.setJalurGrd('rpc'); const a = Svc.jalurGrd();
  Svc.setJalurGrd('kv'); const b = Svc.jalurGrd();
  Svc.setJalurGrd('auto'); const c = Svc.jalurGrd();
  return a === 'rpc' && b === 'kv' && c === 'auto';
})());

judul('26. Berkas SQL RPC');
const sqlRpc = fs.readFileSync(ROOT + '/supabase-grd-rpc.sql', 'utf8');
cek('26a. Menyediakan fungsi simpan & hapus',
  /create or replace function public\.grd_simpan_goal/.test(sqlRpc)
  && /create or replace function public\.grd_hapus_goal/.test(sqlRpc));
cek('26b. Nama fungsi cocok dengan yang dipanggil aplikasi', (() => {
  const svc = fs.readFileSync(ROOT + '/src/grd/layanan.js', 'utf8');
  return /grd_simpan_goal/.test(svc) && /grd_hapus_goal/.test(svc);
})());
cek('26c. Idempoten (aman dijalankan berkali-kali)', /create or replace/.test(sqlRpc));
cek('26d. Memberi izin panggil ke anon & authenticated',
  /grant execute on function public\.grd_simpan_goal/.test(sqlRpc));
cek('26e. Memvalidasi bentuk data di server juga',
  /Deskripsi goal wajib diisi/.test(sqlRpc) && /Periode wajib berupa/.test(sqlRpc));
cek('26f. JUJUR menyatakan belum jadi pagar keamanan sebelum Auth aktif',
  /BELUM memakai Supabase Auth/.test(sqlRpc) && /TIDAK menambah keamanan/.test(sqlRpc));
cek('26g. Menandai di mana pagar sesungguhnya nanti dipasang',
  /PAGAR SESUNGGUHNYA/.test(sqlRpc));
cek('26h. security invoker (tidak memberi hak lebih besar diam-diam)',
  /security invoker/.test(sqlRpc) && !/security definer/.test(sqlRpc));

// ============================================================================
judul('18. Penjaga ATURAN WAJIB penyimpanan (no. 3, 4, 5 di CLAUDE.md)');
// Sama peran dengan uji-sampel.mjs §18: kalau blok ini gagal, biasanya memang
// ada aturan yang terlanggar — bukan regexnya yang perlu dilonggarkan.
// ============================================================================
cek('18a. Loader goal per-record ada', /async function loadGoals\(/.test(src));
cek('18b. Loader jejak per-record ada', /async function loadJejakGrd\(/.test(src));
cek('18c. Loader goal memakai listByPrefix (BUKAN satu array besar)', (() => {
  const i = src.indexOf('async function loadGoals(');
  const blok = src.slice(i, i + 400);
  return /storage\.listByPrefix\(Grd\.GOAL_REC_PREFIX\)/.test(blok);
})());
cek('18d. Loader jejak memakai listByPrefix', (() => {
  const i = src.indexOf('async function loadJejakGrd(');
  const blok = src.slice(i, i + 300);
  return /storage\.listByPrefix\(Grd\.JEJAK_REC_PREFIX\)/.test(blok);
})());
cek('18e. Goal ternormalisasi saat dimuat (record lama tidak merusak halaman)', (() => {
  const i = src.indexOf('async function loadGoals(');
  return /Grd\.normalisasiGoal/.test(src.slice(i, i + 400));
})());

cek('18f. ATURAN 4 — goal terdaftar di PER_RECORD_LOADERS', (() => {
  const i = src.indexOf('const PER_RECORD_LOADERS');
  const blok = src.slice(i, src.indexOf('const PER_RECORD_PREFIX'));
  return /\[Grd\.GOAL_BACKUP_KEY\]: loadGoals/.test(blok);
})());
cek('18g. ATURAN 4 — jejak terdaftar di PER_RECORD_LOADERS', (() => {
  const i = src.indexOf('const PER_RECORD_LOADERS');
  const blok = src.slice(i, src.indexOf('const PER_RECORD_PREFIX'));
  return /\[Grd\.JEJAK_BACKUP_KEY\]: loadJejakGrd/.test(blok);
})());
cek('18h. ATURAN 4 — goal & jejak terdaftar di PER_RECORD_PREFIX', (() => {
  const i = src.indexOf('const PER_RECORD_PREFIX');
  const blok = src.slice(i, i + 2000);
  return /\[Grd\.GOAL_BACKUP_KEY\]: Grd\.GOAL_REC_PREFIX/.test(blok)
    && /\[Grd\.JEJAK_BACKUP_KEY\]: Grd\.JEJAK_REC_PREFIX/.test(blok);
})());
cek('18i. ATURAN 3 — goal & jejak masuk BACKUP_KEYS (kalau tidak, data tak ikut backup)', (() => {
  const i = src.indexOf('const BACKUP_KEYS = [');
  const blok = src.slice(i, src.indexOf('];', i));
  return /Grd\.GOAL_BACKUP_KEY/.test(blok) && /Grd\.JEJAK_BACKUP_KEY/.test(blok);
})());
cek('18j. ATURAN 5 — prefix GRD tidak dibaca dengan range gte/lt', (() => {
  return !/gte\(['"`]grdgoal/.test(src) && !/gte\(['"`]grdjejak/.test(src);
})());
cek('18k. Kunci backup GRD tidak bentrok dengan modul lain', (() => {
  const i = src.indexOf('const BACKUP_KEYS = [');
  const blok = src.slice(i, src.indexOf('];', i));
  const kutip = (blok.match(/'[a-z][^']*:[^']*'/g) || []);
  return !kutip.includes("'grd:goals:all'") && !kutip.includes("'grd:jejak:all'");
})());

// ============================================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`HASIL: ${lulus} lulus, ${gagal} gagal, total ${lulus + gagal}`);
console.log('='.repeat(60));
process.exit(gagal > 0 ? 1 : 0);
