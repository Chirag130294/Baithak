// A live room. The host sees the editable screen, everyone else gets the same screen read-only, updating in real time.
// Every score, edit and undo is written to an append-only audit log. When the night is over the host locks the room.
import { esc, ls } from '../core/util.js';
import * as guard from '../core/guard.js';
import { t } from '../core/i18n.js';
import { icon, toast, openSheet, confirmSheet } from '../core/ui.js';
import { gameForCode } from '../core/games.js';
import { qrSvg } from '../core/qr.js';
import { roomUrl, copyText, shareText, openSharePicture } from '../core/share.js';
import { openScanner } from '../core/scan.js';
import { installApp, isStandalone } from '../core/pwa.js';
import { keepAwake, allowSleep, setKeepAwake, isOn as keepAwakeOn, supported as wakeSupported } from '../core/wake.js';
import { describeChanges, makeEntry, sha256, totalsSnapshot, auditRowHtml, auditCsv, ACTION_LABEL } from '../core/audit.js';
import { shareCsv } from '../core/export.js';
import { mountReactions } from '../core/reactions.js';
import { openSettings } from '../core/settings.js';
import { pref } from '../core/prefs.js';
import { maybeNudge } from '../core/pwa.js';
import { fixDuplicates } from '../core/names.js';
import { animLevel, setAnimLevel } from '../core/anim.js';
import { topbar, skeleton, langToggle, bindLang } from './common.js';
import { menuRow } from '../core/shell.js';

function msgScreen(root, title, text, extra = '') {
  root.innerHTML = `<div class="screen">${topbar({ title, back: '#/' })}<div class="body"><div class="card center stack"><p>${esc(text)}</p>${extra}</div></div></div>`;
}

const isDenied = (e) => /PERMISSION_DENIED|permission denied/i.test(String(e && (e.code || '')) + ' ' + String(e && e.message || ''));

// Shown instead of a room while this phone is cooling off after too many wrong codes. Rooms opened before still work.
function lockScreen(app, root) {
  root.innerHTML = `<div class="screen">${topbar({ title: t('Please wait'), back: '#/' })}<div class="body"><div class="card center stack">
    <p>${esc(t('Too many wrong codes.'))}</p><div class="lockclock" data-count aria-live="polite"></div>
    <p class="small muted">${esc(t('Rooms you opened before still work. Check the code with the host and try again when the timer ends.'))}</p></div></div></div>`;
  const el = root.querySelector('[data-count]');
  let iv = 0;
  const tick = () => { const s = guard.status(); if (!s.blocked) { clearInterval(iv); app.refresh(); return; } el.textContent = guard.fmt(s.ms); };
  iv = setInterval(tick, 500); tick();
  return () => clearInterval(iv);
}

// Private room: the host chose a PIN. The database refuses to show the room until the right PIN has been entered.
function pinScreen(app, root, code) {
  root.innerHTML = `<div class="screen">${topbar({ title: t('Private room'), sub: code, back: '#/' })}<div class="body"><div class="card stack center">
    <div class="label">${icon('lock', 14)} ${esc(t('This room needs a PIN. Ask the host.'))}</div>
    <input class="input code" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" data-code placeholder="••••" aria-label="${esc(t('Room PIN'))}">
    <p class="note" data-lockmsg hidden role="status"></p><p class="note" data-err hidden role="alert" style="background:var(--bad-soft);color:var(--bad)"></p>
    <button class="btn primary block" data-join>${esc(t('Unlock'))}</button></div></div></div>`;
  const input = root.querySelector('[data-code]'), btn = root.querySelector('[data-join]'), err = root.querySelector('[data-err]');
  const stop = guard.bindJoinGuard(root, t);
  const say = (m) => { err.textContent = m; err.hidden = !m; };
  const submit = async () => {
    if (guard.status().blocked) { stop.refresh(); return; }
    const pin = input.value.replace(/\D/g, '');
    if (pin.length < 4) { say(t('Type the 4 to 6 digit PIN.')); return; }
    btn.disabled = true; say('');
    try { await app.store.rooms.unlock(code, await sha256(`${code}:${pin}`)); guard.ok(code); app.refresh(); }
    catch (e) {
      btn.disabled = false;
      if (isDenied(e)) { guard.fail(); stop.refresh(); say(t('That PIN is not right.')); input.value = ''; input.focus(); }
      else say(t('Could not reach the server. Check your internet and try again.'));
    }
  };
  root.onclick = (e) => { if (e.target.closest('[data-join]')) submit(); };
  root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-code]')) submit(); };
  setTimeout(() => input.focus(), 50);
  return () => { stop(); root.onclick = null; root.onkeydown = null; };
}

export async function renderRoom(app, root, code) {
  skeleton(root);
  const mine = !!(app.justCreated && app.justCreated.code === code);
  if (!mine && !guard.isKnown(code) && guard.status().blocked) return lockScreen(app, root);
  const wrong = (title, text, extra = '') => {
    const s = guard.fail();
    return msgScreen(root, title, text + (s.blocked ? ' ' + t('Too many wrong codes. Try again in {t}.', { t: guard.fmt(s.ms) }) : ''), extra);
  };
  const game = await gameForCode(code);
  if (!game) return wrong(t('Room'), t('That code does not match any game in this version.'));
  let room;
  const fresh = mine ? app.justCreated : null; app.justCreated = null;
  try { room = fresh || await app.store.rooms.get(code); }
  catch (e) {
    if (isDenied(e)) return pinScreen(app, root, code);
    return msgScreen(root, t('Room'), t('Could not reach the server. Check your internet and try again.'), `<button class="btn dark" onclick="location.reload()">${esc(t('Try again'))}</button>`);
  }
  if (!room) return wrong(t('Room not found'), t('No room with code {code}. Check the code with the host.', { code }));
  if (room.game !== game.id) return msgScreen(root, t('Room'), t('This room uses a game that is not installed.'));
  guard.ok(code);

  const isHost = !!(app.user && app.user.uid === room.hostUid);
  const locked = () => room.status === 'completed';
  let state;
  const tidy = (st) => { if (st && Array.isArray(st.players)) fixDuplicates(st.players); return st; };
  try { state = tidy(JSON.parse(room.data)); } catch { return msgScreen(root, t('Room'), t('This room has broken data.')); }

  const title = room.title || t(game.name);
  ls.set('baithak:lastRoom', { code, name: title });
  if (!isHost) {
    const w = ls.get('baithak:watched', []).filter((x) => x.code !== code);
    w.unshift({ code, name: title + ' · ' + t(game.name) }); ls.set('baithak:watched', w.slice(0, 12));
  }

  root.innerHTML = `<div class="screen room" data-roomscreen>
    <div data-top style="flex:none;position:relative;z-index:20"></div><div data-game style="flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto"></div></div>`;
  const topEl = root.querySelector('[data-top]'), gameEl = root.querySelector('[data-game]');
  let watching = 1, gone = false;

  const drawTop = () => {
    topEl.innerHTML = '';
    const html = topbar({
      compact: true,
      title,
      subHtml: `<span>${esc(code)}</span><span style="opacity:.6">·</span><span>${esc(locked() ? t('Locked') : isHost ? t('Host') : t('View only'))}</span>${locked() ? icon('lock', 13, 2.2) : ''}`,
      back: app.user ? '#/rooms' : '#/',
      right: `<span class="livepill" title="${esc(t('Live'))}"><span class="livedot ${gone ? 'off' : ''}"></span>${icon('eye', 15, 2.2)}${watching}</span><button class="iconbtn" data-invite aria-label="${esc(t('Invite'))}">${icon('qr', 20)}</button><button class="iconbtn" data-menu aria-label="Menu">${icon('menu', 20)}</button>`
    });
    topEl.innerHTML = html + (locked() ? `<div class="lockbar">${icon('lock', 16, 2.2)}<span>${esc(t('Room locked. Final scores.'))}</span>${isHost ? `<button type="button" data-newgame>${esc(t('New game, same players'))}</button>` : ''}</div>` : '');
  };
  drawTop();

  // ---- saving: scores + audit entries go to the database together ----
  let lastData = room.data, timer = 0, pending = null, queue = [], failing = false;
  const flush = async (extra = {}) => {
    if (!pending && !queue.length && !extra.lock) return true;
    const st = pending || state; const entries0 = queue; pending = null; queue = []; timer = 0;
    const data = JSON.stringify(st);
    const hash = await sha256(data);
    const totals = totalsSnapshot(game.summary(st).rows);
    const entries = entries0.concat(extra.entries || []).map((c) => makeEntry({ ...c, user: app.user, totals, hash }));
    lastData = data;
    try {
      await app.store.rooms.commit(code, { data, entries, lock: !!extra.lock });
      failing = false; return true;
    } catch (e) {
      if (/locked|completed|PERMISSION/i.test(String(e && (e.message || e.code)))) { toast(t('This room is locked. Changes were not saved.'), 'bad'); return false; }
      toast(t('Could not save. Check your internet. Retrying…'), 'bad');
      pending = st; queue = entries0.concat(queue); failing = true; timer = setTimeout(() => flush(), 3000);
      return false;
    }
  };
  const save = (st) => {
    if (locked()) { toast(t('This room is locked.'), 'bad'); return; }
    const prev = state; state = st;
    describeChanges(game, prev, st).forEach((c) => queue.push(c));
    pending = st; clearTimeout(timer); timer = setTimeout(() => flush(), 200);
    checkDone();
  };

  // ---- lock the room (host, after the game ended) ----
  const lockRoom = async () => {
    if (!isHost || locked()) return;
    if (!game.summary(state).done) { toast(t('End the game first, then lock the room.'), 'bad'); return; }
    const sum = game.summary(state);
    const ok = await confirmSheet({ title: t('Lock this room?'), text: t('The final scores are frozen. Nobody can change scores or undo anything. The audit log stays readable.'), ok: 'Lock room', danger: true });
    if (!ok) return;
    clearTimeout(timer);
    const final = sum.rows.map((r) => `${r.rank}. ${r.name} ${r.total}`).join(' · ');
    const done = await flush({ lock: true, entries: [{ action: 'LOCK_ROOM', summary: ('Room locked. Final: ' + final).slice(0, 380) }] });
    if (done) { room = { ...room, status: 'completed', data: JSON.stringify(state) }; drawTop(); mountGame(); toast(t('Room locked.'), 'ok'); }
  };

  const ctx = {
    code, user: app.user, save, toast, lockRoom, roomTitle: title, gameName: t(game.name),
    regulars: app.profile.regulars || [],
    rememberRegular: (n) => { const r = new Set(app.profile.regulars || []); r.add(n); app.profile.regulars = [...r].slice(-30); app.saveProfile(); },
    shareCard: (card) => openSharePicture({ ...card, footer: (title && title !== t(game.name) ? title + ' · ' : '') + code }, `baithak-${code}`, `${card.title} · ${card.subtitle}`)
  };
  let view = null;
  function mountGame() {
    if (view && view.destroy) view.destroy();
    gameEl.innerHTML = '';
    try { view = game.mount(gameEl, { ...ctx, state, isHost: isHost && !locked(), locked: locked(), canLock: isHost && !locked() }); }
    catch (e) { console.error(e); gameEl.innerHTML = `<div class="body"><div class="note">${esc(t('Something went wrong drawing this game.'))}</div></div>`; }
  }
  // a long name is shortened with "..." on small screens: tapping it shows the whole name
  gameEl.addEventListener('click', (e) => { const n = e.target.closest('.nm b, .lbchip b, .plrow .bold'); if (n && n.scrollWidth > n.clientWidth + 1) toast(n.textContent.trim(), ''); });
  keepAwake();
  mountGame();
  const reactions = mountReactions({
    host: gameEl, store: app.store, code,
    getName: () => (app.user && app.user.name) || ls.get('baithak:guestName', '') || t('Guest'),
    getTargets: () => game.summary(state).rows.map((r) => r.name)
  });
  reactions.setHidden(!pref('reactions'));
  // install nudge: for a viewer after a minute of watching; for everyone when the game ends
  let wasDone = !!game.summary(state).done;
  let endNudge = 0;
  const nudgeTimer = isHost ? 0 : setTimeout(() => maybeNudge('viewer'), 60000);
  const checkDone = () => { const d = !!game.summary(state).done; if (d && !wasDone) { clearTimeout(endNudge); endNudge = setTimeout(() => { if (document.querySelector('[data-roomscreen]')) maybeNudge('end'); }, 2800); } wasDone = d; };

  // ---- live updates ----
  const offRoom = app.store.rooms.watch(code, (r, err) => {
    if (err) { gone = true; drawTop(); return; }
    if (!r) { gone = true; drawTop(); toast(t('This room is no longer available.'), 'bad'); return; }
    gone = false;
    const wasLocked = locked();
    room = { ...room, status: r.status };
    if (!wasLocked && locked()) { try { state = JSON.parse(r.data); lastData = r.data; } catch { /* keep */ } drawTop(); mountGame(); toast(t('The host locked this room. Final scores.'), 'ok'); return; }
    if (r.data === lastData) return; // our own write coming back
    try { const st = tidy(JSON.parse(r.data)); lastData = r.data; state = st; view && view.update(st); checkDone(); } catch { /* ignore a half-written update */ }
  });
  const leave = app.store.presence.join(code);
  const offPresence = app.store.presence.watch(code, (n) => { watching = Math.max(1, n); drawTop(); });

  // ---- audit log sheet ----
  const auditSheet = async () => {
    const sh = openSheet(`<h2>${esc(t('Audit log'))}</h2><div class="shimmer" style="height:80px"></div>`);
    let entries = [];
    try { entries = await app.store.rooms.audit(code); } catch { sh.setHtml(`<h2>${esc(t('Audit log'))}</h2><p class="note">${esc(t('Could not load the log.'))}</p>`); return; }
    let integrity = '';
    if (locked()) {
      const lastLock = [...entries].reverse().find((e) => e.action === 'LOCK_ROOM');
      const now = await sha256(room.data);
      integrity = lastLock && lastLock.hash && now
        ? (lastLock.hash === now ? `<div class="note good">✓ ${esc(t('Final scores match the locked record.'))}</div>` : `<div class="note" style="background:var(--bad-soft);color:var(--bad)">⚠ ${esc(t('The room data does not match the locked record.'))}</div>`)
        : '';
    }
    sh.setHtml(`<h2>${esc(t('Audit log'))} <span class="badge">${entries.length}</span></h2>
      <p class="small muted" style="margin-bottom:8px">${esc(t('Every score, edit and undo is recorded here. Entries cannot be changed or deleted.'))}</p>
      ${integrity}
      <div class="stack" style="gap:8px;margin:10px 0">${entries.length ? [...entries].reverse().map(auditRowHtml).join('') : `<p class="muted small">${esc(t('Nothing logged yet.'))}</p>`}</div>
      <div class="row" style="gap:8px"><button class="btn ghost grow" data-csv>${icon('download', 18)} ${esc(t('Export log (CSV)'))}</button><button class="btn dark grow" data-close>${esc(t('Done'))}</button></div>`);
    sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-csv]')) shareCsv(auditCsv(entries, room), `baithak-${code}-audit.csv`, `Baithak ${code} audit log`); });
  };

  // ---- invite, menu ----
  const inviteSheet = () => {
    const url = roomUrl(code);
    const svg = qrSvg(url, { size: 196 });
    const sh = openSheet(`<h2>${esc(t('Invite friends'))}</h2>
      <div class="center stack" style="align-items:center">
        <div class="qrpop" style="background:#fff;padding:10px;border-radius:18px;border:1px solid var(--line)">${svg || `<p class="muted small">${esc(t('QR needs a shorter link. Share the code instead.'))}</p>`}</div>
        <div class="invcode">${esc(code)}</div>
        ${room.private ? `<p class="small" style="margin:0">${icon('lock', 14)} ${esc(t('Private room. Friends need this PIN:'))} <b>${esc(ls.get('baithak:pin:' + code, '') || t('(set by the host)'))}</b></p>` : ''}
        <p class="small muted">${esc(t('Friends scan the QR, open the link, or type the code on the Games tab. They can only watch.'))}</p>
        ${app.store.mode === 'local' ? `<p class="note">${esc(t('Demo mode: only phones using this same browser can see the room. Set up Firebase to watch from other phones (README step 2).'))}</p>` : ''}
      </div><div class="sheet-foot"><button class="btn ghost" data-copy>${icon('copy', 18)} ${esc(t('Copy link'))}</button><button class="btn primary" data-share>${icon('share', 18)} ${esc(t('Share'))}</button></div>`);
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if ('copy' in b.dataset) copyText(url);
      if ('share' in b.dataset) shareText(`${t('Watch our {game} live', { game: t(game.name) })} · ${code}`, url);
    });
  };
  const menuSheet = () => {
    const done = game.summary(state).done;
    const row = (id, ic, label, sub, danger) => menuRow({ id, icon: ic, label, sub, danger });
    const sh = openSheet(`<h2>${esc(title)}</h2><div class="menulist">
      ${isHost && !locked() && done ? row('lock', 'lock', 'Finish and lock room', '', false).replace('class="mrow ', 'class="mrow cta ') : ''}
      ${row('invite', 'qr', 'Invite', code)}
      ${row('audit', 'log', 'Audit log')}
      ${row('custom', 'gear', 'Customize')}
      ${row('scan', 'scan', 'Join another room')}
      ${isStandalone() ? '' : row('install', 'download', 'Install app')}
      ${isHost ? row('remove', 'trash', 'Remove from my list', '', true) : ''}
      <div class="row between menulang"><span>${esc(t('Language'))}</span>${langToggle()}</div>
    </div><div class="sheet-foot"><button class="btn dark" data-close>${esc(t('Close'))}</button></div>`);
    bindLang(sh.el, () => { sh.close(); renderRoom(app, root, code); });
    sh.el.addEventListener('click', async (e) => {
      const al = e.target.closest('[data-animlv]');
      if (al) { setAnimLevel(al.dataset.animlv); al.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === al)); return; }
      const sw = e.target.closest('[data-awake]');
      if (sw) { const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); setKeepAwake(on); return; }
      const b = e.target.closest('[data-m]'); if (!b) return;
      sh.close();   // the menu closes, then the chosen thing opens
      if (b.dataset.m === 'custom') { openSettings({ onChange: (p) => reactions.setHidden(!p.reactions) }); return; }
      if (b.dataset.m === 'audit') auditSheet();
      if (b.dataset.m === 'lock') lockRoom();
      if (b.dataset.m === 'invite') inviteSheet();
      if (b.dataset.m === 'scan') openScanner((c) => { location.hash = '#/r/' + c; });
      if (b.dataset.m === 'install') installApp();
      if (b.dataset.m === 'remove' && await confirmSheet({ title: t('Remove from your list?'), text: t('The room and its audit log stay saved. It just disappears from your Rooms tab.'), ok: 'Remove', danger: true })) { await app.store.rooms.remove(code, app.user && app.user.uid); location.hash = '#/rooms'; }
    });
  };
  topEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if ('invite' in b.dataset) inviteSheet();
    if ('menu' in b.dataset) menuSheet();
    if ('newgame' in b.dataset) { try { sessionStorage.setItem('baithak:prefill', JSON.stringify(state.players.filter((p) => !p.out).map((p) => p.name))); } catch { /* ignore */ } location.hash = '#/new/' + game.id; }
  });
  let inviteTimer = 0;
  if (isHost && !locked() && state.rounds && state.rounds.length === 0 && !sessionStorage.getItem('baithak:invited:' + code)) {
    try { sessionStorage.setItem('baithak:invited:' + code, '1'); } catch { /* ignore */ }
    inviteTimer = setTimeout(inviteSheet, 500);
  }

  return () => { clearTimeout(nudgeTimer); clearTimeout(endNudge); reactions.destroy(); allowSleep(); clearTimeout(inviteTimer); clearTimeout(timer); if (pending || queue.length) flush(); offRoom && offRoom(); offPresence && offPresence(); leave && leave(); view && view.destroy && view.destroy(); };
}
