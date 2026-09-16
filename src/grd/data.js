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
import { ROLE_KEYS, atasanId, pangkat, isManajemen, isPengawas, butuhAtasan, bawahanLangsung, idBawahanTransitif } from '../peran/hierarki.js';

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
 * Periode yang BENAR-BENAR punya goal, terbaru di atas.
 *
 * Gunanya: dropdown periode bawaan hanya menebak (6 bulan ke belakang, 2 ke
 * depan). Kalau tim mengisi goal untuk periode di luar rentang tebakan itu,
 * periodenya tidak akan pernah bisa dipilih. Daftar ini digabungkan dengan
 * tebakan supaya tidak ada periode berisi yang tersembunyi.
 */
export function periodeTersedia(goals) {
  const set = new Set();
  for (const g of (goals || []).map(normalisasiGoal)) {
    if (g && g.periode) set.add(g.periode);
  }
  return [...set].sort().reverse();
}

/** Tebakan dropdown + periode yang benar-benar terpakai, tanpa duplikat. */
export function pilihanPeriodeLengkap(jenis, acuan, goals) {
  const gabung = new Set(daftarPeriode(jenis, acuan));
  for (const p of periodeTersedia(goals)) {
    if (jenisPeriode(p) === jenis) gabung.add(p);
  }
  return [...gabung].sort().reverse();
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

/**
 * Kunci simpanan template yang DIUBAH tim.
 *
 * Sengaja SATU baris, bukan per-record seperti goal: template jarang diubah dan
 * hanya boleh diubah pengelola, jadi risiko dua orang menimpa bersamaan sangat
 * kecil — berbeda dengan goal yang ditulis banyak orang tiap hari. Bentuknya
 * seperti `app:settings`, dan karena itu WAJIB ikut BACKUP_KEYS.
 */
export const TEMPLATE_KEY = 'grd:templates';

/** Peran yang punya template. Diekspor ulang dari hierarki.js — SATU sumber daftar peran. */
export const ROLE_KEYS_GRD = ROLE_KEYS;

/** Bentuk satu template yang aman dipakai. null bila tidak layak dipakai sama sekali. */
export function normalisasiTemplate(t) {
  if (!t || typeof t !== 'object') return null;
  const base = angka(t.base, 0);
  const target = angka(t.target, 0);
  const description = String(t.description || '').trim();
  const uom = String(t.uom || '').trim();
  if (!description || !uom || base === target) return null;
  return { description, base, target, uom };
}

/**
 * Template BAWAAN digabung dengan yang diubah tim.
 *
 * Penggabungannya PER PERAN, bukan per item: peran yang pernah diatur memakai
 * daftar simpanan, peran yang belum pernah disentuh tetap memakai bawaan.
 * Dibuat begini supaya menambah peran baru di kode tidak menghapus template
 * yang sudah diatur tim, dan sebaliknya — simpanan rusak untuk satu peran tidak
 * menghilangkan template peran lain.
 */
export function gabungTemplate(tersimpan) {
  const hasil = {};
  for (const peran of ROLE_KEYS) {
    const dari = tersimpan && Array.isArray(tersimpan[peran]) ? tersimpan[peran] : null;
    const bersih = dari ? dari.map(normalisasiTemplate).filter(Boolean) : [];
    hasil[peran] = bersih.length ? bersih : (TEMPLATE_GOAL[peran] || TEMPLATE_GOAL.operasional);
  }
  return hasil;
}

/**
 * Template untuk sebuah peran. `tersimpan` opsional — tanpa itu memakai bawaan,
 * jadi pemanggil lama tetap jalan. Peran tak dikenal jatuh ke template karyawan.
 */
export function templateUntuk(peran, tersimpan) {
  if (tersimpan) {
    const gabung = gabungTemplate(tersimpan);
    return gabung[peran] || gabung.operasional;
  }
  return TEMPLATE_GOAL[peran] || TEMPLATE_GOAL.operasional;
}

/**
 * Apakah template peran ini sudah DIUBAH tim (bukan lagi bawaan)?
 * Simpanan yang isinya rusak semua dianggap belum diubah — karena yang benar-
 * benar dipakai tetap template bawaan, dan menandainya "diubah" akan
 * menyesatkan pengelola.
 */
export function templateDiubah(tersimpan, peran) {
  const d = tersimpan && tersimpan[peran];
  if (!Array.isArray(d)) return false;
  return d.map(normalisasiTemplate).filter(Boolean).length > 0;
}

/**
 * Ringkasan template untuk halaman pengelolaan: satu baris per peran, lengkap
 * dengan penanda apakah sudah diubah tim atau masih bawaan.
 * Urutannya mengikuti ROLE_KEYS (Owner di atas), bukan urutan objek simpanan —
 * supaya daftarnya tidak berubah-ubah susunannya.
 */
export function ringkasTemplate(tersimpan) {
  const gabung = gabungTemplate(tersimpan);
  return ROLE_KEYS.map(peran => ({
    peran,
    daftar: gabung[peran],
    jumlah: gabung[peran].length,
    diubah: templateDiubah(tersimpan, peran),
  }));
}

/** Pesan kesalahan pertama saat menyimpan template sebuah peran, atau '' bila sah. */
export function validasiDaftarTemplate(daftar) {
  if (!Array.isArray(daftar)) return 'Daftar template tidak terbaca.';
  if (daftar.length === 0) return 'Isi minimal satu template, atau kosongkan untuk kembali ke bawaan.';
  for (let i = 0; i < daftar.length; i++) {
    const t = daftar[i];
    if (!String(t && t.description || '').trim()) return `Template ke-${i + 1}: deskripsi wajib diisi.`;
    if (!String(t && t.uom || '').trim()) return `Template ke-${i + 1}: satuan wajib diisi.`;
    if (angka(t && t.base, 0) === angka(t && t.target, 0)) {
      return `Template ke-${i + 1}: target tidak boleh sama dengan base.`;
    }
  }
  return '';
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
export const fieldJejakDikenal = (f) => Object.prototype.hasOwnProperty.call(FIELD_JEJAK, String(f || ''));

/**
 * BENTUK SATU BARIS JEJAK — satu tempat yang menyatakan apa isi sebuah baris.
 *
 * `sejak` menandai versi berapa sebuah field mulai ada, supaya baris lama bisa
 * DIKENALI saat nanti ada field baru, bukan dibaca sebagai kosong.
 *
 * KUNCI BARIS = `grdjejak:rec:<goalId>:<field>:<waktu>`. Goal ditaruh di DEPAN
 * supaya riwayat satu goal bisa ditarik lewat satu prefix — jejak tidak pernah
 * dipangkas (ia bukti audit), jadi membaca SELURUH jejak tim hanya untuk membuka
 * satu panel akan makin berat tiap bulan.
 */
export const SKEMA_JEJAK = {
  id:       { wajib: true,  jenis: 'teks',  sejak: 1 },
  goalId:   { wajib: true,  jenis: 'teks',  sejak: 1 },
  field:    { wajib: true,  jenis: 'field', sejak: 1 },
  dari:     { wajib: false, jenis: 'bebas', sejak: 1 },
  ke:       { wajib: false, jenis: 'bebas', sejak: 1 },
  olehId:   { wajib: false, jenis: 'teks',  sejak: 1 },
  olehNama: { wajib: true,  jenis: 'teks',  sejak: 1 },
  waktu:    { wajib: true,  jenis: 'waktu', sejak: 1 },
};

/**
 * Field wajib yang HILANG dari sebuah baris jejak — kosong berarti bentuknya utuh.
 *
 * `olehId` SENGAJA tidak wajib: baris yang dibuat proses otomatis atau oleh akun
 * yang sudah terhapus tetap sah sebagai bukti. Tapi `olehNama` WAJIB — jejak
 * tanpa "siapa" tidak menjawab pertanyaan yang membuat jejak itu ada.
 */
export function fieldHilangJejak(j) {
  const wajib = Object.keys(SKEMA_JEJAK).filter(k => SKEMA_JEJAK[k].wajib);
  if (!j || typeof j !== 'object') return wajib;
  return wajib.filter(k => {
    const v = j[k];
    if (SKEMA_JEJAK[k].jenis === 'field') return !fieldJejakDikenal(v);
    if (SKEMA_JEJAK[k].jenis === 'waktu') {
      return !v || Number.isNaN(new Date(v).getTime());
    }
    return v === undefined || v === null || v === '';
  });
}

/** Baris jejak yang bentuknya tidak utuh — tidak bisa dipercaya sebagai bukti. */
export const jejakRusak = (j) => fieldHilangJejak(j).length > 0;

/**
 * Jejak yang goalnya sudah TIDAK ADA lagi.
 *
 * Menghapus goal SENGAJA tidak menghapus jejaknya — jejak justru paling berharga
 * tepat saat goalnya hilang, karena ia satu-satunya yang bisa menjawab "dulu
 * targetnya berapa, dan siapa yang mengubahnya sebelum dihapus?". Masalahnya:
 * setiap tampilan berangkat dari daftar goal, jadi baris itu ada tapi tak pernah
 * terlihat. Dilaporkan terpisah supaya tidak hilang diam-diam.
 */
export function jejakYatim(jejak, goals) {
  const ada = new Set((goals || []).map(g => g && g.id).filter(Boolean));
  return (jejak || []).filter(j => j && j.goalId && !ada.has(j.goalId));
}
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
  // BENTUK ID = <goalId>:<field>:<waktu>. Goal di depan supaya riwayat satu goal
  // bisa ditarik lewat satu prefix (lihat prefixJejakGoal).
  //
  // BATASNYA, ditulis terus terang: resolusinya milidetik, jadi DUA perubahan
  // pada FIELD YANG SAMA di milidetik yang sama akan memakai kunci yang sama dan
  // yang belakangan menimpa yang duluan. Lewat layar itu mustahil — manusia tidak
  // bisa menyimpan dua kali dalam semilidetik — tapi penulisan programatik (mis.
  // skrip impor atau percobaan-ulang otomatis) bisa. Kalau suatu hari ada jalur
  // seperti itu, id ini yang harus ditambah pembeda, bukan gejalanya yang ditambal.
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

/**
 * Prefix baris jejak MILIK SATU GOAL.
 *
 * Bentuk kunci jejak adalah `grdjejak:rec:<goalId>:<field>:<waktu>`, jadi
 * riwayat satu goal bisa ditarik dengan satu prefix — tidak perlu membaca
 * SELURUH jejak seluruh tim hanya untuk membuka satu panel detail. Ini penting:
 * jejak tidak pernah dipangkas (ia bukti audit), jadi jumlahnya hanya bertambah,
 * dan egress Supabase di project ini pernah kehabisan kuota.
 *
 * Id goal yang dibuat aplikasi tidak pernah memuat ':' — pemanggil tetap
 * menyaring ulang berdasarkan `goalId` sebagai jaring pengaman untuk data lama
 * atau hasil impor yang bentuknya tidak terduga.
 */
export function prefixJejakGoal(goalId) {
  const id = String(goalId || '');
  return id ? `${JEJAK_REC_PREFIX}${id}:` : '';
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

/**
 * JEJAK LINTAS GOAL — bahan halaman "Jejak Perubahan Angka".
 *
 * Bedanya dengan `riwayatGoal`: yang itu menjawab "apa yang terjadi pada goal
 * INI", yang ini menjawab "angka apa saja yang berubah akhir-akhir ini, oleh
 * siapa". Pertanyaan kedua tidak bisa dijawab dengan membuka goal satu per satu.
 *
 * GERBANG-nya adalah daftar `goals` yang dioper pemanggil: hanya jejak milik
 * goal yang ADA di daftar itu yang lolos. Jadi kalau pemanggil mengoper goal
 * yang boleh dilihat saja, jejak cabang lain mustahil bocor lewat sini —
 * aturannya tidak ditulis ulang di sini, dan karena itu tidak bisa menyimpang.
 *
 * `hanyaAngka` menyala secara BAWAAN. Nama halamannya "Jejak Perubahan Angka",
 * dan perubahan judul/pemilik ikut bercampur akan menenggelamkan justru yang
 * dicari orang saat membuka halaman ini.
 */
export function jejakLintasGoal(jejak, goals, allUsers, {
  periode = '', olehId = '', goalId = '', hanyaAngka = true, kata = '', batas = 300,
} = {}) {
  const dalamLingkup = (goals || []).map(normalisasiGoal).filter(Boolean);
  const dipakai = periode ? goalPeriode(dalamLingkup, periode) : dalamLingkup;
  const perGoal = new Map(dipakai.map(g => [g.id, g]));

  let hasil = (jejak || []).filter(j => j && j.goalId && perGoal.has(j.goalId));
  if (goalId) hasil = hasil.filter(j => j.goalId === goalId);
  if (olehId) hasil = hasil.filter(j => j.olehId === olehId);
  if (hanyaAngka) hasil = hasil.filter(j => fieldJejakAngka(j.field));

  const k = String(kata || '').trim().toLowerCase();
  if (k) {
    hasil = hasil.filter(j => {
      const g = perGoal.get(j.goalId);
      return [g && g.description, j.olehNama, labelFieldJejak(j.field)]
        .filter(Boolean).join(' ').toLowerCase().includes(k);
    });
  }

  // TERBARU DI ATAS. Urutan kedua memakai id supaya dua perubahan pada detik
  // yang sama tidak bertukar tempat antar-render.
  hasil = hasil.slice().sort((x, y) => {
    const w = String(y.waktu || '').localeCompare(String(x.waktu || ''));
    return w !== 0 ? w : String(y.id || '').localeCompare(String(x.id || ''));
  });

  const total = hasil.length;
  const dipotong = total > batas;
  return {
    hasil: dipotong ? hasil.slice(0, batas) : hasil,
    total,
    dipotong,
    // Siapa saja yang pernah mengubah — untuk mengisi filter tanpa menebak.
    pengubah: [...new Map(
      (jejak || [])
        .filter(j => j && perGoal.has(j.goalId) && j.olehId)
        .map(j => [j.olehId, { id: j.olehId, nama: j.olehNama || namaOrang(j.olehId, allUsers) }])
    ).values()].sort((a, b) => String(a.nama).localeCompare(String(b.nama))),
  };
}

/** Nama orang dari daftar user; jatuh ke id kalau akunnya sudah dihapus. */
function namaOrang(id, allUsers) {
  const u = (allUsers || []).find(x => x && x.id === id);
  return (u && u.name) || 'Akun terhapus';
}

/**
 * RINGKASAN pergerakan angka pada sekumpulan jejak — "naik berapa kali, turun
 * berapa kali". Penting karena target yang DITURUNKAN diam-diam adalah salah
 * satu hal yang paling ingin diketahui dari sebuah jejak audit.
 */
/**
 * Arah satu baris jejak: 'naik' | 'turun' | 'tetap' | '' (bukan perubahan angka).
 *
 * SATU tempat, dipakai ringkasan di atas DAN penanda di layar — kalau dua-duanya
 * punya rumus sendiri, angka ringkasan bisa berkata "1 turun" sementara barisnya
 * tidak bertanda apa pun, dan tidak ada yang tahu mana yang benar.
 *
 * `Number(null)` itu 0, dan itu jebakan: baris yang nilai lamanya memang TIDAK
 * ADA akan terbaca "naik dari 0" — klaim yang tidak didukung datanya.
 */
export function arahJejak(j) {
  if (!j || !fieldJejakAngka(j.field)) return '';
  const angka = (v) => (v === null || v === undefined || v === '') ? NaN : Number(v);
  const a = angka(j.dari), b = angka(j.ke);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'tetap';
  return b > a ? 'naik' : b < a ? 'turun' : 'tetap';
}

export function ringkasJejakAngka(barisJejak) {
  let naik = 0, turun = 0, tetap = 0;
  for (const j of barisJejak || []) {
    const arah = arahJejak(j);
    if (arah === 'naik') naik += 1;
    else if (arah === 'turun') turun += 1;
    else if (arah === 'tetap') tetap += 1;
  }
  return { naik, turun, tetap, total: naik + turun + tetap };
}

/**
 * PENCARIAN GOAL sebagai DAFTAR DATAR (bukan pohon).
 *
 * Pelengkap `saringPohon`, bukan penggantinya. Dua bentuk dibutuhkan karena dua
 * pertanyaan yang berbeda:
 *   · saringPohon  — "di mana orang ini di dalam struktur?" (jalur ke atas dijaga)
 *   · cariGoalDatar — "goal apa saja yang menyebut kata ini?" (semua sejajar)
 * Halaman Kelola Goal memakai yang kedua; di sana struktur justru mengganggu.
 *
 * Urutannya deterministik: periode terbaru dulu, lalu yang capaiannya paling
 * tertinggal, lalu abjad — jadi hasil pencarian tidak pernah berubah urutan
 * antar-render untuk data yang sama.
 */
export function cariGoalDatar(goals, allUsers, { kata = '', divisi = 'all', periode = '', ownerId = '' } = {}) {
  const k = String(kata || '').trim().toLowerCase();
  let hasil = (goals || []).map(normalisasiGoal).filter(Boolean);

  if (periode) hasil = goalPeriode(hasil, periode);
  if (ownerId) hasil = hasil.filter(g => g.ownerId === ownerId);

  if (divisi && divisi !== 'all') {
    hasil = hasil.filter(g => {
      const u = pemilikGoal(g, allUsers);
      return !!u && u.division === divisi;
    });
  }

  if (k) {
    hasil = hasil.filter(g => {
      const u = pemilikGoal(g, allUsers);
      return [g.description, g.uom, u && u.name, u && u.jobTitle, u && u.division]
        .filter(Boolean).join(' ').toLowerCase().includes(k);
    });
  }

  return hasil.sort((a, b) => {
    if (a.periode !== b.periode) return b.periode.localeCompare(a.periode);
    const beda = persenCapaian(a) - persenCapaian(b);
    if (beda !== 0) return beda;
    return a.description.localeCompare(b.description);
  });
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
export function bangunPohonGoal({ users = [], goals = [], periode = '', batasKedalaman = 10, bolehLihat = null } = {}) {
  const daftar = (users || []).filter(u => u && u.id);
  const adaId = new Set(daftar.map(u => u.id));

  // `bolehLihat` opsional: goal yang tidak lolos TIDAK dibuang diam-diam, tapi
  // DIHITUNG sebagai `tersembunyi` pada simpulnya. Tanpa itu, orang yang goalnya
  // disembunyikan akan tampil seolah "belum punya goal" — keliru dan menyesatkan.
  const perPemilik = new Map();
  const disembunyikan = new Map();
  for (const g of goalPeriode(goals, periode)) {
    if (!g.ownerId) continue;
    if (bolehLihat && !bolehLihat(g)) {
      disembunyikan.set(g.ownerId, (disembunyikan.get(g.ownerId) || 0) + 1);
      continue;
    }
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
    return {
      user: u, level, anak,
      goals: perPemilik.get(u.id) || [],
      tersembunyi: disembunyikan.get(u.id) || 0,
      menggantung: !atasanSah(u, daftar),
    };
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

/**
 * ATURAN TULIS GRD — satu rumus, dipakai goal, lead measure, dan skor mingguan.
 *
 * "Boleh mengubah" berarti: pemiliknya sendiri, ATAU seseorang di atasnya dalam
 * rantai atasan langsung (berjenjang, bukan cuma satu lapis), ATAU Owner/Manajer.
 *
 * Kenapa BERJENJANG, bukan atasan langsung saja: seorang Leader bertanggung
 * jawab atas seluruh timnya, termasuk staf yang berada di bawah Co-Leader-nya.
 * Kalau dibatasi satu lapis, goal staf jadi tidak bisa disentuh Leader ketika
 * Co-Leader-nya berhalangan — dan itu bertentangan dengan `lingkupTim` yang
 * sudah dipakai seluruh app (absensi, tiket, laporan).
 *
 * Perbedaan langsung vs berjenjang TETAP dibedakan di penjelasannya
 * (`alasanUbahGoal`), supaya orang tahu dari mana wewenangnya datang.
 *
 * Fungsi ini sengaja diekspor supaya modul lead & scoreboard memakainya
 * kembali — kalau masing-masing menulis rumusnya sendiri, cepat atau lambat
 * ketiganya menyimpang dan "siapa boleh apa" jadi berbeda per halaman.
 */
export function bolehTulisMilik(user, ownerId, allUsers) {
  if (!user || !ownerId) return false;
  if (isManajemen(user)) return true;
  if (ownerId === user.id) return true;
  return idBawahanTransitif(user.id, allUsers).has(ownerId);
}

/** Boleh mengubah/menghapus goal ini? Pemilik sendiri, atau atasannya (berjenjang). */
export function bisaUbahGoal(user, goal, allUsers) {
  if (!user || !goal) return false;
  // Pemilik diperiksa SEBELUM pintasan Owner/Manajer — bukan sesudahnya.
  // Goal tanpa pemilik adalah data rusak: `validasiGoal` menolak menyimpannya,
  // jadi mengizinkan siapa pun mengubahnya tidak ada gunanya. Urutan ini juga
  // menjaga jawabannya SAMA PERSIS dengan `alasanUbahGoal` yang dipakai halaman
  // Kontrol Akses — kalau berbeda, layar dan layanan saling membantah.
  const g = normalisasiGoal(goal);
  if (!g || !g.ownerId) return false;
  return bolehTulisMilik(user, g.ownerId, allUsers);
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

/**
 * Rantai ATASAN ke atas: atasan langsung, atasannya, dan seterusnya.
 * Aman terhadap data melingkar (dibatasi kedalaman + set "sudah dikunjungi").
 */
export function idAtasanKeAtas(userId, allUsers, batasKedalaman = 10) {
  const hasil = new Set();
  if (!userId) return hasil;
  const cari = (id) => (allUsers || []).find(u => u && u.id === id);
  let kini = cari(userId);
  for (let d = 0; d < batasKedalaman && kini; d++) {
    const pid = atasanId(kini);
    if (!pid || hasil.has(pid) || pid === userId) break;
    hasil.add(pid);
    kini = cari(pid);
  }
  return hasil;
}

/**
 * Boleh MELIHAT isi goal ini?
 *
 * Aturannya sengaja BUKAN "hanya goal sendiri". Roll down baru bermakna kalau
 * orang bisa melihat ke ATAS — tanpa itu, staf melihat targetnya sendiri tanpa
 * pernah tahu itu turunan dari goal siapa, dan "roll down" tinggal nama.
 *
 * Jadi yang terlihat: goal sendiri + goal seluruh bawahan (untuk mengawasi)
 * + goal seluruh atasan ke atas (untuk memahami asal-usul targetnya).
 * Yang TIDAK terlihat: goal orang di cabang lain yang sejajar — itu bukan
 * urusannya, dan menyembunyikannya tidak merusak makna roll down.
 *
 * Catatan: STRUKTUR pohon (siapa atasan siapa) tetap terlihat semua orang.
 * Yang disembunyikan isi goalnya, bukan keberadaan orangnya.
 */
export function bisaLihatGoal(user, goal, allUsers) {
  if (!user) return false;
  // Pemilik diperiksa lebih dulu — alasannya sama dengan bisaUbahGoal di atas.
  const g = normalisasiGoal(goal);
  if (!g || !g.ownerId) return false;
  if (isManajemen(user)) return true;
  if (g.ownerId === user.id) return true;
  if (idBawahanTransitif(user.id, allUsers).has(g.ownerId)) return true;
  return idAtasanKeAtas(user.id, allUsers).has(g.ownerId);
}

/** Penjelasan untuk halaman Kontrol Akses — bentuk sama dengan alasanUbahGoal. */
export function alasanLihatGoal(user, goal, allUsers) {
  if (!user) return { boleh: false, alasan: 'Tidak ada pengguna.' };
  const g = normalisasiGoal(goal);
  if (!g || !g.ownerId) return { boleh: false, alasan: 'Goal tidak punya pemilik.' };
  if (isManajemen(user)) return { boleh: true, alasan: 'Owner/Manajer melihat seluruh organisasi.' };
  if (g.ownerId === user.id) return { boleh: true, alasan: 'Goal miliknya sendiri.' };
  if (idBawahanTransitif(user.id, allUsers).has(g.ownerId)) {
    return { boleh: true, alasan: 'Pemiliknya bawahannya.' };
  }
  if (idAtasanKeAtas(user.id, allUsers).has(g.ownerId)) {
    return { boleh: true, alasan: 'Pemiliknya atasannya — supaya jelas goalnya turunan dari mana.' };
  }
  return { boleh: false, alasan: 'Pemiliknya di cabang lain yang sejajar.' };
}

/** Goal yang boleh dilihat `user` saja. */
export function goalYangBisaDilihat(user, goals, allUsers) {
  return (goals || []).map(normalisasiGoal).filter(Boolean)
    .filter(g => bisaLihatGoal(user, g, allUsers));
}

/**
 * KENAPA seseorang boleh / tidak boleh mengubah sebuah goal.
 *
 * Bukan sekadar true/false: halaman Kontrol Akses harus bisa MENJELASKAN
 * jawabannya, supaya pengelola bisa memeriksa aturan tanpa membaca kode dan
 * tanpa menebak. Alasan yang sama juga dipakai pesan penolakan di layanan.
 */
export function alasanUbahGoal(user, goal, allUsers) {
  if (!user) return { boleh: false, alasan: 'Tidak ada pengguna.' };
  const g = normalisasiGoal(goal);
  if (!g || !g.ownerId) return { boleh: false, alasan: 'Goal tidak punya pemilik.' };

  if (isManajemen(user)) {
    return { boleh: true, alasan: 'Owner/Manajer berwenang atas seluruh goal.' };
  }
  if (g.ownerId === user.id) {
    return { boleh: true, alasan: 'Goal miliknya sendiri.' };
  }
  const bawahan = idBawahanTransitif(user.id, allUsers);
  if (bawahan.has(g.ownerId)) {
    const pemilik = pemilikGoal(g, allUsers);
    const langsung = atasanId(pemilik) === user.id;
    return {
      boleh: true,
      alasan: langsung ? 'Pemiliknya bawahan langsung.' : 'Pemiliknya bawahan berjenjang.',
    };
  }
  return { boleh: false, alasan: 'Pemiliknya bukan dirinya sendiri maupun bawahannya.' };
}

/**
 * Ringkasan hak seorang anggota atas data GRD — dipakai baris tabel Kontrol Akses.
 * `lingkup` menjawab "sejauh mana ia melihat": seluruh organisasi, timnya, atau
 * hanya dirinya. Nilainya diturunkan dari peran lewat hierarki.js, tidak dihitung
 * ulang di sini.
 */
export function ringkasAksesUser(user, allUsers, goals) {
  const semua = (goals || []).map(normalisasiGoal).filter(Boolean);
  const bisaUbah = semua.filter(g => bisaUbahGoal(user, g, allUsers));
  return {
    user,
    lingkup: isManajemen(user) ? 'semua' : isPengawas(user) ? 'tim' : 'diri',
    totalGoal: semua.length,
    jumlahBisaUbah: bisaUbah.length,
    goalSendiri: semua.filter(g => g.ownerId === (user && user.id)).length,
    jumlahBisaBuatUntuk: calonPemilikGoal(user, allUsers).length,
    jumlahBawahan: idBawahanTransitif(user && user.id, allUsers).size,
  };
}

export const LINGKUP_AKSES = {
  semua: { label: 'Seluruh organisasi', color: 'bg-violet-100 text-violet-800' },
  tim:   { label: 'Dirinya + timnya',   color: 'bg-blue-100 text-blue-800' },
  diri:  { label: 'Dirinya sendiri',    color: 'bg-slate-100 text-slate-700' },
};
export const gayaLingkup = (l) => LINGKUP_AKSES[l] || LINGKUP_AKSES.diri;

/**
 * Apa yang SEBENARNYA dilihat seorang anggota — dipakai pratinjau di halaman
 * Kontrol Akses supaya aturannya bisa dibuktikan, bukan hanya dibaca.
 *
 * Read-only: menghitung dan menjelaskan, tidak pernah dipakai untuk bertindak
 * atas nama orang lain.
 */
export function pratinjauAkses(user, allUsers, goals) {
  const semua = (goals || []).map(normalisasiGoal).filter(Boolean);
  const terlihat = semua.filter(g => bisaLihatGoal(user, g, allUsers));
  const pemilikTerlihat = new Set(terlihat.map(g => g.ownerId));
  return {
    totalGoal: semua.length,
    terlihat: terlihat.length,
    tersembunyi: semua.length - terlihat.length,
    bisaUbah: semua.filter(g => bisaUbahGoal(user, g, allUsers)).length,
    orangTerlihat: (allUsers || []).filter(u => u && pemilikTerlihat.has(u.id)),
    // Orang yang PUNYA goal tapi goalnya tidak terlihat oleh `user`.
    orangTersembunyi: (allUsers || []).filter(u => u && u.id
      && semua.some(g => g.ownerId === u.id)
      && !pemilikTerlihat.has(u.id)),
  };
}

/**
 * IZIN ATAS SATU GOAL, dalam satu panggilan.
 *
 * Komponen tadinya memanggil tiga-empat fungsi izin terpisah untuk objek yang
 * sama, dan gampang memakai yang keliru (mis. memeriksa `bisaUbahGoal` untuk
 * tombol yang sebenarnya butuh `bisaBuatGoalUntuk`). Satu objek izin membuat
 * salahnya kelihatan: `izin.turunkan` tidak mungkin tertukar dengan `izin.ubah`.
 *
 * Ini BUKAN pengganti pemeriksaan di layanan — layanan tetap memeriksa ulang
 * sebelum menulis. Ini untuk menentukan apa yang ditampilkan.
 */
export function izinGoal(user, goal, allUsers) {
  const g = normalisasiGoal(goal);
  if (!user || !g || !g.ownerId) {
    return { lihat: false, ubah: false, hapus: false, turunkan: false, alasanUbah: 'Data tidak lengkap.' };
  }
  const ubah = bisaUbahGoal(user, g, allUsers);
  return {
    lihat: bisaLihatGoal(user, g, allUsers),
    ubah,
    // Hapus mengikuti ubah — memisahkannya akan membuat orang bisa mengubah
    // goal sampai kosong tanpa boleh menghapusnya, yang tidak ada gunanya.
    hapus: ubah,
    // Turunkan butuh dua hal: wewenang ATAS goalnya, DAN pemiliknya punya bawahan.
    turunkan: ubah && bawahanLangsung(g.ownerId, allUsers).length > 0,
    alasanUbah: alasanUbahGoal(user, g, allUsers).alasan,
    alasanLihat: alasanLihatGoal(user, g, allUsers).alasan,
  };
}

/** Tabel hak akses seluruh anggota — urut pangkat lalu nama, supaya stabil. */
export function matriksAkses(allUsers, goals) {
  return (allUsers || []).filter(u => u && u.id)
    .map(u => ringkasAksesUser(u, allUsers, goals))
    .sort((a, b) => urutkanOrang(a.user, b.user));
}

/** Boleh membuat goal ATAS NAMA orang ini? (dipakai tombol "turunkan ke bawahan"). */
export function bisaBuatGoalUntuk(user, targetUserId, allUsers) {
  return bolehTulisMilik(user, targetUserId, allUsers);
}
