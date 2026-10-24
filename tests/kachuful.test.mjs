import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../js/games/kachuful/engine.js';

const names = ['A', 'B', 'C', 'D', 'E'];
const mk = () => K.newGame({ names, config: { entry: 'tricks' } });

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
  s = K.undo(s); assert.equal(s.rounds.length, 1, "no reason, no undo"); s = K.undo(s, "wrong tap"); assert.equal(s.rounds.length, 0); assert.equal(s.cur.n, 1); assert.ok(s.cur.locked);
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
  s = K.editRound(s, 1, { [id]: 1 }, won, "miscounted");
  const after = K.totals(s);
  assert.equal(after[id] - before[id], 1); // was 0/0 = 10, now 1/1 = 11
});

test('pause flag and end game', () => {
  let s = mk(); s = K.setPaused(s, true); assert.ok(s.paused);
  s = K.endGame(s); assert.ok(s.ended);
});

test('max cards: automatic = 52 / players, and a cap lowers it', () => {
  let s = mk();
  assert.equal(K.maxCards(s), 10);
  s = K.setConfig(s, { maxCards: 6 });
  assert.equal(K.maxCards(s), 6);
  const seq = [];
  for (let i = 0; i < 11 + 10; i++) { seq.push(s.cur.cards); s = play(s).s; }
  assert.deepEqual(seq.slice(0, 11), [1,2,3,4,5,6,5,4,3,2,1]);
  assert.deepEqual(seq.slice(11), [2,3,4,5,6,5,4,3,2,1]);
  s = K.setConfig(s, { maxCards: 20 }); // cannot exceed the automatic maximum
  assert.equal(K.maxCards(s), 10);
});

test('changes need a reason, keep the old score in history, and only the new score counts', () => {
  let s = K.newGame({ names: ['A', 'B', 'C'].map((name) => ({ name })), config: { entry: 'tricks' } });
  const ids = s.cur.order;
  ids.forEach((id, i) => { s = K.setBid(s, id, i === 2 ? 0 : 1); });
  s = K.lockBids(s);
  const won = { [ids[0]]: 1, [ids[1]]: 0, [ids[2]]: 0 };
  ids.forEach((id) => { s = K.setWon(s, id, won[id]); });
  s = K.saveRound(s).state;
  const before = K.totals(s);
  const same = K.editRound(s, 1, {}, { [ids[0]]: 0, [ids[1]]: 1, [ids[2]]: 0 }, '');
  assert.equal(same, s, 'blank reason is refused');
  const e = K.editRound(s, 1, {}, { [ids[0]]: 0, [ids[1]]: 1, [ids[2]]: 0 }, 'tapped wrong player', 'Host');
  const r = e.rounds[0];
  assert.equal(r.revs.length, 1);
  assert.equal(r.revs[0].reason, 'tapped wrong player');
  assert.deepEqual(r.revs[0].pts, s.rounds[0].pts);
  assert.notDeepEqual(K.totals(e), before);
  // totals count only the new score
  const t2 = K.totals(e);
  assert.equal(t2[ids[0]] + t2[ids[1]] + t2[ids[2]], Object.values(r.pts).reduce((a, b) => a + b, 0));
  // undo of a saved round keeps the old score too and carries it back when saved again
  const u = K.undo(e, 'players disagreed', 'Host');
  assert.equal(u.cur.revs.length, 2);
  const again = K.saveRound(u).state;
  assert.equal(again.rounds[0].revs.length, 2);
});

test('miss mode: unbid count as 0, everyone starts as a hit, tap flips to miss, save needs a miss', () => {
  let s = K.newGame({ names: ['A', 'B', 'C', 'D'].map((name) => ({ name })) });
  const ids = s.cur.order;
  s = K.setBid(s, ids[0], 1);                       // only the first bidder bids, the rest are unbid
  assert.equal(K.lockProblem(s.cur), 'Total bids cannot equal the cards dealt'); // 1 card, total 1 -> dealer must change
  assert.equal(K.lockBids(s), s);
  s = K.setBid(s, ids[1], 1);                       // total 2 of 1 card is fine
  s = K.lockBids(s);
  assert.equal(s.cur.mode, 'miss');
  assert.deepEqual(s.cur.auto.sort(), [ids[2], ids[3]].sort());
  assert.equal(s.cur.bids[ids[2]], 0);
  assert.equal(K.canSaveRound(s.cur), false, 'nobody missed yet');
  s = K.toggleMiss(s, ids[1]);
  assert.equal(s.cur.won[ids[1]], null);
  assert.ok(K.canSaveRound(s.cur));
  const r = K.saveRound(s).state.rounds[0];
  assert.equal(r.pts[ids[1]], 0);                   // missed
  assert.equal(r.pts[ids[0]], 11);                  // bid 1 hit
  assert.equal(r.pts[ids[2]], 10);                  // auto 0 hit
  s = K.toggleMiss(s, ids[1]);                      // tap again -> hit
  assert.equal(s.cur.won[ids[1]], 1);
  const back = K.undo(K.lockBids(K.setBid(K.newGame({ names: ['A', 'B', 'C'].map((name) => ({ name })) }), 'x', 1)));
  assert.ok(back);
});

import * as N from '../js/core/names.js';
test('names: clean, duplicates, suggestions, Gujarati and emoji letters', () => {
  assert.equal(N.clean('  Ritu​   K  '), 'Ritu K');
  assert.ok(N.same('Ritu', ' ritu '));
  assert.ok(N.same('Ri tu', 'RITU'));
  assert.deepEqual(N.findDuplicate(['Ritu', 'Amit', 'RITU ']), { name: 'Ritu', index: 2 });
  assert.equal(N.findDuplicate(['Ritu', 'Amit']), null);
  assert.equal(N.suggest('Ritu', ['Ritu', 'Ritu 2']), 'Ritu 3');
  assert.equal(N.graphemes('ક્ષ🙂👨‍👩‍👧').length, 3);
  assert.equal(N.clean('ખ'.repeat(25)).length, 20);
  assert.equal(N.firstLetter('  ✨ ok'), '✨');
  const ps = [{ name: 'Ritu' }, { name: 'ritu' }, { name: 'RITU' }];
  N.fixDuplicates(ps); assert.deepEqual(ps.map((p) => p.name), ['Ritu', 'Ritu (2)', 'Ritu (3)']);
  let s = K.newGame({ names: ['A', 'B', 'C'].map((name) => ({ name })) });
  assert.equal(K.renamePlayer(s, s.players[0].id, ' b '), s, 'rename to an existing name is refused');
});
