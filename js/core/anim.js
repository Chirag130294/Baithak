// Animation helpers. Views are re-rendered as HTML, so we use the FLIP technique:
// measure keyed elements before the render, render, then slide each element from its old spot to its new one.
// Mark elements with data-flip="unique-key". Add data-enter to fade in elements that are new.
// Mark numbers or cards with data-anim="key" data-anim-val="value" to pop/flip when the value changes.

/** Animations setting kept on this phone: 'full' (default), 'light' (simple slides only) or 'off'. */
export const animLevel = () => { try { return localStorage.getItem('baithak:anim') || 'full'; } catch { return 'full'; } };
export const setAnimLevel = (v) => { try { localStorage.setItem('baithak:anim', v); } catch { /* ignore */ } };
export const reduceMotion = () => {
  if (animLevel() === 'off') return true;
  try { return !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
};
/** True when the big show-off animations (dealer arc, trump reveal) should play. */
export const fancyMotion = () => animLevel() === 'full' && !reduceMotion();

const seen = new WeakMap();

export function flipRender(root, renderFn, { animate = true } = {}) {
  const before = new Map();
  const can = animate && !reduceMotion();
  if (can) root.querySelectorAll('[data-flip]').forEach((el) => before.set(el.dataset.flip, el.getBoundingClientRect()));
  renderFn();
  if (can && before.size) {
    root.querySelectorAll('[data-flip]').forEach((el) => {
      if (typeof el.animate !== 'function') return;
      const prev = before.get(el.dataset.flip);
      if (!prev) {
        if (el.hasAttribute('data-enter')) el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out' });
        return;
      }
      const now = el.getBoundingClientRect();
      if (!prev.width || !now.width) return;   // was hidden (a collapsed section) or is hidden now: nothing to glide
      const dx = prev.left - now.left, dy = prev.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      // someone who moved UP/FORWARD (they used to be further along the row or lower down) pushes the others back
      const rising = dx > 1 || dy > 1;
      if (!fancyMotion()) { el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.4,0,.2,1)' }); return; }
      if (rising) {
        el.style.position = el.style.position || 'relative'; el.style.zIndex = '4';
        const a = el.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(1)`, boxShadow: '0 0 0 0 rgba(242,167,27,0)' },
          { transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) scale(1.14)`, boxShadow: '0 10px 22px rgba(242,167,27,.55)', offset: 0.45 },
          { transform: 'translate(0,0) scale(1.05)', boxShadow: '0 6px 14px rgba(242,167,27,.35)', offset: 0.8 },
          { transform: 'none', boxShadow: '0 0 0 0 rgba(242,167,27,0)' }
        ], { duration: 820, easing: 'cubic-bezier(.3,1.25,.5,1)' });
        a.onfinish = () => { el.style.zIndex = ''; };
      } else {   // pushed back: waits a beat, then is shoved along and settles with a little rebound
        el.animate([
          { transform: `translate(${dx}px, ${dy}px)`, offset: 0 },
          { transform: `translate(${dx}px, ${dy}px)`, offset: 0.14 },
          { transform: `translate(${-dx * 0.12}px, ${-dy * 0.12}px)`, offset: 0.78 },
          { transform: 'none' }
        ], { duration: 820, easing: 'cubic-bezier(.3,.9,.4,1)' });
      }
    });
  }
  animChange(root);
  countUp(root);
}

export function animChange(root) {
  let map = seen.get(root);
  const first = !map;
  if (!map) { map = new Map(); seen.set(root, map); }
  root.querySelectorAll('[data-anim]').forEach((el) => {
    const key = el.dataset.anim;
    const val = el.dataset.animVal ?? el.textContent;
    const old = map.get(key);
    map.set(key, val);
    if (first || old === undefined || old === val || reduceMotion()) return;
    const cls = el.dataset.animCls || 'pop';
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  });
}

/** Run a render function, but never while someone is typing in a field inside root. */
export function safeRender(root, renderFn, opts) {
  const a = document.activeElement;
  if (a && root.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) {
    return false;
  }
  flipRender(root, renderFn, opts);
  return true;
}

/** Confetti burst from the top of the screen (full animations only). */
export function confetti({ count = 90, colors = ['#F2A71B', '#FFFFFF', '#E8546A', '#5BE08A', '#7DB4FF', '#C58BFF'], duration = 2600 } = {}) {
  if (!fancyMotion() || typeof document === 'undefined') return;
  const W = innerWidth, H = innerHeight;
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:120;pointer-events:none;overflow:hidden';
  document.body.appendChild(layer);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const w = 6 + Math.random() * 7, h = w * (0.5 + Math.random());
    const x0 = W * (0.15 + Math.random() * 0.7), drift = (Math.random() - 0.5) * W * 0.7;
    p.style.cssText = `position:absolute;left:${x0}px;top:-20px;width:${w}px;height:${h}px;background:${colors[i % colors.length]};border-radius:${Math.random() < 0.3 ? '50%' : '2px'}`;
    layer.appendChild(p);
    const delay = Math.random() * 450, dur = duration * (0.7 + Math.random() * 0.6);
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${drift * 0.5}px, ${H * 0.45}px) rotate(${360 * (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random())}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${drift}px, ${H + 40}px) rotate(${720 * (Math.random() - 0.5)}deg)`, opacity: 0.9 }
    ], { duration: dur, delay, easing: 'cubic-bezier(.25,.6,.45,1)', fill: 'forwards' });
  }
  setTimeout(() => layer.remove(), duration + 1400);
}

/** Numbers that count up (or down) to their new value. Mark the number with data-count="<key>" data-count-val="<number>". */
const lastCounts = new WeakMap();
export function countUp(root) {
  let map = lastCounts.get(root); const first = !map; if (!map) { map = new Map(); lastCounts.set(root, map); }
  root.querySelectorAll('[data-count]').forEach((el) => {
    const key = el.dataset.count, val = Number(el.dataset.countVal);
    const old = map.get(key); map.set(key, val);
    if (first || old === undefined || old === val || !Number.isFinite(val) || !fancyMotion() || el.__counting) return;
    const final = el.textContent, from = old, t0 = performance.now(), dur = 700;
    el.__counting = true;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? String(Math.round(from + (val - from) * e)) : final;
      if (k < 1 && el.isConnected) requestAnimationFrame(step); else { el.textContent = final; el.__counting = false; }
    };
    requestAnimationFrame(step);
  });
}
