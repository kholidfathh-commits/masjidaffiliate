// ============================================================================
// UJI TO-DO PER-RECORD — jalankan: node uji-todos.mjs
// ----------------------------------------------------------------------------
// BUKAN framework test dan TIDAK menambah dependency — satu file Node biasa.
// Database production tidak pernah disentuh (file ini hanya membaca teks App.jsx).
//
// Latar: modul To-Do dulu menyimpan to-do SEMUA orang dalam SATU baris
// ('todos:all'). Dua orang menulis berdekatan → yang belakangan menimpa yang
// pertama, diam-diam dan tanpa error. Perbaikannya: satu to-do = satu baris
// 'todos:rec:<id>', mengikuti pola loadTasks() yang sudah terbukti.
//
// Yang dijaga file ini:
//   A. REGISTRY — key 'todos:all' WAJIB tetap ada di BACKUP_KEYS dan terdaftar
//      di PER_RECORD_LOADERS + PER_RECORD_PREFIX. Repo ini sudah pernah kena
//      akibatnya pada kasus LMS: modul per-record yang lupa didaftarkan membuat
//      "Timpa Total" menghilangkan seluruh datanya.
//   B. TIDAK ADA LAGI penulisan seluruh daftar ('storage.set('todos:all'') —
//      inilah penjaga utama terhadap kembalinya bug saling-menimpa.
//   C. MIGRASI AMAN — arsip ditulis SEBELUM data lama dihapus.
//   D. IZIN & CAKUPAN tidak ikut berubah oleh perbaikan penyimpanan ini.
// ============================================================================
import fs from 'fs';

// Path RELATIF terhadap berkas ini — sengaja TIDAK meniru path absolut yang
// masih ada di uji-akses.mjs:3 dan uji-peran.mjs:18.
const src = fs.readFileSync(new URL('./src/App.jsx', import.meta.url), 'utf8');

let lulus = 0, gagal = 0;
const cek = (nama, syarat, detail) => {
  if (syarat) { lulus++; console.log('  LULUS  ', nama); }
  else { gagal++; console.log('  GAGAL  ', nama, detail !== undefined ? `\n           -> ${JSON.stringify(detail)}` : ''); }
};
const judul = (t) => console.log(`\n=== ${t} ===`);

// ---- Pengambil blok kode (dibaca LANGSUNG dari sumbernya, bukan salinan manual) ----
const blokKurung = (mulai, tutup) => {
  const i = src.indexOf(mulai);
  if (i < 0) return '';
  const j = src.indexOf(tutup, i);
  return j < 0 ? '' : src.slice(i, j + tutup.length);
};
const blokBackup = blokKurung('const BACKUP_KEYS = [', '\n];');
const blokLoader = blokKurung('const PER_RECORD_LOADERS = {', '\n};');
const blokPrefix = blokKurung('const PER_RECORD_PREFIX = {', '\n};');

// Badan fungsi loadTodos(): dari deklarasinya sampai penutup '\n}' pertama.
const blokLoadTodos = blokKurung('async function loadTodos()', '\n}');

// Badan komponen TodosView: dari deklarasinya sampai deklarasi top-level berikutnya.
const blokTodosView = (() => {
  const i = src.indexOf('function TodosView(');
  if (i < 0) return '';
  const j = src.indexOf('\nfunction ', i + 1);
  return j < 0 ? src.slice(i) : src.slice(i, j);
})();

judul('1. Konstanta prefix per-record');

cek('T-1. TODO_REC_PREFIX terdefinisi dan bernilai \'todos:rec:\'',
  /const TODO_REC_PREFIX = 'todos:rec:';/.test(src));

judul('2. Registry backup (aturan wajib repo — pelajaran dari kasus LMS)');

cek('T-2. \'todos:all\' MASIH ada di dalam blok BACKUP_KEYS (BR-1)',
  blokBackup.length > 0 && /'todos:all'/.test(blokBackup), blokBackup.slice(0, 160));

cek('T-3. \'todos:all\' terdaftar di blok PER_RECORD_LOADERS (BR-2)',
  blokLoader.length > 0 && /'todos:all':\s*loadTodos/.test(blokLoader), blokLoader.slice(0, 160));

cek('T-4. \'todos:all\' terdaftar di blok PER_RECORD_PREFIX (BR-3)',
  blokPrefix.length > 0 && /'todos:all':\s*TODO_REC_PREFIX/.test(blokPrefix), blokPrefix.slice(0, 160));

judul('3. Penjaga utama — tidak ada lagi penulisan seluruh daftar');

// Inilah uji yang paling penting. Selama satu baris pun masih menulis
// storage.set('todos:all', ...), bug saling-menimpa antar penulis masih hidup.
// Catatan: 'todos:all:archived-v2' TIDAK ikut tertangkap karena kutip penutupnya beda.
{
  const jejak = src.split('\n')
    .map((b, n) => ({ n: n + 1, b }))
    .filter(x => x.b.includes("storage.set('todos:all'"))
    .map(x => `App.jsx:${x.n}`);
  cek('T-5. TIDAK ada lagi storage.set(\'todos:all\' di mana pun di src/App.jsx',
    jejak.length === 0, jejak);
}

judul('4. Migrasi otomatis yang aman (pola loadTasks)');

cek('T-6a. loadTodos() ada dan membaca baris lewat listByPrefix (aturan wajib no. 5)',
  blokLoadTodos.length > 0 && /storage\.listByPrefix\(TODO_REC_PREFIX\)/.test(blokLoadTodos),
  blokLoadTodos.slice(0, 160));

cek('T-6b. loadTodos() menyerap data lama \'todos:all\' di dalam try/catch (gagal baca → null, tidak melempar)',
  /try \{ legacy = await storage\.get\('todos:all'\); \} catch \{ legacy = null; \}/.test(blokLoadTodos));

cek('T-6c. loadTodos() memindahkan item lama menjadi baris tersendiri',
  /storage\.set\(TODO_REC_PREFIX \+ item\.id, item\)/.test(blokLoadTodos));

// KEPUTUSAN MANAGER (11 Sep 2026): loadTodos() TIDAK mewarisi pola `allMigrated` milik
// loadTasks(). Pada pola lama, `item.id == null` bernilai TRUE sehingga item TANPA id
// justru dianggap "sudah beres" — 'todos:all' tetap dihapus dan item itu lenyap dari
// aplikasi (hanya tersisa di arsip yang tak pernah dibaca). Di sini migrasi harus
// FAIL-SAFE. 8 loader per-record lain SENGAJA tidak diubah (di luar scope).
cek('T-6d. TIDAK memakai pola allMigrated lama yang menganggap item tanpa id "sudah beres"',
  !/item\.id == null \|\| have\.has\(item\.id\)/.test(blokLoadTodos), blokLoadTodos.slice(0, 200));

// Urutan ini tidak boleh terbalik: kalau todos:all dihapus lebih dulu lalu penulisan
// arsip gagal, data lama hilang tanpa jejak.
{
  const iArsip = blokLoadTodos.indexOf("storage.set('todos:all:archived-v2'");
  const iHapus = blokLoadTodos.indexOf("storage.delete('todos:all')");
  cek('T-6e. Arsip \'todos:all:archived-v2\' ditulis SEBELUM storage.delete(\'todos:all\')',
    iArsip > -1 && iHapus > -1 && iArsip < iHapus, { iArsip, iHapus });
}

cek('T-6f. load() di TodosView memakai loadTodos(), bukan getList(\'todos:all\')',
  /const load = async \(\) => setTodos\(await loadTodos\(\)\);/.test(blokTodosView)
  && !/getList\('todos:all'\)/.test(blokTodosView));

judul('5. Tulis/hapus per baris — bukan seluruh daftar');

cek('T-6g. handleDelete() menghapus SATU baris todos:rec:<id>',
  /storage\.delete\(TODO_REC_PREFIX \+ todo\.id\)/.test(blokTodosView));

cek('T-6h. handleSave() menulis SATU baris todos:rec:<id>',
  /storage\.set\(TODO_REC_PREFIX \+ /.test(blokTodosView));

cek('T-6i. handleStatusChange() membaca-ulang baris itu lalu menulis SATU baris',
  /const handleStatusChange = async[\s\S]{0,700}storage\.get\(TODO_REC_PREFIX \+ todoId\)[\s\S]{0,500}storage\.set\(TODO_REC_PREFIX \+ todoId/.test(blokTodosView));

cek('T-6j. Penulisan gagal (storage.set → false) TIDAK dianggap berhasil',
  /const ok = await storage\.set\(TODO_REC_PREFIX/.test(blokTodosView)
  && /if \(!ok\)/.test(blokTodosView));

judul('6. Izin & cakupan TIDAK berubah (D-11, D-12, D-13)');

// Baris ini adalah satu-satunya sumber kebenaran izin ubah, dipakai UI DAN semua
// jalur tulis termasuk drag & drop. Harus tetap identik byte-per-byte.
cek('T-7. Baris bolehUbah masih ada PERSIS seperti semula (D-11)',
  src.includes('const bolehUbah = (todo) => !!todo && (todo.ownerId === user.id || isPengelola);'));

cek('T-7b. Cakupan visibilitas To-Do tidak berubah (D-12)',
  /const isPengelola = user\.role === 'owner' \|\| user\.role === 'manajer';/.test(blokTodosView)
  && /const visibleOwners = isPengelola \? allUsers : allUsers\.filter\(u => u\.id === user\.id\);/.test(blokTodosView)
  && /const visibleOwnerIds = new Set\(visibleOwners\.map\(u => u\.id\)\);/.test(blokTodosView)
  && /const dalamCakupan = isPengelola \? todos : todos\.filter\(t => t\.ownerId === user\.id\);/.test(blokTodosView));

cek('T-7c. ownerId tetap dipaksa berada dalam visibleOwnerIds',
  /const ownerId = visibleOwnerIds\.has\(data\.ownerId\) \? data\.ownerId : user\.id;/.test(blokTodosView));

// Menambah polling ke TodosView justru MENAIKKAN egress — berlawanan dengan
// tujuan paket ini (Scope A menurunkan polling, bukan menambahnya).
cek('T-8. TIDAK ada setInterval di dalam TodosView (D-13)',
  blokTodosView.length > 0 && !/setInterval/.test(blokTodosView));

judul('7. PERILAKU NYATA loadTodos() — dijalankan, bukan cuma dibaca regex');

// Uji regex saja tidak cukup untuk membuktikan "tidak ada data hilang". Blok kode
// loadTodos() diambil APA ADANYA dari src/App.jsx lalu DIJALANKAN terhadap storage
// tiruan di memori. Database production tidak pernah disentuh.
const kodeLoadTodos = (() => {
  const i = src.indexOf("const TODO_REC_PREFIX = 'todos:rec:';");
  const j = src.indexOf('\n}', src.indexOf('async function loadTodos()'));
  return i < 0 || j < 0 ? '' : src.slice(i, j + 2);
})();

// storage tiruan: Map di memori. gagalTulis = daftar key yang dipaksa gagal (set → false).
const storageTiruan = (baris, gagalTulis = []) => {
  const db = new Map(Object.entries(baris));
  return {
    db,
    async listByPrefix(p) { return [...db].filter(([k]) => k.startsWith(p)).map(([, v]) => v); },
    async get(k) { return db.has(k) ? db.get(k) : null; },
    async set(k, v) { if (gagalTulis.includes(k)) return false; db.set(k, v); return true; },
    async delete(k) { db.delete(k); return true; },
  };
};
const jalankan = (storage) => new Function('storage', `${kodeLoadTodos}\nreturn loadTodos;`)(storage)();

if (!kodeLoadTodos) {
  cek('P-0. Blok loadTodos() berhasil diambil dari src/App.jsx', false);
} else {
  // ---- P-1: legacy normal (semua punya id) → migrasi tuntas seperti rencana ----
  {
    const legacy = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
    const s = storageTiruan({ 'todos:all': legacy });
    const hasil = await jalankan(s);
    cek('P-1a. Legacy normal: kedua to-do terbaca', hasil.length === 2, hasil);
    cek('P-1b. Legacy normal: baris todos:rec:* dibuat', s.db.has('todos:rec:a') && s.db.has('todos:rec:b'));
    cek('P-1c. Legacy normal: todos:all DIHAPUS (migrasi tuntas)', !s.db.has('todos:all'));
    cek('P-1d. Legacy normal: arsip archived-v2 ada & isinya sama persis',
      JSON.stringify(s.db.get('todos:all:archived-v2')) === JSON.stringify(legacy));
  }

  // ---- P-2: idempoten — dijalankan berkali-kali tidak menduplikasi ----
  {
    const s = storageTiruan({ 'todos:all': [{ id: 'a' }, { id: 'b' }] });
    await jalankan(s);
    const hasil = await jalankan(s);
    cek('P-2. Idempoten: jalan kedua tetap 2 item, tidak duplikat', hasil.length === 2, hasil);
  }

  // ---- P-3: ADA item tanpa id → FAIL-SAFE (inti keputusan Manager) ----
  {
    const legacy = [{ id: 'a', title: 'Punya id' }, { title: 'TANPA id' }, { id: 'c', title: 'Punya id juga' }];
    const s = storageTiruan({ 'todos:all': legacy });
    const hasil = await jalankan(s);
    cek('P-3a. Item TANPA id tetap MUNCUL di hasil loadTodos()',
      hasil.some(t => t && t.id == null && t.title === 'TANPA id'), hasil);
    cek('P-3b. TIDAK ada data hilang: ketiga item lama tetap terbaca',
      hasil.length === 3 && ['Punya id', 'TANPA id', 'Punya id juga'].every(j => hasil.some(t => t && t.title === j)), hasil);
    cek('P-3c. todos:all TIDAK DIHAPUS saat ada item tanpa id', s.db.has('todos:all'));
    cek('P-3d. Arsip archived-v2 TIDAK ditulis (migrasi belum tuntas)', !s.db.has('todos:all:archived-v2'));
    cek('P-3e. Item yang punya id TETAP dipindah jadi baris (tidak ikut tertahan)',
      s.db.has('todos:rec:a') && s.db.has('todos:rec:c'));
  }

  // ---- P-4: fail-safe berulang — item tanpa id tidak hilang & tidak menggandakan ----
  {
    const s = storageTiruan({ 'todos:all': [{ id: 'a' }, { title: 'TANPA id' }] });
    await jalankan(s);
    const hasil = await jalankan(s);
    cek('P-4. Jalan kedua saat fail-safe: tetap 2 item, item tanpa id masih ada, tidak duplikat',
      hasil.length === 2 && hasil.filter(t => t && t.id == null).length === 1, hasil);
  }

  // ---- P-5: penulisan baris GAGAL → jangan anggap migrasi selesai ----
  {
    const s = storageTiruan({ 'todos:all': [{ id: 'a' }, { id: 'b' }] }, ['todos:rec:b']);
    const hasil = await jalankan(s);
    cek('P-5a. Tulis baris gagal: itemnya TETAP muncul di hasil (tidak hilang dari layar)',
      hasil.length === 2 && hasil.some(t => t && t.id === 'b'), hasil);
    cek('P-5b. Tulis baris gagal: todos:all TIDAK dihapus', s.db.has('todos:all'));
    cek('P-5c. Tulis baris gagal: arsip TIDAK ditulis', !s.db.has('todos:all:archived-v2'));
  }

  // ---- P-6: arsip gagal ditulis → todos:all WAJIB tetap ada ----
  {
    const s = storageTiruan({ 'todos:all': [{ id: 'a' }] }, ['todos:all:archived-v2']);
    await jalankan(s);
    cek('P-6. Arsip gagal ditulis → todos:all TIDAK BOLEH dihapus', s.db.has('todos:all'));
  }

  // ---- P-7: baris baru + legacy dibaca BERSAMA tanpa kehilangan data ----
  {
    const s = storageTiruan({
      'todos:rec:x': { id: 'x', title: 'Sudah per-record' },
      'todos:all': [{ id: 'a', title: 'Legacy ber-id' }, { title: 'Legacy tanpa id' }],
    });
    const hasil = await jalankan(s);
    cek('P-7. todos:rec:* dan legacy terbaca bersama, ketiganya utuh',
      hasil.length === 3 && ['Sudah per-record', 'Legacy ber-id', 'Legacy tanpa id'].every(j => hasil.some(t => t && t.title === j)), hasil);
  }

  // ---- P-8: gagal baca legacy → null, tidak melempar ----
  {
    const s = storageTiruan({ 'todos:rec:x': { id: 'x' } });
    s.get = async () => { throw new Error('koneksi putus'); };
    const hasil = await jalankan(s);
    cek('P-8. Gagal baca todos:all → tidak melempar, baris per-record tetap terbaca', hasil.length === 1, hasil);
  }

  // ---- P-9: tidak ada data lama sama sekali ----
  {
    const s = storageTiruan({});
    const hasil = await jalankan(s);
    cek('P-9. Tanpa data lama: hasil kosong & tidak menulis apa pun', hasil.length === 0 && s.db.size === 0);
  }

  // ---- P-10: slot kosong (null) di legacy tidak menggagalkan migrasi ----
  {
    const s = storageTiruan({ 'todos:all': [{ id: 'a' }, null] });
    const hasil = await jalankan(s);
    cek('P-10. Slot null diabaikan & migrasi tetap bisa tuntas (tak ada data yang hilang)',
      hasil.length === 1 && !s.db.has('todos:all'), hasil);
  }
}

// ============================================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`RINGKASAN: ${lulus} LULUS, ${gagal} GAGAL`);
console.log('='.repeat(60));
process.exit(gagal > 0 ? 1 : 0);
