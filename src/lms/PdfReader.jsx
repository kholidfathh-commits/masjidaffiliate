// ============================================================================
// LMS — PEMBACA PDF TERPROTEKSI DI DALAM APLIKASI
// ----------------------------------------------------------------------------
// Dipakai tiga tempat: materi kursus bertipe `pdf` (CoursePlayer), Modul Bacaan
// (MyLearning), dan pratinjau admin (LearningAdmin).
//
// MODEL PROTEKSINYA (jujur, supaya tidak ada yang salah paham):
//  1. Berkas ada di bucket Supabase Storage yang PRIVAT. URL objeknya tidak bisa
//     dibuka langsung — dicoba di incognito pun gagal.
//  2. Aplikasi meminta signed URL berumur 10 menit, lalu SEGERA menariknya jadi
//     ArrayBuffer. URL itu tidak pernah masuk href/iframe/window.open, tidak
//     pernah tersimpan di state, dan tidak dipakai lagi setelah berkas di memori —
//     jadi masa berlakunya tidak pernah mengganggu peserta yang sedang membaca.
//  3. Halaman digambar ke <canvas>, bukan <iframe>/<embed>. Tidak ada toolbar
//     bawaan browser, tidak ada tombol unduh atau cetak.
//  4. Watermark identitas pembaca digambar LANGSUNG ke canvas yang sama, jadi
//     tidak bisa dihapus lewat inspect element.
//  5. Klik kanan, seleksi teks, Ctrl/Cmd+S dan Ctrl/Cmd+P dimatikan di area ini.
//
// YANG TIDAK BISA DICEGAH: screenshot. Itu sebabnya watermark identitas WAJIB —
// kalau berkas tersebar, ketahuan tersebar lewat siapa.
//
// ATURAN app lain yang dipegang file ini:
//  - HEMAT BUNDLE: pdfjs-dist di-import DINAMIS (baru diunduh saat ada PDF dibuka).
//  - HEMAT EGRESS: berkas ditarik SEKALI per pembukaan, tidak ada polling.
//  - TIDAK ADA JALAN BUNTU: gagal menggambar satu halaman tidak mematikan pembaca.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, ZoomIn, ZoomOut, ShieldCheck } from 'lucide-react';
import { loadLmsFileBytes } from './data.js';
import { LmsAreaTerlindungi, useKunciSimpanCetak } from './ui.jsx';

// pdfjs-dist v4 memakai Promise.withResolvers (baru ada di Chrome 119 / Safari 17.4).
// Sebagian HP tim bisa saja masih memakai browser lama → tambalan kecil ini mencegah
// pemutar mati total di thread utama.
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

// Zoom: 1 = pas lebar layar (fit-width).
const ZOOM_MIN = 0.6;
const ZOOM_MAKS = 3;
const ZOOM_LANGKAH = 0.25;

/**
 * Gambar watermark identitas MENYATU ke canvas, setelah halaman selesai dirender.
 * Pola grid diagonal berulang supaya tetap terbaca di potongan screenshot mana pun,
 * dengan opacity rendah supaya tidak mengganggu membaca.
 */
function gambarWatermark(cx, lebar, tinggi, teks) {
  if (!teks) return;
  cx.save();
  cx.globalAlpha = 0.12;
  cx.fillStyle = '#0B1120';
  // Ukuran huruf ikut lebar canvas supaya proporsinya sama di HP maupun desktop.
  const ukuran = Math.max(13, Math.round(lebar / 42));
  cx.font = '600 ' + ukuran + 'px Inter, system-ui, -apple-system, sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  const lebarTeks = cx.measureText(teks).width;
  const jarakX = Math.max(lebarTeks * 1.25, lebar / 2);
  const jarakY = Math.max(ukuran * 7, tinggi / 6);
  cx.translate(lebar / 2, tinggi / 2);
  cx.rotate(-Math.PI / 6);           // miring ~30 derajat
  cx.translate(-lebar / 2, -tinggi / 2);
  // Digambar melebihi batas canvas supaya sudut-sudutnya tetap tertutup walau diputar.
  for (let y = -tinggi; y < tinggi * 2; y += jarakY) {
    for (let x = -lebar; x < lebar * 2; x += jarakX) {
      cx.fillText(teks, x, y);
    }
  }
  cx.restore();
}

/**
 * @param {{pdfPath?:string, pdfUrl?:string, pdfName?:string}} berkas  Sumber berkas.
 * @param {{nama?:string, id?:string}} pembaca  Identitas untuk watermark.
 * @param {number}   initialPage  Halaman awal (dipakai "lanjutkan membaca").
 * @param {function} onPageView   (halaman, totalHalaman) tiap halaman ditampilkan.
 * @param {function} onBlokir     Dipanggil saat aksi salin/simpan/cetak ditahan.
 * @param {string}   className    Kelas tambahan untuk pembungkus.
 */
export default function PdfReader({ berkas, pembaca, initialPage = 1, onPageView, onBlokir, className = '' }) {
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Math.max(1, Number(initialPage) || 1));
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [err, setErr] = useState('');          // gagal MEMUAT dokumen (fatal)
  const [pageErr, setPageErr] = useState('');  // gagal menggambar 1 halaman (bisa pulih)

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const docRef = useRef(null);
  const taskRef = useRef(null);       // RenderTask yang sedang berjalan
  const pageObjRef = useRef(null);    // PDFPageProxy terakhir → di-cleanup saat ganti halaman
  const seqRef = useRef(0);           // nomor urut render; hasil yang basi dibuang
  const widthRef = useRef(0);

  // Kunci Ctrl/Cmd+S & Ctrl/Cmd+P selama pembaca ini terbuka.
  useKunciSimpanCetak(true, onBlokir);

  const teksWatermark = [
    (pembaca?.nama || '').trim(),
    (pembaca?.id || '').trim(),
    'Al-Kahfi Corp',
  ].filter(Boolean).join('  •  ');
  const watermarkRef = useRef(teksWatermark);
  watermarkRef.current = teksWatermark;

  // Sumber berkas dipegang di ref: objek prop-nya bisa saja identitas baru tiap
  // render, dan itu tidak boleh memicu pengunduhan ulang.
  const path = String(berkas?.pdfPath || '').trim();
  const urlLama = String(berkas?.pdfUrl || '').trim();
  const kunciBerkas = path || urlLama;

  // initialPage hanya dipakai saat dokumen dibuka.
  const initialPageRef = useRef(initialPage);
  initialPageRef.current = initialPage;
  const onPageViewRef = useRef(onPageView);
  useEffect(() => { onPageViewRef.current = onPageView; }, [onPageView]);

  // ---------------------------------------------------------- muat dokumen
  useEffect(() => {
    let alive = true;
    seqRef.current++;                       // batalkan semua hasil render dokumen lama
    setLoading(true); setErr(''); setPageErr(''); setTotal(0); setZoom(1);
    setPage(Math.max(1, Number(initialPageRef.current) || 1));
    docRef.current = null;
    let tugas = null;
    (async () => {
      try {
        if (!kunciBerkas) throw new Error('Berkas PDF belum tersedia.');
        const pdfjs = await getPdfjs();
        if (!alive) return;
        // Signed URL diminta DI SINI lalu langsung dikonsumsi jadi bytes.
        const bytes = await loadLmsFileBytes({ pdfPath: path, pdfUrl: urlLama });
        if (!alive) return;
        tugas = pdfjs.getDocument({ data: bytes });
        const doc = await tugas.promise;
        if (!alive) { try { tugas.destroy(); } catch { /* abaikan */ } return; }
        docRef.current = doc;
        setTotal(doc.numPages);
        setPage(p => Math.min(Math.max(1, p), doc.numPages));
      } catch (e) {
        if (alive) setErr('Berkas gagal dibuka: ' + (e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      seqRef.current++;
      try { taskRef.current?.cancel(); } catch { /* abaikan */ }
      taskRef.current = null;
      // destroy() ikut menutup Web Worker-nya (±1,4 MB per dokumen) dan
      // membuang salinan berkas dari memori begitu pembaca ditutup.
      try { tugas?.destroy(); } catch { /* abaikan */ }
      docRef.current = null;
      pageObjRef.current = null;
    };
  }, [kunciBerkas, path, urlLama]);

  // ------------------------------------------------------- gambar 1 halaman
  const renderPage = useCallback(async (nomor, skala) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!doc || !canvas || !wrap) return;
    // Nomor urut: setiap permintaan baru membatalkan hasil permintaan sebelumnya.
    // Tanpa ini dua render bisa sampai di canvas yang sama dan pdf.js melempar
    // "Cannot use the same canvas during multiple render() operations".
    const seq = ++seqRef.current;
    try { taskRef.current?.cancel(); } catch { /* abaikan */ }
    taskRef.current = null;
    setRendering(true);
    try {
      const p = await doc.getPage(nomor);
      if (seq !== seqRef.current) return;
      const dasar = p.getViewport({ scale: 1 });
      const lebarPas = Math.max(240, wrap.clientWidth || 320);
      widthRef.current = lebarPas;
      const lebar = lebarPas * skala;
      // devicePixelRatio dibatasi 2 supaya canvas tidak jadi raksasa di HP ber-DPR tinggi.
      const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      const vp = p.getViewport({ scale: (lebar / dasar.width) * dpr });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = Math.round(lebar) + 'px';
      canvas.style.height = 'auto';
      const cx = canvas.getContext('2d');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, canvas.width, canvas.height);
      const task = p.render({ canvasContext: cx, viewport: vp });
      taskRef.current = task;
      await task.promise;
      if (seq !== seqRef.current) return;
      taskRef.current = null;
      // WATERMARK digambar SETELAH halaman selesai, ke canvas yang SAMA.
      gambarWatermark(cx, canvas.width, canvas.height, watermarkRef.current);
      // Lepas memori halaman sebelumnya (PDF ratusan halaman bisa menumpuk).
      const lama = pageObjRef.current;
      pageObjRef.current = p;
      if (lama && lama !== p) { try { lama.cleanup(); } catch { /* abaikan */ } }
      setPageErr('');
    } catch (e) {
      // Pembatalan itu normal (pindah halaman cepat / ganti ukuran) — bukan error.
      if (seq === seqRef.current && e?.name !== 'RenderingCancelledException') {
        setPageErr('Halaman ' + nomor + ' gagal ditampilkan: ' + (e?.message || e) + '.');
      }
    } finally {
      if (seq === seqRef.current) setRendering(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !err && total > 0) renderPage(page, zoom);
  }, [page, zoom, total, loading, err, renderPage]);

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
      if (!widthRef.current) { widthRef.current = lebar; return; }
      if (Math.abs(lebar - widthRef.current) < 24) return;   // abaikan getaran kecil
      clearTimeout(timer);
      timer = setTimeout(() => { if (docRef.current) renderPage(page, zoom); }, 180);
    });
    ro.observe(wrapRef.current);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [page, zoom, renderPage]);

  const goto = (n) => { if (total) setPage(Math.min(Math.max(1, n), total)); };
  const ubahZoom = (delta) => setZoom(z => {
    const next = Math.round((z + delta) * 100) / 100;
    return Math.min(ZOOM_MAKS, Math.max(ZOOM_MIN, next));
  });

  return (
    <div className={className}>
      {/* Yang tercetak kalau ada yang memaksa lewat menu File → Print browser. */}
      <div className="lms-terlindungi-cetak text-sm text-slate-700">
        Materi ini hanya bisa dibaca di dalam aplikasi Al-Kahfi Team.
      </div>

      <LmsAreaTerlindungi onBlokir={onBlokir}>
        {/* Gagal menggambar SATU halaman tampil sebagai spanduk — canvas dan tombol
            navigasi tetap hidup supaya peserta bisa pindah ke halaman lain. */}
        {pageErr && !err && (
          <div className="flex items-start gap-2 p-3 mb-2 text-sm text-amber-900 bg-amber-50/70 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{pageErr} Coba pindah ke halaman lain.</span>
          </div>
        )}

        <div ref={wrapRef} className="w-full rounded-xl border border-slate-200 bg-slate-50 overflow-auto scroll-thin"
          style={{ maxHeight: '80vh' }}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan berkas...
            </div>
          ) : err ? (
            <div className="flex items-start gap-2 p-4 text-sm text-red-700 bg-red-50">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{err} Coba muat ulang halaman. Kalau tetap gagal, hubungi pengelola pembelajaran.</span>
            </div>
          ) : (
            <div className="relative inline-block min-w-full">
              {/* draggable=false + pointer-events-none: gambar canvas tidak bisa
                  diseret keluar atau disimpan lewat menu gambar. */}
              <canvas ref={canvasRef} draggable={false} className="block mx-auto pointer-events-none" />
              {rendering && (
                <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Memuat
                </div>
              )}
            </div>
          )}
        </div>
      </LmsAreaTerlindungi>

      {!err && total > 0 && (
        <>
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

          <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => ubahZoom(-ZOOM_LANGKAH)} disabled={zoom <= ZOOM_MIN}
                title="Perkecil"
                className="p-2 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setZoom(1)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-[12px] hover:bg-slate-50 transition">
                {zoom === 1 ? 'Pas Layar' : Math.round(zoom * 100) + '%'}
              </button>
              <button type="button" onClick={() => ubahZoom(ZOOM_LANGKAH)} disabled={zoom >= ZOOM_MAKS}
                title="Perbesar"
                className="p-2 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Bertanda nama Anda · hanya untuk dibaca di aplikasi
            </span>
          </div>
        </>
      )}
    </div>
  );
}
