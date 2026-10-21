// Kali Tiri (Kali ni Tidi, "3 of spades"): the bidder picks the trump and a hidden partner card; bidder + partner are the Trump team.
// Score book rules used here (all changeable in setup):
//  - Trump team makes its bid  -> every member of the Trump team scores the agreed bid.
//  - Trump team fails (the opposition wins) -> every defender scores DOUBLE the bid (multiplier changeable).
//    Optionally the Trump team also loses the bid.
//  - One deck: bids 150-250. Two decks ("bundle"): bids 300-500.
import { clone, rid } from '../../core/util.js';
import { clean } from '../../core/names.js';
import { voidLast, revise } from '../../core/history.js';

export const DEFAULTS = { decks: 1, minBid: 150, maxBid: 250, step: 5, defenderMult: 2, penalty: false };
export const DECK_RANGE = { 1: { minBid: 150, maxBid: 250, step: 5 }, 2: { minBid: 300, maxBid: 500, step: 10 } };
export const SUITS = ['S', 'D', 'C', 'H'];

const pid = () => 'p' + rid(6);
export function newGame({ names, config = {} }) {
  const players = names.map((n, i) => ({ id: pid(), name: clean(n.name || n) || 'Player ' + (i + 1), color: i % 8, out: false }));
  return { v: 1, game: 'kalitiri', config: { ...DEFAULTS, ...config }, players, rounds: [], paused: false, ended: false, log: [], startedAt: Date.now() };
}

/** Points each player gets for one round. Returns { id: points }. */
export function scoreRound(s, { bidder, partner, bid, made }) {
  const mult = Math.max(1, s.config.defenderMult || 2);
  const team = new Set([bidder, partner].filter(Boolean));
  const pts = {};
  s.players.filter((p) => !p.out).forEach((p) => {
    const mine = team.has(p.id);
    if (made) pts[p.id] = mine ? bid : 0;
    else pts[p.id] = mine ? (s.config.penalty ? -bid : 0) : bid * mult;   // the opposition won: they score double
  });
  return pts;
}

export function roundProblem(s, r) {
  const ids = s.players.filter((p) => !p.out).map((p) => p.id);
  if (!r.bidder || !ids.includes(r.bidder)) return 'Pick who bid';
  if (r.partner && (!ids.includes(r.partner) || r.partner === r.bidder)) return 'The partner must be someone else';
  const { minBid, maxBid } = s.config;
  if (!(r.bid >= minBid && r.bid <= maxBid)) return `Bid must be between ${minBid} and ${maxBid}`;
  if (typeof r.made !== 'boolean') return 'Did the Trump team make its bid?';
  return null;
}

export function addRound(s, r) {
  if (roundProblem(s, r)) return s;
  const n = clone(s);
  n.rounds.push({ n: n.rounds.length + 1, bidder: r.bidder, partner: r.partner || null, bid: Math.round(r.bid), trump: r.trump || null, made: !!r.made, pts: scoreRound(n, r), at: Date.now() });
  return n;
}

/** Fix a saved round. Needs a reason; the old version stays in the history. */
export function editRound(s, num, r, reason, by) {
  if (roundProblem(s, r)) return s;
  return revise(s, num, (x) => {
    Object.assign(x, { bidder: r.bidder, partner: r.partner || null, bid: Math.round(r.bid), trump: r.trump || null, made: !!r.made });
    x.pts = scoreRound(s, r);
  }, reason, by);
}
export const undo = (s, reason, by) => voidLast(s, reason, by);

export const totals = (s) => { const t = {}; s.players.forEach((p) => { t[p.id] = 0; }); s.rounds.forEach((r) => Object.entries(r.pts).forEach(([id, v]) => { if (id in t) t[id] += v; })); return t; };
function rank(s, t) {
  const rows = s.players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, out: p.out, total: t[p.id], seat: i }));
  rows.sort((a, b) => b.total - a.total || a.seat - b.seat);
  let r = 0, last = null; rows.forEach((x, i) => { if (x.total !== last) { r = i + 1; last = x.total; } x.rank = r; }); return rows;
}
export function standings(s) {
  const now = rank(s, totals(s));
  if (!s.rounds.length) return now.map((r) => ({ ...r, move: 0, gain: 0 }));
  const before = clone(s); before.rounds.pop();
  const pr = Object.fromEntries(rank(before, totals(before)).map((r) => [r.id, r.rank]));
  const last = s.rounds[s.rounds.length - 1];
  return now.map((r) => ({ ...r, move: (pr[r.id] ?? r.rank) - r.rank, gain: last.pts[r.id] || 0 }));
}
/** Per-player record: times bid, times made, times partner, doubles won. */
export function stats(s) {
  const o = {}; s.players.forEach((p) => { o[p.id] = { name: p.name, bids: 0, made: 0, partner: 0, defWins: 0 }; });
  s.rounds.forEach((r) => {
    if (o[r.bidder]) { o[r.bidder].bids++; if (r.made) o[r.bidder].made++; }
    if (r.partner && o[r.partner]) o[r.partner].partner++;
    if (!r.made) Object.keys(r.pts).forEach((id) => { if (id !== r.bidder && id !== r.partner && o[id]) o[id].defWins++; });
  });
  return Object.values(o);
}
export const reorder = (s, a, b) => { const n = clone(s); const [p] = n.players.splice(a, 1); n.players.splice(b, 0, p); return n; };
export const setOut = (s, id, out) => { const n = clone(s); const p = n.players.find((x) => x.id === id); if (p) p.out = out; return n; };
export const addPlayer = (s, name) => { const n = clone(s); n.players.push({ id: pid(), name: clean(name) || 'Player', color: n.players.length % 8, out: false }); return n; };
export const setPaused = (s, v) => { const n = clone(s); n.paused = !!v; return n; };
export const endGame = (s) => { const n = clone(s); n.ended = true; return n; };
