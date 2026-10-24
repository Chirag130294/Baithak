// Teen Patti add-on: live hand tracker (blind / seen / packed, chaal, pot) plus a chip ledger with "settle up".
import { esc } from '../../core/util.js';
import { t, registerStrings } from '../../core/i18n.js';
import { suitSvg, avatar, openSheet, confirmSheet, icon, buzz } from '../../core/ui.js';
import { safeRender } from '../../core/anim.js';
import { openSeatsSheet } from '../../core/seats.js';
import { layout, dock, chips, menuRow } from '../../core/shell.js';
import * as E from './engine.js';
import { askReason, validReason, cleanReason } from '../../core/reason.js';
import { splitToCsv, shareCsv } from '../../core/export.js';

registerStrings('gu', {
  'Teen Patti': 'તીન પત્તી', 'Start hand': 'હાથ શરૂ કરો', 'Pick winner': 'વિજેતા પસંદ કરો', 'Boot': 'બૂટ', 'Settle up': 'હિસાબ પતાવો',
  'Pot': 'પોટ', 'Winner': 'વિજેતા', 'pays': 'આપે', 'chips': 'ચિપ્સ', 'Blind': 'બ્લાઇન્ડ', 'Seen': 'સીન', 'Packed': 'પેક',
  'Stake': 'સ્ટેક', 'Chaal': 'ચાલ', 'Pack': 'પેક', 'Ledger': 'ખાતાવહી', 'Hand': 'હાથ'
});

const LABEL = { blind: 'Blind', seen: 'Seen', packed: 'Packed' };

function mount(root, ctx) {
  let s = ctx.state;
  const host = ctx.isHost;
  const ui = { tab: 'hand' };
  let destroyed = false;
  const player = (id) => s.players.find((p) => p.id === id) || { id, name: '?', color: 0 };
  const commit = (fn, { afterEnd = false } = {}) => { if (!host || (s.ended && !afterEnd)) return; const n = fn(s); if (n && n !== s) { s = n; ctx.save(s); render(); } };

  function strip() {
    const c = s.cur;
    if (!c) return `<div class="strip"><div class="trump">${suitSvg('D', 30)}</div><div class="grow"><div class="ttl">Teen Patti</div><div class="sub">${esc(t('Boot'))} ${s.config.boot} · ${s.rounds.length} ${esc(t('hands'))}</div></div></div>`;
    return `<div class="strip"><div class="trump">${suitSvg('D', 30)}</div>
      <div class="grow"><div class="ttl">${esc(t('Hand'))} ${c.n}</div>
        <div class="row" style="gap:6px;margin-top:3px"><span class="sub">${esc(t('Stake'))}</span>
        ${host && !s.paused ? `<button class="iconbtn" style="width:30px;height:30px;border-radius:9px" data-act="stakeminus" aria-label="-">${icon('minus', 16)}</button>` : ''}
        <b data-anim="stake" data-anim-val="${c.stake}" style="font-size:17px">${c.stake}</b>
        ${host && !s.paused ? `<button class="iconbtn" style="width:30px;height:30px;border-radius:9px" data-act="stakeplus" aria-label="+">${icon('plus', 16)}</button>` : ''}</div></div>
      <div class="cards"><b data-anim="pot" data-anim-val="${E.potOf(c)}">${E.potOf(c)}</b><span>${esc(t('Pot'))}</span></div></div>`;
  }

  function handPane() {
    const c = s.cur;
    if (!c) {
      return `<div class="card center stack" style="margin-top:12px">
        <p class="bold" style="font-size:18px">${esc(host ? t('Ready for the next hand?') : t('Waiting for the host to start a hand'))}</p>
        <p class="muted small">${esc(t('Everyone puts in the boot automatically. Then mark who is Blind, Seen or Packed as the hand goes on.'))}</p></div>`;
    }
    const n = c.order.length, min = n > 8 ? 42 : 44;
    const rows = c.order.map((id) => {
      const p = player(id), pl = c.pl[id], packed = pl.st === 'packed';
      const ctrl = host && !s.paused ? `
        <button class="chip btnlike ${pl.st === 'seen' ? 'on' : ''}" data-st="${esc(id)}" ${packed ? 'disabled' : ''}>${esc(t(pl.st === 'seen' ? 'Seen' : 'Blind'))}</button>
        <button class="chip btnlike" style="min-height:38px;padding:0 10px;border-color:var(--saffron);font-weight:800" data-chaal="${esc(id)}" ${packed ? 'disabled' : ''}>+${E.chaalAmount(c, id)}</button>
        <button class="iconbtn light" style="width:38px;height:38px;${packed ? 'background:var(--bad-soft);color:var(--bad)' : ''}" data-pack="${esc(id)}" aria-label="${esc(t('Pack'))}">${icon(packed ? 'undo' : 'close', 18)}</button>`
        : `<span class="badge ${packed ? 'bad' : pl.st === 'seen' ? 'ok' : 'warn'}">${esc(t(LABEL[pl.st]))}</span>`;
      return `<div class="prow" data-flip="row-${esc(id)}" style="${packed ? 'opacity:.55' : ''}">
        ${avatar(p, 'sm', packed)}
        <div class="nm"><b>${esc(p.name)}</b><small>${esc(t(LABEL[pl.st]))}</small></div>
        <button class="v" style="border:0;background:none;font-size:20px;font-weight:700;min-width:44px;color:var(--ink)" ${host ? `data-put="${esc(id)}"` : ''} data-anim="put-${esc(id)}" data-anim-val="${pl.put}">${pl.put}</button>
        ${ctrl}</div>`;
    }).join('');
    return `${s.paused ? `<div class="note" style="margin-bottom:6px">⏸ ${esc(t('Game paused by the host'))}</div>` : ''}
      <div class="rows" style="--n:${n};--min:${min}px;--max:60px">${rows}</div>
      <p class="tiny muted" style="margin-top:8px">${esc(t('Blind chaal is half the stake. Raise doubles it.'))}</p>`;
  }

  function ledgerPane() {
    const rows = E.standings(s), pays = E.settle(s);
    const nm = (id) => player(id).name;
    const fmt = (n) => (n > 0 ? '+' + n : String(n));
    return `<div class="card" style="margin-bottom:10px"><h2 style="margin-bottom:6px">${esc(t('Standings'))}</h2><div class="stack" style="gap:4px">${rows.map((r) => `
      <div class="row" style="min-height:44px"><span class="bold" style="width:24px;text-align:center">${r.rank}</span>${avatar(r, 'sm')}<b class="grow">${esc(r.name)}</b>
      <b style="font-size:20px;color:${r.total > 0 ? 'var(--ok)' : r.total < 0 ? 'var(--bad)' : 'inherit'}">${fmt(r.total)}</b></div>`).join('')}</div></div>
      <div class="card" style="margin-bottom:10px"><h2 style="margin-bottom:6px">${esc(t('Settle up'))}</h2>
      ${pays.length ? `<div class="stack" style="gap:6px">${pays.map((p) => `<div class="row"><b>${esc(nm(p.from))}</b><span class="muted">${esc(t('pays'))}</span><b>${esc(nm(p.to))}</b><span class="grow"></span><b style="font-size:19px">${p.amount}</b></div>`).join('')}</div>` : `<p class="muted small">${esc(t('Everyone is square.'))}</p>`}</div>
      ${s.ended ? `<button class="btn dark block" style="margin-bottom:10px" data-act="sharepic">${icon('share', 18)} ${esc(t('Share picture'))}</button>` : ''}
      ${pays.length ? `<button class="btn ghost block" style="margin-bottom:10px" data-act="oweize">${icon('share', 18)} ${esc(t('Export for Oweize (CSV)'))}</button>` : ''}
      ${host && s.ended && ctx.canLock ? `<button class="btn primary block" style="margin-bottom:10px" data-act="lockroom">${icon('lock', 18)} ${esc(t('Finish and lock room'))}</button>` : ''}
      <div class="card"><div class="row between" style="margin-bottom:6px"><h2>${esc(t('Hands'))}</h2><span class="badge">${s.rounds.length}</span></div>
      ${host ? `<p class="tiny muted" style="margin-bottom:6px">${esc(t('Tap a hand to change its winner. A reason is required and the old result stays in the history.'))}</p>` : ''}
      ${s.rounds.length || (s.voided && s.voided.length) ? `<div class="stack" style="gap:4px">${handRows(nm)}</div>` : `<p class="muted small">${esc(t('No hands yet.'))}</p>`}</div>`;
  }

  function handRows(nm) {
    const when = (x) => new Date(x.at || x.voidedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const struck = 'text-decoration:line-through;text-decoration-thickness:2px;opacity:.7';
    const why = (x) => `<div class="tiny" style="color:var(--saffron-ink);padding:0 0 4px 34px">${esc(t('Reason'))}: ${esc(x.reason)}${x.by ? ' · ' + esc(x.by) : ''}</div>`;
    const items = s.rounds.map((h) => ({ n: h.n, h, v: false })).concat((s.voided || []).map((h) => ({ n: h.n, h, v: true })));
    items.sort((a, b) => b.n - a.n || (a.v ? 1 : -1));
    return items.map(({ h, v }) => {
      if (v) return `<div class="row" style="${struck}"><span class="muted" style="width:28px">#${h.n}</span><b class="grow">${esc(nm(h.winnerId))}</b><span class="tiny">${esc(t('undone'))} ${esc(when(h))}</span><b>${h.pot}</b></div>${why(h)}`;
      const packed = h.st ? Object.values(h.st).filter((x) => x === 'packed').length : 0;
      const revs = (h.revs || []).slice().reverse().map((r) => `<div class="row" style="${struck}"><span style="width:28px"></span><b class="grow">${esc(nm(r.winnerId))}</b><span class="tiny">${esc(t('before fix'))} ${esc(when(r))}</span><b>${h.pot}</b></div>${why(r)}`).join('');
      return `<div class="row" ${host ? `data-hand="${h.n}" style="cursor:pointer"` : ''}><span class="muted" style="width:28px">#${h.n}</span><b class="grow">${esc(nm(h.winnerId))}${h.st && h.st[h.winnerId] === 'blind' ? ' <span class="badge warn">' + esc(t('Blind')) + '</span>' : ''}${h.revs && h.revs.length ? ' <span class="badge warn" style="font-size:10px">' + esc(t('fixed')) + '</span>' : ''}</b>${packed ? `<span class="tiny muted">${packed} ${esc(t('packed'))}</span>` : ''}<b>${h.pot}</b></div>${revs}`;
    }).join('');
  }

  function morePane() {
    return `<div class="menulist">
      ${host && !s.ended ? menuRow({ id: 'seats', icon: 'users', label: 'Seats and players', sub: t('{n} at the table', { n: s.players.filter((p) => !p.out).length }) }) : ''}
      ${host && !s.ended ? menuRow({ id: 'pause', icon: s.paused ? 'play' : 'pause', label: s.paused ? 'Resume game' : 'Pause game' }) : ''}
      ${host && !s.ended ? menuRow({ id: 'boot', icon: 'gear', label: 'Boot amount', sub: String(s.config.boot) }) : ''}
      ${host && s.ended && !ctx.locked ? menuRow({ id: 'modify', icon: 'log', label: 'Modify a hand', sub: t('Reason required') }) : ''}
      ${menuRow({ id: 'stats', icon: 'flag', label: 'Stats' })}
      ${host && !s.ended ? menuRow({ id: 'end', icon: 'trophy', label: 'End game', danger: true }) : ''}
    </div>`;
  }

  function dockHtml() {
    const tabs = [{ id: 'hand', label: 'Hand', icon: 'grid' }, { id: 'ledger', label: 'Ledger', icon: 'trophy' }, { id: 'more', label: 'More', icon: 'gear' }];
    if (!host) return dock({ tabs, active: ui.tab, viewer: true });
    if (s.ended) return dock({ tabs, active: ui.tab, action: ctx.locked ? '' : `<button class="dockbtn" data-act="modify">${icon('log', 20)} ${esc(t('Modify'))}</button>` });
    if (s.paused) return dock({ tabs, active: ui.tab, action: `<button class="dockbtn" data-m="pause">${icon('play', 20)} ${esc(t('Resume game'))}</button>` });
    const extra = `<button class="dockundo" data-act="undo" aria-label="${esc(t('Undo'))}">${icon('undo', 22)}</button>`;
    const action = s.cur
      ? `<button class="dockbtn" data-act="winner">${icon('trophy', 20)} ${esc(t('Winner'))}</button>`
      : `<button class="dockbtn" data-act="start">${icon('play', 20)} ${esc(t('Start hand'))}</button>`;
    return dock({ tabs, active: ui.tab, action, extra });
  }

  function render() {
    if (destroyed) return;
    const pane = ui.tab === 'ledger' ? ledgerPane() : ui.tab === 'more' ? morePane() : handPane();
    const html = layout({ strip: strip(), lb: chips(E.standings(s)), pane, dock: dockHtml(), fill: ui.tab === 'hand' && !!s.cur });
    safeRender(root, () => { root.innerHTML = html; });
  }

  function winnerSheet() {
    const c = s.cur; if (!c) return;
    const left = E.live(c);
    if (!left.length) return;
    const sh = openSheet(`<h2>${esc(t('Winner'))} · ${esc(t('Pot'))} ${E.potOf(c)}</h2><div class="stack">${left.map((id) => `
      <button class="plrow" style="width:100%;text-align:left;min-height:60px" data-w="${esc(id)}">${avatar(player(id))}<span class="grow bold" style="font-size:17px">${esc(player(id).name)}</span><span class="badge ${c.pl[id].st === 'blind' ? 'warn' : 'ok'}">${esc(t(LABEL[c.pl[id].st]))}</span></button>`).join('')}</div>
      <button class="btn ghost block" style="margin-top:10px" data-close>${esc(t('Cancel'))}</button>`);
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (b) { buzz(15); commit((st) => E.declareWinner(st, b.dataset.w)); ui.tab = 'hand'; sh.close(); } });
  }

  function putSheet(id) {
    const sh = openSheet(`<h2>${esc(player(id).name)} · ${esc(t('Chips put in'))}</h2><input class="input" type="number" inputmode="numeric" data-v value="${s.cur.pl[id].put}">
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok>${esc(t('Save'))}</button></div>`);
    sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-ok]')) { commit((st) => E.setPut(st, id, sh.el.querySelector('[data-v]').value)); sh.close(); } });
  }

  function modifySheet(n) {
    if (!s.rounds.length) return;
    if (n == null) {
      const sh = openSheet(`<h2>${esc(t('Modify a hand'))}</h2><div class="stack" style="gap:6px;max-height:52vh;overflow:auto">${s.rounds.slice().reverse().map((h) => `<button class="btn ghost block" style="justify-content:space-between" data-pick="${h.n}"><span><b>#${h.n}</b> ${esc(player(h.winnerId).name)}</span><b>${h.pot}</b></button>`).join('')}</div><button class="btn dark block" style="margin-top:10px" data-close>${esc(t('Close'))}</button>`);
      sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) { sh.close(); modifySheet(+b.dataset.pick); } });
      return;
    }
    const h = s.rounds.find((x) => x.n === n); if (!h) return;
    let pick = h.winnerId, why = '';
    const sh = openSheet('');
    const draw = () => {
      const okb = validReason(why) && pick !== h.winnerId;
      sh.setHtml(`<h2>${esc(t('Hand'))} #${h.n} · ${esc(t('Pot'))} ${h.pot}</h2><div class="label">${esc(t('Winner'))}</div><div class="stack" style="gap:6px;margin-bottom:10px">${Object.keys(h.put).filter((id) => !(h.st && h.st[id] === 'packed')).map((id) => `<button class="plrow" style="width:100%;text-align:left;min-height:52px;${id === pick ? 'outline:2px solid var(--saffron)' : ''}" data-w="${esc(id)}">${avatar(player(id))}<span class="grow bold">${esc(player(id).name)}</span>${id === h.winnerId ? `<span class="badge">${esc(t('now'))}</span>` : ''}</button>`).join('')}</div>
        <div class="label">${esc(t('Reason (required)'))}</div><input class="input" data-why maxlength="120" value="${esc(why)}" style="width:100%;margin-bottom:10px" placeholder="${esc(t('Why is this being changed?'))}">
        <div class="row" style="gap:8px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok ${okb ? '' : 'disabled'}>${esc(t('Save'))}</button></div>`);
      const inp = sh.el.querySelector('[data-why]'); inp.addEventListener('input', () => { why = inp.value; sh.el.querySelector('[data-ok]').disabled = !(validReason(why) && pick !== h.winnerId); });
    };
    sh.el.addEventListener('click', (e) => {
      const w = e.target.closest('[data-w]'); if (w) { pick = w.dataset.w; draw(); return; }
      if (e.target.closest('[data-ok]') && validReason(why) && pick !== h.winnerId) { commit((st) => E.modifyHand(st, h.n, pick, cleanReason(why), ctx.user && ctx.user.name), { afterEnd: true }); sh.close(); }
    });
    draw();
  }

  async function undoWithReason() {
    if (!host) return;
    if (!E.undoNeedsReason(s)) return commit((st) => E.undoAll(st));
    const last = s.rounds[s.rounds.length - 1];
    const why = await askReason({ title: `${t('Undo hand')} #${last.n}`, text: t('The hand is removed from the totals. It stays in the history, struck through.'), ok: 'Undo hand' });
    if (why) commit((st) => E.undoAll(st, why, ctx.user && ctx.user.name));
  }

  function statsSheet() {
    const st = E.stats(s).filter((x) => x.hands);
    openSheet(`<h2>${esc(t('Stats'))}</h2>${st.length ? `<div class="stack">${st.map((x) => `<div class="row"><b class="grow">${esc(x.name)}</b><span class="small muted">${x.wins} ${esc(t('wins'))} · ${x.packed} ${esc(t('packed'))}${x.blindWins ? ' · ' + x.blindWins + ' ' + esc(t('blind wins')) : ''}</span></div>`).join('')}</div>` : `<p class="muted small">${esc(t('Stats appear after a few hands.'))}</p>`}
      <button class="btn dark block" style="margin-top:12px" data-close>${esc(t('Done'))}</button>`);
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
    const d = b.dataset;
    if (d.tab) { ui.tab = d.tab; buzz(6); render(); return; }
    if (d.st) return commit((st) => E.setStatus(st, d.st, st.cur.pl[d.st].st === 'seen' ? 'blind' : 'seen'));
    if (d.chaal) { buzz(8); return commit((st) => E.chaal(st, d.chaal)); }
    if (d.pack) return commit((st) => E.setStatus(st, d.pack, st.cur.pl[d.pack].st === 'packed' ? 'blind' : 'packed'));
    if (d.put && host) return putSheet(d.put);
    if (d.act === 'stakeplus') return commit((st) => E.setStake(st, st.cur.stake * 2));
    if (d.act === 'stakeminus') return commit((st) => E.setStake(st, Math.max(1, Math.floor(st.cur.stake / 2))));
    if (d.act === 'start') return commit((st) => E.startHand(st));
    if (d.act === 'winner') return winnerSheet();
    if (d.act === 'sharepic') return ctx.shareCard({ title: t('Game over'), subtitle: `Teen Patti · ${s.rounds.length} ${t('hands')}`, rows: E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: (r.total > 0 ? '+' : '') + r.total })), highlights: E.settle(s).slice(0, 3).map((p) => `${player(p.from).name} → ${player(p.to).name}: ${p.amount}`) });
    if (d.act === 'lockroom') return ctx.lockRoom && ctx.lockRoom();
    if (d.act === 'oweize') {
      const split = E.settle(s).map((p) => ({ from: player(p.from).name, to: player(p.to).name, amount: p.amount }));
      return shareCsv(splitToCsv(split, { description: 'Teen Patti' }), `baithak-${ctx.code}-split.csv`, 'Baithak split');
    }
    if (d.act === 'undo') return undoWithReason();
    if (d.act === 'modify') return modifySheet();
    if (d.hand && host) return modifySheet(+d.hand);
    if (d.m === 'pause') return commit((st) => E.setPaused(st, !st.paused));
    if (d.m === 'stats') return statsSheet();
    if (d.m === 'modify') return modifySheet();
    if (d.m === 'boot') { const v = prompt(t('Boot amount'), String(s.config.boot)); if (v) commit((st) => ({ ...st, config: { ...st.config, boot: Math.max(1, parseInt(v, 10) || st.config.boot) } })); return; }
    if (d.m === 'end') { if (await confirmSheet({ title: t('End the game?'), text: t('Scores stay saved.'), ok: 'End game', danger: true })) { commit(E.endGame); ui.tab = 'ledger'; render(); } return; }
    if (d.m === 'seats') {
      return openSeatsSheet({
        get: () => ({ players: s.players, locked: !!s.cur, lockedMsg: 'Finish this hand first. Seats can change between hands.', regulars: ctx.regulars || [] }),
        onMove: (x, y) => commit((st) => E.reorder(st, x, y)),
        onOut: (id, out) => commit((st) => E.setOut(st, id, out)),
        onAdd: (name) => { ctx.rememberRegular && ctx.rememberRegular(name); commit((st) => E.addPlayer(st, name)); }
      });
    }
  });

  render();
  return { update(next) { s = next; render(); }, destroy() { destroyed = true; root.innerHTML = ''; } };
}

export default {
  id: 'teenpatti', prefix: 'TP', name: 'Teen Patti', tag: 'Live hand + ledger',
  icon: suitSvg('D', 26), blurb: 'Blind, seen, packed, pot and who owes whom',
  minPlayers: 2, maxPlayers: 10,
  setup: {
    html(cfg = {}) { return `<div class="card stack"><h2>Teen Patti</h2><div class="row between"><span>${esc(t('Boot'))} (${esc(t('chips'))})</span><input class="input" style="width:92px;text-align:center" type="number" inputmode="numeric" data-f="boot" value="${cfg.boot || 10}"></div></div>`; },
    read(root) { return { boot: Math.max(1, parseInt(root.querySelector('[data-f="boot"]').value, 10) || 10) }; }
  },
  create: ({ players, config }) => E.newGame({ names: players, config }),
  summary(s) { const rows = E.standings(s).map((r) => ({ rank: r.rank, name: r.name, total: r.total })); return { title: 'Teen Patti', line: `${s.rounds.length} hands${s.cur ? ' · hand ' + s.cur.n + ' live' : ''}`, rows, done: s.ended }; },
  describe(prev, next) {
    const out = [], pr = prev.rounds.length, nr = next.rounds.length;
    const nm = (st, id) => (st.players.find((p) => p.id === id) || {}).name || id;
    if (nr > pr) { const h = next.rounds[nr - 1]; out.push({ action: 'SCORE', summary: `Hand ${h.n} won by ${nm(next, h.winnerId)}, pot ${h.pot}` }); }
    else if (nr < pr) { const v = (next.voided || [])[(next.voided || []).length - 1]; out.push({ action: 'UNDO', summary: `Hand ${prev.rounds[pr - 1].n} removed (undo)${v ? ' — reason: ' + v.reason : ''}` }); }
    else if (!(prev.cur && !next.cur)) prev.rounds.forEach((h, i) => { const x = next.rounds[i]; if (x && x.winnerId !== h.winnerId) { const r = x.revs[x.revs.length - 1]; out.push({ action: 'EDIT', summary: `Hand ${x.n} winner changed ${nm(prev, h.winnerId)} to ${nm(next, x.winnerId)} — reason: ${r ? r.reason : ''}` }); } });
    if (nr === pr && prev.cur && !next.cur) out.push({ action: 'UNDO', summary: `Hand ${prev.cur.n} in progress cancelled (undo)` });
    if (prev.config.boot !== next.config.boot) out.push({ action: 'SETTINGS', summary: `Boot changed ${prev.config.boot} to ${next.config.boot}` });
    if (!!prev.paused !== !!next.paused) out.push({ action: 'PAUSE', summary: next.paused ? 'Game paused' : 'Game resumed' });
    if (prev.players.length !== next.players.length || prev.players.some((p, i) => next.players[i] && (p.name !== next.players[i].name || !!p.out !== !!next.players[i].out))) out.push({ action: 'PLAYERS', summary: 'Players changed' });
    if (!prev.ended && next.ended) out.push({ action: 'END', summary: 'Game ended' });
    return out;
  },
  mount
};
