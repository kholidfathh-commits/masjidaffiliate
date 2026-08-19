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

// --- Pembacaan HEMAT EGRESS: hanya milik satu peserta ---
// Karena key progres/enrollment berbentuk '<prefix><userId>:<...>', peserta cukup
// menarik barisnya sendiri. Ini satu-satunya cara memfilter tanpa melanggar aturan
// "wajib LIKE" di CLAUDE.md, dan menghemat egress sangat besar.
export async function loadMyEnrollments(userId) { return await st().listByPrefix(LMS_ENROLL_PREFIX + userId + ':'); }
export async function loadMyProgress(userId) { return await st().listByPrefix(LMS_PROGRESS_PREFIX + userId + ':'); }
export async function loadMyAttempts(userId) { return await st().listByPrefix(LMS_ATTEMPT_PREFIX + userId + ':'); }
export async function loadMySubmissions(userId) { return await st().listByPrefix(LMS_SUBMISSION_PREFIX + userId + ':'); }
export async function loadMyValidations(userId) { return await st().listByPrefix(LMS_VALIDATION_PREFIX + userId + ':'); }

// --- Isi materi dimuat ON-DEMAND + cache per sesi (meniru brankas gambar app) ---
const _bodyCache = new Map();
const _bodyPending = new Map();
/**
 * PENTING: fungsi ini MELEMPAR error saat pembacaan gagal (tidak mengembalikan '').
 * Kalau kegagalan koneksi ditelan jadi string kosong, dua hal buruk terjadi:
 *  - peserta melihat "materi kosong" padahal materinya ada (pesan menyesatkan);
 *  - editor kursus memuat kosong lalu MENIMPA materi asli dengan kosong saat disimpan.
 * @param {boolean} force - abaikan cache (dipakai tombol "Muat Ulang Materi")
 */
export async function loadLessonBody(lessonId, force = false) {
  if (!lessonId) return '';
  if (force) { _bodyCache.delete(lessonId); _bodyPending.delete(lessonId); }
  if (_bodyCache.has(lessonId)) return _bodyCache.get(lessonId);
  if (_bodyPending.has(lessonId)) return _bodyPending.get(lessonId);
  const p = st().get(LMS_BODY_PREFIX + lessonId)
    .then(v => {
      const s = (v && typeof v === 'object') ? (v.body || '') : (typeof v === 'string' ? v : '');
      _bodyCache.set(lessonId, s);
      _bodyPending.delete(lessonId);
      return s;
    })
    .catch(err => { _bodyPending.delete(lessonId); throw err; });
  _bodyPending.set(lessonId, p);
  return p;
}
export async function saveLessonBody(lessonId, body) {
  const ok = await st().set(LMS_BODY_PREFIX + lessonId, { id: lessonId, body: body || '' });
  if (!ok) throw new Error('Gagal menyimpan isi materi ke server.');
  _bodyCache.set(lessonId, body || '');
  return true;
}

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

export async function lmsLog(text, userName) {
  try { await _dep.log(text, userName); } catch { /* log gagal tidak boleh menggagalkan aksi */ }
}
export const lmsPutImage = (b64) => _dep.putImage(b64);
export const lmsFetchImage = (ref) => _dep.fetchImage(ref);

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
//   text/video/document → ada record progress
//   quiz               → ada attempt yang LULUS
//   assignment         → submission berstatus APPROVED
// Tidak ada nilai progress yang disimpan ganda: semuanya dihitung dari
// sumber kebenaran (progress / attempts / submissions).
// ============================================================================
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
  const entries = [...(path?.courses || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const required = entries.filter(e => e.required !== false);
  let doneCourses = 0, sumDone = 0, sumTotal = 0;
  for (const e of entries) {
    const c = coursesById.get(e.courseId);
    if (!c) continue;
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
  };
}

/** Susun konteks progress dari array mentah (dipakai semua halaman). */
export function buildCtx({ progress = [], attempts = [], submissions = [] }, userId = null) {
  const pr = userId ? progress.filter(p => p.userId === userId) : progress;
  const at = userId ? attempts.filter(a => a.userId === userId) : attempts;
  const sb = userId ? submissions.filter(s => s.userId === userId) : submissions;
  const progressSet = new Set(pr.map(p => p.lessonId));
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

/** Baca ulang satu record submission dari server (untuk menghindari lost update). */
export async function getSubmission(id) {
  try { return await st().get(LMS_SUBMISSION_PREFIX + id); }
  catch { return null; } // gagal baca → pemanggil pakai salinan yang ada
}

// CATATAN LOST UPDATE: kv_store tidak punya transaksi maupun compare-and-set.
// Peserta dan leader menulis ke record submission yang SAMA. Kalau kita menulis
// dari salinan yang sudah lama dipegang di layar, entri pihak lain hilang walau
// kodenya "append". Karena itu kedua fungsi di bawah SELALU membaca ulang record
// terbaru lebih dulu, lalu menambahkan entri di atasnya. Jendela balapannya
// menyempit dari "selama modal terbuka" menjadi beberapa milidetik.
export async function submitAssignment(current, { text, link, images }, user) {
  const fresh = (await getSubmission(current.id)) || current;
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
  const fresh = (await getSubmission(current.id)) || current;
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
