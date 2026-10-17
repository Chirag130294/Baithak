// Kachuful screen. The same code draws the host view (with + / - buttons) and the viewer view (read only),
// so watchers always see exactly what the host sees: trump, cards, dealer, every bid, totals and the round book.
import { esc } from '../../core/util.js';
import { t } from '../../core/i18n.js';
import { icon, avatar, suitSvg, suitName, openSheet, confirmSheet, fold, bindFolds } from '../../core/ui.js';
import { safeRender } from '../../core/anim.js';
import { openSeatsSheet } from '../../core/seats.js';
import * as K from './engine.js';

export function mountKachuful(root, ctx) {
  let s = ctx.state;
  const host = ctx.isHost;
  const ui = { folds: { round: true, standings: true, book: false, log: false } };
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
  function commit(fn) { // host actions
    if (!host || s.ended) return;
    const next = fn(s);
    if (next && next !== s) apply(next);
  }

  // ---------- pieces ----------
  function header() {
    const c = s.cur;
    if (!c) return '';
    const dealer = player(c.dealerId);
    return `
    <section class="card felt" style="padding:14px">
      <div class="row between">
        <div>
          <div class="tiny" style="color:#CFE0D7">${esc(t('Lap {n}', { n: c.lap }))} · ${esc(t(c.dir === 'up' ? 'going up' : 'coming down'))}</div>
          <div style="font-size:26px;font-weight:700;line-height:1.1" data-anim="roundno" data-anim-val="${c.n}">${esc(t('Round {n}', { n: c.n }))}</div>
        </div>
        <div class="center" data-flip="trump" data-anim="trump" data-anim-val="${c.trump}" data-anim-cls="flipin">
          <div style="background:#fff;border-radius:14px;width:64px;height:64px;display:flex;align-items:center;justify-content:center">${suitSvg(c.trump, 40)}</div>
          <div class="tiny" style="margin-top:3px;color:#CFE0D7">${esc(t('Trump'))}: ${esc(suitName(c.trump))}</div>
        </div>
      </div>
      <div class="row wrap" style="margin-top:12px;gap:8px">
        <span class="pill" data-anim="cards" data-anim-val="${c.cards}">${icon('grid', 16)} ${esc(t(c.cards === 1 ? '{n} card' : '{n} cards', { n: c.cards }))}</span>
        <span class="pill">${esc(t('Dealer'))}: ${esc(dealer.name)}</span>
        <span class="pill">${esc(t('{n} players', { n: c.order.length }))}</span>
      </div>
    </section>`;
  }

  function leaderboard() {
    const st = K.standings(s);
    return `<section aria-label="${esc(t('Leaderboard'))}"><div style="display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x proximity">${st.map((r) => `
      <div class="row" data-flip="lb-${esc(r.id)}" style="flex:none;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;background:${r.rank === 1 ? 'var(--saffron-soft)' : '#fff'};border:${r.rank === 1 ? '2px solid var(--saffron)' : '1.5px solid var(--line2)'};scroll-snap-align:start;${r.out ? 'opacity:.55' : ''}">
        <span class="bold" style="min-width:20px;text-align:center">${r.rank}</span>
        ${avatar(r, 'sm')}
        <span class="bold" style="max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</span>
        <span class="bold" data-anim="lb-${esc(r.id)}" data-anim-val="${r.total}" style="font-variant-numeric:tabular-nums">${r.total}</span>
        ${r.move ? `<span class="tiny bold" style="color:${r.move > 0 ? 'var(--ok)' : 'var(--bad)'}">${r.move > 0 ? '↑' : '↓'}${Math.abs(r.move)}</span>` : ''}
      </div>`).join('')}</div></section>`;
  }

  function stepper(id, value, min, max, kind, forbid) {
    const shown = value == null ? '–' : value;
    return `<div class="stepper" data-kind="${kind}">
      <button type="button" data-dec="${esc(id)}" aria-label="${esc(t('Less'))}" ${value == null || value <= min ? 'disabled' : ''}>${icon('minus', 20)}</button>
      <button type="button" class="val" style="width:48px;border:0;background:none;font-size:26px;font-weight:700;font-variant-numeric:tabular-nums" data-pad="${esc(id)}" data-anim="${kind}-${esc(id)}" data-anim-val="${shown}">${shown}</button>
      <button type="button" class="plus" data-inc="${esc(id)}" aria-label="${esc(t('More'))}" ${value != null && value >= max ? 'disabled' : ''}>${icon('plus', 20)}</button>
    </div>`;
  }

  function roundBody() {
    const c = s.cur;
    if (!c) return '';
    const hideBids = !host && s.config.revealBids === 'after' && !c.locked;
    const sumB = K.bidsTotal(c);
    const bidCount = Object.keys(c.bids).length;
    const rows = c.order.map((id, i) => {
      const p = player(id), isDealer = id === c.dealerId, b = c.bids[id];
      const forbid = host && !c.locked && isDealer ? K.forbiddenBid(c, id) : null;
      let right;
      if (host && !s.paused && !s.ended) {
        right = c.locked
          ? `<div class="tiny muted" style="margin-right:4px">${esc(t('Bid'))} <b>${b}</b></div>${stepper(id, c.won[id], 0, c.cards, 'won')}`
          : stepper(id, b, 0, c.cards, 'bid', forbid);
      } else {
        const bid = hideBids ? (b != null ? '✓' : '·') : (b != null ? b : '·');
        right = `<div class="row" style="gap:12px">
          <div class="center"><div class="tiny muted">${esc(t('Bid'))}</div><div class="bold" style="font-size:22px" data-anim="vbid-${esc(id)}" data-anim-val="${bid}">${bid}</div></div>
          ${c.locked ? `<div class="center"><div class="tiny muted">${esc(t('Won'))}</div><div class="bold" style="font-size:22px" data-anim="vwon-${esc(id)}" data-anim-val="${c.won[id]}">${c.won[id]}</div></div>` : ''}
        </div>`;
      }
      return `<div data-flip="row-${esc(id)}" data-enter><div class="plrow ${isDealer ? 'dealer' : ''}">
        <span class="tiny muted" style="width:16px">${i + 1}</span>${avatar(p)}
        <div class="grow"><div class="bold" style="font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
          ${isDealer ? `<div class="tiny" style="color:var(--saffron-ink)">${esc(t('Dealer · last'))}</div>` : ''}</div>
        ${right}
      </div>${forbid != null ? `<div class="tiny bold" style="color:var(--saffron-ink);padding:3px 12px 0">${esc(t('Dealer cannot bid {n}', { n: forbid }))}</div>` : ''}</div>`;
    }).join('');

    let chip;
    if (!c.locked) {
      const diff = sumB - c.cards;
      chip = bidCount === c.order.length
        ? `<span class="badge ${diff === 0 ? 'bad' : diff > 0 ? 'warn' : 'ok'}">${esc(t('Bids {a} of {b} cards', { a: sumB, b: c.cards }))} · ${diff === 0 ? esc(t('must not match')) : diff > 0 ? esc(t('Over by {n}', { n: diff })) : esc(t('Under by {n}', { n: -diff }))}</span>`
        : `<span class="badge">${esc(t('Waiting for bids'))} ${bidCount}/${c.order.length}</span>`;
      if (hideBids) chip = `<span class="badge">${esc(t('Bids are hidden until the host locks them'))} · ${bidCount}/${c.order.length}</span>`;
    } else {
      const w = K.wonTotal(c);
      chip = `<span class="badge ${w === c.cards ? 'ok' : 'warn'}">${esc(t('Tricks {a} of {b}', { a: w, b: c.cards }))}</span>`;
    }
    return `<div class="stack">${rows}</div><div style="margin-top:10px">${chip}</div>`;
  }

  function standingsBody() {
    const st = K.standings(s);
    return `<div class="stack" style="gap:6px">${st.map((r) => `
      <div class="row" style="min-height:44px">
        <span class="bold" style="width:24px;text-align:center">${r.rank}</span>${avatar(r, 'sm')}
        <span class="grow bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}${r.out ? ` <span class="tiny muted">(${esc(t('sitting out'))})</span>` : ''}</span>
        ${r.gain ? `<span class="tiny bold" style="color:var(--ok)">+${r.gain}</span>` : ''}
        ${r.move ? `<span class="tiny bold" style="color:${r.move > 0 ? 'var(--ok)' : 'var(--bad)'}">${r.move > 0 ? '↑' : '↓'}${Math.abs(r.move)}</span>` : ''}
        <span class="bold" style="font-size:20px;min-width:52px;text-align:right;font-variant-numeric:tabular-nums">${r.total}</span>
      </div>`).join('')}</div>`;
  }

  function bookBody() {
    if (!s.rounds.length) return `<p class="muted small">${esc(t('No rounds saved yet.'))}</p>`;
    const ps = s.players;
    const t0 = K.totals(s);
    const head = ps.map((p) => `<th style="padding:6px 8px;min-width:58px">${esc(Array.from(p.name)[0] || '?')}<div class="tiny muted" style="font-weight:600;max-width:60px;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div></th>`).join('');
    const rows = s.rounds.slice().reverse().map((r) => `<tr ${host ? `data-fix="${r.n}" style="cursor:pointer"` : ''}>
      <td style="padding:6px 8px;white-space:nowrap;position:sticky;left:0;background:#fff;text-align:left"><b>${r.n}</b> <span class="tiny muted">${r.cards}${esc(t('c'))}</span> ${suitSvg(r.trump, 14)}</td>
      ${ps.map((p) => {
        if (!(p.id in r.pts)) return '<td class="muted">·</td>';
        const ok = r.bids[p.id] === r.won[p.id];
        return `<td style="padding:4px 6px;${ok ? '' : 'color:var(--bad)'}"><div class="bold">${r.pts[p.id]}</div><div class="tiny muted">${r.bids[p.id]}/${r.won[p.id]}</div></td>`;
      }).join('')}</tr>`).join('');
    return `${host ? `<p class="tiny muted" style="margin-bottom:6px">${esc(t('Tap a round to fix it'))}</p>` : ''}
      <div style="overflow-x:auto;margin:0 -4px"><table style="border-collapse:collapse;width:100%;text-align:center;font-size:15px">
      <thead><tr><th style="text-align:left;padding:6px 8px;position:sticky;left:0;background:#fff">${esc(t('Round'))}</th>${head}</tr></thead><tbody>${rows}
      <tr style="border-top:2px solid var(--felt)"><td style="padding:8px;text-align:left;position:sticky;left:0;background:#fff"><b>${esc(t('Total'))}</b></td>${ps.map((p) => `<td class="bold" style="font-size:17px">${t0[p.id]}</td>`).join('')}</tr></tbody></table></div>`;
  }

  function logBody() {
    if (!s.log.length) return '';
    return `<div class="stack" style="gap:4px">${s.log.slice(0, 20).map((l) => `<div class="small"><span class="muted">${new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> · ${esc(t(l.txt))}</div>`).join('')}</div>`;
  }

  function tools() {
    if (!host) return '';
    return `<div class="row wrap" style="gap:8px">
      <button class="chip btnlike" data-act="seats">${icon('users', 18)} ${esc(t('Seats'))}</button>
      <button class="chip btnlike" data-act="undo">${icon('undo', 18)} ${esc(t('Undo'))}</button>
      <button class="chip btnlike" data-act="pause">${icon(s.paused ? 'play' : 'pause', 18)} ${esc(t(s.paused ? 'Resume game' : 'Pause game'))}</button>
      <button class="chip btnlike" data-act="stats">${icon('flag', 18)} ${esc(t('Stats'))}</button>
      <button class="chip btnlike" data-act="settings">${icon('menu', 18)} ${esc(t('Settings'))}</button>
    </div>`;
  }

  function actionBar() {
    if (!host || s.ended || s.paused || !s.cur) return '';
    const c = s.cur;
    if (!c.locked) {
      const prob = K.lockProblem(c);
      return `<div class="actionbar">${prob ? '' : ''}<button class="btn primary" data-act="lock" ${prob ? 'disabled' : ''}>${esc(t('Lock bids and start round'))}</button></div>`;
    }
    const ok = K.canSaveRound(c);
    return `<div class="actionbar"><button class="btn primary" data-act="save" ${ok ? '' : 'disabled'}>${esc(ok ? t('Save round') : t('Tricks {a} of {b}', { a: K.wonTotal(c), b: c.cards }))}</button></div>`;
  }

  function finalBlock() {
    const st = K.standings(s), st2 = K.stats(s);
    const win = st.filter((r) => r.rank === 1);
    return `<section class="card saffron center slidein">
      <div class="tiny muted">${esc(t('Game over'))}</div>
      <div style="font-size:28px;font-weight:700;margin:4px 0">🏆 ${esc(win.map((w) => w.name).join(' & '))}</div>
      <div class="muted">${win[0] ? win[0].total : 0} ${esc(t('points'))} · ${s.rounds.length} ${esc(t('rounds'))}</div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn dark grow" data-act="sharepic">${icon('share', 18)} ${esc(t('Share picture'))}</button>
        ${host ? `<button class="btn primary grow" data-act="rematch">${esc(t('Rematch'))}</button>` : ''}
      </div>
      ${st2.perfectRounds ? `<div class="small" style="margin-top:10px">${esc(t('Perfect rounds'))}: ${st2.perfectRounds}</div>` : ''}
    </section>`;
  }

  // ---------- render ----------
  function render() {
    if (destroyed) return;
    const banner = s.paused && !s.ended ? `<div class="note slidein" role="status">⏸ ${esc(t('Game paused by the host'))}</div>` : '';
    const html = `<div class="body ${host ? 'pad-b' : ''}">
      ${banner}
      ${s.ended ? finalBlock() : ''}
      ${s.ended ? '' : header()}
      ${leaderboard()}
      ${tools()}
      ${s.ended ? '' : fold('round', esc(t('Round {n}', { n: s.cur ? s.cur.n : '' })) + ' · ' + esc(t(s.cur && s.cur.locked ? 'Tricks won' : 'Bids')), roundBody(), ui.folds.round)}
      ${fold('standings', esc(t('Standings')), standingsBody(), ui.folds.standings)}
      ${fold('book', esc(t('Round book')), bookBody(), ui.folds.book, `<span class="badge">${s.rounds.length}</span>`)}
      ${fold('log', esc(t('Change log')), logBody() || `<p class="muted small">–</p>`, ui.folds.log)}
    </div>${actionBar()}`;
    safeRender(root, () => { root.innerHTML = html; });
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
  function setValue(id, kind, n) { commit((st) => (kind === 'bid' ? K.setBid(st, id, n) : K.setWon(st, id, n))); }

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
    const bids = { ...r.bids }, won = { ...r.won };
    const sh = openSheet('');
    const draw = () => {
      const tot = Object.values(won).reduce((a, b) => a + b, 0);
      sh.setHtml(`<h2>${esc(t('Fix round'))} ${r.n} · ${esc(t('{n} cards', { n: r.cards }))}</h2>
        <div class="stack">${r.order.map((id) => `<div class="plrow">${avatar(player(id))}<div class="grow bold">${esc(player(id).name)}</div>
          <div class="center"><div class="tiny muted">${esc(t('Bid'))}</div><div class="stepper"><button data-f="b-${id}" data-d="-1">${icon('minus', 18)}</button><span class="val">${bids[id]}</span><button class="plus" data-f="b-${id}" data-d="1">${icon('plus', 18)}</button></div></div>
          <div class="center"><div class="tiny muted">${esc(t('Won'))}</div><div class="stepper"><button data-f="w-${id}" data-d="-1">${icon('minus', 18)}</button><span class="val">${won[id]}</span><button class="plus" data-f="w-${id}" data-d="1">${icon('plus', 18)}</button></div></div></div>`).join('')}</div>
        <p class="${tot === r.cards ? 'muted' : 'note'} small" style="margin:10px 0">${esc(t('Tricks {a} of {b}', { a: tot, b: r.cards }))}</p>
        <div class="row" style="gap:8px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-savefix ${tot === r.cards ? '' : 'disabled'}>${esc(t('Save'))}</button></div>`);
    };
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.f) { const [k, id] = [b.dataset.f[0], b.dataset.f.slice(2)]; const o = k === 'b' ? bids : won; o[id] = Math.max(0, Math.min(r.cards, o[id] + +b.dataset.d)); draw(); }
      if ('savefix' in b.dataset) { commit((st) => K.editRound(st, r.n, bids, won)); sh.close(); }
    });
    draw();
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
      <div class="label" style="margin-top:6px">${esc(t('Show bids to viewers'))}</div>
      <div class="seg"><button class="${cfg.revealBids === 'live' ? 'on' : ''}" data-rev="live">${esc(t('As they are entered'))}</button><button class="${cfg.revealBids === 'after' ? 'on' : ''}" data-rev="after">${esc(t('After locking'))}</button></div>
      <div class="note info">${esc(t('Scoring changes apply to rounds you save from now on. Fix old rounds from the Round book.'))}</div>
      <button class="btn primary block" data-save>${esc(t('Save'))}</button>
      ${host ? `<button class="btn danger block" data-end>${esc(t('End game'))}</button>` : ''}</div>`);
    sh.el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sc) { const k = b.dataset.sc; cfg.scoring[k] = Math.max(0, cfg.scoring[k] + +b.dataset.d); draw(); }
      if (b.dataset.rev) { cfg.revealBids = b.dataset.rev; draw(); }
      if ('save' in b.dataset) { commit((st) => K.setConfig(st, cfg)); sh.close(); }
      if ('end' in b.dataset) { sh.close(); if (await confirmSheet({ title: t('End the game?'), text: t('Scores stay saved. You can start a rematch afterwards.'), ok: 'End game', danger: true })) commit((st) => K.endGame(st)); }
    });
    draw();
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
    ctx.shareCard({ title, subtitle: `${t('Kachuful')} · ${s.rounds.length} ${t('rounds')}`, rows: rows.map((r) => ({ rank: r.rank, name: r.name, total: r.total, gain: r.gain })) });
  }

  // ---------- events ----------
  bindFolds(root, ui.folds);
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button, tr[data-fix]'); if (!b || !root.contains(b)) return;
    if (b.dataset.inc) return stepValue(b.dataset.inc, s.cur.locked ? 'won' : 'bid', 1);
    if (b.dataset.dec) return stepValue(b.dataset.dec, s.cur.locked ? 'won' : 'bid', -1);
    if (b.dataset.pad && host) return openPad(b.dataset.pad);
    if (b.dataset.fix && host) return fixSheet(+b.dataset.fix);
    const a = b.dataset.act; if (!a) return;
    if (a === 'seats') return seatsSheet();
    if (a === 'undo') return commit((st) => K.undo(st));
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
