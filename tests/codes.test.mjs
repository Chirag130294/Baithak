import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// a tiny in-memory localStorage so the guard can run under node
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i], get length() { return store.size; } };

const { makeCode, parseCode, NEW_CODE_RE, CODE_ALPHABET } = await import('../js/core/util.js');
const guard = await import('../js/core/guard.js');

test('new room codes: 2 letters + 8 unambiguous characters, always match the pattern', () => {
  const seen = new Set();
  for (let i = 0; i < 3000; i++) {
    const c = makeCode('KF');
    assert.match(c, NEW_CODE_RE);
    assert.ok(!/[01OIL]/.test(c.slice(3)), c);
    seen.add(c);
  }
  assert.equal(seen.size, 3000, 'no repeats in 3000 draws');
  assert.equal(CODE_ALPHABET.length, 31);
});

test('every character of the alphabet turns up (no bias hole)', () => {
  const hit = new Set();
  for (let i = 0; i < 2000; i++) makeCode('TP').slice(3).replace('-', '').split('').forEach((ch) => hit.add(ch));
  assert.equal(hit.size, 31);
});

test('parseCode accepts new codes however they are typed, pasted or scanned', () => {
  assert.equal(parseCode('kf-7h4k-9qxm'), 'KF-7H4K-9QXM');
  assert.equal(parseCode(' KF 7H4K 9QXM '), 'KF-7H4K-9QXM');
  assert.equal(parseCode('KF7H4K9QXM'), 'KF-7H4K-9QXM');
  assert.equal(parseCode('https://x.github.io/baithak/#/r/KF-7H4K-9QXM'), 'KF-7H4K-9QXM');
  assert.equal(parseCode('KF-7H4K-9QX0'), null, 'zero is not in the alphabet');
  assert.equal(parseCode('KF-7H4K-9QX'), null, 'too short');
  assert.equal(parseCode('KF-7H4K-9QXMA'), null, 'too long');
});

test('older 4-digit rooms still open', () => {
  assert.equal(parseCode('kf-4821'), 'KF-4821');
  assert.equal(parseCode('KF4821'), 'KF-4821');
  assert.equal(parseCode('#/r/TP-1234'), 'TP-1234');
  assert.equal(parseCode('hello'), null);
});

test('database rules use the same code pattern and key pieces', () => {
  const rules = fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
  assert.ok(rules.includes('[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}'), 'room creation requires the long code');
  for (const k of ['userMeta', 'roomPins', 'access', 'rxLast']) assert.ok(rules.includes(`"${k}"`), k);
  const json = JSON.parse(rules.replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(json.rules['.read'], false);
  assert.equal(json.rules['.write'], false);
});

test('lockout: 3 wrong = 1 min, next 3 = 3 min, then 6, 12, 30, 60 and stays at 60', () => {
  store.clear();
  let now = 1_000_000;
  const wait = [1, 3, 6, 12, 30, 60, 60];
  for (const mins of wait) {
    assert.equal(guard.status(now).blocked, false);
    guard.fail(now); assert.equal(guard.status(now).blocked, false);
    guard.fail(now); assert.equal(guard.status(now).blocked, false);
    const s = guard.fail(now);
    assert.equal(s.blocked, true);
    assert.equal(s.ms, mins * 60000, `${mins} min`);
    now += mins * 60000 + 1;   // wait it out
  }
});

test('lockout: tries during a lock do not stack, a right code resets the streak, known rooms always open', () => {
  store.clear();
  let now = 5_000_000;
  guard.fail(now); guard.fail(now);
  guard.ok('KF-4821'); assert.equal(guard.status(now).blocked, false);
  guard.fail(now); guard.fail(now); assert.equal(guard.status(now).blocked, false, 'streak restarted after a right code');
  guard.fail(now); assert.equal(guard.status(now).blocked, true);
  const ms = guard.status(now).ms;
  guard.fail(now + 1000); guard.fail(now + 2000); guard.fail(now + 3000);
  assert.ok(guard.status(now + 3000).ms <= ms, 'no extra time for tries made while locked');
  assert.equal(guard.isKnown('KF-4821'), true);
  assert.equal(guard.isKnown('KF-9999'), false);
});

test('lockout: the harsher level cools off after a day of good behaviour', () => {
  store.clear();
  let now = 9_000_000;
  for (let i = 0; i < 3; i++) guard.fail(now);          // strike 1: 1 min
  now += 61_000;
  for (let i = 0; i < 3; i++) guard.fail(now);          // strike 2: 3 min
  assert.equal(guard.status(now).ms, 3 * 60000);
  now += 25 * 3600 * 1000;
  for (let i = 0; i < 3; i++) guard.fail(now);          // a day later: back to 1 min
  assert.equal(guard.status(now).ms, 60000);
});

test('countdown format', () => { assert.equal(guard.fmt(61_000), '1:01'); assert.equal(guard.fmt(59_100), '1:00'); assert.equal(guard.fmt(3_600_000), '60:00'); });
