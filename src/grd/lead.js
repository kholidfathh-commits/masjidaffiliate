// ============================================================================
// GRD — LEAD MEASURE — fungsi MURNI (tanpa React/JSX/storage).
// ----------------------------------------------------------------------------
// ATURAN: TIDAK BOLEH meng-import App.jsx. Diuji lewat `node uji-grd.mjs`.
//
// ISTILAH (WAJIB): Lead Measure — bukan "key result", bukan "KPI".
//
// APA ITU LEAD MEASURE, dan kenapa aturannya seketat ini:
//   Goal mengukur HASIL, yang baru kelihatan di akhir periode dan sudah
//   terlambat untuk diperbaiki. Lead measure mengukur TINDAKAN yang mendorong
//   hasil itu — sesuatu yang bisa dikerjakan minggu ini dan ada di bawah kendali
//   pemiliknya. Karena itu:
//     · JUMLAHNYA DIBATASI 1–3 per goal. Lebih dari itu bukan lagi "yang paling
//       menggerakkan", melainkan daftar pekerjaan — dan tidak ada yang fokus.
//     · Harus punya ANGKA MINGGUAN. Tanpa itu ia cuma niat, tidak bisa diisi
//       ke Scoreboard dan tidak bisa dinilai menang/kalah.
//     · Diusulkan pemiliknya, DISETUJUI atasannya. Yang mengerjakan paling tahu
//       tindakan apa yang menggerakkan; atasan menjaga supaya yang dipilih
//       benar-benar nyambung ke goal.
// ============================================================================

import { wibDayKey } from '../absensi/logika.js';
import { isManajemen, atasanId, idBawahanTransitif } from '../peran/hierarki.js';
import { normalisasiGoal, pemilikGoal, bolehTulisMilik } from './data.js';

// ====== KUNCI PENYIMPANAN ======
// Per-record: 1 baris = 1 lead measure. Alur usul–setujui ditulis dua pihak
// berbeda (pemilik & atasan), jadi pola array besar akan saling menimpa.
export const LEAD_BACKUP_KEY = 'grd:lead:all';
export const LEAD_REC_PREFIX = 'grdlead:rec:';

const angka = (v, fallback = 0) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

// ====== BATAS ======
export const MIN_LEAD_PER_GOAL = 1;
export const MAKS_LEAD_AKTIF = 3;

// ====== STATUS & ALUR ======
export const STATUS_LEAD = {
  usul:     { label: 'Menunggu persetujuan', color: 'bg-amber-100 text-amber-800',     dot: 'bg-amber-500' },
  aktif:    { label: 'Aktif',                color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  perbaiki: { label: 'Perlu diperbaiki',     color: 'bg-orange-100 text-orange-800',   dot: 'bg-orange-500' },
  ditolak:  { label: 'Ditolak',              color: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
};
export const STATUS_LEAD_DEFAULT = 'usul';
export const gayaStatusLead = (s) => STATUS_LEAD[s] || STATUS_LEAD[STATUS_LEAD_DEFAULT];

/**
 * Perpindahan status yang SAH. Ditulis sebagai peta supaya alurnya bisa dibaca
 * sekali lihat, dan supaya tidak ada jalan pintas yang lolos diam-diam
 * (mis. 'ditolak' langsung jadi 'aktif' tanpa diusulkan ulang).
 */
export const ALUR_LEAD = {
  usul:     ['aktif', 'perbaiki', 'ditolak'],
  perbaiki: ['usul'],
  ditolak:  ['usul'],
  aktif:    ['perbaiki', 'ditolak'],
};
export const bolehPindahStatus = (dari, ke) => (ALUR_LEAD[dari] || []).includes(ke);

// ====== BENTUK DATA ======
export function normalisasiLead(l) {
  if (!l || typeof l !== 'object') return null;
  const status = STATUS_LEAD[l.status] ? l.status : STATUS_LEAD_DEFAULT;
  return {
    ...l,
    id: String(l.id || ''),
    goalId: String(l.goalId || ''),
    ownerId: String(l.ownerId || ''),
    description: String(l.description || '').trim(),
    uom: String(l.uom || '').trim(),
    targetMingguan: angka(l.targetMingguan, 0),
    status,
    catatan: String(l.catatan || '').trim(),
    penilaiId: l.penilaiId ? String(l.penilaiId) : '',
    penilaiNama: String(l.penilaiNama || ''),
    riwayat: Array.isArray(l.riwayat) ? l.riwayat : [],
  };
}

/**
 * Riwayat langkah disimpan DI DALAM record lead, bukan sebagai baris terpisah
 * seperti jejak goal.
 *
 * Alasannya: jumlahnya kecil (beberapa langkah usul–nilai), selalu dibutuhkan
 * bersama lead-nya, dan tidak pernah ditulis dua pihak bersamaan — satu
 * penilaian adalah satu penulisan. Jejak goal beda: ia bisa panjang tak
 * terbatas dan dibaca terpisah, karena itu dipisah jadi baris sendiri.
 *
 * Dibatasi supaya record tidak membengkak tanpa henti; yang dibuang yang
 * PALING LAMA, bukan yang terbaru.
 */
export const MAKS_RIWAYAT_LEAD = 20;

export function tambahRiwayatLead(lead, { aksi, oleh, catatan = '', waktu = new Date().toISOString() }) {
  const n = normalisasiLead(lead);
  const baris = {
    aksi,
    olehId: (oleh && oleh.id) || '',
    olehNama: (oleh && oleh.name) || 'Tidak diketahui',
    catatan: String(catatan || '').trim(),
    waktu,
  };
  const semua = [...(n ? n.riwayat : []), baris];
  return semua.slice(-MAKS_RIWAYAT_LEAD);
}

export const LABEL_AKSI_LEAD = {
  usul: 'Diusulkan',
  usulUlang: 'Diusulkan ulang',
  aktif: 'Disetujui',
  perbaiki: 'Diminta perbaiki',
  ditolak: 'Ditolak',
};
export const labelAksiLead = (a) => LABEL_AKSI_LEAD[a] || a;

/** Riwayat terbaru di atas — untuk ditampilkan. */
export function riwayatLead(lead) {
  const n = normalisasiLead(lead);
  if (!n) return [];
  return [...n.riwayat].reverse();
}

/** Pesan kesalahan pertama, atau '' bila isian sudah layak diusulkan. */
export function validasiLead(l) {
  const n = normalisasiLead(l);
  if (!n) return 'Data lead measure tidak terbaca.';
  if (!n.goalId) return 'Lead measure harus menempel pada sebuah goal.';
  if (!n.ownerId) return 'Lead measure harus punya pemilik.';
  if (!n.description) return 'Tulis tindakan mingguannya.';
  if (!n.uom) return 'Satuan wajib diisi.';
  if (n.targetMingguan <= 0) return 'Target mingguan harus lebih dari nol.';
  return '';
}

// ====== KUMPULAN ======
export const leadPerGoal = (daftar, goalId) =>
  (daftar || []).map(normalisasiLead).filter(l => l && l.goalId === String(goalId || ''));

export const leadAktif = (daftar, goalId) =>
  leadPerGoal(daftar, goalId).filter(l => l.status === 'aktif');

export const leadMenunggu = (daftar, goalId) =>
  leadPerGoal(daftar, goalId).filter(l => l.status === 'usul');

/** Sisa slot aktif untuk sebuah goal (0 bila sudah penuh). */
export const sisaSlotAktif = (daftar, goalId) =>
  Math.max(0, MAKS_LEAD_AKTIF - leadAktif(daftar, goalId).length);

/**
 * Kesehatan lead measure sebuah goal — dipakai badge di layar.
 *   kosong  : belum ada satu pun yang aktif → goal belum bisa dijalankan mingguan
 *   sehat   : 1–3 aktif
 *   penuh   : sudah 3 aktif, tidak bisa menambah lagi
 */
export function statusLeadGoal(daftar, goalId) {
  const aktif = leadAktif(daftar, goalId).length;
  const menunggu = leadMenunggu(daftar, goalId).length;
  return {
    aktif,
    menunggu,
    sisa: Math.max(0, MAKS_LEAD_AKTIF - aktif),
    keadaan: aktif === 0 ? 'kosong' : aktif >= MAKS_LEAD_AKTIF ? 'penuh' : 'sehat',
  };
}

/**
 * Badge ringkas status lead measure sebuah goal — dipakai di kartu goal.
 * Mengembalikan null kalau tidak perlu ditampilkan (goal sudah punya lead aktif
 * dan tidak ada yang menunggu), supaya kartu tidak penuh lencana yang tidak
 * menambah informasi.
 */
export function badgeLeadGoal(daftar, goalId) {
  const st = statusLeadGoal(daftar, goalId);
  if (st.menunggu > 0) {
    return { teks: `${st.menunggu} usulan`, color: 'bg-amber-100 text-amber-800',
      judul: `${st.menunggu} lead measure menunggu penilaian` };
  }
  if (st.aktif === 0) {
    return { teks: 'tanpa lead', color: 'bg-orange-100 text-orange-800',
      judul: 'Goal ini belum punya lead measure aktif — belum ada tindakan mingguan yang mendorongnya' };
  }
  return null;
}

/**
 * CONTOH LEAD MEASURE siap pakai.
 *
 * Alasannya sama dengan template goal: menulis lead measure yang tajam itu
 * sulit dari nol, dan yang ditulis terburu-buru biasanya berupa HASIL
 * ("GMV naik") atau NIAT ("lebih rajin") — dua-duanya tidak bisa diisi mingguan.
 * Contoh di sini semuanya berbentuk tindakan yang bisa dihitung.
 *
 * Dikelompokkan menurut peran pemilik goal, bukan menurut divisi: tindakan
 * seorang Leader memang beda jenisnya dengan tindakan staf, sedangkan dua
 * divisi yang berbeda bisa punya tindakan yang mirip.
 */
export const TEMPLATE_LEAD = {
  owner: [
    { description: 'Sesi tinjauan goal bersama manajer', targetMingguan: 1, uom: 'Sesi' },
    { description: 'Divisi yang laporan mingguannya ditinjau', targetMingguan: 7, uom: 'Divisi' },
  ],
  manajer: [
    { description: 'Sesi pendampingan leader', targetMingguan: 2, uom: 'Sesi' },
    { description: 'Laporan mingguan tim yang ditinjau', targetMingguan: 5, uom: 'Laporan' },
  ],
  leader: [
    { description: 'Sesi 1-on-1 dengan anggota tim', targetMingguan: 3, uom: 'Sesi' },
    { description: 'Tiket tim yang ditinjau sebelum tenggat', targetMingguan: 10, uom: 'Tiket' },
    { description: 'Anggota tim yang dicek progres belajarnya', targetMingguan: 5, uom: 'Orang' },
  ],
  wakil: [
    { description: 'Pendampingan anggota tim', targetMingguan: 3, uom: 'Sesi' },
    { description: 'Laporan harian anggota yang dicek', targetMingguan: 15, uom: 'Laporan' },
  ],
  operasional: [
    { description: 'Konten affiliate tayang', targetMingguan: 7, uom: 'Konten' },
    { description: 'Sesi live', targetMingguan: 3, uom: 'Sesi' },
    { description: 'Sampel produk dipakai untuk konten', targetMingguan: 3, uom: 'Produk' },
    { description: 'Riset produk baru', targetMingguan: 5, uom: 'Produk' },
  ],
};

/** Contoh untuk sebuah peran — peran tak dikenal jatuh ke contoh karyawan. */
export function templateLeadUntuk(peran) {
  return TEMPLATE_LEAD[peran] || TEMPLATE_LEAD.operasional;
}

/** Contoh + goal = calon lead measure yang siap diperiksa `validasiLead`. */
export function terapkanTemplateLead(template, goal) {
  const t = template || {};
  const g = normalisasiGoal(goal);
  return normalisasiLead({
    goalId: (g && g.id) || '',
    ownerId: (g && g.ownerId) || '',
    description: t.description || '',
    targetMingguan: t.targetMingguan,
    uom: t.uom || '',
  });
}

// ====== HAK AKSES ======
/**
 * Boleh MENGUSULKAN lead measure untuk goal ini? Pemilik goalnya, atau atasannya.
 * (Atasan boleh supaya goal yang pemiliknya belum sempat mengisi tidak mandek.)
 */
export function bisaUsulLead(user, goal, allUsers) {
  const g = normalisasiGoal(goal);
  if (!g || !g.ownerId) return false;
  return bolehTulisMilik(user, g.ownerId, allUsers);   // rumus yang sama dengan goal
}

/**
 * Boleh MENILAI (setujui/tolak/minta perbaiki) usulan ini?
 *
 * ATASAN pengusul — bukan pengusulnya sendiri. Inilah inti alur persetujuan:
 * kalau orang bisa menyetujui usulannya sendiri, persetujuannya tidak berarti
 * apa-apa. Owner/Manajer boleh menilai siapa pun KECUALI usulannya sendiri.
 */
export function bisaNilaiLead(user, lead, allUsers) {
  const n = normalisasiLead(lead);
  if (!n || !n.ownerId) return false;
  // SENGAJA TIDAK memakai bolehTulisMilik: menilai beda dari mengubah.
  // Pemilik boleh MENGUBAH usulannya sendiri, tapi TIDAK boleh MENILAINYA —
  // itu yang membuat persetujuan berarti.
  if (!user || n.ownerId === user.id) return false;
  return bolehTulisMilik(user, n.ownerId, allUsers);
}

/** Boleh MEMPERBAIKI usulan (mengubah isinya)? Pengusulnya, atau atasannya. */
export function bisaUbahLead(user, lead, allUsers) {
  const n = normalisasiLead(lead);
  if (!n || !n.ownerId) return false;
  return bolehTulisMilik(user, n.ownerId, allUsers);   // rumus yang sama dengan goal
}

/** Siapa yang seharusnya menilai usulan ini — dipakai untuk memberi tahu di layar. */
export function calonPenilai(lead, allUsers) {
  const n = normalisasiLead(lead);
  if (!n || !n.ownerId) return null;
  const pengusul = (allUsers || []).find(u => u && u.id === n.ownerId);
  const pid = atasanId(pengusul);
  return (allUsers || []).find(u => u && u.id === pid) || null;
}

/** Lead measure yang MENUNGGU penilaian `user` — dipakai lencana & daftar tugas. */
export function menungguPenilaianSaya(user, daftar, allUsers) {
  return (daftar || []).map(normalisasiLead).filter(Boolean)
    .filter(l => l.status === 'usul' && bisaNilaiLead(user, l, allUsers));
}

/**
 * Usulan MILIK SAYA yang perlu saya kerjakan: diminta perbaiki, atau ditolak.
 *
 * Pasangan dari `menungguPenilaianSaya`. Tanpa ini alurnya timpang — atasan
 * diberi tahu ada yang menunggu dinilai, tapi pengusul tidak pernah diberi tahu
 * usulannya dikembalikan, dan usulan itu mengendap tanpa ada yang tahu.
 */
export function perluSayaPerbaiki(user, daftar) {
  if (!user) return [];
  return (daftar || []).map(normalisasiLead).filter(Boolean)
    .filter(l => l.ownerId === user.id && (l.status === 'perbaiki' || l.status === 'ditolak'));
}

/**
 * KOMITMEN MINGGUAN seseorang: seluruh lead measure AKTIF miliknya, lintas goal.
 *
 * Istilah "Komitmen Mingguan" memang bagian dari kosakata GRD yang disepakati —
 * inilah wujudnya: daftar pendek yang orang lihat tiap awal pekan untuk tahu
 * apa yang harus ia kerjakan, tanpa perlu membuka goal satu per satu.
 */
export function komitmenMingguan(user, daftar, goalIds = null) {
  if (!user) return [];
  const boleh = goalIds ? new Set(goalIds) : null;
  return (daftar || []).map(normalisasiLead).filter(Boolean)
    .filter(l => l.ownerId === user.id && l.status === 'aktif')
    .filter(l => !boleh || boleh.has(l.goalId))
    .sort((a, b) => a.description.localeCompare(b.description));
}

/** Total beban mingguan per satuan — mis. { Konten: 12, Sesi: 3 }. */
export function bebanMingguan(daftarKomitmen) {
  const per = {};
  for (const l of daftarKomitmen || []) {
    const n = normalisasiLead(l);
    if (!n || !n.uom) continue;
    per[n.uom] = (per[n.uom] || 0) + n.targetMingguan;
  }
  return per;
}

/** Urutan tampil yang stabil: yang menunggu di atas, lalu aktif, lalu sisanya. */
const BOBOT_STATUS = { usul: 0, perbaiki: 1, aktif: 2, ditolak: 3 };
export function urutkanLead(daftar) {
  return (daftar || []).map(normalisasiLead).filter(Boolean).sort((a, b) => {
    const beda = (BOBOT_STATUS[a.status] ?? 9) - (BOBOT_STATUS[b.status] ?? 9);
    if (beda !== 0) return beda;
    return a.description.localeCompare(b.description);
  });
}

/** Ringkasan seluruh lead measure yang terlihat — untuk kartu statistik. */
export function ringkasLead(daftar) {
  const bersih = (daftar || []).map(normalisasiLead).filter(Boolean);
  return {
    total: bersih.length,
    aktif: bersih.filter(l => l.status === 'aktif').length,
    menunggu: bersih.filter(l => l.status === 'usul').length,
    perbaiki: bersih.filter(l => l.status === 'perbaiki').length,
    ditolak: bersih.filter(l => l.status === 'ditolak').length,
  };
}

/** Tanggal WIB hari ini — dipakai stempel waktu usul/penilaian. */
export const hariIniWib = () => wibDayKey();
