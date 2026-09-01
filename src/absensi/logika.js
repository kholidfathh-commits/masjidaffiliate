// ============================================================================
// LOGIKA ABSENSI — fungsi MURNI (tanpa React/JSX/storage) supaya bisa diuji
// lewat `node uji-absensi.mjs` tanpa menjalankan aplikasi & tanpa menyentuh DB.
// ----------------------------------------------------------------------------
// ATURAN WAJIB:
// 1. File ini TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
// 2. Semua tanggal memakai kunci hari WIB 'YYYY-MM-DD'. Aritmetikanya dilakukan
//    pada STRING/UTC — BUKAN `new Date()` lokal — supaya tidak pernah geser
//    sehari di perangkat yang zona waktunya bukan Asia/Jakarta.
// 3. Tidak ada query/IO di sini. Semua data dioper sebagai argumen.
// ============================================================================

export const TZ_WIB = 'Asia/Jakarta';

// Formatter dibuat SEKALI (bukan per panggilan) — dipakai ribuan kali saat
// mengelompokkan ribuan record absensi.
const _fmtHariWib = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_WIB, year: 'numeric', month: '2-digit', day: '2-digit' });
const _fmtJamWib = new Intl.DateTimeFormat('en-GB', { timeZone: TZ_WIB, hour: '2-digit', minute: '2-digit', hour12: false });

/** Kunci hari WIB ('YYYY-MM-DD') dari timestamp apa pun (ISO/Date/number). */
export const wibDayKey = (d = new Date()) => _fmtHariWib.format(new Date(d));
/** Jam WIB 'HH:MM'. */
export const wibJam = (d = new Date()) => _fmtJamWib.format(new Date(d));
/** Menit sejak 00:00 WIB (0–1439). */
export const wibMenit = (d = new Date()) => { const [h, m] = wibJam(d).split(':').map(Number); return h * 60 + m; };

/** 'HH:MM' → menit sejak tengah malam. null kalau tidak valid. */
export const parseJam = (s) => {
  if (!s || typeof s !== 'string' || !s.includes(':')) return null;
  const [h, m] = s.split(':').map(Number);
  return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : null;
};

// ====== ARITMETIKA TANGGAL (aman timezone: semua lewat UTC murni) ======
/** Geser kunci hari sebanyak n hari (n boleh negatif). */
export const geserHari = (dk, n) => {
  if (!dk) return dk;
  const d = new Date(dk + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Tanggal 1 pada bulan yang sama. */
export const awalBulan = (dk) => `${String(dk).slice(0, 7)}-01`;
/** Tanggal terakhir pada bulan yang sama (28/29/30/31 — tahun kabisat ikut benar). */
export const akhirBulan = (dk) => {
  const y = Number(String(dk).slice(0, 4)), m = Number(String(dk).slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(dk).slice(0, 7)}-${String(last).padStart(2, '0')}`;
};
/** Tanggal 1 bulan sebelumnya. */
export const awalBulanLalu = (dk) => {
  let y = Number(String(dk).slice(0, 4)), m = Number(String(dk).slice(5, 7)) - 1;
  if (m === 0) { m = 12; y -= 1; }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
};
/** Selisih hari inklusif antara dua kunci hari (start & end ikut dihitung). */
export const jumlahHari = (start, end) => {
  if (!start || !end) return 0;
  const a = Date.parse(start + 'T00:00:00Z'), b = Date.parse(end + 'T00:00:00Z');
  return Math.floor((b - a) / 86400000) + 1;
};
/** Daftar kunci hari dari start s/d end (inklusif), dibatasi `maks` hari. */
export const daftarHari = (start, end, maks = 400) => {
  const out = [];
  if (!start || !end || start > end) return out;
  for (let d = start; d <= end && out.length < maks; d = geserHari(d, 1)) out.push(d);
  return out;
};
/** true kalau dk ada di dalam rentang. start/end kosong = tanpa batas. */
export const dalamRentang = (dk, start, end) => !!dk && (!start || dk >= start) && (!end || dk <= end);

// ====== PRESET RENTANG ======
// Semua INKLUSIF dan dihitung dari `acuan` (kunci hari WIB), bukan dari waktu perangkat.
// `idLama` = id yang SUDAH dipakai layar lain (Dashboard & Keuangan membedakan
// mode bulan lewat id 'this-month'/'month'). Dipertahankan supaya perbaikan tanggal
// ini tidak mengubah perilaku halaman-halaman itu.
export const PRESET_RENTANG = [
  { id: 'hari-ini', idLama: 'day', label: 'Hari Ini' },
  { id: 'kemarin', idLama: 'day', label: 'Kemarin' },
  { id: '7-hari', idLama: 'custom', label: '7 Hari Terakhir' },
  { id: '28-hari', idLama: 'custom', label: '28 Hari Terakhir' },
  { id: 'bulan-ini', idLama: 'this-month', label: 'Bulan Ini' },
  { id: 'bulan-lalu', idLama: 'month', label: 'Bulan Lalu' },
];

/**
 * Hitung rentang sebuah preset.
 * Contoh acuan 2026-08-27: '7-hari' → 2026-08-21 s/d 2026-08-27 (7 hari, inklusif).
 * @returns {{id:string,idLama:string,label:string,start:string,end:string}|null}
 */
export function rentangPreset(id, acuan = wibDayKey()) {
  const p = PRESET_RENTANG.find(x => x.id === id);
  if (!p) return null;
  const b = { id, idLama: p.idLama, label: p.label };
  switch (id) {
    case 'hari-ini': return { ...b, start: acuan, end: acuan };
    case 'kemarin': { const k = geserHari(acuan, -1); return { ...b, start: k, end: k }; }
    case '7-hari': return { ...b, start: geserHari(acuan, -6), end: acuan };
    case '28-hari': return { ...b, start: geserHari(acuan, -27), end: acuan };
    case 'bulan-ini': return { ...b, start: awalBulan(acuan), end: acuan };
    case 'bulan-lalu': { const s = awalBulanLalu(acuan); return { ...b, start: s, end: akhirBulan(s) }; }
    default: return null;
  }
}

// ====== IZIN / SAKIT / CUTI ======
// Bentuk data izin (kompatibel data lama):
//   { id, userId, userName, type:'izin'|'sakit'|'cuti', date:'YYYY-MM-DD',
//     dateEnd?:'YYYY-MM-DD'   ← OPSIONAL & BARU. Data lama tanpa field ini
//                                otomatis dianggap izin 1 hari. Tidak perlu migrasi.
//     reason, note, status:'pending'|'approved'|'rejected', ... }
export const izinMulai = (l) => (l && l.date) || '';
export const izinSelesai = (l) => (l && l.dateEnd && l.dateEnd >= l.date) ? l.dateEnd : ((l && l.date) || '');
/** true kalau izin berlaku pada tanggal tsb (mendukung rentang multi-hari). */
export const izinBerlakuPada = (l, dk) => !!l && !!dk && dk >= izinMulai(l) && dk <= izinSelesai(l);

export const JENIS_IZIN_LABEL = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti' };
export const labelIzin = (l) => JENIS_IZIN_LABEL[l && l.type] || 'Izin';

/** Izin DISETUJUI yang berlaku pada tanggal tsb (kalau dobel, ambil yang terbaru dibuat). */
export function izinPadaTanggal(daftarIzin, dk) {
  let hit = null;
  for (const l of (daftarIzin || [])) {
    if (!l || l.status !== 'approved' || !izinBerlakuPada(l, dk)) continue;
    if (!hit || String(l.createdAt || '') > String(hit.createdAt || '')) hit = l;
  }
  return hit;
}

// ====== STATUS HARIAN ======
export const STATUS = {
  HADIR: 'hadir',
  TERLAMBAT: 'terlambat',
  BELUM_PULANG: 'belumpulang',
  IZIN: 'izin',
  SAKIT: 'sakit',
  CUTI: 'cuti',
  LIBUR: 'libur',
  BELUM_WAKTUNYA: 'belumwaktunya',
  BELUM_MASUK: 'belummasuk',
  BELUM_ABSEN: 'belumabsen',
  TANPA_DATA: 'tanpadata',
  TANPA_KETERANGAN: 'tanpaketerangan',
};

// Kelas warna mengikuti design system yang sudah dipakai di app (palet Tailwind standar).
export const WARNA_STATUS = {
  [STATUS.HADIR]: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  [STATUS.TERLAMBAT]: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  [STATUS.BELUM_PULANG]: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  [STATUS.IZIN]: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  [STATUS.SAKIT]: { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  [STATUS.CUTI]: { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  [STATUS.LIBUR]: { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
  [STATUS.BELUM_WAKTUNYA]: { badge: 'bg-slate-50 text-slate-400', dot: 'bg-slate-200' },
  [STATUS.BELUM_MASUK]: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  [STATUS.BELUM_ABSEN]: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  [STATUS.TANPA_DATA]: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  [STATUS.TANPA_KETERANGAN]: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};
export const warnaStatus = (key) => WARNA_STATUS[key] || WARNA_STATUS[STATUS.TANPA_DATA];

// Label alternatif yang lebih enak dibaca di kartu "Status Harian Tim".
export const LABEL_PAPAN = { [STATUS.HADIR]: 'Hadir' };

/**
 * Status UTAMA seorang karyawan pada SATU tanggal. Selalu mengembalikan tepat satu status.
 *
 * Urutan prioritas (sesuai aturan bisnis):
 *   1. Izin/Sakit/Cuti resmi (approved) yang berlaku pada tanggal itu.
 *      → kalau ternyata dia JUGA absen masuk, status izin tetap ditampilkan TAPI
 *        `konflik:true` supaya manajer melihat peringatan, bukan diam-diam dipilihkan.
 *   2. Ada absen masuk → Terlambat / Belum pulang / Tepat waktu.
 *   3. Jadwal libur.
 *   4. Tanggal masa depan → belum waktunya.
 *   5. Hari ini → Belum masuk (sebelum jam masuk) / Belum absen (jam kerja berjalan)
 *      / Belum ada keterangan (jam kerja selesai).
 *   6. Tanggal lampau tanpa data apa pun → "Belum ada keterangan".
 *      Sengaja BUKAN "Tanpa Keterangan" (alpa) karena app belum punya kalender hari
 *      libur nasional — memvonis alpa otomatis berbahaya. Saklarnya sudah disiapkan:
 *      set `tegasTanpaKeterangan:true` kalau nanti aturannya sudah aman.
 */
export function hitungStatusHarian({
  tanggal,
  hariIni,
  menitSekarang = 0,
  masuk = null,
  pulang = null,
  izin = null,
  jadwal = {},
  tegasTanpaKeterangan = false,
} = {}) {
  const konflik = !!(izin && masuk);
  if (izin) {
    const key = izin.type === 'sakit' ? STATUS.SAKIT : izin.type === 'cuti' ? STATUS.CUTI : STATUS.IZIN;
    return { key, label: labelIzin(izin), sub: izin.reason || '', konflik, izin };
  }
  if (masuk) {
    if (masuk.late) return { key: STATUS.TERLAMBAT, label: `Terlambat ${masuk.lateBy || 0}m`, sub: '', konflik, izin: null };
    if (!pulang) return { key: STATUS.BELUM_PULANG, label: 'Belum pulang', sub: '', konflik, izin: null };
    return { key: STATUS.HADIR, label: '✓ Tepat waktu', sub: '', konflik, izin: null };
  }
  if (jadwal.libur) return { key: STATUS.LIBUR, label: 'Libur', sub: 'jadwal libur', konflik: false, izin: null };
  if (hariIni && tanggal > hariIni) return { key: STATUS.BELUM_WAKTUNYA, label: '–', sub: 'belum waktunya', konflik: false, izin: null };
  if (tanggal === hariIni) {
    const mulai = parseJam(jadwal.jamMasuk);
    const selesai = parseJam(jadwal.jamPulang);
    if (mulai != null && menitSekarang < mulai) return { key: STATUS.BELUM_MASUK, label: 'Belum masuk', sub: `jadwal ${jadwal.jamMasuk}`, konflik: false, izin: null };
    if (selesai != null && menitSekarang < selesai) return { key: STATUS.BELUM_ABSEN, label: 'Belum absen', sub: 'jam kerja berjalan', konflik: false, izin: null };
    return { key: STATUS.TANPA_DATA, label: 'Belum ada keterangan', sub: 'jam kerja selesai', konflik: false, izin: null };
  }
  return tegasTanpaKeterangan
    ? { key: STATUS.TANPA_KETERANGAN, label: 'Tanpa keterangan', sub: 'tidak absen & tidak ada izin', konflik: false, izin: null }
    : { key: STATUS.TANPA_DATA, label: 'Belum ada keterangan', sub: 'tidak ada absensi & izin', konflik: false, izin: null };
}

// ====== INDEKS (anti N+1) ======
const _byTs = (a, b) => String(a && a.timestamp || '').localeCompare(String(b && b.timestamp || ''));

/**
 * Kelompokkan SEKALI seluruh record absensi. Dipakai agar tidak ada
 * `records.filter(...)` di dalam loop per-karyawan (O(user × record)).
 * @returns {{perHari:Map<string,{tanggal,userId,ins:[],outs:[]}>, perUser:Map<string,{ins:[],outs:[]}>}}
 */
export function indeksAbsensi(records = []) {
  const perHari = new Map();
  const perUser = new Map();
  for (const r of records) {
    if (!r || !r.userId || !r.timestamp) continue;
    const tanggal = wibDayKey(r.timestamp);
    const k = `${tanggal}|${r.userId}`;
    let g = perHari.get(k);
    if (!g) { g = { tanggal, userId: r.userId, userName: r.userName, division: r.division, jobTitle: r.jobTitle, ins: [], outs: [] }; perHari.set(k, g); }
    let pu = perUser.get(r.userId);
    if (!pu) { pu = { ins: [], outs: [] }; perUser.set(r.userId, pu); }
    if (r.type === 'in') { g.ins.push(r); pu.ins.push(r); } else { g.outs.push(r); pu.outs.push(r); }
  }
  for (const g of perHari.values()) { g.ins.sort(_byTs); g.outs.sort(_byTs); }
  return { perHari, perUser };
}

/** Kelompokkan izin per userId (sekali jalan). */
export function indeksIzin(leaves = []) {
  const perUser = new Map();
  for (const l of leaves) {
    if (!l || !l.userId) continue;
    const a = perUser.get(l.userId);
    if (a) a.push(l); else perUser.set(l.userId, [l]);
  }
  return perUser;
}

/** Ringkas satu grup (1 orang, 1 hari) → jam masuk pertama, jam pulang terakhir, durasi menit. */
export function ringkasHari(grup) {
  const masuk = (grup && grup.ins && grup.ins[0]) || null;
  const pulang = (grup && grup.outs && grup.outs.length) ? grup.outs[grup.outs.length - 1] : null;
  const durasiMenit = (masuk && pulang)
    ? Math.max(0, Math.round((new Date(pulang.timestamp) - new Date(masuk.timestamp)) / 60000))
    : null;
  return { masuk, pulang, durasiMenit };
}

// ====== AKTIVITAS TERAKHIR ======
/**
 * Kapan terakhir orang ini "muncul" — dipisah jadi dua informasi:
 *   terakhirHadir : absen masuk paling akhir (kapan terakhir benar-benar hadir)
 *   terakhir      : aktivitas paling akhir, bisa 'hadir' ATAU izin/sakit/cuti
 *
 * Penting: izin bertanggal MASA DEPAN tidak dihitung sebagai "aktivitas terakhir"
 * (itu rencana, bukan aktivitas). Izin yang rentangnya masih berjalan dipotong
 * di hari ini supaya tidak terlihat seperti aktivitas di masa depan.
 */
export function aktivitasTerakhir({ masukList = [], izinList = [], hariIni = wibDayKey() } = {}) {
  let hadir = null;
  for (const r of masukList) {
    if (!r || r.type !== 'in' || !r.timestamp) continue;
    const tanggal = wibDayKey(r.timestamp);
    if (tanggal > hariIni) continue; // absen bertanggal masa depan (hasil edit) diabaikan
    if (!hadir || tanggal > hadir.tanggal) hadir = { tanggal, ts: r.timestamp, rec: r };
    else if (tanggal === hadir.tanggal && r.timestamp < hadir.ts) hadir = { tanggal, ts: r.timestamp, rec: r };
  }
  let izin = null;
  for (const l of izinList) {
    if (!l || l.status !== 'approved') continue;
    const mulai = izinMulai(l);
    if (!mulai || mulai > hariIni) continue; // izin yang belum berjalan
    const selesai = izinSelesai(l);
    const efektif = selesai > hariIni ? hariIni : selesai;
    if (!izin || efektif > izin.tanggal) izin = { tanggal: efektif, izin: l };
  }
  let terakhir = null;
  if (hadir && (!izin || hadir.tanggal >= izin.tanggal)) {
    terakhir = { jenis: 'hadir', tanggal: hadir.tanggal, ts: hadir.ts, rec: hadir.rec, izin: null };
  } else if (izin) {
    terakhir = { jenis: izin.izin.type || 'izin', tanggal: izin.tanggal, ts: null, rec: null, izin: izin.izin };
  }
  return { terakhirHadir: hadir, terakhir };
}

// ====== BARIS REKAP (riwayat absensi) ======
/**
 * Bangun baris rekap "1 orang × 1 hari" untuk tabel Riwayat Absensi.
 * Menggabungkan tiga sumber sekaligus supaya rekap benar-benar mewakili STATUS
 * KEHADIRAN, bukan sekadar log check-in:
 *   - absensi (check-in/check-out)
 *   - izin/sakit/cuti yang disetujui (termasuk yang rentangnya multi-hari)
 *   - karyawan yang tidak punya keduanya (opsional, lewat `sertakanTanpaData`)
 *
 * @param {object}   o
 * @param {Array}    o.users             karyawan yang boleh dilihat pemakai saat ini
 * @param {object}   o.indeks            hasil indeksAbsensi()
 * @param {Map}      o.izinPerUser       hasil indeksIzin()
 * @param {string}   o.start             '' = tanpa batas awal
 * @param {string}   o.end               '' = tanpa batas akhir
 * @param {string}   o.hariIni
 * @param {number}   o.menitSekarang
 * @param {Function} o.jadwalUntuk       (userId, tanggal) → { jamMasuk, jamPulang, libur, ... }
 * @param {boolean}  o.sertakanTanpaData tampilkan juga yang tidak absen & tidak izin
 * @param {number}   o.maksHari          batas hari saat menelusuri rentang
 */
export function bangunBarisRekap({
  users = [],
  indeks = { perHari: new Map(), perUser: new Map() },
  izinPerUser = new Map(),
  start = '',
  end = '',
  hariIni = wibDayKey(),
  menitSekarang = 0,
  jadwalUntuk = () => ({}),
  sertakanTanpaData = false,
  maksHari = 400,
} = {}) {
  const olehId = new Map(users.map(u => [u.id, u]));
  const perHari = (indeks && indeks.perHari) || new Map();

  // Kumpulkan pasangan (tanggal, userId) yang perlu dibuat barisnya.
  // Pakai Set supaya satu orang tidak pernah muncul dua kali pada tanggal yang sama.
  const pasangan = new Map(); // 'tanggal|userId' → { tanggal, userId }
  const tambah = (tanggal, userId) => {
    if (!tanggal || !userId || !olehId.has(userId)) return;
    if (!dalamRentang(tanggal, start, end)) return;
    const k = `${tanggal}|${userId}`;
    if (!pasangan.has(k)) pasangan.set(k, { tanggal, userId });
  };

  // 1. dari absensi
  for (const g of perHari.values()) tambah(g.tanggal, g.userId);

  // 2. dari izin yang disetujui — termasuk setiap hari dalam rentang izin multi-hari
  for (const [userId, daftar] of izinPerUser) {
    if (!olehId.has(userId)) continue;
    for (const l of daftar) {
      if (!l || l.status !== 'approved') continue;
      const a = izinMulai(l), b = izinSelesai(l);
      if (!a) continue;
      // Potong ke rentang filter dulu supaya izin panjang tidak menelusuri ratusan hari.
      const dari = start && start > a ? start : a;
      const sampai = end && end < b ? end : b;
      for (const dk of daftarHari(dari, sampai, maksHari)) tambah(dk, userId);
    }
  }

  // 3. karyawan tanpa absensi & tanpa izin (hanya kalau rentangnya jelas)
  if (sertakanTanpaData && start && end) {
    for (const dk of daftarHari(start, end, maksHari)) {
      for (const u of users) tambah(dk, u.id);
    }
  }

  const baris = [];
  for (const { tanggal, userId } of pasangan.values()) {
    const u = olehId.get(userId);
    const grup = perHari.get(`${tanggal}|${userId}`) || null;
    const { masuk, pulang, durasiMenit } = ringkasHari(grup);
    const izin = izinPadaTanggal(izinPerUser.get(userId), tanggal);
    const status = hitungStatusHarian({
      tanggal, hariIni, menitSekarang, masuk, pulang, izin,
      jadwal: jadwalUntuk(userId, tanggal) || {},
    });
    baris.push({
      key: `${tanggal}|${userId}`,
      tanggal, userId,
      userName: (grup && grup.userName) || u.name,
      division: u.division || (grup && grup.division) || '',
      jobTitle: u.jobTitle || (grup && grup.jobTitle) || '',
      ins: (grup && grup.ins) || [],
      outs: (grup && grup.outs) || [],
      masuk, pulang, durasiMenit, izin, status,
    });
  }
  // Tanggal terbaru dulu, lalu nama A→Z (sesuai permintaan rekap).
  baris.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || String(a.userName || '').localeCompare(String(b.userName || '')));
  return baris;
}

/** Hitung jumlah per status untuk kartu ringkasan. */
export function ringkasStatus(baris = []) {
  const n = {};
  let konflik = 0;
  for (const b of baris) {
    const k = b && b.status && b.status.key;
    if (!k) continue;
    n[k] = (n[k] || 0) + 1;
    if (b.status.konflik) konflik++;
  }
  return {
    ...n,
    hadirTotal: (n[STATUS.HADIR] || 0) + (n[STATUS.TERLAMBAT] || 0) + (n[STATUS.BELUM_PULANG] || 0),
    izinTotal: (n[STATUS.IZIN] || 0) + (n[STATUS.SAKIT] || 0) + (n[STATUS.CUTI] || 0),
    konflik,
  };
}
