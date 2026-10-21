// Bhabhi add-on: tap who ended up as the Bhabhi. Fewest wins.
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { suitSvg, avatar, openSheet } from '../../core/ui.js';
import { boardDescribe } from '../../core/audit.js';
import { askReason } from '../../core/reason.js';
import { createBoardView, bookHtml, standingsHtml } from '../../core/board.js';
import * as E from './engine.js';

registerStrings('gu', { 'Bhabhi': 'ભાભી', 'Who is the Bhabhi?': 'ભાભી કોણ બન્યું?', 'Add game': 'રમત ઉમેરો', 'times': 'વખત' });

export default {
  id: 'bhabhi', prefix: 'BH', name: 'Bhabhi', tag: 'Last one holding',
  icon: suitSvg('C', 26), blurb: 'Who got stuck as Bhabhi',
  minPlayers: 3, maxPlayers: 8,
  setup: { html: () => '', read: () => ({}) },
  create: ({ players, config }) => E.newGame({ names: players, config }),
  summary(s) { const rows = E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total })); return { title: 'Bhabhi', line: `${s.rounds.length} games`, rows, done: s.ended }; },
  describe: (prev, next) => boardDescribe(prev, next, (r, st) => `${(st.players.find((p) => p.id === r.bhabhi) || { name: '?' }).name} is the Bhabhi`),
  mount(root, ctx) {
    return createBoardView(root, ctx, {
      engine: E, unit: '×',
      sections: (s) => {
        const api0 = { host: ctx.isHost };
        const st = E.streaks(s), c = E.counts(s);
        const worst = [...s.players].sort((a, b) => c[b.id] - c[a.id])[0];
        return [
          { id: 'standings', title: esc(t('Standings')), body: standingsHtml(E.standings(s), '×') + (s.rounds.length && c[worst.id] ? `<p class="small muted" style="margin-top:8px">${esc(t('Most Bhabhi'))}: <b>${esc(worst.name)}</b> (${c[worst.id]}${(st[worst.id] || 0) > 1 ? ', ' + esc(t('longest streak')) + ' ' + st[worst.id] : ''})</p>` : '') },
          { id: 'rounds', title: esc(t('History')), extra: `<span class="badge">${s.rounds.length}</span>`,
            body: s.rounds.length || (s.voided && s.voided.length) ? bookHtml(s, { head: [esc(t('Game')), esc(t('Bhabhi'))], host: api0.host, label: (r) => `<b>#${r.n}</b>`,
              cells: (r) => [esc((s.players.find((p) => p.id === r.bhabhi) || { name: '?' }).name)], attrOf: (r) => `data-edit="${r.n}" style="cursor:pointer"` }) : `<p class="muted small">${esc(t('No games yet.'))}</p>` }
        ];
      },
      action: () => `<button class="btn primary" data-act="add">${esc(t('Add game'))}</button>`,
      final: (s) => `<section class="card saffron center"><div class="tiny muted">${esc(t('Game over'))}</div><div style="font-size:26px;font-weight:700">🏆 ${esc(E.standings(s)[0].name)}</div></section>`,
      modify: (api, n) => {
        const r = api.s.rounds.find((x) => x.n === n); if (!r) return;
        let pick = r.bhabhi, why = '';
        const sh = openSheet('');
        const draw = () => {
          const ok = pick !== r.bhabhi && why.trim().length >= 3;
          sh.setHtml(`<h2>${esc(t('Game'))} #${r.n} · ${esc(t('Who is the Bhabhi?'))}</h2><div class="stack" style="gap:6px;margin-bottom:10px">${api.s.players.filter((p) => !p.out || p.id === r.bhabhi).map((p) => `<button class="plrow" style="width:100%;text-align:left;${p.id === pick ? 'outline:2px solid var(--saffron)' : ''}" data-b="${esc(p.id)}">${avatar(p)}<span class="bold grow">${esc(p.name)}</span>${p.id === r.bhabhi ? `<span class="badge">${esc(t('now'))}</span>` : ''}</button>`).join('')}</div>
            <div class="label">${esc(t('Reason (required)'))}</div><input class="input" data-why maxlength="120" value="${esc(why)}" style="width:100%;margin-bottom:10px" placeholder="${esc(t('Why is this being changed?'))}">
            <div class="row" style="gap:8px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok ${ok ? '' : 'disabled'}>${esc(t('Save'))}</button></div>`);
          sh.el.querySelector('[data-why]').addEventListener('input', (e) => { why = e.target.value; sh.el.querySelector('[data-ok]').disabled = !(pick !== r.bhabhi && why.trim().length >= 3); });
        };
        sh.el.addEventListener('click', (e) => {
          const x = e.target.closest('[data-b]'); if (x) { pick = x.dataset.b; draw(); return; }
          if (e.target.closest('[data-ok]') && pick !== r.bhabhi && why.trim().length >= 3) { api.commit((st) => E.editGame(st, r.n, pick, why, api.user()), { afterEnd: true }); sh.close(); }
        });
        draw();
      },
      onClick(b, api) {
        if (b.dataset.edit && api.host) return api.modify(+b.dataset.edit);
        if (b.dataset.act === 'add') {
          const sh = openSheet(`<h2>${esc(t('Who is the Bhabhi?'))}</h2><div class="stack">${api.s.players.filter((p) => !p.out).map((p) => `<button class="plrow" style="width:100%;text-align:left" data-b="${esc(p.id)}">${avatar(p)}<span class="bold" style="font-size:17px">${esc(p.name)}</span></button>`).join('')}</div>`);
          sh.el.addEventListener('click', (e) => { const x = e.target.closest('[data-b]'); if (x) { api.commit((st) => E.addGame(st, x.dataset.b)); sh.close(); } });
        }
      }
    });
  }
};
