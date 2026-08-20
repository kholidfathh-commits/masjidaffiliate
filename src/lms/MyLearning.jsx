// ============================================================================
// LMS V1 — HALAMAN "PEMBELAJARAN SAYA" (karyawan)
// ----------------------------------------------------------------------------
// Halaman ini adalah PEMILIK STATE untuk alur belajar. CoursePlayer tidak memuat
// datanya sendiri: dia menerima `my={{progress, attempts, submissions}}` dan
// memanggil `reload()` setiap kali menulis sesuatu.
//
// HEMAT EGRESS (proyek pernah kena batas kuota Supabase):
//  - TIDAK ADA polling di halaman ini. Data dimuat 1x saat mount.
//  - Tombol "Muat Ulang" untuk penyegaran manual.
//  - Pembacaan milik sendiri memakai loadMy*(userId), bukan loadLms*() penuh.
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  GraduationCap, BookOpen, PlayCircle, CheckCircle2, Clock, Award, ArrowRight, RefreshCw,
  Library, Search, ArrowLeft, FileText, ExternalLink,
} from 'lucide-react';
import {
  loadLmsPaths, loadLmsCourses, loadMyEnrollments, loadMyProgress, loadMyAttempts,
  loadMySubmissions, loadMyValidations, loadLmsLibrary, loadLibraryBody,
  buildCtx, computeCourseProgress, computePathProgress, nextLessonOf,
  allLessons, courseTotalMinutes, syncEnrollmentStatus, coursePriority,
  ENROLL_STATUS, VALIDATION_STATUS,
} from './data.js';
import {
  LmsCard, LmsBadge, LmsStat, LmsProgressBar, LmsRing, LmsAccordion, LmsEmpty,
  LmsSkeleton, LmsLoading, LmsError, LmsNote, LmsPrimaryBtn, LmsGhostBtn,
  inputCls, fmtBytes,
} from './ui.jsx';
import CoursePlayer from './CoursePlayer.jsx';
import PdfReader from './PdfReader.jsx';

// Halaman terakhir modul bacaan diingat di localStorage — SENGAJA tidak masuk
// database: ini kenyamanan pribadi, bukan progres belajar, dan modul bacaan
// memang tidak boleh punya record progress apa pun.
const LIB_PAGE_KEY = (id) => 'lms-lib-lastpage:' + id;
function bacaHalamanTerakhir(id) {
  try {
    const v = Number(window.localStorage.getItem(LIB_PAGE_KEY(id)));
    return Number.isFinite(v) && v > 0 ? v : 1;
  } catch { return 1; } // mode privat / storage diblokir → mulai dari halaman 1
}
function simpanHalamanTerakhir(id, halaman) {
  try { window.localStorage.setItem(LIB_PAGE_KEY(id), String(halaman)); } catch { /* abaikan */ }
}

// ---------------------------------------------------------------- helper kecil
function fmtMinutes(m) {
  const n = Number(m) || 0;
  if (n <= 0) return '-';
  if (n < 60) return `${n} menit`;
  const h = Math.floor(n / 60);
  const s = n % 60;
  return s ? `${h} jam ${s} menit` : `${h} jam`;
}

function errText(e) {
  const m = e?.message || String(e || '');
  return m || 'Terjadi kesalahan yang tidak diketahui.';
}

export default function MyLearningView({ user, allUsers }) {
  const [paths, setPaths] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [progress, setProgress] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [validations, setValidations] = useState([]);
  const [library, setLibrary] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const [openCourse, setOpenCourse] = useState(null);
  const [startLessonId, setStartLessonId] = useState(null);
  const [openLibrary, setOpenLibrary] = useState(null);

  // Ref dipakai supaya reload() tidak perlu bergantung pada state terbaru
  // (reload dikirim ke CoursePlayer, harus stabil dan tidak basi).
  const alive = useRef(true);
  const cacheRef = useRef({ paths: [], courses: [], enrollments: [] });

  /**
   * Selaraskan status enrollment (NOT_STARTED / IN_PROGRESS / COMPLETED) dengan
   * progres nyata. syncEnrollmentStatus hanya menulis bila status BERUBAH.
   * Pengaman: jalur yang tidak punya satu pun materi wajib (kursus terhapus /
   * masih draft) DILEWATI, supaya status "Selesai" tidak pernah turun keliru.
   */
  const syncStatuses = useCallback(async (enrolls, pathList, courseList, ctx) => {
    if (!enrolls?.length || !courseList?.length) return;
    const byId = new Map(courseList.filter(c => c.status !== 'draft').map(c => [c.id, c]));
    const pathById = new Map((pathList || []).map(p => [p.id, p]));
    let changed = false;
    const next = [];
    for (const e of enrolls) {
      const p = pathById.get(e.pathId);
      if (!p) { next.push(e); continue; }
      const pp = computePathProgress(p, byId, ctx);
      if (pp.lessonsTotal === 0) { next.push(e); continue; }
      const fresh = await syncEnrollmentStatus(e, pp);
      if (fresh !== e) changed = true;
      next.push(fresh);
    }
    if (changed && alive.current) {
      cacheRef.current.enrollments = next;
      setEnrollments(next);
    }
  }, []);

  /** Muat semua data yang dibutuhkan halaman. Dipanggil saat mount + tombol manual. */
  const loadAll = useCallback(async (isFirst) => {
    if (isFirst) setLoading(true); else setRefreshing(true);
    setErr('');
    try {
      // Promise.all supaya 8 pembacaan berjalan paralel, bukan berantai.
      // Modul bacaan: hanya METADATA-nya (isi teks & PDF dimuat on-demand per modul).
      const [p, c, e, pr, at, sb, vl, lb] = await Promise.all([
        loadLmsPaths(),
        loadLmsCourses(),
        loadMyEnrollments(user.id),
        loadMyProgress(user.id),
        loadMyAttempts(user.id),
        loadMySubmissions(user.id),
        loadMyValidations(user.id),
        loadLmsLibrary(),
      ]);
      if (!alive.current) return;
      const P = p || [], C = c || [], E = e || [];
      setPaths(P); setCourses(C); setEnrollments(E);
      setProgress(pr || []); setAttempts(at || []);
      setSubmissions(sb || []); setValidations(vl || []);
      setLibrary(lb || []);
      cacheRef.current = { paths: P, courses: C, enrollments: E };
      await syncStatuses(E, P, C, buildCtx({ progress: pr || [], attempts: at || [], submissions: sb || [] }, user.id));
    } catch (ex) {
      if (alive.current) setErr('Gagal memuat data pembelajaran: ' + errText(ex) + ' Data lama tidak berubah, silakan coba muat ulang.');
    } finally {
      // WAJIB: tanpa ini halaman bisa nyangkut di "Memuat..." selamanya.
      if (alive.current) { setLoading(false); setRefreshing(false); }
    }
  }, [user.id, syncStatuses]);

  /**
   * Dipakai CoursePlayer setiap kali menulis (tandai selesai / kirim kuis / kirim tugas).
   * Hanya memuat ulang data MILIK user — kurikulum tidak ditarik ulang (hemat egress).
   */
  const reload = useCallback(async () => {
    try {
      const [pr, at, sb, vl] = await Promise.all([
        loadMyProgress(user.id),
        loadMyAttempts(user.id),
        loadMySubmissions(user.id),
        loadMyValidations(user.id),
      ]);
      if (!alive.current) return;
      setProgress(pr || []); setAttempts(at || []);
      setSubmissions(sb || []); setValidations(vl || []);
      const { paths: P, courses: C, enrollments: E } = cacheRef.current;
      await syncStatuses(E, P, C, buildCtx({ progress: pr || [], attempts: at || [], submissions: sb || [] }, user.id));
    } catch (ex) {
      if (alive.current) setErr('Gagal menyegarkan progres: ' + errText(ex) + ' Progres yang sudah tersimpan tetap aman.');
    }
  }, [user.id, syncStatuses]);

  useEffect(() => {
    alive.current = true;
    loadAll(true);
    return () => { alive.current = false; };
  }, [loadAll]);

  // ------------------------------------------------------------ turunan data
  const ctx = useMemo(
    () => buildCtx({ progress, attempts, submissions }, user.id),
    [progress, attempts, submissions, user.id]
  );

  // Kursus 'draft' TIDAK pernah terlihat oleh karyawan. Kursus 'archived' tetap
  // ada supaya riwayat belajar yang sudah berjalan tidak hilang.
  const visibleCoursesById = useMemo(() => {
    const m = new Map();
    (courses || []).forEach(c => { if (c && c.status !== 'draft') m.set(c.id, c); });
    return m;
  }, [courses]);

  const pathById = useMemo(() => new Map((paths || []).map(p => [p.id, p])), [paths]);
  const validationByPath = useMemo(() => {
    const m = new Map();
    (validations || []).forEach(v => m.set(v.pathId, v));
    return m;
  }, [validations]);

  /** Satu baris siap-render per enrollment: enrollment + jalur + progres + daftar kursus. */
  const rows = useMemo(() => {
    const list = (enrollments || []).map(e => {
      const path = pathById.get(e.pathId) || null;
      const pp = path
        ? computePathProgress(path, visibleCoursesById, ctx)
        : { percent: 0, lessonsDone: 0, lessonsTotal: 0, coursesDone: 0, coursesTotal: 0, completed: false };
      const entries = [...(path?.courses || [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(en => {
          const course = visibleCoursesById.get(en.courseId);
          if (!course) return null;
          return { entry: en, course, prog: computeCourseProgress(course, ctx) };
        })
        .filter(Boolean);
      const current = entries.find(x => !x.prog.completed) || null;
      return { enroll: e, path, pp, entries, current, validation: validationByPath.get(e.pathId) || null };
    });
    // Yang belum selesai tampil lebih dulu, lalu jalur terbaru di atas.
    list.sort((a, b) => {
      if (a.pp.completed !== b.pp.completed) return a.pp.completed ? 1 : -1;
      return String(b.enroll.assignedAt || '').localeCompare(String(a.enroll.assignedAt || ''));
    });
    return list;
  }, [enrollments, pathById, visibleCoursesById, ctx, validationByPath]);

  const summary = useMemo(() => {
    const total = rows.length;
    const done = rows.filter(r => r.pp.completed).length;
    const running = rows.filter(r => !r.pp.completed && r.pp.lessonsDone > 0).length;
    const avg = total === 0 ? 0 : Math.round(rows.reduce((s, r) => s + r.pp.percent, 0) / total);
    return { total, done, running, avg };
  }, [rows]);

  // ------------------------------------------------------------------ aksi
  const openCourseAt = (course, lessonId) => {
    setStartLessonId(lessonId || null);
    setOpenCourse(course);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const continueLearning = (row) => {
    const target = row.current || row.entries[0];
    if (!target) return;
    const next = nextLessonOf(target.course, ctx);
    openCourseAt(target.course, next?.id || null);
  };

  // -------------------------------------------------------------- render
  // Pemutar kursus menggantikan SELURUH isi halaman (bukan modal) supaya
  // layar HP tidak sempit dan materi panjang enak dibaca.
  if (openCourse) {
    return (
      <CoursePlayer
        user={user}
        course={openCourse}
        startLessonId={startLessonId}
        my={{ progress, attempts, submissions }}
        reload={reload}
        onBack={() => setOpenCourse(null)}
      />
    );
  }

  // Pembaca modul bacaan juga menggantikan seluruh isi halaman (bukan modal) —
  // alasan yang sama seperti pemutar kursus: enak dibaca di layar HP.
  if (openLibrary) {
    // key = id modul: pembaca dipasang ulang tiap ganti modul, supaya halaman terakhir
    // dan isi bacaannya tidak terbawa dari modul sebelumnya.
    return <LibraryReader key={openLibrary.id} item={openLibrary} onBack={() => setOpenLibrary(null)} />;
  }

  return (
    <div className="max-w-5xl">
      {/* Kepala halaman (meniru PageHeader app induk, tanpa mengimpor App.jsx) */}
      <div className="flex items-end justify-between mb-6 gap-3 flex-wrap pb-4 border-b border-slate-200/60">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">Pembelajaran Saya</h1>
          <p className="text-sm text-slate-500 mt-1.5">Jalur belajar yang ditugaskan untuk Anda beserta progresnya.</p>
        </div>
        <LmsGhostBtn icon={RefreshCw} onClick={() => loadAll(false)} disabled={loading || refreshing}>
          {refreshing ? 'Memuat...' : 'Muat Ulang'}
        </LmsGhostBtn>
      </div>

      {err && <div className="mb-4"><LmsError>{err}</LmsError></div>}

      {loading ? (
        <LmsSkeleton rows={3} />
      ) : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <LmsStat label="Jalur Ditugaskan" value={summary.total} icon={GraduationCap} tone="blue" />
            <LmsStat label="Selesai" value={summary.done} icon={CheckCircle2} tone="emerald" />
            <LmsStat label="Sedang Berjalan" value={summary.running} icon={PlayCircle} tone="amber" />
            <LmsStat label="Progres Keseluruhan" value={`${summary.avg}%`} icon={Award} tone="blue"
              sub="rata-rata semua jalur" />
          </div>

          {rows.length === 0 ? (
            <LmsEmpty
              icon={GraduationCap}
              title="Belum ada pembelajaran yang diberikan."
              text="Jalur belajar diberikan otomatis sesuai divisi dan jabatan Anda. Jika menurut Anda seharusnya sudah ada, hubungi leader atau manajer."
            />
          ) : (
            <div className="space-y-4">
              {rows.map(row => (
                <PathCard
                  key={row.enroll.id}
                  row={row}
                  ctx={ctx}
                  onContinue={() => continueLearning(row)}
                  onOpenCourse={(course) => openCourseAt(course, nextLessonOf(course, ctx)?.id || null)}
                />
              ))}
            </div>
          )}

          {/* Perpustakaan internal — di BAWAH jalur belajar karena sifatnya sunnah. */}
          <LibrarySection modules={library} onOpen={(m) => {
            setOpenLibrary(m);
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
          }} />
        </>
      )}
    </div>
  );
}

// ============================================================================
// MODUL BACAAN — daftar (sifatnya SUNNAH)
// ----------------------------------------------------------------------------
// TANPA enrollment, TANPA progress, dan tidak pernah mempengaruhi persen jalur
// belajar mana pun. Datanya ikut dimuat sekali bersama halaman + tombol Muat Ulang
// yang sudah ada — tidak ada polling baru.
// ============================================================================
function LibrarySection({ modules, onOpen }) {
  const [cari, setCari] = useState('');

  const terbit = useMemo(
    () => (modules || [])
      .filter(m => m && m.status === 'published')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [modules]
  );

  // Penyaringan di sisi KLIEN (judul + kategori) — tidak menambah pembacaan server.
  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return terbit;
    return terbit.filter(m =>
      String(m.title || '').toLowerCase().includes(q)
      || String(m.category || '').toLowerCase().includes(q));
  }, [terbit, cari]);

  if (terbit.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3 pb-3 border-b border-slate-200/60">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Library className="w-5 h-5 text-slate-400" /> Modul Bacaan
          </h2>
          <p className="text-[13px] text-slate-500 mt-1">
            <b>Sunnah</b> — bacaan bebas, tidak mempengaruhi progres belajar Anda.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={inputCls + ' pl-9'}
            value={cari}
            onChange={e => setCari(e.target.value)}
            placeholder="Cari judul atau kategori..."
          />
        </div>
      </div>

      {hasil.length === 0 ? (
        <LmsNote tone="slate">Tidak ada modul bacaan yang cocok dengan pencarian "{cari}".</LmsNote>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {hasil.map(m => (
            <button key={m.id} type="button" onClick={() => onOpen(m)}
              className="text-left bg-white rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-200/40 p-4 hover:bg-slate-50/70 transition">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  {m.type === 'text' ? <FileText className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{m.title || '(Tanpa judul)'}</span>
                    {m.category && <LmsBadge color="bg-blue-100 text-blue-800">{m.category}</LmsBadge>}
                  </div>
                  {m.description && (
                    <p className="text-[12px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{m.description}</p>
                  )}
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    {m.type === 'text' ? 'Bacaan teks' : 'Berkas PDF'}
                    {m.type !== 'text' && Number(m.pdfSize) > 0 ? ' · ' + fmtBytes(m.pdfSize) : ''}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODUL BACAAN — pembaca
// ----------------------------------------------------------------------------
// TIDAK menulis progres apa pun ke database. Yang diingat cuma halaman terakhir,
// dan itu pun hanya di localStorage perangkat peserta.
// ============================================================================
function LibraryReader({ item, onBack }) {
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(item.type === 'text');
  const [errBody, setErrBody] = useState('');
  const [nonce, setNonce] = useState(0);
  const [halaman, setHalaman] = useState(() => bacaHalamanTerakhir(item.id));

  useEffect(() => {
    if (item.type !== 'text') return;
    let alive = true;
    setLoading(true); setErrBody('');
    (async () => {
      try {
        const b = await loadLibraryBody(item.id, nonce > 0);
        if (alive) setBody(b || '');
      } catch {
        // Gagal baca != isi kosong — pembaca harus tahu bedanya.
        if (alive) { setBody(''); setErrBody('Isi bacaan gagal dimuat. Coba tekan "Muat Ulang Isi".'); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [item.id, item.type, nonce]);

  const catatHalaman = (n) => {
    setHalaman(n);
    simpanHalamanTerakhir(item.id, n);
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-slate-200/60">
        <button type="button" onClick={onBack}
          className="mt-1 p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition flex-shrink-0"
          title="Kembali ke daftar bacaan">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{item.title}</h1>
            {item.category && <LmsBadge color="bg-blue-100 text-blue-800">{item.category}</LmsBadge>}
            <LmsBadge color="bg-emerald-100 text-emerald-800">Sunnah</LmsBadge>
          </div>
          {item.description && <p className="text-sm text-slate-500 mt-1.5">{item.description}</p>}
        </div>
      </div>

      <LmsCard className="p-5 space-y-4">
        {item.type === 'text' ? (
          loading ? (
            <LmsLoading text="Memuat isi bacaan..." />
          ) : errBody ? (
            <>
              <LmsError>{errBody}</LmsError>
              <LmsGhostBtn onClick={() => setNonce(n => n + 1)}>Muat Ulang Isi</LmsGhostBtn>
            </>
          ) : body ? (
            <>
              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">{body}</div>
              <LmsGhostBtn onClick={() => setNonce(n => n + 1)}>Muat Ulang Isi</LmsGhostBtn>
            </>
          ) : (
            <LmsNote tone="slate">Isi bacaan masih kosong. Hubungi pengelola pembelajaran.</LmsNote>
          )
        ) : item.pdfUrl ? (
          <>
            {/* Komponen yang sama dengan materi PDF di kursus — bedanya di sini
                TIDAK ada satu pun penulisan progres. */}
            <PdfReader url={item.pdfUrl} initialPage={halaman} onPageView={catatHalaman} />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500 truncate">{item.pdfName || 'Berkas PDF'}</span>
              <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
                <ExternalLink className="w-4 h-4" /> Buka di tab baru
              </a>
            </div>
            <LmsNote tone="slate">
              Halaman terakhir yang Anda buka diingat di perangkat ini, jadi enak dibuka bolak-balik.
              Bacaan ini tidak dinilai dan tidak mempengaruhi progres belajar Anda.
            </LmsNote>
          </>
        ) : (
          <LmsNote tone="amber">Berkas bacaan belum tersedia. Hubungi pengelola pembelajaran.</LmsNote>
        )}

        <LmsGhostBtn icon={ArrowLeft} onClick={onBack}>Kembali ke Daftar Bacaan</LmsGhostBtn>
      </LmsCard>
    </div>
  );
}

// ============================================================================
// Kartu satu jalur belajar
// ============================================================================
function PathCard({ row, ctx, onContinue, onOpenCourse }) {
  const { enroll, path, pp, entries, current, validation } = row;
  const st = ENROLL_STATUS[enroll.status] || ENROLL_STATUS.NOT_STARTED;
  const vs = validation ? (VALIDATION_STATUS[validation.status] || null) : null;
  const tone = pp.completed ? 'emerald' : 'blue';

  // Jalur yang recordnya sudah tidak ada (dihapus admin) tetap ditampilkan
  // supaya karyawan tidak bingung kenapa daftarnya berkurang.
  if (!path) {
    return (
      <LmsCard className="p-5">
        <div className="font-display font-bold text-slate-800">{enroll.pathTitle || 'Jalur belajar'}</div>
        <div className="mt-2">
          <LmsNote tone="slate">
            Jalur belajar ini sudah tidak tersedia. Riwayat Anda tetap tersimpan. Silakan tanyakan ke leader Anda.
          </LmsNote>
        </div>
      </LmsCard>
    );
  }

  const waitingValidation = pp.completed && (!validation || validation.status === 'PENDING');

  return (
    <LmsCard className="p-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-slate-900 text-base sm:text-lg leading-snug">{path.title}</h3>
            <LmsBadge color={st.color}>{st.label}</LmsBadge>
            {vs && <LmsBadge color={vs.color}>{vs.label}</LmsBadge>}
          </div>
          {path.description && (
            <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{path.description}</p>
          )}
        </div>
        <LmsRing percent={pp.percent} size={52} tone={tone} />
      </div>

      <div className="mt-4">
        <LmsProgressBar percent={pp.percent} tone={tone} height={10} />
        <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
          <span className="text-[12px] text-slate-600 font-semibold">
            {pp.lessonsDone} / {pp.lessonsTotal} materi selesai
          </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {pp.coursesDone} / {pp.coursesTotal} kursus tuntas
          </span>
        </div>
      </div>

      {/* Kursus yang sedang dijalani */}
      {!pp.completed && current && (
        <div className="mt-3 text-[12px] text-slate-600">
          Sedang berjalan: <span className="font-semibold text-slate-800">{current.course.title}</span>
        </div>
      )}

      {waitingValidation && (
        <div className="mt-3">
          <LmsNote tone="amber">Menunggu validasi leader.</LmsNote>
        </div>
      )}

      {validation?.status === 'NEEDS_IMPROVEMENT' && (
        <div className="mt-3">
          <LmsNote tone="amber">
            Leader menandai jalur ini <b>Perlu Pembinaan</b>.
            {validation.notes ? <> Catatan: {validation.notes}</> : null}
          </LmsNote>
        </div>
      )}
      {validation?.status === 'COMPETENT' && (
        <div className="mt-3">
          <LmsNote tone="emerald">
            Anda dinyatakan <b>Kompeten</b> pada jalur ini oleh {validation.validatorName || 'leader'}.
          </LmsNote>
        </div>
      )}

      {/* Tombol utama — besar dan penuh di HP */}
      {entries.length > 0 && !pp.completed && (
        <div className="mt-4">
          <LmsPrimaryBtn icon={ArrowRight} onClick={onContinue}
            className="w-full sm:w-auto justify-center py-3 text-[15px]">
            LANJUTKAN BELAJAR
          </LmsPrimaryBtn>
        </div>
      )}

      {entries.length === 0 && (
        <div className="mt-4">
          <LmsNote tone="slate">
            Materi jalur ini belum diterbitkan. Silakan cek lagi nanti atau tanyakan ke leader Anda.
          </LmsNote>
        </div>
      )}

      {/* Daftar kursus di dalam jalur */}
      {entries.length > 0 && (
        <div className="mt-4">
          <LmsAccordion
            title="Daftar Kursus"
            subtitle={`${entries.length} kursus dalam jalur ini`}
            defaultOpen={!pp.completed}
          >
            <div className="space-y-2 mt-2">
              {entries.map(({ entry, course, prog }) => (
                <CourseRow
                  key={course.id}
                  course={course}
                  prog={prog}
                  required={entry.required !== false}
                  onOpen={() => onOpenCourse(course)}
                />
              ))}
            </div>
          </LmsAccordion>
        </div>
      )}
    </LmsCard>
  );
}

// ============================================================================
// Satu baris kursus
// ============================================================================
function CourseRow({ course, prog, required, onOpen }) {
  const lessons = allLessons(course);
  const minutes = courseTotalMinutes(course);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/70 bg-slate-50/40">
      <LmsRing percent={prog.percent} size={42} tone={prog.completed ? 'emerald' : 'blue'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-800 text-sm">{course.title}</span>
          {/* Kursus lama tanpa field priority otomatis tampil sebagai "Wajib". */}
          <LmsBadge color={coursePriority(course).color}>{coursePriority(course).label}</LmsBadge>
          {course.status === 'archived' && <LmsBadge color="bg-amber-100 text-amber-800">Diarsipkan</LmsBadge>}
          {!required && <LmsBadge color="bg-slate-100 text-slate-600">Opsional</LmsBadge>}
          {prog.completed && <LmsBadge color="bg-emerald-100 text-emerald-800">Selesai</LmsBadge>}
        </div>
        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {lessons.length} materi</span>
          {minutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtMinutes(minutes)}</span>}
          <span>{prog.done}/{prog.total} wajib selesai</span>
        </div>
      </div>
      <LmsGhostBtn icon={PlayCircle} onClick={onOpen} className="flex-shrink-0 py-2.5">
        Buka
      </LmsGhostBtn>
    </div>
  );
}
