// ============================================================================
// LMS V1 — HALAMAN "KELOLA PEMBELAJARAN" (Owner / Manajer)
// ----------------------------------------------------------------------------
// Empat tab: Ringkasan · Kursus · Jalur Belajar · Peserta.
//
// CATATAN EGRESS (proyek pernah kena batas kuota Supabase):
//  - Semua data dimuat SEKALI saat halaman dibuka, lalu hanya lewat tombol
//    "Muat Ulang Data". TIDAK ADA polling di halaman ini karena isinya
//    kurikulum + rekap seluruh karyawan (record paling gemuk di LMS).
//  - Isi materi (lesson body) dimuat on-demand hanya saat materi dibuka
//    untuk diedit, bukan ikut record kursus.
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen, Route, Users, BarChart3, Plus, Edit2, Trash2, ArrowUp, ArrowDown,
  Send, Archive, AlertCircle, CheckCircle2, Sparkles,
} from 'lucide-react';
import {
  isLmsAdmin, lmsUid, lmsLog,
  COURSE_STATUS, LESSON_TYPES, QUESTION_TYPES,
  loadLmsPaths, loadLmsCourses, loadLmsEnrollments, loadLmsProgress,
  loadLmsAttempts, loadLmsSubmissions,
  savePath, saveCourse, getCourse, getPath, deleteCourse, deletePath,
  loadLessonBody, saveLessonBody, sealQuestion,
  allLessons, courseTotalMinutes, computePathProgress,
  autoEnrollUser, manualEnroll,
} from './data.js';
import {
  LmsCard, LmsBadge, LmsStat, LmsProgressBar, LmsRing, LmsTabs, LmsEmpty,
  LmsNoAccess, LmsLoading, LmsSkeleton, LmsModal, LmsField, LmsActions,
  LmsError, LmsNote, LmsPrimaryBtn, LmsGhostBtn, inputCls, selectCls,
} from './ui.jsx';

// ---------------------------------------------------------------- Konstanta
const DIVISION_OPTIONS = [
  { id: 'manajemen', label: 'Manajemen' },
  { id: 'keuangan', label: 'Keuangan' },
  { id: 'mabit', label: 'Mabit Scholar' },
  { id: 'mcn', label: 'MCN' },
  { id: 'tap', label: 'TAP' },
  { id: 'event', label: 'MMC (Malam Mabit Cuan)' },
  { id: 'internal', label: 'Affiliator Internal' },
];
const divisionLabel = (id) => DIVISION_OPTIONS.find(d => d.id === id)?.label || (id || '-');

// Konteks progress kosong — dipakai saat peserta belum punya jejak belajar sama sekali.
const EMPTY_CTX = { progressSet: new Set(), attemptsByLesson: new Map(), submissionsByLesson: new Map() };

const deepCopy = (v) => JSON.parse(JSON.stringify(v));

/** Tukar posisi item lalu tulis ulang field `order` mengikuti indeks baru. */
function moveItem(list, index, dir) {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const tmp = next[index];
  next[index] = next[to];
  next[to] = tmp;
  return next.map((it, i) => ({ ...it, order: i }));
}
const renumber = (list) => list.map((it, i) => ({ ...it, order: i }));

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const daysSince = (iso) => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
};

// ============================================================================
// KOMPONEN UTAMA
// ============================================================================
export default function LearningAdminView(props) {
  // Gerbang akses ditaruh di pembungkus TANPA hook. Kalau gerbangnya diletakkan di
  // dalam komponen berisi hook (setelah useEffect load), pengguna non-admin tetap
  // menjalankan 6 pembacaan tabel penuh sebelum ditolak — boros kuota, dan itu
  // persis masalah yang pernah membuat project ini kena restrict Supabase.
  if (!isLmsAdmin(props.user)) return <LmsNoAccess text="Halaman ini hanya untuk Owner dan Manajer." />;
  return <LearningAdminBody {...props} />;
}

function LearningAdminBody({ user, allUsers, settings }) {
  const [tab, setTab] = useState('ringkasan');
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [paths, setPaths] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [progress, setProgress] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  const [courseModal, setCourseModal] = useState(null);   // { initial } | null
  const [pathModal, setPathModal] = useState(null);       // { initial } | null
  const [assignFor, setAssignFor] = useState(null);       // karyawan
  const [banner, setBanner] = useState('');               // pesan sukses ringkas
  const [actionErr, setActionErr] = useState('');

  const people = useMemo(() => Array.isArray(allUsers) ? allUsers : [], [allUsers]);
  const jobTitles = useMemo(() => {
    const list = settings?.jobTitles;
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }, [settings]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const [p, c, e, pr, at, sb] = await Promise.all([
        loadLmsPaths(), loadLmsCourses(), loadLmsEnrollments(),
        loadLmsProgress(), loadLmsAttempts(), loadLmsSubmissions(),
      ]);
      setPaths(Array.isArray(p) ? p : []);
      setCourses(Array.isArray(c) ? c : []);
      setEnrollments(Array.isArray(e) ? e : []);
      setProgress(Array.isArray(pr) ? pr : []);
      setAttempts(Array.isArray(at) ? at : []);
      setSubmissions(Array.isArray(sb) ? sb : []);
    } catch (err) {
      setLoadErr('Gagal memuat data pembelajaran: ' + (err?.message || err) + '. Coba muat ulang saat koneksi stabil.');
    } finally {
      // WAJIB di finally — kalau lupa, halaman nyangkut di "Memuat..." selamanya.
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Penyegaran BERTARGET. Menerbitkan kursus atau menyimpan jalur tidak mengubah
  // progress/attempt/submission, jadi menarik ulang semuanya cuma membakar kuota.
  const reloadCourses = useCallback(async () => {
    try { setCourses(await loadLmsCourses() || []); }
    catch (e) { setActionErr('Gagal menyegarkan daftar kursus: ' + (e?.message || e)); }
  }, []);
  const reloadPaths = useCallback(async () => {
    try { setPaths(await loadLmsPaths() || []); }
    catch (e) { setActionErr('Gagal menyegarkan daftar jalur belajar: ' + (e?.message || e)); }
  }, []);
  const reloadEnrollments = useCallback(async () => {
    try { setEnrollments(await loadLmsEnrollments() || []); }
    catch (e) { setActionErr('Gagal menyegarkan daftar peserta: ' + (e?.message || e)); }
  }, []);

  // --- Turunan data -----------------------------------------------------
  const coursesById = useMemo(() => new Map(courses.map(c => [c.id, c])), [courses]);
  // Peta TERPISAH untuk menghitung progres: kursus 'draft' dibuang supaya angka yang
  // dilihat manajemen SAMA dengan yang dilihat peserta (MyLearning juga membuang draft).
  const progressCoursesById = useMemo(
    () => new Map(courses.filter(c => c && c.status !== 'draft').map(c => [c.id, c])),
    [courses]
  );
  const pathsById = useMemo(() => new Map(paths.map(p => [p.id, p])), [paths]);

  // Konteks progress dibangun per peserta sekali jalan supaya tidak menyaring
  // ulang seluruh array untuk tiap baris tabel.
  const ctxByUser = useMemo(() => {
    const map = new Map();
    const ensure = (id) => {
      if (!map.has(id)) map.set(id, { progressSet: new Set(), attemptsByLesson: new Map(), submissionsByLesson: new Map() });
      return map.get(id);
    };
    progress.forEach(p => { if (p?.userId) ensure(p.userId).progressSet.add(p.lessonId); });
    attempts.forEach(a => {
      if (!a?.userId) return;
      const c = ensure(a.userId);
      if (!c.attemptsByLesson.has(a.lessonId)) c.attemptsByLesson.set(a.lessonId, []);
      c.attemptsByLesson.get(a.lessonId).push(a);
    });
    submissions.forEach(s => { if (s?.userId) ensure(s.userId).submissionsByLesson.set(s.lessonId, s); });
    return map;
  }, [progress, attempts, submissions]);

  const rows = useMemo(() => enrollments.map(e => {
    const path = pathsById.get(e.pathId) || null;
    const ctx = ctxByUser.get(e.userId) || EMPTY_CTX;
    const prog = path
      ? computePathProgress(path, progressCoursesById, ctx)
      : { percent: 0, lessonsDone: 0, lessonsTotal: 0, coursesDone: 0, coursesTotal: 0, completed: false };
    const person = people.find(u => u.id === e.userId) || null;
    return {
      enrollment: e,
      path,
      prog,
      person,
      userName: person?.name || e.userName || 'Peserta tidak dikenal',
      pathTitle: path?.title || e.pathTitle || 'Jalur sudah dihapus',
    };
  }), [enrollments, pathsById, coursesById, ctxByUser, people]);

  const summary = useMemo(() => {
    let notStarted = 0, inProgress = 0, completed = 0;
    rows.forEach(r => {
      if (r.prog.completed) completed++;
      else if (r.prog.lessonsDone > 0) inProgress++;
      else notStarted++;
    });
    const total = rows.length;
    return { total, notStarted, inProgress, completed, rate: total === 0 ? 0 : Math.round((completed / total) * 100) };
  }, [rows]);

  // "Perlu Perhatian": belum mulai sama sekali, atau tugas menunggu review > 3 hari.
  const attention = useMemo(() => {
    const out = [];
    rows.forEach(r => {
      if (!r.prog.completed && r.prog.lessonsDone === 0) {
        out.push({
          key: 'e:' + r.enrollment.id,
          name: r.userName,
          text: 'Belum mulai jalur "' + r.pathTitle + '"',
          days: daysSince(r.enrollment.assignedAt),
          tone: 'amber',
        });
      }
    });
    submissions.forEach(s => {
      if (s?.status !== 'SUBMITTED') return;
      const d = daysSince(s.updatedAt || s.createdAt);
      if (d <= 3) return;
      out.push({
        key: 's:' + s.id,
        name: s.userName || '-',
        text: 'Tugas "' + (s.lessonTitle || 'Tugas praktik') + '" menunggu review',
        days: d,
        tone: 'orange',
      });
    });
    return out.sort((a, b) => b.days - a.days);
  }, [rows, submissions]);

  // Kursus yang sudah punya jejak belajar TIDAK boleh dihapus permanen (arsip saja).
  const usedCourseIds = useMemo(() => {
    const s = new Set();
    progress.forEach(p => p?.courseId && s.add(p.courseId));
    attempts.forEach(a => a?.courseId && s.add(a.courseId));
    submissions.forEach(b => b?.courseId && s.add(b.courseId));
    paths.forEach(p => (p.courses || []).forEach(c => c?.courseId && s.add(c.courseId)));
    return s;
  }, [progress, attempts, submissions, paths]);

  const publishedCourses = useMemo(() => courses.filter(c => c.status === 'published'), [courses]);
  const publishedPaths = useMemo(() => paths.filter(p => p.status === 'published'), [paths]);

  const noJobTitleCount = useMemo(
    () => people.filter(u => u.role === 'operasional' && !(u.jobTitle || '').trim()).length,
    [people]
  );
  // Jabatan LAMA yang tidak ada lagi di daftar juga tidak akan pernah cocok, karena
  // pencocokan target memakai nama jabatan yang persis sama. Ini lebih berbahaya
  // daripada jabatan kosong: di layar kelihatan terisi, padahal tidak pernah terjangkau.
  const staleJobTitles = useMemo(() => {
    if (jobTitles.length === 0) return [];
    return people.filter(u =>
      u.role === 'operasional' && (u.jobTitle || '').trim() && !jobTitles.includes(u.jobTitle.trim()));
  }, [people, jobTitles]);

  // --- Aksi kursus ------------------------------------------------------
  const flash = (msg) => { setBanner(msg); setActionErr(''); };

  const setCourseStatus = async (course, status, logText) => {
    try {
      await saveCourse({ ...course, status, updatedAt: new Date().toISOString() });
      await lmsLog(logText, user.name);
      flash('Perubahan tersimpan.');
      reloadCourses();
    } catch (err) {
      setActionErr('Gagal mengubah status kursus: ' + (err?.message || err) + '. Data lama tidak berubah.');
    }
  };

  const removeCourse = async (course) => {
    if (usedCourseIds.has(course.id) || course.status !== 'draft') return;
    if (!window.confirm('Hapus permanen kursus "' + course.title + '"? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const ok = await deleteCourse(course.id);
      if (ok === false) throw new Error('server menolak permintaan hapus');
      await lmsLog('menghapus kursus "' + course.title + '"', user.name);
      flash('Kursus dihapus.');
      reloadCourses();
    } catch (err) {
      setActionErr('Gagal menghapus kursus: ' + (err?.message || err) + '. Data lama tidak berubah.');
    }
  };

  const setPathStatus = async (path, status, logText) => {
    try {
      await savePath({ ...path, status, updatedAt: new Date().toISOString() });
      await lmsLog(logText, user.name);
      flash('Perubahan tersimpan.');
      reloadPaths();
    } catch (err) {
      setActionErr('Gagal mengubah status jalur belajar: ' + (err?.message || err) + '. Data lama tidak berubah.');
    }
  };

  const removePath = async (path) => {
    const used = enrollments.some(e => e.pathId === path.id);
    if (used || path.status !== 'draft') return;
    if (!window.confirm('Hapus permanen jalur "' + path.title + '"? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const ok = await deletePath(path.id);
      if (ok === false) throw new Error('server menolak permintaan hapus');
      await lmsLog('menghapus jalur belajar "' + path.title + '"', user.name);
      flash('Jalur belajar dihapus.');
      reloadPaths();
    } catch (err) {
      setActionErr('Gagal menghapus jalur belajar: ' + (err?.message || err) + '. Data lama tidak berubah.');
    }
  };

  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan', icon: BarChart3 },
    { id: 'kursus', label: 'Kursus', icon: BookOpen, count: courses.length },
    { id: 'jalur', label: 'Jalur Belajar', icon: Route, count: paths.length },
    { id: 'peserta', label: 'Peserta', icon: Users, count: people.length },
  ];

  return (
    <div className="max-w-7xl">
      {/* Header halaman (meniru PageHeader app induk, tanpa import dari App.jsx) */}
      <div className="flex items-end justify-between mb-6 gap-3 flex-wrap pb-4 border-b border-slate-200/60">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">Kelola Pembelajaran</h1>
          <p className="text-sm text-slate-500 mt-1.5">Susun kursus, atur jalur belajar, dan pantau siapa yang belum selesai onboarding.</p>
        </div>
        <LmsGhostBtn onClick={load} disabled={loading}>
          {loading ? 'Memuat...' : 'Muat Ulang Data'}
        </LmsGhostBtn>
      </div>

      <LmsTabs tabs={tabs} active={tab} onChange={setTab} />

      {banner && (
        <div className="mb-4 flex items-start gap-2 bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[12px] rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{banner}</span>
          <button onClick={() => setBanner('')} className="font-bold text-emerald-700 px-1">Tutup</button>
        </div>
      )}
      {actionErr && <div className="mb-4"><LmsError>{actionErr}</LmsError></div>}
      {loadErr && (
        <div className="mb-4 space-y-2">
          <LmsError>{loadErr}</LmsError>
          <LmsGhostBtn onClick={load}>Coba Muat Ulang</LmsGhostBtn>
        </div>
      )}

      {loading ? (
        <>
          <LmsLoading text="Memuat data pembelajaran..." />
          <LmsSkeleton rows={3} />
        </>
      ) : (
        <>
          {tab === 'ringkasan' && <RingkasanTab summary={summary} attention={attention} courses={courses} paths={paths} />}

          {tab === 'kursus' && (
            <KursusTab
              courses={courses}
              usedCourseIds={usedCourseIds}
              onNew={() => setCourseModal({ initial: null })}
              onEdit={(c) => setCourseModal({ initial: c })}
              onToggleStatus={(c) => c.status === 'published'
                ? setCourseStatus(c, 'draft', 'menjadikan kursus "' + c.title + '" draft')
                : setCourseStatus(c, 'published', 'menerbitkan kursus "' + c.title + '"')}
              onArchive={(c) => setCourseStatus(c, 'archived', 'mengarsipkan kursus "' + c.title + '"')}
              onDelete={removeCourse}
            />
          )}

          {tab === 'jalur' && (
            <JalurTab
              paths={paths}
              coursesById={coursesById}
              enrollments={enrollments}
              onNew={() => setPathModal({ initial: null })}
              onEdit={(p) => setPathModal({ initial: p })}
              onToggleStatus={(p) => p.status === 'published'
                ? setPathStatus(p, 'draft', 'menjadikan jalur belajar "' + p.title + '" draft')
                : setPathStatus(p, 'published', 'menerbitkan jalur belajar "' + p.title + '"')}
              onArchive={(p) => setPathStatus(p, 'archived', 'mengarsipkan jalur belajar "' + p.title + '"')}
              onDelete={removePath}
            />
          )}

          {tab === 'peserta' && (
            <PesertaTab
              user={user}
              people={people}
              rows={rows}
              enrollments={enrollments}
              publishedPaths={publishedPaths}
              noJobTitleCount={noJobTitleCount} staleJobTitles={staleJobTitles}
              onAssign={(p) => setAssignFor(p)}
              onDone={(msg) => { flash(msg); reloadEnrollments(); }}
              onError={(msg) => setActionErr(msg)}
            />
          )}
        </>
      )}

      {courseModal && (
        <CourseBuilder
          initial={courseModal.initial}
          user={user}
          onClose={() => setCourseModal(null)}
          onSaved={(msg) => { setCourseModal(null); flash(msg); reloadCourses(); }}
        />
      )}

      {pathModal && (
        <PathBuilder
          initial={pathModal.initial}
          user={user}
          courses={publishedCourses}
          allCourses={courses}
          jobTitles={jobTitles}
          onClose={() => setPathModal(null)}
          onSaved={(msg) => { setPathModal(null); flash(msg); reloadPaths(); }}
        />
      )}

      {assignFor && (
        <AssignModal
          actor={user}
          person={assignFor}
          paths={publishedPaths}
          enrollments={enrollments}
          onClose={() => setAssignFor(null)}
          onSaved={(msg) => { setAssignFor(null); flash(msg); reloadEnrollments(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// TAB 1 — RINGKASAN
// ============================================================================
function RingkasanTab({ summary, attention, courses, paths }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%)' }}>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#BFDBFE' }}>
          <Sparkles className="w-4 h-4" /> Status Onboarding Tim
        </div>
        <div className="font-display font-bold text-2xl mt-1">{summary.rate}% peserta sudah menuntaskan jalurnya</div>
        <div className="text-sm mt-1" style={{ color: '#DBEAFE' }}>
          {summary.completed} dari {summary.total} pendaftaran selesai · {courses.length} kursus · {paths.length} jalur belajar
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <LmsStat label="Peserta Terdaftar" value={summary.total} icon={Users} tone="blue" sub="pendaftaran jalur belajar" />
        <LmsStat label="Belum Mulai" value={summary.notStarted} icon={AlertCircle} tone="slate" />
        <LmsStat label="Sedang Berjalan" value={summary.inProgress} icon={BookOpen} tone="amber" />
        <LmsStat label="Selesai" value={summary.completed} icon={CheckCircle2} tone="emerald" />
        <LmsStat label="Tingkat Penyelesaian" value={summary.rate + '%'} icon={BarChart3} tone="blue" />
      </div>

      <LmsCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-display font-bold text-slate-800">Perlu Perhatian</h3>
            <p className="text-xs text-slate-500 mt-0.5">Peserta yang belum mulai belajar, atau tugasnya menunggu review lebih dari 3 hari.</p>
          </div>
          <LmsRing percent={summary.rate} size={48} tone={summary.rate >= 80 ? 'emerald' : 'amber'} />
        </div>

        {attention.length === 0 ? (
          <LmsNote tone="emerald">Semua peserta sudah bergerak dan tidak ada tugas yang menggantung. Kerja bagus.</LmsNote>
        ) : (
          <div className="space-y-2">
            {attention.slice(0, 40).map(a => (
              <div key={a.key} className="flex items-start gap-3 border border-slate-200/70 rounded-xl p-3">
                <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${a.tone === 'orange' ? 'text-orange-500' : 'text-amber-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-800 truncate">{a.name}</div>
                  <div className="text-[12px] text-slate-500">{a.text}</div>
                </div>
                {a.days > 0 && <LmsBadge color="bg-amber-100 text-amber-800">{a.days} hari</LmsBadge>}
              </div>
            ))}
            {attention.length > 40 && (
              <div className="text-[11px] text-slate-500 pt-1">Dan {attention.length - 40} lainnya.</div>
            )}
          </div>
        )}
      </LmsCard>
    </div>
  );
}

// ============================================================================
// TAB 2 — KURSUS
// ============================================================================
function KursusTab({ courses, usedCourseIds, onNew, onEdit, onToggleStatus, onArchive, onDelete }) {
  const sorted = useMemo(
    () => [...courses].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))),
    [courses]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">Kursus berisi modul dan materi. Hanya kursus berstatus Terbit yang bisa dimasukkan ke jalur belajar.</p>
        <LmsPrimaryBtn icon={Plus} onClick={onNew}>Kursus Baru</LmsPrimaryBtn>
      </div>

      {sorted.length === 0 ? (
        <LmsEmpty
          icon={BookOpen}
          title="Belum ada kursus"
          text="Mulai dengan membuat satu kursus, isi modul dan materinya, lalu terbitkan."
          action={<div className="flex justify-center"><LmsPrimaryBtn icon={Plus} onClick={onNew}>Kursus Baru</LmsPrimaryBtn></div>}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map(c => {
            const lessons = allLessons(c);
            const used = usedCourseIds.has(c.id);
            const canDelete = c.status === 'draft' && !used;
            const st = COURSE_STATUS[c.status] || COURSE_STATUS.draft;
            return (
              <LmsCard key={c.id} className="p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-slate-900 truncate">{c.title || '(Tanpa judul)'}</h3>
                      <LmsBadge color={st.color}>{st.label}</LmsBadge>
                    </div>
                    {c.description && <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{c.description}</p>}
                    <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
                      <span>{(c.modules || []).length} modul</span>
                      <span>{lessons.length} materi</span>
                      <span>~{courseTotalMinutes(c) || num(c.estimatedMinutes)} menit</span>
                      <span>Nilai lulus {num(c.passingScore, 70)}</span>
                      {used && <span className="text-amber-700 font-semibold">Sudah dipakai peserta</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <LmsGhostBtn icon={Edit2} onClick={() => onEdit(c)}>Edit</LmsGhostBtn>
                  {c.status === 'published' ? (
                    <LmsGhostBtn icon={Edit2} onClick={() => onToggleStatus(c)}>Jadikan Draft</LmsGhostBtn>
                  ) : (
                    <LmsPrimaryBtn icon={Send} onClick={() => onToggleStatus(c)}>Terbitkan</LmsPrimaryBtn>
                  )}
                  {c.status !== 'archived' && (
                    <LmsGhostBtn icon={Archive} onClick={() => onArchive(c)}>Arsipkan</LmsGhostBtn>
                  )}
                  {canDelete && (
                    <button onClick={() => onDelete(c)}
                      className="px-3 py-2 rounded-lg font-semibold text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border border-red-200">
                      <Trash2 className="w-4 h-4" /> Hapus
                    </button>
                  )}
                </div>

                {!canDelete && c.status !== 'archived' && used && (
                  <div className="mt-3">
                    <LmsNote tone="slate">
                      Kursus ini sudah punya riwayat belajar atau dipakai jalur, jadi tidak bisa dihapus permanen. Gunakan Arsipkan supaya riwayat peserta tetap utuh.
                    </LmsNote>
                  </div>
                )}
              </LmsCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PEMBUAT KURSUS
// ============================================================================
function newCourse() {
  return {
    id: lmsUid(),
    title: '',
    description: '',
    status: 'draft',
    estimatedMinutes: 0,
    passingScore: 70,
    modules: [],
    createdAt: new Date().toISOString(),
  };
}
function newModule(order) {
  return { id: lmsUid(), title: '', description: '', order, lessons: [] };
}
function newLesson(order) {
  return { id: lmsUid(), title: '', type: 'text', order, estimatedMinutes: 5, required: true };
}

function CourseBuilder({ initial, user, onClose, onSaved }) {
  const [form, setForm] = useState(() => (initial ? deepCopy(initial) : newCourse()));
  // Isi materi ditulis ke record terpisah (hemat egress) → dikumpulkan dulu di sini,
  // baru disimpan bersamaan saat kursus disimpan.
  const [pendingBodies, setPendingBodies] = useState({});
  const [editor, setEditor] = useState(null); // { moduleId, lesson, body, isNew, loadingBody }
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const setModules = (fn) => setForm(f => ({ ...f, modules: fn(f.modules || []) }));

  const addModule = () => setModules(ms => renumber([...ms, newModule(ms.length)]));
  const patchModule = (id, patch) => setModules(ms => ms.map(m => (m.id === id ? { ...m, ...patch } : m)));
  const deleteModule = (m) => {
    if (!window.confirm('Hapus modul "' + (m.title || 'tanpa judul') + '" beserta semua materinya?')) return;
    setModules(ms => renumber(ms.filter(x => x.id !== m.id)));
  };
  const moveModule = (idx, dir) => setModules(ms => moveItem(ms, idx, dir));

  const moveLesson = (moduleId, idx, dir) =>
    setModules(ms => ms.map(m => (m.id === moduleId ? { ...m, lessons: moveItem(m.lessons || [], idx, dir) } : m)));

  const deleteLesson = (moduleId, lesson) => {
    if (!window.confirm('Hapus materi "' + (lesson.title || 'tanpa judul') + '"?')) return;
    setModules(ms => ms.map(m => (
      m.id === moduleId ? { ...m, lessons: renumber((m.lessons || []).filter(l => l.id !== lesson.id)) } : m
    )));
    // Buang juga isi materi yang mungkin sudah diantrekan, supaya tidak tertulis
    // sebagai baris yatim di kv_store untuk materi yang sudah dihapus.
    setPendingBodies(p => { const next = { ...p }; delete next[lesson.id]; return next; });
  };

  // Buka editor materi. Isi teks/catatan dimuat on-demand (1 record saja).
  const openLesson = async (moduleId, lesson, isNew) => {
    const draft = deepCopy(lesson);
    setEditor({ moduleId, lesson: draft, body: '', isNew, loadingBody: !isNew });
    if (isNew) return;
    try {
      const b = await loadLessonBody(lesson.id);
      setEditor(e => (e && e.lesson.id === lesson.id ? { ...e, body: b || '', loadingBody: false, bodyFailed: false } : e));
    } catch {
      // PENTING: pemuatan GAGAL != materi kosong. Kalau kita diamkan sebagai kosong,
      // admin menekan Simpan dan materi asli TERTIMPA kosong tanpa disadari.
      // Tandai bodyFailed → editor mengunci textarea & isi materi tidak ikut disimpan.
      setEditor(e => (e && e.lesson.id === lesson.id ? { ...e, body: '', loadingBody: false, bodyFailed: true } : e));
    }
  };

  const commitLesson = (lesson, body) => {
    setModules(ms => ms.map(m => {
      if (m.id !== editor.moduleId) return m;
      const list = m.lessons || [];
      const exists = list.some(l => l.id === lesson.id);
      const nextList = exists ? list.map(l => (l.id === lesson.id ? lesson : l)) : [...list, lesson];
      return { ...m, lessons: renumber(nextList) };
    }));
    // Kalau isi materi tadi GAGAL dimuat, JANGAN ikut disimpan — biarkan materi lama
    // di server apa adanya daripada menimpanya dengan kosong.
    if ((lesson.type === 'text' || lesson.type === 'video' || lesson.type === 'document') && !editor?.bodyFailed) {
      setPendingBodies(p => ({ ...p, [lesson.id]: body || '' }));
    }
    setEditor(null);
  };

  const handleSave = async () => {
    setErr('');
    if (!form.title.trim()) { setErr('Judul kursus wajib diisi.'); return; }
    setSaving(true);
    const rec = {
      ...form,
      title: form.title.trim(),
      description: (form.description || '').trim(),
      estimatedMinutes: num(form.estimatedMinutes),
      passingScore: Math.max(0, Math.min(100, num(form.passingScore, 70))),
      modules: renumber(form.modules || []).map(m => ({ ...m, lessons: renumber(m.lessons || []) })),
      updatedAt: new Date().toISOString(),
    };
    try {
      // Status TIDAK diambil dari form. Form ini bisa dibuka berjam-jam sebelum disimpan
      // (halaman admin sengaja tanpa polling), sementara status diubah lewat tombol
      // Terbitkan/Jadikan Draft yang terpisah. Kalau status ikut ditulis dari form lama,
      // kursus yang sudah terbit bisa diam-diam kembali jadi draft — dan kursus draft
      // hilang dari layar semua peserta. Jadi status server yang menang.
      if (initial?.id) {
        const server = await getCourse(initial.id);
        if (server?.status) rec.status = server.status;
      }
      await saveCourse(rec);
    } catch (e) {
      setSaving(false);
      setErr('Gagal menyimpan kursus: ' + (e?.message || e) + '. Data lama tidak berubah.');
      return;
    }
    // Isi materi disimpan setelah kursus tersimpan. Kegagalan di sini tidak
    // membatalkan kursus — jadi pesannya harus jujur menyebut bagian mana yang gagal.
    const failedBodies = [];
    for (const [lessonId, body] of Object.entries(pendingBodies)) {
      try { await saveLessonBody(lessonId, body); }
      catch { failedBodies.push(lessonId); }
    }
    try { await lmsLog((initial ? 'memperbarui' : 'membuat') + ' kursus "' + rec.title + '"', user.name); } catch { /* abaikan */ }
    setSaving(false);
    if (failedBodies.length) {
      setErr('Kursus tersimpan, tetapi isi ' + failedBodies.length + ' materi gagal disimpan. Buka kembali materi tersebut dan simpan ulang.');
      return;
    }
    onSaved(initial ? 'Kursus "' + rec.title + '" diperbarui.' : 'Kursus "' + rec.title + '" dibuat.');
  };

  const modules = form.modules || [];

  return (
    <LmsModal
      size="xl"
      onClose={onClose}
      title={editor ? (editor.isNew ? 'Materi Baru' : 'Edit Materi') : (initial ? 'Edit Kursus' : 'Kursus Baru')}
      subtitle={editor ? 'Isi detail materi, lalu tekan Simpan Materi untuk kembali ke daftar modul.' : 'Susun modul dan materi. Perubahan baru tersimpan setelah menekan Simpan Kursus.'}
    >
      {editor ? (
        <LessonEditor
          initialLesson={editor.lesson}
          initialBody={editor.body}
          loadingBody={editor.loadingBody}
          bodyFailed={!!editor.bodyFailed}
          onCancel={() => setEditor(null)}
          onSave={commitLesson}
        />
      ) : (
        <div className="space-y-4">
          {err && <LmsError>{err}</LmsError>}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <LmsField label="Judul Kursus">
                <input className={inputCls} value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Dasar Afiliasi Al-Kahfi" />
              </LmsField>
            </div>
            <div className="sm:col-span-2">
              <LmsField label="Deskripsi">
                <textarea className={inputCls} rows={2} value={form.description || ''}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Jelaskan singkat apa yang dipelajari di kursus ini" />
              </LmsField>
            </div>
            <LmsField label="Estimasi Menit" hint="Boleh dikosongkan (0) — sistem juga menghitung dari total materi.">
              <input type="number" min="0" className={inputCls} value={form.estimatedMinutes ?? 0}
                onChange={e => setForm({ ...form, estimatedMinutes: e.target.value })} />
            </LmsField>
            <LmsField label="Nilai Minimum Lulus" hint="Dipakai sebagai nilai bawaan untuk kuis di kursus ini.">
              <input type="number" min="0" max="100" className={inputCls} value={form.passingScore ?? 70}
                onChange={e => setForm({ ...form, passingScore: e.target.value })} />
            </LmsField>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="font-display font-bold text-slate-800">Modul ({modules.length})</h4>
              <LmsGhostBtn icon={Plus} onClick={addModule}>Tambah Modul</LmsGhostBtn>
            </div>

            {modules.length === 0 ? (
              <LmsNote tone="slate">Belum ada modul. Tambahkan minimal satu modul, lalu isi materinya.</LmsNote>
            ) : (
              <div className="space-y-3">
                {modules.map((m, mi) => (
                  <div key={m.id} className="border border-slate-200/70 rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-1 pt-1">
                        <button onClick={() => moveModule(mi, -1)} disabled={mi === 0}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveModule(mi, 1)} disabled={mi === modules.length - 1}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <input className={inputCls} value={m.title}
                          onChange={e => patchModule(m.id, { title: e.target.value })}
                          placeholder={'Judul modul ' + (mi + 1)} />
                        <input className={inputCls} value={m.description || ''}
                          onChange={e => patchModule(m.id, { description: e.target.value })}
                          placeholder="Deskripsi singkat modul (opsional)" />
                      </div>
                      <button onClick={() => deleteModule(m)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 border border-red-200 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 pl-0 sm:pl-10 space-y-2">
                      {(m.lessons || []).length === 0 && (
                        <div className="text-[12px] text-slate-500">Belum ada materi di modul ini.</div>
                      )}
                      {(m.lessons || []).map((l, li) => (
                        <div key={l.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                          <div className="flex flex-col gap-1">
                            <button onClick={() => moveLesson(m.id, li, -1)} disabled={li === 0}
                              className="p-1 rounded border border-slate-200 bg-white text-slate-500 disabled:opacity-30">
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => moveLesson(m.id, li, 1)} disabled={li === (m.lessons.length - 1)}
                              className="p-1 rounded border border-slate-200 bg-white text-slate-500 disabled:opacity-30">
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-800 truncate">{l.title || '(Tanpa judul)'}</div>
                            <div className="text-[11px] text-slate-500">
                              {LESSON_TYPES[l.type]?.label || l.type} · {num(l.estimatedMinutes)} menit · {l.required === false ? 'Opsional' : 'Wajib'}
                            </div>
                          </div>
                          <button onClick={() => openLesson(m.id, l, false)}
                            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteLesson(m.id, l)}
                            className="p-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <LmsGhostBtn icon={Plus} onClick={() => openLesson(m.id, newLesson((m.lessons || []).length), true)}>
                        Tambah Materi
                      </LmsGhostBtn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <LmsActions
            onCancel={onClose}
            onSave={handleSave}
            disabled={saving}
            saveLabel={saving ? 'Menyimpan...' : 'Simpan Kursus'}
          />
        </div>
      )}
    </LmsModal>
  );
}

// ---------------------------------------------------------------- Editor materi
function LessonEditor({ initialLesson, initialBody, loadingBody, bodyFailed, onCancel, onSave }) {
  const [lesson, setLesson] = useState(() => deepCopy(initialLesson));
  const [body, setBody] = useState(initialBody || '');
  const [err, setErr] = useState('');

  // Isi materi baru selesai dimuat setelah editor dibuka → sinkronkan sekali.
  useEffect(() => { setBody(initialBody || ''); }, [initialBody]);

  const setType = (type) => {
    const next = { ...lesson, type };
    if (type === 'quiz' && !next.quiz) next.quiz = { passingScore: 70, maxAttempts: 3, questions: [] };
    if (type === 'assignment' && !next.assignment) next.assignment = { instructions: '', needLink: false, needFile: false };
    setLesson(next);
  };

  const save = () => {
    if (!lesson.title.trim()) { setErr('Judul materi wajib diisi.'); return; }
    if (lesson.type === 'video' && !(lesson.videoUrl || '').trim()) { setErr('Link video wajib diisi.'); return; }
    if (lesson.type === 'document' && !(lesson.docUrl || '').trim()) { setErr('Link dokumen wajib diisi.'); return; }
    if (lesson.type === 'quiz' && (lesson.quiz?.questions || []).length === 0) { setErr('Kuis harus punya minimal satu soal.'); return; }
    if (lesson.type === 'assignment' && !(lesson.assignment?.instructions || '').trim()) { setErr('Instruksi tugas wajib diisi.'); return; }

    const clean = {
      id: lesson.id,
      title: lesson.title.trim(),
      type: lesson.type,
      order: lesson.order ?? 0,
      estimatedMinutes: num(lesson.estimatedMinutes, 5),
      required: lesson.required !== false,
    };
    if (lesson.type === 'video') clean.videoUrl = (lesson.videoUrl || '').trim();
    if (lesson.type === 'document') clean.docUrl = (lesson.docUrl || '').trim();
    if (lesson.type === 'quiz') {
      clean.quiz = {
        passingScore: Math.max(0, Math.min(100, num(lesson.quiz?.passingScore, 70))),
        maxAttempts: Math.max(0, num(lesson.quiz?.maxAttempts, 0)),
        questions: lesson.quiz?.questions || [],
      };
    }
    if (lesson.type === 'assignment') {
      clean.assignment = {
        instructions: (lesson.assignment?.instructions || '').trim(),
        needLink: !!lesson.assignment?.needLink,
        needFile: !!lesson.assignment?.needFile,
      };
    }
    onSave(clean, body);
  };

  return (
    <div className="space-y-4">
      {err && <LmsError>{err}</LmsError>}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <LmsField label="Judul Materi">
            <input className={inputCls} value={lesson.title}
              onChange={e => setLesson({ ...lesson, title: e.target.value })}
              placeholder="Contoh: Mengenal Alur Kerja Affiliate" />
          </LmsField>
        </div>
        <LmsField label="Tipe Materi">
          <select className={selectCls} value={lesson.type} onChange={e => setType(e.target.value)}>
            {Object.entries(LESSON_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </LmsField>
        <LmsField label="Estimasi Menit">
          <input type="number" min="0" className={inputCls} value={lesson.estimatedMinutes ?? 0}
            onChange={e => setLesson({ ...lesson, estimatedMinutes: e.target.value })} />
        </LmsField>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={lesson.required !== false}
              onChange={e => setLesson({ ...lesson, required: e.target.checked })} />
            Materi wajib (ikut menentukan progres dan penyelesaian kursus)
          </label>
        </div>
      </div>

      {loadingBody && <LmsNote tone="slate">Memuat isi materi...</LmsNote>}
      {bodyFailed && (
        <LmsNote tone="amber">
          Isi materi gagal dimuat dari server (koneksi bermasalah). Perubahan lain tetap bisa
          disimpan, tetapi <b>isi materi tidak akan ikut ditimpa</b> supaya materi lama tidak hilang.
          Tutup lalu buka lagi materi ini saat koneksi stabil kalau ingin mengubah isinya.
        </LmsNote>
      )}

      {lesson.type === 'text' && (
        <LmsField label="Isi Materi" hint="Isi disimpan terpisah dari kursus supaya kuota data tetap hemat.">
          <textarea className={inputCls} rows={10} value={body} onChange={e => setBody(e.target.value)}
            disabled={bodyFailed || loadingBody}
            placeholder={bodyFailed ? 'Isi materi tidak bisa diubah karena gagal dimuat.' : 'Tulis materi di sini...'} />
        </LmsField>
      )}

      {lesson.type === 'video' && (
        <div className="space-y-3">
          <LmsField label="Link Video" hint="Tempel link YouTube atau Google Drive.">
            <input className={inputCls} value={lesson.videoUrl || ''}
              onChange={e => setLesson({ ...lesson, videoUrl: e.target.value })}
              placeholder="https://..." />
          </LmsField>
          <LmsField label="Catatan Pendamping">
            <textarea className={inputCls} rows={5} value={body} onChange={e => setBody(e.target.value)} disabled={bodyFailed || loadingBody}
              placeholder="Poin penting yang perlu diperhatikan saat menonton (opsional)" />
          </LmsField>
        </div>
      )}

      {lesson.type === 'document' && (
        <div className="space-y-3">
          <LmsField label="Link Dokumen" hint="Google Docs, Sheets, PDF, atau tautan lain.">
            <input className={inputCls} value={lesson.docUrl || ''}
              onChange={e => setLesson({ ...lesson, docUrl: e.target.value })}
              placeholder="https://..." />
          </LmsField>
          <LmsField label="Catatan Pendamping">
            <textarea className={inputCls} rows={5} value={body} onChange={e => setBody(e.target.value)} disabled={bodyFailed || loadingBody}
              placeholder="Bagian mana yang harus dibaca lebih dulu (opsional)" />
          </LmsField>
        </div>
      )}

      {lesson.type === 'quiz' && (
        <QuizBuilder
          quiz={lesson.quiz || { passingScore: 70, maxAttempts: 3, questions: [] }}
          onChange={(q) => setLesson({ ...lesson, quiz: q })}
        />
      )}

      {lesson.type === 'assignment' && (
        <div className="space-y-3">
          <LmsField label="Instruksi Tugas">
            <textarea className={inputCls} rows={6} value={lesson.assignment?.instructions || ''}
              onChange={e => setLesson({ ...lesson, assignment: { ...(lesson.assignment || {}), instructions: e.target.value } })}
              placeholder="Jelaskan apa yang harus dikerjakan dan bagaimana dinilai" />
          </LmsField>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={!!lesson.assignment?.needLink}
              onChange={e => setLesson({ ...lesson, assignment: { ...(lesson.assignment || {}), needLink: e.target.checked } })} />
            Butuh link hasil kerja
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={!!lesson.assignment?.needFile}
              onChange={e => setLesson({ ...lesson, assignment: { ...(lesson.assignment || {}), needFile: e.target.checked } })} />
            Butuh lampiran gambar
          </label>
        </div>
      )}

      <LmsActions onCancel={onCancel} onSave={save} saveLabel="Simpan Materi" cancelLabel="Kembali" />
    </div>
  );
}

// ---------------------------------------------------------------- Pembuat soal
function emptyQuestion() {
  return {
    id: lmsUid(),
    text: '',
    type: 'single',
    options: [{ id: lmsUid(), text: '' }, { id: lmsUid(), text: '' }],
    explanation: '',
    points: 1,
    _plain: '',
  };
}

function QuizBuilder({ quiz, onChange }) {
  const [draft, setDraft] = useState(null);   // soal yang sedang ditulis/diedit
  const [isEdit, setIsEdit] = useState(false);
  const [qErr, setQErr] = useState('');
  const [busy, setBusy] = useState(false);

  const questions = quiz.questions || [];

  const startNew = () => { setQErr(''); setIsEdit(false); setDraft(emptyQuestion()); };
  const startEdit = (q) => {
    setQErr('');
    setIsEdit(true);
    // Kunci jawaban tersimpan sebagai hash → tidak bisa ditampilkan lagi.
    setDraft({
      id: q.id,
      text: q.text || '',
      type: q.type || 'single',
      options: (q.options || []).map(o => ({ ...o })),
      explanation: q.explanation || '',
      points: num(q.points, 1),
      _plain: q.type === 'multiple' ? [] : '',
    });
  };

  const removeQuestion = (q) => {
    if (!window.confirm('Hapus soal ini?')) return;
    onChange({ ...quiz, questions: questions.filter(x => x.id !== q.id) });
  };
  const moveQuestion = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= questions.length) return;
    const next = [...questions];
    const tmp = next[idx]; next[idx] = next[to]; next[to] = tmp;
    onChange({ ...quiz, questions: next });
  };

  const setDraftType = (type) => {
    setDraft(d => ({
      ...d,
      type,
      _plain: type === 'multiple' ? [] : '',
      options: type === 'truefalse' ? [] : (d.options?.length ? d.options : [{ id: lmsUid(), text: '' }, { id: lmsUid(), text: '' }]),
    }));
  };

  const toggleAnswer = (optId) => {
    setDraft(d => {
      if (d.type === 'multiple') {
        const cur = Array.isArray(d._plain) ? d._plain : [];
        return { ...d, _plain: cur.includes(optId) ? cur.filter(x => x !== optId) : [...cur, optId] };
      }
      return { ...d, _plain: optId };
    });
  };

  const saveQuestion = async () => {
    setQErr('');
    if (!draft.text.trim()) { setQErr('Teks soal wajib diisi.'); return; }
    if (draft.type !== 'truefalse') {
      const opts = (draft.options || []).filter(o => (o.text || '').trim());
      if (opts.length < 2) { setQErr('Soal pilihan ganda butuh minimal 2 opsi yang terisi.'); return; }
    }
    const plain = draft._plain;
    const hasAnswer = draft.type === 'multiple' ? (Array.isArray(plain) && plain.length > 0) : !!plain;
    if (!hasAnswer) { setQErr('Pilih jawaban benar terlebih dahulu.'); return; }
    // Jawaban benar harus menunjuk opsi yang MASIH ADA. Kalau admin menandai sebuah
    // opsi lalu menghapus/mengosongkan opsi itu, hash-nya akan menunjuk pilihan yang
    // tidak pernah muncul di layar peserta → soal itu mustahil dijawab benar.
    if (draft.type !== 'truefalse') {
      const validIds = new Set((draft.options || []).filter(o => (o.text || '').trim()).map(o => o.id));
      const dipilih = draft.type === 'multiple' ? plain : [plain];
      if (dipilih.some(id => !validIds.has(id))) {
        setQErr('Jawaban benar menunjuk opsi yang sudah dihapus atau masih kosong. Pilih ulang jawaban benarnya.');
        return;
      }
    }

    setBusy(true);
    try {
      const base = {
        id: draft.id,
        text: draft.text.trim(),
        type: draft.type,
        options: draft.type === 'truefalse'
          ? [{ id: 'benar', text: 'Benar' }, { id: 'salah', text: 'Salah' }]
          : (draft.options || []).filter(o => (o.text || '').trim()).map(o => ({ id: o.id, text: o.text.trim() })),
        explanation: (draft.explanation || '').trim(),
        points: Math.max(1, num(draft.points, 1)),
        // answerSalt sengaja TIDAK dibawa dari soal lama supaya hash selalu segar.
        _plainAnswer: plain,
      };
      const sealed = await sealQuestion(base);
      const next = questions.some(q => q.id === sealed.id)
        ? questions.map(q => (q.id === sealed.id ? sealed : q))
        : [...questions, sealed];
      onChange({ ...quiz, questions: next });
      setDraft(null);
    } catch (e) {
      setQErr('Gagal menyegel kunci jawaban: ' + (e?.message || e) + '. Soal belum tersimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <LmsField label="Nilai Minimum Lulus">
          <input type="number" min="0" max="100" className={inputCls} value={quiz.passingScore ?? 70}
            onChange={e => onChange({ ...quiz, passingScore: num(e.target.value, 0) })} />
        </LmsField>
        <LmsField label="Maksimal Percobaan" hint="Isi 0 untuk percobaan tak terbatas.">
          <input type="number" min="0" className={inputCls} value={quiz.maxAttempts ?? 0}
            onChange={e => onChange({ ...quiz, maxAttempts: num(e.target.value, 0) })} />
        </LmsField>
      </div>

      <LmsNote>
        Kunci jawaban disimpan dalam bentuk terenkripsi supaya tidak bisa diintip peserta lewat browser. Karena itu jawaban benar tidak bisa ditampilkan kembali setelah soal disimpan.
      </LmsNote>

      <div className="flex items-center justify-between gap-3">
        <h4 className="font-display font-bold text-slate-800">Soal ({questions.length})</h4>
        {!draft && <LmsGhostBtn icon={Plus} onClick={startNew}>Tambah Soal</LmsGhostBtn>}
      </div>

      {questions.length === 0 && !draft && <LmsNote tone="slate">Belum ada soal. Tambahkan minimal satu soal.</LmsNote>}

      <div className="space-y-2">
        {questions.map((q, qi) => (
          <div key={q.id} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
            <div className="flex flex-col gap-1">
              <button onClick={() => moveQuestion(qi, -1)} disabled={qi === 0}
                className="p-1 rounded border border-slate-200 bg-white text-slate-500 disabled:opacity-30">
                <ArrowUp className="w-3 h-3" />
              </button>
              <button onClick={() => moveQuestion(qi, 1)} disabled={qi === questions.length - 1}
                className="p-1 rounded border border-slate-200 bg-white text-slate-500 disabled:opacity-30">
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-800">{qi + 1}. {q.text}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {QUESTION_TYPES[q.type] || q.type} · {num(q.points, 1)} poin · kunci tersegel
              </div>
            </div>
            <button onClick={() => startEdit(q)}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => removeQuestion(q)}
              className="p-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {draft && (
        <div className="border border-blue-200 rounded-2xl p-3 space-y-3" style={{ backgroundColor: '#F4F7FE' }}>
          <div className="font-semibold text-sm text-slate-800">{isEdit ? 'Edit Soal' : 'Soal Baru'}</div>
          {qErr && <LmsError>{qErr}</LmsError>}
          {isEdit && (
            <LmsNote tone="amber">
              Kunci jawaban tersimpan terenkripsi. Pilih ulang jawaban benar bila soal ini diubah.
            </LmsNote>
          )}

          <LmsField label="Teks Soal">
            <textarea className={inputCls} rows={2} value={draft.text}
              onChange={e => setDraft({ ...draft, text: e.target.value })} placeholder="Tulis pertanyaan" />
          </LmsField>

          <div className="grid sm:grid-cols-2 gap-3">
            <LmsField label="Tipe Soal">
              <select className={selectCls} value={draft.type} onChange={e => setDraftType(e.target.value)}>
                {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </LmsField>
            <LmsField label="Poin">
              <input type="number" min="1" className={inputCls} value={draft.points}
                onChange={e => setDraft({ ...draft, points: e.target.value })} />
            </LmsField>
          </div>

          {draft.type === 'truefalse' ? (
            <LmsField label="Jawaban Benar">
              <div className="flex gap-2">
                {[{ v: 'benar', l: 'Benar' }, { v: 'salah', l: 'Salah' }].map(o => (
                  <button key={o.v} onClick={() => setDraft({ ...draft, _plain: o.v })}
                    className={`flex-1 py-2.5 rounded-lg font-semibold text-sm border transition ${
                      draft._plain === o.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300'
                    }`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </LmsField>
          ) : (
            <LmsField label="Opsi Jawaban" hint={draft.type === 'multiple' ? 'Centang semua jawaban yang benar.' : 'Pilih satu jawaban yang benar.'}>
              <div className="space-y-2">
                {(draft.options || []).map((o, oi) => {
                  const checked = draft.type === 'multiple'
                    ? (Array.isArray(draft._plain) && draft._plain.includes(o.id))
                    : draft._plain === o.id;
                  return (
                    <div key={o.id} className="flex items-center gap-2">
                      <input
                        type={draft.type === 'multiple' ? 'checkbox' : 'radio'}
                        className="w-4 h-4 flex-shrink-0"
                        checked={checked}
                        onChange={() => toggleAnswer(o.id)}
                      />
                      <input className={inputCls} value={o.text}
                        placeholder={'Opsi ' + (oi + 1)}
                        onChange={e => setDraft({
                          ...draft,
                          options: draft.options.map(x => (x.id === o.id ? { ...x, text: e.target.value } : x)),
                        })} />
                      <button
                        onClick={() => setDraft({
                          ...draft,
                          options: draft.options.filter(x => x.id !== o.id),
                          _plain: draft.type === 'multiple'
                            ? (Array.isArray(draft._plain) ? draft._plain.filter(x => x !== o.id) : [])
                            : (draft._plain === o.id ? '' : draft._plain),
                        })}
                        disabled={(draft.options || []).length <= 2}
                        className="p-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-30 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                <LmsGhostBtn icon={Plus}
                  onClick={() => setDraft({ ...draft, options: [...(draft.options || []), { id: lmsUid(), text: '' }] })}>
                  Tambah Opsi
                </LmsGhostBtn>
              </div>
            </LmsField>
          )}

          <LmsField label="Penjelasan" hint="Ditampilkan ke peserta setelah kuis dinilai (opsional).">
            <textarea className={inputCls} rows={2} value={draft.explanation}
              onChange={e => setDraft({ ...draft, explanation: e.target.value })} />
          </LmsField>

          <LmsActions
            onCancel={() => { setDraft(null); setQErr(''); }}
            onSave={saveQuestion}
            disabled={busy}
            saveLabel={busy ? 'Menyimpan...' : 'Simpan Soal'}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 3 — JALUR BELAJAR
// ============================================================================
function JalurTab({ paths, coursesById, enrollments, onNew, onEdit, onToggleStatus, onArchive, onDelete }) {
  const sorted = useMemo(
    () => [...paths].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))),
    [paths]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">Jalur belajar adalah rangkaian kursus yang diberikan ke karyawan sesuai divisi dan jabatan.</p>
        <LmsPrimaryBtn icon={Plus} onClick={onNew}>Jalur Baru</LmsPrimaryBtn>
      </div>

      {sorted.length === 0 ? (
        <LmsEmpty
          icon={Route}
          title="Belum ada jalur belajar"
          text="Buat jalur belajar untuk menentukan kursus apa yang harus diikuti tiap divisi atau jabatan."
          action={<div className="flex justify-center"><LmsPrimaryBtn icon={Plus} onClick={onNew}>Jalur Baru</LmsPrimaryBtn></div>}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map(p => {
            const st = COURSE_STATUS[p.status] || COURSE_STATUS.draft;
            const divs = p.targetDivisions || [];
            const jobs = p.targetJobTitles || [];
            const used = enrollments.some(e => e.pathId === p.id);
            const canDelete = p.status === 'draft' && !used;
            return (
              <LmsCard key={p.id} className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-bold text-slate-900 truncate">{p.title || '(Tanpa judul)'}</h3>
                  <LmsBadge color={st.color}>{st.label}</LmsBadge>
                </div>
                {p.description && <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{p.description}</p>}

                <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
                  <span>{(p.courses || []).length} kursus</span>
                  <span>~{num(p.estimatedDays)} hari</span>
                  {used && <span className="text-amber-700 font-semibold">Sudah ada peserta</span>}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {divs.length === 0 && jobs.length === 0 ? (
                    <LmsBadge color="bg-slate-100 text-slate-600">Tanpa target — penugasan manual</LmsBadge>
                  ) : (
                    <>
                      {divs.map(d => <LmsBadge key={'d' + d} color="bg-blue-100 text-blue-800">{divisionLabel(d)}</LmsBadge>)}
                      {jobs.map(j => <LmsBadge key={'j' + j} color="bg-violet-100 text-violet-800">{j}</LmsBadge>)}
                    </>
                  )}
                </div>

                {(p.courses || []).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {[...(p.courses || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c, i) => (
                      <div key={c.courseId} className="text-[12px] text-slate-600 flex items-center gap-2">
                        <span className="text-slate-400 font-semibold w-4">{i + 1}.</span>
                        <span className="truncate">{coursesById.get(c.courseId)?.title || 'Kursus sudah dihapus'}</span>
                        {c.required === false && <LmsBadge color="bg-slate-100 text-slate-600">Opsional</LmsBadge>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <LmsGhostBtn icon={Edit2} onClick={() => onEdit(p)}>Edit</LmsGhostBtn>
                  {p.status === 'published' ? (
                    <LmsGhostBtn icon={Edit2} onClick={() => onToggleStatus(p)}>Jadikan Draft</LmsGhostBtn>
                  ) : (
                    <LmsPrimaryBtn icon={Send} onClick={() => onToggleStatus(p)}>Terbitkan</LmsPrimaryBtn>
                  )}
                  {p.status !== 'archived' && (
                    <LmsGhostBtn icon={Archive} onClick={() => onArchive(p)}>Arsipkan</LmsGhostBtn>
                  )}
                  {canDelete && (
                    <button onClick={() => onDelete(p)}
                      className="px-3 py-2 rounded-lg font-semibold text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border border-red-200">
                      <Trash2 className="w-4 h-4" /> Hapus
                    </button>
                  )}
                </div>
              </LmsCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Pembuat jalur
function PathBuilder({ initial, user, courses, allCourses, jobTitles, onClose, onSaved }) {
  const [form, setForm] = useState(() => initial ? deepCopy(initial) : {
    id: lmsUid(),
    title: '',
    description: '',
    status: 'draft',
    estimatedDays: 14,
    courses: [],
    targetDivisions: [],
    targetJobTitles: [],
    createdAt: new Date().toISOString(),
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = form.courses || [];
  const selectedIds = useMemo(() => new Set(selected.map(c => c.courseId)), [selected]);

  // Kursus yang sudah terlanjur masuk jalur tapi kini tidak "published" tetap
  // ditampilkan supaya tidak hilang diam-diam saat jalur diedit.
  const pickable = useMemo(() => {
    const map = new Map(courses.map(c => [c.id, c]));
    selected.forEach(s => {
      if (!map.has(s.courseId)) {
        const found = (allCourses || []).find(c => c.id === s.courseId);
        if (found) map.set(found.id, found);
      }
    });
    return [...map.values()].sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  }, [courses, allCourses, selected]);

  const toggleCourse = (courseId) => {
    setForm(f => {
      const list = f.courses || [];
      const next = list.some(c => c.courseId === courseId)
        ? list.filter(c => c.courseId !== courseId)
        : [...list, { courseId, order: list.length, required: true }];
      return { ...f, courses: renumber(next) };
    });
  };
  const moveCourse = (idx, dir) => setForm(f => ({ ...f, courses: moveItem(f.courses || [], idx, dir) }));
  const toggleRequired = (courseId) => setForm(f => ({
    ...f,
    courses: (f.courses || []).map(c => (c.courseId === courseId ? { ...c, required: c.required === false } : c)),
  }));

  const toggleIn = (field, value) => setForm(f => {
    const list = f[field] || [];
    return { ...f, [field]: list.includes(value) ? list.filter(x => x !== value) : [...list, value] };
  });

  const handleSave = async () => {
    setErr('');
    if (!form.title.trim()) { setErr('Judul jalur belajar wajib diisi.'); return; }
    if ((form.courses || []).length === 0) { setErr('Pilih minimal satu kursus untuk jalur ini.'); return; }
    setSaving(true);
    const rec = {
      ...form,
      title: form.title.trim(),
      description: (form.description || '').trim(),
      estimatedDays: Math.max(0, num(form.estimatedDays, 0)),
      courses: renumber(form.courses || []),
      targetDivisions: form.targetDivisions || [],
      targetJobTitles: form.targetJobTitles || [],
      updatedAt: new Date().toISOString(),
    };
    try {
      // Status server yang menang, dengan alasan sama seperti pada kursus di atas.
      if (initial?.id) {
        const server = await getPath(initial.id);
        if (server?.status) rec.status = server.status;
      }
      await savePath(rec);
      await lmsLog((initial ? 'memperbarui' : 'membuat') + ' jalur belajar "' + rec.title + '"', user.name);
      setSaving(false);
      onSaved(initial ? 'Jalur "' + rec.title + '" diperbarui.' : 'Jalur "' + rec.title + '" dibuat.');
    } catch (e) {
      setSaving(false);
      setErr('Gagal menyimpan jalur belajar: ' + (e?.message || e) + '. Data lama tidak berubah.');
    }
  };

  const divs = form.targetDivisions || [];
  const jobs = form.targetJobTitles || [];

  return (
    <LmsModal
      size="lg"
      onClose={onClose}
      title={initial ? 'Edit Jalur Belajar' : 'Jalur Belajar Baru'}
      subtitle="Tentukan kursus, urutannya, dan siapa yang otomatis mendapatkannya."
    >
      <div className="space-y-4">
        {err && <LmsError>{err}</LmsError>}

        <LmsField label="Judul Jalur">
          <input className={inputCls} value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Contoh: Onboarding Affiliator Internal" />
        </LmsField>
        <LmsField label="Deskripsi">
          <textarea className={inputCls} rows={2} value={form.description || ''}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Tujuan jalur belajar ini" />
        </LmsField>
        <LmsField label="Perkiraan Hari" hint="Perkiraan berapa hari jalur ini selesai bila dijalani normal.">
          <input type="number" min="0" className={inputCls} value={form.estimatedDays ?? 0}
            onChange={e => setForm({ ...form, estimatedDays: e.target.value })} />
        </LmsField>

        <div className="border-t border-slate-100 pt-4">
          <h4 className="font-display font-bold text-slate-800 mb-2">Pilih Kursus</h4>
          {pickable.length === 0 ? (
            <LmsNote tone="amber">Belum ada kursus berstatus Terbit. Terbitkan dulu kursusnya di tab Kursus.</LmsNote>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto scroll-thin pr-1">
              {pickable.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer bg-slate-50 rounded-lg px-3 py-2">
                  <input type="checkbox" className="w-4 h-4 flex-shrink-0"
                    checked={selectedIds.has(c.id)} onChange={() => toggleCourse(c.id)} />
                  <span className="truncate flex-1">{c.title || '(Tanpa judul)'}</span>
                  {c.status !== 'published' && <LmsBadge color="bg-amber-100 text-amber-800">Belum terbit</LmsBadge>}
                </label>
              ))}
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div>
            <h4 className="font-display font-bold text-slate-800 mb-2">Urutan Kursus</h4>
            <div className="space-y-2">
              {selected.map((c, i) => {
                const course = pickable.find(x => x.id === c.courseId);
                return (
                  <div key={c.courseId} className="flex items-center gap-2 border border-slate-200/70 rounded-xl p-2">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveCourse(i, -1)} disabled={i === 0}
                        className="p-1 rounded border border-slate-200 bg-white text-slate-500 disabled:opacity-30">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveCourse(i, 1)} disabled={i === selected.length - 1}
                        className="p-1 rounded border border-slate-200 bg-white text-slate-500 disabled:opacity-30">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1 text-sm text-slate-800 truncate">
                      {i + 1}. {course?.title || 'Kursus tidak ditemukan'}
                    </div>
                    <label className="flex items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer flex-shrink-0">
                      <input type="checkbox" className="w-4 h-4" checked={c.required !== false}
                        onChange={() => toggleRequired(c.courseId)} />
                      Wajib
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h4 className="font-display font-bold text-slate-800">Diberikan Kepada</h4>

          <LmsNote tone="amber">
            Kalau Divisi dan Jabatan dua-duanya dikosongkan, jalur ini tidak akan diberikan otomatis dan harus ditugaskan manual dari tab Peserta.
            Kalau dua-duanya diisi, karyawan harus cocok di keduanya. Kalau hanya salah satu yang diisi, cukup cocok di bagian itu saja.
          </LmsNote>

          <LmsField label="Divisi">
            <div className="grid sm:grid-cols-2 gap-1.5">
              {DIVISION_OPTIONS.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer bg-slate-50 rounded-lg px-3 py-2">
                  <input type="checkbox" className="w-4 h-4" checked={divs.includes(d.id)}
                    onChange={() => toggleIn('targetDivisions', d.id)} />
                  <span className="truncate">{d.label}</span>
                </label>
              ))}
            </div>
          </LmsField>

          <LmsField label="Jabatan">
            {jobTitles.length === 0 ? (
              <LmsNote tone="slate">Daftar jabatan masih kosong. Tambahkan dulu di menu Pengaturan agar bisa dipakai sebagai target.</LmsNote>
            ) : (
              <div className="grid sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto scroll-thin pr-1">
                {jobTitles.map(j => (
                  <label key={j} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer bg-slate-50 rounded-lg px-3 py-2">
                    <input type="checkbox" className="w-4 h-4" checked={jobs.includes(j)}
                      onChange={() => toggleIn('targetJobTitles', j)} />
                    <span className="truncate">{j}</span>
                  </label>
                ))}
              </div>
            )}
          </LmsField>
        </div>

        <LmsActions onCancel={onClose} onSave={handleSave} disabled={saving}
          saveLabel={saving ? 'Menyimpan...' : 'Simpan Jalur'} />
      </div>
    </LmsModal>
  );
}

// ============================================================================
// TAB 4 — PESERTA
// ============================================================================
function PesertaTab({ user, people, rows, enrollments, publishedPaths, noJobTitleCount, staleJobTitles = [], onAssign, onDone, onError }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // { created, skipped, failed }
  const [q, setQ] = useState('');

  const byUser = useMemo(() => {
    const m = new Map();
    rows.forEach(r => {
      if (!m.has(r.enrollment.userId)) m.set(r.enrollment.userId, []);
      m.get(r.enrollment.userId).push(r);
    });
    return m;
  }, [rows]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return people
      .filter(p => !term || (p.name || '').toLowerCase().includes(term) || (p.jobTitle || '').toLowerCase().includes(term))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [people, q]);

  const runAutoEnroll = async () => {
    if (publishedPaths.length === 0) {
      onError('Belum ada jalur belajar berstatus Terbit, jadi tidak ada yang bisa ditugaskan otomatis.');
      return;
    }
    setRunning(true);
    setResult(null);
    let created = 0, skipped = 0, failed = 0;
    try {
      for (const p of people) {
        const res = await autoEnrollUser(p, publishedPaths, enrollments, user);
        created += res.created.length;
        skipped += res.skipped;
        failed += res.failed.length;
      }
      setResult({ created, skipped, failed });
      if (created > 0) await lmsLog('menjalankan auto-enroll jalur belajar (' + created + ' penugasan baru)', user.name);
      onDone('Auto-enroll selesai: ' + created + ' dibuat, ' + skipped + ' dilewati, ' + failed + ' gagal.');
    } catch (e) {
      onError('Auto-enroll berhenti di tengah jalan: ' + (e?.message || e) + '. Penugasan yang sudah dibuat tetap aman, jalankan ulang untuk melengkapi sisanya.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {noJobTitleCount > 0 && (
        <LmsNote tone="amber">
          {noJobTitleCount} karyawan belum punya jabatan sehingga tidak bisa dijangkau jalur belajar berbasis jabatan. Lengkapi di menu Anggota Tim.
        </LmsNote>
      )}

      {staleJobTitles.length > 0 && (
        <LmsNote tone="amber">
          {staleJobTitles.length} karyawan memakai jabatan yang sudah tidak ada di daftar Pengaturan
          ({staleJobTitles.map(u => `${u.name} — "${u.jobTitle}"`).join(', ')}).
          Penargetan jalur belajar mencocokkan nama jabatan yang <b>persis sama</b>, jadi mereka tidak akan
          terjangkau. Pilih ulang jabatannya di menu Anggota Tim, atau tambahkan jabatan itu di Pengaturan App.
        </LmsNote>
      )}

      <LmsCard className="p-4">
        <div className="flex items-start gap-3 flex-wrap justify-between">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-slate-800">Penugasan Otomatis</h3>
            <p className="text-[12px] text-slate-500 mt-0.5 max-w-xl">
              Menugaskan semua jalur berstatus Terbit ke karyawan yang cocok divisi/jabatannya. Aman diulang berapa kali pun: yang sudah pernah ditugaskan tidak akan dobel.
            </p>
          </div>
          <LmsPrimaryBtn icon={Sparkles} onClick={runAutoEnroll} disabled={running}>
            {running ? 'Memproses...' : 'Jalankan Auto-Enroll Sekarang'}
          </LmsPrimaryBtn>
        </div>
        {result && (
          <div className="mt-3">
            <LmsNote tone={result.failed > 0 ? 'amber' : 'emerald'}>
              Hasil: {result.created} penugasan baru dibuat · {result.skipped} dilewati karena sudah ada · {result.failed} gagal.
              {result.failed > 0 ? ' Jalankan ulang untuk mencoba lagi yang gagal.' : ''}
            </LmsNote>
          </div>
        )}
      </LmsCard>

      <div className="flex items-center gap-2 flex-wrap">
        <input className={inputCls + ' sm:max-w-xs'} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Cari nama atau jabatan..." />
      </div>

      {list.length === 0 ? (
        <LmsEmpty icon={Users} title="Tidak ada karyawan" text="Belum ada data karyawan yang cocok dengan pencarian." />
      ) : (
        <LmsCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold">Divisi</th>
                  <th className="px-4 py-3 font-semibold">Jabatan</th>
                  <th className="px-4 py-3 font-semibold">Jalur Belajar</th>
                  <th className="px-4 py-3 font-semibold">Progres</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => {
                  const mine = byUser.get(p.id) || [];
                  return (
                    <tr key={p.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{divisionLabel(p.division)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {(p.jobTitle || '').trim() || <span className="text-amber-700">Belum diisi</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 min-w-[180px]">
                        {mine.length === 0 ? <span className="text-slate-400">Belum ada</span> : (
                          <div className="space-y-1">
                            {mine.map(r => <div key={r.enrollment.id} className="truncate">{r.pathTitle}</div>)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        {mine.length === 0 ? <span className="text-slate-400">-</span> : (
                          <div className="space-y-2">
                            {mine.map(r => (
                              <div key={r.enrollment.id}>
                                <LmsProgressBar percent={r.prog.percent} tone={r.prog.completed ? 'emerald' : 'blue'} />
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {r.prog.percent}% · {r.prog.lessonsDone}/{r.prog.lessonsTotal} materi
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => onAssign(p)}
                          className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg font-semibold text-xs">
                          Tugaskan Jalur
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </LmsCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------- Modal tugaskan jalur
function AssignModal({ actor, person, paths, enrollments, onClose, onSaved }) {
  const [pathId, setPathId] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const already = useMemo(
    () => new Set(enrollments.filter(e => e.userId === person.id).map(e => e.pathId)),
    [enrollments, person.id]
  );
  const options = useMemo(() => paths.filter(p => !already.has(p.id)), [paths, already]);

  const submit = async () => {
    setErr('');
    const path = options.find(p => p.id === pathId);
    if (!path) { setErr('Pilih jalur belajar terlebih dahulu.'); return; }
    setSaving(true);
    try {
      const rec = await manualEnroll(person, path, enrollments, actor);
      if (!rec) {
        setSaving(false);
        setErr(person.name + ' sudah terdaftar di jalur ini.');
        return;
      }
      await lmsLog('menugaskan jalur belajar "' + path.title + '" ke ' + person.name, actor.name);
      setSaving(false);
      onSaved('Jalur "' + path.title + '" ditugaskan ke ' + person.name + '.');
    } catch (e) {
      setSaving(false);
      setErr('Gagal menugaskan jalur: ' + (e?.message || e) + '. Data lama tidak berubah.');
    }
  };

  return (
    <LmsModal title="Tugaskan Jalur Belajar" subtitle={person.name} onClose={onClose}>
      <div className="space-y-4">
        {err && <LmsError>{err}</LmsError>}
        {options.length === 0 ? (
          <LmsNote tone="slate">
            {already.size > 0
              ? person.name + ' sudah terdaftar di semua jalur belajar yang tersedia.'
              : 'Belum ada jalur belajar berstatus Terbit yang bisa ditugaskan.'}
          </LmsNote>
        ) : (
          <LmsField label="Pilih Jalur" hint="Penugasan manual tidak akan tertimpa oleh auto-enroll.">
            <select className={selectCls} value={pathId} onChange={e => setPathId(e.target.value)}>
              <option value="">-- Pilih jalur belajar --</option>
              {options.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </LmsField>
        )}
        <LmsActions
          onCancel={onClose}
          onSave={submit}
          disabled={saving || options.length === 0}
          saveLabel={saving ? 'Menyimpan...' : 'Tugaskan'}
        />
      </div>
    </LmsModal>
  );
}
