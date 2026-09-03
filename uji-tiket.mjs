// ============================================================================
// UJI URUTAN TIKET — jalankan: node uji-tiket.mjs
// ----------------------------------------------------------------------------
// BUKAN framework test dan TIDAK menambah dependency — satu file Node biasa.
// Database production tidak pernah disentuh (semua data di sini data contoh).
// Menjaga: default "terbaru di atas", 5 mode urut, tiket tanpa deadline,
// urutan prioritas Tinggi→Sedang→Rendah, kombinasi filter+sort, dan
// determinisme (urutan tidak berubah antar render).
// ============================================================================
import * as T from './src/tiket/urutan.js';

let lulus = 0, gagal = 0;
const cek = (nama, syarat, detail) => {
  if (syarat) { lulus++; console.log('  LULUS  ', nama); }
  else { gagal++; console.log('  GAGAL  ', nama, detail !== undefined ? `\n           → ${JSON.stringify(detail)}` : ''); }
};
const judul = (t) => console.log(`\n=== ${t} ===`);

// Tiket contoh — sengaja diberikan dalam urutan ACAK (bukan urut waktu),
// meniru urutan apa adanya dari kv_store (ORDER BY key).
const tiket = [
  { id: 'c', title: 'Tengah', createdAt: '2026-08-15T10:00:00.000Z', deadline: '2026-09-10', priority: 'low', status: 'todo', assigneeId: 'siti' },
  { id: 'a', title: 'Paling lama', createdAt: '2026-06-01T08:00:00.000Z', deadline: '2026-09-30', priority: 'high', status: 'done', assigneeId: 'budi' },
  { id: 'e', title: 'Paling baru', createdAt: '2026-09-03T07:00:00.000Z', deadline: '2026-09-20', priority: 'medium', status: 'todo', assigneeId: 'siti' },
  { id: 'b', title: 'Tanpa deadline', createdAt: '2026-07-01T09:00:00.000Z', deadline: '', priority: 'high', status: 'in_progress', assigneeId: 'siti' },
  { id: 'd', title: 'Deadline terdekat', createdAt: '2026-08-20T11:00:00.000Z', deadline: '2026-09-05', priority: 'medium', status: 'todo', assigneeId: 'budi' },
];
const ambil = (list) => list.map(t => t.id).join(',');

// ============================================================================
judul('1. Default: terbaru dibuat di paling atas');
// ============================================================================
cek('1a. Default tanpa argumen mode = terbaru', T.URUT_DEFAULT === 'terbaru');
const def = T.urutkanTiket(tiket);
cek('1b. Urutan default e,d,c,b,a (terbaru → terlama)', ambil(def) === 'e,d,c,b,a', ambil(def));
cek('1c. Tiket paling baru ada di indeks 0', def[0].id === 'e' && def[0].title === 'Paling baru');
cek('1d. Mode tidak dikenal jatuh ke default (bukan error/urutan acak)',
  ambil(T.urutkanTiket(tiket, 'ngawur')) === 'e,d,c,b,a');

// Simulasi "buat tiket baru" → harus langsung paling atas
const barus = [...tiket, { id: 'z', title: 'Tiket baru dibuat', createdAt: '2026-09-04T12:00:00.000Z', deadline: '2026-12-01', priority: 'low', status: 'todo', assigneeId: 'siti' }];
cek('1e. Tiket yang baru dibuat langsung di posisi paling atas',
  T.urutkanTiket(barus)[0].id === 'z', ambil(T.urutkanTiket(barus)));

// ============================================================================
judul('2. Lima mode urut');
// ============================================================================
cek('2a. Daftar pilihan berisi 5 mode', T.URUT_TIKET.length === 5, T.URUT_TIKET.map(u => u.id));
cek('2b. Label sesuai permintaan', T.URUT_TIKET.map(u => u.label).join(' | ')
  === 'Terbaru dibuat | Terlama dibuat | Deadline terdekat | Deadline terjauh | Prioritas tertinggi',
  T.URUT_TIKET.map(u => u.label));

cek('2c. Terlama dibuat = kebalikan default', ambil(T.urutkanTiket(tiket, 'terlama')) === 'a,b,c,d,e', ambil(T.urutkanTiket(tiket, 'terlama')));

const dekat = T.urutkanTiket(tiket, 'deadline-dekat');
cek('2d. Deadline terdekat: 5 Sep → 10 Sep → 20 Sep → 30 Sep, tanpa deadline paling bawah',
  ambil(dekat) === 'd,c,e,a,b', ambil(dekat));

const jauh = T.urutkanTiket(tiket, 'deadline-jauh');
cek('2e. Deadline terjauh: 30 Sep → 20 Sep → 10 Sep → 5 Sep, tanpa deadline TETAP paling bawah',
  ambil(jauh) === 'a,e,c,d,b', ambil(jauh));
cek('2f. Tiket tanpa deadline tidak pernah naik ke atas di kedua mode deadline',
  dekat[dekat.length - 1].id === 'b' && jauh[jauh.length - 1].id === 'b');

// ============================================================================
judul('3. Prioritas: Tinggi → Sedang → Rendah');
// ============================================================================
const pri = T.urutkanTiket(tiket, 'prioritas');
cek('3a. Urutan bobot benar', pri.map(t => t.priority).join(',') === 'high,high,medium,medium,low', pri.map(t => t.priority));
cek('3b. Bobot: Tinggi 3, Sedang 2, Rendah 1',
  T.bobotPrioritas('high') === 3 && T.bobotPrioritas('medium') === 2 && T.bobotPrioritas('low') === 1);
cek('3c. Prioritas tak dikenal/kosong dianggap paling rendah',
  T.bobotPrioritas('urgent') === 0 && T.bobotPrioritas(undefined) === 0);
cek('3d. Prioritas sama → yang lebih baru di atas', ambil(pri) === 'b,a,e,d,c', ambil(pri));
cek('3e. Tiket tanpa prioritas tidak crash & jatuh ke bawah', (() => {
  const r = T.urutkanTiket([...tiket, { id: 'x', createdAt: '2026-09-01T00:00:00.000Z' }], 'prioritas');
  return r[r.length - 1].id === 'x';
})());

// ============================================================================
judul('4. Kombinasi filter + sortir (skenario dari permintaan)');
// ============================================================================
// "Status: belum selesai, PIC: Siti, Urutkan: terbaru dibuat"
const hasil = T.urutkanTiket(
  tiket.filter(t => t.status !== 'done').filter(t => t.assigneeId === 'siti'),
  'terbaru'
);
cek('4a. Hanya tiket Siti yang belum selesai', hasil.every(t => t.assigneeId === 'siti' && t.status !== 'done'));
cek('4b. Jumlahnya 3 (c, e, b)', hasil.length === 3, ambil(hasil));
cek('4c. Diurutkan terbaru dulu', ambil(hasil) === 'e,c,b', ambil(hasil));

// Kombinasi dengan pencarian + prioritas
const cari = T.urutkanTiket(
  tiket.filter(t => (t.title || '').toLowerCase().includes('deadline')),
  'prioritas'
);
// "deadline" cocok dengan DUA judul: "Tanpa deadline" (high) & "Deadline terdekat" (medium).
cek('4d. Search + prioritas tetap bekerja (high dulu, lalu medium)',
  ambil(cari) === 'b,d', ambil(cari));

// Filter yang tidak menghasilkan apa-apa
cek('4e. Hasil filter kosong tidak error', T.urutkanTiket([], 'prioritas').length === 0);

// ============================================================================
judul('5. Data lama & data kotor');
// ============================================================================
// Record lama TANPA createdAt: id dibuat uid() = Date.now().toString(36)+acak
const idLama = (1754000000000).toString(36) + 'xy3'; // ~Agustus 2025
const idBaru = (1788000000000).toString(36) + 'ab7'; // ~Januari 2027
cek('5a. Tanpa createdAt → waktu didekode dari id', T.waktuDibuat({ id: idLama }) === 1754000000000, T.waktuDibuat({ id: idLama }));
cek('5b. Dua record tanpa createdAt tetap terurut benar',
  ambil(T.urutkanTiket([{ id: idLama }, { id: idBaru }])) === `${idBaru},${idLama}`);
cek('5c. createdAt tetap menang atas dekode id',
  T.waktuDibuat({ id: idLama, createdAt: '2027-01-01T00:00:00.000Z' }) === Date.parse('2027-01-01T00:00:00.000Z'));
cek('5d. id berformat lain (bukan uid) tidak menghasilkan tanggal ngawur',
  T.waktuDibuat({ id: 'tiket-manual-01' }) === 0);
cek('5e. createdAt rusak → jatuh ke cadangan/0, tidak NaN',
  Number.isFinite(T.waktuDibuat({ id: 'zz', createdAt: 'bukan-tanggal' })));
cek('5f. Deadline rusak dianggap tidak ada (masuk kelompok bawah)',
  T.waktuDeadline({ deadline: '31-12-2026' }) === null && T.waktuDeadline({ deadline: '2026-12-31' }) !== null);
cek('5g. Daftar berisi null/undefined tidak crash',
  T.urutkanTiket([null, undefined, ...tiket]).length === 7);
cek('5h. Argumen bukan array tidak crash', T.urutkanTiket(null).length === 0 && T.urutkanTiket(undefined).length === 0);

// ============================================================================
judul('5b. Tanggal dibuat untuk ditampilkan');
// ============================================================================
cek('5b-1. isoDibuat mengembalikan ISO dari createdAt',
  T.isoDibuat({ id: 'x', createdAt: '2026-08-15T10:00:00.000Z' }) === '2026-08-15T10:00:00.000Z');
cek('5b-2. Tanpa createdAt → tetap dapat tanggal dari id (konsisten dengan urutan)',
  T.isoDibuat({ id: idLama }) === new Date(1754000000000).toISOString(), T.isoDibuat({ id: idLama }));
cek('5b-3. Benar-benar tidak diketahui → null (layar menampilkan "—")',
  T.isoDibuat({ id: 'tiket-manual-01' }) === null && T.isoDibuat({}) === null && T.isoDibuat(null) === null);
cek('5b-4. Tanggal yang ditampilkan SELALU sejalan dengan urutan', (() => {
  const urut = T.urutkanTiket(tiket);
  for (let i = 1; i < urut.length; i++) {
    if (Date.parse(T.isoDibuat(urut[i - 1])) < Date.parse(T.isoDibuat(urut[i]))) return false;
  }
  return true;
})());

// ============================================================================
judul('6. Tidak merusak state & deterministik');
// ============================================================================
const asli = [...tiket];
const salinanUrut = T.urutkanTiket(tiket, 'prioritas');
cek('6a. Array asli TIDAK ikut berubah (aman untuk state React)',
  ambil(tiket) === ambil(asli) && salinanUrut !== tiket, ambil(tiket));

cek('6b. Hasil sama persis kalau dijalankan berulang (tidak loncat antar render)', (() => {
  for (const m of ['terbaru', 'terlama', 'deadline-dekat', 'deadline-jauh', 'prioritas']) {
    if (ambil(T.urutkanTiket(tiket, m)) !== ambil(T.urutkanTiket([...tiket].reverse(), m))) return false;
  }
  return true;
})());

cek('6c. createdAt kembar tetap deterministik (dipecah oleh id)', (() => {
  const kembar = [
    { id: 'b2', createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'a1', createdAt: '2026-08-01T00:00:00.000Z' },
  ];
  return ambil(T.urutkanTiket(kembar)) === ambil(T.urutkanTiket([...kembar].reverse()));
})());

cek('6d. Semua mode mengembalikan jumlah tiket yang sama (tidak ada yang hilang)',
  ['terbaru', 'terlama', 'deadline-dekat', 'deadline-jauh', 'prioritas']
    .every(m => T.urutkanTiket(tiket, m).length === tiket.length));

cek('6e. labelUrut mengembalikan label yang benar & aman',
  T.labelUrut('prioritas') === 'Prioritas tertinggi' && T.labelUrut('ngawur') === 'Terbaru dibuat');

// ============================================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`RINGKASAN: ${lulus} LULUS, ${gagal} GAGAL`);
console.log('='.repeat(60));
process.exit(gagal ? 1 : 0);
