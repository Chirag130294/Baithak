import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../js/games/kachuful/engine.js';

const names = ['A', 'B', 'C', 'D', 'E'];
const mk = () => K.newGame({ names });

function play(s, bidFn = (cur, id, i) => (i === 0 ? 0 : 0), rounds = 1) {
  let lapDone = null;
  for (let r = 0; r < rounds; r++) {
    const cur = s.cur;
    // everyone bids 0 except make dealer legal
    cur.order.forEach((id) => { s = K.setBid(s, id, 0); });
    if (K.lockProblem(s.cur)) { const last = s.cur.order[s.cur.order.length - 1]; s = K.setBid(s, last, 1); }
    s = K.lockBids(s);
    const first = s.cur.order[0];
    s = K.setWon(s, first, s.cur.cards);
    const res = K.saveRound(s); s = res.state; if (res.lapDone) lapDone = res.lapDone;
  }
  return { s, lapDone };
}

test('max cards for 5 players is 10', () => assert.equal(K.maxCardsFor(5), 10));

test('lap 1 for 5 players is 1..10..1 (19 rounds), later laps 2..10..1 (18 rounds)', () => {
  let s = mk(); const seq = [];
  for (let i = 0; i < 19 + 18 + 3; i++) { seq.push(s.cur.cards); s = play(s).s; }
  assert.deepEqual(seq.slice(0, 19), [1,2,3,4,5,6,7,8,9,10,9,8,7,6,5,4,3,2,1]);
  assert.deepEqual(seq.slice(19, 37), [2,3,4,5,6,7,8,9,10,9,8,7,6,5,4,3,2,1]);
  assert.deepEqual(seq.slice(37), [2,3,4]);
});

test('lapDone fires on the round that ends a lap', () => {
  let s = mk(); let fired = [];
  for (let i = 0; i < 20; i++) { const r = play(s); s = r.s; if (r.lapDone) fired.push([i + 1, r.lapDone]); }
  assert.deepEqual(fired, [[19, 1]]);
});

test('trump rotates Kali, Chatai, Fuli, Lal and keeps going', () => {
  let s = mk(); const t = [];
  for (let i = 0; i < 9; i++) { t.push(s.cur.trump); s = play(s).s; }
  assert.deepEqual(t, ['S','D','C','H','S','D','C','H','S']);
});

test('dealer moves one seat each round and bids last', () => {
  let s = mk(); const ids = s.players.map((p) => p.id);
  for (let i = 0; i < 7; i++) {
    assert.equal(s.cur.dealerId, ids[i % 5]);
    assert.equal(s.cur.order[4], ids[i % 5]);
    s = play(s).s;
  }
});

test('dealer cannot make bids equal the cards', () => {
  let s = mk(); s = play(s).s; s = play(s).s; // round 3: 3 cards
  const cur = s.cur; assert.equal(cur.cards, 3);
  s = K.setBid(s, cur.order[0], 1); s = K.setBid(s, cur.order[1], 1); s = K.setBid(s, cur.order[2], 0); s = K.setBid(s, cur.order[3], 0);
  const d = cur.order[4];
  assert.equal(K.forbiddenBid(s.cur, d), 1);
  const s2 = K.setBid(s, d, 1);
  assert.equal(s2.cur.bids[d], undefined);
  const s3 = K.setBid(s, d, 2);
  assert.equal(s3.cur.bids[d], 2);
});

test('scoring: zero hit = 10, exact n = 11n, miss = 0', () => {
  const sc = K.DEFAULT_CONFIG.scoring;
  assert.equal(K.points(0, 0, sc), 10);
  assert.equal(K.points(3, 3, sc), 33);
  assert.equal(K.points(2, 1, sc), 0);
  assert.equal(K.points(0, 1, sc), 0);
});

test('cannot save a round unless tricks add up to cards', () => {
  let s = mk();
  s.cur.order.forEach((id) => { s = K.setBid(s, id, 0); });
  s = K.setBid(s, s.cur.order[0], 1); // others add up to 1 card, so the dealer cannot bid 0
  s = K.setBid(s, s.cur.order[4], 0);
  assert.equal(s.cur.bids[s.cur.order[4]], 0); // earlier 0 bid stays because it was set before
  s.cur.bids[s.cur.order[4]] = undefined; delete s.cur.bids[s.cur.order[4]];
  assert.ok(K.lockProblem(s.cur));
  s = K.setBid(s, s.cur.order[4], 1);
  assert.equal(K.lockProblem(s.cur), null);
  s = K.lockBids(s);
  assert.equal(K.canSaveRound(s.cur), false); // tricks (0) do not add up to cards (1)
});

test('undo unlocks, then clears, then re-opens last round', () => {
  let s = mk(); s = play(s).s;
  const n1 = s.rounds.length; assert.equal(n1, 1);
  s.cur.order.forEach((id) => { s = K.setBid(s, id, 0); });
  s = K.setBid(s, s.cur.order[4], 1);
  s = K.lockBids(s); assert.ok(s.cur.locked);
  s = K.undo(s); assert.ok(!s.cur.locked);
  s = K.undo(s); assert.deepEqual(s.cur.bids, {});
  s = K.undo(s); assert.equal(s.rounds.length, 0); assert.equal(s.cur.n, 1); assert.ok(s.cur.locked);
});

test('adding a player updates totals base and max cards warning', () => {
  let s = mk(); s = play(s).s; s = play(s).s;
  const w = K.maxChangeIfPlayers(s, 1);
  assert.deepEqual(w, { from: 10, to: 8 });
  s = K.addPlayer(s, 'F', 'lowest');
  assert.equal(s.players.length, 6);
  assert.equal(K.maxCards(s), 8);
  assert.equal(s.cur.order.length, 6);
  assert.equal(s.cur.order[5], s.cur.dealerId);
});

test('sit out removes from bidding order and rejoin restores', () => {
  let s = mk(); const id = s.players[2].id;
  s = K.setOut(s, id, true); assert.ok(!s.cur.order.includes(id)); assert.equal(s.cur.order.length, 4);
  s = K.setOut(s, id, false); assert.ok(s.cur.order.includes(id));
});

test('standings rank with ties and movement', () => {
  let s = mk(); s = play(s).s;
  const st = K.standings(s);
  assert.equal(st[0].rank, 1);
  assert.ok(st.every((r) => typeof r.move === 'number'));
});

test('edit old round recomputes points', () => {
  let s = mk(); s = play(s).s;
  const r = s.rounds[0]; const id = r.order[1];
  const won = Object.fromEntries(r.order.map((x) => [x, 0])); won[id] = 1;
  const before = K.totals(s);
  s = K.editRound(s, 1, { [id]: 1 }, won);
  const after = K.totals(s);
  assert.equal(after[id] - before[id], 1); // was 0/0 = 10, now 1/1 = 11
});

test('pause flag and end game', () => {
  let s = mk(); s = K.setPaused(s, true); assert.ok(s.paused);
  s = K.endGame(s); assert.ok(s.ended);
});
