// Bhabhi: the last player left holding cards is the Bhabhi for that game. The table keeps count.
// Fewest times as Bhabhi is best. Streaks of bad luck are tracked for the fun of it.
import { clone, rid } from '../../core/util.js';

const pid = () => 'p' + rid(6);
export function newGame({ names, config = {} }) {
  const players = names.map((n, i) => ({ id: pid(), name: String(n.name || n).trim() || 'Player ' + (i + 1), color: i % 8, out: false }));
  return { v: 1, game: 'bhabhi', config: { ...config }, players, rounds: [], paused: false, ended: false, log: [], startedAt: Date.now() };
}
export const counts = (s, upTo = s.rounds.length) => { const c = {}; s.players.forEach((p) => { c[p.id] = 0; }); s.rounds.slice(0, upTo).forEach((r) => { if (r.bhabhi in c) c[r.bhabhi]++; }); return c; };
function rank(s, c) {
  const rows = s.players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, out: p.out, total: c[p.id], seat: i }));
  rows.sort((a, b) => a.total - b.total || a.seat - b.seat);
  let r = 0, last = null; rows.forEach((x, i) => { if (x.total !== last) { r = i + 1; last = x.total; } x.rank = r; }); return rows;
}
export function standings(s) {
  const now = rank(s, counts(s));
  if (!s.rounds.length) return now.map((r) => ({ ...r, move: 0, gain: 0 }));
  const pr = Object.fromEntries(rank(s, counts(s, s.rounds.length - 1)).map((r) => [r.id, r.rank]));
  const last = s.rounds[s.rounds.length - 1];
  return now.map((r) => ({ ...r, move: (pr[r.id] ?? r.rank) - r.rank, gain: r.id === last.bhabhi ? 1 : 0 }));
}
export function addGame(s, bhabhiId) {
  if (!s.players.some((p) => p.id === bhabhiId)) return s;
  const n = clone(s); n.rounds.push({ n: n.rounds.length + 1, bhabhi: bhabhiId, at: Date.now() }); return n;
}
export const undo = (s) => { if (!s.rounds.length) return s; const n = clone(s); n.rounds.pop(); return n; };
export function streaks(s) {
  const best = {}; let run = 0, prev = null;
  s.rounds.forEach((r) => { run = r.bhabhi === prev ? run + 1 : 1; prev = r.bhabhi; best[r.bhabhi] = Math.max(best[r.bhabhi] || 0, run); });
  return best;
}
export const setPaused = (s, v) => { const n = clone(s); n.paused = !!v; return n; };
export const endGame = (s) => { const n = clone(s); n.ended = true; return n; };
export const addPlayer = (s, name) => { const n = clone(s); n.players.push({ id: pid(), name: name.trim() || 'Player', color: n.players.length % 8, out: false }); return n; };
export const reorder = (s, a, b) => { const n = clone(s); const [p] = n.players.splice(a, 1); n.players.splice(b, 0, p); return n; };
export const setOut = (s, id, out) => { const n = clone(s); const p = n.players.find((x) => x.id === id); if (p) p.out = out; return n; };
