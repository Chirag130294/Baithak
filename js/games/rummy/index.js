// Rummy add-on: points rummy and pool rummy score book.
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { suitSvg, avatar, openSheet } from '../../core/ui.js';
import { createBoardView, standingsHtml, bookHtml, openNumberSheet } from '../../core/board.js';
import { boardDescribe } from '../../core/audit.js';
import * as E from './engine.js';

registerStrings('gu', { 'Rummy': 'રમી', 'Win': 'જીત', 'Drop': 'ડ્રોપ', 'Middle drop': 'મિડલ ડ્રોપ', 'Count': 'ગણતરી', 'Add round': 'રાઉન્ડ ઉમેરો', 'Pool target': 'પૂલ લક્ષ્ય' });

function entrySheet(api) {
  const s = api.s, cfg = s.config, rows = E.playing(s);
  const entries = {};
  const sh = openSheet('');
  const chip = (id, kind, label, on) => `<button class="chip btnlike" style="${on ? 'background:var(--felt);color:#fff;border-color:var(--felt)' : ''}" data-k="${kind}" data-id="${esc(id)}">${esc(label)}</button>`;
  const draw = () => {
    const prob = E.roundProblem(entries, rows.map((p) => p.id));
    sh.setHtml(`<h2>${esc(t('Round'))} ${s.rounds.length + 1}</h2><div class="stack">${rows.map((p) => {
      const e = entries[p.id];
      return `<div class="card stack" style="padding:10px"><div class="row">${avatar(p)}<b class="grow">${esc(p.name)}</b><span class="badge ${e ? 'ok' : ''}">${e ? E.pointsFor(e, cfg) : '–'}</span></div>
        <div class="row wrap" style="gap:6px">${chip(p.id, 'win', t('Win') + ' 0', e && e.kind === 'win')}${chip(p.id, 'drop', t('Drop') + ' ' + cfg.drop, e && e.kind === 'drop')}${chip(p.id, 'middle', t('Middle drop') + ' ' + cfg.middle, e && e.kind === 'middle')}
        <input class="input" style="width:92px;height:44px;font-size:16px;text-align:center" type="number" inputmode="numeric" placeholder="${esc(t('Count'))}" data-count="${esc(p.id)}" value="${e && e.kind === 'count' ? e.value : ''}"></div></div>`;
    }).join('')}</div>
    ${prob ? `<p class="note" style="margin-top:10px">${esc(t(prob))}</p>` : ''}
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok ${prob ? 'disabled' : ''}>${esc(t('Save round'))}</button></div>`);
  };
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) { entries[b.dataset.id] = { kind: b.dataset.k }; draw(); }
    if ('ok' in b.dataset) { api.commit((st) => E.addRound(st, entries)); sh.close(); }
  });
  sh.el.addEventListener('change', (e) => { const i = e.target.closest('[data-count]'); if (!i) return; if (i.value === '') delete entries[i.dataset.count]; else entries[i.dataset.count] = { kind: 'count', value: i.value }; draw(); });
  draw();
}

export default {
  id: 'rummy', prefix: 'RM', name: 'Rummy', tag: 'Points / pool',
  icon: suitSvg('H', 26), blurb: 'Points or pool, drop 20, middle 40',
  minPlayers: 2, maxPlayers: 8,
  setup: {
    html(cfg = {}) {
      const c = { ...E.DEFAULTS, ...cfg };
      return `<div class="card stack"><h2>Rummy</h2>
        <div class="seg"><button type="button" class="on" data-pool="1">${esc(t('Pool'))}</button><button type="button" data-pool="0">${esc(t('Points'))}</button></div>
        <div class="row between"><span>${esc(t('Pool target'))}</span><input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-f="target" value="${c.target}"></div>
        <div class="row between"><span>${esc(t('Drop'))}</span><input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-f="drop" value="${c.drop}"></div>
        <div class="row between"><span>${esc(t('Middle drop'))}</span><input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-f="middle" value="${c.middle}"></div>
        <div class="row between"><span>${esc(t('Highest count per round'))}</span><input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-f="cap" value="${c.cap}"></div></div>`;
    },
    bind(root) { root.querySelectorAll('[data-pool]').forEach((b) => b.addEventListener('click', () => root.querySelectorAll('[data-pool]').forEach((x) => x.classList.toggle('on', x === b)))); },
    read(root) {
      const v = (k) => Math.max(0, parseInt(root.querySelector(`[data-f="${k}"]`).value, 10) || 0);
      return { pool: !!root.querySelector('[data-pool="1"].on'), target: v('target') || 201, drop: v('drop'), middle: v('middle'), cap: v('cap') || 80 };
    }
  },
  create: ({ players, config }) => E.newGame({ names: players, config }),
  summary(s) { const rows = E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total })); return { title: 'Rummy', line: `${s.rounds.length} rounds${s.config.pool ? ' · pool ' + s.config.target : ''}`, rows, done: s.ended }; },
  describe: (prev, next) => boardDescribe(prev, next, (r, st) => st.players.filter((p) => p.id in r.pts).map((p) => `${p.name} ${r.kinds && r.kinds[p.id] === 'win' ? 'won' : r.pts[p.id]}`).join(', ')),
  mount(root, ctx) {
    const wrapped = { ...E, standings: E.withMoves };
    return createBoardView(root, ctx, {
      engine: wrapped, unit: 'pts',
      header: (s) => (s.config.pool ? `<div class="note info">${esc(t('Pool target'))}: <b>${s.config.target}</b> · ${esc(t('Reach it and you are out. Last player standing wins.'))}</div>` : ''),
      sections: (s, host) => [
        { id: 'standings', title: esc(t('Standings')), body: standingsHtml(E.withMoves(s)) },
        { id: 'rounds', title: esc(t('Round book')), extra: `<span class="badge">${s.rounds.length}</span>`,
          body: s.rounds.length || (s.voided && s.voided.length) ? bookHtml(s, { head: [esc(t('Round')), ...s.players.map((p) => esc(Array.from(p.name)[0] || '?'))], host,
            cells: (r) => s.players.map((p) => (p.id in r.pts ? (r.kinds && r.kinds[p.id] === 'win' ? '<b style="color:var(--ok)">W</b>' : String(r.pts[p.id])) : '·')), attrOf: (r) => `data-edit="${r.n}" style="cursor:pointer"`,
            foot: [esc(t('Total')), ...s.players.map((p) => String(E.totals(s)[p.id]))] }) : `<p class="muted small">${esc(t('No rounds saved yet.'))}</p>` }
      ],
      action: () => `<button class="btn primary" data-act="add">${esc(t('Add round'))}</button>`,
      final: (s) => `<section class="card saffron center"><div class="tiny muted">${esc(t('Game over'))}</div><div style="font-size:26px;font-weight:700">🏆 ${esc(E.standings(s)[0].name)}</div></section>`,
      modify: (api, n) => { const r = api.s.rounds.find((x) => x.n === n); if (!r) return; openNumberSheet({ title: t('Fix round') + ' ' + r.n, note: t('Points for each player. The winner has 0.'), rows: api.s.players.filter((p) => p.id in r.pts), initial: r.pts, allowNegative: false, needReason: true, onSave: (pts, why) => api.commit((st) => E.editRound(st, r.n, pts, why, api.user()), { afterEnd: true }) }); },
      onClick(b, api) { if (b.dataset.act === 'add') entrySheet(api); if (b.dataset.edit && api.host) api.modify(+b.dataset.edit); }
    });
  }
};
