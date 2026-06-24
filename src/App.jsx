import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, CheckSquare, Users, FileText, Calendar, UserCog,
  Megaphone, Trophy, Plus, Search, X, Edit2, Trash2, Check,
  Clock, TrendingUp, Activity, ChevronDown, LogOut, Sparkles,
  Settings, Upload, Download, Shield, Lock, Eye, EyeOff, AlertCircle,
  Link2, Network, RefreshCw, FileSpreadsheet, Crown, UserCheck, User,
  Lightbulb, ImagePlus, FileDown, RotateCcw, ExternalLink, Send,
  KanbanSquare, CalendarDays, ClipboardList, PanelLeftClose, PanelLeftOpen,
  GripVertical, MapPin, ArrowRight, ArrowLeft, BarChart3, Pin, MessageSquare,
  Bell, Target, Award, Flame, Zap, TrendingDown, Briefcase, Sparkle,
  Clapperboard, CheckCircle2, GripHorizontal, Eye as EyeIcon, Settings2, BarChart2,
  Database, Camera, Paperclip, Presentation, Calculator, Heart, Cloud, CloudUpload, Wallet, Receipt
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ============ ROLES & PERMISSIONS ============
const ROLES = {
  owner:      { label: 'Owner',            color: 'bg-violet-100 text-violet-800 border-violet-300',   icon: Crown,     rank: 4 },
  manajer:    { label: 'Manajer',          color: 'bg-amber-100 text-amber-800 border-amber-300',      icon: Shield,    rank: 3 },
  leader:     { label: 'Leader',           color: 'bg-blue-100 text-blue-800 border-blue-300',          icon: UserCheck, rank: 2 },
  operasional:{ label: 'Karyawan',         color: 'bg-blue-100 text-blue-800 border-blue-300',    icon: User,      rank: 1 }
};

const can = {
  manageAllUsers: u => u.role === 'owner' || u.role === 'manajer',
  createOwner: u => u.role === 'owner',
  createManajer: u => u.role === 'owner' || u.role === 'manajer',
  createLeader: u => u.role === 'owner' || u.role === 'manajer',
  createOperasional: u => u.role === 'owner' || u.role === 'manajer' || u.role === 'leader',
  editAppSettings: u => u.role === 'owner' || u.role === 'manajer',
  viewAllData: u => u.role === 'owner' || u.role === 'manajer',
  manageAllCreators: u => u.role === 'owner' || u.role === 'manajer',
  assignCreator: u => u.role === 'owner' || u.role === 'manajer' || u.role === 'leader',
  createTasks: u => u.role === 'owner' || u.role === 'manajer' || u.role === 'leader',
  postAnnouncements: u => u.role === 'owner' || u.role === 'manajer' || u.role === 'leader',
  manageSchedule: u => u.role === 'owner' || u.role === 'manajer' || u.role === 'leader',
  // contextual checks
  canSeeUser: (viewer, target) => {
    if (viewer.role === 'owner' || viewer.role === 'manajer') return true;
    if (viewer.id === target.id) return true;
    if (viewer.role === 'leader' && target.leaderId === viewer.id) return true;
    return false;
  },
  canSeeTask: (viewer, task, allUsers) => {
    if (viewer.role === 'owner' || viewer.role === 'manajer') return true;
    if (task.assigneeId === viewer.id || task.createdById === viewer.id) return true;
    if (viewer.role === 'leader') {
      const assignee = allUsers.find(u => u.id === task.assigneeId);
      return assignee && (assignee.leaderId === viewer.id || assignee.id === viewer.id);
    }
    return false;
  },
  canSeeCreator: (viewer, creator, allUsers) => {
    if (viewer.role === 'owner' || viewer.role === 'manajer') return true;
    if (creator.managerId === viewer.id) return true;
    if (viewer.role === 'leader') {
      const manager = allUsers.find(u => u.id === creator.managerId);
      return manager && (manager.leaderId === viewer.id || manager.id === viewer.id);
    }
    return false;
  }
};

// ============ STORAGE ============
// ============ STORAGE (Supabase + localStorage hybrid) ============
// Data tim (shared=true, default) -> Supabase cloud, sinkron antar device.
// Data sesi/UI per-device (shared=false) -> localStorage (current-user, ui prefs).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://atiscluvrvdxzcqautbk.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_Akph68ucY0pXCesBhLFNRw_k6wAaapz';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOCAL_PREFIX = 'alkahfi:';
const _sleep = (ms) => new Promise(r => setTimeout(r, ms));
const storage = {
  // PENTING: kalau baca dari server GAGAL (bukan data kosong beneran), get() MELEMPAR error setelah 3x coba.
  // Tujuannya supaya operasi "baca → ubah → tulis" TIDAK menimpa seluruh data dengan array kosong saat koneksi ngadat.
  async get(key, shared = true) {
    if (!shared) {
      try {
        const raw = localStorage.getItem(LOCAL_PREFIX + key);
        return raw === null ? null : JSON.parse(raw);
      } catch { return null; }
    }
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.from('kv_store').select('value').eq('key', key).maybeSingle();
        if (error) { lastErr = error; await _sleep(350 * (attempt + 1)); continue; }
        return data ? data.value : null; // sukses (null = memang belum ada datanya)
      } catch (e) { lastErr = e; await _sleep(350 * (attempt + 1)); }
    }
    console.error('Supabase get GAGAL (3x):', key, lastErr?.message || lastErr);
    throw new Error(`Gagal membaca data "${key}" dari server. Cek koneksi internet lalu coba lagi.`);
  },
  async set(key, value, shared = true) {
    if (!shared) {
      try { localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) {
        if (e && e.name === 'QuotaExceededError') alert('Penyimpanan lokal penuh.');
        return false;
      }
    }
    try {
      const { error } = await supabase.from('kv_store').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) { console.error('Supabase set error:', key, error.message); return false; }
      return true;
    } catch (e) { console.error('Supabase set failed:', key, e); return false; }
  },
  async getList(key, shared = true) {
    const r = await this.get(key, shared);
    return Array.isArray(r) ? r : [];
  },
  async delete(key, shared = true) {
    if (!shared) {
      try { localStorage.removeItem(LOCAL_PREFIX + key); return true; }
      catch { return false; }
    }
    try {
      const { error } = await supabase.from('kv_store').delete().eq('key', key);
      if (error) { console.error('Supabase delete error:', key, error.message); return false; }
      return true;
    } catch (e) { console.error('Supabase delete failed:', key, e); return false; }
  },
  // ===== PER-RECORD (anti tabrakan/overwrite massal): tiap data = 1 baris ('prefix<id>'). =====
  // Baca semua baris dgn prefix (paginasi 1000, retry 3x, MELEMPAR error kalau gagal → state lama dipertahankan).
  async listByPrefix(prefix) {
    const PAGE = 1000;
    let from = 0; const all = [];
    for (;;) {
      let batch = null, lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // LIKE 'prefix%' = pencocokan pola (TAHAN collation/locale). JANGAN ganti ke range gte/lt:
          // di collation locale-aware Supabase, ':' vs ';' bisa tidak urut ASCII → baris tidak ketemu.
          const { data, error } = await supabase.from('kv_store')
            .select('value')
            .like('key', prefix + '%')
            .order('key', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) { lastErr = error; await _sleep(350 * (attempt + 1)); continue; }
          batch = data || []; break;
        } catch (e) { lastErr = e; await _sleep(350 * (attempt + 1)); }
      }
      if (batch === null) {
        console.error('Supabase listByPrefix GAGAL (3x):', prefix, lastErr?.message || lastErr);
        throw new Error(`Gagal membaca data "${prefix}" dari server. Cek koneksi internet lalu coba lagi.`);
      }
      for (const row of batch) all.push(row.value);
      if (batch.length < PAGE) break;
      from += PAGE;
    }
    return all;
  },
  // Hapus semua baris dgn prefix (sekali query).
  async deleteByPrefix(prefix) {
    try {
      const { error } = await supabase.from('kv_store').delete().like('key', prefix + '%');
      if (error) { console.error('Supabase deleteByPrefix error:', prefix, error.message); return false; }
      return true;
    } catch (e) { console.error('Supabase deleteByPrefix failed:', prefix, e); return false; }
  }
};

// ====== ABSENSI: baca per-record + migrasi/serap array lama 'attendance:all' otomatis ======
// Tiap absen disimpan di 'attendance:rec:<id>' (1 baris) → tidak ada lagi timpa-massal saat banyak orang absen barengan.
// Fungsi ini juga MENYERAP array lama: aman dijalankan berkali-kali, dan menangkap data dari klien lama yg belum refresh.
const ATT_REC_PREFIX = 'attendance:rec:';
async function loadAttendanceRecs() {
  const recs = await storage.listByPrefix(ATT_REC_PREFIX); // throw saat koneksi gagal → pemanggil pertahankan state lama
  let legacy = null;
  try { legacy = await storage.get('attendance:all'); } catch { legacy = null; } // best-effort, jangan gagalkan load
  if (Array.isArray(legacy) && legacy.length) {
    const have = new Set(recs.map(r => r && r.id));
    for (const item of legacy) {
      if (item && item.id != null && !have.has(item.id)) {
        const ok = await storage.set(ATT_REC_PREFIX + item.id, item);
        if (ok) { recs.push(item); have.add(item.id); }
      }
    }
    // Hanya bersihkan array lama kalau SEMUA itemnya sudah jadi record (aman, tidak menghilangkan data).
    const allMigrated = legacy.every(item => !item || item.id == null || have.has(item.id));
    if (allMigrated) {
      await storage.set('attendance:all:archived-v2', legacy); // arsip cadangan (bukan bagian backup)
      await storage.delete('attendance:all');
    }
  }
  return recs;
}

// Laporan Harian: pola per-record yang sama dgn absensi.
const RPT_REC_PREFIX = 'daily-reports:rec:';
async function loadDailyReports() {
  const recs = await storage.listByPrefix(RPT_REC_PREFIX);
  let legacy = null;
  try { legacy = await storage.get('daily-reports:all'); } catch { legacy = null; }
  if (Array.isArray(legacy) && legacy.length) {
    const have = new Set(recs.map(r => r && r.id));
    for (const item of legacy) {
      if (item && item.id != null && !have.has(item.id)) {
        const ok = await storage.set(RPT_REC_PREFIX + item.id, item);
        if (ok) { recs.push(item); have.add(item.id); }
      }
    }
    const allMigrated = legacy.every(item => !item || item.id == null || have.has(item.id));
    if (allMigrated) {
      await storage.set('daily-reports:all:archived-v2', legacy);
      await storage.delete('daily-reports:all');
    }
  }
  return recs;
}

// GMV divisi (gmv:daily) — per-record.
const GMV_REC_PREFIX = 'gmv:rec:';
async function loadGmvEntries() {
  const recs = await storage.listByPrefix(GMV_REC_PREFIX);
  let legacy = null;
  try { legacy = await storage.get('gmv:daily'); } catch { legacy = null; }
  if (Array.isArray(legacy) && legacy.length) {
    const have = new Set(recs.map(r => r && r.id));
    for (const item of legacy) {
      if (item && item.id != null && !have.has(item.id)) {
        const ok = await storage.set(GMV_REC_PREFIX + item.id, item);
        if (ok) { recs.push(item); have.add(item.id); }
      }
    }
    const allMigrated = legacy.every(item => !item || item.id == null || have.has(item.id));
    if (allMigrated) { await storage.set('gmv:daily:archived-v2', legacy); await storage.delete('gmv:daily'); }
  }
  return recs;
}

// GMV akun affiliator (affiliate-gmv:daily) — per-record.
const AFF_REC_PREFIX = 'affiliate-gmv:rec:';
async function loadAffEntries() {
  const recs = await storage.listByPrefix(AFF_REC_PREFIX);
  let legacy = null;
  try { legacy = await storage.get('affiliate-gmv:daily'); } catch { legacy = null; }
  if (Array.isArray(legacy) && legacy.length) {
    const have = new Set(recs.map(r => r && r.id));
    for (const item of legacy) {
      if (item && item.id != null && !have.has(item.id)) {
        const ok = await storage.set(AFF_REC_PREFIX + item.id, item);
        if (ok) { recs.push(item); have.add(item.id); }
      }
    }
    const allMigrated = legacy.every(item => !item || item.id == null || have.has(item.id));
    if (allMigrated) { await storage.set('affiliate-gmv:daily:archived-v2', legacy); await storage.delete('affiliate-gmv:daily'); }
  }
  return recs;
}

// Tiket (tasks:all) — per-record.
const TASK_REC_PREFIX = 'tasks:rec:';
async function loadTasks() {
  const recs = await storage.listByPrefix(TASK_REC_PREFIX);
  let legacy = null;
  try { legacy = await storage.get('tasks:all'); } catch { legacy = null; }
  if (Array.isArray(legacy) && legacy.length) {
    const have = new Set(recs.map(r => r && r.id));
    for (const item of legacy) {
      if (item && item.id != null && !have.has(item.id)) {
        const ok = await storage.set(TASK_REC_PREFIX + item.id, item);
        if (ok) { recs.push(item); have.add(item.id); }
      }
    }
    const allMigrated = legacy.every(item => !item || item.id == null || have.has(item.id));
    if (allMigrated) { await storage.set('tasks:all:archived-v2', legacy); await storage.delete('tasks:all'); }
  }
  return recs;
}

// Izin (leave-requests:all) — per-record.
const LEAVE_REC_PREFIX = 'leave-requests:rec:';
async function loadLeaves() {
  const recs = await storage.listByPrefix(LEAVE_REC_PREFIX);
  let legacy = null;
  try { legacy = await storage.get('leave-requests:all'); } catch { legacy = null; }
  if (Array.isArray(legacy) && legacy.length) {
    const have = new Set(recs.map(r => r && r.id));
    for (const item of legacy) {
      if (item && item.id != null && !have.has(item.id)) {
        const ok = await storage.set(LEAVE_REC_PREFIX + item.id, item);
        if (ok) { recs.push(item); have.add(item.id); }
      }
    }
    const allMigrated = legacy.every(item => !item || item.id == null || have.has(item.id));
    if (allMigrated) { await storage.set('leave-requests:all:archived-v2', legacy); await storage.delete('leave-requests:all'); }
  }
  return recs;
}

// Kalender (calendar:all) — per-record.
const CAL_REC_PREFIX = 'calendar:rec:';
async function loadCalendar() {
  const recs = await storage.listByPrefix(CAL_REC_PREFIX);
  let legacy = null;
  try { legacy = await storage.get('calendar:all'); } catch { legacy = null; }
  if (Array.isArray(legacy) && legacy.length) {
    const have = new Set(recs.map(r => r && r.id));
    for (const item of legacy) {
      if (item && item.id != null && !have.has(item.id)) {
        const ok = await storage.set(CAL_REC_PREFIX + item.id, item);
        if (ok) { recs.push(item); have.add(item.id); }
      }
    }
    const allMigrated = legacy.every(item => !item || item.id == null || have.has(item.id));
    if (allMigrated) { await storage.set('calendar:all:archived-v2', legacy); await storage.delete('calendar:all'); }
  }
  return recs;
}

// Daftar modul per-record (key backup logis → loader & prefix baris). Tambah modul baru di sini.
const PER_RECORD_LOADERS = { 'attendance:all': loadAttendanceRecs, 'daily-reports:all': loadDailyReports, 'gmv:daily': loadGmvEntries, 'affiliate-gmv:daily': loadAffEntries, 'tasks:all': loadTasks, 'leave-requests:all': loadLeaves, 'calendar:all': loadCalendar };
const PER_RECORD_PREFIX = { 'attendance:all': ATT_REC_PREFIX, 'daily-reports:all': RPT_REC_PREFIX, 'gmv:daily': GMV_REC_PREFIX, 'affiliate-gmv:daily': AFF_REC_PREFIX, 'tasks:all': TASK_REC_PREFIX, 'leave-requests:all': LEAVE_REC_PREFIX, 'calendar:all': CAL_REC_PREFIX };

// ============ CRYPTO (PBKDF2 password hashing) ============
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function genSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============ HELPERS ============
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Suara notifikasi "ding" pakai Web Audio (tanpa file mp3)
let _notifAudioCtx = null;
function playNotifSound() {
  try {
    if (!_notifAudioCtx) _notifAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _notifAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.16;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.34);
    });
  } catch (e) { /* browser belum izinkan audio */ }
}
// Cek string tanggal-saja "YYYY-MM-DD" (tanpa jam) — ini tanggal kalender, JANGAN digeser timezone.
const isDateOnly = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
// Tanggal-saja → tampilkan apa adanya (parse jam 00:00 lokal, tidak bergeser hari di device manapun).
// Timestamp lengkap (createdAt dll) → selalu tampilkan dalam WIB (Asia/Jakarta) supaya HP & laptop SAMA.
const fmtDate = d => {
  if (!d) return '-';
  if (isDateOnly(d)) return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
};
const fmtDateTime = d => {
  if (!d) return '-';
  if (isDateOnly(d)) return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
};
const fmtNumber = n => new Intl.NumberFormat('id-ID').format(n || 0);
const fmtRupiah = n => 'Rp ' + fmtNumber(n);
const daysUntil = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
const getWeekRange = (offset = 0) => {
  const now = new Date(); now.setDate(now.getDate() + offset * 7);
  const day = now.getDay();
  const monday = new Date(now.setDate(now.getDate() - day + (day === 0 ? -6 : 1)));
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  return { start: dayKey(monday), end: dayKey(sunday) };
};

// Kompres file gambar → dataURL JPEG (dipakai: feedback, laporan, selfie absen)
function compressImageFile(file, { maxDim = 900, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('File harus berupa gambar (PNG/JPG/WEBP).'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Ukuran file maksimal 10MB.'));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale); height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Gagal membaca gambar.'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

// Avatar seragam: foto profil (sinkron antar tim) atau inisial
function Avatar({ person, size = 'md', className = '' }) {
  const sizes = { xs: 'w-6 h-6 text-[10px]', sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base', xl: 'w-14 h-14 text-lg' };
  const name = person?.name || '?';
  return (
    <div className={`${sizes[size] || sizes.md} rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden ${className}`}>
      {person?.avatarImage
        ? <img src={person.avatarImage} alt={name} className="w-full h-full object-cover" />
        : name.charAt(0).toUpperCase()}
    </div>
  );
}

// Lightbox sederhana untuk lihat foto besar (selfie absen, lampiran, dll)
function ImageLightbox({ src, title, onClose }) {
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-white text-sm font-semibold truncate">{title || 'Foto'}</div>
          <button onClick={onClose} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg p-2"><X className="w-5 h-5" /></button>
        </div>
        <img src={src} alt={title || 'Foto'} className="w-full max-h-[80vh] object-contain rounded-2xl bg-black/30" />
      </div>
    </div>,
    document.body
  );
}

const PRIORITIES = {
  low:    { label: 'Rendah', color: 'bg-slate-100 text-slate-700' },
  medium: { label: 'Sedang', color: 'bg-amber-100 text-amber-800' },
  high:   { label: 'Tinggi', color: 'bg-red-100 text-red-700' }
};
const TASK_STATUS = {
  todo:        { label: 'Belum Mulai', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  in_progress: { label: 'Dikerjakan',  color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  qc:          { label: 'Menunggu QC', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  done:        { label: 'Selesai',     color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' }
};
const CREATOR_STATUS = {
  aktif:   { label: 'Aktif',   color: 'bg-blue-100 text-blue-700' },
  pasif:   { label: 'Pasif',   color: 'bg-slate-100 text-slate-600' },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800' }
};
const SCHEDULE_TYPE = {
  live:        { label: 'Live Shopping', color: 'bg-purple-100 text-purple-800', icon: '🔴' },
  piket_admin: { label: 'Piket Admin',   color: 'bg-blue-100 text-blue-800',     icon: '💼' },
  piket_grup:  { label: 'Piket Grup',    color: 'bg-cyan-100 text-cyan-800',     icon: '👥' }
};

const CONTENT_STATUS = {
  idea:        { label: 'Ide',          color: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400' },
  approved:    { label: 'Disetujui',    color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  in_progress: { label: 'Produksi',     color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  published:   { label: 'Sudah Tayang', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  rejected:    { label: 'Ditolak',      color: 'bg-red-100 text-red-700',       dot: 'bg-red-500' }
};
const CONTENT_FORMAT = {
  reel:     { label: 'Reel/Video TikTok', icon: '🎬' },
  carousel: { label: 'Carousel IG',       icon: '📑' },
  photo:    { label: 'Foto Tunggal',      icon: '📸' },
  live:     { label: 'Live Shopping',     icon: '🔴' },
  story:    { label: 'Story',             icon: '⚡' }
};

const TODO_STATUS = {
  todo:        { label: 'To Do',       color: 'bg-slate-100 text-slate-700',   border: 'border-slate-300',   bg: 'bg-slate-50' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',     border: 'border-blue-300',    bg: 'bg-blue-50' },
  done:        { label: 'Done',        color: 'bg-blue-100 text-blue-700', border: 'border-blue-300', bg: 'bg-blue-50' }
};
const EVENT_TYPE = {
  meeting:  { label: 'Meeting',  icon: '👥', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  agenda:   { label: 'Agenda',   icon: '📋', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  kegiatan: { label: 'Kegiatan', icon: '🎯', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  training: { label: 'Training', icon: '🎓', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  briefing: { label: 'Briefing', icon: '🗣️', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  live:        { label: 'Live Shopping', icon: '🔴', color: 'bg-rose-100 text-rose-700 border-rose-300' },
  piket_admin: { label: 'Piket Admin',   icon: '💼', color: 'bg-violet-100 text-violet-700 border-violet-300' },
  piket_grup:  { label: 'Piket Grup',    icon: '🧑‍🤝‍🧑', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  lain:     { label: 'Lainnya',  icon: '📌', color: 'bg-slate-100 text-slate-700 border-slate-300' }
};

const FIELD_TYPES = {
  text:     { label: 'Teks Singkat',   icon: '📝' },
  textarea: { label: 'Teks Panjang',   icon: '📄' },
  number:   { label: 'Angka',          icon: '🔢' },
  date:     { label: 'Tanggal',        icon: '📅' },
  time:     { label: 'Jam/Waktu',      icon: '🕐' },
  select:   { label: 'Pilihan Dropdown', icon: '☑️' },
  radio:    { label: 'Pilihan Ganda',  icon: '🔘' },
  checkbox: { label: 'Kotak Centang (multi)', icon: '✅' },
  rating:   { label: 'Rating 1-5',     icon: '⭐' },
  url:      { label: 'Link URL',       icon: '🔗' }
};
const DEFAULT_DAILY_FIELDS = [
  { id: 'activities',   label: 'Aktivitas Hari Ini',   type: 'textarea', required: true,  placeholder: 'Apa yang Anda kerjakan hari ini?' },
  { id: 'results',      label: 'Hasil / Pencapaian',   type: 'textarea', required: false, placeholder: 'Hasil konkret hari ini' },
  { id: 'blockers',     label: 'Kendala',              type: 'textarea', required: false, placeholder: 'Hambatan yang ditemui' },
  { id: 'nextDayPlan',  label: 'Rencana Besok',        type: 'textarea', required: false, placeholder: 'Yang akan dikerjakan besok' },
  { id: 'gmv',          label: 'GMV Hari Ini (Rp)',    type: 'number',   required: false },
  { id: 'contentCount', label: 'Jumlah Konten',        type: 'number',   required: false },
  { id: 'liveCount',    label: 'Jumlah Live',          type: 'number',   required: false }
];

const DEFAULT_ROLE_LABELS = { owner: 'Owner', manajer: 'Manajer', leader: 'Leader', operasional: 'Karyawan' };
const DEFAULT_JOB_TITLES = ['Creator Manager', 'Admin Live', 'Admin Grup', 'Creator Hunter', 'Content Creator', 'Tim Ads', 'Marketing', 'Editor Video', 'Affiliator', 'Admin Campaign', 'Dokumentasi', 'Live Streaming'];

// Konfigurasi absensi: jam kerja, toleransi telat, & lokasi kerja
const DEFAULT_ATTENDANCE_CONFIG = {
  jamMasuk: '08:00',
  jamPulang: '17:00',
  toleransiMenit: 5,
  lokasiAktif: false,
  lokasiLabel: '',
  lokasiLat: null,
  lokasiLng: null,
  radiusM: 200,
  selfieWajib: true,   // wajib foto selfie saat absen (anti-kecurangan)
  izinHmin: 1,         // pengajuan izin minimal H-berapa (sakit boleh hari-H)
  // Jadwal jam kerja per hari (0=Min ... 6=Sab). libur=true → tidak ditandai telat/pulang cepat.
  perDay: {
    enabled: true,
    days: {
      1: { jamMasuk: '08:00', jamPulang: '17:00', libur: false },
      2: { jamMasuk: '08:00', jamPulang: '17:00', libur: false },
      3: { jamMasuk: '08:00', jamPulang: '17:00', libur: false },
      4: { jamMasuk: '08:00', jamPulang: '17:00', libur: false },
      5: { jamMasuk: '08:00', jamPulang: '17:00', libur: false },
      6: { jamMasuk: '08:00', jamPulang: '15:00', libur: false },
      0: { jamMasuk: '08:00', jamPulang: '15:00', libur: true }
    }
  },
  custom: {}           // jam kerja per karyawan: { [userId]: { jamMasuk, jamPulang, toleransiMenit, flexible } }
};
const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Jam kerja efektif: override per-user (freelance/shift) > jadwal per hari > default tim.
// dateObj opsional — kalau diberi & perDay aktif, jam ikut hari tsb (mis. Sabtu 08-15).
function effectiveAttConfig(config, userId, dateObj) {
  let base = { jamMasuk: config.jamMasuk, jamPulang: config.jamPulang, libur: false };
  if (config.perDay?.enabled && dateObj) {
    const d = (config.perDay.days || {})[new Date(dateObj).getDay()];
    if (d) base = { jamMasuk: d.jamMasuk || config.jamMasuk, jamPulang: d.jamPulang || config.jamPulang, libur: !!d.libur };
  }
  const ov = (config.custom || {})[userId];
  if (!ov) return { ...config, ...base, flexible: false };
  return {
    ...config,
    jamMasuk: ov.jamMasuk || base.jamMasuk,
    jamPulang: ov.jamPulang || base.jamPulang,
    libur: base.libur,
    toleransiMenit: ov.toleransiMenit !== undefined && ov.toleransiMenit !== '' ? ov.toleransiMenit : config.toleransiMenit,
    flexible: !!ov.flexible
  };
}

// Semua key data tim (shared) yang ikut di-backup. ui:* & current-user TIDAK ikut (khusus per-perangkat).
const BACKUP_KEYS = [
  'users:list', 'app:settings', 'tasks:all', 'todos:all', 'creators:all', 'creators:last-sync',
  'sellers:all', 'attendance:all', 'attendance:config', 'activities:all', 'announcements:all', 'schedule:all', 'calendar:all',
  'daily-reports:all', 'daily-report-templates:all', 'reports:all', 'targets:all', 'content-ideas:all',
  'gmv:daily', 'gmv:targets', 'kpi:config', 'problems:all', 'affiliate-accounts:all', 'affiliate-gmv:daily', 'affiliate:goal', 'feedback:all',
  'attendance:selfie-index', 'tap-commission:tiers', 'tap-commission:history',
  'partner-feedback:all', 'swot:external', 'backup:last', 'leave-requests:all',
  'drive:auto-backup', 'backup:drive-last',
  'keuangan:cashflow'
];
// Catatan: foto selfie absen (key `selfie:<id>`) sengaja TIDAK ikut backup karena ukurannya besar
// dan otomatis dihapus setelah 60 hari. Data absensinya sendiri tetap ter-backup.

// ====== BACKUP HELPERS (export manual + auto-backup harian + restore gabung) ======
async function buildBackupDump(byName = 'auto') {
  const dump = { _meta: { app: 'Al-Kahfi Corp Team App', exportedAt: new Date().toISOString(), by: byName, version: 1 }, data: {} };
  for (const k of BACKUP_KEYS) {
    let v;
    if (PER_RECORD_LOADERS[k]) {
      const recs = await PER_RECORD_LOADERS[k](); // modul per-record → kumpulkan jadi array (format backup tetap sama)
      v = recs.length ? recs : null;
    } else {
      v = await storage.get(k); // bisa melempar error → ditangani pemanggil (jangan simpan backup setengah)
    }
    if (v !== null && v !== undefined) dump.data[k] = v;
  }
  return dump;
}
const AUTO_BACKUP_KEEP = 7; // simpan 7 snapshot harian terakhir
// Snapshot otomatis 1x/hari ke key terpisah (backup:auto:<tgl>). Aman: write penuh, bukan baca-ubah-tulis.
async function autoBackupIfDue(byName) {
  try {
    const todayK = wibDayKey();
    const idx = (await storage.get('backup:auto:index')) || { dates: [] };
    if (Array.isArray(idx.dates) && idx.dates.includes(todayK)) return; // sudah hari ini
    const dump = await buildBackupDump(byName || 'auto');
    if (!dump.data || Object.keys(dump.data).length === 0) return; // jangan simpan snapshot kosong
    await storage.set(`backup:auto:${todayK}`, dump);
    let dates = [...(idx.dates || []).filter(d => d !== todayK), todayK].sort();
    while (dates.length > AUTO_BACKUP_KEEP) { const old = dates.shift(); await storage.delete(`backup:auto:${old}`); }
    await storage.set('backup:auto:index', { dates });
  } catch (e) { console.warn('Auto-backup dilewati (akan dicoba lagi):', e?.message || e); }
}
// Gabungkan array by id (item sekarang menang utk id sama; item lama yg hilang dimunculkan lagi).
function mergeArraysById(current, backup) {
  const map = new Map();
  (backup || []).forEach(it => { if (it && it.id != null) map.set(it.id, it); });
  (current || []).forEach(it => { if (it && it.id != null) map.set(it.id, it); });
  const noId = [...(backup || []).filter(it => !it || it.id == null), ...(current || []).filter(it => !it || it.id == null)];
  const seen = new Set(); const uniq = [];
  noId.forEach(it => { const s = JSON.stringify(it); if (!seen.has(s)) { seen.add(s); uniq.push(it); } });
  return [...map.values(), ...uniq];
}
// Restore GABUNG: data hilang kembali, data sekarang TIDAK terhapus.
async function applyMergeRestore(data) {
  const keys = Object.keys(data || {}).filter(k => BACKUP_KEYS.includes(k));
  let n = 0;
  for (const k of keys) {
    const bval = data[k];
    if (PER_RECORD_LOADERS[k] && Array.isArray(bval)) {
      // modul per-record → gabung by id lalu tulis tiap baris (kompatibel file backup lama format array)
      const cur = await PER_RECORD_LOADERS[k]();
      const merged = mergeArraysById(cur, bval);
      const pfx = PER_RECORD_PREFIX[k];
      for (const it of merged) { if (it && it.id != null) await storage.set(pfx + it.id, it); }
      n++;
    } else if (Array.isArray(bval)) {
      const cur = await storage.getList(k);
      await storage.set(k, mergeArraysById(cur, bval)); n++;
    } else if (bval && typeof bval === 'object') {
      const cur = (await storage.get(k)) || {};
      await storage.set(k, { ...bval, ...cur }); n++; // nilai sekarang menang, tambah key yg hilang
    } else {
      const cur = await storage.get(k);
      if (cur === null || cur === undefined) { await storage.set(k, bval); n++; }
    }
  }
  return n;
}

// Divisi tim Masjid Affiliate (sesuai struktur Al-Kahfi Corp)
const DIVISIONS = {
  manajemen: { label: 'Manajemen', color: 'bg-violet-100 text-violet-800' },
  internal:  { label: 'Affiliator Internal', color: 'bg-blue-100 text-blue-800' },
  mcn:       { label: 'MCN', color: 'bg-emerald-100 text-emerald-800' },
  tap:       { label: 'TAP', color: 'bg-orange-100 text-orange-800' },
  media:     { label: 'Media & Creative', color: 'bg-pink-100 text-pink-800' },
  event:     { label: 'Event', color: 'bg-amber-100 text-amber-800' },
  mabit:     { label: 'Mabit Scholar', color: 'bg-teal-100 text-teal-800' },
  keuangan:  { label: 'Keuangan', color: 'bg-slate-100 text-slate-700' }
};

// Fitur apa yang relevan untuk tiap divisi (selain menu umum yang dipakai semua).
// Owner & Manajer selalu lihat semua. Divisi 'manajemen' juga lihat semua.
const DIVISION_FEATURES = {
  manajemen: ['creators', 'creator-management', 'sellers', 'gmv', 'affiliate-accounts', 'tap-commission', 'finance'],
  internal:  ['gmv', 'affiliate-accounts'],
  mcn:       ['creators', 'creator-management', 'gmv'],
  tap:       ['sellers', 'gmv', 'tap-commission'],
  media:     ['media-tasks'],
  event:     [],
  mabit:     [],
  keuangan:  ['gmv', 'finance']
};
// Label jabatan yang ditampilkan di kartu anggota:
// Manajer/Owner = tidak perlu (perannya sudah jabatan) · Leader = otomatis "Leader <Divisi>" · Staff = jobTitle kalau diisi.
const LEADER_DIV_SHORT = { mcn: 'MCN', tap: 'TAP', internal: 'Affiliator', media: 'Media', event: 'Event', mabit: 'Mabit', keuangan: 'Keuangan', manajemen: 'Manajemen' };
function displayJobTitle(u) {
  if (!u) return null;
  if (u.role === 'owner' || u.role === 'manajer') return null;
  if (u.role === 'leader') return `Leader ${LEADER_DIV_SHORT[u.division] || ''}`.trim();
  return u.jobTitle?.trim() || null;
}

// Cek apakah user boleh lihat fitur khusus tertentu (berdasarkan role + divisi)
function canAccessFeature(user, feature) {
  if (user.role === 'owner' || user.role === 'manajer') return true;
  const div = user.division || 'internal';
  return (DIVISION_FEATURES[div] || []).includes(feature);
}

// ====== GMV TRACKING ======
// 3 divisi penghasil GMV — target wajib bisnis
const GMV_DIVISIONS = {
  mcn:      { label: 'MCN', short: 'MCN', color: '#10B981', bg: 'from-emerald-500 to-emerald-700', updater: 'Leader MCN' },
  tap:      { label: 'TAP', short: 'TAP', color: '#F97316', bg: 'from-orange-500 to-orange-700', updater: 'Leader TAP' },
  internal: { label: 'Affiliator Internal', short: 'Internal', color: '#3B82F6', bg: 'from-blue-500 to-blue-700', updater: 'Tim Affiliator' }
};
// Siapa boleh input GMV divisi tertentu
function canInputGmv(user, division) {
  if (user.role === 'owner' || user.role === 'manajer') return true;
  return (user.division || '') === division; // leader/anggota divisi tsb update divisinya sendiri
}
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const dayKey = (d = new Date()) => {
  const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
// Tanggal kalender (YYYY-MM-DD) dalam WIB dari sebuah timestamp — supaya pengelompokan tanggal
// (mis. absensi yang disimpan sebagai timestamp UTC) konsisten di semua device, bukan ikut zona perangkat.
const wibDayKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const daysInMonth = (mKey) => { const [y, m] = mKey.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const DEFAULT_AFFILIATE_GOAL = 1000000000; // target Affiliator Internal default 1 Miliar/bulan

// ====== KALKULATOR PEMBAGIAN KOMISI TAP (berbasis tier harga — brief tim TAP) ======
const DEFAULT_TAP_TIERS = [
  { id: 't1', name: 'Tier 1', min: 0,      max: 50000,  agency: 1, minRaise: 4, minAff: 3 },
  { id: 't2', name: 'Tier 2', min: 50001,  max: 100000, agency: 2, minRaise: 5, minAff: 3 },
  { id: 't3', name: 'Tier 3', min: 100001, max: 200000, agency: 3, minRaise: 6, minAff: 3 },
  { id: 't4', name: 'Tier 4', min: 200001, max: 300000, agency: 4, minRaise: 7, minAff: 3 }
];
// Hitung pembagian: agency dari tier harga, affiliator = sisa raise seller
function computeTapCommission(price, raise, tiers = DEFAULT_TAP_TIERS) {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  let tier = sorted.find(t => price >= t.min && price <= t.max);
  const maxRange = Math.max(...sorted.map(t => t.max));
  const outOfRange = price > maxRange;
  if (!tier) tier = outOfRange ? sorted[sorted.length - 1] : sorted[0];

  const agencyPct = Number(tier.agency) || 0;
  const affPct = raise - agencyPct;
  const minAff = Number(tier.minAff) || 3;
  const minRaise = Number(tier.minRaise) || (agencyPct + minAff);

  // Status kelayakan sesuai aturan brief (bagian 11)
  let status;
  if (raise < agencyPct) status = { level: 'tidak-layak', label: 'Tidak Layak', color: 'bg-red-100 text-red-700', detail: 'Raise seller di bawah jatah agency.' };
  else if (raise === agencyPct) status = { level: 'tidak-layak', label: 'Tidak Layak — Affiliator 0%', color: 'bg-red-100 text-red-700', detail: 'Raise habis untuk agency, affiliator tidak dapat apa-apa.' };
  else if (affPct < 2) status = { level: 'kurang', label: 'Kurang Menarik', color: 'bg-orange-100 text-orange-700', detail: `Affiliator hanya dapat ${affPct}% — kurang menarik untuk dijual.` };
  else if (affPct < minAff) status = { level: 'cukup', label: 'Cukup, Belum Ideal', color: 'bg-amber-100 text-amber-700', detail: `Affiliator dapat ${affPct}% — bisa jalan, tapi belum standar.` };
  else if (raise >= minRaise) status = { level: 'ideal', label: 'Ideal — Layak Kerja Sama', color: 'bg-emerald-100 text-emerald-700', detail: 'Memenuhi standar minimum raise tier ini.' };
  else status = { level: 'ideal', label: 'Ideal', color: 'bg-emerald-100 text-emerald-700', detail: `Affiliator sudah ≥${minAff}%.` };

  // Rekomendasi otomatis (bagian 12)
  let rekomendasi;
  if (status.level === 'tidak-layak' || status.level === 'kurang') {
    rekomendasi = `Raise seller belum memenuhi standar ${tier.name}. Disarankan renegosiasi raise minimal menjadi ${minRaise}% agar affiliator mendapat minimal ${minAff}%.`;
  } else if (status.level === 'cukup') {
    rekomendasi = 'Raise seller sudah cukup, tetapi belum ideal. Bisa diterima jika produk memiliki potensi GMV tinggi.';
  } else {
    rekomendasi = 'Raise seller sudah memenuhi standar TAP. Produk layak diproses untuk kerja sama.';
  }

  return {
    tier, outOfRange, agencyPct, affPct,
    minRaise, minAff, status, rekomendasi,
    nominalAgency: Math.round(price * agencyPct / 100),
    nominalAff: Math.round(price * Math.max(affPct, 0) / 100)
  };
}

// ====== KPI POIN (v2 — adil per peran & divisi) ======
// 5 komponen: Kehadiran (hadir) · Disiplin (tepat waktu) · Tugas (kualitas+volume) · Laporan Harian · Capaian Target GMV.
// Untuk anggota yang tidak pegang target GMV (Media, Event, dll), bobot Target otomatis dialihkan ke Tugas & Laporan — tetap fair.
const DEFAULT_KPI_CONFIG = {
  targetScore: 85,      // target bulanan, >= ini = Mumtaz
  workdays: 26,         // target hari kerja per bulan
  taskVolumeTarget: 20, // target jumlah tugas selesai per bulan
  weights: { attendance: 25, punctuality: 10, tasks: 25, reports: 20, target: 20 }
};
// Migrasi config lama (attendance/tasks/reports/bonus) → skema v2
function normalizeKpiConfig(cfg) {
  const c = { ...DEFAULT_KPI_CONFIG, ...(cfg || {}) };
  const w = c.weights || {};
  if (w.target === undefined || w.punctuality === undefined) {
    c.weights = { ...DEFAULT_KPI_CONFIG.weights };
  } else {
    c.weights = { ...DEFAULT_KPI_CONFIG.weights, ...w };
  }
  return c;
}
// Hitung KPI seorang user untuk bulan mKey
function computeKpi(userId, data, mKey, cfg) {
  const { tasks = [], attendance = [], reports = [], gmvEntries = [], gmvTargets = {}, affAccounts = [], affEntries = [], allUsers = [], templates = [], leaves = [] } = data || {};
  const c = normalizeKpiConfig(cfg);
  const w = c.weights;
  const workdays = c.workdays || 26;
  const u = allUsers.find(x => x.id === userId);

  // 1) Kehadiran: hadir penuh = 1 hari, izin disetujui = kredit 0.5 hari, alpa = 0 (otomatis mengurangi)
  const myIns = attendance.filter(a => a.userId === userId && a.type === 'in' && (a.timestamp || '').slice(0, 7) === mKey);
  const attDays = new Set(myIns.map(a => (a.timestamp || '').slice(0, 10))).size;
  const izinDays = new Set(leaves.filter(l => l.userId === userId && l.status === 'approved' && (l.date || '').slice(0, 7) === mKey).map(l => l.date)).size;
  const attScore = Math.min((attDays + izinDays * 0.5) / workdays, 1) * w.attendance;

  // 2) Disiplin: % absen masuk tepat waktu. Tidak pernah absen = 0 (bukan 100%) — tanpa kehadiran tidak ada disiplin.
  const lateCount = myIns.filter(a => a.late).length;
  const punctRate = myIns.length > 0 ? (myIns.length - lateCount) / myIns.length : 0;
  const punctScore = punctRate * w.punctuality;

  // 3) Tugas: 70% kualitas (selesai vs lewat deadline) + 30% volume
  const now = new Date();
  const myTasks = tasks.filter(t => t.assigneeId === userId);
  const done = myTasks.filter(t => t.status === 'done' && (t.completedAt || '').slice(0, 7) === mKey).length;
  const missed = myTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now && (t.deadline || '').slice(0, 7) === mKey).length;
  const rate = (done + missed) > 0 ? done / (done + missed) : 1;
  const volume = Math.min(done / (c.taskVolumeTarget || 20), 1);
  const taskUnit = rate * 0.7 + volume * 0.3;

  // 4) Laporan harian: hanya dinilai kalau Leader sudah membuatkan form (staff tanpa form = tidak diwajibkan, dapat kredit penuh)
  const repDays = new Set(reports.filter(r => r.authorId === userId && (r.date || '').slice(0, 7) === mKey).map(r => r.date)).size;
  const reportRequired = !(u && u.role === 'operasional' && !templates.some(t => t.assignedUserIds?.includes(userId)));
  const repUnit = reportRequired ? Math.min(repDays / workdays, 1) : 1;

  // 5) Capaian Target GMV — sesuai tanggung jawabnya:
  //    a. PIC akun affiliator → rata-rata pencapaian akun vs jalur target (pace bulan berjalan)
  //    b. Leader/Manajer divisi GMV (mcn/tap/internal) → pencapaian divisi vs jalur target
  //    c. Selain itu → bobot target dialihkan ke Tugas & Laporan
  let targetAttain = null, targetInfo = '';
  const dim = daysInMonth(mKey);
  const elapsed = mKey === monthKey() ? Math.max(new Date().getDate(), 1) : dim;
  const myAccounts = affAccounts.filter(a => a.active !== false && a.picId === userId);
  if (myAccounts.length > 0) {
    const atts = myAccounts.map(a => {
      const t = Number(a.targets?.[mKey]) || 0;
      if (t <= 0) return null;
      const actual = affEntries.filter(e => e.accountId === a.id && (e.date || '').startsWith(mKey)).reduce((s, e) => s + (Number(e.gmv) || 0), 0);
      const expected = t * (elapsed / dim);
      return expected > 0 ? Math.min(actual / expected, 1) : null;
    }).filter(x => x !== null);
    if (atts.length > 0) {
      targetAttain = atts.reduce((s, x) => s + x, 0) / atts.length;
      targetInfo = `${atts.length} akun yang dipegang`;
    }
  }
  if (targetAttain === null && u && (u.role === 'leader' || u.role === 'manajer')) {
    const div = u.division || '';
    if (['mcn', 'tap', 'internal'].includes(div)) {
      const t = Number((gmvTargets[mKey] || {})[div]) || 0;
      if (t > 0) {
        const actual = gmvEntries.filter(e => e.division === div && (e.date || '').startsWith(mKey)).reduce((s, e) => s + (Number(e.gmv) || 0), 0);
        const expected = t * (elapsed / dim);
        targetAttain = expected > 0 ? Math.min(actual / expected, 1) : null;
        targetInfo = `divisi ${GMV_DIVISIONS[div].label}`;
      }
    }
  }

  let taskScore, repScore, targetScore;
  const targetApplicable = targetAttain !== null;
  if (targetApplicable) {
    taskScore = taskUnit * w.tasks;
    repScore = repUnit * w.reports;
    targetScore = targetAttain * w.target;
  } else {
    // realokasi bobot target → tugas & laporan (proporsional) supaya tetap total 100
    const taskShare = (w.tasks + w.reports) > 0 ? w.tasks / (w.tasks + w.reports) : 0.5;
    taskScore = taskUnit * (w.tasks + w.target * taskShare);
    repScore = repUnit * (w.reports + w.target * (1 - taskShare));
    targetScore = 0;
  }

  const total = Math.round(attScore + punctScore + taskScore + repScore + targetScore);
  return {
    total,
    attendance: { days: attDays, izin: izinDays, score: Math.round(attScore), max: w.attendance },
    punctuality: { rate: Math.round(punctRate * 100), late: lateCount, hasData: myIns.length > 0, score: Math.round(punctScore), max: w.punctuality },
    tasks: { done, missed, rate: Math.round(rate * 100), score: Math.round(taskScore), max: targetApplicable ? w.tasks : Math.round(w.tasks + w.target * (w.tasks / Math.max(w.tasks + w.reports, 1))) },
    reports: { days: repDays, required: reportRequired, score: Math.round(repScore), max: targetApplicable ? w.reports : Math.round(w.reports + w.target * (w.reports / Math.max(w.tasks + w.reports, 1))) },
    target: { applicable: targetApplicable, attain: targetApplicable ? Math.round(targetAttain * 100) : null, info: targetInfo, score: Math.round(targetScore), max: w.target }
  };
}
const DEFAULT_SETTINGS = {
  appName: 'Al-Kahfi Corp',
  appSubtitle: 'MCN TAP · Masjid Affiliate',
  logoEmoji: '🌙',
  logoImage: null,
  customRoles: { ...DEFAULT_ROLE_LABELS },
  jobTitles: [...DEFAULT_JOB_TITLES]
};
function applyRoleLabels(settings) {
  Object.keys(ROLES).forEach(k => {
    ROLES[k].label = (settings?.customRoles?.[k] && settings.customRoles[k].trim()) || DEFAULT_ROLE_LABELS[k];
  });
}

const logActivity = async (text, userName) => {
  const list = await storage.getList('activities:all');
  list.unshift({ id: uid(), text, userName, createdAt: new Date().toISOString() });
  await storage.set('activities:all', list.slice(0, 80));
};

// ============ MAIN APP ============
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [entered, setEntered] = useState(false);

  const refreshAll = async () => {
    const [users, s] = await Promise.all([
      storage.getList('users:list'),
      storage.get('app:settings')
    ]);
    const finalSettings = s || DEFAULT_SETTINGS;
    applyRoleLabels(finalSettings);
    setAllUsers(users);
    setSettings(finalSettings);
    return { users, settings: finalSettings };
  };

  useEffect(() => {
    (async () => {
      try {
        const { users } = await refreshAll();
        const session = await storage.get('current-user', false);
        if (session && users.some(u => u.id === session.id)) {
          const fresh = users.find(u => u.id === session.id);
          setCurrentUser(fresh);
          setEntered(true);
        }
        const sidebarPref = await storage.get('ui:sidebar-open', false);
        if (sidebarPref !== null && typeof sidebarPref === 'boolean') setSidebarOpen(sidebarPref);
      } catch (e) {
        console.error('Load awal gagal (akan dicoba ulang):', e?.message || e);
      } finally {
        setLoading(false); // jangan nyangkut di layar loading walau server sempat gagal
      }
    })();
  }, []);

  // Auto-backup harian: jalan 1x saat ada user login (dijaga agar maksimal 1x/hari)
  useEffect(() => {
    if (!currentUser?.id) return;
    autoBackupIfDue(currentUser.name);          // snapshot ke server (Supabase)
    driveAutoBackupIfDue(currentUser.name);     // snapshot ke Google Drive (kalau diaktifkan)
  }, [currentUser?.id]);

  const toggleSidebar = async () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    await storage.set('ui:sidebar-open', next, false);
  };

  const handleProfileSave = async (updates) => {
    const list = await storage.getList('users:list');
    const updated = list.map(u => u.id === currentUser.id ? { ...u, ...updates } : u);
    await storage.set('users:list', updated);
    await refreshAll();
    const fresh = updated.find(u => u.id === currentUser.id);
    if (fresh) setCurrentUser(fresh);
    await logActivity(`memperbarui profil`, fresh?.name || currentUser.name);
  };

  const handlePasswordChange = async ({ salt, passwordHash }) => {
    const list = await storage.getList('users:list');
    const updated = list.map(u => u.id === currentUser.id ? { ...u, salt, passwordHash } : u);
    await storage.set('users:list', updated);
    await refreshAll();
    const fresh = updated.find(u => u.id === currentUser.id);
    if (fresh) setCurrentUser(fresh);
    await logActivity(`mengganti password sendiri`, fresh?.name || currentUser.name);
  };

  const handleLogin = async (user) => {
    await storage.set('current-user', { id: user.id }, false);
    setCurrentUser(user);
  };
  const handleLogout = async () => {
    await storage.delete('current-user', false);
    setCurrentUser(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Memuat...</div>;
  }

  if (!currentUser && !entered) {
    return <LandingPage settings={settings} onGetStarted={() => setEntered(true)} />;
  }
  if (allUsers.length === 0) {
    return <FirstTimeSetup settings={settings} onComplete={async u => { await refreshAll(); handleLogin(u); }} />;
  }
  if (!currentUser) {
    return <LoginScreen allUsers={allUsers} settings={settings} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FE]" style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div className="flex">
        <Sidebar view={view} setView={setView} user={currentUser} settings={settings} onLogout={handleLogout}
          isOpen={sidebarOpen} onToggle={toggleSidebar}
          mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)}
          onOpenProfile={() => setShowProfile(true)} />
        {/* Backdrop untuk drawer mobile */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}
        <main className={`flex-1 min-h-screen transition-all duration-200 ml-0 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
          <TopBar user={currentUser} onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onOpenProfile={() => setShowProfile(true)}
            setView={setView} allUsers={allUsers} />
          <div className="p-4 sm:p-6 lg:p-8 animate-fade-in" key={view}>
            {view === 'dashboard' && <Dashboard user={currentUser} allUsers={allUsers} setView={setView} settings={settings} />}
            {view === 'tasks' && <TasksView user={currentUser} allUsers={allUsers} />}
            {view === 'todos' && <TodosView user={currentUser} allUsers={allUsers} />}
            {view === 'creators' && <CreatorsView user={currentUser} allUsers={allUsers} />}
            {view === 'creator-management' && <CreatorManagementView user={currentUser} allUsers={allUsers} />}
            {view === 'sellers' && <SellersView user={currentUser} allUsers={allUsers} />}
            {view === 'tap-commission' && <TapCommissionView user={currentUser} />}
            {view === 'partner-feedback' && <PartnerFeedbackView user={currentUser} />}
            {view === 'gmv' && <GmvView user={currentUser} allUsers={allUsers} />}
            {view === 'keuangan' && <KeuanganView user={currentUser} allUsers={allUsers} />}
            {view === 'affiliate-accounts' && <AffiliateAccountsView user={currentUser} allUsers={allUsers} />}
            {view === 'kpi' && <KpiView user={currentUser} allUsers={allUsers} />}
            {view === 'problems' && <ProblemsView user={currentUser} allUsers={allUsers} />}
            {view === 'reports' && <ReportsView user={currentUser} allUsers={allUsers} />}
            {view === 'daily-reports' && <DailyReportsView user={currentUser} allUsers={allUsers} />}
            {view === 'calendar' && <CalendarView user={currentUser} allUsers={allUsers} />}
            {view === 'attendance' && <AttendanceView user={currentUser} allUsers={allUsers} />}
            {view === 'leaderboard' && <LeaderboardView allUsers={allUsers} />}
            {view === 'announcements' && <AnnouncementsView user={currentUser} />}
            {view === 'feedback' && <FeedbackView user={currentUser} allUsers={allUsers} />}
            {view === 'content-ideas' && <ContentIdeasView user={currentUser} allUsers={allUsers} settings={settings} />}
            {view === 'media-tasks' && <MediaTasksView user={currentUser} allUsers={allUsers} />}
            {view === 'users' && <UsersView user={currentUser} allUsers={allUsers} settings={settings} onRefresh={refreshAll} />}
            {view === 'settings' && <SettingsView user={currentUser} settings={settings} onSave={async s => { await storage.set('app:settings', s); await refreshAll(); }} />}
          </div>
        </main>
      </div>
      {showProfile && (
        <ProfileModal user={currentUser}
          onSaveProfile={handleProfileSave}
          onChangePassword={handlePasswordChange}
          onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}

// ============ FIRST TIME SETUP ============
// ============ LANDING PAGE (Homepage) ============
function LandingPage({ settings, onGetStarted }) {
  const navLinks = ['Beranda', 'Fitur', 'Tim', 'Laporan', 'Kontak'];
  const stats = [
    { value: '400+', label: 'Creator Dikelola' },
    { value: 'Rp 1M+', label: 'Target GMV / Bulan' },
    { value: '8', label: 'Divisi Tim' },
    { value: '24/7', label: 'Akses Multi-Device' }
  ];
  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #060B18 0%, #0A1430 45%, #0B1B45 80%, #081026 100%)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); .font-display { font-family: 'Inter', system-ui, sans-serif; letter-spacing: -0.025em; }`}</style>

      {/* Glow orbs biru elektrik */}
      <div className="absolute pointer-events-none" style={{ top: '-15%', right: '-10%', width: '55vw', height: '55vw', background: 'radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 65%)' }}></div>
      <div className="absolute pointer-events-none" style={{ bottom: '-20%', left: '-12%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 65%)' }}></div>
      <div className="absolute pointer-events-none" style={{ top: '35%', left: '40%', width: '24vw', height: '24vw', background: 'radial-gradient(circle, rgba(96,165,250,0.14) 0%, transparent 70%)' }}></div>
      {/* Bintik cahaya */}
      <div className="absolute top-24 right-1/4 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#60A5FA', boxShadow: '0 0 12px rgba(96,165,250,0.9)' }}></div>
      <div className="absolute top-1/2 left-16 w-1 h-1 rounded-full" style={{ backgroundColor: '#93C5FD', boxShadow: '0 0 8px rgba(147,197,253,0.8)' }}></div>
      <div className="absolute bottom-32 right-16 w-2 h-2 rounded-full" style={{ backgroundColor: '#3B82F6', boxShadow: '0 0 14px rgba(59,130,246,0.9)' }}></div>

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 sm:px-12 lg:px-16 py-5">
        <div className="flex items-center gap-3">
          <div style={{ boxShadow: '0 8px 24px -6px rgba(37,99,235,0.7)' }}
            className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-xl overflow-hidden ring-1 ring-white/25">
            {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
          </div>
          <div>
            <div className="font-display font-bold text-white text-base leading-tight">{settings.appName}</div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: '#60A5FA' }}>{settings.appSubtitle}</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-7">
          {navLinks.map((l, i) => (
            <button key={i} onClick={onGetStarted}
              className="text-sm font-medium transition hover:text-white"
              style={{ color: i === 0 ? '#FFFFFF' : '#94A3B8' }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={onGetStarted}
          style={{ boxShadow: '0 10px 30px -8px rgba(37,99,235,0.8)' }}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-full transition flex items-center gap-2">
          Masuk <ArrowRight className="w-4 h-4" />
        </button>
      </nav>

      {/* Hero */}
      <div className="relative z-10 grid lg:grid-cols-2 gap-10 px-6 sm:px-12 lg:px-16 pt-8 lg:pt-16 pb-10 items-center max-w-7xl mx-auto">
        {/* Left: copy */}
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-bold mb-5" style={{ color: '#60A5FA' }}>
            <span className="w-8 h-px" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }}></span>
            WE MANAGE · WE BUILD · WE GROW
          </div>
          <h1 className="font-display font-extrabold leading-[1.02] tracking-tight text-white"
            style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4.2rem)' }}>
            Satu Dashboard,<br />
            <span style={{
              background: 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 60%, #2563EB 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>Semua Terkendali.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed max-w-md" style={{ color: '#94A3B8' }}>
            Sistem manajemen tim {settings.appName} — tugas, absensi, creator, GMV, laporan, dan KPI dalam satu tempat. Rapi, terukur, profesional.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <button onClick={onGetStarted}
              style={{ boxShadow: '0 16px 40px -10px rgba(37,99,235,0.9)' }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-7 py-3.5 rounded-full transition hover:scale-[1.03] active:scale-95 shine-hover">
              Buka Dashboard <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={onGetStarted}
              className="inline-flex items-center gap-2 text-white font-semibold text-sm px-6 py-3.5 rounded-full transition border border-white/20 hover:bg-white/10 backdrop-blur">
              Lihat Fitur
            </button>
          </div>
        </div>

        {/* Right: mockup dashboard 3D melayang */}
        <div className="relative h-[340px] sm:h-[420px] scene-3d hidden sm:block">
          {/* Kartu utama (glass, miring 3D) */}
          <div className="card-3d animate-float absolute left-0 right-10 top-8 rounded-2xl p-4 backdrop-blur-xl glow-blue-soft"
            style={{ backgroundColor: 'rgba(13,25,55,0.75)', border: '1px solid rgba(96,165,250,0.25)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm overflow-hidden">
                  {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
                </div>
                <div className="text-white text-xs font-bold">{settings.appName}</div>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400/80"></div>
                <div className="w-2 h-2 rounded-full bg-amber-400/80"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400/80"></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[['GMV Bulan Ini', 'Rp 3,7M', true], ['Creator Aktif', '414', false], ['Tugas Selesai', '78%', false]].map(([l, v, hl], i) => (
                <div key={i} className="rounded-xl p-2.5" style={hl
                  ? { backgroundColor: 'rgba(37,99,235,0.3)', border: '1px solid rgba(96,165,250,0.4)' }
                  : { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[8px] uppercase font-bold tracking-wide" style={{ color: hl ? '#93C5FD' : '#64748B' }}>{l}</div>
                  <div className="text-sm font-display font-bold text-white mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            {/* Mini line chart */}
            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold" style={{ color: '#94A3B8' }}>Traffic GMV — 13 hari</span>
                <span className="text-[9px] font-bold" style={{ color: '#34D399' }}>▲ 133%</span>
              </div>
              <svg viewBox="0 0 200 50" className="w-full h-12">
                <defs>
                  <linearGradient id="landArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3B82F6" stopOpacity="0.4" />
                    <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points="0,38 20,30 40,34 60,22 80,26 100,14 120,20 140,10 160,16 180,6 200,12 200,50 0,50" fill="url(#landArea)" />
                <polyline points="0,38 20,30 40,34 60,22 80,26 100,14 120,20 140,10 160,16 180,6 200,12" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
                <circle cx="200" cy="12" r="3" fill="#60A5FA" />
              </svg>
            </div>
          </div>

          {/* Kartu kecil: Tim (kanan atas, 3D miring kanan) */}
          <div className="card-3d-r animate-float-slow absolute -right-2 top-0 rounded-2xl px-4 py-3 backdrop-blur-xl"
            style={{ backgroundColor: 'rgba(13,25,55,0.85)', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 20px 50px -12px rgba(37,99,235,0.6)' }}>
            <div className="text-[9px] font-bold uppercase tracking-wide mb-2" style={{ color: '#93C5FD' }}>Tim Solid</div>
            <div className="flex -space-x-2">
              {['A', 'S', 'F', 'T'].map((c, i) => (
                <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${['#3B82F6', '#2563EB', '#1D4ED8', '#60A5FA'][i]}, #1E40AF)`, border: '2px solid #0D1937' }}>
                  {c}
                </div>
              ))}
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-blue-200 bg-white/10" style={{ border: '2px solid #0D1937' }}>+10</div>
            </div>
          </div>

          {/* Kartu kecil: notifikasi target (kiri bawah) */}
          <div className="card-3d animate-float absolute left-4 bottom-2 rounded-2xl px-4 py-3 backdrop-blur-xl"
            style={{ backgroundColor: 'rgba(13,25,55,0.85)', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 20px 50px -12px rgba(37,99,235,0.55)', animationDelay: '1.2s' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(52,211,153,0.2)' }}>
                <Target className="w-4 h-4" style={{ color: '#34D399' }} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-white">Goal 1 Miliar</div>
                <div className="text-[9px]" style={{ color: '#94A3B8' }}>Breakdown per akun ✓</div>
              </div>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden mt-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full" style={{ width: '68%', background: 'linear-gradient(90deg, #34D399, #10B981)' }}></div>
            </div>
          </div>

          {/* Kartu mini: bar chart (kanan bawah) */}
          <div className="card-3d-r animate-float-slow absolute right-6 bottom-10 rounded-2xl px-3.5 py-3 backdrop-blur-xl"
            style={{ backgroundColor: 'rgba(13,25,55,0.85)', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 20px 50px -12px rgba(37,99,235,0.55)', animationDelay: '0.6s' }}>
            <div className="text-[8px] uppercase font-bold mb-1.5" style={{ color: '#64748B' }}>Pekan Ini</div>
            <div className="flex items-end gap-1 h-9">
              {[40, 60, 45, 80, 95].map((h, i) => (
                <div key={i} className="w-1.5 rounded-t" style={{ height: `${h}%`, background: i >= 3 ? 'linear-gradient(180deg, #60A5FA, #2563EB)' : 'rgba(96,165,250,0.4)' }}></div>
              ))}
            </div>
            <div className="text-[9px] font-bold mt-1" style={{ color: '#60A5FA' }}>↗ +24%</div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative z-10 px-6 sm:px-12 lg:px-16 pb-12 max-w-7xl mx-auto">
        <div className="rounded-2xl backdrop-blur-xl grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {stats.map((s, i) => (
            <div key={i} className="px-6 py-5 text-center">
              <div className="font-display font-bold text-white text-2xl">{s.value}</div>
              <div className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="text-center text-[11px] mt-6" style={{ color: '#475569' }}>
          © {new Date().getFullYear()} Al-Kahfi Corp · Built for Affiliate Agency
        </div>
      </div>
    </div>
  );
}

// ============ FIRST TIME SETUP ============
function FirstTimeSetup({ settings, onComplete }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', confirmPassword: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.username.trim() || !form.password) return setError('Lengkapi semua field.');
    if (form.password.length < 6) return setError('Password minimal 6 karakter.');
    if (form.password !== form.confirmPassword) return setError('Konfirmasi password tidak cocok.');
    if (!/^[a-z0-9_.]+$/.test(form.username)) return setError('Username hanya boleh huruf kecil, angka, titik, dan underscore.');
    setBusy(true);
    const salt = genSalt();
    const passwordHash = await hashPassword(form.password, salt);
    const newUser = {
      id: uid(), name: form.name.trim(), username: form.username.trim().toLowerCase(),
      role: 'owner', leaderId: null, salt, passwordHash,
      joinedAt: new Date().toISOString(), createdById: null
    };
    await storage.set('users:list', [newUser]);
    await logActivity(`bergabung sebagai Owner (pertama kali)`, newUser.name);
    setBusy(false);
    onComplete(newUser);
  };

  return (
    <AuthShell settings={settings}>
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 rounded-full text-xs font-bold mb-4 border border-blue-200/60 shadow-sm">
          <Crown className="w-3.5 h-3.5" /> SETUP PERTAMA
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Daftarkan Akun Owner</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">Akun pertama otomatis jadi Owner dengan akses penuh ke seluruh sistem.</p>
      </div>
      <div className="space-y-3.5">
        <Field label="Nama Lengkap">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Mis. Al-Kahfi"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition" />
        </Field>
        <Field label="Username (untuk login)">
          <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
            placeholder="mis. alkahfi"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] lowercase transition" />
        </Field>
        <Field label="Password (minimal 6 karakter)">
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] pr-10 transition" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <Field label="Konfirmasi Password">
          <input type={show ? 'text' : 'password'} value={form.confirmPassword}
            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition" />
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-xl flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
        <button onClick={submit} disabled={busy}
          className="w-full bg-gradient-to-r from-[#2563EB] to-blue-700 hover:from-[#2563EB] hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 flex items-center justify-center gap-2 mt-2">
          <Crown className="w-4 h-4" /> {busy ? 'Memproses...' : 'Daftar & Masuk sebagai Owner'}
        </button>
        <p className="text-[11px] text-center text-slate-500 mt-3 leading-relaxed">
          <Shield className="w-3 h-3 inline -mt-0.5 mr-1 text-blue-600" />
          Akses pertama otomatis menjadi Owner utama. Anda bisa tambahkan Manajer, Leader & Karyawan dari menu "Anggota Tim".
        </p>
      </div>
    </AuthShell>
  );
}

// ============ LOGIN SCREEN ============
function LoginScreen({ allUsers, settings, onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!form.username.trim() || !form.password) return setError('Lengkapi username dan password.');
    setBusy(true);
    const user = allUsers.find(u => u.username === form.username.trim().toLowerCase());
    if (!user) { setBusy(false); return setError('Username tidak ditemukan.'); }
    const hash = await hashPassword(form.password, user.salt);
    if (hash !== user.passwordHash) { setBusy(false); return setError('Password salah.'); }
    setBusy(false);
    onLogin(user);
  };

  return (
    <AuthShell settings={settings}>
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-blue-800 rounded-full text-xs font-bold mb-4 border border-blue-200/60">
          <Lock className="w-3.5 h-3.5" /> SELAMAT DATANG KEMBALI
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Masuk ke Sistem</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">Gunakan username dan password Anda untuk lanjut.</p>
      </div>
      <div className="space-y-3.5">
        <Field label="Username">
          <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="mis. alkahfi"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] lowercase transition" />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] pr-10 transition" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-xl flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
        <button onClick={submit} disabled={busy}
          className="w-full bg-gradient-to-r from-[#2563EB] to-blue-700 hover:from-[#2563EB] hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 flex items-center justify-center gap-2 mt-2">
          <Lock className="w-4 h-4" /> {busy ? 'Memproses...' : 'Masuk ke Dashboard'}
        </button>
        <p className="text-[11px] text-center text-slate-500 mt-3 leading-relaxed">
          <Shield className="w-3 h-3 inline -mt-0.5 mr-1 text-blue-600" />
          Lupa password? Hubungi Manajer atau Leader Anda untuk reset.
        </p>
      </div>
    </AuthShell>
  );
}

function AuthShell({ settings, children }) {
  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); .font-display { font-family: 'Inter', system-ui, sans-serif; letter-spacing: -0.025em; }`}</style>

      {/* LEFT: Landing-style Hero panel (hidden on mobile) */}
      <div style={{ background: 'linear-gradient(160deg, #060B18 0%, #0A1430 50%, #0B1B45 100%)', color: '#FFFFFF' }}
        className="hidden lg:flex lg:w-1/2 xl:w-[58%] relative overflow-hidden text-white">

        {/* Organic wave shapes (background blobs) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 1000" xmlns="http://www.w3.org/2000/svg">
          {/* Top-right blue blob */}
          <path d="M 800 0 Q 720 80 760 200 Q 800 320 700 380 Q 600 440 680 540 Q 760 640 720 720 L 800 720 Z"
            fill="rgba(59, 130, 246, 0.10)" />
          {/* Mid wave */}
          <path d="M 0 500 Q 200 460 320 540 Q 440 620 600 580 Q 720 540 800 600 L 800 1000 L 0 1000 Z"
            fill="rgba(30, 58, 138, 0.35)" />
          {/* Bottom wave */}
          <path d="M 0 700 Q 160 660 280 720 Q 400 780 540 740 Q 660 700 800 760 L 800 1000 L 0 1000 Z"
            fill="rgba(8, 16, 38, 0.6)" />
        </svg>

        {/* Subtle islamic geometric pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.05] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="islamicGeo" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M60 10 L110 60 L60 110 L10 60 Z" fill="none" stroke="white" strokeWidth="1"/>
              <path d="M60 30 L90 60 L60 90 L30 60 Z" fill="none" stroke="white" strokeWidth="0.8"/>
              <circle cx="60" cy="60" r="2" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#islamicGeo)"/>
        </svg>

        {/* Glow accents */}
        <div className="absolute -left-32 -top-32 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'rgba(37, 99, 235, 0.28)' }}></div>
        <div className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'rgba(59, 130, 246, 0.22)' }}></div>

        {/* Decorative dots (like clouds in reference) */}
        <div className="absolute top-32 right-24 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#60A5FA', boxShadow: '0 0 14px rgba(96,165,250,0.8)' }}></div>
        <div className="absolute top-52 right-44 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#93C5FD', opacity: 0.7, boxShadow: '0 0 8px rgba(147,197,253,0.6)' }}></div>
        <div className="absolute bottom-72 left-32 w-1 h-1 rounded-full" style={{ backgroundColor: '#60A5FA', opacity: 0.8, boxShadow: '0 0 6px rgba(96,165,250,0.6)' }}></div>

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14 w-full">

          {/* Top: Brand + nav-style pills */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 backdrop-blur rounded-2xl flex items-center justify-center text-2xl overflow-hidden shadow-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}>
                {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
              </div>
              <div>
                <h1 style={{ color: '#FFFFFF' }} className="font-display text-xl font-bold">{settings.appName}</h1>
                <p style={{ color: '#60A5FA' }} className="text-[10px] uppercase tracking-[0.2em] font-bold">{settings.appSubtitle}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5 flex-wrap">
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#FFFFFF' }}
                className="text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">Agency</span>
              <span style={{ backgroundColor: 'rgba(59,130,246,0.18)', border: '1px solid rgba(96,165,250,0.4)', color: '#93C5FD' }}
                className="text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">Team Suite</span>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#FFFFFF' }}
                className="text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">v1.0</span>
            </div>
          </div>

          {/* Center: Hero copy + dashboard preview */}
          <div className="flex-1 flex flex-col justify-center py-8 gap-7">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-bold mb-3"
                style={{ color: '#60A5FA' }}>
                <span className="w-8 h-px" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }}></span>
                MASJID AFFILIATE AGENCY
              </div>
              <h2 className="font-display font-bold leading-[0.95] mb-4 text-5xl xl:text-6xl">
                <span style={{ color: '#FFFFFF' }}>Kelola Tim</span><br/>
                <span style={{ color: '#FFFFFF' }}>Agency</span><br/>
                <span style={{
                  background: 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 60%, #2563EB 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>Lebih Rapi.</span>
              </h2>
              <p style={{ color: 'rgba(191,219,254,0.85)' }} className="text-base leading-relaxed max-w-md">
                Satu dashboard untuk tugas, creator, laporan, jadwal live, dan performa tim — semua terkontrol dari satu tempat.
              </p>
            </div>

            {/* Dashboard mockup preview (decorative, 3D melayang) */}
            <div className="relative max-w-md mt-2 scene-3d">
              {/* Main "browser window" */}
              <div className="card-3d animate-float rounded-2xl p-3 backdrop-blur-md glow-blue-soft"
                style={{ backgroundColor: 'rgba(13,25,55,0.7)', border: '1px solid rgba(96,165,250,0.25)' }}>
                {/* Window chrome dots */}
                <div className="flex gap-1.5 mb-3 pl-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F87171' }}></div>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FBBF24' }}></div>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#34D399' }}></div>
                </div>
                {/* 3 stat cards row */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="text-[8px] uppercase font-bold" style={{ color: 'rgba(209,250,229,0.7)' }}>Tugas</div>
                    <div className="text-base font-display font-bold" style={{ color: '#FFFFFF' }}>12</div>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="text-[8px] uppercase font-bold" style={{ color: 'rgba(209,250,229,0.7)' }}>Creator</div>
                    <div className="text-base font-display font-bold" style={{ color: '#FFFFFF' }}>48</div>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(37,99,235,0.28)', border: '1px solid rgba(96,165,250,0.4)' }}>
                    <div className="text-[8px] uppercase font-bold" style={{ color: '#93C5FD' }}>GMV</div>
                    <div className="text-base font-display font-bold" style={{ color: '#BFDBFE' }}>Rp 3,7M</div>
                  </div>
                </div>
                {/* Target row */}
                <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#60A5FA', boxShadow: '0 0 8px rgba(96,165,250,0.8)' }}></div>
                      <span className="text-[9px] font-semibold" style={{ color: 'rgba(191,219,254,0.95)' }}>Goal Affiliator 1M</span>
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: '#60A5FA' }}>68%</span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full" style={{ width: '68%', background: 'linear-gradient(90deg, #60A5FA, #2563EB)' }}></div>
                  </div>
                </div>
              </div>

              {/* Floating notification card (top right) */}
              <div className="absolute -top-5 -right-3 rounded-xl px-3 py-2 flex items-center gap-2 transform rotate-[4deg] animate-float-slow"
                style={{ backgroundColor: '#FFFFFF', color: '#111827', boxShadow: '0 18px 44px -12px rgba(37,99,235,0.6)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                  <Check className="w-3 h-3" style={{ color: '#1D4ED8' }} />
                </div>
                <div>
                  <div className="text-[9px] font-bold" style={{ color: '#111827' }}>Tugas Selesai</div>
                  <div className="text-[8px]" style={{ color: '#64748B' }}>Review video creator</div>
                </div>
              </div>

              {/* Floating user card (bottom left) */}
              <div className="absolute -bottom-4 -left-6 rounded-xl px-3 py-2 flex items-center gap-2 transform -rotate-[3deg] animate-float"
                style={{ backgroundColor: '#FFFFFF', color: '#111827', boxShadow: '0 18px 44px -12px rgba(37,99,235,0.55)', animationDelay: '0.8s' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ background: 'linear-gradient(135deg, #14B8A6, #1D4ED8)' }}>A</div>
                <div>
                  <div className="text-[10px] font-bold" style={{ color: '#111827' }}>Al-Kahfi</div>
                  <div className="text-[8px] flex items-center gap-1" style={{ color: '#64748B' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22C55E' }}></span>
                    Manajer · Online
                  </div>
                </div>
              </div>

              {/* Floating chart card (right middle) */}
              <div className="absolute top-1/2 -right-8 -translate-y-1/2 rounded-xl px-3 py-2 transform rotate-[6deg] animate-float-slow"
                style={{ backgroundColor: '#FFFFFF', color: '#111827', boxShadow: '0 18px 44px -12px rgba(37,99,235,0.55)', animationDelay: '1.4s' }}>
                <div className="text-[8px] uppercase font-bold mb-1" style={{ color: '#64748B' }}>Pekan Ini</div>
                <div className="flex items-end gap-1 h-8">
                  <div className="w-1.5 rounded-t" style={{ height: '40%', backgroundColor: '#BFDBFE' }}></div>
                  <div className="w-1.5 rounded-t" style={{ height: '60%', backgroundColor: '#93C5FD' }}></div>
                  <div className="w-1.5 rounded-t" style={{ height: '45%', backgroundColor: '#BFDBFE' }}></div>
                  <div className="w-1.5 rounded-t" style={{ height: '80%', backgroundColor: '#3B82F6' }}></div>
                  <div className="w-1.5 rounded-t" style={{ height: '95%', backgroundColor: '#2563EB' }}></div>
                </div>
                <div className="text-[8px] font-bold mt-1" style={{ color: '#1D4ED8' }}>↗ +24%</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] pt-6 border-t" style={{ borderTopColor: 'rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.7)' }}>
            <span>© {new Date().getFullYear()} Al-Kahfi Corp</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> Ter-enkripsi PBKDF2</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Form panel (gelap, kartu form putih melayang) */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #081026 0%, #0A1430 55%, #0B1B45 100%)' }}>
        {/* Glow biru */}
        <div className="absolute top-10 right-10 w-64 h-64 rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: 'rgba(37,99,235,0.25)' }}></div>
        <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full blur-[110px] pointer-events-none" style={{ backgroundColor: 'rgba(59,130,246,0.18)' }}></div>
        <div className="absolute top-1/4 left-1/3 w-1.5 h-1.5 rounded-full pointer-events-none" style={{ backgroundColor: '#60A5FA', boxShadow: '0 0 10px rgba(96,165,250,0.9)' }}></div>

        <div className="relative w-full max-w-md">
          {/* Mobile brand (only on small screens) */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 10px 30px -8px rgba(37,99,235,0.8)' }}>
              {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">{settings.appName}</h1>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#60A5FA' }}>{settings.appSubtitle}</p>
            </div>
          </div>

          {/* Form card — melayang dengan glow 3D */}
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-white/20"
            style={{ boxShadow: '0 30px 80px -16px rgba(37,99,235,0.5), 0 8px 24px rgba(2,6,23,0.6)' }}>
            {children}
          </div>

          <div className="text-center text-[11px] mt-6" style={{ color: '#475569' }}>
            Powered by Al-Kahfi Corp · Built for Affiliate Agency
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ SIDEBAR ============
function Sidebar({ view, setView, user, settings, onLogout, isOpen, onToggle, mobileOpen, onCloseMobile, onOpenProfile }) {
  const menuGroups = [
    {
      label: 'Utama',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true }
      ]
    },
    {
      label: 'Operasional',
      items: [
        { id: 'tasks', label: 'Tiket', icon: CheckSquare, show: true },
        { id: 'todos', label: 'To-Do Pribadi', icon: KanbanSquare, show: true },
        { id: 'daily-reports', label: 'Laporan Harian', icon: ClipboardList, show: true },
        { id: 'attendance', label: 'Absensi', icon: MapPin, show: true },
        { id: 'calendar', label: 'Kalender Tim', icon: CalendarDays, show: true },
        { id: 'problems', label: 'Masalah & Solusi', icon: AlertCircle, show: true }
      ]
    },
    {
      label: 'Creator & Seller',
      items: [
        { id: 'creators', label: 'Database Creator', icon: Users, show: canAccessFeature(user, 'creators') },
        { id: 'creator-management', label: 'Pengelolaan Creator', icon: Network, show: canAccessFeature(user, 'creator-management') },
        { id: 'sellers', label: 'Database Seller', icon: Briefcase, show: canAccessFeature(user, 'sellers') },
        { id: 'tap-commission', label: 'Kalkulator Komisi', icon: Calculator, show: canAccessFeature(user, 'tap-commission') },
        { id: 'partner-feedback', label: 'Kepuasan Mitra', icon: Heart, show: true },
        { id: 'content-ideas', label: 'Bank Ide Konten', icon: Lightbulb, show: true },
        { id: 'media-tasks', label: 'Eksekusi Konten', icon: Clapperboard, show: canAccessFeature(user, 'media-tasks') }
      ]
    },
    {
      label: 'Laporan & Analitik',
      items: [
        { id: 'gmv', label: 'Target & GMV', icon: BarChart3, show: canAccessFeature(user, 'gmv') },
        { id: 'affiliate-accounts', label: 'Akun Affiliator', icon: Target, show: canAccessFeature(user, 'affiliate-accounts') },
        { id: 'kpi', label: 'KPI Tim', icon: Award, show: true },
        { id: 'reports', label: 'Laporan Mingguan', icon: FileText, show: user.role !== 'operasional' },
        { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, show: true }
      ]
    },
    {
      label: 'Keuangan',
      items: [
        { id: 'keuangan', label: 'Keuangan', icon: Wallet, show: canAccessFeature(user, 'finance') }
      ]
    },
    {
      label: 'Tim & Pengaturan',
      items: [
        { id: 'users', label: 'Anggota Tim', icon: UserCog, show: user.role !== 'operasional' },
        { id: 'announcements', label: 'Pengumuman', icon: Megaphone, show: true },
        { id: 'feedback', label: 'Masukan & Bug', icon: MessageSquare, show: true },
        { id: 'settings', label: 'Pengaturan App', icon: Settings, show: can.editAppSettings(user) }
      ]
    }
  ];
  const RoleIcon = ROLES[user.role].icon;
  // Saat menu dipilih: pindah view + tutup drawer mobile
  const handleNav = (id) => { setView(id); if (onCloseMobile) onCloseMobile(); };
  // Di mobile, sidebar selalu lebar penuh (w-64) walau isOpen=false (itu hanya untuk collapse desktop)
  const mobileWide = mobileOpen;

  return (
    <aside style={{ backgroundColor: '#0B1120', color: '#E2E8F0' }}
      className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-200 border-r border-white/10 z-40
        w-64 ${isOpen ? 'lg:w-64' : 'lg:w-16'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      {/* Tombol tutup drawer (mobile only) */}
      <button onClick={onCloseMobile} title="Tutup menu"
        className="lg:hidden absolute top-3 right-3 z-50 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition">
        <X className="w-5 h-5" />
      </button>
      {/* Brand header */}
      <div className={`${(isOpen || mobileWide) ? 'px-5 py-5' : 'p-3'} border-b border-white/10 flex items-center ${(isOpen || mobileWide) ? 'justify-between gap-2' : 'justify-center lg:justify-center'}`}>
        {(isOpen) ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div style={{ boxShadow: '0 8px 24px -6px rgba(37,99,235,0.55)' }}
                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-xl overflow-hidden flex-shrink-0 ring-1 ring-white/20">
                {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
              </div>
              <div className="min-w-0">
                <div style={{ color: '#F8FAFC' }} className="font-display font-bold text-base truncate">{settings.appName}</div>
                <div style={{ color: '#60A5FA' }} className="text-[9px] uppercase tracking-[0.15em] truncate font-bold">{settings.appSubtitle}</div>
              </div>
            </div>
            <button onClick={onToggle} title="Sembunyikan sidebar"
              className="hidden lg:flex text-slate-500 hover:text-white p-1 flex-shrink-0 transition">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            {/* Mobile: tampilkan brand penuh; Desktop collapsed: cuma logo */}
            <div className="flex lg:hidden items-center gap-3 min-w-0">
              <div style={{ boxShadow: '0 8px 24px -6px rgba(37,99,235,0.55)' }}
                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-xl overflow-hidden flex-shrink-0 ring-1 ring-white/20">
                {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
              </div>
              <div className="min-w-0">
                <div style={{ color: '#F8FAFC' }} className="font-display font-bold text-base truncate">{settings.appName}</div>
                <div style={{ color: '#60A5FA' }} className="text-[9px] uppercase tracking-[0.15em] truncate font-bold">{settings.appSubtitle}</div>
              </div>
            </div>
            <button onClick={onToggle} title="Tampilkan sidebar"
              style={{ boxShadow: '0 8px 24px -6px rgba(37,99,235,0.55)' }}
              className="hidden lg:flex w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl items-center justify-center text-xl overflow-hidden hover:opacity-90 transition ring-1 ring-white/20">
              {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
            </button>
          </>
        )}
      </div>

      {/* Menu groups */}
      <nav className={`flex-1 ${isOpen ? 'px-3 py-4' : 'px-2 py-3'} overflow-y-auto scroll-thin space-y-4`}>
        {menuGroups.map((group, gi) => {
          const visibleItems = group.items.filter(m => m.show);
          if (visibleItems.length === 0) return null;
          return (
            <div key={gi}>
              <div style={{ color: '#5B6B85' }}
                className={`text-[10px] uppercase tracking-[0.16em] font-bold mb-2 px-3 ${isOpen ? '' : 'lg:hidden'}`}>
                {group.label}
              </div>
              {!isOpen && gi > 0 && <div className="hidden lg:block h-px bg-white/10 mx-2 mb-3"></div>}
              <div className="space-y-1">
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const active = view === item.id;
                  return (
                    <button key={item.id} onClick={() => handleNav(item.id)}
                      title={!isOpen ? item.label : undefined}
                      style={active
                        ? { backgroundColor: 'rgba(37,99,235,0.22)', color: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(96,165,250,0.35), 0 6px 18px -8px rgba(37,99,235,0.6)' }
                        : { color: '#94A3B8' }}
                      className={`group w-full flex items-center py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                        isOpen ? 'gap-3 px-3' : 'gap-3 px-3 lg:justify-center lg:gap-0 lg:px-2'
                      } ${active ? '' : 'hover:bg-white/5 hover:text-white'}`}>
                      {active && (
                        <div style={{ backgroundColor: '#3B82F6', boxShadow: '0 0 12px rgba(59,130,246,0.9)' }}
                          className={`absolute -left-3 top-2 bottom-2 w-1 rounded-r-full ${isOpen ? '' : 'lg:hidden'}`}></div>
                      )}
                      <Icon style={{ color: active ? '#60A5FA' : '#64748B' }}
                        className="w-[18px] h-[18px] flex-shrink-0 transition" />
                      <span className={`truncate ${isOpen ? '' : 'lg:hidden'}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User profile bottom */}
      <div className={`border-t border-white/10 ${isOpen ? 'p-3' : 'p-3 lg:p-2'}`}>
        {/* Expanded profile (mobile always, desktop when open) */}
        <div className={isOpen ? 'block' : 'block lg:hidden'}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition">
            <button onClick={onOpenProfile} title="Profil Saya"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden ring-2 ring-blue-400/40 hover:ring-blue-400/80 transition text-white">
              {user.avatarImage
                ? <img src={user.avatarImage} alt="" className="w-full h-full object-cover" />
                : user.name.charAt(0).toUpperCase()}
            </button>
            <button onClick={onOpenProfile} className="flex-1 min-w-0 text-left hover:opacity-90 transition">
              <div style={{ color: '#F1F5F9' }} className="text-sm font-semibold truncate">{user.name}</div>
              <div style={{ color: '#94A3B8' }} className="text-[10px] flex items-center gap-1">
                <RoleIcon className="w-2.5 h-2.5" /> {ROLES[user.role].label}
              </div>
              {displayJobTitle(user) && <div style={{ color: '#60A5FA' }} className="text-[10px] font-medium truncate mt-0.5">{displayJobTitle(user)}</div>}
            </button>
            <button onClick={onLogout} title="Keluar"
              className="text-slate-500 hover:text-red-400 transition p-1">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Collapsed profile (desktop collapsed only) */}
        <div className={isOpen ? 'hidden' : 'hidden lg:flex flex-col items-center gap-2'}>
          <button onClick={onOpenProfile} title={`${user.name} — ${ROLES[user.role].label} (klik untuk profil)`}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-sm overflow-hidden ring-2 ring-blue-400/40 hover:ring-blue-400/80 transition text-white">
            {user.avatarImage
                ? <img src={user.avatarImage} alt="" className="w-full h-full object-cover" />
                : user.name.charAt(0).toUpperCase()}
            </button>
            <button onClick={onLogout} title="Keluar"
              className="text-slate-400 hover:text-red-500 p-1 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
      </div>
    </aside>
  );
}

function TopBar({ user, onToggleSidebar, sidebarOpen, onOpenMobileMenu, onOpenProfile, setView, allUsers }) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ tasks: [], creators: [], users: [] });
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [lastNotifView, setLastNotifView] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [toasts, setToasts] = useState([]);
  const searchRef = useRef();
  const soundOnRef = useRef(true);
  const newestTsRef = useRef(null);
  const firstNotifLoadRef = useRef(true);

  // Sinkron ref dengan state suara
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  // Load preferensi suara
  useEffect(() => {
    (async () => {
      const pref = await storage.get('ui:notif-sound', false);
      if (pref !== null && typeof pref === 'boolean') setSoundOn(pref);
    })();
  }, []);
  const toggleSound = async () => {
    const next = !soundOn;
    setSoundOn(next);
    await storage.set('ui:notif-sound', next, false);
    if (next) playNotifSound(); // tes bunyi saat diaktifkan
  };

  // Load notifications + polling (near-realtime) + suara saat ada notif baru
  useEffect(() => {
    let stopped = false;
    const loadNotifs = async () => {
      const tasks = await loadTasks();
      const announcements = await storage.getList('announcements:all');
      const calEvents = await loadCalendar();
      const leaveReqs = await loadLeaves();
      const lastView = await storage.get('ui:last-notif-view', false);
      if (stopped) return;
      setLastNotifView(lastView?.value || new Date(Date.now() - 7 * 86400000).toISOString());

      const notifs = [];
      // Agenda kalender: pengingat H-1 (sore) dan hari-H (pagi) untuk peserta / agenda umum
      {
        const todayK = dayKey();
        const tomorrowK = dayKey(new Date(Date.now() + 86400000));
        const relevant = (e) => !e.attendeeIds || e.attendeeIds.length === 0 || e.attendeeIds.includes(user.id) || e.createdById === user.id;
        calEvents.filter(e => e.date === todayK && relevant(e)).forEach(e => {
          notifs.push({
            id: `cal-d0-${e.id}`, type: 'calendar',
            title: `📅 Hari ini ${e.time || ''}: ${e.title}`,
            subtitle: `${EVENT_TYPE[e.type]?.label || 'Agenda'}${e.location ? ` · ${e.location.slice(0, 40)}` : ''}`,
            time: `${todayK}T06:30:00`,
            action: () => setView('calendar')
          });
        });
        calEvents.filter(e => e.date === tomorrowK && relevant(e)).forEach(e => {
          notifs.push({
            id: `cal-d1-${e.id}`, type: 'calendar',
            title: `📅 Besok ${e.time || ''}: ${e.title}`,
            subtitle: `Pengingat H-1 · ${EVENT_TYPE[e.type]?.label || 'Agenda'}${e.location ? ` · ${e.location.slice(0, 40)}` : ''}`,
            time: `${todayK}T15:00:00`,
            action: () => setView('calendar')
          });
        });
      }
      // Pengajuan izin: pending → hanya ke Owner/Manajer/Leader (leader: timnya); hasil keputusan → ke pemohon
      if (user.role === 'owner' || user.role === 'manajer' || user.role === 'leader') {
        leaveReqs.filter(l => l.status === 'pending')
          .filter(l => user.role !== 'leader' || (allUsers.find(u => u.id === l.userId)?.leaderId === user.id))
          .slice(0, 8).forEach(l => notifs.push({
            id: `leave-p-${l.id}`, type: 'leave',
            title: `🟡 Pengajuan izin: ${l.userName} · ${fmtDate(l.date)}`,
            subtitle: `${l.type === 'sakit' ? 'Sakit' : 'Izin'} — ${(l.reason || '').slice(0, 50)}`,
            time: l.createdAt,
            action: () => setView('attendance')
          }));
      }
      leaveReqs.filter(l => l.userId === user.id && l.status !== 'pending' && l.decidedAt)
        .slice(0, 5).forEach(l => notifs.push({
          id: `leave-d-${l.id}`, type: 'leave',
          title: `${l.status === 'approved' ? '✅ Izin disetujui' : '❌ Izin ditolak'} · ${fmtDate(l.date)}`,
          subtitle: `oleh ${l.decidedByName || ''}${l.note ? ` — ${l.note.slice(0, 40)}` : ''}`,
          time: l.decidedAt,
          action: () => setView('attendance')
        }));

      // Tiket yang ditugaskan ke saya (termasuk untuk penerima/operasional) — supaya tahu ada tugas baru utk dikerjakan
      tasks.filter(t => t.assigneeId === user.id && t.createdById !== user.id)
        .slice(0, 10).forEach(t => {
          notifs.push({
            id: `task-${t.id}`, type: 'task',
            title: `Tugas baru untukmu: ${t.title}`,
            subtitle: `Dari ${t.createdByName || 'Sistem'}${t.deadline ? ` · deadline ${fmtDate(t.deadline)}` : ''} — segera dikerjakan`,
            time: t.createdAt,
            action: () => setView('tasks')
          });
        });
      // QC: ke PEMBERI tugas saat penerima sudah kirim untuk QC
      tasks.filter(t => t.status === 'qc' && t.createdById === user.id && t.qcSubmittedAt)
        .forEach(t => notifs.push({
          id: `qc-wait-${t.id}-${t.qcSubmittedAt}`, type: 'task',
          title: `🔎 Menunggu QC: ${t.title}`,
          subtitle: `${t.assigneeName || 'Penerima'} sudah selesai — mohon cek & setujui/revisi`,
          time: t.qcSubmittedAt, action: () => setView('tasks')
        }));
      // QC: ke PENERIMA saat ada keputusan QC (revisi / disetujui)
      tasks.filter(t => t.assigneeId === user.id && t.qcDecidedAt && t.qcDecidedById !== user.id)
        .forEach(t => {
          if (t.qcResult === 'revisi' && t.status === 'in_progress') notifs.push({
            id: `qc-rev-${t.id}-${t.qcDecidedAt}`, type: 'task',
            title: `↩ Revisi diminta: ${t.title}`,
            subtitle: `${t.qcDecidedByName || 'Pemberi tugas'}: ${(t.qcNote || 'perlu diperbaiki').slice(0, 50)}`,
            time: t.qcDecidedAt, action: () => setView('tasks')
          });
          if (t.qcResult === 'approved' && t.status === 'done') notifs.push({
            id: `qc-ok-${t.id}-${t.qcDecidedAt}`, type: 'task',
            title: `✅ Tugas disetujui (QC lolos): ${t.title}`,
            subtitle: `Disetujui ${t.qcDecidedByName || 'pemberi tugas'} — kerja bagus!`,
            time: t.qcDecidedAt, action: () => setView('tasks')
          });
        });
      // New comments on my tasks
      tasks.filter(t => (t.createdById === user.id || t.assigneeId === user.id) && t.comments?.length > 0)
        .forEach(t => {
          (t.comments || []).slice(-3).forEach(c => {
            if (c.authorId !== user.id) {
              notifs.push({
                id: `comment-${c.id}`, type: 'comment',
                title: `${c.authorName} komen di tugas`,
                subtitle: `"${t.title.slice(0, 40)}"`,
                time: c.createdAt,
                action: () => setView('tasks')
              });
            }
          });
        });
      // Recent announcements (untuk semua)
      announcements.slice(0, 5).forEach(a => {
        notifs.push({
          id: `ann-${a.id}`, type: 'announcement',
          title: `Pengumuman: ${a.title}`,
          subtitle: `Dari ${a.authorName}`,
          time: a.createdAt,
          action: () => setView('announcements')
        });
      });
      notifs.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
      const top = notifs.slice(0, 15);
      if (stopped) return;
      setNotifications(top);

      // Deteksi notif baru → pop-up toast + bunyi + notif browser
      const newestTs = top.length ? top[0].time : null;
      if (firstNotifLoadRef.current) {
        firstNotifLoadRef.current = false;
        newestTsRef.current = newestTs;
      } else if (newestTs && newestTs > (newestTsRef.current || '')) {
        const prevTs = newestTsRef.current || '';
        newestTsRef.current = newestTs;
        // Semua notif yang lebih baru dari yang terakhir dilihat (maks 3 toast)
        const fresh = top.filter(n => (n.time || '') > prevTs).slice(0, 3);
        if (fresh.length) {
          if (soundOnRef.current) playNotifSound();
          fresh.forEach((n, i) => {
            const toastId = `${n.id}-${Date.now()}-${i}`;
            setToasts(prev => [...prev, { ...n, toastId }]);
            // Auto-hilang setelah 6 detik
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.toastId !== toastId));
            }, 6000);
          });
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try { new Notification(fresh[0].title, { body: fresh[0].subtitle || '' }); } catch (e) {}
          }
        }
      }
    };
    loadNotifs();
    const iv = setInterval(loadNotifs, 12000);
    return () => { stopped = true; clearInterval(iv); };
  }, [user.id]);

  // Global search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ tasks: [], creators: [], users: [] });
      return;
    }
    const q = searchQuery.toLowerCase();
    (async () => {
      const tasks = await loadTasks();
      const creators = await storage.getList('creators:all');
      setSearchResults({
        tasks: tasks.filter(t => can.canSeeTask(user, t, allUsers) &&
          ((t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))).slice(0, 5),
        creators: creators.filter(c => can.canSeeCreator(user, c, allUsers) &&
          ((c.name || '').toLowerCase().includes(q) || (c.username || '').toLowerCase().includes(q))).slice(0, 5),
        users: allUsers.filter(u => (u.name || '').toLowerCase().includes(q) || (u.jobTitle || '').toLowerCase().includes(q)).slice(0, 5)
      });
    })();
  }, [searchQuery, user, allUsers]);

  // Click outside handler
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = useMemo(() => {
    if (!lastNotifView) return 0;
    return notifications.filter(n => (n.time || '') > lastNotifView).length;
  }, [notifications, lastNotifView]);

  // Badge angka di ikon app (PWA terpasang di HP/desktop). Jumlah = notif belum dibaca.
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    try {
      if ('setAppBadge' in navigator) {
        if (unreadCount > 0) navigator.setAppBadge(unreadCount).catch(() => {});
        else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
      }
    } catch (e) {}
  }, [unreadCount]);

  const markNotifSeen = async () => {
    const now = new Date().toISOString();
    await storage.set('ui:last-notif-view', now, false);
    setLastNotifView(now);
  };

  const quickActions = [
    ...(user.role !== 'operasional' ? [{ label: 'Tiket Baru', icon: CheckSquare, view: 'tasks', color: 'text-blue-600 bg-blue-50' }] : []),
    { label: 'Creator Baru', icon: Users, view: 'creators', color: 'text-purple-600 bg-purple-50' },
    { label: 'Laporan Harian', icon: ClipboardList, view: 'daily-reports', color: 'text-blue-600 bg-blue-50' },
    { label: 'Ide Konten Baru', icon: Lightbulb, view: 'content-ideas', color: 'text-amber-600 bg-amber-50' },
    { label: 'Pengumuman', icon: Megaphone, view: 'announcements', color: 'text-rose-600 bg-rose-50' }
  ];

  const hasResults = searchResults.tasks.length + searchResults.creators.length + searchResults.users.length > 0;

  return (
    <>
    {/* Pop-up notifikasi melayang (toast) */}
    {toasts.length > 0 && (
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map(t => {
          const Icon = t.type === 'task' ? CheckSquare : t.type === 'comment' ? MessageSquare : t.type === 'calendar' ? CalendarDays : t.type === 'leave' ? Clock : Megaphone;
          const accent = t.type === 'task' ? '#2563EB' : t.type === 'comment' ? '#9333EA' : t.type === 'calendar' ? '#0284C7' : '#D97706';
          const bg = t.type === 'task' ? '#EFF6FF' : t.type === 'comment' ? '#FAF5FF' : t.type === 'calendar' ? '#E0F2FE' : '#FFFBEB';
          return (
            <button key={t.toastId}
              onClick={() => { t.action && t.action(); setToasts(prev => prev.filter(x => x.toastId !== t.toastId)); }}
              className="pointer-events-auto w-full bg-white rounded-2xl shadow-xl shadow-slate-900/20 border border-slate-200 p-3.5 flex items-start gap-3 text-left animate-[slideIn_0.3s_ease] hover:shadow-2xl transition"
              style={{ borderLeftWidth: '4px', borderLeftColor: accent }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                <Icon className="w-4.5 h-4.5" style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-900 truncate">{t.title}</div>
                {t.subtitle && <div className="text-xs text-slate-500 truncate mt-0.5">{t.subtitle}</div>}
                <div className="text-[10px] text-slate-400 mt-1">Ketuk untuk buka</div>
              </div>
              <span onClick={(e) => { e.stopPropagation(); setToasts(prev => prev.filter(x => x.toastId !== t.toastId)); }}
                className="text-slate-300 hover:text-slate-600 flex-shrink-0 cursor-pointer">
                <X className="w-4 h-4" />
              </span>
            </button>
          );
        })}
      </div>
    )}
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 sm:gap-4">
      {/* Hamburger mobile: buka drawer */}
      <button onClick={onOpenMobileMenu} title="Menu"
        className="lg:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-2 rounded-lg transition flex-shrink-0">
        <PanelLeftOpen className="w-5 h-5" />
      </button>
      {/* Tombol expand desktop saat sidebar collapsed */}
      {!sidebarOpen && (
        <button onClick={onToggleSidebar} title="Tampilkan sidebar"
          className="hidden lg:flex text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-2 rounded-lg transition flex-shrink-0">
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      {/* Greeting */}
      <div className="hidden md:block flex-shrink-0">
        <h2 className="font-display text-base font-bold text-slate-900">{greeting}, {user.name.split(' ')[0]}</h2>
        <p className="text-[10px] text-slate-500">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Search bar */}
      <div ref={searchRef} className="flex-1 max-w-xl mx-auto relative">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${showSearchDropdown ? 'bg-white border-blue-500 ring-2 ring-blue-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input type="text" value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
            onFocus={() => setShowSearchDropdown(true)}
            placeholder="Cari tugas, creator, anggota tim..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showSearchDropdown && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200 max-h-[480px] overflow-y-auto scroll-thin z-50">
            {!hasResults ? (
              <div className="p-6 text-center text-sm text-slate-400">
                Tidak ada hasil untuk "{searchQuery}".
              </div>
            ) : (
              <div className="py-2">
                {searchResults.tasks.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 bg-slate-50/50">Tugas ({searchResults.tasks.length})</div>
                    {searchResults.tasks.map(t => (
                      <button key={t.id} onClick={() => { setView('tasks'); setShowSearchDropdown(false); setSearchQuery(''); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">{t.title}</div>
                          <div className="text-xs text-slate-500 truncate">PIC: {t.assigneeName} · {TASK_STATUS[t.status]?.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.creators.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 bg-slate-50/50">Creator ({searchResults.creators.length})</div>
                    {searchResults.creators.map(c => (
                      <button key={c.id} onClick={() => { setView('creators'); setShowSearchDropdown(false); setSearchQuery(''); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">{c.name}</div>
                          <div className="text-xs text-slate-500 truncate">{c.username ? `@${c.username} · ` : ''}{c.status}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.users.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 bg-slate-50/50">Anggota Tim ({searchResults.users.length})</div>
                    {searchResults.users.map(u => (
                      <button key={u.id} onClick={() => { setView(user.role !== 'operasional' ? 'users' : 'leaderboard'); setShowSearchDropdown(false); setSearchQuery(''); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                          {u.avatarImage ? <img src={u.avatarImage} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">{u.name}</div>
                          <div className="text-xs text-slate-500 truncate">{u.jobTitle || ROLES[u.role]?.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Quick action */}
        <div className="relative">
          <button onClick={() => { setShowQuickAction(!showQuickAction); setShowNotifDropdown(false); }}
            className="bg-gradient-to-r from-violet-600 to-blue-700 hover:from-violet-700 hover:to-blue-800 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/15 transition">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tambah</span>
          </button>
          {showQuickAction && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowQuickAction(false)}></div>
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200 py-2 z-50">
                <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-500">Aksi Cepat</div>
                {quickActions.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <button key={i} onClick={() => { setView(a.view); setShowQuickAction(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 transition flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => {
              setShowNotifDropdown(!showNotifDropdown); setShowQuickAction(false);
              if (!showNotifDropdown) markNotifSeen();
              // Aktifkan audio context (browser butuh interaksi user) + minta izin notif
              if (_notifAudioCtx && _notifAudioCtx.state === 'suspended') _notifAudioCtx.resume();
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().catch(() => {});
              }
            }}
            className="relative text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-2 rounded-xl transition">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifDropdown(false)}></div>
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200 max-h-96 overflow-y-auto scroll-thin z-50">
                <div className="px-4 py-3 border-b border-slate-100 sticky top-0 bg-white flex items-center justify-between gap-2">
                  <div>
                    <div className="font-display font-bold text-slate-900">Notifikasi</div>
                    <div className="text-[10px] text-slate-500">{notifications.length} item</div>
                  </div>
                  <button onClick={toggleSound}
                    title={soundOn ? 'Suara notif: AKTIF (klik untuk matikan)' : 'Suara notif: MATI (klik untuk aktifkan)'}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition ${soundOn ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    {soundOn ? <Bell className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                    {soundOn ? 'Suara ON' : 'Suara OFF'}
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    Tidak ada notifikasi
                  </div>
                ) : (
                  <div>
                    {notifications.map(n => {
                      const isUnread = (n.time || '') > (lastNotifView || '');
                      const icon = n.type === 'task' ? CheckSquare : n.type === 'comment' ? MessageSquare : n.type === 'calendar' ? CalendarDays : n.type === 'leave' ? Clock : Megaphone;
                      const Icon = icon;
                      const color = n.type === 'task' ? 'text-blue-600 bg-blue-50' : n.type === 'comment' ? 'text-purple-600 bg-purple-50' : n.type === 'calendar' ? 'text-sky-600 bg-sky-50' : 'text-amber-600 bg-amber-50';
                      return (
                        <button key={n.id} onClick={() => { n.action(); setShowNotifDropdown(false); }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition flex items-start gap-3 border-b border-slate-50 ${isUnread ? 'bg-blue-50/30' : ''}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 line-clamp-1">{n.title}</div>
                            <div className="text-xs text-slate-500 line-clamp-1">{n.subtitle}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{n.time ? fmtDateTime(n.time) : ''}</div>
                          </div>
                          {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"></div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User chip */}
        <button onClick={onOpenProfile}
          className="hidden md:flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
            {user.avatarImage ? <img src={user.avatarImage} alt="" className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left min-w-0 max-w-[120px]">
            <div className="text-xs font-semibold text-slate-900 truncate">{user.name.split(' ')[0]}</div>
            <div className="text-[9px] text-slate-500 truncate">{user.jobTitle || ROLES[user.role].label}</div>
          </div>
        </button>
      </div>
    </div>
    </>
  );
}

// ============ DASHBOARD ============
function Dashboard({ user, allUsers, setView, settings }) {
  const [tasks, setTasks] = useState([]);
  const [creators, setCreators] = useState([]);
  const [activities, setActivities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [targets, setTargets] = useState([]);
  const [gmvEntries, setGmvEntries] = useState([]);
  const [gmvTargets, setGmvTargets] = useState({});
  const [attendanceRecs, setAttendanceRecs] = useState([]);
  const [problems, setProblems] = useState([]);
  const [kpiConfig, setKpiConfig] = useState(DEFAULT_KPI_CONFIG);
  const [affAccounts, setAffAccounts] = useState([]);
  const [affEntries, setAffEntries] = useState([]);
  const [partnerFeedback, setPartnerFeedback] = useState([]);
  const [externalSwot, setExternalSwot] = useState(null);
  const [lastBackup, setLastBackup] = useState(undefined);
  const [reportTemplates, setReportTemplates] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [showTargetsManager, setShowTargetsManager] = useState(false);

  const loadTargets = async () => setTargets(await storage.getList('targets:all'));

  useEffect(() => {
    (async () => {
      setTasks(await loadTasks());
      setCreators(await storage.getList('creators:all'));
      setActivities(await storage.getList('activities:all'));
      setAnnouncements(await storage.getList('announcements:all'));
      setDailyReports(await loadDailyReports());
      setCalendarEvents(await loadCalendar());
      await syncInternalFromAccounts(); // GMV akun affiliator otomatis masuk divisi internal
      setGmvEntries(await loadGmvEntries());
      setGmvTargets((await storage.get('gmv:targets')) || {});
      setAttendanceRecs(await loadAttendanceRecs());
      setProblems(await storage.getList('problems:all'));
      setKpiConfig((await storage.get('kpi:config')) || DEFAULT_KPI_CONFIG);
      setAffAccounts(await storage.getList('affiliate-accounts:all'));
      setAffEntries(await loadAffEntries());
      setPartnerFeedback(await storage.getList('partner-feedback:all'));
      setExternalSwot(await storage.get('swot:external'));
      setLastBackup(await storage.get('backup:last'));
      setReportTemplates(await storage.getList('daily-report-templates:all'));
      setLeaves(await loadLeaves());
      await loadTargets();
    })();
  }, []);

  // Disiplin backup mingguan (jaring pengaman data — Supabase gratis tidak punya backup otomatis)
  const backupOverdue = (user.role === 'owner' || user.role === 'manajer') && lastBackup !== undefined &&
    (!lastBackup || (Date.now() - new Date(lastBackup.at)) / 86400000 > 7);

  const canManageTargets = (user.role === 'manajer' || user.role === 'owner') || user.role === 'leader';
  const handleSaveTargets = async (newList) => {
    await storage.set('targets:all', newList);
    await logActivity(`mengupdate target tim`, user.name);
    loadTargets();
  };

  const visibleTasks = tasks.filter(t => can.canSeeTask(user, t, allUsers));
  const visibleCreators = creators.filter(c => can.canSeeCreator(user, c, allUsers));
  const myTasks = tasks.filter(t => t.assigneeId === user.id && t.status !== 'done');
  const overdue = myTasks.filter(t => t.deadline && new Date(t.deadline) < new Date()).length;
  const totalGmv = visibleCreators.reduce((s, c) => s + (Number(c.totalGmv) || 0), 0);
  const activeCreators = visibleCreators.filter(c => c.status === 'aktif').length;
  const today = dayKey();
  const upcomingEvents = calendarEvents
    .filter(e => e.date >= today)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 4);
  const latest = announcements[0];

  const visibleMembers = allUsers.filter(u => can.canSeeUser(user, u)).length;

  // Helper: greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  }, []);

  // Today summary helpers
  const deadlineToday = myTasks.filter(t => t.deadline === today);
  const myReportedToday = dailyReports.some(r => r.authorId === user.id && r.date === today);
  const todayEventsCount = calendarEvents.filter(e => e.date === today && e.status !== 'cancelled').length;
  const myCreators = visibleCreators.filter(c => c.managerId === user.id || (user.role === 'manajer' || user.role === 'owner'));
  const myActiveCreators = myCreators.filter(c => c.status === 'aktif').length;

  // Stats with badge status
  const stats = [
    {
      label: 'Tugas Saya', value: myTasks.length,
      sub: 'Yang harus dikerjakan',
      icon: CheckSquare,
      gradient: 'from-blue-500/15 to-cyan-500/15 text-blue-700',
      badge: overdue > 0
        ? { text: `${overdue} Terlambat`, color: 'bg-red-100 text-red-700 border-red-200' }
        : myTasks.length === 0
        ? { text: 'Selesai', color: 'bg-blue-100 text-blue-700 border-blue-200' }
        : { text: 'Aktif', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      action: () => setView('tasks')
    },
    {
      label: 'Creator Dikelola', value: fmtNumber(visibleCreators.length),
      sub: `${activeCreators} aktif dari ${visibleCreators.length}`,
      icon: Users,
      gradient: 'from-purple-500/15 to-pink-500/15 text-purple-700',
      badge: activeCreators > 0
        ? { text: 'Aktif', color: 'bg-blue-100 text-blue-700 border-blue-200' }
        : { text: 'Perlu Follow Up', color: 'bg-amber-100 text-amber-700 border-amber-200' },
      action: () => setView('creators')
    },
    {
      label: 'GMV Total', value: fmtRupiah(totalGmv),
      sub: 'Yang Anda kelola',
      icon: TrendingUp,
      gradient: 'from-amber-500/15 to-orange-500/15 text-amber-700',
      badge: { text: 'Live', color: 'bg-amber-100 text-amber-700 border-amber-200' },
      action: () => setView('leaderboard')
    },
    {
      label: 'Tim Visible', value: visibleMembers,
      sub: 'Anggota di area Anda',
      icon: Briefcase,
      gradient: 'from-violet-500/15 to-blue-500/15 text-violet-700',
      badge: { text: 'Online', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      action: () => user.role !== 'operasional' ? setView('users') : setView('leaderboard')
    }
  ];

  // "Hari Ini" summary mini cards
  const todaySummary = [
    {
      label: 'Tugas Hari Ini', value: deadlineToday.length,
      icon: CheckSquare, iconBg: 'bg-blue-100 text-blue-600',
      sub: deadlineToday.length === 0 ? 'Tidak ada deadline' : 'Deadline hari ini',
      action: () => setView('tasks')
    },
    {
      label: 'Agenda Hari Ini', value: todayEventsCount,
      icon: CalendarDays, iconBg: 'bg-purple-100 text-purple-600',
      sub: todayEventsCount === 0 ? 'Bersih' : 'Event terjadwal',
      action: () => setView('calendar')
    },
    {
      label: 'Laporan Hari Ini', value: myReportedToday ? '✓' : '–',
      icon: ClipboardList, iconBg: myReportedToday ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600',
      sub: myReportedToday ? 'Sudah submit' : 'Belum submit',
      action: () => setView('daily-reports')
    },
    {
      label: 'Creator Aktif', value: myActiveCreators,
      icon: Sparkles, iconBg: 'bg-rose-100 text-rose-600',
      sub: 'Yang Anda kelola',
      action: () => setView('creators')
    },
    (() => {
      // Target Aktif = target GMV divisi bulan ini (dari "Set Target" di Target & GMV) + target tim manual
      const gmvTargetCount = Object.values(gmvTargets[monthKey()] || {}).filter(v => Number(v) > 0).length;
      const manualCount = targets.filter(t => t.status === 'active').length;
      return {
        label: 'Target Aktif', value: gmvTargetCount + manualCount,
        icon: Target, iconBg: 'bg-amber-100 text-amber-600',
        sub: `${gmvTargetCount} target GMV divisi · ${manualCount} target tim`,
        action: () => (gmvTargetCount > 0 || !canManageTargets) ? setView('gmv') : setShowTargetsManager(true)
      };
    })()
  ];

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Pengingat backup mingguan */}
      {backupOverdue && (
        <button onClick={() => setView('settings')}
          className="w-full text-left bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-amber-100 transition">
          <Database className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-amber-800">
            <b>Backup data sudah {lastBackup ? `${Math.floor((Date.now() - new Date(lastBackup.at)) / 86400000)} hari` : 'belum pernah'} dilakukan.</b> Supabase gratis tidak punya backup otomatis — luangkan 30 detik: Pengaturan App → Export Semua Data.
          </div>
          <ArrowRight className="w-4 h-4 text-amber-600 flex-shrink-0" />
        </button>
      )}

      {/* Hero Section — navy gelap + glow biru elektrik (3D look) */}
      <div style={{ background: 'linear-gradient(135deg, #070D1F 0%, #0B1B45 45%, #0A1230 100%)', color: '#FFFFFF', boxShadow: '0 24px 60px -20px rgba(37,99,235,0.45)' }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shine-hover">
        <div style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)' }} className="absolute -right-20 -top-24 w-96 h-96 rounded-full pointer-events-none"></div>
        <div style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 70%)' }} className="absolute right-40 -bottom-20 w-72 h-72 rounded-full pointer-events-none"></div>
        <div style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.18) 0%, transparent 70%)' }} className="absolute -left-16 top-1/2 w-64 h-64 rounded-full pointer-events-none"></div>
        <div className="absolute right-8 top-8 w-2 h-2 bg-blue-400/70 rounded-full" style={{ boxShadow: '0 0 12px rgba(96,165,250,0.9)' }}></div>
        <div className="absolute right-20 top-20 w-1 h-1 bg-blue-300/80 rounded-full" style={{ boxShadow: '0 0 8px rgba(147,197,253,0.9)' }}></div>
        <div className="absolute left-1/2 bottom-6 w-1.5 h-1.5 bg-cyan-300/60 rounded-full" style={{ boxShadow: '0 0 10px rgba(103,232,249,0.8)' }}></div>
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-300 text-[10px] uppercase font-bold tracking-[0.2em] flex items-center gap-1.5">
                <Sparkle className="w-3 h-3" /> {greeting}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
              {user.name.split(' ')[0]}, semangat hari ini!
            </h1>
            <p className="text-blue-100/90 text-sm mt-2 max-w-xl">
              {myTasks.length === 0
                ? 'Tidak ada tugas tertunda. Saatnya cari peluang baru atau push konten viral.'
                : overdue > 0
                ? `${overdue} tugas terlambat dan ${myTasks.length - overdue} aktif. Mulai dari yang paling urgent.`
                : `${myTasks.length} tugas aktif menunggu. Fokus selesaikan satu demi satu.`}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => setView('tasks')}
                style={{ boxShadow: '0 10px 28px -8px rgba(37,99,235,0.7)' }}
                className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" /> Lihat Tiket
              </button>
              <button onClick={() => setView('daily-reports')}
                className="bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 border border-white/20">
                <ClipboardList className="w-3.5 h-3.5" /> Input Laporan
              </button>
              {canManageTargets && (
                <button onClick={() => setShowTargetsManager(true)}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 border border-white/20">
                  <Target className="w-3.5 h-3.5" /> Kelola Target
                </button>
              )}
            </div>
          </div>
          {latest && (
            <button onClick={() => setView('announcements')}
              style={{ boxShadow: '0 16px 44px -16px rgba(59,130,246,0.5)' }}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4 max-w-sm border border-white/15 text-left transition group animate-float-slow">
              <div className="text-[9px] uppercase font-bold tracking-wider text-blue-300 flex items-center gap-1.5">
                <Megaphone className="w-3 h-3" /> Pengumuman Terbaru
              </div>
              <div className="font-semibold text-sm mt-1.5 line-clamp-1 group-hover:text-blue-200 transition">{latest.title}</div>
              <div className="text-[11px] text-blue-100/80 mt-1 line-clamp-2">{latest.content}</div>
              <div className="text-[10px] text-blue-200/60 mt-2">— {latest.authorName}</div>
            </button>
          )}
        </div>
      </div>

      {/* "Hari Ini" Summary */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" /> Hari Ini · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {todaySummary.map((t, i) => {
            const Icon = t.icon;
            return (
              <button key={i} onClick={t.action}
                className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-sm shadow-slate-200/40 lift-3d hover:border-blue-200 text-left group">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-xl ${t.iconBg} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 rotate-[-90deg] transition" />
                </div>
                <div className="text-xl font-display font-bold text-slate-900 tabular-nums">{t.value}</div>
                <div className="text-[11px] text-slate-700 mt-0.5 font-medium">{t.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fokus Hari Ini — 3 prioritas teratas per orang */}
      <FocusTodayWidget user={user} tasks={tasks} dailyReports={dailyReports}
        affAccounts={affAccounts} affEntries={affEntries} problems={problems} templates={reportTemplates} setView={setView} />

      {/* Dashboard Bisnis: Keseluruhan + per-divisi MCN/TAP/Affiliator */}
      {canAccessFeature(user, 'gmv') && (
        <BusinessDashboard gmvEntries={gmvEntries} gmvTargets={gmvTargets}
          affAccounts={affAccounts} affEntries={affEntries} allUsers={allUsers} onNavigate={setView}
          problems={problems} attendance={attendanceRecs} reports={dailyReports} tasks={tasks}
          partnerFeedback={partnerFeedback} externalSwot={externalSwot} settings={settings} user={user} />
      )}

      {/* KPI Saya + Masalah Aktif (ringkasan masalah hanya utk pengelola) */}
      <DashboardKpiProblemRow
        kpi={computeKpi(user.id, { tasks, attendance: attendanceRecs, reports: dailyReports, gmvEntries, gmvTargets, affAccounts, affEntries, allUsers, templates: reportTemplates, leaves }, monthKey(), kpiConfig)}
        target={kpiConfig.targetScore || 85}
        openProblems={problems.filter(p => p.status !== 'resolved')}
        canHandle={user.role === 'owner' || user.role === 'manajer' || user.role === 'leader'}
        showProblems={user.role !== 'operasional'}
        onKpi={() => setView('kpi')} onProblems={() => setView('problems')} />

      {/* Evaluasi otomatis */}
      <DashboardEvalWidget user={user} tasks={tasks} attendance={attendanceRecs} reports={dailyReports}
        gmvEntries={gmvEntries} gmvTargets={gmvTargets} affAccounts={affAccounts} affEntries={affEntries}
        problems={problems} kpiConfig={kpiConfig} allUsers={allUsers} templates={reportTemplates} leaves={leaves} onNavigate={setView} />

      {/* Stats grid - compact with badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <button key={i} onClick={s.action}
              className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm shadow-slate-200/40 lift-3d hover:border-blue-200 text-left group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                {s.badge && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${s.badge.color}`}>
                    {s.badge.text}
                  </span>
                )}
              </div>
              <div className="text-2xl font-display font-bold text-slate-900 tabular-nums">{s.value}</div>
              <div className="text-xs text-slate-600 mt-0.5 font-medium">{s.label}</div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition" /> {s.sub}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900">Tugas Saya</h3>
              <p className="text-xs text-slate-500">Yang harus Anda kerjakan</p>
            </div>
            <button onClick={() => setView('tasks')} className="text-xs text-blue-700 hover:text-blue-800 font-semibold">Lihat semua →</button>
          </div>
          {myTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Check className="w-10 h-10 mx-auto mb-2 text-blue-300" /> Tidak ada tugas terbuka. 🎉
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.slice(0, 5).map(t => {
                const days = daysUntil(t.deadline);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <span className={`w-2 h-2 rounded-full ${TASK_STATUS[t.status].dot}`}></span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-800 truncate">{t.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded ${PRIORITIES[t.priority].color} text-[10px]`}>{PRIORITIES[t.priority].label}</span>
                        {t.deadline && (
                          <span className={`flex items-center gap-1 ${days < 0 ? 'text-red-600 font-semibold' : days <= 1 ? 'text-amber-700' : ''}`}>
                            <Clock className="w-3 h-3" />
                            {days < 0 ? `Terlambat ${Math.abs(days)} hari` : days === 0 ? 'Hari ini' : days === 1 ? 'Besok' : `${days} hari lagi`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900">Agenda Mendatang</h3>
              <p className="text-xs text-slate-500">{upcomingEvents.length} agenda · kalender tim</p>
            </div>
            <button onClick={() => setView('calendar')} className="text-xs text-blue-700 hover:text-blue-800 font-semibold">Semua →</button>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-200" />Belum ada agenda
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(ev => (
                <div key={ev.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{EVENT_TYPE[ev.type]?.icon || '📌'}</span>
                    <span className="text-xs font-semibold text-slate-700">{ev.time}</span>
                    <span className="text-[10px] text-slate-500">{fmtDate(ev.date)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800">{ev.title}</div>
                  {(ev.attendeeNames || []).length > 0 && <div className="text-xs text-slate-500">{ev.attendeeNames.slice(0, 2).join(', ')}{ev.attendeeNames.length > 2 ? ` +${ev.attendeeNames.length - 2}` : ''}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Daily Reports + Today's Events */}
      {(() => {
        const pinned = dailyReports.filter(r => r.pinToDashboard).slice(0, 3);
        const todayEvents = calendarEvents
          .filter(e => e.date === today)
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        if (pinned.length === 0 && todayEvents.length === 0) return null;
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pinned.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                    <Pin className="w-5 h-5 text-blue-600" /> Laporan Pinned
                  </h3>
                  <button onClick={() => setView('daily-reports')} className="text-xs text-blue-700 font-semibold hover:text-blue-800">Semua →</button>
                </div>
                <div className="space-y-3">
                  {pinned.map(r => (
                    <div key={r.id} className="p-3 rounded-lg border border-blue-200 bg-blue-50/30">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-slate-900">{r.authorName}</span>
                        {r.authorJobTitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{r.authorJobTitle}</span>}
                        <span className="text-[10px] text-slate-500">· {fmtDate(r.date)}</span>
                      </div>
                      {(() => {
                        // Get first textarea/text field value to show as preview
                        if (r.fieldsSnapshot) {
                          const previewField = r.fieldsSnapshot.find(f => (f.type === 'textarea' || f.type === 'text') && f.value);
                          return <div className="text-xs text-slate-700 line-clamp-2">{previewField?.value || '-'}</div>;
                        }
                        return <div className="text-xs text-slate-700 line-clamp-2">{r.results || r.activities || '-'}</div>;
                      })()}
                      {(() => {
                        // Show numeric fields as stats
                        const numFields = r.fieldsSnapshot
                          ? r.fieldsSnapshot.filter(f => f.type === 'number' && f.value > 0)
                          : DEFAULT_DAILY_FIELDS.filter(f => f.type === 'number' && r[f.id] > 0).map(f => ({ label: f.label, value: r[f.id] }));
                        if (numFields.length === 0) return null;
                        return (
                          <div className="flex gap-3 text-[10px] text-slate-500 mt-2 flex-wrap">
                            {numFields.slice(0, 3).map((f, i) => (
                              <span key={i}>{f.label}: <b className="text-slate-700">{fmtNumber(f.value)}</b></span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {todayEvents.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-blue-600" /> Agenda Hari Ini
                  </h3>
                  <button onClick={() => setView('calendar')} className="text-xs text-blue-700 font-semibold hover:text-blue-800">Buka Kalender →</button>
                </div>
                <div className="space-y-2">
                  {todayEvents.map(ev => (
                    <div key={ev.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${EVENT_TYPE[ev.type]?.color}`}>{EVENT_TYPE[ev.type]?.icon} {EVENT_TYPE[ev.type]?.label}</span>
                        <span className="text-xs font-semibold text-slate-700">⏰ {ev.time}{ev.endTime && ` – ${ev.endTime}`}</span>
                      </div>
                      <div className="text-sm font-semibold text-slate-800">{ev.title}</div>
                      {ev.location && <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {ev.location.length > 50 ? ev.location.slice(0, 50) + '...' : ev.location}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40">
        <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-600" /> Aktivitas Tim
        </h3>
        {activities.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">Belum ada aktivitas</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto scroll-thin">
            {activities.slice(0, 15).map(a => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <Avatar person={allUsers.find(u => u.name === a.userName) || { name: a.userName }} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-700"><b>{a.userName}</b> {a.text}</div>
                  <div className="text-[10px] text-slate-400">{fmtDateTime(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTargetsManager && <TargetsManagementModal user={user} targets={targets}
        onSave={handleSaveTargets} onClose={() => setShowTargetsManager(false)} />}
    </div>
  );
}

// ============ TARGET WIDGET (Dashboard) ============
// Evaluasi otomatis (rule-based) — baca data, hasilkan insight prioritas
function generateInsights({ user, tasks, attendance, reports, gmvEntries, gmvTargets, affAccounts, affEntries, problems, kpiConfig, allUsers, templates = [], leaves = [] }) {
  const out = [];
  const mk = monthKey();
  const today = dayKey();
  const isOwnerMgr = user.role === 'owner' || user.role === 'manajer';

  // 1) Masalah kritis
  const kritis = problems.filter(p => p.status !== 'resolved' && p.urgency === 'kritis');
  if (kritis.length > 0) out.push({ level: 'danger', text: `${kritis.length} masalah kritis belum selesai: "${kritis[0].title}"${kritis.length > 1 ? ' dll' : ''}.`, action: { label: 'Tangani', view: 'problems' } });

  // 1b) Masalah menua: terbuka > 7 hari = pelanggaran prinsip "selesaikan sampai akar"
  const aging = problems.filter(p => p.status !== 'resolved' && p.createdAt && (Date.now() - new Date(p.createdAt)) / 86400000 > 7);
  if (aging.length > 0) {
    const oldest = aging.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[0];
    const days = Math.floor((Date.now() - new Date(oldest.createdAt)) / 86400000);
    out.push({ level: 'warning', text: `${aging.length} masalah sudah terbuka > 7 hari (terlama: "${oldest.title}", ${days} hari). Selesaikan sampai akar atau tutup dengan keputusan.`, action: { label: 'Bereskan', view: 'problems' } });
  }

  // 2) GMV divisi turun (untuk owner/manajer)
  if (isOwnerMgr) {
    Object.entries(GMV_DIVISIONS).forEach(([div, cfg]) => {
      const series = gmvDailySeries(gmvEntries, div, mk).filter(s => s.value > 0);
      if (series.length >= 2) {
        const t = series[series.length - 1].value, y = series[series.length - 2].value;
        if (y > 0 && t < y) {
          const drop = Math.round(((y - t) / y) * 100);
          if (drop >= 15) out.push({ level: 'warning', text: `GMV ${cfg.label} turun ${drop}% vs kemarin (${fmtRupiah(t)}).`, action: { label: 'Cek', view: 'gmv' } });
        } else if (t > y) {
          const up = Math.round(((t - y) / y) * 100);
          if (up >= 20) out.push({ level: 'good', text: `GMV ${cfg.label} naik ${up}% vs kemarin — pertahankan! 🎉`, action: { label: 'Lihat', view: 'gmv' } });
        }
      }
      // Target bulanan jauh tertinggal
      const target = Number((gmvTargets[mk] || {})[div]) || 0;
      if (target > 0) {
        const total = gmvEntries.filter(e => e.division === div && (e.date || '').startsWith(mk)).reduce((s, e) => s + (Number(e.gmv) || 0), 0);
        const dim = daysInMonth(mk), dayNow = new Date().getDate();
        const expected = target * (dayNow / dim);
        if (total < expected * 0.7) out.push({ level: 'warning', text: `GMV ${cfg.label} baru ${Math.round(total / target * 100)}% dari target bulan ini — perlu dikejar.`, action: { label: 'Detail', view: 'gmv' } });
      }
    });
  }

  // 3) Akun affiliator di bawah target harian hari ini
  if (isOwnerMgr || user.role === 'leader' || (user.division || '') === 'internal') {
    const dim = daysInMonth(mk);
    const behind = [];
    affAccounts.filter(a => a.active !== false).forEach(a => {
      const target = Number(a.targets?.[mk]) || 0;
      if (target <= 0) return;
      const dailyTarget = target / dim;
      const todayVal = affEntries.filter(e => e.accountId === a.id && e.date === today).reduce((s, e) => s + (Number(e.gmv) || 0), 0);
      if (todayVal < dailyTarget) behind.push(a.name);
    });
    if (behind.length > 0) out.push({ level: 'warning', text: `${behind.length} akun affiliator di bawah target harian hari ini: ${behind.slice(0, 3).join(', ')}${behind.length > 3 ? ' dll' : ''}.`, action: { label: 'Cek Akun', view: 'affiliate-accounts' } });
  }

  // 4) Akun tanpa target (untuk leader/owner) — breakdown belum lengkap
  if (isOwnerMgr || user.role === 'leader') {
    const noTarget = affAccounts.filter(a => a.active !== false && !(Number(a.targets?.[mk]) > 0));
    if (noTarget.length > 0) out.push({ level: 'info', text: `${noTarget.length} akun belum diset target bulan ini. Lengkapi breakdown 1 M.`, action: { label: 'Set Target', view: 'affiliate-accounts' } });
  }

  // 5) Belum lapor harian (untuk owner/manajer/leader: tim; lainnya: diri sendiri)
  const scopeUsers = isOwnerMgr ? allUsers : (user.role === 'leader' ? allUsers.filter(u => u.leaderId === user.id || u.id === user.id) : [user]);
  const mustReport = (u) => u.role !== 'operasional' || templates.some(t => t.assignedUserIds?.includes(u.id));
  const reportedToday = new Set(reports.filter(r => r.date === today).map(r => r.authorId));
  const notReported = scopeUsers.filter(u => mustReport(u) && !reportedToday.has(u.id));
  if (isOwnerMgr || user.role === 'leader') {
    if (notReported.length > 0 && new Date().getHours() >= 12) out.push({ level: 'info', text: `${notReported.length} dari ${scopeUsers.length} anggota belum lapor harian.`, action: { label: 'Lihat', view: 'daily-reports' } });
  } else {
    if (mustReport(user) && !reportedToday.has(user.id) && new Date().getHours() >= 12) out.push({ level: 'warning', text: `Anda belum mengisi laporan harian hari ini.`, action: { label: 'Lapor', view: 'daily-reports' } });
  }

  // 6) KPI pribadi
  const myKpi = computeKpi(user.id, { tasks, attendance, reports, gmvEntries, gmvTargets, affAccounts, affEntries, allUsers, templates, leaves }, mk, kpiConfig);
  const target = kpiConfig.targetScore || 85;
  if (myKpi.total < target) {
    const weak = [];
    if (myKpi.attendance.score < kpiConfig.weights.attendance * 0.7) weak.push('kehadiran');
    if (myKpi.tasks.score < kpiConfig.weights.tasks * 0.7) weak.push('tugas');
    if (myKpi.reports.score < kpiConfig.weights.reports * 0.7) weak.push('laporan harian');
    out.push({ level: 'info', text: `KPI Anda ${myKpi.total} (target ${target}).${weak.length ? ' Tingkatkan: ' + weak.join(', ') + '.' : ''}`, action: { label: 'Lihat KPI', view: 'kpi' } });
  } else {
    out.push({ level: 'good', text: `KPI Anda ${myKpi.total} — Mumtaz! Pertahankan. ⭐`, action: { label: 'Lihat', view: 'kpi' } });
  }

  // 7) Tugas overdue pribadi
  const myOverdue = tasks.filter(t => t.assigneeId === user.id && t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date());
  if (myOverdue.length > 0) out.push({ level: 'danger', text: `${myOverdue.length} tugas Anda sudah lewat deadline.`, action: { label: 'Kerjakan', view: 'tasks' } });

  // Urutkan: danger > warning > info > good, ambil maksimal 6
  const rank = { danger: 0, warning: 1, info: 2, good: 3 };
  out.sort((a, b) => rank[a.level] - rank[b.level]);
  return out.slice(0, 6);
}

// ============ DASHBOARD BISNIS (Keseluruhan + per-divisi MCN/TAP/Affiliator) ============
function BusinessDashboard({ gmvEntries, gmvTargets, affAccounts, affEntries, allUsers, onNavigate, problems = [], attendance = [], reports = [], tasks = [], partnerFeedback = [], externalSwot = null, settings, user }) {
  const [scope, setScope] = useState('all'); // all | mcn | tap | internal
  const [affGoal, setAffGoal] = useState(DEFAULT_AFFILIATE_GOAL);
  const [showPpt, setShowPpt] = useState(false);
  const [extSwot, setExtSwot] = useState(externalSwot);
  useEffect(() => { setExtSwot(externalSwot); }, [externalSwot]);
  const mKey = monthKey();

  // Staff terkunci ke divisinya sendiri (MCN ya MCN saja) — SWOT/kontribusi/PPT khusus pengelola
  const isMgmtUser = !user || user.role !== 'operasional' || (user.division || '') === 'manajemen' || (user.division || '') === 'keuangan';
  const lockedDiv = !isMgmtUser && GMV_DIVISIONS[user.division] ? user.division : null;
  useEffect(() => { if (lockedDiv) setScope(lockedDiv); }, [lockedDiv]);
  const dim = daysInMonth(mKey);
  const monthLabel = (() => { const [y, m] = mKey.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); })();

  useEffect(() => { (async () => { const g = await storage.get('affiliate:goal'); if (g && g[mKey]) setAffGoal(g[mKey]); })(); }, [mKey]);

  const rpShort = (n) => {
    n = Number(n) || 0;
    if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',') + ' M';
    if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace('.', ',') + ' jt';
    if (n >= 1e3) return 'Rp ' + Math.round(n / 1e3) + ' rb';
    return 'Rp ' + n;
  };

  const totals = useMemo(() => {
    const t = { mcn: 0, tap: 0, internal: 0 };
    gmvEntries.forEach(e => { if (e.date && e.date.startsWith(mKey) && t[e.division] !== undefined) t[e.division] += Number(e.gmv) || 0; });
    return t;
  }, [gmvEntries, mKey]);
  const targets = gmvTargets[mKey] || {};
  const grandTotal = totals.mcn + totals.tap + totals.internal;
  const grandTarget = (Number(targets.mcn) || 0) + (Number(targets.tap) || 0) + (Number(targets.internal) || 0);

  const seriesByDiv = useMemo(() => ({
    mcn: gmvDailySeries(gmvEntries, 'mcn', mKey),
    tap: gmvDailySeries(gmvEntries, 'tap', mKey),
    internal: gmvDailySeries(gmvEntries, 'internal', mKey)
  }), [gmvEntries, mKey]);
  const n = seriesByDiv.mcn.length || 1;
  const totalSeries = Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    value: (seriesByDiv.mcn[i]?.value || 0) + (seriesByDiv.tap[i]?.value || 0) + (seriesByDiv.internal[i]?.value || 0)
  }));

  const change = (series) => {
    const s = series.filter(x => x.value > 0);
    const today = s[s.length - 1]?.value || 0, prev = s[s.length - 2]?.value || 0;
    const diff = today - prev, pct = prev > 0 ? Math.round((diff / prev) * 100) : (today > 0 ? 100 : 0);
    return { today, prev, diff, pct };
  };

  const isAll = scope === 'all';
  const divColor = isAll ? '#2563EB' : GMV_DIVISIONS[scope].color;
  const chartSeries = isAll ? totalSeries : seriesByDiv[scope];
  const hasData = grandTotal > 0;

  // stat cards per scope
  let cards = [];
  if (isAll) {
    const ch = change(totalSeries);
    const pctTarget = grandTarget > 0 ? Math.round((grandTotal / grandTarget) * 100) : null;
    const share = (v) => grandTotal > 0 ? Math.round((v / grandTotal) * 100) : 0;
    cards = [
      { label: 'GMV Bisnis Bln Ini', value: rpShort(grandTotal), sub: pctTarget !== null ? `${pctTarget}% dari target ${rpShort(grandTarget)}` : 'Belum ada target', accent: '#2563EB', bg: '#EFF6FF', trend: ch },
      { label: 'MCN', value: rpShort(totals.mcn), sub: `${share(totals.mcn)}% kontribusi`, accent: '#10B981', bg: '#DCFCE7' },
      { label: 'TAP', value: rpShort(totals.tap), sub: `${share(totals.tap)}% kontribusi`, accent: '#F97316', bg: '#FFEDD5' },
      { label: 'Affiliator Internal', value: rpShort(totals.internal), sub: `${share(totals.internal)}% kontribusi`, accent: '#3B82F6', bg: '#DBEAFE' }
    ];
  } else {
    const tot = totals[scope];
    const tgt = Number(targets[scope]) || 0;
    const ch = change(seriesByDiv[scope]);
    const elapsed = n;
    const avg = elapsed > 0 ? tot / elapsed : 0;
    const best = Math.max(...seriesByDiv[scope].map(s => s.value), 0);
    const proj = avg * dim;
    const pctTarget = tgt > 0 ? Math.round((tot / tgt) * 100) : null;
    cards = [
      { label: 'GMV Bulan Ini', value: rpShort(tot), sub: pctTarget !== null ? `${pctTarget}% dari target ${rpShort(tgt)}` : 'Target belum di-set', accent: divColor, bg: '#EFF6FF', trend: ch },
      { label: 'Rata-rata / Hari', value: rpShort(avg), sub: `${elapsed} hari berjalan`, accent: '#0EA5E9', bg: '#E0F2FE' },
      { label: 'Hari Terbaik', value: rpShort(best), sub: 'GMV tertinggi sebulan', accent: '#16A34A', bg: '#DCFCE7' },
      { label: 'Proyeksi Akhir Bln', value: rpShort(proj), sub: tgt > 0 ? (proj >= tgt ? 'On track ✓' : `Kurang ${rpShort(tgt - proj)}`) : 'Estimasi laju saat ini', accent: proj >= tgt && tgt > 0 ? '#16A34A' : '#B45309', bg: proj >= tgt && tgt > 0 ? '#DCFCE7' : '#FEF3C7' }
    ];
  }

  // affiliator accounts (untuk tab internal)
  const acctRows = useMemo(() => affAccounts.filter(a => a.active !== false).map(a => {
    const real = affEntries.filter(e => e.accountId === a.id && e.date && e.date.startsWith(mKey)).reduce((s, e) => s + (Number(e.gmv) || 0), 0);
    const tgt = Number(a.targets?.[mKey]) || 0;
    const pic = allUsers.find(u => u.id === a.picId);
    return { a, real, tgt, pic, pct: tgt > 0 ? Math.round((real / tgt) * 100) : 0 };
  }).sort((x, y) => y.real - x.real), [affAccounts, affEntries, mKey, allUsers]);

  const TABS = [{ id: 'all', label: 'Keseluruhan' }, { id: 'mcn', label: 'MCN' }, { id: 'tap', label: 'TAP' }, { id: 'internal', label: 'Affiliator' }];

  // Analisis SWOT — periode bisa dipilih (default bulan ini)
  const monthStart = `${mKey}-01`;
  const monthEnd = `${mKey}-${String(dim).padStart(2, '0')}`;
  const [swotPeriod, setSwotPeriod] = useState({ id: 'this-month', label: 'Bulan Ini', start: monthStart, end: monthEnd });
  const dataBundle = { gmvEntries, gmvTargets, affAccounts, affEntries, problems, attendance, reports, allUsers, tasks, partnerFeedback, externalSwot: extSwot };
  const analysis = useMemo(
    () => analyzeBusiness({ scope, start: swotPeriod.start, end: swotPeriod.end, ...dataBundle }),
    [scope, swotPeriod, gmvEntries, gmvTargets, affAccounts, affEntries, problems, attendance, reports, allUsers, tasks, partnerFeedback, extSwot]
  );
  const canEditExternal = user && (user.role === 'owner' || user.role === 'manajer');
  const saveExternalSwot = async (val) => {
    await storage.set('swot:external', val);
    setExtSwot(val);
    await logActivity('memperbarui faktor eksternal SWOT', user?.name || '');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/40">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-slate-100">
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" /> Dashboard Bisnis
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">GMV {isAll ? 'gabungan semua lini' : GMV_DIVISIONS[scope].label} · {monthLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.filter(t => !lockedDiv || t.id === lockedDiv).map(t => (
            <button key={t.id} onClick={() => setScope(t.id)}
              style={scope === t.id ? { backgroundColor: '#2563EB', color: '#fff', borderColor: '#2563EB' } : {}}
              className="text-xs font-bold px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 transition">
              {t.label}
            </button>
          ))}
          {isMgmtUser && (
            <button onClick={() => setShowPpt(true)}
              title="Download laporan pekanan/bulanan sebagai PPT presentasi"
              className="text-xs font-bold px-3.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition flex items-center gap-1.5">
              <Presentation className="w-3.5 h-3.5" /> Laporan PPT
            </button>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="p-10 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <div className="text-sm text-slate-500 mb-3">Belum ada data GMV bulan ini.</div>
          <button onClick={() => onNavigate('gmv')} className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition">
            Input GMV Sekarang
          </button>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((c, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.accent }}></span>
                  {c.trend && c.trend.today > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                      style={{ backgroundColor: c.trend.diff >= 0 ? '#DCFCE7' : '#FEE2E2', color: c.trend.diff >= 0 ? '#16A34A' : '#DC2626' }}>
                      {c.trend.diff >= 0 ? '▲' : '▼'} {Math.abs(c.trend.pct)}%
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-slate-500 font-semibold mt-2">{c.label}</div>
                <div className="text-xl font-display font-bold text-slate-900 mt-0.5 tabular-nums">{c.value}</div>
                <div className="text-[11px] text-slate-400 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* chart — kurva interaktif (hover/sentuh untuk lihat nilai) */}
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-slate-700">Traffic GMV — {n} hari <span className="text-[10px] font-semibold text-slate-400 ml-1">arahkan kursor / sentuh grafik</span></div>
              <button onClick={() => onNavigate('gmv')} className="text-xs text-blue-700 hover:text-blue-800 font-semibold">Detail →</button>
            </div>
            {isAll ? (
              <>
                <InteractiveLineChart height={200} lines={[
                  { label: 'MCN', color: '#10B981', series: seriesByDiv.mcn },
                  { label: 'TAP', color: '#F97316', series: seriesByDiv.tap },
                  { label: 'Affiliator', color: '#3B82F6', series: seriesByDiv.internal }
                ]} />
                <div className="flex gap-4 justify-center mt-3 flex-wrap">
                  <span className="flex items-center gap-2 text-xs text-slate-600 font-semibold"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#10B981' }}></i>MCN</span>
                  <span className="flex items-center gap-2 text-xs text-slate-600 font-semibold"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#F97316' }}></i>TAP</span>
                  <span className="flex items-center gap-2 text-xs text-slate-600 font-semibold"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#3B82F6' }}></i>Affiliator Internal</span>
                </div>
              </>
            ) : (
              <InteractiveLineChart height={200} series={chartSeries} color={divColor}
                targetDaily={(Number(targets[scope]) || 0) > 0 ? Math.round((Number(targets[scope]) || 0) / dim) : 0} />
            )}
          </div>

          {/* ranking divisi (all) atau daftar akun (internal) */}
          {isAll && (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-bold text-slate-700 mb-3">Kontribusi per Divisi</div>
              <div className="space-y-2.5">
                {[['mcn', totals.mcn], ['internal', totals.internal], ['tap', totals.tap]]
                  .sort((a, b) => b[1] - a[1])
                  .map(([div, val], i) => {
                    const pct = grandTotal > 0 ? Math.round((val / grandTotal) * 100) : 0;
                    return (
                      <div key={div} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg grid place-items-center text-xs font-bold flex-shrink-0"
                          style={i === 0 ? { background: 'linear-gradient(135deg,#FDE68A,#F59E0B)', color: '#7c4a03' } : { background: '#F1F3F8', color: '#64748B' }}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-slate-800">{GMV_DIVISIONS[div].label}</span>
                            <span className="text-xs font-bold text-slate-600">{rpShort(val)} · {pct}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: GMV_DIVISIONS[div].color }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {scope === 'internal' && (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-slate-700">Akun Affiliator · target harian vs realisasi</div>
                <button onClick={() => onNavigate('affiliate-accounts')} className="text-xs text-blue-700 hover:text-blue-800 font-semibold">Kelola →</button>
              </div>
              {acctRows.length === 0 ? (
                <div className="text-center py-5 text-sm text-slate-400">Belum ada akun affiliator. <button onClick={() => onNavigate('affiliate-accounts')} className="text-blue-600 font-semibold">Tambah akun</button></div>
              ) : (
                <div className="space-y-3">
                  {acctRows.slice(0, 6).map(({ a, real, tgt, pic, pct }) => (
                    <div key={a.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-800 flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-blue-600 text-white grid place-items-center text-[11px] font-bold flex-shrink-0">{a.name.charAt(0).toUpperCase()}</span>
                          <span className="truncate">{a.name}</span>
                          {pic && <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">· {pic.name.split(' ')[0]}</span>}
                        </span>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: tgt > 0 ? (real >= tgt ? '#16A34A' : '#DC2626') : '#64748B' }}>
                          {rpShort(real)}{tgt > 0 ? ` / ${rpShort(tgt)}` : ''}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: real >= tgt && tgt > 0 ? 'linear-gradient(90deg,#22C55E,#16A34A)' : 'linear-gradient(90deg,#60A5FA,#2563EB)' }}></div>
                      </div>
                    </div>
                  ))}
                  {affGoal > 0 && (
                    <div className="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Goal bulan ini</span>
                      <span className="font-bold text-slate-700">{rpShort(totals.internal)} / {rpShort(affGoal)} · {affGoal > 0 ? Math.round(totals.internal / affGoal * 100) : 0}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Evaluasi otomatis format SWOT — khusus Owner/Manajer/Leader */}
          {isMgmtUser && <SwotPanel analysis={analysis} canEdit={canEditExternal} external={extSwot} onSaveExternal={saveExternalSwot} period={swotPeriod} onPeriodChange={setSwotPeriod} />}
        </div>
      )}

      {showPpt && (
        <PptExportModal scope={scope} scopeLabel={isAll ? 'Keseluruhan Bisnis' : GMV_DIVISIONS[scope].label}
          dataBundle={dataBundle} appName={settings?.appName || 'Al-Kahfi Corp'} authorName={user?.name || ''}
          onClose={() => setShowPpt(false)} />
      )}
    </div>
  );
}

// ====== ANALISIS BISNIS OTOMATIS — format SWOT (berbasis data nyata aplikasi) ======
function analyzeBusiness({ scope = 'all', start, end, gmvEntries, gmvTargets, affAccounts = [], affEntries = [], problems = [], attendance = [], reports = [], allUsers = [], tasks = [], partnerFeedback = [], externalSwot = null }) {
  const inRange = (d) => d && d >= start && d <= end;
  const dayList = [];
  {
    const cur = new Date(start + 'T00:00:00');
    while (dayKey(cur) <= end) { dayList.push(dayKey(cur)); cur.setDate(cur.getDate() + 1); }
  }
  const todayStr = dayKey();
  const elapsedDays = dayList.filter(d => d <= todayStr);
  const divs = scope === 'all' ? ['mcn', 'tap', 'internal'] : [scope];
  const scopeLabel = scope === 'all' ? 'Keseluruhan Bisnis' : GMV_DIVISIONS[scope].label;

  const sumDiv = (div, s = start, e = end) => gmvEntries.filter(x => x.division === div && x.date >= s && x.date <= e).reduce((a, x) => a + (Number(x.gmv) || 0), 0);
  const byDiv = { mcn: sumDiv('mcn'), tap: sumDiv('tap'), internal: sumDiv('internal') };
  const total = divs.reduce((s, d) => s + byDiv[d], 0);

  // Target pro-rata periode (target bulanan × porsi hari periode di bulan tsb)
  const targetOfDiv = (div) => {
    let t = 0;
    [...new Set(dayList.map(d => d.slice(0, 7)))].forEach(mk => {
      const monthTarget = Number((gmvTargets[mk] || {})[div]) || 0;
      if (monthTarget <= 0) return;
      t += monthTarget * (dayList.filter(d => d.startsWith(mk)).length / daysInMonth(mk));
    });
    return Math.round(t);
  };
  const target = divs.reduce((s, d) => s + targetOfDiv(d), 0);
  // Pace: dibanding jalur yang seharusnya sudah tercapai sampai hari ini
  const expectedSoFar = target > 0 ? target * (Math.max(elapsedDays.length, 1) / dayList.length) : 0;
  const pacePct = expectedSoFar > 0 ? Math.round((total / expectedSoFar) * 100) : null;

  // Periode pembanding (sama panjang, tepat sebelum periode ini)
  const lenMs = dayList.length * 86400000;
  const prevEndD = new Date(new Date(start + 'T00:00:00').getTime() - 86400000);
  const prevStartD = new Date(prevEndD.getTime() - lenMs + 86400000);
  const prevStart = dayKey(prevStartD), prevEnd = dayKey(prevEndD);
  const prevTotal = divs.reduce((s, d) => s + sumDiv(d, prevStart, prevEnd), 0);
  const growthPct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : (total > 0 ? null : 0);

  // Seri harian + statistik
  const series = dayList.map(d => ({ date: d, value: gmvEntries.filter(e => divs.includes(e.division) && e.date === d).reduce((s, e) => s + (Number(e.gmv) || 0), 0) }));
  const elapsedSeries = series.filter(s => s.date <= todayStr);
  const avgPerDay = elapsedSeries.length > 0 ? total / elapsedSeries.length : 0;
  const best = elapsedSeries.reduce((m, s) => s.value > m.value ? s : m, { date: null, value: 0 });
  const zeroDays = elapsedSeries.filter(s => s.value === 0).length;
  let zeroStreak = 0;
  for (let i = elapsedSeries.length - 1; i >= 0; i--) { if (elapsedSeries[i].value === 0) zeroStreak++; else break; }
  const remainingDays = dayList.length - elapsedDays.length;
  const projection = Math.round(avgPerDay * dayList.length);
  const gapToTarget = target - total;
  const needPerDay = remainingDays > 0 && gapToTarget > 0 ? Math.round(gapToTarget / remainingDays) : 0;

  // Akun affiliator (relevan untuk scope internal/all)
  const accRows = affAccounts.filter(a => a.active !== false).map(a => {
    const actual = affEntries.filter(e => e.accountId === a.id && inRange(e.date)).reduce((s, e) => s + (Number(e.gmv) || 0), 0);
    let tgt = 0;
    [...new Set(dayList.map(d => d.slice(0, 7)))].forEach(mk => {
      const mt = Number(a.targets?.[mk]) || 0;
      if (mt > 0) tgt += mt * (dayList.filter(d => d.startsWith(mk)).length / daysInMonth(mk));
    });
    tgt = Math.round(tgt);
    const expAcc = tgt > 0 ? tgt * (Math.max(elapsedDays.length, 1) / dayList.length) : 0;
    return { name: a.name, actual, target: tgt, onTrack: expAcc > 0 ? actual >= expAcc * 0.95 : null };
  }).sort((a, b) => b.actual - a.actual);
  const accOn = accRows.filter(r => r.onTrack === true);
  const accBehind = accRows.filter(r => r.onTrack === false);
  const accNoTarget = accRows.filter(r => r.target <= 0);

  // Disiplin & laporan dalam periode
  const attIn = attendance.filter(r => r.type === 'in' && inRange(wibDayKey(r.timestamp)));
  const lateRate = attIn.length > 0 ? Math.round(attIn.filter(r => r.late).length / attIn.length * 100) : null;
  const staff = allUsers.filter(u => u.role !== 'owner');
  const repDays = new Set(reports.filter(r => inRange(r.date)).map(r => `${r.authorId}|${r.date}`)).size;
  const repExpected = staff.length * Math.max(elapsedDays.length, 1);
  const reportRate = repExpected > 0 ? Math.round(repDays / repExpected * 100) : null;
  const openProblems = problems.filter(p => p.status !== 'resolved');
  const urgentProblems = openProblems.filter(p => p.urgency === 'kritis' || p.urgency === 'tinggi');
  const resolvedInRange = problems.filter(p => p.status === 'resolved' && inRange((p.resolvedAt || '').slice(0, 10)));

  // Aktivitas tim dalam periode (untuk laporan owner)
  const team = {
    attCount: attIn.length,
    attPeople: new Set(attIn.map(r => r.userId)).size,
    onTimeRate: attIn.length > 0 ? Math.round(attIn.filter(r => !r.late).length / attIn.length * 100) : null,
    reportCount: reports.filter(r => inRange(r.date)).length,
    tasksDone: tasks.filter(t => t.status === 'done' && inRange((t.completedAt || '').slice(0, 10))).length,
    tasksOverdue: tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length
  };

  // Kontribusi divisi (scope all)
  const shares = divs.map(d => ({ div: d, label: GMV_DIVISIONS[d].label, value: byDiv[d], share: total > 0 ? Math.round(byDiv[d] / total * 100) : 0 })).sort((a, b) => b.value - a.value);
  const topShare = shares[0];

  // ===== Susun SWOT =====
  const S = [], W = [], O = [], T = [];
  if (target > 0 && pacePct !== null && pacePct >= 100) S.push(`GMV ${fmtRupiah(total)} — sudah ${Math.round(total / target * 100)}% dari target periode, di depan jalur (pace ${pacePct}%).`);
  if (growthPct !== null && growthPct >= 10) S.push(`Tumbuh ${growthPct}% dibanding periode sebelumnya (${fmtRupiah(prevTotal)} → ${fmtRupiah(total)}).`);
  if (best.value > 0 && avgPerDay > 0 && best.value >= avgPerDay * 1.8) S.push(`Hari terbaik ${fmtDate(best.date)}: ${fmtRupiah(best.value)} (${(best.value / avgPerDay).toFixed(1)}× rata-rata) — buktinya tim mampu di angka ini.`);
  if (scope === 'all' && topShare && topShare.share >= 40 && topShare.share <= 85) S.push(`${topShare.label} jadi motor utama bisnis (${topShare.share}% kontribusi).`);
  if (accOn.length > 0 && divs.includes('internal')) S.push(`${accOn.length} akun affiliator berjalan sesuai/di atas jalur target: ${accOn.slice(0, 3).map(r => r.name).join(', ')}${accOn.length > 3 ? ', dll' : ''}.`);
  if (lateRate !== null && lateRate <= 10 && attIn.length >= 5) S.push(`Disiplin tim baik — hanya ${lateRate}% absen masuk yang terlambat.`);

  if (target > 0 && pacePct !== null && pacePct < 85) W.push(`GMV tertinggal dari jalur target: baru ${fmtRupiah(total)} (pace ${pacePct}%), kurang ${fmtRupiah(Math.max(Math.round(expectedSoFar - total), 0))} dari yang seharusnya.`);
  if (target <= 0) W.push(`Target periode belum di-set untuk ${scopeLabel.toLowerCase()} — tim jalan tanpa patokan angka.`);
  if (zeroStreak >= 2) W.push(`${zeroStreak} hari terakhir tanpa input GMV — data bolong atau penjualan berhenti; pastikan input harian disiplin.`);
  else if (zeroDays >= 3) W.push(`${zeroDays} hari dalam periode ini tanpa GMV sama sekali.`);
  if (accBehind.length > 0 && divs.includes('internal')) W.push(`${accBehind.length} akun affiliator di bawah jalur target: ${accBehind.slice(0, 3).map(r => r.name).join(', ')}${accBehind.length > 3 ? ', dll' : ''}.`);
  if (accNoTarget.length > 0 && divs.includes('internal')) W.push(`${accNoTarget.length} akun belum punya target — breakdown goal belum lengkap.`);
  if (lateRate !== null && lateRate >= 25) W.push(`Disiplin perlu dibenahi: ${lateRate}% absen masuk terlambat.`);
  if (reportRate !== null && reportRate < 60) W.push(`Kepatuhan laporan harian rendah (${reportRate}%) — evaluasi kinerja jadi sulit.`);

  if (gapToTarget > 0 && remainingDays > 0 && needPerDay <= avgPerDay * 2.5) O.push(`Target masih terkejar: butuh rata-rata ${fmtRupiah(needPerDay)}/hari selama ${remainingDays} hari tersisa${avgPerDay > 0 ? ` (saat ini ${fmtRupiah(Math.round(avgPerDay))}/hari)` : ''}.`);
  if (best.value > 0 && avgPerDay > 0 && best.value >= avgPerDay * 1.5) O.push(`Replikasi pola hari terbaik (${fmtDate(best.date)}) — cek produk, jam live, dan konten yang jalan hari itu, lalu ulangi.`);
  if (scope === 'all') {
    const weakest = shares[shares.length - 1];
    if (weakest && weakest.share <= 15 && total > 0) O.push(`${weakest.label} baru ${weakest.share}% kontribusi — ruang tumbuh besar lewat penambahan ${weakest.div === 'tap' ? 'seller & campaign' : weakest.div === 'mcn' ? 'creator aktif' : 'akun & jam live'}.`);
  }
  if (growthPct !== null && growthPct > 0 && growthPct < 10) O.push(`Momentum positif (+${growthPct}%) — dorong sedikit lagi lewat konten/live tambahan untuk tembus 2 digit.`);
  if (divs.includes('internal') && accRows.length > 0 && accRows.length < 5) O.push(`Baru ${accRows.length} akun affiliator aktif — menambah akun = menambah slot komisi & jangkauan.`);
  if (O.length === 0 && total > 0) O.push(`Pertahankan ritme input & evaluasi harian; data periode ini jadi baseline untuk naikkan target periode depan.`);

  // Kepuasan mitra (seller/creator) dalam periode → masuk SWOT
  const pfRows = partnerFeedback.filter(f => inRange(f.date));
  const pfAvg = pfRows.length ? pfRows.reduce((s, f) => s + (Number(f.rating) || 0), 0) / pfRows.length : null;
  if (pfAvg !== null && pfRows.length >= 3) {
    if (pfAvg >= 4.3) S.push(`Kepuasan mitra tinggi: rata-rata ${pfAvg.toFixed(1)}★ dari ${pfRows.length} catatan seller/creator.`);
    else if (pfAvg < 3.5) W.push(`Kepuasan mitra rendah (${pfAvg.toFixed(1)}★ dari ${pfRows.length} catatan) — cek keluhan di menu Kepuasan Mitra, follow-up yang ≤2★.`);
  }
  const pfBad = pfRows.filter(f => f.rating <= 2);
  if (pfBad.length > 0) T.push(`${pfBad.length} mitra memberi rating ≤2★ (${pfBad.slice(0, 2).map(f => f.name).join(', ')}${pfBad.length > 2 ? ', dll' : ''}) — risiko putus kerja sama kalau tidak ditindak.`);

  if (urgentProblems.length > 0) T.push(`${urgentProblems.length} masalah prioritas (kritis/tinggi) masih terbuka: "${urgentProblems[0].title}"${urgentProblems.length > 1 ? ', dll' : ''} — selesaikan sampai akar (5 Why).`);
  if (growthPct !== null && growthPct <= -15) T.push(`GMV turun ${Math.abs(growthPct)}% dibanding periode sebelumnya — cari akar penyebabnya sebelum jadi tren.`);
  if (scope === 'all' && topShare && topShare.share > 85) T.push(`Ketergantungan tinggi pada ${topShare.label} (${topShare.share}%) — kalau channel ini terganggu, hampir seluruh omzet ikut jatuh.`);
  if (target > 0 && projection < target && remainingDays > 0) T.push(`Dengan laju sekarang, proyeksi akhir periode ${fmtRupiah(projection)} — di bawah target ${fmtRupiah(target)}.`);
  if (needPerDay > 0 && avgPerDay > 0 && needPerDay > avgPerDay * 2.5) T.push(`Kebutuhan ${fmtRupiah(needPerDay)}/hari untuk kejar target = ${(needPerDay / avgPerDay).toFixed(1)}× laju sekarang — target periode ini realistisnya perlu strategi luar biasa atau penyesuaian.`);

  // Faktor EKSTERNAL yang ditulis manual owner/manajer (kompetitor, kebijakan TikTok, musim, dll)
  const extO = (externalSwot?.opportunities || []).filter(Boolean).map(t => `[Eksternal] ${t}`);
  const extT = (externalSwot?.threats || []).filter(Boolean).map(t => `[Eksternal] ${t}`);

  const fallback = (arr, text) => arr.length === 0 ? [text] : arr;
  return {
    scope, scopeLabel, start, end, total, target, pacePct, growthPct, prevTotal, prevStart, prevEnd,
    series, byDiv, shares, accRows, best, avgPerDay, projection, remainingDays, needPerDay,
    lateRate, reportRate, openProblems, urgentProblems, resolvedInRange, team, zeroDays,
    targetOfDiv, expectedSoFar,
    partner: { count: pfRows.length, avg: pfAvg, badCount: pfBad.length },
    swot: {
      strengths: fallback(S, 'Belum ada kekuatan menonjol terdeteksi dari data periode ini — perbanyak input data agar analisis tajam.').slice(0, 4),
      weaknesses: fallback(W, 'Tidak ada kelemahan signifikan terdeteksi pada periode ini.').slice(0, 4),
      opportunities: fallback([...O, ...extO], 'Lengkapi target & data harian untuk membuka analisis peluang.').slice(0, 5),
      threats: fallback([...T, ...extT], 'Tidak ada ancaman mendesak terdeteksi. Tetap pantau tren harian.').slice(0, 5)
    }
  };
}

// Panel SWOT di Dashboard Bisnis (+ faktor eksternal manual oleh owner/manajer)
// Daftar preset periode (dipakai SWOT, Evaluasi, dll)
function periodPresets() {
  const now = new Date();
  const d = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - d + (d === 0 ? -6 : 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
  const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const back = (n) => { const x = new Date(now); x.setDate(now.getDate() - n); return x; };
  return [
    { id: 'today', label: 'Hari Ini', start: dayKey(now), end: dayKey(now) },
    { id: 'yesterday', label: 'Kemarin', start: dayKey(back(1)), end: dayKey(back(1)) },
    { id: 'last7', label: '7 Hari', start: dayKey(back(6)), end: dayKey(now) },
    { id: 'this-week', label: 'Pekan Ini', start: dayKey(mon), end: dayKey(sun) },
    { id: 'last-week', label: 'Pekan Lalu', start: dayKey(lastMon), end: dayKey(lastSun) },
    { id: 'this-month', label: 'Bulan Ini', start: dayKey(mStart), end: dayKey(mEnd) },
    { id: 'last-month', label: 'Bulan Lalu', start: dayKey(lmStart), end: dayKey(lmEnd) }
  ];
}

// Kontrol pemilih periode: preset cepat + rentang tanggal custom
function PeriodPicker({ value, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const presets = periodPresets();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map(p => (
        <button key={p.id} onClick={() => { onChange({ id: p.id, label: p.label, start: p.start, end: p.end }); setShowCustom(false); }}
          style={value.id === p.id ? { backgroundColor: '#2563EB', color: '#fff', borderColor: '#2563EB' } : {}}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 transition">
          {p.label}
        </button>
      ))}
      <button onClick={() => setShowCustom(s => !s)}
        style={value.id === 'custom' ? { backgroundColor: '#2563EB', color: '#fff', borderColor: '#2563EB' } : {}}
        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 transition">
        Pilih Tanggal
      </button>
      {showCustom && (
        <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1.5 sm:mt-0">
          <input type="date" value={value.start} max={value.end || dayKey()}
            onChange={e => onChange({ id: 'custom', label: 'Custom', start: e.target.value, end: value.end || e.target.value })}
            className="px-2 py-1 border border-slate-300 rounded-lg text-xs" />
          <span className="text-xs text-slate-400">s/d</span>
          <input type="date" value={value.end} min={value.start} max={dayKey()}
            onChange={e => onChange({ id: 'custom', label: 'Custom', start: value.start || e.target.value, end: e.target.value })}
            className="px-2 py-1 border border-slate-300 rounded-lg text-xs" />
        </div>
      )}
    </div>
  );
}

function SwotPanel({ analysis, canEdit = false, external = null, onSaveExternal, period, onPeriodChange }) {
  const [showExt, setShowExt] = useState(false);
  const quad = [
    { key: 'strengths', title: 'Strengths · Kekuatan', icon: '💪', bg: '#ECFDF5', border: '#A7F3D0', accent: '#047857' },
    { key: 'weaknesses', title: 'Weaknesses · Kelemahan', icon: '⚠️', bg: '#FFFBEB', border: '#FDE68A', accent: '#B45309' },
    { key: 'opportunities', title: 'Opportunities · Peluang', icon: '🚀', bg: '#EFF6FF', border: '#BFDBFE', accent: '#1D4ED8' },
    { key: 'threats', title: 'Threats · Ancaman', icon: '🛑', bg: '#FEF2F2', border: '#FECACA', accent: '#B91C1C' }
  ];
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
        <div>
          <div className="text-sm font-bold text-slate-700 flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-600" /> Evaluasi Otomatis — Format SWOT</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{analysis.scopeLabel} · {fmtDate(analysis.start)} – {fmtDate(analysis.end)} · data internal otomatis + faktor eksternal manual</div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => setShowExt(true)}
              className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1 transition">
              + Faktor Eksternal
            </button>
          )}
          <div className="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1">
            Pace {analysis.pacePct !== null ? `${analysis.pacePct}%` : '—'} · Growth {analysis.growthPct !== null ? `${analysis.growthPct > 0 ? '+' : ''}${analysis.growthPct}%` : '—'}
          </div>
        </div>
      </div>
      {period && onPeriodChange && (
        <div className="mb-3 pb-3 border-b border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Periode analisis</div>
          <PeriodPicker value={period} onChange={onPeriodChange} />
        </div>
      )}
      {showExt && <ExternalSwotModal external={external} onSave={async (v) => { await onSaveExternal(v); setShowExt(false); }} onClose={() => setShowExt(false)} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {quad.map(q => (
          <div key={q.key} className="rounded-xl p-3.5" style={{ backgroundColor: q.bg, border: `1px solid ${q.border}` }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: q.accent }}>
              <span>{q.icon}</span> {q.title}
            </div>
            <ul className="space-y-1.5">
              {analysis.swot[q.key].map((item, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-slate-700 flex gap-1.5">
                  <span className="flex-shrink-0 mt-1 w-1 h-1 rounded-full" style={{ backgroundColor: q.accent }}></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// Modal: tulis faktor eksternal SWOT (kompetitor, kebijakan platform, musim/event) — satu per baris
function ExternalSwotModal({ external, onSave, onClose }) {
  const [opp, setOpp] = useState((external?.opportunities || []).join('\n'));
  const [thr, setThr] = useState((external?.threats || []).join('\n'));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    await onSave({
      opportunities: opp.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5),
      threats: thr.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5),
      updatedAt: new Date().toISOString()
    });
    setBusy(false);
  };
  return (
    <Modal title="Faktor Eksternal SWOT" onClose={onClose}>
      <div className="space-y-3">
        <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          Mesin hanya bisa membaca data internal. Hal di luar aplikasi — kompetitor, kebijakan TikTok, tren produk, musim (Ramadan, gajian, 12.12) — tulis di sini. Otomatis tampil di SWOT dashboard & laporan PPT dengan tanda [Eksternal]. Disarankan direview tiap awal bulan.
        </div>
        <Field label="Peluang eksternal (satu per baris, maks. 5)">
          <textarea value={opp} onChange={e => setOpp(e.target.value)} rows={4}
            placeholder={"contoh:\nRamadan bulan depan — produk muslim naik\nTikTok buka program komisi baru"}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Ancaman eksternal (satu per baris, maks. 5)">
          <textarea value={thr} onChange={e => setThr(e.target.value)} rows={4}
            placeholder={"contoh:\nKompetitor agency X rekrut creator besar-besaran\nIsu kenaikan biaya iklan"}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <FormActions onCancel={onClose} onSave={submit} disabled={busy} saveLabel={busy ? 'Menyimpan…' : 'Simpan Faktor Eksternal'} />
      </div>
    </Modal>
  );
}

// ====== EXPORT LAPORAN PPT PROFESIONAL ======
// pptxgenjs ikut ter-bundle aplikasi (dynamic import, dimuat saat tombol diklik) — tidak bergantung CDN.
async function loadPptxGen() {
  try {
    const mod = await import('pptxgenjs');
    return mod.default || mod;
  } catch (e) {
    throw new Error('Gagal memuat modul PPT. Muat ulang halaman (Cmd+Shift+R) lalu coba lagi.');
  }
}

async function exportBusinessPpt({ analysis, dataBundle, periodLabel, appName = 'Al-Kahfi Corp', authorName = '' }) {
  const PptxGenJS = await loadPptxGen();
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';
  const BLUE = '2563EB', DARK = '0B1437', SLATE = '475569', GOLD = 'F59E0B';
  const a = analysis;
  const rp = (n) => fmtRupiah(Math.round(n || 0)).replace('Rp ', 'Rp');
  // Analisis pembanding: periode sebelumnya + rincian per divisi (kalau keseluruhan)
  const prev = analyzeBusiness({ scope: a.scope, start: a.prevStart, end: a.prevEnd, ...dataBundle });
  const divAnalyses = a.scope === 'all'
    ? ['mcn', 'tap', 'internal'].map(d => analyzeBusiness({ scope: d, start: a.start, end: a.end, ...dataBundle }))
    : [];

  let pageNo = 1;
  const footer = (slide) => {
    pageNo += 1;
    slide.addText(`${appName} · Laporan ${periodLabel} · ${a.scopeLabel} · ${fmtDate(a.start)}–${fmtDate(a.end)}`, { x: 0.5, y: 7.08, w: 9, h: 0.32, fontSize: 9, color: '94A3B8' });
    slide.addText(`${pageNo}`, { x: 12.3, y: 7.08, w: 0.6, h: 0.32, fontSize: 9, color: '94A3B8', align: 'right' });
  };
  const heading = (slide, no, title) => {
    slide.addText([
      { text: `${no}  `, options: { fontSize: 26, bold: true, color: BLUE } },
      { text: title, options: { fontSize: 26, bold: true, color: DARK } }
    ], { x: 0.5, y: 0.38, w: 12.3, h: 0.6 });
    slide.addShape('rect', { x: 0.5, y: 1.02, w: 1.6, h: 0.06, fill: { color: BLUE } });
  };
  const headRow = (cols) => cols.map(c => ({ text: c, options: { bold: true, color: 'FFFFFF', fill: { color: BLUE }, fontSize: 11 } }));
  const statusTxt = (an) => an.target <= 0 ? ['Tanpa target', '94A3B8'] : an.pacePct >= 100 ? ['On track ✓', '047857'] : an.pacePct >= 85 ? ['Hampir on track', 'B45309'] : ['Tertinggal', 'B91C1C'];

  // ===== COVER =====
  let s = pptx.addSlide();
  s.background = { color: DARK };
  s.addShape('rect', { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: BLUE } });
  s.addText(appName.toUpperCase(), { x: 0.9, y: 1.4, w: 11.5, h: 0.5, fontSize: 16, color: '60A5FA', bold: true, charSpacing: 4 });
  s.addText(`Laporan ${periodLabel} untuk Owner`, { x: 0.9, y: 2.0, w: 11.5, h: 1.1, fontSize: 42, color: 'FFFFFF', bold: true });
  s.addText(a.scopeLabel, { x: 0.9, y: 3.1, w: 11.5, h: 0.65, fontSize: 26, color: 'BFDBFE' });
  s.addText(`Periode: ${fmtDate(a.start)} – ${fmtDate(a.end)}`, { x: 0.9, y: 3.95, w: 11.5, h: 0.45, fontSize: 16, color: 'E2E8F0' });
  s.addText('Pola laporan: Fakta → Penyebab → Dampak → Solusi → Target berikutnya', { x: 0.9, y: 4.6, w: 11.5, h: 0.4, fontSize: 13, italic: true, color: '93C5FD' });
  s.addText(`Disusun otomatis oleh sistem${authorName ? ` · Diunduh oleh ${authorName}` : ''} · ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    { x: 0.9, y: 6.5, w: 11.5, h: 0.4, fontSize: 11, color: '94A3B8' });

  // ===== 1. RINGKASAN EKSEKUTIF =====
  s = pptx.addSlide();
  heading(s, '1', 'Ringkasan Eksekutif');
  const kpis = [
    { label: 'TOTAL GMV', value: rp(a.total), sub: a.target > 0 ? `${Math.round(a.total / a.target * 100)}% dari target ${rp(a.target)}` : 'Target belum di-set' },
    { label: 'PACE VS JALUR TARGET', value: a.pacePct !== null ? `${a.pacePct}%` : '—', sub: a.pacePct !== null ? (a.pacePct >= 100 ? 'Di depan jalur ✓' : `Tertinggal ${rp(Math.max(a.expectedSoFar - a.total, 0))}`) : 'Tanpa target' },
    { label: 'VS PERIODE SEBELUMNYA', value: a.growthPct !== null ? `${a.growthPct > 0 ? '+' : ''}${a.growthPct}%` : '—', sub: `Sebelumnya ${rp(a.prevTotal)}` },
    { label: 'PROYEKSI AKHIR PERIODE', value: rp(a.projection), sub: a.target > 0 ? (a.projection >= a.target ? 'Diproyeksi capai target ✓' : `Selisih ${rp(a.target - a.projection)}`) : '—' }
  ];
  kpis.forEach((k, i) => {
    const x = 0.5 + i * 3.16;
    s.addShape('roundRect', { x, y: 1.35, w: 2.96, h: 1.85, fill: { color: 'FFFFFF' }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08, shadow: { type: 'outer', blur: 6, offset: 2, angle: 90, color: 'CBD5E1', opacity: 0.4 } });
    s.addText(k.label, { x: x + 0.2, y: 1.52, w: 2.6, h: 0.3, fontSize: 9.5, bold: true, color: SLATE, charSpacing: 1 });
    s.addText(k.value, { x: x + 0.2, y: 1.86, w: 2.6, h: 0.6, fontSize: 21, bold: true, color: DARK });
    s.addText(k.sub, { x: x + 0.2, y: 2.5, w: 2.6, h: 0.55, fontSize: 10, color: SLATE });
  });
  // Fakta utama (narasi singkat untuk owner)
  const fakta = [];
  fakta.push(`FAKTA: GMV ${a.scopeLabel.toLowerCase()} periode ini ${rp(a.total)}${a.target > 0 ? ` dari target ${rp(a.target)} (pace ${a.pacePct}%)` : ''}, ${a.growthPct !== null ? `${a.growthPct >= 0 ? 'tumbuh' : 'turun'} ${Math.abs(a.growthPct)}% dibanding periode sebelumnya` : 'belum ada pembanding periode sebelumnya'}.`);
  if (a.scope === 'all' && a.shares[0]) fakta.push(`Kontributor terbesar: ${a.shares[0].label} (${a.shares[0].share}%). Hari terbaik ${a.best.date ? fmtDate(a.best.date) : '—'} dengan ${rp(a.best.value)}.`);
  fakta.push(a.pacePct !== null && a.pacePct < 100 && a.remainingDays > 0
    ? `Untuk mengejar target dibutuhkan rata-rata ${rp(a.needPerDay)}/hari selama ${a.remainingDays} hari tersisa (laju sekarang ${rp(a.avgPerDay)}/hari).`
    : `Pertahankan laju ${rp(a.avgPerDay)}/hari sampai akhir periode.`);
  s.addShape('roundRect', { x: 0.5, y: 3.5, w: 12.33, h: 2.9, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08 });
  s.addText(fakta.map(t => ({ text: t, options: { bullet: { code: '2022', indent: 12 }, fontSize: 13.5, color: '334155', paraSpaceAfter: 10 } })),
    { x: 0.75, y: 3.7, w: 11.8, h: 2.5, valign: 'top' });
  footer(s);

  // ===== 2. TARGET VS REALISASI =====
  s = pptx.addSlide();
  heading(s, '2', 'Target vs Realisasi');
  if (a.scope === 'all') {
    const rows = [headRow(['Divisi', 'Target Periode', 'Realisasi', '% Capai', 'Status'])];
    divAnalyses.forEach(d => {
      const [st, stc] = statusTxt(d);
      rows.push([
        { text: GMV_DIVISIONS[d.scope].label },
        { text: d.target > 0 ? rp(d.target) : '—', options: { align: 'right' } },
        { text: rp(d.total), options: { align: 'right' } },
        { text: d.target > 0 ? `${Math.round(d.total / d.target * 100)}%` : '—', options: { align: 'right', bold: true } },
        { text: st, options: { color: stc, bold: true } }
      ]);
    });
    const [stA, stAc] = statusTxt(a);
    rows.push([
      { text: 'TOTAL', options: { bold: true, fill: { color: 'EFF6FF' } } },
      { text: a.target > 0 ? rp(a.target) : '—', options: { align: 'right', bold: true, fill: { color: 'EFF6FF' } } },
      { text: rp(a.total), options: { align: 'right', bold: true, fill: { color: 'EFF6FF' } } },
      { text: a.target > 0 ? `${Math.round(a.total / a.target * 100)}%` : '—', options: { align: 'right', bold: true, fill: { color: 'EFF6FF' } } },
      { text: stA, options: { color: stAc, bold: true, fill: { color: 'EFF6FF' } } }
    ]);
    s.addTable(rows, { x: 0.5, y: 1.4, w: 6.4, fontSize: 11.5, color: '334155', border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, rowH: 0.46 });
    s.addChart(pptx.ChartType.bar, [
      { name: 'Target', labels: divAnalyses.map(d => GMV_DIVISIONS[d.scope].short), values: divAnalyses.map(d => d.target) },
      { name: 'Realisasi', labels: divAnalyses.map(d => GMV_DIVISIONS[d.scope].short), values: divAnalyses.map(d => d.total) }
    ], {
      x: 7.2, y: 1.4, w: 5.6, h: 4.6, barDir: 'col', barGrouping: 'clustered',
      chartColors: ['CBD5E1', BLUE], showLegend: true, legendPos: 'b', legendFontSize: 10,
      catAxisLabelColor: SLATE, valAxisLabelColor: SLATE, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
      valGridLine: { color: 'E2E8F0', style: 'solid', size: 0.5 }, valAxisLabelFormatCode: '#,##0'
    });
    s.addText('Catatan: target periode dihitung pro-rata dari target bulanan.', { x: 0.5, y: 6.3, w: 6.4, h: 0.35, fontSize: 10, italic: true, color: '94A3B8' });
  } else {
    const [st, stc] = statusTxt(a);
    const rows = [headRow(['Indikator', 'Nilai'])];
    rows.push([{ text: 'Target periode' }, { text: a.target > 0 ? rp(a.target) : 'Belum di-set', options: { align: 'right' } }]);
    rows.push([{ text: 'Realisasi' }, { text: rp(a.total), options: { align: 'right', bold: true } }]);
    rows.push([{ text: '% capai' }, { text: a.target > 0 ? `${Math.round(a.total / a.target * 100)}%` : '—', options: { align: 'right', bold: true } }]);
    rows.push([{ text: 'Status' }, { text: st, options: { align: 'right', bold: true, color: stc } }]);
    rows.push([{ text: 'Kebutuhan per hari (sisa periode)' }, { text: a.needPerDay > 0 ? rp(a.needPerDay) : '—', options: { align: 'right' } }]);
    s.addTable(rows, { x: 0.5, y: 1.4, w: 5.9, fontSize: 12, color: '334155', border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, rowH: 0.5 });
    if (a.accRows.length > 0 && a.scope === 'internal') {
      const rows2 = [headRow(['Akun', 'Target', 'Realisasi', 'Status'])];
      a.accRows.slice(0, 7).forEach(r => rows2.push([
        { text: r.name },
        { text: r.target > 0 ? rp(r.target) : '—', options: { align: 'right' } },
        { text: rp(r.actual), options: { align: 'right' } },
        { text: r.onTrack === null ? 'Tanpa target' : r.onTrack ? 'On track ✓' : 'Tertinggal', options: { color: r.onTrack === null ? '94A3B8' : r.onTrack ? '047857' : 'B91C1C', bold: r.onTrack !== null } }
      ]));
      s.addTable(rows2, { x: 6.8, y: 1.4, w: 6.0, fontSize: 10.5, color: '334155', border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, rowH: 0.4 });
    }
  }
  footer(s);

  // ===== 3. PERBANDINGAN DENGAN PERIODE SEBELUMNYA =====
  s = pptx.addSlide();
  heading(s, '3', `Perbandingan dengan ${periodLabel === 'Pekanan' ? 'Minggu' : 'Bulan'} Sebelumnya`);
  const cmpItems = a.scope === 'all' ? divAnalyses : [a];
  s.addChart(pptx.ChartType.bar, [
    { name: 'Periode lalu', labels: cmpItems.map(d => a.scope === 'all' ? GMV_DIVISIONS[d.scope].short : d.scopeLabel), values: cmpItems.map(d => d.prevTotal) },
    { name: 'Periode ini', labels: cmpItems.map(d => a.scope === 'all' ? GMV_DIVISIONS[d.scope].short : d.scopeLabel), values: cmpItems.map(d => d.total) }
  ], {
    x: 0.5, y: 1.4, w: 6.4, h: 4.5, barDir: 'col', barGrouping: 'clustered',
    chartColors: ['94A3B8', '10B981'], showLegend: true, legendPos: 'b', legendFontSize: 10,
    catAxisLabelColor: SLATE, valAxisLabelColor: SLATE, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
    valGridLine: { color: 'E2E8F0', style: 'solid', size: 0.5 }, valAxisLabelFormatCode: '#,##0'
  });
  const cmpRows = [headRow(['Lini', 'Lalu', 'Sekarang', 'Δ'])];
  cmpItems.forEach(d => {
    const g = d.growthPct;
    cmpRows.push([
      { text: a.scope === 'all' ? GMV_DIVISIONS[d.scope].label : d.scopeLabel },
      { text: rp(d.prevTotal), options: { align: 'right' } },
      { text: rp(d.total), options: { align: 'right', bold: true } },
      { text: g === null ? 'baru' : `${g > 0 ? '+' : ''}${g}%`, options: { align: 'right', bold: true, color: g === null ? '94A3B8' : g >= 0 ? '047857' : 'B91C1C' } }
    ]);
  });
  s.addTable(cmpRows, { x: 7.2, y: 1.4, w: 5.6, fontSize: 11, color: '334155', border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, rowH: 0.45 });
  // Penyebab & dampak singkat
  const cause = [];
  if (a.growthPct !== null && a.growthPct < 0) cause.push(`PENYEBAB potensial penurunan: ${a.zeroDays > 0 ? `${a.zeroDays} hari tanpa input/penjualan; ` : ''}cek aktivitas konten/live pada hari-hari kosong. DAMPAK: kehilangan momentum ±${rp(Math.abs(a.total - a.prevTotal))}.`);
  else if (a.growthPct !== null && a.growthPct > 0) cause.push(`Pendorong kenaikan: ritme input lebih konsisten${a.best.value > 0 ? ` dan lonjakan ${fmtDate(a.best.date)} (${rp(a.best.value)})` : ''}. Pertahankan pola yang sama.`);
  if (cause.length) s.addText(cause.map(t => ({ text: t, options: { bullet: { code: '2022', indent: 10 }, fontSize: 11.5, color: '334155', paraSpaceAfter: 6 } })), { x: 7.2, y: 3.6, w: 5.6, h: 2.4, valign: 'top' });
  footer(s);

  // ===== RINCIAN PER DIVISI (hanya scope keseluruhan) =====
  divAnalyses.forEach((d) => {
    s = pptx.addSlide();
    heading(s, '•', `Rincian Divisi — ${GMV_DIVISIONS[d.scope].label}`);
    const mini = [
      ['GMV', rp(d.total)],
      ['Pace', d.pacePct !== null ? `${d.pacePct}%` : '—'],
      ['Growth', d.growthPct !== null ? `${d.growthPct > 0 ? '+' : ''}${d.growthPct}%` : '—'],
      ['Proyeksi', rp(d.projection)]
    ];
    mini.forEach(([l, v], i) => {
      const x = 0.5 + i * 3.16;
      s.addShape('roundRect', { x, y: 1.3, w: 2.96, h: 1.15, fill: { color: 'FFFFFF' }, line: { color: 'E2E8F0', width: 1 }, rectRadius: 0.08 });
      s.addText(l.toUpperCase(), { x: x + 0.18, y: 1.42, w: 2.6, h: 0.3, fontSize: 9.5, bold: true, color: SLATE });
      s.addText(v, { x: x + 0.18, y: 1.72, w: 2.6, h: 0.55, fontSize: 18, bold: true, color: DARK });
    });
    s.addChart(pptx.ChartType.line, [{ name: 'GMV', labels: d.series.map(p => p.date.slice(8, 10)), values: d.series.map(p => p.value) }], {
      x: 0.5, y: 2.7, w: 7.3, h: 3.6, lineSize: 2.5, chartColors: [GMV_DIVISIONS[d.scope].color.replace('#', '')], lineSmooth: true,
      catAxisLabelColor: SLATE, valAxisLabelColor: SLATE, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
      valGridLine: { color: 'E2E8F0', style: 'solid', size: 0.5 }, catGridLine: { style: 'none' }, valAxisLabelFormatCode: '#,##0'
    });
    const sBox = (title, items, fill, accent, y) => {
      s.addShape('roundRect', { x: 8.1, y, w: 4.7, h: 1.7, fill: { color: fill }, line: { color: accent, width: 0.75 }, rectRadius: 0.06 });
      s.addText(title, { x: 8.25, y: y + 0.08, w: 4.4, h: 0.3, fontSize: 10.5, bold: true, color: accent });
      s.addText(items.slice(0, 2).map(it => ({ text: it, options: { bullet: { code: '2022', indent: 8 }, fontSize: 9, color: '334155', paraSpaceAfter: 3 } })),
        { x: 8.3, y: y + 0.4, w: 4.35, h: 1.25, valign: 'top' });
    };
    sBox('KEKUATAN', d.swot.strengths, 'ECFDF5', '047857', 2.7);
    sBox('PERHATIAN', [...d.swot.weaknesses, ...d.swot.threats], 'FEF2F2', 'B91C1C', 4.6);
    if (d.scope === 'internal' && d.accRows.length > 0) {
      s.addText(`Top akun: ${d.accRows.slice(0, 4).map(r => `${r.name} (${rp(r.actual)})`).join(' · ')}`, { x: 0.5, y: 6.45, w: 12.3, h: 0.4, fontSize: 10.5, color: SLATE });
    }
    footer(s);
  });

  // ===== 4. PENCAPAIAN UTAMA =====
  s = pptx.addSlide();
  heading(s, '4', 'Pencapaian Utama');
  const achievements = [];
  if (a.best.value > 0) achievements.push(`Hari terbaik ${fmtDate(a.best.date)}: ${rp(a.best.value)} — bukti kapasitas tim.`);
  a.swot.strengths.forEach(t => { if (!t.startsWith('Belum ada')) achievements.push(t); });
  const accOn = a.accRows.filter(r => r.onTrack === true);
  if (accOn.length > 0) achievements.push(`${accOn.length} akun affiliator on-track: ${accOn.slice(0, 4).map(r => r.name).join(', ')}.`);
  if (a.resolvedInRange.length > 0) achievements.push(`${a.resolvedInRange.length} masalah diselesaikan sampai akar (5-Why) periode ini.`);
  if (a.team.tasksDone > 0) achievements.push(`${a.team.tasksDone} tiket pekerjaan diselesaikan tim.`);
  s.addText((achievements.length ? achievements : ['Belum ada pencapaian menonjol pada periode ini — fokuskan eksekusi periode berikutnya.']).slice(0, 7).map(t => ({
    text: t, options: { bullet: { code: '2713', indent: 14 }, fontSize: 14, color: '334155', paraSpaceAfter: 12 }
  })), { x: 0.7, y: 1.5, w: 12, h: 5.2, valign: 'top' });
  footer(s);

  // ===== 5. LAPORAN AKTIVITAS TIM =====
  s = pptx.addSlide();
  heading(s, '5', 'Laporan Aktivitas Tim');
  const actRows = [headRow(['Indikator Aktivitas', 'Nilai', 'Catatan'])];
  actRows.push([{ text: 'Absen masuk tercatat' }, { text: `${a.team.attCount}× oleh ${a.team.attPeople} orang`, options: { align: 'right' } }, { text: 'dengan selfie + GPS' }]);
  actRows.push([{ text: 'Ketepatan waktu hadir' }, { text: a.team.onTimeRate !== null ? `${a.team.onTimeRate}%` : '—', options: { align: 'right', bold: true, color: a.team.onTimeRate >= 90 ? '047857' : a.team.onTimeRate >= 75 ? 'B45309' : 'B91C1C' } }, { text: a.team.onTimeRate !== null && a.team.onTimeRate < 75 ? 'perlu pembinaan disiplin' : 'baik' }]);
  actRows.push([{ text: 'Laporan harian masuk' }, { text: `${a.team.reportCount} laporan`, options: { align: 'right' } }, { text: a.reportRate !== null ? `kepatuhan ±${a.reportRate}%` : '—' }]);
  actRows.push([{ text: 'Tiket selesai' }, { text: `${a.team.tasksDone}`, options: { align: 'right', bold: true } }, { text: 'dalam periode ini' }]);
  actRows.push([{ text: 'Tiket lewat deadline (saat ini)' }, { text: `${a.team.tasksOverdue}`, options: { align: 'right', bold: true, color: a.team.tasksOverdue > 0 ? 'B91C1C' : '047857' } }, { text: a.team.tasksOverdue > 0 ? 'perlu ditindak' : 'bersih ✓' }]);
  s.addTable(actRows, { x: 0.5, y: 1.5, w: 12.3, fontSize: 12.5, color: '334155', border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, rowH: 0.62 });
  s.addText('Data dari modul Absensi (selfie + GPS), Laporan Harian, dan Tiket — bisa diaudit langsung di aplikasi.',
    { x: 0.5, y: 5.6, w: 12.3, h: 0.4, fontSize: 10.5, italic: true, color: '94A3B8' });
  footer(s);

  // ===== 6. MASALAH & SOLUSI (Fakta → Penyebab → Dampak → Solusi) =====
  s = pptx.addSlide();
  heading(s, '6', 'Masalah & Solusi');
  if (a.openProblems.length === 0 && a.resolvedInRange.length === 0) {
    s.addText('✓ Tidak ada masalah terbuka maupun yang diselesaikan pada periode ini.', { x: 0.7, y: 1.6, w: 12, h: 0.5, fontSize: 14, color: '047857' });
  } else {
    const pRows = [headRow(['Fakta (Masalah)', 'Penyebab', 'Dampak', 'Solusi / Status'])];
    [...a.openProblems.slice(0, 4), ...a.resolvedInRange.slice(0, 2)].slice(0, 6).forEach(p => {
      const rc = p.rootCause || {};
      pRows.push([
        { text: (p.title || '').slice(0, 55) },
        { text: (rc.root || rc.why1 || p.description || 'belum dianalisis 5-Why').slice(0, 60) },
        { text: `${URGENCY[p.urgency]?.label || p.urgency || '-'}`, options: { color: p.urgency === 'kritis' ? 'B91C1C' : p.urgency === 'tinggi' ? 'C2410C' : '64748B', bold: true } },
        { text: p.status === 'resolved' ? `Selesai ✓ ${(rc.corrective || '').slice(0, 40)}` : `${PROBLEM_STATUS[p.status]?.label || p.status} — ${(rc.corrective || 'tindakan dalam proses').slice(0, 40)}`, options: { color: p.status === 'resolved' ? '047857' : '334155' } }
      ]);
    });
    s.addTable(pRows, { x: 0.5, y: 1.4, w: 12.3, fontSize: 10.5, color: '334155', border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, rowH: 0.55, colW: [3.6, 3.6, 1.6, 3.5] });
    s.addText('Format: Fakta → Penyebab (akar, 5-Why) → Dampak (urgensi) → Solusi. Detail lengkap di menu Masalah & Solusi.',
      { x: 0.5, y: 6.35, w: 12.3, h: 0.35, fontSize: 10, italic: true, color: '94A3B8' });
  }
  footer(s);

  // ===== 7 & 8. RENCANA BERIKUTNYA + KEPUTUSAN OWNER =====
  s = pptx.addSlide();
  heading(s, '7–8', `Rencana ${periodLabel === 'Pekanan' ? 'Minggu' : 'Bulan'} Berikutnya & Keputusan Owner`);
  const plans = [];
  if (a.needPerDay > 0 && a.remainingDays > 0) plans.push(`Kejar sisa target: minimal ${rp(a.needPerDay)}/hari selama ${a.remainingDays} hari ke depan.`);
  a.swot.opportunities.forEach(t => { if (!t.startsWith('Lengkapi target')) plans.push(t); });
  if (a.team.tasksOverdue > 0) plans.push(`Bersihkan ${a.team.tasksOverdue} tiket yang lewat deadline.`);
  s.addText(`TARGET BERIKUTNYA & RENCANA`, { x: 0.5, y: 1.35, w: 6, h: 0.4, fontSize: 14, bold: true, color: DARK });
  s.addText(plans.slice(0, 5).map(t => ({ text: t, options: { bullet: { code: '2192', indent: 12 }, fontSize: 12, color: '334155', paraSpaceAfter: 9 } })),
    { x: 0.6, y: 1.85, w: 6.0, h: 4.4, valign: 'top' });
  // Keputusan yang dibutuhkan dari owner (otomatis dari kondisi data)
  const decisions = [];
  if (a.target <= 0) decisions.push(`Tetapkan target ${a.scopeLabel.toLowerCase()} periode berikutnya (saat ini belum di-set).`);
  if (a.pacePct !== null && a.pacePct < 70 && a.remainingDays > 0) decisions.push(`Target tertinggal jauh (pace ${a.pacePct}%) — putuskan: tambah resource/budget promosi, atau sesuaikan target.`);
  const noTarget = a.accRows.filter(r => r.target <= 0);
  if (noTarget.length > 0) decisions.push(`Setujui breakdown target untuk ${noTarget.length} akun yang belum punya target: ${noTarget.slice(0, 3).map(r => r.name).join(', ')}.`);
  const urgent = a.openProblems.filter(p => p.urgency === 'kritis');
  if (urgent.length > 0) decisions.push(`Eskalasi ${urgent.length} masalah kritis: "${urgent[0].title}" — butuh arahan langsung.`);
  if (a.team.onTimeRate !== null && a.team.onTimeRate < 70) decisions.push(`Disiplin kehadiran ${a.team.onTimeRate}% — putuskan kebijakan (teguran/insentif).`);
  s.addShape('roundRect', { x: 7.0, y: 1.35, w: 5.83, h: 5.0, fill: { color: 'FFF7ED' }, line: { color: 'F59E0B', width: 1 }, rectRadius: 0.08 });
  s.addText('KEPUTUSAN YANG DIBUTUHKAN DARI OWNER', { x: 7.2, y: 1.5, w: 5.4, h: 0.4, fontSize: 13, bold: true, color: 'B45309' });
  s.addText((decisions.length ? decisions : ['Tidak ada keputusan mendesak — tim lanjut eksekusi sesuai rencana.']).slice(0, 5).map(t => ({
    text: t, options: { bullet: { code: '25CF', indent: 10 }, fontSize: 11.5, color: '7C2D12', paraSpaceAfter: 9 }
  })), { x: 7.25, y: 2.0, w: 5.35, h: 4.2, valign: 'top' });
  s.addText('Pola: Fakta → Penyebab → Dampak → Solusi → Target berikutnya', { x: 0.5, y: 6.6, w: 12.3, h: 0.35, fontSize: 10, italic: true, color: '94A3B8' });
  footer(s);

  const fname = `Laporan-${periodLabel}-${a.scope === 'all' ? 'Keseluruhan' : a.scopeLabel.replace(/\s/g, '-')}-${a.start}-sd-${a.end}.pptx`;
  await pptx.writeFile({ fileName: fname });
}

// Modal pilih periode laporan PPT
function PptExportModal({ scope, scopeLabel, dataBundle, appName, authorName, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const today = new Date();
  const todayStr = dayKey(today);

  const ranges = (() => {
    const d = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - d + (d === 0 ? -6 : 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
    const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
    const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    return [
      { id: 'this-week', label: 'Pekanan · Minggu Ini', periodLabel: 'Pekanan', start: dayKey(mon), end: dayKey(sun) },
      { id: 'last-week', label: 'Pekanan · Minggu Lalu', periodLabel: 'Pekanan', start: dayKey(lastMon), end: dayKey(lastSun) },
      { id: 'this-month', label: 'Bulanan · Bulan Ini', periodLabel: 'Bulanan', start: dayKey(mStart), end: dayKey(mEnd) },
      { id: 'last-month', label: 'Bulanan · Bulan Lalu', periodLabel: 'Bulanan', start: dayKey(lmStart), end: dayKey(lmEnd) }
    ];
  })();
  const [picked, setPicked] = useState('this-week');

  const generate = async () => {
    setErr(''); setBusy(true);
    try {
      const r = ranges.find(x => x.id === picked);
      const analysis = analyzeBusiness({ scope, start: r.start, end: r.end, ...dataBundle });
      await exportBusinessPpt({ analysis, dataBundle, periodLabel: r.periodLabel, appName, authorName });
      onClose();
    } catch (e) {
      setErr(e.message || 'Gagal membuat PPT.');
    }
    setBusy(false);
  };

  return (
    <Modal title="Download Laporan PPT" onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-800 leading-relaxed">
          📊 Format laporan owner: <b>1)</b> Ringkasan eksekutif · <b>2)</b> Target vs realisasi · <b>3)</b> Perbandingan periode sebelumnya · <b>4)</b> Pencapaian utama · <b>5)</b> Aktivitas tim · <b>6)</b> Masalah & solusi (Fakta→Penyebab→Dampak→Solusi) · <b>7)</b> Rencana berikutnya · <b>8)</b> Keputusan dari owner.
          Fokus: <b>{scopeLabel}</b>{scopeLabel === 'Keseluruhan Bisnis' ? ' + slide rincian per divisi MCN/TAP/Affiliator' : ''}.
        </div>
        <Field label="Pilih Periode">
          <div className="grid grid-cols-2 gap-2">
            {ranges.map(r => (
              <button key={r.id} onClick={() => setPicked(r.id)}
                className={`text-left px-3 py-2.5 rounded-xl border-2 transition ${picked === r.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className={`text-sm font-bold ${picked === r.id ? 'text-blue-700' : 'text-slate-700'}`}>{r.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{fmtDate(r.start)} – {fmtDate(r.end)}</div>
              </button>
            ))}
          </div>
        </Field>
        {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{err}</div>}
        <FormActions onCancel={onClose} onSave={generate} disabled={busy} saveLabel={busy ? 'Membuat PPT…' : 'Buat & Download PPT'} />
      </div>
    </Modal>
  );
}

function DashboardEvalWidget(props) {
  const insights = useMemo(() => generateInsights(props), [props]);
  const { onNavigate } = props;
  const styles = {
    danger: { dot: '#EF4444', bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700' },
    warning: { dot: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
    info: { dot: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
    good: { dot: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' }
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }}>
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-display font-bold text-slate-900">Evaluasi Hari Ini</h3>
          <p className="text-[11px] text-slate-500">Analisa otomatis dari data tim</p>
        </div>
      </div>
      {insights.length === 0 ? (
        <div className="text-sm text-slate-500 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">🎉 Semua aman & on-track. Tidak ada yang perlu perhatian khusus hari ini.</div>
      ) : (
        <div className="space-y-2">
          {insights.map((ins, i) => {
            const s = styles[ins.level];
            return (
              <div key={i} className={`flex items-start gap-3 ${s.bg} border ${s.border} rounded-xl px-3 py-2.5`}>
                <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
                <span className="text-sm text-slate-700 flex-1">{ins.text}</span>
                {ins.action && (
                  <button onClick={() => onNavigate(ins.action.view)} className={`text-xs font-bold ${s.text} hover:underline flex-shrink-0 whitespace-nowrap`}>
                    {ins.action.label} →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardKpiProblemRow({ kpi, target, openProblems, canHandle, onKpi, onProblems, showProblems = true }) {
  const isMumtaz = kpi.total >= target;
  const ringColor = kpi.total >= target ? '#10B981' : kpi.total >= target * 0.7 ? '#F59E0B' : '#EF4444';
  const kritis = openProblems.filter(p => p.urgency === 'kritis').length;
  return (
    <div className={`grid grid-cols-1 ${showProblems ? 'sm:grid-cols-2' : ''} gap-4`}>
      {/* KPI Saya */}
      <button onClick={onKpi} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 text-left hover:border-slate-300 transition lift-on-hover">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E2E8F0" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={ringColor} strokeWidth="3" strokeDasharray={`${Math.min(kpi.total, 100) / 100 * 97.4} 97.4`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-xl" style={{ color: ringColor }}>{kpi.total}</div>
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">KPI Saya Bulan Ini</div>
          <div className="font-display font-bold text-slate-900 mt-0.5">{isMumtaz ? '⭐ Mumtaz!' : `Target ${target}`}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hadir {kpi.attendance.days} hr · {kpi.tasks.done} tugas · {kpi.reports.days} laporan</div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300" />
      </button>

      {/* Masalah Aktif — ringkasan hanya untuk Owner/Manajer/Leader */}
      {showProblems && (
      <button onClick={onProblems} className={`rounded-2xl border shadow-sm p-5 flex items-center gap-4 text-left transition lift-on-hover ${openProblems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${openProblems.length > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
          {openProblems.length > 0 ? <AlertCircle className="w-7 h-7 text-red-600" /> : <CheckCircle2 className="w-7 h-7 text-emerald-600" />}
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Masalah Aktif (Andon)</div>
          <div className="font-display font-bold text-2xl text-slate-900 mt-0.5">{openProblems.length}{kritis > 0 && <span className="text-sm font-bold text-red-600 ml-2">{kritis} kritis!</span>}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{openProblems.length > 0 ? (canHandle ? 'Perlu ditangani' : 'Sedang ditangani tim') : 'Semua aman 🎉'}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300" />
      </button>
      )}
    </div>
  );
}

// Fokus Hari Ini — 3 prioritas teratas per orang, dihitung otomatis (prinsip: prioritas yang jelas)
function FocusTodayWidget({ user, tasks, dailyReports, affAccounts, affEntries, problems, templates = [], setView }) {
  const today = dayKey();
  const now = new Date();
  const items = [];

  const isStaff = user.role === 'operasional';
  // 1) Tiket terlambat (paling urgent) — termasuk untuk penerima/staff
  tasks.filter(t => t.assigneeId === user.id && t.status !== 'done' && t.deadline && new Date(t.deadline) < now)
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
    .forEach(t => items.push({ level: 0, icon: '🔴', text: `Selesaikan tugas terlambat: "${t.title}"`, sub: `lewat ${Math.max(1, Math.ceil((now - new Date(t.deadline)) / 86400000))} hari`, view: 'tasks' }));
  // 2) Tiket deadline hari ini
  tasks.filter(t => t.assigneeId === user.id && t.status !== 'done' && t.deadline === today)
    .forEach(t => items.push({ level: 1, icon: '⏰', text: `Deadline hari ini: "${t.title}"`, sub: 'jangan sampai lewat', view: 'tasks' }));
  // 3) Akun GMV yang saya pegang belum diisi hari ini
  affAccounts.filter(a => a.active !== false && a.picId === user.id)
    .filter(a => !affEntries.some(e => e.accountId === a.id && e.date === today))
    .forEach(a => items.push({ level: 2, icon: '💰', text: `Input GMV hari ini: akun ${a.name}`, sub: 'goal bulanan ikut ter-update', view: 'affiliate-accounts' }));
  // 4) Laporan harian belum submit (mulai diingatkan jam 10; staff hanya jika Leader sudah membuatkan form)
  const wajibLapor = !isStaff || templates.some(t => t.assignedUserIds?.includes(user.id));
  if (wajibLapor && now.getHours() >= 10 && !dailyReports.some(r => r.authorId === user.id && r.date === today)) {
    items.push({ level: 3, icon: '📝', text: 'Isi laporan harian', sub: 'bukti kerja + nilai KPI-mu', view: 'daily-reports' });
  }
  // 5) Masalah kritis (untuk pengelola)
  if (user.role === 'owner' || user.role === 'manajer' || user.role === 'leader') {
    problems.filter(p => p.status !== 'resolved' && p.urgency === 'kritis')
      .forEach(p => items.push({ level: 4, icon: '🚨', text: `Tangani masalah kritis: "${p.title}"`, sub: 'selesaikan sampai akar (5-Why)', view: 'problems' }));
  }
  // 6) Lanjutkan yang sedang dikerjakan
  tasks.filter(t => t.assigneeId === user.id && t.status === 'in_progress')
    .forEach(t => items.push({ level: 5, icon: '▶️', text: `Lanjutkan: "${t.title}"`, sub: 'sedang dikerjakan', view: 'tasks' }));

  const top3 = items.sort((a, b) => a.level - b.level).slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-200/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-slate-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" /> Fokus Hari Ini
        </h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">3 prioritas teratasmu</span>
      </div>
      {top3.length === 0 ? (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          ✓ Tidak ada prioritas mendesak. Waktu terbaik untuk bantu tim, kejar target, atau cari peluang baru.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top3.map((it, i) => (
            <button key={i} onClick={() => setView(it.view)}
              className="text-left rounded-xl border-2 p-3.5 transition hover:-translate-y-0.5"
              style={{ borderColor: i === 0 ? '#FCA5A5' : i === 1 ? '#FCD34D' : '#BFDBFE', backgroundColor: i === 0 ? '#FEF2F2' : i === 1 ? '#FFFBEB' : '#EFF6FF' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-center">{i + 1}</span>
                <span>{it.icon}</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 leading-snug">{it.text}</div>
              <div className="text-[11px] text-slate-500 mt-1">{it.sub} →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardGmvWidget({ entries, targets, onOpen }) {
  const mk = monthKey();
  const monthTargets = targets[mk] || {};
  const totals = { mcn: 0, tap: 0, internal: 0 };
  entries.forEach(e => { if (e.date && e.date.startsWith(mk) && totals[e.division] !== undefined) totals[e.division] += Number(e.gmv) || 0; });
  const change = {};
  Object.keys(GMV_DIVISIONS).forEach(div => {
    const series = gmvDailySeries(entries, div, mk).filter(s => s.value > 0);
    const today = series[series.length - 1]?.value || 0;
    const prev = series[series.length - 2]?.value || 0;
    const pct = prev > 0 ? Math.round(((today - prev) / prev) * 100) : (today > 0 ? 100 : 0);
    change[div] = { today, prev, pct, diff: today - prev };
  });
  const grand = totals.mcn + totals.tap + totals.internal;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-blue-600" /></div>
          <div>
            <h3 className="font-display font-bold text-slate-900">Target & GMV Bulan Ini</h3>
            <p className="text-[11px] text-slate-500">Total gabungan: <b className="text-blue-700">{fmtRupiah(grand)}</b></p>
          </div>
        </div>
        <button onClick={onOpen} className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
          Detail <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(GMV_DIVISIONS).map(([div, cfg]) => {
          const total = totals[div];
          const target = Number(monthTargets[div]) || 0;
          const pct = target > 0 ? Math.min(Math.round((total / target) * 100), 999) : 0;
          const ch = change[div];
          return (
            <button key={div} onClick={onOpen} className="text-left rounded-xl border border-slate-100 p-3 hover:border-slate-300 hover:bg-slate-50 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{cfg.short}</span>
                {(ch.today > 0 || ch.prev > 0) && (
                  <span className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${ch.diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {ch.diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {ch.diff >= 0 ? '+' : ''}{ch.pct}%
                  </span>
                )}
              </div>
              <div className="font-display font-bold text-base text-slate-900 mt-1 leading-tight">{fmtRupiah(total)}</div>
              {target > 0 ? (
                <>
                  <div className="h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: cfg.color }} />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{pct}% dari target</div>
                </>
              ) : <div className="text-[10px] text-slate-300 mt-1">target belum diset</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TargetWidget({ targets, canManage, onManage }) {
  const active = targets.filter(t => t.status === 'active');
  const achieved = targets.filter(t => t.status === 'achieved');

  if (active.length === 0 && !canManage) return null;

  return (
    <div style={{ background: 'linear-gradient(135deg, #13235B 0%, #2563EB 50%, #0B1437 100%)', color: '#FFFFFF' }}
      className="relative overflow-hidden rounded-3xl text-white p-6 shadow-xl shadow-blue-900/20 border border-blue-700/30">
      {/* Decorative */}
      <div className="absolute -right-20 -top-20 w-72 h-72 bg-amber-300/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute right-1/3 -bottom-16 w-48 h-48 bg-violet-300/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="relative flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div style={{ backgroundColor: 'rgba(214, 168, 79, 0.18)', borderColor: 'rgba(214, 168, 79, 0.4)' }}
            className="w-11 h-11 rounded-2xl backdrop-blur border flex items-center justify-center">
            <Target className="w-5 h-5" style={{ color: '#FCD34D' }} />
          </div>
          <div>
            <h3 style={{ color: '#FFFFFF' }} className="font-display font-bold text-lg flex items-center gap-2">
              Target Tim
              {achieved.length > 0 && (
                <span style={{ backgroundColor: 'rgba(252, 211, 77, 0.2)', color: '#FCD34D', borderColor: 'rgba(252, 211, 77, 0.4)' }}
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold border">
                  {achieved.length} ✓
                </span>
              )}
            </h3>
            <p style={{ color: 'rgba(224, 231, 255, 0.85)' }} className="text-[11px]">Diingat tiap hari biar tim tetap fokus.</p>
          </div>
        </div>
        {canManage && (
          <button onClick={onManage}
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: 'rgba(255, 255, 255, 0.2)', color: '#FFFFFF' }}
            className="hover:!bg-amber-400 hover:!text-blue-900 backdrop-blur text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 border transition">
            <Edit2 className="w-3.5 h-3.5" /> Kelola Target
          </button>
        )}
      </div>

      {active.length === 0 ? (
        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
          className="relative backdrop-blur rounded-2xl p-5 text-center border">
          <Target className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(252, 211, 77, 0.6)' }} />
          <div style={{ color: 'rgba(224, 231, 255, 0.95)' }} className="text-sm">
            {canManage ? 'Belum ada target. Klik "Kelola Target" untuk mulai set.' : 'Belum ada target aktif.'}
          </div>
        </div>
      ) : (
        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {active.map(t => <TargetCard key={t.id} target={t} />)}
        </div>
      )}
    </div>
  );
}

function TargetCard({ target }) {
  const pct = target.targetValue > 0 ? Math.min(100, Math.round((Number(target.currentValue || 0) / Number(target.targetValue)) * 100)) : 0;
  const daysLeft = target.deadline ? daysUntil(target.deadline) : null;
  const formatValue = (v) => {
    if (target.formatType === 'currency') return fmtRupiah(v);
    if (target.formatType === 'percent') return `${v}%`;
    return `${fmtNumber(v)}${target.unit ? ' ' + target.unit : ''}`;
  };
  const barColor = pct >= 100 ? '#FCD34D' : pct >= 75 ? '#6EE7B7' : pct >= 50 ? '#FDE68A' : pct >= 25 ? '#FDBA74' : '#FCA5A5';

  return (
    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.18)' }}
      className="backdrop-blur rounded-2xl p-4 border hover:!bg-white/15 transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div style={{ color: '#FFFFFF' }} className="font-semibold text-sm truncate flex-1">{target.title}</div>
        {pct >= 100 && (
          <span style={{ backgroundColor: '#FCD34D', color: '#0B1437' }}
            className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">✓ Done</span>
        )}
      </div>
      {target.description && (
        <div style={{ color: 'rgba(224, 231, 255, 0.85)' }} className="text-[10px] -mt-1 mb-2 line-clamp-1">{target.description}</div>
      )}
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div style={{ color: 'rgba(224, 231, 255, 0.9)' }} className="text-xs truncate">
          <b style={{ color: '#FFFFFF' }} className="text-base tabular-nums">{formatValue(target.currentValue || 0)}</b>
          <span style={{ color: 'rgba(199, 210, 254, 0.75)' }} className="text-[10px]"> / {formatValue(target.targetValue)}</span>
        </div>
        <div style={{ color: pct >= 100 ? '#FCD34D' : '#FFFFFF' }}
          className="text-lg font-display font-bold tabular-nums">{pct}%</div>
      </div>
      <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }} className="w-full rounded-full h-1.5 overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: barColor }} className="h-full transition-all rounded-full"></div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px]">
        {target.deadline ? (
          <span style={{ color: daysLeft < 0 ? '#FCA5A5' : daysLeft <= 3 ? '#FDE68A' : 'rgba(224, 231, 255, 0.85)' }}
            className={`flex items-center gap-1 ${daysLeft < 0 ? 'font-bold' : daysLeft <= 3 ? 'font-semibold' : ''}`}>
            <Clock className="w-2.5 h-2.5" />
            {daysLeft < 0 ? `Lewat ${Math.abs(daysLeft)}h` : daysLeft === 0 ? 'Hari ini' : `${daysLeft}h lagi`}
          </span>
        ) : <span style={{ color: 'rgba(199, 210, 254, 0.6)' }}>No deadline</span>}
      </div>
    </div>
  );
}

// ============ TARGETS MANAGEMENT MODAL ============
function TargetsManagementModal({ user, targets, onSave, onClose }) {
  const [list, setList] = useState(targets);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const saveTarget = (data) => {
    let next;
    if (editing) {
      next = list.map(t => t.id === editing.id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t);
    } else {
      next = [...list, {
        id: uid(), ...data, status: 'active',
        createdById: user.id, createdByName: user.name,
        createdAt: new Date().toISOString()
      }];
    }
    setList(next);
    onSave(next);
    setShowForm(false); setEditing(null);
  };

  const deleteTarget = (target) => {
    if (!confirm(`Hapus target "${target.title}"?`)) return;
    const next = list.filter(t => t.id !== target.id);
    setList(next);
    onSave(next);
  };

  const toggleStatus = (target, newStatus) => {
    const next = list.map(t => t.id === target.id ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t);
    setList(next);
    onSave(next);
  };

  const updateProgress = (target, newValue) => {
    const isAchieved = Number(newValue) >= Number(target.targetValue);
    const next = list.map(t => t.id === target.id
      ? { ...t, currentValue: Number(newValue), status: isAchieved && t.status === 'active' ? 'achieved' : t.status, updatedAt: new Date().toISOString() }
      : t);
    setList(next);
    onSave(next);
  };

  const grouped = {
    active: list.filter(t => t.status === 'active'),
    achieved: list.filter(t => t.status === 'achieved'),
    archived: list.filter(t => t.status === 'archived')
  };

  return (
    <Modal title="Kelola Target Tim" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          💡 Target yang aktif akan muncul di dashboard semua anggota tim. Update progres secara berkala biar tim selalu lihat sejauh mana pencapaian.
        </div>

        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-700 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Target Baru
        </button>

        {grouped.active.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase mb-2">🎯 Target Aktif ({grouped.active.length})</div>
            <div className="space-y-2">
              {grouped.active.map(t => (
                <TargetListItem key={t.id} target={t}
                  onEdit={() => { setEditing(t); setShowForm(true); }}
                  onDelete={() => deleteTarget(t)}
                  onUpdateProgress={(v) => updateProgress(t, v)}
                  onArchive={() => toggleStatus(t, 'archived')}
                  onMarkAchieved={() => toggleStatus(t, 'achieved')} />
              ))}
            </div>
          </div>
        )}

        {grouped.achieved.length > 0 && (
          <div>
            <div className="text-xs font-bold text-blue-700 uppercase mb-2">✅ Sudah Tercapai ({grouped.achieved.length})</div>
            <div className="space-y-2">
              {grouped.achieved.map(t => (
                <TargetListItem key={t.id} target={t}
                  onEdit={() => { setEditing(t); setShowForm(true); }}
                  onDelete={() => deleteTarget(t)}
                  onUpdateProgress={(v) => updateProgress(t, v)}
                  onArchive={() => toggleStatus(t, 'archived')}
                  onReactivate={() => toggleStatus(t, 'active')} />
              ))}
            </div>
          </div>
        )}

        {grouped.archived.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">🗄️ Arsip ({grouped.archived.length})</div>
            <div className="space-y-2">
              {grouped.archived.map(t => (
                <TargetListItem key={t.id} target={t} archived
                  onEdit={() => { setEditing(t); setShowForm(true); }}
                  onDelete={() => deleteTarget(t)}
                  onReactivate={() => toggleStatus(t, 'active')} />
              ))}
            </div>
          </div>
        )}

        {list.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            <span className="text-3xl block mb-2">🎯</span>
            Belum ada target. Buat target pertama untuk tim Anda.
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">Tutup</button>
        </div>
      </div>

      {showForm && <TargetForm target={editing}
        onSave={saveTarget}
        onClose={() => { setShowForm(false); setEditing(null); }} />}
    </Modal>
  );
}

function TargetListItem({ target, archived, onEdit, onDelete, onUpdateProgress, onArchive, onMarkAchieved, onReactivate }) {
  const [editingProgress, setEditingProgress] = useState(false);
  const [tempValue, setTempValue] = useState(target.currentValue || 0);
  const pct = target.targetValue > 0 ? Math.min(100, Math.round((Number(target.currentValue || 0) / Number(target.targetValue)) * 100)) : 0;
  const daysLeft = target.deadline ? daysUntil(target.deadline) : null;
  const formatValue = (v) => {
    if (target.formatType === 'currency') return fmtRupiah(v);
    if (target.formatType === 'percent') return `${v}%`;
    return `${fmtNumber(v)}${target.unit ? ' ' + target.unit : ''}`;
  };

  return (
    <div className={`bg-white border rounded-lg p-3 ${archived ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900">{target.title}</div>
          {target.description && <div className="text-xs text-slate-500 mt-0.5">{target.description}</div>}
          {target.deadline && (
            <div className={`text-[10px] mt-1 ${daysLeft < 0 ? 'text-red-600 font-bold' : daysLeft <= 3 ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
              Deadline: {fmtDate(target.deadline)}
              {daysLeft !== null && target.status === 'active' && (daysLeft < 0 ? ` (Lewat ${Math.abs(daysLeft)} hari)` : daysLeft === 0 ? ' (Hari ini)' : ` (${daysLeft}h lagi)`)}
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} title="Edit" className="text-slate-400 hover:text-blue-600 p-1">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} title="Hapus" className="text-slate-400 hover:text-red-600 p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!editingProgress ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900">{formatValue(target.currentValue || 0)}</span>
              <span className="text-xs text-slate-500">/ {formatValue(target.targetValue)}</span>
              <span className="text-sm font-bold text-blue-700 ml-auto">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-1 overflow-hidden">
              <div className={`h-full transition-all ${pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-blue-400' : pct >= 50 ? 'bg-amber-400' : pct >= 25 ? 'bg-orange-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }}></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input type="number" value={tempValue} onChange={e => setTempValue(e.target.value)}
            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm tabular-nums" />
          <button onClick={() => { onUpdateProgress(tempValue); setEditingProgress(false); }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-semibold">Simpan</button>
          <button onClick={() => { setTempValue(target.currentValue || 0); setEditingProgress(false); }}
            className="text-xs text-slate-500 hover:bg-slate-100 px-2 py-1 rounded">Batal</button>
        </div>
      )}

      <div className="flex gap-1 mt-2 flex-wrap">
        {!archived && !editingProgress && (
          <button onClick={() => { setTempValue(target.currentValue || 0); setEditingProgress(true); }}
            className="text-[10px] px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold">
            ↑ Update Progres
          </button>
        )}
        {target.status === 'active' && pct < 100 && !editingProgress && (
          <button onClick={onMarkAchieved}
            className="text-[10px] px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold">
            ✓ Tandai Tercapai
          </button>
        )}
        {target.status !== 'archived' && !editingProgress && (
          <button onClick={onArchive}
            className="text-[10px] px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded font-semibold">
            🗄️ Arsipkan
          </button>
        )}
        {target.status !== 'active' && onReactivate && !editingProgress && (
          <button onClick={onReactivate}
            className="text-[10px] px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold">
            ↩ Aktifkan Lagi
          </button>
        )}
      </div>
    </div>
  );
}

function TargetForm({ target, onSave, onClose }) {
  const [form, setForm] = useState({
    title: target?.title || '',
    description: target?.description || '',
    targetValue: target?.targetValue || 0,
    currentValue: target?.currentValue || 0,
    unit: target?.unit || '',
    formatType: target?.formatType || 'number',
    deadline: target?.deadline || ''
  });
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    if (!form.title.trim()) return setError('Judul target wajib diisi.');
    if (!form.targetValue || Number(form.targetValue) <= 0) return setError('Target value harus lebih dari 0.');
    onSave({
      ...form,
      targetValue: Number(form.targetValue),
      currentValue: Number(form.currentValue) || 0
    });
  };

  return (
    <Modal title={target ? 'Edit Target' : 'Target Baru'} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Judul Target *">
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Mis. GMV Bulan Mei, Onboarding 20 Creator Baru, 50 Konten Viral"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>
        <Field label="Deskripsi (opsional)">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={2} placeholder="Detail target atau strategi mencapainya"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Format Angka">
            <select value={form.formatType} onChange={e => setForm({ ...form, formatType: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="number">Angka Biasa (mis. 50 konten)</option>
              <option value="currency">Rupiah (mis. Rp 50jt)</option>
              <option value="percent">Persen (mis. 80%)</option>
            </select>
          </Field>
          <Field label="Satuan (kalau format angka biasa)">
            <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
              placeholder="Mis. konten, creator, live, order"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              disabled={form.formatType !== 'number'} />
          </Field>
          <Field label="Target Value *">
            <input type="number" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })}
              placeholder="Mis. 50000000 (untuk Rp), 20 (untuk konten)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
          </Field>
          <Field label="Pencapaian Saat Ini">
            <input type="number" value={form.currentValue} onChange={e => setForm({ ...form, currentValue: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
          </Field>
        </div>
        <Field label="Deadline (opsional)">
          <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>

        {/* Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-blue-700 mb-1">Preview Tampilan</div>
          <div className="bg-blue-700 rounded p-3 text-white">
            <div className="font-semibold text-sm">{form.title || 'Judul Target'}</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xs">
                <b>{form.formatType === 'currency' ? `Rp ${fmtNumber(form.currentValue || 0)}` : form.formatType === 'percent' ? `${form.currentValue || 0}%` : `${fmtNumber(form.currentValue || 0)} ${form.unit || ''}`}</b>
                <span className="text-blue-200"> / {form.formatType === 'currency' ? `Rp ${fmtNumber(form.targetValue || 0)}` : form.formatType === 'percent' ? `${form.targetValue || 0}%` : `${fmtNumber(form.targetValue || 0)} ${form.unit || ''}`}</span>
              </span>
              <span className="font-display font-bold">
                {form.targetValue > 0 ? Math.min(100, Math.round((Number(form.currentValue || 0) / Number(form.targetValue)) * 100)) : 0}%
              </span>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel={target ? 'Update Target' : 'Simpan Target'} />
      </div>
    </Modal>
  );
}

// ============ USERS MANAGEMENT (Manajer/Leader) ============
function UsersView({ user, allUsers, settings, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);

  if (user.role === 'operasional') return <NoAccess />;

  // Visible: Manajer sees all; Leader sees self + operasional under them
  let visible = [];
  if ((user.role === 'manajer' || user.role === 'owner')) visible = allUsers;
  else if (user.role === 'leader') visible = allUsers.filter(u => u.id === user.id || u.leaderId === user.id);

  const grouped = {
    manajer: visible.filter(u => (u.role === 'manajer' || u.role === 'owner')),
    leader: visible.filter(u => u.role === 'leader'),
    operasional: visible.filter(u => u.role === 'operasional')
  };

  const handleSave = async (data) => {
    let list = await storage.getList('users:list');
    if (editing) {
      list = list.map(u => u.id === editing.id ? { ...u, ...data } : u);
      await logActivity(`mengupdate data ${data.name}`, user.name);
    } else {
      const salt = genSalt();
      const passwordHash = await hashPassword(data.password, salt);
      const newUser = {
        id: uid(), name: data.name, username: data.username.toLowerCase(),
        role: data.role, leaderId: data.role === 'operasional' ? data.leaderId : null,
        jobTitle: data.jobTitle?.trim() || '',
        division: data.division || 'internal',
        phone: data.phone || '', gmail: data.gmail || '', isSecretariat: !!data.isSecretariat, salt, passwordHash,
        joinedAt: new Date().toISOString(), createdById: user.id
      };
      list.push(newUser);
      const jtLabel = data.jobTitle ? ` (${data.jobTitle})` : '';
      await logActivity(`menambah ${ROLES[data.role].label}${jtLabel} baru: ${data.name}`, user.name);
    }
    await storage.set('users:list', list);
    setShowForm(false); setEditing(null);
    onRefresh();
  };

  const handleDelete = async (target) => {
    if (target.id === user.id) return alert('Tidak bisa menghapus diri sendiri.');
    if (!confirm(`Hapus akun ${target.name}? Tindakan ini tidak bisa dibatalkan.`)) return;
    const list = (await storage.getList('users:list')).filter(u => u.id !== target.id);
    await storage.set('users:list', list);
    await logActivity(`menghapus akun ${target.name}`, user.name);
    onRefresh();
  };

  const handleResetPassword = async (newPassword) => {
    const salt = genSalt();
    const passwordHash = await hashPassword(newPassword, salt);
    const list = (await storage.getList('users:list')).map(u =>
      u.id === resetting.id ? { ...u, salt, passwordHash } : u
    );
    await storage.set('users:list', list);
    await logActivity(`mereset password ${resetting.name}`, user.name);
    setResetting(null);
    alert('Password berhasil direset. Beri tahu user password barunya.');
  };

  return (
    <div className="max-w-6xl">
      <PageHeader title="Anggota Tim" subtitle={(user.role === 'manajer' || user.role === 'owner') ? 'Kelola semua Manajer, Leader, dan Tim Operasional' : 'Kelola Tim Operasional di bawah Anda'}
        action={
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Anggota Baru
          </button>
        } />

      {['manajer', 'leader', 'operasional'].map(role => {
        if (grouped[role].length === 0) return null;
        const RoleIcon = ROLES[role].icon;
        return (
          <div key={role} className="mb-6">
            <h3 className="flex items-center gap-2 font-display font-bold text-slate-700 mb-3">
              <RoleIcon className="w-4 h-4" /> {ROLES[role].label} <span className="text-xs text-slate-400 font-normal">({grouped[role].length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped[role].map(m => {
                const leader = m.leaderId ? allUsers.find(u => u.id === m.leaderId) : null;
                const operasionalCount = m.role === 'leader' ? allUsers.filter(u => u.leaderId === m.id).length : null;
                const canEdit = (user.role === 'manajer' || user.role === 'owner') || (user.role === 'leader' && m.leaderId === user.id);
                return (
                  <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition">
                    <div className="flex items-start gap-3">
                      <Avatar person={m} size="lg" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{m.name}</div>
                        <div className="text-xs text-slate-500">@{m.username}</div>
                        {displayJobTitle(m) && <div className="text-[10px] mt-1 inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{displayJobTitle(m)}</div>}
                        {leader && <div className="text-[10px] text-slate-500 mt-1">Leader: {leader.name}</div>}
                        {operasionalCount !== null && <div className="text-[10px] text-blue-600 mt-1">Memimpin {operasionalCount} operasional</div>}
                        {m.phone && <div className="text-[10px] text-slate-500 mt-0.5">📱 {m.phone}</div>}
                      </div>
                      {canEdit && (
                        <div className="flex flex-col gap-1">
                          <button onClick={() => { setEditing(m); setShowForm(true); }} title="Edit" className="text-slate-400 hover:text-blue-600 p-1">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setResetting(m)} title="Reset password" className="text-slate-400 hover:text-amber-600 p-1">
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(m)} title="Hapus" className="text-slate-400 hover:text-red-600 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {showForm && <UserForm currentUser={user} editing={editing} allUsers={allUsers} settings={settings}
        onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
      {resetting && <ResetPasswordModal target={resetting} onSave={handleResetPassword} onClose={() => setResetting(null)} />}
    </div>
  );
}

function UserForm({ currentUser, editing, allUsers, settings, onSave, onClose }) {
  const isEdit = !!editing;
  // Allowed roles based on currentUser
  const allowedRoles = useMemo(() => {
    if (currentUser.role === 'owner') return ['owner', 'manajer', 'leader', 'operasional'];
    if (currentUser.role === 'manajer') return ['manajer', 'leader', 'operasional'];
    if (currentUser.role === 'leader') return ['operasional'];
    return [];
  }, [currentUser]);

  const [form, setForm] = useState({
    name: editing?.name || '',
    username: editing?.username || '',
    role: editing?.role || allowedRoles[0] || 'operasional',
    leaderId: editing?.leaderId || (currentUser.role === 'leader' ? currentUser.id : ''),
    jobTitle: editing?.jobTitle || '',
    division: editing?.division || 'internal',
    phone: editing?.phone || '',
    gmail: editing?.gmail || '',
    isSecretariat: editing?.isSecretariat || false,
    password: '', confirmPassword: ''
  });
  const [error, setError] = useState('');

  const leaders = allUsers.filter(u => u.role === 'leader');
  const jobTitleOptions = settings?.jobTitles || DEFAULT_JOB_TITLES;

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.username.trim()) return setError('Nama dan username wajib diisi.');
    if (!/^[a-z0-9_.]+$/.test(form.username)) return setError('Username: huruf kecil, angka, titik, underscore.');
    if (!isEdit) {
      if (form.password.length < 6) return setError('Password minimal 6 karakter.');
      if (form.password !== form.confirmPassword) return setError('Konfirmasi password tidak cocok.');
      if (allUsers.some(u => u.username === form.username.toLowerCase())) return setError('Username sudah dipakai.');
    } else {
      if (form.username !== editing.username && allUsers.some(u => u.username === form.username.toLowerCase())) {
        return setError('Username sudah dipakai.');
      }
    }
    if (form.role === 'operasional' && !form.leaderId) return setError('Karyawan harus punya Leader.');
    onSave(form);
  };

  return (
    <Modal title={isEdit ? `Edit ${editing.name}` : 'Anggota Baru'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nama Lengkap *">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Username *">
          <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
            disabled={isEdit && editing.id === currentUser.id}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 lowercase disabled:bg-slate-100" />
        </Field>
        <Field label="Peran *">
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
            disabled={isEdit && editing.id === currentUser.id && currentUser.role !== 'owner'}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100">
            {allowedRoles.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
          </select>
        </Field>
        {form.role === 'operasional' && (
          <Field label="Leader Pengawas *">
            <select value={form.leaderId} onChange={e => setForm({ ...form, leaderId: e.target.value })}
              disabled={currentUser.role === 'leader'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100">
              <option value="">- Pilih Leader -</option>
              {leaders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Divisi / Tim *">
          <select value={form.division} onChange={e => setForm({ ...form, division: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {Object.entries(DIVISIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="text-[11px] text-slate-500 mt-1">💡 Menu yang muncul untuk anggota ini menyesuaikan divisinya. Mis. Internal & TAP tidak melihat menu Creator.</div>
        </Field>
        <Field label="Posisi / Jabatan">
          <input type="text" value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })}
            list="user-job-titles" placeholder="Pilih dari daftar atau ketik sendiri (mis. Creator Manager, Tim Ads)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <datalist id="user-job-titles">
            {jobTitleOptions.map(jt => <option key={jt} value={jt} />)}
          </datalist>
          <div className="text-[11px] text-slate-500 mt-1">💡 Daftar posisi bisa dikelola di menu Pengaturan App. Ketik bebas kalau perlu posisi yang belum ada.</div>
        </Field>
        <Field label="No. WhatsApp (opsional)">
          <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="08xxxxxxxxxx"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Gmail (untuk undangan Google Calendar)">
          <input type="email" value={form.gmail} onChange={e => setForm({ ...form, gmail: e.target.value })}
            placeholder="nama@gmail.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="text-[11px] text-slate-500 mt-1">💡 Dipakai supaya anggota ini otomatis diundang ke agenda di Google Calendar. Anggota juga bisa isi sendiri di Profil.</div>
        </Field>
        {(currentUser.role === 'owner' || currentUser.role === 'manajer') && (
          <Field label="Akses Khusus">
            <label className="flex items-start gap-2 cursor-pointer bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2.5">
              <input type="checkbox" checked={form.isSecretariat} onChange={e => setForm({ ...form, isSecretariat: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-600 mt-0.5" />
              <span className="text-xs text-slate-700">
                <b>Sekretariat / Asisten CEO</b> — bisa menambah & atur agenda kalender untuk <b>seluruh tim</b> (seperti Manajer, khusus untuk Kalender).
              </span>
            </label>
          </Field>
        )}
        {!isEdit && (
          <>
            <Field label="Password Awal *">
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
            <Field label="Konfirmasi Password *">
              <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
              💡 Berikan password awal ke user. Mereka login pakai username + password ini.
            </div>
          </>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} />
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ target, onSave, onClose }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    setError('');
    if (pw.length < 6) return setError('Password minimal 6 karakter.');
    if (pw !== confirm) return setError('Konfirmasi tidak cocok.');
    onSave(pw);
  };
  return (
    <Modal title={`Reset Password — ${target.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg">
          🔐 Set password baru. Beri tahu user password ini setelah disimpan.
        </div>
        <Field label="Password Baru">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Konfirmasi">
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel="Reset Password" />
      </div>
    </Modal>
  );
}

// ============ TASKS ============
function TasksView({ user, allUsers }) {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [filter, setFilter] = useState({ status: 'all', assignee: 'all', search: '' });

  const load = async () => setTasks(await loadTasks());
  useEffect(() => {
    load();
    const iv = setInterval(load, 10000); // auto-refresh tiap 10 detik
    return () => clearInterval(iv);
  }, []);

  // Sync viewing task with latest data
  useEffect(() => {
    if (viewing) {
      const fresh = tasks.find(t => t.id === viewing.id);
      if (fresh) setViewing(fresh);
    }
  }, [tasks]);

  const handleSave = async (data) => {
    try {
      let rec;
      if (editing) {
        rec = { ...editing, ...data, updatedAt: new Date().toISOString() };
      } else {
        const assignee = allUsers.find(u => u.id === data.assigneeId);
        rec = {
          id: uid(), ...data, assigneeName: assignee?.name || '-',
          createdById: user.id, createdByName: user.name, createdAt: new Date().toISOString(),
          comments: []
        };
      }
      const ok = await storage.set(TASK_REC_PREFIX + rec.id, rec);
      if (!ok) throw new Error('Gagal menyimpan ke server.');
      if (!editing) await logActivity(`memberi tugas "${data.title}" ke ${rec.assigneeName}`, user.name);
      setShowForm(false); setEditing(null); load();
    } catch (err) {
      alert('⚠️ Gagal menyimpan tugas: ' + (err?.message || err) + '\n\nCoba lagi saat koneksi stabil.');
    }
  };
  const handleDelete = async (t) => {
    if (!confirm(`Hapus tugas "${t.title}"?`)) return;
    const ok = await storage.delete(TASK_REC_PREFIX + t.id);
    if (!ok) { alert('Gagal menghapus tugas. Coba lagi.'); return; }
    if (viewing?.id === t.id) setViewing(null);
    load();
  };
  const patchTask = async (id, patch, activity) => {
    try {
      const cur = await storage.get(TASK_REC_PREFIX + id);
      if (!cur) return;
      const ok = await storage.set(TASK_REC_PREFIX + id, { ...cur, ...patch });
      if (!ok) throw new Error('gagal simpan');
      if (activity) await logActivity(activity, user.name);
      load();
    } catch (e) {
      alert('⚠️ Gagal menyimpan perubahan tugas (koneksi). Coba lagi.');
    }
  };
  const updateStatus = async (t, status) => {
    const now = new Date().toISOString();
    const patch = { status };
    if (status === 'qc') { patch.qcSubmittedAt = now; patch.qcResult = null; patch.qcNote = ''; patch.completedAt = null; }
    else if (status === 'done') { patch.completedAt = now; patch.qcResult = 'approved'; patch.qcDecidedAt = now; patch.qcDecidedById = user.id; patch.qcDecidedByName = user.name; }
    else { patch.completedAt = null; }
    await patchTask(t.id, patch,
      status === 'qc' ? `mengirim tugas "${t.title}" untuk QC` :
      status === 'done' ? `menyelesaikan tugas "${t.title}"` : null);
  };
  // QC oleh pemberi tugas: setujui → Selesai, atau minta revisi → balik Dikerjakan + catatan
  const qcApprove = (t) => updateStatus(t, 'done');
  const qcRevise = async (t) => {
    const note = prompt('Catatan revisi untuk penerima (apa yang perlu diperbaiki):', '');
    if (note === null) return;
    await patchTask(t.id, {
      status: 'in_progress', qcResult: 'revisi', qcNote: note.trim(),
      qcDecidedAt: new Date().toISOString(), qcDecidedById: user.id, qcDecidedByName: user.name, completedAt: null
    }, `meminta revisi tugas "${t.title}"`);
  };
  // Opsi status sesuai peran: penerima TIDAK bisa langsung "Selesai" (harus lewat QC)
  const statusOptionsFor = (t) => {
    const isMgr = user.role === 'manajer' || user.role === 'owner';
    const isCreator = t.createdById === user.id;
    const isAssignee = t.assigneeId === user.id;
    let opts = isMgr || isCreator ? ['todo', 'in_progress', 'qc', 'done'] : isAssignee ? ['todo', 'in_progress', 'qc'] : [t.status];
    if (!opts.includes(t.status)) opts = [...opts, t.status];
    return opts;
  };
  const canQC = (t) => (user.role === 'manajer' || user.role === 'owner' || t.createdById === user.id);

  const handleAddComment = async (task, text) => {
    if (!text.trim()) return;
    const newComment = {
      id: uid(),
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatarImage || null,
      authorRole: user.role,
      authorJobTitle: user.jobTitle || '',
      text: text.trim(),
      createdAt: new Date().toISOString()
    };
    const cur = await storage.get(TASK_REC_PREFIX + task.id);
    if (!cur) return;
    const ok = await storage.set(TASK_REC_PREFIX + task.id, { ...cur, comments: [...(cur.comments || []), newComment] });
    if (!ok) { alert('Gagal menyimpan komentar. Coba lagi.'); return; }
    await logActivity(`komen di tugas "${task.title}"`, user.name);
    load();
  };

  const handleDeleteComment = async (task, commentId) => {
    if (!confirm('Hapus komentar ini?')) return;
    const cur = await storage.get(TASK_REC_PREFIX + task.id);
    if (!cur) return;
    const ok = await storage.set(TASK_REC_PREFIX + task.id, { ...cur, comments: (cur.comments || []).filter(c => c.id !== commentId) });
    if (!ok) { alert('Gagal menghapus komentar. Coba lagi.'); return; }
    load();
  };

  // Visibility
  const visibleTasks = tasks.filter(t => can.canSeeTask(user, t, allUsers));
  // Assignable users
  const assignableUsers = useMemo(() => {
    if ((user.role === 'manajer' || user.role === 'owner')) return allUsers;
    // Leader boleh menugaskan ke staff/Leader divisi mana pun (lintas divisi: TAP→MCN dst), termasuk dirinya.
    if (user.role === 'leader') return allUsers.filter(u => u.id === user.id || u.role === 'operasional' || u.role === 'leader');
    return [user];
  }, [user, allUsers]);

  const filtered = visibleTasks.filter(t => {
    if (filter.status !== 'all' && t.status !== filter.status) return false;
    if (filter.assignee !== 'all' && t.assigneeId !== filter.assignee) return false;
    if (filter.search && !t.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl">
      <PageHeader title="Tiket" subtitle="Kelola semua tiket pekerjaan tim dalam satu tempat"
        action={can.createTasks(user) ? (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tiket Baru
          </button>
        ) : null} />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari tugas..." value={filter.search}
            onChange={e => setFilter({ ...filter, search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="all">Semua Status</option>
          {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filter.assignee} onChange={e => setFilter({ ...filter, assignee: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="all">Semua PIC</option>
          {assignableUsers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* DESKTOP: tabel */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hidden md:block">
        {filtered.length === 0 ? (
          <EmptyState icon={CheckSquare} text="Belum ada tugas yang sesuai filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold">Tugas</th>
                  <th className="text-left p-3 font-semibold">PIC</th>
                  <th className="text-left p-3 font-semibold">Deadline</th>
                  <th className="text-left p-3 font-semibold">Prioritas</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const days = daysUntil(t.deadline);
                  const canEdit = (user.role === 'manajer' || user.role === 'owner') || t.createdById === user.id;
                  return (
                    <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="p-3">
                        <select value={t.status} onChange={e => updateStatus(t, e.target.value)}
                          disabled={!((user.role === 'manajer' || user.role === 'owner') || t.createdById === user.id || (t.assigneeId === user.id && t.status !== 'done'))}
                          className={`text-xs px-2 py-1 rounded font-semibold border-0 cursor-pointer ${TASK_STATUS[t.status].color}`}>
                          {statusOptionsFor(t).map(k => <option key={k} value={k}>{TASK_STATUS[k].label}</option>)}
                        </select>
                        {t.status === 'qc' && canQC(t) && (
                          <div className="flex gap-1 mt-1.5">
                            <button onClick={() => qcApprove(t)} className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white">✓ Setujui</button>
                            <button onClick={() => qcRevise(t)} className="text-[10px] font-bold px-2 py-1 rounded bg-white border border-amber-300 text-amber-700 hover:bg-amber-50">↩ Revisi</button>
                          </div>
                        )}
                        {t.qcResult === 'revisi' && t.status === 'in_progress' && (
                          <div className="text-[10px] text-amber-700 mt-1 max-w-[140px]" title={t.qcNote}>↩ Revisi: {(t.qcNote || '').slice(0, 30)}{(t.qcNote || '').length > 30 ? '…' : ''}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <button onClick={() => setViewing(t)} className="text-left w-full group">
                          <div className="font-medium text-slate-800 group-hover:text-blue-700 transition flex items-center gap-2">
                            {t.title}
                            {t.comments && t.comments.length > 0 && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                💬 {t.comments.length}
                              </span>
                            )}
                          </div>
                          {t.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.description}</div>}
                        </button>
                      </td>
                      <td className="p-3 text-sm text-slate-700">{t.assigneeName}</td>
                      <td className="p-3 text-sm">
                        {t.deadline ? (
                          <div className={days < 0 && t.status !== 'done' ? 'text-red-600 font-semibold' : days <= 1 && t.status !== 'done' ? 'text-amber-700' : 'text-slate-700'}>
                            {fmtDate(t.deadline)}
                            {t.status !== 'done' && days !== null && (
                              <div className="text-[10px]">{days < 0 ? `Telat ${Math.abs(days)}h` : days === 0 ? 'Hari ini' : `${days}h lagi`}</div>
                            )}
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${PRIORITIES[t.priority].color}`}>{PRIORITIES[t.priority].label}</span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button onClick={() => setViewing(t)} title="Lihat detail & komentar"
                          className="text-slate-400 hover:text-blue-600 p-1">
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => { setEditing(t); setShowForm(true); }} className="text-slate-400 hover:text-blue-600 p-1">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {((user.role === 'manajer' || user.role === 'owner') || t.createdById === user.id) && (
                              <button onClick={() => handleDelete(t)} className="text-slate-400 hover:text-red-600 p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MOBILE & TABLET: kartu */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <EmptyState icon={CheckSquare} text="Belum ada tugas yang sesuai filter." />
        ) : (
          filtered.map(t => {
            const days = daysUntil(t.deadline);
            const canEdit = (user.role === 'manajer' || user.role === 'owner') || t.createdById === user.id;
            const canChangeStatus = (user.role === 'manajer' || user.role === 'owner') || t.createdById === user.id || (t.assigneeId === user.id && t.status !== 'done');
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <button onClick={() => setViewing(t)} className="text-left flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                      {t.title}
                      {t.comments && t.comments.length > 0 && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">💬 {t.comments.length}</span>
                      )}
                    </div>
                    {t.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>}
                  </button>
                  <span className={`text-[10px] px-2 py-1 rounded font-semibold flex-shrink-0 ${PRIORITIES[t.priority].color}`}>{PRIORITIES[t.priority].label}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 mb-3 flex-wrap">
                  <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /> {t.assigneeName}</span>
                  {t.deadline && (
                    <span className={`inline-flex items-center gap-1 ${days < 0 && t.status !== 'done' ? 'text-red-600 font-semibold' : days <= 1 && t.status !== 'done' ? 'text-amber-700' : ''}`}>
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {fmtDate(t.deadline)}
                      {t.status !== 'done' && days !== null && (
                        <span>· {days < 0 ? `Telat ${Math.abs(days)}h` : days === 0 ? 'Hari ini' : `${days}h lagi`}</span>
                      )}
                    </span>
                  )}
                </div>

                {t.status === 'qc' && canQC(t) && (
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => qcApprove(t)} className="flex-1 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">✓ Setujui (Selesai)</button>
                    <button onClick={() => qcRevise(t)} className="flex-1 text-xs font-bold px-3 py-2 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-50">↩ Minta Revisi</button>
                  </div>
                )}
                {t.qcResult === 'revisi' && t.status === 'in_progress' && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-2">↩ <b>Revisi diminta:</b> {t.qcNote || '(tanpa catatan)'}</div>
                )}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <select value={t.status} onChange={e => updateStatus(t, e.target.value)}
                    disabled={!canChangeStatus}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border-0 cursor-pointer ${TASK_STATUS[t.status].color}`}>
                    {statusOptionsFor(t).map(k => <option key={k} value={k}>{TASK_STATUS[k].label}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewing(t)} title="Detail & komentar" className="text-slate-400 hover:text-blue-600 p-1.5">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button onClick={() => { setEditing(t); setShowForm(true); }} className="text-slate-400 hover:text-blue-600 p-1.5">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && ((user.role === 'manajer' || user.role === 'owner') || t.createdById === user.id) && (
                      <button onClick={() => handleDelete(t)} className="text-slate-400 hover:text-red-600 p-1.5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && <TaskForm task={editing} user={user} assignableUsers={assignableUsers}
        onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
      {viewing && <TaskDetailModal task={viewing} user={user} allUsers={allUsers}
        onEdit={() => { setEditing(viewing); setShowForm(true); setViewing(null); }}
        onDelete={() => handleDelete(viewing)}
        onAddComment={(text) => handleAddComment(viewing, text)}
        onDeleteComment={(commentId) => handleDeleteComment(viewing, commentId)}
        canQC={canQC(viewing)}
        onQcApprove={() => { qcApprove(viewing); setViewing(null); }}
        onQcRevise={() => { qcRevise(viewing); setViewing(null); }}
        onClose={() => setViewing(null)} />}
    </div>
  );
}

// ============ TASK DETAIL MODAL (with Comments) ============
function TaskDetailModal({ task, user, allUsers, onEdit, onDelete, onAddComment, onDeleteComment, canQC, onQcApprove, onQcRevise, onClose }) {
  const [commentText, setCommentText] = useState('');
  const days = daysUntil(task.deadline);

  // Permission: bisa lihat task ini (sudah dilewati canSeeTask di parent), bisa komen kalau:
  // - createdById (pemberi tugas)
  // - assigneeId (penerima)
  // - Leader yang membawahi assignee
  // - Manajer
  const assigneeUser = allUsers.find(u => u.id === task.assigneeId);
  const canComment =
    task.createdById === user.id ||
    task.assigneeId === user.id ||
    (user.role === 'manajer' || user.role === 'owner') ||
    (user.role === 'leader' && assigneeUser?.leaderId === user.id);

  const canEdit = (user.role === 'manajer' || user.role === 'owner') || task.createdById === user.id;
  const canDelete = (user.role === 'manajer' || user.role === 'owner') || task.createdById === user.id;

  const submitComment = () => {
    if (!commentText.trim()) return;
    onAddComment(commentText);
    setCommentText('');
  };

  const comments = task.comments || [];

  return (
    <Modal title="Detail Tugas" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Task info */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded font-semibold ${TASK_STATUS[task.status].color}`}>● {TASK_STATUS[task.status].label}</span>
            <span className={`text-xs px-2 py-1 rounded font-semibold ${PRIORITIES[task.priority].color}`}>{PRIORITIES[task.priority].label}</span>
          </div>
          <h3 className="font-display font-bold text-slate-900 text-xl">{task.title}</h3>
          {task.description && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{task.description}</p>}
        </div>

        {/* Panel QC */}
        {task.status === 'qc' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><Check className="w-4 h-4" /> Menunggu QC</div>
            <div className="text-xs text-amber-700 mt-0.5">{task.assigneeName} sudah menandai selesai. {canQC ? 'Cek hasilnya lalu setujui atau minta revisi.' : 'Menunggu pemberi tugas mengecek.'}</div>
            {canQC && (
              <div className="flex gap-2 mt-2.5">
                <button onClick={onQcApprove} className="flex-1 text-sm font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">✓ Setujui (Selesai)</button>
                <button onClick={onQcRevise} className="flex-1 text-sm font-bold px-3 py-2 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-50">↩ Minta Revisi</button>
              </div>
            )}
          </div>
        )}
        {task.qcResult === 'revisi' && task.status === 'in_progress' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
            <span className="font-semibold text-amber-800">↩ Revisi diminta</span>
            <span className="text-amber-700"> oleh {task.qcDecidedByName || 'pemberi tugas'}:</span>
            <div className="text-slate-700 mt-1 whitespace-pre-wrap">{task.qcNote || '(tanpa catatan)'}</div>
          </div>
        )}
        {task.qcResult === 'approved' && task.status === 'done' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
            ✅ <b>Lolos QC</b> — disetujui {task.qcDecidedByName || 'pemberi tugas'}{task.qcDecidedAt ? ` · ${fmtDateTime(task.qcDecidedAt)}` : ''}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-slate-500">PIC / Penerima</div>
            <div className="font-semibold text-slate-800 mt-0.5">{task.assigneeName}</div>
            {assigneeUser?.jobTitle && <div className="text-xs text-slate-500">{assigneeUser.jobTitle}</div>}
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-slate-500">Pemberi Tugas</div>
            <div className="font-semibold text-slate-800 mt-0.5">{task.createdByName || '-'}</div>
            <div className="text-xs text-slate-500">{fmtDateTime(task.createdAt)}</div>
          </div>
          {task.deadline && (
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-slate-500">Deadline</div>
              <div className={`font-semibold mt-0.5 ${days < 0 && task.status !== 'done' ? 'text-red-600' : days <= 1 && task.status !== 'done' ? 'text-amber-700' : 'text-slate-800'}`}>
                {fmtDate(task.deadline)}
              </div>
              {task.status !== 'done' && days !== null && (
                <div className="text-xs text-slate-500">{days < 0 ? `Telat ${Math.abs(days)} hari` : days === 0 ? 'Hari ini' : `${days} hari lagi`}</div>
              )}
            </div>
          )}
          {task.status === 'done' && task.completedAt && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-[10px] uppercase font-bold text-blue-700">✅ Diselesaikan</div>
              <div className="font-semibold text-slate-800 mt-0.5">{fmtDateTime(task.completedAt)}</div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <button onClick={onEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Edit Tugas
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete}
              className="bg-white border border-red-300 hover:bg-red-50 text-red-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Hapus
            </button>
          )}
        </div>

        {/* Comments section */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <h4 className="font-display font-bold text-slate-900">Komentar ({comments.length})</h4>
          </div>

          {/* Permission notice */}
          {!canComment && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded-lg mb-3">
              💬 Hanya pemberi tugas, penerima tugas, dan Leader/Manajer dalam tim yang bisa komen di sini.
            </div>
          )}

          {/* Comments list */}
          {comments.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              Belum ada komentar. {canComment && 'Mulai diskusi di bawah.'}
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto scroll-thin mb-3">
              {comments.map(c => {
                const isMine = c.authorId === user.id;
                const canDeleteComment = isMine || (user.role === 'manajer' || user.role === 'owner');
                return (
                  <div key={c.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 overflow-hidden">
                      {c.authorAvatar
                        ? <img src={c.authorAvatar} alt="" className="w-full h-full object-cover" />
                        : c.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-[80%] ${isMine ? 'items-end' : ''} flex flex-col`}>
                      <div className={`rounded-2xl px-3 py-2 ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                        <div className={`text-[10px] font-bold mb-0.5 flex items-center gap-1 ${isMine ? 'text-blue-100' : 'text-slate-600'}`}>
                          {isMine ? 'Saya' : c.authorName}
                          {c.authorRole && <span className="opacity-70">· {ROLES[c.authorRole]?.label}</span>}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{c.text}</div>
                      </div>
                      <div className={`flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 px-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                        <span>{fmtDateTime(c.createdAt)}</span>
                        {canDeleteComment && (
                          <button onClick={() => onDeleteComment(c.id)} className="hover:text-red-600">
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add comment input */}
          {canComment && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
              <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                rows={2} placeholder="Tulis komentar atau update progres..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm bg-white" />
              <div className="flex items-center justify-between mt-2">
                <div className="text-[10px] text-slate-500">Ctrl+Enter untuk kirim cepat</div>
                <button onClick={submitComment} disabled={!commentText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs px-4 py-1.5 rounded font-semibold flex items-center gap-1">
                  <Send className="w-3 h-3" /> Kirim
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">Tutup</button>
        </div>
      </div>
    </Modal>
  );
}

function SearchableSelect({ value, onChange, options, placeholder = 'Ketik untuk cari / pilih...' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(o => o.value === value);
  const q = query.toLowerCase();
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  return (
    <div className="relative">
      <input type="text"
        value={open ? query : (selected ? selected.label : '')}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto scroll-thin">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">Tidak ditemukan</div>
          ) : filtered.map(o => (
            <button key={o.value} type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${o.value === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskForm({ task, user, assignableUsers, onSave, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigneeId: task?.assigneeId || (assignableUsers[0]?.id || ''),
    deadline: task?.deadline || '',
    priority: task?.priority || 'medium',
    status: task?.status || 'todo'
  });
  return (
    <Modal title={task ? 'Edit Tiket' : 'Tiket Baru'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Judul Tugas *">
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Mis. Bikin script live shopping Sabun A"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Deskripsi">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PIC *">
            <SearchableSelect
              value={form.assigneeId}
              onChange={(v) => setForm({ ...form, assigneeId: v })}
              options={assignableUsers.map(m => ({ value: m.id, label: `${m.name}${DIVISIONS[m.division] ? ' · ' + DIVISIONS[m.division].label : ''} — ${displayJobTitle(m) || ROLES[m.role].label}` }))}
              placeholder="Ketik nama / divisi untuk cari..." />
          </Field>
          <Field label="Deadline">
            <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="Prioritas">
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <FormActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.title.trim() || !form.assigneeId} />
      </div>
    </Modal>
  );
}

// ============ CREATORS ============
function CreatorsView({ user, allUsers }) {
  const [creators, setCreators] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({ status: 'all', manager: 'all', search: '' });
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async () => { setCreators(await storage.getList('creators:all')); setSelectedIds([]); };
  useEffect(() => { load(); }, []);

  const isOwnerMgr = user.role === 'owner' || user.role === 'manajer';

  const handleSave = async (data) => {
    let list = await storage.getList('creators:all');
    if (editing) {
      list = list.map(c => c.id === editing.id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c);
    } else {
      const manager = allUsers.find(u => u.id === data.managerId);
      list.unshift({
        id: uid(), ...data,
        managerName: manager?.name || '-',
        createdAt: new Date().toISOString()
      });
      await logActivity(`menambah creator "${data.name}"`, user.name);
    }
    await storage.set('creators:all', list);
    setShowForm(false); setEditing(null); load();
  };
  const handleDelete = async (c) => {
    if (!confirm(`Hapus creator "${c.name}"?`)) return;
    const list = (await storage.getList('creators:all')).filter(x => x.id !== c.id);
    await storage.set('creators:all', list);
    load();
  };

  // Hapus beberapa creator sekaligus (yang diceklis)
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Hapus ${selectedIds.length} creator yang diceklis? Tindakan ini tidak bisa dibatalkan.`)) return;
    const idSet = new Set(selectedIds);
    const list = (await storage.getList('creators:all')).filter(x => !idSet.has(x.id));
    await storage.set('creators:all', list);
    await logActivity(`menghapus ${selectedIds.length} creator sekaligus`, user.name);
    load();
  };

  // Hapus SEMUA creator (owner/manajer, konfirmasi ganda)
  const handleDeleteAll = async () => {
    if (!confirm(`Hapus SEMUA creator (${creators.length} data)? Tindakan ini tidak bisa dibatalkan.`)) return;
    if (!confirm('Yakin 100%? Seluruh database creator akan hilang permanen. Disarankan Export Data dulu sebagai cadangan.')) return;
    await storage.set('creators:all', []);
    await logActivity(`menghapus SEMUA creator (${creators.length} data)`, user.name);
    load();
  };

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const visibleCreators = creators.filter(c => can.canSeeCreator(user, c, allUsers));
  const managers = useMemo(() => {
    if ((user.role === 'manajer' || user.role === 'owner')) return allUsers.filter(u => u.role === 'operasional' || u.role === 'leader');
    if (user.role === 'leader') return allUsers.filter(u => u.leaderId === user.id || u.id === user.id);
    return [user];
  }, [user, allUsers]);

  const filtered = visibleCreators.filter(c => {
    if (filter.status !== 'all' && c.status !== filter.status) return false;
    if (filter.manager !== 'all' && c.managerId !== filter.manager) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.tiktokHandle || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const totalGmv = filtered.reduce((s, c) => s + (Number(c.totalGmv) || 0), 0);
  const totalOrders = filtered.reduce((s, c) => s + (Number(c.totalOrders) || 0), 0);

  return (
    <div className="max-w-7xl">
      <PageHeader title="Database Creator" subtitle="Catat dan kelola semua creator affiliate"
        action={
          <div className="flex gap-2 flex-wrap">
            <DownloadTemplateButton />
            <ExportCreatorsButton creators={filtered} />
            <ImportCsvButton onImported={load} user={user} managers={managers} />
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Creator Baru</span><span className="sm:hidden">Baru</span>
            </button>
          </div>
        } />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <MiniStat label="Total Creator" value={fmtNumber(filtered.length)} color="emerald" />
        <MiniStat label="Total GMV" value={fmtRupiah(totalGmv)} color="amber" />
        <MiniStat label="Total Order" value={fmtNumber(totalOrders)} color="blue" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari nama atau @tiktok..." value={filter.search}
            onChange={e => setFilter({ ...filter, search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="all">Semua Status</option>
          {Object.entries(CREATOR_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filter.manager} onChange={e => setFilter({ ...filter, manager: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="all">Semua Manager</option>
          {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Bulk action bar: hapus terpilih / hapus semua */}
      {(selectedIds.length > 0 || (isOwnerMgr && creators.length > 0)) && (
        <div className="mb-4 flex items-center gap-2 flex-wrap bg-white rounded-xl border border-slate-200 p-3">
          {selectedIds.length > 0 ? (
            <>
              <span className="text-sm text-slate-600"><b className="text-blue-700">{selectedIds.length}</b> creator diceklis</span>
              <button onClick={handleDeleteSelected}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Hapus Terpilih ({selectedIds.length})
              </button>
              <button onClick={() => setSelectedIds([])}
                className="text-sm text-slate-500 hover:text-slate-700 font-semibold px-2 py-1.5">Batal pilih</button>
            </>
          ) : (
            <span className="text-xs text-slate-400">Ceklis baris untuk hapus beberapa sekaligus</span>
          )}
          {isOwnerMgr && (
            <button onClick={handleDeleteAll} disabled={creators.length === 0}
              className="ml-auto bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 text-sm font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Hapus Semua Creator
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} text="Belum ada creator. Klik 'Creator Baru' atau import CSV." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="p-3 w-10">
                    <input type="checkbox" title="Ceklis semua (hasil filter)"
                      checked={filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id))}
                      onChange={e => setSelectedIds(e.target.checked ? filtered.map(c => c.id) : [])}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
                  </th>
                  <th className="text-left p-3 font-semibold">Creator</th>
                  <th className="text-left p-3 font-semibold">Kategori</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-right p-3 font-semibold">Order</th>
                  <th className="text-right p-3 font-semibold">GMV</th>
                  <th className="text-left p-3 font-semibold">Manager</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className={`border-t border-slate-100 hover:bg-slate-50 ${selectedIds.includes(c.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="p-3">
                      <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        {c.tiktokHandle && <span>TikTok: @{c.tiktokHandle.replace('@', '')}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-slate-700">{c.category || '-'}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${CREATOR_STATUS[c.status].color}`}>{CREATOR_STATUS[c.status].label}</span>
                    </td>
                    <td className="p-3 text-sm text-right tabular-nums text-slate-700">{fmtNumber(c.totalOrders)}</td>
                    <td className="p-3 text-sm text-right tabular-nums font-semibold text-slate-800">{fmtRupiah(c.totalGmv)}</td>
                    <td className="p-3 text-sm text-slate-600">{c.managerName || '-'}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(c); setShowForm(true); }} className="text-slate-400 hover:text-blue-600 p-1">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="text-slate-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <CreatorForm creator={editing} user={user} managers={managers}
        onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function CreatorForm({ creator, user, managers, onSave, onClose }) {
  const [form, setForm] = useState({
    name: creator?.name || '',
    tiktokHandle: creator?.tiktokHandle || '',
    category: creator?.category || '',
    status: creator?.status || 'pending',
    totalOrders: creator?.totalOrders || 0,
    totalGmv: creator?.totalGmv || 0,
    managerId: creator?.managerId || (user.role === 'operasional' ? user.id : managers[0]?.id || ''),
    notes: creator?.notes || ''
  });
  return (
    <Modal title={creator ? 'Edit Creator' : 'Creator Baru'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama Creator *">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="Kategori">
            <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="Beauty, Fashion, Food..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="TikTok Handle">
            <input type="text" value={form.tiktokHandle} onChange={e => setForm({ ...form, tiktokHandle: e.target.value })}
              placeholder="@username"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="Total Order">
            <input type="number" value={form.totalOrders} onChange={e => setForm({ ...form, totalOrders: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
          </Field>
          <Field label="Total GMV (Rp)">
            <input type="number" value={form.totalGmv} onChange={e => setForm({ ...form, totalGmv: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {Object.entries(CREATOR_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Manager / PIC *">
            <select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">- Pilih manager -</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name}{m.jobTitle ? ` · ${m.jobTitle}` : ""} — {ROLES[m.role].label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Catatan">
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <FormActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.name.trim() || !form.managerId} />
      </div>
    </Modal>
  );
}

// ============ CREATOR MANAGEMENT (Mapping siapa kelola siapa) ============
function CreatorManagementView({ user, allUsers }) {
  const [creators, setCreators] = useState([]);
  const [reassigning, setReassigning] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const load = async () => {
    setCreators(await storage.getList('creators:all'));
    setLastSync(await storage.get('creators:last-sync'));
  };
  useEffect(() => { load(); }, []);

  const visibleCreators = creators.filter(c => can.canSeeCreator(user, c, allUsers));
  // Group by manager
  const grouped = useMemo(() => {
    const m = {};
    visibleCreators.forEach(c => {
      const key = c.managerId || 'unassigned';
      if (!m[key]) m[key] = [];
      m[key].push(c);
    });
    return m;
  }, [visibleCreators]);

  const handleReassign = async (newManagerId) => {
    const newManager = allUsers.find(u => u.id === newManagerId);
    const list = (await storage.getList('creators:all')).map(c =>
      c.id === reassigning.id ? { ...c, managerId: newManagerId, managerName: newManager?.name || '-' } : c
    );
    await storage.set('creators:all', list);
    await logActivity(`memindahkan creator "${reassigning.name}" ke ${newManager?.name}`, user.name);
    setReassigning(null);
    load();
  };

  // Dashboard ini khusus MCN: hanya tampilkan anggota divisi MCN (leader/operasional)
  const managers = allUsers.filter(u => (u.role === 'operasional' || u.role === 'leader') && (u.division || '') === 'mcn');
  // Filter managers based on user role
  const visibleManagers = managers.filter(m => can.canSeeUser(user, m));

  return (
    <div className="max-w-7xl">
      <PageHeader title="Pengelolaan Creator"
        subtitle="Visual mapping: siapa mengelola siapa, dan performa per manager"
        action={can.editAppSettings(user) ? null : null} />

      <div className="bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-200 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Link2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-slate-900">Integrasi TikTok / MCN Dashboard</h3>
            <p className="text-sm text-slate-600 mt-1">
              Integrasi langsung TikTok API tidak tersedia di versi ini. Untuk update data GMV/order creator:
              <b> export CSV dari TikTok Seller Center</b> → klik <b>Import CSV</b> di halaman Database Creator → data otomatis ter-update.
            </p>
            {lastSync && (
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Last sync: {fmtDateTime(lastSync)}
              </div>
            )}
          </div>
        </div>
      </div>

      {visibleManagers.length === 0 ? (
        <EmptyState icon={Network} text="Belum ada Manager. Tambahkan di menu Anggota Tim." />
      ) : (
        <div className="space-y-4">
          {visibleManagers.map(manager => {
            const myCreators = grouped[manager.id] || [];
            const totalGmv = myCreators.reduce((s, c) => s + (Number(c.totalGmv) || 0), 0);
            const totalOrders = myCreators.reduce((s, c) => s + (Number(c.totalOrders) || 0), 0);
            const aktif = myCreators.filter(c => c.status === 'aktif').length;
            return (
              <div key={manager.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold">
                      {manager.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-display font-bold text-slate-900">{manager.name}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${ROLES[manager.role].color}`}>{ROLES[manager.role].label}</span>
                    </div>
                  </div>
                  <div className="flex gap-5 text-xs">
                    <div><div className="text-slate-500">Creator</div><div className="font-bold text-slate-900 text-lg">{myCreators.length}</div></div>
                    <div><div className="text-slate-500">Aktif</div><div className="font-bold text-blue-700 text-lg">{aktif}</div></div>
                    <div><div className="text-slate-500">Order</div><div className="font-bold text-slate-900 text-lg">{fmtNumber(totalOrders)}</div></div>
                    <div><div className="text-slate-500">GMV</div><div className="font-bold text-amber-700 text-lg">{fmtRupiah(totalGmv)}</div></div>
                  </div>
                </div>
                {myCreators.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">Belum mengelola creator</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myCreators.map(c => (
                      <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800">{c.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${CREATOR_STATUS[c.status].color}`}>{CREATOR_STATUS[c.status].label}</span>
                            {c.category && <span className="text-xs text-slate-500">· {c.category}</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {c.tiktokHandle && <span>TikTok: @{c.tiktokHandle.replace('@', '')}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-right">
                            <div className="text-slate-500">Order / GMV</div>
                            <div className="font-semibold tabular-nums">{fmtNumber(c.totalOrders)} / {fmtRupiah(c.totalGmv)}</div>
                          </div>
                          {can.assignCreator(user) && (
                            <button onClick={() => setReassigning(c)} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 rounded-md font-semibold transition">
                              Pindah Manager
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned creators */}
          {grouped.unassigned && grouped.unassigned.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-amber-200">
                <div className="font-bold text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Creator Tanpa Manager ({grouped.unassigned.length})
                </div>
                <div className="text-xs text-amber-700 mt-1">Segera assign ke manager untuk akuntabilitas.</div>
              </div>
              <div className="divide-y divide-amber-100">
                {grouped.unassigned.map(c => (
                  <div key={c.id} className="p-4 flex items-center justify-between">
                    <div className="font-medium text-slate-800">{c.name}</div>
                    <button onClick={() => setReassigning(c)} className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold">
                      Assign Manager
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {reassigning && (
        <Modal title={`Pindah "${reassigning.name}" ke...`} onClose={() => setReassigning(null)}>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {managers.map(m => (
              <button key={m.id} onClick={() => handleReassign(m.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                  reassigning.managerId === m.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50'
                }`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800">{m.name}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLES[m.role].color}`}>{ROLES[m.role].label}</span>
                  </div>
                </div>
                {reassigning.managerId === m.id && <Check className="w-5 h-5 text-blue-600" />}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ IMPORT CSV BUTTON ============
function ImportCsvButton({ onImported, user, managers }) {
  const inputRef = useRef();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { setImporting(false); return alert('CSV kosong atau format salah.'); }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const cells = [];
      let cur = '', inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuote = !inQuote;
        else if (ch === ',' && !inQuote) { cells.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      cells.push(cur.trim());
      const row = {};
      headers.forEach((h, i) => row[h] = (cells[i] || '').replace(/^"|"$/g, ''));
      return row;
    });

    // Parse angka Rupiah Indonesia: "Rp27.006.784.021" -> 27006784021
    const parseRp = (v) => Number(String(v || '').replace(/[^\d]/g, '')) || 0;

    const list = await storage.getList('creators:all');
    let added = 0, updated = 0, skipped = 0;
    rows.forEach(row => {
      // Dukung header template sederhana DAN export TikTok Partner Center
      const name = row.name || row.nama || row.creator || row['creator name'] || row['nama pengguna kreator'] || row['nama kreator'];
      // Lewati baris ringkasan/total dari export TikTok
      if (!name || ['ringkasan', 'summary', 'total', '-'].includes(name.toLowerCase().trim())) { skipped++; return; }
      const tiktok = row.tiktok || row['tiktok handle'] || row.handle || row['username'] || (row['nama pengguna kreator'] ? '@' + row['nama pengguna kreator'] : '');
      // GMV: utamakan "GMV Afiliasi" dari TikTok, fallback ke kolom sederhana
      const gmv = parseRp(row['gmv afiliasi'] || row.gmv || row['total gmv'] || '0');
      const gmvLive = parseRp(row['gmv live afiliasi'] || '0');
      const gmvVideo = parseRp(row['gmv video afiliasi'] || '0');
      const orders = parseRp(row['pesanan dari afiliasi'] || row.orders || row.order || row['total orders'] || '0');
      const category = row.category || row.kategori || row['kategori level 1'] || row['kategori level 2'] || '';
      const existing = list.find(c =>
        c.name.toLowerCase() === name.toLowerCase() ||
        (tiktok && c.tiktokHandle && c.tiktokHandle.toLowerCase() === tiktok.toLowerCase())
      );
      const data = {
        totalGmv: gmv, totalOrders: orders, category, tiktokHandle: tiktok,
        gmvLive, gmvVideo
      };
      if (existing) {
        Object.assign(existing, data, { updatedAt: new Date().toISOString() });
        updated++;
      } else {
        list.push({
          id: uid(), name, ...data,
          status: 'aktif',
          managerId: user.role === 'operasional' ? user.id : (managers[0]?.id || ''),
          managerName: user.role === 'operasional' ? user.name : (managers[0]?.name || '-'),
          notes: 'Diimport dari CSV',
          createdAt: new Date().toISOString()
        });
        added++;
      }
    });
    await storage.set('creators:all', list);
    await storage.set('creators:last-sync', new Date().toISOString());
    await logActivity(`import CSV: ${added} creator baru, ${updated} update`, user.name);
    setResult({ added, updated });
    setImporting(false);
    onImported();
    e.target.value = '';
    setTimeout(() => setResult(null), 5000);
  };

  return (
    <>
      <button onClick={() => inputRef.current?.click()} disabled={importing}
        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4" /> {importing ? 'Importing...' : 'Import CSV'}
      </button>
      <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
      {result && (
        <div className="fixed top-20 right-8 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 text-sm">
          ✅ {result.added} creator baru, {result.updated} di-update
        </div>
      )}
    </>
  );
}

// ============ DOWNLOAD TEMPLATE CSV ============
function DownloadTemplateButton() {
  const handleDownload = () => {
    // Header jelas + contoh. Import juga otomatis mengenali file export TikTok Partner Center.
    const headers = 'name,tiktok,category,gmv,orders';
    const samples = [
      '"Nama Creator (wajib)","@username","Kategori",GMV_angka,jumlah_order',
      '"Fadila Teja","@fadilatejapratamaa","Menswear",6090340648,60691',
      '"Apin","@apin.ketiduran","Electronics",1208650547,12696',
      '"Contoh Beauty","@beautycreator","Beauty",1500000,12'
    ];
    const csv = [headers, ...samples].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-creator-import.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={handleDownload} title="Download template CSV. Import juga bisa langsung dari file export TikTok Partner Center."
      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
      <FileDown className="w-4 h-4" /> Template CSV
    </button>
  );
}

// ============ EXPORT DATA CREATOR (rapi) ============
function ExportCreatorsButton({ creators }) {
  const handleExport = () => {
    if (!creators || creators.length === 0) { alert('Belum ada data creator untuk diexport.'); return; }
    const rows = [['Nama', 'TikTok', 'Kategori', 'Status', 'Manager', 'GMV Total', 'GMV LIVE', 'GMV Video', 'Total Order', 'Catatan']];
    creators.forEach(c => {
      rows.push([
        c.name || '',
        c.tiktokHandle || '',
        c.category || '',
        c.status || 'aktif',
        c.managerName || '-',
        c.totalGmv || 0,
        c.gmvLive || 0,
        c.gmvVideo || 0,
        c.totalOrders || 0,
        (c.notes || '').replace(/"/g, "'")
      ]);
    });
    const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Data-Creator-${dayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={handleExport} title="Download data creator yang sudah rapi (buka di Excel)"
      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
      <Download className="w-4 h-4" /> Export Data
    </button>
  );
}

// ============ REPORTS ============
function ReportsView({ user, allUsers }) {
  if (user.role === 'operasional') return <NoAccess />;
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [genBusy, setGenBusy] = useState(false);
  const [filterWeek, setFilterWeek] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  const load = async () => setReports(await storage.getList('reports:all'));
  useEffect(() => { load(); }, []);

  // Anti kerja dobel: rangkum otomatis laporan-laporan HARIAN minggu ini → draft laporan mingguan
  const generateFromDaily = async () => {
    setGenBusy(true);
    const week = getWeekRange();
    const daily = (await loadDailyReports())
      .filter(r => r.authorId === user.id && r.date >= week.start && r.date <= week.end)
      .sort((a, b) => a.date.localeCompare(b.date));
    setGenBusy(false);
    if (daily.length === 0) {
      alert('Belum ada laporan harian milikmu minggu ini. Isi Laporan Harian dulu, atau tulis laporan mingguan manual.');
      return;
    }
    const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    const fieldsOf = (r) => r.fieldsSnapshot && Array.isArray(r.fieldsSnapshot)
      ? r.fieldsSnapshot
      : DEFAULT_DAILY_FIELDS.map(f => ({ id: f.id, label: f.label, type: f.type, value: r[f.id] }));
    const achievements = [], blockers = [];
    let gmv = 0, contentCount = 0, lastPlan = '';
    daily.forEach(r => {
      const fs = fieldsOf(r).filter(f => f.value !== undefined && f.value !== null && f.value !== '');
      const texts = fs.filter(f => (f.type === 'textarea' || f.type === 'text'));
      const main = texts.filter(f => !/kendala|hambatan|besok|rencana/i.test(f.label || ''));
      if (main.length > 0) achievements.push(`${dayLabel(r.date)}: ${main.map(f => String(f.value).trim()).join(' · ')}`);
      texts.filter(f => /kendala|hambatan/i.test(f.label || '')).forEach(f => blockers.push(`${dayLabel(r.date)}: ${String(f.value).trim()}`));
      const planF = texts.find(f => /besok|rencana/i.test(f.label || ''));
      if (planF) lastPlan = String(planF.value).trim();
      fs.filter(f => f.type === 'number').forEach(f => {
        const v = Number(f.value) || 0;
        if (/gmv/i.test(f.label || '') || f.id === 'gmv') gmv += v;
        else if (/konten/i.test(f.label || '') || f.id === 'contentCount') contentCount += v;
      });
    });
    setPrefill({
      weekStart: week.start, weekEnd: week.end,
      achievements: achievements.join('\n'),
      blockers: blockers.join('\n'),
      plans: lastPlan ? `Lanjutan dari rencana terakhir: ${lastPlan}` : '',
      gmv, contentCount
    });
    setEditing(null); setShowForm(true);
  };

  const handleSave = async (data) => {
    let list = await storage.getList('reports:all');
    if (editing) {
      list = list.map(r => r.id === editing.id ? { ...r, ...data } : r);
    } else {
      list.unshift({
        id: uid(), ...data,
        authorId: user.id, authorName: user.name, authorRole: user.role,
        submittedAt: new Date().toISOString()
      });
      await logActivity(`mengirim laporan mingguan`, user.name);
    }
    await storage.set('reports:all', list);
    setShowForm(false); setEditing(null); load();
  };
  const handleDelete = async (r) => {
    if (!confirm('Hapus laporan ini?')) return;
    const list = (await storage.getList('reports:all')).filter(x => x.id !== r.id);
    await storage.set('reports:all', list);
    load();
  };

  // Visibility: Manajer all, Leader = self + own operasional reports, Operasional = self
  const visibleReports = reports.filter(r => {
    if ((user.role === 'manajer' || user.role === 'owner')) return true;
    if (r.authorId === user.id) return true;
    if (user.role === 'leader') {
      const author = allUsers.find(u => u.id === r.authorId);
      return author && author.leaderId === user.id;
    }
    return false;
  });
  const weeks = useMemo(() => [...new Set(visibleReports.map(r => r.weekStart))].sort().reverse(), [visibleReports]);
  const filtered = filterWeek === 'all' ? visibleReports : visibleReports.filter(r => r.weekStart === filterWeek);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Laporan Mingguan" subtitle="Pencapaian, kendala, dan rencana minggu depan"
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={generateFromDaily} disabled={genBusy}
              title="Rangkum otomatis dari laporan harianmu minggu ini — tinggal review & kirim"
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> {genBusy ? 'Merangkum…' : 'Buat dari Laporan Harian'}
            </button>
            <button onClick={() => { setEditing(null); setPrefill(null); setShowForm(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Laporan Baru
            </button>
          </div>
        } />

      {weeks.length > 0 && (
        <div className="mb-4">
          <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
            <option value="all">Semua Minggu</option>
            {weeks.map(w => <option key={w} value={w}>Minggu {fmtDate(w)}</option>)}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} text="Belum ada laporan. Submit laporan pertama Anda." />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-display font-bold text-slate-900">{r.authorName}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${ROLES[r.authorRole]?.color || ''}`}>{ROLES[r.authorRole]?.label}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Minggu {fmtDate(r.weekStart)} – {fmtDate(r.weekEnd)} · {fmtDateTime(r.submittedAt)}
                  </div>
                </div>
                {(r.authorId === user.id || (user.role === 'manajer' || user.role === 'owner')) && (
                  <div className="flex gap-1">
                    {r.authorId === user.id && (
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="text-slate-400 hover:text-blue-600 p-1">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(r)} className="text-slate-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <ReportBlock title="✅ Pencapaian" content={r.achievements} />
                <ReportBlock title="⚠️ Kendala" content={r.blockers} />
                <ReportBlock title="🎯 Rencana Minggu Depan" content={r.plans} />
              </div>
              {(r.gmv > 0 || r.contentCount > 0) && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex gap-6 text-xs text-slate-600">
                  {r.contentCount > 0 && <div><b className="text-slate-900">{r.contentCount}</b> konten</div>}
                  {r.gmv > 0 && <div>GMV: <b className="text-slate-900">{fmtRupiah(r.gmv)}</b></div>}
                </div>
              )}
              {(r.attachments || []).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1"><Paperclip className="w-3 h-3" /> Bukti ({r.attachments.length})</div>
                  <div className="flex gap-2 flex-wrap">
                    {r.attachments.map((img, i) => (
                      <img key={i} src={img} alt={`Bukti ${i + 1}`}
                        onClick={() => setLightbox({ src: img, title: `Bukti laporan ${r.authorName}` })}
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {lightbox && <ImageLightbox src={lightbox.src} title={lightbox.title} onClose={() => setLightbox(null)} />}

      {showForm && <ReportForm report={editing} prefill={prefill} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); setPrefill(null); }} />}
    </div>
  );
}
function ReportBlock({ title, content }) {
  return <div><div className="text-xs font-semibold text-slate-700 mb-1">{title}</div><div className="text-sm text-slate-600 whitespace-pre-wrap">{content || '-'}</div></div>;
}
function ReportForm({ report, prefill, onSave, onClose }) {
  const week = getWeekRange();
  const src = report || prefill;
  const [form, setForm] = useState({
    weekStart: src?.weekStart || week.start,
    weekEnd: src?.weekEnd || week.end,
    achievements: src?.achievements || '',
    blockers: src?.blockers || '',
    plans: src?.plans || '',
    gmv: src?.gmv || 0,
    contentCount: src?.contentCount || 0
  });
  const [attachments, setAttachments] = useState(report?.attachments || []);
  const [attBusy, setAttBusy] = useState(false);
  const attRef = useRef();
  const addAttachments = async (files) => {
    setAttBusy(true);
    try {
      const picked = Array.from(files).slice(0, 3 - attachments.length);
      const next = [];
      for (const f of picked) next.push(await compressImageFile(f, { maxDim: 1100, quality: 0.7 }));
      setAttachments(prev => [...prev, ...next].slice(0, 3));
    } catch (e) { alert(e.message || 'Gagal memproses gambar.'); }
    setAttBusy(false);
  };
  return (
    <Modal title={report ? 'Edit Laporan' : 'Laporan Mingguan'} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minggu Mulai">
            <input type="date" value={form.weekStart} onChange={e => setForm({ ...form, weekStart: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="Minggu Selesai">
            <input type="date" value={form.weekEnd} onChange={e => setForm({ ...form, weekEnd: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
        </div>
        <Field label="✅ Pencapaian Minggu Ini *">
          <textarea value={form.achievements} onChange={e => setForm({ ...form, achievements: e.target.value })}
            rows={3} placeholder="- Onboarding 5 creator baru&#10;- Bikin 12 konten viral&#10;- Live 4 kali, total GMV 8jt"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <Field label="⚠️ Kendala">
          <textarea value={form.blockers} onChange={e => setForm({ ...form, blockers: e.target.value })}
            rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <Field label="🎯 Rencana Minggu Depan">
          <textarea value={form.plans} onChange={e => setForm({ ...form, plans: e.target.value })}
            rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jumlah Konten">
            <input type="number" value={form.contentCount} onChange={e => setForm({ ...form, contentCount: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
          </Field>
          <Field label="GMV Total (Rp)">
            <input type="number" value={form.gmv} onChange={e => setForm({ ...form, gmv: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
          </Field>
        </div>
        <Field label="Bukti Foto / Screenshot (opsional, maks. 3)">
          <div className="flex items-center gap-2 flex-wrap">
            {attachments.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt={`Bukti ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                <button onClick={() => setAttachments(attachments.filter((_, x) => x !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {attachments.length < 3 && (
              <button type="button" onClick={() => attRef.current?.click()} disabled={attBusy}
                className="w-16 h-16 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition disabled:opacity-50">
                <Paperclip className="w-4 h-4" />
                <span className="text-[9px] font-semibold mt-0.5">{attBusy ? '...' : 'Upload'}</span>
              </button>
            )}
            <input ref={attRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { addAttachments(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">💡 Mis. screenshot GMV mingguan supaya laporan tervalidasi.</div>
        </Field>
        <FormActions onCancel={onClose} onSave={() => onSave({ ...form, attachments })} disabled={!form.achievements.trim()} />
      </div>
    </Modal>
  );
}

// ============ TARGET & GMV TRACKING ============
function gmvDailySeries(entries, division, mKey) {
  const [y, m] = mKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrent = mKey === monthKey();
  const lastDay = isCurrent ? new Date().getDate() : daysInMonth;
  const series = [];
  for (let d = 1; d <= lastDay; d++) {
    const dk = `${mKey}-${String(d).padStart(2, '0')}`;
    const e = entries.find(x => x.date === dk && x.division === division);
    series.push({ day: d, date: dk, value: e ? Number(e.gmv) || 0 : 0 });
  }
  return series;
}

function MiniBarChart({ series, color }) {
  if (!series.length) return null;
  const max = Math.max(...series.map(s => s.value), 1);
  const W = 100, H = 36, gap = 1.5;
  const bw = (W - gap * (series.length - 1)) / series.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-12">
      {series.map((s, i) => {
        const h = s.value > 0 ? Math.max((s.value / max) * (H - 2), 1.5) : 0;
        return (
          <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h}
            rx="0.5" fill={color} opacity={s.value > 0 ? 0.85 : 0.15}>
            <title>{`Tgl ${s.day}: ${fmtRupiah(s.value)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// Sinkron SEMUA tanggal: total GMV akun affiliator → GMV divisi "internal" (anti input dobel).
// Dipanggil saat Dashboard/GMV/Akun Affiliator dimuat & setiap ada perubahan input akun.
async function syncInternalFromAccounts() {
  const accEntries = await loadAffEntries();
  const byDate = {};
  accEntries.forEach(e => { if (e.date) byDate[e.date] = (byDate[e.date] || 0) + (Number(e.gmv) || 0); });
  if (Object.keys(byDate).length === 0) return false;
  const divList = await loadGmvEntries();
  let changed = false;
  for (const [date, total] of Object.entries(byDate)) {
    const ex = divList.find(x => x.division === 'internal' && x.date === date);
    if (ex) {
      if ((Number(ex.gmv) || 0) !== total) {
        const upd = { ...ex, gmv: total, autoSynced: true, inputByName: 'auto (akun affiliator)', updatedAt: new Date().toISOString() };
        await storage.set(GMV_REC_PREFIX + upd.id, upd); changed = true;
      }
    } else {
      const rec = { id: uid(), division: 'internal', date, gmv: total, autoSynced: true, inputByName: 'auto (akun affiliator)', createdAt: new Date().toISOString() };
      await storage.set(GMV_REC_PREFIX + rec.id, rec); changed = true;
    }
  }
  return changed;
}

// Kurva interaktif: arahkan kursor / sentuh untuk lihat nilai per tanggal.
// Bisa 1 garis (props series+color) atau multi-garis (props lines=[{label,color,series}]).
function InteractiveLineChart({ series, color = '#2563EB', lines, height = 150, targetDaily = 0 }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const gradId = useMemo(() => 'ilc-' + Math.random().toString(36).slice(2, 8), []);
  const data = (lines && lines.length > 0) ? lines : [{ label: '', color, series: series || [] }];
  const n = Math.max(...data.map(l => l.series.length), 0);
  if (n === 0) return null;
  const single = data.length === 1;
  const CW = 600, CH = 160, PADL = 8, PADR = 8, PADT = 16, PADB = 20;
  const max = Math.max(...data.flatMap(l => l.series.map(s => s.value)), targetDaily || 0, 1);
  const xAt = (i) => PADL + (n <= 1 ? 0 : (i / (n - 1)) * (CW - PADL - PADR));
  const yAt = (v) => CH - PADB - (v / max) * (CH - PADT - PADB);
  const ptsOf = (ser) => ser.map((s, i) => `${xAt(i).toFixed(1)},${yAt(s.value).toFixed(1)}`).join(' ');
  const baseSeries = data[0].series;
  const area = single ? `${ptsOf(baseSeries)} ${xAt(n - 1).toFixed(1)},${CH - PADB} ${xAt(0).toFixed(1)},${CH - PADB}` : '';
  const labelEvery = Math.ceil(n / 10);
  const todayStr = dayKey();

  const onMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const fx = (clientX - rect.left) / rect.width * CW;
    let idx = Math.round((fx - PADL) / ((CW - PADL - PADR) / Math.max(n - 1, 1)));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };
  const hBase = hover != null ? baseSeries[Math.min(hover, baseSeries.length - 1)] : null;

  return (
    <div ref={wrapRef} className="relative select-none" style={{ touchAction: 'pan-y' }}
      onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      onTouchStart={onMove} onTouchMove={onMove} onTouchEnd={() => setHover(null)}>
      <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={data[0].color} stopOpacity="0.22" />
            <stop offset="1" stopColor={data[0].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f, i) => {
          const y = PADT + f * (CH - PADT - PADB);
          return <line key={i} x1={PADL} y1={y} x2={CW - PADR} y2={y} stroke="#EEF0F4" strokeWidth="1" />;
        })}
        {targetDaily > 0 && (
          <line x1={PADL} y1={yAt(targetDaily)} x2={CW - PADR} y2={yAt(targetDaily)} stroke="#F59E0B" strokeWidth="1.4" strokeDasharray="5 4" />
        )}
        {single && <polygon points={area} fill={`url(#${gradId})`} />}
        {data.map((l, li) => (
          <polyline key={li} points={ptsOf(l.series)} fill="none" stroke={l.color} strokeWidth={single ? 2.6 : 2.3} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {hover != null && (
          <>
            <line x1={xAt(hover)} y1={PADT} x2={xAt(hover)} y2={CH - PADB} stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            {data.map((l, li) => l.series[hover] ? (
              <circle key={li} cx={xAt(hover)} cy={yAt(l.series[hover].value)} r="4.5" fill={l.color} stroke="#fff" strokeWidth="2" />
            ) : null)}
          </>
        )}
        {baseSeries.map((s, i) => (
          (i % labelEvery === 0) ? (
            <text key={i} x={xAt(i)} y={CH - 6} fontSize="9" textAnchor="middle"
              fill={s.date === todayStr ? '#2563EB' : '#94A3B8'} fontWeight={s.date === todayStr ? '800' : '500'}>
              {s.day || Number((s.date || '').slice(8, 10)) || i + 1}
            </text>
          ) : null
        ))}
      </svg>
      {hover != null && hBase && (
        <div className="absolute pointer-events-none px-2.5 py-1.5 rounded-lg text-white text-[11px] font-semibold whitespace-nowrap shadow-lg space-y-0.5"
          style={{
            left: `${(xAt(hover) / CW) * 100}%`, top: 0,
            transform: `translateX(${hover > n * 0.7 ? '-100%' : hover < n * 0.3 ? '0' : '-50%'})`,
            backgroundColor: '#0B1437'
          }}>
          <div className="font-bold">{hBase.date ? fmtDate(hBase.date) : `Hari ${hBase.day}`}</div>
          {data.map((l, li) => l.series[hover] ? (
            <div key={li} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: l.color }}></span>
              {l.label ? `${l.label}: ` : ''}{fmtRupiah(l.series[hover].value)}
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

function GmvView({ user, allUsers }) {
  const [entries, setEntries] = useState([]);
  const [targets, setTargets] = useState({});
  const [loading, setLoading] = useState(true);
  const [mKey, setMKey] = useState(monthKey());
  const [showInput, setShowInput] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    await syncInternalFromAccounts();
    setEntries(await loadGmvEntries());
    setTargets((await storage.get('gmv:targets')) || {});
    setLoading(false);
  };
  useEffect(() => { load(); const iv = setInterval(load, 12000); return () => clearInterval(iv); }, []);

  const isOwnerMgr = user.role === 'owner' || user.role === 'manajer';
  const monthTargets = targets[mKey] || {};
  // Scoping per divisi: MCN lihat MCN saja, TAP ya TAP, Affiliator ya Affiliator. Owner/Manajer/Manajemen/Keuangan lihat semua.
  const myDiv = (isOwnerMgr || (user.division || '') === 'manajemen' || (user.division || '') === 'keuangan')
    ? null
    : (GMV_DIVISIONS[user.division] ? user.division : null);
  const visibleDivs = Object.entries(GMV_DIVISIONS).filter(([div]) => !myDiv || div === myDiv);

  // Total bulan ini per divisi
  const monthTotals = useMemo(() => {
    const t = { mcn: 0, tap: 0, internal: 0 };
    entries.forEach(e => { if (e.date && e.date.startsWith(mKey) && t[e.division] !== undefined) t[e.division] += Number(e.gmv) || 0; });
    return t;
  }, [entries, mKey]);

  // Perubahan harian (hari ini vs kemarin) per divisi — traffic naik/turun
  const dailyChange = useMemo(() => {
    const res = {};
    Object.keys(GMV_DIVISIONS).forEach(div => {
      const series = gmvDailySeries(entries, div, monthKey()).filter(s => s.value > 0);
      const today = series[series.length - 1]?.value || 0;
      const prev = series[series.length - 2]?.value || 0;
      const diff = today - prev;
      const pct = prev > 0 ? Math.round((diff / prev) * 100) : (today > 0 ? 100 : 0);
      res[div] = { today, prev, diff, pct };
    });
    return res;
  }, [entries]);

  const monthLabel = (() => {
    const [y, m] = mKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  })();
  const shiftMonth = (delta) => {
    const [y, m] = mKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMKey(monthKey(d));
  };

  const saveEntry = async (data) => {
    try {
      const list = await loadGmvEntries(); // baca utk cek duplikat tanggal+divisi (throw → batal simpan, lindungi data)
      let rec;
      if (editing) {
        rec = { ...editing, ...data, updatedAt: new Date().toISOString() };
      } else {
        const existing = list.find(e => e.date === data.date && e.division === data.division);
        rec = existing
          ? { ...existing, ...data, inputById: user.id, inputByName: user.name, updatedAt: new Date().toISOString() }
          : { id: uid(), ...data, inputById: user.id, inputByName: user.name, createdAt: new Date().toISOString() };
      }
      const ok = await storage.set(GMV_REC_PREFIX + rec.id, rec);
      if (!ok) throw new Error('Gagal menyimpan ke server.');
      await logActivity(`update GMV ${GMV_DIVISIONS[data.division].label} ${data.date}: ${fmtRupiah(data.gmv)}`, user.name);
      setShowInput(false); setEditing(null); load();
    } catch (err) {
      alert('⚠️ Gagal menyimpan GMV: ' + (err?.message || err) + '\n\nData lama tidak diubah. Coba lagi saat koneksi stabil.');
    }
  };
  const deleteEntry = async (e) => {
    if (!confirm(`Hapus data GMV ${GMV_DIVISIONS[e.division]?.label} tanggal ${e.date}?`)) return;
    try {
      const ok = await storage.delete(GMV_REC_PREFIX + e.id);
      if (!ok) throw new Error('Gagal menghapus di server.');
      load();
    } catch (err) {
      alert('⚠️ Gagal menghapus: ' + (err?.message || err) + '\n\nCoba lagi saat koneksi stabil.');
    }
  };
  const saveTargets = async (vals) => {
    const all = (await storage.get('gmv:targets')) || {};
    all[mKey] = vals;
    await storage.set('gmv:targets', all);
    await logActivity(`set target GMV ${monthLabel}`, user.name);
    setShowTarget(false); load();
  };

  // Entri bulan ini (untuk tabel), terbaru dulu
  const monthEntries = entries.filter(e => e.date && e.date.startsWith(mKey) && (!myDiv || e.division === myDiv))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const canInputAny = isOwnerMgr || Object.keys(GMV_DIVISIONS).some(d => canInputGmv(user, d));

  if (loading) return <div className="text-slate-400 text-sm">Memuat data GMV...</div>;

  return (
    <div className="max-w-6xl">
      <PageHeader title="Target & GMV" subtitle="Target wajib bisnis — di-update harian oleh tiap divisi"
        action={
          <div className="flex gap-2 flex-wrap">
            {isOwnerMgr && (
              <button onClick={() => setShowTarget(true)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
                <Target className="w-4 h-4" /> Set Target
              </button>
            )}
            {canInputAny && (
              <button onClick={() => { setEditing(null); setShowInput(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Update GMV Hari Ini
              </button>
            )}
          </div>
        } />

      {/* Month navigator */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <div className="font-display font-bold text-slate-900 text-lg min-w-[160px] text-center">{monthLabel}</div>
        <button onClick={() => shiftMonth(1)} disabled={mKey >= monthKey()}
          className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></button>
        {mKey !== monthKey() && <button onClick={() => setMKey(monthKey())} className="text-xs text-blue-600 font-semibold hover:underline ml-1">Bulan ini</button>}
      </div>

      {/* Hero cards per divisi (staff: hanya divisinya) */}
      <div className={`grid grid-cols-1 ${visibleDivs.length > 1 ? 'md:grid-cols-3' : 'max-w-md'} gap-4 mb-6`}>
        {visibleDivs.map(([div, cfg]) => {
          const total = monthTotals[div];
          const target = Number(monthTargets[div]) || 0;
          const pct = target > 0 ? Math.min(Math.round((total / target) * 100), 999) : 0;
          const ch = dailyChange[div];
          const isCurrentMonth = mKey === monthKey();
          return (
            <div key={div} className="rounded-2xl p-5 text-white shadow-lg lift-on-hover"
              style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}dd)` }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-90">GMV {cfg.label}</span>
                <BarChart3 className="w-4 h-4 opacity-80" />
              </div>
              <div className="font-display font-bold text-2xl mt-2 leading-tight">{fmtRupiah(total)}</div>
              {target > 0 ? (
                <>
                  <div className="text-[11px] opacity-90 mt-1">Target: {fmtRupiah(target)} · {pct}%</div>
                  <div className="h-1.5 bg-white/30 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </>
              ) : (
                <div className="text-[11px] opacity-80 mt-1">Target belum diset</div>
              )}
              {isCurrentMonth && ch && (ch.today > 0 || ch.prev > 0) && (
                <div className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold bg-white/20 rounded-full px-2 py-0.5">
                  {ch.diff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {ch.diff >= 0 ? '+' : ''}{ch.pct}% vs kemarin
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total gabungan (disembunyikan saat tampilan terkunci per divisi) */}
      {!myDiv && (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Total GMV Gabungan · {monthLabel}</div>
          <div className="font-display font-bold text-2xl text-blue-700 mt-0.5">{fmtRupiah(monthTotals.mcn + monthTotals.tap + monthTotals.internal)}</div>
        </div>
        <Award className="w-10 h-10 text-amber-400" />
      </div>
      )}

      {/* Traffic per divisi */}
      <h3 className="font-display font-bold text-slate-900 mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-600" /> Traffic Harian per Divisi</h3>
      <div className={`grid grid-cols-1 ${visibleDivs.length > 1 ? 'md:grid-cols-3' : ''} gap-4 mb-6`}>
        {visibleDivs.map(([div, cfg]) => {
          const series = gmvDailySeries(entries, div, mKey);
          const ch = dailyChange[div];
          const isCurrentMonth = mKey === monthKey();
          const filled = series.filter(s => s.value > 0).length;
          const divTarget = Number(monthTargets[div]) || 0;
          const dailyTgt = divTarget > 0 ? Math.round(divTarget / daysInMonth(mKey)) : 0;
          return (
            <div key={div} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-800">{cfg.label}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
              </div>
              <InteractiveLineChart series={series} color={cfg.color} height={130} targetDaily={dailyTgt} />
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-slate-500">{filled} hari terisi</span>
                {isCurrentMonth && ch && (ch.today > 0 || ch.prev > 0) ? (
                  <span className={`font-bold inline-flex items-center gap-0.5 ${ch.diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {ch.diff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {ch.diff >= 0 ? '+' : ''}{ch.pct}%
                  </span>
                ) : <span className="text-slate-300">—</span>}
              </div>
              {isCurrentMonth && ch && ch.today > 0 && (
                <div className="text-[11px] text-slate-400 mt-1">Hari ini: {fmtRupiah(ch.today)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabel entri */}
      <h3 className="font-display font-bold text-slate-900 mb-3">Riwayat Input · {monthLabel}</h3>
      {monthEntries.length === 0 ? (
        <EmptyState icon={BarChart3} text="Belum ada data GMV bulan ini. Klik 'Update GMV Hari Ini' untuk mulai." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {monthEntries.map(e => (
              <div key={e.id} className="p-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${DIVISIONS[e.division]?.color || 'bg-slate-100'}`}>{GMV_DIVISIONS[e.division]?.label || e.division}</span>
                  <span className="text-xs text-slate-500">{new Date(e.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="font-bold text-slate-900 mt-1">{fmtRupiah(e.gmv)}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-slate-400">{e.inputByName}{e.orders ? ` · ${fmtNumber(e.orders)} order` : ''}</span>
                  {(isOwnerMgr || e.inputById === user.id) && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(e); setShowInput(true); }} className="text-slate-400 hover:text-blue-600 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteEntry(e)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <table className="w-full hidden md:table">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3 font-semibold">Tanggal</th>
                <th className="text-left p-3 font-semibold">Divisi</th>
                <th className="text-right p-3 font-semibold">GMV</th>
                <th className="text-right p-3 font-semibold">Order</th>
                <th className="text-left p-3 font-semibold">Input oleh</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthEntries.map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="p-3 text-sm text-slate-700">{new Date(e.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className="p-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${DIVISIONS[e.division]?.color || 'bg-slate-100'}`}>{GMV_DIVISIONS[e.division]?.label || e.division}</span></td>
                  <td className="p-3 text-sm text-right font-bold tabular-nums text-slate-800">{fmtRupiah(e.gmv)}</td>
                  <td className="p-3 text-sm text-right tabular-nums text-slate-500">{e.orders ? fmtNumber(e.orders) : '-'}</td>
                  <td className="p-3 text-sm text-slate-500">{e.inputByName}</td>
                  <td className="p-3 text-right">
                    {(isOwnerMgr || e.inputById === user.id) && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditing(e); setShowInput(true); }} className="text-slate-400 hover:text-blue-600 p-1"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteEntry(e)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInput && <GmvInputModal user={user} editing={editing} onSave={saveEntry} onClose={() => { setShowInput(false); setEditing(null); }} />}
      {showTarget && <GmvTargetModal monthLabel={monthLabel} current={monthTargets} onSave={saveTargets} onClose={() => setShowTarget(false)} />}
    </div>
  );
}

function GmvInputModal({ user, editing, onSave, onClose }) {
  const allowedDivs = Object.keys(GMV_DIVISIONS).filter(d => canInputGmv(user, d));
  const [form, setForm] = useState({
    division: editing?.division || allowedDivs[0] || 'mcn',
    date: editing?.date || dayKey(),
    gmv: editing?.gmv || '',
    orders: editing?.orders || '',
    note: editing?.note || ''
  });
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    if (!form.division) return setError('Pilih divisi.');
    if (!form.date) return setError('Pilih tanggal.');
    const gmv = Number(String(form.gmv).replace(/[^\d]/g, ''));
    if (!gmv || gmv <= 0) return setError('GMV harus diisi (angka).');
    onSave({ division: form.division, date: form.date, gmv, orders: Number(String(form.orders).replace(/[^\d]/g, '')) || 0, note: form.note.trim() });
  };

  return (
    <Modal title={editing ? 'Edit Data GMV' : 'Update GMV Harian'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Divisi *">
          <select value={form.division} onChange={e => setForm({ ...form, division: e.target.value })}
            disabled={allowedDivs.length <= 1 && !editing}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100">
            {(editing ? Object.keys(GMV_DIVISIONS) : allowedDivs).map(d => <option key={d} value={d}>{GMV_DIVISIONS[d].label}</option>)}
          </select>
          {allowedDivs.length <= 1 && !editing && <div className="text-[11px] text-slate-500 mt-1">Anda hanya bisa input GMV divisi {GMV_DIVISIONS[allowedDivs[0]]?.label}.</div>}
        </Field>
        <Field label="Tanggal *">
          <input type="date" value={form.date} max={dayKey()} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="GMV (Rp) *">
          <input type="text" inputMode="numeric" value={form.gmv}
            onChange={e => setForm({ ...form, gmv: e.target.value.replace(/[^\d]/g, '') })}
            placeholder="mis. 15000000"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {form.gmv && <div className="text-xs text-emerald-600 mt-1 font-semibold">{fmtRupiah(Number(form.gmv))}</div>}
        </Field>
        <Field label="Jumlah Order (opsional)">
          <input type="text" inputMode="numeric" value={form.orders}
            onChange={e => setForm({ ...form, orders: e.target.value.replace(/[^\d]/g, '') })}
            placeholder="mis. 120"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Catatan (opsional)">
          <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="mis. live bareng creator X"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">💡 Kalau tanggal & divisi sudah pernah diinput, data lama akan otomatis diperbarui (tidak dobel).</div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel={editing ? 'Update' : 'Simpan'} />
      </div>
    </Modal>
  );
}

function GmvTargetModal({ monthLabel, current, onSave, onClose }) {
  const [vals, setVals] = useState({
    mcn: current.mcn || '', tap: current.tap || '', internal: current.internal || ''
  });
  return (
    <Modal title={`Set Target GMV · ${monthLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="text-sm text-slate-500">Target bulanan per divisi. Progress otomatis dihitung dari input GMV harian.</div>
        {Object.entries(GMV_DIVISIONS).map(([div, cfg]) => (
          <Field key={div} label={`Target ${cfg.label} (Rp)`}>
            <input type="text" inputMode="numeric" value={vals[div]}
              onChange={e => setVals({ ...vals, [div]: e.target.value.replace(/[^\d]/g, '') })}
              placeholder="mis. 500000000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {vals[div] && <div className="text-xs text-emerald-600 mt-1 font-semibold">{fmtRupiah(Number(vals[div]))}</div>}
          </Field>
        ))}
        <FormActions onCancel={onClose} onSave={() => onSave({
          mcn: Number(vals.mcn) || 0, tap: Number(vals.tap) || 0, internal: Number(vals.internal) || 0
        })} saveLabel="Simpan Target" />
      </div>
    </Modal>
  );
}

// ============ AKUN AFFILIATOR (target per akun) ============
function acctDailySeries(entries, accountId, mKey) {
  const dim = daysInMonth(mKey);
  const isCurrent = mKey === monthKey();
  const lastDay = isCurrent ? new Date().getDate() : dim;
  const series = [];
  for (let d = 1; d <= lastDay; d++) {
    const dk = `${mKey}-${String(d).padStart(2, '0')}`;
    const e = entries.find(x => x.accountId === accountId && x.date === dk);
    series.push({ day: d, date: dk, value: e ? Number(e.gmv) || 0 : 0 });
  }
  return series;
}

// Grafik garis GMV harian per akun (gaya Dashboard Bisnis) — bisa diatur Pekanan / Bulanan
function AccountTrendChart({ entries, accountId, mKey, dailyTarget }) {
  const [mode, setMode] = useState('month'); // 'week' | 'month'
  const today = new Date();
  const todayStr = dayKey();

  const days = [];
  if (mode === 'week') {
    const dw = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - dw + (dw === 0 ? -6 : 1));
    for (let i = 0; i < 7; i++) { const x = new Date(mon); x.setDate(mon.getDate() + i); days.push(dayKey(x)); }
  } else {
    const dim = daysInMonth(mKey);
    for (let i = 1; i <= dim; i++) days.push(`${mKey}-${String(i).padStart(2, '0')}`);
  }
  const series = days.map(dk => ({
    date: dk,
    value: entries.filter(e => e.accountId === accountId && e.date === dk).reduce((s, e) => s + (Number(e.gmv) || 0), 0)
  }));
  const total = series.reduce((s, x) => s + x.value, 0);
  const filled = series.filter(s => s.value > 0).length;

  return (
    <div className="border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="text-[11px] text-slate-500">
          Total {mode === 'week' ? 'pekan ini' : 'bulan ini'}: <b className="text-slate-800">{fmtRupiah(total)}</b>
          {filled > 0 && <span> · rata-rata {fmtRupiah(Math.round(total / filled))}/hari aktif</span>}
        </div>
        <div className="bg-slate-100 p-0.5 inline-flex rounded-lg">
          {[['week', 'Pekanan'], ['month', 'Bulanan']].map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              style={mode === k ? { backgroundColor: '#2563EB', color: '#fff' } : {}}
              className="px-3 py-1 rounded-md text-[11px] font-bold text-slate-600 transition">
              {label}
            </button>
          ))}
        </div>
      </div>
      <InteractiveLineChart series={series} color="#3B82F6" height={180} targetDaily={dailyTarget || 0} />
      <div className="text-[10px] text-slate-400 mt-1">Garis putus-putus = target harian. Arahkan kursor / sentuh grafik untuk lihat nominal per tanggal.</div>
    </div>
  );
}

function AffiliateAccountsView({ user, allUsers }) {
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [goal, setGoal] = useState(DEFAULT_AFFILIATE_GOAL);
  const [loading, setLoading] = useState(true);
  const [mKey, setMKey] = useState(monthKey());
  const [showAcct, setShowAcct] = useState(false);
  const [editingAcct, setEditingAcct] = useState(null);
  const [inputAcct, setInputAcct] = useState(null);
  const [editEntry, setEditEntry] = useState(null);   // entry harian yang diedit
  const [targetAcct, setTargetAcct] = useState(null);
  const [showGoal, setShowGoal] = useState(false);
  const [detailAcct, setDetailAcct] = useState(null); // akun yang rincian hariannya dibuka
  const [lightbox, setLightbox] = useState(null);     // lihat bukti GMV besar

  const load = async () => {
    await syncInternalFromAccounts(); // pastikan dashboard & divisi internal selalu sama dengan total akun
    setAccounts(await storage.getList('affiliate-accounts:all'));
    setEntries(await loadAffEntries());
    const g = await storage.get('affiliate:goal');
    setGoal(g && g[mKey] ? g[mKey] : DEFAULT_AFFILIATE_GOAL);
    setLoading(false);
  };
  useEffect(() => { load(); const iv = setInterval(load, 12000); return () => clearInterval(iv); }, [mKey]);

  const isOwnerMgr = user.role === 'owner' || user.role === 'manajer';
  const canManage = isOwnerMgr || user.role === 'leader'; // Siti = leader
  const canInput = (acct) => isOwnerMgr || user.role === 'leader' || acct.picId === user.id || (user.division || '') === 'internal';

  const dim = daysInMonth(mKey);
  const today = dayKey();
  const isCurrentMonth = mKey === monthKey();

  // Total per akun bulan ini
  const acctTotal = (accId) => entries.filter(e => e.accountId === accId && (e.date || '').startsWith(mKey)).reduce((s, e) => s + (Number(e.gmv) || 0), 0);
  const acctToday = (accId) => entries.filter(e => e.accountId === accId && e.date === today).reduce((s, e) => s + (Number(e.gmv) || 0), 0);

  const totalTarget = accounts.reduce((s, a) => s + (Number(a.targets?.[mKey]) || 0), 0);
  const totalActual = accounts.reduce((s, a) => s + acctTotal(a.id), 0);

  const monthLabel = (() => { const [y, m] = mKey.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); })();
  const shiftMonth = (delta) => { const [y, m] = mKey.split('-').map(Number); setMKey(monthKey(new Date(y, m - 1 + delta, 1))); };

  const saveAcct = async (data) => {
    let list = await storage.getList('affiliate-accounts:all');
    if (editingAcct) {
      list = list.map(a => a.id === editingAcct.id ? { ...a, ...data } : a);
    } else {
      list.push({ id: uid(), ...data, targets: {}, createdAt: new Date().toISOString() });
      await logActivity(`menambah akun affiliator "${data.name}"`, user.name);
    }
    await storage.set('affiliate-accounts:all', list);
    setShowAcct(false); setEditingAcct(null); load();
  };
  const deleteAcct = async (a) => {
    if (!confirm(`Hapus akun "${a.name}"? Data GMV-nya juga akan hilang.`)) return;
    await storage.set('affiliate-accounts:all', (await storage.getList('affiliate-accounts:all')).filter(x => x.id !== a.id));
    const affEntries = await loadAffEntries();
    for (const en of affEntries.filter(x => x.accountId === a.id)) await storage.delete(AFF_REC_PREFIX + en.id);
    load();
  };
  const saveTarget = async (accId, value) => {
    const list = (await storage.getList('affiliate-accounts:all')).map(a =>
      a.id === accId ? { ...a, targets: { ...(a.targets || {}), [mKey]: value } } : a);
    await storage.set('affiliate-accounts:all', list);
    await logActivity(`set target akun ${monthLabel}`, user.name);
    setTargetAcct(null); load();
  };
  const saveEntry = async (data) => {
    try {
      const list = await loadAffEntries(); // baca utk cek duplikat akun+tanggal (throw → batal simpan, lindungi data)
      const existing = list.find(e => e.accountId === data.accountId && e.date === data.date);
      const rec = existing
        ? { ...existing, ...data, inputById: user.id, inputByName: user.name, updatedAt: new Date().toISOString() }
        : { id: uid(), ...data, inputById: user.id, inputByName: user.name, createdAt: new Date().toISOString() };
      const ok = await storage.set(AFF_REC_PREFIX + rec.id, rec);
      if (!ok) throw new Error('Gagal menyimpan ke server.');
      await syncInternalFromAccounts(); // dashboard & Target GMV divisi internal ikut ter-update otomatis
      await logActivity(`update GMV akun ${data.accountName} ${data.date}: ${fmtRupiah(data.gmv)}`, user.name);
      setInputAcct(null); load();
    } catch (err) {
      alert('⚠️ Gagal menyimpan GMV: ' + (err?.message || err) + '\n\nData LAMA tidak diubah. Coba lagi saat koneksi stabil.');
    }
  };

  const deleteEntry = async (e) => {
    if (!confirm(`Hapus GMV ${e.accountName || ''} tanggal ${fmtDate(e.date)} (${fmtRupiah(e.gmv)})?`)) return;
    try {
      const ok = await storage.delete(AFF_REC_PREFIX + e.id);
      if (!ok) throw new Error('Gagal menghapus di server.');
      await syncInternalFromAccounts();
      load();
    } catch (err) {
      alert('⚠️ Gagal menghapus: ' + (err?.message || err) + '\n\nCoba lagi saat koneksi stabil.');
    }
  };
  const saveGoal = async (value) => {
    const g = (await storage.get('affiliate:goal')) || {};
    g[mKey] = value;
    await storage.set('affiliate:goal', g);
    setShowGoal(false); load();
  };

  if (loading) return <div className="text-slate-400 text-sm">Memuat akun affiliator...</div>;

  const goalPct = goal > 0 ? Math.round((totalActual / goal) * 100) : 0;
  const targetCoverage = goal > 0 ? Math.round((totalTarget / goal) * 100) : 0;

  return (
    <div className="max-w-6xl">
      <PageHeader title="Akun Affiliator Internal" subtitle="Target 1 M dipecah per akun → per hari. Update tiap hari, langsung kelihatan capai/tidak."
        action={
          <div className="flex gap-2 flex-wrap">
            {canManage && <button onClick={() => setShowGoal(true)} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"><Target className="w-4 h-4" /> Goal Bulanan</button>}
            {canManage && <button onClick={() => { setEditingAcct(null); setShowAcct(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Tambah Akun</button>}
          </div>
        } />

      {/* Month nav */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <div className="font-display font-bold text-slate-900 text-lg min-w-[150px] text-center">{monthLabel}</div>
        <button onClick={() => shiftMonth(1)} disabled={mKey >= monthKey()} className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></button>
        {mKey !== monthKey() && <button onClick={() => setMKey(monthKey())} className="text-xs text-blue-600 font-semibold hover:underline ml-1">Bulan ini</button>}
      </div>

      {/* Goal summary */}
      <div className="rounded-2xl p-5 text-white shadow-lg mb-6" style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-90">Goal Affiliator Internal · {monthLabel}</div>
            <div className="font-display font-bold text-3xl mt-1">{fmtRupiah(totalActual)}</div>
            <div className="text-sm opacity-90 mt-0.5">dari goal {fmtRupiah(goal)} · <b>{goalPct}%</b></div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-90">Total target {accounts.length} akun</div>
            <div className="font-display font-bold text-xl">{fmtRupiah(totalTarget)}</div>
            <div className={`text-[11px] mt-0.5 ${targetCoverage >= 100 ? 'opacity-90' : 'text-amber-200'}`}>
              {targetCoverage >= 100 ? '✓ Breakdown menutupi goal' : `⚠ Breakdown baru ${targetCoverage}% dari goal`}
            </div>
          </div>
        </div>
        <div className="h-2 bg-white/30 rounded-full mt-3 overflow-hidden"><div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(goalPct, 100)}%` }} /></div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState icon={Target} text={canManage ? 'Belum ada akun. Klik "Tambah Akun" untuk mulai breakdown target (mis. alkahfihome).' : 'Belum ada akun affiliator.'} />
      ) : (
        <div className="space-y-3">
          {accounts.map(a => {
            const target = Number(a.targets?.[mKey]) || 0;
            const actual = acctTotal(a.id);
            const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
            const dailyTarget = target > 0 ? Math.round(target / dim) : 0;
            const todayVal = acctToday(a.id);
            const hitToday = dailyTarget > 0 && todayVal >= dailyTarget;
            const pic = allUsers.find(u => u.id === a.picId);
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-slate-900 text-lg">{a.name}</span>
                      {!a.active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">Nonaktif</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">PIC: {pic?.name || '—'}</div>
                  </div>
                  <div className="flex gap-1">
                    {canInput(a) && <button onClick={() => { setEditEntry(null); setInputAcct(a); }} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Input GMV</button>}
                    {canManage && <button onClick={() => setTargetAcct(a)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">Set Target</button>}
                    {canManage && <button onClick={() => { setEditingAcct(a); setShowAcct(true); }} className="text-slate-400 hover:text-blue-600 p-1.5"><Edit2 className="w-4 h-4" /></button>}
                    {isOwnerMgr && <button onClick={() => deleteAcct(a)} className="text-slate-400 hover:text-red-600 p-1.5"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Target Bulan</div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{target > 0 ? fmtRupiah(target) : '—'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Tercapai</div>
                    <div className="font-bold text-emerald-700 text-sm mt-0.5">{fmtRupiah(actual)}</div>
                    {target > 0 && <div className="text-[10px] text-slate-400">{pct}%</div>}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Target/Hari</div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{dailyTarget > 0 ? fmtRupiah(dailyTarget) : '—'}</div>
                  </div>
                  <div className={`rounded-xl p-2.5 ${isCurrentMonth ? (hitToday ? 'bg-emerald-50' : (dailyTarget > 0 ? 'bg-red-50' : 'bg-slate-50')) : 'bg-slate-50'}`}>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Hari Ini</div>
                    <div className={`font-bold text-sm mt-0.5 ${isCurrentMonth && dailyTarget > 0 ? (hitToday ? 'text-emerald-700' : 'text-red-600') : 'text-slate-900'}`}>{fmtRupiah(todayVal)}</div>
                    {isCurrentMonth && dailyTarget > 0 && <div className={`text-[10px] font-semibold ${hitToday ? 'text-emerald-600' : 'text-red-500'}`}>{hitToday ? '✓ Tercapai' : 'Belum capai'}</div>}
                  </div>
                </div>

                {/* Progress bar bulan */}
                {target > 0 && (
                  <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#10B981' : pct >= 70 ? '#3B82F6' : '#F59E0B' }} />
                  </div>
                )}

                {/* Rincian (grafik + angka) dibuka lewat tombol — tanpa bar chart kecil */}
                <div className="mt-3 flex items-center justify-end">
                  <button onClick={() => setDetailAcct(detailAcct === a.id ? null : a.id)}
                    className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                    {detailAcct === a.id ? 'Tutup rincian' : 'Lihat grafik & rincian angka'} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detailAcct === a.id ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Rincian: grafik harian (pekanan/bulanan) + angka per tanggal */}
                {detailAcct === a.id && (
                  <div className="mt-3">
                    <AccountTrendChart entries={entries} accountId={a.id} mKey={mKey} dailyTarget={dailyTarget} />
                  </div>
                )}
                {detailAcct === a.id && (() => {
                  const acctEntries = entries
                    .filter(e => e.accountId === a.id && (e.date || '').startsWith(mKey))
                    .sort((x, y) => y.date.localeCompare(x.date));
                  return (
                    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                      {acctEntries.length === 0 ? (
                        <div className="text-center text-xs text-slate-400 py-4">Belum ada input GMV bulan ini.</div>
                      ) : (
                        <div className="overflow-x-auto max-h-72 overflow-y-auto scroll-thin">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sticky top-0">
                              <tr>
                                <th className="text-left px-3 py-2 font-bold">Tanggal</th>
                                <th className="text-right px-3 py-2 font-bold">GMV</th>
                                <th className="text-right px-3 py-2 font-bold">Order</th>
                                <th className="text-left px-3 py-2 font-bold hidden sm:table-cell">Diinput</th>
                                <th className="px-2 py-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {acctEntries.map(e => {
                                const hitDay = dailyTarget > 0 && (Number(e.gmv) || 0) >= dailyTarget;
                                return (
                                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-3 py-2 text-slate-700">{fmtDate(e.date)}</td>
                                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${dailyTarget > 0 ? (hitDay ? 'text-emerald-700' : 'text-red-600') : 'text-slate-800'}`}>{fmtRupiah(e.gmv)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{e.orders ? fmtNumber(e.orders) : '–'}</td>
                                    <td className="px-3 py-2 text-xs text-slate-400 hidden sm:table-cell">{e.inputByName || '–'}</td>
                                    <td className="px-2 py-2 text-right whitespace-nowrap">
                                      {(e.proofs || []).length > 0 && (
                                        <button onClick={() => setLightbox({ src: e.proofs[0], title: `Bukti GMV ${a.name} · ${fmtDate(e.date)}`, extra: e.proofs })} title={`Lihat bukti (${e.proofs.length} foto)`}
                                          className="text-emerald-500 hover:text-emerald-700 p-1"><Camera className="w-3.5 h-3.5" /></button>
                                      )}
                                      {canInput(a) && (
                                        <button onClick={() => { setEditEntry(e); setInputAcct(a); }} title="Edit GMV tanggal ini"
                                          className="text-slate-300 hover:text-blue-600 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                                      )}
                                      {canManage && (
                                        <button onClick={() => deleteEntry(e)} title="Hapus"
                                          className="text-slate-300 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-blue-50/60 border-t border-blue-100">
                              <tr>
                                <td className="px-3 py-2 text-xs font-bold text-blue-800">Total {monthLabel}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-bold text-blue-800">{fmtRupiah(actual)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-blue-700 text-xs">{fmtNumber(acctEntries.reduce((s, e) => s + (Number(e.orders) || 0), 0))}</td>
                                <td className="hidden sm:table-cell"></td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {showAcct && <AccountFormModal editing={editingAcct} internalUsers={allUsers.filter(u => (u.division || '') === 'internal' || u.role === 'leader')} onSave={saveAcct} onClose={() => { setShowAcct(false); setEditingAcct(null); }} />}
      {inputAcct && <AccountGmvInputModal account={inputAcct} initial={editEntry} onSave={saveEntry} onClose={() => { setInputAcct(null); setEditEntry(null); }} />}
      {targetAcct && <AccountTargetModal account={targetAcct} monthLabel={monthLabel} current={Number(targetAcct.targets?.[mKey]) || 0} dim={dim} onSave={(v) => saveTarget(targetAcct.id, v)} onClose={() => setTargetAcct(null)} />}
      {showGoal && <GoalModal monthLabel={monthLabel} current={goal} onSave={saveGoal} onClose={() => setShowGoal(false)} />}
      {lightbox && <ImageLightbox src={lightbox.src} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function AccountFormModal({ editing, internalUsers, onSave, onClose }) {
  const [form, setForm] = useState({
    name: editing?.name || '', picId: editing?.picId || '', active: editing?.active !== false
  });
  const [error, setError] = useState('');
  const submit = () => {
    if (!form.name.trim()) return setError('Nama akun wajib diisi.');
    const pic = internalUsers.find(u => u.id === form.picId);
    onSave({ name: form.name.trim(), picId: form.picId, picName: pic?.name || '', active: form.active });
  };
  return (
    <Modal title={editing ? `Edit ${editing.name}` : 'Akun Affiliator Baru'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nama Akun *">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="mis. alkahfihome"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="PIC (penanggung jawab)">
          <SearchableSelect
            value={form.picId}
            onChange={(v) => setForm({ ...form, picId: v })}
            options={[{ value: '', label: '— Belum ditentukan —' }, ...internalUsers.map(u => ({ value: u.id, label: u.name }))]}
            placeholder="Ketik nama PIC..." />
          <div className="text-[11px] text-slate-500 mt-1">PIC bisa update GMV akun ini tiap hari. Owner/Manajer/Leader juga bisa.</div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
          <span>Akun aktif</span>
        </label>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel={editing ? 'Update' : 'Simpan'} />
      </div>
    </Modal>
  );
}

function AccountGmvInputModal({ account, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    date: initial?.date || dayKey(),
    gmv: initial ? String(initial.gmv) : '',
    orders: initial?.orders ? String(initial.orders) : '',
    note: initial?.note || ''
  });
  const [proofs, setProofs] = useState(initial?.proofs || []);
  const [proofBusy, setProofBusy] = useState(false);
  const proofRef = useRef();
  const [error, setError] = useState('');
  const addProofs = async (files) => {
    setProofBusy(true);
    try {
      const picked = Array.from(files).slice(0, 2 - proofs.length);
      const next = [];
      for (const f of picked) next.push(await compressImageFile(f, { maxDim: 1000, quality: 0.68 }));
      setProofs(prev => [...prev, ...next].slice(0, 2));
    } catch (e) { alert(e.message || 'Gagal memproses gambar.'); }
    setProofBusy(false);
  };
  const submit = () => {
    const gmv = Number(String(form.gmv).replace(/[^\d]/g, ''));
    if (!gmv || gmv <= 0) return setError('GMV harus diisi.');
    onSave({ accountId: account.id, accountName: account.name, date: form.date, gmv, orders: Number(String(form.orders).replace(/[^\d]/g, '')) || 0, note: form.note.trim(), proofs });
  };
  return (
    <Modal title={`${initial ? 'Edit' : 'Input'} GMV — ${account.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Tanggal * (bisa pilih tanggal lewat yang belum terisi)">
          <input type="date" value={form.date} max={dayKey()} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="GMV Tanggal Ini (Rp) *">
          <input type="text" inputMode="numeric" value={form.gmv} onChange={e => setForm({ ...form, gmv: e.target.value.replace(/[^\d]/g, '') })}
            placeholder="mis. 25000000"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {form.gmv && <div className="text-xs text-emerald-600 mt-1 font-semibold">{fmtRupiah(Number(form.gmv))}</div>}
        </Field>
        <Field label="Jumlah Order (opsional)">
          <input type="text" inputMode="numeric" value={form.orders} onChange={e => setForm({ ...form, orders: e.target.value.replace(/[^\d]/g, '') })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Bukti GMV (screenshot, maks. 2)">
          <div className="flex items-center gap-2 flex-wrap">
            {proofs.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt={`Bukti ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                <button onClick={() => setProofs(proofs.filter((_, x) => x !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {proofs.length < 2 && (
              <button type="button" onClick={() => proofRef.current?.click()} disabled={proofBusy}
                className="w-16 h-16 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition disabled:opacity-50">
                <Camera className="w-4 h-4" />
                <span className="text-[9px] font-semibold mt-0.5">{proofBusy ? '...' : 'Upload'}</span>
              </button>
            )}
            <input ref={proofRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { addProofs(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">💡 Screenshot dashboard TikTok sebagai bukti — laporan jadi tervalidasi.</div>
        </Field>
        <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">💡 Kalau tanggal ini sudah diisi, data lama otomatis diperbarui. Progres goal bulanan & Dashboard Bisnis ikut ter-update otomatis.</div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel="Simpan" />
      </div>
    </Modal>
  );
}

function AccountTargetModal({ account, monthLabel, current, dim, onSave, onClose }) {
  const [val, setVal] = useState(current || '');
  const num = Number(String(val).replace(/[^\d]/g, '')) || 0;
  return (
    <Modal title={`Target ${account.name} · ${monthLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Target GMV Bulan Ini (Rp)">
          <input type="text" inputMode="numeric" value={val} onChange={e => setVal(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="mis. 800000000"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {num > 0 && <div className="text-xs text-emerald-600 mt-1 font-semibold">{fmtRupiah(num)}</div>}
        </Field>
        {num > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-slate-700">
            Berarti target harian akun ini: <b className="text-blue-700">{fmtRupiah(Math.round(num / dim))}</b> ({dim} hari)
          </div>
        )}
        <FormActions onCancel={onClose} onSave={() => onSave(num)} saveLabel="Simpan Target" />
      </div>
    </Modal>
  );
}

function GoalModal({ monthLabel, current, onSave, onClose }) {
  const [val, setVal] = useState(current || DEFAULT_AFFILIATE_GOAL);
  const num = Number(String(val).replace(/[^\d]/g, '')) || 0;
  return (
    <Modal title={`Goal Affiliator · ${monthLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Goal Total Affiliator Internal Bulan Ini (Rp)">
          <input type="text" inputMode="numeric" value={val} onChange={e => setVal(e.target.value.replace(/[^\d]/g, ''))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {num > 0 && <div className="text-xs text-emerald-600 mt-1 font-semibold">{fmtRupiah(num)}</div>}
        </Field>
        <div className="text-[11px] text-slate-500">Default 1 Miliar. Total target semua akun idealnya menutupi goal ini.</div>
        <FormActions onCancel={onClose} onSave={() => onSave(num)} saveLabel="Simpan Goal" />
      </div>
    </Modal>
  );
}

// ============ KPI TIM ============
function KpiView({ user, allUsers }) {
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [reports, setReports] = useState([]);
  const [gmvEntries, setGmvEntries] = useState([]);
  const [gmvTargets, setGmvTargets] = useState({});
  const [affAccounts, setAffAccounts] = useState([]);
  const [affEntries, setAffEntries] = useState([]);
  const [kpiTemplates, setKpiTemplates] = useState([]);
  const [kpiLeaves, setKpiLeaves] = useState([]);
  const [cfg, setCfg] = useState(DEFAULT_KPI_CONFIG);
  const [loading, setLoading] = useState(true);
  const [mKey, setMKey] = useState(monthKey());
  const [showConfig, setShowConfig] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setTasks(await loadTasks());
    setAttendance(await loadAttendanceRecs());
    setReports(await loadDailyReports());
    setGmvEntries(await loadGmvEntries());
    setGmvTargets((await storage.get('gmv:targets')) || {});
    setAffAccounts(await storage.getList('affiliate-accounts:all'));
    setAffEntries(await loadAffEntries());
    setKpiTemplates(await storage.getList('daily-report-templates:all'));
    setKpiLeaves(await loadLeaves());
    setCfg(normalizeKpiConfig(await storage.get('kpi:config')));
    setLoading(false);
  };
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const isOwnerMgr = user.role === 'owner' || user.role === 'manajer';

  // Siapa yang boleh dilihat
  const visibleUsers = useMemo(() => {
    if (isOwnerMgr) return allUsers;
    if (user.role === 'leader') return allUsers.filter(u => u.leaderId === user.id || u.id === user.id);
    return allUsers.filter(u => u.id === user.id);
  }, [allUsers, user, isOwnerMgr]);

  const kpiData = { tasks, attendance, reports, gmvEntries, gmvTargets, affAccounts, affEntries, allUsers, templates: kpiTemplates, leaves: kpiLeaves };
  const scored = useMemo(() => visibleUsers.map(u => ({
    user: u, kpi: computeKpi(u.id, kpiData, mKey, cfg)
  })).sort((a, b) => b.kpi.total - a.kpi.total), [visibleUsers, tasks, attendance, reports, gmvEntries, gmvTargets, affAccounts, affEntries, allUsers, mKey, cfg]);

  const monthLabel = (() => { const [y, m] = mKey.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); })();
  const shiftMonth = (delta) => { const [y, m] = mKey.split('-').map(Number); setMKey(monthKey(new Date(y, m - 1 + delta, 1))); };
  const target = cfg.targetScore || 85;
  const mumtazCount = scored.filter(s => s.kpi.total >= target).length;

  const saveCfg = async (newCfg) => {
    await storage.set('kpi:config', newCfg);
    await logActivity('mengubah pengaturan KPI', user.name);
    setShowConfig(false); load();
  };

  const scoreColor = (t) => t >= target ? 'text-emerald-600' : t >= target * 0.7 ? 'text-amber-600' : 'text-red-500';
  const ringColor = (t) => t >= target ? '#10B981' : t >= target * 0.7 ? '#F59E0B' : '#EF4444';

  if (loading) return <div className="text-slate-400 text-sm">Memuat KPI...</div>;

  return (
    <div className="max-w-5xl">
      <PageHeader title="KPI Tim" subtitle={`Poin kinerja bulanan · target ${target} = Mumtaz`}
        action={isOwnerMgr ? (
          <button onClick={() => setShowConfig(true)}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" /> Atur KPI
          </button>
        ) : null} />

      {/* Month nav + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
          <div className="font-display font-bold text-slate-900 text-lg min-w-[150px] text-center">{monthLabel}</div>
          <button onClick={() => shiftMonth(1)} disabled={mKey >= monthKey()} className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></button>
        </div>
        <div className="text-sm text-slate-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          <b className="text-emerald-700">{mumtazCount}</b> dari {scored.length} orang <b>Mumtaz</b> (≥{target})
        </div>
      </div>

      {/* How KPI calculated */}
      {(() => { const w = normalizeKpiConfig(cfg).weights; return (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 mb-4 text-xs text-slate-600 leading-relaxed">
          💡 KPI dihitung otomatis dari 5 komponen: <b>Kehadiran</b> ({w.attendance}) · <b>Disiplin Waktu</b> ({w.punctuality}, % absen tepat waktu) · <b>Tugas</b> ({w.tasks}, kualitas 70% + volume 30%) · <b>Laporan Harian</b> ({w.reports}) · <b>Capaian Target GMV</b> ({w.target}, untuk PIC akun / leader divisi GMV — yang tidak pegang target, bobotnya otomatis dialihkan ke Tugas & Laporan supaya adil). Target hari kerja: {cfg.workdays}/bulan.
        </div>
      ); })()}

      <div className="space-y-2">
        {scored.map((s, i) => {
          const k = s.kpi;
          const isMumtaz = k.total >= target;
          const open = expanded === s.user.id;
          return (
            <div key={s.user.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isMumtaz ? 'border-emerald-200' : 'border-slate-200'}`}>
              <button onClick={() => setExpanded(open ? null : s.user.id)} className="w-full p-4 flex items-center gap-4 text-left hover:bg-slate-50/50">
                <div className="text-sm font-bold text-slate-400 w-6 text-center">#{i + 1}</div>
                <Avatar person={s.user} size="md" />
                {/* Ring score */}
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={ringColor(k.total)} strokeWidth="3"
                      strokeDasharray={`${Math.min(k.total, 100) / 100 * 97.4} 97.4`} strokeLinecap="round" />
                  </svg>
                  <div className={`absolute inset-0 flex items-center justify-center font-display font-bold text-lg ${scoreColor(k.total)}`}>{k.total}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{s.user.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {displayJobTitle(s.user) && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{displayJobTitle(s.user)}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded ${ROLES[s.user.role]?.color}`}>{ROLES[s.user.role]?.label}</span>
                    {s.user.division && DIVISIONS[s.user.division] && <span className={`text-[10px] px-2 py-0.5 rounded ${DIVISIONS[s.user.division].color}`}>{DIVISIONS[s.user.division].label}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {isMumtaz
                    ? <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full inline-flex items-center gap-1">⭐ Mumtaz</span>
                    : <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">Perlu ditingkatkan</span>}
                  <ChevronDown className={`w-4 h-4 text-slate-400 inline-block ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <KpiBreakdownItem label="Kehadiran" value={`${k.attendance.days} hadir${k.attendance.izin > 0 ? ` + ${k.attendance.izin} izin` : ''} / ${cfg.workdays} hari`} score={k.attendance.score} max={k.attendance.max} color="#10B981" sub={k.attendance.izin > 0 ? 'izin = kredit 50%' : ''} />
                    <KpiBreakdownItem label="Disiplin Waktu" value={k.punctuality.hasData ? `${k.punctuality.rate}% tepat waktu` : 'belum pernah absen'} score={k.punctuality.score} max={k.punctuality.max} color="#06B6D4" sub={k.punctuality.late > 0 ? `${k.punctuality.late}× telat` : ''} />
                    <KpiBreakdownItem label="Tugas" value={`${k.tasks.done} selesai · ${k.tasks.rate}%`} score={k.tasks.score} max={k.tasks.max} color="#3B82F6" sub={k.tasks.missed > 0 ? `${k.tasks.missed} lewat deadline` : ''} />
                    <KpiBreakdownItem label="Laporan Harian" value={k.reports.required ? `${k.reports.days}/${cfg.workdays} hari` : 'belum ada form dari Leader'} score={k.reports.score} max={k.reports.max} color="#8B5CF6" sub={k.reports.required ? '' : 'tidak dinilai'} />
                    {k.target.applicable ? (
                      <KpiBreakdownItem label="Capaian Target" value={`${k.target.attain}% dari jalur (${k.target.info})`} score={k.target.score} max={k.target.max} color="#F59E0B" />
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-3 flex flex-col justify-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Capaian Target</div>
                        <div className="text-[11px] text-slate-500 mt-1 leading-snug">Tidak pegang target GMV — bobotnya dialihkan ke Tugas & Laporan.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showConfig && <KpiConfigModal cfg={cfg} onSave={saveCfg} onClose={() => setShowConfig(false)} />}
    </div>
  );
}

function KpiBreakdownItem({ label, value, score, max, color, sub }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="font-display font-bold text-lg text-slate-900 mt-0.5">{score}<span className="text-xs text-slate-400 font-sans">/{max}</span></div>
      <div className="h-1 bg-slate-200 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
      <div className="text-[11px] text-slate-500 mt-1">{value}</div>
      {sub && <div className="text-[10px] text-red-500 font-semibold mt-0.5">{sub}</div>}
    </div>
  );
}

function KpiConfigModal({ cfg, onSave, onClose }) {
  const norm = normalizeKpiConfig(cfg);
  const [form, setForm] = useState({
    targetScore: norm.targetScore, workdays: norm.workdays, taskVolumeTarget: norm.taskVolumeTarget,
    weights: { ...norm.weights }
  });
  const [error, setError] = useState('');
  const totalWeight = (Number(form.weights.attendance) || 0) + (Number(form.weights.punctuality) || 0) + (Number(form.weights.tasks) || 0) + (Number(form.weights.reports) || 0) + (Number(form.weights.target) || 0);
  const submit = () => {
    setError('');
    if (totalWeight !== 100) return setError(`Total bobot harus 100 (sekarang ${totalWeight}).`);
    onSave({
      targetScore: Number(form.targetScore) || 85, workdays: Number(form.workdays) || 26,
      taskVolumeTarget: Number(form.taskVolumeTarget) || 20,
      weights: {
        attendance: Number(form.weights.attendance) || 0, punctuality: Number(form.weights.punctuality) || 0,
        tasks: Number(form.weights.tasks) || 0, reports: Number(form.weights.reports) || 0,
        target: Number(form.weights.target) || 0
      }
    });
  };
  const setW = (k, v) => setForm({ ...form, weights: { ...form.weights, [k]: Number(v.replace(/[^\d]/g, '')) || 0 } });
  return (
    <Modal title="Pengaturan KPI" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target Mumtaz"><input type="text" inputMode="numeric" value={form.targetScore} onChange={e => setForm({ ...form, targetScore: e.target.value.replace(/[^\d]/g, '') })} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" /></Field>
          <Field label="Hari Kerja/bln"><input type="text" inputMode="numeric" value={form.workdays} onChange={e => setForm({ ...form, workdays: e.target.value.replace(/[^\d]/g, '') })} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" /></Field>
          <Field label="Target Tugas"><input type="text" inputMode="numeric" value={form.taskVolumeTarget} onChange={e => setForm({ ...form, taskVolumeTarget: e.target.value.replace(/[^\d]/g, '') })} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" /></Field>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Bobot Poin (5 komponen)</label>
            <span className={`text-xs font-bold ${totalWeight === 100 ? 'text-emerald-600' : 'text-red-500'}`}>Total: {totalWeight}/100</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kehadiran"><input type="text" inputMode="numeric" value={form.weights.attendance} onChange={e => setW('attendance', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" /></Field>
            <Field label="Disiplin Waktu"><input type="text" inputMode="numeric" value={form.weights.punctuality} onChange={e => setW('punctuality', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" /></Field>
            <Field label="Tugas"><input type="text" inputMode="numeric" value={form.weights.tasks} onChange={e => setW('tasks', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" /></Field>
            <Field label="Laporan Harian"><input type="text" inputMode="numeric" value={form.weights.reports} onChange={e => setW('reports', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" /></Field>
            <Field label="Capaian Target GMV"><input type="text" inputMode="numeric" value={form.weights.target} onChange={e => setW('target', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" /></Field>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 bg-slate-50 rounded-lg p-2">💡 Anggota yang tidak pegang target GMV (mis. Media, Event): bobot "Capaian Target" otomatis dialihkan ke Tugas & Laporan — semua tetap dinilai dari 100.</div>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel="Simpan Pengaturan" />
      </div>
    </Modal>
  );
}

// ============ MASALAH & SOLUSI (Andon + 5-Why) ============
const URGENCY = {
  kritis: { label: 'Kritis', color: 'bg-red-100 text-red-700', dot: '#EF4444', rank: 4 },
  tinggi: { label: 'Tinggi', color: 'bg-orange-100 text-orange-700', dot: '#F97316', rank: 3 },
  sedang: { label: 'Sedang', color: 'bg-amber-100 text-amber-700', dot: '#F59E0B', rank: 2 },
  rendah: { label: 'Rendah', color: 'bg-slate-100 text-slate-600', dot: '#94A3B8', rank: 1 }
};
const PROBLEM_STATUS = {
  open: { label: 'Terbuka', color: 'bg-red-50 text-red-600' },
  investigating: { label: 'Ditangani', color: 'bg-blue-50 text-blue-600' },
  resolved: { label: 'Selesai', color: 'bg-emerald-50 text-emerald-600' }
};

function ProblemsView({ user, allUsers }) {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [resolving, setResolving] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [filter, setFilter] = useState({ status: 'aktif', urgency: 'all', division: 'all' });

  const load = async () => { setProblems(await storage.getList('problems:all')); setLoading(false); };
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, []);

  const canHandle = user.role === 'owner' || user.role === 'manajer' || user.role === 'leader';

  const saveProblem = async (data) => {
    const list = await storage.getList('problems:all');
    list.unshift({
      id: uid(), ...data, status: 'open',
      reportedById: user.id, reportedByName: user.name,
      createdAt: new Date().toISOString()
    });
    await storage.set('problems:all', list);
    await logActivity(`🚨 lapor masalah: "${data.title}" (${URGENCY[data.urgency].label})`, user.name);
    setShowForm(false); load();
  };
  const setStatus = async (p, status) => {
    const list = (await storage.getList('problems:all')).map(x => x.id === p.id ? { ...x, status } : x);
    await storage.set('problems:all', list); load();
  };
  const resolveProblem = async (rootCause) => {
    const list = (await storage.getList('problems:all')).map(x => x.id === resolving.id ? {
      ...x, status: 'resolved', rootCause,
      resolvedById: user.id, resolvedByName: user.name, resolvedAt: new Date().toISOString()
    } : x);
    await storage.set('problems:all', list);
    await logActivity(`✅ menyelesaikan masalah "${resolving.title}"`, user.name);
    setResolving(null); load();
  };
  const deleteProblem = async (p) => {
    if (!confirm('Hapus laporan masalah ini?')) return;
    await storage.set('problems:all', (await storage.getList('problems:all')).filter(x => x.id !== p.id));
    load();
  };

  const filtered = problems.filter(p => {
    if (filter.status === 'aktif' && p.status === 'resolved') return false;
    if (filter.status === 'resolved' && p.status !== 'resolved') return false;
    if (filter.urgency !== 'all' && p.urgency !== filter.urgency) return false;
    if (filter.division !== 'all' && p.division !== filter.division) return false;
    return true;
  }).sort((a, b) => (URGENCY[b.urgency].rank - URGENCY[a.urgency].rank) || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const stats = {
    open: problems.filter(p => p.status === 'open').length,
    investigating: problems.filter(p => p.status === 'investigating').length,
    kritis: problems.filter(p => p.status !== 'resolved' && p.urgency === 'kritis').length,
    resolved: problems.filter(p => p.status === 'resolved').length
  };

  if (loading) return <div className="text-slate-400 text-sm">Memuat...</div>;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Masalah & Solusi" subtitle="Andon: laporkan kendala langsung. Selesaikan sampai ke akar (5-Why)."
        action={
          <button onClick={() => setShowForm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Lapor Masalah
          </button>
        } />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3"><div className="text-xs font-semibold text-red-600 uppercase">Terbuka</div><div className="font-display font-bold text-3xl text-red-700 mt-0.5">{stats.open}</div></div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3"><div className="text-xs font-semibold text-blue-600 uppercase">Ditangani</div><div className="font-display font-bold text-3xl text-blue-700 mt-0.5">{stats.investigating}</div></div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3"><div className="text-xs font-semibold text-orange-600 uppercase">Kritis Aktif</div><div className="font-display font-bold text-3xl text-orange-700 mt-0.5">{stats.kritis}</div></div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3"><div className="text-xs font-semibold text-emerald-600 uppercase">Selesai</div><div className="font-display font-bold text-3xl text-emerald-700 mt-0.5">{stats.resolved}</div></div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          {[['aktif', 'Aktif'], ['resolved', 'Selesai'], ['all', 'Semua']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter({ ...filter, status: v })}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${filter.status === v ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        <select value={filter.urgency} onChange={e => setFilter({ ...filter, urgency: e.target.value })} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="all">Semua urgensi</option>
          {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filter.division} onChange={e => setFilter({ ...filter, division: e.target.value })} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="all">Semua divisi</option>
          {Object.entries(DIVISIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={AlertCircle} text="Tidak ada masalah pada filter ini. 🎉" />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${p.urgency === 'kritis' && p.status !== 'resolved' ? 'border-red-300' : 'border-slate-200'}`}>
              <div className="flex items-start gap-3">
                <span className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: URGENCY[p.urgency].dot }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{p.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${URGENCY[p.urgency].color}`}>{URGENCY[p.urgency].label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PROBLEM_STATUS[p.status].color}`}>{PROBLEM_STATUS[p.status].label}</span>
                    {p.division && DIVISIONS[p.division] && <span className={`text-[10px] px-2 py-0.5 rounded-full ${DIVISIONS[p.division].color}`}>{DIVISIONS[p.division].label}</span>}
                  </div>
                  {p.description && <p className="text-sm text-slate-600 mt-1">{p.description}</p>}
                  <div className="text-[11px] text-slate-400 mt-1.5">Dilapor: {p.reportedByName} · {fmtDateTime(p.createdAt)}{p.relatedType && p.relatedType !== 'umum' ? ` · terkait: ${p.relatedType}` : ''}</div>

                  {p.status === 'resolved' && p.rootCause && (
                    <button onClick={() => setViewing(p)} className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Lihat Analisa Akar Masalah
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {canHandle && p.status === 'open' && (
                      <button onClick={() => setStatus(p, 'investigating')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">▶ Tangani</button>
                    )}
                    {canHandle && p.status !== 'resolved' && (
                      <button onClick={() => setResolving(p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Selesaikan + Analisa Akar
                      </button>
                    )}
                    {(user.role === 'owner' || user.role === 'manajer' || p.reportedById === user.id) && (
                      <button onClick={() => deleteProblem(p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ProblemFormModal user={user} onSave={saveProblem} onClose={() => setShowForm(false)} />}
      {resolving && <RootCauseModal problem={resolving} onSave={resolveProblem} onClose={() => setResolving(null)} />}
      {viewing && <RootCauseViewModal problem={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function ProblemFormModal({ user, onSave, onClose }) {
  const [form, setForm] = useState({
    title: '', description: '', urgency: 'sedang',
    division: user.division || 'internal', relatedType: 'umum'
  });
  const [error, setError] = useState('');
  const submit = () => {
    if (!form.title.trim()) return setError('Judul masalah wajib diisi.');
    onSave({ ...form, title: form.title.trim(), description: form.description.trim() });
  };
  return (
    <Modal title="🚨 Lapor Masalah (Andon)" onClose={onClose}>
      <div className="space-y-3">
        <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">Prinsip TPS: begitu ada kendala, langsung "tarik tali" — laporkan supaya cepat ditangani sebelum membesar.</div>
        <Field label="Masalahnya apa? *">
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="mis. GMV TAP turun drastis 3 hari berturut"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Detail / kronologi">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
            placeholder="Jelaskan situasinya..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Urgensi *">
            <select value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Divisi terkait">
            <select value={form.division} onChange={e => setForm({ ...form, division: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(DIVISIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Terkait dengan">
          <select value={form.relatedType} onChange={e => setForm({ ...form, relatedType: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="umum">Umum</option>
            <option value="tugas">Tugas</option>
            <option value="target GMV">Target GMV</option>
            <option value="creator">Creator</option>
            <option value="seller">Seller</option>
            <option value="konten">Konten</option>
            <option value="live">Live</option>
            <option value="tim">Tim / SDM</option>
          </select>
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel="Kirim Laporan" />
      </div>
    </Modal>
  );
}

function RootCauseModal({ problem, onSave, onClose }) {
  const [form, setForm] = useState({
    why1: '', why2: '', why3: '', why4: '', why5: '', root: '', corrective: '', preventive: ''
  });
  const [error, setError] = useState('');
  const submit = () => {
    if (!form.why1.trim()) return setError('Minimal isi "Kenapa?" pertama.');
    if (!form.root.trim()) return setError('Akar masalah wajib diisi.');
    if (!form.corrective.trim()) return setError('Tindakan perbaikan wajib diisi.');
    onSave(form);
  };
  const whyFields = [
    ['why1', 'Kenapa ini terjadi?'],
    ['why2', 'Kenapa itu bisa terjadi?'],
    ['why3', 'Kenapa lagi?'],
    ['why4', 'Lalu kenapa?'],
    ['why5', 'Kenapa (akar)?']
  ];
  return (
    <Modal title="Analisa Akar Masalah (5-Why)" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <div className="text-xs font-semibold text-slate-500 uppercase">Masalah</div>
          <div className="font-semibold text-slate-900 text-sm">{problem.title}</div>
        </div>
        <div className="text-xs text-slate-500">Tanya "kenapa?" berulang sampai ketemu akar sebenarnya — jangan berhenti di gejala. Isi minimal sampai ketemu akar (tidak harus 5).</div>
        {whyFields.map(([k, label], i) => (
          <div key={k} className="flex gap-2 items-start">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-1">{i + 1}</div>
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-slate-500">{label}</label>
              <input type="text" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        ))}
        <Field label="🎯 Akar Masalah Sebenarnya *">
          <textarea value={form.root} onChange={e => setForm({ ...form, root: e.target.value })} rows={2}
            placeholder="Kesimpulan: akar masalahnya adalah..."
            className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-blue-50/30" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="🔧 Tindakan Perbaikan (sekarang) *">
            <textarea value={form.corrective} onChange={e => setForm({ ...form, corrective: e.target.value })} rows={2}
              placeholder="Yang dilakukan untuk memperbaiki"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="🛡️ Tindakan Pencegahan (ke depan)">
            <textarea value={form.preventive} onChange={e => setForm({ ...form, preventive: e.target.value })} rows={2}
              placeholder="Supaya tidak terulang (mis. bikin SOP)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel="Tandai Selesai" />
      </div>
    </Modal>
  );
}

function RootCauseViewModal({ problem, onClose }) {
  const rc = problem.rootCause || {};
  const whys = [rc.why1, rc.why2, rc.why3, rc.why4, rc.why5].filter(Boolean);
  return (
    <Modal title="Analisa Akar Masalah" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <div className="font-semibold text-slate-900">{problem.title}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Diselesaikan {problem.resolvedByName} · {problem.resolvedAt ? fmtDate(problem.resolvedAt) : ''}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Rantai 5-Why</div>
          <div className="space-y-1">
            {whys.map((w, i) => (
              <div key={i} className="flex gap-2 items-start text-sm">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-slate-700">{w}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-bold text-blue-700 uppercase">🎯 Akar Masalah</div>
          <div className="text-sm text-slate-800 mt-1">{rc.root}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-xs font-bold text-amber-700 uppercase">🔧 Perbaikan</div>
            <div className="text-sm text-slate-800 mt-1">{rc.corrective || '-'}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-xs font-bold text-emerald-700 uppercase">🛡️ Pencegahan</div>
            <div className="text-sm text-slate-800 mt-1">{rc.preventive || '-'}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============ LEADERBOARD ============
// ============ EKSEKUSI KONTEN (Media & Creative) ============
function MediaTasksView({ user, allUsers }) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('antrian');

  const load = async () => { setIdeas(await storage.getList('content-ideas:all')); setLoading(false); };
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, []);

  const FORMATS = {
    reel: { label: 'Reel/Video', icon: '🎬' }, foto: { label: 'Foto/Carousel', icon: '📸' },
    live: { label: 'Live', icon: '🔴' }, story: { label: 'Story', icon: '⚡' }, lainnya: { label: 'Lainnya', icon: '📝' }
  };
  // Ide yang sudah di-approve & belum tayang = antrian kerja Media Creative
  const antrian = ideas.filter(i => i.status === 'approved' || i.status === 'in_progress');
  const selesai = ideas.filter(i => i.status === 'published');
  const list = tab === 'antrian' ? antrian : selesai;

  // Tandai mulai dikerjakan
  const markProgress = async (idea) => {
    const all = (await storage.getList('content-ideas:all')).map(i =>
      i.id === idea.id ? { ...i, status: 'in_progress', startedAt: new Date().toISOString() } : i);
    await storage.set('content-ideas:all', all);
    await logActivity(`mulai garap konten "${idea.title}"`, user.name); load();
  };
  // Centang selesai → status published
  const markDone = async (idea) => {
    const all = (await storage.getList('content-ideas:all')).map(i =>
      i.id === idea.id ? { ...i, status: 'published', publishedAt: new Date().toISOString(), doneByName: user.name } : i);
    await storage.set('content-ideas:all', all);
    await logActivity(`menyelesaikan konten "${idea.title}"`, user.name); load();
  };
  // Balikkan ke antrian (kalau salah centang)
  const undoDone = async (idea) => {
    const all = (await storage.getList('content-ideas:all')).map(i =>
      i.id === idea.id ? { ...i, status: 'in_progress' } : i);
    await storage.set('content-ideas:all', all); load();
  };

  const fmtDate = ts => ts ? new Date(isDateOnly(ts) ? ts + 'T00:00:00' : ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ...(isDateOnly(ts) ? {} : { timeZone: 'Asia/Jakarta' }) }) : '-';

  if (loading) return <div className="text-slate-400 text-sm">Memuat...</div>;

  return (
    <div className="max-w-5xl">
      <PageHeader title="Eksekusi Konten" subtitle="Antrian konten yang sudah di-approve — siap digarap tim Media & Creative" />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-200 p-4">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Perlu Dikerjakan</div>
          <div className="font-display font-bold text-3xl text-amber-700 mt-1">{antrian.length}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 p-4">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Sudah Selesai</div>
          <div className="font-display font-bold text-3xl text-emerald-700 mt-1">{selesai.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-1 inline-flex mb-4">
        <button onClick={() => setTab('antrian')}
          className={`px-4 py-2 rounded text-sm font-semibold transition ${tab === 'antrian' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          📋 Antrian Kerja ({antrian.length})
        </button>
        <button onClick={() => setTab('selesai')}
          className={`px-4 py-2 rounded text-sm font-semibold transition ${tab === 'selesai' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          ✅ Selesai ({selesai.length})
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Clapperboard} text={tab === 'antrian'
          ? 'Belum ada konten untuk dikerjakan. Ide yang di-approve di Bank Ide Konten otomatis muncul di sini.'
          : 'Belum ada konten yang diselesaikan.'} />
      ) : (
        <div className="space-y-3">
          {list.map(idea => (
            <div key={idea.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${idea.status === 'in_progress' ? 'border-blue-200' : 'border-slate-200'}`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => tab === 'selesai' ? undoDone(idea) : markDone(idea)}
                  title={tab === 'selesai' ? 'Batalkan selesai' : 'Tandai selesai'}
                  className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                    tab === 'selesai' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50'
                  }`}>
                  {tab === 'selesai' && <Check className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{FORMATS[idea.format]?.icon || '📝'}</span>
                    <span className={`font-semibold text-slate-900 ${tab === 'selesai' ? 'line-through text-slate-400' : ''}`}>{idea.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{FORMATS[idea.format]?.label || 'Konten'}</span>
                    {idea.status === 'in_progress' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">SEDANG DIGARAP</span>}
                  </div>
                  {idea.description && <p className="text-sm text-slate-600 mt-1">{idea.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                    {idea.assignedToName && <span>👤 PIC: <b className="text-slate-700">{idea.assignedToName}</b></span>}
                    {idea.targetDate && <span>🎯 Target: {fmtDate(idea.targetDate)}</span>}
                    <span>💡 Dari: {idea.proposedByName}</span>
                  </div>
                  {idea.assignNotes && (
                    <div className="mt-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-800">
                      📌 Brief: {idea.assignNotes}
                    </div>
                  )}
                  {tab === 'antrian' && (
                    <div className="flex gap-2 mt-3">
                      {idea.status === 'approved' && (
                        <button onClick={() => markProgress(idea)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition">
                          ▶ Mulai Garap
                        </button>
                      )}
                      <button onClick={() => markDone(idea)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Tandai Selesai
                      </button>
                    </div>
                  )}
                  {tab === 'selesai' && idea.doneByName && (
                    <div className="text-[11px] text-emerald-600 mt-2">✅ Diselesaikan oleh {idea.doneByName}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ DATABASE SELLER (TAP) ============
function SellersView({ user, allUsers }) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', shopName: '', phone: '', category: '', status: 'aktif', commission: '', note: '' });

  const load = async () => { setSellers(await storage.getList('sellers:all')); setLoading(false); };
  useEffect(() => { load(); const iv = setInterval(load, 12000); return () => clearInterval(iv); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', shopName: '', phone: '', category: '', status: 'aktif', commission: '', note: '' }); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, shopName: s.shopName || '', phone: s.phone || '', category: s.category || '', status: s.status || 'aktif', commission: s.commission || '', note: s.note || '' }); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    let list = await storage.getList('sellers:all');
    if (editing) {
      list = list.map(s => s.id === editing.id ? { ...s, ...form } : s);
      await logActivity(`update seller ${form.name}`, user.name);
    } else {
      list.unshift({ id: uid(), ...form, managerId: user.id, managerName: user.name, createdAt: new Date().toISOString() });
      await logActivity(`tambah seller ${form.name}`, user.name);
    }
    await storage.set('sellers:all', list);
    setShowForm(false); setEditing(null); load();
  };
  const remove = async (s) => {
    if (!confirm(`Hapus seller ${s.name}?`)) return;
    await storage.set('sellers:all', (await storage.getList('sellers:all')).filter(x => x.id !== s.id));
    await logActivity(`hapus seller ${s.name}`, user.name); load();
  };

  const filtered = sellers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.shopName || '').toLowerCase().includes(search.toLowerCase())
  );
  const STATUS = { aktif: 'bg-emerald-100 text-emerald-700', nonaktif: 'bg-slate-100 text-slate-500', prospek: 'bg-amber-100 text-amber-700' };

  if (loading) return <div className="text-slate-400 text-sm">Memuat...</div>;

  return (
    <div className="max-w-6xl">
      <PageHeader title="Database Seller" subtitle="Seller yang bergabung & bind via TikTok Affiliate Partner (TAP)"
        action={
          <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Seller Baru
          </button>
        } />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari seller / toko..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Briefcase} text="Belum ada seller. Tambah seller pertama." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{s.name}</div>
                  {s.shopName && <div className="text-xs text-slate-500 truncate">🏪 {s.shopName}</div>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${STATUS[s.status] || STATUS.aktif}`}>{(s.status || 'aktif').toUpperCase()}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {s.category && <div>Kategori: <span className="font-medium">{s.category}</span></div>}
                {s.commission && <div>Komisi: <span className="font-medium">{s.commission}</span></div>}
                {s.phone && <div>WA: {s.phone}</div>}
                {s.note && <div className="text-slate-500 italic">"{s.note}"</div>}
              </div>
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
                {s.phone && (
                  <a href={`https://wa.me/${s.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer"
                    className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1">
                    <Send className="w-3 h-3" /> WhatsApp
                  </a>
                )}
                <button onClick={() => openEdit(s)} className="ml-auto text-slate-400 hover:text-blue-600 p-1"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => remove(s)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? `Edit ${editing.name}` : 'Seller Baru'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Field label="Nama Seller / PIC *">
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
            <Field label="Nama Toko / Shop">
              <input type="text" value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kategori Produk">
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="mis. Fashion, F&B"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="aktif">Aktif</option>
                  <option value="prospek">Prospek</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Komisi (%)">
                <input type="text" value={form.commission} onChange={e => setForm({ ...form, commission: e.target.value })}
                  placeholder="mis. 10%"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="No. WhatsApp">
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="08xxx"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
            </div>
            <Field label="Catatan">
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
            <div className="flex gap-2 pt-2">
              <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold">Simpan</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50">Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ ABSENSI (Attendance + Lokasi GPS) ============
// ============ KEPUASAN MITRA (seller & creator — prinsip customer satisfaction) ============
function PartnerFeedbackView({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'seller', name: '', rating: 0, note: '' });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  const isManager = user.role === 'owner' || user.role === 'manajer';
  const load = async () => { setItems(await storage.getList('partner-feedback:all')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name.trim() || form.rating < 1) return;
    setBusy(true);
    const list = await storage.getList('partner-feedback:all');
    list.unshift({
      id: uid(), type: form.type, name: form.name.trim(), rating: form.rating, note: form.note.trim(),
      date: dayKey(), byId: user.id, byName: user.name, createdAt: new Date().toISOString()
    });
    await storage.set('partner-feedback:all', list.slice(0, 1000));
    await logActivity(`mencatat kepuasan ${form.type} "${form.name}" (${form.rating}★)`, user.name);
    setForm({ type: form.type, name: '', rating: 0, note: '' });
    setBusy(false); load();
  };

  const del = async (it) => {
    if (!confirm(`Hapus catatan kepuasan "${it.name}"?`)) return;
    await storage.set('partner-feedback:all', (await storage.getList('partner-feedback:all')).filter(x => x.id !== it.id));
    load();
  };

  // Ringkasan bulan ini vs bulan lalu
  const mk = monthKey();
  const lastMk = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const statsOf = (m, type) => {
    const rows = items.filter(i => (i.date || '').startsWith(m) && (type === 'all' || i.type === type));
    const avg = rows.length ? rows.reduce((s, i) => s + i.rating, 0) / rows.length : null;
    return { count: rows.length, avg };
  };
  const nowAll = statsOf(mk, 'all'), prevAll = statsOf(lastMk, 'all');
  const nowSeller = statsOf(mk, 'seller'), nowCreator = statsOf(mk, 'creator');
  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  const Stars = ({ value, onPick, size = 'w-7 h-7' }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={onPick ? () => onPick(n) : undefined}
          className={`${size} ${onPick ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition text-xl leading-none ${n <= value ? 'text-amber-400' : 'text-slate-200'}`}>★</button>
      ))}
    </div>
  );

  if (loading) return <div className="text-slate-400 text-sm">Memuat kepuasan mitra...</div>;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Kepuasan Mitra"
        subtitle="Catat kepuasan seller & creator setiap follow-up — pelanggan puas = bisnis bertahan. Rata-rata bulanan otomatis masuk analisis SWOT." />

      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Rata-rata Bulan Ini', value: nowAll.avg !== null ? `${nowAll.avg.toFixed(1)} ★` : '—', sub: `${nowAll.count} catatan`, hl: true },
          { label: 'Bulan Lalu', value: prevAll.avg !== null ? `${prevAll.avg.toFixed(1)} ★` : '—', sub: `${prevAll.count} catatan` },
          { label: 'Seller', value: nowSeller.avg !== null ? `${nowSeller.avg.toFixed(1)} ★` : '—', sub: `${nowSeller.count} catatan bln ini` },
          { label: 'Creator', value: nowCreator.avg !== null ? `${nowCreator.avg.toFixed(1)} ★` : '—', sub: `${nowCreator.count} catatan bln ini` }
        ].map((c, i) => (
          <div key={i} className={`rounded-2xl border p-4 ${c.hl ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className={`font-display font-bold text-2xl mt-1 ${c.hl ? 'text-blue-700' : 'text-slate-900'}`}>{c.value}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Form catat cepat */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mb-5">
        <h3 className="font-display font-bold text-slate-900 mb-3">Catat Kepuasan (30 detik)</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {[['seller', '🏪 Seller'], ['creator', '🎬 Creator']].map(([k, label]) => (
            <button key={k} onClick={() => setForm({ ...form, type: k })}
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg border-2 transition ${form.type === k ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <Field label={`Nama ${form.type === 'seller' ? 'Seller' : 'Creator'} *`}>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder={form.type === 'seller' ? 'mis. Toko Berkah' : 'mis. @adadynda'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="Seberapa puas mereka? *">
            <Stars value={form.rating} onPick={(n) => setForm({ ...form, rating: n })} />
          </Field>
        </div>
        <Field label="Catatan (apa kata mereka / kenapa)">
          <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="mis. puas dengan kecepatan respon · komplain komisi telat cair"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2" />
        </Field>
        <button onClick={submit} disabled={busy || !form.name.trim() || form.rating < 1}
          className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2">
          <Heart className="w-4 h-4" /> {busy ? 'Menyimpan…' : 'Simpan Catatan'}
        </button>
      </div>

      {/* Daftar */}
      <div className="flex gap-1.5 mb-3">
        {[['all', 'Semua'], ['seller', 'Seller'], ['creator', 'Creator']].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={filter === k ? { backgroundColor: '#2563EB', color: '#fff' } : {}}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 transition">
            {label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Heart} text="Belum ada catatan kepuasan. Mulai dari follow-up berikutnya." />
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 50).map(it => (
            <div key={it.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${it.type === 'seller' ? 'bg-orange-50' : 'bg-purple-50'}`}>
                {it.type === 'seller' ? '🏪' : '🎬'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">{it.name}</span>
                  <Stars value={it.rating} size="w-4 h-4" />
                  {it.rating <= 2 && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">perlu follow-up</span>}
                </div>
                {it.note && <div className="text-xs text-slate-600 mt-0.5">"{it.note}"</div>}
                <div className="text-[10px] text-slate-400 mt-1">{fmtDate(it.date)} · dicatat {it.byName}</div>
              </div>
              {(isManager || it.byId === user.id) && (
                <button onClick={() => del(it)} className="text-slate-300 hover:text-red-600 p-1 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ KALKULATOR PEMBAGIAN KOMISI TAP ============
function TapCommissionView({ user }) {
  const [tab, setTab] = useState('calc'); // calc | history | tiers
  const [tiers, setTiers] = useState(DEFAULT_TAP_TIERS);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ seller: '', product: '', price: '', raise: '' });
  const [result, setResult] = useState(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const canManage = user.role === 'owner' || user.role === 'manajer' || (user.role === 'leader' && (user.division || '') === 'tap');

  const load = async () => {
    const t = await storage.get('tap-commission:tiers');
    if (Array.isArray(t) && t.length > 0) setTiers(t);
    setHistory(await storage.getList('tap-commission:history'));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const price = Number(String(form.price).replace(/[^\d]/g, '')) || 0;
  const raiseRaw = String(form.raise).replace(',', '.');
  const raise = Number(raiseRaw) || 0;
  const isDecimal = raise > 0 && raise % 1 !== 0;
  const maxRange = Math.max(...tiers.map(t => Number(t.max) || 0));

  const hitung = () => {
    if (price <= 0 || raise <= 0) return;
    setResult({ ...computeTapCommission(price, Math.round(raise * 100) / 100, tiers), price, raise, seller: form.seller.trim(), product: form.product.trim() });
  };

  const simpanRiwayat = async () => {
    if (!result) return;
    const item = {
      id: uid(), date: dayKey(),
      seller: result.seller || '-', product: result.product || '-',
      price: result.price, raise: result.raise,
      tierName: result.tier.name, agencyPct: result.agencyPct, affPct: result.affPct,
      statusLabel: result.status.label, statusLevel: result.status.level,
      outOfRange: result.outOfRange,
      byName: user.name, createdAt: new Date().toISOString()
    };
    const list = await storage.getList('tap-commission:history');
    list.unshift(item);
    await storage.set('tap-commission:history', list.slice(0, 500));
    await logActivity(`menyimpan simulasi komisi TAP: ${item.product} (${item.tierName})`, user.name);
    setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2500);
    load();
  };

  const hapusRiwayat = async (it) => {
    if (!confirm(`Hapus simulasi "${it.product}" (${fmtDate(it.date)})?`)) return;
    await storage.set('tap-commission:history', (await storage.getList('tap-commission:history')).filter(x => x.id !== it.id));
    load();
  };

  const saveTiers = async (next) => {
    await storage.set('tap-commission:tiers', next);
    setTiers(next);
    await logActivity('mengubah pengaturan tier komisi TAP', user.name);
  };

  const TABS = [
    { id: 'calc', label: 'Kalkulator', icon: Calculator },
    { id: 'history', label: `Riwayat (${history.length})`, icon: ClipboardList },
    ...(canManage ? [{ id: 'tiers', label: 'Pengaturan Tier', icon: Settings }] : [])
  ];

  const statusColorOf = (lvl) => lvl === 'ideal' ? 'bg-emerald-100 text-emerald-700' : lvl === 'cukup' ? 'bg-amber-100 text-amber-700' : lvl === 'kurang' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  if (loading) return <div className="text-slate-400 text-sm">Memuat kalkulator komisi...</div>;

  return (
    <div className="max-w-5xl">
      <PageHeader title="Kalkulator Komisi TAP"
        subtitle="Pembagian raise komisi seller → agency & affiliator, berbasis tier harga produk (bukan pukul rata 2%)." />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={tab === t.id ? { backgroundColor: '#2563EB', color: '#fff', borderColor: '#2563EB' } : {}}
              className="text-sm font-bold px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-blue-300 transition flex items-center gap-2">
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ===== TAB KALKULATOR ===== */}
      {tab === 'calc' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Form input */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 space-y-3">
            <h3 className="font-display font-bold text-slate-900">Data Produk & Raise</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Seller">
                <input type="text" value={form.seller} onChange={e => setForm({ ...form, seller: e.target.value })}
                  placeholder="mis. Toko Berkah" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="Nama Produk">
                <input type="text" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}
                  placeholder="mis. Gamis Premium" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
            </div>
            <Field label="Harga Produk (Rp) *">
              <input type="text" inputMode="numeric" value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value.replace(/[^\d]/g, '') })}
                placeholder="mis. 150000" className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {price > 0 && (
                <div className={`text-xs mt-1 font-semibold ${price > maxRange ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {fmtRupiah(price)} · {price > maxRange ? `⚠ Di luar range TAP (maks ${fmtRupiah(maxRange)}) — perlu approval manual` : '✓ Masuk range TAP'}
                </div>
              )}
            </Field>
            <Field label="Raise Komisi dari Seller (%) *">
              <input type="text" inputMode="decimal" value={form.raise}
                onChange={e => setForm({ ...form, raise: e.target.value.replace(/[^\d.,]/g, '') })}
                placeholder="mis. 6" className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {isDecimal && (
                <div className="text-xs mt-1 text-orange-600 font-semibold">⚠ Gunakan angka persen bulat agar pembagian mudah diterapkan ke seller & affiliator.</div>
              )}
            </Field>
            <button onClick={hitung} disabled={price <= 0 || raise <= 0}
              style={{ boxShadow: '0 10px 26px -8px rgba(37,99,235,0.6)' }}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:shadow-none text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
              <Calculator className="w-4 h-4" /> Hitung Pembagian
            </button>

            {/* Ringkasan tier standar */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-2.5 py-1.5 font-bold">Tier</th>
                    <th className="text-left px-2.5 py-1.5 font-bold">Harga</th>
                    <th className="text-right px-2.5 py-1.5 font-bold">Agency</th>
                    <th className="text-right px-2.5 py-1.5 font-bold">Min. Raise</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map(t => (
                    <tr key={t.id} className={`border-t border-slate-100 ${result && result.tier.id === t.id ? 'bg-blue-50 font-bold' : ''}`}>
                      <td className="px-2.5 py-1.5">{t.name}</td>
                      <td className="px-2.5 py-1.5 text-slate-500">{fmtRupiah(t.min)} – {fmtRupiah(t.max)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{t.agency}%</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{t.minRaise}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hasil */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
            <h3 className="font-display font-bold text-slate-900 mb-3">Hasil Pembagian</h3>
            {!result ? (
              <div className="text-center py-14 text-slate-400 text-sm">
                <Calculator className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                Isi harga produk & raise seller, lalu klik <b>Hitung</b>.
              </div>
            ) : (
              <div className="space-y-3">
                {result.outOfRange && (
                  <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-xl px-3 py-2.5 font-semibold">
                    ⚠ Harga di luar range TAP saat ini (maks {fmtRupiah(maxRange)}). Perhitungan pakai standar tier tertinggi — perlu approval manual.
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 text-blue-700">{result.tier.name}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-600">Raise {result.raise}%</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${result.status.color}`}>{result.status.label}</span>
                </div>

                {/* Bar pembagian visual */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span className="text-blue-700">Agency {result.agencyPct}%</span>
                    <span className={result.affPct >= result.minAff ? 'text-emerald-700' : 'text-red-600'}>Affiliator {Math.max(result.affPct, 0)}%</span>
                  </div>
                  <div className="h-3.5 rounded-full overflow-hidden flex bg-slate-100">
                    {result.raise > 0 && <div style={{ width: `${Math.min(result.agencyPct / result.raise * 100, 100)}%`, background: 'linear-gradient(90deg,#2563EB,#1D4ED8)' }} className="h-full"></div>}
                    {result.affPct > 0 && <div style={{ width: `${result.affPct / result.raise * 100}%`, background: result.affPct >= result.minAff ? 'linear-gradient(90deg,#34D399,#10B981)' : 'linear-gradient(90deg,#FB923C,#F97316)' }} className="h-full"></div>}
                  </div>
                </div>

                {/* Nominal per order */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-blue-600 uppercase">Nominal Agency / order</div>
                    <div className="font-display font-bold text-lg text-blue-800 tabular-nums">{fmtRupiah(result.nominalAgency)}</div>
                    <div className="text-[10px] text-blue-500">{fmtRupiah(result.price)} × {result.agencyPct}%</div>
                  </div>
                  <div className={`rounded-xl p-3 border ${result.affPct >= result.minAff ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className={`text-[10px] font-bold uppercase ${result.affPct >= result.minAff ? 'text-emerald-600' : 'text-orange-600'}`}>Nominal Affiliator / order</div>
                    <div className={`font-display font-bold text-lg tabular-nums ${result.affPct >= result.minAff ? 'text-emerald-800' : 'text-orange-700'}`}>{fmtRupiah(result.nominalAff)}</div>
                    <div className={`text-[10px] ${result.affPct >= result.minAff ? 'text-emerald-500' : 'text-orange-500'}`}>{fmtRupiah(result.price)} × {Math.max(result.affPct, 0)}%</div>
                  </div>
                </div>

                {/* Rekomendasi */}
                <div className={`text-sm rounded-xl px-3.5 py-3 border leading-relaxed ${result.status.level === 'ideal' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : result.status.level === 'cukup' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  <b>Rekomendasi:</b> {result.rekomendasi}
                  <div className="text-[11px] opacity-75 mt-1">{result.status.detail}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={simpanRiwayat}
                    className="flex-1 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Simpan ke Riwayat
                  </button>
                  {savedMsg && <span className="text-xs text-emerald-600 font-bold">✓ Tersimpan</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB RIWAYAT ===== */}
      {tab === 'history' && (
        history.length === 0 ? (
          <EmptyState icon={ClipboardList} text="Belum ada simulasi tersimpan. Hitung di tab Kalkulator lalu klik 'Simpan ke Riwayat'." />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold">Tanggal</th>
                    <th className="text-left px-3 py-2.5 font-bold">Seller</th>
                    <th className="text-left px-3 py-2.5 font-bold">Produk</th>
                    <th className="text-right px-3 py-2.5 font-bold">Harga</th>
                    <th className="text-right px-3 py-2.5 font-bold">Raise</th>
                    <th className="text-left px-3 py-2.5 font-bold">Tier</th>
                    <th className="text-right px-3 py-2.5 font-bold">Agency</th>
                    <th className="text-right px-3 py-2.5 font-bold">Affiliator</th>
                    <th className="text-left px-3 py-2.5 font-bold">Status</th>
                    <th className="px-2 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(it => (
                    <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(it.date)}</td>
                      <td className="px-3 py-2.5 text-slate-700">{it.seller}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{it.product}{it.outOfRange && <span className="ml-1 text-[10px] text-orange-600 font-bold" title="Di luar range TAP">⚠</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{fmtRupiah(it.price)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800">{it.raise}%</td>
                      <td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">{it.tierName}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-blue-700 font-bold">{it.agencyPct}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: it.affPct >= 3 ? '#047857' : '#C2410C' }}>{Math.max(it.affPct, 0)}%</td>
                      <td className="px-3 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${statusColorOf(it.statusLevel)}`}>{it.statusLabel}</span></td>
                      <td className="px-2 py-2.5">
                        {(canManage || it.byName === user.name) && (
                          <button onClick={() => hapusRiwayat(it)} className="text-slate-300 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">{history.length} simulasi tersimpan · sinkron untuk semua tim TAP.</div>
          </div>
        )
      )}

      {/* ===== TAB PENGATURAN TIER ===== */}
      {tab === 'tiers' && canManage && (
        <TapTierSettings tiers={tiers} onSave={saveTiers} />
      )}
    </div>
  );
}

// Pengaturan tier (owner/manajer/leader TAP)
function TapTierSettings({ tiers, onSave }) {
  const [list, setList] = useState(tiers.map(t => ({ ...t })));
  const [saved, setSaved] = useState(false);
  const setVal = (i, key, val) => {
    const next = [...list];
    next[i] = { ...next[i], [key]: key === 'name' ? val : Number(String(val).replace(/[^\d]/g, '')) || 0 };
    setList(next);
  };
  const addTier = () => {
    const last = list[list.length - 1];
    setList([...list, { id: uid(), name: `Tier ${list.length + 1}`, min: (last?.max || 0) + 1, max: (last?.max || 0) + 100000, agency: (last?.agency || 0) + 1, minRaise: (last?.minRaise || 0) + 1, minAff: 3 }]);
  };
  const removeTier = (i) => { if (list.length <= 1) return; setList(list.filter((_, x) => x !== i)); };
  const resetDefault = () => { if (confirm('Kembalikan ke standar default brief TAP?')) setList(DEFAULT_TAP_TIERS.map(t => ({ ...t }))); };
  const submit = async () => {
    await onSave([...list].sort((a, b) => a.min - b.min));
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="font-display font-bold text-slate-900">Pengaturan Tier Harga</h3>
          <p className="text-xs text-slate-500 mt-0.5">Standar pembagian: tier harga menentukan jatah agency. Minimum raise dibuat agar affiliator tetap dapat minimal 3%.</p>
        </div>
        <button onClick={resetDefault} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reset ke Default</button>
      </div>
      <div className="space-y-3">
        {list.map((t, i) => (
          <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Nama Tier</div>
                <input type="text" value={t.name} onChange={e => setVal(i, 'name', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Harga Min (Rp)</div>
                <input type="text" inputMode="numeric" value={t.min} onChange={e => setVal(i, 'min', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Harga Maks (Rp)</div>
                <input type="text" inputMode="numeric" value={t.max} onChange={e => setVal(i, 'max', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Agency (%)</div>
                <input type="text" inputMode="numeric" value={t.agency} onChange={e => setVal(i, 'agency', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Min. Raise (%)</div>
                <input type="text" inputMode="numeric" value={t.minRaise} onChange={e => setVal(i, 'minRaise', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums" />
              </div>
              <div className="flex items-end gap-1">
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Min. Affiliator (%)</div>
                  <input type="text" inputMode="numeric" value={t.minAff} onChange={e => setVal(i, 'minAff', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums" />
                </div>
                <button onClick={() => removeTier(i)} title="Hapus tier" className="text-slate-400 hover:text-red-600 p-1.5 mb-0.5"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={addTier}
          className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-blue-700 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Tier
        </button>
      </div>
      <div className="flex items-center justify-end gap-3 mt-4">
        {saved && <span className="text-sm text-emerald-600 font-bold">✓ Tersimpan & langsung berlaku</span>}
        <button onClick={submit}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-md">Simpan Pengaturan</button>
      </div>
    </div>
  );
}

function AttendanceView({ user, allUsers }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterDiv, setFilterDiv] = useState('all');
  const [filterDate, setFilterDate] = useState(''); // '' = semua tanggal
  const [config, setConfig] = useState(DEFAULT_ATTENDANCE_CONFIG);
  const [result, setResult] = useState(null);   // banner hasil absen (telat/lokasi)
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState(null);  // record yang sedang diedit
  const [selfieFor, setSelfieFor] = useState(null); // 'in' | 'out' → buka kamera dulu
  const [leaves, setLeaves] = useState([]);
  const [showIzin, setShowIzin] = useState(false);
  const [leaveDetail, setLeaveDetail] = useState(null); // izin yang dibuka detailnya
  const [boardDate, setBoardDate] = useState(wibDayKey()); // tanggal status harian tim
  const [lightbox, setLightbox] = useState(null);
  const [selfieLoading, setSelfieLoading] = useState(null); // recordId yang fotonya sedang dimuat

  const canManageAtt = user.role === 'owner' || user.role === 'manajer';

  const load = async () => {
    try {
      const list = await loadAttendanceRecs();
      setRecords(list);
      setLeaves(await loadLeaves());
      const cfg = await storage.get('attendance:config');
      if (cfg) setConfig({ ...DEFAULT_ATTENDANCE_CONFIG, ...cfg });
    } catch (e) {
      console.warn('Gagal memuat absensi (akan dicoba lagi):', e?.message || e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const todayStr = new Date().toDateString();
  const myToday = records.filter(r => r.userId === user.id && new Date(r.timestamp).toDateString() === todayStr);
  const lastToday = myToday.length ? myToday[myToday.length - 1] : null;
  const nextType = (!lastToday || lastToday.type === 'out') ? 'in' : 'out';

  // ===== Helper jam & lokasi =====
  const parseHM = (s) => { if (!s || !s.includes(':')) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const haversine = (la1, lo1, la2, lo2) => {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const dLa = toRad(la2 - la1), dLo = toRad(lo2 - lo1);
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const computeFlags = (type, dateObj, loc, cfg) => {
    const mins = dateObj.getHours() * 60 + dateObj.getMinutes();
    let late = false, lateBy = 0, earlyLeave = false, earlyBy = 0;
    // Hari libur (mis. Minggu) → tidak dihitung telat/pulang cepat
    if (cfg.libur) cfg = { ...cfg, flexible: true };
    if (!cfg.flexible && type === 'in' && parseHM(cfg.jamMasuk) != null) {
      const sched = parseHM(cfg.jamMasuk);
      if (mins > sched + (Number(cfg.toleransiMenit) || 0)) { late = true; lateBy = mins - sched; }
    }
    if (!cfg.flexible && type === 'out' && parseHM(cfg.jamPulang) != null) {
      const sched = parseHM(cfg.jamPulang);
      if (mins < sched) { earlyLeave = true; earlyBy = sched - mins; }
    }
    let locationMismatch = false, distanceM = null;
    if (cfg.lokasiAktif && cfg.lokasiLat != null && cfg.lokasiLng != null && loc && loc.lat != null) {
      distanceM = Math.round(haversine(loc.lat, loc.lng, cfg.lokasiLat, cfg.lokasiLng));
      locationMismatch = distanceM > (Number(cfg.radiusM) || 200);
    }
    return { late, lateBy, earlyLeave, earlyBy, locationMismatch, distanceM };
  };
  const pad2 = n => String(n).padStart(2, '0');
  const toLocalInput = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

  const getLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Perangkat tidak mendukung GPS/lokasi.'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }),
      err => {
        if (err.code === 1) reject(new Error('Izin lokasi ditolak. Aktifkan izin lokasi di browser lalu coba lagi.'));
        else if (err.code === 2) reject(new Error('Lokasi tidak tersedia. Pastikan GPS/internet aktif.'));
        else if (err.code === 3) reject(new Error('Waktu habis mengambil lokasi. Coba lagi.'));
        else reject(new Error('Gagal mengambil lokasi.'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

  // Reverse geocode → alamat teks (pakai Nominatim OpenStreetMap, gratis)
  const getAddress = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'id' }
      });
      const data = await res.json();
      return data.display_name || '';
    } catch { return ''; }
  };

  // Mulai absen: kalau selfie wajib → buka kamera dulu, lalu lanjut proses
  const doAbsen = (type) => {
    setError(''); setResult(null);
    if (config.selfieWajib !== false) setSelfieFor(type);
    else proceedAbsen(type, null);
  };

  const proceedAbsen = async (type, selfieDataUrl) => {
    setSelfieFor(null); setBusy(true);
    try {
      const loc = await getLocation();
      const address = await getAddress(loc.lat, loc.lng);
      const now = new Date();
      const myCfg = effectiveAttConfig(config, user.id, now);
      const flags = computeFlags(type, now, loc, myCfg);
      const rec = {
        id: uid(),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        division: user.division || 'internal',
        jobTitle: user.jobTitle || '',
        type,
        timestamp: now.toISOString(),
        latitude: loc.lat,
        longitude: loc.lng,
        accuracy: loc.acc,
        address,
        note: note.trim(),
        hasSelfie: !!selfieDataUrl,
        ...flags
      };
      // Simpan selfie terpisah (biar daftar absensi tetap ringan) + rapikan foto lama >60 hari
      if (selfieDataUrl) {
        await storage.set(`selfie:${rec.id}`, selfieDataUrl);
        const idx = (await storage.get('attendance:selfie-index')) || [];
        idx.push({ key: `selfie:${rec.id}`, date: dayKey(now) });
        const cutoff = dayKey(new Date(Date.now() - 60 * 86400000));
        const keep = [], drop = [];
        idx.forEach(it => (it.date >= cutoff ? keep : drop).push(it));
        for (const it of drop) await storage.delete(it.key);
        await storage.set('attendance:selfie-index', keep);
      }
      const okSave = await storage.set(ATT_REC_PREFIX + rec.id, rec);
      if (!okSave) throw new Error('Gagal menyimpan absen ke server. Cek koneksi internet lalu coba lagi.');
      await logActivity(`absen ${type === 'in' ? 'masuk' : 'pulang'}${flags.late ? ' (terlambat)' : ''}`, user.name);
      setNote('');
      // banner hasil
      const warns = [];
      if (flags.late) warns.push(`Kamu terlambat ${flags.lateBy} menit (jam masuk ${myCfg.jamMasuk}).`);
      if (flags.earlyLeave) warns.push(`Pulang ${flags.earlyBy} menit lebih awal (jam pulang ${myCfg.jamPulang}).`);
      if (flags.locationMismatch) warns.push(`⚠️ Lokasi tidak sesuai — ±${flags.distanceM} m dari lokasi kerja (${config.lokasiLabel || 'kantor'}).`);
      setResult({ ok: warns.length === 0, type, time: fmtTime(rec.timestamp), warns });
      await load();
    } catch (e) {
      setError(e.message || 'Gagal absen.');
    } finally {
      setBusy(false);
    }
  };

  // ===== IZIN (pengajuan & persetujuan) =====
  const izinHmin = Number(config.izinHmin ?? 1);
  const canDecideLeave = (l) => {
    if (user.role === 'owner' || user.role === 'manajer') return true;
    if (user.role === 'leader') {
      const target = allUsers.find(u => u.id === l.userId);
      return target && target.leaderId === user.id;
    }
    return false;
  };
  const submitIzin = async (data) => {
    const rec = {
      id: uid(), userId: user.id, userName: user.name, division: user.division || '',
      type: data.type, date: data.date, reason: data.reason,
      status: 'pending', createdAt: new Date().toISOString()
    };
    const ok = await storage.set(LEAVE_REC_PREFIX + rec.id, rec);
    if (!ok) { alert('Gagal mengajukan izin. Coba lagi saat koneksi stabil.'); return; }
    await logActivity(`mengajukan ${data.type === 'sakit' ? 'izin sakit' : 'izin'} untuk ${fmtDate(data.date)}`, user.name);
    setShowIzin(false); await load();
  };
  const cancelIzin = async (l) => {
    if (!confirm(`Batalkan pengajuan izin ${fmtDate(l.date)}?`)) return;
    const ok = await storage.delete(LEAVE_REC_PREFIX + l.id);
    if (!ok) { alert('Gagal membatalkan izin. Coba lagi.'); return; }
    setLeaveDetail(null); await load();
  };
  const decideIzin = async (l, status) => {
    const note = status === 'rejected' ? (prompt('Alasan penolakan (opsional):') || '') : '';
    const cur = await storage.get(LEAVE_REC_PREFIX + l.id);
    if (!cur) return;
    const ok = await storage.set(LEAVE_REC_PREFIX + l.id, { ...cur, status, note, decidedById: user.id, decidedByName: user.name, decidedAt: new Date().toISOString() });
    if (!ok) { alert('Gagal menyimpan keputusan izin. Coba lagi.'); return; }
    await logActivity(`${status === 'approved' ? 'menyetujui' : 'menolak'} izin ${l.userName} (${fmtDate(l.date)})`, user.name);
    setLeaveDetail(null); await load();
  };
  const myLeaves = leaves.filter(l => l.userId === user.id).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
  const pendingForMe = leaves.filter(l => l.status === 'pending' && canDecideLeave(l)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const approvedTodayLeave = leaves.find(l => l.userId === user.id && l.status === 'approved' && l.date === dayKey());

  // Lihat selfie sebuah record (dimuat saat diminta biar hemat data)
  const viewSelfie = async (r) => {
    setSelfieLoading(r.id);
    const img = await storage.get(`selfie:${r.id}`);
    setSelfieLoading(null);
    if (!img) return alert('Foto selfie tidak ditemukan (mungkin sudah dihapus otomatis setelah 60 hari).');
    setLightbox({ src: img, title: `Selfie ${r.userName} · ${new Date(r.timestamp).toLocaleString('id-ID')}` });
  };

  // Simpan konfigurasi jam & lokasi
  const saveConfig = async (cfg) => {
    await storage.set('attendance:config', cfg);
    setConfig(cfg);
    setShowSettings(false);
    await logActivity('mengubah pengaturan jam & lokasi absensi', user.name);
  };

  // Simpan hasil edit absensi (recompute telat/lokasi dari waktu baru)
  const saveEdit = async (rec, { timestamp, note, clearLocationWarn }) => {
    const d = new Date(timestamp);
    const flags = computeFlags(rec.type, d, { lat: rec.latitude, lng: rec.longitude }, effectiveAttConfig(config, rec.userId, d));
    if (clearLocationWarn) { flags.locationMismatch = false; }
    const updated = { ...rec, timestamp: d.toISOString(), note: (note || '').trim(), ...flags, editedBy: user.name, editedAt: new Date().toISOString() };
    const okSave = await storage.set(ATT_REC_PREFIX + updated.id, updated);
    if (!okSave) { alert('Gagal menyimpan perubahan absensi. Data lama tidak diubah.'); return; }
    await logActivity(`mengedit absensi ${rec.userName}`, user.name);
    setEditing(null);
    await load();
  };

  // Hapus semua absensi (owner/manajer) — termasuk semua foto selfie
  const deleteAllRecords = async () => {
    if (!confirm(`Hapus SEMUA data absensi (${records.length} rekaman)? Tindakan ini tidak bisa dibatalkan.`)) return;
    if (!confirm('Yakin 100%? Semua riwayat absen akan hilang permanen.')) return;
    const idx = (await storage.get('attendance:selfie-index')) || [];
    for (const it of idx) await storage.delete(it.key);
    await storage.set('attendance:selfie-index', []);
    await storage.deleteByPrefix(ATT_REC_PREFIX);
    await storage.delete('attendance:all'); // bersihkan sisa array lama bila masih ada
    await logActivity(`menghapus SEMUA data absensi (${records.length} rekaman)`, user.name);
    await load();
  };

  // Permission: siapa yang bisa dilihat
  const visibleRecords = useMemo(() => {
    let list = records;
    if (user.role === 'owner' || user.role === 'manajer') {
      // semua
    } else if (user.role === 'leader') {
      const teamIds = new Set(allUsers.filter(u => u.leaderId === user.id).map(u => u.id));
      teamIds.add(user.id);
      list = list.filter(r => teamIds.has(r.userId));
    } else {
      list = list.filter(r => r.userId === user.id);
    }
    if (filterDiv !== 'all') list = list.filter(r => (r.division || 'internal') === filterDiv);
    if (filterUser !== 'all') list = list.filter(r => r.userId === filterUser);
    if (filterDate) list = list.filter(r => wibDayKey(r.timestamp) === filterDate);
    return list;
  }, [records, user, allUsers, filterUser, filterDiv, filterDate]);

  // Ringkasan jumlah yang hadir pada tanggal terpilih (dihitung dari absen masuk, per orang unik)
  const presentSummary = useMemo(() => {
    if (!filterDate) return null;
    const hadir = new Set(visibleRecords.filter(r => r.type === 'in').map(r => r.userId));
    return { hadir: hadir.size };
  }, [filterDate, visibleRecords]);

  // Rekap harian: gabungkan absen masuk & pulang per orang per tanggal → 1 baris rapi
  const [openRow, setOpenRow] = useState(null);
  const dailyRows = useMemo(() => {
    const map = {};
    visibleRecords.forEach(r => {
      const d = wibDayKey(r.timestamp);
      const k = `${d}|${r.userId}`;
      if (!map[k]) map[k] = { key: k, date: d, userId: r.userId, userName: r.userName, division: r.division, ins: [], outs: [] };
      (r.type === 'in' ? map[k].ins : map[k].outs).push(r);
    });
    return Object.values(map).map(g => {
      g.ins.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      g.outs.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      const inRec = g.ins[0] || null;
      const outRec = g.outs.length ? g.outs[g.outs.length - 1] : null;
      const durMin = inRec && outRec ? Math.max(0, Math.round((new Date(outRec.timestamp) - new Date(inRec.timestamp)) / 60000)) : null;
      return { ...g, inRec, outRec, durMin };
    }).sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName));
  }, [visibleRecords]);
  const fmtDur = (m) => m == null ? '–' : `${Math.floor(m / 60)}j ${String(m % 60).padStart(2, '0')}m`;

  const canSeeOthers = user.role === 'owner' || user.role === 'manajer' || user.role === 'leader';
  const teamForFilter = useMemo(() => {
    if (user.role === 'owner' || user.role === 'manajer') return allUsers;
    if (user.role === 'leader') return allUsers.filter(u => u.leaderId === user.id || u.id === user.id);
    return [user];
  }, [allUsers, user]);

  // Export rekap absensi ke Excel (.xlsx) \u2014 RAPI: 1 baris per orang per hari (bukan per record),
  // jadi gampang dibaca di Excel (kolom otomatis, tidak nempel seperti CSV).
  const downloadRecap = async () => {
    if (visibleRecords.length === 0) { alert('Tidak ada data absensi pada filter ini untuk diexport.'); return; }
    try {
      const XLSX = await import('xlsx');
      // Gabung per orang per hari
      const map = {};
      visibleRecords.forEach(r => {
        const d = wibDayKey(r.timestamp);
        const k = `${d}|${r.userId}`;
        if (!map[k]) map[k] = { date: d, userName: r.userName, division: r.division, jobTitle: r.jobTitle, ins: [], outs: [] };
        (r.type === 'in' ? map[k].ins : map[k].outs).push(r);
      });
      const groups = Object.values(map).sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName));
      const header = ['Tanggal', 'Nama', 'Divisi', 'Jabatan', 'Jam Masuk', 'Jam Pulang', 'Durasi', 'Status', 'Catatan'];
      const aoa = [header];
      groups.forEach(g => {
        g.ins.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        g.outs.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        const inRec = g.ins[0] || null;
        const outRec = g.outs.length ? g.outs[g.outs.length - 1] : null;
        const durMin = inRec && outRec ? Math.max(0, Math.round((new Date(outRec.timestamp) - new Date(inRec.timestamp)) / 60000)) : null;
        const status = inRec ? (inRec.late ? 'Hadir (telat)' : 'Hadir') : 'Hanya pulang';
        const ket = [
          inRec?.late ? `Telat ${inRec.lateBy || ''}m` : '',
          outRec?.earlyLeave ? `Pulang cepat ${outRec.earlyBy || ''}m` : '',
          (inRec?.locationMismatch || outRec?.locationMismatch) ? 'Lokasi tidak sesuai' : '',
          (inRec?.note || outRec?.note || '')
        ].filter(Boolean).join(' \u00b7 ');
        aoa.push([
          fmtDate(g.date), g.userName,
          DIVISIONS[g.division]?.label || g.division || '-', g.jobTitle || '-',
          inRec ? fmtTime(inRec.timestamp) : '\u2013',
          outRec ? fmtTime(outRec.timestamp) : '\u2013',
          durMin == null ? '\u2013' : `${Math.floor(durMin / 60)}j ${String(durMin % 60).padStart(2, '0')}m`,
          status, ket
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 14 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');
      XLSX.writeFile(wb, `Rekap-Absensi-${dayKey()}.xlsx`);
    } catch (e) { alert('Gagal membuat Excel: ' + (e?.message || e)); }
  };

  const fmtTime = ts => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // ===== STATUS HARIAN TIM: per tanggal, siapa hadir / belum absen / tidak masuk / izin / libur =====
  const boardUsers = useMemo(() => {
    let list = teamForFilter;
    if (filterDiv !== 'all') list = list.filter(u => (u.division || 'internal') === filterDiv);
    if (filterUser !== 'all') list = list.filter(u => u.id === filterUser);
    return list;
  }, [teamForFilter, filterDiv, filterUser]);

  const dailyBoard = useMemo(() => {
    const todayK = wibDayKey();
    const dObj = new Date(boardDate + 'T00:00:00');
    const rows = boardUsers.map(u => {
      const leave = leaves.find(l => l.userId === u.id && l.status === 'approved' && l.date === boardDate);
      const ins = records.filter(r => r.userId === u.id && r.type === 'in' && wibDayKey(r.timestamp) === boardDate)
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      const outs = records.filter(r => r.userId === u.id && r.type === 'out' && wibDayKey(r.timestamp) === boardDate);
      if (ins.length) {
        const late = ins[0].late;
        return { u, key: 'hadir', label: late ? 'Hadir (telat)' : 'Hadir', sub: `Masuk ${fmtTime(ins[0].timestamp)}${outs.length ? ` · pulang ${fmtTime(outs[outs.length - 1].timestamp)}` : ''}`, color: late ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700', dot: late ? 'bg-amber-500' : 'bg-emerald-500' };
      }
      if (leave) return { u, key: 'izin', label: leave.type === 'sakit' ? 'Sakit' : 'Izin', sub: leave.reason || '', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', leave };
      const cfg = effectiveAttConfig(config, u.id, dObj);
      if (cfg.libur) return { u, key: 'libur', label: 'Libur', sub: 'jadwal libur', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' };
      if (boardDate > todayK) return { u, key: 'belum', label: '–', sub: 'belum waktunya', color: 'bg-slate-50 text-slate-400', dot: 'bg-slate-200' };
      if (boardDate === todayK) return { u, key: 'belumabsen', label: 'Belum absen', sub: 'hari ini', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' };
      return { u, key: 'alpa', label: 'Tidak masuk', sub: 'tanpa kabar', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
    });
    const count = { hadir: 0, izin: 0, belumabsen: 0, alpa: 0, libur: 0, belum: 0 };
    rows.forEach(r => { count[r.key] = (count[r.key] || 0) + 1; });
    const order = { hadir: 0, belumabsen: 1, alpa: 2, izin: 3, libur: 4, belum: 5 };
    rows.sort((a, b) => (order[a.key] - order[b.key]) || a.u.name.localeCompare(b.u.name));
    return { rows, count };
  }, [boardUsers, leaves, records, config, boardDate]);

  // Export Status Harian Tim ke Excel (.xlsx) — LENGKAP untuk tanggal terpilih:
  // semua anggota + status (Hadir / Hadir (telat) / Izin / Sakit / Tidak Masuk / Libur / Belum absen).
  const exportBoardExcel = async () => {
    if (!boardUsers.length) { alert('Tidak ada anggota pada filter ini untuk diexport.'); return; }
    try {
      const XLSX = await import('xlsx');
      const todayK = wibDayKey();
      const dObj = new Date(boardDate + 'T00:00:00');
      const header = ['Tanggal', 'Nama', 'Divisi', 'Jabatan', 'Status', 'Jam Masuk', 'Jam Pulang', 'Durasi', 'Keterangan'];
      const aoa = [header];
      // Urut: hadir → belum absen → tidak masuk → izin → libur, lalu nama
      const order = { 'Hadir': 0, 'Hadir (telat)': 0, 'Belum absen': 1, 'Tidak masuk': 2, 'Izin': 3, 'Sakit': 3, 'Libur': 4, 'Belum waktunya': 5 };
      const built = boardUsers.map(u => {
        const leave = leaves.find(l => l.userId === u.id && l.status === 'approved' && l.date === boardDate);
        const ins = records.filter(r => r.userId === u.id && r.type === 'in' && wibDayKey(r.timestamp) === boardDate).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        const outs = records.filter(r => r.userId === u.id && r.type === 'out' && wibDayKey(r.timestamp) === boardDate).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        const inRec = ins[0] || null;
        const outRec = outs.length ? outs[outs.length - 1] : null;
        const durMin = inRec && outRec ? Math.max(0, Math.round((new Date(outRec.timestamp) - new Date(inRec.timestamp)) / 60000)) : null;
        let status, ket = '';
        if (inRec) {
          status = inRec.late ? 'Hadir (telat)' : 'Hadir';
          ket = [inRec.late ? `Telat ${inRec.lateBy || ''}m` : '', outRec?.earlyLeave ? `Pulang cepat ${outRec.earlyBy || ''}m` : '', (inRec.note || outRec?.note || '')].filter(Boolean).join(' · ');
        } else if (leave) {
          status = leave.type === 'sakit' ? 'Sakit' : 'Izin'; ket = leave.reason || '';
        } else {
          const cfg = effectiveAttConfig(config, u.id, dObj);
          if (cfg.libur) status = 'Libur';
          else if (boardDate > todayK) status = 'Belum waktunya';
          else if (boardDate === todayK) status = 'Belum absen';
          else { status = 'Tidak masuk'; ket = 'tanpa kabar'; }
        }
        return { u, status, ket, inRec, outRec, durMin };
      }).sort((a, b) => (order[a.status] - order[b.status]) || a.u.name.localeCompare(b.u.name));
      built.forEach(({ u, status, ket, inRec, outRec, durMin }) => {
        aoa.push([
          fmtDate(boardDate), u.name,
          DIVISIONS[u.division]?.label || u.division || '-', u.jobTitle || '-',
          status,
          inRec ? fmtTime(inRec.timestamp) : '–',
          outRec ? fmtTime(outRec.timestamp) : '–',
          durMin == null ? '–' : `${Math.floor(durMin / 60)}j ${String(durMin % 60).padStart(2, '0')}m`,
          ket
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 28 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Status Harian');
      XLSX.writeFile(wb, `Status-Harian-${boardDate}.xlsx`);
    } catch (e) { alert('Gagal membuat Excel: ' + (e?.message || e)); }
  };

  // Hapus absensi: owner/manajer hapus semua, lainnya hanya miliknya
  const canDeleteRec = (r) => user.role === 'owner' || user.role === 'manajer' || r.userId === user.id;
  const canEditRec = (r) => user.role === 'owner' || user.role === 'manajer' || r.userId === user.id;
  const deleteRecord = async (r) => {
    if (!confirm(`Hapus absensi ${r.userName} (${r.type === 'in' ? 'masuk' : 'pulang'}) ${new Date(r.timestamp).toLocaleString('id-ID')}?`)) return;
    await storage.delete(ATT_REC_PREFIX + r.id);
    if (r.hasSelfie) {
      await storage.delete(`selfie:${r.id}`);
      const idx = (await storage.get('attendance:selfie-index')) || [];
      await storage.set('attendance:selfie-index', idx.filter(it => it.key !== `selfie:${r.id}`));
    }
    await logActivity(`menghapus 1 data absensi`, user.name);
    await load();
  };
  const fmtDate = ts => new Date(ts).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
  const osmEmbed = (lat, lng) => {
    const d = 0.004;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
  };

  // Kartu detail 1 record absen (dipakai tabel desktop & kartu mobile)
  const renderRecDetail = (label, rec) => (
                                <div key={label} className="bg-white rounded-xl border border-slate-200 p-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${label === 'Masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{label.toUpperCase()}</span>
                                    {rec ? (
                                      <>
                                        <span className="text-sm font-bold text-slate-800 tabular-nums">{fmtTime(rec.timestamp)}</span>
                                        {rec.editedBy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500" title={`Diedit oleh ${rec.editedBy}`}>diedit</span>}
                                        <span className="ml-auto flex items-center gap-0.5">
                                          {rec.hasSelfie && (
                                            <button onClick={() => viewSelfie(rec)} disabled={selfieLoading === rec.id} title="Lihat selfie"
                                              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition disabled:opacity-50">
                                              <Camera className="w-4 h-4" />
                                            </button>
                                          )}
                                          {rec.latitude && (
                                            <a href={mapsLink(rec.latitude, rec.longitude)} target="_blank" rel="noreferrer" title="Buka Maps"
                                              className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition">
                                              <MapPin className="w-4 h-4" />
                                            </a>
                                          )}
                                          {canEditRec(rec) && (
                                            <button onClick={() => setEditing(rec)} title="Edit"
                                              className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition">
                                              <Edit2 className="w-4 h-4" />
                                            </button>
                                          )}
                                          {canDeleteRec(rec) && (
                                            <button onClick={() => deleteRecord(rec)} title="Hapus"
                                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition">
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          )}
                                        </span>
                                      </>
                                    ) : <span className="text-xs text-slate-400">belum ada data</span>}
                                  </div>
                                  {rec && (
                                    <div className="mt-1.5 space-y-0.5">
                                      <div className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap">
                                        {rec.locationMismatch
                                          ? <span className="text-rose-600 font-semibold">Lokasi tidak sesuai{rec.distanceM != null ? ` (±${rec.distanceM}m dari lokasi kerja)` : ''}</span>
                                          : <span className="text-emerald-600 font-semibold">Lokasi sesuai</span>}
                                        {rec.hasSelfie ? null : (config.selfieWajib !== false && <span className="text-slate-400">· tanpa selfie</span>)}
                                        <a href={mapsLink(rec.latitude, rec.longitude)} target="_blank" rel="noreferrer"
                                          className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                                          Buka Maps <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </div>
                                      {rec.note && <div className="text-[11px] text-slate-600 italic">"{rec.note}"</div>}
                                    </div>
                                  )}
                                </div>
  );

  if (loading) return <div className="text-slate-400 text-sm">Memuat absensi...</div>;

  return (
    <div>
      <PageHeader title="Absensi" subtitle="Absen masuk & pulang dengan lokasi GPS otomatis" />

      {canManageAtt && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-700 text-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl transition">
            <Clock className="w-4 h-4" /> Atur Jam & Lokasi Kerja
          </button>
          <span className="text-xs text-slate-500">
            Jam kerja tim: <b className="text-slate-700">{config.jamMasuk}</b>–<b className="text-slate-700">{config.jamPulang}</b>
            {config.toleransiMenit ? ` · toleransi ${config.toleransiMenit} mnt` : ''}
            {config.lokasiAktif ? ` · lokasi: ${config.lokasiLabel || 'aktif'} (±${config.radiusM}m)` : ' · cek lokasi: nonaktif'}
            {config.selfieWajib !== false ? ' · selfie: wajib' : ' · selfie: nonaktif'}
            {Object.keys(config.custom || {}).length > 0 ? ` · ${Object.keys(config.custom).length} jadwal khusus` : ''}
          </span>
        </div>
      )}

      {/* Kartu absen */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 sm:p-6 mb-6 max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">{fmtDate(new Date().toISOString())}</div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {myToday.length === 0 ? (
                <span className="text-sm font-semibold text-slate-700">Belum absen hari ini</span>
              ) : (
                myToday.map(r => (
                  <span key={r.id} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${r.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.type === 'in' ? 'Masuk' : 'Pulang'} {fmtTime(r.timestamp)}
                  </span>
                ))
              )}
            </div>
          </div>
          {(() => {
            const my = effectiveAttConfig(config, user.id, new Date());
            return (
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Jam Kerja {HARI_ID[new Date().getDay()]}</div>
                <div className="text-sm font-bold text-slate-800">
                  {my.libur ? 'Libur' : my.flexible ? 'Fleksibel' : `${my.jamMasuk}–${my.jamPulang}`}
                </div>
                {(config.custom || {})[user.id] && <div className="text-[10px] text-blue-600 font-semibold">jadwal khusus</div>}
              </div>
            );
          })()}
        </div>

        <div className="mt-4">
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Catatan (opsional, mis. lokasi: kantor / WFH / lapangan)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-3" />

          <button onClick={() => doAbsen(nextType)} disabled={busy}
            style={{ background: nextType === 'in' ? 'linear-gradient(135deg, #2563EB, #1D4ED8)' : 'linear-gradient(135deg, #D97706, #B45309)' }}
            className="w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60">
            {config.selfieWajib !== false ? <Camera className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            {busy ? 'Mengambil lokasi...' : (nextType === 'in' ? 'Absen Masuk Sekarang' : 'Absen Pulang Sekarang')}
          </button>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            {config.selfieWajib !== false
              ? '📸 Saat ditekan: ambil selfie dulu, lalu browser minta izin lokasi. Izinkan keduanya.'
              : 'Saat ditekan, browser akan minta izin lokasi. Izinkan agar lokasi tersimpan.'}
          </p>
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}
          {result && (
            <div className={`mt-3 text-sm rounded-lg px-3 py-2.5 border ${result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="font-bold flex items-center gap-2">
                {result.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                Absen {result.type === 'in' ? 'masuk' : 'pulang'} tercatat {result.time}
                {result.ok && ' · tepat waktu ✓'}
              </div>
              {result.warns.length > 0 && (
                <ul className="mt-1.5 space-y-1 list-disc list-inside">
                  {result.warns.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
              {!result.ok && <div className="text-[11px] mt-1.5 opacity-80">Kalau ini keliru (mis. GPS error), Owner/Manajer bisa perbaiki lewat tombol edit di riwayat.</div>}
            </div>
          )}
        </div>
      </div>

      {/* Banner izin hari ini */}
      {approvedTodayLeave && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-800 max-w-2xl">
          ✋ Kamu <b>{approvedTodayLeave.type === 'sakit' ? 'izin sakit' : 'izin'}</b> hari ini (disetujui {approvedTodayLeave.decidedByName}). Tidak perlu absen.
        </div>
      )}

      {/* IZIN: pengajuan saya + persetujuan utk pengelola */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-display font-bold text-slate-900">Izin Saya</h3>
            <button onClick={() => setShowIzin(true)}
              className="bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 text-sm font-bold px-3.5 py-1.5 rounded-lg transition">
              + Ajukan Izin
            </button>
          </div>
          <div className="text-[11px] text-slate-400 mb-2">Izin biasa minimal H-{izinHmin} · sakit boleh hari-H · keputusan oleh Leader (atau Manajer bila Leader tidak ada) · izin yang disetujui tetap mengurangi poin KPI (kredit 50%), tanpa keterangan = 0.</div>
          {myLeaves.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">Belum ada pengajuan izin.</div>
          ) : (
            <div className="space-y-2">
              {myLeaves.map(l => (
                <div key={l.id} className="flex items-center gap-2 border border-slate-100 rounded-xl px-3 py-2">
                  <button onClick={() => setLeaveDetail(l)} className="flex items-center gap-2 flex-1 min-w-0 text-left group">
                    <span className="text-lg">{l.type === 'sakit' ? '🤒' : '✋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{fmtDate(l.date)} <span className="text-xs font-normal text-slate-500">· {l.type === 'sakit' ? 'Sakit' : 'Izin'}</span></div>
                      <div className="text-[11px] text-slate-500 truncate">{l.reason}{l.note ? ` · catatan: ${l.note}` : ''}</div>
                    </div>
                  </button>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {l.status === 'approved' ? 'Disetujui' : l.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                  </span>
                  {l.status === 'pending' && (
                    <button onClick={() => cancelIzin(l)} title="Batalkan" className="text-slate-300 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {(user.role === 'owner' || user.role === 'manajer' || user.role === 'leader') && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 sm:p-5">
            <h3 className="font-display font-bold text-slate-900 mb-3">Persetujuan Izin {pendingForMe.length > 0 && <span className="text-xs font-bold text-white bg-amber-500 rounded-full px-2 py-0.5 ml-1">{pendingForMe.length}</span>}</h3>
            {pendingForMe.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">Tidak ada pengajuan menunggu. ✓</div>
            ) : (
              <div className="space-y-2">
                {pendingForMe.map(l => (
                  <div key={l.id} className="border border-amber-100 bg-amber-50/50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLeaveDetail(l)} className="flex items-center gap-2 flex-1 min-w-0 text-left group">
                        <Avatar person={allUsers.find(u => u.id === l.userId) || { name: l.userName }} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700">{l.userName} · {fmtDate(l.date)}</div>
                          <div className="text-[11px] text-slate-500 truncate">{l.type === 'sakit' ? '🤒 Sakit' : '✋ Izin'} — {l.reason} · <span className="text-blue-600 font-semibold">lihat detail</span></div>
                        </div>
                      </button>
                      <button onClick={() => decideIzin(l, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Setujui</button>
                      <button onClick={() => decideIzin(l, 'rejected')}
                        className="bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded-lg">Tolak</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* STATUS HARIAN TIM — per tanggal: hadir / belum absen / tidak masuk / izin / libur */}
      {canSeeOthers && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h3 className="font-display font-bold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" /> Status Harian Tim</h3>
            <div className="flex items-center gap-2">
              <input type="date" value={boardDate} max={wibDayKey()} onChange={e => setBoardDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => setBoardDate(wibDayKey())}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Hari ini</button>
              <button onClick={exportBoardExcel}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mb-3">{new Date(boardDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {boardUsers.length} anggota{(filterDiv !== 'all' || filterUser !== 'all') ? ' (terfilter)' : ''}</div>
          {/* Ringkasan jumlah */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              ['hadir', 'Hadir', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
              ['belumabsen', 'Belum absen', 'bg-amber-50 text-amber-700 border-amber-200'],
              ['alpa', 'Tidak masuk', 'bg-red-50 text-red-700 border-red-200'],
              ['izin', 'Izin/Sakit', 'bg-blue-50 text-blue-700 border-blue-200'],
              ['libur', 'Libur', 'bg-slate-50 text-slate-500 border-slate-200'],
            ].map(([k, label, cls]) => (
              <div key={k} className={`px-3 py-1.5 rounded-xl border text-sm font-semibold ${cls}`}>
                {label}: <b className="tabular-nums">{dailyBoard.count[k] || 0}</b>
              </div>
            ))}
          </div>
          {/* Daftar anggota */}
          {dailyBoard.rows.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">Tidak ada anggota pada filter ini.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dailyBoard.rows.map(({ u, label, sub, color, dot, key, leave }) => (
                <div key={u.id} className="flex items-center gap-2.5 border border-slate-100 rounded-xl px-3 py-2">
                  <Avatar person={u} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{u.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{u.jobTitle || ROLES[u.role]?.label || ''}{sub ? ` · ${sub}` : ''}</div>
                  </div>
                  {leave ? (
                    <button onClick={() => setLeaveDetail(leave)} className={`text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 ${color} hover:opacity-80`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label} →
                    </button>
                  ) : (
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 ${color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter + Download (untuk leader/manajer/owner) */}
      {canSeeOthers && (
        <div className="mb-4 flex items-center gap-2 flex-wrap bg-white rounded-xl border border-slate-200 p-3">
          <span className="text-xs text-slate-500 font-semibold">Filter:</span>
          {(user.role === 'owner' || user.role === 'manajer') && (
            <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Semua divisi</option>
              {Object.entries(DIVISIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Semua anggota</option>
            {teamForFilter.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button onClick={downloadRecap} disabled={visibleRecords.length === 0}
            className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel ({visibleRecords.length})
          </button>
          {canManageAtt && (
            <button onClick={deleteAllRecords} disabled={records.length === 0}
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Hapus Semua
            </button>
          )}
        </div>
      )}

      {/* Riwayat absensi — tabel rekap harian (Tanggal · Nama · Masuk · Pulang · Durasi · Status) */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="font-display font-bold text-slate-900">Riwayat Absensi</h3>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-semibold">Tanggal:</span>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setFilterDate(wibDayKey())}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Hari ini</button>
          {filterDate && (
            <button onClick={() => setFilterDate('')}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-500">Semua</button>
          )}
        </div>
      </div>
      {presentSummary && (
        <div className="mb-3 flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          <Users className="w-4 h-4 text-emerald-600" />
          <span className="text-slate-700">
            <b className="text-emerald-700">{presentSummary.hadir} orang</b> hadir pada {new Date(filterDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      )}
      {visibleRecords.length === 0 ? (
        <EmptyState icon={MapPin} text="Belum ada data absensi." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
          {/* MOBILE: kartu ringkas per orang per hari */}
          <div className="md:hidden divide-y divide-slate-100">
            {dailyRows.map(row => {
              const open = openRow === row.key;
              const anyMismatch = (row.inRec?.locationMismatch || row.outRec?.locationMismatch);
              const chips = [];
              if (row.inRec?.late) chips.push({ t: `Telat ${row.inRec.lateBy || ''}m`, c: 'bg-red-100 text-red-700' });
              if (row.outRec?.earlyLeave) chips.push({ t: `Pulang cepat ${row.outRec.earlyBy || ''}m`, c: 'bg-amber-100 text-amber-700' });
              if (anyMismatch) chips.push({ t: 'Lokasi ✗', c: 'bg-rose-100 text-rose-700' });
              if (chips.length === 0 && row.inRec) chips.push({ t: row.outRec ? '✓ Tepat waktu' : 'Belum pulang', c: row.outRec ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700' });
              return (
                <div key={row.key} className="p-3.5">
                  <button onClick={() => setOpenRow(open ? null : row.key)} className="w-full text-left">
                    <div className="flex items-center gap-2.5">
                      <Avatar person={allUsers.find(u => u.id === row.userId) || { name: row.userName }} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{row.userName}</div>
                        <div className="text-[11px] text-slate-500">{new Date(row.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2.5">
                      <div className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Masuk</div>
                        <div className={`text-sm font-bold tabular-nums ${row.inRec ? (row.inRec.late ? 'text-red-600' : 'text-emerald-700') : 'text-slate-300'}`}>{row.inRec ? fmtTime(row.inRec.timestamp) : '–'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Pulang</div>
                        <div className={`text-sm font-bold tabular-nums ${row.outRec ? (row.outRec.earlyLeave ? 'text-amber-600' : 'text-slate-700') : 'text-slate-300'}`}>{row.outRec ? fmtTime(row.outRec.timestamp) : '–'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Durasi</div>
                        <div className="text-sm font-bold tabular-nums text-slate-700">{fmtDur(row.durMin)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-2">
                      {chips.map((ch, i) => <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ch.c}`}>{ch.t}</span>)}
                    </div>
                  </button>
                  {open && (
                    <div className="mt-3 space-y-2.5">
                      {[['Masuk', row.inRec], ['Pulang', row.outRec]].map(([label, rec]) => renderRecDetail(label, rec))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP/TABLET LEBAR: tabel */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-bold">Tanggal</th>
                  <th className="text-left px-3 py-2.5 font-bold">Nama</th>
                  <th className="text-left px-3 py-2.5 font-bold">Masuk</th>
                  <th className="text-left px-3 py-2.5 font-bold">Pulang</th>
                  <th className="text-left px-3 py-2.5 font-bold">Durasi</th>
                  <th className="text-left px-3 py-2.5 font-bold">Status</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map(row => {
                  const open = openRow === row.key;
                  const anyMismatch = (row.inRec?.locationMismatch || row.outRec?.locationMismatch);
                  const chips = [];
                  if (row.inRec?.late) chips.push({ t: `Telat ${row.inRec.lateBy || ''}m`, c: 'bg-red-100 text-red-700' });
                  if (row.outRec?.earlyLeave) chips.push({ t: `Pulang cepat ${row.outRec.earlyBy || ''}m`, c: 'bg-amber-100 text-amber-700' });
                  if (anyMismatch) chips.push({ t: 'Lokasi ✗', c: 'bg-rose-100 text-rose-700' });
                  if (chips.length === 0 && row.inRec) chips.push({ t: row.outRec ? '✓ Tepat waktu' : 'Belum pulang', c: row.outRec ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700' });
                  return (
                    <React.Fragment key={row.key}>
                      <tr onClick={() => setOpenRow(open ? null : row.key)}
                        className={`border-t border-slate-100 cursor-pointer transition ${open ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{new Date(row.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar person={allUsers.find(u => u.id === row.userId) || { name: row.userName }} size="sm" />
                            <span className="font-semibold text-slate-900 truncate">{row.userName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {row.inRec ? (
                            <span className={`font-semibold tabular-nums ${row.inRec.late ? 'text-red-600' : 'text-emerald-700'}`}>{fmtTime(row.inRec.timestamp)}</span>
                          ) : <span className="text-slate-300">–</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {row.outRec ? (
                            <span className={`font-semibold tabular-nums ${row.outRec.earlyLeave ? 'text-amber-600' : 'text-slate-700'}`}>{fmtTime(row.outRec.timestamp)}</span>
                          ) : <span className="text-slate-300">–</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 tabular-nums whitespace-nowrap">{fmtDur(row.durMin)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            {chips.map((ch, i) => <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${ch.c}`}>{ch.t}</span>)}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <ChevronDown className={`w-4 h-4 text-slate-400 inline-block transition-transform ${open ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-t border-blue-100 bg-blue-50/30">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {[['Masuk', row.inRec], ['Pulang', row.outRec]].map(([label, rec]) => renderRecDetail(label, rec))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">
            Klik baris untuk lihat detail: lokasi sesuai/tidak, link Maps, selfie, edit & hapus.
          </div>
        </div>
      )}

      {showSettings && (
        <AttendanceSettingsModal config={config} allUsers={allUsers} onSave={saveConfig} onClose={() => setShowSettings(false)} getLocation={getLocation} />
      )}
      {editing && (
        <AttendanceEditModal record={editing} config={effectiveAttConfig(config, editing.userId, new Date(editing.timestamp))} toLocalInput={toLocalInput} canManage={canManageAtt} onSave={saveEdit} onClose={() => setEditing(null)} />
      )}
      {showIzin && (
        <LeaveRequestModal izinHmin={izinHmin} onSave={submitIzin} onClose={() => setShowIzin(false)} />
      )}
      {leaveDetail && (
        <LeaveDetailModal leave={leaveDetail} person={allUsers.find(u => u.id === leaveDetail.userId)}
          canDecide={canDecideLeave(leaveDetail) && leaveDetail.status === 'pending'}
          canCancel={leaveDetail.userId === user.id && leaveDetail.status === 'pending'}
          onApprove={() => decideIzin(leaveDetail, 'approved')}
          onReject={() => decideIzin(leaveDetail, 'rejected')}
          onCancel={() => cancelIzin(leaveDetail)}
          onClose={() => setLeaveDetail(null)} />
      )}
      {selfieFor && (
        <SelfieCaptureModal type={selfieFor} userName={user.name}
          onCapture={(img) => proceedAbsen(selfieFor, img)}
          onClose={() => setSelfieFor(null)} />
      )}
      {lightbox && <ImageLightbox src={lightbox.src} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// Modal detail izin — dibuka oleh penerima/pemberi keputusan (atau pengaju) untuk lihat detail + aksi
function LeaveDetailModal({ leave, person, canDecide, canCancel, onApprove, onReject, onCancel, onClose }) {
  const statusBadge = leave.status === 'approved'
    ? { t: 'Disetujui', c: 'bg-emerald-100 text-emerald-700' }
    : leave.status === 'rejected'
      ? { t: 'Ditolak', c: 'bg-red-100 text-red-700' }
      : { t: 'Menunggu keputusan', c: 'bg-amber-100 text-amber-700' };
  return (
    <Modal title="Detail Pengajuan Izin" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar person={person || { name: leave.userName }} size="md" />
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-slate-900">{leave.userName}</div>
            <div className="text-xs text-slate-500">{person?.jobTitle || ROLES[person?.role]?.label || ''}{person?.division ? ` · ${DIVISIONS[person.division]?.label || person.division}` : ''}</div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusBadge.c}`}>{statusBadge.t}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-slate-500">Jenis</div>
            <div className="font-semibold text-slate-800 mt-0.5">{leave.type === 'sakit' ? '🤒 Sakit' : '✋ Izin'}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-slate-500">Tanggal Izin</div>
            <div className="font-semibold text-slate-800 mt-0.5">{fmtDate(leave.date)}</div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Alasan / Keterangan</div>
          <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{leave.reason || <span className="text-slate-400 italic">Tanpa keterangan</span>}</div>
        </div>

        <div className="text-[11px] text-slate-500 space-y-0.5 border-t border-slate-100 pt-3">
          <div>Diajukan: {fmtDateTime(leave.createdAt)}</div>
          {leave.decidedAt && <div>Diputuskan: {fmtDateTime(leave.decidedAt)} oleh <b>{leave.decidedByName || '-'}</b></div>}
          {leave.status === 'rejected' && leave.note && <div className="text-red-600">Alasan penolakan: {leave.note}</div>}
        </div>

        {canDecide && (
          <div className="flex gap-2 pt-1">
            <button onClick={onApprove} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm">✓ Setujui</button>
            <button onClick={onReject} className="flex-1 bg-white border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg font-bold text-sm">✕ Tolak</button>
          </div>
        )}
        {!canDecide && canCancel && (
          <button onClick={onCancel} className="w-full bg-white border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg font-bold text-sm">Batalkan Pengajuan</button>
        )}
        {!canDecide && !canCancel && (
          <button onClick={onClose} className="w-full px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">Tutup</button>
        )}
      </div>
    </Modal>
  );
}

// Modal pengajuan izin (H-n untuk izin biasa, sakit boleh hari-H)
function LeaveRequestModal({ izinHmin, onSave, onClose }) {
  const minIzin = dayKey(new Date(Date.now() + izinHmin * 86400000));
  const [form, setForm] = useState({ type: 'izin', date: '', reason: '' });
  const [error, setError] = useState('');
  const minDate = form.type === 'sakit' ? dayKey() : minIzin;
  const submit = () => {
    setError('');
    if (!form.date) return setError('Pilih tanggal izin.');
    if (!form.reason.trim()) return setError('Tulis alasan izin.');
    if (form.type === 'izin' && form.date < minIzin) return setError(`Izin biasa harus diajukan minimal H-${izinHmin} (paling cepat ${fmtDate(minIzin)}). Kalau mendadak karena sakit, pilih jenis "Sakit".`);
    if (form.type === 'sakit' && form.date < dayKey()) return setError('Tanggal tidak boleh di masa lalu.');
    onSave({ type: form.type, date: form.date, reason: form.reason.trim() });
  };
  return (
    <Modal title="Ajukan Izin" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Jenis">
          <div className="grid grid-cols-2 gap-2">
            {[['izin', '✋ Izin', `minimal H-${izinHmin}`], ['sakit', '🤒 Sakit', 'boleh hari-H']].map(([k, label, sub]) => (
              <button key={k} onClick={() => setForm({ ...form, type: k })}
                className={`px-3 py-2.5 rounded-xl border-2 text-left transition ${form.type === k ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className={`text-sm font-bold ${form.type === k ? 'text-blue-700' : 'text-slate-700'}`}>{label}</div>
                <div className="text-[10px] text-slate-500">{sub}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tanggal Izin *">
          <input type="date" value={form.date} min={minDate} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Alasan *">
          <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3}
            placeholder="mis. acara keluarga / kontrol ke dokter"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Pengajuan dikirim ke Leader-mu (atau Manajer/Owner bila Leader tidak ada). Izin disetujui = kredit kehadiran 50% di KPI; tanpa keterangan = 0.</div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel="Kirim Pengajuan" />
      </div>
    </Modal>
  );
}

// Modal kamera selfie untuk absen (wajib, anti-kecurangan)
function SelfieCaptureModal({ type, userName, onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [camErr, setCamErr] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser tidak mendukung kamera.');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        setCamErr(e.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Aktifkan izin kamera di browser (ikon gembok di address bar) lalu coba lagi.'
          : (e.message || 'Gagal membuka kamera.'));
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const MAX = 480;
    const scale = Math.min(1, MAX / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    // mirror seperti kaca biar natural
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    setSnapshot(canvas.toDataURL('image/jpeg', 0.65));
  };

  const stopCam = () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };

  return (
    <Modal title={`📸 Selfie Absen ${type === 'in' ? 'Masuk' : 'Pulang'}`} onClose={() => { stopCam(); onClose(); }}>
      <div className="space-y-3">
        <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          Hai <b>{userName.split(' ')[0]}</b> — posisikan wajah di tengah, lalu ambil foto. Foto jadi bukti kehadiranmu.
        </div>
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3]">
          {camErr ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-300">{camErr}</div>
          ) : snapshot ? (
            <img src={snapshot} alt="Selfie" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          )}
          {!camErr && !snapshot && !ready && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">Membuka kamera…</div>
          )}
        </div>
        {camErr ? (
          <FormActions onCancel={() => { stopCam(); onClose(); }} onSave={() => window.location.reload()} saveLabel="Muat Ulang Halaman" />
        ) : snapshot ? (
          <div className="flex gap-2">
            <button onClick={() => setSnapshot(null)}
              className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-lg">↺ Ulangi</button>
            <button onClick={() => { stopCam(); onCapture(snapshot); }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Gunakan & Lanjut Absen
            </button>
          </div>
        ) : (
          <button onClick={takePhoto} disabled={!ready}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            <Camera className="w-5 h-5" /> Ambil Foto
          </button>
        )}
      </div>
    </Modal>
  );
}

// Modal: atur jam kerja & lokasi kerja (owner/manajer)
function AttendanceSettingsModal({ config, allUsers = [], onSave, onClose, getLocation }) {
  const [form, setForm] = useState({
    ...DEFAULT_ATTENDANCE_CONFIG, ...config,
    custom: { ...(config.custom || {}) },
    perDay: config.perDay ? { enabled: config.perDay.enabled, days: { ...DEFAULT_ATTENDANCE_CONFIG.perDay.days, ...(config.perDay.days || {}) } } : { ...DEFAULT_ATTENDANCE_CONFIG.perDay, days: { ...DEFAULT_ATTENDANCE_CONFIG.perDay.days } }
  });
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState('');
  const [pickUserId, setPickUserId] = useState('');

  // Edit jadwal per hari (0=Min..6=Sab)
  const setDay = (d, key, val) => setForm(f => ({ ...f, perDay: { ...f.perDay, days: { ...f.perDay.days, [d]: { ...f.perDay.days[d], [key]: val } } } }));
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  // Jadwal khusus per karyawan (freelance / shift beda)
  const customIds = Object.keys(form.custom || {});
  const availableUsers = allUsers.filter(u => !customIds.includes(u.id));
  const addCustom = () => {
    if (!pickUserId) return;
    setForm({ ...form, custom: { ...form.custom, [pickUserId]: { jamMasuk: form.jamMasuk, jamPulang: form.jamPulang, toleransiMenit: form.toleransiMenit, flexible: false } } });
    setPickUserId('');
  };
  const setCustom = (id, key, val) => setForm({ ...form, custom: { ...form.custom, [id]: { ...form.custom[id], [key]: val } } });
  const removeCustom = (id) => {
    const next = { ...form.custom };
    delete next[id];
    setForm({ ...form, custom: next });
  };

  const pakaiLokasiSaya = async () => {
    setLocErr(''); setLocBusy(true);
    try {
      const loc = await getLocation();
      setForm(f => ({ ...f, lokasiLat: loc.lat, lokasiLng: loc.lng, lokasiAktif: true }));
    } catch (e) { setLocErr(e.message || 'Gagal ambil lokasi.'); }
    setLocBusy(false);
  };

  return (
    <Modal title="Atur Jam & Lokasi Kerja" onClose={onClose}>
      <div className="space-y-4">
        {/* Jadwal jam kerja per hari */}
        <div className="border border-slate-200 rounded-xl p-3">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={form.perDay.enabled}
              onChange={e => setForm({ ...form, perDay: { ...form.perDay, enabled: e.target.checked } })}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm font-semibold text-slate-800">Jam kerja beda tiap hari</span>
          </label>
          {form.perDay.enabled ? (
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-500 mb-1">Mis. Sen–Jum 08:00–17:00, Sabtu 08:00–15:00, Minggu libur. Centang "Libur" untuk hari tanpa kerja.</div>
              {dayOrder.map(d => {
                const day = form.perDay.days[d] || {};
                return (
                  <div key={d} className="flex items-center gap-2 flex-wrap">
                    <span className="w-14 text-xs font-bold text-slate-700">{HARI_ID[d]}</span>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500">
                      <input type="checkbox" checked={!!day.libur} onChange={e => setDay(d, 'libur', e.target.checked)} className="w-3.5 h-3.5 accent-blue-600 rounded" /> Libur
                    </label>
                    {!day.libur && (
                      <>
                        <input type="time" value={day.jamMasuk || '08:00'} onChange={e => setDay(d, 'jamMasuk', e.target.value)}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-xs" />
                        <span className="text-xs text-slate-400">–</span>
                        <input type="time" value={day.jamPulang || '17:00'} onChange={e => setDay(d, 'jamPulang', e.target.value)}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-xs" />
                      </>
                    )}
                    {day.libur && <span className="text-[11px] text-slate-400 italic">tidak dihitung telat/pulang cepat</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jam Masuk">
                <input type="time" value={form.jamMasuk} onChange={e => setForm({ ...form, jamMasuk: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              <Field label="Jam Pulang">
                <input type="time" value={form.jamPulang} onChange={e => setForm({ ...form, jamPulang: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
            </div>
          )}
        </div>
        <Field label="Toleransi telat (menit)">
          <input type="number" min="0" value={form.toleransiMenit} onChange={e => setForm({ ...form, toleransiMenit: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="text-[11px] text-slate-500 mt-1">Absen masuk lewat dari jam masuk + toleransi = ditandai "Terlambat".</div>
        </Field>
        <Field label="Pengajuan izin minimal H-">
          <input type="number" min="0" value={form.izinHmin ?? 1} onChange={e => setForm({ ...form, izinHmin: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="text-[11px] text-slate-500 mt-1">Izin biasa wajib diajukan minimal sekian hari sebelumnya. Jenis "Sakit" boleh hari-H.</div>
        </Field>

        {/* Selfie wajib */}
        <div className="border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.selfieWajib !== false} onChange={e => setForm({ ...form, selfieWajib: e.target.checked })}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Camera className="w-4 h-4 text-blue-600" /> Wajib selfie saat absen</span>
          </label>
          <div className="text-[11px] text-slate-500 mt-1">Anggota harus ambil foto wajah sebelum absen masuk/pulang — mencegah titip absen. Foto otomatis dihapus setelah 60 hari.</div>
        </div>

        {/* Jadwal khusus per karyawan */}
        <div className="border-t border-slate-100 pt-4">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-1"><Clock className="w-4 h-4 text-blue-600" /> Jam Kerja Khusus per Karyawan</div>
          <div className="text-[11px] text-slate-500 mb-2">Untuk freelance / shift yang jamnya beda dari tim. Yang tidak diatur di sini ikut jam kerja tim di atas.</div>

          {customIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {customIds.map(id => {
                const u = allUsers.find(x => x.id === id);
                const c = form.custom[id];
                return (
                  <div key={id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-bold text-slate-800 truncate">{u?.name || 'User terhapus'}</span>
                      <button onClick={() => removeCustom(id)} title="Hapus jadwal khusus (kembali ikut jam tim)"
                        className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={!!c.flexible} onChange={e => setCustom(id, 'flexible', e.target.checked)}
                        className="w-4 h-4 rounded accent-blue-600" />
                      <span className="text-xs text-slate-700"><b>Jam fleksibel</b> (freelance) — tidak pernah ditandai telat/pulang cepat</span>
                    </label>
                    {!c.flexible && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Masuk</div>
                          <input type="time" value={c.jamMasuk || ''} onChange={e => setCustom(id, 'jamMasuk', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Pulang</div>
                          <input type="time" value={c.jamPulang || ''} onChange={e => setCustom(id, 'jamPulang', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Toleransi</div>
                          <input type="number" min="0" value={c.toleransiMenit ?? ''} placeholder={String(form.toleransiMenit)}
                            onChange={e => setCustom(id, 'toleransiMenit', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <select value={pickUserId} onChange={e => setPickUserId(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">- Pilih anggota untuk jadwal khusus -</option>
              {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}{u.jobTitle ? ` · ${u.jobTitle}` : ''}</option>)}
            </select>
            <button onClick={addCustom} disabled={!pickUserId}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg">Tambah</button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.lokasiAktif} onChange={e => setForm({ ...form, lokasiAktif: e.target.checked })}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm font-semibold text-slate-800">Aktifkan pengecekan lokasi kerja</span>
          </label>
          <div className="text-[11px] text-slate-500 mt-1">Kalau aktif, absen di luar radius lokasi kerja akan ditandai "Lokasi tidak sesuai".</div>
        </div>

        {form.lokasiAktif && (
          <div className="space-y-3 bg-slate-50 rounded-xl p-3">
            <Field label="Nama lokasi (mis. Kantor Al-Kahfi)">
              <input type="text" value={form.lokasiLabel} onChange={e => setForm({ ...form, lokasiLabel: e.target.value })}
                placeholder="Kantor Al-Kahfi"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <input type="number" step="any" value={form.lokasiLat ?? ''} onChange={e => setForm({ ...form, lokasiLat: e.target.value === '' ? null : Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </Field>
              <Field label="Longitude">
                <input type="number" step="any" value={form.lokasiLng ?? ''} onChange={e => setForm({ ...form, lokasiLng: e.target.value === '' ? null : Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </Field>
            </div>
            <button onClick={pakaiLokasiSaya} disabled={locBusy}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-2">
              <MapPin className="w-4 h-4" /> {locBusy ? 'Mengambil lokasi…' : 'Pakai lokasi saya sekarang'}
            </button>
            {locErr && <div className="text-xs text-red-600">{locErr}</div>}
            <Field label="Radius toleransi (meter)">
              <input type="number" min="20" value={form.radiusM} onChange={e => setForm({ ...form, radiusM: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <div className="text-[11px] text-slate-500 mt-1">Mis. 200 m. Absen di luar jarak ini dari titik lokasi = "Lokasi tidak sesuai".</div>
            </Field>
          </div>
        )}

        <FormActions onCancel={onClose} onSave={() => onSave(form)} saveLabel="Simpan Pengaturan" />
      </div>
    </Modal>
  );
}

// Modal: edit satu data absensi
function AttendanceEditModal({ record, config, toLocalInput, canManage, onSave, onClose }) {
  const [dt, setDt] = useState(toLocalInput(record.timestamp));
  const [note, setNote] = useState(record.note || '');
  const [clearLoc, setClearLoc] = useState(false);

  return (
    <Modal title={`Edit Absensi — ${record.userName}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600">
          {record.type === 'in' ? 'Absen MASUK' : 'Absen PULANG'} · jam kerja {config.jamMasuk}–{config.jamPulang}
        </div>
        <Field label="Tanggal & Jam">
          <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="text-[11px] text-slate-500 mt-1">Status "Terlambat/Pulang cepat" otomatis dihitung ulang dari jam baru.</div>
        </Field>
        <Field label="Catatan">
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="mis. lupa absen, GPS error, dll"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        {record.locationMismatch && canManage && (
          <label className="flex items-center gap-2 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <input type="checkbox" checked={clearLoc} onChange={e => setClearLoc(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-xs text-amber-800">Tandai lokasi sudah benar (hapus peringatan "Lokasi tidak sesuai")</span>
          </label>
        )}
        <FormActions onCancel={onClose} onSave={() => onSave(record, { timestamp: dt, note, clearLocationWarn: clearLoc })} saveLabel="Simpan Perubahan" />
      </div>
    </Modal>
  );
}

function LeaderboardView({ allUsers }) {
  const [data, setData] = useState(null);
  const [cfg, setCfg] = useState(DEFAULT_KPI_CONFIG);
  const mKey = monthKey();

  useEffect(() => {
    (async () => {
      const [tasks, attendance, reports, gmvEntries, gmvTargets, affAccounts, affEntries, templates, leaves, savedCfg] = await Promise.all([
        loadTasks(), loadAttendanceRecs(), loadDailyReports(),
        loadGmvEntries(), storage.get('gmv:targets'), storage.getList('affiliate-accounts:all'),
        loadAffEntries(), storage.getList('daily-report-templates:all'), loadLeaves(), storage.get('kpi:config')
      ]);
      setData({ tasks, attendance, reports, gmvEntries, gmvTargets: gmvTargets || {}, affAccounts, affEntries, allUsers, templates, leaves });
      setCfg(normalizeKpiConfig(savedCfg));
    })();
  }, [allUsers]);

  if (!data) return <div className="text-slate-400 text-sm">Memuat leaderboard...</div>;

  // Owner (mis. Azka & Kholid) tidak ikut kompetisi leaderboard. Ranking = skor KPI bulan ini.
  const targetScore = cfg.targetScore || 85;
  const teamStats = allUsers.filter(m => m.role !== 'owner').map(m => ({
    ...m, kpi: computeKpi(m.id, data, mKey, cfg)
  })).sort((a, b) => b.kpi.total - a.kpi.total);
  const monthLabel = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-5xl">
      <PageHeader title="Leaderboard" subtitle={`Kompetisi sehat berbasis skor KPI · ${monthLabel} · ≥${targetScore} = Mumtaz ⭐`} />
      <div className="space-y-2">
        {teamStats.map((m, i) => {
          const k = m.kpi;
          const isMumtaz = k.total >= targetScore;
          return (
            <div key={m.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${i < 3 && k.total > 0 ? 'border-blue-200 bg-gradient-to-r from-blue-50/30 to-transparent' : 'border-slate-200'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-lg flex-shrink-0 ${
                k.total > 0 && i === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-white' :
                k.total > 0 && i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                k.total > 0 && i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                'bg-slate-100 text-slate-600'
              }`}>{k.total > 0 && i === 0 ? '🥇' : k.total > 0 && i === 1 ? '🥈' : k.total > 0 && i === 2 ? '🥉' : `#${i + 1}`}</div>
              <Avatar person={m} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">{m.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {displayJobTitle(m) && <span className="text-[10px] inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{displayJobTitle(m)}</span>}
                  <span className={`text-[10px] inline-block px-2 py-0.5 rounded ${ROLES[m.role]?.color}`}>{ROLES[m.role]?.label}</span>
                  {m.division && DIVISIONS[m.division] && (
                    <span className={`text-[10px] inline-block px-2 py-0.5 rounded ${DIVISIONS[m.division].color}`}>{DIVISIONS[m.division].label}</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Hadir {k.attendance.days} hari · {k.tasks.done} tugas selesai · lapor {k.reports.days} hari{k.target.applicable ? ` · target ${k.target.attain}%` : ''}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`font-display font-bold text-2xl ${isMumtaz ? 'text-emerald-600' : k.total >= targetScore * 0.7 ? 'text-amber-600' : 'text-slate-700'}`}>{k.total}</div>
                <div className="text-[10px] text-slate-500">{isMumtaz ? '⭐ Mumtaz' : 'poin KPI'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ ANNOUNCEMENTS ============
function AnnouncementsView({ user }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  const load = async () => setItems(await storage.getList('announcements:all'));
  useEffect(() => {
    load();
    const iv = setInterval(load, 12000);
    return () => clearInterval(iv);
  }, []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    const list = await storage.getList('announcements:all');
    list.unshift({ id: uid(), title: form.title, content: form.content, authorId: user.id, authorName: user.name, createdAt: new Date().toISOString() });
    await storage.set('announcements:all', list);
    await logActivity(`mengirim pengumuman: "${form.title}"`, user.name);
    setForm({ title: '', content: '' }); setShowForm(false); load();
  };
  const handleDelete = async (a) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    const list = (await storage.getList('announcements:all')).filter(x => x.id !== a.id);
    await storage.set('announcements:all', list);
    load();
  };
  const handleClearAll = async () => {
    if (!confirm('Bersihkan SEMUA pengumuman? Tindakan ini tidak bisa dibatalkan.')) return;
    await storage.set('announcements:all', []);
    await logActivity('membersihkan semua pengumuman', user.name);
    load();
  };

  const canClear = (user.role === 'owner' || user.role === 'manajer');

  return (
    <div className="max-w-3xl">
      <PageHeader title="Pengumuman Tim" subtitle="Info penting dari pimpinan ke seluruh tim"
        action={can.postAnnouncements(user) ? (
          <div className="flex items-center gap-2">
            {canClear && items.length > 0 && (
              <button onClick={handleClearAll}
                className="border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Bersihkan Semua</span>
              </button>
            )}
            <button onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Buat Pengumuman</span><span className="sm:hidden">Buat</span>
            </button>
          </div>
        ) : null} />
      {items.length === 0 ? <EmptyState icon={Megaphone} text="Belum ada pengumuman." /> : (
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between mb-2 gap-2">
                <h4 className="font-display font-bold text-slate-900 text-lg">{a.title}</h4>
                {(a.authorId === user.id || (user.role === 'manajer' || user.role === 'owner')) && (
                  <button onClick={() => handleDelete(a)} className="text-slate-400 hover:text-red-600 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap">{a.content}</div>
              <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                — {a.authorName} · {fmtDateTime(a.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <Modal title="Pengumuman Baru" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Field label="Judul *">
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </Field>
            <Field label="Isi Pengumuman *">
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                rows={6} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
            </Field>
            <FormActions onCancel={() => setShowForm(false)} onSave={handleSave} disabled={!form.title.trim() || !form.content.trim()} saveLabel="Kirim" />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ CONTENT IDEAS (Bank Ide Konten) ============
function ContentIdeasView({ user, allUsers, settings }) {
  const [items, setItems] = useState([]);
  const [creators, setCreators] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [filter, setFilter] = useState({ status: 'all', format: 'all', search: '' });

  const load = async () => {
    setItems(await storage.getList('content-ideas:all'));
    setCreators(await storage.getList('creators:all'));
  };
  useEffect(() => { load(); }, []);

  const canEditIdea = (idea) => idea.proposedById === user.id || (user.role === 'manajer' || user.role === 'owner');
  const canApprove = (user.role === 'manajer' || user.role === 'owner') || user.role === 'leader';
  const canExecute = (idea) => idea.assignedToId === user.id || (user.role === 'manajer' || user.role === 'owner');

  const handleSave = async (data) => {
    let list = await storage.getList('content-ideas:all');
    if (editing) {
      list = list.map(i => i.id === editing.id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i);
    } else {
      list.unshift({
        id: uid(), ...data,
        status: 'idea',
        proposedById: user.id, proposedByName: user.name,
        proposedAt: new Date().toISOString()
      });
      await logActivity(`mengusulkan ide konten "${data.title}"`, user.name);
    }
    await storage.set('content-ideas:all', list);
    setShowForm(false); setEditing(null); load();
  };

  const handleDelete = async (idea) => {
    if (!confirm(`Hapus ide "${idea.title}"?`)) return;
    const list = (await storage.getList('content-ideas:all')).filter(i => i.id !== idea.id);
    await storage.set('content-ideas:all', list);
    load();
  };

  const handleApprove = async ({ assignedToId, targetDate, assignNotes }) => {
    const assignee = allUsers.find(u => u.id === assignedToId);
    const list = (await storage.getList('content-ideas:all')).map(i =>
      i.id === assigning.id ? {
        ...i, status: 'approved',
        assignedToId, assignedToName: assignee?.name || '-',
        targetDate, assignNotes,
        approvedById: user.id, approvedByName: user.name, approvedAt: new Date().toISOString()
      } : i
    );
    await storage.set('content-ideas:all', list);
    await logActivity(`menyetujui ide "${assigning.title}" → ${assignee?.name}`, user.name);
    setAssigning(null); load();
  };

  const handleStartProduction = async (idea) => {
    const list = (await storage.getList('content-ideas:all')).map(i =>
      i.id === idea.id ? { ...i, status: 'in_progress', startedAt: new Date().toISOString() } : i
    );
    await storage.set('content-ideas:all', list);
    await logActivity(`mulai produksi konten "${idea.title}"`, user.name);
    load();
  };

  const handlePublish = async ({ publishedUrl, publishNotes }) => {
    const list = (await storage.getList('content-ideas:all')).map(i =>
      i.id === publishing.id ? {
        ...i, status: 'published',
        publishedUrl, publishNotes,
        publishedAt: new Date().toISOString()
      } : i
    );
    await storage.set('content-ideas:all', list);
    await logActivity(`merilis konten "${publishing.title}"`, user.name);
    setPublishing(null); load();
  };

  const handleReject = async (reason) => {
    const list = (await storage.getList('content-ideas:all')).map(i =>
      i.id === rejecting.id ? {
        ...i, status: 'rejected', rejectionReason: reason,
        rejectedById: user.id, rejectedByName: user.name, rejectedAt: new Date().toISOString()
      } : i
    );
    await storage.set('content-ideas:all', list);
    await logActivity(`menolak ide "${rejecting.title}"`, user.name);
    setRejecting(null); load();
  };

  // Filter
  const filtered = items.filter(i => {
    if (filter.status !== 'all' && i.status !== filter.status) return false;
    if (filter.format !== 'all' && i.contentFormat !== filter.format) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !(i.description || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Counts per status
  const counts = items.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});

  return (
    <div className="max-w-6xl">
      <PageHeader title="Bank Ide Konten"
        subtitle="Siapapun bisa usulkan ide. Manajer/Leader approve & assign ke tim konten."
        action={
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Usulkan Ide
          </button>
        } />

      {/* Status overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {Object.entries(CONTENT_STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter({ ...filter, status: filter.status === k ? 'all' : k })}
            className={`p-3 rounded-xl border-2 text-left transition ${
              filter.status === k ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${v.dot}`}></span>
              <span className="text-xs font-semibold text-slate-700">{v.label}</span>
            </div>
            <div className="font-display font-bold text-2xl text-slate-900 mt-1">{counts[k] || 0}</div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari judul atau deskripsi..." value={filter.search}
            onChange={e => setFilter({ ...filter, search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filter.format} onChange={e => setFilter({ ...filter, format: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="all">Semua Format</option>
          {Object.entries(CONTENT_FORMAT).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Lightbulb} text="Belum ada ide konten. Klik 'Usulkan Ide' untuk mulai." />
      ) : (
        <div className="space-y-3">
          {filtered.map(idea => {
            const fmt = CONTENT_FORMAT[idea.contentFormat] || { label: idea.contentFormat, icon: '📌' };
            const st = CONTENT_STATUS[idea.status];
            return (
              <div key={idea.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${st.color}`}>● {st.label}</span>
                      <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium">{fmt.icon} {fmt.label}</span>
                      {idea.productName && <span className="text-xs text-slate-500">📦 {idea.productName}</span>}
                    </div>
                    <h4 className="font-display font-bold text-slate-900 text-lg">{idea.title}</h4>
                    {idea.description && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{idea.description}</p>}
                  </div>
                  {canEditIdea(idea) && idea.status === 'idea' && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditing(idea); setShowForm(true); }} className="text-slate-400 hover:text-blue-600 p-1">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(idea)} className="text-slate-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {(idea.hook || idea.cta || idea.hashtags || idea.references) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 text-xs">
                    {idea.hook && <div className="bg-slate-50 p-2 rounded"><b className="text-slate-700">Hook:</b> <span className="text-slate-600">{idea.hook}</span></div>}
                    {idea.cta && <div className="bg-slate-50 p-2 rounded"><b className="text-slate-700">CTA:</b> <span className="text-slate-600">{idea.cta}</span></div>}
                    {idea.hashtags && <div className="bg-slate-50 p-2 rounded col-span-2"><b className="text-slate-700">Hashtags:</b> <span className="text-slate-600">{idea.hashtags}</span></div>}
                    {idea.references && (
                      <div className="bg-slate-50 p-2 rounded col-span-2">
                        <b className="text-slate-700">Referensi:</b> <a href={idea.references} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1">
                          {idea.references} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>💡 Diusulkan: <b className="text-slate-700">{idea.proposedByName}</b> · {fmtDateTime(idea.proposedAt)}</div>
                    {idea.assignedToName && (
                      <div>🎬 Ditugaskan ke: <b className="text-slate-700">{idea.assignedToName}</b>
                        {idea.targetDate && <span> · Target: <b className="text-amber-700">{fmtDate(idea.targetDate)}</b></span>}
                      </div>
                    )}
                    {idea.status === 'published' && idea.publishedUrl && (
                      <div>🚀 Tayang: <a href={idea.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1">{idea.publishedUrl} <ExternalLink className="w-3 h-3" /></a> · {fmtDate(idea.publishedAt)}</div>
                    )}
                    {idea.status === 'rejected' && idea.rejectionReason && (
                      <div className="text-red-600">❌ Alasan: {idea.rejectionReason}</div>
                    )}
                    {idea.assignNotes && idea.status !== 'idea' && (
                      <div className="italic text-slate-500">📝 Catatan: {idea.assignNotes}</div>
                    )}
                  </div>

                  {/* Action buttons based on status + role */}
                  <div className="flex gap-2 flex-wrap">
                    {idea.status === 'idea' && canApprove && (
                      <>
                        <button onClick={() => setAssigning(idea)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Setujui & Assign
                        </button>
                        <button onClick={() => setRejecting(idea)}
                          className="bg-white border border-red-300 hover:bg-red-50 text-red-700 text-xs px-3 py-1.5 rounded font-semibold">
                          Tolak
                        </button>
                      </>
                    )}
                    {idea.status === 'approved' && canExecute(idea) && (
                      <button onClick={() => handleStartProduction(idea)}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded font-semibold">
                        Mulai Produksi
                      </button>
                    )}
                    {idea.status === 'in_progress' && canExecute(idea) && (
                      <button onClick={() => setPublishing(idea)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded font-semibold">
                        Tandai Sudah Tayang
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <ContentIdeaForm idea={editing} creators={creators}
        onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
      {assigning && <AssignIdeaModal idea={assigning} allUsers={allUsers}
        onSave={handleApprove} onClose={() => setAssigning(null)} />}
      {publishing && <PublishIdeaModal idea={publishing}
        onSave={handlePublish} onClose={() => setPublishing(null)} />}
      {rejecting && <RejectIdeaModal idea={rejecting}
        onSave={handleReject} onClose={() => setRejecting(null)} />}
    </div>
  );
}

function ContentIdeaForm({ idea, creators, onSave, onClose }) {
  const [form, setForm] = useState({
    title: idea?.title || '',
    description: idea?.description || '',
    contentFormat: idea?.contentFormat || 'reel',
    productName: idea?.productName || '',
    hook: idea?.hook || '',
    cta: idea?.cta || '',
    hashtags: idea?.hashtags || '',
    references: idea?.references || ''
  });
  return (
    <Modal title={idea ? 'Edit Ide Konten' : 'Usulkan Ide Konten Baru'} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Judul Ide *">
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Mis. Review jujur skincare A pakai before-after"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Format Konten *">
            <select value={form.contentFormat} onChange={e => setForm({ ...form, contentFormat: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {Object.entries(CONTENT_FORMAT).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </Field>
          <Field label="Produk yang Dipromosikan">
            <input type="text" value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })}
              placeholder="Mis. Skincare A, Hijab Premium"
              list="creator-products"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <datalist id="creator-products">
              {creators.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </Field>
        </div>
        <Field label="Deskripsi / Konsep Konten *">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={4} placeholder="Gambarkan idenya. Mis: Buka dengan hook 'Kalian wajib coba ini!', lalu unboxing produk, kasih testimoni, tutup dengan CTA beli sebelum harga naik."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hook Pembuka (opsional)">
            <input type="text" value={form.hook} onChange={e => setForm({ ...form, hook: e.target.value })}
              placeholder="Mis. 'Stop scrolling kalau kulitmu berjerawat!'"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="CTA / Call to Action (opsional)">
            <input type="text" value={form.cta} onChange={e => setForm({ ...form, cta: e.target.value })}
              placeholder="Mis. 'Klik keranjang kuning, diskon 50% hari ini'"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
        </div>
        <Field label="Hashtags (opsional)">
          <input type="text" value={form.hashtags} onChange={e => setForm({ ...form, hashtags: e.target.value })}
            placeholder="#skincareterbaik #fyp #racun_belanja"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>
        <Field label="Link Referensi/Inspirasi (opsional)">
          <input type="url" value={form.references} onChange={e => setForm({ ...form, references: e.target.value })}
            placeholder="https://tiktok.com/@... (link konten yang jadi inspirasi)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>
        <FormActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.title.trim() || !form.description.trim()} />
      </div>
    </Modal>
  );
}

function AssignIdeaModal({ idea, allUsers, onSave, onClose }) {
  // Tim konten = operasional + leader (semua bisa di-assign)
  const candidates = allUsers.filter(u => u.role === 'operasional' || u.role === 'leader');
  const [form, setForm] = useState({
    assignedToId: candidates[0]?.id || '',
    targetDate: '',
    assignNotes: ''
  });
  return (
    <Modal title={`Setujui & Assign: "${idea.title}"`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-3 rounded-lg">
          ✅ Status akan berubah dari "Ide" → "Disetujui". Tim yang ditugaskan akan lihat ide ini di dashboard mereka.
        </div>
        <Field label="Tugaskan ke Tim Konten *">
          <select value={form.assignedToId} onChange={e => setForm({ ...form, assignedToId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
            {candidates.map(c => <option key={c.id} value={c.id}>{c.name}{c.jobTitle ? ` · ${c.jobTitle}` : ""} — {ROLES[c.role].label}</option>)}
          </select>
        </Field>
        <Field label="Target Tayang">
          <input type="date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>
        <Field label="Catatan untuk Tim Konten">
          <textarea value={form.assignNotes} onChange={e => setForm({ ...form, assignNotes: e.target.value })}
            rows={3} placeholder="Mis. 'Fokus ke pain point jerawat, gaya bicara santai. Durasi max 30 detik.'"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <FormActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.assignedToId} saveLabel="Setujui & Assign" />
      </div>
    </Modal>
  );
}

function PublishIdeaModal({ idea, onSave, onClose }) {
  const [form, setForm] = useState({ publishedUrl: '', publishNotes: '' });
  return (
    <Modal title={`Tandai Tayang: "${idea.title}"`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-3 rounded-lg">
          🚀 Status akan berubah ke "Sudah Tayang". Simpan link konten untuk tracking performance.
        </div>
        <Field label="Link Konten yang Tayang *">
          <input type="url" value={form.publishedUrl} onChange={e => setForm({ ...form, publishedUrl: e.target.value })}
            placeholder="https://tiktok.com/@... atau https://instagram.com/..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>
        <Field label="Catatan (opsional)">
          <textarea value={form.publishNotes} onChange={e => setForm({ ...form, publishNotes: e.target.value })}
            rows={2} placeholder="Mis. 'Sedikit penyesuaian dari konsep awal, ditambah testimoni langsung dari creator.'"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <FormActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.publishedUrl.trim()} saveLabel="Tandai Tayang" />
      </div>
    </Modal>
  );
}

function RejectIdeaModal({ idea, onSave, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Tolak Ide: "${idea.title}"`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg">
          ⚠️ Berikan alasan jelas supaya tim bisa belajar dari penolakan dan usulkan ide yang lebih baik.
        </div>
        <Field label="Alasan Penolakan *">
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            rows={4} placeholder="Mis. 'Konsep sudah pernah dipakai bulan lalu', 'Tidak sesuai brand guideline produk', 'Hook terlalu agresif'"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <FormActions onCancel={onClose} onSave={() => onSave(reason)} disabled={!reason.trim()} saveLabel="Tolak Ide" />
      </div>
    </Modal>
  );
}

// ============ APP SETTINGS (Manajer only) ============
// ============ MASUKAN & BUG (feedback tim untuk aplikasi) ============
const FEEDBACK_TYPES = {
  bug: { label: 'Bug / Error', color: 'bg-red-100 text-red-700', icon: '🐞' },
  saran: { label: 'Saran / Ide', color: 'bg-blue-100 text-blue-700', icon: '💡' },
  lainnya: { label: 'Lainnya', color: 'bg-slate-100 text-slate-600', icon: '💬' }
};
const FEEDBACK_STATUS = {
  baru: { label: 'Baru', color: 'bg-amber-100 text-amber-700' },
  diproses: { label: 'Diproses', color: 'bg-blue-100 text-blue-700' },
  selesai: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' }
};

function FeedbackView({ user, allUsers }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('bug');
  const [msg, setMsg] = useState('');
  const [page, setPage] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [replyText, setReplyText] = useState({});
  const [images, setImages] = useState([]);
  const [imgBusy, setImgBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const imgRef = useRef();

  const isManager = user.role === 'owner' || user.role === 'manajer';

  const load = async () => { setItems(await storage.getList('feedback:all')); setLoading(false); };
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const addImages = async (files) => {
    setImgBusy(true);
    try {
      const room = 3 - images.length;
      const picked = Array.from(files).slice(0, room);
      const compressed = [];
      for (const f of picked) compressed.push(await compressImageFile(f, { maxDim: 1000, quality: 0.7 }));
      setImages(prev => [...prev, ...compressed].slice(0, 3));
    } catch (e) { alert(e.message || 'Gagal memproses gambar.'); }
    setImgBusy(false);
  };

  const submit = async () => {
    if (!msg.trim()) return;
    setBusy(true);
    const item = {
      id: uid(), type, message: msg.trim(), page: page.trim(), images,
      userId: user.id, userName: user.name, userRole: user.role,
      status: 'baru', createdAt: new Date().toISOString(), replies: []
    };
    const list = await storage.getList('feedback:all');
    list.unshift(item);
    await storage.set('feedback:all', list);
    await logActivity(`mengirim masukan (${FEEDBACK_TYPES[type].label})`, user.name);
    setMsg(''); setPage(''); setType('bug'); setImages([]); setBusy(false);
    await load();
  };

  const setStatus = async (id, status) => {
    const list = await storage.getList('feedback:all');
    await storage.set('feedback:all', list.map(x => x.id === id ? { ...x, status } : x));
    await load();
  };

  const addReply = async (id) => {
    const text = (replyText[id] || '').trim();
    if (!text) return;
    const list = await storage.getList('feedback:all');
    await storage.set('feedback:all', list.map(x => x.id === id
      ? { ...x, replies: [...(x.replies || []), { id: uid(), userId: user.id, userName: user.name, text, createdAt: new Date().toISOString() }] }
      : x));
    setReplyText(p => ({ ...p, [id]: '' }));
    await load();
  };

  const del = async (item) => {
    if (!confirm('Hapus masukan ini?')) return;
    await storage.set('feedback:all', (await storage.getList('feedback:all')).filter(x => x.id !== item.id));
    await load();
  };

  const canDelete = (item) => isManager || item.userId === user.id;
  const counts = {
    all: items.length,
    baru: items.filter(i => i.status === 'baru').length,
    diproses: items.filter(i => i.status === 'diproses').length,
    selesai: items.filter(i => i.status === 'selesai').length
  };
  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const TABS = [['all', 'Semua'], ['baru', 'Baru'], ['diproses', 'Diproses'], ['selesai', 'Selesai']];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Masukan & Bug" subtitle="Lapor kekurangan, error, atau ide perbaikan aplikasi. Tim teknis akan tindak lanjuti." />

      {/* Form kirim masukan */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(FEEDBACK_TYPES).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)}
              className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg border transition ${type === k ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3}
          placeholder={type === 'bug' ? 'Jelaskan bug-nya: apa yang terjadi, di halaman mana, langkahnya gimana…' : 'Tulis saran/masukanmu di sini…'}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
        {/* Lampiran screenshot biar laporan tepat sasaran */}
        <div className="mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img} alt={`Lampiran ${i + 1}`} onClick={() => setLightbox({ src: img, title: `Lampiran ${i + 1}` })}
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer" />
                <button onClick={() => setImages(images.filter((_, x) => x !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button onClick={() => imgRef.current?.click()} disabled={imgBusy}
                className="w-16 h-16 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition disabled:opacity-50">
                <ImagePlus className="w-5 h-5" />
                <span className="text-[9px] font-semibold mt-0.5">{imgBusy ? '...' : 'Foto'}</span>
              </button>
            )}
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { addImages(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">📎 Lampirkan screenshot bug/masukan (maks. 3 gambar) supaya tim teknis langsung paham.</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <input type="text" value={page} onChange={e => setPage(e.target.value)}
            placeholder="Halaman terkait (opsional, mis. Absensi, Kalender)"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <button onClick={submit} disabled={busy || !msg.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" /> {busy ? 'Mengirim…' : 'Kirim Masukan'}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={filter === k ? { backgroundColor: '#2563EB', color: '#fff', borderColor: '#2563EB' } : {}}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 transition">
            {label} ({counts[k]})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-slate-400 text-sm">Memuat…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} text="Belum ada masukan. Jadilah yang pertama melapor!" />
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const t = FEEDBACK_TYPES[item.type] || FEEDBACK_TYPES.lainnya;
            const st = FEEDBACK_STATUS[item.status] || FEEDBACK_STATUS.baru;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <Avatar person={allUsers.find(u => u.id === item.userId) || { name: item.userName }} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{item.userName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.color}`}>{t.icon} {t.label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${st.color}`}>{st.label}</span>
                      {item.page && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">📍 {item.page}</span>}
                      {canDelete(item) && (
                        <button onClick={() => del(item)} title="Hapus" className="ml-auto text-slate-300 hover:text-red-600 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{fmtDateTime(item.createdAt)}</div>
                    <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{item.message}</div>

                    {/* Lampiran gambar */}
                    {(item.images || []).length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {item.images.map((img, i) => (
                          <img key={i} src={img} alt={`Lampiran ${i + 1}`}
                            onClick={() => setLightbox({ src: img, title: `Lampiran dari ${item.userName}` })}
                            className="w-20 h-20 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition" />
                        ))}
                      </div>
                    )}

                    {/* Status controls (owner/manajer) */}
                    {isManager && (
                      <div className="flex items-center gap-1.5 mt-3">
                        <span className="text-[11px] text-slate-500 font-semibold">Ubah status:</span>
                        {Object.entries(FEEDBACK_STATUS).map(([k, v]) => (
                          <button key={k} onClick={() => setStatus(item.id, k)}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition ${item.status === k ? v.color + ' border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Replies */}
                    {(item.replies || []).length > 0 && (
                      <div className="mt-3 space-y-2 border-l-2 border-slate-100 pl-3">
                        {item.replies.map(r => (
                          <div key={r.id}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700">{r.userName}</span>
                              <span className="text-[10px] text-slate-400">{fmtDateTime(r.createdAt)}</span>
                            </div>
                            <div className="text-sm text-slate-600 whitespace-pre-wrap">{r.text}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply input */}
                    <div className="flex gap-2 mt-3">
                      <input type="text" value={replyText[item.id] || ''}
                        onChange={e => setReplyText(p => ({ ...p, [item.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addReply(item.id); }}
                        placeholder="Tulis balasan…"
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={() => addReply(item.id)} disabled={!(replyText[item.id] || '').trim()}
                        className="bg-slate-100 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-40 text-slate-600 font-semibold px-3 py-1.5 rounded-lg text-sm transition">
                        Balas
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {lightbox && <ImageLightbox src={lightbox.src} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function SettingsView({ user, settings, onSave }) {
  const allowed = can.editAppSettings(user);
  const [form, setForm] = useState({
    ...settings,
    customRoles: { ...DEFAULT_ROLE_LABELS, ...(settings.customRoles || {}) },
    jobTitles: settings.jobTitles || [...DEFAULT_JOB_TITLES]
  });
  const [saved, setSaved] = useState(false);
  const [logoMode, setLogoMode] = useState(settings.logoImage ? 'image' : 'emoji');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  // Backup & restore
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const restoreRef = useRef();
  const mergeRef = useRef();
  const [autoBackups, setAutoBackups] = useState([]);
  useEffect(() => { (async () => { try { const idx = await storage.get('backup:auto:index'); setAutoBackups((idx?.dates || []).slice().sort().reverse()); } catch {} })(); }, []);
  // Backup ke Google Drive
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMsg, setDriveMsg] = useState(null); // { type:'ok'|'err', text, link }
  const [driveLast, setDriveLast] = useState(null);
  const [driveAuto, setDriveAuto] = useState(false);
  const driveEnabled = !!GOOGLE_CLIENT_ID;
  useEffect(() => { (async () => { try { setDriveLast(await storage.get('backup:drive-last')); setDriveAuto(!!(await storage.get('drive:auto-backup'))); } catch {} })(); }, []);

  const doDriveBackup = async () => {
    setDriveMsg(null); setDriveBusy(true);
    try {
      const res = await backupToGoogleDrive(user.name);
      setDriveLast(await storage.get('backup:drive-last'));
      setDriveMsg({ type: 'ok', text: 'Backup berhasil dikirim ke Google Drive (folder "Al-Kahfi Backup").', link: res.link });
    } catch (e) { setDriveMsg({ type: 'err', text: e?.message || 'Gagal backup ke Drive.' }); }
    setDriveBusy(false);
  };
  const toggleDriveAuto = async () => {
    if (driveAuto) { await storage.set('drive:auto-backup', false); setDriveAuto(false); setDriveMsg(null); return; }
    // Aktifkan: minta izin Google + backup pertama sekarang (sekalian uji koneksi)
    setDriveMsg(null); setDriveBusy(true);
    try {
      const res = await backupToGoogleDrive(user.name);
      await storage.set('drive:auto-backup', true);
      setDriveAuto(true);
      setDriveLast(await storage.get('backup:drive-last'));
      setDriveMsg({ type: 'ok', text: 'Auto-backup harian ke Drive diaktifkan. Backup pertama sudah dibuat.', link: res.link });
    } catch (e) { setDriveMsg({ type: 'err', text: e?.message || 'Gagal mengaktifkan auto-backup.' }); }
    setDriveBusy(false);
  };

  const doExport = async () => {
    setBackupBusy(true);
    try {
      const dump = { _meta: { app: 'Al-Kahfi Corp Team App', exportedAt: new Date().toISOString(), by: user.name, version: 1 }, data: {} };
      for (const k of BACKUP_KEYS) {
        const v = await storage.get(k);
        if (v !== null && v !== undefined) dump.data[k] = v;
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const d = new Date();
      a.href = url;
      a.download = `alkahfi-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      await storage.set('backup:last', { at: new Date().toISOString(), by: user.name });
    } catch (e) { alert('Gagal export: ' + e.message); }
    setBackupBusy(false);
  };

  const doRestore = async (file) => {
    setRestoreMsg('');
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed.data || parsed;
      const keys = Object.keys(data).filter(k => BACKUP_KEYS.includes(k));
      if (keys.length === 0) { setRestoreMsg('File tidak dikenali atau kosong. Pastikan ini file backup dari app ini.'); return; }
      const when = parsed._meta?.exportedAt ? new Date(parsed._meta.exportedAt).toLocaleString('id-ID') : 'tidak diketahui';
      if (!confirm(`⚠️ PERINGATAN: Ini akan MENIMPA SEMUA data sekarang dengan isi backup (${keys.length} bagian data, dibuat ${when}).\n\nData saat ini akan HILANG dan diganti dengan isi backup. Lanjutkan?`)) return;
      if (!confirm('Yakin 100%? Tindakan ini TIDAK BISA dibatalkan.')) return;
      setBackupBusy(true);
      for (const k of keys) await storage.set(k, data[k]);
      setBackupBusy(false);
      alert('✓ Data berhasil dipulihkan dari backup. Halaman akan dimuat ulang.');
      window.location.reload();
    } catch (e) { setBackupBusy(false); setRestoreMsg('Gagal memulihkan: ' + e.message); }
  };

  // Restore GABUNG (aman): data hilang kembali, data sekarang TIDAK terhapus
  const doRestoreMerge = async (file) => {
    setRestoreMsg('');
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed.data || parsed;
      const keys = Object.keys(data).filter(k => BACKUP_KEYS.includes(k));
      if (keys.length === 0) { setRestoreMsg('File tidak dikenali / kosong. Pastikan ini file backup dari app ini.'); return; }
      const when = parsed._meta?.exportedAt ? new Date(parsed._meta.exportedAt).toLocaleString('id-ID') : 'tidak diketahui';
      if (!confirm(`Gabungkan data dari backup (dibuat ${when}) dengan data sekarang?\n\n• Data lama yang HILANG akan kembali.\n• Data baru yang sudah ada TIDAK terhapus.\n\nLanjutkan?`)) return;
      setBackupBusy(true);
      const n = await applyMergeRestore(data);
      setBackupBusy(false);
      alert(`✓ Pemulihan (gabung) selesai — ${n} bagian data. Halaman dimuat ulang.`);
      window.location.reload();
    } catch (e) { setBackupBusy(false); setRestoreMsg('Gagal memulihkan: ' + e.message); }
  };

  // Pulihkan (gabung) dari salah satu auto-backup harian yang tersimpan di server
  const restoreAuto = async (date) => {
    if (!confirm(`Pulihkan (gabung) dari auto-backup ${fmtDate(date)}?\n\nData lama yang hilang kembali, data baru tetap aman.`)) return;
    try {
      setBackupBusy(true);
      const dump = await storage.get(`backup:auto:${date}`);
      if (!dump?.data) { setBackupBusy(false); alert('Auto-backup tidak ditemukan / kosong.'); return; }
      const n = await applyMergeRestore(dump.data);
      setBackupBusy(false);
      alert(`✓ Dipulihkan (gabung) dari ${fmtDate(date)} — ${n} bagian. Halaman dimuat ulang.`);
      window.location.reload();
    } catch (e) { setBackupBusy(false); alert('Gagal: ' + (e?.message || e)); }
  };

  const EMOJI_OPTIONS = ['🌙', '🕌', '⭐', '🌟', '💎', '🔥', '🚀', '⚡', '🎯', '👑', '🏆', '✨'];

  const submit = async () => {
    const cleaned = {
      ...form,
      logoImage: logoMode === 'image' ? form.logoImage : null,
      customRoles: {
        owner: form.customRoles.owner?.trim() || DEFAULT_ROLE_LABELS.owner,
        manajer: form.customRoles.manajer?.trim() || DEFAULT_ROLE_LABELS.manajer,
        leader: form.customRoles.leader?.trim() || DEFAULT_ROLE_LABELS.leader,
        operasional: form.customRoles.operasional?.trim() || DEFAULT_ROLE_LABELS.operasional
      },
      // Filter empty strings dan deduplicate
      jobTitles: [...new Set(form.jobTitles.map(jt => jt.trim()).filter(Boolean))]
    };
    await onSave(cleaned);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('File harus berupa gambar (PNG/JPG/WEBP).');
    if (file.size > 5 * 1024 * 1024) return alert('Ukuran file maksimal 5MB.');
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 256;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height = (height / width) * MAX; width = MAX; }
        } else {
          if (height > MAX) { width = (width / height) * MAX; height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        setForm({ ...form, logoImage: compressed });
        setLogoMode('image');
        setUploading(false);
      };
      img.onerror = () => { setUploading(false); alert('Gagal membaca gambar.'); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetRoleLabels = () => setForm({ ...form, customRoles: { ...DEFAULT_ROLE_LABELS } });

  if (!allowed) return <NoAccess />;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Pengaturan Aplikasi" subtitle="Identitas aplikasi yang dilihat seluruh tim" />

      {/* Identitas */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <h3 className="font-display font-bold text-slate-900">Identitas Aplikasi</h3>
        <Field label="Nama Aplikasi *">
          <input type="text" value={form.appName} onChange={e => setForm({ ...form, appName: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Subtitle / Tagline">
          <input type="text" value={form.appSubtitle} onChange={e => setForm({ ...form, appSubtitle: e.target.value })}
            placeholder="Mis. MCN TAP · Masjid Affiliate"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <h3 className="font-display font-bold text-slate-900">Logo Aplikasi</h3>
        <div className="bg-slate-100 p-1 inline-flex rounded-lg">
          <button onClick={() => setLogoMode('emoji')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition ${logoMode === 'emoji' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>
            Gunakan Emoji
          </button>
          <button onClick={() => setLogoMode('image')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition ${logoMode === 'image' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>
            Upload Foto
          </button>
        </div>

        {logoMode === 'emoji' ? (
          <div>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setForm({ ...form, logoEmoji: e })}
                  className={`p-3 text-2xl rounded-lg border-2 transition ${form.logoEmoji === e ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  {e}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">Atau ketik emoji custom:</span>
              <input type="text" value={form.logoEmoji} maxLength={4}
                onChange={e => setForm({ ...form, logoEmoji: e.target.value })}
                className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-lg" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-violet-700 rounded-xl flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
                {form.logoImage
                  ? <img src={form.logoImage} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white opacity-50">?</span>}
              </div>
              <div className="flex-1 space-y-2">
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
                  <ImagePlus className="w-4 h-4" /> {uploading ? 'Memproses...' : (form.logoImage ? 'Ganti Foto' : 'Pilih Foto Logo')}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                {form.logoImage && (
                  <button onClick={() => setForm({ ...form, logoImage: null })}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold">Hapus foto</button>
                )}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
              💡 Format: PNG/JPG/WEBP. Otomatis di-resize ke 256x256px. Gunakan logo dengan rasio kotak (1:1) untuk hasil terbaik.
            </div>
          </div>
        )}
      </div>

      {/* Custom Role Labels */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-900">Nama Peran Kustom</h3>
            <p className="text-xs text-slate-500 mt-1">Ubah label peran sesuai struktur tim Anda. Contoh: "Tim Operasional" → "Creator Manager".</p>
          </div>
          <button onClick={resetRoleLabels} title="Kembalikan ke default"
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
        <div className="space-y-3">
          {['owner', 'manajer', 'leader', 'operasional'].map(role => {
            const Icon = ROLES[role].icon;
            return (
              <div key={role} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-slate-500 uppercase">Default: {DEFAULT_ROLE_LABELS[role]}</div>
                  <input type="text" value={form.customRoles[role]}
                    placeholder={DEFAULT_ROLE_LABELS[role]}
                    onChange={e => setForm({ ...form, customRoles: { ...form.customRoles, [role]: e.target.value } })}
                    className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job Titles / Divisions */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-bold text-slate-900">Daftar Posisi / Divisi</h3>
            <p className="text-xs text-slate-500 mt-1">Posisi/divisi spesifik untuk anggota tim. Misal: Creator Manager, Tim Ads, Marketing, Editor Video. Tidak terbatas — tambah sesuai kebutuhan.</p>
          </div>
          <button onClick={() => setForm({ ...form, jobTitles: [...DEFAULT_JOB_TITLES] })}
            title="Kembalikan ke daftar default"
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
        <div className="space-y-2">
          {form.jobTitles.map((jt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{idx + 1}</div>
              <input type="text" value={jt}
                onChange={e => {
                  const newList = [...form.jobTitles];
                  newList[idx] = e.target.value;
                  setForm({ ...form, jobTitles: newList });
                }}
                placeholder="Mis. Creator Manager"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              <button onClick={() => setForm({ ...form, jobTitles: form.jobTitles.filter((_, i) => i !== idx) })}
                title="Hapus posisi ini"
                className="text-slate-400 hover:text-red-600 p-2 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={() => setForm({ ...form, jobTitles: [...form.jobTitles, ''] })}
            className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-blue-700 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Posisi Baru
          </button>
        </div>
        <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
          💡 Saat menambah anggota tim, posisi ini akan muncul sebagai saran. User juga bisa ketik manual kalau perlu posisi khusus.
        </div>
      </div>

      {/* Backup & Keamanan Data */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <div>
          <h3 className="font-display font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" /> Backup &amp; Keamanan Data
          </h3>
          <p className="text-xs text-slate-500 mt-1">Download cadangan semua data tim (anggota, tugas, GMV, creator, laporan, dll) jadi 1 file. Simpan rutin di Google Drive/laptop sebagai jaring pengaman.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-800 leading-relaxed">
          <b>Kenapa penting:</b> paket Supabase gratis <b>tidak menyimpan backup otomatis</b>. Kalau ada data terhapus tidak sengaja, tidak bisa dikembalikan. Biasakan <b>Export tiap minggu</b> (mis. tiap habis rekap mingguan) dan simpan filenya.
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <button onClick={doExport} disabled={backupBusy}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition shadow-sm">
            <Download className="w-4 h-4" /> {backupBusy ? 'Memproses…' : 'Export Semua Data (.json)'}
          </button>

          {(user.role === 'owner' || user.role === 'manajer') ? (
            <>
              <button onClick={() => mergeRef.current?.click()} disabled={backupBusy}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition shadow-sm">
                <Upload className="w-4 h-4" /> Pulihkan (Gabung) — Aman
              </button>
              <input ref={mergeRef} type="file" accept="application/json,.json" className="hidden"
                onChange={e => { doRestoreMerge(e.target.files?.[0]); e.target.value = ''; }} />
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-400 py-3 rounded-xl text-xs text-center px-3">
              Pemulihan data hanya bisa oleh Owner/Manajer
            </div>
          )}
        </div>

        <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg leading-relaxed">
          ✅ <b>Pulihkan (Gabung)</b> = cara aman untuk data hilang: entri lama yang hilang <b>dikembalikan</b>, sedangkan data baru yang sudah ada <b>tidak terhapus</b>. Ini yang dipakai untuk kasus GMV/laporan hilang.
        </div>

        {/* Backup ke Google Drive */}
        <div className="border-t border-slate-100 pt-3">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-1">
            <Cloud className="w-4 h-4 text-blue-600" /> Backup ke Google Drive
          </div>
          {!driveEnabled ? (
            <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5 leading-relaxed">
              Integrasi Google belum aktif. Isi <b>VITE_GOOGLE_CLIENT_ID</b> di Vercel (sama seperti setup Google Calendar) lalu deploy ulang. Panduan lengkap ada di file <b>PANDUAN-BACKUP-GOOGLE-DRIVE.md</b>.
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                Kirim cadangan ke folder <b>“Al-Kahfi Backup”</b> di Google Drive-mu. Beda tempat dari server, jadi data tetap aman walau Supabase bermasalah. App hanya bisa mengakses file yang dia buat sendiri (tidak mengintip file pribadimu).
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button onClick={doDriveBackup} disabled={driveBusy}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                  <CloudUpload className="w-4 h-4" /> {driveBusy ? 'Memproses…' : 'Backup ke Drive Sekarang'}
                </button>
                <button onClick={toggleDriveAuto} disabled={driveBusy}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition border ${driveAuto ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-700'}`}>
                  {driveAuto ? <><Check className="w-4 h-4" /> Auto-Backup Harian: AKTIF</> : <><Clock className="w-4 h-4" /> Aktifkan Auto-Backup Harian</>}
                </button>
              </div>
              {driveAuto && (
                <p className="text-[11px] text-emerald-700 mt-2">Otomatis backup ke Drive 1×/hari saat app dibuka. Klik tombol hijau lagi untuk mematikan.</p>
              )}
              {driveLast?.at && (
                <p className="text-[11px] text-slate-500 mt-2">
                  Backup Drive terakhir: <b>{new Date(driveLast.at).toLocaleString('id-ID')}</b>{driveLast.link ? <> · <a href={driveLast.link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">buka di Drive</a></> : ''}
                </p>
              )}
              {driveMsg && (
                <div className={`text-[11px] mt-2 p-2 rounded-lg ${driveMsg.type === 'ok' ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>
                  {driveMsg.type === 'ok' ? '✓ ' : '⚠️ '}{driveMsg.text}
                  {driveMsg.link ? <> · <a href={driveMsg.link} target="_blank" rel="noreferrer" className="underline font-semibold">buka file</a></> : ''}
                </div>
              )}
            </>
          )}
        </div>

        {/* Auto-backup harian (server) */}
        <div className="border-t border-slate-100 pt-3">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-1"><Database className="w-4 h-4 text-emerald-600" /> Auto-Backup Harian</div>
          <p className="text-[11px] text-slate-500 mb-2">Sistem otomatis menyimpan cadangan tiap hari (maks {AUTO_BACKUP_KEEP} hari terakhir) di server. Klik tanggal untuk memulihkan (gabung).</p>
          {autoBackups.length === 0 ? (
            <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-2">Belum ada auto-backup. Cadangan pertama dibuat otomatis hari ini saat app dibuka.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {autoBackups.map(d => (
                <button key={d} onClick={() => restoreAuto(d)} disabled={backupBusy}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                  ↺ {fmtDate(d)}
                </button>
              ))}
            </div>
          )}
        </div>

        {restoreMsg && <div className="text-xs text-red-600">{restoreMsg}</div>}

        {user.role === 'owner' && (
          <details className="text-[11px] text-slate-500">
            <summary className="cursor-pointer hover:text-slate-700">Opsi lanjutan: Pulihkan dengan menimpa total (berisiko)</summary>
            <div className="mt-2 space-y-2">
              <p className="bg-slate-50 p-2 rounded leading-relaxed">⚠️ <b>Menimpa total</b> mengganti SEMUA data sekarang dengan isi file backup — data yang dibuat setelah backup akan HILANG. Pakai hanya untuk pindah project / reset penuh.</p>
              <button onClick={() => restoreRef.current?.click()} disabled={backupBusy}
                className="flex items-center gap-2 bg-white border border-red-300 hover:bg-red-50 text-red-700 px-3 py-2 rounded-lg font-semibold text-xs">
                <Upload className="w-3.5 h-3.5" /> Pulihkan (Timpa Total)
              </button>
              <input ref={restoreRef} type="file" accept="application/json,.json" className="hidden"
                onChange={e => { doRestore(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </details>
        )}
      </div>

      {/* Preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <div className="text-xs font-semibold text-slate-600 uppercase mb-3">Preview</div>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-violet-700 rounded-xl flex items-center justify-center text-2xl overflow-hidden">
            {logoMode === 'image' && form.logoImage
              ? <img src={form.logoImage} alt="" className="w-full h-full object-cover" />
              : form.logoEmoji}
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-slate-900 text-lg">{form.appName}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{form.appSubtitle}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-800">{form.customRoles.owner || DEFAULT_ROLE_LABELS.owner}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800">{form.customRoles.manajer || DEFAULT_ROLE_LABELS.manajer}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800">{form.customRoles.leader || DEFAULT_ROLE_LABELS.leader}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800">{form.customRoles.operasional || DEFAULT_ROLE_LABELS.operasional}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50 pb-2">
        {saved && <span className="text-sm text-blue-700 font-semibold">✓ Tersimpan</span>}
        <button onClick={submit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md">
          Simpan Pengaturan
        </button>
      </div>
    </div>
  );
}

// ============ TODOS (Kanban Trello-like) ============
function TodosView({ user, allUsers }) {
  const [todos, setTodos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({ owner: user.id });
  const [dragOver, setDragOver] = useState(null);

  const load = async () => setTodos(await storage.getList('todos:all'));
  useEffect(() => { load(); }, []);

  // SEMUA TIM bisa lihat To-Do siapa saja (transparency). Edit permission tetap berbasis role.
  const visibleOwners = allUsers;

  // Filter todos by owner
  const visible = todos.filter(t => filter.owner === 'all'
    ? true
    : t.ownerId === filter.owner);

  const handleSave = async (data) => {
    let list = await storage.getList('todos:all');
    if (editing) {
      list = list.map(t => t.id === editing.id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t);
    } else {
      const owner = allUsers.find(u => u.id === (data.ownerId || user.id));
      list.unshift({
        id: uid(), ...data,
        ownerId: data.ownerId || user.id,
        ownerName: owner?.name || user.name,
        status: data.status || 'todo',
        createdAt: new Date().toISOString()
      });
    }
    await storage.set('todos:all', list);
    setShowForm(false); setEditing(null); load();
  };

  const handleDelete = async (todo) => {
    if (!confirm(`Hapus to-do "${todo.title}"?`)) return;
    const list = (await storage.getList('todos:all')).filter(t => t.id !== todo.id);
    await storage.set('todos:all', list);
    load();
  };

  const handleStatusChange = async (todoId, newStatus) => {
    const list = (await storage.getList('todos:all')).map(t =>
      t.id === todoId ? { ...t, status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : null } : t
    );
    await storage.set('todos:all', list);
    load();
  };

  // Drag & drop handlers
  const handleDragStart = (e, todoId) => {
    e.dataTransfer.setData('todoId', todoId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(status);
  };
  const handleDragLeave = () => setDragOver(null);
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const todoId = e.dataTransfer.getData('todoId');
    if (todoId) handleStatusChange(todoId, newStatus);
    setDragOver(null);
  };

  const grouped = {
    todo: visible.filter(t => t.status === 'todo'),
    in_progress: visible.filter(t => t.status === 'in_progress'),
    done: visible.filter(t => t.status === 'done')
  };

  return (
    <div className="max-w-7xl">
      <PageHeader title="To-Do Pribadi" subtitle="Catatan kerja pribadi tiap anggota — terbuka dilihat tim. Beda dengan Tiket: Tiket = penugasan resmi antar orang."
        action={
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> To-Do Baru
          </button>
        } />

      {/* Owner filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 uppercase">Lihat To-Do:</span>
        <button onClick={() => setFilter({ owner: user.id })}
          className={`text-xs px-3 py-1.5 rounded font-semibold transition ${filter.owner === user.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Saya
        </button>
        <button onClick={() => setFilter({ owner: 'all' })}
          className={`text-xs px-3 py-1.5 rounded font-semibold transition ${filter.owner === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Semua Anggota
        </button>
        <div className="h-5 w-px bg-slate-200"></div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">atau pilih per member:</span>
          <select value={filter.owner === user.id || filter.owner === 'all' ? '' : filter.owner}
            onChange={e => e.target.value && setFilter({ owner: e.target.value })}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded bg-white max-w-[200px]">
            <option value="">- Pilih nama -</option>
            {visibleOwners.filter(o => o.id !== user.id).sort((a, b) => a.name.localeCompare(b.name)).map(o => (
              <option key={o.id} value={o.id}>{o.name}{o.jobTitle ? ` · ${o.jobTitle}` : ''}</option>
            ))}
          </select>
        </div>
        {filter.owner !== user.id && filter.owner !== 'all' && (
          <span className="text-xs text-blue-700 font-semibold flex items-center gap-1">
            Filter: {visibleOwners.find(o => o.id === filter.owner)?.name}
            <button onClick={() => setFilter({ owner: user.id })} className="text-slate-400 hover:text-red-600">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(TODO_STATUS).map(([key, def]) => (
          <div key={key}
            onDragOver={e => handleDragOver(e, key)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, key)}
            className={`rounded-xl border-2 transition ${dragOver === key ? 'border-blue-500 bg-blue-50' : `${def.border} ${def.bg}`}`}>
            <div className={`p-3 border-b ${def.border} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-slate-800">{def.label}</h3>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${def.color}`}>{grouped[key].length}</span>
              </div>
            </div>
            <div className="p-3 space-y-2 min-h-[300px] max-h-[600px] overflow-y-auto scroll-thin">
              {grouped[key].length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  Drop card di sini atau klik "To-Do Baru"
                </div>
              ) : (
                grouped[key].map(todo => {
                  const days = daysUntil(todo.dueDate);
                  const isMine = todo.ownerId === user.id;
                  const canEdit = isMine || (user.role === 'manajer' || user.role === 'owner') || (user.role === 'leader' && allUsers.find(u => u.id === todo.ownerId)?.leaderId === user.id);
                  const ownerUser = allUsers.find(u => u.id === todo.ownerId);
                  return (
                    <div key={todo.id}
                      draggable={canEdit}
                      onDragStart={e => handleDragStart(e, todo.id)}
                      className={`bg-white rounded-lg border border-slate-200 p-3 ${canEdit ? 'cursor-move' : ''} hover:shadow-md transition group`}>
                      {/* Owner header */}
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden flex-shrink-0">
                            {ownerUser?.avatarImage
                              ? <img src={ownerUser.avatarImage} alt="" className="w-full h-full object-cover" />
                              : todo.ownerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-700 truncate">{todo.ownerName}</span>
                          {isMine && <span className="text-[9px] text-blue-600 font-semibold flex-shrink-0">(Saya)</span>}
                          {ownerUser?.jobTitle && <span className="text-[9px] text-slate-400 truncate">· {ownerUser.jobTitle}</span>}
                        </div>
                        {canEdit && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                            <button onClick={() => { setEditing(todo); setShowForm(true); }} className="text-slate-400 hover:text-blue-600 p-0.5">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDelete(todo)} className="text-slate-400 hover:text-red-600 p-0.5">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        {canEdit && <GripVertical className="w-3 h-3 text-slate-300 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-800">{todo.title}</div>
                          {todo.description && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{todo.description}</div>}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {todo.priority && <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITIES[todo.priority].color}`}>{PRIORITIES[todo.priority].label}</span>}
                            {todo.dueDate && (
                              <span className={`text-[10px] flex items-center gap-1 ${days < 0 && key !== 'done' ? 'text-red-600 font-bold' : days <= 1 && key !== 'done' ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
                                <Clock className="w-3 h-3" /> {days < 0 ? `Telat ${Math.abs(days)}h` : days === 0 ? 'Hari ini' : days === 1 ? 'Besok' : `${days}h lagi`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Mobile-friendly move buttons */}
                      {canEdit && (
                        <div className="flex gap-1 mt-2 md:hidden">
                          {key !== 'todo' && <button onClick={() => handleStatusChange(todo.id, key === 'in_progress' ? 'todo' : 'in_progress')} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"><ArrowLeft className="w-3 h-3" /></button>}
                          {key !== 'done' && <button onClick={() => handleStatusChange(todo.id, key === 'todo' ? 'in_progress' : 'done')} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 ml-auto"><ArrowRight className="w-3 h-3" /></button>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-slate-500 bg-slate-50 p-2 rounded text-center">
        💡 Tarik card antar kolom untuk ubah status, atau klik card untuk edit detail. Di mobile, gunakan tombol panah.
      </div>

      {showForm && <TodoForm todo={editing} user={user} visibleOwners={visibleOwners}
        onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function TodoForm({ todo, user, visibleOwners, onSave, onClose }) {
  const [form, setForm] = useState({
    title: todo?.title || '',
    description: todo?.description || '',
    priority: todo?.priority || 'medium',
    status: todo?.status || 'todo',
    dueDate: todo?.dueDate || '',
    ownerId: todo?.ownerId || user.id
  });
  return (
    <Modal title={todo ? 'Edit To-Do' : 'To-Do Baru'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Judul *">
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Mis. Review video Creator A sebelum di-upload"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>
        <Field label="Deskripsi">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <Field label="Siapa yang Mengerjakan *">
          <select value={form.ownerId} onChange={e => setForm({ ...form, ownerId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
            <option value={user.id}>{user.name} (Saya){user.jobTitle ? ` · ${user.jobTitle}` : ''}</option>
            {visibleOwners.filter(o => o.id !== user.id).map(o => (
              <option key={o.id} value={o.id}>{o.name}{o.jobTitle ? ` · ${o.jobTitle}` : ''}</option>
            ))}
          </select>
          <div className="text-[11px] text-slate-500 mt-1">💡 Nama orang yang mengerjakan akan tampil di card, supaya tim tahu siapa handle apa.</div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Prioritas">
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {Object.entries(TODO_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Due Date">
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
        </div>
        <FormActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.title.trim() || !form.ownerId} />
      </div>
    </Modal>
  );
}


// ============ DAILY REPORTS (dengan Template System) ============
function DailyReportsView({ user, allUsers }) {
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [filter, setFilter] = useState({
    date: dayKey(),
    author: 'all'
  });
  const [viewMode, setViewMode] = useState('kartu'); // 'kartu' | 'tabel'
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setReports(await loadDailyReports());
    setTemplates(await storage.getList('daily-report-templates:all'));
  };
  useEffect(() => { load(); }, []);

  const canManage = (user.role === 'manajer' || user.role === 'owner') || user.role === 'leader';

  // Get template assigned to a user (if any)
  const getUserTemplate = (userId) => templates.find(t => t.assignedUserIds?.includes(userId));

  // Get fields data for a report (handles both legacy and new format)
  const getReportFields = (r) => {
    if (r.fieldsSnapshot && Array.isArray(r.fieldsSnapshot)) return r.fieldsSnapshot;
    // Legacy format - convert
    return DEFAULT_DAILY_FIELDS
      .map(f => ({ id: f.id, label: f.label, type: f.type, value: r[f.id] }))
      .filter(f => f.value !== undefined && f.value !== null && f.value !== '' && f.value !== 0);
  };

  const handleSaveReport = async (data) => {
    try {
      if (editing) {
        const updated = { ...editing, ...data, updatedAt: new Date().toISOString() };
        const ok = await storage.set(RPT_REC_PREFIX + updated.id, updated);
        if (!ok) throw new Error('Gagal menyimpan ke server.');
        await logActivity(`mengupdate laporan harian ${fmtDate(data.date)}`, user.name);
      } else {
        const rec = {
          id: uid(), ...data,
          authorId: user.id, authorName: user.name, authorRole: user.role,
          authorJobTitle: user.jobTitle || '',
          submittedAt: new Date().toISOString()
        };
        const ok = await storage.set(RPT_REC_PREFIX + rec.id, rec);
        if (!ok) throw new Error('Gagal menyimpan ke server.');
        await logActivity(`mengirim laporan harian ${fmtDate(data.date)}`, user.name);
      }
      setShowForm(false); setEditing(null); load();
    } catch (err) {
      alert('⚠️ Gagal menyimpan laporan: ' + (err?.message || err) + '\n\nLaporan lama tidak diubah. Coba lagi saat koneksi stabil.');
    }
  };

  const handleDelete = async (r) => {
    if (!confirm('Hapus laporan harian ini?')) return;
    try {
      const ok = await storage.delete(RPT_REC_PREFIX + r.id);
      if (!ok) throw new Error('Gagal menghapus di server.');
      load();
    } catch (err) {
      alert('⚠️ Gagal menghapus: ' + (err?.message || err) + '\n\nCoba lagi saat koneksi stabil.');
    }
  };

  const handleTogglePin = async (r) => {
    const updated = { ...r, pinToDashboard: !r.pinToDashboard };
    const ok = await storage.set(RPT_REC_PREFIX + r.id, updated);
    if (!ok) { alert('Gagal menyimpan. Coba lagi.'); return; }
    load();
  };

  const handleSaveTemplates = async (newList) => {
    await storage.set('daily-report-templates:all', newList);
    await logActivity(`mengupdate template laporan harian`, user.name);
    load();
  };

  // Visibility: Manajer all, Leader self+team, Operasional self
  const visibleReports = reports.filter(r => {
    if ((user.role === 'manajer' || user.role === 'owner')) return true;
    if (r.authorId === user.id) return true;
    if (user.role === 'leader') {
      const author = allUsers.find(u => u.id === r.authorId);
      return author && author.leaderId === user.id;
    }
    return false;
  });

  const filtered = visibleReports.filter(r => {
    if (filter.date !== 'all' && r.date !== filter.date) return false;
    if (filter.author !== 'all' && r.authorId !== filter.author) return false;
    return true;
  });

  // Download weekly CSV (handles dynamic fields)
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const downloadInRange = ({ start, end, authorId }) => {
    const filteredReports = visibleReports.filter(r => {
      if (r.date < start || r.date > end) return false;
      if (authorId && authorId !== 'all' && r.authorId !== authorId) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));

    if (filteredReports.length === 0) {
      alert(`Tidak ada laporan dalam rentang ini (${fmtDate(start)} – ${fmtDate(end)}).`);
      return;
    }

    // Collect all unique field labels across reports
    const fieldLabelsSet = new Set();
    filteredReports.forEach(r => {
      getReportFields(r).forEach(f => fieldLabelsSet.add(f.label));
    });
    const fieldLabels = Array.from(fieldLabelsSet);

    const headers = ['Tanggal', 'Author', 'Peran', 'Posisi', 'Template', ...fieldLabels];
    const escapeCsv = (s) => `"${String(s ?? '').replace(/"/g, '""').replace(/\n/g, ' | ')}"`;

    const rows = filteredReports.map(r => {
      const fields = getReportFields(r);
      const fieldMap = {};
      fields.forEach(f => { fieldMap[f.label] = f.value; });
      return [
        r.date, r.authorName,
        ROLES[r.authorRole]?.label || r.authorRole,
        r.authorJobTitle || '-',
        r.templateName || 'Default',
        ...fieldLabels.map(lbl => fieldMap[lbl] ?? '')
      ].map(escapeCsv).join(',');
    });

    const csv = ['\uFEFF' + headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-harian-${start}-sd-${end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };

  const filterableAuthors = user.role === 'operasional' ? [user] :
    user.role === 'leader' ? allUsers.filter(u => u.id === user.id || u.leaderId === user.id) :
    allUsers;

  const groupedByDate = useMemo(() => {
    const g = {};
    filtered.forEach(r => { if (!g[r.date]) g[r.date] = []; g[r.date].push(r); });
    return Object.entries(g).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // Susun laporan PER TEMPLATE/FORM jadi tabel (baris = laporan, kolom = pertanyaan form)
  const valStr = (v) => Array.isArray(v) ? v.join(', ') : (v ?? '');
  const reportsByTemplate = useMemo(() => {
    const g = {};
    filtered.forEach(r => { const k = r.templateName || 'Laporan Umum'; (g[k] = g[k] || []).push(r); });
    return Object.entries(g).map(([name, reps]) => {
      const labels = [];
      reps.forEach(r => getReportFields(r).forEach(f => { if (!labels.includes(f.label)) labels.push(f.label); }));
      const sorted = reps.slice().sort((a, b) => (b.date + (b.submittedAt || '')).localeCompare(a.date + (a.submittedAt || '')));
      return { name, reps: sorted, labels };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // Export Excel (.xlsx) — 1 sheet per template/form, kolom = pertanyaan
  const exportExcel = async () => {
    if (filtered.length === 0) { alert('Tidak ada laporan pada filter ini untuk diexport.'); return; }
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const usedNames = new Set();
      reportsByTemplate.forEach(({ name, reps, labels }) => {
        const header = ['Nama', 'Peran', 'Posisi', 'Tanggal', 'Waktu Kirim', ...labels];
        const aoa = [header];
        reps.forEach(r => {
          const map = {}; getReportFields(r).forEach(f => { map[f.label] = valStr(f.value); });
          aoa.push([
            r.authorName, ROLES[r.authorRole]?.label || r.authorRole, r.authorJobTitle || '-',
            fmtDate(r.date), fmtDateTime(r.submittedAt), ...labels.map(l => map[l] ?? '')
          ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = header.map((h, i) => ({ wch: i < 5 ? 16 : Math.min(45, Math.max(14, String(h).length + 2)) }));
        let sheetName = (name || 'Laporan').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 28);
        let nm = sheetName, c = 2; while (usedNames.has(nm)) { nm = `${sheetName} ${c++}`; }
        usedNames.add(nm);
        XLSX.utils.book_append_sheet(wb, ws, nm);
      });
      XLSX.writeFile(wb, `Laporan-Harian-${dayKey()}.xlsx`);
    } catch (e) { alert('Gagal membuat Excel: ' + (e?.message || e)); }
    setExporting(false);
  };

  const myAssignedTemplate = getUserTemplate(user.id);
  const staffNoForm = user.role === 'operasional' && !myAssignedTemplate;

  return (
    <div className="max-w-6xl">
      <PageHeader title="Laporan Harian"
        subtitle="Form custom per anggota tim. Manajer/Leader atur isi form, operasional yang submit data."
        action={
          <div className="flex gap-2 flex-wrap">
            {canManage && (
              <button onClick={() => setShowTemplateManager(true)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> Kelola Template Form
              </button>
            )}
            <button onClick={exportExcel} disabled={exporting}
              className="bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Menyiapkan…' : 'Export Excel'}
            </button>
            <button onClick={() => setShowDownloadModal(true)}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <FileDown className="w-4 h-4" /> Download CSV
            </button>
            <button onClick={() => { setEditing(null); setShowForm(true); }} disabled={staffNoForm}
              title={staffNoForm ? 'Leader belum membuatkan form laporan untukmu' : ''}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Laporan Hari Ini
            </button>
          </div>
        } />

      {/* User template info */}
      {staffNoForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
          📋 Leader belum membuatkan form laporan untukmu — kamu belum diwajibkan lapor harian (KPI laporan tidak dinilai). Hubungi Leader-mu bila seharusnya ada.
        </div>
      )}
      {myAssignedTemplate && (
        <div className="bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-blue-700 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-blue-800">Template laporan untuk Anda:</span>
            <b className="text-blue-900 ml-1">{myAssignedTemplate.name}</b>
            <span className="text-blue-700 text-xs ml-2">({myAssignedTemplate.fields.length} field)</span>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Tanggal</label>
          <div className="flex gap-2">
            <input type="date" value={filter.date === 'all' ? '' : filter.date}
              onChange={e => setFilter({ ...filter, date: e.target.value || 'all' })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
            <button onClick={() => setFilter({ ...filter, date: 'all' })}
              className={`text-xs px-3 py-1.5 rounded font-semibold ${filter.date === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Semua
            </button>
          </div>
        </div>
        {filterableAuthors.length > 1 && (
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Anggota</label>
            <select value={filter.author} onChange={e => setFilter({ ...filter, author: e.target.value })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="all">Semua Anggota</option>
              {filterableAuthors.map(a => <option key={a.id} value={a.id}>{a.name}{a.jobTitle ? ` · ${a.jobTitle}` : ''}</option>)}
            </select>
          </div>
        )}
        <div className="ml-auto">
          <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Tampilan</label>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
            <button onClick={() => setViewMode('kartu')}
              className={`text-xs font-semibold px-3 py-1.5 ${viewMode === 'kartu' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Kartu</button>
            <button onClick={() => setViewMode('tabel')}
              className={`text-xs font-semibold px-3 py-1.5 ${viewMode === 'tabel' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Tabel</button>
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} text="Belum ada laporan harian pada filter ini." />
      ) : viewMode === 'tabel' ? (
        <div className="space-y-6">
          {reportsByTemplate.map(({ name, reps, labels }) => (
            <div key={name}>
              <div className="text-sm font-display font-bold text-slate-700 mb-2 px-1">
                📋 {name} <span className="text-xs text-slate-500 font-normal">({reps.length} laporan)</span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="text-sm min-w-full whitespace-nowrap">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-bold sticky left-0 bg-slate-50 z-10">Nama</th>
                        <th className="text-left px-3 py-2.5 font-bold">Tanggal</th>
                        {labels.map(l => <th key={l} className="text-left px-3 py-2.5 font-bold">{l}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reps.map(r => {
                        const map = {}; getReportFields(r).forEach(f => { map[f.label] = valStr(f.value); });
                        return (
                          <tr key={r.id} className="hover:bg-slate-50 align-top">
                            <td className="px-3 py-2 font-semibold text-slate-800 sticky left-0 bg-white">
                              {r.authorName}<div className="text-[10px] font-normal text-slate-400">{ROLES[r.authorRole]?.label}</div>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{fmtDate(r.date)}</td>
                            {labels.map(l => <td key={l} className="px-3 py-2 text-slate-700 max-w-[280px] whitespace-pre-wrap">{String(map[l] ?? '') || '–'}</td>)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map(([date, reps]) => (
            <div key={date}>
              <div className="text-sm font-display font-bold text-slate-700 mb-2 px-1">
                📅 {fmtDate(date)} <span className="text-xs text-slate-500 font-normal">({reps.length} laporan)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reps.map(r => {
                  const fields = getReportFields(r);
                  return (
                    <div key={r.id} className={`bg-white rounded-xl border ${r.pinToDashboard ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'} p-4`}>
                      <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{r.authorName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${ROLES[r.authorRole]?.color || ''}`}>{ROLES[r.authorRole]?.label}</span>
                            {r.authorJobTitle && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{r.authorJobTitle}</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {fmtDateTime(r.submittedAt)}
                            {r.templateName && <span> · Template: {r.templateName}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {canManage && (
                            <button onClick={() => handleTogglePin(r)} title={r.pinToDashboard ? 'Unpin dari dashboard' : 'Pin ke dashboard'}
                              className={`p-1 ${r.pinToDashboard ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}>
                              <Pin className="w-4 h-4" />
                            </button>
                          )}
                          {(canManage || r.authorId === user.id) && (
                            <button onClick={() => { setEditing(r); setShowForm(true); }} className="text-slate-400 hover:text-blue-600 p-1">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canManage && (
                            <button onClick={() => handleDelete(r)} className="text-slate-400 hover:text-red-600 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {fields.map(f => (
                          <DynamicFieldDisplay key={f.id} field={f} />
                        ))}
                      </div>
                      {(r.attachments || []).length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-100">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1"><Paperclip className="w-3 h-3" /> Bukti ({r.attachments.length})</div>
                          <div className="flex gap-2 flex-wrap">
                            {r.attachments.map((img, i) => (
                              <img key={i} src={img} alt={`Bukti ${i + 1}`}
                                onClick={() => setLightbox({ src: img, title: `Bukti laporan ${r.authorName} · ${fmtDate(r.date)}` })}
                                className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <DailyReportFormDynamic report={editing} user={user} templates={templates}
        onSave={handleSaveReport} onClose={() => { setShowForm(false); setEditing(null); }} />}
      {showTemplateManager && <TemplateManagementModal user={user} allUsers={allUsers} templates={templates}
        onSave={handleSaveTemplates} onClose={() => setShowTemplateManager(false)} />}
      {showDownloadModal && <DownloadRangeModal filterableAuthors={filterableAuthors} reportsCount={visibleReports.length}
        onDownload={downloadInRange} onClose={() => setShowDownloadModal(false)} />}
      {lightbox && <ImageLightbox src={lightbox.src} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ============ DOWNLOAD RANGE MODAL ============
function DownloadRangeModal({ filterableAuthors, reportsCount, onDownload, onClose }) {
  const today = new Date();
  const todayStr = dayKey(today);
  // Default: minggu ini
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const [form, setForm] = useState({
    start: dayKey(monday),
    end: dayKey(sunday),
    authorId: 'all'
  });
  const [preset, setPreset] = useState('this-week');

  const applyPreset = (key) => {
    const now = new Date();
    let s, e;
    if (key === 'today') {
      s = e = todayStr;
    } else if (key === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      s = e = dayKey(y);
    } else if (key === 'this-week') {
      const d = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - d + (d === 0 ? -6 : 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      s = dayKey(mon);
      e = dayKey(sun);
    } else if (key === 'last-week') {
      const d = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - d + (d === 0 ? -6 : 1) - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      s = dayKey(mon);
      e = dayKey(sun);
    } else if (key === 'this-month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      s = dayKey(first);
      e = dayKey(last);
    } else if (key === 'last-month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      s = dayKey(first);
      e = dayKey(last);
    } else if (key === 'last-30') {
      const back = new Date(now); back.setDate(back.getDate() - 29);
      s = dayKey(back);
      e = todayStr;
    } else {
      return; // custom: tidak ubah tanggal
    }
    setForm({ ...form, start: s, end: e });
    setPreset(key);
  };

  const presets = [
    { id: 'today',      label: 'Hari Ini' },
    { id: 'yesterday',  label: 'Kemarin' },
    { id: 'this-week',  label: 'Minggu Ini' },
    { id: 'last-week',  label: 'Minggu Lalu' },
    { id: 'this-month', label: 'Bulan Ini' },
    { id: 'last-month', label: 'Bulan Lalu' },
    { id: 'last-30',    label: '30 Hari Terakhir' },
    { id: 'custom',     label: 'Custom' }
  ];

  const submit = () => {
    if (!form.start || !form.end) return alert('Tanggal mulai dan akhir wajib diisi.');
    if (form.start > form.end) return alert('Tanggal mulai harus sebelum tanggal akhir.');
    onDownload(form);
  };

  // Count days in range
  const dayCount = Math.floor((new Date(form.end) - new Date(form.start)) / 86400000) + 1;

  return (
    <Modal title="Download Laporan Harian" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          📊 Total {reportsCount} laporan tersedia. Pilih rentang tanggal yang ingin di-download sebagai CSV.
        </div>

        <Field label="Rentang Cepat">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map(p => (
              <button key={p.id} onClick={() => applyPreset(p.id)}
                className={`text-xs px-2 py-2 rounded-lg font-semibold transition ${preset === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal Mulai *">
            <input type="date" value={form.start}
              onChange={e => { setForm({ ...form, start: e.target.value }); setPreset('custom'); }}
              max={form.end}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="Tanggal Akhir *">
            <input type="date" value={form.end}
              onChange={e => { setForm({ ...form, end: e.target.value }); setPreset('custom'); }}
              min={form.start}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
          📅 Rentang dipilih: <b>{fmtDate(form.start)}</b> sampai <b>{fmtDate(form.end)}</b>
          <span className="text-xs text-slate-500"> ({dayCount} hari)</span>
        </div>

        {filterableAuthors.length > 1 && (
          <Field label="Filter Anggota">
            <select value={form.authorId} onChange={e => setForm({ ...form, authorId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="all">Semua Anggota</option>
              {filterableAuthors.map(a => <option key={a.id} value={a.id}>{a.name}{a.jobTitle ? ` · ${a.jobTitle}` : ''}</option>)}
            </select>
          </Field>
        )}

        <FormActions onCancel={onClose} onSave={submit} saveLabel="Download CSV" />
      </div>
    </Modal>
  );
}

// Helper: render saved field value based on type
function DynamicFieldDisplay({ field }) {
  if (field.value === undefined || field.value === null || field.value === '' || field.value === 0) return null;
  if (Array.isArray(field.value) && field.value.length === 0) return null;
  let display = field.value;
  if (Array.isArray(field.value)) display = field.value.join(', ');
  if (field.type === 'number') display = fmtNumber(field.value);
  if (field.type === 'rating') {
    return (
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase">{field.label}</div>
        <div className="flex gap-0.5 mt-0.5">
          {[1,2,3,4,5].map(n => (
            <span key={n} className={`text-base ${n <= field.value ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
          ))}
        </div>
      </div>
    );
  }
  if (field.type === 'url' && typeof field.value === 'string' && field.value.startsWith('http')) {
    return (
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase">{field.label}</div>
        <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1 break-all">
          {field.value} <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      </div>
    );
  }
  if (field.type === 'date') display = fmtDate(field.value);
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-500 uppercase">{field.label}</div>
      <div className="text-sm text-slate-700 whitespace-pre-wrap">{display}</div>
    </div>
  );
}

// Dynamic field input - render input based on type
function DynamicFieldInput({ field, value, onChange }) {
  const common = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <Field label={`${field.label}${field.required ? ' *' : ''}`}>
      {field.helpText && <div className="text-[11px] text-slate-500 mb-1 -mt-1">{field.helpText}</div>}
      {field.type === 'text' && (
        <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder} className={common} />
      )}
      {field.type === 'textarea' && (
        <textarea value={value ?? ''} onChange={e => onChange(e.target.value)}
          rows={3} placeholder={field.placeholder} className={`${common} resize-none`} />
      )}
      {field.type === 'number' && (
        <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={field.placeholder} className={`${common} tabular-nums`} />
      )}
      {field.type === 'date' && (
        <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} className={common} />
      )}
      {field.type === 'url' && (
        <input type="url" value={value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || 'https://...'} className={common} />
      )}
      {field.type === 'select' && (
        <select value={value ?? ''} onChange={e => onChange(e.target.value)}
          className={`${common} bg-white`}>
          <option value="">- Pilih -</option>
          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
      {field.type === 'radio' && (
        <div className="space-y-1.5">
          {(field.options || []).map(opt => (
            <label key={opt} className="flex items-center gap-2.5 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
              <input type="radio" name={field.id} checked={value === opt} onChange={() => onChange(opt)}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
      {field.type === 'checkbox' && (
        <div className="space-y-1.5">
          {(field.options || []).map(opt => {
            const arr = Array.isArray(value) ? value : [];
            const checked = arr.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2.5 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                <input type="checkbox" checked={checked}
                  onChange={() => onChange(checked ? arr.filter(x => x !== opt) : [...arr, opt])}
                  className="w-4 h-4 accent-blue-600 rounded" />
                <span className="text-sm text-slate-700">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
      {field.type === 'time' && (
        <input type="time" value={value ?? ''} onChange={e => onChange(e.target.value)} className={common} />
      )}
      {field.type === 'rating' && (
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => (
            <button key={n} type="button" onClick={() => onChange(value === n ? 0 : n)}
              className={`w-10 h-10 rounded-lg border-2 font-bold transition ${value === n ? 'border-amber-400 bg-amber-50 text-amber-600' : value > 0 && n < value ? 'border-amber-200 bg-amber-50/50 text-amber-400' : 'border-slate-200 text-slate-300 hover:border-slate-300'}`}>
              ★
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

function DailyReportFormDynamic({ report, user, templates, onSave, onClose }) {
  const today = dayKey();

  // Aturan GForm: Leader membuatkan form → staff mengisi. Staff tanpa form = tidak ada yang dilaporkan.
  const isStaff = user.role === 'operasional';
  const myTemplates = templates.filter(t => t.assignedUserIds?.includes(user.id));
  const userTemplate = myTemplates[0];
  const initialTemplateId = report?.templateId || userTemplate?.id || '';

  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId);
  const pickableTemplates = isStaff ? myTemplates : templates;
  const activeTemplate = pickableTemplates.find(t => t.id === selectedTemplateId) || (isStaff ? myTemplates[0] : templates.find(t => t.id === selectedTemplateId));
  const fieldDefs = activeTemplate?.fields || (isStaff ? [] : DEFAULT_DAILY_FIELDS);

  // Initialize form values
  const [form, setForm] = useState(() => {
    const initial = { date: report?.date || today, pinToDashboard: report?.pinToDashboard || false };
    // Load existing values
    if (report?.fieldsSnapshot) {
      const valMap = {};
      report.fieldsSnapshot.forEach(f => { valMap[f.id] = f.value; });
      initial._values = valMap;
    } else if (report) {
      // Legacy format
      const valMap = {};
      DEFAULT_DAILY_FIELDS.forEach(f => {
        if (report[f.id] !== undefined) valMap[f.id] = report[f.id];
      });
      initial._values = valMap;
    } else {
      initial._values = {};
    }
    return initial;
  });

  const canPickTemplate = (user.role === 'manajer' || user.role === 'owner') || user.role === 'leader' || templates.length > 1;
  const canPin = (user.role === 'manajer' || user.role === 'owner') || user.role === 'leader';

  // Lampiran bukti (screenshot GMV, hasil kerja, dll)
  const [attachments, setAttachments] = useState(report?.attachments || []);
  const [attBusy, setAttBusy] = useState(false);
  const attRef = useRef();
  const addAttachments = async (files) => {
    setAttBusy(true);
    try {
      const room = 3 - attachments.length;
      const picked = Array.from(files).slice(0, room);
      const next = [];
      for (const f of picked) next.push(await compressImageFile(f, { maxDim: 1100, quality: 0.7 }));
      setAttachments(prev => [...prev, ...next].slice(0, 3));
    } catch (e) { alert(e.message || 'Gagal memproses gambar.'); }
    setAttBusy(false);
  };

  const setFieldValue = (fieldId, value) => {
    setForm({ ...form, _values: { ...form._values, [fieldId]: value } });
  };

  const submit = () => {
    // Validate required
    const missing = fieldDefs.filter(f => f.required && (form._values[f.id] === undefined || form._values[f.id] === '' || form._values[f.id] === null));
    if (missing.length > 0) {
      alert(`Field wajib belum diisi: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    // Build snapshot
    const fieldsSnapshot = fieldDefs.map(f => ({
      id: f.id, label: f.label, type: f.type,
      value: form._values[f.id] ?? ''
    }));
    onSave({
      date: form.date,
      templateId: activeTemplate?.id || null,
      templateName: activeTemplate?.name || null,
      fieldsSnapshot,
      attachments,
      pinToDashboard: form.pinToDashboard
    });
  };

  if (isStaff && myTemplates.length === 0) {
    return (
      <Modal title="Laporan Harian" onClose={onClose}>
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
            📋 <b>Belum ada form laporan untukmu.</b> Laporan harian mengikuti form yang dibuatkan Leader (seperti Google Form).
            Minta Leader-mu membuka <b>Laporan Harian → Kelola Template Form</b>, membuat form, lalu assign ke kamu.
            Selama belum ada form, kamu tidak diwajibkan lapor & KPI laporanmu tidak dinilai.
          </div>
          <button onClick={onClose} className="w-full py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">Mengerti</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={report ? 'Edit Laporan Harian' : 'Laporan Harian'} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Tanggal *">
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>

        {canPickTemplate && pickableTemplates.length > 0 && (
          <Field label="Template Form">
            <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {!isStaff && <option value="">Default (form standar)</option>}
              {pickableTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.assignedUserIds?.includes(user.id) ? ' (untuk Anda)' : ''}</option>
              ))}
            </select>
          </Field>
        )}

        {activeTemplate ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-blue-800">
              <ClipboardList className="w-4 h-4" />
              <b>{activeTemplate.name}</b>
            </div>
            {activeTemplate.description && <div className="text-xs text-blue-700 mt-1">{activeTemplate.description}</div>}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            📋 Menggunakan form standar (default). Manajer/Leader bisa bikin template custom di "Kelola Template Form".
          </div>
        )}

        <div className="space-y-3 pt-2 border-t border-slate-100">
          {fieldDefs.map(f => (
            <DynamicFieldInput key={f.id} field={f}
              value={form._values[f.id]}
              onChange={v => setFieldValue(f.id, v)} />
          ))}
        </div>

        {/* Bukti foto / screenshot */}
        <Field label="Bukti Foto / Screenshot (opsional, maks. 3)">
          <div className="flex items-center gap-2 flex-wrap">
            {attachments.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt={`Bukti ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                <button onClick={() => setAttachments(attachments.filter((_, x) => x !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {attachments.length < 3 && (
              <button type="button" onClick={() => attRef.current?.click()} disabled={attBusy}
                className="w-16 h-16 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition disabled:opacity-50">
                <Paperclip className="w-4 h-4" />
                <span className="text-[9px] font-semibold mt-0.5">{attBusy ? '...' : 'Upload'}</span>
              </button>
            )}
            <input ref={attRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { addAttachments(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">💡 Lampirkan screenshot GMV / bukti hasil kerja supaya laporan tervalidasi.</div>
        </Field>

        {canPin && (
          <label className="flex items-start gap-2 bg-blue-50 border border-blue-200 p-3 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.pinToDashboard}
              onChange={e => setForm({ ...form, pinToDashboard: e.target.checked })}
              className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-blue-800">📌 Tampilkan di Dashboard Tim</div>
              <div className="text-xs text-blue-700">Laporan ini akan di-pin sebagai highlight di dashboard semua anggota.</div>
            </div>
          </label>
        )}

        <FormActions onCancel={onClose} onSave={submit} disabled={!form.date} />
      </div>
    </Modal>
  );
}

// ============ TEMPLATE MANAGEMENT (Daily Report Form Builder) ============
function TemplateManagementModal({ user, allUsers, templates, onSave, onClose }) {
  const [list, setList] = useState(templates);
  const [editing, setEditing] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const saveTemplate = (template) => {
    let next;
    if (editing) {
      next = list.map(t => t.id === editing.id ? { ...t, ...template, updatedAt: new Date().toISOString() } : t);
    } else {
      next = [...list, {
        id: uid(), ...template,
        createdById: user.id, createdByName: user.name,
        createdAt: new Date().toISOString()
      }];
    }
    setList(next);
    onSave(next);
    setShowBuilder(false); setEditing(null);
  };

  const deleteTemplate = (template) => {
    if (!confirm(`Hapus template "${template.name}"? User yang di-assign akan otomatis pakai form default.`)) return;
    const next = list.filter(t => t.id !== template.id);
    setList(next);
    onSave(next);
  };

  const duplicateTemplate = (template) => {
    const copy = {
      ...template, id: uid(),
      name: `${template.name} (Copy)`,
      assignedUserIds: [],
      createdById: user.id, createdByName: user.name,
      createdAt: new Date().toISOString()
    };
    const next = [...list, copy];
    setList(next);
    onSave(next);
  };

  return (
    <Modal title="Kelola Template Form Laporan Harian" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          💡 <b>Cara kerja:</b> Buat template untuk role/posisi tertentu (mis. "Laporan Creator Manager"), atur field-field-nya, lalu assign ke anggota tim. Saat anggota submit Laporan Harian, form mereka otomatis ikut template yang di-assign.
        </div>

        <button onClick={() => { setEditing(null); setShowBuilder(true); }}
          className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-700 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Buat Template Baru
        </button>

        {list.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            Belum ada template. Tanpa template, semua user pakai form default.
          </div>
        ) : (
          <div className="space-y-3">
            {list.map(t => {
              const assignees = t.assignedUserIds?.map(id => allUsers.find(u => u.id === id)).filter(Boolean) || [];
              return (
                <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-bold text-slate-900">{t.name}</h4>
                      {t.description && <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => duplicateTemplate(t)} title="Duplicate"
                        className="text-slate-400 hover:text-blue-600 p-1.5">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditing(t); setShowBuilder(true); }} title="Edit"
                        className="text-slate-400 hover:text-blue-600 p-1.5">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteTemplate(t)} title="Hapus"
                        className="text-slate-400 hover:text-red-600 p-1.5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <span className="text-slate-600"><b>{t.fields.length}</b> field</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600"><b>{assignees.length}</b> user di-assign</span>
                  </div>
                  {assignees.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {assignees.map(a => (
                        <span key={a.id} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {a.name}{a.jobTitle ? ` · ${a.jobTitle}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">Tutup</button>
        </div>
      </div>

      {showBuilder && <TemplateBuilderModal template={editing} allUsers={allUsers} existingTemplates={list}
        onSave={saveTemplate} onClose={() => { setShowBuilder(false); setEditing(null); }} />}
    </Modal>
  );
}

function TemplateBuilderModal({ template, allUsers, existingTemplates, onSave, onClose }) {
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    assignedUserIds: template?.assignedUserIds || [],
    fields: template?.fields ? JSON.parse(JSON.stringify(template.fields)) : []
  });
  const [error, setError] = useState('');

  const addField = () => {
    setForm({ ...form, fields: [...form.fields, {
      id: uid(), label: '', type: 'text', required: false,
      placeholder: '', helpText: '', options: []
    }]});
  };
  const updateField = (idx, key, value) => {
    const newFields = [...form.fields];
    newFields[idx] = { ...newFields[idx], [key]: value };
    setForm({ ...form, fields: newFields });
  };
  const removeField = (idx) => setForm({ ...form, fields: form.fields.filter((_, i) => i !== idx) });
  const moveField = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= form.fields.length) return;
    const newFields = [...form.fields];
    [newFields[idx], newFields[newIdx]] = [newFields[newIdx], newFields[idx]];
    setForm({ ...form, fields: newFields });
  };
  const loadDefaults = () => {
    if (form.fields.length > 0 && !confirm('Field saat ini akan diganti dengan field default. Lanjutkan?')) return;
    setForm({ ...form, fields: DEFAULT_DAILY_FIELDS.map(f => ({ ...f, id: uid() })) });
  };

  const toggleAssignee = (userId) => {
    const ids = form.assignedUserIds.includes(userId)
      ? form.assignedUserIds.filter(x => x !== userId)
      : [...form.assignedUserIds, userId];
    setForm({ ...form, assignedUserIds: ids });
  };

  const submit = () => {
    setError('');
    if (!form.name.trim()) return setError('Nama template wajib diisi.');
    if (form.fields.length === 0) return setError('Minimal harus ada 1 field.');
    const emptyLabels = form.fields.filter(f => !f.label.trim());
    if (emptyLabels.length > 0) return setError('Semua field harus punya label.');
    const selectNoOpts = form.fields.filter(f => (f.type === 'select' || f.type === 'radio' || f.type === 'checkbox') && (!f.options || f.options.length === 0));
    if (selectNoOpts.length > 0) return setError(`Field pilihan harus punya minimal 1 opsi: ${selectNoOpts.map(f => f.label).join(', ')}`);
    // Check duplicate assignment with other templates
    const alreadyAssigned = form.assignedUserIds.filter(uid =>
      existingTemplates.some(t => t.id !== template?.id && t.assignedUserIds?.includes(uid))
    );
    if (alreadyAssigned.length > 0) {
      const names = alreadyAssigned.map(id => allUsers.find(u => u.id === id)?.name).filter(Boolean);
      if (!confirm(`User ${names.join(', ')} sudah di-assign ke template lain. Akan dipindah ke template ini. Lanjutkan?`)) return;
    }
    onSave(form);
  };

  // Sort users by role for cleaner UI
  const sortedUsers = [...allUsers].sort((a, b) => (ROLES[b.role].rank - ROLES[a.role].rank) || a.name.localeCompare(b.name));

  return (
    <Modal title={template ? 'Edit Template' : 'Template Baru'} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Basic info */}
        <div className="grid grid-cols-1 gap-3">
          <Field label="Nama Template *">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Mis. Laporan Creator Manager, Laporan Tim Live"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="Deskripsi (opsional)">
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Gambaran singkat untuk siapa template ini"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
        </div>

        {/* Field builder */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Field Form ({form.fields.length})</label>
            {form.fields.length === 0 && (
              <button onClick={loadDefaults} className="text-xs text-blue-700 hover:text-blue-800 font-semibold">
                Mulai dari template default →
              </button>
            )}
          </div>

          <div className="space-y-2">
            {form.fields.map((field, idx) => (
              <FieldBuilder key={field.id} field={field} idx={idx} total={form.fields.length}
                onChange={(key, value) => updateField(idx, key, value)}
                onRemove={() => removeField(idx)}
                onMoveUp={() => moveField(idx, -1)}
                onMoveDown={() => moveField(idx, 1)} />
            ))}
            <button onClick={addField}
              className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-blue-700 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Tambah Field
            </button>
          </div>
        </div>

        {/* Assign to users */}
        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide block mb-2">
            Assign Template ke User ({form.assignedUserIds.length} dipilih)
          </label>
          <div className="max-h-48 overflow-y-auto scroll-thin border border-slate-200 rounded-lg p-2 space-y-1">
            {sortedUsers.map(u => (
              <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                <input type="checkbox" checked={form.assignedUserIds.includes(u.id)}
                  onChange={() => toggleAssignee(u.id)} />
                <span className="text-sm flex-1">{u.name}</span>
                {u.jobTitle && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{u.jobTitle}</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLES[u.role].color}`}>{ROLES[u.role].label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <FormActions onCancel={onClose} onSave={submit} saveLabel={template ? 'Update Template' : 'Simpan Template'} />
      </div>
    </Modal>
  );
}

function FieldBuilder({ field, idx, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  const [expanded, setExpanded] = useState(!field.label);
  // Teks mentah opsi disimpan lokal supaya Enter/baris baru tidak hilang saat mengetik
  const [optionsText, setOptionsText] = useState((field.options || []).join('\n'));
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
          {idx + 1}
        </div>
        <input type="text" value={field.label} onChange={e => onChange('label', e.target.value)}
          placeholder="Label field (mis. Aktivitas Hari Ini)"
          className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm" />
        <select value={field.type} onChange={e => onChange('type', e.target.value)}
          className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white">
          {Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-700 p-1" title="Detail">
          <Settings className="w-3.5 h-3.5" />
        </button>
        <div className="flex flex-col gap-0.5">
          <button onClick={onMoveUp} disabled={idx === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5" title="Naik">
            <ArrowLeft className="w-3 h-3 rotate-90" />
          </button>
          <button onClick={onMoveDown} disabled={idx === total - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5" title="Turun">
            <ArrowRight className="w-3 h-3 rotate-90" />
          </button>
        </div>
        <button onClick={onRemove} className="text-slate-400 hover:text-red-600 p-1" title="Hapus">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-500">Placeholder</label>
              <input type="text" value={field.placeholder || ''} onChange={e => onChange('placeholder', e.target.value)}
                placeholder="Hint dalam input"
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-500">Help Text</label>
              <input type="text" value={field.helpText || ''} onChange={e => onChange('helpText', e.target.value)}
                placeholder="Penjelasan tambahan"
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm mt-0.5" />
            </div>
          </div>
          {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-500">Pilihan (satu per baris — tekan Enter untuk tambah pilihan)</label>
              <textarea value={optionsText}
                onChange={e => {
                  setOptionsText(e.target.value);
                  onChange('options', e.target.value.split('\n').map(s => s.trim()).filter(Boolean));
                }}
                rows={4} placeholder="Pilihan 1&#10;Pilihan 2&#10;Pilihan 3"
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm mt-0.5 resize-none font-mono" />
              <div className="text-[10px] text-slate-400 mt-0.5">{(field.options || []).length} pilihan terdeteksi</div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={field.required || false}
              onChange={e => onChange('required', e.target.checked)} />
            <span>Wajib diisi</span>
          </label>
        </div>
      )}
    </div>
  );
}


// ============ TEAM CALENDAR ============
// Siapa yang boleh menambah/atur agenda kalender:
// Owner (CEO), Manajer, Leader (khusus timnya), & Sekretariat (seluruh tim). Lainnya hanya lihat.
function canManageCalendar(u) {
  return u.role === 'owner' || u.role === 'manajer' || u.role === 'leader' || !!u.isSecretariat;
}

// ====== INTEGRASI GOOGLE CALENDAR (OAuth, tanpa backend — pakai Google Identity Services) ======
// Agenda otomatis masuk ke Google Calendar akun Google si pembuat. Butuh VITE_GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
let _gisPromise = null;
function loadGis() {
  if (_gisPromise) return _gisPromise;
  _gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal memuat Google (cek koneksi internet).'));
    document.head.appendChild(s);
  });
  return _gisPromise;
}
let _gcalToken = null; // { token, exp }
async function getGcalToken(forceConsent = false) {
  if (!GOOGLE_CLIENT_ID) throw new Error('Integrasi Google Calendar belum diaktifkan (VITE_GOOGLE_CLIENT_ID belum diisi).');
  await loadGis();
  if (!forceConsent && _gcalToken && _gcalToken.exp > Date.now() + 60000) return _gcalToken.token;
  return new Promise((resolve, reject) => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GCAL_SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        _gcalToken = { token: resp.access_token, exp: Date.now() + (resp.expires_in || 3600) * 1000 };
        resolve(resp.access_token);
      },
      error_callback: (err) => reject(new Error(err?.message || 'Login Google dibatalkan.')),
    });
    tc.requestAccessToken({ prompt: _gcalToken ? '' : 'consent' });
  });
}
const _addOneHour = (hm) => {
  const [h, m] = (hm || '09:00').split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m); d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// Buat 1 event di Google Calendar primary akun pembuat. Tamu yang punya email otomatis diundang.
async function addEventToGoogleCalendar(event) {
  const token = await getGcalToken();
  const startT = event.time || '09:00';
  const endT = event.endTime || _addOneHour(startT);
  const body = {
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    start: { dateTime: `${event.date}T${startT}:00`, timeZone: 'Asia/Jakarta' },
    end: { dateTime: `${event.date}T${endT}:00`, timeZone: 'Asia/Jakarta' },
    attendees: (event.attendeeEmails || []).map(email => ({ email })),
    reminders: { useDefault: true },
  };
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Google Calendar (${res.status}): ${t.slice(0, 140)}`);
  }
  return res.json(); // { htmlLink, id, ... }
}

// ====== INTEGRASI GOOGLE DRIVE (Backup ke Drive, OAuth tanpa backend) ======
// Pakai Client ID Google yang sama dgn Calendar. Scope `drive.file` = app HANYA bisa
// melihat/mengelola file yang DIA buat sendiri (paling aman, tidak butuh verifikasi Google,
// tidak bisa mengintip file pribadi user lain).
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GDRIVE_FOLDER_NAME = 'Al-Kahfi Backup';
const GDRIVE_BACKUP_KEEP = 30; // simpan maks 30 file backup terakhir di Drive
let _driveToken = null; // { token, exp } — cache terpisah dari token Calendar
async function getDriveToken(forceConsent = false, silent = false) {
  if (!GOOGLE_CLIENT_ID) throw new Error('Integrasi Google belum diaktifkan (VITE_GOOGLE_CLIENT_ID belum diisi di Vercel).');
  await loadGis();
  if (!forceConsent && _driveToken && _driveToken.exp > Date.now() + 60000) return _driveToken.token;
  return new Promise((resolve, reject) => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GDRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        _driveToken = { token: resp.access_token, exp: Date.now() + (resp.expires_in || 3600) * 1000 };
        resolve(resp.access_token);
      },
      error_callback: (err) => reject(new Error(err?.message || 'Login Google dibatalkan.')),
    });
    // silent = jangan munculkan popup (untuk auto-backup); manual pertama kali minta consent.
    tc.requestAccessToken({ prompt: silent ? '' : (_driveToken ? '' : 'consent') });
  });
}
// Cari folder backup milik app; kalau belum ada, buat baru. Return folderId.
async function driveFindOrCreateFolder(token) {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${GDRIVE_FOLDER_NAME}' and trashed=false`;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.ok) {
    const j = await r.json();
    if (j.files && j.files.length) return j.files[0].id;
  }
  const cr = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: GDRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!cr.ok) throw new Error(`Gagal membuat folder Drive (${cr.status}).`);
  return (await cr.json()).id;
}
// Upload 1 file JSON (multipart) ke folder. Return { id, name, webViewLink }.
async function driveUploadJson(token, folderId, filename, obj) {
  const meta = { name: filename, parents: [folderId], mimeType: 'application/json' };
  const boundary = 'alkahfi' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n` +
    `--${boundary}--`;
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`Gagal upload ke Drive (${r.status}): ${t.slice(0, 140)}`); }
  return r.json();
}
// Hapus backup lama, sisakan `keep` terbaru (urut createdTime desc).
async function drivePruneOld(token, folderId, keep) {
  const q = `'${folderId}' in parents and name contains 'alkahfi-backup-' and trashed=false`;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return;
  const files = (await r.json()).files || [];
  for (const f of files.slice(keep)) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
}
// Orkestrasi: ambil token → build dump → upload → buang yg lama. Return { name, link }.
async function backupToGoogleDrive(byName, { silent = false } = {}) {
  const token = await getDriveToken(false, silent);
  const dump = await buildBackupDump(byName || 'manual');
  if (!dump.data || Object.keys(dump.data).length === 0) throw new Error('Data kosong — backup dibatalkan agar tidak menimpa cadangan bagus.');
  const folderId = await driveFindOrCreateFolder(token);
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `alkahfi-backup-${wibDayKey(now.getTime())}_${hhmm}.json`;
  const res = await driveUploadJson(token, folderId, filename, dump);
  await drivePruneOld(token, folderId, GDRIVE_BACKUP_KEEP).catch(() => {});
  await storage.set('backup:drive-last', { at: new Date().toISOString(), by: byName || 'manual', name: res.name || filename, link: res.webViewLink || '' });
  return { name: res.name || filename, link: res.webViewLink || '' };
}
// Auto-backup harian ke Drive (1x/hari, hanya kalau toggle ON & sudah pernah connect). Senyap.
async function driveAutoBackupIfDue(byName) {
  try {
    if (!GOOGLE_CLIENT_ID) return;
    if (!(await storage.get('drive:auto-backup'))) return; // belum diaktifkan owner
    const last = await storage.get('backup:drive-last');
    const lastDay = last?.at ? wibDayKey(new Date(last.at).getTime()) : null;
    if (lastDay === wibDayKey()) return; // sudah backup hari ini
    await backupToGoogleDrive(byName || 'auto', { silent: true });
  } catch (e) { console.warn('Auto-backup Drive dilewati (akan dicoba lagi):', e?.message || e); }
}

function CalendarView({ user, allUsers }) {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const canManage = canManageCalendar(user);

  // Migrasi sekali jalan: data "Jadwal" lama (live/piket) dilebur ke Kalender Tim
  const migrateOldSchedule = async () => {
    if (await storage.get('calendar:schedule-migrated')) return;
    const oldSchedules = await storage.getList('schedule:all');
    if (oldSchedules.length > 0) {
      const existing = await loadCalendar();
      const haveIds = new Set(existing.map(e => e && e.id));
      for (const s of oldSchedules.filter(s => s.status !== 'cancelled')) {
        const id = `sch-${s.id}`;
        if (haveIds.has(id)) continue;
        const tipe = SCHEDULE_TYPE[s.type] ? s.type : 'lain';
        await storage.set(CAL_REC_PREFIX + id, {
          id,
          title: s.type === 'live' ? `Live: ${s.product || s.creatorName || 'Live Shopping'}` : `${SCHEDULE_TYPE[s.type]?.label || 'Piket'} — ${s.adminName || ''}`.trim(),
          description: [s.creatorName ? `Creator: ${s.creatorName}` : '', s.product ? `Produk: ${s.product}` : '', s.note || ''].filter(Boolean).join('\n'),
          type: tipe, date: s.date, time: s.time || '09:00', endTime: '',
          location: '', attendeeIds: [], attendeeNames: s.adminName ? [s.adminName] : [],
          createdById: s.adminId || null, createdByName: s.adminName || 'Migrasi Jadwal',
          createdAt: s.createdAt || new Date().toISOString(), migratedFromSchedule: true
        });
      }
    }
    await storage.set('calendar:schedule-migrated', true);
  };

  const setEvents0 = async () => { try { setEvents(await loadCalendar()); } catch {} };
  const load = async () => { try { await migrateOldSchedule(); setEvents(await loadCalendar()); } catch (e) { console.warn('Gagal memuat kalender:', e?.message || e); } };
  // Muat saat buka + auto-refresh tiap 10 detik (biar agenda baru dari device lain ikut muncul)
  useEffect(() => { load(); const iv = setInterval(() => setEvents0(), 10000); return () => clearInterval(iv); }, []);
  // Preload Google Identity Services agar popup saat simpan tidak diblokir
  useEffect(() => { if (GOOGLE_CLIENT_ID) loadGis().catch(() => {}); }, []);

  const handleSave = async (data) => {
    const isNew = !editing;
    const rec = editing
      ? { ...editing, ...data, updatedAt: new Date().toISOString() }
      : { id: uid(), ...data, createdById: user.id, createdByName: user.name, createdAt: new Date().toISOString() };
    setEvents(prev => editing ? prev.map(e => e.id === rec.id ? rec : e) : [rec, ...prev]); // optimistic
    const ok = await storage.set(CAL_REC_PREFIX + rec.id, rec);
    if (!ok) {
      // Simpan ke server GAGAL → jangan tutup form & jangan tampilkan sukses palsu (agenda hilang saat re-sync)
      alert('⚠️ Gagal menyimpan agenda ke server (koneksi internet bermasalah). Agenda BELUM tersimpan — coba klik Simpan lagi.');
      setEvents0();             // balikkan ke kondisi server biar tampilan tidak menyesatkan
      return;
    }
    setShowForm(false); setEditing(null);
    if (isNew) logActivity(`menambah agenda kalender: "${data.title}" (${fmtDate(data.date)})`, user.name);
    setEvents0();               // sinkron ulang dari server
  };

  const handleDelete = async (ev) => {
    if (!confirm(`Hapus agenda "${ev.title}"?`)) return;
    setEvents(prev => prev.filter(x => x.id !== ev.id)); setViewing(null);   // hilangkan langsung
    const ok = await storage.delete(CAL_REC_PREFIX + ev.id);
    if (!ok) { alert('Gagal menghapus agenda. Coba lagi.'); setEvents0(); return; }
    setEvents0();
  };

  // Calendar grid for currentMonth
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();
  // Calendar starts on Monday in Indonesia convention; convert: Sun=0 -> 6, Mon=1->0
  const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const todayStr = dayKey();

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ empty: true, key: i });
    } else {
      const d = new Date(year, month, dayNum);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      cells.push({ dayNum, dateStr, dayEvents, isToday: dateStr === todayStr, key: i });
    }
  }

  const nav = (delta) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(d);
  };
  const goToday = () => setCurrentMonth(new Date());
  const monthLabel = currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Upcoming events list (next 7 days)
  const upcomingEvents = events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 5);

  return (
    <div className="max-w-7xl">
      <PageHeader title="Kalender Tim"
        subtitle="Meeting, agenda, kegiatan tim. Bisa ditambahkan ke Google Calendar pribadi."
        action={
          canManage ? (
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Agenda Baru
            </button>
          ) : null
        } />

      {/* Notice about Google Calendar */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <CalendarDays className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-blue-900">Integrasi Google Calendar</div>
          <div className="text-blue-800 mt-0.5">
            {GOOGLE_CLIENT_ID ? (
              <>Saat membuat agenda baru, centang <b>"Tambahkan otomatis ke Google Calendar saya"</b> → agenda langsung masuk Google Calendar akun Google pembuat (pertama kali diminta login & izin). Peserta yang sudah isi <b>Gmail</b> (di Profil) otomatis <b>diundang via email</b>. 🔔 Peserta juga dapat <b>notifikasi di lonceng</b> aplikasi (H-1 sore & pagi hari-H).</>
            ) : (
              <>Pilih peserta saat membuat agenda → peserta yang sudah isi <b>Gmail</b> (di Profil) akan diundang ke Google Calendar saat agenda dibuka & disimpan lewat tombol <b>"Google Calendar"</b>. Bisa juga download <b>.ics</b>. 🔔 Peserta dapat <b>notifikasi di lonceng</b> (H-1 sore & pagi hari-H). <span className="block mt-1 text-amber-700">⚙️ Mode otomatis (tanpa klik) belum aktif — perlu setup Google Client ID (lihat panduan dari admin).</span></>
            )}
            {!canManage && <span className="block mt-1 text-blue-700">Kamu bisa <b>melihat</b> agenda. Penambahan agenda dilakukan oleh Leader/Manajer/CEO/Sekretariat.</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => nav(-1)} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-4 h-4" /></button>
              <h3 className="font-display font-bold text-slate-900 text-lg capitalize min-w-[180px] text-center">{monthLabel}</h3>
              <button onClick={() => nav(1)} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowRight className="w-4 h-4" /></button>
            </div>
            <button onClick={goToday} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold">Hari Ini</button>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-200">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
              <div key={d} className="p-2 text-xs font-bold text-slate-500 text-center uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map(cell => (
              cell.empty ? (
                <div key={cell.key} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/50"></div>
              ) : (
                <div key={cell.key}
                  onClick={() => { if (!canManage) return; setEditing({ date: cell.dateStr }); setShowForm(true); }}
                  className={`min-h-[100px] p-2 border-b border-r border-slate-100 ${canManage ? 'cursor-pointer hover:bg-slate-50' : ''} ${cell.isToday ? 'bg-blue-50/50' : ''}`}>
                  <div className={`text-xs font-bold mb-1 ${cell.isToday ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white' : 'text-slate-700'}`}>
                    {cell.dayNum}
                  </div>
                  <div className="space-y-1">
                    {cell.dayEvents.slice(0, 3).map(e => (
                      <div key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); setViewing(e); }}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate font-semibold cursor-pointer ${EVENT_TYPE[e.type]?.color || 'bg-slate-100'}`}>
                        {e.time && <span>{e.time} </span>}{EVENT_TYPE[e.type]?.icon} {e.title}
                      </div>
                    ))}
                    {cell.dayEvents.length > 3 && (
                      <div className="text-[10px] text-slate-500 px-1.5">+{cell.dayEvents.length - 3} lainnya</div>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Upcoming sidebar */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-display font-bold text-slate-900 mb-3">Agenda Mendatang</h3>
            {upcomingEvents.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">Belum ada agenda mendatang</div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(e => (
                  <button key={e.id} onClick={() => setViewing(e)}
                    className="w-full text-left p-2 rounded-lg border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                      <span>{EVENT_TYPE[e.type]?.icon}</span>
                      <span className="font-semibold">{fmtDate(e.date)}{e.time && ` · ${e.time}`}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 line-clamp-2">{e.title}</div>
                    {e.location && <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {e.location}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && <EventForm event={editing} allUsers={allUsers} user={user}
        onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
      {viewing && <EventDetailModal event={viewing} user={user}
        onEdit={() => { setEditing(viewing); setViewing(null); setShowForm(true); }}
        onDelete={() => handleDelete(viewing)}
        onClose={() => setViewing(null)} />}
    </div>
  );
}

function EventForm({ event, allUsers, user, onSave, onClose }) {
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    type: event?.type || 'meeting',
    date: event?.date || dayKey(),
    time: event?.time || '09:00',
    endTime: event?.endTime || '',
    location: event?.location || '',
    attendeeIds: event?.attendeeIds || []
  });

  // Scope peserta: owner/manajer/sekretariat → semua tim; leader → hanya timnya + dirinya
  const canAll = user.role === 'owner' || user.role === 'manajer' || !!user.isSecretariat;
  const selectableUsers = canAll ? allUsers : allUsers.filter(u => u.id === user.id || u.leaderId === user.id);
  const gcalReady = !!GOOGLE_CLIENT_ID && !event?.id; // hanya untuk agenda baru
  const [addGcal, setAddGcal] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggleAttendee = (id) => {
    const list = form.attendeeIds.includes(id)
      ? form.attendeeIds.filter(x => x !== id)
      : [...form.attendeeIds, id];
    setForm({ ...form, attendeeIds: list });
  };

  const submit = async () => {
    const chosen = allUsers.filter(u => form.attendeeIds.includes(u.id));
    const attendees = chosen.map(u => u.name);
    const attendeeEmails = chosen.map(u => (u.gmail || '').trim()).filter(Boolean);
    const payload = { ...form, attendeeNames: attendees, attendeeEmails };
    // Tambah ke Google Calendar dulu (dipanggil langsung dari klik → popup tidak diblokir).
    // Apa pun hasil Google-nya, agenda TETAP disimpan di aplikasi — Google hanya bonus.
    if (gcalReady && addGcal) {
      setBusy(true);
      try {
        await addEventToGoogleCalendar(payload);
        alert('✅ Agenda juga ditambahkan ke Google Calendar kamu.' + (attendeeEmails.length ? ` ${attendeeEmails.length} peserta diundang via email.` : ''));
      } catch (e) {
        alert('⚠️ Agenda tetap disimpan di aplikasi, tapi gagal menambah ke Google Calendar:\n' + (e?.message || e));
      }
      setBusy(false);
    }
    onSave(payload);            // SELALU simpan ke aplikasi (kamu klik "Simpan Agenda")
  };

  return (
    <Modal title={event?.id ? 'Edit Agenda' : 'Agenda Baru'} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Tipe Agenda">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(EVENT_TYPE).map(([k, v]) => (
              <button key={k} onClick={() => setForm({ ...form, type: k })}
                className={`px-2 py-2 rounded-lg border-2 text-xs font-semibold transition ${form.type === k ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <div className="text-lg">{v.icon}</div>
                <div>{v.label}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Judul Agenda *">
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Mis. Weekly review tim creator manager"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>
        <Field label="Deskripsi / Detail">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3} placeholder="Apa yang akan dibahas, link Zoom, dll"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tanggal *">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="Jam Mulai *">
            <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="Jam Selesai">
            <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
        </div>
        <Field label="Lokasi / Link">
          <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
            placeholder="Ruang meeting, Zoom link, Google Meet link, alamat kantor"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>
        <Field label="Peserta (opsional)">
          <div className="flex items-center gap-2 mb-2">
            <button type="button"
              onClick={() => setForm({ ...form, attendeeIds: selectableUsers.map(u => u.id) })}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition">
              ✓ Centang Semua {canAll ? 'Tim' : 'Anggota Saya'}
            </button>
            <button type="button"
              onClick={() => setForm({ ...form, attendeeIds: [] })}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
              Hapus Semua
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto scroll-thin border border-slate-200 rounded-lg p-2 space-y-1">
            {selectableUsers.map(u => (
              <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                <input type="checkbox" checked={form.attendeeIds.includes(u.id)}
                  onChange={() => toggleAttendee(u.id)} />
                <span className="text-sm">{u.name}</span>
                {u.jobTitle && <span className="text-xs text-slate-500">· {u.jobTitle}</span>}
                {!u.gmail && <span className="text-[10px] text-amber-600" title="Belum isi Gmail — tidak akan diundang ke Google Calendar">⚠ no gmail</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${ROLES[u.role].color}`}>{ROLES[u.role].label}</span>
              </label>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{form.attendeeIds.length} dari {selectableUsers.length} anggota dipilih{!canAll ? ' (timmu)' : ''}. Yang sudah isi Gmail akan diundang otomatis ke Google Calendar.</div>
        </Field>
        {gcalReady && (
          <label className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 cursor-pointer">
            <input type="checkbox" checked={addGcal} onChange={e => setAddGcal(e.target.checked)} className="mt-0.5" />
            <span className="text-sm text-emerald-800">
              <b>Tambahkan otomatis ke Google Calendar saya</b>
              <span className="block text-[11px] text-emerald-700 mt-0.5">Saat disimpan, agenda langsung masuk Google Calendar akun Google yang kamu pilih (pertama kali akan diminta login & izin). Peserta yang punya Gmail otomatis diundang via email.</span>
            </span>
          </label>
        )}
        <FormActions onCancel={onClose} onSave={submit} disabled={busy || !form.title.trim() || !form.date || !form.time}
          saveLabel={busy ? 'Menyimpan ke Google…' : (event?.id ? 'Update Agenda' : 'Simpan Agenda')} />
      </div>
    </Modal>
  );
}

function EventDetailModal({ event, user, onEdit, onDelete, onClose }) {
  const canEdit = user.role === 'manajer' || user.role === 'owner' || !!user.isSecretariat || event.createdById === user.id;
  const [gcalBusy, setGcalBusy] = useState(false);
  const addToGcalAuto = async () => {
    setGcalBusy(true);
    try {
      await addEventToGoogleCalendar(event);
      alert('✅ Agenda ditambahkan ke Google Calendar kamu.' + (event.attendeeEmails?.length ? ` ${event.attendeeEmails.length} peserta diundang.` : ''));
    } catch (e) { alert('Gagal: ' + (e?.message || e)); }
    setGcalBusy(false);
  };

  // Generate Google Calendar URL (+ undang peserta yang punya Gmail)
  const googleCalendarUrl = useMemo(() => {
    const formatGCalDate = (date, time) => {
      const d = new Date(`${date}T${time || '00:00'}:00`);
      return d.toISOString().replace(/-|:|\.\d+/g, '');
    };
    const startTime = event.time || '00:00';
    const endTime = event.endTime || (event.time ? `${String(Math.min(23, parseInt(event.time.split(':')[0]) + 1)).padStart(2, '0')}:${event.time.split(':')[1]}` : '23:59');
    const start = formatGCalDate(event.date, startTime);
    const end = formatGCalDate(event.date, endTime);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${start}/${end}`,
      details: event.description || '',
      location: event.location || ''
    });
    if (event.attendeeEmails && event.attendeeEmails.length > 0) {
      params.set('add', event.attendeeEmails.join(','));
    }
    return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`;
  }, [event]);

  const downloadICS = () => {
    const formatICSDate = (date, time) => {
      const d = new Date(`${date}T${time || '00:00'}:00`);
      return d.toISOString().replace(/-|:|\.\d+/g, '');
    };
    const startTime = event.time || '00:00';
    const endTime = event.endTime || (event.time ? `${String(Math.min(23, parseInt(event.time.split(':')[0]) + 1)).padStart(2, '0')}:${event.time.split(':')[1]}` : '23:59');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AlKahfiCorp//TeamApp//ID',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${event.id}@alkahfi-corp`,
      `DTSTAMP:${formatICSDate(dayKey(), '00:00')}`,
      `DTSTART:${formatICSDate(event.date, startTime)}`,
      `DTEND:${formatICSDate(event.date, endTime)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${event.location || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const typeDef = EVENT_TYPE[event.type] || EVENT_TYPE.lain;
  return (
    <Modal title="Detail Agenda" onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <span className={`text-xs px-2 py-1 rounded font-semibold ${typeDef.color}`}>{typeDef.icon} {typeDef.label}</span>
          <h3 className="font-display font-bold text-slate-900 text-xl mt-2">{event.title}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-slate-500">Tanggal</div>
            <div className="font-semibold text-slate-800 mt-1">{fmtDate(event.date)}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-slate-500">Waktu</div>
            <div className="font-semibold text-slate-800 mt-1">{event.time}{event.endTime && ` – ${event.endTime}`}</div>
          </div>
        </div>
        {event.location && (
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Lokasi</div>
            <div className="text-slate-800 mt-1 text-sm">
              {event.location.startsWith('http') ? (
                <a href={event.location} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1">{event.location} <ExternalLink className="w-3 h-3" /></a>
              ) : event.location}
            </div>
          </div>
        )}
        {event.description && (
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Deskripsi</div>
            <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{event.description}</div>
          </div>
        )}
        {event.attendeeNames && event.attendeeNames.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Peserta ({event.attendeeNames.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {event.attendeeNames.map((name, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-slate-100 rounded">{name}</span>
              ))}
            </div>
          </div>
        )}
        <div className="text-[10px] text-slate-500 pt-3 border-t border-slate-100">
          Dibuat oleh {event.createdByName} · {fmtDateTime(event.createdAt)}
        </div>

        {/* Action buttons */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-50 border border-blue-200 p-4 rounded-lg space-y-2">
          <div className="text-sm font-semibold text-slate-800">Tambahkan ke kalender:</div>
          {event.attendeeEmails && event.attendeeEmails.length > 0 && (
            <div className="text-[11px] text-blue-800 bg-white/70 border border-blue-100 rounded-lg px-2.5 py-1.5">
              📨 {event.attendeeEmails.length} peserta akan <b>diundang otomatis</b> (Google kirim undangan ke Gmail mereka) saat kamu klik tombol Google Calendar lalu <b>Simpan</b>.
            </div>
          )}
          {GOOGLE_CLIENT_ID && (
            <button onClick={addToGcalAuto} disabled={gcalBusy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4" /> {gcalBusy ? 'Menambahkan…' : 'Tambah Otomatis ke Google Calendar'}
            </button>
          )}
          <div className="flex gap-2 flex-wrap">
            <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <CalendarDays className="w-4 h-4" /> {GOOGLE_CLIENT_ID ? 'Buka di Google Calendar' : 'Google Calendar'} {event.attendeeEmails?.length ? '+ Undang Tim' : ''}
            </a>
            <button onClick={downloadICS}
              className="flex-1 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <FileDown className="w-4 h-4" /> Download .ics
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <>
              <button onClick={onEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button onClick={onDelete}
                className="bg-white border border-red-300 hover:bg-red-50 text-red-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Hapus
              </button>
            </>
          )}
          <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">Tutup</button>
        </div>
      </div>
    </Modal>
  );
}

// ============ PROFILE MODAL (Foto + Password) ============
function ProfileModal({ user, onSaveProfile, onChangePassword, onClose }) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    gmail: user.gmail || '',
    avatarImage: user.avatarImage || null
  });
  const [pwForm, setPwForm] = useState({ oldPw: '', newPw: '', confirmPw: '' });
  const [showPwSection, setShowPwSection] = useState(false);
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pwError, setPwError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('File harus berupa gambar (PNG/JPG/WEBP).');
    if (file.size > 5 * 1024 * 1024) return alert('Ukuran file maksimal 5MB.');
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 256;
        let { width, height } = img;
        // Crop to square, then resize
        const size = Math.min(width, height);
        const sx = (width - size) / 2;
        const sy = (height - size) / 2;
        canvas.width = MAX;
        canvas.height = MAX;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, MAX, MAX);
        ctx.drawImage(img, sx, sy, size, size, 0, 0, MAX, MAX);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        setForm({ ...form, avatarImage: compressed });
        setUploading(false);
      };
      img.onerror = () => { setUploading(false); alert('Gagal membaca gambar.'); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const submitProfile = async () => {
    setError('');
    if (!form.name.trim()) return setError('Nama tidak boleh kosong.');
    await onSaveProfile({
      name: form.name.trim(),
      phone: form.phone.trim(),
      gmail: form.gmail.trim(),
      avatarImage: form.avatarImage
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const submitPassword = async () => {
    setPwError('');
    if (!pwForm.oldPw || !pwForm.newPw || !pwForm.confirmPw) return setPwError('Lengkapi semua field password.');
    if (pwForm.newPw.length < 6) return setPwError('Password baru minimal 6 karakter.');
    if (pwForm.newPw !== pwForm.confirmPw) return setPwError('Konfirmasi password tidak cocok.');
    if (pwForm.oldPw === pwForm.newPw) return setPwError('Password baru harus berbeda dari yang lama.');
    const oldHash = await hashPassword(pwForm.oldPw, user.salt);
    if (oldHash !== user.passwordHash) return setPwError('Password lama salah.');
    const salt = genSalt();
    const passwordHash = await hashPassword(pwForm.newPw, salt);
    await onChangePassword({ salt, passwordHash });
    setPwForm({ oldPw: '', newPw: '', confirmPw: '' });
    setPwSaved(true);
    setTimeout(() => { setPwSaved(false); setShowPwSection(false); }, 2500);
  };

  return (
    <Modal title="Profil Saya" onClose={onClose} wide>
      <div className="space-y-5">
        {/* Avatar section */}
        <div className="flex items-center gap-5 pb-5 border-b border-slate-100">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-3xl overflow-hidden border-4 border-white shadow-lg">
              {form.avatarImage
                ? <img src={form.avatarImage} alt="" className="w-full h-full object-cover" />
                : form.name.charAt(0).toUpperCase()}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              title="Ganti foto profil"
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50">
              <ImagePlus className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl text-slate-900">{user.name}</div>
            <div className="text-sm text-slate-500">@{user.username}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded ${ROLES[user.role].color}`}>{ROLES[user.role].label}</span>
              {user.jobTitle && <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{user.jobTitle}</span>}
            </div>
            {form.avatarImage && (
              <button onClick={() => setForm({ ...form, avatarImage: null })}
                className="text-xs text-red-600 hover:text-red-700 font-semibold mt-2">Hapus foto profil</button>
            )}
            <div className="text-[11px] text-slate-500 mt-1">
              {uploading ? 'Memproses foto...' : 'Format: PNG/JPG. Otomatis di-crop kotak & di-resize.'}
            </div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="space-y-3">
          <Field label="Nama Lengkap *">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="No. WhatsApp">
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="08xxxxxxxxxx"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="Gmail (untuk undangan Google Calendar)">
            <input type="email" value={form.gmail} onChange={e => setForm({ ...form, gmail: e.target.value })}
              placeholder="nama@gmail.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="text-[11px] text-slate-500 mt-1">💡 Isi Gmail-mu supaya otomatis diundang ke agenda tim di Google Calendar.</div>
          </Field>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-blue-700 font-semibold">✓ Profil tersimpan</span>}
            <button onClick={submitProfile}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold">
              Simpan Profil
            </button>
          </div>
        </div>

        {/* Read-only info */}
        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
          <div>📌 <b>Username</b>: @{user.username} <span className="text-slate-400">(tidak bisa diubah)</span></div>
          <div>👤 <b>Peran</b>: {ROLES[user.role].label} <span className="text-slate-400">(diatur oleh Manajer)</span></div>
          {user.jobTitle && <div>🎯 <b>Posisi</b>: {user.jobTitle} <span className="text-slate-400">(diatur oleh Manajer/Leader)</span></div>}
        </div>

        {/* Password section */}
        <div className="border-t border-slate-100 pt-5">
          {!showPwSection ? (
            <button onClick={() => setShowPwSection(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 py-2.5 rounded-lg font-semibold text-sm">
              <Lock className="w-4 h-4" /> Ganti Password
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Ganti Password
                </h3>
                <button onClick={() => { setShowPwSection(false); setPwForm({ oldPw: '', newPw: '', confirmPw: '' }); setPwError(''); }}
                  className="text-xs text-slate-500 hover:text-slate-700">Batal</button>
              </div>
              <Field label="Password Lama *">
                <div className="relative">
                  <input type={showOldPw ? 'text' : 'password'} value={pwForm.oldPw}
                    onChange={e => setPwForm({ ...pwForm, oldPw: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10" />
                  <button type="button" onClick={() => setShowOldPw(!showOldPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Password Baru * (minimal 6 karakter)">
                <div className="relative">
                  <input type={showNewPw ? 'text' : 'password'} value={pwForm.newPw}
                    onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10" />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Konfirmasi Password Baru *">
                <input type={showNewPw ? 'text' : 'password'} value={pwForm.confirmPw}
                  onChange={e => setPwForm({ ...pwForm, confirmPw: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </Field>
              {pwError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{pwError}</div>}
              <div className="flex items-center justify-end gap-3">
                {pwSaved && <span className="text-sm text-blue-700 font-semibold">✓ Password berhasil diubah</span>}
                <button onClick={submitPassword}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold">
                  Ganti Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============ SHARED COMPONENTS ============
function NoAccess() {
  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
      <h3 className="font-display font-bold text-slate-700">Akses Dibatasi</h3>
      <p className="text-sm text-slate-500 mt-1">Halaman ini hanya untuk Manajer / Leader.</p>
    </div>
  );
}
function EmptyState({ icon: Icon, text }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 text-center py-12 text-slate-400">
      <Icon className="w-12 h-12 mx-auto mb-3 text-slate-200" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
// ============ KEUANGAN (FINANCE) ============
const FIN_DIVISIONS = {
  mcn:        { label: 'MCN', color: '#10B981' },
  tap:        { label: 'TAP', color: '#F97316' },
  affiliator: { label: 'Affiliator', color: '#2563EB' },
  corp:       { label: 'Al-Kahfi Corp', color: '#7C3AED' }
};
const FIN_CAT_IN = ['Komisi Affiliate', 'Pendapatan MCN', 'Pendapatan TAP', 'Pengembalian Dana', 'Pemasukan Lain', 'Saldo Awal'];
const FIN_CAT_OUT = ['Gaji & Bonus', 'Operasional', 'Internet & Komunikasi', 'Iklan & Promosi', 'Aset & Peralatan', 'Software & Langganan', 'Transportasi & Pengiriman', 'Konsumsi & Meeting', 'Kesejahteraan Karyawan', 'Deviden', 'Pajak', 'Donasi', 'Administrasi Bank', 'Beban Lain'];
const finIsSaldoAwal = (e) => e.kategori === 'Saldo Awal';
function canManageFinance(user) {
  return user.role === 'owner' || user.role === 'manajer' || user.division === 'keuangan' || user.division === 'manajemen';
}

function FinStat({ label, value, icon: Icon, tone }) {
  const tones = { emerald: ['#ECFDF5', '#10B981'], rose: ['#FFF1F2', '#F43F5E'], blue: ['#EFF6FF', '#2563EB'], violet: ['#F5F3FF', '#7C3AED'] };
  const [bg, fg] = tones[tone] || tones.blue;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}><Icon className="w-4 h-4" style={{ color: fg }} /></span>
        <span className="text-xs font-semibold text-slate-500">{label}</span>
      </div>
      <div className="text-lg font-extrabold" style={{ color: value < 0 ? '#E11D48' : '#0F172A' }}>{fmtRupiah(value)}</div>
    </div>
  );
}

function FinBreakdown({ title, data, total, color, empty }) {
  const max = Math.max(...data.map(d => d[1]), 1);
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5">
      <h3 className="font-display font-bold text-slate-800 mb-3">{title}</h3>
      {data.length === 0 ? <div className="text-slate-400 text-sm py-6 text-center">{empty}</div> : (
        <div className="space-y-2.5">
          {data.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">{k}</span>
                <span className="font-semibold text-slate-800">{fmtRupiah(v)} <span className="text-slate-400 text-xs">({total > 0 ? Math.round(v / total * 100) : 0}%)</span></span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, backgroundColor: color }}></div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinanceInputModal({ user, editing, onClose, onSave }) {
  const [form, setForm] = useState(editing ? { ...editing } : { tanggal: dayKey(), divisi: 'affiliator', tipe: 'keluar', kategori: '', keterangan: '', jumlah: '', buktiUrl: '' });
  const [busy, setBusy] = useState(false);
  const cats = form.tipe === 'masuk' ? FIN_CAT_IN : FIN_CAT_OUT;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.tanggal && form.divisi && form.tipe && form.kategori && Number(form.jumlah) > 0;

  const handleImg = async (file) => {
    if (!file) return;
    try { setBusy(true); const b64 = await compressImageFile(file); set('buktiImg', b64); }
    catch (e) { alert(e.message || 'Gagal memproses gambar.'); }
    finally { setBusy(false); }
  };
  const submit = () => {
    if (!valid) return;
    onSave({ tanggal: form.tanggal, divisi: form.divisi, tipe: form.tipe, kategori: form.kategori, keterangan: (form.keterangan || '').trim(), jumlah: Number(form.jumlah), buktiUrl: (form.buktiUrl || '').trim(), buktiImg: form.buktiImg || null });
  };

  return (
    <Modal title={editing ? 'Edit Transaksi' : 'Input Transaksi Keuangan'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { set('tipe', 'masuk'); set('kategori', ''); }} className={`py-2.5 rounded-xl font-semibold text-sm border-2 flex items-center justify-center gap-2 ${form.tipe === 'masuk' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><TrendingUp className="w-4 h-4" /> Uang Masuk</button>
          <button onClick={() => { set('tipe', 'keluar'); set('kategori', ''); }} className={`py-2.5 rounded-xl font-semibold text-sm border-2 flex items-center justify-center gap-2 ${form.tipe === 'keluar' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500'}`}><TrendingDown className="w-4 h-4" /> Uang Keluar</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal"><input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="Divisi">
            <select value={form.divisi} onChange={e => set('divisi', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {Object.entries(FIN_DIVISIONS).map(([d, info]) => <option key={d} value={d}>{info.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Kategori">
          <select value={form.kategori} onChange={e => set('kategori', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">— Pilih kategori —</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Jumlah (Rp)">
          <input type="number" inputMode="numeric" value={form.jumlah} onChange={e => set('jumlah', e.target.value)} placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          {Number(form.jumlah) > 0 && <div className="text-xs text-slate-500 mt-1">{fmtRupiah(Number(form.jumlah))}</div>}
        </Field>
        <Field label="Keterangan (opsional)"><input value={form.keterangan} onChange={e => set('keterangan', e.target.value)} placeholder="mis. Bayar listrik/WiFi, Gaji Siti, Komisi alkahfihome" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></Field>
        <Field label="Link Bukti Google Drive (opsional)"><input value={form.buktiUrl} onChange={e => set('buktiUrl', e.target.value)} placeholder="https://drive.google.com/..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></Field>
        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide block mb-1.5">Atau upload foto bukti (opsional)</label>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">
              <ImagePlus className="w-4 h-4" /> {form.buktiImg ? 'Ganti Foto' : 'Pilih Foto'}
              <input type="file" accept="image/*" className="hidden" onChange={e => handleImg(e.target.files?.[0])} />
            </label>
            {form.buktiImg && <img src={form.buktiImg} alt="bukti" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />}
            {form.buktiImg && <button onClick={() => set('buktiImg', null)} className="text-xs text-rose-600 font-semibold">Hapus</button>}
          </div>
        </div>
        <FormActions onCancel={onClose} onSave={submit} disabled={!valid || busy} saveLabel={busy ? 'Memproses…' : 'Simpan Transaksi'} />
      </div>
    </Modal>
  );
}

// Analisis kesehatan keuangan + SWOT otomatis (rule-based dari data cashflow)
function analyzeFinance(list) {
  const monthLabelOf = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); };
  const monthShortOf = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'short' }); };
  const monthsSet = new Set(list.filter(e => e.tanggal).map(e => e.tanggal.slice(0, 7)));
  const perMonth = [...monthsSet].sort().map(mk => {
    const l = list.filter(e => (e.tanggal || '').slice(0, 7) === mk);
    const pend = l.filter(e => e.tipe === 'masuk' && !finIsSaldoAwal(e)).reduce((s, e) => s + (+e.jumlah || 0), 0);
    const beb = l.filter(e => e.tipe === 'keluar').reduce((s, e) => s + (+e.jumlah || 0), 0);
    return { mk, label: monthLabelOf(mk), short: monthShortOf(mk), pend, beb, laba: pend - beb, margin: pend > 0 ? (pend - beb) / pend : 0 };
  }).filter(m => m.pend > 0 || m.beb > 0);

  // Bulan berjalan (kalender saat ini) tidak dihitung penuh agar tren/skor adil
  const nowMk = monthKey();
  const evalMonths = (() => { const c = perMonth.filter(m => m.mk < nowMk); return c.length ? c : perMonth; })();
  const partial = perMonth.find(m => m.mk === nowMk && !evalMonths.includes(m)) || null;
  const nM = evalMonths.length;
  const totalPend = evalMonths.reduce((s, m) => s + m.pend, 0);
  const totalBeb = evalMonths.reduce((s, m) => s + m.beb, 0);
  const totalLaba = totalPend - totalBeb;
  const avgMargin = totalPend > 0 ? totalLaba / totalPend : 0;
  const rugiMonths = evalMonths.filter(m => m.laba < 0);
  const profitMonths = evalMonths.filter(m => m.laba > 0);

  const divKas = {}, divPend = {};
  Object.keys(FIN_DIVISIONS).forEach(d => {
    divKas[d] = list.filter(e => e.divisi === d).reduce((s, e) => s + (e.tipe === 'keluar' ? -1 : 1) * (+e.jumlah || 0), 0);
    divPend[d] = list.filter(e => e.divisi === d && e.tipe === 'masuk' && !finIsSaldoAwal(e)).reduce((s, e) => s + (+e.jumlah || 0), 0);
  });
  const totalKas = Object.values(divKas).reduce((a, b) => a + b, 0);
  const avgBeban = totalBeb / Math.max(nM, 1);
  const runway = avgBeban > 0 ? totalKas / avgBeban : 99;

  const bebCat = {};
  list.filter(e => e.tipe === 'keluar').forEach(e => { const k = e.kategori || 'Lainnya'; bebCat[k] = (bebCat[k] || 0) + (+e.jumlah || 0); });
  const bebSorted = Object.entries(bebCat).sort((a, b) => b[1] - a[1]);
  const topBeban = bebSorted[0] || ['—', 0];
  const gaji = bebCat['Gaji & Bonus'] || 0;
  const gajiShare = totalPend > 0 ? gaji / totalPend : 0;
  const pajakTotal = bebCat['Pajak'] || 0;

  const totalDivPend = Object.values(divPend).reduce((a, b) => a + b, 0) || 1;
  const divShares = Object.entries(divPend).map(([d, v]) => [d, v / totalDivPend]).sort((a, b) => b[1] - a[1]);
  const topDiv = divShares[0] || ['—', 0];
  const maxShare = topDiv[1];
  const smallDivs = divShares.filter(([d, sh]) => sh < 0.2 && divPend[d] > 0).map(([d]) => FIN_DIVISIONS[d]?.label || d);

  const last = evalMonths[evalMonths.length - 1], prev = evalMonths[evalMonths.length - 2];
  const labaTrend = (last && prev) ? last.laba - prev.laba : 0;
  const pendGrowth = (last && prev && prev.pend > 0) ? (last.pend - prev.pend) / prev.pend : 0;
  const best = [...evalMonths].sort((a, b) => b.laba - a.laba)[0];

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sMargin = clamp(avgMargin / 0.30, 0, 1) * 30;
  const sConsist = (profitMonths.length / Math.max(nM, 1)) * 20;
  const sRunway = clamp(runway / 3, 0, 1) * 20;
  const sTrend = !prev ? 9 : (labaTrend > 0 ? 15 : labaTrend === 0 ? 9 : 4);
  const sDiv = maxShare <= 0.5 ? 15 : maxShare <= 0.7 ? 9 : 4;
  const score = Math.round(sMargin + sConsist + sRunway + sTrend + sDiv);
  const label = score >= 80 ? 'Sehat' : score >= 60 ? 'Cukup Sehat' : score >= 40 ? 'Perlu Perhatian' : 'Kritis';
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#2563EB' : score >= 40 ? '#F59E0B' : '#EF4444';
  const runwayTxt = runway >= 99 ? '>12' : runway.toFixed(1);

  const S = [], W = [], O = [], T = [];
  if (profitMonths.length >= Math.ceil(nM * 0.6) && nM > 0) S.push(`Laba positif di ${profitMonths.length} dari ${nM} bulan.`);
  if (avgMargin >= 0.2) S.push(`Margin laba rata-rata sehat (${Math.round(avgMargin * 100)}%).`);
  if (totalKas > 0) S.push(`Saldo kas kuat: ${fmtRupiah(totalKas)} (≈ ${runwayTxt} bulan operasional).`);
  if (best && best.laba > 0) S.push(`Bulan terbaik ${best.label}: laba ${fmtRupiah(best.laba)} — model bisa sangat profitable.`);
  if (pendGrowth > 0.1) S.push(`Pendapatan bulan terakhir tumbuh ${Math.round(pendGrowth * 100)}% dari bulan sebelumnya.`);

  if (rugiMonths.length > 0) W.push(`Ada ${rugiMonths.length} bulan rugi: ${rugiMonths.map(m => `${m.short} (${fmtRupiah(m.laba)})`).join(', ')}.`);
  if (avgMargin < 0.15) W.push(`Margin tipis (${Math.round(avgMargin * 100)}%) — sedikit kenaikan beban bisa bikin rugi.`);
  if (totalBeb > 0 && topBeban[1] / totalBeb >= 0.35) W.push(`Beban "${topBeban[0]}" mendominasi ${Math.round(topBeban[1] / totalBeb * 100)}% total pengeluaran (${fmtRupiah(topBeban[1])}).`);
  if (gajiShare > 0.4) W.push(`Gaji & bonus makan ${Math.round(gajiShare * 100)}% dari pendapatan — overhead SDM tinggi.`);
  const negDiv = Object.entries(divKas).filter(([d, v]) => v < 0);
  if (negDiv.length) W.push(`Saldo kas negatif di divisi: ${negDiv.map(([d]) => FIN_DIVISIONS[d]?.label || d).join(', ')}.`);

  if (best && best.laba > 0 && nM > 0) O.push(`Kalau tiap bulan mendekati ${best.label}, potensi laba ${fmtRupiah(best.laba * nM)}+/periode.`);
  if (smallDivs.length) O.push(`Divisi ${smallDivs.join(' & ')} masih kecil — ruang tumbuh besar untuk diversifikasi pendapatan.`);
  if (topBeban[1] > 0) O.push(`Efisiensi: menekan beban "${topBeban[0]}" 15% saja menghemat ≈ ${fmtRupiah(Math.round(topBeban[1] * 0.15))}.`);

  if (maxShare > 0.7) T.push(`Ketergantungan tinggi pada ${FIN_DIVISIONS[topDiv[0]]?.label || topDiv[0]} (${Math.round(maxShare * 100)}% pendapatan) — berisiko bila divisi itu turun.`);
  if (labaTrend < 0) T.push(`Tren laba menurun: bulan terakhir turun ${fmtRupiah(Math.abs(labaTrend))} dari bulan sebelumnya.`);
  if (runway < 3 && runway < 99) T.push(`Runway kas hanya ≈ ${runwayTxt} bulan — rawan bila ada rugi beruntun.`);
  if (totalPend > 0 && pajakTotal / totalPend < 0.005) T.push(`Pencadangan pajak sangat kecil (${fmtRupiah(pajakTotal)}) — risiko kewajiban pajak menumpuk.`);

  const evaluasi = `Selama ${nM} bulan tercatat, total pendapatan ${fmtRupiah(totalPend)} dan beban ${fmtRupiah(totalBeb)}, menghasilkan ${totalLaba >= 0 ? 'laba' : 'rugi'} bersih ${fmtRupiah(totalLaba)} (margin ${Math.round(avgMargin * 100)}%). ${profitMonths.length} dari ${nM} bulan untung${rugiMonths.length ? `, namun ${rugiMonths.map(m => m.short).join(' & ')} merugi` : ''}. Saldo kas saat ini ${fmtRupiah(totalKas)} setara ±${runwayTxt} bulan biaya operasional. Pendapatan paling bergantung pada ${FIN_DIVISIONS[topDiv[0]]?.label || topDiv[0]} (${Math.round(maxShare * 100)}%), dan pengeluaran terbesar di "${topBeban[0]}".${partial ? ` (Bulan ${partial.short} masih berjalan — belum dihitung penuh.)` : ''}`;

  const R = [];
  if (rugiMonths.length) R.push(`Audit bulan rugi (${rugiMonths.map(m => m.short).join(', ')}): pastikan komisi/beban yang dibayar tidak melebihi pendapatan yang masuk di bulan yang sama.`);
  if (totalBeb > 0) R.push(`Tetapkan plafon untuk "${topBeban[0]}" (kini ${Math.round(topBeban[1] / totalBeb * 100)}% beban). Target hemat 10–15% = ${fmtRupiah(Math.round(topBeban[1] * 0.12))}.`);
  if (maxShare > 0.6) R.push(`Kurangi ketergantungan pada ${FIN_DIVISIONS[topDiv[0]]?.label || topDiv[0]}: dorong ${smallDivs.length ? smallDivs.join(' & ') : 'divisi lain'} naik agar pendapatan lebih merata.`);
  R.push(`Sisihkan 0,5–1% pendapatan tiap bulan untuk pajak & dana darurat (jaga runway minimal 3 bulan beban = ${fmtRupiah(Math.round(avgBeban * 3))}).`);
  if (gajiShare > 0.4) R.push(`Tinjau struktur gaji/bonus (${Math.round(gajiShare * 100)}% dari pendapatan): kaitkan bonus ke target penjualan agar beban ikut turun saat omzet turun.`);
  if (best && best.laba > 0) R.push(`Jadikan ${best.label} (laba ${fmtRupiah(best.laba)}) sebagai benchmark target bulanan — pelajari apa yang bikin bulan itu bagus lalu ulangi.`);

  return { perMonth, nM, totalPend, totalBeb, totalLaba, avgMargin, rugiMonths, profitMonths, totalKas, runway, runwayTxt, divKas, divShares, topDiv, maxShare, topBeban, bebSorted, score, label, color, S, W, O, T, evaluasi, R, best, scoreParts: { sMargin, sConsist, sRunway, sTrend, sDiv } };
}

function FinanceAnalysis({ list, scopeLabel }) {
  const a = useMemo(() => analyzeFinance(list), [list]);
  if (a.nM === 0) return <div className="text-slate-400 text-sm py-12 text-center bg-white rounded-2xl border border-slate-200/70">Belum ada cukup data untuk analisis. Input transaksi atau impor data dulu.</div>;
  const quad = (title, arr, bg, fg, Icon) => (
    <div className="rounded-2xl border p-4" style={{ borderColor: fg + '33', backgroundColor: bg }}>
      <div className="flex items-center gap-2 mb-2 font-bold text-sm" style={{ color: fg }}><Icon className="w-4 h-4" /> {title}</div>
      {arr.length === 0 ? <div className="text-xs text-slate-400">Tidak ada poin menonjol.</div> : <ul className="space-y-1.5">{arr.map((t, i) => <li key={i} className="text-xs text-slate-600 leading-relaxed flex gap-1.5"><span style={{ color: fg }}>•</span><span>{t}</span></li>)}</ul>}
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/70 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Skor Kesehatan Keuangan · {scopeLabel}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold" style={{ color: a.color }}>{a.score}</span>
              <span className="text-slate-400 font-semibold">/100</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white ml-1" style={{ backgroundColor: a.color }}>{a.label}</span>
            </div>
          </div>
          <div className="flex-1 min-w-[220px] max-w-md">
            {[['Margin laba', a.scoreParts.sMargin, 30], ['Konsistensi untung', a.scoreParts.sConsist, 20], ['Ketahanan kas', a.scoreParts.sRunway, 20], ['Tren laba', a.scoreParts.sTrend, 15], ['Diversifikasi', a.scoreParts.sDiv, 15]].map(([lab, val, mx]) => (
              <div key={lab} className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-500 w-32">{lab}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(val / mx) * 100}%`, backgroundColor: a.color }}></div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${a.score}%`, backgroundColor: a.color }}></div></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 p-5">
        <h3 className="font-display font-bold text-slate-800 mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-600" /> Evaluasi</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{a.evaluasi}</p>
      </div>

      <div>
        <h3 className="font-display font-bold text-slate-800 mb-3">Analisis SWOT Keuangan</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {quad('Kekuatan (Strengths)', a.S, '#ECFDF5', '#059669', TrendingUp)}
          {quad('Kelemahan (Weaknesses)', a.W, '#FEF2F2', '#DC2626', TrendingDown)}
          {quad('Peluang (Opportunities)', a.O, '#EFF6FF', '#2563EB', Sparkles)}
          {quad('Ancaman (Threats)', a.T, '#FFF7ED', '#EA580C', AlertCircle)}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 p-5">
        <h3 className="font-display font-bold text-slate-800 mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Rekomendasi & Langkah</h3>
        <ol className="space-y-2.5">
          {a.R.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center">{i + 1}</span>
              <span className="leading-relaxed">{r}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function KeuanganView({ user, allUsers }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [mKey, setMKey] = useState(monthKey());
  const [filterDiv, setFilterDiv] = useState('all');
  const [showInput, setShowInput] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');

  const canManage = canManageFinance(user);

  const load = async () => {
    try { setItems(await storage.getList('keuangan:cashflow')); }
    catch (e) { console.warn('Load keuangan gagal (pertahankan data lama):', e?.message || e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const monthLabel = (() => { const [y, m] = mKey.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); })();
  const shiftMonth = (delta) => { const [y, m] = mKey.split('-').map(Number); setMKey(monthKey(new Date(y, m - 1 + delta, 1))); };

  const inDiv = (e) => filterDiv === 'all' || e.divisi === filterDiv;
  const inMonth = (e) => e.tanggal && e.tanggal.slice(0, 7) === mKey;

  // Running saldo per divisi (kronologis)
  const saldoMap = useMemo(() => {
    const sorted = [...items].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
    const acc = {}; const map = {};
    sorted.forEach(e => { acc[e.divisi] = (acc[e.divisi] || 0) + (e.tipe === 'keluar' ? -1 : 1) * (Number(e.jumlah) || 0); map[e.id] = acc[e.divisi]; });
    return map;
  }, [items]);

  const saveItem = async (data) => {
    try {
      let list = await storage.getList('keuangan:cashflow');
      if (editing) list = list.map(e => e.id === editing.id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e);
      else list.unshift({ id: uid(), ...data, inputById: user.id, inputByName: user.name, createdAt: new Date().toISOString() });
      await storage.set('keuangan:cashflow', list);
      await logActivity(`keuangan ${FIN_DIVISIONS[data.divisi]?.label || ''} ${data.tanggal}: ${data.tipe === 'keluar' ? '-' : '+'}${fmtRupiah(data.jumlah)} (${data.kategori})`, user.name);
      setShowInput(false); setEditing(null); load();
    } catch (err) { alert('⚠️ Gagal menyimpan: ' + (err?.message || err) + '\n\nData lama tidak diubah. Coba lagi saat koneksi stabil.'); }
  };
  const deleteItem = async (e) => {
    if (!confirm(`Hapus transaksi "${e.keterangan || e.kategori}" (${fmtRupiah(e.jumlah)})?`)) return;
    try { const fresh = await storage.getList('keuangan:cashflow'); await storage.set('keuangan:cashflow', fresh.filter(x => x.id !== e.id)); load(); }
    catch (err) { alert('⚠️ Gagal menghapus: ' + (err?.message || err)); }
  };

  // Metrik bulan terpilih (ikut filter divisi)
  const monthList = items.filter(e => inMonth(e) && inDiv(e));
  const totalPendapatan = monthList.filter(e => e.tipe === 'masuk' && !finIsSaldoAwal(e)).reduce((s, e) => s + (Number(e.jumlah) || 0), 0);
  const totalBeban = monthList.filter(e => e.tipe === 'keluar').reduce((s, e) => s + (Number(e.jumlah) || 0), 0);
  const labaBersih = totalPendapatan - totalBeban;
  const saldoKas = items.filter(e => inDiv(e) && (e.tanggal || '').slice(0, 7) <= mKey).reduce((s, e) => s + (e.tipe === 'keluar' ? -1 : 1) * (Number(e.jumlah) || 0), 0);

  const breakdown = (tipe) => {
    const m = {};
    monthList.filter(e => e.tipe === tipe && !(tipe === 'masuk' && finIsSaldoAwal(e))).forEach(e => { const k = e.kategori || 'Lainnya'; m[k] = (m[k] || 0) + (Number(e.jumlah) || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const bdKeluar = useMemo(() => breakdown('keluar'), [items, mKey, filterDiv]);
  const bdMasuk = useMemo(() => breakdown('masuk'), [items, mKey, filterDiv]);

  const kasPerDiv = useMemo(() => {
    const r = {};
    Object.keys(FIN_DIVISIONS).forEach(d => { r[d] = items.filter(e => e.divisi === d && (e.tanggal || '').slice(0, 7) <= mKey).reduce((s, e) => s + (e.tipe === 'keluar' ? -1 : 1) * (Number(e.jumlah) || 0), 0); });
    return r;
  }, [items, mKey]);

  // Tren 6 bulan (Pendapatan vs Beban) utk filter divisi
  const trend = useMemo(() => {
    const months = [];
    const [y, m] = mKey.split('-').map(Number);
    for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(y, m - 1 - i, 1)));
    const mk2series = (tipe) => months.map(mk => {
      const v = items.filter(e => inDiv(e) && (e.tanggal || '').slice(0, 7) === mk && e.tipe === tipe && !(tipe === 'masuk' && finIsSaldoAwal(e))).reduce((s, e) => s + (Number(e.jumlah) || 0), 0);
      return { date: mk + '-01', value: v, day: new Date(mk + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short' }) };
    });
    const pend = mk2series('masuk'), beb = mk2series('keluar');
    return { pend, beb, hasData: pend.some(p => p.value) || beb.some(b => b.value) };
  }, [items, mKey, filterDiv]);

  const tableList = items.filter(e => inMonth(e) && inDiv(e) && (!q || (e.keterangan || '').toLowerCase().includes(q.toLowerCase()) || (e.kategori || '').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = [...items].filter(e => inMonth(e) && inDiv(e)).sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''))
      .map(e => ({ Tanggal: e.tanggal, Divisi: FIN_DIVISIONS[e.divisi]?.label || e.divisi, Tipe: e.tipe === 'keluar' ? 'Keluar' : 'Masuk', Kategori: e.kategori, Keterangan: e.keterangan || '', Masuk: e.tipe === 'masuk' ? Number(e.jumlah) || 0 : '', Keluar: e.tipe === 'keluar' ? Number(e.jumlah) || 0 : '', Saldo: saldoMap[e.id] ?? '', Bukti: e.buktiUrl || '' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 13 }, { wch: 8 }, { wch: 20 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');
    XLSX.writeFile(wb, `Keuangan-${filterDiv === 'all' ? 'Semua' : FIN_DIVISIONS[filterDiv]?.label}-${mKey}.xlsx`);
  };

  if (loading) return <div className="text-slate-400 text-sm">Memuat data keuangan…</div>;

  const TABS = [['dashboard', 'Dashboard', BarChart3], ['transaksi', 'Cash Flow', Receipt], ['labarugi', 'Laba Rugi', FileSpreadsheet]];
  const totalKas = Object.values(kasPerDiv).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-6xl">
      <PageHeader title="Keuangan" subtitle="Cash flow, laba rugi & posisi kas — MCN · TAP · Affiliator · Corp"
        action={canManage && (
          <button onClick={() => { setEditing(null); setShowInput(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Input Transaksi</button>
        )} />

      <div className="flex items-center gap-1.5 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${tab === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setFilterDiv('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filterDiv === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>Semua</button>
          {Object.entries(FIN_DIVISIONS).map(([d, info]) => (
            <button key={d} onClick={() => setFilterDiv(d)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filterDiv === d ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`} style={filterDiv === d ? { backgroundColor: info.color } : {}}>{info.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"><ArrowLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-slate-700 min-w-[130px] text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"><ArrowRight className="w-4 h-4" /></button>
        </div>
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FinStat label="Total Pendapatan" value={totalPendapatan} icon={TrendingUp} tone="emerald" />
            <FinStat label="Total Beban" value={totalBeban} icon={TrendingDown} tone="rose" />
            <FinStat label={labaBersih < 0 ? 'Rugi Bersih' : 'Laba Bersih'} value={labaBersih} icon={BarChart3} tone={labaBersih < 0 ? 'rose' : 'blue'} />
            <FinStat label="Saldo Kas" value={saldoKas} icon={Wallet} tone="violet" />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-slate-800">Tren 6 Bulan</h3>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }}></span>Pendapatan</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#F43F5E' }}></span>Beban</span>
                </div>
              </div>
              {trend.hasData ? (
                <InteractiveLineChart lines={[{ label: 'Pendapatan', color: '#10B981', series: trend.pend }, { label: 'Beban', color: '#F43F5E', series: trend.beb }]} height={170} />
              ) : <div className="text-slate-400 text-sm py-12 text-center">Belum ada data untuk ditampilkan.</div>}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5">
              <h3 className="font-display font-bold text-slate-800 mb-3">Posisi Kas per Divisi</h3>
              <div className="space-y-2.5">
                {Object.entries(FIN_DIVISIONS).map(([d, info]) => (
                  <div key={d} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600"><span className="w-2.5 h-2.5 rounded-full" style={{ background: info.color }}></span>{info.label}</span>
                    <span className="text-sm font-bold" style={{ color: kasPerDiv[d] < 0 ? '#E11D48' : '#0F172A' }}>{fmtRupiah(kasPerDiv[d])}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                  <span className="text-sm font-semibold text-slate-700">Total Kas</span>
                  <span className="text-sm font-extrabold text-blue-700">{fmtRupiah(totalKas)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <FinBreakdown title="Pengeluaran per Kategori" data={bdKeluar} total={totalBeban} color="#F43F5E" empty="Belum ada pengeluaran bulan ini." />
            <FinBreakdown title="Pemasukan per Kategori" data={bdMasuk} total={totalPendapatan} color="#10B981" empty="Belum ada pemasukan bulan ini." />
          </div>
          <div className="pt-3 mt-1 border-t border-slate-200/70">
            <div className="flex items-center gap-2 mb-4 mt-3">
              <Activity className="w-5 h-5 text-blue-600" />
              <h2 className="font-display font-extrabold text-lg text-slate-900">Analisis & SWOT Keuangan</h2>
              <span className="text-xs text-slate-400 font-medium">· {filterDiv === 'all' ? 'Semua Divisi' : FIN_DIVISIONS[filterDiv]?.label}</span>
            </div>
            <FinanceAnalysis list={items.filter(inDiv)} scopeLabel={filterDiv === 'all' ? 'Semua Divisi' : FIN_DIVISIONS[filterDiv]?.label} />
          </div>
        </div>
      )}

      {tab === 'transaksi' && (
        <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari keterangan/kategori…" className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm w-64 max-w-full" />
            </div>
            <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Export Excel</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                  <th className="px-4 py-2.5">Tanggal</th><th className="px-4 py-2.5">Divisi</th><th className="px-4 py-2.5">Kategori</th><th className="px-4 py-2.5">Keterangan</th><th className="px-4 py-2.5 text-right">Masuk</th><th className="px-4 py-2.5 text-right">Keluar</th><th className="px-4 py-2.5 text-right">Saldo</th><th className="px-4 py-2.5 text-center">Bukti</th>{canManage && <th className="px-4 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {tableList.length === 0 ? (
                  <tr><td colSpan={canManage ? 9 : 8} className="px-4 py-12 text-center text-slate-400">Belum ada transaksi di {monthLabel}{filterDiv !== 'all' ? ` · ${FIN_DIVISIONS[filterDiv]?.label}` : ''}.</td></tr>
                ) : tableList.map(e => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{fmtDate(e.tanggal)}</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: FIN_DIVISIONS[e.divisi]?.color || '#64748B' }}>{FIN_DIVISIONS[e.divisi]?.label || e.divisi}</span></td>
                    <td className="px-4 py-2.5 text-slate-700">{e.kategori}</td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[220px] truncate" title={e.keterangan}>{e.keterangan || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{e.tipe === 'masuk' ? fmtRupiah(e.jumlah) : ''}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-rose-600">{e.tipe === 'keluar' ? fmtRupiah(e.jumlah) : ''}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{fmtRupiah(saldoMap[e.id] || 0)}</td>
                    <td className="px-4 py-2.5 text-center">{e.buktiUrl ? <a href={e.buktiUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 inline-flex"><ExternalLink className="w-4 h-4" /></a> : e.buktiImg ? <Camera className="w-4 h-4 inline text-slate-400" /> : <span className="text-slate-300">-</span>}</td>
                    {canManage && <td className="px-4 py-2.5"><div className="flex items-center gap-1 justify-end"><button onClick={() => { setEditing(e); setShowInput(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => deleteItem(e)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'labarugi' && (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 sm:p-7 max-w-2xl">
          <div className="text-center mb-5">
            <h3 className="font-display font-extrabold text-lg text-slate-900">LAPORAN LABA RUGI</h3>
            <p className="text-sm text-slate-500">{filterDiv === 'all' ? 'Semua Divisi' : FIN_DIVISIONS[filterDiv]?.label} · {monthLabel}</p>
          </div>
          <div>
            <div className="font-bold text-slate-700 uppercase text-xs tracking-wide pb-1 border-b border-slate-200">Pendapatan</div>
            {bdMasuk.length === 0 ? <div className="text-slate-400 text-sm py-1.5">Tidak ada pendapatan.</div> : bdMasuk.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-0.5"><span className="text-slate-600 pl-3">{k}</span><span className="text-slate-800 font-medium">{fmtRupiah(v)}</span></div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-1.5 mt-1 border-t border-slate-100"><span>Total Pendapatan</span><span className="text-emerald-600">{fmtRupiah(totalPendapatan)}</span></div>
            <div className="font-bold text-slate-700 uppercase text-xs tracking-wide pb-1 border-b border-slate-200 pt-5">Beban</div>
            {bdKeluar.length === 0 ? <div className="text-slate-400 text-sm py-1.5">Tidak ada beban.</div> : bdKeluar.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-0.5"><span className="text-slate-600 pl-3">{k}</span><span className="text-slate-800 font-medium">{fmtRupiah(v)}</span></div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-1.5 mt-1 border-t border-slate-100"><span>Total Beban</span><span className="text-rose-600">{fmtRupiah(totalBeban)}</span></div>
            <div className={`flex justify-between text-base font-extrabold mt-5 p-3.5 rounded-xl ${labaBersih < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <span>{labaBersih < 0 ? 'RUGI BERSIH' : 'LABA BERSIH'}</span><span>{fmtRupiah(labaBersih)}</span>
            </div>
          </div>
        </div>
      )}

      {showInput && <FinanceInputModal user={user} editing={editing} onClose={() => { setShowInput(false); setEditing(null); }} onSave={saveItem} />}
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-6 gap-3 flex-wrap pb-4 border-b border-slate-200/60">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function MiniStat({ label, value, color = 'emerald' }) {
  const map = { emerald: 'text-blue-700', blue: 'text-blue-700', amber: 'text-amber-700' };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-sm shadow-slate-200/40">
      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${map[color]}`}>{value}</div>
    </div>
  );
}
function Modal({ title, children, onClose, wide }) {
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-start sm:items-center justify-center z-[100] p-4 sm:p-6 overflow-y-auto animate-modal-backdrop">
      <div className={`bg-white rounded-3xl shadow-2xl shadow-slate-900/30 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto scroll-thin border border-slate-200/60 my-auto animate-modal-pop`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-3xl">
          <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
function FormActions({ onCancel, onSave, disabled, saveLabel = 'Simpan' }) {
  return (
    <div className="flex gap-2 pt-2">
      <button onClick={onSave} disabled={disabled}
        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg transition">
        {saveLabel}
      </button>
      <button onClick={onCancel} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">Batal</button>
    </div>
  );
}
