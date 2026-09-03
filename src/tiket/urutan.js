// ============================================================================
// URUTAN TIKET — fungsi MURNI (tanpa React/JSX/storage) supaya bisa diuji lewat
// `node uji-tiket.mjs` tanpa menjalankan aplikasi.
// ----------------------------------------------------------------------------
// ATURAN: TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
//
// Kenapa diurutkan di sini (frontend) dan bukan lewat query database:
//   Data tiket disimpan di Supabase `kv_store` sebagai KEY-VALUE — satu tiket =
//   satu baris `tasks:rec:<id>` dengan seluruh isinya di kolom JSONB `value`.
//   TIDAK ada kolom `created_at` yang bisa di-ORDER BY, dan `listByPrefix()`
//   (dipakai bersama ~10 modul lain) WAJIB `ORDER BY key` karena paginasi
//   1000-baris-nya bergantung pada urutan key yang stabil. Halaman Tiket juga
//   memuat SELURUH tiket sekaligus (tanpa pagination), jadi mengurutkan set
//   penuh di memori memberi hasil yang identik dengan ORDER BY — bukan sekadar
//   membalik satu halaman yang sedang tampil.
// ============================================================================

export const URUT_DEFAULT = 'terbaru';

export const URUT_TIKET = [
  { id: 'terbaru', label: 'Terbaru dibuat' },
  { id: 'terlama', label: 'Terlama dibuat' },
  { id: 'deadline-dekat', label: 'Deadline terdekat' },
  { id: 'deadline-jauh', label: 'Deadline terjauh' },
  { id: 'prioritas', label: 'Prioritas tertinggi' },
];

/** Tinggi → Sedang → Rendah. Nilai tak dikenal dianggap paling rendah. */
export const BOBOT_PRIORITAS = { high: 3, medium: 2, low: 1 };
export const bobotPrioritas = (p) => BOBOT_PRIORITAS[p] || 0;

/**
 * Waktu dibuat sebuah tiket dalam milidetik.
 *
 * Sumber utama: field `createdAt` (ISO). Kalau kosong — bisa terjadi pada record
 * lama hasil serapan array `tasks:all` — dipakai CADANGAN: `id` dibuat oleh
 * `uid()` = `Date.now().toString(36) + acak`, jadi awalannya bisa didekode balik
 * jadi timestamp. Hasil dekode hanya dipakai bila masuk akal (tahun 2020–2100),
 * supaya id berformat lain tidak menghasilkan tanggal ngawur.
 * @returns {number} 0 kalau benar-benar tidak diketahui (→ dianggap paling lama)
 */
export function waktuDibuat(t) {
  const iso = t && t.createdAt;
  if (iso) {
    const ms = Date.parse(iso);
    if (Number.isFinite(ms)) return ms;
  }
  const id = t && typeof t.id === 'string' ? t.id : '';
  // `Date.now()` dalam basis-36 PERSIS 8 karakter (berlaku s/d tahun 2059), jadi
  // ambil tepat 8 — bukan 8..9. Mengambil 9 karakter ikut menyeret 1 huruf acak
  // dan menghasilkan angka ratusan kali lipat lebih besar (tanggal ngawur).
  const m = /^[0-9a-z]{8}/.exec(id);
  if (m) {
    const ms = parseInt(m[0], 36);
    if (Number.isFinite(ms) && ms > 1577836800000 && ms < 4102444800000) return ms; // 2020–2100
  }
  return 0;
}

/** Deadline sebagai angka. Tanpa deadline → null (selalu ditaruh paling akhir). */
export function waktuDeadline(t) {
  const d = t && t.deadline;
  if (!d) return null;
  const ms = Date.parse(typeof d === 'string' && d.length === 10 ? `${d}T00:00:00` : d);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Urutkan daftar tiket. TIDAK mengubah array asli (aman untuk state React).
 *
 * Aturan umum:
 *   - Tiket TANPA deadline selalu di bawah pada mode deadline (baik terdekat
 *     maupun terjauh) — supaya tiket tak berdeadline tidak menutupi yang penting.
 *   - Semua mode punya tiebreak akhir: terbaru dibuat, lalu id. Jadi urutannya
 *     selalu sama (deterministik) dan tidak "loncat-loncat" antar render.
 */
export function urutkanTiket(list = [], mode = URUT_DEFAULT) {
  const arr = Array.isArray(list) ? [...list] : [];
  const tiebreak = (a, b) =>
    (waktuDibuat(b) - waktuDibuat(a)) || String(a && a.id || '').localeCompare(String(b && b.id || ''));

  const perDeadline = (naik) => (a, b) => {
    const da = waktuDeadline(a), db = waktuDeadline(b);
    if (da === null && db === null) return tiebreak(a, b);
    if (da === null) return 1;   // tanpa deadline → bawah
    if (db === null) return -1;
    return (naik ? da - db : db - da) || tiebreak(a, b);
  };

  switch (mode) {
    case 'terlama':
      return arr.sort((a, b) => (waktuDibuat(a) - waktuDibuat(b)) || String(a && a.id || '').localeCompare(String(b && b.id || '')));
    case 'deadline-dekat':
      return arr.sort(perDeadline(true));
    case 'deadline-jauh':
      return arr.sort(perDeadline(false));
    case 'prioritas':
      return arr.sort((a, b) => (bobotPrioritas(b && b.priority) - bobotPrioritas(a && a.priority)) || tiebreak(a, b));
    case 'terbaru':
    default:
      return arr.sort(tiebreak);
  }
}

/** Label mode urut untuk ditampilkan. */
export const labelUrut = (id) => (URUT_TIKET.find(u => u.id === id) || URUT_TIKET[0]).label;
