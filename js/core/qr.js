// Tiny QR code generator (byte mode, error correction M, versions 1-6 = up to 106 characters).
// No libraries needed, so it also works offline. Returns a square matrix of booleans or an SVG string.

const VERS = { // version: [ecPerBlock, [[blocks, dataCodewordsPerBlock], ...]]
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]],
  4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]]
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

// Galois field 256 tables
const EXP = new Array(512), LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGen(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}
function rsEncode(data, n) {
  const gen = rsGen(n), res = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ res[0];
    res.shift(); res.push(0);
    if (f) for (let i = 0; i < n; i++) res[i] ^= gmul(gen[i + 1], f);
  }
  return res;
}

function utf8(s) { return Array.from(new TextEncoder().encode(s)); }

function makeCodewords(bytes, ver) {
  const [ec, groups] = VERS[ver];
  const dataCap = groups.reduce((s, [n, d]) => s + n * d, 0);
  const bits = [];
  const put = (v, len) => { for (let i = len - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  put(4, 4); put(bytes.length, 8); bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0; cw.length < dataCap; pad++) cw.push(pad % 2 ? 0x11 : 0xec);
  const blocks = []; let p = 0;
  groups.forEach(([n, d]) => { for (let i = 0; i < n; i++) { const data = cw.slice(p, p + d); p += d; blocks.push({ data, ec: rsEncode(data, ec) }); } });
  const out = [];
  const maxD = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxD; i++) blocks.forEach((b) => { if (i < b.data.length) out.push(b.data[i]); });
  for (let i = 0; i < ec; i++) blocks.forEach((b) => out.push(b.ec[i]));
  return out;
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

function formatBits(mask) { // EC level M = 0b00
  const data = (0 << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

function build(codewords, ver, mask) {
  const n = 17 + ver * 4;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fn = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, v, f = true) => { m[r][c] = v; if (f) fn[r][c] = true; };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(rr, cc, on);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[ver];
  al.forEach((r) => al.forEach((c) => {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (c === 6 && r === al[al.length - 1])) return;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }));
  set(n - 8, 8, true); // dark module
  // reserve format areas
  for (let i = 0; i < 9; i++) { fn[8][i] = true; fn[i][8] = true; }
  for (let i = 0; i < 8; i++) { fn[8][n - 1 - i] = true; fn[n - 1 - i][8] = true; }
  // data placement
  const bits = [];
  codewords.forEach((b) => { for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1); });
  let bi = 0, up = true;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (let cc = c; cc > c - 2; cc--) {
        if (fn[r][cc]) continue;
        let v = bi < bits.length ? bits[bi++] === 1 : false;
        if (MASKS[mask](r, cc)) v = !v;
        m[r][cc] = v;
      }
    }
    up = !up;
  }
  // format info
  const f = formatBits(mask);
  const fb = (i) => ((f >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[i][8] = fb(i);
  m[7][8] = fb(6); m[8][8] = fb(7); m[8][7] = fb(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = fb(i);
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = fb(i);
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = fb(i);
  return m;
}

function penalty(m) {
  const n = m.length; let p = 0;
  const line = (get) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
      }
    }
  };
  line((a, b) => m[a][b]); line((a, b) => m[b][a]);
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], rev = pat.slice().reverse();
  const hit = (get) => { for (let a = 0; a < n; a++) for (let b = 0; b <= n - 11; b++) {
    let x = true, y = true;
    for (let k = 0; k < 11; k++) { const v = get(a, b + k) ? 1 : 0; if (v !== pat[k]) x = false; if (v !== rev[k]) y = false; }
    if (x) p += 40; if (y) p += 40; } };
  hit((a, b) => m[a][b]); hit((a, b) => m[b][a]);
  let dark = 0; m.forEach((row) => row.forEach((v) => { if (v) dark++; }));
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return p;
}

/** Returns a boolean matrix, or null when the text is too long for versions 1-6. */
export function qrMatrix(text) {
  const bytes = utf8(text);
  let ver = 0;
  for (let v = 1; v <= 6; v++) { const cap = VERS[v][1].reduce((s, [n, d]) => s + n * d, 0); if (bytes.length + 2 <= cap) { ver = v; break; } }
  if (!ver) return null;
  const cw = makeCodewords(bytes, ver);
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) { const m = build(cw, ver, mask); const p = penalty(m); if (p < bestP) { bestP = p; best = m; } }
  return best;
}

export function qrSvg(text, { size = 220, margin = 4, dark = '#12261F', light = '#FFFFFF' } = {}) {
  const m = qrMatrix(text);
  if (!m) return '';
  const n = m.length, total = n + margin * 2;
  let d = '';
  m.forEach((row, r) => { let c = 0; while (c < n) { if (row[c]) { let e = c; while (e < n && row[e]) e++; d += `M${c + margin} ${r + margin}h${e - c}v1h-${e - c}z`; c = e; } else c++; } });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${total}" height="${total}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
