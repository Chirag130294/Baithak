// Baithak bootstrap: store (Firebase or demo), sign-in gate, hash router, offline support.
import { createStore } from './core/store/index.js';
import { ls, parseCode } from './core/util.js';
import { t, setLang, getLang } from './core/i18n.js';
import { toast } from './core/ui.js';
import './core/prefs.js';
import './core/pwa.js';
import { prefetchGames } from './core/games.js';
import { renderLogin } from './screens/login.js';
import { renderHome, renderRooms, renderProfile } from './screens/home.js';
import { renderSetup } from './screens/setup.js';
import { renderRoom } from './screens/room.js';

const root = document.getElementById('app');
const app = { store: null, user: null, profile: {}, saveProfile: () => {} };
let cleanup = null, routeToken = 0;

function parseRoute() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path] = h.split('?');
  const p = path.split('/').filter(Boolean);
  if (p[0] === 'r' && p[1]) return { name: 'room', code: parseCode(p[1]) || p[1].toUpperCase() };
  if (p[0] === 'new' && p[1]) return { name: 'new', id: p[1] };
  if (p[0] === 'rooms') return { name: 'rooms' };
  if (p[0] === 'me') return { name: 'me' };
  return { name: 'home' };
}

async function go() {
  const token = ++routeToken;
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  document.getElementById('sheet-root').innerHTML = '';
  window.scrollTo(0, 0);
  const r = parseRoute();
  let fn;
  try {
    if (r.name === 'room') fn = await renderRoom(app, root, r.code);          // watching needs no account
    else if (!app.user) fn = renderLogin(app, root);
    else if (r.name === 'new') fn = await renderSetup(app, root, r.id);
    else if (r.name === 'rooms') fn = await renderRooms(app, root);
    else if (r.name === 'me') fn = await renderProfile(app, root);
    else fn = await renderHome(app, root);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="screen"><div class="body"><div class="card stack"><h2>Something went wrong</h2><p class="muted">${String(e && e.message || e).replace(/</g, '&lt;')}</p><a class="btn dark" href="#/">Home</a></div></div></div>`;
  }
  if (token !== routeToken) { if (typeof fn === 'function') fn(); return; }
  cleanup = typeof fn === 'function' ? fn : null;
}

async function loadProfile() {
  if (!app.user) { app.profile = {}; return; }
  try { app.profile = await app.store.profile.get(app.user.uid) || {}; } catch { app.profile = {}; }
}

async function boot() {
  setLang(getLang());
  app.store = await createStore();
  if (app.store.fallbackReason) toast('Demo mode (' + app.store.fallbackReason + ')');
  try { await app.store.auth.completeEmailLink(); } catch (e) { toast(e.message || 'Email link did not work', 'bad'); }
  app.user = app.store.auth.current();
  await Promise.race([loadProfile(), new Promise((r) => setTimeout(r, 1200))]);   // never hold the first screen for a slow profile; it fills in when it arrives
  let timer = 0;
  app.saveProfile = () => { clearTimeout(timer); timer = setTimeout(() => { if (app.user) app.store.profile.save(app.user.uid, app.profile).catch(() => {}); }, 400); };
  app.store.auth.onChange(async (u) => {
    const changed = (u && u.uid) !== (app.user && app.user.uid);
    app.user = u;
    if (changed) { await loadProfile(); go(); } else if (u && app.user) app.user = u;
  });
  app.refresh = go;   // lets a screen redraw the current route (e.g. after a private room is unlocked)
  window.addEventListener('hashchange', go);
  go();
  prefetchGames();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
    // a new version took over while the app was open: offer a reload (never reload by surprise in the middle of a game)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || document.querySelector('.updbar')) return;
      const bar = document.createElement('div'); bar.className = 'updbar'; bar.setAttribute('role', 'status');
      bar.innerHTML = '<span>A new version of Baithak is ready.</span><button type="button">Reload</button><button type="button" class="x" aria-label="Dismiss">✕</button>';
      bar.querySelector('button').addEventListener('click', () => location.reload());
      bar.querySelector('.x').addEventListener('click', () => bar.remove());
      document.body.appendChild(bar);
    });
  }
}

boot().catch((e) => {
  console.error(e);
  root.innerHTML = `<div class="screen"><div class="body"><div class="card stack"><h2>Baithak could not start</h2><p class="muted">${String(e && e.message || e)}</p><button class="btn dark" onclick="location.reload()">Reload</button></div></div></div>`;
});
