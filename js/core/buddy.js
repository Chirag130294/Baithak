// "Card buddies": little playing-card characters with feelings. Original drawings, pure SVG + CSS (no image files).
// Moods: peek, kiss (then shy), confused, sleepy, angry, thinking, walk, cheer.
//   buddyHtml(mood, { size, suit })  -> an SVG string you can drop anywhere (used for the reaction buttons and in-game moments)
//   playBuddy(mood, { x, y, anchor, from, to, text, dur })  -> floats a buddy over the screen for a moment and returns a stop() function
import { esc } from './util.js';
import { t } from './i18n.js';
import { reduceMotion } from './anim.js';
import { suitSvg, CARD_COLOR } from './ui.js';

export const MOODS = ['peek', 'kiss', 'confused', 'sleepy', 'angry', 'thinking', 'walk', 'cheer'];
export const MOOD_TEXT = {
  peek: '{from} is peeking at {to}', kiss: '{from} blew a kiss to {to}', confused: '{from} is confused by {to}', sleepy: '{from} is sleepy',
  angry: '{from} is angry at {to}', thinking: '{from} is thinking', walk: '{from} walks in', cheer: '{from} cheers!'
};
export const MOOD_LABEL = { peek: 'Peek', kiss: 'Kiss', confused: 'Confused', sleepy: 'Sleepy', angry: 'Angry', thinking: 'Thinking', walk: 'Walk', cheer: 'Cheer' };
export const MOOD_AIM = { peek: true, kiss: true, angry: true, confused: true, thinking: false, sleepy: false, walk: false, cheer: false };

const SUITS = ['S', 'D', 'C', 'H'];
const eye = (cx, cy, kind) => {
  if (kind === 'closed') return `<path class="b-eye" d="M${cx - 6} ${cy} q6 6 12 0" fill="none" stroke="#17201c" stroke-width="3" stroke-linecap="round"/>`;
  if (kind === 'happy') return `<path class="b-eye" d="M${cx - 6} ${cy + 2} q6 -8 12 0" fill="none" stroke="#17201c" stroke-width="3" stroke-linecap="round"/>`;
  if (kind === 'swirl') return `<g class="b-eye b-swirl"><circle cx="${cx}" cy="${cy}" r="7" fill="#fff" stroke="#17201c" stroke-width="2"/><path d="M${cx} ${cy} m0 0 a2 2 0 1 1 2 2 a4 4 0 1 1 -4 -4 a6 6 0 1 1 6 6" fill="none" stroke="#17201c" stroke-width="1.6" stroke-linecap="round"/></g>`;
  return `<g class="b-eye"><ellipse cx="${cx}" cy="${cy}" rx="6" ry="7.5" fill="#17201c"/><circle class="b-shine" cx="${cx + 2}" cy="${cy - 2.5}" r="2.2" fill="#fff"/></g>`;
};
const FACES = {
  base:     { l: 'open', r: 'open', mouth: '<path class="b-mouth" d="M38 70 q12 12 24 0" fill="none" stroke="#17201c" stroke-width="3" stroke-linecap="round"/>' },
  peek:     { l: 'open', r: 'open', mouth: '<path class="b-mouth" d="M43 71 q7 5 14 0" fill="none" stroke="#17201c" stroke-width="3" stroke-linecap="round"/>' },
  kiss:     { l: 'happy', r: 'happy', mouth: '<path class="b-mouth b-pucker" d="M46 68 q4 -4 8 0 q-4 7 -8 0z" fill="#e8546a"/>' },
  confused: { l: 'swirl', r: 'open', mouth: '<path class="b-mouth" d="M40 72 q5 -5 10 0 q5 5 10 0" fill="none" stroke="#17201c" stroke-width="3" stroke-linecap="round"/>' },
  sleepy:   { l: 'closed', r: 'closed', mouth: '<ellipse class="b-mouth b-snore" cx="50" cy="71" rx="4" ry="3" fill="#17201c"/>' },
  angry:    { l: 'open', r: 'open', mouth: '<path class="b-mouth" d="M38 74 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4" fill="none" stroke="#17201c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' },
  thinking: { l: 'open', r: 'open', mouth: '<path class="b-mouth" d="M42 72 h14" fill="none" stroke="#17201c" stroke-width="3" stroke-linecap="round"/>' },
  walk:     { l: 'open', r: 'open', mouth: '<path class="b-mouth" d="M38 69 q12 14 24 0z" fill="#fff" stroke="#17201c" stroke-width="2.5" stroke-linejoin="round"/>' },
  cheer:    { l: 'happy', r: 'happy', mouth: '<path class="b-mouth" d="M37 67 q13 20 26 0z" fill="#e8546a" stroke="#17201c" stroke-width="2.5" stroke-linejoin="round"/>' }
};
const EXTRA = {
  peek: '',
  kiss: '<g class="b-fx b-hearts"><text x="64" y="52" font-size="14">💋</text></g>',
  confused: '<g class="b-fx"><text class="b-q q1" x="66" y="22" font-size="20" font-weight="800" fill="#e8962e">?</text><text class="b-q q2" x="22" y="14" font-size="14" font-weight="800" fill="#1d5fbf">?</text></g>',
  sleepy: '<g class="b-fx"><text class="b-z z1" x="66" y="26" font-size="16" font-weight="800" fill="#5a6fae">Z</text><text class="b-z z2" x="74" y="14" font-size="12" font-weight="800" fill="#5a6fae">z</text><text class="b-z z3" x="80" y="6" font-size="9" font-weight="800" fill="#5a6fae">z</text></g>',
  angry: '<g class="b-fx"><text class="b-steam s1" x="12" y="14" font-size="16">💢</text><text class="b-steam s2" x="72" y="12" font-size="16">💢</text></g>',
  thinking: '<g class="b-fx"><circle class="b-dot d1" cx="76" cy="26" r="3" fill="#8a96a0"/><circle class="b-dot d2" cx="84" cy="16" r="4" fill="#8a96a0"/><text class="b-bulb" x="70" y="8" font-size="18">💡</text></g>',
  walk: '',
  cheer: '<g class="b-fx"><text class="b-star st1" x="8" y="20" font-size="14">✨</text><text class="b-star st2" x="78" y="22" font-size="14">⭐</text><text class="b-star st3" x="44" y="6" font-size="12">🎉</text></g>'
};
const BROWS = {
  angry: '<path class="b-brow" d="M32 50 l16 6 M68 50 l-16 6" stroke="#17201c" stroke-width="4" stroke-linecap="round"/>',
  confused: '<path class="b-brow" d="M32 52 q6 -5 12 -1 M56 50 l12 -4" stroke="#17201c" stroke-width="3" stroke-linecap="round" fill="none"/>',
  sleepy: '', thinking: '<path class="b-brow" d="M34 51 l10 -3 M56 48 l10 3" stroke="#17201c" stroke-width="3" stroke-linecap="round"/>'
};

/** One buddy as an SVG string. */
export function buddyHtml(mood = 'peek', { size = 64, suit = 'S' } = {}) {
  const f = FACES[mood] || FACES.base, sc = CARD_COLOR[suit] || '#17201c';
  const w = Math.round(size * 0.78);
  return `<svg class="bd bd-${mood}" width="${w}" height="${size}" viewBox="0 0 100 128" aria-hidden="true" style="overflow:visible">
    <g class="b-all">
      <g class="b-legL"><path d="M38 108 v16" stroke="#17201c" stroke-width="5" stroke-linecap="round"/><ellipse cx="36" cy="125" rx="7" ry="3.5" fill="#17201c"/></g>
      <g class="b-legR"><path d="M62 108 v16" stroke="#17201c" stroke-width="5" stroke-linecap="round"/><ellipse cx="64" cy="125" rx="7" ry="3.5" fill="#17201c"/></g>
      <g class="b-armL"><path d="M14 70 q-10 6 -10 20" fill="none" stroke="#17201c" stroke-width="5" stroke-linecap="round"/><circle cx="4" cy="92" r="5" fill="#fff" stroke="#17201c" stroke-width="2.5"/></g>
      <g class="b-body">
        <rect x="12" y="6" width="76" height="106" rx="12" fill="#fff" stroke="#17201c" stroke-width="3.5"/>
        <rect class="b-flush" x="12" y="6" width="76" height="106" rx="12" fill="#ff5a4d" opacity="0"/>
        <g transform="translate(18 12)">${suitSvg(suit, 14, sc)}</g>
        <g class="b-face">
          ${eye(37, 56, f.l)}${eye(63, 56, f.r)}
          ${BROWS[mood] || ''}
          <ellipse class="b-cheek" cx="30" cy="68" rx="6" ry="4" fill="#ff8aa1" opacity=".55"/><ellipse class="b-cheek" cx="70" cy="68" rx="6" ry="4" fill="#ff8aa1" opacity=".55"/>
          ${f.mouth}
        </g>
      </g>
      <g class="b-armR"><path d="M86 70 q10 6 10 20" fill="none" stroke="#17201c" stroke-width="5" stroke-linecap="round"/><circle cx="96" cy="92" r="5" fill="#fff" stroke="#17201c" stroke-width="2.5"/></g>
    </g>${EXTRA[mood] || ''}</svg>`;
}

const layerEl = () => {
  let l = document.getElementById('bd-layer');
  if (!l) { l = document.createElement('div'); l.id = 'bd-layer'; l.setAttribute('aria-hidden', 'true'); document.body.appendChild(l); }
  return l;
};
const initial = (n) => (Array.from(String(n || '?').trim())[0] || '?').toLocaleUpperCase();

/** A top ribbon that says clearly who is sending what to whom. */
export function ribbon({ from, to, mood, emoji = '' }) {
  document.querySelectorAll('.bd-ribbon').forEach((r) => r.remove());
  const txt = MOOD_TEXT[mood] ? t(MOOD_TEXT[mood], { from: from || t('Someone'), to: to || '' }) : `${from || t('Someone')} ${emoji}${to ? ' → ' + to : ''}`;
  const r = document.createElement('div'); r.className = 'bd-ribbon'; r.setAttribute('role', 'status');
  r.innerHTML = `<span class="bd-av">${esc(initial(from))}</span><span class="bd-txt">${esc(txt)}</span>${to ? `<span class="bd-av to">${esc(initial(to))}</span>` : ''}`;
  // sit just under the header (never on top of its buttons or title), and stay long enough to read
  const hd = document.querySelector('.topbar');
  const hb = hd ? hd.getBoundingClientRect().bottom : 0;
  r.style.top = Math.round(hb + 10) + 'px';
  document.body.appendChild(r);
  setTimeout(() => { r.classList.add('out'); setTimeout(() => r.remove(), 400); }, 3600);
}

/**
 * Show a buddy for a moment.  opts: { anchor: Element to stand near / peek from behind, x, y: screen point, from, to, text, dur, suit, quiet }
 * Returns stop().
 */
export function playBuddy(mood, opts = {}) {
  const { anchor, from, to, dur = 3200, suit = SUITS[Math.floor(Math.random() * 4)], size = 84, quiet = false } = opts;
  if (!quiet && (from || to)) ribbon({ from, to, mood });
  const W = window.innerWidth, H = window.innerHeight;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
  const cx = r ? Math.min(W - 50, Math.max(50, r.right - 46)) : (opts.x ?? W / 2);
  const cy = r ? (mood === 'peek' ? r.top + 4 : r.top + r.height / 2) : (opts.y ?? H * 0.45);
  const wrap = document.createElement('div');
  wrap.className = `bd-wrap bd-w-${mood}`;
  wrap.style.cssText = `left:${cx}px;top:${cy}px;--bd-size:${size}px;--bd-dur:${dur}ms`;
  const still = reduceMotion();
  if (mood === 'walk') { wrap.style.top = Math.min(H - size - 90, cy) + 'px'; wrap.style.left = '0px'; }
  wrap.innerHTML = `<div class="bd-pose">${buddyHtml(mood, { size, suit })}</div>${opts.text ? `<div class="bd-say">${esc(opts.text)}</div>` : ''}`;
  if (mood === 'peek') wrap.innerHTML = `<div class="bd-clip"><div class="bd-pose">${buddyHtml(mood, { size, suit })}</div></div>`;
  layerEl().appendChild(wrap);
  if (mood === 'kiss' && r && !still) {   // the kiss itself flies to the person it is aimed at
    setTimeout(() => {
      const k = document.createElement('div'); k.className = 'bd-kiss'; k.textContent = '💋';
      k.style.cssText = `left:${cx}px;top:${cy - 8}px`;
      layerEl().appendChild(k);
      const dx = (r.left + r.width / 2) - cx, dy = 0;
      k.animate([{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 1, offset: 0.2 }, { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% - 50px)) scale(1.2)`, opacity: 1, offset: 0.6 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.8)`, opacity: 0 }], { duration: 1100, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => k.remove();
    }, 650);
  }
  const gone = setTimeout(() => stop(), dur);
  function stop() { clearTimeout(gone); wrap.classList.add('bd-out'); setTimeout(() => wrap.remove(), 350); }
  return stop;
}
