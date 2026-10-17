// Score Book add-on: a plain points table for any game.
import '../../core/i18n.js';
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { icon } from '../../core/ui.js';
import { createBoardView, standingsHtml, tableHtml, openNumberSheet } from '../../core/board.js';
import * as E from './engine.js';

registerStrings('gu', { 'Score Book': 'સ્કોર બુક', 'Add round': 'રાઉન્ડ ઉમેરો', 'Points': 'ગુણ', 'Highest total wins': 'વધુ ગુણ જીતે', 'Lowest total wins': 'ઓછા ગુણ જીતે' });

export default {
  id: 'scorebook', prefix: 'SB', name: 'Score Book', tag: 'Any game',
  icon: icon('log', 26), blurb: 'Points table for any game',
  minPlayers: 2, maxPlayers: 12,
  setup: {
    html() {
      return `<div class="card stack"><h2>${esc(t('Who wins?'))}</h2>
        <div class="seg"><button type="button" class="on" data-win="high">${esc(t('Highest total wins'))}</button><button type="button" data-win="low">${esc(t('Lowest total wins'))}</button></div></div>`;
    },
    bind(root) { root.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => root.querySelectorAll('[data-win]').forEach((x) => x.classList.toggle('on', x === b)))); },
    read(root) { return { lowWins: !!root.querySelector('[data-win="low"].on') }; }
  },
  create: ({ players, config }) => E.newGame({ names: players, config }),
  summary(s) { const rows = E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total })); return { title: 'Score Book', line: `${s.rounds.length} rounds`, rows, done: s.ended }; },
  mount(root, ctx) {
    return createBoardView(root, ctx, {
      engine: E, unit: '',
      sections: (s, host) => [
        { id: 'standings', title: esc(t('Standings')), body: standingsHtml(E.standings(s)) },
        { id: 'rounds', title: esc(t('Round book')), extra: `<span class="badge">${s.rounds.length}</span>`,
          body: s.rounds.length ? tableHtml([esc(t('Round')), ...s.players.map((p) => esc(Array.from(p.name)[0] || '?'))],
            s.rounds.slice().reverse().map((r) => ({ attrs: host ? `data-edit="${r.n}" style="cursor:pointer"` : '', cells: [`<b>${r.n}</b>`, ...s.players.map((p) => (p.id in r.pts ? String(r.pts[p.id]) : '·'))] })),
            [esc(t('Total')), ...s.players.map((p) => String(E.totals(s)[p.id]))]) : `<p class="muted small">${esc(t('No rounds saved yet.'))}</p>` }
      ],
      action: () => `<button class="btn primary" data-act="add">${icon('plus', 20)} ${esc(t('Add round'))}</button>`,
      final: (s) => `<section class="card saffron center"><div class="tiny muted">${esc(t('Game over'))}</div><div style="font-size:26px;font-weight:700">🏆 ${esc(E.standings(s).filter((r) => r.rank === 1).map((r) => r.name).join(' & '))}</div></section>`,
      onClick(b, api) {
        if (b.dataset.act === 'add') openNumberSheet({ title: t('Add round') + ' ' + (api.s.rounds.length + 1), rows: api.s.players.filter((p) => !p.out), onSave: (pts) => api.commit((st) => E.addRound(st, pts)) });
        if (b.dataset.edit && api.host) { const r = api.s.rounds.find((x) => x.n === +b.dataset.edit); openNumberSheet({ title: t('Fix round') + ' ' + r.n, rows: api.s.players.filter((p) => p.id in r.pts), initial: r.pts, onSave: (pts) => api.commit((st) => E.editRound(st, r.n, pts)) }); }
      }
    });
  }
};
