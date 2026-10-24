// Score Book add-on: a plain points table for any game.
import '../../core/i18n.js';
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { icon } from '../../core/ui.js';
import { createBoardView, standingsHtml, bookHtml, openNumberSheet, finalCard } from '../../core/board.js';
import { boardDescribe } from '../../core/audit.js';
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
  describe: (prev, next) => boardDescribe(prev, next, (r, st) => st.players.filter((p) => p.id in r.pts).map((p) => `${p.name} ${r.pts[p.id]}`).join(', ')),
  mount(root, ctx) {
    return createBoardView(root, ctx, {
      engine: E, unit: '',
      sections: (s, host) => [
        { id: 'standings', title: esc(t('Standings')), body: standingsHtml(E.standings(s)) },
        { id: 'rounds', title: esc(t('Round book')), extra: `<span class="badge">${s.rounds.length}</span>`,
          body: s.rounds.length || (s.voided && s.voided.length) ? bookHtml(s, { head: [esc(t('Round')), ...s.players.map((p) => esc(Array.from(p.name)[0] || '?'))], host,
            cells: (r) => s.players.map((p) => (p.id in r.pts ? String(r.pts[p.id]) : '·')), attrOf: (r) => `data-edit="${r.n}" style="cursor:pointer"`,
            foot: [esc(t('Total')), ...s.players.map((p) => String(E.totals(s)[p.id]))] }) : `<p class="muted small">${esc(t('No rounds saved yet.'))}</p>` }
      ],
      action: () => `<button class="btn primary" data-act="add">${icon('plus', 20)} ${esc(t('Add round'))}</button>`,
      final: (s) => finalCard(E.standings(s), { locked: ctx.locked }),
      modify: (api, n) => { const r = api.s.rounds.find((x) => x.n === n); if (!r) return; openNumberSheet({ title: t('Fix round') + ' ' + r.n, rows: api.s.players.filter((p) => p.id in r.pts), initial: r.pts, needReason: true, onSave: (pts, why) => api.commit((st) => E.editRound(st, r.n, pts, why, api.user()), { afterEnd: true }) }); },
      onClick(b, api) {
        if (b.dataset.act === 'add') openNumberSheet({ title: t('Add round') + ' ' + (api.s.rounds.length + 1), rows: api.s.players.filter((p) => !p.out), onSave: (pts) => api.commit((st) => E.addRound(st, pts)) });
        if (b.dataset.edit && api.host) api.modify(+b.dataset.edit);
      }
    });
  }
};
