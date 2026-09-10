// ============================================================================
// UJI HIERARKI PERAN & PENGAWASAN  —  node uji-peran.mjs
// ----------------------------------------------------------------------------
// Menguji src/peran/hierarki.js (fungsi murni) DAN memeriksa bahwa src/App.jsx
// benar-benar MEMAKAI modul itu — bukan menyalin ulang rumus "siapa bawahan siapa".
// Pemeriksaan terakhir itu penting: kalau App.jsx diam-diam kembali memakai
// `u.leaderId === user.id`, lapisan Co-Leader akan bocor/putus tanpa ketahuan.
// ============================================================================
import fs from 'fs';
import {
  ROLE_KEYS, ROLE_RANK, ROLE_BERATASAN, ROLE_PENGAWAS,
  isManajemen, isPengawas, isPengelola, butuhAtasan,
  bawahanLangsung, idBawahanTransitif, lingkupTim, lingkupTimIds, timSaya,
  bisaLihatUser, bisaKelolaUser, peranBolehDibuat, calonAtasan,
  validasiAtasan, normalisasiAtasanId
} from './src/peran/hierarki.js';

const ROOT = '/Users/kholidfath_/Documents/GitHub/masjidaffiliate';
const src = fs.readFileSync(ROOT + '/src/App.jsx', 'utf8');

let ok = 0, bad = 0;
const cek = (n, c) => { if (c) { ok++; console.log('  LULUS  ', n); } else { bad++; console.log('  GAGAL  ', n); } };
const ids = (arr) => arr.map(u => u.id).sort().join(',');

// ====== STRUKTUR UJI ======
// Meniru struktur nyata Al-Kahfi Corp:
//   Owner ─ Manajer
//   Leader Internal (siti) ─┬─ Co-Leader (naima) ─┬─ staf A
//                           │                     └─ staf B
//                           └─ staf C  (langsung di bawah Leader, BUKAN bawahan Co-Leader)
//   Leader MCN (ardi) ─ staf D          (divisi lain — tidak boleh saling terlihat)
const OWNER = { id: 'owner1', name: 'Owner',      role: 'owner',       division: 'manajemen', leaderId: null };
const MGR   = { id: 'mgr1',   name: 'Manajer',    role: 'manajer',     division: 'manajemen', leaderId: null };
const SITI  = { id: 'siti',   name: 'Leader Int', role: 'leader',      division: 'internal',  leaderId: null };
const ARDI  = { id: 'ardi',   name: 'Leader MCN', role: 'leader',      division: 'mcn',       leaderId: null };
const COLEAD= { id: 'cl1',    name: 'Co-Leader',  role: 'wakil',       division: 'internal',  leaderId: 'siti' };
const STAF_A= { id: 'sa',     name: 'Staf A',     role: 'operasional', division: 'internal',  leaderId: 'cl1' };
const STAF_B= { id: 'sb',     name: 'Staf B',     role: 'operasional', division: 'internal',  leaderId: 'cl1' };
const STAF_C= { id: 'sc',     name: 'Staf C',     role: 'operasional', division: 'internal',  leaderId: 'siti' };
const STAF_D= { id: 'sd',     name: 'Staf D',     role: 'operasional', division: 'mcn',       leaderId: 'ardi' };
const TIM = [OWNER, MGR, SITI, ARDI, COLEAD, STAF_A, STAF_B, STAF_C, STAF_D];

// Laporan harian tiruan (bentuknya sama dengan reports:all — dipakai `r.authorId`).
const LAPORAN = TIM.map(u => ({ id: 'r-' + u.id, authorId: u.id, date: '2026-09-10' }));
// Filter laporan PERSIS seperti di App.jsx: ids = lingkupTimIds(...) lalu filter authorId.
const laporanTerlihat = (viewer, allUsers) => {
  const s = lingkupTimIds(viewer, allUsers);
  return LAPORAN.filter(r => s.has(r.authorId)).map(r => r.authorId).sort().join(',');
};

console.log('\n== 0. PERAN CO-LEADER TERDAFTAR DI SISTEM ==');
cek("ROLE_KEYS memuat 'wakil'", ROLE_KEYS.includes('wakil'));
cek('pangkat: owner > manajer > leader > wakil > operasional',
  ROLE_RANK.owner > ROLE_RANK.manajer && ROLE_RANK.manajer > ROLE_RANK.leader &&
  ROLE_RANK.leader > ROLE_RANK.wakil && ROLE_RANK.wakil > ROLE_RANK.operasional);
cek("ROLE_PENGAWAS = leader + wakil", ids(ROLE_PENGAWAS.map(x => ({ id: x }))) === 'leader,wakil');
cek("ROLE_BERATASAN = wakil + operasional", ids(ROLE_BERATASAN.map(x => ({ id: x }))) === 'operasional,wakil');
cek("App.jsx: ROLES punya entri 'wakil'", /\n\s*wakil:\s*\{[^\n]*label:\s*'Co-Leader'/.test(src));
cek("App.jsx: DEFAULT_ROLE_LABELS punya wakil: 'Co-Leader'", /DEFAULT_ROLE_LABELS = \{[^\n]*wakil: 'Co-Leader'/.test(src));
cek('App.jsx: ROLES.rank diambil dari ROLE_RANK (bukan angka manual)',
  /rank: ROLE_RANK\.owner/.test(src) && /rank: ROLE_RANK\.wakil/.test(src));

console.log('\n== TEST 1. AKUN CO-LEADER TERBACA SEBAGAI CO-LEADER ==');
cek('isPengawas(Co-Leader) = true', isPengawas(COLEAD) === true);
cek('isPengelola(Co-Leader) = true (dapat menu manajerial)', isPengelola(COLEAD) === true);
cek('isManajemen(Co-Leader) = false (BUKAN akses seluruh perusahaan)', isManajemen(COLEAD) === false);
cek("App.jsx: displayJobTitle menampilkan 'Co-Leader <divisi>'",
  /if \(u\.role === 'wakil'\) return `Co-Leader \$\{LEADER_DIV_SHORT\[u\.division\] \|\| ''\}`/.test(src));

console.log('\n== TEST 2. CO-LEADER MELIHAT LAPORAN STAF BAWAHANNYA ==');
cek('lingkup Co-Leader = dirinya + staf A + staf B', ids(lingkupTim(COLEAD, TIM)) === 'cl1,sa,sb');
cek('laporan yang terlihat Co-Leader = miliknya + staf A + staf B', laporanTerlihat(COLEAD, TIM) === 'cl1,sa,sb');
cek('bisaLihatUser(Co-Leader → staf A) = true', bisaLihatUser(COLEAD, STAF_A, TIM) === true);
cek('bisaKelolaUser(Co-Leader → staf A) = true (boleh edit bawahannya)', bisaKelolaUser(COLEAD, STAF_A, TIM) === true);

console.log('\n== TEST 3. CO-LEADER TIDAK MELIHAT STAF DI LUAR KEWENANGANNYA ==');
cek('staf C (langsung di bawah Leader) TIDAK terlihat', bisaLihatUser(COLEAD, STAF_C, TIM) === false);
cek('staf D (divisi lain) TIDAK terlihat', bisaLihatUser(COLEAD, STAF_D, TIM) === false);
cek('Leader-nya sendiri TIDAK terlihat sebagai bawahan', bisaLihatUser(COLEAD, SITI, TIM) === false);
cek('Owner & Manajer TIDAK terlihat', bisaLihatUser(COLEAD, OWNER, TIM) === false && bisaLihatUser(COLEAD, MGR, TIM) === false);
cek('laporan staf C / D TIDAK ikut terbawa', !laporanTerlihat(COLEAD, TIM).includes('sc') && !laporanTerlihat(COLEAD, TIM).includes('sd'));
cek('Co-Leader TIDAK bisa mengedit staf C', bisaKelolaUser(COLEAD, STAF_C, TIM) === false);
cek('Co-Leader TIDAK bisa mengedit atasannya', bisaKelolaUser(COLEAD, SITI, TIM) === false);
cek('Co-Leader TIDAK bisa mengedit dirinya sendiri (cegah naik peran sendiri)', bisaKelolaUser(COLEAD, COLEAD, TIM) === false);
cek('Co-Leader hanya boleh memberi peran Karyawan', peranBolehDibuat(COLEAD).join(',') === 'operasional');

console.log('\n== TEST 4. KARYAWAN BIASA TIDAK MENDAPAT PERMISSION CO-LEADER ==');
cek('isPengawas(staf) = false', isPengawas(STAF_A) === false);
cek('isPengelola(staf) = false (menu manajerial tersembunyi)', isPengelola(STAF_A) === false);
cek('lingkup staf = hanya dirinya', ids(lingkupTim(STAF_A, TIM)) === 'sa');
cek('laporan yang terlihat staf = hanya miliknya', laporanTerlihat(STAF_A, TIM) === 'sa');
cek('staf TIDAK melihat rekan sesama bawahan Co-Leader', bisaLihatUser(STAF_A, STAF_B, TIM) === false);
cek('staf tidak boleh memberi peran apa pun', peranBolehDibuat(STAF_A).length === 0);

console.log('\n== TEST 5. PERMISSION LEADER TETAP BEKERJA ==');
cek('Leader melihat dirinya + Co-Leader + SEMUA staf di bawahnya (transitif)',
  ids(lingkupTim(SITI, TIM)) === 'cl1,sa,sb,sc,siti');
cek('laporan Leader mencakup staf di bawah Co-Leader', laporanTerlihat(SITI, TIM) === 'cl1,sa,sb,sc,siti');
cek('Leader TIDAK melihat tim divisi lain', bisaLihatUser(SITI, STAF_D, TIM) === false);
cek('Leader MCN tidak terpengaruh perubahan ini', ids(lingkupTim(ARDI, TIM)) === 'ardi,sd');
cek('Leader boleh memberi peran Co-Leader & Karyawan', peranBolehDibuat(SITI).join(',') === 'wakil,operasional');
cek('Leader boleh mengedit staf di bawah Co-Leader-nya', bisaKelolaUser(SITI, STAF_A, TIM) === true);
cek('Owner tetap melihat semua orang', ids(lingkupTim(OWNER, TIM)) === ids(TIM));
cek('Manajer tetap melihat semua orang', ids(lingkupTim(MGR, TIM)) === ids(TIM));
cek('bawahan LANGSUNG Leader tetap 2 (Co-Leader + staf C)', ids(bawahanLangsung('siti', TIM)) === 'cl1,sc');
cek('timSaya(Leader) = semua bawahan tanpa dirinya', ids(timSaya(SITI, TIM)) === 'cl1,sa,sb,sc');

console.log('\n== TEST 6. STAF → CO-LEADER: HAK BERUBAH TANPA UBAH KODE ==');
// Hanya DATA yang diubah (role + atasan staf), tidak ada satu baris kode pun yang berbeda.
const SETELAH_PROMOSI = TIM.map(u => {
  if (u.id === 'sc') return { ...u, role: 'wakil' };                 // staf C dipromosikan
  if (u.id === 'sd') return { ...u, leaderId: 'sc', division: 'internal' }; // staf D dipindah ke bawahnya
  return u;
});
const SC_BARU = SETELAH_PROMOSI.find(u => u.id === 'sc');
cek('sebelum promosi: staf C tidak melihat siapa pun selain dirinya', ids(lingkupTim(STAF_C, TIM)) === 'sc');
cek('setelah promosi: staf C jadi pengawas', isPengawas(SC_BARU) === true);
cek('setelah promosi: staf C melihat bawahan barunya', ids(lingkupTim(SC_BARU, SETELAH_PROMOSI)) === 'sc,sd');
cek('setelah promosi: staf C melihat laporan bawahannya',
  lingkupTimIds(SC_BARU, SETELAH_PROMOSI).has('sd') === true);
cek('setelah promosi: staf C TETAP tidak melihat staf A/B milik Co-Leader lain',
  bisaLihatUser(SC_BARU, STAF_A, SETELAH_PROMOSI) === false);
cek('Leader tetap melihat seluruh cabang barunya',
  ids(lingkupTim(SITI, SETELAH_PROMOSI)) === 'cl1,sa,sb,sc,sd,siti');

console.log('\n== TEST 7. CO-LEADER → STAF: HAK DICABUT ==');
// Peran diturunkan; `normalisasiAtasanId` memastikan field atasan tetap benar.
const TURUN = TIM.map(u => (u.id === 'cl1' ? { ...u, role: 'operasional' } : u));
const CL_TURUN = TURUN.find(u => u.id === 'cl1');
cek('setelah turun: bukan pengawas lagi', isPengawas(CL_TURUN) === false);
cek('setelah turun: hanya melihat dirinya', ids(lingkupTim(CL_TURUN, TURUN)) === 'cl1');
cek('setelah turun: TIDAK bisa lagi melihat mantan bawahannya', bisaLihatUser(CL_TURUN, STAF_A, TURUN) === false);
cek('setelah turun: TIDAK bisa mengelola mantan bawahannya', bisaKelolaUser(CL_TURUN, STAF_A, TURUN) === false);
cek('setelah turun: laporan yang terlihat tinggal miliknya', laporanTerlihat(CL_TURUN, TURUN) === 'cl1');
// Staf A masih menunjuk cl1 sebagai atasan, padahal cl1 kini Karyawan. Rantai ke Leader
// TIDAK putus (Leader tetap berwenang), tapi cl1 sendiri sudah tidak punya hak apa pun.
// Kondisi "menggantung" ini ditandai dengan peringatan merah di halaman Anggota Tim.
cek('Leader tetap berwenang atas staf yang menggantung', bisaLihatUser(SITI, STAF_A, TURUN) === true);
cek('mantan Co-Leader TIDAK ikut berwenang lagi', bisaLihatUser(CL_TURUN, STAF_B, TURUN) === false);
cek('App.jsx menandai anggota yang atasannya bukan pengawas lagi',
  /anggotaMenggantung/.test(src) && /tidak berperan mengawasi/.test(src));
cek('naik peran ke Leader mengosongkan field atasan', normalisasiAtasanId('leader', 'siti') === null);
cek('turun ke Karyawan tetap menyimpan atasan', normalisasiAtasanId('operasional', 'siti') === 'siti');

console.log('\n== TEST 8. KONSISTEN SETELAH REFRESH / LOGOUT-LOGIN ==');
// Hak akses TIDAK disimpan di sesi: selalu dihitung ulang dari data users:list.
// Jadi sesi lama (objek user hasil login sebelum promosi) harus kalah oleh data terbaru.
const SESI_LAMA = { ...STAF_C };                          // salinan "hasil login sebelum promosi"
const SESI_BARU = SETELAH_PROMOSI.find(u => u.id === 'sc'); // hasil refresh dari server
cek('objek sesi lama + data baru = hak lama (bukti hak dihitung dari objek user)',
  ids(lingkupTim(SESI_LAMA, SETELAH_PROMOSI)) === 'sc');
cek('setelah refresh (objek user diperbarui) = hak baru',
  ids(lingkupTim(SESI_BARU, SETELAH_PROMOSI)) === 'sc,sd');
cek('perhitungan bersifat murni: dipanggil 2x hasilnya sama',
  ids(lingkupTim(COLEAD, TIM)) === ids(lingkupTim(COLEAD, TIM)));
cek('App.jsx: sesi hanya menyimpan { id }, peran dibaca ulang dari users:list',
  /storage\.set\('current-user', \{ id: user\.id \}, false\)/.test(src));
cek('App.jsx: currentUser ikut disegarkan saat peran/atasan berubah (tanpa logout)',
  /const berubah = fresh\.role !== currentUser\.role/.test(src) && /if \(berubah\) setCurrentUser\(fresh\);/.test(src));

console.log('\n== 9. VALIDASI ATASAN & KEAMANAN STRUKTUR ==');
cek('Karyawan wajib punya atasan', validasiAtasan('operasional', '', null, TIM) !== null);
cek('Co-Leader wajib punya atasan', validasiAtasan('wakil', '', null, TIM) !== null);
cek('Leader tidak butuh atasan', validasiAtasan('leader', '', null, TIM) === null);
cek('atasan harus berpangkat lebih tinggi (Co-Leader di bawah Karyawan = ditolak)',
  validasiAtasan('wakil', 'sa', null, TIM) !== null);
cek('Karyawan boleh di bawah Co-Leader', validasiAtasan('operasional', 'cl1', null, TIM) === null);
cek('Karyawan boleh di bawah Leader', validasiAtasan('operasional', 'siti', null, TIM) === null);
cek('Co-Leader boleh di bawah Leader', validasiAtasan('wakil', 'siti', null, TIM) === null);
cek('tidak bisa memilih diri sendiri sebagai atasan', validasiAtasan('wakil', 'cl1', 'cl1', TIM) !== null);
cek('tidak bisa memilih bawahan sendiri sebagai atasan (anti-melingkar)',
  validasiAtasan('operasional', 'sa', 'cl1', TIM) !== null);
cek('atasan tak dikenal ditolak', validasiAtasan('operasional', 'entah', null, TIM) !== null);
cek('calonAtasan(Karyawan) = semua yang berpangkat lebih tinggi',
  ids(calonAtasan('operasional', TIM)) === 'ardi,cl1,mgr1,owner1,siti');
cek('calonAtasan(Co-Leader) tidak memuat sesama Co-Leader',
  !calonAtasan('wakil', TIM).some(u => u.role === 'wakil'));
cek('calonAtasan menyaring diri sendiri & bawahannya',
  !calonAtasan('operasional', TIM, 'cl1').some(u => ['cl1', 'sa', 'sb'].includes(u.id)));
cek('data melingkar tidak membuat program menggantung', (() => {
  const RUSAK = [{ id: 'x', role: 'wakil', leaderId: 'y' }, { id: 'y', role: 'wakil', leaderId: 'x' }];
  const r = idBawahanTransitif('x', RUSAK);
  return r.has('y') && !r.has('x');
})());

console.log('\n== 10. APP.JSX BENAR-BENAR MEMAKAI MODUL INI (anti-regresi) ==');
cek("App.jsx meng-import src/peran/hierarki.js", /from '\.\/peran\/hierarki\.js'/.test(src));
cek('tidak ada lagi rumus bawahan yang disalin (`leaderId === user.id`)',
  !/leaderId === user\.id/.test(src));
cek('tidak ada lagi `leaderId === viewer.id`', !/leaderId === viewer\.id/.test(src));
cek('penerimaTiket memakai lingkupTim', /function penerimaTiket[\s\S]{0,600}lingkupTim\(user, allUsers\)/.test(src));
cek('laporan harian memakai lingkupTimIds', /lingkupTimIds\(user, allUsers\)[\s\S]{0,200}authorId/.test(src));
cek('UsersView memakai lingkupTim', /const visible = lingkupTim\(user, allUsers\);/.test(src));
cek("UsersView merender kelompok 'wakil'", /\['manajer', 'leader', 'wakil', 'operasional'\]\.map/.test(src));
cek('form memakai peranBolehDibuat (bukan daftar peran manual)',
  /allowedRoles = useMemo\(\(\) => peranBolehDibuat\(currentUser\)/.test(src));
cek('form memakai calonAtasan + validasiAtasan', /calonAtasan\(form\.role/.test(src) && /validasiAtasan\(form\.role/.test(src));
cek('handleSave memeriksa ulang hak sebelum menulis',
  /peranBolehDibuat\(user\)\.includes\(data\.role\)/.test(src) && /bisaKelolaUser\(user, editing, allUsers\)/.test(src));
cek('handleSave memakai normalisasiAtasanId (bukan cek role manual)',
  (src.match(/normalisasiAtasanId\(data\.role, data\.leaderId\)/g) || []).length === 2);
cek('Pengaturan App menulis label peran dari ROLE_KEYS', /ROLE_KEYS\.map\(k =>/.test(src));
cek('TIDAK ada hardcode nama orang tertentu di App.jsx',
  !/Naima/i.test(src) && !/=== 'Naima'/.test(src));
cek('TIDAK ada hardcode email/username tertentu untuk otorisasi',
  !/username === '(naima|siti)/i.test(src));

console.log(`\n=============================================`);
console.log(`RINGKASAN: ${ok} LULUS, ${bad} GAGAL`);
console.log(`=============================================`);
process.exit(bad ? 1 : 0);
