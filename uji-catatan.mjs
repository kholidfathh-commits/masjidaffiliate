// ============================================================================
// UJI CATATAN KERJA — jalankan: node uji-catatan.mjs
// ----------------------------------------------------------------------------
// BUKAN framework test dan TIDAK menambah dependency — satu file Node biasa.
// Database production tidak pernah disentuh (semua data di sini data contoh).
// Menjaga: hak akses (pribadi/divisi/organisasi), hak ubah, pencarian judul-isi-
// penulis, filter (tab/kategori/divisi/penulis/tanggal), urutan (pinned di atas),
// favorit, normalisasi record lama, dan teks berformat sederhana.
// ============================================================================
import * as C from './src/catatan/data.js';

let lulus = 0, gagal = 0;
const cek = (nama, syarat, detail) => {
  if (syarat) { lulus++; console.log('  LULUS  ', nama); }
  else { gagal++; console.log('  GAGAL  ', nama, detail !== undefined ? `\n           -> ${JSON.stringify(detail)}` : ''); }
};
const judul = (t) => console.log(`\n=== ${t} ===`);

// ====== Data contoh ======
const owner = { id: 'u-owner', name: 'Kholid', role: 'owner', division: 'manajemen' };
const manajer = { id: 'u-man', name: 'Rina', role: 'manajer', division: 'manajemen' };
const leaderMcn = { id: 'u-lead', name: 'Budi', role: 'leader', division: 'mcn' };
const stafMcn = { id: 'u-staf', name: 'Siti', role: 'operasional', division: 'mcn' };
const stafTap = { id: 'u-tap', name: 'Andi', role: 'operasional', division: 'tap' };

const nPribadiSiti = { id: 'n1', title: 'Ide pribadi', content: 'Rahasia', category: 'ide', division: 'mcn', visibility: 'private', authorId: 'u-staf', authorName: 'Siti', createdAt: '2026-09-01T03:00:00.000Z' };
const nDivisiMcn = { id: 'n2', title: 'Evaluasi DRM 8 September', content: 'Upload affiliator sering terlambat', category: 'evaluasi', division: 'mcn', visibility: 'department', authorId: 'u-lead', authorName: 'Budi', createdAt: '2026-09-05T03:00:00.000Z' };
const nOrganisasi = { id: 'n3', title: 'SOP Device', content: '# Aturan\n- Simpan HP di loker', category: 'sop', division: '', visibility: 'organization', isPinned: true, authorId: 'u-man', authorName: 'Rina', createdAt: '2026-08-20T03:00:00.000Z' };
const nUmumSiti = { id: 'n4', title: 'Target September', content: 'Naikkan GMV', category: 'lainnya', division: '', visibility: 'organization', authorId: 'u-staf', authorName: 'Siti', createdAt: '2026-09-07T03:00:00.000Z', attachments: ['https://cdn/x.jpg'] };
const semua = [nPribadiSiti, nDivisiMcn, nOrganisasi, nUmumSiti];

// ============================================================================
judul('1. Hak lihat (visibility)');
// ============================================================================
cek('1a. Catatan pribadi hanya terlihat penulisnya', C.bisaLihatCatatan(stafMcn, nPribadiSiti) === true);
cek('1b. Catatan pribadi TIDAK terlihat rekan sedivisi', C.bisaLihatCatatan(leaderMcn, nPribadiSiti) === false);
cek('1c. Catatan pribadi TIDAK terlihat Owner sekalipun', C.bisaLihatCatatan(owner, nPribadiSiti) === false);
cek('1d. Catatan divisi terlihat anggota divisi yang sama', C.bisaLihatCatatan(stafMcn, nDivisiMcn) === true);
cek('1e. Catatan divisi TIDAK terlihat divisi lain', C.bisaLihatCatatan(stafTap, nDivisiMcn) === false);
cek('1f. Catatan divisi terlihat Owner & Manajer', C.bisaLihatCatatan(owner, nDivisiMcn) && C.bisaLihatCatatan(manajer, nDivisiMcn));
cek('1g. Catatan organisasi terlihat semua orang', [owner, manajer, leaderMcn, stafMcn, stafTap].every(u => C.bisaLihatCatatan(u, nOrganisasi)));
cek('1h. Visibility kosong/ngawur dianggap PRIBADI (default aman)',
  C.bisaLihatCatatan(stafTap, { id: 'x', authorId: 'u-staf' }) === false);
cek('1i. user null tidak pernah bisa melihat', C.bisaLihatCatatan(null, nOrganisasi) === false);

const terlihatTap = C.catatanTerlihat(stafTap, semua).map(n => n.id);
cek('1j. catatanTerlihat menyaring seluruh daftar', terlihatTap.join(',') === 'n3,n4', terlihatTap);
const terlihatOwner = C.catatanTerlihat(owner, semua).map(n => n.id);
cek('1k. Owner lihat semua KECUALI pribadi orang lain', terlihatOwner.join(',') === 'n2,n3,n4', terlihatOwner);

// ============================================================================
judul('2. Hak ubah / hapus / sematkan');
// ============================================================================
cek('2a. Penulis boleh mengubah catatannya sendiri', C.bisaUbahCatatan(stafMcn, nPribadiSiti) === true);
cek('2b. Owner boleh mengubah catatan divisi (dokumentasi organisasi)', C.bisaUbahCatatan(owner, nDivisiMcn) === true);
cek('2c. Manajer boleh mengubah catatan organisasi', C.bisaUbahCatatan(manajer, nOrganisasi) === true);
cek('2d. Owner TIDAK boleh mengubah catatan pribadi orang lain', C.bisaUbahCatatan(owner, nPribadiSiti) === false);
cek('2e. Leader TIDAK boleh mengubah catatan divisi milik orang lain', C.bisaUbahCatatan(stafMcn, nDivisiMcn) === false);
cek('2f. Staf lain tidak boleh menghapus catatan organisasi', C.bisaUbahCatatan(stafTap, nOrganisasi) === false);

// ============================================================================
judul('3. Pencarian (judul, isi, penulis)');
// ============================================================================
cek('3a. Cocok lewat JUDUL', C.cocokPencarian(nDivisiMcn, 'DRM') === true);
cek('3b. Cocok lewat ISI catatan', C.cocokPencarian(nDivisiMcn, 'upload affiliator') === true);
cek('3c. Cocok lewat NAMA PENULIS', C.cocokPencarian(nDivisiMcn, 'budi') === true);
cek('3d. Tidak peka huruf besar/kecil', C.cocokPencarian(nOrganisasi, 'sop device') === true);
cek('3e. Beberapa kata = harus cocok SEMUA (AND)', C.cocokPencarian(nDivisiMcn, 'evaluasi siti') === false);
cek('3f. "evaluasi drm" cocok karena keduanya ada', C.cocokPencarian(nDivisiMcn, 'evaluasi drm') === true);
cek('3g. Kata kunci kosong = semua lolos', C.cocokPencarian(nUmumSiti, '   ') === true);
cek('3h. Kata yang tidak ada = tidak cocok', C.cocokPencarian(nUmumSiti, 'tiktok') === false);

// ============================================================================
judul('4. Filter');
// ============================================================================
const semuaN = semua.map(C.normalisasiCatatan);
const fSaya = C.saringCatatan(semuaN, { user: stafMcn, tab: 'saya' }).map(n => n.id);
cek('4a. Tab "Catatan Saya" hanya milik user', fSaya.join(',') === 'n1,n4', fSaya);
const fFav = C.saringCatatan(semuaN, { tab: 'favorit', favorit: ['n3'] }).map(n => n.id);
cek('4b. Tab "Favorit" ikut daftar favorit user', fFav.join(',') === 'n3', fFav);
const fPin = C.saringCatatan(semuaN, { tab: 'pinned' }).map(n => n.id);
cek('4c. Tab "Disematkan" hanya yang isPinned', fPin.join(',') === 'n3', fPin);
const fKat = C.saringCatatan(semuaN, { kategori: 'sop' }).map(n => n.id);
cek('4d. Filter kategori', fKat.join(',') === 'n3', fKat);
const fDiv = C.saringCatatan(semuaN, { divisi: 'mcn' }).map(n => n.id);
cek('4e. Filter divisi', fDiv.join(',') === 'n1,n2', fDiv);
const fUmum = C.saringCatatan(semuaN, { divisi: 'umum' }).map(n => n.id);
cek('4f. Filter divisi "umum" = catatan tanpa divisi', fUmum.join(',') === 'n3,n4', fUmum);
const fPenulis = C.saringCatatan(semuaN, { penulis: 'u-staf' }).map(n => n.id);
cek('4g. Filter penulis', fPenulis.join(',') === 'n1,n4', fPenulis);
const fTgl = C.saringCatatan(semuaN, { rentang: { start: '2026-09-05', end: '2026-09-07' } }).map(n => n.id);
cek('4h. Filter tanggal (WIB) inklusif di kedua ujung', fTgl.join(',') === 'n2,n4', fTgl);
const fGabung = C.saringCatatan(semuaN, { user: stafMcn, tab: 'saya', cari: 'target' }).map(n => n.id);
cek('4i. Filter + pencarian bisa dipakai bersamaan', fGabung.join(',') === 'n4', fGabung);
cek('4j. Tanpa opsi apapun = semua lolos', C.saringCatatan(semuaN).length === 4);
cek('4k. Daftar kosong / bukan array tidak error', C.saringCatatan(null).length === 0 && C.saringCatatan([]).length === 0);

// ============================================================================
judul('5. Urutan (pinned selalu di atas)');
// ============================================================================
const urut = C.urutkanCatatan(semuaN).map(n => n.id);
cek('5a. Disematkan naik ke paling atas walau paling lama', urut[0] === 'n3', urut);
cek('5b. Sisanya terbaru -> terlama', urut.join(',') === 'n3,n4,n2,n1', urut);
const urutLama = C.urutkanCatatan(semuaN, 'terlama').map(n => n.id);
cek('5c. Mode terlama tetap menaruh pinned di atas', urutLama.join(',') === 'n3,n1,n2,n4', urutLama);
const urutJudul = C.urutkanCatatan(semuaN, 'judul').map(n => n.title);
cek('5d. Mode judul A-Z (setelah pinned)', urutJudul[0] === 'SOP Device' && urutJudul[1] === 'Evaluasi DRM 8 September', urutJudul);
cek('5e. Mode tidak dikenal jatuh ke default', C.urutkanCatatan(semuaN, 'ngawur').map(n => n.id).join(',') === 'n3,n4,n2,n1');
const asli = [...semuaN];
C.urutkanCatatan(semuaN, 'terlama');
cek('5f. urutkanCatatan TIDAK mengubah array asli', asli.map(n => n.id).join(',') === semuaN.map(n => n.id).join(','));
cek('5g. Urutan deterministik (dipanggil 2x hasil sama)',
  C.urutkanCatatan(semuaN).map(n => n.id).join(',') === C.urutkanCatatan(semuaN).map(n => n.id).join(','));

// Catatan tanpa createdAt: waktu didekode dari awalan id (pola uid()).
const tanpaTanggal = { id: 'mfjq8k00abc', title: 'Tanpa createdAt', authorId: 'u-staf' };
cek('5h. Tanpa createdAt, waktu didekode dari id', C.waktuCatatan(tanpaTanggal) > 1577836800000);
cek('5i. Id berformat lain -> 0 (dianggap paling lama)', C.waktuCatatan({ id: 'xx' }) === 0);

// ============================================================================
judul('6. Favorit');
// ============================================================================
cek('6a. Tambah favorit', C.toggleFavorit(['a'], 'b').join(',') === 'a,b');
cek('6b. Buang favorit yang sudah ada', C.toggleFavorit(['a', 'b'], 'a').join(',') === 'b');
cek('6c. Daftar bukan array tidak error', C.toggleFavorit(null, 'a').join(',') === 'a');
const favAsli = ['a'];
C.toggleFavorit(favAsli, 'b');
cek('6d. toggleFavorit tidak mengubah array asli', favAsli.join(',') === 'a');
cek('6e. noteId kosong tidak menambah apa-apa', C.toggleFavorit(['a'], '').join(',') === 'a');

// ============================================================================
judul('7. Normalisasi record');
// ============================================================================
const mentah = C.normalisasiCatatan({ id: 'z', content: 'halo', createdAt: '2026-09-01T00:00:00.000Z' });
cek('7a. Kategori kosong -> "lainnya"', mentah.category === 'lainnya');
cek('7b. Visibility kosong -> "private" (default aman)', mentah.visibility === 'private');
cek('7c. isPinned selalu boolean', mentah.isPinned === false);
cek('7d. attachments selalu array', Array.isArray(mentah.attachments) && mentah.attachments.length === 0);
cek('7e. updatedAt ikut createdAt bila belum pernah diubah', mentah.updatedAt === '2026-09-01T00:00:00.000Z');
cek('7f. relatedType/relatedId disiapkan (null) untuk relasi ke depan',
  mentah.relatedType === null && mentah.relatedId === null);
cek('7g. Kategori tidak dikenal (mis. dihapus) -> fallback "lainnya"',
  C.normalisasiCatatan({ id: 'z', category: 'kategori-lama' }).category === 'lainnya');
cek('7h. Input bukan objek -> null', C.normalisasiCatatan(null) === null && C.normalisasiCatatan('x') === null);
cek('7i. labelKategori punya fallback aman', C.labelKategori('tidak-ada') === 'Lainnya');
cek('7j. labelVisibilitas punya fallback aman', C.labelVisibilitas('ngawur') === 'Pribadi');

// Lampiran format lama (string) tetap terbaca
const lamaStr = C.normalisasiLampiran(['https://cdn/a.jpg', 'img:abc']);
cek('7k. Lampiran format lama (string) jadi {src,name,type}',
  lamaStr.length === 2 && lamaStr[0].src === 'https://cdn/a.jpg' && lamaStr[0].type === 'image');
cek('7l. Lampiran objek dipertahankan',
  C.normalisasiLampiran([{ src: 'img:1', name: 'Poster.jpg', type: 'image' }])[0].name === 'Poster.jpg');
cek('7m. Lampiran rusak dibuang, tidak bikin error', C.normalisasiLampiran([null, {}, 5]).length === 0);
cek('7n. punyaGambar & gambarPertama', C.punyaGambar(nUmumSiti) === true && C.gambarPertama(nUmumSiti).src === 'https://cdn/x.jpg');
cek('7o. Catatan tanpa lampiran -> gambarPertama null', C.gambarPertama(nDivisiMcn) === null);

// ============================================================================
judul('8. Teks berformat sederhana');
// ============================================================================
const blok = C.parseIsi('# Hasil Meeting\n\nPoin utama:\n- Upload jam 9\n* Cek stok\n1. Rekap GMV\n- [ ] Kirim laporan\n- [x] Sudah briefing\nTeks biasa');
const tipe = blok.map(b => b.tipe).join(',');
cek('8a. Semua jenis baris terbaca', tipe === 'heading,kosong,teks,butir,butir,nomor,centang,centang,teks', tipe);
cek('8b. Heading menyimpan level', blok[0].level === 1 && blok[0].teks === 'Hasil Meeting');
cek('8c. Ceklis kosong vs tercentang', blok[6].ceklis === false && blok[7].ceklis === true);
cek('8d. Nomor daftar terbaca', blok[5].nomor === 1 && blok[5].teks === 'Rekap GMV');
cek('8e. Isi kosong -> array kosong (bukan error)', C.parseIsi('').length === 0 && C.parseIsi(null).length === 0);
cek('8f. Baris "- [x]" tidak salah dibaca sebagai butir biasa', blok[7].tipe === 'centang' && blok[7].teks === 'Sudah briefing');

const tebal = C.potongTebal('Target **naik 30%** bulan ini');
cek('8g. Teks tebal terpisah benar',
  tebal.length === 3 && tebal[1].tebal === true && tebal[1].teks === 'naik 30%', tebal);
cek('8h. Tanpa penanda tebal -> satu potongan biasa',
  C.potongTebal('biasa saja').length === 1 && C.potongTebal('biasa saja')[0].tebal === false);
cek('8i. Bintang tak berpasangan dibiarkan apa adanya',
  C.potongTebal('nilai **belum ditutup')[0].teks === 'nilai **belum ditutup');
cek('8j. potongTebal string kosong -> []', C.potongTebal('').length === 0);

cek('8k. isiPolos membuang penanda format',
  C.isiPolos('# Judul\n- **Poin** satu') === 'Judul Poin satu', C.isiPolos('# Judul\n- **Poin** satu'));
const panjang = 'kata '.repeat(60);
cek('8l. ringkasIsi memotong dan menutup elipsis',
  C.ringkasIsi(panjang, 40).length <= 43 && C.ringkasIsi(panjang, 40).endsWith('...'));
cek('8m. ringkasIsi tidak memotong isi pendek', C.ringkasIsi('pendek saja', 40) === 'pendek saja');

cek('8n. judulOtomatis ambil baris pertama', C.judulOtomatis('- Upload affiliator sering terlambat') === 'Upload affiliator sering terlambat');
cek('8o. judulOtomatis melewati baris kosong di awal', C.judulOtomatis('\n\n# Rapat Pagi') === 'Rapat Pagi');
cek('8p. judulOtomatis untuk isi kosong', C.judulOtomatis('') === 'Catatan Cepat');
cek('8q. judulOtomatis memotong judul kepanjangan',
  C.judulOtomatis('a'.repeat(120)).length === 63 && C.judulOtomatis('a'.repeat(120)).endsWith('...'));

// ============================================================================
judul('9. Ringkasan & konstanta');
// ============================================================================
const r = C.ringkasanCatatan(semuaN);
cek('9a. Ringkasan total/pinned/bergambar/dibagikan',
  r.total === 4 && r.pinned === 1 && r.bergambar === 1 && r.dibagikan === 3, r);
cek('9b. Ringkasan daftar kosong tidak error', C.ringkasanCatatan([]).total === 0 && C.ringkasanCatatan(null).total === 0);
cek('9c. Prefix penyimpanan per-record terdefinisi',
  C.CATATAN_REC_PREFIX === 'note:rec:' && C.FAVORIT_REC_PREFIX === 'notefav:');
cek('9d. Key backup terdefinisi',
  C.CATATAN_BACKUP_KEY === 'notes:all' && C.FAVORIT_BACKUP_KEY === 'notes:favorites:all');
cek('9e. 9 kategori awal tersedia', Object.keys(C.KATEGORI).length === 9);
cek('9f. Kategori wajib ada semua',
  ['meeting', 'evaluasi', 'ide', 'masalah', 'instruksi', 'dokumentasi', 'sop', 'pembelajaran', 'lainnya']
    .every(k => !!C.KATEGORI[k]));
cek('9g. Default visibilitas = private', C.VISIBILITAS_DEFAULT === 'private');
cek('9h. 4 tab & 4 mode urut tersedia', C.TAB_CATATAN.length === 4 && C.URUT_CATATAN.length === 4);

// ============================================================================
console.log(`\n${'='.repeat(52)}`);
console.log(`HASIL: ${lulus} lulus, ${gagal} gagal (total ${lulus + gagal})`);
console.log('='.repeat(52));
process.exit(gagal > 0 ? 1 : 0);
