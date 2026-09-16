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
import * as Lead from './lead.js';
import * as Skor from './scoreboard.js';
import { isManajemen } from '../peran/hierarki.js';

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
 *
 * `periode` opsional: bila diisi DAN fungsi `grd_baca_goal` sudah terpasang,
 * penyaringannya dikerjakan di server sehingga yang terkirim hanya baris yang
 * dipakai. Kalau belum terpasang, baca seperti biasa lalu saring di memori —
 * hasilnya sama, hanya datanya lebih banyak lewat jaringan.
 */
export async function ambilGoal(periode = '') {
  if (periode) {
    const viaRpc = await lewatRpc('grd_baca_goal', { p_periode: periode });
    if (viaRpc.pakai && Array.isArray(viaRpc.data)) {
      return viaRpc.data.map(Grd.normalisasiGoal).filter(Boolean);
    }
  }
  const recs = await st().listByPrefix(Grd.GOAL_REC_PREFIX);
  const semua = recs.map(Grd.normalisasiGoal).filter(Boolean);
  return periode ? Grd.goalPeriode(semua, periode) : semua;
}

/** Goal satu periode saja (bulan ikut tertarik oleh kuartal yang memuatnya). */
export async function ambilGoalPeriode(periode) {
  return Grd.goalPeriode(await ambilGoal(), periode);
}

/**
 * SELURUH catatan jejak. Dipakai backup dan rekap lintas goal saja — untuk
 * menampilkan riwayat SATU goal, pakai `ambilJejakGoal` yang jauh lebih hemat.
 */
export async function ambilJejak() {
  return await st().listByPrefix(Grd.JEJAK_REC_PREFIX);
}

/**
 * Riwayat SATU goal saja, ditarik lewat prefix — bukan dengan membaca seluruh
 * jejak tim lalu menyaringnya di memori. Bedanya nyata: jejak tidak pernah
 * dipangkas, jadi cara lama akan makin berat setiap bulan.
 *
 * Hasilnya tetap disaring ulang berdasarkan `goalId`: kalau ada id goal tak
 * lazim yang memuat ':', prefixnya bisa menangkap jejak goal lain.
 */
export async function ambilJejakGoal(goalId) {
  const prefix = Grd.prefixJejakGoal(goalId);
  if (!prefix) return [];
  const baris = await st().listByPrefix(prefix);
  return Grd.riwayatGoal(baris, String(goalId));
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
export async function ambilDetailGoal(goalId, { user = null, allUsers = [], goals = null, jejak = null } = {}) {
  const id = String(goalId || '');
  if (!id) return null;

  const dasar = goals || await ambilGoal();
  // GERBANG: rantai induk & turunan hanya ditelusuri di antara goal yang boleh
  // DILIHAT pengguna ini. Tanpa gerbang, baris "diturunkan ke N goal" ikut
  // menghitung goal cabang lain — yang bocor memang cuma jumlahnya, tapi itu
  // tetap memberi tahu sesuatu yang bukan urusannya.
  const semua = user ? Grd.goalYangBisaDilihat(user, dasar, allUsers) : dasar;

  const goal = semua.map(Grd.normalisasiGoal).find(g => g && g.id === id);
  if (!goal) return null;

  // Riwayat ditarik khusus goal ini — jauh lebih hemat daripada membaca seluruh
  // jejak tim. `jejak` yang dioper (mis. dari halaman yang sudah memuatnya)
  // tetap dihormati supaya tidak ada perjalanan ke server yang sia-sia.
  const riwayat = jejak ? Grd.riwayatGoal(jejak, id) : await ambilJejakGoal(id);
  return {
    goal,
    pemilik: Grd.pemilikGoal(goal, allUsers),
    induk: Grd.goalInduk(goal, semua),
    turunan: Grd.goalTurunan(goal, semua),
    riwayat,
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

/**
 * Template goal per peran: bawaan digabung dengan yang diubah tim.
 * Gagal baca TIDAK mematikan fitur — jatuh ke template bawaan, karena template
 * hanya alat bantu mengisi form dan tidak boleh menghalangi pembuatan goal.
 */
export async function ambilTemplate() {
  try {
    const tersimpan = await st().get(Grd.TEMPLATE_KEY);
    return Grd.gabungTemplate(tersimpan);
  } catch (e) {
    console.warn('Baca template GRD gagal, pakai bawaan:', e?.message || e);
    return Grd.gabungTemplate(null);
  }
}

/**
 * DAFTAR TEMPLATE untuk halaman pengelolaan — satu panggilan menghasilkan semua
 * yang dibutuhkan layar: isi template tiap peran, penanda mana yang sudah
 * diubah tim, dan apakah pengguna ini berwenang mengubahnya.
 *
 * `bisaUbah` dikembalikan dari sini (bukan dihitung ulang di komponen) supaya
 * jawabannya selalu sama dengan yang ditegakkan `simpanTemplate` — tombol yang
 * muncul di layar tidak pernah berbeda dengan yang sebenarnya diizinkan.
 */
export async function daftarTemplate({ user = null } = {}) {
  let tersimpan = null;
  try { tersimpan = await st().get(Grd.TEMPLATE_KEY); }
  catch (e) {
    console.warn('Baca template GRD gagal, pakai bawaan:', e?.message || e);
    tersimpan = null;
  }
  const perPeran = Grd.ringkasTemplate(tersimpan);
  return {
    perPeran,
    template: Grd.gabungTemplate(tersimpan),
    diubah: perPeran.filter(r => r.diubah).map(r => r.peran),
    bisaUbah: isManajemen(user),
    totalTemplate: perPeran.reduce((t, r) => t + r.jumlah, 0),
  };
}

/**
 * Simpan template sebuah peran. Hanya pengelola (Owner/Manajer) — template itu
 * contoh yang dilihat SEMUA orang, jadi bukan milik satu tim.
 * Daftar kosong berarti "kembalikan ke bawaan".
 */
export async function simpanTemplate(peran, daftar, { user } = {}) {
  if (!Grd.ROLE_KEYS_GRD.includes(peran)) throw new GrdDitolak('Peran tidak dikenal.');
  if (!isManajemen(user)) throw new GrdDitolak('Hanya Owner/Manajer yang boleh mengubah template.');

  const kosong = !daftar || daftar.length === 0;
  if (!kosong) {
    const salah = Grd.validasiDaftarTemplate(daftar);
    if (salah) throw new GrdDitolak(salah);
  }

  let tersimpan = {};
  try { tersimpan = (await st().get(Grd.TEMPLATE_KEY)) || {}; } catch { tersimpan = {}; }

  const berikut = { ...tersimpan };
  if (kosong) delete berikut[peran];
  else berikut[peran] = daftar.map(Grd.normalisasiTemplate).filter(Boolean);

  const ok = await st().set(Grd.TEMPLATE_KEY, berikut);
  if (!ok) throw new GrdDitolak('Gagal menyimpan template. Coba lagi.');

  catatAktivitas(kosong
    ? `mengembalikan template goal peran ${peran} ke bawaan`
    : `mengubah template goal peran ${peran}`, user && user.name);
  return Grd.gabungTemplate(berikut);
}

// ============================================================================
// LEAD MEASURE
// ============================================================================

/** Seluruh lead measure. */
export async function ambilLead() {
  const recs = await st().listByPrefix(Lead.LEAD_REC_PREFIX);
  return recs.map(Lead.normalisasiLead).filter(Boolean);
}

/** Lead measure satu goal saja — ditarik lewat prefix, bukan membaca semuanya. */
export async function ambilLeadGoal(goalId) {
  const id = String(goalId || '');
  if (!id) return [];
  const recs = await st().listByPrefix(`${Lead.LEAD_REC_PREFIX}${id}:`);
  return recs.map(Lead.normalisasiLead).filter(l => l && l.goalId === id);
}

/**
 * Catat skor mingguan sebuah lead measure.
 *
 * Satu lead measure punya SATU skor per minggu — kuncinya memang dibuat begitu,
 * jadi mengisi ulang minggu yang sama memperbarui, bukan menumpuk. Itu
 * disengaja: papan skor diisi sekali seminggu, dan salah ketik harus bisa
 * dibetulkan tanpa meninggalkan dua angka yang saling bertentangan.
 *
 * `target` DISALIN dari lead measure saat pencatatan, bukan dibaca ulang nanti —
 * kalau targetnya berubah lewat usulan baru, minggu-minggu lama tidak ikut
 * berubah menang/kalahnya.
 */
export async function simpanSkor({ lead, minggu, nilai, catatan = '' }, { user, allUsers } = {}) {
  const l = Lead.normalisasiLead(lead);
  if (!l || !l.id) throw new GrdDitolak('Lead measure tidak terbaca.');
  if (l.status !== 'aktif') {
    throw new GrdDitolak('Hanya lead measure yang sudah disetujui yang bisa diisi skornya.');
  }
  if (!Skor.bisaIsiSkor(user, l, allUsers)) {
    throw new GrdDitolak('Anda tidak berwenang mengisi skor lead measure ini.');
  }

  const mk = Skor.awalMinggu(minggu);
  if (!mk) throw new GrdDitolak('Minggu tidak sah.');
  // Minggu yang belum datang tidak bisa diisi — angkanya belum ada.
  if (mk > Skor.mingguIni()) {
    throw new GrdDitolak('Minggu itu belum berjalan — skornya belum bisa diisi.');
  }

  const rec = {
    id: `${mk}:${l.id}`,
    leadId: l.id, goalId: l.goalId, ownerId: l.ownerId,
    minggu: mk,
    nilai, target: l.targetMingguan, uom: l.uom,
    catatan,
    dicatatOleh: (user && user.id) || '',
    dicatatNama: (user && user.name) || '',
    dicatatPada: new Date().toISOString(),
  };
  const salah = Skor.validasiSkor(rec);
  if (salah) throw new GrdDitolak(salah);

  const bersih = Skor.normalisasiSkor(rec);
  const viaRpc = await lewatRpc('grd_simpan_skor', { p_skor: bersih });
  if (!viaRpc.pakai) {
    const ok = await st().set(Skor.SKOR_REC_PREFIX + rec.id, bersih);
    if (!ok) throw new GrdDitolak('Gagal menyimpan skor. Coba lagi.');
  }

  const kata = Skor.menang(rec) ? 'MENANG' : 'kalah';
  catatAktivitas(`mengisi skor "${l.description}" minggu ${Skor.labelMinggu(mk)} — ${kata}`, user && user.name);
  return Skor.normalisasiSkor(rec);
}

/** Id record lead: `grdlead:rec:<goalId>:<id>` supaya bisa ditarik per goal. */
const kunciLead = (l) => `${Lead.LEAD_REC_PREFIX}${l.goalId}:${l.id}`;

/**
 * Usulkan / perbaiki lead measure.
 *
 * Usulan baru maupun perbaikan sama-sama berakhir berstatus 'usul' — perbaikan
 * TIDAK bisa langsung aktif tanpa dinilai ulang. Itu yang membuat persetujuan
 * berarti: kalau isi boleh diubah setelah disetujui, yang disetujui tidak lagi
 * sama dengan yang dijalankan.
 */
export async function usulkanLead(lead, { user, allUsers, goal, leadLama = null } = {}) {
  const l = Lead.normalisasiLead(lead);
  if (!l) throw new GrdDitolak('Data lead measure tidak terbaca.');

  const salah = Lead.validasiLead(l);
  if (salah) throw new GrdDitolak(salah);

  if (leadLama) {
    if (!Lead.bisaUbahLead(user, leadLama, allUsers)) {
      throw new GrdDitolak('Anda tidak berwenang mengubah lead measure ini.');
    }
  } else if (!Lead.bisaUsulLead(user, goal, allUsers)) {
    throw new GrdDitolak('Anda tidak berwenang mengusulkan lead measure untuk goal ini.');
  }

  // Batas 1–3 dihitung dari data TERBARU di server, bukan dari yang ada di layar.
  // Dua orang bisa mengusulkan hampir bersamaan; kalau memakai hitungan layar,
  // keduanya lolos dan goal berakhir dengan 4 lead aktif.
  if (!leadLama || leadLama.status !== 'usul') {
    const adaSekarang = await ambilLeadGoal(l.goalId);
    const calonAktif = Lead.leadAktif(adaSekarang, l.goalId).length
      + Lead.leadMenunggu(adaSekarang, l.goalId).length;
    if (!leadLama && calonAktif >= Lead.MAKS_LEAD_AKTIF) {
      throw new GrdDitolak(
        `Goal ini sudah punya ${calonAktif} lead measure aktif/menunggu — batasnya ${Lead.MAKS_LEAD_AKTIF}. `
        + 'Tolak atau cabut salah satunya dulu.');
    }
  }

  const rec = {
    ...l,
    id: l.id || buatId(),
    status: 'usul',
    catatan: '',           // catatan penilai dibersihkan saat diusulkan ulang
    penilaiId: '', penilaiNama: '',
    riwayat: Lead.tambahRiwayatLead(leadLama || l, {
      aksi: leadLama ? 'usulUlang' : 'usul', oleh: user,
    }),
    diusulkanOleh: (user && user.id) || '',
    diusulkanNama: (user && user.name) || '',
    diusulkanPada: new Date().toISOString(),
  };
  const viaRpc = await lewatRpc('grd_simpan_lead', { p_lead: rec });
  if (!viaRpc.pakai) {
    const ok = await st().set(kunciLead(rec), rec);
    if (!ok) throw new GrdDitolak('Gagal menyimpan lead measure. Coba lagi.');
  }

  catatAktivitas(`${leadLama ? 'memperbaiki' : 'mengusulkan'} lead measure "${rec.description}"`, user && user.name);
  return rec;
}

/**
 * NILAI usulan lead measure: setujui, minta perbaiki, atau tolak.
 *
 * Tiga penjagaan yang tidak boleh dilewat:
 *   1. Penilai bukan pengusulnya sendiri (diperiksa `bisaNilaiLead`).
 *   2. Perpindahan statusnya sah menurut ALUR_LEAD — tidak ada jalan pintas.
 *   3. Batas 3 aktif per goal dihitung ulang DARI SERVER tepat sebelum
 *      menyetujui. Dua atasan bisa menyetujui dua usulan hampir bersamaan;
 *      tanpa hitung ulang, keduanya lolos dan goal berakhir dengan 4 aktif.
 *
 * Menolak/minta perbaiki WAJIB disertai catatan — penolakan tanpa alasan
 * membuat pengusul menebak-nebak apa yang harus diperbaiki.
 */
export async function nilaiLead(lead, statusBaru, { user, allUsers, catatan = '' } = {}) {
  const l = Lead.normalisasiLead(lead);
  if (!l || !l.id) throw new GrdDitolak('Data lead measure tidak terbaca.');

  if (!Lead.bisaNilaiLead(user, l, allUsers)) {
    throw new GrdDitolak(l.ownerId === (user && user.id)
      ? 'Anda tidak bisa menilai usulan Anda sendiri — itu tugas atasan Anda.'
      : 'Anda tidak berwenang menilai usulan ini.');
  }
  if (!Lead.bolehPindahStatus(l.status, statusBaru)) {
    throw new GrdDitolak(
      `Tidak bisa mengubah dari "${Lead.gayaStatusLead(l.status).label}" ke `
      + `"${Lead.gayaStatusLead(statusBaru).label}".`);
  }

  const alasan = String(catatan || '').trim();
  if ((statusBaru === 'ditolak' || statusBaru === 'perbaiki') && !alasan) {
    throw new GrdDitolak('Tulis catatan singkat supaya pengusul tahu apa yang perlu diperbaiki.');
  }

  if (statusBaru === 'aktif') {
    const adaSekarang = await ambilLeadGoal(l.goalId);
    const aktifLain = Lead.leadAktif(adaSekarang, l.goalId).filter(x => x.id !== l.id).length;
    if (aktifLain >= Lead.MAKS_LEAD_AKTIF) {
      throw new GrdDitolak(
        `Goal ini sudah punya ${aktifLain} lead measure aktif — batasnya ${Lead.MAKS_LEAD_AKTIF}. `
        + 'Cabut salah satunya dulu.');
    }
  }

  const rec = {
    ...l,
    status: statusBaru,
    catatan: alasan,
    penilaiId: (user && user.id) || '',
    penilaiNama: (user && user.name) || '',
    dinilaiPada: new Date().toISOString(),
    riwayat: Lead.tambahRiwayatLead(l, { aksi: statusBaru, oleh: user, catatan: alasan }),
  };
  const viaRpc = await lewatRpc('grd_simpan_lead', { p_lead: rec });
  if (!viaRpc.pakai) {
    const ok = await st().set(kunciLead(rec), rec);
    if (!ok) throw new GrdDitolak('Gagal menyimpan penilaian. Coba lagi.');
  }

  const kata = statusBaru === 'aktif' ? 'menyetujui'
    : statusBaru === 'ditolak' ? 'menolak' : 'meminta perbaikan';
  catatAktivitas(`${kata} lead measure "${rec.description}"`, user && user.name);
  return rec;
}

// ============================================================================
// SCOREBOARD MINGGUAN
// ============================================================================

/** Seluruh skor. */
export async function ambilSkor() {
  const recs = await st().listByPrefix(Skor.SKOR_REC_PREFIX);
  return recs.map(Skor.normalisasiSkor).filter(Boolean);
}

/**
 * Skor SATU MINGGU saja — ditarik lewat prefix.
 * Kunci record: `grdskor:rec:<minggu>:<leadId>`. Minggu ditaruh di depan karena
 * papan skor hampir selalu dibaca per minggu, bukan per lead — dan jumlah skor
 * hanya bertambah tiap pekan, jadi membaca semuanya akan makin berat.
 */
export async function ambilSkorMinggu(minggu) {
  const mk = Skor.awalMinggu(minggu);
  if (!mk) return [];
  const recs = await st().listByPrefix(`${Skor.SKOR_REC_PREFIX}${mk}:`);
  return recs.map(Skor.normalisasiSkor).filter(s => s && s.minggu === mk);
}

/** Skor beberapa minggu terakhir — untuk tren. Dibaca per minggu, bukan semuanya. */
export async function ambilSkorBeberapaMinggu(sampai, jumlah = 8) {
  const mingguList = Skor.daftarMinggu(sampai, jumlah);
  const hasil = [];
  for (const mk of mingguList) hasil.push(...(await ambilSkorMinggu(mk)));
  return hasil;
}

/**
 * SATU PINTU PEMUATAN untuk halaman-halaman GRD.
 *
 * Kenapa perlu, padahal fungsi bacanya sudah ada satu per satu: tiap halaman
 * tadinya merangkai sendiri urutan pemanggilan DAN menggerbangi sendiri dengan
 * `goalYangBisaDilihat`. Dua hal itu gampang terlewat di halaman baru — dan
 * yang terlewat justru gerbangnya, karena halaman tetap terlihat benar tanpa itu.
 *
 * `butuh` menyebut bagian mana yang dipakai, supaya halaman tidak menarik data
 * yang tidak ia tampilkan (egress Supabase di project ini pernah kehabisan kuota).
 *
 * Gagal memuat MELEMPAR — pemanggil menangkapnya dan mempertahankan data lama
 * di layar, bukan mengosongkannya.
 */
export async function muatKonteksGrd({
  user = null, allUsers = [], periode = '', minggu = null,
  butuh = ['goal'], mingguTren = 8,
} = {}) {
  const perlu = new Set(butuh);
  const hasil = { goals: [], goalTerlihat: [], leads: [], jejak: [], skor: [] };

  if (perlu.has('goal') || perlu.has('lead') || perlu.has('skor')) {
    hasil.goals = await ambilGoal();
    // GERBANG dipasang DI SINI, sekali — bukan diulang di tiap halaman.
    hasil.goalTerlihat = user
      ? Grd.goalYangBisaDilihat(user, hasil.goals, allUsers)
      : hasil.goals;
    if (periode) hasil.goalPeriode = Grd.goalPeriode(hasil.goalTerlihat, periode);
  }

  const paralel = [];
  if (perlu.has('lead')) paralel.push(ambilLead().then(v => { hasil.leads = v; }));
  if (perlu.has('jejak')) paralel.push(ambilJejak().then(v => { hasil.jejak = v; }));
  if (perlu.has('skor')) {
    paralel.push(ambilSkorBeberapaMinggu(minggu || Skor.mingguIni(), mingguTren)
      .then(v => { hasil.skor = v; }));
  }
  await Promise.all(paralel);

  // SEMUA turunan digerbangi lewat goal induknya. Lead measure, jejak perubahan,
  // dan skor mingguan tidak punya aturan lihat sendiri — ketiganya mengikuti
  // goal yang mereka tempeli. Kalau salah satu terlewat, isi cabang lain bocor
  // walau goalnya sendiri sudah disembunyikan.
  if (user) {
    const boleh = new Set(hasil.goalTerlihat.map(g => g.id));
    if (perlu.has('lead')) hasil.leads = hasil.leads.filter(l => boleh.has(l.goalId));
    if (perlu.has('jejak')) hasil.jejak = hasil.jejak.filter(j => j && boleh.has(j.goalId));
    if (perlu.has('skor')) hasil.skor = hasil.skor.filter(s => s && boleh.has(s.goalId));
  }
  return hasil;
}

/**
 * Bandingkan izin menurut APLIKASI dengan izin menurut SERVER.
 *
 * Aturan tulis ada di dua tempat: src/grd/data.js (aplikasi) dan
 * grd_boleh_tulis (SQL). Dua salinan bisa menyimpang, dan yang menyimpang
 * biasanya tidak ketahuan sampai seseorang ditolak tanpa alasan yang jelas.
 * Fungsi ini menanyakan keduanya lalu melaporkan selisihnya.
 *
 * Mengembalikan { tersedia:false } bila fungsi SQL-nya belum dipasang — itu
 * keadaan normal, bukan kesalahan.
 */
export async function bandingkanIzin(user, allUsers) {
  const ids = (allUsers || []).filter(u => u && u.id).map(u => u.id);
  if (ids.length === 0) return { tersedia: false, selisih: [] };

  const viaRpc = await lewatRpc('grd_izin_saya', { p_owner_ids: ids });
  if (!viaRpc.pakai || !Array.isArray(viaRpc.data)) return { tersedia: false, selisih: [] };

  const menurutServer = new Map(viaRpc.data.map(r => [r.owner_id, !!r.boleh]));
  const selisih = [];
  for (const id of ids) {
    const app = Grd.bolehTulisMilik(user, id, allUsers);
    const srv = menurutServer.has(id) ? menurutServer.get(id) : null;
    if (srv !== null && srv !== app) {
      selisih.push({ ownerId: id, menurutAplikasi: app, menurutServer: srv });
    }
  }
  return { tersedia: true, selisih, diperiksa: ids.length };
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
    // Pesannya menyertakan ALASAN dari fungsi yang sama yang dipakai halaman
    // Kontrol Akses — jadi penolakan di sini tidak pernah bertentangan dengan
    // penjelasan yang dibaca pengguna di halaman itu.
    const izin = Grd.alasanUbahGoal(user, goalLama, allUsers);
    if (!izin.boleh) {
      throw new GrdDitolak(`Anda tidak berwenang mengubah goal ini. ${izin.alasan}`);
    }
  }
  if (!Grd.bisaBuatGoalUntuk(user, g.ownerId, allUsers)) {
    const pemilik = Grd.pemilikGoal(g, allUsers);
    throw new GrdDitolak(pemilik
      ? `Anda tidak berwenang membuat goal atas nama ${pemilik.name} — hanya untuk diri sendiri dan anggota di bawah Anda.`
      : 'Anda tidak berwenang membuat goal atas nama orang itu.');
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
  const izinHapus = Grd.alasanUbahGoal(user, g, allUsers);
  if (!izinHapus.boleh) {
    throw new GrdDitolak(`Anda tidak berwenang menghapus goal ini. ${izinHapus.alasan}`);
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
 * Turunkan goal ke SELURUH bawahan langsung pemiliknya — inti "sekali klik".
 *
 * Ditulis satu per satu, bukan sekali borong: kalau satu penulisan gagal
 * (koneksi putus di tengah), yang sudah berhasil tetap tersimpan dan pengguna
 * bisa mengulang tanpa membuat duplikat — bawahan yang sudah punya turunan
 * otomatis dilewati pada percobaan berikutnya.
 *
 * Mengembalikan { dibuat, gagal, dilewati } — BUKAN sekadar daftar yang
 * berhasil. Kegagalan sebagian harus bisa diberitahukan; kalau hanya
 * mengembalikan yang berhasil, layar akan melaporkan "selesai" padahal ada
 * anggota yang goalnya tidak pernah tersimpan.
 */
export async function turunkanGoal(goal, { user, allUsers, bagiRata, goalAda } = {}) {
  const g = Grd.normalisasiGoal(goal);
  if (!g || !g.id) throw new GrdDitolak('Data goal tidak terbaca.');
  const izinTurun = Grd.alasanUbahGoal(user, g, allUsers);
  if (!izinTurun.boleh) {
    throw new GrdDitolak(`Anda tidak berwenang menurunkan goal ini. ${izinTurun.alasan}`);
  }

  const ada = goalAda || await ambilGoal();
  const semuaBawahan = Grd.bawahanUntukTurunan(g, allUsers);
  const rencana = Grd.rencanaTurunan(g, allUsers, { bagiRata, goalAda: ada });
  const dilewati = semuaBawahan.length - rencana.length;

  const dibuat = [];
  const gagal = [];
  for (const r of rencana) {
    const nama = (Grd.pemilikGoal(r, allUsers) || {}).name || 'Anggota';
    const baru = { ...r, id: buatId() };

    // Rencana datang dari fungsi murni, tapi tetap diperiksa: kalau ada satuan
    // atau angka yang bikin goalnya tidak sah, lebih baik ketahuan di sini
    // daripada tersimpan sebagai goal rusak yang tidak bisa dihitung.
    const salah = Grd.validasiGoal(baru);
    if (salah) { gagal.push({ ownerId: r.ownerId, nama, alasan: salah }); continue; }

    try {
      const viaRpc = await lewatRpc('grd_simpan_goal', { p_goal: baru });
      if (!viaRpc.pakai) {
        const ok = await st().set(Grd.GOAL_REC_PREFIX + baru.id, baru);
        if (!ok) { gagal.push({ ownerId: r.ownerId, nama, alasan: 'Gagal menyimpan.' }); continue; }
      }
    } catch (e) {
      gagal.push({ ownerId: r.ownerId, nama, alasan: (e && e.message) || 'Gagal menyimpan.' });
      continue;
    }

    dibuat.push(baru);
    await tulisJejak(Grd.catatPerubahan(null, baru, user));
  }

  if (dibuat.length) {
    catatAktivitas(`menurunkan goal "${g.description}" ke ${dibuat.length} anggota`, user && user.name);
  }
  return { dibuat, gagal, dilewati };
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
