// ============================================================================
// MODUL ASET (inventaris) — konstanta + fungsi MURNI.
// Tanpa React/JSX/storage supaya bisa diuji `node uji-keuangan-aset.mjs`.
// ----------------------------------------------------------------------------
// ATURAN: TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
//
// Bentuk 1 record aset (disimpan per-record di kv_store: 'aset:rec:<id>'):
//   { id, kode, nama, kategori, divisi, jumlah, hargaSatuan, tanggalBeli,
//     kondisi, lokasi, catatan, createdAt, createdById, createdByName, updatedAt }
//
// SEMUA field selain `id` boleh kosong pada data lama/impor — `normalisasiAset()`
// memberi default yang wajar supaya tampilan & hitungan tidak pernah pecah.
// ============================================================================

export const ASET_REC_PREFIX = 'aset:rec:';
export const ASET_BACKUP_KEY = 'aset:all';

export const ASET_KATEGORI = [
  'Elektronik', 'Komputer & Laptop', 'Kamera & Audio', 'Furniture',
  'Kendaraan', 'Peralatan Studio', 'Perlengkapan Kantor', 'Lainnya',
];

export const ASET_KONDISI = {
  baik: { label: 'Baik', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  perbaikan: { label: 'Perlu Perbaikan', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  rusak: { label: 'Rusak', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  hilang: { label: 'Hilang', badge: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400' },
};
export const kondisiInfo = (k) => ASET_KONDISI[k] || ASET_KONDISI.baik;

// ====== NORMALISASI (aman untuk data lama / field yang belum ada) ======
export function normalisasiAset(a) {
  if (!a || typeof a !== 'object') return null;
  const jumlah = Number(a.jumlah);
  const harga = Number(a.hargaSatuan);
  return {
    ...a,
    kode: String(a.kode || '').trim(),
    nama: String(a.nama || '').trim(),
    kategori: a.kategori || 'Lainnya',
    divisi: a.divisi || 'corp',
    // Kuantitas minimal 1: data lama tanpa `jumlah` tetap dihitung 1 unit, bukan 0.
    jumlah: Number.isFinite(jumlah) && jumlah > 0 ? Math.floor(jumlah) : 1,
    // Harga boleh BELUM diisi → null (bukan 0), supaya bisa dibedakan
    // "gratis/hibah" dengan "belum dicatat" saat ditampilkan.
    hargaSatuan: Number.isFinite(harga) && harga >= 0 ? harga : null,
    tanggalBeli: /^\d{4}-\d{2}-\d{2}$/.test(a.tanggalBeli || '') ? a.tanggalBeli : '',
    kondisi: ASET_KONDISI[a.kondisi] ? a.kondisi : 'baik',
    lokasi: String(a.lokasi || '').trim(),
    catatan: String(a.catatan || '').trim(),
  };
}

/** Nilai pembelian satu record = harga per unit × kuantitas. Belum ada harga → 0. */
export function nilaiAset(a) {
  const n = normalisasiAset(a);
  if (!n || n.hargaSatuan == null) return 0;
  return n.hargaSatuan * n.jumlah;
}

/**
 * Ringkasan untuk kartu "Total Nilai Pembelian Aset" di Dashboard Keuangan.
 * Sengaja TIDAK dinamai "nilai buku"/"nilai saat ini" karena app belum punya penyusutan.
 *
 * @param {Array} list daftar aset
 * @param {string} divisi 'all' atau key divisi keuangan (mcn/tap/affiliator/corp)
 */
export function ringkasAset(list = [], divisi = 'all') {
  let jumlahData = 0, totalUnit = 0, totalNilai = 0, tanpaHarga = 0, tanpaTanggal = 0;
  for (const raw of list) {
    const a = normalisasiAset(raw);
    if (!a) continue;
    if (divisi !== 'all' && a.divisi !== divisi) continue;
    jumlahData++;
    totalUnit += a.jumlah;
    totalNilai += nilaiAset(a);
    if (a.hargaSatuan == null) tanpaHarga++;
    if (!a.tanggalBeli) tanpaTanggal++;
  }
  return { jumlahData, totalUnit, totalNilai, tanpaHarga, tanpaTanggal };
}

/** Nilai pembelian per divisi (untuk rincian). */
export function nilaiPerDivisi(list = []) {
  const r = {};
  for (const raw of list) {
    const a = normalisasiAset(raw);
    if (!a) continue;
    r[a.divisi] = (r[a.divisi] || 0) + nilaiAset(a);
  }
  return r;
}

// ====== KODE ASET UNIK ======
export const KODE_VALID = /^[A-Z0-9][A-Z0-9-]{1,23}$/;
export const rapikanKode = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '-');

/** true kalau kode sudah dipakai aset LAIN (case-insensitive). */
export function kodeTerpakai(list = [], kode, kecualiId = null) {
  const k = rapikanKode(kode);
  if (!k) return false;
  return list.some(a => a && a.id !== kecualiId && rapikanKode(a.kode) === k);
}

/** Kode berikutnya bergaya AST-0001, melanjutkan nomor tertinggi yang sudah ada. */
export function kodeBerikutnya(list = [], prefix = 'AST') {
  let maks = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const a of list) {
    const m = re.exec(rapikanKode(a && a.kode));
    if (m) maks = Math.max(maks, Number(m[1]) || 0);
  }
  return `${prefix}-${String(maks + 1).padStart(4, '0')}`;
}

/** Validasi form aset. Mengembalikan pesan error (string) atau null bila lolos. */
export function validasiAset(form, daftar = [], kecualiId = null) {
  const kode = rapikanKode(form && form.kode);
  if (!kode) return 'Kode aset wajib diisi.';
  if (!KODE_VALID.test(kode)) return 'Kode aset hanya boleh huruf besar, angka, dan tanda hubung (2–24 karakter).';
  if (kodeTerpakai(daftar, kode, kecualiId)) return `Kode "${kode}" sudah dipakai aset lain. Gunakan kode yang berbeda.`;
  if (!String(form && form.nama || '').trim()) return 'Nama aset wajib diisi.';
  const jml = Number(form && form.jumlah);
  if (form && form.jumlah !== '' && form.jumlah != null && (!Number.isFinite(jml) || jml < 1)) return 'Jumlah minimal 1.';
  const hrg = Number(form && form.hargaSatuan);
  if (form && form.hargaSatuan !== '' && form.hargaSatuan != null && (!Number.isFinite(hrg) || hrg < 0)) return 'Harga pembelian tidak boleh negatif.';
  if (form && form.tanggalBeli && !/^\d{4}-\d{2}-\d{2}$/.test(form.tanggalBeli)) return 'Tanggal pembelian tidak valid.';
  return null;
}

/** Tanggal gaya Indonesia untuk tampilan. Kosong → '–'. */
export function fmtTanggalId(dk) {
  if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) return '–';
  return new Date(dk + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ============================================================================
// BARCODE CODE 128-B — encoder murni, TANPA dependency baru.
// ----------------------------------------------------------------------------
// Dipilih Code 128 (bukan QR) karena bisa dibuat benar dalam ~60 baris kode dan
// terbaca oleh semua aplikasi pemindai; membuat encoder QR dari nol butuh
// Reed-Solomon (ratusan baris) dan risikonya jauh lebih besar untuk app produksi.
// Isi barcode = KODE ASET yang unik (bukan nama aset).
// ============================================================================

// Tabel lebar batang standar Code 128 (indeks 0–106). Tiap pola = lebar
// bar/spasi bergantian dan berjumlah 11 modul (pola STOP 13 modul).
const POLA_128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
export const POLA_CODE128 = POLA_128;
const START_B = 104, STOP = 106;

/** Nilai Code 128-B sebuah karakter (ASCII 32–126). -1 kalau tidak didukung. */
export const nilaiCode128B = (ch) => {
  const c = ch.charCodeAt(0);
  return (c >= 32 && c <= 126) ? c - 32 : -1;
};

/** true kalau seluruh karakter teks bisa di-encode Code 128-B. */
export const bisaBarcode = (teks) => {
  const s = String(teks || '');
  return s.length > 0 && s.length <= 48 && [...s].every(ch => nilaiCode128B(ch) >= 0);
};

/**
 * Encode teks → daftar indeks simbol Code 128-B (start, data…, checksum, stop).
 * @returns {number[]|null} null bila ada karakter yang tidak didukung.
 */
export function indeksCode128B(teks) {
  const s = String(teks || '');
  if (!bisaBarcode(s)) return null;
  const nilai = [...s].map(nilaiCode128B);
  let jumlah = START_B;
  nilai.forEach((v, i) => { jumlah += v * (i + 1); });
  return [START_B, ...nilai, jumlah % 103, STOP];
}

/**
 * Encode teks → daftar segmen batang untuk digambar sebagai SVG.
 * Elemen ganjil = spasi (putih), genap = batang (hitam) — mulai dari batang.
 * @returns {{segmen:Array<{x:number,lebar:number,hitam:boolean}>, totalModul:number}|null}
 */
export function barcodeCode128(teks) {
  const idx = indeksCode128B(teks);
  if (!idx) return null;
  const segmen = [];
  let x = 0;
  for (const i of idx) {
    const pola = POLA_128[i];
    for (let p = 0; p < pola.length; p++) {
      const lebar = Number(pola[p]);
      segmen.push({ x, lebar, hitam: p % 2 === 0 });
      x += lebar;
    }
  }
  return { segmen, totalModul: x };
}
