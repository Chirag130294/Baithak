import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = { addEventListener() {}, createElement: () => ({}), getElementById: () => null };
const { splitToCsv, CSV_HEADER } = await import('../js/core/export.js');
import { describeChanges, makeEntry, auditCsv } from '../js/core/audit.js';
const TP = (await import('../js/games/teenpatti/index.js')).default;
const KF = (await import('../js/games/kachuful/index.js')).default;
import * as E from '../js/games/teenpatti/engine.js';
import * as K from '../js/games/kachuful/engine.js';

test('oweize csv: header, payer = creditor, owes = debtor, quoting', () => {
  const csv = splitToCsv([{ from: 'Ravi', to: 'Mina "M"', amount: 120 }], { date: new Date(2026, 9, 18) });
  const lines = csv.replace('﻿', '').trim().split('\r\n');
  assert.equal(lines[0], CSV_HEADER.map((h) => `"${h}"`).join(','));
  assert.ok(lines[1].startsWith('"2026-10-18"'));
  assert.ok(lines[1].includes('"120.00","Mina ""M""","Ravi"'));
});

test('teen patti describe: win, undo', () => {
  let s = E.newGame({ names: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], config: { boot: 10 } });
  const a = E.startHand(s);
  const w = E.declareWinner(a, a.players[0].id);
  const d = TP.describe(a, w);
  assert.equal(d[0].action, 'SCORE'); assert.match(d[0].summary, /won by A/);
  assert.equal(TP.describe(w, E.undoAll(w, 'oops'))[0].action, 'UNDO');
});

test('kachuful describe goes through describeChanges and entries are bounded', () => {
  const s = K.newGame({ names: ['A', 'B', 'C'].map((name) => ({ name })) });
  const ch = describeChanges(KF, s, K.endGame(s));
  assert.equal(ch[0].action, 'END');
  const e = makeEntry({ action: 'SCORE', summary: 'x'.repeat(999), user: { uid: 'u', name: 'H' } });
  assert.equal(e.summary.length, 380);
  assert.match(auditCsv([{ ts: 0, action: 'A', name: 'n', summary: 's', totals: '{}', hash: 'h' }]), /Time/);
});
