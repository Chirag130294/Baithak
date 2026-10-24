// Kachuful add-on. Everything for this game lives in this folder (engine, screen, words).
// Delete the folder (and its id in js/core/games.js) and the rest of the app keeps working.
import './strings.js';
import { esc } from '../../core/util.js';
import { t } from '../../core/i18n.js';
import { suitSvg } from '../../core/ui.js';
import * as K from './engine.js';
import { mountKachuful } from './view.js';

export default {
  id: 'kachuful', prefix: 'KF', name: 'Kachuful', tag: 'Score book',
  icon: suitSvg('S', 26),
  blurb: 'Bid, win tricks, 1 to max and back',
  minPlayers: 3, maxPlayers: 10,

  setup: {
    html(cfg = {}) {
      const sc = { ...K.DEFAULT_CONFIG.scoring, ...(cfg.scoring || {}) };
      return `<div class="card stack">
        <h2>${esc(t('Scoring'))}</h2>
        <div class="row between"><span>${esc(t('Zero bid hit'))}</span><input class="input" style="width:84px;text-align:center" type="number" inputmode="numeric" min="0" data-sc="zero" value="${sc.zero}"></div>
        <div class="row between"><span>${esc(t('Exact bid points'))} (n ×)</span><input class="input" style="width:84px;text-align:center" type="number" inputmode="numeric" min="0" data-sc="mult" value="${sc.mult}"></div>
        <div class="row between"><span>${esc(t('Missed bid'))}</span><input class="input" style="width:84px;text-align:center" type="number" inputmode="numeric" min="0" data-sc="miss" value="${sc.miss}"></div>
        <div class="row between"><span>${esc(t('Max cards per hand'))}</span><input class="input" style="width:84px;text-align:center" type="number" inputmode="numeric" min="2" max="26" data-mc placeholder="${esc(t('Auto'))}" value="${cfg.maxCards || ''}"></div>
        <p class="tiny muted">${esc(t('Leave blank for automatic: 52 divided by players (5 players = 10, 6 players = 8).'))}</p>
        <div class="label">${esc(t('Show bids to viewers'))}</div>
        <div class="seg"><button type="button" class="on" data-rev="live">${esc(t('As they are entered'))}</button><button type="button" data-rev="after">${esc(t('After locking'))}</button></div>
      </div>`;
    },
    bind(root) {
      root.querySelectorAll('[data-rev]').forEach((b) => b.addEventListener('click', () => {
        root.querySelectorAll('[data-rev]').forEach((x) => x.classList.toggle('on', x === b));
      }));
    },
    read(root) {
      const v = (k) => Math.max(0, parseInt(root.querySelector(`[data-sc="${k}"]`).value, 10) || 0);
      const rev = root.querySelector('[data-rev].on');
      const mc = parseInt(root.querySelector('[data-mc]').value, 10);
      return { scoring: { zero: v('zero'), mult: v('mult'), miss: v('miss') }, revealBids: rev ? rev.dataset.rev : 'live', maxCards: mc >= 2 ? Math.min(26, mc) : null };
    }
  },

  create({ players, config }) {
    return K.newGame({ names: players, config });
  },

  summary(s) {
    const rows = K.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total }));
    const lap = K.currentLap(s);
    return {
      title: 'Kachuful',
      line: s.ended ? `Finished · ${s.rounds.length} rounds` : `Round ${s.cur ? s.cur.n : s.rounds.length} · Lap ${lap}${s.paused ? ' · paused' : ''}`,
      rows, done: !!s.ended
    };
  },

  describe(prev, next) {
    const out = [], pr = prev.rounds.length, nr = next.rounds.length;
    const nm = (st, id) => (st.players.find((p) => p.id === id) || {}).name || id;
    if (nr > pr) { const r = next.rounds[nr - 1]; out.push({ action: 'SCORE', summary: `Round ${r.n} saved: ` + r.order.map((id) => `${nm(next, id)} bid ${r.bids[id]} won ${r.won[id]} = ${r.pts[id]}`).join(', ') }); }
    else if (nr < pr) out.push({ action: 'UNDO', summary: `Round ${prev.rounds[pr - 1].n} re-opened (undo)${next.cur && next.cur.revs && next.cur.revs.length ? ' — reason: ' + next.cur.revs[next.cur.revs.length - 1].reason : ''}` });
    else {
      prev.rounds.forEach((r, i) => { const x = next.rounds[i]; if (x && JSON.stringify([r.bids, r.won]) !== JSON.stringify([x.bids, x.won])) out.push({ action: 'EDIT', summary: `Round ${x.n} corrected: ` + x.order.map((id) => `${nm(next, id)} ${x.bids[id]}/${x.won[id]}=${x.pts[id]}`).join(', ') + (x.revs && x.revs.length ? ` — reason: ${x.revs[x.revs.length - 1].reason}` : '') }); });
      if (prev.cur && next.cur && !prev.cur.locked && next.cur.locked) out.push({ action: 'LOCK_BIDS', summary: `Round ${next.cur.n} bids locked: ` + next.cur.order.map((id) => `${nm(next, id)} ${next.cur.bids[id] ?? 0}`).join(', ') });
      if (prev.cur && next.cur && prev.cur.locked && !next.cur.locked) out.push({ action: 'UNDO', summary: `Round ${next.cur.n} bids unlocked (undo)` });
    }
    if (!!prev.paused !== !!next.paused) out.push({ action: 'PAUSE', summary: next.paused ? 'Game paused' : 'Game resumed' });
    if (prev.players.length !== next.players.length) out.push({ action: 'PLAYERS', summary: 'Players changed' });
    if (!prev.ended && next.ended) out.push({ action: 'END', summary: 'Game ended' });
    return out;
  },
  mount: mountKachuful
};
