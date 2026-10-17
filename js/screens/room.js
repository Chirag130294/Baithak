// A live room. The host sees the editable screen, everyone else gets the same screen read-only, updating in real time.
import { esc, ls, timeAgo } from '../core/util.js';
import { t } from '../core/i18n.js';
import { icon, toast, openSheet, confirmSheet } from '../core/ui.js';
import { gameForCode } from '../core/games.js';
import { qrSvg } from '../core/qr.js';
import { roomUrl, copyText, shareText, shareCardImage } from '../core/share.js';
import { openScanner } from '../core/scan.js';
import { installApp, isStandalone } from '../core/pwa.js';
import { topbar, skeleton, langToggle, bindLang } from './common.js';

function msgScreen(root, title, text, extra = '') {
  root.innerHTML = `<div class="screen">${topbar({ title, back: '#/' })}<div class="body"><div class="card center stack"><p>${esc(text)}</p>${extra}</div></div></div>`;
}

export async function renderRoom(app, root, code) {
  skeleton(root);
  const game = await gameForCode(code);
  if (!game) return msgScreen(root, t('Room'), t('That code does not match any game in this version.'));
  let room;
  try { room = await app.store.rooms.get(code); } catch (e) { return msgScreen(root, t('Room'), t('Could not reach the server. Check your internet and try again.'), `<button class="btn dark" onclick="location.reload()">${esc(t('Try again'))}</button>`); }
  if (!room) return msgScreen(root, t('Room not found'), t('No room with code {code}. Check the code with the host.', { code }));
  if (room.game !== game.id) return msgScreen(root, t('Room'), t('This room uses a game that is not installed.'));

  const isHost = !!(app.user && app.user.uid === room.hostUid);
  let state;
  try { state = JSON.parse(room.data); } catch { return msgScreen(root, t('Room'), t('This room has broken data.')); }

  // remember for "Continue playing" and "Recently watched"
  const title = room.title || t(game.name);
  ls.set('baithak:lastRoom', { code, name: title });
  if (!isHost) {
    const w = ls.get('baithak:watched', []).filter((x) => x.code !== code);
    w.unshift({ code, name: title + ' · ' + t(game.name) }); ls.set('baithak:watched', w.slice(0, 12));
  }

  root.innerHTML = `<div class="screen" data-roomscreen>
    <div data-top></div><div data-game style="flex:1;display:flex;flex-direction:column"></div></div>`;
  const topEl = root.querySelector('[data-top]'), gameEl = root.querySelector('[data-game]');
  let watching = 1, gone = false;

  const drawTop = () => {
    topEl.innerHTML = topbar({
      title: title,
      sub: `${code} · ${isHost ? t('Host') : t('View only')} · ${watching} ${t('watching')}`,
      back: app.user ? '#/rooms' : '#/',
      right: `<span class="livedot ${gone ? 'off' : ''}" title="${esc(t('Live'))}"></span><button class="iconbtn" data-invite aria-label="${esc(t('Invite'))}">${icon('qr', 22)}</button><button class="iconbtn" data-menu aria-label="Menu">${icon('menu', 22)}</button>`
    });
  };
  drawTop();

  // ---- saving (host) ----
  let lastData = room.data, timer = 0, pending = null, doneLogged = state && game.summary(state).done;
  const flush = async () => {
    if (!pending) return;
    const st = pending; pending = null; timer = 0;
    const data = JSON.stringify(st);
    lastData = data;
    const sum = game.summary(st);
    try {
      await app.store.rooms.update(code, { data, updatedAt: Date.now(), status: sum.done ? 'done' : 'live' });
      if (sum.done && !doneLogged) {
        doneLogged = true;
        const h = app.profile.history || [];
        h.unshift({ code, game: game.name, ts: Date.now(), rows: sum.rows.slice(0, 10) });
        app.profile.history = h.slice(0, 50); app.saveProfile();
      }
      if (!sum.done) doneLogged = false;
    } catch (e) { toast(t('Could not save. Check your internet. Retrying…'), 'bad'); pending = st; timer = setTimeout(flush, 3000); }
  };
  const save = (st) => { state = st; pending = st; clearTimeout(timer); timer = setTimeout(flush, 200); };

  const ctx = {
    state, isHost, code, user: app.user, save, toast,
    regulars: app.profile.regulars || [],
    rememberRegular: (n) => { const r = new Set(app.profile.regulars || []); r.add(n); app.profile.regulars = [...r].slice(-30); app.saveProfile(); },
    shareCard: (card) => shareCardImage({ ...card, footer: 'Baithak · ' + code }, `baithak-${code}.png`, `${card.title} · ${card.subtitle}`)
  };
  let view;
  try { view = game.mount(gameEl, ctx); } catch (e) { console.error(e); gameEl.innerHTML = `<div class="body"><div class="note">${esc(t('Something went wrong drawing this game.'))}</div></div>`; }

  // ---- live updates ----
  const offRoom = app.store.rooms.watch(code, (r, err) => {
    if (err) { gone = true; drawTop(); return; }
    if (!r) { gone = true; drawTop(); toast(t('This room was deleted by the host.'), 'bad'); return; }
    gone = false;
    if (r.data === lastData) return; // our own write coming back
    try { const st = JSON.parse(r.data); lastData = r.data; state = st; view && view.update(st); } catch { /* ignore a half-written update */ }
  });
  const leave = app.store.presence.join(code);
  const offPresence = app.store.presence.watch(code, (n) => { watching = Math.max(1, n); drawTop(); });

  // ---- invite, menu ----
  const inviteSheet = () => {
    const url = roomUrl(code);
    const svg = qrSvg(url, { size: 240 });
    const sh = openSheet(`<h2>${esc(t('Invite friends'))}</h2>
      <div class="center stack" style="align-items:center">
        <div style="background:#fff;padding:10px;border-radius:18px;border:1px solid var(--line)">${svg || `<p class="muted small">${esc(t('QR needs a shorter link. Share the code instead.'))}</p>`}</div>
        <div style="font-size:34px;font-weight:700;letter-spacing:3px">${esc(code)}</div>
        <p class="small muted">${esc(t('Friends scan the QR, open the link, or type the code on the Games tab. They can only watch.'))}</p>
        ${app.store.mode === 'local' ? `<p class="note">${esc(t('Demo mode: only phones using this same browser can see the room. Set up Firebase to watch from other phones (README step 2).'))}</p>` : ''}
        <div class="row" style="gap:8px;width:100%"><button class="btn ghost grow" data-copy>${icon('copy', 18)} ${esc(t('Copy link'))}</button><button class="btn primary grow" data-share>${icon('share', 18)} ${esc(t('Share'))}</button></div>
      </div>`);
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if ('copy' in b.dataset) copyText(url);
      if ('share' in b.dataset) shareText(`${t('Watch our {game} live', { game: t(game.name) })} · ${code}`, url);
    });
  };
  const menuSheet = () => {
    const sh = openSheet(`<h2>${esc(title)}</h2><div class="stack">
      <button class="btn ghost block" data-m="invite">${icon('qr', 20)} ${esc(t('Invite'))}</button>
      <button class="btn ghost block" data-m="scan">${icon('scan', 20)} ${esc(t('Join another room'))}</button>
      ${isStandalone() ? '' : `<button class="btn ghost block" data-m="install">${icon('download', 20)} ${esc(t('Install app'))}</button>`}
      <div class="row between"><span>${esc(t('Language'))}</span>${langToggle()}</div>
      ${isHost ? `<button class="btn danger block" data-m="delete">${icon('trash', 20)} ${esc(t('Delete room'))}</button>` : ''}
      <button class="btn dark block" data-close>${esc(t('Close'))}</button></div>`);
    bindLang(sh.el, () => { sh.close(); renderRoom(app, root, code); });
    sh.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      sh.close();
      if (b.dataset.m === 'invite') inviteSheet();
      if (b.dataset.m === 'scan') openScanner((c) => { location.hash = '#/r/' + c; });
      if (b.dataset.m === 'install') installApp();
      if (b.dataset.m === 'delete' && await confirmSheet({ title: t('Delete this room?'), text: t('Watchers will lose access. This cannot be undone.'), ok: 'Delete', danger: true })) { await app.store.rooms.remove(code); location.hash = '#/rooms'; }
    });
  };
  topEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if ('invite' in b.dataset) inviteSheet();
    if ('menu' in b.dataset) menuSheet();
  });
  let inviteTimer = 0;
  if (isHost && state.rounds && state.rounds.length === 0 && !sessionStorage.getItem('baithak:invited:' + code)) {
    try { sessionStorage.setItem('baithak:invited:' + code, '1'); } catch { /* ignore */ }
    inviteTimer = setTimeout(inviteSheet, 500);
  }

  return () => { clearTimeout(inviteTimer); clearTimeout(timer); if (pending) flush(); offRoom && offRoom(); offPresence && offPresence(); leave && leave(); view && view.destroy && view.destroy(); };
}
