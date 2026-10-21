// Audit trail helpers. Every score entry, edit, undo, pause and lock is written to the room's audit log.
// The log is append-only in the database rules: entries cannot be edited or deleted, and a completed room is frozen.
import { esc } from './util.js';

export const ACTION_LABEL = {
  CREATE: 'Room created', SCORE: 'Score saved', LOCK_BIDS: 'Bids locked', UNDO: 'Undo', EDIT: 'Edit', PAUSE: 'Pause / resume',
  PLAYERS: 'Players changed', SETTINGS: 'Settings', END: 'Game ended', LOCK_ROOM: 'Room locked', EXPORT: 'Export'
};

/** Turns a free-text game log line into an action type. */
export function classify(txt) {
  const x = String(txt).toLowerCase();
  if (/re-opened|unlocked|cleared|undo/.test(x)) return 'UNDO';
  if (/corrected|fixed/.test(x)) return 'EDIT';
  if (/saved/.test(x)) return 'SCORE';
  if (/bids locked/.test(x)) return 'LOCK_BIDS';
  if (/paused|resumed/.test(x)) return 'PAUSE';
  if (/joined|sat |seats|shuffled/.test(x)) return 'PLAYERS';
  if (/ended/.test(x)) return 'END';
  if (/started/.test(x)) return 'CREATE';
  return 'EDIT';
}

/** Log lines that exist in `next.log` but not in `prev.log` (the engines put newest first). */
export function newLogLines(prev, next) {
  const a = (next && next.log) || [], b = (prev && prev.log) || [];
  if (!a.length) return [];
  if (!b.length) return a.slice(0, 5);
  const top = b[0];
  const idx = a.findIndex((l) => l.ts === top.ts && l.txt === top.txt);
  return idx < 0 ? a.slice(0, 3) : a.slice(0, idx);
}

/** Generic fallback for games without a change log: compares round counts, pause and end flags. */
export function genericChanges(prev, next) {
  const out = [];
  const pr = (prev.rounds || []).length, nr = (next.rounds || []).length;
  if (nr > pr) out.push({ action: 'SCORE', summary: `Round ${nr} saved` });
  else if (nr < pr) out.push({ action: 'UNDO', summary: `Round ${pr} removed` });
  if (!!prev.paused !== !!next.paused) out.push({ action: 'PAUSE', summary: next.paused ? 'Game paused' : 'Game resumed' });
  if (!prev.ended && next.ended) out.push({ action: 'END', summary: 'Game ended' });
  if ((prev.players || []).length !== (next.players || []).length) out.push({ action: 'PLAYERS', summary: 'Players changed' });
  return out;
}

/** Audit text for round-book games (Score Book, Rummy, Bhabhi). roundText(round, state) says what a round contained. */
export function boardDescribe(prev, next, roundText) {
  const out = [], pr = prev.rounds.length, nr = next.rounds.length;
  if (nr > pr) { const r = next.rounds[nr - 1]; out.push({ action: 'SCORE', summary: `Round ${r.n} saved: ${roundText(r, next)}` }); }
  else if (nr < pr) { const v = (next.voided || [])[(next.voided || []).length - 1]; out.push({ action: 'UNDO', summary: `Round ${prev.rounds[pr - 1].n} removed (undo)${v ? ' — reason: ' + v.reason : ''}` }); }
  else next.rounds.forEach((r, i) => { const a = (r.revs || []).length, b = ((prev.rounds[i] || {}).revs || []).length; if (a > b) out.push({ action: 'EDIT', summary: `Round ${r.n} corrected: ${roundText(r, next)} — reason: ${r.revs[a - 1].reason}` }); });
  if (!!prev.paused !== !!next.paused) out.push({ action: 'PAUSE', summary: next.paused ? 'Game paused' : 'Game resumed' });
  if (prev.players.length !== next.players.length) out.push({ action: 'PLAYERS', summary: 'Players changed' });
  if (!prev.ended && next.ended) out.push({ action: 'END', summary: 'Game ended' });
  return out;
}

export function describeChanges(game, prev, next) {
  if (!prev || !next) return [];
  try {
    if (game && typeof game.describe === 'function') return game.describe(prev, next) || [];
  } catch (e) { console.warn('describe failed', e); }
  const lines = newLogLines(prev, next);
  if (lines.length) return lines.map((l) => ({ action: classify(l.txt), summary: l.txt })).reverse();
  return genericChanges(prev, next);
}

export async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

/** Compact snapshot of the standings, stored with an entry so a dispute can be settled from the log alone. */
export function totalsSnapshot(rows) {
  const o = {};
  (rows || []).slice(0, 12).forEach((r) => { o[r.name] = r.total; });
  return JSON.stringify(o).slice(0, 2900);
}

export function makeEntry({ action, summary, user, totals = '', hash = '' }) {
  return {
    action: String(action).slice(0, 20),
    summary: String(summary || '').slice(0, 380),
    uid: (user && user.uid) || '',
    name: String((user && user.name) || 'Unknown').slice(0, 60),
    totals, hash
  };
}

export function auditRowHtml(e) {
  const when = new Date(e.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  let totals = '';
  try { totals = Object.entries(JSON.parse(e.totals || '{}')).map(([n, v]) => `${esc(n)} ${v}`).join(' · '); } catch { /* ignore */ }
  return `<div class="card" style="padding:10px 12px"><div class="row between"><span class="badge ${e.action === 'UNDO' || e.action === 'EDIT' ? 'warn' : e.action === 'LOCK_ROOM' ? 'gold' : ''}">${esc(e.action)}</span><span class="tiny muted">${esc(when)}</span></div>
    <div style="margin-top:4px;font-weight:600">${esc(e.summary || '')}</div>
    <div class="tiny muted">${esc(e.name || '')}</div>${totals ? `<div class="tiny muted" style="margin-top:2px">${totals}</div>` : ''}</div>`;
}

/** CSV of the audit log, oldest first. */
export function auditCsv(entries, room) {
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Time', 'Action', 'By', 'Summary', 'Totals', 'Data hash']];
  entries.forEach((e) => rows.push([new Date(e.ts).toISOString(), e.action, e.name, e.summary, e.totals, e.hash]));
  return `﻿` + rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}
