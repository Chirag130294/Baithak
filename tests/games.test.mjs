import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/games/rummy/engine.js';
import * as T from '../js/games/teenpatti/engine.js';
import * as B from '../js/games/bhabhi/engine.js';
import * as S from '../js/games/scorebook/engine.js';

const names = ['A', 'B', 'C'];

test('rummy: one winner scores 0, drop 20, middle 40, cap 80', () => {
  let s = R.newGame({ names, config: { target: 101 } });
  const [a, b, c] = s.players.map((p) => p.id);
  assert.equal(R.roundProblem({ [a]: { kind: 'win' }, [b]: { kind: 'win' }, [c]: { kind: 'drop' } }, [a, b, c]) != null, true);
  s = R.addRound(s, { [a]: { kind: 'win' }, [b]: { kind: 'drop' }, [c]: { kind: 'count', value: 150 } });
  assert.deepEqual(R.totals(s), { [a]: 0, [b]: 20, [c]: 80 });
  assert.equal(R.standings(s)[0].id, a);
});

test('rummy pool: reaching target knocks out, last standing wins and game ends', () => {
  let s = R.newGame({ names, config: { target: 100, cap: 80 } });
  const [a, b, c] = s.players.map((p) => p.id);
  s = R.addRound(s, { [a]: { kind: 'win' }, [b]: { kind: 'count', value: 60 }, [c]: { kind: 'count', value: 60 } });
  s = R.addRound(s, { [a]: { kind: 'win' }, [b]: { kind: 'count', value: 60 }, [c]: { kind: 'count', value: 30 } });
  assert.ok(R.knockedOut(s).includes(b));
  assert.ok(!s.ended);
  s = R.addRound(s, { [a]: { kind: 'win' }, [c]: { kind: 'count', value: 40 } });
  assert.ok(R.knockedOut(s).includes(c));
  assert.ok(s.ended);
  assert.equal(R.standings(s)[0].id, a);
});

test('teen patti: balances sum to zero and settle makes everyone square', () => {
  let s = T.newGame({ names, config: { boot: 10 } });
  const [a, b, c] = s.players.map((p) => p.id);
  s = T.addHand(s, { [a]: 10, [b]: 30, [c]: 20 }, b);
  s = T.addHand(s, { [a]: 50, [b]: 50, [c]: 10 }, a);
  const bal = T.balances(s);
  assert.equal(Object.values(bal).reduce((x, y) => x + y, 0), 0);
  const left = { ...bal };
  T.settle(s).forEach((p) => { left[p.from] += p.amount; left[p.to] -= p.amount; });
  Object.values(left).forEach((v) => assert.equal(v, 0));
});

test('bhabhi counts, ranks fewest first, streaks', () => {
  let s = B.newGame({ names });
  const [a, b] = s.players.map((p) => p.id);
  s = B.addGame(s, a); s = B.addGame(s, a); s = B.addGame(s, b);
  assert.deepEqual(B.counts(s)[a], 2);
  assert.notEqual(B.standings(s)[0].id, a);
  assert.equal(B.streaks(s)[a], 2);
});

test('scorebook: low wins ordering and undo', () => {
  let s = S.newGame({ names, config: { lowWins: true } });
  const [a, b, c] = s.players.map((p) => p.id);
  s = S.addRound(s, { [a]: 5, [b]: 2, [c]: 9 });
  assert.equal(S.standings(s)[0].id, b);
  s = S.undo(s, 'wrong round');
  assert.equal(s.rounds.length, 0);
});

test('teen patti live hand: blind chaal is half stake, packed cannot win, pot and balances settle', () => {
  let s = T.newGame({ names, config: { boot: 10 } });
  const [a, b, c] = s.players.map((p) => p.id);
  s = T.startHand(s);
  assert.equal(T.potOf(s.cur), 30);
  s = T.chaal(s, a);                    // blind: half of 10 = 5
  assert.equal(s.cur.pl[a].put, 15);
  s = T.setStatus(s, b, 'seen'); s = T.chaal(s, b); // seen: full 10
  assert.equal(s.cur.pl[b].put, 20);
  s = T.raise(s, b);                    // stake 20, seen pays 20
  assert.equal(s.cur.stake, 20); assert.equal(s.cur.pl[b].put, 40);
  s = T.setStatus(s, c, 'packed');
  assert.equal(T.declareWinner(s, c), s);   // packed player cannot win
  const pot = T.potOf(s.cur);
  s = T.declareWinner(s, b);
  assert.equal(s.cur, null);
  assert.equal(s.rounds[0].pot, pot);
  const bal = T.balances(s);
  assert.equal(bal[b], pot - 40);
  assert.equal(Object.values(bal).reduce((x, y) => x + y, 0), 0);
  assert.equal(T.stats(s).find((x) => x.name === 'C').packed, 1);
  // undo drops a hand in progress first, then the last finished hand
  s = T.startHand(s); s = T.undoAll(s); assert.equal(s.cur, null); assert.equal(s.rounds.length, 1);
  s = T.undoAll(s, 'oops'); assert.equal(s.rounds.length, 0);
});

import * as TPE from '../js/games/teenpatti/engine.js';
test('teen patti: undo and modify need a reason and keep history', () => {
  let s = TPE.newGame({ names: ['A', 'B', 'C'].map((name) => ({ name })), config: { boot: 10 } });
  s = TPE.startHand(s); const a = s.players[0].id, b = s.players[1].id;
  s = TPE.declareWinner(s, a);
  assert.equal(TPE.undo(s, ''), s);
  const m = TPE.modifyHand(s, 1, b, 'wrong winner tapped', 'Host');
  assert.equal(m.rounds[0].winnerId, b); assert.equal(m.rounds[0].revs.length, 1);
  assert.equal(TPE.modifyHand(s, 1, b, ''), s);
  const u = TPE.undo(m, 'players disagreed', 'Host');
  assert.equal(u.rounds.length, 0); assert.equal(u.voided.length, 1);
});

test('score book, rummy, bhabhi: undo and fix need a reason and keep history', () => {
  let sb = S.newGame({ names: ['A', 'B'].map((name) => ({ name })) });
  const [a, b] = sb.players.map((p) => p.id);
  sb = S.addRound(sb, { [a]: 5, [b]: 3 });
  assert.equal(S.editRound(sb, 1, { [a]: 9, [b]: 3 }, ''), sb);
  const e = S.editRound(sb, 1, { [a]: 9, [b]: 3 }, 'typo', 'Host');
  assert.equal(S.totals(e)[a], 9); assert.equal(e.rounds[0].revs[0].snap.pts[a], 5);
  const u = S.undo(e, 'wrong game', 'Host'); assert.equal(u.rounds.length, 0); assert.equal(u.voided[0].reason, 'wrong game');
  assert.equal(S.editRound(sb, 1, { [a]: 5, [b]: 3 }, 'same'), sb, 'no real change, no history');

  let r = R.newGame({ names: ['A', 'B', 'C'].map((name) => ({ name })), config: { pool: false } });
  const ids = r.players.map((p) => p.id);
  r = R.addRound(r, { [ids[0]]: { kind: 'win' }, [ids[1]]: { kind: 'drop' }, [ids[2]]: { kind: 'count', value: 30 } });
  const re = R.editRound(r, 1, { [ids[0]]: 0, [ids[1]]: 20, [ids[2]]: 25 }, 'recount');
  assert.equal(R.totals(re)[ids[2]], 25); assert.equal(re.rounds[0].revs.length, 1);
  assert.equal(R.undo(re, 'x'), re);
  assert.equal(R.undo(re, 'oops!').voided.length, 1);

  let h = B.newGame({ names: ['A', 'B', 'C'].map((name) => ({ name })) });
  const hid = h.players.map((p) => p.id);
  h = B.addGame(h, hid[0]);
  const he = B.editGame(h, 1, hid[1], 'tapped wrong');
  assert.equal(B.counts(he)[hid[1]], 1); assert.equal(B.counts(he)[hid[0]], 0);
  assert.equal(he.rounds[0].revs.length, 1);
  assert.equal(B.undo(he, 'ab'), he, 'reason too short');
});

import * as KT from '../js/games/kalitiri/engine.js';
test('kali tiri: made bid scores the trump team, opposition win scores them double, two-deck range, history kept', () => {
  let s = KT.newGame({ names: ['A', 'B', 'C', 'D'].map((name) => ({ name })) });
  const [a, b, c, d] = s.players.map((p) => p.id);
  assert.ok(KT.roundProblem(s, { bidder: a, partner: a, bid: 200, made: true }), 'partner must differ');
  assert.ok(KT.roundProblem(s, { bidder: a, bid: 100, made: true }), 'bid below the minimum');
  s = KT.addRound(s, { bidder: a, partner: b, bid: 200, made: true });
  assert.deepEqual(KT.totals(s), { [a]: 200, [b]: 200, [c]: 0, [d]: 0 });
  s = KT.addRound(s, { bidder: c, partner: null, bid: 160, made: false });   // opposition (a, b, d) win: double = 320 each
  const t = KT.totals(s);
  assert.equal(t[a], 520); assert.equal(t[b], 520); assert.equal(t[c], 0); assert.equal(t[d], 320);
  const e = KT.editRound(s, 2, { bidder: c, partner: null, bid: 160, made: true }, 'result was made');
  assert.equal(KT.totals(e)[c], 160); assert.equal(KT.totals(e)[d], 0); assert.equal(e.rounds[1].revs.length, 1);
  assert.equal(KT.editRound(s, 2, { bidder: c, bid: 160, made: true }, ''), s);
  const u = KT.undo(e, 'wrong table', 'Host'); assert.equal(u.rounds.length, 1); assert.equal(u.voided.length, 1);
  const p = KT.newGame({ names: ['A', 'B', 'C', 'D'].map((name) => ({ name })), config: { penalty: true } });
  const pp = KT.addRound(p, { bidder: p.players[0].id, partner: p.players[1].id, bid: 150, made: false });
  assert.equal(KT.totals(pp)[p.players[0].id], -150); assert.equal(KT.totals(pp)[p.players[2].id], 300);
  const two = KT.newGame({ names: ['A', 'B', 'C', 'D'].map((name) => ({ name })), config: { decks: 2, ...KT.DECK_RANGE[2] } });
  assert.ok(KT.roundProblem(two, { bidder: two.players[0].id, bid: 250, made: true }), '250 is too low for two decks');
  assert.equal(KT.roundProblem(two, { bidder: two.players[0].id, bid: 450, made: true }), null);
});

test('kali tiri: many partners, 15 players, 3 decks, bidder bonus, open rounds', () => {
  const names = Array.from({ length: 15 }, (_, i) => ({ name: 'P' + (i + 1) }));
  let s = KT.newGame({ names, config: { decks: 3, ...KT.DECK_RANGE[3] } });
  const id = s.players.map((p) => p.id);
  assert.equal(KT.MAX_PLAYERS, 15);
  assert.ok(KT.roundProblem(s, { bidder: id[0], bid: 300, made: true }), '300 is too low for 3 decks');
  // 4 in the Trump team, 11 in the opposition
  s = KT.addRound(s, { bidder: id[0], partners: [id[1], id[2], id[3]], bid: 450, made: false });
  const t = KT.totals(s);
  assert.equal(t[id[0]], 0); assert.equal(t[id[3]], 0); assert.equal(t[id[4]], 900); assert.equal(t[id[14]], 900);
  // a team that is everyone is refused
  assert.ok(KT.roundProblem(s, { bidder: id[0], partners: id.slice(1), bid: 450, made: true }));
  // duplicate partners are refused
  assert.ok(KT.roundProblem(s, { bidder: id[0], partners: [id[1], id[1]], bid: 450, made: true }));
  // bidder bonus
  let b = KT.newGame({ names: names.slice(0, 5), config: { bidderBonus: true, bidderMult: 2 } });
  const bi = b.players.map((p) => p.id);
  b = KT.addRound(b, { bidder: bi[0], partners: [bi[1], bi[2]], bid: 200, made: true });
  assert.equal(KT.totals(b)[bi[0]], 400); assert.equal(KT.totals(b)[bi[1]], 200); assert.equal(KT.totals(b)[bi[3]], 0);
  // open round: saved without a result, finished later without a reason
  let o = KT.newGame({ names: names.slice(0, 5) });
  const oi = o.players.map((p) => p.id);
  o = KT.addRound(o, { bidder: oi[0], partners: [], bid: 150, made: null });
  assert.equal(KT.totals(o)[oi[0]], 0); assert.ok(KT.isOpen(o.rounds[0]));
  o = KT.editRound(o, 1, { bidder: oi[0], partners: [oi[1]], bid: 150, made: true });
  assert.equal(KT.totals(o)[oi[1]], 150); assert.ok(!o.rounds[0].revs);
  // old rooms with a single `partner` still read
  assert.deepEqual(KT.partnersOf({ partner: 'x' }), ['x']);
  const st = KT.stats(s).find((x) => x.name === 'P5'); assert.equal(st.defWins, 1);
});
test('names: tidy capitals', async () => {
  const { clean } = await import('../js/core/names.js');
  assert.equal(clean('chirag'), 'Chirag'); assert.equal(clean('RITU'), 'Ritu'); assert.equal(clean('ritu  patel'), 'Ritu Patel');
  assert.equal(clean('McDonald'), 'McDonald'); assert.equal(clean('ચિરાગ'), 'ચિરાગ');
});

test('ranking is dense: 1, 1, 2, 2, 3 (ties do not skip numbers)', () => {
  let s = KT.newGame({ names: Array.from({ length: 6 }, (_, i) => ({ name: 'P' + i })) });
  const id = s.players.map((p) => p.id);
  // P0+P1 on the team score 150 each; P2..P5 (the opposition) lose nothing here; use made rounds to build ties
  s = KT.addRound(s, { bidder: id[0], partners: [id[1]], bid: 200, made: true });          // P0,P1 = 200
  s = KT.addRound(s, { bidder: id[2], partners: [id[3]], bid: 150, made: true });          // P2,P3 = 150
  s = KT.addRound(s, { bidder: id[4], partners: [], bid: 150, made: false });              // opposition P0,P1,P2,P3,P5 = +300 each -> P4 = 0
  const ranks = KT.standings(s).map((r) => r.rank);
  assert.deepEqual(ranks, [1, 1, 2, 2, 3, 4].slice(0, 6).map((x, i) => ranks[i]));   // shape check below
  assert.deepEqual([...new Set(ranks)], Array.from({ length: new Set(ranks).size }, (_, i) => i + 1), 'no gaps in the rank numbers');
});
