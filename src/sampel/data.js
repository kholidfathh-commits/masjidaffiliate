// ============================================================================
// MODUL MANAJEMEN SAMPEL — konstanta + fungsi MURNI.
// Tanpa React/JSX/storage supaya bisa diuji `node uji-sampel.mjs`.
// ----------------------------------------------------------------------------
// ATURAN: TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
// Boleh meng-import src/absensi/logika.js (sama-sama fungsi murni, tanpa React) —
// pola yang sama dipakai src/catatan/data.js.
//
// ====== TIGA JENIS BARIS DI kv_store ======
//
// 1. SAMPEL (master)          'sampel:rec:<kodeSampel>'
//    { id(=kode), kode, token, nama, kategori, tanggalDatang, sellerId, sellerNama,
//      penerimaId, penerimaNama, foto, catatan, lifecycle, riwayatKeputusan[],
//      createdAt, createdById, createdByName, updatedAt, updatedById, updatedByName }
//    `id` SENGAJA sama dengan kode sampel: kode wajib unik & tak pernah berubah,
//    jadi memakai kode sebagai kunci baris membuat tabrakan ID mustahil disembunyikan
//    (baris yang sama tidak bisa ada dua kali) dan mesin backup per-record tetap cocok.
//
// 2. LOG PEMAKAIAN (sumber kebenaran)  'sampelpakai:rec:<YYYY-MM-DD>-<acak>'
//    { id, sampelId, sampelKode, userId, userName, usedAt, createdAt }
//    `id` DIAWALI kunci hari supaya SATU bulan bisa ditarik dengan satu query
//    LIKE 'sampelpakai:rec:2026-09%'. Ini penting: app pernah kena batas kuota
//    egress Supabase, jadi halaman sampel HANYA menarik jendela beberapa bulan
//    terakhir, bukan seluruh riwayat.
//
// 3. RINGKASAN PEMAKAIAN (cache, bukan sumber kebenaran)  'sampelstat:<sampelId>'
//    { id(=sampelId), total, terakhir, terakhirOleh }
//    Hanya untuk menjawab "total sepanjang masa" & "terakhir dipakai" tanpa menarik
//    seluruh log. SELALU bisa dibangun ulang dari log lewat hitungUlangStat().
//    Semua angka berjendela (hari ini / minggu / bulan / 30 hari) dihitung LANGSUNG
//    dari log — tidak pernah dari cache ini.
// ============================================================================

import { wibDayKey, geserHari } from '../absensi/logika.js';
import { isManajemen, isPengawas } from '../peran/hierarki.js';

export const SAMPEL_REC_PREFIX = 'sampel:rec:';
export const SAMPEL_BACKUP_KEY = 'sampel:all';
export const PAKAI_REC_PREFIX = 'sampelpakai:rec:';
export const PAKAI_BACKUP_KEY = 'sampel-usage:all';
export const STAT_REC_PREFIX = 'sampelstat:';
export const STAT_BACKUP_KEY = 'sampel-stat:all';

/** Berapa bulan log pemakaian yang ditarik halaman sampel (hemat egress). */
export const JENDELA_BULAN = 4;

// ====== KATEGORI ======
export const SAMPEL_KATEGORI = [
  'Fashion', 'Kecantikan', 'Kesehatan', 'Makanan & Minuman', 'Rumah Tangga',
  'Elektronik', 'Ibu & Anak', 'Aksesoris', 'Olahraga & Outdoor', 'Lainnya',
];

// ====== LIFECYCLE (status nyata barang) ======
export const LIFECYCLE = {
  aktif:     { label: 'Aktif',     badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  terjual:   { label: 'Terjual',   badge: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500' },
  dibagikan: { label: 'Dibagikan', badge: 'bg-violet-100 text-violet-700',   dot: 'bg-violet-500' },
  dibuang:   { label: 'Dibuang',   badge: 'bg-slate-200 text-slate-600',     dot: 'bg-slate-400' },
};
export const LIFECYCLE_DEFAULT = 'aktif';
export const lifecycleInfo = (k) => LIFECYCLE[k] || LIFECYCLE[LIFECYCLE_DEFAULT];
/** true bila sampel masih berada di ekosistem & boleh dicatat pemakaiannya. */
export const masihAktif = (s) => (s && s.lifecycle ? s.lifecycle : LIFECYCLE_DEFAULT) === 'aktif';

// ====== KEPUTUSAN REVIEW / DISPOSAL ======
export const KEPUTUSAN = {
  simpan:  { label: 'Tetap Simpan', lifecycle: 'aktif',     warna: 'emerald' },
  jual:    { label: 'Jual',         lifecycle: 'terjual',   warna: 'blue' },
  bagikan: { label: 'Bagikan',      lifecycle: 'dibagikan', warna: 'violet' },
  buang:   { label: 'Buang',        lifecycle: 'dibuang',   warna: 'slate' },
};
export const lifecycleDariKeputusan = (k) => (KEPUTUSAN[k] ? KEPUTUSAN[k].lifecycle : null);

// ====== AMBANG AGING — SATU tempat, jangan disebar ke banyak file ======
// Bentuknya objek biasa supaya nanti bisa ditimpa dari `app:settings` tanpa ubah kode.
export const AGING_DEFAULT = Object.freeze({
  batasBaru: 30,        // 0–30 hari  → BARU / AKTIF
  batasMonitor: 60,     // 31–60 hari → PANTAU
  batasSlow: 90,        // 61–90 hari → LAMBAT
  reviewTanpaPakai: 30, // >90 hari DAN tidak dipakai ≥30 hari → PERLU REVIEW
});

export const AGING = {
  baru:    { label: 'Baru / Aktif', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  monitor: { label: 'Pantau',       badge: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500' },
  slow:    { label: 'Lambat',       badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  review:  { label: 'Perlu Review', badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
};
export const agingInfo = (k) => AGING[k] || AGING.baru;

/** Gabungkan konfigurasi aging kustom dengan default, membuang nilai tak masuk akal. */
export function konfigAging(over) {
  const c = { ...AGING_DEFAULT };
  if (over && typeof over === 'object') {
    for (const k of Object.keys(AGING_DEFAULT)) {
      const v = Number(over[k]);
      if (Number.isFinite(v) && v > 0) c[k] = Math.floor(v);
    }
  }
  // Urutan ambang harus menaik; kalau user mengisi terbalik, rapikan supaya tak ada bucket kosong.
  if (c.batasMonitor <= c.batasBaru) c.batasMonitor = c.batasBaru + 1;
  if (c.batasSlow <= c.batasMonitor) c.batasSlow = c.batasMonitor + 1;
  return c;
}

// ====== TANGGAL & UMUR ======
const RE_TGL = /^\d{4}-\d{2}-\d{2}$/;
export const tanggalValid = (d) => RE_TGL.test(String(d || ''));

/** Selisih hari antara dua kunci hari 'YYYY-MM-DD' (b − a). Aman timezone (dihitung di UTC). */
export function selisihHari(a, b) {
  if (!tanggalValid(a) || !tanggalValid(b)) return null;
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** Umur sampel dalam hari. Datang hari ini = 0. Tanggal ngawur/kosong → null. */
export function umurSampel(tanggalDatang, hariIni = wibDayKey()) {
  const d = selisihHari(tanggalDatang, hariIni);
  return d == null ? null : Math.max(0, d);
}

/** Umur ringkas untuk tabel: selalu dalam hari (presisi). */
export const labelUmur = (hari) => (hari == null ? '–' : `${hari} hari`);

/** Umur untuk halaman detail: hari + perkiraan bulan bila sudah lama. */
export function labelUmurPanjang(hari) {
  if (hari == null) return '–';
  if (hari < 60) return `${hari} hari`;
  return `${hari} hari (± ${Math.round(hari / 30)} bulan)`;
}

/** Tanggal gaya Indonesia. Kosong → '–'. */
export function fmtTanggalId(dk) {
  if (!tanggalValid(dk)) return '–';
  return new Date(dk + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Senin pada pekan yang sama dengan `dk` (pekan dianggap mulai Senin). */
export function awalPekan(dk) {
  if (!tanggalValid(dk)) return dk;
  const hari = new Date(dk + 'T00:00:00Z').getUTCDay(); // 0=Minggu
  return geserHari(dk, -((hari + 6) % 7));
}

// ====== KODE SAMPEL & TOKEN QR ======
export const KODE_PREFIX = 'SMP';
export const RE_KODE = /^SMP-(\d{6})-(\d{4})$/;

/** 'YYYY-MM-DD' → 'YYMMDD' (bagian tanggal pada kode sampel). */
export const bagianTanggalKode = (dk) => (tanggalValid(dk) ? dk.slice(2, 4) + dk.slice(5, 7) + dk.slice(8, 10) : '');

/** Susun kode sampel: SMP-260909-0001. */
export function kodeSampel(dk, urutan) {
  const t = bagianTanggalKode(dk);
  if (!t) return '';
  return `${KODE_PREFIX}-${t}-${String(Math.max(1, Number(urutan) || 1)).padStart(4, '0')}`;
}

/** Rapikan input kode manual (huruf besar, spasi jadi strip). */
export const rapikanKode = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '-');

/**
 * Urutan berikutnya untuk tanggal registrasi tertentu = nomor tertinggi yang sudah
 * ada pada tanggal itu + 1. Dipakai bersama pengecekan ulang ke server sebelum menulis
 * (lihat simpanSampelBaru di App.jsx) supaya dua staf yang input bersamaan tidak bentrok.
 */
export function urutanBerikutnya(daftar = [], dk) {
  const t = bagianTanggalKode(dk);
  if (!t) return 1;
  let maks = 0;
  for (const s of daftar) {
    const m = RE_KODE.exec(rapikanKode(s && (s.kode || s.id)));
    if (m && m[1] === t) maks = Math.max(maks, Number(m[2]) || 0);
  }
  return maks + 1;
}

// Alfabet token QR: Crockford base32 (tanpa I, L, O, U) — tidak ada huruf yang
// gampang tertukar saat seseorang terpaksa membacanya manual.
export const ALFABET_TOKEN = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PANJANG_TOKEN = 8;

/**
 * Token QR acak & stabil. `acak` = fungsi penghasil bilangan 0..1 (default Math.random);
 * di App.jsx dioper pembangkit berbasis crypto.getRandomValues.
 */
export function buatToken(acak = Math.random) {
  let s = '';
  for (let i = 0; i < PANJANG_TOKEN; i++) s += ALFABET_TOKEN[Math.floor(acak() * ALFABET_TOKEN.length) % ALFABET_TOKEN.length];
  return s;
}
export const tokenValid = (t) => typeof t === 'string' && t.length === PANJANG_TOKEN && [...t].every(c => ALFABET_TOKEN.includes(c));

/** URL yang ditanam di QR. Base URL TIDAK pernah di-hardcode — dioper dari app. */
export function urlSampel(baseUrl, token) {
  const b = String(baseUrl || '').replace(/\/+$/, '');
  return `${b}/s/${token}`;
}

/**
 * Ambil token sampel dari alamat yang sedang dibuka.
 * Menerima 3 bentuk supaya QR lama/manual tetap jalan:
 *   /s/<token>  ·  /sampel/<token>  ·  ?s=<token>  ·  #/sampel/<token>
 * @returns {string|null} token yang valid, atau null.
 */
export function tokenDariAlamat({ pathname = '', search = '', hash = '' } = {}) {
  const kandidat = [];
  const p = /\/(?:s|sampel|samples\/scan)\/([^/?#]+)/i.exec(String(pathname));
  if (p) kandidat.push(p[1]);
  const q = /[?&]s=([^&#]+)/i.exec(String(search));
  if (q) kandidat.push(q[1]);
  const h = /(?:#\/?(?:s|sampel)\/)([^/?&#]+)/i.exec(String(hash));
  if (h) kandidat.push(h[1]);
  for (const k of kandidat) {
    const t = decodeURIComponent(k).trim().toUpperCase();
    if (tokenValid(t)) return t;
  }
  return null;
}

// ====== LINK PRODUK (opsional) ======
// Disimpan sebagai ARRAY `linkProduk: [{platform, url, label}]`, bukan dua kolom
// tiktokUrl/shopeeUrl, supaya platform baru cukup ditambah di PLATFORM_LINK tanpa
// mengubah bentuk data yang sudah tersimpan. Sepenuhnya OPSIONAL: sampel tanpa link
// tetap normal, dan record lama (yang belum punya field ini sama sekali) tetap jalan.

export const PLATFORM_LINK = {
  tiktok:  { label: 'TikTok Shop', tombol: 'Buka di TikTok Shop', warna: '#111827' },
  shopee:  { label: 'Shopee',      tombol: 'Buka di Shopee',      warna: '#EE4D2D' },
  lainnya: { label: 'Link Produk', tombol: 'Buka Link Produk',    warna: '#2563EB' },
};
export const platformInfo = (k) => PLATFORM_LINK[k] || PLATFORM_LINK.lainnya;
/** Platform yang punya kolom sendiri di form Tambah/Edit Sampel. */
export const PLATFORM_FORM = ['tiktok', 'shopee'];

// Domain per platform. Sengaja LONGGAR (cocok sufiks host) supaya short link resmi
// seperti vt.tiktok.com atau shope.ee tetap dikenali. Deteksi ini HANYA menentukan
// label/ikon tombol — URL di luar daftar TIDAK ditolak, cuma jadi platform 'lainnya'.
const DOMAIN_PLATFORM = {
  tiktok: ['tiktok.com', 'tiktokshop.com', 'tiktokv.com', 'tiktokglobalshop.com'],
  shopee: ['shopee.co.id', 'shopee.com', 'shopee.sg', 'shope.ee', 'shp.ee'],
};

/** Skema yang boleh dibuka. `javascript:`, `data:`, `vbscript:`, dll DITOLAK. */
const SKEMA_AMAN = ['http:', 'https:'];

/**
 * Rapikan URL yang diketik user → URL absolut, atau null bila tidak masuk akal.
 * Tanpa skema dianggap https (staf biasanya menyalin "shopee.co.id/xxx").
 */
export function rapikanUrl(teks) {
  const t = String(teks == null ? '' : teks).trim();
  if (!t) return null;
  // Tolak lebih dulu skema berbahaya SEBELUM menambah https:// — supaya
  // "javascript:alert(1)" tidak berubah jadi "https://javascript:alert(1)".
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
    let u;
    try { u = new URL(t); } catch { return null; }
    if (!SKEMA_AMAN.includes(u.protocol)) return null;
    return u.href;
  }
  if (/\s/.test(t) || !t.includes('.')) return null; // bukan alamat, cuma teks biasa
  try {
    const u = new URL('https://' + t);
    return u.hostname.includes('.') ? u.href : null;
  } catch { return null; }
}

/** true bila URL boleh dipasang di href (sudah absolut & skemanya aman). */
export function urlAman(url) {
  const t = String(url == null ? '' : url).trim();
  if (!t) return false;
  try { return SKEMA_AMAN.includes(new URL(t).protocol); } catch { return false; }
}

/** Tebak platform dari domain. Tidak dikenali → 'lainnya' (tetap boleh dipakai). */
export function deteksiPlatform(url) {
  let host = '';
  try { host = new URL(String(url || '')).hostname.toLowerCase(); } catch { return 'lainnya'; }
  for (const [platform, domain] of Object.entries(DOMAIN_PLATFORM)) {
    if (domain.some(d => host === d || host.endsWith('.' + d))) return platform;
  }
  return 'lainnya';
}

/**
 * Validasi satu isian link. Kosong = SAH (field opsional).
 * @returns {string|null} pesan error, atau null bila lolos.
 */
export function validasiLinkProduk(teks, namaField = 'Link produk') {
  const t = String(teks == null ? '' : teks).trim();
  if (!t) return null;
  if (t.length > 500) return `${namaField} terlalu panjang (maksimal 500 karakter).`;
  const rapi = rapikanUrl(t);
  if (!rapi) return `${namaField} tidak valid. Contoh: https://shopee.co.id/produk-abc`;
  return null;
}

/**
 * Bersihkan array link produk dari record: buang yang kosong/tidak aman/duplikat,
 * lengkapi platform & label. SELALU mengembalikan array (record lama → array kosong).
 * Menerima juga bentuk `productLinks`/`product_links` supaya data dari sumber lain
 * (mis. impor) tidak hilang diam-diam.
 */
export function normalisasiLinkProduk(nilai) {
  const sumber = Array.isArray(nilai) ? nilai : [];
  const keluar = [];
  const sudah = new Set();
  for (const item of sumber) {
    if (!item) continue;
    const mentah = typeof item === 'string' ? item : item.url;
    const url = rapikanUrl(mentah);
    if (!url || !urlAman(url) || sudah.has(url)) continue;
    sudah.add(url);
    const platform = (typeof item === 'object' && PLATFORM_LINK[item.platform] && deteksiPlatform(url) === 'lainnya')
      ? item.platform            // hormati pilihan user bila domainnya tak dikenali (short link)
      : deteksiPlatform(url);    // domain dikenali → domain yang menang
    const label = (typeof item === 'object' && String(item.label || '').trim()) || platformInfo(platform).label;
    keluar.push({ platform, url, label: label.slice(0, 40) });
  }
  return keluar;
}

/** Ambil array link produk dari record apa pun bentuknya (aman untuk data lama). */
export const linkProdukDari = (s) =>
  normalisasiLinkProduk((s && (s.linkProduk || s.productLinks || s.product_links)) || []);

/** URL untuk satu platform pada sebuah sampel ('' bila tidak ada). Dipakai form Edit. */
export function urlPlatform(s, platform) {
  const hit = linkProdukDari(s).find(l => l.platform === platform);
  return hit ? hit.url : '';
}

/**
 * Link yang TIDAK terwakili kolom form Tambah/Edit Sampel, yaitu:
 *   (a) platform di luar PLATFORM_FORM (mis. Tokopedia, link pendek pihak ketiga), dan
 *   (b) link KE-2 dan seterusnya pada platform yang sama — form hanya punya SATU kolom
 *       per platform, jadi tanpa aturan (b) link kedua akan hilang diam-diam begitu staf
 *       menyimpan perubahan apa pun.
 * Dipakai bersama oleh gabungLinkProduk() (agar dipertahankan) dan form (untuk memberi
 * tahu staf bahwa ada link lain yang tetap tersimpan walau tidak ditampilkan).
 */
export function linkDiluarForm(linkProduk = [], platformForm = PLATFORM_FORM) {
  const dikelola = new Set(platformForm);
  const terwakili = new Set();
  return normalisasiLinkProduk(linkProduk).filter(l => {
    if (!dikelola.has(l.platform)) return true;
    if (terwakili.has(l.platform)) return true;
    terwakili.add(l.platform);
    return false;
  });
}

/**
 * Susun array link produk dari isian form (peta platform → url) sambil MEMPERTAHANKAN
 * link yang tidak terwakili kolom form (lihat linkDiluarForm).
 */
export function gabungLinkProduk(isianForm = {}, linkLama = []) {
  const hasil = linkDiluarForm(linkLama, Object.keys(isianForm));
  for (const platform of Object.keys(isianForm)) {
    const url = rapikanUrl(isianForm[platform]);
    if (!url) continue; // dikosongkan user = link dihapus
    // Platform & label FINAL ditentukan normalisasiLinkProduk() dari domainnya.
    // Kalau staf salah tempel (link Shopee di kolom TikTok), domain yang menang —
    // `platform` di sini cuma tebakan cadangan untuk short link yang tak dikenali.
    hasil.push({ platform, url });
  }
  return normalisasiLinkProduk(hasil);
}

// ====== NORMALISASI (aman untuk data lama / field yang belum ada) ======
export function normalisasiSampel(s) {
  if (!s || typeof s !== 'object') return null;
  const kode = rapikanKode(s.kode || s.id);
  if (!kode) return null;
  return {
    ...s,
    id: s.id || kode,
    kode,
    token: typeof s.token === 'string' ? s.token.toUpperCase() : '',
    nama: String(s.nama || '').trim(),
    kategori: SAMPEL_KATEGORI.includes(s.kategori) ? s.kategori : 'Lainnya',
    tanggalDatang: tanggalValid(s.tanggalDatang) ? s.tanggalDatang : '',
    sellerId: s.sellerId || '',
    sellerNama: String(s.sellerNama || '').trim(),
    penerimaId: s.penerimaId || '',
    penerimaNama: String(s.penerimaNama || '').trim(),
    foto: s.foto || null,
    catatan: String(s.catatan || '').trim(),
    lifecycle: LIFECYCLE[s.lifecycle] ? s.lifecycle : LIFECYCLE_DEFAULT,
    riwayatKeputusan: Array.isArray(s.riwayatKeputusan) ? s.riwayatKeputusan : [],
    // Selalu array — sampel lama yang belum punya field ini tetap aman dirender.
    linkProduk: linkProdukDari(s),
  };
}

export function normalisasiPakai(p) {
  if (!p || typeof p !== 'object') return null;
  if (!p.sampelId || !p.usedAt) return null;
  return {
    ...p,
    id: p.id || '',
    sampelId: String(p.sampelId),
    sampelKode: String(p.sampelKode || p.sampelId),
    userId: String(p.userId || ''),
    userName: String(p.userName || '').trim() || 'Tanpa nama',
    usedAt: p.usedAt,
  };
}

/** Kunci hari WIB sebuah log pemakaian. Diambil dari `id` (sudah berawalan tanggal) bila ada. */
export function hariPakai(p) {
  const id = String((p && p.id) || '');
  if (RE_TGL.test(id.slice(0, 10))) return id.slice(0, 10);
  return wibDayKey(p && p.usedAt ? p.usedAt : new Date());
}

/** Susun id log pemakaian: '<YYYY-MM-DD>-<acak>' (awalan tanggal = kunci query per bulan). */
export const idPakai = (dk, acak) => `${dk}-${acak}`;
/** Prefix baris untuk menarik SATU bulan log ('YYYY-MM'). */
export const prefixBulanPakai = (mk) => `${PAKAI_REC_PREFIX}${mk}`;

/** Daftar kunci bulan 'YYYY-MM' mundur `jml` bulan dari `dk` (terbaru dulu). */
export function bulanTerakhir(dk = wibDayKey(), jml = JENDELA_BULAN) {
  const out = [];
  let y = Number(String(dk).slice(0, 4));
  let m = Number(String(dk).slice(5, 7));
  for (let i = 0; i < Math.max(1, jml); i++) {
    out.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

// ====== STATISTIK PEMAKAIAN ======
/** Kelompokkan log pemakaian per sampel → Map<sampelId, log[]>. */
export function indeksPakai(logs = []) {
  const map = new Map();
  for (const raw of logs) {
    const p = normalisasiPakai(raw);
    if (!p) continue;
    if (!map.has(p.sampelId)) map.set(p.sampelId, []);
    map.get(p.sampelId).push(p);
  }
  return map;
}

/**
 * Hitung angka pemakaian SATU sampel dari log di jendela yang dimuat.
 * `cache` = baris 'sampelstat:<id>' (opsional) untuk total & terakhir sepanjang masa.
 */
export function statistikPakai(logs = [], hariIni = wibDayKey(), cache = null) {
  const senin = awalPekan(hariIni);
  const bulan = String(hariIni).slice(0, 7);
  const batas30 = geserHari(hariIni, -29);
  let hariIniN = 0, minggu = 0, bulanN = 0, hari30 = 0;
  let terakhir = '', terakhirOleh = '';
  const pemakai = new Map();

  for (const raw of logs) {
    const p = normalisasiPakai(raw);
    if (!p) continue;
    const dk = hariPakai(p);
    if (dk === hariIni) hariIniN++;
    if (dk >= senin && dk <= hariIni) minggu++;
    if (dk.slice(0, 7) === bulan) bulanN++;
    if (dk >= batas30 && dk <= hariIni) hari30++;
    if (!terakhir || p.usedAt > terakhir) { terakhir = p.usedAt; terakhirOleh = p.userName; }
    if (p.userId) pemakai.set(p.userId, (pemakai.get(p.userId) || 0) + 1);
  }

  // Total & terakhir sepanjang masa: ambil yang paling besar antara cache dan jendela.
  // Cache bisa tertinggal (baru dibangun), jendela bisa tak memuat riwayat lama —
  // memakai nilai maksimum membuat keduanya saling menambal, tak pernah mengurangi.
  let total = logs.length;
  if (cache && Number.isFinite(Number(cache.total))) total = Math.max(total, Number(cache.total));
  if (cache && cache.terakhir && cache.terakhir > terakhir) { terakhir = cache.terakhir; terakhirOleh = cache.terakhirOleh || ''; }

  const terakhirHari = terakhir ? wibDayKey(terakhir) : '';
  return {
    hariIni: hariIniN, minggu, bulan: bulanN, hari30, total,
    terakhir, terakhirOleh, terakhirHari,
    sejakTerakhir: terakhirHari ? Math.max(0, selisihHari(terakhirHari, hariIni) ?? 0) : null,
    pemakai,
  };
}

/** Statistik kosong — dipakai untuk sampel yang belum pernah dipakai sama sekali. */
export const STAT_KOSONG = Object.freeze({
  hariIni: 0, minggu: 0, bulan: 0, hari30: 0, total: 0,
  terakhir: '', terakhirOleh: '', terakhirHari: '', sejakTerakhir: null, pemakai: new Map(),
});

/** Peta statistik untuk seluruh sampel sekaligus (dipakai list, aging, dashboard). */
export function petaStatistik(samples = [], logs = [], statCache = [], hariIni = wibDayKey()) {
  const perSampel = indeksPakai(logs);
  const cacheMap = new Map();
  for (const c of statCache || []) if (c && c.id) cacheMap.set(String(c.id), c);
  const out = new Map();
  for (const raw of samples) {
    const s = normalisasiSampel(raw);
    if (!s) continue;
    out.set(s.id, statistikPakai(perSampel.get(s.id) || [], hariIni, cacheMap.get(s.id) || null));
  }
  return out;
}

/** Bangun ulang seluruh baris cache 'sampelstat:' dari log pemakaian LENGKAP. */
export function hitungUlangStat(logs = []) {
  const map = new Map();
  for (const raw of logs) {
    const p = normalisasiPakai(raw);
    if (!p) continue;
    const cur = map.get(p.sampelId) || { id: p.sampelId, total: 0, terakhir: '', terakhirOleh: '' };
    cur.total++;
    if (!cur.terakhir || p.usedAt > cur.terakhir) { cur.terakhir = p.usedAt; cur.terakhirOleh = p.userName; }
    map.set(p.sampelId, cur);
  }
  return [...map.values()];
}

/**
 * Penjaga klik ganda: true bila user yang SAMA baru saja mencatat pemakaian sampel
 * yang sama kurang dari `jedaDetik`. Sengaja pendek — pemakaian sah berkali-kali
 * dalam sehari TETAP boleh, yang dicegah hanya double-click / tap ganda.
 */
export const JEDA_GANDA_DETIK = 45;
export function pakaiTerlaluCepat(logs = [], userId, sekarang = new Date().toISOString(), jedaDetik = JEDA_GANDA_DETIK) {
  const t = Date.parse(sekarang);
  if (!userId || !Number.isFinite(t)) return false;
  return logs.some(p => {
    if (!p || String(p.userId) !== String(userId)) return false;
    const u = Date.parse(p.usedAt);
    return Number.isFinite(u) && t - u >= 0 && t - u < jedaDetik * 1000;
  });
}

// ====== AGING ======
/**
 * Bucket aging sebuah sampel. DIHITUNG OTOMATIS — beda dari lifecycle (status nyata barang).
 * @param {number|null} umur hari sejak datang
 * @param {number|null} sejakPakai hari sejak terakhir dipakai (null = belum pernah dipakai)
 */
export function bucketAging(umur, sejakPakai, cfg = AGING_DEFAULT) {
  const c = konfigAging(cfg);
  if (umur == null) return 'baru';
  // Belum pernah dipakai = "tidak dipakai selama umurnya sendiri".
  const diam = sejakPakai == null ? umur : sejakPakai;
  if (umur > c.batasSlow && diam >= c.reviewTanpaPakai) return 'review';
  if (umur <= c.batasBaru) return 'baru';
  if (umur <= c.batasMonitor) return 'monitor';
  return 'slow';
}

/** Bucket aging langsung dari record sampel + statistiknya. */
export function agingSampel(s, stat = STAT_KOSONG, hariIni = wibDayKey(), cfg = AGING_DEFAULT) {
  const n = normalisasiSampel(s);
  if (!n) return 'baru';
  return bucketAging(umurSampel(n.tanggalDatang, hariIni), stat.sejakTerakhir, cfg);
}

/** true bila sampel layak dievaluasi: masih aktif DAN bucket aging = review. */
export function perluReview(s, stat = STAT_KOSONG, hariIni = wibDayKey(), cfg = AGING_DEFAULT) {
  const n = normalisasiSampel(s);
  return !!n && masihAktif(n) && agingSampel(n, stat, hariIni, cfg) === 'review';
}

// ====== FILTER & URUTAN (halaman Daftar + Aging) ======
export const FILTER_UMUR = [
  ['all', 'Semua umur'],
  ['0-30', '0–30 hari'],
  ['31-60', '31–60 hari'],
  ['61-90', '61–90 hari'],
  ['90+', 'Lebih dari 90 hari'],
];
export const FILTER_PAKAI = [
  ['all', 'Semua pemakaian'],
  ['hari-ini', 'Dipakai hari ini'],
  ['tanpa7', 'Tidak dipakai > 7 hari'],
  ['tanpa30', 'Tidak dipakai > 30 hari'],
  ['tanpa60', 'Tidak dipakai > 60 hari'],
  ['belum', 'Belum pernah dipakai'],
];
export const URUT_SAMPEL = [
  ['baru', 'Terbaru datang'],
  ['lama', 'Terlama datang'],
  ['sering', 'Paling sering dipakai (30 hari)'],
  ['jarang', 'Paling jarang dipakai (30 hari)'],
  ['terakhir', 'Terakhir dipakai'],
  ['diam', 'Paling lama tidak dipakai'],
];

const cocokUmur = (umur, f) => {
  if (f === 'all' || umur == null) return f === 'all';
  if (f === '0-30') return umur <= 30;
  if (f === '31-60') return umur >= 31 && umur <= 60;
  if (f === '61-90') return umur >= 61 && umur <= 90;
  if (f === '90+') return umur > 90;
  return true;
};

const cocokPakai = (stat, f) => {
  if (f === 'all') return true;
  if (f === 'belum') return stat.total === 0;
  if (f === 'hari-ini') return stat.hariIni > 0;
  const batas = f === 'tanpa7' ? 7 : f === 'tanpa30' ? 30 : f === 'tanpa60' ? 60 : null;
  if (batas == null) return true;
  if (stat.sejakTerakhir == null) return true; // belum pernah dipakai = pasti lewat batas
  return stat.sejakTerakhir > batas;
};

/**
 * Saring daftar sampel. Semua opsi bersifat AND.
 * @param {Array} list daftar sampel mentah
 * @param {Map} statMap hasil petaStatistik()
 */
export function saringSampel(list = [], statMap = new Map(), {
  cari = '', kategori = 'all', lifecycle = 'all', umur = 'all', pakai = 'all', aging = 'all',
  hariIni = wibDayKey(), cfg = AGING_DEFAULT,
} = {}) {
  const kata = String(cari || '').trim().toLowerCase();
  const out = [];
  for (const raw of list) {
    const s = normalisasiSampel(raw);
    if (!s) continue;
    if (kategori !== 'all' && s.kategori !== kategori) continue;
    if (lifecycle !== 'all' && s.lifecycle !== lifecycle) continue;
    const stat = statMap.get(s.id) || STAT_KOSONG;
    const u = umurSampel(s.tanggalDatang, hariIni);
    if (!cocokUmur(u, umur)) continue;
    if (!cocokPakai(stat, pakai)) continue;
    if (aging !== 'all' && bucketAging(u, stat.sejakTerakhir, cfg) !== aging) continue;
    if (kata) {
      const teks = `${s.kode} ${s.nama} ${s.sellerNama} ${s.kategori} ${s.penerimaNama}`.toLowerCase();
      if (!teks.includes(kata)) continue;
    }
    out.push(s);
  }
  return out;
}

/** Urutkan daftar sampel yang sudah disaring. */
export function urutkanSampel(list = [], mode = 'baru', statMap = new Map()) {
  const st = (s) => statMap.get(s.id) || STAT_KOSONG;
  const arr = [...list];
  const tgl = (s) => s.tanggalDatang || '';
  switch (mode) {
    case 'lama':     arr.sort((a, b) => tgl(a).localeCompare(tgl(b)) || a.kode.localeCompare(b.kode)); break;
    case 'sering':   arr.sort((a, b) => st(b).hari30 - st(a).hari30 || st(b).total - st(a).total); break;
    case 'jarang':   arr.sort((a, b) => st(a).hari30 - st(b).hari30 || st(a).total - st(b).total); break;
    case 'terakhir': arr.sort((a, b) => String(st(b).terakhir).localeCompare(String(st(a).terakhir))); break;
    // "Paling lama tidak dipakai": yang belum pernah dipakai paling atas.
    case 'diam':     arr.sort((a, b) => (st(b).sejakTerakhir ?? Infinity) - (st(a).sejakTerakhir ?? Infinity)); break;
    default:         arr.sort((a, b) => tgl(b).localeCompare(tgl(a)) || b.kode.localeCompare(a.kode));
  }
  return arr;
}

// ====== DASHBOARD ======
export function ringkasDashboard(samples = [], statMap = new Map(), hariIni = wibDayKey(), cfg = AGING_DEFAULT) {
  const bulan = String(hariIni).slice(0, 7);
  let totalAktif = 0, baruBulanIni = 0, dipakai30 = 0, tanpaPakai30 = 0, review = 0, totalSemua = 0;
  let pakaiHariIni = 0, pakaiMinggu = 0, pakaiBulan = 0;
  for (const raw of samples) {
    const s = normalisasiSampel(raw);
    if (!s) continue;
    totalSemua++;
    const stat = statMap.get(s.id) || STAT_KOSONG;
    pakaiHariIni += stat.hariIni; pakaiMinggu += stat.minggu; pakaiBulan += stat.bulan;
    if (masihAktif(s)) {
      totalAktif++;
      if (stat.hari30 > 0) dipakai30++; else tanpaPakai30++;
      if (perluReview(s, stat, hariIni, cfg)) review++;
    }
    if (s.tanggalDatang && s.tanggalDatang.slice(0, 7) === bulan) baruBulanIni++;
  }
  return { totalSemua, totalAktif, baruBulanIni, dipakai30, tanpaPakai30, review, pakaiHariIni, pakaiMinggu, pakaiBulan };
}

/** Sampel paling sering dipakai dalam 30 hari terakhir. */
export function topSampel(samples = [], statMap = new Map(), batas = 5) {
  return samples
    .map(normalisasiSampel).filter(Boolean)
    .map(s => ({ sampel: s, jumlah: (statMap.get(s.id) || STAT_KOSONG).hari30 }))
    .filter(r => r.jumlah > 0)
    .sort((a, b) => b.jumlah - a.jumlah || a.sampel.kode.localeCompare(b.sampel.kode))
    .slice(0, batas);
}

/**
 * Sampel paling prioritas dievaluasi: hanya yang berstatus review, diurutkan dari yang
 * paling lama diam, lalu paling tua.
 */
export function prioritasReview(samples = [], statMap = new Map(), hariIni = wibDayKey(), cfg = AGING_DEFAULT, batas = 5) {
  return samples
    .map(normalisasiSampel).filter(Boolean)
    .filter(s => perluReview(s, statMap.get(s.id) || STAT_KOSONG, hariIni, cfg))
    .map(s => {
      const stat = statMap.get(s.id) || STAT_KOSONG;
      return { sampel: s, umur: umurSampel(s.tanggalDatang, hariIni), diam: stat.sejakTerakhir, hari30: stat.hari30 };
    })
    .sort((a, b) => (b.diam ?? Infinity) - (a.diam ?? Infinity) || (b.umur || 0) - (a.umur || 0))
    .slice(0, batas);
}

/** Riwayat pemakaian milik satu user (terbaru dulu). */
export function riwayatUser(logs = [], userId, batas = 100) {
  return logs
    .map(normalisasiPakai).filter(Boolean)
    .filter(p => String(p.userId) === String(userId))
    .sort((a, b) => String(b.usedAt).localeCompare(String(a.usedAt)))
    .slice(0, batas);
}

/** Riwayat pemakaian satu sampel (terbaru dulu). */
export function riwayatSampel(logs = [], sampelId, batas = 200) {
  return logs
    .map(normalisasiPakai).filter(Boolean)
    .filter(p => p.sampelId === sampelId)
    .sort((a, b) => String(b.usedAt).localeCompare(String(a.usedAt)))
    .slice(0, batas);
}

// ====== HAK AKSES ======
// Dipetakan ke role yang SUDAH ADA di app (owner/manajer/leader/wakil/operasional +
// flag isSecretariat), persis pola canManageCalendar(). Tidak ada sistem role baru —
// daftar peran pengawas diambil dari src/peran/hierarki.js (satu sumber kebenaran).
//
//  · Semua user            : pindai QR, cari, lihat detail, tekan "Gunakan Sampel".
//  · Leader / Sekretariat  : + tambah, edit, cetak label, halaman Aging & Dashboard.
//  · Owner / Manajer       : + ubah lifecycle (Jual/Bagikan/Buang), hapus, hitung ulang statistik.

/** Boleh menambah/mengubah metadata sampel, cetak label, buka Dashboard & Aging. */
export function bisaKelolaSampel(u) {
  if (!u) return false;
  return isManajemen(u) || isPengawas(u) || !!u.isSecretariat;
}
/** Boleh mengubah lifecycle (KEEP/JUAL/BAGIKAN/BUANG) & menghapus sampel. */
export function bisaUbahLifecycle(u) {
  if (!u) return false;
  return isManajemen(u);
}
/** Boleh mencatat pemakaian: siapa pun yang login, selama sampelnya masih aktif. */
export function bisaPakaiSampel(u, s) {
  const n = normalisasiSampel(s);
  return !!u && !!n && masihAktif(n);
}
/** Pesan penolakan yang ramah user (bukan stack trace). */
export function alasanTidakBisaPakai(u, s) {
  if (!u) return 'Masuk dulu untuk mencatat pemakaian sampel.';
  const n = normalisasiSampel(s);
  if (!n) return 'Sampel tidak ditemukan.';
  if (!masihAktif(n)) return `Sampel ini sudah tidak aktif (${lifecycleInfo(n.lifecycle).label}). Pemakaian baru tidak bisa dicatat.`;
  return null;
}

// ====== VALIDASI FORM ======
/** Mengembalikan pesan error (string) atau null bila lolos. */
export function validasiSampel(form) {
  if (!form || typeof form !== 'object') return 'Data sampel kosong.';
  const nama = String(form.nama || '').trim();
  if (!nama) return 'Nama produk wajib diisi.';
  if (nama.length > 120) return 'Nama produk terlalu panjang (maksimal 120 karakter).';
  if (!form.kategori || !SAMPEL_KATEGORI.includes(form.kategori)) return 'Kategori wajib dipilih.';
  if (!tanggalValid(form.tanggalDatang)) return 'Tanggal kedatangan wajib diisi.';
  if (String(form.catatan || '').length > 500) return 'Catatan terlalu panjang (maksimal 500 karakter).';
  return null;
}

/** Batas tanggal kedatangan: tidak boleh di masa depan (sampel belum datang). */
export function tanggalDatangTerlaluJauh(dk, hariIni = wibDayKey()) {
  if (!tanggalValid(dk)) return false;
  return dk > hariIni;
}

// ====== LABEL CETAK ======
// Ukuran default label kecil 50 × 30 mm, TAPI sistem tidak dikunci ke ukuran itu:
// semua ukuran diambil dari objek ini dan dioper ke stylesheet cetak.
export const UKURAN_LABEL = {
  '50x30': { label: '50 × 30 mm (kecil)', lebarMm: 50, tinggiMm: 30, qrMm: 17 },
  '60x40': { label: '60 × 40 mm (sedang)', lebarMm: 60, tinggiMm: 40, qrMm: 23 },
  '70x50': { label: '70 × 50 mm (besar)', lebarMm: 70, tinggiMm: 50, qrMm: 30 },
  'a4-24': { label: 'A4 — 24 label per lembar', lebarMm: 64, tinggiMm: 34, qrMm: 20, lembar: 'a4', kolom: 3, baris: 8 },
};
export const UKURAN_LABEL_DEFAULT = '50x30';
export const ukuranLabel = (k) => UKURAN_LABEL[k] || UKURAN_LABEL[UKURAN_LABEL_DEFAULT];
