// ============================================================================
// GRD — SCOREBOARD MINGGUAN — fungsi MURNI (tanpa React/JSX/storage).
// ----------------------------------------------------------------------------
// ATURAN: TIDAK BOLEH meng-import App.jsx. Diuji lewat `node uji-grd.mjs`.
//
// ISTILAH (WAJIB): Scoreboard, Komitmen Mingguan, menang/kalah.
//
// KENAPA MINGGUAN, DAN KENAPA MENANG/KALAH:
//   Goal diukur di akhir periode — terlambat untuk diperbaiki. Lead measure
//   diisi MINGGUAN supaya koreksinya masih sempat. Dan hasilnya sengaja dibaca
//   sebagai MENANG atau KALAH, bukan persentase: angka 73% membuat orang
//   berdebat apakah itu bagus; "kalah minggu ini" tidak bisa ditawar dan
//   langsung memancing pertanyaan "apa yang berubah minggu depan?".
//
// KUNCI MINGGU = TANGGAL SENIN-nya (YYYY-MM-DD), bukan nomor pekan ISO.
//   Nomor pekan ISO punya kasus tepi yang membingungkan (pekan ke-53, pekan
//   yang menyeberang tahun) dan tidak bisa dibaca manusia tanpa dihitung dulu.
//   Tanggal Senin selalu tidak ambigu, mudah diurutkan sebagai teks, dan
//   langsung memberi tahu minggu yang mana.
// ============================================================================

import { wibDayKey, geserHari } from '../absensi/logika.js';
import { isManajemen, idBawahanTransitif } from '../peran/hierarki.js';
import { normalisasiLead } from './lead.js';
import { bolehTulisMilik } from './data.js';

export const SKOR_BACKUP_KEY = 'grd:skor:all';
export const SKOR_REC_PREFIX = 'grdskor:rec:';

const angka = (v, fallback = 0) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

const RE_HARI = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hari dalam seminggu untuk sebuah tanggal WIB (0 = Minggu ... 6 = Sabtu).
 * Tanggalnya SUDAH dalam WIB, jadi diperlakukan sebagai UTC supaya penanggalan
 * tidak bergeser lagi oleh zona waktu perangkat.
 */
function hariKe(dk) {
  const d = new Date(`${dk}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? -1 : d.getUTCDay();
}

/** Senin dari minggu yang memuat tanggal ini. '' bila tanggalnya tidak sah. */
export function awalMinggu(dk = wibDayKey()) {
  const s = String(dk || '');
  if (!RE_HARI.test(s)) return '';
  const h = hariKe(s);
  if (h < 0) return '';
  const mundur = (h + 6) % 7;   // Senin → 0, Minggu → 6
  return geserHari(s, -mundur);
}

/** Minggu (Ahad) penutup dari minggu yang memuat tanggal ini. */
export function akhirMinggu(dk = wibDayKey()) {
  const senin = awalMinggu(dk);
  return senin ? geserHari(senin, 6) : '';
}

/** Kunci minggu = tanggal Senin-nya. Dipakai sebagai id periode pengisian. */
export const mingguKey = (dk = wibDayKey()) => awalMinggu(dk);

/** Minggu berjalan menurut WIB. */
export const mingguIni = () => mingguKey(wibDayKey());

export const mingguValid = (mk) => !!mk && RE_HARI.test(String(mk)) && awalMinggu(mk) === mk;

/** Geser n minggu (negatif = mundur). */
export function geserMinggu(mk, n = 0) {
  const s = awalMinggu(mk);
  if (!s) return '';
  return geserHari(s, Math.trunc(angka(n, 0)) * 7);
}

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const namaBulan = (dk) => BULAN_PENDEK[Number(String(dk).slice(5, 7)) - 1] || '';
const tgl = (dk) => String(Number(String(dk).slice(8, 10)));

/** Label manusiawi: '14–20 Sep 2026', atau '29 Sep–5 Okt 2026' bila menyeberang bulan. */
export function labelMinggu(mk) {
  const a = awalMinggu(mk);
  if (!a) return '—';
  const b = akhirMinggu(a);
  const tahunA = a.slice(0, 4);
  const tahunB = b.slice(0, 4);
  if (tahunA !== tahunB) return `${tgl(a)} ${namaBulan(a)} ${tahunA}–${tgl(b)} ${namaBulan(b)} ${tahunB}`;
  if (a.slice(5, 7) !== b.slice(5, 7)) return `${tgl(a)} ${namaBulan(a)}–${tgl(b)} ${namaBulan(b)} ${tahunA}`;
  return `${tgl(a)}–${tgl(b)} ${namaBulan(a)} ${tahunA}`;
}

/** Daftar minggu untuk dropdown/riwayat — TERBARU di atas. */
export function daftarMinggu(acuan = mingguIni(), jumlah = 8) {
  const dasar = awalMinggu(acuan) || mingguIni();
  const keluar = [];
  for (let i = 0; i < Math.max(1, Math.trunc(jumlah)); i++) keluar.push(geserMinggu(dasar, -i));
  return keluar;
}

/** Minggu ini belum lewat — skor minggu berjalan masih boleh berubah. */
export const mingguBerjalan = (mk) => awalMinggu(mk) === mingguIni();

// ============================================================================
// SKOR
// ============================================================================

/**
 * Bentuk skor. `target` DISALIN dari lead measure saat skor dicatat — bukan
 * dibaca ulang dari lead-nya. Alasannya: target boleh berubah lewat usulan
 * baru, dan kalau papan skor membaca target terbaru, minggu-minggu lama ikut
 * berubah menang/kalahnya. Skor lama harus tetap menceritakan apa yang terjadi
 * saat itu.
 */
export function normalisasiSkor(s) {
  if (!s || typeof s !== 'object') return null;
  const target = angka(s.target, 0);
  const nilai = angka(s.nilai, 0);
  return {
    ...s,
    id: String(s.id || ''),
    leadId: String(s.leadId || ''),
    goalId: String(s.goalId || ''),
    ownerId: String(s.ownerId || ''),
    minggu: awalMinggu(s.minggu) || '',
    uom: String(s.uom || '').trim(),
    nilai,
    target,
    catatan: String(s.catatan || '').trim(),
  };
}

export function validasiSkor(s) {
  const n = normalisasiSkor(s);
  if (!n) return 'Data skor tidak terbaca.';
  if (!n.leadId) return 'Skor harus menempel pada sebuah lead measure.';
  if (!n.minggu) return 'Minggu tidak sah.';
  if (n.nilai < 0) return 'Angka tidak boleh minus.';
  if (n.target <= 0) return 'Target mingguan tidak sah.';
  return '';
}

/**
 * BENTUK SATU BARIS SKOR — satu tempat yang menyatakan apa isi sebuah baris.
 *
 * `sejak` menandai versi berapa sebuah field mulai ada. Gunanya saat nanti ada
 * field baru: baris lama yang disimpan sebelum field itu ada bisa DIKENALI
 * sebagai "belum punya", bukan terbaca sebagai nol — karena nol di papan skor
 * berarti "dikerjakan nol kali", sebuah pernyataan, bukan ketiadaan data.
 *
 * KUNCI BARIS = `grdskor:rec:<minggu>:<leadId>`. Minggu ditaruh di DEPAN supaya
 * satu minggu bisa dibaca lewat prefix tanpa menarik seluruh riwayat (egress),
 * dan karena kuncinya memuat minggu + lead, satu lead measure MUSTAHIL punya
 * dua baris di minggu yang sama — itu dijaga oleh bentuk kuncinya, bukan oleh
 * pemeriksaan yang bisa terlewat.
 */
export const SKEMA_SKOR = {
  id:          { wajib: true,  jenis: 'teks',   sejak: 1 },
  leadId:      { wajib: true,  jenis: 'teks',   sejak: 1 },
  goalId:      { wajib: true,  jenis: 'teks',   sejak: 1 },
  ownerId:     { wajib: false, jenis: 'teks',   sejak: 1 },
  minggu:      { wajib: true,  jenis: 'minggu', sejak: 1 },
  nilai:       { wajib: true,  jenis: 'angka0', sejak: 1 },
  target:      { wajib: true,  jenis: 'angka',  sejak: 1 },
  uom:         { wajib: false, jenis: 'teks',   sejak: 1 },
  catatan:     { wajib: false, jenis: 'teks',   sejak: 1 },
  dicatatOleh: { wajib: false, jenis: 'teks',   sejak: 1 },
  dicatatNama: { wajib: false, jenis: 'teks',   sejak: 1 },
  dicatatPada: { wajib: false, jenis: 'teks',   sejak: 1 },
};

/**
 * Field wajib yang HILANG dari sebuah baris — kosong berarti bentuknya utuh.
 * `angka0` boleh nol (nol itu jawaban), `angka` tidak (target nol tak bisa dinilai).
 */
export function fieldHilangSkor(s) {
  const n = normalisasiSkor(s);
  const wajib = Object.keys(SKEMA_SKOR).filter(k => SKEMA_SKOR[k].wajib);
  if (!n) return wajib;
  return wajib.filter(k => {
    const v = n[k];
    if (SKEMA_SKOR[k].jenis === 'angka0') return !Number.isFinite(v) || v < 0;
    if (SKEMA_SKOR[k].jenis === 'angka') return !Number.isFinite(v) || v <= 0;
    if (SKEMA_SKOR[k].jenis === 'minggu') return !mingguValid(v);
    return v === undefined || v === null || v === '';
  });
}

/**
 * Baris yang ADA tapi tidak bisa dinilai menang/kalahnya.
 *
 * KENAPA DIPISAH DARI "KALAH": baris tanpa target akan selalu gagal uji
 * `nilai >= target`, jadi tanpa pemeriksaan ini ia terbaca sebagai KALAH
 * selamanya. Menuduh orang kalah karena datanya rusak adalah tuduhan palsu —
 * dan yang lebih buruk, ia menyembunyikan kerusakannya di balik angka yang
 * kelihatan wajar.
 *
 * SENGAJA memakai `validasiSkor`, BUKAN daftar syarat sendiri: rusak artinya
 * "baris ini tidak akan lolos pintu yang sama yang dulu ia lewati untuk masuk".
 * Dua salinan aturan pasti menyimpang suatu hari — itu persis kesalahan yang
 * sudah pernah diperbaiki lewat `bolehTulisMilik`.
 *
 * Perhatikan bedanya dengan `fieldHilangSkor`: baris tanpa `goalId` TETAP bisa
 * dinilai menang/kalah (jadi bukan "rusak"), tapi bentuknya tidak utuh — ia
 * lolos dari gerbang baca yang menyaring lewat goal, jadi tak pernah muncul.
 */
export const skorRusak = (s) => !!s && validasiSkor(s) !== '';

/**
 * MENANG bila nilai mencapai target minggu itu. Tidak ada "hampir" — itulah
 * gunanya papan skor: jawabannya tegas.
 */
export const menang = (s) => {
  const n = normalisasiSkor(s);
  return !!n && n.target > 0 && n.nilai >= n.target;
};

/** Persen pencapaian minggu itu — untuk bar, bukan untuk menentukan menang. */
export function persenSkor(s) {
  const n = normalisasiSkor(s);
  if (!n || n.target <= 0) return 0;
  const p = (n.nilai / n.target) * 100;
  return Number.isFinite(p) ? Math.max(0, Math.round(p)) : 0;
}
export const persenBarSkor = (s) => Math.min(100, persenSkor(s));

export const HASIL_SKOR = {
  menang: { label: 'Menang', color: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  kalah:  { label: 'Kalah',  color: 'bg-red-100 text-red-700',         bar: 'bg-red-500' },
  kosong: { label: 'Belum diisi', color: 'bg-slate-100 text-slate-600', bar: 'bg-slate-300' },
  rusak:  { label: 'Data rusak',  color: 'bg-amber-100 text-amber-800', bar: 'bg-amber-400' },
};
export const gayaHasil = (h) => HASIL_SKOR[h] || HASIL_SKOR.kosong;
export const hasilSkor = (s) => {
  if (!s) return 'kosong';
  if (skorRusak(s)) return 'rusak';
  return menang(s) ? 'menang' : 'kalah';
};

// ====== KUMPULAN ======
export const skorMinggu = (daftar, mk) => {
  const m = awalMinggu(mk);
  return (daftar || []).map(normalisasiSkor).filter(s => s && s.minggu === m);
};

/** Skor satu lead measure pada satu minggu (null bila belum diisi). */
export function skorLeadMinggu(daftar, leadId, mk) {
  const m = awalMinggu(mk);
  return (daftar || []).map(normalisasiSkor)
    .find(s => s && s.leadId === String(leadId || '') && s.minggu === m) || null;
}

/** Riwayat satu lead measure — TERLAMA di kiri, supaya trennya terbaca maju. */
export function riwayatLead(daftar, leadId) {
  return (daftar || []).map(normalisasiSkor)
    .filter(s => s && s.leadId === String(leadId || ''))
    .sort((a, b) => a.minggu.localeCompare(b.minggu));
}

/**
 * Skor yang lead measure-nya sudah TIDAK ADA lagi.
 *
 * Sama seperti `leadYatim` di lead.js: angkanya tetap tersimpan, tapi tidak
 * pernah muncul di layar mana pun lagi karena setiap tampilan berangkat dari
 * daftar lead. SENGAJA tidak dihapus otomatis — ini catatan pekerjaan yang
 * benar-benar terjadi, dan menghapusnya diam-diam berarti menghapus bukti
 * kerja orang. Dilaporkan terpisah supaya bisa diputuskan manusia.
 */
export function skorYatim(daftarSkor, leads) {
  const ada = new Set((leads || []).map(l => l && l.id).filter(Boolean));
  return (daftarSkor || []).map(normalisasiSkor).filter(Boolean)
    .filter(s => s.leadId && !ada.has(s.leadId));
}

/** Rekap satu minggu: berapa menang, kalah, belum diisi, berapa yang datanya rusak. */
export function rekapMinggu(daftarSkor, leadAktif, mk) {
  const m = awalMinggu(mk);
  const aktif = (leadAktif || []).map(normalisasiLead).filter(l => l && l.status === 'aktif');
  let menangN = 0, kalahN = 0, kosongN = 0, rusakN = 0;
  for (const l of aktif) {
    const s = skorLeadMinggu(daftarSkor, l.id, m);
    // Baris rusak dihitung BELUM DIISI, bukan kalah — lihat alasannya di skorRusak.
    if (!s) kosongN += 1;
    else if (skorRusak(s)) { rusakN += 1; kosongN += 1; }
    else if (menang(s)) menangN += 1;
    else kalahN += 1;
  }
  const terisi = menangN + kalahN;
  return {
    minggu: m,
    total: aktif.length,
    menang: menangN,
    kalah: kalahN,
    kosong: kosongN,
    rusak: rusakN,
    terisi,
    persenMenang: terisi ? Math.round((menangN / terisi) * 100) : 0,
  };
}

/**
 * REKAP PER ORANG untuk satu minggu — siapa menang berapa, siapa belum mengisi.
 *
 * Diurutkan: yang BELUM MENGISI di atas, lalu yang paling banyak kalah. Bukan
 * untuk mempermalukan — papan skor mingguan gunanya justru menemukan siapa yang
 * perlu dibantu pekan ini, dan itu hilang kalau yang sudah rapi ditaruh duluan.
 */
export function rekapPerOrang(daftarSkor, leadAktif, mk, allUsers) {
  const m = awalMinggu(mk);
  const aktif = (leadAktif || []).map(normalisasiLead).filter(l => l && l.status === 'aktif');

  const perOrang = new Map();
  for (const l of aktif) {
    if (!perOrang.has(l.ownerId)) {
      perOrang.set(l.ownerId, { ownerId: l.ownerId, total: 0, menang: 0, kalah: 0, kosong: 0, rusak: 0 });
    }
    const baris = perOrang.get(l.ownerId);
    baris.total += 1;
    const s = skorLeadMinggu(daftarSkor, l.id, m);
    if (!s) baris.kosong += 1;
    else if (skorRusak(s)) { baris.rusak += 1; baris.kosong += 1; }
    else if (menang(s)) baris.menang += 1;
    else baris.kalah += 1;
  }

  return [...perOrang.values()].map(b => ({
    ...b,
    user: (allUsers || []).find(u => u && u.id === b.ownerId) || null,
    terisi: b.menang + b.kalah,
    persenMenang: (b.menang + b.kalah) ? Math.round((b.menang / (b.menang + b.kalah)) * 100) : 0,
  })).sort((a, b) => {
    if (a.kosong !== b.kosong) return b.kosong - a.kosong;   // belum mengisi dulu
    if (a.kalah !== b.kalah) return b.kalah - a.kalah;       // lalu yang paling banyak kalah
    return String(a.user?.name || '').localeCompare(String(b.user?.name || ''));
  });
}

/** Rekap beberapa minggu terakhir — untuk melihat arahnya, bukan cuma pekan ini. */
export function rekapBeberapaMinggu(daftarSkor, leadAktif, { sampai = mingguIni(), jumlah = 6 } = {}) {
  return daftarMinggu(sampai, jumlah).slice().reverse()
    .map(mk => rekapMinggu(daftarSkor, leadAktif, mk));
}

/**
 * Tren beberapa minggu terakhir untuk satu lead measure — dipakai garis kecil
 * di kartu. Minggu yang belum diisi tetap muncul sebagai lubang, bukan
 * dilewati: minggu yang terlewat itu informasi, bukan ketiadaan data.
 */
export function trenLead(daftarSkor, leadId, { sampai = mingguIni(), jumlah = 8 } = {}) {
  const mingguList = daftarMinggu(sampai, jumlah).slice().reverse(); // terlama → terbaru
  return mingguList.map(mk => {
    const s = skorLeadMinggu(daftarSkor, leadId, mk);
    return { minggu: mk, skor: s, hasil: hasilSkor(s), persen: s ? persenSkor(s) : 0 };
  });
}

/** Rangkaian kemenangan beruntun terakhir (dihitung mundur dari minggu terbaru). */
export function beruntun(daftarSkor, leadId, { sampai = mingguIni(), jumlah = 12 } = {}) {
  const tren = trenLead(daftarSkor, leadId, { sampai, jumlah });
  let n = 0;
  for (let i = tren.length - 1; i >= 0; i--) {
    if (tren[i].hasil === 'menang') n += 1;
    else break;
  }
  return n;
}

// ====== HAK AKSES ======
/** Boleh MENGISI skor lead measure ini? Pemiliknya, atau atasannya. */
export function bisaIsiSkor(user, lead, allUsers) {
  const l = normalisasiLead(lead);
  if (!l || !l.ownerId) return false;
  if (l.status !== 'aktif') return false;   // hanya lead yang sudah disetujui
  return bolehTulisMilik(user, l.ownerId, allUsers);   // rumus yang sama dengan goal
}
