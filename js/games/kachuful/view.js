// Kachuful screen. The same code draws the host view (with + / - buttons) and the viewer view (read only),
// so watchers always see exactly what the host sees: trump, cards, dealer, every bid, totals and the round book.
import { esc } from '../../core/util.js';
import { t } from '../../core/i18n.js';
import { icon, avatar, suitSvg, suitName, openSheet, confirmSheet, buzz, trumpCard, CARD_COLOR } from '../../core/ui.js';
import { layout, dock, chips, menuRow } from '../../core/shell.js';
import { safeRender, fancyMotion, animLevel } from '../../core/anim.js';
import { openSeatsSheet } from '../../core/seats.js';
import { askReason } from '../../core/reason.js';
import * as K from './engine.js';

export function mountKachuful(root, ctx) {
  let s = ctx.state;
  const host = ctx.isHost;
  const ui = { tab: ctx.state.ended ? 'scores' : 'play' };
  let destroyed = false;
  const player = (id) => s.players.find((p) => p.id === id) || { id, name: '?', color: 0 };

  // ---------- change handling ----------
  function apply(next, { silent = false } = {}) {
    const prevLap = K.currentLap(s);
    s = next;
    if (host && !silent) ctx.save(s);
    render();
    return prevLap;
  }
  function commit(fn, { afterEnd = false } = {}) { // host actions (after the game ends only a reasoned fix is allowed)
    if (!host || (s.ended && !afterEnd)) return;
    const next = fn(s);
    if (next && next !== s) apply(next);
  }

  // ---------- pieces ----------
  function strip() {
    const c = s.cur;
    if (!c) return '';
    const dealer = player(c.dealerId);
    return `<div class="strip">
      <div class="trump tc" data-flip="trump" title="${esc(t('Trump'))}: ${esc(suitName(c.trump))}">${trumpCard(c.trump, { w: 34 })}</div>
      <div class="grow">
        <div class="ttl" data-anim="roundno" data-anim-val="${c.n}">${esc(t('Round {n}', { n: c.n }))}</div>
        <div class="sub">${esc(t('Lap {n}', { n: c.lap }))} ${c.dir === 'up' ? '↑' : '↓'} · ${esc(suitName(c.trump))} · ${esc(t('Dealer'))}: ${esc(dealer.name)}</div>
      </div>
      <div class="cards"><b data-anim="cards" data-anim-val="${c.cards}">${c.cards}</b><span>${esc(t(c.cards === 1 ? 'card' : 'cards'))} · ${esc(t('max'))} ${K.maxCards(s)}</span></div>
    </div>`;
  }

  function stepper(id, value, min, max, kind) {
    const shown = value == null ? '–' : value;
    return `<div class="stp">
      <button type="button" data-dec="${esc(id)}" aria-label="${esc(t('Less'))}" ${value == null || value <= min ? 'disabled' : ''}>${icon('minus', 20)}</button>
      <button type="button" class="v" data-pad="${esc(id)}" data-anim="${kind}-${esc(id)}" data-anim-val="${shown}">${shown}</button>
      <button type="button" class="plus" data-inc="${esc(id)}" aria-label="${esc(t('More'))}" ${value != null && value >= max ? 'disabled' : ''}>${icon('plus', 20)}</button>
    </div>`;
  }

  function statusLine() {
    const c = s.cur;
    if (!c) return '';
    const hideBids = !host && s.config.revealBids === 'after' && !c.locked;
    const bidCount = Object.keys(c.bids).length;
    if (!c.locked) {
      if (hideBids) return `<span class="badge">${esc(t('Bids are hidden until the host locks them'))} · ${bidCount}/${c.order.length}</span>`;
      const sumB = K.bidsTotal(c), diff = sumB - c.cards;
      return bidCount > 0
        ? `<span class="badge ${diff === 0 ? 'bad' : diff > 0 ? 'warn' : 'ok'}">${esc(t('Bids {a} of {b} cards', { a: sumB, b: c.cards }))} · ${diff === 0 ? esc(t('must not match')) : diff > 0 ? esc(t('Over by {n}', { n: diff })) : esc(t('Under by {n}', { n: -diff }))}</span>`
        : `<span class="badge">${esc(t('Waiting for bids'))} ${bidCount}/${c.order.length}</span>`;
    }
    if (c.mode === 'miss') {
      const m = K.missCount(c);
      return `<span class="badge ${m ? 'ok' : 'warn'}">${esc(m ? t('{n} missed', { n: m }) : t('Tap the players who missed'))}</span>`;
    }
    const w = K.wonTotal(c);
    return `<span class="badge ${w === c.cards ? 'ok' : 'warn'}">${esc(t('Tricks {a} of {b}', { a: w, b: c.cards }))}</span>`;
  }

  function playPane() {
    const c = s.cur;
    if (!c) return '';
    const hideBids = !host && s.config.revealBids === 'after' && !c.locked;
    const rows = c.order.map((id, i) => {
      const p = player(id), isDealer = id === c.dealerId, b = c.bids[id];
      const forbid = host && !c.locked && isDealer ? K.forbiddenBid(c, id) : null;
      let right;
      const missMode = c.locked && c.mode === 'miss', missed = missMode && c.miss && c.miss[id];
      const pill = missMode ? `<div class="hitpill ${missed ? 'miss' : 'hit'}" data-anim="res-${esc(id)}" data-anim-val="${missed ? 'x' : 'ok'}">${missed ? '✕ ' + esc(t('Miss')) : '✓ ' + esc(t('Hit'))}</div>` : '';
      if (host && !s.paused && !s.ended) right = missMode ? `<div class="row" style="gap:10px"><div class="center"><div class="tiny muted">${esc(t('Bid'))}</div><div class="bold" style="font-size:21px;line-height:1.1">${b}</div></div>${pill}</div>` : (c.locked ? stepper(id, c.won[id], 0, c.cards, 'won') : stepper(id, b, 0, c.cards, 'bid'));
      else {
        const bid = hideBids ? (b != null ? '✓' : '·') : (b != null ? b : '·');
        right = `<div class="row" style="gap:14px"><div class="center"><div class="tiny muted">${esc(t('Bid'))}</div><div class="bold" style="font-size:21px;line-height:1.1" data-anim="vbid-${esc(id)}" data-anim-val="${bid}">${bid}</div></div>
          ${missMode ? pill : c.locked ? `<div class="center"><div class="tiny muted">${esc(t('Won'))}</div><div class="bold" style="font-size:21px;line-height:1.1" data-anim="vwon-${esc(id)}" data-anim-val="${c.won[id]}">${c.won[id]}</div></div>` : ''}</div>`;
      }
      const parts = [];
      if (host && c.locked && !missMode) parts.push(t('Bid') + ' ' + b);
      if (!c.locked && b == null && host) parts.push(t('auto 0'));
      if (c.locked && c.auto && c.auto.includes(id)) parts.push(t('auto 0'));
      if (isDealer) parts.push(t(c.locked ? 'Dealer' : 'Dealer · last'));
      if (forbid != null) parts.push(t("can't bid {n}", { n: forbid }));
      const tap = host && missMode && !s.paused && !s.ended;
      return `<div class="prow ${isDealer ? 'dealer' : ''} ${missed ? 'missed' : ''} ${tap ? 'tappable' : ''}" data-flip="row-${esc(id)}" data-enter ${tap ? `data-miss="${esc(id)}" role="button" tabindex="0" aria-pressed="${missed ? 'true' : 'false'}"` : ''}>
        <span class="idx">${i + 1}</span>${avatar(p, 'sm')}
        <div class="nm"><b>${esc(p.name)}</b>${parts.length ? `<small style="${isDealer ? 'color:var(--saffron-ink);font-weight:700' : ''}">${esc(parts.join(' · '))}</small>` : ''}</div>
        ${right}</div>`;
    }).join('');
    const n = c.order.length;
    const min = n > 8 ? 42 : 44;
    return `${s.paused && !s.ended ? `<div class="note" role="status" style="margin-bottom:6px">⏸ ${esc(t('Game paused by the host'))}</div>` : ''}
      <div class="rows" style="--n:${n};--min:${min}px;--max:${n <= 6 ? 64 : 56}px">${rows}</div>
      <div style="margin-top:8px">${statusLine()}</div>`;
  }

  function standingsBody() {
    const st = K.standings(s);
    return `<div class="stack" style="gap:4px">${st.map((r) => `
      <div class="row" style="min-height:44px">
        <span class="bold" style="width:24px;text-align:center">${r.rank}</span>${avatar(r, 'sm')}
        <span class="grow bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}${r.out ? ` <span class="tiny muted">(${esc(t('sitting out'))})</span>` : ''}</span>
        ${r.gain ? `<span class="tiny bold" style="color:var(--ok)">+${r.gain}</span>` : ''}
        ${r.move ? `<span class="tiny bold" style="color:${r.move > 0 ? 'var(--ok)' : 'var(--bad)'}">${r.move > 0 ? '▲' : '▼'}${Math.abs(r.move)}</span>` : ''}
        <span class="bold" style="font-size:20px;min-width:52px;text-align:right;font-variant-numeric:tabular-nums">${r.total}</span>
      </div>`).join('')}</div>`;
  }

  function revRows(r, ps, key) {
    const ncol = ps.length + 1;
    const when = (x) => new Date(x.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (r.revs || []).slice().reverse().map((x) => `<tr style="opacity:.72">
      <td style="padding:2px 8px;white-space:nowrap;position:sticky;left:0;background:var(--card);text-align:left"><span class="tiny muted">↳ ${esc(t(x.kind === 'UNDO' ? 'undone' : 'before fix'))} ${esc(when(x))}</span></td>
      ${ps.map((p) => (p.id in x.pts ? `<td style="padding:2px 6px"><div style="text-decoration:line-through;text-decoration-thickness:2px">${x.pts[p.id]}</div><div class="tiny muted" style="text-decoration:line-through">${x.mode === 'miss' ? x.bids[p.id] + (x.won[p.id] == null ? ' ✕' : ' ✓') : x.bids[p.id] + '/' + x.won[p.id]}</div></td>` : '<td></td>')).join('')}</tr>
      <tr><td colspan="${ncol}" style="padding:0 8px 6px;text-align:left"><span class="tiny" style="color:var(--saffron-ink)">${esc(t('Reason'))}: ${esc(x.reason || '')}${x.by ? ' · ' + esc(x.by) : ''}</span></td></tr>`).join('');
  }

  function bookBody() {
    const reopened = s.cur && s.cur.revs && s.cur.revs.length;
    if (!s.rounds.length && !reopened) return `<p class="muted small">${esc(t('No rounds saved yet.'))}</p>`;
    const ps = s.players;
    const t0 = K.totals(s);
    const head = ps.map((p) => `<th style="padding:6px 8px;min-width:58px">${esc(Array.from(p.name)[0] || '?')}<div class="tiny muted" style="font-weight:600;max-width:60px;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div></th>`).join('');
    const openRow = reopened ? `<tr><td style="padding:6px 8px;white-space:nowrap;position:sticky;left:0;background:var(--card);text-align:left"><b>${s.cur.n}</b> <span class="badge warn">${esc(t('re-opened'))}</span></td>${ps.map(() => '<td class="muted">…</td>').join('')}</tr>${revRows(s.cur, ps)}` : '';
    const rows = openRow + s.rounds.slice().reverse().map((r) => `<tr ${host ? `data-fix="${r.n}" style="cursor:pointer"` : ''}>
      <td style="padding:6px 8px;white-space:nowrap;position:sticky;left:0;background:var(--card);text-align:left"><b>${r.n}</b> <span class="tiny muted">${r.cards}${esc(t('c'))}</span> ${suitSvg(r.trump, 14)}${r.revs && r.revs.length ? ` <span class="badge warn" style="font-size:10px">${esc(t('fixed'))}</span>` : ''}</td>
      ${ps.map((p) => {
        if (!(p.id in r.pts)) return '<td class="muted">·</td>';
        const ok = r.bids[p.id] === r.won[p.id];
        return `<td style="padding:4px 6px;${ok ? '' : 'color:var(--bad)'}"><div class="bold">${r.pts[p.id]}</div><div class="tiny muted">${r.mode === 'miss' ? r.bids[p.id] + (ok ? ' ✓' : ' ✕') : r.bids[p.id] + '/' + r.won[p.id]}</div></td>`;
      }).join('')}</tr>${revRows(r, ps)}`).join('');
    return `${host ? `<p class="tiny muted" style="margin-bottom:6px">${esc(t('Tap a round to fix it. A reason is required and the old score stays in the history.'))}</p>` : ''}
      <div style="overflow-x:auto;margin:0 -4px"><table style="border-collapse:collapse;width:100%;text-align:center;font-size:15px">
      <thead><tr><th style="text-align:left;padding:6px 8px;position:sticky;left:0;background:var(--card)">${esc(t('Round'))}</th>${head}</tr></thead><tbody>${rows}
      <tr style="border-top:2px solid var(--felt)"><td style="padding:8px;text-align:left;position:sticky;left:0;background:var(--card)"><b>${esc(t('Total'))}</b></td>${ps.map((p) => `<td class="bold" style="font-size:17px">${t0[p.id]}</td>`).join('')}</tr></tbody></table></div>`;
  }

  function finalBlock() {
    const st = K.standings(s), st2 = K.stats(s);
    const win = st.filter((r) => r.rank === 1);
    return `<section class="card saffron center slidein" style="margin-bottom:10px">
      <div class="tiny muted">${esc(t('Game over'))}</div>
      <div style="font-size:26px;font-weight:700;margin:4px 0">🏆 ${esc(win.map((w) => w.name).join(' & '))}</div>
      <div class="muted">${win[0] ? win[0].total : 0} ${esc(t('points'))} · ${s.rounds.length} ${esc(t('rounds'))}${st2.perfectRounds ? ` · ${esc(t('Perfect rounds'))}: ${st2.perfectRounds}` : ''}</div>
      <button class="btn dark block" style="margin-top:10px" data-act="sharepic">${icon('share', 18)} ${esc(t('Share picture'))}</button>
      ${host && !ctx.locked ? `<button class="btn ghost block" style="margin-top:8px" data-act="modify">${icon('log', 18)} ${esc(t('Modify a round (reason required)'))}</button>` : ''}
      ${host && ctx.canLock ? `<button class="btn primary block" style="margin-top:8px" data-act="lockroom">${icon('lock', 18)} ${esc(t('Finish and lock room'))}</button>` : ''}
      ${host && !ctx.locked ? `<button class="btn ghost block" style="margin-top:8px" data-act="rematch">${esc(t('Rematch'))}</button>` : ''}
      ${ctx.locked ? `<div class="tiny muted" style="margin-top:8px">${icon('lock', 12, 2)} ${esc(t('Room locked. Final scores.'))}</div>` : ''}
    </section>`;
  }

  function scoresPane() {
    return `${s.ended ? finalBlock() : ''}
      <div class="card" style="margin-bottom:10px"><h2 style="margin-bottom:6px">${esc(t('Standings'))}</h2>${standingsBody()}</div>
      <div class="card"><div class="row between" style="margin-bottom:6px"><h2>${esc(t('Round book'))}</h2><span class="badge">${s.rounds.length}</span></div>${bookBody()}</div>`;
  }

  function morePane() {
    const row = (id, ic, label, sub, danger) => menuRow({ id, icon: ic, label, sub, danger });
    return `<div class="menulist">
      ${host && !s.ended ? row('seats', 'users', 'Seats and players', t('{n} at the table', { n: s.players.filter((p) => !p.out).length })) : ''}
      ${host && !s.ended ? row('pause', s.paused ? 'play' : 'pause', s.paused ? 'Resume game' : 'Pause game') : ''}
      ${host && s.ended && !ctx.locked ? row('modify', 'log', 'Modify a round', t('Reason required')) : ''}
      ${host && !s.ended ? row('settings', 'gear', 'Scoring and visibility', `${s.config.scoring.zero} · ${s.config.scoring.mult}× · ${s.config.scoring.miss}`) : ''}
      ${row('stats', 'flag', 'Stats')}
      ${row('log', 'log', 'Change log')}
      ${host && !s.ended ? row('end', 'trophy', 'End game', '', true) : ''}
    </div>`;
  }

  function dockHtml() {
    const tabs = [{ id: 'play', label: 'Play', icon: 'grid' }, { id: 'scores', label: 'Scores', icon: 'trophy' }, { id: 'more', label: 'More', icon: 'gear' }];
    if (!host) return dock({ tabs, active: ui.tab, viewer: true });
    let action = '', extra = '';
    const c = s.cur;
    if (s.ended) { if (!ctx.locked) action = `<button class="dockbtn" data-act="modify">${icon('log', 20)} ${esc(t('Modify'))}</button>`; }
    else if (s.paused) action = `<button class="dockbtn" data-act="pause">${icon('play', 20)} ${esc(t('Resume game'))}</button>`;
    else if (c) {
      extra = `<button class="dockundo" data-act="undo" aria-label="${esc(t('Undo'))}">${icon('undo', 22)}</button>`;
      if (!c.locked) {
        const n = Object.keys(c.bids).length, prob = K.lockProblem(c);
        const label = prob ? t('Total = cards') : (n < c.order.length ? `${t('Lock')} ${n}/${c.order.length}` : t('Lock bids'));
        action = `<button class="dockbtn" data-act="lock" ${prob ? 'disabled' : ''}>${prob ? '' : icon('lock', 20)} ${esc(label)}</button>`;
      } else {
        const ok = K.canSaveRound(c);
        action = `<button class="dockbtn" data-act="save" ${ok ? '' : 'disabled'}>${ok ? icon('check', 20) + ' ' + esc(t('Save round')) : (c.mode === 'miss' ? esc(t('Someone must miss')) : esc(t('Tricks {a} of {b}', { a: K.wonTotal(c), b: c.cards })))}</button>`;
      }
    }
    return dock({ tabs, active: ui.tab, action, extra });
  }

  // ---------- render ----------
  let lastN = null;

  /** The row that was on top slides in an arc to the bottom (new dealer) while the others step up. */
  function arcRotate(before) {
    const rows = [...root.querySelectorAll('.prow[data-flip]')];
    let best = null, bestDy = -40;
    rows.forEach((el) => { const b = before.get(el.dataset.flip); if (!b) return; const now = el.getBoundingClientRect(); const dy = b.top - now.top; if (dy < bestDy) { bestDy = dy; best = { el, dx: b.left - now.left, dy }; } });
    if (!best || typeof best.el.animate !== 'function') return;
    const { el, dx, dy } = best;
    const amp = Math.min(70, el.getBoundingClientRect().width * 0.18);
    el.style.position = 'relative'; el.style.zIndex = '5';
    const a = el.animate([
      { transform: `translate(${dx}px,${dy}px)`, boxShadow: '0 0 0 transparent' },
      { transform: `translate(${dx + amp}px,${dy * 0.45}px) scale(1.05) rotate(2.5deg)`, boxShadow: '0 14px 28px #0003', offset: 0.5 },
      { transform: 'none', boxShadow: '0 0 0 transparent' }
    ], { duration: 950, easing: 'cubic-bezier(.45,.05,.3,1)' });
    const end = () => { el.style.position = ''; el.style.zIndex = ''; el.classList.add('dealerpulse'); setTimeout(() => el.classList.remove('dealerpulse'), 950); };
    a.onfinish = end; a.oncancel = end;
  }

  function roundBanner() {
    const c = s.cur; if (!c) return;
    const b = document.createElement('div'); b.className = 'rbanner';
    b.textContent = `${t('Round {n}', { n: c.n })} · ${suitName(c.trump)} · ${t('Dealer')}: ${player(c.dealerId).name}`;
    document.body.appendChild(b); setTimeout(() => b.remove(), 2600);
  }

  /** A card back shrinks in, flips to show the trump, then flies into the thumbnail. Tap to skip. */
  function revealTrump(key) {
    const W = 96, H = 134;
    const layer = document.createElement('div'); layer.className = 'reveal-layer'; layer.style.perspective = '900px';
    const card = document.createElement('div'); card.className = 'reveal-card';
    card.style.cssText = `width:${W}px;height:${H}px;margin-left:${-W / 2}px`;
    card.innerHTML = `<div class="face back"></div><div class="face front">${suitSvg(key, 56, CARD_COLOR[key])}<small>${esc(suitName(key))}</small></div>`;
    layer.appendChild(card); document.body.appendChild(layer);
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true; layer.remove();
      const tc = root.querySelector('.strip .tcard'); if (tc) { tc.classList.add('pulse'); setTimeout(() => tc.classList.remove('pulse'), 650); }
    };
    card.addEventListener('click', finish);
    const a = card.animate([
      { transform: 'scale(.2) rotateY(0deg)', opacity: 0 },
      { transform: 'scale(1) rotateY(0deg)', opacity: 1, offset: 0.25 },
      { transform: 'scale(1.06) rotateY(180deg)', opacity: 1, offset: 0.62 },
      { transform: 'scale(1.06) rotateY(180deg)', opacity: 1 }
    ], { duration: 1500, fill: 'forwards', easing: 'ease-out' });
    a.onfinish = () => {
      if (finished) return;
      const tc = root.querySelector('.strip .tcard'), r = card.getBoundingClientRect();
      if (!tc || !r.width) return finish();
      const t2 = tc.getBoundingClientRect();
      const dx = t2.left + t2.width / 2 - (r.left + r.width / 2), dy = t2.top + t2.height / 2 - (r.top + r.height / 2), sc = t2.width / (W * 1.06);
      const f = card.animate([{ transform: 'scale(1.06) rotateY(180deg)' }, { transform: `translate(${dx}px,${dy}px) scale(${sc * 1.06}) rotateY(180deg)` }], { duration: 560, fill: 'forwards', easing: 'cubic-bezier(.5,0,.8,.4)' });
      f.onfinish = finish;
    };
    setTimeout(finish, 3800);
  }

  function render() {
    if (destroyed) return;
    const pane = ui.tab === 'scores' ? scoresPane() : ui.tab === 'more' ? morePane() : (s.ended ? scoresPane() : playPane());
    const html = layout({ strip: s.ended ? '' : strip(), lb: chips(K.standings(s)), pane, dock: dockHtml(), fill: ui.tab === 'play' && !s.ended });
    const advanced = lastN != null && s.cur && s.cur.n > lastN && !s.ended;
    const fancy = advanced && fancyMotion();
    let before = null;
    if (fancy && ui.tab === 'play') { before = new Map(); root.querySelectorAll('.prow[data-flip]').forEach((el) => before.set(el.dataset.flip, el.getBoundingClientRect())); }
    const drawn = safeRender(root, () => { root.innerHTML = html; });
    if (drawn === false) return;
    if (s.cur) lastN = s.cur.n;
    if (advanced) {
      if (before && before.size) arcRotate(before);
      else if (animLevel() !== 'off' && ui.tab !== 'play') roundBanner();
      if (fancy) revealTrump(s.cur.trump);
    }
  }

  // ---------- number pad ----------
  function openPad(id) {
    const c = s.cur; if (!c) return;
    const kind = c.locked ? 'won' : 'bid';
    const forbid = kind === 'bid' && id === c.dealerId ? K.forbiddenBid(c, id) : null;
    const cur = kind === 'bid' ? c.bids[id] : c.won[id];
    const sh = openSheet(`<h2>${esc(player(id).name)} · ${esc(t(kind === 'bid' ? 'Bid' : 'Tricks won'))}</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${Array.from({ length: c.cards + 1 }, (_, n) => `
        <button class="btn ${n === cur ? 'dark' : 'ghost'}" style="min-height:56px;font-size:22px" data-n="${n}" ${n === forbid ? 'disabled' : ''}>${n}</button>`).join('')}</div>
      ${forbid != null ? `<p class="note" style="margin-top:10px">${esc(t('Dealer cannot bid {n}', { n: forbid }))}</p>` : ''}`);
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]'); if (!b) return;
      setValue(id, kind, +b.dataset.n); sh.close();
    });
  }
  function setValue(id, kind, n) { buzz(8); commit((st) => (kind === 'bid' ? K.setBid(st, id, n) : K.setWon(st, id, n))); }

  function stepValue(id, kind, dir) {
    const c = s.cur; const cur = kind === 'bid' ? c.bids[id] : c.won[id];
    let n = cur == null ? (dir > 0 ? 0 : 0) : cur + dir;
    if (kind === 'bid' && id === c.dealerId) { const f = K.forbiddenBid(c, id); if (n === f) n += dir; }
    if (n < 0 || n > c.cards) return;
    setValue(id, kind, n);
  }

  // ---------- sheets ----------
  function seatsSheet() {
    openSeatsSheet({
      get: () => ({ players: s.players, locked: !K.canChangePlayers(s), total: K.totals(s), regulars: ctx.regulars || [], dealerId: s.cur && s.cur.dealerId }),
      onMove: (a, b) => commit((st) => K.reorder(st, a, b)),
      onShuffle: () => commit((st) => K.shuffleSeats(st)),
      onOut: (id, out) => commit((st) => K.setOut(st, id, out)),
      onAdd: (name, start) => { ctx.rememberRegular && ctx.rememberRegular(name); commit((st) => K.addPlayer(st, name, start)); },
      startChoices: true,
      warnAdd: () => { const w = K.maxChangeIfPlayers(s, 1); return w.from !== w.to ? t('Max cards per round changes from {a} to {b}.', { a: w.from, b: w.to }) : null; }
    });
  }

  function fixSheet(n) {
    const r = s.rounds.find((x) => x.n === n); if (!r) return;
    const missMode = r.mode === 'miss';
    const bids = { ...r.bids }, won = { ...r.won };
    let why = '';
    const sh = openSheet('');
    const valid = () => why.trim().length >= 3 && (missMode ? r.order.some((id) => won[id] == null) : Object.values(won).reduce((a, b) => a + b, 0) === r.cards);
    const draw = () => {
      const tot = Object.values(won).reduce((a, b) => a + (b || 0), 0);
      const resCell = (id) => (missMode
        ? `<div class="center"><div class="tiny muted">${esc(t('Result'))}</div><button class="hitpill ${won[id] == null ? 'miss' : 'hit'}" data-tg="${id}">${won[id] == null ? '✕ ' + esc(t('Miss')) : '✓ ' + esc(t('Hit'))}</button></div>`
        : `<div class="center"><div class="tiny muted">${esc(t('Won'))}</div><div class="stepper"><button data-f="w-${id}" data-d="-1">${icon('minus', 18)}</button><span class="val">${won[id]}</span><button class="plus" data-f="w-${id}" data-d="1">${icon('plus', 18)}</button></div></div>`);
      sh.setHtml(`<h2>${esc(t('Fix round'))} ${r.n} · ${esc(t('{n} cards', { n: r.cards }))}</h2>
        <div class="stack">${r.order.map((id) => `<div class="plrow">${avatar(player(id))}<div class="grow bold">${esc(player(id).name)}</div>
          <div class="center"><div class="tiny muted">${esc(t('Bid'))}</div><div class="stepper"><button data-f="b-${id}" data-d="-1">${icon('minus', 18)}</button><span class="val">${bids[id]}</span><button class="plus" data-f="b-${id}" data-d="1">${icon('plus', 18)}</button></div></div>
          ${resCell(id)}</div>`).join('')}</div>
        <p class="${missMode ? (r.order.some((id) => won[id] == null) ? 'muted' : 'note') : (tot === r.cards ? 'muted' : 'note')} small" style="margin:10px 0">${missMode ? esc(t('At least one player must miss.')) : esc(t('Tricks {a} of {b}', { a: tot, b: r.cards }))}</p>
        <div class="label">${esc(t('Reason (required)'))}</div>
        <input class="input" data-why maxlength="120" value="${esc(why)}" placeholder="${esc(t('Why is this being changed?'))}" style="width:100%;margin-bottom:8px">
        <div class="row" style="gap:8px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-savefix ${valid() ? '' : 'disabled'}>${esc(t('Save'))}</button></div>`);
      const inp = sh.el.querySelector('[data-why]'), sv = sh.el.querySelector('[data-savefix]');
      inp.addEventListener('input', () => { why = inp.value; sv.disabled = !valid(); });
    };
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tg) { won[b.dataset.tg] = won[b.dataset.tg] == null ? bids[b.dataset.tg] : null; draw(); return; }
      if (b.dataset.f) {
        const [k, id] = [b.dataset.f[0], b.dataset.f.slice(2)];
        if (k === 'b') { bids[id] = Math.max(0, Math.min(r.cards, bids[id] + +b.dataset.d)); if (missMode && won[id] != null) won[id] = bids[id]; }
        else won[id] = Math.max(0, Math.min(r.cards, won[id] + +b.dataset.d));
        draw();
      }
      if ('savefix' in b.dataset && valid()) { commit((st) => K.editRound(st, r.n, bids, won, why, ctx.user && ctx.user.name), { afterEnd: true }); sh.close(); }
    });
    draw();
  }

  function modifySheet() {
    if (!s.rounds.length) { ctx.toast(t('No rounds saved yet.'), 'bad'); return; }
    const sh = openSheet(`<h2>${esc(t('Modify a round'))}</h2><p class="muted small" style="margin-bottom:8px">${esc(t('Pick the round to change. You must give a reason. The old score stays in the history, struck through.'))}</p>
      <div class="stack" style="gap:6px;max-height:52vh;overflow:auto">${s.rounds.slice().reverse().map((r) => `<button class="btn ghost block" style="justify-content:space-between" data-pick="${r.n}"><span><b>${t('Round')} ${r.n}</b> <span class="muted small">${r.cards}${esc(t('c'))}</span></span>${r.revs && r.revs.length ? `<span class="badge warn">${esc(t('fixed'))} ×${r.revs.length}</span>` : icon('right', 18)}</button>`).join('')}</div>
      <button class="btn dark block" style="margin-top:10px" data-close>${esc(t('Close'))}</button>`);
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) { sh.close(); fixSheet(+b.dataset.pick); } });
  }

  async function undoWithReason() {
    if (!host) return;
    if (!K.undoNeedsReason(s)) return commit((st) => K.undo(st));
    const last = s.rounds[s.rounds.length - 1];
    const why = await askReason({ title: `${t('Undo round')} ${last.n}`, text: t('The round is re-opened. Its old score stays in the history, struck through.'), ok: 'Undo round' });
    if (why) commit((st) => K.undo(st, why, ctx.user && ctx.user.name));
  }

  function statsSheet() {
    const st = K.stats(s);
    const line = (label, x, extra) => (x ? `<div class="row between"><span>${esc(t(label))}</span><span class="bold">${esc(x.name)} <span class="muted small">${extra}</span></span></div>` : '');
    openSheet(`<h2>${esc(t('Stats'))}</h2><div class="stack">
      ${line('Sharpest bidder', st.sharpest, st.sharpest ? st.sharpest.exact + '/' + st.sharpest.played : '')}
      ${line('Longest exact streak', st.streak, st.streak ? st.streak.bestStreak : '')}
      ${line('Bold bidder', st.bold, st.bold ? (st.bold.bidSum / st.bold.played).toFixed(1) + ' ' + t('avg') : '')}
      <div class="row between"><span>${esc(t('Perfect rounds'))}</span><span class="bold">${st.perfectRounds}</span></div>
      ${s.rounds.length < 2 ? `<p class="muted small">${esc(t('Stats appear after a few rounds.'))}</p>` : ''}
      </div><button class="btn dark block" style="margin-top:12px" data-close>${esc(t('Done'))}</button>`);
  }

  function settingsSheet() {
    let cfg = JSON.parse(JSON.stringify(s.config));
    const sh = openSheet('');
    const row = (label, key) => `<div class="row between"><span>${esc(t(label))}</span><div class="stepper"><button data-sc="${key}" data-d="-1">${icon('minus', 18)}</button><span class="val" style="min-width:44px">${cfg.scoring[key]}</span><button class="plus" data-sc="${key}" data-d="1">${icon('plus', 18)}</button></div></div>`;
    const draw = () => sh.setHtml(`<h2>${esc(t('Settings'))}</h2><div class="stack">
      <div class="label">${esc(t('Scoring'))}</div>
      ${row('Zero bid hit', 'zero')}${row('Exact bid points', 'mult')}${row('Missed bid', 'miss')}
      <p class="tiny muted">${esc(t('Exact bid points'))}: n × ${cfg.scoring.mult}</p>
      <div class="label" style="margin-top:6px">${esc(t('Max cards per hand'))}</div>
      <div class="row between"><span class="small muted">${cfg.maxCards ? esc(t('Capped at {n}', { n: cfg.maxCards })) : esc(t('Automatic: {n} (52 ÷ players)', { n: K.maxCardsAuto(s) }))}</span>
        <div class="stepper"><button data-mc="-1">${icon('minus', 18)}</button><span class="val" style="min-width:44px">${cfg.maxCards || K.maxCardsAuto(s)}</span><button class="plus" data-mc="1">${icon('plus', 18)}</button><button class="chip btnlike" data-mc="auto" style="margin-left:6px">${esc(t('Auto'))}</button></div></div>
      <div class="label" style="margin-top:6px">${esc(t('After locking, enter results by'))}</div>
      <div class="seg"><button class="${cfg.entry !== 'tricks' ? 'on' : ''}" data-ent="miss">${esc(t('Tapping misses'))}</button><button class="${cfg.entry === 'tricks' ? 'on' : ''}" data-ent="tricks">${esc(t('Tricks won'))}</button></div>
      <div class="label" style="margin-top:6px">${esc(t('Show bids to viewers'))}</div>
      <div class="seg"><button class="${cfg.revealBids === 'live' ? 'on' : ''}" data-rev="live">${esc(t('As they are entered'))}</button><button class="${cfg.revealBids === 'after' ? 'on' : ''}" data-rev="after">${esc(t('After locking'))}</button></div>
      <div class="note info">${esc(t('Scoring changes apply to rounds you save from now on. Fix old rounds from the Round book.'))}</div>
      <button class="btn primary block" data-save>${esc(t('Save'))}</button>
      ${host ? `<button class="btn danger block" data-end>${esc(t('End game'))}</button>` : ''}</div>`);
    sh.el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sc) { const k = b.dataset.sc; cfg.scoring[k] = Math.max(0, cfg.scoring[k] + +b.dataset.d); draw(); }
      if (b.dataset.rev) { cfg.revealBids = b.dataset.rev; draw(); }
      if (b.dataset.ent) { cfg.entry = b.dataset.ent; draw(); }
      if (b.dataset.mc) {
        const auto = K.maxCardsAuto(s);
        if (b.dataset.mc === 'auto') cfg.maxCards = null;
        else { const v = (cfg.maxCards || auto) + +b.dataset.mc; cfg.maxCards = v >= auto ? null : Math.max(2, v); }
        draw();
      }
      if ('save' in b.dataset) { commit((st) => K.setConfig(st, cfg)); sh.close(); }
      if ('end' in b.dataset) { sh.close(); if (await confirmSheet({ title: t('End the game?'), text: t('Scores stay saved. You can start a rematch afterwards.'), ok: 'End game', danger: true })) commit((st) => K.endGame(st)); }
    });
    draw();
  }

  function logSheet() {
    openSheet(`<h2>${esc(t('Change log'))}</h2><div class="stack" style="gap:6px;margin-bottom:12px">${s.log.length ? s.log.slice(0, 40).map((l) => `<div class="small"><span class="muted">${new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> · ${esc(t(l.txt))}</div>`).join('') : '<p class="muted small">–</p>'}</div><button class="btn dark block" data-close>${esc(t('Done'))}</button>`);
  }

  function lapSheet(lap) {
    const sum = K.lapSummary(s, lap);
    const sh = openSheet(`<h2>🏁 ${esc(t('Lap {n} finished', { n: lap }))}</h2>
      <div class="stack" style="gap:6px;margin-bottom:12px">${sum.rows.map((r) => `<div class="row" style="min-height:44px"><span class="bold" style="width:24px">${r.rank}</span>${avatar(r, 'sm')}<span class="grow bold">${esc(r.name)}</span><span class="tiny" style="color:var(--ok)">+${r.gain}</span><span class="bold" style="min-width:52px;text-align:right;font-size:19px">${r.total}</span></div>`).join('')}</div>
      <p class="muted small" style="margin-bottom:10px">${sum.best ? esc(t('Best lap: {name} (+{n})', { name: sum.best.name, n: sum.best.gain })) : ''}</p>
      <div class="row" style="gap:8px"><button class="btn ghost grow" data-share>${icon('share', 18)} ${esc(t('Share picture'))}</button><button class="btn primary grow" data-close>${esc(t('Continue'))}</button></div>`);
    sh.el.querySelector('[data-share]').addEventListener('click', () => shareCard(t('Lap {n} finished', { n: lap }), sum.rows));
  }

  function shareCard(title, rows) {
    const st = K.stats(s), hl = [];
    if (st.sharpest) hl.push(`🎯 ${t('Sharpest bidder')}: ${st.sharpest.name} (${st.sharpest.exact}/${st.sharpest.played})`);
    if (st.streak && st.streak.bestStreak > 1) hl.push(`🔥 ${t('Longest exact streak')}: ${st.streak.name} (${st.streak.bestStreak})`);
    if (st.perfectRounds) hl.push(`⭐ ${t('Perfect rounds')}: ${st.perfectRounds}`);
    ctx.shareCard({ title, subtitle: `${t('Kachuful')} · ${s.rounds.length} ${t('rounds')}`, rows: rows.map((r) => ({ rank: r.rank, name: r.name, total: r.total, gain: r.gain })), highlights: hl });
  }

  // ---------- events ----------
  root.addEventListener('click', async (e) => {
    const mr = e.target.closest('[data-miss]');
    if (mr && root.contains(mr) && !e.target.closest('button')) { if (host) { buzz(12); commit((st) => K.toggleMiss(st, mr.dataset.miss)); } return; }
    const b = e.target.closest('button, tr[data-fix]'); if (!b || !root.contains(b)) return;
    if (b.dataset.tab) { ui.tab = b.dataset.tab; buzz(6); render(); const pn = root.querySelector('[data-pane]'); if (pn) pn.scrollTop = 0; return; }
    if (b.dataset.m) {
      const m = b.dataset.m;
      if (m === 'seats') return seatsSheet();
      if (m === 'pause') return commit((st) => K.setPaused(st, !st.paused));
      if (m === 'settings') return settingsSheet();
      if (m === 'stats') return statsSheet();
      if (m === 'modify') return modifySheet();
      if (m === 'log') return logSheet();
      if (m === 'end') { if (await confirmSheet({ title: t('End the game?'), text: t('Scores stay saved. You can start a rematch afterwards.'), ok: 'End game', danger: true })) { commit((st) => K.endGame(st)); ui.tab = 'scores'; render(); } return; }
    }
    if (b.dataset.inc) return stepValue(b.dataset.inc, s.cur.locked ? 'won' : 'bid', 1);
    if (b.dataset.dec) return stepValue(b.dataset.dec, s.cur.locked ? 'won' : 'bid', -1);
    if (b.dataset.pad && host) return openPad(b.dataset.pad);
    if (b.dataset.fix && host) return fixSheet(+b.dataset.fix);
    const a = b.dataset.act; if (!a) return;
    if (a === 'seats') return seatsSheet();
    if (a === 'undo') return undoWithReason();
    if (a === 'modify') return modifySheet();
    if (a === 'pause') return commit((st) => K.setPaused(st, !st.paused));
    if (a === 'stats') return statsSheet();
    if (a === 'settings') return settingsSheet();
    if (a === 'lock') return commit((st) => K.lockBids(st));
    if (a === 'save') {
      if (!host) return;
      const res = K.saveRound(s);
      apply(res.state);
      if (res.lapDone) setTimeout(() => lapSheet(res.lapDone), 350);
      return;
    }
    if (a === 'lockroom') return ctx.lockRoom && ctx.lockRoom();
    if (a === 'sharepic') return shareCard(t('Game over'), K.standings(s));
    if (a === 'rematch') {
      if (await confirmSheet({ title: t('Start a rematch?'), text: t('Same players and seats, scores back to zero.'), ok: 'Rematch' })) {
        const names = s.players.filter((p) => !p.out).map((p) => ({ name: p.name }));
        apply(K.newGame({ names, config: s.config }));
      }
    }
  });

  render();
  return {
    update(next) { // a new state arrived (viewer) or a state was replaced from outside (host on another device)
      const prevLap = K.currentLap(s);
      const prevRounds = s.rounds.length;
      s = next;
      render();
      if (!host && K.currentLap(s) > prevLap && s.rounds.length > prevRounds) lapSheet(K.currentLap(s) - 1);
    },
    destroy() { destroyed = true; root.innerHTML = ''; }
  };
}
