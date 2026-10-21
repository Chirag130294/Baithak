// Pieces every hub screen uses: top bar, bottom tabs, language toggle.
import { esc } from '../core/util.js';
import { t, getLang, setLang } from '../core/i18n.js';
import { icon } from '../core/ui.js';

export function topbar({ title, sub = '', subHtml = '', back = null, right = '', compact = false }) {
  return `<header class="topbar${compact ? ' compact' : ''}">
    ${back ? `<a class="iconbtn" href="${esc(back)}" aria-label="${esc(t('Back'))}">${icon('back', 22)}</a>` : ''}
    <div class="grow"><h1>${esc(title)}</h1>${subHtml ? `<div class="sub">${subHtml}</div>` : sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
    ${right}
  </header>`;
}

export function tabbar(active) {
  const tab = (id, href, ic, label) => `<a href="${href}" class="${active === id ? 'on' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic, 24)}<span>${esc(t(label))}</span></a>`;
  return `<nav class="tabbar" aria-label="Main">${tab('games', '#/', 'grid', 'Games')}${tab('rooms', '#/rooms', 'log', 'Rooms')}${tab('me', '#/me', 'user', 'Profile')}</nav>`;
}

export function langToggle(onChange) {
  const cur = getLang();
  return `<div class="seg onDark" style="width:96px;flex:none" role="group" aria-label="${esc(t('Language'))}">
    <button type="button" class="${cur === 'en' ? 'on' : ''}" data-lang="en" style="min-height:40px">EN</button>
    <button type="button" class="${cur === 'gu' ? 'on' : ''}" data-lang="gu" style="min-height:40px">ગુ</button></div>`;
}
export function bindLang(root, onChange) {
  root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); onChange(); }));
}

export function skeleton(root) { root.innerHTML = `<div class="screen"><div class="body"><div class="shimmer" style="height:90px"></div><div class="shimmer" style="height:90px"></div><div class="shimmer" style="height:90px"></div></div></div>`; }
