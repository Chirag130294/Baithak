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
      return { scoring: { zero: v('zero'), mult: v('mult'), miss: v('miss') }, revealBids: rev ? rev.dataset.rev : 'live' };
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

  mount: mountKachuful
};
