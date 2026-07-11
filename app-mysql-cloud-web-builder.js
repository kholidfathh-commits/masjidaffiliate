// ============================================================================
// AL-KAHFI TEAM APP — Server untuk Cloud Web Builder (Node.js + MySQL)
// - Menyajikan aplikasi (folder ./public)
// - API key-value /api/kv (pengganti Supabase; dipakai frontend)
// - Jalur impor data & file (admin, pakai kunci rahasia)
// ============================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_SECRET = 'AKC-eb0a14b1ebbbfb017d8785cb3127de47';

// ====== KONFIGURASI DATABASE ======
// Kosong = deteksi otomatis dari environment platform.
// Kalau /api/health bilang gagal konek, isi manual 4 baris di bawah sesuai info panel.
const DB_OVERRIDE = { host: '', port: '', user: '', password: '', database: '' };

function pickEnv(names, fallback) {
  for (const n of names) { if (process.env[n] !== undefined && process.env[n] !== '') return process.env[n]; }
  return fallback;
}
const DB_CONFIG = {
  host: DB_OVERRIDE.host || pickEnv(['DB_HOST','MYSQL_HOST','MYSQLHOST','DATABASE_HOST'], 'localhost'),
  user: DB_OVERRIDE.user || pickEnv(['DB_USER','MYSQL_USER','MYSQLUSER','DATABASE_USER','DB_USERNAME'], 'root'),
  password: DB_OVERRIDE.password || pickEnv(['DB_PASSWORD','DB_PASS','MYSQL_PASSWORD','MYSQL_ROOT_PASSWORD','MYSQLPASSWORD','DATABASE_PASSWORD'], ''),
  database: DB_OVERRIDE.database || pickEnv(['DB_NAME','MYSQL_DATABASE','MYSQLDATABASE','DATABASE_NAME','DB_DATABASE'], 'alkahfi_corp_app'),
  port: Number(DB_OVERRIDE.port || pickEnv(['DB_PORT','MYSQL_PORT','MYSQLPORT','DATABASE_PORT'], 3306)),
  waitForConnections: true, connectionLimit: 5, charset: 'utf8mb4'
};
const ENV_SEEN = Object.keys(process.env).filter(k => /^(DB_|MYSQL|DATABASE)/i.test(k)); // nama saja, tanpa nilai

// ====== KONEKSI DATABASE (mysql2 lalu mysql sebagai cadangan) ======
let pool = null, driverName = null, dbInitError = null;
(function initDb() {
  try { const m = require('mysql2/promise'); pool = m.createPool(DB_CONFIG); driverName = 'mysql2'; return; } catch (e) {}
  try {
    const m = require('mysql');
    const p = m.createPool(DB_CONFIG);
    pool = { query: (sql, params) => new Promise((res, rej) => p.query(sql, params, (err, rows) => err ? rej(err) : res([rows]))) };
    driverName = 'mysql'; return;
  } catch (e) {}
  dbInitError = 'Modul mysql2/mysql tidak ditemukan. Jalankan: npm install mysql2';
})();
async function q(sql, params) {
  if (!pool) throw new Error(dbInitError || 'DB belum siap');
  const [rows] = await pool.query(sql, params);
  return rows;
}
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await q("CREATE TABLE IF NOT EXISTS kv_store (k VARCHAR(191) NOT NULL PRIMARY KEY, v LONGTEXT NOT NULL, updated_at VARCHAR(40) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin");
  tableReady = true;
}
const likeEscape = (s) => String(s).replace(/[\\%_]/g, (m) => '\\' + m);

// ====== SNAPSHOT HARIAN KE FILE (asuransi bila database bermasalah) ======
// kv-latest.json = terbaru, kv-prev.json = sebelumnya. Kalau isi DB tiba-tiba MENYUSUT drastis,
// snapshot TIDAK menimpa yang lama — disimpan ke kv-suspicious.json (tanda ada masalah).
const DUMP_DIR = path.join(__dirname, 'data-backup');
let _lastDumpCheck = 0;
function readDumpMeta() {
  try { return JSON.parse(fs.readFileSync(path.join(DUMP_DIR, 'kv-latest.meta.json'), 'utf8')); } catch (e) { return null; }
}
async function dumpToFile() {
  fs.mkdirSync(DUMP_DIR, { recursive: true });
  const rows = await q('SELECT k, v FROM kv_store');
  const latestP = path.join(DUMP_DIR, 'kv-latest.json');
  const meta = readDumpMeta();
  if (meta && meta.n > 100 && rows.length < meta.n * 0.3) {
    fs.writeFileSync(path.join(DUMP_DIR, 'kv-suspicious.json'), JSON.stringify({ at: new Date().toISOString(), n: rows.length, rows }));
    return { n: rows.length, suspicious: true };
  }
  if (fs.existsSync(latestP)) {
    try { fs.copyFileSync(latestP, path.join(DUMP_DIR, 'kv-prev.json')); fs.copyFileSync(path.join(DUMP_DIR, 'kv-latest.meta.json'), path.join(DUMP_DIR, 'kv-prev.meta.json')); } catch (e) {}
  }
  fs.writeFileSync(latestP, JSON.stringify({ at: new Date().toISOString(), n: rows.length, rows }));
  fs.writeFileSync(path.join(DUMP_DIR, 'kv-latest.meta.json'), JSON.stringify({ at: new Date().toISOString(), n: rows.length }));
  return { n: rows.length, suspicious: false };
}
function maybeDailyDump() {
  const now = Date.now();
  if (now - _lastDumpCheck < 60 * 60 * 1000) return; // periksa maksimal 1x per jam
  _lastDumpCheck = now;
  try {
    const meta = readDumpMeta();
    if (!meta || (now - new Date(meta.at).getTime()) > 24 * 60 * 60 * 1000) {
      dumpToFile().then(r => console.log('Snapshot harian:', r.n, 'baris', r.suspicious ? '(MENCURIGAKAN — disimpan terpisah)' : '')).catch(e => console.log('Snapshot gagal:', e.message));
    }
  } catch (e) {}
}

// ====== UTIL HTTP ======
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) { reject(new Error('Body terlalu besar')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limitBytes) {
  const buf = await readBody(req, limitBytes);
  return JSON.parse(buf.toString('utf8') || '{}');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2'
};
function serveStatic(res, urlPath) {
  let fp = path.normalize(path.join(PUBLIC_DIR, urlPath === '/' ? '/index.html' : urlPath));
  if (!fp.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) fp = path.join(PUBLIC_DIR, 'index.html'); // SPA fallback
    fs.readFile(fp, (e, data) => {
      if (e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<meta charset="utf-8"><h3>Al-Kahfi Team App</h3><p>Server jalan. File aplikasi belum terkirim ke folder public/ — lanjutkan proses pengiriman file.</p>');
      }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': fp.includes(path.sep + 'assets' + path.sep) ? 'public, max-age=31536000, immutable' : 'no-cache'
      });
      res.end(data);
    });
  });
}

// ====== SERVER ======
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = decodeURIComponent(u.pathname);
  // CORS utk /api (alat impor bisa jalan dari browser; posture sama terbukanya dgn RLS permissive sebelumnya)
  if (p.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  maybeDailyDump();
  try {
    // ---- API kesehatan (untuk diagnosis) ----
    if (p === '/api/health') {
      let db = 'ok', rows = null;
      try { await ensureTable(); const r = await q('SELECT COUNT(*) AS n FROM kv_store'); rows = r[0] ? (r[0].n ?? r[0]['COUNT(*)']) : null; }
      catch (e) { db = String(e.message || e); }
      return sendJson(res, 200, { ok: true, db, driver: driverName, database: DB_CONFIG.database, host: DB_CONFIG.host, port: DB_CONFIG.port, user: DB_CONFIG.user, rows, lastDump: readDumpMeta(), envSeen: ENV_SEEN, node: process.version });
    }
    // ---- API key-value (dipakai frontend) ----
    if (p.startsWith('/api/kv/')) {
      const key = p.slice('/api/kv/'.length);
      if (!key || key.length > 191) return sendJson(res, 400, { error: 'key tidak valid' });
      await ensureTable();
      if (req.method === 'GET') {
        const rows = await q('SELECT v FROM kv_store WHERE k = ?', [key]);
        if (!rows.length) return sendJson(res, 200, { found: false });
        return sendJson(res, 200, { found: true, value: JSON.parse(rows[0].v) });
      }
      if (req.method === 'PUT') {
        const body = await readJson(req, 8 * 1024 * 1024);
        await q('INSERT INTO kv_store (k, v, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = VALUES(updated_at)',
          [key, JSON.stringify(body.value ?? null), new Date().toISOString()]);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        await q('DELETE FROM kv_store WHERE k = ?', [key]);
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 405, { error: 'method' });
    }
    if (p === '/api/kv-list' && req.method === 'GET') {
      await ensureTable();
      const prefix = u.searchParams.get('prefix') || '';
      const from = Math.max(0, parseInt(u.searchParams.get('from') || '0', 10));
      const limit = Math.min(1000, Math.max(1, parseInt(u.searchParams.get('limit') || '1000', 10)));
      const rows = await q('SELECT v FROM kv_store WHERE k LIKE ? ORDER BY k ASC LIMIT ? OFFSET ?', [likeEscape(prefix) + '%', limit, from]);
      return sendJson(res, 200, { values: rows.map(r => JSON.parse(r.v)) });
    }
    if (p === '/api/kv-prefix' && req.method === 'DELETE') {
      await ensureTable();
      const prefix = u.searchParams.get('prefix') || '';
      if (!prefix) return sendJson(res, 400, { error: 'prefix wajib' });
      await q('DELETE FROM kv_store WHERE k LIKE ?', [likeEscape(prefix) + '%']);
      return sendJson(res, 200, { ok: true });
    }
    // ---- API admin (impor data & kirim file; wajib kunci rahasia) ----
    if (p === '/api/admin/kv-bulk' && req.method === 'POST') {
      const body = await readJson(req, 8 * 1024 * 1024);
      if (body.secret !== ADMIN_SECRET) return sendJson(res, 403, { error: 'secret salah' });
      await ensureTable();
      const rows = Array.isArray(body.rows) ? body.rows : [];
      let n = 0;
      for (const r of rows) {
        if (!r || typeof r.k !== 'string') continue;
        await q('INSERT INTO kv_store (k, v, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = VALUES(updated_at)',
          [r.k, JSON.stringify(r.v ?? null), new Date().toISOString()]);
        n++;
      }
      return sendJson(res, 200, { ok: true, n });
    }
    if (p === '/api/admin/export' && req.method === 'GET') {
      if (u.searchParams.get('secret') !== ADMIN_SECRET) return sendJson(res, 403, { error: 'secret salah' });
      await ensureTable();
      const from = Math.max(0, parseInt(u.searchParams.get('from') || '0', 10));
      const limit = Math.min(500, Math.max(1, parseInt(u.searchParams.get('limit') || '200', 10)));
      const rows = await q('SELECT k, v FROM kv_store ORDER BY k ASC LIMIT ? OFFSET ?', [limit, from]);
      return sendJson(res, 200, { rows: rows.map(r => ({ k: r.k, v: r.v })) });
    }
    if (p === '/api/admin/dump-now' && req.method === 'POST') {
      const body = await readJson(req, 1024 * 1024);
      if (body.secret !== ADMIN_SECRET) return sendJson(res, 403, { error: 'secret salah' });
      await ensureTable();
      const r = await dumpToFile();
      return sendJson(res, 200, { ok: true, ...r });
    }
    if (p === '/api/admin/restore-file' && req.method === 'POST') {
      const body = await readJson(req, 1024 * 1024);
      if (body.secret !== ADMIN_SECRET) return sendJson(res, 403, { error: 'secret salah' });
      const which = body.which === 'prev' ? 'kv-prev.json' : body.which === 'suspicious' ? 'kv-suspicious.json' : 'kv-latest.json';
      let dump;
      try { dump = JSON.parse(fs.readFileSync(path.join(DUMP_DIR, which), 'utf8')); }
      catch (e) { return sendJson(res, 404, { error: 'file snapshot tidak ada: ' + which }); }
      await ensureTable();
      let n = 0;
      for (const r of (dump.rows || [])) {
        if (!r || typeof r.k !== 'string') continue;
        await q('INSERT INTO kv_store (k, v, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = VALUES(updated_at)', [r.k, r.v, new Date().toISOString()]);
        n++;
      }
      return sendJson(res, 200, { ok: true, n, dari: which, snapshotAt: dump.at });
    }
    if (p === '/api/admin/file' && req.method === 'POST') {
      const body = await readJson(req, 8 * 1024 * 1024);
      if (body.secret !== ADMIN_SECRET) return sendJson(res, 403, { error: 'secret salah' });
      const rel = path.normalize(String(body.path || ''));
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !(rel === 'index.html' || rel.startsWith('public'))) {
        return sendJson(res, 400, { error: 'path harus di dalam public/' });
      }
      const fp = path.join(__dirname, rel);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      const data = Buffer.from(String(body.b64 || ''), 'base64');
      if (body.mode === 'a') fs.appendFileSync(fp, data); else fs.writeFileSync(fp, data);
      return sendJson(res, 200, { ok: true, size: fs.statSync(fp).size });
    }
    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'tidak ada' });
    // ---- File statis aplikasi ----
    if (req.method === 'GET') return serveStatic(res, p);
    res.writeHead(405); res.end();
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}).listen(PORT, () => console.log('Al-Kahfi Team App (MySQL) jalan di port ' + PORT + ' | driver=' + (driverName || 'TIDAK ADA') + ' | db=' + DB_CONFIG.database));
