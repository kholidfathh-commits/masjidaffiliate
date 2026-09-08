// ============================================================================
// CATATAN KERJA (Work Notes) — fungsi MURNI (tanpa React/JSX/storage) supaya
// bisa diuji lewat `node uji-catatan.mjs` tanpa menjalankan aplikasi.
// ----------------------------------------------------------------------------
// ATURAN: TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
// Pola ini sama persis dengan src/tiket/urutan.js, src/absensi/logika.js,
// src/keuangan/hitung.js dan src/aset/data.js.
//
// Kenapa penyaringan & pencarian dikerjakan di sini (frontend), bukan di query:
//   Data disimpan di Supabase `kv_store` sebagai KEY-VALUE — satu catatan = satu
//   baris `note:rec:<id>` dengan seluruh isinya di kolom JSONB `value`. Tidak ada
//   kolom judul/isi/kategori yang bisa di-WHERE atau di-full-text-search, dan
//   `listByPrefix()` wajib `ORDER BY key` (paginasi 1000 baris). Jadi seluruh
//   catatan yang boleh dilihat user ditarik sekali lalu disaring di memori —
//   hasilnya identik dengan query, dan pencarian terasa instan (tanpa round-trip).
// ============================================================================

import { wibDayKey, dalamRentang } from '../absensi/logika.js';

// ====== KUNCI PENYIMPANAN ======
// Catatan & favorit sama-sama PER-RECORD (1 baris = 1 data) supaya dua orang yang
// menyimpan bersamaan tidak saling menimpa — pelajaran dari modul tiket/absensi.
export const CATATAN_BACKUP_KEY = 'notes:all';
export const CATATAN_REC_PREFIX = 'note:rec:';
// Favorit: 1 baris PER USER (`notefav:<userId>`), isinya daftar id catatan.
// Dipilih begini supaya menandai favorit HANYA menulis baris milik sendiri —
// tidak pernah menyentuh record catatan (yang bisa sedang diedit orang lain).
export const FAVORIT_BACKUP_KEY = 'notes:favorites:all';
export const FAVORIT_REC_PREFIX = 'notefav:';

// ====== KATEGORI ======
// Sengaja berupa objek key->label supaya menambah kategori baru = tambah 1 baris
// di sini; seluruh dropdown, filter, dan badge ikut otomatis.
export const KATEGORI = {
  meeting:      { label: 'Meeting',      color: 'bg-blue-100 text-blue-700',       icon: 'Users' },
  evaluasi:     { label: 'Evaluasi',     color: 'bg-amber-100 text-amber-800',     icon: 'BarChart3' },
  ide:          { label: 'Ide',          color: 'bg-violet-100 text-violet-700',   icon: 'Lightbulb' },
  masalah:      { label: 'Masalah',      color: 'bg-red-100 text-red-700',         icon: 'AlertCircle' },
  instruksi:    { label: 'Instruksi',    color: 'bg-orange-100 text-orange-700',   icon: 'Megaphone' },
  dokumentasi:  { label: 'Dokumentasi',  color: 'bg-teal-100 text-teal-800',       icon: 'FileText' },
  sop:          { label: 'SOP',          color: 'bg-emerald-100 text-emerald-700', icon: 'ClipboardList' },
  pembelajaran: { label: 'Pembelajaran', color: 'bg-cyan-100 text-cyan-700',       icon: 'GraduationCap' },
  lainnya:      { label: 'Lainnya',      color: 'bg-slate-100 text-slate-700',     icon: 'StickyNote' },
};
export const KATEGORI_DEFAULT = 'lainnya';
/** Label kategori dengan fallback AMAN — record lama bisa memakai key yang sudah dihapus. */
export const labelKategori = (k) => (KATEGORI[k] || KATEGORI[KATEGORI_DEFAULT]).label;
export const warnaKategori = (k) => (KATEGORI[k] || KATEGORI[KATEGORI_DEFAULT]).color;

// ====== VISIBILITAS ======
// Default PRIVATE — orang harus sengaja memilih untuk membagikan.
export const VISIBILITAS = {
  private:      { label: 'Pribadi',    sub: 'Hanya saya yang bisa melihat' },
  department:   { label: 'Divisi',     sub: 'Anggota divisi terkait bisa melihat' },
  organization: { label: 'Organisasi', sub: 'Seluruh tim Al-Kahfi Corp bisa melihat' },
};
export const VISIBILITAS_DEFAULT = 'private';
export const labelVisibilitas = (v) => (VISIBILITAS[v] || VISIBILITAS[VISIBILITAS_DEFAULT]).label;

// ====== HAK AKSES ======
// Memakai bentuk user yang SAMA dengan seluruh app: { id, role, division }.
// Sengaja TIDAK membuat sistem izin baru — hanya menerjemahkan role/divisi yang sudah ada.

/**
 * Boleh melihat catatan?
 *   pribadi    -> HANYA penulis. Owner/Manajer pun tidak. Ini disengaja: kalau
 *                 manajemen bisa membaca catatan pribadi, orang berhenti mencatat.
 *   divisi     -> penulis + anggota divisi yang sama + Owner/Manajer (viewAllData).
 *   organisasi -> semua user yang bisa masuk aplikasi.
 */
export function bisaLihatCatatan(user, n) {
  if (!user || !n) return false;
  if (n.authorId && n.authorId === user.id) return true;
  const vis = n.visibility || VISIBILITAS_DEFAULT;
  if (vis === 'organization') return true;
  if (vis === 'department') {
    if (user.role === 'owner' || user.role === 'manajer') return true;
    return !!n.division && (user.division || '') === n.division;
  }
  return false; // private milik orang lain
}

/**
 * Boleh mengubah / menghapus / menyematkan catatan?
 * Penulis selalu boleh. Owner & Manajer boleh untuk catatan yang DIBAGIKAN
 * (divisi/organisasi) — itu dokumentasi organisasi. Catatan pribadi orang lain
 * tetap tidak bisa disentuh: mereka bahkan tidak bisa melihatnya.
 */
export function bisaUbahCatatan(user, n) {
  if (!user || !n) return false;
  if (n.authorId && n.authorId === user.id) return true;
  if ((n.visibility || VISIBILITAS_DEFAULT) === 'private') return false;
  return user.role === 'owner' || user.role === 'manajer';
}

/** Hanya catatan yang boleh dilihat user ini. Dipakai sebagai saringan PALING LUAR. */
export function catatanTerlihat(user, list = []) {
  return (Array.isArray(list) ? list : []).filter(n => bisaLihatCatatan(user, n));
}

// ====== NORMALISASI ======
/**
 * Isi nilai default untuk record lama / setengah jadi (mis. Quick Note yang hanya
 * mengirim isi). Selalu dipakai saat MEMBACA supaya UI tidak perlu cek null di
 * mana-mana, dan saat MENYIMPAN supaya bentuk record konsisten.
 */
export function normalisasiCatatan(n) {
  if (!n || typeof n !== 'object') return null;
  const dibuat = n.createdAt || null;
  return {
    ...n,
    title: typeof n.title === 'string' ? n.title : '',
    content: typeof n.content === 'string' ? n.content : '',
    category: KATEGORI[n.category] ? n.category : KATEGORI_DEFAULT,
    division: typeof n.division === 'string' ? n.division : '',
    visibility: VISIBILITAS[n.visibility] ? n.visibility : VISIBILITAS_DEFAULT,
    isPinned: !!n.isPinned,
    attachments: normalisasiLampiran(n.attachments),
    authorId: n.authorId || null,
    authorName: n.authorName || '-',
    // Kait relasi untuk pengembangan berikutnya (tiket/meeting/SOP/project/KPI).
    // Sengaja bentuk BEBAS (tipe + id) supaya menambah relasi baru tidak perlu migrasi.
    relatedType: n.relatedType || null,
    relatedId: n.relatedId || null,
    createdAt: dibuat,
    updatedAt: n.updatedAt || dibuat,
  };
}

/**
 * Lampiran disimpan sebagai objek {src, name, type} — BUKAN string telanjang —
 * supaya nanti bisa menampung dokumen/PDF tanpa mengubah bentuk data. Record lama
 * berformat string (pola `images: []` di modul Masukan) tetap dibaca dengan benar.
 */
export function normalisasiLampiran(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((a, i) => {
    if (typeof a === 'string') return { src: a, name: `Lampiran ${i + 1}`, type: 'image' };
    if (a && typeof a === 'object' && a.src) return { src: a.src, name: a.name || `Lampiran ${i + 1}`, type: a.type || 'image' };
    return null;
  }).filter(Boolean);
}

export const lampiranGambar = (n) => normalisasiLampiran(n && n.attachments).filter(a => a.type === 'image');
export const punyaGambar = (n) => lampiranGambar(n).length > 0;
export const gambarPertama = (n) => (lampiranGambar(n)[0] || null);

// ====== WAKTU ======
/**
 * Waktu catatan dalam milidetik untuk MENGURUTKAN. Sumber utama `createdAt`;
 * kalau kosong, awalan `id` (dibuat `uid()` = Date.now() basis-36) didekode balik —
 * sama persis dengan cara modul tiket, supaya urutan tetap masuk akal.
 */
export function waktuCatatan(n, pakaiUpdate = false) {
  const iso = pakaiUpdate ? ((n && n.updatedAt) || (n && n.createdAt)) : (n && n.createdAt);
  if (iso) { const ms = Date.parse(iso); if (Number.isFinite(ms)) return ms; }
  const id = n && typeof n.id === 'string' ? n.id : '';
  const m = /^[0-9a-z]{8}/.exec(id);
  if (m) {
    const ms = parseInt(m[0], 36);
    if (Number.isFinite(ms) && ms > 1577836800000 && ms < 4102444800000) return ms; // 2020-2100
  }
  return 0;
}
/** Tanggal kalender WIB sebuah catatan ("YYYY-MM-DD") — dipakai filter tanggal. */
export function hariCatatan(n) {
  const ms = waktuCatatan(n);
  return ms > 0 ? wibDayKey(new Date(ms)) : '';
}

// ====== PENCARIAN ======
/** Ambil semua teks yang bisa dicari dari satu catatan: judul, isi, penulis. */
export function teksCari(n) {
  return [n && n.title, n && n.content, n && n.authorName].filter(Boolean).join('   ').toLowerCase();
}
/**
 * Cocok pencarian. Kata kunci dipecah per spasi dan HARUS cocok SEMUA (AND) -
 * jadi "evaluasi siti" hanya memunculkan catatan yang memuat keduanya, bukan
 * semua yang memuat salah satunya.
 */
export function cocokPencarian(n, q) {
  const kata = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!kata.length) return true;
  const hay = teksCari(n);
  return kata.every(k => hay.includes(k));
}

// ====== SARING & URUT ======
export const TAB_CATATAN = [
  { id: 'semua', label: 'Semua' },
  { id: 'saya', label: 'Catatan Saya' },
  { id: 'favorit', label: 'Favorit' },
  { id: 'pinned', label: 'Disematkan' },
];

/**
 * Saring daftar catatan. `list` diasumsikan SUDAH lewat catatanTerlihat().
 * Semua argumen opsional; 'all' / '' / null berarti tidak menyaring.
 */
export function saringCatatan(list = [], opsi = {}) {
  const {
    user = null, tab = 'semua', kategori = 'all', divisi = 'all',
    penulis = 'all', cari = '', rentang = null, favorit = [],
  } = opsi;
  const setFav = new Set(Array.isArray(favorit) ? favorit : []);
  return (Array.isArray(list) ? list : []).filter(n => {
    if (!n) return false;
    if (tab === 'saya' && !(user && n.authorId === user.id)) return false;
    if (tab === 'favorit' && !setFav.has(n.id)) return false;
    if (tab === 'pinned' && !n.isPinned) return false;
    if (kategori !== 'all' && (n.category || KATEGORI_DEFAULT) !== kategori) return false;
    if (divisi !== 'all') {
      // 'umum' = catatan yang sengaja tidak dikaitkan ke divisi manapun.
      if (divisi === 'umum') { if (n.division) return false; }
      else if ((n.division || '') !== divisi) return false;
    }
    if (penulis !== 'all' && n.authorId !== penulis) return false;
    if (rentang && (rentang.start || rentang.end)) {
      if (!dalamRentang(hariCatatan(n), rentang.start || '', rentang.end || '')) return false;
    }
    if (!cocokPencarian(n, cari)) return false;
    return true;
  });
}

/**
 * Urutkan: DISEMATKAN selalu di atas, lalu sesuai mode. TIDAK mengubah array asli.
 * Tiebreak id supaya urutan deterministik (tidak loncat-loncat antar render).
 */
export function urutkanCatatan(list = [], mode = 'terbaru') {
  const arr = Array.isArray(list) ? [...list] : [];
  const perId = (a, b) => String((a && a.id) || '').localeCompare(String((b && b.id) || ''));
  const tiebreak = (a, b) => (waktuCatatan(b) - waktuCatatan(a)) || perId(a, b);
  const perPin = (fn) => (a, b) => (((b && b.isPinned) ? 1 : 0) - ((a && a.isPinned) ? 1 : 0)) || fn(a, b);
  switch (mode) {
    case 'terlama':
      return arr.sort(perPin((a, b) => (waktuCatatan(a) - waktuCatatan(b)) || perId(a, b)));
    case 'judul':
      return arr.sort(perPin((a, b) => String((a && a.title) || '').localeCompare(String((b && b.title) || ''), 'id') || tiebreak(a, b)));
    case 'diperbarui':
      return arr.sort(perPin((a, b) => (waktuCatatan(b, true) - waktuCatatan(a, true)) || tiebreak(a, b)));
    case 'terbaru':
    default:
      return arr.sort(perPin(tiebreak));
  }
}
export const URUT_CATATAN = [
  { id: 'terbaru', label: 'Terbaru dibuat' },
  { id: 'terlama', label: 'Terlama dibuat' },
  { id: 'diperbarui', label: 'Terakhir diubah' },
  { id: 'judul', label: 'Judul A-Z' },
];

// ====== FAVORIT ======
/** Tambah/buang id dari daftar favorit. Mengembalikan array BARU (aman untuk state React). */
export function toggleFavorit(ids = [], noteId) {
  const arr = Array.isArray(ids) ? ids : [];
  if (!noteId) return [...arr];
  return arr.includes(noteId) ? arr.filter(x => x !== noteId) : [...arr, noteId];
}

// ====== TEKS BERFORMAT SEDERHANA ======
// Bukan editor rich-text sungguhan (itu berarti dependency baru + data HTML yang
// harus dibersihkan dari XSS). Yang dipakai: penanda per-baris gaya Markdown yang
// sudah biasa dipakai orang di WhatsApp/Notes, disimpan sebagai TEKS BIASA.
// Aman by design: tidak ada HTML yang pernah disimpan atau di-render mentah.
//   "# Judul"          -> heading
//   "- isi" / "* isi"  -> butir
//   "1. isi"           -> bernomor
//   "- [ ] isi"        -> ceklis kosong,  "- [x] isi" -> ceklis tercentang
//   "**tebal**"        -> tebal (inline)

/** Pecah isi catatan jadi blok siap render. Selalu mengembalikan array (isi kosong -> []). */
export function parseIsi(content) {
  const teks = typeof content === 'string' ? content : '';
  if (!teks.trim()) return [];
  return teks.replace(/\r\n?/g, '\n').split('\n').map((baris, i) => {
    const t = baris.trim();
    if (!t) return { id: i, tipe: 'kosong', teks: '' };
    let m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(t))) return { id: i, tipe: 'heading', level: m[1].length, teks: m[2] };
    if ((m = /^[-*]\s+\[([ xX])\]\s*(.*)$/.exec(t))) return { id: i, tipe: 'centang', ceklis: m[1].toLowerCase() === 'x', teks: m[2] };
    if ((m = /^[-*]\s+(.*)$/.exec(t))) return { id: i, tipe: 'butir', teks: m[1] };
    if ((m = /^(\d+)[.)]\s+(.*)$/.exec(t))) return { id: i, tipe: 'nomor', nomor: Number(m[1]), teks: m[2] };
    return { id: i, tipe: 'teks', teks: t };
  });
}

/** Pecah satu baris jadi potongan tebal/biasa. `**x**` -> tebal. Tanda tak berpasangan dibiarkan apa adanya. */
export function potongTebal(teks) {
  const s = typeof teks === 'string' ? teks : '';
  if (!s) return [];
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ teks: s.slice(last, m.index), tebal: false });
    out.push({ teks: m[1], tebal: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ teks: s.slice(last), tebal: false });
  return out.filter(p => p.teks !== '');
}

/** Buang semua penanda format -> teks polos. Dipakai untuk preview kartu. */
export function isiPolos(content) {
  return parseIsi(content)
    .filter(b => b.tipe !== 'kosong')
    .map(b => b.teks)
    .join(' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Preview isi untuk kartu (2-3 baris). Dipotong di batas kata, ditutup elipsis. */
export function ringkasIsi(content, maks = 160) {
  const s = isiPolos(content);
  if (s.length <= maks) return s;
  const potong = s.slice(0, maks);
  const spasi = potong.lastIndexOf(' ');
  return (spasi > maks * 0.6 ? potong.slice(0, spasi) : potong).trimEnd() + '...';
}

/**
 * Judul otomatis untuk Quick Note yang tidak diberi judul: baris pertama isi,
 * maksimal 60 karakter. Prinsipnya "Buka -> Catat -> Simpan": user tidak boleh
 * dipaksa mengisi judul, tapi daftar catatan tetap harus terbaca.
 */
export function judulOtomatis(content, maks = 60) {
  const blok = parseIsi(content).find(b => b.tipe !== 'kosong');
  const baris = blok ? blok.teks.replace(/\*\*(.+?)\*\*/g, '$1').trim() : '';
  if (!baris) return 'Catatan Cepat';
  return baris.length <= maks ? baris : baris.slice(0, maks).trimEnd() + '...';
}

// ====== RINGKASAN UNTUK KARTU STATISTIK ======
export function ringkasanCatatan(list = []) {
  const arr = Array.isArray(list) ? list : [];
  return {
    total: arr.length,
    pinned: arr.filter(n => n && n.isPinned).length,
    bergambar: arr.filter(n => punyaGambar(n)).length,
    dibagikan: arr.filter(n => n && (n.visibility === 'department' || n.visibility === 'organization')).length,
  };
}
