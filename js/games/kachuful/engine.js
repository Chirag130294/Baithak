// Kachuful rules engine. Pure functions only: no screen, no storage. Every function returns a NEW state.
// Rounds go 1..max..1 in lap 1, then 2..max..1 in every later lap (the bottom 1 is not repeated).
// Trump rotates Kali > Chatai > Fuli > Lal and keeps going. The dealer rotates one seat each round and bids last.

import { clone, sum, shuffle, rid } from '../../core/util.js';
import { clean, same, suggest } from '../../core/names.js';

export const TRUMPS = ['S', 'D', 'C', 'H'];
export const DEFAULT_CONFIG = {
  scoring: { zero: 10, mult: 11, miss: 0 }, // bid 0 and win 0 = zero; exact bid n = mult x n; any miss = miss
  revealBids: 'live',                        // 'live' = viewers see bids as they are entered, 'after' = only once bids are locked
  deckSize: 52,
  entry: 'miss',                             // 'miss' = after locking everyone counts as a hit and the host taps who missed; 'tricks' = enter tricks won
  maxCards: null                             // null = automatic (52 divided by players). A number caps cards per hand lower than that.
};

export const maxCardsFor = (count, deck = 52) => Math.max(2, Math.floor(deck / Math.max(2, count)));

export function points(bid, won, sc) {
  if (bid == null) return 0;
  if (won == null) return sc.miss; // a tapped miss
  if (bid !== won) return sc.miss;
  return bid === 0 ? sc.zero : sc.mult * bid;
}

const active = (s) => s.players.filter((p) => !p.out);

/** Next card count / lap / direction after a round with the given cards, direction and lap. */
export function stepCards({ cards, dir, lap }, max) {
  if (dir === 'up') {
    if (cards >= max) return { cards: Math.min(cards - 1, max), dir: 'down', lap };
    return { cards: cards + 1, dir: 'up', lap };
  }
  if (cards > 1) return { cards: Math.min(cards - 1, max), dir: 'down', lap };
  return { cards: 2, dir: 'up', lap: lap + 1 };
}

/** Everyone who bids, in bidding order. The dealer is always last. */
export function biddingOrder(players, dealerId) {
  const act = players.filter((p) => !p.out);
  const di = act.findIndex((p) => p.id === dealerId);
  if (di < 0) return act.map((p) => p.id);
  return act.slice(di + 1).concat(act.slice(0, di + 1)).map((p) => p.id);
}

function nextDealerId(players, prevDealerId) {
  const n = players.length;
  const start = players.findIndex((p) => p.id === prevDealerId);
  for (let i = 1; i <= n; i++) {
    const p = players[(start + i + n) % n];
    if (p && !p.out) return p.id;
  }
  return null;
}

function makeRound(s, info, dealerId, n) {
  return { n, lap: info.lap, dir: info.dir, cards: info.cards, trump: TRUMPS[(n - 1) % 4], dealerId, order: biddingOrder(s.players, dealerId), bids: {}, locked: false };
}

let uid = 0;
const pid = () => 'p' + Date.now().toString(36) + (uid++).toString(36) + rid(3);

export function newGame({ names, config = {}, firstDealer = 0, ts = Date.now() }) {
  const players = names.map((n, i) => ({ id: pid(), name: clean(n.name || n) || 'Player ' + (i + 1), color: i % 8, out: false }));
  const s = {
    v: 1, game: 'kachuful',
    config: { ...DEFAULT_CONFIG, ...config, scoring: { ...DEFAULT_CONFIG.scoring, ...(config.scoring || {}) } },
    players, base: {}, rounds: [], cur: null, paused: false, ended: false, log: [], startedAt: ts
  };
  players.forEach((p) => { s.base[p.id] = 0; });
  const dealer = players[Math.min(Math.max(0, firstDealer), players.length - 1)].id;
  s.cur = makeRound(s, { cards: 1, dir: 'up', lap: 1 }, dealer, 1);
  addLog(s, 'Game started', ts);
  return s;
}

export function addLog(s, txt, ts = Date.now()) {
  s.log.unshift({ ts, txt });
  if (s.log.length > 80) s.log.length = 80;
}

/** Most cards dealt in a round. Automatic = deck / players; the host can cap it lower. */
export const maxCardsAuto = (s, delta = 0) => maxCardsFor(active(s).length + delta, s.config.deckSize);
export const maxCards = (s, delta = 0) => { const auto = maxCardsAuto(s, delta); const cap = s.config.maxCards; return cap ? Math.max(2, Math.min(auto, cap)) : auto; };

// ---------- totals and standings ----------
export function totals(s, upTo = s.rounds.length) {
  const t = {};
  s.players.forEach((p) => { t[p.id] = s.base[p.id] || 0; });
  s.rounds.slice(0, upTo).forEach((r) => { Object.entries(r.pts || {}).forEach(([id, v]) => { if (id in t) t[id] += v; }); });
  return t;
}

function rankList(s, t) {
  const rows = s.players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, out: p.out, total: t[p.id], seat: i }));
  rows.sort((a, b) => b.total - a.total || a.seat - b.seat);
  let rank = 0, last = null;
  rows.forEach((r, i) => { if (r.total !== last) { rank = i + 1; last = r.total; } r.rank = rank; });
  return rows;
}

/** Leaderboard with how far each person moved in the last round (move > 0 means they climbed). */
export function standings(s) {
  const now = rankList(s, totals(s));
  if (!s.rounds.length) return now.map((r) => ({ ...r, move: 0, gain: 0 }));
  const prev = rankList(s, totals(s, s.rounds.length - 1));
  const pr = Object.fromEntries(prev.map((r) => [r.id, r.rank]));
  const last = s.rounds[s.rounds.length - 1];
  return now.map((r) => ({ ...r, move: (pr[r.id] ?? r.rank) - r.rank, gain: (last.pts && last.pts[r.id]) || 0 }));
}

// ---------- bidding ----------
export const bidsTotal = (cur) => sum(Object.values(cur.bids));
export const allBid = (cur) => cur.order.every((id) => cur.bids[id] != null);

/** The number the dealer is NOT allowed to bid (it would make total bids equal the cards dealt), or null. */
export function forbiddenBid(cur, id) {
  if (cur.order[cur.order.length - 1] !== id) return null;
  const others = sum(cur.order.filter((x) => x !== id).map((x) => cur.bids[x] ?? 0));
  const f = cur.cards - others;
  return f >= 0 && f <= cur.cards ? f : null;
}

export function setBid(s, id, bid) {
  const n = clone(s);
  if (!n.cur || n.cur.locked) return s;
  if (!n.cur.order.includes(id)) return s;
  const v = Math.max(0, Math.min(n.cur.cards, Math.round(bid)));
  if (forbiddenBid(n.cur, id) === v) return s; // the dealer cannot make bids add up to the cards
  n.cur.bids[id] = v;
  return n;
}

export function lockProblem(cur) {
  // Players who have not bid count as 0 when locking, so only the total matters.
  if (bidsTotal(cur) === cur.cards) return 'Total bids cannot equal the cards dealt';
  return null;
}

export function lockBids(s) {
  if (!s.cur || s.cur.locked || lockProblem(s.cur)) return s;
  const n = clone(s);
  const c = n.cur;
  c.auto = c.order.filter((id) => c.bids[id] == null);
  c.auto.forEach((id) => { c.bids[id] = 0; });
  c.locked = true;
  c.mode = n.config.entry === 'tricks' ? 'tricks' : 'miss';
  if (c.mode === 'miss') { c.won = { ...c.bids }; c.miss = {}; } // everyone starts as a hit
  else c.won = Object.fromEntries(c.order.map((id) => [id, 0]));
  addLog(n, `Round ${c.n} bids locked (${bidsTotal(c)} of ${c.cards})${c.auto.length ? `, ${c.auto.length} counted as 0` : ''}`);
  return n;
}

/** Miss mode: tap a player to flip between hit and miss. */
export function toggleMiss(s, id) {
  if (!s.cur || !s.cur.locked || s.cur.mode !== 'miss' || !s.cur.order.includes(id)) return s;
  const n = clone(s); const c = n.cur;
  c.miss = { ...(c.miss || {}) };
  if (c.miss[id]) { delete c.miss[id]; c.won[id] = c.bids[id]; } else { c.miss[id] = true; c.won[id] = null; }
  return n;
}
export const missCount = (cur) => Object.values(cur.miss || {}).filter(Boolean).length;

export const setWon = (s, id, won) => {
  if (!s.cur || !s.cur.locked || s.cur.mode === 'miss') return s;
  const n = clone(s);
  n.cur.won[id] = Math.max(0, Math.min(n.cur.cards, Math.round(won)));
  return n;
};
export const wonTotal = (cur) => sum(Object.values(cur.won || {}));
export const canSaveRound = (cur) => !!cur && cur.locked && (cur.mode === 'miss' ? missCount(cur) >= 1 : wonTotal(cur) === cur.cards);

/** Saves the round and opens the next one. Returns { state, lapDone } where lapDone is the finished lap number or null. */
export function saveRound(s) {
  if (!canSaveRound(s.cur)) return { state: s, lapDone: null };
  const n = clone(s);
  const c = n.cur;
  const pts = {};
  c.order.forEach((id) => { pts[id] = points(c.bids[id], c.won[id], n.config.scoring); });
  n.rounds.push({ ...c, pts, at: Date.now() });
  addLog(n, `Round ${c.n} saved`);
  const info = stepCards(c, maxCards(n));
  const lapDone = info.lap > c.lap ? c.lap : null;
  n.cur = makeRound(n, info, nextDealerId(n.players, c.dealerId), c.n + 1);
  return { state: n, lapDone };
}

const okReason = (r) => typeof r === 'string' && r.trim().length >= 3;
const cleanR = (r) => String(r).trim().replace(/\s+/g, ' ').slice(0, 120);
/** A frozen copy of a round's score as it was, kept in the history after a change. */
const snapshot = (r, kind, reason, by) => ({ kind, reason: cleanR(reason), by: by || '', at: Date.now(), bids: { ...r.bids }, won: { ...r.won }, miss: { ...(r.miss || {}) }, mode: r.mode || 'tricks', pts: { ...(r.pts || {}) } });

/** True when Undo would re-open an already saved round. That needs a written reason. */
export const undoNeedsReason = (s) => !(s.cur && (s.cur.locked || Object.keys(s.cur.bids).length)) && s.rounds.length > 0;

/** Undo: unlock bids if they are locked, otherwise re-open the last saved round (reason required for that). The old score stays in the history. */
export function undo(s, reason, by) {
  const n = clone(s);
  if (n.cur && n.cur.locked) { (n.cur.auto || []).forEach((id) => { delete n.cur.bids[id]; }); n.cur.locked = false; ['won', 'miss', 'auto', 'mode'].forEach((k) => delete n.cur[k]); addLog(n, `Round ${n.cur.n} unlocked`); return n; }
  if (n.cur && Object.keys(n.cur.bids).length) { n.cur.bids = {}; addLog(n, 'Bids cleared'); return n; }
  if (!n.rounds.length) return s;
  if (!okReason(reason)) return s;
  const last = n.rounds.pop();
  const { pts, at, ...rest } = last;
  n.cur = { ...rest, revs: [...(last.revs || []), snapshot(last, 'UNDO', reason, by)] }; // locked, bids and tricks kept so it can be fixed and saved again
  addLog(n, `Round ${last.n} re-opened: ${cleanR(reason)}`);
  return n;
}

/** Fix an old round. Needs a reason. The previous score stays in the history (struck through) and only the new one counts. */
export function editRound(s, roundN, bids, won, reason, by) {
  if (!okReason(reason)) return s;
  const n = clone(s);
  const r = n.rounds.find((x) => x.n === roundN);
  if (!r) return s;
  if (r.mode === 'miss' ? !Object.values(won).some((v) => v == null) : sum(Object.values(won)) !== r.cards) return s;
  const old = snapshot(r, 'EDIT', reason, by);
  r.bids = { ...r.bids, ...bids }; r.won = { ...r.won, ...won };
  if (r.mode === 'miss') { r.miss = {}; r.order.forEach((id) => { if (r.won[id] == null) r.miss[id] = true; else r.won[id] = r.bids[id]; }); }
  r.pts = {};
  r.order.forEach((id) => { r.pts[id] = points(r.bids[id], r.won[id], n.config.scoring); });
  r.revs = [...(r.revs || []), old];
  addLog(n, `Round ${roundN} corrected: ${cleanR(reason)}`);
  return n;
}

// ---------- players ----------
export const canChangePlayers = (s) => !!s.cur && !s.cur.locked && Object.keys(s.cur.bids).length === 0;

/** Rebuilds the open round after seats changed (only allowed before any bid is entered). */
function refreshCur(n) {
  if (!n.cur) return n;
  let dealer = n.cur.dealerId;
  const d = n.players.find((p) => p.id === dealer);
  if (!d || d.out) dealer = nextDealerId(n.players, dealer) || (active(n)[0] && active(n)[0].id);
  const info = { cards: n.cur.cards, dir: n.cur.dir, lap: n.cur.lap };
  const max = maxCards(n);
  if (info.cards > max) info.cards = max;
  n.cur = { ...makeRound(n, info, dealer, n.cur.n), trump: n.cur.trump };
  return n;
}

export function reorder(s, from, to) {
  if (!canChangePlayers(s)) return s;
  const n = clone(s);
  const [p] = n.players.splice(from, 1);
  n.players.splice(to, 0, p);
  addLog(n, 'Seats changed');
  return refreshCur(n);
}
export function shuffleSeats(s, rnd = Math.random) {
  if (!canChangePlayers(s)) return s;
  const n = clone(s);
  n.players = shuffle(n.players, rnd);
  addLog(n, 'Seats shuffled');
  return refreshCur(n);
}
export function setOut(s, id, out) {
  if (!canChangePlayers(s)) return s;
  const n = clone(s);
  const p = n.players.find((x) => x.id === id);
  if (!p || p.out === out) return s;
  if (out && active(n).length <= 2) return s;
  p.out = out;
  addLog(n, `${p.name} ${out ? 'sat out' : 'sat back in'}`);
  return refreshCur(n);
}
export function renamePlayer(s, id, name) {
  const n = clone(s);
  const p = n.players.find((x) => x.id === id);
  const nm = clean(name);
  if (!p || !nm || n.players.some((x) => x.id !== id && same(x.name, nm))) return s; // no empty or duplicate names
  p.name = nm;
  return n;
}
/** start = 'zero' | 'lowest' | 'average' | a number. `at` = seat index to sit at (default: end). */
export function addPlayer(s, name, start = 'zero', at = null) {
  if (!canChangePlayers(s)) return s;
  const n = clone(s);
  name = clean(name); if (n.players.some((x) => same(x.name, name))) name = suggest(name, n.players.map((x) => x.name));
  const t = totals(n);
  const vals = active(n).map((p) => t[p.id]);
  let base = 0;
  if (start === 'lowest') base = vals.length ? Math.min(...vals) : 0;
  else if (start === 'average') base = vals.length ? Math.round(sum(vals) / vals.length) : 0;
  else if (typeof start === 'number') base = start;
  const p = { id: pid(), name: name.trim() || 'Player', color: n.players.length % 8, out: false };
  if (at == null || at >= n.players.length) n.players.push(p); else n.players.splice(at, 0, p);
  n.base[p.id] = base;
  addLog(n, `${p.name} joined with ${base} points`);
  return refreshCur(n);
}
export function removePlayer(s, id) { // only for players with no rounds played
  if (!canChangePlayers(s)) return s;
  if (s.rounds.some((r) => id in (r.pts || {}))) return s;
  const n = clone(s);
  n.players = n.players.filter((p) => p.id !== id);
  delete n.base[id];
  if (active(n).length < 2) return s;
  return refreshCur(n);
}

export const setPaused = (s, paused) => { const n = clone(s); n.paused = !!paused; addLog(n, paused ? 'Game paused' : 'Game resumed'); return n; };
export const endGame = (s) => { const n = clone(s); n.ended = true; addLog(n, 'Game ended'); return n; };
export const setConfig = (s, patch) => { const n = clone(s); n.config = { ...n.config, ...patch, scoring: { ...n.config.scoring, ...(patch.scoring || {}) } }; return n; };

/** What changes in the number of cards if the active player count changes by delta. */
export function maxChangeIfPlayers(s, delta) {
  return { from: maxCards(s), to: maxCards(s, delta) };
}

// ---------- laps, stats ----------
export function lapSummary(s, lap) {
  const rs = s.rounds.filter((r) => r.lap === lap);
  const gain = {};
  s.players.forEach((p) => { gain[p.id] = 0; });
  rs.forEach((r) => Object.entries(r.pts).forEach(([id, v]) => { if (id in gain) gain[id] += v; }));
  const upto = s.rounds.findIndex((r) => r.lap > lap);
  const t = totals(s, upto < 0 ? s.rounds.length : upto);
  const rows = rankList(s, t).map((r) => ({ ...r, gain: gain[r.id] }));
  const best = [...rows].sort((a, b) => b.gain - a.gain)[0];
  return { lap, rounds: rs.length, rows, best };
}
export const currentLap = (s) => (s.cur ? s.cur.lap : (s.rounds.length ? s.rounds[s.rounds.length - 1].lap : 1));

export function stats(s) {
  const per = {};
  s.players.forEach((p) => { per[p.id] = { id: p.id, name: p.name, exact: 0, played: 0, bidSum: 0, zeroHits: 0, streak: 0, bestStreak: 0 }; });
  s.rounds.forEach((r) => r.order.forEach((id) => {
    const x = per[id]; if (!x) return;
    x.played++; x.bidSum += r.bids[id];
    if (r.bids[id] === r.won[id]) { x.exact++; x.streak++; x.bestStreak = Math.max(x.bestStreak, x.streak); if (r.bids[id] === 0) x.zeroHits++; } else x.streak = 0;
  }));
  const list = Object.values(per).filter((x) => x.played);
  const top = (key, min = 1) => { const v = [...list].sort((a, b) => b[key] - a[key])[0]; return v && v[key] >= min ? v : null; };
  const perfectRounds = s.rounds.filter((r) => r.order.every((id) => r.bids[id] === r.won[id])).length;
  return {
    list, perfectRounds,
    sharpest: top('exact', 2),
    streak: top('bestStreak', 2),
    zeroHero: top('zeroHits', 2),
    bold: [...list].sort((a, b) => b.bidSum / b.played - a.bidSum / a.played)[0] || null
  };
}

export function winners(s) { const st = standings(s); return st.filter((r) => r.rank === 1); }
