// ============================================================================
// LMS V1 — LAPISAN DATA
// ----------------------------------------------------------------------------
// Modul ini TIDAK meng-import App.jsx (hindari circular import). Semua dependensi
// milik app induk (storage, putImage, dll) disuntikkan sekali lewat initLms().
//
// ATURAN kv_store yang WAJIB diikuti (lihat CLAUDE.md):
//  - Semua akses data lewat objek `storage` milik app. Jangan query supabase langsung.
//  - Data yang bertumbuh = PER-RECORD (1 record = 1 baris), bukan satu array besar.
//  - Baca prefix HANYA lewat storage.listByPrefix (dia pakai LIKE, bukan range gte/lt).
//  - listByPrefix hanya SELECT kolom `value` → tiap record WAJIB menyimpan `id` di dalam value.
//  - Prefix TIDAK boleh mengandung '_' (karakter wildcard LIKE).
//  - Key config TIDAK boleh berada di bawah prefix record (dipisah ke 'lms-config:').
// ============================================================================

// ---------- Dependensi yang disuntikkan dari App.jsx ----------
const _dep = {
  storage: null,
  putImage: async (v) => v,
  fetchImage: async (v) => v,
  // Upload BERKAS (PDF) ke Supabase Storage. Sengaja melempar sebagai bawaan:
  // berkas besar TIDAK BOLEH diam-diam mendarat di kv_store (kuota egress).
  putFile: async () => { throw new Error('Upload berkas belum tersedia (initLms belum menyuntikkan putFile).'); },
  // Signed URL berumur pendek untuk berkas di bucket PRIVAT.
  signFile: async () => { throw new Error('Pembaca berkas belum siap (initLms belum menyuntikkan signFile).'); },
  // Jejak akses modul. Kegagalannya TIDAK PERNAH boleh menggagalkan pembacaan.
  logAkses: async () => {},
  log: async () => {},
};

/**
 * Dipanggil SEKALI dari App.jsx sebelum PER_RECORD_LOADERS didaftarkan.
 * `log` dikirim sebagai arrow (bukan referensi langsung ke logActivity) karena
 * logActivity adalah `const` di App.jsx dan belum terinisialisasi pada titik itu (TDZ).
 */
export function initLms(deps) {
  Object.assign(_dep, deps);
}

const st = () => {
  if (!_dep.storage) throw new Error('LMS belum diinisialisasi (initLms belum dipanggil).');
  return _dep.storage;
};

// ---------- PREFIX & KEY ----------
// Catatan: prefix record memakai ':rec:' supaya tidak pernah bentrok dengan key
// logis backup ('lms:paths:all' dst) maupun key config ('lms-config:*').
export const LMS_PATH_PREFIX = 'lms:path:rec:';
export const LMS_COURSE_PREFIX = 'lms:course:rec:';
export const LMS_BODY_PREFIX = 'lms:lesson:body:';
export const LMS_ENROLL_PREFIX = 'lms:enroll:rec:';
export const LMS_PROGRESS_PREFIX = 'lms:progress:rec:';
export const LMS_ATTEMPT_PREFIX = 'lms:attempt:rec:';
export const LMS_SUBMISSION_PREFIX = 'lms:submission:rec:';
export const LMS_VALIDATION_PREFIX = 'lms:validation:rec:';
// Arsip riwayat kuis yang di-reset leader. Prefix TERPISAH supaya tidak pernah
// terhitung sebagai percobaan aktif, tapi tetap ikut backup (bukan data yatim).
export const LMS_RESET_PREFIX = 'lms:attempt-reset:rec:';
// MODUL BACAAN (perpustakaan internal). Sifatnya SUNNAH: tanpa enrollment, tanpa
// progress, dan tidak pernah ikut menghitung persen jalur belajar mana pun.
// Isi teksnya dipisah ke prefix sendiri — sama alasannya dengan lms:lesson:body:,
// supaya memuat DAFTAR modul tidak ikut menarik seluruh isinya.
export const LMS_LIBRARY_PREFIX = 'lms:library:rec:';
export const LMS_LIBRARY_BODY_PREFIX = 'lms:library:body:';

// Key logis untuk mesin backup/restore app (dipetakan ke prefix di App.jsx).
export const LMS_BACKUP_KEYS = [
  'lms:paths:all',
  'lms:courses:all',
  'lms:lesson-bodies:all',
  'lms:enrollments:all',
  'lms:progress:all',
  'lms:attempts:all',
  'lms:submissions:all',
  'lms:validations:all',
  'lms:quiz-resets:all',
  'lms:library:all',
  'lms:library-bodies:all',
];

// ---------- ID ----------
// uid() milik App hanya 5 karakter acak. LMS bisa membuat puluhan record dalam
// milidetik yang sama (mis. enroll massal) → dipakai 10 karakter acak di sini.
export function lmsUid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

// ---------- STATUS ----------
export const COURSE_STATUS = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  published: { label: 'Terbit', color: 'bg-emerald-100 text-emerald-800' },
  archived: { label: 'Diarsipkan', color: 'bg-amber-100 text-amber-800' },
};

// ---------- PRIORITAS KURSUS (Wajib / Sunnah / Mubah) ----------
// Ini METADATA TAMPILAN + nilai bawaan saja. Mesin progress TIDAK melihatnya:
// yang menentukan persen tetap field `required` pada materi & entry jalur belajar.
export const COURSE_PRIORITY = {
  wajib:  { label: 'Wajib',  color: 'bg-blue-100 text-blue-800',       desc: 'Harus diselesaikan (onboarding)' },
  sunnah: { label: 'Sunnah', color: 'bg-emerald-100 text-emerald-800', desc: 'Sangat dianjurkan' },
  mubah:  { label: 'Mubah',  color: 'bg-slate-100 text-slate-700',     desc: 'Boleh dipelajari bila perlu' },
};

/**
 * Prioritas satu kursus, dengan KOMPATIBILITAS MUNDUR:
 * kursus lama yang belum punya field `priority` dianggap 'wajib' di semua tampilan.
 * Sengaja TANPA migrasi data — cukup fallback saat membaca.
 * @returns {{key: string, label: string, color: string, desc: string}}
 */
export function coursePriority(course) {
  const key = (course && COURSE_PRIORITY[course.priority]) ? course.priority : 'wajib';
  return { key, ...COURSE_PRIORITY[key] };
}

export const ENROLL_STATUS = {
  NOT_STARTED: { label: 'Belum Mulai', color: 'bg-slate-100 text-slate-700' },
  IN_PROGRESS: { label: 'Sedang Belajar', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-800' },
};
export const SUBMISSION_STATUS = {
  NOT_SUBMITTED: { label: 'Belum Dikirim', color: 'bg-slate-100 text-slate-700' },
  SUBMITTED: { label: 'Menunggu Review', color: 'bg-amber-100 text-amber-800' },
  UNDER_REVIEW: { label: 'Sedang Direview', color: 'bg-blue-100 text-blue-800' },
  REVISION_REQUIRED: { label: 'Perlu Revisi', color: 'bg-orange-100 text-orange-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-emerald-100 text-emerald-800' },
};
export const VALIDATION_STATUS = {
  PENDING: { label: 'Menunggu Validasi', color: 'bg-slate-100 text-slate-700' },
  COMPETENT: { label: 'Kompeten', color: 'bg-emerald-100 text-emerald-800' },
  NEEDS_IMPROVEMENT: { label: 'Perlu Pembinaan', color: 'bg-orange-100 text-orange-800' },
};
export const LESSON_TYPES = {
  text: { label: 'Materi Teks', icon: 'FileText' },
  pdf: { label: 'Bacaan PDF', icon: 'FileText' },
  video: { label: 'Video', icon: 'PlayCircle' },
  document: { label: 'Dokumen / Link', icon: 'Link2' },
  quiz: { label: 'Kuis', icon: 'ListChecks' },
  assignment: { label: 'Tugas Praktik', icon: 'ClipboardList' },
};
export const QUESTION_TYPES = {
  single: 'Pilihan Ganda (1 jawaban)',
  truefalse: 'Benar / Salah',
  multiple: 'Pilihan Ganda (banyak jawaban)',
};

// ============================================================================
// KUNCI JAWABAN — disimpan sebagai hash, bukan teks terbuka
// ----------------------------------------------------------------------------
// App ini tidak punya backend, jadi penilaian dihitung di browser. Supaya kunci
// jawaban tidak terbaca lewat DevTools, yang disimpan adalah SHA-256(salt + jawaban).
// Batas yang jujur: untuk pilihan ganda 4 opsi, kunci masih bisa ditebak dengan
// 4x percobaan hash. Karena itu skor bersifat indikatif dan keputusan KOMPETEN
// tetap di tangan leader (lihat validasi kompetensi).
// ============================================================================
export function normalizeAnswer(val) {
  if (Array.isArray(val)) return [...val].map(String).sort().join('|');
  return String(val ?? '').trim().toLowerCase();
}

export async function hashAnswer(val, salt) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(salt) + '::' + normalizeAnswer(val)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function genAnswerSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Dipakai course builder saat menyimpan soal: ubah jawaban terbuka → salt + hash. */
export async function sealQuestion(q) {
  const salt = q.answerSalt || genAnswerSalt();
  const answerHash = await hashAnswer(q._plainAnswer, salt);
  const out = { ...q, answerSalt: salt, answerHash };
  delete out._plainAnswer; // JANGAN pernah ikut tersimpan
  return out;
}

/** Cek jawaban peserta terhadap hash. */
export async function isAnswerCorrect(q, given) {
  if (!q || !q.answerHash) return false;
  const h = await hashAnswer(given, q.answerSalt);
  return h === q.answerHash;
}

// ============================================================================
// LOADER PER-RECORD
// ============================================================================
export async function loadLmsPaths() { return await st().listByPrefix(LMS_PATH_PREFIX); }
export async function loadLmsCourses() { return await st().listByPrefix(LMS_COURSE_PREFIX); }
export async function loadLmsBodies() { return await st().listByPrefix(LMS_BODY_PREFIX); }
export async function loadLmsEnrollments() { return await st().listByPrefix(LMS_ENROLL_PREFIX); }
export async function loadLmsProgress() { return await st().listByPrefix(LMS_PROGRESS_PREFIX); }
export async function loadLmsAttempts() { return await st().listByPrefix(LMS_ATTEMPT_PREFIX); }
export async function loadLmsSubmissions() { return await st().listByPrefix(LMS_SUBMISSION_PREFIX); }
export async function loadLmsValidations() { return await st().listByPrefix(LMS_VALIDATION_PREFIX); }
export async function loadLmsQuizResets() { return await st().listByPrefix(LMS_RESET_PREFIX); }
export async function loadLmsLibrary() { return await st().listByPrefix(LMS_LIBRARY_PREFIX); }
export async function loadLmsLibraryBodies() { return await st().listByPrefix(LMS_LIBRARY_BODY_PREFIX); }

// --- Pembacaan HEMAT EGRESS: hanya milik satu peserta ---
// Karena key progres/enrollment berbentuk '<prefix><userId>:<...>', peserta cukup
// menarik barisnya sendiri. Ini satu-satunya cara memfilter tanpa melanggar aturan
// "wajib LIKE" di CLAUDE.md, dan menghemat egress sangat besar.
export async function loadMyEnrollments(userId) { return await st().listByPrefix(LMS_ENROLL_PREFIX + userId + ':'); }
export async function loadMyProgress(userId) { return await st().listByPrefix(LMS_PROGRESS_PREFIX + userId + ':'); }
export async function loadMyAttempts(userId) { return await st().listByPrefix(LMS_ATTEMPT_PREFIX + userId + ':'); }
export async function loadMySubmissions(userId) { return await st().listByPrefix(LMS_SUBMISSION_PREFIX + userId + ':'); }
export async function loadMyValidations(userId) { return await st().listByPrefix(LMS_VALIDATION_PREFIX + userId + ':'); }

// --- "Isi panjang" dimuat ON-DEMAND + cache per sesi (meniru brankas gambar app) ---
/**
 * Pabrik penyimpan isi panjang. Dipakai dua kali: isi materi kursus
 * (lms:lesson:body:) dan isi modul bacaan (lms:library:body:). Keduanya ditaruh di
 * record terpisah supaya memuat DAFTAR tidak ikut menarik seluruh isinya.
 *
 * PENTING: pembacanya MELEMPAR error saat gagal (tidak mengembalikan '').
 * Kalau kegagalan koneksi ditelan jadi string kosong, dua hal buruk terjadi:
 *  - pembaca melihat "materi kosong" padahal materinya ada (pesan menyesatkan);
 *  - editor memuat kosong lalu MENIMPA isi asli dengan kosong saat disimpan.
 */
function makeBodyStore(prefix, pesanGagalSimpan) {
  const cache = new Map();
  const pending = new Map();
  return {
    /** @param {boolean} force - abaikan cache (dipakai tombol "Muat Ulang Materi") */
    async load(id, force = false) {
      if (!id) return '';
      if (force) { cache.delete(id); pending.delete(id); }
      if (cache.has(id)) return cache.get(id);
      if (pending.has(id)) return pending.get(id);
      const p = st().get(prefix + id)
        .then(v => {
          const s = (v && typeof v === 'object') ? (v.body || '') : (typeof v === 'string' ? v : '');
          cache.set(id, s);
          pending.delete(id);
          return s;
        })
        .catch(err => { pending.delete(id); throw err; });
      pending.set(id, p);
      return p;
    },
    async save(id, body) {
      const ok = await st().set(prefix + id, { id, body: body || '' });
      if (!ok) throw new Error(pesanGagalSimpan);
      cache.set(id, body || '');
      return true;
    },
    forget(id) { cache.delete(id); pending.delete(id); },
  };
}

const _lessonBodies = makeBodyStore(LMS_BODY_PREFIX, 'Gagal menyimpan isi materi ke server.');
export const loadLessonBody = (lessonId, force = false) => _lessonBodies.load(lessonId, force);
export const saveLessonBody = (lessonId, body) => _lessonBodies.save(lessonId, body);

const _libraryBodies = makeBodyStore(LMS_LIBRARY_BODY_PREFIX, 'Gagal menyimpan isi modul bacaan ke server.');
export const loadLibraryBody = (id, force = false) => _libraryBodies.load(id, force);
export const saveLibraryBody = (id, body) => _libraryBodies.save(id, body);

// ============================================================================
// TULIS (1 record = 1 baris). Selalu periksa nilai balik set() — storage.set
// mengembalikan false saat gagal, TIDAK melempar.
// ============================================================================
async function putRec(prefix, rec) {
  if (!rec || !rec.id) throw new Error('Record LMS wajib punya id.');
  const ok = await st().set(prefix + rec.id, rec);
  if (!ok) throw new Error('Gagal menyimpan ke server. Data lama tidak berubah.');
  return rec;
}

export const savePath = (rec) => putRec(LMS_PATH_PREFIX, rec);
export const saveCourse = (rec) => putRec(LMS_COURSE_PREFIX, rec);
export const saveEnrollment = (rec) => putRec(LMS_ENROLL_PREFIX, rec);
export const saveProgress = (rec) => putRec(LMS_PROGRESS_PREFIX, rec);
export const saveAttempt = (rec) => putRec(LMS_ATTEMPT_PREFIX, rec);
export const saveSubmission = (rec) => putRec(LMS_SUBMISSION_PREFIX, rec);
export const saveValidation = (rec) => putRec(LMS_VALIDATION_PREFIX, rec);

export const deletePath = (id) => st().delete(LMS_PATH_PREFIX + id);
export const deleteCourse = (id) => st().delete(LMS_COURSE_PREFIX + id);
// Modul bacaan: record & isinya dihapus TERPISAH (dua baris kv_store).
export const saveLibrary = (rec) => putRec(LMS_LIBRARY_PREFIX, rec);
export const getLibrary = (id) => st().get(LMS_LIBRARY_PREFIX + id);
export const deleteLibrary = (id) => st().delete(LMS_LIBRARY_PREFIX + id);
export async function deleteLibraryBody(id) {
  const ok = await st().delete(LMS_LIBRARY_BODY_PREFIX + id);
  _libraryBodies.forget(id);
  return ok;
}

// Baca satu record dari server. Dipakai course/path builder untuk mengambil status
// TERBARU sebelum menyimpan, supaya form yang sudah lama terbuka tidak mengembalikan
// kursus/jalur yang sudah terbit menjadi draft.
export const getCourse = (id) => st().get(LMS_COURSE_PREFIX + id);
export const getPath = (id) => st().get(LMS_PATH_PREFIX + id);

export async function lmsLog(text, userName) {
  try { await _dep.log(text, userName); } catch { /* log gagal tidak boleh menggagalkan aksi */ }
}
export const lmsPutImage = (b64) => _dep.putImage(b64);
export const lmsFetchImage = (ref) => _dep.fetchImage(ref);
/**
 * Unggah satu Blob/File (dipakai materi PDF & modul bacaan) → URL publik Storage.
 * TIDAK punya fallback ke database: PDF terlalu besar untuk kv_store, dan menyimpannya
 * di sana persis cara project ini dulu kena batas kuota egress.
 */
export const lmsPutFile = (blob, opts) => _dep.putFile(blob, opts);

/** Signed URL berumur pendek (detik) untuk satu berkas di bucket privat. */
export const lmsSignFile = (path, detik) => _dep.signFile(path, detik);

/** Catat "siapa membuka modul apa". Best-effort — tidak pernah melempar keluar. */
export async function lmsLogAkses(info) {
  try { await _dep.logAkses(info); } catch { /* jejak gagal tidak boleh memblokir bacaan */ }
}

// Umur signed URL. Cukup pendek supaya link yang bocor cepat mati, dan itu aman
// karena berkasnya langsung ditarik ke memori begitu URL didapat — masa berlaku
// tidak pernah mengganggu peserta yang sedang membaca.
export const UMUR_SIGNED_URL_DETIK = 600;

/**
 * Ambil isi berkas PDF sebagai bytes untuk dirender dari MEMORI.
 *
 * Kenapa tidak menaruh URL-nya di <a href> / iframe / window.open:
 *  - URL yang pernah muncul di DOM atau tab baru bisa disalin & disebar;
 *  - berkas yang dibuka lewat viewer bawaan browser selalu punya tombol
 *    unduh dan cetak yang tidak bisa kita matikan.
 * Dengan menariknya ke ArrayBuffer, berkasnya hanya hidup di memori tab ini.
 *
 * @param {{pdfPath?: string, pdfUrl?: string}} berkas
 * @returns {Promise<Uint8Array>}
 */
export async function loadLmsFileBytes(berkas) {
  const path = String(berkas?.pdfPath || '').trim();
  const urlLama = String(berkas?.pdfUrl || '').trim();
  let url = '';
  if (path) {
    url = await lmsSignFile(path, UMUR_SIGNED_URL_DETIK);
    if (!url) throw new Error('Izin membaca berkas tidak didapat. Coba muat ulang halaman.');
  } else if (urlLama) {
    // KOMPATIBILITAS MUNDUR: berkas yang diunggah sebelum bucket privat dipakai
    // masih berupa URL publik di bucket 'photos'. Tetap bisa dibaca supaya materi
    // lama tidak mati, tapi berkasnya sendiri belum terlindungi — unggah ulang
    // lewat form materi/modul untuk memindahkannya.
    url = urlLama;
  } else {
    throw new Error('Berkas PDF belum tersedia.');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('Berkas gagal diunduh dari server (kode ' + res.status + ').');
  const buf = await res.arrayBuffer();
  if (!buf || buf.byteLength === 0) throw new Error('Berkas kosong atau rusak.');
  return new Uint8Array(buf);
}

/** Apakah berkas ini masih memakai URL publik lama (belum pindah ke bucket privat)? */
export const berkasBelumTerlindungi = (berkas) =>
  !String(berkas?.pdfPath || '').trim() && !!String(berkas?.pdfUrl || '').trim();

// ============================================================================
// KUNCI KOMPOSIT DETERMINISTIK
// Dipakai supaya operasi bersifat IDEMPOTEN: menulis dua kali menghasilkan baris
// yang sama, bukan duplikat. Ini yang membuat auto-enrollment aman diulang.
// ============================================================================
export const enrollId = (userId, pathId) => `${userId}:${pathId}`;
export const progressId = (userId, lessonId) => `${userId}:${lessonId}`;
export const submissionId = (userId, lessonId) => `${userId}:${lessonId}`;
export const validationId = (userId, pathId) => `${userId}:${pathId}`;
export const attemptId = (userId, lessonId, n) => `${userId}:${lessonId}:${String(n).padStart(3, '0')}`;

// ============================================================================
// LINK VIDEO — apakah ini YouTube?
// ----------------------------------------------------------------------------
// Kalau YA, materi video diputar DI DALAM aplikasi (IFrame API) supaya persen
// tontonan bisa dicatat. Kalau BUKAN (mis. Google Drive), perilaku lama tetap:
// tombol yang membuka tab baru, tanpa pelacakan. Logika murni ditaruh di sini
// supaya ikut terjaga uji-lms.mjs.
// ============================================================================
const _ytClean = (id) => (/^[A-Za-z0-9_-]{6,}$/.test(id || '') ? id : '');

/**
 * Normalkan link yang ditempel admin jadi URL absolut.
 * Tanpa ini, link tanpa skema ('youtu.be/xxxx') bukan cuma gagal dikenali —
 * href-nya juga jadi tautan RELATIF yang menyesatkan di dalam app.
 * @returns {string} URL absolut, atau '' kalau memang bukan link.
 */
export function normalizeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  try { return new URL(s).href; } catch { /* coba lagi dengan skema */ }
  if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?)/i.test(s)) {
    try { return new URL('https://' + s).href; } catch { return ''; }
  }
  return '';
}

/** @returns {string} id video YouTube, atau '' bila bukan link YouTube. */
export function youtubeId(url) {
  const s = normalizeUrl(url);
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { return ''; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const isYt = host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com'
    || host === 'youtube-nocookie.com' || host === 'youtu.be';
  if (!isYt) return '';
  if (host === 'youtu.be') return _ytClean(u.pathname.slice(1).split('/')[0]);
  const v = u.searchParams.get('v');
  if (v) return _ytClean(v);                                          // /watch?v=ID
  const m = u.pathname.match(/^\/(embed|shorts|v|live)\/([^/?#]+)/);   // /embed/ /shorts/ /v/ /live/
  return m ? _ytClean(m[2]) : '';
}

// ============================================================================
// HELPER STRUKTUR KURSUS
// ============================================================================
export function allLessons(course) {
  if (!course || !Array.isArray(course.modules)) return [];
  const out = [];
  [...course.modules]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach(m => {
      [...(m.lessons || [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .forEach(l => out.push({ ...l, moduleId: m.id, moduleTitle: m.title }));
    });
  return out;
}
export function requiredLessons(course) {
  return allLessons(course).filter(l => l.required !== false);
}
export function findLesson(course, lessonId) {
  return allLessons(course).find(l => l.id === lessonId) || null;
}
export function courseTotalMinutes(course) {
  return allLessons(course).reduce((s, l) => s + (Number(l.estimatedMinutes) || 0), 0);
}

// ============================================================================
// MESIN PROGRESS
// ----------------------------------------------------------------------------
// Rumus V1 (spec Bagian 18):
//   persen = lesson WAJIB yang selesai / total lesson WAJIB × 100
// Lesson opsional TIDAK menghambat penyelesaian.
//
// Sebuah lesson dianggap selesai bila:
//   text/pdf/video/document → ada record progress yang berstatus SELESAI
//   quiz                    → ada attempt yang LULUS
//   assignment              → submission berstatus APPROVED
// Tidak ada nilai progress yang disimpan ganda: semuanya dihitung dari
// sumber kebenaran (progress / attempts / submissions).
// ============================================================================

/**
 * KONTRAK "SELESAI" PADA RECORD PROGRESS — jantung kompatibilitas mundur.
 *
 * Dulu artinya sederhana: "ada record progress" = materi SELESAI. Sejak materi PDF
 * dan video YouTube bisa menyimpan progres PARSIAL (mis. baru dibaca 40%), satu record
 * yang sama dipakai untuk dua arti. Aturan yang dipegang:
 *   - Record LAMA (tidak punya field `done` sama sekali) → tetap dianggap SELESAI.
 *     Progres peserta yang sudah ada TIDAK BOLEH rusak hanya karena formatnya berkembang.
 *   - Record BARU → selesai HANYA bila done === true.
 * isLessonDone() tidak perlu tahu bedanya: penyaringan terjadi saat progressSet dibangun
 * di buildCtx(). Halaman yang menyusun progressSet sendiri WAJIB memakai fungsi ini juga.
 */
export function isProgressDone(rec) {
  if (!rec || typeof rec !== 'object') return false;
  return rec.done === undefined ? true : rec.done === true;
}

/**
 * Persen baca/tonton yang tersimpan (0–100).
 * Record lama tidak punya field `percent` → 100 bila selesai, 0 bila tidak.
 */
export function progressPercent(rec) {
  if (!rec) return 0;
  const p = Number(rec.percent);
  if (Number.isFinite(p)) return Math.max(0, Math.min(100, Math.round(p)));
  return isProgressDone(rec) ? 100 : 0;
}
export function isLessonDone(lesson, ctx) {
  if (!lesson) return false;
  const { progressSet, attemptsByLesson, submissionsByLesson } = ctx;
  if (lesson.type === 'quiz') {
    const list = attemptsByLesson?.get(lesson.id) || [];
    return list.some(a => a.passed);
  }
  if (lesson.type === 'assignment') {
    const s = submissionsByLesson?.get(lesson.id);
    return s?.status === 'APPROVED';
  }
  return !!progressSet?.has(lesson.id);
}

export function computeCourseProgress(course, ctx) {
  const req = requiredLessons(course);
  const done = req.filter(l => isLessonDone(l, ctx)).length;
  const total = req.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  // Kursus tanpa lesson wajib TIDAK otomatis dianggap selesai — supaya kursus
  // kosong/draft tidak menaikkan progress jalur belajar secara keliru.
  return { done, total, percent, completed: total > 0 && done === total };
}

/** Lesson berikutnya yang belum selesai (dipakai tombol "Lanjutkan Belajar"). */
export function nextLessonOf(course, ctx) {
  return allLessons(course).find(l => !isLessonDone(l, ctx)) || null;
}

/**
 * Penguncian linear sederhana (spec Bagian 12: prasyarat cukup linear).
 * Sebuah lesson terkunci bila masih ada lesson WAJIB sebelumnya yang belum selesai.
 */
export function lockedLessonIds(course, ctx) {
  const locked = new Set();
  let blocked = false;
  for (const l of allLessons(course)) {
    if (blocked) locked.add(l.id);
    if (l.required !== false && !isLessonDone(l, ctx)) blocked = true;
  }
  return locked;
}

export function computePathProgress(path, coursesById, ctx) {
  const semua = [...(path?.courses || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  // Hanya hitung kursus yang BENAR-BENAR ADA di peta. Kursus yang hilang (dihapus,
  // atau dikembalikan ke draft oleh admin) harus keluar dari pembilang DAN penyebut.
  // Kalau tidak, `percent` bisa 100% sementara `completed` selamanya false — peserta
  // melihat "100%" tapi jalurnya tidak pernah dinyatakan selesai dan tidak pernah
  // muncul di antrean validasi leader.
  const entries = semua.filter(e => coursesById.has(e.courseId));
  const required = entries.filter(e => e.required !== false);
  const dilewati = semua.length - entries.length;
  let doneCourses = 0, sumDone = 0, sumTotal = 0;
  for (const e of entries) {
    const c = coursesById.get(e.courseId);
    const p = computeCourseProgress(c, ctx);
    // Persen dihitung dari kursus WAJIB saja supaya 100% selalu berarti sama dengan
    // "selesai". Kalau kursus opsional ikut dihitung, jalur bisa berstatus Selesai
    // sambil menampilkan 67% — membingungkan peserta maupun leader.
    if (e.required !== false) { sumDone += p.done; sumTotal += p.total; }
    if (e.required !== false && p.completed) doneCourses++;
  }
  const percent = sumTotal === 0 ? 0 : Math.round((sumDone / sumTotal) * 100);
  return {
    percent,
    lessonsDone: sumDone,
    lessonsTotal: sumTotal,
    coursesDone: doneCourses,
    coursesTotal: required.length,
    completed: required.length > 0 && doneCourses === required.length,
    // Jumlah kursus dalam jalur yang tidak bisa dihitung (belum terbit / sudah dihapus).
    // Dipakai halaman untuk memberi tahu admin bahwa jalurnya perlu dirapikan.
    dilewati,
  };
}

/** Susun konteks progress dari array mentah (dipakai semua halaman). */
export function buildCtx({ progress = [], attempts = [], submissions = [] }, userId = null) {
  const pr = userId ? progress.filter(p => p.userId === userId) : progress;
  const at = userId ? attempts.filter(a => a.userId === userId) : attempts;
  const sb = userId ? submissions.filter(s => s.userId === userId) : submissions;
  // Hanya record yang BENAR-BENAR selesai yang masuk progressSet — record parsial
  // (PDF baru dibaca separuh / video baru ditonton 40%) tidak boleh dihitung selesai.
  const progressSet = new Set(pr.filter(p => isProgressDone(p)).map(p => p.lessonId));
  const attemptsByLesson = new Map();
  at.forEach(a => {
    if (!attemptsByLesson.has(a.lessonId)) attemptsByLesson.set(a.lessonId, []);
    attemptsByLesson.get(a.lessonId).push(a);
  });
  attemptsByLesson.forEach(list => list.sort((x, y) => (x.attemptNo || 0) - (y.attemptNo || 0)));
  const submissionsByLesson = new Map();
  sb.forEach(s => submissionsByLesson.set(s.lessonId, s));
  return { progressSet, attemptsByLesson, submissionsByLesson };
}

// ============================================================================
// TARGETING & AUTO-ENROLLMENT
// ----------------------------------------------------------------------------
// Jalur belajar ditargetkan ke DIVISI dan/atau JABATAN. Aturan pencocokan:
//   - Kalau kedua daftar target kosong → jalur TIDAK pernah auto-enroll
//     (harus ditugaskan manual). Ini mencegah semua orang kebanjiran kursus.
//   - Kalau hanya divisi diisi → cocok bila divisi user termasuk.
//   - Kalau hanya jabatan diisi → cocok bila jabatan user termasuk.
//   - Kalau keduanya diisi → user harus cocok di KEDUANYA.
// ============================================================================
export function pathMatchesUser(path, user) {
  if (!path || path.status !== 'published' || !user) return false;
  const divs = path.targetDivisions || [];
  const jobs = path.targetJobTitles || [];
  if (divs.length === 0 && jobs.length === 0) return false;
  const okDiv = divs.length === 0 || divs.includes(user.division);
  const okJob = jobs.length === 0 || jobs.includes((user.jobTitle || '').trim());
  return okDiv && okJob;
}

/**
 * Auto-enrollment IDEMPOTEN.
 * - Key enrollment deterministik (`<userId>:<pathId>`) → menjalankan ini dua kali
 *   TIDAK membuat duplikat.
 * - Tidak pernah menghapus/mengubah enrollment yang sudah ada, termasuk saat
 *   posisi karyawan berubah (riwayat belajar tetap utuh — spec Bagian 13).
 * - Tidak ada transaksi di kv_store, jadi tiap enrollment ditulis sendiri-sendiri
 *   dan kegagalan satu baris tidak membatalkan yang lain; karena idempoten,
 *   menjalankan ulang akan melengkapi yang tertinggal.
 * @returns {Promise<{created: Array, skipped: number, failed: Array}>}
 */
export async function autoEnrollUser(user, paths, existingEnrollments, actor) {
  const created = [], failed = [];
  let skipped = 0;
  const have = new Set((existingEnrollments || []).map(e => e.id));
  for (const p of paths || []) {
    if (!pathMatchesUser(p, user)) continue;
    const id = enrollId(user.id, p.id);
    if (have.has(id)) { skipped++; continue; }
    const rec = {
      id,
      userId: user.id,
      userName: user.name,
      pathId: p.id,
      pathTitle: p.title,
      status: 'NOT_STARTED',
      source: 'AUTO',
      assignedAt: new Date().toISOString(),
      assignedById: actor?.id || null,
      assignedByName: actor?.name || 'Sistem',
      startedAt: null,
      completedAt: null,
    };
    try { await saveEnrollment(rec); created.push(rec); }
    catch (e) { failed.push({ pathId: p.id, message: e?.message || String(e) }); }
  }
  return { created, skipped, failed };
}

/** Penugasan manual oleh admin (source = MANUAL, tidak menimpa yang sudah ada). */
export async function manualEnroll(user, path, existingEnrollments, actor) {
  const id = enrollId(user.id, path.id);
  if ((existingEnrollments || []).some(e => e.id === id)) return null;
  const rec = {
    id, userId: user.id, userName: user.name,
    pathId: path.id, pathTitle: path.title,
    status: 'NOT_STARTED', source: 'MANUAL',
    assignedAt: new Date().toISOString(),
    assignedById: actor?.id || null, assignedByName: actor?.name || '-',
    startedAt: null, completedAt: null,
  };
  await saveEnrollment(rec);
  return rec;
}

/**
 * Selaraskan status enrollment dengan progress nyata.
 * Hanya menulis kalau status BERUBAH → menghindari tulisan sia-sia tiap render.
 */
export async function syncEnrollmentStatus(enrollment, pathProgress) {
  if (!enrollment) return enrollment;
  let status = 'NOT_STARTED';
  if (pathProgress.completed) status = 'COMPLETED';
  else if (pathProgress.lessonsDone > 0) status = 'IN_PROGRESS';
  const startedAt = enrollment.startedAt || (status !== 'NOT_STARTED' ? new Date().toISOString() : null);
  const completedAt = status === 'COMPLETED' ? (enrollment.completedAt || new Date().toISOString()) : null;
  if (status === enrollment.status && startedAt === enrollment.startedAt && completedAt === enrollment.completedAt) {
    return enrollment;
  }
  const next = { ...enrollment, status, startedAt, completedAt };
  try { await saveEnrollment(next); } catch { return enrollment; }
  return next;
}

// ============================================================================
// HAK AKSES
// ----------------------------------------------------------------------------
// Mengikuti sistem role yang sudah ada (owner/manajer/leader/operasional) dan
// relasi leaderId. TIDAK membuat sistem izin baru.
// Catatan jujur: app ini menegakkan otorisasi di frontend (tidak ada backend dan
// RLS-nya `using(true)`), jadi pengecekan ini adalah pagar produk, bukan pagar
// keamanan kriptografis. Batasan ini berlaku untuk SELURUH app, bukan khusus LMS.
// ============================================================================
export const isLmsAdmin = (u) => !!u && (u.role === 'owner' || u.role === 'manajer');
export const isLmsReviewer = (u) => !!u && (u.role === 'owner' || u.role === 'manajer' || u.role === 'leader');

/** Peserta yang boleh dilihat/direview oleh `user`. */
export function learnersVisibleTo(user, allUsers) {
  if (!user) return [];
  if (isLmsAdmin(user)) return allUsers;
  if (user.role === 'leader') return allUsers.filter(u => u.leaderId === user.id);
  return allUsers.filter(u => u.id === user.id);
}

export function canReviewLearner(user, learner) {
  if (!user || !learner) return false;
  if (isLmsAdmin(user)) return true;
  return user.role === 'leader' && learner.leaderId === user.id;
}

// ============================================================================
// PENILAIAN KUIS
// ----------------------------------------------------------------------------
// Dihitung di browser (app tidak punya backend). Kunci jawaban tersimpan sebagai
// hash sehingga tidak terbaca langsung. Skor bersifat indikatif; keputusan akhir
// "KOMPETEN" tetap dibuat leader lewat validasi kompetensi.
// ============================================================================
export async function gradeQuiz(quiz, answers) {
  const questions = quiz?.questions || [];
  let score = 0, maxScore = 0;
  const detail = [];
  for (const q of questions) {
    const pts = Number(q.points) || 1;
    maxScore += pts;
    const given = answers[q.id];
    const answered = Array.isArray(given) ? given.length > 0 : (given !== undefined && given !== null && given !== '');
    const correct = answered ? await isAnswerCorrect(q, given) : false;
    if (correct) score += pts;
    detail.push({ questionId: q.id, correct, given, points: pts, explanation: q.explanation || '' });
  }
  const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  const passingScore = Number(quiz?.passingScore) || 0;
  return { score, maxScore, percent, passed: percent >= passingScore, passingScore, detail };
}

export function attemptsUsed(attempts, lessonId, userId) {
  return (attempts || []).filter(a => a.lessonId === lessonId && a.userId === userId).length;
}
export function attemptsLeft(quiz, attempts, lessonId, userId) {
  const max = Number(quiz?.maxAttempts) || 0;
  if (max <= 0) return Infinity;
  return Math.max(0, max - attemptsUsed(attempts, lessonId, userId));
}
export function bestAttempt(attempts, lessonId, userId) {
  const list = (attempts || []).filter(a => a.lessonId === lessonId && a.userId === userId);
  if (!list.length) return null;
  return list.reduce((b, a) => (a.percent > (b?.percent ?? -1) ? a : b), null);
}

/**
 * Reset kesempatan kuis oleh leader/admin (spec Bagian 57.3).
 * Attempt lama DIHAPUS supaya hitungan kesempatan kembali dari nol, tetapi
 * riwayat skornya disalin ke record arsip agar jejak tidak hilang sama sekali.
 */
export async function resetQuizAttempts(userId, lessonId, attempts, actor) {
  const mine = (attempts || []).filter(a => a.userId === userId && a.lessonId === lessonId);
  if (!mine.length) return 0;
  const archive = {
    id: `${userId}:${lessonId}:reset:${Date.now().toString(36)}`,
    userId, lessonId,
    resetAt: new Date().toISOString(),
    resetById: actor?.id || null,
    resetByName: actor?.name || '-',
    previous: mine.map(a => ({ attemptNo: a.attemptNo, percent: a.percent, passed: a.passed, submittedAt: a.submittedAt })),
  };
  // Arsip disimpan di prefix BERBEDA supaya tidak ikut terhitung sebagai attempt aktif.
  // PENTING: storage.set/delete MENGEMBALIKAN false saat gagal, TIDAK melempar.
  // Kalau nilai baliknya tidak diperiksa, arsip bisa gagal tersimpan tetapi attempt
  // asli tetap terhapus → riwayat nilai peserta hilang permanen tanpa jejak.
  const okArsip = await st().set(LMS_RESET_PREFIX + archive.id, archive);
  if (!okArsip) throw new Error('Gagal menyimpan arsip riwayat kuis. Reset dibatalkan — percobaan lama TIDAK dihapus.');
  const gagal = [];
  for (const a of mine) {
    const okDel = await st().delete(LMS_ATTEMPT_PREFIX + a.id);
    if (okDel === false) gagal.push(a.id);
  }
  if (gagal.length) {
    throw new Error(`Sebagian percobaan gagal dihapus (${gagal.length} dari ${mine.length}). Arsip sudah tersimpan — coba reset ulang.`);
  }
  return mine.length;
}

// ============================================================================
// TUGAS PRAKTIK — riwayat pengiriman TIDAK pernah ditimpa
// ============================================================================
export function emptySubmission(user, lesson, courseId) {
  return {
    id: submissionId(user.id, lesson.id),
    userId: user.id, userName: user.name,
    lessonId: lesson.id, lessonTitle: lesson.title,
    courseId,
    status: 'NOT_SUBMITTED',
    history: [], reviews: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/**
 * Baca ulang satu record submission dari server (untuk menghindari lost update).
 * SENGAJA MELEMPAR saat gagal baca: `null` di sini berarti "record memang belum ada",
 * dan itu harus dibedakan dari "koneksi gagal". Kalau keduanya disamakan, pemanggil
 * akan menulis dari salinan layar yang basi dan menghapus entri pihak lain — persis
 * lost update yang ingin dicegah fungsi ini.
 */
export async function getSubmission(id) {
  return await st().get(LMS_SUBMISSION_PREFIX + id);
}

// CATATAN LOST UPDATE: kv_store tidak punya transaksi maupun compare-and-set.
// Peserta dan leader menulis ke record submission yang SAMA. Kalau kita menulis
// dari salinan yang sudah lama dipegang di layar, entri pihak lain hilang walau
// kodenya "append". Karena itu kedua fungsi di bawah SELALU membaca ulang record
// terbaru lebih dulu, lalu menambahkan entri di atasnya. Jendela balapannya
// menyempit dari "selama modal terbuka" menjadi beberapa milidetik.
export async function submitAssignment(current, { text, link, images }, user) {
  let fresh;
  try { fresh = (await getSubmission(current.id)) || current; }
  catch { throw new Error('Tidak bisa memeriksa data terbaru di server. Pengiriman dibatalkan supaya riwayat yang sudah ada tidak tertimpa. Cek koneksi lalu coba lagi.'); }
  const entry = {
    at: new Date().toISOString(),
    text: (text || '').trim(),
    link: (link || '').trim(),
    images: images || [],
    byId: user.id, byName: user.name,
  };
  const next = {
    ...fresh,
    status: 'SUBMITTED',
    history: [...(fresh.history || []), entry], // append, bukan overwrite (spec Bagian 23)
    updatedAt: entry.at,
  };
  await saveSubmission(next);
  return next;
}

export async function reviewAssignment(current, decision, note, reviewer) {
  let fresh;
  try { fresh = (await getSubmission(current.id)) || current; }
  catch { throw new Error('Tidak bisa memeriksa data terbaru di server. Review dibatalkan supaya kiriman terbaru peserta tidak tertimpa. Cek koneksi lalu coba lagi.'); }
  const entry = {
    at: new Date().toISOString(),
    decision, // 'APPROVED' | 'REVISION_REQUIRED'
    note: (note || '').trim(),
    byId: reviewer.id, byName: reviewer.name,
  };
  const next = {
    ...fresh,
    status: decision,
    reviews: [...(fresh.reviews || []), entry],
    updatedAt: entry.at,
  };
  await saveSubmission(next);
  return next;
}

// ============================================================================
// VALIDASI KOMPETENSI (spec Bagian 25)
// ============================================================================
export async function setValidation(user, path, status, notes, validator) {
  const rec = {
    id: validationId(user.id, path.id),
    userId: user.id, userName: user.name,
    pathId: path.id, pathTitle: path.title,
    status, // PENDING | COMPETENT | NEEDS_IMPROVEMENT
    notes: (notes || '').trim(),
    validatorId: validator?.id || null,
    validatorName: validator?.name || '-',
    validatedAt: new Date().toISOString(),
  };
  await saveValidation(rec);
  return rec;
}
