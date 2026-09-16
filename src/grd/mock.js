// ============================================================================
// GRD — MOCK untuk PENGUJIAN (bukan untuk aplikasi).
// ----------------------------------------------------------------------------
// Penyimpanan & RPC tiruan di memori, supaya jalur tulis src/grd/layanan.js bisa
// diperiksa tanpa Supabase dan TANPA PERNAH menyentuh database production.
//
// Diangkat ke file sendiri (dulu tinggal di dalam uji-grd.mjs) karena modul GRD
// akan terus bertambah — Lead Measure dan Scoreboard butuh dudukan uji yang sama.
// Kalau tiap file uji menulis mock-nya sendiri, perilakunya cepat menyimpang dan
// uji jadi menguji mock yang berbeda-beda, bukan layanan yang sama.
//
// TIDAK di-import App.jsx, jadi tidak pernah ikut masuk bundle produksi.
// Sama seperti modul GRD lain: TIDAK BOLEH meng-import App.jsx.
// ============================================================================

import * as Svc from './layanan.js';

/**
 * kv_store tiruan.
 *
 * Merekam `prefixDiminta` supaya uji bisa membuktikan sesuatu yang tidak terlihat
 * dari hasil akhir: bahwa riwayat ditarik per goal, bukan dengan membaca seluruh
 * jejak tim. Tanpa rekaman itu, kedua cara menghasilkan jawaban yang sama dan
 * pemborosannya lolos tanpa ketahuan.
 */
export function storageMock(awal = {}) {
  const baris = new Map(Object.entries(awal));
  return {
    baris,
    prefixDiminta: [],
    gagalSet: false,       // true → semua tulis gagal (menguji penanganan kegagalan)
    async listByPrefix(prefix) {
      this.prefixDiminta.push(prefix);
      return [...baris.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => v);
    },
    async get(k) { return baris.has(k) ? baris.get(k) : null; },
    async set(k, v) { if (this.gagalSet) return false; baris.set(k, v); return true; },
    async delete(k) { baris.delete(k); return true; },

    // ---- bantuan pemeriksaan ----
    kunci(prefix = '') { return [...baris.keys()].filter(k => k.startsWith(prefix)); },
    jumlah(prefix = '') { return this.kunci(prefix).length; },
    bersihkanRekaman() { this.prefixDiminta = []; },
  };
}

/**
 * RPC tiruan.
 *   belumDipasang → meniru fungsi SQL yang belum dijalankan (app harus fallback)
 *   tolakDengan   → meniru penolakan aturan dari server (TIDAK boleh di-fallback)
 */
export function rpcMock({ belumDipasang = false, tolakDengan = null, rekam = [] } = {}) {
  const fn = async (nama, args) => {
    rekam.push({ nama, args });
    if (belumDipasang) {
      return { data: null, error: { message: `Could not find the function public.${nama} in the schema cache` } };
    }
    if (tolakDengan) return { data: null, error: { message: tolakDengan } };
    return { data: args.p_goal || true, error: null };
  };
  fn.rekam = rekam;
  fn.dipanggil = (nama) => rekam.filter(r => r.nama === nama).length;
  return fn;
}

/**
 * Pasang layanan GRD di atas mock. Mengembalikan handle-nya supaya uji bisa
 * memeriksa isi penyimpanan langsung.
 *
 * `jalur`: 'kv' (paksa tulis langsung), 'rpc' (paksa lewat RPC), 'auto' (probe).
 */
export function pasangMockGrd({ awal = {}, rpc = null, jalur = 'kv' } = {}) {
  const storage = storageMock(awal);
  Svc.setJalurGrd(jalur);
  Svc.initGrd({ storage, rpc, log: null });
  return { storage, rpc };
}

/** Kembalikan layanan ke keadaan netral setelah uji selesai. */
export function lepasMockGrd() {
  Svc.setJalurGrd('auto');
}
