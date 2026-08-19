// ============================================================================
// LMS V1 — KOMPONEN UI BERSAMA
// ----------------------------------------------------------------------------
// Semua komponen di sini MENIRU resep kelas Tailwind yang sudah dipakai App.jsx
// supaya LMS terlihat menyatu, bukan seperti aplikasi tempelan:
//   kartu   : bg-white rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-200/40
//   primary : bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold
//   input   : w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500
//   badge   : text-[10px] px-2 py-0.5 rounded-full font-bold
//
// ATURAN WAJIB app yang dipatuhi di sini:
//  1. Warna gelap/gradient pakai inline style, BUKAN bg-[#hex].
//  2. Modal WAJIB createPortal ke body, animasi fade opacity-only.
//
// LmsModal sengaja TIDAK memakai komponen Modal milik App.jsx: Modal app hanya
// punya 2 lebar (max-w-md / max-w-2xl) dan dipakai di 37 tempat. Menambah ukuran
// di sana berisiko; di sini kita punya prop `size` sendiri tanpa menyentuh app.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shield, ChevronDown, X, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------- Kartu & teks
export function LmsCard({ children, className = '', ...rest }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-200/40 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function LmsBadge({ children, color = 'bg-slate-100 text-slate-700', className = '' }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${color} ${className}`}>
      {children}
    </span>
  );
}

export function LmsStat({ label, value, sub, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <LmsCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold truncate">{label}</div>
          <div className="font-display font-bold text-2xl mt-1 text-slate-900">{value}</div>
          {sub && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</div>}
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tones[tone] || tones.blue}`}>
            <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          </div>
        )}
      </div>
    </LmsCard>
  );
}

// ------------------------------------------------------------------- Progress
export function LmsProgressBar({ percent = 0, tone = 'blue', className = '', showLabel = false, height = 8 }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = { blue: '#2563EB', emerald: '#10B981', amber: '#F59E0B', orange: '#F97316' }[tone] || '#2563EB';
  return (
    <div className={className}>
      <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${p}%`, backgroundColor: fill }} />
      </div>
      {showLabel && <div className="text-[11px] text-slate-500 mt-1 font-semibold">{p}%</div>}
    </div>
  );
}

/** Cincin progress SVG — meniru resep di KpiView (r=15.5, keliling 97.4). */
export function LmsRing({ percent = 0, size = 44, tone = 'blue', label }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const color = { blue: '#2563EB', emerald: '#10B981', amber: '#F59E0B' }[tone] || '#2563EB';
  const C = 97.4;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E2E8F0" strokeWidth="3.5" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${(p / 100) * C} ${C}`} style={{ transition: 'stroke-dasharray .5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display font-bold text-slate-800" style={{ fontSize: size * 0.26 }}>
          {label ?? `${p}%`}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------- Tabs
/** Tab pill abu-abu — meniru pola KeuanganView. */
export function LmsTabs({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1.5 mb-5 bg-slate-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto scroll-thin">
      {tabs.map(t => {
        const Icon = t.icon;
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
              on ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}>
            {Icon && <Icon className="w-4 h-4" />}
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] px-1.5 rounded-full font-bold ${on ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Accordion
export function LmsAccordion({ title, subtitle, right, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200/70 rounded-2xl bg-white overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/70 transition">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</div>}
        </div>
        {right}
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>}
    </div>
  );
}

// -------------------------------------------------------- Kosong / dilarang / muat
export function LmsEmpty({ icon: Icon, title, text, action }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 text-center py-12 px-6">
      {Icon && <Icon className="w-12 h-12 mx-auto mb-3 text-slate-200" />}
      {title && <h3 className="font-display font-bold text-slate-700">{title}</h3>}
      {text && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LmsNoAccess({ text = 'Halaman ini tidak tersedia untuk peran Anda.' }) {
  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
      <h3 className="font-display font-bold text-slate-700">Akses Dibatasi</h3>
      <p className="text-sm text-slate-500 mt-1">{text}</p>
    </div>
  );
}

export function LmsLoading({ text = 'Memuat...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" />
      {text}
    </div>
  );
}

/** Kerangka kartu saat memuat — mencegah layout melompat. */
export function LmsSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200/70 p-5">
          <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
          <div className="h-2 bg-slate-100 rounded w-full mb-2" />
          <div className="h-2 bg-slate-100 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------- Modal
const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function LmsModal({ title, subtitle, children, onClose, size = 'md' }) {
  // Tutup dengan tombol Escape (Modal app belum punya ini).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-start sm:items-center justify-center z-[100] p-4 sm:p-6 overflow-y-auto animate-modal-backdrop">
      <div className={`bg-white rounded-3xl shadow-2xl shadow-slate-900/30 w-full ${SIZES[size] || SIZES.md} max-h-[92vh] overflow-y-auto scroll-thin border border-slate-200/60 my-auto animate-modal-pop`}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-3xl">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------- Form dasar
export function LmsField({ label, hint, children }) {
  return (
    <div>
      {label && <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide block mb-1.5">{label}</label>}
      {children}
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
export const selectCls = inputCls + ' bg-white';

export function LmsActions({ onCancel, onSave, disabled, saveLabel = 'Simpan', cancelLabel = 'Batal', danger }) {
  return (
    <div className="flex gap-2 pt-2">
      <button onClick={onSave} disabled={disabled}
        className={`flex-1 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg transition ${
          danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}>
        {saveLabel}
      </button>
      {onCancel && (
        <button onClick={onCancel} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">
          {cancelLabel}
        </button>
      )}
    </div>
  );
}

export function LmsError({ children }) {
  if (!children) return null;
  return <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{children}</div>;
}

export function LmsNote({ children, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50/70 border-blue-100 text-slate-700',
    amber: 'bg-amber-50/70 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-600',
  };
  return <div className={`text-[12px] border rounded-lg px-3 py-2 ${tones[tone] || tones.blue}`}>{children}</div>;
}

// --------------------------------------------------------------- Tombol umum
export function LmsPrimaryBtn({ children, icon: Icon, className = '', ...rest }) {
  return (
    <button {...rest}
      className={`bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${className}`}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

export function LmsGhostBtn({ children, icon: Icon, className = '', ...rest }) {
  return (
    <button {...rest}
      className={`bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition disabled:opacity-50 ${className}`}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

// ------------------------------------------------------- Gambar dari brankas
/** Menampilkan gambar yang tersimpan sebagai ref 'img:<id>' / URL Storage. */
export function LmsImage({ src, fetcher, alt = '', className = '', onClick }) {
  const [url, setUrl] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const r = await fetcher(src);
        if (alive.current) setUrl(r || '');
      } catch { if (alive.current) setUrl(''); }
    })();
    return () => { alive.current = false; };
  }, [src, fetcher]);
  if (!url) return <div className={`bg-slate-100 animate-pulse ${className}`} />;
  return <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" />;
}
