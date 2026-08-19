// ============================================================================
// LMS V1 — PEMUTAR KURSUS (tempat karyawan benar-benar belajar)
// ----------------------------------------------------------------------------
// Aturan yang dipegang file ini:
//  1. HEMAT EGRESS — tidak ada polling sama sekali di halaman ini. Isi materi
//     (lesson body) dimuat ON-DEMAND hanya saat lesson dibuka, plus tombol
//     "Muat Ulang Materi" kalau gagal/kosong.
//  2. Tidak ada progres penting yang cuma hidup di state. Setiap penyelesaian
//     lesson langsung ditulis ke server lalu reload() dari induk dipanggil.
//     (App induk me-remount halaman tiap ganti menu — state pasti hilang.)
//  3. Semua penulisan lewat fungsi data.js yang MELEMPAR error → dibungkus
//     try/catch dan pesannya menegaskan data lama tidak berubah.
//  4. Warna gelap/gradient pakai inline style, bukan kelas bg-[#hex].
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2, Lock, PlayCircle, FileText, Link2, ListChecks, ClipboardList,
  ArrowLeft, ArrowRight, Send, Upload, X, AlertCircle, Award, ChevronDown,
} from 'lucide-react';
import {
  allLessons, findLesson, buildCtx, isLessonDone, computeCourseProgress,
  lockedLessonIds, nextLessonOf, loadLessonBody,
  saveProgress, progressId,
  gradeQuiz, saveAttempt, attemptId, attemptsUsed, attemptsLeft, bestAttempt,
  emptySubmission, submitAssignment, lmsPutImage, lmsFetchImage, loadMyAttempts,
  SUBMISSION_STATUS, LESSON_TYPES,
} from './data.js';
import {
  LmsCard, LmsBadge, LmsProgressBar, LmsRing, LmsEmpty, LmsLoading, LmsError,
  LmsNote, LmsPrimaryBtn, LmsGhostBtn, LmsImage, LmsField, inputCls,
} from './ui.jsx';

const TYPE_ICON = {
  text: FileText,
  video: PlayCircle,
  document: Link2,
  quiz: ListChecks,
  assignment: ClipboardList,
};

const CONTENT_TYPES = ['text', 'video', 'document'];

function fmtDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

// Kompres gambar → dataURL JPEG. Sengaja disalin dari App.jsx (bukan di-import)
// karena mengimpor App.jsx dari modul LMS = circular import = layar putih.
function compressToJpeg(file, { maxDim = 1000, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return reject(new Error('File harus berupa gambar (PNG/JPG/WEBP).'));
    }
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Ukuran gambar maksimal 10MB.'));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width, height = img.height;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale); height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const cx = canvas.getContext('2d');
        cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, width, height);
        cx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Gambar tidak bisa dibaca.'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('File gagal dibaca.'));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------- OUTLINE
function CourseOutline({ course, ctx, locked, activeId, onPick }) {
  const modules = [...(course.modules || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (modules.length === 0) {
    return <div className="text-xs text-slate-500 px-1 py-3">Kursus ini belum punya modul.</div>;
  }
  return (
    <div className="space-y-4">
      {modules.map((m, mi) => {
        const lessons = [...(m.lessons || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return (
          <div key={m.id || mi}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 px-1 mb-1.5">
              Modul {mi + 1} · {m.title || 'Tanpa Judul'}
            </div>
            {lessons.length === 0 && (
              <div className="text-[11px] text-slate-400 px-1 pb-1">Belum ada materi di modul ini.</div>
            )}
            <div className="space-y-1.5">
              {lessons.map(l => {
                const done = isLessonDone(l, ctx);
                const isLocked = locked.has(l.id);
                const on = l.id === activeId;
                const Icon = TYPE_ICON[l.type] || FileText;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { if (!isLocked) onPick(l.id); }}
                    disabled={isLocked}
                    title={isLocked ? 'Selesaikan materi sebelumnya dulu.' : (l.title || 'Materi')}
                    className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition ${
                      on
                        ? 'border-blue-200 bg-blue-50/70'
                        : isLocked
                          ? 'border-slate-100 bg-slate-50 cursor-not-allowed'
                          : 'border-slate-200/70 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4 text-slate-300" />
                      ) : on ? (
                        <span className="block w-3 h-3 rounded-full" style={{ backgroundColor: '#2563EB' }} />
                      ) : (
                        <span className="block w-3 h-3 rounded-full border-2 border-slate-300" />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13px] font-semibold leading-snug ${isLocked ? 'text-slate-400' : on ? 'text-blue-800' : 'text-slate-800'}`}>
                        {l.title || 'Materi'}
                      </span>
                      <span className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Icon className={`w-3 h-3 ${isLocked ? 'text-slate-300' : 'text-slate-400'}`} />
                        <span className="text-[10px] text-slate-500">
                          {(LESSON_TYPES[l.type] || {}).label || 'Materi'}
                        </span>
                        {Number(l.estimatedMinutes) > 0 && (
                          <span className="text-[10px] text-slate-400">· {l.estimatedMinutes} menit</span>
                        )}
                        {l.required === false && <LmsBadge>Opsional</LmsBadge>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------- SOAL KUIS
function QuizQuestionCard({ q, index, value, onChange, disabled, detail }) {
  const options = q.options || [];
  const tfOptions = [{ id: 'benar', text: 'Benar' }, { id: 'salah', text: 'Salah' }];
  const list = q.type === 'truefalse' ? tfOptions : options;
  const isMulti = q.type === 'multiple';
  const picked = isMulti ? (Array.isArray(value) ? value : []) : value;

  const toggleMulti = (id) => {
    const cur = Array.isArray(value) ? value : [];
    onChange(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  };

  return (
    <LmsCard className="p-4">
      <div className="flex items-start gap-2">
        <span className="w-6 h-6 rounded-lg text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: detail ? (detail.correct ? '#10B981' : '#DC2626') : '#2563EB' }}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">{q.text}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <LmsBadge>{Number(q.points) || 1} poin</LmsBadge>
            {isMulti && <LmsBadge color="bg-blue-100 text-blue-800">Boleh pilih lebih dari satu</LmsBadge>}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {list.length === 0 && <div className="text-xs text-slate-400">Soal ini belum punya pilihan jawaban.</div>}
        {list.map(o => {
          const on = isMulti ? picked.includes(o.id) : picked === o.id;
          return (
            <label key={o.id}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition ${
                on ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'
              } ${disabled ? 'cursor-default opacity-90' : ''}`}>
              <input
                type={isMulti ? 'checkbox' : 'radio'}
                name={`q-${q.id}`}
                checked={!!on}
                disabled={disabled}
                onChange={() => { if (isMulti) toggleMulti(o.id); else onChange(o.id); }}
                className="mt-0.5 w-4 h-4 flex-shrink-0"
              />
              <span className="text-sm text-slate-700 leading-snug">{o.text}</span>
            </label>
          );
        })}
      </div>

      {/* Penjelasan hanya muncul SETELAH submit — jangan pernah bocorkan sebelum itu. */}
      {detail && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            {detail.correct
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
            <span className={`text-xs font-bold ${detail.correct ? 'text-emerald-700' : 'text-red-700'}`}>
              {detail.correct ? 'Jawaban Anda benar' : 'Jawaban Anda belum tepat'}
            </span>
          </div>
          {detail.explanation && (
            <div className="text-[12px] text-slate-600 whitespace-pre-wrap leading-relaxed">{detail.explanation}</div>
          )}
        </div>
      )}
    </LmsCard>
  );
}

// ============================================================ KOMPONEN UTAMA
export default function CoursePlayer({ user, course, startLessonId, my, reload, onBack }) {
  const myProgress = Array.isArray(my?.progress) ? my.progress : [];
  const myAttempts = Array.isArray(my?.attempts) ? my.attempts : [];
  const mySubmissions = Array.isArray(my?.submissions) ? my.submissions : [];

  const lessons = useMemo(() => allLessons(course), [course]);
  const ctx = useMemo(
    () => buildCtx({ progress: myProgress, attempts: myAttempts, submissions: mySubmissions }, user?.id),
    [myProgress, myAttempts, mySubmissions, user?.id]
  );
  const locked = useMemo(() => lockedLessonIds(course, ctx), [course, ctx]);
  const courseProgress = useMemo(() => computeCourseProgress(course, ctx), [course, ctx]);

  // Lesson awal dihitung SEKALI saat mount: hormati startLessonId, kalau tidak ada
  // lompat ke materi pertama yang belum selesai.
  const [activeId, setActiveId] = useState(() => {
    const ls = allLessons(course);
    if (ls.length === 0) return null;
    if (startLessonId && ls.some(l => l.id === startLessonId)) return startLessonId;
    const c = buildCtx({
      progress: Array.isArray(my?.progress) ? my.progress : [],
      attempts: Array.isArray(my?.attempts) ? my.attempts : [],
      submissions: Array.isArray(my?.submissions) ? my.submissions : [],
    }, user?.id);
    const nx = nextLessonOf(course, c);
    return nx ? nx.id : ls[0].id;
  });

  const lesson = useMemo(() => findLesson(course, activeId), [course, activeId]);
  const lessonIndex = lessons.findIndex(l => l.id === activeId);
  const prevLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 && lessonIndex < lessons.length - 1 ? lessons[lessonIndex + 1] : null;
  const lessonDone = lesson ? isLessonDone(lesson, ctx) : false;

  // ---- isi materi (on-demand, tanpa polling) ----
  const [body, setBody] = useState('');
  const [bodyLoading, setBodyLoading] = useState(false);
  const [bodyErr, setBodyErr] = useState('');
  const [bodyNonce, setBodyNonce] = useState(0);

  // ---- state aksi umum ----
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState('');
  const [outlineOpen, setOutlineOpen] = useState(false);

  // ---- state kuis ----
  const [quizPhase, setQuizPhase] = useState('idle'); // idle | running | result
  const [answers, setAnswers] = useState({});
  const [quizStartedAt, setQuizStartedAt] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [quizErr, setQuizErr] = useState('');

  // ---- state tugas praktik ----
  const [asgText, setAsgText] = useState('');
  const [asgLink, setAsgLink] = useState('');
  const [asgImages, setAsgImages] = useState([]);
  const [asgErr, setAsgErr] = useState('');
  const [imgBusy, setImgBusy] = useState(false);
  const fileRef = useRef(null);

  const submission = useMemo(
    () => mySubmissions.find(s => s.lessonId === activeId) || null,
    [mySubmissions, activeId]
  );

  // Muat isi materi saat lesson dibuka. SELALU setBodyLoading(false) di finally —
  // ini bug nyata di app induk: halaman nyangkut di "Memuat..." selamanya.
  useEffect(() => {
    const l = findLesson(course, activeId);
    if (!l) { setBody(''); setBodyLoading(false); setBodyErr(''); return; }
    // Isi materi hanya pernah ditulis untuk text/video/document. Membacanya untuk
    // kuis/tugas = satu permintaan server sia-sia tiap kali materi dibuka.
    if (!CONTENT_TYPES.includes(l.type)) { setBody(''); setBodyLoading(false); setBodyErr(''); return; }
    let alive = true;
    setBodyErr('');
    setBodyLoading(true);
    (async () => {
      try {
        const b = await loadLessonBody(l.id, bodyNonce > 0); // force saat tombol Muat Ulang ditekan
        if (alive) setBody(b || '');
      } catch (e) {
        if (alive) { setBody(''); setBodyErr('Isi materi gagal dimuat. Coba tekan "Muat Ulang Materi".'); }
      } finally {
        if (alive) setBodyLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [course, activeId, bodyNonce]);

  // Reset seluruh form saat pindah lesson supaya jawaban/isian tidak bocor antar materi.
  useEffect(() => {
    setQuizPhase('idle'); setAnswers({}); setQuizResult(null); setQuizErr(''); setQuizStartedAt(null);
    setActionErr(''); setOutlineOpen(false);
    setAsgImages([]); setAsgErr('');
    const l = findLesson(course, activeId);
    const sub = mySubmissions.find(s => s.lessonId === activeId) || null;
    const last = sub && sub.history && sub.history.length ? sub.history[sub.history.length - 1] : null;
    // Saat diminta revisi, isian lama diisikan kembali supaya peserta tinggal memperbaiki.
    if (l && l.type === 'assignment' && sub && sub.status === 'REVISION_REQUIRED' && last) {
      setAsgText(last.text || '');
      setAsgLink(last.link || '');
    } else {
      setAsgText(''); setAsgLink('');
    }
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (id) => { if (id) setActiveId(id); };

  // -------------------------------------------------- Tandai selesai
  const markDone = async () => {
    if (!lesson) return;
    setActionErr('');
    setBusy(true);
    try {
      await saveProgress({
        id: progressId(user.id, lesson.id),
        userId: user.id,
        lessonId: lesson.id,
        courseId: course.id,
        completedAt: new Date().toISOString(),
      });
      await reload();
      if (nextLesson) setActiveId(nextLesson.id);
    } catch (e) {
      setActionErr('Gagal menyimpan tanda selesai: ' + (e?.message || 'koneksi bermasalah') + '. Data lama Anda tidak berubah, silakan coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------- Kuis
  const quiz = lesson?.type === 'quiz' ? (lesson.quiz || null) : null;
  const quizQuestions = quiz?.questions || [];
  const usedAttempts = lesson ? attemptsUsed(myAttempts, lesson.id, user.id) : 0;
  const leftAttempts = quiz && lesson ? attemptsLeft(quiz, myAttempts, lesson.id, user.id) : 0;
  const best = lesson ? bestAttempt(myAttempts, lesson.id, user.id) : null;
  const lessonAttempts = useMemo(
    () => myAttempts.filter(a => a.lessonId === activeId).sort((a, b) => (a.attemptNo || 0) - (b.attemptNo || 0)),
    [myAttempts, activeId]
  );

  const unansweredCount = quizQuestions.filter(q => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length === 0 : (v === undefined || v === null || v === '');
  }).length;

  const startQuiz = () => {
    setQuizErr('');
    setAnswers({});
    setQuizResult(null);
    setQuizStartedAt(new Date().toISOString());
    setQuizPhase('running');
  };

  const submitQuiz = async () => {
    if (!quiz || !lesson) return;
    if (unansweredCount > 0) {
      const ok = window.confirm(`Masih ada ${unansweredCount} soal yang belum dijawab. Soal kosong dihitung salah. Tetap kirim jawaban?`);
      if (!ok) return;
    }
    setQuizErr('');
    setBusy(true);
    try {
      const hasil = await gradeQuiz(quiz, answers);
      // Nomor percobaan HARUS dihitung dari server, bukan dari state induk.
      // Kalau reload() sebelumnya sempat gagal (koneksi), state induk masih lama →
      // nomor yang sama dipakai dua kali, dan karena attemptId() deterministik,
      // percobaan sebelumnya akan TERTIMPA diam-diam.
      const fresh = await loadMyAttempts(user.id).catch(() => myAttempts);
      if (attemptsLeft(quiz, fresh, lesson.id, user.id) <= 0) {
        setQuizErr('Kesempatan mengerjakan kuis ini sudah habis. Hubungi leader Anda untuk membuka kesempatan baru.');
        setQuizPhase('idle');
        return;
      }
      const nomor = attemptsUsed(fresh, lesson.id, user.id) + 1;
      const now = new Date().toISOString();
      await saveAttempt({
        id: attemptId(user.id, lesson.id, nomor),
        userId: user.id,
        lessonId: lesson.id,
        courseId: course.id,
        attemptNo: nomor,
        answers,
        score: hasil.score,
        maxScore: hasil.maxScore,
        percent: hasil.percent,
        passed: hasil.passed,
        startedAt: quizStartedAt || now,
        submittedAt: now,
      });
      await reload();
      setQuizResult(hasil);
      setQuizPhase('result');
    } catch (e) {
      setQuizErr('Hasil kuis gagal disimpan: ' + (e?.message || 'koneksi bermasalah') + '. Kesempatan Anda TIDAK terpakai dan data lama tidak berubah. Silakan kirim ulang.');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------- Tugas praktik
  const assignment = lesson?.type === 'assignment' ? (lesson.assignment || {}) : null;
  const currentSub = useMemo(() => {
    if (!lesson || lesson.type !== 'assignment') return null;
    return submission || emptySubmission(user, lesson, course.id);
  }, [submission, lesson, user, course]);

  const asgApproved = currentSub?.status === 'APPROVED';
  const asgNeedsRevision = currentSub?.status === 'REVISION_REQUIRED';
  const lastReview = currentSub?.reviews?.length ? currentSub.reviews[currentSub.reviews.length - 1] : null;

  const pickImages = async (files) => {
    if (!files || files.length === 0) return;
    setAsgErr('');
    setImgBusy(true);
    try {
      const picked = Array.from(files).slice(0, 3 - asgImages.length);
      const next = [];
      for (const f of picked) {
        const b64 = await compressToJpeg(f);
        // WAJIB lewat brankas gambar: base64 mentah tidak boleh masuk record.
        const ref = await lmsPutImage(b64);
        next.push(ref);
      }
      setAsgImages(prev => [...prev, ...next].slice(0, 3));
    } catch (e) {
      setAsgErr(e?.message || 'Gambar gagal diproses. Coba pilih gambar lain.');
    } finally {
      setImgBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const sendAssignment = async () => {
    if (!currentSub || !lesson) return;
    setAsgErr('');
    if (!asgText.trim()) { setAsgErr('Catatan pekerjaan wajib diisi.'); return; }
    if (assignment?.needLink && !asgLink.trim()) { setAsgErr('Link bukti pekerjaan wajib diisi.'); return; }
    if (assignment?.needFile && asgImages.length === 0 && !asgNeedsRevision) {
      setAsgErr('Tugas ini wajib melampirkan minimal 1 gambar.');
      return;
    }
    setBusy(true);
    try {
      await submitAssignment(currentSub, { text: asgText, link: asgLink, images: asgImages }, user);
      await reload();
      setAsgImages([]);
    } catch (e) {
      setAsgErr('Tugas gagal dikirim: ' + (e?.message || 'koneksi bermasalah') + '. Pengiriman lama Anda tidak berubah, silakan coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  // Gabung riwayat kirim + riwayat review jadi satu garis waktu.
  const timeline = useMemo(() => {
    if (!currentSub) return [];
    const a = (currentSub.history || []).map(h => ({ ...h, kind: 'kirim' }));
    const b = (currentSub.reviews || []).map(r => ({ ...r, kind: 'review' }));
    return [...a, ...b].sort((x, y) => String(x.at).localeCompare(String(y.at)));
  }, [currentSub]);

  // ------------------------------------------------------------- RENDER
  if (!course) {
    return <LmsEmpty icon={AlertCircle} title="Kursus tidak ditemukan" text="Kursus ini mungkin sudah dihapus. Kembali dan pilih kursus lain."
      action={<LmsGhostBtn icon={ArrowLeft} onClick={onBack}>Kembali</LmsGhostBtn>} />;
  }

  const outlineBlock = (
    <LmsCard className="p-4">
      <div className="flex items-center gap-3">
        <LmsRing percent={courseProgress.percent} size={44} tone={courseProgress.completed ? 'emerald' : 'blue'} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Progres Kursus</div>
          <div className="text-xs text-slate-600 mt-0.5">
            {courseProgress.done} dari {courseProgress.total} materi wajib selesai
          </div>
        </div>
      </div>
      <LmsProgressBar percent={courseProgress.percent} tone={courseProgress.completed ? 'emerald' : 'blue'} className="mt-3" />

      <button type="button" onClick={() => setOutlineOpen(!outlineOpen)}
        className="lg:hidden w-full mt-3 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ListChecks className="w-4 h-4 text-slate-400" /> Daftar Materi
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${outlineOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${outlineOpen ? 'block' : 'hidden'} lg:block mt-4 lg:max-h-[65vh] lg:overflow-y-auto scroll-thin`}>
        <CourseOutline course={course} ctx={ctx} locked={locked} activeId={activeId} onPick={goTo} />
      </div>
    </LmsCard>
  );

  return (
    <div className="max-w-7xl">
      {/* Header kursus */}
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-slate-200/60">
        <button type="button" onClick={onBack}
          className="mt-1 p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition flex-shrink-0"
          title="Kembali ke daftar kursus">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{course.title}</h1>
          {course.description && <p className="text-sm text-slate-500 mt-1.5">{course.description}</p>}
        </div>
      </div>

      {courseProgress.completed && (
        <div className="mb-5 rounded-2xl p-4 flex items-center gap-3 text-white"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)' }}>
          <Award className="w-6 h-6 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-display font-bold">Semua materi wajib sudah selesai</div>
            <div className="text-xs opacity-90 mt-0.5">Penilaian kompetensi akhir dilakukan oleh leader Anda.</div>
          </div>
        </div>
      )}

      {lessons.length === 0 ? (
        <LmsEmpty icon={FileText} title="Kursus ini belum ada materinya"
          text="Pengelola kursus belum menambahkan modul dan materi. Silakan cek lagi nanti."
          action={<LmsGhostBtn icon={ArrowLeft} onClick={onBack}>Kembali</LmsGhostBtn>} />
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Outline: di HP tampil DI ATAS konten, di desktop jadi kolom kanan */}
          <aside className="w-full lg:w-80 flex-shrink-0 order-1 lg:order-2 lg:sticky lg:top-4">
            {outlineBlock}
          </aside>

          {/* Konten utama */}
          <div className="flex-1 min-w-0 w-full order-2 lg:order-1 space-y-4">
            {!lesson ? (
              <LmsEmpty icon={FileText} title="Materi belum dipilih" text="Pilih salah satu materi di daftar materi." />
            ) : (
              <>
                <LmsCard className="p-5">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <LmsBadge color="bg-blue-100 text-blue-800">
                          {(LESSON_TYPES[lesson.type] || {}).label || 'Materi'}
                        </LmsBadge>
                        {Number(lesson.estimatedMinutes) > 0 && <LmsBadge>{lesson.estimatedMinutes} menit</LmsBadge>}
                        {lesson.required === false && <LmsBadge>Opsional</LmsBadge>}
                        {lessonDone && <LmsBadge color="bg-emerald-100 text-emerald-800">Selesai</LmsBadge>}
                      </div>
                      <h2 className="font-display text-lg font-bold text-slate-900 mt-2">{lesson.title || 'Materi'}</h2>
                      {lesson.moduleTitle && (
                        <div className="text-[11px] text-slate-500 mt-1">Modul: {lesson.moduleTitle}</div>
                      )}
                    </div>
                  </div>

                  {locked.has(lesson.id) && (
                    <div className="mt-3">
                      <LmsNote tone="amber">
                        Masih ada materi wajib sebelumnya yang belum selesai. Sebaiknya selesaikan dulu dari urutan awal agar pemahaman Anda utuh.
                      </LmsNote>
                    </div>
                  )}
                </LmsCard>

                {/* ---------------- TEXT / VIDEO / DOCUMENT ---------------- */}
                {CONTENT_TYPES.includes(lesson.type) && (
                  <LmsCard className="p-5 space-y-4">
                    {lesson.type === 'video' && (
                      <div className="space-y-3">
                        {lesson.videoUrl ? (
                          <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white font-semibold px-5 py-3 rounded-xl transition"
                            style={{ backgroundColor: '#2563EB' }}>
                            <PlayCircle className="w-5 h-5" /> Buka Video
                          </a>
                        ) : (
                          <LmsNote tone="amber">Link video belum diisi oleh pengelola kursus.</LmsNote>
                        )}
                        <LmsNote>
                          Video terbuka di tab baru. Aplikasi ini tidak merekam berapa lama Anda menonton — kejujuran Anda yang dipakai, dan pemahaman Anda diuji lewat kuis atau tugas praktik.
                        </LmsNote>
                      </div>
                    )}

                    {lesson.type === 'document' && (
                      <div className="space-y-3">
                        {lesson.docUrl ? (
                          <a href={lesson.docUrl} target="_blank" rel="noopener noreferrer"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white font-semibold px-5 py-3 rounded-xl transition"
                            style={{ backgroundColor: '#2563EB' }}>
                            <Link2 className="w-5 h-5" /> Buka Dokumen
                          </a>
                        ) : (
                          <LmsNote tone="amber">Link dokumen belum diisi oleh pengelola kursus.</LmsNote>
                        )}
                        <LmsNote>Dokumen terbuka di tab baru.</LmsNote>
                      </div>
                    )}

                    {bodyLoading ? (
                      <LmsLoading text="Memuat isi materi..." />
                    ) : bodyErr ? (
                      <LmsError>{bodyErr}</LmsError>
                    ) : body ? (
                      <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">{body}</div>
                    ) : lesson.type === 'text' ? (
                      <LmsNote tone="slate">Isi materi masih kosong. Coba muat ulang, atau hubungi pengelola kursus.</LmsNote>
                    ) : null}

                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <LmsGhostBtn onClick={() => setBodyNonce(n => n + 1)} disabled={bodyLoading}>
                        Muat Ulang Materi
                      </LmsGhostBtn>
                    </div>

                    <LmsError>{actionErr}</LmsError>

                    {lessonDone ? (
                      <div className="space-y-3">
                        <LmsNote tone="emerald">Materi ini sudah Anda selesaikan.</LmsNote>
                        {nextLesson && (
                          <LmsPrimaryBtn icon={ArrowRight} onClick={() => goTo(nextLesson.id)} className="w-full sm:w-auto justify-center py-3">
                            Lanjut ke Materi Berikutnya
                          </LmsPrimaryBtn>
                        )}
                      </div>
                    ) : (
                      <LmsPrimaryBtn icon={CheckCircle2} onClick={markDone} disabled={busy}
                        className="w-full sm:w-auto justify-center py-3">
                        {busy ? 'Menyimpan...' : 'Tandai Selesai'}
                      </LmsPrimaryBtn>
                    )}
                  </LmsCard>
                )}

                {/* ---------------- KUIS ---------------- */}
                {lesson.type === 'quiz' && (
                  <div className="space-y-4">
                    {!quiz || quizQuestions.length === 0 ? (
                      <LmsCard className="p-5">
                        <LmsNote tone="amber">Kuis ini belum punya soal. Hubungi pengelola kursus.</LmsNote>
                      </LmsCard>
                    ) : (
                      <>
                        {/* Ringkasan kuis */}
                        <LmsCard className="p-5 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-slate-50 rounded-xl p-3">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Jumlah Soal</div>
                              <div className="font-display font-bold text-lg text-slate-800 mt-0.5">{quizQuestions.length}</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nilai Minimum</div>
                              <div className="font-display font-bold text-lg text-slate-800 mt-0.5">{Number(quiz.passingScore) || 0}%</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sudah Dicoba</div>
                              <div className="font-display font-bold text-lg text-slate-800 mt-0.5">{usedAttempts}×</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sisa Kesempatan</div>
                              <div className="font-display font-bold text-lg text-slate-800 mt-0.5">
                                {leftAttempts === Infinity ? 'Tidak dibatasi' : `${leftAttempts}×`}
                              </div>
                            </div>
                          </div>
                          {best && (
                            <LmsNote tone={best.passed ? 'emerald' : 'slate'}>
                              Nilai terbaik Anda sejauh ini: <b>{best.percent}%</b> ({best.score}/{best.maxScore} poin) — {best.passed ? 'LULUS' : 'BELUM LULUS'}.
                            </LmsNote>
                          )}
                          <LmsNote tone="slate">
                            Nilai kuis dihitung langsung di perangkat Anda dan sifatnya indikatif. Penilaian akhir kompetensi tetap dilakukan oleh leader Anda.
                          </LmsNote>
                        </LmsCard>

                        <LmsError>{quizErr}</LmsError>

                        {/* Fase: belum mulai */}
                        {quizPhase === 'idle' && (
                          <LmsCard className="p-5 space-y-3">
                            {lessonDone && <LmsNote tone="emerald">Anda sudah lulus kuis ini.</LmsNote>}
                            {leftAttempts === 0 ? (
                              <LmsNote tone="amber">
                                Kesempatan sudah habis. Hubungi leader Anda untuk membuka kesempatan baru.
                              </LmsNote>
                            ) : (
                              <>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                  Semua soal ditampilkan dalam satu halaman. Jawab semuanya, lalu tekan tombol kirim di bagian bawah.
                                </p>
                                <LmsPrimaryBtn icon={ListChecks} onClick={startQuiz} className="w-full sm:w-auto justify-center py-3">
                                  MULAI KUIS
                                </LmsPrimaryBtn>
                              </>
                            )}
                            {lessonDone && nextLesson && (
                              <LmsGhostBtn icon={ArrowRight} onClick={() => goTo(nextLesson.id)} className="w-full sm:w-auto justify-center py-3">
                                Lanjut ke Materi Berikutnya
                              </LmsGhostBtn>
                            )}
                            {lessonAttempts.length > 0 && (
                              <div className="pt-2">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Riwayat Percobaan</div>
                                <div className="overflow-x-auto scroll-thin">
                                  <table className="w-full text-sm min-w-[380px]">
                                    <thead>
                                      <tr className="text-left text-[11px] text-slate-500 uppercase tracking-wide">
                                        <th className="py-1.5 pr-3">Ke-</th>
                                        <th className="py-1.5 pr-3">Nilai</th>
                                        <th className="py-1.5 pr-3">Hasil</th>
                                        <th className="py-1.5">Waktu</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {lessonAttempts.map(a => (
                                        <tr key={a.id} className="border-t border-slate-100">
                                          <td className="py-2 pr-3 text-slate-700">{a.attemptNo}</td>
                                          <td className="py-2 pr-3 text-slate-700">{a.percent}% ({a.score}/{a.maxScore})</td>
                                          <td className="py-2 pr-3">
                                            <LmsBadge color={a.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}>
                                              {a.passed ? 'Lulus' : 'Belum Lulus'}
                                            </LmsBadge>
                                          </td>
                                          <td className="py-2 text-[11px] text-slate-500 whitespace-nowrap">{fmtDateTime(a.submittedAt)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </LmsCard>
                        )}

                        {/* Fase: mengerjakan */}
                        {quizPhase === 'running' && (
                          <div className="space-y-3">
                            {quizQuestions.map((q, i) => (
                              <QuizQuestionCard key={q.id} q={q} index={i} value={answers[q.id]}
                                disabled={busy}
                                onChange={(v) => setAnswers(prev => ({ ...prev, [q.id]: v }))} />
                            ))}
                            <LmsCard className="p-5 space-y-3">
                              {unansweredCount > 0 && (
                                <LmsNote tone="amber">Masih ada {unansweredCount} soal yang belum dijawab. Soal kosong dihitung salah.</LmsNote>
                              )}
                              <LmsError>{quizErr}</LmsError>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <LmsPrimaryBtn icon={Send} onClick={submitQuiz} disabled={busy}
                                  className="w-full sm:w-auto justify-center py-3">
                                  {busy ? 'Mengirim...' : 'Kirim Jawaban'}
                                </LmsPrimaryBtn>
                                <LmsGhostBtn onClick={() => { setQuizPhase('idle'); setAnswers({}); }} disabled={busy}
                                  className="w-full sm:w-auto justify-center py-3">
                                  Batalkan
                                </LmsGhostBtn>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Jawaban belum tersimpan sampai Anda menekan "Kirim Jawaban". Jangan tutup halaman ini dulu.
                              </div>
                            </LmsCard>
                          </div>
                        )}

                        {/* Fase: hasil */}
                        {quizPhase === 'result' && quizResult && (
                          <div className="space-y-3">
                            <div className="rounded-2xl p-5 text-white"
                              style={{
                                background: quizResult.passed
                                  ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
                                  : 'linear-gradient(135deg, #C2410C 0%, #F97316 100%)',
                              }}>
                              <div className="flex items-center gap-3">
                                {quizResult.passed ? <Award className="w-7 h-7 flex-shrink-0" /> : <AlertCircle className="w-7 h-7 flex-shrink-0" />}
                                <div className="min-w-0">
                                  <div className="font-display font-bold text-lg">
                                    {quizResult.passed ? 'LULUS' : 'BELUM LULUS'}
                                  </div>
                                  <div className="text-sm opacity-95 mt-0.5">
                                    Nilai {quizResult.percent}% · {quizResult.score} dari {quizResult.maxScore} poin · minimum {quizResult.passingScore}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            {quizQuestions.map((q, i) => {
                              const d = quizResult.detail.find(x => x.questionId === q.id) || null;
                              return (
                                <QuizQuestionCard key={q.id} q={q} index={i} value={answers[q.id]}
                                  disabled onChange={() => {}} detail={d} />
                              );
                            })}

                            <LmsCard className="p-5 space-y-3">
                              <LmsNote tone="slate">
                                Nilai ini dihitung di perangkat Anda dan bersifat indikatif. Penilaian akhir kompetensi dilakukan oleh leader Anda.
                              </LmsNote>
                              {quizResult.passed ? (
                                nextLesson ? (
                                  <LmsPrimaryBtn icon={ArrowRight} onClick={() => goTo(nextLesson.id)} className="w-full sm:w-auto justify-center py-3">
                                    Lanjut ke Materi Berikutnya
                                  </LmsPrimaryBtn>
                                ) : (
                                  <LmsNote tone="emerald">Ini materi terakhir di kursus ini. Kerja bagus!</LmsNote>
                                )
                              ) : leftAttempts === 0 ? (
                                <LmsNote tone="amber">
                                  Kesempatan sudah habis. Hubungi leader Anda untuk membuka kesempatan baru.
                                </LmsNote>
                              ) : (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <LmsPrimaryBtn icon={ListChecks} onClick={startQuiz} className="w-full sm:w-auto justify-center py-3">
                                    Coba Lagi
                                  </LmsPrimaryBtn>
                                  {prevLesson && (
                                    <LmsGhostBtn icon={ArrowLeft} onClick={() => goTo(prevLesson.id)} className="w-full sm:w-auto justify-center py-3">
                                      Pelajari Kembali
                                    </LmsGhostBtn>
                                  )}
                                </div>
                              )}
                            </LmsCard>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ---------------- TUGAS PRAKTIK ---------------- */}
                {lesson.type === 'assignment' && currentSub && (
                  <div className="space-y-4">
                    <LmsCard className="p-5 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Status Tugas</span>
                        <LmsBadge color={(SUBMISSION_STATUS[currentSub.status] || SUBMISSION_STATUS.NOT_SUBMITTED).color}>
                          {(SUBMISSION_STATUS[currentSub.status] || SUBMISSION_STATUS.NOT_SUBMITTED).label}
                        </LmsBadge>
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Instruksi</div>
                      {assignment?.instructions ? (
                        <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">{assignment.instructions}</div>
                      ) : (
                        <LmsNote tone="amber">Instruksi tugas belum diisi oleh pengelola kursus.</LmsNote>
                      )}
                    </LmsCard>

                    {asgNeedsRevision && lastReview && (
                      <LmsNote tone="amber">
                        <b>Catatan revisi dari {lastReview.byName || 'leader'}</b> ({fmtDateTime(lastReview.at)}):
                        <div className="whitespace-pre-wrap mt-1">{lastReview.note || '(tanpa catatan)'}</div>
                        <div className="mt-1">Silakan perbaiki lalu kirim ulang di bawah ini.</div>
                      </LmsNote>
                    )}

                    {asgApproved ? (
                      <LmsCard className="p-5 space-y-3">
                        <LmsNote tone="emerald">Tugas sudah disetujui.</LmsNote>
                        {nextLesson && (
                          <LmsPrimaryBtn icon={ArrowRight} onClick={() => goTo(nextLesson.id)} className="w-full sm:w-auto justify-center py-3">
                            Lanjut ke Materi Berikutnya
                          </LmsPrimaryBtn>
                        )}
                      </LmsCard>
                    ) : (
                      <LmsCard className="p-5 space-y-3">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {currentSub.status === 'SUBMITTED' || currentSub.status === 'UNDER_REVIEW' ? 'Kirim Ulang (opsional)' : 'Kirim Tugas'}
                        </div>

                        {(currentSub.status === 'SUBMITTED' || currentSub.status === 'UNDER_REVIEW') && (
                          <LmsNote>Tugas Anda sedang menunggu review leader. Anda masih boleh mengirim perbaikan; riwayat lama tetap tersimpan.</LmsNote>
                        )}

                        <LmsField label="Catatan Pekerjaan" hint="Jelaskan apa yang Anda kerjakan dan hasilnya.">
                          <textarea rows={4} value={asgText} onChange={e => setAsgText(e.target.value)}
                            className={inputCls} placeholder="Tulis ringkasan pekerjaan Anda di sini..." />
                        </LmsField>

                        {assignment?.needLink && (
                          <LmsField label="Link Bukti" hint="Contoh: link Google Drive, Spreadsheet, atau video.">
                            <input type="url" value={asgLink} onChange={e => setAsgLink(e.target.value)}
                              className={inputCls} placeholder="https://..." />
                          </LmsField>
                        )}

                        {assignment?.needFile && (
                          <LmsField label="Lampiran Gambar" hint="Maksimal 3 gambar. Gambar otomatis dikecilkan supaya hemat kuota.">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {asgImages.map((ref, i) => (
                                  <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
                                    <LmsImage src={ref} fetcher={lmsFetchImage} alt={`Lampiran ${i + 1}`} className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => setAsgImages(prev => prev.filter((_, x) => x !== i))}
                                      className="absolute top-1 right-1 bg-slate-900/70 text-white rounded-lg p-1"
                                      title="Hapus lampiran">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                                onChange={e => pickImages(e.target.files)} />
                              <LmsGhostBtn icon={Upload} onClick={() => fileRef.current && fileRef.current.click()}
                                disabled={imgBusy || asgImages.length >= 3} className="w-full sm:w-auto justify-center py-3">
                                {imgBusy ? 'Memproses gambar...' : 'Pilih Gambar'}
                              </LmsGhostBtn>
                            </div>
                          </LmsField>
                        )}

                        <LmsError>{asgErr}</LmsError>

                        <LmsPrimaryBtn icon={Send} onClick={sendAssignment} disabled={busy || imgBusy}
                          className="w-full sm:w-auto justify-center py-3">
                          {busy ? 'Mengirim...' : asgNeedsRevision ? 'Kirim Perbaikan' : 'Kirim Tugas'}
                        </LmsPrimaryBtn>
                      </LmsCard>
                    )}

                    {/* Garis waktu: kiriman + review, urut waktu, tidak pernah dihapus */}
                    <LmsCard className="p-5">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Riwayat Tugas</div>
                      {timeline.length === 0 ? (
                        <div className="text-sm text-slate-500">Belum ada riwayat. Kiriman pertama Anda akan tampil di sini.</div>
                      ) : (
                        <div className="space-y-3">
                          {timeline.map((t, i) => (
                            <div key={i} className="border border-slate-200/70 rounded-xl p-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {t.kind === 'kirim' ? (
                                  <LmsBadge color="bg-blue-100 text-blue-800">Dikirim</LmsBadge>
                                ) : (
                                  <LmsBadge color={(SUBMISSION_STATUS[t.decision] || SUBMISSION_STATUS.NOT_SUBMITTED).color}>
                                    {(SUBMISSION_STATUS[t.decision] || SUBMISSION_STATUS.NOT_SUBMITTED).label}
                                  </LmsBadge>
                                )}
                                <span className="text-[11px] text-slate-500">{fmtDateTime(t.at)}</span>
                                <span className="text-[11px] text-slate-500">· {t.byName || '-'}</span>
                              </div>
                              {t.kind === 'kirim' ? (
                                <div className="mt-2 space-y-2">
                                  {t.text && <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{t.text}</div>}
                                  {t.link && (
                                    <a href={t.link} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-sm text-blue-700 font-semibold break-all">
                                      <Link2 className="w-3.5 h-3.5 flex-shrink-0" /> {t.link}
                                    </a>
                                  )}
                                  {Array.isArray(t.images) && t.images.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {t.images.map((ref, xi) => (
                                        <LmsImage key={xi} src={ref} fetcher={lmsFetchImage} alt={`Lampiran ${xi + 1}`}
                                          className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                  {t.note || '(tanpa catatan)'}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </LmsCard>
                  </div>
                )}

                {/* Navigasi bawah */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <LmsGhostBtn icon={ArrowLeft} onClick={() => goTo(prevLesson?.id)} disabled={!prevLesson}
                    className="w-full sm:w-auto justify-center py-3">
                    Materi Sebelumnya
                  </LmsGhostBtn>
                  <LmsGhostBtn onClick={() => goTo(nextLesson?.id)} disabled={!nextLesson || (nextLesson && locked.has(nextLesson.id))}
                    className="w-full sm:w-auto justify-center py-3">
                    Materi Berikutnya <ArrowRight className="w-4 h-4" />
                  </LmsGhostBtn>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
