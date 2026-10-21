// Kali Tiri add-on: score book for the 3-of-spades team game. Pick the bidder, partner, bid, trump and result.
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { suitSvg, avatar, openSheet, suitName, CARD_COLOR, buzz } from '../../core/ui.js';
import { createBoardView, standingsHtml, bookHtml } from '../../core/board.js';
import { boardDescribe } from '../../core/audit.js';
import { validReason, cleanReason } from '../../core/reason.js';
import * as E from './engine.js';

registerStrings('gu', { 'Kali Tiri': 'કાળી ટીરી', 'Bidder': 'બોલી લગાવનાર', 'Partner': 'સાથી', 'Alone': 'એકલા', 'Bid': 'બોલી', 'Trump': 'ટ્રમ્પ', 'Made': 'જીત્યા', 'Failed': 'હાર્યા', 'Double': 'ડબલ', 'Trump team': 'ટ્રમ્પ ટીમ', 'Add round': 'રાઉન્ડ ઉમેરો' });

const numInput = (k, v) => `<input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-f="${k}" value="${v}">`;

function describeRound(r, st) {
  const nm = (id) => (st.players.find((p) => p.id === id) || { name: '?' }).name;
  return `${nm(r.bidder)}${r.partner ? ' + ' + nm(r.partner) : ' alone'} bid ${r.bid}${r.trump ? ' (' + r.trump + ')' : ''}, ${r.made ? 'made it' : 'failed, opposition scores double'}`;
}

/** One sheet for adding a round or fixing one. `r0` = the round being fixed (or null). */
function roundSheet(api, r0) {
  const s = api.s, cfg = s.config, players = s.players.filter((p) => !p.out);
  const v = r0 ? { bidder: r0.bidder, partner: r0.partner, bid: r0.bid, trump: r0.trump, made: r0.made } : { bidder: null, partner: null, bid: cfg.minBid, trump: null, made: null };
  let why = '';
  const sh = openSheet('');
  const chip = (attr, val, label, on, extra = '') => `<button type="button" class="chip btnlike ${on ? 'on' : ''}" style="${on ? 'background:var(--felt);color:#fff;border-color:var(--felt)' : ''}${extra}" ${attr}="${esc(val)}">${label}</button>`;
  const draw = () => {
    const prob = E.roundProblem(s, v);
    const pts = !prob ? E.scoreRound(s, v) : null;
    const preview = pts ? players.filter((p) => pts[p.id]).map((p) => `${esc(p.name)} ${pts[p.id] > 0 ? '+' : ''}${pts[p.id]}`).join(' · ') : '';
    const bids = []; for (let b = cfg.minBid; b <= cfg.maxBid; b += cfg.step) bids.push(b);
    sh.setHtml(`<h2>${esc(r0 ? t('Fix round') + ' ' + r0.n : t('Round') + ' ' + (s.rounds.length + 1))}</h2><div class="stack" style="gap:12px">
      <div><div class="label">${esc(t('Bidder'))}</div><div class="row wrap" style="gap:6px">${players.map((p) => chip('data-bidder', p.id, esc(p.name), v.bidder === p.id)).join('')}</div></div>
      <div><div class="label">${esc(t('Partner'))}</div><div class="row wrap" style="gap:6px">${chip('data-partner', '', esc(t('Alone')), !v.partner)}${players.filter((p) => p.id !== v.bidder).map((p) => chip('data-partner', p.id, esc(p.name), v.partner === p.id)).join('')}</div></div>
      <div><div class="label">${esc(t('Bid'))}: <b data-bidv style="font-size:20px">${v.bid}</b></div>
        <div class="row" style="gap:8px;align-items:center"><button class="iconbtn light" data-bstep="-1" aria-label="-">−</button><input type="range" data-brange min="${cfg.minBid}" max="${cfg.maxBid}" step="${cfg.step}" value="${v.bid}" style="flex:1"><button class="iconbtn light" data-bstep="1" aria-label="+">+</button></div>
        <div class="row wrap" style="gap:6px;margin-top:6px">${(cfg.decks === 2 ? [cfg.minBid, 350, 400, 450, cfg.maxBid] : [cfg.minBid, 180, 200, 220, cfg.maxBid]).filter((b, i, a) => b >= cfg.minBid && b <= cfg.maxBid && a.indexOf(b) === i).map((b) => chip('data-bid', b, String(b), v.bid === b)).join('')}</div></div>
      <div><div class="label">${esc(t('Trump'))}</div><div class="row wrap" style="gap:6px">${chip('data-trump', '', esc(t('Not noted')), !v.trump)}${E.SUITS.map((k) => chip('data-trump', k, `<span style="display:inline-flex;align-items:center;gap:5px">${suitSvg(k, 16, v.trump === k ? '#fff' : CARD_COLOR[k])}${esc(suitName(k))}</span>`, v.trump === k)).join('')}</div></div>
      <div><div class="label">${esc(t('Trump team'))}</div><div class="seg"><button type="button" class="${v.made === true ? 'on' : ''}" data-made="1">${esc(t('Made'))}</button><button type="button" class="${v.made === false ? 'on' : ''}" data-made="0">${esc(t('Failed'))} · ${esc(t('opposition x{n}', { n: cfg.defenderMult }))}</button></div></div>
      ${preview ? `<div class="note info">${esc(t('Points'))}: ${preview}</div>` : (prob ? `<div class="note">${esc(t(prob))}</div>` : '')}
      ${r0 ? `<div><div class="label">${esc(t('Reason (required)'))}</div><input class="input" data-why maxlength="120" value="${esc(why)}" placeholder="${esc(t('Why is this being changed?'))}" style="width:100%"></div>` : ''}
      <div class="row" style="gap:8px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok ${prob || (r0 && !validReason(why)) ? 'disabled' : ''}>${esc(t(r0 ? 'Save' : 'Save round'))}</button></div></div>`);
    const w = sh.el.querySelector('[data-why]'); if (w) w.addEventListener('input', () => { why = w.value; sh.el.querySelector('[data-ok]').disabled = !!E.roundProblem(s, v) || !validReason(why); });
    const rg = sh.el.querySelector('[data-brange]'); if (rg) rg.addEventListener('input', () => { v.bid = +rg.value; sh.el.querySelector('[data-bidv]').textContent = v.bid; });
    if (rg) rg.addEventListener('change', draw);
  };
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if ('bidder' in d) { v.bidder = d.bidder; if (v.partner === v.bidder) v.partner = null; buzz(6); return draw(); }
    if ('partner' in d) { v.partner = d.partner || null; return draw(); }
    if ('bid' in d) { v.bid = +d.bid; return draw(); }
    if ('bstep' in d) { v.bid = Math.max(cfg.minBid, Math.min(cfg.maxBid, v.bid + +d.bstep * cfg.step)); return draw(); }
    if ('trump' in d) { v.trump = d.trump || null; return draw(); }
    if ('made' in d) { v.made = d.made === '1'; return draw(); }
    if ('ok' in d && !E.roundProblem(s, v)) {
      if (r0) { if (!validReason(why)) return; api.commit((st) => E.editRound(st, r0.n, v, cleanReason(why), api.user()), { afterEnd: true }); }
      else api.commit((st) => E.addRound(st, v));
      sh.close();
    }
  });
  draw();
}

export default {
  id: 'kalitiri', prefix: 'KT', name: 'Kali Tiri', tag: 'Team game',
  icon: suitSvg('S', 26), blurb: 'Trump team scores its bid, opposition scores double',
  minPlayers: 4, maxPlayers: 6,
  setup: {
    html(cfg = {}) {
      const c = { ...E.DEFAULTS, ...cfg };
      return `<div class="card stack"><h2>Kali Tiri</h2>
        <div class="label">${esc(t('Cards'))}</div>
        <div class="seg"><button type="button" class="${c.decks === 1 ? 'on' : ''}" data-decks="1">${esc(t('1 deck (150 to 250)'))}</button><button type="button" class="${c.decks === 2 ? 'on' : ''}" data-decks="2">${esc(t('2 decks bundle (300 to 500)'))}</button></div>
        <div class="row between"><span>${esc(t('Lowest bid'))}</span>${numInput('minBid', c.minBid)}</div>
        <div class="row between"><span>${esc(t('Highest bid'))}</span>${numInput('maxBid', c.maxBid)}</div>
        <div class="row between"><span>${esc(t('Bid steps of'))}</span>${numInput('step', c.step)}</div>
        <div class="row between"><span>${esc(t('Opposition multiplier when they win'))}</span>${numInput('defenderMult', c.defenderMult)}</div>
        <div class="row between"><span>${esc(t('Trump team loses the bid when it fails'))}</span><button type="button" class="switch" data-penalty role="switch" aria-checked="false"><i></i></button></div>
        <p class="tiny muted">${esc(t('Trump team makes its bid: each member scores the bid. Opposition wins: each of them scores double.'))}</p></div>`;
    },
    bind(root) {
      const sw = root.querySelector('[data-penalty]'); if (sw) sw.addEventListener('click', () => { const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); });
      root.querySelectorAll('[data-decks]').forEach((b) => b.addEventListener('click', () => {
        root.querySelectorAll('[data-decks]').forEach((x) => x.classList.toggle('on', x === b));
        const r = E.DECK_RANGE[b.dataset.decks]; Object.entries(r).forEach(([k, v]) => { root.querySelector(`[data-f="${k}"]`).value = v; });
      }));
    },
    read(root) {
      const v = (k, d) => Math.max(1, parseInt(root.querySelector(`[data-f="${k}"]`).value, 10) || d);
      const min = v('minBid', 150), max = Math.max(min, v('maxBid', 250));
      return { decks: root.querySelector('[data-decks="2"].on') ? 2 : 1, minBid: min, maxBid: max, step: v('step', 5), defenderMult: v('defenderMult', 2), penalty: !!root.querySelector('[data-penalty].on') };
    }
  },
  create: ({ players, config }) => E.newGame({ names: players, config }),
  summary(s) { const rows = E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total })); return { title: 'Kali Tiri', line: `${s.rounds.length} rounds`, rows, done: s.ended }; },
  describe: (prev, next) => boardDescribe(prev, next, describeRound),
  mount(root, ctx) {
    return createBoardView(root, ctx, {
      engine: E, unit: '',
      sections: (s, host) => {
        const nm = (id) => (s.players.find((p) => p.id === id) || { name: '?' }).name;
        const st = E.stats(s).filter((x) => x.bids || x.partner);
        return [
          { id: 'standings', title: esc(t('Standings')), body: standingsHtml(E.standings(s)), open: true },
          { id: 'rounds', title: esc(t('Round book')), extra: `<span class="badge">${s.rounds.length}</span>`,
            body: s.rounds.length || (s.voided && s.voided.length) ? bookHtml(s, { head: [esc(t('Round')), esc(t('Trump team')), esc(t('Bid')), ...s.players.map((p) => esc(Array.from(p.name)[0] || '?'))], host,
              cells: (r) => [`<span class="small">${esc(nm(r.bidder))}${r.partner ? ' + ' + esc(nm(r.partner)) : ''}</span>${r.trump ? ' ' + suitSvg(r.trump, 13, CARD_COLOR[r.trump]) : ''}`, `<b>${r.bid}</b>${!r.made ? ` <span class="badge warn" style="font-size:10px">×${s.config.defenderMult}</span>` : ''}<div class="tiny" style="color:${r.made ? 'var(--ok)' : 'var(--bad)'}">${esc(t(r.made ? 'Made' : 'Failed'))}</div>`,
                ...s.players.map((p) => (p.id in r.pts ? (r.pts[p.id] ? String(r.pts[p.id]) : '·') : '·'))],
              attrOf: (r) => `data-edit="${r.n}" style="cursor:pointer"`,
              foot: [esc(t('Total')), '', '', ...s.players.map((p) => String(E.totals(s)[p.id]))] }) : `<p class="muted small">${esc(t('No rounds saved yet.'))}</p>` },
          ...(st.length ? [{ id: 'stats', title: esc(t('Stats')), body: `<div class="stack" style="gap:6px">${st.map((x) => `<div class="row"><b class="grow">${esc(x.name)}</b><span class="small muted">${t('bid')} ${x.bids} · ${t('made')} ${x.made} · ${t('partner')} ${x.partner}${x.defWins ? ' · ' + t('opposition wins') + ' ' + x.defWins : ''}</span></div>`).join('')}</div>` }] : [])
        ];
      },
      action: () => `<button class="btn primary" data-act="add">${esc(t('Add round'))}</button>`,
      final: (s) => `<section class="card saffron center"><div class="tiny muted">${esc(t('Game over'))}</div><div style="font-size:26px;font-weight:700">🏆 ${esc(E.standings(s).filter((r) => r.rank === 1).map((r) => r.name).join(' & '))}</div>${ctx.locked ? `<div class="tiny muted" style="margin-top:6px">${esc(t('Room locked. Final scores.'))}</div>` : ''}</section>`,
      modify: (api, n) => { const r = api.s.rounds.find((x) => x.n === n); if (r) roundSheet(api, r); },
      onClick(b, api) {
        if (b.dataset.act === 'add') roundSheet(api, null);
        if (b.dataset.edit && api.host) roundSheet(api, api.s.rounds.find((x) => x.n === +b.dataset.edit));
      }
    });
  }
};
