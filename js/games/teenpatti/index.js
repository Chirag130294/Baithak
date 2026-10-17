// Teen Patti add-on: chip ledger with a "settle up" list.
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { suitSvg, avatar, openSheet, icon } from '../../core/ui.js';
import { createBoardView, standingsHtml, tableHtml } from '../../core/board.js';
import * as E from './engine.js';

registerStrings('gu', { 'Teen Patti': 'તીન પત્તી', 'Add hand': 'હાથ ઉમેરો', 'Boot': 'બૂટ', 'Settle up': 'હિસાબ પતાવો', 'Pot': 'પોટ', 'Winner': 'વિજેતા', 'pays': 'આપે', 'chips': 'ચિપ્સ' });

function handSheet(api) {
  const s = api.s, boot = s.config.boot, rows = s.players.filter((p) => !p.out);
  const put = {}; rows.forEach((p) => { put[p.id] = boot; });
  let winner = null;
  const sh = openSheet('');
  const draw = () => {
    const pot = Object.values(put).reduce((a, b) => a + b, 0);
    sh.setHtml(`<h2>${esc(t('Add hand'))} ${s.rounds.length + 1}</h2>
      <p class="muted small" style="margin-bottom:8px">${esc(t('Chips each player put in (boot, blinds and bets). Then tap the winner.'))}</p>
      <div class="stack">${rows.map((p) => `<div class="plrow" style="${winner === p.id ? 'border:2px solid var(--saffron);background:#FFF9E8' : ''}">${avatar(p)}<div class="grow bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
        <div class="stepper"><button data-d="-1" data-id="${esc(p.id)}">${icon('minus', 18)}</button><input class="input" style="width:70px;height:44px;text-align:center;font-size:18px" type="number" inputmode="numeric" data-put="${esc(p.id)}" value="${put[p.id]}"><button class="plus" data-d="1" data-id="${esc(p.id)}">${icon('plus', 18)}</button></div>
        <button class="chip btnlike" data-win="${esc(p.id)}" style="${winner === p.id ? 'background:var(--saffron);border-color:var(--saffron)' : ''}">${winner === p.id ? '🏆' : esc(t('Winner'))}</button></div>`).join('')}</div>
      <div class="row between" style="margin:10px 0"><b>${esc(t('Pot'))}</b><b style="font-size:22px">${pot}</b></div>
      <div class="row" style="gap:8px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok ${winner && pot ? '' : 'disabled'}>${esc(t('Save'))}</button></div>`);
  };
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d) { put[b.dataset.id] = Math.max(0, put[b.dataset.id] + (+b.dataset.d) * boot); draw(); }
    if (b.dataset.win) { winner = b.dataset.win; draw(); }
    if ('ok' in b.dataset) { api.commit((st) => E.addHand(st, put, winner)); sh.close(); }
  });
  sh.el.addEventListener('change', (e) => { const i = e.target.closest('[data-put]'); if (i) { put[i.dataset.put] = Math.max(0, Math.round(+i.value || 0)); draw(); } });
  draw();
}

export default {
  id: 'teenpatti', prefix: 'TP', name: 'Teen Patti', tag: 'Chip ledger',
  icon: suitSvg('D', 26), blurb: 'Pot, winner and who owes whom',
  minPlayers: 2, maxPlayers: 10,
  setup: {
    html(cfg = {}) { return `<div class="card stack"><h2>Teen Patti</h2><div class="row between"><span>${esc(t('Boot'))} (${esc(t('chips'))})</span><input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-f="boot" value="${cfg.boot || 10}"></div></div>`; },
    read(root) { return { boot: Math.max(1, parseInt(root.querySelector('[data-f="boot"]').value, 10) || 10) }; }
  },
  create: ({ players, config }) => E.newGame({ names: players, config }),
  summary(s) { const rows = E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total })); return { title: 'Teen Patti', line: `${s.rounds.length} hands`, rows, done: s.ended }; },
  mount(root, ctx) {
    const name = (s, id) => (s.players.find((p) => p.id === id) || { name: '?' }).name;
    return createBoardView(root, ctx, {
      engine: E, unit: '',
      sections: (s) => {
        const pays = E.settle(s);
        return [
          { id: 'standings', title: esc(t('Standings')), body: standingsHtml(E.standings(s), '', (n) => (n > 0 ? '+' + n : String(n))) },
          { id: 'settle', title: esc(t('Settle up')), open: false, body: pays.length ? `<div class="stack" style="gap:6px">${pays.map((p) => `<div class="row"><b>${esc(name(s, p.from))}</b><span class="muted">${esc(t('pays'))}</span><b>${esc(name(s, p.to))}</b><span class="grow"></span><b style="font-size:19px">${p.amount}</b></div>`).join('')}</div>` : `<p class="muted small">${esc(t('Everyone is square.'))}</p>` },
          { id: 'rounds', title: esc(t('Hands')), extra: `<span class="badge">${s.rounds.length}</span>`,
            body: s.rounds.length ? tableHtml(['#', esc(t('Winner')), esc(t('Pot'))], s.rounds.slice().reverse().map((h) => ({ cells: [`<b>${h.n}</b>`, esc(name(s, h.winnerId)), String(h.pot)] }))) : `<p class="muted small">${esc(t('No hands yet.'))}</p>` }
        ];
      },
      action: () => `<button class="btn primary" data-act="add">${esc(t('Add hand'))}</button>`,
      final: (s) => `<section class="card saffron center"><div class="tiny muted">${esc(t('Game over'))}</div><div style="font-size:26px;font-weight:700">🏆 ${esc(E.standings(s)[0].name)}</div></section>`,
      onClick(b, api) { if (b.dataset.act === 'add') handSheet(api); }
    });
  }
};
