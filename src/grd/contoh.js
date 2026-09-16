// ============================================================================
// GRD — DATA TIRUAN (stub) untuk Pohon Roll Down.
// ----------------------------------------------------------------------------
// SEMENTARA. Dipakai supaya halaman Pohon Roll Down bisa dibuka & diklik-klik
// sebelum penyimpanannya (`grdgoal:rec:<id>` di kv_store) dikerjakan. Begitu
// modul penyimpanan siap, halaman tinggal mengganti sumber datanya dan file ini
// boleh dihapus — tidak ada modul lain yang bergantung padanya.
//
// SIFAT WAJIB: DETERMINISTIK. Angkanya diturunkan dari id pengguna, bukan
// Math.random — kalau acak, angka di kartu akan berubah sendiri tiap render dan
// mustahil dinilai saat pengecekan tampilan.
//
// Sama seperti modul GRD lainnya: TIDAK BOLEH meng-import App.jsx.
// ============================================================================

import { periodeSaatIni } from './data.js';

/** Angka semu 0..(n-1) dari sebuah teks — stabil untuk id yang sama. */
function cacah(teks, n) {
  const s = String(teks || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return n > 0 ? h % n : 0;
}

// Contoh goal per peran. Ini BUKAN "Template per Peran" yang sesungguhnya
// (itu task tersendiri) — hanya bahan supaya pohon terlihat berisi.
const CONTOH_PERAN = {
  owner: [
    { description: 'GMV seluruh Al-Kahfi Corp', base: 6, target: 12, uom: 'Miliar Rupiah' },
    { description: 'Affiliator aktif produktif', base: 18, target: 30, uom: 'Orang' },
  ],
  manajer: [
    { description: 'GMV divisi yang dikelola', base: 1.5, target: 3, uom: 'Miliar Rupiah' },
    { description: 'Ketepatan laporan mingguan tim', base: 60, target: 95, uom: 'Persen' },
  ],
  leader: [
    { description: 'GMV tim', base: 400, target: 900, uom: 'Juta Rupiah' },
    { description: 'Anggota tim lulus kelas wajib', base: 2, target: 8, uom: 'Orang' },
  ],
  wakil: [
    { description: 'Pendampingan anggota tim', base: 4, target: 12, uom: 'Sesi' },
  ],
  operasional: [
    { description: 'Konten affiliate tayang', base: 8, target: 30, uom: 'Konten' },
    { description: 'Sampel produk terpakai', base: 3, target: 10, uom: 'Produk' },
  ],
};

/**
 * Bangun goal tiruan untuk daftar pengguna.
 * Sebagian orang sengaja DIBIARKAN tanpa goal (kira-kira 1 dari 4) supaya
 * tampilan "belum punya goal" ikut teruji, bukan hanya tampilan yang rapi.
 */
export function goalContoh(users = [], periode = periodeSaatIni('bulan')) {
  const keluar = [];
  for (const u of users) {
    if (!u || !u.id) continue;
    if (cacah(u.id + ':punya', 4) === 0) continue; // ~25% tanpa goal
    const bahan = CONTOH_PERAN[u.role] || CONTOH_PERAN.operasional;
    const banyak = 1 + cacah(u.id + ':jml', bahan.length);
    for (let i = 0; i < banyak; i++) {
      const b = bahan[i];
      const maju = cacah(u.id + ':maju' + i, 130) / 100; // 0.00 – 1.29 (sebagian lewat target)
      keluar.push({
        id: `contoh-${u.id}-${i}`,
        ownerId: u.id,
        parentId: u.leaderId ? `contoh-${u.leaderId}-0` : null,
        periode,
        description: b.description,
        base: b.base,
        target: b.target,
        uom: b.uom,
        actual: Math.round((b.base + (b.target - b.base) * maju) * 100) / 100,
        _contoh: true, // penanda: data tiruan, bukan data sungguhan
      });
    }
  }
  return keluar;
}
