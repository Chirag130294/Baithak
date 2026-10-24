// Install-to-home-screen support. Android/Chrome gives an install prompt; iPhone needs Share > Add to Home Screen.
import { esc } from './util.js';
import { t } from './i18n.js';
import { openSheet, icon, toast } from './ui.js';

let deferred = null;
const listeners = new Set();
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; listeners.forEach((f) => f()); });
window.addEventListener('appinstalled', () => { deferred = null; toast(t('Installed. Find Baithak on your home screen.'), 'ok'); listeners.forEach((f) => f()); });

export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canPromptInstall = () => !!deferred;

export async function installApp() {
  if (isStandalone()) { toast(t('Already installed')); return; }
  if (deferred) {
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    deferred = null; listeners.forEach((f) => f());
    return;
  }
  openInstallHelp();
}

export function openInstallHelp() {
  const ios = isIOS();
  const step = (n, txt) => `<div class="row" style="align-items:flex-start"><span class="avatar sm" style="background:#F2A71B;color:#12261F">${n}</span><div class="grow">${txt}</div></div>`;
  openSheet(`
    <h2>${esc(t('Install on your phone'))}</h2>
    <div class="stack" style="margin-bottom:12px">
      <div class="card stack"><div class="bold">iPhone / iPad (Safari)</div>
        ${step(1, esc(t('Open this page in Safari.')))}
        ${step(2, esc(t('Tap the Share button (square with an arrow).')) + ' ' + icon('share', 18))}
        ${step(3, esc(t('Scroll and tap "Add to Home Screen", then Add.')))}
      </div>
      <div class="card stack"><div class="bold">Android (Chrome)</div>
        ${step(1, esc(t('Tap the three dots at the top right.')))}
        ${step(2, esc(t('Tap "Install app" or "Add to Home screen".')))}
        ${step(3, esc(t('Open Baithak from your home screen. It works like a normal app.')))}
      </div>
    </div>
    <div class="note info">${esc(ios ? t('On iPhone this only works in Safari, not inside other apps.') : t('If you do not see the option, open this page in Chrome first.'))}</div>
    <button class="btn dark block" style="margin-top:12px" data-close>${esc(t('Got it'))}</button>`);
}

// ---- the install nudge: a friendly popup (not a server push) after the first sign-in, at the end of a game, or after a viewer has watched a while ----
const NKEY = 'baithak:install';
const DAY = 86400000;
const nstate = () => { try { return JSON.parse(localStorage.getItem(NKEY) || '{}') || {}; } catch { return {}; } };
const nsave = (o) => { try { localStorage.setItem(NKEY, JSON.stringify(o)); } catch { /* ignore */ } };
/** Remind me later waits 3 days, then 7, then 30. */
const SNOOZE = [3, 7, 30];
let shownThisSession = false;

export function nudgeDue() {
  if (isStandalone() || shownThisSession || navigator.webdriver) return false;   // (automated test browsers are never nudged)
  const st = nstate();
  if (st.never) return false;
  if (st.until && Date.now() < st.until) return false;
  if (document.querySelector('#sheet-root .sheet')) return false;   // never on top of another popup
  return true;
}
/** reason: 'login' | 'end' | 'viewer' (changes the wording only). */
export function maybeNudge(reason = 'login') {
  if (!nudgeDue()) return false;
  shownThisSession = true;
  const why = { login: 'Open Baithak in one tap, like a real app.', end: 'Nice game! Keep Baithak on your home screen for the next one.', viewer: 'Watching is better full screen. Add Baithak to your home screen.' }[reason] || '';
  const sh = openSheet(`<div class="center stack" style="align-items:center;gap:10px">
      <img class="instico" src="icons/icon-192.png" alt="" width="72" height="72">
      <h2 style="margin:0">${esc(t('Install Baithak'))}</h2>
      <p class="muted" style="margin:0">${esc(t(why))}</p>
      <ul class="instlist"><li>${esc(t('Opens full screen, no browser bars'))}</li><li>${esc(t('Works even with weak internet'))}</li><li>${esc(t('Rejoin your game in one tap'))}</li></ul>
      <button class="btn primary block" data-inst>${icon('download', 20)} ${esc(t('Install app'))}</button>
      <div class="row" style="gap:8px;width:100%"><button class="btn ghost grow" data-later>${esc(t('Remind me later'))}</button><button class="btn ghost grow" data-never>${esc(t('No thanks'))}</button></div>
    </div>`);
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const st = nstate();
    if ('inst' in b.dataset) { st.until = Date.now() + 3 * DAY; nsave(st); sh.close(); setTimeout(installApp, 250); }
    else if ('later' in b.dataset) { const n = st.count || 0; st.count = n + 1; st.until = Date.now() + SNOOZE[Math.min(n, SNOOZE.length - 1)] * DAY; nsave(st); sh.close(); toast(t('OK, we will remind you later')); }
    else if ('never' in b.dataset) { st.never = true; nsave(st); sh.close(); }
  });
  return true;
}
