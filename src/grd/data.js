// ============================================================================
// GRD — GOAL ROLL DOWN (Tahap 1) — fungsi MURNI (tanpa React/JSX/storage)
// supaya bisa diuji lewat `node uji-grd.mjs` tanpa menjalankan aplikasi.
// ----------------------------------------------------------------------------
// ATURAN: TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
// Pola ini sama persis dengan src/tiket/urutan.js, src/absensi/logika.js,
// src/catatan/data.js dan src/sampel/data.js.
//
// ISTILAH (WAJIB, sudah disepakati): Goal, Goal Roll Down, Lead Measure,
// Scoreboard, Komitmen Mingguan. DILARANG memakai objective/key result/OKR.
//
// KENAPA POHONNYA TIDAK 5 LEVEL HARDCODE:
//   Struktur organisasi Al-Kahfi berubah (Leader → Co-Leader → Karyawan, dan
//   bisa bertambah lapis lagi). Pohon roll down di sini DITURUNKAN dari data
//   atasan langsung yang sudah ada (`leaderId`, dibaca lewat `atasanId()` milik
//   src/peran/hierarki.js) — jadi promosi jabatan cukup mengubah DATA, pohonnya
//   ikut sendiri. Rumus "siapa bawahan siapa" TIDAK disalin ulang ke sini.
// ============================================================================

import { wibDayKey } from '../absensi/logika.js';
import { atasanId, pangkat, isManajemen, isPengawas, butuhAtasan, bawahanLangsung, idBawahanTransitif } from '../peran/hierarki.js';

// ====== KUNCI PENYIMPANAN ======
// PER-RECORD (1 baris = 1 goal) supaya dua orang yang menyimpan bersamaan tidak
// saling menimpa — pelajaran dari modul tiket/absensi/catatan.
export const GOAL_BACKUP_KEY = 'grd:goals:all';
export const GOAL_REC_PREFIX = 'grdgoal:rec:';

// ====== UTILITAS ANGKA ======
// Semua angka goal lewat sini: nilai kosong/rusak/teks jadi angka yang aman,
// supaya tidak pernah ada NaN/Infinity yang bocor ke tampilan.
const angka = (v, fallback = 0) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

// ============================================================================
// PERIODE — menyimpan BULAN (YYYY-MM) DAN KUARTAL (YYYY-Qn)
// Keduanya dipakai berdampingan: goal perusahaan biasanya kuartalan, goal staf
// bulanan. Karena itu periode disimpan sebagai TEKS dengan dua bentuk sah.
// ============================================================================
const RE_BULAN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const RE_KUARTAL = /^(\d{4})-Q([1-4])$/;

export const JENIS_PERIODE = {
  bulan:   { label: 'Bulanan',   sub: 'Periode satu bulan (YYYY-MM)' },
  kuartal: { label: 'Kuartalan', sub: 'Periode tiga bulan (YYYY-Qn)' },
};
export const JENIS_PERIODE_DEFAULT = 'bulan';

const BULAN_LABEL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const KUARTAL_BULAN = { 1: 'Jan–Mar', 2: 'Apr–Jun', 3: 'Jul–Sep', 4: 'Okt–Des' };

/** Rapikan tulisan periode: buang spasi, huruf q kecil jadi Q. '' bila tidak sah. */
export function normalisasiPeriode(p) {
  const s = String(p == null ? '' : p).trim().toUpperCase();
  if (RE_BULAN.test(s) || RE_KUARTAL.test(s)) return s;
  return '';
}

/** 'bulan' | 'kuartal' | null (bila bukan periode yang sah). */
export function jenisPeriode(p) {
  const s = normalisasiPeriode(p);
  if (RE_BULAN.test(s)) return 'bulan';
  if (RE_KUARTAL.test(s)) return 'kuartal';
  return null;
}

export const periodeValid = (p) => jenisPeriode(p) !== null;

/** Nomor kuartal (1–4) dari nomor bulan (1–12). 0 bila bulan tidak masuk akal. */
export function kuartalDariBulan(bulan) {
  const b = angka(bulan, 0);
  if (b < 1 || b > 12) return 0;
  return Math.floor((b - 1) / 3) + 1;
}

/**
 * Periode yang sedang berjalan MENURUT WIB — bukan menurut jam perangkat
 * pengguna. Kalau tidak begini, anggota tim yang perangkatnya di zona lain bisa
 * melihat bulan/kuartal yang berbeda dari rekannya.
 */
export function periodeSaatIni(jenis = JENIS_PERIODE_DEFAULT, acuan = wibDayKey()) {
  const dk = String(acuan || wibDayKey());
  const tahun = dk.slice(0, 4);
  const bulan = dk.slice(5, 7);
  if (jenis === 'kuartal') return `${tahun}-Q${kuartalDariBulan(Number(bulan))}`;
  return `${tahun}-${bulan}`;
}

/** Label manusiawi: '2026-09' → 'September 2026'; '2026-Q3' → 'Kuartal 3 2026 (Jul–Sep)'. */
export function labelPeriode(p) {
  const s = normalisasiPeriode(p);
  if (!s) return '—';
  const jenis = jenisPeriode(s);
  const tahun = s.slice(0, 4);
  if (jenis === 'kuartal') {
    const q = Number(s.slice(6, 7));
    return `Kuartal ${q} ${tahun} (${KUARTAL_BULAN[q]})`;
  }
  return `${BULAN_LABEL[Number(s.slice(5, 7)) - 1]} ${tahun}`;
}

/** Label pendek untuk badge/kartu: 'Sep 2026' atau 'Q3 2026'. */
export function labelPeriodeSingkat(p) {
  const s = normalisasiPeriode(p);
  if (!s) return '—';
  const tahun = s.slice(0, 4);
  if (jenisPeriode(s) === 'kuartal') return `Q${s.slice(6, 7)} ${tahun}`;
  return `${BULAN_LABEL[Number(s.slice(5, 7)) - 1].slice(0, 3)} ${tahun}`;
}

/**
 * Geser periode n langkah (negatif = mundur). Satu langkah = satu bulan untuk
 * periode bulanan, satu kuartal untuk periode kuartalan.
 * Perpindahan tahun ditangani lewat hitungan total bulan/kuartal, bukan dengan
 * objek Date — supaya hasilnya tidak pernah bergeser gara-gara zona waktu.
 */
export function geserPeriode(p, n = 0) {
  const s = normalisasiPeriode(p);
  const jenis = jenisPeriode(s);
  if (!jenis) return '';
  const tahun = Number(s.slice(0, 4));
  const langkah = Math.trunc(angka(n, 0));
  if (jenis === 'kuartal') {
    const total = tahun * 4 + (Number(s.slice(6, 7)) - 1) + langkah;
    if (total < 0) return s;
    return `${Math.floor(total / 4)}-Q${(total % 4) + 1}`;
  }
  const total = tahun * 12 + (Number(s.slice(5, 7)) - 1) + langkah;
  if (total < 0) return s;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Pilihan periode untuk dropdown — TERBARU DI ATAS, sama seperti urutan default
 * halaman Tiket. Diberi sedikit periode ke depan supaya goal bisa disiapkan
 * sebelum periodenya berjalan.
 */
export function daftarPeriode(jenis = JENIS_PERIODE_DEFAULT, acuan = '', mundur = 6, maju = 2) {
  const dasar = normalisasiPeriode(acuan) || periodeSaatIni(jenis);
  const keluar = [];
  for (let i = Math.trunc(maju); i >= -Math.trunc(mundur); i--) {
    const p = geserPeriode(dasar, i);
    if (p && !keluar.includes(p)) keluar.push(p);
  }
  return keluar;
}

/**
 * Pindah jenis periode TANPA melompat ke hari ini: September 2026 ⇄ Kuartal 3
 * 2026. Kalau tidak begini, pengguna yang sedang menelaah periode lama akan
 * terlempar ke periode berjalan hanya karena menekan tombol Kuartalan.
 */
export function konversiPeriode(p, jenisBaru) {
  const s = normalisasiPeriode(p);
  const lama = jenisPeriode(s);
  const tujuan = JENIS_PERIODE[jenisBaru] ? jenisBaru : JENIS_PERIODE_DEFAULT;
  if (!lama) return periodeSaatIni(tujuan);
  if (lama === tujuan) return s;
  const tahun = s.slice(0, 4);
  if (tujuan === 'kuartal') return `${tahun}-Q${kuartalDariBulan(Number(s.slice(5, 7)))}`;
  const bulanPertama = (Number(s.slice(6, 7)) - 1) * 3 + 1;
  return `${tahun}-${String(bulanPertama).padStart(2, '0')}`;
}

/**
 * Apakah periode bulan `b` berada DI DALAM kuartal `k`?
 * Dipakai supaya goal bulanan staf tetap terlihat menempel pada goal kuartalan
 * perusahaan — tanpa ini, pohon roll down terputus tiap ganti jenis periode.
 */
export function bulanDalamKuartal(bulanP, kuartalP) {
  const b = normalisasiPeriode(bulanP);
  const k = normalisasiPeriode(kuartalP);
  if (jenisPeriode(b) !== 'bulan' || jenisPeriode(k) !== 'kuartal') return false;
  if (b.slice(0, 4) !== k.slice(0, 4)) return false;
  return kuartalDariBulan(Number(b.slice(5, 7))) === Number(k.slice(6, 7));
}

/** Dua periode dianggap sepadan bila sama persis, atau bulan yang berada di kuartal itu. */
export function periodeSepadan(a, b) {
  const x = normalisasiPeriode(a);
  const y = normalisasiPeriode(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return bulanDalamKuartal(x, y) || bulanDalamKuartal(y, x);
}

// ============================================================================
// GOAL
// ============================================================================

/** Satuan yang sering dipakai — sekadar saran untuk dropdown, bukan pembatas. */
export const UOM_UMUM = ['Rupiah', 'Persen', 'Orang', 'Konten', 'Video', 'Tiket', 'Sesi', 'Produk', 'Akun', 'Hari'];

/**
 * TEMPLATE GOAL PER PERAN — contoh goal siap pakai.
 *
 * Alasannya praktis: mengisi goal dari nol itu berat, dan goal yang ditulis
 * buru-buru biasanya berupa KEGIATAN ("rajin bikin konten"), bukan HASIL yang
 * bisa diukur. Template memberi contoh berbentuk hasil dengan satuan yang jelas,
 * jadi pengguna tinggal menyesuaikan angkanya.
 *
 * Angka di sini sengaja angka yang wajar, BUKAN target resmi — pemilik goal
 * tetap harus menyesuaikan sebelum menyimpan.
 */
export const TEMPLATE_GOAL = {
  owner: [
    { description: 'GMV seluruh Al-Kahfi Corp', base: 0, target: 12, uom: 'Miliar Rupiah' },
    { description: 'Affiliator aktif produktif', base: 0, target: 30, uom: 'Orang' },
    { description: 'Divisi dengan laporan mingguan lengkap', base: 0, target: 7, uom: 'Divisi' },
  ],
  manajer: [
    { description: 'GMV divisi yang dikelola', base: 0, target: 3, uom: 'Miliar Rupiah' },
    { description: 'Ketepatan laporan mingguan tim', base: 60, target: 95, uom: 'Persen' },
    { description: 'Anggota tim lulus kelas wajib', base: 0, target: 10, uom: 'Orang' },
  ],
  leader: [
    { description: 'GMV tim', base: 0, target: 900, uom: 'Juta Rupiah' },
    { description: 'Anggota tim lulus kelas wajib', base: 0, target: 8, uom: 'Orang' },
    { description: 'Tiket tim selesai sebelum tenggat', base: 70, target: 95, uom: 'Persen' },
  ],
  wakil: [
    { description: 'Sesi pendampingan anggota tim', base: 0, target: 12, uom: 'Sesi' },
    { description: 'Anggota tim mengisi laporan harian', base: 70, target: 95, uom: 'Persen' },
    { description: 'Anggota tim baru selesai masa adaptasi', base: 0, target: 3, uom: 'Orang' },
  ],
  operasional: [
    { description: 'Konten affiliate tayang', base: 0, target: 30, uom: 'Konten' },
    { description: 'Sampel produk terpakai', base: 0, target: 10, uom: 'Produk' },
    { description: 'Sesi live', base: 0, target: 12, uom: 'Sesi' },
    { description: 'Kehadiran tepat waktu', base: 80, target: 100, uom: 'Persen' },
  ],
};

/** Template untuk sebuah peran — peran tak dikenal jatuh ke template karyawan. */
export function templateUntuk(peran) {
  return TEMPLATE_GOAL[peran] || TEMPLATE_GOAL.operasional;
}

/**
 * Template + pemilik + periode = calon goal yang siap diperiksa `validasiGoal`.
 * Template TIDAK pernah langsung tersimpan; ia hanya mengisi form.
 */
export function terapkanTemplate(template, { ownerId = '', periode = '', parentId = null } = {}) {
  const t = template || {};
  return normalisasiGoal({
    description: t.description || '',
    base: t.base,
    target: t.target,
    uom: t.uom || '',
    actual: t.base,
    ownerId,
    periode,
    parentId,
  });
}

/** Isian WAJIB menurut kesepakatan: description, base, target, uom. Sisanya opsional. */
export const FIELD_WAJIB = ['description', 'base', 'target', 'uom'];

/**
 * Bentuk goal yang aman dipakai tampilan: angka pasti angka, teks pasti teks,
 * `actual` yang belum pernah diisi jatuh ke `base` (artinya "belum bergerak").
 * Record lama yang fieldnya kurang TIDAK boleh membuat halaman rusak.
 */
export function normalisasiGoal(g) {
  if (!g || typeof g !== 'object') return null;
  const base = angka(g.base, 0);
  const target = angka(g.target, 0);
  const adaActual = g.actual !== null && g.actual !== undefined && g.actual !== '';
  return {
    ...g,
    id: String(g.id || ''),
    ownerId: String(g.ownerId || ''),
    parentId: g.parentId ? String(g.parentId) : null,
    periode: normalisasiPeriode(g.periode),
    description: String(g.description || '').trim(),
    uom: String(g.uom || '').trim(),
    base,
    target,
    actual: adaActual ? angka(g.actual, base) : base,
  };
}

/** Pesan kesalahan pertama, atau '' bila isian sudah lengkap. */
export function validasiGoal(g) {
  const n = normalisasiGoal(g);
  if (!n) return 'Data goal tidak terbaca.';
  if (!n.description) return 'Deskripsi goal wajib diisi.';
  if (!n.uom) return 'Satuan (uom) wajib diisi.';
  if (!n.ownerId) return 'Goal harus punya pemilik.';
  if (!n.periode) return 'Periode wajib berupa bulan (YYYY-MM) atau kuartal (YYYY-Qn).';
  if (!Number.isFinite(n.base)) return 'Angka base tidak sah.';
  if (!Number.isFinite(n.target)) return 'Angka target tidak sah.';
  if (n.base === n.target) return 'Target tidak boleh sama dengan base — tidak ada yang diukur.';
  return '';
}

/**
 * Persen capaian: sejauh mana `actual` bergerak dari `base` menuju `target`.
 *
 * AMAN SAAT PEMBAGI NOL — ini syarat non-fungsional PRD. Kalau base === target
 * tidak ada jarak yang bisa dibagi, jadi hasilnya tegas 100 (bila sudah sampai)
 * atau 0, BUKAN NaN/Infinity yang akan tampil sebagai "NaN%" di kartu goal.
 *
 * Rumus ini juga benar untuk goal yang MENURUN (mis. "tekan biaya dari 10jt ke
 * 8jt"): jaraknya negatif di kedua sisi, jadi persennya tetap positif.
 */
export function persenCapaian(g) {
  const n = normalisasiGoal(g);
  if (!n) return 0;
  const rentang = n.target - n.base;
  if (rentang === 0) return n.actual >= n.target ? 100 : 0;
  const p = ((n.actual - n.base) / rentang) * 100;
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.round(p));
}

/** Lebar bar progres (0–100) — capaian di atas 100% tetap ditahan agar bar tidak meluber. */
export const persenBar = (g) => Math.min(100, persenCapaian(g));

export const STATUS_CAPAIAN = {
  tercapai: { label: 'Tercapai', color: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  jalan:    { label: 'Berjalan', color: 'bg-blue-100 text-blue-700',       bar: 'bg-blue-500',    dot: 'bg-blue-500' },
  belum:    { label: 'Belum jalan', color: 'bg-slate-100 text-slate-600',  bar: 'bg-slate-300',   dot: 'bg-slate-400' },
};

export function statusCapaian(g) {
  const p = persenCapaian(g);
  if (p >= 100) return 'tercapai';
  if (p > 0) return 'jalan';
  return 'belum';
}

/** Selalu ada isinya — status tak dikenal jatuh ke 'belum' (jangan akses langsung). */
export const gayaStatus = (s) => STATUS_CAPAIAN[s] || STATUS_CAPAIAN.belum;

/**
 * Berapa lagi yang masih harus ditempuh sampai target, dalam satuan goal.
 * Dikembalikan sebagai jarak (selalu >= 0) supaya kalimatnya sama untuk goal
 * yang NAIK maupun yang MENURUN: "kurang X lagi". 0 = sudah tercapai.
 */
export function sisaMenujuTarget(g) {
  const n = normalisasiGoal(g);
  if (!n) return 0;
  if (persenCapaian(n) >= 100) return 0;
  const sisa = Math.abs(n.target - n.actual);
  return Number.isFinite(sisa) ? sisa : 0;
}

/** Pemilik goal sebagai objek anggota (null bila akunnya sudah tidak ada). */
export function pemilikGoal(g, allUsers) {
  const n = normalisasiGoal(g);
  if (!n || !n.ownerId) return null;
  return (allUsers || []).find(u => u && u.id === n.ownerId) || null;
}

/**
 * Goal INDUK — goal atasan yang menurunkan goal ini. Inilah yang membuat
 * "roll down" bisa ditelusuri ke atas dari panel detail.
 */
export function goalInduk(g, daftarGoal) {
  const n = normalisasiGoal(g);
  if (!n || !n.parentId) return null;
  return (daftarGoal || []).map(normalisasiGoal)
    .find(x => x && x.id === n.parentId) || null;
}

/** Goal TURUNAN — goal bawahan yang diturunkan dari goal ini (menelusuri ke bawah). */
export function goalTurunan(g, daftarGoal) {
  const n = normalisasiGoal(g);
  if (!n || !n.id) return [];
  return (daftarGoal || []).map(normalisasiGoal)
    .filter(x => x && x.parentId === n.id);
}

/** Goal milik satu periode. Periode kosong = semua goal (dipakai saat memuat awal). */
export function goalPeriode(goals, periode) {
  const p = normalisasiPeriode(periode);
  const bersih = (goals || []).map(normalisasiGoal).filter(Boolean);
  if (!p) return bersih;
  return bersih.filter(g => periodeSepadan(g.periode, p));
}

// ============================================================================
// TURUNKAN GOAL KE BAWAHAN (sekali klik)
// ============================================================================

/**
 * Satuan yang TIDAK masuk akal dibagi rata ke beberapa orang.
 * Persen 95% milik seorang Leader tidak menjadi 31,7% untuk tiap anggotanya —
 * tiap orang tetap harus mencapai 95%. Angka yang bisa dijumlah (Rupiah, Konten,
 * Orang) justru sebaliknya.
 */
const UOM_TAK_DIBAGI = ['persen', '%', 'rasio', 'skor', 'nilai', 'indeks', 'rating'];
export function satuanBisaDibagi(uom) {
  const u = String(uom || '').toLowerCase();
  return !UOM_TAK_DIBAGI.some(x => u.includes(x));
}

/** Bawahan LANGSUNG dari pemilik goal — satu lapis, mengikuti data atasan langsung. */
export function bawahanUntukTurunan(goal, allUsers) {
  const n = normalisasiGoal(goal);
  if (!n || !n.ownerId) return [];
  return bawahanLangsung(n.ownerId, allUsers);
}

/**
 * Rencana goal turunan untuk SELURUH bawahan langsung — inilah isi "sekali klik".
 *
 * Tiga hal yang membuatnya aman dipakai berkali-kali:
 *   1. Bawahan yang SUDAH punya turunan dari goal ini dilewati (tidak dobel).
 *   2. Target dibagi rata hanya bila satuannya memang bisa dijumlah; kalau tidak
 *      (persen, skor), tiap bawahan mewarisi target yang sama.
 *   3. Hasilnya hanya RENCANA — belum tersimpan, jadi bisa ditinjau dulu.
 */
export function rencanaTurunan(goal, allUsers, { bagiRata, goalAda = [] } = {}) {
  const n = normalisasiGoal(goal);
  if (!n || !n.id) return [];

  const sudahPunya = new Set(
    (goalAda || []).map(normalisasiGoal).filter(Boolean)
      .filter(g => g.parentId === n.id).map(g => g.ownerId)
  );
  const anak = bawahanUntukTurunan(n, allUsers).filter(u => !sudahPunya.has(u.id));
  if (anak.length === 0) return [];

  const dibagi = bagiRata === undefined ? satuanBisaDibagi(n.uom) : !!bagiRata;
  const jarak = n.target - n.base;
  return anak.map(u => terapkanTemplate({
    description: n.description,
    base: n.base,
    target: dibagi ? Math.round((n.base + jarak / anak.length) * 100) / 100 : n.target,
    uom: n.uom,
  }, { ownerId: u.id, periode: n.periode, parentId: n.id }));
}

/**
 * Apa yang ikut terdampak kalau goal ini dihapus.
 *
 * Menghapus goal induk memutus rantai roll down: goal turunannya tidak ikut
 * terhapus, tapi jadi menggantung tanpa induk. Angka ini dipakai untuk
 * memberi tahu SEBELUM tombol hapus ditekan, bukan sesudahnya.
 *
 * Aman terhadap rantai melingkar (dibatasi kedalaman + set "sudah dihitung").
 */
export function dampakHapusGoal(goal, daftarGoal, batasKedalaman = 10) {
  const n = normalisasiGoal(goal);
  const kosong = { langsung: 0, total: 0, idTurunan: [] };
  if (!n || !n.id) return kosong;

  const semua = (daftarGoal || []).map(normalisasiGoal).filter(g => g && g.id && g.id !== n.id);
  const langsung = semua.filter(g => g.parentId === n.id);
  const kumpul = new Set(langsung.map(g => g.id));
  let lapis = new Set(kumpul);

  for (let d = 0; d < batasKedalaman && lapis.size > 0; d++) {
    const berikut = new Set();
    for (const g of semua) {
      if (kumpul.has(g.id)) continue;
      if (g.parentId && lapis.has(g.parentId)) { kumpul.add(g.id); berikut.add(g.id); }
    }
    lapis = berikut;
  }
  return { langsung: langsung.length, total: kumpul.size, idTurunan: [...kumpul] };
}

// ============================================================================
// JEJAK PERUBAHAN ANGKA (siapa, kapan, dari berapa ke berapa)
// ============================================================================

/** Kunci penyimpanan jejak — per-record, sama alasannya dengan goal. */
export const JEJAK_BACKUP_KEY = 'grd:jejak:all';
export const JEJAK_REC_PREFIX = 'grdjejak:rec:';

/**
 * Field yang perubahannya dicatat. `angka: true` menandai yang berupa bilangan
 * supaya tampilan bisa memformatnya (dan supaya "jejak perubahan ANGKA" bisa
 * disaring dari perubahan teks biasa).
 */
export const FIELD_JEJAK = {
  _dibuat:     { label: 'Goal dibuat',    angka: false },
  base:        { label: 'Base',           angka: true },
  target:      { label: 'Target',         angka: true },
  actual:      { label: 'Angka terkini',  angka: true },
  uom:         { label: 'Satuan',         angka: false },
  description: { label: 'Deskripsi',      angka: false },
  periode:     { label: 'Periode',        angka: false },
  ownerId:     { label: 'Pemilik',        angka: false },
};
export const labelFieldJejak = (f) => (FIELD_JEJAK[f] || { label: f }).label;
export const fieldJejakAngka = (f) => !!(FIELD_JEJAK[f] || {}).angka;

/**
 * Bandingkan goal SEBELUM dan SESUDAH, hasilkan catatan perubahannya.
 *
 * Dicatat di sini — bukan di dalam komponen — supaya jejaknya sama persis dari
 * mana pun perubahan datang: form, tombol turunkan, atau nanti impor massal.
 * Goal yang baru dibuat menghasilkan SATU catatan '_dibuat', bukan satu catatan
 * per field (kalau tidak, riwayat goal baru langsung penuh tujuh baris kosong).
 */
export function catatPerubahan(goalLama, goalBaru, oleh, waktu = new Date().toISOString()) {
  const b = normalisasiGoal(goalBaru);
  if (!b || !b.id) return [];
  const olehId = (oleh && oleh.id) || '';
  const olehNama = (oleh && oleh.name) || 'Tidak diketahui';
  const buat = (field, dari, ke) => ({
    id: `${b.id}:${field}:${waktu}`,
    goalId: b.id, field, dari, ke, olehId, olehNama, waktu,
  });

  const a = normalisasiGoal(goalLama);
  if (!a) return [buat('_dibuat', null, b.target)];

  const keluar = [];
  for (const f of Object.keys(FIELD_JEJAK)) {
    if (f === '_dibuat') continue;
    if (a[f] === b[f]) continue;
    keluar.push(buat(f, a[f], b[f]));
  }
  return keluar;
}

/** Riwayat satu goal — TERBARU DI ATAS. */
export function riwayatGoal(jejak, goalId) {
  if (!goalId) return [];
  return (jejak || []).filter(j => j && j.goalId === goalId)
    .slice()
    .sort((x, y) => String(y.waktu || '').localeCompare(String(x.waktu || '')));
}

/** Hanya perubahan ANGKA (base/target/actual) — inti "jejak perubahan angka". */
export function riwayatAngka(jejak, goalId) {
  return riwayatGoal(jejak, goalId).filter(j => fieldJejakAngka(j.field));
}

// ============================================================================
// POHON ROLL DOWN
// ============================================================================

/**
 * Apakah data ATASAN LANGSUNG orang ini masih sah?
 *
 * Kenapa perlu diperiksa: pohon roll down dibangun dari field `leaderId`, dan
 * field itu TIDAK ikut berubah saat atasannya turun jabatan atau akunnya dihapus.
 * Orang seperti itu akan terlihat normal di pohon padahal jalur pertanggungjawaban
 * goalnya sudah putus — justru kondisi yang paling perlu kelihatan.
 *
 * Sah = memang tidak butuh atasan (Owner/Manajer/Leader), ATAU atasannya masih ada
 * dan masih berwenang mengawasi. Aturan "siapa berwenang" diambil dari
 * src/peran/hierarki.js, tidak ditulis ulang di sini.
 */
export function atasanSah(u, allUsers) {
  if (!u) return false;
  if (!butuhAtasan(u.role)) return true;
  const pid = atasanId(u);
  if (!pid) return false;
  const atasan = (allUsers || []).find(x => x && x.id === pid);
  if (!atasan) return false;
  return isPengawas(atasan) || isManajemen(atasan);
}

/** Atasan dulu, lalu nama — supaya urutan pohon stabil (tidak berubah tiap render). */
function urutkanOrang(a, b) {
  const beda = pangkat(b) - pangkat(a);
  if (beda !== 0) return beda;
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

/**
 * Susun pohon roll down dari perusahaan sampai staf.
 *
 * Bentuk tiap simpul: { user, level, goals, anak }
 *
 * Akar = orang yang atasannya tidak ada di daftar (owner/manajer). Kedalaman
 * dibatasi dan tiap orang hanya dipakai sekali, jadi data melingkar (A atasan B,
 * B atasan A) TIDAK membuat halaman menggantung — orang yang tersisa karena
 * lingkaran diangkat jadi akar tambahan supaya tidak ada yang hilang dari pohon.
 */
export function bangunPohonGoal({ users = [], goals = [], periode = '', batasKedalaman = 10 } = {}) {
  const daftar = (users || []).filter(u => u && u.id);
  const adaId = new Set(daftar.map(u => u.id));

  const perPemilik = new Map();
  for (const g of goalPeriode(goals, periode)) {
    if (!g.ownerId) continue;
    if (!perPemilik.has(g.ownerId)) perPemilik.set(g.ownerId, []);
    perPemilik.get(g.ownerId).push(g);
  }

  const anakDari = new Map();
  const akar = [];
  for (const u of daftar) {
    const pid = atasanId(u);
    if (pid && pid !== u.id && adaId.has(pid)) {
      if (!anakDari.has(pid)) anakDari.set(pid, []);
      anakDari.get(pid).push(u);
    } else akar.push(u);
  }

  const sudah = new Set();
  const bangun = (u, level) => {
    sudah.add(u.id);
    const anak = level >= batasKedalaman ? []
      : (anakDari.get(u.id) || []).filter(a => !sudah.has(a.id)).sort(urutkanOrang)
          .map(a => bangun(a, level + 1));
    return { user: u, level, goals: perPemilik.get(u.id) || [], anak, menggantung: !atasanSah(u, daftar) };
  };

  const hasil = akar.sort(urutkanOrang).map(u => bangun(u, 0));
  // Sisa orang yang terjebak lingkaran — diangkat jadi akar supaya tetap terlihat.
  for (const u of daftar) if (!sudah.has(u.id)) hasil.push(bangun(u, 0));
  return hasil;
}

/**
 * RANTAI GOAL — pohon yang simpulnya GOAL, bukan orang.
 *
 * Bedanya dengan `bangunPohonGoal`: yang itu menyusun ORANG menurut atasan
 * langsung lalu menggantungkan goal pada pemiliknya; yang ini menyusun GOAL
 * menurut `parentId` — goal atasan di atas, goal turunannya di bawah. Dua sudut
 * pandang untuk data yang sama: "siapa punya goal apa" vs "goal ini turunan
 * dari goal mana".
 *
 * Bentuk simpul: { goal, level, anak }
 *
 * Goal yang induknya tidak ada di daftar (mis. induknya milik orang yang tidak
 * boleh kita lihat) diperlakukan sebagai akar — supaya tidak ada goal yang
 * hilang hanya karena rantainya terpotong oleh hak akses.
 */
export function rantaiGoal(goals, batasKedalaman = 10) {
  const bersih = (goals || []).map(normalisasiGoal).filter(g => g && g.id);
  const adaId = new Set(bersih.map(g => g.id));

  const anakDari = new Map();
  const akar = [];
  for (const g of bersih) {
    const pid = g.parentId && g.parentId !== g.id && adaId.has(g.parentId) ? g.parentId : null;
    if (pid) {
      if (!anakDari.has(pid)) anakDari.set(pid, []);
      anakDari.get(pid).push(g);
    } else akar.push(g);
  }

  const sudah = new Set();
  const bangun = (g, level) => {
    sudah.add(g.id);
    const anak = level >= batasKedalaman ? []
      : (anakDari.get(g.id) || []).filter(x => !sudah.has(x.id))
          .sort((a, b) => a.description.localeCompare(b.description))
          .map(x => bangun(x, level + 1));
    return { goal: g, level, anak };
  };

  const hasil = akar
    .sort((a, b) => a.description.localeCompare(b.description))
    .map(g => bangun(g, 0));
  // Goal yang terjebak rantai melingkar tetap ditampilkan sebagai akar.
  for (const g of bersih) if (!sudah.has(g.id)) hasil.push(bangun(g, 0));
  return hasil;
}

/** Rantai goal → daftar datar (urutan tampil). */
export function ratakanRantai(rantai) {
  const keluar = [];
  const jalan = (s) => { keluar.push(s); (s.anak || []).forEach(jalan); };
  (rantai || []).forEach(jalan);
  return keluar;
}

/** Pohon → daftar datar (urutan tampil, atas ke bawah). Dipakai untuk hitung & cari. */
export function ratakanPohon(pohon) {
  const keluar = [];
  const jalan = (simpul) => { keluar.push(simpul); (simpul.anak || []).forEach(jalan); };
  (pohon || []).forEach(jalan);
  return keluar;
}

/** Semua goal di dalam pohon (sudah ternormalisasi). */
export function semuaGoal(pohon) {
  return ratakanPohon(pohon).flatMap(s => s.goals || []);
}

/** Angka ringkasan untuk kepala halaman. Rata-rata capaian aman saat goal kosong. */
export function ringkasPohon(pohon) {
  const simpul = ratakanPohon(pohon);
  const goals = semuaGoal(pohon);
  const hitung = { tercapai: 0, jalan: 0, belum: 0 };
  let jumlahPersen = 0;
  for (const g of goals) {
    hitung[statusCapaian(g)] += 1;
    jumlahPersen += persenCapaian(g);
  }
  return {
    orang: simpul.length,
    orangBergoal: simpul.filter(s => (s.goals || []).length > 0).length,
    totalGoal: goals.length,
    ...hitung,
    rataCapaian: goals.length ? Math.round(jumlahPersen / goals.length) : 0,
  };
}

/**
 * PENCARIAN DI DALAM POHON — per nama orang, divisi, jabatan, atau kata di goal.
 *
 * Yang membuatnya beda dari filter daftar biasa: JALUR KE ATAS DIPERTAHANKAN.
 * Kalau seorang staf cocok, atasan-atasannya tetap ikut tampil sebagai konteks —
 * tanpa itu hasil pencarian kehilangan makna "roll down" (kita jadi tidak tahu
 * goal itu turunan dari siapa).
 *
 * Simpul yang BENAR-BENAR cocok ditandai `cocok: true`; yang ikut tampil hanya
 * sebagai jalur bertanda `cocok: false`, supaya tampilan bisa menyorot yang tepat.
 */
export function saringPohon(pohon, { kata = '', divisi = 'all' } = {}) {
  const k = String(kata || '').trim().toLowerCase();
  const pakaiDivisi = !!divisi && divisi !== 'all';
  if (!k && !pakaiDivisi) {
    // Tanpa filter: tandai semua cocok supaya bentuk datanya tetap sama.
    const polos = (s) => ({ ...s, cocok: true, anak: (s.anak || []).map(polos) });
    return (pohon || []).map(polos);
  }

  const cocokSimpul = (s) => {
    const u = s.user || {};
    if (pakaiDivisi && u.division !== divisi) return false;
    if (!k) return true;
    const teks = [
      u.name, u.jobTitle, u.division, u.role,
      ...(s.goals || []).map(g => g.description),
      ...(s.goals || []).map(g => g.uom),
    ].filter(Boolean).join(' ').toLowerCase();
    return teks.includes(k);
  };

  const jalan = (s) => {
    const anak = (s.anak || []).map(jalan).filter(Boolean);
    const aku = cocokSimpul(s);
    if (!aku && anak.length === 0) return null;
    return { ...s, cocok: aku, anak };
  };
  return (pohon || []).map(jalan).filter(Boolean);
}

/** Berapa simpul yang BENAR-BENAR cocok (tidak menghitung jalur konteks). */
export function hitungCocok(pohon) {
  return ratakanPohon(pohon).filter(s => s && s.cocok).length;
}

/** Simpul yang jalur atasannya sudah putus — dipakai untuk peringatan di atas pohon. */
export function simpulMenggantung(pohon) {
  return ratakanPohon(pohon).filter(s => s && s.menggantung);
}

/** Jumlah goal pada satu simpul TERMASUK seluruh keturunannya (badge "12 goal di bawah"). */
export function hitungGoalCabang(simpul) {
  if (!simpul) return 0;
  return (simpul.goals || []).length
    + (simpul.anak || []).reduce((t, a) => t + hitungGoalCabang(a), 0);
}

/**
 * Ringkasan SATU cabang (orang ini + seluruh keturunannya). Dipakai simpul pohon
 * untuk memberi tahu apa yang tersembunyi saat cabangnya dilipat — tanpa ini,
 * melipat cabang berarti kehilangan informasi sama sekali.
 * Rata capaian aman saat cabang belum punya goal (0, bukan NaN).
 */
export function ringkasCabang(simpul) {
  if (!simpul) return { orang: 0, bawahan: 0, goal: 0, tercapai: 0, jalan: 0, belum: 0, rataCapaian: 0 };
  const r = ringkasPohon([simpul]);
  return {
    orang: r.orang,
    bawahan: r.orang - 1,
    goal: r.totalGoal,
    tercapai: r.tercapai,
    jalan: r.jalan,
    belum: r.belum,
    rataCapaian: r.rataCapaian,
  };
}

/**
 * Id simpul yang PUNYA anak, mulai dari kedalaman tertentu.
 * `mulaiLevel = 0` → semua cabang (tombol "Lipat semua").
 * `mulaiLevel = 2` → cabang dalam saja; dipakai sebagai lipatan BAWAAN supaya
 * pohon organisasi yang besar tidak membanjiri layar saat halaman dibuka.
 */
export function idCabang(pohon, mulaiLevel = 0) {
  return ratakanPohon(pohon)
    .filter(s => (s.anak || []).length > 0 && s.level >= mulaiLevel)
    .map(s => s.user.id);
}

/** Jumlah orang pada satu cabang, termasuk dirinya. */
export function hitungOrangCabang(simpul) {
  if (!simpul) return 0;
  return 1 + (simpul.anak || []).reduce((t, a) => t + hitungOrangCabang(a), 0);
}

// ============================================================================
// HAK AKSES
// ----------------------------------------------------------------------------
// Tahap 1 sengaja memisahkan LIHAT dan UBAH:
//   · LIHAT  — seluruh pohon terbuka. Itu inti "roll down": staf harus bisa
//              melihat goal perusahaan supaya tahu goalnya turunan dari mana.
//   · UBAH   — hanya pemilik goal dan ATASANNYA (transitif), lewat hierarki.js.
// Penegakannya masih di frontend (sama seperti seluruh app ini); pagar
// sesungguhnya menyusul di Tahap 2 lewat modul layanan tipis + Supabase RLS.
// ============================================================================

/** Boleh mengubah/menghapus goal ini? Pemilik sendiri, atau atasannya (berjenjang). */
export function bisaUbahGoal(user, goal, allUsers) {
  if (!user || !goal) return false;
  if (isManajemen(user)) return true;
  const g = normalisasiGoal(goal);
  if (!g || !g.ownerId) return false;
  if (g.ownerId === user.id) return true;
  return idBawahanTransitif(user.id, allUsers).has(g.ownerId);
}

/**
 * Goal yang boleh DIKELOLA (ubah/hapus) oleh seseorang — goalnya sendiri plus
 * goal seluruh bawahannya. Inilah isi halaman Kelola Goal, dan sengaja dihitung
 * di satu tempat supaya halaman tidak pernah menampilkan goal yang tombol
 * simpannya nanti ditolak.
 */
export function goalYangBisaDikelola(user, goals, allUsers) {
  if (!user) return [];
  return (goals || []).map(normalisasiGoal).filter(Boolean)
    .filter(g => bisaUbahGoal(user, g, allUsers));
}

/** Orang-orang yang boleh dibuatkan goal oleh `user` (dirinya + seluruh bawahan). */
export function calonPemilikGoal(user, allUsers) {
  if (!user) return [];
  return (allUsers || []).filter(u => u && u.id && bisaBuatGoalUntuk(user, u.id, allUsers));
}

/** Boleh membuat goal ATAS NAMA orang ini? (dipakai tombol "turunkan ke bawahan"). */
export function bisaBuatGoalUntuk(user, targetUserId, allUsers) {
  if (!user || !targetUserId) return false;
  if (isManajemen(user)) return true;
  if (targetUserId === user.id) return true;
  return idBawahanTransitif(user.id, allUsers).has(targetUserId);
}
