// ============================================================================
// HITUNGAN KEUANGAN — fungsi MURNI (tanpa React/JSX/storage) supaya bisa diuji
// lewat `node uji-keuangan-aset.mjs` tanpa menjalankan aplikasi.
// ----------------------------------------------------------------------------
// ATURAN: file ini TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
// Semua angka datang dari data asli yang dioper pemanggil — tidak ada nilai
// hardcode/dummy di sini.
// ============================================================================

/**
 * Angka yang benar-benar angka. `null`, `undefined`, dan string kosong DITOLAK
 * (mengembalikan null) — kalau dipaksa lewat `Number()` ketiganya jadi 0/NaN dan
 * bisa menampilkan "0%" untuk nilai yang sebenarnya BELUM ADA.
 * @returns {number|null}
 */
function angkaTegas(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Net Profit Margin = Laba Bersih ÷ Total Pendapatan × 100%.
 *
 * Dibuat "aman angka": pendapatan 0, negatif, NaN, null, undefined, atau Infinity
 * TIDAK PERNAH menghasilkan NaN/Infinity di layar — semuanya jadi
 * `dapatDihitung:false` + teks "Belum dapat dihitung".
 *
 * @returns {{dapatDihitung:boolean, nilai:number|null, teks:string}}
 */
export function hitungNpm(labaBersih, totalPendapatan) {
  const laba = angkaTegas(labaBersih);
  const pend = angkaTegas(totalPendapatan);
  if (laba === null || pend === null || pend === 0) {
    return { dapatDihitung: false, nilai: null, teks: 'Belum dapat dihitung' };
  }
  const nilai = (laba / pend) * 100;
  if (!Number.isFinite(nilai)) {
    return { dapatDihitung: false, nilai: null, teks: 'Belum dapat dihitung' };
  }
  return { dapatDihitung: true, nilai, teks: fmtPersen(nilai) };
}

/** Persen gaya Indonesia, maksimal 2 angka di belakang koma. Contoh: "21,34%". */
export function fmtPersen(n, maksDesimal = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '–';
  return `${v.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: maksDesimal })}%`;
}

/**
 * Deret Laba Bersih = Pendapatan − Beban, titik per titik.
 * Dipakai grafik "Tren 6 Bulan" supaya garis laba SELALU konsisten dengan dua
 * garis lainnya (tidak dihitung dari sumber lain).
 *
 * @param {Array<{date:string,value:number,day?:string}>} pendapatan
 * @param {Array<{date:string,value:number,day?:string}>} beban
 */
export function deretLabaBersih(pendapatan = [], beban = []) {
  return pendapatan.map((p, i) => {
    const b = beban[i];
    const nilaiP = Number(p && p.value) || 0;
    const nilaiB = Number(b && b.value) || 0;
    return { date: p.date, day: p.day, value: nilaiP - nilaiB };
  });
}

/** true kalau ada minimal satu titik yang tidak nol (untuk menentukan "ada data"). */
export const adaIsinya = (...deret) => deret.some(d => (d || []).some(t => Number(t && t.value) !== 0));
