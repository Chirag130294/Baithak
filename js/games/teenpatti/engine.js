// Teen Patti chip ledger. Each hand: everyone puts chips in, one player takes the pot. Balances show who is up or down,
// and "settle up" works out the fewest payments so everyone is square.
import { clone, rid } from '../../core/util.js';

const pid = () => 'p' + rid(6);
export function newGame({ names, config = {} }) {
  const players = names.map((n, i) => ({ id: pid(), name: String(n.name || n).trim() || 'Player ' + (i + 1), color: i % 8, out: false }));
  return { v: 1, game: 'teenpatti', config: { boot: 10, unit: 'chips', ...config }, players, rounds: [], paused: false, ended: false, log: [], startedAt: Date.now() };
}
/** hand = { n, put:{id:amount}, winnerId, pot }  (net for each = (won ? pot : 0) - put) */
export const balances = (s, upTo = s.rounds.length) => {
  const b = {}; s.players.forEach((p) => { b[p.id] = 0; });
  s.rounds.slice(0, upTo).forEach((h) => { Object.entries(h.put).forEach(([id, a]) => { if (id in b) b[id] -= a; }); if (h.winnerId in b) b[h.winnerId] += h.pot; });
  return b;
};
function rank(s, b) {
  const rows = s.players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, out: p.out, total: b[p.id], seat: i }));
  rows.sort((a, c) => c.total - a.total || a.seat - c.seat);
  let r = 0, last = null; rows.forEach((x, i) => { if (x.total !== last) { r = i + 1; last = x.total; } x.rank = r; }); return rows;
}
export function standings(s) {
  const now = rank(s, balances(s));
  if (!s.rounds.length) return now.map((r) => ({ ...r, move: 0, gain: 0 }));
  const pr = Object.fromEntries(rank(s, balances(s, s.rounds.length - 1)).map((r) => [r.id, r.rank]));
  const h = s.rounds[s.rounds.length - 1];
  return now.map((r) => ({ ...r, move: (pr[r.id] ?? r.rank) - r.rank, gain: (r.id === h.winnerId ? h.pot : 0) - (h.put[r.id] || 0) }));
}
export function addHand(s, put, winnerId) {
  const clean = {}; let pot = 0;
  Object.entries(put).forEach(([id, a]) => { const v = Math.max(0, Math.round(Number(a) || 0)); if (v) { clean[id] = v; pot += v; } });
  if (!winnerId || !pot || !s.players.some((p) => p.id === winnerId)) return s;
  const n = clone(s); n.rounds.push({ n: n.rounds.length + 1, put: clean, winnerId, pot, at: Date.now() }); return n;
}
export const undo = (s) => { if (!s.rounds.length) return s; const n = clone(s); n.rounds.pop(); return n; };
/** Fewest payments to settle every balance. Returns [{from,to,amount}] by player id. */
export function settle(s) {
  const b = balances(s);
  const debtors = [], creditors = [];
  Object.entries(b).forEach(([id, v]) => { if (v < 0) debtors.push({ id, v: -v }); else if (v > 0) creditors.push({ id, v }); });
  debtors.sort((a, c) => c.v - a.v); creditors.sort((a, c) => c.v - a.v);
  const out = []; let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const m = Math.min(debtors[i].v, creditors[j].v);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: m });
    debtors[i].v -= m; creditors[j].v -= m;
    if (!debtors[i].v) i++; if (!creditors[j].v) j++;
  }
  return out;
}
export const setPaused = (s, v) => { const n = clone(s); n.paused = !!v; return n; };
export const endGame = (s) => { const n = clone(s); n.ended = true; return n; };
export const addPlayer = (s, name) => { const n = clone(s); n.players.push({ id: pid(), name: name.trim() || 'Player', color: n.players.length % 8, out: false }); return n; };
export const reorder = (s, a, b) => { const n = clone(s); const [p] = n.players.splice(a, 1); n.players.splice(b, 0, p); return n; };
export const setOut = (s, id, out) => { const n = clone(s); const p = n.players.find((x) => x.id === id); if (p) p.out = out; return n; };
