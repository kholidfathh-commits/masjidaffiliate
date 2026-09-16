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

/**
 * SKEMA record lead measure — dipakai memeriksa bentuk data, dan sebagai
 * dokumentasi tunggal tentang field apa saja yang ada.
 *
 * `sejak` menandai versi kapan field itu ditambahkan. Record yang ditulis
 * SEBELUM itu tidak punya fieldnya, dan `normalisasiLead` mengisinya dengan
 * nilai aman — jadi tidak ada migrasi yang harus dijalankan pengguna. Pola ini
 * dipilih karena migrasi massal atas kv_store berarti membaca-menulis ulang
 * ribuan baris, dan itu justru sumber masalah baru.
 */
export const SKEMA_LEAD = {
  id:             { wajib: true,  jenis: 'teks',  sejak: 1 },
  goalId:         { wajib: true,  jenis: 'teks',  sejak: 1 },
  ownerId:        { wajib: true,  jenis: 'teks',  sejak: 1 },
  description:    { wajib: true,  jenis: 'teks',  sejak: 1 },
  targetMingguan: { wajib: true,  jenis: 'angka', sejak: 1 },
  uom:            { wajib: true,  jenis: 'teks',  sejak: 1 },
  status:         { wajib: true,  jenis: 'teks',  sejak: 1 },
  catatan:        { wajib: false, jenis: 'teks',  sejak: 1 },
  penilaiId:      { wajib: false, jenis: 'teks',  sejak: 1 },
  penilaiNama:    { wajib: false, jenis: 'teks',  sejak: 1 },
  riwayat:        { wajib: false, jenis: 'daftar', sejak: 2 },
};

/** Field wajib yang HILANG dari sebuah record — kosong berarti bentuknya utuh. */
export function fieldHilang(l) {
  const n = normalisasiLead(l);
  if (!n) return Object.keys(SKEMA_LEAD).filter(k => SKEMA_LEAD[k].wajib);
  return Object.keys(SKEMA_LEAD)
    .filter(k => SKEMA_LEAD[k].wajib)
    .filter(k => {
      const v = n[k];
      if (SKEMA_LEAD[k].jenis === 'angka') return !Number.isFinite(v) || v <= 0;
      return v === undefined || v === null || v === '';
    });
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

/**
 * PILIHAN LEAD MEASURE UNTUK SEBUAH TIKET.
 *
 * Menjawab "pekerjaan ini menyumbang komitmen mingguan yang mana?" — jadi yang
 * layak ditawarkan hanya lead measure AKTIF milik PIC tiket itu. Usulan yang
 * belum disetujui belum jadi komitmen apa pun, dan lead orang lain tidak bisa
 * disumbang oleh tiket ini.
 *
 * DITARUH DI MODUL MURNI, bukan di dalam komponen, karena urutannya adalah
 * keputusan yang perlu bisa diuji: batas 1–3 itu PER GOAL (bukan per orang) dan
 * lead periode lama tetap berstatus aktif, jadi daftarnya bisa panjang dan bisa
 * memuat dua lead berjudul sama dari periode berbeda. Yang periodenya BERJALAN
 * ditaruh di atas — tiket baru hampir selalu menyumbang komitmen yang sedang
 * berjalan.
 *
 * `periodeBerjalan` dioper dari luar (bukan dibaca dari jam di dalam sini)
 * supaya fungsinya tetap murni dan hasilnya bisa diuji tanpa bergantung tanggal
 * saat uji dijalankan.
 */
export function pilihanLeadUntukTiket(leads, goals, pemilikId, periodeBerjalan = []) {
  const id = String(pemilikId || '');
  if (!id) return [];
  const perGoal = new Map((goals || []).map(g => g && g.id ? [g.id, g] : [null, null]).filter(x => x[0]));
  const berjalan = new Set((periodeBerjalan || []).filter(Boolean));

  return (leads || []).map(normalisasiLead).filter(Boolean)
    .filter(l => l.status === 'aktif' && l.ownerId === id)
    .map(l => {
      const g = perGoal.get(l.goalId) || null;
      return {
        id: l.id,
        lead: l,
        goal: g,
        // Goal yang sudah dihapus TIDAK disembunyikan: lead-nya masih aktif dan
        // masih dikerjakan orangnya. Menyembunyikannya membuat kaitan yang sah
        // mendadak tidak bisa dipilih lagi tanpa penjelasan apa pun.
        berjalan: !!g && berjalan.has(g.periode),
        urut: `${g ? g.description : 'zzz'}|${l.description}`,
      };
    })
    .sort((a, b) => (a.berjalan === b.berjalan)
      ? a.urut.localeCompare(b.urut)
      : (a.berjalan ? -1 : 1));
}

/**
 * TIKET YANG MENYUMBANG SEBUAH GOAL — arah sebaliknya dari pilihanLeadUntukTiket.
 *
 * KENAPA TIKETNYA DIOPER, BUKAN DIBACA DI SINI: modul GRD tidak boleh meng-import
 * App.jsx (aturan anti circular import), dan pembaca tiket ada di sana. Jadi yang
 * tinggal di file ini adalah KEPUTUSANNYA — mana yang termasuk, urutannya apa —
 * dan itu yang perlu bisa diuji.
 *
 * `bolehLihat` juga dioper, bukan ditulis ulang di sini. Tiket bersifat tertutup
 * dan aturannya sudah ada satu tempat di App.jsx (`can.canSeeTask`); menyalinnya
 * ke sini berarti dua salinan yang bisa menyimpang — dan kalau menyimpang, yang
 * bocor adalah isi tiket orang lain.
 *
 * Urutannya: yang BELUM selesai dulu (paling telat di atas), baru yang selesai.
 * Goal yang tertinggal biasanya dibuka untuk mencari apa yang macet, bukan untuk
 * membaca daftar pekerjaan yang sudah beres.
 */
export function tiketUntukGoal(tiket, leads, goalId, { bolehLihat = null, hariIni = '' } = {}) {
  const id = String(goalId || '');
  const idLead = new Set((leads || []).map(normalisasiLead).filter(Boolean)
    .filter(l => l.goalId === id).map(l => l.id));

  // Goal tanpa lead measure MUSTAHIL punya tiket terkait — dibedakan dari
  // "punya lead tapi belum ada tiket", karena saran di layarnya berbeda.
  if (idLead.size === 0) return { hasil: [], total: 0, selesai: 0, telat: 0, adaLead: false };

  let hasil = (tiket || []).filter(t => t && t.leadId && idLead.has(t.leadId));
  if (typeof bolehLihat === 'function') hasil = hasil.filter(t => bolehLihat(t));

  const lewat = (t) => !!hariIni && t.status !== 'done' && !!t.deadline && String(t.deadline) < hariIni;
  const selesai = hasil.filter(t => t.status === 'done').length;
  const telat = hasil.filter(lewat).length;

  hasil = hasil.slice().sort((a, b) => {
    const aSelesai = a.status === 'done', bSelesai = b.status === 'done';
    if (aSelesai !== bSelesai) return aSelesai ? 1 : -1;      // belum selesai dulu
    const aTelat = lewat(a), bTelat = lewat(b);
    if (aTelat !== bTelat) return aTelat ? -1 : 1;            // yang telat paling atas
    // Tanpa deadline ditaruh SETELAH yang berdeadline: yang punya batas waktu
    // lebih mendesak, dan '' akan menang kalau diurut sebagai teks biasa.
    const ad = a.deadline || '9999-12-31', bd = b.deadline || '9999-12-31';
    if (ad !== bd) return String(ad).localeCompare(String(bd));
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  return { hasil, total: hasil.length, selesai, telat, adaLead: true };
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

/**
 * Lead measure YATIM — goal yang ditempelinya sudah tidak ada.
 *
 * Terjadi kalau goal dihapus: lead-nya tetap tersimpan, tapi tidak akan pernah
 * muncul lagi karena semua kueri menyaring lewat goal. Baris seperti itu diam
 * memakan tempat dan ikut terbaca tiap `ambilLead()`.
 *
 * Sengaja TIDAK dihapus otomatis saat goalnya dihapus: penghapusan goal bisa
 * keliru dan bisa dibatalkan dengan membuat ulang goalnya, sedangkan lead yang
 * sudah terlanjur terhapus tidak bisa dikembalikan. Jadi ia dilaporkan saja,
 * dan pengelola yang memutuskan.
 */
export function leadYatim(daftar, goals) {
  const adaGoal = new Set((goals || []).map(g => g && g.id).filter(Boolean));
  return (daftar || []).map(normalisasiLead).filter(Boolean)
    .filter(l => l.goalId && !adaGoal.has(l.goalId));
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
