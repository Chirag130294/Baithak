// Player names: tidy input, count letters the way people do (Gujarati, emoji), and catch duplicates.
export const MAX_NAME = 20;
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
export const graphemes = (s) => (seg ? [...seg.segment(String(s || ''))].map((x) => x.segment) : Array.from(String(s || '')));

// zero-width characters, direction marks, BOM, control characters
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F​‌‍⁠‎‏‪-‮⁦-⁩﻿]/g;
// NOTE: ‌/‍ joiners are removed only when comparing; clean() keeps them so emoji sequences stay intact.
const INVISIBLE_KEEP_JOINERS = /[\u0000-\u001F\u007F-\u009F​⁠‎‏‪-‮⁦-⁩﻿]/g;

/** "chirag" / "RITU" / "ritu patel" -> "Chirag" / "Ritu" / "Ritu Patel". Words that already have mixed case ("McDonald", "DJ Amit") and scripts without case (Gujarati) are left alone. */
export function titleCase(name) {
  return String(name || '').split(' ').map((w) => {
    const lo = w.toLocaleLowerCase(), up = w.toLocaleUpperCase();
    if (!w || (w === lo) === (w === up)) return w;   // no cased letters (Gujarati, digits, emoji) or mixed case: leave it
    return w.toLocaleLowerCase().replace(/(^|[-'’.])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase());
  }).join(' ');
}
/** What is stored: no hidden characters, single spaces, trimmed, tidy capitals, at most 20 letters. */
export function clean(name, max = MAX_NAME) {
  const t = titleCase(String(name || '').normalize('NFC').replace(INVISIBLE_KEEP_JOINERS, '').replace(/\s+/g, ' ').trim());
  const g = graphemes(t);
  return g.length > max ? g.slice(0, max).join('').trim() : t;
}
/** Live typing clamp: keeps the 20 letter limit without trimming the space the person just typed. */
export function clamp(value, max = MAX_NAME) {
  const t = String(value || '').replace(INVISIBLE_KEEP_JOINERS, '').replace(/\s{2,}/g, ' ');
  const g = graphemes(t);
  return g.length > max ? g.slice(0, max).join('') : t;
}
/** Two names count as the same when only case, spacing, accents-form or hidden characters differ. */
export const key = (name) => String(name || '').normalize('NFKC').replace(INVISIBLE, '').replace(/\s+/g, '').toLocaleLowerCase();
export const same = (a, b) => key(a) !== '' && key(a) === key(b);

/** The first name that is used twice (the later one), or null. Returns { name, index }. */
export function findDuplicate(names) {
  const seen = new Set();
  for (let i = 0; i < names.length; i++) {
    const k = key(names[i]); if (!k) continue;
    if (seen.has(k)) return { name: clean(names[i]), index: i };
    seen.add(k);
  }
  return null;
}
/** "Ritu" -> "Ritu 2" (or 3, 4...) so it does not clash with the names already taken. */
export function suggest(name, taken) {
  const base = clean(name, MAX_NAME - 2);
  for (let n = 2; n < 100; n++) { const c = `${base} ${n}`; if (!taken.some((x) => same(x, c))) return c; }
  return base + ' 2';
}
/** For older rooms that already contain duplicates: the later ones get "(2)", "(3)" so nobody is confused. Mutates and returns the players. */
export function fixDuplicates(players) {
  const count = new Map();
  (players || []).forEach((p) => {
    p.name = titleCase(p.name);   // older rooms: show "chirag" as "Chirag
    const k = key(p.name); if (!k) return;
    const n = (count.get(k) || 0) + 1; count.set(k, n);
    if (n > 1 && !/\(\d+\)$/.test(p.name)) p.name = `${p.name} (${n})`;
  });
  return players;
}
export const firstLetter = (name) => (graphemes(String(name || '').trim())[0] || '?').toLocaleUpperCase();
