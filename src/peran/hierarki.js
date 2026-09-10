// ============================================================================
// HIERARKI PERAN & PENGAWASAN  (modul MURNI — tanpa React/JSX/storage)
// ----------------------------------------------------------------------------
// SATU sumber kebenaran untuk pertanyaan "siapa boleh melihat/mengurus siapa".
// Dipakai App.jsx (Anggota Tim, Tiket, Laporan, KPI, Absensi, Kalender, LMS).
//
// ATURAN PENTING (sama seperti src/absensi/logika.js & src/catatan/data.js):
//   · File ini TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
//   · Semua fungsi murni supaya bisa diuji `node uji-peran.mjs`.
//
// KENAPA ADA: sebelum ini, "bawahan" dihitung di ~15 tempat berbeda dengan
// rumus yang sama persis (`u.leaderId === user.id`) yang di-copy ulang-ulang, dan
// struktur organisasi hanya bisa 2 lapis (Leader → Karyawan). Menambah lapis
// Co-Leader berarti mengubah 15 tempat itu satu per satu — itulah kenapa
// "promosi jabatan" dulu terasa seperti pekerjaan koding. Sekarang cukup ubah
// DATA (peran + atasan langsung), logikanya sudah generik.
//
// CATATAN JUJUR SOAL KEAMANAN: app ini menegakkan otorisasi di FRONTEND. Tabel
// `kv_store` di Supabase memakai policy `using(true)` dengan publishable key,
// jadi modul ini adalah pagar PRODUK (menentukan apa yang muncul & boleh
// ditekan), bukan pagar kriptografis. Batasan ini berlaku untuk SELURUH app —
// bukan khusus modul ini. Penutupnya = Supabase Auth + RLS (ada di Backlog).
// ============================================================================

/** Semua peran yang dikenal sistem, urut dari yang tertinggi. */
export const ROLE_KEYS = ['owner', 'manajer', 'leader', 'wakil', 'operasional'];

/**
 * Pangkat numerik. Dipakai untuk (a) mengurutkan daftar anggota dan (b) memastikan
 * atasan selalu berpangkat LEBIH TINGGI dari bawahannya.
 * `wakil` = Co-Leader, disisipkan di antara Leader dan Karyawan.
 */
export const ROLE_RANK = { owner: 5, manajer: 4, leader: 3, wakil: 2, operasional: 1 };

/** Peran yang WAJIB punya atasan langsung (disimpan di field `leaderId`). */
export const ROLE_BERATASAN = ['wakil', 'operasional'];

/** Peran yang mengawasi orang lain lewat relasi atasan–bawahan. */
export const ROLE_PENGAWAS = ['leader', 'wakil'];

/** Manajemen puncak: melihat SELURUH organisasi tanpa perlu relasi. */
export const ROLE_MANAJEMEN = ['owner', 'manajer'];

export const pangkat = (u) => ROLE_RANK[u && u.role] || 0;
export const isManajemen = (u) => !!u && ROLE_MANAJEMEN.includes(u.role);
export const isPengawas = (u) => !!u && ROLE_PENGAWAS.includes(u.role);
/** Bukan karyawan biasa — dipakai untuk menu manajerial (Divisi, Anggota Tim, dll). */
export const isPengelola = (u) => !!u && (isManajemen(u) || isPengawas(u));
export const butuhAtasan = (peran) => ROLE_BERATASAN.includes(peran);

/**
 * Id atasan langsung. Field-nya tetap bernama `leaderId` supaya data 29 anggota
 * yang sudah ada TIDAK perlu dimigrasi; artinya kini diperluas menjadi
 * "atasan langsung" (boleh Leader, boleh Co-Leader), bukan khusus Leader.
 */
export const atasanId = (u) => (u && u.leaderId) || null;

/** Bawahan LANGSUNG (satu lapis di bawah). */
export function bawahanLangsung(userId, allUsers) {
  if (!userId) return [];
  return (allUsers || []).filter(u => u && u.leaderId === userId);
}

/**
 * Semua bawahan sampai ke bawah: Leader → Co-Leader → Karyawan.
 * Aman terhadap data melingkar / rusak (dibatasi kedalaman + set "sudah dikunjungi").
 * Mengembalikan Set berisi id (TIDAK termasuk dirinya sendiri).
 */
export function idBawahanTransitif(userId, allUsers, batasKedalaman = 10) {
  const hasil = new Set();
  if (!userId) return hasil;
  let lapis = new Set([userId]);
  for (let d = 0; d < batasKedalaman && lapis.size > 0; d++) {
    const berikut = new Set();
    for (const u of allUsers || []) {
      if (!u || !u.id || u.id === userId || hasil.has(u.id)) continue;
      if (lapis.has(u.leaderId)) { hasil.add(u.id); berikut.add(u.id); }
    }
    lapis = berikut;
  }
  return hasil;
}

/** Dirinya sendiri + seluruh keturunannya. Dipakai untuk mencegah struktur melingkar. */
export function idDiriDanBawahan(userId, allUsers) {
  const s = idBawahanTransitif(userId, allUsers);
  if (userId) s.add(userId);
  return s;
}

/**
 * Id anggota yang datanya boleh dilihat `user`.
 *   Owner/Manajer  → semua orang
 *   Leader/Co-Leader → dirinya + seluruh bawahannya (transitif)
 *   Karyawan       → dirinya sendiri
 */
export function lingkupTimIds(user, allUsers) {
  const ids = new Set();
  if (!user) return ids;
  if (isManajemen(user)) { (allUsers || []).forEach(u => u && u.id && ids.add(u.id)); return ids; }
  if (user.id) ids.add(user.id);
  if (isPengawas(user)) idBawahanTransitif(user.id, allUsers).forEach(id => ids.add(id));
  return ids;
}

/** Versi objek dari lingkupTimIds — urutannya mengikuti allUsers. */
export function lingkupTim(user, allUsers) {
  const ids = lingkupTimIds(user, allUsers);
  return (allUsers || []).filter(u => u && ids.has(u.id));
}

/** Bawahan saja (TANPA dirinya sendiri). Dipakai mis. rekap "tim saya belum lapor". */
export function timSaya(user, allUsers) {
  if (!user) return [];
  if (isManajemen(user)) return (allUsers || []).filter(u => u && u.id !== user.id);
  if (!isPengawas(user)) return [];
  const ids = idBawahanTransitif(user.id, allUsers);
  return (allUsers || []).filter(u => u && ids.has(u.id));
}

/** Boleh melihat profil/rekap orang ini? */
export function bisaLihatUser(viewer, target, allUsers) {
  if (!viewer || !target) return false;
  if (isManajemen(viewer)) return true;
  if (viewer.id === target.id) return true;
  if (!isPengawas(viewer)) return false;
  return idBawahanTransitif(viewer.id, allUsers).has(target.id);
}

/** Boleh MENGUBAH data akun orang ini (edit peran/divisi/atasan, reset password, hapus)? */
export function bisaKelolaUser(pengelola, target, allUsers) {
  if (!pengelola || !target) return false;
  if (isManajemen(pengelola)) return true;
  if (!isPengawas(pengelola)) return false;
  if (pengelola.id === target.id) return false; // tidak boleh menaikkan peran diri sendiri
  return idBawahanTransitif(pengelola.id, allUsers).has(target.id);
}

/**
 * Peran apa saja yang boleh DIBERIKAN oleh `currentUser` saat membuat/mengedit anggota.
 * Tidak ada yang bisa memberi peran di atas dirinya sendiri.
 */
export function peranBolehDibuat(currentUser) {
  if (!currentUser) return [];
  switch (currentUser.role) {
    case 'owner':   return ['owner', 'manajer', 'leader', 'wakil', 'operasional'];
    case 'manajer': return ['manajer', 'leader', 'wakil', 'operasional'];
    case 'leader':  return ['wakil', 'operasional'];
    case 'wakil':   return ['operasional'];
    default:        return [];
  }
}

/**
 * Calon atasan langsung untuk seseorang yang akan berperan `peran`.
 * Syarat: pangkat atasan HARUS lebih tinggi, dan tidak boleh memilih dirinya
 * sendiri atau bawahannya sendiri (mencegah struktur melingkar).
 */
export function calonAtasan(peran, allUsers, idSubjek = null) {
  if (!butuhAtasan(peran)) return [];
  const r = ROLE_RANK[peran] || 0;
  const terlarang = idSubjek ? idDiriDanBawahan(idSubjek, allUsers) : new Set();
  return (allUsers || []).filter(u => u && pangkat(u) > r && !terlarang.has(u.id));
}

/**
 * Validasi relasi atasan. Mengembalikan pesan error (string) atau null bila sah.
 * SATU tempat ini dipakai form maupun uji, jadi aturannya tidak bisa berbeda diam-diam.
 */
export function validasiAtasan(peran, idAtasan, idSubjek, allUsers) {
  if (!butuhAtasan(peran)) return null;
  if (!idAtasan) return 'Atasan Langsung wajib dipilih.';
  if (idSubjek && idAtasan === idSubjek) return 'Tidak bisa menjadikan diri sendiri sebagai atasan.';
  const atasan = (allUsers || []).find(u => u && u.id === idAtasan);
  if (!atasan) return 'Atasan Langsung tidak ditemukan.';
  if (pangkat(atasan) <= (ROLE_RANK[peran] || 0)) return 'Atasan Langsung harus berperan lebih tinggi.';
  if (idSubjek && idBawahanTransitif(idSubjek, allUsers).has(idAtasan)) {
    return 'Tidak bisa memilih bawahan sendiri sebagai atasan (struktur jadi melingkar).';
  }
  return null;
}

/**
 * Nilai `leaderId` yang benar untuk disimpan. Peran yang tidak butuh atasan
 * SELALU di-null-kan — kalau tidak, orang yang naik jabatan masih ikut terhitung
 * sebagai anggota tim atasan lamanya.
 */
export function normalisasiAtasanId(peran, idAtasan) {
  return butuhAtasan(peran) ? (idAtasan || null) : null;
}
