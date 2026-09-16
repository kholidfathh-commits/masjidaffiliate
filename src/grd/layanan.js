// ============================================================================
// GRD — MODUL LAYANAN TIPIS (satu jalur untuk seluruh permintaan data GRD)
// ----------------------------------------------------------------------------
// ATURAN: TIDAK BOLEH meng-import App.jsx. `storage` dan `log` DISUNTIK lewat
// initGrd() — pola yang sama persis dengan initLms() di src/lms/data.js.
//
// KENAPA ADA LAPISAN INI:
//   Halaman GRD sengaja TIDAK memanggil `storage` langsung. Semua baca/tulis
//   goal lewat fungsi di file ini. Alasannya sudah disepakati di PRD: kontrol
//   akses akan naik ke Supabase RPC/Edge Function + RLS (Opsi B). Kalau nanti
//   itu dikerjakan, yang berubah hanya ISI fungsi-fungsi di sini — komponen di
//   App.jsx tidak perlu disentuh sama sekali.
//
//   Manfaat keduanya sekarang: pemeriksaan hak akses dan pencatatan jejak tidak
//   bisa "kelupaan" di salah satu tombol, karena cuma ada satu pintu.
//
// CATATAN JUJUR SOAL KEAMANAN: selama pintunya masih di frontend, ini pagar
// PRODUK (menentukan apa yang boleh dilakukan lewat aplikasi), bukan pagar
// kriptografis — sama seperti seluruh app ini. Penutupnya = Supabase Auth + RLS.
// ============================================================================

import * as Grd from './data.js';

const _dep = { storage: null, log: null, rpc: null };

// Jalur tulis: null = belum dicoba, true = RPC siap, false = RPC belum disiapkan
// (pakai kv_store langsung untuk sesi ini). Pola probe + fallback ini sama dengan
// putImage → Supabase Storage di App.jsx: fitur baru TIDAK BOLEH merusak app
// hanya karena setup SQL-nya belum dijalankan.
let _rpcSiap = null;

/** Paksa jalur tertentu — dipakai pengujian. 'auto' mengembalikan probe normal. */
export function setJalurGrd(jalur) {
  _rpcSiap = jalur === 'rpc' ? true : jalur === 'kv' ? false : null;
}
export const jalurGrd = () => (_rpcSiap === true ? 'rpc' : _rpcSiap === false ? 'kv' : 'auto');

/** Pesan yang menandakan fungsi RPC-nya memang belum dipasang (bukan koneksi ngadat). */
function _rpcBelumDipasang(pesan) {
  const m = String(pesan || '').toLowerCase();
  return m.includes('could not find') || m.includes('does not exist')
    || m.includes('function') && m.includes('not') || m.includes('404')
    || m.includes('schema cache') || m.includes('undefined function');
}

/**
 * Coba jalankan lewat RPC. Mengembalikan { pakai:false } bila jalur RPC belum
 * tersedia — pemanggil lalu memakai kv_store seperti biasa.
 *
 * Penolakan dari server (aturan akses) TIDAK di-fallback: itu jawaban yang sah
 * dan harus sampai ke pengguna, bukan disiasati dengan menulis langsung.
 */
async function lewatRpc(nama, args) {
  if (!_dep.rpc || _rpcSiap === false) return { pakai: false };
  try {
    const { data, error } = await _dep.rpc(nama, args);
    if (error) {
      if (_rpcBelumDipasang(error.message)) { _rpcSiap = false; return { pakai: false }; }
      throw new GrdDitolak(error.message);
    }
    _rpcSiap = true;
    return { pakai: true, data };
  } catch (e) {
    if (e instanceof GrdDitolak) throw e;
    if (_rpcBelumDipasang(e && e.message)) { _rpcSiap = false; return { pakai: false }; }
    throw e;
  }
}

/** Suntik dependensi app. Dipanggil SEKALI dari App.jsx. */
export function initGrd(deps) {
  Object.assign(_dep, deps);
}

const st = () => {
  if (!_dep.storage) throw new Error('GRD belum diinisialisasi (initGrd belum dipanggil).');
  return _dep.storage;
};

/** Catat aktivitas bila App menyediakannya; diam saja kalau tidak. */
const catatAktivitas = (teks, namaUser) => {
  try { if (_dep.log) _dep.log(teks, namaUser); } catch { /* jangan sampai gagal-log membatalkan simpan */ }
};

// ============================================================================
// BACA
// ============================================================================

/**
 * Semua goal. Melempar saat koneksi gagal — pemanggil WAJIB menangkapnya dan
 * mempertahankan data lama di layar, jangan mengosongkan daftar (pola yang sama
 * dipakai loadAssets/loadNotes).
 */
export async function ambilGoal() {
  const recs = await st().listByPrefix(Grd.GOAL_REC_PREFIX);
  return recs.map(Grd.normalisasiGoal).filter(Boolean);
}

/** Goal satu periode saja (bulan ikut tertarik oleh kuartal yang memuatnya). */
export async function ambilGoalPeriode(periode) {
  return Grd.goalPeriode(await ambilGoal(), periode);
}

/** Seluruh catatan jejak perubahan. */
export async function ambilJejak() {
  return await st().listByPrefix(Grd.JEJAK_REC_PREFIX);
}

/**
 * SERVICE PENYUSUN POHON ROLL DOWN — satu panggilan menghasilkan pohon siap
 * render beserta angka ringkasannya.
 *
 * Susunan pohonnya dikerjakan fungsi murni `Grd.bangunPohonGoal` (yang sudah
 * diuji terpisah); tugas layanan ini hanya mengambil datanya dan merangkai.
 * Pemisahan itu disengaja: kalau nanti sumbernya pindah ke RPC, logika pohon
 * tidak ikut berubah dan tidak perlu diuji ulang.
 */
export async function susunPohon({ users = [], periode = '', batasKedalaman = 10 } = {}) {
  const goals = await ambilGoal();
  return susunPohonDari({ users, goals, periode, batasKedalaman });
}

/**
 * Versi tanpa baca — dipakai saat goalnya SUDAH ada di tangan (mis. setelah
 * menyimpan, supaya tidak perlu bolak-balik ke server).
 */
export function susunPohonDari({ users = [], goals = [], periode = '', batasKedalaman = 10 } = {}) {
  const pohon = Grd.bangunPohonGoal({ users, goals, periode, batasKedalaman });
  return {
    pohon,
    ringkas: Grd.ringkasPohon(pohon),
    menggantung: Grd.simpulMenggantung(pohon),
    goals: Grd.goalPeriode(goals, periode),
  };
}

/**
 * DETAIL SATU GOAL beserta seluruh konteks yang dibutuhkan panelnya —
 * pemilik, goal induk, goal turunan, dan riwayat perubahannya.
 *
 * Sengaja SATU panggilan, bukan empat: panel detail dibuka dari kartu yang
 * sudah terlihat, jadi menunggu empat perjalanan ke server berturut-turut akan
 * terasa seperti aplikasi menggantung. Kalau nanti pindah ke RPC/Edge Function,
 * bentuk kembaliannya tetap sama dan panelnya tidak perlu diubah.
 *
 * Mengembalikan null bila goalnya sudah tidak ada (mis. dihapus orang lain
 * sementara halaman kita masih terbuka) — pemanggil menampilkan pesan, bukan
 * layar rusak.
 */
export async function ambilDetailGoal(goalId, { allUsers = [], goals = null, jejak = null } = {}) {
  const id = String(goalId || '');
  if (!id) return null;

  const semua = goals || await ambilGoal();
  const goal = semua.map(Grd.normalisasiGoal).find(g => g && g.id === id);
  if (!goal) return null;

  const catatan = jejak || await ambilJejak();
  return {
    goal,
    pemilik: Grd.pemilikGoal(goal, allUsers),
    induk: Grd.goalInduk(goal, semua),
    turunan: Grd.goalTurunan(goal, semua),
    riwayat: Grd.riwayatGoal(catatan, id),
    persen: Grd.persenCapaian(goal),
    status: Grd.statusCapaian(goal),
    sisa: Grd.sisaMenujuTarget(goal),
  };
}

/**
 * QUERY POHON PER PERIODE — satu pintu untuk halaman Pohon Goal.
 *
 * Menerima periode DAN filter pencarian sekaligus, lalu mengembalikan semua
 * yang dibutuhkan layar dalam satu bentuk: pohon tersaring, pohon utuh
 * (untuk tombol lipat/buka yang tetap mengacu struktur penuh), angka ringkasan,
 * daftar anggota yang jalur atasannya putus, dan pilihan periode yang berisi.
 *
 * Penyaringan dikerjakan di sini (di memori), bukan di query, karena kv_store
 * menyimpan goal sebagai JSONB tanpa kolom yang bisa di-WHERE — alasan yang
 * sama persis dengan pencarian di src/catatan/data.js.
 */
export async function queryPohon({
  users = [], periode = '', kata = '', divisi = 'all',
  jenis = Grd.JENIS_PERIODE_DEFAULT, goals = null,
} = {}) {
  const semua = goals || await ambilGoal();
  const dasar = susunPohonDari({ users, goals: semua, periode });
  const tersaring = Grd.saringPohon(dasar.pohon, { kata, divisi });
  return {
    ...dasar,
    pohonPenuh: dasar.pohon,
    pohon: tersaring,
    cocok: Grd.hitungCocok(tersaring),
    mencari: String(kata || '').trim() !== '' || (!!divisi && divisi !== 'all'),
    pilihanPeriode: Grd.pilihanPeriodeLengkap(jenis, periode, semua),
    semuaGoal: semua,
  };
}

/**
 * ENDPOINT PENCARIAN GOAL — hasil datar, lintas periode kalau periodenya kosong.
 *
 * `hanyaYangBisaDiurus` membatasi hasil ke goal yang memang boleh diubah
 * pengguna (dirinya + bawahannya). Dipakai halaman Kelola Goal supaya pencarian
 * tidak pernah memunculkan goal yang tombol simpannya nanti ditolak.
 */
export async function cariGoal({
  kata = '', divisi = 'all', periode = '', ownerId = '',
  user = null, allUsers = [], hanyaYangBisaDiurus = false, goals = null,
} = {}) {
  let semua = goals || await ambilGoal();
  if (hanyaYangBisaDiurus) semua = Grd.goalYangBisaDikelola(user, semua, allUsers);

  const hasil = Grd.cariGoalDatar(semua, allUsers, { kata, divisi, periode, ownerId });
  return {
    hasil,
    jumlah: hasil.length,
    mencari: String(kata || '').trim() !== '' || (!!divisi && divisi !== 'all') || !!ownerId,
    semuaGoal: semua,
  };
}

// ============================================================================
// TULIS
// ----------------------------------------------------------------------------
// Tiap penulisan MEMERIKSA HAK AKSES LEBIH DULU, di sini — bukan mengandalkan
// tombol yang disembunyikan di layar.
// ============================================================================

/** Dilempar saat hak akses/validasi menolak; pemanggil menampilkan `message` apa adanya. */
export class GrdDitolak extends Error {
  constructor(pesan) { super(pesan); this.name = 'GrdDitolak'; }
}

/**
 * Simpan goal (baru atau ubah) + catat jejak perubahannya.
 * `goalLama` null berarti goal baru.
 */
export async function simpanGoal(goal, { user, allUsers, goalLama = null } = {}) {
  const g = Grd.normalisasiGoal(goal);
  if (!g) throw new GrdDitolak('Data goal tidak terbaca.');

  const salah = Grd.validasiGoal(g);
  if (salah) throw new GrdDitolak(salah);

  // Dua pemeriksaan berbeda: mengubah goal yang sudah ada vs membuat goal atas
  // nama orang lain. Keduanya wajib — kalau hanya salah satu, atasan bisa
  // "memindahkan" goal ke orang yang bukan bawahannya lewat form ubah.
  if (goalLama) {
    if (!Grd.bisaUbahGoal(user, goalLama, allUsers)) {
      throw new GrdDitolak('Anda tidak berwenang mengubah goal ini.');
    }
  }
  if (!Grd.bisaBuatGoalUntuk(user, g.ownerId, allUsers)) {
    throw new GrdDitolak('Anda tidak berwenang membuat goal atas nama orang itu.');
  }

  // Jalur server dulu bila tersedia; kalau belum disiapkan, tulis langsung.
  const viaRpc = await lewatRpc('grd_simpan_goal', { p_goal: g });
  if (!viaRpc.pakai) {
    const ok = await st().set(Grd.GOAL_REC_PREFIX + g.id, g);
    if (!ok) throw new GrdDitolak('Gagal menyimpan goal. Coba lagi saat koneksi stabil.');
  }

  await tulisJejak(Grd.catatPerubahan(goalLama, g, user));
  catatAktivitas(`${goalLama ? 'mengubah' : 'membuat'} goal "${g.description}"`, user && user.name);
  return g;
}

/** Hapus goal. Turunannya TIDAK ikut terhapus — hanya rantainya yang terputus. */
export async function hapusGoal(goal, { user, allUsers } = {}) {
  const g = Grd.normalisasiGoal(goal);
  if (!g || !g.id) throw new GrdDitolak('Data goal tidak terbaca.');
  if (!Grd.bisaUbahGoal(user, g, allUsers)) {
    throw new GrdDitolak('Anda tidak berwenang menghapus goal ini.');
  }
  const viaRpc = await lewatRpc('grd_hapus_goal', { p_id: g.id });
  if (!viaRpc.pakai) {
    const ok = await st().delete(Grd.GOAL_REC_PREFIX + g.id);
    if (!ok) throw new GrdDitolak('Gagal menghapus goal. Coba lagi.');
  }
  catatAktivitas(`menghapus goal "${g.description}"`, user && user.name);
  return true;
}

/**
 * Turunkan goal ke seluruh bawahan langsung pemiliknya.
 * Rencananya disusun fungsi murni, lalu ditulis satu per satu supaya kegagalan
 * di tengah tidak membatalkan yang sudah berhasil.
 */
export async function turunkanGoal(goal, { user, allUsers, bagiRata, goalAda } = {}) {
  const g = Grd.normalisasiGoal(goal);
  if (!g || !g.id) throw new GrdDitolak('Data goal tidak terbaca.');
  if (!Grd.bisaUbahGoal(user, g, allUsers)) {
    throw new GrdDitolak('Anda tidak berwenang menurunkan goal ini.');
  }

  const ada = goalAda || await ambilGoal();
  const rencana = Grd.rencanaTurunan(g, allUsers, { bagiRata, goalAda: ada });
  if (rencana.length === 0) return [];

  const dibuat = [];
  for (const r of rencana) {
    const baru = { ...r, id: buatId() };
    const viaRpc = await lewatRpc('grd_simpan_goal', { p_goal: baru });
    if (!viaRpc.pakai) {
      const ok = await st().set(Grd.GOAL_REC_PREFIX + baru.id, baru);
      if (!ok) continue; // satu gagal tidak membatalkan yang lain
    }
    dibuat.push(baru);
    await tulisJejak(Grd.catatPerubahan(null, baru, user));
  }
  if (dibuat.length) {
    catatAktivitas(`menurunkan goal "${g.description}" ke ${dibuat.length} anggota`, user && user.name);
  }
  return dibuat;
}

/** Tulis catatan jejak. Jejak yang gagal tidak boleh membatalkan simpan goalnya. */
async function tulisJejak(catatan) {
  for (const j of catatan || []) {
    try { await st().set(Grd.JEJAK_REC_PREFIX + j.id, j); }
    catch (e) { console.warn('Jejak GRD gagal ditulis (goal tetap tersimpan):', e?.message || e); }
  }
}

/**
 * Id record. Sengaja tidak memakai `uid()` milik App.jsx supaya file ini tetap
 * berdiri sendiri; bentuknya tetap aman untuk dipakai sebagai key kv_store.
 */
function buatId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
