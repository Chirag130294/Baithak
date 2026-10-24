// Kali Tiri add-on: score book for the 3-of-spades team game. Pick the bidder, partner, bid, trump and result.
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { suitSvg, avatar, openSheet, suitName, CARD_COLOR, buzz, trumpCard } from '../../core/ui.js';
import { createBoardView, standingsHtml, bookHtml, finalCard } from '../../core/board.js';
import { boardDescribe } from '../../core/audit.js';
import { validReason, cleanReason } from '../../core/reason.js';
import * as E from './engine.js';

registerStrings('gu', { 'Kali Tiri': 'કાળી ટીરી', 'Bidder': 'બોલી લગાવનાર', 'Partner': 'સાથી', 'Alone': 'એકલા', 'Bid': 'બોલી', 'Trump': 'ટ્રમ્પ', 'Made': 'જીત્યા', 'Failed': 'હાર્યા', 'Double': 'ડબલ', 'Trump team': 'ટ્રમ્પ ટીમ', 'Add round': 'રાઉન્ડ ઉમેરો' });

const numInput = (k, v) => `<input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-f="${k}" value="${v}">`;

function describeRound(r, st) {
  const nm = (id) => (st.players.find((p) => p.id === id) || { name: '?' }).name;
  const ps = E.partnersOf(r);
  const open = E.isOpen(r);
  return `${nm(r.bidder)}${ps.length ? ' + ' + ps.map(nm).join(', ') : ' alone'} bid ${r.bid}${r.trump ? ' (' + r.trump + ')' : ''}, ${open ? 'result still open' : r.made ? 'made it' : 'failed, opposition scores double'}`;
}

/** A tiny worked example, used by the "what does this do?" popups. */
function exampleHtml(kind, c) {
  const cfg = { ...E.DEFAULTS, ...c };
  const bid = Math.round((cfg.minBid + cfg.maxBid) / 2 / cfg.step) * cfg.step;
  const mk = (n) => ({ n: 0, players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, out: false })), config: cfg });
  const st = mk(6);
  const r = { bidder: 'p0', partners: ['p1'], bid, made: kind === 'bonus' };
  const pts = E.scoreRound(st, r);
  const f = (v) => (v > 0 ? '+' : '') + v;
  if (kind === 'bonus') return `<p>Bid <b>${bid}</b>. Aarav bids, Binal is the partner, 4 others are the opposition. The Trump team <b>makes</b> it.</p>
    <table class="tiny" style="width:100%"><tr><td>Aarav (bidder)</td><td><b>${f(pts.p0)}</b></td><td class="muted">${bid} × ${cfg.bidderMult || 2} bonus</td></tr><tr><td>Binal (partner)</td><td><b>${f(pts.p1)}</b></td><td class="muted">just the bid</td></tr><tr><td>Everyone else</td><td><b>0</b></td><td></td></tr></table>`;
  return `<p>Bid <b>${bid}</b>. Aarav bids, Binal is the partner, 4 others are the opposition. The Trump team <b>fails</b>.</p>
    <table class="tiny" style="width:100%"><tr><td>Aarav + Binal</td><td><b>${f(pts.p0)}</b></td><td class="muted">each loses the bid</td></tr><tr><td>Each opposition player</td><td><b>${f(pts.p2)}</b></td><td class="muted">${bid} × ${cfg.defenderMult}</td></tr></table>
    <p class="tiny muted">With this switch off, the Trump team scores 0 when it fails.</p>`;
}
const explain = (title, kind, c) => { const sh = openSheet(`<h2>${esc(title)}</h2>${exampleHtml(kind, c)}<button class="btn primary block" data-close style="margin-top:12px">${esc(t('Got it'))}</button>`); return sh; };

/** One sheet for adding a round or fixing one. `r0` = the round being fixed (or null). */
function roundSheet(api, r0) {
  const s = api.s, cfg = s.config, players = s.players.filter((p) => !p.out);
  const open0 = r0 && E.isOpen(r0);
  const v = r0 ? { bidder: r0.bidder, partners: [...E.partnersOf(r0)], bid: r0.bid, trump: r0.trump, made: r0.made ?? null } : { bidder: null, partners: [], bid: cfg.minBid, trump: null, made: null };
  let why = '';
  const sh = openSheet('');
  const chip = (attr, val, label, on, extra = '') => `<button type="button" class="chip btnlike ${on ? 'on' : ''}" style="${extra}" ${attr}="${esc(val)}">${label}</button>`;
  const quick = () => { const out = []; for (let i = 0; i < 5; i++) { const b = Math.round((cfg.minBid + ((cfg.maxBid - cfg.minBid) * i) / 4) / cfg.step) * cfg.step; if (b >= cfg.minBid && b <= cfg.maxBid && !out.includes(b)) out.push(b); } return out; };
  const needWhy = () => r0 && !open0;
  const draw = () => {
    const prob = E.roundProblem(s, v);
    const team = E.teamOf(v), opp = players.filter((p) => !team.includes(p.id));
    const pts = !prob && v.made !== null ? E.scoreRound(s, v) : null;
    const preview = pts ? players.filter((p) => pts[p.id]).map((p) => `${esc(p.name)} ${pts[p.id] > 0 ? '+' : ''}${pts[p.id]}`).join(' · ') : '';
    const saveLabel = v.made === null ? t('Save, decide later') : t(r0 && !open0 ? 'Save' : 'Save round');
    sh.setHtml(`<h2>${esc(r0 ? t('Fix round') + ' ' + r0.n : t('Round') + ' ' + (s.rounds.length + 1))}</h2><div class="stack" style="gap:12px">
      <div><div class="label">${esc(t('Bidder'))}</div><div class="row wrap" style="gap:6px">${players.map((p) => chip('data-bidder', p.id, esc(p.name), v.bidder === p.id)).join('')}</div></div>
      <div><div class="label">${esc(t('Partners'))} <span class="tiny muted">${esc(t('tap everyone who joined the Trump team'))}</span></div><div class="row wrap" style="gap:6px">${chip('data-clear', '1', esc(t('Alone')), !v.partners.length)}${players.filter((p) => p.id !== v.bidder).map((p) => chip('data-partner', p.id, esc(p.name), v.partners.includes(p.id))).join('')}</div>
        <div class="tiny" style="margin-top:6px"><b>${esc(t('Trump team'))} ${team.length}</b> · <b>${esc(t('Opposition'))} ${opp.length}</b>${opp.length && opp.length <= 8 ? ` <span class="muted">(${opp.map((p) => esc(p.name)).join(', ')})</span>` : ''}</div></div>
      <div><div class="label">${esc(t('Bid'))}: <b data-bidv style="font-size:20px">${v.bid}</b></div>
        <div class="row" style="gap:8px;align-items:center"><button class="iconbtn light" data-bstep="-1" aria-label="-">−</button><input type="range" data-brange min="${cfg.minBid}" max="${cfg.maxBid}" step="${cfg.step}" value="${v.bid}" style="flex:1"><button class="iconbtn light" data-bstep="1" aria-label="+">+</button></div>
        <div class="row wrap" style="gap:6px;margin-top:6px">${quick().map((b) => chip('data-bid', b, String(b), v.bid === b)).join('')}</div></div>
      <div><div class="label">${esc(v.bidder ? t('{name} picks the trump', { name: (players.find((p) => p.id === v.bidder) || {}).name }) : t('Trump (picked by the highest bidder)'))}</div>
        <div class="trumpgrid">${['S', 'D', 'C', 'H', 'N'].map((k) => `<button type="button" class="trumpbtn ${v.trump === k ? 'on' : ''}" data-trump="${k}" aria-label="${esc(suitName(k))}">${k === 'N' ? `<span class="tcard" style="width:34px;height:48px"><i class="tc-mid" style="font-weight:800;font-size:13px;color:#44564D">NT</i></span>` : trumpCard(k, { w: 34 })}<small>${esc(suitName(k))}</small></button>`).join('')}</div></div>
      <div><div class="label">${esc(t('Result'))}</div><div class="seg"><button type="button" class="${v.made === true ? 'on' : ''}" data-made="1">${esc(t('Made'))}</button><button type="button" class="${v.made === false ? 'on' : ''}" data-made="0">${esc(t('Failed'))} · ${esc(t('opposition x{n}', { n: cfg.defenderMult }))}</button><button type="button" class="${v.made === null ? 'on' : ''}" data-made="">${esc(t('Not yet'))}</button></div></div>
      ${preview ? `<div class="note info">${esc(t('Points'))}: ${preview}</div>` : (prob ? `<div class="note">${esc(t(prob))}</div>` : '')}
      ${needWhy() ? `<div><div class="label">${esc(t('Reason (required)'))}</div><input class="input" data-why maxlength="120" value="${esc(why)}" placeholder="${esc(t('Why is this being changed?'))}" style="width:100%"></div>` : ''}
      <div class="sheet-foot"><button class="btn ghost" data-close>${esc(t('Cancel'))}</button><button class="btn primary" data-ok ${prob || (needWhy() && !validReason(why)) ? 'disabled' : ''}>${esc(saveLabel)}</button></div></div>`);
    const w = sh.el.querySelector('[data-why]'); if (w) w.addEventListener('input', () => { why = w.value; sh.el.querySelector('[data-ok]').disabled = !!E.roundProblem(s, v) || !validReason(why); });
    const rg = sh.el.querySelector('[data-brange]'); if (rg) rg.addEventListener('input', () => { v.bid = +rg.value; sh.el.querySelector('[data-bidv]').textContent = v.bid; });
    if (rg) rg.addEventListener('change', draw);
  };
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if ('bidder' in d) { v.bidder = d.bidder; v.partners = v.partners.filter((x) => x !== v.bidder); buzz(6); return draw(); }
    if ('clear' in d) { v.partners = []; return draw(); }
    if ('partner' in d) { v.partners = v.partners.includes(d.partner) ? v.partners.filter((x) => x !== d.partner) : [...v.partners, d.partner]; buzz(6); return draw(); }
    if ('bid' in d) { v.bid = +d.bid; return draw(); }
    if ('bstep' in d) { v.bid = Math.max(cfg.minBid, Math.min(cfg.maxBid, v.bid + +d.bstep * cfg.step)); return draw(); }
    if ('trump' in d) { v.trump = v.trump === d.trump ? null : d.trump; buzz(8); return draw(); }
    if ('made' in d) { v.made = d.made === '' ? null : d.made === '1'; return draw(); }
    if ('ok' in d && !E.roundProblem(s, v)) {
      if (needWhy()) { if (!validReason(why)) return; api.commit((st) => E.editRound(st, r0.n, v, cleanReason(why), api.user()), { afterEnd: true }); }
      else if (r0) api.commit((st) => E.editRound(st, r0.n, v), { afterEnd: true });
      else api.commit((st) => E.addRound(st, v));
      sh.close();
    }
  });
  draw();
}

function readCfg(root) {
  const v = (k, d) => Math.max(1, parseInt(root.querySelector(`[data-f="${k}"]`).value, 10) || d);
  const min = v('minBid', 150), max = Math.max(min, v('maxBid', 250));
  const on = (k) => !!root.querySelector(`[data-${k}].on`);
  const d = root.querySelector('[data-decks].on');
  return { decks: d ? +d.dataset.decks : 1, minBid: min, maxBid: max, step: v('step', 5), defenderMult: v('defenderMult', 2), penalty: on('penalty'), bidderBonus: on('bonus'), bidderMult: v('bidderMult', 2) };
}

export default {
  id: 'kalitiri', prefix: 'KT', name: 'Kali Tiri', tag: 'Team game',
  icon: suitSvg('S', 26), blurb: 'Trump team scores its bid, opposition scores double · up to 15 players',
  minPlayers: E.MIN_PLAYERS, maxPlayers: E.MAX_PLAYERS,
  setup: {
    html(cfg = {}) {
      const c = { ...E.DEFAULTS, ...cfg };
      const deck = (n, label, hint) => `<button type="button" class="${c.decks === n ? 'on' : ''}" data-decks="${n}"><b>${esc(label)}</b><span class="tiny" style="display:block;opacity:.75">${esc(hint)}</span></button>`;
      const sw = (k, on) => `<button type="button" class="switch ${on ? 'on' : ''}" data-${k} role="switch" aria-checked="${!!on}"><i></i></button>`;
      return `<div class="card stack"><h2>Kali Tiri</h2>
        <div class="label">${esc(t('Decks'))}</div>
        <div class="seg">${deck(1, t('1 deck'), '150–250')}${deck(2, t('2 decks'), '300–500')}${deck(3, t('3 decks'), '450–750')}</div>
        <div class="row between"><span>${esc(t('Lowest bid'))}</span>${numInput('minBid', c.minBid)}</div>
        <div class="row between"><span>${esc(t('Highest bid'))}</span>${numInput('maxBid', c.maxBid)}</div>
        <div class="row between"><span>${esc(t('Bid steps of'))}</span>${numInput('step', c.step)}</div>
        <div class="row between"><span>${esc(t('Opposition multiplier when they win'))}</span>${numInput('defenderMult', c.defenderMult)}</div>
        <div class="row between"><span>${esc(t('Bidder bonus'))} <button type="button" class="qbtn" data-why="bonus" aria-label="?">?</button></span>${sw('bonus', c.bidderBonus)}</div>
        <div class="row between" data-bonusrow style="${c.bidderBonus ? '' : 'display:none'}"><span>${esc(t('Bidder scores bid ×'))}</span>${numInput('bidderMult', c.bidderMult)}</div>
        <div class="row between"><span>${esc(t('Trump team loses points if it fails'))} <button type="button" class="qbtn" data-why="penalty" aria-label="?">?</button></span>${sw('penalty', c.penalty)}</div>
        <p class="tiny muted">${esc(t('4 to 15 players. The bidder picks any number of partners each round; everyone else is the opposition.'))}</p></div>`;
    },
    bind(root) {
      const cur = () => readCfg(root);
      const flip = (sel, after) => { const sw = root.querySelector(sel); if (sw) sw.addEventListener('click', () => { const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); after(on); }); };
      flip('[data-penalty]', (on) => { if (on) explain(t('Trump team loses points if it fails'), 'penalty', cur()); });
      flip('[data-bonus]', (on) => { root.querySelector('[data-bonusrow]').style.display = on ? '' : 'none'; if (on) explain(t('Bidder bonus'), 'bonus', cur()); });
      root.querySelectorAll('[data-why]').forEach((b) => b.addEventListener('click', () => explain(t(b.dataset.why === 'bonus' ? 'Bidder bonus' : 'Trump team loses points if it fails'), b.dataset.why, { ...cur(), penalty: true, bidderBonus: true })));
      root.querySelectorAll('[data-decks]').forEach((b) => b.addEventListener('click', () => {
        root.querySelectorAll('[data-decks]').forEach((x) => x.classList.toggle('on', x === b));
        const r = E.DECK_RANGE[b.dataset.decks]; Object.entries(r).forEach(([k, v]) => { root.querySelector(`[data-f="${k}"]`).value = v; });
      }));
    },
    read: (root) => readCfg(root)
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
              cells: (r) => [`<span class="small"><b>${esc(nm(r.bidder))}</b>${E.partnersOf(r).length ? ' + ' + E.partnersOf(r).map((id) => esc(nm(id))).join(', ') : ''}</span>${r.trump ? ' ' + suitSvg(r.trump, 13, CARD_COLOR[r.trump] || '#44564D') : ''}`, `<b>${r.bid}</b>${r.made === false ? ` <span class="badge warn" style="font-size:10px">×${s.config.defenderMult}</span>` : ''}<div class="tiny" style="color:${E.isOpen(r) ? 'var(--muted)' : r.made ? 'var(--ok)' : 'var(--bad)'}">${esc(t(E.isOpen(r) ? 'Open' : r.made ? 'Made' : 'Failed'))}</div>`,
                ...s.players.map((p) => (p.id in r.pts ? (r.pts[p.id] ? String(r.pts[p.id]) : '·') : '·'))],
              attrOf: (r) => `data-edit="${r.n}" style="cursor:pointer"`,
              foot: [esc(t('Total')), '', '', ...s.players.map((p) => String(E.totals(s)[p.id]))] }) : `<p class="muted small">${esc(t('No rounds saved yet.'))}</p>` },
          ...(st.length ? [{ id: 'stats', title: esc(t('Stats')), body: `<div class="stack" style="gap:6px">${st.map((x) => `<div class="row"><b class="grow">${esc(x.name)}</b><span class="small muted">${t('bid')} ${x.bids} · ${t('made')} ${x.made} · ${t('partner')} ${x.partner}${x.defWins ? ' · ' + t('opposition wins') + ' ' + x.defWins : ''}</span></div>`).join('')}</div>` }] : [])
        ];
      },
      action: () => `<button class="btn primary" data-act="add">${esc(t('Add round'))}</button>`,
      final: (s) => finalCard(E.standings(s), { locked: ctx.locked }),
      modify: (api, n) => { const r = api.s.rounds.find((x) => x.n === n); if (r) roundSheet(api, r); },
      onClick(b, api) {
        if (b.dataset.act === 'add') roundSheet(api, null);
        if (b.dataset.edit && api.host) roundSheet(api, api.s.rounds.find((x) => x.n === +b.dataset.edit));
      }
    });
  }
};
