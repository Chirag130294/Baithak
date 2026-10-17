// Home (games), Rooms list and Profile. Bottom tab bar switches between them.
import { esc, parseCode, timeAgo, ls } from '../core/util.js';
import { t, getLang } from '../core/i18n.js';
import { icon, toast, confirmSheet, avatar, openSheet } from '../core/ui.js';
import { openScanner } from '../core/scan.js';
import { installApp, isStandalone, openInstallHelp, onInstallChange } from '../core/pwa.js';
import { loadAllGames, loadErrors } from '../core/games.js';
import { topbar, tabbar, langToggle, bindLang, skeleton } from './common.js';
import { APP_VERSION } from '../config.js';

export async function renderHome(app, root) {
  skeleton(root);
  const games = await loadAllGames();
  const recent = ls.get('baithak:lastRoom', null);
  const draw = () => {
    root.innerHTML = `<div class="screen">
      ${topbar({ title: t('Hello, {name}', { name: (app.user && app.user.name) || '' }), sub: t('What are we playing?'), right: langToggle() })}
      <div class="body pad-b">
        ${recent ? `<a class="card saffron row" style="text-decoration:none" href="#/r/${esc(recent.code)}"><span class="avatar lg" style="background:var(--felt);color:#fff">${icon('play', 20)}</span>
          <div class="grow"><div class="bold">${esc(t('Continue playing'))}</div><div class="small muted">${esc(recent.name)} · ${esc(recent.code)}</div></div>${icon('right', 20)}</a>` : ''}
        <h2 style="font-size:18px">${esc(t('Games'))}</h2>
        <div class="gtiles">${games.map((g) => `<a class="gtile" href="#/new/${esc(g.id)}" style="text-decoration:none;color:inherit"><span class="gi">${g.icon}</span>
          <span><span class="bold" style="font-size:17px;display:block">${esc(t(g.name))}</span><span class="tiny muted">${esc(t(g.blurb))}</span></span></a>`).join('')}
          <div class="gtile dashed muted"><span style="font-size:26px">＋</span><span class="small">${esc(t('More games coming'))}</span></div></div>
        ${loadErrors().size ? `<div class="note">${esc(t('Some games could not load.'))}</div>` : ''}
        <div class="card stack"><h2>${icon('eye', 18)} ${esc(t('Join a game to watch'))}</h2>
          <div class="row"><input class="input code grow" maxlength="12" placeholder="KF-4821" autocapitalize="characters" autocomplete="off" data-code>
          <button class="iconbtn light" style="width:52px;height:52px" data-scan aria-label="${esc(t('Scan QR or code'))}">${icon('scan', 24)}</button></div>
          <button class="btn dark block" data-join>${esc(t('Watch'))}</button></div>
        ${isStandalone() ? '' : `<button class="card row" style="text-align:left;width:100%" data-install>${icon('download', 22)}<div class="grow"><div class="bold">${esc(t('Install app'))}</div><div class="small muted">${esc(t('Add Baithak to your home screen'))}</div></div>${icon('right', 18)}</button>`}
      </div>${tabbar('games')}</div>`;
    bindLang(root, draw);
  };
  draw();
  root.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if ('join' in b.dataset) { const c = parseCode(root.querySelector('[data-code]').value); if (!c) return toast(t('That does not look like a room code. Example: KF-4821'), 'bad'); location.hash = '#/r/' + c; }
    if ('scan' in b.dataset) openScanner((c) => { location.hash = '#/r/' + c; });
    if ('install' in b.dataset) installApp();
  };
  root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-code]')) root.querySelector('[data-join]').click(); };
  return () => { root.onclick = null; root.onkeydown = null; };
}

export async function renderRooms(app, root) {
  skeleton(root);
  const games = await loadAllGames();
  const byId = Object.fromEntries(games.map((g) => [g.id, g]));
  let mine = [];
  try { mine = await app.store.rooms.listMine(app.user.uid); } catch (e) { toast(t('Could not load your rooms'), 'bad'); }
  const watched = ls.get('baithak:watched', []).filter((w) => !mine.some((m) => m.code === w.code));
  const row = (r) => {
    const g = byId[r.game]; let sum = null;
    try { sum = g && g.summary(JSON.parse(r.data)); } catch { /* ignore */ }
    const top = sum && sum.rows[0];
    return `<a class="card row" style="text-decoration:none" href="#/r/${esc(r.code)}"><span class="gi avatar lg" style="background:var(--paper)">${g ? g.icon : ''}</span>
      <div class="grow"><div class="bold">${esc(g ? t(g.name) : r.game)} · ${esc(r.code)}</div>
      <div class="small muted">${sum ? esc(sum.line) : ''}${top ? ' · ' + esc(top.name) + ' ' + top.total : ''}</div>
      <div class="tiny muted">${esc(timeAgo(r.updatedAt || Date.now()))}</div></div>
      ${sum && sum.done ? `<span class="badge">${esc(t('Finished'))}</span>` : `<span class="badge ok">${esc(t('Live'))}</span>`}
      <button class="iconbtn light" data-del="${esc(r.code)}" aria-label="${esc(t('Delete room'))}">${icon('trash', 20)}</button></a>`;
  };
  root.innerHTML = `<div class="screen">${topbar({ title: t('Your rooms'), sub: t('Games you host') })}
    <div class="body pad-b">
      ${mine.length ? mine.map(row).join('') : `<div class="card center muted">${esc(t('No rooms yet. Pick a game on the Games tab to create one.'))}</div>`}
      ${watched.length ? `<h2 style="font-size:18px">${esc(t('Recently watched'))}</h2>${watched.map((w) => `<a class="card row" style="text-decoration:none" href="#/r/${esc(w.code)}">${icon('eye', 20)}<div class="grow bold">${esc(w.name || w.code)}</div><span class="muted small">${esc(w.code)}</span></a>`).join('')}` : ''}
    </div>${tabbar('rooms')}</div>`;
  root.onclick = async (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (await confirmSheet({ title: t('Delete this room?'), text: t('Watchers will lose access. This cannot be undone.'), ok: 'Delete', danger: true })) {
      await app.store.rooms.remove(b.dataset.del); renderRooms(app, root);
    }
  };
}

export async function renderProfile(app, root) {
  const games = await loadAllGames();
  const prof = app.profile;
  const draw = () => {
    const hist = prof.history || [];
    const wins = {};
    hist.forEach((h) => (h.rows || []).filter((r) => r.rank === 1).forEach((r) => { wins[r.name] = (wins[r.name] || 0) + 1; }));
    const hall = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 5);
    root.innerHTML = `<div class="screen">${topbar({ title: t('Profile'), right: langToggle() })}
      <div class="body pad-b">
        <div class="card stack"><div class="row">${avatar({ name: app.user.name, color: 0 }, 'lg')}
          <div class="grow"><div class="bold" style="font-size:18px">${esc(app.user.name)}</div><div class="small muted">${esc(app.user.email || (app.user.isGuest ? t('Guest') : ''))}</div></div></div>
          <div class="row"><input class="input grow" maxlength="20" value="${esc(app.user.name)}" data-name aria-label="${esc(t('Your name'))}"><button class="btn dark small" data-savename>${esc(t('Save'))}</button></div></div>
        ${app.user.isGuest && app.store.mode === 'firebase' ? `<div class="note">${esc(t('You are a guest. If you clear this browser you will lose your rooms. Sign in with Google to keep them.'))}</div>` : ''}
        <div class="card stack"><h2>${esc(t('Hall of fame'))}</h2>
          ${hall.length ? hall.map(([n, w], i) => `<div class="row"><span style="width:24px">${['🥇', '🥈', '🥉'][i] || i + 1}</span><b class="grow">${esc(n)}</b><span class="badge gold">${w} ${esc(t('wins'))}</span></div>`).join('') : `<p class="muted small">${esc(t('Finished games show up here.'))}</p>`}</div>
        <div class="card stack"><h2>${esc(t('Your regulars'))}</h2>
          <div class="row wrap" style="gap:6px">${(prof.regulars || []).map((n) => `<span class="chip">${esc(n)} <button class="iconbtn light" style="width:28px;height:28px;border:0" data-rmreg="${esc(n)}" aria-label="remove">${icon('close', 14)}</button></span>`).join('') || `<span class="muted small">${esc(t('Names you add to games are remembered here.'))}</span>`}</div></div>
        <div class="card stack"><h2>${esc(t('History'))}</h2>
          ${hist.length ? hist.slice(0, 8).map((h) => `<div class="row small"><span class="grow"><b>${esc(h.game)}</b> · ${esc(h.rows && h.rows[0] ? h.rows[0].name : '')} ${esc(t('won'))}</span><span class="muted">${esc(timeAgo(h.ts))}</span></div>`).join('') : `<p class="muted small">–</p>`}</div>
        ${isStandalone() ? '' : `<button class="btn ghost block" data-install>${icon('download', 20)} ${esc(t('Install app'))}</button>`}
        <button class="btn danger block" data-signout>${esc(t('Sign out'))}</button>
        <p class="tiny muted center">Baithak ${esc(APP_VERSION)} · ${esc(app.store.mode === 'firebase' ? t('Live mode') : t('Demo mode'))}</p>
      </div>${tabbar('me')}</div>`;
    bindLang(root, () => draw());
  };
  draw();
  root.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if ('savename' in b.dataset) { await app.store.auth.updateName(root.querySelector('[data-name]').value); app.user = app.store.auth.current(); toast(t('Saved'), 'ok'); draw(); }
    if (b.dataset.rmreg) { prof.regulars = (prof.regulars || []).filter((n) => n !== b.dataset.rmreg); await app.saveProfile(); draw(); }
    if ('install' in b.dataset) installApp();
    if ('signout' in b.dataset) { await app.store.auth.signOut(); location.hash = '#/'; }
  };
}
