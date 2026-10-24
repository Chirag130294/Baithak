// Home (games), Rooms list and Profile. Bottom tab bar switches between them.
import { esc, parseCode, timeAgo, ls } from '../core/util.js';
import * as guard from '../core/guard.js';
import { t, getLang } from '../core/i18n.js';
import { icon, toast, confirmSheet, avatar, openSheet } from '../core/ui.js';
import { openScanner } from '../core/scan.js';
import { installApp, isStandalone, openInstallHelp, onInstallChange, maybeNudge } from '../core/pwa.js';
import { openSettings } from '../core/settings.js';
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
        ${recent ? `<a class="card saffron row controw" style="text-decoration:none" href="#/r/${esc(recent.code)}"><span class="avatar" style="background:var(--on);color:var(--on-ink)">${icon('play', 16)}</span>
          <div class="grow"><div class="bold">${esc(t('Continue playing'))}</div><div class="tiny muted">${esc(recent.name)} · ${esc(recent.code)}</div></div>${icon('right', 18)}</a>` : ''}
        <div class="sec-title"><h2>${esc(t('Games'))}</h2><span class="tiny muted">${esc(t('More games coming'))}</span></div>
        <div class="gtiles">${games.map((g, i) => `<a class="gtile" href="#/new/${esc(g.id)}" style="--i:${i};text-decoration:none;color:inherit"><span class="gi">${g.icon}</span>
          <span class="gtx"><span class="bold gname">${esc(t(g.name))}</span><span class="tiny muted gblurb">${esc(t(g.blurb))}</span></span></a>`).join('')}</div>
        ${loadErrors().size ? `<div class="note">${esc(t('Some games could not load.'))}</div>` : ''}
        <div class="card stack joincard"><div class="label">${icon('eye', 14)} ${esc(t('Join a game to watch'))}</div>
          <div class="row"><input class="input code grow" maxlength="80" placeholder="KF-7H4K-9QXM" autocapitalize="characters" autocomplete="off" spellcheck="false" data-code aria-label="${esc(t('Room code'))}">
          <button class="iconbtn light" data-scan aria-label="${esc(t('Scan QR or code'))}">${icon('scan', 22)}</button>
          <button class="btn dark" data-join>${esc(t('Watch'))}</button></div><p class="note" data-lockmsg hidden role="status"></p></div>
        ${isStandalone() ? '' : `<button class="card row instrow" data-install>${icon('download', 20)}<div class="grow"><div class="bold">${esc(t('Install app'))}</div><div class="tiny muted">${esc(t('Add Baithak to your home screen'))}</div></div>${icon('right', 16)}</button>`}
      </div><div class="crafted" aria-label="Crafted by Chirag"><span>Crafted by</span> <b>Chirag</b></div>${tabbar('games')}</div>`;
    bindLang(root, draw);
    if (stopGuard) stopGuard(); stopGuard = guard.bindJoinGuard(root, t);
  };
  let stopGuard = null;
  draw();
  const nudge = setTimeout(() => maybeNudge('login'), 2600);
  root.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if ('join' in b.dataset) {
      if (guard.status().blocked) { stopGuard.refresh(); return; }
      const c = parseCode(root.querySelector('[data-code]').value);
      if (!c) { const s = guard.fail(); stopGuard.refresh(); return toast(s.blocked ? t('Too many wrong codes. Try again in {t}.', { t: guard.fmt(s.ms) }) : t('That does not look like a room code. Example: KF-7H4K-9QXM'), 'bad'); }
      location.hash = '#/r/' + c;
    }
    if ('scan' in b.dataset) openScanner((c) => { location.hash = '#/r/' + c; });
    if ('custom' in b.dataset) openSettings();
    if ('install' in b.dataset) installApp();
  };
  root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-code]')) root.querySelector('[data-join]').click(); };
  return () => { clearTimeout(nudge); if (stopGuard) stopGuard(); root.onclick = null; root.onkeydown = null; };
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
      <button class="iconbtn light" data-del="${esc(r.code)}" aria-label="${esc(t('Remove'))}">${icon('trash', 20)}</button></a>`;
  };
  root.innerHTML = `<div class="screen">${topbar({ title: t('Your rooms'), sub: t('Games you host') })}
    <div class="body pad-b">
      ${mine.length ? mine.map(row).join('') : `<div class="card center muted">${esc(t('No rooms yet. Pick a game on the Games tab to create one.'))}</div>`}
      ${watched.length ? `<h2 style="font-size:18px">${esc(t('Recently watched'))}</h2>${watched.map((w) => `<a class="card row" style="text-decoration:none" href="#/r/${esc(w.code)}">${icon('eye', 20)}<div class="grow bold">${esc(w.name || w.code)}</div><span class="muted small">${esc(w.code)}</span></a>`).join('')}` : ''}
    </div>${tabbar('rooms')}</div>`;
  root.onclick = async (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (await confirmSheet({ title: t('Remove from your list?'), text: t('The room and its audit log stay saved. It just disappears from this list.'), ok: 'Remove', danger: true })) {
      await app.store.rooms.remove(b.dataset.del, app.user.uid); renderRooms(app, root);
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
        <div class="menulist">
          <button type="button" class="mrow" data-custom><span class="ic">${icon('gear', 18)}</span><span class="grow">${esc(t('Customize'))}<small>${esc(t('Colour theme'))} · ${esc(t('Look'))}</small></span>${icon('right', 16)}</button>
          ${isStandalone() ? '' : `<button type="button" class="mrow" data-install><span class="ic">${icon('download', 18)}</span><span class="grow">${esc(t('Install app'))}</span>${icon('right', 16)}</button>`}
          <button type="button" class="mrow danger" data-signout><span class="ic">${icon('lock', 18)}</span><span class="grow">${esc(t('Sign out'))}</span></button>
        </div>
        <p class="tiny muted center">Baithak ${esc(APP_VERSION)} · ${esc(app.store.mode === 'firebase' ? t('Live mode') : t('Demo mode'))}</p>
      </div>${tabbar('me')}</div>`;
    bindLang(root, () => draw());
  };
  draw();
  root.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if ('savename' in b.dataset) { await app.store.auth.updateName(root.querySelector('[data-name]').value); app.user = app.store.auth.current(); toast(t('Saved'), 'ok'); draw(); }
    if (b.dataset.rmreg) { prof.regulars = (prof.regulars || []).filter((n) => n !== b.dataset.rmreg); await app.saveProfile(); draw(); }
    if ('custom' in b.dataset) openSettings();
    if ('install' in b.dataset) installApp();
    if ('signout' in b.dataset) { await app.store.auth.signOut(); location.hash = '#/'; }
  };
}
