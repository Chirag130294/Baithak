// Sign-in screen. Google, email link and guest. Anyone with a room code can also just watch, no account needed.
import { esc, parseCode } from '../core/util.js';
import { t } from '../core/i18n.js';
import { icon, suitSvg, toast } from '../core/ui.js';
import { features } from '../config.js';
import { openScanner, canScan } from '../core/scan.js';
import { langToggle, bindLang } from './common.js';
import { installApp, isStandalone } from '../core/pwa.js';

export function renderLogin(app, root) {
  const live = app.store.mode === 'firebase';
  const draw = () => {
    root.innerHTML = `<div class="screen" style="background:var(--felt);color:#fff">
      <div class="row" style="padding:calc(14px + var(--safe-t)) 16px 0;justify-content:flex-end">${langToggle()}</div>
      <div style="padding:8px 20px 4px;text-align:center">
        <div class="fan">${['S', 'D', 'C', 'H'].map((k) => `<div class="tile">${suitSvg(k, 38)}</div>`).join('')}</div>
        <h1 style="font-size:40px;margin-top:6px">Baithak <span style="font-weight:500">· બેઠક</span></h1>
        <p style="color:#CFE0D7;margin-top:6px;font-size:16px;line-height:1.4">${esc(t('Score book and games for your table. Host a game, friends watch live.'))}</p>
      </div>
      <div class="body" style="background:var(--paper);color:var(--ink);border-radius:26px 26px 0 0;margin-top:18px;padding-bottom:calc(24px + var(--safe-b))">
        <div class="stack">
          ${features.google ? `<button class="btn dark block" style="min-height:56px" data-google ${live ? '' : 'data-demo'}><span style="font-weight:800;font-size:19px">G</span> ${esc(t('Continue with Google'))}</button>` : ''}
          ${features.emailLink ? `<button class="btn ghost block" style="min-height:56px" data-emailtoggle>${icon('mail', 20)} ${esc(t('Continue with email link'))}</button>
          <div class="stack hidden" data-emailbox><input class="input" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" data-email><button class="btn primary block" data-emailsend>${esc(t('Send me a sign-in link'))}</button></div>` : ''}
          ${features.phoneLogin ? `<button class="btn ghost block" style="min-height:56px" data-phone>${icon('phone', 20)} ${esc(t('Continue with phone number'))}</button>` : ''}
          ${features.guest ? `<div class="card stack"><div class="label">${esc(t('Just want to play?'))}</div><input class="input" maxlength="20" placeholder="${esc(t('Your name'))}" autocomplete="nickname" data-guestname>
            <button class="btn dark block" data-guest>${esc(t('Play as guest'))}</button></div>` : ''}
          ${!live ? `<div class="note info">${esc(t('Demo mode: everything is saved on this phone only. Google and email sign-in, and live viewing on other phones, switch on after the Firebase setup in the README.'))}</div>` : ''}
        </div>
        <div class="divider">${esc(t('or watch a game'))}</div>
        <div class="card stack">
          <div class="label">${esc(t('Room code'))}</div>
          <div class="row"><input class="input code grow" maxlength="12" placeholder="KF-4821" autocapitalize="characters" autocomplete="off" data-code>
            <button class="iconbtn light" style="width:52px;height:52px" data-scan aria-label="${esc(t('Scan QR or code'))}">${icon('scan', 24)}</button></div>
          <button class="btn primary block" data-join>${esc(t('Watch'))}</button>
          ${canScan() ? '' : `<p class="tiny muted">${esc(t('Tip: you can also open the host\'s link or scan their QR with your phone camera.'))}</p>`}
        </div>
        ${isStandalone() ? '' : `<button class="btn ghost block" data-install>${icon('download', 20)} ${esc(t('Install app'))}</button>`}
      </div></div>`;
    bindLang(root, draw);
  };
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
        toast(t('Link sent. Open it on this phone.'), 'ok');
        b.disabled = false;
      } else if ('guest' in b.dataset) {
        const name = root.querySelector('[data-guestname]').value.trim();
        if (!name) { toast(t('Type your name first'), 'bad'); root.querySelector('[data-guestname]').focus(); return; }
        await app.store.auth.signInGuest(name);
      } else if ('join' in b.dataset) {
        const code = parseCode(root.querySelector('[data-code]').value);
        if (!code) { toast(t('That does not look like a room code. Example: KF-4821'), 'bad'); return; }
        go(code);
      } else if ('scan' in b.dataset) {
        openScanner(go);
      } else if ('install' in b.dataset) {
        installApp();
      } else if ('phone' in b.dataset) {
        toast(t('Phone sign-in is not set up yet.'));
      }
    } catch (err) { b.disabled = false; toast(err.message || String(err), 'bad'); }
  };
  root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('[data-code]')) root.querySelector('[data-join]').click(); };
  return () => { root.onclick = null; root.onkeydown = null; };
}
