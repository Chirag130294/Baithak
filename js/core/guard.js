// Friendly brute-force brake for joining rooms. Lives on this phone only.
//   3 wrong tries in a row -> locked for 1 minute, the next 3 wrong tries -> 3 minutes, then 6, 12, 30 and 60 (stays at 60).
//   A right code clears the current streak. The harsher level cools off again after 24 hours without a wrong try.
// This is a speed bump for honest typos and lazy scripts. The real protection is the long random room code, App Check and the database rules
// (a phone-side limit can always be skipped by clearing site data, so nothing here is relied on for security).
import { ls } from './util.js';

const KEY = 'baithak:guard', KNOWN = 'baithak:known';
export const TRIES = 3;
export const STEPS_MIN = [1, 3, 6, 12, 30, 60];
const COOL_OFF = 24 * 3600 * 1000;

const read = () => { const g = ls.get(KEY, null); return g && typeof g === 'object' ? { fails: +g.fails || 0, strikes: +g.strikes || 0, until: +g.until || 0, last: +g.last || 0 } : { fails: 0, strikes: 0, until: 0, last: 0 }; };
const write = (g) => ls.set(KEY, g);

/** { blocked, ms } - how long this phone must wait before trying another room code. */
export function status(now = Date.now()) {
  const g = read();
  return g.until > now ? { blocked: true, ms: g.until - now } : { blocked: false, ms: 0 };
}

/** Records one wrong code (bad format, no such room, wrong PIN). Returns the new status. */
export function fail(now = Date.now()) {
  const g = read();
  if (g.last && now - g.last > COOL_OFF && g.until <= now) { g.strikes = 0; g.fails = 0; }
  g.last = now;
  if (g.until > now) { write(g); return status(now); }   // already locked: extra tries do not stack
  g.fails += 1;
  if (g.fails >= TRIES) {
    g.fails = 0;
    g.until = now + STEPS_MIN[Math.min(g.strikes, STEPS_MIN.length - 1)] * 60000;
    g.strikes += 1;
  }
  write(g);
  return status(now);
}

/** A room opened fine: forget the wrong-try streak and remember the code so it always opens, even during a lock. */
export function ok(code) {
  const g = read();
  if (g.fails) { g.fails = 0; write(g); }
  if (!code) return;
  const k = ls.get(KNOWN, []).filter((c) => c !== code);
  k.unshift(code); ls.set(KNOWN, k.slice(0, 60));
}

/** Rooms this phone has opened before are never blocked by a lock. */
export function isKnown(code) {
  if (!code) return false;
  if (ls.get(KNOWN, []).includes(code)) return true;
  const w = ls.get('baithak:watched', []);
  if (w.some((x) => x && x.code === code)) return true;
  const last = ls.get('baithak:lastRoom', null);
  return !!(last && last.code === code);
}

export const fmt = (ms) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/** Keeps a join box honest: while locked, disables the Watch and Scan buttons and shows a live countdown. Returns a cleanup. */
export function bindJoinGuard(root, tr) {
  const msg = root.querySelector('[data-lockmsg]');
  const btns = [...root.querySelectorAll('[data-join],[data-scan]')], input = root.querySelector('[data-code]');
  if (!msg) return () => {};
  let iv = 0;
  const tick = () => {
    const s = status();
    btns.forEach((b) => { b.disabled = s.blocked; });
    if (input) input.disabled = s.blocked;
    msg.hidden = !s.blocked;
    if (s.blocked) msg.textContent = tr('Too many wrong codes. Try again in {t}.', { t: fmt(s.ms) });
    else if (iv) { clearInterval(iv); iv = 0; }
  };
  tick();
  if (status().blocked) iv = setInterval(tick, 500);
  const api = () => { clearInterval(iv); iv = 0; };
  api.refresh = () => { tick(); if (status().blocked && !iv) iv = setInterval(tick, 500); };
  return api;
}
