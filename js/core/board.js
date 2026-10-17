// Shared skeleton for simple score-book screens (Score Book, Rummy, Teen Patti, Bhabhi).
// Kachuful has its own richer screen. A game gives this helper a few small functions and gets the same look:
// a row of leaderboard tabs that glide when ranks change, collapsible sections, a tools row and a bottom action bar.
//
// spec = {
//   engine: { standings(s) -> [{id,name,color,out,total,rank,move,gain}], undo?, setPaused?, endGame?, reorder?, setOut?, addPlayer? },
//   unit: 'pts',                            // label after totals
//   sections(s, host, ui) -> [{id,title,body,open,extra?}],
//   action(s, host) -> html (inside .actionbar) or '',
//   final?(s, host) -> html shown when the game ended,
//   onClick?(btn, api) -> true if handled,   // api = { s, host, commit(fn), sheet, toast, ctx, rerender }
//   title: 'Rummy'
// }
import { esc } from './util.js';
import { t } from './i18n.js';
import { icon, avatar, fold, bindFolds, openSheet, confirmSheet } from './ui.js';
import { safeRender } from './anim.js';
import { openSeatsSheet } from './seats.js';

export function leaderboardHtml(rows, unit = '') {
  return `<section><div style="display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x proximity">${rows.map((r) => `
    <div class="row" data-flip="lb-${esc(r.id)}" style="flex:none;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;background:${r.rank === 1 ? 'var(--saffron-soft)' : '#fff'};border:${r.rank === 1 ? '2px solid var(--saffron)' : '1.5px solid var(--line2)'};scroll-snap-align:start;${r.out ? 'opacity:.5' : ''}">
      <span class="bold" style="min-width:20px;text-align:center">${r.rank}</span>${avatar(r, 'sm')}
      <span class="bold" style="max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</span>
      <span class="bold" data-anim="lb-${esc(r.id)}" data-anim-val="${r.total}" style="font-variant-numeric:tabular-nums">${r.total}${unit ? '<span class="tiny muted"> ' + esc(unit) + '</span>' : ''}</span>
      ${r.move ? `<span class="tiny bold" style="color:${r.move > 0 ? 'var(--ok)' : 'var(--bad)'}">${r.move > 0 ? '↑' : '↓'}${Math.abs(r.move)}</span>` : ''}
    </div>`).join('')}</div></section>`;
}

export function standingsHtml(rows, unit = '', fmt = (n) => n) {
  return `<div class="stack" style="gap:6px">${rows.map((r) => `
    <div class="row" style="min-height:44px">
      <span class="bold" style="width:24px;text-align:center">${r.rank}</span>${avatar(r, 'sm')}
      <span class="grow bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}${r.out ? ` <span class="tiny muted">(${esc(t('out'))})</span>` : ''}</span>
      ${r.gain ? `<span class="tiny bold" style="color:${r.gain > 0 ? 'var(--ok)' : 'var(--bad)'}">${r.gain > 0 ? '+' : ''}${fmt(r.gain)}</span>` : ''}
      <span class="bold" style="font-size:20px;min-width:56px;text-align:right;font-variant-numeric:tabular-nums">${fmt(r.total)}${unit ? ' <span class="tiny muted">' + esc(unit) + '</span>' : ''}</span>
    </div>`).join('')}</div>`;
}

export function tableHtml(head, rows, foot) {
  return `<div style="overflow-x:auto;margin:0 -4px"><table style="border-collapse:collapse;width:100%;text-align:center;font-size:15px">
    <thead><tr>${head.map((h, i) => `<th style="padding:6px 8px;${i === 0 ? 'text-align:left;position:sticky;left:0;background:#fff' : 'min-width:54px'}">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr ${r.attrs || ''}>${r.cells.map((c, i) => `<td style="padding:6px 8px;${i === 0 ? 'text-align:left;white-space:nowrap;position:sticky;left:0;background:#fff' : ''}">${c}</td>`).join('')}</tr>`).join('')}
    ${foot ? `<tr style="border-top:2px solid var(--felt)">${foot.map((c, i) => `<td class="bold" style="padding:8px;${i === 0 ? 'text-align:left;position:sticky;left:0;background:#fff' : ''}">${c}</td>`).join('')}</tr>` : ''}
    </tbody></table></div>`;
}

export function createBoardView(root, ctx, spec) {
  let s = ctx.state;
  const host = ctx.isHost;
  const ui = { folds: { standings: true, rounds: true }, ...(spec.folds || {}) };
  let destroyed = false;
  const E = spec.engine;

  const commit = (fn) => { if (!host) return; const next = fn(s); if (next && next !== s) { s = next; ctx.save(s); render(); } };
  const api = { get s() { return s; }, host, commit, ctx, rerender: () => render() };

  function tools() {
    if (!host) return '';
    return `<div class="row wrap" style="gap:8px">
      ${E.reorder || E.addPlayer || E.setOut ? `<button class="chip btnlike" data-act="seats">${icon('users', 18)} ${esc(t('Seats'))}</button>` : ''}
      ${E.undo ? `<button class="chip btnlike" data-act="undo">${icon('undo', 18)} ${esc(t('Undo'))}</button>` : ''}
      ${E.setPaused ? `<button class="chip btnlike" data-act="pause">${icon(s.paused ? 'play' : 'pause', 18)} ${esc(t(s.paused ? 'Resume game' : 'Pause game'))}</button>` : ''}
      ${E.endGame && !s.ended ? `<button class="chip btnlike" data-act="end">${icon('flag', 18)} ${esc(t('End game'))}</button>` : ''}
    </div>`;
  }

  function render() {
    if (destroyed) return;
    const rows = E.standings(s);
    const secs = spec.sections(s, host, ui);
    const bar = host && !s.ended && !s.paused ? spec.action(s, host) : '';
    const html = `<div class="body ${bar ? 'pad-b' : ''}">
      ${s.paused && !s.ended ? `<div class="note slidein" role="status">⏸ ${esc(t('Game paused by the host'))}</div>` : ''}
      ${s.ended && spec.final ? spec.final(s, host) : ''}
      ${spec.header ? spec.header(s) : ''}
      ${leaderboardHtml(rows, spec.unit || '')}
      ${tools()}
      ${secs.map((x) => fold(x.id, x.title, x.body, ui.folds[x.id] ?? x.open ?? false, x.extra || '')).join('')}
    </div>${bar ? `<div class="actionbar">${bar}</div>` : ''}`;
    safeRender(root, () => { root.innerHTML = html; });
  }

  bindFolds(root, ui.folds);
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button, tr[data-fix], tr[data-edit]'); if (!b || !root.contains(b)) return;
    const a = b.dataset.act;
    if (a === 'undo') return commit(E.undo);
    if (a === 'pause') return commit((st) => E.setPaused(st, !st.paused));
    if (a === 'end') { if (await confirmSheet({ title: t('End the game?'), text: t('Scores stay saved.'), ok: 'End game', danger: true })) commit(E.endGame); return; }
    if (a === 'seats') {
      return openSeatsSheet({
        get: () => ({ players: s.players, locked: false, regulars: ctx.regulars || [] }),
        onMove: E.reorder ? (x, y) => commit((st) => E.reorder(st, x, y)) : null,
        onOut: E.setOut ? (id, out) => commit((st) => E.setOut(st, id, out)) : null,
        onAdd: E.addPlayer ? (name) => { ctx.rememberRegular && ctx.rememberRegular(name); commit((st) => E.addPlayer(st, name)); } : null
      });
    }
    if (spec.onClick) spec.onClick(b, api);
  });

  render();
  return { update(next) { s = next; render(); }, destroy() { destroyed = true; root.innerHTML = ''; } };
}

/** Number entry sheet used by several games: one numeric stepper-input per player. */
export function openNumberSheet({ title, rows, initial = {}, okLabel = 'Save', note = '', onSave, allowNegative = true, step = 1 }) {
  const vals = {}; rows.forEach((r) => { vals[r.id] = initial[r.id] ?? ''; });
  const sh = openSheet('');
  const draw = () => sh.setHtml(`<h2>${esc(title)}</h2>${note ? `<p class="muted small" style="margin-bottom:10px">${esc(note)}</p>` : ''}
    <div class="stack">${rows.map((r) => `<div class="plrow">${avatar(r)}<div class="grow bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</div>
      ${allowNegative ? `<button class="iconbtn light" data-sign="${esc(r.id)}" aria-label="plus or minus">±</button>` : ''}
      <input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-v="${esc(r.id)}" value="${esc(vals[r.id])}" placeholder="0"></div>`).join('')}</div>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok>${esc(t(okLabel))}</button></div>`);
  sh.el.addEventListener('input', (e) => { const i = e.target.closest('[data-v]'); if (i) vals[i.dataset.v] = i.value; });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sign) { const v = parseFloat(vals[b.dataset.sign]); vals[b.dataset.sign] = Number.isFinite(v) ? String(-v) : '-'; draw(); }
    if ('ok' in b.dataset) { const out = {}; rows.forEach((r) => { out[r.id] = Math.round(parseFloat(vals[r.id]) || 0); }); onSave(out); sh.close(); }
  });
  draw();
  return sh;
}
