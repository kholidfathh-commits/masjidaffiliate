// ============================================================================
// QR CODE — encoder MURNI, TANPA dependency baru.
// ----------------------------------------------------------------------------
// ATURAN WAJIB (sama dengan src/aset/data.js & src/catatan/data.js):
//   File ini TIDAK BOLEH meng-import App.jsx (circular import → layar putih).
//   Tanpa React/JSX/storage supaya bisa diuji `node uji-sampel.mjs`.
//
// KENAPA DITULIS SENDIRI, BUKAN PAKAI LIBRARY?
//   Modul Aset dulu memilih barcode Code 128 justru untuk MENGHINDARI menulis QR
//   dari nol. Untuk Manajemen Sampel, QR-nya wajib (label ditempel di kemasan dan
//   dipindai HP), dan menambah dependency npm berarti user non-teknis harus ikut
//   meng-commit package.json + package-lock.json lalu berharap install Vercel mulus.
//   Encoder ini dikunci pada kebutuhan app: MODE BYTE, LEVEL KOREKSI M, VERSI 1–10.
//   Cakupan itu memuat s/d 213 karakter — jauh di atas URL sampel (± 45 karakter).
//
// Yang diekspor:
//   matriksQr(teks)      -> { ukuran, modul: boolean[][] }  (true = kotak hitam)
//   qrSvgString(teks, o) -> string <svg> mandiri (dipakai cetak label & unduh)
//   KAPASITAS_BYTE_M     -> kapasitas byte per versi (uji + pesan error)
//
// Referensi format: ISO/IEC 18004 (QR Code). Semua tabel di bawah untuk LEVEL M.
// ============================================================================

// ====== GF(256) — aritmetika Galois untuk Reed-Solomon (poly 0x11D) ======
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

/** Perkalian dua elemen GF(256). 0 diserap (0 × apa pun = 0). */
export const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

/** Polinomial generator Reed-Solomon derajat n: (x−α⁰)(x−α¹)…(x−αⁿ⁻¹). Indeks 0 = derajat tertinggi. */
export function polinomGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];                    // suku × x
      ng[j + 1] ^= gfMul(g[j], EXP[i]); // suku × α^i
    }
    g = ng;
  }
  return g;
}

/** Kode koreksi (sisa bagi) Reed-Solomon sepanjang `ecLen` byte untuk `data`. */
export function ecReedSolomon(data, ecLen) {
  const g = polinomGenerator(ecLen);
  const res = new Array(data.length + ecLen).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const c = res[i];
    if (c === 0) continue;
    for (let j = 0; j < g.length; j++) res[i + j] ^= gfMul(g[j], c);
  }
  return res.slice(data.length);
}

// ====== TABEL VERSI 1–10, LEVEL KOREKSI M ======
// [ total codeword, ec codeword per blok, jumlah blok grup-1, data codeword grup-1,
//   jumlah blok grup-2, data codeword grup-2 ]
const TABEL_M = {
  1:  [26,  10, 1, 16, 0, 0],
  2:  [44,  16, 1, 28, 0, 0],
  3:  [70,  26, 1, 44, 0, 0],
  4:  [100, 18, 2, 32, 0, 0],
  5:  [134, 24, 2, 43, 0, 0],
  6:  [172, 16, 4, 27, 0, 0],
  7:  [196, 18, 4, 31, 0, 0],
  8:  [242, 22, 2, 38, 2, 39],
  9:  [292, 22, 3, 36, 2, 37],
  10: [346, 26, 4, 43, 1, 44],
};
export const VERSI_MAKS = 10;

/** Jumlah data codeword (byte isi + header) sebuah versi pada level M. */
export function dataCodeword(versi) {
  const [, ec, b1, d1, b2, d2] = TABEL_M[versi];
  return b1 * d1 + b2 * d2;
}

/** Kapasitas teks (byte) per versi pada level M — sudah dikurangi header mode & panjang. */
export const KAPASITAS_BYTE_M = (() => {
  const r = {};
  for (let v = 1; v <= VERSI_MAKS; v++) {
    const bitHeader = 4 + (v <= 9 ? 8 : 16);
    r[v] = Math.floor((dataCodeword(v) * 8 - bitHeader) / 8);
  }
  return r;
})();

// Titik tengah pola penyelaras (alignment) per versi. Versi 1 tidak punya.
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const ukuranVersi = (v) => v * 4 + 17;

/** Versi terkecil yang muat menampung `panjangByte`. null bila kepanjangan. */
export function versiUntuk(panjangByte) {
  for (let v = 1; v <= VERSI_MAKS; v++) if (panjangByte <= KAPASITAS_BYTE_M[v]) return v;
  return null;
}

// ====== BIT STREAM ======
function bitsDari(teks, versi) {
  const byte = [...new TextEncoder().encode(teks)];
  const bits = [];
  const tulis = (nilai, jml) => { for (let i = jml - 1; i >= 0; i--) bits.push((nilai >> i) & 1); };
  tulis(0b0100, 4);                          // penanda mode BYTE
  tulis(byte.length, versi <= 9 ? 8 : 16);   // penghitung karakter
  for (const b of byte) tulis(b, 8);

  const kapasitasBit = dataCodeword(versi) * 8;
  // Terminator maksimal 4 bit, lalu genapkan ke kelipatan 8.
  for (let i = 0; i < 4 && bits.length < kapasitasBit; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  // Byte padding bergantian 0xEC / 0x11 sampai penuh.
  const pad = [0xec, 0x11];
  let p = 0;
  while (bits.length < kapasitasBit) { tulis(pad[p % 2], 8); p++; }

  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    cw.push(v);
  }
  return cw;
}

/** Susun data codeword → blok, hitung EC, lalu selang-seling (interleave) sesuai spesifikasi. */
export function codewordFinal(teks, versi) {
  const data = bitsDari(teks, versi);
  const [, ecLen, b1, d1, b2, d2] = TABEL_M[versi];
  const blokData = [];
  let o = 0;
  for (let i = 0; i < b1; i++) { blokData.push(data.slice(o, o + d1)); o += d1; }
  for (let i = 0; i < b2; i++) { blokData.push(data.slice(o, o + d2)); o += d2; }
  const blokEc = blokData.map(b => ecReedSolomon(b, ecLen));

  const out = [];
  const maksData = Math.max(d1, d2);
  for (let i = 0; i < maksData; i++) for (const b of blokData) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blokEc) out.push(b[i]);
  return out;
}

// ====== POLA FUNGSI (finder, timing, alignment, format, versi) ======
function matriksKosong(n) {
  return Array.from({ length: n }, () => new Array(n).fill(false));
}

function pasangPolaFungsi(m, cadangan, versi) {
  const n = m.length;
  const set = (r, c, v) => { m[r][c] = v; cadangan[r][c] = true; };

  // 3 pola pencari (finder) 7×7 + pemisah (separator) 1 modul di sekelilingnya.
  const finder = (br, bc) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = br + r, cc = bc + c;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      const hitam = (r >= 0 && r <= 6 && (c === 0 || c === 6))
        || (c >= 0 && c <= 6 && (r === 0 || r === 6))
        || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      set(rr, cc, hitam);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

  // Pola waktu (timing) baris & kolom 6.
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

  // Pola penyelaras 5×5 — dilewati bila bertabrakan dengan pola pencari.
  const pusat = ALIGN[versi] || [];
  for (const r of pusat) for (const c of pusat) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }

  // Modul gelap wajib + cadangan area informasi format.
  set(n - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!cadangan[8][i]) set(8, i, false);
    if (!cadangan[i][8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!cadangan[8][n - 1 - i]) set(8, n - 1 - i, false);
    if (!cadangan[n - 1 - i][8]) set(n - 1 - i, 8, false);
  }

  // Informasi versi (hanya versi ≥ 7): dua blok 3×6 di sudut kiri-bawah & kanan-atas.
  if (versi >= 7) {
    const bits = bitVersi(versi);
    for (let i = 0; i < 18; i++) {
      const b = ((bits >> i) & 1) === 1;
      const r = Math.floor(i / 3), c = i % 3;
      set(n - 11 + c, r, b);
      set(r, n - 11 + c, b);
    }
  }
}

/** 18 bit informasi versi = 6 bit versi + 12 bit BCH(18,6). */
export function bitVersi(versi) {
  let d = versi << 12;
  for (let i = 0; i < 6; i++) if ((d >> (17 - i)) & 1) d ^= 0b1111100100101 << (5 - i);
  return (versi << 12) | (d & 0xfff);
}

/** 15 bit informasi format = (level M = 0b00) + 3 bit mask + BCH(15,5), di-XOR topeng standar. */
export function bitFormat(mask) {
  const data = (0b00 << 3) | mask; // 00 = level koreksi M
  let d = data << 10;
  for (let i = 0; i < 5; i++) if ((d >> (14 - i)) & 1) d ^= 0b10100110111 << (4 - i);
  return ((data << 10) | (d & 0x3ff)) ^ 0b101010000010010;
}

function pasangFormat(m, versi, mask) {
  const n = m.length;
  const bits = bitFormat(mask);
  const b = (i) => ((bits >> i) & 1) === 1;
  // Salinan 1: mengelilingi pola pencari kiri-atas — menaik di kolom 8 lalu mendatar di baris 8.
  for (let i = 0; i <= 5; i++) m[i][8] = b(i);
  m[7][8] = b(6); m[8][8] = b(7); m[8][7] = b(8);
  for (let i = 9; i <= 14; i++) m[8][14 - i] = b(i);
  // Salinan 2: 7 modul di kanan pola pencari kiri-bawah + 8 modul di bawah pola pencari kanan-atas.
  // Baris n-8 kolom 8 SENGAJA dilewati — itu modul gelap wajib, bukan bit format.
  for (let i = 0; i <= 6; i++) m[n - 1 - i][8] = b(i);
  for (let i = 7; i <= 14; i++) m[8][n - 15 + i] = b(i);
  m[n - 8][8] = true; // modul gelap
}

// ====== PENEMPATAN DATA (zig-zag dari kanan-bawah) ======
function pasangData(m, cadangan, cw) {
  const n = m.length;
  const bits = [];
  for (const c of cw) for (let i = 7; i >= 0; i--) bits.push(((c >> i) & 1) === 1);
  let idx = 0, naik = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--; // kolom 6 dipakai pola waktu — dilewati
    for (let i = 0; i < n; i++) {
      const row = naik ? n - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (cadangan[row][c]) continue;
        m[row][c] = idx < bits.length ? bits[idx] : false;
        idx++;
      }
    }
    naik = !naik;
  }
}

/** Rumus 8 topeng (mask) standar QR. */
export const RUMUS_MASK = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => ((((r * c) % 2) + ((r * c) % 3)) % 2) === 0,
  (r, c) => ((((r + c) % 2) + ((r * c) % 3)) % 2) === 0,
];

/** Nilai penalti sebuah matriks (aturan N1–N4). Makin kecil makin baik. */
export function penalti(m) {
  const n = m.length;
  let skor = 0;

  // N1 — deretan ≥5 modul sewarna (baris & kolom).
  const deret = (ambil) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        if (ambil(a, b) === ambil(a, b - 1)) run++;
        else { if (run >= 5) skor += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) skor += 3 + (run - 5);
    }
  };
  deret((a, b) => m[a][b]);
  deret((a, b) => m[b][a]);

  // N2 — blok 2×2 sewarna.
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c];
    if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) skor += 3;
  }

  // N3 — pola 1:1:3:1:1 dengan area terang 4 modul (mirip pola pencari).
  const P1 = [true, false, true, true, true, false, true, false, false, false, false];
  const P2 = [false, false, false, false, true, false, true, true, true, false, true];
  const cocok = (arr, pola, i) => pola.every((p, k) => arr[i + k] === p);
  const cekPola = (ambil) => {
    for (let a = 0; a < n; a++) {
      const baris = [];
      for (let b = 0; b < n; b++) baris.push(ambil(a, b));
      for (let i = 0; i + 11 <= n; i++) {
        if (cocok(baris, P1, i)) skor += 40;
        if (cocok(baris, P2, i)) skor += 40;
      }
    }
  };
  cekPola((a, b) => m[a][b]);
  cekPola((a, b) => m[b][a]);

  // N4 — ketimpangan proporsi hitam terhadap 50%.
  let hitam = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) hitam++;
  const persen = (hitam * 100) / (n * n);
  skor += Math.floor(Math.abs(persen - 50) / 5) * 10;
  return skor;
}

/**
 * Bangun matriks QR (mode byte, level koreksi M, versi 1–10, topeng dipilih otomatis).
 * @param {string} teks isi QR (biasanya URL sampel)
 * @returns {{ukuran:number, versi:number, mask:number, modul:boolean[][]}}
 * @throws {Error} bila teks kosong atau melebihi kapasitas versi 10.
 */
export function matriksQr(teks) {
  const s = String(teks == null ? '' : teks);
  if (!s) throw new Error('Isi QR kosong.');
  const panjang = new TextEncoder().encode(s).length;
  const versi = versiUntuk(panjang);
  if (!versi) throw new Error(`Isi QR terlalu panjang (${panjang} byte, maksimal ${KAPASITAS_BYTE_M[VERSI_MAKS]}).`);

  const n = ukuranVersi(versi);
  const cw = codewordFinal(s, versi);

  const dasar = matriksKosong(n);
  const cadangan = matriksKosong(n);
  pasangPolaFungsi(dasar, cadangan, versi);
  pasangData(dasar, cadangan, cw);

  let terbaik = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = dasar.map(row => row.slice());
    const f = RUMUS_MASK[mask];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!cadangan[r][c] && f(r, c)) m[r][c] = !m[r][c];
    }
    pasangFormat(m, versi, mask);
    const p = penalti(m);
    if (!terbaik || p < terbaik.p) terbaik = { p, m, mask };
  }
  return { ukuran: n, versi, mask: terbaik.mask, modul: terbaik.m };
}

/**
 * QR sebagai string <svg> mandiri — dipakai untuk cetak label & unduh.
 * Digambar sebagai satu <path>: jauh lebih ringan daripada ribuan <rect>.
 * @param {string} teks isi QR
 * @param {{ukuranPx?:number, quiet?:number, kelas?:string}} opsi
 */
export function qrSvgString(teks, { ukuranPx = 160, quiet = 4, kelas = '' } = {}) {
  const { ukuran, modul } = matriksQr(teks);
  const total = ukuran + quiet * 2;
  let d = '';
  for (let r = 0; r < ukuran; r++) for (let c = 0; c < ukuran; c++) {
    if (modul[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${ukuranPx}" height="${ukuranPx}"`
    + `${kelas ? ` class="${kelas}"` : ''} shape-rendering="crispEdges" role="img" aria-label="QR Code">`
    + `<rect width="${total}" height="${total}" fill="#FFFFFF"/>`
    + `<path d="${d}" fill="#000000"/>`
    + `</svg>`;
}

/** Data path <svg> saja (dipakai komponen React supaya tidak perlu dangerouslySetInnerHTML). */
export function qrPath(teks, quiet = 4) {
  const { ukuran, modul } = matriksQr(teks);
  let d = '';
  for (let r = 0; r < ukuran; r++) for (let c = 0; c < ukuran; c++) {
    if (modul[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  }
  return { d, total: ukuran + quiet * 2 };
}
