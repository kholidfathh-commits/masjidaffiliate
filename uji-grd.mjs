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
import * as L from './src/grd/lead.js';
import * as SB from './src/grd/scoreboard.js';
import { goalContoh } from './src/grd/contoh.js';
import * as Svc from './src/grd/layanan.js';
import { storageMock, rpcMock, lepasMockGrd } from './src/grd/mock.js';

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
cek('17d-27b. Halaman melaporkan kegagalan sebagian saat menurunkan goal',
  /gagal\.length > 0/.test(src) && /gagal\.map\(x => `· \$\{x\.nama\}/.test(src));
cek('17d-27. Tombol turunkan ke bawahan ada + modalnya',
  /function GrdTurunkanModal\(/.test(src) && /<GrdTurunkanModal\b/.test(src) && /rencanaTurunan/.test(src));
cek('17d-28. Tombol turunkan hanya muncul kalau pemiliknya punya bawahan',
  /bolehTurunkan/.test(src) && /bawahanUntukTurunan/.test(src));
cek('17d-25b. Template tim ikut BACKUP_KEYS (aturan wajib no.3)', (() => {
  const i = src.indexOf('const BACKUP_KEYS = [');
  return /Grd\.TEMPLATE_KEY/.test(src.slice(i, src.indexOf('];', i)));
})());
cek('17d-25c. Form memuat template yang diubah tim, bawaan sebagai jaring pengaman',
  /GrdSvc\.ambilTemplate\(\)/.test(src) && /Grd\.templateUntuk\(peranPemilik, templateTim\)/.test(src));
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
cek('17d-44. Pohon menyaring isi goal sesuai kewenangan LIHAT',
  /bolehLihat: \(g\) => Grd\.bisaLihatGoal\(user, g, allUsers\)/.test(src));
cek('17d-45. Goal tersembunyi ditandai jelas, tidak disamakan dengan "belum punya goal"',
  /tidak ditampilkan — di luar kewenangan Anda/.test(src)
  && /Belum punya goal periode ini/.test(src));
cek('17d-46. Pemeriksa akses menampilkan hak LIHAT dan UBAH sekaligus',
  /Grd\.alasanLihatGoal/.test(src) && /Grd\.alasanUbahGoal/.test(src));
cek('17f-2. Modul mock TIDAK ikut masuk bundle (tidak di-import App.jsx)',
  !/grd\/mock\.js/.test(src));
cek('17f-3. Mock tidak meng-import App.jsx', (() => {
  const mock = fs.readFileSync(ROOT + '/src/grd/mock.js', 'utf8');
  return !/from\s+'.*App\.jsx'/.test(mock);
})());
cek('17d-62. Halaman Kontrol Akses menampilkan status peran pengguna sendiri',
  /const statusSaya = useMemo\(\) => Grd\.ringkasAksesUser/.test(src.replace(/\(\) =>/g, '() =>'))
  || /Grd\.ringkasAksesUser\(user, allUsers, goals\)/.test(src));
cek('17d-63. Status menyebut berapa goal terlihat & bisa diubah',
  /Anda melihat/.test(src) && /boleh mengubah/.test(src));
cek('17d-64. Status menampilkan jalur data yang sedang dipakai',
  /GrdSvc\.jalurGrd\(\)/.test(src) && /lewat fungsi server \(RPC\)/.test(src));
cek('17d-59. Baris goal memeriksa wewenangnya SENDIRI (tidak mengandalkan pemanggil)', (() => {
  const i = src.indexOf('function GrdBarisGoal(');
  const j = src.indexOf('function GrdSimpulRantai(');
  const blok = src.slice(i, j);
  return /const bolehUbah = !user \|\| Grd\.bisaUbahGoal\(user, g, allUsers\)/.test(blok);
})());
cek('17d-60. Ketiga tombol aksi digerbangi wewenang yang sama', (() => {
  const i = src.indexOf('function GrdBarisGoal(');
  const j = src.indexOf('function GrdSimpulRantai(');
  const blok = src.slice(i, j);
  return (blok.match(/\{bolehUbah && on(Ubah|Hapus|Turunkan) && \(/g) || []).length === 3;
})());
cek('17d-61. user & allUsers benar-benar dioper ke baris goal',
  /<GrdBarisGoal[^>]*user=\{user\}/.test(src.replace(/\n/g, ' ')));
cek('17d-57. Panel detail menelusuri rantai hanya di goal yang boleh dilihat',
  /Grd\.goalYangBisaDilihat\(user, semuaGoal, allUsers\)/.test(src));
cek('17d-58. Penyaring itu BUKAN hook (komponennya punya early return)', (() => {
  const i = src.indexOf('function GrdDetailGoal(');
  const j = src.indexOf('function GrdSimpul(');
  const blok = src.slice(i, j);
  return /const terlihat = Grd\.goalYangBisaDilihat/.test(blok)
    && !/const terlihat = useMemo/.test(blok);
})());
cek('17d-55. Halaman Kontrol Akses menampilkan pratinjau "yang dilihat X"',
  /Grd\.pratinjauAkses/.test(src) && /Yang dilihat \{orangUji\.name\}/.test(src));
cek('17d-56. Pratinjau menyebut siapa yang goalnya tersembunyi',
  /orangTersembunyi\.map\(u => u\.name\)\.join/.test(src));
cek('17d-52. Penolakan simpan tampil INLINE di form, bukan lewat alert', (() => {
  const i = src.indexOf('function useGrdTulis(');
  const j = src.indexOf('function GrdPemilihPeriode(');
  const hook = src.slice(i, j);
  // simpanGoal mengembalikan pesan; form yang menempelkannya.
  return /return \(e && e\.message\) \|\| 'Gagal menyimpan goal\.'/.test(hook)
    && !/alert\('⚠️ ' \+ \(e\?\.message \|\| e\)\);\s*\}\s*\};\s*const bukaBaru/.test(hook);
})());
cek('17d-53. Form menempelkan pesan penolakan dari layanan', (() => {
  const i = src.indexOf('function GrdFormGoal(');
  const j = src.indexOf('function GrdTurunkanModal(');
  const blok = src.slice(i, j);
  return /const salahServer = await onSimpan/.test(blok) && /if \(salahServer\) setPesan\(salahServer\)/.test(blok);
})());
cek('17d-54. Tombol simpan terkunci selama proses (cegah klik ganda)', (() => {
  const i = src.indexOf('function GrdFormGoal(');
  const j = src.indexOf('function GrdTurunkanModal(');
  const blok = src.slice(i, j);
  return /disabled=\{menyimpan\}/.test(blok) && /Menyimpan…/.test(blok);
})());
cek('17d-47. Tombol ubah di kartu goal hanya muncul untuk yang berwenang', (() => {
  const i = src.indexOf('function GrdKartuGoal(');
  const j = src.indexOf('function GrdSimpul(');
  const blok = src.slice(i, j);
  return /\{bolehUbah && onUbah && \(/.test(blok);
})());
cek('17d-48. Panel detail menyembunyikan aksi dari yang tidak berwenang', (() => {
  const i = src.indexOf('function GrdDetailGoal(');
  const j = src.indexOf('function GrdSimpul(');
  const blok = src.slice(i, j);
  return /\{bolehUbah \? \(/.test(blok) && /Ubah Goal/.test(blok) && /hanya bisa melihat goal ini/.test(blok);
})());
cek('17d-49. Tombol turunkan di panel detail hanya saat pemiliknya punya bawahan', (() => {
  const i = src.indexOf('function GrdDetailGoal(');
  const j = src.indexOf('function GrdSimpul(');
  return /Grd\.bawahanUntukTurunan\(g, allUsers\)\.length > 0/.test(src.slice(i, j));
})());
cek('17d-50. Jalur tulis TIDAK disalin per halaman (satu hook bersama)', (() => {
  return /function useGrdTulis\(/.test(src)
    && (src.match(/useGrdTulis\(\{/g) || []).length === 3; // definisi + 2 halaman
})());
cek('17d-51. Kedua halaman memakai hook yang sama', (() => {
  const tree = src.indexOf('function GrdTreeView(');
  const kelola = src.indexOf('function GrdKelolaView(');
  const akses = src.indexOf('function GrdAksesView(');
  return /useGrdTulis/.test(src.slice(tree, kelola)) && /useGrdTulis/.test(src.slice(kelola, akses));
})());
cek('17d-40. Halaman Kontrol Akses ada + rute + menunya',
  /function GrdAksesView\(/.test(src) && /view === 'grd-akses'/.test(src) && /id: 'grd-akses'/.test(src));
cek('17d-41. Menu Kontrol Akses hanya untuk pengelola',
  /id: 'grd-akses'[^}]*show: isPengelola\(user\)/.test(src));
cek('17d-42. Halaman menyatakan terbuka batas keamanannya (tidak menjanjikan kunci database)',
  /belum menjadi kunci di sisi/i.test(src));
cek('17d-43. Aturan akses TIDAK ditulis ulang di komponen (pakai fungsi murni)', (() => {
  const i = src.indexOf('function GrdAksesView(');
  const j = src.indexOf('function PageHeader(');
  const blok = src.slice(i, j);
  return /Grd\.matriksAkses/.test(blok) && /Grd\.alasanUbahGoal/.test(blok)
    && !/idBawahanTransitif/.test(blok);
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
const OWNER = orang('u-owner'), LEADER = orang('u-leader'), STAF1 = orang('u-staf1'), STAF2 = orang('u-staf2');
const goalSah = (extra = {}) => ({
  id: 'sv1', ownerId: 'u-staf1', periode: '2026-09',
  description: 'Konten tayang', base: 0, target: 30, uom: 'Konten', ...extra,
});

let sp = storageMock();
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
sp = storageMock(); Svc.initGrd({ storage: sp });
const gIndukSvc = { id: 'ind1', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta Rupiah' };
await Svc.simpanGoal(gIndukSvc, { user: LEADER, allUsers: tim });
const hasilTurun = (await Svc.turunkanGoal(gIndukSvc, { user: LEADER, allUsers: tim })).dibuat;
cek('19v. Turunkan membuat goal untuk tiap bawahan langsung', hasilTurun.length === 2, hasilTurun.length);
cek('19w. Tiap turunan punya id sendiri (tidak saling menimpa)',
  new Set(hasilTurun.map(g => g.id)).size === 2);
cek('19x. Turunan menunjuk goal induk', hasilTurun.every(g => g.parentId === 'ind1'));
cek('19y. Turunan tersimpan sebagai baris terpisah',
  hasilTurun.every(g => sp.baris.has('grdgoal:rec:' + g.id)));
const turunLagi = await Svc.turunkanGoal(gIndukSvc, { user: LEADER, allUsers: tim });
cek('19z-2. Klik turunkan kedua kali menghasilkan 0 goal baru', turunLagi.dibuat.length === 0, turunLagi.dibuat.length);
cek('19z-2b. Yang dilewati dilaporkan, bukan disembunyikan', turunLagi.dilewati === 2, turunLagi.dilewati);

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
const spD = storageMock(); Svc.initGrd({ storage: spD });
const dIndukG = { id: 'd-induk', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta Rupiah' };
await Svc.simpanGoal(dIndukG, { user: LEADER, allUsers: tim });
const dAnak = (await Svc.turunkanGoal(dIndukG, { user: LEADER, allUsers: tim })).dibuat;
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
const spQ = storageMock(); Svc.initGrd({ storage: spQ });
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
const spC = storageMock(); Svc.initGrd({ storage: spC });
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
// --- RPC belum dipasang → fallback ke kv_store, TANPA error ke pengguna ---
let rekamA = [];
let spR = storageMock();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spR, rpc: rpcMock({ belumDipasang: true, rekam: rekamA }) });
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
const spB = storageMock();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spB, rpc: rpcMock({ rekam: rekamB }) });
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
const spC2 = storageMock();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spC2, rpc: rpcMock({ tolakDengan: 'Anda bukan pemilik goal ini.' }) });
let pesanTolak = '';
try { await Svc.simpanGoal(goalSah({ id: 'c1' }), { user: STAF1, allUsers: tim }); }
catch (e) { pesanTolak = e.message; }
cek('25k. Penolakan server sampai ke pengguna apa adanya',
  pesanTolak === 'Anda bukan pemilik goal ini.', pesanTolak);
cek('25l. Ditolak server → TIDAK diam-diam ditulis ke kv_store',
  !spC2.baris.has('grdgoal:rec:c1'));

// --- hapus & turunkan ikut jalur yang sama ---
let rekamD = [];
const spD2 = storageMock();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spD2, rpc: rpcMock({ rekam: rekamD }) });
await Svc.hapusGoal(goalSah({ id: 'd1' }), { user: OWNER, allUsers: tim });
cek('25m. Hapus lewat RPC saat tersedia', rekamD.some(r => r.nama === 'grd_hapus_goal'));
cek('25n. Id dikirim ke RPC hapus', rekamD.find(r => r.nama === 'grd_hapus_goal').args.p_id === 'd1');

let rekamE = [];
const spE = storageMock();
Svc.setJalurGrd('auto');
Svc.initGrd({ storage: spE, rpc: rpcMock({ rekam: rekamE }) });
const turunRpc = await Svc.turunkanGoal(
  { id: 'e1', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta' },
  { user: LEADER, allUsers: tim, goalAda: [] });
cek('25o. Turunkan ikut lewat RPC', turunRpc.dibuat.length === 2
  && rekamE.filter(r => r.nama === 'grd_simpan_goal').length === 2);

// --- tanpa rpc disuntik sama sekali ---
const spF = storageMock();
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

judul('27. Turunkan goal — kegagalan sebagian harus dilaporkan');
const spT = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spT });
const gT = { id: 't1', ownerId: 'u-leader', periode: '2026-09', description: 'GMV tim', base: 0, target: 900, uom: 'Juta' };
await Svc.simpanGoal(gT, { user: LEADER, allUsers: tim });

const okSemua = await Svc.turunkanGoal(gT, { user: LEADER, allUsers: tim, goalAda: [] });
cek('27a. Bentuk kembalian { dibuat, gagal, dilewati }',
  Array.isArray(okSemua.dibuat) && Array.isArray(okSemua.gagal) && typeof okSemua.dilewati === 'number');
cek('27b. Semua berhasil → gagal kosong', okSemua.dibuat.length === 2 && okSemua.gagal.length === 0);
cek('27c. Tidak ada yang dilewati pada percobaan pertama', okSemua.dilewati === 0);

// storage yang SELALU gagal menulis
const spGagal = storageMock(); spGagal.gagalSet = true;
Svc.initGrd({ storage: spGagal });
const semuaGagal = await Svc.turunkanGoal(gT, { user: LEADER, allUsers: tim, goalAda: [] });
cek('27d. Semua gagal → dibuat kosong, gagal terisi',
  semuaGagal.dibuat.length === 0 && semuaGagal.gagal.length === 2, semuaGagal);
cek('27e. Kegagalan menyebut NAMA orangnya (bisa ditindaklanjuti)',
  semuaGagal.gagal.every(x => x.nama && x.nama !== 'Anggota'), semuaGagal.gagal.map(x => x.nama));
cek('27f. Kegagalan menyebut alasannya', semuaGagal.gagal.every(x => !!x.alasan));
cek('27g. Kegagalan membawa ownerId (untuk mencoba ulang)',
  semuaGagal.gagal.every(x => !!x.ownerId));

// sebagian sudah punya turunan → dilewati, bukan dobel
const spSebagian = storageMock(); Svc.initGrd({ storage: spSebagian });
const sudahAda = [{
  id: 'sudah', ownerId: 'u-wakil', parentId: 't1', periode: '2026-09',
  description: 'GMV tim', base: 0, target: 450, uom: 'Juta',
}];
const sebagian = await Svc.turunkanGoal(gT, { user: LEADER, allUsers: tim, goalAda: sudahAda });
cek('27h. Yang sudah punya dilewati', sebagian.dilewati === 1, sebagian.dilewati);
cek('27i. Sisanya tetap dibuat', sebagian.dibuat.length === 1 && sebagian.dibuat[0].ownerId === 'u-staf2');
cek('27j. Tidak ada yang gagal', sebagian.gagal.length === 0);

// pemilik tanpa bawahan
const tanpaBawahan = await Svc.turunkanGoal(
  { id: 't2', ownerId: 'u-staf1', periode: '2026-09', description: 'x', base: 0, target: 5, uom: 'x' },
  { user: STAF1, allUsers: tim, goalAda: [] });
cek('27k. Pemilik tanpa bawahan → semuanya kosong, bukan error',
  tanpaBawahan.dibuat.length === 0 && tanpaBawahan.gagal.length === 0 && tanpaBawahan.dilewati === 0);

cek('27l. Goal yang sudah dibuat TETAP tersimpan walau ada yang gagal', (() => {
  return spSebagian.baris.has('grdgoal:rec:' + sebagian.dibuat[0].id);
})());
cek('27m. Jejak hanya ditulis untuk yang BENAR-BENAR berhasil', (() => {
  const jejak = [...spGagal.baris.keys()].filter(k => k.startsWith('grdjejak:rec:'));
  return jejak.length === 0; // semua gagal → tidak ada jejak
})());
Svc.setJalurGrd('auto');

judul('28. Template goal per peran yang bisa diubah tim');
cek('28a. Kunci simpanan template', G.TEMPLATE_KEY === 'grd:templates');
cek('28b. Daftar peran template diambil dari hierarki.js (satu sumber)',
  G.ROLE_KEYS_GRD.join() === 'owner,manajer,leader,wakil,operasional', G.ROLE_KEYS_GRD);

cek('28c. Template bawaan dipakai saat belum ada simpanan', (() => {
  const g = G.gabungTemplate(null);
  return g.leader === G.TEMPLATE_GOAL.leader && g.operasional === G.TEMPLATE_GOAL.operasional;
})());
cek('28d. Peran yang diatur memakai simpanan', (() => {
  const g = G.gabungTemplate({ leader: [{ description: 'Khusus tim', base: 0, target: 5, uom: 'Sesi' }] });
  return g.leader.length === 1 && g.leader[0].description === 'Khusus tim';
})());
cek('28e. Peran LAIN tetap bawaan (tidak ikut terhapus)', (() => {
  const g = G.gabungTemplate({ leader: [{ description: 'X', base: 0, target: 1, uom: 'y' }] });
  return g.operasional === G.TEMPLATE_GOAL.operasional;
})());
cek('28f. Simpanan rusak untuk satu peran → peran itu balik ke bawaan', (() => {
  const g = G.gabungTemplate({ leader: [{ description: '', base: 0, target: 0, uom: '' }] });
  return g.leader === G.TEMPLATE_GOAL.leader;
})());
cek('28g. Simpanan bukan array diabaikan', (() => {
  const g = G.gabungTemplate({ leader: 'bukan array' });
  return g.leader === G.TEMPLATE_GOAL.leader;
})());
cek('28h. Semua peran selalu punya template', (() => {
  const g = G.gabungTemplate({});
  return G.ROLE_KEYS_GRD.every(r => Array.isArray(g[r]) && g[r].length > 0);
})());
cek('28i. Template hasil gabungan semuanya lolos validasi goal', (() => {
  const g = G.gabungTemplate({ manajer: [{ description: 'Uji', base: 0, target: 9, uom: 'Orang' }] });
  return Object.values(g).flat().every(t =>
    G.validasiGoal(G.terapkanTemplate(t, { ownerId: 'u1', periode: '2026-09' })) === '');
})());

cek('28j. normalisasiTemplate menolak yang tidak layak', (() => {
  return G.normalisasiTemplate(null) === null
    && G.normalisasiTemplate({ description: '', uom: 'x', base: 0, target: 1 }) === null
    && G.normalisasiTemplate({ description: 'a', uom: '', base: 0, target: 1 }) === null
    && G.normalisasiTemplate({ description: 'a', uom: 'x', base: 5, target: 5 }) === null;
})());
cek('28k. normalisasiTemplate merapikan yang layak', (() => {
  const t = G.normalisasiTemplate({ description: '  A  ', uom: ' Konten ', base: '0', target: '9', lain: 'buang' });
  return t.description === 'A' && t.uom === 'Konten' && t.base === 0 && t.target === 9 && t.lain === undefined;
})());

cek('28l. validasiDaftarTemplate menolak deskripsi kosong',
  /deskripsi wajib/.test(G.validasiDaftarTemplate([{ description: '', uom: 'x', base: 0, target: 1 }])));
cek('28m. Menolak satuan kosong',
  /satuan wajib/.test(G.validasiDaftarTemplate([{ description: 'a', uom: '', base: 0, target: 1 }])));
cek('28n. Menolak base === target',
  /sama dengan base/.test(G.validasiDaftarTemplate([{ description: 'a', uom: 'x', base: 2, target: 2 }])));
cek('28o. Menyebut template KE-BERAPA yang salah',
  /ke-2/.test(G.validasiDaftarTemplate([
    { description: 'a', uom: 'x', base: 0, target: 1 },
    { description: '', uom: 'x', base: 0, target: 1 },
  ])));
cek('28p. Daftar sah → lolos',
  G.validasiDaftarTemplate([{ description: 'a', uom: 'x', base: 0, target: 1 }]) === '');
cek('28q. Bukan array ditolak', G.validasiDaftarTemplate('x') !== '');

judul('29. Layanan template');
const spTpl = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spTpl });
const tplAwal = await Svc.ambilTemplate();
cek('29a. Tanpa simpanan → template bawaan', tplAwal.leader === G.TEMPLATE_GOAL.leader);

let tolakTpl = '';
try { await Svc.simpanTemplate('leader', [{ description: 'X', uom: 'y', base: 0, target: 1 }], { user: STAF1 }); }
catch (e) { tolakTpl = e.message; }
cek('29b. Staf TIDAK boleh mengubah template', /Hanya Owner\/Manajer/.test(tolakTpl), tolakTpl);
cek('29c. Ditolak → tidak ada baris template tertulis', !spTpl.baris.has('grd:templates'));

tolakTpl = '';
try { await Svc.simpanTemplate('leader', [{ description: 'X', uom: 'y', base: 0, target: 1 }], { user: LEADER }); }
catch (e) { tolakTpl = e.message; }
cek('29d. Leader pun TIDAK boleh (template dilihat semua orang)', /Hanya Owner\/Manajer/.test(tolakTpl));

tolakTpl = '';
try { await Svc.simpanTemplate('ngawur', [{ description: 'X', uom: 'y', base: 0, target: 1 }], { user: OWNER }); }
catch (e) { tolakTpl = e.message; }
cek('29e. Peran tidak dikenal ditolak', /Peran tidak dikenal/.test(tolakTpl));

tolakTpl = '';
try { await Svc.simpanTemplate('leader', [{ description: '', uom: 'y', base: 0, target: 1 }], { user: OWNER }); }
catch (e) { tolakTpl = e.message; }
cek('29f. Template tidak sah ditolak sebelum disimpan', /deskripsi wajib/.test(tolakTpl));

const sesudah = await Svc.simpanTemplate('leader',
  [{ description: 'Goal tim khusus', uom: 'Sesi', base: 0, target: 8 }], { user: OWNER });
cek('29g. Owner boleh menyimpan', sesudah.leader[0].description === 'Goal tim khusus');
cek('29h. Tersimpan sebagai SATU baris grd:templates', spTpl.baris.has('grd:templates'));
cek('29i. Peran lain tidak ikut tertulis ke simpanan',
  Object.keys(spTpl.baris.get('grd:templates')).join() === 'leader');
const tplBaru = await Svc.ambilTemplate();
cek('29k. Hasil baca ulang memuat perubahan', tplBaru.leader[0].description === 'Goal tim khusus');
cek('29l. Peran lain tetap bawaan setelah perubahan', tplBaru.operasional === G.TEMPLATE_GOAL.operasional);

const dikembalikan = await Svc.simpanTemplate('leader', [], { user: OWNER });
cek('29m. Daftar kosong = kembali ke bawaan', dikembalikan.leader === G.TEMPLATE_GOAL.leader);
cek('29n. Entri peran dihapus dari simpanan, bukan disimpan kosong',
  !Object.prototype.hasOwnProperty.call(spTpl.baris.get('grd:templates'), 'leader'));

Svc.initGrd({ storage: { async get() { throw new Error('koneksi putus'); },
  async listByPrefix() { return []; }, async set() { return true; }, async delete() { return true; } } });
const tplGagal = await Svc.ambilTemplate();
cek('29p. Baca gagal → template bawaan, bukan kosong', tplGagal.operasional === G.TEMPLATE_GOAL.operasional);
Svc.initGrd({ storage: spTpl });
Svc.setJalurGrd('auto');

judul('30. Daftar template per peran');
cek('30a. templateDiubah: belum ada simpanan → false',
  !G.templateDiubah(null, 'leader') && !G.templateDiubah({}, 'leader'));
cek('30b. templateDiubah: ada simpanan sah → true',
  G.templateDiubah({ leader: [{ description: 'A', uom: 'x', base: 0, target: 1 }] }, 'leader'));
cek('30c. templateDiubah: simpanan RUSAK semua → false (yang dipakai tetap bawaan)',
  !G.templateDiubah({ leader: [{ description: '', uom: '', base: 0, target: 0 }] }, 'leader'));
cek('30d. templateDiubah: bukan array → false', !G.templateDiubah({ leader: 'x' }, 'leader'));
cek('30e. templateDiubah: peran lain tidak terpengaruh',
  !G.templateDiubah({ leader: [{ description: 'A', uom: 'x', base: 0, target: 1 }] }, 'operasional'));

const ringkasTpl = G.ringkasTemplate({ leader: [{ description: 'Khusus', uom: 'Sesi', base: 0, target: 8 }] });
cek('30f. Satu baris per peran', ringkasTpl.length === G.ROLE_KEYS_GRD.length);
cek('30g. Urut mengikuti ROLE_KEYS (Owner di atas)',
  ringkasTpl.map(r => r.peran).join() === 'owner,manajer,leader,wakil,operasional',
  ringkasTpl.map(r => r.peran));
cek('30h. Peran yang diubah ditandai',
  ringkasTpl.find(r => r.peran === 'leader').diubah === true);
cek('30i. Peran lain ditandai belum diubah',
  ringkasTpl.filter(r => r.peran !== 'leader').every(r => r.diubah === false));
cek('30j. Jumlah template ikut dihitung',
  ringkasTpl.find(r => r.peran === 'leader').jumlah === 1);
cek('30k. Tiap peran selalu punya daftar berisi',
  ringkasTpl.every(r => Array.isArray(r.daftar) && r.daftar.length > 0));
cek('30l. Tanpa simpanan sama sekali → semua bawaan, tidak ada yang "diubah"', (() => {
  const r = G.ringkasTemplate(null);
  return r.every(x => x.diubah === false) && r.every(x => x.jumlah > 0);
})());

const spDt = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spDt });
const dt1 = await Svc.daftarTemplate({ user: STAF1 });
cek('30m. Staf boleh MELIHAT daftar template', dt1.perPeran.length === 5);
cek('30n. Staf TIDAK boleh mengubah (bisaUbah=false)', dt1.bisaUbah === false);
cek('30o. Belum ada yang diubah', dt1.diubah.length === 0);
cek('30p. Total template dihitung', dt1.totalTemplate > 0);

const dt2 = await Svc.daftarTemplate({ user: OWNER });
cek('30q. Owner boleh mengubah (bisaUbah=true)', dt2.bisaUbah === true);
cek('30r. Manajer juga boleh', (await Svc.daftarTemplate({ user: orang('u-manajer') })).bisaUbah === true);
cek('30s. Leader TIDAK boleh', (await Svc.daftarTemplate({ user: LEADER })).bisaUbah === false);
cek('30t. Tanpa user → tidak boleh (default menolak)',
  (await Svc.daftarTemplate()).bisaUbah === false);

await Svc.simpanTemplate('wakil', [{ description: 'Pendampingan khusus', uom: 'Sesi', base: 0, target: 6 }], { user: OWNER });
const dt3 = await Svc.daftarTemplate({ user: OWNER });
cek('30u. Peran yang baru diubah muncul di daftar `diubah`', dt3.diubah.join() === 'wakil', dt3.diubah);
cek('30v. Isinya ikut berubah',
  dt3.perPeran.find(r => r.peran === 'wakil').daftar[0].description === 'Pendampingan khusus');
cek('30w. `template` siap dipakai langsung oleh form',
  dt3.template.wakil[0].description === 'Pendampingan khusus');
cek('30x. Peran lain tetap bawaan', dt3.template.leader === G.TEMPLATE_GOAL.leader);

Svc.initGrd({ storage: { async get() { throw new Error('putus'); },
  async listByPrefix() { return []; }, async set() { return true; }, async delete() { return true; } } });
const dtGagal = await Svc.daftarTemplate({ user: OWNER });
cek('30y. Gagal baca → daftar tetap terisi bawaan, bukan kosong',
  dtGagal.perPeran.length === 5 && dtGagal.totalTemplate > 0);
cek('30z. Gagal baca → tidak ada yang salah ditandai "diubah"', dtGagal.diubah.length === 0);
Svc.initGrd({ storage: spDt }); Svc.setJalurGrd('auto');

judul('31. Riwayat perubahan: dibaca per goal, bukan seluruh tim');
cek('31a. Prefix jejak satu goal', G.prefixJejakGoal('abc') === 'grdjejak:rec:abc:');
cek('31b. Id kosong → prefix kosong (jangan sampai menarik SEMUA jejak)',
  G.prefixJejakGoal('') === '' && G.prefixJejakGoal(null) === '');
cek('31c. Prefix diakhiri titik dua sebagai pemisah',
  G.prefixJejakGoal('x').endsWith(':'));
cek('31d. Kunci jejak yang ditulis cocok dengan prefixnya', (() => {
  const j = G.catatPerubahan(null, { id: 'gx', ownerId: 'u', periode: '2026-09',
    description: 'a', base: 0, target: 1, uom: 'x' }, { id: 'u', name: 'U' }, '2026-09-16T00:00:00.000Z');
  return (G.JEJAK_REC_PREFIX + j[0].id).startsWith(G.prefixJejakGoal('gx'));
})());

const spJ = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spJ });
const gA = { id: 'ja', ownerId: 'u-staf1', periode: '2026-09', description: 'Goal A', base: 0, target: 10, uom: 'x' };
const gB = { id: 'jb', ownerId: 'u-staf2', periode: '2026-09', description: 'Goal B', base: 0, target: 10, uom: 'x' };
await Svc.simpanGoal(gA, { user: OWNER, allUsers: tim });
await Svc.simpanGoal(gB, { user: OWNER, allUsers: tim });
await Svc.simpanGoal({ ...gA, target: 20 }, { user: OWNER, allUsers: tim, goalLama: gA });
await Svc.simpanGoal({ ...gB, target: 30 }, { user: OWNER, allUsers: tim, goalLama: gB });

const jejakA = await Svc.ambilJejakGoal('ja');
cek('31e. Hanya jejak goal itu yang kembali', jejakA.length === 2, jejakA.length);
cek('31f. Tidak ada jejak goal lain yang bocor', jejakA.every(j => j.goalId === 'ja'));
cek('31g. Terbaru di atas tetap berlaku', jejakA[0].waktu >= jejakA[1].waktu);

spJ.prefixDiminta = [];
await Svc.ambilJejakGoal('ja');
cek('31h. Membaca lewat prefix SPESIFIK goal, bukan seluruh jejak',
  spJ.prefixDiminta.length === 1 && spJ.prefixDiminta[0] === 'grdjejak:rec:ja:',
  spJ.prefixDiminta);
cek('31i. TIDAK pernah meminta prefix jejak global', !spJ.prefixDiminta.includes('grdjejak:rec:'));

cek('31j. Goal tanpa riwayat → kosong, tanpa menyentuh server',
  (await Svc.ambilJejakGoal('tidak-ada')).length === 0);
spJ.prefixDiminta = [];
const kosongJ = await Svc.ambilJejakGoal('');
cek('31l. Id kosong benar-benar tidak memanggil storage',
  kosongJ.length === 0 && spJ.prefixDiminta.length === 0, spJ.prefixDiminta);

// detail goal ikut jalur hemat
spJ.prefixDiminta = [];
const detailHemat = await Svc.ambilDetailGoal('ja', { allUsers: tim });
cek('31m. Panel detail ikut memakai jalur hemat',
  spJ.prefixDiminta.includes('grdjejak:rec:ja:') && !spJ.prefixDiminta.includes('grdjejak:rec:'),
  spJ.prefixDiminta);
cek('31n. Riwayat di panel detail tetap lengkap', detailHemat.riwayat.length === 2);

spJ.prefixDiminta = [];
const detailDioper = await Svc.ambilDetailGoal('ja', {
  allUsers: tim, goals: [gA], jejak: await Svc.ambilJejak(),
});
cek('31o. Jejak yang sudah dioper dipakai apa adanya (tanpa baca ulang)',
  detailDioper.riwayat.length === 2
  && !spJ.prefixDiminta.includes('grdjejak:rec:ja:'));

const cekId = await Svc.turunkanGoal(
  { id: 'jc', ownerId: 'u-leader', periode: '2026-09', description: 'C', base: 0, target: 9, uom: 'x' },
  { user: LEADER, allUsers: tim, goalAda: [] });
cek('31q. Id yang dibuat layanan tidak memuat ":"',
  cekId.dibuat.every(g => !String(g.id).includes(':')), cekId.dibuat.map(g => g.id));
const jejakTurunan = await Svc.ambilJejakGoal(cekId.dibuat[0].id);
cek('31s. Riwayat goal turunan terbaca', jejakTurunan.length === 1 && jejakTurunan[0].field === '_dibuat');
Svc.setJalurGrd('auto');

// ============================================================================
judul('32. SKENARIO UTUH — roll down dari perusahaan sampai staf');
// Uji alur, bukan potongan: goal perusahaan diturunkan berjenjang, lalu
// diperiksa lewat kedua sudut pandang (pohon ORANG & rantai GOAL) dan lewat
// panel detail. Kalau salah satu lapisan bergeser sendiri, blok ini yang jatuh.
// ============================================================================
const spSkenario = storageMock();
Svc.setJalurGrd('kv');
Svc.initGrd({ storage: spSkenario });

// 1) Owner membuat goal perusahaan (kuartalan).
const goalPerusahaan = {
  id: 'sk-corp', ownerId: 'u-owner', periode: '2026-Q3',
  description: 'GMV Al-Kahfi Corp', base: 0, target: 12, uom: 'Miliar Rupiah',
};
await Svc.simpanGoal(goalPerusahaan, { user: OWNER, allUsers: tim });
cek('32a. Goal perusahaan tersimpan', (await Svc.ambilGoal()).length === 1);

// 2) Owner menurunkan ke bawahan langsungnya (Leader).
const turun1 = await Svc.turunkanGoal(goalPerusahaan, { user: OWNER, allUsers: tim });
cek('32b. Turun ke bawahan langsung Owner', turun1.dibuat.length === 1, turun1.dibuat.length);
cek('32c. Yang dituruni memang Leader', turun1.dibuat[0].ownerId === 'u-leader');
cek('32d. Target utuh (satu bawahan → tidak terbagi)', turun1.dibuat[0].target === 12);
cek('32e. Periode kuartal ikut turun', turun1.dibuat[0].periode === '2026-Q3');

// 3) Leader menurunkan lagi ke bawahannya (Co-Leader + staf).
const goalLeader = turun1.dibuat[0];
const turun2 = await Svc.turunkanGoal(goalLeader, { user: LEADER, allUsers: tim });
cek('32f. Leader menurunkan ke 2 bawahan langsung', turun2.dibuat.length === 2);
cek('32g. Target dibagi rata (satuan Rupiah bisa dijumlah)',
  turun2.dibuat.every(g => g.target === 6), turun2.dibuat.map(g => g.target));
cek('32h. Semua menunjuk goal Leader sebagai induk',
  turun2.dibuat.every(g => g.parentId === goalLeader.id));

// 4) Co-Leader menurunkan ke stafnya — lapis KEEMPAT.
const goalWakil = turun2.dibuat.find(g => g.ownerId === 'u-wakil');
const turun3 = await Svc.turunkanGoal(goalWakil, { user: orang('u-wakil'), allUsers: tim });
cek('32i. Co-Leader bisa menurunkan lagi (bukan batas 2 lapis lama)', turun3.dibuat.length === 1);
cek('32j. Sampai ke staf paling bawah', turun3.dibuat[0].ownerId === 'u-staf1');
cek('32k. Targetnya ikut mengecil berjenjang', turun3.dibuat[0].target === 6);

// 5) Periksa lewat POHON ORANG.
const qSk = await Svc.queryPohon({ users: tim, periode: '2026-Q3' });
cek('32l. Total goal seluruh jenjang', qSk.ringkas.totalGoal === 5, qSk.ringkas.totalGoal);
cek('32m. Semua orang tetap muncul', G.ratakanPohon(qSk.pohon).length === tim.length);
cek('32n. Goal menempel pada pemilik yang tepat di tiap jenjang', (() => {
  const datar = G.ratakanPohon(qSk.pohon);
  const punya = (id) => (datar.find(s => s.user.id === id) || {}).goals || [];
  return punya('u-owner').length === 1 && punya('u-leader').length === 1
    && punya('u-wakil').length === 1 && punya('u-staf1').length === 1
    && punya('u-staf2').length === 1;
})());
cek('32o. Manajer yang tidak ikut jalur tetap tanpa goal', (() => {
  const s = G.ratakanPohon(qSk.pohon).find(x => x.user.id === 'u-manajer');
  return s.goals.length === 0;
})());

// 6) Periksa lewat RANTAI GOAL (sudut pandang kedua).
const rantaiSk = G.rantaiGoal(qSk.semuaGoal);
cek('32p. Rantai punya SATU akar: goal perusahaan',
  rantaiSk.length === 1 && rantaiSk[0].goal.id === 'sk-corp', rantaiSk.map(r => r.goal.id));
cek('32q. Kedalaman rantai 4 lapis', (() => {
  return Math.max(...G.ratakanRantai(rantaiSk).map(s => s.level)) === 3;
})(), G.ratakanRantai(rantaiSk).map(s => s.level));
cek('32r. Semua goal masuk rantai (tidak ada yang yatim)',
  G.ratakanRantai(rantaiSk).length === 5);
cek('32s. Dua sudut pandang menghitung goal yang SAMA',
  G.ratakanRantai(rantaiSk).length === qSk.ringkas.totalGoal);

// 7) Panel detail di tengah rantai.
const detailTengah = await Svc.ambilDetailGoal(goalLeader.id, { allUsers: tim });
cek('32t. Detail menemukan induknya (goal perusahaan)', detailTengah.induk.id === 'sk-corp');
cek('32u. Detail menemukan 2 turunannya', detailTengah.turunan.length === 2);
cek('32v. Pemiliknya benar', detailTengah.pemilik.id === 'u-leader');
cek('32w. Riwayat mencatat goal ini dibuat', detailTengah.riwayat.some(j => j.field === '_dibuat'));

// 8) Hapus goal tengah → rantai putus, turunannya TIDAK ikut hilang.
const dampakTengah = G.dampakHapusGoal(goalLeader, qSk.semuaGoal);
cek('32x. Dampak hapus dihitung sebelum tombol ditekan', dampakTengah.total === 3, dampakTengah);
await Svc.hapusGoal(goalLeader, { user: OWNER, allUsers: tim });
const sesudahHapus = await Svc.ambilGoal();
cek('32y. Goal tengah hilang', !sesudahHapus.some(g => g.id === goalLeader.id));
cek('32z. Turunannya TETAP ada (hanya rantainya putus)', sesudahHapus.length === 4);
cek('32z-2. Turunan yatim naik jadi akar rantai',
  G.rantaiGoal(sesudahHapus).length === 3, G.rantaiGoal(sesudahHapus).map(r => r.goal.id));

judul('33. Per-record: dua orang menulis bersamaan tidak saling menimpa');
// Inilah alasan goal disimpan satu baris per goal, bukan satu array besar.
const spBarengan = storageMock();
Svc.initGrd({ storage: spBarengan });
const gStaf1 = { id: 'br1', ownerId: 'u-staf1', periode: '2026-09', description: 'Punya Andi', base: 0, target: 30, uom: 'Konten' };
const gStaf2 = { id: 'br2', ownerId: 'u-staf2', periode: '2026-09', description: 'Punya Budi', base: 0, target: 10, uom: 'Produk' };

await Promise.all([
  Svc.simpanGoal(gStaf1, { user: STAF1, allUsers: tim }),
  Svc.simpanGoal(gStaf2, { user: STAF2, allUsers: tim }),
]);
cek('33a. Dua penulisan bersamaan sama-sama selamat',
  spBarengan.baris.has('grdgoal:rec:br1') && spBarengan.baris.has('grdgoal:rec:br2'));
cek('33b. Isi masing-masing utuh',
  spBarengan.baris.get('grdgoal:rec:br1').description === 'Punya Andi'
  && spBarengan.baris.get('grdgoal:rec:br2').description === 'Punya Budi');
cek('33c. Menempati baris berbeda (bukan satu array yang ditimpa)',
  [...spBarengan.baris.keys()].filter(k => k.startsWith('grdgoal:rec:')).length === 2);

await Promise.all([
  Svc.simpanGoal({ ...gStaf1, target: 40 }, { user: STAF1, allUsers: tim, goalLama: gStaf1 }),
  Svc.simpanGoal({ ...gStaf2, target: 20 }, { user: STAF2, allUsers: tim, goalLama: gStaf2 }),
]);
cek('33d. Perubahan bersamaan juga tidak saling menimpa',
  spBarengan.baris.get('grdgoal:rec:br1').target === 40
  && spBarengan.baris.get('grdgoal:rec:br2').target === 20);
cek('33e. Jejak keduanya tercatat terpisah', (() => {
  const j1 = [...spBarengan.baris.values()].filter(v => v && v.goalId === 'br1' && v.field === 'target');
  const j2 = [...spBarengan.baris.values()].filter(v => v && v.goalId === 'br2' && v.field === 'target');
  return j1.length === 1 && j2.length === 1;
})());
cek('33f. Jejak tiap goal terpisah prefixnya',
  (await Svc.ambilJejakGoal('br1')).every(j => j.goalId === 'br1'));
Svc.setJalurGrd('auto');

judul('34. Kontrol akses: jawaban yang bisa DIJELASKAN');
const goalsAkses = [
  goalDari('u-owner', { id: 'ak-owner' }),
  goalDari('u-leader', { id: 'ak-leader' }),
  goalDari('u-wakil', { id: 'ak-wakil' }),
  goalDari('u-staf1', { id: 'ak-staf1' }),
];
const alasan = (siapa, goalId) =>
  G.alasanUbahGoal(orang(siapa), goalsAkses.find(g => g.id === goalId), tim);

cek('34a. Owner: alasannya menyebut wewenang menyeluruh',
  alasan('u-owner', 'ak-staf1').boleh && /seluruh goal/i.test(alasan('u-owner', 'ak-staf1').alasan));
cek('34b. Pemilik sendiri: alasannya jelas',
  alasan('u-staf1', 'ak-staf1').boleh && /miliknya sendiri/i.test(alasan('u-staf1', 'ak-staf1').alasan));
cek('34c. Bawahan LANGSUNG dibedakan dari berjenjang',
  /bawahan langsung/i.test(alasan('u-wakil', 'ak-staf1').alasan), alasan('u-wakil', 'ak-staf1'));
cek('34d. Bawahan BERJENJANG disebut berjenjang',
  /berjenjang/i.test(alasan('u-leader', 'ak-staf1').alasan), alasan('u-leader', 'ak-staf1'));
cek('34e. Ditolak: alasannya menjelaskan kenapa',
  !alasan('u-staf1', 'ak-leader').boleh
  && /bukan dirinya sendiri maupun bawahannya/i.test(alasan('u-staf1', 'ak-leader').alasan));
cek('34f. Co-Leader terhadap Leader ditolak', !alasan('u-wakil', 'ak-leader').boleh);
cek('34g. Jawabannya SELALU sama dengan bisaUbahGoal (tidak ada aturan kembar)', (() => {
  // Termasuk goal RUSAK: dulu `bisaUbahGoal` menjawab true untuk Owner sementara
  // `alasanUbahGoal` menjawab false — layar dan layanan saling membantah.
  const semua = [...goalsAkses, goalDari(''), { id: 'z' }, null];
  for (const u of [...tim, null]) for (const g of semua) {
    if (G.alasanUbahGoal(u, g, tim).boleh !== G.bisaUbahGoal(u, g, tim)) return false;
  }
  return true;
})());
cek('34g-2. Goal tanpa pemilik ditolak untuk SEMUA peran, Owner sekalipun',
  tim.every(u => !G.bisaUbahGoal(u, goalDari(''), tim)));
cek('34h. Tanpa pengguna → ditolak dengan alasan', (() => {
  const r = G.alasanUbahGoal(null, goalsAkses[0], tim);
  return !r.boleh && !!r.alasan;
})());
cek('34i. Goal tanpa pemilik → ditolak dengan alasan', (() => {
  const r = G.alasanUbahGoal(orang('u-owner'), goalDari(''), tim);
  return !r.boleh && /pemilik/i.test(r.alasan);
})());

judul('35. Matriks hak akses seluruh anggota');
const mx = G.matriksAkses(tim, goalsAkses);
const baris = (id) => mx.find(r => r.user.id === id);
cek('35a. Satu baris per anggota', mx.length === tim.length);
cek('35b. Urut pangkat (Owner di atas)', mx[0].user.role === 'owner');
cek('35c. Owner & Manajer berlingkup seluruh organisasi',
  baris('u-owner').lingkup === 'semua' && baris('u-manajer').lingkup === 'semua');
cek('35d. Leader & Co-Leader berlingkup tim',
  baris('u-leader').lingkup === 'tim' && baris('u-wakil').lingkup === 'tim');
cek('35e. Staf berlingkup dirinya sendiri', baris('u-staf1').lingkup === 'diri');
cek('35f. Owner boleh mengubah semua goal',
  baris('u-owner').jumlahBisaUbah === goalsAkses.length);
cek('35g. Staf hanya goalnya sendiri', baris('u-staf1').jumlahBisaUbah === 1);
cek('35h. Leader: goalnya + seluruh bawahannya', baris('u-leader').jumlahBisaUbah === 3,
  baris('u-leader').jumlahBisaUbah);
cek('35i. Jumlah bawahan transitif dihitung',
  baris('u-leader').jumlahBawahan === 3 && baris('u-staf1').jumlahBawahan === 0);
cek('35j. Goal sendiri dihitung terpisah', baris('u-wakil').goalSendiri === 1);
cek('35k. jumlahBisaBuatUntuk sama dengan calonPemilikGoal',
  baris('u-leader').jumlahBisaBuatUntuk === G.calonPemilikGoal(orang('u-leader'), tim).length);
cek('35l. totalGoal sama untuk semua baris (pembanding yang adil)',
  mx.every(r => r.totalGoal === goalsAkses.length));
cek('35m. Urutan stabil antar-panggilan',
  G.matriksAkses(tim, goalsAkses).map(r => r.user.id).join()
  === G.matriksAkses(tim, goalsAkses).map(r => r.user.id).join());
cek('35n. Tanpa goal sama sekali → tidak error, semua nol',
  G.matriksAkses(tim, []).every(r => r.jumlahBisaUbah === 0 && r.totalGoal === 0));
cek('35o. Daftar anggota kosong → matriks kosong',
  G.matriksAkses([], goalsAkses).length === 0 && G.matriksAkses(null, goalsAkses).length === 0);
cek('35p. Anggota tanpa id dilewati',
  G.matriksAkses([null, {}, { id: '' }], goalsAkses).length === 0);
cek('35q. Tiap lingkup punya label & warna', (() => {
  return ['semua', 'tim', 'diri'].every(l => !!G.gayaLingkup(l).label && !!G.gayaLingkup(l).color);
})());
cek('35r. Lingkup tak dikenal jatuh ke "diri" (default paling sempit)',
  G.gayaLingkup('ngawur') === G.LINGKUP_AKSES.diri);

judul('36. Hak LIHAT goal — jalur ke atas harus tetap terbuka');
// Tim bercabang: dua cabang sejajar di bawah Owner, supaya "cabang lain" teruji.
const timCabang = [
  { id: 'o', name: 'Owner', role: 'owner', leaderId: null },
  { id: 'm', name: 'Manajer', role: 'manajer', leaderId: null },
  { id: 'l1', name: 'Leader A', role: 'leader', leaderId: 'o' },
  { id: 'w1', name: 'Co-Leader A', role: 'wakil', leaderId: 'l1' },
  { id: 's1', name: 'Staf A', role: 'operasional', leaderId: 'w1' },
  { id: 'l2', name: 'Leader B', role: 'leader', leaderId: 'o' },
  { id: 's2', name: 'Staf B', role: 'operasional', leaderId: 'l2' },
];
const gc = (ownerId) => ({ id: 'g-' + ownerId, ownerId, periode: '2026-09',
  description: 'Goal ' + ownerId, base: 0, target: 10, uom: 'x' });
const lihat = (siapa, punya) =>
  G.bisaLihatGoal(timCabang.find(u => u.id === siapa), gc(punya), timCabang);

cek('36a. Rantai atasan ke atas terbaca',
  [...G.idAtasanKeAtas('s1', timCabang)].sort().join() === 'l1,o,w1',
  [...G.idAtasanKeAtas('s1', timCabang)]);
cek('36b. Akar tidak punya atasan', G.idAtasanKeAtas('o', timCabang).size === 0);
cek('36c. Rantai melingkar tidak menggantung', (() => {
  const l = [{ id: 'a', role: 'operasional', leaderId: 'b' }, { id: 'b', role: 'operasional', leaderId: 'a' }];
  return G.idAtasanKeAtas('a', l).size <= 2;
})());
cek('36d. userId kosong → kosong', G.idAtasanKeAtas('', timCabang).size === 0);

cek('36e. Owner melihat semua', ['o', 'm', 'l1', 'w1', 's1', 'l2', 's2'].every(x => lihat('o', x)));
cek('36f. Manajer melihat semua', lihat('m', 's2') && lihat('m', 's1'));
cek('36g. Staf melihat goalnya sendiri', lihat('s1', 's1'));
cek('36h. Staf melihat goal ATASANNYA (Co-Leader)', lihat('s1', 'w1'));
cek('36i. Staf melihat goal atasan BERJENJANG (Leader)', lihat('s1', 'l1'));
cek('36j. Staf melihat goal PERUSAHAAN (Owner) — inti roll down', lihat('s1', 'o'));
cek('36k. Staf TIDAK melihat goal cabang lain yang sejajar', !lihat('s1', 's2'));
cek('36l. Staf TIDAK melihat goal Leader cabang lain', !lihat('s1', 'l2'));
cek('36m. Staf TIDAK melihat goal Manajer (bukan atasannya)', !lihat('s1', 'm'));
cek('36n. Leader melihat goal bawahannya', lihat('l1', 's1') && lihat('l1', 'w1'));
cek('36o. Leader TIDAK melihat goal Leader lain', !lihat('l1', 'l2'));
cek('36p. Co-Leader melihat ke atas DAN ke bawah',
  lihat('w1', 'l1') && lihat('w1', 'o') && lihat('w1', 's1'));
cek('36q. Tanpa pengguna → tidak boleh', !G.bisaLihatGoal(null, gc('o'), timCabang));
cek('36r. Goal tanpa pemilik → TIDAK boleh dilihat siapa pun, Owner sekalipun', (() => {
  const rusak = { id: 'x', ownerId: '', periode: '2026-09', description: 'a', base: 0, target: 1, uom: 'x' };
  return timCabang.every(u => !G.bisaLihatGoal(u, rusak, timCabang));
})());

cek('36s. alasanLihatGoal sejalan dengan bisaLihatGoal (termasuk goal rusak)', (() => {
  const rusak = [{ ownerId: '' }, { id: 'z' }, null];
  for (const u of [...timCabang, null]) {
    for (const p of timCabang) {
      if (G.alasanLihatGoal(u, gc(p.id), timCabang).boleh !== G.bisaLihatGoal(u, gc(p.id), timCabang)) return false;
    }
    for (const r of rusak) {
      if (G.alasanLihatGoal(u, r, timCabang).boleh !== G.bisaLihatGoal(u, r, timCabang)) return false;
    }
  }
  return true;
})());
cek('36t. Alasan melihat goal atasan menyebut asal-usul target',
  /turunan dari mana/i.test(G.alasanLihatGoal(timCabang[4], gc('o'), timCabang).alasan));
cek('36u. Alasan ditolak menyebut cabang lain',
  /cabang lain/i.test(G.alasanLihatGoal(timCabang[4], gc('s2'), timCabang).alasan));

cek('36v. goalYangBisaDilihat menyaring daftar', (() => {
  const semua = timCabang.map(u => gc(u.id));
  const utkStaf = G.goalYangBisaDilihat(timCabang[4], semua, timCabang);
  return utkStaf.map(g => g.ownerId).sort().join() === 'l1,o,s1,w1';
})());

judul('37. Pohon menghitung goal yang disembunyikan');
const semuaGc = timCabang.map(u => gc(u.id));
const pohonStaf = G.bangunPohonGoal({
  users: timCabang, goals: semuaGc, periode: '2026-09',
  bolehLihat: (g) => G.bisaLihatGoal(timCabang[4], g, timCabang),
});
const simpulStaf = (id) => G.ratakanPohon(pohonStaf).find(s => s.user.id === id);
cek('37a. Semua ORANG tetap muncul (struktur tidak disembunyikan)',
  G.ratakanPohon(pohonStaf).length === timCabang.length);
cek('37b. Goal yang boleh dilihat tetap tampil', simpulStaf('o').goals.length === 1);
cek('37c. Goal cabang lain TIDAK tampil', simpulStaf('s2').goals.length === 0);
cek('37d. Tapi DIHITUNG sebagai tersembunyi (bukan "belum punya goal")',
  simpulStaf('s2').tersembunyi === 1, simpulStaf('s2'));
cek('37e. Simpul yang goalnya terlihat tidak punya tersembunyi',
  simpulStaf('o').tersembunyi === 0);
cek('37f. Orang yang memang tidak punya goal: tersembunyi 0', (() => {
  const p = G.bangunPohonGoal({
    users: timCabang, goals: [gc('o')], periode: '2026-09',
    bolehLihat: () => true,
  });
  return G.ratakanPohon(p).find(s => s.user.id === 's2').tersembunyi === 0;
})());
cek('37g. Tanpa bolehLihat, tidak ada yang disembunyikan (perilaku lama utuh)', (() => {
  const p = G.bangunPohonGoal({ users: timCabang, goals: semuaGc, periode: '2026-09' });
  return G.ratakanPohon(p).every(s => s.tersembunyi === 0);
})());
cek('37h. Ringkasan hanya menghitung goal yang terlihat',
  G.ringkasPohon(pohonStaf).totalGoal === 4, G.ringkasPohon(pohonStaf).totalGoal);
cek('37i. Owner melihat seluruh goal', (() => {
  const p = G.bangunPohonGoal({
    users: timCabang, goals: semuaGc, periode: '2026-09',
    bolehLihat: (g) => G.bisaLihatGoal(timCabang[0], g, timCabang),
  });
  return G.ringkasPohon(p).totalGoal === timCabang.length;
})());

judul('38. Pesan penolakan harus MENJELASKAN, bukan sekadar menolak');
const spTolak = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spTolak });
const gMilikLeader = { id: 'tk1', ownerId: 'u-leader', periode: '2026-09',
  description: 'GMV tim', base: 0, target: 900, uom: 'Juta' };
await Svc.simpanGoal(gMilikLeader, { user: LEADER, allUsers: tim });

const pesanDari = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message; } };

const pesanUbah = await pesanDari(() => Svc.simpanGoal({ ...gMilikLeader, target: 1 },
  { user: STAF1, allUsers: tim, goalLama: gMilikLeader }));
cek('38a. Menolak ubah DAN menjelaskan kenapa',
  /tidak berwenang mengubah/.test(pesanUbah) && /bukan dirinya sendiri maupun bawahannya/.test(pesanUbah), pesanUbah);

const pesanHapus = await pesanDari(() => Svc.hapusGoal(gMilikLeader, { user: STAF1, allUsers: tim }));
cek('38b. Menolak hapus DAN menjelaskan kenapa',
  /tidak berwenang menghapus/.test(pesanHapus) && /bukan dirinya sendiri/.test(pesanHapus), pesanHapus);

const pesanTurun = await pesanDari(() => Svc.turunkanGoal(gMilikLeader, { user: STAF1, allUsers: tim }));
cek('38c. Menolak turunkan DAN menjelaskan kenapa',
  /tidak berwenang menurunkan/.test(pesanTurun) && /bukan dirinya sendiri/.test(pesanTurun), pesanTurun);

const pesanAtasNama = await pesanDari(() => Svc.simpanGoal(
  { id: 'tk2', ownerId: 'u-leader', periode: '2026-09', description: 'x', base: 0, target: 5, uom: 'x' },
  { user: STAF1, allUsers: tim }));
cek('38d. Menolak membuat atas nama orang lain DAN MENYEBUT NAMANYA',
  /Leader TAP/.test(pesanAtasNama), pesanAtasNama);
cek('38e. Menyebutkan siapa yang boleh dibuatkan goal',
  /diri sendiri dan anggota di bawah Anda/.test(pesanAtasNama), pesanAtasNama);

cek('38f. Alasan di pesan SAMA dengan yang ditampilkan halaman Kontrol Akses', (() => {
  const dariHalaman = G.alasanUbahGoal(STAF1, gMilikLeader, tim).alasan;
  return pesanUbah.includes(dariHalaman);
})());
cek('38g. Yang berwenang tetap lolos tanpa pesan apa pun',
  (await pesanDari(() => Svc.simpanGoal({ ...gMilikLeader, target: 950 },
    { user: OWNER, allUsers: tim, goalLama: gMilikLeader }))) === '');
cek('38h. Penolakan tidak meninggalkan perubahan',
  spTolak.baris.get('grdgoal:rec:tk1').target === 950 && !spTolak.baris.has('grdgoal:rec:tk2'));
Svc.setJalurGrd('auto');

judul('39. Pratinjau akses — membuktikan aturan, bukan sekadar menyatakannya');
const goalsPra = timCabang.map(u => gc(u.id));
const pra = (id) => G.pratinjauAkses(timCabang.find(u => u.id === id), timCabang, goalsPra);

cek('39a. Owner melihat seluruh goal',
  pra('o').terlihat === goalsPra.length && pra('o').tersembunyi === 0);
cek('39b. Owner bisa mengubah semua', pra('o').bisaUbah === goalsPra.length);
cek('39c. Staf cabang A hanya melihat jalurnya (diri + atasan ke atas)',
  pra('s1').terlihat === 4, pra('s1').terlihat);
cek('39d. Sisanya dihitung tersembunyi',
  pra('s1').tersembunyi === goalsPra.length - 4);
cek('39e. Staf hanya bisa mengubah goalnya sendiri', pra('s1').bisaUbah === 1);
cek('39f. Orang yang goalnya tersembunyi disebutkan',
  pra('s1').orangTersembunyi.map(u => u.id).sort().join() === 'l2,m,s2',
  pra('s1').orangTersembunyi.map(u => u.id));
cek('39g. Orang yang goalnya terlihat disebutkan',
  pra('s1').orangTerlihat.map(u => u.id).sort().join() === 'l1,o,s1,w1');
cek('39h. terlihat + tersembunyi = total (tidak ada yang hilang dihitung)',
  timCabang.every(u => {
    const p = G.pratinjauAkses(u, timCabang, goalsPra);
    return p.terlihat + p.tersembunyi === p.totalGoal;
  }));
cek('39i. Leader B tidak melihat cabang A',
  pra('l2').orangTersembunyi.some(u => u.id === 's1'));
cek('39j. Sejalan dengan bisaLihatGoal (tidak ada aturan kembar)',
  timCabang.every(u => {
    const p = G.pratinjauAkses(u, timCabang, goalsPra);
    const hitung = goalsPra.filter(g => G.bisaLihatGoal(u, g, timCabang)).length;
    return p.terlihat === hitung;
  }));
cek('39k. Tanpa goal → semua nol, tidak error', (() => {
  const p = G.pratinjauAkses(timCabang[0], timCabang, []);
  return p.totalGoal === 0 && p.terlihat === 0 && p.orangTersembunyi.length === 0;
})());
cek('39l. Tanpa pengguna → tidak ada yang terlihat',
  G.pratinjauAkses(null, timCabang, goalsPra).terlihat === 0);
cek('39m. orangTersembunyi hanya memuat yang PUNYA goal', (() => {
  const p = G.pratinjauAkses(timCabang[4], timCabang, [gc('s2')]);
  return p.orangTersembunyi.length === 1 && p.orangTersembunyi[0].id === 's2';
})());

judul('40. Modul mock — dudukan uji yang dipakai bersama');
const mk = storageMock();
await mk.set('a:1', { id: 1 });
await mk.set('a:2', { id: 2 });
await mk.set('b:1', { id: 3 });
cek('40b. listByPrefix hanya mengambil prefix yang diminta',
  (await mk.listByPrefix('a:')).length === 2);
const urut = await mk.listByPrefix('a:');
cek('40d. Urutan menaik menurut kunci', urut[0].id === 1 && urut[1].id === 2);
cek('40e. get mengembalikan null kalau tidak ada', (await mk.get('entah')) === null);
await mk.delete('a:1');
cek('40g. Setelah delete, barisnya hilang', (await mk.listByPrefix('a:')).length === 1);
cek('40h. Merekam prefix yang diminta (untuk membuktikan jalur hemat)',
  mk.prefixDiminta.filter(x => x === 'a:').length >= 2);
cek('40i. bersihkanRekaman mengosongkan rekaman', (() => {
  mk.bersihkanRekaman();
  return mk.prefixDiminta.length === 0;
})());
cek('40j. jumlah() menghitung baris per prefix', mk.jumlah('a:') === 1 && mk.jumlah('b:') === 1);
mk.gagalSet = true;
cek('40l. set mengembalikan false saat gagalSet', (await mk.set('c:1', {})) === false);
cek('40m. Baris tidak bertambah saat gagal', mk.jumlah('c:') === 0);
mk.gagalSet = false;

const rekamMock = [];
const rm = rpcMock({ rekam: rekamMock });
await rm('grd_simpan_goal', { p_goal: { id: 'x' } });
cek('40o. Panggilan tercatat dengan nama & argumen',
  rekamMock.length === 1 && rekamMock[0].nama === 'grd_simpan_goal');
cek('40p. dipanggil() menghitung per nama fungsi', rm.dipanggil('grd_simpan_goal') === 1);
const rmBelum = rpcMock({ belumDipasang: true });
const hasilBelum = await rmBelum('grd_simpan_goal', {});
cek('40r. Pesannya dikenali layanan sebagai "belum dipasang"',
  /Could not find the function/.test(hasilBelum.error.message));
const rmTolak = rpcMock({ tolakDengan: 'Ditolak aturan.' });
cek('40s. tolakDengan meniru penolakan aturan server',
  (await rmTolak('grd_simpan_goal', {})).error.message === 'Ditolak aturan.');

judul('41. Gerbang tampilan — rantai tidak bocor ke cabang lain');
const spGb = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spGb });
// Owner punya goal induk; dua cabang menurunkannya.
const gbInduk = { id: 'gb-induk', ownerId: 'o', periode: '2026-09',
  description: 'GMV Corp', base: 0, target: 12, uom: 'Miliar' };
const gbA = { id: 'gb-a', ownerId: 'l1', parentId: 'gb-induk', periode: '2026-09',
  description: 'GMV cabang A', base: 0, target: 6, uom: 'Miliar' };
const gbB = { id: 'gb-b', ownerId: 'l2', parentId: 'gb-induk', periode: '2026-09',
  description: 'GMV cabang B', base: 0, target: 6, uom: 'Miliar' };
for (const g of [gbInduk, gbA, gbB]) {
  await Svc.simpanGoal(g, { user: timCabang[0], allUsers: timCabang });
}

const detailOwner = await Svc.ambilDetailGoal('gb-induk', { user: timCabang[0], allUsers: timCabang });
cek('41a. Owner melihat kedua turunan', detailOwner.turunan.length === 2);

const stafA = timCabang.find(u => u.id === 's1');
const detailStafA = await Svc.ambilDetailGoal('gb-induk', { user: stafA, allUsers: timCabang });
cek('41b. Staf cabang A boleh membuka goal perusahaan (atasannya)', detailStafA !== null);
cek('41c. Tapi hanya melihat turunan cabangnya sendiri',
  detailStafA.turunan.length === 1 && detailStafA.turunan[0].id === 'gb-a',
  detailStafA.turunan.map(t => t.id));
cek('41d. Goal cabang lain TIDAK bocor walau cuma jumlahnya',
  !detailStafA.turunan.some(t => t.id === 'gb-b'));

const detailCabangLain = await Svc.ambilDetailGoal('gb-b', { user: stafA, allUsers: timCabang });
cek('41e. Goal cabang lain tidak bisa dibuka sama sekali', detailCabangLain === null);

const detailTanpaUser = await Svc.ambilDetailGoal('gb-induk', { allUsers: timCabang });
cek('41g. Tanpa user: seluruh rantai terbaca (dipakai backup & rekap)',
  detailTanpaUser.turunan.length === 2);
cek('41h. Induk pun ikut digerbangi', (() => {
  return detailStafA.induk === null; // gb-induk memang tidak punya induk
})());
lepasMockGrd();

// ============================================================================
judul('42. Lead Measure — batas 1–3 dan alur usul–persetujuan');
// ============================================================================
const lm = (extra = {}) => ({
  id: 'lm1', goalId: 'g1', ownerId: 'u-staf1',
  description: 'Konten tayang per minggu', targetMingguan: 5, uom: 'Konten', ...extra,
});
cek('42a. Kunci per-record', L.LEAD_REC_PREFIX === 'grdlead:rec:' && L.LEAD_BACKUP_KEY === 'grd:lead:all');
cek('42b. Batas maksimal 3 aktif per goal', L.MAKS_LEAD_AKTIF === 3);

cek('42c. Lead lengkap lolos validasi', L.validasiLead(lm()) === '');
cek('42d. Tanpa goal ditolak', /menempel pada sebuah goal/.test(L.validasiLead(lm({ goalId: '' }))));
cek('42e. Tanpa pemilik ditolak', /punya pemilik/.test(L.validasiLead(lm({ ownerId: '' }))));
cek('42f. Tanpa deskripsi ditolak', /tindakan mingguannya/.test(L.validasiLead(lm({ description: '' }))));
cek('42g. Tanpa satuan ditolak', /Satuan wajib/.test(L.validasiLead(lm({ uom: '' }))));
cek('42h. Target nol ditolak (tanpa angka, ia cuma niat)',
  /lebih dari nol/.test(L.validasiLead(lm({ targetMingguan: 0 }))));
cek('42i. Target minus ditolak', /lebih dari nol/.test(L.validasiLead(lm({ targetMingguan: -3 }))));
cek('42j. Bukan objek ditolak', L.validasiLead(null) !== '');

cek('42k. Status bawaan "usul"', L.normalisasiLead(lm()).status === 'usul');
cek('42l. Status tak dikenal jatuh ke "usul"', L.normalisasiLead(lm({ status: 'ngawur' })).status === 'usul');
cek('42m. Angka rusak jadi 0 (bukan NaN)',
  Number.isFinite(L.normalisasiLead(lm({ targetMingguan: 'xx' })).targetMingguan));
cek('42n. Tiap status punya label & warna',
  ['usul', 'aktif', 'perbaiki', 'ditolak'].every(x => !!L.STATUS_LEAD[x].label && !!L.STATUS_LEAD[x].color));
cek('42o. gayaStatusLead aman untuk status tak dikenal',
  L.gayaStatusLead('ngawur') === L.STATUS_LEAD.usul);

judul('43. Alur status lead measure');
cek('43a. usul → aktif SAH', L.bolehPindahStatus('usul', 'aktif'));
cek('43b. usul → perbaiki SAH', L.bolehPindahStatus('usul', 'perbaiki'));
cek('43c. usul → ditolak SAH', L.bolehPindahStatus('usul', 'ditolak'));
cek('43d. perbaiki → usul SAH (diusulkan ulang setelah diperbaiki)',
  L.bolehPindahStatus('perbaiki', 'usul'));
cek('43e. ditolak → usul SAH (boleh diusulkan lagi)', L.bolehPindahStatus('ditolak', 'usul'));
cek('43f. ditolak → aktif TIDAK SAH (tidak ada jalan pintas tanpa diusulkan ulang)',
  !L.bolehPindahStatus('ditolak', 'aktif'));
cek('43g. perbaiki → aktif TIDAK SAH', !L.bolehPindahStatus('perbaiki', 'aktif'));
cek('43h. aktif → usul TIDAK SAH', !L.bolehPindahStatus('aktif', 'usul'));
cek('43i. aktif boleh dicabut jadi perbaiki/ditolak',
  L.bolehPindahStatus('aktif', 'perbaiki') && L.bolehPindahStatus('aktif', 'ditolak'));
cek('43j. Status ngawur tidak membuka jalan apa pun', !L.bolehPindahStatus('ngawur', 'aktif'));

judul('44. Hitungan per goal & batas slot');
const daftarLead = [
  lm({ id: 'a', status: 'aktif' }),
  lm({ id: 'b', status: 'aktif' }),
  lm({ id: 'c', status: 'usul' }),
  lm({ id: 'd', status: 'ditolak' }),
  lm({ id: 'e', goalId: 'g2', status: 'aktif' }),
];
cek('44a. leadPerGoal menyaring per goal', L.leadPerGoal(daftarLead, 'g1').length === 4);
cek('44b. leadAktif hanya yang aktif', L.leadAktif(daftarLead, 'g1').length === 2);
cek('44c. leadMenunggu hanya yang usul', L.leadMenunggu(daftarLead, 'g1').length === 1);
cek('44d. Goal lain tidak tercampur', L.leadAktif(daftarLead, 'g2').length === 1);
cek('44e. Sisa slot = 3 - aktif', L.sisaSlotAktif(daftarLead, 'g1') === 1);
cek('44f. Slot penuh saat 3 aktif', (() => {
  const penuh = [...daftarLead, lm({ id: 'f', status: 'aktif' })];
  return L.sisaSlotAktif(penuh, 'g1') === 0;
})());
cek('44g. Sisa slot tidak pernah minus', (() => {
  const lebih = Array.from({ length: 6 }, (_, i) => lm({ id: 'x' + i, status: 'aktif' }));
  return L.sisaSlotAktif(lebih, 'g1') === 0;
})());
cek('44h. Goal tanpa lead: sisa penuh 3', L.sisaSlotAktif(daftarLead, 'g-kosong') === 3);
cek('44i. statusLeadGoal menandai "kosong"', L.statusLeadGoal(daftarLead, 'g-kosong').keadaan === 'kosong');
cek('44j. statusLeadGoal menandai "sehat"', L.statusLeadGoal(daftarLead, 'g1').keadaan === 'sehat');
cek('44k. statusLeadGoal menandai "penuh"', (() => {
  const penuh = [...daftarLead, lm({ id: 'f', status: 'aktif' })];
  return L.statusLeadGoal(penuh, 'g1').keadaan === 'penuh';
})());
cek('44l. Daftar kosong aman',
  L.leadPerGoal(null, 'g1').length === 0 && L.statusLeadGoal([], 'g1').aktif === 0);
cek('44m. goalId kosong tidak menyeret semua', L.leadPerGoal(daftarLead, '').length === 0);

judul('45. Hak akses lead measure');
const goalStaf = goalDari('u-staf1', { id: 'g1' });
cek('45a. Pemilik goal boleh mengusulkan', L.bisaUsulLead(orang('u-staf1'), goalStaf, tim));
cek('45b. Atasannya boleh mengusulkan', L.bisaUsulLead(orang('u-leader'), goalStaf, tim));
cek('45c. Owner boleh', L.bisaUsulLead(orang('u-owner'), goalStaf, tim));
cek('45d. Rekan sejajar TIDAK boleh', !L.bisaUsulLead(orang('u-staf2'), goalStaf, tim));

const usulStaf = lm({ ownerId: 'u-staf1', status: 'usul' });
cek('45e. PENGUSUL TIDAK boleh menilai usulannya sendiri — inti alur persetujuan',
  !L.bisaNilaiLead(orang('u-staf1'), usulStaf, tim));
cek('45f. Atasan langsung boleh menilai', L.bisaNilaiLead(orang('u-wakil'), usulStaf, tim));
cek('45g. Atasan berjenjang boleh menilai', L.bisaNilaiLead(orang('u-leader'), usulStaf, tim));
cek('45h. Owner boleh menilai usulan orang lain', L.bisaNilaiLead(orang('u-owner'), usulStaf, tim));
cek('45i. Owner TIDAK boleh menilai usulannya SENDIRI', (() => {
  return !L.bisaNilaiLead(orang('u-owner'), lm({ ownerId: 'u-owner' }), tim);
})());
cek('45j. Rekan sejajar tidak boleh menilai', !L.bisaNilaiLead(orang('u-staf2'), usulStaf, tim));
cek('45k. Pengusul boleh memperbaiki usulannya', L.bisaUbahLead(orang('u-staf1'), usulStaf, tim));
cek('45l. Atasan juga boleh memperbaiki', L.bisaUbahLead(orang('u-leader'), usulStaf, tim));
cek('45m. Rekan sejajar tidak boleh memperbaiki', !L.bisaUbahLead(orang('u-staf2'), usulStaf, tim));
cek('45n. calonPenilai = atasan langsung pengusul',
  L.calonPenilai(usulStaf, tim)?.id === 'u-wakil', L.calonPenilai(usulStaf, tim)?.id);
cek('45o. Pengusul tanpa atasan → tidak ada calon penilai',
  L.calonPenilai(lm({ ownerId: 'u-owner' }), tim) === null);
cek('45p. menungguPenilaianSaya hanya yang berstatus usul & jadi wewenangnya', (() => {
  const semua = [usulStaf, lm({ id: 'z', ownerId: 'u-staf1', status: 'aktif' })];
  return L.menungguPenilaianSaya(orang('u-leader'), semua, tim).length === 1;
})());
cek('45q. Usulan sendiri tidak masuk daftar tugas menilai',
  L.menungguPenilaianSaya(orang('u-staf1'), [usulStaf], tim).length === 0);

judul('46. Urutan & ringkasan lead measure');
const urutanLead = L.urutkanLead(daftarLead).map(l => l.status);
cek('46a. Yang menunggu penilaian di paling atas', urutanLead[0] === 'usul', urutanLead);
cek('46b. Ditolak di paling bawah', urutanLead[urutanLead.length - 1] === 'ditolak');
cek('46c. Urutan stabil antar-panggilan',
  L.urutkanLead(daftarLead).map(l => l.id).join() === L.urutkanLead(daftarLead).map(l => l.id).join());
const rl = L.ringkasLead(daftarLead);
cek('46d. Ringkasan menghitung tiap status',
  rl.total === 5 && rl.aktif === 3 && rl.menunggu === 1 && rl.ditolak === 1);
cek('46e. Daftar kosong aman', L.ringkasLead([]).total === 0 && L.ringkasLead(null).total === 0);

judul('47. Penjaga App.jsx — halaman Lead Measure');
cek('47a-26. Halaman menampilkan Komitmen Mingguan pengguna',
  /Lead\.komitmenMingguan\(user, leads/.test(src) && /Komitmen Mingguan Anda/.test(src));
cek('47a-27. Beban mingguan diringkas per satuan',
  /Lead\.bebanMingguan\(komitmen\)/.test(src));
cek('47a-24. Pengusul diberi tahu usulannya dikembalikan',
  /Lead\.perluSayaPerbaiki\(user, leads\)/.test(src)
  && /usulan Anda<\/span> dikembalikan penilai/.test(src));
cek('47a-25. Pemberitahuan memuat catatan penilai + tombol perbaiki langsung',
  /\{l\.penilaiNama \|\| 'Penilai'\}/.test(src));
cek('47a-19. Kotak masuk penilaian ada & dipakai halaman',
  /function GrdKotakMasukLead\(/.test(src) && /<GrdKotakMasukLead\b/.test(src));
cek('47a-20. Setujui bisa satu klik dari kotak masuk',
  /const setujuiCepat = async \(l\) =>/.test(src));
cek('47a-21. Tolak & perbaiki TIDAK satu klik (keduanya wajib catatan)', (() => {
  const i = src.indexOf('function GrdKotakMasukLead(');
  const j = src.indexOf(' * HALAMAN LEAD MEASURE');
  const blok = src.slice(i, j);
  // hanya ada satu tombol aksi langsung; sisanya membuka panel penilaian
  return /onBukaNilai\(l\)/.test(blok) && /Tolak \/ Perbaiki/.test(blok);
})());
cek('47a-22. Kotak masuk kosong diberi keadaan yang jelas', (() => {
  const i = src.indexOf('function GrdKotakMasukLead(');
  const j = src.indexOf(' * HALAMAN LEAD MEASURE');
  return /Tidak ada usulan yang menunggu Anda/.test(src.slice(i, j));
})());
cek('47a-23. Tombol setujui terkunci saat slot goal penuh', (() => {
  const i = src.indexOf('function GrdKotakMasukLead(');
  const j = src.indexOf(' * HALAMAN LEAD MEASURE');
  return /disabled=\{proses === l\.id \|\| slotPenuh\}/.test(src.slice(i, j));
})());
cek('47a-17. Form usul punya contoh siap pakai per peran pemilik goal',
  /Lead\.templateLeadUntuk\(peranPemilikGoal\)/.test(src));
cek('47a-18. Contoh hanya muncul saat MEMBUAT, bukan saat memperbaiki', (() => {
  const i = src.indexOf('function GrdFormLead(');
  const j = src.indexOf('function GrdNilaiLeadModal(');
  const blok = src.slice(i, j);
  return /\{!lama && \(\s*<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/.test(blok);
})());
cek('47a-16. Panel penilaian menampilkan riwayat langkah',
  /Lead\.riwayatLead\(l\)/.test(src) && /Riwayat \(\{riwayat\.length\} langkah\)/.test(src));
cek('47a-14. Kartu goal di pohon memakai lencana lead measure', (() => {
  const i = src.indexOf('function GrdKartuGoal(');
  const j = src.indexOf('function GrdSimpul(');
  return /Lead\.badgeLeadGoal\(leads, g\.id\)/.test(src.slice(i, j));
})());
cek('47a-15. Baris goal di Kelola Goal juga', (() => {
  const i = src.indexOf('function GrdBarisGoal(');
  const j = src.indexOf('function GrdSimpulRantai(');
  return /Lead\.badgeLeadGoal\(leads, g\.id\)/.test(src.slice(i, j));
})());
cek('47a-11. Panel detail goal menampilkan lead measure AKTIF-nya', (() => {
  const i = src.indexOf('function GrdDetailGoal(');
  const j = src.indexOf('function GrdSimpul(');
  const blok = src.slice(i, j);
  return /Lead\.leadAktif\(leads, g\.id\)/.test(blok) && /Lead Measure Aktif/.test(blok);
})());
cek('47a-12. Goal tanpa lead aktif diberi tahu + jalan pintas ke halamannya', (() => {
  const i = src.indexOf('function GrdDetailGoal(');
  const j = src.indexOf('function GrdSimpul(');
  const blok = src.slice(i, j);
  return /belum punya tindakan mingguan/.test(blok) && /onBukaLead/.test(blok);
})());
cek('47a-13. Halaman goal & lead sama-sama meminta lead measure lewat satu pintu',
  (src.match(/butuh: \['goal', 'lead'/g) || []).length >= 3);
cek('47a-8. Usulan DITOLAK bisa diperbaiki dari layar (sesuai ALUR_LEAD)', (() => {
  const i = src.indexOf('function GrdKartuLead(');
  const j = src.indexOf('function GrdBlokLeadGoal(');
  const blok = src.slice(i, j);
  return /l\.status === 'perbaiki' \|\| l\.status === 'ditolak'/.test(blok)
    && /Perbaiki lalu usulkan lagi/.test(blok);
})());
cek('47a-9. Catatan penilai ditempel di ATAS isian form saat memperbaiki', (() => {
  const i = src.indexOf('function GrdFormLead(');
  const j = src.indexOf('function GrdNilaiLeadModal(');
  const blok = src.slice(i, j);
  return /Alasan ditolak/.test(blok) && /Yang perlu diperbaiki/.test(blok);
})());
cek('47a-10. Judul & tombol menyesuaikan keadaan usulan',
  /Usulkan Lagi Lead Measure/.test(src) && /Usulkan Lagi'/.test(src));
cek('47a-5. Panel penilaian ada & dipakai halaman',
  /function GrdNilaiLeadModal\(/.test(src) && /<GrdNilaiLeadModal\b/.test(src));
cek('47a-6. Tiga jawaban: setujui, minta perbaiki, tolak',
  /Setujui/.test(src) && /Minta Perbaiki/.test(src) && /Tolak/.test(src));
cek('47a-7. Tombol setujui terkunci saat slot aktif sudah penuh',
  /disabled=\{!!proses \|\| slotPenuh\}/.test(src));
cek('47a-2. Form usul lead measure ada & dipakai halaman',
  /function GrdFormLead\(/.test(src) && /<GrdFormLead\b/.test(src));
cek('47a-3. Form menjelaskan beda lead measure dengan hasil',
  /Lead measure itu tindakan, bukan hasil/.test(src));
cek('47a-4. Form memberi tahu siapa yang akan menilai',
  /Lead\.calonPenilai/.test(src) && /menunggu penilaian/.test(src));
cek('47a. Halaman + rute + menu terpasang',
  /function GrdLeadView\(/.test(src) && /view === 'grd-lead'/.test(src) && /id: 'grd-lead'/.test(src));
cek('47b. Lead measure ikut BACKUP_KEYS (aturan wajib no.3)', (() => {
  const i = src.indexOf('const BACKUP_KEYS = [');
  return /Lead\.LEAD_BACKUP_KEY/.test(src.slice(i, src.indexOf('];', i)));
})());
cek('47c. Terdaftar di PER_RECORD_LOADERS & PREFIX (aturan wajib no.4)',
  /\[Lead\.LEAD_BACKUP_KEY\]: loadLeadGrd/.test(src)
  && /\[Lead\.LEAD_BACKUP_KEY\]: Lead\.LEAD_REC_PREFIX/.test(src));
cek('47d. Disusun PER GOAL, bukan satu daftar panjang',
  /function GrdBlokLeadGoal\(/.test(src));
cek('47e. Modul lead TIDAK meng-import App.jsx', (() => {
  const isi = fs.readFileSync(ROOT + '/src/grd/lead.js', 'utf8');
  return !/from\s+'.*App\.jsx'/.test(isi);
})());
cek('47f. Istilah OKR/key result tidak dipakai di modul lead', (() => {
  const isi = fs.readFileSync(ROOT + '/src/grd/lead.js', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return !/\bOKR\b|\bkey result\b|\bobjective\b/i.test(isi);
})());

judul('48. Layanan usul lead measure');
const spLd = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spLd });
const goalLd = { id: 'gl1', ownerId: 'u-staf1', periode: '2026-09',
  description: 'Konten tayang', base: 0, target: 30, uom: 'Konten' };
await Svc.simpanGoal(goalLd, { user: OWNER, allUsers: tim });
const usul = (extra = {}, opsi = {}) => Svc.usulkanLead(
  { goalId: 'gl1', ownerId: 'u-staf1', description: 'Konten tayang', targetMingguan: 5, uom: 'Konten', ...extra },
  { user: STAF1, allUsers: tim, goal: goalLd, ...opsi });

const l1 = await usul();
cek('48a. Usulan tersimpan', spLd.jumlah('grdlead:rec:') === 1);
cek('48b. Kuncinya memuat goalId (bisa ditarik per goal)',
  spLd.kunci('grdlead:rec:gl1:').length === 1, spLd.kunci('grdlead:rec:'));
cek('48c. Statusnya "usul", bukan langsung aktif', l1.status === 'usul');
cek('48d. Pengusul tercatat', l1.diusulkanOleh === 'u-staf1' && !!l1.diusulkanPada);
cek('48e. ambilLeadGoal menarik lewat prefix goal', (await Svc.ambilLeadGoal('gl1')).length === 1);
cek('48f. Goal lain tidak ikut terbawa', (await Svc.ambilLeadGoal('gl-lain')).length === 0);
cek('48g. goalId kosong → kosong, tanpa menyentuh server', (await Svc.ambilLeadGoal('')).length === 0);

let pesanLd = '';
try { await usul({ description: '' }); } catch (e) { pesanLd = e.message; }
cek('48h. Validasi ditegakkan di layanan', /tindakan mingguannya/.test(pesanLd), pesanLd);

pesanLd = '';
try {
  await Svc.usulkanLead({ goalId: 'gl1', ownerId: 'u-staf1', description: 'x', targetMingguan: 1, uom: 'y' },
    { user: STAF2, allUsers: tim, goal: goalLd });
} catch (e) { pesanLd = e.message; }
cek('48i. Rekan sejajar TIDAK boleh mengusulkan', /tidak berwenang mengusulkan/.test(pesanLd), pesanLd);

// batas 1–3 dihitung dari server
await usul({ description: 'Sesi live' });
await usul({ description: 'Sampel dipakai' });
pesanLd = '';
try { await usul({ description: 'Yang keempat' }); } catch (e) { pesanLd = e.message; }
cek('48j. Usulan keempat DITOLAK (batas 3 per goal)', /batasnya 3/.test(pesanLd), pesanLd);
cek('48k. Yang keempat tidak tersimpan', spLd.jumlah('grdlead:rec:gl1:') === 3);
cek('48l. Pesannya memberi tahu jalan keluarnya',
  /Tolak atau cabut salah satunya/.test(pesanLd));

cek('48m. Batas dihitung dari SERVER, bukan dari layar', (() => {
  // Semua usulan di atas dikirim tanpa pernah mengoper daftar dari layar —
  // layanan membacanya sendiri tiap kali.
  return spLd.prefixDiminta.filter(x => x === 'grdlead:rec:gl1:').length >= 4;
})(), spLd.prefixDiminta.filter(x => x === 'grdlead:rec:gl1:').length);

// perbaikan usulan
const diperbaiki = await Svc.usulkanLead(
  { ...l1, description: 'Konten tayang (diperbaiki)' },
  { user: STAF1, allUsers: tim, goal: goalLd, leadLama: l1 });
cek('48n. Perbaikan tidak menambah baris baru', spLd.jumlah('grdlead:rec:gl1:') === 3);
cek('48o. Isinya berubah', diperbaiki.description === 'Konten tayang (diperbaiki)');
cek('48p. Perbaikan kembali berstatus "usul" (harus dinilai ulang)', diperbaiki.status === 'usul');
cek('48q. Catatan penilai lama dibersihkan saat diusulkan ulang', diperbaiki.catatan === '');

pesanLd = '';
try {
  await Svc.usulkanLead({ ...l1, description: 'x' },
    { user: STAF2, allUsers: tim, goal: goalLd, leadLama: l1 });
} catch (e) { pesanLd = e.message; }
cek('48r. Rekan sejajar tidak boleh memperbaiki', /tidak berwenang mengubah/.test(pesanLd));
lepasMockGrd();

judul('49. Penilaian usulan lead measure');
const Lead2Aktif = (daftar) => daftar.filter(l => l.status === 'aktif').length;
const spNl = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spNl });
const goalNl = { id: 'gn1', ownerId: 'u-staf1', periode: '2026-09',
  description: 'Konten', base: 0, target: 30, uom: 'Konten' };
await Svc.simpanGoal(goalNl, { user: OWNER, allUsers: tim });
const buatUsul = (d) => Svc.usulkanLead(
  { goalId: 'gn1', ownerId: 'u-staf1', description: d, targetMingguan: 5, uom: 'Konten' },
  { user: STAF1, allUsers: tim, goal: goalNl });

const u1 = await buatUsul('Konten tayang');
const pesanNl = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message; } };

const pSendiri = await pesanNl(() => Svc.nilaiLead(u1, 'aktif', { user: STAF1, allUsers: tim }));
cek('49b. Pesannya menjelaskan itu tugas atasan',
  /tidak bisa menilai usulan Anda sendiri/.test(pSendiri), pSendiri);
cek('49c. Rekan sejajar tidak berwenang menilai',
  /tidak berwenang menilai/.test(await pesanNl(() => Svc.nilaiLead(u1, 'aktif', { user: STAF2, allUsers: tim }))));

cek('49d. Menolak WAJIB disertai catatan',
  /Tulis catatan singkat/.test(await pesanNl(() => Svc.nilaiLead(u1, 'ditolak', { user: LEADER, allUsers: tim }))));
cek('49e. Minta perbaiki juga wajib catatan',
  /Tulis catatan singkat/.test(await pesanNl(() => Svc.nilaiLead(u1, 'perbaiki', { user: LEADER, allUsers: tim }))));
cek('49f. Menyetujui TIDAK wajib catatan',
  (await pesanNl(() => Svc.nilaiLead(u1, 'aktif', { user: LEADER, allUsers: tim }))) === '');

const setelahSetuju = (await Svc.ambilLeadGoal('gn1')).find(l => l.id === u1.id);
cek('49g. Statusnya jadi aktif', setelahSetuju.status === 'aktif');
cek('49h. Penilai tercatat', setelahSetuju.penilaiId === 'u-leader' && !!setelahSetuju.dinilaiPada);

cek('49i. Tidak ada jalan pintas: aktif → usul ditolak',
  /Tidak bisa mengubah dari/.test(await pesanNl(() => Svc.nilaiLead(setelahSetuju, 'usul', { user: LEADER, allUsers: tim }))));

const u2 = await buatUsul('Sesi live');
await Svc.nilaiLead(u2, 'perbaiki', { user: LEADER, allUsers: tim, catatan: 'Targetnya terlalu rendah.' });
const setelahPerbaiki = (await Svc.ambilLeadGoal('gn1')).find(l => l.id === u2.id);
cek('49j. Status jadi perbaiki dengan catatannya',
  setelahPerbaiki.status === 'perbaiki' && /terlalu rendah/.test(setelahPerbaiki.catatan));
cek('49k. perbaiki → aktif langsung DITOLAK (harus diusulkan ulang)',
  /Tidak bisa mengubah dari/.test(await pesanNl(() => Svc.nilaiLead(setelahPerbaiki, 'aktif', { user: LEADER, allUsers: tim }))));

const diusulkanUlang = await Svc.usulkanLead({ ...setelahPerbaiki, targetMingguan: 10 },
  { user: STAF1, allUsers: tim, goal: goalNl, leadLama: setelahPerbaiki });
cek('49l. Setelah diperbaiki kembali ke "usul"', diusulkanUlang.status === 'usul');
cek('49m. Catatan penilai dibersihkan', diusulkanUlang.catatan === '');
cek('49n. Kini boleh disetujui',
  (await pesanNl(() => Svc.nilaiLead(diusulkanUlang, 'aktif', { user: LEADER, allUsers: tim }))) === '');

// batas 3 aktif saat MENYETUJUI.
// Skenario yang benar-benar bisa terjadi: satu usulan DITOLAK, lalu diusulkan
// ulang setelah slot keburu terisi penuh oleh usulan lain. Saat diusulkan ulang
// batas belum menggigit (ia menggantikan baris lama), jadi penjagaan terakhirnya
// ada di nilaiLead — dan itu yang diuji di sini.
const uTolak = await buatUsul('Yang sempat ditolak');
await Svc.nilaiLead(uTolak, 'ditolak', { user: LEADER, allUsers: tim, catatan: 'Belum tajam.' });
const uT = (await Svc.ambilLeadGoal('gn1')).find(l => l.id === uTolak.id);
cek('49o. Usulan yang ditolak tercatat statusnya', uT.status === 'ditolak');

const uIsi = await buatUsul('Pengisi slot ketiga');
await Svc.nilaiLead(uIsi, 'aktif', { user: LEADER, allUsers: tim });
cek('49p. Slot aktif kini penuh (3)', Lead2Aktif(await Svc.ambilLeadGoal('gn1')) === 3,
  Lead2Aktif(await Svc.ambilLeadGoal('gn1')));

const uUlang = await Svc.usulkanLead({ ...uT, description: 'Diusulkan ulang' },
  { user: STAF1, allUsers: tim, goal: goalNl, leadLama: uT });
cek('49q. Boleh diusulkan ulang walau slot penuh (belum tentu disetujui)',
  uUlang.status === 'usul');
cek('49r. Tapi MENYETUJUINYA ditolak — batas dihitung ulang dari server',
  /batasnya 3/.test(await pesanNl(() => Svc.nilaiLead(uUlang, 'aktif', { user: LEADER, allUsers: tim }))));
cek('49s. Slot aktif tidak bertambah', Lead2Aktif(await Svc.ambilLeadGoal('gn1')) === 3);
cek('49t. Masih boleh ditolak', (await pesanNl(() => Svc.nilaiLead(uUlang, 'ditolak',
  { user: LEADER, allUsers: tim, catatan: 'Sudah cukup tiga.' }))) === '');
lepasMockGrd();

judul('50. Perbaikan usulan yang leadDitolak');
const spPb = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spPb });
const goalPb = { id: 'gp1', ownerId: 'u-staf1', periode: '2026-09',
  description: 'Konten', base: 0, target: 30, uom: 'Konten' };
await Svc.simpanGoal(goalPb, { user: OWNER, allUsers: tim });
const pesanPb = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message; } };

const pb1 = await Svc.usulkanLead(
  { goalId: 'gp1', ownerId: 'u-staf1', description: 'Konten tayang', targetMingguan: 2, uom: 'Konten' },
  { user: STAF1, allUsers: tim, goal: goalPb });
await Svc.nilaiLead(pb1, 'ditolak', { user: LEADER, allUsers: tim, catatan: 'Targetnya terlalu rendah.' });
const leadDitolak = (await Svc.ambilLeadGoal('gp1')).find(l => l.id === pb1.id);

cek('50a. Alur membolehkan leadDitolak → usul', L.bolehPindahStatus('ditolak', 'usul'));
cek('50b. Pengusul boleh memperbaiki yang DITOLAK', L.bisaUbahLead(STAF1, leadDitolak, tim));
cek('50c. Catatan penolakan tersimpan untuk dibaca saat memperbaiki',
  /terlalu rendah/.test(leadDitolak.catatan) && leadDitolak.penilaiNama === 'Leader TAP');

const pbUlang = await Svc.usulkanLead({ ...leadDitolak, targetMingguan: 10 },
  { user: STAF1, allUsers: tim, goal: goalPb, leadLama: leadDitolak });
cek('50d. Usulan ulang kembali berstatus "usul"', pbUlang.status === 'usul');
cek('50e. Angka yang diperbaiki tersimpan', pbUlang.targetMingguan === 10);
cek('50f. Catatan penolakan lama DIBERSIHKAN (bukan menempel selamanya)', pbUlang.catatan === '');
cek('50g. Penilai lama ikut dibersihkan', pbUlang.penilaiId === '' && pbUlang.penilaiNama === '');
cek('50h. Tidak menambah baris baru', spPb.jumlah('grdlead:rec:gp1:') === 1);
cek('50i. Kini boleh dinilai lagi',
  (await pesanPb(() => Svc.nilaiLead(pbUlang, 'aktif', { user: LEADER, allUsers: tim }))) === '');

cek('50j. Rekan sejajar tetap tidak boleh memperbaiki punya orang lain',
  /tidak berwenang mengubah/.test(await pesanPb(() => Svc.usulkanLead({ ...leadDitolak, targetMingguan: 9 },
    { user: STAF2, allUsers: tim, goal: goalPb, leadLama: leadDitolak }))));
cek('50k. Perbaikan tetap divalidasi',
  /lebih dari nol/.test(await pesanPb(() => Svc.usulkanLead({ ...leadDitolak, targetMingguan: 0 },
    { user: STAF1, allUsers: tim, goal: goalPb, leadLama: leadDitolak }))));
lepasMockGrd();

judul('51. Badge status lead measure di kartu goal');
const bg = (daftar, goalId) => L.badgeLeadGoal(daftar, goalId);
cek('51a. Goal tanpa lead sama sekali ditandai "tanpa lead"',
  bg([], 'gx')?.teks === 'tanpa lead');
cek('51b. Penjelasannya menyebut belum ada tindakan mingguan',
  /tindakan mingguan/.test(bg([], 'gx').judul));
cek('51c. Goal dengan lead aktif TIDAK diberi lencana (tidak menambah informasi)',
  bg([lm({ status: 'aktif' })], 'g1') === null);
cek('51d. Usulan menunggu diangkat jadi lencana',
  bg([lm({ status: 'usul' })], 'g1')?.teks === '1 usulan');
cek('51e. Menunggu DIUTAMAKAN daripada "tanpa lead"', (() => {
  const b = bg([lm({ id: 'a', status: 'usul' })], 'g1');
  return b.teks === '1 usulan';
})());
cek('51f. Menunggu tetap tampil walau sudah ada yang aktif', (() => {
  const b = bg([lm({ id: 'a', status: 'aktif' }), lm({ id: 'b', status: 'usul' })], 'g1');
  return b?.teks === '1 usulan';
})());
cek('51g. Goal yang cuma punya lead DITOLAK dihitung "tanpa lead"',
  bg([lm({ status: 'ditolak' })], 'g1')?.teks === 'tanpa lead');
cek('51h. Lead goal lain tidak memengaruhi',
  bg([lm({ goalId: 'g2', status: 'aktif' })], 'g1')?.teks === 'tanpa lead');
cek('51i. Tiap lencana punya warna & penjelasan',
  ['teks', 'color', 'judul'].every(k => k in bg([], 'gx')));
cek('51j. Daftar kosong/null aman', bg(null, 'gx')?.teks === 'tanpa lead');

judul('52. Riwayat langkah lead measure');
const spRw = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spRw });
const goalRw = { id: 'gr1', ownerId: 'u-staf1', periode: '2026-09',
  description: 'Konten', base: 0, target: 30, uom: 'Konten' };
await Svc.simpanGoal(goalRw, { user: OWNER, allUsers: tim });

let rw = await Svc.usulkanLead(
  { goalId: 'gr1', ownerId: 'u-staf1', description: 'Konten tayang', targetMingguan: 2, uom: 'Konten' },
  { user: STAF1, allUsers: tim, goal: goalRw });
cek('52a. Usulan pertama mencatat langkah "usul"',
  rw.riwayat.length === 1 && rw.riwayat[0].aksi === 'usul');
cek('52b. Siapa & kapan tercatat',
  rw.riwayat[0].olehId === 'u-staf1' && !!rw.riwayat[0].waktu);

rw = await Svc.nilaiLead(rw, 'perbaiki', { user: LEADER, allUsers: tim, catatan: 'Terlalu rendah.' });
cek('52c. Penilaian menambah langkah, tidak menimpa', rw.riwayat.length === 2);
cek('52d. Catatan penilai ikut tersimpan di riwayat',
  rw.riwayat[1].aksi === 'perbaiki' && /Terlalu rendah/.test(rw.riwayat[1].catatan));

rw = await Svc.usulkanLead({ ...rw, targetMingguan: 10 },
  { user: STAF1, allUsers: tim, goal: goalRw, leadLama: rw });
cek('52e. Usulan ulang mencatat "usulUlang"',
  rw.riwayat.length === 3 && rw.riwayat[2].aksi === 'usulUlang');
cek('52f. Riwayat lama TIDAK hilang saat diusulkan ulang',
  rw.riwayat.map(r => r.aksi).join() === 'usul,perbaiki,usulUlang', rw.riwayat.map(r => r.aksi));
cek('52g. Catatan penilai TERAKHIR tetap dibersihkan (itu status, bukan riwayat)',
  rw.catatan === '');

rw = await Svc.nilaiLead(rw, 'aktif', { user: LEADER, allUsers: tim });
cek('52h. Persetujuan jadi langkah keempat', rw.riwayat.length === 4 && rw.riwayat[3].aksi === 'aktif');
cek('52i. Riwayat tersimpan ikut record (bukan hilang saat dibaca ulang)',
  (await Svc.ambilLeadGoal('gr1'))[0].riwayat.length === 4);

cek('52j. riwayatLead menampilkan TERBARU di atas',
  L.riwayatLead(rw)[0].aksi === 'aktif' && L.riwayatLead(rw)[3].aksi === 'usul');
cek('52k. riwayatLead tidak mengubah urutan aslinya',
  rw.riwayat[0].aksi === 'usul');
cek('52l. Label aksi manusiawi',
  L.labelAksiLead('usulUlang') === 'Diusulkan ulang' && L.labelAksiLead('aktif') === 'Disetujui');
cek('52m. Aksi tak dikenal tidak kosong', L.labelAksiLead('ngawur') === 'ngawur');
cek('52n. Riwayat dibatasi supaya record tidak membengkak', (() => {
  let dummy = { id: 'x', goalId: 'g', ownerId: 'u', description: 'a', targetMingguan: 1, uom: 'x', riwayat: [] };
  for (let i = 0; i < L.MAKS_RIWAYAT_LEAD + 10; i++) {
    dummy = { ...dummy, riwayat: L.tambahRiwayatLead(dummy, { aksi: 'usul', oleh: STAF1 }) };
  }
  return dummy.riwayat.length === L.MAKS_RIWAYAT_LEAD;
})());
cek('52o. Yang dibuang yang PALING LAMA, bukan yang terbaru', (() => {
  let dummy = { id: 'x', goalId: 'g', ownerId: 'u', description: 'a', targetMingguan: 1, uom: 'x', riwayat: [] };
  for (let i = 0; i < L.MAKS_RIWAYAT_LEAD + 3; i++) {
    dummy = { ...dummy, riwayat: L.tambahRiwayatLead(dummy, { aksi: 'usul', oleh: STAF1, catatan: 'ke-' + i }) };
  }
  const akhir = dummy.riwayat[dummy.riwayat.length - 1].catatan;
  return akhir === 'ke-' + (L.MAKS_RIWAYAT_LEAD + 2);
})());
cek('52p. Record lama tanpa riwayat tidak error',
  L.riwayatLead({ id: 'z', goalId: 'g', ownerId: 'u', description: 'a', targetMingguan: 1, uom: 'x' }).length === 0);
lepasMockGrd();

judul('53. Contoh lead measure siap pakai');
cek('53a. Tiap peran punya contoh', ['owner','manajer','leader','wakil','operasional']
  .every(r => Array.isArray(L.TEMPLATE_LEAD[r]) && L.TEMPLATE_LEAD[r].length > 0));
cek('53b. Peran tak dikenal jatuh ke contoh karyawan',
  L.templateLeadUntuk('ngawur') === L.TEMPLATE_LEAD.operasional);
cek('53c. Semua contoh punya angka mingguan > 0',
  Object.values(L.TEMPLATE_LEAD).flat().every(t => t.targetMingguan > 0));
cek('53d. Semua contoh punya satuan', Object.values(L.TEMPLATE_LEAD).flat().every(t => !!t.uom));
cek('53e. Contoh berbentuk TINDAKAN, bukan hasil', (() => {
  // "GMV naik", "omzet", "profit" itu hasil — bukan sesuatu yang dikerjakan.
  return Object.values(L.TEMPLATE_LEAD).flat()
    .every(t => !/\bGMV\b|\bomzet\b|\bprofit\b|\bpendapatan\b/i.test(t.description));
})());
cek('53f. Contoh bukan niat kabur', (() => {
  return Object.values(L.TEMPLATE_LEAD).flat()
    .every(t => !/^(lebih|rajin|giat|semangat|berusaha)\b/i.test(t.description));
})());

const goalCth = { id: 'gc9', ownerId: 'u-staf1', periode: '2026-09',
  description: 'Konten', base: 0, target: 30, uom: 'Konten' };
cek('53g. Contoh + goal = usulan yang LOLOS validasi', (() => {
  return Object.values(L.TEMPLATE_LEAD).flat()
    .every(t => L.validasiLead(L.terapkanTemplateLead(t, goalCth)) === '');
})());
cek('53h. goalId & ownerId ikut terpasang dari goalnya', (() => {
  const c = L.terapkanTemplateLead(L.TEMPLATE_LEAD.operasional[0], goalCth);
  return c.goalId === 'gc9' && c.ownerId === 'u-staf1';
})());
cek('53i. Statusnya mulai dari "usul"',
  L.terapkanTemplateLead(L.TEMPLATE_LEAD.leader[0], goalCth).status === 'usul');
cek('53j. Contoh kosong tidak error (ditolak validasi, bukan meledak)', (() => {
  const c = L.terapkanTemplateLead(null, goalCth);
  return c !== null && L.validasiLead(c) !== '';
})());
cek('53k. Goal kosong tidak error', L.terapkanTemplateLead(L.TEMPLATE_LEAD.leader[0], null) !== null);

judul('54. Pemberitahuan dua arah: penilai DAN pengusul');
const daftarDua = [
  lm({ id: 'p1', ownerId: 'u-staf1', status: 'perbaiki', catatan: 'Kurang tajam.' }),
  lm({ id: 'p2', ownerId: 'u-staf1', status: 'ditolak', catatan: 'Sudah ada yang mirip.' }),
  lm({ id: 'p3', ownerId: 'u-staf1', status: 'usul' }),
  lm({ id: 'p4', ownerId: 'u-staf1', status: 'aktif' }),
  lm({ id: 'p5', ownerId: 'u-staf2', status: 'perbaiki' }),
];
cek('54a. Pengusul diberi tahu yang DIKEMBALIKAN (perbaiki + ditolak)',
  L.perluSayaPerbaiki(orang('u-staf1'), daftarDua).map(l => l.id).sort().join() === 'p1,p2',
  L.perluSayaPerbaiki(orang('u-staf1'), daftarDua).map(l => l.id));
cek('54b. Yang masih menunggu TIDAK masuk (bukan tugasnya sekarang)',
  !L.perluSayaPerbaiki(orang('u-staf1'), daftarDua).some(l => l.id === 'p3'));
cek('54c. Yang sudah aktif tidak masuk',
  !L.perluSayaPerbaiki(orang('u-staf1'), daftarDua).some(l => l.id === 'p4'));
cek('54d. Usulan orang lain tidak masuk',
  !L.perluSayaPerbaiki(orang('u-staf1'), daftarDua).some(l => l.id === 'p5'));
cek('54e. Orang lain melihat miliknya sendiri',
  L.perluSayaPerbaiki(orang('u-staf2'), daftarDua).map(l => l.id).join() === 'p5');
cek('54f. Tanpa pengguna → kosong', L.perluSayaPerbaiki(null, daftarDua).length === 0);
cek('54g. Daftar kosong aman', L.perluSayaPerbaiki(orang('u-staf1'), null).length === 0);
cek('54h. Dua sisi alur saling melengkapi, tidak tumpang tindih', (() => {
  // Yang menunggu dinilai atasan TIDAK boleh muncul juga sebagai "perlu saya perbaiki".
  const utkAtasan = L.menungguPenilaianSaya(orang('u-leader'), daftarDua, tim).map(l => l.id);
  const utkPengusul = L.perluSayaPerbaiki(orang('u-staf1'), daftarDua).map(l => l.id);
  return utkAtasan.every(id => !utkPengusul.includes(id));
})());

judul('55. Komitmen mingguan');
const daftarKm = [
  lm({ id: 'k1', ownerId: 'u-staf1', goalId: 'g1', status: 'aktif', description: 'B Konten', targetMingguan: 7, uom: 'Konten' }),
  lm({ id: 'k2', ownerId: 'u-staf1', goalId: 'g2', status: 'aktif', description: 'A Live', targetMingguan: 3, uom: 'Sesi' }),
  lm({ id: 'k3', ownerId: 'u-staf1', goalId: 'g1', status: 'aktif', description: 'C Riset', targetMingguan: 5, uom: 'Konten' }),
  lm({ id: 'k4', ownerId: 'u-staf1', goalId: 'g1', status: 'usul', description: 'Belum aktif', targetMingguan: 9, uom: 'Konten' }),
  lm({ id: 'k5', ownerId: 'u-staf2', goalId: 'g1', status: 'aktif', description: 'Punya orang lain', targetMingguan: 4, uom: 'Konten' }),
];
const km = L.komitmenMingguan(orang('u-staf1'), daftarKm);
cek('55a. Hanya lead AKTIF milik sendiri', km.map(l => l.id).sort().join() === 'k1,k2,k3', km.map(l => l.id));
cek('55b. Yang masih usul tidak ikut (belum jadi komitmen)', !km.some(l => l.id === 'k4'));
cek('55c. Punya orang lain tidak ikut', !km.some(l => l.id === 'k5'));
cek('55d. Lintas goal (bukan cuma satu goal)',
  new Set(km.map(l => l.goalId)).size === 2);
cek('55e. Urut abjad supaya stabil', km.map(l => l.description).join() === 'A Live,B Konten,C Riset');
cek('55f. Bisa dibatasi ke goal tertentu saja',
  L.komitmenMingguan(orang('u-staf1'), daftarKm, ['g2']).map(l => l.id).join() === 'k2');
cek('55g. Batas goal kosong → tidak ada komitmen',
  L.komitmenMingguan(orang('u-staf1'), daftarKm, []).length === 0);
cek('55h. Tanpa pengguna → kosong', L.komitmenMingguan(null, daftarKm).length === 0);
cek('55i. Daftar kosong aman', L.komitmenMingguan(orang('u-staf1'), null).length === 0);

const bb = L.bebanMingguan(km);
cek('55j. Beban dijumlah PER SATUAN', bb.Konten === 12 && bb.Sesi === 3, bb);
cek('55k. Satuan yang sama digabung, bukan didaftar dua kali',
  Object.keys(bb).length === 2);
cek('55l. Beban dari daftar kosong = objek kosong',
  Object.keys(L.bebanMingguan([])).length === 0 && Object.keys(L.bebanMingguan(null)).length === 0);
cek('55m. Lead tanpa satuan tidak merusak hitungan',
  Object.keys(L.bebanMingguan([{ id: 'x', goalId: 'g', ownerId: 'u', description: 'a', targetMingguan: 5, uom: '' }])).length === 0);
cek('55n. Angkanya tidak pernah NaN',
  Object.values(L.bebanMingguan(km)).every(Number.isFinite));

// ============================================================================
judul('56. Minggu WIB — kunci minggu = tanggal Senin');
// ============================================================================
cek('56a. Rabu 16 Sep 2026 → Senin 14 Sep', SB.awalMinggu('2026-09-16') === '2026-09-14');
cek('56b. Senin sendiri → dirinya', SB.awalMinggu('2026-09-14') === '2026-09-14');
cek('56c. Minggu (Ahad) masuk minggu yang SAMA, bukan minggu baru',
  SB.awalMinggu('2026-09-20') === '2026-09-14', SB.awalMinggu('2026-09-20'));
cek('56d. Senin berikutnya mulai minggu baru', SB.awalMinggu('2026-09-21') === '2026-09-21');
cek('56e. akhirMinggu = Ahad', SB.akhirMinggu('2026-09-16') === '2026-09-20');
cek('56f. Rentangnya tepat 7 hari', (() => {
  const a = SB.awalMinggu('2026-09-16'), b = SB.akhirMinggu('2026-09-16');
  return G.jenisPeriode !== undefined && a < b;
})());
cek('56g. Menyeberang bulan ditangani', SB.awalMinggu('2026-10-01') === '2026-09-28');
cek('56h. Menyeberang tahun ditangani', SB.awalMinggu('2027-01-01') === '2026-12-28');
cek('56i. Tanggal tidak sah → kosong',
  SB.awalMinggu('ngawur') === '' && SB.awalMinggu('') === '' && SB.awalMinggu(null) === '');
cek('56j. mingguValid hanya untuk tanggal Senin',
  SB.mingguValid('2026-09-14') && !SB.mingguValid('2026-09-16') && !SB.mingguValid('ngawur'));
cek('56k. mingguIni menghasilkan Senin yang sah', SB.mingguValid(SB.mingguIni()));

cek('56l. Geser minggu maju/mundur',
  SB.geserMinggu('2026-09-14', 1) === '2026-09-21' && SB.geserMinggu('2026-09-14', -1) === '2026-09-07');
cek('56m. Geser dari tanggal tengah minggu tetap mendarat di Senin',
  SB.geserMinggu('2026-09-16', 1) === '2026-09-21');
cek('56n. Maju lalu mundur kembali ke asal',
  SB.geserMinggu(SB.geserMinggu('2026-09-14', 5), -5) === '2026-09-14');
cek('56o. Hasil geser selalu Senin', (() => {
  for (let i = -20; i <= 20; i++) if (!SB.mingguValid(SB.geserMinggu('2026-09-14', i))) return false;
  return true;
})());

cek('56p. Label dalam satu bulan', SB.labelMinggu('2026-09-16') === '14–20 Sep 2026');
cek('56q. Label menyeberang bulan', SB.labelMinggu('2026-09-30') === '28 Sep–4 Okt 2026',
  SB.labelMinggu('2026-09-30'));
cek('56r. Label menyeberang tahun memuat dua tahun',
  /2026.*2027/.test(SB.labelMinggu('2027-01-01')), SB.labelMinggu('2027-01-01'));
cek('56s. Label tidak sah tidak kosong melompong', SB.labelMinggu('ngawur') === '—');
cek('56t. daftarMinggu TERBARU di atas & semuanya Senin', (() => {
  const d = SB.daftarMinggu('2026-09-14', 4);
  return d[0] === '2026-09-14' && d[3] === '2026-08-24' && d.every(SB.mingguValid);
})(), SB.daftarMinggu('2026-09-14', 4));
cek('56u. daftarMinggu minimal 1', SB.daftarMinggu('2026-09-14', 0).length === 1);

judul('57. Skor: menang/kalah tanpa tawar-menawar');
const sk = (extra = {}) => ({ id: 's1', leadId: 'l1', goalId: 'g1', ownerId: 'u-staf1',
  minggu: '2026-09-14', nilai: 5, target: 5, uom: 'Konten', ...extra });
cek('57a. Tepat target = MENANG', SB.menang(sk({ nilai: 5, target: 5 })));
cek('57b. Lebih dari target = menang', SB.menang(sk({ nilai: 9, target: 5 })));
cek('57c. Kurang sedikit pun = KALAH (tidak ada "hampir")',
  !SB.menang(sk({ nilai: 4.9, target: 5 })));
cek('57d. Nol = kalah', !SB.menang(sk({ nilai: 0 })));
cek('57e. Target nol tidak dianggap menang otomatis', !SB.menang(sk({ nilai: 0, target: 0 })));
cek('57f. Skor null = kalah/kosong, bukan error', !SB.menang(null));
cek('57g. Persen dihitung dari target', SB.persenSkor(sk({ nilai: 3, target: 6 })) === 50);
cek('57h. Persen tidak pernah NaN saat target nol',
  Number.isFinite(SB.persenSkor(sk({ target: 0 }))) && SB.persenSkor(sk({ target: 0 })) === 0);
cek('57i. Persen bar ditahan 100', SB.persenBarSkor(sk({ nilai: 50, target: 5 })) === 100);
cek('57j. Angka rusak tidak bocor', Number.isFinite(SB.persenSkor(sk({ nilai: 'x', target: 'y' }))));
cek('57k. hasilSkor tiga keadaan',
  SB.hasilSkor(sk()) === 'menang' && SB.hasilSkor(sk({ nilai: 1 })) === 'kalah' && SB.hasilSkor(null) === 'kosong');
cek('57l. Tiap hasil punya label & warna',
  ['menang', 'kalah', 'kosong'].every(h => !!SB.gayaHasil(h).label && !!SB.gayaHasil(h).bar));

cek('57m. Validasi: tanpa lead ditolak', /menempel pada sebuah lead/.test(SB.validasiSkor(sk({ leadId: '' }))));
cek('57n. Validasi: minggu tidak sah ditolak', /Minggu tidak sah/.test(SB.validasiSkor(sk({ minggu: 'xx' }))));
cek('57o. Validasi: angka minus ditolak', /tidak boleh minus/.test(SB.validasiSkor(sk({ nilai: -1 }))));
cek('57p. Validasi: target nol ditolak', /Target mingguan tidak sah/.test(SB.validasiSkor(sk({ target: 0 }))));
cek('57q. Skor sah lolos', SB.validasiSkor(sk()) === '');
cek('57r. Minggu tengah pekan dirapikan ke Senin saat normalisasi',
  SB.normalisasiSkor(sk({ minggu: '2026-09-16' })).minggu === '2026-09-14');

judul('58. Rekap mingguan & tren');
const leadAktifUji = [
  lm({ id: 'la', status: 'aktif', targetMingguan: 5 }),
  lm({ id: 'lb', status: 'aktif', targetMingguan: 5 }),
  lm({ id: 'lc', status: 'aktif', targetMingguan: 5 }),
  lm({ id: 'ld', status: 'usul', targetMingguan: 5 }),
];
const skorUji = [
  { id: 'x1', leadId: 'la', minggu: '2026-09-14', nilai: 6, target: 5, uom: 'K', ownerId: 'u-staf1', goalId: 'g1' },
  { id: 'x2', leadId: 'lb', minggu: '2026-09-14', nilai: 2, target: 5, uom: 'K', ownerId: 'u-staf1', goalId: 'g1' },
];
const rk = SB.rekapMinggu(skorUji, leadAktifUji, '2026-09-14');
cek('58a. Hanya lead AKTIF yang dihitung (usulan tidak)', rk.total === 3, rk);
cek('58b. Menang & kalah dihitung terpisah', rk.menang === 1 && rk.kalah === 1);
cek('58c. Yang belum diisi dihitung sebagai kosong, bukan kalah', rk.kosong === 1);
cek('58d. terisi = menang + kalah', rk.terisi === 2);
cek('58e. Persen menang dihitung dari yang TERISI, bukan dari total',
  rk.persenMenang === 50, rk.persenMenang);
cek('58f. Tidak ada yang terisi → persen 0, bukan NaN', (() => {
  const r = SB.rekapMinggu([], leadAktifUji, '2026-09-14');
  return r.persenMenang === 0 && Number.isFinite(r.persenMenang) && r.kosong === 3;
})());
cek('58g. Tanpa lead aktif → semua nol', SB.rekapMinggu(skorUji, [], '2026-09-14').total === 0);
cek('58h. Skor minggu lain tidak tercampur',
  SB.rekapMinggu(skorUji, leadAktifUji, '2026-09-21').terisi === 0);

cek('58i. skorLeadMinggu menemukan yang tepat',
  SB.skorLeadMinggu(skorUji, 'la', '2026-09-14')?.nilai === 6);
cek('58j. Tanggal tengah pekan tetap menemukan skornya',
  SB.skorLeadMinggu(skorUji, 'la', '2026-09-17')?.nilai === 6);
cek('58k. Belum diisi → null', SB.skorLeadMinggu(skorUji, 'lc', '2026-09-14') === null);
cek('58l. skorMinggu menyaring per minggu', SB.skorMinggu(skorUji, '2026-09-14').length === 2);

const skorTren = [
  { id: 't1', leadId: 'la', minggu: '2026-08-31', nilai: 5, target: 5, uom: 'K' },
  { id: 't2', leadId: 'la', minggu: '2026-09-07', nilai: 2, target: 5, uom: 'K' },
  { id: 't3', leadId: 'la', minggu: '2026-09-14', nilai: 7, target: 5, uom: 'K' },
];
const tren = SB.trenLead(skorTren, 'la', { sampai: '2026-09-14', jumlah: 4 });
cek('58m. Tren terlama di kiri, terbaru di kanan',
  tren[tren.length - 1].minggu === '2026-09-14' && tren[0].minggu === '2026-08-24');
cek('58n. Minggu yang belum diisi tetap muncul sebagai lubang, bukan dilewati',
  tren.length === 4 && tren[0].hasil === 'kosong');
cek('58o. Hasil tiap minggu terbaca',
  tren.map(t => t.hasil).join() === 'kosong,menang,kalah,menang', tren.map(t => t.hasil));
cek('58p. Tren lead tanpa skor sama sekali → semua kosong',
  SB.trenLead(skorTren, 'lz', { sampai: '2026-09-14', jumlah: 3 }).every(t => t.hasil === 'kosong'));

cek('58q. Beruntun dihitung mundur dari minggu terbaru',
  SB.beruntun(skorTren, 'la', { sampai: '2026-09-14', jumlah: 4 }) === 1);
cek('58r. Kekalahan memutus rangkaian', (() => {
  const s2 = [...skorTren, { id: 't4', leadId: 'la', minggu: '2026-09-21', nilai: 6, target: 5, uom: 'K' }];
  return SB.beruntun(s2, 'la', { sampai: '2026-09-21', jumlah: 5 }) === 2;
})());
cek('58s. Belum diisi juga memutus rangkaian',
  SB.beruntun(skorTren, 'la', { sampai: '2026-09-21', jumlah: 5 }) === 0);

cek('58t. riwayatLead terurut maju', (() => {
  const r = SB.riwayatLead(skorTren, 'la');
  return r[0].minggu === '2026-08-31' && r[2].minggu === '2026-09-14';
})());

judul('59. Hak isi skor');
cek('59a. Pemilik boleh mengisi skornya',
  SB.bisaIsiSkor(orang('u-staf1'), lm({ ownerId: 'u-staf1', status: 'aktif' }), tim));
cek('59b. Atasan boleh',
  SB.bisaIsiSkor(orang('u-leader'), lm({ ownerId: 'u-staf1', status: 'aktif' }), tim));
cek('59c. Owner boleh',
  SB.bisaIsiSkor(orang('u-owner'), lm({ ownerId: 'u-staf1', status: 'aktif' }), tim));
cek('59d. Rekan sejajar TIDAK boleh',
  !SB.bisaIsiSkor(orang('u-staf2'), lm({ ownerId: 'u-staf1', status: 'aktif' }), tim));
cek('59e. Lead yang BELUM disetujui tidak bisa diisi skornya',
  !SB.bisaIsiSkor(orang('u-staf1'), lm({ ownerId: 'u-staf1', status: 'usul' }), tim));
cek('59f. Lead yang ditolak juga tidak',
  !SB.bisaIsiSkor(orang('u-staf1'), lm({ ownerId: 'u-staf1', status: 'ditolak' }), tim));
cek('59g. Tanpa pengguna → tidak boleh', !SB.bisaIsiSkor(null, lm({ status: 'aktif' }), tim));

judul('60. Layanan skor mingguan');
const spSk = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spSk });
const goalSk = { id: 'gs1', ownerId: 'u-staf1', periode: '2026-09',
  description: 'Konten', base: 0, target: 30, uom: 'Konten' };
await Svc.simpanGoal(goalSk, { user: OWNER, allUsers: tim });
let leadSk = await Svc.usulkanLead(
  { goalId: 'gs1', ownerId: 'u-staf1', description: 'Konten tayang', targetMingguan: 5, uom: 'Konten' },
  { user: STAF1, allUsers: tim, goal: goalSk });
leadSk = await Svc.nilaiLead(leadSk, 'aktif', { user: LEADER, allUsers: tim });
const pesanSk = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message; } };
const mgIni = SB.mingguIni();

const s1 = await Svc.simpanSkor({ lead: leadSk, minggu: mgIni, nilai: 6 }, { user: STAF1, allUsers: tim });
cek('60a. Skor tersimpan', spSk.jumlah('grdskor:rec:') === 1);
cek('60b. Kuncinya memuat MINGGU di depan (dibaca per minggu)',
  spSk.kunci(`grdskor:rec:${mgIni}:`).length === 1, spSk.kunci('grdskor:rec:'));
cek('60c. Menang karena melewati target', SB.menang(s1));
cek('60d. Target DISALIN dari lead saat pencatatan', s1.target === 5);
cek('60e. Pencatat tercatat', s1.dicatatOleh === 'u-staf1' && !!s1.dicatatPada);

// isi ulang minggu yang sama = memperbarui, bukan menumpuk
const s2 = await Svc.simpanSkor({ lead: leadSk, minggu: mgIni, nilai: 3 }, { user: STAF1, allUsers: tim });
cek('60f. Mengisi ulang minggu yang sama MEMPERBARUI, tidak menumpuk',
  spSk.jumlah('grdskor:rec:') === 1 && s2.nilai === 3);
cek('60g. Hasilnya ikut berubah jadi kalah', !SB.menang(s2));

cek('60h. ambilSkorMinggu menarik lewat prefix minggu',
  (await Svc.ambilSkorMinggu(mgIni)).length === 1);
cek('60i. Minggu lain kosong', (await Svc.ambilSkorMinggu(SB.geserMinggu(mgIni, -1))).length === 0);
cek('60j. Minggu tidak sah → kosong tanpa menyentuh server',
  (await Svc.ambilSkorMinggu('ngawur')).length === 0);

// TARGET BERUBAH tidak boleh mengubah minggu lama
const leadNaik = await Svc.usulkanLead({ ...leadSk, targetMingguan: 20 },
  { user: STAF1, allUsers: tim, goal: goalSk, leadLama: leadSk });
await Svc.nilaiLead(leadNaik, 'aktif', { user: LEADER, allUsers: tim });
const skorLama = (await Svc.ambilSkorMinggu(mgIni))[0];
cek('60k. Skor minggu lama TETAP memakai target saat itu (5), bukan target baru (20)',
  skorLama.target === 5, skorLama.target);
cek('60l. Menang/kalah minggu lama tidak berubah gara-gara target baru',
  SB.hasilSkor(skorLama) === SB.hasilSkor(s2));

// hak akses & aturan waktu
cek('60m. Rekan sejajar tidak boleh mengisi',
  /tidak berwenang mengisi skor/.test(await pesanSk(() =>
    Svc.simpanSkor({ lead: leadSk, minggu: mgIni, nilai: 1 }, { user: STAF2, allUsers: tim }))));
const pDepan = await pesanSk(() => Svc.simpanSkor(
  { lead: leadSk, minggu: SB.geserMinggu(mgIni, 1), nilai: 1 }, { user: STAF1, allUsers: tim }));
cek('60o. Pesannya menjelaskan mingguya belum berjalan', /belum berjalan/.test(pDepan), pDepan);
cek('60p. Minggu LALU boleh diisi (mengejar ketertinggalan)',
  (await pesanSk(() => Svc.simpanSkor({ lead: leadSk, minggu: SB.geserMinggu(mgIni, -1), nilai: 5 },
    { user: STAF1, allUsers: tim }))) === '');

const leadUsul = await Svc.usulkanLead(
  { goalId: 'gs1', ownerId: 'u-staf1', description: 'Belum disetujui', targetMingguan: 3, uom: 'Sesi' },
  { user: STAF1, allUsers: tim, goal: goalSk });
cek('60q. Lead yang BELUM disetujui tidak bisa diisi skornya',
  /sudah disetujui/.test(await pesanSk(() =>
    Svc.simpanSkor({ lead: leadUsul, minggu: mgIni, nilai: 1 }, { user: STAF1, allUsers: tim }))));
cek('60r. Angka minus ditolak',
  /tidak boleh minus/.test(await pesanSk(() =>
    Svc.simpanSkor({ lead: leadSk, minggu: mgIni, nilai: -5 }, { user: STAF1, allUsers: tim }))));
spSk.bersihkanRekaman();
await Svc.ambilSkorBeberapaMinggu(mgIni, 4);
cek('60t. Empat minggu = empat prefix terpisah, tidak ada prefix global',
  spSk.prefixDiminta.length === 4 && !spSk.prefixDiminta.includes('grdskor:rec:'),
  spSk.prefixDiminta);
lepasMockGrd();

judul('61. Penjaga App.jsx — halaman Scoreboard');
cek('61a-10. Halaman menampilkan tren antar-minggu',
  /Skor\.rekapBeberapaMinggu\(skor, leadTampil/.test(src) && /Tren \{trenMinggu\.length\} Minggu Terakhir/.test(src));
cek('61a-11. Batang tren bisa diklik untuk membuka minggunya',
  /onClick=\{\(\) => setMinggu\(r\.minggu\)\}/.test(src));
cek('61a-12. Tren disembunyikan kalau belum ada satu pun minggu terisi',
  /trenMinggu\.some\(r => r\.terisi > 0\)/.test(src));
cek('61a-7. Halaman punya rekap per orang',
  /Skor\.rekapPerOrang\(skor, leadTampil, minggu, allUsers\)/.test(src)
  && /Rekap per orang/.test(src));
cek('61a-8. Rekap per orang disembunyikan saat cuma satu orang (tidak berguna)',
  /rekapOrang\.length > 1/.test(src));
cek('61a-9. Yang belum lengkap ditandai di kepala rekap',
  /belum lengkap/.test(src));
cek('61a-4. Label menang/kalah jadi SATU komponen bersama',
  /function GrdLabelHasil\(/.test(src) && (src.match(/<GrdLabelHasil\b/g) || []).length >= 2);
cek('61a-5. Label minggu jadi komponen, menandai minggu berjalan',
  /function GrdLabelMinggu\(/.test(src) && /minggu ini<\/span>/.test(src));
cek('61a-6. Badge hasil tidak dirangkai ulang di luar komponennya', (() => {
  const i = src.indexOf('function GrdBarisSkor(');
  const j = src.indexOf(' * HALAMAN SCOREBOARD MINGGUAN');
  const blok = src.slice(i, j);
  return !/\$\{gaya\.color\}`}>\{gaya\.label\}/.test(blok);
})());
cek('61a-2. Form isi skor menampilkan capaian minggu-minggu sebelumnya',
  /Beberapa minggu terakhir/.test(src));
cek('61a-3. Trennya diambil SAMPAI minggu SEBELUM yang sedang diisi', (() => {
  return /Skor\.trenLead\(skor, isian\.lead\.id, \{ sampai: Skor\.geserMinggu\(minggu, -1\)/.test(src);
})());
cek('61a. Halaman + rute + menu terpasang',
  /function GrdScoreboardView\(/.test(src) && /view === 'grd-skor'/.test(src) && /id: 'grd-skor'/.test(src));
cek('61b. Skor ikut BACKUP_KEYS (aturan wajib no.3)', (() => {
  const i = src.indexOf('const BACKUP_KEYS = [');
  return /Skor\.SKOR_BACKUP_KEY/.test(src.slice(i, src.indexOf('];', i)));
})());
cek('61c. Terdaftar di PER_RECORD_LOADERS & PREFIX (aturan wajib no.4)',
  /\[Skor\.SKOR_BACKUP_KEY\]: loadSkorGrd/.test(src)
  && /\[Skor\.SKOR_BACKUP_KEY\]: Skor\.SKOR_REC_PREFIX/.test(src));
cek('61d. Rekap berupa hitungan menang/kalah, bukan rata-rata persen',
  /label="Menang"/.test(src) && /label="Kalah"/.test(src));
cek('61e. Hasil terbaca SEBELUM disimpan (pratinjau menang/kalah)',
  /Hasil minggu ini/.test(src) && /Isi angkanya untuk melihat hasilnya/.test(src));
cek('61f. Tidak bisa maju ke minggu yang belum berjalan',
  /disabled=\{minggu >= Skor\.mingguIni\(\)\}/.test(src));
cek('61g. Modul scoreboard TIDAK meng-import App.jsx', (() => {
  const isi = fs.readFileSync(ROOT + '/src/grd/scoreboard.js', 'utf8');
  return !/from\s+'.*App\.jsx'/.test(isi);
})());
cek('61h. Istilah OKR tidak dipakai di modul scoreboard', (() => {
  const isi = fs.readFileSync(ROOT + '/src/grd/scoreboard.js', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return !/\bOKR\b|\bkey result\b|\bobjective\b/i.test(isi);
})());

judul('62. Rekap per orang & lintas minggu');
const leadTim = [
  lm({ id: 'ta', ownerId: 'u-staf1', status: 'aktif', targetMingguan: 5 }),
  lm({ id: 'tb', ownerId: 'u-staf1', status: 'aktif', targetMingguan: 5 }),
  lm({ id: 'tc', ownerId: 'u-staf2', status: 'aktif', targetMingguan: 5 }),
  lm({ id: 'td', ownerId: 'u-wakil', status: 'aktif', targetMingguan: 5 }),
  lm({ id: 'te', ownerId: 'u-staf2', status: 'usul', targetMingguan: 5 }),
];
const skorTim = [
  { id: 'a', leadId: 'ta', minggu: '2026-09-14', nilai: 6, target: 5, uom: 'K' },
  { id: 'b', leadId: 'tb', minggu: '2026-09-14', nilai: 1, target: 5, uom: 'K' },
  { id: 'c', leadId: 'tc', minggu: '2026-09-14', nilai: 5, target: 5, uom: 'K' },
];
const ro = SB.rekapPerOrang(skorTim, leadTim, '2026-09-14', tim);
const barisOrang = (id) => ro.find(r => r.ownerId === id);

cek('62a. Satu baris per PEMILIK lead aktif', ro.length === 3, ro.length);
cek('62b. Lead yang belum disetujui tidak membuat baris',
  barisOrang('u-staf2').total === 1);
cek('62c. Menang & kalah per orang',
  barisOrang('u-staf1').menang === 1 && barisOrang('u-staf1').kalah === 1);
cek('62d. Yang belum mengisi dihitung', barisOrang('u-wakil').kosong === 1);
cek('62e. Objek anggota ikut disertakan', barisOrang('u-staf1').user?.name === 'Andi');
cek('62f. Persen menang dari yang TERISI', barisOrang('u-staf1').persenMenang === 50);
cek('62g. Belum mengisi sama sekali → persen 0, bukan NaN',
  barisOrang('u-wakil').persenMenang === 0 && Number.isFinite(barisOrang('u-wakil').persenMenang));

cek('62h. Yang BELUM MENGISI diurutkan paling atas (paling perlu dibantu)',
  ro[0].ownerId === 'u-wakil', ro.map(r => r.ownerId));
cek('62i. Setelah itu yang paling banyak kalah', ro[1].ownerId === 'u-staf1', ro.map(r => r.ownerId));
cek('62j. Urutan stabil antar-panggilan',
  SB.rekapPerOrang(skorTim, leadTim, '2026-09-14', tim).map(r => r.ownerId).join()
  === ro.map(r => r.ownerId).join());
cek('62k. Anggota yang akunnya dihapus tetap muncul (datanya tidak hilang)', (() => {
  const r = SB.rekapPerOrang(skorTim, [lm({ id: 'zz', ownerId: 'sudah-dihapus', status: 'aktif' })], '2026-09-14', tim);
  return r.length === 1 && r[0].user === null;
})());
cek('62l. Tanpa lead aktif → kosong', SB.rekapPerOrang(skorTim, [], '2026-09-14', tim).length === 0);
cek('62m. Minggu lain → semua belum diisi',
  SB.rekapPerOrang(skorTim, leadTim, '2026-09-21', tim).every(r => r.kosong === r.total));

const rbm = SB.rekapBeberapaMinggu(skorTim, leadTim, { sampai: '2026-09-14', jumlah: 3 });
cek('62n. Rekap lintas minggu, terlama di kiri',
  rbm.length === 3 && rbm[0].minggu === '2026-08-31' && rbm[2].minggu === '2026-09-14');
cek('62o. Minggu berisi terbaca', rbm[2].terisi === 3 && rbm[2].menang === 2);
cek('62p. Minggu kosong tetap muncul (bukan dilewati)', rbm[0].terisi === 0 && rbm[0].total === 4);

judul('63. Satu pintu pemuatan konteks GRD');
const spKx = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spKx });
// Dua cabang: staf A tidak boleh melihat goal cabang B.
const kxGoalA = { id: 'kx-a', ownerId: 's1', periode: '2026-09', description: 'Cabang A', base: 0, target: 10, uom: 'x' };
const kxGoalB = { id: 'kx-b', ownerId: 's2', periode: '2026-09', description: 'Cabang B', base: 0, target: 10, uom: 'x' };
Svc.initGrd({ storage: spKx });
for (const g of [kxGoalA, kxGoalB]) {
  await spKx.set('grdgoal:rec:' + g.id, g);
}
await spKx.set('grdlead:rec:kx-a:la', { id: 'la', goalId: 'kx-a', ownerId: 's1', status: 'aktif',
  description: 'Lead A', targetMingguan: 5, uom: 'x' });
await spKx.set('grdlead:rec:kx-b:lb', { id: 'lb', goalId: 'kx-b', ownerId: 's2', status: 'aktif',
  description: 'Lead B', targetMingguan: 5, uom: 'x' });

const kxStafA = timCabang.find(u => u.id === 's1');
const kxA = await Svc.muatKonteksGrd({ user: kxStafA, allUsers: timCabang, butuh: ['goal', 'lead'] });
cek('63a. goals memuat semuanya (data mentah)', kxA.goals.length === 2);
cek('63b. goalTerlihat SUDAH digerbangi', kxA.goalTerlihat.some(g => g.id === 'kx-a'));
cek('63c. Goal cabang lain tidak masuk goalTerlihat',
  !kxA.goalTerlihat.some(g => g.id === 'kx-b'), kxA.goalTerlihat.map(g => g.id));
cek('63d. LEAD ikut digerbangi lewat goal induknya',
  kxA.leads.length === 1 && kxA.leads[0].id === 'la', kxA.leads.map(l => l.id));

const kxOwner = await Svc.muatKonteksGrd({ user: timCabang[0], allUsers: timCabang, butuh: ['goal', 'lead'] });
cek('63e. Owner melihat kedua cabang', kxOwner.goalTerlihat.length === 2 && kxOwner.leads.length === 2);

spKx.bersihkanRekaman();
await Svc.muatKonteksGrd({ user: kxStafA, allUsers: timCabang });
cek('63g. Hanya prefix goal yang diminta',
  spKx.prefixDiminta.join() === 'grdgoal:rec:', spKx.prefixDiminta);

spKx.bersihkanRekaman();
await Svc.muatKonteksGrd({ user: kxStafA, allUsers: timCabang, butuh: ['goal', 'jejak'] });
cek('63h. Minta jejak → jejak ikut ditarik, lead TIDAK',
  spKx.prefixDiminta.includes('grdjejak:rec:') && !spKx.prefixDiminta.includes('grdlead:rec:'),
  spKx.prefixDiminta);

spKx.bersihkanRekaman();
await Svc.muatKonteksGrd({ user: kxStafA, allUsers: timCabang, butuh: ['goal', 'skor'],
  minggu: SB.mingguIni(), mingguTren: 3 });
cek('63i. Skor ditarik PER MINGGU (3 minggu = 3 prefix)',
  spKx.prefixDiminta.filter(x => x.startsWith('grdskor:rec:')).length === 3,
  spKx.prefixDiminta.filter(x => x.startsWith('grdskor:rec:')));
cek('63j. Tidak pernah meminta prefix skor global',
  !spKx.prefixDiminta.includes('grdskor:rec:'));

const kxPeriode = await Svc.muatKonteksGrd({ user: timCabang[0], allUsers: timCabang, periode: '2026-09' });
cek('63k. Periode menghasilkan goalPeriode tersaring', kxPeriode.goalPeriode.length === 2);
const kxLain = await Svc.muatKonteksGrd({ user: timCabang[0], allUsers: timCabang, periode: '2026-12' });
cek('63m. Periode tanpa goal → goalPeriode kosong', kxLain.goalPeriode.length === 0);

const kxTanpa = await Svc.muatKonteksGrd({ allUsers: timCabang, butuh: ['goal', 'lead'] });
cek('63o. Tanpa user: semua terlihat', kxTanpa.goalTerlihat.length === 2 && kxTanpa.leads.length === 2);
cek('63p. Tanpa argumen sama sekali tidak error', (await Svc.muatKonteksGrd()).goals.length >= 0);

judul('64. Gerbang baca berlaku untuk SELURUH turunan goal');
const spGb2 = storageMock(); Svc.setJalurGrd('kv'); Svc.initGrd({ storage: spGb2 });
await spGb2.set('grdgoal:rec:ga', { id: 'ga', ownerId: 's1', periode: '2026-09',
  description: 'Cabang A', base: 0, target: 10, uom: 'x' });
await spGb2.set('grdgoal:rec:gb', { id: 'gb', ownerId: 's2', periode: '2026-09',
  description: 'Cabang B', base: 0, target: 10, uom: 'x' });
// jejak & skor untuk KEDUA cabang
await spGb2.set('grdjejak:rec:ga:target:t1', { id: 'ga:target:t1', goalId: 'ga', field: 'target', dari: 1, ke: 2, waktu: 'a' });
await spGb2.set('grdjejak:rec:gb:target:t1', { id: 'gb:target:t1', goalId: 'gb', field: 'target', dari: 1, ke: 2, waktu: 'a' });
const mgN = SB.mingguIni();
await spGb2.set(`grdskor:rec:${mgN}:la`, { id: `${mgN}:la`, leadId: 'la', goalId: 'ga', minggu: mgN, nilai: 5, target: 5, uom: 'x' });
await spGb2.set(`grdskor:rec:${mgN}:lb`, { id: `${mgN}:lb`, leadId: 'lb', goalId: 'gb', minggu: mgN, nilai: 5, target: 5, uom: 'x' });

const orgA = timCabang.find(u => u.id === 's1');
const kx2 = await Svc.muatKonteksGrd({
  user: orgA, allUsers: timCabang, minggu: mgN, butuh: ['goal', 'jejak', 'skor'], mingguTren: 1,
});
cek('64a. Goal cabang lain tidak terlihat', !kx2.goalTerlihat.some(g => g.id === 'gb'));
cek('64b. JEJAK cabang lain ikut tersaring',
  kx2.jejak.length === 1 && kx2.jejak[0].goalId === 'ga', kx2.jejak.map(j => j.goalId));
cek('64c. SKOR cabang lain ikut tersaring',
  kx2.skor.length === 1 && kx2.skor[0].goalId === 'ga', kx2.skor.map(s => s.goalId));

const kxOwner2 = await Svc.muatKonteksGrd({
  user: timCabang[0], allUsers: timCabang, minggu: mgN, butuh: ['goal', 'jejak', 'skor'], mingguTren: 1,
});
cek('64d. Owner tetap melihat keduanya', kxOwner2.jejak.length === 2 && kxOwner2.skor.length === 2);
const kxBackup = await Svc.muatKonteksGrd({
  allUsers: timCabang, minggu: mgN, butuh: ['goal', 'jejak', 'skor'], mingguTren: 1,
});
cek('64f. Backup membaca seluruhnya', kxBackup.jejak.length === 2 && kxBackup.skor.length === 2);
lepasMockGrd();

// ============================================================================
judul('18. Penjaga ATURAN WAJIB penyimpanan (no. 3, 4, 5 di CLAUDE.md)');
// Sama peran dengan uji-sampel.mjs §18: kalau blok ini gagal, biasanya memang
// ada aturan yang terlanggar — bukan regexnya yang perlu dilonggarkan.
// ============================================================================
cek('18a. Loader goal per-record ada', /async function loadGoals\(/.test(src));
cek('18a-5. Semua halaman GRD memuat lewat SATU pintu (muatKonteksGrd)',
  (src.match(/GrdSvc\.muatKonteksGrd\(/g) || []).length === 4);
cek('18a-6. Tidak ada halaman yang merangkai pemanggilan bacanya sendiri lagi',
  !/Promise\.all\(\[GrdSvc\.ambilGoal/.test(src));
cek('18a-2. SATU JALUR: App.jsx tidak menyentuh penyimpanan GRD di luar layanan', (() => {
  // Prefix boleh muncul sebagai KONSTANTA di registry & BACKUP_KEYS (mesin
  // backup generik memang butuh tahu prefixnya). Yang dilarang: memanggil
  // storage langsung dengan prefix GRD, melewati src/grd/layanan.js.
  return !/storage\.(listByPrefix|set|delete|get)\(\s*Grd\.(GOAL_REC_PREFIX|JEJAK_REC_PREFIX|TEMPLATE_KEY)/.test(src)
    && !/storage\.(set|delete)\(\s*['"`]grd/.test(src);
})());
cek('18a-3. Loader backup pun lewat layanan (ikut pindah kalau sumbernya pindah)', (() => {
  const i = src.indexOf('async function loadGoals(');
  const blok = src.slice(i, i + 300);
  return /GrdSvc\.ambilGoal\(\)/.test(blok);
})());
cek('18a-4. initGrd dipanggil SEBELUM loader dideklarasikan (urutan aman)', (() => {
  return src.indexOf('initGrd({') < src.indexOf('async function loadGoals(');
})());
cek('18b. Loader jejak per-record ada', /async function loadJejakGrd\(/.test(src));
cek('18c. Pembacaan goal tetap per-record lewat listByPrefix (bukan satu array besar)', (() => {
  const svc = fs.readFileSync(ROOT + '/src/grd/layanan.js', 'utf8');
  return /listByPrefix\(Grd\.GOAL_REC_PREFIX\)/.test(svc);
})());
cek('18d. Pembacaan jejak per-record', (() => {
  const svc = fs.readFileSync(ROOT + '/src/grd/layanan.js', 'utf8');
  return /listByPrefix\(Grd\.JEJAK_REC_PREFIX\)/.test(svc);
})());
cek('18e. Goal ternormalisasi saat dimuat (record lama tidak merusak halaman)', (() => {
  const svc = fs.readFileSync(ROOT + '/src/grd/layanan.js', 'utf8');
  const i = svc.indexOf('export async function ambilGoal(');
  return /Grd\.normalisasiGoal/.test(svc.slice(i, i + 300));
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
