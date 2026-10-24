// Sign-in screen. Google, email link and guest. Anyone with a room code can also just watch, no account needed.
import { esc, parseCode } from '../core/util.js';
import * as guard from '../core/guard.js';
import { t } from '../core/i18n.js';
import { icon, suitSvg, toast } from '../core/ui.js';
import { features } from '../config.js';
import { openScanner, canScan } from '../core/scan.js';
import { langToggle, bindLang } from './common.js';
import { installApp, isStandalone } from '../core/pwa.js';

// Turns Firebase error codes into plain instructions.
function friendly(err) {
  const c = (err && err.code) || '';
  if (c === 'auth/operation-not-allowed' || c === 'auth/admin-restricted-operation') return t('This sign-in method is switched off. In Firebase: Authentication > Sign-in method, enable it (Anonymous for guests).');
  if (c === 'auth/unauthorized-domain') return t('This website address is not allowed yet. In Firebase: Authentication > Settings > Authorized domains, add it.');
  if (c === 'auth/network-request-failed') return t('No internet connection. Please try again.');
  if (c === 'auth/too-many-requests') return t('Too many tries. Please wait a few minutes.');
  if (c === 'auth/invalid-email') return t('Type a valid email');
  return (err && err.message) || String(err);
}

export function renderLogin(app, root) {
  const live = app.store.mode === 'firebase';
  const draw = () => {
    root.innerHTML = `<div class="screen hero-screen">
      <div class="row" style="padding:calc(14px + var(--safe-t)) 16px 0;justify-content:flex-end">${langToggle()}</div>
      <div class="loginhero" style="padding:4px 20px 4px;text-align:center">
        <div class="fan">${['S', 'D', 'C', 'H'].map((k) => `<div class="tile">${suitSvg(k, 38)}</div>`).join('')}</div>
        <h1 style="margin-top:4px">Baithak <span style="font-weight:500">· બેઠક</span></h1>
        <p class="lead" style="margin-top:6px;line-height:1.4">${esc(t('Score book and games for your table. Host a game, friends watch live.'))}</p>
      </div>
      <div class="body" style="background:var(--paper);color:var(--ink);border-radius:26px 26px 0 0;margin-top:12px;padding-bottom:calc(24px + var(--safe-b))">
        <div class="stack">
          ${features.google ? `<button class="btn dark block" data-google ${live ? '' : 'data-demo'}><span style="font-weight:800;font-size:19px">G</span> ${esc(t('Continue with Google'))}</button>` : ''}
          ${features.emailLink ? `<button class="btn ghost block" data-emailtoggle>${icon('mail', 20)} ${esc(t('Continue with email link'))}</button>
          <div class="stack hidden" data-emailbox><input class="input" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" data-email><button class="btn primary block" data-emailsend>${esc(t('Send me a sign-in link'))}</button></div>` : ''}
          ${features.phoneLogin ? `<button class="btn ghost block" data-phone>${icon('phone', 20)} ${esc(t('Continue with phone number'))}</button>` : ''}
          ${features.guest ? `<div class="card stack"><div class="label">${esc(t('Just want to play?'))}</div><div class="row"><input class="input grow" maxlength="20" placeholder="${esc(t('Your name'))}" autocomplete="nickname" data-guestname><button class="btn primary" data-guest>${esc(t('Play as guest'))}</button></div></div>` : ''}
          ${!live ? `<div class="note info">${esc(t('Demo mode: everything is saved on this phone only. Google and email sign-in, and live viewing on other phones, switch on after the Firebase setup in the README.'))}</div>` : ''}
        </div>
        <div class="divider">${esc(t('or watch a game'))}</div>
        <div class="card stack">
          <div class="label">${esc(t('Room code'))}</div>
          <div class="row"><input class="input code grow" maxlength="80" placeholder="KF-7H4K-9QXM" autocapitalize="characters" autocomplete="off" spellcheck="false" data-code aria-label="${esc(t('Room code'))}">
            <button class="iconbtn light" data-scan aria-label="${esc(t('Scan QR or code'))}">${icon('scan', 22)}</button>
            <button class="btn dark" data-join>${esc(t('Watch'))}</button></div>
          <p class="note" data-lockmsg hidden role="status"></p>
        </div>
        ${isStandalone() ? '' : `<button class="btn ghost block small" data-install>${icon('download', 18)} ${esc(t('Install app'))}</button>`}
      </div></div>`;
    bindLang(root, draw);
    if (stopGuard) stopGuard(); stopGuard = guard.bindJoinGuard(root, t);
  };
  let stopGuard = null;
  draw();

  const go = (code) => { location.hash = '#/r/' + code; };
  root.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if ('google' in b.dataset) {
        if ('demo' in b.dataset) { toast(t('Google sign-in needs the Firebase setup (README step 2). Use guest for now.')); return; }
        await app.store.auth.signInGoogle();
      } else if ('emailtoggle' in b.dataset) {
        if (!live) { toast(t('Email sign-in needs the Firebase setup (README step 2). Use guest for now.')); return; }
        root.querySelector('[data-emailbox]').classList.toggle('hidden');
      } else if ('emailsend' in b.dataset) {
        const email = root.querySelector('[data-email]').value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { toast(t('Type a valid email'), 'bad'); return; }
        b.disabled = true; await app.store.auth.sendEmailLink(email);
        toast(t('Link sent. If you do not see it in a minute, check Spam or Promotions and tap Not spam.'), 'ok');
        root.querySelector('[data-emailbox]').insertAdjacentHTML('beforeend', `<p class="note">${esc(t('Link sent to {e}. Open it on this phone. If it is not in your inbox, check Spam or Promotions and tap "Not spam" so future links arrive normally.', { e: email }))}</p>`);
        b.disabled = false;
      } else if ('guest' in b.dataset) {
        const name = root.querySelector('[data-guestname]').value.trim();
        if (!name) { toast(t('Type your name first'), 'bad'); root.querySelector('[data-guestname]').focus(); return; }
        await app.store.auth.signInGuest(name);
      } else if ('join' in b.dataset) {
        if (guard.status().blocked) { stopGuard.refresh(); return; }
        const code = parseCode(root.querySelector('[data-code]').value);
        if (!code) { const s = guard.fail(); stopGuard.refresh(); toast(s.blocked ? t('Too many wrong codes. Try again in {t}.', { t: guard.fmt(s.ms) }) : t('That does not look like a room code. Example: KF-7H4K-9QXM'), 'bad'); return; }
        go(code);
      } else if ('scan' in b.dataset) {
        openScanner(go);
      } else if ('install' in b.dataset) {
        installApp();
      } else if ('phone' in b.dataset) {
        toast(t('Phone sign-in is not set up yet.'));
      }
    } catch (err) { b.disabled = false; toast(friendly(err), 'bad'); }
  };
  root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-code]')) root.querySelector('[data-join]').click(); };
  return () => { if (stopGuard) stopGuard(); root.onclick = null; root.onkeydown = null; };
}
