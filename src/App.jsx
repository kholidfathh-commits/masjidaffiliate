import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Clapperboard, CheckCircle2, GripHorizontal, Eye as EyeIcon, Settings2, BarChart2
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ============ ROLES & PERMISSIONS ============
const ROLES = {
  owner:      { label: 'Owner',            color: 'bg-violet-100 text-violet-800 border-violet-300',   icon: Crown,     rank: 4 },
  manajer:    { label: 'Manajer',          color: 'bg-amber-100 text-amber-800 border-amber-300',      icon: Shield,    rank: 3 },
  leader:     { label: 'Leader',           color: 'bg-blue-100 text-blue-800 border-blue-300',          icon: UserCheck, rank: 2 },
  operasional:{ label: 'Karyawan',         color: 'bg-indigo-100 text-indigo-800 border-indigo-300',    icon: User,      rank: 1 }
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
const storage = {
  async get(key, shared = true) {
    if (!shared) {
      try {
        const raw = localStorage.getItem(LOCAL_PREFIX + key);
        return raw === null ? null : JSON.parse(raw);
      } catch { return null; }
    }
    try {
      const { data, error } = await supabase.from('kv_store').select('value').eq('key', key).maybeSingle();
      if (error) { console.error('Supabase get error:', key, error.message); return null; }
      return data ? data.value : null;
    } catch (e) { console.error('Supabase get failed:', key, e); return null; }
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
  }
};

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
const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtDateTime = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
const fmtNumber = n => new Intl.NumberFormat('id-ID').format(n || 0);
const fmtRupiah = n => 'Rp ' + fmtNumber(n);
const daysUntil = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
const getWeekRange = (offset = 0) => {
  const now = new Date(); now.setDate(now.getDate() + offset * 7);
  const day = now.getDay();
  const monday = new Date(now.setDate(now.getDate() - day + (day === 0 ? -6 : 1)));
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  return { start: monday.toISOString().split('T')[0], end: sunday.toISOString().split('T')[0] };
};

const PRIORITIES = {
  low:    { label: 'Rendah', color: 'bg-slate-100 text-slate-700' },
  medium: { label: 'Sedang', color: 'bg-amber-100 text-amber-800' },
  high:   { label: 'Tinggi', color: 'bg-red-100 text-red-700' }
};
const TASK_STATUS = {
  todo:        { label: 'Belum Mulai', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  in_progress: { label: 'Dikerjakan',  color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  done:        { label: 'Selesai',     color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' }
};
const CREATOR_STATUS = {
  aktif:   { label: 'Aktif',   color: 'bg-indigo-100 text-indigo-700' },
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
  published:   { label: 'Sudah Tayang', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
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
  done:        { label: 'Done',        color: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-300', bg: 'bg-indigo-50' }
};
const EVENT_TYPE = {
  meeting:  { label: 'Meeting',  icon: '👥', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  agenda:   { label: 'Agenda',   icon: '📋', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  kegiatan: { label: 'Kegiatan', icon: '🎯', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  training: { label: 'Training', icon: '🎓', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  briefing: { label: 'Briefing', icon: '🗣️', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
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
  manajemen: ['creators', 'creator-management', 'sellers', 'gmv'],
  internal:  ['gmv'],
  mcn:       ['creators', 'creator-management', 'gmv'],
  tap:       ['sellers', 'gmv'],
  media:     ['media-tasks'],
  event:     [],
  mabit:     [],
  keuangan:  ['gmv']
};
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
      const { users } = await refreshAll();
      const session = await storage.get('current-user', false);
      if (session && users.some(u => u.id === session.id)) {
        const fresh = users.find(u => u.id === session.id);
        setCurrentUser(fresh);
        setEntered(true);
      }
      const sidebarPref = await storage.get('ui:sidebar-open', false);
      if (sidebarPref !== null && typeof sidebarPref === 'boolean') setSidebarOpen(sidebarPref);
      setLoading(false);
    })();
  }, []);

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
    <div className="min-h-screen bg-[#F6F5FE]" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
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
            {view === 'dashboard' && <Dashboard user={currentUser} allUsers={allUsers} setView={setView} />}
            {view === 'tasks' && <TasksView user={currentUser} allUsers={allUsers} />}
            {view === 'todos' && <TodosView user={currentUser} allUsers={allUsers} />}
            {view === 'creators' && <CreatorsView user={currentUser} allUsers={allUsers} />}
            {view === 'creator-management' && <CreatorManagementView user={currentUser} allUsers={allUsers} />}
            {view === 'sellers' && <SellersView user={currentUser} allUsers={allUsers} />}
            {view === 'gmv' && <GmvView user={currentUser} allUsers={allUsers} />}
            {view === 'reports' && <ReportsView user={currentUser} allUsers={allUsers} />}
            {view === 'daily-reports' && <DailyReportsView user={currentUser} allUsers={allUsers} />}
            {view === 'schedule' && <ScheduleView user={currentUser} allUsers={allUsers} />}
            {view === 'calendar' && <CalendarView user={currentUser} allUsers={allUsers} />}
            {view === 'attendance' && <AttendanceView user={currentUser} allUsers={allUsers} />}
            {view === 'leaderboard' && <LeaderboardView allUsers={allUsers} />}
            {view === 'announcements' && <AnnouncementsView user={currentUser} />}
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
  const navLinks = ['Beranda', 'Fitur', 'Tim', 'Laporan', 'Kontak', 'FAQ'];
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8"
      style={{ backgroundColor: '#5B4FE5', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:wght@600;700&display=swap'); .font-display { font-family: 'Fraunces', serif; }`}</style>

      {/* White page card */}
      <div className="relative w-full max-w-6xl bg-white rounded-[28px] shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 40px 80px -20px rgba(79, 70, 229, 0.5)' }}>

        {/* Purple wave decorations (right side) */}
        <svg className="absolute right-0 top-0 h-full pointer-events-none" style={{ width: '62%' }}
          viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <path d="M 180 0 Q 80 180 200 320 Q 320 460 180 700 L 600 700 L 600 0 Z" fill="#6366F1" opacity="0.12" />
          <path d="M 280 0 Q 180 200 300 360 Q 420 520 300 700 L 600 700 L 600 0 Z" fill="#5B4FE5" opacity="0.9" />
          <path d="M 360 0 Q 280 220 380 380 Q 480 540 380 700 L 600 700 L 600 0 Z" fill="#4F46E5" opacity="0.85" />
        </svg>

        {/* Bottom purple bar */}
        <div className="absolute bottom-0 left-0 right-0 h-3" style={{ backgroundColor: '#4338CA' }}></div>

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-6 sm:px-12 py-6">
          <div className="flex items-center gap-2.5">
            {/* Dot cluster logo */}
            <div className="grid grid-cols-2 gap-0.5" style={{ width: '22px' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#5B4FE5' }}></div>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#A5B4FC' }}></div>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#A5B4FC' }}></div>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#5B4FE5' }}></div>
            </div>
            <span className="font-bold tracking-wide text-base sm:text-lg" style={{ color: '#312E81' }}>
              {(settings.appName || 'AL-KAHFI').toUpperCase()}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {navLinks.map((l, i) => (
              <button key={i} onClick={onGetStarted}
                className="text-xs lg:text-sm font-medium uppercase tracking-wide transition hover:opacity-70"
                style={{ color: i === 0 ? '#4338CA' : '#64748B' }}>
                {l}
              </button>
            ))}
          </div>
          {/* Mobile menu dots */}
          <button onClick={onGetStarted} className="md:hidden flex flex-col gap-1">
            <span className="w-5 h-0.5 rounded" style={{ backgroundColor: '#4338CA' }}></span>
            <span className="w-5 h-0.5 rounded" style={{ backgroundColor: '#4338CA' }}></span>
            <span className="w-5 h-0.5 rounded" style={{ backgroundColor: '#4338CA' }}></span>
          </button>
        </nav>

        {/* Hero */}
        <div className="relative z-10 grid lg:grid-cols-2 gap-6 px-6 sm:px-12 pb-16 pt-6 lg:pt-12 items-center">
          {/* Left: copy */}
          <div className="relative z-10">
            <h1 className="font-display font-extrabold leading-[0.92] tracking-tight"
              style={{ fontSize: 'clamp(2.8rem, 6vw, 4.5rem)' }}>
              <span style={{
                background: 'linear-gradient(180deg, #A5B4FC 0%, #818CF8 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
              }}>AL-KAHFI</span>
              <br />
              <span style={{ color: '#4338CA' }}>TEAM SUITE</span>
            </h1>
            <p className="mt-5 text-sm leading-relaxed max-w-sm" style={{ color: '#64748B' }}>
              Satu dashboard untuk kelola tugas, creator, laporan harian, jadwal live, dan performa tim affiliate agency Anda — rapi dan profesional.
            </p>
            <button onClick={onGetStarted}
              className="mt-7 inline-flex items-center gap-2 text-white font-bold text-sm px-7 py-3.5 rounded-full transition hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#4F46E5', boxShadow: '0 12px 24px -6px rgba(79, 70, 229, 0.5)' }}>
              GET STARTED
            </button>
          </div>

          {/* Right: laptop illustration */}
          <div className="relative h-[280px] sm:h-[360px] flex items-center justify-center">
            {/* Orange clouds */}
            <div className="absolute rounded-full" style={{ width: '60px', height: '22px', backgroundColor: '#FB923C', top: '8%', right: '12%', opacity: 0.9 }}></div>
            <div className="absolute rounded-full" style={{ width: '44px', height: '16px', backgroundColor: '#FBBF24', top: '30%', right: '4%', opacity: 0.85 }}></div>
            <div className="absolute rounded-full" style={{ width: '50px', height: '18px', backgroundColor: '#FB923C', bottom: '14%', left: '6%', opacity: 0.8 }}></div>
            <div className="absolute rounded-full" style={{ width: '36px', height: '14px', backgroundColor: '#FBBF24', bottom: '6%', right: '20%', opacity: 0.85 }}></div>

            {/* Laptop */}
            <div className="relative" style={{ width: 'min(340px, 90%)' }}>
              {/* Screen */}
              <div className="rounded-t-2xl p-2.5 shadow-2xl" style={{ backgroundColor: '#312E81' }}>
                <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#FFEDD5', aspectRatio: '16/10' }}>
                  <div className="p-3 h-full flex flex-col gap-2">
                    <div className="h-2.5 rounded-full" style={{ width: '40%', backgroundColor: '#FB923C' }}></div>
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      <div className="rounded-md" style={{ backgroundColor: '#FDBA74' }}></div>
                      <div className="rounded-md" style={{ backgroundColor: '#F97316' }}></div>
                      <div className="rounded-md" style={{ backgroundColor: '#FB923C' }}></div>
                    </div>
                    <div className="h-2 rounded-full" style={{ width: '70%', backgroundColor: '#FDBA74' }}></div>
                    <div className="h-2 rounded-full" style={{ width: '55%', backgroundColor: '#FED7AA' }}></div>
                  </div>
                </div>
              </div>
              {/* Base */}
              <div className="h-3 rounded-b-md" style={{ backgroundColor: '#C7D2FE' }}></div>
              <div className="h-2 mx-auto rounded-b-xl" style={{ width: '55%', backgroundColor: '#A5B4FC' }}></div>

              {/* Floating browser window (left) */}
              <div className="absolute bg-white rounded-xl shadow-xl p-2.5"
                style={{ left: '-18%', top: '38%', width: '46%' }}>
                <div className="flex gap-1 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F87171' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FBBF24' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#34D399' }}></div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full" style={{ width: '90%', backgroundColor: '#C7D2FE' }}></div>
                  <div className="h-2 rounded-full" style={{ width: '70%', backgroundColor: '#E0E7FF' }}></div>
                  <div className="h-2 rounded-full" style={{ width: '80%', backgroundColor: '#C7D2FE' }}></div>
                  <div className="h-2 rounded-full" style={{ width: '55%', backgroundColor: '#E0E7FF' }}></div>
                </div>
              </div>

              {/* Floating image card (top right) */}
              <div className="absolute bg-white rounded-xl shadow-xl p-2"
                style={{ right: '-8%', top: '-14%', width: '32%' }}>
                <div className="rounded-md flex items-center justify-center" style={{ backgroundColor: '#E0E7FF', aspectRatio: '4/3' }}>
                  <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="#818CF8" strokeWidth="1.5" />
                    <circle cx="8" cy="9" r="1.5" fill="#FBBF24" />
                    <path d="M3 18 L9 12 L13 16 L17 12 L21 17" stroke="#818CF8" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
              </div>

              {/* Floating chat bubble (top center) */}
              <div className="absolute rounded-2xl shadow-lg"
                style={{ left: '28%', top: '-22%', width: '34%', height: '34px', backgroundColor: '#E0E7FF' }}>
                <div className="p-2 space-y-1">
                  <div className="h-1.5 rounded-full" style={{ width: '70%', backgroundColor: '#A5B4FC' }}></div>
                  <div className="h-1.5 rounded-full" style={{ width: '45%', backgroundColor: '#C7D2FE' }}></div>
                </div>
              </div>

              {/* Floating small card (right) */}
              <div className="absolute bg-white rounded-xl shadow-xl p-2"
                style={{ right: '-14%', top: '46%', width: '38%' }}>
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full" style={{ width: '85%', backgroundColor: '#C7D2FE' }}></div>
                  <div className="h-1.5 rounded-full" style={{ width: '60%', backgroundColor: '#E0E7FF' }}></div>
                  <div className="h-4 w-8 rounded mt-1" style={{ backgroundColor: '#FB923C' }}></div>
                </div>
              </div>
            </div>
          </div>
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-amber-100 to-amber-50 text-amber-800 rounded-full text-xs font-bold mb-4 border border-amber-200/60 shadow-sm">
          <Crown className="w-3.5 h-3.5" /> SETUP PERTAMA
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Daftarkan Akun Owner</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">Akun pertama otomatis jadi Owner dengan akses penuh ke seluruh sistem.</p>
      </div>
      <div className="space-y-3.5">
        <Field label="Nama Lengkap">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Mis. Al-Kahfi"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] transition" />
        </Field>
        <Field label="Username (untuk login)">
          <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
            placeholder="mis. alkahfi"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] lowercase transition" />
        </Field>
        <Field label="Password (minimal 6 karakter)">
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] pr-10 transition" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <Field label="Konfirmasi Password">
          <input type={show ? 'text' : 'password'} value={form.confirmPassword}
            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] transition" />
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-xl flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
        <button onClick={submit} disabled={busy}
          className="w-full bg-gradient-to-r from-[#4F46E5] to-indigo-700 hover:from-[#4F46E5] hover:to-indigo-800 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-900/20 hover:shadow-xl hover:shadow-indigo-900/30 flex items-center justify-center gap-2 mt-2">
          <Crown className="w-4 h-4" /> {busy ? 'Memproses...' : 'Daftar & Masuk sebagai Owner'}
        </button>
        <p className="text-[11px] text-center text-slate-500 mt-3 leading-relaxed">
          <Shield className="w-3 h-3 inline -mt-0.5 mr-1 text-indigo-600" />
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 text-indigo-800 rounded-full text-xs font-bold mb-4 border border-indigo-200/60">
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
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] lowercase transition" />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] pr-10 transition" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-xl flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
        <button onClick={submit} disabled={busy}
          className="w-full bg-gradient-to-r from-[#4F46E5] to-indigo-700 hover:from-[#4F46E5] hover:to-indigo-800 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-900/20 hover:shadow-xl hover:shadow-indigo-900/30 flex items-center justify-center gap-2 mt-2">
          <Lock className="w-4 h-4" /> {busy ? 'Memproses...' : 'Masuk ke Dashboard'}
        </button>
        <p className="text-[11px] text-center text-slate-500 mt-3 leading-relaxed">
          <Shield className="w-3 h-3 inline -mt-0.5 mr-1 text-indigo-600" />
          Lupa password? Hubungi Manajer atau Leader Anda untuk reset.
        </p>
      </div>
    </AuthShell>
  );
}

function AuthShell({ settings, children }) {
  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:wght@600;700&display=swap'); .font-display { font-family: 'Fraunces', serif; }`}</style>

      {/* LEFT: Landing-style Hero panel (hidden on mobile) */}
      <div style={{ background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 50%, #1E1B4B 100%)', color: '#FFFFFF' }}
        className="hidden lg:flex lg:w-1/2 xl:w-[58%] relative overflow-hidden text-white">

        {/* Organic wave shapes (background blobs) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 1000" xmlns="http://www.w3.org/2000/svg">
          {/* Top-right gold blob */}
          <path d="M 800 0 Q 720 80 760 200 Q 800 320 700 380 Q 600 440 680 540 Q 760 640 720 720 L 800 720 Z"
            fill="rgba(252, 211, 77, 0.08)" />
          {/* Mid wave */}
          <path d="M 0 500 Q 200 460 320 540 Q 440 620 600 580 Q 720 540 800 600 L 800 1000 L 0 1000 Z"
            fill="rgba(55, 48, 163, 0.4)" />
          {/* Bottom wave */}
          <path d="M 0 700 Q 160 660 280 720 Q 400 780 540 740 Q 660 700 800 760 L 800 1000 L 0 1000 Z"
            fill="rgba(49, 46, 129, 0.5)" />
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
          style={{ background: 'rgba(252, 211, 77, 0.18)' }}></div>
        <div className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'rgba(129, 140, 248, 0.18)' }}></div>

        {/* Decorative dots (like clouds in reference) */}
        <div className="absolute top-32 right-24 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FCD34D', boxShadow: '0 0 14px rgba(252,211,77,0.7)' }}></div>
        <div className="absolute top-52 right-44 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FCD34D', opacity: 0.7, boxShadow: '0 0 8px rgba(252,211,77,0.5)' }}></div>
        <div className="absolute bottom-72 left-32 w-1 h-1 rounded-full" style={{ backgroundColor: '#FCD34D', opacity: 0.8, boxShadow: '0 0 6px rgba(252,211,77,0.5)' }}></div>

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
                <p style={{ color: '#FCD34D' }} className="text-[10px] uppercase tracking-[0.2em] font-bold">{settings.appSubtitle}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5 flex-wrap">
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#FFFFFF' }}
                className="text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">Agency</span>
              <span style={{ backgroundColor: 'rgba(252,211,77,0.18)', border: '1px solid rgba(252,211,77,0.4)', color: '#FCD34D' }}
                className="text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">Team Suite</span>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#FFFFFF' }}
                className="text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">v1.0</span>
            </div>
          </div>

          {/* Center: Hero copy + dashboard preview */}
          <div className="flex-1 flex flex-col justify-center py-8 gap-7">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-bold mb-3"
                style={{ color: '#FCD34D' }}>
                <span className="w-8 h-px" style={{ backgroundColor: 'rgba(252,211,77,0.6)' }}></span>
                MASJID AFFILIATE AGENCY
              </div>
              <h2 className="font-display font-bold leading-[0.95] mb-4 text-5xl xl:text-6xl">
                <span style={{ color: '#FFFFFF' }}>Kelola Tim</span><br/>
                <span style={{ color: '#FFFFFF' }}>Agency</span><br/>
                <span style={{
                  background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>Lebih Rapi.</span>
              </h2>
              <p style={{ color: 'rgba(209,250,229,0.9)' }} className="text-base leading-relaxed max-w-md">
                Satu dashboard untuk tugas, creator, laporan, jadwal live, dan performa tim — semua terkontrol dari satu tempat.
              </p>
            </div>

            {/* Dashboard mockup preview (decorative) */}
            <div className="relative max-w-md mt-2">
              {/* Main "browser window" */}
              <div className="rounded-2xl shadow-2xl p-3 backdrop-blur-md"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}>
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
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(252,211,77,0.18)', border: '1px solid rgba(252,211,77,0.3)' }}>
                    <div className="text-[8px] uppercase font-bold" style={{ color: '#FCD34D' }}>GMV</div>
                    <div className="text-base font-display font-bold" style={{ color: '#FCD34D' }}>Rp 85jt</div>
                  </div>
                </div>
                {/* Target row */}
                <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FCD34D' }}></div>
                      <span className="text-[9px] font-semibold" style={{ color: 'rgba(209,250,229,0.95)' }}>Target Tim Mei</span>
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: '#FCD34D' }}>68%</span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full" style={{ width: '68%', backgroundColor: '#FCD34D' }}></div>
                  </div>
                </div>
              </div>

              {/* Floating notification card (top right) */}
              <div className="absolute -top-5 -right-3 rounded-xl px-3 py-2 shadow-xl flex items-center gap-2 transform rotate-[4deg]"
                style={{ backgroundColor: '#FFFFFF', color: '#111827' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                  <Check className="w-3 h-3" style={{ color: '#4338CA' }} />
                </div>
                <div>
                  <div className="text-[9px] font-bold" style={{ color: '#111827' }}>Tugas Selesai</div>
                  <div className="text-[8px]" style={{ color: '#64748B' }}>Review video creator</div>
                </div>
              </div>

              {/* Floating user card (bottom left) */}
              <div className="absolute -bottom-4 -left-6 rounded-xl px-3 py-2 shadow-xl flex items-center gap-2 transform -rotate-[3deg]"
                style={{ backgroundColor: '#FFFFFF', color: '#111827' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ background: 'linear-gradient(135deg, #14B8A6, #4338CA)' }}>A</div>
                <div>
                  <div className="text-[10px] font-bold" style={{ color: '#111827' }}>Al-Kahfi</div>
                  <div className="text-[8px] flex items-center gap-1" style={{ color: '#64748B' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22C55E' }}></span>
                    Manajer · Online
                  </div>
                </div>
              </div>

              {/* Floating chart card (right middle) */}
              <div className="absolute top-1/2 -right-8 -translate-y-1/2 rounded-xl px-3 py-2 shadow-xl transform rotate-[6deg]"
                style={{ backgroundColor: '#FFFFFF', color: '#111827' }}>
                <div className="text-[8px] uppercase font-bold mb-1" style={{ color: '#64748B' }}>Pekan Ini</div>
                <div className="flex items-end gap-1 h-8">
                  <div className="w-1.5 rounded-t" style={{ height: '40%', backgroundColor: '#4F46E5' }}></div>
                  <div className="w-1.5 rounded-t" style={{ height: '60%', backgroundColor: '#4F46E5' }}></div>
                  <div className="w-1.5 rounded-t" style={{ height: '45%', backgroundColor: '#4F46E5' }}></div>
                  <div className="w-1.5 rounded-t" style={{ height: '80%', backgroundColor: '#D6A84F' }}></div>
                  <div className="w-1.5 rounded-t" style={{ height: '95%', backgroundColor: '#D6A84F' }}></div>
                </div>
                <div className="text-[8px] font-bold mt-1" style={{ color: '#4338CA' }}>↗ +24%</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] pt-6 border-t" style={{ borderTopColor: 'rgba(255,255,255,0.1)', color: 'rgba(167,243,208,0.6)' }}>
            <span>© {new Date().getFullYear()} Al-Kahfi Corp</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> Ter-enkripsi PBKDF2</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #F6F5FE 0%, #FFFFFF 50%, #ECFDF5 100%)' }}>
        {/* Subtle decoration */}
        <div className="absolute top-16 right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: 'rgba(199, 210, 254, 0.4)' }}></div>
        <div className="absolute bottom-16 left-16 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: 'rgba(253, 230, 138, 0.3)' }}></div>

        <div className="relative w-full max-w-md">
          {/* Mobile brand (only on small screens) */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl overflow-hidden shadow-lg shadow-indigo-900/20"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #4338CA)' }}>
              {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">{settings.appName}</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{settings.appSubtitle}</p>
            </div>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-900/10 p-8 sm:p-10 border border-slate-200/60">
            {children}
          </div>

          <div className="text-center text-[11px] text-slate-400 mt-6">
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
        { id: 'tasks', label: 'Tugas Tim', icon: CheckSquare, show: true },
        { id: 'todos', label: 'To-Do List', icon: KanbanSquare, show: true },
        { id: 'attendance', label: 'Absensi', icon: MapPin, show: true },
        { id: 'calendar', label: 'Kalender Tim', icon: CalendarDays, show: true }
      ]
    },
    {
      label: 'Creator & Seller',
      items: [
        { id: 'creators', label: 'Database Creator', icon: Users, show: canAccessFeature(user, 'creators') },
        { id: 'creator-management', label: 'Pengelolaan Creator', icon: Network, show: canAccessFeature(user, 'creator-management') },
        { id: 'sellers', label: 'Database Seller', icon: Briefcase, show: canAccessFeature(user, 'sellers') },
        { id: 'content-ideas', label: 'Bank Ide Konten', icon: Lightbulb, show: true },
        { id: 'media-tasks', label: 'Eksekusi Konten', icon: Clapperboard, show: canAccessFeature(user, 'media-tasks') }
      ]
    },
    {
      label: 'Laporan & Analitik',
      items: [
        { id: 'gmv', label: 'Target & GMV', icon: BarChart3, show: canAccessFeature(user, 'gmv') },
        { id: 'reports', label: 'Laporan Mingguan', icon: FileText, show: true },
        { id: 'daily-reports', label: 'Laporan Harian', icon: ClipboardList, show: true },
        { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, show: true }
      ]
    },
    {
      label: 'Tim & Pengaturan',
      items: [
        { id: 'users', label: 'Anggota Tim', icon: UserCog, show: user.role !== 'operasional' },
        { id: 'announcements', label: 'Pengumuman', icon: Megaphone, show: true },
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
    <aside style={{ backgroundColor: '#1E1B4B', color: '#FFFFFF' }}
      className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-200 border-r border-slate-800/50 z-40
        w-64 ${isOpen ? 'lg:w-64' : 'lg:w-16'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      {/* Tombol tutup drawer (mobile only) */}
      <button onClick={onCloseMobile} title="Tutup menu"
        className="lg:hidden absolute top-3 right-3 z-50 p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition">
        <X className="w-5 h-5" />
      </button>
      {/* Brand header */}
      <div style={{ borderBottomColor: 'rgba(30, 41, 59, 0.6)' }}
        className={`${(isOpen || mobileWide) ? 'px-5 py-5' : 'p-3'} border-b flex items-center ${(isOpen || mobileWide) ? 'justify-between gap-2' : 'justify-center lg:justify-center'}`}>
        {(isOpen) ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl flex items-center justify-center text-xl overflow-hidden flex-shrink-0 shadow-lg shadow-indigo-900/50 ring-1 ring-white/10">
                {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
              </div>
              <div className="min-w-0">
                <div style={{ color: '#FFFFFF' }} className="font-display font-bold text-base truncate">{settings.appName}</div>
                <div style={{ color: '#D6A84F' }} className="text-[9px] uppercase tracking-[0.15em] truncate font-bold">{settings.appSubtitle}</div>
              </div>
            </div>
            <button onClick={onToggle} title="Sembunyikan sidebar"
              style={{ color: '#94A3B8' }}
              className="hidden lg:flex hover:!text-white p-1 flex-shrink-0 transition">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            {/* Mobile: tampilkan brand penuh; Desktop collapsed: cuma logo */}
            <div className="flex lg:hidden items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl flex items-center justify-center text-xl overflow-hidden flex-shrink-0 shadow-lg ring-1 ring-white/10">
                {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
              </div>
              <div className="min-w-0">
                <div style={{ color: '#FFFFFF' }} className="font-display font-bold text-base truncate">{settings.appName}</div>
                <div style={{ color: '#D6A84F' }} className="text-[9px] uppercase tracking-[0.15em] truncate font-bold">{settings.appSubtitle}</div>
              </div>
            </div>
            <button onClick={onToggle} title="Tampilkan sidebar"
              className="hidden lg:flex w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl items-center justify-center text-xl overflow-hidden hover:opacity-90 transition shadow-lg ring-1 ring-white/10">
              {settings.logoImage ? <img src={settings.logoImage} alt="" className="w-full h-full object-cover" /> : settings.logoEmoji}
            </button>
          </>
        )}
      </div>

      {/* Menu groups */}
      <nav className={`flex-1 ${isOpen ? 'px-3 py-4' : 'px-2 py-3'} overflow-y-auto scroll-thin space-y-5`}>
        {menuGroups.map((group, gi) => {
          const visibleItems = group.items.filter(m => m.show);
          if (visibleItems.length === 0) return null;
          return (
            <div key={gi}>
              <div style={{ color: '#94A3B8' }}
                className={`text-[10px] uppercase tracking-[0.18em] font-bold mb-2 px-3 ${isOpen ? '' : 'lg:hidden'}`}>
                {group.label}
              </div>
              {!isOpen && gi > 0 && <div className="hidden lg:block h-px bg-slate-700 mx-2 mb-3"></div>}
              <div className="space-y-1">
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const active = view === item.id;
                  return (
                    <button key={item.id} onClick={() => handleNav(item.id)}
                      title={!isOpen ? item.label : undefined}
                      style={active
                        ? { background: 'linear-gradient(to right, #6366F1, #4F46E5)', color: '#FFFFFF' }
                        : { color: '#CBD5E1' }}
                      className={`group w-full flex items-center py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                        isOpen ? 'gap-3 px-3' : 'gap-3 px-3 lg:justify-center lg:gap-0 lg:px-2'
                      } ${
                        active
                          ? 'shadow-lg shadow-indigo-900/50 ring-1 ring-indigo-400/20'
                          : 'hover:bg-white/10 hover:text-white'
                      }`}>
                      {active && (
                        <div style={{ backgroundColor: '#D6A84F', boxShadow: '0 0 8px rgba(214,168,79,0.6)' }}
                          className={`absolute -left-3 top-2 bottom-2 w-1 rounded-r-full ${isOpen ? '' : 'lg:hidden'}`}></div>
                      )}
                      <Icon style={{ color: active ? '#FFFFFF' : '#94A3B8' }}
                        className="w-[18px] h-[18px] flex-shrink-0 group-hover:!text-white transition" />
                      <span className={`truncate font-medium ${isOpen ? '' : 'lg:hidden'}`}>{item.label}</span>
                      {active && (
                        <div style={{ backgroundColor: '#D6A84F', boxShadow: '0 0 6px rgba(214,168,79,0.6)' }}
                          className={`ml-auto w-1.5 h-1.5 rounded-full ${isOpen ? '' : 'lg:hidden'}`}></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User profile bottom */}
      <div style={{ borderTopColor: 'rgba(30, 41, 59, 0.6)' }}
        className={`border-t ${isOpen ? 'p-3' : 'p-3 lg:p-2'}`}>
        {/* Expanded profile (mobile always, desktop when open) */}
        <div className={isOpen ? 'block' : 'block lg:hidden'}>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition">
            <button onClick={onOpenProfile} title="Profil Saya"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden ring-2 ring-amber-400/30 hover:ring-amber-400/70 transition text-white">
              {user.avatarImage
                ? <img src={user.avatarImage} alt="" className="w-full h-full object-cover" />
                : user.name.charAt(0).toUpperCase()}
            </button>
            <button onClick={onOpenProfile} className="flex-1 min-w-0 text-left hover:opacity-90 transition">
              <div style={{ color: '#FFFFFF' }} className="text-sm font-semibold truncate">{user.name}</div>
              <div style={{ color: '#CBD5E1' }} className="text-[10px] flex items-center gap-1">
                <RoleIcon className="w-2.5 h-2.5" /> {ROLES[user.role].label}
              </div>
              {user.jobTitle && <div style={{ color: '#D6A84F' }} className="text-[10px] font-medium truncate mt-0.5">{user.jobTitle}</div>}
            </button>
            <button onClick={onLogout} title="Keluar"
              style={{ color: '#94A3B8' }}
              className="hover:!text-red-400 transition p-1">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Collapsed profile (desktop collapsed only) */}
        <div className={isOpen ? 'hidden' : 'hidden lg:flex flex-col items-center gap-2'}>
          <button onClick={onOpenProfile} title={`${user.name} — ${ROLES[user.role].label} (klik untuk profil)`}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center font-bold text-sm overflow-hidden ring-2 ring-amber-400/30 hover:ring-amber-400/70 transition text-white">
            {user.avatarImage
                ? <img src={user.avatarImage} alt="" className="w-full h-full object-cover" />
                : user.name.charAt(0).toUpperCase()}
            </button>
            <button onClick={onLogout} title="Keluar"
              style={{ color: '#94A3B8' }}
              className="hover:!text-red-400 p-1 transition">
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
      const tasks = await storage.getList('tasks:all');
      const announcements = await storage.getList('announcements:all');
      const lastView = await storage.get('ui:last-notif-view', false);
      if (stopped) return;
      setLastNotifView(lastView?.value || new Date(Date.now() - 7 * 86400000).toISOString());

      const notifs = [];
      // Tasks assigned to me
      tasks.filter(t => t.assigneeId === user.id && t.createdById !== user.id)
        .slice(0, 10).forEach(t => {
          notifs.push({
            id: `task-${t.id}`, type: 'task',
            title: `Tugas baru: ${t.title}`,
            subtitle: `Dari ${t.createdByName || 'Sistem'}`,
            time: t.createdAt,
            action: () => setView('tasks')
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
      const tasks = await storage.getList('tasks:all');
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

  const markNotifSeen = async () => {
    const now = new Date().toISOString();
    await storage.set('ui:last-notif-view', now, false);
    setLastNotifView(now);
  };

  const quickActions = [
    { label: 'Tugas Baru', icon: CheckSquare, view: 'tasks', color: 'text-blue-600 bg-blue-50' },
    { label: 'Creator Baru', icon: Users, view: 'creators', color: 'text-purple-600 bg-purple-50' },
    { label: 'Laporan Harian', icon: ClipboardList, view: 'daily-reports', color: 'text-indigo-600 bg-indigo-50' },
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
          const Icon = t.type === 'task' ? CheckSquare : t.type === 'comment' ? MessageSquare : Megaphone;
          const accent = t.type === 'task' ? '#4F46E5' : t.type === 'comment' ? '#9333EA' : '#D97706';
          const bg = t.type === 'task' ? '#EEF2FF' : t.type === 'comment' ? '#FAF5FF' : '#FFFBEB';
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
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${showSearchDropdown ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
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
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition flex items-center gap-3">
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
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition flex items-center gap-3">
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
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
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
            className="bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-900/15 transition">
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
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition ${soundOn ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
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
                      const icon = n.type === 'task' ? CheckSquare : n.type === 'comment' ? MessageSquare : Megaphone;
                      const Icon = icon;
                      const color = n.type === 'task' ? 'text-blue-600 bg-blue-50' : n.type === 'comment' ? 'text-purple-600 bg-purple-50' : 'text-amber-600 bg-amber-50';
                      return (
                        <button key={n.id} onClick={() => { n.action(); setShowNotifDropdown(false); }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition flex items-start gap-3 border-b border-slate-50 ${isUnread ? 'bg-indigo-50/30' : ''}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 line-clamp-1">{n.title}</div>
                            <div className="text-xs text-slate-500 line-clamp-1">{n.subtitle}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{n.time ? fmtDateTime(n.time) : ''}</div>
                          </div>
                          {isUnread && <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5"></div>}
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
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
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
function Dashboard({ user, allUsers, setView }) {
  const [tasks, setTasks] = useState([]);
  const [creators, setCreators] = useState([]);
  const [activities, setActivities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [targets, setTargets] = useState([]);
  const [gmvEntries, setGmvEntries] = useState([]);
  const [gmvTargets, setGmvTargets] = useState({});
  const [showTargetsManager, setShowTargetsManager] = useState(false);

  const loadTargets = async () => setTargets(await storage.getList('targets:all'));

  useEffect(() => {
    (async () => {
      setTasks(await storage.getList('tasks:all'));
      setCreators(await storage.getList('creators:all'));
      setActivities(await storage.getList('activities:all'));
      setAnnouncements(await storage.getList('announcements:all'));
      setSchedules(await storage.getList('schedule:all'));
      setDailyReports(await storage.getList('daily-reports:all'));
      setCalendarEvents(await storage.getList('calendar:all'));
      setGmvEntries(await storage.getList('gmv:daily'));
      setGmvTargets((await storage.get('gmv:targets')) || {});
      await loadTargets();
    })();
  }, []);

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
  const today = new Date().toISOString().split('T')[0];
  const upcomingSchedule = schedules
    .filter(s => s.date >= today && s.status !== 'cancelled')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
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
        ? { text: 'Selesai', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
        : { text: 'Aktif', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      action: () => setView('tasks')
    },
    {
      label: 'Creator Dikelola', value: fmtNumber(visibleCreators.length),
      sub: `${activeCreators} aktif dari ${visibleCreators.length}`,
      icon: Users,
      gradient: 'from-purple-500/15 to-pink-500/15 text-purple-700',
      badge: activeCreators > 0
        ? { text: 'Aktif', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
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
      gradient: 'from-violet-500/15 to-indigo-500/15 text-violet-700',
      badge: { text: 'Online', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
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
      icon: ClipboardList, iconBg: myReportedToday ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600',
      sub: myReportedToday ? 'Sudah submit' : 'Belum submit',
      action: () => setView('daily-reports')
    },
    {
      label: 'Creator Aktif', value: myActiveCreators,
      icon: Sparkles, iconBg: 'bg-rose-100 text-rose-600',
      sub: 'Yang Anda kelola',
      action: () => setView('creators')
    },
    {
      label: 'Target Aktif', value: targets.filter(t => t.status === 'active').length,
      icon: Target, iconBg: 'bg-amber-100 text-amber-600',
      sub: 'Sedang berjalan',
      action: () => canManageTargets ? setShowTargetsManager(true) : null
    }
  ];

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Hero Section */}
      <div style={{ background: 'linear-gradient(135deg, #312E81 0%, #3730A3 50%, #312E81 100%)', color: '#FFFFFF' }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-indigo-900/20">
        <div className="absolute -right-16 -top-16 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-32 bottom-0 w-40 h-40 bg-violet-300/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute right-8 top-8 w-2 h-2 bg-amber-300/40 rounded-full"></div>
        <div className="absolute right-20 top-20 w-1 h-1 bg-amber-300/60 rounded-full"></div>
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-300 text-[10px] uppercase font-bold tracking-[0.2em] flex items-center gap-1.5">
                <Sparkle className="w-3 h-3" /> {greeting}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
              {user.name.split(' ')[0]}, semangat hari ini!
            </h1>
            <p className="text-indigo-100/90 text-sm mt-2 max-w-xl">
              {myTasks.length === 0
                ? 'Tidak ada tugas tertunda. Saatnya cari peluang baru atau push konten viral.'
                : overdue > 0
                ? `${overdue} tugas terlambat dan ${myTasks.length - overdue} aktif. Mulai dari yang paling urgent.`
                : `${myTasks.length} tugas aktif menunggu. Fokus selesaikan satu demi satu.`}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => setView('tasks')}
                className="bg-white text-indigo-800 hover:bg-amber-300 hover:text-indigo-900 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md">
                <CheckSquare className="w-3.5 h-3.5" /> Lihat Tugas
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
              className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4 max-w-sm border border-white/15 text-left transition group">
              <div className="text-[9px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                <Megaphone className="w-3 h-3" /> Pengumuman Terbaru
              </div>
              <div className="font-semibold text-sm mt-1.5 line-clamp-1 group-hover:text-amber-200 transition">{latest.title}</div>
              <div className="text-[11px] text-indigo-100/80 mt-1 line-clamp-2">{latest.content}</div>
              <div className="text-[10px] text-indigo-200/60 mt-2">— {latest.authorName}</div>
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
                className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-sm shadow-slate-200/40 hover:shadow-md hover:border-slate-300/80 hover:-translate-y-0.5 transition text-left group">
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

      {/* Target Tim Widget */}
      <TargetWidget targets={targets.filter(t => t.status !== 'archived')}
        canManage={canManageTargets}
        onManage={() => setShowTargetsManager(true)} />

      {/* GMV Summary Widget */}
      {canAccessFeature(user, 'gmv') && (
        <DashboardGmvWidget entries={gmvEntries} targets={gmvTargets} onOpen={() => setView('gmv')} />
      )}

      {/* Stats grid - compact with badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <button key={i} onClick={s.action}
              className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm shadow-slate-200/40 hover:shadow-md hover:border-slate-300/80 hover:-translate-y-0.5 transition text-left group">
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
            <button onClick={() => setView('tasks')} className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold">Lihat semua →</button>
          </div>
          {myTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Check className="w-10 h-10 mx-auto mb-2 text-indigo-300" /> Tidak ada tugas terbuka. 🎉
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
              <h3 className="font-display font-bold text-lg text-slate-900">Jadwal Mendatang</h3>
              <p className="text-xs text-slate-500">{upcomingSchedule.length} agenda</p>
            </div>
            <button onClick={() => setView('schedule')} className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold">Semua →</button>
          </div>
          {upcomingSchedule.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-200" />Belum ada jadwal
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingSchedule.map(s => (
                <div key={s.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{SCHEDULE_TYPE[s.type].icon}</span>
                    <span className="text-xs font-semibold text-slate-700">{s.time}</span>
                    <span className="text-[10px] text-slate-500">{fmtDate(s.date)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-800">{s.product || s.creatorName || SCHEDULE_TYPE[s.type].label}</div>
                  <div className="text-xs text-slate-500">PIC: {s.adminName}</div>
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
                    <Pin className="w-5 h-5 text-indigo-600" /> Laporan Pinned
                  </h3>
                  <button onClick={() => setView('daily-reports')} className="text-xs text-indigo-700 font-semibold hover:text-indigo-800">Semua →</button>
                </div>
                <div className="space-y-3">
                  {pinned.map(r => (
                    <div key={r.id} className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/30">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-slate-900">{r.authorName}</span>
                        {r.authorJobTitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{r.authorJobTitle}</span>}
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
                  <button onClick={() => setView('calendar')} className="text-xs text-indigo-700 font-semibold hover:text-indigo-800">Buka Kalender →</button>
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
          <Activity className="w-5 h-5 text-indigo-600" /> Aktivitas Tim
        </h3>
        {activities.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">Belum ada aktivitas</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto scroll-thin">
            {activities.slice(0, 15).map(a => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {a.userName.charAt(0).toUpperCase()}
                </div>
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
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-indigo-600" /></div>
          <div>
            <h3 className="font-display font-bold text-slate-900">Target & GMV Bulan Ini</h3>
            <p className="text-[11px] text-slate-500">Total gabungan: <b className="text-indigo-700">{fmtRupiah(grand)}</b></p>
          </div>
        </div>
        <button onClick={onOpen} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1">
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
    <div style={{ background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 50%, #312E81 100%)', color: '#FFFFFF' }}
      className="relative overflow-hidden rounded-3xl text-white p-6 shadow-xl shadow-indigo-900/20 border border-indigo-700/30">
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
            className="hover:!bg-amber-400 hover:!text-indigo-900 backdrop-blur text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 border transition">
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
          <span style={{ backgroundColor: '#FCD34D', color: '#312E81' }}
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
          className="w-full border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-700 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
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
            <div className="text-xs font-bold text-indigo-700 uppercase mb-2">✅ Sudah Tercapai ({grouped.achieved.length})</div>
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
              <span className="text-sm font-bold text-indigo-700 ml-auto">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-1 overflow-hidden">
              <div className={`h-full transition-all ${pct >= 100 ? 'bg-indigo-500' : pct >= 75 ? 'bg-indigo-400' : pct >= 50 ? 'bg-amber-400' : pct >= 25 ? 'bg-orange-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }}></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input type="number" value={tempValue} onChange={e => setTempValue(e.target.value)}
            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm tabular-nums" />
          <button onClick={() => { onUpdateProgress(tempValue); setEditingProgress(false); }}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded font-semibold">Simpan</button>
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
            className="text-[10px] px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-semibold">
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
            className="text-[10px] px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-semibold">
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
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-indigo-700 mb-1">Preview Tampilan</div>
          <div className="bg-indigo-700 rounded p-3 text-white">
            <div className="font-semibold text-sm">{form.title || 'Judul Target'}</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xs">
                <b>{form.formatType === 'currency' ? `Rp ${fmtNumber(form.currentValue || 0)}` : form.formatType === 'percent' ? `${form.currentValue || 0}%` : `${fmtNumber(form.currentValue || 0)} ${form.unit || ''}`}</b>
                <span className="text-indigo-200"> / {form.formatType === 'currency' ? `Rp ${fmtNumber(form.targetValue || 0)}` : form.formatType === 'percent' ? `${form.targetValue || 0}%` : `${fmtNumber(form.targetValue || 0)} ${form.unit || ''}`}</span>
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
        phone: data.phone || '', salt, passwordHash,
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
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
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{m.name}</div>
                        <div className="text-xs text-slate-500">@{m.username}</div>
                        {m.jobTitle && <div className="text-[10px] mt-1 inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">{m.jobTitle}</div>}
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
    if (currentUser.role === 'owner') return ['manajer', 'leader', 'operasional'];
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
        <Field label="Username *">
          <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
            disabled={isEdit && editing.id === currentUser.id}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 lowercase disabled:bg-slate-100" />
        </Field>
        <Field label="Peran *">
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
            disabled={isEdit && editing.id === currentUser.id}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100">
            {allowedRoles.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
          </select>
        </Field>
        {form.role === 'operasional' && (
          <Field label="Leader Pengawas *">
            <select value={form.leaderId} onChange={e => setForm({ ...form, leaderId: e.target.value })}
              disabled={currentUser.role === 'leader'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100">
              <option value="">- Pilih Leader -</option>
              {leaders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Divisi / Tim *">
          <select value={form.division} onChange={e => setForm({ ...form, division: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            {Object.entries(DIVISIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="text-[11px] text-slate-500 mt-1">💡 Menu yang muncul untuk anggota ini menyesuaikan divisinya. Mis. Internal & TAP tidak melihat menu Creator.</div>
        </Field>
        <Field label="Posisi / Jabatan">
          <input type="text" value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })}
            list="user-job-titles" placeholder="Pilih dari daftar atau ketik sendiri (mis. Creator Manager, Tim Ads)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <datalist id="user-job-titles">
            {jobTitleOptions.map(jt => <option key={jt} value={jt} />)}
          </datalist>
          <div className="text-[11px] text-slate-500 mt-1">💡 Daftar posisi bisa dikelola di menu Pengaturan App. Ketik bebas kalau perlu posisi yang belum ada.</div>
        </Field>
        <Field label="No. WhatsApp (opsional)">
          <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="08xxxxxxxxxx"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
        {!isEdit && (
          <>
            <Field label="Password Awal *">
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </Field>
            <Field label="Konfirmasi Password *">
              <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
        <Field label="Konfirmasi">
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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

  const load = async () => setTasks(await storage.getList('tasks:all'));
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
    let list = await storage.getList('tasks:all');
    if (editing) {
      list = list.map(t => t.id === editing.id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t);
    } else {
      const assignee = allUsers.find(u => u.id === data.assigneeId);
      list.unshift({
        id: uid(), ...data, assigneeName: assignee?.name || '-',
        createdById: user.id, createdByName: user.name, createdAt: new Date().toISOString(),
        comments: []
      });
      await logActivity(`memberi tugas "${data.title}" ke ${assignee?.name}`, user.name);
    }
    await storage.set('tasks:all', list);
    setShowForm(false); setEditing(null); load();
  };
  const handleDelete = async (t) => {
    if (!confirm(`Hapus tugas "${t.title}"?`)) return;
    const list = (await storage.getList('tasks:all')).filter(x => x.id !== t.id);
    await storage.set('tasks:all', list);
    if (viewing?.id === t.id) setViewing(null);
    load();
  };
  const updateStatus = async (t, status) => {
    const list = (await storage.getList('tasks:all')).map(x =>
      x.id === t.id ? { ...x, status, completedAt: status === 'done' ? new Date().toISOString() : null } : x
    );
    await storage.set('tasks:all', list);
    if (status === 'done') await logActivity(`menyelesaikan tugas "${t.title}"`, user.name);
    load();
  };

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
    const list = (await storage.getList('tasks:all')).map(t =>
      t.id === task.id ? { ...t, comments: [...(t.comments || []), newComment] } : t
    );
    await storage.set('tasks:all', list);
    await logActivity(`komen di tugas "${task.title}"`, user.name);
    load();
  };

  const handleDeleteComment = async (task, commentId) => {
    if (!confirm('Hapus komentar ini?')) return;
    const list = (await storage.getList('tasks:all')).map(t =>
      t.id === task.id ? { ...t, comments: (t.comments || []).filter(c => c.id !== commentId) } : t
    );
    await storage.set('tasks:all', list);
    load();
  };

  // Visibility
  const visibleTasks = tasks.filter(t => can.canSeeTask(user, t, allUsers));
  // Assignable users
  const assignableUsers = useMemo(() => {
    if ((user.role === 'manajer' || user.role === 'owner')) return allUsers;
    if (user.role === 'leader') return allUsers.filter(u => u.id === user.id || u.leaderId === user.id);
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
      <PageHeader title="Tugas Tim" subtitle="Kelola semua tugas dalam satu tempat"
        action={can.createTasks(user) || user.role === 'operasional' ? (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tugas Baru
          </button>
        ) : null} />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari tugas..." value={filter.search}
            onChange={e => setFilter({ ...filter, search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
                  const canEdit = (user.role === 'manajer' || user.role === 'owner') || t.createdById === user.id || t.assigneeId === user.id;
                  return (
                    <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="p-3">
                        <select value={t.status} onChange={e => updateStatus(t, e.target.value)}
                          disabled={!((user.role === 'manajer' || user.role === 'owner') || t.assigneeId === user.id || t.createdById === user.id)}
                          className={`text-xs px-2 py-1 rounded font-semibold border-0 cursor-pointer ${TASK_STATUS[t.status].color}`}>
                          {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <button onClick={() => setViewing(t)} className="text-left w-full group">
                          <div className="font-medium text-slate-800 group-hover:text-indigo-700 transition flex items-center gap-2">
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
                          className="text-slate-400 hover:text-indigo-600 p-1">
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
            const canEdit = (user.role === 'manajer' || user.role === 'owner') || t.createdById === user.id || t.assigneeId === user.id;
            const canChangeStatus = (user.role === 'manajer' || user.role === 'owner') || t.assigneeId === user.id || t.createdById === user.id;
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

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <select value={t.status} onChange={e => updateStatus(t, e.target.value)}
                    disabled={!canChangeStatus}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border-0 cursor-pointer ${TASK_STATUS[t.status].color}`}>
                    {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewing(t)} title="Detail & komentar" className="text-slate-400 hover:text-indigo-600 p-1.5">
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
        onClose={() => setViewing(null)} />}
    </div>
  );
}

// ============ TASK DETAIL MODAL (with Comments) ============
function TaskDetailModal({ task, user, allUsers, onEdit, onDelete, onAddComment, onDeleteComment, onClose }) {
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

  const canEdit = (user.role === 'manajer' || user.role === 'owner') || task.createdById === user.id || task.assigneeId === user.id;
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
            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
              <div className="text-[10px] uppercase font-bold text-indigo-700">✅ Diselesaikan</div>
              <div className="font-semibold text-slate-800 mt-0.5">{fmtDateTime(task.completedAt)}</div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <button onClick={onEdit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
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
            <MessageSquare className="w-4 h-4 text-indigo-600" />
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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 overflow-hidden">
                      {c.authorAvatar
                        ? <img src={c.authorAvatar} alt="" className="w-full h-full object-cover" />
                        : c.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-[80%] ${isMine ? 'items-end' : ''} flex flex-col`}>
                      <div className={`rounded-2xl px-3 py-2 ${isMine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                        <div className={`text-[10px] font-bold mb-0.5 flex items-center gap-1 ${isMine ? 'text-indigo-100' : 'text-slate-600'}`}>
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm bg-white" />
              <div className="flex items-center justify-between mt-2">
                <div className="text-[10px] text-slate-500">Ctrl+Enter untuk kirim cepat</div>
                <button onClick={submitComment} disabled={!commentText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs px-4 py-1.5 rounded font-semibold flex items-center gap-1">
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
    <Modal title={task ? 'Edit Tugas' : 'Tugas Baru'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Judul Tugas *">
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Mis. Bikin script live shopping Sabun A"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
        <Field label="Deskripsi">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PIC *">
            <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {assignableUsers.map(m => <option key={m.id} value={m.id}>{m.name}{m.jobTitle ? ` · ${m.jobTitle}` : ""} — {ROLES[m.role].label}</option>)}
            </select>
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

  const load = async () => setCreators(await storage.getList('creators:all'));
  useEffect(() => { load(); }, []);

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
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
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
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} text="Belum ada creator. Klik 'Creator Baru' atau import CSV." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
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
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
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

  // Managers that can be PIC (operasional or leader)
  const managers = allUsers.filter(u => u.role === 'operasional' || u.role === 'leader');
  // Filter managers based on user role
  const visibleManagers = managers.filter(m => can.canSeeUser(user, m));

  return (
    <div className="max-w-7xl">
      <PageHeader title="Pengelolaan Creator"
        subtitle="Visual mapping: siapa mengelola siapa, dan performa per manager"
        action={can.editAppSettings(user) ? null : null} />

      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
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
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold">
                      {manager.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-display font-bold text-slate-900">{manager.name}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${ROLES[manager.role].color}`}>{ROLES[manager.role].label}</span>
                    </div>
                  </div>
                  <div className="flex gap-5 text-xs">
                    <div><div className="text-slate-500">Creator</div><div className="font-bold text-slate-900 text-lg">{myCreators.length}</div></div>
                    <div><div className="text-slate-500">Aktif</div><div className="font-bold text-indigo-700 text-lg">{aktif}</div></div>
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
                            <button onClick={() => setReassigning(c)} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 rounded-md font-semibold transition">
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
                  reassigning.managerId === m.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-500 hover:bg-indigo-50'
                }`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800">{m.name}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLES[m.role].color}`}>{ROLES[m.role].label}</span>
                  </div>
                </div>
                {reassigning.managerId === m.id && <Check className="w-5 h-5 text-indigo-600" />}
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
        <div className="fixed top-20 right-8 bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 text-sm">
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
    a.download = `Data-Creator-${new Date().toISOString().slice(0, 10)}.csv`;
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
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterWeek, setFilterWeek] = useState('all');

  const load = async () => setReports(await storage.getList('reports:all'));
  useEffect(() => { load(); }, []);

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
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Laporan Baru
          </button>
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
            </div>
          ))}
        </div>
      )}

      {showForm && <ReportForm report={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}
function ReportBlock({ title, content }) {
  return <div><div className="text-xs font-semibold text-slate-700 mb-1">{title}</div><div className="text-sm text-slate-600 whitespace-pre-wrap">{content || '-'}</div></div>;
}
function ReportForm({ report, onSave, onClose }) {
  const week = getWeekRange();
  const [form, setForm] = useState({
    weekStart: report?.weekStart || week.start,
    weekEnd: report?.weekEnd || week.end,
    achievements: report?.achievements || '',
    blockers: report?.blockers || '',
    plans: report?.plans || '',
    gmv: report?.gmv || 0,
    contentCount: report?.contentCount || 0
  });
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
        <FormActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.achievements.trim()} />
      </div>
    </Modal>
  );
}

// ============ SCHEDULE ============
function ScheduleView({ user, allUsers }) {
  const [schedules, setSchedules] = useState([]);
  const [creators, setCreators] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({ type: 'all', view: 'upcoming' });

  const load = async () => {
    setSchedules(await storage.getList('schedule:all'));
    setCreators(await storage.getList('creators:all'));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    let list = await storage.getList('schedule:all');
    if (editing) {
      list = list.map(s => s.id === editing.id ? { ...s, ...data } : s);
    } else {
      const admin = allUsers.find(u => u.id === data.adminId);
      const creator = creators.find(c => c.id === data.creatorId);
      list.unshift({
        id: uid(), ...data,
        adminName: admin?.name || '-', creatorName: creator?.name || '-',
        status: 'scheduled', createdAt: new Date().toISOString()
      });
      await logActivity(`menambah jadwal ${SCHEDULE_TYPE[data.type].label} ${fmtDate(data.date)}`, user.name);
    }
    await storage.set('schedule:all', list);
    setShowForm(false); setEditing(null); load();
  };
  const handleDelete = async (s) => {
    if (!confirm('Hapus jadwal ini?')) return;
    const list = (await storage.getList('schedule:all')).filter(x => x.id !== s.id);
    await storage.set('schedule:all', list);
    load();
  };
  const updateStatus = async (s, status) => {
    const list = (await storage.getList('schedule:all')).map(x => x.id === s.id ? { ...x, status } : x);
    await storage.set('schedule:all', list);
    load();
  };

  // Visibility: Operasional sees only their own schedules
  const visible = schedules.filter(s => {
    if ((user.role === 'manajer' || user.role === 'owner') || user.role === 'leader') return true;
    return s.adminId === user.id;
  });
  const today = new Date().toISOString().split('T')[0];
  const filtered = visible
    .filter(s => filter.type === 'all' || s.type === filter.type)
    .filter(s => {
      if (filter.view === 'upcoming') return s.date >= today;
      if (filter.view === 'past') return s.date < today;
      return true;
    })
    .sort((a, b) => filter.view === 'past' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));

  // Assignable admins
  const assignableAdmins = user.role === 'operasional' ? [user] :
    user.role === 'leader' ? allUsers.filter(u => u.id === user.id || u.leaderId === user.id) :
    allUsers;

  return (
    <div className="max-w-7xl">
      <PageHeader title="Jadwal Live & Piket" subtitle="Atur jadwal live shopping, piket admin, dan piket grup"
        action={can.manageSchedule(user) ? (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Jadwal Baru
          </button>
        ) : null} />

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="bg-white rounded-lg border border-slate-200 p-1 flex">
          {[{ id: 'upcoming', label: 'Mendatang' }, { id: 'past', label: 'Sudah Lewat' }, { id: 'all', label: 'Semua' }].map(t => (
            <button key={t.id} onClick={() => setFilter({ ...filter, view: t.id })}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${filter.view === t.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="all">Semua Tipe</option>
          {Object.entries(SCHEDULE_TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Calendar} text="Tidak ada jadwal pada filter ini." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => {
            const canEdit = (user.role === 'manajer' || user.role === 'owner') || user.role === 'leader' || s.adminId === user.id;
            return (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{SCHEDULE_TYPE[s.type].icon}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${SCHEDULE_TYPE[s.type].color}`}>{SCHEDULE_TYPE[s.type].label}</span>
                    </div>
                    <div className="font-display font-bold text-slate-900 mt-2">{fmtDate(s.date)}</div>
                    <div className="text-sm text-slate-600">⏰ {s.time}</div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(s); setShowForm(true); }} className="text-slate-400 hover:text-blue-600 p-1">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(s)} className="text-slate-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {s.product && <div className="text-sm font-medium text-slate-800 mt-1">📦 {s.product}</div>}
                <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                  <div>Admin: <b className="text-slate-700">{s.adminName}</b></div>
                  {s.creatorName && s.creatorName !== '-' && <div>Creator: <b className="text-slate-700">{s.creatorName}</b></div>}
                </div>
                {s.notes && <div className="text-xs text-slate-500 mt-2 italic">{s.notes}</div>}
                <select value={s.status} onChange={e => updateStatus(s, e.target.value)} disabled={!canEdit}
                  className="w-full mt-3 text-xs px-2 py-1 border border-slate-200 rounded bg-white disabled:bg-slate-50">
                  <option value="scheduled">📅 Terjadwal</option>
                  <option value="ongoing">🟢 Berlangsung</option>
                  <option value="done">✅ Selesai</option>
                  <option value="cancelled">❌ Dibatalkan</option>
                </select>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <ScheduleForm schedule={editing} assignableAdmins={assignableAdmins}
        creators={creators} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function ScheduleForm({ schedule, assignableAdmins, creators, onSave, onClose }) {
  const [form, setForm] = useState({
    type: schedule?.type || 'live',
    date: schedule?.date || new Date().toISOString().split('T')[0],
    time: schedule?.time || '19:00',
    adminId: schedule?.adminId || assignableAdmins[0]?.id || '',
    creatorId: schedule?.creatorId || '',
    product: schedule?.product || '',
    notes: schedule?.notes || ''
  });
  return (
    <Modal title={schedule ? 'Edit Jadwal' : 'Jadwal Baru'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Tipe Jadwal">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SCHEDULE_TYPE).map(([k, v]) => (
              <button key={k} onClick={() => setForm({ ...form, type: k })}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition ${form.type === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <div className="text-lg">{v.icon}</div>
                <div className="text-xs">{v.label}</div>
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal *">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
          <Field label="Jam *">
            <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </Field>
        </div>
        <Field label="PIC Admin *">
          <select value={form.adminId} onChange={e => setForm({ ...form, adminId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
            {assignableAdmins.map(m => <option key={m.id} value={m.id}>{m.name}{m.jobTitle ? ` · ${m.jobTitle}` : ""} — {ROLES[m.role].label}</option>)}
          </select>
        </Field>
        {form.type === 'live' && (
          <>
            <Field label="Creator">
              <select value={form.creatorId} onChange={e => setForm({ ...form, creatorId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">- Pilih creator -</option>
                {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Produk yang Dilive">
              <input type="text" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}
                placeholder="Mis. Skincare A, Hijab Premium"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </Field>
          </>
        )}
        <Field label="Catatan">
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </Field>
        <FormActions onCancel={onClose} onSave={() => onSave(form)} disabled={!form.date || !form.time || !form.adminId} />
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

function GmvView({ user, allUsers }) {
  const [entries, setEntries] = useState([]);
  const [targets, setTargets] = useState({});
  const [loading, setLoading] = useState(true);
  const [mKey, setMKey] = useState(monthKey());
  const [showInput, setShowInput] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setEntries(await storage.getList('gmv:daily'));
    setTargets((await storage.get('gmv:targets')) || {});
    setLoading(false);
  };
  useEffect(() => { load(); const iv = setInterval(load, 12000); return () => clearInterval(iv); }, []);

  const isOwnerMgr = user.role === 'owner' || user.role === 'manajer';
  const monthTargets = targets[mKey] || {};

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
    let list = await storage.getList('gmv:daily');
    const existing = list.find(e => e.date === data.date && e.division === data.division && (!editing || e.id !== editing.id));
    if (editing) {
      list = list.map(e => e.id === editing.id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e);
    } else if (existing) {
      // Upsert: kalau sudah ada entry tanggal+divisi itu, timpa
      list = list.map(e => e.id === existing.id ? { ...e, ...data, inputById: user.id, inputByName: user.name, updatedAt: new Date().toISOString() } : e);
    } else {
      list.unshift({ id: uid(), ...data, inputById: user.id, inputByName: user.name, createdAt: new Date().toISOString() });
    }
    await storage.set('gmv:daily', list);
    await logActivity(`update GMV ${GMV_DIVISIONS[data.division].label} ${data.date}: ${fmtRupiah(data.gmv)}`, user.name);
    setShowInput(false); setEditing(null); load();
  };
  const deleteEntry = async (e) => {
    if (!confirm(`Hapus data GMV ${GMV_DIVISIONS[e.division]?.label} tanggal ${e.date}?`)) return;
    await storage.set('gmv:daily', (await storage.getList('gmv:daily')).filter(x => x.id !== e.id));
    load();
  };
  const saveTargets = async (vals) => {
    const all = (await storage.get('gmv:targets')) || {};
    all[mKey] = vals;
    await storage.set('gmv:targets', all);
    await logActivity(`set target GMV ${monthLabel}`, user.name);
    setShowTarget(false); load();
  };

  // Entri bulan ini (untuk tabel), terbaru dulu
  const monthEntries = entries.filter(e => e.date && e.date.startsWith(mKey))
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
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
        {mKey !== monthKey() && <button onClick={() => setMKey(monthKey())} className="text-xs text-indigo-600 font-semibold hover:underline ml-1">Bulan ini</button>}
      </div>

      {/* 3 Hero cards per divisi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(GMV_DIVISIONS).map(([div, cfg]) => {
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

      {/* Total gabungan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Total GMV Gabungan · {monthLabel}</div>
          <div className="font-display font-bold text-2xl text-indigo-700 mt-0.5">{fmtRupiah(monthTotals.mcn + monthTotals.tap + monthTotals.internal)}</div>
        </div>
        <Award className="w-10 h-10 text-amber-400" />
      </div>

      {/* Traffic per divisi */}
      <h3 className="font-display font-bold text-slate-900 mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600" /> Traffic Harian per Divisi</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(GMV_DIVISIONS).map(([div, cfg]) => {
          const series = gmvDailySeries(entries, div, mKey);
          const ch = dailyChange[div];
          const isCurrentMonth = mKey === monthKey();
          const filled = series.filter(s => s.value > 0).length;
          return (
            <div key={div} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-800">{cfg.label}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
              </div>
              <MiniBarChart series={series} color={cfg.color} />
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
                  <span className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
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
                  <td className="p-3 text-sm text-slate-700">{new Date(e.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            {(editing ? Object.keys(GMV_DIVISIONS) : allowedDivs).map(d => <option key={d} value={d}>{GMV_DIVISIONS[d].label}</option>)}
          </select>
          {allowedDivs.length <= 1 && !editing && <div className="text-[11px] text-slate-500 mt-1">Anda hanya bisa input GMV divisi {GMV_DIVISIONS[allowedDivs[0]]?.label}.</div>}
        </Field>
        <Field label="Tanggal *">
          <input type="date" value={form.date} max={dayKey()} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
        <Field label="GMV (Rp) *">
          <input type="text" inputMode="numeric" value={form.gmv}
            onChange={e => setForm({ ...form, gmv: e.target.value.replace(/[^\d]/g, '') })}
            placeholder="mis. 15000000"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {form.gmv && <div className="text-xs text-emerald-600 mt-1 font-semibold">{fmtRupiah(Number(form.gmv))}</div>}
        </Field>
        <Field label="Jumlah Order (opsional)">
          <input type="text" inputMode="numeric" value={form.orders}
            onChange={e => setForm({ ...form, orders: e.target.value.replace(/[^\d]/g, '') })}
            placeholder="mis. 120"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
        <Field label="Catatan (opsional)">
          <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="mis. live bareng creator X"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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

  const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';

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
          className={`px-4 py-2 rounded text-sm font-semibold transition ${tab === 'antrian' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          📋 Antrian Kerja ({antrian.length})
        </button>
        <button onClick={() => setTab('selesai')}
          className={`px-4 py-2 rounded text-sm font-semibold transition ${tab === 'selesai' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
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
          <button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Seller Baru
          </button>
        } />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari seller / toko..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </Field>
            <Field label="Nama Toko / Shop">
              <input type="text" value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kategori Produk">
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="mis. Fashion, F&B"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </Field>
              <Field label="No. WhatsApp">
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="08xxx"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </Field>
            </div>
            <Field label="Catatan">
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </Field>
            <div className="flex gap-2 pt-2">
              <button onClick={save} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-semibold">Simpan</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50">Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ ABSENSI (Attendance + Lokasi GPS) ============
function AttendanceView({ user, allUsers }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterDiv, setFilterDiv] = useState('all');

  const load = async () => {
    const list = await storage.getList('attendance:all');
    setRecords(list);
    setLoading(false);
  };
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const todayStr = new Date().toDateString();
  const myToday = records.filter(r => r.userId === user.id && new Date(r.timestamp).toDateString() === todayStr);
  const lastToday = myToday.length ? myToday[myToday.length - 1] : null;
  const nextType = (!lastToday || lastToday.type === 'out') ? 'in' : 'out';

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

  const doAbsen = async (type) => {
    setError(''); setBusy(true);
    try {
      const loc = await getLocation();
      const address = await getAddress(loc.lat, loc.lng);
      const rec = {
        id: uid(),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        division: user.division || 'internal',
        jobTitle: user.jobTitle || '',
        type,
        timestamp: new Date().toISOString(),
        latitude: loc.lat,
        longitude: loc.lng,
        accuracy: loc.acc,
        address,
        note: note.trim()
      };
      const list = await storage.getList('attendance:all');
      list.unshift(rec);
      await storage.set('attendance:all', list.slice(0, 2000));
      await logActivity(`absen ${type === 'in' ? 'masuk' : 'pulang'}`, user.name);
      setNote('');
      await load();
    } catch (e) {
      setError(e.message || 'Gagal absen.');
    } finally {
      setBusy(false);
    }
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
    return list;
  }, [records, user, allUsers, filterUser, filterDiv]);

  const canSeeOthers = user.role === 'owner' || user.role === 'manajer' || user.role === 'leader';
  const teamForFilter = useMemo(() => {
    if (user.role === 'owner' || user.role === 'manajer') return allUsers;
    if (user.role === 'leader') return allUsers.filter(u => u.leaderId === user.id || u.id === user.id);
    return [user];
  }, [allUsers, user]);

  // Download rekap CSV
  const downloadRecap = () => {
    const rows = [['Nama', 'Divisi', 'Jabatan', 'Tipe', 'Tanggal', 'Jam', 'Lokasi (Alamat)', 'Koordinat', 'Akurasi (m)', 'Catatan']];
    visibleRecords.forEach(r => {
      const d = new Date(r.timestamp);
      rows.push([
        r.userName,
        DIVISIONS[r.division]?.label || r.division || '-',
        r.jobTitle || '-',
        r.type === 'in' ? 'Masuk' : 'Pulang',
        d.toLocaleDateString('id-ID'),
        d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        (r.address || '').replace(/"/g, "'"),
        `${r.latitude},${r.longitude}`,
        r.accuracy || '',
        (r.note || '').replace(/"/g, "'")
      ]);
    });
    const csv = rows.map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap-Absensi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtTime = ts => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = ts => new Date(ts).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
  const osmEmbed = (lat, lng) => {
    const d = 0.004;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
  };

  if (loading) return <div className="text-slate-400 text-sm">Memuat absensi...</div>;

  return (
    <div>
      <PageHeader title="Absensi" subtitle="Absen masuk & pulang dengan lokasi GPS otomatis" />

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
        </div>

        <div className="mt-4">
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Catatan (opsional, mis. lokasi: kantor / WFH / lapangan)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm mb-3" />

          <button onClick={() => doAbsen(nextType)} disabled={busy}
            style={{ background: nextType === 'in' ? 'linear-gradient(135deg, #4F46E5, #4338CA)' : 'linear-gradient(135deg, #D97706, #B45309)' }}
            className="w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60">
            <MapPin className="w-5 h-5" />
            {busy ? 'Mengambil lokasi...' : (nextType === 'in' ? 'Absen Masuk Sekarang' : 'Absen Pulang Sekarang')}
          </button>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Saat ditekan, browser akan minta izin lokasi. Izinkan agar lokasi tersimpan.
          </p>
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter + Download (untuk leader/manajer/owner) */}
      {canSeeOthers && (
        <div className="mb-4 flex items-center gap-2 flex-wrap bg-white rounded-xl border border-slate-200 p-3">
          <span className="text-xs text-slate-500 font-semibold">Filter:</span>
          {(user.role === 'owner' || user.role === 'manajer') && (
            <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">Semua divisi</option>
              {Object.entries(DIVISIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">Semua anggota</option>
            {teamForFilter.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button onClick={downloadRecap} disabled={visibleRecords.length === 0}
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <FileDown className="w-4 h-4" /> Download Rekap ({visibleRecords.length})
          </button>
        </div>
      )}

      {/* Riwayat absensi */}
      <h3 className="font-display font-bold text-slate-900 mb-3">Riwayat Absensi</h3>
      {visibleRecords.length === 0 ? (
        <EmptyState icon={MapPin} text="Belum ada data absensi." />
      ) : (
        <div className="space-y-3">
          {visibleRecords.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.type === 'in' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  {r.type === 'in'
                    ? <ArrowRight className="w-5 h-5 text-emerald-600" />
                    : <ArrowLeft className="w-5 h-5 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{r.userName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.type === 'in' ? 'MASUK' : 'PULANG'}
                    </span>
                    {r.division && DIVISIONS[r.division] && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${DIVISIONS[r.division].color}`}>{DIVISIONS[r.division].label}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{fmtDate(r.timestamp)} · {fmtTime(r.timestamp)}</div>
                  {r.address && (
                    <div className="text-xs text-slate-700 mt-1 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <span>{r.address}</span>
                    </div>
                  )}
                  {r.note && <div className="text-xs text-slate-600 mt-1 italic">"{r.note}"</div>}
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 flex-wrap">
                    {r.latitude?.toFixed(5)}, {r.longitude?.toFixed(5)}
                    {r.accuracy ? <span>· ±{r.accuracy}m</span> : null}
                    <a href={mapsLink(r.latitude, r.longitude)} target="_blank" rel="noreferrer"
                      className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 ml-1">
                      Buka Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
              {/* Peta */}
              {r.latitude && r.longitude && (
                <iframe
                  title={`peta-${r.id}`}
                  src={osmEmbed(r.latitude, r.longitude)}
                  className="w-full h-44 border-0 border-t border-slate-100"
                  loading="lazy"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeaderboardView({ allUsers }) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    (async () => {
      setTasks(await storage.getList('tasks:all'));
    })();
  }, []);

  const teamStats = allUsers.map(m => {
    const myTasks = tasks.filter(t => t.assigneeId === m.id);
    const done = myTasks.filter(t => t.status === 'done').length;
    return { ...m, total: myTasks.length, done, rate: myTasks.length ? Math.round(done / myTasks.length * 100) : 0 };
  }).sort((a, b) => b.done - a.done);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Leaderboard" subtitle="Kompetisi sehat — siapa anggota tim paling produktif" />
      <div className="space-y-2">
        {teamStats.map((m, i) => (
          <div key={m.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${i < 3 && m.done > 0 ? 'border-indigo-200 bg-gradient-to-r from-indigo-50/30 to-transparent' : 'border-slate-200'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-lg ${
              m.done > 0 && i === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-white' :
              m.done > 0 && i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
              m.done > 0 && i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
              'bg-slate-100 text-slate-600'
            }`}>{m.done > 0 && i === 0 ? '🥇' : m.done > 0 && i === 1 ? '🥈' : m.done > 0 && i === 2 ? '🥉' : `#${i + 1}`}</div>
            <div className="flex-1">
              <div className="font-semibold text-slate-900">{m.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] inline-block px-2 py-0.5 rounded ${ROLES[m.role]?.color}`}>{ROLES[m.role]?.label}</span>
                {m.division && DIVISIONS[m.division] && (
                  <span className={`text-[10px] inline-block px-2 py-0.5 rounded ${DIVISIONS[m.division].color}`}>{DIVISIONS[m.division].label}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-lg text-indigo-700">{m.done}</div>
              <div className="text-xs text-slate-500">tugas selesai · {m.rate}% rate</div>
            </div>
          </div>
        ))}
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Usulkan Ide
          </button>
        } />

      {/* Status overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {Object.entries(CONTENT_STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter({ ...filter, status: filter.status === k ? 'all' : k })}
            className={`p-3 rounded-xl border-2 text-left transition ${
              filter.status === k ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
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
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
                        <b className="text-slate-700">Referensi:</b> <a href={idea.references} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline inline-flex items-center gap-1">
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
                      <div>🚀 Tayang: <a href={idea.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline inline-flex items-center gap-1">{idea.publishedUrl} <ExternalLink className="w-3 h-3" /></a> · {fmtDate(idea.publishedAt)}</div>
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
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded font-semibold flex items-center gap-1">
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
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded font-semibold">
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs p-3 rounded-lg">
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
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs p-3 rounded-lg">
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
function SettingsView({ user, settings, onSave }) {
  if (!can.editAppSettings(user)) return <NoAccess />;
  const [form, setForm] = useState({
    ...settings,
    customRoles: { ...DEFAULT_ROLE_LABELS, ...(settings.customRoles || {}) },
    jobTitles: settings.jobTitles || [...DEFAULT_JOB_TITLES]
  });
  const [saved, setSaved] = useState(false);
  const [logoMode, setLogoMode] = useState(settings.logoImage ? 'image' : 'emoji');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

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

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Pengaturan Aplikasi" subtitle="Identitas aplikasi yang dilihat seluruh tim" />

      {/* Identitas */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm shadow-slate-200/40 space-y-4">
        <h3 className="font-display font-bold text-slate-900">Identitas Aplikasi</h3>
        <Field label="Nama Aplikasi *">
          <input type="text" value={form.appName} onChange={e => setForm({ ...form, appName: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </Field>
        <Field label="Subtitle / Tagline">
          <input type="text" value={form.appSubtitle} onChange={e => setForm({ ...form, appSubtitle: e.target.value })}
            placeholder="Mis. MCN TAP · Masjid Affiliate"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
                  className={`p-3 text-2xl rounded-lg border-2 transition ${form.logoEmoji === e ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
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
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
                {form.logoImage
                  ? <img src={form.logoImage} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white opacity-50">?</span>}
              </div>
              <div className="flex-1 space-y-2">
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
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
                    className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
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
              <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{idx + 1}</div>
              <input type="text" value={jt}
                onChange={e => {
                  const newList = [...form.jobTitles];
                  newList[idx] = e.target.value;
                  setForm({ ...form, jobTitles: newList });
                }}
                placeholder="Mis. Creator Manager"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <button onClick={() => setForm({ ...form, jobTitles: form.jobTitles.filter((_, i) => i !== idx) })}
                title="Hapus posisi ini"
                className="text-slate-400 hover:text-red-600 p-2 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={() => setForm({ ...form, jobTitles: [...form.jobTitles, ''] })}
            className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Posisi Baru
          </button>
        </div>
        <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
          💡 Saat menambah anggota tim, posisi ini akan muncul sebagai saran. User juga bisa ketik manual kalau perlu posisi khusus.
        </div>
      </div>

      {/* Preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <div className="text-xs font-semibold text-slate-600 uppercase mb-3">Preview</div>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl flex items-center justify-center text-2xl overflow-hidden">
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
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">{form.customRoles.operasional || DEFAULT_ROLE_LABELS.operasional}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50 pb-2">
        {saved && <span className="text-sm text-indigo-700 font-semibold">✓ Tersimpan</span>}
        <button onClick={submit}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md">
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
      <PageHeader title="To-Do List" subtitle="Tugas semua anggota tim — terbuka untuk dilihat, supaya tim tahu siapa sedang mengerjakan apa"
        action={
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> To-Do Baru
          </button>
        } />

      {/* Owner filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 uppercase">Lihat To-Do:</span>
        <button onClick={() => setFilter({ owner: user.id })}
          className={`text-xs px-3 py-1.5 rounded font-semibold transition ${filter.owner === user.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Saya
        </button>
        <button onClick={() => setFilter({ owner: 'all' })}
          className={`text-xs px-3 py-1.5 rounded font-semibold transition ${filter.owner === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
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
          <span className="text-xs text-indigo-700 font-semibold flex items-center gap-1">
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
            className={`rounded-xl border-2 transition ${dragOver === key ? 'border-indigo-500 bg-indigo-50' : `${def.border} ${def.bg}`}`}>
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
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden flex-shrink-0">
                            {ownerUser?.avatarImage
                              ? <img src={ownerUser.avatarImage} alt="" className="w-full h-full object-cover" />
                              : todo.ownerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-700 truncate">{todo.ownerName}</span>
                          {isMine && <span className="text-[9px] text-indigo-600 font-semibold flex-shrink-0">(Saya)</span>}
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
  const [filter, setFilter] = useState({
    date: new Date().toISOString().split('T')[0],
    author: 'all'
  });

  const load = async () => {
    setReports(await storage.getList('daily-reports:all'));
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
    let list = await storage.getList('daily-reports:all');
    if (editing) {
      list = list.map(r => r.id === editing.id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r);
      await logActivity(`mengupdate laporan harian ${fmtDate(data.date)}`, user.name);
    } else {
      list.unshift({
        id: uid(), ...data,
        authorId: user.id, authorName: user.name, authorRole: user.role,
        authorJobTitle: user.jobTitle || '',
        submittedAt: new Date().toISOString()
      });
      await logActivity(`mengirim laporan harian ${fmtDate(data.date)}`, user.name);
    }
    await storage.set('daily-reports:all', list);
    setShowForm(false); setEditing(null); load();
  };

  const handleDelete = async (r) => {
    if (!confirm('Hapus laporan harian ini?')) return;
    const list = (await storage.getList('daily-reports:all')).filter(x => x.id !== r.id);
    await storage.set('daily-reports:all', list);
    load();
  };

  const handleTogglePin = async (r) => {
    const list = (await storage.getList('daily-reports:all')).map(x =>
      x.id === r.id ? { ...x, pinToDashboard: !x.pinToDashboard } : x
    );
    await storage.set('daily-reports:all', list);
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

  const myAssignedTemplate = getUserTemplate(user.id);

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
            <button onClick={() => setShowDownloadModal(true)}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <FileDown className="w-4 h-4" /> Download Laporan
            </button>
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Laporan Hari Ini
            </button>
          </div>
        } />

      {/* User template info */}
      {myAssignedTemplate && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-indigo-700 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-indigo-800">Template laporan untuk Anda:</span>
            <b className="text-indigo-900 ml-1">{myAssignedTemplate.name}</b>
            <span className="text-indigo-700 text-xs ml-2">({myAssignedTemplate.fields.length} field)</span>
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
              className={`text-xs px-3 py-1.5 rounded font-semibold ${filter.date === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
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
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} text="Belum ada laporan harian pada filter ini." />
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
                    <div key={r.id} className={`bg-white rounded-xl border ${r.pinToDashboard ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} p-4`}>
                      <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{r.authorName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${ROLES[r.authorRole]?.color || ''}`}>{ROLES[r.authorRole]?.label}</span>
                            {r.authorJobTitle && <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">{r.authorJobTitle}</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {fmtDateTime(r.submittedAt)}
                            {r.templateName && <span> · Template: {r.templateName}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {canManage && (
                            <button onClick={() => handleTogglePin(r)} title={r.pinToDashboard ? 'Unpin dari dashboard' : 'Pin ke dashboard'}
                              className={`p-1 ${r.pinToDashboard ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}>
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
    </div>
  );
}

// ============ DOWNLOAD RANGE MODAL ============
function DownloadRangeModal({ filterableAuthors, reportsCount, onDownload, onClose }) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  // Default: minggu ini
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const [form, setForm] = useState({
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
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
      s = e = y.toISOString().split('T')[0];
    } else if (key === 'this-week') {
      const d = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - d + (d === 0 ? -6 : 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      s = mon.toISOString().split('T')[0];
      e = sun.toISOString().split('T')[0];
    } else if (key === 'last-week') {
      const d = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - d + (d === 0 ? -6 : 1) - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      s = mon.toISOString().split('T')[0];
      e = sun.toISOString().split('T')[0];
    } else if (key === 'this-month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      s = first.toISOString().split('T')[0];
      e = last.toISOString().split('T')[0];
    } else if (key === 'last-month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      s = first.toISOString().split('T')[0];
      e = last.toISOString().split('T')[0];
    } else if (key === 'last-30') {
      const back = new Date(now); back.setDate(back.getDate() - 29);
      s = back.toISOString().split('T')[0];
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
                className={`text-xs px-2 py-2 rounded-lg font-semibold transition ${preset === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </Field>
          <Field label="Tanggal Akhir *">
            <input type="date" value={form.end}
              onChange={e => { setForm({ ...form, end: e.target.value }); setPreset('custom'); }}
              min={form.start}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
        <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-700 hover:underline inline-flex items-center gap-1 break-all">
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
  const common = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500";
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
                className="w-4 h-4 accent-indigo-600" />
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
                  className="w-4 h-4 accent-indigo-600 rounded" />
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
  const today = new Date().toISOString().split('T')[0];

  // Determine which template to use
  const userTemplate = templates.find(t => t.assignedUserIds?.includes(user.id));
  const initialTemplateId = report?.templateId || userTemplate?.id || '';

  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId);
  const activeTemplate = templates.find(t => t.id === selectedTemplateId);
  const fieldDefs = activeTemplate?.fields || DEFAULT_DAILY_FIELDS;

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
      pinToDashboard: form.pinToDashboard
    });
  };

  return (
    <Modal title={report ? 'Edit Laporan Harian' : 'Laporan Harian'} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Tanggal *">
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </Field>

        {canPickTemplate && templates.length > 0 && (
          <Field label="Template Form">
            <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">Default (form standar)</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.assignedUserIds?.includes(user.id) ? ' (untuk Anda)' : ''}</option>
              ))}
            </select>
          </Field>
        )}

        {activeTemplate ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-indigo-800">
              <ClipboardList className="w-4 h-4" />
              <b>{activeTemplate.name}</b>
            </div>
            {activeTemplate.description && <div className="text-xs text-indigo-700 mt-1">{activeTemplate.description}</div>}
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

        {canPin && (
          <label className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 p-3 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.pinToDashboard}
              onChange={e => setForm({ ...form, pinToDashboard: e.target.checked })}
              className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-indigo-800">📌 Tampilkan di Dashboard Tim</div>
              <div className="text-xs text-indigo-700">Laporan ini akan di-pin sebagai highlight di dashboard semua anggota.</div>
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
          className="w-full border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-700 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
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
              <button onClick={loadDefaults} className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold">
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
              className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2">
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
                {u.jobTitle && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded">{u.jobTitle}</span>}
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
              <label className="text-[10px] uppercase font-semibold text-slate-500">Pilihan (satu per baris)</label>
              <textarea value={(field.options || []).join('\n')}
                onChange={e => onChange('options', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                rows={3} placeholder="Pilihan 1&#10;Pilihan 2&#10;Pilihan 3"
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm mt-0.5 resize-none font-mono" />
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
function CalendarView({ user, allUsers }) {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const load = async () => setEvents(await storage.getList('calendar:all'));
  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    let list = await storage.getList('calendar:all');
    if (editing) {
      list = list.map(e => e.id === editing.id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e);
    } else {
      list.unshift({
        id: uid(), ...data,
        createdById: user.id, createdByName: user.name,
        createdAt: new Date().toISOString()
      });
      await logActivity(`menambah agenda kalender: "${data.title}" (${fmtDate(data.date)})`, user.name);
    }
    await storage.set('calendar:all', list);
    setShowForm(false); setEditing(null); load();
  };

  const handleDelete = async (ev) => {
    if (!confirm(`Hapus agenda "${ev.title}"?`)) return;
    const list = (await storage.getList('calendar:all')).filter(x => x.id !== ev.id);
    await storage.set('calendar:all', list);
    setViewing(null); load();
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
  const todayStr = new Date().toISOString().split('T')[0];

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
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Agenda Baru
          </button>
        } />

      {/* Notice about Google Calendar */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <CalendarDays className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-blue-900">Integrasi Google Calendar</div>
          <div className="text-blue-800 mt-0.5">
            Setiap agenda punya tombol <b>"Tambah ke Google Calendar"</b> — klik untuk buka Google Calendar dengan event sudah ter-prefill. Atau download file <b>.ics</b> untuk import ke kalender lain (Outlook, Apple Calendar).
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
                  onClick={() => { setEditing({ date: cell.dateStr }); setShowForm(true); }}
                  className={`min-h-[100px] p-2 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50 ${cell.isToday ? 'bg-indigo-50/50' : ''}`}>
                  <div className={`text-xs font-bold mb-1 ${cell.isToday ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white' : 'text-slate-700'}`}>
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
                    className="w-full text-left p-2 rounded-lg border border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition">
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

      {showForm && <EventForm event={editing} allUsers={allUsers}
        onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
      {viewing && <EventDetailModal event={viewing} user={user}
        onEdit={() => { setEditing(viewing); setViewing(null); setShowForm(true); }}
        onDelete={() => handleDelete(viewing)}
        onClose={() => setViewing(null)} />}
    </div>
  );
}

function EventForm({ event, allUsers, onSave, onClose }) {
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    type: event?.type || 'meeting',
    date: event?.date || new Date().toISOString().split('T')[0],
    time: event?.time || '09:00',
    endTime: event?.endTime || '',
    location: event?.location || '',
    attendeeIds: event?.attendeeIds || []
  });

  const toggleAttendee = (id) => {
    const list = form.attendeeIds.includes(id)
      ? form.attendeeIds.filter(x => x !== id)
      : [...form.attendeeIds, id];
    setForm({ ...form, attendeeIds: list });
  };

  const submit = () => {
    const attendees = form.attendeeIds.map(id => allUsers.find(u => u.id === id)?.name).filter(Boolean);
    onSave({ ...form, attendeeNames: attendees });
  };

  return (
    <Modal title={event?.id ? 'Edit Agenda' : 'Agenda Baru'} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Tipe Agenda">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(EVENT_TYPE).map(([k, v]) => (
              <button key={k} onClick={() => setForm({ ...form, type: k })}
                className={`px-2 py-2 rounded-lg border-2 text-xs font-semibold transition ${form.type === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
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
              onClick={() => setForm({ ...form, attendeeIds: allUsers.map(u => u.id) })}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition">
              ✓ Centang Semua Tim
            </button>
            <button type="button"
              onClick={() => setForm({ ...form, attendeeIds: [] })}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
              Hapus Semua
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto scroll-thin border border-slate-200 rounded-lg p-2 space-y-1">
            {allUsers.map(u => (
              <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                <input type="checkbox" checked={form.attendeeIds.includes(u.id)}
                  onChange={() => toggleAttendee(u.id)} />
                <span className="text-sm">{u.name}</span>
                {u.jobTitle && <span className="text-xs text-slate-500">· {u.jobTitle}</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${ROLES[u.role].color}`}>{ROLES[u.role].label}</span>
              </label>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{form.attendeeIds.length} dari {allUsers.length} anggota dipilih</div>
        </Field>
        <FormActions onCancel={onClose} onSave={submit} disabled={!form.title.trim() || !form.date || !form.time} />
      </div>
    </Modal>
  );
}

function EventDetailModal({ event, user, onEdit, onDelete, onClose }) {
  const canEdit = event.createdById === user.id || (user.role === 'manajer' || user.role === 'owner') || user.role === 'leader';

  // Generate Google Calendar URL
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
      `DTSTAMP:${formatICSDate(new Date().toISOString().split('T')[0], '00:00')}`,
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
                <a href={event.location} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline inline-flex items-center gap-1">{event.location} <ExternalLink className="w-3 h-3" /></a>
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
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-lg space-y-2">
          <div className="text-sm font-semibold text-slate-800">Tambahkan ke kalender pribadi:</div>
          <div className="flex gap-2 flex-wrap">
            <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <CalendarDays className="w-4 h-4" /> Google Calendar
            </a>
            <button onClick={downloadICS}
              className="flex-1 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <FileDown className="w-4 h-4" /> Download .ics
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <>
              <button onClick={onEdit}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
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
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-3xl overflow-hidden border-4 border-white shadow-lg">
              {form.avatarImage
                ? <img src={form.avatarImage} alt="" className="w-full h-full object-cover" />
                : form.name.charAt(0).toUpperCase()}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              title="Ganti foto profil"
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50">
              <ImagePlus className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl text-slate-900">{user.name}</div>
            <div className="text-sm text-slate-500">@{user.username}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded ${ROLES[user.role].color}`}>{ROLES[user.role].label}</span>
              {user.jobTitle && <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">{user.jobTitle}</span>}
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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </Field>
          <Field label="No. WhatsApp">
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="08xxxxxxxxxx"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </Field>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-indigo-700 font-semibold">✓ Profil tersimpan</span>}
            <button onClick={submitProfile}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold">
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
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 py-2.5 rounded-lg font-semibold text-sm">
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10" />
                  <button type="button" onClick={() => setShowOldPw(!showOldPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Password Baru * (minimal 6 karakter)">
                <div className="relative">
                  <input type={showNewPw ? 'text' : 'password'} value={pwForm.newPw}
                    onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10" />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Konfirmasi Password Baru *">
                <input type={showNewPw ? 'text' : 'password'} value={pwForm.confirmPw}
                  onChange={e => setPwForm({ ...pwForm, confirmPw: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </Field>
              {pwError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{pwError}</div>}
              <div className="flex items-center justify-end gap-3">
                {pwSaved && <span className="text-sm text-indigo-700 font-semibold">✓ Password berhasil diubah</span>}
                <button onClick={submitPassword}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold">
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
  const map = { emerald: 'text-indigo-700', blue: 'text-blue-700', amber: 'text-amber-700' };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-sm shadow-slate-200/40">
      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${map[color]}`}>{value}</div>
    </div>
  );
}
function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-3xl shadow-2xl shadow-slate-900/20 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto scroll-thin border border-slate-200/60`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-3xl">
          <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
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
        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg transition">
        {saveLabel}
      </button>
      <button onClick={onCancel} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold">Batal</button>
    </div>
  );
}
