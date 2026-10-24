// Kali Tiri (Kali ni Tidi, "3 of spades"): the bidder picks the trump and a hidden partner card; bidder + partner are the Trump team.
// Score book rules used here (all changeable in setup):
//  - Trump team makes its bid  -> every member of the Trump team scores the agreed bid.
//  - Trump team fails (the opposition wins) -> every defender scores DOUBLE the bid (multiplier changeable).
//    Optionally the Trump team also loses the bid.
//  - One deck: bids 150-250. Two decks ("bundle"): 300-500. Three decks: 450-750. 4 to 15 players.
//  - The bidder picks any number of partners (the rest are the opposition). Optional bidder bonus: the bidder scores the bid x bonus when the team makes it.
import { clone, rid } from '../../core/util.js';
import { clean } from '../../core/names.js';
import { voidLast, revise } from '../../core/history.js';

export const DEFAULTS = { decks: 1, minBid: 150, maxBid: 250, step: 5, defenderMult: 2, penalty: false, bidderBonus: false, bidderMult: 2 };
/** Bids scale with the number of decks: 3 decks = 3x the one-deck range. */
export const DECK_RANGE = { 1: { minBid: 150, maxBid: 250, step: 5 }, 2: { minBid: 300, maxBid: 500, step: 10 }, 3: { minBid: 450, maxBid: 750, step: 15 } };
export const SUITS = ['S', 'D', 'C', 'H', 'N'];   // N = no trump
export const MIN_PLAYERS = 4, MAX_PLAYERS = 15;

const pid = () => 'p' + rid(6);
export function newGame({ names, config = {} }) {
  const players = names.map((n, i) => ({ id: pid(), name: clean(n.name || n) || 'Player ' + (i + 1), color: i % 8, out: false }));
  return { v: 2, game: 'kalitiri', config: { ...DEFAULTS, ...config }, players, rounds: [], paused: false, ended: false, log: [], startedAt: Date.now() };
}

/** Partners of a round. Older rounds stored one `partner`; newer ones store a list. */
export const partnersOf = (r) => (Array.isArray(r.partners) ? r.partners : r.partner ? [r.partner] : []);
/** The Trump team = the bidder plus every partner (each person once, even if they held two called cards). */
export const teamOf = (r) => [...new Set([r.bidder, ...partnersOf(r)].filter(Boolean))];
export const isOpen = (r) => r.made === null || r.made === undefined;

/** Points each player gets for one round. Returns { id: points }. An undecided (open) round scores nothing yet. */
export function scoreRound(s, r) {
  const c = s.config, mult = Math.max(1, c.defenderMult || 2), bonus = c.bidderBonus ? Math.max(1, c.bidderMult || 2) : 1;
  const team = new Set(teamOf(r)), bid = r.bid, pts = {};
  s.players.filter((p) => !p.out).forEach((p) => {
    if (isOpen(r)) { pts[p.id] = 0; return; }
    const mine = team.has(p.id);
    if (r.made) pts[p.id] = mine ? (p.id === r.bidder ? bid * bonus : bid) : 0;
    else pts[p.id] = mine ? (c.penalty ? -bid : 0) : bid * mult;   // the opposition won: they score double
  });
  return pts;
}

export function roundProblem(s, r) {
  const ids = s.players.filter((p) => !p.out).map((p) => p.id);
  if (!r.bidder || !ids.includes(r.bidder)) return 'Pick who bid';
  const ps = partnersOf(r);
  if (ps.some((x) => !ids.includes(x) || x === r.bidder) || new Set(ps).size !== ps.length) return 'A partner must be someone else';
  if (ids.length - teamOf(r).length < 1) return 'Someone must be in the opposition';
  const { minBid, maxBid } = s.config;
  if (!(r.bid >= minBid && r.bid <= maxBid)) return `Bid must be between ${minBid} and ${maxBid}`;
  if (!isOpen(r) && typeof r.made !== 'boolean') return 'Did the Trump team make its bid?';
  return null;
}

const shape = (r) => ({ bidder: r.bidder, partners: [...new Set(partnersOf(r))].filter((x) => x !== r.bidder), bid: Math.round(r.bid), trump: r.trump || null, made: isOpen(r) ? null : !!r.made });

export function addRound(s, r) {
  if (roundProblem(s, r)) return s;
  const n = clone(s);
  const x = shape(r);
  n.rounds.push({ n: n.rounds.length + 1, ...x, pts: scoreRound(n, x), at: Date.now() });
  return n;
}

/** Fix a saved round. Needs a reason; the old version stays in the history. An undecided round can be finished without a reason. */
export function editRound(s, num, r, reason, by) {
  if (roundProblem(s, r)) return s;
  const cur = s.rounds.find((x) => x.n === num);
  if (cur && isOpen(cur)) {   // still open: nothing was scored yet, so this is not a correction
    const n = clone(s); const t = n.rounds.find((x) => x.n === num); const x = shape(r);
    Object.assign(t, x); delete t.partner; t.pts = scoreRound(n, x); return n;
  }
  return revise(s, num, (x) => {
    const sh = shape(r);
    Object.assign(x, sh); delete x.partner;
    x.pts = scoreRound(s, sh);
  }, reason, by);
}
export const undo = (s, reason, by) => voidLast(s, reason, by);

export const totals = (s) => { const t = {}; s.players.forEach((p) => { t[p.id] = 0; }); s.rounds.forEach((r) => Object.entries(r.pts).forEach(([id, v]) => { if (id in t) t[id] += v; })); return t; };
function rank(s, t) {
  const rows = s.players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, out: p.out, total: t[p.id], seat: i }));
  rows.sort((a, b) => b.total - a.total || a.seat - b.seat);
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
/** Per-player record: times bid, times made, times partner, doubles won. */
export function stats(s) {
  const o = {}; s.players.forEach((p) => { o[p.id] = { name: p.name, bids: 0, made: 0, partner: 0, defWins: 0 }; });
  s.rounds.forEach((r) => {
    if (o[r.bidder]) { o[r.bidder].bids++; if (r.made === true) o[r.bidder].made++; }
    partnersOf(r).forEach((id) => { if (o[id]) o[id].partner++; });
    if (r.made === false) { const team = teamOf(r); Object.keys(r.pts).forEach((id) => { if (!team.includes(id) && o[id]) o[id].defWins++; }); }
  });
  return Object.values(o);
}
export const reorder = (s, a, b) => { const n = clone(s); const [p] = n.players.splice(a, 1); n.players.splice(b, 0, p); return n; };
export const setOut = (s, id, out) => { const n = clone(s); const p = n.players.find((x) => x.id === id); if (p) p.out = out; return n; };
export const addPlayer = (s, name) => { const n = clone(s); n.players.push({ id: pid(), name: clean(name) || 'Player', color: n.players.length % 8, out: false }); return n; };
export const setPaused = (s, v) => { const n = clone(s); n.paused = !!v; return n; };
export const endGame = (s) => { const n = clone(s); n.ended = true; return n; };
