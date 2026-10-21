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
