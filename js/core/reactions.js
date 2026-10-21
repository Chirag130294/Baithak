// Floating emoji reactions: anyone in the room (host or viewer) can send one, and it plays on every screen.
// Ten different animations. A reaction can be aimed at a player ("hammer Ravi") and then lands on that player's name.
import { esc } from './util.js';
import { t } from './i18n.js';
import { reduceMotion } from './anim.js';

export const REACTIONS = [
  { k: 'hammer', e: '🔨', label: 'Hammer', aim: true },
  { k: 'fire', e: '🔥', label: 'Fire' },
  { k: 'party', e: '🎉', label: 'Celebrate' },
  { k: 'clap', e: '👏', label: 'Clap' },
  { k: 'splash', e: '💦', label: 'Splash', aim: true },
  { k: 'laugh', e: '😂', label: 'Laugh' },
  { k: 'tomato', e: '🍅', label: 'Tomato', aim: true },
  { k: 'clown', e: '🤡', label: 'Clown', aim: true },
  { k: 'skull', e: '💀', label: 'Dead' },
  { k: 'heart', e: '❤️', label: 'Love' }
];
const BY = Object.fromEntries(REACTIONS.map((r) => [r.k, r]));
export const isReaction = (k) => k in BY;

const rnd = (a, b) => a + Math.random() * (b - a);
const MAX_LIVE = 7;

/** Finds a player's name on screen so an aimed reaction can land on it. Returns the element or null. */
function findTarget(host, name) {
  if (!name) return null;
  const want = name.trim();
  const pick = (sel) => [...host.querySelectorAll(sel)].find((el) => el.textContent.trim() === want && el.getBoundingClientRect().width > 0);
  return pick('.prow .nm b') || pick('.lbchip b') || pick('.plrow .bold') || null;
}

export function mountReactions({ host, store, code, getName, getTargets }) {
  const layer = document.createElement('div');
  layer.className = 'rx-layer'; layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const fab = document.createElement('button');
  fab.className = 'rx-fab'; fab.type = 'button'; fab.setAttribute('aria-label', t('Reactions')); fab.textContent = '😄';
  document.body.appendChild(fab);
  const tray = document.createElement('div');
  tray.className = 'rx-tray'; tray.hidden = true;
  document.body.appendChild(tray);

  let aim = '', live = 0, lastSent = 0, destroyed = false;

  const drawTray = () => {
    const names = (getTargets && getTargets()) || [];
    tray.innerHTML = `<div class="rx-grid">${REACTIONS.map((r) => `<button type="button" class="rx-b" data-k="${r.k}" aria-label="${esc(t(r.label))}"><span>${r.e}</span><small>${esc(t(r.label))}</small></button>`).join('')}</div>
      <div class="rx-aim"><span class="tiny muted">${esc(t('Aim at'))}</span><div class="rx-chips"><button type="button" class="rx-c ${aim === '' ? 'on' : ''}" data-aim="">${esc(t('Everyone'))}</button>${names.map((n) => `<button type="button" class="rx-c ${aim === n ? 'on' : ''}" data-aim="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>`;
  };
  fab.addEventListener('click', () => { tray.hidden = !tray.hidden; if (!tray.hidden) drawTray(); });
  tray.addEventListener('click', (e) => {
    const a = e.target.closest('[data-aim]');
    if (a) { aim = a.dataset.aim; drawTray(); return; }
    const b = e.target.closest('[data-k]'); if (!b) return;
    const now = Date.now();
    if (now - lastSent < 700) return; // gentle rate limit
    lastSent = now;
    const r = BY[b.dataset.k];
    store.reactions.send(code, { k: r.k, from: getName(), to: r.aim ? aim : '' }).catch(() => {});
    if (navigator.vibrate) navigator.vibrate(8);
    tray.hidden = true;
  });
  const closeOutside = (e) => { if (!tray.hidden && !tray.contains(e.target) && e.target !== fab) tray.hidden = true; };
  document.addEventListener('pointerdown', closeOutside);

  // ---------- animation ----------
  const el = (txt, css = {}, cls = '') => {
    const d = document.createElement('div');
    d.className = 'rx-el ' + cls; d.textContent = txt; Object.assign(d.style, css); layer.appendChild(d); return d;
  };
  const run = (node, frames, opts) => { const a = node.animate(frames, { fill: 'forwards', easing: 'ease-out', ...opts }); a.onfinish = () => node.remove(); return a; };
  const shake = (target) => { const row = target && (target.closest('.prow, .lbchip, .plrow') || target); if (row) row.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px) rotate(-1deg)' }, { transform: 'translateX(6px) rotate(1deg)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 420 }); };
  const ring = (x, y, color, size = 150, dur = 650) => { const r = el('', { left: x - size / 2 + 'px', top: y - size / 2 + 'px', width: size + 'px', height: size + 'px', border: `4px solid ${color}`, borderRadius: '50%', fontSize: '0' }); run(r, [{ transform: 'scale(.2)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }], { duration: dur }); };
  const tag = (x, y, text) => { const g = el(text, { left: x + 'px', top: y + 'px', fontSize: '13px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'var(--ink,#16251f)', color: '#fff', transform: 'translate(-50%,0)', whiteSpace: 'nowrap' }); run(g, [{ opacity: 0, transform: 'translate(-50%,6px)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0, transform: 'translate(-50%,-10px)' }], { duration: 2200 }); };
  const burst = (x, y, items, { dist = [70, 150], dur = 1000, size = [18, 30], gravity = 60 } = {}) => {
    items.forEach((it, i) => {
      const ang = (i / items.length) * Math.PI * 2 + rnd(-0.3, 0.3), d = rnd(dist[0], dist[1]);
      const n = el(it, { left: x + 'px', top: y + 'px', fontSize: rnd(size[0], size[1]) + 'px' });
      run(n, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d + gravity}px)) scale(1) rotate(${rnd(-200, 200)}deg)`, opacity: 0 }], { duration: dur + rnd(-150, 250) });
    });
  };
  const rise = (txt, x, { size = 34, dur = 2400, sway = 24, from = 0 } = {}) => {
    const h = window.innerHeight;
    const n = el(txt, { left: x + 'px', top: h - 140 + 'px', fontSize: size + 'px' });
    run(n, [{ transform: 'translate(-50%,0) scale(.5)', opacity: 0 }, { transform: `translate(calc(-50% + ${sway}px), -${h * 0.18}px) scale(1.05)`, opacity: 1, offset: 0.18 }, { transform: `translate(calc(-50% - ${sway}px), -${h * 0.42}px) scale(1)`, opacity: 1, offset: 0.6 }, { transform: `translate(-50%, -${h * 0.62}px) scale(.9)`, opacity: 0 }], { duration: dur, delay: from, easing: 'ease-in-out' });
  };

  function play(r) {
    const def = BY[r.k]; if (!def || destroyed) return;
    if (live >= MAX_LIVE) return;
    live++; setTimeout(() => { live = Math.max(0, live - 1); }, 2400);
    const W = window.innerWidth, H = window.innerHeight;
    const targetEl = def.aim ? findTarget(host, r.to) : null;
    const rect = targetEl ? targetEl.getBoundingClientRect() : null;
    const tx = rect ? rect.left + Math.min(rect.width, 120) / 2 : W / 2, ty = rect ? rect.top + rect.height / 2 : H * 0.42;
    const who = r.from || t('Someone');
    if (reduceMotion()) { const n = el(def.e, { left: tx + 'px', top: ty + 'px', fontSize: '48px', transform: 'translate(-50%,-50%)' }); run(n, [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1400 }); tag(tx, ty + 34, r.to ? `${who} → ${r.to}` : who); return; }
    tag(tx, ty + 40, r.to ? `${who} → ${r.to}` : who);
    switch (r.k) {
      case 'hammer': {
        const n = el('🔨', { left: tx + 'px', top: ty + 'px', fontSize: '64px', transformOrigin: '80% 90%' });
        run(n, [{ transform: 'translate(-50%,-190%) rotate(-80deg) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-150%) rotate(-70deg) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) rotate(15deg) scale(1.15)', opacity: 1, offset: 0.55 }, { transform: 'translate(-50%,-50%) rotate(5deg) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-60%) rotate(0) scale(1)', opacity: 0 }], { duration: 1500 });
        setTimeout(() => { ring(tx, ty, '#e8962e', 170, 600); burst(tx, ty, ['💥', '✨', '⭐', '✨'], { dist: [40, 90], dur: 700 }); shake(targetEl); const b = el('BONK!', { left: tx + 'px', top: ty - 46 + 'px', fontSize: '22px', fontWeight: 900, color: '#e8962e', textShadow: '0 2px 0 #fff' }); run(b, [{ transform: 'translate(-50%,0) scale(.4) rotate(-8deg)', opacity: 0 }, { transform: 'translate(-50%,-14px) scale(1.2) rotate(-4deg)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-34px) scale(1)', opacity: 0 }], { duration: 900 }); if (navigator.vibrate) navigator.vibrate([20, 30, 40]); }, 800);
        break;
      }
      case 'fire':
        for (let i = 0; i < 6; i++) rise('🔥', rnd(W * 0.15, W * 0.85), { size: rnd(30, 54), dur: rnd(1800, 2600), sway: rnd(10, 30), from: i * 110 });
        break;
      case 'party': {
        const cx = W / 2, cy = H * 0.45;
        const big = el('🎉', { left: cx + 'px', top: cy + 'px', fontSize: '70px' });
        run(big, [{ transform: 'translate(-50%,-50%) scale(.2) rotate(-25deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.25) rotate(8deg)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 1700 });
        burst(cx, cy, ['🎊', '✨', '🟡', '🟣', '🟢', '🔴', '⭐', '🎊', '✨', '🔵', '🟠', '⭐', '🎊', '✨'], { dist: [90, 200], dur: 1400, gravity: 120, size: [14, 26] });
        break;
      }
      case 'clap': {
        const cx = rnd(W * 0.3, W * 0.7), cy = H * 0.5;
        const n = el('👏', { left: cx + 'px', top: cy + 'px', fontSize: '60px' });
        run(n, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 1, offset: 0.12 }, { transform: 'translate(-50%,-50%) scale(1)', offset: 0.24 }, { transform: 'translate(-50%,-50%) scale(1.5)', offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(1)', offset: 0.52 }, { transform: 'translate(-50%,-50%) scale(1.5)', offset: 0.68 }, { transform: 'translate(-50%,-90%) scale(1)', opacity: 0 }], { duration: 1700 });
        [0, 1, 2].forEach((i) => setTimeout(() => { ring(cx, cy, '#f5c542', 110, 450); burst(cx, cy, ['✨', '✨'], { dist: [50, 90], dur: 600 }); }, 180 + i * 330));
        break;
      }
      case 'splash': {
        ring(tx, ty, '#3aa0e8', 120, 700); setTimeout(() => ring(tx, ty, '#7cc4f5', 190, 800), 120);
        const n = el('💦', { left: tx + 'px', top: ty + 'px', fontSize: '64px' });
        run(n, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-30%) scale(1)', opacity: 0 }], { duration: 1300 });
        burst(tx, ty, ['💧', '💧', '💧', '💧', '💧', '💧', '💧', '💧'], { dist: [50, 130], dur: 1000, gravity: 90, size: [16, 26] });
        shake(targetEl);
        break;
      }
      case 'laugh':
        for (let i = 0; i < 4; i++) rise('😂', rnd(W * 0.2, W * 0.8), { size: rnd(34, 50), dur: rnd(1700, 2300), sway: rnd(18, 34), from: i * 140 });
        break;
      case 'tomato': {
        const n = el('🍅', { left: W * rnd(0.3, 0.7) + 'px', top: H + 'px', fontSize: '48px' });
        const sx = parseFloat(n.style.left);
        run(n, [{ transform: 'translate(-50%,0) scale(.8) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${tx - sx}px), ${ty - H}px) scale(1.15) rotate(420deg)`, opacity: 1, offset: 0.78 }, { transform: `translate(calc(-50% + ${tx - sx}px), ${ty - H}px) scale(1.7, .5)`, opacity: 0 }], { duration: 900, easing: 'ease-in' });
        setTimeout(() => { ring(tx, ty, '#d93a2b', 130, 500); burst(tx, ty, ['🔴', '🔴', '🔴', '🍅', '🔴'], { dist: [30, 90], dur: 700, size: [10, 18] }); shake(targetEl); const sp = el('🔴', { left: tx + 'px', top: ty + 'px', fontSize: '56px', filter: 'blur(1px)' }); run(sp, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(1.3,.8)', opacity: 0.85, offset: 0.2 }, { transform: 'translate(-50%,-20%) scale(1.3,.8)', opacity: 0 }], { duration: 1500 }); }, 800);
        break;
      }
      case 'clown': {
        const n = el('🤡', { left: tx + 'px', top: ty + 'px', fontSize: '70px' });
        run(n, [{ transform: 'translate(-50%,-50%) scale(.1) rotate(-540deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.2) rotate(15deg)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1) rotate(-12deg)', offset: 0.55 }, { transform: 'translate(-50%,-50%) scale(1) rotate(10deg)', offset: 0.75 }, { transform: 'translate(-50%,-80%) scale(.9) rotate(0)', opacity: 0 }], { duration: 1800 });
        setTimeout(() => burst(tx, ty, ['🎈', '🎈', '🎪'], { dist: [60, 120], dur: 1100, gravity: -60, size: [20, 30] }), 400);
        shake(targetEl);
        break;
      }
      case 'skull': {
        const cx = rnd(W * 0.3, W * 0.7), cy = H * 0.5;
        const n = el('💀', { left: cx + 'px', top: cy + 'px', fontSize: '66px' });
        run(n, [{ transform: 'translate(-50%,-30%) scale(.4)', opacity: 0 }, { transform: 'translate(-52%,-50%) scale(1.1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-48%,-52%) scale(1.1)', offset: 0.3 }, { transform: 'translate(-52%,-54%) scale(1.1)', offset: 0.4 }, { transform: 'translate(-48%,-56%) scale(1.1)', offset: 0.5 }, { transform: 'translate(-50%,-150%) scale(1)', opacity: 0 }], { duration: 2000 });
        setTimeout(() => rise('👻', cx, { size: 34, dur: 1600, sway: 14 }), 700);
        break;
      }
      case 'heart':
        for (let i = 0; i < 7; i++) rise(['❤️', '💖', '💗'][i % 3], rnd(W * 0.2, W * 0.8), { size: rnd(24, 44), dur: rnd(2000, 3000), sway: rnd(12, 36), from: i * 130 });
        break;
      default:
    }
  }

  const off = store.reactions.watch(code, (r) => { if (isReaction(r.k)) play(r); });
  return {
    destroy() { destroyed = true; off && off(); document.removeEventListener('pointerdown', closeOutside); layer.remove(); fab.remove(); tray.remove(); },
    setHidden(v) { fab.style.display = v ? 'none' : ''; if (v) tray.hidden = true; }
  };
}
