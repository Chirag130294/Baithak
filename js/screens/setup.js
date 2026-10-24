// New room: pick players, game options, then create the room and get a code.
import { clean, clamp, findDuplicate, suggest, same } from '../core/names.js';
import { esc, shuffle, ls } from '../core/util.js';
import { t } from '../core/i18n.js';
import { icon, toast, openSheet, buzz, refreshRails } from '../core/ui.js';
import { loadGame, newCode } from '../core/games.js';
import { makeEntry, sha256, totalsSnapshot } from '../core/audit.js';
import { topbar, skeleton } from './common.js';

export async function renderSetup(app, root, gameId) {
  skeleton(root);
  const game = await loadGame(gameId);
  if (!game) { root.innerHTML = `<div class="screen">${topbar({ title: t('Game not found'), back: '#/' })}<div class="body"><div class="note">${esc(t('This game is not installed in this version.'))}</div></div></div>`; return; }
  const regulars = app.profile.regulars || [];
  // everyone this host has played with: regulars first, then names from finished games
  const pool = [...new Set([...regulars, ...((app.profile.history || []).flatMap((h) => (h.rows || []).map((r) => r.name)))].map((n) => clean(n)).filter(Boolean))];
  let pre = null;
  try { pre = JSON.parse(sessionStorage.getItem('baithak:prefill') || 'null'); sessionStorage.removeItem('baithak:prefill'); } catch { /* ignore */ }
  const names = Array.isArray(pre) && pre.length ? pre.slice(0, game.maxPlayers) : [app.user.name, '', ''];
  while (names.length < game.minPlayers) names.push('');

  // Three short steps, one after another, so nothing needs scrolling and nothing is missed: players, game rules, name + go.
  const panes = ['players', ...(game.setup ? ['rules'] : []), 'go'];
  const label = { players: t('Players'), rules: t('Game rules'), go: t('Ready') };
  let step = 0;

  root.innerHTML = `<div class="screen setup" data-setup>${topbar({ title: t(game.name), sub: t('New room'), back: '#/' })}
    <div class="stepper" data-stepper></div>
    <div class="steps"><div class="track" data-track>
      <section class="pane" data-pane="players"><div class="card stack">
        <div class="row between"><h2>${esc(t('Players'))} <span class="badge" data-count></span></h2>
          <button class="chip btnlike" data-shuffle>${icon('shuffle', 16)} ${esc(t('Shuffle seats'))}</button></div>
        <div data-regbox></div>
        <p class="small muted">${esc(t('Type names in the order people sit around the table.'))}</p>
        <div data-namesbox></div></div></section>
      ${game.setup ? `<section class="pane" data-pane="rules"><div data-gamesetup>${game.setup.html({})}</div></section>` : ''}
      <section class="pane" data-pane="go"><div class="card stack"><h2>${esc(t('Almost there'))}</h2>
        <div><div class="label">${esc(t('Room name (optional)'))}</div><input class="input" maxlength="30" data-title placeholder="${esc(t('Friday night'))}"></div>
        <div><div class="label">${icon('lock', 14)} ${esc(t('Private room PIN (optional)'))}</div><input class="input code" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" data-pin placeholder="${esc(t('4 to 6 digits'))}"><p class="tiny muted" style="margin-top:4px">${esc(t('Friends need the code and the PIN to watch. Leave empty for an open room.'))}</p></div>
        <div data-summary></div></div></section>
    </div></div>
    <div class="actionbar"><button class="btn ghost sm" data-prev hidden>${icon('back', 20)}</button><button class="btn primary" data-next></button></div></div>`;
  const $ = (sel) => root.querySelector(sel);
  $('.steps').addEventListener('scroll', (e) => { e.target.scrollLeft = 0; });   // focusing a field must never slide the panes sideways
  if (game.setup && game.setup.bind) game.setup.bind($('[data-gamesetup]'));

  // only the names list is redrawn (never the whole screen), so typing and adding players never flashes
  const used = (except) => names.filter((n, i) => i !== except && n.trim());
  /** The name from the pool that starts with what is typed and is not already at the table ('' when none). */
  const suggestFor = (i) => {
    const v = (names[i] || '').trimStart();
    if (!v.trim()) return '';
    const q = v.toLowerCase(), taken = used(i);
    return pool.find((c) => c.length > v.length && c.toLowerCase().startsWith(q) && !taken.some((n) => same(n, c))) || '';
  };
  const paintGhost = (i) => {
    const g = $(`[data-ghost="${i}"]`), b = $(`[data-acc="${i}"]`); if (!g) return;
    const sug = suggestFor(i), v = names[i] || '';
    g.innerHTML = sug ? `<span class="gt">${esc(v)}</span><span class="gs">${esc(sug.slice(v.length))}</span>` : '';
    if (b) { b.hidden = !sug; b.setAttribute('aria-label', sug ? t('Use "{n}"', { n: sug }) : ''); }
  };
  /** Regulars as one swipeable row at the top. While you type, it narrows to the names that match. */
  const drawRail = () => {
    const box = $('[data-regbox]'); if (!box) return;
    const f = document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-name]') ? (names[+document.activeElement.dataset.name] || '').trim().toLowerCase() : '';
    const free = pool.filter((r) => !names.some((n) => same(n, r)));
    const list = (f ? free.filter((r) => r.toLowerCase().includes(f)) : free).slice(0, 14);
    box.innerHTML = list.length ? `<div class="rail regrail" data-rail>${list.map((r) => `<button type="button" class="chip btnlike" data-reg="${esc(r)}">${icon('plus', 14, 2.4)}<span>${esc(r)}</span></button>`).join('')}</div>` : '';
    refreshRails(box);
  };
  const drawNames = (focusIdx) => {
    $('[data-namesbox]').innerHTML = `<div class="${names.length > 6 ? 'names2' : 'stack'}" data-names>${names.map((n, i) => `<div class="row nrow" data-flip="n${i}">
        ${names.length > 6 ? '' : `<span class="avatar sm" style="background:var(--soft)">${i + 1}</span>`}
        <div class="ghostwrap"><input class="input" value="${esc(n)}" placeholder="${esc(t('Player {n}', { n: i + 1 }))}" data-name="${i}" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="words" enterkeyhint="${i === names.length - 1 ? 'done' : 'next'}">
          <div class="input ghost" data-ghost="${i}" aria-hidden="true"></div><button type="button" class="sugbtn" data-acc="${i}" hidden>${icon('check', 14, 2.6)}</button></div>
        <button class="iconbtn light" data-rm="${i}" aria-label="${esc(t('Remove'))}" ${names.length <= game.minPlayers ? 'disabled' : ''}>${icon('close', 18)}</button></div>`).join('')}</div>
      ${names.length < game.maxPlayers ? `<button class="btn ghost block small addbtn" data-add>${icon('plus', 18)} ${esc(t('Add player'))}</button>` : ''}`;
    $('[data-count]').textContent = names.filter((n) => n.trim()).length + ' / ' + game.maxPlayers;
    names.forEach((_, i) => paintGhost(i));
    drawRail();
    if (focusIdx != null) { const el = $(`[data-name="${focusIdx}"]`); if (el) el.focus(); }
  };
  drawNames();
  const accept = (i) => {
    const sug = suggestFor(i); if (!sug) return false;
    names[i] = sug;
    const el = $(`[data-name="${i}"]`); if (el) { el.value = sug; try { el.setSelectionRange(sug.length, sug.length); } catch { /* ignore */ } }
    paintGhost(i); drawRail(); buzz(8);
    return true;
  };

  const showStep = (n, dir = 1) => {
    step = Math.max(0, Math.min(panes.length - 1, n));
    $('[data-track]').style.transform = `translateX(${-100 * step}%)`;
    root.querySelectorAll('.pane').forEach((p, i) => { p.inert = i !== step; p.setAttribute('aria-hidden', String(i !== step)); if (i === step) p.scrollTop = 0; });
    $('[data-stepper]').innerHTML = `<div class="dots">${panes.map((_, i) => `<i class="${i === step ? 'on' : i < step ? 'done' : ''}"></i>`).join('')}</div><span class="small muted">${esc(t('Step {a} of {b}', { a: step + 1, b: panes.length }))} · <b>${esc(label[panes[step]])}</b></span>`;
    const last = step === panes.length - 1;
    const nx = $('[data-next]'); nx.textContent = last ? t('Create room and get code') : t('Next');
    if (last) nx.setAttribute('data-create', ''); else nx.removeAttribute('data-create');
    $('[data-prev]').hidden = step === 0;
    if (panes[step] === 'go') drawSummary();
    buzz(6);
  };
  const drawSummary = () => {
    const ps = names.map((n) => clean(n)).filter(Boolean);
    $('[data-summary]').innerHTML = `<div class="sumline"><b>${esc(t(game.name))}</b> · ${esc(t('{n} players', { n: ps.length }))}</div><div class="row wrap" style="gap:6px">${ps.map((n, i) => `<span class="chip" style="animation:qrpop .45s ${i * 40}ms both cubic-bezier(.2,1.4,.4,1)">${esc(n)}</span>`).join('')}</div>`;
  };
  showStep(0);

  const sync = () => root.querySelectorAll('[data-name]').forEach((i) => { names[+i.dataset.name] = i.value; });
  root.addEventListener('focusout', (e) => { if (e.target.matches('[data-name]')) { const v = clean(e.target.value); e.target.value = v; names[+e.target.dataset.name] = v; paintGhost(+e.target.dataset.name); drawRail(); $('[data-count]').textContent = names.filter((n) => n.trim()).length + ' / ' + game.maxPlayers; } });
  root.oninput = (e) => { if (e.target.matches('[data-name]')) { const v = clamp(e.target.value); if (v !== e.target.value) e.target.value = v; const i = +e.target.dataset.name; names[i] = v; paintGhost(i); drawRail(); } };
  let cur = null;   // the name field that was last focused
  root.addEventListener('focusin', (e) => { if (e.target.matches('[data-name]')) { cur = +e.target.dataset.name; drawRail(); } });
  root.onkeydown = (e) => {
    if (!e.target.matches('[data-name]')) return;
    const i = +e.target.dataset.name, el = e.target;
    // like a spreadsheet: Tab or the right arrow (caret at the end) takes the grey suggestion
    if (e.key === 'Tab' && !e.shiftKey && suggestFor(i)) { e.preventDefault(); accept(i); return; }
    if (e.key === 'ArrowRight' && el.selectionStart === el.value.length && el.selectionEnd === el.value.length && suggestFor(i)) { e.preventDefault(); accept(i); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    accept(i);
    if (i < names.length - 1) { const nx = $(`[data-name="${i + 1}"]`); if (nx) nx.focus(); }
    else e.target.blur();
  };

  /** Checks the names. Returns true when the host may go on. */
  const namesOk = () => {
    const players = names.map((n) => clean(n)).filter(Boolean);
    const d = findDuplicate(names.map((n) => clean(n)));
    if (players.length < game.minPlayers) { toast(t('{game} needs at least {n} players', { game: t(game.name), n: game.minPlayers }), 'bad'); return false; }
    if (d) {
      const fix = suggest(d.name, names);
      const inp = $(`[data-name="${d.index}"]`);
      if (inp) { inp.classList.add('invalid'); inp.focus(); }
      const sh = openSheet(`<h2>${esc(t('Same name twice'))}</h2><p style="margin-bottom:12px">${esc(t('Two players are called "{n}". Please change the second one.', { n: d.name }))}</p>
        <button class="btn primary block" data-use>${esc(t('Use "{n}"', { n: fix }))}</button>
        <button class="btn ghost block" style="margin-top:8px" data-close>${esc(t('I will type another name'))}</button>`);
      sh.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-use]')) { names[d.index] = fix; sh.close(); drawNames(); } });
      return false;
    }
    return true;
  };

  const creating = () => { const o = document.createElement('div'); o.className = 'creating'; o.innerHTML = `<div class="splash-cards"><i>♠</i><i style="color:#c62828">♦</i><i>♣</i><i style="color:#c62828">♥</i></div><div class="splash-name" style="font-size:20px">${esc(t('Shuffling the deck…'))}</div>`; root.appendChild(o); return o; };

  async function create() {
    const players = names.map((n) => clean(n)).filter(Boolean);
    const pin = ($('[data-pin]').value || '').replace(/\D/g, '');
    if (pin && (pin.length < 4 || pin.length > 6)) { toast(t('The PIN must be 4 to 6 digits.'), 'bad'); return; }
    const ov = creating();
    try {
      const config = game.setup ? game.setup.read($('[data-gamesetup]')) : {};
      const state = game.create({ players: players.map((name) => ({ name })), config });
      const title = $('[data-title]').value.trim();
      const sum = game.summary(state);
      // no "does this code exist?" round trip first: the database refuses to overwrite a room, so a clash simply tries the next code
      let room = null, lastErr = null;
      for (let i = 0; i < 4 && !room; i++) {
        const code = newCode(game);
        const r = { code, hostUid: app.user.uid, hostName: app.user.name, game: game.id, title, status: 'live', data: JSON.stringify(state), updatedAt: Date.now() };
        if (pin) r.private = true;
        const entry = makeEntry({ action: 'CREATE', summary: `Room created. Players: ${players.join(', ')}`, user: app.user, totals: totalsSnapshot(sum.rows), hash: await sha256(r.data) });
        try { await app.store.rooms.create(r, entry, pin ? { pinHash: await sha256(`${code}:${pin}`) } : {}); room = r; if (pin) ls.set('baithak:pin:' + code, pin); } catch (e) { lastErr = e; }
      }
      if (!room) throw (lastErr && /PERMISSION|permission/i.test(String(lastErr.code || '') + ' ' + String(lastErr.message || ''))) ? new Error(t('Please wait about 10 seconds before creating another room.')) : (lastErr || new Error('Could not create the room'));
      app.justCreated = room;   // the room screen opens from this copy straight away, no second download
      const reg = new Set([...(app.profile.regulars || [])]);
      players.forEach((n) => { if (n.toLowerCase() !== app.user.name.toLowerCase()) reg.add(n); });
      app.profile.regulars = [...reg].slice(-30);
      app.saveProfile();
      location.hash = '#/r/' + room.code;
    } catch (err) { ov.remove(); $('[data-next]').disabled = false; toast(err.message || String(err), 'bad'); }
  }

  root.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.acc != null) { accept(+b.dataset.acc); const el = $(`[data-name="${b.dataset.acc}"]`); if (el) el.focus(); return; }
    if ('add' in b.dataset) { sync(); names.push(''); drawNames(names.length - 1); }
    else if (b.dataset.rm != null) { sync(); names.splice(+b.dataset.rm, 1); drawNames(); }
    else if (b.dataset.reg) {
      sync();
      const typed = cur != null && names[cur] && names[cur].trim() && b.dataset.reg.toLowerCase().includes(names[cur].trim().toLowerCase()) ? cur : -1;   // a half-typed name gets completed by the tapped pill
      const empty = typed >= 0 ? typed : names.findIndex((n) => !n.trim());
      if (empty >= 0) names[empty] = b.dataset.reg; else if (names.length < game.maxPlayers) names.push(b.dataset.reg);
      cur = null; drawNames(); buzz(8);
    }
    else if ('shuffle' in b.dataset) { sync(); const filled = names.filter((n) => n.trim()); const rest = names.filter((n) => !n.trim()); names.length = 0; names.push(...shuffle(filled), ...rest); drawNames(); toast(t('Seats shuffled')); }
    else if ('prev' in b.dataset) showStep(step - 1);
    else if ('next' in b.dataset) {
      sync();
      if (panes[step] === 'players' && !namesOk()) return;
      if (step === panes.length - 1) { b.disabled = true; create(); } else showStep(step + 1);
    }
  };
  return () => { root.onclick = null; root.oninput = null; root.onkeydown = null; };
}
