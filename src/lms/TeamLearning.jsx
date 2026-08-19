// ============================================================================
// LMS V1 — PEMBELAJARAN TIM (halaman Leader & Manajemen)
// ----------------------------------------------------------------------------
// Modul ini TIDAK meng-import App.jsx (circular import = layar putih). Semua
// dependensi diambil dari './data.js' dan './ui.jsx'.
//
// HEMAT EGRESS (proyek pernah kena batas kuota Supabase):
//  - Kurikulum (jalur belajar + kursus) dan progres dimuat SEKALI saat mount,
//    plus tombol "Muat Ulang" manual.
//  - Hanya daftar submission (yang menunggu review) yang di-poll tiap 30 detik,
//    dan hanya saat tab browser sedang terlihat.
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, ClipboardCheck, Award, Search, CheckCircle2, RotateCcw,
  MessageSquare, ExternalLink, AlertCircle,
} from 'lucide-react';
import {
  loadLmsPaths, loadLmsCourses, loadLmsEnrollments, loadLmsProgress,
  loadLmsAttempts, loadLmsSubmissions, loadLmsValidations, loadMyAttempts,
  isLmsAdmin, isLmsReviewer, learnersVisibleTo, canReviewLearner,
  buildCtx, computeCourseProgress, computePathProgress, allLessons,
  reviewAssignment, setValidation, resetQuizAttempts,
  ENROLL_STATUS, SUBMISSION_STATUS, VALIDATION_STATUS,
  lmsLog, lmsFetchImage,
} from './data.js';
import {
  LmsCard, LmsBadge, LmsStat, LmsProgressBar, LmsTabs, LmsEmpty, LmsNoAccess,
  LmsSkeleton, LmsModal, LmsField, LmsError, LmsNote, LmsPrimaryBtn, LmsGhostBtn,
  LmsImage, inputCls, selectCls,
} from './ui.jsx';

// Label divisi disalin (bukan di-import) supaya file ini bebas dari App.jsx.
const DIV_LABELS = {
  manajemen: 'Manajemen',
  keuangan: 'Keuangan',
  mabit: 'Mabit Scholar',
  mcn: 'MCN',
  tap: 'TAP',
  event: 'MMC (Malam Mabit Cuan)',
  internal: 'Affiliator Internal',
};
const divLabel = (k) => DIV_LABELS[k] || (k ? 'Divisi Lama' : '-');

function fmtWaktu(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '-'; }
}

/** Kursus pertama di jalur belajar yang belum selesai — dipakai kolom "Kursus Berjalan". */
function currentCourseTitle(path, coursesById, ctx) {
  const entries = [...(path?.courses || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const e of entries) {
    const c = coursesById.get(e.courseId);
    if (!c) continue;
    if (!computeCourseProgress(c, ctx).completed) return c.title;
  }
  return null;
}

// ============================================================================
// GERBANG AKSES — dipisah dari komponen berisi hook supaya jumlah hook tidak
// pernah berubah antar render (aturan hook React).
// ============================================================================
export default function TeamLearningView({ user, allUsers }) {
  if (!isLmsReviewer(user)) return <LmsNoAccess text="Halaman ini untuk Leader dan Manajemen." />;
  return <TeamLearningBody user={user} allUsers={allUsers} />;
}

function TeamLearningBody({ user, allUsers }) {
  const [tab, setTab] = useState('progress');
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  const [paths, setPaths] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [progress, setProgress] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [validations, setValidations] = useState([]);

  // Filter tab 1
  const [fStatus, setFStatus] = useState('all');
  const [fDiv, setFDiv] = useState('all');
  const [fSearch, setFSearch] = useState('');

  // Modal review tugas
  const [reviewing, setReviewing] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewErr, setReviewErr] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  // Modal reset kesempatan kuis
  const [resetFor, setResetFor] = useState(null);
  const [resetErr, setResetErr] = useState('');
  const [resetBusy, setResetBusy] = useState('');

  // Modal validasi kompetensi
  const [valModal, setValModal] = useState(null); // { learner, path, status }
  const [valNote, setValNote] = useState('');
  const [valErr, setValErr] = useState('');
  const [valBusy, setValBusy] = useState(false);

  const admin = isLmsAdmin(user);

  // ---- Lingkup peserta: leader HANYA melihat anggotanya sendiri -------------
  const learners = useMemo(() => learnersVisibleTo(user, allUsers || []) || [], [user, allUsers]);
  // usersById = pagar lingkup. Semua daftar yang ditampilkan (baris progres, antrean
  // review) menyaring lewat map ini, jadi leader tidak pernah melihat peserta di luar
  // timnya walaupun data mentah yang dimuat berisi seluruh organisasi.
  const usersById = useMemo(() => new Map(learners.map(u => [u.id, u])), [learners]);

  // ---- Pemuatan penuh (1x saat mount + tombol manual) ----------------------
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const [p, c, e, pr, at, sb, vl] = await Promise.all([
        loadLmsPaths(), loadLmsCourses(), loadLmsEnrollments(), loadLmsProgress(),
        loadLmsAttempts(), loadLmsSubmissions(), loadLmsValidations(),
      ]);
      // Simpan MENTAH lalu saring di useMemo (lihat bawah). Kalau disaring di sini,
      // data bisa hilang permanen saat `allUsers` belum sempat termuat waktu mount.
      setPaths(p || []);
      setCourses(c || []);
      setEnrollments(e || []);
      setProgress(pr || []);
      setAttempts(at || []);
      setSubmissions(sb || []);
      setValidations(vl || []);
    } catch (err) {
      setLoadErr('Gagal memuat data pembelajaran tim: ' + (err?.message || err));
    } finally {
      // WAJIB: tanpa ini halaman bisa nyangkut di "Memuat..." selamanya.
      setLoading(false);
    }
  }, []);

  const reloadSubmissions = useCallback(async () => {
    try {
      const rows = await loadLmsSubmissions();
      setSubmissions(rows || []);
    } catch {
      // Gagal muat ulang diam-diam: data lama tetap ditampilkan, tidak dihapus.
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Polling HANYA saat tab "Perlu Direview" sedang dibuka (hemat egress).
  // Kalau dibiarkan jalan di tab lain, leader yang membiarkan halaman terbuka
  // seharian akan menarik seluruh record submission tiap 30 detik tanpa guna.
  useEffect(() => {
    if (tab !== 'review') return;
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') reloadSubmissions();
    }, 30000);
    return () => clearInterval(iv);
  }, [tab, reloadSubmissions]);

  // Jaga modal review tetap memakai data terbaru setelah polling.
  useEffect(() => {
    if (!reviewing) return;
    const fresh = submissions.find(s => s.id === reviewing.id);
    if (fresh && fresh.updatedAt !== reviewing.updatedAt) setReviewing(fresh);
  }, [submissions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Indeks bantu --------------------------------------------------------
  const pathsById = useMemo(() => new Map((paths || []).map(p => [p.id, p])), [paths]);
  // Kursus 'draft' dibuang dari perhitungan progres supaya angka yang dilihat leader
  // SAMA dengan yang dilihat peserta (MyLearning juga membuang draft). Kalau tidak,
  // peserta yang sudah menuntaskan semua materi terlihat "belum selesai" di layar leader.
  const coursesById = useMemo(
    () => new Map((courses || []).filter(c => c && c.status !== 'draft').map(c => [c.id, c])),
    [courses]
  );

  /** lessonId → { lesson, course }. Dipakai untuk instruksi tugas & judul kuis. */
  const lessonIndex = useMemo(() => {
    const m = new Map();
    (courses || []).forEach(c => allLessons(c).forEach(l => m.set(l.id, { lesson: l, course: c })));
    return m;
  }, [courses]);

  const ctxByUser = useMemo(() => {
    const m = new Map();
    learners.forEach(l => m.set(l.id, buildCtx({ progress, attempts, submissions }, l.id)));
    return m;
  }, [learners, progress, attempts, submissions]);

  const validationsById = useMemo(
    () => new Map((validations || []).map(v => [v.id, v])),
    [validations]
  );

  // ---- Baris progres tim ---------------------------------------------------
  const rows = useMemo(() => {
    const out = [];
    for (const e of enrollments) {
      const learner = usersById.get(e.userId);
      if (!learner) continue;
      const path = pathsById.get(e.pathId) || null;
      const ctx = ctxByUser.get(e.userId) || buildCtx({});
      const pp = path
        ? computePathProgress(path, coursesById, ctx)
        : { percent: 0, lessonsDone: 0, lessonsTotal: 0, coursesDone: 0, coursesTotal: 0, completed: false };
      // Status dihitung dari progres nyata, bukan dari kolom status yang bisa basi.
      const status = pp.completed ? 'COMPLETED' : (pp.lessonsDone > 0 ? 'IN_PROGRESS' : 'NOT_STARTED');
      out.push({
        key: e.id,
        learner,
        enrollment: e,
        path,
        pp,
        status,
        current: path ? currentCourseTitle(path, coursesById, ctx) : null,
      });
    }
    out.sort((a, b) =>
      (a.learner.name || '').localeCompare(b.learner.name || '') ||
      (a.path?.title || '').localeCompare(b.path?.title || '')
    );
    return out;
  }, [enrollments, usersById, pathsById, coursesById, ctxByUser]);

  const filteredRows = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return rows.filter(r => {
      if (fStatus !== 'all' && r.status !== fStatus) return false;
      if (admin && fDiv !== 'all' && r.learner.division !== fDiv) return false;
      if (q && !(r.learner.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, fStatus, fDiv, fSearch, admin]);

  // ---- Antrean review ------------------------------------------------------
  const pending = useMemo(() => {
    return (submissions || [])
      .filter(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW')
      .filter(s => usersById.has(s.userId))
      .sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));
  }, [submissions, usersById]);

  // ---- Kandidat validasi (jalur belajar 100%) ------------------------------
  const validationRows = useMemo(
    () => rows.filter(r => r.path && r.pp.completed),
    [rows]
  );

  // ---- Ringkasan angka -----------------------------------------------------
  const stats = useMemo(() => {
    const learnerSet = new Set(rows.map(r => r.learner.id));
    return {
      peserta: learnerSet.size,
      jalan: rows.filter(r => r.status === 'IN_PROGRESS').length,
      selesai: rows.filter(r => r.status === 'COMPLETED').length,
      review: pending.length,
    };
  }, [rows, pending]);

  // ==========================================================================
  // AKSI
  // ==========================================================================
  const openReview = (sub) => {
    setReviewing(sub);
    setReviewNote('');
    setReviewErr('');
  };

  const submitReview = async (decision) => {
    if (!reviewing || reviewBusy) return;
    const learner = usersById.get(reviewing.userId);
    // Periksa ULANG wewenang: daftar di layar bisa basi setelah polling / ganti peran.
    if (!learner || !canReviewLearner(user, learner)) {
      setReviewErr('Anda tidak berwenang mereview tugas peserta ini.');
      return;
    }
    if (decision === 'REVISION_REQUIRED' && !reviewNote.trim()) {
      setReviewErr('Catatan wajib diisi saat meminta revisi, supaya peserta tahu apa yang harus diperbaiki.');
      return;
    }
    setReviewErr('');
    setReviewBusy(true);
    try {
      await reviewAssignment(reviewing, decision, reviewNote, user);
      await lmsLog(
        `${decision === 'APPROVED' ? 'menyetujui' : 'meminta revisi'} tugas "${reviewing.lessonTitle || '-'}" milik ${reviewing.userName || '-'}`,
        user.name
      );
      setReviewing(null);
      setReviewNote('');
      await reloadSubmissions();
    } catch (err) {
      setReviewErr('Gagal menyimpan hasil review: ' + (err?.message || err) + ' Data lama tidak berubah, silakan coba lagi.');
    } finally {
      setReviewBusy(false);
    }
  };

  const openReset = (learner) => {
    setResetFor(learner);
    setResetErr('');
  };

  /** Daftar kuis yang pernah dicoba peserta terpilih, beserta jumlah percobaan. */
  const resetList = useMemo(() => {
    if (!resetFor) return [];
    const m = new Map();
    (attempts || []).filter(a => a.userId === resetFor.id).forEach(a => {
      const cur = m.get(a.lessonId) || { lessonId: a.lessonId, count: 0, best: 0, lulus: false };
      cur.count += 1;
      cur.best = Math.max(cur.best, Number(a.percent) || 0);
      cur.lulus = cur.lulus || !!a.passed;
      m.set(a.lessonId, cur);
    });
    return [...m.values()].map(r => ({
      ...r,
      title: lessonIndex.get(r.lessonId)?.lesson?.title || 'Kuis (materi sudah dihapus)',
      courseTitle: lessonIndex.get(r.lessonId)?.course?.title || '-',
    }));
  }, [resetFor, attempts, lessonIndex]);

  const doReset = async (row) => {
    if (!resetFor || resetBusy) return;
    if (!canReviewLearner(user, resetFor)) {
      setResetErr('Anda tidak berwenang mengubah data peserta ini.');
      return;
    }
    const ok = window.confirm(
      `Reset kesempatan kuis "${row.title}" untuk ${resetFor.name}?\n\n` +
      `${row.count} nilai percobaan akan dihapus (riwayatnya tetap diarsipkan) dan peserta bisa mengulang dari nol.`
    );
    if (!ok) return;
    setResetErr('');
    setResetBusy(row.lessonId);
    try {
      const n = await resetQuizAttempts(resetFor.id, row.lessonId, attempts, user);
      await lmsLog(`mereset ${n} kesempatan kuis "${row.title}" milik ${resetFor.name}`, user.name);
      // Muat ulang hanya milik satu peserta — hemat egress.
      const fresh = await loadMyAttempts(resetFor.id);
      setAttempts(prev => prev.filter(a => a.userId !== resetFor.id).concat(fresh || []));
    } catch (err) {
      setResetErr('Gagal mereset kesempatan kuis: ' + (err?.message || err) + ' Data lama tidak berubah.');
    } finally {
      setResetBusy('');
    }
  };

  const openValidation = (learner, path, status) => {
    setValModal({ learner, path, status });
    setValNote('');
    setValErr('');
  };

  const doValidation = async () => {
    if (!valModal || valBusy) return;
    const { learner, path, status } = valModal;
    if (!canReviewLearner(user, learner)) {
      setValErr('Anda tidak berwenang memvalidasi peserta ini.');
      return;
    }
    setValErr('');
    setValBusy(true);
    try {
      await setValidation(learner, path, status, valNote, user);
      await lmsLog(
        `menandai ${learner.name} sebagai ${status === 'COMPETENT' ? 'KOMPETEN' : 'PERLU PEMBINAAN'} pada jalur "${path.title}"`,
        user.name
      );
      const rows2 = await loadLmsValidations();
      setValidations(rows2 || []);
      setValModal(null);
      setValNote('');
    } catch (err) {
      setValErr('Gagal menyimpan validasi: ' + (err?.message || err) + ' Data lama tidak berubah, silakan coba lagi.');
    } finally {
      setValBusy(false);
    }
  };

  // ==========================================================================
  // TAMPILAN
  // ==========================================================================
  const tabs = [
    { id: 'progress', label: 'Progres Tim', icon: Users },
    { id: 'review', label: 'Perlu Direview', icon: ClipboardCheck, count: pending.length },
    { id: 'validasi', label: 'Validasi Kompetensi', icon: Award },
  ];

  return (
    <div className="max-w-7xl">
      {/* Header halaman */}
      <div className="flex items-end justify-between mb-6 gap-3 flex-wrap pb-4 border-b border-slate-200/60">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">Pembelajaran Tim</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            {admin
              ? 'Pantau progres belajar seluruh tim, review tugas praktik, dan validasi kompetensi.'
              : 'Pantau progres belajar anggota tim Anda, review tugas praktik, dan validasi kompetensi.'}
          </p>
        </div>
        <LmsGhostBtn icon={RotateCcw} onClick={loadAll} disabled={loading}>
          {loading ? 'Memuat...' : 'Muat Ulang'}
        </LmsGhostBtn>
      </div>

      {loadErr && (
        <div className="mb-4">
          <LmsError>
            {loadErr}
            <button onClick={loadAll} className="ml-2 underline font-semibold">Coba lagi</button>
          </LmsError>
        </div>
      )}

      {loading ? (
        <LmsSkeleton rows={4} />
      ) : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <LmsStat label="Peserta" value={stats.peserta} icon={Users} tone="blue" sub="anggota yang punya jalur belajar" />
            <LmsStat label="Sedang Belajar" value={stats.jalan} icon={CheckCircle2} tone="amber" />
            <LmsStat label="Jalur Selesai" value={stats.selesai} icon={Award} tone="emerald" />
            <LmsStat label="Menunggu Review" value={stats.review} icon={ClipboardCheck} tone="orange" />
          </div>

          <LmsTabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'progress' && (
            <ProgressTab
              rows={filteredRows}
              totalRows={rows.length}
              admin={admin}
              fStatus={fStatus} setFStatus={setFStatus}
              fDiv={fDiv} setFDiv={setFDiv}
              fSearch={fSearch} setFSearch={setFSearch}
              onReset={openReset}
            />
          )}

          {tab === 'review' && (
            <ReviewTab pending={pending} onOpen={openReview} />
          )}

          {tab === 'validasi' && (
            <ValidationTab
              rows={validationRows}
              validationsById={validationsById}
              onValidate={openValidation}
            />
          )}
        </>
      )}

      {/* -------------------------------------------------- Modal review tugas */}
      {reviewing && (
        <LmsModal
          size="lg"
          title="Review Tugas Praktik"
          subtitle={`${reviewing.userName || '-'} · ${reviewing.lessonTitle || '-'}`}
          onClose={() => { if (!reviewBusy) setReviewing(null); }}
        >
          <ReviewDetail
            sub={reviewing}
            lessonInfo={lessonIndex.get(reviewing.lessonId) || null}
          />

          <div className="mt-4 space-y-3">
            <LmsField
              label="Catatan untuk peserta"
              hint="Wajib diisi bila Anda meminta revisi. Tulis jelas apa yang perlu diperbaiki."
            >
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                rows={3}
                className={inputCls}
                placeholder="Contoh: Tolong lampirkan tangkapan layar hasil akhirnya, bagian analisisnya masih kosong."
              />
            </LmsField>

            {reviewErr && <LmsError>{reviewErr}</LmsError>}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => submitReview('APPROVED')}
                disabled={reviewBusy}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> SETUJUI
              </button>
              <button
                onClick={() => submitReview('REVISION_REQUIRED')}
                disabled={reviewBusy}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <AlertCircle className="w-4 h-4" /> MINTA REVISI
              </button>
            </div>
            {reviewBusy && <div className="text-xs text-slate-500 text-center">Menyimpan...</div>}
          </div>
        </LmsModal>
      )}

      {/* --------------------------------------- Modal reset kesempatan kuis */}
      {resetFor && (
        <LmsModal
          size="md"
          title="Reset Kesempatan Kuis"
          subtitle={resetFor.name}
          onClose={() => { if (!resetBusy) setResetFor(null); }}
        >
          <div className="space-y-3">
            <LmsNote tone="amber">
              Reset menghapus nilai percobaan kuis peserta supaya ia bisa mengulang dari nol.
              Riwayat nilai lamanya tetap diarsipkan, tetapi tidak lagi dihitung.
            </LmsNote>

            {resetErr && <LmsError>{resetErr}</LmsError>}

            {resetList.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                Peserta ini belum pernah mengerjakan kuis apa pun.
              </div>
            ) : (
              <div className="space-y-2">
                {resetList.map(r => (
                  <div key={r.lessonId} className="border border-slate-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0" style={{ minWidth: 160 }}>
                      <div className="font-semibold text-sm text-slate-800 truncate">{r.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{r.courseTitle}</div>
                      <div className="text-[11px] text-slate-600 mt-1">
                        {r.count}x percobaan · nilai terbaik {r.best}%{' '}
                        {r.lulus ? <span className="text-emerald-700 font-semibold">(lulus)</span>
                          : <span className="text-orange-600 font-semibold">(belum lulus)</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => doReset(r)}
                      disabled={!!resetBusy}
                      className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {resetBusy === r.lessonId ? 'Mereset...' : 'Reset'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </LmsModal>
      )}

      {/* ------------------------------------------- Modal validasi kompetensi */}
      {valModal && (
        <LmsModal
          size="md"
          title={valModal.status === 'COMPETENT' ? 'Tandai Kompeten' : 'Tandai Perlu Pembinaan'}
          subtitle={`${valModal.learner.name} · ${valModal.path.title}`}
          onClose={() => { if (!valBusy) setValModal(null); }}
        >
          <div className="space-y-3">
            <LmsNote tone={valModal.status === 'COMPETENT' ? 'emerald' : 'amber'}>
              {valModal.status === 'COMPETENT'
                ? 'Peserta dinyatakan sudah menguasai materi jalur belajar ini.'
                : 'Peserta masih perlu pendampingan. Tulis bagian mana yang perlu diperkuat.'}
            </LmsNote>

            <LmsField label="Catatan validasi" hint="Catatan ini dibaca peserta.">
              <textarea
                value={valNote}
                onChange={e => setValNote(e.target.value)}
                rows={3}
                className={inputCls}
                placeholder={valModal.status === 'COMPETENT'
                  ? 'Contoh: Praktiknya rapi dan hasilnya sesuai standar.'
                  : 'Contoh: Perlu latihan ulang bagian pembuatan konten.'}
              />
            </LmsField>

            {valErr && <LmsError>{valErr}</LmsError>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={doValidation}
                disabled={valBusy}
                className={`flex-1 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition ${
                  valModal.status === 'COMPETENT'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {valBusy ? 'Menyimpan...' : 'Simpan Validasi'}
              </button>
              <button
                onClick={() => { if (!valBusy) setValModal(null); }}
                className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </LmsModal>
      )}
    </div>
  );
}

// ============================================================================
// TAB 1 — PROGRES TIM
// ============================================================================
function ProgressTab({ rows, totalRows, admin, fStatus, setFStatus, fDiv, setFDiv, fSearch, setFSearch, onReset }) {
  return (
    <div>
      {/* Filter */}
      <LmsCard className="p-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={fSearch}
              onChange={e => setFSearch(e.target.value)}
              placeholder="Cari nama anggota..."
              className={inputCls + ' pl-9'}
            />
          </div>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={selectCls + ' sm:w-52'}>
            <option value="all">Semua Status</option>
            <option value="NOT_STARTED">Belum Mulai</option>
            <option value="IN_PROGRESS">Sedang Berjalan</option>
            <option value="COMPLETED">Selesai</option>
          </select>
          {admin && (
            <select value={fDiv} onChange={e => setFDiv(e.target.value)} className={selectCls + ' sm:w-52'}>
              <option value="all">Semua Divisi</option>
              {Object.keys(DIV_LABELS).map(k => (
                <option key={k} value={k}>{DIV_LABELS[k]}</option>
              ))}
            </select>
          )}
        </div>
      </LmsCard>

      {totalRows === 0 ? (
        <LmsEmpty
          icon={Users}
          title="Belum ada data"
          text="Belum ada anggota tim yang mengikuti pembelajaran."
        />
      ) : rows.length === 0 ? (
        <LmsEmpty
          icon={Search}
          title="Tidak ada yang cocok"
          text="Tidak ada anggota yang cocok dengan filter ini. Coba ubah kata kunci atau statusnya."
        />
      ) : (
        <>
          {/* Tabel untuk layar sedang ke atas */}
          <LmsCard className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm" style={{ minWidth: 880 }}>
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                    <th className="text-left font-semibold px-4 py-3">Nama</th>
                    <th className="text-left font-semibold px-4 py-3">Jabatan / Divisi</th>
                    <th className="text-left font-semibold px-4 py-3">Jalur Belajar</th>
                    <th className="text-left font-semibold px-4 py-3" style={{ width: 190 }}>Progres</th>
                    <th className="text-left font-semibold px-4 py-3">Kursus Berjalan</th>
                    <th className="text-left font-semibold px-4 py-3">Status</th>
                    <th className="text-right font-semibold px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.key} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{r.learner.name}</div>
                        {r.pp.percent === 0 && (
                          <LmsBadge color="bg-orange-100 text-orange-800" className="mt-1 inline-block">Belum bergerak</LmsBadge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{r.learner.jobTitle || '-'}</div>
                        <div className="text-[11px] text-slate-400">{divLabel(r.learner.division)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.path?.title || r.enrollment.pathTitle || 'Jalur sudah dihapus'}</td>
                      <td className="px-4 py-3">
                        <LmsProgressBar percent={r.pp.percent} tone={r.pp.completed ? 'emerald' : 'blue'} />
                        <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                          {r.pp.percent}% · {r.pp.lessonsDone}/{r.pp.lessonsTotal} materi
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.current || (r.pp.completed ? 'Semua kursus selesai' : '-')}</td>
                      <td className="px-4 py-3">
                        <LmsBadge color={ENROLL_STATUS[r.status]?.color}>{ENROLL_STATUS[r.status]?.label || r.status}</LmsBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onReset(r.learner)}
                          className="text-blue-700 hover:bg-blue-50 border border-blue-200 px-2.5 py-2 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset Kesempatan Kuis
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LmsCard>

          {/* Kartu untuk layar kecil */}
          <div className="md:hidden space-y-3">
            {rows.map(r => (
              <LmsCard key={r.key} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{r.learner.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {(r.learner.jobTitle || '-') + ' · ' + divLabel(r.learner.division)}
                    </div>
                  </div>
                  <LmsBadge color={ENROLL_STATUS[r.status]?.color}>{ENROLL_STATUS[r.status]?.label || r.status}</LmsBadge>
                </div>
                <div className="text-xs text-slate-600 mt-2 font-semibold">
                  {r.path?.title || r.enrollment.pathTitle || 'Jalur sudah dihapus'}
                </div>
                <LmsProgressBar percent={r.pp.percent} tone={r.pp.completed ? 'emerald' : 'blue'} className="mt-2" />
                <div className="text-[11px] text-slate-500 mt-1">
                  {r.pp.percent}% · {r.pp.lessonsDone}/{r.pp.lessonsTotal} materi
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Kursus berjalan: {r.current || (r.pp.completed ? 'Semua kursus selesai' : '-')}
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {r.pp.percent === 0 && <LmsBadge color="bg-orange-100 text-orange-800">Belum bergerak</LmsBadge>}
                  <button
                    onClick={() => onReset(r.learner)}
                    className="text-blue-700 hover:bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Kesempatan Kuis
                  </button>
                </div>
              </LmsCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// TAB 2 — PERLU DIREVIEW
// ============================================================================
function ReviewTab({ pending, onOpen }) {
  if (pending.length === 0) {
    return (
      <LmsEmpty
        icon={ClipboardCheck}
        title="Semua sudah ditangani"
        text="Tidak ada tugas yang menunggu review."
      />
    );
  }
  return (
    <div className="space-y-3">
      <LmsNote tone="blue">
        Daftar ini menyegarkan diri otomatis setiap 30 detik selama halaman terbuka.
      </LmsNote>
      {pending.map(s => {
        const last = (s.history || [])[(s.history || []).length - 1];
        return (
          <LmsCard key={s.id} className="p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0" style={{ minWidth: 180 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{s.userName || '-'}</span>
                  <LmsBadge color={SUBMISSION_STATUS[s.status]?.color}>
                    {SUBMISSION_STATUS[s.status]?.label || s.status}
                  </LmsBadge>
                  {(s.reviews || []).length > 0 && (
                    <LmsBadge color="bg-slate-100 text-slate-600">
                      Kiriman ke-{(s.history || []).length}
                    </LmsBadge>
                  )}
                </div>
                <div className="text-sm text-slate-700 mt-1">{s.lessonTitle || 'Tugas praktik'}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Dikirim: {fmtWaktu(last?.at || s.updatedAt)}
                </div>
              </div>
              <LmsPrimaryBtn icon={MessageSquare} onClick={() => onOpen(s)} className="py-2.5">
                Review
              </LmsPrimaryBtn>
            </div>
          </LmsCard>
        );
      })}
    </div>
  );
}

/** Isi modal review: instruksi, kiriman terakhir, dan seluruh riwayat. */
function ReviewDetail({ sub, lessonInfo }) {
  const history = sub.history || [];
  const reviews = sub.reviews || [];
  const last = history[history.length - 1] || null;
  const instructions = lessonInfo?.lesson?.assignment?.instructions || '';

  // Riwayat kiriman & review digabung lalu diurutkan menurut waktu.
  const timeline = useMemo(() => {
    const a = history.map((h, i) => ({ kind: 'kirim', at: h.at, data: h, no: i + 1 }));
    const b = reviews.map((r, i) => ({ kind: 'review', at: r.at, data: r, no: i + 1 }));
    return [...a, ...b].sort((x, y) => String(x.at || '').localeCompare(String(y.at || '')));
  }, [sub]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {instructions ? (
        <div>
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">Instruksi Tugas</div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap break-words">
            {instructions}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Kursus: {lessonInfo?.course?.title || '-'}
          </div>
        </div>
      ) : (
        <LmsNote tone="slate">
          Instruksi tugas tidak ditemukan (materinya mungkin sudah diubah atau dihapus).
        </LmsNote>
      )}

      {/* Kiriman terakhir */}
      <div>
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">Kiriman Terakhir</div>
        {!last ? (
          <div className="text-sm text-slate-500">Belum ada isi kiriman.</div>
        ) : (
          <div className="border border-slate-200 rounded-xl p-3 space-y-3">
            <div className="text-[11px] text-slate-500">{fmtWaktu(last.at)}</div>
            {last.text && (
              <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{last.text}</div>
            )}
            {last.link && (
              <a
                href={last.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline text-sm inline-flex items-center gap-1.5 break-all"
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                {last.link}
              </a>
            )}
            {(last.images || []).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {last.images.map((img, i) => (
                  <LmsImage
                    key={i}
                    src={img}
                    fetcher={lmsFetchImage}
                    alt={'Lampiran ' + (i + 1)}
                    className="w-full h-28 object-cover rounded-lg border border-slate-200"
                  />
                ))}
              </div>
            )}
            {!last.text && !last.link && (last.images || []).length === 0 && (
              <div className="text-sm text-slate-500">Kiriman ini kosong.</div>
            )}
          </div>
        )}
      </div>

      {/* Riwayat lengkap */}
      {timeline.length > 1 && (
        <div>
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            Riwayat Kiriman &amp; Review
          </div>
          <div className="space-y-2">
            {timeline.map((t, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3 text-sm ${
                  t.kind === 'kirim'
                    ? 'bg-white border-slate-200'
                    : t.data.decision === 'APPROVED'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-orange-50/70 border-orange-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-slate-700 text-xs">
                    {t.kind === 'kirim'
                      ? `Kiriman #${t.no} · ${t.data.byName || '-'}`
                      : `${t.data.decision === 'APPROVED' ? 'Disetujui' : 'Diminta revisi'} oleh ${t.data.byName || '-'}`}
                  </span>
                  <span className="text-[11px] text-slate-500">{fmtWaktu(t.at)}</span>
                </div>
                {t.kind === 'kirim' ? (
                  <div className="mt-1 text-slate-700 whitespace-pre-wrap break-words">
                    {t.data.text || '(tanpa teks)'}
                    {t.data.link && (
                      <div className="mt-1">
                        <a href={t.data.link} target="_blank" rel="noopener noreferrer"
                          className="text-blue-700 hover:underline break-all text-xs">
                          {t.data.link}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-slate-700 whitespace-pre-wrap break-words">
                    {t.data.note || '(tanpa catatan)'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 3 — VALIDASI KOMPETENSI
// ============================================================================
function ValidationTab({ rows, validationsById, onValidate }) {
  if (rows.length === 0) {
    return (
      <LmsEmpty
        icon={Award}
        title="Belum ada kandidat"
        text="Belum ada yang siap divalidasi."
      />
    );
  }
  return (
    <div className="space-y-3">
      <LmsNote tone="blue">
        Nilai kuis hanya bersifat indikatif. Keputusan akhir "Kompeten" tetap di tangan Anda
        setelah melihat praktik nyata di lapangan.
      </LmsNote>
      {rows.map(r => {
        const v = validationsById.get(`${r.learner.id}:${r.path.id}`);
        const st = VALIDATION_STATUS[v?.status] || VALIDATION_STATUS.PENDING;
        return (
          <LmsCard key={r.key} className="p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0" style={{ minWidth: 180 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{r.learner.name}</span>
                  <LmsBadge color={st.color}>{st.label}</LmsBadge>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {(r.learner.jobTitle || '-') + ' · ' + divLabel(r.learner.division)}
                </div>
                <div className="text-sm text-slate-700 mt-1">{r.path.title}</div>
                <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                  Selesai 100% · {r.pp.coursesDone}/{r.pp.coursesTotal} kursus wajib
                </div>
                {v?.validatedAt && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    Divalidasi oleh {v.validatorName || '-'} pada {fmtWaktu(v.validatedAt)}
                    {v.notes ? ` — "${v.notes}"` : ''}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => onValidate(r.learner, r.path, 'COMPETENT')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-lg font-semibold text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> TANDAI KOMPETEN
                </button>
                <button
                  onClick={() => onValidate(r.learner, r.path, 'NEEDS_IMPROVEMENT')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2.5 rounded-lg font-semibold text-xs flex items-center gap-1.5"
                >
                  <AlertCircle className="w-4 h-4" /> PERLU PEMBINAAN
                </button>
              </div>
            </div>
          </LmsCard>
        );
      })}
    </div>
  );
}
