// Reasoned changes for round-based games. Pure functions (no screen).
// Undo of a saved round removes it from the totals but keeps it in s.voided (shown struck through) with the reason.
// Fixing a saved round keeps the old version in round.revs (shown struck through) with the reason; only the new version counts.
import { clone } from './util.js';

export const okReason = (r) => typeof r === 'string' && r.trim().length >= 3;
export const cleanReason = (r) => String(r).trim().replace(/\s+/g, ' ').slice(0, 120);

/** Undo the last saved round. Needs a reason. */
export function voidLast(s, reason, by) {
  if (!s.rounds.length || !okReason(reason)) return s;
  const n = clone(s);
  const h = n.rounds.pop();
  n.voided = [...(n.voided || []), { ...h, kind: 'UNDO', reason: cleanReason(reason), by: by || '', voidedAt: Date.now() }];
  return n;
}

/** Change a saved round. `patch(round)` edits a copy. Needs a reason. Returns the same state when nothing really changed. */
export function revise(s, num, patch, reason, by) {
  if (!okReason(reason)) return s;
  const n = clone(s);
  const r = n.rounds.find((x) => x.n === num);
  if (!r) return s;
  const { revs, ...old } = clone(r);
  patch(r);
  const { revs: _ignored, ...now } = r;
  if (JSON.stringify(old) === JSON.stringify(now)) return s;
  r.revs = [...(revs || []), { kind: 'EDIT', reason: cleanReason(reason), by: by || '', at: Date.now(), snap: old }];
  return n;
}

export const undoNeedsReason = (s) => s.rounds.length > 0;
