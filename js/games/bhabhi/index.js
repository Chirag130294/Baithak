// Bhabhi add-on: tap who ended up as the Bhabhi. Fewest wins.
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { suitSvg, avatar, openSheet } from '../../core/ui.js';
import { createBoardView, standingsHtml } from '../../core/board.js';
import * as E from './engine.js';

registerStrings('gu', { 'Bhabhi': 'ભાભી', 'Who is the Bhabhi?': 'ભાભી કોણ બન્યું?', 'Add game': 'રમત ઉમેરો', 'times': 'વખત' });

export default {
  id: 'bhabhi', prefix: 'BH', name: 'Bhabhi', tag: 'Last one holding',
  icon: suitSvg('C', 26), blurb: 'Who got stuck as Bhabhi',
  minPlayers: 3, maxPlayers: 8,
  setup: { html: () => '', read: () => ({}) },
  create: ({ players, config }) => E.newGame({ names: players, config }),
  summary(s) { const rows = E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total })); return { title: 'Bhabhi', line: `${s.rounds.length} games`, rows, done: s.ended }; },
  mount(root, ctx) {
    return createBoardView(root, ctx, {
      engine: E, unit: '×',
      sections: (s) => {
        const st = E.streaks(s), c = E.counts(s);
        const worst = [...s.players].sort((a, b) => c[b.id] - c[a.id])[0];
        return [
          { id: 'standings', title: esc(t('Standings')), body: standingsHtml(E.standings(s), '×') + (s.rounds.length && c[worst.id] ? `<p class="small muted" style="margin-top:8px">${esc(t('Most Bhabhi'))}: <b>${esc(worst.name)}</b> (${c[worst.id]}${(st[worst.id] || 0) > 1 ? ', ' + esc(t('longest streak')) + ' ' + st[worst.id] : ''})</p>` : '') },
          { id: 'rounds', title: esc(t('History')), extra: `<span class="badge">${s.rounds.length}</span>`,
            body: s.rounds.length ? `<div class="stack" style="gap:4px">${s.rounds.slice().reverse().map((r) => `<div class="row"><span class="muted" style="width:28px">#${r.n}</span><b>${esc((s.players.find((p) => p.id === r.bhabhi) || { name: '?' }).name)}</b></div>`).join('')}</div>` : `<p class="muted small">${esc(t('No games yet.'))}</p>` }
        ];
      },
      action: () => `<button class="btn primary" data-act="add">${esc(t('Add game'))}</button>`,
      final: (s) => `<section class="card saffron center"><div class="tiny muted">${esc(t('Game over'))}</div><div style="font-size:26px;font-weight:700">🏆 ${esc(E.standings(s)[0].name)}</div></section>`,
      onClick(b, api) {
        if (b.dataset.act === 'add') {
          const sh = openSheet(`<h2>${esc(t('Who is the Bhabhi?'))}</h2><div class="stack">${api.s.players.filter((p) => !p.out).map((p) => `<button class="plrow" style="width:100%;text-align:left" data-b="${esc(p.id)}">${avatar(p)}<span class="bold" style="font-size:17px">${esc(p.name)}</span></button>`).join('')}</div>`);
          sh.el.addEventListener('click', (e) => { const x = e.target.closest('[data-b]'); if (x) { api.commit((st) => E.addGame(st, x.dataset.b)); sh.close(); } });
        }
      }
    });
  }
};
