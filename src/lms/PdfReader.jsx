// ============================================================================
// LMS — PEMBACA PDF DI DALAM APLIKASI
// ----------------------------------------------------------------------------
// Dipakai dua tempat: materi kursus bertipe `pdf` (CoursePlayer) dan Modul Bacaan
// (MyLearning). Komponen ini SENGAJA "bodoh": dia hanya menampilkan halaman dan
// melaporkan halaman mana yang sedang dibuka lewat `onPageView`. Yang memutuskan
// apakah itu disimpan sebagai progres (kursus) atau cuma diingat di localStorage
// (modul bacaan) adalah pemanggilnya.
//
// ATURAN yang dipegang file ini:
//  1. HEMAT BUNDLE — pdfjs-dist di-import DINAMIS, jadi kodenya baru diunduh saat
//     ada PDF yang benar-benar dibuka. Bundle utama app tidak ikut membengkak.
//  2. HEMAT EGRESS — PDF diambil langsung dari URL Supabase Storage (CDN, cache
//     1 tahun). Tidak pernah lewat database.
//  3. AMAN DI HP — satu halaman per layar, lebar canvas mengikuti lebar container.
//  4. TIDAK ADA JALAN BUNTU — kegagalan menggambar SATU halaman tidak boleh
//     mematikan pembaca: canvas & tombol navigasi tetap ada, pesan errornya hilang
//     begitu halaman lain berhasil digambar, dan selalu ada tautan "buka di tab baru"
//     dari pemanggil.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

// pdfjs-dist v4 memakai Promise.withResolvers (baru ada di Chrome 119 / Safari 17.4).
// Sebagian HP tim bisa saja masih memakai browser lama → tambalan kecil ini mencegah
// pemutar mati total di thread utama. (Kalau worker-nya yang tidak sanggup, pesan
// error tetap muncul rapi dan peserta bisa memakai tautan "buka di tab baru".)
if (typeof Promise !== 'undefined' && typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

// Dimuat SEKALI per sesi, on-demand. Kalau gagal, cache-nya dibuang supaya
// percobaan berikutnya benar-benar mencoba lagi (bukan mengulang error lama).
let _pdfjs = null;
function getPdfjs() {
  if (!_pdfjs) {
    _pdfjs = (async () => {
      const lib = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    })().catch(err => { _pdfjs = null; throw err; });
  }
  return _pdfjs;
}

/**
 * @param {string}   url         URL publik PDF (Supabase Storage).
 * @param {number}   initialPage Halaman awal (dipakai "lanjutkan membaca").
 * @param {function} onPageView  (halaman, totalHalaman) — dipanggil tiap halaman ditampilkan.
 * @param {string}   className   kelas tambahan untuk pembungkus.
 */
export default function PdfReader({ url, initialPage = 1, onPageView, className = '' }) {
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Math.max(1, Number(initialPage) || 1));
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [err, setErr] = useState('');          // gagal MEMUAT dokumen (fatal)
  const [pageErr, setPageErr] = useState('');  // gagal menggambar 1 halaman (bisa pulih)

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const docRef = useRef(null);
  const loadTaskRef = useRef(null);   // PDFDocumentLoadingTask — WAJIB dibuang, kalau tidak worker-nya bocor
  const taskRef = useRef(null);       // RenderTask yang sedang berjalan
  const pageObjRef = useRef(null);    // PDFPageProxy terakhir → di-cleanup saat ganti halaman
  const seqRef = useRef(0);           // nomor urut render; hasil yang basi dibuang
  const widthRef = useRef(0);
  // initialPage hanya dipakai saat dokumen dibuka — disimpan di ref supaya perubahan
  // prop (mis. halaman terakhir ikut bergerak saat membaca) tidak memuat ulang dokumen.
  const initialPageRef = useRef(initialPage);
  initialPageRef.current = initialPage;
  const onPageViewRef = useRef(onPageView);
  useEffect(() => { onPageViewRef.current = onPageView; }, [onPageView]);

  // ---------------------------------------------------------- muat dokumen
  useEffect(() => {
    let alive = true;
    seqRef.current++;                       // batalkan semua hasil render dokumen lama
    setLoading(true); setErr(''); setPageErr(''); setTotal(0);
    setPage(Math.max(1, Number(initialPageRef.current) || 1));
    docRef.current = null;
    (async () => {
      try {
        if (!url) throw new Error('Berkas PDF belum tersedia.');
        const pdfjs = await getPdfjs();
        if (!alive) return;
        const tugas = pdfjs.getDocument({ url });
        loadTaskRef.current = tugas;
        const doc = await tugas.promise;
        if (!alive) { try { tugas.destroy(); } catch { /* abaikan */ } return; }
        docRef.current = doc;
        setTotal(doc.numPages);
        setPage(p => Math.min(Math.max(1, p), doc.numPages));
      } catch (e) {
        if (alive) setErr('PDF gagal dimuat: ' + (e?.message || e) + '.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      seqRef.current++;
      try { taskRef.current?.cancel(); } catch { /* abaikan */ }
      taskRef.current = null;
      // destroy() pada loading task ikut menutup Web Worker-nya (±1,4 MB per dokumen).
      // Ini juga membatalkan unduhan yang masih berjalan saat peserta menutup materi.
      try { loadTaskRef.current?.destroy(); } catch { /* abaikan */ }
      loadTaskRef.current = null;
      docRef.current = null;
      pageObjRef.current = null;
    };
  }, [url]);

  // ------------------------------------------------------- gambar 1 halaman
  const renderPage = useCallback(async (nomor) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!doc || !canvas || !wrap) return;
    // Nomor urut: setiap permintaan baru membatalkan hasil permintaan sebelumnya.
    // Tanpa ini, dua render bisa sampai di canvas yang sama (pdf.js melempar
    // "Cannot use the same canvas during multiple render() operations") karena
    // `taskRef` baru terisi SETELAH await getPage — ada jendela di mana ia masih null.
    const seq = ++seqRef.current;
    try { taskRef.current?.cancel(); } catch { /* abaikan */ }
    taskRef.current = null;
    setRendering(true);
    try {
      const p = await doc.getPage(nomor);
      if (seq !== seqRef.current) return;               // sudah tersalip permintaan lain
      const dasar = p.getViewport({ scale: 1 });
      const lebar = Math.max(240, wrap.clientWidth || 320);
      widthRef.current = lebar;
      // devicePixelRatio dibatasi 2 supaya canvas tidak jadi raksasa di HP ber-DPR tinggi.
      const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      const vp = p.getViewport({ scale: (lebar / dasar.width) * dpr });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      const cx = canvas.getContext('2d');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, canvas.width, canvas.height);
      const task = p.render({ canvasContext: cx, viewport: vp });
      taskRef.current = task;
      await task.promise;
      if (seq !== seqRef.current) return;
      taskRef.current = null;
      // Lepas memori halaman SEBELUMNYA (PDF ratusan halaman bisa menumpuk).
      const lama = pageObjRef.current;
      pageObjRef.current = p;
      if (lama && lama !== p) { try { lama.cleanup(); } catch { /* abaikan */ } }
      setPageErr('');   // halaman ini berhasil → pesan error lama tidak boleh menetap
    } catch (e) {
      // Pembatalan itu normal (pindah halaman cepat / ganti ukuran) — bukan error.
      if (seq === seqRef.current && e?.name !== 'RenderingCancelledException') {
        setPageErr('Halaman ' + nomor + ' gagal ditampilkan: ' + (e?.message || e) + '.');
      }
    } finally {
      // Hanya permintaan TERBARU yang boleh mematikan indikator, supaya render yang
      // dibatalkan tidak menghapus indikator milik render yang masih berjalan.
      if (seq === seqRef.current) setRendering(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !err && total > 0) renderPage(page);
  }, [page, total, loading, err, renderPage]);

  // Lapor halaman yang sedang dibuka — pemanggil yang memutuskan mau diapakan.
  useEffect(() => {
    if (total > 0) onPageViewRef.current?.(page, total);
  }, [page, total]);

  // Gambar ulang saat lebar container berubah (putar HP / buka-tutup sidebar).
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !wrapRef.current) return;
    let timer = null;
    const ro = new ResizeObserver(() => {
      const lebar = wrapRef.current?.clientWidth || 0;
      // Saat pertama kali dipasang widthRef masih 0; catat saja lebarnya tanpa
      // menggambar ulang — render pertama sudah dijalankan efek di atas.
      if (!widthRef.current) { widthRef.current = lebar; return; }
      // Abaikan getaran kecil: menggambar ulang PDF itu mahal.
      if (Math.abs(lebar - widthRef.current) < 24) return;
      clearTimeout(timer);
      timer = setTimeout(() => { if (docRef.current) renderPage(page); }, 180);
    });
    ro.observe(wrapRef.current);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [page, renderPage]);

  const goto = (n) => {
    if (!total) return;
    setPage(Math.min(Math.max(1, n), total));
  };

  return (
    <div className={className}>
      {/* Gagal menggambar SATU halaman tampil sebagai spanduk di atas — canvas dan
          tombol navigasi tetap hidup supaya peserta bisa pindah ke halaman lain. */}
      {pageErr && !err && (
        <div className="flex items-start gap-2 p-3 mb-2 text-sm text-amber-900 bg-amber-50/70 border border-amber-200 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{pageErr} Coba halaman lain, atau buka berkasnya di tab baru lewat tautan di bawah.</span>
        </div>
      )}

      <div ref={wrapRef} className="w-full rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan PDF...
          </div>
        ) : err ? (
          <div className="flex items-start gap-2 p-4 text-sm text-red-700 bg-red-50">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{err} Silakan buka berkasnya di tab baru lewat tautan di bawah.</span>
          </div>
        ) : (
          <div className="relative">
            <canvas ref={canvasRef} className="block w-full" />
            {rendering && (
              <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Memuat
              </div>
            )}
          </div>
        )}
      </div>

      {!err && total > 0 && (
        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <button type="button" onClick={() => goto(page - 1)} disabled={page <= 1}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-sm disabled:opacity-40 hover:bg-slate-50 transition">
            <ChevronLeft className="w-4 h-4" /> Sebelumnya
          </button>
          <span className="text-[12px] font-semibold text-slate-600">Halaman {page} dari {total}</span>
          <button type="button" onClick={() => goto(page + 1)} disabled={page >= total}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-sm disabled:opacity-40 hover:bg-slate-50 transition">
            Berikutnya <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
