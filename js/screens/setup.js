// New room: pick players, game options, then create the room and get a code.
import { esc, shuffle } from '../core/util.js';
import { t } from '../core/i18n.js';
import { icon, toast } from '../core/ui.js';
import { loadGame, newCode } from '../core/games.js';
import { topbar, skeleton } from './common.js';

export async function renderSetup(app, root, gameId) {
  skeleton(root);
  const game = await loadGame(gameId);
  if (!game) { root.innerHTML = `<div class="screen">${topbar({ title: t('Game not found'), back: '#/' })}<div class="body"><div class="note">${esc(t('This game is not installed in this version.'))}</div></div></div>`; return; }
  const regulars = app.profile.regulars || [];
  const names = [app.user.name, '', ''];
  while (names.length < game.minPlayers) names.push('');

  const draw = (keepFocus) => {
    const unusedReg = regulars.filter((r) => !names.some((n) => n.trim().toLowerCase() === r.toLowerCase()));
    root.innerHTML = `<div class="screen">${topbar({ title: t(game.name), sub: t('New room'), back: '#/' })}
      <div class="body pad-b">
        <div class="card stack"><div class="row between"><h2>${esc(t('Players'))} <span class="badge">${names.filter((n) => n.trim()).length}</span></h2>
          <button class="chip btnlike" data-shuffle>${icon('shuffle', 18)} ${esc(t('Shuffle seats'))}</button></div>
          <p class="small muted">${esc(t('Type names in the order people sit around the table.'))}</p>
          <div class="stack" data-names>${names.map((n, i) => `<div class="row" data-flip="n${i}">
            <span class="avatar sm" style="background:var(--soft)">${i + 1}</span>
            <input class="input" maxlength="20" value="${esc(n)}" placeholder="${esc(t('Player {n}', { n: i + 1 }))}" data-name="${i}" autocomplete="off" enterkeyhint="next">
            <button class="iconbtn light" data-rm="${i}" aria-label="${esc(t('Remove'))}" ${names.length <= game.minPlayers ? 'disabled' : ''}>${icon('close', 20)}</button></div>`).join('')}</div>
          ${names.length < game.maxPlayers ? `<button class="btn ghost block" data-add>${icon('plus', 20)} ${esc(t('Add player'))}</button>` : ''}
          ${unusedReg.length ? `<div class="label">${esc(t('Your regulars'))}</div><div class="row wrap" style="gap:6px">${unusedReg.slice(0, 12).map((r) => `<button class="chip btnlike" data-reg="${esc(r)}">+ ${esc(r)}</button>`).join('')}</div>` : ''}
        </div>
        <div data-gamesetup>${game.setup ? game.setup.html({}) : ''}</div>
        <div class="card"><div class="label">${esc(t('Room name (optional)'))}</div><input class="input" maxlength="30" data-title placeholder="${esc(t('Friday night'))}"></div>
      </div>
      <div class="actionbar"><button class="btn primary" data-create>${esc(t('Create room and get code'))}</button></div></div>`;
    if (game.setup && game.setup.bind) game.setup.bind(root.querySelector('[data-gamesetup]'));
    if (keepFocus != null) { const el = root.querySelector(`[data-name="${keepFocus}"]`); if (el) el.focus(); }
  };
  draw();

  const sync = () => root.querySelectorAll('[data-name]').forEach((i) => { names[+i.dataset.name] = i.value; });
  root.oninput = (e) => { if (e.target.matches('[data-name]')) names[+e.target.dataset.name] = e.target.value; };
  root.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sync();
    if ('add' in b.dataset) { names.push(''); draw(names.length - 1); }
    else if (b.dataset.rm != null) { names.splice(+b.dataset.rm, 1); draw(); }
    else if (b.dataset.reg) { const empty = names.findIndex((n) => !n.trim()); if (empty >= 0) names[empty] = b.dataset.reg; else if (names.length < game.maxPlayers) names.push(b.dataset.reg); draw(); }
    else if ('shuffle' in b.dataset) { const filled = names.filter((n) => n.trim()); const rest = names.filter((n) => !n.trim()); names.length = 0; names.push(...shuffle(filled), ...rest); draw(); toast(t('Seats shuffled')); }
    else if ('create' in b.dataset) {
      const players = names.map((n) => n.trim()).filter(Boolean);
      const dup = players.find((n, i) => players.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i);
      if (players.length < game.minPlayers) return toast(t('{game} needs at least {n} players', { game: t(game.name), n: game.minPlayers }), 'bad');
      if (dup) return toast(t('Two players are called "{n}". Please make names different.', { n: dup }), 'bad');
      b.disabled = true;
      try {
        const config = game.setup ? game.setup.read(root.querySelector('[data-gamesetup]')) : {};
        const state = game.create({ players: players.map((name) => ({ name })), config });
        let code = newCode(game);
        for (let i = 0; i < 6 && await app.store.rooms.get(code); i++) code = newCode(game);
        const title = root.querySelector('[data-title]').value.trim();
        const room = { code, hostUid: app.user.uid, hostName: app.user.name, game: game.id, title, status: 'live', data: JSON.stringify(state), updatedAt: Date.now() };
        await app.store.rooms.create(room);
        const reg = new Set([...(app.profile.regulars || [])]);
        players.forEach((n) => { if (n.toLowerCase() !== app.user.name.toLowerCase()) reg.add(n); });
        app.profile.regulars = [...reg].slice(-30);
        app.saveProfile();
        location.hash = '#/r/' + code;
      } catch (err) { b.disabled = false; toast(err.message || String(err), 'bad'); }
    }
  };
  return () => { root.onclick = null; root.oninput = null; };
}
