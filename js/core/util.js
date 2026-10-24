// Small pure helpers shared by the hub and every game.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const sum = (arr) => arr.reduce((s, n) => s + (Number(n) || 0), 0);
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function rid(n = 8) {
  const out = [];
  const bytes = new Uint8Array(n);
  (globalThis.crypto || { getRandomValues: (a) => a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256))) }).getRandomValues(bytes);
  for (const b of bytes) out.push(ALPHABET[b % ALPHABET.length]);
  return out.join('');
}

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ls = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } },
  del(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
  keys(prefix) {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch { /* ignore */ }
    return out;
  }
};

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function timeAgo(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' h ago';
  return Math.round(h / 24) + ' d ago';
}

export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Room codes: 2-letter game prefix + 8 letters/numbers, shown as KF-7H4K-9QXM. No 0/O, 1/I/L so they can be read aloud.
 *  31^8 is about 850 billion combinations. Older rooms with a 4-digit code (KF-4821) still open. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function randomCodeBody(n = 8, rnd) {
  const A = CODE_ALPHABET, limit = 256 - (256 % A.length);   // reject the top few values so every character is equally likely
  const bytes = new Uint8Array(64); let out = '';
  while (out.length < n) {
    if (rnd) { out += A[Math.floor(rnd() * A.length)]; continue; }
    (globalThis.crypto || { getRandomValues: (a) => a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256))) }).getRandomValues(bytes);
    for (const b of bytes) { if (b < limit && out.length < n) out += A[b % A.length]; }
  }
  return out;
}
export const makeCode = (prefix, rnd) => { const b = randomCodeBody(8, rnd); return `${prefix}-${b.slice(0, 4)}-${b.slice(4)}`; };
export const NEW_CODE_RE = /^[A-Z]{2}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

/** Normalises what people type or scan into a room code like KF-7H4K-9QXM (or an older KF-4821). */
export function parseCode(input) {
  if (!input) return null;
  let s = String(input).trim();
  const m = s.match(/#\/r\/([A-Za-z0-9-]+)/);
  if (m) s = m[1];
  s = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const nw = s.match(/^([A-Z]{2})([2-9A-HJKMNP-Z]{4})([2-9A-HJKMNP-Z]{4})$/);
  if (nw) return `${nw[1]}-${nw[2]}-${nw[3]}`;
  const old = s.match(/^([A-Z]{2})(\d{4})$/);
  return old ? old[1] + '-' + old[2] : null;
}
