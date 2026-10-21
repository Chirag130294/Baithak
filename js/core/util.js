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

/** Normalises what people type or scan into a room code like KF-4821. */
export function parseCode(input) {
  if (!input) return null;
  let s = String(input).trim();
  const m = s.match(/#\/r\/([A-Za-z0-9-]+)/);
  if (m) s = m[1];
  s = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const mm = s.match(/^([A-Z]{2})(\d{4})$/);
  return mm ? mm[1] + '-' + mm[2] : null;
}
