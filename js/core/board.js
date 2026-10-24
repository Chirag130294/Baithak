// Shared skeleton for simple score-book screens (Score Book, Rummy, Teen Patti, Bhabhi, Kali Tiri).
// Kachuful has its own richer screen. A game gives this helper a few small functions and gets the same look:
// collapsible sections (standings with medals, a round book that shows the last rounds), and one slim bottom bar:
// [More] [Undo] [main action]. Everything else lives in the More sheet so the screen stays clean.
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
import { icon, avatar, fold, bindFolds, openSheet, confirmSheet, refreshRails } from './ui.js';
import { safeRender } from './anim.js';
import { openSeatsSheet } from './seats.js';
import { askReason, validReason, cleanReason } from './reason.js';

/** Row height for a list of n players, so 4 players get roomy rows and 15 still fit without scrolling. */
export const rowH = (n) => (n <= 6 ? 42 : n <= 9 ? 38 : n <= 12 ? 34 : 31);

/** The top four as little pills. Shown under the "Standings" heading while it is collapsed; they slide past each other when scores change. */
export function top4Html(rows, unit = '') {
  return rows.slice(0, 4).map((r) => `<div class="pkpill ${r.rank === 1 && (r.total || r.move) ? 'first' : ''}" data-flip="pk-${esc(r.id)}">
    <span class="pkrk">${r.rank}</span>${avatar(r, 'sm')}<b class="pkname">${esc(r.name)}</b><b class="pktot" data-count="pk-${esc(r.id)}" data-count-val="${r.total}">${r.total}</b>${unit ? `<small class="muted">${esc(unit)}</small>` : ''}</div>`).join('');
}

/** Standings: gold, silver and bronze rank badges (people on the same score share a rank), gain of the last round, big total. */
export function standingsHtml(rows, unit = '', fmt = (n) => n) {
  return `<div class="strows" style="--rh:${rowH(rows.length)}px">${rows.map((r) => `
    <div class="strow ${r.out ? 'out' : ''}" data-flip="st-${esc(r.id)}">
      <span class="strk ${r.rank <= 3 && (r.total || r.move) ? 'r' + r.rank : ''}">${r.rank}</span>${avatar(r, 'sm')}
      <span class="stnm">${esc(r.name)}${r.out ? ` <span class="tiny muted">(${esc(t('out'))})</span>` : ''}</span>
      ${r.gain ? `<span class="stgain ${r.gain > 0 ? 'pos' : 'neg'}">${r.gain > 0 ? '+' : ''}${fmt(r.gain)}</span>` : ''}
      <span class="sttot"><span data-count="t-${esc(r.id || r.name)}" data-count-val="${r.total}">${fmt(r.total)}</span>${unit ? ' <span class="tiny muted">' + esc(unit) + '</span>' : ''}</span>
    </div>`).join('')}</div>`;
}

/** Podium for the first three ranks. People on the same score share a place. The bars rise one after another, winner last. */
export function podiumHtml(rows, fmt = (n) => n) {
  const by = new Map();
  rows.forEach((r) => { if (r.rank <= 3) { if (!by.has(r.rank)) by.set(r.rank, []); by.get(r.rank).push(r); } });
  if (by.size < 2) return '';
  const col = (rk, delay) => {
    const g = by.get(rk); if (!g) return '<div class="pd empty"></div>';
    const shown = g.slice(0, 2), more = g.length - shown.length;
    return `<div class="pd p${rk}" style="--d:${delay}ms"><div class="pdav">${shown.map((x) => avatar(x, 'sm')).join('')}</div>
      <div class="pdn">${esc(shown.map((x) => x.name).join(', '))}${more > 0 ? ` +${more}` : ''}</div>
      <div class="pdt">${fmt(g[0].total)}</div><div class="bar"><span>${['🥇', '🥈', '🥉'][rk - 1]}</span></div></div>`;
  };
  return `<div class="podium" aria-label="${esc(t('Podium'))}">${col(2, 650)}${col(1, 1150)}${col(3, 250)}</div>`;
}

/** The "Game over" banner shared by every score book. */
export function finalCard(rows, { locked = false, line = '' } = {}) {
  const win = rows.filter((r) => r.rank === 1);
  const names = win.map((r) => r.name).join(' & ');
  return `<section class="winner ${win.length > 3 ? 'many' : ''}"><div class="wn-kicker">${esc(t('Game over'))}</div>
    <div class="wn-names"><span class="wn-cup">🏆</span><span>${esc(names)}</span></div>
    ${line ? `<div class="wn-line">${esc(line)}</div>` : ''}
    ${podiumHtml(rows)}
    ${locked ? `<div class="wn-line">${icon('lock', 12, 2)} ${esc(t('Room locked. Final scores.'))}</div>` : ''}</section>`;
}

// how many rounds the round book shows before "Show all". Set by createBoardView just before it asks a game for its sections.
let bookLimit = 0;
export const setBookLimit = (n) => { bookLimit = n; };

export function tableHtml(head, rows, foot) {
  return `<div class="bkwrap"><table class="bk">
    <thead><tr>${head.map((h, i) => `<th class="${i === 0 ? 'fc' : ''}">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr ${r.attrs || ''}>${r.cells.map((c, i) => `<td class="${i === 0 ? 'fc' : ''}">${c}</td>`).join('')}</tr>`).join('')}
    ${foot ? `<tr class="tot">${foot.map((c, i) => `<td class="bold ${i === 0 ? 'fc' : ''}">${c}</td>`).join('')}</tr>` : ''}
    </tbody></table></div>`;
}

/** A round book with history: the current score of each round, then its earlier versions struck through with the reason.
 *  spec = { head:[html...] (first = round column title), cells(round)->[html...], foot, host, attrOf(round)->string, label? } */
export function bookHtml(s, { head, cells, foot, host, attrOf, label = (r) => `<b>${r.n}</b>` }) {
  const ncol = head.length;
  const when = (x) => new Date(x.at || x.voidedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const strike = (c) => `<span class="strike">${c}</span>`;
  const why = (x) => `<tr class="why"><td colspan="${ncol}" class="fc"><span class="tiny" style="color:var(--saffron-ink)">${esc(t('Reason'))}: ${esc(x.reason || '')}${x.by ? ' · ' + esc(x.by) : ''}</span></td></tr>`;
  const old = (r, x, tag) => `<tr class="old"><td class="fc"><span class="tiny muted">↳ ${esc(t(tag))} ${esc(when(x))}</span></td>${cells(x.snap || r).map((c) => `<td>${strike(c)}</td>`).join('')}</tr>${why(x)}`;
  let items = s.rounds.map((r) => ({ n: r.n, r, v: false })).concat((s.voided || []).map((r) => ({ n: r.n, r, v: true })));
  items.sort((a, b) => b.n - a.n || (a.v ? 1 : -1));
  const total = s.rounds.length, limited = bookLimit > 0 && total > bookLimit;
  if (limited) { const minN = s.rounds.slice().sort((a, b) => b.n - a.n)[bookLimit - 1].n; items = items.filter((x) => x.n >= minN); }
  const body = items.map(({ r, v }) => {
    if (v) return old(r, r, 'undone');
    const fixed = r.revs && r.revs.length ? ` <span class="badge warn" style="font-size:10px">${esc(t('fixed'))}</span>` : '';
    const main = `<tr class="rd" ${host && attrOf ? attrOf(r) : ''}><td class="fc">${label(r)}${fixed}</td>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`;
    return main + (r.revs || []).slice().reverse().map((x) => old(r, x, 'before fix')).join('');
  }).join('');
  const more = total > bookLimit && bookLimit > 0 ? `<button type="button" class="linkbtn" data-act="allrounds">${esc(t('Show all {n} rounds', { n: total }))}</button>` : '';
  const less = bookLimit === 0 && total > 2 ? `<button type="button" class="linkbtn" data-act="lessrounds">${esc(t('Show last 2 only'))}</button>` : '';
  return `${host ? `<p class="tiny muted bkhint">${esc(t('Tap a round to fix it'))}</p>` : ''}
    <div class="bkwrap"><table class="bk"><thead><tr>${head.map((h, i) => `<th class="${i === 0 ? 'fc' : ''}">${h}</th>`).join('')}</tr></thead>
    <tbody>${body}${foot ? `<tr class="tot">${foot.map((c, i) => `<td class="bold ${i === 0 ? 'fc' : ''}">${c}</td>`).join('')}</tr>` : ''}</tbody></table></div>${more}${less}`;
}

export function createBoardView(root, ctx, spec) {
  let s = ctx.state;
  const host = ctx.isHost;
  const ui = { folds: { standings: true, rounds: true }, allRounds: false, ...(spec.folds || {}) };
  let destroyed = false;
  const E = spec.engine;

  const commit = (fn, { afterEnd = false } = {}) => { if (!host || (s.ended && !afterEnd && fn !== E.undo)) return; const next = fn(s); if (next && next !== s) { s = next; ctx.save(s); render(); } };
  const user = () => ctx.user && ctx.user.name;
  const api = { get s() { return s; }, host, commit, ctx, rerender: () => render(), user };

  /** One slim rail of quick actions under the header. It is a single row you can swipe left and right, so nothing wraps into a second line. */
  function rail() {
    if (!host) return '';
    const c = (act, ic, label, extra = '') => `<button type="button" class="chip btnlike rc ${extra}" data-act="${act}">${icon(ic, 16)}<span>${esc(t(label))}</span></button>`;
    const items = [];
    if (s.ended) {
      if (!ctx.locked && spec.modify) items.push(c('modify', 'log', 'Modify a round'));
      if (ctx.canLock) items.push(c('lockroom', 'lock', 'Finish and lock room'));
    } else {
      if (E.reorder || E.addPlayer || E.setOut) items.push(c('seats', 'users', 'Seats'));
      if (E.undo && s.rounds.length) items.push(c('undo', 'undo', 'Undo'));
      if (E.setPaused) items.push(c(s.paused ? 'pause' : 'pause', s.paused ? 'play' : 'pause', s.paused ? 'Resume game' : 'Pause game'));
      if (E.endGame) items.push(c('end', 'flag', 'End game', 'warnchip'));
    }
    return items.length ? `<div class="rail" data-rail>${items.join('')}</div>` : '';
  }

  /** The bottom bar holds the one main action: add a round (or share the picture when the game is over, or resume when paused). */
  function bar() {
    if (!host) return '';
    if (s.ended) return `<button class="btn primary" data-act="sharepic">${icon('share', 18)} ${esc(t('Share picture'))}</button>`;
    if (s.paused) return `<button class="btn primary" data-act="pause">${icon('play', 18)} ${esc(t('Resume game'))}</button>`;
    return spec.action(s, host);
  }

  function render() {
    if (destroyed) return;
    const rows = E.standings(s);
    setBookLimit(ui.allRounds ? 0 : 2);
    const secs = spec.sections(s, host, ui);
    const b = bar();
    const html = `<div class="body ${b ? 'pad-b' : ''}">
      ${s.paused && !s.ended ? `<div class="note slidein" role="status">⏸ ${esc(t('Game paused by the host'))}</div>` : ''}
      ${s.ended && spec.final ? spec.final(s, host) : ''}
      ${s.ended && !host ? `<button class="btn dark block" data-act="sharepic">${icon('share', 18)} ${esc(t('Share picture'))}</button>` : ''}
      ${spec.header ? spec.header(s) : ''}
      ${rail()}
      ${secs.map((x) => fold(x.id, x.title, x.body, ui.folds[x.id] ?? x.open ?? false, x.extra || '', x.id === 'standings' ? top4Html(rows, spec.unit || '') : '')).join('')}
    </div>${b ? `<div class="actionbar">${b}</div>` : ''}`;
    safeRender(root, () => { root.innerHTML = html; });
    refreshRails(root);
  }

  function pickRound() {
    if (!spec.modify || !s.rounds.length) return;
    const sh = openSheet(`<h2>${esc(t('Modify a round'))}</h2><p class="muted small" style="margin-bottom:8px">${esc(t('Pick the round to change. You must give a reason. The old score stays in the history, struck through.'))}</p>
      <div class="stack" style="gap:6px;max-height:52vh;overflow:auto">${s.rounds.slice().reverse().map((r) => `<button class="btn ghost block" style="justify-content:space-between" data-pick="${r.n}"><b>${esc(t('Round'))} ${r.n}</b>${r.revs && r.revs.length ? `<span class="badge warn">${esc(t('fixed'))} ×${r.revs.length}</span>` : icon('right', 18)}</button>`).join('')}</div>
      <div class="sheet-foot"><button class="btn dark" data-close>${esc(t('Close'))}</button></div>`);
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) { sh.close(); spec.modify(api, +b.dataset.pick); } });
  }
  api.modify = (n) => spec.modify && spec.modify(api, n);

  async function act(a, b) {
    if (a === 'allrounds') { ui.allRounds = true; return render(); }
    if (a === 'lessrounds') { ui.allRounds = false; return render(); }
    if (a === 'undo') {
      if (!s.rounds.length) return;
      const last = s.rounds[s.rounds.length - 1];
      const why = await askReason({ title: `${t('Undo round')} ${last.n}`, text: t('The round is removed from the totals. It stays in the history, struck through.'), ok: 'Undo round' });
      if (why) commit((st) => E.undo(st, why, user()));
      return;
    }
    if (a === 'lockroom') return ctx.lockRoom && ctx.lockRoom();
    if (a === 'sharepic') return ctx.shareCard && ctx.shareCard({ title: t('Game over'), subtitle: `${ctx.gameName || ''} · ${s.rounds.length} ${t('rounds')}`, rows: E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total })) });
    if (a === 'modify') return pickRound();
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
  }

  bindFolds(root, ui.folds);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button, tr[data-fix], tr[data-edit]'); if (!b || !root.contains(b)) return;
    act(b.dataset.act, b);
  });

  render();
  return { update(next) { s = next; render(); }, destroy() { destroyed = true; root.innerHTML = ''; } };
}

/** Number entry sheet used by several games: one numeric stepper-input per player. */
export function openNumberSheet({ title, rows, initial = {}, okLabel = 'Save', note = '', onSave, allowNegative = true, step = 1, needReason = false }) {
  let why = '';
  const vals = {}; rows.forEach((r) => { vals[r.id] = initial[r.id] ?? ''; });
  const sh = openSheet('');
  const draw = () => sh.setHtml(`<h2>${esc(title)}</h2>${note ? `<p class="muted small" style="margin-bottom:10px">${esc(note)}</p>` : ''}
    <div class="stack">${rows.map((r) => `<div class="plrow">${avatar(r)}<div class="grow bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</div>
      ${allowNegative ? `<button class="iconbtn light" data-sign="${esc(r.id)}" aria-label="plus or minus">±</button>` : ''}
      <input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-v="${esc(r.id)}" value="${esc(vals[r.id])}" placeholder="0"></div>`).join('')}</div>
    ${needReason ? `<div class="label" style="margin-top:10px">${esc(t('Reason (required)'))}</div><input class="input" data-why maxlength="120" value="${esc(why)}" placeholder="${esc(t('Why is this being changed?'))}" style="width:100%">` : ''}
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok ${needReason && !validReason(why) ? 'disabled' : ''}>${esc(t(okLabel))}</button></div>`);
  sh.el.addEventListener('input', (e) => {
    const w = e.target.closest('[data-why]'); if (w) { why = w.value; const ok = sh.el.querySelector('[data-ok]'); if (ok) ok.disabled = !validReason(why); return; }
    const i = e.target.closest('[data-v]'); if (i) vals[i.dataset.v] = i.value;
  });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sign) { const v = parseFloat(vals[b.dataset.sign]); vals[b.dataset.sign] = Number.isFinite(v) ? String(-v) : '-'; draw(); }
    if ('ok' in b.dataset) { if (needReason && !validReason(why)) return; const out = {}; rows.forEach((r) => { out[r.id] = Math.round(parseFloat(vals[r.id]) || 0); }); onSave(out, cleanReason(why)); sh.close(); }
  });
  draw();
  return sh;
}
