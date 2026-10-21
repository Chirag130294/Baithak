// Shared UI pieces: icons, avatars, suits, toasts, sheets, collapsible sections.
import { firstLetter } from './names.js';
import { esc } from './util.js';
import { t } from './i18n.js';

export const PALETTE = [
  ['#F2A71B', '#12261F'], ['#CFE3F7', '#0F3F7A'], ['#DDF3E4', '#14532D'], ['#F7D9D6', '#8E1B1B'],
  ['#E3DAF3', '#44217A'], ['#FFE3C2', '#7A3A00'], ['#D6EFEF', '#0B4F4F'], ['#EAE0D0', '#4A3A22']
];

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<circle cx="12" cy="5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  chevDown: '<path d="M6 9l6 6 6-6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  grip: '<path d="M5 8h14M5 12h14M5 16h14"/>',
  shuffle: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
  share: '<path d="M12 16V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.5 2.2 3.5 5.2"/>',
  home: '<path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  log: '<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  warn: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/>',
  download: '<path d="M12 4v12M8 12l4 4 4-4M5 20h14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  phone: '<rect x="7" x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'
};

export const buzz = (ms = 8) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported */ } };

export function icon(name, size = 22, stroke = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ---- suits (Kali, Chatai, Fuli, Lal) ----
export const SUITS = {
  S: { key: 'S', name: 'Kali', gu: 'કાળી', color: '#1B1B1B', d: 'M12 2C9.5 6 3.5 9.5 3.5 14.2a4.3 4.3 0 0 0 7.6 2.8C11 19 10.4 20.8 9 22h6c-1.4-1.2-2-3-2.1-5a4.3 4.3 0 0 0 7.6-2.8C20.5 9.5 14.5 6 12 2z', d2: '' },
  D: { key: 'D', name: 'Chatai', gu: 'ચટાઈ', color: '#1D5FBF', d: 'M12 2l7 10-7 10-7-10z', d2: '' },
  C: { key: 'C', name: 'Fuli', gu: 'ફૂલી', color: '#2E7D32', d: 'M7.5 6.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM2.3 14a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM12.7 14a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0z', d2: 'M10.8 13h2.4l1.3 9h-5z' },
  H: { key: 'H', name: 'Lal', gu: 'લાલ', color: '#C62828', d: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z', d2: '' },
  N: { key: 'N', name: 'No trump', gu: 'ટ્રમ્પ નહીં', color: '#44564D', d: 'M4 6h16M4 12h16M4 18h16', d2: '', stroke: true }
};

export function suitSvg(key, size = 26, color) {
  const s = { ...(SUITS[key] || SUITS.S) };
  if (color) s.color = color;
  if (s.stroke) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="${s.d}"/></svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${s.d}" fill="${s.color}"/>${s.d2 ? `<path d="${s.d2}" fill="${s.color}"/>` : ''}</svg>`;
}

/** Playing-card colours: Lal and Chatai are red, Kali and Fuli are black. */
export const CARD_COLOR = { S: '#17201c', C: '#17201c', D: '#D32F2F', H: '#D32F2F', N: '#44564D' };
/** A small white playing card with the suit in the corner and in the middle. */
export function trumpCard(key, { w = 40, cls = '' } = {}) {
  const h = Math.round(w * 1.4), col = CARD_COLOR[key] || '#17201c';
  return `<span class="tcard ${cls}" style="width:${w}px;height:${h}px"><i class="tc-corner">${suitSvg(key, Math.round(w * 0.26), col)}</i><i class="tc-mid">${suitSvg(key, Math.round(w * 0.56), col)}</i><i class="tc-corner br">${suitSvg(key, Math.round(w * 0.26), col)}</i></span>`;
}

export const suitName = (key) => t(SUITS[key]?.name || key);

// ---- avatars ----
export function initial(name) {
  return firstLetter(name);
}
export function avatar(p, cls = '', dim = false) {
  const [bg, fg] = PALETTE[(p && p.color) % PALETTE.length] || PALETTE[0];
  return `<span class="avatar ${cls}" style="background:${bg};color:${fg};${dim ? 'opacity:.5' : ''}">${esc(initial(p && p.name))}</span>`;
}

// ---- toasts ----
export function toast(msg, kind = '') {
  const root = document.getElementById('toasts');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 2800);
}

// ---- sheets ----
const openSheets = new Set();
export function openSheet(html, { onMount, onClose } = {}) {
  const root = document.getElementById('sheet-root');
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = '<div class="grab"></div><div class="sheet-body"></div>';
  const body = sheet.querySelector('.sheet-body');
  body.innerHTML = html;
  root.append(scrim, sheet);
  requestAnimationFrame(() => { scrim.classList.add('in'); sheet.classList.add('in'); });
  let closed = false;
  const api = {
    el: body,
    setHtml(h) { body.innerHTML = h; },
    close() {
      if (closed) return;
      closed = true;
      openSheets.delete(api);
      scrim.classList.remove('in'); sheet.classList.remove('in');
      setTimeout(() => { scrim.remove(); sheet.remove(); }, 300);
      if (onClose) onClose();
    }
  };
  scrim.addEventListener('click', api.close);
  sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
  openSheets.add(api);
  if (onMount) onMount(body, api);
  return api;
}
export function closeAllSheets() { [...openSheets].forEach((s) => s.close()); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllSheets(); });

export function confirmSheet({ title, text = '', ok = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let decided = false;
    const s = openSheet(`
      <h2>${esc(title)}</h2>
      ${text ? `<p class="muted" style="margin-bottom:14px;line-height:1.45">${esc(text)}</p>` : ''}
      <div class="row" style="gap:8px">
        <button class="btn ghost grow" data-close>${esc(t(cancel))}</button>
        <button class="btn ${danger ? 'danger' : 'dark'} grow" data-ok>${esc(t(ok))}</button>
      </div>`, { onClose: () => { if (!decided) resolve(false); } });
    s.el.querySelector('[data-ok]').addEventListener('click', () => { decided = true; resolve(true); s.close(); });
  });
}

// ---- collapsible sections ----
export function fold(id, title, body, isOpen, extra = '') {
  return `<section class="fold ${isOpen ? 'open' : ''}" data-fold="${esc(id)}">
    <button class="fold-head" type="button" aria-expanded="${isOpen ? 'true' : 'false'}" data-fold-btn>
      <span>${title}</span>
      <span class="row" style="gap:6px">${extra}<span class="chev">${icon('chevDown', 20, 2.2)}</span></span>
    </button>
    <div class="fold-body"><div class="fold-inner">${body}</div></div>
  </section>`;
}
export function bindFolds(root, store) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fold-btn]');
    if (!b || !root.contains(b)) return;
    const f = b.closest('[data-fold]');
    const open = !f.classList.contains('open');
    f.classList.toggle('open', open);
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    store[f.dataset.fold] = open;
  });
}

export const segHtml = (opts, value, attr) =>
  `<div class="seg">${opts.map((o) => `<button type="button" class="${o.v === value ? 'on' : ''}" ${attr}="${esc(o.v)}">${esc(o.label)}</button>`).join('')}</div>`;
