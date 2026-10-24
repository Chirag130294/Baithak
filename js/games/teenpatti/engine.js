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
  let r = 0, last = null; rows.forEach((x, i) => { if (x.total !== last) { r += 1; last = x.total; } x.rank = r; }); return rows;
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
const okReason = (r) => typeof r === 'string' && r.trim().length >= 3;
const cleanR = (r) => String(r).trim().replace(/\s+/g, ' ').slice(0, 120);
/** Undo of a finished hand needs a reason. The removed hand stays in s.voided (shown struck through) and no longer counts. */
export const undoNeedsReason = (s) => !s.cur && s.rounds.length > 0;
export const undo = (s, reason, by) => {
  if (!s.rounds.length || !okReason(reason)) return s;
  const n = clone(s); const h = n.rounds.pop();
  n.voided = [...(n.voided || []), { ...h, kind: 'UNDO', reason: cleanR(reason), by: by || '', voidedAt: Date.now() }];
  return n;
};
/** Change the winner of a finished hand. Needs a reason; the old result stays in the hand's history. */
export function modifyHand(s, handN, winnerId, reason, by) {
  if (!okReason(reason)) return s;
  const h0 = s.rounds.find((x) => x.n === handN);
  if (!h0 || h0.winnerId === winnerId || !(winnerId in h0.put) || (h0.st && h0.st[winnerId] === 'packed')) return s;
  const n = clone(s); const h = n.rounds.find((x) => x.n === handN);
  h.revs = [...(h.revs || []), { kind: 'EDIT', winnerId: h.winnerId, pot: h.pot, reason: cleanR(reason), by: by || '', at: Date.now() }];
  h.winnerId = winnerId;
  return n;
}
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

// ---------- live hand (blind / seen / packed) ----------
// state.cur = { n, stake, order:[ids], pl:{ id:{ st:'blind'|'seen'|'packed', put } } }
// Everyone puts in the boot to start. A blind player's chaal is half the stake, a seen player's chaal is the full stake.
// "Raise" doubles the stake. When the hand ends the host picks a winner among players who have not packed.
export const potOf = (cur) => (cur ? Object.values(cur.pl).reduce((a, p) => a + p.put, 0) : 0);
export const chaalAmount = (cur, id) => { const p = cur.pl[id]; return p.st === 'blind' ? Math.max(1, Math.ceil(cur.stake / 2)) : cur.stake; };
export const live = (cur) => cur.order.filter((id) => cur.pl[id].st !== 'packed');

export function startHand(s) {
  if (s.cur) return s;
  const n = clone(s);
  const act = n.players.filter((p) => !p.out);
  const boot = n.config.boot;
  n.cur = { n: n.rounds.length + 1, stake: boot, order: act.map((p) => p.id), pl: Object.fromEntries(act.map((p) => [p.id, { st: 'blind', put: boot }])) };
  return n;
}
export function setStatus(s, id, st) {
  if (!s.cur || !s.cur.pl[id]) return s;
  const n = clone(s); n.cur.pl[id].st = st; return n;
}
export function chaal(s, id) {
  if (!s.cur || !s.cur.pl[id] || s.cur.pl[id].st === 'packed') return s;
  const n = clone(s); n.cur.pl[id].put += chaalAmount(n.cur, id); return n;
}
export function raise(s, id) {
  if (!s.cur || !s.cur.pl[id] || s.cur.pl[id].st === 'packed') return s;
  const n = clone(s); n.cur.stake *= 2; n.cur.pl[id].put += chaalAmount(n.cur, id); return n;
}
export function setPut(s, id, v) {
  if (!s.cur || !s.cur.pl[id]) return s;
  const n = clone(s); n.cur.pl[id].put = Math.max(0, Math.round(Number(v) || 0)); return n;
}
export function setStake(s, v) {
  if (!s.cur) return s;
  const n = clone(s); n.cur.stake = Math.max(1, Math.round(Number(v) || 1)); return n;
}
export function declareWinner(s, winnerId) {
  if (!s.cur || !s.cur.pl[winnerId] || s.cur.pl[winnerId].st === 'packed') return s;
  const put = {}, st = {};
  s.cur.order.forEach((id) => { put[id] = s.cur.pl[id].put; st[id] = s.cur.pl[id].st; });
  const n = clone(s);
  const pot = potOf(s.cur);
  n.rounds.push({ n: s.cur.n, put, winnerId, pot, st, at: Date.now() });
  n.cur = null;
  return n;
}
export const cancelHand = (s) => { if (!s.cur) return s; const n = clone(s); n.cur = null; return n; };
/** Undo: drop the hand in progress, otherwise remove the last finished hand. */
export function undoAll(s, reason, by) { return s.cur ? cancelHand(s) : undo(s, reason, by); }

export function stats(s) {
  const per = {}; s.players.forEach((p) => { per[p.id] = { name: p.name, packed: 0, blindWins: 0, wins: 0, hands: 0 }; });
  s.rounds.forEach((h) => Object.keys(h.put).forEach((id) => {
    const x = per[id]; if (!x) return; x.hands++;
    if (h.st && h.st[id] === 'packed') x.packed++;
    if (h.winnerId === id) { x.wins++; if (h.st && h.st[id] === 'blind') x.blindWins++; }
  }));
  return Object.values(per);
}
