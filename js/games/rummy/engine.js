// Rummy score book (points rummy / pool). Winner of a round scores 0. Others add their count of cards.
// Drop = 20, middle drop = 40, wrong show or big hand is capped at 80 (all changeable). Lowest total is best.
// Pool mode: reaching the target (101 / 201 / 250) knocks a player out; last one standing wins.
import { clone, rid } from '../../core/util.js';
import { voidLast, revise } from '../../core/history.js';

export const DEFAULTS = { drop: 20, middle: 40, cap: 80, target: 201, pool: true };
const pid = () => 'p' + rid(6);

export function newGame({ names, config = {} }) {
  const players = names.map((n, i) => ({ id: pid(), name: String(n.name || n).trim() || 'Player ' + (i + 1), color: i % 8, out: false }));
  return { v: 1, game: 'rummy', config: { ...DEFAULTS, ...config }, players, rounds: [], paused: false, ended: false, log: [], startedAt: Date.now() };
}
export const totals = (s) => { const t = {}; s.players.forEach((p) => { t[p.id] = 0; }); s.rounds.forEach((r) => Object.entries(r.pts).forEach(([id, v]) => { if (id in t) t[id] += v; })); return t; };
/** A player is knocked out when they reach the target (pool mode). */
export const knockedOut = (s, t = totals(s)) => (s.config.pool ? s.players.filter((p) => t[p.id] >= s.config.target).map((p) => p.id) : []);
export function standings(s, forRounds = s.rounds.length) {
  const tmp = { ...s, rounds: s.rounds.slice(0, forRounds) };
  const t = totals(tmp), ko = knockedOut(tmp, t);
  const rows = s.players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, out: p.out || ko.includes(p.id), total: t[p.id], seat: i }));
  rows.sort((a, b) => (a.out - b.out) || (a.total - b.total) || (a.seat - b.seat));
  let r = 0, last = null, lastOut = null;
  rows.forEach((x, i) => { if (x.total !== last || x.out !== lastOut) { r += 1; last = x.total; lastOut = x.out; } x.rank = r; });
  return rows;
}
export function withMoves(s) {
  const now = standings(s);
  if (!s.rounds.length) return now.map((r) => ({ ...r, move: 0, gain: 0 }));
  const pr = Object.fromEntries(standings(s, s.rounds.length - 1).map((r) => [r.id, r.rank]));
  const last = s.rounds[s.rounds.length - 1];
  return now.map((r) => ({ ...r, move: (pr[r.id] ?? r.rank) - r.rank, gain: last.pts[r.id] || 0 }));
}
/** entry per player: { kind:'win'|'drop'|'middle'|'count', value? } */
export function pointsFor(entry, cfg) {
  if (entry.kind === 'win') return 0;
  if (entry.kind === 'drop') return cfg.drop;
  if (entry.kind === 'middle') return cfg.middle;
  return Math.min(cfg.cap, Math.max(0, Math.round(Number(entry.value) || 0)));
}
export function roundProblem(entries, ids) {
  const wins = ids.filter((id) => entries[id] && entries[id].kind === 'win').length;
  if (wins !== 1) return 'Exactly one player must win the round';
  if (ids.some((id) => !entries[id])) return 'Everyone needs an entry';
  return null;
}
export function addRound(s, entries) {
  const ids = playing(s).map((p) => p.id);
  if (roundProblem(entries, ids)) return s;
  const n = clone(s);
  const pts = {}, kinds = {};
  ids.forEach((id) => { pts[id] = pointsFor(entries[id], n.config); kinds[id] = entries[id].kind; });
  n.rounds.push({ n: n.rounds.length + 1, pts, kinds, at: Date.now() });
  const alive = standings(n).filter((r) => !r.out);
  if (n.config.pool && alive.length <= 1) n.ended = true;
  return n;
}
export const playing = (s) => { const ko = knockedOut(s); return s.players.filter((p) => !p.out && !ko.includes(p.id)); };
export const undo = (s, reason, by) => { const n = voidLast(s, reason, by); if (n !== s) n.ended = false; return n; };
/** Fix the points of a saved round (the winner scores 0). Needs a reason; the old points stay in the history. */
export function editRound(s, num, pts, reason, by) {
  return revise(s, num, (r) => { Object.keys(r.pts).forEach((id) => { r.pts[id] = Math.max(0, Math.round(Number(pts[id]) || 0)); if (r.pts[id] > 0 && r.kinds && r.kinds[id] === 'win') r.kinds[id] = 'count'; if (r.pts[id] === 0 && r.kinds) r.kinds[id] = 'win'; }); }, reason, by);
}
export const setPaused = (s, v) => { const n = clone(s); n.paused = !!v; return n; };
export const endGame = (s) => { const n = clone(s); n.ended = true; return n; };
export const addPlayer = (s, name, start = 'highest') => {
  const n = clone(s); const t = totals(n); const alive = playing(n).map((p) => t[p.id]);
  const p = { id: pid(), name: name.trim() || 'Player', color: n.players.length % 8, out: false };
  n.players.push(p);
  // a late joiner usually starts on the highest live score so they cannot get an easy ride
  const base = start === 'zero' || !alive.length ? 0 : Math.max(...alive);
  if (base) n.rounds.push({ n: n.rounds.length + 1, pts: { [p.id]: base }, kinds: { [p.id]: 'count' }, at: Date.now(), joined: true });
  return n;
};
export const reorder = (s, a, b) => { const n = clone(s); const [p] = n.players.splice(a, 1); n.players.splice(b, 0, p); return n; };
export const setOut = (s, id, out) => { const n = clone(s); const p = n.players.find((x) => x.id === id); if (p) p.out = out; return n; };
