// Score Book: any card or board game. Add a round of points for each player, highest or lowest total wins.
import { clone, sum, rid } from '../../core/util.js';
import { voidLast, revise } from '../../core/history.js';

const pid = () => 'p' + rid(6);
export function newGame({ names, config = {} }) {
  const players = names.map((n, i) => ({ id: pid(), name: String(n.name || n).trim() || 'Player ' + (i + 1), color: i % 8, out: false }));
  return { v: 1, game: 'scorebook', config: { lowWins: false, target: 0, title: '', ...config }, players, rounds: [], paused: false, ended: false, log: [], startedAt: Date.now() };
}
export const totals = (s) => { const t = {}; s.players.forEach((p) => { t[p.id] = 0; }); s.rounds.forEach((r) => Object.entries(r.pts).forEach(([id, v]) => { if (id in t) t[id] += v; })); return t; };
function rank(s, t) {
  const rows = s.players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, out: p.out, total: t[p.id], seat: i }));
  rows.sort((a, b) => (s.config.lowWins ? a.total - b.total : b.total - a.total) || a.seat - b.seat);
  let r = 0, last = null; rows.forEach((x, i) => { if (x.total !== last) { r += 1; last = x.total; } x.rank = r; }); return rows;
}
export function standings(s) {
  const now = rank(s, totals(s));
  if (!s.rounds.length) return now.map((r) => ({ ...r, move: 0, gain: 0 }));
  const before = clone(s); before.rounds.pop();
  const pr = Object.fromEntries(rank(before, totals(before)).map((r) => [r.id, r.rank]));
  const last = s.rounds[s.rounds.length - 1];
  return now.map((r) => ({ ...r, move: (pr[r.id] ?? r.rank) - r.rank, gain: last.pts[r.id] || 0 }));
}
export function addRound(s, pts) {
  const n = clone(s);
  const clean = {}; n.players.forEach((p) => { if (!p.out) clean[p.id] = Math.round(Number(pts[p.id]) || 0); });
  n.rounds.push({ n: n.rounds.length + 1, pts: clean, at: Date.now() });
  if (n.config.target) { const t = totals(n); if (Object.values(t).some((v) => (n.config.lowWins ? v >= n.config.target : v >= n.config.target))) n.log.unshift({ ts: Date.now(), txt: 'Target reached' }); }
  return n;
}
export function editRound(s, num, pts, reason, by) { return revise(s, num, (r) => { Object.keys(r.pts).forEach((id) => { r.pts[id] = Math.round(Number(pts[id]) || 0); }); }, reason, by); }
export const undo = (s, reason, by) => voidLast(s, reason, by);
export const reorder = (s, a, b) => { const n = clone(s); const [p] = n.players.splice(a, 1); n.players.splice(b, 0, p); return n; };
export const shuffleSeats = (s, rnd = Math.random) => { const n = clone(s); for (let i = n.players.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [n.players[i], n.players[j]] = [n.players[j], n.players[i]]; } return n; };
export const setOut = (s, id, out) => { const n = clone(s); const p = n.players.find((x) => x.id === id); if (p) p.out = out; return n; };
export const addPlayer = (s, name) => { const n = clone(s); n.players.push({ id: pid(), name: name.trim() || 'Player', color: n.players.length % 8, out: false }); return n; };
export const setPaused = (s, v) => { const n = clone(s); n.paused = !!v; return n; };
export const endGame = (s) => { const n = clone(s); n.ended = true; return n; };
export const grand = (s) => sum(Object.values(totals(s)));
