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
  s = S.undo(s);
  assert.equal(s.rounds.length, 0);
});
